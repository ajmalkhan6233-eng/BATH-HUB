'use strict';
// Facts LAYLA may state about products. ONLY from the database:
//   products   (item catalogue, routes/item_catalog.js): name, category, selling_price, stock_level, active
//   site_tiles (website tiles, routes/site_editor.js)   : name, size, finish, visible
//   site_text  key 'address'                            : the shop address shown on the website
//   discount_rules                                      : the discount caps the owner set
// Cost price (avg_cost) is never selected. The exact stock number is never given to customers (only "have it / out").
// matchItems() is pure so the offline tests use the same matching as the real database.
const { parseTileSize } = require('./quote');

const GENERIC = new Set(('tile price stock floor wall size box piece available have has you your the a an is are do does what how much many for of in on at to me my i we our with and or ' +
    'please pls need want looking show tell any some this that these those it one two three which kind type color colour design designs room bathroom kitchen ' +
    'inch feet sqft quotation delivery discount location matt glossy per each cost rate hi hello hey can could would like get buy order ' +
    'ekak eka ona one thiyenawada thiyenawa kiyada kiyanawada mata mage enakku venum irukka irukkaa irukku enna evlo').split(/\s+/));

const fmtRs = n => 'Rs ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

function sizeKey(s) {
    const d = parseTileSize(s);
    return d ? `${Math.round(d[0] * 10) / 10}x${Math.round(d[1] * 10) / 10}` : null;
}

function queryTokens(text) {
    const t = String(text || '').toLowerCase();
    const words = t.replace(/[×*]/g, 'x').replace(/(\d)\s*x\s*(\d)/g, '$1x$2').split(/[^a-z0-9]+/).filter(w => w.length >= 2);
    return words;
}

/**
 * @param {{products:[], tiles:[]}} rows  raw rows from the database
 * @param {string} text                   the customer's message (already canonicalised or not)
 * @returns {{items:[], sizeAsked:string|null, specific:boolean}}
 */
function matchItems(rows, text) {
    const words = queryTokens(text);
    const specific = words.filter(w => !GENERIC.has(w) && !/^\d+x\d+$/.test(w) && !/^\d+$/.test(w));
    const sizeWord = words.find(w => /^\d+x\d+$/.test(w)) || null;
    const asked = sizeWord ? sizeKey(sizeWord.replace('x', ' x ')) : (sizeKey(text) || null);

    const byName = new Map();   // lower-case name -> merged item
    for (const p of rows.products || []) {
        if (p.active === false) continue;
        const key = String(p.name || '').toLowerCase().trim();
        byName.set(key, {
            name: p.name, category: p.category || null, price: p.selling_price != null && Number(p.selling_price) > 0 ? Number(p.selling_price) : null,
            inStock: p.stock_level == null ? null : Number(p.stock_level) > 0, size: sizeKey(p.name), finish: null, source: 'products', item_code: p.item_code || null,
        });
    }
    for (const t of rows.tiles || []) {
        if (t.visible === false) continue;
        const key = String(t.name || '').toLowerCase().trim();
        const have = byName.get(key);
        if (have) { have.size = have.size || sizeKey(t.size); have.finish = t.finish || null; have.source = 'products+site_tiles'; }
        else byName.set(key, { name: t.name, category: null, price: null, inStock: null, size: sizeKey(t.size), finish: t.finish || null, source: 'site_tiles', item_code: null });
    }

    const scored = [];
    for (const it of byName.values()) {
        const hay = `${it.name} ${it.category || ''} ${it.finish || ''}`.toLowerCase();
        const hayWords = hay.split(/[^a-z0-9]+/);
        let score = 0;
        for (const w of specific) if (hayWords.some(h => h === w || (w.length >= 4 && h.startsWith(w)))) score += 2;
        if (asked && it.size === asked) score += specific.length ? 1 : 3;
        // A size alone is a weak match; a name word is a real one.
        if (score > 0 && (specific.length === 0 ? asked && it.size === asked : score >= 2)) scored.push({ it, score });
    }
    scored.sort((a, b) => b.score - a.score || a.it.name.localeCompare(b.it.name));
    const top = scored.slice(0, 3);
    return { items: top.map(s => s.it), scores: top.map(s => s.score), sizeAsked: asked, specific: specific.length > 0 };
}

function createPgCatalog(pool) {
    const safe = async (sql, params) => { try { return (await pool.query(sql, params)).rows; } catch (e) { return []; } };   // a missing table just means "no facts"
    return {
        name: 'pg',
        async search(text) {
            const products = await safe(`SELECT id, item_code, name, category, stock_level, selling_price, active FROM products WHERE active IS NOT FALSE LIMIT 2000`);
            const tiles = await safe(`SELECT id, name, size, finish, visible FROM site_tiles WHERE visible = TRUE LIMIT 500`);
            return matchItems({ products, tiles }, text);
        },
        async address() {
            const r = await safe(`SELECT value FROM site_text WHERE key = 'address'`);
            return r[0] && String(r[0].value || '').trim() ? String(r[0].value).trim() : null;
        },
        async discountCap() {
            const r = await safe(`SELECT max_discount_pct FROM discount_rules WHERE active = true AND role = 'all' ORDER BY id DESC LIMIT 1`);
            return r[0] ? Number(r[0].max_discount_pct) : null;
        },
    };
}

function createMemoryCatalog({ products = [], tiles = [], address = null, discountCap = null } = {}) {
    return {
        name: 'memory',
        async search(text) { return matchItems({ products, tiles }, text); },
        async address() { return address; },
        async discountCap() { return discountCap; },
    };
}

module.exports = { matchItems, createPgCatalog, createMemoryCatalog, fmtRs, sizeKey };