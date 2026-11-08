/* rbh-alerts.js: reminder pop-ups. The reminders AJ tells Layla ("remind me to call Metro at 3 pm") pop up here, on the screen,
   with a soft chime and (if allowed) a desktop notification. Buttons: Done, Snooze 1 hour. Top window only, owner/admin only.
   Reads GET /api/layla-owner/due once a minute (read only). Done / Snooze go through Layla's own commands, so the chat and the pop-up stay in step. */
(function () {
  'use strict';
  if (window !== window.top || window.__rbhAlerts) return; window.__rbhAlerts = 1;
  var shown = {}, host = null;
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function chime() { try { var A = window.AudioContext || window.webkitAudioContext, c = new A(), o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, c.currentTime); g.gain.exponentialRampToValueAtTime(0.15, c.currentTime + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5); o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.55); } catch (e) { /* silent is fine */ } }
  function ensureHost() {
    if (host) return host;
    var st = document.createElement('style');
    st.textContent = '#rbh-alerts{position:fixed;left:14px;bottom:14px;z-index:99995;display:flex;flex-direction:column;gap:10px;max-width:min(380px,calc(100vw - 28px))}' +
      '#rbh-alerts .ra{background:var(--card,#fff);color:var(--text,#222);border:2px solid var(--gold,#b8892b);border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.35);font:600 17px/1.4 "Segoe UI",system-ui,sans-serif}' +
      '#rbh-alerts .ra small{display:block;font-weight:700;color:var(--gold,#b8892b);letter-spacing:.06em;margin-bottom:2px}' +
      '#rbh-alerts .ra div{margin:4px 0 10px;word-wrap:break-word}#rbh-alerts .ra button{font:700 16px "Segoe UI",system-ui,sans-serif;min-height:44px;padding:4px 16px;margin-right:8px;border-radius:10px;border:1px solid var(--gold,#b8892b);background:var(--card,#fff);color:inherit;cursor:pointer}' +
      '#rbh-alerts .ra button.y{background:var(--gold,#b8892b);color:#111}';
    document.head.appendChild(st);
    host = document.createElement('div'); host.id = 'rbh-alerts'; host.setAttribute('role', 'region'); host.setAttribute('aria-live', 'polite'); document.body.appendChild(host);
    return host;
  }
  function say(text) {
    return fetch('/api/layla-owner/message', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'ra' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) }, body: JSON.stringify({ text: text }) }).catch(function () { /* try again next minute */ });
  }
  function card(t) {
    var el = document.createElement('div'); el.className = 'ra';
    el.innerHTML = '<small>REMINDER</small><div>' + esc(t.title) + '</div><button type="button" class="y" data-a="done">Done</button><button type="button" data-a="snooze">Snooze 1 hour</button><button type="button" data-a="later">Close</button>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button'); if (!b) return; var a = b.getAttribute('data-a');
      if (a === 'done') say('done ' + t.id); else if (a === 'snooze') say('snooze ' + t.id + ' 1 hour');
      el.remove();
    });
    ensureHost().appendChild(el);
    try { if (window.Notification && Notification.permission === 'granted') new Notification('Reminder', { body: t.title }); } catch (e) { /* ignore */ }
    chime();
  }
  function poll() {
    fetch('/api/layla-owner/due', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
      if (!d || !d.due) return;
      d.due.forEach(function (t) { if (!shown[t.key]) { shown[t.key] = 1; card(t); } });
    }).catch(function () { /* offline: next minute */ });
  }
  function start() {
    fetch('/api/me', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (me) {
      if (!me || (me.role !== 'admin' && me.role !== 'owner')) return;
      try { if (window.Notification && Notification.permission === 'default') document.addEventListener('click', function ask() { document.removeEventListener('click', ask); try { Notification.requestPermission(); } catch (e) { /* ignore */ } }, { once: true }); } catch (e) { /* ignore */ }
      setTimeout(poll, 4000); setInterval(poll, 60000);
    }).catch(function () { /* no alerts when the account cannot be checked */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
