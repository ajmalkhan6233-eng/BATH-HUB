'use strict';
// Proves the guard is really on. Nothing is changed. Prints OK / NOT OK lines and a final GREEN or RED.   node guard/src/verify_install.js
require('dotenv').config({ quiet: true }); const { Client } = require('pg'); const { conf } = require('./db');
(async () => {
  const bad = []; const say = (ok, t) => { console.log((ok ? 'OK     ' : 'NOT OK ') + t); if (!ok) bad.push(t); };
  const own = new Client(conf('DB')); await own.connect();
  const trg = Number((await own.query(`SELECT COUNT(*) n FROM information_schema.triggers WHERE trigger_name='guard_capture'`)).rows[0].n);
  say(trg > 10, `change log is switched on for ${Math.round(trg / 3)} tables`);
  const ai = new Client({ ...conf('DB'), user: process.env.GUARD_AI_USER || 'ai_pc', password: process.env.GUARD_AI_PASSWORD }); 
  try { await ai.connect(); } catch (e) { say(false, 'AI user cannot log in: ' + e.message.split('\n')[0]); console.log('RED'); process.exit(1); }
  const denied = async (sql) => { try { await ai.query(sql); return false; } catch (e) { return /permission denied|must be owner/.test(e.message); } };
  say(await denied('DELETE FROM products WHERE 1=0'), 'AI user cannot delete products');
  say(await denied('DELETE FROM vendor_bills WHERE 1=0'), 'AI user cannot delete vendor bills');
  say(await denied('TRUNCATE cheque_register'), 'AI user cannot empty a table');
  say(await denied('CREATE TABLE guard_probe(a int)'), 'AI user cannot make tables');
  say(await denied('SELECT 1 FROM guard.change_log LIMIT 1'), 'AI user cannot read or edit the log');
  try { await ai.query('SELECT 1 FROM products LIMIT 1'); say(true, 'AI user can still read products (so its work can run)'); } catch (e) { say(false, 'AI user cannot read products'); }
  await ai.end(); await own.end();
  console.log(bad.length ? 'RED' : 'GREEN'); process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error('VERIFY STOPPED: ' + e.message); process.exit(2); });
