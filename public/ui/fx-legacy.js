/* ROYAL BATH HUB gold click effect for the OLD screens (public/ui/fx-legacy.js).
   One job: a short gold ripple where a button is tapped. Fixed-position span, so no page layout is touched.
   Plain JS, no libraries. Off for reduced-motion. Remove the one <script> line in a page to remove it there. */
(function (w, d) {
  'use strict';
  if (w.__rbhFxLegacy) return; w.__rbhFxLegacy = 1;
  try { if (w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}
  var st = d.createElement('style');
  st.textContent = '.fxl{position:fixed;border-radius:50%;pointer-events:none;z-index:2147483000;' +
    'background:radial-gradient(circle,rgba(212,175,55,.55),rgba(212,175,55,0) 70%);transform:scale(0);opacity:.9;animation:fxl .5s ease-out forwards}' +
    '@keyframes fxl{to{transform:scale(1);opacity:0}}';
  (d.head || d.documentElement).appendChild(st);
  var SEL = 'button,.btn,a.btn,[role=button],input[type=button],input[type=submit],tr.click';
  d.addEventListener('pointerdown', function (e) {
    var el = e.target && e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled) return;
    var s = 90, x = d.createElement('span');
    x.className = 'fxl';
    x.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - s / 2) + 'px;top:' + (e.clientY - s / 2) + 'px';
    d.body.appendChild(x);
    x.addEventListener('animationend', function () { x.remove(); });
    setTimeout(function () { if (x.parentNode) x.remove(); }, 900);
  }, { passive: true });
})(window, document);
