/* RBH charts: dependency-free SVG (rounded bars, diverging bars, ring, sparkline, donut, heatmap, tubes).
   Pure string builders, no DOM needed, so Node can test them. 11 Nov 2026. */
(function (root) {
  'use strict';
  var C = { gold: '#E8B04A', gold2: '#F5D08A', green: '#b8934a', red: '#6b5a3a', blue: '#8a8f98', violet: '#a8895a', grey: '#8b97ad', track: 'rgba(148,163,184,.22)' };
  function n(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function f(v) { return Math.round(v * 10) / 10; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function rs(v) { v = n(v); var a = Math.abs(v); if (a >= 1e6) return 'Rs ' + f(v / 1e6) + 'M'; if (a >= 1e3) return 'Rs ' + f(v / 1e3) + 'k'; return 'Rs ' + Math.round(v); }
  function rsFull(v) { return 'Rs ' + Math.round(n(v)).toLocaleString('en-US'); }
  function max(a) { var m = 0; for (var i = 0; i < a.length; i++) if (a[i] > m) m = a[i]; return m; }
  /* geometry helpers (tested) */
  function barRects(vals, w, h, gap) {
    var m = max(vals) || 1, k = vals.length || 1, bw = Math.max(2, (w - gap * (k - 1)) / k), out = [];
    for (var i = 0; i < k; i++) { var bh = n(vals[i]) / m * h; out.push({ x: f(i * (bw + gap)), y: f(h - bh), w: f(bw), h: f(bh) }); }
    return out;
  }
  function diverge(vals, w, h) {
    var k = vals.length || 1, avg = 0; for (var i = 0; i < k; i++) avg += n(vals[i]); avg = avg / k;
    var dev = vals.map(function (v) { return n(v) - avg; }), m = 0; dev.forEach(function (d) { if (Math.abs(d) > m) m = Math.abs(d); }); m = m || 1;
    var mid = h / 2, bw = Math.max(2, w / k - 3), out = [];
    dev.forEach(function (d, i) { var bh = Math.abs(d) / m * (mid - 2); out.push({ x: f(i * (w / k) + 1.5), y: f(d >= 0 ? mid - bh : mid), w: f(bw), h: f(bh), up: d >= 0, dev: d }); });
    return { avg: avg, mid: mid, bars: out };
  }
  function ringDash(pct, r) { var c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, n(pct))); return { c: f(c), on: f(c * p), off: f(c * (1 - p)) }; }
  function sparkPoints(vals, w, h) {
    var m = max(vals) || 1, k = vals.length, pts = [];
    for (var i = 0; i < k; i++) pts.push((k === 1 ? w / 2 : f(i * w / (k - 1))) + ',' + f(h - 2 - n(vals[i]) / m * (h - 4)));
    return pts.join(' ');
  }
  function donutArcs(vals, r) {
    var tot = 0; vals.forEach(function (v) { tot += Math.max(0, n(v)); }); var c = 2 * Math.PI * r, off = 0, out = [];
    vals.forEach(function (v) { var l = tot ? Math.max(0, n(v)) / tot * c : 0; out.push({ len: f(l), gap: f(c - l), off: f(-off) }); off += l; });
    return { total: tot, arcs: out };
  }
  /* svg builders */
  function bars(vals, labels, o) {
    o = o || {}; var w = o.w || 320, h = o.h || 120, g = 4, r = barRects(vals, w, h, g), hi = vals.indexOf(max(vals)), s = '<svg viewBox="0 0 ' + w + ' ' + (h + 16) + '" role="img" aria-label="' + esc(o.label || 'bars') + '">';
    s += '<defs><linearGradient id="rcg' + (o.id || 'a') + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + C.gold2 + '"/><stop offset="1" stop-color="' + C.gold + '"/></linearGradient></defs>';
    r.forEach(function (b, i) { s += '<rect class="rc-bar" style="--i:' + i + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + Math.max(b.h, 1) + '" rx="' + f(Math.min(6, b.w / 2)) + '" fill="' + (i === hi ? 'url(#rcg' + (o.id || 'a') + ')' : 'rgba(232,176,74,.45)') + '"><title>' + esc((labels && labels[i]) || '') + ' ' + rsFull(vals[i]) + '</title></rect>'; });
    if (labels) { var step = Math.ceil(labels.length / 7); labels.forEach(function (l, i) { if (i % step === 0) s += '<text x="' + f(r[i].x + r[i].w / 2) + '" y="' + (h + 12) + '" text-anchor="middle" font-size="9" fill="' + C.grey + '">' + esc(l) + '</text>'; }); }
    return s + '</svg>';
  }
  function mirrored(vals, labels, o) {
    o = o || {}; var w = o.w || 320, h = o.h || 150, d = diverge(vals, w, h), s = '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(o.label || 'above and below average') + '">';
    s += '<line x1="0" x2="' + w + '" y1="' + d.mid + '" y2="' + d.mid + '" stroke="' + C.grey + '" stroke-dasharray="3 3" opacity=".7"/>';
    d.bars.forEach(function (b, i) { s += '<rect class="rc-bar" style="--i:' + i + ';transform-origin:50% ' + (b.up ? '100%' : '0') + '" x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + Math.max(b.h, 1) + '" rx="' + f(Math.min(5, b.w / 2)) + '" fill="' + (b.up ? C.green : C.red) + '"><title>' + esc((labels && labels[i]) || '') + ' ' + (b.up ? '+' : '-') + rs(Math.abs(b.dev)) + ' vs average</title></rect>'; });
    s += '<text x="2" y="10" font-size="9" fill="' + C.green + '">above average</text><text x="2" y="' + (h - 3) + '" font-size="9" fill="' + C.red + '">below</text>';
    return s + '</svg>';
  }
  function hbars(rows, o) { /* rows: [{name,value}] */
    o = o || {}; var m = max(rows.map(function (r) { return n(r.value); })) || 1, s = '';
    rows.forEach(function (r, i) { var p = Math.max(2, n(r.value) / m * 100); s += '<div style="margin:7px 0"><div class="dm-row" style="padding:0 0 3px"><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.name) + '</span><b>' + esc(r.text != null ? r.text : rsFull(r.value)) + '</b></div><div style="height:9px;border-radius:9px;background:' + C.track + ';overflow:hidden"><div class="rc-hbar" style="--i:' + i + ';width:' + f(p) + '%;height:100%;border-radius:9px;background:linear-gradient(90deg,' + C.gold + ',' + C.gold2 + ')"></div></div></div>'; });
    return s;
  }
  function ring(pct, big, small, o) {
    o = o || {}; var r = 46, d = ringDash(pct, r), col = o.color || C.gold;
    return '<svg viewBox="0 0 120 120" role="img" aria-label="' + esc(small || 'progress') + '" style="max-width:180px;margin:0 auto"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + C.track + '" stroke-width="11"/><circle class="rc-ring" cx="60" cy="60" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="11" stroke-linecap="round" stroke-dasharray="' + d.c + '" stroke-dashoffset="' + d.c + '" transform="rotate(-90 60 60)" data-off="' + f(d.c - d.on) + '"/><text x="60" y="58" text-anchor="middle" font-size="19" font-weight="800" fill="currentColor">' + esc(big) + '</text><text x="60" y="74" text-anchor="middle" font-size="9" fill="' + C.grey + '">' + esc(small || '') + '</text></svg>';
  }
  function spark(vals, color) {
    if (!vals || vals.length < 2) return '';
    return '<svg class="dm-spark" viewBox="0 0 84 34" aria-hidden="true"><polyline class="rc-line" pathLength="1" fill="none" stroke="' + (color || C.gold) + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" points="' + sparkPoints(vals, 84, 34) + '"/></svg>';
  }
  var PAL = [C.gold, C.blue, C.green, C.violet, C.red, C.grey];
  function donut(rows, o) { /* rows [{name,value}] */
    o = o || {}; var r = 40, d = donutArcs(rows.map(function (x) { return x.value; }), r), s = '<svg viewBox="0 0 120 120" role="img" aria-label="' + esc(o.label || 'share') + '" style="max-width:170px;margin:0 auto"><circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + C.track + '" stroke-width="16"/>';
    d.arcs.forEach(function (a, i) { if (a.len > 0) s += '<circle class="rc-seg" style="--i:' + i + '" cx="60" cy="60" r="' + r + '" fill="none" stroke="' + PAL[i % PAL.length] + '" stroke-width="16" stroke-dasharray="' + a.len + ' ' + a.gap + '" stroke-dashoffset="' + a.off + '" transform="rotate(-90 60 60)"/>'; });
    s += '<text x="60" y="58" text-anchor="middle" font-size="12" font-weight="800" fill="currentColor">' + esc(rs(d.total)) + '</text><text x="60" y="72" text-anchor="middle" font-size="8" fill="' + C.grey + '">today</text></svg><div class="dm-legend">';
    rows.forEach(function (x, i) { s += '<span><i style="background:' + PAL[i % PAL.length] + '"></i>' + esc(x.name) + ' ' + (d.total ? Math.round(n(x.value) / d.total * 100) : 0) + '%</span>'; });
    return s + '</div>';
  }
  function heat(vals, labels, o) { /* 24 hourly cells */
    o = o || {}; var m = max(vals) || 1, k = vals.length, cols = o.cols || 12, cw = 26, ch = 26, rows = Math.ceil(k / cols), s = '<svg viewBox="0 0 ' + (cols * cw) + ' ' + (rows * ch + 4) + '" role="img" aria-label="busy hours">';
    vals.forEach(function (v, i) { var a = n(v) / m, x = (i % cols) * cw, y = Math.floor(i / cols) * ch; s += '<rect class="rc-heat" style="--i:' + i + '" x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (cw - 3) + '" height="' + (ch - 3) + '" rx="6" fill="' + C.gold + '" fill-opacity="' + f(0.1 + a * 0.9) + '"><title>' + esc((labels && labels[i]) || i) + ' ' + rsFull(v) + '</title></rect><text x="' + (x + cw / 2) + '" y="' + (y + ch / 2 + 3) + '" text-anchor="middle" font-size="8" fill="' + (a > 0.55 ? '#1b1f26' : C.grey) + '" pointer-events="none">' + esc((labels && labels[i]) || i) + '</text>'; });
    return s + '</svg>';
  }
  function tubes(rows) { /* [{name,level,max}] low stock: how full vs reorder level */
    var s = '<div style="display:flex;gap:14px;flex-wrap:wrap;justify-content:flex-start">';
    rows.forEach(function (r, i) { var p = Math.max(0.04, Math.min(1, n(r.level) / (n(r.max) || 1))), col = p < 0.34 ? C.red : p < 0.67 ? C.gold : C.green; s += '<div style="width:54px;text-align:center"><svg viewBox="0 0 40 90" style="width:34px;margin:0 auto" role="img" aria-label="' + esc(r.name) + '"><rect x="6" y="4" width="28" height="82" rx="14" fill="none" stroke="' + C.track + '" stroke-width="3"/><clipPath id="tb' + i + '"><rect x="8" y="6" width="24" height="78" rx="12"/></clipPath><rect class="rc-tube" style="--i:' + i + '" clip-path="url(#tb' + i + ')" x="8" y="' + f(84 - p * 78) + '" width="24" height="' + f(p * 78) + '" fill="' + col + '"/></svg><div style="font-size:10px;line-height:1.2;margin-top:3px;word-break:break-word">' + esc(String(r.name).slice(0, 14)) + '</div><b style="font-size:11px">' + esc(r.level) + '</b></div>'; });
    return s + '</div>';
  }
  var API = { C: C, rs: rs, rsFull: rsFull, barRects: barRects, diverge: diverge, ringDash: ringDash, sparkPoints: sparkPoints, donutArcs: donutArcs, bars: bars, mirrored: mirrored, hbars: hbars, ring: ring, spark: spark, donut: donut, heat: heat, tubes: tubes, esc: esc };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.RBHCharts = API;
})(typeof window !== 'undefined' ? window : globalThis);
