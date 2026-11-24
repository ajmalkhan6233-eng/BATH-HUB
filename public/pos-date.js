/* POS date box (AJ 24 Nov). Own module: remove the tag and the date box is the plain typed box again.
   ONE date box (#saleDate, dd/mm/yyyy, defaults to today). Tapping it opens a small calendar picker (no long list);
   two chips next to it: Today, Yesterday. Typing a date still works, so back-dating stays possible (the server keeps the owner/admin rule). */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var sd = $('saleDate'), pk = $('salePick'); if (!sd || !pk) return;
  var A = window.Pos2Api || {};
  function today() { return A.todayISO ? A.todayISO() : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Colombo' }); }
  function dmy(i) { return A.isoToDMY ? A.isoToDMY(i) : String(i).split('-').reverse().join('/'); }
  function iso(s) { return A.dmyToISO ? A.dmyToISO(s) : null; }
  function ago(n) { return new Date(Date.parse(today() + 'T00:00:00Z') - n * 86400000).toISOString().slice(0, 10); }
  function sync() {
    var i = iso(sd.value) || ''; pk.max = today(); pk.value = i;
    [].forEach.call(document.querySelectorAll('.datechip'), function (c) { c.classList.toggle('on', i !== '' && i === ago(Number(c.getAttribute('data-ago')))); });
  }
  function setISO(i) {
    sd.value = dmy(i);
    sd.dispatchEvent(new Event('input', { bubbles: true })); sd.dispatchEvent(new Event('change', { bubbles: true })); sync();
  }
  [].forEach.call(document.querySelectorAll('.datechip'), function (c) { c.addEventListener('click', function () { setISO(ago(Number(c.getAttribute('data-ago')))); }); });
  sd.addEventListener('click', function () { pk.max = today(); try { if (pk.showPicker) pk.showPicker(); } catch (e) { /* the typed box still works */ } });
  pk.addEventListener('change', function () { if (pk.value) setISO(pk.value); });
  sd.addEventListener('input', sync);
  setInterval(sync, 1500);   // the screen resets the box after each bill without an event
  sync();
})();
