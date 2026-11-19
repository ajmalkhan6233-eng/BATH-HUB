# AUDIT PACK: Royal Bath Hub (for the Fable audit, 3 phases)
Owner: AJ. Not a developer. Halal, honest, privacy-first. Never print .env, data\, bank numbers. Work on branch `work`/`claude/*` only. Never push main.

## HOW AJ RUNS IT (copy each line, one at a time)
PHASE 1 AUDIT (model Fable 5.2, READ ONLY, no edits)
1. Open Claude Code in the app folder. Type: /model   then pick Fable 5.2.
2. Type: /usage   (stop and tell AJ if weekly is over 40%).
3. Paste: Read docs/AUDIT_PACK.md and do PHASE 1 only. Write the report to docs/AUDIT_REPORT_FABLE.md, push it, then tell me to switch to Opus.
PHASE 2 FIX HARD ITEMS (model Opus)
4. Type: /model   then pick Opus.   Paste: Read docs/AUDIT_REPORT_FABLE.md and do every item tagged HARD, one per commit, test each. Then tell me to switch to Sonnet.
PHASE 3 FIX THE REST (model Sonnet 5.5)
5. Type: /model   then pick Sonnet 5.5.   Paste: Do every item tagged EASY in docs/AUDIT_REPORT_FABLE.md, one per commit. Then write the final report.
(Claude cannot change its own model. AJ taps /model. Each phase ends by asking him to.)

## PHASE 1 RULES (Fable)
- READ ONLY. Test only on the cloud copy (bash scripts/dev/cloud_rig.sh), never real data. Do not fix anything.
- Output ONE file, docs/AUDIT_REPORT_FABLE.md. Each finding = one line: `#n | severity (RED/AMBER/GREEN) | file:line | what is wrong | proof | fix size (EASY/HARD)`. Rank RED first. Max 60 findings. Plain words, no jargon.
- End with: top 5 to do first, and the exact words "SWITCH TO OPUS".

## WHAT TO AUDIT (AJ's list)
A. NUMBERS MATCH. Same figure must agree on every screen: stock value, sales today, profit, vendor owed, cheques, GRN totals, customer credit. Compare Home, Profit, Reports, Pocket snapshot (utils/pocketSnapshot.js), POS and the database. List every place two screens give two answers.
B. STOCK GOES MINUS. Trace one sale through POS to stock (POS_DEDUCT_STOCK, voids, returns, GRN, oversell, back-dated bills). When can stock go below 0? Does one sale make other numbers go minus (stock value, cost, profit)? What does the app do and what should it do?
C. ZERO-PROFIT AND LOW-PRICE SALES. AJ sells 20 to 50% under the marked price, sometimes at cost or below. Trace how profit is worked out for: cost = bill-line unit_cost vs item avg_cost vs no cost, discount at bill level, price guard (findBadPrice), zero price, items with no cost (shows profit too high). Is the formula in utils/profit.js used the same everywhere?
D. SCREENS NOT SYNCING. PC screen vs phone (Pocket) vs POS vs Home: old cached files (service-worker.js VERSION, pocket/sw.js), home vs home_solid, build-stamp, two copies of one screen, polling vs live refresh, Pocket snapshot lag (utils/pocketSnapshot.js, utils/pocketInbox.js).
E. CODE FIGHTING. Two scripts changing the same thing: duplicate routes, scripts loaded twice, old and new screens both on, overlapping timers, db changes made at startup, two writers on one table, race conditions on bill number, stock, cheque status.
F. MONEY RULES. Vendor bills, cheques (ISSUED/CLEARED/BOUNCED), no assumed due dates, GRN reason when bill and paid differ, vendor returns with item lines, double-loaded invoices (same invoice no.), duplicate vendor names. No interest anywhere (halal).
G. SECURITY AND PRIVACY. Login gate (server.js), the Pocket allow-list gate, secrets in git, public repo vs private data, tunnel exposure, backups (encrypted copy), webhook auth.
H. SPEED AND WEIGHT. Slow queries (missing indexes, N+1), big screens (public/bathco_complete.html), startup time, memory, images, offline cache size, phone data use.
I. EASE OF USE. One-screen rule, phone widths, voice-friendly forms, errors in plain words, no dead buttons, Sinhala/Tamil text, receipts.
J. RELIABILITY. What happens on power cut, PC off, network down, restart, db connection drop (old ECONNRESET), backup restore test, WhatsApp bridge reconnect.

## LEAVE ALONE
C:\BATHCO_PHASE1, Railway, BIOS, Postgres settings, real data, .env. No deleting. No new paid tools. No new libraries without AJ's OK (list them as a question instead).

## AFTER EACH PHASE
Update AI_MEMORY/LIVE.md (one line), commit, push to the shared branch. Report to AJ: max 5 lines, "AJ," first, one status word last.

## NOOR APP
Same three phases, own chat, own folder. Replace A to C with: prayer times correct, Qibla, Quran text and audio, offline, no tracking or ads, battery, size, Flutter build warnings, Play Store readiness.
