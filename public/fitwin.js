/* FIT IN ONE WINDOW (Ajmal 5 Nov 2026): a pop-up never scrolls; if its content is taller than the window it is scaled down (not below 60 %) until everything is visible.
   Loaded in the shell and in every screen frame. Only the pop-up's inner parts are scaled (zoom), never the page. */
(function () {
  if (window.__bhFit) return; window.__bhFit = 1;
  var doc = document, SEL = '.modal.on .box, .modal-overlay.on .modal-box, .modal-overlay .modal-box, #ibox', busy = false, t = null;
  function fit(box) {
    if (!box || box.offsetParent === null && getComputedStyle(box).position !== 'fixed') return;
    var kids = Array.prototype.slice.call(box.children), z = 1;
    kids.forEach(function (k) { k.style.zoom = ''; });
    box.style.maxHeight = (window.innerHeight - 16) + 'px'; box.style.overflowY = 'auto';
    while (box.scrollHeight > box.clientHeight + 1 && z > 0.6) { z = Math.round((z - 0.04) * 100) / 100; kids.forEach(function (k) { k.style.zoom = z; }); }
    if (box.scrollHeight <= box.clientHeight + 1) box.style.overflowY = 'hidden';
  }
  function run() { if (busy) return; busy = true; try { Array.prototype.forEach.call(doc.querySelectorAll(SEL), fit); } catch (e) { /* never break a screen */ } busy = false; }
  function later() { clearTimeout(t); t = setTimeout(run, 120); }
  try { new MutationObserver(function (m) { if (!busy) later(); }).observe(doc.body || doc.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] }); } catch (e) { /* ignore */ }
  window.addEventListener('resize', later); later();
})();
