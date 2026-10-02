/* attach-widget.js: ONE shared widget: [Take photo] [Upload file] [Download] for any record.
   Use:  <div data-attach="stock" data-attach-id="general"></div>   (auto-mounted)   or   AttachWidget.mount(el, { type, id })
   data-attach-id may be "@today" (today's date) or "@month" (this month).
   Files go to /api/attachments (login required, 10 MB, photos / PDF / xlsx / csv). The upload step is replaceable:
   AttachWidget.setUploader(async (file, meta) => result) lets the offline queue take over without changing the screens. */
(function () {
  'use strict';
  var MAX = 10 * 1024 * 1024;
  var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var kb = function (n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; };
  var css = '.aw{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:13px;margin:6px 0}' +
    '.aw button{font:inherit;padding:5px 10px;border-radius:8px;border:1px solid var(--card-border,#c9bfae);background:var(--card,#fff);color:inherit;cursor:pointer}' +
    '.aw button:hover{filter:brightness(1.1)}.aw .aw-msg{font-size:12px;opacity:.85}.aw .aw-err{color:#c62828}' +
    '.aw-list{flex-basis:100%;margin:4px 0 0;padding:0;list-style:none;font-size:12px}' +
    '.aw-list li{display:flex;gap:8px;justify-content:space-between;align-items:center;padding:4px 0;border-top:1px solid var(--card-border,#e5dfd2)}' +
    '.aw-list a{color:inherit;font-weight:600}';
  var styled = false;
  function addCss() { if (styled) return; styled = true; var s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }

  function resolveId(id) {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    if (id === '@today') return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    if (id === '@month') return d.getFullYear() + '-' + p(d.getMonth() + 1);
    return String(id == null || id === '' ? 'general' : id);
  }

  // default uploader: straight to the server. Returns the saved attachment, or throws Error(message).
  var uploader = async function (file, meta) {
    var fd = new FormData();
    fd.append('record_type', meta.type); fd.append('record_id', meta.id);
    if (meta.clientUuid) fd.append('client_uuid', meta.clientUuid);
    fd.append('file', file, file.name || 'photo.jpg');
    var r = await fetch('/api/attachments', { method: 'POST', body: fd });
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(j.error || ('Upload failed (' + r.status + ')'));
    return j;
  };

  function mount(el, opts) {
    addCss();
    var state = { type: opts.type, id: resolveId(opts.id), open: false, files: [] };
    el.__aw = state; el.classList.add('aw');
    el.innerHTML = '<button type="button" data-a="photo">📷 Take photo</button><button type="button" data-a="upload">⬆ Upload file</button>' +
      '<button type="button" data-a="dl">⬇ Download</button><span class="aw-msg"></span><ul class="aw-list" hidden></ul>' +
      '<input type="file" accept="image/*" capture="environment" hidden data-i="photo"><input type="file" accept="image/*,application/pdf,.pdf,.xlsx,.csv" hidden data-i="upload">';
    var msg = el.querySelector('.aw-msg'), list = el.querySelector('.aw-list');
    function say(t, bad) { msg.textContent = t || ''; msg.className = 'aw-msg' + (bad ? ' aw-err' : ''); }
    async function refresh() {
      try {
        var r = await fetch('/api/attachments?record_type=' + encodeURIComponent(state.type) + '&record_id=' + encodeURIComponent(state.id));
        if (!r.ok) { state.files = []; return render(); }
        state.files = await r.json();
      } catch (e) { /* offline: keep what we have */ }
      render();
    }
    function render() {
      el.querySelector('[data-a=dl]').textContent = '⬇ Download' + (state.files.length ? ' (' + state.files.length + ')' : '');
      list.hidden = !state.open;
      if (!state.open) return;
      list.innerHTML = state.files.length
        ? state.files.map(function (f) { return '<li><span>' + esc(f.filename) + ' <span style="opacity:.7">' + kb(f.size) + '</span></span><a href="' + esc(f.download_url) + '" download>Download</a></li>'; }).join('') +
          '<li><span></span><a href="/api/attachments/zip?record_type=' + encodeURIComponent(state.type) + '&record_id=' + encodeURIComponent(state.id) + '">Download all as .zip</a></li>'
        : '<li><span>No files attached here yet.</span></li>';
    }
    async function send(file) {
      if (!file) return;
      if (file.size > MAX) return say('That file is bigger than 10 MB.', true);
      say('Uploading ' + (file.name || 'photo') + '…');
      try {
        var res = await uploader(file, { type: state.type, id: state.id, clientUuid: (self.crypto && crypto.randomUUID) ? crypto.randomUUID() : null });
        say(res && res.queued ? 'Saved on this device. Waiting to sync.' : 'Attached.');
        await refresh();
      } catch (e) { say(e.message, true); }
    }
    el.addEventListener('click', function (ev) {
      var b = ev.target.closest('button[data-a]'); if (!b) return;
      var a = b.getAttribute('data-a');
      if (a === 'photo') el.querySelector('[data-i=photo]').click();
      else if (a === 'upload') el.querySelector('[data-i=upload]').click();
      else { state.open = !state.open; if (state.open) refresh(); else render(); }
    });
    el.addEventListener('change', function (ev) { var i = ev.target; if (i.matches && i.matches('input[type=file]')) { send(i.files[0]); i.value = ''; } });
    el.__awRefresh = refresh;
    refresh();
    return el;
  }

  function setRecord(el, id) { if (el.__aw) { el.__aw.id = resolveId(id); el.__awRefresh(); } }
  function scan(root) {
    (root || document).querySelectorAll('[data-attach]').forEach(function (el) {
      if (!el.__aw) mount(el, { type: el.getAttribute('data-attach'), id: el.getAttribute('data-attach-id') });
    });
  }
  window.AttachWidget = { mount: mount, scan: scan, setRecord: setRecord, setUploader: function (fn) { uploader = fn; }, resolveId: resolveId };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { scan(); }); else scan();
})();