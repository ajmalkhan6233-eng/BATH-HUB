// Receiving check on the CLOUD TEST COPY only (http://localhost:3199, db bhtest via psql user bh): part delivery, short, damage, tick on arrival, stays editable.
// Usage: bash scripts/dev/cloud_rig.sh ; node scripts/dev/grn_receiving_check.js
const { chromium } = require('playwright'); const { execSync } = require('child_process');
const q=(sql)=>execSync(`PGPASSWORD=bh psql -h localhost -U bh -d bhtest -tAc "${sql}"`).toString().trim();
let pass=0,fail=0;const ok=(c,m)=>{c?pass++:fail++;console.log((c?'  PASS ':'  FAIL ')+m)};
(async()=>{
q("DELETE FROM products WHERE name LIKE 'ZZG %'; DELETE FROM grn_records WHERE supplier_name='ZZG Vendor'; DELETE FROM grn_bill_extra WHERE bill_id IN (SELECT id FROM vendor_bills WHERE vendor_name='ZZG Vendor'); DELETE FROM vendor_bills WHERE vendor_name='ZZG Vendor'");
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:3199/grn_workbench.html');await p.evaluate(()=>localStorage.clear());await p.goto('http://localhost:3199/grn_workbench.html');await p.waitForSelector('tbody tr');
await p.click('[data-new="GRN"]');
await p.fill('#right input[list=vlist]','ZZG Vendor');await p.fill('#right input[placeholder^="Bill / GRN"]','ZG-1');await p.keyboard.press('Tab');
// 3 lines: A 10 x 100 (all arrives), B 5 x 200 (not delivered yet), C 4 x 50 (1 short, 1 damage)
const set=async(r,c,v)=>{await p.fill(`input[data-r="${r}"][data-c="${c}"]`,String(v));await p.keyboard.press('Tab')};
await set(0,1,'ZZG A');await set(0,2,10);await set(0,3,100);
await p.click('text=+ Add line');await set(1,1,'ZZG B');await set(1,2,5);await set(1,3,200);
await p.click('text=+ Add line');await set(2,1,'ZZG C');await set(2,2,4);await set(2,3,50);
await set(2,6,1);await set(2,8,1);              // short 1, damage 1 -> net 2
await p.uncheck('input[data-g="1"]');           // B not delivered
await p.fill('#paper','2200');await p.keyboard.press('Tab');
const calc=await p.textContent('#calc');ok(/1,100\.00/.test(calc),'GRN total follows received qty: A 1000 + C 100 = 1,100 (got '+calc+')');
const match=await p.textContent('#match');ok(/match the paper/.test(match)&&/NOT received \/ returned: Rs 1,100\.00/.test(match)&&/2,200/.test(match),'difference marked, paper total kept: '+match);
ok(/PART RECEIVED/.test(await p.textContent('#drafts'))&&/PART RECEIVED/.test(await p.textContent('#sttag')),'draft list + tag say PART RECEIVED');
await p.click('#ok');await p.waitForFunction(()=>/SAVED/.test(document.querySelector('#status').textContent));
ok(/keep editing/.test(await p.textContent('#status')),'after saving the screen stays open for editing');
ok(!(await p.isDisabled('#ok')),'OK / Save button is still clickable after saving');
ok(q("SELECT stock_level FROM products WHERE name='ZZG A'")==='10','stock A = 10');
ok(q("SELECT COUNT(*) FROM products WHERE name='ZZG B'")==='0','B not delivered: no stock, no item created');
ok(q("SELECT stock_level FROM products WHERE name='ZZG C'")==='2','C net 2 (4 - 1 short - 1 damage)');
ok(q("SELECT total FROM vendor_bills WHERE bill_no='ZG-1'")==='1100.00','bill total in the app = 1,100.00');
// delivery arrives: tick B, and the 1 short of C comes: short 0
await p.check('input[data-g="1"]');await p.fill('input[data-r="2"][data-c="6"]','0');await p.keyboard.press('Tab');
ok(/2,000\.00|2,\d{3}\.00/.test(await p.textContent('#calc')),'total updates when delivery is ticked');
await p.click('#ok');await p.waitForFunction(()=>/CHANGES SAVED/.test(document.querySelector('#status').textContent));
ok(q("SELECT stock_level FROM products WHERE name='ZZG B'")==='5','B arrived: stock 5 added');
ok(q("SELECT stock_level FROM products WHERE name='ZZG C'")==='3','C: short piece arrived, net 3 (4 - 1 damage)');
ok(q("SELECT total FROM vendor_bills WHERE bill_no='ZG-1'")==='2150.00','bill total = 1000+1000+150 = 2,150.00');
// reopen later from the saved list: the not-received / damage marks are remembered
await p.reload();await p.waitForSelector('tbody tr');
const id=q("SELECT id FROM vendor_bills WHERE bill_no='ZG-1'");
const j=await p.evaluate(async id=>(await fetch('/api/grn-workbench/saved/'+id)).json(),id);
ok(j.extra&&j.extra.lines.length===3&&j.extra.paper_total===2200&&j.extra.lines[2].dmg===1,'reopened bill remembers paper total 2,200 and the damage mark');
console.log('errors',errs.length,errs.slice(0,2));
q("DELETE FROM products WHERE name LIKE 'ZZG %'");
await b.close();console.log('RECEIVING CHECK',pass,'passed',fail,'failed');process.exit(fail?1:0)})()
