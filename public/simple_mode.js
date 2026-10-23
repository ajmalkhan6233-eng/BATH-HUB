/* Simple mode for the owner shell: Simple (4 screens) or Full (grouped, folding menu), plus a Refresh button.
   Added with ONE script tag at the end of bathco_complete.html. Touches no data. Remembers choice on this device (try/catch). */
(function () {
  'use strict';
  var KEY = 'bh_ui_mode', SIMPLE = ['dashboard', 'pos', 'grn', 'stock', 'prices', 'stickers', 'vendorsum'];
  var GROUPS = [
    ['Daily work', ['dashboard', 'pos', 'daily-sales', 'dailybreakdown']],
    ['Items', ['stock', 'prices', 'stickers']],
    ['Purchasing', ['grn', 'vendorsum', 'vendors', 'cheques']],
    ['Money', ['expenses', 'loans', 'commissions', 'salary', 'moneycontrol']],
    ['Reports', ['reportshub', 'reports', 'competitors']],
    ['Papers', ['docinbox', 'documents', 'policy']],
    ['Customers and web', ['enquiries', 'replies', 'website', 'webcat', 'tilegallery', 'branches']],
    ['Settings and admin', ['settings', 'shoptools', 'adminusers', 'adminaudit', 'adminsystem', 'adminsettings', 'agentreview', 'agent-rules', 'content']]
  ];
  var OPEN_DEFAULT = { 'Daily work': 1, 'Items': 1, 'Purchasing': 1 };
  var busy = false;
  function get(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) { /* not remembered */ } }
  function mode() { return get(KEY, 'simple') === 'full' ? 'full' : 'simple'; }
  function closed(name) { var v = get('bh_grp_' + name, null); return v === null ? !OPEN_DEFAULT[name] : v === '1'; }
  var css = document.createElement('style');
  css.textContent = '.sm-hide{display:none!important}.sm-head{list-style:none;padding:12px 10px 4px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.7;cursor:pointer;display:flex;justify-content:space-between;align-items:center;user-select:none}' +
    '.sm-head:after{content:"\\25BE";font-size:12px}.sm-head.sm-shut:after{content:"\\25B8"}' +
    '.sm-pill{font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer;min-height:34px}' +
    '.sm-bar{display:flex;gap:8px;padding:8px 10px}.sm-bar .sm-pill{flex:1}@media(min-width:768px){.sm-bar{display:none}}@media(max-width:767px){.topbar-right .sm-pill,.topbar-right .sm-ref{display:none}}' +
    '.sm-ref{font-size:16px;padding:4px 10px;min-height:34px;border-radius:8px;border:1px solid currentColor;background:transparent;color:inherit;cursor:pointer}';
  document.head.appendChild(css);
  function organise() {
    var ul = document.querySelector('.sidebar-nav'); if (!ul || busy) return;
    busy = true;
    try {
      var full = mode() === 'full';
      var items = Array.prototype.slice.call(ul.querySelectorAll('li.nav-item[data-page]'));
      var byKey = {}; items.forEach(function (li) { byKey[li.dataset.page] = li; });
      var seq = [], used = {};
      GROUPS.forEach(function (g) {
        var here = g[1].filter(function (k) { return byKey[k]; });
        if (!here.length) return;
        seq.push({ head: g[0] });
        here.forEach(function (k) { used[k] = 1; seq.push({ li: byKey[k], group: g[0] }); });
      });
      var rest = items.filter(function (li) { return !used[li.dataset.page]; });
      if (rest.length) { seq.push({ head: 'More' }); rest.forEach(function (li) { seq.push({ li: li, group: 'More' }); }); }
      var heads = {}; Array.prototype.forEach.call(ul.querySelectorAll('li.sm-head'), function (h) { heads[h.dataset.g] = h; });
      var want = seq.map(function (s) { if (s.head) { if (!heads[s.head]) { var h = document.createElement('li'); h.className = 'sm-head'; h.dataset.g = s.head; h.textContent = s.head; h.onclick = (function (n) { return function () { set('bh_grp_' + n, closed(n) ? '0' : '1'); organise(); }; })(s.head); heads[s.head] = h; } return heads[s.head]; } return s.li; });
      var cur = Array.prototype.slice.call(ul.children);
      if (cur.length !== want.length || want.some(function (n, i) { return cur[i] !== n; })) want.forEach(function (n) { ul.appendChild(n); });
      seq.forEach(function (s) {
        if (s.head) { heads[s.head].classList.toggle('sm-hide', !full); heads[s.head].classList.toggle('sm-shut', closed(s.head)); return; }
        var k = s.li.dataset.page, hide = full ? closed(s.group) && k !== 'dashboard' : SIMPLE.indexOf(k) < 0;
        s.li.classList.toggle('sm-hide', hide);
      });
      Array.prototype.forEach.call(document.querySelectorAll('.sm-modebtn'), function (b) { b.textContent = full ? 'Simple' : 'Full menu'; });
    } finally { setTimeout(function () { busy = false; }, 0); }
  }
  function refresh() {   // soft refresh: reload the DATA of this screen only. The page, the login and the menu stay put.
    var act = document.querySelector('.nav-item.active'), key = act && act.dataset.page;
    try { if (typeof navigate === 'function' && key) navigate(key); } catch (_) { /* keep going */ }
    try { if (window.BHDashboardPro) window.BHDashboardPro.reload(); } catch (_) { /* keep going */ }
    try { var fr = key === 'pos' ? document.getElementById('pos-frame') : document.getElementById('frame-' + key); if (fr && fr.contentWindow) fr.contentWindow.location.reload(); } catch (_) { /* keep going */ }
    try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistration) navigator.serviceWorker.getRegistration().then(function (r) { if (r) r.update(); }).catch(function () {}); } catch (_) { /* optional */ }
    try { if (typeof toast === 'function') toast('Refreshed', 'success'); } catch (_) { /* optional */ }
  }
  function mkBtns(host, first) {
    var m = document.createElement('button'); m.className = 'sm-pill sm-modebtn'; m.type = 'button';
    m.onclick = function () { set(KEY, mode() === 'full' ? 'simple' : 'full'); organise(); };
    var r = document.createElement('button'); r.className = 'sm-ref'; r.type = 'button'; r.title = 'Refresh and update'; r.setAttribute('aria-label', 'Refresh and update'); r.textContent = '\u21BB'; r.onclick = refresh;
    host.insertBefore(r, first); host.insertBefore(m, r);
  }
  function addButtons() {
    var right = document.querySelector('.topbar-right'); if (right && !right.querySelector('.sm-modebtn')) mkBtns(right, right.firstChild);
    var ul = document.querySelector('.sidebar-nav');
    if (ul && !document.getElementById('sm-bar')) { var bar = document.createElement('div'); bar.id = 'sm-bar'; bar.className = 'sm-bar'; ul.parentNode.insertBefore(bar, ul); mkBtns(bar, null); }
  }
  function addOwnerPages() {
    if (typeof addFramePage !== 'function') return;
    fetch('/api/me', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
      if (!me || (me.role !== 'admin' && me.role !== 'owner')) return;
      addFramePage({ key: 'prices', label: 'Item catalog', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-wallet"/></svg>', url: '/prices.html', sub: 'Cost, price and profit for every item', after: 'stock' });
      addFramePage({ key: 'stickers', label: 'Stickers', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-clipboard"/></svg>', url: '/stickers.html', sub: 'Make and print item stickers', after: 'prices' });
      addFramePage({ key: 'vendorsum', label: 'Vendors', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-link"/></svg>', url: '/vendors_overview.html', sub: 'Bought, paid and pending per vendor', after: 'grn' });
      addFramePage({ key: 'reportshub', label: 'Download reports', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-trend"/></svg>', url: '/reports_hub.html', sub: 'Vendors, GRN, daily, weekly, monthly profit', after: 'dashboard' });
      var ov = document.querySelector('.sidebar-nav [data-page="vendors"] .nav-label'); if (ov) ov.textContent = 'Pay vendors';
      organise();
    }).catch(function () { /* menu stays as it is */ });
  }
  function start() {
    addButtons(); organise(); addOwnerPages();
    var ul = document.querySelector('.sidebar-nav'); if (!ul) return;
    var t = null; new MutationObserver(function () { if (busy) return; clearTimeout(t); t = setTimeout(organise, 80); }).observe(ul, { childList: true });
    setTimeout(organise, 600); setTimeout(organise, 2000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
