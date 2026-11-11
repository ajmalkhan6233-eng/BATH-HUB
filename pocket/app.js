/* RBH Pocket: phone app. Reads ONE locked snapshot from the free cloud mailbox and unlocks it on the phone with the passcode.
   The passcode and the shop numbers never go to the cloud. Read-only: nothing here can change shop data. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  var STALE_MIN = 30;           // older than this: say so, the shop PC may be off
  var passcode = null, snap = null;

  // ---------- pure helpers (also used by the test) ----------
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function unlock(sealed, pass) {
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(sealed.salt), iterations: sealed.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(sealed.iv) }, key, b64(sealed.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  function rs(n) { return 'Rs ' + Math.round(Number(n) || 0).toLocaleString('en-US'); }
  function ago(iso, now) {
    var m = Math.max(0, Math.round(((now || Date.now()) - Date.parse(iso)) / 60000));
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    var h = Math.floor(m / 60); return h < 24 ? h + ' h ago' : Math.floor(h / 24) + ' d ago';
  }
  function vs(today, yesterday) {   // "up" / "down" against yesterday, plain words
    if (!yesterday) return { text: 'no sales yesterday', cls: 'dim' };
    var p = Math.round((today - yesterday) / yesterday * 100);
    return { text: (p >= 0 ? 'Up ' : 'Down ') + Math.abs(p) + '% on yesterday', cls: p >= 0 ? 'up' : 'down' };
  }
  function dueWord(due, today) {
    if (!due) return 'no date';
    var d = Math.round((Date.parse(due) - Date.parse(today)) / 86400000);
    return d < 0 ? Math.abs(d) + ' d overdue' : d === 0 ? 'today' : d === 1 ? 'tomorrow' : 'in ' + d + ' d';
  }
  if (typeof window === 'undefined') { module.exports = { unlock: unlock, rs: rs, ago: ago, vs: vs, dueWord: dueWord }; return; }

  // ---------- screen ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function row(l, r, rcls) { var d = el('div', 'row'); d.appendChild(el('div', 'l', l)); d.appendChild(el('div', 'r' + (rcls ? ' ' + rcls : ''), r)); return d; }
  function card(title) { var c = el('div', 'card'); if (title) c.appendChild(el('h2', null, title)); return c; }
  function none() { return el('div', 'dim', 'No data yet'); }


  // look only: numbers count up, bar shrinks on scroll
  function countUp() {
    document.querySelectorAll('#cards .big, #cards .grid .v').forEach(function (n) {
      var m = /^Rs ([\d,]+)$/.exec(n.textContent); if (!m || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
      var to = Number(m[1].replace(/,/g, '')), t0 = performance.now(), D = 900;
      (function f(t) { var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3); n.textContent = rs(to * e); if (k < 1) requestAnimationFrame(f); else n.textContent = rs(to); })(t0);
    });
  }
  window.addEventListener('scroll', function () {   // title shrinks in step with the finger (0 to 1 over 80px)
    var y = window.scrollY, p = Math.max(0, Math.min(1, y / 80));
    document.documentElement.style.setProperty('--p', p.toFixed(3)); document.body.classList.toggle('scrolled', y > 24);
  }, { passive: true });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#refresh'); if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); } });

  function render(s) {
    var box = $('cards'); box.textContent = '';
    var c = card('Today');
    if (s.sales) {
      c.appendChild(el('div', 'big', rs(s.sales.today)));
      var v = vs(s.sales.today, s.sales.yesterday);
      c.appendChild(el('div', v.cls, s.sales.bills_today + ' bills · ' + v.text));
    } else c.appendChild(none());
    box.appendChild(c);

    if (s.sales) {
      var g = el('div', 'grid');
      [['This week', s.sales.week], ['This month', s.sales.month]].forEach(function (x) { var k = card(x[0]); k.appendChild(el('div', 'v', rs(x[1]))); g.appendChild(k); });
      box.appendChild(g); g.style.marginBottom = '12px';
    }

    var p = card('Money in today');
    if (s.pays_today && s.pays_today.length) s.pays_today.forEach(function (x) { p.appendChild(row(String(x.method || 'other'), rs(x.amount))); });
    else p.appendChild(s.pays_today ? el('div', 'dim', 'Nothing yet today') : none());
    box.appendChild(p);

    var d = card('To pay');
    if (s.due) {
      var od = el('div', null); var pill = el('span', 'pill ' + (s.due.overdue_count ? 'bad' : 'ok'), s.due.overdue_count ? s.due.overdue_count + ' overdue · ' + rs(s.due.overdue_amount) : 'Nothing overdue');
      od.appendChild(pill); od.style.marginBottom = '6px'; d.appendChild(od);
      var today = new Date(Date.parse(s.at) + 5.5 * 3600e3).toISOString().slice(0, 10);
      s.due.next.slice(0, 6).forEach(function (x) { d.appendChild(row((x.kind === 'cheque' ? 'Cheque · ' : '') + (x.who || '') + ' ' + dueWord(x.due, today), rs(x.amount), x.due && x.due < today ? 'down' : '')); });
    } else d.appendChild(none());
    box.appendChild(d);

    var st = card('Stock');
    if (s.stock) {
      st.appendChild(row('Out of stock', String(s.stock.out), s.stock.out ? 'down' : ''));
      st.appendChild(row('Running low', String(s.stock.low), s.stock.low ? 'down' : ''));
      s.stock.low_list.slice(0, 8).forEach(function (x) { st.appendChild(row(x.name, x.qty + ' left (min ' + x.min + ')', 'dim')); });
    } else st.appendChild(none());
    box.appendChild(st);

    var t = card('Best sellers this month');
    if (s.top_month && s.top_month.length) s.top_month.forEach(function (x) { t.appendChild(row(x.name, rs(x.revenue))); });
    else t.appendChild(s.top_month ? el('div', 'dim', 'No sales yet') : none());
    box.appendChild(t);

    countUp();
    var w = $('when'); w.textContent = 'Updated ' + ago(s.at);
    var stale = (Date.now() - Date.parse(s.at)) / 60000 > STALE_MIN;
    w.className = 'sub' + (stale ? ' stale' : '');
    if (stale) w.textContent += ' · shop PC may be off';
  }

  // Designer preview: open index.html#demo to see every card with FAKE numbers. No network, no passcode.
  var DEMO = { v: 1, at: new Date().toISOString(), sales: { today: 184500, bills_today: 14, yesterday: 152000, week: 640000, month: 2310000 },
    pays_today: [{ method: 'cash', amount: 96500 }, { method: 'card', amount: 64000 }, { method: 'bank', amount: 24000 }],
    top_month: [{ name: 'Basin mixer tap', qty: 40, revenue: 320000 }, { name: 'Wall tile 30x60', qty: 220, revenue: 286000 }, { name: 'Shower set', qty: 18, revenue: 252000 }],
    stock: { items: 480, out: 6, low: 11, low_list: [{ code: 'A1', name: 'Basin mixer tap', qty: 2, min: 6 }, { code: 'B2', name: 'PVC pipe 1 inch', qty: 4, min: 20 }] },
    due: { overdue_count: 2, overdue_amount: 185000, next: [{ kind: 'bill', who: 'Sample Vendor', ref: 'B1', due: '2026-11-08', amount: 120000 }, { kind: 'cheque', who: 'Sample Supplier', ref: 'C9', due: '2026-11-14', amount: 65000 }] } };

  function show(which) { $('gate').hidden = which !== 'gate'; $('app').hidden = which !== 'app'; }
  function gateMsg(t) { $('gateMsg').textContent = t || ''; }

  // pairing link: https://<app>/#t=READ_TOKEN&w=https://<worker>.workers.dev
  function pairFromHash() {
    var h = (location.hash || '').replace(/^#/, ''); if (!h) return;
    var q = new URLSearchParams(h), t = q.get('t'), w = q.get('w');
    if (t && w && /^https:\/\//.test(w)) { LS.set('rbh_t', t); LS.set('rbh_w', w.replace(/\/+$/, '')); }
    history.replaceState(null, '', location.pathname + location.search);
  }

  async function fetchSealed() {
    var w = LS.get('rbh_w'), t = LS.get('rbh_t');
    if (!w || !t) throw new Error('This phone is not paired yet. Open your pairing link once.');
    var r = await fetch(w + '/snap', { headers: { 'X-Read-Token': t }, cache: 'no-store' });
    if (r.status === 404) throw new Error('No numbers sent yet. The shop PC must send the first one.');
    if (!r.ok) throw new Error('Could not reach the shop mailbox (' + r.status + ').');
    var sealed = await r.json(); LS.set('rbh_sealed', JSON.stringify(sealed)); return sealed;
  }

  async function load(useCacheOnly) {
    var sealed = null, note = '';
    if (!useCacheOnly) { try { sealed = await fetchSealed(); } catch (e) { note = e.message; } }
    if (!sealed) { try { sealed = JSON.parse(LS.get('rbh_sealed') || 'null'); } catch (e) {} }
    if (!sealed) throw new Error(note || 'Nothing saved on this phone yet.');
    snap = await unlock(sealed, passcode);
    render(snap);
    if (note) $('when').textContent += ' · offline, showing last copy';
  }

  async function open() {
    var pw = $('pass').value; if (!pw) { gateMsg('Type your passcode.'); return; }
    passcode = pw; gateMsg(''); $('unlock').disabled = true;
    try { await load(false); $('pass').value = ''; show('app'); }
    catch (e) { passcode = null; gateMsg(e && e.name === 'OperationError' ? 'Wrong passcode.' : (e && e.message) || 'Could not open.'); }
    $('unlock').disabled = false;
  }
  function lock() { passcode = null; snap = null; $('cards').textContent = ''; show('gate'); }

  var demoMode = (location.hash || '') === '#demo';
  if (!demoMode) pairFromHash();
  $('unlock').addEventListener('click', open);
  $('pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
  $('lock').addEventListener('click', lock);
  $('refresh').addEventListener('click', function () { if (!passcode) return lock(); $('when').textContent = 'Refreshing…'; load(false).catch(function (e) { $('when').textContent = e.message; }); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { lock(); } });   // phone locked or app switched: numbers hide again
  if (!LS.get('rbh_w')) $('gateText').textContent = 'Open your pairing link once, then enter your passcode';
  if (demoMode) { render(DEMO); show('app'); } else show('gate');
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
