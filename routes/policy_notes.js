// routes/policy_notes.js
// M7 POLICY WATCH: notes on import rules (duty, cess, anti-dumping, bans) that move tile
// prices. Owner/admin only. Own table `policy_notes`.
// No rates are seeded: current rates are NOT verified. Every note starts unverified
// (verified = false) and must be confirmed against the source before any number from it is used.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const TOPICS = ['import duty', 'cess', 'anti-dumping', 'import ban'];
const RISKS = ['low', 'med', 'high'];

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
const isUrl = s => /^https?:\/\/[^\s]+$/i.test(s);
const dateStr = v => v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
    : String(v).slice(0, 10);

function createRouter(pool) {
    const router = express.Router();

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS policy_notes (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL,
        topic TEXT NOT NULL,
        summary TEXT NOT NULL,
        source_url TEXT NOT NULL DEFAULT '',
        price_risk TEXT NOT NULL DEFAULT 'med',
        verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(e => console.error('[policy_notes] init failed:', e.message));

    const out = r => ({ ...r, date: dateStr(r.date) });

    // Returns { error } or { fields } for a full/partial body merged over `base`.
    function build(b, base) {
        const f = { ...base };
        for (const k of ['date', 'topic', 'summary', 'source_url', 'price_risk']) if (b[k] !== undefined) f[k] = clean(b[k]);
        if (b.verified !== undefined) {
            if (typeof b.verified !== 'boolean') return { error: 'verified must be true or false' };
            f.verified = b.verified;
        }
        if (!f.date || !isDate(f.date)) return { error: 'date must be YYYY-MM-DD' };
        if (!TOPICS.includes(f.topic)) return { error: 'topic must be one of: ' + TOPICS.join(', ') };
        if (!f.summary) return { error: 'summary is required' };
        if (!RISKS.includes(f.price_risk)) return { error: 'price_risk must be one of: ' + RISKS.join(', ') };
        if (f.source_url && !isUrl(f.source_url)) return { error: 'source_url must start with http:// or https://' };
        if (f.verified && !f.source_url) return { error: 'Add the source link before marking a note verified' };
        return { fields: f };
    }

    router.get('/policy-notes', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`SELECT * FROM policy_notes ORDER BY date DESC, id DESC LIMIT 300`);
            res.json(r.rows.map(out));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/policy-notes', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = { price_risk: 'med', source_url: '', ...(req.body || {}) };
            const { error, fields: f } = build(b, { verified: false });
            if (error) return res.status(400).json({ error });
            const r = await pool.query(
                `INSERT INTO policy_notes (date, topic, summary, source_url, price_risk, verified) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                [f.date, f.topic, f.summary, f.source_url, f.price_risk, f.verified]);
            res.status(201).json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/policy-notes/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const cur = await pool.query(`SELECT * FROM policy_notes WHERE id = $1`, [Number(req.params.id) || 0]);
            const old = cur.rows[0];
            if (!old) return res.status(404).json({ error: 'Note not found' });
            const b = req.body || {};
            // A changed summary or source needs re-checking: drop the verified tick unless told otherwise.
            const base = { ...out(old), verified: old.verified };
            if ((b.summary !== undefined || b.source_url !== undefined) && b.verified === undefined) base.verified = false;
            const { error, fields: f } = build(b, base);
            if (error) return res.status(400).json({ error });
            const r = await pool.query(
                `UPDATE policy_notes SET date=$1, topic=$2, summary=$3, source_url=$4, price_risk=$5, verified=$6 WHERE id=$7 RETURNING *`,
                [f.date, f.topic, f.summary, f.source_url, f.price_risk, f.verified, old.id]);
            res.json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/policy-notes/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`DELETE FROM policy_notes WHERE id = $1 RETURNING id`, [Number(req.params.id) || 0]);
            if (!r.rows[0]) return res.status(404).json({ error: 'Note not found' });
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

let _router;
module.exports = function (req, res, next) {
    if (!_router) _router = createRouter(new Pool({
        host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    }));
    _router(req, res, next);
};
module.exports.createRouter = createRouter;
