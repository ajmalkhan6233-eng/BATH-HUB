/* Vendor 360: split screen. Left = vendors, right = money picture + Statement / Bills / Payments & cheques / GRN.
   Read-only data from /api/vendor360. Saves go through the existing /api/vendor-ledger (same checks, same offline queue). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rs = function (n) { return 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var day = function (d) { return d ? String(d).slice(0, 10) : '-'; };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var S = { vendors: [], filter: 'all', q: '', cur: null, tab: 'statement', data: {} };
  try { var pt = window.parent && window.parent !== window && window.parent.document.documentElement.getAttribute('data-theme'); if (pt) document.documentElement.setAttribute('data-theme', pt); } catch (_) {}

  function get(path) {
    return fetch('/api/vendor360' + path, { credentials: 'same-origin' }).then(function (r) {
      if (r.status === 401) throw new Error('Please log in to the owner app first.');
      if (r.status === 403) throw new Error('Owner only.');
      if (!r.ok) throw new Error('Could not load. Try again.');
      return r.json();
    });
  }
  function say(t) { $('msg').textContent = t || ''; }

  /* ---------- left list ---------- */
  function drawList() {
    var q = S.q.toLowerCase();
    var rows = S.vendors.filter(function (v) {
      if (q && v.vendor_name.toLowerCase().indexOf(q) < 0) return false;
      if (S.filter === 'bal') return v.outstanding_balance > 0;
      if (S.filter === 'over') return v.overdue > 0;
      return true;
    });
    var box = $('list');
    if (!S.vendors.length) { box.innerHTML = '<div class="state">No vendor bills yet. Receive goods (GRN) or add a bill and vendors show here.</div>'; return; }
    if (!rows.length) { box.innerHTML = '<div class="state">No vendor matches.</div>'; return; }
    box.innerHTML = rows.map(function (v) {
      return '<button type="button" class="v" role="listitem" data-v="' + esc(v.vendor_name) + '"' + (S.cur === v.vendor_name ? ' aria-current="true"' : '') + '>' +
        '<span><b>' + esc(v.vendor_name) + '</b><small>' + v.total_bills + ' bill' + (v.total_bills === 1 ? '' : 's') + (v.has_bounced ? ' · bounced cheque' : '') + '</small></span>' +
        '<span class="amt ' + (v.overdue > 0 ? 'bad' : '') + '">' + rs(v.outstanding_balance) + (v.overdue > 0 ? ' !' : '') + '</span></button>';
    }).join('');
  }

  /* ---------- right side ---------- */
  function select(name) {
    S.cur = name; S.data = {}; $('app').classList.add('pick'); drawList(); drawDetail();
    loadTab();
    try { localStorage.setItem('v360_last', name); } catch (_) {}
  }
  function kpi(label, val, cls) { return '<div class="kpi"><span class="sm">' + label + '</span><b class="' + (cls || '') + '">' + val + '</b></div>'; }
  function drawDetail() {
    var v = S.vendors.filter(function (x) { return x.vendor_name === S.cur; })[0];
    if (!v) { $('detail').innerHTML = '<div class="state">Pick a vendor on the left.</div>'; return; }
    var tabs = [['statement', 'Statement'], ['bills', 'Bills'], ['pay', 'Payments & cheques'], ['grn', 'GRN']];
    $('detail').innerHTML = '<h2>' + esc(v.vendor_name) + '</h2>' +
      '<div class="kpis">' + kpi('We owe', rs(v.outstanding_balance), v.outstanding_balance > 0 ? 'bad' : 'good') + kpi('Overdue', rs(v.overdue), v.overdue > 0 ? 'bad' : '') + kpi('Total bought', rs(v.total_billed)) + kpi('Paid or credited', rs(v.total_paid), 'good') + '</div>' +
      (v.cheques_pending > 0 ? '<div class="sm">' + rs(v.cheques_pending) + ' is covered by cheques not cleared yet. It stays owed until the cheque clears.</div>' : '') +
      '<div class="bar"><button type="button" id="nb">+ New bill</button><button type="button" id="np">+ Record payment</button><button type="button" class="ghost" id="pr">Print</button></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="tabbody" class="wrap"><div class="state">Loading...</div></div>';
    $('nb').onclick = function () { openDrawer('bill'); };
    $('np').onclick = function () { openDrawer('pay'); };
    $('pr').onclick = function () { window.print(); };
  }
  function loadTab() {
    var name = S.cur, tab = S.tab, path = { statement: '/statement', bills: '/bills', pay: '/statement', grn: '/grns' }[tab];
    var body = $('tabbody'); if (!body) return;
    var key = tab === 'pay' ? 'statement' : tab;
    var done = function () { if (S.cur === name && S.tab === tab) drawBody(); };
    if (S.data[key]) return done();
    body.innerHTML = '<div class="state">Loading...</div>';
    var need = tab === 'pay' ? ['/statement', '/bills'] : [path];
    Promise.all(need.map(function (p) { return get('/' + encodeURIComponent(name) + p); })).then(function (r) {
      if (tab === 'pay') { S.data.statement = r[0]; S.data.bills = r[1]; } else S.data[key] = r[0];
      done();
    }).catch(function (e) { if (S.cur === name) body.innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="retry">Try again</button></div>'; var b = $('retry'); if (b) b.onclick = loadTab; });
  }
  function table(head, rows, empty) {
    if (!rows.length) return '<div class="state">' + empty + '</div>';
    return '<table><thead><tr>' + head.map(function (h) { return '<th' + (h[1] ? ' class="n"' : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }
  var STATE = { PAID: ['Paid', 'good'], CHEQUE_ISSUED: ['Cheque issued', ''], PART_COVERED: ['Part covered', ''], UNPAID: ['Unpaid', 'bad'] };
  function drawBody() {
    var body = $('tabbody'); if (!body) return; var t = S.tab, d = S.data;
    if (t === 'statement') {
      var st = d.statement;
      body.innerHTML = table([['Date'], ['Ref'], ['Details'], ['Debit', 1], ['Credit', 1], ['Balance', 1]], st.rows.map(function (r) {
        return '<tr><td>' + day(r.tx_date) + '</td><td>' + esc(r.reference) + '</td><td>' + esc(r.description) + '</td><td class="n">' + (r.debit ? rs(r.debit) : '-') + '</td><td class="n good">' + (r.credit ? rs(r.credit) : '-') + '</td><td class="n"><b>' + rs(r.running_balance) + '</b></td></tr>';
      }), 'Nothing recorded for this vendor yet.');
    } else if (t === 'bills') {
      body.innerHTML = table([['Bill'], ['Date'], ['Due'], ['Total', 1], ['Owed', 1], ['Status']], d.bills.bills.map(function (b) {
        var s = STATE[b.state] || [b.state, '']; return '<tr><td>' + esc(b.bill_no || '#' + b.id) + '</td><td>' + day(b.bill_date) + '</td><td class="' + (b.overdue ? 'bad' : '') + '">' + day(b.due_date) + '</td><td class="n">' + rs(b.total) + '</td><td class="n">' + rs(b.outstanding) + '</td><td><span class="chip ' + s[1] + '">' + s[0] + (b.overdue ? ' · overdue' : '') + '</span></td></tr>';
      }), 'No bills yet.');
    } else if (t === 'pay') {
      var rows = [];
      d.bills.bills.forEach(function (b) {
        (b.payments || []).forEach(function (p) { rows.push(['payment', day(p.paid_at), p.method || 'payment', rs(p.amount), 'Paid', b.bill_no]); });
        (b.cheques || []).forEach(function (c) { rows.push(['cheque', day(c.due_date), 'Cheque ' + (c.cheque_no || '') + (c.bank ? ' (' + c.bank + ')' : ''), rs(c.amount), c.status, b.bill_no]); });
      });
      rows.sort(function (a, b) { return a[1] < b[1] ? 1 : -1; });
      body.innerHTML = table([['Date'], ['What'], ['Amount', 1], ['Status'], ['Bill']], rows.map(function (r) {
        return '<tr><td>' + r[1] + '</td><td>' + esc(r[2]) + '</td><td class="n">' + r[3] + '</td><td><span class="chip ' + (r[4] === 'BOUNCED' ? 'bad' : r[4] === 'CLEARED' || r[4] === 'Paid' ? 'good' : '') + '">' + esc(r[4]) + '</span></td><td>' + esc(r[5] || '') + '</td></tr>';
      }), 'No payments or cheques yet.');
    } else if (t === 'grn') {
      body.innerHTML = table([['GRN'], ['Date'], ['Lines', 1], ['Total', 1]], (d.grn.grns || []).map(function (g) {
        return '<tr><td>' + esc(g.grn_number) + '</td><td>' + day(g.grn_date) + '</td><td class="n">' + g.lines + '</td><td class="n">' + rs(g.total) + '</td></tr>';
      }), 'No goods received from this vendor yet.');
    }
  }

  /* ---------- side drawer: New bill / Record payment (drafts kept in this browser) ---------- */
  function openDrawer(kind) {
    var name = S.cur, key = 'draft_vendor_' + kind + '_' + name, draft = {};
    try { draft = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
    var f = function (id, label, type, extra) { return '<label for="' + id + '">' + label + '</label><input id="' + id + '" type="' + type + '" ' + (extra || '') + ' value="' + esc(draft[id] || '') + '">'; };
    var html = '<h2>' + (kind === 'bill' ? 'New bill' : 'Record payment') + ' · ' + esc(name) + '</h2><form id="df" novalidate>';
    if (kind === 'bill') {
      html += f('bill_no', 'Bill number', 'text', 'autocomplete="off"') + f('bill_date', 'Bill date', 'date') + f('due_date', 'Due date', 'date') + f('total', 'Total (Rs.)', 'number', 'inputmode="decimal" min="0" step="0.01"');
    } else {
      var open = ((S.data.bills && S.data.bills.bills) || []).filter(function (b) { return b.outstanding > 0; });
      html += '<label for="bill_id">Which bill</label><select id="bill_id">' + (open.length ? open.map(function (b) { return '<option value="' + b.id + '"' + (String(draft.bill_id) === String(b.id) ? ' selected' : '') + '>' + esc(b.bill_no || '#' + b.id) + ' · owed ' + rs(b.outstanding) + '</option>'; }).join('') : '<option value="">No open bills</option>') + '</select>' +
        f('amount', 'Amount (Rs.)', 'number', 'inputmode="decimal" min="0" step="0.01"') + '<label for="method">How paid</label><select id="method"><option>cash</option><option>bank transfer</option></select>' + f('paid_at', 'Date paid', 'date');
    }
    html += '<div class="bar"><button type="submit">Save</button><button type="button" class="ghost" id="dc">Cancel</button></div><div id="de" class="sm bad" role="alert"></div></form>';
    $('sheet').innerHTML = html; $('dr').classList.add('on');
    var form = $('df');
    if (kind === 'bill' && !$('bill_date').value) $('bill_date').value = today();
    if (kind === 'pay' && !$('paid_at').value) $('paid_at').value = today();
    form.addEventListener('input', function () { var o = {}; [].forEach.call(form.querySelectorAll('input,select'), function (e) { o[e.id] = e.value; }); try { localStorage.setItem(key, JSON.stringify(o)); } catch (_) {} });
    $('dc').onclick = closeDrawer;
    form.addEventListener('submit', function (e) {
      e.preventDefault(); var err = $('de'); err.textContent = '';
      var v = function (id) { return ($(id).value || '').trim(); }, url, body;
      if (kind === 'bill') {
        if (!(Number(v('total')) > 0)) { err.textContent = 'Enter the bill total.'; return; }
        url = '/api/vendor-ledger/bills'; body = { vendor_name: name, bill_no: v('bill_no') || undefined, bill_date: v('bill_date'), due_date: v('due_date') || undefined, total: Number(v('total')) };
      } else {
        if (!v('bill_id')) { err.textContent = 'No open bill to pay.'; return; }
        if (!(Number(v('amount')) > 0)) { err.textContent = 'Enter the amount.'; return; }
        url = '/api/vendor-ledger/bills/' + v('bill_id') + '/payments'; body = { amount: Number(v('amount')), method: v('method'), paid_at: v('paid_at') };
      }
      var btn = form.querySelector('[type=submit]'); btn.disabled = true;
      var send = window.OfflineSave ? OfflineSave.post(url, body) : fetch(url, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(function (r) { return r.json().then(function (j) { return r.ok ? { ok: true, response: j } : { ok: false, error: j.error }; }); });
      Promise.resolve(send).then(function (o) {
        btn.disabled = false;
        if (!o.ok) { err.textContent = o.error || 'Not saved. Try again.'; return; }
        try { localStorage.removeItem(key); } catch (_) {}
        closeDrawer(); say(o.queued ? 'Saved on this phone. It will send when the signal is back.' : 'Saved.');
        if (!o.queued) refresh();
      }).catch(function () { btn.disabled = false; err.textContent = 'Not saved. Try again.'; });
    });
    var first = form.querySelector('input,select'); if (first) first.focus();
  }
  function closeDrawer() { $('dr').classList.remove('on'); }

  function refresh() {
    return get('/list').then(function (r) {
      S.vendors = r.vendors || []; S.data = {}; drawList();
      if (S.cur) { drawDetail(); loadTab(); }
    }).catch(function (e) { $('list').innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="rl">Try again</button></div>'; $('rl').onclick = refresh; });
  }

  /* ---------- events ---------- */
  $('list').addEventListener('click', function (e) { var b = e.target.closest('[data-v]'); if (b) select(b.getAttribute('data-v')); });
  $('q').addEventListener('input', function () { S.q = this.value; drawList(); });
  document.querySelector('.chips').addEventListener('click', function (e) {
    var b = e.target.closest('[data-f]'); if (!b) return; S.filter = b.getAttribute('data-f');
    [].forEach.call(document.querySelectorAll('.chips button'), function (x) { x.setAttribute('aria-pressed', String(x === b)); }); drawList();
  });
  $('detail').addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; S.tab = b.getAttribute('data-t'); drawDetail(); loadTab(); });
  $('back').onclick = function () { $('app').classList.remove('pick'); };
  $('dr').addEventListener('click', function (e) { if (e.target === $('dr')) closeDrawer(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.type === 'v360-select' && e.data.vendor) select(e.data.vendor); });

  refresh().then(function () {
    var want = new URLSearchParams(location.search).get('v');
    if (!want) { try { if (window.matchMedia('(min-width:900px)').matches) want = localStorage.getItem('v360_last'); } catch (_) {} }
    if (want && S.vendors.some(function (v) { return v.vendor_name === want; })) select(want);
  });
  window.__v360 = { S: S, select: select }; // for tests
})();
