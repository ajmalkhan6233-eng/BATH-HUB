/* RBH Pocket: offline bill queue (AJ 24 Nov). A bill is saved on the phone first, then posted to the shop mailbox oldest first.
   Each bill has ONE id made on the phone; the shop PC runs an id once, so a bill can never be made twice. Nothing hangs: every call has a time limit. */
(function (root) {
  'use strict';
  var KEY = 'rbh_queue', LIMIT_MS = 8000;
  function timeLimit(p, ms) { return new Promise(function (ok, no) { var t = setTimeout(function () { no(new Error('timeout')); }, ms); p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); no(e); }); }); }
  function make(d) {   // d: { LS:{get,set}, toShop(cmd) -> id, fromShop(id) -> answer|null, now() }
    var now = d.now || Date.now, LIM = d.limit || LIMIT_MS;
    function load() { try { var q = JSON.parse(d.LS.get(KEY) || '[]'); return Array.isArray(q) ? q : []; } catch (e) { return []; } }
    function save(q) { d.LS.set(KEY, JSON.stringify(q)); }
    function add(cmd, label, id) { var q = load(); cmd.id = id; q.push({ id: id, at: now(), label: label || '', cmd: cmd, posted: false, answer: null }); save(q); return q; }
    function remove(id) { save(load().filter(function (x) { return x.id !== id; })); }
    // one pass: post what is not posted (oldest first), ask for answers of what is posted. Never throws, never waits more than the limit per call.
    async function tick() {
      var q = load(), i, it;
      for (i = 0; i < q.length; i++) {
        it = q[i];
        if (!it.posted) { try { await timeLimit(d.toShop(it.cmd), LIM); it.posted = true; it.err = ''; } catch (e) { it.err = e.message || 'not sent'; break; } }   // stop at the first failure: oldest stays first
        if (it.posted && !it.answer) { try { var a = await timeLimit(d.fromShop(it.id), LIM); if (a) it.answer = a; } catch (e) { /* PC off or no signal: ask again next time */ } }
      }
      save(q); return q;
    }
    return { load: load, add: add, remove: remove, tick: tick };
  }
  var api = { make: make };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RBHQ = api;
})(typeof window !== 'undefined' ? window : this);
