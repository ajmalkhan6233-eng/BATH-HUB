# PENDING FROM AJMAL

Tracking list — do NOT block other work on these. Update as Ajmal answers.

| # | Item | Status | Default assumption (if any) |
|---|---|---|---|
| 1 | Daily-wage vs monthly-salary staff list + amounts (13 staff in DB: Imran, Nuzlan, Gimhani, Nilshard, Nimshard, Ali, Ajmal, Jazeel, Ahamed Ali, Ahmed, Zaheem, Akashi, Fahim) | OPEN | — |
| 2 | Exact shop opening hours (for LAYLA night-reply placeholder) | OPEN | "Open daily from 9:30 AM" currently in shop_config.json — closing time unknown |
| 3 | Per-person OT rates | OPEN | — |
| 4 | Zakat hawl date (Ramadan-based or fixed date) | OPEN | — |
| 5 | Credit corrections — DB shows 542,300 (ABC BUILDERS 237,300 of that); Ajmal's figure is 385,380 | OPEN — UNRECONCILED flag stays | — |
| 6 | Do daily-wage staff also get 1% commission? | OPEN | **Assume YES until told otherwise** |
| 7 | Lasersoft cutover date — confirm 2026-04-01 is correct | OPEN | **Inferred 2026-04-01** from data pattern: lasersoft rows 21 Dec 2025–30 Jan 2026 (30 days) all have total_expenses=0 (GP-only, bulk-entered Lasersoft "Profit-by-Sales" report, likely backdated after Lasersoft setup). Lasersoft rows 1–30 Apr 2026 (30 days) all have real expense + net profit breakdown = live daily entry. Feb–Mar gap filled by non-Lasersoft "DALI" sheets (gross_profit=0). Tagged accordingly in new `gp_status` column (see RECONCILIATION_RULES.md §6). |
| 8 | Bath Hub Aromatic removal — confirm OK to strip from shop_config.json + CLAUDE.md (currently feeds layla.js WhatsApp bot too) | OPEN | Build order says remove entirely — will proceed unless Ajmal says keep for LAYLA |
| 9 | Full Lasersoft product/price export (all suppliers/categories) | OPEN | `products` table currently has only 85 items from one supplier (LYCOS/MR.AZMI, snapshot 9 Jun 2026). Need a full "Inventory Valuation Summary" export (all suppliers/categories) to complete the price master — current set is missing e.g. item code 1676. |
| 10 | Daily invoice number range (HSL & SL series, first/last invoice issued each day) | OPEN | Lasersoft daily exports currently give an invoice *count* (e.g. "Invoices=9") but not the actual numbers. Invoice-gap detection (`invoice_seq_start`/`invoice_seq_end` columns + CHECKER check) is built and dormant — needs this data to activate. |
| 11 | 2026-05-13 expense total mismatch — `daily_summary.total_expenses`=53,820 but the itemized `expenses_detail` rows for that date sum to ~99,190 | OPEN | System currently shows the recorded 53,820 (TIER 1 FULL day) — check the original paper and confirm which figure is correct, found during Phase 1 audit (SOURCE_INVENTORY.md) |
| 12 | Re-verify 21 Dec 2025 – 30 Jan 2026 revenue (30 days, currently LKR 17,249,211 from Lasersoft POS) against Ajmal's manual Excel — this is the only revenue slice not sourced from Excel | OPEN | If Excel differs, correct `daily_summary.total_sale`/payment-method columns for those 30 days; would shift the all-time total (144,493,969.97) by the difference, found during Phase 1 audit (SOURCE_INVENTORY.md) |
| 13 | Is "ADHIL F.R" (supplier id18) a real supplier or a personal payment? DB shows 2 cheques to ADHIL F.R totalling 1,000,000 (cheques #760353, #760354, from the Bath Hub cheque register) | OPEN | Kept as active supplier for now — has real payment history, looks like a genuine supplier, but name format ("F.R" initials) flagged for confirmation |
| 14 | Is the "VOOS" entry (supplier id24, category Logistics, 1 cash payment of 20,000 on 13/05/2026, notes "VOOS transport payment") a supplier or should it be reclassified as a transport/van EXPENSE? | OPEN | Currently listed as a supplier with 1 payment — dashboard shows it with an "Inactive" badge (60+ days since its only payment) |
| 15 | GROHE (id5), IDEAL STANDARD (id3), KOHLER (id7) — confirm these should remain as suppliers. All 3 already exist in the DB with category set (Fittings/Sanitary/Sanitary) and 0 balance, ready for data entry — no action needed unless Ajmal wants them removed or details corrected | OPEN | Assumed correct — already present, shown on Suppliers tab with "No payments" badge |
| 16 | AMERICAN STANDARD (supplier id4, category Sanitary) — is this supplier still active? `total_paid`=0, 0 payments on record | OPEN | Currently shown as Active with a "No payments" badge — flag if it should be marked inactive or removed |
| 17 | Credit Customers "Total Outstanding" — live DB total of all non-quarantined unpaid balances is **668,800** (Silva Hardware 135,000 + Perera Construction 75,000 + Silva Plumbing 45,000 + Metro Tiles 50,000 + Zuhail Akam Transport 237,300 + Tharik 126,500). The figure **363,800** (Zuhail + Tharik only) covers just the 2 newest/confirmed invoices. The other 4 entries (Silva Hardware, Perera Construction, Silva Plumbing, Metro Tiles — 305,000 total) are marked "UNVERIFIED - invoice not found in any daily Excel" in the DB | OPEN | Dashboard now shows the live 668,800 total prominently, with a note explaining the 363,800/305,000 split — confirm whether the 4 UNVERIFIED entries are real outstanding credit or should be removed/corrected |

-----

*Created 12 Jun 2026. Items #11-12 added 12 Jun 2026 (Phase 1 Final audit). Items #13-17 added 14 Jun 2026 (TASK 6/8, Suppliers + Credit review).*
