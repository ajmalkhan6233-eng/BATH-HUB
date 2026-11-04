'use strict';
// BRIDGE WATCHER logic: plain code, no AI, no Claude usage until there is real work.
// Every 15 minutes (Task Scheduler) the runner pulls the bridge repo and reads AI_BRIDGE/BRIDGE.md.
// A task counts as "play" only when its heading says exactly "STATUS: PLAYED".
// For each new played task it starts Claude Code ONCE with "check bridge". Handled task numbers are remembered, so nothing runs twice.
// Safety: at most MAX_PER_DAY starts per day (usage guard), one run at a time (lock).
const MAX_PER_DAY = 3;

function playedTasks(md) {
    const out = [];
    for (const line of String(md || '').split(/\r?\n/)) {
        const m = line.match(/^## TASK (\d+)\b.*?STATUS:\s*PLAYED\b/);
        if (m) out.push(Number(m[1]));
    }
    return out;
}

// state = { handled: [numbers], day: 'YYYY-MM-DD', startsToday: n }
function decide(md, state, today) {
    const st = { handled: [], day: today, startsToday: 0, ...(state || {}) };
    if (st.day !== today) { st.day = today; st.startsToday = 0; }
    const fresh = playedTasks(md).filter(n => !st.handled.includes(n));
    if (!fresh.length) return { run: false, why: 'nothing new', state: st, fresh };
    if (st.startsToday >= MAX_PER_DAY) return { run: false, why: `daily limit of ${MAX_PER_DAY} starts reached`, state: st, fresh };
    return { run: true, why: `new played task(s): ${fresh.join(', ')}`, state: { ...st, startsToday: st.startsToday + 1 }, fresh };   // tasks are marked handled only after Claude Code finishes OK (markHandled)
}

const markHandled = (state, nums) => ({ ...state, handled: [...new Set([...(state.handled || []), ...nums])] });

module.exports = { playedTasks, decide, markHandled, MAX_PER_DAY };
