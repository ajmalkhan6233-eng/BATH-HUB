// utils/appSettings.js: one place that knows the app_settings keys, and a cached reader for server code.
//   getSetting(pool, key, fallback)             value saved in app_settings, else fallback (cached 5 seconds)
//   getBool(pool, key, envName, defaultValue)   DB value wins when set, else the env variable, else the default
//   SCHEMA / validate(key, value)               the known keys, their types and ranges (unknown keys are rejected)
// Reads never throw: if the table is missing or the DB is down, the fallback is returned.
const TTL_MS = 5000;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const str = (max, label) => v => (typeof v === 'string' && v.length <= max) ? null : `${label} must be text of ${max} characters or less`;
const SCHEMA = {
    shop_name:             { def: 'Royal Bath Hub', check: v => (typeof v === 'string' && v.trim().length >= 1 && v.length <= 100) ? null : 'shop_name must be 1 to 100 characters' },
    tagline:               { def: '', check: str(200, 'tagline') },
    shop_phone:            { def: '', check: str(40, 'shop_phone') },
    shop_address:          { def: '', check: str(300, 'shop_address') },
    opening_hours:         { def: '', check: str(200, 'opening_hours') },
    brand_primary:         { def: '#C9A227', check: v => (typeof v === 'string' && HEX.test(v)) ? null : 'brand_primary must be a hex colour like #C9A227' },
    brand_accent:          { def: '#1F2937', check: v => (typeof v === 'string' && HEX.test(v)) ? null : 'brand_accent must be a hex colour like #1F2937' },
    dashboard_sales_target:{ def: 100000, check: v => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9) ? null : 'dashboard_sales_target must be a number, 0 or more' },
    whatsapp_draft_only:   { def: true, check: v => typeof v === 'boolean' ? null : 'whatsapp_draft_only must be true or false' },
};
const PUBLIC_KEYS = ['shop_name', 'tagline', 'brand_primary', 'brand_accent', 'opening_hours', 'dashboard_sales_target'];

function validate(key, value) {
    if (!Object.prototype.hasOwnProperty.call(SCHEMA, key)) return `Unknown setting: ${key}`;
    return SCHEMA[key].check(value);
}

let cache = { at: 0, map: null };
function clearCache() { cache = { at: 0, map: null }; }

async function loadAll(pool) {
    if (cache.map && Date.now() - cache.at < TTL_MS) return cache.map;
    const map = {};
    try {
        const r = await pool.query(`SELECT key, value FROM app_settings`);
        for (const row of r.rows) map[row.key] = row.value;
    } catch (e) { /* table missing or DB down: fall back */ }
    cache = { at: Date.now(), map };
    return map;
}

async function getSetting(pool, key, fallback) {
    const map = await loadAll(pool);
    return Object.prototype.hasOwnProperty.call(map, key) && map[key] !== null ? map[key] : fallback;
}

async function getBool(pool, key, envName, defaultValue) {
    const map = await loadAll(pool);
    if (Object.prototype.hasOwnProperty.call(map, key) && typeof map[key] === 'boolean') return map[key];
    if (envName && process.env[envName] !== undefined && process.env[envName] !== '') return String(process.env[envName]).toLowerCase() === 'true';
    return !!defaultValue;
}

module.exports = { SCHEMA, PUBLIC_KEYS, validate, getSetting, getBool, loadAll, clearCache };
