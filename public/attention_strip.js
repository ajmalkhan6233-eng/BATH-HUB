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
    box.innerHTML = '<div style="font-weight:800;font-size:14px;letter-spacing:.04em">NEEDS YOUR ATTENTION (tap to see)</div>' + items.map(function (i, n) {
      var red = i.level === 'red', bg = red ? '#b3261e' : '#8a5a00';
      return '<button type="button" data-n="' + n + '" style="display:block;width:100%;text-align:left;border:0;cursor:pointer;color:#fff;background:' + bg + ';border-radius:12px;padding:12px 14px;font-family:inherit;font-size:' + (red ? '18' : '16') + 'px;font-weight:' + (red ? '800' : '700') + '">' + (red ? '🔴 ' : '🟡 ') + esc(i.text) + ' ›</button>';
    }).join('');
    box.onclick = function (e) { var t = e.target.closest('[data-n]'); if (t) open(items[+t.getAttribute('data-n')]); };
  }
  function open(i) {
    var back = document.createElement('div'); back.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center';
    var rows = (i.list || []).map(function (t) { return '<div style="padding:8px 0;border-top:1px solid #ddd">' + esc(t) + '</div>'; }).join('') || '<div>No details to show.</div>';
    back.innerHTML = '<div role="dialog" aria-modal="true" style="background:#fff;color:#111;border-radius:12px;width:min(680px,95vw);max-height:85vh;overflow:auto;padding:14px 16px;font:14px system-ui,sans-serif">' +
      '<button type="button" data-x style="float:right;border:0;background:none;font-size:24px;cursor:pointer;min-width:44px;min-height:44px" aria-label="Close">&times;</button><b style="font-size:16px">' + esc(i.text) + '</b>' +
      ((i.list || []).length === 100 ? '<div>First 100 shown.</div>' : '') + '<div style="margin-top:10px">' + rows + '</div>' +
      (i.go ? '<a href="' + esc(i.go) + '" target="_top" style="display:inline-block;margin-top:12px;padding:10px 16px;border-radius:8px;background:#c9a24b;color:#111;font-weight:700;text-decoration:none">Open the page to fix</a>' : '') + '</div>';
    back.addEventListener('click', function (e) { if (e.target === back || e.target.hasAttribute('data-x')) back.remove(); });
    document.body.appendChild(back);
  }
  function load() {
    if (busy || document.hidden) return; busy = true;
    fetch('/api/attention', { credentials: 'include' }).then(function (r) { return r.ok ? r.json() : { items: [] }; }).then(function (d) { busy = false; draw((d && d.items) || []); }).catch(function () { busy = false; });
  }
  setTimeout(load, 1500); setInterval(load, 120000); document.addEventListener('visibilitychange', load);
})();
