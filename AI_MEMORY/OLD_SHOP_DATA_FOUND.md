# OLD-SHOP MATERIAL FOUND INSIDE THE RBH REPO (paths only, no secrets, nothing moved or deleted)
Needs Ajmal's decision (see questions in the report).
- reference/bathco/ (148 tracked files): old shop's code, old Excel/OCR readers, n8n workflows, cheque tracker report (reference/bathco/reports/PDC_CHEQUE_TRACKER.html), old schema (reference/bathco/schema.sql).
- scripts/from_bathco/ (14 files): old shop's scripts incl. reconcile_bathco.py, ocr_photo.js.
- docs/bathhub_knowledge/ (8+ files) and SESSION_LOG.md, AISTUDIO_HANDOFF/: history of the old system.
- Staff first names of the old shop appear in: AISTUDIO_HANDOFF/EXTRACTION_STATUS.md, AISTUDIO_HANDOFF/LEFTOVER_TRACES.md, docs/_archive/LAYLA_PRO_SPEC.root-copy.md, docs/bathhub_knowledge/BATHCO_CLAUDE_V3.md, docs/bathhub_knowledge/HONESTY_AUDIT.md, docs/bathhub_knowledge/PENDING_FROM_AJMAL.md, public/daily-entry-v2.html, reference/bathco/scripts/generate_master_export.js, reference/bathco/scripts/update_daily_17jun.js, tests/unit/document_filing.test.js.
- Old shop's real price/markup figures (summary only, no item names): utils/pricingEngine.js lines ~26-45, BUILD.md section on markups.
- SECRET-LOOKING TEXT: .claude/commands/dubai-status.md line 7 holds a database password in plain text (value not shown here). The repo is public. Rotate that password and remove the line.
- No .env, .sql dumps, .xlsx, .csv or backup files are tracked in git (checked).
- Old shop live system (C:\BATHCO_PHASE1, Railway bathco-production): not in this repo, not touched.
