# LAYLA FREE PATH: linked-device bridge (no Meta account, no cost)
Branch: BATH-HUB `claude/trusting-dijkstra-lgkkbl` (commit 8a862bd). AJ decision 16 Oct: shop WhatsApp number linked by QR on the fresh PC, owner-only, hard rules waived by AJ. UNVERIFIED on a real phone.

How it works: the shop phone (WhatsApp Business) stays as it is. The PC runs `whatsapp-bridge.js` as a LINKED DEVICE (like WhatsApp Web). When AJ's own number (0777999219) messages the shop number, the bridge hands it to Layla; her reply comes back through the same bridge. Customers are never answered (the bridge's internal-only whitelist drops them).

Risk AJ accepted: this is unofficial. Owner-only use is low risk, but WhatsApp can disconnect the link or, if misused with customers, ban the number. Keep customers off.

## 1. Put this code on the PC app folder (PowerShell)
```
cd "E:\AI Sttuf\BATHCO_TEMPLATE" ; git status --short ; git fetch origin ; git checkout claude/trusting-dijkstra-lgkkbl ; git pull origin claude/trusting-dijkstra-lgkkbl ; npm install
```
If `git status` lists changed files, STOP and send Claude the list (do not continue).

## 2. Add these lines to the app `.env`
Open it: `notepad "E:\AI Sttuf\BATHCO_TEMPLATE\.env"`
```
LAYLA_TRANSPORT=bridge
LAYLA_OWNER_BRIDGE=on
OWNER_WA_NUMBER=0777999219
WHATSAPP_MODE=internal
WHATSAPP_TEST_WHITELIST=94777999219
WHATSAPP_BRIDGE_PORT=3001
```
Leave `LAYLA_OWNER_LIVE` out for now. If Chrome is not at `C:\Program Files\Google\Chrome\Application\chrome.exe`, add `CHROME_PATH=` with its real path.

## 3. Restart the shop app, then start the bridge
```
pm2 restart apex-server ; pm2 start ecosystem.config.js --only whatsapp-bridge ; pm2 save
```
Then open `http://localhost:3001/qr` in the PC browser. A QR code appears.

## 4. Link the shop phone
On the shop phone: WhatsApp Business > three dots > Linked devices > Link a device > scan the QR on the PC screen. The page changes to AUTHENTICATED.

## 5. Test from AJ's own phone (0777999219) to the shop number
- `help` -> Layla lists what she understands.
- `plan 680000 Metro 4 months` -> a 4-cheque plan.
- A photo with caption `GRN` or `cheque` -> a DRAFT, saved only when you reply `ok`.
- A voice note -> she answers if speech-to-text (Whisper) is installed (UNVERIFIED on this PC).

## 6. Optional: messages Layla starts herself (6 am digest)
Add `LAYLA_OWNER_LIVE=true` to `.env`, then `pm2 restart apex-server`. Test line: `node scripts/layla_owner_test.js` sends "Layla test OK" to 0777999219 through the bridge. Chat replies work without this switch.

## If something goes wrong
- Stop the bridge: `pm2 stop whatsapp-bridge`.
- Only the owner can ever get a reply: the bridge whitelist and the owner gate both check.
- Bridge logs BLOCKED for your own number with a long number (a "lid"): copy that long number from `pm2 logs whatsapp-bridge` into `.env` as `WHATSAPP_TEST_WHITELIST_LIDS=thatnumber`, then `pm2 restart whatsapp-bridge`. (Only for YOUR number. Never put a family member's number or long id there: that list is treated as the owner.)

## FAMILY MODE (AJ's wife): reminders and notes only, separate from the shop
- Add ONE line to `.env` (her real number, not in chat, not in git): `FAMILY_WA_NUMBERS=07XXXXXXXX` (several numbers: separate with commas). Then `pm2 restart apex-server ; pm2 restart whatsapp-bridge --update-env`.
- For her reminders to arrive at the time she sets, `.env` must also have `LAYLA_OWNER_LIVE=true` (it also switches on your own 6 am messages).
- She messages the shop number from her own phone. She can: `remind me at 12 to call mum`, `what's pending`, `done 3`, `snooze 3 2 hours`, `note: plumber Rahim 077...`, `notes`, `find plumber`, `delete note 2`. English only.
- She cannot reach anything of the shop: stock, cheques, payables, sales, plans, photos. Her reminders and notes are invisible to you in Layla, and yours to her. Her words are not copied into the shared message log.
- AJ can still read the database on his PC. Tell her before she starts.
- A photo or voice note from her gets "I can read text messages only" and nothing is saved.
- If her messages are ignored and the bridge log says BLOCKED with a long id instead of her number, send Claude the log line (never add it to the owner list).
- Stop family mode: remove the `FAMILY_WA_NUMBERS` line and restart both.
