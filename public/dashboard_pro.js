/* Owner dashboard "command centre" (own module). Reads GET /api/dashboard-pro. Adds itself at the top of the Home page; touches nothing else.
   Needs: element #page-dashboard (bathco_complete.html). Plain JS, inline SVG charts, no libraries. Refreshes every 60 s while Home is open. */
(function () {
  'use strict';
  var BOX_ID = 'dash-pro', timer = null, busy = false;
  var css = '#dash-pro{margin-bottom:18px;font-size:14px}'
    + '#page-dashboard>.welcome-banner{display:none}'
    + '#dash-pro .dp-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}'
    + '#dash-pro .dp-title{font-size:20px;font-weight:800}#dash-pro .dp-sub{font-size:12px;color:var(--text2)}'
    + '#dash-pro .dp-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));margin-bottom:12px}'
    + '#dash-pro .dp-grid2{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));margin-bottom:12px}'
    + '#dash-pro .dp-card{background:var(--card);border:1px solid var(--card-border);border-radius:14px;padding:14px 16px;min-width:0}'
    + '#dash-pro .dp-lab{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text2);font-weight:700}'
    + '#dash-pro .dp-val{font-size:24px;font-weight:800;margin-top:4px;line-height:1.15;word-break:break-word}'
    + '#dash-pro .dp-note{font-size:12px;color:var(--text2);margin-top:4px}'
    + '#dash-pro .up{color:#22c55e}#dash-pro .down{color:#ef4444}#dash-pro .warn{color:#f59e0b}'
    + '#dash-pro h3{font-size:14px;font-weight:800;margin:0 0 10px}'
    + '#dash-pro .dp-bar{height:10px;border-radius:6px;background:rgba(127,127,127,.2);overflow:hidden;margin:6px 0 4px}'
    + '#dash-pro .dp-bar>i{display:block;height:100%;border-radius:6px;background:var(--gold)}'
    + '#dash-pro .dp-row{display:flex;justify-content:space-between;gap:10px;padding:6px 0;border-bottom:1px solid var(--card-border);font-size:13px}'
    + '#dash-pro .dp-row:last-child{border-bottom:0}#dash-pro .dp-row span:first-child{color:var(--text2);min-width:0;overflow:hidden;text-overflow:ellipsis}'
    + '#dash-pro .dp-row b{white-space:nowrap}'
    + '#dash-pro .dp-alert{display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:10px;margin-bottom:6px;font-size:13px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.35)}'
    + '#dash-pro .dp-alert.red{background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.4)}#dash-pro .dp-alert.ok{background:rgba(34,197,94,.1);border-color:rgba(34,197,94,.35)}'
    + '#dash-pro button.dp-btn{background:var(--card);color:inherit;border:1px solid var(--card-border);border-radius:10px;padding:7px 12px;font-size:12px;cursor:pointer}'
    + '#dash-pro svg{display:block;width:100%;height:auto}';

  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function n(v) { return Number(v) || 0; }
  function lkr(v) { return 'LKR ' + Math.round(n(v)).toLocaleString('en-LK'); }
  function short(v) { v = n(v); var a = Math.abs(v); return a >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : a >= 1e3 ? (v / 1e3).toFixed(a >= 1e5 ? 0 : 1) + 'k' : String(Math.round(v)); }
  function pct(v) { return v == null ? '-' : n(v).toFixed(0) + '%'; }
  function delta(now, before, label) {
    now = n(now); before = n(before);
    if (!before) return '<span class="dp-note">' + (now ? 'no sales ' + label : 'no sales yet') + '</span>';
    var d = ((now - before) / before) * 100, up = d >= 0;
    return '<span class="' + (up ? 'up' : 'down') + '">' + (up ? '▲ ' : '▼ ') + Math.abs(d).toFixed(0) + '%</span> <span class="dp-note">vs ' + label + '</span>';
  }
  function tile(label, val, sub) { return '<div class="dp-card"><div class="dp-lab">' + label + '</div><div class="dp-val">' + val + '</div><div class="dp-note">' + (sub || '') + '</div></div>'; }
  function goal(label, done, target, extra) {
    var p = target > 0 ? Math.min(100, (done / target) * 100) : 0, left = Math.max(0, target - done);
    return '<div class="dp-card"><div class="dp-lab">' + label + '</div><div class="dp-val">' + lkr(done) + '</div>'
      + '<div class="dp-bar"><i style="width:' + p.toFixed(0) + '%"></i></div>'
      + '<div class="dp-note"><b>' + p.toFixed(0) + '%</b> of ' + lkr(target) + (left > 0 ? ' · ' + lkr(left) + ' to go' : ' · <span class="up">target reached</span>') + '</div>'
      + (extra ? '<div class="dp-note">' + extra + '</div>' : '') + '</div>';
  }
  function bars(vals, labels, hi) {
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
    h += '<div class="dp-head"><div><div class="dp-title">Shop command centre</div><div class="dp-sub">' + now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      + ' · updated ' + now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + '</div></div><button class="dp-btn" id="dp-refresh">Refresh</button></div>';
    /* 1 money today */
    h += '<div class="dp-grid">'
      + tile('Sales today', lkr(S.today), delta(S.today, S.yesterday, 'yesterday') + '<br>' + delta(S.today, S.same_day_last_week, 'last ' + now.toLocaleDateString('en-GB', { weekday: 'long' })))
      + tile('Bills today', S.bills_today, 'Average bill ' + lkr(S.avg_bill_today) + (S.discount_today > 0 ? '<br>Discount given ' + lkr(S.discount_today) : ''))
      + tile('Profit today (est.)', P.today.margin_pct == null ? '-' : lkr(P.today.gross_profit), P.today.margin_pct == null ? 'No costed items sold yet' : 'Margin ' + pct(P.today.margin_pct) + ' · costs known for ' + pct(P.today.coverage_pct) + ' of sales')
      + tile('Expenses today', lkr(E.today), 'This month ' + lkr(E.month))
      + '</div>';
    /* 2 targets */
    var dayPace = T.day_of_month ? (S.month / T.day_of_month) * T.days_in_month : 0, leftDays = Math.max(1, T.days_in_month - T.day_of_month + 1);
    h += '<div class="dp-grid">'
      + goal('Daily target', S.today, T.day)
      + goal('This week', S.week, T.week, delta(S.week, S.last_week_same_point, 'same point last week'))
      + goal('This month', S.month, T.month, delta(S.month, S.last_month_same_point, 'same point last month') + '<br>Pace: ' + lkr(dayPace) + ' by month end · need ' + lkr(Math.max(0, T.month - S.month) / leftDays) + ' a day')
      + tile('Month profit (est.)', P.month.margin_pct == null ? '-' : lkr(P.month.gross_profit), P.month.margin_pct == null ? 'No costed sales yet' : 'Margin ' + pct(P.month.margin_pct) + ' · ' + S.bills_month + ' bills')
      + '</div>';
    /* 3 alerts */
    var al = [];
    if (V.overdue > 0) al.push(['red', 'Vendor bills OVERDUE: ' + lkr(V.overdue)]);
    if (V.due7 > 0) al.push(['', 'Vendor bills due in 7 days: ' + lkr(V.due7)]);
    if (C.overdue > 0) al.push(['red', 'Cheques overdue: ' + lkr(C.overdue)]);
    if (C.n7 > 0) al.push(['', C.n7 + ' cheque(s) due in 7 days: ' + lkr(C.due7)]);
    if (st.out_of_stock > 0) al.push(['', st.out_of_stock + ' item(s) out of stock']);
    if (st.low_stock > 0) al.push(['', st.low_stock + ' item(s) running low']);
    if (st.no_price > 0) al.push(['', st.no_price + ' item(s) have no selling price yet (Prices screen)']);
    if (CU.overdue > 0) al.push(['', 'Customers overdue to pay us: ' + lkr(CU.overdue)]);
    h += '<div class="dp-card" style="margin-bottom:12px"><h3>Needs attention</h3>' + (al.length ? al.map(function (a) { return '<div class="dp-alert ' + a[0] + '">' + esc(a[1]) + '</div>'; }).join('') : '<div class="dp-alert ok">All clear. Nothing urgent.</div>') + '</div>';
    /* 4 trends */
    var dl = d.daily.map(function (x) { return new Date(x.d).getDate(); }), dv = d.daily.map(function (x) { return x.total; });
    var hours = []; for (var i = 8; i <= 20; i++) hours.push(i);
    var hmap = {}; d.hourly.forEach(function (x) { hmap[x.h] = x.total; });
    var hv = hours.map(function (x) { return hmap[x] || 0; }), hmax = hv.indexOf(Math.max.apply(null, hv));
    var pays = d.payments_today, ptot = pays.reduce(function (a, x) { return a + x.amount; }, 0);
    h += '<div class="dp-grid2"><div class="dp-card"><h3>Sales, last 14 days</h3>' + bars(dv, dl, dv.length - 1) + '<div class="dp-note">Best day: ' + lkr(Math.max.apply(null, dv.concat([0]))) + ' · 14-day total ' + lkr(dv.reduce(function (a, b) { return a + b; }, 0)) + '</div></div>'
      + '<div class="dp-card"><h3>Busy hours (last 7 days)</h3>' + bars(hv, hours.map(function (x) { return x + 'h'; }), hmax) + '<div class="dp-note">' + (Math.max.apply(null, hv) > 0 ? 'Busiest around ' + hours[hmax] + ':00' : 'Not enough sales yet') + '</div></div>'
      + '<div class="dp-card"><h3>How customers paid today</h3>' + (pays.length ? pays.map(function (x) { var p = ptot ? (x.amount / ptot) * 100 : 0; return '<div class="dp-row"><span>' + esc(String(x.method).toUpperCase()) + '</span><b>' + lkr(x.amount) + ' · ' + p.toFixed(0) + '%</b></div>'; }).join('') : '<div class="dp-note">No sales yet today.</div>') + '</div></div>';
    /* 5 stock */
    h += '<div class="dp-grid">'
      + tile('Stock value (cost)', lkr(st.cost_value), n(st.items) + ' items · ' + Math.round(n(st.units)).toLocaleString('en-LK') + ' pieces')
      + tile('Stock value (selling)', lkr(st.retail_value), 'Priced items only')
      + tile('Out of stock', n(st.out_of_stock), 'Low stock: ' + n(st.low_stock))
      + tile('Items without price', n(st.no_price), 'Set them on the Prices screen')
      + '</div>';
    h += '<div class="dp-grid2"><div class="dp-card"><h3>Reorder soon</h3>' + (st.low_list.length ? st.low_list.map(function (x) { return row(esc(x.item_code + ' ' + x.name), n(x.stock_level) <= 0 ? '<span class="down">OUT</span>' : n(x.stock_level) + ' left'); }).join('') : '<div class="dp-note">Nothing low.</div>') + '</div>'
      + '<div class="dp-card"><h3>Stock by category (cost)</h3>' + (st.categories.length ? st.categories.map(function (x) { return row(esc(x.category) + ' (' + x.items + ')', lkr(x.cost_value)); }).join('') : '<div class="dp-note">No items.</div>') + '</div>'
      + '<div class="dp-card"><h3>Top sellers this month</h3>' + (d.top_items_month.length ? d.top_items_month.map(function (x) { return row(esc(x.name) + ' ×' + Math.round(x.qty), lkr(x.revenue)); }).join('') : '<div class="dp-note">No sales yet this month.</div>') + '</div></div>';
    /* 6 money owed */
    h += '<div class="dp-grid">'
      + tile('We owe vendors', lkr(V.owed), n(V.bills) + ' open bill(s)')
      + tile('Cheques pending', lkr(C.pending), n(C.n) + ' cheque(s) · due in 7 days ' + lkr(C.due7))
      + tile('Customers owe us', lkr(CU.owed_to_us), n(CU.n) + ' open invoice(s)')
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
      + tile('Stock bought, all time', lkr(G.all_time), n(G.grns) + ' GRNs · ' + Math.round(n(G.units)).toLocaleString('en-LK') + ' pieces')
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
    h += '<div class="dp-grid2"><div class="dp-card"><h3>Average sales by weekday (8 weeks)</h3>' + bars(wv, wd, wb) + '<div class="dp-note">' + (Math.max.apply(null, wv) > 0 ? 'Best day: ' + wd[wb] + ' · ' + lkr(wv[wb]) : 'Not enough days yet') + '</div></div>'
      + '<div class="dp-card"><h3>Sales by category (this month)</h3>' + ((d.category_sales_month || []).length ? d.category_sales_month.map(function (x) { return row(esc(x.category) + ' ×' + Math.round(x.qty), lkr(x.revenue)); }).join('') : '<div class="dp-note">No sales yet this month.</div>') + '</div></div>';
    if (d.missing && d.missing.length) h += '<div class="dp-note">Some figures not available yet: ' + esc(d.missing.join(', ')) + '</div>';
    h += '<div class="dp-note" style="margin:6px 0 2px">Profit is an estimate from items that have a cost. Targets come from Admin Settings.</div>';
    return h;
  }

  function box() {
    var b = el(BOX_ID), page = el('page-dashboard');
    if (!b && page) { b = document.createElement('div'); b.id = BOX_ID; page.insertBefore(b, page.firstChild); }
    return b;
  }
  function load() {
    var b = box(); if (!b || busy) return; busy = true;
    fetch('/api/dashboard-pro', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      busy = false; if (!d) { b.innerHTML = ''; return; }
      try { b.innerHTML = render(d); var rb = el('dp-refresh'); if (rb) rb.onclick = load; } catch (e) { console.error('[dashboard_pro]', e); b.innerHTML = ''; }
    }).catch(function () { busy = false; });
  }
  function visible() { var p = el('page-dashboard'); return p && p.classList.contains('active') && !document.hidden; }
  function start() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var page = el('page-dashboard'); if (!page) return;
    new MutationObserver(function () { if (visible()) load(); }).observe(page, { attributes: true, attributeFilter: ['class'] });
    var lo = el('login-overlay'); if (lo) new MutationObserver(function () { if (lo.style.display === 'none' && visible()) setTimeout(load, 400); }).observe(lo, { attributes: true, attributeFilter: ['style', 'class'] });
    document.addEventListener('visibilitychange', function () { if (visible()) load(); });
    timer = setInterval(function () { if (visible()) load(); }, 60000);
    setTimeout(function () { if (visible()) load(); }, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.BHDashboardPro = { reload: load };
})();
