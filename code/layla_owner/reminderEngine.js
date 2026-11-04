'use strict';
const { fmtLocal } = require('./timeParse');
/** Which open tasks should be sent now? Rules: due (or snooze over), not more than max_nags, spaced by nag_every_min. */
function dueNow(tasks, now) {
  return tasks.filter((t) => {
    if (t.status !== 'OPEN') return false;
    const at = t.snoozed_until && t.snoozed_until > t.due_at ? t.snoozed_until : t.due_at;
    if (at > now) return false;
    if (t.nags_sent >= t.max_nags) return false;
    if (t.last_sent_at && now - t.last_sent_at < t.nag_every_min * 60000) return false;
    return true;
  });
}
function reminderText(t, now) {
  const late = now - (t.snoozed_until && t.snoozed_until > t.due_at ? t.snoozed_until : t.due_at) > 2 * 3600000 && t.nags_sent === 0;
  return `${late ? 'Missed while the computer was off. ' : ''}Reminder #${t.id}: ${t.title}\nReply "done ${t.id}" when finished, or "snooze ${t.id} 1 hour".`;
}
/** deps: { store, send(text), now() }. Safe to call every minute; it never sends the same nag twice. */
async function tick({ store, send, now = () => new Date() }) {
  const n = now(); const open = await store.listOpen(); const due = dueNow(open, n); let sent = 0;
  for (const t of due) { await send(reminderText(t, n)); await store.markSent(t.id, n); sent++; }
  return { checked: open.length, sent };
}
module.exports = { dueNow, reminderText, tick, fmtLocal };
