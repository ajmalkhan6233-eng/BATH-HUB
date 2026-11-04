'use strict';
/** GRN money maths in one place: 2-decimal rounding and weighted-average cost. */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Line total, rounded to cents so totals never drift. */
const lineTotal = (qty, cost) => round2(Number(qty) * Number(cost));

/** New average cost after receiving `qty` at `cost` on top of `oldStock` at `oldAvg`. Empty or negative stock = the new cost. */
function weightedAvgCost(oldStock, oldAvg, qty, cost) {
  const s = Number(oldStock) || 0, a = Number(oldAvg) || 0, q = Number(qty), c = Number(cost);
  if (s <= 0) return round2(c);
  return round2((s * a + q * c) / (s + q));
}

module.exports = { round2, lineTotal, weightedAvgCost };
