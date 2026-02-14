# LetBuyy Multi-Tenant Store Platform — Comprehensive Analysis

> **Part 4 of 7** | Blog System — Database Schema & Admin CRUD Wireframes
>
> **Date:** February 13, 2026 | **Version:** 3.0 (Blog-Integrated)
>
> **Prev:** [Part 3](./Analysis_Part3_Admin_Storefront_Deploy.md) (Admin & Storefront) | **Next:** [Part 5](./Analysis_Part5_Enhanced_Admin_Features.md) (Enhanced Admin)

---

## 19. Blog Database Schema — Complete SQL

> Sourced from **Comprehensive Plan** — Part 2: Database Schema & Blogger Tables

### 19.1 Entity Relationship Diagram — Blog System

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BLOG SYSTEM — ENTITY RELATIONSHIP DIAGRAM                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐         ┌──────────────┐                                      │
│  │  sites   │────1:1──│    blogs     │                                      │
│  └──────────┘         └──────┬───────┘                                      │
│                              │                                               │
│              ┌───────────────┼───────────────┐                               │
│              │               │               │                               │
│        ┌─────▼─────┐  ┌─────▼──────┐  ┌────▼─────────┐                     │
│        │blog_authors│  │blog_posts  │  │blog_categories│                     │
│        └─────┬─────┘  └──┬──┬──┬───┘  └──────────────┘                     │
│              │           │  │  │                                             │
│              │     ┌─────┘  │  └──────┐                                     │
│              │     │        │         │                                      │
│        ┌─────▼─────▼─┐ ┌───▼───┐ ┌───▼──────────┐                          │
│        │blog_comments│ │blog_  │ │blog_post_    │                           │
│        │  (threaded) │ │tags   │ │categories    │                           │
│        └─────────────┘ └───┬───┘ └──────────────┘                           │
│                            │                                                 │
│                       ┌────▼────────┐                                        │
│                       │blog_post_   │                                        │
│                       │tags         │                                        │
│                       └─────────────┘                                        │
│                                                                              │
│  CROSS-CUTTING TABLES:                                                       │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────┐                    │
│  │activity_logs │  │content_versions │  │media_library │                    │
│  │(audit trail) │  │(version history)│  │(centralized) │                    │
│  └──────────────┘  └─────────────────┘  └──────────────┘                    │
│                                                                              │
│  ENGAGEMENT TABLES:                                                          │
│  ┌──────────────┐  ┌─────────────────┐                                      │
│  │blog_reactions│  │blog_subscribers │                                      │
│  │(likes, claps)│  │(newsletter)     │                                      │
│  └──────────────┘  └─────────────────┘                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 19.2 Blogs Table (Parent Entity)

```sql
CREATE TABLE blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

  -- Blog Identity
  title VARCHAR(200) NOT NULL DEFAULT 'My Blog',
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,

  -- Settings
  posts_per_page INTEGER DEFAULT 10 CHECK (posts_per_page BETWEEN 1 AND 50),
  default_comment_status VARCHAR(20) DEFAULT 'open'
    CHECK (default_comment_status IN ('open', 'closed', 'approval_required')),
  date_format VARCHAR(30) DEFAULT 'MMMM DD, YYYY',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',

  -- SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  og_image_url TEXT,

  -- Layout & Theme
  layout VARCHAR(20) DEFAULT 'standard'
    CHECK (layout IN ('standard', 'magazine', 'minimal', 'grid')),
  sidebar_position VARCHAR(10) DEFAULT 'right'
    CHECK (sidebar_position IN ('left', 'right', 'none')),
  theme_settings JSONB DEFAULT '{}',
  custom_css TEXT,

  -- Social Links
  social_links JSONB DEFAULT '{}',

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_blog_per_site UNIQUE (site_id)
);

CREATE INDEX idx_blogs_site_id ON blogs(site_id);
```

### 19.3 Blog Posts Table (Core Content Entity)

```sql
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES blog_authors(id) ON DELETE RESTRICT,

  -- Content
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_html TEXT,       -- Pre-rendered HTML for performance
  excerpt TEXT,

  -- Media
  featured_image_url TEXT,
  featured_image_alt VARCHAR(200),

  -- Publishing
  status VARCHAR(20) DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  visibility VARCHAR(20) DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'password_protected')),
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,

  -- SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  focus_keyword VARCHAR(100),
  canonical_url TEXT,
  og_title VARCHAR(100),
  og_description VARCHAR(200),
  og_image_url TEXT,
  no_index BOOLEAN DEFAULT FALSE,

  -- Engagement Settings
  comment_status VARCHAR(20) DEFAULT 'open'
    CHECK (comment_status IN ('open', 'closed')),

  -- Metrics (denormalized for performance)
  view_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 0,

  -- Versioning
  version INTEGER DEFAULT 1,

  -- Pinning & Ordering
  is_pinned BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_post_slug_per_blog UNIQUE (blog_id, slug)
);

CREATE INDEX idx_blog_posts_blog_id ON blog_posts(blog_id);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_composite ON blog_posts(blog_id, status, published_at DESC);
```

### 19.4 Categories, Tags & Junction Tables

```sql
-- ============================================
-- CATEGORIES TABLE (Hierarchical taxonomy)
-- ============================================
CREATE TABLE blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,

  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7),       -- Hex color for badges
  icon VARCHAR(50),

  meta_title VARCHAR(70),
  meta_description VARCHAR(160),

  post_count INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_category_slug_per_blog UNIQUE (blog_id, slug)
);

-- ============================================
-- TAGS TABLE (Flat taxonomy)
-- ============================================
CREATE TABLE blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,

  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(7),

  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_tag_slug_per_blog UNIQUE (blog_id, slug)
);

-- ============================================
-- JUNCTION TABLES
-- ============================================
CREATE TABLE blog_post_categories (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  PRIMARY KEY (post_id, category_id)
);

CREATE TABLE blog_post_tags (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);
```

### 19.5 Comments Table (Threaded)

```sql
CREATE TABLE blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,

  -- Author (authenticated or guest)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(255),

  -- Content
  content TEXT NOT NULL,
  content_html TEXT,

  -- Moderation
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'spam', 'trash')),
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id),

  -- Threading
  depth INTEGER DEFAULT 0 CHECK (depth <= 5),
  thread_path TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);
```

### 19.6 Cross-Cutting Tables

```sql
-- ============================================
-- ACTIVITY LOGS TABLE (Audit trail)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  action VARCHAR(30) NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'publish', 'unpublish',
    'archive', 'restore', 'bulk_update', 'bulk_delete',
    'login', 'logout', 'settings_change', 'export', 'import'
  )),
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  entity_title VARCHAR(300),

  changes JSONB,
  metadata JSONB DEFAULT '{}',

  ip_address INET,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CONTENT VERSIONS TABLE
-- ============================================
CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,

  version_number INTEGER NOT NULL,
  title VARCHAR(300),
  content TEXT,
  snapshot JSONB NOT NULL,

  change_summary TEXT,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_version UNIQUE (entity_type, entity_id, version_number)
);

-- ============================================
-- MEDIA LIBRARY TABLE
-- ============================================
CREATE TABLE media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,

  width INTEGER,
  height INTEGER,
  thumbnail_url TEXT,
  blurhash VARCHAR(100),

  alt_text VARCHAR(200),
  caption TEXT,
  folder VARCHAR(200) DEFAULT '/',
  tags TEXT[] DEFAULT '{}',

  usage_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 20. RLS Policies — Blog System

```sql
-- ============================================
-- BLOGS: Owner can read/write their own blog
-- ============================================
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY blogs_select ON blogs FOR SELECT
  USING (site_id IN (
    SELECT id FROM sites WHERE user_id = auth.uid()
  ));

CREATE POLICY blogs_insert ON blogs FOR INSERT
  WITH CHECK (site_id IN (
    SELECT id FROM sites WHERE user_id = auth.uid()
  ));

CREATE POLICY blogs_update ON blogs FOR UPDATE
  USING (site_id IN (
    SELECT id FROM sites WHERE user_id = auth.uid()
  ));

-- ============================================
-- BLOG POSTS: Scoped to blog → site → user
-- ============================================
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY blog_posts_select ON blog_posts FOR SELECT
  USING (blog_id IN (
    SELECT b.id FROM blogs b
    JOIN sites s ON b.site_id = s.id
    WHERE s.user_id = auth.uid()
  ));

-- Similar INSERT, UPDATE, DELETE policies...

-- ============================================
-- COMMENTS: Public SELECT for published, owner can moderate
-- ============================================
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY blog_comments_public_select ON blog_comments FOR SELECT
  USING (
    status = 'approved'
    OR post_id IN (
      SELECT bp.id FROM blog_posts bp
      JOIN blogs b ON bp.blog_id = b.id
      JOIN sites s ON b.site_id = s.id
      WHERE s.user_id = auth.uid()
    )
  );

CREATE POLICY blog_comments_public_insert ON blog_comments FOR INSERT
  WITH CHECK (TRUE); -- Anyone can leave a comment (moderated)
```

---

## 21. Database Triggers & Functions

### 21.1 Auto Slug Generation

```sql
CREATE OR REPLACE FUNCTION generate_slug(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(input_text),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger: Auto-generate slug from title on insert
CREATE OR REPLACE FUNCTION blog_posts_auto_slug()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := generate_slug(NEW.title);
    -- Handle duplicates by appending counter
    WHILE EXISTS (
      SELECT 1 FROM blog_posts
      WHERE blog_id = NEW.blog_id AND slug = NEW.slug AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) LOOP
      NEW.slug := NEW.slug || '-' || FLOOR(RANDOM() * 1000)::TEXT;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_posts_auto_slug
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION blog_posts_auto_slug();
```

### 21.2 Reading Time Calculator

```sql
CREATE OR REPLACE FUNCTION calculate_reading_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count := ARRAY_LENGTH(
    REGEXP_SPLIT_TO_ARRAY(COALESCE(NEW.content, ''), '\s+'), 1
  );
  NEW.reading_time_minutes := GREATEST(1, CEIL(NEW.word_count / 250.0));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_posts_reading_time
  BEFORE INSERT OR UPDATE OF content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();
```

### 21.3 Auto Version Snapshot

```sql
CREATE OR REPLACE FUNCTION create_content_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content OR OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO content_versions (
      site_id, entity_type, entity_id, version_number,
      title, content, snapshot, changed_by
    ) VALUES (
      (SELECT site_id FROM blogs WHERE id = NEW.blog_id),
      'blog_post', NEW.id, NEW.version,
      OLD.title, OLD.content,
      row_to_json(OLD)::jsonb,
      auth.uid()
    );
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_posts_version
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION create_content_version();
```

---

## 22. Blog Admin CRUD — Wireframes

> Sourced from **Comprehensive Plan** — Part 4: Blogger Admin UI Wireframes

### 22.1 Posts List View

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  ┌───────────────┐                                                        ║
║  │  SIDEBAR      │    Posts (15)                          [+ New Post →]   ║
║  │               │                                                        ║
║  │  📊 Dashboard │    ┌─────────────────────────────────────────────────┐ ║
║  │  📝 Posts ◄── │    │ ☐  All (15) │ Published (12) │ Draft (2) │ ...  │ ║
║  │  📁 Categories│    └─────────────────────────────────────────────────┘ ║
║  │  🏷️ Tags      │                                                        ║
║  │  💬 Comments  │    🔍 [Search posts...          ]  [Filter ▼]  [⋯]   ║
║  │  🖼️ Media     │                                                        ║
║  │  📈 Analytics │    ┌─────────────────────────────────────────────────┐ ║
║  │  🎨 Theme     │    │ ☐ │ Title              │ Author  │ Status │ Date│ ║
║  │  ⚙️ Settings  │    ├───┼────────────────────┼─────────┼────────┼─────┤ ║
║  │               │    │ ☐ │ 10 Tips for UX     │ John    │●Publish│ 2/10│ ║
║  │               │    │ ☐ │ Getting Started... │ John    │○Draft  │ 2/09│ ║
║  │               │    │ ☐ │ React Best Practic │ Jane    │●Publish│ 2/08│ ║
║  │               │    │ ☐ │ TypeScript Deep... │ John    │◑Sched  │ 2/15│ ║
║  │               │    │ ☐ │ Building APIs...   │ Jane    │●Publish│ 2/07│ ║
║  │               │    └─────────────────────────────────────────────────┘ ║
║  │               │                                                        ║
║  │               │    ← 1 2 3 → (10 per page)                            ║
║  └───────────────┘                                                        ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 22.2 Post Editor (Tiptap Rich Text)

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │   New Post                        [Save Draft] [Preview]       ║
║          │                                    [Publish →]                 ║
║          │                                                                ║
║          │   ┌─────────────────────────────────────────────────────────┐  ║
║          │   │ Title                                                   │  ║
║          │   │ [Getting Started with Next.js 15                     ]  │  ║
║          │   │ Permalink: myblog.letbuyy.store/getting-started-...     │  ║
║          │   └─────────────────────────────────────────────────────────┘  ║
║          │                                                                ║
║          │   ┌─────────────────────────────────────────────────────────┐  ║
║          │   │ B I U S [H1▼] [Link] [Image] [</> Code] [Table] [...]  │  ║
║          │   ├─────────────────────────────────────────────────────────┤  ║
║          │   │                                                         │  ║
║          │   │ Next.js 15 introduces several groundbreaking features   │  ║
║          │   │ that revolutionize React development...                 │  ║
║          │   │                                                         │  ║
║          │   │ ## Key Features                                         │  ║
║          │   │ - Server Components                                     │  ║
║          │   │ - Improved routing                                      │  ║
║          │   │                                                         │  ║
║          │   └─────────────────────────────────────────────────────────┘  ║
║          │   📊 1,234 words • 6 min read   ✅ Auto-saved 2s ago          ║
║──────────┴──────────────────────────────────────────────────────────────  ║
║                                                                           ║
║  ┌─ RIGHT SIDEBAR ─────────────────────────────────────────────────────┐  ║
║  │ 📋 POST SETTINGS                                                    │  ║
║  │ Status: [Draft ▼]    Visibility: ○Public ●Private                   │  ║
║  │ Publish: ○Immediately ●Schedule [Feb 15, 2026 10:00 AM]            │  ║
║  ├──────────────────────────────────────────────────────────────────────┤  ║
║  │ 📁 CATEGORIES: ☑Web Dev  ☐JavaScript  ☑React  [+Add New]          │  ║
║  ├──────────────────────────────────────────────────────────────────────┤  ║
║  │ 🏷️ TAGS: [nextjs][react][server-components] [Add tags...]          │  ║
║  ├──────────────────────────────────────────────────────────────────────┤  ║
║  │ 🖼️ FEATURED IMAGE: [Set featured image]                             │  ║
║  ├──────────────────────────────────────────────────────────────────────┤  ║
║  │ 🔍 SEO                                                              │  ║
║  │ Meta Title: [Getting Started with Next.js 15 | MyBlog] 52/60 ✅    │  ║
║  │ Meta Desc:  [Learn about the new features...] 145/160 ✅           │  ║
║  │ Focus Keyword: [next.js 15]   SEO Score: 78/100 🟡                 │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════════╝
```

### 22.3 Categories Manager

```
╔═══════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │  Categories (8)                     [+ New Category]      ║
║          │                                                           ║
║          │  ┌────────────────────────────────────────────────────┐   ║
║          │  │ ▸ Web Development (5 posts)           [Edit][🗑]  │   ║
║          │  │   ├─ React (3 posts)                  [Edit][🗑]  │   ║
║          │  │   ├─ Next.js (2 posts)                [Edit][🗑]  │   ║
║          │  │   └─ TypeScript (1 post)              [Edit][🗑]  │   ║
║          │  │ ▸ DevOps (3 posts)                    [Edit][🗑]  │   ║
║          │  │   ├─ CI/CD (2 posts)                  [Edit][🗑]  │   ║
║          │  │   └─ Docker (1 post)                  [Edit][🗑]  │   ║
║          │  │ ▸ Career (2 posts)                    [Edit][🗑]  │   ║
║          │  │ ▸ Tutorials (4 posts)                 [Edit][🗑]  │   ║
║          │  └────────────────────────────────────────────────────┘   ║
║          │                                                           ║
║          │  ── Edit Category ─────────────────────────────────────   ║
║          │  Name:  [Web Development              ]                   ║
║          │  Slug:  web-development                                   ║
║          │  Parent: [None ▼]                                         ║
║          │  Color:  [🟣] Description: [Frontend & backend...]        ║
║          │  [Save Changes]                                           ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 22.4 Tags Manager

```
╔═══════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │  Tags (12)                            [+ New Tag]         ║
║          │                                                           ║
║          │  Tag Cloud:                                               ║
║          │  ┌────────────────────────────────────────────────────┐   ║
║          │  │ [react ×8] [nextjs ×6] [typescript ×5]            │   ║
║          │  │ [javascript ×4] [css ×3] [nodejs ×3]              │   ║
║          │  │ [docker ×2] [devops ×2] [testing ×2]              │   ║
║          │  │ [graphql ×1] [prisma ×1] [tailwind ×1]            │   ║
║          │  └────────────────────────────────────────────────────┘   ║
║          │                                                           ║
║          │  Tag List:                                                ║
║          │  ┌──────────┬───────┬───────────┬────────────┐           ║
║          │  │ Name     │ Posts │ Slug      │ Actions    │           ║
║          │  ├──────────┼───────┼───────────┼────────────┤           ║
║          │  │ react    │ 8     │ react     │ [✏][🗑]   │           ║
║          │  │ nextjs   │ 6     │ nextjs    │ [✏][🗑]   │           ║
║          │  │ typescr..│ 5     │ typescript│ [✏][🗑]   │           ║
║          │  └──────────┴───────┴───────────┴────────────┘           ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 22.5 Comment Moderation Queue

```
╔═══════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │  Comments (234)                       8 pending 🔴       ║
║          │                                                           ║
║          │  ┌─────────────────────────────────────────────────────┐  ║
║          │  │ Pending (8) │ Approved (220) │ Spam (6) │ All      │  ║
║          │  └─────────────────────────────────────────────────────┘  ║
║          │                                                           ║
║          │  ┌─────────────────────────────────────────────────────┐  ║
║          │  │ 👤 Sarah K.   on "10 Tips for Better UX"           │  ║
║          │  │ 2 minutes ago                                       │  ║
║          │  │                                                     │  ║
║          │  │ "Great article! I especially liked the part about   │  ║
║          │  │  micro-interactions. Could you elaborate on..."     │  ║
║          │  │                                                     │  ║
║          │  │ [✅ Approve] [🗑 Trash] [⛔ Spam] [↩ Reply]       │  ║
║          │  ├─────────────────────────────────────────────────────┤  ║
║          │  │ 👤 Anonymous   on "React Best Practices"           │  ║
║          │  │ 15 minutes ago                                      │  ║
║          │  │                                                     │  ║
║          │  │ "This is very helpful, thanks for sharing."        │  ║
║          │  │                                                     │  ║
║          │  │ [✅ Approve] [🗑 Trash] [⛔ Spam] [↩ Reply]       │  ║
║          │  └─────────────────────────────────────────────────────┘  ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 22.6 Media Library

```
╔═══════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │  Media Library (47 items)     [📤 Upload]  [☰ Grid│List] ║
║          │                                                           ║
║          │  🔍 [Search media...]  Folder: [All ▼]  Type: [All ▼]    ║
║          │                                                           ║
║          │  ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐      ║
║          │  │ 🖼    │ │ 🖼    │ │ 🖼    │ │ 🖼    │ │ 🖼    │      ║
║          │  │       │ │       │ │       │ │       │ │       │      ║
║          │  │ hero  │ │ blog1 │ │ prod1 │ │ team  │ │ bg    │      ║
║          │  │ .webp │ │ .jpg  │ │ .png  │ │ .jpg  │ │ .svg  │      ║
║          │  │ 240KB │ │ 180KB │ │ 95KB  │ │ 320KB │ │ 12KB  │      ║
║          │  └───────┘ └───────┘ └───────┘ └───────┘ └───────┘      ║
║          │                                                           ║
║          │  ── Selected: hero.webp ─────────────────────────────    ║
║          │  Alt text: [Hero banner image      ]                      ║
║          │  Caption:  [Welcome to my blog     ]                      ║
║          │  Size: 1920×1080 • 240KB • Uploaded Feb 10                ║
║          │  Used in: "10 Tips for Better UX" (featured image)        ║
║          │  URL: [📋 Copy URL]                                       ║
╚═══════════════════════════════════════════════════════════════════════╝
```

### 22.7 Blog Dashboard Overview

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  SIDEBAR │  Blog Dashboard                           [View Site →]        ║
║          │  Welcome back, John!                                           ║
║          │                                                                ║
║          │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐          ║
║          │  │ Views    │ │ Posts    │ │ Comments │ │ Visitors│          ║
║          │  │ 12,450   │ │ 15       │ │ 234      │ │ 3,421   │          ║
║          │  │ ↑24%     │ │ 2 drafts │ │ 8 pending│ │ ↑18%    │          ║
║          │  └──────────┘ └──────────┘ └──────────┘ └─────────┘          ║
║          │                                                                ║
║          │  Quick Actions                                                 ║
║          │  [+ New Post]  [💬 Moderate Comments]  [🎨 Customize Theme]   ║
║          │                                                                ║
║          │  Top Posts This Month        │  Recent Activity                ║
║          │  ┌──────────────┬──────┐    │  • New comment on "10..."  2m  ║
║          │  │ 10 Tips UX   │ 2,341│    │  • Post published         1h  ║
║          │  │ Getting Start│ 1,876│    │  • Comment approved        3h  ║
║          │  │ React Best   │ 1,543│    │  • New subscriber          5h  ║
║          │  └──────────────┴──────┘    │                                 ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

---

> **→ Continues in [Part 5](./Analysis_Part5_Enhanced_Admin_Features.md):**
> Bulk Actions, Command Palette (⌘K), Activity Logs, Saved Views, Version History, Notifications

---

> **Complete Series Navigation**
>
> | Part | Content |
> |------|--------|
> | [Part 1](./Analysis_Part1_Architecture_Database_DNS.md) | Architecture, Database Schema, DNS/SSL, Tech Stack |
> | [Part 2](./Analysis_Part2_Implementation_Onboarding_Email.md) | CSS System, Onboarding UI Wireframes, Email Templates |
> | [Part 3](./Analysis_Part3_Admin_Storefront_Deploy.md) | Admin Dashboard, Storefront, Dark Mode, Deployment |
> | **Part 4** (this) | Blog Database Schema, Admin CRUD Wireframes |
> | [Part 5](./Analysis_Part5_Enhanced_Admin_Features.md) | Bulk Actions, Command Palette, Activity Logs, Notifications |
> | [Part 6](./Analysis_Part6_Ecommerce_Enhancements.md) | Inventory, Multi-Currency, Tax, Shipping, Discounts |
> | [Part 7](./Analysis_Part7_Analytics_Performance_Deploy.md) | Analytics Dashboard, CI/CD, Performance, Security, Scaling |

