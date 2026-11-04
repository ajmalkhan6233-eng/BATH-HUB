'use strict';
// Start-up warnings for settings that are easy to forget. Prints only; never stops the server and never prints a value.
function check(env = process.env) {
    const w = [];
    const pcf = env.PETTY_CASH_FLOAT;
    if (pcf === undefined || String(pcf).trim() === '' || !Number.isFinite(parseFloat(pcf))) {
        w.push('PETTY_CASH_FLOAT is not set in .env: the cash float is treated as 0, so Cash Proof and Petty Cash will be wrong. Add a line like PETTY_CASH_FLOAT=25000');
    }
    if (!String(env.BACKUP_COPY_DIR || '').trim() || !String(env.BACKUP_PASSPHRASE || '').trim()) {
        w.push('BACKUP_COPY_DIR and/or BACKUP_PASSPHRASE is not set in .env: backups stay on this machine only (no encrypted off-machine copy).');
    }
    return w;
}

function run(env = process.env, log = console.warn) {
    if (env.NODE_ENV === 'test' || env.JEST_WORKER_ID) return [];
    const w = check(env); w.forEach(m => log('[WARNING] ' + m)); return w;
}

module.exports = { check, run };
