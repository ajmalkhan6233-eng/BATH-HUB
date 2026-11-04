'use strict';
// public/bathhub.html is wired to /api/public/catalogue through bathhub-feed.js. The page's own script is run
// here against a stub DOM: sample tiles and SAMPLE_MODE stay while nothing is published; real tiles replace them
// (and SAMPLE_MODE goes off) once the feed has items; shop-entered names can't inject HTML.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const BathHubFeed = require('../../public/bathhub-feed');

const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'bathhub.html'), 'utf8');
const pageScript = [...html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');

function runPage(feedBody, { ok = true } = {}) {
  const els = {};
  const el = id => els[id] || (els[id] = new Proxy({ id, style: {}, children: [], appendChild() {}, setAttribute() {}, set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h || ''; } },
    { get: (t, k) => (k in t ? t[k] : (typeof k === 'string' ? undefined : undefined)), set: (t, k, v) => { t[k] = v; return true; } }));
  const calls = [];
  const ctx = {
    BathHubFeed,
    document: { getElementById: el, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, set innerHTML(v) {}, get innerHTML() { return ''; } }),
      querySelectorAll: () => [], documentElement: {} },
    addEventListener() {}, console,
    fetch: async (url) => { calls.push(url); return { ok, status: ok ? 200 : 503, json: async () => feedBody }; },
  };
  vm.createContext(ctx);
  global.fetch = ctx.fetch;            // the feed library looks up fetch in the module scope, as a browser would on window
  vm.runInContext(pageScript, ctx);
  return { ctx, els, calls, get: expr => vm.runInContext(expr, ctx), settle: () => new Promise(r => setTimeout(r, 20)) };
}

const realFetch = global.fetch;
afterEach(() => { global.fetch = realFetch; });

describe('bathhub.html wiring', () => {
  test('loads the feed script before the page script and starts in sample mode', () => {
    expect(html.indexOf('<script src="/bathhub-feed.js"></script>')).toBeGreaterThan(-1);
    expect(html.indexOf('/bathhub-feed.js')).toBeLessThan(html.indexOf('const API_BASE'));
    expect(html).toMatch(/let SAMPLE_MODE = true;/);
  });

  test('nothing published: asks the catalogue, keeps the sample tiles and SAMPLE_MODE true', async () => {
    const p = runPage({ items: [] });
    await p.settle();
    expect(p.calls).toEqual(['/api/public/catalogue']);
    expect(p.get('SAMPLE_MODE')).toBe(true);
    expect(p.get('tiles.length')).toBe(10);
    expect(p.get('tiles[0].name')).toMatch(/^Sample /);
  });

  test('feed down: still sample tiles, SAMPLE_MODE true, no crash', async () => {
    const p = runPage({}, { ok: false });
    await p.settle();
    expect(p.get('SAMPLE_MODE')).toBe(true);
    expect(p.get('tiles.length')).toBe(10);
  });

  test('real items replace the samples, SAMPLE_MODE turns off, tile shape matches the page', async () => {
    const p = runPage({ items: [
      { name: 'Marble Floor Tile', size_cm: '60x120', size_inches: '24x47', finish: 'Glossy', use: 'Bathroom floor', photo: '/api/item-photos/a.jpg' },
      { name: 'Wall Tile', size_cm: '30x60', size_inches: '12x24', finish: 'Nano polish', use: 'Wall, Kitchen', photo: null },
    ] });
    await p.settle();
    expect(p.get('SAMPLE_MODE')).toBe(false);
    expect(p.get('tiles.length')).toBe(2);
    expect(JSON.parse(p.get('JSON.stringify(tiles[0])'))).toMatchObject({ name: 'Marble Floor Tile', w: 60, h: 120, finish: 'glossy', use: ['floor', 'bathroom'], photo: '/api/item-photos/a.jpg', type: 'plain' });
    expect(JSON.parse(p.get('JSON.stringify(tiles[1])'))).toMatchObject({ w: 30, h: 60, finish: 'nano', use: ['wall', 'kitchen'] });
    expect(p.get('sel.name')).toBe('Marble Floor Tile');
    expect(p.els.spec.innerHTML).toContain('60 x 120 cm (24 x 47 in)');           // inches shown once, not twice
    expect(p.els.spec.innerHTML).not.toMatch(/in, 24 x 47 in/);
    expect(p.get('texture(tiles[0], 1)')).toBe('url("/api/item-photos/a.jpg")');          // the real photo is the texture
    expect(p.get('texture(tiles[1], 1)')).toMatch(/^url\("data:image\/svg/);               // no photo: generated texture
  });

  test('a shop-entered name with HTML is escaped in the page', async () => {
    const p = runPage({ items: [{ name: '<img src=x onerror=alert(1)> "Tile"', size_cm: '60x60', size_inches: '24x24', finish: 'Matt', use: 'Floor' }] });
    await p.settle();
    expect(p.els.spec.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(p.els.spec.innerHTML).not.toContain('<img');
  });

  test('prices never reach the page even if the server sent one', async () => {
    const p = runPage({ items: [{ name: 'Tile', size_cm: '60x60', selling_price: 4500, avg_cost: 2999 }] });
    await p.settle();
    expect(p.get('JSON.stringify(tiles)')).not.toMatch(/4500|2999|price|cost/i);
  });
});

describe('BathHubFeed.toPageTile', () => {
  test('unknown size/finish/use fall back safely', () => {
    const t = BathHubFeed.toPageTile({ name: 'Mystery', sizeCm: '', sizeInches: '', finish: '', use: '', photo: '' }, 3);
    expect(t).toMatchObject({ id: 'feed3', w: 60, h: 60, finish: 'matt', use: ['floor'], nom: '', photo: '' });
  });
  test('same name gets the same colours', () => {
    const a = BathHubFeed.toPageTile({ name: 'Same', sizeCm: '60x60', finish: '', use: '' }, 0);
    const b = BathHubFeed.toPageTile({ name: 'Same', sizeCm: '60x60', finish: '', use: '' }, 9);
    expect([a.base, a.vein]).toEqual([b.base, b.vein]);
  });
});
