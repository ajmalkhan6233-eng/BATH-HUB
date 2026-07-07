# Theme / color system

Two layers, do not mix them up:
1. Brand palette — config/active.branding.json "theme" object (emerald_*, earth_*, gold_* hex values).
   Used for chrome/accents. Change colors per client HERE.
2. Background themes — public/themes/*.js (nature.js, kim_forest.js). Animated login/dashboard
   backgrounds. Users pick one in Settings -> Appearance.

To add a background theme: copy public/themes/_TEMPLATE.js, rename, follow its comments,
it self-registers in the picker. Do not edit existing themes for one client — add a new file.
CSS variables in BATHCO_NATURE.html (:root --bg, --card, --gold etc.) drive page styling —
change variables, not scattered hex values.
