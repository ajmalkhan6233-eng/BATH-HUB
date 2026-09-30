'use strict';
// The website feed loader: sample tiles stay until real items exist; never throws; no prices ever shown.
const { load, toTile, ENDPOINT } = require('../../public/bathhub-feed');

const sample = [{ name: 'Sample tile', sample: true }];
const ok = body => async () => ({ ok: true, status: 200, json: async () => body });

describe('BathHubFeed.load', () => {
  test('uses the public catalogue endpoint', async () => {
    const calls = [];
    await load({ sampleTiles: sample, fetchImpl: async (url) => { calls.push(url); return { ok: true, json: async () => ({ items: [] }) }; } });
    expect(ENDPOINT).toBe('/api/public/catalogue');
    expect(calls).toEqual(['/api/public/catalogue']);
  });

  test('nothing published yet -> sample tiles, sample mode stays ON', async () => {
    const r = await load({ sampleTiles: sample, fetchImpl: ok({ items: [] }) });
    expect(r).toEqual({ tiles: sample, sample: true });
  });

  test('real items -> only real tiles (no samples mixed in), sample mode OFF', async () => {
    const r = await load({ sampleTiles: sample, fetchImpl: ok({ items: [
      { name: 'Marble Floor Tile', size_cm: '60x60', size_inches: '24x24', finish: 'Glossy', use: 'Bathroom floor', photo: '/api/item-photos/a.jpg' },
    ] }) });
    expect(r.sample).toBe(false);
    expect(r.tiles).toHaveLength(1);
    expect(r.tiles[0]).toMatchObject({ name: 'Marble Floor Tile', size: '60 x 60 cm (24 x 24 in)', finish: 'Glossy', use: 'Bathroom floor', photo: '/api/item-photos/a.jpg', image: '/api/item-photos/a.jpg', sample: false });
  });

  test('photos get the API base when the site is hosted elsewhere', async () => {
    const r = await load({ apiBase: 'https://shop.example', sampleTiles: sample, fetchImpl: async (url) => {
      expect(url).toBe('https://shop.example/api/public/catalogue');
      return { ok: true, json: async () => ({ items: [{ name: 'Tap', photo: '/api/item-photos/t.png' }] }) };
    } });
    expect(r.tiles[0].photo).toBe('https://shop.example/api/item-photos/t.png');
  });

  test('failures never throw: network error, bad status, bad JSON -> sample tiles with an error note', async () => {
    const a = await load({ sampleTiles: sample, fetchImpl: async () => { throw new Error('offline'); } });
    expect(a).toMatchObject({ tiles: sample, sample: true, error: 'offline' });
    const b = await load({ sampleTiles: sample, fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }) });
    expect(b).toMatchObject({ tiles: sample, sample: true });
    const c = await load({ sampleTiles: sample, fetchImpl: async () => ({ ok: true, json: async () => { throw new Error('bad json'); } }) });
    expect(c.sample).toBe(true);
    const d = await load({ sampleTiles: sample, fetchImpl: ok({ nothing: true }) });
    expect(d).toEqual({ tiles: sample, sample: true });
  });

  test('junk entries are ignored', async () => {
    const r = await load({ sampleTiles: sample, fetchImpl: ok({ items: [null, 5, { name: '  ' }, { name: 'Good tile', size_cm: '30x60', size_inches: '12x24' }] }) });
    expect(r.tiles.map(t => t.name)).toEqual(['Good tile']);
    expect(r.sample).toBe(false);
  });

  test('a tile never carries a price, cost or stock even if the server were to send one', () => {
    const t = toTile({ name: 'X', size_cm: '60x60', selling_price: 4500, avg_cost: 2999, stock_level: 10, margin: 40 });
    expect(Object.keys(t).sort()).toEqual(['finish', 'image', 'name', 'photo', 'sample', 'size', 'sizeCm', 'sizeInches', 'use']);
    expect(JSON.stringify(t)).not.toMatch(/4500|2999|stock|margin|cost|price/i);
  });
});
