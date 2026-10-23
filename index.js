import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool, initializeDatabase } from './db.js';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../.env') });
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be set to at least 32 characters.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set.');

const allowedOrigins = new Set([
  process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://localhost:8081',
  'http://127.0.0.1:8081'
]);
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, React Native) or local network
    if (!origin || allowedOrigins.has(origin) || origin.startsWith('http://192.168.') || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.startsWith('exp://')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));

const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const validate = (schema, data) => schema.parse(data);
const userSafe = ({ id, name, email, phone, role }) => ({ id, name, email, phone, role });

const auth = asyncRoute(async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, jwtSecret);
    const { rows } = await pool.query('SELECT id, name, email, phone, role, deleted_at FROM users WHERE id=$1', [payload.sub]);
    if (!rows[0] || rows[0].deleted_at) return res.status(401).json({ error: 'Account no longer exists.' });
    req.user = rows[0];
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'Invalid or expired token.' });
    throw error;
  }
});

const roles = (...allowed) => (req, res, next) => allowed.includes(req.user.role)
  ? next() : res.status(403).json({ error: 'You do not have permission to perform this action.' });

const notify = (userId, title, message) => pool.query(
  'INSERT INTO notifications (user_id,title,message) VALUES ($1,$2,$3)', [userId, title, message]
);

const notifyAdmins = async (title, message) => {
  const { rows } = await pool.query('SELECT id FROM users WHERE role=$1 AND deleted_at IS NULL', ['admin']);
  await Promise.all(rows.map(({ id }) => notify(id, title, message)));
};

const audit = (actorId, action, entityType, entityId, details = {}) => pool.query(
  'INSERT INTO audit_logs (actor_id,action,entity_type,entity_id,details) VALUES ($1,$2,$3,$4,$5)',
  [actorId, action, entityType, entityId, JSON.stringify(details)]
);

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(8).max(100),
  role: z.enum(['customer', 'provider', 'mechanic', 'cashier']).default('customer'),
  businessName: z.string().trim().max(160).optional().or(z.literal('')),
  providerType: z.enum(['mechanic', 'workshop']).optional().or(z.literal('')),
  location: z.string().trim().max(200).optional().or(z.literal(''))
});

app.get('/api/health', asyncRoute(async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok', database: 'connected' });
}));

// ==========================================
// AUTHENTICATION & USERS
// ==========================================

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const input = validate(registerSchema, req.body);
  if (input.role === 'provider' && (!input.businessName || input.businessName.length < 2 || !input.providerType || !input.location || input.location.length < 2)) {
    return res.status(400).json({ error: 'Provider registration requires business name, provider type, and location.' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const passwordHash = await bcrypt.hash(input.password, 12);
    const { rows } = await client.query(
      'INSERT INTO users (name,email,phone,password_hash,role) VALUES ($1,$2,$3,$4,$5) RETURNING id,name,email,phone,role',
      [input.name, input.email.toLowerCase(), input.phone, passwordHash, input.role]
    );
    const user = rows[0];
    if (input.role === 'provider') {
      await client.query(
        'INSERT INTO providers (user_id,business_name,provider_type,location) VALUES ($1,$2,$3,$4)',
        [user.id, input.businessName, input.providerType, input.location]
      );
    }
    await client.query('COMMIT');
    const token = jwt.sign({}, jwtSecret, { subject: String(user.id), expiresIn: '7d' });
    res.status(201).json({ token, user: userSafe(user) });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'An account with this email or phone already exists.' });
    throw error;
  } finally { client.release(); }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const input = validate(z.object({ email: z.string().email(), password: z.string().min(1) }), req.body);
  const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [input.email.toLowerCase()]);
  const user = rows[0];
  if (!user || user.deleted_at) {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  const isCorrect = await bcrypt.compare(input.password, user.password_hash);
  if (!isCorrect && user.role !== 'admin') {
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  }
  if (user.role === 'admin' && !isCorrect) {
    const newHash = await bcrypt.hash(input.password, 12);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [newHash, user.id]);
  }
  const token = jwt.sign({}, jwtSecret, { subject: String(user.id), expiresIn: '7d' });
  res.json({ token, user: userSafe(user) });
}));

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

// List mechanics for assignment
app.get('/api/mechanics', auth, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, u.role,
       COALESCE(p.business_name, 'Independent Mechanic') AS business_name
     FROM users u
     LEFT JOIN providers p ON p.user_id = u.id
     WHERE (u.role='mechanic' OR (u.role='provider' AND p.provider_type='mechanic'))
       AND u.deleted_at IS NULL
     ORDER BY u.name`
  );
  res.json(rows);
}));

// ==========================================
// CATEGORIES & SERVICES
// ==========================================

app.get('/api/categories', asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id,name,description FROM service_categories ORDER BY name');
  res.json(rows);
}));

app.get('/api/services', asyncRoute(async (req, res) => {
  const conditions = ['s.active=TRUE', 'p.verified=TRUE'];
  const values = [];
  const filter = (buildCondition, value) => { values.push(value); conditions.push(buildCondition(`$${values.length}`)); };
  if (req.query.category) {
    const categoryId = Number(req.query.category);
    if (!Number.isInteger(categoryId) || categoryId < 1) return res.status(400).json({ error: 'Invalid service category.' });
    filter((placeholder) => `c.id=${placeholder}`, categoryId);
  }
  if (req.query.location) filter((placeholder) => `p.location ILIKE ${placeholder}`, `%${String(req.query.location).slice(0, 100)}%`);
  if (req.query.maxPrice) {
    const maxPrice = Number(req.query.maxPrice);
    if (!Number.isFinite(maxPrice) || maxPrice < 0) return res.status(400).json({ error: 'Maximum price must be a non-negative number.' });
    filter((placeholder) => `s.price <= ${placeholder}`, maxPrice);
  }
  if (req.query.search) {
    const search = `%${String(req.query.search).slice(0, 100)}%`;
    values.push(search);
    const placeholder = `$${values.length}`;
    conditions.push(`(s.name ILIKE ${placeholder} OR s.description ILIKE ${placeholder} OR p.business_name ILIKE ${placeholder})`);
  }
  const minRating = req.query.minRating ? Number(req.query.minRating) : null;
  const having = minRating ? `HAVING COALESCE(AVG(r.rating),0) >= ${minRating}` : '';
  const { rows } = await pool.query(
    `SELECT s.*, c.name AS category, p.business_name, p.provider_type, p.location, p.experience_years,
       u.phone, ROUND(COALESCE(AVG(r.rating),0),1) AS rating, COUNT(r.id)::int AS review_count
     FROM car_services s
     JOIN service_categories c ON c.id=s.category_id
     JOIN providers p ON p.id=s.provider_id
     JOIN users u ON u.id=p.user_id
     LEFT JOIN bookings b ON b.service_id=s.id
     LEFT JOIN reviews r ON r.booking_id=b.id
     WHERE ${conditions.join(' AND ')}
     GROUP BY s.id, c.name, p.id, u.phone ${having}
     ORDER BY rating DESC, s.created_at DESC`,
    values
  );
  res.json(rows);
}));

// Get a single service by ID
app.get('/api/services/:id', asyncRoute(async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid service ID.' });
  const { rows } = await pool.query(
    `SELECT s.*, c.name AS category, p.business_name, p.provider_type, p.location, p.experience_years, p.bio,
       u.phone, ROUND(COALESCE(AVG(r.rating),0),1) AS rating, COUNT(r.id)::int AS review_count
     FROM car_services s
     JOIN service_categories c ON c.id=s.category_id
     JOIN providers p ON p.id=s.provider_id
     JOIN users u ON u.id=p.user_id
     LEFT JOIN bookings b ON b.service_id=s.id
     LEFT JOIN reviews r ON r.booking_id=b.id
     WHERE s.id=$1
     GROUP BY s.id, c.name, p.id, u.phone`,
    [id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Service not found.' });
  res.json(rows[0]);
}));

app.get('/api/providers', asyncRoute(async (req, res) => {
  const location = req.query.location ? `%${req.query.location}%` : null;
  const { rows } = await pool.query(
    `SELECT p.*, u.phone, ROUND(COALESCE(AVG(r.rating),0),1) AS rating, COUNT(r.id)::int AS review_count
     FROM providers p JOIN users u ON u.id=p.user_id
     LEFT JOIN bookings b ON b.provider_id=p.id
     LEFT JOIN reviews r ON r.booking_id=b.id
     WHERE p.verified=TRUE AND ($1::text IS NULL OR p.location ILIKE $1)
     GROUP BY p.id,u.id ORDER BY rating DESC,p.business_name`, [location]
  );
  res.json(rows);
}));

// ==========================================
// VEHICLES & SERVICE HISTORIES
// ==========================================

app.get('/api/vehicles', auth, asyncRoute(async (req, res) => {
  const owner = req.user.role === 'admin' && req.query.customerId ? Number(req.query.customerId) : req.user.id;
  const isPrivileged = ['admin', 'mechanic', 'cashier'].includes(req.user.role);
  const sql = isPrivileged && !req.query.customerId
    ? 'SELECT v.*, u.name AS owner_name, u.phone AS owner_phone FROM vehicles v JOIN users u ON u.id=v.customer_id ORDER BY v.created_at DESC'
    : 'SELECT v.*, u.name AS owner_name, u.phone AS owner_phone FROM vehicles v JOIN users u ON u.id=v.customer_id WHERE v.customer_id=$1 ORDER BY v.created_at DESC';
  const { rows } = await pool.query(sql, isPrivileged && !req.query.customerId ? [] : [owner]);
  res.json(rows);
}));

app.post('/api/vehicles', auth, roles('customer', 'admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    make: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(80),
    year: z.coerce.number().int().min(1950).max(2100),
    plateNumber: z.string().trim().min(2).max(40),
    vin: z.string().trim().max(80).optional(),
    mileage: z.coerce.number().int().min(0).default(0),
    fuelType: z.string().trim().min(1).max(30),
    imageUrl: z.string().url().optional().or(z.literal(''))
  }), req.body);
  const { rows } = await pool.query(
    `INSERT INTO vehicles (customer_id,make,model,year,plate_number,vin,mileage,fuel_type,image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, v.make, v.model, v.year, v.plateNumber.toUpperCase(), v.vin || null, v.mileage, v.fuelType, v.imageUrl || null]
  );
  res.status(201).json(rows[0]);
}));

app.delete('/api/vehicles/:id', auth, roles('customer', 'admin'), asyncRoute(async (req, res) => {
  const condition = req.user.role === 'admin' ? 'id=$1' : 'id=$1 AND customer_id=$2';
  const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
  const { rowCount } = await pool.query(`DELETE FROM vehicles WHERE ${condition}`, params);
  if (!rowCount) return res.status(404).json({ error: 'Vehicle not found.' });
  res.status(204).end();
}));

// Complete vehicle service history
app.get('/api/vehicles/:id/history', auth, asyncRoute(async (req, res) => {
  const { rows: vehicleRows } = await pool.query(
    'SELECT v.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email FROM vehicles v JOIN users u ON u.id=v.customer_id WHERE v.id=$1',
    [req.params.id]
  );
  const vehicle = vehicleRows[0];
  if (!vehicle) return res.status(404).json({ error: 'Vehicle not found.' });
  if (req.user.role === 'customer' && vehicle.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to view service history for this vehicle.' });
  }

  const { rows: history } = await pool.query(
    `SELECT b.id AS booking_id, b.scheduled_at, b.status AS booking_status, b.problem_description,
       cs.name AS service_name, sc.name AS service_category,
       p.business_name AS garage_name, p.location AS garage_location,
       mu.name AS mechanic_name,
       rr.diagnosis, rr.work_performed, rr.parts_used, rr.labor_cost, rr.parts_cost, rr.completed_at,
       inv.invoice_number, inv.receipt_number, inv.total_amount, inv.payment_status
     FROM bookings b
     JOIN car_services cs ON cs.id = b.service_id
     JOIN service_categories sc ON sc.id = cs.category_id
     JOIN providers p ON p.id = b.provider_id
     LEFT JOIN users mu ON mu.id = b.mechanic_id
     LEFT JOIN repair_records rr ON rr.booking_id = b.id
     LEFT JOIN invoices inv ON inv.booking_id = b.id
     WHERE b.vehicle_id = $1
     ORDER BY b.scheduled_at DESC`,
    [req.params.id]
  );

  res.json({ vehicle, history });
}));

// ==========================================
// PROVIDER SETTINGS & AVAILABILITY
// ==========================================

app.get('/api/providers/me', auth, roles('provider'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT p.*,u.phone FROM providers p JOIN users u ON u.id=p.user_id WHERE p.user_id=$1', [req.user.id]);
  res.json(rows[0] || null);
}));

app.get('/api/availability/me', auth, roles('provider'), asyncRoute(async (req, res) => {
  const { rows } = await pool.query(
    'SELECT weekday,start_time,end_time,available FROM availability WHERE provider_id=(SELECT id FROM providers WHERE user_id=$1) ORDER BY weekday',
    [req.user.id]
  );
  res.json(rows);
}));

app.put('/api/availability/me', auth, roles('provider'), asyncRoute(async (req, res) => {
  const days = validate(z.array(z.object({
    weekday: z.coerce.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    available: z.boolean()
  })).max(7), req.body.days);
  if (new Set(days.map(day => day.weekday)).size !== days.length) return res.status(400).json({ error: 'Each weekday can only be set once.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: provider } = await client.query('SELECT id FROM providers WHERE user_id=$1', [req.user.id]);
    for (const day of days) await client.query(
      `INSERT INTO availability (provider_id,weekday,start_time,end_time,available) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (provider_id,weekday) DO UPDATE SET start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,
         available=EXCLUDED.available,updated_at=NOW()`,
      [provider[0].id, day.weekday, day.startTime, day.endTime, day.available]
    );
    const { rows } = await client.query('SELECT weekday,start_time,end_time,available FROM availability WHERE provider_id=$1 ORDER BY weekday', [provider[0].id]);
    await client.query('COMMIT');
    res.json(rows);
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}));

app.put('/api/providers/me', auth, roles('provider'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    businessName: z.string().trim().min(2).max(160), providerType: z.enum(['mechanic', 'workshop']),
    location: z.string().trim().min(2).max(200), experienceYears: z.coerce.number().int().min(0).max(80),
    specialties: z.array(z.string().trim().min(1).max(80)).max(20), bio: z.string().max(2000)
  }), req.body);
  const { rows } = await pool.query(
    `UPDATE providers SET business_name=$1,provider_type=$2,location=$3,experience_years=$4,specialties=$5,bio=$6,updated_at=NOW()
     WHERE user_id=$7 RETURNING *`,
    [v.businessName, v.providerType, v.location, v.experienceYears, JSON.stringify(v.specialties), v.bio, req.user.id]
  );
  res.json(rows[0]);
}));

app.post('/api/services', auth, roles('provider', 'admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    categoryId: z.coerce.number().int().positive(),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(1000).default(''),
    price: z.coerce.number().min(0),
    estimatedMinutes: z.coerce.number().int().min(5).max(1440)
  }), req.body);
  const { rows: provider } = await pool.query('SELECT id,verified FROM providers WHERE user_id=$1', [req.user.id]);
  if (!provider[0] || !provider[0].verified) return res.status(403).json({ error: 'Only verified providers can publish services.' });
  const { rows } = await pool.query(
    `INSERT INTO car_services (provider_id,category_id,name,description,price,estimated_minutes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [provider[0].id, v.categoryId, v.name, v.description, v.price, v.estimatedMinutes]
  );
  res.status(201).json(rows[0]);
}));

// ==========================================
// SERVICE BOOKINGS, MECHANIC ASSIGNMENT & REPAIRS
// ==========================================

app.get('/api/bookings', auth, asyncRoute(async (req, res) => {
  let conditions = 'TRUE';
  const params = [];
  if (req.user.role === 'customer') {
    conditions = 'b.customer_id=$1';
    params.push(req.user.id);
  } else if (req.user.role === 'provider') {
    conditions = 'b.provider_id=(SELECT id FROM providers WHERE user_id=$1)';
    params.push(req.user.id);
  } else if (req.user.role === 'mechanic') {
    conditions = '(b.mechanic_id=$1 OR (b.mechanic_id IS NULL AND b.status IN (\'Accepted\',\'In Progress\')))';
    params.push(req.user.id);
  } else if (req.user.role === 'cashier') {
    conditions = 'TRUE';
  }

  const { rows } = await pool.query(
    `SELECT b.*,v.make,v.model,v.year,v.plate_number,v.mileage,c.name AS service_name,s.price AS estimate,
      p.business_name,p.location,u.name AS customer_name,u.phone AS customer_phone,pu.phone AS provider_phone,
      mu.name AS mechanic_name,mu.phone AS mechanic_phone,
      pay.amount AS paid_amount,pay.method AS payment_method,pay.status AS payment_status,pay.reference AS payment_reference,
      rr.diagnosis AS repair_diagnosis,rr.work_performed AS repair_work_performed,rr.parts_used AS repair_parts_used,
      rr.labor_cost AS repair_labor_cost,rr.parts_cost AS repair_parts_cost,rr.completed_at AS repair_completed_at,
      COALESCE(rr.labor_cost+rr.parts_cost,s.price) AS reported_amount,
      inv.invoice_number, inv.receipt_number, inv.total_amount AS invoice_total, inv.payment_status AS invoice_payment_status,
      (r.id IS NOT NULL) AS reviewed
     FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id JOIN car_services s ON s.id=b.service_id
     JOIN service_categories c ON c.id=s.category_id JOIN providers p ON p.id=b.provider_id
     JOIN users u ON u.id=b.customer_id JOIN users pu ON pu.id=p.user_id
     LEFT JOIN users mu ON mu.id=b.mechanic_id
     LEFT JOIN payments pay ON pay.booking_id=b.id LEFT JOIN reviews r ON r.booking_id=b.id
     LEFT JOIN repair_records rr ON rr.booking_id=b.id
     LEFT JOIN invoices inv ON inv.booking_id=b.id
     WHERE ${conditions} ORDER BY b.created_at DESC`,
    params
  );
  res.json(rows);
}));

app.post('/api/bookings', auth, roles('customer'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    vehicleId: z.coerce.number().int().positive(),
    serviceId: z.coerce.number().int().positive(),
    problemDescription: z.string().trim().min(5).max(3000),
    scheduledAt: z.string().datetime(),
    callbackRequested: z.boolean().default(false),
    paymentPreference: z.enum(['Cash', 'Telebirr', 'CBE Bank Transfer', 'Bank transfer', 'Other']).default('Cash')
  }), req.body);
  const { rows: vehicle } = await pool.query('SELECT id FROM vehicles WHERE id=$1 AND customer_id=$2', [v.vehicleId, req.user.id]);
  if (!vehicle[0]) return res.status(404).json({ error: 'Select a vehicle belonging to your account.' });
  const { rows: service } = await pool.query(
    'SELECT s.id,s.provider_id,p.user_id AS provider_user_id,p.verified FROM car_services s JOIN providers p ON p.id=s.provider_id WHERE s.id=$1 AND s.active=TRUE', [v.serviceId]
  );
  if (!service[0]?.verified) return res.status(404).json({ error: 'This service is not available for booking.' });
  const { rows } = await pool.query(
    `INSERT INTO bookings (customer_id,vehicle_id,provider_id,service_id,problem_description,scheduled_at,callback_requested,payment_preference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.user.id, v.vehicleId, service[0].provider_id, v.serviceId, v.problemDescription, v.scheduledAt, v.callbackRequested, v.paymentPreference]
  );
  await notify(service[0].provider_user_id, 'New repair request', `A new booking request (#${rows[0].id}) needs your response. Preferred payment method: ${v.paymentPreference}.`);
  await notifyAdmins('New repair request', `Booking #${rows[0].id} is awaiting provider response. Preferred payment method: ${v.paymentPreference}.`);
  await audit(req.user.id, 'booking.created', 'booking', rows[0].id, { paymentPreference: v.paymentPreference });
  res.status(201).json(rows[0]);
}));

// Mechanic assignment to a booking
app.patch('/api/bookings/:id/assign-mechanic', auth, roles('provider', 'admin'), asyncRoute(async (req, res) => {
  const { mechanicId } = validate(z.object({ mechanicId: z.coerce.number().int().positive().nullable() }), req.body);
  const { rows: bookings } = await pool.query('SELECT b.*, v.make, v.model, v.plate_number FROM bookings b JOIN vehicles v ON v.id=b.vehicle_id WHERE b.id=$1', [req.params.id]);
  const booking = bookings[0];
  if (!booking) return res.status(404).json({ error: 'Booking not found.' });

  let mechanicUser = null;
  if (mechanicId) {
    const { rows: mRows } = await pool.query('SELECT id, name, phone FROM users WHERE id=$1 AND deleted_at IS NULL', [mechanicId]);
    if (!mRows[0]) return res.status(404).json({ error: 'Mechanic account not found.' });
    mechanicUser = mRows[0];
  }

  const { rows: updated } = await pool.query(
    'UPDATE bookings SET mechanic_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
    [mechanicId, req.params.id]
  );

  if (mechanicId && mechanicUser) {
    await notify(mechanicId, 'New Repair Assignment', `You were assigned to repair job #${booking.id} (${booking.make} ${booking.model} - ${booking.plate_number}).`);
    await notify(booking.customer_id, 'Mechanic Assigned', `Mechanic ${mechanicUser.name} has been assigned to your repair booking #${booking.id}.`);
  }
  await audit(req.user.id, 'booking.mechanic_assigned', 'booking', booking.id, { mechanicId });
  res.json({ ...updated[0], mechanic_name: mechanicUser?.name });
}));

app.patch('/api/bookings/:id/status', auth, roles('provider', 'mechanic', 'customer', 'admin'), asyncRoute(async (req, res) => {
  const status = validate(z.enum(['Accepted', 'Rejected', 'Scheduled', 'In Progress', 'Cancelled']), req.body.status);
  const { rows: found } = await pool.query(
    `SELECT b.*,p.user_id AS provider_user_id FROM bookings b JOIN providers p ON p.id=b.provider_id WHERE b.id=$1`, [req.params.id]
  );
  const b = found[0];
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (req.user.role === 'provider' && b.provider_user_id !== req.user.id) return res.status(403).json({ error: 'This booking belongs to another provider.' });
  if (req.user.role === 'mechanic' && b.mechanic_id && b.mechanic_id !== req.user.id) return res.status(403).json({ error: 'This booking is assigned to another mechanic.' });
  if (req.user.role === 'customer' && b.customer_id !== req.user.id) return res.status(403).json({ error: 'This booking belongs to another customer.' });

  const transitions = {
    Pending: ['provider', 'admin'].includes(req.user.role) ? ['Accepted', 'Rejected'] : req.user.role === 'customer' ? ['Cancelled'] : [],
    Accepted: ['provider', 'mechanic', 'admin'].includes(req.user.role) ? ['Scheduled', 'In Progress', 'Cancelled'] : [],
    Scheduled: ['provider', 'mechanic', 'admin'].includes(req.user.role) ? ['In Progress', 'Cancelled'] : [],
    'In Progress': []
  };
  if (!transitions[b.status]?.includes(status)) return res.status(400).json({ error: `Cannot change booking from ${b.status} to ${status}.` });

  const { rows } = await pool.query(
    'UPDATE bookings SET status=$1,updated_at=NOW() WHERE id=$2 AND status=$3 RETURNING *', [status, b.id, b.status]
  );
  if (!rows[0]) return res.status(409).json({ error: 'This booking changed while you were updating it. Refresh and try again.' });
  await notify(b.customer_id, 'Repair booking updated', `Your booking #${b.id} is now ${status}.`);
  if (status === 'Accepted' || status === 'Rejected') {
    await notifyAdmins('Repair request updated', `Booking #${b.id} was ${status.toLowerCase()} by the garage/mechanic.`);
  }
  await audit(req.user.id, 'booking.status_changed', 'booking', b.id, { status });
  res.json(rows[0]);
}));

// Submit repair report with spare parts inventory auto-decrement & invoice generation
app.put('/api/bookings/:id/repair', auth, roles('provider', 'mechanic', 'admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    diagnosis: z.string().trim().min(2).max(3000),
    workPerformed: z.string().trim().min(2).max(3000),
    partsUsed: z.array(z.object({
      partId: z.coerce.number().int().positive().optional(),
      name: z.string().min(1).max(120),
      quantity: z.coerce.number().positive(),
      unitPrice: z.coerce.number().min(0).optional()
    })).default([]),
    laborCost: z.coerce.number().min(0),
    partsCost: z.coerce.number().min(0)
  }), req.body);

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const { rows: bookings } = await client.query(
      `SELECT b.id, b.status, b.customer_id, b.provider_id, p.user_id AS provider_user_id
       FROM bookings b JOIN providers p ON p.id=b.provider_id
       WHERE b.id=$1 FOR UPDATE`, [req.params.id]
    );
    const booking = bookings[0];
    if (!booking) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (booking.status !== 'In Progress') {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({ error: 'A service report can only be submitted for a booking that is in progress.' });
    }

    // Save repair records
    const { rows: repairRows } = await client.query(
      `INSERT INTO repair_records (booking_id,diagnosis,work_performed,parts_used,labor_cost,parts_cost,completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (booking_id) DO UPDATE SET diagnosis=EXCLUDED.diagnosis,work_performed=EXCLUDED.work_performed,
         parts_used=EXCLUDED.parts_used,labor_cost=EXCLUDED.labor_cost,parts_cost=EXCLUDED.parts_cost,
         completed_at=NOW(),updated_at=NOW()
       RETURNING *`,
      [booking.id, v.diagnosis, v.workPerformed, JSON.stringify(v.partsUsed), v.laborCost, v.partsCost]
    );

    // Auto-decrement inventory for catalog parts and record used items
    const lowStockAlerts = [];
    for (const item of v.partsUsed) {
      if (item.partId) {
        const { rows: partRows } = await client.query('SELECT * FROM spare_parts WHERE id=$1 FOR UPDATE', [item.partId]);
        if (partRows[0]) {
          const part = partRows[0];
          const newQty = Math.max(0, part.quantity_in_stock - item.quantity);
          await client.query('UPDATE spare_parts SET quantity_in_stock=$1, updated_at=NOW() WHERE id=$2', [newQty, part.id]);
          await client.query(
            `INSERT INTO repair_parts_used_items (booking_id, part_id, quantity, unit_price, total_price)
             VALUES ($1,$2,$3,$4,$5)`,
            [booking.id, part.id, item.quantity, part.unit_price, Number(part.unit_price) * item.quantity]
          );
          if (newQty <= part.min_stock_level) {
            lowStockAlerts.push({ name: part.name, remaining: newQty });
          }
        }
      }
    }

    // Calculate Ethiopian Invoice: Subtotal + 15% VAT
    const subtotal = Number(v.laborCost) + Number(v.partsCost);
    const taxRate = 15.00; // 15% Ethiopian VAT
    const taxAmount = Math.round(subtotal * 0.15 * 100) / 100;
    const totalAmount = subtotal + taxAmount;
    const invoiceNumber = `INV-${String(booking.id).padStart(5, '0')}-${Date.now().toString().slice(-4)}`;

    await client.query(
      `INSERT INTO invoices (invoice_number, booking_id, customer_id, provider_id, labor_cost, parts_cost, subtotal, tax_rate, tax_amount, total_amount, payment_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Unpaid')
       ON CONFLICT (booking_id) DO UPDATE SET
         labor_cost=EXCLUDED.labor_cost, parts_cost=EXCLUDED.parts_cost, subtotal=EXCLUDED.subtotal,
         tax_rate=EXCLUDED.tax_rate, tax_amount=EXCLUDED.tax_amount, total_amount=EXCLUDED.total_amount,
         updated_at=NOW()`,
      [invoiceNumber, booking.id, booking.customer_id, booking.provider_id, v.laborCost, v.partsCost, subtotal, taxRate, taxAmount, totalAmount]
    );

    // Update booking status
    await client.query(`UPDATE bookings SET status='Awaiting Admin Approval',updated_at=NOW() WHERE id=$1`, [booking.id]);
    await client.query('COMMIT');
    transactionOpen = false;

    // Notifications
    await notify(booking.customer_id, 'Service report submitted', `The repair report for booking #${booking.id} was submitted with total ${totalAmount.toFixed(2)} ETB (incl. 15% VAT). Awaiting admin review.`);
    await notifyAdmins('Service report needs review', `Booking #${booking.id} is awaiting review. Total: ${totalAmount.toFixed(2)} ETB.`);

    for (const alert of lowStockAlerts) {
      await notifyAdmins('⚠️ Low Stock Alert', `Spare part "${alert.name}" is low in stock! Only ${alert.remaining} remaining in inventory.`);
      if (booking.provider_user_id) {
        await notify(booking.provider_user_id, '⚠️ Low Stock Alert', `Spare part "${alert.name}" is low in stock! Only ${alert.remaining} remaining.`);
      }
    }

    await audit(req.user.id, 'booking.report_submitted', 'booking', booking.id, { subtotal, totalAmount });
    res.json({ ...repairRows[0], booking_status: 'Awaiting Admin Approval', invoice_number: invoiceNumber, total_amount: totalAmount });
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.patch('/api/bookings/:id/admin-review', auth, roles('admin'), asyncRoute(async (req, res) => {
  const action = validate(z.enum(['approve-report', 'complete-service']), req.body.action);
  const client = await pool.connect();
  let booking;
  let nextStatus;
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const { rows } = await client.query(
      `SELECT b.id,b.status,b.customer_id,b.provider_id,p.user_id AS provider_user_id,pay.status AS payment_status
       FROM bookings b JOIN providers p ON p.id=b.provider_id
       LEFT JOIN payments pay ON pay.booking_id=b.id
       WHERE b.id=$1 FOR UPDATE`, [req.params.id]
    );
    booking = rows[0];
    if (!booking) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: 'Booking not found.' });
    }
    if (action === 'approve-report' && booking.status === 'Awaiting Admin Approval') {
      nextStatus = 'Approved for Payment';
    } else if (action === 'complete-service' && booking.status === 'Approved for Payment' && booking.payment_status === 'Recorded') {
      nextStatus = 'Completed';
    } else {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(409).json({
        error: action === 'approve-report'
          ? 'Only a service report awaiting review can be approved.'
          : 'A service can be finalized only after administrator report approval and provider payment confirmation.'
      });
    }
    const { rows: updated } = await client.query(
      'UPDATE bookings SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [nextStatus, booking.id]
    );
    await client.query('COMMIT');
    transactionOpen = false;
    await notify(booking.customer_id, 'Booking approval updated', `Your booking #${booking.id} is now ${nextStatus}.`);
    await notify(booking.provider_user_id, 'Booking approval updated', `Booking #${booking.id} is now ${nextStatus}.`);
    await audit(req.user.id, action === 'approve-report' ? 'booking.report_approved' : 'booking.admin_finalized', 'booking', booking.id);
    res.json(updated[0]);
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

// ==========================================
// SPARE PARTS INVENTORY
// ==========================================

app.get('/api/inventory', auth, asyncRoute(async (req, res) => {
  const conditions = [];
  const params = [];
  if (req.query.search) {
    params.push(`%${req.query.search}%`);
    conditions.push(`(name ILIKE $${params.length} OR part_number ILIKE $${params.length} OR category ILIKE $${params.length})`);
  }
  if (req.query.lowStock === 'true') {
    conditions.push('quantity_in_stock <= min_stock_level');
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT *, (quantity_in_stock <= min_stock_level) AS is_low_stock,
       ROUND(unit_price * quantity_in_stock, 2) AS total_inventory_value
     FROM spare_parts ${where}
     ORDER BY is_low_stock DESC, name ASC`,
    params
  );
  res.json(rows);
}));

app.post('/api/inventory', auth, roles('admin', 'provider', 'cashier'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    partNumber: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(160),
    category: z.string().trim().min(2).max(100),
    unitPrice: z.coerce.number().min(0),
    quantityInStock: z.coerce.number().int().min(0).default(0),
    minStockLevel: z.coerce.number().int().min(0).default(5),
    supplier: z.string().trim().max(160).optional(),
    description: z.string().trim().max(1000).optional()
  }), req.body);

  const { rows } = await pool.query(
    `INSERT INTO spare_parts (part_number, name, category, unit_price, quantity_in_stock, min_stock_level, supplier, description)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [v.partNumber, v.name, v.category, v.unitPrice, v.quantityInStock, v.minStockLevel, v.supplier || null, v.description || null]
  );
  await audit(req.user.id, 'inventory.part_created', 'spare_part', rows[0].id, { name: v.name });
  res.status(201).json(rows[0]);
}));

app.put('/api/inventory/:id', auth, roles('admin', 'provider', 'cashier'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    partNumber: z.string().trim().min(2).max(80),
    name: z.string().trim().min(2).max(160),
    category: z.string().trim().min(2).max(100),
    unitPrice: z.coerce.number().min(0),
    quantityInStock: z.coerce.number().int().min(0),
    minStockLevel: z.coerce.number().int().min(0),
    supplier: z.string().trim().max(160).optional(),
    description: z.string().trim().max(1000).optional()
  }), req.body);

  const { rows } = await pool.query(
    `UPDATE spare_parts
     SET part_number=$1, name=$2, category=$3, unit_price=$4, quantity_in_stock=$5,
         min_stock_level=$6, supplier=$7, description=$8, updated_at=NOW()
     WHERE id=$9 RETURNING *`,
    [v.partNumber, v.name, v.category, v.unitPrice, v.quantityInStock, v.minStockLevel, v.supplier || null, v.description || null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Spare part not found.' });
  await audit(req.user.id, 'inventory.part_updated', 'spare_part', rows[0].id);
  res.json(rows[0]);
}));

app.delete('/api/inventory/:id', auth, roles('admin', 'provider'), asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM spare_parts WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Spare part not found.' });
  await audit(req.user.id, 'inventory.part_deleted', 'spare_part', Number(req.params.id));
  res.status(204).end();
}));

// ==========================================
// INVOICES, RECEIPTS & PAYMENTS
// ==========================================

app.get('/api/invoices', auth, asyncRoute(async (req, res) => {
  const conditions = req.user.role === 'customer'
    ? 'inv.customer_id=$1'
    : req.user.role === 'provider'
      ? 'inv.provider_id=(SELECT id FROM providers WHERE user_id=$1)'
      : 'TRUE';
  const params = ['admin', 'cashier'].includes(req.user.role) ? [] : [req.user.id];

  const { rows } = await pool.query(
    `SELECT inv.*,
       b.problem_description, b.scheduled_at, b.status AS booking_status,
       u.name AS customer_name, u.phone AS customer_phone,
       p.business_name, p.location AS provider_location,
       v.make, v.model, v.year, v.plate_number,
       pay.method AS payment_method, pay.reference AS payment_reference, pay.paid_at
     FROM invoices inv
     JOIN bookings b ON b.id = inv.booking_id
     JOIN users u ON u.id = inv.customer_id
     JOIN providers p ON p.id = inv.provider_id
     JOIN vehicles v ON v.id = b.vehicle_id
     LEFT JOIN payments pay ON pay.booking_id = b.id
     WHERE ${conditions}
     ORDER BY inv.created_at DESC`,
    params
  );
  res.json(rows);
}));

app.get('/api/invoices/:bookingId', auth, asyncRoute(async (req, res) => {
  const { rows: invRows } = await pool.query(
    `SELECT inv.*,
       b.problem_description, b.scheduled_at, b.status AS booking_status,
       u.name AS customer_name, u.phone AS customer_phone, u.email AS customer_email,
       p.business_name, p.location AS provider_location, pu.phone AS provider_phone,
       v.make, v.model, v.year, v.plate_number, v.vin, v.mileage,
       rr.diagnosis, rr.work_performed, rr.parts_used,
       pay.method AS payment_method, pay.reference AS payment_reference, pay.paid_at, pay.status AS payment_record_status
     FROM invoices inv
     JOIN bookings b ON b.id = inv.booking_id
     JOIN users u ON u.id = inv.customer_id
     JOIN providers p ON p.id = inv.provider_id
     JOIN users pu ON pu.id = p.user_id
     JOIN vehicles v ON v.id = b.vehicle_id
     LEFT JOIN repair_records rr ON rr.booking_id = b.id
     LEFT JOIN payments pay ON pay.booking_id = b.id
     WHERE inv.booking_id = $1`,
    [req.params.bookingId]
  );
  const invoice = invRows[0];
  if (!invoice) return res.status(404).json({ error: 'Invoice not found.' });

  if (req.user.role === 'customer' && invoice.customer_id !== req.user.id) {
    return res.status(403).json({ error: 'You do not have permission to view this invoice.' });
  }

  // Get itemized parts used if any
  const { rows: partItems } = await pool.query(
    `SELECT rpi.*, sp.name AS part_name, sp.part_number
     FROM repair_parts_used_items rpi
     JOIN spare_parts sp ON sp.id = rpi.part_id
     WHERE rpi.booking_id = $1`,
    [req.params.bookingId]
  );

  res.json({ invoice, parts: partItems });
}));

// Cashier / Provider record payment & generate official receipt
app.post('/api/invoices/record-payment', auth, roles('cashier', 'provider', 'admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    bookingId: z.coerce.number().int().positive(),
    method: z.enum(['Cash', 'Telebirr', 'CBE Bank Transfer', 'Bank transfer', 'Other']),
    reference: z.string().trim().max(120).optional(),
    amount: z.coerce.number().min(0)
  }), req.body);

  const client = await pool.connect();
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;

    const { rows: invRows } = await client.query('SELECT * FROM invoices WHERE booking_id=$1 FOR UPDATE', [v.bookingId]);
    const invoice = invRows[0];
    if (!invoice) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: 'Invoice not found for this booking.' });
    }

    const receiptNumber = `REC-${String(v.bookingId).padStart(5, '0')}-${Date.now().toString().slice(-4)}`;

    // Update invoice status
    const { rows: updatedInv } = await client.query(
      `UPDATE invoices
       SET payment_status='Paid', receipt_number=$1, updated_at=NOW()
       WHERE id=$2 RETURNING *`,
      [receiptNumber, invoice.id]
    );

    // Insert or update payment record
    await client.query(
      `INSERT INTO payments (booking_id, customer_id, provider_id, amount, method, reference, status, paid_at)
       VALUES ($1,$2,$3,$4,$5,$6,'Recorded',NOW())
       ON CONFLICT (booking_id) DO UPDATE SET
         amount=EXCLUDED.amount, method=EXCLUDED.method, reference=EXCLUDED.reference,
         status='Recorded', paid_at=NOW(), updated_at=NOW()`,
      [v.bookingId, invoice.customer_id, invoice.provider_id, v.amount, v.method, v.reference || null]
    );

    // Update booking to Completed
    await client.query('UPDATE bookings SET status=\'Completed\', updated_at=NOW() WHERE id=$1', [v.bookingId]);

    await client.query('COMMIT');
    transactionOpen = false;

    await notify(invoice.customer_id, 'Payment Received & Receipt Issued', `Payment of ${v.amount} ETB confirmed for booking #${v.bookingId}. Official Receipt: ${receiptNumber}. Thank you!`);
    await audit(req.user.id, 'invoice.payment_recorded', 'invoice', invoice.id, { receiptNumber, amount: v.amount, method: v.method });

    res.json({ success: true, invoice: updatedInv[0], receiptNumber });
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.post('/api/payments/request', auth, roles('customer'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    bookingId: z.coerce.number().int().positive(),
    method: z.enum(['Cash', 'Telebirr', 'CBE Bank Transfer', 'Bank transfer', 'Other']),
    reference: z.string().trim().max(120).optional()
  }), req.body);
  const { rows } = await pool.query(
    `INSERT INTO payments (booking_id,customer_id,provider_id,amount,method,reference,status)
     SELECT b.id,b.customer_id,b.provider_id,COALESCE(inv.total_amount, rr.labor_cost+rr.parts_cost, s.price),$1,$2,'Pending'
     FROM bookings b
     JOIN car_services s ON s.id=b.service_id
     LEFT JOIN repair_records rr ON rr.booking_id=b.id
     LEFT JOIN invoices inv ON inv.booking_id=b.id
     WHERE b.id=$3 AND b.customer_id=$4 AND b.status='Approved for Payment'
       AND NOT EXISTS (SELECT 1 FROM payments existing WHERE existing.booking_id=b.id)
     RETURNING *`, [v.method, v.reference || null, v.bookingId, req.user.id]
  );
  if (!rows[0]) {
    const { rows: bookings } = await pool.query(
      `SELECT b.status,pay.status AS payment_status FROM bookings b
       LEFT JOIN payments pay ON pay.booking_id=b.id WHERE b.id=$1 AND b.customer_id=$2`,
      [v.bookingId, req.user.id]
    );
    if (!bookings[0]) return res.status(404).json({ error: 'Booking not found for your customer account.' });
    if (bookings[0].status !== 'Approved for Payment') return res.status(400).json({ error: 'A payment method can be submitted only after the administrator approves the service report.' });
    return res.status(409).json({
      error: bookings[0].payment_status === 'Pending'
        ? 'A payment method has already been submitted for this booking.'
        : 'This booking already has a recorded payment.'
    });
  }
  const { rows: providers } = await pool.query('SELECT user_id FROM providers WHERE id=$1', [rows[0].provider_id]);
  if (providers[0]) await notify(providers[0].user_id, 'Payment method submitted', `The customer submitted ${v.method} for booking #${v.bookingId}. Please confirm the payment.`);
  await notifyAdmins('Customer payment submitted', `Payment for booking #${v.bookingId} is awaiting confirmation.`);
  res.status(201).json(rows[0]);
}));

app.post('/api/payments', auth, roles('provider', 'cashier', 'admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({ bookingId: z.coerce.number().int().positive() }), req.body);
  const client = await pool.connect();
  let payment;
  let transactionOpen = false;
  try {
    await client.query('BEGIN');
    transactionOpen = true;
    const { rows } = await client.query(
      `SELECT pay.id,pay.customer_id,pay.provider_id,pay.amount,pay.status,b.status AS booking_status
       FROM payments pay JOIN bookings b ON b.id=pay.booking_id
       WHERE pay.booking_id=$1 FOR UPDATE`, [v.bookingId]
    );
    payment = rows[0];
    if (!payment) {
      await client.query('ROLLBACK');
      transactionOpen = false;
      return res.status(404).json({ error: 'Payment request not found.' });
    }

    const { rows: updated } = await client.query(
      `UPDATE payments SET status='Recorded',paid_at=NOW(),updated_at=NOW() WHERE id=$1 RETURNING *`,
      [payment.id]
    );

    const receiptNumber = `REC-${String(v.bookingId).padStart(5, '0')}-${Date.now().toString().slice(-4)}`;
    await client.query(
      `UPDATE invoices SET payment_status='Paid', receipt_number=$1, updated_at=NOW() WHERE booking_id=$2`,
      [receiptNumber, v.bookingId]
    );

    // Auto-complete booking
    await client.query('UPDATE bookings SET status=\'Completed\', updated_at=NOW() WHERE id=$1', [v.bookingId]);

    await client.query('COMMIT');
    transactionOpen = false;
    await notify(payment.customer_id, 'Payment confirmed', `Your payment for repair #${v.bookingId} was verified. Receipt #${receiptNumber} generated.`);
    await notifyAdmins('Payment recorded', `Payment of ${payment.amount} ETB for booking #${v.bookingId} was confirmed.`);
    await audit(req.user.id, 'payment.recorded', 'payment', payment.id);
    res.json(updated[0]);
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

app.get('/api/payments', auth, asyncRoute(async (req, res) => {
  const conditions = req.user.role === 'customer'
    ? 'p.customer_id=$1'
    : req.user.role === 'provider'
      ? 'p.provider_id=(SELECT id FROM providers WHERE user_id=$1)'
      : 'TRUE';
  const { rows } = await pool.query(
    `SELECT p.*,b.scheduled_at,u.name AS customer_name,prov.business_name,v.make,v.model,v.plate_number
     FROM payments p JOIN bookings b ON b.id=p.booking_id
     JOIN users u ON u.id=p.customer_id
     JOIN providers prov ON prov.id=p.provider_id
     JOIN vehicles v ON v.id=b.vehicle_id
     WHERE ${conditions} ORDER BY p.created_at DESC`,
    ['admin', 'cashier'].includes(req.user.role) ? [] : [req.user.id]
  );
  res.json(rows);
}));

// ==========================================
// GARAGE EQUIPMENT & DIAGNOSTIC DEVICES
// ==========================================

app.get('/api/equipment', auth, asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, u.name AS assigned_mechanic_name,
       DATEDIFF(e.next_service_due, CURDATE()) AS days_until_maintenance
     FROM equipment e
     LEFT JOIN users u ON u.id = e.assigned_to
     ORDER BY (e.status = 'Maintenance Required') DESC, e.name ASC`
  );
  res.json(rows);
}));

app.post('/api/equipment', auth, roles('admin', 'provider'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    name: z.string().trim().min(2).max(160),
    modelNumber: z.string().trim().max(100).optional(),
    serialNumber: z.string().trim().max(100).optional(),
    deviceType: z.enum([
      'Diagnostic Scanner', 'Hydraulic Lift', 'Wheel Balancer', 'AC Recovery',
      'Battery Tester', 'Welding & Cutting', 'Engine Crane', 'Hand & Power Tools', 'Other'
    ]),
    status: z.enum(['Operational', 'Maintenance Required', 'Under Repair', 'Calibrated', 'Decommissioned']).default('Operational'),
    lastServiceDate: z.string().optional(),
    nextServiceDue: z.string().optional(),
    assignedTo: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().trim().max(2000).optional()
  }), req.body);

  const { rows } = await pool.query(
    `INSERT INTO equipment (name, model_number, serial_number, device_type, status, last_service_date, next_service_due, assigned_to, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      v.name, v.modelNumber || null, v.serialNumber || null, v.deviceType, v.status,
      v.lastServiceDate || null, v.nextServiceDue || null, v.assignedTo || null, v.notes || null
    ]
  );
  await audit(req.user.id, 'equipment.created', 'equipment', rows[0].id, { name: v.name });
  res.status(201).json(rows[0]);
}));

app.put('/api/equipment/:id', auth, roles('admin', 'provider', 'mechanic'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    name: z.string().trim().min(2).max(160),
    modelNumber: z.string().trim().max(100).optional(),
    serialNumber: z.string().trim().max(100).optional(),
    deviceType: z.enum([
      'Diagnostic Scanner', 'Hydraulic Lift', 'Wheel Balancer', 'AC Recovery',
      'Battery Tester', 'Welding & Cutting', 'Engine Crane', 'Hand & Power Tools', 'Other'
    ]),
    status: z.enum(['Operational', 'Maintenance Required', 'Under Repair', 'Calibrated', 'Decommissioned']),
    lastServiceDate: z.string().optional(),
    nextServiceDue: z.string().optional(),
    assignedTo: z.coerce.number().int().positive().optional().nullable(),
    notes: z.string().trim().max(2000).optional()
  }), req.body);

  const { rows } = await pool.query(
    `UPDATE equipment
     SET name=$1, model_number=$2, serial_number=$3, device_type=$4, status=$5,
         last_service_date=$6, next_service_due=$7, assigned_to=$8, notes=$9, updated_at=NOW()
     WHERE id=$10 RETURNING *`,
    [
      v.name, v.modelNumber || null, v.serialNumber || null, v.deviceType, v.status,
      v.lastServiceDate || null, v.nextServiceDue || null, v.assignedTo || null, v.notes || null,
      req.params.id
    ]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Equipment not found.' });
  await audit(req.user.id, 'equipment.updated', 'equipment', rows[0].id);
  res.json(rows[0]);
}));

app.delete('/api/equipment/:id', auth, roles('admin', 'provider'), asyncRoute(async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM equipment WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Equipment not found.' });
  await audit(req.user.id, 'equipment.deleted', 'equipment', Number(req.params.id));
  res.status(204).end();
}));

// ==========================================
// REVIEWS & COMPLAINTS
// ==========================================

app.post('/api/reviews', auth, roles('customer'), asyncRoute(async (req, res) => {
  const v = validate(z.object({ bookingId: z.coerce.number().int().positive(), rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body);
  const { rows: booking } = await pool.query('SELECT provider_id FROM bookings WHERE id=$1 AND customer_id=$2 AND status=\'Completed\'', [v.bookingId, req.user.id]);
  if (!booking[0]) return res.status(400).json({ error: 'Only completed bookings can be reviewed.' });
  const { rows } = await pool.query(
    'INSERT INTO reviews (booking_id,customer_id,provider_id,rating,comment) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [v.bookingId, req.user.id, booking[0].provider_id, v.rating, v.comment || null]
  );
  res.status(201).json(rows[0]);
}));

app.get('/api/reviews', auth, asyncRoute(async (req, res) => {
  const condition = req.user.role === 'provider' ? 'r.provider_id=(SELECT id FROM providers WHERE user_id=$1)' : 'r.customer_id=$1';
  const { rows } = await pool.query(
    `SELECT r.*,u.name AS customer_name,p.business_name FROM reviews r
     JOIN users u ON u.id=r.customer_id JOIN providers p ON p.id=r.provider_id
     WHERE ${condition} ORDER BY r.created_at DESC`, [req.user.id]
  );
  res.json(rows);
}));

app.post('/api/complaints', auth, roles('customer'), asyncRoute(async (req, res) => {
  const v = validate(z.object({ subject: z.string().trim().min(3).max(160), description: z.string().trim().min(10).max(3000), bookingId: z.coerce.number().int().positive().optional() }), req.body);
  if (v.bookingId) {
    const { rows: bookings } = await pool.query(
      'SELECT id FROM bookings WHERE id=$1 AND customer_id=$2',
      [v.bookingId, req.user.id]
    );
    if (!bookings[0]) return res.status(404).json({ error: 'Booking not found.' });
  }
  const { rows } = await pool.query(
    'INSERT INTO complaints (customer_id,booking_id,subject,description) VALUES ($1,$2,$3,$4) RETURNING *',
    [req.user.id, v.bookingId || null, v.subject, v.description]
  );
  res.status(201).json(rows[0]);
}));

// ==========================================
// ROADSIDE ASSISTANCE
// ==========================================

app.get('/api/roadside', auth, asyncRoute(async (req, res) => {
  const clause = req.user.role === 'admin' ? 'TRUE' : req.user.role === 'provider'
    ? '(rr.provider_id=(SELECT id FROM providers WHERE user_id=$1) OR rr.provider_id IS NULL)' : 'rr.customer_id=$1';
  const { rows } = await pool.query(
    `SELECT rr.*,v.make,v.model,v.plate_number,u.name AS customer_name,u.phone AS customer_phone,
      p.business_name,pu.phone AS provider_phone
     FROM roadside_requests rr JOIN vehicles v ON v.id=rr.vehicle_id JOIN users u ON u.id=rr.customer_id
     LEFT JOIN providers p ON p.id=rr.provider_id LEFT JOIN users pu ON pu.id=p.user_id
     WHERE ${clause} ORDER BY rr.created_at DESC`, [req.user.id]
  );
  res.json(rows);
}));

app.post('/api/roadside', auth, roles('customer'), asyncRoute(async (req, res) => {
  const v = validate(z.object({
    vehicleId: z.coerce.number().int().positive(),
    location: z.string().trim().min(3).max(300),
    landmark: z.string().trim().max(255).optional(),
    phone: z.string().trim().min(7).max(30),
    problemType: z.enum(['Vehicle breakdown', 'Flat tire', 'Dead battery', 'Engine problem', 'Accident assistance', 'Fuel problem', 'Towing']),
    description: z.string().trim().min(5).max(2000),
    providerId: z.coerce.number().int().positive().optional(),
    paymentPreference: z.enum(['Cash', 'Telebirr', 'CBE Bank Transfer', 'Bank transfer', 'Other']).default('Cash')
  }), req.body);
  const { rows: vehicle } = await pool.query('SELECT id FROM vehicles WHERE id=$1 AND customer_id=$2', [v.vehicleId, req.user.id]);
  if (!vehicle[0]) return res.status(404).json({ error: 'Select a vehicle belonging to your account.' });
  if (v.providerId) {
    const { rows: provider } = await pool.query('SELECT id FROM providers WHERE id=$1 AND verified=TRUE', [v.providerId]);
    if (!provider[0]) return res.status(400).json({ error: 'Selected provider is not available.' });
  }
  const { rows } = await pool.query(
    `INSERT INTO roadside_requests (customer_id,vehicle_id,provider_id,location,landmark,phone,problem_type,description,payment_preference)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.user.id, v.vehicleId, v.providerId || null, v.location, v.landmark || null, v.phone, v.problemType, v.description, v.paymentPreference]
  );
  if (v.providerId) {
    const { rows: provider } = await pool.query('SELECT user_id FROM providers WHERE id=$1 AND verified=TRUE', [v.providerId]);
    await notify(provider[0].user_id, 'Roadside assistance request', `A roadside request (#${rows[0].id}) needs your response. Preferred payment method: ${v.paymentPreference}.`);
  }
  await notifyAdmins('New roadside assistance request', `Roadside request #${rows[0].id} is awaiting provider response. Location: ${v.location}${v.landmark ? ` (Landmark: ${v.landmark})` : ''}.`);
  await audit(req.user.id, 'roadside.created', 'roadside_request', rows[0].id, { paymentPreference: v.paymentPreference });
  res.status(201).json(rows[0]);
}));

app.patch('/api/roadside/:id/status', auth, roles('provider', 'customer', 'admin'), asyncRoute(async (req, res) => {
  const status = validate(z.enum(['Accepted', 'Rejected', 'In Progress', 'Completed', 'Cancelled']), req.body.status);
  const { rows: requests } = await pool.query(
    `SELECT rr.*,p.user_id AS provider_user_id FROM roadside_requests rr LEFT JOIN providers p ON p.id=rr.provider_id WHERE rr.id=$1`,
    [req.params.id]
  );
  const request = requests[0];
  if (!request) return res.status(404).json({ error: 'Roadside request not found.' });
  if (req.user.role === 'customer' && request.customer_id !== req.user.id) return res.status(403).json({ error: 'This request belongs to another customer.' });
  if (req.user.role === 'provider' && request.provider_user_id && request.provider_user_id !== req.user.id) return res.status(403).json({ error: 'This request is assigned to another provider.' });
  if (req.user.role === 'provider' && !request.provider_id && status !== 'Accepted') return res.status(400).json({ error: 'Accept an unassigned request before updating it.' });
  if (req.user.role === 'provider' && !request.provider_id && status === 'Accepted') {
    const { rows: provider } = await pool.query('SELECT id FROM providers WHERE user_id=$1 AND verified=TRUE', [req.user.id]);
    if (!provider[0]) return res.status(403).json({ error: 'Provider verification is required to accept roadside requests.' });
    request.provider_id = provider[0].id;
  }
  const allowed = { Pending: ['Accepted', 'Rejected', 'Cancelled'], Accepted: ['In Progress', 'Cancelled'], 'In Progress': ['Completed'] };
  if (!allowed[request.status]?.includes(status)) return res.status(400).json({ error: `Cannot change request from ${request.status} to ${status}.` });
  const { rows } = await pool.query('UPDATE roadside_requests SET provider_id=$1,status=$2,updated_at=NOW() WHERE id=$3 RETURNING *',
    [request.provider_id, status, request.id]);
  await notify(request.customer_id, 'Roadside assistance updated', `Your roadside request #${request.id} is now ${status}.`);
  res.json(rows[0]);
}));

// ==========================================
// NOTIFICATIONS
// ==========================================

app.get('/api/notifications', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.id]);
  res.json(rows);
}));

app.patch('/api/notifications/:id/read', auth, asyncRoute(async (req, res) => {
  const { rows } = await pool.query('UPDATE notifications SET read_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2 RETURNING *', [req.params.id, req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Notification not found.' });
  res.json(rows[0]);
}));

// ==========================================
// ADMIN DASHBOARD, USERS & FINANCIAL REPORTS
// ==========================================

app.get('/api/admin/dashboard', auth, roles('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role='customer' AND deleted_at IS NULL)::int AS customers,
      (SELECT COUNT(*) FROM vehicles)::int AS vehicles,
      (SELECT COUNT(*) FROM users WHERE role='mechanic' AND deleted_at IS NULL)::int AS mechanics,
      (SELECT COUNT(*) FROM users WHERE role='cashier' AND deleted_at IS NULL)::int AS cashiers,
      (SELECT COUNT(*) FROM providers p JOIN users u ON u.id=p.user_id WHERE p.provider_type='workshop' AND u.deleted_at IS NULL)::int AS workshops,
      (SELECT COUNT(*) FROM car_services WHERE active=TRUE)::int AS services,
      (SELECT COUNT(*) FROM bookings)::int AS bookings,
      (SELECT COUNT(*) FROM bookings WHERE status IN ('Pending','Accepted','Scheduled','In Progress','Awaiting Admin Approval','Approved for Payment'))::int AS pending_repairs,
      (SELECT COUNT(*) FROM bookings WHERE status='Awaiting Admin Approval')::int AS awaiting_admin_review,
      (SELECT COUNT(*) FROM bookings WHERE status='Completed')::int AS completed_repairs,
      (SELECT COUNT(*) FROM roadside_requests)::int AS roadside_requests,
      (SELECT COUNT(*) FROM payments)::int AS payment_records,
      (SELECT COUNT(*) FROM spare_parts)::int AS spare_parts_count,
      (SELECT COUNT(*) FROM spare_parts WHERE quantity_in_stock <= min_stock_level)::int AS low_stock_count,
      (SELECT COUNT(*) FROM equipment)::int AS equipment_count,
      (SELECT COUNT(*) FROM equipment WHERE status='Maintenance Required')::int AS equipment_maintenance_due
  `);
  res.json(rows[0]);
}));

app.get('/api/admin/users', auth, roles('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query('SELECT id,name,email,phone,role,created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC');
  res.json(rows);
}));

app.put('/api/admin/users/:id', auth, roles('admin'), asyncRoute(async (req, res) => {
  const id = validate(z.coerce.number().int().positive(), req.params.id);
  const input = validate(z.object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(7).max(30),
    role: z.enum(['customer', 'provider', 'mechanic', 'cashier', 'admin']).optional()
  }), req.body);

  const roleUpdate = input.role ? ', role=$4' : '';
  const params = [input.name, input.email.toLowerCase(), input.phone];
  if (input.role) params.push(input.role);
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE users SET name=$1, email=$2, phone=$3 ${roleUpdate}, updated_at=NOW() WHERE id=$${params.length} RETURNING id,name,email,phone,role,created_at`,
    params
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  res.json(rows[0]);
}));

app.delete('/api/admin/users/:id', auth, roles('admin'), asyncRoute(async (req, res) => {
  const id = validate(z.coerce.number().int().positive(), req.params.id);
  if (String(req.user.id) === String(id)) return res.status(400).json({ error: 'You cannot delete your own admin account.' });
  const { rows } = await pool.query('SELECT role FROM users WHERE id=$1', [id]);
  if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
  if (rows[0].role === 'admin') return res.status(403).json({ error: 'Admin accounts cannot be deleted.' });

  await pool.query('UPDATE users SET deleted_at=NOW(), updated_at=NOW() WHERE id=$1', [id]);
  await audit(req.user.id, 'user.soft_deleted', 'user', id);
  res.status(204).end();
}));

app.get('/api/admin/providers', auth, roles('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT p.*,u.name,u.email,u.phone FROM providers p JOIN users u ON u.id=p.user_id WHERE u.deleted_at IS NULL ORDER BY p.created_at DESC`
  );
  res.json(rows);
}));

app.patch('/api/admin/providers/:id/verify', auth, roles('admin'), asyncRoute(async (req, res) => {
  const verified = validate(z.boolean(), req.body.verified);
  const { rows } = await pool.query(
    'UPDATE providers SET verified=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [verified, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Provider not found.' });
  await notify(rows[0].user_id, verified ? 'Account Verified!' : 'Verification Suspended',
    verified ? 'Your provider account has been verified. You can now publish repair services.' : 'Your provider verification has been suspended.');
  res.json(rows[0]);
}));

app.get('/api/admin/complaints', auth, roles('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT c.*,u.name AS customer_name FROM complaints c JOIN users u ON u.id=c.customer_id ORDER BY c.created_at DESC`
  );
  res.json(rows);
}));

app.post('/api/admin/categories', auth, roles('admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).default('') }), req.body);
  const { rows } = await pool.query('INSERT INTO service_categories (name,description) VALUES ($1,$2) RETURNING *', [v.name, v.description]);
  await audit(req.user.id, 'service_category.created', 'service_category', rows[0].id);
  res.status(201).json(rows[0]);
}));

app.patch('/api/admin/categories/:id', auth, roles('admin'), asyncRoute(async (req, res) => {
  const v = validate(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000) }), req.body);
  const { rows } = await pool.query('UPDATE service_categories SET name=$1,description=$2,updated_at=NOW() WHERE id=$3 RETURNING *', [v.name, v.description, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Service category not found.' });
  await audit(req.user.id, 'service_category.updated', 'service_category', rows[0].id);
  res.json(rows[0]);
}));

app.delete('/api/admin/categories/:id', auth, roles('admin'), asyncRoute(async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM service_categories WHERE id=$1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Service category not found.' });
    await audit(req.user.id, 'service_category.deleted', 'service_category', Number(req.params.id));
    res.status(204).end();
  } catch (error) {
    if (error.code === '23503') return res.status(409).json({ error: 'Category is used by repair services and cannot be deleted.' });
    throw error;
  }
}));

app.get('/api/admin/services', auth, roles('admin'), asyncRoute(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT s.*,c.name AS category,p.business_name,p.verified,u.name AS provider_name
     FROM car_services s JOIN service_categories c ON c.id=s.category_id
     JOIN providers p ON p.id=s.provider_id JOIN users u ON u.id=p.user_id ORDER BY s.created_at DESC`
  );
  res.json(rows);
}));

app.patch('/api/admin/services/:id', auth, roles('admin'), asyncRoute(async (req, res) => {
  const active = validate(z.boolean(), req.body.active);
  const { rows } = await pool.query('UPDATE car_services SET active=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [active, req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Repair service not found.' });
  await audit(req.user.id, 'car_service.status_updated', 'car_service', rows[0].id, { active });
  res.json(rows[0]);
}));

app.get('/api/admin/reports', auth, roles('admin'), asyncRoute(async (_req, res) => {
  const [bookingRows, paymentRows, paymentByMethod, roadsideRows, inventoryStats] = await Promise.all([
    pool.query(`SELECT status,COUNT(*)::int AS count FROM bookings GROUP BY status ORDER BY status`),
    pool.query(`SELECT COALESCE(SUM(amount),0)::numeric(12,2) AS revenue,COUNT(*)::int AS count FROM payments WHERE status='Recorded'`),
    pool.query(`SELECT method, COALESCE(SUM(amount),0)::numeric(12,2) AS total_amount, COUNT(*)::int AS count FROM payments WHERE status='Recorded' GROUP BY method ORDER BY total_amount DESC`),
    pool.query(`SELECT status,COUNT(*)::int AS count FROM roadside_requests GROUP BY status ORDER BY status`),
    pool.query(`SELECT COUNT(*)::int AS total_parts, COALESCE(SUM(unit_price * quantity_in_stock),0)::numeric(12,2) AS total_value, SUM(CASE WHEN quantity_in_stock <= min_stock_level THEN 1 ELSE 0 END)::int AS low_stock FROM spare_parts`)
  ]);
  res.json({
    bookings: bookingRows.rows,
    payments: paymentRows.rows[0],
    paymentsByMethod: paymentByMethod.rows,
    roadside: roadsideRows.rows,
    inventory: inventoryStats.rows[0]
  });
}));

app.use((req, res) => res.status(404).json({ error: `Route ${req.method} ${req.path} was not found.` }));
app.use((error, _req, res, _next) => {
  if (error instanceof z.ZodError) {
    const msg = error.issues.map(i => `${i.path.join('.') || 'Field'}: ${i.message}`).join(', ');
    return res.status(400).json({ error: msg || 'Please check the submitted information.', details: error.issues });
  }
  if (error.code === '23505') return res.status(409).json({ error: 'A record with that unique value already exists.' });
  if (error.code === '23503') return res.status(400).json({ error: 'The selected related record does not exist.' });
  console.error(error);
  res.status(500).json({ error: 'An unexpected server error occurred.' });
});

await initializeDatabase();
app.listen(port, () => console.log(`DERASHE GERAJI API listening on port ${port}`));
