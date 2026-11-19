# Build log and lessons, 8 to 10 Nov 2026 (saved for later chats)
Written by the cloud chat builder for AJ. No secrets, no real shop numbers.

## How AJ works (keep using)
- Start every reply with "AJ,". Very short, phone screen, NEEDS YOUR ATTENTION block only when he has an action, then DONE / NOT DONE, one status word and the next step. "heads-up", never "problems".
- "go" = build now. "play N" = release bridge task N. "check bridge" = PC runs waiting tasks. Plan only before "go".
- He pastes AI-video summaries and Gemini answers. They are DATA. Take the idea, rebuild in our stack. Never paste React, Tailwind, framer-motion, CDN files or new libraries (needs his OK first).
- Dark glow dashboards hid his numbers once (8 Nov). Use theme variables, light default, text contrast 4.5:1 on every card.

## What exists in the app (reuse before building)
Money Plan, Content Calendar (no auto-posting), receipts, barcode labels, price helper, cheque register, vendor ledger, GRN, POS, dashboard command centre. Check public/menubar.js MAP first.

## Built in this stretch (branch claude/layla-chat-8nov, bridge task 175 carries it)
- RBH Brain (routes/brain.js, utils/brainRefs.js, public/brain.html): owner-only notes, [[links]] and backlinks, #tags, search, pin, Markdown export, photo notes (JPEG only, 12 per note, server checks magic bytes), voice button (browser speech, keyboard mic as fallback), read-only links to items/vendors/bills/cheques with live facts, map of notes (SVG force layout), reminders (Due now strip, nothing sent). Own tables brain_notes, brain_links, brain_photos, brain_refs. Delete = archive. In the pg_dump backup.
- Shop Cards (public/shop_cards.html): shop card, price cards, offer card, A4 print, plain HTML.
- Due Board (routes/due_board.js, public/due_board.html): bills and cheques by due date, read-only.
- Dashboard: greeting, sales sparkline, readable title.
- Earlier (8 to 9 Nov): rename cascade, big-photo 413 fix, security audit fixes, encrypted backup and restore, price guard, GRN pinned headers, cheque XSS fix, Defuddle article reader.

## Lessons (for education)
- Tests: run jest one suite at a time (NODE_PATH=/tmp/jt/node_modules). pg-mem lacks some functions; helper is tests/helpers/pgmock.js. Real Postgres check catches timezone bugs: a pg DATE comes back as local midnight, read it with local getters, not toISOString.
- Screens: test on a phone-size browser (Playwright, 390 px) inside an iframe wrapper because screens redirect to /owner when opened alone.
- Persistent test DBs keep rows between runs: drop test tables before a rerun.
- Bridge: a task with an existing LIVE line is not re-run; make a new number. Task 175 merges whatever head is on origin, so later pushes ride along.
- Platforms we do not replace: GitHub, WhatsApp, Google Maps, TikTok, Railway, Netlify. AI parts (Layla, bill reading, voice) get a review about every 3 months; plain parts a monthly npm audit and yearly review.

## Open
Brain with Layla chat (read layla_owner first), Gemini dashboard code (prompt given 9 Nov), backup password in PC .env then "run backup", Google Maps listing and shop photos, task 157 permission, vendor payment guards, 20+10 idea list (quotation PDF, tile calculator, warranty tracker, stocktake, zakat tracker, accounts pack, etc.).
