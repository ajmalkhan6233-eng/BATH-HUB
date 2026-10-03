'use strict';
// The real public page, served by the real server with its real CSP, opened in Chromium: it must render and use its features
// with ZERO Content-Security-Policy violations. Skips itself if Chromium is missing. (Google Fonts may or may not load offline: that is
// a network matter, not a policy violation.)
jest.mock('file-type', () => ({ fileTypeFromBuffer: jest.fn(), fromBuffer: jest.fn() }));
jest.mock('connect-pg-simple', () => (session) => session.MemoryStore);
jest.mock('pg', () => require('../helpers/pgmock')());
jest.mock('../../layla', () => ({ pool: { query: jest.fn().mockResolvedValue({ rows: [{ n: 1 }] }) }, processMessage: jest.fn(), alertOwner: jest.fn(), getOrCreateCustomer: jest.fn() }));
const http = require('http');
const pg = require('pg');
pg.__db.public.none(`CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT, role TEXT, password_hash TEXT, active BOOLEAN DEFAULT true)`);
pg.__db.public.none(`INSERT INTO users (username, role) VALUES ('a', 'admin')`);
const app = require('../../server');

let chrome = false; try { chrome = require('fs').existsSync(require('puppeteer').executablePath()); } catch (e) { /* none */ }
const web = chrome ? describe : describe.skip;

web('public page under its Content-Security-Policy', () => {
    let browser, server, base;
    beforeAll(async () => {
        server = http.createServer(app); await new Promise(r => server.listen(0, '127.0.0.1', r));
        base = 'http://127.0.0.1:' + server.address().port;
        browser = await require('puppeteer').launch({ headless: true, args: ['--no-sandbox'] });
    }, 60000);
    afterAll(async () => { if (browser) await browser.close(); if (server) { if (server.closeAllConnections) server.closeAllConnections(); await new Promise(r => server.close(r)); } });

    test('renders, works, and the browser reports no CSP violation', async () => {
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        const violations = [], errors = [], consoleCsp = [];
        await page.evaluateOnNewDocument(() => {
            window.__csp = [];
            document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI));
        });
        page.on('pageerror', e => errors.push(e.message));
        page.on('console', m => { if (/content security policy/i.test(m.text())) consoleCsp.push(m.text()); });
        const resp = await page.goto(base + '/site', { waitUntil: 'load', timeout: 45000 });
        expect(resp.headers()['content-security-policy']).toContain("default-src 'self'");
        await new Promise(r => setTimeout(r, 800));
        expect(await page.$$eval('#grid .card', e => e.length)).toBeGreaterThan(0);          // the inline script ran
        expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)')).toBe(true);   // the inline style applied
        // use it: open a tile, close it, switch language, toggle a filter chip
        await page.$eval('#grid .card', e => e.click());
        await new Promise(r => setTimeout(r, 300));
        await page.evaluate(() => { const d = document.getElementById('dlg'); if (d && d.open) d.close(); });
        await page.$$eval('.lang button', b => { if (b[1]) b[1].click(); });
        await page.$$eval('.chip', c => { if (c[1]) c[1].click(); });
        await new Promise(r => setTimeout(r, 300));
        violations.push(...(await page.evaluate(() => window.__csp)));
        expect(violations).toEqual([]);
        expect(consoleCsp).toEqual([]);
        expect(errors).toEqual([]);
        await page.close();
    }, 90000);

    test('an inline script injected into the page is blocked by the policy', async () => {
        const page = await browser.newPage();
        await page.goto(base + '/site', { waitUntil: 'load', timeout: 45000 });
        const ran = await page.evaluate(() => new Promise(res => {
            window.__x = 0;
            const s = document.createElement('script'); s.textContent = 'window.__x = 1'; document.body.appendChild(s);
            setTimeout(() => res(window.__x), 100);
        }));
        expect(ran).toBe(0);
        await page.close();
    }, 90000);
});
