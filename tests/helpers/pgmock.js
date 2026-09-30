'use strict';
// Drop-in replacement for the `pg` module backed by pg-mem (in-memory Postgres), so the
// real route files (which each create their own Pool from env) can be tested end to end.
//
// Usage at the top of a test file:
//   jest.mock('pg', () => require('../helpers/pgmock')());
// Every `new Pool()` in the code under test then shares ONE in-memory database, reachable in
// tests as `require('pg').__db` (e.g. `await new (require('pg').Pool)().query('CREATE TABLE ...')`).
const { newDb, DataType } = require('pg-mem');

module.exports = function makePg() {
    const db = newDb();
    db.public.registerFunction({
        name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.bool, implementation: () => true,
    });
    const pg = db.adapters.createPg();
    pg.types = { setTypeParser() {} };
    pg.__db = db;
    return pg;
};
