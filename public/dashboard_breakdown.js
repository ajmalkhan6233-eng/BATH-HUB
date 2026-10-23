/* Command centre breakdowns (own module). Click a number on the owner Home page to see what it is made of.
   Needs: #dash-pro (made by dashboard_pro.js) and GET /api/dashboard-pro/breakdown/:key. Touches nothing else. Plain JS. */
(function () {
  'use strict';
  var MAP = { // text on a card -> breakdown key
    'sales today': 'sales_today', 'bills today': 'sales_today', 'daily target': 'sales_today', 'this week': 'sales_week', 'this month': 'sales_month',
    'profit today (est.)': 'profit_today', 'month profit (est.)': 'profit_month', 'expenses today': 'expenses_today',
    'stock value (cost)': 'stock_value', 'stock value (selling)': 'stock_value', 'out of stock': 'stock_out', 'items without price': 'stock_noprice',
    'we owe vendors': 'vendors_owed', 'cheques pending': 'cheques_pending', 'customers owe us': 'customers_owe',
    'stock bought today (grn)': 'grn_today', 'stock bought this month': 'grn_month', 'cancelled bills': 'voids_month', 'not sold in 30 days': 'stock_dead',
    'cash sales today': 'pay_today', 'card + online today': 'pay_today',
    'reorder soon': 'stock_low', 'top sellers this month': 'top_month', 'vendors we owe': 'vendors_owed', 'next cheques': 'cheques_pending',
    'stock by category (cost)': 'stock_value', 'sales by category (this month)': 'cat_month', 'how customers paid today': 'pay_today'
  };
  var css = '#dash-pro .bd-on{cursor:pointer;position:relative;transition:border-color .15s,transform .15s}'
    + '#dash-pro .bd-on:hover{border-color:var(--gold)}#dash-pro .bd-on:active{transform:scale(.99)}'
    + '#dash-pro .bd-on:after{content:"See details \\203A";position:absolute;right:12px;top:12px;font-size:11px;color:var(--gold);opacity:.9}'
    + '#bd-back{position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9998;display:flex;align-items:flex-end;justify-content:center}'
    + '#bd-box{background:var(--card,#1c1c1e);color:var(--text,#fff);border:1px solid var(--card-border,#333);border-radius:16px 16px 0 0;width:100%;max-width:760px;max-height:88dvh;display:flex;flex-direction:column;font-size:14px}'
    + '@media(min-width:760px){#bd-back{align-items:center}#bd-box{border-radius:16px}}'
    + '#bd-box .bd-h{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:14px 16px 8px}#bd-box .bd-t{font-size:17px;font-weight:800}'
    + '#bd-box .bd-x{background:none;border:0;color:inherit;font-size:26px;line-height:1;min-width:44px;min-height:44px;cursor:pointer}'
    + '#bd-box .bd-bar{display:flex;gap:8px;padding:0 16px 8px;flex-wrap:wrap}'
    + '#bd-box input{flex:1;min-width:140px;font-size:16px;padding:9px 12px;border-radius:10px;border:1px solid var(--card-border,#444);background:transparent;color:inherit}'
    + '#bd-box button.bd-b{min-height:44px;padding:0 14px;border-radius:10px;border:1px solid var(--card-border,#444);background:transparent;color:inherit;font-size:13px;cursor:pointer}'
    + '#bd-box .bd-sc{overflow:auto;padding:0 16px;flex:1;-webkit-overflow-scrolling:touch}'
    + '#bd-box table{border-collapse:collapse;width:100%}#bd-box th{position:sticky;top:0;background:var(--card,#1c1c1e);text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--text2,#aaa);padding:8px 6px;cursor:pointer;white-space:nowrap}'
    + '#bd-box td{padding:9px 6px;border-top:1px solid var(--card-border,#333);vertical-align:top}#bd-box .r{text-align:right;white-space:nowrap}'
    + '#bd-box .bd-f{padding:10px 16px 14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:800;border-top:1px solid var(--card-border,#333)}'
    + '#bd-box .bd-n{padding:0 16px 8px;font-size:12px;color:var(--text2,#aaa)}';
  var cur = null, sortCol = -1, sortDir = 1, q = '';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function lkr(v) { return 'LKR ' + Math.round(Number(v) || 0).toLocaleString('en-LK'); }
  function cell(v, t) {
    if (v == null || v === '') return '<td class="' + (t === 'text' ? '' : 'r') + '">-</td>';
    if (t === 'money') return '<td class="r">' + lkr(v) + '</td>';
    if (t === 'num') return '<td class="r">' + Math.round((Number(v) || 0) * 100) / 100 + '</td>';
    return '<td>' + esc(v) + '</td>';
  }
  function rows() {
    var r = cur.rows.slice();
    if (q) r = r.filter(function (x) { return x.join(' ').toLowerCase().indexOf(q) > -1; });
    if (sortCol > -1) r.sort(function (a, b) {
      var x = a[sortCol], y = b[sortCol], nx = Number(x), ny = Number(y);
      if (x == null) return 1; if (y == null) return -1;
      return (isNaN(nx) || isNaN(ny) ? String(x).localeCompare(String(y)) : nx - ny) * sortDir;
    });
    return r;
  }
  function body() {
    var r = rows(), t = cur.columns, h = '<table><thead><tr>';
    t.forEach(function (c, i) { h += '<th data-c="' + i + '" class="' + (c.type === 'text' ? '' : 'r') + '">' + esc(c.label) + (sortCol === i ? (sortDir > 0 ? ' ▲' : ' ▼') : '') + '</th>'; });
    h += '</tr></thead><tbody>';
    if (!r.length) h += '<tr><td colspan="' + t.length + '" style="padding:18px 6px;opacity:.7">Nothing to show yet.</td></tr>';
    r.forEach(function (x) { h += '<tr>' + x.map(function (v, i) { return cell(v, t[i].type); }).join('') + '</tr>'; });
    document.getElementById('bd-sc').innerHTML = h + '</tbody></table>';
    var tot = cur.sum_col == null ? '' : '<span>Total ' + lkr(r.reduce(function (a, x) { return a + (Number(x[cur.sum_col]) || 0); }, 0)) + '</span>';
    document.getElementById('bd-f').innerHTML = '<span>' + r.length + ' row' + (r.length === 1 ? '' : 's') + '</span>' + tot;
    Array.prototype.forEach.call(document.querySelectorAll('#bd-sc th'), function (th) {
      th.onclick = function () { var c = +th.getAttribute('data-c'); sortDir = sortCol === c ? -sortDir : 1; sortCol = c; body(); };
    });
  }
  function csv() {
    var lines = [cur.columns.map(function (c) { return '"' + c.label + '"'; }).join(',')];
    rows().forEach(function (x) { lines.push(x.map(function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(',')); });
    return lines.join('\n');
  }
  function close() { var b = document.getElementById('bd-back'); if (b) b.remove(); document.removeEventListener('keydown', onKey); }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(key) {
    close(); cur = null; sortCol = -1; sortDir = 1; q = '';
    var d = document.createElement('div'); d.id = 'bd-back';
    d.innerHTML = '<div id="bd-box" role="dialog" aria-modal="true"><div class="bd-h"><div class="bd-t" id="bd-t">Loading...</div><button class="bd-x" id="bd-x" aria-label="Close">&times;</button></div>'
      + '<div class="bd-bar"><input id="bd-q" type="search" placeholder="Search in this list" aria-label="Search"><button class="bd-b" id="bd-csv">Download</button><button class="bd-b" id="bd-copy">Copy</button></div>'
      + '<div class="bd-n" id="bd-n"></div><div class="bd-sc" id="bd-sc"></div><div class="bd-f" id="bd-f"></div></div>';
    document.body.appendChild(d); document.addEventListener('keydown', onKey);
    d.onclick = function (e) { if (e.target === d) close(); };
    document.getElementById('bd-x').onclick = close;
    fetch('/api/dashboard-pro/breakdown/' + encodeURIComponent(key), { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) { document.getElementById('bd-t').textContent = 'Could not load. Try again.'; return; }
      cur = j; document.getElementById('bd-t').textContent = j.title; document.getElementById('bd-n').textContent = j.note || '';
      document.getElementById('bd-q').oninput = function (e) { q = e.target.value.toLowerCase(); body(); };
      document.getElementById('bd-csv').onclick = function () {
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv()], { type: 'text/csv' })); a.download = key + '.csv'; a.click();
      };
      document.getElementById('bd-copy').onclick = function () {
        var b = this; try { navigator.clipboard.writeText(csv().replace(/","/g, '\t').replace(/"/g, '')).then(function () { b.textContent = 'Copied'; setTimeout(function () { b.textContent = 'Copy'; }, 1500); }); } catch (e) { b.textContent = 'Not allowed'; }
      };
      body();
    }).catch(function () { document.getElementById('bd-t').textContent = 'Could not load. Try again.'; });
  }
  function mark() {
    var root = document.getElementById('dash-pro'); if (!root) return;
    Array.prototype.forEach.call(root.querySelectorAll('.dp-card'), function (c) {
      var l = c.querySelector('.dp-lab') || c.querySelector('h3'); if (!l) return;
      var k = MAP[l.textContent.trim().toLowerCase()];
      if (k && c.getAttribute('data-bd') !== k) { c.setAttribute('data-bd', k); c.classList.add('bd-on'); c.setAttribute('role', 'button'); c.tabIndex = 0; }
    });
  }
  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var page = document.getElementById('page-dashboard'); if (!page) return;
    new MutationObserver(mark).observe(page, { childList: true, subtree: true });
    page.addEventListener('click', function (e) { var c = e.target.closest && e.target.closest('#dash-pro .bd-on'); if (c && !e.target.closest('button')) open(c.getAttribute('data-bd')); });
    page.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var c = e.target.closest && e.target.closest('#dash-pro .bd-on'); if (c) open(c.getAttribute('data-bd')); } });
    mark();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
