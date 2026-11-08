/* ROYAL BATH HUB click effects (public/ui/fx.js): press ripple, sliding gold pill, page-in. Plain JS, no libraries, gold only. */
(function (w, d) {
  'use strict';
  var RIPPLE = '.btn,.ni,.bar button,.card.click,tr.click,.pal .li';
  d.addEventListener('pointerdown', function (e) {
    if (d.documentElement.classList.contains('lite')) return;
    var el = e.target.closest && e.target.closest(RIPPLE); if (!el) return;
    var r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2, x = d.createElement('span');
    x.className = 'fxr'; x.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(x); x.addEventListener('animationend', function () { x.remove(); });
  }, { passive: true });
  /* sliding pill: follows the .on item inside a container */
  w.RBH = w.RBH || {};
  w.RBH.pill = function (box, pill, sel) {
    if (!box || !pill) return;
    function place() {
      var it = box.querySelector(sel || '.on'); if (!it) { pill.classList.remove('on'); return; }
      var a = it.getBoundingClientRect(), p = pill.parentElement.getBoundingClientRect();
      pill.style.width = a.width + 'px'; pill.style.height = a.height + 'px';
      pill.style.transform = 'translate(' + (a.left - p.left) + 'px,' + (a.top - p.top) + 'px)'; pill.classList.add('on');
    }
    try { new MutationObserver(place).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] }); } catch (e) {}
    w.addEventListener('resize', place); box.addEventListener('scroll', place, { passive: true }); setTimeout(place, 60); setTimeout(place, 400);
  };
  /* page-in when a screen loads in the frame */
  w.RBH.enter = function (f) { if (!f) return; f.addEventListener('load', function () { f.classList.remove('enter'); void f.offsetWidth; f.classList.add('enter'); }); f.addEventListener('animationend', function () { f.classList.remove('enter'); }); };
})(window, document);
