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

INSERT INTO users (id, name, email, role, status, password_hash, password_updated_at)
SELECT seed.id, seed.name, seed.email, seed.role, 'active', seed.password_hash, NOW()
FROM (
  VALUES
    ('00000000-0000-4000-8000-000000000001'::uuid, 'admin', 'admin@example.com', 'owner', 'scrypt:e20a23cf6eb225c06473fcd731f39ee5:9ed8b8c51c5bdb7011be853fda0da20f7ab0568397199a6776375e161158edfa453b15098a08c79ccd78063bbc0c346975077ffb29e0470d3f0744de63756d5d'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'Admin User', 'site-admin@example.com', 'admin', 'scrypt:d91a13ce255f5da69f6ac821abf91b60:2861e4521e722e3d6f3ce97e96417b0b7578b8296f03a75e5b5ddce4d1b3c7c70773d3640d69450c301ddb09616acfa9e1dffc6e13b808b247e74b03f52fd9c6'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'Standard User', 'user@example.com', 'member', 'scrypt:a2f76653e0b315c55acfc9ed23f76737:a223a3133af3de2a10f7a727270ff5c456bda5795d4371efc4e69dd0bfae49bb88c66e2a3d66a7fe8d5a40c1ae6b62e9bf23db3d7ca255003f260dd107105981'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'Guest User', 'guest@example.com', 'viewer', 'scrypt:1b9805960061c67ab55898398607ff15:8b3ee8164736e4fc22594633eec8a2e96b85a8031a8839fc4b0e55f4561a6bbf6247d16b05d671504cd0ff1444e63b4149aaf736c7ac8e8c71ea89c972b83c99')
) AS seed(id, name, email, role, password_hash)
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE LOWER(users.email) = LOWER(seed.email)
);

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
