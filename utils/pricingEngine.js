'use strict';
/** Royal Bath Hub pricing rules as pure functions. Rates live in settings; these are the defaults agreed with the owner. */
const { marginPct } = require('./margin');
const roundTo = (n, step = 1) => Math.round(n / step) * step;
const ceilTo = (n, step = 1) => Math.ceil(n / step - 1e-9) * step;
const floorTo = (n, step = 1) => Math.floor(n / step + 1e-9) * step;

// Minimum profit by cost range for ceramics (commodes, basins). PLACEHOLDER table: the owner will give the real one. [upTo, profit]
const DEFAULT_CERAMIC_TABLE = [[10000, 2500], [20000, 3500], [30000, 5000], [50000, 7000], [Infinity, 10000]];

/** Accessories: list = cost x 1.8 + 150, lowest price = cost x 1.3 */
function accessoryPrice(cost, { mult = 1.8, add = 150, floorMult = 1.3, step = 10 } = {}) {
  if (!(cost > 0)) throw new RangeError('cost must be positive');
  return { kind: 'accessory', cost, floor: ceilTo(cost * floorMult, step), list: roundTo(cost * mult + add, step) };
}
function minProfit(cost, table = DEFAULT_CERAMIC_TABLE) { return table.find(([upTo]) => cost <= upTo)[1]; }

/** Ceramics: red line = cost + minimum profit; list = red line + 25%; max safe discount follows from those two. */
function ceramicPrice(cost, { table = DEFAULT_CERAMIC_TABLE, uplift = 0.25, step = 50, minProfitOverride } = {}) {
  if (!(cost > 0)) throw new RangeError('cost must be positive');
  const mp = minProfitOverride ?? minProfit(cost, table);
  const floor = cost + mp;
  const list = ceilTo(floor * (1 + uplift), step);
  return { kind: 'ceramic', cost, minProfit: mp, floor, list, maxDiscountPct: Math.floor((1 - floor / list) * 1000 + 1e-6) / 10 };
}
/** Tiles: red line = cost x (1 + pct). First Choice Bathco gross margin is about 18% of price, which is about 22% on cost. */
function tilePrice(cost, { pctOfCost = 22, uplift = 0.25, step = 10 } = {}) {
  if (!(cost > 0)) throw new RangeError('cost must be positive');
  const floor = ceilTo(cost * (1 + pctOfCost / 100), step);
  const list = ceilTo(floor * (1 + uplift), step);
  return { kind: 'tile', cost, floor, list, maxDiscountPct: Math.floor((1 - floor / list) * 1000 + 1e-6) / 10 };
}
/** Information only (no approvals): shows the owner what a price earns. */
function marginInfo(cost, price, floor) {
  const profit = Math.round((price - cost) * 100) / 100;
  const zone = price < cost ? 'RED' : floor !== undefined && price < floor ? 'AMBER' : 'GREEN';
  return { profit, marginPct: marginPct(cost, price), markupPct: cost > 0 ? Math.round((profit / cost) * 1000) / 10 : null, zone };
}

/**
 * Real shelf markups on cost from First Choice Bathco's item price list (Lasersoft export, 22 April 2026, 1,256 items; no names or prices kept).
 * Median markup on cost, with the 25th and 75th percentile. Starting values only, the owner edits them. Royal Bath Hub and First Choice Bathco are
 * on the same road: keep commodes and basins close to these shelf prices or customers will compare.
 */
const DEFAULT_CATEGORY_MARKUP = {
  basin_tap_mixer: { median: 121, p25: 89, p75: 149 },
  shower: { median: 98, p25: 63, p75: 156 },
  bidet_spray: { median: 102, p25: 91, p75: 154 },
  angle_conceal_valve: { median: 157, p25: 119, p75: 212 },
  waste_trap_gully: { median: 186, p25: 136, p75: 229 },
  hose: { median: 128, p25: 63, p75: 225 },
  accessory_set: { median: 138, p25: 111, p75: 191 },
  commode: { median: 24, p25: 23, p75: 30 },
  basin: { median: 43, p25: 34, p75: 52 },
  cabinet: { median: 65, p25: 54, p75: 80 },
  tile: { median: 35, p25: 18, p75: 45 },
};
/** List = cost x (1 + median markup); lowest = cost x (1 + p25 markup) rounded up to `step`. */
function categoryPrice(cost, category, table = DEFAULT_CATEGORY_MARKUP, step = 50) {
  const m = table[category]; if (!m) throw new RangeError(`unknown category: ${category}`);
  if (!(cost > 0)) throw new RangeError('cost must be positive');
  return { kind: 'category', category, cost, list: Math.round(cost * (1 + m.median / 100) / step) * step, floor: Math.ceil(cost * (1 + m.p25 / 100) / step) * step };
}
const priceLine = (l) => (l.kind === 'ceramic' ? ceramicPrice(l.cost, l.opts) : l.kind === 'tile' ? tilePrice(l.cost, l.opts) : accessoryPrice(l.cost * 1, l.opts));

/**
 * Package quote. lines: [{ name, qty, cost (unit), kind }]. Package price sits `bundleDiscountPct` under the sum of list prices,
 * rounded down to the nearest 100 minus 100 (e.g. 52,900). Never below the sum of red lines unless allowBelowFloor.
 */
function packageQuote(lines, { bundleDiscountPct = 12, allowBelowFloor = false } = {}) {
  let cost = 0, listSum = 0, floorSum = 0;
  for (const l of lines) {
    const q = l.qty || 1; const p = priceLine(l);
    cost += l.cost * q; listSum += p.list * q; floorSum += p.floor * q;
  }
  let price = floorTo(listSum * (1 - bundleDiscountPct / 100), 100) - 100;
  if (!allowBelowFloor && price < floorSum) price = ceilTo(floorSum, 100);
  const m = marginInfo(cost, price, floorSum);
  return { cost, listSum, floorSum, price, profit: m.profit, marginPct: m.marginPct, zone: m.zone, savingPct: Math.round((1 - price / listSum) * 1000) / 10 };
}
module.exports = { DEFAULT_CATEGORY_MARKUP, categoryPrice, DEFAULT_CERAMIC_TABLE, accessoryPrice, ceramicPrice, tilePrice, minProfit, marginInfo, packageQuote };
