require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const p = new Pool({ host: process.env.DB_HOST||'localhost', port: process.env.DB_PORT||5432, database: process.env.DB_NAME||'bathco_template', user: process.env.DB_USER||'postgres', password: process.env.DB_PASSWORD });

const sql = `CREATE TABLE IF NOT EXISTS grn_records (
    id               SERIAL PRIMARY KEY,
    grn_number       VARCHAR(100),
    supplier_id      INT,
    supplier_name    VARCHAR(200),
    grn_date         DATE,
    item_description TEXT,
    quantity         NUMERIC(12,3),
    unit_cost        NUMERIC(12,2),
    total_amount     NUMERIC(14,2),
    source_file_path TEXT,
    status           VARCHAR(20) DEFAULT 'PENDING_REVIEW',
    ocr_raw          JSONB,
    notes            TEXT,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`;

p.query(sql)
 .then(() => p.query('SELECT COUNT(*) FROM grn_records'))
 .then(r  => { console.log('grn_records table OK — rows:', r.rows[0].count); process.exit(0); })
 .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
