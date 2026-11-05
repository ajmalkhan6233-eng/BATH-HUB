'use strict';
// pclink: one cycle against a local bare repo (never GitHub). Ping job runs, bad job and bad SQL are refused, result is pushed.
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const g = (d, a) => execFileSync('git', a, { cwd: d, encoding: 'utf8' }).trim();
describe('pclink', () => {
  let tmp, bare, chat, pc;
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pclink-')); bare = path.join(tmp, 'remote.git'); chat = path.join(tmp, 'chat'); pc = path.join(tmp, 'pc');
    execFileSync('git', ['init', '-q', '--bare', '-b', 'pclink', bare]);
    execFileSync('git', ['clone', '-q', bare, chat]); g(chat, ['config', 'user.email', 'c@x']); g(chat, ['config', 'user.name', 'chat']);
    g(chat, ['checkout', '-q', '-B', 'pclink']); fs.mkdirSync(path.join(chat, 'tasks')); fs.writeFileSync(path.join(chat, 'README.md'), 'x');
    const t = (id, job, args) => fs.writeFileSync(path.join(chat, 'tasks', id + '.json'), JSON.stringify({ id, job, args }));
    t('001', 'ping'); t('002', 'rm_everything'); t('003', 'query', { sql: 'DELETE FROM products' });
    g(chat, ['add', '-A']); g(chat, ['commit', '-q', '-m', 'tasks']); g(chat, ['push', '-q', 'origin', 'pclink']);
    process.env.PCLINK_REMOTE = bare; process.env.PCLINK_DIR = pc;
  });
  afterAll(() => { delete process.env.PCLINK_REMOTE; delete process.env.PCLINK_DIR; });
  test('runs tasks in order, refuses unknown jobs and write SQL, pushes results', async () => {
    const { cycle } = require('../scripts/pc/pclink');
    for (let i = 0; i < 3; i++) expect((await cycle()).state).toBe('ran');
    expect((await cycle()).state).toBe('idle');
    g(chat, ['pull', '-q', '--rebase', 'origin', 'pclink']);
    const r = id => JSON.parse(fs.readFileSync(path.join(chat, 'results', id + '.json'), 'utf8'));
    expect(r('001').status).toBe('done'); expect(JSON.parse(r('001').output).node).toMatch(/^v/);
    expect(r('002').status).toBe('error'); expect(r('002').error).toMatch(/unknown job/);
    expect(r('003').status).toBe('error'); expect(r('003').error).toMatch(/only SELECT/);
    expect(JSON.parse(fs.readFileSync(path.join(chat, 'status.json'), 'utf8')).busy).toBe(false);
  });
  test('checkSql accepts one SELECT and refuses writes, secrets, two statements', () => {
    const { checkSql } = require('../scripts/pc/pclink_jobs');
    expect(checkSql('SELECT 1;')).toBe('SELECT 1');
    for (const bad of ['UPDATE products SET stock_level=0', 'SELECT 1; SELECT 2', 'WITH x AS (DELETE FROM products RETURNING 1) SELECT * FROM x', 'SELECT password FROM users']) expect(() => checkSql(bad)).toThrow();
  });
});
