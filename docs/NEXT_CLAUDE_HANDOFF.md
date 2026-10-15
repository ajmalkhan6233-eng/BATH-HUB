# NEXT CLAUDE: RBH LAYLA HANDOFF (16 Oct 2026). Read fully, then do ONLY the queue below, in order.

OWNER: Ajmal Khan ("AJ"). Phone only, voice-to-text (read charitably, ask ONE short question only if truly unclear). Plain words. Call him AJ.
FORMAT: HEADS-UP first (never the word "problems"), then DONE / NOT DONE one line each, exact pastes in their own code block, ONE status word last (GREEN/DONE/BLOCKED/NEEDS YOU/UNVERIFIED) + next step. One phone screen. Never say "done" unless a check ran; otherwise UNVERIFIED. Build only after AJ says "go".

## DO NOT WANDER (hard)
- Work and push ONLY on BATH-HUB branch `claude/trusting-dijkstra-lgkkbl`. No merge. No push to `work` or `main`. The First Choice repo (`BATHCO`) is READ-ONLY, never edit it.
- No secrets in chat or git. Never print a full phone number (last 3 digits only). AJ puts keys and his wife's number into the PC `.env` himself.
- Customers are NEVER answered by Layla (dry run). Do not change the owner default number 0777999219 until AJ confirms. Do not delete the WhatsApp account or unlink the device. Do not touch pm2 process `premium-imports-s...` (unknown, not ours) or any BATHCO bridge.
- No new features, refactors or "improvements" that AJ did not ask for. No Sinhala/Tamil text AJ cannot check.
- Fake data only in the live app: names start `TEST-`, fake phone 0700000000. Take a backup before any bulk testing.

## WHERE THINGS ARE
- PC app: `E:\AI Sttuf\BATHCO_TEMPLATE` (checked out on the branch above). pm2: `apex-server` (id 1, port 3100), `whatsapp-bridge` (id 2, port 3001, SHOP number linked as a linked device by QR). pm2 restart can fail on Windows ("pid already exists"): use `pm2 stop apex-server ; Start-Sleep 6 ; pm2 start apex-server --update-env`.
- `.env` names AJ should have (values never shown): LAYLA_TRANSPORT=bridge, LAYLA_OWNER_BRIDGE=on, OWNER_WA_NUMBER, WHATSAPP_MODE=internal, WHATSAPP_TEST_WHITELIST (owner, digits with 94), WHATSAPP_BRIDGE_PORT=3001, MAIN_SERVER_URL=http://localhost:3100 (check it exists), FAMILY_WA_NUMBERS (not yet set), LAYLA_OWNER_LIVE (only needed for Layla-started messages like the 6 am digest and the wife's reminders). Check names only: `Get-Content .env | Where-Object { $_ -match '^(LAYLA_|WHATSAPP_|OWNER_|FAMILY_|MAIN_)' } | ForEach-Object { ($_ -split '=')[0] }`
- Code: `layla_owner/` (settings, bridgeIn, bridgeSend, safeSend, inbound, brain, planCommands, planHandler, familyBrain, familyStore, customerDryRun, webhookGate), `utils/payment_planner.js`, `routes/payment_planner.js`, `whatsapp-bridge.js`, `server.js` (route `/webhook/layla-owner`). Guides: `docs/LAYLA_FREE_BRIDGE.md`, `docs/LAYLA_PATH_A_SETUP.md` (Meta path, NOT used), bridge repo `Universal-project-` `AI_BRIDGE/` (read-only unless AJ allows a push).
- Tests (all mocked, 101 pass in the cloud): `npx jest tests/unit/layla_one_layla.test.js tests/unit/layla_family.test.js tests/unit/layla_free_bridge.test.js tests/unit/layla_customer_dryrun.test.js tests/unit/layla_settings.test.js tests/unit/layla_send_and_selftest.test.js tests/unit/layla_webhook_gate.test.js tests/unit/plan_commands.test.js tests/unit/payment_planner.test.js tests/unit/time_oclock.test.js tests/ownerGate.test.js tests/intentParser.test.js`. `tests/inbound.test.js` needs `npm ci` (pg-mem) and was only ever run on the PC.

## STATE
- VERIFIED on AJ's real phone: shop number linked (bridge online, whitelist shows owner); owner messages `help` and `plan 680000 Metro 4 months` get correct Layla replies; shop app health OK.
- BUILT, tests pass, NOT yet verified on the PC: one-Layla fallback (commit 08022ec): owner text the assistant does not understand, `TEACH: <fact>`, and uncaptioned photos go on to the ORIGINAL Layla (`layla.js`); family mode for AJ's wife (15475e2): reminders + notes only, no shop data, own number, English only, text only; "at 12" / "o'clock" times; `move cheque 2 to 20th` = 20th of that cheque's month, refuses past the vendor date (c118422); startup crash fix (22df0bc).
- Test data left in the live DB: a "Metro" test plan = 4 reminders (first fires 10 Nov 6 am). Clean with `what's pending` then `done <id>` for each.
- AJ's pending answer: block format for wife's messages. Paste options: `BLOCKS FOR HER ONLY. ADD VOICE WITH CONFIRM.` or `BLOCKS FOR HER, PLUS A DAILY LIST OF HER REMINDERS TO ME. SHE IS TOLD. ADD VOICE WITH CONFIRM.`

## QUEUE (each task: do, check, commit, push; stop at any failure and report the exact error)
1. PC pull + restart + health. Give AJ one PowerShell block:
   `cd "E:\AI Sttuf\BATHCO_TEMPLATE" ; git pull origin claude/trusting-dijkstra-lgkkbl ; pm2 stop apex-server ; Start-Sleep 6 ; pm2 start apex-server --update-env ; pm2 restart whatsapp-bridge --update-env ; Start-Sleep 25 ; Invoke-RestMethod http://localhost:3100/health ; pm2 list`
   Pass = health OK, both processes online, restart counter not rising.
2. AJ tests from his own phone to the shop number, one at a time: `hi, what time do you open?` (original Layla answers), `TEACH: Royal Bath Hub opens at 9 am` (answers "I'll remember"), a photo with no caption, a photo captioned `GRN`. If any reply is wrong or missing: `pm2 logs whatsapp-bridge --lines 15 --nostream` and `pm2 logs apex-server --lines 25 --nostream`, fix in the cloud branch, push, repeat task 1.
3. Family mode (only when AJ confirms his wife agreed): AJ adds `FAMILY_WA_NUMBERS=<her number>` and `LAYLA_OWNER_LIVE=true` to `.env` by hand; restart both (task 1 command); wife sends `help`, `remind me at 12 to call mum`, `note: plumber Rahim 077...`, `notes`; confirm the reminder arrives at 12:00 on her phone and never appears in AJ's `what's pending`. Check `OWNER_READ_ONLY`: if AJ cannot edit data in the web app as "owner", ask before changing it.
4. Only after AJ says GO and answers the block-format question: build voice notes for family with a confirm step ("I heard: ... Reply YES to save"), plus the agreed block format. First check Whisper exists on the PC: `where whisper` or the command `layla_owner/transcribe.js` uses.
5. Housekeeping, ask AJ first: `pm2 save`; Metro test reminders cleanup; change the plain-text passwords listed in the old First Choice repo `HANDOVER.md` (AJ's action, never repeat them); a 3-line report in `AI_BRIDGE/LIVE.md` (a push there was blocked earlier; needs AJ's permission); later, "erase everything and give me a fresh app" before shop opening = backup first, then plan, then AJ's explicit go.
6. AJ's own actions (remind, do not do): domain (.com costs money; free option `royalbathhub.netlify.app` via his Netlify login), Gmail for the shop, Facebook/Instagram pages, sticker size, scan-test a barcode sticker, view the visiting card in `public/print/`.

## KNOWN TRAPS
- Bridge replies "Layla is not reachable" = the shop app is down or `MAIN_SERVER_URL` wrong.
- Bridge `whitelist: +` empty = `.env` lines not saved.
- A family member's WhatsApp "long id" must NEVER go into `WHATSAPP_TEST_WHITELIST_LIDS` (that list means owner).
- WhatsApp Business app on the shop phone stays untouched; Layla is only a linked device. Unofficial method: ban risk accepted by AJ for owner-only use.
