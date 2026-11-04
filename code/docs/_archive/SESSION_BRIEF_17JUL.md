# SESSION BRIEF — 17 July 2026 (evening laptop session)
**Operator:** Ajmal | **Mode:** careful, one agent, bypass-permissions OFF
**Golden rule:** DO NOT touch the live BATHCO COMMAND production system (Railway bathco-production) or its database. Work only on template/APEX code.

Read C:\...\LAYLA_PRO_SPEC.md (saved alongside this file) before starting. It is the master design for LAYLA Pro.

---

## TASK 1 — Find where the APEX Super Admin actually lives (10 min)
Ajmal needs to know which codebase contains the platform control tower (PlatformAdmin.tsx, apex backend, tenant/package management).

1. Search these locations and report findings clearly:
   - C:\BATHCO_TEMPLATE\ — look for PlatformAdmin, apex, admin, platform, tenant, package files
   - Any C:\APEX* or C:\apex-platform folder
   - Location where apex_backend.zip was extracted
2. Output a simple map: "APEX admin frontend = <path>; APEX backend = <path>; inside/outside BATHCO_TEMPLATE repo."

## TASK 2 — Get APEX onto GitHub (CRITICAL — disaster protection) (15 min)
APEX currently exists ONLY on this laptop. If the laptop dies, the product dies.

1. Ajmal creates the empty repo on github.com (green New button): name `apex-platform`, **Private**. (Skip if already created from phone.)
2. If APEX code lives OUTSIDE BATHCO_TEMPLATE: initialize git in the APEX folder, add remote `https://github.com/ajmalkhan6233-eng/apex-platform.git`, commit, push.
3. If APEX code lives INSIDE BATHCO_TEMPLATE: it's already on GitHub — just confirm and report; no new repo needed (delete the empty one if created).
4. **Before first push:** check for secrets (.env files, API keys, tokens) — ensure .gitignore excludes them. Never push .env.
5. Verify push succeeded: repo shows files on github.com.

## TASK 3 — Inject the LAYLA PRO spec into the repo (5 min)
1. Copy LAYLA_PRO_SPEC.md into the repo that owns LAYLA's sellable code (likely BATHCO_TEMPLATE) under docs/LAYLA_PRO_SPEC.md.
2. Add a line to CLAUDE.md: "LAYLA Pro master design = docs/LAYLA_PRO_SPEC.md — read before any LAYLA work."
3. Commit + push.

## TASK 4 — LAYLA white-label audit (30–45 min, report only — no big refactor tonight)
Per spec section 1: grep LAYLA-related files for hardcoded identity:
- "First Choice Bathco", "Bathco", "bathco", tile-specific wording, hardcoded "Ayubowan" greeting, hardcoded prices/phone numbers.
- Produce AUDIT_LAYLA_WHITELABEL.md listing every file + line that must become per-client config.
- Do NOT refactor yet — report first, Ajmal decides next session.

## TASK 5 — (Only if time and energy remain) Start Implementation Phase 1
From spec section 10: begin moving hardcoded LAYLA identity values to per-client config, smallest safe steps, template code only.

## END OF SESSION — always
1. Update SESSION_LOG.md with what was done.
2. Update CLAUDE.md if any structural facts changed.
3. Confirm: production untouched, all pushes verified.
