/* Oversold prompt (AJ 24 Oct): after a stock-in (GRN) is saved, if any of those items were sold past stock, ask how it was covered. */
(function () {
  'use strict';
  var seen = {};
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function api(u, o) { return fetch(u, Object.assign({ credentials: 'same-origin', headers: { 'Content-Type': 'application/json' } }, o || {})).then(function (r) { return r.json(); }); }
  function ask(items) {
    items = items.filter(function (i) { return !seen[i.id]; }); if (!items.length) return;
    var it = items[0]; seen[it.id] = 1;
    var box = document.createElement('div');
    box.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px';
    box.innerHTML = '<div style="background:#1b1b1b;color:#fff;border:2px solid #f5c542;border-radius:14px;max-width:420px;width:100%;padding:18px;font-family:system-ui">' +
      '<div style="font-size:18px;font-weight:700;color:#f5c542">You sold ' + esc(it.qty_short) + ' more ' + esc(it.item_name) + ' than you had</div>' +
      '<div style="margin:8px 0 14px;opacity:.85">Bill ' + esc(it.bill_number) + (it.customer_name ? ' · ' + esc(it.customer_name) : '') + (it.customer_phone ? ' · ' + esc(it.customer_phone) : '') + '<br>How did you cover it?</div>' +
      '<button data-h="same_vendor" style="width:100%;padding:14px;margin:4px 0;font-size:16px;border-radius:10px">From the same vendor (same cost)</button>' +
      '<button data-h="local_cash" style="width:100%;padding:14px;margin:4px 0;font-size:16px;border-radius:10px">Bought locally, cash</button>' +
      '<input id="os-cost" type="number" inputmode="decimal" placeholder="Price paid per piece (Rs)" style="display:none;width:100%;box-sizing:border-box;padding:12px;margin:4px 0;font-size:16px;border-radius:10px">' +
      '<button data-h="still_owe" style="width:100%;padding:14px;margin:4px 0;font-size:16px;border-radius:10px">Still owe the customer</button></div>';
    document.body.appendChild(box);
    var cost = box.querySelector('#os-cost'), asked = false;
    box.addEventListener('click', function (e) {
      var h = e.target && e.target.getAttribute && e.target.getAttribute('data-h'); if (!h) return;
      if (h === 'local_cash' && !asked) { asked = true; cost.style.display = 'block'; cost.focus(); e.target.textContent = 'Save local cash price'; return; }
      api('/api/oversold/' + it.id + '/resolve', { method: 'POST', body: JSON.stringify({ how: h, cost: cost.value }) }).then(function (r) {
        if (r && r.error) { alert(r.error); return; }
        box.remove(); ask(items.slice(1));
      }).catch(function () { alert('Not saved, try again'); });
    });
  }
  function check(codes) { api('/api/oversold/open' + (codes && codes.length ? '?codes=' + encodeURIComponent(codes.join(',')) : '')).then(function (d) { if (d && d.items) ask(d.items); }).catch(function () {}); }
  var of = window.fetch;
  window.fetch = function (u, o) {
    var p = of.apply(this, arguments);
    try { if (/\/api\/grn-manual/.test(String(u && u.url || u)) && o && /post/i.test(o.method || '')) p.then(function (r) { if (r && r.ok) setTimeout(function () { check(); }, 600); }).catch(function () {}); } catch (e) {}
    return p;
  };
  window.rbhOversoldCheck = check;
})();
