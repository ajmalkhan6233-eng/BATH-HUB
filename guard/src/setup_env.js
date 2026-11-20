'use strict';
// Adds the guard settings to .env on THIS PC (passwords are made here and never printed or sent anywhere). Safe to run again: keeps what is already there.
//   node guard/src/setup_env.js [pm2 app name]
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const env = path.join(process.cwd(), '.env'); const txt = fs.existsSync(env) ? fs.readFileSync(env, 'utf8') : '';
const has = (k) => new RegExp('^' + k + '=', 'm').test(txt); const pw = () => crypto.randomBytes(18).toString('base64url');
const app = process.argv[2] || 'apex-server'; const add = [];
const pc = pw(); const chat = pw();
if (!has('GUARD_AI_PC_PASSWORD')) add.push('GUARD_AI_PC_PASSWORD=' + pc);
if (!has('GUARD_AI_CHAT_PASSWORD')) add.push('GUARD_AI_CHAT_PASSWORD=' + chat);
if (!has('GUARD_AI_USER')) add.push('GUARD_AI_USER=ai_pc');
if (!has('GUARD_AI_PASSWORD')) add.push('GUARD_AI_PASSWORD=' + (has('GUARD_AI_PC_PASSWORD') ? (txt.match(/^GUARD_AI_PC_PASSWORD=(.*)$/m) || [])[1] : pc));
if (!has('GUARD_REPO')) add.push('GUARD_REPO=' + process.cwd());
if (!has('GUARD_STOP_CMD')) add.push('GUARD_STOP_CMD=pm2 stop ' + app);
if (!has('GUARD_START_CMD')) add.push('GUARD_START_CMD=pm2 start ' + app);
if (add.length) { fs.appendFileSync(env, (txt.endsWith('\n') || !txt ? '' : '\n') + '# RBH AI Change Guard\n' + add.join('\n') + '\n'); }
console.log(add.length ? `guard settings added to .env: ${add.map((x) => x.split('=')[0]).join(', ')}` : 'guard settings already in .env');
