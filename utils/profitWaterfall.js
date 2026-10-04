'use strict';
/** Weekly money waterfall: fixed costs -> commission -> deposit set-aside -> split of what is left. Pure functions. */
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const SPLITS = { 1: { shop: 50, commitments: 30, savings: 10, owner: 10 }, 2: { shop: 30, commitments: 40, savings: 10, owner: 20 } };

const depositSetAside = (deposit = 200000, months = 24) => r2(deposit / months);
/** Commission is a percent of profit (never negative). Rate is an owner setting; the default 2% is the owner's decision (2026-10-04). */
const commission = (profit, ratePct = 2) => (profit > 0 ? r2((profit * ratePct) / 100) : 0);
/** Phase 1 until the shop holds one month of running costs in cash; then phase 2. */
const phaseFor = ({ shopCash = 0, monthlyCosts }) => (shopCash >= monthlyCosts ? 2 : 1);

function splitNetProfit(amount, phase = 1, splits = SPLITS) {
  const s = splits[phase];
  if (!(amount > 0)) return { shop: 0, commitments: 0, savings: 0, owner: 0, shortfall: r2(Math.abs(Math.min(0, amount))) };
  const out = { shop: r2((amount * s.shop) / 100), commitments: r2((amount * s.commitments) / 100), savings: r2((amount * s.savings) / 100) };
  out.owner = r2(amount - out.shop - out.commitments - out.savings); // owner takes the rounding remainder so the total always matches
  out.shortfall = 0;
  return out;
}

/** weekly({ grossProfit, fixedCosts, commissionRatePct, depositPerPeriod, shopCash, monthlyCosts }) */
function waterfall({ grossProfit, fixedCosts, commissionRatePct = 2, depositPerPeriod = 0, shopCash = 0, monthlyCosts = 0 }) {
  const afterFixed = r2(grossProfit - fixedCosts);
  const comm = commission(afterFixed > 0 ? grossProfit : 0, commissionRatePct); // commission on profit; zero when the period loses money
  const net = r2(afterFixed - comm);
  const splitBase = r2(net - depositPerPeriod);
  const phase = phaseFor({ shopCash, monthlyCosts });
  return { grossProfit: r2(grossProfit), fixedCosts: r2(fixedCosts), commission: comm, net, depositSetAside: r2(depositPerPeriod), splitBase, phase, split: splitNetProfit(splitBase, phase) };
}
module.exports = { SPLITS, depositSetAside, commission, phaseFor, splitNetProfit, waterfall };
