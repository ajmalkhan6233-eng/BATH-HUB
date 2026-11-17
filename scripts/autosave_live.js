'use strict';
// Auto-save, every 15 minutes (Windows Task Scheduler task "RBH_Autosave_LIVE"). Writes ONE state line at the top of AI_MEMORY/LIVE.md,
// commits ONLY that file and pushes the shared work branch. Never adds other files, never touches code, never force-pushes.
// Skips quietly (and logs) if: the checkout is not on branch work, git is busy (index.lock), or another git job is running.
//   node scripts/autosave_live.js            run once       node scripts/autosave_live.js --dry   show the line, change nothing
const { execFileSync } = require('child_process'); const fs = require('fs'); const path = require('path');
const ROOT = path.resolve(__dirname, '..'), LIVE = path.join(ROOT, 'AI_MEMORY', 'LIVE.md'), LOG = path.join(ROOT, 'AI_MEMORY', 'autosave.log'), BRANCH = 'work';
const DRY = process.argv.includes('--dry');
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', timeout: 60000, windowsHide: true }).trim();
const log = (m) => { const l = new Date().toISOString() + ' ' + m + '\n'; if (!DRY) try { fs.appendFileSync(LOG, l); } catch (_) {} console.log(l.trim()); };
function health() { try { return execFileSync('curl', ['-s', '-m', '5', 'http://localhost:3100/health'], { encoding: 'utf8', windowsHide: true }).includes('"ok":true') ? 'ok' : 'down'; } catch (_) { return 'down'; } }
try {
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== BRANCH) { log('skip: checkout is not on ' + BRANCH); process.exit(0); }
  if (fs.existsSync(path.join(ROOT, '.git', 'index.lock'))) { log('skip: git is busy (index.lock)'); process.exit(0); }
  const dirty = git('status', '--porcelain').split('\n').filter((x) => x && !/AI_MEMORY\/(LIVE\.md|autosave\.log)/.test(x)).length;
  const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Colombo' }).slice(0, 16);
  const line = `AUTOSAVE ${now} SL | branch ${BRANCH} @ ${git('rev-parse', '--short', 'HEAD')} | last: ${git('log', '-1', '--format=%s').slice(0, 70)} | uncommitted files: ${dirty} | server health: ${health()}`;
  const old = fs.existsSync(LIVE) ? fs.readFileSync(LIVE, 'utf8') : '';
  const body = old.split(/\r?\n/); if (body[0] && body[0].startsWith('AUTOSAVE ')) body.shift();
  if (DRY) { console.log(line); process.exit(0); }
  fs.writeFileSync(LIVE, line + '\n' + body.join('\n'));
  git('add', '--', 'AI_MEMORY/LIVE.md');
  try { git('commit', '-q', '-m', 'autosave: LIVE.md state line ' + now, '--', 'AI_MEMORY/LIVE.md'); } catch (e) { log('nothing to commit'); process.exit(0); }
  try { git('pull', '--rebase', '--autostash', '-q', 'origin', BRANCH); } catch (e) { log('pull warning: ' + String(e.message).split('\n')[0]); }
  git('push', '-q', 'origin', BRANCH); log('saved and pushed: ' + line);
} catch (e) { log('FAILED: ' + String(e.message).split('\n')[0]); process.exit(1); }
