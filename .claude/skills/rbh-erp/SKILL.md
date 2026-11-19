---
name: rbh-erp
description: Use for any stock, GRN, vendor bill, cheque, payable, import, reorder, margin, audit log, backup or database change in the Royal Bath Hub app.
---

# Royal Bath Hub stock and accounts rules (from AJ's UX file and Gemini list, trimmed to one shop)

## Stock
- Every stock change has a reason (sale, GRN, return, damage, loss, count fix) and a time. Adjustments for damage or loss may carry a photo.
- Low stock goes into the single 06:00 message (Rule 11), grouped by vendor, with a ready WhatsApp order text as a DRAFT.
- Item codes are in the order of the supplier bill. Next new item is 099. A duplicate-name guard checks before a new code is made.
- Serial or batch tracking only for items AJ names. Single shop: no multi-warehouse work.

## GRN and vendors
- Check the vendor invoice total against the lines before saving (the Rs 400 case). Keep lines not yet supplied as pending, with a vendor reminder.
- Discounts, free items and credit terms are stored on the GRN. The vendor payable stays on the books until the cheque actually clears.
- Vendor credit price must equal the cash price (no extra for delay, no riba). A payment plan only writes cheques that the account can cover.
- Cost history per item. Flag when a cost rises more than 5 percent. Margin is judged on the selling price and includes freight when known.

## Imports and data safety
- Bulk import: preview first, error rows listed in a file, all-or-nothing, a backup before the load, no doubles (the import_papers pattern).
- Database changes are additive: CREATE TABLE IF NOT EXISTS, add columns, never drop or rename live columns. Back up first. Rehearse on the test copy.
- Audit log for price changes, voids, stock edits and settings: who, when, old value, new value.
- Roles: staff never see cost or profit. The owner role is the only one that sees margins.

## Reports
- Every list can download as CSV. Numbers on a report must tie to the screen (same query). Weekly and monthly profit are estimates until all costs are in; say so on the report.

## Check before "done"
Run on the cloud test copy: GRN adds stock and a vendor bill, a sale deducts stock, a void restores it, the payable stays after a cheque is written. Anything not run is UNVERIFIED.
