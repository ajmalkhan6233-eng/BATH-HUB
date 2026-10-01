// DEV / TEST ONLY: loads scripts/dev/test_schema.sql into the database named in .env, but ONLY if it is a throwaway
// database (its name contains "test") and is UTF8. It refuses anything else, so it can never touch a real shop database.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

(async () => {
    const c = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
    await c.connect();
    const { db, enc } = (await c.query(`SELECT current_database() AS db, pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = current_database()`)).rows[0];
    if (!/test/i.test(db)) { console.error(`Refusing: "${db}" is not a throwaway test database (its name must contain "test").`); process.exit(1); }
    if (enc !== 'UTF8') { console.error(`Refusing: "${db}" is ${enc}; Sinhala/Tamil need UTF8. Recreate it with ENCODING 'UTF8' TEMPLATE template0.`); process.exit(1); }
    await c.query(fs.readFileSync(path.join(__dirname, 'test_schema.sql'), 'utf8'));
    console.log(`Test schema loaded into "${db}".`);
    await c.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
