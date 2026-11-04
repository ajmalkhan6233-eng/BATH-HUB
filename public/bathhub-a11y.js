/* bathhub-a11y.js: gives every field and icon-only button an accessible name (from its nearby label, placeholder, title or icon).
   Display/accessibility only: it never changes values, ids, handlers or data. */
(function () {
  function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim().slice(0, 80); }
  function human(s) { return clean(String(s || '').replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2')); }
  function nameField(el) {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.title) return;
    if (el.id && document.querySelector('label[for="' + el.id.replace(/"/g, '') + '"]')) return;
    if (el.closest('label')) return;
    var ph = el.getAttribute('placeholder'); if (ph) { el.setAttribute('aria-label', clean(ph)); return; }
    var prev = el.previousElementSibling, txt = '';
    while (prev && !txt) { if (/^(LABEL|SPAN|DIV|B|STRONG|P|H\d)$/.test(prev.tagName) && !prev.querySelector('input,select,textarea')) txt = clean(prev.textContent); prev = prev.previousElementSibling; }
    if (!txt && el.parentElement) { var lab = el.parentElement.querySelector('label'); if (lab && !lab.querySelector('input,select,textarea')) txt = clean(lab.textContent); }
    el.setAttribute('aria-label', txt || human(el.name || el.id || el.type || 'field'));
  }
  function nameButton(el) {
    if (el.textContent.trim() || el.getAttribute('aria-label') || el.title || el.querySelector('img[alt]')) return;
    var use = el.querySelector('use'); var n = use ? (use.getAttribute('href') || '').replace('#i-', '') : '';
    el.setAttribute('aria-label', human(n || el.id || el.className || 'button'));
  }
  function run(root) {
    (root || document).querySelectorAll('input:not([type=hidden]),select,textarea').forEach(nameField);
    (root || document).querySelectorAll('button,[role=button],a[href]').forEach(nameButton);
  }
  function start() { run(); if (window.MutationObserver) { var t; new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 150); }).observe(document.body, { childList: true, subtree: true }); } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
/* INPUT HELP (Ajmal 2026-11-04), shared by every page that loads this file:
   1. A box that holds only a hint in brackets, like "(no number on slip)", is cleared the moment you click or tab into it.
   2. A number box that shows 0 is selected on click, so what you type replaces it.
   3. Inside any element marked data-enter-next, Enter jumps to the next box (like Tab). Last box: nothing happens. */
(function () {
  if (window.__rbhInputHelp) return; window.__rbhInputHelp = true;
  var HINT = /^\s*[\(\[][^\)\]]{1,60}[\)\]]\s*$/;
  document.addEventListener('focusin', function (e) {
    var t = e.target; if (!t || t.tagName !== 'INPUT' || t.readOnly || t.disabled) return;
    var ty = (t.type || 'text').toLowerCase();
    if ((ty === 'text' || ty === 'search') && HINT.test(t.value)) { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); return; }
    if (ty === 'number' && /^0(\.0+)?$/.test(t.value)) { try { t.select(); } catch (x) {} }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
    var t = e.target; if (!t || t.tagName !== 'INPUT' || !t.closest || !t.closest('[data-enter-next]')) return;
    var box = t.closest('[data-enter-next]'), all = [].slice.call(box.querySelectorAll('input:not([type=hidden]):not([disabled]):not([readonly]),select,textarea')).filter(function (x) { return x.offsetParent; });
    var i = all.indexOf(t); if (i < 0 || i === all.length - 1) return;
    e.preventDefault(); if (typeof t.onchange === 'function') try { t.onchange(); } catch (x) {}
    var n = all[i + 1]; n.focus(); try { n.select(); } catch (x) {}
  });
})();
