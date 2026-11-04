'use strict';
// Website v4: robots/sitemap, share-preview tags, print CSS, light page, and the public catalogue PDF.
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const os = require('os');
const fs = require('fs');
const path = require('path');
process.env.SITE_CACHE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'site-cat-'));
const request = require('supertest');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT, role TEXT, password_hash TEXT, active BOOLEAN DEFAULT true)`);
pg.__db.public.none(`INSERT INTO users (username, role) VALUES ('a', 'admin')`);
const app = require('../../server');
const root = path.join(__dirname, '..', '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const html = read('public/website/index.html');

describe('robots.txt and sitemap.xml (public, no login)', () => {
  afterEach(() => { delete process.env.SITE_URL; });
  test('robots.txt allows the site, blocks the API and owner app, points at the sitemap', async () => {
    process.env.SITE_URL = 'https://shop.example.lk/';
    const r = await request(app).get('/robots.txt');
    expect(r.status).toBe(200); expect(r.type).toBe('text/plain');
    expect(r.text).toMatch(/Allow: \/site/); expect(r.text).toMatch(/Disallow: \/api\//); expect(r.text).toMatch(/Disallow: \/owner/);
    expect(r.text).toContain('Sitemap: https://shop.example.lk/sitemap.xml');
  });
  test('sitemap.xml lists the one public page with a full address', async () => {
    process.env.SITE_URL = 'https://shop.example.lk';
    const r = await request(app).get('/sitemap.xml');
    expect(r.status).toBe(200); expect(r.type).toMatch(/xml/);
    expect(r.text).toContain('<loc>https://shop.example.lk/site</loc>'); expect(r.text).not.toMatch(/owner|\/api\//);
  });
  test('without SITE_URL the sitemap uses the address the visitor used; a bad SITE_URL is ignored', async () => {
    process.env.SITE_URL = 'javascript:alert(1)';
    const r = await request(app).get('/sitemap.xml').set('Host', 'localhost:3000');
    expect(r.text).toContain('<loc>http://localhost:3000/site</loc>');
  });
  test('/site is unchanged without SITE_URL and gets absolute share links with it', async () => {
    expect((await request(app).get('/site')).text).toBe(html);
    process.env.SITE_URL = 'https://shop.example.lk';
    const t = (await request(app).get('/site')).text;
    expect(t).toContain('<link rel="canonical" href="https://shop.example.lk/site"');
    expect(t).toContain('property="og:image" content="https://shop.example.lk/brand/share-1200x630.jpg"');
    expect(t).toContain('name="twitter:image" content="https://shop.example.lk/brand/share-1200x630.jpg"');
  });
});

describe('the page file', () => {
  test('canonical, Open Graph and Twitter tags, manifest and icons are present', () => {
    for (const s of ['rel="canonical"', 'property="og:title"', 'property="og:description"', 'property="og:image"', 'property="og:url"', 'name="twitter:card" content="summary_large_image"', 'name="twitter:image"', 'rel="manifest"', 'rel="apple-touch-icon"'])
      expect(html).toContain(s);
  });
  test('preview image is a real 1200x630 PNG; manifest is valid and its icons exist', () => {
    const png = fs.readFileSync(path.join(root, 'public/website/og-image.png'));
    expect(png.slice(1, 4).toString()).toBe('PNG'); expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(630);
    const m = JSON.parse(read('public/website/site.webmanifest'));
    expect(m.name).toBe('Royal Bath Hub');
    for (const i of m.icons) expect(fs.existsSync(path.join(root, 'public', i.src))).toBe(true);
  });
  test('print stylesheet exists', () => { expect(html).toMatch(/@media print\{/); });
  test('no inline handlers or javascript: links (CSP-safe); no blocking scripts; page stays light; no trackers or cookies', () => {
    expect(html).toMatch(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*display=swap[^>]*rel="stylesheet">/);   // a stylesheet link is fine; blocking SCRIPTS are what matter
    expect(html).not.toMatch(/\son[a-z]+\s*=\s*["']/i); expect(html).not.toMatch(/javascript:/i);
    expect(Buffer.byteLength(html)).toBeLessThan(1.5 * 1024 * 1024);
    expect(html).not.toMatch(/google-analytics|googletagmanager|gtag\(|fbq\(|hotjar|document\.cookie/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
  });
  test('tile photos load lazily', () => { expect(html).toContain('IntersectionObserver'); expect(html).toMatch(/function lazyBg/); });
  test('catalogue button points at the public PDF route', () => { expect(html).toMatch(/<a [^>]*id="catPdf"[^>]*href="\/api\/site\/catalogue\.pdf"/); });
});

let chrome = false; try { chrome = fs.existsSync(require('puppeteer').executablePath()); } catch (e) { /* none */ }
const web = chrome ? describe : describe.skip;

web('catalogue PDF', () => {
  beforeAll(async () => {
    await new Promise(r => setTimeout(r, 300));    // let the site_tiles table be created
    pg.__db.public.none(`INSERT INTO site_tiles (name, size, finish, grp, visible) VALUES ('Shown Tile One','60x60 cm','matt','stone',TRUE),('SECRET HIDDEN TILE','60x60 cm','matt','stone',FALSE)`);
  });
  const get = () => request(app).get('/api/site/catalogue.pdf').buffer(true).parse((res, cb) => { const c = []; res.on('data', d => c.push(d)); res.on('end', () => cb(null, Buffer.concat(c))); });

  test('public, returns a PDF, leaks nothing private, second call comes from the cache', async () => {
    const a = await get();
    expect(a.status).toBe(200); expect(a.headers['content-type']).toMatch(/application\/pdf/);
    expect(a.body.slice(0, 4).toString()).toBe('%PDF');
    expect(a.headers['x-catalogue-cache']).toBe('miss');
    expect(a.body.toString('latin1')).not.toMatch(/SECRET HIDDEN|price|stock/i);
    const b = await get();
    expect(b.status).toBe(200); expect(b.headers['x-catalogue-cache']).toBe('hit'); expect(b.body.equals(a.body)).toBe(true);
    expect(fs.readdirSync(process.env.SITE_CACHE_DIR).filter(f => f.endsWith('.pdf')).length).toBe(1);
  }, 90000);

  test('a changed tile list makes a new file and removes the old one', async () => {
    pg.__db.public.none(`INSERT INTO site_tiles (name, size, finish, grp, visible) VALUES ('Second Shown Tile','30x60 cm','glossy','wood',TRUE)`);
    const c = await get();
    expect(c.status).toBe(200); expect(c.headers['x-catalogue-cache']).toBe('miss');
    await new Promise(r => setTimeout(r, 200));
    expect(fs.readdirSync(process.env.SITE_CACHE_DIR).filter(f => f.endsWith('.pdf')).length).toBe(1);
  }, 90000);

  test('several requests at once all succeed (one Chromium at a time)', async () => {
    const rs = await Promise.all([get(), get(), get()]);
    expect(rs.every(r => r.status === 200 && r.body.slice(0, 4).toString() === '%PDF')).toBe(true);
  }, 90000);
});
