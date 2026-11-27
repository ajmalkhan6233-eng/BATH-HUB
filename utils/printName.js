'use strict';
// Name printed on statements/reports only (AJ 27 Nov). The saved vendor name, bills and invoices do not change.
const NAMES = { 'lucky trading': 'Zamir' };
module.exports = (v) => NAMES[String(v || '').trim().toLowerCase()] || v;
