// MODULE: local - the built-in FREE brain. No internet, no key, no cost.
// DIARY first: plain writing is just saved. Only reminders become tasks:
//   "remind me to call supplier at 3pm"  -> task with a time
//   "need to pay electricity"            -> kept in mind (no time yet)
//   "writing a cheque 150,000, comes in 2 days" -> asks you if it cleared in 2 days
const store = require('./store');
const { runTool } = require('./tools');

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const STOP = new Set(['the', 'and', 'for', 'with', 'task', 'that', 'this', 'one', 'please', 'it', 'my', 'a', 'to', 'of']);

const pad = (n) => String(n).padStart(2, '0');
const nice = (d, now) => {
  const same = d.toDateString() === now.toDateString();
  const tm = new Date(now.getTime() + 864e5).toDateString() === d.toDateString();
  return (same ? 'today' : tm ? 'tomorrow' : DAYS[d.getDay()]) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
};
const money = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

// Finds a time in the sentence. Returns { date|null, rest }.
function parseWhen(input, now = new Date()) {
  let s = ' ' + input + ' ';
  const cut = (re) => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m; };
  let m;

  // "in 10 minutes", "in an hour", "in 2 days", "in a week"
  m = cut(/\s(?:in|after)\s+(half an|an?|\d+(?:\.\d+)?)\s*(minutes?|mins?|m|hours?|hrs?|h|days?|weeks?)\b/i);
  let base = null, hh = null, mm = 0;
  if (m) {
    const q = /half/i.test(m[1]) ? 0.5 : /^an?$/i.test(m[1]) ? 1 : parseFloat(m[1]);
    const u = m[2].toLowerCase();
    if (/^(m|min)/.test(u)) return { date: new Date(now.getTime() + q * 60000), rest: s };
    if (/^h/.test(u)) return { date: new Date(now.getTime() + q * 3600000), rest: s };
    base = new Date(now); base.setDate(base.getDate() + Math.round(q * (/^w/.test(u) ? 7 : 1)));
    cut(/\btoday\b/i);
  }

  if (!base) {
    if ((m = cut(/\bday after tomorrow\b/i))) { base = new Date(now); base.setDate(base.getDate() + 2); }
    else if ((m = cut(/\btomorrow\b/i))) { base = new Date(now); base.setDate(base.getDate() + 1); }
    else if ((m = cut(/\btonight\b/i))) { base = new Date(now); hh = 20; }
    else if ((m = cut(/\b(?:this |in the |in )?(morning|afternoon|evening)\b/i))) { base = new Date(now); hh = { morning: 9, afternoon: 15, evening: 18 }[m[1].toLowerCase()]; }
    else if ((m = cut(/\bnext week\b/i))) { base = new Date(now); base.setDate(base.getDate() + 7); hh = 9; }
    else if ((m = cut(/\btoday\b/i))) { base = new Date(now); }
    else {
      for (let i = 0; i < 7; i++) {
        if ((m = cut(new RegExp('\\b(?:on |next )?' + DAYS[i] + '\\b', 'i')))) {
          base = new Date(now);
          let add = (i - now.getDay() + 7) % 7;
          if (add === 0) add = 7;
          base.setDate(base.getDate() + add);
          break;
        }
      }
    }
  }

  // clock time: "at 3pm", "3:30 pm", "15:00", "at 5"
  if ((m = cut(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/i))) {
    hh = parseInt(m[1], 10) % 12 + (/^p/i.test(m[3]) ? 12 : 0); mm = parseInt(m[2] || '0', 10);
  } else if ((m = cut(/\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/))) {
    hh = parseInt(m[1], 10); mm = parseInt(m[2], 10);
  } else if ((m = cut(/\bat\s+(\d{1,2})\b/i))) {
    hh = parseInt(m[1], 10); if (hh < 8) hh += 12; // "at 5" in a shop means 5pm
  } else if (/\bnoon\b/i.test(s)) { cut(/\bnoon\b/i); hh = 12; }

  if (hh === null && !base) return { date: null, rest: s };
  const d = base ? new Date(base) : new Date(now);
  d.setHours(hh === null ? 9 : hh, mm, 0, 0);
  if (hh === null && base && d <= now) return { date: new Date(now.getTime() + 3600000), rest: s }; // "today" with no time, 9am gone -> in 1 hour
  if (!base && d <= now) d.setDate(d.getDate() + 1); // time already passed today -> tomorrow
  return { date: d, rest: s };
}

const clean = (t) => {
  t = t.replace(/\s+/g, ' ').trim()
    .replace(/^(?:please\s+)?(?:remind me(?: to)?|add(?: a)? (?:task|reminder)?(?: to)?|note(?: down)?|reminder(?: to)?|don'?t forget(?: to)?|remember to)\s+/i, '')
    .replace(/^(?:i\s+(?:need|have|must|should)\s+to|i\s+need|need to|have to|must|should)\s+/i, '')
    .replace(/^(?:to|that)\s+/i, '').replace(/[\s,.:;-]+$/g, '').replace(/^[\s,.:;-]+/g, '').replace(/\s+(?:at|on|by|for|in)$/i, '');
  return t ? t[0].toUpperCase() + t.slice(1) : '';
};

const tokens = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w));
function match(words, tasks) {
  const w = tokens(words);
  if (!w.length) return [];
  const scored = tasks.map((t) => ({ t, s: tokens(t.title).filter((x) => w.some((y) => x.startsWith(y) || y.startsWith(x))).length }));
  const best = Math.max(0, ...scored.map((x) => x.s));
  return best ? scored.filter((x) => x.s === best).map((x) => x.t) : [];
}

// The task Ajmal most likely means when he gives no name: the one ringing now, else the only open one.
function target(words, now) {
  const open = store.openTasks();
  if (!open.length) return { none: true };
  const named = match(words, open);
  if (named.length === 1) return { t: named[0] };
  if (named.length > 1) return { many: named };
  if (tokens(words).length) return { many: [], notFound: true };
  const ringing = open.filter((t) => store.effectiveDue(t) && new Date(store.effectiveDue(t)) <= now);
  if (ringing.length === 1) return { t: ringing[0] };
  if (open.length === 1) return { t: open[0] };
  return { many: ringing.length ? ringing : open };
}
const which = (r) => r.none ? 'Nothing open right now. 🙂'
  : r.notFound ? "I couldn't find that one. Which task do you mean?"
  : 'Which one? ' + r.many.slice(0, 3).map((t) => t.title).join(' / ');

function snoozeAmount(s, now) {
  const w = parseWhen(s, now);
  if (w.date) return { until: w.date.toISOString(), label: nice(w.date, now), rest: w.rest };
  const m = s.match(/(\d+(?:\.\d+)?|an?|half an)\s*(minutes?|mins?|m|hours?|hrs?|h)?\b/i);
  if (m) {
    const q = /half/i.test(m[1]) ? 0.5 : /^an?$/i.test(m[1]) ? 1 : parseFloat(m[1]);
    const isHour = m[2] && /^h/i.test(m[2]);
    const mins = isHour ? q * 60 : q;
    return { minutes: mins, label: `${Math.round(mins)} min`, rest: s.replace(m[0], ' ') };
  }
  return { minutes: 10, label: '10 min', rest: s };
}

// amount from a sentence: 150,000 / 150000 / 150k / 1.5 lakh
function findAmount(s) {
  const m = s.match(/(?:rs\.?|lkr)?\s*(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*(k|thousand|lakhs?|million|m)?\b/i);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  const u = (m[2] || '').toLowerCase();
  if (u === 'k' || u === 'thousand') n *= 1e3; else if (u.startsWith('lakh')) n *= 1e5; else if (u === 'million' || u === 'm') n *= 1e6;
  return n >= 100 ? n : null; // ignore tiny numbers like "2"
}

const REMIND_WORDS = /\b(remind|reminder|remember to|don'?t forget|need to|needs to|have to|must|should|todo|to do|follow up|pay|collect|call|send|deposit|buy|order|meet|visit|bring|submit|renew|settle|return|repay)\b/i;

function ask(text, now = new Date(), opts = {}) {
  const raw = String(text || '').trim();
  if (!raw) return { reply: '📌 Saved.', changed: false };
  const low = raw.toLowerCase();
  let m;

  // teaching Layla: "teach: X = Y", "when I say X do Y", "remember: fact", "what did you learn"
  if ((m = raw.match(/^(?:teach|learn)\s*[:,-]?\s*(.+?)\s*(?:=|=>|means|->)\s*(.+)$/i)) || (m = raw.match(/^when i say\s+(.+?)\s*(?:,|then)?\s*(?:do|means?|=)\s+(.+)$/i))) {
    store.addLesson(m[1].replace(/^["']|["']$/g, ''), m[2]);
    return { reply: `Learned. When you say "${m[1].trim()}", I will do: ${m[2].trim()} 🧠`, changed: true };
  }
  if ((m = raw.match(/^remember(?: that)?\s*[:,-]\s*(.+)$/i))) { store.addFact(m[1]); return { reply: 'Remembered. 🧠', changed: true }; }
  if (/^(what did you learn|lessons|what do you know)\b/.test(low)) {
    const L = store.lessons();
    return { reply: (L.lessons.slice(-5).map((x) => `• "${x.when}" = ${x.then}`).concat(L.facts.slice(-5).map((x) => `• ${x.text}`)).join('\n')) || 'Nothing yet. Teach me: teach: X = Y', changed: false };
  }
  const learned = store.lessonFor(raw);
  if (learned && !opts.noLesson) return ask(learned, now, { noLesson: true });

  if (/^(list|show tasks|pending|tasks|what'?s (?:pending|left|next)|what do i have|my tasks)\b/.test(low)) {
    const open = store.openTasks();
    if (!open.length) return { reply: 'All clear. Nothing open. 🌿', changed: false };
    return { reply: open.slice(0, 5).map((t) => `• ${t.title} (${store.effectiveDue(t) ? nice(new Date(store.effectiveDue(t)), now) : 'kept in mind'})`).join('\n'), changed: false };
  }

  if ((m = low.match(/^(?:mark (?:it )?)?(done|finished|completed?|cleared|did)\b[\s:,-]*(?:with |the )?(.*)$/))) {
    const r = target(m[2], now);
    if (r.t) { store.completeTask(r.t.id); return { reply: `Done: ${r.t.title} ✔`, changed: true }; }
    if (m[1] !== 'cleared' && m[1] !== 'did') return { reply: which(r), changed: false };
  }

  if ((m = low.match(/^(?:snooze|postpone|remind me again)\b[\s:,-]*(.*)$/))) {
    const amt = snoozeAmount(m[1], now);
    const r = target(amt.rest, now);
    if (!r.t) return { reply: which(r), changed: false };
    store.snoozeTask(r.t.id, amt.until ? { until: amt.until } : { minutes: amt.minutes });
    return { reply: `Snoozed ${r.t.title} for ${amt.label}. 💤`, changed: true };
  }

  if ((m = low.match(/^(?:delete|remove|cancel|forget)\b[\s:,-]*(.*)$/))) {
    const r = target(m[1], now);
    if (!r.t) return { reply: which(r), changed: false };
    store.removeTask(r.t.id);
    return { reply: `Removed ${r.t.title}.`, changed: true };
  }

  if ((m = raw.match(/^(?:move|change|reschedule|shift)\s+(.*?)\s+(?:to|for|at)\s+(.+)$/i))) {
    const w = parseWhen(m[2], now);
    if (w.date) {
      const r = target(m[1], now);
      if (!r.t) return { reply: which(r), changed: false };
      store.updateTask(r.t.id, { due: w.date.toISOString() });
      return { reply: `Moved ${r.t.title} to ${nice(w.date, now)}. ⏰`, changed: true };
    }
  }

  // friendly words are just friendly, never tasks
  if (raw.split(/\s+/).length <= 7 && /^(?:hi|hello|hey|hai|salaam|salam|assalamu|assalam|good (?:morning|afternoon|evening|night)|how are you|how r u|thanks|thank you|ok|okay|alhamdulillah)\b/.test(low)) {
    if (/how are you|how r u/.test(low)) return { reply: "I'm good, Ajmal, Alhamdulillah. 🙂 What shall I keep for you?", changed: false };
    if (/thank/.test(low)) return { reply: 'Anytime. 🌿', changed: false };
    return { reply: 'Hello Ajmal. 🙂 I am here.', changed: false };
  }
  if (/^(?:help|how do i|what can you)\b/.test(low) || /^[^.]*\?$/.test(low)) {
    return { reply: 'Just write like a diary. Say "remind me ..." when you want a reminder. Type "clear" to tidy the screen.', changed: false };
  }

  // repeating: "every day / weekday / week / month / sunday"
  let repeat = null, scan = raw;
  if ((m = raw.match(/\bevery\s+(day|morning|evening|night|weekday|week|month|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i))) {
    const k = m[1].toLowerCase();
    repeat = k === 'weekday' ? 'weekdays' : k === 'month' ? 'monthly' : (k === 'week' || DAYS.includes(k)) ? 'weekly' : 'daily';
    scan = raw.replace(m[0], DAYS.includes(k) ? 'on ' + k : k === 'morning' ? 'in the morning' : k === 'evening' ? 'in the evening' : k === 'night' ? 'tonight' : '');
  }
  const w = parseWhen(scan, now);

  // cheque + amount -> ask later if it cleared (nothing is ever marked cleared by itself)
  if (/\b(cheque|cheques|chq|check)\b/i.test(raw) && !/\bcheck (on|the|if|with)\b/i.test(raw)) {
    const amt = findAmount(w.rest);
    if (amt) {
      const due = w.date || (() => { const d = new Date(now); d.setDate(d.getDate() + 2); d.setHours(9, 0, 0, 0); return d; })();
      const title = `Cheque ${money(amt)}: did it clear?`;
      if (store.openTasks().some((t) => t.title === title && t.due === due.toISOString())) return { reply: 'Already noted. ✔', changed: false };
      store.addTask({ title, due: due.toISOString(), notes: clean(raw).slice(0, 140) });
      return { reply: `Noted cheque ${money(amt)}. I'll ask you ${nice(due, now)} if it cleared. ✔`, changed: true };
    }
  }

  // a real reminder: a reminder word, or a real time ("today" alone is just diary talk)
  const realTime = !!repeat || !!parseWhen(raw.replace(/\btoday\b/gi, ' '), now).date;
  if (realTime || REMIND_WORDS.test(raw)) {
    const title = clean(w.rest);
    if (!title) return { reply: 'What should I remember?', changed: false };
    if (store.openTasks().some((t) => t.title === title && (t.due || null) === (w.date ? w.date.toISOString() : null))) return { reply: 'Already noted. ✔', changed: false };
    if (!w.date) {
      store.addTask({ title, due: null });
      return { reply: `Kept in mind: ${title}. Tell me when to remind you. 🧠`, changed: true };
    }
    const out = runTool('add_task', { title, due: w.date.toISOString(), repeat });
    return { reply: `Noted: ${title}. ⏰ ${nice(w.date, now)}${repeat ? ' (repeats ' + repeat + ')' : ''}`, changed: /^added/.test(out) };
  }

  // everything else is simply your diary
  return { reply: '📓 Saved.', changed: false };
}

module.exports = { ask, parseWhen, clean, findAmount };
