CREATE TABLE IF NOT EXISTS package_config (
    id         SERIAL PRIMARY KEY,
    tier_name  VARCHAR(50) NOT NULL UNIQUE,
    price_lkr  NUMERIC(10,2) NOT NULL,
    features   JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_addon   BOOLEAN NOT NULL DEFAULT false,
    is_popular BOOLEAN NOT NULL DEFAULT false
);

INSERT INTO package_config (tier_name, price_lkr, features, is_addon, is_popular) VALUES
('Starter',       5000.00,  '["POS + Invoicing", "Single user"]', false, false),
('Growth',        15000.00, '["+ Inventory", "+ Credit tracking", "+ Staff commissions", "Multi-user"]', false, true),
('Command',       30000.00, '["Everything in Growth", "Full ERP", "Apex reporting"]', false, false),
('LAYLA Add-on',  4000.00,  '["WhatsApp AI assistant", "Attachable to any tier"]', true, false)
ON CONFLICT (tier_name) DO NOTHING;

-- CLAUDE_CODE_DECIDES: adjust prices here anytime — the application must
-- always read prices from this table, never hardcode them in JS.
