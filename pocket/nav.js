/* RBH Pocket navigation module (isolated). Touches no shop data and none of app.js's logic: it only watches the page.
   Adds: back button/swipe-back closes the sheet then returns to Home, swipe-down closes the sheet, each tab remembers its scroll spot, loading skeleton. */
(function () {
  if (typeof document === 'undefined') return;
  var $ = function (id) { return document.getElementById(id); };
  var scrollAt = {}, pushed = 0, cur = function () { var b = document.querySelector('#tabs [aria-current="page"]'); return b ? b.getAttribute('aria-label') : 'Home'; };
  var tabBtn = function (name) { var all = document.querySelectorAll('#tabs .tab'); for (var i = 0; i < all.length; i++) if (all[i].getAttribute('aria-label') === name) return all[i]; return null; };

  // 1) tabs: remember scroll per tab, and let Back return to Home
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('#tabs .tab'); if (!b) return;
    var from = cur(), to = b.getAttribute('aria-label'); if (from === to) return;
    scrollAt[from] = window.pageYOffset;
    if (to !== 'Home' && !pushed) { try { history.pushState({ rbh: 1 }, ''); pushed = 1; } catch (x) {} }
    var y = scrollAt[to] || 0;
    if (y) requestAnimationFrame(function () { requestAnimationFrame(function () { window.scrollTo(0, y); }); });
  }, true);

  // 2) sheet: Back closes it first (one history step per open sheet)
  var sheet = $('sheet'), sheetPushed = false;
  if (sheet && window.MutationObserver) {
    new MutationObserver(function () {
      if (!sheet.hidden && !sheetPushed) { try { history.pushState({ rbh: 2 }, ''); sheetPushed = true; } catch (x) {} }
      if (sheet.hidden && sheetPushed) { sheetPushed = false; if (history.state && history.state.rbh === 2) { try { history.back(); } catch (x) {} } }
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  }
  window.addEventListener('popstate', function () {
    if (sheet && !sheet.hidden) { sheetPushed = false; $('sheetX').click(); return; }
    if (cur() !== 'Home') { pushed = 0; var h = tabBtn('Home'); if (h) h.click(); }
    else pushed = 0;
  });

  // 3) sheet: grab handle + swipe down to close (finger follows, then snaps)
  var panel = sheet && sheet.querySelector('.panel');
  if (panel) {
    var g = document.createElement('div'); g.className = 'grab'; g.setAttribute('aria-hidden', 'true'); panel.insertBefore(g, panel.firstChild);
    var y0 = null, dy = 0;
    panel.addEventListener('touchstart', function (e) { if (panel.scrollTop <= 0) { y0 = e.touches[0].clientY; dy = 0; panel.style.transition = 'none'; } else y0 = null; }, { passive: true });
    panel.addEventListener('touchmove', function (e) { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); panel.style.transform = 'translateY(' + dy + 'px)'; }, { passive: true });
    panel.addEventListener('touchend', function () {
      if (y0 == null) return; panel.style.transition = ''; var far = dy > 90; y0 = null; panel.style.transform = '';
      if (far) $('sheetX').click();
    });
  }

  // 4) loading skeleton while the cards are empty
  var cards = $('cards'), app = $('app');
  if (cards && window.MutationObserver) {
    new MutationObserver(function () {
      if (cards.childNodes.length === 0 && app && !app.hidden) {
        for (var i = 0; i < 3; i++) { var s = document.createElement('div'); s.className = 'card sk'; s.setAttribute('aria-hidden', 'true'); cards.appendChild(s); }
      } else if (cards.querySelector('.sk') && cards.querySelector(':scope > :not(.sk)')) {
        cards.querySelectorAll('.sk').forEach(function (n) { n.remove(); });
      }
    }).observe(cards, { childList: true });
  }
})();
