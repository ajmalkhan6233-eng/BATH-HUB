/* layla-door.js: ONE door for every paper. [Send to Layla] on any screen.
   A bill, a GRN, a supplier invoice, a cheque, the day's expense paper, a customer note, a PDF, or a voice note: it all goes to the
   Document Inbox through the same route (/api/document-inbox/upload). Layla reads it into a DRAFT; NOTHING is filed until the owner
   checks it in the Document Inbox and presses Confirm.
   Use:  <span data-layla-door></span>   (auto-mounted)   or   LaylaDoor.mount(el, { docType: 'grn', label: 'Send to Layla' })
   Owner / admin only (the route enforces it). No camera lock: the phone offers camera, photos, files and the voice recorder. */
(function () {
  'use strict';
  var MAX = 10 * 1024 * 1024;
  var INBOX_URL = '/bathco_complete.html#/docinbox';
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var css = '.ld{display:inline-flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:14px;margin:6px 0}' +
    '.ld button{font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--gold,#b8892b);background:var(--card,#fff);color:inherit;cursor:pointer;font-weight:600}' +
    '.ld button[disabled]{opacity:.6;cursor:wait}.ld .ld-msg{font-size:12px;opacity:.9;flex-basis:100%}.ld .ld-err{color:#c62828}.ld a{color:inherit;font-weight:600}';
  var styled = false;
  function addCss() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  // What the screen shows for one upload result. Pure, so it can be tested without a browser.
  function describe(res, status, data) {
    if (res === 'offline') return { ok: false, text: 'No connection. Try again when you are online.' };
    if (status === 401 || status === 403) return { ok: false, text: 'Only the owner can send papers to Layla. Log in as the owner.' };
    if (status < 200 || status >= 300) return { ok: false, text: (data && data.error) || 'Could not send it. Try again.' };
    var label = (data && data.type_label) || 'a paper';
    var note = data && data.reader_note ? ' ' + String(data.reader_note).slice(0, 160) : '';
    return { ok: true, id: data && data.id, text: 'Sent to Layla as #' + (data && data.id) + ': read as ' + label + '. Nothing is filed yet.' + note };
  }

  function mount(el, opts) {
    opts = opts || {};
    addCss();
    el.classList.add('ld');
    el.innerHTML = '<button type="button" data-ld="go"><svg class="bh-icon" aria-hidden="true"><use href="#i-inbox"/></svg> ' + esc(opts.label || 'Send to Layla') + '</button>' +
      '<input type="file" hidden accept="image/*,application/pdf,audio/*,.ogg,.opus,.m4a,.mp3,.wav" data-ld="file"><span class="ld-msg" aria-live="polite"></span>';
    var btn = el.querySelector('button'), inp = el.querySelector('input'), msg = el.querySelector('.ld-msg');
    function say(html, bad) { msg.innerHTML = html || ''; msg.className = 'ld-msg' + (bad ? ' ld-err' : ''); }
    btn.addEventListener('click', function () { inp.click(); });
    inp.addEventListener('change', async function () {
      var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      if (f.size > MAX) { say('That file is too large (max 10 MB).', true); return; }
      if (typeof navigator !== 'undefined' && navigator.onLine === false) { var o = describe('offline'); say(esc(o.text), true); return; }
      btn.disabled = true; say('Layla is reading it... this can take up to a minute.');
      try {
        var fd = new FormData(); fd.append('photo', f); fd.append('doc_type', opts.docType || 'auto');
        var r = await fetch('/api/document-inbox/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
        var d = await r.json().catch(function () { return {}; });
        var out = describe('', r.status, d);
        say(esc(out.text) + (out.ok ? ' <a href="' + INBOX_URL + '">Open the Document Inbox</a>' : ''), !out.ok);
        if (out.ok && typeof opts.onDone === 'function') opts.onDone(d);
      } catch (e) { say('Could not send it: ' + esc(e.message), true); }
      btn.disabled = false;
    });
    return el;
  }

  function scan(root) {
    (root || document).querySelectorAll('[data-layla-door]').forEach(function (el) {
      if (!el.__ld) { el.__ld = true; mount(el, { docType: el.getAttribute('data-layla-door') || 'auto' }); }
    });
  }
  // The always-there button: bottom-right on every owner screen, so a paper can be sent from wherever you are.
  // Only the top window (not framed pages) and only for owner/admin (checked with /api/me). A page can opt out with <body data-no-door-float>.
  function floatDoor() {
    if (window.top !== window || document.getElementById('ld-float') || (document.body && document.body.hasAttribute('data-no-door-float'))) return;
    fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
      if (!me || (me.role !== 'admin' && me.role !== 'owner') || document.getElementById('ld-float')) return;
      addCss();
      var st = document.createElement('style');
      st.textContent = '#ld-float{position:fixed;right:14px;bottom:76px;z-index:9990;max-width:min(320px,calc(100vw - 28px));background:var(--card,#fff);color:var(--text,#222);border:1px solid var(--gold,#b8892b);border-radius:14px;box-shadow:0 4px 18px rgba(0,0,0,.28);padding:4px 8px}' +
        '#ld-float .ld{margin:2px 0}#ld-float .ld button{padding:10px 14px;font-size:15px;min-height:44px}';
      document.head.appendChild(st);
      var box = document.createElement('div'); box.id = 'ld-float'; box.setAttribute('role', 'region'); box.setAttribute('aria-label', 'Send a paper to Layla');
      var slot = document.createElement('div'); box.appendChild(slot); document.body.appendChild(box);
      mount(slot, { label: 'Send to Layla' });
    }).catch(function () { /* no button when the account cannot be checked */ });
  }
  var api = { mount: mount, scan: scan, describe: describe, floatDoor: floatDoor };
  if (typeof window !== 'undefined') {
    window.LaylaDoor = api;
    var boot = function () { scan(); floatDoor(); };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
