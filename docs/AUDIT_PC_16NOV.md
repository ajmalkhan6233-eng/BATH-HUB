# PC audit, 16 Nov 2026 (task 264, read-only, nothing changed)

## 1. Merge
Merged origin/claude/ledger-stock-search into work, no conflict (pos-draft.js, viewport). node -c ok. apex-server restarted, /health 200.

## 2. pm2 apex-server vs ecosystem.config.js
- pm2 apex-server: script E:\AI Sttuf\BATHCO_TEMPLATE\server.js, cwd same, PORT 3100, interpreter node, no args, error log local_ops\apex-server.err-1.log, started from local_ops\ecosystem.local.config.js (--only apex-server).
- ecosystem.config.js (repo root) defines bathco-server (PORT 3010), grn-watcher, whatsapp-bridge. It is NOT what runs the shop app here. Starting it would create a second server named bathco-server (known 12 Jul incident). Only whatsapp-bridge is also running from that family.

## 3. Error log (last 40 lines)
1. express-rate-limit ValidationError ERR_ERL_CREATED_IN_REQUEST_HANDLER: a rate limiter is created inside a request handler at routes/enquiries.js:142 (called from createRouter line 29). Should be created once at startup. Repeated stack lines, one event 11:44.
2. [pocket] POCKET_PASSCODE is short (needs 10+ characters).
No secrets in the log excerpt.

## 4. SELECT without LIMIT on big tables (file:line)
- routes/shop_operations.js:181 (stock_items ORDER BY item_name, no WHERE/LIMIT)
- routes/business_intelligence.js:118 (stock_items s, check WHERE/LIMIT in the full query)
Other matches (dashboard_pro.js:64,71, dashboard_breakdown.js:36, due_board.js:14) are vendor_bills aggregates with CTEs; not full dumps. Only 2 real candidates found.

## 5. Cashier check (code read, no cashier login made)
- Home: NO for cashier. /api/dashboard-pro is ownerOnly (403 for any role except admin/owner); cashier_mode.js also hides menus.
- Stock: hidden. server.js:294 sends cashiers through utils/cashierGate.js: allow-list of URLs, cost-like fields removed from any response.
- POS: cost hidden by the same gate (cost-like fields stripped).
Not tested by a real cashier login.

## 6. Browser check (in-app browser, localhost:3100/owner, owner session)
- Home: waited about 60 s; all numbers identical (only the "updated hh:mm" stamp moved 11:49 to 11:50). Numbers do not flip.
- POS add item then F5: NOT RUN (needs hands on the POS screen). AJ or chat to confirm the draft comes back.

## Findings: 4
1 rate limiter built per request (enquiries.js:142), 2 pocket passcode too short, 3 and 4 two unbounded stock_items selects.
