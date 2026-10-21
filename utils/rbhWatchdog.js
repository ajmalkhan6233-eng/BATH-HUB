'use strict';
// RBH WATCHDOG logic: plain code, no AI, costs no Claude usage. Run every 5 minutes by Windows Task Scheduler
// (scripts/pc/rbh_watchdog.js is the thin runner; scripts/pc/rbh_install_tasks.ps1 schedules it).
//
//   1. Ask the app "are you alive?" (/health).
//   2. If it is not, find out WHY in plain words (pm2 state + the last lines of its error log).
//   3. Restart ONLY pm2 "apex-server" (never anything else: the same pm2 also runs the live First Choice system).
//   4. Write ONE plain line to logs/watchdog.log so Aj (or Claude) can read what happened.
// Safety: after 3 restarts in one hour it stops restarting and says so (a crash loop needs a fix, not more restarts).
// Everything outside the logic (http, pm2, files, clock) is injected, so the unit test needs no PC.

const APP = 'apex-server';
const MAX_RESTARTS_PER_HOUR = 3;
const LOG_MAX_BYTES = 200 * 1024;
const LOG_KEEP_LINES = 300;

// "2026-10-21 09:55" in Sri Lanka time
function lkStamp(d = new Date()) { return d.toLocaleString('sv-SE', { timeZone: 'Asia/Colombo' }).slice(0, 16); }
const stampToDate = s => new Date(String(s).replace(' ', 'T') + ':00+05:30');

// Plain-words reason from the last lines of the error log.
function explain(tail) {
    const t = String(tail || '');
    const rules = [
        [/EADDRINUSE/i, 'Port is busy: another copy of the app (or another program) is using it'],
        [/ECONNREFUSED[^\n]*:5432|could not connect to server/i, 'Database (Postgres) is not running'],
        [/password authentication failed|28P01/i, 'Database password was refused (check DB_PASSWORD in .env)'],
        [/database "[^"]+" does not exist/i, 'Database name not found'],
        [/ENOSPC|no space left/i, 'Disk is full'],
        [/heap out of memory|JavaScript heap/i, 'App ran out of memory'],
        [/Cannot find module/i, 'A code file or package is missing (needs a fix)'],
        [/SyntaxError/i, 'A code file has a typing mistake (needs a fix)'],
        [/LIVE shop database/i, 'Blocked on purpose: it pointed at the live shop database'],
    ];
    for (const [re, msg] of rules) if (re.test(t)) return msg;
    return t.trim() ? 'Unknown cause (last error line is in the log)' : 'No error text found (stopped by hand, or the PC was asleep)';
}

const lastLine = t => String(t || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).pop() || '';

// How many restarts did the log record in the last hour?
function recentRestarts(logText, now) {
    let n = 0;
    for (const line of String(logText || '').split(/\r?\n/)) {
        const m = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) \| /);
        if (!m || !/\| (restarted|started) /.test(line)) continue;
        const age = now.getTime() - stampToDate(m[1]).getTime();
        if (age >= 0 && age <= 3600 * 1000) n++;
    }
    return n;
}

// Keep the log small: when it passes the size limit, keep only the newest lines.
function trimLog(text) {
    if (Buffer.byteLength(text) <= LOG_MAX_BYTES) return text;
    return text.split(/\r?\n/).filter(Boolean).slice(-LOG_KEEP_LINES).join('\n') + '\n';
}

async function runOnce(d) {
    const now = d.now ? d.now() : new Date();
    const stamp = lkStamp(now);
    const say = line => d.appendLog(`${stamp} | ${line}`);

    // what does pm2 say about apex-server? (also tells us the port)
    let info = null, pm2Ok = true;
    try { const list = await d.pm2List(); info = list.find(a => a.name === APP) || null; } catch (e) { pm2Ok = false; }
    const port = (info && info.port) || d.port || 3100;
    const url = `http://127.0.0.1:${port}/health`;

    let h = await d.health(url);
    if (h.ok) return { state: 'up' };
    await d.sleep(10000);                       // a blip (a slow moment) is not an outage: look once more
    h = await d.health(url);
    if (h.ok) return { state: 'blip' };

    // down. Why?
    const tail = info && info.errLog ? await d.readTail(info.errLog, 40) : '';
    const why = explain(tail);
    const lastErr = lastLine(tail).slice(0, 150);
    let reason, action;
    if (!pm2Ok) { reason = 'pm2 is not answering'; action = 'start'; }
    else if (!info) { reason = `${APP} is not in pm2`; action = 'start'; }
    else if (info.status !== 'online') { reason = `pm2 says ${info.status}. ${why}`; action = 'restart'; }
    else { reason = `Running but not answering /health. ${why}`; action = 'restart'; }

    const log = await d.readLog();
    if (recentRestarts(log, now) >= MAX_RESTARTS_PER_HOUR) {
        await say(`DOWN | ${reason} | NOT restarted: ${MAX_RESTARTS_PER_HOUR} restarts in the last hour (crash loop, needs a fix)${lastErr ? ' | last error: ' + lastErr : ''}`);
        return { state: 'crashloop', reason };
    }
    if (action === 'start' && !(await d.hasLocalConfig())) {
        await say(`DOWN | ${reason} | NOT started: local_ops\\ecosystem.local.config.js not found (Aj/Claude Code must start it by hand)`);
        return { state: 'blocked', reason };
    }

    try { if (action === 'start') await d.pm2Start(); else await d.pm2Restart(); }
    catch (e) { await say(`DOWN | ${reason} | ${action} FAILED: ${String(e.message).slice(0, 120)}`); return { state: 'failed', reason }; }

    // wait for it to answer (up to 60 s)
    let waited = 0, back = false;
    while (waited < 60) { await d.sleep(3000); waited += 3; if ((await d.health(url)).ok) { back = true; break; } }
    await say(`DOWN | ${reason} | ${action === 'start' ? 'started' : 'restarted'} ${APP} | ${back ? `UP again after ${waited}s` : 'STILL DOWN after 60s (needs a look)'}${lastErr ? ' | last error: ' + lastErr : ''}`);
    return { state: back ? 'recovered' : 'still_down', reason, action };
}

module.exports = { runOnce, explain, recentRestarts, trimLog, lkStamp, APP, MAX_RESTARTS_PER_HOUR };
