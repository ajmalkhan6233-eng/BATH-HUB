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
  // 2027: Central Bank of Sri Lanka list (cbsl.gov.lk bank-holidays-2027), checked 2026-10-11. Includes poya days.
  2027: [
    '2027-01-15', '2027-01-22',
    '2027-02-04', '2027-02-20',
    '2027-03-06', '2027-03-10', '2027-03-22', '2027-03-26',
    '2027-04-13', '2027-04-14', '2027-04-20',
    '2027-05-01', '2027-05-17', '2027-05-19', '2027-05-20',
    '2027-06-18', '2027-07-18',
    '2027-08-15', '2027-08-16',
    '2027-09-15', '2027-10-15', '2027-10-28',
    '2027-11-13', '2027-12-13', '2027-12-25',
  ],
};
const yearLoaded = (y) => Object.prototype.hasOwnProperty.call(SL_BANK_HOLIDAYS, y);
const all = () => Object.values(SL_BANK_HOLIDAYS).flat();
module.exports = { SL_BANK_HOLIDAYS, yearLoaded, all };
