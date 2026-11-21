# AUDIT 21 NOV 2026 (read-only on live data, fixes proven on the in-memory test DB)
No supplier names, bill numbers or amounts here: this repo is public. Details are in the private bridge (QUESTIONS.md, LIVE.md).
Not proven: screens were NOT opened logged in (the owner login is AJ's), so browser console errors and buttons that do nothing are UNVERIFIED. The shop DB cannot be copied on this PC (no create-database right), so DB fixes were tested on the in-memory pg-mem DB only.

## PART 1: DATES (who can change a date, is it logged)
| Place | Old record date editable? | Logged (who, old, new, reason)? |
|---|---|---|
| POS bill (edit) | yes, owner/admin, never future | FIXED 21 Nov: money_audit_log line + pos_bill_history row (was: date not saved at all) |
| GRN invoice screen (grn_invoice.js) | yes | yes, grn_audit (old, new, who); no reason field |
| GRN workbench re-save (PUT /grn-workbench/bill/:id) | yes (bill date, due date, total, vendor, bill no) | FIXED 21 Nov: money_audit_log lines, reason optional |
| Vendor cheque (PUT /grn-cheques/:id) | yes (date, due date, amount, no, bank), not when CLEARED | FIXED 21 Nov: money_audit_log lines, reason optional |
| Cheque register status | status/notes only, no date | not needed |
| Vendor payments / vendor returns | no edit route found | vendor returns already log |
| Daily entry (daily_entry_live) | yes, overwrite per day | only updated_by + time, old value not kept (LISTED) |
| Salary, expenses, journal | journal entry date typed on create only | LISTED, not checked deeper |
Saved as typed: server.js reads Postgres DATE as plain text (no timezone shift); server and DB run Asia/Colombo. POS day change keeps the wall-clock time of the bill.
PC clock, zone (Sri Lanka Standard Time) and shop address (No. 173/1 Kandy Road, Thihariya, 074 035 5536) are correct everywhere found.

## PART 2: STALE OWNER TAB (done earlier, 21 Nov)
Build stamp "Build 21 Nov", service worker v140, old caches deleted on activate (already coded), #/stock opens Stock & items (old view hidden, not deleted).

## PART 3: FINDINGS (one line each)
### Blocks selling today
1. 11 active items have no selling price (price 0): a quick sale of them needs a typed price. Needs AJ's prices (list in QUESTIONS.md).
### Wrong money / money that does not tie
2. 3 GRN totals differ from their vendor bill totals (one supplier two bills share GRN number 001; one supplier bill has extra charges). Existing rule: a reason must be saved. Details in the bridge.
3. 3 cheque numbers appear twice (one of them is the known case of one cheque covering two bills; the other two are not yet confirmed). The daily check shows RED until AJ confirms.
4. Two spellings of one supplier name (case differs) in vendor bills, so its balance can split. Plus two similar supplier names in the vendor list (Q-fazal2).
5. 10 receipts failed with HTTP 503 (WhatsApp bridge was not ready then) and were never re-sent. Sending is outward-facing: needs AJ's yes.
6. GRN number "001" is used by two suppliers (numbering reuse): the GRN screen can mix them up.
### Looks wrong / housekeeping
7. Stock history (stock_movements) dates a back-dated bill on the day it was ENTERED, not the bill day (reports use the bill day, so only the history screen looks off).
8. stock_movements do not sum to stock_level (opening balances were never written to the ledger): the history cannot rebuild stock.
9. Date display is mixed: dd/mm/yyyy on some screens, yyyy-mm-dd on others.
10. Tests: POST /api/pos-bills cannot run on the pg-mem test DB (the RBH-S bill-number query uses a regex operator pg-mem lacks), so 10 older POS tests fail the same way before and after today's change.
11. No automated tests exist for the GRN workbench edit or the vendor cheque edit routes.
12. pm2 listed apex-server twice in links_check (heads-up from scripts/audit/links_check.js).
13. Startup on 20 Nov 20:20 logged ECONNRESET for 3 migrations and session pruning; the tables exist now, so no harm seen.
