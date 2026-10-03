// routes/site_editor.js
// WEBSITE EDITOR (isolated module): the owner edits the public website's tiles and text from the owner app.
//   PUBLIC (no login, read only):
//     GET  /api/site/public              visible tiles {id,name,size,finish,group,photoUrl} + the site text. Nothing else.
//     GET  /api/site/photo/:file         one tile photo (random file name)
//   OWNER ONLY (existing login; admin/owner role):
//     GET  /api/site/tiles               all tiles, hidden ones too
//     POST /api/site/tiles               { name, size, finish, group, visible }
//     PUT  /api/site/tiles/:id           edit
//     DELETE /api/site/tiles/:id         delete (its photo file is deleted too)
//     POST /api/site/tiles/:id/photo     multipart "photo": jpg/png/webp, 5 MB max, real type checked, resized to 1200 px
//     DELETE /api/site/tiles/:id/photo   remove the photo
//     GET/PUT /api/site/text             WhatsApp number, address, promise heading + paragraph (en / si / ta)
// New tables only: site_tiles, site_text (reverse: scripts/site_editor_down.sql). Photos live in uploads/site/.
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Pool } = require('pg');
const siteImage = require('../utils/siteImage');

const router = express.Router();
const pool = require('../utils/pool');
const DIR = process.env.SITE_UPLOAD_DIR || path.join(__dirname, '..', 'uploads', 'site');
fs.mkdirSync(DIR, { recursive: true });

const FINISHES = ['glossy', 'matt', 'polished'];
const GROUPS = ['stone', 'wood', 'wall', 'conc'];
const TEXT_KEYS = ['whatsapp', 'address', 'promise_h_en', 'promise_p_en', 'promise_h_si', 'promise_p_si', 'promise_h_ta', 'promise_p_ta'];
const TEXT_MAX = { whatsapp: 20, address: 200 };
const FILE_RE = /^[a-f0-9]{24}\.(webp|jpg)$/;

pool.query(`CREATE TABLE IF NOT EXISTS site_tiles (
    id SERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL, size VARCHAR(40), finish VARCHAR(12) NOT NULL DEFAULT 'matt',
    grp VARCHAR(8) NOT NULL DEFAULT 'stone', photo_file VARCHAR(60), visible BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`)
    .catch(e => console.error('[site_editor] site_tiles migration failed:', e.message));
pool.query(`CREATE TABLE IF NOT EXISTS site_text (key VARCHAR(40) PRIMARY KEY, value TEXT NOT NULL DEFAULT '')`)
    .catch(e => console.error('[site_editor] site_text migration failed:', e.message));

const roleOf = req => (req.session && req.session.user && req.session.user.role) || null;
function ownerOnly(req, res, next) {
    const r = roleOf(req);
    if (!r) return res.status(401).json({ error: 'Not logged in' });
    if (r !== 'admin' && r !== 'owner') return res.status(403).json({ error: 'Only the owner can edit the website.' });
    next();
}

const photoUrl = f => (f && FILE_RE.test(f) ? '/api/site/photo/' + f : null);
const publicTile = r => ({ id: r.id, name: r.name, size: r.size || '', finish: r.finish, group: r.grp, photoUrl: photoUrl(r.photo_file) });
const adminTile = r => ({ ...publicTile(r), visible: !!r.visible });
const bad = (res, msg) => res.status(400).json({ error: msg });
const unlinkQuiet = f => { if (f && FILE_RE.test(f)) fs.unlink(path.join(DIR, f), () => {}); };

async function readText() {
    const r = await pool.query(`SELECT key, value FROM site_text`);
    const m = {}; for (const x of r.rows) m[x.key] = x.value;
    const g = k => m[k] || '';
    return {
        whatsapp: g('whatsapp'), address: g('address'),
        promise: { en: { h: g('promise_h_en'), p: g('promise_p_en') }, si: { h: g('promise_h_si'), p: g('promise_p_si') }, ta: { h: g('promise_h_ta'), p: g('promise_p_ta') } },
    };
}

// ───────── PUBLIC ─────────
router.get('/site/public', async (req, res) => {
    try {
        const t = await pool.query(`SELECT id, name, size, finish, grp, photo_file FROM site_tiles WHERE visible = TRUE ORDER BY id`);
        res.set('Cache-Control', 'no-cache');
        res.json({ tiles: t.rows.map(publicTile), text: await readText() });
    } catch (e) { res.status(500).json({ error: 'not available' }); }
});

router.get('/site/photo/:file', (req, res) => {
    if (!FILE_RE.test(req.params.file)) return res.status(404).end();
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(req.params.file, { root: DIR }, err => { if (err && !res.headersSent) res.status(404).end(); });
});

// ───────── OWNER ─────────
router.get('/site/tiles', ownerOnly, async (req, res) => {
    try {
        const t = await pool.query(`SELECT id, name, size, finish, grp, photo_file, visible FROM site_tiles ORDER BY id`);
        res.json(t.rows.map(adminTile));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

function readTile(body, partial) {
    const out = {};
    if (!partial || body.name !== undefined) {
        const n = String(body.name == null ? '' : body.name).trim();
        if (!n) return { error: 'name is required' };
        if (n.length > 80) return { error: 'name is too long (max 80 characters)' };
        out.name = n;
    }
    if (!partial || body.size !== undefined) {
        const s = String(body.size == null ? '' : body.size).trim();
        if (s.length > 40) return { error: 'size is too long (max 40 characters)' };
        out.size = s;
    }
    if (!partial || body.finish !== undefined) {
        const f = body.finish === undefined ? 'matt' : String(body.finish);
        if (!FINISHES.includes(f)) return { error: 'finish must be glossy, matt or polished' };
        out.finish = f;
    }
    if (!partial || body.group !== undefined) {
        const g = body.group === undefined ? 'stone' : String(body.group);
        if (!GROUPS.includes(g)) return { error: 'group must be stone, wood, wall or conc' };
        out.grp = g;
    }
    if (!partial || body.visible !== undefined) out.visible = body.visible === undefined ? true : (body.visible === true || body.visible === 'true');
    return { value: out };
}

router.post('/site/tiles', ownerOnly, async (req, res) => {
    try {
        const p = readTile(req.body || {}, false);
        if (p.error) return bad(res, p.error);
        const v = p.value;
        const r = await pool.query(`INSERT INTO site_tiles (name, size, finish, grp, visible) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, size, finish, grp, photo_file, visible`,
            [v.name, v.size, v.finish, v.grp, v.visible]);
        res.status(201).json(adminTile(r.rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/site/tiles/:id', ownerOnly, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'tile not found' });
        const p = readTile(req.body || {}, true);
        if (p.error) return bad(res, p.error);
        const keys = Object.keys(p.value);
        if (!keys.length) return bad(res, 'nothing to change');
        const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
        const r = await pool.query(`UPDATE site_tiles SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = $${keys.length + 1} RETURNING id, name, size, finish, grp, photo_file, visible`,
            [...keys.map(k => p.value[k]), req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'tile not found' });
        res.json(adminTile(r.rows[0]));
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/site/tiles/:id', ownerOnly, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'tile not found' });
        const r = await pool.query(`DELETE FROM site_tiles WHERE id = $1 RETURNING photo_file`, [req.params.id]);
        if (!r.rows.length) return res.status(404).json({ error: 'tile not found' });
        unlinkQuiet(r.rows[0].photo_file);
        res.json({ deleted: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: siteImage.MAX_BYTES, files: 1 } }).single('photo');
function uploadOne(req, res, next) {
    upload(req, res, err => {
        if (!err) return next();
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'That photo is too big. The limit is 5 MB.' });
        return res.status(400).json({ error: 'Could not read the upload: ' + err.message });
    });
}

router.post('/site/tiles/:id/photo', ownerOnly, uploadOne, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'tile not found' });
        if (!req.file) return bad(res, 'Choose a photo first.');
        const cur = await pool.query(`SELECT photo_file FROM site_tiles WHERE id = $1`, [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'tile not found' });
        // the real file type decides, never the name the phone or browser gave it
        if (!(await siteImage.detectType(req.file.buffer))) return res.status(415).json({ error: 'Only JPG, PNG or WebP photos are allowed.' });
        let out;
        try { out = await siteImage.resizeToWebp(req.file.buffer); }
        catch (e) { return res.status(422).json({ error: 'That photo could not be read. Try another one.' }); }
        const name = crypto.randomBytes(12).toString('hex') + '.' + out.ext;          // random: the original name is never used
        fs.writeFileSync(path.join(DIR, name), out.buffer);
        await pool.query(`UPDATE site_tiles SET photo_file = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [name, req.params.id]);
        unlinkQuiet(cur.rows[0].photo_file);
        res.status(201).json({ photoUrl: photoUrl(name) });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/site/tiles/:id/photo', ownerOnly, async (req, res) => {
    try {
        if (!/^\d+$/.test(req.params.id)) return res.status(404).json({ error: 'tile not found' });
        const cur = await pool.query(`SELECT photo_file FROM site_tiles WHERE id = $1`, [req.params.id]);
        if (!cur.rows.length) return res.status(404).json({ error: 'tile not found' });
        await pool.query(`UPDATE site_tiles SET photo_file = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [req.params.id]);
        unlinkQuiet(cur.rows[0].photo_file);
        res.json({ photoUrl: null });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/site/text', ownerOnly, async (req, res) => {
    try { res.json(await readText()); } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/site/text', ownerOnly, async (req, res) => {
    try {
        const b = req.body || {};
        const flat = { whatsapp: b.whatsapp, address: b.address };
        for (const l of ['en', 'si', 'ta']) {
            const pr = (b.promise && b.promise[l]) || {};
            flat['promise_h_' + l] = pr.h; flat['promise_p_' + l] = pr.p;
        }
        const clean = {};
        for (const k of TEXT_KEYS) {
            if (flat[k] === undefined) continue;
            let v = String(flat[k] == null ? '' : flat[k]).trim();
            if (k === 'whatsapp') {
                let d = v.replace(/\D/g, '');
                if (d.length === 10 && d.startsWith('0')) d = '94' + d.slice(1);       // 0777999219 -> 94777999219
                if (d && !/^\d{9,15}$/.test(d)) return bad(res, 'WhatsApp number is not valid (example: 0777999219).');
                v = d;
            } else {
                const max = TEXT_MAX[k] || (k.startsWith('promise_h') ? 120 : 600);
                if (v.length > max) return bad(res, `${k.replace(/_/g, ' ')} is too long (max ${max} characters)`);
            }
            clean[k] = v;
        }
        for (const [k, v] of Object.entries(clean)) {
            const u = await pool.query(`UPDATE site_text SET value = $2 WHERE key = $1`, [k, v]);
            if (!u.rowCount) await pool.query(`INSERT INTO site_text (key, value) VALUES ($1, $2)`, [k, v]);
        }
        res.json(await readText());
    } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;