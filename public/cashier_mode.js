/* CASHIER MODE: a cashier sees only POS Billing. (The server refuses everything else anyway; this just hides the menus and opens the POS.) */
(function () {
  'use strict';
  fetch('/api/me', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (u) {
    if (!u || u.role !== 'cashier') return;
    var s = document.createElement('style');
    s.textContent = '#rbh-menubar,.sidebar,.bottom-nav,#pal-btn,#rbh-attention,.layla-door,[data-go="__more"]{display:none!important}';
    document.head.appendChild(s); document.documentElement.classList.add('rbh-cashier');
    var tries = 0, t = setInterval(function () { try { if (typeof window.navigate === 'function') { window.navigate('pos'); clearInterval(t); } } catch (e) {} if (++tries > 40) clearInterval(t); }, 250);
  }).catch(function () {});
})();
