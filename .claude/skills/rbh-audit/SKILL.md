---
name: rbh-audit
description: Use when AJ asks to audit, prove the numbers agree, hunt bill/stock/cash bugs, or check the bridge, backups and scheduled tasks. Test copy for flows, read-only for live.
---
# rbh-audit
Never say "100%". Say what was proven: the numbers TIE to each other, not that they are the right numbers.
- Flows and fuzz: test copy only. `bash scripts/audit/fresh_rig.sh`, then `node scripts/audit/bill_chain.js`, then `node scripts/audit/fuzz.js 300 24`. lib.guard() refuses anything but localhost 31xx/32xx and a DB name without test/scratch.
- Live (read-only, SELECT only): `node scripts/audit/daily_check.js [--notify]` prints one GREEN/RED line; --notify queues it for the 06:00 message (Rule 11). Rules in utils/auditInvariants.js (15 checks).
- Systems: `node scripts/audit/system_check.js` (bridge 3001, app 3100, pm2, scheduled tasks, backup age). SKIP = UNVERIFIED, not a pass.
- Report real bug counts only. Fix, add a test line, commit to a claude/ branch, never main/work.
