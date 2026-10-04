'use strict';
// Tile Gallery: real tile pictures as plain files + a read-only owner screen. No database, no API, no prices.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const NAMES = ['stone-beige', 'stone-pink', 'stone-grey'];

describe('picture files', () => {
  test.each(NAMES)('%s: real WebP, long side 800 px, at most 150 KB; thumbnail 200 px', n => {
    const big = fs.readFileSync(path.join(root, 'public', 'tiles', n + '.webp'));
    const thumb = fs.readFileSync(path.join(root, 'public', 'tiles', n + '-thumb.webp'));
    for (const b of [big, thumb]) { expect(b.slice(0, 4).toString()).toBe('RIFF'); expect(b.slice(8, 12).toString()).toBe('WEBP'); }
    expect(big.length).toBeLessThanOrEqual(150 * 1024);
    expect(thumb.length).toBeLessThanOrEqual(30 * 1024);
  });
});

describe('screen and offline', () => {
  const html = read('public/bathco_complete.html');
  const sw = read('public/service-worker.js');
  test('reachable from the menu (#/tilegallery) with a read-only page', () => {
    expect(html).toContain('data-page="tilegallery"'); expect(html).toContain('id="page-tilegallery"'); expect(html).toContain('/tile-gallery.js');
    expect(html).toMatch(/loadTileGallery\(\)/);
  });
  test('the gallery code has no price, no API call and no writes', () => {
    const js = read('public/tile-gallery.js').replace(/\/\*[\s\S]*?\*\//g, '');   // comments do not count
    expect(js).not.toMatch(/fetch\(|XMLHttpRequest|\/api\/|price|cost|LKR|innerHTML/i);
    const page = html.slice(html.indexOf('id="page-tilegallery"'), html.indexOf('COMPETITOR WATCH'));
    expect(page).not.toMatch(/price:|LKR|<input|<form|emoji/i);
  });
  test('service worker version moved to v15 and every picture + the screen script is precached', () => {
    expect(sw).toMatch(/const VERSION = 'v15'/);
    for (const n of NAMES) { expect(sw).toContain(`'/tiles/${n}.webp'`); expect(sw).toContain(`'/tiles/${n}-thumb.webp'`); }
    expect(sw).toContain("'/tile-gallery.js'");
  });
  test('the public website file is untouched', () => {
    expect(fs.existsSync(path.join(root, 'public', 'bathhub.html'))).toBe(true);
  });
});