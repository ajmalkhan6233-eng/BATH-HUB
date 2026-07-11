-- Multi-Tenant Row-Level Security
-- Adds tenant_id to core tables and enforces isolation via RLS.

BEGIN;

-- 1. Add tenant_id to core operational tables
ALTER TABLE inventory        ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales            ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE customer_ledgers ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE invoices         ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 0;

-- CLAUDE_CODE_DECIDES: confirm these table names match the real schema in
-- BATHCO_TEMPLATE before running. Add tenant_id to any other tenant-scoped
-- table not listed here.

-- 2. Enable Row-Level Security
ALTER TABLE inventory        ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_ledgers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices         ENABLE ROW LEVEL SECURITY;

-- 3. Isolation policy: only rows matching the current session's tenant are visible
CREATE POLICY tenant_isolation_inventory ON inventory
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::integer);

CREATE POLICY tenant_isolation_sales ON sales
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::integer);

CREATE POLICY tenant_isolation_ledgers ON customer_ledgers
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::integer);

CREATE POLICY tenant_isolation_invoices ON invoices
    FOR ALL
    USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::integer);

COMMIT;

-- HOW THE APP SETS THE SESSION VARIABLE:
-- On every incoming request, after identifying the logged-in tenant, run:
--   SET app.current_tenant_id = '<tenant_id>';
-- inside that same database connection/transaction, BEFORE running any query.
-- See middleware/tenantStatusMiddleware.js for where this hooks in.
