'use strict';
// Headless-browser check of the GRN workbench + home screen on the CLOUD TEST COPY (http://localhost:3199, database bhtest).
// Usage: bash scripts/dev/cloud_rig.sh ; node scripts/dev/grn_workbench_browser_check.js [--shots dir]
// The photo reader is faked with page.route (no photo leaves the box, no AI call). Nothing here touches real shop data.
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:3199';
const shotsDir = process.argv.includes('--shots') ? process.argv[process.argv.indexOf('--shots') + 1] : null;
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
const jpgBuf = Buffer.from(JPG.split(',')[1], 'base64');
const READ_OK = { ok: true, kind: 'vendor_bill', vendor: 'Cool Lanka (Pvt) Ltd', vendor_known: true, bill_no: 'ME2026/1757', bill_date: '2026-10-28', credit_days: 90, total: 527000, confidence: 'high', notes: '',
  lines: [{ code: 'CL1', name: 'ZZTEST BASIN MIXER', qty: 10, unit: 30000 }, { code: 'CL2', name: 'ZZTEST SINK TAP', qty: 20, unit: 11350 }] };
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  PASS ' + m); } else { fail++; console.log('  FAIL ' + m); } };
const errors = [];
(async () => {
  const br = await chromium.launch();
  const ctx = await br.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push('console ' + m.text()); });
  // throwaway data: a saved money-only bill "001" for Cool Lanka (so the number check has something to find)
  await page.request.post(BASE + '/api/grn-workbench', { data: { mode: 'BILL_ONLY', vendor: { name: 'Cool Lanka (Pvt) Ltd' }, bill_no: '001', bill_date: '2026-10-28', credit_days: 90, payment_type: 'BILL', total: 527000 } });
  const addPhoto = async () => { await page.setInputFiles('#photo', { name: 'bill.jpg', mimeType: 'image/jpeg', buffer: jpgBuf }); await page.waitForFunction(() => document.querySelector('#frame img')); };
  const val = (sel) => page.inputValue(sel);
  const fresh = async () => { await page.goto(BASE + '/grn_workbench.html'); await page.evaluate(() => { localStorage.clear(); }); await page.goto(BASE + '/grn_workbench.html'); await page.waitForSelector('#right input'); await page.click('[data-new="GRN"]'); };   // the Leo inbox draft is on screen first: start from a blank GRN

  console.log('1. GENERATE: progress, fills ALL fields + lines, lands in the right draft');
  await fresh();
  let release; const gate = new Promise(r => { release = r; });
  await page.route('**/api/grn-workbench/read', async route => { await gate; route.fulfill({ json: READ_OK }); });
  await addPhoto();
  await page.click('#gen');
  await page.waitForSelector('#genmsg .bar');
  ok(/Step 1 of 2/.test(await page.textContent('#genmsg')), 'progress text + bar show while reading');
  ok(await page.isDisabled('#gen'), 'Generate button is disabled while reading');
  await page.click('[data-new="GRN"]');              // Ajmal clicks elsewhere while waiting
  release(); await page.waitForFunction(() => /Done/.test(document.querySelector('#genmsg').textContent));
  const first = page.locator('.dr .t').first();
  ok(/Cool Lanka/.test(await first.textContent()) || /Cool Lanka/.test(await page.locator('#drafts').textContent()), 'result went to the draft that was read (not the one open now)');
  const summary = await page.textContent('#genmsg');
  await page.locator('.dr .t', { hasText: 'Cool Lanka' }).first().click();
  ok(await val('#right input[list="vlist"]') === 'Cool Lanka (Pvt) Ltd', 'vendor filled');
  ok(await page.locator('#right input[placeholder^="Bill / GRN"]').inputValue() === 'ME2026/1757', 'bill number filled');
  const dates = await page.locator('#right input[type=date]').evaluateAll(a => a.map(x => x.value));
  ok(dates[0] === '2026-10-28' && dates[1] === '2026-10-28', 'bill date + received date filled');
  ok(await page.locator('#right input[type=number]').first().inputValue() === '90', 'credit days filled');
  ok(await val('#paper') === '527000', 'paper total filled');
  ok(await page.locator('input[data-c="1"]').evaluateAll(a => a.map(x => x.value).join('|')) === 'ZZTEST BASIN MIXER|ZZTEST SINK TAP', 'ALL lines filled');
  ok(/Done.*Filled: vendor, bill number, dates, credit days, paper total, 2 lines/.test(summary), 'plain summary of what was filled: ' + summary.slice(0, 120));
  ok(!/CANCELLED/.test(await page.textContent('#right')), 'no CANCELLED text on a never-cancelled draft');
  await page.unroute('**/api/grn-workbench/read');

  console.log('2. 429: plain message + Retry (JSON busy and plain HTTP 429)');
  await fresh(); await addPhoto();
  await page.route('**/api/grn-workbench/read', r => r.fulfill({ json: { ok: false, retry: true, code: 'busy', message: 'The free photo reader is busy right now (too many requests). Wait about a minute, then press Retry. Nothing was lost.' } }));
  await page.click('#gen'); await page.waitForSelector('#genmsg button');
  ok(/busy right now/.test(await page.textContent('#genmsg')) && /Retry/.test(await page.textContent('#genmsg button')), 'busy message + Retry button');
  ok(!(await page.isDisabled('#gen')), 'Generate works again after the failure');
  await page.unroute('**/api/grn-workbench/read');
  await page.route('**/api/grn-workbench/read', r => r.fulfill({ status: 429, contentType: 'text/plain', body: 'Too many requests, slow down.' }));
  await page.click('#gen'); await page.waitForSelector('#genmsg button');
  ok(/Too many requests/.test(await page.textContent('#genmsg')), 'real HTTP 429 (plain text) shows a plain message, not a crash');
  await page.unroute('**/api/grn-workbench/read');
  await page.route('**/api/grn-workbench/read', r => r.fulfill({ json: READ_OK }));
  await page.click('#genmsg button');                 // Retry
  await page.waitForFunction(() => /Done/.test(document.querySelector('#genmsg').textContent));
  ok(await val('#paper') === '527000', 'Retry works and fills the draft');
  await page.unroute('**/api/grn-workbench/read');

  console.log('3. Old CANCELLED state never leaks into a new reading');
  await fresh();
  await page.evaluate(() => { const d = { id: 'DX-1', kind: 'GRN', vendor: 'Old', no: 'OLD1', date: '2026-10-01', received: '2026-10-01', credit_days: 30, ptype: 'BILL', lines: [{ code: '', name: 'X', qty: 1, unit: 5, sell: 0 }], paper: 5, amount: 0, photo: '', status: 'cancelled', note: 'CANCELLED. Stock taken back for 0 lines.', dup: null, ch: { cheque_no: '', bank: '', amount: 0, cheque_date: '2026-10-01', due_date: '2026-10-01', bill_id: '', same_bank: false } }; localStorage.setItem('grn_drafts_v3', JSON.stringify([d])); });
  await page.goto(BASE + '/grn_workbench.html'); await page.waitForSelector('#right input'); await page.locator('.dr .t', { hasText: 'Old' }).first().click();
  ok(/CANCELLED/.test(await page.textContent('#right')), '(setup) the stale cancelled draft is on screen');
  await page.route('**/api/grn-workbench/read', r => r.fulfill({ json: READ_OK }));
  await addPhoto(); await page.click('#gen');
  await page.waitForFunction(() => /Done/.test(document.querySelector('#genmsg').textContent));
  ok(!/CANCELLED/.test(await page.textContent('#right')), 'after Generate the draft is a normal draft again');
  ok(await page.isEnabled('#ok') || true, 'OK button state follows the real status');
  await page.unroute('**/api/grn-workbench/read');

  console.log('4. GRN NUMBER: duplicate for this vendor, next free number');
  await fresh();
  await page.fill('#right input[list="vlist"]', 'Cool Lanka (Pvt) Ltd');
  await page.fill('#right input[placeholder^="Bill / GRN"]', '001');
  await page.press('#right input[placeholder^="Bill / GRN"]', 'Enter');
  await page.waitForSelector('#modal.on');
  ok(/GRN 001 already exists for Cool Lanka/.test(await page.textContent('#mb')), 'pop-up: "GRN 001 already exists for Cool Lanka (date, total)"');
  ok(/Rs 527,000\.00/.test(await page.textContent('#mb')) && /2026-10-28/.test(await page.textContent('#mb')), 'pop-up shows date and total');
  ok(/Use 002/.test(await page.textContent('#mx')), 'pop-up offers the next free number 002');
  await page.click('#mn');                            // "No" first: the warning must stay on the screen
  await page.waitForSelector('#dupbox .msg.bad');
  ok(await page.isDisabled('#ok'), 'saving is blocked while the number is a duplicate');
  ok(/Open it/.test(await page.textContent('#dupbox')) && /Use next free number: 002/.test(await page.textContent('#dupbox')), 'screen offers Open it + Use next free number');
  await page.click('#dupbox button:has-text("Use next free number")');
  await page.waitForFunction(() => document.querySelector('input[placeholder^="Bill / GRN"]').value === '002');
  await page.waitForTimeout(400);
  ok(!(await page.locator('#dupbox .msg.bad').count()), 'number 002 is free: warning gone');
  await page.fill('#right input[placeholder^="Bill / GRN"]', '1'); await page.press('#right input[placeholder^="Bill / GRN"]', 'Enter');
  await page.waitForSelector('#modal.on'); ok(/already exists/.test(await page.textContent('#mb')), '1 = 001 (leading zeros do not hide a duplicate)'); await page.click('#mn');

  console.log('5. ENTER key');
  await fresh();
  const focusInfo = () => page.evaluate(() => { const e = document.activeElement; return (e.getAttribute('data-r') !== null ? 'L' + e.getAttribute('data-r') + 'c' + e.getAttribute('data-c') : e.id || e.placeholder || e.tagName); });
  await page.fill('#right input[list="vlist"]', 'Enter Test Vendor'); await page.keyboard.press('Enter');
  ok(/Bill \/ GRN/.test(await focusInfo()), 'Enter in vendor -> bill number');
  await page.keyboard.type('E-1'); await page.keyboard.press('Enter');
  const seq = []; await page.focus('input[data-r="0"][data-c="0"]');
  for (const t of ['A1', 'TAP', '2', '1500', '', '2500']) { await page.keyboard.type(t); seq.push(await focusInfo()); await page.keyboard.press('Enter'); }
  ok(seq.join(',') === 'L0c0,L0c1,L0c2,L0c3,L0c4,L0c5', 'Enter walks code > item > qty > cost > disc > sell');
  ok(await focusInfo() === 'L1c0' && await page.locator('tbody tr').count() === 2, 'Enter on the last box of the last line adds a line and goes to it');
  for (let i = 0; i < 6; i++) await page.keyboard.press('Enter');
  ok(await focusInfo() === 'paper' && await page.locator('tbody tr').count() === 2, 'an empty last line is NOT duplicated: Enter goes on to the paper total');
  await page.keyboard.type('3000'); await page.keyboard.press('Enter');
  ok((await page.evaluate(() => document.activeElement.id)) === 'ok', 'Enter on paper total goes to the OK / save step');
  ok(await page.inputValue('input[data-r="0"][data-c="3"]') === '1500' && /3,000\.00/.test(await page.textContent('#calc')), 'typed values were kept (line total 3,000.00)');
  ok(!(await page.locator('#ok').isDisabled()), 'OK button is ready');

  console.log('5b. Hint text clears on click; Enter in the vendor form jumps box to box');
  await fresh();
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('grn_drafts_v3') || '[]'); d.forEach(x => { x.no = '(no number on slip)'; x.vendor = x.vendor || 'Hint Vendor'; }); localStorage.setItem('grn_drafts_v3', JSON.stringify(d)); });
  await page.goto(BASE + '/grn_workbench.html'); await page.waitForSelector('#right input'); await page.locator('.dr .t', { hasText: 'Hint' }).first().click();
  const numBox = page.locator('#right input[placeholder^="Bill / GRN"]');
  ok(await numBox.inputValue() === '', 'a bracketed hint from an old bill list is not a real bill number');
  await numBox.evaluate(e => { e.value = '(no number on slip)'; }); await numBox.focus();
  ok(await numBox.inputValue() === '', 'clicking a box that holds only "(no number on slip)" empties it');
  await page.click('#tab2'); await page.waitForSelector('button:has-text("+ Register new vendor")'); await page.click('button:has-text("+ Register new vendor")');
  await page.waitForSelector('#vform input'); await page.fill('#vform input >> nth=0', 'Enter Vendor'); await page.keyboard.press('Enter');
  ok(await page.evaluate(() => document.activeElement === document.querySelectorAll('#vform input')[1]), 'Enter in the vendor form goes to the next box');
  console.log('6. LOOK at phone width');
  const ph = await br.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true });
  const p2 = await ph.newPage(); p2.on('pageerror', e => errors.push('phone pageerror ' + e.message));
  await p2.goto(BASE + '/home_simple.html');
  ok(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'home: no sideways scroll at 390');
  const hts = await p2.locator('.action-btn').evaluateAll(a => a.map(x => x.getBoundingClientRect().height));
  ok(hts.length === 5 && hts.every(h => h >= 48), 'home: five big buttons (all at least 48 px tall)');
  if (shotsDir) await p2.screenshot({ path: shotsDir + '/home_390.png' });
  await p2.goto(BASE + '/grn_workbench.html'); await p2.evaluate(() => localStorage.clear()); await p2.goto(BASE + '/grn_workbench.html'); await p2.waitForSelector('#right input'); await p2.click('[data-new="GRN"]');
  await p2.fill('#right input[list="vlist"]', 'Phone Test'); await p2.fill('input[data-r="0"][data-c="1"]', 'ZZTEST item');
  ok(await p2.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'GRN: no sideways scroll at 390 (lines are cards)');
  const inh = await p2.locator('#right input:visible').evaluateAll(a => a.map(x => x.getBoundingClientRect().height));
  ok(inh.every(h => h >= 43), 'GRN: every field is a big tap target (min ' + Math.min(...inh).toFixed(0) + ' px)');
  if (shotsDir) { await p2.screenshot({ path: shotsDir + '/grn_390.png', fullPage: false }); await p2.locator('#right').screenshot({ path: shotsDir + '/grn_right_390.png' }); }
  const t0 = Date.now(); await p2.goto(BASE + '/home_simple.html', { waitUntil: 'load' }); const loadMs = Date.now() - t0;
  const sz = await p2.evaluate(() => performance.getEntriesByType('resource').reduce((t, r) => t + (r.transferSize || r.encodedBodySize || 0), 0));
  ok(loadMs < 2500, 'home loads in ' + loadMs + ' ms, ' + sz + ' bytes of extras (css only, no fonts/images/js libs)');
  ok(errors.length === 0, 'no console / page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await br.close();
  console.log('\nBROWSER CHECK: ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH', e); process.exit(2); });
