# UI SPEC — Dashboard Shell + Home Screen
Self-contained spec for an external AI (Google AI Studio). You have ZERO other context; everything
you need is in this file.

## Hard rules
- Tech stack: **React 18 + Vite + Tailwind CSS**. Function components + hooks only.
- **NO backend calls.** All data comes from a local `mockData.js` module using ONLY the fake data
  below. No fetch/axios, no localStorage requirements (a theme preference in localStorage is OK).
- **NO real data.** Business is "Demo Hardware Store"; people are fake names; figures are round
  fake numbers.
- Output must be **exportable components**: plain `.jsx` files, no external UI/chart libraries
  (hand-rolled SVG for any chart), self-contained. Default-export `<DashboardApp />`.

## Purpose
The main screen of a business-management ERP for a small retail shop. A top-nav "command center"
shell hosts many pages; this spec covers the shell (nav + page frame) and the HOME page fully.
Other pages render as placeholder stubs ("Coming from integration") inside the same shell.

## Design language
Dark emerald & gold glassmorphism over an (optional) animated background layer:
- Page background: #062e21 base (leave a `<div id="theme-layer">` behind everything — a separate
  theme engine will fill it later; your components must look correct on plain dark green too)
- Glass panels/cards: `rgba(10,20,14,0.72)` background, 1px `rgba(255,255,255,0.08)` border,
  radius ~14px
- Gold accents: #d4af37 (primary), #e8cf7a (highlights/section titles), #c9a227 (deep)
- Section titles: 14px, bold, gold (#e8cf7a), letter-spaced
- Tables: compact 13px, row borders `rgba(255,255,255,0.05)`, hover row tint
- Badges: pill, tinted translucent backgrounds (green/amber/red variants)

## Shell layout
- Top bar (glass): left = brand block — company name "Demo Hardware Store" with small sub-label
  "Nature — real-data ERP"; center/right = nav; far right = icon buttons (refresh ⟳) and a
  Settings button.
- Nav = three dropdown groups + Settings (hover or click to open, close on outside click):
  - **Overview**: 🏠 Dashboard Home · 📅 Daily / Weekly / Monthly · 📈 Reports & Analytics
  - **Operations**: 👥 Customers · 💳 Credit & Aging · 🏭 Suppliers · 👤 Staff · 🧾 Cheques ·
    📦 Inventory & GRN · 📄 Quotations · 🚚 Purchasing · 🕒 Staff Extended ·
    🛒 POS Billing [OFF] · 🏷️ Barcode Labels [OFF] · 💰 Commission [OFF]
  - **Finance**: 🧮 Audit & Accounting · 📊 Accounting · ✨ AI Assistant [OFF] · 🛠️ System Tools
  - ⚙️ Settings (single button)
- Items marked **[OFF]** show a small amber "OFF" pill (feature-flagged modules; render the pill
  from a `featureFlags` mock object, all false).
- Below top bar: page title ("Dashboard") + page subtitle line, then the active page.
- Only ONE page visible at a time; simple client-side page state (no router library needed).

## HOME page (build fully)
1. **Control cluster** (glass row): ◀ prev-day · date pill showing "Mon 09 Jun 2026" with a native
   date input · ▶ next-day · ⟳ refresh · ⦿ "jump to latest closed day" · right-aligned primary
   button "📄 DAY REPORT" (mock: shows a toast "Report exported (demo)").
2. **KPI grid** — 4 glass cards, responsive 4/2/1 columns. IMPORTANT colour semantics:
   each card type has its own semantic accent; only Net Profit and Cash In Hand use the full
   red/green good-bad alarm colouring. Cards:
   - **Total Sale** — value `$ 12,450`, neutral gold accent, sub "38 invoices"
   - **Expenses** — value `$ 3,210`, neutral amber accent, sub "14 entries"
   - **Net Profit** — value `$ 2,140`, GREEN when ≥ 0 / RED when < 0, sub "after all expenses"
   - **Cash In Hand** — value `$ 1,870`, GREEN when matches expected / RED when short,
     sub "expected $ 1,870"
   Each card: small muted label, big value, sub-line; status dot top-right.
3. **"Last 7 Days" table** (glass card): columns Date | Sale | Expenses | Net Profit | Status.
   7 mock rows, e.g. `09 Jun · $ 12,450 · $ 3,210 · $ 2,140 · FULL`, statuses cycle
   FULL (green badge) / PENDING (amber) / PARTIAL (grey). Net Profit cell green/red by sign.

## Mock data module (`mockData.js`)
```js
export const branding = { company_name: "Demo Hardware Store", currency_symbol: "$" };
export const featureFlags = { pos_billing:false, inv_barcode_labels:false,
  staff_commission_display:false, ai_assistant_chat:false };
export const day = { date:"2026-06-09", total_sale:12450, expenses:3210,
  net_profit:2140, cash_in_hand:1870, cash_expected:1870, invoices:38, expense_entries:14 };
export const last7 = [ /* 7 rows as above, fake round figures, fake statuses */ ];
```
All figures must stay obviously fake/round. Fake staff names if needed anywhere: Alex Demo,
Sam Placeholder, Jordan Test.

## Acceptance
- Responsive 1280 → 360px (nav collapses to a ☰ sheet below 900px).
- Currency symbol always read from `branding.currency_symbol`, never hardcoded in JSX.
- No network requests; no console errors; every nav item navigates (stubs allowed except Home).
