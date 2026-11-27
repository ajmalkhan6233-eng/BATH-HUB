// Running cost card on the Profit page (routes/running_cost.js). Own module: builds its own box under the KPI cards.
(function () {
  'use strict';
  var anchor = document.getElementById('kpis');
  if (!anchor) return;
  var box = document.createElement('section');
  box.id = 'running-cost';
  box.setAttribute('aria-label', 'Running cost');
  box.style.cssText = 'margin:14px 0;padding:12px;border:1px solid rgba(127,127,127,.4);border-radius:12px';
  anchor.parentNode.insertBefore(box, anchor.nextSibling);
  var LABELS = { from: 'Count from', daily_line: 'Daily running cost line', own_salary_day: 'Own salary per day', staff_day: 'Staff per day', food_day: 'Food per day', rent_month: 'Rent per month', electricity_month: 'Electricity per month', commission_pct: 'Commission % of gross profit' };
  var rs = function (n) { return (n < 0 ? '-' : '') + 'Rs ' + Math.round(Math.abs(n)).toLocaleString('en-US'); };
  var el = function (tag, text) { var e = document.createElement(tag); if (text !== undefined) e.textContent = text; return e; };
  function row(table, a, b, bold) { var tr = el('tr'), x = el('td', a), y = el('td', b); y.style.textAlign = 'right'; if (bold) tr.style.fontWeight = '700'; tr.appendChild(x); tr.appendChild(y); table.appendChild(tr); }
  function draw(d) {
    box.textContent = '';
    box.appendChild(el('h3', 'After running cost: ' + d.settings.from.split('-').reverse().join('/') + ' to today (' + d.days + ' days, ' + d.bills + ' bills)'));
    var t = el('table'); t.style.width = '100%';
    row(t, 'Gross profit', rs(d.gross), true);
    d.lines.forEach(function (l) { row(t, l.name, rs(-l.amount)); });
    row(t, 'Debt buffer', rs(-d.buffer));
    row(t, 'Left after running cost', rs(d.net), true);
    row(t, 'Left before the debt buffer', rs(d.net_before_buffer));
    box.appendChild(t);
    var det = el('details'); det.appendChild(el('summary', 'Change the numbers'));
    var form = el('form');
    Object.keys(LABELS).forEach(function (k) {
      var lab = el('label', LABELS[k] + ' '), i = el('input'); lab.style.cssText = 'display:block;margin:6px 0';
      i.name = k; i.type = k === 'from' ? 'date' : 'number'; if (k !== 'from') { i.min = '0'; i.step = 'any'; } i.value = d.settings[k]; i.required = true;
      lab.appendChild(i); form.appendChild(lab);
    });
    var save = el('button', 'Save'), msg = el('span'); save.type = 'submit'; msg.setAttribute('role', 'status'); form.appendChild(save); form.appendChild(msg);
    form.onsubmit = function (ev) {
      ev.preventDefault(); var body = {}; Object.keys(LABELS).forEach(function (k) { body[k] = form.elements[k].value; });
      fetch('/api/running-cost', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Not saved'); load(); }); })
        .catch(function (e) { msg.textContent = ' ' + e.message; });
    };
    det.appendChild(form); box.appendChild(det);
  }
  function load() {
    fetch('/api/running-cost').then(function (r) { if (!r.ok) throw new Error(); return r.json(); }).then(draw).catch(function () { box.textContent = 'Running cost could not load.'; });
  }
  load();
})();
