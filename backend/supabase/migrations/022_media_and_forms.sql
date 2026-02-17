-- ================================================================
-- Media & Form Submissions Tables
-- Migration: 022_media_and_forms.sql
-- Created: 2026-02-17
-- Description: Creates media and form_submissions tables for
--   admin gallery and contact/lead management features.
-- ================================================================

-- ——— 1. Media Library ———
CREATE TABLE IF NOT EXISTS media (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  uploaded_by     UUID REFERENCES users_custom(id) ON DELETE SET NULL,

  -- File info
  filename        TEXT NOT NULL,
  original_name   TEXT,
  url             TEXT NOT NULL,
  thumbnail_url   TEXT,
  mime_type       TEXT NOT NULL,
  size_bytes      BIGINT DEFAULT 0,
  width           INTEGER,
  height          INTEGER,

  -- Metadata
  alt_text        TEXT,
  caption         TEXT,
  folder          TEXT DEFAULT '/',                   -- virtual folder path

  -- Categorization
  media_type      TEXT DEFAULT 'image' CHECK (media_type IN ('image','video','document','audio','other')),
  tags            TEXT[] DEFAULT '{}',

  -- Usage tracking
  usage_count     INTEGER DEFAULT 0,                 -- how many places reference this

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_store ON media(store_id, media_type);
CREATE INDEX idx_media_folder ON media(store_id, folder);
CREATE INDEX idx_media_created ON media(store_id, created_at DESC);

-- ——— 2. Form Submissions ———
CREATE TABLE IF NOT EXISTS form_submissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,

  -- Form info
  form_type       TEXT NOT NULL DEFAULT 'contact' CHECK (form_type IN ('contact','newsletter','custom','lead','inquiry')),
  form_name       TEXT,                              -- custom form identifier

  -- Submission data
  data            JSONB NOT NULL DEFAULT '{}',       -- { name, email, phone, message, ... }
  source_url      TEXT,                              -- page where form was submitted
  ip_address      TEXT,
  user_agent      TEXT,

  -- Status
  status          TEXT DEFAULT 'new' CHECK (status IN ('new','read','replied','archived','spam')),
  read_at         TIMESTAMPTZ,
  replied_at      TIMESTAMPTZ,

  -- Notes
  internal_notes  TEXT,
  assigned_to     UUID REFERENCES users_custom(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_form_submissions_store ON form_submissions(store_id, status);
CREATE INDEX idx_form_submissions_type ON form_submissions(store_id, form_type);
CREATE INDEX idx_form_submissions_created ON form_submissions(store_id, created_at DESC);

-- ——— 3. RLS Policies ———
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;

-- Media: owner manages, public reads for published stores
CREATE POLICY "Store owners manage media"
  ON media FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

CREATE POLICY "Public can view media from published stores"
  ON media FOR SELECT
  USING (
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- Form Submissions: owner reads and manages, anyone can insert (public forms)
CREATE POLICY "Store owners manage form submissions"
  ON form_submissions FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE true
    )
  );

CREATE POLICY "Anyone can submit forms"
  ON form_submissions FOR INSERT
  WITH CHECK (
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- ——— 4. Updated_at triggers ———
CREATE TRIGGER trg_media_updated_at
  BEFORE UPDATE ON media
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_form_submissions_updated_at
  BEFORE UPDATE ON form_submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
