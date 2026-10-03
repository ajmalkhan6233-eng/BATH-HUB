'use strict';
jest.mock('file-type', () => ({ fromBuffer: jest.fn(), fileTypeFromBuffer: jest.fn() }));
const path = require('path');
const fileType = require('file-type');
const H = require('../../utils/hardening');

describe('safeJoin', () => {
    const base = path.resolve('/srv/uploads');
    test('plain names join inside the folder', () => {
        expect(H.safeJoin(base, 'abc123.webp')).toBe(path.join(base, 'abc123.webp'));
        expect(H.safeJoin(base, 'my file (1).jpg')).toBe(path.join(base, 'my file (1).jpg'));
    });
    const evil = ['..', '.', '../x', '..\\x', 'a/b', 'a\\b', '/etc/passwd', '\\\\host\\share', 'C:\\Windows\\x', 'C:x', 'c:/x',
        'a\0b', '', '%2e%2e', '%2E%2E%2Fx', '..%2fx', '%5cx', '%252e%252e', 'x%00.jpg', 'file.', 'file ', 'a..b', 'CON', 'nul.txt',
        'x'.repeat(300), 'file.txt:stream', 'a\nb', 'a|b', 'a*b'];
    test.each(evil)('rejects %j', n => {
        expect(() => H.safeJoin(base, n)).toThrow(H.UnsafePathError);
        expect(H.isSafeName(n)).toBe(false);
    });
    test('non-text and missing base are rejected', () => {
        expect(() => H.safeJoin(base, null)).toThrow();
        expect(() => H.safeJoin(base, ['a'])).toThrow();
        expect(() => H.safeJoin('', 'a')).toThrow();
    });
});

describe('sniffAllowed', () => {
    test('allowed real type passes, wrong type, unknown and errors give null', async () => {
        fileType.fromBuffer.mockResolvedValueOnce({ mime: 'image/png', ext: 'png' });
        expect(await H.sniffAllowed(Buffer.from('x'))).toEqual({ mime: 'image/png', ext: 'png' });
        fileType.fromBuffer.mockResolvedValueOnce({ mime: 'application/x-msdownload', ext: 'exe' });
        expect(await H.sniffAllowed(Buffer.from('x'))).toBeNull();
        fileType.fromBuffer.mockResolvedValueOnce(undefined);
        expect(await H.sniffAllowed(Buffer.from('x'))).toBeNull();
        fileType.fromBuffer.mockRejectedValueOnce(new Error('boom'));
        expect(await H.sniffAllowed(Buffer.from('x'))).toBeNull();
        expect(await H.sniffAllowed(Buffer.alloc(0))).toBeNull();
        expect(await H.sniffAllowed('not a buffer')).toBeNull();
    });
    test('custom allow-list', async () => {
        fileType.fromBuffer.mockResolvedValueOnce({ mime: 'application/pdf', ext: 'pdf' });
        expect(await H.sniffAllowed(Buffer.from('x'), H.DOCUMENTS)).toEqual({ mime: 'application/pdf', ext: 'pdf' });
        fileType.fromBuffer.mockResolvedValueOnce({ mime: 'application/pdf', ext: 'pdf' });
        expect(await H.sniffAllowed(Buffer.from('x'), H.IMAGES)).toBeNull();
    });
    test('requireRealType middleware answers 415 or continues', async () => {
        const mw = H.requireRealType(H.IMAGES, 'nope');
        const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
        const next = jest.fn();
        fileType.fromBuffer.mockResolvedValueOnce(undefined);
        await mw({ file: { buffer: Buffer.from('x') } }, res, next);
        expect(res.status).toHaveBeenCalledWith(415);
        expect(next).not.toHaveBeenCalled();
        const req = { file: { buffer: Buffer.from('x') } };
        fileType.fromBuffer.mockResolvedValueOnce({ mime: 'image/jpeg', ext: 'jpg' });
        await mw(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(req.file.sniffed.ext).toBe('jpg');
        await mw({}, res, next);
        expect(next).toHaveBeenCalledTimes(2);
    });
});

describe('guards', () => {
    const mkRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
    test('requestSizeGuard', () => {
        const g = H.requestSizeGuard(100), next = jest.fn(), res = mkRes();
        g({ headers: { 'content-length': '50' } }, res, next); expect(next).toHaveBeenCalledTimes(1);
        g({ headers: {} }, res, next); expect(next).toHaveBeenCalledTimes(2);
        g({ headers: { 'content-length': '101' } }, res, next); expect(res.status).toHaveBeenCalledWith(413);
        g({ headers: { 'content-length': 'abc' } }, res, next); expect(res.status).toHaveBeenCalledWith(400);
        expect(next).toHaveBeenCalledTimes(2);
    });
    test('jsonDepthGuard blocks deep and wide bodies, passes normal ones', () => {
        const g = H.jsonDepthGuard({ maxDepth: 5, maxNodes: 50 }), next = jest.fn(), res = mkRes();
        g({ body: { a: { b: [1, 2, { c: 1 }] } } }, res, next); expect(next).toHaveBeenCalledTimes(1);
        let deep = {}; const root = deep; for (let i = 0; i < 20; i++) { deep.n = {}; deep = deep.n; }
        g({ body: root }, res, next); expect(res.status).toHaveBeenCalledWith(400);
        g({ body: { list: new Array(100).fill(1) } }, res, next); expect(res.status).toHaveBeenCalledTimes(2);
        g({}, res, next); expect(next).toHaveBeenCalledTimes(2);
    });
    test('measure survives a 100000-deep body without a stack overflow', () => {
        let deep = []; const root = deep; for (let i = 0; i < 100000; i++) { const n = []; deep.push(n); deep = n; }
        expect(H.measure(root, 12, 2000).over).toBe('depth');
    });
});

describe('redaction', () => {
    test('phone numbers keep the last 3 digits', () => {
        expect(H.redactString('send to 94777999219 now')).toBe('send to ***219 now');
        expect(H.redactString('call 0777999219')).toBe('call ***219');
        expect(H.redactString('call +94 77 799 9219 please')).toBe('call ***219 please');
        expect(H.redactString('call 077 799 9219')).toBe('call ***219');
        expect(H.redactString('from 94777999219@c.us')).toBe('from ***219@c.us');
        expect(H.redactString('77 799 9219')).not.toContain('799 9219');
    });
    test('amounts, dates and ids are left alone', () => {
        const s = 'Rs 1,250,000 on 2026-10-03 12:30:45 bill 4521 id 3fa85f64-5717-4562-b3fc-2c963f66afa6 file a1b2c3d4e5f6a1b2c3d4e5f6.webp';
        expect(H.redactString(s)).toBe(s);
    });
    test('secrets in strings', () => {
        const cases = ['Authorization: Bearer abc.def.ghi-123456', 'Cookie: connect.sid=s%3Aabcdef; other=1', 'Set-Cookie: sid=zzz; Path=/',
            'BACKUP_PASSPHRASE=hunter2hunter2', 'GET /x?token=abc123&y=1', '{"password":"p4ss word"}', "apiKey: 'k-12345'",
            'Bearer sk_live_aaaaaaaaaaaa', 'jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghij', 'key sk-abcdefghijklmnopqrstuv',
            'hash ' + 'a'.repeat(64), 'pin=1234', 'ADMIN_PIN: 4321'];
        const secrets = ['abc.def.ghi-123456', 's%3Aabcdef', 'zzz', 'hunter2hunter2', 'abc123', 'p4ss word', 'k-12345', 'sk_live_aaaaaaaaaaaa',
            'eyJzdWIiOiIxMjM0In0', 'sk-abcdefghijklmnopqrstuv', 'a'.repeat(64), '1234', '4321'];
        cases.forEach((c, i) => expect(H.redactString(c)).not.toContain(secrets[i]));
        expect(H.redactString('GET /x?token=abc123&y=1')).toContain('y=1');
    });
    test('objects: deep, arrays, secret keys, phone keys; original untouched', () => {
        const orig = { user: 'ajmal', password: 'x', nested: { token: 'abc', list: [{ authorization: 'Bearer q' }, { phone: '0777999219' }], whatsapp_number: 94777999219 },
            headers: { cookie: 'a=b', 'x-api-key': 'zzz' }, note: 'ring 0777999219', n: 5, empty: '' , pin: ''};
        const copy = JSON.parse(JSON.stringify(orig));
        const r = H.redact(orig);
        expect(orig).toEqual(copy);
        expect(r.password).toBe(H.MASK);
        expect(r.nested.token).toBe(H.MASK);
        expect(r.nested.list[0].authorization).toBe(H.MASK);
        expect(r.nested.list[1].phone).toBe('***219');
        expect(r.nested.whatsapp_number).toBe('***219');
        expect(r.headers.cookie).toBe(H.MASK);
        expect(r.headers['x-api-key']).toBe(H.MASK);
        expect(r.note).toBe('ring ***219');
        expect(r.user).toBe('ajmal'); expect(r.n).toBe(5); expect(r.pin).toBe('');
    });
    test('cycles, depth, Buffers, Errors, null', () => {
        const a = { name: 'a' }; a.self = a;
        expect(H.redact(a).self).toBe('[circular]');
        let d = {}; const root = d; for (let i = 0; i < 30; i++) { d.x = {}; d = d.x; }
        expect(JSON.stringify(H.redact(root))).toContain('[too deep]');
        expect(H.redact(Buffer.from('secret'))).toBe('[Buffer 6 bytes]');
        expect(H.redact(null)).toBeNull(); expect(H.redact(undefined)).toBeUndefined();
        const e = H.redact(new Error('failed for 0777999219 token=abc'));
        expect(e.message).not.toContain('799921'); expect(e.message).not.toContain('abc');
    });
    test('createLogger and installConsoleRedaction apply it', () => {
        const sink = { log: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        const lg = H.createLogger('[x]', sink);
        lg.error('fail 0777999219', { password: 'pw', phone: '0777999219' }, new Error('Bearer abcdefgh1234'));
        const args = sink.error.mock.calls[0];
        expect(args[0]).toBe('[x]'); expect(args[1]).toBe('fail ***219');
        expect(args[2]).toEqual({ password: H.MASK, phone: '***219' });
        expect(String(args[3])).not.toContain('abcdefgh1234');
    });
    test('installConsoleRedaction: logs redacted, idempotent, undoable, can be switched off', () => {
        const calls = [];
        const target = { log: (...a) => calls.push(a), info() {}, warn() {}, error() {}, debug() {} };
        const undo = H.installConsoleRedaction(target, {});
        const second = H.installConsoleRedaction(target, {});
        target.log('to 94777999219', { token: 't' });
        expect(calls).toEqual([['to ***219', { token: H.MASK }]]);
        second(); undo();
        target.log('94777999219');
        expect(calls[1]).toEqual(['94777999219']);
        const off = { log: () => {} };
        const orig = off.log;
        H.installConsoleRedaction(off, { HARDENING_LOG_REDACT: 'off' });
        expect(off.log).toBe(orig);
    });
});

describe('rate limit factories', () => {
    test('defaults', () => {
        for (const f of [H.loginLimiter, H.publicApiLimiter, H.publicFileLimiter, H.strictLimiter]) expect(typeof f()).toBe('function');
        expect(H.isPrivateIp('192.168.1.5')).toBe(true);
        expect(H.isPrivateIp('::ffff:10.0.0.2')).toBe(true);
        expect(H.isPrivateIp('203.0.113.9')).toBe(false);
    });
});

describe('CSP', () => {
    const html = '<html><head><script type="application/ld+json">{"a":1}</script><style>body{color:red}</style><script src="/x.js"></script></head>'
        + '<body><script>alert(1)</script><script></script></body></html>';
    test('inlineHashes: one script, one style; data blocks and src scripts skipped', () => {
        const h = H.inlineHashes(html);
        expect(h.scripts).toHaveLength(1); expect(h.styles).toHaveLength(1);
        const crypto = require('crypto');
        expect(h.scripts[0]).toBe("'sha256-" + crypto.createHash('sha256').update('alert(1)').digest('base64') + "'");
    });
    test('policy has no unsafe-inline for scripts/styles, and the required directives', () => {
        const p = H.buildPolicy(html);
        expect(p).toMatch(/script-src 'self' 'sha256-/);
        expect(p).not.toMatch(/script-src[^;]*unsafe-inline/);
        expect(p).not.toMatch(/(^|; )style-src [^;]*unsafe-inline/);
        for (const d of ["frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "img-src 'self' data:", "connect-src 'self'",
            'https://fonts.googleapis.com', 'https://fonts.gstatic.com']) expect(p).toContain(d);
    });
    test('hash changes when the page changes (middleware re-reads on mtime change)', () => {
        const fs = require('fs'), os = require('os');
        const f = path.join(os.tmpdir(), 'csp_test_' + process.pid + '.html');
        fs.writeFileSync(f, '<script>one()</script>');
        const mw = H.siteSecurityHeaders({ file: f });
        const mk = () => { const hd = {}; return { hd, setHeader: (k, v) => { hd[k] = v; } }; };
        const r1 = mk(); mw({}, r1, () => {});
        fs.writeFileSync(f, '<script>two()</script>'); fs.utimesSync(f, new Date(), new Date(Date.now() + 5000));
        const r2 = mk(); mw({}, r2, () => {});
        fs.unlinkSync(f);
        expect(r1.hd['Content-Security-Policy']).not.toBe(r2.hd['Content-Security-Policy']);
        expect(r1.hd['X-Content-Type-Options']).toBe('nosniff');
        expect(r1.hd['Referrer-Policy']).toBeTruthy(); expect(r1.hd['Permissions-Policy']).toContain('camera=()');
    });
    test('missing file: base headers only, no throw', () => {
        const mw = H.siteSecurityHeaders({ file: path.join(__dirname, 'nope.html') });
        const hd = {}; const next = jest.fn();
        mw({}, { setHeader: (k, v) => { hd[k] = v; } }, next);
        expect(next).toHaveBeenCalled(); expect(hd['Content-Security-Policy']).toBeUndefined(); expect(hd['X-Content-Type-Options']).toBe('nosniff');
    });
});
