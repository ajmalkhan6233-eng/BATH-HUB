// MODULE: store - tasks + diary saved as plain files in the data folder.
const fs = require('fs');
const path = require('path');

let dir = null;
let state = { tasks: [], diary: [], inboxSeen: [], lessons: [], facts: [] };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const file = () => path.join(dir, 'state.json');

function init(dataDir) {
  dir = dataDir;
  fs.mkdirSync(path.join(dir, 'files'), { recursive: true });
  load();
}

function load() {
  try {
    state = JSON.parse(fs.readFileSync(file(), 'utf8'));
    state.tasks = state.tasks || [];
    state.diary = state.diary || [];
    state.lessons = state.lessons || []; state.facts = state.facts || [];
    state.inboxSeen = state.inboxSeen || [];
  } catch {
    state = { tasks: [], diary: [], inboxSeen: [], lessons: [], facts: [] };
  }
}

function save() {
  const tmp = file() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file());
}

const effectiveDue = (t) => t.snoozedUntil || t.due || null;

function listTasks() {
  return state.tasks;
}
function openTasks() {
  return state.tasks
    .filter((t) => t.status === 'open')
    .sort((a, b) => (effectiveDue(a) || '9').localeCompare(effectiveDue(b) || '9'));
}
function getTask(id) {
  return state.tasks.find((t) => t.id === id);
}

function addTask({ title, due, notes, repeat }) {
  const t = {
    id: uid(), title: String(title || '').trim() || 'Untitled', due: due || null,
    notes: notes || '', status: 'open', created: new Date().toISOString(),
    snoozedUntil: null, alertedFor: null, doneAt: null, repeat: repeat || null,
  };
  state.tasks.push(t);
  save();
  return t;
}

function updateTask(id, patch) {
  const t = getTask(id);
  if (!t) return null;
  for (const k of ['title', 'due', 'notes']) if (patch[k] !== undefined) t[k] = patch[k];
  if (patch.due !== undefined) { t.snoozedUntil = null; t.alertedFor = null; }
  save();
  return t;
}

function completeTask(id) {
  const t = getTask(id);
  if (!t) return null;
  t.doneAt = new Date().toISOString();
  const base = effectiveDue(t);
  if (t.repeat && base) { // repeating reminder: done today, back on its next day
    const d = new Date(base), now = Date.now();
    do {
      if (t.repeat === 'monthly') d.setMonth(d.getMonth() + 1);
      else if (t.repeat === 'weekly') d.setDate(d.getDate() + 7);
      else if (t.repeat === 'weekdays') { do d.setDate(d.getDate() + 1); while ([0, 6].includes(d.getDay())); }
      else d.setDate(d.getDate() + 1);
    } while (d.getTime() <= now);
    t.due = d.toISOString(); t.snoozedUntil = null; t.alertedFor = null; t.recurred = true;
  } else t.status = 'done';
  save();
  return t;
}

function reopenTask(id) {
  const t = getTask(id);
  if (!t) return null;
  t.status = 'open';
  t.doneAt = null;
  save();
  return t;
}

function snoozeTask(id, { minutes, until }) {
  const t = getTask(id);
  if (!t) return null;
  const when = until ? new Date(until) : new Date(Date.now() + (minutes || 10) * 60000);
  if (isNaN(when)) return null;
  t.snoozedUntil = when.toISOString();
  t.alertedFor = null;
  save();
  return t;
}

function removeTask(id) {
  const n = state.tasks.length;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  save();
  return state.tasks.length < n;
}

// Tasks whose time has come and have not yet been alerted for that time.
function dueNow(now = Date.now()) {
  return state.tasks.filter((t) => {
    if (t.status !== 'open') return false;
    const d = effectiveDue(t);
    if (!d) return false;
    return new Date(d).getTime() <= now && t.alertedFor !== d;
  });
}
function markAlerted(id) {
  const t = getTask(id);
  if (!t) return;
  t.alertedFor = effectiveDue(t);
  save();
}

function addDiary(entry) {
  const e = { id: uid(), ts: new Date().toISOString(), role: 'user', text: '', files: [], ...entry };
  state.diary.push(e);
  save();
  return e;
}
const normL = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
function addLesson(when, then) { const w = normL(when); state.lessons = state.lessons.filter((l) => l.when !== w); state.lessons.push({ when: w, then: String(then).trim(), ts: new Date().toISOString() }); save(); }
function lessonFor(text) { const w = normL(text); const l = state.lessons.find((x) => x.when === w); return l ? l.then : null; }
function addFact(f) { state.facts.push({ text: String(f).trim(), ts: new Date().toISOString() }); save(); }
function lessons() { return { lessons: state.lessons, facts: state.facts }; }
function allDiary() { return state.diary; }
function recentDiary(n = 40) {
  return state.diary.slice(-n);
}

function inboxSeen() { return new Set(state.inboxSeen); }
function markInbox(h) { state.inboxSeen.push(h); if (state.inboxSeen.length > 2000) state.inboxSeen = state.inboxSeen.slice(-1000); save(); }

function saveFile(name, buffer) {
  const safe = String(name || 'file').replace(/[^\w.\- ]+/g, '_').slice(-80);
  const rel = path.join('files', Date.now().toString(36) + '-' + safe);
  fs.writeFileSync(path.join(dir, rel), buffer);
  return rel.replace(/\\/g, '/');
}
function filePath(rel) {
  const full = path.resolve(dir, rel);
  if (!full.startsWith(path.resolve(dir))) throw new Error('bad path');
  return full;
}

module.exports = {
  init, load, listTasks, openTasks, getTask, addTask, updateTask, completeTask, reopenTask,
  snoozeTask, removeTask, dueNow, markAlerted, addDiary, recentDiary, allDiary, addLesson, lessonFor, addFact, lessons, inboxSeen, markInbox, saveFile, filePath, effectiveDue,
};
