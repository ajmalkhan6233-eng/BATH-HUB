// Railway go-live hardening: create a NON-SUPERUSER app role so the audit_log
// immutability REVOKE actually binds (Railway's default `postgres` user is a
// superuser and bypasses ACLs entirely).
//
// RUN AT UNPAUSE — the Railway Postgres must be online to accept SQL:
//   1. railway redeploy -s Postgres -y --from-source     (bring the DB up)
//   2. $env:RAILWAY_DB_URL = <DATABASE_PUBLIC_URL from `railway variables -s Postgres --json`>
//   3. node scripts/railway_harden_db.js
//   4. Set the printed DB_USER / DB_PASSWORD on apex-app:
//      railway variables -s apex-app --set "DB_USER=apex_app" --set "DB_PASSWORD=<printed>" --skip-deploys
//   5. railway up -s apex-app -d
//
// Idempotent: re-running resets the role's password and re-applies the grants.
const { Client } = require('pg');
const crypto = require('crypto');

const url = process.env.RAILWAY_DB_URL;
if (!url) { console.error('Set RAILWAY_DB_URL to the apex-platform DATABASE_PUBLIC_URL first.'); process.exit(1); }
if (/bathco-production|alert-cooperation/i.test(url)) { console.error('Refusing: this URL looks like the LIVE system.'); process.exit(1); }

const ROLE = 'apex_app';
const password = crypto.randomBytes(24).toString('base64url');

(async () => {
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await c.connect();
    // password interpolation: base64url alphabet only (no quotes possible)
    await c.query(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}') THEN
            CREATE ROLE ${ROLE} LOGIN PASSWORD '${password}';
        ELSE
            ALTER ROLE ${ROLE} WITH LOGIN PASSWORD '${password}';
        END IF;
    END $$;`);
    await c.query(`GRANT CONNECT ON DATABASE ${JSON.stringify(new URL(url).pathname.slice(1)).replace(/"/g, '')} TO ${ROLE};`);
    await c.query(`GRANT USAGE, CREATE ON SCHEMA public TO ${ROLE};`);
    await c.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${ROLE};`);
    await c.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${ROLE};`);
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${ROLE};`);
    await c.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${ROLE};`);
    // THE POINT of this role: audit_log becomes append-only for the app.
    await c.query(`REVOKE UPDATE, DELETE ON audit_log FROM ${ROLE};`);
    // sanity: prove the lock binds
    const check = await c.query(
        `SELECT has_table_privilege($1,'audit_log','UPDATE') AS can_update,
                has_table_privilege($1,'audit_log','INSERT') AS can_insert`, [ROLE]);
    await c.end();
    console.log(`Role ${ROLE} ready. audit_log: can_insert=${check.rows[0].can_insert} can_update=${check.rows[0].can_update} (must be t / f)`);
    console.log(`\nSet these on apex-app (do not commit anywhere):`);
    console.log(`  railway variables -s apex-app --set "DB_USER=${ROLE}" --set "DB_PASSWORD=${password}" --skip-deploys`);
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
