'use strict';
// BUG CHECK: named, automated, read-only checks. Static checks read files only. Live checks talk to a SCRATCH copy of the app
// (never the real one): run them with `npm run bugcheck` (scripts/bugcheck_scratch.js builds a scratch Postgres + app) or point
// BUGCHECK_BASE at a scratch app yourself. The script refuses port 3100 (the real app) and non-local addresses.
//   node scripts/bugcheck.js --static     static checks only
//   BUGCHECK_BASE=http://localhost:3190 BUGCHECK_USER=ajmal BUGCHECK_PASS=... node scripts/bugcheck.js
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const checks = [];
const add = (area, name, fn, opts = {}) => checks.push({ area, name, fn, live: !!opts.live, last: !!opts.last, known: opts.known || null });

// ───────── helpers ─────────
const walk = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter(f => f.endsWith(ext)).map(f => path.join(dir, f));
const ok = detail => ({ ok: true, detail });
const bad = detail => ({ ok: false, detail });
const skip = detail => ({ skip: true, detail });
const STACK_RE = /\n\s+at\s+\S+.*(\.js|node:internal)|node_modules[\\/]|\.js:\d+:\d+/;

// Public (no login) routes the auth gate in server.js lets through. Anything else must answer 401 without a login.
const PUBLIC = [
    /^\/api\/login$/, /^\/api\/auth\/verify-totp$/, /^\/api\/setup\//, /^\/api\/branding$/, /^\/api\/money-control\/viewer-requests$/,
    /^\/api\/public\/enquiry$/, /^\/api\/public\/catalogue$/, /^\/api\/site\/public$/, /^\/api\/site\/photo\//, /^\/api\/item-photos\//,
    /^\/api\/money-control\/viewer-dashboard$/, /^\/webhook\//,
];
const isPublic = p => PUBLIC.some(r => r.test(p));
// Files the owner has put off-limits for automatic fixes: failures found there are reported as 'pending sign-off', not as FAIL.
const GOLDEN = /^(server.js|routes[\/](audit|purchasing_accounting|staff_reports).js)$/;
// Never hit these in the bad-input barrage: they call outside services, spawn processes, or end the session.
const SKIP_BARRAGE = /^\/api\/(logout|login|system\/|admin\/|setup\/|dashboard-assistant|simulate|invoice-receipts\/send|whatsapp|notify|notifications\/send|auth\/)|process-inbox|webhook|\/send\b|ocr|assistant|agent-brain\/(run|chat)|layla/i;

// Find every route: file -> mount prefix from server.js, then router.METHOD('/x') and app.METHOD('/api/x').
function discoverRoutes() {
    const server = read('server.js');
    const mounts = {};
    for (const m of server.matchAll(/app\.use\(\s*'(\/[^']*)'\s*,\s*require\('\.\/routes\/([\w]+)'\)/g)) mounts[m[2]] = m[1];
    const out = [];
    const re = /\b(app|router)\.(get|post|put|patch|delete)\(\s*'(\/[^']*)'/g;
    for (const m of server.matchAll(re)) if (m[1] === 'app' && m[3].startsWith('/api')) out.push({ method: m[2], path: m[3], file: 'server.js' });
    for (const f of walk('routes', '.js')) {
        const name = path.basename(f, '.js'), prefix = mounts[name];
        if (prefix === undefined) continue;
        const src = read(f);
        for (const m of src.matchAll(re)) if (m[1] === 'router') out.push({ method: m[2], path: (prefix + m[3]).replace(/\/+/g, '/'), file: f });
    }
    const seen = new Set();
    return out.filter(r => { const k = r.method + ' ' + r.path; if (seen.has(k)) return false; seen.add(k); return true; });
}
const fill = p => p.replace(/:ym\b/g, '2026-10').replace(/:(date|day)\b/g, '2026-10-01').replace(/:[A-Za-z_]+/g, '1').replace(/\?$/, '');

// ═══════════════════════════ STATIC CHECKS ═══════════════════════════
add('mounting', 'every route file is mounted in server.js', async () => {
    const server = read('server.js'), miss = walk('routes', '.js').map(f => path.basename(f, '.js')).filter(n => !new RegExp(`routes/${n}'`).test(server));
    return miss.length ? bad('not mounted: ' + miss.join(', ')) : ok(`${walk('routes', '.js').length} route files mounted`);
});
add('mounting', 'route discovery finds the routes (sanity)', async () => { const n = discoverRoutes().length; return n > 150 ? ok(n + ' routes') : bad('only ' + n + ' routes found'); });
add('secrets', 'no .env, key or password file is tracked by git', async () => {
    const files = cp.execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 50e6 }).split('\n');
    const hit = files.filter(f => /(^|\/)\.env($|\.(?!example))|\.pem$|\.key$|pg_owner|TEMP_PASSWORDS|cookies\.txt/.test(f));
    return hit.length ? bad(hit.join(', ')) : ok('none tracked');
});
add('secrets', '.gitignore covers .env and the backups folder', async () => { const g = read('.gitignore'); return /^\.env$/m.test(g) && /backups\/\*\.sql/.test(g) ? ok() : bad('.env or backups/*.sql not ignored'); });
add('secrets', 'no key-like strings in tracked source', async () => {
    let out = '';
    try { out = cp.execSync('git grep -n -I -E "sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{30,}|xox[bp]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY" -- . ":!package-lock.json" ":!tests" ":!scripts/bugcheck.js"', { cwd: ROOT, encoding: 'utf8' }); } catch (e) { out = e.stdout || ''; }
    return out.trim() ? bad(out.trim().split('\n').slice(0, 3).map(l => l.replace(/:\d+:.*/, '')).join(', ')) : ok('none');
});
add('secrets', 'the real .env and password file were never committed (git history)', async () => {
    let out = '';
    try { out = cp.execSync('git log --all --oneline -- .env .pg_owner_superpw', { cwd: ROOT, encoding: 'utf8' }); } catch (e) { out = ''; }
    return out.trim() ? bad('.env or .pg_owner_superpw appears in history') : ok('never committed');
});
add('packages', 'npm audit summary (production deps): no critical', async () => {
    let j;
    // Under `npm run bugcheck` npm passes its own npm_* settings down; a nested `npm audit` then answers without a summary. Run it clean.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^npm_/i.test(k)));
    const opts = { cwd: ROOT, encoding: 'utf8', maxBuffer: 50e6, env };
    try { j = JSON.parse(cp.execSync('npm audit --omit=dev --json', opts)); } catch (e) { try { j = JSON.parse(e.stdout); } catch (e2) { return skip('npm audit unavailable (offline?)'); } }
    if (!j || !j.metadata || !j.vulnerabilities) return skip('npm audit gave no summary (offline or registry error)');
    const v = j.metadata.vulnerabilities, hi = Object.entries(j.vulnerabilities).filter(([, x]) => x.severity === 'high').map(([k]) => k);
    const line = `critical ${v.critical}, high ${v.high}, moderate ${v.moderate}, low ${v.low}${hi.length ? ' (high: ' + hi.slice(0, 6).join(', ') + ')' : ''}`;
    return v.critical ? bad(line) : ok(line);
});
add('env', '.env.example documents the float and backup settings', async () => { const e = read('.env.example'); const miss = ['PETTY_CASH_FLOAT', 'BACKUP_COPY_DIR', 'BACKUP_PASSPHRASE', 'SESSION_SECRET'].filter(k => !new RegExp('^' + k + '=', 'm').test(e)); return miss.length ? bad('missing ' + miss.join(', ')) : ok(); });
add('env', 'start-up warnings fire for a missing float and backup settings, and print no value', async () => {
    const { check } = require('../utils/startupChecks'); const w = check({ BACKUP_COPY_DIR: 'D:\\secret-dir' });
    return w.length === 2 && !w.join(' ').includes('secret-dir') ? ok() : bad(JSON.stringify(w).slice(0, 120));
});
add('env', 'production refuses to start with the 0000 PIN or no session secret (guards present)', async () => { const s = read('server.js'); return /SESSION_SECRET env var is not set/.test(s) && /ADMIN_PIN is unset or still the 0000/.test(s) ? ok() : bad('guard missing'); });
add('database', 'one shared pool with a max; only golden-core modules keep their own', async () => {
    const pool = read('utils/pool.js'); const own = walk('routes', '.js').filter(f => /new Pool\(/.test(read(f))).map(f => path.basename(f));
    const golden = ['audit.js', 'purchasing_accounting.js', 'staff_reports.js'], extra = own.filter(f => !golden.includes(f));
    if (!/max/.test(pool)) return bad('utils/pool.js has no max');
    return extra.length ? bad('own pool in: ' + extra.join(', ')) : ok('max set; own pools: ' + own.join(', '));
});
add('time', 'process timezone is Asia/Colombo', async () => { delete require.cache[require.resolve('../utils/timezone')]; const { TZ } = require('../utils/timezone'); return TZ === 'Asia/Colombo' && process.env.TZ === 'Asia/Colombo' ? ok() : bad('TZ=' + TZ); });
add('time', 'Colombo "today" is right across midnight (UTC is still yesterday until 05:30)', async () => {
    const { todayLK } = require('../utils/lkTime');
    const a = todayLK(new Date('2026-10-03T19:00:00Z')), b = todayLK(new Date('2026-10-03T18:29:59Z')), c = todayLK(new Date('2026-03-31T18:30:00Z'));
    return a === '2026-10-04' && b === '2026-10-03' && c === '2026-04-01' ? ok('18:30 UTC flips the day') : bad([a, b, c].join(' '));
});
add('time', 'month-end and leap-year day counts (days in month for the overhead reserve)', async () => {
    const dim = (y, m) => new Date(y, m, 0).getDate();
    return dim(2026, 2) === 28 && dim(2028, 2) === 29 && dim(2026, 4) === 30 && dim(2026, 12) === 31 ? ok() : bad('wrong days');
});
add('time', '25th-to-24th pay cycle: is there any code for it?', async () => {
    const hit = [...walk('routes', '.js'), 'utils/salaryMath.js'].filter(f => /(25th|cycle_start|pay.?cycle|\b24th\b)/i.test(read(f)));
    return skip(hit.length ? 'found in ' + hit.join(', ') : 'no 25th-to-24th cycle in code: salary uses calendar months (owner to confirm the rule)');
});
add('money', 'money2 rounds to 2 decimals (half cents, floats, negatives)', async () => {
    const { money2 } = require('../utils/salaryMath');
    const cases = [[1.005, 1.01], [2.675, 2.68], [0.1 + 0.2, 0.3], [1e6 + 0.004, 1000000], [-1.005, -1.0], [49.995, 50]];
    const wrong = cases.filter(([i, o]) => money2(i) !== o).map(([i, o]) => `${i}->${money2(i)} (want ${o})`);
    return wrong.length ? bad(wrong.join('; ')) : ok();
});
add('errors', 'no route sends err.stack to the client', async () => {
    const hit = [...walk('routes', '.js'), 'server.js'].filter(f => /res\.(status\(\d+\)\.)?json\([^)]*\.stack/.test(read(f)));
    return hit.length ? bad(hit.join(', ')) : ok();
});
add('errors', 'unhandled promise rejections: handler present or Express 5 async forwarding', async () => {
    const s = read('server.js'), ver = require('express/package.json').version;
    return /unhandledRejection/.test(s) || /^5\./.test(ver) ? ok('express ' + ver) : bad('Express ' + ver + ' without an unhandledRejection handler');
});
add('uploads', 'every upload route has a size limit', async () => {
    const miss = [...walk('routes', '.js'), 'server.js'].filter(f => /multer\(/.test(read(f)) && !/limits:/.test(read(f)));
    return miss.length ? bad(miss.join(', ')) : ok();
});
add('uploads', 'upload routes sniff the file content (file-type), not just the name', async () => {
    const files = [...walk('routes', '.js'), 'server.js'].filter(f => /multer\(/.test(read(f)) && !/file-type|fileTypeFromBuffer|siteImage|sniff|savePhoto/i.test(read(f)));
    return files.length ? bad('no content check: ' + files.join(', ')) : ok();
});
add('backup', 'encrypted backup round-trip: encrypt, wrong passphrase fails, decrypt equals the original', async () => {
    const os = require('os'), { encryptFile, decryptFile } = require('../utils/backupCrypto');
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'bc-')), src = path.join(d, 'a.sql'); fs.writeFileSync(src, 'SELECT 1;\n'.repeat(5000));
    await encryptFile(src, path.join(d, 'a.enc'), 'bugcheck-passphrase'); await decryptFile(path.join(d, 'a.enc'), path.join(d, 'b.sql'), 'bugcheck-passphrase');
    if (fs.readFileSync(src, 'utf8') !== fs.readFileSync(path.join(d, 'b.sql'), 'utf8')) return bad('round trip differs');
    try { await decryptFile(path.join(d, 'a.enc'), path.join(d, 'c.sql'), 'wrong-passphrase'); return bad('wrong passphrase was accepted'); } catch (e) { return ok(); }
});
add('backup', 'a recent local database backup exists (under 3 days old)', async () => {
    const dir = path.join(ROOT, 'backups'); if (!fs.existsSync(dir)) return skip('no backups folder here');
    const f = fs.readdirSync(dir).filter(x => /^bathco_owner-.*\.sql$/.test(x)).map(x => ({ x, t: fs.statSync(path.join(dir, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
    if (!f) return skip('no backup file in this folder');
    const days = (Date.now() - f.t) / 86400000; return days < 3 ? ok(f.x + `, ${days.toFixed(1)} days old`) : bad(f.x + `, ${days.toFixed(1)} days old`);
});
add('backup', 'the restore script refuses to touch the real database name', async () => { const s = read('scripts/restore_encrypted_backup.js'); return /restore_test_/.test(s) && /name === env\.DB_NAME/.test(s) ? ok() : bad('guard missing'); });
add('pages', 'every screen file has a viewport tag and a page title', async () => {
    const miss = fs.readdirSync(path.join(ROOT, 'public')).filter(f => f.endsWith('.html')).filter(f => { const s = read('public/' + f); return !/name="viewport"/.test(s) || !/<title>/i.test(s); });
    return miss.length ? bad(miss.join(', ')) : ok();
});
add('pages', 'no CDN script or stylesheet in the owner app screens (offline-safe)', async () => {
    const owner = fs.readdirSync(path.join(ROOT, 'public')).filter(f => f.endsWith('.html') && !/^(bathhub|setup|investor-view)\.html$/.test(f));
    const hit = owner.filter(f => /<(script|link)[^>]+(src|href)="https?:\/\/(?!wa\.me)/.test(read('public/' + f)));
    return hit.length ? bad(hit.join(', ')) : ok();
});

// ═══════════════════════════ LIVE CHECKS (scratch app) ═══════════════════════════
// Splits 5xx findings into ours (FAIL) and golden-core (pending the owner's sign-off, reported but not failed).
function verdict(c, entries, what) {
    const fileOf = e => { const m = e.match(/^(GET|POST|PUT|PATCH|DELETE) (\S+)/); const r = c.routes.find(x => x.method === m[1].toLowerCase() && x.path === m[2]); return r ? r.file : '?'; };
    const routesOf = l => [...new Set(l.map(x => x.split(' ').slice(0, 2).join(' ')))];
    const mine = entries.filter(e => !GOLDEN.test(fileOf(e))), gold = entries.filter(e => GOLDEN.test(fileOf(e)));
    const g = gold.length ? ` | ${routesOf(gold).length} golden-core routes pending sign-off` : '';
    return mine.length ? bad(`${routesOf(mine).length} routes answered 5xx: ` + routesOf(mine).slice(0, 8).join(' | ') + g) : ok(what + g);
}
const LIVE = { live: true };
add('live', 'health answers ok', async c => { const r = await c.req('GET', '/health'); return r.status === 200 && /ok/.test(r.text) ? ok() : bad('status ' + r.status); }, LIVE);
add('live', '/owner shows the login screen when signed out', async c => { const r = await c.req('GET', '/owner'); return r.status === 200 && /id="login-overlay"/.test(r.text) ? ok() : bad('status ' + r.status); }, LIVE);
add('auth', 'every owner GET route answers 401 without a login', async c => {
    const off = []; let n = 0;
    for (const r of c.routes.filter(x => x.method === 'get' && !isPublic(x.path))) { n++; const res = await c.req('GET', fill(r.path)); if (res.status !== 401) off.push(`${r.path}=${res.status}`); }
    return off.length ? bad(off.slice(0, 8).join(', ') + (off.length > 8 ? ` (+${off.length - 8})` : '')) : ok(n + ' routes');
}, LIVE);
add('auth', 'every owner write route answers 401 without a login', async c => {
    const off = []; let n = 0;
    for (const r of c.routes.filter(x => x.method !== 'get' && !isPublic(x.path))) { n++; const res = await c.req(r.method.toUpperCase(), fill(r.path), { body: {} }); if (res.status !== 401) off.push(`${r.method} ${r.path}=${res.status}`); }
    return off.length ? bad(off.slice(0, 8).join(', ')) : ok(n + ' routes');
}, LIVE);
add('auth', 'a staff login is refused (403) on every owner write route', async c => {
    if (!c.staff) return skip('no staff login on scratch');
    const off = []; let n = 0;
    for (const r of c.routes.filter(x => x.method !== 'get' && !isPublic(x.path) && !SKIP_BARRAGE.test(x.path))) { n++; const res = await c.req(r.method.toUpperCase(), fill(r.path), { body: {}, cookie: c.staff }); if (res.status !== 403) off.push(`${r.method} ${r.path}=${res.status}`); }
    return off.length ? bad(off.slice(0, 8).join(', ')) : ok(n + ' routes');
}, LIVE);
add('auth', 'a staff login cannot read other people\'s data (GET routes 403 except own data)', async c => {
    if (!c.staff) return skip('no staff login');
    const off = []; let n = 0;
    for (const r of c.routes.filter(x => x.method === 'get' && !isPublic(x.path) && !/^\/api\/(me|logout)$/.test(x.path) && !/^\/api\/staff\/:id\//.test(x.path))) { n++; const res = await c.req('GET', fill(r.path), { cookie: c.staff }); if (res.status !== 403 && res.status !== 404) off.push(`${r.path}=${res.status}`); }
    return off.length ? bad(off.slice(0, 8).join(', ')) : ok(n + ' routes');
}, LIVE);
add('public', 'the public website feed shows only tiles and site text (no private fields)', async c => {
    const r = await c.req('GET', '/api/site/public'); const j = JSON.parse(r.text);
    const tileKeys = new Set((j.tiles || []).flatMap(t => Object.keys(t))); const bad1 = [...tileKeys].filter(k => !['id', 'name', 'size', 'finish', 'group', 'photoUrl'].includes(k));
    const extra = Object.keys(j).filter(k => !['tiles', 'text'].includes(k));
    return bad1.length || extra.length ? bad('extra keys ' + [...bad1, ...extra].join(',')) : ok();
}, LIVE);
add('public', 'public endpoints leak no cost, profit, staff, loan or phone words', async c => {
    const out = [];
    for (const u of ['/api/site/public', '/api/public/catalogue', '/api/branding', '/api/setup/status', '/health', '/site']) {
        const r = await c.req('GET', u); if (r.status !== 200) continue;
        const m = r.text.match(/"(avg_cost|cost|profit|margin|salary|staff|loan|password|password_hash|totp_secret|supplier|customer_phone)"/i); if (m) out.push(u + ':' + m[1]);
    }
    return out.length ? bad(out.join(', ')) : ok();
}, LIVE);
add('public', 'dot-files, source and package files are not served', async c => {
    const off = []; for (const u of ['/.env', '/.git/config', '/package.json', '/server.js', '/routes/audit.js', '/node_modules/express/package.json', '/backups/', '/uploads/', '/.pg_owner_superpw']) { const r = await c.req('GET', u); if (r.status === 200 && !/id="login-overlay"/.test(r.text)) off.push(u + '=' + r.status); }
    return off.length ? bad(off.join(', ')) : ok();
}, LIVE);
add('public', 'path traversal is refused (item photos, site photos, downloads)', async c => {
    const off = []; for (const u of ['/api/item-photos/..%2f..%2f.env', '/api/item-photos/%2e%2e/%2e%2e/server.js', '/api/site/photo/..%2fserver.js', '/..%2f..%2fserver.js', '/api/attachments/1/download/../../../../.env']) { const r = await c.req('GET', u, { cookie: c.admin }); if (r.status === 200 && /require\(|DB_PASSWORD|SESSION_SECRET/.test(r.text)) off.push(u); }
    return off.length ? bad(off.join(', ')) : ok();
}, LIVE);
add('public', 'first-run setup is locked once an admin exists', async c => {
    const r = await c.req('POST', '/api/setup/create-admin', { body: { username: 'x', password: 'LongEnough123!' } }); const s = await c.req('GET', '/api/setup/status');
    return /"setup_needed":false/.test(s.text) && r.status >= 400 && r.status < 500 ? ok('POST ' + r.status) : bad('status ' + s.text.slice(0, 60) + ' POST ' + r.status);
}, LIVE);
add('headers', 'security headers on (nosniff, no x-powered-by) and CORS is not open', async c => {
    const r = await c.req('GET', '/site', { headers: { Origin: 'https://evil.example' } }); const h = r.headers;
    const probs = []; if (h['x-content-type-options'] !== 'nosniff') probs.push('no nosniff'); if (h['x-powered-by']) probs.push('x-powered-by shown'); if (h['access-control-allow-origin']) probs.push('CORS header: ' + h['access-control-allow-origin']);
    return probs.length ? bad(probs.join(', ')) : ok();
}, LIVE);
add('headers', 'the session cookie is httpOnly', async c => { const r = await c.req('POST', '/api/login', { body: { username: c.user, password: c.pass } }); const ck = [].concat(r.headers['set-cookie'] || []).join(';'); return /httponly/i.test(ck) ? ok() : bad('cookie: ' + ck.slice(0, 80)); }, LIVE);
add('input', 'malformed JSON is a 400, not a 500', async c => { const r = await c.req('POST', '/api/pos-bills', { raw: '{"items": [', cookie: c.admin, headers: { 'Content-Type': 'application/json' } }); return r.status === 400 ? ok() : bad('status ' + r.status + ' ' + r.text.slice(0, 80)); }, LIVE);
add('input', 'a 2 MB JSON body is refused (413), not processed', async c => { const r = await c.req('POST', '/api/pos-bills', { raw: JSON.stringify({ notes: 'x'.repeat(2 * 1024 * 1024) }), cookie: c.admin, headers: { 'Content-Type': 'application/json' } }); return r.status === 413 ? ok() : bad('status ' + r.status); }, LIVE);
add('input', 'POS bill: negative, zero, huge, text and null quantities and prices are 400', async c => {
    const cases = [{ qty: -1, unit_price: 5 }, { qty: 0, unit_price: 5 }, { qty: 1, unit_price: -5 }, { qty: 1e12, unit_price: 5 }, { qty: 'abc', unit_price: 5 }, { qty: null, unit_price: 5 }, { qty: 1, unit_price: 1e15 }];
    const off = []; for (const [i, x] of cases.entries()) { const r = await c.req('POST', '/api/pos-bills', { body: { items: [{ item_name: 'T', ...x }] }, cookie: c.admin }); if (r.status !== 400) off.push(i + '=' + r.status); }
    return off.length ? bad('cases ' + off.join(', ')) : ok(cases.length + ' cases');
}, LIVE);
add('input', 'POS bill: discount over 100 or negative is refused', async c => { const a = await c.req('POST', '/api/pos-bills', { body: { items: [{ item_name: 'T', qty: 1, unit_price: 5 }], discount_pct: 150 }, cookie: c.admin }); const b = await c.req('POST', '/api/pos-bills', { body: { items: [{ item_name: 'T', qty: 1, unit_price: 5 }], discount_pct: -5 }, cookie: c.admin }); return a.status === 400 && b.status === 400 ? ok() : bad(`150%=${a.status} -5%=${b.status}`); }, LIVE);
add('money', 'POS bill rounding: totals have 2 decimals and total = subtotal - discount', async c => {
    const r = await c.req('POST', '/api/pos-bills', { body: { items: [{ item_name: 'Odd', qty: 3, unit_price: 33.335 }, { item_name: 'Odd2', qty: 1.5, unit_price: 19.99 }], discount_pct: 7.5 }, cookie: c.admin }); const j = JSON.parse(r.text);
    const two = v => Math.abs(Number(v) * 100 - Math.round(Number(v) * 100)) < 1e-6;
    return r.status === 200 && two(j.subtotal) && two(j.discount_amount) && two(j.total) && Math.abs(Number(j.subtotal) - Number(j.discount_amount) - Number(j.total)) < 0.006 ? ok(`subtotal ${j.subtotal}, total ${j.total}`) : bad(r.text.slice(0, 160));
}, LIVE);
add('money', 'POS bill number uses the Colombo date', async c => {
    const { todayLK } = require('../utils/lkTime'); const r = await c.req('POST', '/api/pos-bills', { body: { items: [{ item_name: 'D', qty: 1, unit_price: 10 }] }, cookie: c.admin }); const j = JSON.parse(r.text);
    return j.bill_number && j.bill_number.includes(todayLK().replace(/-/g, '')) ? ok(j.bill_number) : bad(String(j.bill_number) + ' vs ' + todayLK());
}, LIVE);
add('idempotency', 'double submit with the same key creates ONE bill and the replay is flagged', async c => {
    const key = require('crypto').randomUUID(), body = { items: [{ item_name: 'Twice', qty: 1, unit_price: 77 }] };
    const a = await c.req('POST', '/api/pos-bills', { body, cookie: c.admin, headers: { 'X-Idempotency-Key': key } }), b = await c.req('POST', '/api/pos-bills', { body, cookie: c.admin, headers: { 'X-Idempotency-Key': key } });
    const ja = JSON.parse(a.text), jb = JSON.parse(b.text);
    return a.status === 200 && b.status === 200 && ja.bill_number === jb.bill_number && b.headers['x-idempotent-replay'] === '1' ? ok(ja.bill_number) : bad(`${a.status}/${b.status} ${ja.bill_number}/${jb.bill_number}`);
}, LIVE);
add('idempotency', 'a bad key (not a UUID) does not break the request', async c => { const r = await c.req('POST', '/api/pos-bills', { body: { items: [{ item_name: 'K', qty: 1, unit_price: 5 }] }, cookie: c.admin, headers: { 'X-Idempotency-Key': 'not-a-uuid' } }); return r.status === 200 || r.status === 400 ? ok('status ' + r.status) : bad('status ' + r.status); }, LIVE);
add('money', 'cheques: negative, zero or text amounts and impossible dates are refused', async c => {
    const mk = x => c.req('POST', '/api/cheque-register', { body: { payee: 'Bug', amount: 1000, due_date: '2026-10-10', ...x }, cookie: c.admin });
    const res = await Promise.all([mk({ amount: -5 }), mk({ amount: 0 }), mk({ amount: 'abc' }), mk({ due_date: '2026-02-30' }), mk({ due_date: '2026-13-01' }), mk({ due_date: 'tomorrow' })]);
    const off = res.map((r, i) => (r.status === 400 ? null : i + '=' + r.status)).filter(Boolean); return off.length ? bad(off.join(', ')) : ok();
}, LIVE);
add('money', 'investor loans: negative or text amounts and rates are refused; an unknown loan is 404', async c => {
    const mk = x => c.req('POST', '/api/investor-loans', { body: { lender_name: 'B', amount: 1000, date_given: '2026-10-01', ...x }, cookie: c.admin });
    const res = await Promise.all([mk({ amount: -1 }), mk({ amount: 'x' }), mk({ profit_rate: 500 }), mk({ date_given: '31/12/2026' })]); const nf = await c.req('GET', '/api/investor-loans/999999', { cookie: c.admin });
    const off = res.map((r, i) => (r.status === 400 ? null : i + '=' + r.status)).filter(Boolean); return off.length || nf.status !== 404 ? bad(off.join(', ') + ' notfound=' + nf.status) : ok();
}, LIVE);
add('money', 'investor loan repayments: a payment cannot be negative; balances never show NaN', async c => {
    const l = JSON.parse((await c.req('POST', '/api/investor-loans', { body: { lender_name: 'Pay', amount: 1000, profit_rate: 10, date_given: '2026-10-01' }, cookie: c.admin })).text);
    const neg = await c.req('POST', `/api/investor-loans/${l.id}/payments`, { body: { amount: -50, payment_date: '2026-10-02' }, cookie: c.admin });
    const g = await c.req('GET', `/api/investor-loans/${l.id}`, { cookie: c.admin }); return neg.status === 400 && !/NaN|null/.test(JSON.parse(g.text).outstanding + '') ? ok() : bad(`neg=${neg.status} outstanding=${JSON.parse(g.text).outstanding}`);
}, LIVE);
add('money', 'stock cannot be adjusted into a negative count', async c => {
    const it = await c.req('POST', '/api/stock-items', { body: { item_name: 'BugcheckItem', unit: 'pcs', current_qty: 2 }, cookie: c.admin });
    if (it.status >= 300) return skip('stock-items create answered ' + it.status);
    const id = JSON.parse(it.text).id; const adj = await c.req('POST', `/api/stock-items/${id}/adjust`, { body: { qty_change: -50, reason: 'correction' }, cookie: c.admin });
    const adj2 = await c.req('POST', `/api/stock-items/${id}/adjust`, { body: { delta: -50, reason: 'correction' }, cookie: c.admin });
    const g = await c.req('GET', '/api/stock-items', { cookie: c.admin }); const row = (JSON.parse(g.text) || []).find(x => x.id === id);
    return row && Number(row.current_qty) < 0 ? bad('stock went to ' + row.current_qty) : ok(`adjust ${adj.status}/${adj2.status}, qty ${row && row.current_qty}`);
}, { live: true, known: 'should a count be allowed to go below zero? see BUGS2' });
add('input', 'unicode (Sinhala, Tamil, emoji) names are stored and returned intact', async c => {
    const name = 'සුනිල් தமிழ் 😀 Perera'; const r = await c.req('POST', '/api/customers', { body: { name, phone: '0771234567' }, cookie: c.admin });
    if (r.status >= 300) return skip('customers create answered ' + r.status); const g = await c.req('GET', '/api/customers', { cookie: c.admin });
    return JSON.stringify(JSON.parse(g.text)).includes(JSON.stringify(name).slice(1, -1)) ? ok() : bad('name not returned intact');
}, LIVE);
add('input', 'SQL characters in text fields are stored as text and break nothing', async c => {
    const evil = "Robert'); DROP TABLE users;--"; const r = await c.req('POST', '/api/customers', { body: { name: evil }, cookie: c.admin });
    const me = await c.req('GET', '/api/me', { cookie: c.admin }); return me.status === 200 && r.status < 500 ? ok('customer ' + r.status + ', users table alive') : bad(`create ${r.status}, me ${me.status}`);
}, LIVE);
add('uploads', 'an .exe renamed .pdf is refused by the attachment upload', async c => { const r = await c.upload('/api/attachments', { file: { name: 'invoice.pdf', type: 'application/pdf', data: Buffer.concat([Buffer.from('MZ'), Buffer.alloc(300, 1)]) }, fields: { record_type: 'grn', record_id: 'bugcheck' } }); return r.status >= 400 && r.status < 500 ? ok('status ' + r.status) : bad('status ' + r.status + ' ' + r.text.slice(0, 80)); }, LIVE);
add('uploads', 'a file over the size limit is refused (not 500)', async c => { const r = await c.upload('/api/attachments', { file: { name: 'big.png', type: 'image/png', data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(12 * 1024 * 1024, 1)]) }, fields: { record_type: 'grn', record_id: 'bugcheck' } }); return r.status >= 400 && r.status < 500 ? ok('status ' + r.status) : bad('status ' + r.status); }, LIVE);
add('uploads', 'a path-like file name cannot escape the upload folder', async c => { const r = await c.upload('/api/attachments', { file: { name: '..\\..\\..\\evil.png', type: 'image/png', data: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082', 'hex') }, fields: { record_type: 'grn', record_id: 'bugcheck' } }); return r.status < 500 && !/\.\.[\\/]/.test(r.text) ? ok('status ' + r.status) : bad('status ' + r.status); }, LIVE);
add('input', 'bad input on EVERY write route never gives a 500 or a stack trace (barrage)', async c => {
    const payloads = [{}, { amount: -5, qty: -1, unit_price: 1e15, name: "'; DROP TABLE users;--", date: 'not-a-date', payment_date: '2026-13-45', due_date: '2026-02-30', id: null, items: null, lines: 'x', notes: '😀'.repeat(400) }, { amount: null, qty: null, name: null, items: [], lines: [] }, { amount: 'abc', qty: 'abc', name: 'ශ්‍රී'.repeat(300), date: '', items: [{}], lines: [{}], payload: 'not json' }, { amount: 1e308, qty: -1e308, unit_price: Number.MAX_SAFE_INTEGER, items: [{ item_name: 'x', qty: 1e308, unit_price: 1e308 }] }, JSON.parse('{"__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}')];
    const routes = c.routes.filter(r => r.method !== 'get' && !isPublic(r.path) && !SKIP_BARRAGE.test(r.path)); c.barrage = { fivexx: [], stacks: [], n: 0, routes: routes.length };
    for (const r of routes) for (const [i, p] of payloads.entries()) {
        const res = await c.req(r.method.toUpperCase(), fill(r.path), { body: p, cookie: c.admin }); c.barrage.n++;
        if (res.status >= 500) c.barrage.fivexx.push(`${r.method.toUpperCase()} ${r.path} payload#${i} -> ${res.status} ${res.text.replace(/\s+/g, ' ').slice(0, 110)}`);
        if (STACK_RE.test(res.text)) c.barrage.stacks.push(`${r.method.toUpperCase()} ${r.path} payload#${i}`);
    }
    const u = null;
    return verdict(c, c.barrage.fivexx, `${c.barrage.n} requests on ${routes.length} routes`);
}, LIVE);
add('input', 'bad query values (dates, numbers, limits, SQL characters) on every GET route never give a 500', async c => {
    const qs = ['?date=abc&from=x&to=y&month=13&ym=2026-99&days=-5&months=999999&limit=-1&offset=-9&page=0', '?date=2026-02-30&from=2026-13-01&to=0000-00-00&days=1e99&limit=99999999999999999999', "?status=%27%3B--&q=%F0%9F%98%80&search=%25&type=%00&category=%22", '?from=2026-10-05&to=2026-10-01&days=0&months=0&year=abc'];
    const routes = c.routes.filter(r => r.method === 'get' && !isPublic(r.path) && !SKIP_BARRAGE.test(r.path)), off = []; c.getBarrage = off;
    for (const r of routes) for (const [i, q] of qs.entries()) { const res = await c.req('GET', fill(r.path) + q, { cookie: c.admin }); if (res.status >= 500) off.push(`GET ${r.path} query#${i} -> ${res.status} ${res.text.replace(/\s+/g, ' ').slice(0, 100)}`); if (STACK_RE.test(res.text)) off.push(`GET ${r.path} query#${i} STACK`); }
    return verdict(c, off, routes.length + ' routes x ' + qs.length);
}, LIVE);
add('input', 'bad ids in the address (text, negative, huge) on every GET route never give a 500', async c => {
    const routes = c.routes.filter(r => r.method === 'get' && /:[A-Za-z_]+/.test(r.path) && !isPublic(r.path) && !SKIP_BARRAGE.test(r.path)), off = []; c.idBarrage = off;
    for (const r of routes) for (const v of ['abc', '-1', '99999999999999999999', '0', '%27%20OR%201=1']) { const res = await c.req('GET', r.path.replace(/:ym/g, '2026-10').replace(/:[A-Za-z_]+/g, v), { cookie: c.admin }); if (res.status >= 500) off.push(`GET ${r.path} id=${v} -> ${res.status} ${res.text.replace(/\s+/g, ' ').slice(0, 100)}`); }
    return verdict(c, off, routes.length + ' routes');
}, LIVE);
add('errors', 'no stack trace or file path in any barrage response', async c => (c.barrage ? (c.barrage.stacks.length ? bad(c.barrage.stacks.slice(0, 5).join(' | ')) : ok()) : skip('barrage did not run')), LIVE);
add('errors', 'the app is still alive after the barrage', async c => { const r = await c.req('GET', '/health'); return r.status === 200 ? ok() : bad('status ' + r.status); }, LIVE);
add('errors', 'no unhandled rejection or crash in the server log', async c => { const log = c.serverLog(); const m = log.match(/UnhandledPromiseRejection|unhandledRejection|FATAL|uncaughtException/); return m ? bad('log has: ' + m[0]) : ok(); }, LIVE);
add('database', 'connection count stays low after the barrage (shared pool)', async c => { const n = await c.dbCount(); return n === null ? skip('no db access') : n <= 30 ? ok(n + ' connections') : bad(n + ' connections'); }, LIVE);
add('env', 'the server printed the missing-float and backup warnings at start-up', async c => { const log = c.serverLog(); return /PETTY_CASH_FLOAT is not set/.test(log) && /BACKUP_COPY_DIR/.test(log) ? ok() : bad('warnings not in log'); }, LIVE);
add('pages', 'owner screens: no console errors and no sideways scroll at 390px', async c => {
    if (!c.browser) return skip('no browser');
    const pages = ['dashboard', 'moneycontrol', 'website', 'pos', 'stock', 'cheques', 'loans', 'commissions', 'grn', 'salary', 'vendors', 'tilegallery', 'documents'];
    const p = await c.browser.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); const errs = []; let cur = '';
    p.on('pageerror', e => { if (!/Failed to fetch/.test(e.message)) errs.push(cur + ': ' + e.message.slice(0, 80)); }); p.on('console', m => { if (m.type() === 'error' && !/401|404|Failed to load resource|Failed to fetch/.test(m.text())) errs.push(cur + ': ' + m.text().slice(0, 80)); });
    await p.goto(c.base + '/owner', { waitUntil: 'networkidle2' }); await p.setCookie({ name: c.cookieName, value: c.cookieValue, url: c.base });
    const wide = [];
    for (const pg of pages) { cur = pg; await p.goto(c.base + '/owner#/' + pg, { waitUntil: 'networkidle2' }).catch(() => {}); await p.reload({ waitUntil: 'networkidle2' }).catch(() => {}); await new Promise(r => setTimeout(r, 900)); const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); if (w[0] > 390 || w[1] !== 390) wide.push(`${pg}=${w[0]}`); }
    await p.close(); return wide.length || errs.length ? bad([...wide.map(x => 'wide ' + x), ...errs.slice(0, 4)].join(' | ')) : ok(pages.length + ' screens');
}, LIVE);
add('pages', 'public website: no console errors and no sideways scroll at 390px', async c => {
    if (!c.browser) return skip('no browser'); const p = await c.browser.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true }); const errs = [];
    p.on('pageerror', e => errs.push(e.message.slice(0, 80))); await p.goto(c.base + '/site', { waitUntil: 'load' }); await new Promise(r => setTimeout(r, 800));
    const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); await p.close(); return w[0] > 390 || w[1] !== 390 || errs.length ? bad(`width ${w[0]} / ${w[1]} ${errs.join('; ')}`) : ok();
}, LIVE);
add('pages', 'documents: the page and its API load for the owner and are refused for staff and signed-out visitors', async c => {
    const own = await c.req('GET', '/api/documents', { cookie: c.admin }), page = await c.req('GET', '/documents.html', { cookie: c.admin });
    const out = await c.req('GET', '/api/documents'), staff = c.staff ? await c.req('GET', '/api/documents', { cookie: c.staff }) : { status: 403 };
    return own.status === 200 && page.status === 200 && out.status === 401 && staff.status === 403 ? ok('owner 200, signed-out 401, staff 403') : bad(`owner ${own.status}, page ${page.status}, signed-out ${out.status}, staff ${staff.status}`);
}, LIVE);
add('backup', 'the encrypted backup copy restores into a throwaway database (scratch)', async c => (c.restoreCheck ? c.restoreCheck() : skip('no scratch database access')), LIVE);
add('auth', 'login: repeated wrong passwords get locked out (429); runs last', async c => {
    let last = 0; for (let i = 0; i < 12; i++) { const r = await c.req('POST', '/api/login', { body: { username: 'nobody', password: 'wrong' + i } }); last = r.status; if (r.status === 429) return ok('locked after ' + (i + 1) + ' tries'); }
    return bad('never locked out, last status ' + last);
}, { live: true, last: true });

// ═══════════════════════════ RUNNER ═══════════════════════════
async function makeContext(extra) {
    const base = process.env.BUGCHECK_BASE; const u = new URL(base);
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(u.hostname)) throw new Error('Refusing: BUGCHECK_BASE must be on this machine');
    if (u.port === '3100' || u.port === '') throw new Error('Refusing: port 3100 is the REAL app. Use a scratch copy (npm run bugcheck).');
    const routes = discoverRoutes();
    const req = async (method, url, o = {}) => {
        const headers = { ...(o.headers || {}) }; if (o.cookie) headers.Cookie = o.cookie;
        let body; if (o.raw !== undefined) body = o.raw; else if (o.body !== undefined) { body = JSON.stringify(o.body); headers['Content-Type'] = headers['Content-Type'] || 'application/json'; }
        try { const r = await fetch(base + url, { method, headers, body, redirect: 'manual' }); const text = await r.text(); const h = {}; r.headers.forEach((v, k) => { h[k] = v; }); h['set-cookie'] = r.headers.getSetCookie ? r.headers.getSetCookie() : []; return { status: r.status, text, headers: h }; }
        catch (e) { return { status: 0, text: 'NETWORK ' + e.message, headers: {} }; }
    };
    const ctx = { base, routes, req, user: process.env.BUGCHECK_USER, pass: process.env.BUGCHECK_PASS, serverLog: () => '', dbCount: async () => null, ...extra };
    ctx.upload = async (url, { file, fields }) => { const fd = new FormData(); for (const [k, v] of Object.entries(fields || {})) fd.append(k, v); fd.append('file', new Blob([file.data], { type: file.type }), file.name); try { const r = await fetch(base + url, { method: 'POST', headers: { Cookie: ctx.admin }, body: fd }); return { status: r.status, text: await r.text() }; } catch (e) { return { status: 0, text: 'NETWORK ' + e.message }; } };
    const login = async (user, pass) => { const r = await req('POST', '/api/login', { body: { username: user, password: pass } }); const ck = (r.headers['set-cookie'] || [])[0]; return r.status === 200 && ck ? ck.split(';')[0] : null; };
    ctx.admin = await login(ctx.user, ctx.pass); if (!ctx.admin) throw new Error('Could not log in to the scratch app');
    if (process.env.BUGCHECK_STAFF_USER) ctx.staff = await login(process.env.BUGCHECK_STAFF_USER, process.env.BUGCHECK_STAFF_PASS);
    ctx.cookieName = ctx.admin.split('=')[0]; ctx.cookieValue = decodeURIComponent(ctx.admin.split('=').slice(1).join('='));
    return ctx;
}

async function run({ staticOnly = false, ctxExtra = {} } = {}) {
    const results = []; let ctx = null;
    const live = !staticOnly && process.env.BUGCHECK_BASE;
    if (live) { ctx = await makeContext(ctxExtra); try { ctx.browser = await require('puppeteer').launch({ headless: true, args: ['--no-sandbox'] }); } catch (e) { ctx.browser = null; } }
    const list = [...checks.filter(c => !c.last), ...checks.filter(c => c.last)];
    for (const c of list) {
        if (c.live && !live) { results.push({ area: c.area, name: c.name, status: 'SKIP', detail: 'needs a scratch app (npm run bugcheck)' }); continue; }
        try { const r = await c.fn(ctx); results.push({ area: c.area, name: c.name, status: r.skip ? 'SKIP' : r.ok ? 'PASS' : (c.known ? 'KNOWN' : 'FAIL'), detail: (r.detail || '') + (!r.ok && !r.skip && c.known ? '  [owner decision: ' + c.known + ']' : '') }); }
        catch (e) { results.push({ area: c.area, name: c.name, status: 'FAIL', detail: 'check crashed: ' + e.message.slice(0, 120) }); }
    }
    if (ctx && ctx.browser) await ctx.browser.close();
    return { results, barrage: ctx && { ...ctx.barrage, getBarrage: ctx.getBarrage, idBarrage: ctx.idBarrage } };
}

module.exports = { run, checks, discoverRoutes };

if (require.main === module) {
    run({ staticOnly: process.argv.includes('--static') }).then(({ results, barrage }) => {
        const n = s => results.filter(r => r.status === s).length;
        results.forEach((r, i) => console.log(`${String(i + 1).padStart(2)} ${r.status.padEnd(4)} [${r.area}] ${r.name}${r.detail ? '  -> ' + r.detail : ''}`));
        console.log(`\nBUGCHECK: ${results.length} checks, ${n('PASS')} pass, ${n('FAIL')} fail, ${n('SKIP')} skipped`);
        if (barrage && process.env.BUGCHECK_RAW) fs.writeFileSync(process.env.BUGCHECK_RAW, JSON.stringify(barrage, null, 1));
        process.exit(n('FAIL') ? 1 : 0);
    }).catch(e => { console.error('BUGCHECK could not run: ' + e.message); process.exit(2); });
}
