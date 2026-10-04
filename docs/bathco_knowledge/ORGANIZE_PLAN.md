---
title: Desktop + Downloads Organize Plan (dry-run only)
purpose: FINAL_BUILD.md Phase 4 — proposed move list into C:\AJMAL_ARCHIVE\. Filenames/sizes/dates only, no file contents were read. NOTHING has been moved. Waiting for Ajmal's OK per Phase 4 item 11.
scanned: 2026-07-05
scope: C:\Users\DELL\Desktop and C:\Users\DELL\Downloads, top level only (subfolders below are proposed to move as whole units, not exploded file-by-file)
---

# How to read this

Each top-level item on Desktop/Downloads gets one line: proposed destination
under `C:\AJMAL_ARCHIVE\` or **LEAVE** (don't touch). Nothing below has been
moved — this is the plan only, per Phase 4 item 11 ("STOP and wait for
Ajmal's OK before moving anything").

**LEAVE** items and reasoning:
- Any `.lnk` shortcut (Claude, Claude Code, GIMP, GitHub Desktop, Obsidian,
  Postman, Telegram) — moving breaks the desktop launcher, not archival material.
- `desktop.ini` (both folders) — Windows system file.
- `Unconfirmed 522274.crdownload` (Downloads) — an in-progress/incomplete
  browser download, not a finished file.
- `Desktop\BATHCO_VERSION_1\` — contains `FINAL BUILD.md`, the exact spec
  driving this session, and `kimcord.md` (source for the new kim_forest
  theme). Modified today. Active, not archival.
- `Desktop\BATHCO_MASTER_CONSOLIDATED\` — contains `SESSION_LOG.md` last
  modified today (12:38) and a full nested copy of the BATHCO_PHASE1 docs.
  Looks like an actively-maintained consolidated export, not a stale backup.
- `Desktop\final.md` — referenced by name in a comment in
  `C:\BATHCO_PHASE1\scripts\seed_feature_flags.js` ("every module from
  final.md"). Moving it wouldn't break the script (it's just a comment,
  not a runtime read), but it's a provenance link worth knowing about before
  burying it in an archive — flagging rather than deciding for you.
- `Desktop\now.txt` — 0 bytes, modified today (12:11), same session window as
  this scan. Probably scratch, but recent enough to double check before moving.

Per Phase 4 item 9, out of scope entirely (not touched, not scanned, not
listed below): `C:\BATHCO_PHASE1`, `C:\DUBAI_IMPORTS_FLUTTER`,
StudioProjects, Program Files, Windows, and anything inside an active git repo.

---

## Desktop → C:\AJMAL_ARCHIVE\

| Item | → Category | Note |
|---|---|---|
| BATHCO MODULAR CONTROL.md | BATHCO_DOCS | superseded — merged into MODULE_REGISTRY.md 2026-07-04 |
| BATHCO SESSION ADDON 04JULY.md | BATHCO_DOCS | |
| BATHCO_CYBERPUNK.html | OLD_VERSIONS | old standalone mockup |
| BATHCO_DASHBOARD_REPORT.txt | BATHCO_DOCS | |
| BATHCO_GLM_HANDOVER.md | BATHCO_DOCS | |
| BATHCO_RULES.md | BATHCO_DOCS | |
| BATHCO_STATUS_REPORT.md | BATHCO_DOCS | |
| BATHCO_UPGRADED.html | OLD_VERSIONS | old standalone mockup |
| BATHCO_VERSION_1.rar | OLD_VERSIONS | zip snapshot of the (still-active, LEAVE'd) folder, dated Jul 4 |
| DUBAI_IMPORTS_COMPLETE.html | MISC | different project (Dubai Imports, not Bathco) |
| Desktop.rar | OLD_VERSIONS | full desktop backup snapshot |
| FOUND_EXCEL.rar | EXCEL_REPORTS | |
| KIMI_MERGE_LOG.md | BATHCO_DOCS | |
| LAYLA_CAPABILITY.md | BATHCO_DOCS | |
| LAYLA_TEST_REPORT.md | BATHCO_DOCS | |
| LAYLA_TEST_REPORT_2.md | BATHCO_DOCS | |
| NATURE_BUILD.MD | BATHCO_DOCS | identical size to NATURE_BUILD.txt below — likely a duplicate pair |
| NATURE_BUILD.txt | BATHCO_DOCS | see above |
| New Text Document.txt / (2) / (3) / (4) / (5) / (6) / (7) / (8) | MISC | most are 0 bytes; scratch files |
| New folder\ (whole dir) | OLD_VERSIONS | mixed old Bathco/Noor/Sidra docs+html+sql, nothing newer than Jun 25 |
| SESSION_EXPORT.md | BATHCO_DOCS | |
| STATUS_TODAY.md | BATHCO_DOCS | |
| _extracted_found_excel\ (whole dir) | EXCEL_REPORTS | |
| bathco_backup_20260630.sql | OLD_VERSIONS | DB backup snapshot |
| bathco_cloud_migration_20260630.dump | OLD_VERSIONS | DB backup snapshot |
| claude code status check.md | BATHCO_DOCS | |
| complet till 17-06-2026\ (whole dir) | EXCEL_REPORTS | mixed: DALI/DAY SALE source data + expense-sheet photos + xlsx — filed under Excel since that's the folder's evident primary purpose, but it's genuinely mixed content |
| every time claude.txt | BATHCO_DOCS | |
| fix errors agents first.md | BATHCO_DOCS | |
| layala.md | BATHCO_DOCS | |
| layla_test_questions_used.md | BATHCO_DOCS | |
| new.html | OLD_VERSIONS | same byte size as "New Text Document (3).txt" in New folder\ — likely a duplicate |
| obsidian-vault-notes\ (whole dir) | MISC | personal Obsidian vault export |
| total.md | BATHCO_DOCS | |
| vendersNew folder.rar | MISC | unclear exact contents from filename alone |
| workflow.json.txt | MISC | looks like an n8n workflow export |

## Downloads → C:\AJMAL_ARCHIVE\

| Item | → Category | Note |
|---|---|---|
| Archive\ (whole dir, hundreds of .JPG/.jpg) | PHOTOS_EXPENSES | |
| Archive (1).zip | PHOTOS_EXPENSES | identical size (722,342,182 bytes) to Archive.zip below — likely a duplicate |
| Archive.zip | PHOTOS_EXPENSES | see above |
| BATHCO DAILY ENTRY FIX.md | BATHCO_DOCS | |
| BATHCO_CLAUDE_v3.md | BATHCO_DOCS | |
| BATHCO_CLAUDE_v3_1.md | BATHCO_DOCS | near-identical size to v3.md — likely a revision pair |
| BATHCO_RULES.md | BATHCO_DOCS | duplicate name also on Desktop |
| CLAUDE CODE COMMANDS.md | BATHCO_DOCS | |
| CLAUDE.md | BATHCO_DOCS | a Downloads copy — the live one is C:\BATHCO_PHASE1\CLAUDE.md, LEAVE that one alone |
| COMMAND 5 HOME FIX ONLY.md | BATHCO_DOCS | |
| ChromeSetup.exe / ChromeSetup (1).exe | INSTALLERS | identical size — duplicate |
| Claude Setup.exe / Claude Setup (1).exe | INSTALLERS | |
| GLM_BATHCO_APP_MASTER_PROMPT.md | MISC | prompt for external tool (GLM), not a Bathco doc proper |
| GLM_NOOR_PROMPT.txt / GLM_NOOR_PROMPT_1.txt | MISC | Noor project, not Bathco |
| Microsoft.Services.Store.winmd | MISC | stray system-type file |
| Obsidian-1.12.7.exe | INSTALLERS | |
| Payment_Stop_Request_Letter.pdf | BATHCO_DOCS | business letter |
| SupportAssistLauncher.exe | INSTALLERS | |
| TeamViewer_Setup_x64.exe | INSTALLERS | |
| WhatsApp Image *.jpeg (6 files) | PHOTOS_EXPENSES | |
| WhatsApp Installer.exe / (1) / (2) / (3) | INSTALLERS | |
| WhatsApp Unknown *.zip (4 files) | MISC | unclear content from filename alone |
| android-studio-quail1-patch2-windows.exe | INSTALLERS | |
| bathco-complete-app.zip | OLD_VERSIONS | |
| council-review.html | MISC | |
| dashboard.html / dashboard (1).html | OLD_VERSIONS | superseded — BATHCO_NATURE.html is now the one live app per MODULE_REGISTRY.md |
| flutter_windows_3.44.2-stable.zip | INSTALLERS | |
| gen_part1.py / generate_noor_app.py / setup_noor.py / setup_noor_fixed.py | MISC | Noor project scripts, not Bathco |
| gh_2.93.0_windows_amd64.msi | INSTALLERS | |
| node-v24.16.0-x64.msi | INSTALLERS | |
| obsidian-vault-notes.zip / obsidian-vault-notes_1.zip | MISC | |
| plan create commands.md | BATHCO_DOCS | |
| postgresql-16.14-1-windows-x64.exe | INSTALLERS | |
| reconcile bathco.md | BATHCO_DOCS | |
| sidra-kids.html / sidra-kids-v2.html / sidra-kids-v2_1.html | MISC | different project (Sidra Kids) |

---

## Summary counts (proposed, not executed)

- BATHCO_DOCS: ~27 items
- EXCEL_REPORTS: 3 items
- PHOTOS_EXPENSES: ~9 items (2 of which — Archive.zip / Archive (1).zip — look like true duplicates worth confirming before both are kept)
- INSTALLERS: ~17 items
- OLD_VERSIONS: ~9 items
- MISC: ~16 items
- LEAVE (not in archive plan): 7 shortcuts, 2 `desktop.ini`, 1 in-progress download, 2 active project folders, 1 provenance-flagged doc, 1 recent scratch file

**Nothing has been moved.** Next step per Phase 4 item 11: Ajmal reviews this
table and says which categories (or specific rows) to actually execute.
