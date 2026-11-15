/* layla-commands.js (15 Nov, AJ: "one Layla chat that runs the other tabs by talking"). Step 1+2: Layla OPENS a tab or reads out the rules when told. Read-only: never changes data.
   Own module: only this file + one line in layla-owner.html. Roll back: delete the script line. */
(function (root) {
  var TABS = [
    ['assistant', 'AI Assistant', /\b(ai )?assistant\b/], ['brain', 'Brain', /\bbrain\b/], ['morningbrief', 'Morning Brief', /\bmorning( brief)?\b|\bbrief\b/],
    ['agentreview', 'Agent Review', /\bagent review\b|\breview\b/], ['agent-rules', 'Agent Rules', /\bagent rules?\b|\brules?\b|\brulebook\b/],
    ['dueboard', 'Due Board', /\bdue board\b|\bdue\b/], ['adminaudit', 'Audit Log', /\baudit( log)?\b/],
    ['grn', 'GRN', /\bgrn\b/], ['pos', 'POS', /\bpos\b/], ['dailyledger', 'Daily Ledger', /\bdaily ledger\b|\bledger\b/], ['stockmgr', 'Stock & items', /\bstock\b|\bitems\b/],
    ['chequereg', 'Cheque register', /\bcheque register\b/], ['cheques', 'Cheques', /\bcheques?\b/], ['dashboard', 'Home', /\bhome\b|\bdashboard\b/]
  ];
  var OPEN = /^\s*(please\s+)?(open|go to|take me to|switch to|bring up)\s+(the\s+|my\s+)?/i;
  function match(text) {
    var t = String(text || '').toLowerCase().trim(); if (!OPEN.test(t)) return null;
    var rest = t.replace(OPEN, '');
    for (var i = 0; i < TABS.length; i++) if (TABS[i][2].test(rest)) return { key: TABS[i][0], name: TABS[i][1] };
    return null;
  }
  function rulesAsk(text) { return /\b(what|read|tell).*\b(rules?|rulebook)\b/i.test(String(text || '')); }
  function openTab(key) { try { if (root.parent && root.parent !== root && typeof root.parent.navigate === 'function') { root.parent.navigate(key); return true; } } catch (e) { /* cross-frame blocked */ } return false; }
  // handle(text, say) -> true when Layla answered it herself, false to let the normal chat run.
  function handle(text, say) {
    var m = match(text);
    if (m) { if (openTab(m.key)) { say('Opening ' + m.name + '.'); return true; } say('I cannot open ' + m.name + ' from here. Use the menu: ' + m.name + '.'); return true; }
    if (rulesAsk(text) && root.fetch) {
      root.fetch('/api/agent/rulebook', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.text() : ''; }).then(function (t) {
        var lines = String(t || '').split('\n').filter(function (x) { return x.trim(); }).slice(0, 8);
        say(lines.length ? 'Your rules (first ' + lines.length + '):\n' + lines.join('\n') + '\nSay "open agent rules" to see all.' : 'I could not read the rules just now. Say "open agent rules".');
      }).catch(function () { say('I could not read the rules just now. Say "open agent rules".'); });
      return true;
    }
    return false;
  }
  var api = { match: match, handle: handle };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.LaylaCmd = api;
})(typeof window !== 'undefined' ? window : this);
