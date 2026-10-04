'use strict';
/**
 * Sri Lankan bank holidays, one array per year. Ported from the BATHCO ledger page (branch ledger-fixes-2026-07-25).
 * Source noted there: Central Bank of Sri Lanka list, as supplied by the owner on 2026-07-26. Verify against the CBSL list.
 * Add 2027 etc. as new keys when published. A date in a year that is NOT listed returns a warning, never "no holidays".
 */
const SL_BANK_HOLIDAYS = {
  2026: [
    '2026-01-03', '2026-01-15',
    '2026-02-01', '2026-02-04', '2026-02-15',
    '2026-03-02', '2026-03-21',
    '2026-04-01', '2026-04-03', '2026-04-13', '2026-04-14',
    '2026-05-01', '2026-05-02', '2026-05-28', '2026-05-30',
    '2026-06-29', '2026-07-29',
    '2026-08-26', '2026-08-27',
    '2026-09-26', '2026-10-25',
    '2026-11-08', '2026-11-24',
    '2026-12-23', '2026-12-25',
  ],
};
const yearLoaded = (y) => Object.prototype.hasOwnProperty.call(SL_BANK_HOLIDAYS, y);
const all = () => Object.values(SL_BANK_HOLIDAYS).flat();
module.exports = { SL_BANK_HOLIDAYS, yearLoaded, all };
