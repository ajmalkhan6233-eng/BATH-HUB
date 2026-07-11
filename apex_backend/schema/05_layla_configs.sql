CREATE TYPE layla_capability_tier AS ENUM ('basic', 'standard', 'full');
CREATE TYPE layla_onboarding_stage AS ENUM ('not_started', 'learning', 'trained');

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
-- full     = + report generation (this is your own shop's current ceiling)
