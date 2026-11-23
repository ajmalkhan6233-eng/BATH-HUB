/* RBH Pocket: ONE date helper. Every screen shows a date the same way: "Fri 25 Dec 2026 · in 32 days".
   Dates are plain YYYY-MM-DD text (Sri Lanka day, already worked out on the shop PC). Nothing here shifts a time zone, so no double shift. */
(function (g) {
  'use strict';
  var DW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ok = function (k) { return /^\d{4}-\d{2}-\d{2}/.test(String(k || '')); };
  function nice(k) {                       // "Fri 25 Dec 2026"
    if (!ok(k)) return 'no date'; k = String(k).slice(0, 10);
    return DW[new Date(k + 'T00:00:00Z').getUTCDay()] + ' ' + parseInt(k.slice(8), 10) + ' ' + MN[parseInt(k.slice(5, 7), 10) - 1] + ' ' + k.slice(0, 4);
  }
  function left(k, today) {                // "in 32 days" / "today" / "3 days ago"
    if (!ok(k)) return ''; var n = Math.round((Date.parse(String(k).slice(0, 10)) - Date.parse(today)) / 86400000);
    return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : Math.abs(n) + ' days ago';
  }
  function full(k, today) { return ok(k) ? nice(k) + ' · ' + left(k, today) : 'no date'; }
  function todayOf(s) { return new Date(Date.parse(s.at) + 5.5 * 3600e3).toISOString().slice(0, 10); }   // shifted ONCE, read with toISOString
  var api = { nice: nice, left: left, full: full, today: todayOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else g.RBHD = api;
})(typeof window !== 'undefined' ? window : globalThis);
