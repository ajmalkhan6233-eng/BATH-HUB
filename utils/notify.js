'use strict';
/**
 * RULE 11 (changed 2026-10-11 by the owner): every notification to the owner goes out ONLY at 06:00 Sri Lanka time, once, as ONE combined message.
 * Every sender calls enqueue(); the message waits in the table notify_queue. flush() is called every few minutes by the shop app
 * (layla_owner/boot.js): from 06:00 (up to 06:10, in case a check ran a minute late) it sends everything waiting as one message, and never again that day.
 * Replies to a message the owner just typed are not notifications and are not queued.
 * A fixed clock can be passed (now) so tests do not depend on real time. A batch missed because the computer was off waits for the next morning.
 */
const SEND_FROM_MIN = 6 * 60;        // 06:00 Sri Lanka
const SEND_UNTIL_MIN = 6 * 60 + 10;  // the check runs every minute, 10 minutes of slack
const MAX_CHARS = 3800;              // WhatsApp text limit is about 4000

const sl = (now) => new Date(now.getTime() + 5.5 * 3600e3);
const slDay = (now) => sl(now).toISOString().slice(0, 10);
const slMinutes = (now) => { const d = sl(now); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const inReleaseTime = (now) => { const m = slMinutes(now); return m >= SEND_FROM_MIN && m < SEND_UNTIL_MIN; };

let ready = null;
function ensure(pool) {
  if (!ready) ready = pool.query(`CREATE TABLE IF NOT EXISTS notify_queue (id SERIAL PRIMARY KEY, source TEXT, body TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW(), sent_day DATE)`);
  return ready;
}
const resetForTests = () => { ready = null; };

async function enqueue(pool, text, source = 'app') {
  await ensure(pool);
  await pool.query(`INSERT INTO notify_queue (source, body) VALUES ($1,$2)`, [source, String(text).slice(0, 3000)]);
  return true;
}

function combine(rows) {
  let out = `GOOD MORNING. ${rows.length} update${rows.length === 1 ? '' : 's'}:`;
  let used = 0;
  for (const r of rows) {
    const block = `\n\n${r.body}`;
    if (out.length + block.length > MAX_CHARS) break;
    out += block; used++;
  }
  if (used < rows.length) out += `\n\n(+${rows.length - used} more, they come tomorrow morning)`;
  return { text: out, used };
}

/** send(text) is the real WhatsApp sender. Returns { sent: n } or { sent: 0, reason }. */
async function flush({ pool, send, now = new Date() }) {
  if (!inReleaseTime(now)) return { sent: 0, reason: 'outside 06:00-06:10' };
  await ensure(pool);
  const today = slDay(now);
  const done = await pool.query(`SELECT 1 FROM notify_queue WHERE sent_day = $1 LIMIT 1`, [today]);
  if (done.rows.length) return { sent: 0, reason: 'already sent today' };
  const rows = (await pool.query(`SELECT id, body FROM notify_queue WHERE sent_day IS NULL ORDER BY id`)).rows;
  if (!rows.length) return { sent: 0, reason: 'nothing waiting' };
  const { text, used } = combine(rows);
  await send(text);
  for (const r of rows.slice(0, used)) await pool.query(`UPDATE notify_queue SET sent_day = $2 WHERE id = $1`, [r.id, today]);
  return { sent: used };
}
module.exports = { enqueue, flush, combine, inReleaseTime, resetForTests };
