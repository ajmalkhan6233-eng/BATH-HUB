# Bath Hub v1: start here

## What is in v1
- **Shop screens** (`/bathco_complete.html`): Dashboard, Daily Sales, Stock, POS Billing, GRN, Expenses, Cheques, Vendors, Barcode, Reports.
- **Shop Tools tab:** tile calculator (room size to boxes), price per m², item search, till summary, best sellers, low stock, stock-take sheet.
- **Growth tabs:** Enquiries (which channel brings customers), Content (TikTok/live plan, you post by hand), Competitors, Website Catalogue (what the public site shows), Reply Drafts, Policy Watch, Branches, Agent Rules.
- **Agent Review tab:** LAYLA drafts a reply to a customer message and checks itself (no cost/margin/loan/commission, prices marked "needs Aj approval", halal, "I don't know" instead of guessing). You approve or reject. **Nothing is ever sent for you** (approved drafts have an "Open in WhatsApp" button; you press send).
- **Document Inbox tab** (in `/nature` and the full app): photos of your handwritten papers, sent by direct upload or to LAYLA on WhatsApp. Write the heading at the top: BILL, GRN, CHEQUE, EXPENSES or DAILY SALES. The photo shows beside the fields it was read into; you fix anything wrong and press **Confirm and file**. Bill goes to POS bills (marked as a paper bill, with the date on the paper), GRN to goods received (pending review, stock not changed), cheque to the cheque register, sales/expense sheet to the daily summary. **Nothing is filed until you press Confirm.** Handwriting reading is UNVERIFIED until real photos are tried; you can always correct or type the fields by hand.
- **Public website** (`/bathhub.html`): shows the tiles you tick "Show on website". Until one is published it shows sample tiles.
- Original dashboard: `/nature`.

## Try it on this PC (test database only, never the live shop)
1. Test database: PostgreSQL on port **5433**, database **bathco_test** (UTF8).
2. App on port **3100** (`.env` in this folder points at bathco_test only).
3. Test login: see `.test-login.txt` (user `testadmin`).
4. Open `http://localhost:3100/bathco_complete.html` and `http://localhost:3100/bathhub.html`.

To rebuild the test database from nothing:
```
node scripts/dev/load_test_schema.js     (tables; refuses any database that is not a UTF8 "...test..." one)
npm start                                 (boot once, then open /setup.html or POST /api/setup/complete)
node scripts/dev/seed_test_data.js        (demo sales, items with pictures, enquiries, drafts)
```

## Rules the app follows
- Nothing is sent, posted, priced or paid by itself. The agent drafts; Aj approves.
- Halal only: no interest, no penalty fees, no guaranteed returns.
- Cost, margin, supplier price, loans and commissions never appear on any public page or customer reply.
- Prices on the website are hidden ("ask us") by default.
- Everything uses Sri Lanka time (Asia/Colombo). The database must be UTF8 (Sinhala and Tamil).

## Before using it with real customers
- Have a native speaker check the Sinhala and Tamil text on the website.
- Confirm the real database is UTF8 and has the live schema (the test schema here is only for trying things out).
- Live WhatsApp draft-only mode is built but OFF. To turn it on: set `AGENT_DRAFT_ONLY=true` in `.env` and restart. Customers' messages then become drafts in Agent Review and nothing is sent automatically; the owner's own number still works as before.
