/* 18 Nov 2026 (AJ): Home dashboard PAUSED until the full audit is confirmed; a new dashboard with confirmed numbers follows.
   To switch the old dashboard back on: remove the dashboard_pause.js line from bathco_complete.html. Nothing was deleted. */
(function () {
  'use strict';
  var st = document.createElement('style');
  st.textContent = '#page-dashboard>*:not(#dash-paused){display:none!important}#page-dashboard#page-dashboard>#dash-paused#dash-paused#dash-paused{display:block!important;max-width:640px;margin:28px auto;padding:22px;border:1px solid var(--line,#dbe0e8);border-radius:14px;background:var(--card,#fff);color:var(--ink,#0f172a);font:16px/1.5 system-ui,"Segoe UI",sans-serif}#dash-paused h2{margin:0 0 8px;font-size:20px}#dash-paused p{margin:6px 0;color:var(--muted,#596577)}';
  document.head.appendChild(st);
  function put() {
    var pg = document.getElementById('page-dashboard');
    if (!pg || document.getElementById('dash-paused')) return;
    var d = document.createElement('div'); d.id = 'dash-paused';
    d.innerHTML = '<h2>Home numbers are paused</h2><p>We are checking every number first: stock, GRN, vendors, cheques and sales bills. Nothing here is guessed.</p><p>A new Home with the confirmed numbers comes right after the audit.</p>';
    pg.appendChild(d);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', put); else put();
})();
