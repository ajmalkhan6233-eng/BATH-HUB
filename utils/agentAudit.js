'use strict';
// AGENT AUDIT LOG: one line for every agent read, draft and owner decision.
// It never keeps message text, phone numbers or secrets: clean() masks phones (last 3 digits only) and anything
// that looks like a key, token or password before a line is stored.
const SECRET = /(?:sk-[A-Za-z0-9_-]{10,}|eyJ[\w-]{10,}\.[\w.-]+|\b(?:password|passwd|pin|token|secret|api[_-]?key)\s*[:=]\s*\S+)/gi;
const PHONE = /\+?\d[\d\s-]{6,}\d/g;

const clean = v => String(v == null ? '' : v).replace(SECRET, '[secret]').replace(PHONE, m => '***' + m.replace(/\D/g, '').slice(-3)).slice(0, 200);

const ring = [];          // newest last, capped (memory copy for tests and the owner screen)
let sink = null;          // optional function(entry) that stores a line in the database

function log({ agent, action, subject, detail } = {}) {
    const e = { at: new Date().toISOString(), agent: clean(agent), action: clean(action), subject: clean(subject), detail: clean(detail) };
    ring.push(e); if (ring.length > 500) ring.shift();
    if (sink) { try { Promise.resolve(sink(e)).catch(() => {}); } catch (_) { /* the log never breaks the work */ } }
    return e;
}

const entries = () => ring.slice();
const reset = () => { ring.length = 0; };
const setSink = fn => { sink = fn; };

// Database sink: NEW table only.
function createPgSink(pool) {
    const ready = pool.query(`CREATE TABLE IF NOT EXISTS agent_audit_log (id SERIAL PRIMARY KEY, at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, agent VARCHAR(60), action VARCHAR(40), subject VARCHAR(200), detail VARCHAR(200))`).catch(() => {});
    return async e => { await ready; await pool.query(`INSERT INTO agent_audit_log (agent, action, subject, detail) VALUES ($1,$2,$3,$4)`, [e.agent, e.action, e.subject, e.detail]); };
}

module.exports = { log, entries, reset, setSink, createPgSink, clean };
