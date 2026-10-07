'use strict';
/** The one place profit margin is calculated. Margin % = (selling - cost) / selling x 100, 2 decimals. NOT markup (profit / cost). */
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Margin % from cost and selling price. null when selling price is 0 or not a number (never divides by zero). */
function marginPct(cost, sell) {
  const c = Number(cost), s = Number(sell);
  if (!(s > 0) || !Number.isFinite(c)) return null;
  return round2(((s - c) / s) * 100);
}

/** Same rule when you already have the profit amount (e.g. gross profit / sales). */
function marginFromProfit(profit, sell) {
  const p = Number(profit), s = Number(sell);
  if (!(s > 0) || !Number.isFinite(p)) return null;
  return round2((p / s) * 100);
}

/** Text for screens: "23.08%", or "-" when there is no margin. */
function formatMargin(m) {
  return m === null || m === undefined || !Number.isFinite(Number(m)) ? '-' : Number(m).toFixed(2) + '%';
}

module.exports = { marginPct, marginFromProfit, formatMargin };
