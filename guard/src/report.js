'use strict';
// Short list of today's AI changes (for chat or the audit screen): task, who, what table, how many rows.  node guard/src/report.js [days]
const { run } = require('./db');
(async () => { const days = Number(process.argv[2] || 1);
  const r = await run('DB', async (c) => (await c.query(`SELECT COALESCE(task_number,'(none)') task, actor, table_name, operation, COUNT(*)::int n, MIN(changed_at) first FROM guard.change_log WHERE changed_at > now() - ($1 || ' days')::interval AND actor LIKE 'ai\\_%' GROUP BY 1,2,3,4 ORDER BY first DESC`, [String(days)])).rows);
  if (!r.length) return console.log('No AI changes in the last ' + days + ' day(s).');
  r.forEach((x) => console.log(`task ${x.task} ${x.actor}: ${x.operation} ${x.table_name} x${x.n}`));
})().catch((e) => { console.error(e.message); process.exit(1); });
