'use strict';
// Items billed but still coming are not a red GRN mismatch (AJ 28 Nov).
const { CHECKS } = require('../../utils/auditInvariants');
const check = CHECKS.find((c) => c.id === 'grn_vs_bill');
const pool = (pending, billTotal) => ({ query: async (sql) => /information_schema/.test(sql) ? { rows: [{}] }
  : /vendor_pending_items/.test(sql) ? { rows: pending ? [{ bill_no: 'B1', amount: pending }] : [] }
    : { rows: [{ grn_number: 'B1', supplier_name: 'X', grn_total: '247161.00', bill_total: billTotal, no_bill: false }] } });
test('gap equal to pending items is OK and named', async () => { const r = await check.run(pool('17580', '264741.00')); expect(r.status).toBe('OK'); expect(r.detail).toContain('17,580 items coming'); });
test('gap bigger than pending stays RED', async () => { expect((await check.run(pool('17580', '270000.00'))).status).toBe('RED'); });
test('gap with nothing pending stays RED', async () => { expect((await check.run(pool(null, '264741.00'))).status).toBe('RED'); });
