// utils/tileMath.js
// Tile quantity and price-per-square-metre maths for the shop counter and for content scripts.
// Quantities always round UP: the customer must never receive less than they need or pay for.

const round2 = n => Math.round((n + Number.EPSILON) * 100) / 100;

function fail(msg) { const e = new Error(msg); e.status = 400; return e; }

function positive(v, label) {
    const n = Number(v);
    if (v === '' || v === null || v === undefined || typeof v === 'boolean' || !Number.isFinite(n) || n <= 0) throw fail(`${label} must be a number greater than 0`);
    return n;
}

// "60x60", "30 x 60", "60X120 cm" -> { w: 60, h: 60 } in cm
function parseSizeCm(v) {
    const m = String(v == null ? '' : v).toLowerCase().replace(/\s+/g, '').replace(/cm$/, '').match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)$/);
    if (!m) throw fail('tile_size_cm must look like 60x60 or 30x60');
    const w = Number(m[1]), h = Number(m[2]);
    if (w <= 0 || h <= 0) throw fail('tile_size_cm must be more than 0');
    return { w, h };
}

// How many tiles (and boxes) cover a floor/wall, including wastage for cuts and breakage.
function estimateTiles({ room_length_m, room_width_m, tile_size_cm, pieces_per_box, wastage_pct }) {
    const length = positive(room_length_m, 'room_length_m');
    const width = positive(room_width_m, 'room_width_m');
    const size = parseSizeCm(tile_size_cm);
    const wastage = (wastage_pct === undefined || wastage_pct === null || wastage_pct === '') ? 10 : Number(wastage_pct);
    if (!Number.isFinite(wastage) || wastage < 0 || wastage > 50) throw fail('wastage_pct must be between 0 and 50');

    const roomArea = length * width;
    const tileArea = (size.w * size.h) / 10000;                     // m2 per tile
    const exact = roomArea / tileArea;
    const pieces = Math.ceil(roomArea * (1 + wastage / 100) / tileArea - 1e-9);
    const out = {
        room_area_m2: round2(roomArea),
        tile_area_m2: round2(tileArea * 10000) / 10000,
        wastage_pct: wastage,
        pieces_without_wastage: Math.ceil(exact - 1e-9),
        pieces_needed: pieces,
    };
    if (pieces_per_box !== undefined && pieces_per_box !== null && pieces_per_box !== '') {
        const ppb = positive(pieces_per_box, 'pieces_per_box');
        if (!Number.isInteger(ppb)) throw fail('pieces_per_box must be a whole number');
        const boxes = Math.ceil(pieces / ppb);
        out.pieces_per_box = ppb;
        out.boxes_needed = boxes;
        out.pieces_bought = boxes * ppb;
        out.spare_pieces = boxes * ppb - pieces;
        out.area_bought_m2 = round2(boxes * ppb * tileArea);
    }
    return out;
}

// Price per square metre from a box price (or a single tile price).
function pricePerSqm({ box_price, tile_price, pieces_per_box, tile_size_cm }) {
    const size = parseSizeCm(tile_size_cm);
    const tileArea = (size.w * size.h) / 10000;
    let perTile;
    if (box_price !== undefined && box_price !== null && box_price !== '') {
        const ppb = positive(pieces_per_box, 'pieces_per_box');
        perTile = positive(box_price, 'box_price') / ppb;
    } else {
        perTile = positive(tile_price, 'tile_price or box_price');
    }
    return { price_per_tile: round2(perTile), price_per_m2: round2(perTile / tileArea), tile_area_m2: round2(tileArea * 10000) / 10000 };
}

module.exports = { estimateTiles, pricePerSqm, parseSizeCm };
