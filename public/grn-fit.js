/* BLOCK: grn-fit. Sizes the GRN lines box so it fills the free height of the screen (works at any Windows scaling or browser zoom).
   Pure layout: reads sizes, sets one height. Re-runs when the card redraws or the window changes. 11 Nov 2026 */
(function () {
  'use strict';
  function fit() {
    if (window.innerWidth < 900) return;
    var r = document.getElementById('right'); if (!r) return;
    var box = r.querySelector(':scope > .scroll.lines:not(.fullpage)'); if (!box) return;
    box.style.height = '150px';                                   // measure everything else with a small box
    var other = r.scrollHeight - box.offsetHeight;                // top rows + bottom rows
    var h = Math.max(150, r.clientHeight - other - 6);
    box.style.setProperty('height', h + 'px', 'important');
  }
  var t = null; function soon() { clearTimeout(t); t = setTimeout(fit, 60); }
  window.addEventListener('resize', soon);
  function start() {
    var r = document.getElementById('right'); if (!r) return setTimeout(start, 300);
    new MutationObserver(soon).observe(r, { childList: true, subtree: false });
    soon();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
