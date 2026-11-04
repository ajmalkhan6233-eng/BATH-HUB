# GOLDEN CORE — never edit these per client

These files/regions hold the financial logic that makes the numbers correct.
A per-client "small tweak" here corrupts real money reports. DO NOT EDIT:

- server.js — financial regions: daily-summary math (TOTAL_SALE/CASH_OUT expressions near top),
  Excel upload parsing + GP blending (search "gp_blend"), report endpoints (/api/summary,
  /api/reports), reconciliation endpoints. (Cosmetic, clearly-non-financial edits elsewhere
  in server.js are allowed but discouraged — prefer frontend/config changes.)
- routes/purchasing_accounting.js — entire file
- routes/staff_reports.js — entire file
- routes/audit.js — entire file
- scripts/daily_reconciliation_check.js — entire file
- scripts/layla_answer_engine.js — entire file (deterministic money answers for the AI;
  editing it lets the AI state wrong figures)
- Database schema of financial tables: daily_summary, expenses, payments, lasersoft_invoices,
  supplier_*, cheques, staff_salary, staff_loans — never ALTER these.

If a client asks for a change inside golden core: STOP and escalate to the vendor.
