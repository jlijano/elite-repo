CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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
