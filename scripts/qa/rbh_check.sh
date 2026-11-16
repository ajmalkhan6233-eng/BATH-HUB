#!/usr/bin/env bash
# RBH check, sections A and B of docs/CHECKLIST_RBH.md. TEST COPY ONLY (port 3199). Prints PASS/FAIL per step, ends with one status word.
cd "$(dirname "$0")/../.."; B=${B:-http://localhost:3199}; F=0
ok(){ echo "PASS $1"; }; no(){ echo "FAIL $1"; F=$((F+1)); }
bad=0; for f in public/*.js; do node -c "$f" >/dev/null 2>&1 || { bad=$((bad+1)); echo "  syntax: $f"; }; done
[ $bad = 0 ] && ok "1 js syntax" || no "1 js syntax ($bad)"
s=public/settings.html
! grep -qi "appearance\|fixed costs\|credit limits" $s && ok "2 settings slim" || no "2 settings slim"
grep -q "Credit limits" public/customers.html && ok "3 customers credit card" || no "3 customers credit card"
grep -q "ledger-fixed.js" public/daily-entry-v2.html && grep -q "bathhub-a11y.js" public/daily-entry-v2.html && ok "4 ledger scripts" || no "4 ledger scripts"
grep -q "pos-all.css" public/pos_billing.html && ! grep -q "pos-polish.css\|pos-onepage.css\|pos-space.css\|pos-look.css" public/pos_billing.html && ok "5 pos merged css" || no "5 pos merged css"
if ! curl -s -o /dev/null "$B/health"; then echo "test app not running: bash scripts/dev/cloud_rig.sh first (steps 6-9 skipped)"; [ $F = 0 ] && echo UNVERIFIED || echo BLOCKED; exit 0; fi
J='-H Content-Type:application/json'
c=$(curl -s -o /dev/null -w %{http_code} $J -d '{"name":"Test rent","monthly_amount":30000}' $B/api/money-control/fixed-overheads); [ "$c" = 200 ] && ok "6 add fixed cost" || no "6 add fixed cost ($c)"
curl -s -o /dev/null $J -d '{"name":"Test rent","monthly_amount":45000}' $B/api/money-control/fixed-overheads
n=$(curl -s $B/api/money-control/fixed-overheads | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const a=JSON.parse(s).filter(o=>o.name==='Test rent');console.log(a.length+':'+Number(a[0]&&a[0].monthly_amount))})")
[ "$n" = "1:45000" ] && ok "7 update not duplicate" || no "7 update not duplicate ($n)"
c=$(curl -s -o /dev/null -w %{http_code} $J -d '{"customer_name":"QA Customer","credit_limit":50000}' $B/api/credit-limits); [ "$c" = 200 ] && ok "8a credit limit set" || no "8a ($c)"
c=$(curl -s -o /dev/null -w %{http_code} $J -d '{"customer_name":"QA Customer","credit_limit":-5}' $B/api/credit-limits); [ "$c" = 400 ] && ok "8b negative refused" || no "8b ($c)"
c=$(curl -s -o /dev/null -w %{http_code} $J -d '{"role":"all","max_discount_pct":10}' $B/api/discount-rules); [ "$c" = 200 ] && ok "9 staff discount" || no "9 ($c)"
echo "Steps 10-16 are screen flows (Playwright), not in this script yet."
[ $F = 0 ] && echo "GREEN (A+B only)" || echo "BLOCKED: $F failed"
