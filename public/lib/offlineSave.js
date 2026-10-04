/*! Bath Hub offline save. One save button pattern for every page: saves on the device first, syncs when the internet is back.
 *  Browser: OfflineSave.post(url, body) / OfflineSave.bindForm(form, url) / OfflineSave.badge(element).  Node tests use createOutbox().
 *  Rules: every save gets a unique Idempotency-Key (the server ignores repeats); 4xx answers are final (not retried); network errors and 5xx are retried with backoff. */
(function (root) {
  'use strict';
  const uuid = () => (root.crypto && root.crypto.randomUUID ? root.crypto.randomUUID() : 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10)).replace(/[^A-Za-z0-9_-]/g, '');
  function createOutbox({ storage, fetchFn, now = () => Date.now(), makeKey = uuid, onChange = () => {} }) {
    let flushing = false; let authBlocked = false;
    const notify = async () => onChange(await status());
    async function status() { const all = await storage.all(); return { waiting: all.filter((x) => x.state === 'waiting').length, failed: all.filter((x) => x.state === 'failed').length, needsLogin: authBlocked }; }
    const isAuth = (s) => s === 401 || s === 403;
    const isFinal = (s) => s >= 400 && s < 500 && s !== 408 && s !== 429 && !isAuth(s);
    async function send(item) {
      const r = await fetchFn(item.url, { method: item.method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': item.key }, credentials: 'same-origin', body: JSON.stringify(item.body) });
      let json = null; try { json = await r.json(); } catch (_) {}
      return { status: r.status, ok: r.ok, json };
    }
    /** Try now; if the network fails or the server errors, keep it on the device and report queued:true. */
    async function post(url, body, { method = 'POST', label = '' } = {}) {
      const item = { key: makeKey(), url, method, body, label, created: now(), tries: 0, state: 'waiting', next: 0 };
      try {
        const r = await send(item);
        if (r.ok) { authBlocked = false; return { ok: true, queued: false, response: r.json }; }
        if (isFinal(r.status)) return { ok: false, queued: false, error: (r.json && r.json.error) || `Rejected (${r.status})`, status: r.status };
        if (isAuth(r.status)) authBlocked = true;          // logged out: keep the save on the device, never lose it
      } catch (_) { /* offline: fall through to the queue */ }
      await storage.put(item); await notify();
      return { ok: true, queued: true, key: item.key };
    }
    /** Send everything waiting, oldest first. Stops at the first network failure so order is kept. */
    async function flush() {
      if (flushing) return { sent: 0, skipped: true }; flushing = true; let sent = 0;
      try {
        const items = (await storage.all()).filter((x) => x.state === 'waiting').sort((a, b) => a.created - b.created);
        for (const item of items) {
          if (item.next > now()) continue;
          try {
            const r = await send(item);
            if (r.ok) { await storage.del(item.key); sent++; authBlocked = false; }
            else if (isAuth(r.status)) { authBlocked = true; break; }                // wait until the owner logs in again
            else if (isFinal(r.status)) { item.state = 'failed'; item.error = (r.json && r.json.error) || `Rejected (${r.status})`; await storage.put(item); }
            else { item.tries++; item.next = now() + Math.min(300000, 5000 * 2 ** item.tries); await storage.put(item); break; }
          } catch (_) { item.tries++; item.next = now() + Math.min(300000, 5000 * 2 ** item.tries); await storage.put(item); break; }
        }
      } finally { flushing = false; await notify(); }
      return { sent };
    }
    return { post, flush, status };
  }

  /* ---------- browser wiring (IndexedDB) ---------- */
  function idbStorage() {
    const open = () => new Promise((res, rej) => { const r = indexedDB.open('bathhub-outbox', 1); r.onupgradeneeded = () => r.result.createObjectStore('q', { keyPath: 'key' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const run = (mode, fn) => open().then((db) => new Promise((res, rej) => { const tx = db.transaction('q', mode); const out = fn(tx.objectStore('q')); tx.oncomplete = () => res(out && out.result !== undefined ? out.result : undefined); tx.onerror = () => rej(tx.error); }));
    return { put: (i) => run('readwrite', (s) => s.put(i)), del: (k) => run('readwrite', (s) => s.delete(k)), all: () => open().then((db) => new Promise((res, rej) => { const r = db.transaction('q').objectStore('q').getAll(); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); })) };
  }
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    const badges = []; let last = { waiting: 0, failed: 0 };
    const paint = () => badges.forEach((el) => { const off = !navigator.onLine; el.textContent = last.needsLogin ? 'Log in to the owner app to finish syncing' : last.failed ? `${last.failed} save(s) were rejected: open the page and re-enter` : last.waiting ? `${last.waiting} waiting to sync${off ? ' (offline)' : ''}` : off ? 'Offline: saves stay on this device' : 'All saved'; el.dataset.state = last.needsLogin || last.failed ? 'failed' : last.waiting ? 'waiting' : 'ok'; });
    const box = createOutbox({ storage: idbStorage(), fetchFn: (u, o) => fetch(u, o), onChange: (s) => { last = s; paint(); } });
    const tick = () => box.flush();
    window.addEventListener('online', () => { paint(); tick(); }); window.addEventListener('offline', paint);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
    setInterval(tick, 30000); setTimeout(tick, 1500);
    root.OfflineSave = {
      post: box.post, flush: box.flush, status: box.status,
      badge(el) { badges.push(el); box.status().then((s) => { last = s; paint(); }); },
      /** One line makes any form a safe Save button: OfflineSave.bindForm(form, '/api/x', { onDone(result) }) */
      bindForm(form, url, { onDone = () => {}, transform = (d) => d } = {}) {
        form.addEventListener('submit', async (e) => { e.preventDefault(); const btn = form.querySelector('[type=submit]'); if (btn) btn.disabled = true;
          const d = Object.fromEntries(new FormData(form)); Object.keys(d).forEach((k) => d[k] === '' && delete d[k]);
          const r = await box.post(url, transform(d)); if (btn) btn.disabled = false; if (r.ok) form.reset(); onDone(r); });
      },
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createOutbox };
})(typeof window !== 'undefined' ? window : globalThis);
