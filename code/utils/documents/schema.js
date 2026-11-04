'use strict';
// Documents module tables. NEW tables only (additive). Same text as scripts/documents_up.sql; reverse: scripts/documents_down.sql.
// receipt_queue is created here only with the exact definition the receipt code already uses (CREATE TABLE IF NOT EXISTS: no change if it exists).
const STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS documents (
        id SERIAL PRIMARY KEY, type VARCHAR(40) NOT NULL, title VARCHAR(200) NOT NULL, period VARCHAR(40) NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ DEFAULT NOW(), path TEXT NOT NULL, sha256 VARCHAR(64) NOT NULL, created_by VARCHAR(100),
        format VARCHAR(8) NOT NULL DEFAULT 'pdf', bytes INT)`,
    `CREATE TABLE IF NOT EXISTS document_recipients (
        id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'contact', phone VARCHAR(20) NOT NULL,
        allowed_types TEXT NOT NULL DEFAULT '[]', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS document_sends (
        id SERIAL PRIMARY KEY, document_id INT, document_title VARCHAR(200), recipient_id INT, purpose VARCHAR(40) NOT NULL DEFAULT 'share',
        idempotency_key VARCHAR(100) UNIQUE, status VARCHAR(20) NOT NULL, to_last3 VARCHAR(3), detail TEXT, requested_by VARCHAR(100),
        queue_id INT, created_at TIMESTAMPTZ DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS document_quarantine (
        id SERIAL PRIMARY KEY, file_name VARCHAR(80) NOT NULL, ext VARCHAR(8) NOT NULL, mime VARCHAR(60) NOT NULL, bytes INT NOT NULL,
        sha256 VARCHAR(64) NOT NULL, original_name VARCHAR(200) NOT NULL DEFAULT '', source VARCHAR(30) NOT NULL DEFAULT 'upload',
        from_ref VARCHAR(100) NOT NULL DEFAULT '', caption VARCHAR(300) NOT NULL DEFAULT '', suggested_place VARCHAR(30),
        suggested_reason VARCHAR(200) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'quarantined', inbox_id INT,
        created_at TIMESTAMPTZ DEFAULT NOW(), decided_at TIMESTAMPTZ, decided_by VARCHAR(100))`,
];
const RECEIPT_QUEUE = `CREATE TABLE IF NOT EXISTS receipt_queue (
        id SERIAL PRIMARY KEY, customer_phone VARCHAR(30) NOT NULL, sale_reference TEXT, amount NUMERIC(12,2),
        status VARCHAR(20) NOT NULL DEFAULT 'queued', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, sent_at TIMESTAMP)`;

const ready = new WeakMap();   // once per pool
function ensureTables(pool) {
    if (!ready.has(pool)) {
        ready.set(pool, (async () => { for (const s of [...STATEMENTS, RECEIPT_QUEUE]) await pool.query(s); })()
            .catch(e => { ready.delete(pool); console.error('[documents] migration failed:', e.message); throw e; }));
    }
    return ready.get(pool);
}
module.exports = { STATEMENTS, RECEIPT_QUEUE, ensureTables };
