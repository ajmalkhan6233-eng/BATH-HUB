// One-off migration: staging table for the WhatsApp photo → OCR → confirm pipeline.
// Deliberately NOT writing straight into daily_summary (the live financial ledger
// every dashboard/audit query reads) until the sender replies YES - a rejected or
// abandoned draft must never be visible as real data. See audit.md item 3.
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
    user: process.env.DB_USER, password: process.env.DB_PASSWORD,
});

async function main() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_draft_entries (
            id SERIAL PRIMARY KEY,
            from_number VARCHAR(30) NOT NULL,
            photo_path TEXT NOT NULL,
            report_date DATE,
            total_sale NUMERIC,
            cash_sale NUMERIC,
            card_sale NUMERIC,
            online_sale NUMERIC,
            credit_sale NUMERIC,
            total_expenses NUMERIC,
            expense_items TEXT,
            confidence VARCHAR(10),
            ocr_notes TEXT,
            ocr_raw JSONB,
            status VARCHAR(20) NOT NULL DEFAULT 'PENDING_CONFIRM',
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            confirmed_at TIMESTAMP
        );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_wa_draft_pending ON whatsapp_draft_entries (from_number, status);`);
    console.log('whatsapp_draft_entries table ready.');
    await pool.end();
}
main().catch(e => { console.error(e); process.exit(1); });
