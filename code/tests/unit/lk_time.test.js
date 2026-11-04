'use strict';
// "Today" is the Sri Lanka (Asia/Colombo, UTC+5:30) date, not the UTC date.
const { todayLK, monthLK, daysAgoLK } = require('../../utils/lkTime');

describe('Sri Lanka date helpers', () => {
  test('just after midnight in Colombo it is already the new day (UTC is still yesterday)', () => {
    const t = new Date('2026-10-14T19:00:00Z');            // 00:30 on 15 Oct in Colombo
    expect(t.toISOString().slice(0, 10)).toBe('2026-10-14');   // what the old code used: yesterday
    expect(todayLK(t)).toBe('2026-10-15');
  });

  test('late evening in Colombo is still the same day', () => {
    expect(todayLK(new Date('2026-10-15T18:29:00Z'))).toBe('2026-10-15');   // 23:59 Colombo
    expect(todayLK(new Date('2026-10-15T18:30:00Z'))).toBe('2026-10-16');   // 00:00 next day Colombo
  });

  test('month rolls over on the Colombo clock', () => {
    expect(monthLK(new Date('2026-10-31T19:00:00Z'))).toBe('2026-11');       // 00:30 on 1 Nov Colombo
    expect(monthLK(new Date('2026-10-31T10:00:00Z'))).toBe('2026-10');
  });

  test('days ago counts whole Colombo days, across a month end', () => {
    expect(daysAgoLK(35, new Date('2026-10-15T19:00:00Z'))).toBe('2026-09-11');   // from 16 Oct Colombo
    expect(daysAgoLK(0, new Date('2026-10-15T03:00:00Z'))).toBe('2026-10-15');
  });

  test('does not depend on the machine timezone', () => {
    const before = process.env.TZ;
    for (const tz of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = tz;
      expect(todayLK(new Date('2026-10-14T19:00:00Z'))).toBe('2026-10-15');
    }
    if (before === undefined) delete process.env.TZ; else process.env.TZ = before;
  });
});

describe('utils/timezone', () => {
  test('sets the process zone and tells Postgres', () => {
    const save = { TZ: process.env.TZ, PGOPTIONS: process.env.PGOPTIONS, PG_SET_TIMEZONE: process.env.PG_SET_TIMEZONE, APP_TIMEZONE: process.env.APP_TIMEZONE };
    delete process.env.PGOPTIONS; delete process.env.PG_SET_TIMEZONE; delete process.env.APP_TIMEZONE;
    jest.isolateModules(() => require('../../utils/timezone'));
    expect(process.env.TZ).toBe('Asia/Colombo');
    expect(process.env.PGOPTIONS).toBe('-c timezone=Asia/Colombo');

    // keeps any options already set, and is not added twice
    process.env.PGOPTIONS = '-c statement_timeout=5000';
    jest.isolateModules(() => require('../../utils/timezone'));
    expect(process.env.PGOPTIONS).toBe('-c statement_timeout=5000 -c timezone=Asia/Colombo');
    jest.isolateModules(() => require('../../utils/timezone'));
    expect(process.env.PGOPTIONS).toBe('-c statement_timeout=5000 -c timezone=Asia/Colombo');

    // can be switched off for poolers that reject startup options
    delete process.env.PGOPTIONS; process.env.PG_SET_TIMEZONE = 'false';
    jest.isolateModules(() => require('../../utils/timezone'));
    expect(process.env.PGOPTIONS).toBeUndefined();

    for (const [k, v] of Object.entries(save)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });
});
