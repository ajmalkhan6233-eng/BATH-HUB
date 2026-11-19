/* Search anything (Ctrl+K or Cmd+K, or the Search button): pages, vendors, items. No libraries.
   Pages come from the owner shell's own PAGE_META, vendors from /api/vendor360/list (owner only), items from /api/products (loaded once, on first open). */
(function () {
  'use strict';
  if (window.__palette) return; window.__palette = true;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var css = '#pal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;display:none;align-items:flex-start;justify-content:center;padding:8vh 12px 12px}#pal.on{display:flex}' +
    '#pal .pb{width:min(560px,100%);background:var(--card,#fffdf7);color:var(--text,#0B1B3A);border:1px solid var(--card-border,rgba(0,0,0,.2));border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.4);overflow:hidden}' +
    '#pal input{width:100%;font-size:16px;min-height:52px;border:0;border-bottom:1px solid var(--card-border,rgba(0,0,0,.2));padding:10px 14px;background:transparent;color:inherit;outline:none}' +
    '#pal ul{list-style:none;margin:0;padding:6px;max-height:56vh;overflow:auto}#pal li{min-height:44px;display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 10px;border-radius:10px;cursor:pointer}' +
    '#pal li[aria-selected=true]{background:var(--accent,#C9A24B);color:var(--accent-ink,#0B1B3A)}#pal small{opacity:.75}#pal .pe{padding:16px;text-align:center;opacity:.7}#pal .ph{padding:6px 10px;font-size:12px;opacity:.7}' +
    '#pal-btn{min-height:44px;min-width:44px;border-radius:10px;border:1px solid var(--card-border,rgba(0,0,0,.2));background:transparent;color:inherit;font:inherit;font-size:14px;cursor:pointer;padding:0 10px}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var ov = document.createElement('div'); ov.id = 'pal'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Search');
  ov.innerHTML = '<div class="pb"><input id="pal-q" type="text" placeholder="Search a page, vendor or item" aria-label="Search" autocomplete="off" role="combobox" aria-expanded="true" aria-controls="pal-l"><ul id="pal-l" role="listbox"></ul></div>';
  document.body.appendChild(ov);
  var q = ov.querySelector('#pal-q'), list = ov.querySelector('#pal-l');
  var vendors = null, items = null, results = [], sel = 0, loading = false;

  function pages() {
    var m = (typeof PAGE_META !== 'undefined' && PAGE_META) || {};
    return Object.keys(m).map(function (k) { return { type: 'page', key: k, label: m[k][0], sub: m[k][1] || '' }; });
  }
  function load() {
    if (loading) return; loading = true;
    fetch('/api/vendor360/list', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : { vendors: [] }; }).then(function (j) { vendors = j.vendors || []; if (ov.classList.contains('on')) render(); }).catch(function () { vendors = []; });
    fetch('/api/products', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : []; }).then(function (j) { items = Array.isArray(j) ? j : []; if (ov.classList.contains('on')) render(); }).catch(function () { items = []; });
  }
  var score = function (text, t) { text = String(text || '').toLowerCase(); var i = text.indexOf(t); return i < 0 ? -1 : (i === 0 ? 0 : 1); };
  function search(term) {
    var t = term.trim().toLowerCase(), out = [];
    pages().forEach(function (p) { var s = t ? Math.max(score(p.label, t), score(p.key, t)) : 0; if (!t || s >= 0) out.push({ r: p, s: t ? s : 0 }); });
    var pg = out.sort(function (a, b) { return a.s - b.s; }).slice(0, t ? 6 : 8).map(function (x) { return x.r; });
    var vs = [], is = [];
    if (t) {
      (vendors || []).forEach(function (v) { if (score(v.vendor_name, t) >= 0) vs.push({ type: 'vendor', name: v.vendor_name, owed: v.outstanding_balance }); });
      (items || []).forEach(function (p) { if (is.length < 30 && (score(p.name, t) >= 0 || score(p.item_code, t) >= 0)) is.push({ type: 'item', name: p.name, code: p.item_code, price: p.selling_price, qty: p.stock_level }); });
    }
    return pg.concat(vs.slice(0, 6), is.slice(0, 8));
  }
  function row(r) {
    if (r.type === 'page') return '<span>' + esc(r.label) + '<br><small>' + esc(r.sub) + '</small></span><small>Page</small>';
    if (r.type === 'vendor') return '<span>' + esc(r.name) + '<br><small>We owe Rs. ' + Number(r.owed || 0).toLocaleString('en-LK') + '</small></span><small>Vendor</small>';
    return '<span>' + esc(r.name) + '<br><small>' + esc(r.code || '') + (r.price ? ' · Rs. ' + Number(r.price).toLocaleString('en-LK') : '') + (r.qty != null ? ' · ' + r.qty + ' in stock' : '') + '</small></span><small>Item</small>';
  }
  function render() {
    results = search(q.value); if (sel >= results.length) sel = 0;
    if (!results.length) { list.innerHTML = '<li class="pe" style="cursor:default;justify-content:center">' + ((vendors === null || items === null) && q.value ? 'Searching...' : 'Nothing found') + '</li>'; return; }
    list.innerHTML = results.map(function (r, i) { return '<li role="option" id="pal-o' + i + '" data-i="' + i + '" aria-selected="' + (i === sel) + '">' + row(r) + '</li>'; }).join('');
    q.setAttribute('aria-activedescendant', 'pal-o' + sel);
  }
  function go(r) {
    close(); if (!r) return;
    if (r.type === 'page') return typeof navigate === 'function' && navigate(r.key);
    if (r.type === 'vendor') {
      if (typeof navigate !== 'function') return; navigate('vendor360');
      var fr = document.getElementById('frame-vendor360'); if (!fr) return;
      var send = function () { try { fr.contentWindow.postMessage({ type: 'v360-select', vendor: r.name }, location.origin); } catch (_) {} };
      if (fr.contentDocument && fr.contentDocument.readyState === 'complete' && fr.contentWindow.__v360) send(); else { var n = 0, t = setInterval(function () { if ((fr.contentWindow && fr.contentWindow.__v360) || ++n > 40) { clearInterval(t); send(); } }, 250); }
      return;
    }
    if (typeof navigate === 'function') navigate('prices'); // item: open the Item catalog
  }
  var prev = null;
  function open() { prev = document.activeElement; ov.classList.add('on'); q.value = ''; sel = 0; load(); render(); q.focus(); }
  function close() { ov.classList.remove('on'); if (prev && prev.focus) try { prev.focus(); } catch (_) {} }
  q.addEventListener('input', function () { sel = 0; render(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, results.length - 1); render(); var o = document.getElementById('pal-o' + sel); if (o) o.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); render(); var o2 = document.getElementById('pal-o' + sel); if (o2) o2.scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); go(results[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  list.addEventListener('click', function (e) { var li = e.target.closest('[data-i]'); if (li) go(results[Number(li.getAttribute('data-i'))]); });
  ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
  document.addEventListener('keydown', function (e) { if ((e.ctrlKey || e.metaKey) && String(e.key).toLowerCase() === 'k') { e.preventDefault(); ov.classList.contains('on') ? close() : open(); } });

  // Search button in the top bar (for the phone)
  var slot = document.querySelector('.topbar-right');
  if (slot && !document.getElementById('pal-btn')) {
    var b = document.createElement('button'); b.id = 'pal-btn'; b.type = 'button'; b.title = 'Search (Ctrl+K)'; b.setAttribute('aria-label', 'Search'); b.textContent = 'Search';
    b.addEventListener('click', open); slot.insertBefore(b, slot.firstChild);
  }
  window.RBHPalette = { open: open, close: close };
})();
