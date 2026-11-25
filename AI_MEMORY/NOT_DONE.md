# NOT DONE register (AJ's hard rule, 12 Nov 09:17): nothing here is skipped or dropped until AJ taps Disregard. Each item: Approve / Wait / Disregard.
| # | Item | Status | Needs |
|---|---|---|---|
| N20 | 13 Nov leftovers: Name/Category gap on old Stock view (unverified) | OPEN | chat checks on PC screenshot |
| N21 | 13 Nov leftovers: GRN 15 lines + 'GRN tab on top' (wording unclear) | OPEN | AJ sends one picture of what he wants |
| N22 | 13 Nov leftovers: black menu tab, Face ID, WhatsApp receipt image, dummy bill OFF-86BG-3 | OPEN | chat re-checks one by one |
| N23 | 13 Nov: renumber items 001-onward (tasks 220, 221) | PLAYED, waiting for PC | PC check bridge |
| N1 | Task 197: install Context7 (claude mcp add refused by PC permission guard) | DONE 12 Nov (already registered; INSTALLED line added) | AJ allows 'claude mcp add' on the PC, then 'run 197' |
| N2 | Task 199: Pocket deploy (Cloudflare login tap + backup first) | DONE 12 Nov (task 202, worker rbh-pocket) | AJ at the PC: 'run 199', tap Allow |
| N3 | Phone link: apex-tunnel not running in pm2, no tunnel config found | OPEN | chat builds tunnel task or Pocket (N2) replaces it |
| N4 | Gemini full designs as real screens beyond Home (POS, GRN, others use own look) | OPEN | AJ says which screen next |
| N5 | POS preview (/pos-preview.html) real build | OPEN | AJ says OK |
| N6 | Install more of the 40 repos (scan first done for 8) | OPEN | AJ picks |
| N7 | Real-number check of Home, Vendor 360 voucher send, WhatsApp send | UNVERIFIED | AJ opens and says what he sees |
| N8 | Voucher button on GRN screen | OPEN | chat builds |
- 12 Nov 12:20 | N9 Pocket task 202 waits on PC (check bridge) | N10 Accounting screen Debit|Credit ledger (not built) | N11 tunnel restart (PC has none; Pocket may replace) | N12 screenshots of all 12 Nov screens on real data UNVERIFIED | N13 Gemini full animation code (needs Gemini paste)
- 12 Nov 14:45 | AJ approved: Home=Jarvis HUD (done, UNVERIFIED on real data). N9 Pocket, N11 tunnel, N12 real-number check, N1 Context7 all folded into bridge task 203 (waits on PC: check bridge). N10 Accounting ledger, N13 Gemini animation code still OPEN

- task 209 step 5 (Pocket deploy) held 2026-11-12: script resets passcode/secrets; needs chat fix.
| N24 | 16 Nov: close code gap 136+ to 059+ (scripts/close_code_gap.js, tested on copy) | PLAYED, waiting for PC | PC check bridge |
| N25 | 16 Nov: POS-first loading (pos-frame preloads at start, Home shows by 0.8s, SW v98-r). Needs one look on PC | PLAYED, waiting for PC | AJ reloads /owner once |
| N26 | 16 Nov: soap dish to 032, black soap and after shift up (scripts/place_soap_dish.js, tested both ways) | PLAYED, waiting for PC | PC run, then AJ checks 032 and 058-064 |
| N27 | 16 Nov: Leo Marketing second vendor, 065-101 (scripts/move_leo_second.js, tested). Heads-up: 163-324 have no GRN, some look like duplicates (322-324 = mirrors 068-070) | PLAYED, waiting for PC | PC run; AJ decides on 163-324 |
| N28 | 16 Nov: vendor codes from AJ papers: Leo 065-103, Fazal 104-143 + 153-157 (144-152 empty), Cool Lanka 158-170, Maheshan 171-208 (PR7554 not delivered, 189 reserved), Afham/Imran parked, Leo returns in corner; 28 selling prices from papers; 9 prices unclear (181,182,183,186,196,204-207); 4 free units to add by GRN (scripts/set_vendor_codes.js, tested) | PLAYED, waiting for PC | PC run; AJ confirms 9 prices and sends Afham/Imran codes 

N29: vendor codes 001-211 ready (Imran door 209 sell 10,500; Afham fan lights 210-211, no price). Waiting: PC run set_vendor_codes.js. Heads-up: 9 unclear prices (181,182,183,186,196,204,205,206,207); GRN entries for 065, 071, 072; 4 free units; 'colleague missed GRN items' to the last codes [Approve] [Wait] [Disregard]
W1: WAITING (AJ fixes on the PC): 4 free units (PR7531-R, CR7533-R, CR7533-L, PR7544-L at cost 0) and 9 unclear selling prices (181,182,183,186,196,204,205,206,207).
W2: first bill (mirror, 9,650 less 3,150 = 6,500 cash) re-entered backdated 29/10/2026 by scripts/rebill_first_bill.js (date is a safe default, change with --date).

## Held for after the weekly reset (Thu 26 Nov night / Fri 27 morning), AJ 25 Nov
- Warn, do not block: every money screen (not only Record Payment) must show a pop-up for small over/under amounts and let it through (e.g. vendor ledger "over_owed", cheque amounts, POS).
- Page switching: clicking POS / GRN / Cheques must open that page directly; today Cheques shows a blank page and a login page that auto-logs in. Make all pages feel like one app.
- MERGE PAGES (AJ 25 Nov, plan first, build only on his yes): ONE page per party, like GRN.
  Vendor 360 = everything vendor: bills, record payment (cheque / cash / online), generate + send statement, edit, delete (archive), returns.
  Banking & Money = cheques, online transfers, cash in one page. Customers = one page; POS / Sales = one page.
  Merge duplicate pages, show less detail by default, details on tap. Remove the old separate pay / statement pages from the menu.
