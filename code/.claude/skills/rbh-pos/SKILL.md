---
name: rbh-pos
description: Use for any POS, billing, return, discount, split payment, credit customer, tile unit, day-close, receipt or barcode work in the Royal Bath Hub app.
---

# Royal Bath Hub POS rules (from AJ's UX file and Gemini list, trimmed to this shop)
Also read rbh-ux for screen rules. Checklist of what is not built yet: docs/UX_CHECKLIST.md section 2.

## Money maths
- Whole rupees (or DB numeric), never float sums. Line = quantity x price minus line discount. Order discount after the lines. Round once, at the end. Show Rs with thousands separators.
- Never sell below the margin floor without AJ's PIN. Discount above the item-type maximum needs the PIN. Log who, when, old price, new price.
- No interest and no late charges on customer credit (halal rule).

## Speed at the counter
- Scan or QR first (iPhone camera is free), search second (forgiving: case, spaces, typos). Quantity starts at 1, Enter adds. Big numpad (inputmode numeric). Favourites grid for the 12 best sellers.
- Hold and resume bills with a label. The cart auto-saves on every change. The same bill tapped twice is still one bill (idempotency key).
- Offline: save the draft on the device, send when online, show the Online/Offline badge.

## Payments and credit
- Split payment: cash, bank transfer, cheque (cheque number and date go to the cheque register), customer credit. Parts must add up to the total. Change shown in large text.
- Credit customer: limit, balance, partial settlements, overdue flag. Reminders are DRAFTS for AJ to approve, never auto-sent.

## Returns and voids
- Return links to the original bill, puts stock back, records the refund method. Never allow stock below zero without a warning. Void reverses the whole bill (exists today).

## Tiles and variants
- Tiles: convert square feet to boxes (box size per item), round UP to whole boxes, show both numbers. Variants (colour, size) chosen in one small modal, each with its own item code.

## Day close
- Expected cash = opening float + cash sales - payouts. Counted cash is typed in; the difference shows red. X report midday, Z report at close.

## Hardware (ask AJ ONCE, do not assume)
- Receipt paper width (58 or 80 mm), dot-matrix or thermal, cash drawer: unknown today. Always keep a PDF/A4 fallback. Receipt shows the shop number 074 035 5536 only, never AJ's personal number.

## Check before "done"
Test on the cloud test copy (rbh-qa): a sale deducts stock, a void restores it, a double tap makes one bill, a return restocks. Anything not run is UNVERIFIED.
