// READ-ONLY speed report of the shop database. Changes nothing. Run: node scripts\perf_report.js
// Shows: database size, biggest tables, tables read in full too often (needs an index), unused indexes, cache hit rate, dead rows.
require('dotenv').config();
const pool = require('../utils/pool');
(async () => {
  const q = (s) => pool.query(s).then((r) => r.rows).catch((e) => [{ error: e.message }]);
  const out = {};
  out.database_size = (await q("SELECT pg_size_pretty(pg_database_size(current_database())) AS size"))[0];
  out.cache_hit_percent = (await q("SELECT round(100*sum(heap_blks_hit)/nullif(sum(heap_blks_hit)+sum(heap_blks_read),0),1) AS pct FROM pg_statio_user_tables"))[0];
  out.biggest_tables = await q("SELECT relname AS tbl, n_live_tup AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS size FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 12");
  out.read_in_full_often = await q("SELECT relname AS tbl, seq_scan, idx_scan, n_live_tup AS rows FROM pg_stat_user_tables WHERE seq_scan > 200 AND n_live_tup > 500 AND seq_scan > 5*coalesce(idx_scan,0) ORDER BY seq_scan DESC LIMIT 12");
  out.dead_rows = await q("SELECT relname AS tbl, n_dead_tup AS dead, n_live_tup AS live, last_autovacuum FROM pg_stat_user_tables WHERE n_dead_tup > 1000 ORDER BY n_dead_tup DESC LIMIT 8");
  out.unused_indexes = await q("SELECT relname AS tbl, indexrelname AS idx, pg_size_pretty(pg_relation_size(indexrelid)) AS size FROM pg_stat_user_indexes WHERE idx_scan = 0 AND indexrelname NOT LIKE '%pkey' AND indexrelname NOT LIKE '%key' ORDER BY pg_relation_size(indexrelid) DESC LIMIT 10");
  out.slow_queries = await q("SELECT round(mean_exec_time::numeric,1) AS avg_ms, calls, left(query,90) AS query FROM pg_stat_statements ORDER BY mean_exec_time*calls DESC LIMIT 8");
  console.log(JSON.stringify(out, null, 1));
  await pool.end();
})().catch((e) => { console.error('perf_report failed:', e.message); process.exit(1); });
