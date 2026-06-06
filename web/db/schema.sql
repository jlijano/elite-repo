CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chats_archived_updated_at_idx
  ON chats(archived_at, updated_at);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_messages_chat_id_created_at_idx
  ON chat_messages(chat_id, created_at);

CREATE INDEX IF NOT EXISTS chat_messages_reviewed_idx
  ON chat_messages(reviewed, created_at);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  photo_url TEXT,
  company TEXT,
  department TEXT,
  group_name TEXT,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'disabled')),
  password_hash TEXT,
  password_updated_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS company TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS group_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx
  ON users(LOWER(email));

CREATE INDEX IF NOT EXISTS users_status_role_idx
  ON users(status, role);

CREATE INDEX IF NOT EXISTS users_org_access_idx
  ON users(company, department, group_name);

CREATE TABLE IF NOT EXISTS user_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_sessions_user_expires_idx
  ON user_sessions(user_id, expires_at DESC);

CREATE INDEX IF NOT EXISTS user_sessions_active_idx
  ON user_sessions(token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS user_audit_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS user_audit_events_target_created_at_idx
  ON user_audit_events(target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_audit_events_actor_created_at_idx
  ON user_audit_events(actor_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_verification_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_verification_tokens_user_idx
  ON user_verification_tokens(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS user_verification_tokens_active_idx
  ON user_verification_tokens(token_hash, expires_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS entra_companies (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS entra_companies_name_lower_idx
  ON entra_companies(LOWER(name));

CREATE INDEX IF NOT EXISTS entra_companies_status_idx
  ON entra_companies(status, created_at DESC);

CREATE TABLE IF NOT EXISTS entra_departments (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES entra_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS entra_departments_company_name_lower_idx
  ON entra_departments(company_id, LOWER(name));

CREATE INDEX IF NOT EXISTS entra_departments_company_status_idx
  ON entra_departments(company_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS entra_groups (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES entra_companies(id) ON DELETE CASCADE,
  department_id UUID REFERENCES entra_departments(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS entra_groups_scope_name_lower_idx
  ON entra_groups(company_id, COALESCE(department_id, '00000000-0000-0000-0000-000000000000'::uuid), LOWER(name));

CREATE INDEX IF NOT EXISTS entra_groups_company_department_status_idx
  ON entra_groups(company_id, department_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending_review', 'approved', 'archived')),
  source_chat_id UUID REFERENCES chats(id) ON DELETE SET NULL,
  source_message_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS knowledge_entries_status_created_at_idx
  ON knowledge_entries(status, created_at);

CREATE TABLE IF NOT EXISTS review_runs (
  id UUID PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  messages_reviewed INTEGER NOT NULL DEFAULT 0,
  knowledge_entries_created INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  context JSONB NOT NULL DEFAULT '{}'::jsonb
);
