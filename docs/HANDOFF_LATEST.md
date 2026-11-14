# HANDOFF 14 Nov 14:10 (chat to chat). Read AJ_NEEDS.md first.
## Pushed to branch work (all UNVERIFIED on AJ's PC)
- Stock & items: columns In stock, Cost, Selling, Supplier (pick+save), Category, Margin; no late style injection.
- Price recovery: scripts/recover_selling_prices.js --suggest (Maheshan label estimate, others by cost band). Bridge TASK 225 PLAYED.
- Calm motion (motion.css CALM layer): no endless loops, no blur, no per-row animation; Stock page gets none.
- Home: play button "Run day close" + activity log (public/home-play.js, read-only).
- One font from first paint: public/rbh-font.css + rbh-early.js in 60 pages; Inter removed; fit-window at first paint. SW v98-a. Build 14 Nov 14:20.
## Open
- PC: AJ types "check bridge" (go 221, 225, CLAUDE line), then Ctrl+F5 twice; report if letters still change.
- 43 empty frames each get 5 injected files at start (speed). Needs AJ approve.
- 8 CSS files with 20-40 !important each (grn-compact, pos-look, pos-onepage, compact-all) fight; merge one screen at a time.
- Gemini signboard pictures awaited; compare with ours (/tmp/sb2 set, sent to AJ).
- Task 222 checks, Task 223 (global CLAUDE.md line, HELD), GRN "tab on top", Face ID, WhatsApp receipt image, dummy bill OFF-86BG-3, 120 non-digit item codes.
## Rig
pg_ctlcluster 16 main start; pkill -f "node server.js"; bash scripts/dev/cloud_rig.sh; curl localhost:3199/health. Tests in /tmp/t (may be gone).
