# Overnight audit: what was found and fixed

Branch `overnight`. Every fix has a test. Nothing below was invented to reach a number; items that are
only observations are listed separately at the end.

## Tests that were failing (17) - fixed
- `auth` and `daily-summary` tests (17 failures): the server's session store sat on the mocked database, so
  every request after login looked logged out. The tests now use an in-memory session store.
- `aggregate` test: it tested `scripts/import_ocr_expenses`, which is not in this template. Removed.
- One auth test expected the `owner` role to be read-only. The template gives `owner` the same access as
  `admin` (the read-only "uncle" role belonged to the original live system). Test and comment now say so.
  **Decision for Aj:** if you want a read-only role, add a new role; don't restrict `owner`.

## Bugs fixed
### Security
1. WhatsApp webhooks (`/webhook/whatsapp`, `/webhook/whatsapp-photo`) had no authentication: anyone could post fake
   customer messages (and answer YES to a pending draft, writing into daily sales) or name any file on the server
   to be read and sent to the OCR model. Now: local caller only, or `WEBHOOK_SECRET`; photo paths confined to the inbox.
2. Login and the 4-digit admin PIN could be guessed at 100 tries per 15 minutes. Now 10 and 5 failed tries per 15 min.
3. A disabled user (`active = false`) could still log in and kept existing sessions (up to a year). Now refused and signed out.
   Changing someone's role also signs them out. Nobody can disable or demote their own account.
4. `POST /api/items` let a web request switch off the duplicate-name check and set `photo_url`.
5. Payroll CSV export: formula injection (cells starting `= + - @`).
6. Dashboard assistant accepted client-supplied `system` messages and crashed on null history entries.

### Money
7. A sale could be refunded or exchanged any number of times, clawing the commission back repeatedly.
8. POS bill subtotal was the sum of unrounded lines while the printed lines were rounded (off by cents).
9. Held (postponed) cheques disappeared from due-soon, the daily cash plan ("safe to withdraw" overstated),
   the month cash forecast and notifications. A cleared/bounced cheque could be put back on hold, and a repeat hold
   lost the original date.
10. "Can we cover today" counted credit (on-account) sales as cash in hand.
11. Supplier aging aged the oldest delivery ever received, not the oldest unpaid one.
12. Stock: editing a stock item's notes reset its unit and reorder level; a "restock" could remove stock and a "sale"
    add it.
13. Staff advances: negative amounts, and repayments larger than the amount owed.
14. Accounting: negative/text amounts in journal entries (unknown account codes too), petty cash (a negative expense added
    to the float), bank transactions, budgets, landed cost (a typo silently counted as 0), supplier prices.
15. Receipts could be sent to the customer twice on a double-tap. Now asks before sending again.
16. Platform admin: client payments accepted negative amounts and bad dates.

### Display / validation
17. Purchasing, Accounting and Staff tabs in `BATHCO_NATURE.html` read field names the API never sends: Supplier Aging
    showed the amount paid under "Outstanding" with no supplier name; journal entries, chart of accounts, trial balance,
    petty cash, budgets, leave, advances, cheque calendar, customer lifetime value were blank or empty. P&L and VAT were
    stuck on June 2026.
18. Smaller validation gaps returning database errors instead of clear messages: discount caps (0-100), credit limits,
    receipt queue, leave/attendance dates, money-control inputs, year-end closing year, report date ranges.

## Observations (not changed)
- Several routes treat "today" as the UTC date, so between midnight and 05:30 Sri Lanka time they mean yesterday.
  Affects the Money Control dashboard and default dates. Needs a timezone decision (server-wide).
- `daily-cash-plan` calls sales minus expenses "gross profit"; the business rule says net profit = gross profit - expenses.
  The figure is a cash surplus, not profit. Rename or recompute when convenient.
- The business routes are open to any logged-in `owner`/`admin`; the `staff` role is blocked from everything except their own salary/loans.
- `public/bathco_complete.html` and `public/BATHCO_NATURE.html` are two separate screens. The M1-M8 tabs and Shop Tools are in
  `bathco_complete.html`; the tabs fixed in item 17 are in `BATHCO_NATURE.html`.
- Setup wizard accepts an SVG logo; an SVG can carry script. Only the person doing first-run setup can upload it.
- `bathhub.html` was not on this machine; see `docs/BATHHUB_WEBSITE.md`.
