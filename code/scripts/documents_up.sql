-- Documents module: NEW tables only (the app also creates them by itself at start-up with CREATE TABLE IF NOT EXISTS; this file is for a manual run).
-- Reverse: scripts/documents_down.sql
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY, type VARCHAR(40) NOT NULL, title VARCHAR(200) NOT NULL, period VARCHAR(40) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(), path TEXT NOT NULL, sha256 VARCHAR(64) NOT NULL, created_by VARCHAR(100),
    format VARCHAR(8) NOT NULL DEFAULT 'pdf', bytes INT);
CREATE TABLE IF NOT EXISTS document_recipients (
    id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, role VARCHAR(20) NOT NULL DEFAULT 'contact', phone VARCHAR(20) NOT NULL,
    allowed_types TEXT NOT NULL DEFAULT '[]', active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS document_sends (
    id SERIAL PRIMARY KEY, document_id INT, document_title VARCHAR(200), recipient_id INT, purpose VARCHAR(40) NOT NULL DEFAULT 'share',
    idempotency_key VARCHAR(100) UNIQUE, status VARCHAR(20) NOT NULL, to_last3 VARCHAR(3), detail TEXT, requested_by VARCHAR(100),
    queue_id INT, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS document_quarantine (
    id SERIAL PRIMARY KEY, file_name VARCHAR(80) NOT NULL, ext VARCHAR(8) NOT NULL, mime VARCHAR(60) NOT NULL, bytes INT NOT NULL,
    sha256 VARCHAR(64) NOT NULL, original_name VARCHAR(200) NOT NULL DEFAULT '', source VARCHAR(30) NOT NULL DEFAULT 'upload',
    from_ref VARCHAR(100) NOT NULL DEFAULT '', caption VARCHAR(300) NOT NULL DEFAULT '', suggested_place VARCHAR(30),
    suggested_reason VARCHAR(200) NOT NULL DEFAULT '', status VARCHAR(20) NOT NULL DEFAULT 'quarantined', inbox_id INT,
    created_at TIMESTAMPTZ DEFAULT NOW(), decided_at TIMESTAMPTZ, decided_by VARCHAR(100));
