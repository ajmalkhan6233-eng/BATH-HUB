'use strict';
// Vendor returns and discounts: the payable, the stock and the cost move TOGETHER. Pure maths, no database.
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const bad = (m) => { const e = new Error(m); e.status = 400; return e; };

/** Units go back to the vendor at the credited rate. Stock drops, payable drops, average cost keeps only the value that is left. */
function returnLine({ stock, avgCost, qty, rate }) {
  const s = Number(stock) || 0, a = Number(avgCost) || 0, q = Number(qty), p = Number(rate);
  if (!(q > 0)) throw bad('Return quantity must be more than 0');
  if (!Number.isFinite(p) || p < 0) throw bad('Credit rate must be 0 or more');
  if (q > s) throw bad(`Cannot return ${q}: only ${s} in stock`);
  const credit = r2(q * p), newStock = r2(s - q);
  const newAvgCost = newStock > 0 ? r2(Math.max(0, (s * a - credit) / newStock)) : r2(a);   // nothing left: keep the last cost
  return { credit, newStock, newAvgCost };
}

/** A bill discount lowers the cost of units still in stock. Share for units already sold is reported, not forced into old profit. */
function discountLine({ stock, avgCost, qtyOnBill, share }) {
  const s = Number(stock) || 0, a = Number(avgCost) || 0, q = Number(qtyOnBill), d = Number(share);
  if (!(q > 0) || !Number.isFinite(d) || d < 0) throw bad('Discount line needs a quantity and a share of 0 or more');
  const perUnit = d / q;
  const inStock = Math.min(s, q);
  return { newAvgCost: r2(Math.max(0, a - perUnit)), soldShare: r2(perUnit * (q - inStock)), perUnit: r2(perUnit) };
}

/** Split a discount over bill lines by line value; the last line takes the rounding leftover so the parts add up exactly. */
function splitDiscount(discount, lines) {
  const total = lines.reduce((t, l) => t + Number(l.value || 0), 0);
  if (!(Number(discount) > 0)) throw bad('Discount must be more than 0');
  if (!(total > 0)) throw bad('Bill has no priced lines to share the discount over');
  let used = 0;
  return lines.map((l, i) => {
    const share = i === lines.length - 1 ? r2(discount - used) : r2((Number(discount) * Number(l.value || 0)) / total);
    used = r2(used + share);
    return { ...l, share };
  });
}
module.exports = { returnLine, discountLine, splitDiscount, r2 };
