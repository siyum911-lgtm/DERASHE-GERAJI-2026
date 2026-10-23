import mysql from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(currentDir, '../.env') });
dotenv.config();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL must be set in .env.');

const database = new URL(databaseUrl);
if (!['mysql:', 'mariadb:'].includes(database.protocol)) {
  throw new Error('DATABASE_URL must use the mysql:// or mariadb:// scheme.');
}

// Temporary pool (no DB) to ensure DB exists
const initPool = mysql.createPool({
  host: database.hostname,
  port: Number(database.port || 3306),
  user: decodeURIComponent(database.username),
  password: decodeURIComponent(database.password),
  waitForConnections: true,
  connectionLimit: 2,
  timezone: 'Z'
});

(async () => {
  try {
    await initPool.query(`CREATE DATABASE IF NOT EXISTS \`${decodeURIComponent(database.pathname.slice(1))}\``);
    console.log('✅ Database ensured/created');
  } catch (e) {
    console.error('❌ Failed to ensure database:', e);
    process.exit(1);
  } finally {
    await initPool.end();
  }
})();

const connectionPool = mysql.createPool({
  host: database.hostname,
  port: Number(database.port || 3306),
  user: decodeURIComponent(database.username),
  password: decodeURIComponent(database.password),
  database: decodeURIComponent(database.pathname.slice(1)),
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z'
});

function prepareQuery(sql, values = []) {
  let query = sql.trim();
  const returning = query.match(/\s+RETURNING\s+(.+)$/i)?.[1];
  if (returning) query = query.replace(/\s+RETURNING\s+.+$/i, '');

  query = query
    .replace(/::(?:text|bigint|int)\b/gi, '')
    .replace(/COALESCE\(AVG\(r\.rating\),0\)::numeric\(2,1\)/gi, 'ROUND(COALESCE(AVG(r.rating),0),1)')
    .replace(/::numeric\(\d+,\d+\)/gi, '')
    .replace(/\bILIKE\b/gi, 'LIKE')
    .replace(/EXTRACT\(DOW FROM NOW\(\)\)/gi, '(DAYOFWEEK(NOW()) - 1)')
    .replace(/ON CONFLICT\s*\([^)]*\)\s*DO UPDATE SET/gi, 'ON DUPLICATE KEY UPDATE')
    .replace(/EXCLUDED\.([a-z_]+)/gi, 'VALUES($1)');

  const parameters = [];
  query = query.replace(/\$(\d+)/g, (_placeholder, index) => {
    const valueIndex = Number(index) - 1;
    if (valueIndex < 0 || valueIndex >= values.length) {
      throw new Error(`SQL placeholder $${index} has no matching value.`);
    }
    parameters.push(values[valueIndex]);
    return '?';
  });

  return { query, parameters, returning };
}

function normalizeRows(rows) {
  return rows.map((row) => {
    if (typeof row.specialties === 'string') {
      const specialties = JSON.parse(row.specialties);
      if (!Array.isArray(specialties)) {
        throw new Error('Stored provider specialties must be a JSON array.');
      }
      row.specialties = specialties;
    }
    return row;
  });
}

async function runQuery(connection, sql, values = []) {
  const command = sql.trim().toUpperCase();
  if (command === 'BEGIN') {
    await connection.beginTransaction();
    return { rows: [], rowCount: 0 };
  }
  if (command === 'COMMIT') {
    await connection.commit();
    return { rows: [], rowCount: 0 };
  }
  if (command === 'ROLLBACK') {
    await connection.rollback();
    return { rows: [], rowCount: 0 };
  }

  const { query, parameters, returning } = prepareQuery(sql, values);
  const table = returning ? query.match(/^(?:INSERT INTO|UPDATE)\s+`?([a-z_]+)`?/i)?.[1] : null;
  let executableQuery = query;
  if (returning && table && /ON DUPLICATE KEY UPDATE/i.test(executableQuery)) {
    executableQuery = executableQuery.replace(
      /ON DUPLICATE KEY UPDATE/i,
      `ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(\`${table}\`.id),`
    );
  }
  let priorRows = [];
  let whereClause;
  let whereParameters = [];

  if (returning && /^\s*UPDATE\b/i.test(query)) {
    const where = query.match(/\bWHERE\b([\s\S]+)$/i)?.[1];
    if (where) {
      whereClause = where;
      whereParameters = parameters.slice(-([...where.matchAll(/\?/g)].length));
      [priorRows] = await connection.query(`SELECT id FROM \`${table}\` WHERE ${whereClause}`, whereParameters);
    }
  }

  let result;
  let fields;
  try {
    [result, fields] = await connection.query(executableQuery, parameters);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') error.code = '23505';
    if (error.code === 'ER_NO_REFERENCED_ROW_2' || error.code === 'ER_ROW_IS_REFERENCED_2') error.code = '23503';
    throw error;
  }
  if (!returning) {
    const rows = Array.isArray(result) ? normalizeRows(result) : [];
    return { rows, rowCount: result.affectedRows ?? result.length ?? 0, fields };
  }

  let rows = [];
  if (/^\s*INSERT\b/i.test(query) && result.insertId) {
    const columns = returning === '*' ? '*' : returning;
    [rows] = await connection.query(`SELECT ${columns} FROM \`${table}\` WHERE id = ?`, [result.insertId]);
  } else if (priorRows.length) {
    const columns = returning === '*' ? '*' : returning;
    const ids = priorRows.map((row) => row.id);
    [rows] = await connection.query(`SELECT ${columns} FROM \`${table}\` WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  }

  return { rows: normalizeRows(rows), rowCount: result.affectedRows ?? rows.length, fields };
}

export const pool = {
  query: (sql, values) => runQuery(connectionPool, sql, values),
  connect: async () => {
    const connection = await connectionPool.getConnection();
    return {
      query: (sql, values) => runQuery(connection, sql, values),
      release: () => connection.release()
    };
  },
  end: () => connectionPool.end()
};

let _dbInitialized = false;

export async function initializeDatabase() {
  if (_dbInitialized) return;
  _dbInitialized = true;
  const schemaPath = new URL('./schema.sql', import.meta.url);
  const schema = await readFile(fileURLToPath(schemaPath), 'utf8');
  const conn = await pool.connect();
  try {
    await conn.query('BEGIN');
    for (const statement of schema.split(';').map((part) => part.trim()).filter(Boolean)) {
      await conn.query(statement);
    }
    const { rows } = await conn.query(
      `SELECT COUNT(*) AS column_exists
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='deleted_at'`
    );
    if (Number(rows[0]?.column_exists) === 0) {
      await conn.query('ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER updated_at');
    }
    const { rows: bookingStatus } = await conn.query(
      `SELECT COLUMN_TYPE AS column_type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='status'`
    );
    if (!bookingStatus[0]?.column_type?.includes('Awaiting Admin Approval')
      || !bookingStatus[0]?.column_type?.includes('Approved for Payment')) {
      await conn.query(
        `ALTER TABLE bookings MODIFY status ENUM(
          'Pending','Accepted','Rejected','Scheduled','In Progress',
          'Awaiting Admin Approval','Approved for Payment','Completed','Cancelled'
        ) NOT NULL DEFAULT 'Pending'`
      );
    }
    const { rows: paymentPreference } = await conn.query(
      `SELECT COUNT(*) AS column_exists
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='payment_preference'`
    );
    if (Number(paymentPreference[0]?.column_exists) === 0) {
      await conn.query(
        `ALTER TABLE bookings
         ADD COLUMN payment_preference ENUM('Cash','Telebirr','CBE Bank Transfer','Bank transfer','Other')
         NOT NULL DEFAULT 'Cash' AFTER callback_requested`
      );
    } else {
      const { rows: bookingPaymentPreference } = await conn.query(
        `SELECT COLUMN_TYPE AS column_type
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='payment_preference'`
      );
      if (!bookingPaymentPreference[0]?.column_type?.includes('CBE Bank Transfer')) {
        await conn.query(
          `ALTER TABLE bookings MODIFY payment_preference
           ENUM('Cash','Telebirr','CBE Bank Transfer','Bank transfer','Other') NOT NULL DEFAULT 'Cash'`
        );
      }
    }
    const { rows: roadsidePaymentPreference } = await conn.query(
      `SELECT COUNT(*) AS column_exists
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='roadside_requests' AND COLUMN_NAME='payment_preference'`
    );
    if (Number(roadsidePaymentPreference[0]?.column_exists) === 0) {
      await conn.query(
        `ALTER TABLE roadside_requests
         ADD COLUMN payment_preference ENUM('Cash','Telebirr','CBE Bank Transfer','Bank transfer','Other')
         NOT NULL DEFAULT 'Cash' AFTER description`
      );
    } else {
      const { rows: roadsideMethod } = await conn.query(
        `SELECT COLUMN_TYPE AS column_type
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='roadside_requests' AND COLUMN_NAME='payment_preference'`
      );
      if (!roadsideMethod[0]?.column_type?.includes('CBE Bank Transfer')) {
        await conn.query(
          `ALTER TABLE roadside_requests MODIFY payment_preference
           ENUM('Cash','Telebirr','CBE Bank Transfer','Bank transfer','Other') NOT NULL DEFAULT 'Cash'`
        );
      }
    }

    const { rows: userRoleCols } = await conn.query(
      `SELECT COLUMN_TYPE AS column_type
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='role'`
    );
    if (!userRoleCols[0]?.column_type?.includes('mechanic') || !userRoleCols[0]?.column_type?.includes('cashier')) {
      await conn.query("ALTER TABLE users MODIFY role ENUM('customer','provider','admin','mechanic','cashier') NOT NULL DEFAULT 'customer'");
    }

    const { rows: bookingMechanicCol } = await conn.query(
      `SELECT COUNT(*) AS column_exists
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='bookings' AND COLUMN_NAME='mechanic_id'`
    );
    if (Number(bookingMechanicCol[0]?.column_exists) === 0) {
      await conn.query('ALTER TABLE bookings ADD COLUMN mechanic_id BIGINT UNSIGNED NULL AFTER service_id');
      await conn.query('ALTER TABLE bookings ADD KEY idx_booking_mechanic (mechanic_id)');
    }

    const { rows: roadsideLandmarkCol } = await conn.query(
      `SELECT COUNT(*) AS column_exists
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='roadside_requests' AND COLUMN_NAME='landmark'`
    );
    if (Number(roadsideLandmarkCol[0]?.column_exists) === 0) {
      await conn.query('ALTER TABLE roadside_requests ADD COLUMN landmark VARCHAR(255) NULL AFTER location');
    }

    await conn.query('COMMIT');

    // ── Post-schema DDL migrations (run outside transaction - MySQL DDL auto-commits) ──
    // Invoices table: add missing columns that may not exist in older database
    const invoiceColumnsNeeded = [
      { name: 'invoice_number',  ddl: "VARCHAR(60) NOT NULL DEFAULT ''",  after: 'id' },
      { name: 'labor_cost',      ddl: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', after: 'provider_id' },
      { name: 'parts_cost',      ddl: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', after: 'labor_cost' },
      { name: 'subtotal',        ddl: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', after: 'parts_cost' },
      { name: 'tax_rate',        ddl: 'DECIMAL(5,2) NOT NULL DEFAULT 15.00', after: 'subtotal' },
      { name: 'tax_amount',      ddl: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', after: 'tax_rate' },
      { name: 'discount_amount', ddl: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', after: 'tax_amount' },
      { name: 'total_amount',    ddl: 'DECIMAL(12,2) NOT NULL DEFAULT 0.00', after: 'discount_amount' },
      { name: 'payment_status',  ddl: "ENUM('Unpaid','Pending_Verification','Paid','Refunded') NOT NULL DEFAULT 'Unpaid'", after: 'total_amount' },
      { name: 'receipt_number',  ddl: 'VARCHAR(60) DEFAULT NULL',            after: 'payment_status' },
      { name: 'work_performed',  ddl: 'TEXT DEFAULT NULL',                   after: 'receipt_number' },
      { name: 'payment_method',  ddl: 'VARCHAR(50) DEFAULT NULL',            after: 'work_performed' },
      { name: 'customer_id',     ddl: 'BIGINT UNSIGNED NULL',                after: 'booking_id' },
      { name: 'provider_id',     ddl: 'BIGINT UNSIGNED NULL',                after: 'customer_id' },
    ];

    for (const col of invoiceColumnsNeeded) {
      // Use literal column name (safe - values come from our own array above, not user input)
      const { rows: colCheck } = await conn.query(
        `SELECT COUNT(*) AS column_exists
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND COLUMN_NAME='${col.name}'`
      );
      if (Number(colCheck[0]?.column_exists) === 0) {
        try {
          await conn.query(`ALTER TABLE invoices ADD COLUMN \`${col.name}\` ${col.ddl} AFTER \`${col.after}\``);
        } catch (alterErr) {
          // Column may exist if concurrent migration; ignore duplicate column error
          if (!String(alterErr.message).includes('Duplicate column')) throw alterErr;
        }
      }
    }

    // Ensure invoice_number has a unique index
    const { rows: invNumIdx } = await conn.query(
      `SELECT COUNT(*) AS idx_exists
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='invoices' AND INDEX_NAME='uq_invoice_number'`
    );
    if (Number(invNumIdx[0]?.idx_exists) === 0) {
      // Assign unique placeholders to any blank invoice_numbers before adding unique constraint
      await conn.query(`UPDATE invoices SET invoice_number=CONCAT('INV-MIGRATE-',id) WHERE invoice_number='' OR invoice_number IS NULL`);
      try {
        await conn.query('ALTER TABLE invoices ADD UNIQUE KEY uq_invoice_number (invoice_number)');
      } catch (idxErr) {
        if (!String(idxErr.message).includes('Duplicate key name')) throw idxErr;
      }
    }

  } catch (err) {
    try { await conn.query('ROLLBACK'); } catch {}
    throw err;
  } finally {
    await conn.release();
  }
}

