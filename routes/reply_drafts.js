// routes/reply_drafts.js
// M6 REPLY DRAFTS: the agent drafts replies to customer messages; Aj approves each one.
//
// DRAFTS ONLY. This module has no WhatsApp or email code and never sends anything.
// 'sent' is just a note that a person sent it by hand, and it is only allowed after
// Aj approved that exact text. Editing an approved draft sends it back to 'draft'.
// Anything that looks like a price is flagged (has_price) for Aj's extra attention;
// every reply needs approval regardless. Owner/admin only. Own table `reply_drafts`.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const CHANNELS = ['whatsapp', 'email'];
const STATUSES = ['draft', 'approved', 'sent', 'rejected'];

// Rs 4,500 / LKR 4500 / 4500/= / 1,200 Rs / per sqm / per box ...
const PRICE_RE = /\b(?:rs\.?|lkr)\s*\d|\d[\d,]*\s*(?:\/=|rs\b|lkr\b|per\s*(?:sq|sqm|box|piece|pc))|\bper\s*(?:sq\s*ft|sqft|sqm|sq\.?\s*m)\b/i;
const looksLikePrice = t => PRICE_RE.test(String(t || ''));

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();

function createRouter(pool) {
    const router = express.Router();

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS reply_drafts (
        id SERIAL PRIMARY KEY,
        channel TEXT NOT NULL,
        customer_ref TEXT NOT NULL DEFAULT '',
        incoming_text TEXT NOT NULL DEFAULT '',
        draft_text TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        approved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(e => console.error('[reply_drafts] init failed:', e.message));

    const out = r => ({ ...r, has_price: looksLikePrice(r.draft_text) });
    const load = async id => (await pool.query(`SELECT * FROM reply_drafts WHERE id = $1`, [Number(id) || 0])).rows[0];

    router.get('/reply-drafts', ownerOnly, async (req, res) => {
        try {
            await ready;
            const st = clean(req.query.status);
            if (st && !STATUSES.includes(st)) return res.status(400).json({ error: 'status must be one of: ' + STATUSES.join(', ') });
            const r = await pool.query(`SELECT * FROM reply_drafts WHERE ($1 = '' OR status = $1) ORDER BY id DESC LIMIT 200`, [st]);
            res.json(r.rows.map(out));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Always created as 'draft'; a status can't be supplied.
    router.post('/reply-drafts', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const channel = clean(b.channel), draft = clean(b.draft_text);
            if (!CHANNELS.includes(channel)) return res.status(400).json({ error: 'channel must be one of: ' + CHANNELS.join(', ') });
            if (!draft) return res.status(400).json({ error: 'draft_text is required' });
            const r = await pool.query(
                `INSERT INTO reply_drafts (channel, customer_ref, incoming_text, draft_text, status) VALUES ($1,$2,$3,$4,'draft') RETURNING *`,
                [channel, clean(b.customer_ref), clean(b.incoming_text), draft]);
            res.status(201).json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Edit the text. Any edit puts it back to 'draft' and clears the approval.
    router.put('/reply-drafts/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const old = await load(req.params.id);
            if (!old) return res.status(404).json({ error: 'Draft not found' });
            if (old.status === 'sent') return res.status(409).json({ error: 'Already sent; create a new draft' });
            const draft = req.body && req.body.draft_text !== undefined ? clean(req.body.draft_text) : old.draft_text;
            if (!draft) return res.status(400).json({ error: 'draft_text cannot be empty' });
            const r = await pool.query(`UPDATE reply_drafts SET draft_text=$1, status='draft', approved_at=NULL WHERE id=$2 RETURNING *`, [draft, old.id]);
            res.json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Status moves: draft -> approved | rejected ; approved -> sent ; rejected -> draft (via edit).
    async function move(req, res, from, to) {
        try {
            await ready;
            const old = await load(req.params.id);
            if (!old) return res.status(404).json({ error: 'Draft not found' });
            if (!from.includes(old.status)) return res.status(409).json({ error: `A ${old.status} draft cannot become ${to}` });
            const r = await pool.query(
                `UPDATE reply_drafts SET status=$1, approved_at = CASE WHEN $1='approved' THEN NOW() WHEN $1='rejected' THEN NULL ELSE approved_at END WHERE id=$2 RETURNING *`,
                [to, old.id]);
            res.json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    }
    router.post('/reply-drafts/:id/approve', ownerOnly, (req, res) => move(req, res, ['draft'], 'approved'));
    router.post('/reply-drafts/:id/reject', ownerOnly, (req, res) => move(req, res, ['draft', 'approved'], 'rejected'));
    // Records that a person sent it by hand. This system sends nothing.
    router.post('/reply-drafts/:id/mark-sent', ownerOnly, (req, res) => move(req, res, ['approved'], 'sent'));

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
module.exports.looksLikePrice = looksLikePrice;
