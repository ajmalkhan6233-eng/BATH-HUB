# Bath Hub v1: start here

## What is in v1
- **Shop screens** (`/bathco_complete.html`): Dashboard, Daily Sales, Stock, POS Billing, GRN, Expenses, Cheques, Vendors, Barcode, Reports.
- **Shop Tools tab:** tile calculator (room size to boxes), price per m², item search, till summary, best sellers, low stock, stock-take sheet.
- **Growth tabs:** Enquiries (which channel brings customers), Content (TikTok/live plan, you post by hand), Competitors, Website Catalogue (what the public site shows), Reply Drafts, Policy Watch, Branches, Agent Rules.
- **Agent Review tab:** LAYLA drafts a reply to a customer message and checks itself (no cost/margin/loan/commission, prices marked "needs Aj approval", halal, "I don't know" instead of guessing). You approve or reject. **Nothing is ever sent for you.**
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
- Decide whether to connect the agent to live WhatsApp (v1 does not).
