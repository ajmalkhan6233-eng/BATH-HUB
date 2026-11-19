// READ-ONLY map of the PC's notes and data folders (Obsidian vaults first). Changes nothing. Prints a short report.
// Run: node scripts/pc/vault_scan.js   (task 150). Output goes to the console; the task copies the first 40 lines into AI_BRIDGE/LIVE.md.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
function vaults() {
    const out = [], cfg = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'obsidian', 'obsidian.json');
    try { const j = JSON.parse(fs.readFileSync(cfg, 'utf8')); Object.values(j.vaults || {}).forEach(v => v && v.path && out.push(v.path)); } catch (e) { /* no obsidian.json */ }
    return out;
}
function walk(dir, depth, acc) {
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return acc; }
    for (const e of ents) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === '.obsidian') continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) { if (depth > 0) walk(p, depth - 1, acc); acc.dirs++; }
        else { acc.files++; try { const st = fs.statSync(p); acc.bytes += st.size; const x = path.extname(e.name).toLowerCase() || '(none)'; acc.ext[x] = (acc.ext[x] || 0) + 1; const k = e.name.toLowerCase(); (acc.names[k] = acc.names[k] || []).push(p); if (st.mtimeMs > acc.newest) acc.newest = st.mtimeMs; } catch (x) { /* skip */ } }
    }
    return acc;
}
function scan(root) {
    const lines = ['== ' + root];
    let tops; try { tops = fs.readdirSync(root, { withFileTypes: true }); } catch (e) { return ['== ' + root + ' (cannot open)']; }
    for (const t of tops) {
        if (t.name.startsWith('.')) continue;
        const p = path.join(root, t.name);
        if (!t.isDirectory()) continue;
        const a = walk(p, 8, { files: 0, dirs: 0, bytes: 0, ext: {}, names: {}, newest: 0 });
        const ex = Object.entries(a.ext).sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0] + ':' + x[1]).join(' ');
        lines.push('  ' + t.name + ' | ' + a.files + ' files | ' + a.dirs + ' folders | ' + (a.bytes / 1048576).toFixed(1) + ' MB | ' + ex + ' | newest ' + (a.newest ? new Date(a.newest).toISOString().slice(0, 10) : '-'));
    }
    const all = walk(root, 8, { files: 0, dirs: 0, bytes: 0, ext: {}, names: {}, newest: 0 });
    const dup = Object.entries(all.names).filter(([, v]) => v.length > 1).length;
    lines.push('  TOTAL ' + all.files + ' files, ' + (all.bytes / 1048576).toFixed(1) + ' MB, files with the same name in 2+ places: ' + dup);
    return lines;
}
const roots = vaults();
['C:\\Bathco\\AI-Data', 'E:\\AI Sttuf'].forEach(r => { if (fs.existsSync(r) && !roots.includes(r)) roots.push(r); });
if (!roots.length) console.log('No Obsidian vault found in obsidian.json and no known data folder.');
roots.forEach(r => console.log(scan(r).join('\n')));
