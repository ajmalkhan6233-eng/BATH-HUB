// APEX fleet-management schema — dedicated_clients: one row per client running
// as their OWN Railway project (dedicated deploy, not a tenant row in this DB).
// Control-plane data ONLY: name/contact/Railway ids/subscription/health state.
// No connection strings, no client business data — by design (and policy:
// Apex must never read a client's actual database).
// All DDL is idempotent — safe to re-run.
// Usage: node scripts/migrate_fleet.js   (loads the LOCAL .env, same as migrate_apex.js)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port: process.env.DB_PORT||5432, database: process.env.DB_NAME||'bathco_template', user: process.env.DB_USER||'postgres', password: process.env.DB_PASSWORD });

const sql = `
BEGIN;

CREATE TABLE IF NOT EXISTS dedicated_clients (
    id                      SERIAL PRIMARY KEY,
    client_name             VARCHAR(150) NOT NULL,
    contact                 VARCHAR(200),                 -- phone/email, free text
    railway_project_id      VARCHAR(64) UNIQUE,           -- Railway project UUID
    railway_environment_id  VARCHAR(64),                  -- needed by control mutations
    railway_service_id      VARCHAR(64),                  -- needed by control mutations
    subscription_status     VARCHAR(20) NOT NULL DEFAULT 'TRIAL'
                            CHECK (subscription_status IN ('TRIAL','ACTIVE','SUSPENDED','TERMINATED')),
    health_url              TEXT,                         -- public /health endpoint to ping
    last_known_state        VARCHAR(10) NOT NULL DEFAULT 'UNKNOWN'
                            CHECK (last_known_state IN ('ONLINE','OFFLINE','UNKNOWN')),
    last_checked_at         TIMESTAMP,
    created_at              TIMESTAMP NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP NOT NULL DEFAULT now()
);

COMMIT;
`;

p.query(sql)
    .then(() => { console.log('Fleet schema migration complete (dedicated_clients).'); return p.end(); })
    .catch(err => { console.error('Fleet migration failed:', err.message); p.end(); process.exit(1); });
