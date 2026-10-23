CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer','provider','admin','mechanic','cashier') NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL DEFAULT NULL,

    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS vehicles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    make VARCHAR(80) NOT NULL,
    model VARCHAR(80) NOT NULL,
    year INT NOT NULL,
    plate_number VARCHAR(40) NOT NULL,
    vin VARCHAR(80) DEFAULT NULL,
    mileage INT NOT NULL DEFAULT 0,
    fuel_type VARCHAR(30) NOT NULL,
    image_url VARCHAR(500) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_vehicle_plate (plate_number),
    UNIQUE KEY uq_vehicle_vin (vin),
    KEY idx_vehicle_customer (customer_id),

    CONSTRAINT fk_vehicle_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS providers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    business_name VARCHAR(160) NOT NULL,
    provider_type ENUM('mechanic','workshop') NOT NULL,
    location VARCHAR(200) NOT NULL,
    latitude DOUBLE DEFAULT NULL,
    longitude DOUBLE DEFAULT NULL,
    experience_years INT NOT NULL DEFAULT 0,
    specialties TEXT DEFAULT NULL,
    bio TEXT DEFAULT NULL,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_provider_user (user_id),
    KEY idx_provider_verified (verified),

    CONSTRAINT fk_provider_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS service_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_category_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS car_services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    description TEXT DEFAULT NULL,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    estimated_minutes INT NOT NULL DEFAULT 60,
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_service_provider (provider_id),
    KEY idx_service_category (category_id),

    CONSTRAINT fk_service_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_service_category
        FOREIGN KEY (category_id)
        REFERENCES service_categories(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS availability (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id BIGINT UNSIGNED NOT NULL,
    weekday TINYINT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    available TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_provider_weekday (provider_id, weekday),

    CONSTRAINT fk_availability_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS bookings (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    service_id BIGINT UNSIGNED NOT NULL,
    mechanic_id BIGINT UNSIGNED DEFAULT NULL,
    problem_description TEXT NOT NULL,
    scheduled_at DATETIME NOT NULL,
    callback_requested TINYINT(1) NOT NULL DEFAULT 0,
    payment_preference ENUM('Cash','Telebirr','CBE Bank Transfer','Bank transfer','Other') NOT NULL DEFAULT 'Cash',

    status ENUM(
        'Pending',
        'Accepted',
        'Rejected',
        'Scheduled',
        'In Progress',
        'Awaiting Admin Approval',
        'Approved for Payment',
        'Completed',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_booking_customer (customer_id),
    KEY idx_booking_vehicle (vehicle_id),
    KEY idx_booking_provider (provider_id),
    KEY idx_booking_mechanic (mechanic_id),
    KEY idx_booking_service (service_id),
    KEY idx_booking_status (status),

    CONSTRAINT fk_booking_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id),

    CONSTRAINT fk_booking_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id),

    CONSTRAINT fk_booking_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id),

    CONSTRAINT fk_booking_mechanic
        FOREIGN KEY (mechanic_id)
        REFERENCES users(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_booking_service
        FOREIGN KEY (service_id)
        REFERENCES car_services(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS repair_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    diagnosis TEXT NOT NULL,
    work_performed TEXT NOT NULL,
    parts_used TEXT DEFAULT NULL,
    labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    completed_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_repair_booking (booking_id),

    CONSTRAINT fk_repair_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS roadside_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    vehicle_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED DEFAULT NULL,
    location VARCHAR(300) NOT NULL,
    landmark VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(30) NOT NULL,

    problem_type ENUM(
        'Vehicle breakdown',
        'Flat tire',
        'Dead battery',
        'Engine problem',
        'Accident assistance',
        'Fuel problem',
        'Towing'
    ) NOT NULL,

    description TEXT NOT NULL,
    payment_preference ENUM('Cash','Telebirr','CBE Bank Transfer','Bank transfer','Other') NOT NULL DEFAULT 'Cash',

    status ENUM(
        'Pending',
        'Accepted',
        'Rejected',
        'In Progress',
        'Completed',
        'Cancelled'
    ) NOT NULL DEFAULT 'Pending',

    requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_roadside_customer (customer_id),
    KEY idx_roadside_vehicle (vehicle_id),
    KEY idx_roadside_provider (provider_id),
    KEY idx_roadside_status (status),

    CONSTRAINT fk_roadside_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id),

    CONSTRAINT fk_roadside_vehicle
        FOREIGN KEY (vehicle_id)
        REFERENCES vehicles(id),

    CONSTRAINT fk_roadside_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    method VARCHAR(40) NOT NULL,
    reference VARCHAR(120) DEFAULT NULL,

    status ENUM(
        'Recorded',
        'Pending',
        'Refunded'
    ) NOT NULL DEFAULT 'Recorded',

    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_payment_booking (booking_id),

    KEY idx_payment_customer (customer_id),
    KEY idx_payment_provider (provider_id),

    CONSTRAINT fk_payment_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id),

    CONSTRAINT fk_payment_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id),

    CONSTRAINT fk_payment_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    rating TINYINT NOT NULL,
    comment TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_review_booking (booking_id),
    KEY idx_review_provider (provider_id),

    CONSTRAINT fk_review_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id),

    CONSTRAINT fk_review_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id),

    CONSTRAINT fk_review_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_notification_user (user_id),

    CONSTRAINT fk_notification_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS complaints (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    customer_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED DEFAULT NULL,
    booking_id BIGINT UNSIGNED DEFAULT NULL,
    subject VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,

    status ENUM(
        'Open',
        'In Review',
        'Resolved',
        'Closed'
    ) NOT NULL DEFAULT 'Open',

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_complaint_customer (customer_id),
    KEY idx_complaint_provider (provider_id),
    KEY idx_complaint_booking (booking_id),

    CONSTRAINT fk_complaint_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id),

    CONSTRAINT fk_complaint_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_complaint_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id BIGINT UNSIGNED DEFAULT NULL,
    action VARCHAR(120) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id BIGINT UNSIGNED DEFAULT NULL,
    details TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_audit_actor (actor_id),

    CONSTRAINT fk_audit_actor
        FOREIGN KEY (actor_id)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS spare_parts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id BIGINT UNSIGNED DEFAULT NULL,
    part_number VARCHAR(80) NOT NULL,
    name VARCHAR(160) NOT NULL,
    category VARCHAR(100) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    quantity_in_stock INT NOT NULL DEFAULT 0,
    min_stock_level INT NOT NULL DEFAULT 5,
    supplier VARCHAR(160) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_spare_parts_provider (provider_id),
    KEY idx_spare_parts_stock (quantity_in_stock, min_stock_level),

    CONSTRAINT fk_spare_parts_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS repair_parts_used_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    booking_id BIGINT UNSIGNED NOT NULL,
    part_id BIGINT UNSIGNED NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_repair_parts_booking (booking_id),
    KEY idx_repair_parts_part (part_id),

    CONSTRAINT fk_repair_parts_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_repair_parts_part
        FOREIGN KEY (part_id)
        REFERENCES spare_parts(id)
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS invoices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    invoice_number VARCHAR(60) NOT NULL,
    booking_id BIGINT UNSIGNED NOT NULL,
    customer_id BIGINT UNSIGNED NOT NULL,
    provider_id BIGINT UNSIGNED NOT NULL,
    labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    parts_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    tax_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    payment_status ENUM('Unpaid','Pending_Verification','Paid','Refunded') NOT NULL DEFAULT 'Unpaid',
    receipt_number VARCHAR(60) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    UNIQUE KEY uq_invoice_number (invoice_number),
    UNIQUE KEY uq_invoice_booking (booking_id),
    UNIQUE KEY uq_invoice_receipt (receipt_number),
    KEY idx_invoice_customer (customer_id),
    KEY idx_invoice_provider (provider_id),

    CONSTRAINT fk_invoice_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invoice_customer
        FOREIGN KEY (customer_id)
        REFERENCES users(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invoice_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS equipment (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_id BIGINT UNSIGNED DEFAULT NULL,
    name VARCHAR(160) NOT NULL,
    model_number VARCHAR(100) DEFAULT NULL,
    serial_number VARCHAR(100) DEFAULT NULL,
    device_type ENUM(
        'Diagnostic Scanner',
        'Hydraulic Lift',
        'Wheel Balancer',
        'AC Recovery',
        'Battery Tester',
        'Welding & Cutting',
        'Engine Crane',
        'Hand & Power Tools',
        'Other'
    ) NOT NULL,
    status ENUM(
        'Operational',
        'Maintenance Required',
        'Under Repair',
        'Calibrated',
        'Decommissioned'
    ) NOT NULL DEFAULT 'Operational',
    last_service_date DATE DEFAULT NULL,
    next_service_due DATE DEFAULT NULL,
    assigned_to BIGINT UNSIGNED DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),
    KEY idx_equipment_provider (provider_id),
    KEY idx_equipment_assigned (assigned_to),

    CONSTRAINT fk_equipment_provider
        FOREIGN KEY (provider_id)
        REFERENCES providers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_equipment_assigned
        FOREIGN KEY (assigned_to)
        REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


INSERT IGNORE INTO service_categories (name, description) VALUES
('Engine Repair & Maintenance', 'Engine diagnostics, repair and scheduled maintenance'),
('Brake System Repair', 'Brake inspection, brake pad, rotor and hydraulic repair'),
('Transmission & Gearbox', 'Transmission and gearbox service and repair'),
('Suspension & Steering', 'Suspension, steering and alignment repair'),
('Tire Repair & Replacement', 'Tire puncture repair and tire replacement'),
('Battery Service', 'Battery testing, charging and replacement'),
('Automotive Electrical Repair', 'Vehicle wiring, lighting and electrical repair'),
('Computer Diagnostics', 'Computerized vehicle fault diagnostics'),
('Sensor Repair', 'Automotive sensor testing and replacement'),
('Oil & Filter Change', 'Engine oil and filter replacement'),
('Cooling & Radiator System', 'Radiator, coolant and cooling-system repair'),
('Air Conditioning Repair', 'Vehicle air-conditioning diagnostics and repair'),
('Fuel System Repair', 'Fuel pump, injector and fuel-system service'),
('Spare Parts', 'Automotive spare parts supply'),
('Roadside Assistance', 'Emergency roadside vehicle assistance'),
('Towing', 'Vehicle towing and recovery service');

INSERT IGNORE INTO spare_parts (id, part_number, name, category, unit_price, quantity_in_stock, min_stock_level, supplier, description) VALUES
(1, 'SP-TY-04465', 'Toyota Genuine Front Brake Pad Set', 'Brake System', 4500.00, 14, 5, 'Ethio-Nippon Parts Ltd', 'High-durability semi-metallic brake pads for Toyota Hilux / Land Cruiser / Corolla'),
(2, 'SP-TY-04152', 'Engine Oil Filter Cartridge (Toyota/Lexus)', 'Filters', 950.00, 28, 8, 'Addis Auto Spare Parts', 'OEM engine oil filter with high efficiency filtration membrane'),
(3, 'SP-BOSCH-FR7', 'Bosch Platinum Spark Plug (Set of 4)', 'Ignition', 2800.00, 22, 6, 'Sebeta Auto Importers', 'Bosch double platinum spark plug kit for optimum fuel economy'),
(4, 'SP-MOBIL-5W30', 'Mobil 1 Fully Synthetic 5W-30 Motor Oil (4L)', 'Fluids & Lubricants', 6200.00, 18, 5, 'TotalEnergies Ethiopia', 'Advanced full synthetic engine oil for ultimate engine protection'),
(5, 'SP-GS-12V70', 'GS Yuasa 12V 70Ah Maintenance-Free Battery', 'Electrical', 14500.00, 7, 3, 'Kality Battery Distributor', 'Heavy duty tropicalized battery with high cranking amps'),
(6, 'SP-BANDO-7PK', 'Bando Serpentine Alternator V-Belt', 'Belts & Cooling', 1850.00, 3, 5, 'Merkato Spare Parts Hub', 'Durable EPDM automotive accessory belt - LOW STOCK ALERT'),
(7, 'SP-KYB-3413', 'KYB Excel-G Rear Shock Absorber Pair', 'Suspension', 18900.00, 6, 4, 'Bole Auto Parts', 'Twin-tube gas shock absorbers for Toyota RAV4 and Hilux'),
(8, 'SP-DENSO-AC', 'Denso Cabin Air Filter (Antimicrobial)', 'Filters', 1200.00, 2, 5, 'Addis Auto Spare Parts', 'HEPA antimicrobial dust and pollen filter - LOW STOCK ALERT');

INSERT IGNORE INTO equipment (id, name, model_number, serial_number, device_type, status, last_service_date, next_service_due, notes) VALUES
(1, 'Launch X431 V+ Pro Diagnostic Scanner', 'X431-V-PRO', 'LNC-2024-98124', 'Diagnostic Scanner', 'Operational', '2026-01-15', '2026-07-15', 'Supports all OBD-II and CAN-FD Ethiopian import vehicles with live graphing'),
(2, 'Autel MaxiSys MS906 Pro Bi-Directional Scanner', 'MS906-PRO', 'AUT-8841-0023', 'Diagnostic Scanner', 'Operational', '2026-02-10', '2026-08-10', 'Advanced coding and bi-directional test capability'),
(3, 'Rotary 4.5-Ton 2-Post Hydraulic Vehicle Lift', 'SPOA10-TA', 'ROT-4500-119', 'Hydraulic Lift', 'Operational', '2025-11-20', '2026-05-20', 'Heavy duty symmetric 2-post lift inspected and certified'),
(4, 'Corghi EM9280 Digital Wheel Balancer', 'EM-9280', 'CRG-3321-440', 'Wheel Balancer', 'Calibrated', '2026-03-01', '2026-09-01', 'Laser automatic wheel balancing station'),
(5, 'Robinair CoolTech AC Recovery & Recharge Machine', 'RG34788', 'ROB-9912-781', 'AC Recovery', 'Operational', '2026-01-30', '2026-07-30', 'R134a automated refrigerant recovery, recycling and recharge unit'),
(6, 'Midtronics EXP-1000 Digital Battery & Electrical Analyzer', 'EXP-1000', 'MID-1102-553', 'Battery Tester', 'Maintenance Required', '2025-08-14', '2026-02-14', 'Probe cables need recalibration and clip replacement');
