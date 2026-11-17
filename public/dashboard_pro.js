/* Owner dashboard "command centre" (own module). Reads GET /api/dashboard-pro. Adds itself at the top of the Home page; touches nothing else.
   Needs: element #page-dashboard (bathco_complete.html). Plain JS, inline SVG charts, no libraries. Refreshes every 60 s while Home is open. */
(function () {
  'use strict';
  var BOX_ID = 'dash-pro', timer = null, busy = false, lastLoad = 0, manual = false, wasVis = false;
  var css = ''
    + '#page-dashboard>.welcome-banner{display:none}'
    + '#dash-pro .dp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}'
    + '#dash-pro .dp-title{font-weight:700}#dash-pro .dp-sub{font-size:12px;color:var(--text2)}'
    + '#dash-pro .dp-grid{display:grid;align-items:start}'
    + '#dash-pro .dp-grid2{display:grid;align-items:start}'
    + '#dash-pro .dp-card{min-width:0}'
    + '#dash-pro .dp-lab{font-weight:700}'
    + '#dash-pro .dp-val{margin-top:2px;line-height:1.15;word-break:break-word}'
    + '#dash-pro .dp-note{color:var(--text2)}'
    + '#dash-pro .dp-spark{display:block;width:100%;max-width:140px;height:32px;margin-top:6px}'
    + '#dash-pro .up,#dash-pro .down,#dash-pro .warn{color:var(--text2,#555)}'
    + '#dash-pro h3{font-weight:800;margin:0}'
    + '#dash-pro .dp-bar{overflow:hidden;margin:6px 0 4px}'
    + '#dash-pro .dp-bar>i{display:block;height:100%}'
    + '#dash-pro .dp-row{display:flex;justify-content:space-between;gap:10px;border-bottom:1px solid var(--card-border)}'
    + '#dash-pro .dp-row:last-child{border-bottom:0}#dash-pro .dp-row span:first-child{color:var(--text2);min-width:0;overflow:hidden;text-overflow:ellipsis}'
    + '#dash-pro .dp-row b{white-space:nowrap}'
    + '#dash-pro .dp-alert{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:10px;margin-bottom:6px;font-size:13px;background:rgba(201,162,75,.08);border:1px solid rgba(201,162,75,.35)}'
    + '#dash-pro .dp-alert.red{background:rgba(201,162,75,.10);border-color:rgba(201,162,75,.45)}#dash-pro .dp-alert.ok{background:rgba(120,120,120,.08);border-color:rgba(120,120,120,.3)}'
    + '#dash-pro button.dp-btn{background:var(--card);color:inherit;border:1px solid var(--card-border);border-radius:10px;padding:7px 12px;font-size:12px;cursor:pointer}'
    + '#dash-pro svg{display:block;width:100%;height:auto}';

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v) { return Number(v) || 0; }
  function lkr(v) { return 'LKR ' + Math.round(n(v)).toLocaleString('en-LK'); }
  function short(v) { v = n(v); var a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k' : String(Math.round(v)); }
  function pl(c, one, many) { c = n(c); return c + ' ' + (c === 1 ? one : many); }   // 1 bill, 2 bills
  function pct(v) { return v == null ? '-' : n(v).toFixed(0) + '%'; }
  function delta(now, before, label) {
    now = n(now); before = n(before);
    if (!now) return '<span class="dp-note">no sales yet</span>';
    if (!before) return '<span class="dp-note">' + (now ? 'no sales ' + label : 'no sales yet') + '</span>';
    var d = ((now - before) / before) * 100, up = d >= 0;
    return '<span class="' + (up ? 'up' : 'down') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(d).toFixed(0) + '%</span> <span class="dp-note">vs ' + label + '</span>';
  }
  function tile(label, val, sub, extra) { return '<div class="dp-card"><div class="dp-lab">' + label + '</div><div class="dp-val">' + val + '</div><div class="dp-note">' + (sub || '') + '</div>' + (extra || '') + '</div>'; }
  function spark(vals) { return ''; /* no graphics: faster */   // small line of the last days; plain SVG, colour from the theme, nothing to read if there is no data
    vals = (vals || []).map(Number).filter(function (x) { return isFinite(x); });
    if (vals.length < 2 || Math.max.apply(null, vals) <= 0) return '';
    var w = 120, h = 32, mx = Math.max.apply(null, vals), n = vals.length;
    var pts = vals.map(function (v, i) { return (i * (w / (n - 1))).toFixed(1) + ',' + (h - 3 - (v / mx) * (h - 6)).toFixed(1); }).join(' ');
    return '<svg class="dp-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="var(--v2c,#0a6b4a)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }
  function goal(label, done, target, extra) {
    var p = target > 0 ? Math.min(100, (done / target) * 100) : 0, left = Math.max(0, target - done);
    return '<div class="dp-card"><div class="dp-lab">' + label + '</div><div class="dp-val">' + lkr(done) + '</div>'
      + '<div class="dp-bar"><i style="width:' + p.toFixed(0) + '%"></i></div>'
      + '<div class="dp-note"><b>' + p.toFixed(0) + '%</b> of ' + lkr(target) + (left > 0 ? ' · ' + lkr(left) + ' to go' : ' · <span class="up">target reached</span>') + '</div>'
      + (extra ? '<div class="dp-note">' + extra + '</div>' : '') + '</div>';
  }
  function bars(vals, labels, hi) { return ''; /* no graphics */
    var W = 320, H = 110, pad = 18, mx = Math.max.apply(null, vals.concat([1])), bw = (W - 8) / vals.length, out = '';
    vals.forEach(function (v, i) {
      var h = Math.round((v / mx) * (H - pad - 6)), x = 4 + i * bw, fill = i === hi ? 'var(--gold)' : 'rgba(201,162,39,.45)';
      out += '<rect x="' + (x + 1.5).toFixed(1) + '" y="' + (H - pad - h) + '" width="' + Math.max(2, bw - 3).toFixed(1) + '" height="' + Math.max(h, v > 0 ? 2 : 0) + '" rx="2" fill="' + fill + '"><title>' + esc(labels[i]) + ': ' + lkr(v) + '</title></rect>';
      if (vals.length <= 16 || i % 2 === 0) out += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 4) + '" font-size="8.5" text-anchor="middle" fill="currentColor" opacity=".6">' + esc(labels[i]) + '</text>';
    });
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img">' + out + '</svg>';
  }
  function row(l, v) { return '<div class="dp-row"><span>' + l + '</span><b>' + v + '</b></div>'; }
  function fdate(s) { if (!s) return '-'; var d = new Date(s); return isNaN(d) ? '-' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }); }

  function render(d) {
    var S = d.sales, T = d.targets, P = d.profit, st = d.stock, V = d.vendors, C = d.cheques, CU = d.customers_owe, E = d.expenses, h = '';
    var now = new Date();
    h += '<div class="dp-head"><div><div class="dp-title">Hi, AJ! What is the plan for today?</div><div class="dp-sub">' + now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + ' · updated ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</div></div><button class="dp-btn" id="dp-refresh">Refresh</button></div>';
    var lk = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
    h += '<div class="dp-card" style="margin-bottom:12px"><h3>Daily ledger sheet (credit and debit, per day)</h3>'
      + '<input type="date" id="dp-ldate" value="' + lk + '" style="padding:6px;font-size:14px"> '
      + '<button class="dp-btn" onclick="var v=document.getElementById(\'dp-ldate\').value;if(v)location.href=\'/api/daily-ledger-sheet/\'+v+\'.xlsx\'">Download</button>'
      + '<div class="dp-note">Every sale with its receipt number, money out, and the balance.</div></div>';
    /* 1 money today */
    h += '<div class="dp-grid">'
      + tile('Sales today', lkr(S.today), (function (x, y) { return x === y ? x : x + '<br>' + y; })(delta(S.today, S.yesterday, 'yesterday'), delta(S.today, S.same_day_last_week, 'last ' + now.toLocaleDateString('en-GB', { weekday: 'long' }))), spark((d.daily || []).map(function (x) { return x.total; })))
      + tile('Bills today', S.bills_today, 'Average bill ' + lkr(S.avg_bill_today) + (S.discount_today > 0 ? '<br>Discount given ' + lkr(S.discount_today) : ''))
      + tile('Profit today (est.)', P.today.margin_pct == null ? '-' : lkr(P.today.gross_profit), P.today.margin_pct == null ? 'No costed items sold yet' : 'Margin ' + pct(P.today.margin_pct) + ' · costs known for ' + pct(P.today.coverage_pct) + ' of sales')
      + tile('Expenses today', lkr(E.today), 'This month ' + lkr(E.month))
      + '</div>';
    /* 3 alerts */
    var al = [];
    if (V.overdue > 0) al.push(['red', 'Vendor bills OVERDUE: ' + lkr(V.overdue)]);
    if (V.due7 > 0) al.push(['', 'Vendor bills due in 7 days: ' + lkr(V.due7)]);
    if (C.overdue > 0) al.push(['red', 'Cheques overdue: ' + lkr(C.overdue)]);
    if (C.n7 > 0) al.push(['', pl(C.n7, 'cheque', 'cheques') + ' due in 7 days: ' + lkr(C.due7)]);
    if (st.out_of_stock > 0) al.push(['', pl(st.out_of_stock, 'item', 'items') + ' out of stock', 'stockmgr']);
    if (st.low_stock > 0) al.push(['', pl(st.low_stock, 'item', 'items') + ' running low', 'helper']);
    if (st.no_price > 0) al.push(['', pl(st.no_price, 'item has', 'items have') + ' no selling price yet (tap to set prices)', 'helper']);
    if (CU.overdue > 0) al.push(['', 'Customers overdue to pay us: ' + lkr(CU.overdue)]);
    h += '<div class="dp-card" style="margin-bottom:12px"><h3>Needs attention</h3>' + (al.length ? al.map(function (a) { return '<div class="dp-alert ' + a[0] + (a[2] ? ' dp-go' : '') + '"' + (a[2] ? ' data-go="' + a[2] + '" role="button" tabindex="0"' : '') + '>' + esc(a[1]) + (a[2] ? ' <b style="margin-left:auto">\u203A</b>' : '') + '</div>'; }).join('') : '<div class="dp-alert ok">All clear. Nothing urgent.</div>') + '</div>';
    /* 5 stock */
    h += '<div class="dp-grid">'
      + tile('Stock value (cost)', lkr(st.cost_value), n(st.items) + ' items · ' + Math.round(n(st.units)).toLocaleString('en-LK') + ' pieces')
      + tile('Stock value (selling)', lkr(st.retail_value), 'Priced items only')
      + tile('Out of stock', n(st.out_of_stock), 'Low stock: ' + n(st.low_stock))
      + tile('Items without price', n(st.no_price), 'Set them on the Item catalog screen')
      + '</div>';
    h += '<div class="dp-grid2"><div class="dp-card"><h3>Reorder soon</h3>' + (st.low_list.length ? st.low_list.map(function (x) { return row(esc(x.item_code + ' ' + x.name), n(x.stock_level) <= 0 ? '<span class="down">OUT</span>' : n(x.stock_level) + ' left'); }).join('') : '<div class="dp-note">Nothing low.</div>') + '</div>'
      + '<div class="dp-card"><h3>Stock by category (cost)</h3>' + (st.categories.length ? st.categories.map(function (x) { return row(esc(x.category) + ' (' + x.items + ')', lkr(x.cost_value)); }).join('') : '<div class="dp-note">No items.</div>') + '</div>'
      + '<div class="dp-card"><h3>Top sellers this month</h3>' + (d.top_items_month.length ? d.top_items_month.map(function (x) { return row(esc(x.name) + ' ×' + Math.round(x.qty), lkr(x.revenue)); }).join('') : '<div class="dp-note">No sales yet this month.</div>') + '</div></div>';
    /* 6 money owed */
    h += '<div class="dp-grid">'
      + tile('We owe vendors', lkr(V.owed), pl(V.bills, 'open bill', 'open bills'))
      + tile('Cheques pending', lkr(C.pending), pl(C.n, 'cheque', 'cheques') + ' · due in 7 days ' + lkr(C.due7))
      + tile('Customers owe us', lkr(CU.owed_to_us), pl(CU.n, 'open invoice', 'open invoices'))
      + tile('Investor loans owed', lkr((d.investor_loans||{}).outstanding), n((d.investor_loans||{}).n) + ' open · due in 30 days ' + lkr((d.investor_loans||{}).due30))
      + '</div>';
    h += '<div class="dp-grid2"><div class="dp-card"><h3>Vendors we owe</h3>' + (V.list.length ? V.list.map(function (x) { return row(esc(x.vendor_name) + (x.next_due ? ' · due ' + fdate(x.next_due) : ''), lkr(x.owed)); }).join('') : '<div class="dp-note">Nothing owed.</div>') + '</div>'
      + '<div class="dp-card"><h3>Next cheques</h3>' + (C.list.length ? C.list.map(function (x) { return row(esc(x.payee) + ' · ' + fdate(x.due_date), lkr(x.amount)); }).join('') : '<div class="dp-note">No pending cheques.</div>') + '</div></div>';

    /* 7 cash and credit position */
    var cs = d.cash || {}, z = { today: 0, month: 0, all_time: 0 }, cg = function (m) { return cs[m] || z; };
    h += '<div class="dp-grid">'
      + tile('Cash sales today', lkr(cg('cash').today), 'This month ' + lkr(cg('cash').month) + '<br>Since opening ' + lkr(cg('cash').all_time))
      + tile('Card + online today', lkr(cg('card').today + cg('online').today), 'This month ' + lkr(cg('card').month + cg('online').month))
      + tile('Credit given to customers', lkr(cg('credit').month), 'This month · still owed to us ' + lkr(CU.owed_to_us) + '<br>Today ' + lkr(cg('credit').today))
      + tile('Cheques received', lkr(cg('cheque').month), 'This month · today ' + lkr(cg('cheque').today))
      + '</div>';
    var B = d.banks || { total: 0, list: [] };
    h += '<div class="dp-grid2"><div class="dp-card"><h3>Bank balances (as recorded)</h3>' + (B.list.length ? B.list.map(function (x) { return row(esc(x.account_label), lkr(x.current_balance)); }).join('') + row('<b>Total</b>', '<b>' + lkr(B.total) + '</b>') : '<div class="dp-note">No bank accounts recorded yet.</div>') + '</div>'
      + '<div class="dp-card"><h3>Money in and out, this month</h3>'
      + row('Sales', lkr(S.month)) + row('Bought from vendors (GRN)', lkr((d.grn || {}).month)) + row('Expenses', lkr(E.month)) + row('Staff commission', lkr(d.commissions_month)) + row('Fixed monthly costs', lkr((d.overheads || {}).monthly))
      + row('Stock-in less sales (rough)', lkr(n((d.grn || {}).month) - S.month)) + '</div></div>';
    /* 8 purchases (GRN) */
    var G = d.grn || {};
    h += '<div class="dp-grid">'
      + tile('Stock bought today (GRN)', lkr(G.today), 'This week ' + lkr(G.week))
      + tile('Stock bought this month', lkr(G.month), n(G.grns_month) + ' GRN(s)')
      + tile('Stock bought, all time', lkr(G.all_time), n(G.grns) + ' bills (same as GRN > Vendors & summary)')
      + tile('Vendors: paid vs owed', pct(G.all_time > 0 ? ((G.all_time - V.owed) / G.all_time) * 100 : null), 'We owe ' + lkr(V.owed) + ' of ' + lkr(G.all_time))
      + '</div>';
    h += '<div class="dp-card" style="margin-bottom:12px"><h3>Latest GRNs</h3>' + ((G.list || []).length ? G.list.map(function (x) { return row(esc(x.grn_number) + ' · ' + esc(x.supplier || '') + ' · ' + fdate(x.grn_date) + ' · ' + x.lines + ' lines', lkr(x.total)); }).join('') : '<div class="dp-note">No GRNs yet.</div>') + '</div>';
    /* 9 business health */
    var ov = (d.overheads || {}).monthly, cover = n(ov) > 0 && P.month.margin_pct != null ? (P.month.gross_profit / ov) * 100 : null, bs = d.bill_stats || {}, vo = d.voids || {}, dd = d.dead_stock || {}, qo = d.quotes_open || {}, en = d.enquiries || {};
    var wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], wm = {}; (d.weekday || []).forEach(function (x) { wm[x.dow] = n(x.avg_sales); });
    var wv = wd.map(function (_, i) { return wm[i] || 0; }), wb = wv.indexOf(Math.max.apply(null, wv));
    h += '<div class="dp-grid">'
      + tile('Profit covers fixed costs', pct(cover), n(ov) > 0 ? 'Month profit vs ' + lkr(ov) + ' monthly costs' : 'Add rent, salary etc. in Money Control')
      + tile('Pieces per bill', n(bs.bills) ? (n(bs.pieces_month) / n(bs.bills)).toFixed(1) : '-', 'This month · ' + Math.round(n(bs.pieces_month)) + ' pieces sold')
      + tile('Cancelled bills', n(vo.today_n), 'Today ' + lkr(vo.today_value) + ' · month ' + n(vo.month_n) + ' (' + lkr(vo.month_value) + ')')
      + tile('Not sold in 30 days', n(dd.n), 'Stock tied up ' + lkr(dd.cost_value))
      + tile('Open quotations', n(qo.n), lkr(qo.value))
      + tile('Enquiries this week', n(en.week), n(en.new_n) + ' still new')
      + '</div>';
    if (d.missing && d.missing.length) h += '<div class="dp-note">Some figures not available yet: ' + esc(d.missing.join(', ')) + '</div>';
    h += '<div class="dp-note" style="margin:6px 0 2px">Profit is an estimate from items that have a cost. Targets come from Admin Settings.</div>';
    return h;
  }

  function box() {
    var b = el(BOX_ID), page = el('page-dashboard');
    if (!b && page) { b = document.createElement('div'); b.id = BOX_ID; b.innerHTML = '<div class="dp-note" style="padding:10px">Loading your dashboard…</div>'; page.insertBefore(b, page.firstChild); page.classList.add('dp-on'); }
    return b;
  }
  var retries = 0, errTry = 0;
  function load() {
    var b = box(); if (!b || busy) return;
    if (!manual && Date.now() - lastLoad < 8000) return;   // never hammer the server (a failed load used to re-trigger itself in a loop)
    manual = false; lastLoad = Date.now(); busy = true;
    fetch('/api/dashboard-pro', { credentials: 'include' }).then(function (r) { return r.ok ? (r.headers.get('X-Saved-Copy') ? 'keep' : r.json()) : null; }).then(function (d) {
      busy = false; retries = 0; if (d === 'keep') return; if (!d) { b.innerHTML = ''; var pg = el('page-dashboard'); if (pg) pg.classList.remove('dp-on'); return; }
      try { if (!(d.block_errors && d.block_errors.length)) errTry = 0; else if (errTry < 3) { errTry++; setTimeout(function () { manual = true; load(); }, 4000); }   /* some blocks failed on the server: ask again in 4 s (3 times) */
        var html = render(d) + (d.block_errors && d.block_errors.length ? '<div class="dp-note" style="padding:6px">Some numbers did not load (' + esc(d.block_errors.join(', ')) + '). Trying again.</div>' : ''); if (b.getAttribute('data-h') === html) return; var hh = b.offsetHeight; if (hh) b.style.minHeight = hh + 'px'; b.setAttribute('data-h', html); b.innerHTML = html; var rb = el('dp-refresh'); if (rb) rb.onclick = function () { manual = true; load(); }; } catch (e) { console.error('[dashboard_pro]', e); b.innerHTML = ''; var pg2 = el('page-dashboard'); if (pg2) pg2.classList.remove('dp-on'); }
    }).catch(function () { busy = false; var pg3 = el('page-dashboard'); if (pg3) pg3.classList.remove('dp-on'); if (++retries <= 6) setTimeout(function () { manual = true; load(); }, 5000); });   /* 16 Nov: a failed load tries again by itself (6 times, 5 s apart) */
  }
  function visible() { var p = el('page-dashboard'); return p && p.classList.contains('active') && !document.hidden; }
  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var page = el('page-dashboard'); if (!page) return;
    new MutationObserver(function () { var v = !!visible(); if (v && !wasVis) load(); wasVis = v; }).observe(page, { attributes: true, attributeFilter: ['class'] });
    var lo = el('login-overlay'); if (lo) new MutationObserver(function () { if (lo.style.display === 'none' && visible()) setTimeout(load, 400); }).observe(lo, { attributes: true, attributeFilter: ['style', 'class'] });
    document.addEventListener('visibilitychange', function () { if (visible()) load(); });
    timer = setInterval(function () { if (visible()) load(); }, 60000);
    setTimeout(function () { wasVis = !!visible(); if (wasVis) load(); }, 250);   /* 16 Nov: was 1500, Home numbers now start loading sooner */
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.BHDashboardPro = { reload: load };
})();

/* tap a "Needs attention" line to open the screen that fixes it */
(function () {
  var css = document.createElement('style'); css.textContent = '#page-dashboard.dp-on>:not(#dash-pro){display:none!important}#dash-pro .dp-go{cursor:pointer}#dash-pro .dp-go:hover{border-color:var(--gold,#C9A24B)}'; document.head.appendChild(css);
  function go(e) { var c = e.target.closest && e.target.closest('#dash-pro .dp-go'); if (!c) return; if (e.type === 'keydown' && e.key !== 'Enter') return; try { if (window.rbhGo) window.rbhGo(c.getAttribute('data-go')); else if (window.navigate) window.navigate(c.getAttribute('data-go')); } catch (x) { /* ignore */ } }
  document.addEventListener('click', go); document.addEventListener('keydown', go);
})();
