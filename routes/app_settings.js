// routes/app_settings.js
// SETTINGS + MENU CONTROL (isolated module). Mount: app.use('/api', require('./routes/app_settings'))
//   GET  /api/app-settings               admin: every known setting with its default
//   GET  /api/app-settings/public        any logged-in user: shop name, tagline, brand colours, hours, sales target
//   PUT  /api/app-settings               admin: object of known keys (unknown keys / bad values rejected, nothing saved)
//   POST /api/app-settings/flag-audit    admin: {key, enabled} writes the audit row after a feature-flag toggle
//   GET  /api/menu-config                any logged-in user: saved menu rows only (none = default menu)
//   PUT  /api/menu-config                admin: array of {item_key, label, visible, sort_order}
//   POST /api/menu-config/reset          admin: delete all rows = back to the default menu
// New tables only: app_settings, menu_config. Every change is written to admin_audit. Login is required (server.js gate).
const express = require('express');
const { Pool } = require('pg');
const { ensureAdminAudit, logAdmin, adminOnly } = require('../utils/adminAudit');
const S = require('../utils/appSettings');

const router = express.Router();
const pool = require('../utils/pool');

// The owner-app menu items. dashboard and settings can never be hidden.
const MENU_ITEMS = ['dashboard', 'daily-sales', 'stock', 'pos', 'grn', 'expenses', 'cheques', 'vendors', 'barcode', 'salary', 'docinbox', 'loans',
    'moneycontrol', 'commissions', 'enquiries', 'replies', 'webcat', 'policy', 'branches', 'settings', 'shoptools', 'content', 'competitors',
    'agentreview', 'agent-rules', 'reports'];
const ALWAYS_VISIBLE = ['dashboard', 'settings'];

const ready = (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
        key        TEXT PRIMARY KEY,
        value      JSONB NOT NULL,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS menu_config (
        item_key   TEXT PRIMARY KEY,
        label      TEXT,
        visible    BOOLEAN DEFAULT TRUE,
        sort_order INT,
        updated_by TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await ensureAdminAudit(pool);
})().catch(e => console.error('[app_settings] init failed:', e.message));

const who = req => (req.session && req.session.user && (req.session.user.username || req.session.user.name)) || 'unknown';
const wrap = fn => async (req, res) => { try { await ready; await fn(req, res); } catch (e) { res.status(500).json({ error: e.message }); } };

async function allSettings() {
    S.clearCache();
    const saved = await S.loadAll(pool);
    const out = {};
    for (const [k, def] of Object.entries(S.SCHEMA)) out[k] = Object.prototype.hasOwnProperty.call(saved, k) ? saved[k] : def.def;
    return out;
}

// ── settings ──────────────────────────────────────────────────────────
router.get('/app-settings', adminOnly, wrap(async (req, res) => {
    const defaults = {};
    for (const [k, def] of Object.entries(S.SCHEMA)) defaults[k] = def.def;
    res.json({ settings: await allSettings(), defaults });
}));

router.get('/app-settings/public', wrap(async (req, res) => {
    const all = await allSettings(), out = {};
    for (const k of S.PUBLIC_KEYS) out[k] = all[k];
    res.json(out);
}));

router.put('/app-settings', adminOnly, wrap(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return res.status(400).json({ error: 'Send an object of settings' });
    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: 'Nothing to save' });
    for (const k of keys) {
        const err = S.validate(k, body[k]);
        if (err) return res.status(400).json({ error: err });
    }
    const before = await allSettings();
    const changes = {};
    for (const k of keys) {
        await pool.query(
            `INSERT INTO app_settings (key, value, updated_by, updated_at) VALUES ($1, $2, $3, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
            [k, JSON.stringify(body[k]), who(req)]);
        if (JSON.stringify(before[k]) !== JSON.stringify(body[k])) changes[k] = { from: before[k], to: body[k] };
    }
    S.clearCache();
    await logAdmin(pool, req, 'settings.update', 'app_settings', keys.join(','), changes);
    res.json({ settings: await allSettings(), changed: Object.keys(changes) });
}));

router.post('/app-settings/flag-audit', adminOnly, wrap(async (req, res) => {
    const { key, enabled } = req.body || {};
    if (typeof key !== 'string' || !key.trim() || key.length > 100) return res.status(400).json({ error: 'key is required' });
    if (typeof enabled !== 'boolean') return res.status(400).json({ error: 'enabled (true or false) is required' });
    await logAdmin(pool, req, 'feature_flag.toggle', 'feature_flags', key, { enabled });
    res.json({ ok: true });
}));

// ── menu ──────────────────────────────────────────────────────────────
router.get('/menu-config', wrap(async (req, res) => {
    const r = await pool.query(`SELECT item_key, label, visible, sort_order FROM menu_config ORDER BY sort_order, item_key`);
    res.json(r.rows);
}));

router.put('/menu-config', adminOnly, wrap(async (req, res) => {
    const items = req.body;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: 'Send a list of menu items' });
    const seen = new Set();
    for (const it of items) {
        if (!it || typeof it !== 'object') return res.status(400).json({ error: 'Each menu item must be an object' });
        if (!MENU_ITEMS.includes(it.item_key)) return res.status(400).json({ error: `Unknown menu item: ${it.item_key}` });
        if (seen.has(it.item_key)) return res.status(400).json({ error: `Menu item listed twice: ${it.item_key}` });
        seen.add(it.item_key);
        if (typeof it.label !== 'string' || !it.label.trim() || it.label.length > 60) return res.status(400).json({ error: `${it.item_key}: label must be 1 to 60 characters` });
        if (typeof it.visible !== 'boolean') return res.status(400).json({ error: `${it.item_key}: visible must be true or false` });
        if (!Number.isInteger(it.sort_order) || it.sort_order < 0 || it.sort_order > 10000) return res.status(400).json({ error: `${it.item_key}: sort_order must be a whole number` });
        if (ALWAYS_VISIBLE.includes(it.item_key) && !it.visible) return res.status(400).json({ error: `${it.item_key} can never be hidden` });
    }
    for (const it of items) {
        await pool.query(
            `INSERT INTO menu_config (item_key, label, visible, sort_order, updated_by, updated_at) VALUES ($1,$2,$3,$4,$5,NOW())
             ON CONFLICT (item_key) DO UPDATE SET label = EXCLUDED.label, visible = EXCLUDED.visible, sort_order = EXCLUDED.sort_order,
                 updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
            [it.item_key, it.label.trim(), it.visible, it.sort_order, who(req)]);
    }
    await logAdmin(pool, req, 'menu.update', 'menu_config', null, { hidden: items.filter(i => !i.visible).map(i => i.item_key), count: items.length });
    const r = await pool.query(`SELECT item_key, label, visible, sort_order FROM menu_config ORDER BY sort_order, item_key`);
    res.json(r.rows);
}));

router.post('/menu-config/reset', adminOnly, wrap(async (req, res) => {
    const r = await pool.query(`DELETE FROM menu_config`);
    await logAdmin(pool, req, 'menu.reset', 'menu_config', null, { rows_removed: r.rowCount });
    res.json({ ok: true, reset: true });
}));

router.MENU_ITEMS = MENU_ITEMS;
module.exports = router;
