'use strict';
// Tile quantity maths: the SAME calculation as the website calculator (public/website/index.html function calc):
//   area in sq ft (metres x 10.7639), + waste % (default 10), tile size parsed from "W x H in", ceil.
// Pure functions. No database, no prices. A quotation DRAFT (never sent) is built from this by quote_draft in engine.js.

const SQFT_PER_SQM = 10.7639;
const DEFAULT_WASTE = 10;

// "24 x 24 in", "2x2 ft", "600 x 600 mm", "60 X 60 cm" -> [widthIn, heightIn]; inches when no unit is given (as on the website).
function parseTileSize(s) {
    const m = String(s || '').match(/(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*(inches|inch|in|"|ft|feet|foot|cm|mm|mtr|m)?\b/i);
    if (!m) return null;
    const unit = (m[3] || 'in').toLowerCase();
    const k = { in: 1, inch: 1, inches: 1, '"': 1, ft: 12, feet: 12, foot: 12, cm: 1 / 2.54, mm: 1 / 25.4, m: 39.3701, mtr: 39.3701 }[unit];
    const w = +m[1] * k, h = +m[2] * k;
    return w > 0 && h > 0 ? [w, h] : null;
}

function round1(n) { return Math.round(n * 10) / 10; }

/**
 * @param {{length:number, width:number, unit?:'ft'|'m', wastePct?:number, tileSize?:string}} a
 * @returns {{ok:boolean, error?:string, sqft?:number, sqm?:number, wastePct?:number, tiles?:number, tileSqft?:number}}
 */
function calcTiles({ length, width, unit = 'ft', wastePct = DEFAULT_WASTE, tileSize } = {}) {
    const L = Number(length), W = Number(width);
    if (!(L > 0) || !(W > 0)) return { ok: false, error: 'room size missing' };
    if (L > 500 || W > 500) return { ok: false, error: 'room size looks wrong' };
    const waste = Number(wastePct);
    if (!(waste >= 0 && waste <= 50)) return { ok: false, error: 'waste percentage looks wrong' };
    const sqft = unit === 'm' ? L * W * SQFT_PER_SQM : L * W;
    const out = { ok: true, sqft: round1(sqft), sqm: round1(sqft / SQFT_PER_SQM), wastePct: waste };
    const d = parseTileSize(tileSize);
    if (!d) return { ...out, tiles: null, tileSqft: null, note: 'tile size unknown' };
    const per = d[0] * d[1] / 144;
    out.tileSqft = Math.round(per * 100) / 100;
    out.tiles = Math.ceil(+(sqft * (1 + waste / 100) / per).toFixed(6));   // toFixed: 220.00000000000003 must not round up to 221
    return out;
}

// Pulls "10 x 12", "10 by 12 ft", "3m x 4m", "10ft x 12ft" out of a message. Tile sizes (e.g. 24 x 24 in) are removed first.
function parseRoomSize(text) {
    let t = String(text || '').toLowerCase();
    t = t.replace(/\d+(?:\.\d+)?\s*[x×*]\s*\d+(?:\.\d+)?\s*(?:inches|inch|in|"|cm|mm)\b/g, ' ');
    const m = t.match(/(\d+(?:\.\d+)?)\s*(ft|feet|foot|m|metres|meters|mtr)?\s*(?:[x×*]|by)\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|m|metres|meters|mtr)?/);
    if (!m) return null;
    const u = (m[4] || m[2] || 'ft').toLowerCase();
    const unit = /^(m|metres|meters|mtr)$/.test(u) ? 'm' : 'ft';
    return { length: +m[1], width: +m[3], unit };
}

module.exports = { calcTiles, parseTileSize, parseRoomSize, DEFAULT_WASTE, SQFT_PER_SQM };