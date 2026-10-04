# PHASE_ROADMAP.md — Phases 2-4 Execution Spec

Written 12 Jun 2026 at the close of Phase 1. Lets a future small session (or a
technician) pick up any phase from documents alone — no conversation history
needed.

---

## Phase 1 — Period Segregation & Honesty Audit — ✅ DONE (12 Jun 2026)

Tier system (FULL/CASHFLOW/FOUNDATION) built and live for all 172 days, UI
shows honest per-tier data, all-time Net Profit corrected to TIER-1-only
basis, full audit trail in `SOURCE_INVENTORY.md` + `RECONCILIATION_RULES.md` +
`HONESTY_AUDIT.md` + `DECISIONS_LOG.md`. Redesign done in one pass (emerald +
gold + glass theme). See `PORTFOLIO_STATUS.md` for the full close-out.

---

## Phase 2 — Data Completion (no code changes, mostly Ajmal's input)

Goal: grow TIER 1 FULL beyond the current 32 days by closing the specific
gaps identified in Phase 1. **Tracked in `PENDING_FROM_AJMAL.md`** — work
through that list. Highest-value items for tier growth:

1. **Lasersoft GP reports for 14 May – 10 Jun 2026** (~28 days). These days
   already have good revenue/cash-split data (TIER 2); adding real GP +
   expenses promotes them straight to TIER 1. This is the single highest-ROI
   item — could nearly double TIER 1 coverage.
2. **Re-verify 21 Dec 2025 – 30 Jan 2026 revenue against Excel** (30 days,
   currently LKR 17,249,211 from Lasersoft POS, per `SOURCE_INVENTORY.md`
   part a/c). Correct in `daily_summary.total_sale`/`cash_sale`/etc if your
   Excel differs — re-run `/api/all-time-stats` to confirm the new total.
3. **2026-05-13 expense discrepancy** (total_expenses=53,820 vs itemized
   ~99,190, `SOURCE_INVENTORY.md` part b) — check the paper, correct
   `daily_summary.total_expenses` for that date if needed.
4. **Wage list** (`PENDING_FROM_AJMAL.md` #1) — once provided, unlocks Staff/
   Commission totals (currently "PENDING wage list" badges).

**How to verify progress**: re-run the tier-count query from
`RECONCILIATION_RULES.md` §8 (or just hit `/api/all-time-stats` and check
`tier_full_days`) — no code changes needed, the tier formula is live and
recomputes automatically as `gp_status`/`total_expenses` are filled in.

**Done when**: `tier_full_days` / `days` materially improves (e.g. 32/172 →
60+/172) and the 3 reconciliation items above are resolved or explicitly
declined by Ajmal.

---

## Phase 3 — Cloud Deployment

Goal: dashboard accessible over HTTPS from anywhere, DB migrated to managed
cloud Postgres, local AI ingestion (LAYLA/OCR/CHECKER) continues unchanged
against the cloud DB.

**Full step-by-step spec: `CLOUD_DEPLOY_GUIDE.md`** — covers code changes
(3 hardcoded Windows paths in `server.js`), DB migration via `pg_dump`/
`pg_restore`, hosting recommendation (Render/Railway + Supabase), env var
checklist, go-live checklist, and rollback plan.

**Prerequisite**: none — Phase 3 can run independently of Phase 2 (more
complete data is nice to have before going live, but not required).

**Done when**: the go-live checklist in `CLOUD_DEPLOY_GUIDE.md` §8 is fully
checked off and `PORTFOLIO_STATUS.md` records the live URL + go-live date.

---

## Phase 4 — Multi-Tenant ("Noor Digital")

Goal: the same codebase serves multiple businesses (not just 1st Choice
Bath Hub), each with isolated data, per CLAUDE.md's existing "MULTI-TENANT
ARCHITECTURE RULES" section (currently aspirational/未built).

**Prerequisite**: Phase 3 complete (cloud infrastructure must exist first).

**Scope (to be detailed in its own spec when Phase 3 is done — not yet
written, intentionally, since the concrete cloud setup from Phase 3 will
determine the right approach)**:
- Add `tenant_id` to every business-data table (`daily_summary`, `customers`,
  `quotations`, `staff`, `expenses_detail`, etc.) — currently single-tenant
  (implicit tenant = Bath Hub).
- `BusinessConfig` per tenant (business_name, currency, tax_rate,
  commission_rate) — referenced in CLAUDE.md but not yet implemented as a
  table/config.
- Auth: extend the current admin/owner/staff roles with a tenant scope.
- Decide hosting model: one shared DB with `tenant_id` row-level isolation
  (simpler, recommended to start) vs. one DB per tenant (more isolation, more
  ops overhead).

**Note**: Bath Hub Aromatic (`PENDING_FROM_AJMAL.md` #8) and Noor Digital are
related but separate — resolve #8 first; it may inform how Phase 4's tenant
model is shaped (Aromatic could become the first second-tenant test case).

---

## Quick reference — which doc for which question

| Question | Doc |
|---|---|
| "What's the data quality for day X?" | `RECONCILIATION_RULES.md` §8 (live SQL formula) |
| "Where did number Y come from?" | `SOURCE_INVENTORY.md` |
| "What did the AI decide and why?" | `DECISIONS_LOG.md` |
| "What's still open / needs Ajmal?" | `PENDING_FROM_AJMAL.md` |
| "How do I deploy this?" | `CLOUD_DEPLOY_GUIDE.md` |
| "What's the overall plan?" | this file |
| "What's the current status in plain language?" | `PORTFOLIO_STATUS.md` |
