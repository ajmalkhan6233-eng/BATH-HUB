'use strict';
// RSL Ceramics invoice 5312 (GRN 35): prices for the 4 received sets + 8 new part items (Commode, Sink).
// Dry run by default. Add --apply to write. Sets keep their codes and stock (as received); parts start at stock 0.
// Saves the old values of the touched rows to backups/rsl_5312_before_<time>.json first. Safe to re-run (skips what exists).
const fs = require('fs');
const path = require('path');
const pool = require('../utils/pool');

const APPLY = process.argv.includes('--apply');
// code = existing shop code (typed/received, never changed). name must match the GRN line.
const SETS = [
  { code: '390', cost: 27000, tag: 'L/B', colour: 'L/B', kind: 'CC', parts: [15430, 11570] },
  { code: '391', cost: 27000, tag: 'Beige', colour: 'Beige', kind: 'CC', parts: [15430, 11570] },
  { code: '392', cost: 25500, tag: 'White', colour: 'White', kind: 'CC', parts: [14570, 10930] },
  { code: '393', cost: 31000, tag: 'White', colour: 'White', kind: 'IT', parts: [17710, 13290] },
];
const SET_SELL = 41500, COMMODE_SELL = 24000, SINK_SELL = 18000;

function plan() {
  const rows = [];
  for (const s of SETS) {
    if (s.parts[0] + s.parts[1] !== s.cost) throw new Error(`parts do not add to set cost for ${s.code}`);
    rows.push({ type: 'set', code: s.code, sell: SET_SELL, cost: s.cost });
  }
  for (const s of SETS) {
    rows.push({ type: 'part', name: `${s.kind} Commode ${s.colour} Grade B`, sell: COMMODE_SELL, cost: s.parts[0] });
    rows.push({ type: 'part', name: `${s.kind} Sink ${s.colour} Grade B`, sell: SINK_SELL, cost: s.parts[1] });
  }
  return rows;
}

(async () => {
  const rows = plan();
  const { rows: found } = await pool.query("SELECT id,item_code,name,stock_level,selling_price,avg_cost FROM products WHERE item_code = ANY($1)", [SETS.map(s => s.code)]);
  if (found.length !== 4) throw new Error('expected 4 set rows 390-393, found ' + found.length + ' (stop, nothing written)');
  const { rows: mx } = await pool.query("SELECT max(item_code::int) m FROM products WHERE item_code ~ '^[0-9]{3}$'");
  let next = mx[0].m + 1;
  console.log(APPLY ? 'APPLY' : 'DRY RUN', '| next free code', String(next).padStart(3, '0'));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (APPLY) {
    fs.mkdirSync(path.join(__dirname, '..', 'backups'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', 'backups', `rsl_5312_before_${stamp}.json`), JSON.stringify(found, null, 1));
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const r of rows) {
      if (r.type === 'set') {
        const cur = found.find(f => f.item_code === r.code);
        console.log(`set  ${r.code} ${cur.name} | stock ${cur.stock_level} (kept) | cost ${cur.avg_cost} | sell ${cur.selling_price} -> ${r.sell}`);
        if (Number(cur.avg_cost) !== r.cost) console.log(`   heads-up: avg_cost ${cur.avg_cost} differs from invoice ${r.cost}, cost NOT changed`);
        if (APPLY) await client.query('UPDATE products SET selling_price=$1 WHERE item_code=$2', [r.sell, r.code]);
      } else {
        const ex = await client.query('SELECT item_code FROM products WHERE lower(name)=lower($1)', [r.name]);
        if (ex.rows.length) { console.log(`part ${r.name} already exists as ${ex.rows[0].item_code}, skipped`); continue; }
        const code = String(next++).padStart(3, '0');
        console.log(`part ${code} ${r.name} | stock 0 | cost ${r.cost} | sell ${r.sell}`);
        if (APPLY) await client.query('INSERT INTO products (item_code,name,stock_level,reorder_threshold,selling_price,avg_cost,active) VALUES ($1,$2,0,0,$3,$4,true)', [code, r.name, r.sell, r.cost]);
      }
    }
    await client.query(APPLY ? 'COMMIT' : 'ROLLBACK');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  await pool.end();
})().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
