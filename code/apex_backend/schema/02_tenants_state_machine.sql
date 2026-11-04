-- Tenant status state machine

CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'TERMINATED');

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

-- CLAUDE_CODE_DECIDES: confirm subdomain length/charset here matches
-- validateSubdomain() rules (3-30 chars, a-z0-9- only).
