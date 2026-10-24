'use strict';
// OFF-PC BACKUP (AJ 25 Oct 2026): every night after 22:30 Sri Lanka time, the newest database backup is zipped, LOCKED with a key only AJ holds,
// and pushed to the private bridge repo (folder BACKUPS/). Locked = unreadable without the key, so no money or customer data is exposed.
// The key lives in data/backup_key.txt on the PC (data/ is never committed). AJ keeps a second copy on paper or phone. Lose the key = copies are useless.
const fs = require('fs'); const path = require('path'); const zlib = require('zlib'); const crypto = require('crypto'); const { execFile } = require('child_process');
const MAGIC = Buffer.from('RBHB1'); const MARKER = 'PostgreSQL database dump complete'; const KEEP = 30;
const kdf = (pass, salt) => crypto.scryptSync(String(pass), salt, 32);
function encrypt(buf, pass) { const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', kdf(pass, salt), iv); const body = Buffer.concat([c.update(zlib.gzipSync(buf)), c.final()]); return Buffer.concat([MAGIC, salt, iv, c.getAuthTag(), body]); }
function decrypt(enc, pass) { if (enc.length < 49 || !enc.subarray(0, 5).equals(MAGIC)) throw new Error('not a locked backup'); const salt = enc.subarray(5, 21), iv = enc.subarray(21, 33), tag = enc.subarray(33, 49); const d = crypto.createDecipheriv('aes-256-gcm', kdf(pass, salt), iv); d.setAuthTag(tag); return zlib.gunzipSync(Buffer.concat([d.update(enc.subarray(49)), d.final()])); }
const slNow = (now) => new Date(now.getTime() + 5.5 * 3600e3);
const dayStr = (now) => slNow(now).toISOString().slice(0, 10);
function newestSql(dir) { try { const f = fs.readdirSync(dir).filter(x => /^bathco_owner-.*\.sql$/.test(x)).map(x => ({ x, t: fs.statSync(path.join(dir, x)).mtimeMs })).sort((a, b) => b.t - a.t)[0]; return f ? { file: path.join(dir, f.x), ageH: (Date.now() - f.t) / 3600e3 } : null; } catch (e) { return null; } }
function prune(dir, keep = KEEP) { const all = fs.readdirSync(dir).filter(x => /\.enc$/.test(x)).sort(); const del = all.slice(0, Math.max(0, all.length - keep)); del.forEach(x => fs.unlinkSync(path.join(dir, x))); return del.length; }
const git = (cwd, args, ex = execFile) => new Promise((res, rej) => ex('git', args, { cwd, timeout: 60000 }, (e, so, se) => e ? rej(new Error(String(se || e.message).slice(0, 200))) : res(String(so))));
async function run({ backupDir, bridgeDir, keyFile, now = new Date(), force = false, ex = execFile } = {}) {
  const sl = slNow(now); if (!force && (sl.getUTCHours() * 60 + sl.getUTCMinutes()) < 22 * 60 + 30) return { state: 'wait', line: 'not yet 22:30' };
  if (!fs.existsSync(keyFile)) return { state: 'nokey', line: 'OFF-PC BACKUP NOT SET UP: no key file yet (run: node scripts/pc/backup_offsite.js --setup)' };
  const outDir = path.join(bridgeDir, 'BACKUPS'); const out = path.join(outDir, `bathco_owner-${dayStr(now)}.enc`);
  if (fs.existsSync(out) && !force) return { state: 'done', line: 'already done today' };
  const s = newestSql(backupDir); if (!s) return { state: 'fail', line: 'OFF-PC BACKUP FAILED: no local backup file found' };
  if (s.ageH > 36) return { state: 'fail', line: `OFF-PC BACKUP FAILED: newest local backup is ${Math.round(s.ageH)} hours old` };
  const raw = fs.readFileSync(s.file); if (!raw.toString('latin1').includes(MARKER)) return { state: 'fail', line: 'OFF-PC BACKUP FAILED: local backup is not complete' };
  const pass = fs.readFileSync(keyFile, 'utf8').trim(); const enc = encrypt(raw, pass);
  if (!decrypt(enc, pass).equals(raw)) return { state: 'fail', line: 'OFF-PC BACKUP FAILED: lock test did not match' };
  fs.mkdirSync(outDir, { recursive: true }); fs.writeFileSync(out, enc); prune(outDir);
  try { await git(bridgeDir, ['pull', '--rebase', '-q'], ex).catch(() => {}); await git(bridgeDir, ['add', 'BACKUPS'], ex); await git(bridgeDir, ['commit', '-q', '-m', `backup ${dayStr(now)}`], ex); await git(bridgeDir, ['push', '-q'], ex); }
  catch (e) { return { state: 'fail', line: 'OFF-PC BACKUP FAILED to push: ' + e.message }; }
  return { state: 'ok', line: `OFF-PC BACKUP OK: ${path.basename(out)} (${Math.round(enc.length / 1024)} KB, locked)` };
}
function verify({ bridgeDir, keyFile }) { const d = path.join(bridgeDir, 'BACKUPS'); const f = fs.readdirSync(d).filter(x => /\.enc$/.test(x)).sort().pop(); if (!f) return { ok: false, line: 'no copy found' }; const t = decrypt(fs.readFileSync(path.join(d, f)), fs.readFileSync(keyFile, 'utf8').trim()).toString('latin1'); return { ok: t.includes(MARKER), line: `${f}: opened with your key, ${t.includes(MARKER) ? 'complete' : 'NOT complete'}` }; }
async function runDaily({ pool, enqueue, now = new Date(), env = process.env } = {}) {
  const r = await run({ backupDir: path.join(process.cwd(), 'backups'), bridgeDir: env.OFFSITE_BRIDGE_DIR || 'C:\\Users\\Sony\\ai-bridge', keyFile: path.join(process.cwd(), 'data', 'backup_key.txt'), now });
  if (r.state === 'wait' || r.state === 'done') return r;
  const sf = path.join(process.cwd(), 'data', 'offsite_status.txt'); let same = false;
  try { const prev = fs.readFileSync(sf, 'utf8'); same = prev.startsWith(dayStr(now)) === false ? false : prev.includes('| ' + r.state + ' |'); } catch (e) {}
  try { fs.mkdirSync(path.dirname(sf), { recursive: true }); fs.writeFileSync(sf, `${dayStr(now)} ${now.toISOString()} | ${r.state} | ${r.line}\n`); } catch (e) {}
  if (!same && (r.state === 'fail' || r.state === 'nokey') && typeof enqueue === 'function') await enqueue(r.line, 'offsite-backup');
  return r;
}
module.exports = { encrypt, decrypt, run, verify, runDaily, prune, newestSql };
