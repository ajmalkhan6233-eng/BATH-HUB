// routes/competitors.js
// M4 COMPETITOR WATCH: who else sells tiles/bathware near us, and a monthly check of
// what they do online (posts, lives, online store, promotions). Owner/admin only.
// Own tables `competitors` and `competitor_checks`; nothing else is touched.
// Seeded once (only when empty) from the handoff list. Facts we don't know
// (area, channels) are left blank, not guessed.

require('dotenv').config();
const express = require('express');
const { todayLK, monthLK, daysAgoLK } = require('../utils/lkTime');
const { Pool } = require('pg');

const CHANNELS = ['tiktok', 'facebook', 'site'];

// [name, area, notes]
const SEED = [
    ['Thihariya Tile Center & Granite Designers', 'thihariya strip', ''],
    ['Sonic Ceramic', '', ''],
    ['Macktiles retailers', '', ''],
    ['Tile Gallery', '', ''],
    ['Choice Ceramic', '', ''],
    ['Ultra Tiles', '', ''],
    ['Tile City', '', ''],
    ['Cheap Ceramics', '', ''],
    ['Tile Mahagedara', '', 'Location unconfirmed.'],
    ['Greenly', '', 'Not found; spelling unconfirmed.'],
    ['New Sun Ceramics', 'nawala', ''],
    ['Ceylon Bathware', 'Nugegoda', ''],
    ['Fazaal Hardware', 'Galle', ''],
];

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();
const { isRealDate: isDate } = require('../utils/validate');   // real calendar dates only (2026-02-30 is refused)
const dateStr = v => v == null ? null : (v instanceof Date
    ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`
    : String(v).slice(0, 10));

// "TikTok, site" / ["tiktok","site"] -> "tiktok,site"; null when something isn't a known channel.
function normChannels(v) {
    const list = (Array.isArray(v) ? v : clean(v).split(',')).map(x => clean(x).toLowerCase()).filter(Boolean);
    if (list.some(x => !CHANNELS.includes(x))) return null;
    return [...new Set(list)].join(',');
}

function createRouter(pool) {
    const router = express.Router();

    const ready = (async () => {
        await pool.query(`CREATE TABLE IF NOT EXISTS competitors (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            area TEXT NOT NULL DEFAULT '',
            channels TEXT NOT NULL DEFAULT '',
            last_checked DATE,
            notes TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS competitor_checks (
            id SERIAL PRIMARY KEY,
            competitor_id INTEGER NOT NULL,
            checked_on DATE NOT NULL,
            posts BOOLEAN,
            goes_live BOOLEAN,
            online_store BOOLEAN,
            promotions TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`);
        const c = await pool.query(`SELECT COUNT(*)::int AS n FROM competitors`);
        if (c.rows[0].n === 0) {
            for (const [name, area, notes] of SEED) {
                await pool.query(`INSERT INTO competitors (name, area, notes) VALUES ($1, $2, $3)`, [name, area, notes]);
            }
        }
    })().catch(e => console.error('[competitors] init failed:', e.message));

    const out = r => ({ ...r, last_checked: dateStr(r.last_checked) });
    const outCheck = r => ({ ...r, checked_on: dateStr(r.checked_on) });

    router.get('/competitors', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(`SELECT * FROM competitors ORDER BY name`);
            res.json(r.rows.map(out));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.post('/competitors', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const name = clean(b.name);
            if (!name) return res.status(400).json({ error: 'name is required' });
            const channels = normChannels(b.channels);
            if (channels === null) return res.status(400).json({ error: 'channels must be from: ' + CHANNELS.join(', ') });
            const r = await pool.query(`INSERT INTO competitors (name, area, channels, notes) VALUES ($1, $2, $3, $4) RETURNING *`,
                [name, clean(b.area), channels, clean(b.notes)]);
            res.status(201).json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Partial edit: only the fields sent are changed.
    router.put('/competitors/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const cur = await pool.query(`SELECT * FROM competitors WHERE id = $1`, [Number(req.params.id) || 0]);
            const old = cur.rows[0];
            if (!old) return res.status(404).json({ error: 'Competitor not found' });
            const name = b.name !== undefined ? clean(b.name) : old.name;
            if (!name) return res.status(400).json({ error: 'name cannot be empty' });
            const channels = b.channels !== undefined ? normChannels(b.channels) : old.channels;
            if (channels === null) return res.status(400).json({ error: 'channels must be from: ' + CHANNELS.join(', ') });
            const r = await pool.query(`UPDATE competitors SET name=$1, area=$2, channels=$3, notes=$4 WHERE id=$5 RETURNING *`,
                [name, b.area !== undefined ? clean(b.area) : old.area, channels, b.notes !== undefined ? clean(b.notes) : old.notes, old.id]);
            res.json(out(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.delete('/competitors/:id', ownerOnly, async (req, res) => {
        try {
            await ready;
            const id = Number(req.params.id) || 0;
            const r = await pool.query(`DELETE FROM competitors WHERE id = $1 RETURNING id`, [id]);
            if (!r.rows[0]) return res.status(404).json({ error: 'Competitor not found' });
            await pool.query(`DELETE FROM competitor_checks WHERE competitor_id = $1`, [id]);
            res.json({ ok: true });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Record a monthly check. Also stamps competitors.last_checked.
    router.post('/competitors/:id/checks', ownerOnly, async (req, res) => {
        try {
            await ready;
            const b = req.body || {};
            const id = Number(req.params.id) || 0;
            const checked_on = clean(b.checked_on) || todayLK();
            if (!isDate(checked_on)) return res.status(400).json({ error: 'checked_on must be YYYY-MM-DD' });
            for (const k of ['posts', 'goes_live', 'online_store']) {
                if (b[k] != null && typeof b[k] !== 'boolean') return res.status(400).json({ error: k + ' must be true or false' });
            }
            const comp = await pool.query(`SELECT id FROM competitors WHERE id = $1`, [id]);
            if (!comp.rows[0]) return res.status(404).json({ error: 'Competitor not found' });
            const r = await pool.query(
                `INSERT INTO competitor_checks (competitor_id, checked_on, posts, goes_live, online_store, promotions)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [id, checked_on, b.posts == null ? null : b.posts, b.goes_live == null ? null : b.goes_live,
                    b.online_store == null ? null : b.online_store, clean(b.promotions)]);
            await pool.query(`UPDATE competitors SET last_checked = $1 WHERE id = $2 AND (last_checked IS NULL OR last_checked < $1)`, [checked_on, id]);
            res.status(201).json(outCheck(r.rows[0]));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Competitors not checked for N days (default 35) or never checked: the "who is due a look" list.
    router.get('/competitors/due-check', ownerOnly, async (req, res) => {
        try {
            await ready;
            const days = Math.min(Math.max(parseInt(req.query.days, 10) || 35, 1), 365);
            const cutoff = daysAgoLK(days);
            const r = await pool.query(`SELECT * FROM competitors ORDER BY name`);
            const due = r.rows.map(out).filter(c => !c.last_checked || c.last_checked < cutoff)
                .sort((a, b) => (a.last_checked || '').localeCompare(b.last_checked || '') || a.name.localeCompare(b.name));
            res.json({ days, never_checked: due.filter(c => !c.last_checked).length, competitors: due });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    // Monthly checklist: every competitor with its latest check in ?month=YYYY-MM (default: this month),
    // or check = null when not yet done that month.
    router.get('/competitors/checklist', ownerOnly, async (req, res) => {
        try {
            await ready;
            const month = clean(req.query.month) || monthLK();
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
            const comps = await pool.query(`SELECT * FROM competitors ORDER BY name`);
            const checks = await pool.query(`SELECT * FROM competitor_checks ORDER BY checked_on, id`);
            const latest = {};
            for (const c of checks.rows.map(outCheck)) if (c.checked_on.slice(0, 7) === month) latest[c.competitor_id] = c;
            res.json({ month, items: comps.rows.map(c => ({ ...out(c), check: latest[c.id] || null })) });
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
module.exports.SEED = SEED;
