---
name: rbh-qa
description: Use when AJ asks to test, audit or QA the shop app or website: crawl pages, click flows, check phone layout, console errors, broken API calls and translation glitches. Test copy only, never the live shop data.
---

# Royal Bath Hub QA crawler (adapted from AJ's Gemini skill, 22 Oct 2026)
Original text kept in Project docs: claude/QA_SKILL_GEMINI_ORIGINAL.md. Read this file (1 minute) before any QA run.

## Hard safety rules (the Gemini original lacked these)
- Clicking flows (add to cart, pay, save GRN, stock edit, void, form tests) CREATE REAL ROWS. Run them ONLY on a test copy: cloud test rig (PORT 3199, db bhtest, LOGIN_DISABLED=true) or a copy of the DB. NEVER on the live app (PC port 3100, pm2 apex-server).
- A read-only look at the live app (open pages, no clicks that save) needs AJ's word, and the owner login is typed by AJ, never by Claude.
- Never send a real WhatsApp message, never publish the website, never start a second WhatsApp bridge.
- Never judge, fix or rewrite Sinhala or Tamil wording (AJ rule: a native reader decides). QA only checks layout and missing text.
- No new global installs (agent-browser is NOT approved). Use Playwright, already available (chromium in /opt/pw-browsers in the cloud; webapp-testing skill on the PC).

## Setup (cloud test rig, needs re-setup in a new sandbox)
Postgres 16 (pg_ctlcluster 16 main start), db bhtest user bh/bh; env DB_HOST DB_PORT DB_NAME DB_USER DB_PASSWORD, SESSION_SECRET, LOGIN_DISABLED=true, POS_DEDUCT_STOCK=true, PORT=3199; deps in /tmp/deps symlinked as node_modules (no whatsapp-web.js). See START_HERE_CHAT in Project docs.

## Run plan (bounded, headless, cheapest first)
1. List pages: public/*.html (about 42) plus menu links. Visit each once. Phone first (390x844), then desktop (1366x768) for POS and admin only.
2. Per page record: console errors, failed requests (4xx or 5xx), sideways scroll (scrollWidth over innerWidth), tap targets under 44 px, images that fail to load, raw text such as undefined, null, [object Object], KEY_MISSING, NaN, Infinity.
3. Language: only on screens with a language switch (bathhub.html, the public website). Switch EN, SI, TA. Check overflow, clipped text, missing glyph boxes, raw keys. Tamil and Sinhala are left-to-right; they need extra line height, not mirrored layout.
4. Flows on the TEST copy: POS sale (item, quantity, pay, save), void restores stock, GRN save creates vendor bill and stock, stock adjustment, price edit. Edge inputs: blank, 0, negative, very long text, 10,000 quantity, special characters '<">&. Expect: friendly message, no 500, no raw HTML shown, no double bill on a double tap.
5. Modals: open each, close with Esc and the X, check nothing stays stuck over the page.

## Save usage
Headless, screenshots only for failures, at most about 60 pages per run, first failure type reported once (not repeated per page), stop after 2 retries.

## Report (one file, phone-readable)
Write docs/qa/QA_AUDIT_REPORT.md (3-line handover first). Top: counts (pages, blockers, glitches, console or API errors). Then a table: page | phone or desktop | language | action | what happened | screenshot path. Then "Likely fix" as plain words and file path only. Rule 13: Claude Code never writes feature fixes; it puts the exact error in LIVE.md and chat writes the fix. End with the 5-line SUMMARY and one status word.
