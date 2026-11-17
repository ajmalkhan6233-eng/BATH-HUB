'use strict';
/**
 * One look-picker for EVERY receipt and voucher (customer receipt PNG, vendor voucher, anything that follows).
 * Every 2 days (Colombo) it picks a photo set AND a header colour, pseudo-randomly, never the same as the window before,
 * so it keeps surprising AJ. Same window = same look, so a re-sent receipt matches the first one.
 * New sets: drop setN_top.jpg / setN_mid.jpg / setN_foot.jpg into public/brand/receipt-sets/ and they join (N up to 40).
 */
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..', 'public', 'brand', 'receipt-sets');
// Deep, rich colours: gold and white letters stay clear on all of them.
const PALETTE = [
  { name: 'Midnight Navy', hex: '#12284c' }, { name: 'Emerald', hex: '#0e4d3c' }, { name: 'Royal Plum', hex: '#3d1a5c' },
  { name: 'Burgundy', hex: '#5a1428' }, { name: 'Deep Teal', hex: '#0b4a52' }, { name: 'Sapphire', hex: '#123c8c' },
  { name: 'Espresso', hex: '#4a2a18' }, { name: 'Indigo', hex: '#2b2f6b' }, { name: 'Forest', hex: '#1c4a1f' }, { name: 'Ruby Wine', hex: '#6b1530' },
];
const rgbOf = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
const hash = n => { let x = (n * 2654435761) >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return x >>> 0; };
function sets() {
  const ok = [];
  for (let n = 1; n <= 40; n++) if (['top', 'mid', 'foot'].every(p => fs.existsSync(path.join(DIR, `set${n}_${p}.jpg`)))) ok.push(n);
  return ok;
}
function windowOf(now) { return Math.floor(((now == null ? Date.now() : now) + 19800000) / 86400000 / 2); }
function raw(w, list) { return { set: list.length ? list[hash(w * 7 + 1) % list.length] : null, color: hash(w * 13 + 5) % PALETTE.length }; }
function lookOf(w, list) {
  const a = raw(w, list), b = raw(w - 1, list);
  if (list.length > 1 && a.set === b.set) a.set = list[(list.indexOf(a.set) + 1) % list.length];
  if (a.color === b.color) a.color = (a.color + 1 + hash(w) % (PALETTE.length - 1)) % PALETTE.length;
  return a;
}
function pick(now) {
  try {
    const list = sets(), w = windowOf(now), a = lookOf(w, list), prev = lookOf(w - 1, list);
    if (list.length > 1 && a.set === prev.set) a.set = list[(list.indexOf(a.set) + 1) % list.length];
    if (a.color === prev.color) a.color = (a.color + 1) % PALETTE.length;
    const p = PALETTE[a.color];
    return { set: a.set, color: p.name, hex: p.hex, rgb: rgbOf(p.hex) };
  } catch (e) { return { set: null, color: PALETTE[0].name, hex: PALETTE[0].hex, rgb: rgbOf(PALETTE[0].hex) }; }
}
// A NEW look for EVERY bill: the bill number picks it (same bill = same look everywhere, next bill never repeats the one before).
function pickFor(billNo) {
  const m = String(billNo == null ? '' : billNo).match(/(\d+)\s*$/); if (!m) return pick();
  try {
    const list = sets(), a = lookOf(Number(m[1]) + 1000, list), p = PALETTE[a.color];
    return { set: a.set, color: p.name, hex: p.hex, rgb: rgbOf(p.hex) };
  } catch (e) { return pick(); }
}
module.exports = { pick, pickFor, sets, PALETTE, DIR };
