'use strict';
// The watchdog decides, restarts and writes a plain line. Everything outside the logic is faked: no PC, pm2 or network needed.
const W = require('../../utils/rbhWatchdog');

function make(o = {}) {
    const log = [];
    const calls = { restart: 0, start: 0 };
    const healthSeq = (o.health || [false]).slice();
    const d = {
        now: () => o.now || new Date('2026-10-21T04:25:00Z'),   // 09:55 in Sri Lanka
        port: 3100,
        sleep: async () => {},
        health: async () => { const v = healthSeq.length > 1 ? healthSeq.shift() : healthSeq[0]; return { ok: !!v, status: v ? 200 : 0 }; },
        pm2List: o.pm2List || (async () => [{ name: 'apex-server', status: 'online', errLog: 'e.log', port: 3100 }]),
        pm2Restart: async () => { calls.restart++; if (o.restartFails) throw new Error('pm2 exploded'); },
        pm2Start: async () => { calls.start++; },
        hasLocalConfig: async () => o.localConfig !== false,
        readTail: async () => o.tail || '',
        readLog: async () => o.logText || '',
        appendLog: async l => { log.push(l); },
    };
    return { d, log, calls };
}

test('healthy: nothing happens, nothing is logged', async () => {
    const { d, log, calls } = make({ health: [true] });
    expect((await W.runOnce(d)).state).toBe('up');
    expect(log).toEqual([]); expect(calls.restart + calls.start).toBe(0);
});

test('a one-moment blip is not an outage', async () => {
    const { d, log, calls } = make({ health: [false, true] });
    expect((await W.runOnce(d)).state).toBe('blip');
    expect(log).toEqual([]); expect(calls.restart).toBe(0);
});

test('stopped app: restarts only apex-server, waits, logs one plain line', async () => {
    // down at the first two checks, answering after the restart
    const { d, log, calls } = make({ health: [false, false, true], pm2List: async () => [{ name: 'apex-server', status: 'stopped', errLog: 'e.log', port: 3100 }, { name: 'bathco-server', status: 'online' }] });
    const r = await W.runOnce(d);
    expect(r.state).toBe('recovered');
    expect(calls.restart).toBe(1); expect(calls.start).toBe(0);
    expect(log).toHaveLength(1);
    expect(log[0]).toMatch(/^2026-10-21 09:55 \| DOWN \| pm2 says stopped\./);
    expect(log[0]).toMatch(/\| restarted apex-server \| UP again after/);
});

test('the reason is in plain words (busy port, database off, wrong password, disk full)', () => {
    expect(W.explain('Error: listen EADDRINUSE: address already in use :::3100')).toMatch(/Port is busy/);
    expect(W.explain('Error: connect ECONNREFUSED 127.0.0.1:5432')).toMatch(/Postgres\) is not running/);
    expect(W.explain('error: password authentication failed for user "x"')).toMatch(/password was refused/);
    expect(W.explain('ENOSPC: no space left on device')).toMatch(/Disk is full/);
    expect(W.explain('')).toMatch(/stopped by hand/);
});

test('running but not answering: restarts and puts the last error line in the log', async () => {
    const { d, log } = make({ health: [false, false, true], tail: 'old\nError: connect ECONNREFUSED 127.0.0.1:5432' });
    await W.runOnce(d);
    expect(log[0]).toMatch(/Running but not answering \/health\. Database \(Postgres\) is not running/);
    expect(log[0]).toMatch(/last error: Error: connect ECONNREFUSED/);
});

test('app missing from pm2: starts it from the local config', async () => {
    const { d, log, calls } = make({ health: [false, false, true], pm2List: async () => [] });
    expect((await W.runOnce(d)).state).toBe('recovered');
    expect(calls.start).toBe(1); expect(calls.restart).toBe(0);
    expect(log[0]).toMatch(/apex-server is not in pm2 \| started apex-server/);
});

test('app missing and no local config: says so, does not guess', async () => {
    const { d, log, calls } = make({ health: [false], pm2List: async () => [], localConfig: false });
    expect((await W.runOnce(d)).state).toBe('blocked');
    expect(calls.start + calls.restart).toBe(0);
    expect(log[0]).toMatch(/NOT started: local_ops/);
});

test('pm2 itself not answering is reported as such', async () => {
    const { d, log } = make({ health: [false, false, true], pm2List: async () => { throw new Error('no pm2'); } });
    await W.runOnce(d);
    expect(log[0]).toMatch(/pm2 is not answering/);
});

test('crash loop: after 3 restarts in an hour it stops restarting', async () => {
    const logText = ['2026-10-21 09:10', '2026-10-21 09:25', '2026-10-21 09:40'].map(t => `${t} | DOWN | x | restarted apex-server | UP again after 6s`).join('\n');
    const { d, log, calls } = make({ health: [false], logText });
    expect((await W.runOnce(d)).state).toBe('crashloop');
    expect(calls.restart).toBe(0);
    expect(log[0]).toMatch(/NOT restarted: 3 restarts in the last hour/);
});

test('restarts older than an hour do not count', () => {
    const t = '2026-10-21 07:00 | DOWN | x | restarted apex-server | UP again after 6s';
    expect(W.recentRestarts(t, new Date('2026-10-21T04:25:00Z'))).toBe(0);
});

test('still down after the restart is reported, exit state is not "recovered"', async () => {
    const { d, log } = make({ health: [false] });
    expect((await W.runOnce(d)).state).toBe('still_down');
    expect(log[0]).toMatch(/STILL DOWN after 60s/);
});

test('a failed restart is logged, not hidden', async () => {
    const { d, log } = make({ health: [false], restartFails: true });
    expect((await W.runOnce(d)).state).toBe('failed');
    expect(log[0]).toMatch(/restart FAILED: pm2 exploded/);
});

test('the log stays small', () => {
    const big = ('x'.repeat(100) + '\n').repeat(5000);
    const out = W.trimLog(big);
    expect(out.split('\n').filter(Boolean)).toHaveLength(300);
    expect(W.trimLog('short\n')).toBe('short\n');
});
