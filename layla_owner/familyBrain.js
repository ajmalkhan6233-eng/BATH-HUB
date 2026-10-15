'use strict';
/**
 * FAMILY MODE: a small, separate Layla for family members (reminders + notes only). English only.
 *  - No access to shop data. The ONLY intents allowed are reminders, done, snooze, her own pending list, help, and her own notes.
 *    Everything else (stock, cheques, payables, sales, plans, GRN...) gets one polite line and touches nothing.
 *  - Her tasks and notes carry her own key, so the owner's lists, ids and reminder ticks never see them (and she never sees the owner's).
 *  - Her reminders go to HER number at the time she set (a separate sender, not the owner's 6 am batch).
 */
const { normalizeNumber } = require('./ownerGate');
const { parseOwnerMessage } = require('./intentParser');
const { fmtLocal } = require('./timeParse');
const { dueNow, reminderText } = require('./reminderEngine');

const MAX_OPEN = 200, MAX_NOTES = 500;
const keyOf = (number) => normalizeNumber(number).slice(-9);
const sourceOf = (number) => `family:${keyOf(number)}`;
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const HELP = `Hi, I can keep reminders and notes for you. Examples:
- "remind me at 12 to call mum"
- "remind me tomorrow morning to pay the bill"
- "what's pending" / "done 3" / "snooze 3 2 hours"
- "note: plumber Rahim 077 123 4567"
- "notes" / "find plumber" / "delete note 2"`;
const ALLOWED = new Set(['REMIND', 'DONE', 'SNOOZE', 'TASKS', 'HELP', 'EMPTY']);

function createFamily({ numbers = [], store, notes, now = () => new Date() }) {
  const members = new Set(numbers.map(normalizeNumber).filter(Boolean));
  const isMember = (from) => members.has(normalizeNumber(from));
  async function handle(m) {
    const n = now(), source = sourceOf(m.from), key = keyOf(m.from), text = clean(m.text).slice(0, 600), t = text.toLowerCase();
    if (!text) return 'Say it again?';
    let r;
    if ((r = t.match(/^note\b\s*[:\-]?\s*(.+)$/))) {
      if ((await notes.count(key)) >= MAX_NOTES) return 'Your notes are full. Delete some first: "delete note 2".';
      const saved = await notes.add(key, clean(text.replace(/^note\s*[:\-]?\s*/i, '')));
      return `Saved note #${saved.id}.`;
    }
    if (t === 'notes' || t === 'my notes') { const rows = await notes.list(key, 10); return rows.length ? rows.map((x) => `#${x.id} ${x.body}`).join('\n') : 'No notes yet. Say "note: ..." to save one.'; }
    if ((r = t.match(/^find\s+(.+)$/))) { const rows = await notes.find(key, r[1]); return rows.length ? rows.map((x) => `#${x.id} ${x.body}`).join('\n') : `No note matches "${clean(r[1])}".`; }
    if ((r = t.match(/^delete note\s*#?(\d+)$/))) return (await notes.remove(key, +r[1])) ? `Deleted note #${r[1]}.` : `I could not find note #${r[1]}.`;

    const it = parseOwnerMessage(text, n);
    if (!ALLOWED.has(it.type)) return 'I can only keep reminders and notes for you. Say "help" to see how.';
    switch (it.type) {
      case 'HELP': return HELP;
      case 'EMPTY': return 'Say it again?';
      case 'REMIND': {
        if ((await store.listOpenFor(source)).length >= MAX_OPEN) return 'You have too many open reminders. Finish some first: "done 3".';
        const task = await store.create({ kind: 'FAMILY_REMIND', title: it.subject, dueAt: it.remindAt, source, meta: { number: normalizeNumber(m.from) }, nagEveryMin: 60, maxNags: 2 });
        return `Reminder set for ${fmtLocal(it.remindAt)} (#${task.id}): ${it.subject}. I will message you then.`;
      }
      case 'DONE': { const x = await store.done(it.id, source); return x ? `Done: ${x.title}` : `I could not find your open reminder #${it.id}.`; }
      case 'SNOOZE': { const x = await store.snooze(it.id, it.until, source); return x ? `Snoozed #${it.id} until ${fmtLocal(it.until)}.` : `I could not find your open reminder #${it.id}.`; }
      case 'TASKS': { const list = await store.listOpenFor(source); return list.length ? list.slice(0, 10).map((x) => `#${x.id} ${x.title} (${fmtLocal(x.snoozed_until && x.snoozed_until > x.due_at ? x.snoozed_until : x.due_at)})`).join('\n') : 'Nothing pending.'; }
      default: return 'I can only keep reminders and notes for you. Say "help" to see how.';
    }
  }
  return { isMember, handle, members: () => [...members] };
}
/** Sends each family reminder to ITS OWN number when due. Safe to call every minute. */
async function familyTick({ store, send, now = () => new Date() }) {
  const n = now(); const open = await store.listOpenFamily(); let sent = 0;
  for (const t of dueNow(open, n)) {
    const to = t.meta && t.meta.number; if (!to) continue;
    await send(to, reminderText(t, n)); await store.markSent(t.id, n); sent++;
  }
  return { checked: open.length, sent };
}
module.exports = { createFamily, familyTick, keyOf, sourceOf, HELP };
