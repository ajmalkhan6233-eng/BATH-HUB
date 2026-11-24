/* Home (solid), 18 Nov 2026. One screen, small steady numbers, straight from /api/home-solid (read-only).
   Replaces the paused Home: the old dashboard code stays in public/ (not deleted). To go back: put the dashboard_pause.js line back in bathco_complete.html. */
(function () {
  'use strict';
  var st = document.createElement('style');
  st.textContent = '#page-dashboard#page-dashboard::before{display:none!important;content:none!important}#page-dashboard>*:not(#dash-solid){display:none!important}#page-dashboard#page-dashboard>#dash-solid#dash-solid#dash-solid{display:block!important}' +
    '#dash-solid{max-width:980px;margin:0 auto;padding:10px 12px;color:var(--ink,#0f172a);font:14px/1.35 system-ui,"Segoe UI",sans-serif}' +
    '#dash-solid .hs-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px}#dash-solid h2{margin:0;font-size:16px}#dash-solid .hs-at{font-size:12px;color:var(--muted,#596577)}' +
    '#dash-solid .hs-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}@media(max-width:760px){#dash-solid .hs-grid{grid-template-columns:repeat(2,1fr)}}' +
    '#dash-solid .hs-t{background:var(--card,#fff);border:1px solid var(--line,#dbe0e8);border-radius:10px;padding:8px 10px;min-width:0}' +
    '#dash-solid .hs-l{font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted,#596577)}#dash-solid .hs-v{font-size:20px;font-weight:700;margin:2px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '#dash-solid .hs-s{font-size:12px;color:var(--muted,#596577)}#dash-solid .hs-w{color:#b3261e}' +
    '#dash-solid .hs-c{margin-top:8px;background:var(--card,#fff);border:1px solid var(--line,#dbe0e8);border-radius:10px;padding:8px 10px}' +
    '#dash-solid .hs-c div{display:flex;gap:8px;font-size:13px;padding:2px 0}#dash-solid .ok{color:#1b7a46;font-weight:700;min-width:16px}#dash-solid .no{color:#b3261e;font-weight:700;min-width:16px}';
  document.head.appendChild(st);
  var box = null, last = null, busy = false;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var rs = function (n) { return 'Rs ' + Math.round(Number(n || 0)).toLocaleString('en-LK'); };
  var dm = function (d) { return String(d || '').slice(8, 10) + '-' + String(d || '').slice(5, 7); };
  function tile(l, v, s, warn) { return '<div class="hs-t"><div class="hs-l">' + l + '</div><div class="hs-v">' + v + '</div><div class="hs-s' + (warn ? ' hs-w' : '') + '">' + s + '</div></div>'; }
  function draw(d, err) {
    var S = d.sales, R = d.result, K = d.stock, V = d.vendors, C = d.cheques, nx = C.next[0];
    var t = new Date(d.as_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' });
    var sub = document.getElementById('page-sub'); if (sub && visible()) sub.textContent = err ? 'Numbers may be old' : 'Confirmed numbers, as at ' + t;
    box.innerHTML = '<div class="hs-top"><h2>Home</h2><span class="hs-at">' + (err ? '<span class="hs-w">' + esc(err) + ' · showing ' + t + '</span>' : 'as at ' + t) + '</span></div><div class="hs-grid">' +
      tile('Sales today', rs(S.today.sales), S.today.n + ' bill' + (S.today.n === 1 ? '' : 's')) +
      tile('Profit today', rs(S.today.profit), 'sale minus cost') +
      tile('Yesterday', rs(S.yesterday.sales), S.yesterday.n + ' bills · profit ' + rs(S.yesterday.profit)) +
      tile('This month', rs(S.month.sales), S.month.n + ' bills · profit ' + rs(S.month.profit)) +
      tile('Net profit today', R.today == null ? '—' : rs(R.today), 'profit minus ' + rs(R.per_day) + ' a day') +
      tile('Net profit since ' + dm(R.from), rs(R.since), R.days + ' days · ' + rs(R.per_day) + ' a day taken off') +
      tile('Jazeel commission', rs(R.jazeel_week), R.commission_pct + '% of profit, this week' + (R.unassigned ? ' · ' + R.unassigned + ' bills no salesman' : '')) +
      tile('Stock at cost', rs(K.cost), K.units.toLocaleString('en-LK') + ' units · ' + K.items + ' items') +
      tile('Stock at selling', rs(K.sell), K.no_price ? K.no_price + ' items without price' : 'all priced', K.no_price > 0) +
      tile('We owe vendors', rs(V.owed), V.overdue > 0 ? rs(V.overdue) + ' cheque date passed, confirm cleared' : (V.pending_bills ? V.pending_bills + ' bill' + (V.pending_bills === 1 ? '' : 's') + ' pending: confirm payment date' : 'all dates set'), V.overdue > 0) +
      tile('Cheques to pay', rs(C.amount), C.count + ' cheques' + (nx ? ' · next ' + dm(nx.due) + ' ' + rs(nx.amount) : '')) +
      '</div><div class="hs-c"><div class="hs-l">Do the numbers match?</div>' + d.checks.map(function (c) { return '<div' + (!c.ok && c.key === 'stock' ? ' data-fix="stock" style="cursor:pointer;text-decoration:underline" title="Tap to see which items"' : '') + '><span class="' + (c.ok ? 'ok' : 'no') + '">' + (c.ok ? '✓' : '!') + '</span><span>' + esc(c.label) + (c.note ? ' <span class="hs-s' + (c.ok ? '' : ' hs-w') + '">(' + esc(c.note) + ')</span>' : '') + '</span></div>'; }).join('') + '</div>' +
      '<div class="hs-c"><div class="hs-l">Where the ' + rs(R.per_day) + ' a day goes (rough)</div>' + (R.breakdown || []).map(function (x) { return '<div><span style="flex:1">' + esc(x.label) + '</span><b>' + rs(x.amount) + '</b></div>'; }).join('') + '</div>' +
      '<div class="hs-c"><div class="hs-l">Owed most</div>' + V.top.map(function (v) { return '<div><span style="flex:1">' + esc(v.name) + '</span><b>' + rs(v.owed) + '</b></div>'; }).join('') + '</div>';
  }
  // red stock line: tap -> list of the items that do not match, each with two safe buttons (asks before it changes anything)
  function fixBox() {
    var back = document.createElement('div'); back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
    var bx = document.createElement('div'); bx.style.cssText = 'background:#fff;color:#111;border-radius:12px;width:min(720px,95vw);max-height:85vh;overflow:auto;padding:14px 16px;font:14px system-ui,sans-serif';
    back.appendChild(bx); document.body.appendChild(back); back.addEventListener('mousedown', function (e) { if (e.target === back) back.remove(); });
    function go() {
      bx.innerHTML = '<b style="font-size:16px">Stock that the books do not explain</b> <button type="button" id="hsx" style="float:right;border:0;background:none;font-size:22px;cursor:pointer">&times;</button><div style="margin:6px 0;color:#555">Books = bought (GRN) - sold - returned. Pick what is true for each item.</div><div id="hsl">Loading...</div>';
      bx.querySelector('#hsx').onclick = function () { back.remove(); };
      fetch('/api/home-solid/stock-gap', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (d) {
        var l = bx.querySelector('#hsl'); if (!d.items || !d.items.length) { l.textContent = 'Nothing left to fix. Press Refresh on Home.'; return; }
        l.innerHTML = ''; d.items.forEach(function (x) {
          var r = document.createElement('div'); r.style.cssText = 'border-top:1px solid #ddd;padding:8px 0';
          r.innerHTML = '<b>' + esc(x.item_code) + '</b> ' + esc(x.name) + '<div style="color:#555">Shelf stock ' + x.stock + ' · books say ' + x.explained + ' (bought ' + x.grn + ', sold ' + x.sold + ', returned ' + x.ret + ') · difference ' + x.gap + '</div>';
          [['confirm', 'Shelf is right: confirm ' + x.stock], ['set', 'Books are right: set stock to ' + x.explained]].forEach(function (m) {
            var b = document.createElement('button'); b.type = 'button'; b.textContent = m[1]; b.style.cssText = 'margin:6px 8px 0 0;min-height:38px;padding:0 12px;border-radius:8px;border:1px solid #c9a24b;background:#fff8e6;cursor:pointer';
            b.onclick = function () { if (!confirm(m[1] + ' for ' + x.item_code + '?')) return; b.disabled = true; fetch('/api/home-solid/stock-fix', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_code: x.item_code, mode: m[0] }) }).then(function (z) { return z.json(); }).then(function (z) { if (z.error) alert(z.error); go(); load(); }); };
            r.appendChild(b);
          }); l.appendChild(r);
        });
      }).catch(function () { bx.querySelector('#hsl').textContent = 'Could not load the list.'; });
    }
    go();
  }
  document.addEventListener('click', function (e) { var t = e.target.closest && e.target.closest('[data-fix="stock"]'); if (t) fixBox(); });
  function load() {
    if (busy || !box) return; busy = true;
    fetch('/api/home-solid', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Please log in as owner' : 'Could not load numbers'); return r.json(); })
      .then(function (d) { last = d; draw(d); }).catch(function (e) { if (last) draw(last, e.message); else box.innerHTML = '<div class="hs-t"><div class="hs-l">Home</div><div class="hs-v">—</div><div class="hs-s hs-w">' + esc(e.message) + ' (no number is shown rather than a wrong one)</div></div>'; })
      .then(function () { busy = false; });
  }
  function visible() { var p = document.getElementById('page-dashboard'); return p && p.classList.contains('active') && !document.hidden; }
  function start() {
    var pg = document.getElementById('page-dashboard'); if (!pg) return;
    box = document.createElement('div'); box.id = 'dash-solid'; box.innerHTML = '<div class="hs-s">Loading…</div>'; pg.appendChild(box);
    new MutationObserver(function () { if (visible()) load(); }).observe(pg, { attributes: true, attributeFilter: ['class'] });
    var lo = document.getElementById('login-overlay'); if (lo) new MutationObserver(function () { if (lo.style.display === 'none') setTimeout(load, 400); }).observe(lo, { attributes: true, attributeFilter: ['style', 'class'] });
    document.addEventListener('visibilitychange', function () { if (visible()) load(); });
    setInterval(function () { if (visible()) load(); }, 60000);
    setTimeout(load, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
