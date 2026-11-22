/* RBH Pocket: PROFIT tab (module). Shows profit by invoice, by item and net. Read-only: it only draws numbers the shop PC already sent.
   LOOK v5: one period switch (Today · Week · Month), the big number is NET when a running cost is set, else profit. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.RBHP) return;
  var P = window.RBHP, el = P.el, rs = P.rs, card = P.card, sgn = P.sgn;
  var view = 'inv', per = 'today';
  function pct(g, sales) { return sales > 0 ? Math.round(g / sales * 100) + '%' : '-'; }
  function line(k, v, cls) { var r = el('div', 'sumrow'); r.appendChild(el('span', null, k)); r.appendChild(el('span', 'num' + (cls ? ' ' + cls : ''), v)); return r; }

  function draw(s, box) {
    var p = s.profit;
    if (!p) { var c0 = card('Profit'); c0.appendChild(el('div', 'note', 'No profit numbers yet. Update the shop PC app, then refresh.')); box.appendChild(c0); return; }
    box.appendChild(P.segc([['today', 'Today'], ['week', 'This week'], ['month', 'This month']], per, function (v) { per = v; P.redraw(); }));
    var x = p[per] || p.today, run = !!p.run_per_day, main = run ? x.net : x.gross;
    var title = (per === 'today' ? 'Today' : per === 'week' ? 'This week' : 'This month') + ' · ' + (run ? 'net profit' : 'profit');
    box.appendChild(P.ledger(title, sgn(main), P.pill(pct(x.gross, x.sales) + ' margin', x.gross >= 0 ? 'ok' : 'bad'), [P.kv('Sales', rs(x.sales)), P.kv('Cost', rs(x.cost))]));

    if (x.no_cost) {
      var w = card('Heads-up · missing cost', P.pill(P.plural(x.no_cost, 'line', 'lines'), 'amber')); w.className += ' warn';
      w.appendChild(el('div', 'note', x.no_cost + ' sold line(s) have no cost yet, so profit shows a little high. Add the cost on the shop PC.'));
      box.appendChild(w);
    }

    var b = card('Breakdown');
    b.appendChild(line('Sales', rs(x.sales)));
    b.appendChild(line('Cost of goods', rs(x.cost)));
    b.appendChild(line('Profit', sgn(x.gross), x.gross >= 0 ? 'up' : 'down'));
    if (run) b.appendChild(line('Running cost (rent, salary, living)', '− ' + rs(x.gross - x.net)));
    var t = line(run ? 'Net profit' : 'Net (no running cost set)', sgn(run ? x.net : x.gross)); t.className += ' total'; t.lastChild.className = 'tot'; b.appendChild(t);
    b.appendChild(el('div', 'note', run ? 'Running cost counted: ' + rs(p.run_per_day) + ' a day.' : 'No running cost set yet, so net equals profit.'));
    b.lastChild.style.marginTop = '6px';
    box.appendChild(b);

    box.appendChild(P.segc([['inv', 'By invoice (today)'], ['item', 'By item (month)']], view, function (v) { view = v; P.redraw(); }));
    if (view === 'inv') {
      var c = card('Bills today', s.bills ? P.plural(s.bills.length, 'bill', 'bills') : null);
      if (!s.bills) c.appendChild(el('div', 'note', 'No data yet'));
      else if (!s.bills.length) c.appendChild(el('div', 'note', 'No bills yet today'));
      else s.bills.forEach(function (bl) {
        c.appendChild(P.tapRow2(bl.who || 'Walk-in', bl.t + ' · ' + P.cap(bl.pay) + ' · ' + rs(bl.total), sgn(bl.profit || 0), (bl.profit || 0) >= 0 ? 'up' : 'down', function () {
          P.sheet('Bill ' + bl.no, (bl.lines || []).map(function (l) { return [l.n + ' × ' + l.q, rs(l.a)]; }).concat([['Sale · ' + P.cap(bl.pay), rs(bl.total)], ['Profit', sgn(bl.profit || 0), 'up']]), (bl.lines && bl.lines.length >= 12) ? 'First 12 lines shown.' : '');
        }));
      });
      box.appendChild(c);
    } else {
      var d = card('Best items this month (by profit)');
      if (!p.items || !p.items.length) d.appendChild(el('div', 'note', 'No sales yet this month'));
      (p.items || []).forEach(function (it, i) { d.appendChild(P.row2((i + 1) + '. ' + it.name, it.qty + ' sold · ' + rs(it.revenue) + ' · ' + pct(it.profit, it.revenue), sgn(it.profit), it.profit >= 0 ? 'up' : 'down')); });
      box.appendChild(d);
    }

    if (s.daily && s.daily.length) {
      var mx = s.daily.reduce(function (a, y) { return y.total > a.total ? y : a; }, s.daily[0]);
      var dl = card('Last ' + s.daily.length + ' days sales', el('span', 'num', 'Best ' + rs(mx.total)));
      dl.appendChild(P.bars(s.daily));
      var lt = s.daily[s.daily.length - 1]; dl.appendChild(P.row2('Latest day · ' + lt.d.slice(5), P.plural(lt.n, 'bill', 'bills'), rs(lt.total)));
      box.appendChild(dl);
    }
  }
  P.EXTRA.profit = draw;
})();
