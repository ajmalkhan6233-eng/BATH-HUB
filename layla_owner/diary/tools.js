// MODULE: tools - what Layla may do to the notepad (shared by every brain).
const store = require('./store');

const TOOLS = [
  { name: 'add_task', description: 'Add a task/reminder. due = ISO 8601 with timezone offset, or omit if no time.',
    parameters: { type: 'object', properties: { title: { type: 'string' }, due: { type: 'string' }, notes: { type: 'string' }, repeat: { type: 'string', description: 'daily | weekdays | weekly | monthly (optional)' } }, required: ['title'] } },
  { name: 'update_task', description: 'Change title, due time or notes of a task by id.',
    parameters: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, due: { type: 'string' }, notes: { type: 'string' } }, required: ['id'] } },
  { name: 'complete_task', description: 'Mark a task done. Done is done.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
  { name: 'snooze_task', description: 'Snooze a task: minutes from now, or until (ISO 8601 with offset).',
    parameters: { type: 'object', properties: { id: { type: 'string' }, minutes: { type: 'number' }, until: { type: 'string' } }, required: ['id'] } },
  { name: 'delete_task', description: 'Delete a task completely (only if Ajmal asks).',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },
];

function localIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  const off = -d.getTimezoneOffset();
  const a = Math.abs(off);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}${off >= 0 ? '+' : '-'}${p(Math.floor(a / 60))}:${p(a % 60)}`;
}

function learnedBlock() {
  const L = store.lessons();
  if (!L.lessons.length && !L.facts.length) return '';
  return "WHAT AJMAL TAUGHT YOU (follow these):\n" + L.lessons.map((l) => `- when he says "${l.when}" it means: ${l.then}`).concat(L.facts.map((f) => `- ${f.text}`)).join('\n');
}
function systemPrompt() {
  const open = store.openTasks().map((t) => {
    const due = store.effectiveDue(t);
    return `- [${t.id}] ${t.title}${due ? ' | due ' + localIso(new Date(due)) : ' | no time'}${t.snoozedUntil ? ' (snoozed)' : ''}${t.notes ? ' | ' + t.notes : ''}`;
  });
  const chat = store.recentDiary(8).map((e) => `${e.role === 'user' ? 'Ajmal' : 'Layla'}: ${e.text}`).join('\n');
  return [
    "You are Layla, Ajmal's personal desk-notepad keeper, living in a small always-on-top notepad on his computer.",
    'Ajmal talks by voice-to-text, so read garbled words kindly. He is a busy shop owner in Sri Lanka, not a developer.',
    'Your job: keep his task list. When he speaks, update the notepad with the tools, then reply in ONE or TWO very short, warm, plain sentences. No lists, no long explanations.',
    'Every task gets a reminder time. If he gives none, pick a sensible one (e.g. in an hour) and say it. Never invent tasks he did not ask for.',
    '"Done"/"finished" = complete_task. "Snooze 10"/"later" = snooze_task. Match tasks by meaning using the ids below.',
    'If unsure which task he means, ask ONE short question.',
    `Now: ${localIso()}`,
    'OPEN TASKS:\n' + (open.length ? open.join('\n') : '(none)'),
    learnedBlock(),
    chat ? 'RECENT CHAT:\n' + chat : '',
  ].filter(Boolean).join('\n\n');
}

function runTool(name, input) {
  try {
    switch (name) {
      case 'add_task': { const t = store.addTask(input); return `added [${t.id}] ${t.title}`; }
      case 'update_task': return store.updateTask(input.id, input) ? 'updated' : 'task not found';
      case 'complete_task': return store.completeTask(input.id) ? 'marked done' : 'task not found';
      case 'snooze_task': return store.snoozeTask(input.id, input) ? 'snoozed' : 'task not found or bad time';
      case 'delete_task': return store.removeTask(input.id) ? 'deleted' : 'task not found';
      default: return 'unknown tool';
    }
  } catch (e) { return 'error: ' + e.message; }
}

module.exports = { TOOLS, runTool, systemPrompt, localIso };
