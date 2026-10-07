---
title: Supplier cleanup dry-run (FINAL_BUILD_2.md Task 4 item 15)
purpose: Classify every row in `suppliers` as KEEP / MERGE / UNKNOWN / CHECK. No deletes or merges have been made - this is a proposal only, waiting on your per-item OK.
generated: 2026-07-05
total_suppliers: 24
---

# KEEP (13) — real payment history, distinct identity, no action needed

| Supplier | Category | Total Paid | Last Payment |
|---|---|---|---|
| A1 MOTAR | Tile Adhesive/Mortar | 125,900 | 2026-05-05 |
| ADHIL F.R | General | 1,000,000 | 2026-06-05 |
| ALI BROTHERS | General | 1,292,000 | 2026-05-27 |
| **AZMI** | General | 5,710,000 | 2026-05-30 |
| CERAMIC STUDIO | Tiles | 598,700 | 2026-06-04 |
| ESKEMA CERAMIC | Tiles | 3,500,000 | 2026-06-05 |
| F.R MARKETING | General | 2,461,400 | 2026-06-05 |
| FAZAL HARDWARE | Hardware | 2,429,980 | 2026-05-28 |
| GREAT LANKA IMPEX | General | 262,500 | 2026-06-03 |
| LEO MARKETING | General | 1,576,250 | 2026-06-02 |
| LOLC FINANCE | Finance/Lease | 200,000 | 2026-05-30 |
| TRURFEX MOTAR | Tile Adhesive/Mortar | 210,800 | 2026-05-28 |
| VOOS | Logistics | 20,000 | 2026-05-13 |

**AZMI is explicitly KEEP per your instruction — a personal payable, never
merge with anything (including NADIR AZMI below).**

A1 MOTAR and TRURFEX MOTAR both being "Tile Adhesive/Mortar" isn't treated
as a merge signal here — different brand names in the same category is
normal (same pattern as KOHLER vs ROCA both being Sanitary brands).

# MERGE? — candidate, needs your OK before anything is touched

| Supplier A | Supplier B | Why flagged |
|---|---|---|
| MACKTILE | MACKSONS TILES LANKA | Both "Tiles" category, both share the "Mack" name root. Could be the same company under two names (short vs full), or genuinely two separate suppliers. Total paid: MACKTILE 2,441,680 (last payment 2026-05-06) vs MACKSONS TILES LANKA 1,000,000 (last payment 2026-04-30). |

**Not merged.** If these are the same company, tell me which name/id to
keep as canonical and I'll re-point `grn_records`, `supplier_payments`,
`pur_purchase_orders`, `pur_shipments`, and `pur_supplier_prices` to it
before removing the duplicate row (all four tables have a foreign key to
`suppliers.id`, so this needs to be done as one transaction, not a plain
delete).

# CHECK — needs your input, not confident enough to classify alone

| Item | Detail |
|---|---|
| NADIR AZMI vs AZMI | Just confirming these are two different people/entities — not proposing a merge, since AZMI is explicitly protected. NADIR AZMI: 1,570,000 paid, last payment 2026-05-20. |
| AMERICAN STANDARD, GROHE, IDEAL STANDARD, KOHLER, LANWA, ROCA, ROYAL CERAMICS (7 suppliers) | All real bathroom-fixture/building-material **brand names**, all with **zero payment history** (0 paid, 0 payments recorded), and — unlike all 16 other suppliers — none have the "Added from DALI cheque register" provenance note in `notes`. This pattern suggests these might be product-brand tags that ended up in the `suppliers` table rather than real entities Royal Bath Hub pays. Worth confirming whether these are (a) real suppliers you just haven't logged a payment for yet, or (b) brand/catalog references that should live somewhere else (e.g. a `products.brand` field) instead of the suppliers table. |

# UNKNOWN (0)

None — every supplier has enough context (category, notes, or an
unambiguous real-world identity) to explain what it is. Nothing in this
table is a mystery row.

# Bonus fix: the "-1d ago" isn't a bad date — it's a display bug, now fixed

Traced this while classifying the list above. `server.js`'s `/api/suppliers`
route computes `days_since_payment` as
`COALESCE(CURRENT_DATE - MAX(pay_date), -1)` — for any supplier with zero
payments (all 7 brand-name suppliers above, not just American Standard),
`MAX(pay_date)` is NULL, so the COALESCE falls back to a literal **-1**
sentinel meant to signal "no payment on record." The Suppliers page just
displayed that number as-is (`(${s.days_since_payment}d ago)`), so it reads
like a future-dated payment instead of "never paid." No real data is wrong
here — fixed the display only (see this session's final commit): suppliers
with no payment history now show "No payment on record" instead of a
confusing negative day-count.
