# BATHCO_BLUEPRINT — System Rules & Conventions
*Royal Bath Hub — LAYLA Dashboard | Last updated: 2026-06-20*

---

## STANDING RULES

### RULE 1 — File Upload = Immediate Action (17-Jun-2026)

**The act of attaching files via Daily Entry → Attach Files IS the instruction to act. Ajmal must never separately say "now go process this."**

Required behavior every time files are attached for any date:

1. **Read/OCR immediately** — Every newly attached file for that date is read/OCR'd without waiting. No manual prompt needed.

2. **Cross-check all required sources** — For any date, check against:
   - Pre-16-Jun: Excel daily log + Lasersoft Profit by Sales
   - 16-Jun onward: Excel daily log + Lasersoft Profit by Sales + handwritten A4 expense/photo
   If any source is still missing after the upload, state exactly what is still needed — do not go silent.

3. **Recalculate and update DB immediately** — As soon as all required sources are present and matched, update `daily_summary` for that date. Do not wait for a separate "go" command.

4. **Refresh dashboard Home immediately** — After any DB update, the Home page totals (Total Sale, Cash Payment, Card/Online/Cheq, Expenses, Net Profit, Cash Out) must reflect the new numbers. State the before/after values in the response.

5. **Report missing sources clearly** — If sources are incomplete after the new upload, list exactly what is still missing (e.g., "Lasersoft export for 2026-06-17 not yet uploaded"). Never wait passively.

---

## RECONCILIATION RULES

### Invoice Cross-Check
- Match every receipt number in the Excel log against the Lasersoft Profit by Sales export for that date.
- For each invoice, verify: cash + card + online + cheq + credit = sale amount. Flag any row where the payment breakdown does not sum to the sale amount.
- If the Excel has a receipt NOT in Lasersoft (e.g., an after-hours sale like receipt "433"), treat as **PENDING_RECONCILIATION** — flag by invoice number, do not exclude it from totals, do not treat as an error.

### Payment Classification
- Cash: physical notes/coins collected
- Card: debit card terminal
- Online: bank transfer / online banking
- Cheq: cheque
- Credit: amount invoiced but not yet collected (creates customer balance)

### Date Coverage Requirements
| Period | Required Sources |
|--------|----------------|
| 31-Jan-2026 onward (pre-16-Jun) | Excel daily log + Lasersoft per-day export |
| 16-Jun-2026 onward | Excel daily log + Lasersoft per-day export + handwritten A4 expense/photo |

### Lasersoft "Range" Files
Range exports (e.g., DATE: 2025-11-01 Through 2026-05-27) are cumulative by product and do NOT satisfy the per-day Lasersoft requirement. Only per-day exports count.

---

## STAFF PAYMENTS

### Two Notepad Types
1. **Commission/Loan Note** — Daily commission amounts, net of any loan deductions. Total recorded in `staff_payments_total` (commission component).
2. **Salary Note** — Monthly/periodic salary advances. Total recorded in the `salary` column of `daily_summary`.

### Accounting Treatment
- Salary (from salary notepad) → `daily_summary.salary` column. Already included in `total_expenses` on the handwritten A4 expense sheet — do NOT double-subtract from net_profit.
- Commission (from commission/loan notepad) → tracked separately in `staff_payments_total`. Does NOT subtract from net_profit — commission/bonus is considered part of the cost structure already reflected in Lasersoft margin.
- Line-item breakdowns stored in `details` JSONB column for traceability.

**⚠ Assumption flagged for Ajmal confirmation:** Commission payments (19,350 on 17-Jun) are assumed to be already accounted for in the cost structure and are NOT deducted from net_profit. If this is wrong and commissions should reduce net_profit, advise and the formula will be updated.

---

## GROSS PROFIT SOURCE

- gross_profit is always taken from **Lasersoft Profit by Sales → SUB TOTALS → GPA** column.
- Never use the handwritten sheet's implied gross profit — the handwritten shows net cash flow, not gross margin.
- net_profit = gross_profit − total_expenses
  Where total_expenses = full left-column expenses total INCLUDING salary as one line.
  payments (right column) is EXCLUDED from net_profit — it is cash flow only.

---

## DATABASE FIELD MAP

| Field | Source |
|-------|--------|
| `total_sale` | Lasersoft total + any pending after-hours receipts |
| `lasersoft_total` | Lasersoft SUB TOTALS AMOUNT — no adjustment |
| `cash_sale` | Physical cash collected (from cash reconciliation) |
| `card_sale` | Debit card payments |
| `online_sale` | Bank transfer / online payments |
| `cheq_payment` | Cheque payments |
| `credit_sale` | Invoiced but uncollected (customer balance) |
| `total_expenses` | Full left-column expenses total from handwritten A4 — includes salary as ONE line |
| `salary` | Legacy separate salary column — should be 0; salary belongs in total_expenses |
| `payments` | Right-column payments (broker fees, advances, transfers) — cash flow OUT only, NOT P&L |
| `gross_profit` | Lasersoft GPA (gross profit amount) |
| `net_profit` | gross_profit − total_expenses (payments excluded) |
| `cash_in` | Total cash in (cash collected from customers) |
| `cash_out` | Computed: total_expenses + payments + salary + cash_out_col − cash_received |
| `cash_in_hand` | Physical cash remaining at end of day |
| `staff_payments_total` | Sum of commission note + salary note (for audit; no P&L impact) |

---

## SHOP OPENING DATE

First receipt: **SL000441 dated 31-Jan-2026**. Dates before 31-Jan-2026 are pre-opening; zero transactions expected and do not count as missing data.

---

## SECURITY
- API keys never shared in chat — stored in `C:\BATHCO_PHASE1\.env` only.
- If any key is exposed in chat, revoke immediately at console.anthropic.com.

---

## SESSION NOTES — 17-Jun-2026 (Handover)

### What was found wrong and fixed

**Bug 1 — Expenses showing 30,080 (correct: 56,580)**
Root cause: total_expenses was stored as 30,080 (only the non-salary line items summed separately), while salary (26,500) was stored in the `salary` column. The Expenses KPI box reads only `total_expenses`, so it showed 30,080 instead of the full 56,580 from the handwritten A4 sheet.
Fix applied: Set `total_expenses = 56,580` (full A4 total, salary included), `salary = 0`.

**Bug 2 — Net Profit stuck on PENDING**
Root cause: The tier logic requires `gp_status = 'ACTUAL'` AND `total_expenses > 0` for FULL tier. The DB row had `gp_status = NULL` (not set during update), so tier computed as CASHFLOW and the dashboard showed PENDING instead of the stored net_profit.
Fix applied: Set `gp_status = 'ACTUAL'`. Combined with total_expenses = 56,580 > 0, tier is now FULL.

**Bug 3 — Cash Out showing 113,160 (correct: 56,580)**
Root cause: `CASH_OUT_EXPR = total_expenses + payments + salary + cash_out - cash_received`. The row had total_expenses = 30,080 + salary = 26,500 + cash_out column = 56,580 → triple-counted to 113,160.
Fix applied: Set `cash_out = 0` and `salary = 0`. Now CASH_OUT_EXPR = 56,580 + 0 + 0 + 0 = 56,580 ✓.

**Rule established going forward:** The `salary` and `cash_out` DB columns should be left at 0. All daily outgoing cash (including salary) goes into `total_expenses` alone. The CASH_OUT_EXPR formula computes cash_out_total from total_expenses only.

### Current verified DB state (17-06-2026, confirmed via query)
| Field | Value |
|-------|-------|
| total_sale | 137,160 |
| cash_sale | 131,530 |
| online_sale | 5,630 (SL001950, FLAGGED — Excel may show 31,630) |
| total_expenses | 56,580 |
| salary col | 0 |
| cash_out col | 0 |
| gross_profit | 12,729.32 |
| net_profit | −43,850.68 |
| cash_in_hand | 75,000 |
| staff_payments_total | 45,850 (audit only, not in P&L) |
| gp_status | ACTUAL |
| day_status | CONFIRMED |
| reconciliation_status | PARTIAL_FLAGS (3 open items) |

### Open flags still in DB (need Ajmal to resolve)
1. **Receipt 433 (20,700)** — after-hours cash sale, not in Lasersoft. Included in total_sale but marked PENDING_RECONCILIATION. Ajmal should confirm when Lasersoft is updated with this receipt.
2. **SL001950** — Lasersoft shows 5,630. Excel photo appears to show 31,630. Ajmal should open 17-06-2026.xlsx and confirm the C-column value for SL001950 row. If it is 5,630, no change needed. If it is 31,630, total_sale and payment breakdown need correction.
3. **Handwritten total_sale = 102,160** — Does not match the calculated 137,160 (Lasersoft 116,460 + receipt 433 20,700). Could not reconcile from the photo. Ajmal to clarify what his 102,160 figure represents.

### What is NOT yet done (pick up next session)
1. **Server restart needed** — server.js has two new endpoints added (`/api/report-download` and `/api/nl-query`) but the server has not been restarted. These endpoints will not respond until `pm2 restart bathco-server` is run.
2. **`runNlQuery()` JS function not added** — The "Ask a Question" UI box was added to the Home page HTML, but the `runNlQuery()` JS function that calls `/api/nl-query` was not yet written. Clicking "Ask" will throw a console error until this is added.
3. **Verify `callAnthropic` export from layla.js** — The `/api/nl-query` server endpoint uses `const { callAnthropic } = require('./layla')`. Need to confirm layla.js exports this function; if not, add `module.exports = { callAnthropic }` to layla.js.
4. **Parts 2 & 3 full test** — Download Report button (PDF/Excel) and the NL query interface both need end-to-end testing after server restart.
5. **Staff commission rule confirmation** — Commission note (19,350) is stored in `staff_payments_total` and does NOT reduce net_profit. This assumption is flagged in checker_flags. Ajmal needs to confirm: should commission reduce net_profit, or is it already accounted for in cost of goods?

---

## DAY LIFECYCLE FORMULA SPEC *(source of truth — 2026-06-20)*

### Two Distinct Concepts — Do Not Merge

| Concept | What it includes | Used for |
|---|---|---|
| **Expenses** (`total_expenses`) | Shop running costs: labor, transport, masjid/saduka, salary lump sum, refreshments. Left column of handwritten sheet. | **Net Profit** |
| **Payments** (`payments` DB column) | Cash movements that are NOT operating expenses: broker fees, salary advances, loan/cash returns, savings transfers. Right column of handwritten sheet. | **Cash Out / Cash in Hand only** |

`staff_payments_total` is supporting detail for the Salary line inside Expenses. **Never sum it into `cash_out` or `net_profit`.**

### Petty Cash Float
Fixed at **Rs. 25,000** — written at top-right of handwritten sheet every day.

### Data Sources (authority order)
1. Excel Day Sheet (`DD-MM-YYYY.xlsx`) — Sale total, Cash/Online/Cheque breakdown, per invoice
2. Handwritten Petty Cash Sheet (photo) — Expenses (left) and Payments (right). Petty cash float at top.
3. Lasersoft "Profit by Sales" — Gross Profit & cost per invoice
4. Lasersoft "Rep Sales Analysis" — per-staff NETPRO for commission

### Manual / After-Hours Bill Timing Rule
Bills written after ~6pm are entered as a fresh sale in the **NEXT day's Excel** — never backdated.
- Card/online bills: payment settles on the original day (midnight settlement), even though invoice appears next day. This is expected — not an error.
- Excel total sale can exceed Lasersoft subtotal by the gap = manually entered invoices not yet in Lasersoft.

### Manual Bill Costing Rule
- Item codes specified → use exact cost from inventory
- Lump total only → use that day's Lasersoft average GP% as estimate, flag as "estimated"

### Core Formulas
```
expenses_total      = SUM(handwritten sheet, left column)         // includes Salary as ONE line
payments_total      = SUM(handwritten sheet, right column)        // broker fees, advances, transfers
cash_out_total      = expenses_total + payments_total
cash_sale_total     = SUM(Excel "Cash Payment" column for the date)
cash_in_hand        = cash_sale_total - cash_out_total
gross_profit_total  = SUM(Lasersoft GPA) + SUM(estimated GP for manual invoices)
net_profit          = gross_profit_total - expenses_total          // payments_total EXCLUDED from P&L
staff_commission    = 0.01 × NETPRO[person]                       // Lasersoft Rep Sales, pay period 25th–24th
```

### DB Column Mapping
| Formula term | DB column | Notes |
|---|---|---|
| `expenses_total` | `total_expenses` | Left column — includes salary |
| `payments_total` | `payments` | Right column — outgoing cash flow only |
| `cash_out_total` | CASH_OUT_EXPR | Computed: `total_expenses + payments + salary + cash_out - cash_received` |
| `cash_received` | `cash_received` | Genuine money IN (rare) — NOT the handwritten right column |
| `staff_payments_total` | `staff_payments_total` | Display-only breakdown detail, never summed into P&L |

### OCR Confidence / Edit-Flag UI (future feature — §9)
When a line-item amount is unreadable in a handwritten photo:
1. Sum readable items → subtract from `printed_totals.cash_out` to back-calculate missing value
2. Auto-fill with **"?" badge** (orange highlight)
3. Field must be tap-to-edit directly on dashboard day-view
4. On edit: log old→new, timestamp, editor into Corrections Log; reapply retroactively if same error found elsewhere
*(Not yet implemented. OCR already extracts `printed_totals` — back-calculation logic to be added.)*

### Day Close Validation Checklist
- [ ] Excel total sale = Cash + Online + Card + Cheque
- [ ] Excel vs Lasersoft gap explained by named manual invoices only
- [ ] Cash Out (calculated) = handwritten sheet bottom-line total
- [ ] Cash in Hand (calculated) = handwritten sheet "cash in hand" figure
- [ ] `staff_payments_total` NOT in `cash_out_total` or `net_profit`
