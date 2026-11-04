'use strict';
// A brand-new database: Money Control must set up bank_accounts and the cheque_register columns by itself on the first
// boot (it used to try to ALTER cheque_register before the table existed, so the first boot logged errors).
jest.mock('pg', () => require('../helpers/pgmock')());

const pg = require('pg');

test('first boot on an empty database creates what Money Control needs, in order', async () => {
  const errors = [];
  const spy = jest.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.join(' ')));
  require('../../routes/money_control');                       // loads the module: its migrations start immediately
  await new Promise(r => setTimeout(r, 300));
  spy.mockRestore();

  expect(errors.filter(e => /money_control/.test(e))).toEqual([]);
  const cols = pg.__db.public.many(`SELECT column_name FROM information_schema.columns WHERE table_name = 'cheque_register'`).map(r => r.column_name);
  expect(cols).toEqual(expect.arrayContaining(['id', 'payee', 'amount', 'due_date', 'status', 'account_id', 'held_from_date']));
  expect(pg.__db.public.many(`SELECT table_name FROM information_schema.tables WHERE table_name = 'bank_accounts'`).length).toBeGreaterThan(0);
});
