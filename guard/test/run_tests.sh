#!/usr/bin/env bash
# Guard test on a THROWAWAY copy of the shop data (never the live database). Needs: a local Postgres on port 5544, python3, node, google-chrome.
#   bash guard/test/run_tests.sh <path to SHOP_LATEST csv folder> <path to the app folder>
set -u; CSV=$1; APP=$2; G=$APP/guard; PASS=0; FAILN=0
export NODE_PATH=${GUARD_NODE_PATH:-/home/claude/tools/node_modules}:${NODE_PATH:-} DB_HOST=/tmp DB_PORT=5544 DB_NAME=rbh_guard_test DB_USER=postgres DB_PASSWORD=x PG_BOOT_SERIAL_MS=0
export GUARD_ADMIN_USER=postgres GUARD_ADMIN_PASSWORD=x GUARD_AI_USER=ai_pc GUARD_AI_PASSWORD=x GUARD_AI_CHAT_PASSWORD=x GUARD_AI_PC_PASSWORD=x GUARD_OUT=/tmp/guard_test_out GUARD_REPO=$APP PGPASSWORD=x
P="psql -h /tmp -p 5544 -U postgres -d rbh_guard_test -Atq"; AI="psql -h /tmp -p 5544 -U ai_pc -d rbh_guard_test -Atq"
ok(){ if [ "$2" = "1" ]; then echo "PASS  $1"; PASS=$((PASS+1)); else echo "FAIL  $1"; FAILN=$((FAILN+1)); fi; }
reload(){ python3 -I /home/claude/tools/load_snapshot.py "$CSV" rbh_guard_test >/dev/null 2>&1; $P -c "ALTER TABLE products ADD COLUMN IF NOT EXISTS photo_url TEXT, ADD COLUMN IF NOT EXISTS vendor_code TEXT" >/dev/null; node $G/src/install.js >/dev/null 2>&1; rm -rf $GUARD_OUT; }  # the app (owner login) has already added photo_url/vendor_code: AI users never change table layouts
reload
node $G/src/install.js | grep -q "GUARD INSTALLED" && ok "install runs twice without harm" 1 || ok "install" 0
$AI -c "DELETE FROM products WHERE id=1" 2>&1 | grep -q "permission denied" && ok "AI user cannot DELETE a product" 1 || ok "AI user cannot DELETE" 0
$AI -c "TRUNCATE vendor_bills" 2>&1 | grep -q "permission denied" && ok "AI user cannot TRUNCATE" 1 || ok "AI user cannot TRUNCATE" 0
$AI -c "SELECT count(*) FROM guard.change_log" 2>&1 | grep -q "permission denied" && ok "AI user cannot read or touch the log" 1 || ok "AI cannot read log" 0
$AI -c "CREATE TABLE x(a int)" 2>&1 | grep -q "permission denied" && ok "AI user cannot create tables" 1 || ok "AI cannot create tables" 0
$P -c "UPDATE products SET stock_level=stock_level WHERE id=1; UPDATE products SET name=name||' ' WHERE id=1" >/dev/null; $P -c "UPDATE guard.change_log SET actor='x'" 2>&1 | grep -q "append-only" && ok "log cannot be edited, even by the owner" 1 || ok "log append-only" 0
$P -c "DELETE FROM guard.change_log" 2>&1 | grep -q "append-only" && ok "log cannot be deleted" 1 || ok "log delete" 0
# --- A: a correct task passes. The Leo GRN, declared exactly.
cat > /tmp/exp_leo.json <<'J'
{ "numbers": { "item_count": 2, "stock_pieces": 25, "stock_value_cost": 41750, "vendor_owed": { "Leo Marketing": 41750 } },
  "allowed_changes": [ {"table":"products","operation":"INSERT","count":2}, {"table":"grn_records","operation":"INSERT","count":2}, {"table":"stock_movements","operation":"INSERT","count":2}, {"table":"vendor_bills","operation":"INSERT","count":1} ] }
J
BEFORE=$($P -c "select count(*) from products"); node $G/src/guarded_task.js --task 901 --expect /tmp/exp_leo.json --screens -- node ${LEO_SCRIPT:-/home/claude/universal-project-/AI_BRIDGE/scripts/grn_leo_11032.cjs} --yes > /tmp/t901.txt 2>&1; echo "exit $?" >> /tmp/t901.txt
grep -q "^GREEN" /tmp/t901.txt && ok "correct Leo GRN passes the guard" 1 || { ok "correct Leo GRN passes the guard" 0; tail -15 /tmp/t901.txt; }
[ "$($P -c "select count(*) from products")" = "$((BEFORE+2))" ] && ok "GRN items kept (2 new)" 1 || ok "GRN items kept" 0
# --- B: wrong total. A task that quietly raises a vendor bill must be undone.
cat > /tmp/bad1.js <<'J'
const {Client}=require('pg');(async()=>{const c=new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});await c.connect();await c.query("UPDATE vendor_bills SET total=total+1000 WHERE id=8");await c.end();})();
J
S1=$($P -c "select total from vendor_bills where id=8"); node $G/src/guarded_task.js --task 902 --expect /tmp/exp_leo.json -- node /tmp/bad1.js > /tmp/t902.txt 2>&1
grep -q "^RED" /tmp/t902.txt && ok "silent vendor bill change is caught (RED)" 1 || { ok "silent bill change caught" 0; tail -12 /tmp/t902.txt; }
[ "$($P -c "select total from vendor_bills where id=8")" = "$S1" ] && ok "database restored: bill total back to $S1" 1 || ok "database restored" 0
[ "$($P -c "select count(*) from guard.change_log where task_number='902' and operation like '% (UNDONE)'")" -ge 1 ] && ok "evidence of the undone task kept in the log" 1 || ok "evidence kept" 0
# --- C: two offsetting stock changes: totals identical, row check must still catch it
cat > /tmp/bad2.js <<'J'
const {Client}=require('pg');(async()=>{const c=new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});await c.connect();await c.query("UPDATE products SET stock_level=stock_level+10 WHERE id=105");await c.query("UPDATE products SET stock_level=stock_level-10 WHERE id=310");await c.end();})();
J
echo '{"numbers":{},"allowed_changes":[{"table":"products","operation":"UPDATE","row_id":"105"}]}' > /tmp/exp_c.json
node $G/src/guarded_task.js --task 903 --expect /tmp/exp_c.json -- node /tmp/bad2.js > /tmp/t903.txt 2>&1
grep -q "^RED" /tmp/t903.txt && grep -q "not declared: UPDATE products 310" /tmp/t903.txt && ok "offsetting stock change caught by the row check (totals were equal)" 1 || { ok "offsetting change caught" 0; tail -12 /tmp/t903.txt; }
# --- D: a task that tries to DELETE
cat > /tmp/bad3.js <<'J'
const {Client}=require('pg');(async()=>{const c=new Client({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});await c.connect();await c.query("DELETE FROM cheque_register");})().catch(e=>{console.log(e.message);process.exit(1)});
J
node $G/src/guarded_task.js --task 904 --expect /tmp/exp_c.json -- node /tmp/bad3.js > /tmp/t904.txt 2>&1
grep -q "permission denied" /tmp/t904.txt && grep -q "^RED" /tmp/t904.txt && ok "AI task that deletes cheques is stopped and marked RED" 1 || { ok "delete task stopped" 0; tail -8 /tmp/t904.txt; }
[ "$($P -c "select count(*) from cheque_register")" = "6" ] && ok "all 6 cheque register rows still there" 1 || ok "cheques intact" 0
# --- E: screen guard
rm -rf /tmp/appcopy; mkdir -p /tmp/appcopy; cp -r $APP/public $APP/server.js /tmp/appcopy/; rm /tmp/appcopy/public/vendor360.html; sed -i "s/'Vendor 360'/'Vendor 361'/" /tmp/appcopy/public/menubar.js
node $G/src/screen_guard.js --check /tmp/appcopy 2>&1 | grep -q "missing page: vendor360.html" && node $G/src/screen_guard.js --check /tmp/appcopy 2>&1 | grep -q "missing menu entry: vendor360|Vendor 360" && ok "screen guard sees a removed page and a renamed menu item" 1 || ok "screen guard missing" 0
node $G/src/screen_guard.js --check $APP | grep -q "SCREENS OK" && ok "screen guard OK on the known-good folder" 1 || ok "screen guard good folder" 0
# runtime check against a small local page (real Chrome)
mkdir -p /tmp/fx; echo '<html><body><nav>Inventory Vendors Sales Banking &amp; Money Customers &amp; Online Layla Reports File</nav></body></html>' > /tmp/fx/index.html
(cd /tmp/fx && python3 -m http.server 8765 >/dev/null 2>&1 & echo $! > /tmp/fx.pid); sleep 1
node $G/src/screen_guard.js --check $APP --url http://localhost:8765/ 2>&1 | grep -q "RUNTIME OK" && ok "runtime check opens the page in Chrome and sees the menu" 1 || ok "runtime check" 0
echo '<html><body><nav>Inventory</nav><script>throw new Error("boom")</script></body></html>' > /tmp/fx/index.html
node $G/src/screen_guard.js --check $APP --url http://localhost:8765/ 2>&1 | grep -q "RUNTIME FAIL" && ok "runtime check fails on a broken page" 1 || ok "runtime fail" 0
kill $(cat /tmp/fx.pid) 2>/dev/null
# --- F: nightly check
node $G/src/nightly_check.js --baseline | grep -q "baseline saved" && node $G/src/nightly_check.js | grep -q "GREEN" && ok "nightly check GREEN after baseline" 1 || ok "nightly green" 0
$P -c "INSERT INTO vendor_bills (branch_id, vendor_name, bill_no, bill_date, total, voided) VALUES (1,'Leo Marketing','10887','2026-11-03',999,false)" >/dev/null
node $G/src/nightly_check.js | grep -q "DUPLICATE INVOICE" && ok "nightly check finds a duplicate invoice number (leading zeros ignored)" 1 || ok "nightly duplicate" 0
echo "---- $PASS passed, $FAILN failed"; [ $FAILN -eq 0 ]
