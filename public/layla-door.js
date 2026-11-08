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
      // 8 Nov: the floating button is a CHAT with Layla (text, voice, photo, PDF, reminders), not a bare file picker.
      slot.className = 'ld';
      var chatBtn = document.createElement('button'); chatBtn.type = 'button'; chatBtn.setAttribute('data-ld', 'chat'); chatBtn.textContent = 'Chat with Layla'; slot.appendChild(chatBtn);
      var panel = null;
      var closeChat = function () { if (panel) { panel.remove(); panel = null; } };
      chatBtn.addEventListener('click', function () {
        if (panel) { closeChat(); return; }
        panel = document.createElement('div'); panel.id = 'ld-chat';
        panel.style.cssText = 'position:fixed;right:14px;bottom:130px;width:min(440px,calc(100vw - 28px));height:min(640px,calc(100vh - 150px));z-index:9991;border:2px solid var(--gold,#b8892b);border-radius:14px;overflow:hidden;background:#0B1B3A;box-shadow:0 14px 40px rgba(0,0,0,.45);display:flex;flex-direction:column';
        var bar = document.createElement('div'); bar.style.cssText = 'display:flex;justify-content:flex-end;background:#0B1B3A;padding:2px 6px';
        var x = document.createElement('button'); x.type = 'button'; x.textContent = 'Close \u2715'; x.setAttribute('aria-label', 'Close chat'); x.style.cssText = 'background:transparent;border:0;color:#E8CF8A;font:700 15px system-ui;cursor:pointer;padding:6px 10px'; x.addEventListener('click', closeChat);
        var fr = document.createElement('iframe'); fr.src = '/layla-owner.html'; fr.title = 'Chat with Layla'; fr.style.cssText = 'flex:1;border:0;width:100%';
        bar.appendChild(x); panel.appendChild(bar); panel.appendChild(fr); document.body.appendChild(panel);
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChat(); });
      // BLOCK: drag-handle. Hold the little grip bar and move the box anywhere; the place is remembered on this device.
      var gs = document.createElement('style');
      gs.textContent = '#ld-float .ld-grip{height:18px;cursor:grab;touch-action:none;display:flex;align-items:center;justify-content:center;color:var(--text-muted,#888);font-size:14px;line-height:1;letter-spacing:3px;user-select:none}#ld-float .ld-grip:active{cursor:grabbing}';
      document.head.appendChild(gs);
      var grip = document.createElement('div'); grip.className = 'ld-grip'; grip.textContent = '⋯'; grip.title = 'Drag to move this box'; grip.setAttribute('aria-label', 'Drag to move');
      box.insertBefore(grip, box.firstChild);
      var place = function (x, y) {
        var w = box.offsetWidth, h = box.offsetHeight;
        x = Math.max(4, Math.min(window.innerWidth - w - 4, x)); y = Math.max(4, Math.min(window.innerHeight - h - 4, y));
        box.style.setProperty('left', x + 'px', 'important'); box.style.setProperty('top', y + 'px', 'important');
        box.style.setProperty('right', 'auto', 'important'); box.style.setProperty('bottom', 'auto', 'important');
        box.style.setProperty('transform', 'none', 'important');
        return { x: x, y: y };
      };
      try { var saved = JSON.parse(localStorage.getItem('rbh-ld-pos') || 'null'); if (saved && isFinite(saved.x) && isFinite(saved.y)) place(saved.x, saved.y); } catch (e) { /* no saved place */ }
      var dx = 0, dy = 0, drag = false;
      grip.addEventListener('pointerdown', function (e) { var r = box.getBoundingClientRect(); dx = e.clientX - r.left; dy = e.clientY - r.top; drag = true; try { grip.setPointerCapture(e.pointerId); } catch (x) { /* ok */ } e.preventDefault(); });
      grip.addEventListener('pointermove', function (e) { if (drag) place(e.clientX - dx, e.clientY - dy); });
      var stop = function () { if (!drag) return; drag = false; var r = box.getBoundingClientRect(); try { localStorage.setItem('rbh-ld-pos', JSON.stringify({ x: r.left, y: r.top })); } catch (x) { /* private mode */ } };
      grip.addEventListener('pointerup', stop); grip.addEventListener('pointercancel', stop);
      window.addEventListener('resize', function () { var r = box.getBoundingClientRect(); if (box.style.left) place(r.left, r.top); });
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
