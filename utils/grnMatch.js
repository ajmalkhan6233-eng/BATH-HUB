'use strict';
// GRN smart item match (plain JS, no database extension). Pure functions: given the text printed on a vendor bill and the
// shop's item list, find the item it most likely is. Sizes matter: "1/2 inch tap" must never match "3/4 inch tap".
const FR = { '1/2': ' half ', '3/4': ' threequarter ', '1/4': ' quarter ', '1 1/2': ' onehalf ', '1 1/4': ' onequarter ' };
function norm(s) {
  let t = ' ' + String(s || '').toLowerCase() + ' ';
  t = t.replace(/(\d)\s*("|''|in\b|inch(es)?\b)/g, '$1 inch ').replace(/(\d)\s*mm\b/g, '$1 mm ').replace(/(\d)\s*cm\b/g, '$1 cm ');
  Object.keys(FR).sort((a, b) => b.length - a.length).forEach(k => { t = t.split(' ' + k + ' ').join(FR[k]).split(k).join(FR[k]); });
  return t.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
const tokens = s => norm(s).split(' ').filter(Boolean);
const SIZE = /^(\d+(x\d+)*|half|threequarter|quarter|onehalf|onequarter)$/;
const sizes = toks => toks.filter(t => SIZE.test(t)).sort().join('|');
function trigrams(s) { const t = '  ' + s + ' ', g = new Set(); for (let i = 0; i < t.length - 2; i++) g.add(t.slice(i, i + 3)); return g; }
function dice(a, b) { if (!a.size || !b.size) return 0; let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return (2 * n) / (a.size + b.size); }
function score(a, b) {
  const na = norm(a), nb = norm(b); if (!na || !nb) return 0; if (na === nb) return 1;
  const ta = new Set(na.split(' ')), tb = new Set(nb.split(' ')); let both = 0; ta.forEach(x => { if (tb.has(x)) both++; });
  const jac = both / (ta.size + tb.size - both);
  let s = 0.6 * dice(trigrams(na), trigrams(nb)) + 0.4 * jac;
  const sa = sizes([...ta]), sb = sizes([...tb]);
  if (sa && sb && sa !== sb) s *= 0.55;            // different sizes: almost never the same item
  return Math.round(s * 1000) / 1000;
}
const GREEN = 0.82, AMBER = 0.45, GAP = 0.08;
// products: [{item_code, name}]. memory: Map(text_key -> item_code) for this vendor. Returns {status, how, item, alts}.
function matchLine(line, products, memory) {
  const text = String((line && line.name) || '').trim(), code = String((line && line.code) || '').trim().toLowerCase();
  const byCode = new Map(products.map(p => [String(p.item_code || '').toLowerCase(), p]));
  const pick = p => ({ item_code: p.item_code, name: p.name });
  if (!text && !code) return { status: 'new', how: 'empty', item: null, alts: [] };
  const mem = memory && memory.get(norm(text));
  if (mem && byCode.get(String(mem).toLowerCase())) return { status: 'green', how: 'remembered', item: pick(byCode.get(String(mem).toLowerCase())), alts: [] };
  if (code && byCode.get(code)) return { status: 'green', how: 'code', item: pick(byCode.get(code)), alts: [] };
  const ranked = products.map(p => ({ p, s: score(text, p.name) })).filter(x => x.s >= AMBER).sort((a, b) => b.s - a.s).slice(0, 3);
  if (!ranked.length) return { status: 'new', how: 'none', item: null, alts: [] };
  const alts = ranked.map(x => Object.assign(pick(x.p), { score: x.s }));
  const tie = ranked.length > 1 && ranked[0].s - ranked[1].s < 0.001;   // two shop items look the same (same name, different codes): the owner picks
  if (!tie && ranked[0].s >= GREEN && (ranked.length === 1 || ranked[0].s - ranked[1].s >= GAP || ranked[0].s === 1)) return { status: 'green', how: ranked[0].s === 1 ? 'name' : 'similar', item: alts[0], alts };
  return { status: 'amber', how: 'similar', item: null, alts };
}
module.exports = { norm, tokens, score, matchLine, GREEN, AMBER };
