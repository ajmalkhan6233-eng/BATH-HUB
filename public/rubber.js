/* RUBBER BAND (Ajmal 5 Nov 2026): the iPhone "squeeze and spring back" when you scroll past the end of a window (or when there is nothing to scroll).
   Loaded in the shell and in every screen frame. Mouse wheel + touch. Off: localStorage bh_motion=off. Touches only a transform, never layout. */
(function () {
  if (window.__bhRubber) return; window.__bhRubber = 1;
  var doc = document, MAX = 80, st = null, timer = null, ty = null;
  function off() { try { return localStorage.getItem('bh_motion') === 'off'; } catch (e) { return false; } }
  function scrollerAt(el) { var cs; for (; el && el.nodeType === 1 && el !== doc.body && el !== doc.documentElement; el = el.parentElement) { cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1) return el; } return null; }
  function canMove(el, dy) { return dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1; }
  function rootEl() { return doc.querySelector('.page.active') || doc.querySelector('main') || doc.body; }
  function pick(e, dy) {
    var el = e.target, s;
    while ((s = scrollerAt(el))) { if (canMove(s, dy)) return null; el = s.parentElement; if (!el) break; if (s.closest('.modal.on .box')) return s; }   // inner box at its end: bounce that box
    var se = doc.scrollingElement; if (se && se.scrollHeight > se.clientHeight + 1 && canMove(se, dy)) return null;
    return s || rootEl();
  }
  function apply(t, o, dy) {
    t.style.transition = 'none'; t.style.transformOrigin = o > 0 ? 'center top' : 'center bottom';
    t.style.transform = 'translateY(' + o + 'px) scaleY(' + (1 - Math.abs(o) / 900) + ')';
  }
  function release() {
    if (!st) return; var t = st.t; st = null;
    t.style.transition = 'transform .6s cubic-bezier(.2,1.5,.35,1)'; t.style.transform = 'translateY(0) scaleY(1)';
    setTimeout(function () { if (!st || st.t !== t) { t.style.transition = ''; t.style.transform = ''; t.style.transformOrigin = ''; } }, 650);
  }
  function pull(e, dy) {
    if (off() || !dy) return;
    var t = (st && st.t) || pick(e, dy); if (!t) { if (st) release(); return; }
    if (!st || st.t !== t) { if (st) release(); st = { t: t, edge: dy < 0 ? 1 : -1, mag: 0 }; }   // edge 1 = past the top (content moves down), -1 = past the bottom
    var grow = st.edge === 1 ? -dy : dy;   // pulling further grows the stretch, moving back shrinks it
    st.mag = Math.max(0, Math.min(MAX, st.mag + grow * 0.45 * Math.max(0.05, 1 - st.mag / MAX)));
    if (st.mag <= 0.5) { release(); return; }
    apply(t, st.edge * st.mag); clearTimeout(timer); timer = setTimeout(release, 120);
  }
  doc.addEventListener('wheel', function (e) { if (e.ctrlKey) return; pull(e, Math.max(-60, Math.min(60, e.deltaY))); }, { passive: true });
  doc.addEventListener('touchstart', function (e) { ty = e.touches && e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
  doc.addEventListener('touchmove', function (e) { if (ty == null || !e.touches[0]) return; var y = e.touches[0].clientY, dy = ty - y; ty = y; pull(e, dy); }, { passive: true });
  doc.addEventListener('touchend', function () { ty = null; clearTimeout(timer); release(); }, { passive: true });
  try { var s = doc.createElement('style'); s.textContent = 'html,body{overscroll-behavior:none}'; (doc.head || doc.documentElement).appendChild(s); } catch (e) { /* ignore */ }
})();
