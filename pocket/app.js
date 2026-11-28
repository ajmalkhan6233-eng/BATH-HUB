/* RBH Pocket: phone app. Reads ONE locked snapshot from the free cloud mailbox and unlocks it on the phone with the passcode.
   The passcode and the shop numbers never go to the cloud. Read-only: nothing here can change shop data. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var LS = { get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  var STALE_MIN = 30;           // older than this: say so, the shop PC may be off
  var GRACE_MIN = 15;           // leaving the app (or changing page) for less than this does NOT lock it again
  var sealMeta = null, passcode = null, snap = null, ckey = null, ckeySalt = null, tab = 'home', hiddenAt = 0;

  // ---------- pure helpers (also used by the test) ----------
  function b64(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  async function deriveKey(sealed, pass) {   // not extractable: the key itself can never be read back out
    var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(sealed.salt), iterations: sealed.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
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
  var HAY = typeof WeakMap === 'function' ? new WeakMap() : null;   // speed: each item list is lower-cased once, then reused on every key press
  function find(items, q, max) {   // phone search: every typed word must be in the name or code
    var w = String(q || '').toLowerCase().split(/\s+/).filter(Boolean); if (!w.length) return [];
    items = items || []; var hay = HAY && HAY.get(items);
    if (!hay) { hay = items.map(function (x) { return (x[0] + ' ' + x[1]).toLowerCase(); }); if (HAY) HAY.set(items, hay); }
    var out = []; for (var i = 0; i < items.length && out.length < (max || 30); i++) {
      var t = hay[i]; if (w.every(function (x) { return t.indexOf(x) >= 0; })) out.push(items[i]);
    } return out;
  }
  function throttleWait(fails) {   // seconds to wait after this many wrong tries in a row (0 for the first 4)
    return fails < 5 ? 0 : Math.min(900, 30 * Math.pow(2, fails - 5));
  }
  if (typeof window === 'undefined') { module.exports = { unlock: unlock, deriveKey: deriveKey, decryptWith: decryptWith, rs: rs, ago: ago, vs: vs, dueWord: dueWord, find: find, throttleWait: throttleWait }; return; }

  // ---------- screen (LOOK v5: Stone & Brass). Drawing only: no shop logic lives here. ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function row(l, r, rcls) { var d = el('div', 'row'); d.appendChild(el('div', 'l', l)); d.appendChild(el('div', 'r' + (rcls ? ' ' + rcls : ''), r)); return d; }
  function row2(t, s, r, rcls) {   // two-line row: title, small line under it, amount on the right
    var d = el('div', 'row'), L = el('div', 'l'); L.appendChild(el('div', 't', t)); if (s) L.appendChild(el('div', 's', s)); d.appendChild(L);
    if (r != null) { if (typeof r === 'string') d.appendChild(el('div', 'r' + (rcls ? ' ' + rcls : ''), r)); else d.appendChild(r); }
    return d;
  }
  // icons: Lucide (ISC licence), inline, fixed strings only
  var ICONS = {"trend":"<polyline points=\"22 7 13.5 15.5 8.5 10.5 2 17\"/><polyline points=\"16 7 22 7 22 13\"/>","cash":"<rect width=\"20\" height=\"12\" x=\"2\" y=\"6\" rx=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\"/><path d=\"M6 12h.01M18 12h.01\"/>","box":"<path d=\"M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z\"/><path d=\"M12 22V12\"/><path d=\"m3.3 7 7.703 4.734a2 2 0 0 0 1.994 0L20.7 7\"/><path d=\"m7.5 4.27 9 5.15\"/>"};
  ICONS.home = "<path d=\"M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8\"/><path d=\"M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z\"/>";
  ICONS.cart = "<circle cx=\"8\" cy=\"21\" r=\"1\"/><circle cx=\"19\" cy=\"21\" r=\"1\"/><path d=\"M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12\"/>";
  ICONS.coins = "<circle cx=\"8\" cy=\"8\" r=\"6\"/><path d=\"M18.09 10.37A6 6 0 1 1 10.34 18\"/><path d=\"M7 6h1v4\"/><path d=\"m16.71 13.88.7.71-2.82 2.82\"/>";
  ICONS.cal = "<path d=\"M8 2v4\"/><path d=\"M16 2v4\"/><rect width=\"18\" height=\"18\" x=\"3\" y=\"4\" rx=\"2\"/><path d=\"M3 10h18\"/>";
  ICONS.truck = "<path d=\"M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2\"/><path d=\"M15 18H9\"/><path d=\"M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14\"/><circle cx=\"17\" cy=\"18\" r=\"2\"/><circle cx=\"7\" cy=\"18\" r=\"2\"/>";
  ICONS.cheque = "<path d=\"M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z\"/><path d=\"M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8\"/><path d=\"M12 17.5v-11\"/>";
  ICONS.users = "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"/><circle cx=\"9\" cy=\"7\" r=\"4\"/><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"/><path d=\"M16 3.13a4 4 0 0 1 0 7.75\"/>";
  ICONS.alert = "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/>";
  ICONS.down = "<path d=\"M12 5v14\"/><path d=\"m19 12-7 7-7-7\"/>";
  ICONS.list = "<path d=\"M3 12h.01\"/><path d=\"M3 18h.01\"/><path d=\"M3 6h.01\"/><path d=\"M8 12h13\"/><path d=\"M8 18h13\"/><path d=\"M8 6h13\"/>";
  ICONS.star = "<polygon points=\"12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2\"/>";
  function icon(k) { return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[k] + '</svg>'; }
  function pill(text, cls) { return el('span', 'pill' + (cls ? ' ' + cls : ''), text); }
  function card(title, right) {
    var c = el('div', 'card' + (title ? '' : ' nohead'));
    if (title) { var h = el('h2'); h.appendChild(el('span', null, title)); if (right) h.appendChild(typeof right === 'string' ? el('span', null, right) : right); c.appendChild(h); }
    return c;
  }
  function none() { return el('div', 'note', 'No data yet'); }
  function sgn(n) { return (n < 0 ? '-' : '') + rs(Math.abs(n || 0)); }
  function cap(t) { t = String(t || 'other'); return t.charAt(0).toUpperCase() + t.slice(1); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }
  function ledger(title, amount, pl, subs) {   // the big typographic number straight on the canvas
    var d = el('div', 'ledger'), e = el('div', 'eyebrow'); e.appendChild(el('span', null, title)); if (pl) e.appendChild(pl); d.appendChild(e);
    d.appendChild(el('div', 'big', typeof amount === 'string' ? amount : rs(amount)));
    if (subs && subs.length) { var h = el('div', 'hsub'); subs.forEach(function (x) { h.appendChild(typeof x === 'string' ? el('span', null, x) : x); }); d.appendChild(h); }
    return d;
  }
  function kv(k, v) { var s = el('span'); s.appendChild(document.createTextNode(k + ' ')); s.appendChild(el('b', null, v)); return s; }
  function tile(k, v, cls) { var t = el('div', 'tile'); t.appendChild(el('div', 'k', k)); t.appendChild(el('div', 'v' + (cls ? ' ' + cls : ''), v)); return t; }
  function tapCard(c, fn) { c.className += ' tapc'; c.setAttribute('role', 'button'); c.tabIndex = 0; c.addEventListener('click', fn); c.addEventListener('keydown', function (e) { if (e.key === 'Enter') fn(); }); return c; }
  function segc(opts, on, fn) {   // segmented switch: [[value, label], ...]
    var s = el('div', 'seg'); s.setAttribute('role', 'tablist');
    opts.forEach(function (o) { var b = el('button', o[0] === on ? 'on' : '', o[1]); b.setAttribute('aria-pressed', o[0] === on ? 'true' : 'false'); b.addEventListener('click', function () { if (o[0] !== on) fn(o[0]); }); s.appendChild(b); });
    return s;
  }
  function dueText(d, today) { return d ? window.RBHD.full(d, today) : 'no date'; }   // 23 Nov: ONE date style everywhere (dates.js)
  function go(t) { var b = document.querySelector('#tabs .tab[data-tab="' + t + '"]'); if (b) b.click(); }
  function duePill(due) { return due.overdue_count ? pill(due.overdue_count + ' overdue · ' + rs(due.overdue_amount), 'bad') : due.pending_dates ? pill(plural(due.pending_dates, 'bill needs a date', 'bills need a date'), 'amber') : pill('Nothing overdue', 'ok'); }

  // title shrinks with the finger (0 to 1 over 80px); refresh icon turns once
  window.addEventListener('scroll', function () {
    var y = window.scrollY, p = Math.max(0, Math.min(1, y / 80));
    document.documentElement.style.setProperty('--p', p.toFixed(3)); document.body.classList.toggle('scrolled', y > 24);
  }, { passive: true });
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('#refresh'); if (b) { b.classList.remove('spin'); void b.offsetWidth; b.classList.add('spin'); } });

  var NODATA = 'No data yet. Update the shop PC app, then refresh.';
  function today0(s) { return new Date(Date.parse(s.at) + 5.5 * 3600e3).toISOString().slice(0, 10); }
  function tapRow(l, r, rcls, fn) { var d = row(l, r, rcls); d.className += ' tap'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.addEventListener('click', fn); d.addEventListener('keydown', function (e) { if (e.key === 'Enter') fn(); }); return d; }
  function tapRow2(t, s, r, rcls, fn) { var d = row2(t, s, r, rcls); d.className += ' tap'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.addEventListener('click', fn); d.addEventListener('keydown', function (e) { if (e.key === 'Enter') fn(); }); return d; }
  function irow(k, col, t, sb, r, rcls, fn) {   // iPhone Settings-style row: coloured icon square, title, small line, value, chevron when tappable
    var d = fn ? tapRow2(t, sb, r, rcls, fn) : row2(t, sb, r, rcls); d.className += ' ir';
    var i = el('span', 'ico'); i.style.background = 'var(--' + col + ')'; i.innerHTML = icon(k); d.insertBefore(i, d.firstChild); return d;
  }
  function bigCard(title, amount, sub, cls) { var c = card(title); c.appendChild(el('div', 'big md', rs(amount))); if (sub) c.appendChild(el('div', cls || 'note', sub)); return c; }
  function dayName(ymd) { var d = new Date(ymd + 'T00:00:00Z'); return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()] + ' ' + d.getUTCDate(); }
  function bars(daily) {   // 14-day chart, pure CSS; the best day is brass
    var w = el('div', 'chart'); w.setAttribute('aria-hidden', 'true');
    var mx = Math.max.apply(null, daily.map(function (x) { return x.total; }).concat([1]));
    daily.forEach(function (x) { var c = el('div', 'col'), f = el('div', 'fill' + (x.total === mx && mx > 1 ? ' peak' : '')); f.style.height = Math.max(3, Math.round(x.total / mx * 100)) + '%'; c.appendChild(f); c.appendChild(el('div', 'cl', String(Number(x.d.slice(8))))); w.appendChild(c); });
    return w;
  }

  // ---- detail sheet (slides up; close with the button, the dark area or Esc)
  function sheet(title, rowsArr, foot) {
    $('sheetT').textContent = title; var b = $('sheetB'); b.textContent = '';
    rowsArr.forEach(function (r) { b.appendChild(row(r[0], r[1], r[2])); });
    if (foot) b.appendChild(el('div', 'note foot', foot));
    $('sheet').hidden = false;
  }
  function closeSheet() { $('sheet').hidden = true; }

  // ---- HOME: today in one look, as plain iPhone lists. Every row opens its detail.
  function rHome(s, box) {
    var sl = s.sales, pr = s.profit, pt = pr && pr.today, today = today0(s);
    var g = card('Sales and money in');
    if (sl) {
      var v = vs(sl.today, sl.yesterday);
      g.appendChild(irow('trend', 'green', 'Sales', plural(sl.bills_today || 0, 'bill', 'bills') + ' · ' + v.text, rs(sl.today), '', function () { EXTRA.per = 'today'; go('profit'); }));
    }
    var tot = (s.pays_today || []).reduce(function (a, x) { return a + (Number(x.amount) || 0); }, 0);
    if (s.pays_today) (s.pays_today.length ? s.pays_today : []).forEach(function (x) { g.appendChild(irow('cash', 'teal', cap(x.method), 'Money in today', rs(x.amount), '', null)); });
    if (!g.querySelector('.row')) g.appendChild(none());
    box.appendChild(g);

    if (sl) {
      var w = card('This week and month');
      w.appendChild(irow('cal', 'indigo', 'This week', '', rs(sl.week), '', function () { EXTRA.per = 'week'; go('profit'); }));
      w.appendChild(irow('cal', 'purple', 'This month', '', rs(sl.month), '', function () { EXTRA.per = 'month'; go('profit'); }));
      box.appendChild(w);
    }

    // 28 Nov: a cheque due today or in the next 2 days gets its own card, first in the list of what is coming
    var d2 = new Date(Date.parse(today + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10);
    var soon = (s.cheques || []).filter(function (x) { return x.due && x.due >= today && x.due <= d2; });
    if (soon.length) {
      var sw = card('Cheques due in 2 days');
      soon.forEach(function (x) { sw.appendChild(irow('alert', 'red', x.who || 'Cheque', window.RBHD.full(x.due, today), rs(x.amount), 'down', function () { MV = 'cheques'; go('money'); })); });
      box.appendChild(sw);
    }

    if ((s.advances && s.advances.length) || (s.returns && s.returns.length)) {
      var ar = card('Reserved and returns');
      (s.advances || []).forEach(function (x) { ar.appendChild(row2((x.no || 'Advance') + (x.who ? ' · ' + x.who : ''), 'Advance paid ' + rs(x.paid) + ' of ' + rs(x.total) + ' · not a sale yet', rs(x.total - x.paid) + ' left')); });
      (s.returns || []).forEach(function (x) { ar.appendChild(row2('Return ' + (x.no || '') + (x.who ? ' · ' + x.who : ''), x.d ? window.RBHD.full(x.d, today) : '', rs(x.amount))); });
      box.appendChild(ar);
    }

    var up = card('Coming up');   // AJ 22 Nov: what is about to fall due (cheques now; his lease and other dates when he gives them)
    (s.cheques || []).filter(function (x) { return x.due; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; }).slice(0, 4).forEach(function (x) {
      up.appendChild(irow('cheque', 'pink', 'Cheque · ' + (x.who || ''), window.RBHD.full(x.due, today), rs(x.amount), x.due < today ? 'down' : '', function () { MV = 'cheques'; go('money'); }));
    });
    if (up.querySelector('.row')) box.appendChild(up);

    var m = card('Money');
    if (s.vendors) { var tv = s.vendors.reduce(function (a, x) { return a + x.owed; }, 0);
      m.appendChild(irow('truck', 'orange', 'To pay vendors', s.due && s.due.overdue_count ? s.due.overdue_count + ' overdue · ' + rs(s.due.overdue_amount) : plural(s.vendors.length, 'vendor', 'vendors'), rs(tv), '', function () { MV = 'pay'; go('money'); })); }
    if (s.cheques) { var tc = s.cheques.reduce(function (a, x) { return a + x.amount; }, 0), oc = s.cheques.filter(function (x) { return x.due && x.due < today; }).length;
      m.appendChild(irow('cheque', 'pink', 'Cheques to clear', oc ? oc + ' overdue' : plural(s.cheques.length, 'cheque', 'cheques'), rs(tc), '', function () { MV = 'cheques'; go('money'); })); }
    if (s.credit) m.appendChild(irow('users', 'blue', 'Customers owe you', plural(s.credit.list.length, 'customer', 'customers'), rs(s.credit.total), '', function () { MV = 'collect'; go('money'); }));
    if (!m.querySelector('.row')) m.appendChild(none());
    box.appendChild(m);
    var due = m.querySelector('.row .s'); if (due && s.due && s.due.overdue_count) due.className = 's down';

    var st = card('Stock');
    if (s.stock) {
      st.appendChild(irow('alert', 'red', 'Out of stock', 'Tap to order', String(s.stock.out), s.stock.out ? 'down' : '', function () { STV = 'out'; go('stock'); }));
      st.appendChild(irow('down', 'orange', 'Running low', 'Below the minimum', String(s.stock.low), '', function () { STV = 'low'; go('stock'); }));
      st.appendChild(irow('list', 'gray', 'All items', 'Search name or code', s.items ? s.items.length.toLocaleString('en-US') : '', '', function () { STV = 'all'; go('stock'); }));
    } else st.appendChild(none());
    box.appendChild(st);

    var t = card('Best sellers this month');
    if (s.top_month && s.top_month.length) s.top_month.slice(0, 5).forEach(function (x, i) { t.appendChild(row2((i + 1) + '. ' + x.name, x.qty != null ? x.qty + ' sold' : '', rs(x.revenue))); });
    else t.appendChild(s.top_month ? el('div', 'note', 'No sales yet') : none());
    box.appendChild(t);
    faceCard(box); pairCard(box);
  }

  // ---- fallback Profit view if profit.js is missing
  function rSales(s, box) {
    box.appendChild(ledger('Today’s sales', s.sales ? s.sales.today : 0, null, s.sales ? [plural(s.sales.bills_today, 'bill', 'bills')] : null));
    var b = card('Bills today');
    if (!s.bills) b.appendChild(el('div', 'note', NODATA));
    else if (!s.bills.length) b.appendChild(el('div', 'note', 'No bills yet today'));
    else s.bills.forEach(function (x) { b.appendChild(tapRow2(x.who || 'Walk-in', x.t + ' · ' + cap(x.pay), rs(x.total), '', function () { sheet('Bill ' + x.no, (x.lines || []).map(function (l) { return [l.n + ' × ' + l.q, rs(l.a)]; }).concat([['Total · ' + cap(x.pay), rs(x.total), 'up']]), ''); })); });
    box.appendChild(b);
    if (s.daily && s.daily.length) { var d = card('Last 14 days'); d.appendChild(bars(s.daily)); box.appendChild(d); }
  }

  // ---- STOCK: All · 0 left · Low, with an Order button on each item (act.js keeps the order list)
  var STV = 'all', STQ = '';
  function orderBtn(code, name) {
    if (!EXTRA.addOrder) return null;
    var b = el('button', 'add', '+ Order'); b.setAttribute('aria-label', 'Add ' + name + ' to the order list');
    b.addEventListener('click', function (e) { e.stopPropagation(); EXTRA.addOrder(code, name); b.textContent = 'Added'; b.disabled = true; });
    return b;
  }
  function rStock(s, box) {
    var st = s.stock;
    box.appendChild(segc([['all', 'All' + (s.items ? ' (' + s.items.length.toLocaleString('en-US') + ')' : '')], ['out', '0 left' + (st ? ' (' + st.out + ')' : '')], ['low', 'Low' + (st ? ' (' + st.low + ')' : '')]], STV, function (v) { STV = v; render(snap); }));
    EXTRA.stockExtras.forEach(function (f) { f(s, box); });
    var c = card(null);
    if (STV === 'all') {
      var q = el('input', 'search'); q.type = 'search'; q.placeholder = 'Type item name or code'; q.setAttribute('aria-label', 'Search items'); q.autocomplete = 'off'; q.value = STQ;
      var res = el('div', 'results'); c.appendChild(q); c.appendChild(res);
      var draw = function () {
        STQ = q.value; res.textContent = '';
        if (!s.items) { res.appendChild(el('div', 'note', NODATA)); return; }
        if (!q.value.trim()) { res.appendChild(el('div', 'note', s.items.length.toLocaleString('en-US') + ' items. Type a name or code.')); return; }
        var f = find(s.items, q.value, 30); if (!f.length) { res.appendChild(el('div', 'note', 'No matching items. Try a shorter word.')); return; }
        var frag = document.createDocumentFragment();
        f.forEach(function (x) {
          var r = row2(x[1], (x[0] ? x[0] + ' · ' : '') + rs(x[3]) + ' · ' + (x[2] <= 0 ? '0 left' : x[2] + ' in stock'), null);
          if (x[2] <= 0) r.lastChild.lastChild.className = 's down';
          var ob = orderBtn(x[0], x[1]); if (ob) r.appendChild(ob); frag.appendChild(r);
        });
        res.appendChild(frag);
      };
      q.addEventListener('input', draw); draw();
    } else if (STV === 'out') {
      if (!s.out_list) c.appendChild(el('div', 'note', NODATA));
      else if (!s.out_list.length) c.appendChild(el('div', 'note', 'Nothing out of stock'));
      else s.out_list.forEach(function (x) { var r = row2(x.name, (x.code ? x.code + ' · ' : '') + '0 left', null); r.lastChild.lastChild.className = 's down'; var ob = orderBtn(x.code, x.name); if (ob) r.appendChild(ob); c.appendChild(r); });
    } else {
      if (!st) c.appendChild(none());
      else if (!st.low_list.length) c.appendChild(el('div', 'note', 'Nothing running low'));
      else st.low_list.forEach(function (x) { var r = row2(x.name, (x.code ? x.code + ' · ' : '') + x.qty + ' left · min ' + x.min, null); r.lastChild.lastChild.className = 's warnc'; var ob = orderBtn(x.code, x.name); if (ob) r.appendChild(ob); c.appendChild(r); });
    }
    box.appendChild(c);
  }

  // ---- MONEY: To collect · To pay · Cheques
  var MV = 'collect';
  function rMoney(s, box) {
    var today = today0(s);
    box.appendChild(segc([['collect', 'To collect'], ['pay', 'To pay'], ['cheques', 'Cheques']], MV, function (v) { MV = v; render(snap); }));
    if (MV === 'collect') {
      if (!s.credit) { box.appendChild(el('div', 'note', NODATA)); return; }
      box.appendChild(ledger('Customers owe you', s.credit.total, pill(plural(s.credit.list.length, 'customer', 'customers'), s.credit.list.length ? 'amber' : 'ok')));
      var c = card(null);
      if (!s.credit.list.length) c.appendChild(el('div', 'note', 'Nobody owes you. All clear.'));
      s.credit.list.forEach(function (x) { var late = x.oldest && x.oldest < today; c.appendChild(row2(x.who, x.oldest ? 'Oldest bill ' + window.RBHD.full(x.oldest, today) : '', rs(x.owed), late ? 'down' : '')); });
      box.appendChild(c);
    } else if (MV === 'pay') {
      if (!s.vendors) { box.appendChild(el('div', 'note', NODATA)); return; }
      var tv = s.vendors.reduce(function (a, v) { return a + v.owed; }, 0);
      box.appendChild(ledger('You owe vendors', tv, s.due ? duePill(s.due) : null, [plural(s.vendors.length, 'vendor', 'vendors') + ' · tap one for its bills']));
      var v = card(null);
      if (!s.vendors.length) v.appendChild(el('div', 'note', 'Nothing owed to vendors.'));
      s.vendors.forEach(function (x) {
        v.appendChild(tapRow2(x.who, x.oldest ? 'Oldest bill ' + dueText(x.oldest, today) : '', rs(x.owed), x.oldest && x.oldest < today ? 'down' : '', function () {
          sheet(x.who, x.bills.map(function (b) { return ['Bill ' + (b.ref || '') + ' · ' + dueText(b.due, today), rs(b.amount), b.due && b.due < today ? 'down' : '']; }).concat([['Total', rs(x.owed), 'up']]));
        }));
      });
      box.appendChild(v);
    } else rCheques(s, box);
  }

  function rCheques(s, box) {
    var today = today0(s);
    if (!s.cheques) { box.appendChild(el('div', 'note', NODATA)); return; }
    var tot = s.cheques.reduce(function (a, x) { return a + x.amount; }, 0), od = s.cheques.filter(function (x) { return x.due && x.due < today; });
    box.appendChild(ledger('Cheques to clear', tot, pill(od.length ? od.length + ' overdue' : 'None overdue', od.length ? 'bad' : 'ok'), [plural(s.cheques.length, 'cheque', 'cheques')]));
    if (EXTRA.chqcal) EXTRA.chqcal(s, box);   // AJ 23 Nov: the calendar, same as the PC
    var c = card(null);
    if (!s.cheques.length) c.appendChild(el('div', 'note', 'No cheques waiting'));
    s.cheques.forEach(function (x) { c.appendChild(row2(x.who || 'Cheque', (x.ref ? 'No. ' + x.ref + ' · ' : '') + dueText(x.due, today) + (x.status === 'held' ? ' · held' : ''), rs(x.amount), x.due && x.due < today ? 'down' : '')); });
    box.appendChild(c);
  }

  var EXTRA = { profit: null, sell: null, stockExtras: [] };
  // ---- hooks for the modules (profit.js, act.js). They get the screen helpers and a way to send a LOCKED request to the shop PC.
  async function encryptWith(obj) {
    if (!ckey || !sealMeta) throw new Error('Open with your passcode first.');
    var iv = crypto.getRandomValues(new Uint8Array(12));
    try { var ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, ckey, new TextEncoder().encode(JSON.stringify(obj))); }
    catch (e) { throw new Error('Please close the app, open with your passcode, then try again.'); }
    return { v: 1, iter: sealMeta.iter, salt: sealMeta.salt, iv: enc64(iv), ct: enc64(new Uint8Array(ct)) };
  }
  async function toShop(cmd) {   // phone -> locked inbox. Returns the request id.
    var w = LS.get('rbh_w'), t = LS.get('rbh_t'); if (!w || !t) throw new Error('This phone is not paired yet.');
    var id = cmd.id || enc64(crypto.getRandomValues(new Uint8Array(12))).replace(/[+/=]/g, 'x'); cmd.id = id; cmd.ts = Date.now();
    var r = await fetch(w + '/inbox', { method: 'POST', headers: { 'X-Read-Token': t, 'Content-Type': 'application/json' }, body: JSON.stringify(await encryptWith(cmd)) });
    if (r.status === 429) throw new Error('Too many waiting. Try again in a minute.');
    if (!r.ok) throw new Error('Could not reach the shop mailbox (' + r.status + ').');
    return id;
  }
  async function fromShop(id) {  // locked answer, or null while the PC has not answered yet
    var w = LS.get('rbh_w'), t = LS.get('rbh_t'), r = await fetch(w + '/out/' + id, { headers: { 'X-Read-Token': t }, cache: 'no-store' });
    if (r.status === 404) return null; if (!r.ok) throw new Error('Could not reach the shop mailbox (' + r.status + ').');
    return decryptWith(ckey, await r.json());
  }
  window.RBHP = { EXTRA: EXTRA, LS: LS, rs: rs, el: el, row: row, row2: row2, card: card, pill: pill, segc: segc, ledger: ledger, kv: kv, tile: tile, bars: bars, sgn: sgn, cap: cap, plural: plural, bigCard: bigCard, tapRow: tapRow, tapRow2: tapRow2, sheet: sheet, closeSheet: closeSheet, find: find, none: none, toShop: toShop, fromShop: fromShop, go: go, tab: function () { return tab; }, snap: function () { return snap; }, redraw: function () { if (snap) render(snap); } };
  // Tabs are modules. profit.js adds Profit, act.js adds Sell and the Order card. If a module is missing the app still works.
  var TABS = [['home', 'Home', 'home', rHome], ['profit', 'Profit', 'trend', function (s, b) { if (EXTRA.profit) EXTRA.profit(s, b); else rSales(s, b); }],
    ['sell', 'Sell', 'cart', function (s, b) { if (EXTRA.sell) EXTRA.sell(s, b); else b.appendChild(el('div', 'note', 'Sell is not loaded.')); }],
    ['stock', 'Stock', 'box', rStock],
    ['money', 'Money', 'cash', rMoney]];
  function drawTabs() {
    var n = $('tabs'); n.textContent = '';
    TABS.forEach(function (t) {
      var b = document.createElement('button'); b.className = 'tab' + (t[0] === tab ? ' on' : ''); b.dataset.tab = t[0]; b.setAttribute('aria-label', t[1]); b.setAttribute('aria-current', t[0] === tab ? 'page' : 'false');
      b.insertAdjacentHTML('afterbegin', icon(t[2])); b.appendChild(el('span', null, t[1]));
      b.addEventListener('click', function () { tab = t[0]; closeSheet(); window.scrollTo(0, 0); if (snap) render(snap); });
      n.appendChild(b);
    });
  }

  var drawnTab = null;
  function render(s) {
    var box = $('cards'); box.textContent = ''; drawTabs();
    if (drawnTab !== tab) { box.style.animation = 'none'; void box.offsetWidth; box.style.animation = ''; drawnTab = tab; }   // calm fade only when the tab changes
    var f = TABS.filter(function (t) { return t[0] === tab; })[0];
    box.appendChild(el('div', 'ltitle', tab === 'home' ? 'Today' : f ? f[1] : 'Today'));   // iPhone large title
    (f ? f[3] : rHome)(s, box);
    if (EXTRA.after) EXTRA.after(tab);
    var w = $('when'); w.textContent = 'Updated ' + ago(s.at);
    var stale = (Date.now() - Date.parse(s.at)) / 60000 > STALE_MIN;
    w.className = 'sub' + (stale ? ' stale' : '');
    if (stale) w.textContent += ' · shop PC may be off';
    if (navigator.onLine === false) { w.textContent = 'Offline · saved copy, ' + ago(s.at); w.className = 'sub stale'; }
  }
  window.addEventListener('online', function () { if (snap) render(snap); });
  window.addEventListener('offline', function () { if (snap) render(snap); });

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
      var c = card('Face ID'), msg = el('div', 'note', faceOn() ? 'Face ID is on. Next time, look at the phone to open.' : 'Open with a look instead of typing the passcode.');
      var b = el('button', faceOn() ? 'wide' : 'gold wide', faceOn() ? 'Turn Face ID off' : 'Turn Face ID on'); b.style.marginTop = '10px';
      b.addEventListener('click', function () {
        b.disabled = true;
        (faceOn() ? faceOff() : faceEnable()).then(function () { render(snap); }, function (e) { msg.textContent = (e && e.name === 'NotAllowedError') ? 'Cancelled.' : (e && e.message) || 'Could not turn on.'; b.disabled = false; });
      });
      c.appendChild(msg); c.appendChild(b); if (box.isConnected) box.appendChild(c);
    });
  }

  // Designer preview: open index.html#demo to see every card with FAKE numbers. No network, no passcode.
  var DEMO = (function () {
    var D = function (n) { return new Date(Date.now() + 5.5 * 3600e3 + n * 86400000).toISOString().slice(0, 10); };
    var daily = []; for (var i = 13; i >= 0; i--) daily.push({ d: D(-i), total: [96000, 121000, 88000, 143000, 102000, 167000, 0, 112000, 138000, 240000, 129000, 151000, 118000, 184500][13 - i], n: 6 + (i % 5) });
    return { v: 2, at: new Date().toISOString(),
      sales: { today: 184500, bills_today: 14, yesterday: 152000, week: 942000, month: 3480000 },
      profit: { run_per_day: 25000, today: { sales: 184500, cost: 136300, gross: 48200, net: 23200, bills: 14, no_cost: 0 }, yesterday: { sales: 152000, cost: 114000, gross: 38000, net: 13000, bills: 11, no_cost: 0 },
        week: { sales: 942000, cost: 700000, gross: 242000, net: 67000, bills: 61, no_cost: 0 }, month: { sales: 3480000, cost: 2585000, gross: 895000, net: 345000, bills: 214, no_cost: 3 },
        items: [{ name: 'Concealed cistern dual flush', qty: 42, revenue: 378000, profit: 96000 }, { name: 'Thermostatic rain mixer', qty: 18, revenue: 252000, profit: 71000 }, { name: 'Wall tile 30x60', qty: 220, revenue: 286000, profit: 52000 }] },
      pays_today: [{ method: 'cash', amount: 96500 }, { method: 'card', amount: 64000 }, { method: 'online', amount: 24000 }],
      top_month: [{ name: 'Concealed cistern dual flush', qty: 42, revenue: 378000 }, { name: 'Wall tile 30x60', qty: 220, revenue: 286000 }, { name: 'Thermostatic rain mixer', qty: 18, revenue: 252000 }, { name: 'Basin mixer tap', qty: 40, revenue: 220000 }],
      stock: { items: 2480, out: 2, low: 3, low_list: [{ code: 'A1', name: 'Basin mixer tap', qty: 2, min: 6 }, { code: 'B2', name: 'PVC pipe 1 inch', qty: 4, min: 20 }, { code: 'E5', name: 'Angle valve 1/2 inch', qty: 3, min: 10 }] },
      due: { overdue_count: 1, overdue_amount: 120000, next: [{ kind: 'bill', who: 'Sample Vendor', ref: 'B1', due: D(-3), amount: 120000 }, { kind: 'cheque', who: 'Sample Supplier', ref: 'C9', due: D(2), amount: 65000 }, { kind: 'bill', who: 'Sample Tiles', ref: 'T4', due: D(6), amount: 210000 }] },
      bills: [{ no: 'B-1014', t: '16:42', who: 'Sample Customer', total: 42500, pay: 'cash', profit: 9100, lines: [{ n: 'Basin mixer tap', q: 1, a: 32500 }, { n: 'PVC pipe 1 inch', q: 4, a: 10000 }] }, { no: 'B-1013', t: '15:10', who: '', total: 9800, pay: 'card', profit: 2400, lines: [{ n: 'Shower head', q: 2, a: 9800 }] }, { no: 'B-1012', t: '13:55', who: 'Sample Builder', total: 132200, pay: 'online', profit: 36700, lines: [{ n: 'Concealed cistern dual flush', q: 6, a: 54000 }, { n: 'Wall tile 30x60', q: 60, a: 78200 }] }],
      daily: daily,
      items: [['A1', 'Basin mixer tap', 2, 32500, 1], ['B2', 'PVC pipe 1 inch', 4, 2500, 2], ['C3', 'Wall tile 30x60', 220, 1300, 3], ['D4', 'Shower head', 0, 4900, 4], ['E5', 'Angle valve 1/2 inch', 3, 1800, 5], ['F6', 'Concealed cistern dual flush', 14, 9000, 6], ['G7', 'Thermostatic rain mixer', 5, 14000, 7], ['H8', 'Rimless wall-hung commode', 6, 48500, 8], ['J9', 'Floor drain matt black', 0, 3200, 9], ['K10', 'Brass pillar tap', 27, 12800, 10]],
      out_list: [{ code: 'D4', name: 'Shower head' }, { code: 'J9', name: 'Floor drain matt black' }],
      credit: { total: 275000, list: [{ who: 'Sample Builder', owed: 175000, oldest: D(-33) }, { who: 'Sample Contractor', owed: 100000, oldest: D(-4) }] },
      vendors: [{ who: 'Sample Vendor', owed: 120000, oldest: D(-3), bills: [{ ref: 'B1', due: D(-3), amount: 120000 }] }, { who: 'Sample Tiles', owed: 210000, oldest: D(6), bills: [{ ref: 'T4', due: D(6), amount: 210000 }] }],
      chq_cal: [{ who: 'Sample Supplier', ref: 'C9', due: D(2), wrote: D(-1), amount: 65000, st: 'W' }, { who: 'Sample Vendor', ref: 'C7', due: D(-2), wrote: D(-9), amount: 40000, st: 'W' }, { who: 'Sample Tiles', ref: 'C5', due: D(-6), wrote: D(-14), amount: 90000, st: 'C' }, { who: 'Sample Tiles', ref: 'C11', due: D(9), wrote: D(0), amount: 210000, st: 'W' }, { who: 'Sample Supplier', ref: 'C12', due: D(9), wrote: D(0), amount: 55000, st: 'W' }, { who: 'Sample Vendor', ref: 'C3', due: D(-11), wrote: D(-20), amount: 30000, st: 'B' }, { who: 'Sample Vendor', ref: 'C14', due: D(21), wrote: D(5), amount: 120000, st: 'W' }],
      cheques: [{ who: 'Sample Supplier', ref: 'C9', due: D(2), amount: 65000, status: 'pending' }, { who: 'Sample Vendor', ref: 'C7', due: D(-2), amount: 40000, status: 'held' }] };
  })();

  function show(which) { $('gate').hidden = which !== 'gate'; $('app').hidden = which !== 'app'; $('tabs').hidden = which !== 'app'; if (which !== 'app') closeSheet(); }
  function gateMsg(t) { $('gateMsg').textContent = t || ''; }

  // pairing link: https://<app>/#t=READ_TOKEN&w=https://<worker>.workers.dev
  function pairFromHash() {
    var h = (location.hash || '').replace(/^#/, ''); if (!h) return;
    var q = new URLSearchParams(h), t = q.get('t'), w = q.get('w');
    if (t && w && /^https:\/\//.test(w)) { LS.set('rbh_t', t); LS.set('rbh_w', w.replace(/\/+$/, '')); }
    history.replaceState(null, '', location.pathname + location.search);
  }

  function pairFromText(txt) {
    var i = String(txt || '').indexOf('#'); var h = i >= 0 ? txt.slice(i + 1) : String(txt || '').trim();
    var q = new URLSearchParams(h), t = q.get('t'), w = q.get('w');
    if (!(t && w && /^https:\/\//.test(w))) return false;
    LS.set('rbh_t', t); LS.set('rbh_w', w.replace(/\/+$/, '')); return true;
  }
  function pairLink() { var t = LS.get('rbh_t'), w = LS.get('rbh_w'); return (t && w) ? location.origin + location.pathname + '#t=' + encodeURIComponent(t) + '&w=' + encodeURIComponent(w) : ''; }
  function isHome() { return window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches); }
  function pairCard(box) {
    var link = pairLink(); if (!link || isHome()) return;
    var c = card('Home-screen app'), msg = el('div', 'note', 'The Home Screen icon needs the pairing link once. Copy it here, open the icon, paste it.');
    var b = el('button', 'gold wide', 'Copy pairing link'); b.style.marginTop = '10px';
    b.addEventListener('click', function () {
      (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { msg.textContent = 'Copied. Open the Home Screen icon and paste it.'; }, function () { msg.textContent = 'Could not copy. Press and hold the link below, then Copy.'; var t = el('input', 'inp'); t.value = link; t.readOnly = true; t.style.marginTop = '8px'; c.appendChild(t); });
    });
    c.appendChild(msg); c.appendChild(b); box.appendChild(c);
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
    if (ckey && ckeySalt === sealed.salt) { sealMeta = { salt: sealed.salt, iter: sealed.iter }; try { return await decryptWith(ckey, sealed); } catch (e) { ckey = null; } }
    if (!passcode) { var e2 = new Error('Please open again with your passcode.'); e2.needPass = true; throw e2; }
    ckey = await deriveKey(sealed, passcode); ckeySalt = sealed.salt; sealMeta = { salt: sealed.salt, iter: sealed.iter };
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
  function lock() { demoMode = (location.hash || '') === '#demo'; passcode = null; ckey = null; ckeySalt = null; snap = null; $('cards').textContent = ''; showGate(); }
  function showGate() { $('face').hidden = !faceOn(); show('gate'); }

  var demoMode = (location.hash || '') === '#demo';
  if (!demoMode) pairFromHash();
  $('unlock').addEventListener('click', open);
  $('face').addEventListener('click', openFace);
  // "Go": the showing-friends mode. Fake figures only, no network, no passcode, nothing real is opened. Lock returns to the gate.
  $('goDemo').addEventListener('click', function () { demoMode = true; snap = DEMO; tab = 'home'; render(DEMO); show('app'); });
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
  function pairUi() { var un = !LS.get('rbh_w'); $('pairBox').hidden = !un; if (un) $('gateText').textContent = 'Paste your pairing link once, then enter your passcode'; }
  $('pairBtn').addEventListener('click', function () {
    if (pairFromText($('pairIn').value)) { $('pairIn').value = ''; gateMsg('Paired. Now type your passcode.'); pairUi(); } else gateMsg('That is not the pairing link. Copy the whole link.');
  });
  pairUi();
  if (demoMode) document.addEventListener('DOMContentLoaded', function () { snap = DEMO; var q = /[?&]tab=(\w+)/.exec(location.search); if (q) tab = q[1]; render(DEMO); show('app'); }); else showGate();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(function () {});
})();
