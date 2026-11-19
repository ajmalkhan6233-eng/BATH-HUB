/* BLOCK: grn-fit (rewritten 13 Nov). ONE layout rule only: keep the GRN card grouped as header / lines / footer so the CSS flex layout
   (grn-onescreen.css) gives the lines every free row. Old fixed-height code removed: it fought the CSS and made two layouts flip on load. */
(function () {
  'use strict';
  var busy = false;
  function ensure() {
    if (busy) return; var r = document.getElementById('right'); if (!r) return;
    var box = null, i, k;
    for (i = 0; i < r.children.length; i++) { k = r.children[i]; if (k.classList.contains('scroll') && k.classList.contains('lines')) { box = k; break; } }
    if (!box) { r.classList.remove('has-lines'); return; }
    busy = true;
    try {
      var hdr = r.querySelector(':scope > .g-hdr'), ftr = r.querySelector(':scope > .g-ftr');
      if (!hdr) { hdr = document.createElement('div'); hdr.className = 'g-hdr'; r.insertBefore(hdr, box); }
      if (!ftr) { ftr = document.createElement('div'); ftr.className = 'g-ftr'; r.appendChild(ftr); }
      var kids = [].slice.call(r.children), seen = false;
      kids.forEach(function (c) {
        if (c === box) { seen = true; return; }
        if (c === hdr || c === ftr) return;
        (seen ? ftr : hdr).appendChild(c);
      });
      if (hdr.nextSibling !== box) r.insertBefore(hdr, box);
      if (ftr.previousSibling !== box) r.insertBefore(ftr, box.nextSibling);
      r.classList.add('has-lines');
      box.style.removeProperty('height');
    } catch (e) {}
    busy = false;
  }
  var t = null; function soon() { clearTimeout(t); t = setTimeout(ensure, 30); }
  window.addEventListener('resize', soon);
  function start() {
    var r = document.getElementById('right'); if (!r) return setTimeout(start, 300);
    new MutationObserver(soon).observe(r, { childList: true });
    ensure();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
