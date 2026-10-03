'use strict';
// One shared, capped pool for the route modules. Golden-core modules keep their own pools (not touched on purpose).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..', '..');
const GOLDEN = ['audit.js', 'purchasing_accounting.js', 'staff_reports.js'];

describe('shared pool', () => {
  test('only the golden-core route modules still create their own pool', () => {
    const own = fs.readdirSync(path.join(root, 'routes')).filter(f => f.endsWith('.js') && /new Pool\(/.test(fs.readFileSync(path.join(root, 'routes', f), 'utf8')));
    expect(own.sort()).toEqual(GOLDEN.slice().sort());
  });
  test('every other module that uses a pool takes it from utils/pool', () => {
    const using = fs.readdirSync(path.join(root, 'routes')).filter(f => f.endsWith('.js') && !GOLDEN.includes(f) && /require\('\.\.\/utils\/pool'\)/.test(fs.readFileSync(path.join(root, 'routes', f), 'utf8')));
    expect(using.length).toBeGreaterThanOrEqual(28);
  });
  test('utils/pool.js caps connections (PG_POOL_MAX, default 15) and closes idle ones', () => {
    const s = fs.readFileSync(path.join(root, 'utils/pool.js'), 'utf8');
    expect(s).toMatch(/PG_POOL_MAX/); expect(s).toMatch(/\|\| 15/); expect(s).toMatch(/idleTimeoutMillis: 30000/);
    jest.resetModules(); jest.doMock('pg', () => ({ Pool: function (o) { this.options = o; } }));
    process.env.PG_POOL_MAX = '7'; const p = require('../../utils/pool'); delete process.env.PG_POOL_MAX;
    expect(p.options.max).toBe(7); expect(p.options.idleTimeoutMillis).toBe(30000);
    jest.dontMock('pg');
  });
  test('modules share one instance', () => {
    jest.resetModules(); jest.doMock('pg', () => ({ Pool: function (o) { this.options = o; } }));
    expect(require('../../utils/pool')).toBe(require('../../utils/pool')); jest.dontMock('pg');
  });
});
