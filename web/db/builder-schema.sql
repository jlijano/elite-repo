CREATE TABLE IF NOT EXISTS builder_pages (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_homepage BOOLEAN NOT NULL DEFAULT FALSE,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_version_id UUID,
  created_by_user_id UUID,
  updated_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS builder_page_drafts (
  page_id UUID PRIMARY KEY REFERENCES builder_pages(id) ON DELETE CASCADE,
  content JSONB NOT NULL DEFAULT '{"version":1,"blocks":[]}'::jsonb,
  autosave_content JSONB,
  updated_by_user_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builder_page_versions (
  id UUID PRIMARY KEY,
  page_id UUID NOT NULL REFERENCES builder_pages(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  content JSONB NOT NULL,
  seo JSONB NOT NULL DEFAULT '{}'::jsonb,
  rendered_html TEXT NOT NULL,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  published_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, version_number)
);

CREATE TABLE IF NOT EXISTS builder_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builder_media_assets (
  id UUID PRIMARY KEY,
  file_name TEXT NOT NULL,
  alt_text TEXT,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  content_url TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  usage_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS builder_forms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  form_type TEXT NOT NULL DEFAULT 'contact',
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builder_form_fields (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES builder_forms(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL,
  label TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS builder_form_submissions (
  id UUID PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES builder_forms(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builder_navigation_items (
  id UUID PRIMARY KEY,
  label TEXT NOT NULL,
  page_id UUID REFERENCES builder_pages(id) ON DELETE SET NULL,
  href TEXT,
  parent_id UUID,
  sort_order INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'published'
);

CREATE TABLE IF NOT EXISTS builder_audit_events (
  id UUID PRIMARY KEY,
  actor_user_id UUID,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS builder_pages_status_updated_idx ON builder_pages(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS builder_versions_page_created_idx ON builder_page_versions(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS builder_media_active_idx ON builder_media_assets(deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS builder_audit_created_idx ON builder_audit_events(created_at DESC);
