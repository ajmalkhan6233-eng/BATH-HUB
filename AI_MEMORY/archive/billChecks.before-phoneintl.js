'use strict';
/** Checks for a bill drafted from a photo (or typed). A person confirms the draft until accuracy is proven. */
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const isIso = (s) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false; const [y, m, d] = String(s).split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10) === String(s); };

/** Sri Lankan mobile or landline to +94XXXXXXXXX, or null if it cannot be one. */
function normalisePhone(p) {
  const d = String(p || '').replace(/[^\d+]/g, '');
  let n = d.replace(/^\+/, '');
  if (n.startsWith('94') && n.length === 11) n = n.slice(2);
  else if (n.startsWith('0') && n.length === 10) n = n.slice(1);
  return /^[1-9]\d{8}$/.test(n) ? `+94${n}` : null;
}

function validateBillDraft(d, { tolerance = 1, today } = {}) {
  const flags = []; const items = Array.isArray(d.items) ? d.items : [];
  if (!items.length) flags.push('NO_ITEMS');
  let sumItems = 0;
  items.forEach((it, i) => {
    const qty = Number(it.qty), rate = Number(it.rate), amt = Number(it.amount);
    if ([qty, rate, amt].some((x) => !Number.isFinite(x) || x < 0)) flags.push(`ITEM_${i + 1}_NUMBER_INVALID`);
    else if (Math.abs(qty * rate - amt) > tolerance) flags.push(`ITEM_${i + 1}_MATH`);
    sumItems += Number.isFinite(amt) ? amt : 0;
  });
  sumItems = r2(sumItems);
  if (d.total === undefined || d.total === null || d.total === '') flags.push('MISSING_TOTAL');
  else if (Math.abs(sumItems - Number(d.total)) > tolerance) flags.push('TOTAL_MISMATCH');
  if (d.phone && !normalisePhone(d.phone)) flags.push('PHONE_FORMAT');
  if (d.date && !isIso(d.date)) flags.push('DATE_INVALID');
  else if (d.date && today && d.date > today) flags.push('DATE_IN_FUTURE');
  return { flags, sumItems, phone: normalisePhone(d.phone), needsReview: true };
}
module.exports = { normalisePhone, validateBillDraft };
