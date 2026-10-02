// utils/voids.js: shared bits for "voided records are left out of lists and totals".
// A voided record keeps its row; record_voids(module, record_id) says it is void (written by routes/corrections.js).
const DDL = `CREATE TABLE IF NOT EXISTS record_voids (
    id SERIAL PRIMARY KEY, module VARCHAR(40), record_id VARCHAR(100), reason TEXT NOT NULL,
    voided_by VARCHAR(100), voided_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(module, record_id))`;

const ensureVoids = pool => Promise.resolve(pool.query(DDL)).catch(() => {});

// SQL fragment: true for rows that are NOT voided. idExpr is the record's id column, e.g. 's.id'.
const notVoided = (module, idExpr) => `${idExpr}::text NOT IN (SELECT record_id FROM record_voids WHERE module = '${module}')`;

module.exports = { ensureVoids, notVoided, DDL };