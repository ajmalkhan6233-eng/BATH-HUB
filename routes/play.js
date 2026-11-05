'use strict';
// PLAY BUTTONS (Ajmal 5 Nov): chat writes a card play/<id>.json on branch pclink of the PRIVATE bridge repo (title, what it does, job, args).
// The PC pulls it every 30 s. This screen lists the cards with a green ▶; pressing it drops tasks/play_<id>.json in the PC link folder,
// and the PC link (pclink.js) runs it within 30 s, writes the result and pushes it so chat sees it too. Owner only. Only whitelisted jobs.
// GET /api/play/list   POST /api/play/run {id}
const fs = require('fs'), path = require('path'), os = require('os');
const express = require('express');
const router = express.Router();
const roleOf = req => (req.session && req.session.user && req.session.user.role) || 'staff';
const ownerOnly = (req, res, next) => (['admin', 'owner'].includes(roleOf(req)) ? next() : res.status(403).json({ error: 'Owner only' }));
const dirOf = () => process.env.PCLINK_DIR || path.join(os.homedir(), 'pclink_repo');
const rj = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const okId = s => /^[A-Za-z0-9_-]{1,40}$/.test(String(s || ''));
const jobsOf = () => Object.keys(require('../scripts/pc/pclink_jobs').jobs);

function list(dir) {
    const pd = path.join(dir, 'play'); if (!fs.existsSync(pd)) return [];
    const out = [];
    for (const f of fs.readdirSync(pd).filter(x => /\.json$/.test(x)).sort()) {
        const c = rj(path.join(pd, f)); if (!c || !okId(c.id)) continue;
        const res = rj(path.join(dir, 'results', 'play_' + c.id + '.json'));
        const queued = fs.existsSync(path.join(dir, 'tasks', 'play_' + c.id + '.json'));
        let state = 'ready', note = '';
        if (res && res.status === 'running') state = 'running';
        else if (res && res.status === 'done') { state = 'done'; note = String(res.output || '').slice(0, 300); }
        else if (res && res.status === 'error') { state = 'error'; note = String(res.error || '').slice(0, 300); }
        else if (queued) state = 'queued';
        if (c.repeat && (state === 'done' || state === 'error')) state = 'ready';
        out.push({ id: c.id, title: String(c.title || c.id), what: String(c.what || ''), job: c.job, state, note, repeat: !!c.repeat });
    }
    return out;
}
function run(dir, id) {
    if (!okId(id)) return { ok: false, code: 400, error: 'bad id' };
    const c = rj(path.join(dir, 'play', id + '.json')); if (!c) return { ok: false, code: 404, error: 'No such task card yet. The PC copies new cards every 30 seconds.' };
    if (!jobsOf().includes(c.job)) return { ok: false, code: 400, error: 'This job is not on the allowed list: ' + c.job };
    const st = (list(dir).find(x => x.id === id) || {}).state;
    if (st !== 'ready') return { ok: false, code: 409, error: 'Already ' + st + '.' };
    if (c.repeat) { try { fs.unlinkSync(path.join(dir, 'results', 'play_' + id + '.json')); } catch (e) { /* none yet */ } }
    fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'tasks', 'play_' + id + '.json'), JSON.stringify({ id: 'play_' + id, job: c.job, args: c.args || {} }, null, 1));
    return { ok: true, state: 'queued' };
}
router.get('/play/list', ownerOnly, (req, res) => { try { res.json({ cards: list(dirOf()) }); } catch (e) { res.json({ cards: [], error: 'PC link folder not ready' }); } });
router.post('/play/run', ownerOnly, express.json(), (req, res) => { try { const r = run(dirOf(), String((req.body && req.body.id) || '')); res.status(r.ok ? 200 : r.code).json(r); } catch (e) { res.status(500).json({ error: 'Could not queue it: ' + e.message }); } });
router.list = list; router.run = run;
module.exports = router;
