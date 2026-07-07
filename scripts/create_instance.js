// "create fresh instance for <company>" — clones the live schema (structure only,
// zero Bathco data) into a new Postgres DB, and generates a matching branding config.
// Usage: node scripts/create_instance.js "Company Name" [db_slug]
//
// This is a LOCAL, single-machine instance factory (this deployment is one server
// process on one machine, not a cloud multi-tenant SaaS) - "fresh instance" means a
// new database + branding config ready to point a (separately started) server
// process at via DB_NAME/config env vars. It does not spin up new hosting.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
require('dotenv').config();

const companyName = process.argv[2];
if (!companyName) {
    console.error('Usage: node scripts/create_instance.js "Company Name" [db_slug]');
    process.exit(1);
}
const slug = (process.argv[3] || companyName).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
if (!slug) { console.error('Could not derive a valid db slug from the company name — pass one explicitly.'); process.exit(1); }

const SOURCE_DB = process.env.DB_NAME || 'bathco';
const PGPASSWORD = process.env.DB_PASSWORD;
const PGHOST = process.env.DB_HOST || 'localhost';
const PGUSER = process.env.DB_USER || 'postgres';
const PGPORT = process.env.DB_PORT || 5432;

const env = { ...process.env, PGPASSWORD };
const psql = (sql) => execSync(`psql -h ${PGHOST} -U ${PGUSER} -p ${PGPORT} -d postgres -c "${sql.replace(/"/g, '\\"')}"`, { env, stdio: 'pipe' }).toString();

console.log(`Creating fresh instance for "${companyName}" (db: ${slug})...`);

// 1. Create the new (empty) database.
try {
    psql(`CREATE DATABASE ${slug}`);
    console.log(`  Created database "${slug}"`);
} catch (e) {
    console.error(`  Failed to create database: ${e.message}`);
    process.exit(1);
}

// 2. Dump schema-only from the live source DB (structure, not stale schema.sql —
// the live DB has 34 tables added via ad-hoc migrations schema.sql never tracked).
const dumpPath = path.join(__dirname, '..', `_schema_export_${Date.now()}.sql`);
execSync(`pg_dump -h ${PGHOST} -U ${PGUSER} -p ${PGPORT} --schema-only --no-owner --no-privileges -d ${SOURCE_DB} -f "${dumpPath}"`, { env });
console.log(`  Exported schema from "${SOURCE_DB}"`);

// 3. Apply the schema to the new DB.
execSync(`psql -h ${PGHOST} -U ${PGUSER} -p ${PGPORT} -d ${slug} -f "${dumpPath}"`, { env, stdio: 'pipe' });
fs.unlinkSync(dumpPath);
console.log(`  Applied schema to "${slug}" — zero data copied, structure only`);

// 4. Seed the feature_flags registry the same way the source instance was seeded.
execSync(`node "${path.join(__dirname, 'seed_feature_flags.js')}"`, {
    env: { ...env, DB_NAME: slug }, stdio: 'inherit',
});

// 5. Generate a branding config from the template, customer-specific fields blank/default.
const template = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'default.branding.json'), 'utf8'));
const branding = {
    ...template,
    instance_id: slug,
    company_name: companyName,
    legal_name: companyName,
    tagline: '',
    logo_url: '/vendor/default-logo.png',
    db_name: slug,
};
const cfgPath = path.join(__dirname, '..', 'config', `${slug}.branding.json`);
fs.writeFileSync(cfgPath, JSON.stringify(branding, null, 2));
console.log(`  Wrote branding config: config/${slug}.branding.json`);

console.log('');
console.log(`Fresh instance ready for "${companyName}".`);
console.log(`To run it: set DB_NAME=${slug} and copy config/${slug}.branding.json to config/active.branding.json`);
console.log(`before starting a server process (on a different PORT if running alongside another instance).`);
