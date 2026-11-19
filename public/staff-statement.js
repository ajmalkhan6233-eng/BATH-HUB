/* Staff > Statement tab (AJ 18 Nov 2026). Tap a name, get that person's full statement: salary each day, commission, what was paid, borrowed, repaid, balance.
   Reads /api/staff-ledger/:id (owner only). Add a payment at the end of the day with the form under the table. Print or CSV in one click. */
(function () {
  'use strict';
  if (typeof TABS === 'undefined' || typeof RUN === 'undefined') return;
  var css = document.createElement('style');
  css.textContent = '#stmt .names{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0}#stmt .names button{min-height:44px;padding:6px 16px;border-radius:10px}#stmt .names button.on{outline:3px solid #8f670a}' +
    '#stmt .k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:8px 0}#stmt .k div{border:1px solid #dbe0e8;border-radius:10px;padding:8px 10px}#stmt .k b{display:block;font-size:20px}#stmt .k span{font-size:12px;color:#596577}' +
    '#stmt .neg{color:#b3261e}#stmt .pos{color:#1b7a46}#stmt td.n,#stmt th.n{text-align:right;white-space:nowrap}#stmt .note2{font-size:13px;color:#596577;margin:6px 0}#stmt .f{display:flex;gap:6px;flex-wrap:wrap;align-items:end;margin:10px 0}#stmt .f label{display:block;font-size:12px}' +
    '@media print{body>*:not(#stmtprint){display:none!important}#stmtprint{display:block!important}}';
  document.head.appendChild(css);
  var rs = function (n) { return n == null || n === '' ? '' : Number(n).toLocaleString('en-LK', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); };
  var dmy = function (d) { return String(d).split('-').reverse().join('-'); };
  var CURID = null, LASTDATA = null;

  function csvOut(d) {
    var rows = [['Date', 'What', 'Note', 'Earned', 'Paid', 'Borrowed', 'Repaid', 'Balance owed to him', 'Loan he owes']].concat(d.lines.map(function (l) { return [dmy(l.date), l.what, l.note, l.earned || '', l.paid || '', l.borrowed || '', l.repaid || '', l.balance, l.loan]; }));
    var t = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv' })); a.download = 'statement_' + d.staff.name + '_' + new Date().toISOString().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function draw(d, from, to) {
    var T = d.totals, C = d.commission_so_far;
    var body = d.lines.map(function (l) {
      return '<tr><td>' + E(dmy(l.date)) + '</td><td>' + E(l.what) + '</td><td>' + E(l.note) + '</td><td class="n">' + rs(l.earned) + '</td><td class="n">' + rs(l.paid) + '</td><td class="n">' + rs(l.borrowed) + '</td><td class="n">' + rs(l.repaid) + '</td><td class="n"><b>' + rs(l.balance) + '</b></td><td class="n">' + rs(l.loan) + '</td><td>' + (l.id && l.kind !== 'salary' ? '<a href="#" data-void="' + l.id + '">void</a>' : '') + '</td></tr>';
    }).join('');
    var html = '<div id="stmtprint"><h3 style="margin:6px 0">Statement: ' + E(d.staff.name) + '</h3><div class="note2">As at ' + E(new Date(d.as_at).toLocaleString('en-GB', { timeZone: 'Asia/Colombo' })) + '</div>' +
      '<div class="k"><div><span>Owed to ' + E(d.staff.name) + ' now</span><b class="' + (T.owed_to_him < 0 ? 'neg' : '') + '">Rs ' + rs(T.owed_to_him) + '</b></div><div><span>Salary earned</span><b>Rs ' + rs(T.salary) + '</b></div><div><span>Commission earned (' + d.commission_pct + '%)</span><b>Rs ' + rs(T.commission) + '</b></div><div><span>Paid to him</span><b>Rs ' + rs(T.paid) + '</b></div><div><span>Loan he owes the shop</span><b class="' + (T.loan_he_owes > 0 ? 'neg' : '') + '">Rs ' + rs(T.loan_he_owes) + '</b></div></div>' +
      '<div class="note2">Commission counts from ' + E(dmy(d.commission_from)) + ', ' + d.commission_pct + '% of profit on bills with ' + E(d.staff.name) + ' picked as salesman. For information, on everything sold so far (' + C.bills + ' bills): ' + d.commission_pct + '% of profit Rs ' + rs(C.five_pct_of_profit) + ' (profit Rs ' + rs(C.profit) + '), or ' + d.commission_pct + '% of sales Rs ' + rs(C.five_pct_of_sales) + ' (sales Rs ' + rs(C.sales) + '). Not added to his balance.</div>' +
      '<div class="wrap"><table><thead><tr><th>Date</th><th>What</th><th>Note</th><th class="n">Earned</th><th class="n">Paid</th><th class="n">Borrowed</th><th class="n">Repaid</th><th class="n">Balance owed to him</th><th class="n">Loan</th><th></th></tr></thead><tbody>' + (body || '<tr><td colspan="10">No entries.</td></tr>') + '</tbody></table></div></div>' +
      '<div class="f"><div><label>From</label><input type="date" id="sf" value="' + E(from || '') + '"></div><div><label>To</label><input type="date" id="st" value="' + E(to || '') + '"></div><button id="sgo" type="button">Show</button><button id="sprint" type="button">Print / PDF</button><button id="scsv" type="button">Download CSV</button></div>' +
      '<div class="card"><b>Add an entry</b><div class="f"><div><label>Date</label><input type="date" id="ad" value="' + tod() + '"></div><div><label>What</label><select id="ak"><option value="paid">Paid to him</option><option value="borrowed">Borrowed (advance)</option><option value="repaid">Loan repaid</option><option value="adjust_up">Adjustment: owed more</option><option value="adjust_down">Adjustment: owed less</option></select></div><div><label>Amount</label><input id="aa" type="number" min="0" step="any" inputmode="decimal"></div><div style="flex:1;min-width:160px"><label>Note</label><input id="an" style="width:100%"></div><button class="gold" id="asave" type="button">Save</button></div><div id="amsg"></div></div>';
    $('body').innerHTML = '<div id="stmt"><div class="names" id="snames"></div><div id="sout">' + html + '</div></div>';
    $('snames').innerHTML = STAFF.map(function (s) { return '<button type="button" data-id="' + E(s.id) + '" class="' + (String(s.id) === String(CURID) ? 'on' : '') + '">' + E(s.name) + '</button>'; }).join('');
    wire();
    $('sgo').onclick = function () { open(CURID, $('sf').value, $('st').value); };
    $('sprint').onclick = function () { window.print(); };
    $('scsv').onclick = function () { csvOut(LASTDATA); };
    $('asave').onclick = function () {
      var amt = Number($('aa').value); if (!(amt > 0)) { $('amsg').innerHTML = '<span class="err">Enter an amount.</span>'; return; }
      api('/api/staff-ledger/' + CURID, 'POST', { date: $('ad').value, kind: $('ak').value, amount: amt, note: $('an').value.trim() }).then(function () { open(CURID, from, to); }).catch(function (e) { $('amsg').innerHTML = '<span class="err">' + E(e.message) + '</span>'; });
    };
    Array.prototype.forEach.call(document.querySelectorAll('#stmt [data-void]'), function (a) {
      a.onclick = function (ev) { ev.preventDefault(); var why = window.prompt('Why void this entry? (needed, nothing is deleted)'); if (!why || why.trim().length < 3) return; api('/api/staff-ledger/entry/' + a.getAttribute('data-void') + '/void', 'POST', { reason: why.trim() }).then(function () { open(CURID, from, to); }).catch(function (e) { alert(e.message); }); };
    });
  }
  function wire() { Array.prototype.forEach.call(document.querySelectorAll('#snames button'), function (b) { b.onclick = function () { open(b.getAttribute('data-id')); }; }); }
  function open(id, from, to) {
    CURID = id; var q = [];
    if (from) q.push('from=' + encodeURIComponent(from)); if (to) q.push('to=' + encodeURIComponent(to));
    api('/api/staff-ledger/' + id + (q.length ? '?' + q.join('&') : '')).then(function (d) { LASTDATA = d; draw(d, from, to); }).catch(function (e) { msg(e.message); });
  }
  async function tStatement() {
    await loadStaffList();
    $('body').innerHTML = '<div id="stmt"><div class="note2">Tap a name to see the full statement.</div><div class="names" id="snames"></div><div id="sout"></div></div>';
    $('snames').innerHTML = STAFF.map(function (s) { return '<button type="button" data-id="' + E(s.id) + '">' + E(s.name) + '</button>'; }).join('');
    wire();
    if (STAFF.length === 1) open(STAFF[0].id);
  }
  TABS.push(['statement', 'Statement']); RUN.statement = tStatement;
  if (typeof show === 'function') show(typeof CUR !== 'undefined' ? CUR : 'staff');
})();
