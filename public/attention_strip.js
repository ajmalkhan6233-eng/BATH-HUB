/* NEEDS ATTENTION strip at the top of the dashboard: big, red first, one tap to the page. Shows nothing when there is nothing to do. */
(function () {
  'use strict';
  var ID = 'rbh-attention', busy = false;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function draw(items) {
    var page = document.getElementById('page-dashboard'); if (!page) return;
    var box = document.getElementById(ID);
    if (!items.length) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = ID; box.setAttribute('role', 'status'); page.insertBefore(box, page.firstChild); }
    box.style.cssText = 'margin:8px 0 12px;display:flex;flex-direction:column;gap:6px';
    box.innerHTML = '<div style="font-weight:800;font-size:14px;letter-spacing:.04em">NEEDS YOUR ATTENTION</div>' + items.map(function (i) {
      var red = i.level === 'red', bg = red ? '#b3261e' : '#8a5a00';
      var tag = i.go ? 'a' : 'div';
      return '<' + tag + (i.go ? ' href="' + esc(i.go) + '" target="_top"' : '') + ' style="display:block;text-decoration:none;color:#fff;background:' + bg + ';border-radius:12px;padding:12px 14px;font-size:' + (red ? '18' : '16') + 'px;font-weight:' + (red ? '800' : '700') + '">' + (red ? '🔴 ' : '🟡 ') + esc(i.text) + '</' + tag + '>';
    }).join('');
  }
  function load() {
    if (busy || document.hidden) return; busy = true;
    fetch('/api/attention', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (d) { busy = false; draw((d && d.items) || []); }).catch(function () { busy = false; });
  }
  setTimeout(load, 1500); setInterval(load, 120000); document.addEventListener('visibilitychange', load);
})();
