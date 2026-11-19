# CONCERNS (heads-up list for Aj and chat)

## 19 Nov 2026 | RSL invoice 5312 (GRN 35, bill 35, total 314,000)
- 4 sets kept their codes 390-393 and received stock (2,2,2,5). Only the selling price was set (41,500). Costs already matched the invoice.
- 8 new part items 394-401 (Commode / Sink per set). Stock starts at 0 (safe default): the parts are not counted until a real count or a split of a set is recorded. Aj can change this.
- Part names are my wording ("CC Commode L/B Grade B", "CC Sink Beige Grade B", ...). No "?" in any name.
- Vendor codes for RSL items are NOT on file (the GRN rows have none, no scanned invoice on the PC), so the vendor_code field is blank. Fill it from the paper invoice.
- Old values of the 4 set rows saved in backups/rsl_5312_before_*.json. Script: scripts/seed_rsl_5312.js (dry run by default, safe to re-run).

## 19 Nov 2026 | Audit approvals (read-only counts on the real DB)
- #2 duplicate item codes: 0 duplicates found (387 items). Nothing merged, no backup needed.
- #3 cheque lists: vendor_bill_cheques 21 ISSUED = 3,018,561; cheque_register 18 pending = 3,018,561. Total matches, COUNT does not (21 vs 18). Not merged: find the 3 cheques that differ first.
- #24 indexes: pos_bill_items(bill_id) and products(item_code) already exist. No change needed.
- #20 vendor names: only "Metro Enterprises" vs "METRO ENTERPRISES" (same name, case only). Not changed (waiting for approval 2 to pass).
- Items 9, 11, 15, 17, 23, 25: held, because approval 2 did not pass fully.
