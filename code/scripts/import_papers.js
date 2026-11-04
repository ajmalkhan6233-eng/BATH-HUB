'use strict';
// PAPERS IMPORT command line. Rehearsal by default: shows what would be added or skipped and changes nothing.
//   node scripts/import_papers.js <file.json>                                   rehearsal
//   node scripts/import_papers.js <file.json> --yes --db=bathco_owner --backup=<file.sql>   loads it (one transaction)
// Refuses: no fresh backup (real, > 1 KB, last 60 min) / the live shop database / a database name that differs from --db / any bad row.
process.env.DOTENV_CONFIG_QUIET = process.env.DOTENV_CONFIG_QUIET || 'true';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { assertTemplateSafeDb } = require('../utils/dbGuard');
const F = require('../utils/freshStart');   // only its backup check is reused
const P = require('../utils/paperImport');

const arg = n => { const a = process.argv.find(x => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : ''; };
const yes = process.argv.includes('--yes');
const fileArg = process.argv.slice(2).find(x => !x.startsWith('--'));
const dbName = assertTemplateSafeDb('import_papers');

(async () => {
    const pool = require('../utils/pool');
    const say = s => console.log(s);
    try {
        if (!fileArg) { say('STOPPED: give the papers file, e.g. node scripts/import_papers.js papers\\2026-10-21.json'); process.exitCode = 2; return; }
        const real = (await pool.query('SELECT current_database() AS d')).rows[0].d;
        if (real !== dbName) { say(`STOPPED: .env says "${dbName}" but the connection is to "${real}". Nothing was changed.`); process.exitCode = 6; return; }
        let file; try { file = JSON.parse(fs.readFileSync(path.resolve(fileArg), 'utf8')); } catch (e) { say(`STOPPED: cannot read the file as JSON: ${e.message}`); process.exitCode = 2; return; }
        if (yes) {
            if (arg('db') !== real) { say(`STOPPED: add --db=${real} (must match the real database). Nothing was changed.`); process.exitCode = 6; return; }
            const b = F.backupLooksGood(arg('backup'));
            if (!b.ok) { say(`STOPPED: ${b.why}. Nothing was changed.`); process.exitCode = 3; return; }
        }
        const r = await P.run(pool, file, { dryRun: !yes });
        const tot = o => o.cheques + o.bank + o.expenses;
        say(`Database: ${real}   Mode: ${yes ? 'LOAD' : 'REHEARSAL (nothing changes)'}`);
        say(`${yes ? 'ADDED' : 'Would add'}: cheques ${r.added.cheques}, bank ${r.added.bank}, expenses ${r.added.expenses} (total ${tot(r.added)})`);
        say(`Skipped, already in the app: cheques ${r.skipped.cheques}, bank ${r.skipped.bank}, expenses ${r.skipped.expenses}`);
        if (!yes) say('Rehearsal only. Add --yes --db=<name> --backup=<file> to load.');
    } catch (e) { say(`STOPPED: ${e.message}`); process.exitCode = e.invalid ? 2 : e.rolledBack ? 5 : 1; }
    finally { await pool.end().catch(() => {}); }
})();
