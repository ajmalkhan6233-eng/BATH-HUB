/* RBH Pocket: phone app. Reads ONE locked snapshot from the free cloud mailbox and unlocks it on the phone with the passcode.
   The passcode and the shop numbers never go to the cloud. Read-only: nothing here can change shop data. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  var STALE_MIN = 30;           // older than this: say so, the shop PC may be off
  var GRACE_MIN = 15;           // leaving the app (or changing page) for less than this does NOT lock it again
  var passcode = null, snap = null, ckey = null, ckeySalt = null, tab = 'home', hiddenAt = 0;

  // ---------- pure helpers (also used by the test) ----------
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function deriveKey(sealed, pass) {   // not extractable: the key itself can never be read back out
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(sealed.salt), iterations: sealed.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  }
  async function decryptWith(key, sealed) {
    var plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(sealed.iv) }, key, b64(sealed.ct));
    return JSON.parse(new TextDecoder().decode(plain));
  }
  async function unlock(sealed, pass) { return decryptWith(await deriveKey(sealed, pass), sealed); }
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
  function find(items, q, max) {   // phone search: every typed word must be in the name or code
    var w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) return [];
    var out = []; for (var i = 0; i < (items || []).length && out.length < (max || 30); i++) {
      var t = (items[i][0] + ' ' + items[i][1]).toLowerCase(); if (w.every(function (x) { return t.indexOf(x) >= 0; })) out.push(items[i]);
    } return out;
  }
  function throttleWait(fails) {   // seconds to wait after this many wrong tries in a row (0 for the first 4)
    return fails < 5 ? 0 : Math.min(900, 30 * Math.pow(2, fails - 5));
  }
  if (typeof window === 'undefined') { module.exports = { unlock: unlock, deriveKey: deriveKey, decryptWith: decryptWith, rs: rs, ago: ago, vs: vs, dueWord: dueWord, find: find, throttleWait: throttleWait }; return; }

  // ---------- screen ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function row(l, r, rcls) { var d = el('div', 'row'); d.appendChild(el('div', 'l', l)); d.appendChild(el('div', 'r' + (rcls ? ' ' + rcls : ''), r)); return d; }
  // icons: Lucide (ISC licence), inline, fixed strings only
  var ICONS = {"trend":"<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"/><polyline points=\"16 7 22 7 22 13\"/>","week":"<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/><path d=\"M8 14h.01\"/><path d=\"M12 14h.01\"/><path d=\"M16 14h.01\"/><path d=\"M8 18h.01\"/><path d=\"M12 18h.01\"/><path d=\"M16 18h.01\"/>","month":"<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/>","cash":"<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M6 12h.01M18 12h.01\"/>","pay":"<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z\"/><path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\"/><path d=\"M12 17.5v-11\"/>","box":"<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\"/><path d=\"m7.5 4.27 9 5.15\"/>","top":"<path d=\"M6 9H4.5a2.5 2.5 0 0 1 0-5H6\"/><path d=\"M18 9h1.5a2.5 2.5 0 0 0 0-5H18\"/><path d=\"M4 22h16\"/><path d=\"M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22\"/><path d=\"M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22\"/><path d=\"M18 2H6v7a6 6 0 0 0 12 0V2Z\"/>"};
  ICONS.home = "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>";
  ICONS.doc = "<path d=\"M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z\"/><path d=\"M14 2v4a2 2 0 0 0 2 2h4\"/><path d=\"M16 13H8\"/><path d=\"M16 17H8\"/>";
  ICONS.face = "<path d=\"M3 7V5a2 2 0 0 1 2-2h2\"/><path d=\"M17 3h2a2 2 0 0 1 2 2v2\"/><path d=\"M21 17v2a2 2 0 0 1-2 2h-2\"/><path d=\"M7 21H5a2 2 0 0 1-2-2v-2\"/><path d=\"M8 14s1.5 2 4 2 4-2 4-2\"/><path d=\"M9 9h.01\"/><path d=\"M15 9h.01\"/>";
  var TITLE_ICON = { 'Today': 'trend', 'This week': 'week', 'This month': 'month', 'Money in today': 'cash', 'To pay': 'pay', 'Stock': 'box', 'Best sellers this month': 'top', 'Face ID': 'face' };
  function icon(k) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>'; }
  function card(title) { var c = el('div', 'card'); if (title) { var h = el('h2', null, title); var k = TITLE_ICON[title]; if (k) h.insertAdjacentHTML('afterbegin', '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>'); c.appendChild(h); } return c; }
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

  var NODATA = 'No data yet. Update the shop PC app, then refresh.';
  function today0(s) { return new Date(Date.parse(s.at) + 5.5 * 3600e3).toISOString().slice(0, 10); }
  function tapRow(l, r, rcls, fn) { var d = row(l, r, rcls); d.className += ' tap'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.addEventListener('click', fn); d.addEventListener('keydown', function (e) { if (e.key === 'Enter') fn(); }); return d; }
  function bigCard(title, amount, sub, cls) { var c = card(title); c.appendChild(el('div', 'big', rs(amount))); if (sub) c.appendChild(el('div', cls || 'dim', sub)); return c; }
  function dayName(ymd) { var d = new Date(ymd + 'T00:00:00Z'); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.getUTCDate(); }

  // ---- detail sheet (slides up; close with the button, the dark area or Esc)
  function sheet(title, rowsArr, foot) {
    $('sheetT').textContent = title; var b = $('sheetB'); b.textContent = '';
    rowsArr.forEach(function (r) { b.appendChild(row(r[0], r[1], r[2])); });
    if (foot) b.appendChild(el('div', 'dim foot', foot));
    $('sheet').hidden = false;
  }
  function closeSheet() { $('sheet').hidden = true; }

  // ---- tabs
  function rHome(s, box) {
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
      var today = today0(s);
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
    faceCard(box);
  }

  function rSales(s, box) {
    box.appendChild(bigCard('Today', s.sales ? s.sales.today : 0, s.sales ? s.sales.bills_today + ' bills' : null));
    var b = card('Bills today');
    if (!s.bills) b.appendChild(el('div', 'dim', NODATA));
    else if (!s.bills.length) b.appendChild(el('div', 'dim', 'No bills yet today'));
    else s.bills.forEach(function (x) {
      b.appendChild(tapRow(x.t + ' · ' + (x.who || 'Walk-in') + ' · ' + x.pay, rs(x.total), '', function () {
        sheet('Bill ' + x.no, (x.lines || []).map(function (l) { return [l.n + ' × ' + l.q, rs(l.a)]; }).concat([['Total · ' + x.pay, rs(x.total), 'up']]), (x.lines && x.lines.length >= 12) ? 'First 12 lines shown.' : '');
      }));
    });
    box.appendChild(b);
    var d = card('Last 14 days');
    if (!s.daily) d.appendChild(el('div', 'dim', NODATA));
    else {
      var mx = Math.max.apply(null, s.daily.map(function (x) { return x.total; }).concat([1]));
      s.daily.slice().reverse().forEach(function (x) {
        var r = row(dayName(x.d) + ' · ' + x.n + ' bills', rs(x.total)); r.className += ' barrow';
        var bar = el('div', 'bar'); bar.style.width = Math.round(x.total / mx * 100) + '%'; r.insertBefore(bar, r.firstChild); d.appendChild(r);
      });
    }
    box.appendChild(d);
    var t = card('Best sellers this month');
    if (s.top_month && s.top_month.length) s.top_month.forEach(function (x) { t.appendChild(row(x.name + ' × ' + x.qty, rs(x.revenue))); });
    else t.appendChild(s.top_month ? el('div', 'dim', 'No sales yet') : none());
    box.appendChild(t);
  }

  function rStock(s, box) {
    var c = card('Find an item');
    var q = el('input', 'search'); q.type = 'search'; q.placeholder = 'Type name or code'; q.setAttribute('aria-label', 'Search items'); q.autocomplete = 'off';
    var res = el('div', 'results'); c.appendChild(q); c.appendChild(res); box.appendChild(c);
    function draw() {
      res.textContent = '';
      if (!s.items) { res.appendChild(el('div', 'dim', NODATA)); return; }
      if (!q.value.trim()) { res.appendChild(el('div', 'dim', s.items.length + ' items. Type to search.')); return; }
      var f = find(s.items, q.value, 30); if (!f.length) { res.appendChild(el('div', 'dim', 'No match')); return; }
      f.forEach(function (x) { res.appendChild(row(x[1] + (x[0] ? ' · ' + x[0] : ''), x[2] + ' in stock · ' + rs(x[3]), x[2] <= 0 ? 'down' : '')); });
    }
    q.addEventListener('input', draw); draw();
    var o = card('Out of stock');
    if (!s.out_list) o.appendChild(el('div', 'dim', NODATA));
    else if (!s.out_list.length) o.appendChild(el('div', 'dim', 'Nothing out of stock'));
    else s.out_list.forEach(function (x) { o.appendChild(row(x.name, x.code, 'dim')); });
    box.appendChild(o);
    var l = card('Running low');
    if (s.stock && s.stock.low_list.length) s.stock.low_list.forEach(function (x) { l.appendChild(row(x.name, x.qty + ' left (min ' + x.min + ')', 'down')); });
    else l.appendChild(s.stock ? el('div', 'dim', 'Nothing running low') : none());
    box.appendChild(l);
  }

  function rMoney(s, box) {
    var today = today0(s);
    var c = bigCard('Customers owe you', s.credit ? s.credit.total : 0, s.credit ? s.credit.list.length + (s.credit.list.length === 1 ? ' customer' : ' customers') : NODATA);
    if (s.credit) s.credit.list.forEach(function (x) { c.appendChild(row(x.who + (x.oldest ? ' · ' + dueWord(x.oldest, today) : ''), rs(x.owed), x.oldest && x.oldest < today ? 'down' : '')); });
    box.appendChild(c);
    var tv = s.vendors ? s.vendors.reduce(function (a, v) { return a + v.owed; }, 0) : 0;
    var v = bigCard('You owe vendors', tv, s.vendors ? s.vendors.length + (s.vendors.length === 1 ? ' vendor' : ' vendors') : NODATA);
    if (s.vendors) s.vendors.forEach(function (x) {
      v.appendChild(tapRow(x.who + (x.oldest ? ' · ' + dueWord(x.oldest, today) : ''), rs(x.owed), x.oldest && x.oldest < today ? 'down' : '', function () {
        sheet(x.who, x.bills.map(function (b) { return ['Bill ' + (b.ref || '') + ' · ' + dueWord(b.due, today), rs(b.amount), b.due && b.due < today ? 'down' : '']; }).concat([['Total', rs(x.owed), 'up']]));
      }));
    });
    box.appendChild(v);
    var p = card('Money in today');
    if (s.pays_today && s.pays_today.length) s.pays_today.forEach(function (x) { p.appendChild(row(String(x.method || 'other'), rs(x.amount))); });
    else p.appendChild(s.pays_today ? el('div', 'dim', 'Nothing yet today') : none());
    box.appendChild(p);
  }

  function rCheques(s, box) {
    var today = today0(s), c = card('Cheques to clear');
    if (!s.cheques) { c.appendChild(el('div', 'dim', NODATA)); box.appendChild(c); return; }
    var tot = s.cheques.reduce(function (a, x) { return a + x.amount; }, 0), od = s.cheques.filter(function (x) { return x.due && x.due < today; });
    c.appendChild(el('div', 'big', rs(tot)));
    var pill = el('span', 'pill ' + (od.length ? 'bad' : 'ok'), od.length ? od.length + ' overdue' : 'None overdue'); pill.style.marginBottom = '6px'; c.appendChild(pill);
    if (!s.cheques.length) c.appendChild(el('div', 'dim', 'No cheques waiting'));
    s.cheques.forEach(function (x) { c.appendChild(row((x.who || '') + ' · ' + (x.ref || '') + ' · ' + dueWord(x.due, today) + (x.status === 'held' ? ' · held' : ''), rs(x.amount), x.due && x.due < today ? 'down' : '')); });
    box.appendChild(c);
  }

  var TABS = [['home', 'Home', 'home', rHome], ['sales', 'Sales', 'trend', rSales], ['stock', 'Stock', 'box', rStock], ['money', 'Money', 'cash', rMoney], ['cheques', 'Cheques', 'doc', rCheques]];
  function drawTabs() {
    var n = $('tabs'); n.textContent = '';
    TABS.forEach(function (t) {
      var b = document.createElement('button'); b.className = 'tab' + (t[0] === tab ? ' on' : ''); b.setAttribute('aria-label', t[1]); b.setAttribute('aria-current', t[0] === tab ? 'page' : 'false');
      b.insertAdjacentHTML('afterbegin', icon(t[2])); b.appendChild(el('span', null, t[1]));
      b.addEventListener('click', function () { tab = t[0]; closeSheet(); window.scrollTo(0, 0); if (snap) render(snap); });
      n.appendChild(b);
    });
  }

  function render(s) {
    var box = $('cards'); box.textContent = ''; drawTabs();
    var f = TABS.filter(function (t) { return t[0] === tab; })[0]; (f ? f[3] : rHome)(s, box);
    countUp();
    var w = $('when'); w.textContent = 'Updated ' + ago(s.at);
    var stale = (Date.now() - Date.parse(s.at)) / 60000 > STALE_MIN;
    w.className = 'sub' + (stale ? ' stale' : '');
    if (stale) w.textContent += ' · shop PC may be off';
  }

  // ---- Face ID (WebAuthn): the phone asks for your face; only then it opens the key it kept from your last passcode entry.
  // Honest limit: this keeps a stranger out of the app on your unlocked phone. The key sits in this app's private storage, not inside the Face ID chip.
  var idb = function () { return new Promise(function (res, rej) { if (!window.indexedDB) return rej(new Error('no storage')); var r = indexedDB.open('rbh_pocket', 1); r.onupgradeneeded = function () { r.result.createObjectStore('k'); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; }); };
  function idbPut(k, v) { return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction('k', 'readwrite'); t.objectStore('k').put(v, k); t.oncomplete = res; t.onerror = function () { rej(t.error); }; }); }); }
  function idbGet(k) { return idb().then(function (d) { return new Promise(function (res, rej) { var q = d.transaction('k').objectStore('k').get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); }; }); }); }
  function idbDel(k) { return idb().then(function (d) { return new Promise(function (res) { var t = d.transaction('k', 'readwrite'); t.objectStore('k').delete(k); t.oncomplete = res; t.onerror = res; }); }); }
  function rand(n) { return crypto.getRandomValues(new Uint8Array(n)); }
  function enc64(u) { var s = ''; u = new Uint8Array(u); for (var i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); }
  function faceAvailable() { try { return window.PublicKeyCredential && PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable ? PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable() : Promise.resolve(false); } catch (e) { return Promise.resolve(false); } }
  function faceOn() { return !!LS.get('rbh_face'); }
  async function faceEnable() {
    if (!ckey) throw new Error('Open with your passcode first, then turn Face ID on.');
    var cred = await navigator.credentials.create({ publicKey: { challenge: rand(32), rp: { name: 'RBH Pocket' }, user: { id: rand(16), name: 'owner', displayName: 'Owner' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }], authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, attestation: 'none', timeout: 60000 } });
    await idbPut('key', { key: ckey, salt: ckeySalt }); LS.set('rbh_face', enc64(cred.rawId));
  }
  async function faceOff() { LS.del('rbh_face'); try { await idbDel('key'); } catch (e) {} }
  async function faceUnlock() {
    await navigator.credentials.get({ publicKey: { challenge: rand(32), allowCredentials: [{ type: 'public-key', id: b64(LS.get('rbh_face')) }], userVerification: 'required', timeout: 60000 } });
    var rec = await idbGet('key'); if (!rec || !rec.key) throw new Error('Face ID key missing. Use your passcode once.');
    ckey = rec.key; ckeySalt = rec.salt; await load(false);
  }
  function faceCard(box) {
    faceAvailable().then(function (ok) {
      if (!ok && !faceOn()) return;
      var c = card('Face ID'), msg = el('div', 'dim', faceOn() ? 'Face ID is on. Next time, look at the phone to open.' : 'Open with a look instead of typing the passcode.');
      var b = el('button', faceOn() ? '' : 'gold', faceOn() ? 'Turn Face ID off' : 'Turn Face ID on'); b.style.marginTop = '10px';
      b.addEventListener('click', function () {
        b.disabled = true;
        (faceOn() ? faceOff() : faceEnable()).then(function () { render(snap); }, function (e) { msg.textContent = (e && e.name === 'NotAllowedError') ? 'Cancelled.' : (e && e.message) || 'Could not turn on.'; b.disabled = false; });
      });
      c.appendChild(msg); c.appendChild(b); if (box.isConnected) box.appendChild(c);
    });
  }

  // Designer preview: open index.html#demo to see every card with FAKE numbers. No network, no passcode.
  var DEMO = { v: 2, at: new Date().toISOString(), sales: { today: 184500, bills_today: 14, yesterday: 152000, week: 640000, month: 2310000 },
    pays_today: [{ method: 'cash', amount: 96500 }, { method: 'card', amount: 64000 }, { method: 'bank', amount: 24000 }],
    top_month: [{ name: 'Basin mixer tap', qty: 40, revenue: 320000 }, { name: 'Wall tile 30x60', qty: 220, revenue: 286000 }, { name: 'Shower set', qty: 18, revenue: 252000 }],
    stock: { items: 480, out: 6, low: 11, low_list: [{ code: 'A1', name: 'Basin mixer tap', qty: 2, min: 6 }, { code: 'B2', name: 'PVC pipe 1 inch', qty: 4, min: 20 }] },
    due: { overdue_count: 2, overdue_amount: 185000, next: [{ kind: 'bill', who: 'Sample Vendor', ref: 'B1', due: '2026-11-08', amount: 120000 }, { kind: 'cheque', who: 'Sample Supplier', ref: 'C9', due: '2026-11-14', amount: 65000 }] },
    bills: [{ no: 'B-1001', t: '16:42', who: 'Sample Customer', total: 42500, pay: 'cash', lines: [{ n: 'Basin mixer tap', q: 1, a: 32500 }, { n: 'PVC pipe 1 inch', q: 4, a: 10000 }] }, { no: 'B-1000', t: '15:10', who: '', total: 9800, pay: 'card', lines: [{ n: 'Shower head', q: 2, a: 9800 }] }],
    daily: [0, 1, 2, 3, 4, 5, 6].map(function (i) { var d = new Date(Date.now() - (6 - i) * 86400000).toISOString().slice(0, 10); return { d: d, total: 90000 + i * 17000, n: 6 + i }; }),
    items: [['A1', 'Basin mixer tap', 2, 32500], ['B2', 'PVC pipe 1 inch', 4, 2500], ['C3', 'Wall tile 30x60', 220, 1300], ['D4', 'Shower head', 0, 4900]],
    out_list: [{ code: 'D4', name: 'Shower head' }],
    credit: { total: 275000, list: [{ who: 'Sample Builder', owed: 175000, oldest: '2026-10-20' }, { who: 'Sample Contractor', owed: 100000, oldest: '2026-11-20' }] },
    vendors: [{ who: 'Sample Vendor', owed: 120000, oldest: '2026-11-08', bills: [{ ref: 'B1', due: '2026-11-08', amount: 120000 }] }],
    cheques: [{ who: 'Sample Supplier', ref: 'C9', due: '2026-11-14', amount: 65000, status: 'pending' }, { who: 'Sample Vendor', ref: 'C7', due: '2026-11-05', amount: 40000, status: 'held' }] };

  function show(which) { $('gate').hidden = which !== 'gate'; $('app').hidden = which !== 'app'; $('tabs').hidden = which !== 'app'; if (which !== 'app') closeSheet(); }
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
    var sealed = await r.json(); try { LS.set('rbh_sealed', JSON.stringify(sealed)); } catch (e) {} return sealed;
  }

  // open a sealed copy: the kept key if it fits (same salt), else the passcode. Neither: ask again.
  async function openSealed(sealed) {
    if (ckey && ckeySalt === sealed.salt) { try { return await decryptWith(ckey, sealed); } catch (e) { ckey = null; } }
    if (!passcode) { var e2 = new Error('Please open again with your passcode.'); e2.needPass = true; throw e2; }
    ckey = await deriveKey(sealed, passcode); ckeySalt = sealed.salt;
    return decryptWith(ckey, sealed);
  }

  async function load(useCacheOnly) {
    var sealed = null, note = '';
    if (!useCacheOnly) { try { sealed = await fetchSealed(); } catch (e) { note = e.message; } }
    if (!sealed) { try { sealed = JSON.parse(LS.get('rbh_sealed') || 'null'); } catch (e) {} }
    if (!sealed) throw new Error(note || 'Nothing saved on this phone yet.');
    snap = await openSealed(sealed);
    render(snap);
    if (note) $('when').textContent += ' · offline, showing last copy';
  }

  // wrong-passcode brake: 5 wrong in a row, then a wait that doubles (30 s up to 15 min)
  function fails() { try { return JSON.parse(LS.get('rbh_fail') || '{"n":0,"until":0}'); } catch (e) { return { n: 0, until: 0 }; } }
  async function open() {
    var f = fails(), wait = Math.ceil((f.until - Date.now()) / 1000);
    if (wait > 0) { gateMsg('Too many tries. Wait ' + wait + ' s.'); return; }
    var pw = $('pass').value; if (!pw) { gateMsg('Type your passcode.'); return; }
    passcode = pw; gateMsg(''); $('unlock').disabled = true;
    try { await load(false); $('pass').value = ''; LS.del('rbh_fail'); show('app'); }
    catch (e) {
      var bad = e && e.name === 'OperationError'; passcode = null; ckey = null;
      if (bad) { f.n++; var w = throttleWait(f.n); LS.set('rbh_fail', JSON.stringify({ n: f.n, until: w ? Date.now() + w * 1000 : 0 })); }
      gateMsg(bad ? (throttleWait(f.n) ? 'Wrong passcode. Wait ' + throttleWait(f.n) + ' s.' : 'Wrong passcode.') : (e && e.message) || 'Could not open.');
    }
    $('unlock').disabled = false;
  }
  async function openFace() {
    gateMsg(''); $('face').disabled = true;
    try { await faceUnlock(); $('pass').value = ''; show('app'); }
    catch (e) { gateMsg(e && e.name === 'NotAllowedError' ? 'Face ID cancelled. Type your passcode.' : (e && e.message) || 'Face ID did not work. Type your passcode.'); }
    $('face').disabled = false;
  }
  function lock() { passcode = null; ckey = null; ckeySalt = null; snap = null; $('cards').textContent = ''; showGate(); }
  function showGate() { $('face').hidden = !faceOn(); show('gate'); }

  var demoMode = (location.hash || '') === '#demo';
  if (!demoMode) pairFromHash();
  $('unlock').addEventListener('click', open);
  $('face').addEventListener('click', openFace);
  $('pass').addEventListener('keydown', function (e) { if (e.key === 'Enter') open(); });
  $('lock').addEventListener('click', lock);
  $('sheetX').addEventListener('click', closeSheet); $('sheetScrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  $('refresh').addEventListener('click', function () {
    if (demoMode) return;
    if (!snap) return lock(); $('when').textContent = 'Refreshing…';
    load(false).catch(function (e) { if (e.needPass) lock(); else $('when').textContent = e.message; });
  });
  // Leaving the app or changing page does NOT lock it for 15 minutes. After that it locks again.
  document.addEventListener('visibilitychange', function () {
    if (demoMode || !snap) return;
    if (document.hidden) { hiddenAt = Date.now(); return; }
    if (hiddenAt && Date.now() - hiddenAt > GRACE_MIN * 60000) { hiddenAt = 0; lock(); return; }
    hiddenAt = 0; if ((Date.now() - Date.parse(snap.at)) / 60000 > 10) load(false).catch(function () {});   // quiet catch-up
  });
  if (!LS.get('rbh_w')) $('gateText').textContent = 'Open your pairing link once, then enter your passcode';
  if (demoMode) { snap = DEMO; render(DEMO); show('app'); var q = /[?&]tab=(\w+)/.exec(location.search); if (q) { tab = q[1]; render(DEMO); } } else showGate();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
