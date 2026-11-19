const snap = require('../../utils/pocketSnapshot');
const env = { POCKET_URL: 'https://x.example', POCKET_PUSH_SECRET: 's', POCKET_PASSCODE: 'p' };
beforeEach(() => { jest.useFakeTimers(); snap._reset(); });
afterEach(() => { jest.useRealTimers(); });
test('a burst of saves sends the phone copy once, after the short delay', () => {
  const run = jest.fn().mockResolvedValue({}); const d = { env, run, pool: {} };
  expect(snap.kick(d)).toBe(true); expect(snap.kick(d)).toBe(false); expect(snap.kick(d)).toBe(false);
  expect(run).not.toHaveBeenCalled(); jest.advanceTimersByTime(1600); expect(run).toHaveBeenCalledTimes(1);
});
test('a second burst right after waits for the 10 s gap', () => {
  const run = jest.fn().mockResolvedValue({}); const d = { env, run, pool: {} };
  snap.kick(d); jest.advanceTimersByTime(1600); expect(run).toHaveBeenCalledTimes(1);
  snap.kick(d); jest.advanceTimersByTime(5000); expect(run).toHaveBeenCalledTimes(1); jest.advanceTimersByTime(6000); expect(run).toHaveBeenCalledTimes(2);
});
test('does nothing when Pocket is not set up', () => { expect(snap.kick({ env: {}, run: jest.fn(), pool: {} })).toBe(false); });
