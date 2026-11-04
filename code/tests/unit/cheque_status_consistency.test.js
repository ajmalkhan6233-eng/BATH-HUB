'use strict';
// Guard: every query on cheque_register that asks "what is still to be paid" must treat a HELD cheque
// (postponed, not cancelled) like a pending one. Static check, so it also covers queries too complex
// for the in-memory database (e.g. the month-by-month cash forecast).
const fs = require('fs');
const path = require('path');

const ROUTES = path.join(__dirname, '..', '..', 'routes');

test("no query on cheque_register filters to status = 'pending' alone", () => {
  const offenders = [];
  for (const f of fs.readdirSync(ROUTES).filter(n => n.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(ROUTES, f), 'utf8');
    // each SQL template literal that mentions cheque_register
    for (const m of src.matchAll(/`[^`]*`/g)) {
      const sql = m[0];
      if (/\bcheque_register\b/.test(sql) && /status\s*=\s*'pending'/.test(sql)) offenders.push(f);
    }
  }
  expect(offenders).toEqual([]);
});
