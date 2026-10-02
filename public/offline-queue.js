/* public/offline-queue.js
 * OFFLINE WRITE QUEUE (isolated client module). Plain browser APIs, no libraries.
 *   <script src="/offline-queue.js"></script>   then   OfflineQueue.install();   (once per page; wraps window.fetch)
 *
 * What it does: a save (POST) to a business API (bills, expenses, GRN, ...) that cannot reach the server is kept on this device and sent
 * later, in the same order, each exactly once (every write carries a UUID in X-Idempotency-Key; the server remembers it: routes/sync.js).
 *   - NEW records (kind 'create', POST): queued when offline, replayed automatically (online event, start-up, backoff timer 2s,4s,8s .. 60s).
 *   - EDITS / VOIDS (kind 'review', PUT/PATCH and URLs ending /void): queued too, but NEVER applied automatically. Replay sends them to
 *     POST /api/sync/needs-review where the admin decides (server version wins).
 *   - Any real HTTP answer (even 400/500) on the first try is returned as is and is NOT queued. Only network errors / 8 s timeouts /
 *     navigator.onLine === false queue the write and return a synthetic 202 {queued:true, offline:true, client_uuid} (header X-Offline-Queued: 1).
 *   - A 4xx during replay marks the item 'rejected' and keeps it (nothing is ever lost); later items still go.
 *   - Login/system/admin/user URLs are never queued.
 * Storage sits behind an adapter: IndexedDB in the browser ('apex-offline': stores queue, results, meta), in memory for tests.
 * OfflineQueue.create({adapter, fetchImpl, now, deviceId, queueable, isOnline, schedule, cancel, timeoutMs}) builds an independent instance.
 */
(function (root) {
    'use strict';

    var DEFAULT_QUEUEABLE = /^\/api\/(pos-bills|suppliers|credit-customers|customers|quotations|sale-commissions|investor-loans|cheque-register|grn|expenses|attachments|daily-summary|stock-items|items|money-allocations|bank-accounts|enquiries|staff|corrections)/;
    var NEVER_QUEUE = /^\/api\/(login|logout|setup|auth|system|admin-core|app-settings|users|feature-flags)(\/|\?|$)/;
    var BACKOFF_START = 2000, BACKOFF_MAX = 60000, NET_TIMEOUT = 8000;

    function round2(n) { return Math.round((Number(n) + Number.EPSILON) * 100) / 100; }

    function uuid4() {
        try { if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID(); } catch (e) { /* fall through */ }
        var b = new Array(16), i;
        for (i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
        try { if (root.crypto && root.crypto.getRandomValues) { var a = new Uint8Array(16); root.crypto.getRandomValues(a); for (i = 0; i < 16; i++) b[i] = a[i]; } } catch (e2) { /* keep Math.random */ }
        b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
        var h = b.map(function (x) { return (x + 0x100).toString(16).slice(1); }).join('');
        return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
    }

    function newDeviceId() {
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', i;
        for (i = 0; i < 4; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
        return s;
    }
    function storedDeviceId() {
        try {
            var ls = root.localStorage, id = ls && ls.getItem('apex-offline-device');
            if (!id) { id = newDeviceId(); if (ls) ls.setItem('apex-offline-device', id); }
            return id;
        } catch (e) { return newDeviceId(); }
    }

    // ---------------------------------------------------------------- storage adapters
    function memoryAdapter() {
        var q = [], res = {}, meta = {}, seq = 0;
        var clone = function (o) { return Object.assign({}, o); };
        return {
            name: 'memory',
            add: function (item) { item = clone(item); item.seq = ++seq; q.push(item); return Promise.resolve(item.seq); },
            update: function (item) { var i = q.findIndex(function (x) { return x.seq === item.seq; }); if (i >= 0) q[i] = clone(item); return Promise.resolve(); },
            remove: function (s) { q = q.filter(function (x) { return x.seq !== s; }); return Promise.resolve(); },
            all: function () { return Promise.resolve(q.map(clone).sort(function (a, b) { return a.seq - b.seq; })); },
            putResult: function (r) { res[r.uuid] = clone(r); return Promise.resolve(); },
            results: function () { return Promise.resolve(Object.keys(res).map(function (k) { return clone(res[k]); })); },
            getMeta: function (k) { return Promise.resolve(meta[k]); },
            setMeta: function (k, v) { meta[k] = v; return Promise.resolve(); }
        };
    }

    function idbAdapter(dbName) {
        var dbp = null;
        function open() {
            if (dbp) return dbp;
            dbp = new Promise(function (resolve, reject) {
                var req = root.indexedDB.open(dbName || 'apex-offline', 1);
                req.onupgradeneeded = function () {
                    var db = req.result;
                    if (!db.objectStoreNames.contains('queue')) db.createObjectStore('queue', { keyPath: 'seq', autoIncrement: true });
                    if (!db.objectStoreNames.contains('results')) db.createObjectStore('results', { keyPath: 'uuid' });
                    if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'k' });
                };
                req.onsuccess = function () { resolve(req.result); };
                req.onerror = function () { reject(req.error); };
            });
            return dbp;
        }
        function run(store, mode, fn) {
            return open().then(function (db) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(store, mode), out;
                    var r = fn(tx.objectStore(store));
                    if (r) r.onsuccess = function () { out = r.result; };
                    tx.oncomplete = function () { resolve(out); };
                    tx.onerror = tx.onabort = function () { reject(tx.error); };
                });
            });
        }
        return {
            name: 'indexeddb',
            add: function (item) { item = Object.assign({}, item); delete item.seq; return run('queue', 'readwrite', function (s) { return s.add(item); }); },
            update: function (item) { return run('queue', 'readwrite', function (s) { return s.put(item); }); },
            remove: function (seq) { return run('queue', 'readwrite', function (s) { return s.delete(seq); }); },
            all: function () { return run('queue', 'readonly', function (s) { return s.getAll(); }).then(function (a) { return (a || []).sort(function (x, y) { return x.seq - y.seq; }); }); },
            putResult: function (r) { return run('results', 'readwrite', function (s) { return s.put(r); }); },
            results: function () { return run('results', 'readonly', function (s) { return s.getAll(); }).then(function (a) { return a || []; }); },
            getMeta: function (k) { return run('meta', 'readonly', function (s) { return s.get(k); }).then(function (r) { return r ? r.v : undefined; }); },
            setMeta: function (k, v) { return run('meta', 'readwrite', function (s) { return s.put({ k: k, v: v }); }); }
        };
    }

    // ---------------------------------------------------------------- helpers
    function toMatcher(q) {
        if (typeof q === 'function') return q;
        if (q instanceof RegExp) return function (p) { q.lastIndex = 0; return q.test(p); };
        if (Array.isArray(q)) { var ms = q.map(toMatcher); return function (p) { return ms.some(function (m) { return m(p); }); }; }
        return function () { return false; };
    }

    function pathOf(url) {            // '/api/..' for same-origin api URLs, else null
        var s = String(url);
        if (/^https?:\/\//i.test(s)) {
            var o = root.location && root.location.origin;
            if (!o || s.indexOf(o) !== 0) return null;
            s = s.slice(o.length);
        }
        if (s.charAt(0) !== '/' || s.indexOf('/api/') !== 0) return null;
        return s;
    }

    function headersToObject(h) {
        var o = {};
        if (!h) return o;
        if (typeof h.forEach === 'function' && !Array.isArray(h)) { h.forEach(function (v, k) { o[k] = v; }); return o; }
        if (Array.isArray(h)) { h.forEach(function (p) { o[p[0]] = p[1]; }); return o; }
        Object.keys(h).forEach(function (k) { o[k] = h[k]; });
        return o;
    }
    function setHeader(o, name, value) {      // case-insensitive replace
        Object.keys(o).forEach(function (k) { if (k.toLowerCase() === name.toLowerCase()) delete o[k]; });
        o[name] = value;
    }

    function isFormData(b) { return typeof root.FormData !== 'undefined' && b instanceof root.FormData; }
    function serializeBody(b) {
        if (b == null) return { type: 'none' };
        if (typeof b === 'string') return { type: 'text', value: b };
        if (isFormData(b)) {
            var parts = [];
            b.forEach(function (v, k) {
                if (typeof v === 'string') parts.push({ name: k, kind: 'text', value: v });
                else parts.push({ name: k, kind: 'blob', blob: v, filename: v.name || 'file', mime: v.type || '' });
            });
            return { type: 'form', parts: parts };
        }
        if (typeof root.URLSearchParams !== 'undefined' && b instanceof root.URLSearchParams) return { type: 'text', value: b.toString() };
        if (typeof root.Blob !== 'undefined' && b instanceof root.Blob) return { type: 'blob', blob: b };
        return { type: 'text', value: String(b) };
    }
    function rebuildBody(sb) {
        if (!sb || sb.type === 'none') return undefined;
        if (sb.type === 'text') return sb.value;
        if (sb.type === 'blob') return sb.blob;
        var fd = new root.FormData();
        sb.parts.forEach(function (p) {
            if (p.kind === 'text') fd.append(p.name, p.value);
            else fd.append(p.name, p.blob, p.filename);
        });
        return fd;
    }
    function bodyAsText(sb) {         // for needs-review (the admin reads it): text, or a description of a form
        if (!sb || sb.type === 'none') return null;
        if (sb.type === 'text') return sb.value;
        if (sb.type === 'form') return JSON.stringify(sb.parts.map(function (p) { return p.kind === 'text' ? { name: p.name, value: p.value } : { name: p.name, file: p.filename, mime: p.mime }; }));
        return '[binary]';
    }

    function makeResponse(status, obj, headers) {
        var h = Object.assign({ 'Content-Type': 'application/json' }, headers || {});
        if (typeof root.Response === 'function') return new root.Response(JSON.stringify(obj), { status: status, headers: h });
        return { status: status, ok: status >= 200 && status < 300, headers: { get: function (k) { return h[k] || null; } }, json: function () { return Promise.resolve(obj); }, text: function () { return Promise.resolve(JSON.stringify(obj)); }, clone: function () { return this; } };
    }
    function readBody(resp) {
        var c = typeof resp.clone === 'function' ? resp.clone() : resp;
        return c.text().then(function (t) { try { return JSON.parse(t); } catch (e) { return t; } }, function () { return null; });
    }
    function hdr(resp, name) { try { return resp.headers && resp.headers.get ? resp.headers.get(name) : null; } catch (e) { return null; } }

    // ---------------------------------------------------------------- the queue
    function create(options) {
        options = options || {};
        var adapter = options.adapter || memoryAdapter();
        var fetchImpl = options.fetchImpl || (root.fetch ? root.fetch.bind(root) : null);
        var now = options.now || function () { return Date.now(); };
        var deviceId = options.deviceId || storedDeviceId();
        var isQueueable = toMatcher(options.queueable || DEFAULT_QUEUEABLE);
        var isOnline = options.isOnline || function () { return !(typeof navigator !== 'undefined' && navigator.onLine === false); };
        var schedule = options.schedule || function (fn, ms) { return setTimeout(fn, ms); };
        var cancel = options.cancel || function (h) { clearTimeout(h); };
        var timeoutMs = options.timeoutMs || NET_TIMEOUT;

        var listeners = [];
        var cache = [];               // copy of the queue for the sync status()
        var locked = false, timer = null, failures = 0, lastError = null, serverNeedsReview = null, nextDelay = null;
        var chain = Promise.resolve();                       // serialises writes to the storage so order and counters never race
        var inflight = 0;

        function inQueue(fn) { var p = chain.then(fn); chain = p.catch(function () { /* keep the chain alive */ }); return p; }

        function refresh() {
            return adapter.all().then(function (a) { cache = a; emit(); return a; });
        }
        function status() {
            var waiting = 0, rejected = 0;
            cache.forEach(function (i) { if (i.state === 'rejected') rejected++; else waiting++; });
            var st;
            if (!isOnline()) st = 'offline';
            else if (locked) st = 'syncing';
            else if (rejected > 0 || (lastError && !/^Network/i.test(String(lastError)))) st = 'error';
            else if (lastError) st = 'offline';        // the laptop cannot be reached: that is OFFLINE (saved on this device), not an error
            else if (waiting > 0) st = 'syncing';
            else st = 'online';
            return { state: st, waiting: waiting, rejected: rejected, needsReview: serverNeedsReview, lastError: lastError, nextRetryMs: nextDelay };
        }
        function emit() {
            var s = status();
            listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) { /* a bad listener must not break the queue */ } });
        }
        function on(evt, fn) {
            if (evt !== 'status' || typeof fn !== 'function') return function () {};
            listeners.push(fn);
            return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
        }

        // Back-off timer: 2s, 4s, 8s .. 60s
        function backoffMs(n) { return Math.min(BACKOFF_MAX, BACKOFF_START * Math.pow(2, Math.max(0, n - 1))); }
        function scheduleRetry() {
            if (timer) cancel(timer);
            nextDelay = backoffMs(failures);
            timer = schedule(function () { timer = null; nextDelay = null; replay(); }, nextDelay);
        }

        // ---- enqueue
        function posBillBody(item, n) {
            var data = {};
            try { data = JSON.parse(item.body.value || '{}'); } catch (e) { data = {}; }
            var lines = (Array.isArray(data.items) ? data.items : []).map(function (it) {
                var qty = round2(it.qty), price = round2(it.unit_price);
                return Object.assign({}, it, { qty: qty, unit_price: price, line_total: round2(qty * price) });
            });
            var subtotal = round2(lines.reduce(function (s, l) { return s + l.line_total; }, 0));
            var pct = Number(data.discount_pct) || 0;
            var disc = round2(subtotal * pct / 100);
            return {
                id: 'off-' + n, bill_number: 'OFF-' + deviceId + '-' + n, temp: true, queued: true,
                customer_name: data.customer_name || null, customer_phone: data.customer_phone || null,
                items: lines, subtotal: subtotal, discount_pct: pct, discount_amount: disc, total: round2(subtotal - disc),
                payment_method: data.payment_method || 'cash', created_at: new Date(now()).toISOString()
            };
        }

        function enqueue(req) {
            // req: {method, url, headers, body (raw), uuid, kind}
            return inQueue(function () {
                var item = {
                    uuid: req.uuid || uuid4(), method: req.method, url: req.url, headers: req.headers || {},
                    body: serializeBody(req.body), createdAt: new Date(now()).toISOString(),
                    kind: req.kind || 'create', state: 'waiting', attempts: 0, error: null
                };
                var isBill = item.kind === 'create' && item.method === 'POST' && /^\/api\/pos-bills(\?|$)/.test(item.url) && item.body.type === 'text';
                var pre = isBill ? adapter.getMeta('billCounter').then(function (c) { return (Number(c) || 0) + 1; }) : Promise.resolve(null);
                return pre.then(function (n) {
                    var temp = null;
                    if (isBill) { temp = posBillBody(item, n); item.temp = { id: temp.id, bill_number: temp.bill_number }; }
                    return (isBill ? adapter.setMeta('billCounter', n) : Promise.resolve()).then(function () { return adapter.add(item); }).then(function (seq) {
                        item.seq = seq;
                        return refresh().then(function () {
                            var body = temp || { queued: true, offline: true, client_uuid: item.uuid, kind: item.kind, message: 'Saved on this device. It will be sent when the connection is back.' };
                            if (temp) { temp.client_uuid = item.uuid; temp.offline = true; }
                            return makeResponse(202, body, { 'X-Offline-Queued': '1' });
                        });
                    });
                });
            });
        }

        // ---- the wrapped fetch
        function withTimeout(url, init) {
            return new Promise(function (resolve, reject) {
                var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
                var t = setTimeout(function () { if (ctl) ctl.abort(); reject(new Error('timeout')); }, timeoutMs);
                var o = Object.assign({}, init); if (ctl) o.signal = ctl.signal;
                fetchImpl(url, o).then(function (r) { clearTimeout(t); resolve(r); }, function (e) { clearTimeout(t); reject(e); });
            });
        }

        function wrappedFetch(input, opts) {
            var passthrough = function () { return fetchImpl(input, opts); };
            if (typeof input !== 'string' && !(typeof URL !== 'undefined' && input instanceof URL)) return passthrough();   // Request objects: untouched
            opts = opts || {};
            var url = pathOf(input);
            var method = String(opts.method || 'GET').toUpperCase();
            if (!url || ['POST', 'PUT', 'PATCH'].indexOf(method) < 0 || NEVER_QUEUE.test(url) || !isQueueable(url)) return passthrough();
            var isVoid = /\/void(\?.*)?$/.test(url);
            var kind = (method === 'POST' && !isVoid) ? 'create' : 'review';
            var headers = headersToObject(opts.headers);
            var id = uuid4();
            setHeader(headers, 'X-Idempotency-Key', id);
            setHeader(headers, 'X-Device', deviceId);

            var waiting = cache.some(function (i) { return i.state !== 'rejected'; });
            var queueIt = function () { return enqueue({ method: method, url: url, headers: headers, body: opts.body, uuid: id, kind: kind }); };
            if (waiting || !isOnline()) return queueIt();                    // order: new writes go behind waiting ones

            inflight++;
            return withTimeout(String(input), Object.assign({}, opts, { headers: headers })).then(function (resp) {
                inflight--; return resp;                                     // any real answer is returned as is
            }, function (e) {
                inflight--;                                                  // network error / timeout: keep it and retry with back-off
                return queueIt().then(function (r) {
                    lastError = 'Network: ' + ((e && e.message) || 'failed');
                    if (isOnline() && !locked) { failures = Math.max(failures, 1); scheduleRetry(); }
                    emit();
                    return r;
                });
            });
        }

        // ---- replay
        function send(item) {
            if (item.kind === 'review') {
                return fetchImpl('/api/sync/needs-review', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
                    body: JSON.stringify({ uuid: item.uuid, method: item.method, url: item.url, body: bodyAsText(item.body), queued_at: item.createdAt, device: deviceId })
                });
            }
            var h = Object.assign({}, item.headers);
            setHeader(h, 'X-Idempotency-Key', item.uuid); setHeader(h, 'X-Device', deviceId); setHeader(h, 'X-Client-Queued-At', item.createdAt);
            if (item.body && item.body.type === 'form') Object.keys(h).forEach(function (k) { if (k.toLowerCase() === 'content-type') delete h[k]; });
            return fetchImpl(item.url, { method: item.method, headers: h, body: rebuildBody(item.body), credentials: 'same-origin' });
        }

        function errText(body, resp) {
            if (body && typeof body === 'object' && body.error) return String(body.error);
            if (typeof body === 'string' && body) return body.slice(0, 200);
            return 'HTTP ' + (resp && resp.status);
        }

        function replay() {
            if (locked) return Promise.resolve({ skipped: true });
            locked = true;
            if (timer) { cancel(timer); timer = null; nextDelay = null; }
            var sent = 0, stopped = false;
            return adapter.all().then(function (items) {
                // crash recovery: nothing can legitimately be 'sending' while we hold the lock
                return Promise.all(items.map(function (i) {
                    if (i.state === 'sending') { i.state = 'waiting'; return adapter.update(i); }
                })).then(function () { return items; });
            }).then(function (items) {
                var todo = items.filter(function (i) { return i.state !== 'rejected'; });
                return todo.reduce(function (p, item) {
                    return p.then(function () {
                        if (stopped) return;
                        if (!isOnline()) { stopped = true; return; }
                        item.state = 'sending'; item.attempts = (item.attempts || 0) + 1;
                        return adapter.update(item).then(function () { return refresh(); }).then(function () {
                            return send(item).then(function (resp) { return handle(item, resp); }, function (e) {
                                item.state = 'waiting'; lastError = 'Network: ' + ((e && e.message) || 'failed');
                                stopped = true; failures++;
                                return adapter.update(item);
                            });
                        }).then(function (ok) { if (ok === true) sent++; });
                    });
                }, Promise.resolve());
            }).then(function () {
                if (stopped) { if (isOnline()) { if (!failures) failures = 1; scheduleRetry(); } }
                else { failures = 0; lastError = null; }
            }, function (e) {
                lastError = 'Sync: ' + ((e && e.message) || 'failed'); failures++; scheduleRetry();
            }).then(function () {
                locked = false;
                return refresh().then(function () { return { sent: sent, stopped: stopped, status: status() }; });
            });

            function handle(item, resp) {
                var code = resp.status;
                return readBody(resp).then(function (body) {
                    var replayed = hdr(resp, 'X-Idempotent-Replay');
                    var stillProcessing = code === 409 && /still processing/i.test(errText(body, resp));
                    var dupe = code === 409 && !stillProcessing && ((body && body.duplicate === true) || /duplicate|already/i.test(errText(body, resp)));
                    if ((code >= 200 && code < 300) || replayed || dupe) {
                        var rec = { uuid: item.uuid, status: code, body: body, url: item.url, kind: item.kind, at: new Date(now()).toISOString() };
                        if (item.temp) rec.temp = item.temp;
                        return adapter.putResult(rec).then(function () { return adapter.remove(item.seq); }).then(function () { return true; });
                    }
                    if (code >= 500 || code === 401 || code === 408 || code === 429 || stillProcessing) {      // try again later; nothing is lost
                        item.state = 'waiting'; lastError = (code === 401 ? 'Please log in again. ' : '') + errText(body, resp);
                        stopped = true; failures++;
                        return adapter.update(item).then(function () { return false; });
                    }
                    item.state = 'rejected'; item.error = errText(body, resp); item.rejectedStatus = code;      // other 4xx: keep it, carry on with the next
                    return adapter.update(item).then(function () { return false; });
                });
            }
        }

        function retryRejected() {
            return adapter.all().then(function (items) {
                return Promise.all(items.filter(function (i) { return i.state === 'rejected'; }).map(function (i) { i.state = 'waiting'; i.error = null; return adapter.update(i); }));
            }).then(function () { lastError = null; failures = 0; return refresh(); }).then(function () { return replay(); });
        }

        var ready = refresh().then(function () {
            return adapter.all().then(function (items) {      // crash recovery on start-up
                return Promise.all(items.filter(function (i) { return i.state === 'sending'; }).map(function (i) { i.state = 'waiting'; return adapter.update(i); }));
            });
        }).then(function () { return refresh(); });

        function refreshServerCounts() {
            if (!fetchImpl || !isOnline()) return Promise.resolve();
            return fetchImpl('/api/sync/status', { credentials: 'same-origin' }).then(function (r) {
                if (!r.ok) return null;
                return r.json().then(function (j) { serverNeedsReview = j && j.counts ? Number(j.counts.needs_review) || 0 : null; emit(); });
            }).catch(function () { /* staff get 403; offline is fine */ });
        }

        return {
            deviceId: deviceId, adapter: adapter, ready: ready,
            fetch: wrappedFetch, enqueue: function (r) { return enqueue(r); }, replay: replay, retryRejected: retryRejected,
            status: status, on: on, list: function () { return adapter.all(); }, results: function () { return adapter.results(); },
            refresh: refresh, refreshServerCounts: refreshServerCounts, backoffMs: backoffMs,
            isQueueable: function (u) { var p = pathOf(u); return !!p && !NEVER_QUEUE.test(p) && isQueueable(p); }
        };
    }

    // ---------------------------------------------------------------- chip (UI)
    function mountChip(inst, el) {
        var doc = root.document;
        if (!doc || !el) return null;
        var pill = doc.createElement('button');
        pill.type = 'button';
        pill.setAttribute('aria-live', 'polite');
        pill.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;border:0;border-radius:999px;padding:4px 12px;font:600 12px/1.4 system-ui,sans-serif;color:#fff;cursor:default;box-shadow:0 1px 4px rgba(0,0,0,.3)';
        var panel = doc.createElement('div');
        panel.style.cssText = 'position:fixed;top:40px;right:8px;z-index:99999;width:min(340px,calc(100vw - 16px));max-height:60vh;overflow:auto;background:#fff;color:#222;border:1px solid #ccc;border-radius:8px;padding:10px;font:13px/1.4 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.3);display:none';
        el.appendChild(pill); el.appendChild(panel);
        var open = false;

        function txt(tag, text, css) { var n = doc.createElement(tag); n.textContent = text == null ? '' : String(text); if (css) n.style.cssText = css; return n; }
        function renderPanel() {
            panel.textContent = '';
            panel.style.display = open ? 'block' : 'none';
            if (!open) return;
            inst.list().then(function (items) {
                var rej = items.filter(function (i) { return i.state === 'rejected'; });
                panel.textContent = '';
                panel.appendChild(txt('div', 'Items the server refused (' + rej.length + ')', 'font-weight:700;margin-bottom:6px'));
                rej.forEach(function (i) {
                    var row = doc.createElement('div'); row.style.cssText = 'border-top:1px solid #eee;padding:6px 0';
                    row.appendChild(txt('div', i.method + ' ' + i.url, 'font-weight:600;word-break:break-all'));
                    row.appendChild(txt('div', i.error || 'Refused', 'color:#b00020'));
                    panel.appendChild(row);
                });
                if (!rej.length) panel.appendChild(txt('div', 'Nothing refused.', 'color:#666'));
                var btn = txt('button', 'Retry', 'margin-top:8px;padding:6px 14px;border:0;border-radius:6px;background:#b00020;color:#fff;font-weight:600;cursor:pointer');
                btn.type = 'button';
                btn.onclick = function () { inst.retryRejected(); };
                panel.appendChild(btn);
            });
        }
        function draw(s) {
            var label, bg, title;
            if (s.state === 'offline') { label = 'OFFLINE'; bg = '#6b7280'; title = 'Saved on this device' + (s.waiting ? ' (' + s.waiting + ' waiting)' : ''); }
            else if (s.state === 'syncing') { label = 'SYNCING (' + s.waiting + ' waiting)'; bg = '#d97706'; title = 'Sending saved items'; }
            else if (s.state === 'error') { label = 'SYNC ERROR'; bg = '#c62828'; title = s.lastError || (s.rejected + ' item(s) refused by the server') + ' - click for details'; }
            else { label = 'ONLINE'; bg = '#2e7d32'; title = 'Connected'; }
            pill.textContent = label; pill.style.background = bg; pill.title = title;
            pill.style.cursor = s.state === 'error' ? 'pointer' : 'default';
            if (s.state !== 'error' && open && !s.rejected) { open = false; }
            if (open) renderPanel(); else { panel.style.display = 'none'; }
        }
        pill.onclick = function () { if (inst.status().state === 'error') { open = !open; renderPanel(); } };
        inst.on('status', draw);
        draw(inst.status());
        return pill;
    }

    // ---------------------------------------------------------------- public object
    var OfflineQueue = { create: create, memoryAdapter: memoryAdapter, idbAdapter: idbAdapter, uuid: uuid4, round2: round2,
        DEFAULT_QUEUEABLE: DEFAULT_QUEUEABLE, NEVER_QUEUE: NEVER_QUEUE, deviceId: null, instance: null };
    try { OfflineQueue.deviceId = storedDeviceId(); } catch (e) { OfflineQueue.deviceId = newDeviceId(); }

    function inst() {
        if (!OfflineQueue.instance) {
            var ad = root.indexedDB ? idbAdapter() : memoryAdapter();
            OfflineQueue.instance = create({ adapter: ad, deviceId: OfflineQueue.deviceId });
        }
        return OfflineQueue.instance;
    }

    OfflineQueue.install = function (opts) {
        opts = opts || {};
        if (OfflineQueue.instance && OfflineQueue.installed) return OfflineQueue.instance;
        var realFetch = root.fetch ? root.fetch.bind(root) : null;
        var c = create(Object.assign({ adapter: root.indexedDB ? idbAdapter() : memoryAdapter(), fetchImpl: realFetch, deviceId: OfflineQueue.deviceId }, opts));
        OfflineQueue.instance = c; OfflineQueue.installed = true; OfflineQueue.deviceId = c.deviceId;
        if (root.fetch) root.fetch = c.fetch;
        if (root.addEventListener) {
            root.addEventListener('online', function () { c.refresh().then(function () { c.replay(); c.refreshServerCounts(); }); });
            root.addEventListener('offline', function () { c.refresh(); });
        }
        c.ready.then(function () { if (c.status().waiting > 0) c.replay(); c.refreshServerCounts(); });
        return c;
    };
    OfflineQueue.enqueue = function (r) { return inst().enqueue(r); };
    OfflineQueue.replay = function () { return inst().replay(); };
    OfflineQueue.status = function () { return inst().status(); };
    OfflineQueue.on = function (e, fn) { return inst().on(e, fn); };
    OfflineQueue.list = function () { return inst().list(); };
    OfflineQueue.results = function () { return inst().results(); };
    OfflineQueue.retryRejected = function () { return inst().retryRejected(); };
    OfflineQueue.mountChip = function (el) { return mountChip(inst(), el); };

    root.OfflineQueue = OfflineQueue;
    if (typeof module !== 'undefined' && module.exports) module.exports = OfflineQueue;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
