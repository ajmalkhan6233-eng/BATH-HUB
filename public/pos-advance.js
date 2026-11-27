/* pos-advance.js (AJ 27 Nov): ADVANCE ORDER. The customer pays part now, goods are NOT delivered, the bill stays OPEN.
   Pick payment method "Advance (goods later)", type the advance, press Generate: an open order + advance receipt is made (item reserved out of stock, no sale counted).
   "Advance (n)" button lists open orders; "Settle" takes the rest of the money and makes the normal bill. Own module: remove the script tag and nothing else changes. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var sel = $('paymentMethod'), gen = $('genBtn'), foot = document.querySelector('.item-foot');
  if (!sel || !gen || !window.Pos2 || !window.Pos2Api) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var money = function (n) { return 'Rs ' + Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var dmy = function (s) { var d = new Date(s); return isNaN(d) ? '' : ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2) + '/' + d.getFullYear(); };
  var J = function (u, o) { o = o || {}; o.credentials = 'same-origin'; if (o.body && typeof o.body !== 'string') { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(o.body); }
    return fetch(u, o).then(function (r) { return r.json().catch(function () { return null; }).then(function (d) { return { ok: r.ok, status: r.status, d: d }; }); }); };
  var err = function (m) { var e = $('errMsg'); if (e) e.textContent = m || ''; };

  // 1) payment option + advance fields
  var opt = document.createElement('option'); opt.value = 'Advance'; opt.textContent = 'Advance (goods later)'; sel.appendChild(opt);
  var box = document.createElement('div'); box.id = 'advBox'; box.style.cssText = 'display:none;margin-top:8px;padding:8px;border:1px solid #c9a24a;border-radius:8px;background:#fff8e6';
  box.innerHTML = '<div class="field"><label for="advAmt">Advance paid now (Rs)</label><input id="advAmt" inputmode="decimal" placeholder="0"></div>' +
    '<div class="field"><label for="advMethod">Advance paid by</label><select id="advMethod"><option value="cash">Cash</option><option value="card">Card</option><option value="online">Online transfer</option><option value="cheque">Cheque</option></select></div>' +
    '<div class="field" id="advRefRow" style="display:none"><label for="advRef">Cheque number / bank and date</label><input id="advRef"></div>' +
    '<div class="message" id="advNote" style="font-size:12px;color:#5a4300">Bill stays OPEN. The item is reserved for the customer (taken out of stock) and goods are not delivered until the rest is paid. This is not a sale yet.</div>';
  sel.parentNode.parentNode.insertBefore(box, sel.parentNode.nextSibling);
  function show() { var on = sel.value === 'Advance'; box.style.display = on ? '' : 'none'; gen.textContent = on ? 'Save advance order' : (gen.textContent === 'Save advance order' ? 'Generate Bill' : gen.textContent); $('advRefRow').style.display = $('advMethod').value === 'cheque' ? '' : 'none'; }
  sel.addEventListener('change', show); $('advMethod').addEventListener('change', show); show();

  // 2) Generate with Advance selected = save an open order (instead of a bill)
  document.addEventListener('click', function (e) {
    if (sel.value !== 'Advance' || !e.target.closest || !e.target.closest('#genBtn')) return;
    e.stopImmediatePropagation(); e.preventDefault(); saveAdvance();
  }, true);
  function saveAdvance() {
    err(''); var rows = Pos2.rows(); if (!rows.length) { err('Add at least one item.'); return; }
    var name = $('customerName').value.trim(), phone = $('customerPhone').value.trim();
    if (!name && !phone) { err('An advance order needs the customer name or phone.'); return; }
    var adv = Number($('advAmt').value.replace(/,/g, '')); if (!(adv > 0)) { err('Type the advance paid.'); return; }
    var t = Pos2.totals(), sub = 0; rows.forEach(function (r) { sub += Math.round(r.qty * r.price * 100) / 100; });
    var pct = sub > 0 ? Math.round(t.disc / sub * 1e8) / 1e6 : 0;
    var body = { customer_name: name, customer_phone: phone, discount_pct: pct, advance_amount: adv, advance_method: $('advMethod').value, advance_ref: ($('advRef') || {}).value || '', salesman: ($('salesman') || {}).value,
      items: rows.map(function (r) { return { item_name: r.name, item_code: r.code || undefined, qty: Number(r.qty), unit_price: Number(r.price) }; }) };
    gen.disabled = true; gen.textContent = 'Saving…';
    J('/api/pos-advance', { method: 'POST', body: body }).then(function (r) {
      if (!r.ok) throw new Error((r.d && r.d.error) || 'The advance order was not saved.');
      printReceipt(r.d); $('advAmt').value = ''; if ($('advRef')) $('advRef').value = ''; Pos2.clearForNext(); sel.value = 'Cash'; show(); count();
    }).catch(function (e) { err(e.message); }).then(function () { gen.disabled = false; gen.textContent = sel.value === 'Advance' ? 'Save advance order' : 'Generate Bill'; show(); });
  }

  // 3) advance receipt (printable)
  function printReceipt(o) {   // 27 Nov (AJ): same design as the normal bill (server PDF). The old plain page is kept below as a fallback.
    var w2 = window.open('/api/pos-advance/' + o.id + '/pdf', '_blank'); if (w2) return; printReceiptPlain(o);
  }
  function printReceiptPlain(o) {
    var w = window.open('', '_blank'); if (!w) { err('Saved ' + o.order_no + '. Allow pop-ups to print the receipt.'); return; }
    var items = (typeof o.items === 'string' ? JSON.parse(o.items) : o.items) || [];
    w.document.write('<!doctype html><meta charset="utf-8"><title>' + esc(o.order_no) + '</title><style>body{font:14px Arial;max-width:360px;margin:12px auto;color:#111}h2,h3{text-align:center;margin:4px 0}table{width:100%;border-collapse:collapse}td,th{padding:3px 2px;text-align:left;border-bottom:1px dotted #aaa}td:last-child,th:last-child{text-align:right}.box{border:2px solid #111;padding:6px;margin:10px 0;text-align:center;font-weight:700}.r{text-align:right;line-height:1.7}</style>' +
      '<h2>Royal Bath Hub</h2><div style="text-align:center;font-size:12px">173/1 Kandy Road, Thihariya · 074 035 5536</div><h3>ADVANCE RECEIPT</h3><div class="box">ORDER OPEN · GOODS NOT DELIVERED</div>' +
      '<div>' + esc(o.order_no) + ' · ' + dmy(o.created_at) + '<br>' + esc(o.customer_name || '') + ' ' + esc(o.customer_phone || '') + '</div><table><tr><th>Item</th><th>Qty</th><th>Rs</th></tr>' +
      items.map(function (i) { return '<tr><td>' + esc(i.item_name) + '</td><td>' + Number(i.qty) + '</td><td>' + money(i.line_total).replace('Rs ', '') + '</td></tr>'; }).join('') + '</table>' +
      '<div class="r">' + (Number(o.subtotal) > Number(o.total) ? 'Total: ' + money(o.subtotal) + '<br>Discount: ' + money(Number(o.subtotal) - Number(o.total)) + '<br>' : '') + 'Net total: ' + money(o.total) + '<br>Advance received (' + esc(o.advance_method) + '): <b>' + money(o.advance_amount) + '</b><br><b>Balance to pay: ' + money(o.balance) + '</b></div>' +
      '<div style="font-size:11px;text-align:center;margin-top:12px">Goods are delivered after the balance is paid. Please keep this receipt. Thank you.</div><script>setTimeout(function(){window.print()},300)<\/script>');
    w.document.close();
  }

  // 4) list of open orders + settle
  var btn = document.createElement('button'); btn.className = 'secondary'; btn.id = 'advListBtn'; btn.textContent = 'Reserved (0)'; btn.type = 'button';
  var held = $('heldBtn'); if (held && held.parentNode) held.parentNode.insertBefore(btn, held.nextSibling); else if (foot) foot.appendChild(btn);
  function count() { J('/api/pos-advance?status=open').then(function (r) { if (r.ok && r.d) btn.textContent = 'Reserved (' + r.d.count + ')'; }); }
  count(); setInterval(count, 60000);
  btn.onclick = list;
  if (/[?&]reserved=1/.test(location.search)) setTimeout(function () { try { list(); } catch (_) {} }, 700);   // Sales window tab 'Reserved' opens this list straight away
  var ov = null;
  function modal(html) { close(); ov = document.createElement('div'); ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:99999;display:flex;align-items:center;justify-content:center;padding:12px';
    ov.innerHTML = '<div style="background:#fff;border-radius:10px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:14px;box-shadow:0 8px 30px rgba(0,0,0,.3)">' + html + '<div style="text-align:right;margin-top:10px"><button type="button" class="secondary" id="advClose">Close</button></div></div>';
    document.body.appendChild(ov); $('advClose').onclick = close; ov.addEventListener('click', function (e) { if (e.target === ov) close(); }); return ov; }
  function close() { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); ov = null; }
  var tab = 'open';
  function list(t) {
    if (typeof t === 'string') tab = t;
    J('/api/pos-advance?status=' + tab).then(function (r) {
      var o = (r.d && r.d.orders) || [];
      var m = modal('<h3 style="margin:0 0 6px">Advance orders</h3><div style="margin-bottom:8px">' + ['open','settled','cancelled'].map(function (k) { return '<button type="button" class="' + (k === tab ? 'gold' : 'secondary') + '" data-t="' + k + '">' + k.charAt(0).toUpperCase() + k.slice(1) + '</button>'; }).join(' ') + '</div>' + '<div class="muted" style="font-size:12px">' + tab + ': ' + o.length + '</div>' + (r.d && tab === 'open' ? '<div class="muted" style="font-size:12px;margin-bottom:8px">Advance held: ' + money(r.d.advance_held) + ' (not sales yet)</div>' : '') +
        (o.length ? o.map(function (x) { return '<div style="border:1px solid #ddd;border-radius:8px;padding:8px;margin-bottom:6px"><b>' + esc(x.order_no) + '</b> · ' + esc(x.customer_name || x.customer_phone || '') + ' · ' + dmy(x.created_at) +
          '<br>Total ' + money(x.total) + ' · Advance ' + money(x.advance_amount) + ' · <b>Balance ' + money(x.balance) + '</b>' + (x.bill_number ? ' · Bill ' + esc(x.bill_number) : '') + '<br>' + (x.status === 'open' ? '<button type="button" class="gold" data-s="' + x.id + '">Settle</button> <button type="button" class="secondary" data-u="' + x.id + '">Add advance</button> <button type="button" class="secondary" data-c="' + x.id + '">Cancel</button> ' : '<button type="button" class="secondary" data-o="' + x.id + '">Reopen</button> ') + '<button type="button" class="secondary" data-p="' + x.id + '">Print receipt</button></div>'; }).join('') : 'No open advance orders.'));
      m.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button'); if (!b) return;
        if (b.dataset.t) list(b.dataset.t); if (b.dataset.u) topup(Number(b.dataset.u)); if (b.dataset.o) reopen(Number(b.dataset.o)); if (b.dataset.s) settle(Number(b.dataset.s)); if (b.dataset.p) J('/api/pos-advance/' + b.dataset.p).then(function (x) { if (x.ok) printReceipt(x.d); }); if (b.dataset.c) cancelOrder(Number(b.dataset.c)); });
    });
  }
  function settle(id) {
    J('/api/pos-advance/' + id).then(function (r) {
      if (!r.ok) return; var o = r.d;
      if (o.existing_bill) { J('/api/pos-advance/' + id + '/settled', { method: 'POST', body: { bill_id: o.existing_bill.id } }).then(function () { done(o.existing_bill); }); return; }
      var m = modal('<h3 style="margin:0 0 8px">Settle ' + esc(o.order_no) + '</h3><div>' + esc(o.customer_name || o.customer_phone || '') + '<br>Total ' + money(o.total) + '<br>Advance paid ' + money(o.advance_amount) + ' (' + esc((o.payments || []).map(function (p) { return p.method + ' ' + p.amount; }).join(', ') || o.advance_method) + ')<br><b>Balance to pay now: ' + money(o.balance) + '</b></div>' +
        (o.balance > 0 ? '<div class="field" style="margin-top:8px"><label>Balance paid by</label><select id="sbM"><option value="cash">Cash</option><option value="card">Card</option><option value="online">Online transfer</option><option value="cheque">Cheque</option></select></div><div class="field" id="sbRr" style="display:none"><label>Cheque number / bank and date</label><input id="sbR"></div>' : '') +
        '<div class="message" id="sbE" role="alert" style="color:#b00020"></div><button type="button" class="primary" id="sbGo">Take payment and generate bill</button>');
      if ($('sbM')) $('sbM').onchange = function () { $('sbRr').style.display = $('sbM').value === 'cheque' ? '' : 'none'; };
      $('sbGo').onclick = function () {
        var items = (typeof o.items === 'string' ? JSON.parse(o.items) : o.items), pay = [], g = {}; (o.payments && o.payments.length ? o.payments : [{ method: o.advance_method, amount: o.advance_amount, reference: o.advance_ref, paid_at: o.created_at }]).forEach(function (p) { var k = p.method; g[k] = g[k] || { method: k, amount: 0, reference: '' }; g[k].amount = Math.round((g[k].amount + Number(p.amount)) * 100) / 100; g[k].reference += (g[k].reference ? '; ' : '') + ('Advance ' + o.order_no + ' ' + dmy(p.paid_at) + ' ' + (p.reference || '')).trim(); }); Object.keys(g).forEach(function (k) { pay.push(g[k]); });
        if (o.balance > 0) { var bm = $('sbM').value, br = ($('sbR') || {}).value || ''; if (bm === 'cheque' && !br.trim()) { $('sbE').textContent = 'A cheque needs its number or bank and date.'; return; } var same = pay.filter(function (p) { return p.method === bm; })[0]; if (same) { same.amount = Math.round((same.amount + o.balance) * 100) / 100; same.reference += (br ? '; ' + br : ''); } else pay.push({ method: bm, amount: o.balance, reference: br || undefined }); }
        var body = { customer_name: o.customer_name, customer_phone: o.customer_phone, discount_pct: Number(o.discount_pct), salesman: o.salesman || undefined, notes: 'Advance order ' + o.order_no, payments: pay,
          items: items.map(function (i) { return { item_name: i.item_name, item_code: i.item_code || undefined, qty: i.qty, unit_price: i.unit_price }; }) };
        $('sbGo').disabled = true; $('sbGo').textContent = 'Saving…';
        var post = function (over) { if (over) body.override = true; return J('/api/pos-bills', { method: 'POST', body: body }); };
        post().then(function (b) { if (b.status === 409 && b.d && b.d.can_override && confirm(b.d.error + '\nApprove as owner?')) return post(true); return b; }).then(function (b) {
          if (!b.ok) throw new Error((b.d && b.d.error) || 'The bill was not saved.');
          return J('/api/pos-advance/' + id + '/settled', { method: 'POST', body: { bill_id: b.d.id } }).then(function () { done(b.d); });
        }).catch(function (e) { $('sbE').textContent = e.message; $('sbGo').disabled = false; $('sbGo').textContent = 'Take payment and generate bill'; });
      };
    });
  }
  function done(b) { count(); try { Pos2.loadToday(); } catch (e) {}
    modal('<h3 style="margin:0 0 8px">Bill ' + esc(b.bill_number) + ' generated</h3><div>The advance order is settled. Goods can be delivered.</div><button type="button" class="primary" id="advOpen" style="margin-top:8px">Open bill</button>');
    $('advOpen').onclick = function () { window.open('/api/pos-bills/' + b.id + '/pdf', '_blank'); }; }
  function topup(id) { var a = window.prompt('More advance received (Rs)?'); if (!a) return; var m = (window.prompt('Paid by: cash, card, online or cheque?', 'cash') || 'cash').toLowerCase(), ref = ''; if (m === 'cheque') { ref = window.prompt('Cheque number / bank and date?') || ''; }
    J('/api/pos-advance/' + id + '/topup', { method: 'POST', body: { amount: Number(a.replace(/,/g, '')), method: m, reference: ref } }).then(function (r) { if (!r.ok) alert((r.d && r.d.error) || 'Could not add.'); else printReceipt(r.d); count(); list(); }); }
  function reopen(id) { if (!confirm('Reopen this advance order?')) return; J('/api/pos-advance/' + id + '/reopen', { method: 'POST', body: {} }).then(function (r) { if (!r.ok) alert((r.d && r.d.error) || 'Could not reopen.'); count(); list('open'); }); }
  function cancelOrder(id) { var why = window.prompt('Why is this advance order cancelled? Say how the advance is returned.'); if (!why || !why.trim()) return;
    J('/api/pos-advance/' + id + '/cancel', { method: 'POST', body: { reason: why } }).then(function (r) { if (!r.ok) alert((r.d && r.d.error) || 'Could not cancel.'); count(); list(); }); }
})();
