'use strict';
// FRESH START command line. Rehearsal by default (counts only, changes nothing).
//   node scripts/wipe_fresh_start.js [--scope=clean|all]               -> shows what WOULD be cleared (default scope: clean = junk only)
//   node scripts/wipe_fresh_start.js --yes --scope=clean|all --backup=<file.sql> [--also=daily,expenses]   -> clears it (one transaction)
// scope clean = inbox, queues, chats, leads. scope all = ALSO customers, bills, cheques, GRNs, stock (the real opening stock too).
// Refuses: no fresh backup file (real, > 1 KB, made in the last 60 minutes) / the live shop database / any error rolls back.
// See utils/freshStart.js for exactly what is cleared and what is kept. Writes logs/wipe_<time>.txt (counts only, no names or numbers).
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';
require('dotenv').config();   // load .env FIRST, so the database name below is the real one (it used to show a default label)
const fs = require('fs');
const path = require('path');
const { assertTemplateSafeDb } = require('../utils/dbGuard');
const F = require('../utils/freshStart');

const arg = n => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ''; };
const yes = process.argv.includes('--yes');
const scope = arg('scope') || 'clean';
if (yes && !arg('scope')) { console.log('STOPPED: say which size: --scope=clean (junk only) or --scope=all (everything). Nothing was changed.'); process.exit(2); }
if (!['clean', 'all'].includes(scope)) { console.log('STOPPED: unknown scope "' + scope + '". Nothing was changed.'); process.exit(2); }
const also = arg('also').split(',').map(s => s.trim()).filter(Boolean);
const dbName = assertTemplateSafeDb('wipe_fresh_start');   // dies here if it points at the live shop database
const inboxRoot = path.resolve(process.env.DROP_ROOT || path.join(__dirname, '..', 'data', 'drop'), 'inbox');

(async () => {
    const pool = require('../utils/pool');
    const log = [];
    const say = s => { console.log(s); log.push(s); };
    try {
        // ask the database itself which one we are connected to (the only name that counts)
        const real = (await pool.query('SELECT current_database() AS d')).rows[0].d;
        if (real !== dbName) { say(`STOPPED: .env says "${dbName}" but the connection is to "${real}". Nothing was changed.`); process.exitCode = 6; return; }
        const want = arg('db');
        if (yes && want && want !== real) { say(`STOPPED: you asked for database "${want}" but this is "${real}". Nothing was changed.`); process.exitCode = 6; return; }
        if (yes && !want) { say('STOPPED: add --db=<database name> (the one the backup was taken from). Nothing was changed.'); process.exitCode = 6; return; }
        say(`Database: ${dbName}   Scope: ${scope}   Mode: ${yes ? 'CLEAR' : 'REHEARSAL (nothing changes)'}`);
        const p = await F.plan(pool, { also, scope });
        const files = F.inboxFiles(inboxRoot);
        say(`Would clear ${p.total} rows in ${p.rows.filter(r => r.rows).length} tables, ${files.files} inbox photo file(s). Stock set to 0 on ${p.zero.reduce((a, z) => a + z.nonzero, 0)} item row(s).`);
        for (const r of p.rows.filter(r => r.rows)) say(`  ${r.table}: ${r.rows}`);
        if (!yes) { say('Rehearsal only. Add --yes --backup=<file> to clear.'); return; }

        const b = F.backupLooksGood(arg('backup'));
        if (!b.ok) { say(`STOPPED: ${b.why}. Nothing was changed.`); process.exitCode = 3; return; }
        say(`Backup accepted (${Math.round(b.bytes / 1024)} KB).`);

        const done = await F.execute(pool, { also, scope });
        const rm = F.inboxFiles(inboxRoot, { remove: true });
        const after = await F.plan(pool, { also, scope });
        say(`CLEARED. Rows left in those tables: ${after.total}. Inbox photos removed: ${rm.files}. Stock set to 0 in: ${Object.entries(done.zeroed).map(([t, n]) => `${t} (${n})`).join(', ') || 'nothing to change'}.`);
        if (after.total !== 0) { say('HEADS-UP: some rows are still there. Check the list above.'); process.exitCode = 4; }
    } catch (e) {
        say(`STOPPED: ${e.message}`); process.exitCode = e.rolledBack ? 5 : 1;
    } finally {
        try { const dir = path.join(__dirname, '..', 'logs'); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, `wipe_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.txt`), log.join('\n') + '\n'); } catch (e) { /* log is a bonus */ }
        await pool.end().catch(() => {});
    }
})();
