(function () {
  fetch('/api/assistant/whoami', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => { if (d && d.owner === true) start(); })
    .catch(() => {});

  function start() {
    var box = document.createElement('div');
    box.innerHTML =
      '<button id="bh-ai-btn" title="Ask Bath Hub assistant">\u{1F4AC}</button>' +
      '<div id="bh-ai-panel"><div class="h"><span>Bath Hub Assistant</span><span id="bh-ai-x" style="cursor:pointer">✕</span></div>' +
      '<div class="b" id="bh-ai-body"><div class="m a">Hello! Ask me about shop rules, prices or cheques.</div></div>' +
      '<div class="f"><input id="bh-ai-in" placeholder="Type your question"><button id="bh-ai-send">Send</button></div></div>';
    document.body.appendChild(box);
    var panel = document.getElementById('bh-ai-panel');
    var body = document.getElementById('bh-ai-body');
    var input = document.getElementById('bh-ai-in');
    document.getElementById('bh-ai-btn').onclick = function () { panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; };
    document.getElementById('bh-ai-x').onclick = function () { panel.style.display = 'none'; };
    function add(t, c) { var d = document.createElement('div'); d.className = 'm ' + c; d.textContent = t; body.appendChild(d); body.scrollTop = body.scrollHeight; }
    function send() {
      var q = input.value.trim(); if (!q) return;
      add(q, 'u'); input.value = '';
      fetch('/api/assistant/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q }) })
        .then(r => r.json()).then(d => add(d.reply || d.error || 'No reply.', 'a'))
        .catch(() => add('The assistant is taking longer than expected to reply or internet is down. Please try again in a moment.', 'a'));
    }
    document.getElementById('bh-ai-send').onclick = send;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') send(); });
  }
})();
