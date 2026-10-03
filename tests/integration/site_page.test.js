'use strict';
// Website editor wiring + the public page in a real phone-size browser. Chromium parts skip themselves if Chromium is missing.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT, role TEXT, password_hash TEXT, active BOOLEAN DEFAULT true)`);
pg.__db.public.none(`INSERT INTO users (username, role) VALUES ('a', 'admin')`);
const app = require('../../server');
const root = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');

describe('wiring through the real server', () => {
  test('/site is public and is the saved website file', async () => {
    const r = await request(app).get('/site');
    expect(r.status).toBe(200); expect(r.text).toBe(read('public/website/index.html'));
  });
  test('the public feed needs no login; every edit route does', async () => {
    expect((await request(app).get('/api/site/public')).status).toBe(200);
    for (const [m, u] of [['get', '/api/site/tiles'], ['post', '/api/site/tiles'], ['put', '/api/site/tiles/1'], ['delete', '/api/site/tiles/1'], ['post', '/api/site/tiles/1/photo'], ['get', '/api/site/text'], ['put', '/api/site/text']]) {
      expect([401, 403]).toContain((await request(app)[m](u).send({})).status);
    }
  });
  test('the owner app still guards its private data', async () => {
    expect((await request(app).get('/api/document-inbox')).status).toBeGreaterThanOrEqual(401);
  });
  test('the website never links to /owner or the private API', () => {
    expect(read('public/website/index.html')).not.toMatch(/\/owner|bathco_complete|\/api\/(?!site\/public|site\/photo)/i);
  });
  test('owner app: dashboard Website button opens /site in a new tab; Website page exists', () => {
    const h = read('public/bathco_complete.html');
    expect(h).toMatch(/<a id="website-btn"[^>]*href="\/site"[^>]*target="_blank"/);
    expect(h).toContain('id="page-website"'); expect(h).toContain('data-page="website"'); expect(h).toContain('/website-editor.js');
    expect(h).toMatch(/id="we-view"[^>]*href="\/site"/);
    expect(h).toMatch(/confirm\(|website-editor/);
  });
  test('editor asks before deleting', () => { expect(read('public/website-editor.js')).toMatch(/confirm\('Delete/); });
});

let chrome = false; try { chrome = fs.existsSync(require('puppeteer').executablePath()); } catch (e) { /* none */ }
const web = chrome ? describe : describe.skip;

web('the public website in a phone-size browser', () => {
  let browser;
  const PIC = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  const html = read('public/website/index.html');
  beforeAll(async () => { browser = await require('puppeteer').launch({ headless: true, args: ['--no-sandbox'] }); }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });

  async function open(handler) {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) { /* none */ } });   // each test starts with an empty list and language
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', rq => {
      const u = new URL(rq.url());
      if (u.hostname === 'site.test' && u.pathname === '/site') return rq.respond({ status: 200, contentType: 'text/html', body: html });
      if (u.hostname === 'site.test' && u.pathname === '/api/site/public') return handler(rq);
      if (u.hostname === 'site.test' && u.pathname.startsWith('/api/site/photo/')) return rq.respond({ status: 200, contentType: 'image/png', body: PIC });
      return rq.abort();                                          // fonts etc: not needed
    });
    await page.goto('http://site.test/site', { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 400));
    return { page, errors };
  }
  const cards = page => page.$$eval('#grid .card', e => e.length);
  const noteShown = page => page.$eval('[data-t="sampleNote"]', e => getComputedStyle(e).display !== 'none');

  test.each([
    ['API down (connection fails)', rq => rq.abort('failed')],
    ['API error 500', rq => rq.respond({ status: 500, contentType: 'application/json', body: '{"error":"x"}' })],
    ['API returns no tiles', rq => rq.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({ tiles: [], text: { whatsapp: '', address: '', promise: {} } }) })],
    ['API returns garbage', rq => rq.respond({ status: 200, contentType: 'text/html', body: '<html>nope' })],
  ])('%s: the 10 built-in sample tiles show, nothing blank, no error', async (_n, handler) => {
    const { page, errors } = await open(handler);
    expect(await cards(page)).toBe(10); expect(await noteShown(page)).toBe(true);
    expect(await page.$$eval('#swatches .swatch', e => e.length)).toBeGreaterThanOrEqual(10);
    expect(errors).toEqual([]); await page.close();
  }, 60000);

  test('live tiles replace the samples; photo used; scale from size; note hidden; text set safely', async () => {
    const live = { tiles: [
      { id: 1, name: 'Photo Tile', size: '24 x 24 in', finish: 'glossy', group: 'stone', photoUrl: '/api/site/photo/aaaaaaaaaaaaaaaaaaaaaaaa.webp' },
      { id: 2, name: '<img src=x onerror="window.__hacked=1">', size: '100 x 100 cm', finish: 'matt', group: 'wall', photoUrl: null },
      { id: 3, name: 'Tiny', size: '3 x 6 in', finish: 'matt', group: 'wood', photoUrl: 'javascript:alert(1)' },
      { id: 4, name: 'No size', size: '', finish: 'matt', group: 'conc', photoUrl: null }],
      text: { whatsapp: '94711234567', address: '<b>12 Main St</b>', promise: { en: { h: 'Our <i>promise</i>', p: 'Fair prices.' }, si: { h: '', p: '' }, ta: { h: '', p: '' } } } };
    const { page, errors } = await open(rq => rq.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(live) }));
    expect(await cards(page)).toBe(4);
    expect(await noteShown(page)).toBe(false);
    const t = await page.evaluate(() => TILES.map(x => ({ n: x.n, f: x.f, w: x.w, photo: !!x.photo, bg: x.bg.slice(0, 40) })));
    expect(t[0]).toMatchObject({ n: 'Photo Tile', f: 168, w: 132, photo: true }); expect(t[0].bg).toContain('/api/site/photo/');
    expect(t[1].f).toBe(220); expect(t[1].w).toBe(170);                 // 100 x 7 -> clamped to 220, 100 x 5.5 -> clamped to 170
    expect(t[2].f).toBe(90); expect(t[2].w).toBe(70);                   // 3 x 7 = 21 -> 90, 3 x 5.5 = 16.5 -> 70
    expect(t[2].photo).toBe(false);                                     // unsafe photo address ignored: drawn texture kept
    expect(t[3].f).toBe(168);                                         // no size: assumes 24 in -> 168 (the v3 page's default)
    expect(await page.evaluate(() => window.__hacked)).toBeUndefined();
    expect(await page.$eval('#grid', e => e.innerHTML.includes('<img'))).toBe(false);
    expect(await page.$eval('#visit .big', e => e.textContent)).toBe('<b>12 Main St</b>');
    expect(await page.$eval('.promise h2', e => e.textContent)).toBe('Our <i>promise</i>');
    expect(await page.$eval('#visit a.num', e => e.href + '|' + e.textContent)).toBe('https://wa.me/94711234567|071 123 4567');
    expect(await page.$$eval('a[href*="wa.me"]', a => a.every(x => x.href.includes('94711234567')))).toBe(true);
    expect(errors).toEqual([]); await page.close();
  }, 60000);

  test('a live tile list without any photo keeps the "Sample designs" note', async () => {
    const live = { tiles: [{ id: 1, name: 'No photo', size: '12 x 12 in', finish: 'matt', group: 'stone', photoUrl: null }], text: { whatsapp: '', address: '', promise: {} } };
    const { page } = await open(rq => rq.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(live) }));
    expect(await cards(page)).toBe(1); expect(await noteShown(page)).toBe(true); await page.close();
  }, 60000);
  const twelve = () => ({ tiles: Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: 'Live Tile ' + (i + 1), size: i % 2 ? '12 x 24 in' : '24 x 24 in', finish: ['glossy', 'matt', 'polished'][i % 3], group: ['stone', 'wood', 'wall', 'conc'][i % 4], photoUrl: i < 3 ? '/api/site/photo/aaaaaaaaaaaaaaaaaaaaaaaa.webp' : null })),
    text: { whatsapp: '0711234567', address: 'New Road, Kandy', promise: { en: { h: 'EN head', p: 'EN para' }, si: { h: 'SI head', p: '' }, ta: { h: '', p: '' } } } });
  const json = o => rq => rq.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  const noSideways = page => page.evaluate(() => document.documentElement.scrollWidth <= 390 && window.innerWidth === 390);   // a phone widens its view when something overflows, so compare with the real 390

  test('12 live tiles render, calculator and list work, no sideways scroll on a phone', async () => {
    const { page, errors } = await open(json(twelve()));
    expect(await cards(page)).toBe(12);
    expect(await page.$$eval('#swatches .swatch:not(.plain)', e => e.length)).toBe(12);
    expect(await noSideways(page)).toBe(true);
    // calculator: 12 x 10 ft = 120 sq ft, +10%, 24x24 in tile = 4 sq ft -> ceil(132/4) = 33
    await page.select('#cT', '0');
    expect(await page.$eval('#cN', e => e.textContent)).toBe('33');
    await page.$eval('#cL', e => { e.value = '20'; e.dispatchEvent(new Event('input', { bubbles: true })); });   // 200 sq ft -> ceil(220/4) = 55
    expect(await page.$eval('#cN', e => e.textContent)).toBe('55');
    expect(await page.$eval('#cWa', e => e.href)).toContain('wa.me/94711234567');
    // list: add from calculator, count badge, quantity edit, remove
    await page.click('#cAdd');
    expect(await page.$eval('#listDlg', e => e.open)).toBe(true);
    expect(await page.$eval('#bkN', e => e.textContent)).toBe('1');
    expect(await page.$eval('#lBody .li input', e => e.value)).toBe('55');
    expect(await page.$eval('#lWa', e => decodeURIComponent(e.href))).toContain('Live Tile 1 (24 x 24 in) - about 55 tiles');
    await page.click('#lBody .li button.rm');
    expect(await page.$eval('#bkN', e => e.textContent)).toBe('');
    expect(await page.$eval('#lBody .empty', e => e.textContent.length > 0)).toBe(true);
    expect(errors).toEqual([]); await page.close();
  }, 60000);

  test('site text: number, address and promise per language, set as plain text; blank fields keep the built-in wording', async () => {
    const { page, errors } = await open(json(twelve()));
    expect(await page.evaluate(() => WA)).toBe('94711234567');
    expect(await page.$eval('#visit a.num', e => e.href + '|' + e.textContent)).toBe('https://wa.me/94711234567|071 123 4567');
    expect(await page.$$eval('a[href*="wa.me"]', a => a.every(x => x.href.includes('94711234567')))).toBe(true);
    expect(await page.$eval('#visit .big', e => e.textContent)).toBe('New Road, Kandy');
    expect(await page.$eval('.promise h2', e => e.textContent)).toBe('EN head');
    expect(await page.$eval('.promise p', e => e.textContent)).toBe('EN para');
    await page.click('.lang button[data-l="si"]');
    expect(await page.$eval('.promise h2', e => e.textContent)).toBe('SI head');
    expect(await page.$eval('.promise p', e => e.textContent)).toContain('බාත් හබ්');      // si paragraph blank: built-in Sinhala kept
    expect(await page.$eval('#visit .big', e => e.textContent)).toBe('New Road, Kandy');
    await page.click('.lang button[data-l="ta"]');
    expect(await page.$eval('.promise h2', e => e.textContent)).toBe('செலுத்தியதை விட சற்று அதிகம்.');   // ta blank: built-in Tamil kept
    expect(await noSideways(page)).toBe(true);
    expect(errors).toEqual([]); await page.close();
  }, 60000);

  test('a bad saved number is ignored: the built-in number stays', async () => {
    const o = twelve(); o.text.whatsapp = 'call me';
    const { page } = await open(json(o));
    expect(await page.evaluate(() => WA)).toBe('94777999219'); await page.close();
  }, 60000);

  test('API down: 10 samples, built-in number, no sideways scroll, list and calculator still work', async () => {
    const { page, errors } = await open(rq => rq.abort('failed'));
    expect(await cards(page)).toBe(10);
    expect(await noSideways(page)).toBe(true);
    expect(Number((await page.$eval('#cN', e => e.textContent)).replace(/,/g, ''))).toBeGreaterThan(0);
    expect(await page.$eval('#cWa', e => e.href)).toContain('wa.me/94777999219');
    await page.click('#cAdd'); expect(await page.$eval('#bkN', e => e.textContent)).toBe('1');
    expect(errors).toEqual([]); await page.close();
  }, 60000);
});
