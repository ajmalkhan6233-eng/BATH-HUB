'use strict';
// Documents and reports: owner-only access, report files + records, authenticated download by id (no path tricks), delete,
// the WhatsApp allow-list, dry run, one-real-send-only, and the inbound quarantine. No real WhatsApp, no real Chromium
// (the PDF maker is replaced by a stub; one real-Chromium test runs only if Chromium exists).
const fs = require('fs');
const os = require('os');
const path = require('path');
delete process.env.WHATSAPP_LIVE; delete process.env.WHATSAPP_AUTO_SEND;
process.env.DROP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-drop-'));
jest.mock('pg', () => require('../helpers/pgmock')());
const express = require('express');
const request = require('supertest');
const crypto = require('crypto');
const pg = require('pg');
const axios = require('axios');

const db = pg.__db.public;
db.none(`CREATE TABLE daily_summary (id SERIAL PRIMARY KEY, report_date DATE, total_sale NUMERIC DEFAULT 0, cash_sale NUMERIC DEFAULT 0, card_sale NUMERIC DEFAULT 0, online_sale NUMERIC DEFAULT 0, credit_sale NUMERIC DEFAULT 0, total_expenses NUMERIC DEFAULT 0, payments NUMERIC DEFAULT 0, salary NUMERIC DEFAULT 0, gross_profit NUMERIC DEFAULT 0, net_profit NUMERIC DEFAULT 0, gp_status TEXT)`);
db.none(`INSERT INTO daily_summary (report_date, total_sale, cash_sale, total_expenses) VALUES ('2026-09-01', 1234567.5, 1000000, 20000), ('2026-09-02', 500000, 400000, 10000), ('2026-10-15', 999, 999, 0)`);
db.none(`CREATE TABLE stock_items (id SERIAL PRIMARY KEY, item_name VARCHAR(200), unit VARCHAR(20), current_qty NUMERIC, reorder_level NUMERIC, notes TEXT)`);
db.none(`INSERT INTO stock_items (item_name, unit, current_qty, reorder_level) VALUES ('Tile A', 'box', 3, 10), ('Tap B', 'pcs', 50, 5)`);
db.none(`CREATE TABLE cheque_register (id SERIAL PRIMARY KEY, cheque_no VARCHAR(50), bank VARCHAR(100), payee VARCHAR(150), amount NUMERIC, due_date DATE, status VARCHAR(20) DEFAULT 'pending', notes TEXT)`);
db.none(`INSERT INTO cheque_register (cheque_no, bank, payee, amount, due_date, status) VALUES ('1', 'BOC', '=HYPERLINK("http://evil")', 250000, '2026-09-10', 'pending')`);

const sharedPool = require('../../utils/pool');
const T = require('../../utils/documents/transport');
const Q = require('../../utils/documents/quarantine');
const store = require('../../utils/documents/store');
const render = require('../../utils/documents/render');
const { createRouter } = require('../../routes/documents');

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-'));
const INBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-inbox-'));
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const fakePdf = jest.fn(async rep => Buffer.from(`%PDF-1.4 stub ${rep.title} ${crypto.randomBytes(4).toString('hex')}`));

const mk = (role, opts = {}) => {
    const router = createRouter(sharedPool, { root: ROOT, inboxRoot: INBOX, makePdf: fakePdf, handoff: async () => 4242, ...opts });
    const a = express(); a.use(express.json());
    a.use((req, _r, n) => { if (role) req.session = { user: { role, username: 'aj' } }; n(); });
    a.use('/api', router); return a;
};
const owner = mk('admin'), ownerRole = mk('owner'), staff = mk('staff'), nobody = mk(null);
const sim = T.simulatorTransport();
const simApp = mk('admin', { transport: sim });
const failTransport = T.simulatorTransport({ fail: true });
const failApp = mk('admin', { transport: failTransport });
const make = async (report = 'daily_summary', formats = ['csv'], app = owner) => (await request(app).post('/api/documents/generate').send({ report, from: '2026-09-01', to: '2026-09-30', formats })).body.documents;

beforeAll(async () => { await new Promise(r => setTimeout(r, 300)); });
afterEach(() => jest.restoreAllMocks());

describe('access: owner only', () => {
    const calls = [['get', '/api/documents/reports'], ['post', '/api/documents/generate'], ['get', '/api/documents'], ['get', '/api/documents/1/download'], ['delete', '/api/documents/1'],
        ['post', '/api/documents/1/send'], ['get', '/api/documents/sends'], ['get', '/api/documents/recipients'], ['post', '/api/documents/recipients'], ['put', '/api/documents/recipients/1'],
        ['delete', '/api/documents/recipients/1'], ['get', '/api/documents/inbox'], ['post', '/api/documents/inbox/upload'], ['get', '/api/documents/inbox/1/file'],
        ['post', '/api/documents/inbox/1/confirm'], ['post', '/api/documents/inbox/1/reject']];
    test.each(calls)('not logged in: %s %s -> 401', async (m, u) => { expect((await request(nobody)[m](u).send({})).status).toBe(401); });
    test.each(calls)('staff: %s %s -> 403', async (m, u) => { expect((await request(staff)[m](u).send({})).status).toBe(403); });
    test('the allow-list starts EMPTY', async () => {
        expect((await request(owner).get('/api/documents/recipients')).body).toEqual([]);
    });
    test('both owner roles are allowed', async () => {
        expect((await request(owner).get('/api/documents/reports')).status).toBe(200);
        expect((await request(ownerRole).get('/api/documents/reports')).status).toBe(200);
    });
    test('the module does not block other /api paths for staff (only /api/documents*)', async () => {
        const a = express(); a.use((req, _r, n) => { req.session = { user: { role: 'staff' } }; n(); }); a.use('/api', createRouter(sharedPool, { root: ROOT, inboxRoot: INBOX }));
        a.get('/api/other', (req, res) => res.json({ ok: true }));
        expect((await request(a).get('/api/other')).status).toBe(200);
    });
    test('lists all 12 reports', async () => {
        const r = (await request(owner).get('/api/documents/reports')).body.map(x => x.key).sort();
        expect(r).toEqual(['cash_flow', 'cheques', 'commissions', 'daily_summary', 'grn', 'loans', 'low_stock', 'non_moving', 'pnl', 'quotations', 'receipts', 'stock']);
    });
});

describe('making a report', () => {
    test('bad input is refused with plain messages', async () => {
        const g = b => request(owner).post('/api/documents/generate').send(b);
        expect((await g({ report: 'pnl' })).status).toBe(400);
        expect((await g({ report: 'pnl', from: '2026-13-01', to: '2026-09-30' })).status).toBe(400);
        expect((await g({ report: 'pnl', from: '2026-09-30', to: '2026-09-01' })).body.error).toMatch(/after/);
        expect((await g({ report: 'pnl', from: '2020-01-01', to: '2026-09-30' })).body.error).toMatch(/2 years/);
        expect((await g({ report: 'nope', from: '2026-09-01', to: '2026-09-30' })).status).toBe(400);
        expect((await g({ report: '__proto__', from: '2026-09-01', to: '2026-09-30' })).status).toBe(400);
        expect((await g({ report: 'pnl', from: '2026-09-01', to: '2026-09-30', formats: ['exe'] })).status).toBe(400);
    });
    test('CSV: header, plain numbers, total row, spreadsheet-formula text defused, only the chosen period', async () => {
        const [doc] = await make('daily_summary', ['csv']);
        expect(doc.format).toBe('csv'); expect(doc.type).toBe('daily_summary');
        const body = (await request(owner).get(`/api/documents/${doc.id}/download`)).text;
        const lines = body.replace(/^\ufeff/, '').trim().split('\r\n');
        expect(lines[0]).toBe('"Date","Total sale","Cash","Card","Online","Credit","Expenses"');
        expect(lines).toHaveLength(4);                                  // header + 2 days (the October row is outside) + total
        expect(lines[1]).toBe('"2026-09-01","1234567.50","1000000.00","0.00","0.00","0.00","20000.00"');
        expect(lines[3]).toBe('"Total","1734567.50","1400000.00","0.00","0.00","0.00","30000.00"');
        const ch = (await request(owner).get(`/api/documents/${(await make('cheques', ['csv']))[0].id}/download`)).text;
        expect(ch).toContain(`"'=HYPERLINK`);                           // never starts with =
    });
    test('both formats by default; the record has type, title, period, sha256, creator; path shape is year/month/random', async () => {
        const docs = (await request(owner).post('/api/documents/generate').send({ report: 'pnl', from: '2026-09-01', to: '2026-09-30' })).body.documents;
        expect(docs.map(d => d.format).sort()).toEqual(['csv', 'pdf']);
        const row = (await sharedPool.query(`SELECT * FROM documents WHERE id = $1`, [docs[0].id])).rows[0];
        expect(row.period).toBe('2026-09-01 to 2026-09-30'); expect(row.created_by).toBe('aj'); expect(row.title).toMatch(/Profit and loss/);
        expect(row.path).toMatch(store.REL_RE);
        expect(row.sha256).toMatch(/^[a-f0-9]{64}$/);
        const abs = path.join(ROOT, ...row.path.split('/'));
        expect(crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')).toBe(row.sha256);
        expect(fakePdf).toHaveBeenCalled();
        const made = await make('cheques', ['csv', 'pdf']);
        const paths = []; for (const d of made) paths.push((await sharedPool.query(`SELECT path FROM documents WHERE id = $1`, [d.id])).rows[0].path);
        expect(new Set(paths).size).toBe(paths.length);                 // random names, never the same
        expect(JSON.stringify(docs)).not.toMatch(/"path"/);              // the screen never sees the stored path
    });
    test('a PDF failure still gives the CSV and says so; nothing half-saved', async () => {
        const app = mk('admin', { makePdf: async () => { throw new Error('chromium gone at C:\\secret\\path'); } });
        const r = await request(app).post('/api/documents/generate').send({ report: 'cheques', from: '2026-09-01', to: '2026-09-30' });
        expect(r.status).toBe(201); expect(r.body.documents.map(d => d.format)).toEqual(['csv']); expect(r.body.problems.join()).toMatch(/PDF could not/);
        expect(JSON.stringify(r.body)).not.toMatch(/secret/);
        const only = mk('admin', { makePdf: async () => { throw new Error('x'); } });
        expect((await request(only).post('/api/documents/generate').send({ report: 'cheques', from: '2026-09-01', to: '2026-09-30', formats: ['pdf'] })).status).toBe(500);
    });
    test('database error: plain message, no SQL text', async () => {
        jest.spyOn(sharedPool, 'query').mockRejectedValueOnce(new Error('relation "daily_summary" does not exist at character 99'));
        const r = await request(owner).post('/api/documents/generate').send({ report: 'daily_summary', from: '2026-09-01', to: '2026-09-30' });
        expect(r.status).toBe(500); expect(JSON.stringify(r.body)).not.toMatch(/relation|character/);
    });
    test('the HTML for the PDF: logo header, period, summary first, tabular numbers, Rs with thousands separators', async () => {
        const rep = await require('../../utils/documents/reports').build(sharedPool, 'daily_summary', { from: '2026-09-01', to: '2026-09-30' });
        const html = render.toHtml(rep, { name: 'Test Shop', tagline: '', logo: 'data:image/png;base64,AAAA' });
        expect(html).toContain('<img src="data:image/png;base64,AAAA"'); expect(html).toContain('Period: 2026-09-01 to 2026-09-30');
        expect(html).toContain('tabular-nums'); expect(html).toContain('Rs 1,734,567.50');
        expect(html.indexOf('class="cards"')).toBeLessThan(html.indexOf('<table'));
        expect(html).toMatch(/class="pb"/);                              // the table starts on page 2
        expect(render.branding().name.length).toBeGreaterThan(0);
    });
    test('real Chromium makes a real PDF (skipped when Chromium is not installed)', async () => {
        let exe; try { exe = require('puppeteer').executablePath(); } catch (e) { /* none */ }
        if (!exe || !fs.existsSync(exe)) return;
        const rep = await require('../../utils/documents/reports').build(sharedPool, 'daily_summary', { from: '2026-09-01', to: '2026-09-30' });
        const buf = await render.makePdf(rep);
        expect(buf.slice(0, 5).toString()).toBe('%PDF-');
    }, 60000);
});

describe('downloads are by id only, and path tricks do nothing', () => {
    test('download gives the same bytes with safe headers', async () => {
        const [doc] = await make('pnl', ['csv']);
        const r = await request(owner).get(`/api/documents/${doc.id}/download`);
        expect(r.status).toBe(200); expect(r.headers['content-type']).toMatch(/text\/csv/); expect(r.headers['content-disposition']).toMatch(/^attachment; filename="[\w .-]+\.csv"$/);
        expect(r.headers['x-content-type-options']).toBe('nosniff');
    });
    test('unknown, odd and non-numeric ids -> 404, never a file', async () => {
        for (const id of ['99999', '0', '-1', '1abc', '1e3', '..%2F..%2Fetc%2Fpasswd', '%2e%2e'])
            expect([404, 400]).toContain((await request(owner).get(`/api/documents/${id}/download`)).status);
    });
    test('a stored path that points outside the folder is never opened', async () => {
        const secret = path.join(os.tmpdir(), 'docs-secret.txt'); fs.writeFileSync(secret, 'TOP SECRET');
        const evil = ['../docs-secret.txt', '..\\docs-secret.txt', secret, '2026/10/../../../docs-secret.txt', '2026/10/ab.pdf', '/etc/passwd', '2026/13/' + 'a'.repeat(32) + '.pdf', '2026/10/' + 'a'.repeat(32) + '.pdf\u0000.txt'];
        for (const p of evil) {
            expect(store.resolveStored(ROOT, p)).toBeNull();
            if (p.includes(' ')) continue;
            const ins = await sharedPool.query(`INSERT INTO documents (type, title, period, path, sha256, format) VALUES ('pnl','evil','x',$1,$2,'pdf') RETURNING id`, [p, 'a'.repeat(64)]);
            const r = await request(owner).get(`/api/documents/${ins.rows[0].id}/download`);
            expect(r.status).toBe(404); expect(r.text).not.toMatch(/SECRET/);
            await request(owner).delete(`/api/documents/${ins.rows[0].id}`);
        }
        expect(fs.existsSync(secret)).toBe(true);                          // deleting those records did not touch the outside file
        fs.unlinkSync(secret);
    });
    test('no direct static path: the folder is not served by this router', async () => {
        const [doc] = await make('pnl', ['csv']);
        const rel = (await sharedPool.query(`SELECT path FROM documents WHERE id = $1`, [doc.id])).rows[0].path;
        expect((await request(owner).get('/api/documents/files/' + rel)).status).toBe(404);
        expect((await request(owner).get('/' + rel)).status).toBe(404);
    });
    test('a file changed on disk after it was made is refused (checksum)', async () => {
        const [doc] = await make('pnl', ['csv']);
        const rel = (await sharedPool.query(`SELECT path FROM documents WHERE id = $1`, [doc.id])).rows[0].path;
        fs.appendFileSync(path.join(ROOT, ...rel.split('/')), 'tampered');
        expect((await request(owner).get(`/api/documents/${doc.id}/download`)).status).toBe(409);
    });
});

describe('delete', () => {
    test('owner delete removes the record and the file; again -> 404; staff cannot', async () => {
        const [doc] = await make('cheques', ['csv']);
        const rel = (await sharedPool.query(`SELECT path FROM documents WHERE id = $1`, [doc.id])).rows[0].path;
        const abs = path.join(ROOT, ...rel.split('/'));
        expect(fs.existsSync(abs)).toBe(true);
        expect((await request(staff).delete(`/api/documents/${doc.id}`)).status).toBe(403);
        expect(fs.existsSync(abs)).toBe(true);
        expect((await request(owner).delete(`/api/documents/${doc.id}`)).status).toBe(200);
        expect(fs.existsSync(abs)).toBe(false);
        expect((await sharedPool.query(`SELECT 1 FROM documents WHERE id = $1`, [doc.id])).rows).toHaveLength(0);
        expect((await request(owner).delete(`/api/documents/${doc.id}`)).status).toBe(404);
        expect((await request(owner).get(`/api/documents/${doc.id}/download`)).status).toBe(404);
        expect((await request(owner).delete('/api/documents/abc')).status).toBe(404);
    });
    test('the send log survives a delete', async () => {
        const [doc] = await make('stock', ['csv']);
        const rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Keep Log', phone: '0711111111', allowed_types: ['*'] })).body;
        await request(owner).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: 'logtest' });
        await request(owner).delete(`/api/documents/${doc.id}`);
        const log = (await request(owner).get('/api/documents/sends')).body;
        expect(log.some(x => x.document_id === doc.id && x.status === 'dry_run')).toBe(true);
    });
});

describe('allow-list', () => {
    test('nobody on the list: nothing can be sent', async () => {
        const [doc] = await make('pnl', ['csv']);
        const r = await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: 987654 });
        expect(r.status).toBe(403); expect(r.body.error).toMatch(/allow-list/);
        expect((await request(simApp).post(`/api/documents/${doc.id}/send`).send({})).status).toBe(403);
        expect((await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: 'abc' })).status).toBe(403);
        expect(sim.calls).toHaveLength(0);
        const log = (await request(owner).get('/api/documents/sends')).body;
        expect(log.some(x => x.status === 'refused' && x.document_id === doc.id)).toBe(true);
    });
    test('adding a person: phone is checked, shown as last 3 digits only, never returned in full', async () => {
        const body = { name: 'Nimal Perera', role: 'colleague', phone: '077 123 4567', allowed_types: ['pnl', 'cheques'] };
        const r = await request(owner).post('/api/documents/recipients').send(body);
        expect(r.status).toBe(201); expect(r.body.phone_hint).toBe('***567');
        expect(JSON.stringify(r.body)).not.toMatch(/1234567|94771234567/);
        const list = JSON.stringify((await request(owner).get('/api/documents/recipients')).body);
        expect(list).not.toMatch(/1234567/);
        const bad = b => request(owner).post('/api/documents/recipients').send({ ...body, ...b });
        expect((await bad({ phone: '12345' })).status).toBe(400);
        expect((await bad({ phone: '0112345678' })).status).toBe(400);   // landline: not a mobile
        expect((await bad({ name: ' ' })).status).toBe(400);
        expect((await bad({ role: 'boss' })).status).toBe(400);
        expect((await bad({ allowed_types: [] })).status).toBe(400);
        expect((await bad({ allowed_types: ['nonsense'] })).status).toBe(400);
        expect((await bad({ allowed_types: '*' })).status).toBe(400);
    });
    test('a person may only receive the document types they are allowed', async () => {
        const rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Only P&L', phone: '0772222222', allowed_types: ['pnl'] })).body;
        const [pnl] = await make('pnl', ['csv']); const [chq] = await make('cheques', ['csv']);
        const calls0 = sim.calls.length;
        const no = await request(simApp).post(`/api/documents/${chq.id}/send`).send({ recipient_id: rc.id });
        expect(no.status).toBe(403); expect(no.body.error).toMatch(/not allowed/);
        expect(sim.calls.length).toBe(calls0);
        expect((await request(simApp).post(`/api/documents/${pnl.id}/send`).send({ recipient_id: rc.id })).status).toBe(200);
        expect(sim.calls.length).toBe(calls0 + 1);
    });
    test('a removed or switched-off person cannot receive anything', async () => {
        const rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Gone', phone: '0773333333', allowed_types: ['*'] })).body;
        const [doc] = await make('pnl', ['csv']);
        await request(owner).put(`/api/documents/recipients/${rc.id}`).send({ active: false });
        expect((await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id })).status).toBe(403);
        await request(owner).delete(`/api/documents/recipients/${rc.id}`);
        expect((await request(owner).delete(`/api/documents/recipients/${rc.id}`)).status).toBe(404);
        expect((await request(owner).put('/api/documents/recipients/999999').send({ name: 'x' })).status).toBe(404);
    });
    test('editing keeps the stored number when no new one is given', async () => {
        const rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Edit Me', phone: '0774444444', allowed_types: ['pnl'] })).body;
        const u = await request(owner).put(`/api/documents/recipients/${rc.id}`).send({ name: 'Edited', allowed_types: ['pnl', 'stock'] });
        expect(u.status).toBe(200); expect(u.body.phone_hint).toBe('***444'); expect(u.body.allowed_types).toEqual(['pnl', 'stock']);
    });
});

describe('dry run (the default) and the live switches', () => {
    test('without the live flags nothing is sent, it is logged, queued as a document message, and no network is touched', async () => {
        const post = jest.spyOn(axios, 'post');
        const log = jest.spyOn(console, 'log').mockImplementation(() => {});
        const rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Dry', phone: '0775551234', allowed_types: ['*'] })).body;
        const [doc] = await make('pnl', ['csv']);
        const r = await request(owner).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: 'drytest' });
        expect(r.status).toBe(200); expect(r.body.result).toBe('dry_run'); expect(r.body.message).toMatch(/Nothing was sent/);
        expect(post).not.toHaveBeenCalled();
        const q = (await sharedPool.query(`SELECT * FROM receipt_queue WHERE sale_reference = $1`, [`DOC-${doc.id}-${rc.id}-drytest`])).rows;
        expect(q).toHaveLength(1); expect(q[0].status).toBe('doc_queued');
        const logged = log.mock.calls.map(c => c.join(' ')).join('\n');
        expect(logged).toMatch(/DRY RUN/); expect(logged).not.toMatch(/5551234|775551234/);   // last 3 digits at most
        const entry = (await request(owner).get('/api/documents/sends')).body.find(x => x.id === r.body.send_id);
        expect(entry).toMatchObject({ status: 'dry_run', to: '***234', requested_by: 'aj', document_id: doc.id });
        expect(JSON.stringify(entry)).not.toMatch(/5551234/);
    });
    test('a dry run does not use up the real send (it can be repeated)', async () => {
        const rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Dry2', phone: '0775559999', allowed_types: ['*'] })).body;
        const [doc] = await make('pnl', ['csv']);
        const s = () => request(owner).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id });
        expect((await s()).body.result).toBe('dry_run'); expect((await s()).body.result).toBe('dry_run');
        const rows = (await sharedPool.query(`SELECT id FROM receipt_queue WHERE sale_reference = $1`, [`DOC-${doc.id}-${rc.id}-share`])).rows;
        expect(rows).toHaveLength(1);                                     // one queue entry, not two
    });
    test('the existing receipt sender never picks up document messages (status is not "queued")', async () => {
        const rows = (await sharedPool.query(`SELECT status FROM receipt_queue WHERE sale_reference LIKE 'DOC-%'`)).rows;
        expect(rows.length).toBeGreaterThan(0); expect(rows.every(r => r.status.startsWith('doc_'))).toBe(true);
    });
    test('live only when BOTH flags and the keys are set', () => {
        const k = { WHATSAPP_API_TOKEN: 't', WHATSAPP_PHONE_NUMBER_ID: '1' };
        expect(T.pickTransport({}).name).toBe('dry_run');
        expect(T.pickTransport({ ...k }).name).toBe('dry_run');
        expect(T.pickTransport({ ...k, WHATSAPP_LIVE: 'true' }).name).toBe('dry_run');
        expect(T.pickTransport({ ...k, WHATSAPP_AUTO_SEND: 'true' }).name).toBe('dry_run');
        expect(T.pickTransport({ WHATSAPP_LIVE: 'true', WHATSAPP_AUTO_SEND: 'true' }).name).toBe('dry_run');   // no keys
        expect(T.pickTransport({ ...k, WHATSAPP_LIVE: 'true', WHATSAPP_AUTO_SEND: 'true' }).name).toBe('cloud_api');
    });
    test('the live transport sends the document through a (fake) http client and never logs the token', async () => {
        const tmp = path.join(ROOT, 'live-test.pdf'); fs.writeFileSync(tmp, PDF);
        const http = { post: jest.fn().mockResolvedValueOnce({ data: { id: 'MEDIA1' } }).mockResolvedValueOnce({ data: { messages: [{ id: 'wamid.1' }] } }) };
        const t = T.cloudApiTransport({ WHATSAPP_API_TOKEN: 'SECRET-TOKEN', WHATSAPP_PHONE_NUMBER_ID: '555' }, http);
        const out = await t.send({ to: '+94771234567', filePath: tmp, fileName: 'x.pdf', caption: 'c', mime: 'application/pdf' });
        expect(out.id).toBe('wamid.1');
        expect(http.post.mock.calls[1][1]).toMatchObject({ type: 'document', to: '94771234567' });
        expect(T.safeReason(new Error('bad SECRET-TOKEN for 94771234567'), { WHATSAPP_API_TOKEN: 'SECRET-TOKEN' })).not.toMatch(/SECRET-TOKEN|94771234567/);
    });
});

describe('one real send only (simulator transport)', () => {
    let rc, doc;
    beforeAll(async () => {
        rc = (await request(owner).post('/api/documents/recipients').send({ name: 'Live Sim', phone: '0776661234', allowed_types: ['*'] })).body;
        doc = (await make('pnl', ['csv']))[0];
    });
    test('first send goes out once, second and third are refused as duplicates', async () => {
        const before = sim.calls.length;
        const a = await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: 'monthly' });
        expect(a.status).toBe(200); expect(a.body.result).toBe('sent');
        const b = await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: 'monthly' });
        expect(b.status).toBe(409); expect(b.body.code).toBe('duplicate');
        expect((await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: 'monthly' })).status).toBe(409);
        expect(sim.calls.length).toBe(before + 1);
        expect(sim.calls[before]).toMatchObject({ to: '+94776661234', mime: 'text/csv' });
        const q = (await sharedPool.query(`SELECT status FROM receipt_queue WHERE sale_reference = $1`, [`DOC-${doc.id}-${rc.id}-monthly`])).rows;
        expect(q).toEqual([{ status: 'doc_sent' }]);
    });
    test('two clicks at the same moment send once', async () => {
        const d2 = (await make('cheques', ['csv']))[0]; const before = sim.calls.length;
        const rs = await Promise.all([1, 2, 3].map(() => request(simApp).post(`/api/documents/${d2.id}/send`).send({ recipient_id: rc.id, purpose: 'race' })));
        expect(rs.filter(r => r.status === 200)).toHaveLength(1);
        expect(sim.calls.length).toBe(before + 1);
    });
    test('another purpose or another document is a different send', async () => {
        const before = sim.calls.length;
        expect((await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: 'reminder' })).status).toBe(200);
        expect(sim.calls.length).toBe(before + 1);
    });
    test('a bad purpose is refused', async () => {
        expect((await request(simApp).post(`/api/documents/${doc.id}/send`).send({ recipient_id: rc.id, purpose: '../x y' })).status).toBe(400);
    });
    test('a failed send is logged, frees the key, and can be tried again', async () => {
        const d3 = (await make('stock', ['csv']))[0];
        const f = await request(failApp).post(`/api/documents/${d3.id}/send`).send({ recipient_id: rc.id, purpose: 'retry' });
        expect(f.status).toBe(502); expect(f.body.error).toMatch(/simulated failure/);
        const ok = await request(simApp).post(`/api/documents/${d3.id}/send`).send({ recipient_id: rc.id, purpose: 'retry' });
        expect(ok.status).toBe(200); expect(ok.body.result).toBe('sent');
        const log = (await request(owner).get('/api/documents/sends')).body.filter(x => x.document_id === d3.id).map(x => x.status).sort();
        expect(log).toEqual(['failed', 'sent']);
    });
    test('a missing file is reported, not sent', async () => {
        const d4 = (await make('stock', ['csv']))[0];
        const rel = (await sharedPool.query(`SELECT path FROM documents WHERE id = $1`, [d4.id])).rows[0].path;
        fs.unlinkSync(path.join(ROOT, ...rel.split('/')));
        const before = sim.calls.length;
        expect((await request(simApp).post(`/api/documents/${d4.id}/send`).send({ recipient_id: rc.id, purpose: 'gone' })).status).toBe(404);
        expect(sim.calls.length).toBe(before);
    });
    test('unknown document -> 404', async () => {
        expect((await request(simApp).post('/api/documents/999999/send').send({ recipient_id: rc.id })).status).toBe(404);
    });
});

describe('inbound files: quarantine', () => {
    const up = (app, buf, name, type, caption) => { const r = request(app).post('/api/documents/inbox/upload').attach('file', buf, { filename: name, contentType: type }); return caption ? r.field('caption', caption) : r; };
    const inboxFiles = () => fs.readdirSync(INBOX);

    test('a real PDF is accepted: random name in the quarantine folder, suggested place from the caption', async () => {
        const r = await up(owner, PDF, 'scan1.pdf', 'application/pdf', 'GRN from ABC Tiles');
        expect(r.status).toBe(201);
        expect(r.body).toMatchObject({ status: 'quarantined', mime: 'application/pdf', suggested_place: 'grn', suggested_label: 'GRN (goods received)' });
        expect(JSON.stringify(r.body)).not.toMatch(/file_name|sha256/);
        const row = (await sharedPool.query(`SELECT * FROM document_quarantine WHERE id = $1`, [r.body.id])).rows[0];
        expect(row.file_name).toMatch(/^[a-f0-9]{32}\.pdf$/);
        expect(fs.existsSync(path.join(INBOX, row.file_name))).toBe(true);
        expect(row.original_name).toBe('scan1.pdf');
    });
    test('type is checked by CONTENT, not by name or declared type', async () => {
        const before = inboxFiles().length;
        for (const [buf, name, type] of [[Buffer.from('MZ\x90\x00 this is a program'), 'invoice.pdf', 'application/pdf'], [Buffer.from('<?php echo 1;'), 'photo.png', 'image/png'], [Buffer.from('<script>alert(1)</script>'), 'x.jpg', 'image/jpeg'], [Buffer.from('plain text'), 'a.pdf', 'application/pdf']]) {
            const r = await up(owner, buf, name, type);
            expect(r.status).toBe(415);
        }
        expect(inboxFiles().length).toBe(before);                        // nothing was written
    });
    test('a real PNG renamed .pdf is accepted as what it really is (png)', async () => {
        const r = await up(owner, PNG, 'cheque_photo.pdf', 'application/pdf');
        expect(r.status).toBe(201); expect(r.body.mime).toBe('image/png'); expect(r.body.suggested_place).toBe('cheque_photo');
    });
    test('size limit: empty -> 400, over 10 MB -> 413, nothing kept', async () => {
        const before = inboxFiles().length;
        expect((await up(owner, Buffer.alloc(0), 'e.pdf', 'application/pdf')).status).toBe(400);
        const big = Buffer.concat([PDF, Buffer.alloc(Q.MAX_BYTES + 10, 1)]);
        expect((await up(owner, big, 'big.pdf', 'application/pdf')).status).toBe(413);
        expect(inboxFiles().length).toBe(before);
        expect((await request(owner).post('/api/documents/inbox/upload').send({})).status).toBe(400);
    });
    test('intake itself: the size limit and the detector are enforced, hostile names cannot choose the stored name', async () => {
        await expect(Q.intake(sharedPool, { buffer: PNG, root: INBOX, maxBytes: 10 })).rejects.toMatchObject({ status: 413 });
        await expect(Q.intake(sharedPool, { buffer: PNG, root: INBOX, detect: async () => null })).rejects.toMatchObject({ status: 415 });
        await expect(Q.intake(sharedPool, { buffer: 'not a buffer', root: INBOX })).rejects.toMatchObject({ status: 400 });
        const row = await Q.intake(sharedPool, { buffer: Buffer.concat([PNG, Buffer.from('unique-1')]), root: INBOX, detect: async () => 'png', originalName: '../../etc/passwd\r\n.png', caption: 'supplier bill' });
        expect(row.file_name).toMatch(/^[a-f0-9]{32}\.png$/); expect(row.original_name).not.toMatch(/[\r\n]/);
        expect(fs.existsSync(path.join(INBOX, row.file_name))).toBe(true);
        expect(row.suggested_place).toBe('supplier_bill');
    });
    test('the real file-type checker (mocked or missing) fails closed', async () => {
        let mocked;
        jest.isolateModules(() => {
            jest.doMock('file-type', () => ({ fileTypeFromBuffer: jest.fn() }));   // how other suites mock it: returns nothing
            mocked = require('../../utils/documents/quarantine').detectType(PNG);   // file-type is looked up at call time, inside this isolated registry
        });
        jest.dontMock('file-type');
        expect(await mocked).toBeNull();
        expect(await Q.detectType(PNG)).toBe('png');                              // the real checker accepts a real PNG
    });
    test('the same file twice is one waiting item', async () => {
        const buf = Buffer.concat([PDF, Buffer.from('dup-me')]);
        const a = await up(owner, buf, 'd.pdf', 'application/pdf'), b = await up(owner, buf, 'd.pdf', 'application/pdf');
        expect(a.status).toBe(201); expect(b.status).toBe(200); expect(b.body.id).toBe(a.body.id); expect(b.body.duplicate).toBe(true);
    });
    test('suggestions from names and captions', () => {
        expect(Q.suggestPlace('IMG_1.jpg', 'expenses 12 sept').place).toBe('expense_sheet');
        expect(Q.suggestPlace('chq_0012.png', '').place).toBe('cheque_photo');
        expect(Q.suggestPlace('abc-invoice.pdf', '').place).toBe('supplier_bill');
        expect(Q.suggestPlace('goods_received.pdf', '').place).toBe('grn');
        expect(Q.suggestPlace('IMG_20260901.jpg', '').place).toBeNull();
    });
    test('the list shows the places and what is waiting; the file is served inline-safe', async () => {
        const l = (await request(owner).get('/api/documents/inbox')).body;
        expect(l.places.map(p => p.key).sort()).toEqual(['cheque_photo', 'expense_sheet', 'grn', 'supplier_bill']);
        expect(l.items.length).toBeGreaterThan(0);
        const png = l.items.find(i => i.mime === 'image/png');
        const f = await request(owner).get(`/api/documents/inbox/${png.id}/file`);
        expect(f.status).toBe(200); expect(f.headers['content-disposition']).toMatch(/^attachment/); expect(f.headers['x-content-type-options']).toBe('nosniff'); expect(f.headers['content-security-policy']).toMatch(/sandbox/);
        expect((await request(owner).get('/api/documents/inbox?status=weird')).status).toBe(400);
        expect((await request(owner).get('/api/documents/inbox/99999/file')).status).toBe(404);
    });
    test('NOTHING is posted by arriving or by Confirm: no ledger table is even queried', async () => {
        const spy = jest.spyOn(sharedPool, 'query');
        const app = mk('admin', { handoff: async () => 1 });
        const u = await up(app, Buffer.concat([PDF, Buffer.from('ledger-check')]), 'expenses.pdf', 'application/pdf');
        await request(app).post(`/api/documents/inbox/${u.body.id}/confirm`).send({});
        const sql = spy.mock.calls.map(c => (typeof c[0] === 'string' ? c[0] : c[0].text)).join(' ');
        expect(sql).not.toMatch(/grn_records|pos_bills|daily_summary|expenses_detail|payments|cheque_register|supplier_|staff_salary|lasersoft/i);
        expect(sql).not.toMatch(/INSERT INTO (?!document_quarantine)/i);
    });
    test('Confirm hands over once to the existing inbox (stub), removes the quarantine file, and a second tap is refused', async () => {
        const handoff = jest.fn(async () => 777);
        const app = mk('admin', { handoff });
        const up1 = await up(app, Buffer.concat([PDF, Buffer.from('confirm-me')]), 'grn_1.pdf', 'application/pdf');
        const row = (await sharedPool.query(`SELECT * FROM document_quarantine WHERE id = $1`, [up1.body.id])).rows[0];
        const res = await request(app).post(`/api/documents/inbox/${up1.body.id}/confirm`).send({});
        expect(res.status).toBe(200); expect(res.body.inbox_id).toBe(777);
        expect(handoff).toHaveBeenCalledTimes(1); expect(handoff.mock.calls[0][0].place).toBe('grn');
        expect(fs.existsSync(path.join(INBOX, row.file_name))).toBe(false);
        expect((await request(app).post(`/api/documents/inbox/${up1.body.id}/confirm`).send({})).status).toBe(409);
        expect(handoff).toHaveBeenCalledTimes(1);
        const after = (await sharedPool.query(`SELECT status, inbox_id, decided_by FROM document_quarantine WHERE id = $1`, [up1.body.id])).rows[0];
        expect(after).toEqual({ status: 'confirmed', inbox_id: 777, decided_by: 'aj' });
    });
    test('Confirm needs a place; an unknown place is refused; the owner can override the suggestion', async () => {
        const handoff = jest.fn(async () => 5); const app = mk('admin', { handoff });
        const u = await up(app, Buffer.concat([PDF, Buffer.from('no-clue')]), 'IMG_0001.pdf', 'application/pdf');
        expect(u.body.suggested_place).toBeNull();
        expect((await request(app).post(`/api/documents/inbox/${u.body.id}/confirm`).send({})).status).toBe(400);
        expect((await request(app).post(`/api/documents/inbox/${u.body.id}/confirm`).send({ place: 'ledger' })).status).toBe(400);
        expect(handoff).not.toHaveBeenCalled();
        expect((await request(app).post(`/api/documents/inbox/${u.body.id}/confirm`).send({ place: 'expense_sheet' })).status).toBe(200);
        expect(handoff.mock.calls[0][0].place).toBe('expense_sheet');
        expect((await request(app).post('/api/documents/inbox/99999/confirm').send({ place: 'grn' })).status).toBe(404);
    });
    test('if the hand-over fails nothing is filed and the file stays waiting', async () => {
        const app = mk('admin', { handoff: async () => { throw new Error('inbox is down: secret detail'); } });
        const u = await up(app, Buffer.concat([PDF, Buffer.from('fail-me')]), 'grn_x.pdf', 'application/pdf');
        const r = await request(app).post(`/api/documents/inbox/${u.body.id}/confirm`).send({});
        expect(r.status).toBe(500); expect(r.body.error).toMatch(/Nothing was filed/); expect(JSON.stringify(r.body)).not.toMatch(/secret/);
        expect((await sharedPool.query(`SELECT status FROM document_quarantine WHERE id = $1`, [u.body.id])).rows[0].status).toBe('quarantined');
    });
    test('Reject deletes the file and cannot be repeated', async () => {
        const u = await up(owner, Buffer.concat([PDF, Buffer.from('reject-me')]), 'x.pdf', 'application/pdf');
        const row = (await sharedPool.query(`SELECT file_name FROM document_quarantine WHERE id = $1`, [u.body.id])).rows[0];
        expect((await request(owner).post(`/api/documents/inbox/${u.body.id}/reject`)).status).toBe(200);
        expect(fs.existsSync(path.join(INBOX, row.file_name))).toBe(false);
        expect((await request(owner).post(`/api/documents/inbox/${u.body.id}/reject`)).status).toBe(404);
        expect((await request(owner).post(`/api/documents/inbox/${u.body.id}/confirm`).send({ place: 'grn' })).status).toBe(409);
    });
    test('default hand-over goes into the EXISTING Document Inbox as a "to check" paper (nothing filed)', async () => {
        const real = express(); real.use(express.json());
        real.use((req, _r, n) => { req.session = { user: { role: 'admin', username: 'aj' } }; n(); });
        const router = createRouter(sharedPool, { root: ROOT, inboxRoot: INBOX });                 // default handoff
        real.use('/api', router);
        const u = await up(real, Buffer.concat([PNG, Buffer.from('to-inbox')]), 'cheque_77.png', 'image/png');
        const c = await request(real).post(`/api/documents/inbox/${u.body.id}/confirm`).send({});
        expect(c.status).toBe(200);
        const inb = (await sharedPool.query(`SELECT * FROM document_inbox WHERE id = $1`, [c.body.inbox_id])).rows[0];
        expect(inb).toMatchObject({ source: 'documents_quarantine', doc_type: 'cheque', status: 'to_check' });
        expect(fs.existsSync(inb.file_path)).toBe(true);
        expect(inb.file_path.startsWith(path.resolve(process.env.DROP_ROOT))).toBe(true);
    });
});

describe('reverse migration', () => {
    test('documents_down.sql drops exactly the four new tables', () => {
        const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'documents_down.sql'), 'utf8');
        const drops = [...sql.matchAll(/^DROP TABLE IF EXISTS (\w+);/gm)].map(m => m[1]).sort();
        expect(drops).toEqual(['document_quarantine', 'document_recipients', 'document_sends', 'documents']);
        const up = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'documents_up.sql'), 'utf8');
        expect([...up.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map(m => m[1]).sort()).toEqual(drops);
    });
});
