/* RBH Pocket: PROFIT tab (module). Shows profit by invoice, by item and net. Read-only: it only draws numbers the shop PC already sent. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.RBHP) return;
  var P = window.RBHP, el = P.el, rs = P.rs, row = P.row, card = P.card;
  var view = 'inv';
  function sgn(n) { return (n < 0 ? '-' : '') + rs(Math.abs(n)); }
  function pct(g, sales) { return sales > 0 ? Math.round(g / sales * 100) + '%' : '-'; }

  function draw(s, box) {
    var p = s.profit;
    if (!p) { var c0 = card('Profit'); c0.appendChild(el('div', 'dim', 'No profit numbers yet. Update the shop PC app, then refresh.')); box.appendChild(c0); return; }
    var t = card('Profit today'); t.appendChild(el('div', 'big', sgn(p.today.gross)));
    t.appendChild(el('div', 'dim', 'Sales ' + rs(p.today.sales) + ' · cost ' + rs(p.today.cost) + ' · ' + pct(p.today.gross, p.today.sales)));
    if (p.today.no_cost) t.appendChild(el('div', 'warn', 'Heads-up: ' + p.today.no_cost + ' line(s) have no cost yet, so profit is a little high.'));
    box.appendChild(t);
    var g = el('div', 'grid'); g.style.marginBottom = '12px';
    [['This week', p.week], ['This month', p.month]].forEach(function (x) { var k = card(x[0]); k.appendChild(el('div', 'v', sgn(x[1].gross))); k.appendChild(el('div', 'dim', 'on ' + rs(x[1].sales))); g.appendChild(k); });
    box.appendChild(g);
    var n = card('Net after running cost');
    n.appendChild(row('Today', sgn(p.today.net), p.today.net < 0 ? 'down' : 'up')); n.appendChild(row('This week', sgn(p.week.net), p.week.net < 0 ? 'down' : 'up')); n.appendChild(row('This month', sgn(p.month.net), p.month.net < 0 ? 'down' : 'up'));
    n.appendChild(el('div', 'dim', p.run_per_day ? 'Running cost counted: ' + rs(p.run_per_day) + ' a day (rent, salary, living).' : 'No running cost set yet, so net equals profit.'));
    box.appendChild(n);
    var bar = el('div', 'seg'); bar.style.cssText = 'display:flex;gap:8px;margin:4px 0 12px';
    [['inv', 'By invoice'], ['item', 'By item']].forEach(function (x) {
      var b = el('button', view === x[0] ? 'gold' : '', x[1]); b.style.flex = '1'; b.addEventListener('click', function () { view = x[0]; P.redraw(); }); bar.appendChild(b);
    });
    box.appendChild(bar);
    if (view === 'inv') {
      var c = card('Bills today');
      if (!s.bills) c.appendChild(el('div', 'dim', 'No data yet'));
      else if (!s.bills.length) c.appendChild(el('div', 'dim', 'No bills yet today'));
      else s.bills.forEach(function (x) {
        c.appendChild(P.tapRow(x.t + ' · ' + (x.who || 'Walk-in'), sgn(x.profit || 0) + ' of ' + rs(x.total), '', function () {
          P.sheet('Bill ' + x.no, (x.lines || []).map(function (l) { return [l.n + ' × ' + l.q, rs(l.a)]; }).concat([['Sale', rs(x.total)], ['Profit', sgn(x.profit || 0), 'up']]), '');
        }));
      });
      box.appendChild(c);
    } else {
      var d = card('Best items this month (by profit)');
      if (!p.items.length) d.appendChild(el('div', 'dim', 'No sales yet this month'));
      p.items.forEach(function (x) { d.appendChild(row(x.name + ' × ' + x.qty, sgn(x.profit) + ' · ' + pct(x.profit, x.revenue))); });
      box.appendChild(d);
    }
    var dl = card('Last 14 days sales'); var mx = Math.max.apply(null, (s.daily || []).map(function (x) { return x.total; }).concat([1]));
    (s.daily || []).slice().reverse().forEach(function (x) { var r = row(x.d.slice(5) + ' · ' + x.n + ' bills', rs(x.total)); r.className += ' barrow'; var b = el('div', 'bar'); b.style.width = Math.round(x.total / mx * 100) + '%'; r.insertBefore(b, r.firstChild); dl.appendChild(r); });
    box.appendChild(dl);
  }
  P.EXTRA.profit = draw;
})();
