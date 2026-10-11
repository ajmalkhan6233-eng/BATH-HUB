'use strict';
// Supplier price alerts: a GRN line whose unit cost moved more than 3 percent from the last cost paid to the SAME supplier for the SAME item.
const THRESHOLD_PCT = 3;
const money = (n) => Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Returns null when there is no previous price, nothing changed enough, or a value is unusable. */
function priceChange(oldCost, newCost, thresholdPct = THRESHOLD_PCT) {
  const o = Number(oldCost), n = Number(newCost);
  if (!(o > 0) || !(n >= 0) || o !== o || n !== n) return null;
  const pct = ((n - o) / o) * 100;
  if (Math.abs(pct) <= thresholdPct) return null;
  return { old: o, new: n, percent: Math.round(pct * 10) / 10 };
}
function buildMessage(supplier, grnNumber, changes) {
  const lines = changes.map((c) => `${c.name}: ${money(c.old)} -> ${money(c.new)} (${c.percent > 0 ? '+' : ''}${c.percent}%)`);
  return `SUPPLIER PRICE CHANGE\n${supplier}, ${grnNumber}\n${lines.join('\n')}`;
}
module.exports = { priceChange, buildMessage, THRESHOLD_PCT };
