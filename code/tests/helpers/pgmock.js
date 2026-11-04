'use strict';
// Drop-in replacement for the `pg` module backed by pg-mem (in-memory Postgres), so the
// real route files (which each create their own Pool from env) can be tested end to end.
//
// Usage at the top of a test file:
//   jest.mock('pg', () => require('../helpers/pgmock')());
// Every `new Pool()` in the code under test then shares ONE in-memory database, reachable in
// tests as `require('pg').__db` (e.g. `require('pg').__db.public.none('CREATE TABLE ...')`).
//
// pg-mem lacks a few Postgres features the app uses. They are patched here, for tests only:
//   - pg_advisory_xact_lock            -> no-op function
//   - SUBSTRING(bill_number FROM regex) -> rewritten to a fixed-position substring (BHT-YYYYMMDD-NNNN)
//   - item_code ~ '^[0-9]{1,9}$'        -> IS NOT NULL (tests only ever use numeric item codes)
//   - correlated "SELECT SUM(amount) FROM investor_loan_payments ... = l.id" -> 0 (pg-mem can't correlate;
//     tests that use it must not depend on loan repayments)
const { newDb, DataType } = require('pg-mem');

const REWRITES = [
    [/SUBSTRING\(bill_number FROM '-\(\[0-9\]\+\)\$'\)/g, 'SUBSTRING(bill_number, 14)'],
    [/item_code ~ '\^\[0-9\]\{1,9\}\$'/g, 'item_code IS NOT NULL'],
    [/\(SELECT SUM\((?:pm|p)\.amount\) FROM investor_loan_payments (?:pm|p) WHERE (?:pm|p)\.loan_id = l\.id\)/g, '0'],
];
const fix = q => {
    if (typeof q === 'string') return REWRITES.reduce((s, [re, to]) => s.replace(re, to), q);
    if (q && typeof q.text === 'string') return { ...q, text: fix(q.text) };
    return q;
};

module.exports = function makePg() {
    const db = newDb();
    db.public.registerFunction({
        name: 'pg_advisory_xact_lock', args: [DataType.integer], returns: DataType.bool, implementation: () => true,
    });
    // ROUND(x, n) is missing for floats/numerics in pg-mem.
    for (const t of [DataType.float, DataType.decimal]) {
        db.public.registerFunction({
            name: 'round', args: [t, DataType.integer], returns: t,
            implementation: (x, n) => Math.round(x * 10 ** n) / 10 ** n,
        });
    }
    // TO_CHAR(date, 'YYYY-MM-DD') is the only format the app uses.
    for (const t of [DataType.date, DataType.timestamp, DataType.timestamptz]) {
        db.public.registerFunction({
            name: 'to_char', args: [t, DataType.text], returns: DataType.text,
            implementation: (d, fmt) => {
                if (d == null) return null;
                const x = d instanceof Date ? d : new Date(d);
                const p = n => String(n).padStart(2, '0');
                return fmt === 'YYYY-MM-DD' ? `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}` : x.toISOString();
            },
        });
    }
    const base = db.adapters.createPg();
    class Pool extends base.Pool {
        query(q, ...rest) { return super.query(fix(q), ...rest); }
        async connect(...a) {
            const c = await super.connect(...a);
            const orig = c.query.bind(c);
            c.query = (q, ...rest) => orig(fix(q), ...rest);
            return c;
        }
    }
    return { ...base, Pool, types: { setTypeParser() {} }, __db: db };
};
