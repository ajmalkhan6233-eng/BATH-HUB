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
      (v.cheques_pending > 0 ? '<div class="sm">' + rs(v.cheques_pending) + ' is covered by cheques not cleared yet (see the list below the statement). <b>After these cheques you still owe ' + rs(v.outstanding_balance - v.cheques_pending) + '.</b> A bill drops from We owe when its cheque clears.</div>' : '') +
      '<div class="bar"><button type="button" id="nb">+ New bill</button><button type="button" id="np">+ Record payment</button><button type="button" class="ghost" id="pr">Print</button><button type="button" id="vv">Payment voucher</button></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" data-t="' + t[0] + '" aria-selected="' + (S.tab === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      '<div id="tabbody" class="wrap"><div class="state">Loading...</div></div>';
    $('nb').onclick = function () { openDrawer('bill'); };
    $('np').onclick = function () { openDrawer('pay'); };
    $('pr').onclick = function () { window.print(); };
    $('vv').onclick = function () { window.openVendorVoucher(S.cur); };
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
  // AJ 12 Nov: a picture of debit (bought) against credit (paid) and how the balance moved. No switches.
  function chart(rows, v) {
    if (!rows || !rows.length) return '';
    var deb = rows.reduce(function (a, r) { return a + Number(r.debit || 0); }, 0), cre = rows.reduce(function (a, r) { return a + Number(r.credit || 0); }, 0);
    var mx = Math.max(deb, cre, 1), W = 700, H = 150, bw = 250;
    var dW = Math.max(3, Math.round(bw * deb / mx)), cW = Math.max(cre > 0 ? 3 : 0, Math.round(bw * cre / mx));
    var bal = rows.map(function (r) { return Number(r.running_balance || 0); }), hi = Math.max.apply(null, bal.concat([1])), lo = Math.min.apply(null, bal.concat([0]));
    var x0 = 330, x1 = 680, y0 = 28, y1 = 118, n = bal.length;
    var px = function (i) { return n === 1 ? (x0 + x1) / 2 : x0 + (x1 - x0) * i / (n - 1); }, py = function (b) { return y1 - (y1 - y0) * (b - lo) / ((hi - lo) || 1); };
    var pts = bal.map(function (b, i) { return px(i).toFixed(1) + ',' + py(b).toFixed(1); }), line = pts.join(' ');
    var area = 'M' + px(0).toFixed(1) + ',' + y1 + ' L' + pts.join(' L') + ' L' + px(n - 1).toFixed(1) + ',' + y1 + ' Z';
    var dots = bal.map(function (b, i) { return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(b).toFixed(1) + '" r="4" fill="var(--gold,#c9a24b)"><title>' + day(rows[i].tx_date) + ': ' + rs(b) + '</title></circle>'; }).join('');
    return '<div class="v360chart" style="margin:6px 0 10px;border:1px solid var(--line,#ddd);border-radius:14px;padding:8px 10px;background:linear-gradient(180deg,rgba(212,175,55,.08),transparent)">' +
      '<style>@keyframes v3grow{from{width:0}}@keyframes v3draw{from{stroke-dashoffset:900}to{stroke-dashoffset:0}}.v3b{animation:v3grow .9s ease-out both}.v3l{stroke-dasharray:900;animation:v3draw 1.2s ease-out both}</style>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" role="img" aria-label="Debit and credit chart" style="display:block;max-height:190px">' +
      '<text x="6" y="16" font-size="13" fill="var(--muted,#888)">We bought (Debit)</text>' +
      '<rect x="6" y="22" width="' + dW + '" height="26" rx="8" fill="var(--red,#c0392b)" class="v3b"/><text x="' + (dW + 12 > 220 ? dW - 8 : dW + 12) + '" y="41" font-size="14" font-weight="700" text-anchor="' + (dW + 12 > 220 ? 'end' : 'start') + '" fill="' + (dW + 12 > 220 ? '#fff' : 'var(--text,#222)') + '">' + rs(deb) + '</text>' +
      '<text x="6" y="72" font-size="13" fill="var(--muted,#888)">We paid (Credit)</text>' +
      '<rect x="6" y="78" width="' + cW + '" height="26" rx="8" fill="var(--green,#2e8b57)" class="v3b"/><text x="' + (cW + 12 > 220 ? cW - 8 : cW + 12) + '" y="97" font-size="14" font-weight="700" text-anchor="' + (cW + 12 > 220 ? 'end' : 'start') + '" fill="' + (cW + 12 > 220 ? '#fff' : 'var(--text,#222)') + '">' + rs(cre) + '</text>' +
      '<text x="6" y="134" font-size="14" font-weight="800" fill="' + (deb - cre > 0 ? 'var(--red,#c0392b)' : 'var(--green,#2e8b57)') + '">Balance ' + rs(deb - cre) + (deb - cre > 0 ? ' (we owe)' : '') + '</text>' +
      '<text x="' + x0 + '" y="16" font-size="13" fill="var(--muted,#888)">How the balance moved</text>' +
      '<line x1="' + x0 + '" y1="' + y1 + '" x2="' + x1 + '" y2="' + y1 + '" stroke="var(--line,#ccc)"/>' +
      '<path d="' + area + '" fill="rgba(212,175,55,.18)"/><polyline points="' + line + '" fill="none" stroke="var(--gold,#c9a24b)" stroke-width="3" stroke-linejoin="round" class="v3l"/>' + dots +
      '<text x="' + x0 + '" y="' + (H - 8) + '" font-size="12" fill="var(--muted,#888)">' + day(rows[0].tx_date) + '</text><text x="' + x1 + '" y="' + (H - 8) + '" font-size="12" text-anchor="end" fill="var(--muted,#888)">' + day(rows[n - 1].tx_date) + '</text></svg></div>';
  }
  function drawBody() {
    var body = $('tabbody'); if (!body) return; var t = S.tab, d = S.data;
    if (t === 'statement') {
      var st = d.statement;
      body.innerHTML = chart(st.rows, S.vendors.filter(function (x) { return x.vendor_name === S.cur; })[0]) + table([['Date'], ['Ref'], ['Details'], ['Debit', 1], ['Credit', 1], ['Balance', 1]], st.rows.map(function (r) {
        return '<tr><td>' + day(r.tx_date) + '</td><td>' + esc(r.reference) + '</td><td>' + esc(r.description) + '</td><td class="n">' + (r.debit ? rs(r.debit) : '-') + '</td><td class="n good">' + (r.credit ? rs(r.credit) : '-') + '</td><td class="n"><b>' + rs(r.running_balance) + '</b></td></tr>';
      }), 'Nothing recorded for this vendor yet.');
      var pc = {}, order = [];
      (st.pending_cheques || []).forEach(function (c) { var k = c.cheque_no || '?'; if (!pc[k]) { pc[k] = { no: k, bank: c.bank, due: c.due_date, amt: 0, bills: [] }; order.push(k); } pc[k].amt += Number(c.amount || 0); if (c.bill_no && pc[k].bills.indexOf(c.bill_no) < 0) pc[k].bills.push(c.bill_no); });
      if (order.length) {
        order.sort(function (x, y) { return String(pc[x].due) < String(pc[y].due) ? -1 : 1; });
        var tot = order.reduce(function (s2, k) { return s2 + pc[k].amt; }, 0);
        body.innerHTML += '<h3 style="margin:18px 0 6px">Cheques issued, waiting to clear</h3>' + table([['Cheque'], ['Bank'], ['Clears about'], ['For bills'], ['Amount', 1]], order.map(function (k) {
          var c = pc[k]; return '<tr><td><b>' + esc(c.no) + '</b></td><td>' + esc(String(c.bank || '').replace(/,.*$/, '')) + '</td><td>' + day(c.due) + '</td><td>' + esc(c.bills.join(', ')) + '</td><td class="n">' + rs(c.amt) + '</td></tr>';
        }).concat(['<tr><td colspan="4"><b>Total of these cheques</b></td><td class="n"><b>' + rs(tot) + '</b></td></tr>']), '');
      }
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
