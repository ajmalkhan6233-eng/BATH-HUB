'use strict';
// The static half of `npm run bugcheck` must stay green (live checks need a scratch app and are run by `npm run bugcheck`).
const { checks, discoverRoutes } = require('../../scripts/bugcheck');

describe('bugcheck static checks', () => {
  test('there are at least 50 named checks, with unique names', () => {
    expect(checks.length).toBeGreaterThanOrEqual(50);
    expect(new Set(checks.map(c => c.name)).size).toBe(checks.length);
  });
  test('route discovery sees the app routes', () => { expect(discoverRoutes().length).toBeGreaterThan(150); });
  test('every offline check passes (npm audit skipped: needs the network)', async () => {
    const failed = [];
    for (const c of checks.filter(x => !x.live && x.area !== 'packages')) {
      const r = await c.fn(null);
      if (!r.skip && !r.ok) failed.push(`${c.name}: ${r.detail}`);
    }
    expect(failed).toEqual([]);
  }, 60000);
});
