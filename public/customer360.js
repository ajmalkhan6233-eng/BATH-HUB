/* Customer 360: split screen. Left = customers, right = the money picture + Bills / Credit & payments / Advances / Quotes.
   Data from /api/customer360. One write here: record a payment on a credit invoice. Returns, refunds and exchanges stay in POS (All bills). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rs = function (n) { return 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var day = function (d) { return d ? String(d).slice(0, 10) : '-'; };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var S = { list: [], filter: 'all', q: '', cur: null, tab: 'bills', data: null };
  try { var pt = window.parent && window.parent !== window && window.parent.document.documentElement.getAttribute('data-theme'); if (pt) document.documentElement.setAttribute('data-theme', pt); } catch (_) {}

  function get(path) { return fetch('/api/customer360' + path, { credentials: 'same-origin' }).then(function (r) { if (r.status === 401) throw new Error('Please log in to the owner app first.'); if (r.status === 403) throw new Error('Owner only.'); if (!r.ok) throw new Error('Could not load. Try again.'); return r.json(); }); }
  function post(url, body) { return fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return r.ok ? j : Promise.reject(new Error(j.error || 'Not saved')); }); }); }
  function say(t) { $('msg').textContent = t || ''; }
  function flat(s) { return String(s || '').toLowerCase().replace(/(.)\1+/g, '$1'); }

  function drawList() {
    var q = S.q.toLowerCase();
    var rows = S.list.filter(function (c) {
      if (q && flat(c.name).indexOf(flat(q)) < 0 && String(c.phone || '').indexOf(q) < 0) return false;
      if (S.filter === 'bal') return c.credit_owed > 0;
      if (S.filter === 'over') return c.advance_held > 0;
      return true;
    });
    $('list').innerHTML = rows.length ? rows.map(function (c) {
      return '<button type="button" class="vrow" role="listitem" data-v="' + esc(c.name) + '"' + (S.cur === c.name ? ' aria-current="true"' : '') + '><span><b>' + esc(c.name) + '</b><br><span class="sm">' + c.total_bills + ' bills' + (c.advance_held > 0 ? ' · advance ' + rs(c.advance_held) : '') + '</span></span><span class="amt ' + (c.credit_owed > 0 ? 'bad' : '') + '">' + (c.credit_owed > 0 ? rs(c.credit_owed) : '') + '</span></button>';
    }).join('') : '<div class="state">No customers match.</div>';
  }
  function select(name) { S.cur = name; S.tab = 'bills'; S.data = null; $('app').classList.add('pick'); drawList(); drawDetail(); load(); }
  function load() {
    var name = S.cur;
    get('/' + encodeURIComponent(name) + '/overview').then(function (r) { if (S.cur !== name) return; S.data = r; drawDetail(); })
      .catch(function (e) { $('detail').innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="rl">Try again</button></div>'; $('rl').onclick = load; });
  }
  function kpi(l, v, c) { return '<div class="kpi"><span class="sm">' + l + '</span><b class="' + (c || '') + '">' + v + '</b></div>'; }
  function table(head, rows, empty) { if (!rows.length) return '<div class="state">' + empty + '</div>'; return '<table><thead><tr>' + head.map(function (h) { return '<th' + (h[1] ? ' class="n"' : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>'; }

  function drawDetail() {
    var d = S.data, name = S.cur; if (!name) return;
    if (!d) { $('detail').innerHTML = '<div class="state">Loading...</div>'; return; }
    var s = d.summary, tabs = [['bills', 'Bills'], ['credit', 'Credit & payments'], ['adv', 'Advances'], ['quote', 'Quotes']];
    $('detail').innerHTML = '<div class="vhead"><h2>' + esc(name) + '</h2>' + (d.customer && d.customer.phone ? '<div class="sm">' + esc(d.customer.phone) + '</div>' : '<div class="sm">Not saved as a customer yet (name only from bills).</div>') +
      '<div class="bar"><button type="button" id="pay">+ Take payment</button><button type="button" id="cr">+ Credit invoice</button><button type="button" id="adv">+ Advance / reserve</button><button type="button" id="qt">+ Quotation</button><button type="button" class="ghost" id="rt">Return / refund</button><button type="button" class="ghost" id="pr">Print</button></div></div>' +
      '<div class="kpis">' + kpi('Total bought', rs(s.total_bought)) + kpi('Bills', s.bills) + kpi('They owe us', rs(s.credit_owed), s.credit_owed > 0 ? 'bad' : 'good') + kpi('Advance we hold', rs(s.advance_held)) + '</div>' +
      '<div class="lower"><div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div><div id="tabbody" class="wrap"></div></div>';
    drawBody();
    $('pay').onclick = function () { openPay(); }; $('cr').onclick = openCredit; $('adv').onclick = function () { openFrame('Advance / reserve', '/pos-preview2.html?reserved=1'); }; $('qt').onclick = function () { openFrame('Quotation', '/quotations.html'); };
    $('rt').onclick = function () { openFrame('Return / refund (find the bill, tap Return)', '/all-bills.html'); }; $('pr').onclick = function () { window.print(); };
  }
  function drawBody() {
    var body = $('tabbody'), d = S.data, t = S.tab; if (!body || !d) return;
    if (t === 'bills') body.innerHTML = table([['Bill'], ['Date'], ['Paid by'], ['Total', 1]], d.bills.map(function (b) { return '<tr><td>' + esc(b.bill_number || '#' + b.id) + '</td><td>' + day(b.created_at) + '</td><td>' + esc(b.payment_method || '') + '</td><td class="n ' + (Number(b.total) < 0 ? 'bad' : '') + '">' + rs(b.total) + (Number(b.total) < 0 ? ' (return)' : '') + '</td></tr>'; }), 'No bills for this customer yet.');
    if (t === 'credit') {
      var rows = d.credit.map(function (c) { var left = Number(c.amount) - Number(c.paid); return '<tr><td>' + esc(c.invoice_no || '#' + c.id) + '</td><td>' + day(c.invoice_date) + '</td><td>' + (c.due_date ? day(c.due_date) : '<span class="nodue">No due date</span>') + '</td><td class="n">' + rs(c.amount) + '</td><td class="n">' + rs(c.paid) + '</td><td class="n ' + (left > 0 ? 'bad' : 'good') + '">' + rs(left) + '</td><td>' + (left > 0 ? '<button type="button" class="ghost sm" data-pay="' + c.id + '">Pay</button>' : '<span class="chip good">Paid</span>') + '</td></tr>'; });
      var pr = d.payments.map(function (p) { return '<tr><td>' + day(p.paid_at) + '</td><td>' + esc(p.method || '') + '</td><td>' + esc(p.note || '') + '</td><td class="n">' + rs(p.amount) + '</td></tr>'; });
      body.innerHTML = table([['Invoice'], ['Date'], ['Due'], ['Amount', 1], ['Paid', 1], ['Owed', 1], ['']], rows, 'No credit invoices.') + '<h4>Payments received</h4>' + table([['Date'], ['How'], ['Note'], ['Amount', 1]], pr, 'No payments recorded here yet.');
      [].forEach.call(body.querySelectorAll('[data-pay]'), function (b) { b.onclick = function () { openPay(b.getAttribute('data-pay')); }; });
    }
    if (t === 'adv') body.innerHTML = table([['Order'], ['Date'], ['Total', 1], ['Advance', 1], ['Status']], d.advances.map(function (a) { return '<tr><td>' + esc(a.order_no) + '</td><td>' + day(a.created_at) + '</td><td class="n">' + rs(a.total) + '</td><td class="n">' + rs(a.advance_amount) + '</td><td><span class="chip">' + esc(a.status) + (a.bill_number ? ' · ' + esc(a.bill_number) : '') + '</span></td></tr>'; }), 'No advance or reserved orders.');
    if (t === 'quote') body.innerHTML = table([['Quote'], ['Date'], ['Valid until'], ['Total', 1], ['Status']], d.quotes.map(function (q) { return '<tr><td>' + esc(q.quote_no || '#' + q.id) + '</td><td>' + day(q.quote_date) + '</td><td>' + day(q.valid_until) + '</td><td class="n">' + rs(q.total) + '</td><td><span class="chip">' + esc(q.status || '') + '</span></td></tr>'; }), 'No quotations.');
  }

  function openDrawer(html) { $('sheet').innerHTML = html; $('dr').classList.add('on'); var c = $('dc'); if (c) c.onclick = closeDrawer; }
  function closeDrawer() { $('dr').classList.remove('on'); }
  function openFrame(title, url) { openDrawer('<h2>' + esc(title) + ' · ' + esc(S.cur) + '</h2><iframe src="' + url + '" title="' + esc(title) + '" style="width:100%;height:72vh;border:0"></iframe><div class="bar"><button type="button" class="ghost" id="dc">Close</button></div>'); $('dc').onclick = function () { closeDrawer(); load(); refresh(); }; }
  function openPay(sel) {
    var open = ((S.data && S.data.credit) || []).filter(function (c) { return Number(c.amount) - Number(c.paid) > 0; });
    if (!open.length) { say('Nothing owed by this customer.'); return; }
    openDrawer('<h2>Take payment · ' + esc(S.cur) + '</h2><form id="df" novalidate><label for="ci">Which invoice</label><select id="ci">' + open.map(function (c) { return '<option value="' + c.id + '"' + (String(sel) === String(c.id) ? ' selected' : '') + '>' + esc(c.invoice_no || '#' + c.id) + ' · owed ' + rs(Number(c.amount) - Number(c.paid)) + '</option>'; }).join('') + '</select>' +
      '<label for="am">Amount (Rs.)</label><input id="am" type="number" inputmode="decimal" min="0" step="0.01"><label for="mt">How paid</label><select id="mt"><option>cash</option><option>card</option><option>bank transfer</option><option>cheque</option></select><label for="pd">Date</label><input id="pd" type="date" value="' + today() + '"><label for="nt">Note</label><input id="nt" type="text" autocomplete="off">' +
      '<div class="bar"><button type="submit">Save</button><button type="button" class="ghost" id="dc">Cancel</button></div><div id="de" class="sm bad" role="alert"></div></form>');
    $('df').addEventListener('submit', function (e) { e.preventDefault(); if (!(Number($('am').value) > 0)) { $('de').textContent = 'Enter the amount.'; return; }
      post('/api/customer360/payment', { credit_id: Number($('ci').value), amount: Number($('am').value), method: $('mt').value, paid_at: $('pd').value, note: $('nt').value.trim() || undefined }).then(function () { closeDrawer(); say('Payment saved.'); load(); refresh(); }).catch(function (x) { $('de').textContent = x.message; }); });
  }
  function openCredit() {
    var c = S.data && S.data.customer;
    if (!c) { openDrawer('<h2>Save customer first</h2><form id="df"><p class="sm">' + esc(S.cur) + ' is only a name on bills. Save as a customer, then add credit invoices.</p><label for="ph">Phone</label><input id="ph" type="tel" autocomplete="off"><div class="bar"><button type="submit">Save customer</button><button type="button" class="ghost" id="dc">Cancel</button></div><div id="de" class="sm bad"></div></form>');
      $('df').addEventListener('submit', function (e) { e.preventDefault(); post('/api/customers', { name: S.cur, phone: $('ph').value.trim() || undefined }).then(function () { closeDrawer(); say('Customer saved.'); load(); }).catch(function (x) { $('de').textContent = x.message; }); }); return; }
    openDrawer('<h2>Credit invoice · ' + esc(S.cur) + '</h2><form id="df" novalidate><label for="in">Invoice / bill number</label><input id="in" type="text" autocomplete="off"><label for="ia">Amount (Rs.)</label><input id="ia" type="number" inputmode="decimal" min="0" step="0.01"><label for="id">Invoice date</label><input id="id" type="date" value="' + today() + '"><label for="du">Due date (optional)</label><input id="du" type="date"><div class="bar"><button type="submit">Save</button><button type="button" class="ghost" id="dc">Cancel</button></div><div id="de" class="sm bad" role="alert"></div></form>');
    $('df').addEventListener('submit', function (e) { e.preventDefault(); if (!(Number($('ia').value) > 0)) { $('de').textContent = 'Enter the amount.'; return; }
      post('/api/credit-customers', { customer_id: c.id, invoice_no: $('in').value.trim() || null, amount: Number($('ia').value), invoice_date: $('id').value, due_date: $('du').value || null }).then(function () { closeDrawer(); say('Saved.'); load(); refresh(); }).catch(function (x) { $('de').textContent = x.message; }); });
  }
  function refresh() { return get('/list').then(function (r) { S.list = r.customers || []; drawList(); }).catch(function (e) { $('list').innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="rl2">Try again</button></div>'; $('rl2').onclick = refresh; }); }

  $('list').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) select(b.getAttribute('data-v')); });
  $('q').addEventListener('input', function () { S.q = this.value; drawList(); });
  document.querySelector('.chips').addEventListener('click', function (e) { var b = e.target.closest('[data-f]'); if (!b) return; S.filter = b.getAttribute('data-f'); [].forEach.call(document.querySelectorAll('.chips button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); drawList(); });
  $('detail').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; S.tab = b.getAttribute('data-t'); drawDetail(); });
  $('back').onclick = function () { $('app').classList.remove('pick'); };
  $('dr').addEventListener('click', function (e) { if (e.target === $('dr')) closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  refresh().then(function () { var want = new URLSearchParams(location.search).get('c'); if (want) select(want); });
})();
