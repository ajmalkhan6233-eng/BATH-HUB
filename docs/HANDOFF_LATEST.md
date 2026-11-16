# HANDOFF 16 Nov 16:30 (chat to chat). Read AJ_NEEDS.md first.
Branch claude/ledger-stock-search is merged into work by the PC (tasks 259-269 run). AJ rule: when he says done it is done; numbered NOT DONE; reply short, "AJ," first, one paste: check bridge.
## DONE (PC confirmed unless noted)
- Enter-next in forms; fixed costs moved into Daily Ledger (Expenses tab); Settings slim; credit limits in Customers.
- GRN redesigned; its 5 CSS files merged into grn-all.css; POS CSS in pos-all.css. Stock: columns, double-click edit, cost editable.
- Stock & items look on Home, POS, Layla, ledger. Home: no repaint, retries, block_errors shown, cache-bust v98q, SW v98-q.
- Item codes: ONE 001 series, 120 letter codes changed (undo: node scripts/renumber_item_codes.js --undo). Backup taken first.
- Audit of Gemini list: docs/AUDIT_16NOV_GEMINI.md; PC audit docs/AUDIT_PC_16NOV.md; list caps added; POS draft survives refresh (pos-draft.js).
- Home truth check scripts/qa/home_truth.js; flow checks scripts/qa/rbh_flows.py (10-16). Home cards verified equal to SQL after restart.
- Rent = 70,000/month, 20,000 = advance; Cool Lanka Impex company, Cool Water brand (Delta, Marvel under it).
## OPEN (number them for AJ)
1. WhatsApp receipt image: PC says WHATSAPP_LIVE=true and AUTO_SEND=true (receipts WILL send), whatsapp-bridge online, linked UNVERIFIED. Ask AJ if auto-send ON is wanted; if yes check one real send.
2. Pocket / Face ID: built (pocket/app.js v3) but NOT deployed: held since task 209 (deploy script resets passcode/secrets, needs chat fix); wrangler not installed on PC. Fix deploy script, then one PC task (npx wrangler needs AJ yes).
3. Dummy bill OFF-86BG-3: not found in any bill table; nothing deleted.
4. Gemini signboard pictures: AJ has the paste block; waiting for his pictures.
5. POS add-item + F5 on real PC: AJ will check.
6. Pocket passcode too short: AJ said leave it.
## Rig
bash scripts/dev/cloud_rig.sh (dies between turns: restart it); curl localhost:3199/health. Pages open only inside /owner#/... (direct hit redirects). Bridge repo /home/claude/universal-project-: git pull --rebase before push.
