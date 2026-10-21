# LEAK SCAN: full git history (read-only), 2026-10-04

Scope: every commit on every branch and remote-tracking ref (249 commits), added lines only, 40+ patterns. No secret values are printed here. Nothing was changed, nothing pushed.
Method limits: pattern-based (a secret in an unusual format could be missed); images, zips and other binary files not read; package-lock.json skipped; dangling objects, reflog, GitHub issues/PRs and forks not checked. I did NOT read your .env, so I could not compare committed PINs with the live PIN (see item 3).

## 0. The headline
**The GitHub repository `ajmalkhan6233-eng/BATH-HUB` is PUBLIC.** Everything in the history is world-readable, including the live-system references in section 2, your account email (section 1) and the shop's WhatsApp number. Nothing that works as a password was found, but the layout of the live system is public.

## 1. Secret findings (file, first commit, what kind)
| # | What | File(s) | First commit | Verdict |
|---|---|---|---|---|
| 1 | API keys, tokens, private keys, cloud keys, DB URLs with passwords, JWTs | none real. Fake samples for redaction tests only: `tests/unit/hardening.test.js` (key-like, bearer, JWT) | ec8a6cf2 | OK (made-up test strings) |
| 2 | `.env` files, key/cert files, DB dumps, WhatsApp session folders (`.wwebjs_auth`), password lists | never committed in any commit (all 249 checked). Only `.env.example` files: `.env.example` (31c04f9e, names only, empty values) and `frontend/.env.example` (2ec3c32c, Gemini key placeholder + one app URL) | - | OK |
| 3 | PIN literals | 8 four-digit and 3 six-digit values plus `0000` placeholders, all in test files or scratch scripts: `tests/setup.js` (e0feb7cd), `tests/integration/brute_force_login.test.js` and `brute_force_pin.test.js` (1f3ead8f), `backup_status.test.js` (a0bd4f2a), `hardening_auth_limits.test.js` (34eab6d0), `scripts/bugcheck_scratch.js` (774835fb, scratch only) | e0feb7cd | CHECK: please confirm none of these equals your real ADMIN_PIN (they are test values; I did not compare) |
| 4 | Passwords/secrets as literals | only test and example values in `tests/integration/*` (auth, admin_core, user_disable, security_gates, multi_login, four_modules_auth, cheque_clear, layla_v2_route), `tests/setup.js` (session secret), `scripts/bugcheck.js` and `bugcheck_scratch.js` (scratch-only test login), `AISTUDIO_HANDOFF/UI_SPEC_SETUP_WIZARD.md` (example) | e0feb7cd | OK (test values; none matches a live credential pattern) |
| 5 | Account email addresses | `SESSION_LOG.md` contains one personal Gmail address (b5797ec0). The git commit author emails are also public: one Gmail and one Yahoo address (every commit) | b5797ec0 | PUBLIC PERSONAL DATA. Fix: use GitHub's no-reply address for new commits; remove it from SESSION_LOG.md (history keeps it unless rewritten) |
| 6 | Phone numbers in code | shop's public WhatsApp number (ends ***219) in `public/website/index.html`, `bathco_complete.html`, `bathhub.html`, `routes/site_editor.js`, `docs/GEMINI_WEBSITE_BRIEF.md`, `utils/hardening/redact.js`; placeholder/example numbers (***567, ***001, ***002, ***334, ***000) in Layla, documents, seeds, tests | 26896c46 / 18d37d40 | The shop number is meant to be public (it is on the website). The rest are fake examples |
| 7 | Private URLs | Railway app URL of the parked apex-app in `CLAUDE.md` and `SESSION_LOG.md` (6b659fce); private LAN addresses only in tests (`multi_login`, `hardening_*`) | 6b659fce | LOW: the Railway app is parked and needs login/PIN, but the URL is public |

## 2. Every file that references the live system
Live shop = `C:\BATHCO_PHASE1`, its Railway project (`alert-cooperation` / `bathco-production`), the live database name, the live WhatsApp bridge and pm2 names. Template = `apex-platform` on Railway, `C:\BATHCO_TEMPLATE` / `E:\AI Sttuf` paths. Files in the current tree (HEAD) and the commit each reference first appeared in.

**A. Live shop paths (`C:\BATHCO_PHASE1`) (8 files):** `CLAUDE.md` (25d828e6), `SESSION_LOG.md` (cc274e62), `AI_MEMORY/PROJECT_PROFILE.md` (ae4f2ecc), `AISTUDIO_HANDOFF/EXTRACTION_STATUS.md` and `LEFTOVER_TRACES.md` (7b8950c6), `package.json`, `scripts/migrate_grn.js`, `validate_data.js` (e0feb7cd).
**B. Live Railway project (`alert-cooperation`, `bathco-production`) (8 files):** `CLAUDE.md` (a47a5514), `SESSION_LOG.md` (6b659fce), `AI_MEMORY/PROJECT_PROFILE.md` (ae4f2ecc), `docs/SYNC_PHASE_B.md` (f57ea777), `docs/_archive/SESSION_BRIEF_17JUL.md` (4a293071), `SESSION_BRIEF_17JUL.md` (809682d0, history only), `utils/railwayControl.js` (25d828e6), `scripts/railway_harden_db.js` (c00ed215).
**C. Template Railway project (`apex-platform`, project id, `apex-app` URL) (11 files):** `CLAUDE.md`, `SESSION_LOG.md`, `AGENT_GUIDE/14_env_vars.md` (25d828e6), `AI_MEMORY/CURRENT_STATE.md`, `DECISIONS.md`, `PROJECT_PROFILE.md` (ae4f2ecc), `docs/SYNC_PHASE_B.md`, `docs/_archive/SESSION_BRIEF_17JUL.md`, `utils/railwayControl.js`, `scripts/railway_harden_db.js`.
**D. Live database name (`bathco` / `bathco_production`) (3 files):** `utils/dbGuard.js` (c00ed215, the guard that blocks it), `SESSION_LOG.md`, `AUDIT_LAYLA_WHITELABEL.md`.
**E. Local paths (`C:\BATHCO_TEMPLATE`, `E:\AI Sttuf`) (6 files at HEAD):** `CLAUDE.md`, `SESSION_LOG.md`, `AI_MEMORY/PROJECT_PROFILE.md`, `docs/_archive/SESSION_BRIEF_17JUL.md`, `AISTUDIO_HANDOFF/EXTRACTION_STATUS.md`, `LEFTOVER_TRACES.md`.
**F. Live WhatsApp session / pm2 process names (`bathco-server`, `grn-watcher`, `whatsapp-bridge`) (21 files):** code: `server.js`, `layla.js`, `grn-watcher.js`, `ecosystem.config.js`, `routes/pos_bills.js`, `routes/shop_operations.js`, `scripts/ocr_photo.js`, `utils/laylaOutput.js`, `utils/whatsappBusinessApi.js`, `utils/whatsappReceiptSender.js`, `tests/integration/receipt_whatsapp_check.test.js`; docs: `AGENT_GUIDE/01_file_map.md`, `02_run_and_verify.md`, `13_whatsapp_bridge.md`, `17_pm2_deploy.md`, `AISTUDIO_HANDOFF/INTEGRATION_MAP.md`, `AI_MEMORY/LESSONS.md`, `docs/ONE_APP_INVENTORY.md`, `AUDIT_LAYLA_WHITELABEL.md`, `SESSION_LOG.md`, `CLAUDE.md`. (Code mentions are the safety rules that keep the template away from the live system.)

Biggest exposure files (all public): `CLAUDE.md`, `SESSION_LOG.md`, `AI_MEMORY/PROJECT_PROFILE.md`: they name the live folder, both Railway projects and the parked app URL. The `CLAUDE.md` client-copy rule already says to exclude these before shipping a client copy; the public repo breaks that rule today.

## 3. What to do (nothing done yet)
1. Decide: make the repo PRIVATE (GitHub, Settings, Danger zone). This removes the whole exposure at once for new readers; anything already copied or cached stays out of reach.
2. Remove your email and the live paths/Railway names from `SESSION_LOG.md`, `CLAUDE.md`, `AI_MEMORY/*`, `AISTUDIO_HANDOFF/*`, `docs/_archive/*`. This only fixes the latest version; history still has them. Rewriting history (`git filter-repo`) is destructive and needs your OK and a fresh backup.
3. Confirm the committed PIN-like test values are not your real ADMIN_PIN; if any is, change the PIN.
4. Set the git author email to GitHub's no-reply address for future commits.
5. No password, key or token needs rotating based on this scan.
