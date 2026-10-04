-- Layla owner assistant tables (additive, idempotent). Rollback: migrations/layla_owner_down.sql
CREATE TABLE IF NOT EXISTS owner_tasks (
  id SERIAL PRIMARY KEY,
  branch_id INTEGER NOT NULL DEFAULT 1,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','DONE','CANCELLED')),
  snoozed_until TIMESTAMPTZ,
  nag_every_min INTEGER NOT NULL DEFAULT 60,
  nags_sent INTEGER NOT NULL DEFAULT 0,
  max_nags INTEGER NOT NULL DEFAULT 3,
  last_sent_at TIMESTAMPTZ,
  source TEXT,
  source_msg_id TEXT,
  meta TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS owner_messages (
  id SERIAL PRIMARY KEY,
  wa_message_id TEXT UNIQUE,
  direction TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS idempotency_keys (
  idem_key TEXT PRIMARY KEY,
  route TEXT,
  status INTEGER NOT NULL DEFAULT 0,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_owner_tasks_open ON owner_tasks(status, due_at);
