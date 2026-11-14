/* SPEED: slow background checkers (every 30 s or longer: badges, alerts, inbox, dashboard refresh) skip their turn while the app
   is hidden (phone locked, another tab). They run again on their next turn once you are back. Short timers and screens inside frames are untouched.
   Remove the one <script> line in bathco_complete.html to turn it off. */
(function () {
  var si = window.setInterval;
  window.setInterval = function (fn, ms) {
    if (typeof fn === 'function' && ms >= 30000) {
      var rest = Array.prototype.slice.call(arguments, 2);
      return si.call(window, function () { if (document.hidden) return; return fn.apply(this, rest); }, ms);
    }
    return si.apply(window, arguments);
  };
})();
