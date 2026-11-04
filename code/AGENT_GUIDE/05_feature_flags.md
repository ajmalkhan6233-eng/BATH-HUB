# Feature toggles

- DB table: feature_flags (module_key, category, label, is_core, enabled, built).
- API: GET /api/feature-flags ; the Settings page renders them (id="flag-list").
- Toggle from UI: Settings -> Feature Flags. Toggle from SQL:
  UPDATE feature_flags SET enabled = false WHERE module_key = 'XXX';
- is_core = true flags must NEVER be disabled (they guard financial modules).
- Frontend checks flags after login; a disabled module's nav entry hides.
- Prefer flipping a flag over deleting/commenting out code — it is reversible and safe.
