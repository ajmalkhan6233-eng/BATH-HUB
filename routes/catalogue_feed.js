// routes/catalogue_feed.js
// M5 WEBSITE CATALOGUE FEED: feeds the public website (bathhub.html) from the item catalog.
//
// PRIVACY: the public endpoint returns ONLY name, size cm, size inches, finish, use, photo.
// It never returns price, cost, margin, supplier, stock or item_code. Fields are listed
// explicitly in the SELECT and in the response mapper; nothing is spread from a row.
// Items are hidden by default: an item appears only after the owner publishes it.
//
// Own table `catalogue_web` (item_code -> size/finish/use/published). `products` is only read.
//   GET /public/catalogue           no login (added to the auth bypass list in server.js)
//   GET /catalogue-web              owner: items + web details
//   PUT /catalogue-web/:item_code   owner: set details / publish / hide

require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');

function ownerOnly(req, res, next) {
    const u = req.session && req.session.user;
    if (!u || (u.role !== 'admin' && u.role !== 'owner')) return res.status(403).json({ error: 'Owner only' });
    next();
}
const clean = v => String(v == null ? '' : v).trim();

// "60x60" / "30 x 60" / "60x120" -> normalised "60x60"; '' when empty; null when invalid.
function normSize(v) {
    const s = clean(v).toLowerCase().replace(/\s+/g, '').replace(/cm$/, '');
    if (!s) return '';
    return /^\d+(\.\d+)?x\d+(\.\d+)?$/.test(s) ? s : null;
}
// "60x60" -> "24x24" (nearest whole inch).
function toInches(cm) {
    if (!cm) return '';
    return cm.split('x').map(n => String(Math.round(Number(n) / 2.54))).join('x');
}

function createRouter(pool) {
    const router = express.Router();

    const ready = pool.query(`CREATE TABLE IF NOT EXISTS catalogue_web (
        item_code TEXT PRIMARY KEY,
        size_cm TEXT NOT NULL DEFAULT '',
        finish TEXT NOT NULL DEFAULT '',
        use_case TEXT NOT NULL DEFAULT '',
        published BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`).catch(e => console.error('[catalogue_feed] init failed:', e.message));

    // ── PUBLIC (no login) ────────────────────────────────────────────────────
    router.get('/public/catalogue', async (req, res) => {
        try {
            await ready;
            const r = await pool.query(
                `SELECT p.name, p.photo_url, w.size_cm, w.finish, w.use_case
                 FROM catalogue_web w JOIN products p ON p.item_code = w.item_code
                 WHERE w.published = TRUE AND p.active = TRUE ORDER BY p.name`);
            const items = r.rows.map(x => ({          // explicit whitelist, nothing else leaves
                name: x.name,
                size_cm: x.size_cm,
                size_inches: toInches(x.size_cm),
                finish: x.finish,
                use: x.use_case,
                photo: x.photo_url,
            }));
            res.set('Access-Control-Allow-Origin', '*');   // read-only public data; lets bathhub.html load it
            res.set('Cache-Control', 'public, max-age=300');
            res.json({ items });
        } catch (e) { res.status(500).json({ error: 'Catalogue unavailable' }); }
    });

    // ── OWNER ────────────────────────────────────────────────────────────────
    router.get('/catalogue-web', ownerOnly, async (req, res) => {
        try {
            await ready;
            const r = await pool.query(
                `SELECT p.item_code, p.name, p.photo_url, w.size_cm, w.finish, w.use_case, w.published
                 FROM products p LEFT JOIN catalogue_web w ON w.item_code = p.item_code
                 WHERE p.active = TRUE ORDER BY p.item_code`);
            res.json(r.rows.map(x => ({
                item_code: x.item_code, name: x.name, photo_url: x.photo_url,
                size_cm: x.size_cm || '', finish: x.finish || '', use: x.use_case || '', published: !!x.published,
            })));
        } catch (e) { res.status(500).json({ error: e.message }); }
    });

    router.put('/catalogue-web/:item_code', ownerOnly, async (req, res) => {
        try {
            await ready;
            const code = clean(req.params.item_code);
            const p = await pool.query(`SELECT item_code, photo_url FROM products WHERE item_code = $1 AND active = TRUE`, [code]);
            if (!p.rows[0]) return res.status(404).json({ error: 'Item not found' });
            const b = req.body || {};
            const cur = (await pool.query(`SELECT * FROM catalogue_web WHERE item_code = $1`, [code])).rows[0]
                || { size_cm: '', finish: '', use_case: '', published: false };
            const size = b.size_cm !== undefined ? normSize(b.size_cm) : cur.size_cm;
            if (size === null) return res.status(400).json({ error: 'size_cm must look like 60x60 or 30x60' });
            const finish = b.finish !== undefined ? clean(b.finish) : cur.finish;
            const use = b.use !== undefined ? clean(b.use) : cur.use_case;
            if (finish.length > 80 || use.length > 120) return res.status(400).json({ error: 'finish/use text is too long' });
            const published = b.published !== undefined ? b.published : cur.published;
            if (typeof published !== 'boolean') return res.status(400).json({ error: 'published must be true or false' });
            if (published && !size) return res.status(400).json({ error: 'Add the size before publishing' });
            if (published && !p.rows[0].photo_url) return res.status(400).json({ error: 'Add a photo to the item before publishing' });
            await pool.query(
                `INSERT INTO catalogue_web (item_code, size_cm, finish, use_case, published) VALUES ($1,$2,$3,$4,$5)
                 ON CONFLICT (item_code) DO UPDATE SET size_cm=$2, finish=$3, use_case=$4, published=$5, updated_at=NOW()`,
                [code, size, finish, use, published]);
            res.json({ item_code: code, size_cm: size, finish, use, published });
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
module.exports.toInches = toInches;
