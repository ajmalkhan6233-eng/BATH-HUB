# Common pitfalls

- Editing public/bathco_complete.html thinking it's the app — the live UI is BATHCO_NATURE.html.
- Forgetting the frontend is ONE huge html file — a stray unmatched quote/brace kills every page. Always hard-refresh and check the browser console after edits.
- Hardcoding "Rs" or a business name — use BRAND.currency_symbol / BRAND.company_name.
- Changing .env without restarting with --update-env, then chasing a "bug" that's stale env.
- Running two instances on one port — each instance needs its own PORT and its own DB_NAME.
- Windows sleep re-enabled after an update -> WhatsApp drops overnight (see 13).
- npm install of new packages — DON'T. The system ships with everything it needs; new
  dependencies need vendor approval.
