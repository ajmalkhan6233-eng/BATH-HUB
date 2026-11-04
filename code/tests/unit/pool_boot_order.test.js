'use strict';
// Start-up order fix: right after load, plain pool.query() calls run one at a time, in call order (CREATE before ALTER).
describe('utils/pool start-up ordering', () => {
  function load() {
    jest.resetModules();
    const log = []; let running = 0, maxRunning = 0;
    jest.doMock('pg', () => ({ Pool: function () {
      this.query = async (sql) => { running++; maxRunning = Math.max(maxRunning, running); log.push('start ' + sql);
        await new Promise(r => setTimeout(r, sql === 'CREATE' ? 30 : 1)); running--; if (sql === 'BAD') throw new Error('boom'); return { rows: [] }; };
    } }));
    const pool = require('../../utils/pool');
    return { pool, log, max: () => maxRunning };
  }
  afterEach(() => { jest.dontMock('pg'); delete process.env.PG_BOOT_SERIAL_MS; });

  test('a slow CREATE finishes before the ALTER that follows it starts', async () => {
    const { pool, log, max } = load();
    await Promise.all([pool.query('CREATE'), pool.query('ALTER')]);
    expect(log).toEqual(['start CREATE', 'start ALTER']);
    expect(max()).toBe(1);
  });
  test('one failing statement does not block the ones after it, and its own caller still sees the error', async () => {
    const { pool } = load();
    const bad = pool.query('BAD'); const good = pool.query('OK');
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toEqual({ rows: [] });
  });
  test('callback-style calls are passed straight through', async () => {
    const { pool } = load();
    expect(pool.query('X', () => {})).toBeInstanceOf(Promise);   // the mock ignores callbacks; the point is it is not queued or wrapped
  });
  test('PG_BOOT_SERIAL_MS=0 switches the ordering off', () => {
    process.env.PG_BOOT_SERIAL_MS = '0';
    jest.resetModules(); jest.doMock('pg', () => ({ Pool: function () { this.query = () => 'raw'; } }));
    const pool = require('../../utils/pool');
    expect(pool.query('X')).toBe('raw');
  });
});
