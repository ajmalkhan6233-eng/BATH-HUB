/* BLOCK: cheque-dayask (AJ 13 Nov). On the day a cheque we gave is due, the app ASKS: "Cleared?" or "Not cleared". AJ answers; nothing is marked by itself.
   Cleared -> same safe clear as the Cleared button (bill balance goes down). Not cleared -> stays Given, asked again tomorrow.
   Owner shell only (not inside embedded screens). Reads /api/grn-cheques, writes only POST /api/vendor-ledger/cheques/:id/clear. Any failure is ignored. */
(function () {
  if (window.top !== window.self) return;
  var KEY = 'rbh_chq_ask', EVERY = 20 * 60 * 1000;
  function today() { return new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10); }
  function snoozed() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function snooze(id) { try { var s = snoozed(), t = today(), n = {}; n[id] = t; Object.keys(s).forEach(function (k) { if (s[k] === t) n[k] = t; }); localStorage.setItem(KEY, JSON.stringify(n)); } catch (e) {} }
  function fmt(n) { return Number(n || 0).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function el(t, a, x) { var e = document.createElement(t); if (a) Object.keys(a).forEach(function (k) { if (k === 'text') e.textContent = a[k]; else e.setAttribute(k, a[k]); }); (x || []).forEach(function (c) { e.appendChild(c); }); return e; }
  function close() { var o = document.getElementById('chq-ask'); if (o) o.remove(); }
  function show(list) {
    close();
    var box = el('div', { style: 'background:#fff;color:#0b0b0b;border:2px solid #C9A24B;border-radius:14px;max-width:560px;width:calc(100vw - 24px);max-height:80vh;overflow:auto;padding:14px;box-shadow:0 10px 40px rgba(0,0,0,.35);font:14px system-ui,sans-serif' });
    var ov = el('div', { id: 'chq-ask', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Cheques due', style: 'position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center' }, [box]);
    box.appendChild(el('div', { text: 'Cheques due today', style: 'font-size:17px;font-weight:700;margin:0 0 8px' }));
    var t = today(), rows = el('div'), left = list.length;
    function done(row, msg) { row.textContent = ''; row.appendChild(el('div', { text: msg, style: 'padding:6px 0;color:#555' })); if (--left <= 0) setTimeout(close, 700); }
    list.forEach(function (c) {
      var row = el('div', { style: 'border-top:1px solid #ddd;padding:10px 0' });
      var late = c.due_date < t ? ' (was due ' + c.due_date + ')' : '';
      row.appendChild(el('div', { text: 'Cheque ' + (c.cheque_no || '') + ' · ' + (c.vendor_name || '') + late, style: 'font-weight:600' }));
      row.appendChild(el('div', { text: 'Rs ' + fmt(c.amount) + (c.bank ? ' · ' + c.bank : ''), style: 'color:#444;margin:2px 0 8px' }));
      var bar = el('div', { style: 'display:flex;gap:8px' });
      var ok = el('button', { type: 'button', text: 'Cleared', style: 'flex:1;min-height:44px;font-size:15px;font-weight:600;border-radius:10px;border:1px solid #2e7d32;background:#e6f4e7;color:#14501a;cursor:pointer' });
      var no = el('button', { type: 'button', text: 'Not cleared', style: 'flex:1;min-height:44px;font-size:15px;font-weight:600;border-radius:10px;border:1px solid #b26a00;background:#fff3dc;color:#6b3f00;cursor:pointer' });
      ok.addEventListener('click', function () {
        ok.disabled = no.disabled = true;
        fetch('/api/vendor-ledger/cheques/' + encodeURIComponent(c.id) + '/clear', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
          .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
          .then(function (x) { if (x.ok) done(row, 'Cleared. Bill balance updated.'); else { ok.disabled = no.disabled = false; row.appendChild(el('div', { text: 'Not changed: ' + ((x.j && x.j.error) || 'try again'), style: 'color:#b42318;margin-top:6px' })); } })
          .catch(function () { ok.disabled = no.disabled = false; row.appendChild(el('div', { text: 'No connection. Try again.', style: 'color:#b42318;margin-top:6px' })); });
      });
      no.addEventListener('click', function () { snooze(c.id); done(row, 'Okay, not cleared. I will ask again tomorrow.'); });
      bar.appendChild(ok); bar.appendChild(no); row.appendChild(bar); rows.appendChild(row);
    });
    box.appendChild(rows);
    var later = el('button', { type: 'button', text: 'Ask me later', style: 'width:100%;min-height:40px;margin-top:8px;border-radius:10px;border:1px solid #bbb;background:#f6f6f6;color:#222;cursor:pointer' });
    later.addEventListener('click', close); box.appendChild(later);
    document.body.appendChild(ov);
  }
  function check() {
    if (document.getElementById('chq-ask')) return;
    fetch('/api/grn-cheques', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j) return; var t = today(), sn = snoozed();
      var due = (j.cheques || []).filter(function (c) { return c.status === 'ISSUED' && c.due_date && c.due_date <= t && sn[c.id] !== t; });
      if (due.length) show(due);
    }).catch(function () {});
  }
  window.addEventListener('load', function () { setTimeout(check, 2500); setInterval(check, EVERY); });
})();
