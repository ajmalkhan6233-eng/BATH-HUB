'use strict';
// EGRESS GATE: nothing an agent writes leaves by itself. Every outgoing message becomes a DRAFT in agent_outbox.
// Only an owner decision (approve()) hands it to the real sender, once. Reject keeps it unsent.
// gateTransport(inner) wraps a WhatsApp transport so its sendText/sendImage/sendDocument only make drafts.
const audit = require('./agentAudit');
const { stripExfil } = require('./untrustedText');

const digits = v => String(v == null ? '' : v).replace(/\D/g, '');

function createMemoryStore() {
    const rows = []; let n = 0;
    return {
        async insert(d) { const r = { id: ++n, status: 'draft', created_at: new Date().toISOString(), ...d }; rows.push(r); return r; },
        async get(id) { return rows.find(r => r.id === Number(id)) || null; },
        async claim(id, from, to, by) { const r = rows.find(x => x.id === Number(id)); if (!r || r.status !== from) return null; r.status = to; r.decided_by = by; return r; },
        async finish(id, status, detail) { const r = rows.find(x => x.id === Number(id)); if (r) { r.status = status; r.detail = detail; } return r; },
        async list(status) { return rows.filter(r => !status || r.status === status); },
    };
}

function createPgStore(pool) {
    const ready = pool.query(`CREATE TABLE IF NOT EXISTS agent_outbox (id SERIAL PRIMARY KEY, agent VARCHAR(60) NOT NULL, channel VARCHAR(30), kind VARCHAR(20) NOT NULL, to_phone VARCHAR(40), payload JSONB, origin VARCHAR(20), status VARCHAR(12) NOT NULL DEFAULT 'draft', decided_by VARCHAR(100), detail TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, decided_at TIMESTAMP)`).catch(() => {});
    const row = r => r && ({ ...r, to: r.to_phone, payload: typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload });
    return {
        async insert(d) { await ready; const r = await pool.query(`INSERT INTO agent_outbox (agent, channel, kind, to_phone, payload, origin) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [d.agent, d.channel, d.kind, d.to, JSON.stringify(d.payload), d.origin]); return row(r.rows[0]); },
        async get(id) { await ready; return row((await pool.query(`SELECT * FROM agent_outbox WHERE id = $1`, [id])).rows[0]); },
        async claim(id, from, to, by) { await ready; return row((await pool.query(`UPDATE agent_outbox SET status = $3, decided_by = $4, decided_at = CURRENT_TIMESTAMP WHERE id = $1 AND status = $2 RETURNING *`, [id, from, to, by])).rows[0]); },
        async finish(id, status, detail) { await ready; return row((await pool.query(`UPDATE agent_outbox SET status = $2, detail = $3 WHERE id = $1 RETURNING *`, [id, status, String(detail || '').slice(0, 300)])).rows[0]); },
        async list(status) { await ready; return (await pool.query(`SELECT id, agent, channel, kind, to_phone, payload, origin, status, created_at FROM agent_outbox ${status ? 'WHERE status = $1' : ''} ORDER BY id DESC LIMIT 200`, status ? [status] : [])).rows.map(row); },
    };
}

function createGate({ store = createMemoryStore() } = {}) {
    const senders = {};   // agent name -> the real transport (used only by approve)

    async function draft({ agent, channel = 'whatsapp', kind = 'text', to, payload = {}, origin = 'customer' }) {
        if (!agent) return { ok: false, error: 'no agent name' };
        const p = { ...payload };
        if (kind === 'text') { const s = stripExfil(p.text); p.text = s.text; if (s.removed) audit.log({ agent, action: 'stripped-exfil', subject: 'outgoing-text' }); }
        const d = await store.insert({ agent, channel, kind, to: digits(to), payload: p, origin });
        audit.log({ agent, action: 'draft', subject: 'draft#' + d.id, detail: `${kind} to ${to}, origin ${origin}` });
        return { ok: true, drafted: true, id: d.id };
    }

    async function approve(id, by) {
        if (!by) return { ok: false, status: 400, error: 'who is approving?' };
        const d = await store.claim(id, 'draft', 'sending', by);          // one winner: a second approve finds it already taken
        if (!d) return { ok: false, status: 409, error: 'Not a waiting draft (already decided or unknown).' };
        audit.log({ agent: d.agent, action: 'approve', subject: 'draft#' + d.id, detail: 'by ' + by });
        const t = senders[d.agent];
        if (!t) { await store.finish(d.id, 'failed', 'no sender registered'); return { ok: false, status: 502, error: 'No sender is connected for ' + d.agent };}
        const send = d.kind === 'image' ? t.sendImage : d.kind === 'document' ? t.sendDocument : (to, p) => t.sendText(to, p.text);
        let r; try { r = await send(d.to, d.payload); } catch (e) { r = { ok: false, error: e.message }; }
        await store.finish(d.id, r && r.ok ? 'sent' : 'failed', r && (r.error || (r.dryRun ? 'dry run' : '')));
        return { ok: !!(r && r.ok), status: r && r.ok ? 200 : 502, dryRun: !!(r && r.dryRun), error: r && r.error };
    }

    async function reject(id, by) {
        const d = await store.claim(id, 'draft', 'rejected', by || 'owner');
        if (!d) return { ok: false, status: 409, error: 'Not a waiting draft.' };
        audit.log({ agent: d.agent, action: 'reject', subject: 'draft#' + d.id, detail: 'by ' + (by || 'owner') });
        return { ok: true };
    }

    // Wrap a transport: same three send functions, but they only make drafts. The real one is kept for approve().
    function gateTransport(inner, agent) {
        senders[agent] = inner;
        const mk = kind => (to, p) => draft({ agent, kind, to, payload: kind === 'text' ? { text: p } : (p || {}) });
        return { name: 'gated:' + inner.name, sendText: mk('text'), sendImage: mk('image'), sendDocument: mk('document'), inner };
    }

    return { draft, approve, reject, list: s => store.list(s), gateTransport, senders };
}

let _default;
function getDefaultGate(pool) {
    if (!_default) _default = createGate({ store: createPgStore(pool || require('./pool')) });
    return _default;
}

module.exports = { createGate, createMemoryStore, createPgStore, getDefaultGate };
