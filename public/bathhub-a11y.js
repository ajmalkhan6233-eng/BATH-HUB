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