-- BATHCO COMMAND DATABASE SCHEMA
-- Run this in PostgreSQL first

CREATE DATABASE bathco;

\c bathco;

-- ENUMS
CREATE TYPE user_role AS ENUM ('admin', 'owner', 'staff', 'customer');
CREATE TYPE lead_status AS ENUM ('new', 'engaged', 'visit_scheduled', 'visited', 'converted', 'lost');
CREATE TYPE lead_source AS ENUM ('whatsapp', 'website', 'tiktok', 'facebook', 'walk_in', 'referral', 'returning');
CREATE TYPE payment_type AS ENUM ('cash', 'card', 'online', 'cheque', 'credit');

-- USERS TABLE
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE,
    phone VARCHAR(20) UNIQUE,
    password_hash TEXT NOT NULL,
    role user_role DEFAULT 'customer',
    staff_id INT REFERENCES staff(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CUSTOMERS TABLE
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    phone VARCHAR(20) UNIQUE NOT NULL,
    whatsapp VARCHAR(20),
    location VARCHAR(150),
    source lead_source DEFAULT 'whatsapp',
    visit_count INT DEFAULT 0,
    last_contact TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- LEADS TABLE
CREATE TABLE leads (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    status lead_status DEFAULT 'new',
    agent_handled VARCHAR(50) DEFAULT 'LAYLA',
    source lead_source DEFAULT 'whatsapp',
    value_estimation DECIMAL(12,2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CONVERSATIONS TABLE
CREATE TABLE conversations (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id) ON DELETE CASCADE,
    channel VARCHAR(50) DEFAULT 'whatsapp',
    agent VARCHAR(50) DEFAULT 'LAYLA',
    messages JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PRODUCTS TABLE
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    item_code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    description TEXT,
    stock_level INT DEFAULT 0,
    price_tier VARCHAR(20) DEFAULT 'Standard',
    image_url TEXT,
    supplier VARCHAR(100),
    active BOOLEAN DEFAULT true,
    batch_number VARCHAR(50),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- PACKAGES TABLE
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tier VARCHAR(50) NOT NULL,
    description TEXT,
    items JSONB DEFAULT '[]',
    image_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- DAILY REPORTS TABLE (matches Ajmal's Excel format exactly)
CREATE TABLE daily_reports (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    invoice_no VARCHAR(50) NOT NULL,
    total_sale DECIMAL(12,2) NOT NULL,
    cash_amount DECIMAL(12,2) DEFAULT 0.00,
    card_amount DECIMAL(12,2) DEFAULT 0.00,
    online_amount DECIMAL(12,2) DEFAULT 0.00,
    cheque_amount DECIMAL(12,2) DEFAULT 0.00,
    credit_amount DECIMAL(12,2) DEFAULT 0.00,
    is_refund BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- CHEQUES TABLE
CREATE TABLE cheques (
    id SERIAL PRIMARY KEY,
    cheque_number VARCHAR(50) NOT NULL,
    bank VARCHAR(100),
    amount DECIMAL(12,2) NOT NULL,
    due_date DATE NOT NULL,
    customer_id INT REFERENCES customers(id),
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- VOICE NOTES TABLE
CREATE TABLE voice_notes (
    id SERIAL PRIMARY KEY,
    customer_id INT REFERENCES customers(id),
    phone VARCHAR(20),
    media_url TEXT,
    forwarded_to VARCHAR(50) DEFAULT 'Ajmal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ALERTS TABLE
CREATE TABLE alerts (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50),
    message TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR PERFORMANCE
CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_products_item_code ON products(item_code);
CREATE INDEX idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_conversations_customer ON conversations(customer_id);

-- INSERT DEFAULT PACKAGES
INSERT INTO packages (name, tier, description) VALUES
('Standard Bathroom Package', 'Standard', 'Quality commode + pedestal basin + shower fittings + angle valves + magic bend + accessories'),
('Premium Bathroom Package', 'Premium', 'Premium commode + designer basin + rain shower + premium fittings + full accessories set'),
('Luxury Bathroom Package', 'Luxury', 'Jacuzzi or premium shower panel + top-brand commode + designer basin + designer fittings throughout');

-- USER ACCOUNTS (admin/owner/staff) are seeded by scripts/seed_accounts.js,
-- which generates temp passwords, bcrypt-hashes them, and links staff
-- accounts to their staff_id for commission-page access.

-- Duplicate-prevention / integrity constraints (added 2026-07-03, approved by Ajmal)
ALTER TABLE cheques ADD CONSTRAINT cheques_no_bank_due_key UNIQUE (cheque_number, bank, due_date);
ALTER TABLE credit_customers ADD CONSTRAINT credit_cust_id_invoice_key UNIQUE (customer_id, invoice_no);
ALTER TABLE grn_records ADD CONSTRAINT grn_records_supplier_fkey FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
