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
