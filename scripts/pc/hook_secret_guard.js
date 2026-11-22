'use strict';
// Claude Code PreToolUse hook (AJ 22 Nov). Blocks a `git commit` when the staged changes contain .env secret values,
// long bank-account-like numbers, IBAN/SWIFT strings or private keys. Exit code 2 = block, with the reason on stderr.
const { execSync } = require('child_process');
const fs = require('fs');
let input = '';
process.stdin.on('data', d => { input += d; });
process.stdin.on('end', () => {
  let cmd = '';
  try { cmd = (JSON.parse(input).tool_input || {}).command || ''; } catch (_) { process.exit(0); }
  if (!/\bgit\b[^|;&]*\bcommit\b/.test(cmd)) process.exit(0);
  let diff = '';
  try { diff = execSync('git diff --cached -U0', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }); } catch (_) { process.exit(0); }
  const added = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const hits = [];
  try {
    for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]*(KEY|TOKEN|SECRET|PASS|PASSWORD|PASSPHRASE)[A-Z0-9_]*)\s*=\s*"?([^"\s]{8,})"?/i);
      if (m && added.includes(m[3])) hits.push('.env value of ' + m[1]);
    }
  } catch (_) { /* no .env: skip */ }
  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(added)) hits.push('a private key');
  if (/(IBAN|SWIFT)[^\n]{0,15}\b[A-Z0-9]{8,34}\b/i.test(added)) hits.push('an IBAN or SWIFT number');
  if (/(account|a\/c|acc\.?\s*no)[^\n]{0,20}\b\d{9,16}\b/i.test(added)) hits.push('a bank account number');
  if (hits.length) { console.error('BLOCKED commit (AJ rule: no secrets or bank numbers in git): ' + [...new Set(hits)].join(', ') + '. Unstage it and commit again.'); process.exit(2); }
  process.exit(0);
});
