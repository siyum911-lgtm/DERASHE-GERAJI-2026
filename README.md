# DERASHE GERAJI – Garage Management System

**DERASHE GERAJI (ደራሽ ገራጅ)** is a complete, modern web application and management system specifically designed for Ethiopian vehicle owners, mechanics, cashiers, and automotive workshops/garages.

Built with **React + Vite + Tailwind CSS** frontend, **Node.js + Express** backend, and **MySQL** database (XAMPP).

---

## 🌟 Modules & Features Overview

### 1. Secure Authentication & Role-Based Access Control (RBAC)
- Role-specific access control and customized workflows for:
  - **Admin**: Complete system oversight, provider verification, user role assignment, catalog management, financial & stock reports, complaint resolution, and audit logs.
  - **Customer**: Manage vehicles, view vehicle repair histories, book services, track repair status in real-time, submit roadside assistance, select payment preference, and write reviews.
  - **Mechanic**: View assigned repair orders, access diagnostic tools and equipment, submit inspection & service reports (diagnosis, labor, parts consumed from inventory), and update repair progress.
  - **Cashier**: Access billing dashboard, view pending invoices, record customer payments (Cash, Telebirr, CBE Bank Transfer, Awash, Dashen), generate and print official stamped receipts.
  - **Provider (Workshop/Garage)**: Manage garage profile, publish services, assign mechanics to bookings, track workshop equipment, and manage spare parts inventory.
- Password hashing with **bcrypt**, stateless **JWT** authentication, and parameterized SQL queries to protect against SQL injection.

### 2. Vehicle Registration & Service History
- Register customer vehicles with unique plate numbers (e.g. `3-B12345 AA`), VIN, make, model, year, fuel type, and mileage.
- Chronological **Vehicle Service History** modal per vehicle displaying all past repairs, mechanic notes, diagnosis, parts replaced, and costs.

### 3. Garage & Service Catalog Management
- Search verified automotive workshops and mechanics by location, rating, and service category.
- Comprehensive service catalog with estimated prices (ETB) and completion duration.
- Weekly availability hours per workshop.

### 4. Service Booking, Mechanic Assignment & Repair Status Tracking
- Book repair appointments with preferred time, issue description, and callback request.
- **Mechanic Assignment**: Garage managers and Admins can assign specific mechanics to any booking.
- Real-time repair status tracking: `Pending` ➔ `Accepted` ➔ `Scheduled` ➔ `In Progress` ➔ `Awaiting Admin Approval` ➔ `Approved for Payment` ➔ `Completed`.

### 5. Spare-Parts Inventory with Automatic Stock Updates & Low-Stock Alerts
- Normalized `spare_parts` inventory table storing part numbers, OEM names, categories, unit prices (ETB), stock counts, and minimum warning levels.
- **Automatic Stock Decrement**: When a service report is submitted, used parts are deducted from inventory in a single atomic database transaction.
- **Low-Stock Warnings**: Instant alerts and UI warning badges when a spare part's stock drops below its reorder threshold.

### 6. Repair Cost Calculation, Invoices & Official Receipts
- Automatic cost calculation: **Labor Cost + Parts Cost + 15% Ethiopian VAT = Total (ETB)**.
- Professional, printable **Tax Invoice** and **Official Receipt** modal with printable CSS styles (`window.print()`).
- Support for Ethiopian payment options: **Telebirr**, **CBE Bank Transfer / CBE Birr**, **Cash**, and **Bank Transfer**.

### 7. Roadside Assistance with Landmark Details
- Emergency roadside requests with vehicle details, breakdown category (Flat tire, Engine problem, Towing, Battery, etc.), phone number, current location, and **Landmark** details (e.g. "Behind Dembel City Center / Bole Road").
- Direct phone link (`tel:`) for immediate mechanic dispatch.

### 8. Garage Equipment & Diagnostic-Device Management
- Track specialized diagnostic devices (OBD-II / CAN-FD Scanners, Autel MaxiSys, Launch X431), 2-post hydraulic lifts, wheel balancers, and AC recovery machines.
- Equipment health statuses: `Operational`, `Maintenance Required`, `Under Repair`, `Calibrated`, `Decommissioned`.
- Service schedule tracking with next maintenance due date and assigned mechanic.

### 9. Admin Dashboard, Financial Reports & Customer Reviews
- Executive summary counters for customers, vehicles, mechanics, cashiers, active repairs, inventory items, and low-stock alerts.
- Financial reports with revenue breakdowns by payment method (Telebirr, CBE, Cash) and total inventory valuation.
- Customer reviews and 1 to 5 star ratings.

### 10. English & Amharic Language Switching (እንግሊዝኛ / አማርኛ)
- Seamless bilingual interface switching between **English** and **Amharic (አማርኛ)** with persistent storage.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, React Router 6, Tailwind CSS, Lucide React icons, Axios.
- **Backend**: Node.js (ES Modules), Express 5, Zod validation, JSON Web Tokens (JWT), bcrypt.
- **Database**: MySQL / MariaDB via `mysql2/promise` with automatic schema migrations.

---

## 🚀 Setup & Installation Instructions

### Prerequisites
- Node.js (v20 or newer)
- XAMPP with Apache & MySQL running

### 1. Database Configuration
1. Open XAMPP Control Panel and start **MySQL**.
2. Open phpMyAdmin (`http://localhost/phpmyadmin`) and create an empty database named `derashe_geraji`.
3. In `server/.env`, verify the database connection:
   ```env
   PORT=4000
   DATABASE_URL=mysql://root:@127.0.0.1:3306/derashe_geraji
   JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
   CLIENT_ORIGIN=http://localhost:5173
   ```

### 2. Install Dependencies
From the repository root:
```bash
npm install
npm --prefix server install
npm --prefix client install
```

### 3. Run Development Servers
Start both backend API and frontend concurrently:
```bash
npm run dev
```
- Web Application: `http://localhost:5173`
- Backend API Health check: `http://localhost:4000/api/health`

### 4. Creating an Administrator Account
1. Register a new account via the `/register` page.
2. In phpMyAdmin, run the following SQL command with your registered email:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
   ```
3. Sign in to access the comprehensive Administrator Dashboard.

---

## 🔒 Security Best Practices
- **No Credentials in Git**: `.env` files, passwords, and sensitive keys are strictly listed in `.gitignore`.
- **Parameterized SQL**: All database queries use parameterized placeholders (`?`) to prevent SQL injection.
- **Secure Authentication**: Passwords hashed with 12 bcrypt salt rounds.
- **Audit Logging**: Sensitive actions (role updates, status modifications, payment records) are logged to the `audit_logs` table.
