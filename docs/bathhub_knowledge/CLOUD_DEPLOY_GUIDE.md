# CLOUD_DEPLOY_GUIDE.md — Phase 3 Execution Spec

Written so a future small session (or a technician with no prior context) can
take BATH HUB COMMAND from "running on Ajmal's Windows PC" to "accessible from
anywhere over HTTPS", without breaking the AI ingestion pipeline (LAYLA/
CHECKER/OCR) that currently runs locally.

---

## 0. What gets deployed vs what stays local

| Component | Now | After Phase 3 |
|---|---|---|
| **Dashboard** (`server.js` + `public/dashboard.html`) | Windows PC, `localhost:3000` | Cloud host, HTTPS domain |
| **Database** (`bathco` Postgres) | Local Postgres 16 on the same PC | Managed cloud Postgres (same data, migrated) |
| **AI ingestion** (`C:\Bath Hub\AI-Data\run_agents.py`, `process_inbox.py`, OCR, LAYLA WhatsApp bot) | Windows PC, Python | **Stays on the Windows PC** for Phase 3 — just points at the cloud DB instead of localhost. Full migration of the Python/OCR pipeline is Phase 4 (multi-tenant). |

This split means: Ajmal/Uncle/staff get a real web dashboard immediately,
while the existing OCR/photo-upload workflow keeps working unchanged (it just
writes to the cloud DB over the internet instead of localhost).

---

## 1. Code changes required before deploy (one-time, ~15 min)

`server.js` currently has 3 hardcoded absolute Windows paths that won't exist
on a cloud Linux host:

```js
// line 84
app.use(express.static('C:\\BATHCO_PHASE1\\public'));
// line 110
app.get('/', (req, res) => res.sendFile('C:\\BATHCO_PHASE1\\public\\dashboard.html'));
// line 383
execFile('python', ['C:\\Bath Hub\\AI-Data\\process_inbox.py'], ...)
```

Fix:
```js
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
```
Line 383 (`process_inbox.py` trigger) should be **removed or feature-flagged
off** on the cloud deploy — the inbox-processing script lives on the Windows
PC and has no meaning on the cloud server. Wrap it:
```js
if (process.env.ENABLE_LOCAL_INGEST === 'true') {
  execFile('python', [...]);
}
```
Leave `ENABLE_LOCAL_INGEST=true` on the Windows PC's `.env`, omit it (defaults
falsy) on the cloud `.env`.

---

## 2. Database migration

1. Fresh backup (same pattern as every session start):
   ```bash
   PGPASSWORD=Bathco2026 pg_dump -U postgres -d bathco -F c -f bathco_cloud_migration_$(date +%Y%m%d).dump
   ```
2. Pick a managed Postgres provider. Recommended (in order, cheapest/simplest
   first): **Supabase** (free tier, 500MB, includes connection pooling) or
   **Railway** / **Render** (Postgres add-on, pairs with their Node hosting).
3. Create the cloud database, then restore:
   ```bash
   pg_restore -h <cloud-host> -p <cloud-port> -U <cloud-user> -d bathco -v bathco_cloud_migration_YYYYMMDD.dump
   ```
4. Verify row counts match local before switching anything over:
   ```sql
   SELECT count(*) FROM daily_summary;   -- expect 172
   SELECT count(*) FROM customers;
   SELECT count(*) FROM quotations;
   ```

---

## 3. Hosting the dashboard (server.js)

Recommended: **Render** or **Railway** (both: push a git repo, set env vars,
get a `*.onrender.com`/`*.up.railway.app` HTTPS URL immediately; custom domain
optional later).

1. Push `C:\BATHCO_PHASE1` to a **private** git repo (exclude `.env`,
   `node_modules`, any `*.dump`/`*.sql` backups — add a `.gitignore`).
2. Create a new Web Service from the repo. Build command: `npm install`. Start
   command: `node server.js`.
3. Set environment variables (from the existing `.env` — see §4 below).
4. Deploy. The platform assigns a public HTTPS URL automatically.

---

## 4. Environment variables for the cloud `.env`

These keys already exist in `C:\BATHCO_PHASE1\.env` — copy values (not the
file itself) into the host's environment variable settings:

| Key | Cloud value |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | new cloud Postgres connection details from §2 |
| `DASH_USER` / `DASH_PASS` | keep as-is, or rotate for the public-facing deploy |
| `SESSION_SECRET` | generate a new random value for the cloud instance |
| `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` / `DEFAULT_MODEL` | only needed if any AI features are called *from* server.js itself (check before omitting) |
| `PORT` | most hosts set this automatically — `server.js` already reads `process.env.PORT \|\| 3000` |
| `ENABLE_LOCAL_INGEST` | **omit** on cloud (see §1) |

⚠️ Rotate `DASH_PASS`/`SESSION_SECRET` for the public deploy — the current
values were set for a localhost-only instance.

---

## 5. Pointing local AI ingestion at the cloud DB

On the Windows PC, update `C:\BATHCO_PHASE1\.env` (the **local** copy) so
`DB_HOST`/`DB_PORT`/etc point at the cloud Postgres instead of `localhost`.
`run_agents.py` and `process_inbox.py` use the same `pg`/`psycopg2` connection
pattern — confirm they read from `.env` (not a hardcoded `localhost`) before
switching. Test with one OCR upload end-to-end before relying on it.

---

## 6. Domain + HTTPS

Render/Railway provide HTTPS automatically on their `*.onrender.com` /
`*.up.railway.app` subdomain — no action needed for a working secure URL on
day one. A custom domain (e.g. `command.1stchoicebathco.lk`) is optional and
can be added later via the host's "Custom Domain" settings + a DNS CNAME
record at the domain registrar.

---

## 7. Backups (cloud)

- Supabase/Render/Railway managed Postgres include automatic daily backups on
  paid tiers — confirm retention period and enable if not on by default.
- Additionally, keep the existing local backup habit
  (`pg_dump` before any schema change) — run it against the **cloud** DB host
  going forward, save to `F:\Backup\` as before.

---

## 8. Go-live checklist

- [ ] Code changes from §1 applied and tested locally (server still starts,
      `/dashboard.html` loads, login works)
- [ ] Fresh `pg_dump` of local `bathco` DB taken
- [ ] Cloud Postgres created, data restored, row counts verified
- [ ] Cloud `.env` configured (§4), secrets rotated
- [ ] Git repo pushed (private, `.env`/`*.dump` excluded), Web Service
      deployed
- [ ] Cloud dashboard URL loads, login works, spot-check 2-3 days of data
      match local
- [ ] Local `.env` updated to point AI ingestion at cloud DB (§5), one OCR
      upload tested end-to-end
- [ ] Old localhost-only `DASH_PASS`/`SESSION_SECRET` rotated
- [ ] PORTFOLIO_STATUS.md updated to record the live URL and go-live date

---

## 9. Rollback plan

If anything goes wrong after go-live: the local Windows instance + local
Postgres DB are untouched (migration is copy, not move) — point ingestion
`.env` back to `localhost`, keep using the local dashboard at
`http://localhost:3000` exactly as before, and retry the cloud cutover later.
Nothing is destructive until §5 (changing the *local* `.env`), which is
trivially reversible.

---

*Phase 4 (multi-tenant, "Noor Digital") builds on this once Phase 3 is stable
— see `PHASE_ROADMAP.md` and CLAUDE.md "MULTI-TENANT ARCHITECTURE RULES".*
