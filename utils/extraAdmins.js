'use strict';
// Extra owner-level logins (Ajmal 2026-11-04: "keep Ajmal as admin, give rights to royalbathhub1@gmail.com also").
// config/extra_admins.json lists usernames (an e-mail is fine). On start-up each matching ACTIVE-or-disabled account is set to
// role admin and enabled. It never creates an account (a password must be chosen by a person), never touches any other account,
// and never changes Ajmal's account. Passwords are untouched.
const fs = require('fs');
const path = require('path');
async function run(pool, file) {
    let names = [];
    try { names = (JSON.parse(fs.readFileSync(file || path.join(__dirname, '..', 'config', 'extra_admins.json'), 'utf8')).usernames || []).map(x => String(x).trim().toLowerCase()).filter(Boolean); } catch (e) { return { changed: 0, found: [] }; }
    if (!names.length) return { changed: 0, found: [] };
    try {
        const r = await pool.query(`UPDATE users SET role='admin', active=TRUE WHERE LOWER(username) = ANY($1::text[]) AND (role<>'admin' OR active IS NOT TRUE) RETURNING username`, [names]);
        const have = await pool.query(`SELECT username FROM users WHERE LOWER(username) = ANY($1::text[])`, [names]);
        const missing = names.filter(n => !have.rows.some(x => String(x.username).toLowerCase() === n));
        if (r.rows.length) console.log('[extra-admins] set to admin: ' + r.rows.map(x => x.username).join(', '));
        if (missing.length) console.log('[extra-admins] no login named ' + missing.join(', ') + ' yet. Create it in Admin > Users (role admin), then restart.');
        return { changed: r.rows.length, found: have.rows.map(x => x.username), missing };
    } catch (e) { console.log('[extra-admins] skipped: ' + e.message); return { changed: 0, found: [] }; }
}
module.exports = { run };
