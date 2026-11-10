# ROYAL BATH HUB: HOW THE APP IS BUILT (10 Nov 2026) - for an ADVISOR. Do not write a new app.
Shop: Royal Bath Hub, Kandy Road, Thihariya, Sri Lanka (tiles + bathroom fittings). Owner AJ: not a developer, voice-to-text, iPhone + Windows PC, wants few clicks. Halal rules: no interest, honest pricing.
Roles: Claude chat writes and tests ALL code in the cloud and pushes a branch. Claude Code on the shop PC only pulls, runs the named script, merges, restarts, reports. Gemini = advice and research only.

## STACK (fixed)
- Backend: Node 26 + Express 5. Many route files in routes/ (one per feature), helpers in utils/, tests in tests/ (jest). No ORM: hand-written parameterised SQL.
- Database: PostgreSQL, one shared pool. Money is NUMERIC. Tables made additively (CREATE TABLE / ADD COLUMN IF NOT EXISTS) when a route loads. Never drop or rename.
- Frontend: NO framework. Plain HTML + vanilla JS + CSS in public/. Owner shell public/bathco_complete.html (menu, iframes for screens, hash routes). Themes: gold (black/ash/gold), water, light. Phone first (390 px).
- PWA: manifest + service worker (cache version v93): static files cached; API reads network-first with last-good copy; writes never cached. Offline queue in IndexedDB with Idempotency-Key so retries never double-save.
- Hosting: shop Windows PC, pm2 process `apex-server`, port 3100, health /health and /health/deep. Public website is a separate repo on Netlify (not part of this).
- Auth: express-session in Postgres, bcrypt, optional TOTP; roles admin/owner/staff; helmet and rate limits.
- No Redis, no queue library, no Docker. New libraries or paid services only with owner's OK.

## WHAT EXISTS (business modules)
- POS: bills, split payments (cash/card/transfer/cheque/credit), customers and credit, quotations, returns, void and edit with stock restored per bill (stock_deducted flag), discount cap per role with owner override, price guard (never below cost; big line with no item code needs owner), till summary by real payment parts, cost saved on each bill line so profit does not move, receipts with shop number 074 035 5536, stickers and price/offer/shop cards.
- Items and stock: products (item_code, stock_level, avg_cost, selling_price), item detail with photo, prices screen.
- Purchasing: GRN workbench (photo read of a vendor bill -> draft -> review -> Save commits in one transaction), smart item matcher (green/amber/new, remembers picks per vendor), vendor ledger (bills, payments with row lock + over-owed + duplicate guard, cheques, credit notes), two parallel vendor systems (by name vs suppliers.id; no running statement yet).
- Cheques: register (owner-only writes, duplicate cheque number refused, cancelled status), Due Board (bills + cheques overdue / next days).
- Money plan and daily entry: daily sheet with counted cash, expenses, payouts, set-asides.
- Owner tools: dashboard (cards, sparklines), RBH Brain (owner-only notes with [[links]], tags, photos, reminders), Layla owner assistant on WhatsApp (reads paper photos, makes bills/GRNs/cheques through the same routes).
- Self-checking: audit invariants (money and stock agree), daily self-run (from 05:00 Sri Lanka: audit + due line + yesterday's cash match, queued for the ONE 06:00 message; missed-day recovery; owner status at /api/selfrun), backups (encrypted, rotated) and restore-test script.
- Rules: one WhatsApp alert a day at 06:00 (utils/notify.js). Chat builds, PC runs. Real shop data is never touched by tests (copies only). Sinhala/Tamil text is never invented.

## KNOWN GAPS (honest)
No single vendor master table; no per-vendor running statement; no global search or hotkeys; most forms have no draft after a refresh; server.js still holds some inline routes; large single-file pages; reorder list needs minimum levels per item; WhatsApp template approval status unknown; thermal printer / scanner / cash drawer / staff PIN not decided.

## RULES FOR ANY ADVICE
Cheapest and shortest route; plain script beats AI; AI never the source of truth for numbers; every money write in a transaction; additive database changes only; cite a dated source URL for every price or law; write UNSURE when unsure.
