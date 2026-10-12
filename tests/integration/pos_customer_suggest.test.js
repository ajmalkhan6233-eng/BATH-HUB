'use strict';
// POS customer box (Task 30): drop-down on tap/typing, ONLY a tap picks, Enter never picks, and nothing stale is left after a bill.
// Real page in a real browser (puppeteer), with the server answers faked. Skipped when no Chrome is installed.
const fs = require('fs');
const path = require('path');
let chrome = false; try { chrome = fs.existsSync(require('puppeteer').executablePath()); } catch (e) { /* none */ }
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f));
const CUSTOMERS = [{ id: 1, name: 'Saman', phone: '0777123456' }, { id: 2, name: 'Nimal Perera', phone: '0711111111' }];

(chrome ? describe : describe.skip)('POS customer name box', () => {
  let browser, page, frame;
  beforeAll(async () => {
    browser = await require('puppeteer').launch({ headless: true, args: ['--no-sandbox'] });
    page = await browser.newPage(); await page.setViewport({ width: 390, height: 844 });
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = new URL(req.url()); const ok = (body, type = 'application/json') => req.respond({ status: 200, contentType: type, body });
      if (u.pathname === '/host.html') return ok('<iframe id="f" src="/pos_billing.html" style="width:390px;height:800px;border:0"></iframe>', 'text/html');
      if (u.pathname === '/pos_billing.html') return ok(pub('pos_billing.html'), 'text/html');
      if (u.pathname === '/suggest.js' || u.pathname === '/pos-picker.js' || u.pathname === '/pos-cart.js') return ok(pub(u.pathname.slice(1)), 'application/javascript');
      if (u.pathname === '/api/customers') return ok(JSON.stringify(CUSTOMERS));
      if (u.pathname.startsWith('/api/')) return ok('{}');
      return ok('', u.pathname.endsWith('.js') ? 'application/javascript' : 'text/plain');
    });
    await page.goto('http://rbh.test/host.html'); await page.waitForSelector('#f');
    frame = await (await page.$('#f')).contentFrame(); await frame.waitForSelector('#customerName');
  }, 60000);
  afterAll(async () => { if (browser) await browser.close(); });
  const val = (id) => frame.$eval('#' + id, (e) => e.value);
  const rows = () => frame.$$eval('.suggest-row', (r) => r.map((x) => x.textContent));
  const typeInto = async (id, text) => { await frame.click('#' + id, { clickCount: 3 }); await page.keyboard.press('Backspace'); await frame.type('#' + id, text); };

  test('opens empty, autocomplete is off, tapping the box shows the list', async () => {
    expect(await val('customerName')).toBe(''); expect(await val('customerPhone')).toBe('');
    expect(await frame.$eval('#customerName', (e) => e.getAttribute('autocomplete'))).toBe('off');
    await frame.click('#customerName'); await frame.waitForSelector('.suggest-row');
    expect((await rows()).join('|')).toContain('Saman');
  });
  test('typing filters the list; tapping a row fills name AND phone', async () => {
    await typeInto('customerName', 'sam');
    await frame.waitForFunction(() => document.querySelectorAll('.suggest-row').length === 1);
    expect(await rows()).toHaveLength(1);
    await frame.click('.suggest-row');
    expect([await val('customerName'), await val('customerPhone')]).toEqual(['Saman', '0777123456']);
    expect(await rows()).toHaveLength(0);                                                   // the list closes on pick
  });
  test('THE BUG: after Saman, a new bill, typing Ajmal and pressing Enter keeps Ajmal and no phone', async () => {
    await frame.evaluate(() => resetForm());                                                // "+ New bill" (also runs after a bill is saved)
    expect([await val('customerName'), await val('customerPhone')]).toEqual(['', '']);
    await frame.click('#customerName'); await frame.type('#customerName', 'Ajmal'); await page.keyboard.press('Enter');
    expect(await val('customerName')).toBe('Ajmal'); expect(await val('customerPhone')).toBe('');
    expect(await frame.evaluate(() => _custId)).toBeNull();                                 // a new name with no tap = a new customer
  });
  test('Enter and Tab never pick a suggestion, even when one matches exactly', async () => {
    await typeInto('customerName', 'Saman'); await page.keyboard.press('Enter');
    expect([await val('customerName'), await val('customerPhone')]).toEqual(['Saman', '']);
    await page.keyboard.press('Tab');
    expect(await val('customerPhone')).toBe('');
  });
  test('retyping the name after a tap drops the phone that the tap filled in', async () => {
    await typeInto('customerName', 'nim'); await frame.waitForFunction(() => { const r = document.querySelectorAll('.suggest-row'); return r.length === 1 && /Nimal/.test(r[0].textContent); }); await frame.click('.suggest-row');
    expect(await val('customerPhone')).toBe('0711111111');
    await typeInto('customerName', 'Ajmal');
    expect([await val('customerName'), await val('customerPhone')]).toEqual(['Ajmal', '']);
  });
  test('the phone box also lists customers; a tap fills both', async () => {
    await frame.evaluate(() => clearCustomer()); await frame.click('#customerPhone'); await typeInto('customerPhone', '0777');
    await frame.waitForSelector('.suggest-row'); await frame.click('.suggest-row');
    expect([await val('customerName'), await val('customerPhone')]).toEqual(['Saman', '0777123456']);
  });
});
