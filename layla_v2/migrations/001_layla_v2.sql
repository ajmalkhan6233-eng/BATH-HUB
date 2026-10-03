-- LAYLA v2 (WhatsApp assistant): NEW tables only. Additive, idempotent, touches no existing table.
-- Reverse: 001_layla_v2_down.sql

-- Owner / staff allow-list. EMPTY by default: until the owner adds numbers, every sender is a CUSTOMER.
CREATE TABLE IF NOT EXISTS layla_contacts (
    id         SERIAL PRIMARY KEY,
    phone      VARCHAR(20) NOT NULL UNIQUE,            -- digits only, with country code, e.g. 94771234567
    role       VARCHAR(10) NOT NULL DEFAULT 'staff',   -- 'owner' or 'staff'
    name       VARCHAR(80),
    active     BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Things LAYLA could not answer or must not decide: unknown facts, complaints, refunds, discounts, quotation drafts.
CREATE TABLE IF NOT EXISTS layla_tasks (
    id          SERIAL PRIMARY KEY,
    kind        VARCHAR(30) NOT NULL,                   -- unknown_fact / complaint / refund / discount / money_owed / handoff / quotation_draft / callback
    status      VARCHAR(10) NOT NULL DEFAULT 'open',    -- open / done
    phone       VARCHAR(20),
    cust_name   VARCHAR(80),
    summary     TEXT NOT NULL,
    payload     TEXT,                                   -- small JSON text (e.g. quotation draft lines)
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at   TIMESTAMP,
    closed_by   VARCHAR(20)
);

-- Small switches, e.g. key 'paused' = 'true' (owner said "pause LAYLA").
CREATE TABLE IF NOT EXISTS layla_state (
    key        VARCHAR(40) PRIMARY KEY,
    value      TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer name and language, so LAYLA remembers who she is talking to.
CREATE TABLE IF NOT EXISTS layla_customers (
    phone      VARCHAR(20) PRIMARY KEY,
    name       VARCHAR(80),
    lang       VARCHAR(10),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Last messages per customer (LAYLA reads the latest 20; older rows are pruned by the store).
CREATE TABLE IF NOT EXISTS layla_messages (
    id         SERIAL PRIMARY KEY,
    phone      VARCHAR(20) NOT NULL,
    direction  VARCHAR(3) NOT NULL,                     -- 'in' or 'out'
    body       TEXT NOT NULL,
    lang       VARCHAR(10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_layla_messages_phone ON layla_messages (phone, id);
CREATE INDEX IF NOT EXISTS idx_layla_tasks_status ON layla_tasks (status, id);