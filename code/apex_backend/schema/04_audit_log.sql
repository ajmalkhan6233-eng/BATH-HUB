CREATE TABLE IF NOT EXISTS audit_log (
    id               SERIAL PRIMARY KEY,
    actor_admin_id   INTEGER NOT NULL,
    action_type      VARCHAR(50) NOT NULL,
    target_tenant_id INTEGER,
    details          JSONB,
    created_at       TIMESTAMP NOT NULL DEFAULT now()
);

-- Lock it down: the app's database role can only INSERT, never UPDATE or DELETE.
-- CLAUDE_CODE_DECIDES: confirm 'app_role' below matches the real Postgres
-- role name the Node app connects as.
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
GRANT INSERT, SELECT ON audit_log TO app_role;
