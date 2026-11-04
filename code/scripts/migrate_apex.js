// APEX control-plane schema — tenants, client_payments, audit_log, layla_configs,
// package_config. Adapted from apex_backend/schema/*.sql after auditing against the
// real DB (2026-07-11):
//   - 01_rls_tenant_isolation.sql is deliberately NOT here (owner decision):
//     it targeted tables that don't exist (inventory/sales/customer_ledgers/invoices),
//     and tenant isolation on this product is one-DB-per-client (create_instance.js),
//     not single-DB RLS. Golden-core financial tables are never ALTERed.
//   - audit_log REVOKE targets the real app role (DB_USER from .env), not 'app_role'.
//   - All DDL is idempotent — safe to re-run.
// Usage: node scripts/migrate_apex.js   (loads the LOCAL .env, same as migrate_grn.js)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port: process.env.DB_PORT||5432, database: process.env.DB_NAME||'bathco_template', user: process.env.DB_USER||'postgres', password: process.env.DB_PASSWORD });

// The role the Node app connects as. Interpolated into REVOKE/GRANT (identifiers
// can't be bind params) — validated to a safe identifier first.
const APP_ROLE = process.env.DB_USER || 'bathco_template_app';
if (!/^[a-z_][a-z0-9_]*$/i.test(APP_ROLE)) {
    console.error(`Refusing to run: DB_USER "${APP_ROLE}" is not a plain identifier.`);
    process.exit(1);
}

const sql = `
BEGIN;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'TERMINATED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
    id                SERIAL PRIMARY KEY,
    shop_name         VARCHAR(150) NOT NULL,
    owner_name        VARCHAR(150) NOT NULL,
    industry_type     VARCHAR(50) NOT NULL,
    whatsapp_number   VARCHAR(20),
    whatsapp_consent  BOOLEAN NOT NULL DEFAULT false,
    package_tier      VARCHAR(30) NOT NULL DEFAULT 'Starter',
    subdomain         VARCHAR(63) UNIQUE NOT NULL,
    status            tenant_status NOT NULL DEFAULT 'TRIAL',
    trial_expires_at  TIMESTAMP,
    created_at        TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_payments (
    id                    SERIAL PRIMARY KEY,
    tenant_id             INTEGER NOT NULL REFERENCES tenants(id),
    amount_lkr            NUMERIC(12,2) NOT NULL,
    bank_reference        VARCHAR(100) UNIQUE NOT NULL,
    deposit_date          DATE NOT NULL,
    verified_by_admin_id  INTEGER NOT NULL,
    notes                 TEXT,
    created_at            TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id               SERIAL PRIMARY KEY,
    actor_admin_id   INTEGER NOT NULL,
    action_type      VARCHAR(50) NOT NULL,
    target_tenant_id INTEGER,
    details          JSONB,
    created_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- Lock it down: the app's role can INSERT and SELECT, never UPDATE or DELETE.
-- (Postgres checks these even for the table owner; the running app cannot
-- rewrite history without an explicit re-GRANT outside the app.)
REVOKE UPDATE, DELETE ON audit_log FROM ${APP_ROLE};
GRANT INSERT, SELECT ON audit_log TO ${APP_ROLE};
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO ${APP_ROLE};

DO $$ BEGIN
    CREATE TYPE layla_capability_tier AS ENUM ('basic', 'standard', 'full');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    CREATE TYPE layla_onboarding_stage AS ENUM ('not_started', 'learning', 'trained');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS layla_configs (
    id                    SERIAL PRIMARY KEY,
    tenant_id             INTEGER NOT NULL REFERENCES tenants(id) UNIQUE,
    whatsapp_number       VARCHAR(20) NOT NULL,
    capability_tier       layla_capability_tier NOT NULL DEFAULT 'basic',
    tone_language_mix     VARCHAR(30) NOT NULL DEFAULT 'sin_romanized_mixed',
    catalog_source_table  VARCHAR(100),
    is_active             BOOLEAN NOT NULL DEFAULT false,
    onboarding_stage      layla_onboarding_stage NOT NULL DEFAULT 'not_started',
    corrections           JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at            TIMESTAMP NOT NULL DEFAULT now()
);

-- basic    = FAQ answers only
-- standard = + live stock lookup
-- full     = + report generation

CREATE TABLE IF NOT EXISTS package_config (
    id         SERIAL PRIMARY KEY,
    tier_name  VARCHAR(50) NOT NULL UNIQUE,
    price_lkr  NUMERIC(10,2) NOT NULL,
    features   JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_addon   BOOLEAN NOT NULL DEFAULT false,
    is_popular BOOLEAN NOT NULL DEFAULT false
);

-- Prices are ALWAYS read from this table by the app — never hardcoded in JS.
INSERT INTO package_config (tier_name, price_lkr, features, is_addon, is_popular) VALUES
('Starter',       5000.00,  '["POS + Invoicing", "Single user"]', false, false),
('Growth',        15000.00, '["+ Inventory", "+ Credit tracking", "+ Staff commissions", "Multi-user"]', false, true),
('Command',       30000.00, '["Everything in Growth", "Full ERP", "Apex reporting"]', false, false),
('LAYLA Add-on',  4000.00,  '["WhatsApp AI assistant", "Attachable to any tier"]', true, false)
ON CONFLICT (tier_name) DO NOTHING;

COMMIT;
`;

p.query(sql)
    .then(() => { console.log('APEX schema migration complete (tenants, client_payments, audit_log, layla_configs, package_config).'); return p.end(); })
    .catch(err => { console.error('APEX migration failed:', err.message); p.end(); process.exit(1); });
