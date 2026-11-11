/* BLOCK: dashboard_modern. Modern chart panel above #dash-pro. Reads /api/dashboard-pro (+ /api/reorder-forecast). Read-only. 11 Nov 2026 */
(function () {
  'use strict';
  var Ch = window.RBHCharts; if (!Ch) return;
  var CACHE = 'rbh_dm_cache';
  function num(v) { v = Number(v); return isFinite(v) ? v : 0; }
  function chip(now, was) {
    if (!was) return '<span class="dm-chip flat">new</span>';
    var p = Math.round((now - was) / was * 100); if (p === 0) return '<span class="dm-chip flat">same as before</span>';
    return '<span class="dm-chip ' + (p > 0 ? 'up' : 'down') + '">' + (p > 0 ? '+' : '') + p + '%</span>';
  }
  function card(lab, val, extra, sp) { return '<div class="dm-card ra-card-in ra-lift"><div class="dm-lab">' + lab + '</div><div class="dm-val">' + val + '</div>' + (extra || '') + (sp || '') + '</div>'; }
  function build(d, fc) {
    var s = d.sales || {}, t = d.targets || {}, daily = (d.daily || []).slice(-14), hourly = d.hourly || [], pay = (d.payments_today || []).filter(function (x) { return num(x.amount) > 0; });
    var dv = daily.map(function (x) { return num(x.total); }), dl = daily.map(function (x) { return String(x.d || '').slice(8, 10); });
    var hv = [], hl = []; for (var h = 6; h < 22; h++) { var row = hourly.filter(function (x) { return num(x.h) === h; })[0]; hv.push(row ? num(row.total) : 0); hl.push(h > 12 ? h - 12 : h); }
    var goal = num(t.month) ? num(s.month) / num(t.month) : 0, weekGoal = num(t.week) ? num(s.week) / num(t.week) : 0;
    var h1 = '<div class="dm-head"><div><div class="dm-title">Shop today</div><div class="dm-sub">Live numbers, soft look</div></div><button class="dm-btn ra-press" id="dm-hide" type="button">Hide</button></div>';
    var k = '<div class="dm-grid">' +
      card('Sales today', '<span class="dm-gold">' + Ch.rsFull(s.today) + '</span>', chip(num(s.today), num(s.same_day_last_week)) + ' <span class="dm-sub">vs last week</span>', Ch.spark(dv)) +
      card('Bills today', String(num(s.bills_today)), '<div class="dm-sub" style="margin-top:8px">Average ' + Ch.rsFull(s.avg_bill_today) + '</div>') +
      card('This week', Ch.rsFull(s.week), chip(num(s.week), num(s.last_week_same_point))) +
      card('This month', Ch.rsFull(s.month), chip(num(s.month), num(s.last_month_same_point))) + '</div>';
    var g = '<div class="dm-grid two">' +
      '<div class="dm-card ra-card-in ra-d1"><h3>Month goal</h3><p class="dm-note">' + (num(t.month) ? Ch.rs(s.month) + ' of ' + Ch.rs(t.month) : 'No goal set yet') + '</p>' + Ch.ring(goal, Math.round(goal * 100) + '%', 'of month goal') + '</div>' +
      '<div class="dm-card ra-card-in ra-d2"><h3>Last 14 days</h3><p class="dm-note">Each bar is one day</p>' + (dv.length ? Ch.bars(dv, dl, { id: 'd', label: 'daily sales' }) : '<div class="dm-empty">No sales yet. Make a bill and it shows here.</div>') + '</div>' +
      '<div class="dm-card ra-card-in ra-d3"><h3>Above and below average</h3><p class="dm-note">Green days beat your average, red days fell short</p>' + (dv.length > 1 ? Ch.mirrored(dv, dl) : '<div class="dm-empty">Needs two days of sales.</div>') + '</div>' +
      '<div class="dm-card ra-card-in ra-d4"><h3>Busy hours today</h3><p class="dm-note">Darker gold = more sales</p>' + (hv.some(Boolean) ? Ch.heat(hv, hl, { cols: 8 }) : '<div class="dm-empty">Quiet so far today.</div>') + '</div>' +
      '<div class="dm-card ra-card-in ra-d5"><h3>How customers paid</h3>' + (pay.length ? Ch.donut(pay.map(function (x) { return { name: x.method, value: num(x.amount) }; })) : '<div class="dm-empty">No payments yet today.</div>') + '</div>' +
      '<div class="dm-card ra-card-in ra-d6"><h3>Top items this month</h3>' + ((d.top_items_month || []).length ? Ch.hbars((d.top_items_month || []).slice(0, 6).map(function (x) { return { name: x.name, value: num(x.revenue) }; })) : '<div class="dm-empty">Top items appear after the first sales.</div>') + '</div></div>';
    var low = (d.stock && d.stock.low_list || []).slice(0, 10);
    var st = '<div class="dm-card ra-card-in ra-d7"><h3>Stock getting low</h3><p class="dm-note">Tube = how much is left</p>' + (low.length ? Ch.tubes(low.map(function (x) { return { name: x.name, level: num(x.stock_level), max: Math.max(num(x.reorder_threshold) * 2, 1) }; })) : '<div class="dm-empty">All stock above its reorder level.</div>') + '</div>';
    var fo = '';
    if (fc && fc.length) fo = '<div class="dm-card ra-card-in ra-d8" style="margin-top:12px"><h3>Order soon (suggestion only)</h3>' + Ch.hbars(fc.slice(0, 5).map(function (x) { return { name: x.name || x.item_code, value: num(x.order_qty || x.suggest_qty || 0), text: (x.days_left != null ? Math.round(x.days_left) + ' days left' : '') }; })) + '</div>';
    return h1 + k + g + st + fo;
  }
  function paint(host, d, fc) {
    host.innerHTML = build(d, fc);
    var b = host.querySelector('#dm-hide'); if (b) b.onclick = function () { try { localStorage.setItem('rbh_dm_hidden', '1'); } catch (e) {} host.style.display = 'none'; };
    Array.prototype.forEach.call(host.querySelectorAll('.rc-ring'), function (el) { requestAnimationFrame(function () { el.style.strokeDashoffset = el.getAttribute('data-off'); }); });
  }
  function get(u) { return fetch(u, { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }); }
  function run() {
    var pro = document.getElementById('dash-pro'), page = document.getElementById('page-dashboard'); if (!page) return;
    var host = document.getElementById('dash-modern');
    if (!host) { host = document.createElement('div'); host.id = 'dash-modern'; if (pro && pro.parentNode) pro.parentNode.insertBefore(host, pro); else page.insertBefore(host, page.firstChild); }
    try { if (localStorage.getItem('rbh_dm_hidden') === '1') { host.style.display = 'none'; return; } } catch (e) {}
    host.style.display = '';
    if (!host.innerHTML) host.innerHTML = '<div class="dm-card dm-empty">One moment...</div>';
    Promise.all([get('/api/dashboard-pro'), get('/api/reorder-forecast').then(function (j) { return j.items || []; }).catch(function () { return []; })]).then(function (r) {
      try { localStorage.setItem(CACHE, JSON.stringify(r[0])); } catch (e) {}
      paint(host, r[0], Array.isArray(r[1]) ? r[1] : []);
    }).catch(function () {
      var c = null; try { c = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch (e) {}
      if (c) paint(host, c, []); else host.innerHTML = '<div class="dm-card dm-empty">Cannot reach the shop PC. Numbers will show when it is back.</div>';
    });
  }
  window.RBHDashModern = { run: run, build: build, show: function () { try { localStorage.removeItem('rbh_dm_hidden'); } catch (e) {} run(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(run, 300); }); else setTimeout(run, 300);
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest && e.target.closest('[data-page="dashboard"],[onclick*="dashboard"]'); if (a) setTimeout(run, 400); });
})();
