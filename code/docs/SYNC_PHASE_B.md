# SYNC PHASE B: cloud copy (DESIGN ONLY, nothing built, Railway stays parked)

Phase A (built) makes the shop work with no internet: the laptop holds the master database, phones and tablets save entries on the device first (offline queue) and send them when the laptop is reachable. Phase B adds an off-site copy, only when Aj says **"go-live Railway"**.

## Idea in one line
The laptop database is the MASTER. Every N minutes, when the laptop has internet, it pushes a one-way copy of chosen tables to a Railway Postgres (project `apex-platform`, currently parked). Nothing writes back. If the laptop dies, the cloud copy is the restore source.

## How it would work
1. A small job on the laptop (a pm2 app `apex-sync`, started only after go-live) wakes every N minutes and checks internet.
2. For each chosen table it sends rows changed since the last successful sync (uses `updated_at` or `created_at`; tables without those are copied whole once a day). Rows are upserted by primary key. Voided records are copied as voided (never deleted).
3. Progress is kept in a new table `sync_state(table_name, last_synced_at, last_row_count, last_error)` on the laptop.
4. Attachments (`uploads\`) are copied as files to an object store or a volume on the same Railway project, only files not yet sent (by name).
5. Restore path: `pg_dump` of the cloud copy, or the Admin > System & Backups restore screen using a downloaded cloud dump (RESTORE + PIN + safety backup, as today).
6. Failure is never silent: Admin > System & Backups shows "last cloud sync", age, and the last error. A warning shows if older than 2 hours (while internet is up).

## What must be decided FIRST (by Aj)
| Question | Options | Default suggestion |
|---|---|---|
| Which tables? | everything / money only / money + records without attachments | everything except `session`, `login_audit`, `sync_log`, `admin_audit` secrets |
| How often? | 5 / 15 / 60 minutes | 15 minutes |
| Who can see the cloud copy? | only Aj (Railway login) / a read-only viewer page for the uncle | only Aj to start |
| Photos and PDFs? | copy / skip | copy (small shop volume) |
| Cost ceiling per month? | set a cap in Railway | cap before the first deploy |
| Restore drills | how often to test a restore from the cloud copy | every 3 months |

## Safety rules
- One-way only. The cloud copy is never edited by hand and never read by the shop app while the laptop is healthy.
- Credentials (Railway DB URL) live only in the laptop `.env`; never in git, never in the browser.
- Golden-core financial tables are copied as they are: no transformation, no recalculation.
- The existing Railway project `alert-cooperation` (live system) is never touched. `apex-platform` is the only target.
- Un-parking follows CLAUDE.md task 1 (redeploy Postgres, never `railway add -d postgres`, then deploy the app) and only on the owner's go-live word.

## Not in Phase B
Two-way sync, running the shop from the cloud, multi-shop merge. Those would need a different design (conflict rules per table).