// RBH readiness score. READ-ONLY: reads files, one localhost health ping. Sends nothing out.
// Usage: node scripts/pc/rbh_readiness.js [--brief]   Writes .rbh_status.json (gitignored).
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), http = require('http');
const root = path.resolve(__dirname, '..', '..');
const home = path.join(os.homedir(), '.claude');
const isPC = process.platform === 'win32';
const rd = (p) => { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; } };
const ex = (p) => fs.existsSync(p);
const run = (c) => { try { return cp.execSync(c, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }).toString(); } catch (e) { return null; } };
const ping = () => new Promise((res) => {
  const r = http.get('http://localhost:3100/health', { timeout: 2500 }, (x) => { res(x.statusCode === 200); x.resume(); });
  r.on('error', () => res(false)); r.on('timeout', () => { r.destroy(); res(false); });
});
(async () => {
  const hours = (p) => ex(p) ? (Date.now() - fs.statSync(p).mtimeMs) / 3.6e6 : 1e9;
  const settings = rd(path.join(root, '.claude', 'settings.json'));
  const skillsDir = path.join(home, 'skills');
  const eccCount = ex(skillsDir) ? fs.readdirSync(skillsDir).filter((n) => n.startsWith('ecc-')).length : 0;
  const branch = (run('git -C "' + root + '" branch --show-current') || '').trim();
  const dirty = (run('git -C "' + root + '" status --porcelain') || '').trim();
  const checks = [
    // repo-level (cloud or PC)
    ['Core rules file present', false, ex(path.join(root, 'AI_MEMORY/CORE_RULES.md'))],
    ['Start-up hook set', false, /SessionStart/.test(settings)],
    ['Permissions set (force-push blocked)', false, /push --force/.test(settings)],
    ['Both queues present', false, ex(path.join(root, 'AI_MEMORY/QUEUE_TOMORROW.md')) && ex(path.join(root, 'AI_MEMORY/QUEUE_SIMPLIFY.md'))],
    ['LIVE.md updated in last 36h', false, hours(path.join(root, 'AI_MEMORY/LIVE.md')) < 36],
    ['On branch work, nothing unsaved', false, branch === 'work' && dirty === ''],
    ['Audit file present', false, ex(path.join(root, 'AI_MEMORY/AUDIT.md'))],
    ['Pop-up + laptop setup scripts present', false, ex(path.join(root, 'scripts/pc/rbh_popup.ps1')) && ex(path.join(root, 'scripts/pc/rbh_setup_laptop.js'))],
    ['Link reader skill present', false, ex(path.join(root, '.claude/skills/rbh-link-reader/SKILL.md'))],
    // PC-level (this computer)
    ['Global rules on this computer (HARD RULE 0)', true, /HARD RULE 0/.test(rd(path.join(home, 'CLAUDE.md')))],
    ['19 ecc- skills installed here', true, eccCount >= 19],
    ['yt-dlp installed', true, run('yt-dlp --version') !== null],
    ['Shop app answers on port 3100', true, isPC ? await ping() : false],
    ['PC health check saved today', true, hours(path.join(root, 'AI_MEMORY/PC_HEALTH.txt')) < 24],
    ['Backup restore checked', true, /DONE/.test(rd(path.join(root, 'AI_MEMORY/RESTORE_CHECK.md')))],
    ['Free RAM above 1.5 GB', true, os.freemem() > 1.5 * 1024 ** 3],
  ];
  const pass = checks.filter((c) => c[2]).length;
  const pct = Math.round((100 * pass) / checks.length);
  const repoFail = checks.filter((c) => !c[1] && !c[2]);
  const pcFail = checks.filter((c) => c[1] && !c[2]);
  let color, msg;
  if (repoFail.length) { color = 'red'; msg = 'Needs you: ' + repoFail.map((c) => c[0]).join('; '); }
  else if (pct >= 95) { color = 'green'; msg = 'All set. Good news.'; }
  else if (!isPC) { color = 'blue'; msg = 'Cloud side ready. ' + pcFail.length + ' check(s) can only be done on the PC.'; }
  else { color = 'amber'; msg = 'Heads-up: ' + pcFail.map((c) => c[0]).join('; '); }
  const out = { percent: pct, color, message: msg, when: new Date().toISOString(), where: isPC ? 'PC' : 'cloud', checks: checks.map((c) => ({ name: c[0], pcOnly: c[1], ok: c[2] })) };
  try { fs.writeFileSync(path.join(root, '.rbh_status.json'), JSON.stringify(out, null, 1)); } catch (e) {}
  if (process.argv.includes('--brief')) console.log('READINESS ' + pct + '% [' + color.toUpperCase() + '] ' + msg);
  else { checks.forEach((c) => console.log((c[2] ? 'OK   ' : 'TODO ') + (c[1] ? '[PC] ' : '     ') + c[0])); console.log('\nREADINESS ' + pct + '% [' + color.toUpperCase() + '] ' + msg); }
})();
