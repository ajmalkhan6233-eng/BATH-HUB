// Seeds ONE fictional demo client into the apex tenants table (+ its LAYLA
// config row) so nothing is empty on first run. Idempotent — re-running never
// duplicates. All values are placeholders, never real business data.
// Usage: node scripts/seed_demo_tenant.js   (after scripts/migrate_apex.js)
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port: process.env.DB_PORT||5432, database: process.env.DB_NAME||'bathco_template', user: process.env.DB_USER||'postgres', password: process.env.DB_PASSWORD });

async function main() {
    await p.query(
        `INSERT INTO tenants (shop_name, owner_name, industry_type, whatsapp_number, whatsapp_consent, package_tier, subdomain, status, trial_expires_at)
         VALUES ('Demo Hardware Stores', 'Demo Owner', 'hardware', '94770000000', true, 'Growth', 'demo', 'TRIAL', now() + interval '30 days')
         ON CONFLICT (subdomain) DO NOTHING`
    );
    const { rows } = await p.query(`SELECT id, shop_name, status FROM tenants WHERE subdomain = 'demo'`);
    const tenant = rows[0];

    await p.query(
        `INSERT INTO layla_configs (tenant_id, whatsapp_number, capability_tier, is_active, onboarding_stage)
         VALUES ($1, '94770000000', 'standard', false, 'not_started')
         ON CONFLICT (tenant_id) DO NOTHING`,
        [tenant.id]
    );

    console.log(`Demo tenant ready: id=${tenant.id} "${tenant.shop_name}" (${tenant.status}), layla_configs row present.`);
    console.log(`APEX_TENANT_ID in .env should be ${tenant.id}.`);
    await p.end();
}

main().catch(err => { console.error('Seed failed:', err.message); p.end(); process.exit(1); });
