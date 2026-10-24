/* Classic menu bar for the owner shell (24 Oct 2026, from MENU_MAP.md).
   Desktop: a menu bar under the top bar (File, Sales, Customers & Online, Vendors, Stock, Banking & Money, Profit, Reports) with drop-down lists.
   Phone: the bottom "More" button opens the same groups as one-at-a-time lists (rows 48 px).
   Touches no data. Every screen keeps its own key. A screen that does not exist yet shows "coming soon" and does nothing.
   The map is also exported (window.RBHMenu.MAP) so tests can check that every screen appears exactly once. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.document) { root.RBHMenu = api; api.start(root); }
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  // [group, [[key, label, soon?], ...]]
  var MAP = [
    ['File', [['docinbox', 'Document Inbox'], ['documents', 'Documents'], ['branches', 'Branches'], ['policy', 'Policy Watch'], ['agent-rules', 'Agent Rules'], ['agentreview', 'Agent Review'],
      ['shoptools', 'Shop Tools'], ['settings', 'Settings'], ['adminusers', 'Users and roles'], ['adminsettings', 'Shop details'], ['adminaudit', 'Audit log'], ['adminsystem', 'System']]],
    ['Sales', [['pos', 'POS Billing'], ['daily-sales', 'Daily Sales'], ['dailybreakdown', 'Daily Breakdown'], ['commissions', 'Sale Commissions']]],
    ['Customers & Online', [['enquiries', 'Enquiries'], ['replies', 'Reply Drafts'], ['layla', 'Layla (WhatsApp)'], ['content', 'Content'], ['webcat', 'Website Catalogue'], ['website', 'Website'], ['tilegallery', 'Tile Gallery'], ['competitors', 'Competitors']]],
    ['Vendors', [['vendorsum', 'Vendors overview'], ['vendor360', 'Vendor 360'], ['vendors', 'Pay vendors'], ['grn', 'GRN']]],
    ['Stock', [['stock', 'Stock'], ['barcode', 'Barcode'], ['prices', 'Item catalog and prices'], ['stickers', 'Stickers']]],
    ['Banking & Money', [['cheques', 'Cheques'], ['expenses', 'Expenses'], ['loans', 'Friend & Investor Loans'], ['moneycontrol', 'Money Control'], ['salary', 'Salary & Costs'], ['bank-accounts', 'Bank accounts', true]]],
    ['Profit', [['profit:daily', 'Daily profit'], ['profit:weekly', 'Weekly profit'], ['profit:monthly', 'Monthly profit'], ['profit:yearly', 'Yearly profit'], ['profit:item', 'Profit by item'], ['profit:category', 'Profit by category']]],
    ['Reports', [['reports', 'Reports'], ['reportshub', 'Download reports']]]
  ];
  var HOME = ['dashboard', 'Home'];

  function allKeys() { var o = [HOME[0]]; MAP.forEach(function (g) { g[1].forEach(function (i) { o.push(i[0]); }); }); return o; }

  function start(win) {
    var doc = win.document;
    if (doc.getElementById('rbh-menubar')) return;
    var nav = function (k) { return doc.querySelector('.sidebar-nav [data-page="' + k + '"]'); };
    var exists = function (k) { return k.indexOf('profit:') === 0 ? !!doc.getElementById('page-profit') || typeof win.addFramePage === 'function' : (!!nav(k) || !!doc.getElementById('page-' + k)); };
    var labelOf = function (k, fallback) { var n = nav(k); var l = n && n.querySelector('.nav-label'); return (l && l.textContent.trim()) || fallback; };
    function go(k) {
      closeAll(); closeDrawer();
      if (k.indexOf('profit:') === 0) { ensureProfit(); try { win.navigate('profit'); } catch (e) {} setTimeout(function () { var f = doc.getElementById('frame-profit'); try { f && f.contentWindow.postMessage({ type: 'profit-tab', tab: k.split(':')[1] }, win.location.origin); } catch (e) {} }, 250); return; }
      try { win.navigate(k); } catch (e) {}
    }
    function ensureProfit() {
      if (doc.getElementById('page-profit') || typeof win.addFramePage !== 'function') return;
      try { win.addFramePage({ key: 'profit', label: 'Profit', icon: '<svg class="bh-icon" aria-hidden="true"><use href="#i-trend"/></svg>', url: '/profit.html', sub: 'Gross and net profit: day, week, month, year, item, category', after: 'dashboard' }); } catch (e) {}
    }
    var css = doc.createElement('style');
    css.textContent = '#rbh-menubar{display:none;background:var(--bg-surface,#fff);border-bottom:1px solid var(--border-subtle,#ddd);padding:0 12px;position:sticky;top:60px;z-index:49;gap:2px;align-items:center;flex-wrap:wrap}' +
      '@media(min-width:768px){#rbh-menubar{display:flex}}' +
      '#rbh-menubar .mb-top{position:relative}#rbh-menubar button.mb-btn{background:transparent;color:inherit;border:0;font:inherit;font-size:14px;font-weight:600;min-height:44px;padding:0 12px;cursor:pointer;border-radius:8px}' +
      '#rbh-menubar button.mb-btn:hover,#rbh-menubar button.mb-btn[aria-expanded=true]{background:var(--gold-bg-subtle,rgba(201,162,75,.15))}' +
      '#rbh-menubar button:focus-visible,#rbh-drawer button:focus-visible{outline:3px solid var(--gold-primary,#C9A24B);outline-offset:1px}' +
      '#rbh-menubar .mb-list{display:none;position:absolute;left:0;top:100%;min-width:230px;background:var(--bg-surface,#fff);color:var(--text-primary,#111);border:1px solid var(--border-subtle,#ddd);border-radius:10px;box-shadow:0 12px 30px rgba(0,0,0,.25);padding:6px;z-index:60}' +
      '#rbh-menubar .mb-top.on .mb-list{display:block}' +
      '.mb-item{display:flex;justify-content:space-between;align-items:center;width:100%;text-align:left;background:transparent;color:inherit;border:0;font:inherit;font-size:14px;min-height:40px;padding:0 10px;border-radius:8px;cursor:pointer}' +
      '.mb-item:hover{background:var(--gold-bg-subtle,rgba(201,162,75,.15))}.mb-item[disabled]{opacity:.5;cursor:default}.mb-item small{opacity:.7;font-size:11px}' +
      '#rbh-drawer{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:9996;display:none}#rbh-drawer.on{display:block}' +
      '#rbh-drawer .dr{position:absolute;left:0;right:0;bottom:0;max-height:88dvh;overflow:auto;background:var(--bg-surface,#fff);color:var(--text-primary,#111);border-radius:16px 16px 0 0;padding:8px 10px calc(16px + env(safe-area-inset-bottom))}' +
      '#rbh-drawer .dh{display:flex;justify-content:space-between;align-items:center;padding:8px 6px;font-weight:800;font-size:16px}' +
      '#rbh-drawer .g>button.gh{display:flex;justify-content:space-between;width:100%;min-height:48px;background:transparent;color:inherit;border:0;border-bottom:1px solid var(--border-subtle,#ddd);font:inherit;font-size:15px;font-weight:700;padding:0 6px;cursor:pointer}' +
      '#rbh-drawer .g.on>button.gh:after{content:"\\25BE"}#rbh-drawer .g>button.gh:after{content:"\\25B8"}' +
      '#rbh-drawer .gl{display:none}#rbh-drawer .g.on .gl{display:block}#rbh-drawer .mb-item{min-height:48px;padding-left:18px}';
    doc.head.appendChild(css);

    var bar = doc.createElement('nav'); bar.id = 'rbh-menubar'; bar.setAttribute('role', 'menubar'); bar.setAttribute('aria-label', 'Main menu');
    var drawer = doc.createElement('div'); drawer.id = 'rbh-drawer'; drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', 'Menu');
    drawer.innerHTML = '<div class="dr"><div class="dh"><span>Menu</span><button type="button" class="mb-item" id="rbh-dclose" style="width:auto" aria-label="Close menu">Close</button></div><div id="rbh-dbody"></div></div>';
    var topbar = doc.querySelector('header.topbar');
    if (!topbar || !topbar.parentNode) return;
    topbar.parentNode.insertBefore(bar, topbar.nextSibling); doc.body.appendChild(drawer);

    function itemBtn(k, label, soon) {
      var b = doc.createElement('button'); b.type = 'button'; b.className = 'mb-item'; b.setAttribute('role', 'menuitem'); b.dataset.k = k;
      var ok = !soon && exists(k);
      b.innerHTML = '<span></span>' + (ok ? '' : '<small>coming soon</small>'); b.firstChild.textContent = label;
      if (!ok) b.disabled = true; else b.onclick = function () { go(k); };
      return b;
    }
    function visible(g) { return g[1].filter(function (i) { return i[2] || i[0].indexOf('profit:') === 0 || exists(i[0]); }); }
    function build() {
      bar.innerHTML = '';
      var home = doc.createElement('button'); home.type = 'button'; home.className = 'mb-btn'; home.textContent = HOME[1]; home.onclick = function () { go('dashboard'); }; bar.appendChild(home);
      MAP.forEach(function (g) {
        var items = visible(g); if (!items.length) return;
        var top = doc.createElement('div'); top.className = 'mb-top';
        var b = doc.createElement('button'); b.type = 'button'; b.className = 'mb-btn'; b.setAttribute('role', 'menuitem'); b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false'); b.textContent = g[0] + ' ▾';
        var list = doc.createElement('div'); list.className = 'mb-list'; list.setAttribute('role', 'menu');
        items.forEach(function (i) { list.appendChild(itemBtn(i[0], labelOf(i[0], i[1]), i[2])); });
        b.onclick = function (e) { e.stopPropagation(); var on = top.classList.contains('on'); closeAll(); if (!on) { top.classList.add('on'); b.setAttribute('aria-expanded', 'true'); } };
        top.appendChild(b); top.appendChild(list); bar.appendChild(top);
      });
      var body = doc.getElementById('rbh-dbody'); body.innerHTML = '';
      var h = itemBtn('dashboard', HOME[1], false); h.style.paddingLeft = '6px'; h.style.fontWeight = '700'; body.appendChild(h);
      MAP.forEach(function (g, gi) {
        var items = visible(g); if (!items.length) return;
        var w = doc.createElement('div'); w.className = 'g';
        var gh = doc.createElement('button'); gh.type = 'button'; gh.className = 'gh'; gh.textContent = g[0]; gh.setAttribute('aria-expanded', 'false');
        var gl = doc.createElement('div'); gl.className = 'gl';
        items.forEach(function (i) { gl.appendChild(itemBtn(i[0], labelOf(i[0], i[1]), i[2])); });
        gh.onclick = function () { var on = w.classList.contains('on'); Array.prototype.forEach.call(body.querySelectorAll('.g.on'), function (x) { x.classList.remove('on'); x.firstChild.setAttribute('aria-expanded', 'false'); }); if (!on) { w.classList.add('on'); gh.setAttribute('aria-expanded', 'true'); } };
        w.appendChild(gh); w.appendChild(gl); body.appendChild(w);
      });
    }
    function closeAll() { Array.prototype.forEach.call(bar.querySelectorAll('.mb-top.on'), function (t) { t.classList.remove('on'); t.firstChild.setAttribute('aria-expanded', 'false'); }); }
    function closeDrawer() { drawer.classList.remove('on'); }
    function openDrawer() { build(); drawer.classList.add('on'); var f = drawer.querySelector('.gh'); if (f) f.focus(); }
    doc.addEventListener('click', function (e) { if (!bar.contains(e.target)) closeAll(); });
    doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeAll(); closeDrawer(); } });
    drawer.addEventListener('mousedown', function (e) { if (e.target === drawer) closeDrawer(); });
    doc.getElementById('rbh-dclose').onclick = closeDrawer;
    // the phone "More" button opens this list instead of the old long side menu
    doc.addEventListener('click', function (e) {
      var m = e.target.closest && e.target.closest('#bottom-nav [data-go="__more"]');
      if (m && win.matchMedia && win.matchMedia('(max-width:767px)').matches) { e.preventDefault(); e.stopImmediatePropagation(); openDrawer(); }
    }, true);
    ensureProfit(); build();
    [800, 2500, 5000].forEach(function (ms) { setTimeout(function () { ensureProfit(); build(); }, ms); });   // owner screens are added a moment after the page loads
  }
  return { MAP: MAP, HOME: HOME, allKeys: allKeys, start: start };
});
