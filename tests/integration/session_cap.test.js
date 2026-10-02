'use strict';
jest.mock('pg', () => require('../helpers/pgmock')());
const pg = require('pg');
const { capSessions, registerLogin } = require('../../utils/sessionCap');

const pool = new pg.Pool();
const db = pg.__db.public;
beforeAll(async () => {
  db.none(`CREATE TABLE session (sid varchar PRIMARY KEY, sess json NOT NULL, expire timestamp NOT NULL)`);
});
const add = (sid, uid, at) => db.none(`INSERT INTO session (sid, sess, expire) VALUES ('${sid}', '${JSON.stringify({ user: { id: uid }, loginAt: at })}', '2030-01-01')`);
const sids = async uid => (await pool.query(`SELECT sid FROM session WHERE (sess::jsonb)->'user'->>'id' = '${uid}' ORDER BY sid`)).rows.map(r => r.sid);

test('the 6th login drops the oldest; others stay; other users are untouched', async () => {
  for (let i = 1; i <= 6; i++) add('u1-' + i, 1, 1000 + i);
  add('u2-1', 2, 1); add('u2-2', 2, 2);
  await capSessions(pool, 1, 'u1-6', 5);
  expect(await sids(1)).toEqual(['u1-2', 'u1-3', 'u1-4', 'u1-5', 'u1-6']);
  expect(await sids(2)).toEqual(['u2-1', 'u2-2']);
});
test('with 5 or fewer sessions nothing is dropped', async () => {
  await capSessions(pool, 1, 'u1-6', 5);
  expect((await sids(1)).length).toBe(5);
});
test('registerLogin never breaks a login if the store fails', async () => {
  const req = { sessionID: 'x', session: { save: cb => cb() } };
  const bad = { query: () => Promise.reject(new Error('db down')) };
  await expect(registerLogin(req, bad, 1)).resolves.toBeUndefined();
});