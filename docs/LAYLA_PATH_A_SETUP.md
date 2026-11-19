# Layla owner chat: Path A (Meta Cloud API, SEPARATE number) + relay for incoming

Decided by AJ (15 Oct 2026). Never use the shop number 074 035 5536 for this: Cloud API on it can switch off the WhatsApp Business app and its greeting.
Keys go ONLY in the PC's `.env`. Never in chat, never in git.

## 1. Meta (AJ, phone or PC)
1. Get a separate SIM/number for Layla.
2. developers.facebook.com > create app (Business) > add WhatsApp product > add that number.
3. Copy: temporary or permanent access token -> `WA_TOKEN`; Phone number ID -> `WA_PHONE_NUMBER_ID`; App secret -> `WA_APP_SECRET`.
4. Choose any text as `WA_VERIFY_TOKEN` (also used as VERIFY_TOKEN in the worker).

## 2. Cloudflare relay (AJ, once; free)
Follow the header of `cloudflare/worker.js`: Worker variables VERIFY_TOKEN, APP_SECRET, PULL_SECRET (long random text), KV namespace binding `Q`.
Meta > WhatsApp > Configuration: Callback URL `https://<worker>.workers.dev/webhook`, verify token = VERIFY_TOKEN, subscribe to "messages".

## 3. PC `.env` (names only; fill values by hand)
```
WA_TOKEN=
WA_PHONE_NUMBER_ID=
WA_APP_SECRET=
WA_VERIFY_TOKEN=
RELAY_URL=https://<worker>.workers.dev
RELAY_SECRET=        # same text as the worker's PULL_SECRET
OWNER_WA_NUMBER=     # AJ confirms; code default is 0777999219, do not change silently
```
Leave `LAYLA_OWNER_LIVE` unset until step 4: she stays in DRY RUN.

## 4. Owner-only live test (Claude Code on PC, only after AJ says "go")
1. Restart ONLY `apex-server` (pm2 `--only apex-server`). Never start a second WhatsApp bridge. Never touch the BATHCO bridge.
2. Log should say `relay on` and `DRY RUN`. Send "help" from the owner number: expect a dry-run log line, nothing sent.
3. Set `LAYLA_OWNER_LIVE=true`, restart `apex-server` only.
4. Owner number sends "help": Layla replies. Test line: "Layla test OK" to the owner number only.
5. Try "plan 680000 Metro 4 months": check the 4 reminders in `owner_tasks`.
6. Any other number must stay ignored (ownerGate). Check `/health` is 200.
Rollback: unset `LAYLA_OWNER_LIVE`, restart `apex-server` only.
