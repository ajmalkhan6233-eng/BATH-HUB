'use strict';
// One-time install: runs sql/001 as a database administrator and sets the AI logins' passwords from the environment.
//   GUARD_ADMIN_USER / GUARD_ADMIN_PASSWORD   an administrator (the owner login works only if it may create roles; otherwise use postgres and type its password yourself)
//   GUARD_AI_CHAT_PASSWORD / GUARD_AI_PC_PASSWORD   new passwords for ai_chat / ai_pc (chosen by you, written to .env, never to git)
const fs = require('fs'); const path = require('path'); const { Client } = require('pg'); const { conf } = require('./db');
(async () => {
  const c = conf('DB'); const cl = new Client({ ...c, user: process.env.GUARD_ADMIN_USER || c.user, password: process.env.GUARD_ADMIN_PASSWORD || c.password });
  await cl.connect();
  const me = (await cl.query(`SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = current_user`)).rows[0];
  if (!me.rolsuper && !me.rolcreaterole) { console.log('NEEDS ADMIN: this login cannot create roles. Set GUARD_ADMIN_USER and GUARD_ADMIN_PASSWORD (postgres). Nothing changed.'); process.exit(5); }
  await cl.query(fs.readFileSync(path.join(__dirname, '..', 'sql', '001_ai_change_guard.sql'), 'utf8'));
  await cl.query(`GRANT CONNECT ON DATABASE ${'"' + c.database.replace(/"/g, '') + '"'} TO bathco_ai`);
  for (const [role, env] of [['ai_chat', 'GUARD_AI_CHAT_PASSWORD'], ['ai_pc', 'GUARD_AI_PC_PASSWORD']]) {
    if (process.env[env]) await cl.query(`ALTER ROLE ${role} WITH PASSWORD '${process.env[env].replace(/'/g, "''")}'`); else console.log(`note: ${env} not set, ${role} cannot log in yet`);
  }
  console.log('GUARD INSTALLED: change log on, AI users cannot delete.'); await cl.end();
})().catch((e) => { console.error('INSTALL STOPPED: ' + e.message); process.exit(1); });
