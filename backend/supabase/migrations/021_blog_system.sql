-- ================================================================
-- Blog System Tables
-- Migration: 021_blog_system.sql
-- Created: 2026-02-17
-- Description: Creates blog_posts, blog_categories, blog_tags,
--   and blog_post_tags tables for the blog content management
--   system used by blog and landing site types.
-- ================================================================

-- ——— 1. Blog Categories ———
CREATE TABLE IF NOT EXISTS blog_categories (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  parent_id       UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  display_order   INTEGER DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  post_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

CREATE INDEX idx_blog_categories_store ON blog_categories(store_id, parent_id);

-- ——— 2. Blog Tags ———
CREATE TABLE IF NOT EXISTS blog_tags (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  post_count      INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

CREATE INDEX idx_blog_tags_store ON blog_tags(store_id);

-- ——— 3. Blog Posts ———
CREATE TABLE IF NOT EXISTS blog_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  author_id       UUID REFERENCES users_custom(id) ON DELETE SET NULL,

  -- Content
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  excerpt         TEXT,
  content         TEXT,                              -- Markdown source
  content_html    TEXT,                              -- Rendered HTML for SSR/SEO
  featured_image  TEXT,

  -- Categorization
  category_id     UUID REFERENCES blog_categories(id) ON DELETE SET NULL,

  -- Status & Scheduling
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived','scheduled')),
  published_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,

  -- SEO
  seo_title       TEXT,
  seo_description TEXT,
  og_image_url    TEXT,
  canonical_url   TEXT,
  no_index        BOOLEAN DEFAULT false,

  -- Engagement
  view_count      INTEGER DEFAULT 0,
  comment_count   INTEGER DEFAULT 0,
  like_count      INTEGER DEFAULT 0,
  reading_time_min INTEGER,

  -- Settings
  allow_comments  BOOLEAN DEFAULT true,
  is_featured     BOOLEAN DEFAULT false,
  is_pinned       BOOLEAN DEFAULT false,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

CREATE INDEX idx_blog_posts_store ON blog_posts(store_id, status);
CREATE INDEX idx_blog_posts_category ON blog_posts(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_published ON blog_posts(store_id, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_blog_posts_featured ON blog_posts(store_id) WHERE is_featured = true AND status = 'published';

-- Full-text search on blog posts
CREATE INDEX idx_blog_posts_search ON blog_posts
  USING gin(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')));

-- ——— 4. Blog Post Tags (join table) ———
CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id         UUID REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  tag_id          UUID REFERENCES blog_tags(id) ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (post_id, tag_id)
);

-- ——— 5. Blog Comments ———
CREATE TABLE IF NOT EXISTS blog_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES sites(id) ON DELETE CASCADE NOT NULL,
  parent_id       UUID REFERENCES blog_comments(id) ON DELETE CASCADE,

  -- Author
  author_name     TEXT NOT NULL,
  author_email    TEXT,
  author_url      TEXT,
  user_id         UUID REFERENCES users_custom(id) ON DELETE SET NULL,

  -- Content
  body            TEXT NOT NULL,

  -- Moderation
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','spam','rejected')),
  moderated_at    TIMESTAMPTZ,

  -- Engagement
  like_count      INTEGER DEFAULT 0,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_comments_post ON blog_comments(post_id, status);
CREATE INDEX idx_blog_comments_store ON blog_comments(store_id, created_at DESC);

-- ——— 6. RLS Policies ———
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

-- Blog Categories: owner manages, public reads visible
CREATE POLICY "Store owners manage blog categories"
  ON blog_categories FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view visible blog categories"
  ON blog_categories FOR SELECT
  USING (
    is_visible = true AND
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- Blog Tags: owner manages, public reads
CREATE POLICY "Store owners manage blog tags"
  ON blog_tags FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view blog tags"
  ON blog_tags FOR SELECT
  USING (
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- Blog Posts: owner manages, public reads published
CREATE POLICY "Store owners manage blog posts"
  ON blog_posts FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view published blog posts"
  ON blog_posts FOR SELECT
  USING (
    status = 'published' AND
    store_id IN (SELECT id FROM sites WHERE status = 'published')
  );

-- Blog Post Tags: owner manages via post ownership
CREATE POLICY "Store owners manage blog post tags"
  ON blog_post_tags FOR ALL
  USING (
    post_id IN (
      SELECT bp.id FROM blog_posts bp
      JOIN sites s ON bp.store_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  )
  WITH CHECK (
    post_id IN (
      SELECT bp.id FROM blog_posts bp
      JOIN sites s ON bp.store_id = s.id
      WHERE s.user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view blog post tags"
  ON blog_post_tags FOR SELECT
  USING (
    post_id IN (
      SELECT id FROM blog_posts WHERE status = 'published'
    )
  );

-- Blog Comments: authenticated create, owner moderates, public reads approved
CREATE POLICY "Authenticated users create comments"
  ON blog_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    post_id IN (
      SELECT id FROM blog_posts WHERE status = 'published' AND allow_comments = true
    )
  );

CREATE POLICY "Store owners moderate comments"
  ON blog_comments FOR ALL
  USING (
    store_id IN (
      SELECT id FROM sites
      WHERE user_id = (SELECT id FROM users_custom WHERE auth_id = auth.uid())
    )
  );

CREATE POLICY "Public can view approved comments"
  ON blog_comments FOR SELECT
  USING (
    status = 'approved' AND
    post_id IN (
      SELECT id FROM blog_posts
      WHERE status = 'published' AND
      store_id IN (SELECT id FROM sites WHERE status = 'published')
    )
  );

-- ——— 7. Updated_at triggers ———
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_categories_updated_at
  BEFORE UPDATE ON blog_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_blog_comments_updated_at
  BEFORE UPDATE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
