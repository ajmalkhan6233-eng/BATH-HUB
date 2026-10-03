// routes/content_calendar.js
// M3 CONTENT CALENDAR: plan TikTok / live / Facebook content. The agent drafts
// scripts and captions (script_draft); Aj/staff film and post by hand.
// NOTHING is ever posted automatically: there is no TikTok integration here, and
// status 'posted' only records that a person posted it (optionally with the URL).
// Owner/admin only. Own table `content_posts`; nothing else is touched.

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

const PLATFORMS = ['tiktok', 'live', 'facebook'];
const TYPES = ['price-per-sqm', 'room idea', 'delivery/job clip', 'live'];
const STATUSES = ['idea', 'scripted', 'filmed', 'posted'];

// Default weekly plan: 3 videos (Mon, Wed, Fri) + 1 live (Sat).
const DEFAULT_PLAN = [
    { day: 0, platform: 'tiktok', type: 'price-per-sqm' },
    { day: 2, platform: 'tiktok', type: 'room idea' },
    { day: 4, platform: 'tiktok', type: 'delivery/job clip' },
    { day: 5, platform: 'live', type: 'live' },
];

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z'));
const dateStr = v => v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
    : String(v).slice(0, 10);

function mondayOf(s) {
    const d = new Date(s + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d;
}

function createRouter(pool) {
    const router = express.Router();

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS content_posts (
        id SERIAL PRIMARY KEY,
        planned_date DATE NOT NULL,
        platform TEXT NOT NULL,
        type TEXT NOT NULL,
        script_draft TEXT,
        status TEXT NOT NULL DEFAULT 'idea',
        posted_url TEXT,
        enquiries_after INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(e => console.error('[content_calendar] init failed:', e.message));

    // Returns an error string, or null when the fields are valid.
    function check(f) {
        if (f.planned_date !== undefined && !isDate(f.planned_date)) return 'planned_date must be YYYY-MM-DD';
        if (f.platform !== undefined && !PLATFORMS.includes(f.platform)) return 'platform must be one of: ' + PLATFORMS.join(', ');
        if (f.type !== undefined && !TYPES.includes(f.type)) return 'type must be one of: ' + TYPES.join(', ');
        if (f.status !== undefined && !STATUSES.includes(f.status)) return 'status must be one of: ' + STATUSES.join(', ');
        if (f.enquiries_after != null && !(Number.isInteger(f.enquiries_after) && f.enquiries_after >= 0)) return 'enquiries_after must be a whole number';
        return null;
    }

    const out = r => ({ ...r, planned_date: dateStr(r.planned_date) });

    router.get('/content-posts', ownerOnly, async (req, res) => {
        try {
            await ready;
            const from = clean(req.query.from), to = clean(req.query.to);
            if ((from && !isDate(from)) || (to && !isDate(to))) return res.status(400).json({ error: 'from/to must be YYYY-MM-DD' });
            const r = await pool.query(
                `SELECT * FROM content_posts WHERE ($1::date IS NULL OR planned_date >= $1::date) AND ($2::date IS NULL OR planned_date <= $2::date)
                 ORDER BY planned_date, id LIMIT 500`, [from || null, to || null]);
            res.json(r.rows.map(out));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/content-posts', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const f = { planned_date: clean(b.planned_date), platform: clean(b.platform), type: clean(b.type), status: clean(b.status) || 'idea',
                enquiries_after: b.enquiries_after === '' ? null : b.enquiries_after };
            if (!f.planned_date || !f.platform || !f.type) return res.status(400).json({ error: 'planned_date, platform and type are required' });
            const bad = check(f);
            if (bad) return res.status(400).json({ error: bad });
            const r = await pool.query(
                `INSERT INTO content_posts (planned_date, platform, type, script_draft, status, posted_url, enquiries_after)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [f.planned_date, f.platform, f.type, clean(b.script_draft), f.status, clean(b.posted_url) || null, f.enquiries_after == null ? null : f.enquiries_after]);
            res.status(201).json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Partial edit: only the fields sent are changed.
    router.put('/content-posts/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const cur = await pool.query(`SELECT * FROM content_posts WHERE id = $1`, [Number(req.params.id) || 0]);
            const old = cur.rows[0];
            if (!old) return res.status(404).json({ error: 'Post not found' });
            const f = {};
            for (const k of ['planned_date', 'platform', 'type', 'status', 'script_draft', 'posted_url']) if (b[k] !== undefined) f[k] = clean(b[k]);
            if (b.enquiries_after !== undefined) f.enquiries_after = b.enquiries_after === '' ? null : b.enquiries_after;
            const bad = check(f);
            if (bad) return res.status(400).json({ error: bad });
            const m = { ...old, ...f, planned_date: f.planned_date || dateStr(old.planned_date) };
            const r = await pool.query(
                `UPDATE content_posts SET planned_date=$1, platform=$2, type=$3, script_draft=$4, status=$5, posted_url=$6, enquiries_after=$7
                 WHERE id=$8 RETURNING *`,
                [m.planned_date, m.platform, m.type, m.script_draft, m.status, m.posted_url || null, m.enquiries_after == null ? null : m.enquiries_after, old.id]);
            res.json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/content-posts/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`DELETE FROM content_posts WHERE id = $1 RETURNING id`, [Number(req.params.id) || 0]);
            if (!r.rows[0]) return res.status(404).json({ error: 'Post not found' });
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Creates the default week (3 videos + 1 live) as 'idea' slots for the week
    // containing `week_of`. Safe to repeat: slots that already exist are skipped.
    router.post('/content-posts/plan-week', ownerOnly, async (req, res) => {
        try {
            await ready;
            const week_of = clean(req.body && req.body.week_of);
            if (!isDate(week_of)) return res.status(400).json({ error: 'week_of must be YYYY-MM-DD' });
            const mon = mondayOf(week_of);
            const created = [];
            for (const s of DEFAULT_PLAN) {
                const d = new Date(mon); d.setUTCDate(d.getUTCDate() + s.day);
                const ds = d.toISOString().slice(0, 10);
                const ex = await pool.query(`SELECT id FROM content_posts WHERE planned_date = $1 AND platform = $2 AND type = $3`, [ds, s.platform, s.type]);
                if (ex.rows.length) continue;
                const r = await pool.query(
                    `INSERT INTO content_posts (planned_date, platform, type, status) VALUES ($1, $2, $3, 'idea') RETURNING *`, [ds, s.platform, s.type]);
                created.push(out(r.rows[0]));
            }
            res.status(201).json({ week_start: mon.toISOString().slice(0, 10), created });
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
module.exports.DEFAULT_PLAN = DEFAULT_PLAN;
