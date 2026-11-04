---
name: ecc-db-migrations
description: Safe database migration rules: forward-only, small, reversible where possible, no long locks, tested first.
---
# DB migrations
- Every schema change is a migration file; no manual edits to production; never edit a migration already applied.
- Schema change and data backfill are separate migrations.
- New columns: nullable or with default; add NOT NULL later after backfill.
- Big tables: build indexes concurrently (Postgres); avoid long locks.
- Rename/remove: expand then contract — add new, write both, move readers, drop old in a later release; remove code before dropping the column.
- Write the undo plan (or mark irreversible) before running. Take a backup first.
- Test on a copy with realistic size before the real database.
- Golden-core tables in Aj's projects: never ALTER without his sign-off.
