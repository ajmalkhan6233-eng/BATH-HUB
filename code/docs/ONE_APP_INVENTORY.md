# ONE APP INVENTORY (2026-10-02, tag pre-cleanup-2026-10-02)

Target: `/` = Royal Bath Hub public site, `/owner` = the one owner app. Rule: nothing is deleted while its feature is missing from /owner.

| File | Purpose | In /owner? | Duplicate of | Action |
|---|---|---|---|---|
| public/bathco_complete.html | the owner app (shell) | IS /owner | - | KEEP |
| public/bathhub.html + bathhub-feed.js | public website | - | - | KEEP |
| public/setup.html | first-run wizard | - | - | KEEP |
| public/pos_billing.html, investor_loans.html, money-control.html, sale_commissions.html, settings.html | screens, open as frames inside /owner | yes (frame) | - | KEEP |
| public/cheque_register.html | cheque register | NO (not in shell) | - | KEEP, add frame to /owner (Phase 3 F) |
| public/investor-view.html | investor's token view (no login) | public | - | KEEP |
| public/BATHCO_NATURE.html | OLD owner app | partly | /owner | KEEP until ported: Customers, Credit & Aging, Quotations, Purchasing, Accounting, Audit & Accounting, Reports, Staff, Staff Extended, Labels, Assistant, System Tools, Users/Flags, Platform Admin. Linked from /owner as "Legacy screens". |
| public/nature-manifest.json, themes/*.js | old app only | no | manifest.json | KEEP with NATURE |
| public/lib/xlsx.full.min.js | not used by any page | no | - | ARCHIVE to public/_archive |
| public/salary.js, document-inbox.js, pos-picker.js, attach-widget.js | /owner scripts | yes | - | KEEP |
| public/manifest.json, service-worker.js | PWA | yes | - | KEEP, start_url -> /owner (Phase 3 F) |
| routes/*.js (29) | API modules, all mounted in server.js | yes/NATURE | - | KEEP |
| LAYLA_PRO_SPEC.md (root) | older copy of docs/LAYLA_PRO_SPEC.md | - | docs/ copy (differs) | ARCHIVE to docs/_archive |
| SESSION_BRIEF_17JUL.md | old session brief | - | - | ARCHIVE to docs/_archive |
| uploads/attachments/* (2) | leftover test files | - | - | DELETE |
| .claude/worktrees (3 extra) | old agent copies, 43k files | - | repo | DELETE (merged, tagged) |
| local branches (6, all merged) | overnight, go-live, claude/* , octopus-memory | - | master | DELETE (remote copies stay) |
| layla.js, grn-watcher.js, whatsapp-bridge.js, index.js, check-system.js, validate_data.js, ecosystem.config.js | live-system pieces / scripts | - | - | KEEP |
| frontend/, AISTUDIO_HANDOFF/, AGENT_GUIDE/, AI_MEMORY/, docs/, backups/, scripts/, tests/ | keep list | - | - | KEEP |