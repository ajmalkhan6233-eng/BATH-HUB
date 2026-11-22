/* RBH Pocket: PROFIT tab (module). Shows profit by invoice, by item and net. Read-only: it only draws numbers the shop PC already sent.
   LOOK v6 (plain iPhone): one period switch (Today · Week · Month), the big number is NET when a running cost is set, else profit. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || !window.RBHP) return;
  var P = window.RBHP, el = P.el, rs = P.rs, card = P.card, sgn = P.sgn;
  var view = 'inv', per = 'today', showNet = false;   // net profit stays hidden until AJ taps it (people can look over his shoulder)
  function pct(g, sales) { return sales > 0 ? Math.round(g / sales * 100) + '%' : '-'; }
  function line(k, v, cls) { var r = el('div', 'sumrow'); r.appendChild(el('span', null, k)); r.appendChild(el('span', 'num' + (cls ? ' ' + cls : ''), v)); return r; }

  function draw(s, box) {
    var p = s.profit;
    if (P.EXTRA.per) { per = P.EXTRA.per; P.EXTRA.per = null; }   // Home row tapped: open that period
    if (!p) { var c0 = card('Profit'); c0.appendChild(el('div', 'note', 'No profit numbers yet. Update the shop PC app, then refresh.')); box.appendChild(c0); return; }
    box.appendChild(P.segc([['today', 'Today'], ['week', 'This week'], ['month', 'This month']], per, function (v) { per = v; P.redraw(); }));
    var x = p[per] || p.today, run = !!p.run_per_day, main = x.gross;
    if (x.no_cost) {
      var w = card('Heads-up · missing cost', P.pill(P.plural(x.no_cost, 'line', 'lines'), 'amber')); w.className += ' warn';
      w.appendChild(el('div', 'note', x.no_cost + ' sold line(s) have no cost yet, so profit shows a little high. Add the cost on the shop PC.'));
      box.appendChild(w);
    }

    var LITE = 'color:#8e8e93;font-weight:400';   // AJ: gross and net numbers light, not bold
    var b = card((per === 'today' ? 'Today' : per === 'week' ? 'This week' : 'This month'));
    b.appendChild(line('Sales', rs(x.sales)));
    var c = line('Cost of goods', '− ' + rs(x.cost)); c.lastChild.setAttribute('style', LITE); b.appendChild(c);
    var g = line('Gross profit', sgn(x.gross)); g.lastChild.setAttribute('style', LITE); b.appendChild(g);
    if (run) {
      var hide = !showNet, HID = '•••• tap';
      var r = line('Running cost', hide ? HID : '− ' + rs(x.gross - x.net)); r.lastChild.setAttribute('style', LITE); b.appendChild(r);
      var t = line('Net profit', hide ? HID : sgn(x.net)); t.lastChild.setAttribute('style', LITE);
      [r, t].forEach(function (n) { n.style.cursor = 'pointer'; n.addEventListener('click', function () { showNet = !showNet; P.redraw(); }); }); b.appendChild(t);
    }
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
