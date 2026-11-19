// One-command laptop setup. Copies files into ~/.claude. Never deletes: anything replaced is moved to ~/.claude/_archive/<time>/.
// Run from the repo: node scripts/pc/rbh_setup_laptop.js
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.resolve(__dirname, '..', '..');
const home = path.join(os.homedir(), '.claude');
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const arch = path.join(home, '_archive', stamp);
fs.mkdirSync(path.join(home, 'skills'), { recursive: true });
const same = (a, b) => fs.existsSync(b) && fs.readFileSync(a, 'utf8') === fs.readFileSync(b, 'utf8');
const keepOld = (p, rel) => { if (fs.existsSync(p)) { const d = path.join(arch, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.renameSync(p, d); } };
let skills = 0, kept = 0;
const src = path.join(root, 'AI_MEMORY', 'octopus_skills', 'global');
for (const n of fs.readdirSync(src).filter((x) => x.startsWith('ecc-'))) {
  const from = path.join(src, n, 'SKILL.md'), toDir = path.join(home, 'skills', n), to = path.join(toDir, 'SKILL.md');
  if (same(from, to)) { kept++; continue; }
  keepOld(toDir, path.join('skills', n)); fs.mkdirSync(toDir, { recursive: true }); fs.copyFileSync(from, to); skills++;
}
const g = path.join(root, 'AI_MEMORY', 'GLOBAL_CLAUDE.md'), gt = path.join(home, 'CLAUDE.md');
let claude = 'already current';
if (!same(g, gt)) { keepOld(gt, 'CLAUDE.md'); fs.copyFileSync(g, gt); claude = 'updated (old one archived)'; }
console.log('ecc- skills: ' + skills + ' copied, ' + kept + ' already current');
console.log('global CLAUDE.md: ' + claude);
console.log('Archive folder (only if something was replaced): ' + arch);
