/* public/suggest.js: a drop-down list under a text box. Plain browser code, no libraries.
 *   Suggest.attach(input, { load: async () => [rows], text: row => 'name', sub: row => 'phone', match: row => 'text to search', onPick: row => {...}, onType: () => {...} })
 * Rules (POS customer bug, Task 30):
 *  - the list opens when the box is tapped, clicked or typed in, and is filtered as you type (name + phone shown, big tap rows)
 *  - ONLY an explicit tap/click on a row picks it. Enter, Next, Tab and leaving the box NEVER pick anything; what was typed stays exactly as typed
 *  - typing after a pick forgets the pick (onType runs), so a new name is a new customer
 *  - autocomplete is switched off on the box, so the phone's own autofill cannot paste an old name
 */
(function (root) {
  'use strict';
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }
  /** rows whose searchable text contains every typed word; empty query = first rows. Pure, tested in node. */
  function filter(rows, query, match, limit) {
    var words = norm(query).split(' ').filter(Boolean), out = [], i, hay, ok, j;
    for (i = 0; i < rows.length && out.length < (limit || 8); i++) {
      hay = norm(match(rows[i])); ok = true;
      for (j = 0; j < words.length; j++) if (hay.indexOf(words[j]) < 0) { ok = false; break; }
      if (ok) out.push(rows[i]);
    }
    return out;
  }
  var current = null;   // only one list is open at any time
  function attach(input, opts) {
    var rows = [], loadedAt = 0, box = null, doc = input.ownerDocument;
    input.setAttribute('autocomplete', 'off'); input.setAttribute('autocorrect', 'off'); input.setAttribute('autocapitalize', 'words'); input.setAttribute('spellcheck', 'false');
    function close() { if (box) { box.remove(); box = null; } }
    function ensureLoaded() {
      if (Date.now() - loadedAt < 60000 && rows.length) return Promise.resolve();
      return Promise.resolve(opts.load()).then(function (r) { rows = Array.isArray(r) ? r : []; loadedAt = Date.now(); }).catch(function () { /* offline: keep what we have */ });
    }
    function show() {
      var list = filter(rows, input.value, opts.match || opts.text);
      if (current && current !== close) current();
      close(); current = close;
      if (!list.length) return;
      box = doc.createElement('div'); box.className = 'suggest-box'; box.setAttribute('role', 'listbox');
      box.style.cssText = 'position:absolute;z-index:50;background:#fff;color:#111;border:1px solid #bbb;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.2);max-height:260px;overflow-y:auto;-webkit-overflow-scrolling:touch';
      list.forEach(function (row) {
        var b = doc.createElement('div'); b.className = 'suggest-row'; b.setAttribute('role', 'option');
        b.style.cssText = 'padding:12px 14px;min-height:44px;box-sizing:border-box;border-bottom:1px solid #eee;cursor:pointer;display:flex;justify-content:space-between;gap:10px';
        var a = doc.createElement('span'); a.textContent = opts.text(row); var s = doc.createElement('span'); s.textContent = opts.sub ? opts.sub(row) : ''; s.style.opacity = '.65';
        b.appendChild(a); b.appendChild(s);
        // pointerdown + preventDefault keeps the box focused; the pick happens on the tap itself
        b.addEventListener('mousedown', function (e) { e.preventDefault(); });
        b.addEventListener('click', function (e) { e.preventDefault(); close(); opts.onPick(row); });
        box.appendChild(b);
      });
      var r = input.getBoundingClientRect(), sy = root.scrollY || 0, sx = root.scrollX || 0;
      box.style.left = (r.left + sx) + 'px'; box.style.top = (r.bottom + sy + 2) + 'px'; box.style.width = r.width + 'px';
      doc.body.appendChild(box);
    }
    function open() { ensureLoaded().then(show); }
    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('input', function () { if (opts.onType) opts.onType(); open(); });
    // Enter / Tab / leaving: just close. NEVER pick, never change the typed text.
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Escape') close(); });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    return { close: close, refresh: function () { loadedAt = 0; } };
  }
  root.Suggest = { attach: attach, filter: filter };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Suggest;
})(typeof window !== 'undefined' ? window : globalThis);
