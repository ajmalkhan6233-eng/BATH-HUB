// routes/enquiries.js
// M2 ENQUIRY TRACKER: log every enquiry and where it came from, so we can see
// whether TikTok / live actually brings customers. Owner/admin only (the global
// auth middleware already blocks staff from /api/*; checked again here).
// Own table `enquiries`; nothing else is touched.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const rateLimit = require('express-rate-limit');

const CHANNELS = ['tiktok', 'facebook', 'whatsapp', 'walk-in', 'google', 'website', 'other'];
const STATUSES = ['new', 'quoted', 'won', 'lost'];

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();

// Public website form: no login, so it is strictly limited. Plain text only, short fields, a hidden trap field for bots,
// and a few messages per visitor per hour. It only ever ADDS one 'new' enquiry (channel 'website'); it can read nothing.
const noControl = (v, max) => clean(v).replace(/[\u0000-\u001F\u007F<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function createRouter(pool, { publicPerHour = 5 } = {}) {
    const router = express.Router();

    const publicLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, limit: publicPerHour, standardHeaders: false, legacyHeaders: false,
        message: { error: 'Too many messages from this device. Please WhatsApp us instead.' },
    });
    router.post('/public/enquiry', publicLimiter, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            if (noControl(b.company_site, 50)) return res.status(201).json({ ok: true });      // trap field: bots fill it, people never see it; pretend success
            const name = noControl(b.name, 80), message = noControl(b.message, 500), product = noControl(b.product, 120);
            const phone = noControl(b.phone, 20).replace(/[^\d+ ]/g, '');
            if (!name) return res.status(400).json({ error: 'Please enter your name.' });
            if (phone.replace(/\D/g, '').length < 7 || phone.replace(/\D/g, '').length > 15) return res.status(400).json({ error: 'Please enter a phone number we can call or WhatsApp.' });
            const notes = `Website enquiry. Name: ${name}. Phone: ${phone}.${message ? ' Message: ' + message : ''}`;
            await pool.query(`INSERT INTO enquiries (channel, product_interest, how_found_us, status, notes) VALUES ('website', $1, 'Royal Bath Hub website', 'new', $2)`, [product || null, notes]);
            res.status(201).json({ ok: true });
        } catch (e) { res.status(500).json({ error: 'Could not send. Please WhatsApp us.' }); }
    });

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS enquiries (
        id SERIAL PRIMARY KEY,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        channel TEXT NOT NULL,
        product_interest TEXT,
        how_found_us TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(e => console.error('[enquiries] init failed:', e.message));

    router.get('/enquiries', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`SELECT * FROM enquiries ORDER BY date DESC, id DESC LIMIT 200`);
            res.json(r.rows);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/enquiries', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const channel = clean(b.channel), status = clean(b.status) || 'new';
            const date = clean(b.date) || null;
            if (!CHANNELS.includes(channel)) return res.status(400).json({ error: 'channel must be one of: ' + CHANNELS.join(', ') });
            if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of: ' + STATUSES.join(', ') });
            if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
            const r = await pool.query(
                `INSERT INTO enquiries (date, channel, product_interest, how_found_us, status, notes)
                 VALUES (COALESCE($1::date, CURRENT_DATE), $2, $3, $4, $5, $6) RETURNING *`,
                [date, channel, clean(b.product_interest), clean(b.how_found_us), status, clean(b.notes)]);
            res.status(201).json(r.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/enquiries/:id/status', ownerOnly, async (req, res) => {
        try {
            await ready;
            const status = clean(req.body && req.body.status);
            if (!STATUSES.includes(status)) return res.status(400).json({ error: 'status must be one of: ' + STATUSES.join(', ') });
            const r = await pool.query(`UPDATE enquiries SET status = $1 WHERE id = $2 RETURNING *`, [status, Number(req.params.id) || 0]);
            if (!r.rows[0]) return res.status(404).json({ error: 'Enquiry not found' });
            res.json(r.rows[0]);
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Which channels turn enquiries into sales? Per channel over the last N weeks (default 8):
    // total, how many are won / lost / quoted / still new, and won as a % of all enquiries from that channel.
    router.get('/enquiries/summary', ownerOnly, async (req, res) => {
        try {
            await ready;
            const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 1), 52);
            const r = await pool.query(`SELECT channel, status FROM enquiries WHERE date >= CURRENT_DATE - ($1::int * 7)`, [weeks]);
            const by = {};
            for (const x of r.rows) {
                const c = by[x.channel] || (by[x.channel] = { channel: x.channel, total: 0, new: 0, quoted: 0, won: 0, lost: 0 });
                c.total++;
                c[x.status] = (c[x.status] || 0) + 1;
            }
            const channels = Object.values(by)
                .map(c => ({ ...c, won_pct: c.total ? Math.round((c.won / c.total) * 1000) / 10 : 0 }))
                .sort((a, b) => b.won - a.won || b.total - a.total || a.channel.localeCompare(b.channel));
            const total = channels.reduce((a, c) => a + c.total, 0), won = channels.reduce((a, c) => a + c.won, 0);
            res.json({ weeks, total, won, won_pct: total ? Math.round((won / total) * 1000) / 10 : 0, channels });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Weekly counts by channel (weeks start Monday), newest week first.
    router.get('/enquiries/weekly', ownerOnly, async (req, res) => {
        try {
            await ready;
            const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 1), 52);
            const r = await pool.query(
                `SELECT date, channel FROM enquiries WHERE date >= CURRENT_DATE - ($1::int * 7)`, [weeks]);
            const counts = {};
            for (const x of r.rows) {
                const d = x.date instanceof Date
                    ? new Date(Date.UTC(x.date.getFullYear(), x.date.getMonth(), x.date.getDate()))
                    : new Date(String(x.date).slice(0, 10) + 'T00:00:00Z');
                d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back to Monday
                const k = d.toISOString().slice(0, 10) + '|' + x.channel;
                counts[k] = (counts[k] || 0) + 1;
            }
            res.json(Object.entries(counts).map(([k, n]) => { const [week_start, channel] = k.split('|'); return { week_start, channel, n }; })
                .sort((a, b) => b.week_start.localeCompare(a.week_start) || a.channel.localeCompare(b.channel)));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    return router;
}

let _router;
module.exports = function (req, res, next) {
    if (!_router) _router = createRouter(require('../utils/pool'));
    _router(req, res, next);
};
module.exports.createRouter = createRouter;
module.exports.CHANNELS = CHANNELS;
