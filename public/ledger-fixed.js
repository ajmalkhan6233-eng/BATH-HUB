/* Daily Ledger: monthly fixed costs paid a little each day from the till (Ajmal 2026-11-15).
   Monthly total / days in month = per-day share. "Take from till" fills one Payouts row, so the
   ledger's own till maths already deducts it. Costs are the same ones as before (/api/money-control/fixed-overheads). */
(function () {
  'use strict';
  var KEY = 'rbh-fixed-perday', DESC = 'Fixed costs (rent etc.)';
  var $ = function (id) { return document.getElementById(id); };
  var col = document.querySelector('.payouts-col'); if (!col) return;
  var box = document.createElement('div'); box.id = 'fixedBar';
  box.style.cssText = 'margin:6px 10px;padding:8px;border:1px solid var(--grout-strong,#444);border-radius:8px;font-size:13px';
  box.innerHTML = '<div id="fxLine">Fixed costs: loading…</div>' +
    '<div style="display:flex;gap:6px;align-items:center;margin-top:6px;flex-wrap:wrap" data-no-enter-next>' +
    '<label for="fxDay" style="margin:0">Per day</label><input id="fxDay" type="text" inputmode="decimal" style="width:90px">' +
    '<button type="button" id="fxTake">Take from till</button><span id="fxMsg"></span></div>' +
    '<details style="margin-top:6px"><summary>Monthly fixed costs (add / change)</summary><div id="fxList" style="margin:6px 0"></div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap" data-enter-next><input id="fxName" placeholder="Name (Rent)" style="width:130px"><input id="fxAmt" type="text" inputmode="decimal" placeholder="Per month" style="width:100px"><button type="button" id="fxAdd">Add / update</button></div></details>';
  var h3 = col.querySelector('h3'); col.insertBefore(box, h3 ? h3.nextSibling : col.firstChild);
  var total = 0, items = [];
  function fmt(n) { return Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 }); }
  function dim() { var d = $('datePicker') && $('datePicker').value || new Date().toISOString().slice(0, 10); var y = +d.slice(0, 4), m = +d.slice(5, 7); return new Date(y, m, 0).getDate(); }
  function share() { return Math.round(total / dim()); }
  function show() {
    $('fxLine').textContent = items.length ? 'Fixed costs ' + fmt(total) + ' a month, share ' + fmt(share()) + ' a day (÷ ' + dim() + ').' : 'No fixed costs yet. Add them below.';
    var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (!$('fxDay').value) $('fxDay').value = saved || (share() ? String(share()) : '');
    $('fxList').innerHTML = items.map(function (o) { return o.name + ' <b>' + fmt(o.monthly_amount) + '</b>'; }).join(' · ') || '';
  }
  function load() {
    fetch('/api/money-control/fixed-overheads', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (a) {
      items = Array.isArray(a) ? a : []; total = items.reduce(function (s, o) { return s + Number(o.monthly_amount || 0); }, 0); show();
    }).catch(function () { $('fxLine').textContent = 'Could not load fixed costs.'; });
  }
  $('fxDay').addEventListener('change', function () { try { localStorage.setItem(KEY, $('fxDay').value.replace(/[^0-9.]/g, '')); } catch (e) {} });
  $('datePicker') && $('datePicker').addEventListener('change', function () { $('fxDay').value = ''; show(); });
  $('fxTake').addEventListener('click', function () {
    var amt = Number(String($('fxDay').value).replace(/[^0-9.]/g, '')), msg = $('fxMsg');
    if (!(amt > 0)) { msg.textContent = ' Enter an amount.'; return; }
    var rows = [].slice.call(document.querySelectorAll('#payBody tr'));
    var dup = rows.some(function (tr) { var i = tr.querySelector('input'); return i && i.value === DESC; });
    if (dup) { msg.textContent = ' Already taken for this day.'; return; }
    var blank = rows.filter(function (tr) { var ins = tr.querySelectorAll('input'); return ins[0] && !ins[0].value && !ins[ins.length - 1].value; })[0];
    if (!blank) { msg.textContent = ' No blank payout row. Press Enter in the last Amount box first.'; return; }
    var ins = blank.querySelectorAll('input'), sel = blank.querySelector('select');
    ins[0].value = DESC; ins[0].dispatchEvent(new Event('input', { bubbles: true }));
    if (sel) { var o = [].slice.call(sel.options).filter(function (x) { return /cash/i.test(x.textContent); })[0]; if (o) { sel.value = o.value; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
    var a = ins[ins.length - 1]; a.value = String(amt); a.dispatchEvent(new Event('input', { bubbles: true })); a.dispatchEvent(new Event('blur'));
    try { localStorage.setItem(KEY, String(amt)); } catch (e) {}
    msg.textContent = ' Taken: ' + fmt(amt);
  });
  $('fxAdd').addEventListener('click', function () {
    var n = $('fxName').value.trim(), m = Number(String($('fxAmt').value).replace(/[^0-9.]/g, ''));
    if (!n || !(m > 0)) { $('fxMsg').textContent = ' Enter name and amount.'; return; }
    fetch('/api/money-control/fixed-overheads', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: n, monthly_amount: m }) })
      .then(function (r) { $('fxMsg').textContent = r.ok ? ' Saved.' : ' Not saved (' + r.status + ').'; if (r.ok) { $('fxName').value = ''; $('fxAmt').value = ''; $('fxDay').value = ''; load(); } });
  });
  load();
})();
