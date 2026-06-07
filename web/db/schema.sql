CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE chats
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS chats_archived_updated_at_idx
  ON chats(archived_at, updated_at);

CREATE INDEX IF NOT EXISTS chats_anonymous_expires_at_idx
  ON chats(is_anonymous, expires_at);

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

CREATE TABLE IF NOT EXISTS system_change_log (
  id UUID PRIMARY KEY,
  action TEXT NOT NULL CHECK (action IN ('Added', 'Updated', 'Deleted')),
  module TEXT NOT NULL,
  summary TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'System',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS system_change_log_created_at_idx
  ON system_change_log(created_at DESC);

CREATE TABLE IF NOT EXISTS playground_boards (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playground_boards_status_updated_idx
  ON playground_boards(status, updated_at DESC);

CREATE TABLE IF NOT EXISTS playground_projects (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'in_progress', 'review', 'completed', 'archived')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  task_count INTEGER NOT NULL DEFAULT 0 CHECK (task_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE playground_projects
  ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS playground_projects_status_updated_idx
  ON playground_projects(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS playground_projects_board_updated_idx
  ON playground_projects(board_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS playground_tasks (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL,
  project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('backlog', 'todo', 'in_progress', 'review', 'done')),
  record_status TEXT NOT NULL DEFAULT 'active' CHECK (record_status IN ('active', 'archived')),
  category TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_label TEXT,
  due_date DATE,
  assignee_ids UUID[] NOT NULL DEFAULT '{}',
  custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE playground_tasks
  ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS record_status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS assignee_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS playground_tasks_status_updated_idx
  ON playground_tasks(record_status, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS playground_tasks_board_updated_idx
  ON playground_tasks(board_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS playground_tasks_project_updated_idx
  ON playground_tasks(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS playground_tasks_assignee_ids_idx
  ON playground_tasks USING GIN(assignee_ids);

CREATE TABLE IF NOT EXISTS playground_task_updates (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES playground_tasks(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'Admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playground_task_updates_task_created_idx
  ON playground_task_updates(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS playground_task_activity (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES playground_tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'Admin',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playground_task_activity_task_created_idx
  ON playground_task_activity(task_id, created_at DESC);

CREATE TABLE IF NOT EXISTS playground_notes (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL,
  project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE playground_notes
  ADD COLUMN IF NOT EXISTS board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES playground_projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS playground_notes_status_updated_idx
  ON playground_notes(status, updated_at DESC);

CREATE INDEX IF NOT EXISTS playground_notes_project_updated_idx
  ON playground_notes(project_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS playground_automations (
  id UUID PRIMARY KEY,
  board_id UUID REFERENCES playground_boards(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  trigger TEXT,
  action TEXT NOT NULL DEFAULT 'suggest' CHECK (action IN ('suggest', 'move_task', 'assign_owner', 'create_note', 'notify_admin')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'manual', 'active', 'paused', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS playground_automations_status_updated_idx
  ON playground_automations(status, updated_at DESC);
