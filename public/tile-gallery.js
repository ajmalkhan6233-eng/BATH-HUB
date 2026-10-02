/* Tile Gallery (owner app, page #/tilegallery): read-only pictures of real tiles from public/tiles/.
   Names only, never a price. No database, no API: the pictures are files, saved for offline use by the service worker. */
(function () {
  const TILES = [
    { file: 'stone-beige', name: 'Stone beige', note: 'Stone-effect tile' },
    { file: 'stone-pink', name: 'Stone pink', note: 'Stone-effect tile' },
    { file: 'stone-grey', name: 'Stone grey', note: 'Rock-effect tile' },
  ];
  let built = false;
  function build() {
    const grid = document.getElementById('tg-grid'), dlg = document.getElementById('tg-dlg');
    if (!grid || built) return;
    built = true;
    TILES.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'tg-card'; b.setAttribute('aria-label', t.name + ' - larger picture');
      const img = document.createElement('img');
      img.src = '/tiles/' + t.file + '-thumb.webp'; img.alt = t.name; img.loading = 'lazy'; img.width = 200; img.height = 200;
      const n = document.createElement('div'); n.className = 'tg-name'; n.textContent = t.name;
      const s = document.createElement('div'); s.className = 'tg-note'; s.textContent = t.note;
      b.append(img, n, s);
      b.onclick = () => {
        document.getElementById('tg-big').src = '/tiles/' + t.file + '.webp';
        document.getElementById('tg-big').alt = t.name;
        document.getElementById('tg-title').textContent = t.name;
        if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      };
      grid.append(b);
    });
    document.getElementById('tg-close').onclick = () => (dlg.close ? dlg.close() : dlg.removeAttribute('open'));
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  }
  window.loadTileGallery = build;
})();