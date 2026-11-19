# UX CHECKLIST FOR ROYAL BATH HUB (filtered from AJ's 200-point UX file, 22 Oct 2026)
Original file: Project docs claude/UX_SKILL_ORIGINAL.md (it also holds the Noor prayer-app points 91 to 120, kept for the Noor repo).
Rules for every screen: .claude/skills/rbh-ux/SKILL.md. This file = what to build next. Status marks come from the handoff notes and may be out of date; check the app before building.

## 1. ALREADY BUILT (do not redo; check, fix only)
Barcode/QR stickers, GRN with vendor bill, cheque register and alerts, WhatsApp receipt send, daily/weekly/monthly reports, vendor screen, CSV downloads, backup 02:00, watchdog, owner login, command-centre dashboard, item codes 001-098, price rules, Layla owner chat with waiting messages.

## 2. BUILD NEXT (high value, free, small). Number in brackets = point in AJ's original file
1. Customer return and exchange linked to the original bill, stock goes back (34). Today only "void" exists.
2. Cash in, cash out and leftover (X/Z report) so the drawer balances at closing (54, 55).
3. Hold and recall bills so two customers can be served at once (checklist item 3, 59).
4. Low-stock warning and "this will go negative" warning at the POS (57, 180).
5. Split payment: cash, bank transfer, cheque, customer credit in one bill (checklist 2).
6. Double-tap protection: a bill saved twice is still one bill (176).
7. Price override and big discounts need AJ's PIN, with a maximum discount per item type (37, 38).
8. Quick cash buttons in rupees (500, 1,000, 2,000, 5,000, exact) and the change in large text (31, 32).
9. Invoice search by number, phone or date (33).
10. Salesperson on each bill, feeding month-end commission (40, 89).
11. Customer credit ledger with overdue flag and a WhatsApp reminder draft (69, 71).
12. Stock adjustment for damage, loss and counting mistakes, with a photo (65).
13. Audit log for price changes, voids, stock edits: who and when (84).
14. Auto-lock the counter screen after idle, PIN to unlock (152).
15. Unsaved-changes guard and auto-saved cart (59, 187).
16. Online/Offline badge, then save-offline for the POS cart (133, 96, 124).
17. Friendly error screen instead of a blank page (192).
18. One POS instead of "POS" plus "POS plus daily" (AJ asked 22 Oct).
19. Quote to bill in one tap, expiry date on the quote (45, checklist 7). Quote PDF is built but UNVERIFIED.
20. Receipt print preview that matches the paper width (198). Needs AJ's printer paper size first.

## 3. LATER (useful, bigger)
Serial or warranty tracking for taps and commodes (46), product variants by colour and size (68), landed cost for imports (66), reorder points and ready-made vendor orders (62), bank slip matching (73, built UNVERIFIED), loyalty points (42), delivery status tags (50), tile area calculator in square feet (the original asks for fractional units).

## 4. SKIP FOR NOW (not needed for one shop, or costs money or risk)
Multi-warehouse transfers, multi-register sync, multi-currency, PCI card terminal work, hardware MAC locking, GDPR export tool, double-entry accounting rebuild, AR or VR gimmicks, paid SMS gateways. Revisit only if a second branch opens.

## 5. FIFTY FREE TIME-SAVERS (AJ asked for 50 to 100; ordered by group)
Daily shop
1. Scan a sticker with the iPhone camera to add the item to a bill (free browser scanner, no hardware).
2. "Repeat last bill" for contractors who buy the same set.
3. Favourites grid on the POS: the 12 best sellers, automatic.
4. Price check screen: scan a sticker, see the price, nothing else.
5. Reserve with deposit: hold an item for N days and show it as reserved.
6. Quick expense button with a photo of the receipt.
7. Opening and closing checklist the app ticks (cash float, stickers, lights).
8. Customer notes on the contact: project type, tile size, budget.
9. Delivery list for the day with address and a tap-to-call button.
10. "Who owes us" screen on the home page, one tap to a reminder draft.

Money
11. Daily set-aside buckets (cheques, rent, salary, commission) shown after every day close.
12. Week-strip calendar of cheques due, with the cash to keep aside.
13. Payment planner for vendor cheques (built in the cloud, not yet run live).
14. Cost history per item; flag when a vendor raises a cost by more than 5 percent.
15. Margin guard: warn when a selling price is under the floor margin.
16. Slow-stock list (no sale in 60 days) with a suggested price drop.
17. Vendor statement check: our payable against their bill, to catch cases like the Rs 400 difference.
18. Month-end profit split sheet for the partner and commission.
19. Yearly business Zakat helper on stock and cash, as a reminder (halal reminder, AJ decides).
20. "Money in the shop today" card: cash, bank, cheques, owed to us, owed by us.

Stock
21. Count 20 items a day by scanning stickers (rolling stock count).
22. Low-stock list grouped by vendor, with a ready WhatsApp order text (Metro, Fazaal, Maheshan).
23. Not-yet-delivered tracker (like the 2 sinks still owed) with a vendor reminder.
24. Free-item and bonus-item entry (the handwritten "Free ..." tags on vendor papers).
25. Shelf or location field per item so staff find things fast.
26. Reorder suggestions from how fast each item sells.
27. Reprint one sticker without reprinting the sheet.
28. Duplicate-item guard: same name with a different code.
29. One photo per item (cut-out later) for the website and the app.
30. Damaged-goods list with the vendor credit-note status.

Customers and WhatsApp
31. Layla on the website chat, same brain as WhatsApp.
32. Layla quote builder: customer lists items, Layla makes the quote PDF for AJ to approve.
33. Follow-up drafts two days after a quote, for AJ to approve (never auto-sent).
34. Review request draft after a paid bill.
35. WhatsApp Business labels: New, Quote, Paid, Delivered (free, built in).
36. WhatsApp Business catalogue with the top 30 items and photos (free, AJ decides prices shown).
37. Away message outside opening hours, once AJ confirms the real hours.
38. Sinhala and Tamil reply pack, checked by a native reader before use.
39. Instant "one moment" and typing sign (done). Next: a short "we reply shortly" greeting with a picture, once AJ sends the photo.
40. Google Business Profile post templates (on hold by AJ).

App, speed and cost
41. Add the app to the iPhone home screen (PWA) so it opens like an app.
42. Last backup result and last health check as one line in the 06:00 message.
43. One 06:00 message (Rule 11): cash due, cheques due, low stock, Layla customer texts.
44. Staff login with PIN; staff never see cost or profit.
45. Dark mode for evening use.
46. Big-number counter mode for the till screen.
47. CSV download on every list.
48. A4 price list print style.
49. Weekly "what to fix" line built from the error log.
50. Free-model fallback list for Layla: if one free AI model disappears, the next is tried automatically.

## 6. HOW TO USE THIS FILE
Pick by AJ's word "go N". Chat writes the code in the cloud and tests it; the PC only merges and restarts. One module per item, tested alone.
