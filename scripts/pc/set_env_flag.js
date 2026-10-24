'use strict';
// Sets ONE true/false flag in .env. Backs the file up first. Never prints any value except the flag name and the word true/false.
//   node scripts/pc/set_env_flag.js POS_DEDUCT_STOCK true
const fs = require('fs'), path = require('path');
const ALLOWED = ['POS_DEDUCT_STOCK'];
function setFlag(text, name, val) {
  const re = new RegExp('^(\\s*' + name + '\\s*=).*$', 'm');
  if (re.test(text)) return text.replace(re, '$1' + val);
  return text.replace(/\s*$/, '') + '\n' + name + '=' + val + '\n';
}
module.exports = { setFlag, ALLOWED };
if (require.main === module) {
  const [name, val] = process.argv.slice(2);
  if (!ALLOWED.includes(name) || !/^(true|false)$/.test(val || '')) { console.log('REFUSED: only ' + ALLOWED.join(', ') + ' = true|false'); process.exit(1); }
  const f = path.join(__dirname, '..', '..', '.env'); const old = fs.readFileSync(f, 'utf8');
  const bak = path.join(__dirname, '..', '..', 'data', 'env_backup_' + name + '_' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')); fs.mkdirSync(path.dirname(bak), { recursive: true }); fs.writeFileSync(bak, old);
  fs.writeFileSync(f, setFlag(old, name, val)); console.log('OK: ' + name + ' is now ' + val + ' (backup kept in data/)');
}
