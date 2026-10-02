/* Website editor (owner app, page #/website): tiles and site text for the public website at /site.
   One module: talks only to /api/site/* (owner login required there). */
(function () {
  const $ = id => document.getElementById(id);
  const MAX = 5 * 1024 * 1024, TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const GROUP_LABEL = { stone: 'Stone look', wood: 'Wood look', wall: 'Wall and mosaic', conc: 'Concrete and terrazzo' };
  let tiles = [], editing = null;                       // editing: tile id, 0 = new tile, null = form closed

  async function api(url, opts) {
    const r = await fetch(url, Object.assign({ credentials: 'include' }, opts || {}));
    let body = null; try { body = await r.json(); } catch (e) { /* no body */ }
    if (!r.ok) throw new Error((body && body.error) || ('Something went wrong (' + r.status + ')'));
    return body;
  }
  const say = (id, msg, bad) => { const e = $(id); if (!e) return; e.textContent = msg || ''; e.style.color = bad ? 'var(--red)' : 'var(--green)'; };

  function row(t) {
    const d = document.createElement('div');
    d.className = 'we-row'; d.dataset.id = t.id;
    d.style.cssText = 'display:flex;gap:12px;align-items:center;padding:12px 0;border-bottom:1px solid var(--card-border)';
    const img = document.createElement('div');
    img.style.cssText = 'width:56px;height:56px;border-radius:8px;flex:none;background:var(--card);border:1px solid var(--card-border);background-size:cover;background-position:center';
    if (t.photoUrl) img.style.backgroundImage = 'url("' + t.photoUrl + '")';
    const mid = document.createElement('div'); mid.style.cssText = 'flex:1;min-width:0';
    const n = document.createElement('div'); n.style.cssText = 'font-weight:700;font-size:15px'; n.textContent = t.name;
    const s = document.createElement('div'); s.style.cssText = 'font-size:12px;color:var(--text2)';
    s.textContent = [t.size, t.finish, GROUP_LABEL[t.group] || t.group, t.visible ? 'shown' : 'HIDDEN', t.photoUrl ? 'photo' : 'no photo'].filter(Boolean).join(' · ');
    mid.append(n, s);
    const b = document.createElement('button'); b.className = 'btn btn-s'; b.type = 'button'; b.textContent = 'Edit';
    b.style.minHeight = '44px'; b.onclick = () => openForm(t.id);
    d.append(img, mid, b);
    return d;
  }
  function drawList() {
    const box = $('we-tiles'); if (!box) return;
    box.textContent = '';
    if (!tiles.length) { const p = document.createElement('div'); p.style.cssText = 'color:var(--text2);padding:8px 0'; p.textContent = 'No tiles yet. The website shows its sample designs until you add one.'; box.append(p); return; }
    tiles.forEach(t => box.append(row(t)));
  }
  async function loadTiles() {
    try { tiles = await api('/api/site/tiles'); drawList(); say('we-msg', ''); }
    catch (e) { say('we-msg', e.message, true); }
  }

  function openForm(id) {
    editing = id;
    const t = id ? tiles.find(x => x.id === id) : null;
    $('we-form').style.display = '';
    $('we-form-title').textContent = t ? 'Edit tile' : 'Add a tile';
    $('we-name').value = t ? t.name : ''; $('we-size').value = t ? t.size : '';
    $('we-finish').value = t ? t.finish : 'matt'; $('we-group').value = t ? t.group : 'stone';
    $('we-visible').checked = t ? t.visible : true; $('we-photo').value = '';
    $('we-delete').style.display = t ? '' : 'none';
    $('we-rmphoto').style.display = t && t.photoUrl ? '' : 'none';
    const pv = $('we-preview'); pv.style.backgroundImage = t && t.photoUrl ? 'url("' + t.photoUrl + '")' : 'none'; pv.style.display = t && t.photoUrl ? '' : 'none';
    say('we-fmsg', ''); $('we-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeForm() { editing = null; $('we-form').style.display = 'none'; }

  async function saveTile() {
    const file = $('we-photo').files[0];
    if (file && !TYPES.includes(file.type)) return say('we-fmsg', 'Photo must be a JPG, PNG or WebP.', true);
    if (file && file.size > MAX) return say('we-fmsg', 'That photo is bigger than 5 MB. Choose a smaller one.', true);
    const body = { name: $('we-name').value, size: $('we-size').value, finish: $('we-finish').value, group: $('we-group').value, visible: $('we-visible').checked };
    if (!body.name.trim()) return say('we-fmsg', 'Type the tile name first.', true);
    $('we-save').disabled = true; say('we-fmsg', 'Saving...');
    try {
      const saved = await api(editing ? '/api/site/tiles/' + editing : '/api/site/tiles', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (file) {
        const fd = new FormData(); fd.append('photo', file);
        try { await api('/api/site/tiles/' + saved.id + '/photo', { method: 'POST', body: fd }); }
        catch (e) { await loadTiles(); editing = saved.id; return say('we-fmsg', 'Tile saved, but the photo failed: ' + e.message, true); }
      }
      await loadTiles(); closeForm(); say('we-msg', 'Saved. Open the website to see it.');
    } catch (e) { say('we-fmsg', e.message, true); }
    finally { $('we-save').disabled = false; }
  }
  async function deleteTile() {
    const t = tiles.find(x => x.id === editing); if (!t) return;
    if (!confirm('Delete "' + t.name + '" from the website? Its photo is deleted too. This cannot be undone.')) return;
    try { await api('/api/site/tiles/' + t.id, { method: 'DELETE' }); await loadTiles(); closeForm(); say('we-msg', 'Deleted.'); }
    catch (e) { say('we-fmsg', e.message, true); }
  }
  async function removePhoto() {
    if (!confirm('Remove this photo? The website goes back to the drawn texture for this tile.')) return;
    try { await api('/api/site/tiles/' + editing + '/photo', { method: 'DELETE' }); await loadTiles(); openForm(editing); say('we-fmsg', 'Photo removed.'); }
    catch (e) { say('we-fmsg', e.message, true); }
  }

  const TEXT_FIELDS = ['we-wa', 'we-addr', 'we-hen', 'we-pen', 'we-hsi', 'we-psi', 'we-hta', 'we-pta'];
  async function loadText() {
    try {
      const t = await api('/api/site/text');
      $('we-wa').value = t.whatsapp ? '0' + t.whatsapp.replace(/^94/, '') : ''; $('we-addr').value = t.address;
      ['en', 'si', 'ta'].forEach(l => { $('we-h' + l).value = t.promise[l].h; $('we-p' + l).value = t.promise[l].p; });
    } catch (e) { say('we-tmsg', e.message, true); }
  }
  async function saveText() {
    const body = { whatsapp: $('we-wa').value, address: $('we-addr').value, promise: {} };
    ['en', 'si', 'ta'].forEach(l => { body.promise[l] = { h: $('we-h' + l).value, p: $('we-p' + l).value }; });
    say('we-tmsg', 'Saving...');
    try { await api('/api/site/text', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); say('we-tmsg', 'Saved. Open the website to see it.'); }
    catch (e) { say('we-tmsg', e.message, true); }
  }

  let wired = false;
  window.loadWebsiteEditor = function () {
    if (!wired && $('we-save')) {
      wired = true;
      $('we-add').onclick = () => openForm(0); $('we-cancel').onclick = closeForm; $('we-save').onclick = saveTile;
      $('we-delete').onclick = deleteTile; $('we-rmphoto').onclick = removePhoto; $('we-tsave').onclick = saveText;
    }
    loadTiles(); loadText();
  };
})();