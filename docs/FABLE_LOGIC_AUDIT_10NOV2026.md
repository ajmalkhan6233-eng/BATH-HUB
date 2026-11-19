# Logic audit of the money flows (Fable, 10 Nov 2026)
Read-only audit by the cloud chat builder on the Fable model. Nothing was changed. Fixes are for a later Sonnet build, one module each, tested on a copy.
Scope read: routes/pos_bills.js, pos_bill_corrections.js, utils/priceGuard.js, utils/oversold.js, utils/posCredit.js, routes/profit.js, dashboard_pro.js (profit part), grn_workbench.js (stock-in), utils/grn_math.js, cheque_register.js, pos_ledger_bridge.js, vendor_ledger.js (payments).
Not checked: Layla, website, salary, loans, day-close screens, report pages, the live PC data.

## HIGH (a money or stock number can be wrong)
1. Stock give-back uses today's switch, not the bill's. Void and edit return stock when POS_DEDUCT_STOCK is on NOW, even if it was off when the bill was made (or the reverse). Fix: save "stock was deducted" on each bill and use that. Also confirm the switch is ON at the PC, otherwise sales never reduce stock. (pos_bills.js 233/261, pos_bill_corrections.js void + edit)
2. Vendor payments have no guard. A payment can be more than what is owed, can be made on a voided bill, and a double tap saves it twice. Fix: check owed amount, refuse voided bills, add a double-tap key. (vendor_ledger.js bills/:id/payments)
3. Till summary groups by the bill's label, not the payment parts. A split bill (part cash, part credit) shows under "split", so the cash-to-count figure is short. Fix: build the summary from pos_bill_payments like the dashboard does. (pos_bills.js /pos-bills/summary)
4. Profit uses each item's average cost TODAY. Past profit moves every time a new GRN changes the cost, and lines with no cost count as zero cost, so profit looks higher. Fix: store the cost on the bill line at the moment of sale and use it. (profit.js, dashboard_pro.js)

## MEDIUM
5. Price guard gaps. A line typed without an item code (or with an unknown code) is only checked for price 0. When a discount rule exists, the floor is based on selling price only, so an item priced below cost passes. Fix: owner approval for no-code lines above a small amount; floor = the higher of the two. (utils/priceGuard.js)
6. Void leaves loose ends. A customer cheque already copied to the Cheques page stays there, and an "owed to customer" (oversold) row stays open. Fix: close both in the same void. (pos_bill_corrections.js void)
7. One failed side-check can fail a whole sale. The oversold check runs inside the bill's transaction with only try/catch; a failed query there breaks the rest of the save. Fix: wrap it in a SAVEPOINT. (pos_bills.js 260)
8. GRN matches items by NAME only. Two items with the same name share stock and cost; a small spelling change makes a duplicate item. Fix: match by item code first, name second. (grn_workbench.js applyLines)
9. Cheque register is open to all logged-in staff and has no duplicate guard. Any staff can add a cheque or mark it cleared or bounced; the same cheque can arrive from 5 entry paths. Fix: owner-only writes, refuse the same cheque number + bank twice. (cheque_register.js)
10. Two cheque lists. The Cheques page (cheque_register, lower-case statuses) and the vendor ledger cheques (CLEARED/BOUNCED/CANCELLED) are separate, so totals can disagree. To confirm on the copy, then decide one source of truth.

## LOW
11. Payment method is saved as typed ("Cash" and "cash" become two groups in reports). Fix: save lower-case.
12. A credit customer with no phone is matched by name only, so a debt can land on another person with the same name.
13. Voiding a part-paid credit bill keeps the paid money with no refund note.
14. Database error text is still sent to the browser in several routes (already on the open list).

## Checked and sound
Line and bill totals (rounded lines, total = sum of printed lines), bill number lock, payments must equal the total, discount cap with owner approval, Sri Lanka date handling, credit part saved to "customers owe us" in the same transaction, weighted average cost formula, void keeps full history and is owner-only.

## Suggested fix order (Sonnet, one bridge task each)
A. 1 + 7 (stock truth). B. 2 (vendor payment guard). C. 3 + 11 (till summary). D. 4 (cost on the bill line). E. 5 + 6. F. 8, 9, 10 after a look at real data on the copy.
