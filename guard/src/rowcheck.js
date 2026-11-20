'use strict';
// ROW GUARD: totals can hide two offsetting changes (stock +10 here, -10 there). So every AI row change in the audit log is checked against the
// list the task declared BEFORE it started ("allowed_changes"). Anything not on the list = RED, even if all totals match.
//   allowed_changes: [{ "table": "products", "operation": "INSERT", "count": 2 }, { "table": "products", "operation": "UPDATE", "row_id": "1676" }]
//   row_id given = that exact row. row_id missing = any row of that table (then "count" = exactly that many rows, or "max" = at most).
const { run } = require('./db');
async function maxLogId(prefix) { return run(prefix, async (c) => Number((await c.query('SELECT COALESCE(MAX(id),0) m FROM guard.change_log')).rows[0].m)); }
async function check(prefix, sinceId, task, allowed) {
  const rows = await run(prefix, async (c) => (await c.query(`SELECT id, actor, task_number, table_name, row_id, operation FROM guard.change_log WHERE id > $1 ORDER BY id`, [sinceId])).rows);
  const ai = rows.filter((x) => /^ai_/.test(x.actor)); const other = rows.filter((x) => !/^ai_/.test(x.actor));
  const list = (allowed || []).map((a) => ({ ...a, op: String(a.operation || '').toUpperCase(), seen: new Set() }));
  const fails = [];
  for (const x of ai) {
    if (String(x.task_number || '') !== String(task)) { fails.push(`change without this task number: ${x.operation} ${x.table_name} ${x.row_id} (actor ${x.actor})`); continue; }
    if (x.operation === 'DELETE') { fails.push(`DELETE ${x.table_name} ${x.row_id}`); continue; }
    const hit = list.find((a) => a.table === x.table_name && a.op === x.operation && (a.row_id === undefined || String(a.row_id) === String(x.row_id)));
    if (!hit) { fails.push(`not declared: ${x.operation} ${x.table_name} ${x.row_id}`); continue; }
    hit.seen.add(x.row_id);
  }
  for (const a of list) {
    if (a.row_id === undefined && a.count !== undefined && a.seen.size !== Number(a.count)) fails.push(`${a.op} ${a.table}: ${a.seen.size} rows changed, task declared ${a.count}`);
    if (a.row_id === undefined && a.max !== undefined && a.seen.size > Number(a.max)) fails.push(`${a.op} ${a.table}: ${a.seen.size} rows changed, task allowed at most ${a.max}`);
    if (a.row_id !== undefined && !a.seen.has(String(a.row_id)) && a.required !== false) fails.push(`declared but not done: ${a.op} ${a.table} ${a.row_id}`);
  }
  return { ok: fails.length === 0, fails, ai_changes: ai.length, other_changes: other.length };
}
module.exports = { maxLogId, check };
