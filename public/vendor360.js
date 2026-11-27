/* Vendor 360: split screen. Left = vendors, right = money picture + Statement / Bills / Payments & cheques / GRN.
   Read-only data from /api/vendor360. Saves go through the existing /api/vendor-ledger (same checks, same offline queue). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var rs = function (n) { return 'Rs. ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var day = function (d) { return d ? String(d).slice(0, 10) : '-'; };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var S = { vendors: [], filter: 'all', q: '', cur: null, tab: 'bills', data: {} };
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
  // 18 Nov: Fazal / Fazaal / Fawaz spellings: compare without doubled letters
  function flat(s) { return String(s || '').toLowerCase().replace(/(.)\1+/g, '$1'); }
  function drawList() {
    var q = S.q.toLowerCase();
    var rows = S.vendors.filter(function (v) {
      if (q && flat(v.vendor_name).indexOf(flat(q)) < 0) return false;
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
        '<span class="stm" role="button" tabindex="0" data-st="' + esc(v.vendor_name) + '">Statement</span><span class="amt ' + (v.overdue > 0 ? 'bad' : '') + '">' + rs(v.outstanding_balance) + (v.overdue > 0 ? ' !' : '') + '</span></button>';
    }).join('');
  }

  /* ---------- right side ---------- */
  // 21 Nov: one page. Top = name, buttons, balance numbers, then the Debit / Credit tables (always shown). Below = Bills / Payments / GRN tabs.
  function select(name) {
    S.cur = name; S.data = {}; $('app').classList.add('pick'); drawList(); drawDetail();
    loadAcct(); loadTab();
    try { localStorage.setItem('v360_last', name); } catch (_) {}
  }
  function kpi(label, val, cls) { return '<div class="kpi"><span class="sm">' + label + '</span><b class="' + (cls || '') + '">' + val + '</b></div>'; }
  function drawDetail() {
    var v = S.vendors.filter(function (x) { return x.vendor_name === S.cur; })[0];
    if (!v) { $('detail').innerHTML = '<div class="state">Pick a vendor on the left.</div>'; return; }
    var tabs = [['bills', 'Bills'], ['pay', 'Payments & cheques'], ['grn', 'GRN'], ['ret', 'Returns & credit notes']];
    var after = v.outstanding_balance - (v.cheques_issued != null ? v.cheques_issued : (v.cheques_pending || 0));
    $('detail').innerHTML = '<div class="vhead"><h2>' + esc(v.vendor_name) + '</h2>' +
      '<div class="bar"><button type="button" id="nb">+ New bill</button><button type="button" id="np">+ Record payment</button><button type="button" id="nr">+ Return / discount</button><button type="button" class="ghost" id="pm">Pay: cheques, many bills</button><button type="button" class="ghost" id="pr">Print</button><button type="button" id="vv">Vendor statement</button></div></div>' +
      '<div class="kpis">' + kpi('Total bought (Debit)', rs(v.total_billed)) + kpi('Paid and cleared', rs(v.total_paid), 'good') + kpi('Cheques waiting to clear', rs(v.cheques_pending || 0)) + kpi(after < 0 ? 'In our favour after cheques' : 'Still to pay after cheques', rs(Math.abs(after)), after > 0 ? (v.overdue > 0 ? 'bad' : '') : 'good') + '</div>' +
      (v.overdue > 0 ? '<div class="sm bad">Overdue: ' + rs(v.overdue) + '</div>' : '') +
      '<div id="acct" class="acct"><div class="state">Loading...</div></div>' +
      '<div class="lower"><div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="tabbody" class="wrap"><div class="state">Loading...</div></div></div>';
    $('nb').onclick = function () { openDrawer('bill'); };
    $('np').onclick = function () { openDrawer('pay'); };
    $('pm').onclick = function () { try { var n = window.parent.document.querySelector('.sidebar-nav [data-page="vendors"]'); if (n) n.click(); else window.open('/bathco_complete.html#vendors'); } catch (_) { window.open('/bathco_complete.html#vendors'); } };   // the old Pay vendors page stays, hidden from the menu
    $('nr').onclick = function () { openReturn(); };   // 27 Nov (AJ): returns inside Vendor 360, no jumping to another window
    $('pr').onclick = function () { var h = document.querySelector('#detail .vhead h2'), n = h.textContent; if (n === 'Lucky Trading') h.textContent = 'Zamir'; window.print(); h.textContent = n; };   // statements print "Zamir"
    $('vv').onclick = function () { window.openVendorVoucher(S.cur); };
  }
  function loadAcct() {
    var name = S.cur, box = $('acct'); if (!box) return;
    var done = function () { if (S.cur === name && $('acct')) $('acct').innerHTML = tAccount(S.data.statement, (S.vendors.filter(function (x) { return x.vendor_name === name; })[0] || {}).overdue > 0); };
    if (S.data.statement) return done();
    get('/' + encodeURIComponent(name) + '/statement').then(function (r) { S.data.statement = r; done(); })
      .catch(function (e) { if (S.cur === name && $('acct')) $('acct').innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="retryA">Try again</button></div>'; var b = $('retryA'); if (b) b.onclick = loadAcct; });
  }
  function loadTab() {
    var name = S.cur, tab = S.tab, path = { bills: '/bills', pay: '/bills', grn: '/grns', ret: '/statement' }[tab] || '/bills';
    var body = $('tabbody'); if (!body) return;
    var key = tab === 'pay' ? 'bills' : tab === 'ret' ? 'statement' : tab;
    var done = function () { if (S.cur === name && S.tab === tab) drawBody(); };
    if (S.data[key]) return done();
    body.innerHTML = '<div class="state">Loading...</div>';
    get('/' + encodeURIComponent(name) + path).then(function (r) { S.data[key] = r; done(); })
      .catch(function (e) { if (S.cur === name) body.innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="retry">Try again</button></div>'; var b = $('retry'); if (b) b.onclick = loadTab; });
  }
  function table(head, rows, empty) {
    if (!rows.length) return '<div class="state">' + empty + '</div>';
    return '<table><thead><tr>' + head.map(function (h) { return '<th' + (h[1] ? ' class="n"' : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
  }
  var STATE = { PAID: ['Paid', 'good'], CHEQUE_ISSUED: ['Cheque issued', ''], PART_COVERED: ['Part covered', ''], UNPAID: ['Unpaid', 'bad'] };
  // AJ 12 Nov: "hara bara" ledger, Debit on the left and Credit on the right, cheques inside the credit side. 21 Nov: long lists scroll inside their own box.
  function tAccount(st, late) {
    var rows = st.rows || [], debs = rows.filter(function (r) { return Number(r.debit) > 0; }), crs = rows.filter(function (r) { return Number(r.credit) > 0; });
    var pc = {}, order = [];
    (st.pending_cheques || []).forEach(function (c) { var k = c.cheque_no || '?'; if (!pc[k]) { pc[k] = { no: k, bank: c.bank, due: c.due_date, amt: 0 }; order.push(k); } pc[k].amt += Number(c.amount || 0); });
    order.sort(function (x, y) { return String(pc[x].due) < String(pc[y].due) ? -1 : 1; });
    var dT = debs.reduce(function (a, r) { return a + Number(r.debit); }, 0), cT = crs.reduce(function (a, r) { return a + Number(r.credit); }, 0), pT = order.reduce(function (a, k) { return a + pc[k].amt; }, 0);
    var line = function (a, b, c, cls) { return '<div class="tl ' + (cls || '') + '"><span>' + a + '</span><span class="tm">' + b + '</span><b>' + c + '</b></div>'; };
    var L = debs.map(function (r) { return line(day(r.tx_date), esc(r.reference || r.description), rs(r.debit)); }).join('') || '<div class="state">No bills yet.</div>';
    var R = crs.map(function (r) { return line(day(r.tx_date), esc(r.reference || r.description) + ' (paid)', rs(r.credit), 'good'); }).join('') +
      order.map(function (k) { var c = pc[k]; return line(day(c.due), 'Cheque ' + esc(c.no) + ' <i class="wt">waiting to clear</i>', rs(c.amt), 'chq'); }).join('');
    if (!R) R = '<div class="state">Nothing paid yet.</div>';
    var bal = dT - cT - pT;
    return '<div class="ta"><div class="tc"><h4 class="dh">DEBIT (Dr) - bills we owe</h4><div class="tls">' + L + '</div><div class="tt"><span>Total</span><span>' + rs(dT) + '</span></div></div>' +
      '<div class="tc"><h4 class="ch">CREDIT (Cr) - paid and cheques</h4><div class="tls">' + R + '</div><div class="tt"><span>Total</span><span>' + rs(cT + pT) + '</span></div></div>' +
      '<div class="tb" style="color:' + (bal > 0 ? (late ? 'var(--red,#c0392b)' : 'var(--ink)') : 'var(--green,#2e8b57)') + '">' + (bal > 0 ? 'Still to pay: ' : bal < 0 ? 'Paid extra: ' : 'Balanced: ') + rs(Math.abs(bal)) + (pT ? '  (cheques waiting to clear are counted as paid here)' : '') + '</div></div>';
  }
  // 21 Nov: no due date = calm grey note, never red. Red only when a real due date has passed (server sets b.overdue only then).
  var NODUE = '<span class="nodue">No due date, extra time given</span>';
  function drawBody() {
    var body = $('tabbody'); if (!body) return; var t = S.tab, d = S.data;
    if (t === 'bills') {
      body.innerHTML = table([['Bill'], ['Date'], ['Due'], ['Total', 1], ['Owed', 1], ['Status']], d.bills.bills.map(function (b) {
        var s = STATE[b.state] || [b.state, ''], nd = !b.due_date, cls = s[1] === 'bad' && nd ? '' : s[1];
        return '<tr><td>' + esc(b.bill_no || '#' + b.id) + '</td><td>' + day(b.bill_date) + '</td><td class="' + (b.overdue ? 'bad' : '') + '">' + (nd ? NODUE : day(b.due_date)) + '</td><td class="n">' + rs(b.total) + '</td><td class="n">' + rs(b.outstanding) + '</td><td><span class="chip ' + cls + '">' + s[0] + (b.overdue ? ' · overdue' : '') + '</span></td></tr>';
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
    } else if (t === 'ret') {
      var nr = ((d.statement && d.statement.rows) || []).filter(function (r) { return r.tx_type === 'CREDIT_NOTE'; });
      body.innerHTML = table([['Date'], ['Credit note'], ['What'], ['Amount', 1]], nr.map(function (r) {
        return '<tr><td>' + day(r.tx_date) + '</td><td>' + esc(r.reference || '') + '</td><td>' + esc(r.description || '') + '</td><td class="n">' + rs(r.credit) + '</td></tr>';
      }), 'No returns or credit notes for this vendor yet.');
    } else if (t === 'grn') {
      body.innerHTML = table([['GRN'], ['Date'], ['Lines', 1], ['Total', 1]], (d.grn.grns || []).map(function (g) {
        return '<tr class="grnrow" tabindex="0" role="button" data-grn="' + esc(g.grn_number) + '" style="cursor:pointer"><td>' + esc(g.grn_number) + '</td><td>' + day(g.grn_date) + '</td><td class="n">' + g.lines + '</td><td class="n">' + rs(g.total) + '</td></tr>';
      }), 'No goods received from this vendor yet.');
      var openG = function (tr) { var n = tr.getAttribute('data-grn'); window.openGrnInvoice(S.cur, n, refresh); };
      Array.prototype.forEach.call(body.querySelectorAll('tr.grnrow'), function (tr) { tr.onclick = function () { openG(tr); }; tr.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openG(tr); } }; });
    }
  }

  /* ---------- side drawer: New bill / Record payment (drafts kept in this browser) ---------- */
  function openReturn() {   // the existing, tested returns form, shown inside this window; list refreshes when closed
    $('sheet').innerHTML = '<h2>Return / discount · ' + esc(S.cur) + '</h2><iframe src="/vendor_returns.html" title="Return" style="width:100%;height:70vh;border:0"></iframe><div class="bar"><button type="button" class="ghost" id="dc">Close</button></div>';
    $('dr').classList.add('on');
    $('dc').onclick = function () { $('dr').classList.remove('on'); delete S.data.statement; delete S.data.bills; drawDetail(); loadAcct(); loadTab(); };
  }
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
      if (S.cur) { drawDetail(); loadAcct(); loadTab(); }
    }).catch(function (e) { $('list').innerHTML = '<div class="state bad">' + esc(e.message) + ' <button type="button" id="rl">Try again</button></div>'; $('rl').onclick = refresh; });
  }

  /* ---------- events ---------- */
  $('list').addEventListener('click', function (e) { var st = e.target.closest('[data-st]'); if (st) { e.stopPropagation(); window.openVendorVoucher(st.getAttribute('data-st')); return; } var b = e.target.closest('[data-v]'); if (b) select(b.getAttribute('data-v')); });
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
