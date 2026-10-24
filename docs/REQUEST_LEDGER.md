# REQUEST LEDGER (AJ 24 Oct 2026: asks were being lost). One line per ask. Status: OPEN / DONE (commit) / PARKED (reason).
Honest note: before 24 Oct no ledger existed, so the true number of lost asks is UNKNOWN (AJ estimates thousands over all chats). This file starts the count. Older asks live in AI_MEMORY/OPEN_ITEMS.md and Project docs.

| REQ | Date | Ask (AJ's words, short) | Status |
|---|---|---|---|
| 1 | 23 Oct | Layla replies in Sinhala/English, sends item photos, reads voice | DONE on PC (voice result UNVERIFIED) |
| 2 | 23 Oct | Receipt: auto WhatsApp after each POS bill | DONE code, flags ON 08:46, live bill test OPEN |
| 3 | 23 Oct | WhatsApp bridge survives computer restart | DONE code (guard), install on PC OPEN |
| 4 | 23 Oct | Grouped menu like Lasersoft (File, Banking, Vendors, Money, Profit) | DONE 24 Oct on branch claude/menu-profit-audit (PC merge OPEN) |
| 5 | 23 Oct | Profit daily/weekly/monthly/yearly + formula gross/net | IN PROGRESS |
| 6 | 23 Oct | Audit Machine: bill-chain accuracy, daily check, backup restore test | OPEN |
| 7 | 23 Oct | Find 20 bugs | OPEN (real count reported after audit) |
| 8 | 24 Oct | 20 small improvements in the same build | IN PROGRESS (list in BUILD_LOG) |
| 9 | 24 Oct | 30 more improvements, build and push | OPEN |
| 10 | 24 Oct | Be proactive, big/colour-coded needs-attention, short summary | DONE as skill proposal rbh-reply (AJ must press Save) |
| 11 | 24 Oct | Count of ignored requests | PARKED: no ledger before today; this file is the start |
| 12 | 22 Oct | Real opening hours (Layla fallback hard-codes 9:30 AM) | OPEN: AJ to give |
| 13 | 22 Oct | Website publish | PARKED: only on AJ's word |
| 14 | 22 Oct | App link for phone: Tailscale vs tunnel decision | OPEN: AJ |
| 15 | 22 Oct | Fazaal / Maheshan selling prices, PR7554, Fazaal stickers | OPEN: AJ to give prices |
| 16 | 22 Oct | Sticker scan test before printing all | OPEN: AJ |
| 17 | 22 Oct | Customer return screen (void only today) | OPEN |
| 18 | 22 Oct | Cash in / out / leftover report | OPEN |
| 19 | 22 Oct | Hold / recall bills in POS | OPEN |
| 20 | 22 Oct | Low-stock warning check (77 flagged) | OPEN |
| 21 | 22 Oct | Investor loans entry | OPEN |
| 22 | 22 Oct | One POS instead of POS + POS plus daily | OPEN |
| 23 | 22 Oct | GRN barcode button with code entry and bulk print | OPEN |
| 24 | 23 Oct | Notes (tool) free install | PARKED: needs AJ OK per tool |
| 25 | 23 Oct | Lasersoft screenshots to model screens | OPEN: AJ to send |
| 26 | 24 Oct | Enquiries page rate-limit error (enquiries.js:29) | OPEN |
| 27 | 24 Oct | Duplicate apex-server entries in pm2 | OPEN (PC) |
| 28 | 24 Oct | Oversold item: remember what is owed, pop-up on stock-in, real cost for profit | DONE in cloud (commit 8caee6b); live after Task 124 |
| 29 | 24 Oct | Daily reminders, checks, stock-taking | DONE in cloud: morning checklist in the 06:00 message; live after Task 124 |
| 30 | 24 Oct | Backup restore check, links/bridge check, audit + backup line in the 06:00 message | DONE in cloud; live after Task 127 |
| 31 | 24 Oct | "Needs attention" strip on the dashboard (red first) | DONE in cloud; live after Task 127 |
| 32 | 24 Oct | 20 + 30 improvements | PARTLY: 21 built (12 earlier + 9 today). Not padded with filler. Rest = docs/UX_CHECKLIST.md "go N" |
| 33 | 24 Oct | Weekly commission: 5% of gross profit, Sunday 06:00 message, nothing for sales at/below cost | DONE in cloud (utils/commissionWeekly.js); live after Task 129 |
| 34 | 24 Oct | Make WhatsApp keep its login across restarts | Built (Task 128); proof needs one PC restart |
| 35 | 24 Oct | Cheque planner with weekend and holiday logic, Layla live on customer WhatsApp, staff PIN, reorder list by vendor, UPS | OPEN (next builds) |
