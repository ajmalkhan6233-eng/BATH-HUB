'use strict';
const fs = require('fs');
const path = require('path');
const { check, run } = require('../../utils/startupChecks');
const root = path.join(__dirname, '..', '..');

describe('startup warnings (PETTY_CASH_FLOAT, backup copy)', () => {
  test('warns about the float when it is missing, blank or not a number', () => {
    for (const v of [undefined, '', '   ', 'abc']) expect(check({ PETTY_CASH_FLOAT: v, BACKUP_COPY_DIR: 'x', BACKUP_PASSPHRASE: 'y' }).join(' ')).toMatch(/PETTY_CASH_FLOAT is not set/);
  });
  test('no float warning when set (including 0)', () => {
    expect(check({ PETTY_CASH_FLOAT: '25000', BACKUP_COPY_DIR: 'x', BACKUP_PASSPHRASE: 'y' })).toEqual([]);
    expect(check({ PETTY_CASH_FLOAT: '0', BACKUP_COPY_DIR: 'x', BACKUP_PASSPHRASE: 'y' })).toEqual([]);
  });
  test('warns when either backup setting is missing, and never prints a value', () => {
    const w = check({ PETTY_CASH_FLOAT: '1', BACKUP_COPY_DIR: 'D:\\secret-folder' });
    expect(w).toHaveLength(1); expect(w[0]).toMatch(/BACKUP_COPY_DIR and\/or BACKUP_PASSPHRASE/); expect(w[0]).not.toContain('secret-folder');
  });
  test('run() logs [WARNING] lines outside tests and stays silent under Jest', () => {
    const log = jest.fn();
    expect(run({ NODE_ENV: 'production' }, log).length).toBe(2); expect(log).toHaveBeenCalledWith(expect.stringMatching(/^\[WARNING\] PETTY_CASH_FLOAT/));
    expect(run({ JEST_WORKER_ID: '1' }, log)).toEqual([]);              // silent under Jest
  });
  test('.env.example documents the float with a comment and is tracked, server calls the check', () => {
    const ex = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
    expect(ex).toMatch(/# .*float[\s\S]*\nPETTY_CASH_FLOAT=/i); expect(ex).toContain('BACKUP_COPY_DIR='); expect(ex).toContain('BACKUP_PASSPHRASE=');
    expect(ex).not.toMatch(/PASSWORD=.+\S/);                           // names only
    expect(fs.readFileSync(path.join(root, 'server.js'), 'utf8')).toContain("require('./utils/startupChecks').run()");
  });
});
