# Safely disabling a feature for a client

Order of preference:
1. Feature flag OFF (see 05) — right way for whole modules.
2. Hide the nav button in BATHCO_NATURE.html: add style="display:none" to its
   nav-trigger/nav-btn. The page stays but is unreachable. Reversible.
3. NEVER delete: API routes in server.js, DB tables/columns, or anything in 09_golden_core.

Before hiding something check dependencies: grep BATHCO_NATURE.html for the feature's
function names — if another page calls them, hiding the button is fine but deleting code is not.
After disabling, click through the remaining pages to confirm nothing errors.
