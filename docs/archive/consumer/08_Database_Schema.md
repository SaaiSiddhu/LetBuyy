# LetBuyy Platform — Database Schema

> **Doc 08 of 17** | Complete Supabase PostgreSQL Schema — Tables, RLS Policies, Functions, Triggers & Migrations
>
> **Version:** 6.0 | **Date:** February 14, 2026
>
> **Prev:** [07 AI Features](./07_AI_Features.md) | **Next:** [09 API Reference](./09_API_Reference.md)

---

## Table of Contents

1. [Schema Overview](#1-schema-overview)
2. [Entity Relationship Diagram](#2-entity-relationship-diagram)
3. [Core Tables](#3-core-tables)
4. [Onboarding & Trial Tables](#4-onboarding--trial-tables)
5. [Product Tables](#5-product-tables)
6. [Inventory Tables](#6-inventory-tables)
7. [Customer Tables](#7-customer-tables)
8. [Order Tables](#8-order-tables)
9. [Payment Tables](#9-payment-tables)
10. [Coupon & Discount Tables](#10-coupon--discount-tables)
11. [Shipping Tables](#11-shipping-tables)
12. [Portfolio & Resume Tables](#12-portfolio--resume-tables)
13. [Blog & Landing Tables](#13-blog--landing-tables)
14. [AI & Credit Tables](#14-ai--credit-tables)
15. [Billing & Subscription Tables](#15-billing--subscription-tables)
16. [System Tables](#16-system-tables)
17. [Row-Level Security (RLS) Policies](#17-row-level-security-rls-policies)
18. [Database Functions & Triggers](#18-database-functions--triggers)
19. [Migration Strategy](#19-migration-strategy)
20. [Document History](#20-document-history)

---

## 1. Schema Overview

### 1.1 Database Statistics

| Metric | Value |
|---|---|
| **Database** | Supabase (PostgreSQL 15+) |
| **Auth Provider** | Supabase Auth (`auth.users`) |
| **Total Tables** | 45+ |
| **RLS Status** | Enabled on ALL user-facing tables |
| **Schemas** | `public` (application), `auth` (Supabase managed) |
| **Extensions Used** | `uuid-ossp`, `pgcrypto`, `pg_trgm`, `btree_gin` |
| **Naming Convention** | `snake_case` for tables/columns |
| **Default Timestamps** | `TIMESTAMPTZ DEFAULT NOW()` |
| **Primary Keys** | UUID v4 via `gen_random_uuid()` |
| **Soft Delete** | Via `status` column (never hard delete user content) |
| **Cascade Strategy** | `ON DELETE CASCADE` for owned resources |

### 1.2 Table Groups

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LETBUYY DATABASE SCHEMA                          │
│                         45+ Tables • 5 Groups                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  CORE (6 tables)               E-COMMERCE (18 tables)                   │
│  ├── user_profiles             ├── products                             │
│  ├── stores                    ├── product_options                      │
│  ├── store_surveys             ├── product_variants                     │
│  ├── themes                    ├── product_categories                   │
│  ├── pages                     ├── smart_collections                    │
│  └── custom_domains            ├── inventory_locations                  │
│                                ├── inventory_levels                     │
│  ONBOARDING (2 tables)         ├── inventory_adjustments                │
│  ├── onboarding_attempts       ├── customers                            │
│  └── onboarding_progress       ├── customer_addresses                   │
│                                ├── carts                                │
│  PORTFOLIO/RESUME (7 tables)   ├── cart_items                           │
│  ├── projects                  ├── wishlists                            │
│  ├── skills                    ├── orders                               │
│  ├── endorsements              ├── order_items                          │
│  ├── education                 ├── order_status_history                 │
│  ├── work_experience           ├── return_requests                      │
│  ├── resume_versions           └── reviews                              │
│  └── testimonials                                                       │
│                                PAYMENTS & BILLING (5 tables)            │
│  AI (5 tables)                 ├── payment_methods                      │
│  ├── ai_usage                  ├── payment_transactions                 │
│  ├── ai_content_cache          ├── subscriptions                        │
│  ├── ai_credits                ├── subscription_history                 │
│  ├── credit_transactions       └── invoices                             │
│  └── content_moderation                                                 │
│                                SYSTEM (7 tables)                        │
│  BLOG (3 tables)               ├── audit_logs                           │
│  ├── blog_posts                ├── notifications                        │
│  ├── blog_categories           ├── notification_preferences             │
│  └── blog_tags                 ├── form_submissions                     │
│                                ├── media                                │
│                                ├── coupons                              │
│                                └── shipping_zones / shipping_rates      │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Entity Relationship Diagram

### 2.1 Core & Auth Relationships

```
                              ┌─────────────────┐
                              │   auth.users     │
                              │─────────────────│
                              │ id (PK)         │
                              │ email           │
                              │ created_at      │
                              └────────┬────────┘
                                       │
                           ┌───────────┼───────────┐
                           │ 1:1       │ 1:N       │
                           ▼           │           ▼
                ┌──────────────────┐   │  ┌──────────────────┐
                │  user_profiles   │   │  │   notifications  │
                │──────────────────│   │  │──────────────────│
                │  id (PK/FK)      │   │  │  user_id (FK)    │
                │  full_name       │   │  │  store_id (FK)   │
                │  avatar_url      │   │  │  type, title     │
                │  phone           │   │  │  is_read         │
                └──────────────────┘   │  └──────────────────┘
                                       │
                              ┌────────┴────────┐
                              │     stores       │
                              │─────────────────│
                              │ id (PK)         │
                              │ user_id (FK)    │
                              │ subdomain       │
                              │ site_type       │
                              │ status          │
                              └────────┬────────┘
                                       │
       ┌──────────┬──────────┬────────┼────────┬──────────┬──────────┐
       │          │          │        │        │          │          │
       ▼          ▼          ▼        ▼        ▼          ▼          ▼
  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐ ┌──────┐ ┌───────┐ ┌───────┐
  │products│ │ orders │ │ pages  │ │media │ │ai_   │ │coupon │ │custom │
  │        │ │        │ │        │ │      │ │credit│ │s      │ │domain │
  └────────┘ └────────┘ └────────┘ └──────┘ └──────┘ └───────┘ └───────┘
```

### 2.2 E-Commerce Relationships

```
products ─┬── 1:N ── product_variants ── N:1 ── order_items
          ├── 1:N ── product_options
          ├── N:1 ── product_categories
          ├── 1:N ── inventory_levels ── N:1 ── inventory_locations
          ├── 1:N ── reviews
          └── N:N ── smart_collections (via rules/JSONB)

customers ─┬── 1:N ── customer_addresses
           ├── 1:N ── orders ─┬── 1:N ── order_items
           └── 1:N ── carts   │        ── 1:N ── order_status_history
                              └────── 1:N ── return_requests

orders ── N:1 ── coupons (via coupon_code)
orders ── 1:N ── payment_transactions
```

### 2.3 Portfolio & Resume Relationships

```
stores ─┬── 1:N ── projects ── 1:N ── project_media
        ├── 1:N ── skills ── 1:N ── endorsements
        ├── 1:N ── education
        ├── 1:N ── work_experience
        ├── 1:N ── resume_versions
        ├── 1:N ── testimonials
        └── 1:N ── blog_posts ── N:1 ── blog_categories
```

---

## 3. Core Tables

### 3.1 `user_profiles`

> Extends `auth.users` — 1:1 relationship via shared UUID primary key.

```sql
CREATE TABLE user_profiles (
  id              UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name       TEXT,
  avatar_url      TEXT,
  phone           TEXT,
  timezone        TEXT DEFAULT 'Asia/Kolkata',
  language        TEXT DEFAULT 'en',
  
  -- Onboarding
  onboarding_completed  BOOLEAN DEFAULT false,
  onboarding_step       INTEGER DEFAULT 0,        -- current step (0-6)
  
  -- Preferences
  email_notifications   BOOLEAN DEFAULT true,
  push_notifications    BOOLEAN DEFAULT true,
  marketing_emails      BOOLEAN DEFAULT false,
  
  -- Metadata
  last_login_at         TIMESTAMPTZ,
  login_count           INTEGER DEFAULT 0,
  referral_source       TEXT,                      -- 'google', 'social', 'direct'
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_onboarding ON user_profiles(onboarding_completed) WHERE onboarding_completed = false;
```

### 3.2 `stores`

> Central entity — every resource in the platform belongs to a store.

```sql
CREATE TABLE stores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  subdomain       TEXT NOT NULL UNIQUE,
  site_type       TEXT NOT NULL CHECK (site_type IN ('store','portfolio','resume','landing','blog')),
  description     TEXT,
  
  -- Branding
  logo_url        TEXT,
  favicon_url     TEXT,
  og_image_url    TEXT,
  brand_color     TEXT DEFAULT '#6366f1',         -- primary accent
  
  -- Domain
  custom_domain   TEXT UNIQUE,
  domain_verified BOOLEAN DEFAULT false,
  ssl_status      TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending','active','failed')),
  
  -- Currency & Locale
  currency        TEXT DEFAULT 'INR',
  locale          TEXT DEFAULT 'en-IN',
  tax_inclusive    BOOLEAN DEFAULT true,
  
  -- Status
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','unpublished','suspended')),
  published_at    TIMESTAMPTZ,
  
  -- Trial
  trial_started_at  TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at     TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  trial_status      TEXT DEFAULT 'active'
    CHECK (trial_status IN ('active','grace','frozen','cancelled','paid')),
  frozen_at         TIMESTAMPTZ,
  
  -- Settings (JSONB — flexible store-specific config)
  settings        JSONB DEFAULT '{
    "features": {},
    "social_links": {},
    "google_analytics_id": null,
    "meta_pixel_id": null,
    "whatsapp_number": null
  }',
  
  -- AI & Theme
  theme_id        UUID REFERENCES themes(id),
  industry        TEXT,                            -- for AI content tuning
  
  -- Counters (denormalized for performance)
  product_count   INTEGER DEFAULT 0,
  order_count     INTEGER DEFAULT 0,
  page_count      INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_user ON stores(user_id);
CREATE INDEX idx_stores_status ON stores(status, trial_status);
CREATE INDEX idx_stores_domain ON stores(custom_domain) WHERE custom_domain IS NOT NULL;
CREATE INDEX idx_stores_type ON stores(site_type);
```

### 3.3 `store_surveys`

> Captures onboarding survey answers for AI content personalization.

```sql
CREATE TABLE store_surveys (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Survey answers
  industry        TEXT,                            -- 'fashion', 'food', 'tech', etc.
  target_audience TEXT,                            -- 'B2C', 'B2B', 'Both'
  business_goal   TEXT,                            -- 'sell_products', 'showcase_work', etc.
  brand_tone      TEXT,                            -- 'professional', 'casual', 'luxury'
  team_size       TEXT,                            -- 'solo', '2-5', '6-20', '20+'
  revenue_range   TEXT,                            -- 'pre-revenue', '<1L', '1-10L', '10L+'
  
  -- Used by AI for content generation context
  additional_notes TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 `themes`

```sql
CREATE TABLE themes (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  site_type       TEXT NOT NULL,                   -- 'store', 'portfolio', 'resume', 'landing', 'blog'
  category        TEXT,                            -- 'modern', 'classic', 'minimal', 'bold'
  description     TEXT,
  
  -- Preview
  preview_url     TEXT,
  thumbnail_url   TEXT,
  
  -- Pricing
  is_premium      BOOLEAN DEFAULT false,
  price           NUMERIC(10,2) DEFAULT 0,
  
  -- Configuration (colors, fonts, layout)
  config          JSONB DEFAULT '{
    "colors": {
      "primary": "#6366f1",
      "secondary": "#8b5cf6",
      "background": "#ffffff",
      "text": "#1f2937",
      "accent": "#f59e0b"
    },
    "fonts": {
      "heading": "Inter",
      "body": "Inter"
    },
    "layout": {
      "headerStyle": "sticky",
      "footerStyle": "standard",
      "maxWidth": 1280
    },
    "darkMode": false
  }',
  
  -- Metadata
  author          TEXT DEFAULT 'LetBuyy',
  version         TEXT DEFAULT '1.0',
  is_active       BOOLEAN DEFAULT true,
  sort_order      INTEGER DEFAULT 0,
  install_count   INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_themes_type ON themes(site_type, is_active);
CREATE INDEX idx_themes_category ON themes(category);
```

### 3.5 `pages`

> Craft.js page builder output — each page serializes its component tree as JSONB.

```sql
CREATE TABLE pages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  
  -- Content
  content         JSONB DEFAULT '{}',              -- Craft.js serialized component tree
  content_html    TEXT,                             -- Server-rendered HTML (for SSR/SEO)
  
  -- Page type
  page_type       TEXT DEFAULT 'custom' CHECK (page_type IN ('home','about','contact','faq','terms','privacy','custom','blog_index')),
  is_homepage     BOOLEAN DEFAULT false,
  
  -- Status
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  
  -- SEO
  seo_title       TEXT,
  seo_description TEXT,
  og_image_url    TEXT,
  canonical_url   TEXT,
  no_index        BOOLEAN DEFAULT false,
  
  -- Ordering
  show_in_nav     BOOLEAN DEFAULT true,
  display_order   INTEGER DEFAULT 0,
  
  -- Versioning
  version         INTEGER DEFAULT 1,
  last_published_at TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- Indexes
CREATE INDEX idx_pages_store ON pages(store_id, status);
CREATE INDEX idx_pages_homepage ON pages(store_id) WHERE is_homepage = true;
```

### 3.6 `custom_domains`

```sql
CREATE TABLE custom_domains (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  domain          TEXT NOT NULL UNIQUE,
  
  -- Verification
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','verifying','active','failed','expired')),
  verification_token TEXT,
  verified_at     TIMESTAMPTZ,
  
  -- SSL
  ssl_status      TEXT DEFAULT 'pending' CHECK (ssl_status IN ('pending','provisioning','active','failed')),
  ssl_expires_at  TIMESTAMPTZ,
  
  -- DNS
  dns_configured  BOOLEAN DEFAULT false,
  cname_target    TEXT,                            -- e.g., 'cname.vercel-dns.com'
  
  -- Cloudflare
  cf_zone_id      TEXT,
  cf_dns_record_id TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE UNIQUE INDEX idx_domains_domain ON custom_domains(domain);
CREATE INDEX idx_domains_store ON custom_domains(store_id);
```

---

## 4. Onboarding & Trial Tables

### 4.1 `onboarding_attempts`

> Tracks each step of the onboarding wizard. See [03 Onboarding](./03_Onboarding_and_Trial.md) for flow details.

```sql
CREATE TABLE onboarding_attempts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Progress
  current_step    INTEGER DEFAULT 1,               -- 1-6
  completed_steps JSONB DEFAULT '[]',              -- [1, 2, 3] — completed step numbers
  
  -- Step data (captured as user progresses)
  site_type       TEXT,                            -- chosen at step 1
  store_name      TEXT,                            -- chosen at step 2
  subdomain       TEXT,                            -- auto-generated or chosen at step 2
  template_id     UUID,                            -- chosen at step 3
  survey_data     JSONB DEFAULT '{}',              -- step 4 survey answers
  
  -- Result
  status          TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed','abandoned')),
  store_id        UUID REFERENCES stores(id),       -- created store (set on completion)
  completed_at    TIMESTAMPTZ,
  abandoned_at    TIMESTAMPTZ,
  
  -- Timing
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Analytics
  device_type     TEXT,                            -- 'mobile', 'desktop', 'tablet'
  referral_source TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_onboarding_user ON onboarding_attempts(user_id, status);
CREATE INDEX idx_onboarding_abandoned ON onboarding_attempts(status, last_activity_at)
  WHERE status = 'in_progress';
```

### 4.2 `onboarding_progress`

> Per-step timing and error tracking for onboarding analytics.

```sql
CREATE TABLE onboarding_progress (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id      UUID REFERENCES onboarding_attempts(id) ON DELETE CASCADE NOT NULL,
  step_number     INTEGER NOT NULL,
  step_name       TEXT NOT NULL,                   -- 'choose_type', 'name_store', 'pick_template', etc.
  
  -- Timing
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,                          -- time spent on this step
  
  -- Data captured at this step
  step_data       JSONB DEFAULT '{}',
  
  -- Errors
  error_count     INTEGER DEFAULT 0,
  last_error      TEXT,
  
  UNIQUE(attempt_id, step_number)
);
```

---

## 5. Product Tables

### 5.1 `products`

> Central product entity. See [05 E-Commerce Engine](./05_Ecommerce_Engine.md) for full business logic.

```sql
CREATE TABLE products (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id          UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Basic info
  title             TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,                          -- plain text (for search)
  description_html  TEXT,                          -- rich text (for rendering)
  long_description  TEXT,                          -- AI-generated marketing copy
  
  -- Categorization
  category          TEXT,
  category_id       UUID REFERENCES product_categories(id),
  tags              TEXT[] DEFAULT '{}',
  product_type      TEXT DEFAULT 'physical' CHECK (product_type IN ('physical','digital','service')),
  
  -- Media
  images            TEXT[] DEFAULT '{}',            -- Cloudflare R2 URLs (ordered)
  thumbnail_url     TEXT,                          -- first image or auto-generated
  video_url         TEXT,
  
  -- Pricing
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  compare_at_price  NUMERIC(10,2),                 -- "was" price for discounts
  cost_per_item     NUMERIC(10,2),                 -- internal cost (margin calc)
  currency          TEXT DEFAULT 'INR',
  tax_rate          NUMERIC(5,2) DEFAULT 0,        -- GST percentage
  hsn_code          TEXT,                          -- Indian tax classification
  
  -- Identification
  sku               TEXT,
  barcode           TEXT,
  
  -- Inventory
  track_inventory   BOOLEAN DEFAULT true,
  stock_quantity    INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  allow_backorder   BOOLEAN DEFAULT false,
  
  -- Physical
  weight_grams      INTEGER,
  length_cm         NUMERIC(8,2),
  width_cm          NUMERIC(8,2),
  height_cm         NUMERIC(8,2),
  
  -- Digital product
  is_digital        BOOLEAN DEFAULT false,
  digital_file_url  TEXT,                          -- R2 signed URL for download
  download_limit    INTEGER,
  
  -- SEO
  seo_title         TEXT,
  seo_description   TEXT,
  canonical_url     TEXT,
  
  -- AI
  ai_generated      BOOLEAN DEFAULT false,         -- description was AI-generated
  ai_tags           TEXT[] DEFAULT '{}',            -- auto-generated tags
  
  -- Status
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','archived','out_of_stock')),
  
  -- Metrics (denormalized)
  total_sold        INTEGER DEFAULT 0,
  avg_rating        NUMERIC(3,2) DEFAULT 0,
  review_count      INTEGER DEFAULT 0,
  view_count        INTEGER DEFAULT 0,
  
  -- Ordering
  display_order     INTEGER DEFAULT 0,
  is_featured       BOOLEAN DEFAULT false,
  
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- Indexes
CREATE INDEX idx_products_store ON products(store_id, status);
CREATE INDEX idx_products_category ON products(store_id, category);
CREATE INDEX idx_products_category_id ON products(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_products_price ON products(store_id, price) WHERE status = 'active';
CREATE INDEX idx_products_featured ON products(store_id) WHERE is_featured = true AND status = 'active';
CREATE INDEX idx_products_sku ON products(sku) WHERE sku IS NOT NULL;

-- Full-text search
CREATE INDEX idx_products_search ON products
  USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(array_to_string(tags, ' '), '')));
```

### 5.2 `product_options`

> Options define the axes of variation (e.g., Size, Color). Variants are combinations of these options.

```sql
CREATE TABLE product_options (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,                   -- 'Size', 'Color', 'Material'
  position        INTEGER DEFAULT 0,               -- display order
  values          TEXT[] NOT NULL DEFAULT '{}',     -- ['S', 'M', 'L', 'XL']
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, name)
);
```

### 5.3 `product_variants`

```sql
CREATE TABLE product_variants (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id        UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  title             TEXT NOT NULL,                 -- 'S / Black', 'M / White'
  
  -- Options (up to 3 option axes)
  option1_name      TEXT,                          -- 'Size'
  option1_value     TEXT,                          -- 'S'
  option2_name      TEXT,                          -- 'Color'
  option2_value     TEXT,                          -- 'Black'
  option3_name      TEXT,
  option3_value     TEXT,
  
  -- Pricing (overrides product price if set)
  price             NUMERIC(10,2) NOT NULL,
  compare_at_price  NUMERIC(10,2),
  cost_per_item     NUMERIC(10,2),
  
  -- Identification
  sku               TEXT,
  barcode           TEXT,
  
  -- Inventory
  stock_quantity    INTEGER DEFAULT 0,
  track_inventory   BOOLEAN DEFAULT true,
  
  -- Physical
  weight_grams      INTEGER,
  
  -- Media
  image_url         TEXT,                          -- variant-specific image
  
  -- Status
  status            TEXT DEFAULT 'active' CHECK (status IN ('active','inactive')),
  position          INTEGER DEFAULT 0,
  
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
```

### 5.4 `product_categories`

> Hierarchical categories with parent-child relationships.

```sql
CREATE TABLE product_categories (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  
  -- Hierarchy
  parent_id       UUID REFERENCES product_categories(id) ON DELETE SET NULL,
  level           INTEGER DEFAULT 0,               -- 0 = root, 1 = child, etc.
  path            TEXT,                            -- materialized path: 'electronics/phones/smartphones'
  
  -- Display
  display_order   INTEGER DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  
  -- Counters
  product_count   INTEGER DEFAULT 0,               -- denormalized
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- Indexes
CREATE INDEX idx_categories_store ON product_categories(store_id, parent_id);
CREATE INDEX idx_categories_path ON product_categories(path);
```

### 5.5 `smart_collections`

> Auto-curated product collections based on rules (conditions-based filters).

```sql
CREATE TABLE smart_collections (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  image_url       TEXT,
  
  -- Rules (JSONB array of conditions)
  rules           JSONB DEFAULT '[]',
  -- Example: [
  --   {"field": "tags", "operator": "contains", "value": "summer"},
  --   {"field": "price", "operator": "less_than", "value": 500},
  --   {"field": "category", "operator": "equals", "value": "fashion"}
  -- ]
  match_type      TEXT DEFAULT 'all' CHECK (match_type IN ('all','any')),
  
  -- SEO
  seo_title       TEXT,
  seo_description TEXT,
  
  -- Display
  display_order   INTEGER DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);
```

### 5.6 `reviews`

```sql
CREATE TABLE reviews (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Review content
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title           TEXT,
  body            TEXT,
  
  -- Media
  images          TEXT[] DEFAULT '{}',              -- customer uploaded images
  
  -- Reviewer info
  reviewer_name   TEXT NOT NULL,
  reviewer_email  TEXT,
  is_verified     BOOLEAN DEFAULT false,           -- verified purchase
  
  -- Moderation
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','spam')),
  moderated_at    TIMESTAMPTZ,
  
  -- Helpful votes
  helpful_count   INTEGER DEFAULT 0,
  
  -- Store response
  store_reply     TEXT,
  replied_at      TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reviews_product ON reviews(product_id, status);
CREATE INDEX idx_reviews_store ON reviews(store_id, created_at DESC);
CREATE INDEX idx_reviews_rating ON reviews(product_id, rating) WHERE status = 'approved';
```

---

## 6. Inventory Tables

### 6.1 `inventory_locations`

> Multi-location inventory support for Business+ plans.

```sql
CREATE TABLE inventory_locations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,                   -- 'Main Warehouse', 'Retail Store'
  address         JSONB DEFAULT '{}',              -- {line1, line2, city, state, zip, country}
  is_default      BOOLEAN DEFAULT false,
  is_active       BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure one default per store
CREATE UNIQUE INDEX idx_inventory_loc_default ON inventory_locations(store_id) WHERE is_default = true;
```

### 6.2 `inventory_levels`

> Per-product, per-location stock tracking.

```sql
CREATE TABLE inventory_levels (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES inventory_locations(id) ON DELETE CASCADE NOT NULL,
  
  available       INTEGER DEFAULT 0,               -- sellable quantity
  committed       INTEGER DEFAULT 0,               -- reserved by orders
  damaged         INTEGER DEFAULT 0,               -- damaged/unsellable
  
  -- Safety stock
  reorder_point   INTEGER DEFAULT 10,              -- trigger reorder at this level
  reorder_qty     INTEGER DEFAULT 50,              -- suggested reorder quantity
  
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, variant_id, location_id)
);

-- Index for low stock alerts
CREATE INDEX idx_inventory_low ON inventory_levels(product_id, available)
  WHERE available <= 10;
```

### 6.3 `inventory_adjustments`

> Audit trail for every stock change (order, manual, import, return).

```sql
CREATE TABLE inventory_adjustments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id     UUID REFERENCES inventory_locations(id) ON DELETE CASCADE NOT NULL,
  
  -- Adjustment
  adjustment      INTEGER NOT NULL,                 -- positive = add, negative = remove
  previous_qty    INTEGER NOT NULL,
  new_qty         INTEGER NOT NULL,
  
  -- Reason
  reason          TEXT NOT NULL CHECK (reason IN (
    'sale', 'return', 'restock', 'manual_adjustment', 'damaged',
    'transfer', 'import', 'correction', 'reservation', 'cancellation'
  )),
  
  -- Reference
  reference_type  TEXT,                            -- 'order', 'return_request', 'manual'
  reference_id    UUID,                            -- FK to order, return, etc.
  
  -- Actor
  adjusted_by     UUID REFERENCES auth.users(id),
  notes           TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_adjustments_product ON inventory_adjustments(product_id, created_at DESC);
CREATE INDEX idx_adjustments_location ON inventory_adjustments(location_id, created_at DESC);
```

---

## 7. Customer Tables

### 7.1 `customers`

> Storefront customers (buyers) — separate from `auth.users` (store owners).

```sql
CREATE TABLE customers (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Identity
  email           TEXT NOT NULL,
  first_name      TEXT,
  last_name       TEXT,
  full_name       TEXT GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
  phone           TEXT,
  avatar_url      TEXT,
  
  -- Auth (optional — guests vs registered)
  auth_user_id    UUID,                            -- linked Supabase auth if registered
  is_guest        BOOLEAN DEFAULT true,
  
  -- Marketing
  accepts_marketing BOOLEAN DEFAULT false,
  marketing_opted_in_at TIMESTAMPTZ,
  
  -- Status
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','blocked','merged')),
  
  -- Metrics (denormalized)
  total_orders    INTEGER DEFAULT 0,
  total_spent     NUMERIC(12,2) DEFAULT 0,
  avg_order_value NUMERIC(10,2) DEFAULT 0,
  last_order_at   TIMESTAMPTZ,
  
  -- Tags
  tags            TEXT[] DEFAULT '{}',              -- 'vip', 'wholesale', 'returning'
  notes           TEXT,                             -- internal admin notes
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, email)
);

-- Indexes
CREATE INDEX idx_customers_store ON customers(store_id, created_at DESC);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_spent ON customers(store_id, total_spent DESC);
CREATE INDEX idx_customers_search ON customers
  USING gin(to_tsvector('english', COALESCE(first_name, '') || ' ' || COALESCE(last_name, '') || ' ' || email));
```

### 7.2 `customer_addresses`

```sql
CREATE TABLE customer_addresses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  
  -- Address
  first_name      TEXT,
  last_name       TEXT,
  company         TEXT,
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state           TEXT,
  zip_code        TEXT,
  country         TEXT NOT NULL DEFAULT 'IN',
  phone           TEXT,
  
  -- Type
  is_default_shipping BOOLEAN DEFAULT false,
  is_default_billing  BOOLEAN DEFAULT false,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_addresses_customer ON customer_addresses(customer_id);
```

### 7.3 `carts`

> Persistent cart with TTL. Abandoned carts trigger recovery emails.

```sql
CREATE TABLE carts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Guest identifier (for non-logged-in users)
  session_id      TEXT,
  
  -- Status
  status          TEXT DEFAULT 'active' CHECK (status IN ('active','abandoned','converted','expired')),
  
  -- Totals (denormalized for fast checkout display)
  item_count      INTEGER DEFAULT 0,
  subtotal        NUMERIC(10,2) DEFAULT 0,
  
  -- Recovery
  recovery_email_sent BOOLEAN DEFAULT false,
  recovery_sent_at    TIMESTAMPTZ,
  recovered       BOOLEAN DEFAULT false,
  
  -- Coupon
  coupon_code     TEXT,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  
  -- Conversion
  order_id        UUID,                            -- set when cart converts to order
  converted_at    TIMESTAMPTZ,
  
  -- TTL
  expires_at      TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_carts_store ON carts(store_id, status);
CREATE INDEX idx_carts_customer ON carts(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX idx_carts_session ON carts(session_id) WHERE session_id IS NOT NULL;
CREATE INDEX idx_carts_abandoned ON carts(store_id, updated_at)
  WHERE status = 'active' AND updated_at < NOW() - INTERVAL '1 hour';
```

### 7.4 `cart_items`

```sql
CREATE TABLE cart_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id         UUID REFERENCES carts(id) ON DELETE CASCADE NOT NULL,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price      NUMERIC(10,2) NOT NULL,
  
  -- Snapshot (prices at time of add, in case product price changes)
  title           TEXT NOT NULL,
  variant_title   TEXT,
  image_url       TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cart_id, product_id, variant_id)
);
```

### 7.5 `wishlists`

```sql
CREATE TABLE wishlists (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
  product_id      UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, product_id, variant_id)
);

-- Index
CREATE INDEX idx_wishlists_customer ON wishlists(customer_id, created_at DESC);
```

---

## 8. Order Tables

### 8.1 `orders`

```sql
CREATE TABLE orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Order number (human-readable, per-store sequential)
  order_number    TEXT NOT NULL,                    -- 'ORD-1001', auto-generated
  
  -- Customer info (snapshot at time of order)
  customer_email  TEXT NOT NULL,
  customer_name   TEXT,
  customer_phone  TEXT,
  
  -- Addresses (JSONB snapshots — immutable after order placed)
  shipping_address JSONB,
  billing_address  JSONB,
  
  -- Line item totals
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_cost   NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount      NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency        TEXT DEFAULT 'INR',
  
  -- Order status
  status          TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','processing','shipped','out_for_delivery','delivered','completed','cancelled','refunded')),
  
  -- Payment
  payment_status  TEXT DEFAULT 'pending'
    CHECK (payment_status IN ('pending','authorized','paid','partially_paid','refunded','partially_refunded','failed','voided')),
  payment_provider TEXT,                           -- 'razorpay', 'stripe', 'cod'
  payment_id      TEXT,                            -- provider transaction ID
  paid_at         TIMESTAMPTZ,
  
  -- Shipping
  shipping_method TEXT,
  shipping_provider TEXT,                          -- 'delhivery', 'shiprocket', 'custom'
  tracking_number TEXT,
  tracking_url    TEXT,
  shipped_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  expected_delivery_at TIMESTAMPTZ,
  
  -- Fulfillment
  fulfillment_status TEXT DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN ('unfulfilled','partially_fulfilled','fulfilled')),
  
  -- Coupons
  coupon_code     TEXT,
  coupon_id       UUID REFERENCES coupons(id),
  
  -- AI
  fraud_score     INTEGER DEFAULT 0,               -- 0-100 from AI fraud detection
  fraud_flags     TEXT[] DEFAULT '{}',
  
  -- Notes
  notes           TEXT,                            -- internal admin notes
  customer_notes  TEXT,                            -- customer-provided notes
  
  -- Cart reference
  cart_id         UUID,
  
  -- Cancellation / refund
  cancelled_at    TIMESTAMPTZ,
  cancel_reason   TEXT,
  refunded_at     TIMESTAMPTZ,
  refund_amount   NUMERIC(10,2),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_orders_store ON orders(store_id, created_at DESC);
CREATE INDEX idx_orders_status ON orders(store_id, status);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_orders_payment ON orders(store_id, payment_status);
CREATE INDEX idx_orders_number ON orders(store_id, order_number);
CREATE INDEX idx_orders_date ON orders(store_id, created_at);
```

### 8.2 `order_items`

```sql
CREATE TABLE order_items (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id      UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id      UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  
  -- Snapshot at time of order (immutable)
  title           TEXT NOT NULL,
  variant_title   TEXT,
  sku             TEXT,
  image_url       TEXT,
  
  -- Pricing
  quantity        INTEGER NOT NULL DEFAULT 1,
  unit_price      NUMERIC(10,2) NOT NULL,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  tax_amount      NUMERIC(10,2) DEFAULT 0,
  total_price     NUMERIC(10,2) NOT NULL,
  
  -- Fulfillment
  fulfilled_qty   INTEGER DEFAULT 0,
  fulfillment_status TEXT DEFAULT 'unfulfilled'
    CHECK (fulfillment_status IN ('unfulfilled','partially_fulfilled','fulfilled')),
  
  -- Weight (for shipping calculation)
  weight_grams    INTEGER,
  
  -- Digital
  is_digital      BOOLEAN DEFAULT false,
  download_url    TEXT,
  download_count  INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
```

### 8.3 `order_status_history`

> Audit trail for every status change on an order.

```sql
CREATE TABLE order_status_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  
  changed_by      UUID REFERENCES auth.users(id),  -- null = system
  change_reason   TEXT,
  
  -- Notification sent?
  customer_notified BOOLEAN DEFAULT false,
  notification_type TEXT,                          -- 'email', 'sms', 'push'
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_order_history ON order_status_history(order_id, created_at DESC);
```

### 8.4 `return_requests`

```sql
CREATE TABLE return_requests (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id        UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  
  -- Request
  reason          TEXT NOT NULL CHECK (reason IN (
    'defective', 'wrong_item', 'not_as_described', 'too_late',
    'changed_mind', 'better_price', 'other'
  )),
  description     TEXT,
  images          TEXT[] DEFAULT '{}',              -- evidence photos
  
  -- Items
  items           JSONB NOT NULL DEFAULT '[]',
  -- [{ "order_item_id": "...", "quantity": 1, "reason": "defective" }]
  
  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'shipped_back',
    'received', 'refunded', 'exchanged', 'cancelled'
  )),
  
  -- Resolution
  refund_amount   NUMERIC(10,2),
  refund_method   TEXT,                            -- 'original_payment', 'store_credit'
  resolved_by     UUID REFERENCES auth.users(id),
  resolved_at     TIMESTAMPTZ,
  admin_notes     TEXT,
  
  -- Return shipping
  return_tracking_number TEXT,
  return_tracking_url    TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_returns_order ON return_requests(order_id);
CREATE INDEX idx_returns_store ON return_requests(store_id, status, created_at DESC);
```

---

## 9. Payment Tables

### 9.1 `payment_methods`

> Saved payment methods per store (for accepting payments from customers).

```sql
CREATE TABLE payment_methods (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Provider
  provider        TEXT NOT NULL CHECK (provider IN ('razorpay','stripe','paypal','cod','bank_transfer')),
  
  -- Credentials (encrypted)
  provider_config JSONB DEFAULT '{}',
  -- Razorpay: { "key_id": "rzp_...", "key_secret": "encrypted_..." }
  -- Stripe: { "publishable_key": "pk_...", "secret_key": "encrypted_..." }
  
  -- Status
  is_active       BOOLEAN DEFAULT true,
  is_default      BOOLEAN DEFAULT false,
  is_test_mode    BOOLEAN DEFAULT true,
  
  -- Supported methods
  supports_upi    BOOLEAN DEFAULT false,
  supports_cards  BOOLEAN DEFAULT true,
  supports_netbanking BOOLEAN DEFAULT false,
  supports_wallets BOOLEAN DEFAULT false,
  supports_cod    BOOLEAN DEFAULT false,
  
  -- Verification
  verified        BOOLEAN DEFAULT false,
  verified_at     TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_methods_store ON payment_methods(store_id, is_active);
CREATE UNIQUE INDEX idx_payment_default ON payment_methods(store_id) WHERE is_default = true;
```

### 9.2 `payment_transactions`

> Every payment attempt, success, or failure is logged here.

```sql
CREATE TABLE payment_transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  -- Provider
  provider        TEXT NOT NULL,                   -- 'razorpay', 'stripe', 'cod'
  provider_transaction_id TEXT,                    -- 'pay_Lz123abc', 'pi_3N...'
  provider_order_id       TEXT,                    -- 'order_Lz123abc'
  
  -- Amount
  amount          NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'INR',
  
  -- Status
  status          TEXT NOT NULL CHECK (status IN (
    'created', 'authorized', 'captured', 'failed',
    'refunded', 'partially_refunded', 'voided', 'expired'
  )),
  
  -- Type
  type            TEXT DEFAULT 'payment' CHECK (type IN ('payment','refund','partial_refund')),
  
  -- Method details
  payment_method  TEXT,                            -- 'upi', 'card', 'netbanking', 'wallet', 'cod'
  card_last_four  TEXT,
  card_brand      TEXT,                            -- 'visa', 'mastercard'
  upi_id          TEXT,
  bank_name       TEXT,
  wallet_name     TEXT,
  
  -- Error
  error_code      TEXT,
  error_message   TEXT,
  
  -- Webhook
  webhook_received BOOLEAN DEFAULT false,
  webhook_payload  JSONB,
  
  -- Refund
  refund_id       TEXT,
  refund_amount   NUMERIC(10,2),
  refund_reason   TEXT,
  
  -- Timestamps
  authorized_at   TIMESTAMPTZ,
  captured_at     TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_txn_store ON payment_transactions(store_id, created_at DESC);
CREATE INDEX idx_txn_order ON payment_transactions(order_id);
CREATE INDEX idx_txn_provider ON payment_transactions(provider, provider_transaction_id);
CREATE INDEX idx_txn_status ON payment_transactions(store_id, status);
```

---

## 10. Coupon & Discount Tables

### 10.1 `coupons`

```sql
CREATE TABLE coupons (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Code
  code            TEXT NOT NULL,                   -- 'SUMMER20', 'WELCOME10'
  
  -- Discount type
  type            TEXT NOT NULL CHECK (type IN ('percentage','fixed_amount','free_shipping','buy_x_get_y')),
  value           NUMERIC(10,2) NOT NULL,          -- 20 (for 20%) or 100 (for ₹100 off)
  
  -- Limits
  min_order_value NUMERIC(10,2),                   -- minimum cart total
  max_discount    NUMERIC(10,2),                   -- cap on discount amount
  usage_limit     INTEGER,                         -- total uses across all customers
  per_customer_limit INTEGER DEFAULT 1,            -- max uses per customer
  used_count      INTEGER DEFAULT 0,               -- current usage
  
  -- Applicability
  applies_to      TEXT DEFAULT 'all' CHECK (applies_to IN ('all','specific_products','specific_categories','specific_customers')),
  applicable_ids  UUID[] DEFAULT '{}',             -- product/category/customer IDs
  
  -- BOGO config
  bogo_config     JSONB,
  -- { "buy_quantity": 2, "get_quantity": 1, "get_product_id": null, "get_discount_pct": 100 }
  
  -- Schedule
  starts_at       TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,
  
  -- Metadata
  description     TEXT,
  is_active       BOOLEAN DEFAULT true,
  is_automatic    BOOLEAN DEFAULT false,           -- auto-apply at checkout
  
  -- First-order-only
  first_order_only BOOLEAN DEFAULT false,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, code)
);

-- Indexes
CREATE INDEX idx_coupons_store ON coupons(store_id, is_active);
CREATE INDEX idx_coupons_active ON coupons(store_id, code) WHERE is_active = true;
CREATE INDEX idx_coupons_auto ON coupons(store_id) WHERE is_automatic = true AND is_active = true;
CREATE INDEX idx_coupons_expiry ON coupons(expires_at) WHERE expires_at IS NOT NULL;
```

### 10.2 `coupon_usage`

> Tracks per-customer coupon usage for enforcing `per_customer_limit`.

```sql
CREATE TABLE coupon_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  coupon_id       UUID REFERENCES coupons(id) ON DELETE CASCADE NOT NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_email  TEXT NOT NULL,
  order_id        UUID REFERENCES orders(id) ON DELETE SET NULL,
  
  discount_applied NUMERIC(10,2) NOT NULL,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coupon_id, order_id)
);

-- Index
CREATE INDEX idx_coupon_usage ON coupon_usage(coupon_id, customer_email);
```

---

## 11. Shipping Tables

### 11.1 `shipping_zones`

```sql
CREATE TABLE shipping_zones (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,                   -- 'India - Metro Cities', 'International'
  
  -- Geographic scope
  countries       TEXT[] DEFAULT '{"IN"}',          -- ISO country codes
  states          TEXT[] DEFAULT '{}',              -- state/province codes
  zip_codes       TEXT[] DEFAULT '{}',              -- specific zip codes or ranges
  
  -- Priority (higher = checked first)
  priority        INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_shipping_zones_store ON shipping_zones(store_id, is_active);
```

### 11.2 `shipping_rates`

```sql
CREATE TABLE shipping_rates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id         UUID REFERENCES shipping_zones(id) ON DELETE CASCADE NOT NULL,
  
  -- Rate info
  name            TEXT NOT NULL,                   -- 'Standard Delivery', 'Express', 'Same Day'
  description     TEXT,
  
  -- Type
  type            TEXT NOT NULL CHECK (type IN ('flat','weight_based','price_based','free','calculated')),
  
  -- Flat rate
  price           NUMERIC(10,2),
  
  -- Free shipping threshold
  min_order_for_free NUMERIC(10,2),                -- free if cart ≥ this amount
  
  -- Weight-based tiers
  weight_rates    JSONB,
  -- [
  --   { "min_grams": 0, "max_grams": 500, "price": 40 },
  --   { "min_grams": 501, "max_grams": 1000, "price": 60 },
  --   { "min_grams": 1001, "max_grams": null, "price_per_kg": 30 }
  -- ]
  
  -- Estimated delivery
  estimated_days_min INTEGER,
  estimated_days_max INTEGER,
  
  -- Display
  display_order   INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_shipping_rates_zone ON shipping_rates(zone_id, is_active);
```

---

## 12. Portfolio & Resume Tables

> See [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) for full business logic and UI wireframes.

### 12.1 `projects`

```sql
CREATE TABLE projects (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Content
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  short_description TEXT,
  long_description TEXT,                           -- markdown or HTML
  
  -- Media
  cover_image_url TEXT,
  images          TEXT[] DEFAULT '{}',
  video_url       TEXT,
  live_url        TEXT,                            -- link to live project
  source_url      TEXT,                            -- GitHub link
  
  -- Categorization
  category        TEXT,                            -- 'web', 'mobile', 'design', etc.
  tags            TEXT[] DEFAULT '{}',
  technologies    TEXT[] DEFAULT '{}',              -- 'React', 'Node.js', 'Figma'
  
  -- Timeline
  start_date      DATE,
  end_date        DATE,
  is_ongoing      BOOLEAN DEFAULT false,
  
  -- Client info (optional)
  client_name     TEXT,
  client_logo_url TEXT,
  
  -- Status & display
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  is_featured     BOOLEAN DEFAULT false,
  display_order   INTEGER DEFAULT 0,
  
  -- AI
  ai_generated    BOOLEAN DEFAULT false,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- Indexes
CREATE INDEX idx_projects_store ON projects(store_id, status, display_order);
CREATE INDEX idx_projects_featured ON projects(store_id) WHERE is_featured = true AND status = 'published';
```

### 12.2 `skills`

```sql
CREATE TABLE skills (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  name            TEXT NOT NULL,
  category        TEXT,                            -- 'frontend', 'backend', 'design', 'soft_skills'
  proficiency     INTEGER DEFAULT 70 CHECK (proficiency >= 0 AND proficiency <= 100),
  icon_name       TEXT,                            -- icon identifier
  color           TEXT,                            -- badge color
  years_exp       NUMERIC(3,1),                    -- 3.5 years
  
  is_featured     BOOLEAN DEFAULT false,
  display_order   INTEGER DEFAULT 0,
  
  -- Endorsements count (denormalized)
  endorsement_count INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_skills_store ON skills(store_id, category, display_order);
```

### 12.3 `endorsements`

```sql
CREATE TABLE endorsements (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  skill_id        UUID REFERENCES skills(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Endorser
  endorser_name   TEXT NOT NULL,
  endorser_title  TEXT,
  endorser_company TEXT,
  endorser_avatar TEXT,
  endorser_email  TEXT,
  
  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_endorsements_skill ON endorsements(skill_id, status);
```

### 12.4 `education`

```sql
CREATE TABLE education (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  institution     TEXT NOT NULL,
  institution_logo TEXT,
  degree          TEXT NOT NULL,                   -- 'B.Tech', 'MBA', 'M.Sc'
  field_of_study  TEXT,                            -- 'Computer Science'
  
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT false,
  
  grade           TEXT,                            -- '8.5 GPA', 'First Class'
  description     TEXT,
  activities      TEXT[] DEFAULT '{}',
  
  display_order   INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_education_store ON education(store_id, display_order);
```

### 12.5 `work_experience`

```sql
CREATE TABLE work_experience (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  company         TEXT NOT NULL,
  company_logo    TEXT,
  company_url     TEXT,
  role_title      TEXT NOT NULL,
  employment_type TEXT CHECK (employment_type IN ('full_time','part_time','contract','freelance','internship')),
  location        TEXT,
  is_remote       BOOLEAN DEFAULT false,
  
  start_date      DATE NOT NULL,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT false,
  
  -- Bullet points (array for AI improvement)
  bullets         TEXT[] DEFAULT '{}',
  description     TEXT,                            -- alternative free-form description
  
  -- Skills used in this role
  skills_used     TEXT[] DEFAULT '{}',
  
  -- AI
  ai_improved     BOOLEAN DEFAULT false,
  original_bullets TEXT[] DEFAULT '{}',             -- pre-AI bullets for comparison
  
  display_order   INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_experience_store ON work_experience(store_id, display_order);
```

### 12.6 `resume_versions`

```sql
CREATE TABLE resume_versions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Version info
  version_number  INTEGER NOT NULL,
  name            TEXT NOT NULL,                   -- 'Default', 'Tech Resume', 'Creative'
  
  -- Template
  template_id     TEXT NOT NULL DEFAULT 'classic',
  
  -- Content snapshot (all resume data at this point)
  content         JSONB NOT NULL DEFAULT '{}',
  -- {
  --   "summary": "...",
  --   "experience": [...],
  --   "education": [...],
  --   "skills": [...],
  --   "projects": [...]
  -- }
  
  -- Customization
  settings        JSONB DEFAULT '{}',
  -- {
  --   "accentColor": "#6366f1",
  --   "fontSize": 11,
  --   "fontFamily": "Inter",
  --   "pageMargin": 24,
  --   "showPhoto": true
  -- }
  
  -- Generated files
  pdf_url         TEXT,
  docx_url        TEXT,
  
  -- ATS
  ats_score       INTEGER,                         -- 0-100
  ats_analysis    JSONB,                           -- full AI analysis result
  target_role     TEXT,
  target_industry TEXT,
  
  -- Status
  is_active       BOOLEAN DEFAULT true,
  is_default      BOOLEAN DEFAULT false,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, version_number)
);

-- Index
CREATE INDEX idx_resume_store ON resume_versions(store_id, is_active);
```

### 12.7 `testimonials`

```sql
CREATE TABLE testimonials (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Author
  author_name     TEXT NOT NULL,
  author_title    TEXT,
  author_company  TEXT,
  author_avatar   TEXT,
  author_email    TEXT,
  
  -- Content
  content         TEXT NOT NULL,
  rating          INTEGER CHECK (rating >= 1 AND rating <= 5),
  
  -- Relationship
  relationship    TEXT,                            -- 'client', 'colleague', 'manager', 'mentor'
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  
  -- Request tracking
  request_sent_at TIMESTAMPTZ,
  request_token   TEXT,                            -- for email-based submission
  
  -- Status
  status          TEXT DEFAULT 'pending' CHECK (status IN ('requested','pending','approved','rejected')),
  is_featured     BOOLEAN DEFAULT false,
  display_order   INTEGER DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_testimonials_store ON testimonials(store_id, status, display_order);
```

---

## 13. Blog & Landing Tables

### 13.1 `blog_posts`

```sql
CREATE TABLE blog_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Content
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  excerpt         TEXT,                            -- 1-2 sentence preview
  content         TEXT,                            -- markdown body
  content_html    TEXT,                            -- rendered HTML
  
  -- Media
  cover_image_url TEXT,
  og_image_url    TEXT,
  
  -- Author
  author_id       UUID REFERENCES auth.users(id),
  author_name     TEXT,
  author_avatar   TEXT,
  
  -- Categorization
  category_id     UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  tags            TEXT[] DEFAULT '{}',
  
  -- SEO
  seo_title       TEXT,
  seo_description TEXT,
  canonical_url   TEXT,
  
  -- Status
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled','archived')),
  published_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  
  -- AI
  ai_generated    BOOLEAN DEFAULT false,
  reading_time_min INTEGER,                        -- estimated reading time
  
  -- Metrics
  view_count      INTEGER DEFAULT 0,
  like_count      INTEGER DEFAULT 0,
  share_count     INTEGER DEFAULT 0,
  comment_count   INTEGER DEFAULT 0,
  
  -- Featured
  is_featured     BOOLEAN DEFAULT false,
  is_pinned       BOOLEAN DEFAULT false,
  
  -- Comments
  allow_comments  BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- Indexes
CREATE INDEX idx_blog_store ON blog_posts(store_id, status, published_at DESC);
CREATE INDEX idx_blog_category ON blog_posts(category_id) WHERE category_id IS NOT NULL;
CREATE INDEX idx_blog_featured ON blog_posts(store_id) WHERE is_featured = true AND status = 'published';
CREATE INDEX idx_blog_search ON blog_posts
  USING gin(to_tsvector('english', title || ' ' || COALESCE(excerpt, '') || ' ' || COALESCE(content, '')));
```

### 13.2 `blog_categories`

```sql
CREATE TABLE blog_categories (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  color           TEXT DEFAULT '#6366f1',
  
  display_order   INTEGER DEFAULT 0,
  post_count      INTEGER DEFAULT 0,               -- denormalized
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);
```

### 13.3 `blog_comments`

```sql
CREATE TABLE blog_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Author (can be visitor or store owner)
  author_name     TEXT NOT NULL,
  author_email    TEXT NOT NULL,
  author_url      TEXT,
  
  -- Content
  content         TEXT NOT NULL,
  
  -- Threading
  parent_id       UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  depth           INTEGER DEFAULT 0,
  
  -- Moderation
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','spam','rejected')),
  is_author_reply BOOLEAN DEFAULT false,           -- reply from store owner
  
  -- Metadata
  ip_address      INET,
  user_agent      TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_comments_post ON blog_comments(post_id, status, created_at);
CREATE INDEX idx_comments_pending ON blog_comments(store_id, status) WHERE status = 'pending';
```

---

## 14. AI & Credit Tables

> See [07 AI Features](./07_AI_Features.md) for full AI architecture, gateway implementation, and prompt engineering.

### 14.1 `ai_usage`

> Every AI API call is logged here — immutable audit trail.

```sql
CREATE TABLE ai_usage (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  
  -- Task
  feature         TEXT NOT NULL,                   -- 'product_description_short', 'ats_score', etc.
  
  -- Provider & Model
  provider        TEXT NOT NULL,                   -- 'google', 'anthropic'
  model           TEXT NOT NULL,                   -- 'gemini-3-flash', 'claude-sonnet-4.5'
  
  -- Token usage
  input_tokens    INTEGER DEFAULT 0,
  output_tokens   INTEGER DEFAULT 0,
  total_tokens    INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  
  -- Credits
  credits_used    NUMERIC(10,2) NOT NULL,
  actual_cost     NUMERIC(10,6),                   -- provider cost in USD (6 decimal for precision)
  
  -- Performance
  latency_ms      INTEGER,
  
  -- Status
  status          TEXT DEFAULT 'success' CHECK (status IN ('success','error','cached','fallback','timeout')),
  fallback_model  TEXT,                            -- if primary failed, which model was used
  error_message   TEXT,
  error_code      TEXT,
  
  -- Cache
  cached          BOOLEAN DEFAULT false,
  cache_key       TEXT,
  
  -- Request metadata
  request_hash    TEXT,                            -- SHA-256 of input for dedup
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_usage_store ON ai_usage(store_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON ai_usage(feature, created_at DESC);
CREATE INDEX idx_ai_usage_model ON ai_usage(model, created_at DESC);
CREATE INDEX idx_ai_usage_cost ON ai_usage(store_id, actual_cost);
CREATE INDEX idx_ai_usage_status ON ai_usage(status) WHERE status != 'success';
CREATE INDEX idx_ai_usage_date ON ai_usage(created_at, store_id);
```

### 14.2 `ai_content_cache`

> Postgres-level cache (Layer 2, behind Redis Layer 1).

```sql
CREATE TABLE ai_content_cache (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key       TEXT NOT NULL UNIQUE,            -- SHA-256(task + input + model)
  
  -- Cached content
  content         JSONB NOT NULL,
  
  -- Source
  provider        TEXT NOT NULL,
  model           TEXT NOT NULL,
  input_tokens    INTEGER,
  output_tokens   INTEGER,
  
  -- Stats
  tokens_saved    INTEGER DEFAULT 0,               -- cumulative tokens avoided
  hit_count       INTEGER DEFAULT 0,               -- cache hit counter
  
  -- TTL
  expires_at      TIMESTAMPTZ NOT NULL,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_cache_key ON ai_content_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON ai_content_cache(expires_at);
CREATE INDEX idx_ai_cache_cleanup ON ai_content_cache(expires_at) WHERE expires_at < NOW();
```

### 14.3 `ai_credits`

> Source of truth for credit balances (Redis caches this for fast gateway checks).

```sql
CREATE TABLE ai_credits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Plan
  plan            TEXT DEFAULT 'free',
  
  -- Balances
  monthly_allocation  NUMERIC(10,2) DEFAULT 10,    -- credits reset monthly
  current_balance     NUMERIC(10,2) DEFAULT 10,    -- available now
  purchased_balance   NUMERIC(10,2) DEFAULT 0,     -- top-up credits (don't reset)
  
  -- Lifetime stats
  total_used          NUMERIC(10,2) DEFAULT 0,
  total_tokens_consumed BIGINT DEFAULT 0,
  total_api_calls     INTEGER DEFAULT 0,
  
  -- Reset
  last_reset_at       TIMESTAMPTZ DEFAULT NOW(),
  next_reset_at       TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 month'),
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 14.4 `credit_transactions`

> Audit trail for every credit change — purchase, reset, bonus, refund.

```sql
CREATE TABLE credit_transactions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Transaction type
  type            TEXT NOT NULL CHECK (type IN (
    'purchase', 'monthly_reset', 'rollover', 'bonus',
    'refund', 'admin_grant', 'usage', 'expiry'
  )),
  
  -- Amount
  credits         NUMERIC(10,2) NOT NULL,          -- positive = add, negative = deduct
  balance_before  NUMERIC(10,2),
  balance_after   NUMERIC(10,2),
  
  -- Payment (for purchases)
  amount_cents    INTEGER,                         -- payment amount
  currency        TEXT,
  stripe_payment_id TEXT,
  razorpay_payment_id TEXT,
  
  -- Pack info
  pack_id         TEXT,                            -- 'micro', 'small', 'medium', 'large', 'jumbo'
  
  -- Reference
  reference_type  TEXT,                            -- 'ai_usage', 'admin_action'
  reference_id    UUID,
  
  notes           TEXT,
  created_by      UUID REFERENCES auth.users(id),
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_tx_store ON credit_transactions(store_id, created_at DESC);
CREATE INDEX idx_credit_tx_type ON credit_transactions(type, created_at DESC);
```

### 14.5 `content_moderation`

```sql
CREATE TABLE content_moderation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Content reference
  content_type    TEXT NOT NULL,                    -- 'product', 'blog_post', 'review', 'testimonial', 'profile'
  content_id      UUID NOT NULL,
  content_text    TEXT NOT NULL,                    -- truncated to 500 chars
  
  -- AI moderation result
  status          TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'safe', 'needs_review', 'blocked', 'appealed', 'overridden'
  )),
  categories      TEXT[] DEFAULT '{}',             -- 'spam', 'hate_speech', 'harassment', 'adult', 'misleading'
  confidence      NUMERIC(3,2),                    -- 0.00 - 1.00
  ai_reasoning    TEXT,
  model_used      TEXT,
  
  -- Manual review
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_action   TEXT,                            -- 'approved', 'rejected', 'escalated'
  review_notes    TEXT,
  
  -- Appeal
  appeal_reason   TEXT,
  appeal_status   TEXT CHECK (appeal_status IN ('pending', 'approved', 'rejected')),
  appeal_reviewed_by UUID REFERENCES auth.users(id),
  appeal_reviewed_at TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_moderation_store ON content_moderation(store_id, status, created_at DESC);
CREATE INDEX idx_moderation_pending ON content_moderation(status)
  WHERE status IN ('needs_review', 'appealed');
CREATE INDEX idx_moderation_content ON content_moderation(content_type, content_id);
```

---

## 15. Billing & Subscription Tables

### 15.1 `subscriptions`

```sql
CREATE TABLE subscriptions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Plan
  plan            TEXT NOT NULL CHECK (plan IN ('free','starter','business','enterprise')),
  
  -- Status
  status          TEXT DEFAULT 'active' CHECK (status IN (
    'active', 'trialing', 'past_due', 'cancelled',
    'expired', 'paused', 'incomplete'
  )),
  
  -- Billing
  billing_cycle   TEXT DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','annual')),
  amount          NUMERIC(10,2),
  currency        TEXT DEFAULT 'INR',
  
  -- Provider
  provider        TEXT,                            -- 'razorpay', 'stripe'
  provider_subscription_id TEXT,
  provider_customer_id     TEXT,
  
  -- Period
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  trial_start          TIMESTAMPTZ,
  trial_end            TIMESTAMPTZ,
  
  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT false,
  cancelled_at         TIMESTAMPTZ,
  cancel_reason        TEXT,
  
  -- Metadata
  features        JSONB DEFAULT '{}',              -- plan features snapshot
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_subscriptions_status ON subscriptions(status, plan);
```

### 15.2 `subscription_history`

> Log of every plan change.

```sql
CREATE TABLE subscription_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Change
  event           TEXT NOT NULL CHECK (event IN (
    'created', 'upgraded', 'downgraded', 'renewed',
    'cancelled', 'reactivated', 'expired', 'payment_failed',
    'trial_started', 'trial_ended'
  )),
  
  from_plan       TEXT,
  to_plan         TEXT,
  from_amount     NUMERIC(10,2),
  to_amount       NUMERIC(10,2),
  
  -- Payment
  payment_id      TEXT,
  
  -- Proration
  proration_amount NUMERIC(10,2),
  
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_sub_history ON subscription_history(subscription_id, created_at DESC);
```

### 15.3 `invoices`

```sql
CREATE TABLE invoices (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  
  -- Invoice
  invoice_number  TEXT NOT NULL UNIQUE,            -- 'INV-2026-001234'
  
  -- Amounts
  subtotal        NUMERIC(10,2) NOT NULL,
  tax_amount      NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL,
  currency        TEXT DEFAULT 'INR',
  
  -- Status
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','void','refunded')),
  
  -- Dates
  issued_at       TIMESTAMPTZ,
  due_at          TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  
  -- Payment
  payment_id      TEXT,
  payment_method  TEXT,
  
  -- Line items
  line_items      JSONB NOT NULL DEFAULT '[]',
  -- [
  --   { "description": "Business Plan - Monthly", "quantity": 1, "unit_price": 2900, "total": 2900 },
  --   { "description": "AI Credit Pack (Medium)", "quantity": 1, "unit_price": 299, "total": 299 }
  -- ]
  
  -- PDF
  pdf_url         TEXT,
  
  -- Billing info
  billing_name    TEXT,
  billing_email   TEXT,
  billing_address JSONB,
  gstin           TEXT,                            -- Indian GST number
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_invoices_store ON invoices(store_id, created_at DESC);
CREATE INDEX idx_invoices_status ON invoices(status);
```

---

## 16. System Tables

### 16.1 `audit_logs`

> Immutable event log — every significant action is recorded.

```sql
CREATE TABLE audit_logs (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  
  -- Event
  action          TEXT NOT NULL,                   -- 'product.created', 'order.shipped', 'settings.updated'
  resource_type   TEXT,                            -- 'product', 'order', 'page', 'store'
  resource_id     UUID,
  
  -- Details
  details         JSONB DEFAULT '{}',
  -- { "changes": { "price": { "from": 100, "to": 120 } } }
  
  -- Context
  ip_address      INET,
  user_agent      TEXT,
  request_id      TEXT,                            -- correlate with API request
  
  -- Severity
  severity        TEXT DEFAULT 'info' CHECK (severity IN ('info','warning','error','critical')),
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (partitioned by month for large tables)
CREATE INDEX idx_audit_store ON audit_logs(store_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_severity ON audit_logs(severity) WHERE severity IN ('error', 'critical');
```

### 16.2 `notifications`

```sql
CREATE TABLE notifications (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Content
  type            TEXT NOT NULL,                   -- 'order', 'stock', 'payment', 'ai', 'system', 'trial'
  title           TEXT NOT NULL,
  body            TEXT,
  
  -- Action
  action_url      TEXT,                            -- deep link within app
  action_label    TEXT,                            -- 'View Order', 'Restock Now'
  
  -- Data (structured payload for mobile/push)
  data            JSONB DEFAULT '{}',
  
  -- Read state
  is_read         BOOLEAN DEFAULT false,
  read_at         TIMESTAMPTZ,
  
  -- Delivery
  channels        TEXT[] DEFAULT '{"in_app"}',     -- 'in_app', 'email', 'push', 'sms'
  email_sent      BOOLEAN DEFAULT false,
  push_sent       BOOLEAN DEFAULT false,
  
  -- Priority
  priority        TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  
  -- Expiry
  expires_at      TIMESTAMPTZ,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, created_at DESC)
  WHERE is_read = false;
CREATE INDEX idx_notifications_store ON notifications(store_id, created_at DESC);
```

### 16.3 `notification_preferences`

```sql
CREATE TABLE notification_preferences (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Channel preferences per notification type
  preferences     JSONB DEFAULT '{
    "order": { "in_app": true, "email": true, "push": true, "sms": false },
    "stock": { "in_app": true, "email": true, "push": false, "sms": false },
    "payment": { "in_app": true, "email": true, "push": true, "sms": false },
    "ai": { "in_app": true, "email": false, "push": false, "sms": false },
    "system": { "in_app": true, "email": true, "push": false, "sms": false },
    "trial": { "in_app": true, "email": true, "push": true, "sms": false },
    "marketing": { "in_app": false, "email": false, "push": false, "sms": false }
  }',
  
  -- Global
  do_not_disturb  BOOLEAN DEFAULT false,
  dnd_start       TIME,                           -- e.g., '22:00'
  dnd_end         TIME,                           -- e.g., '08:00'
  
  -- Push tokens
  fcm_token       TEXT,
  apns_token      TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### 16.4 `form_submissions`

```sql
CREATE TABLE form_submissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- Form
  form_name       TEXT DEFAULT 'contact',          -- 'contact', 'newsletter', 'custom'
  
  -- Data
  data            JSONB NOT NULL,
  -- { "name": "John", "email": "john@example.com", "message": "Hello", "phone": "..." }
  
  -- Metadata
  ip_address      INET,
  user_agent      TEXT,
  referrer_url    TEXT,
  
  -- hCaptcha
  captcha_verified BOOLEAN DEFAULT false,
  captcha_score    NUMERIC(3,2),
  
  -- Status
  is_read         BOOLEAN DEFAULT false,
  is_spam         BOOLEAN DEFAULT false,
  is_archived     BOOLEAN DEFAULT false,
  
  -- Reply
  replied_at      TIMESTAMPTZ,
  reply_message   TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_forms_store ON form_submissions(store_id, created_at DESC);
CREATE INDEX idx_forms_unread ON form_submissions(store_id) WHERE is_read = false AND is_spam = false;
```

### 16.5 `media`

> Central media library for all uploaded files (images, videos, documents).

```sql
CREATE TABLE media (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  
  -- File info
  filename        TEXT NOT NULL,
  original_filename TEXT,
  file_path       TEXT NOT NULL,                   -- Cloudflare R2 path
  file_url        TEXT NOT NULL,                   -- public CDN URL
  file_size       INTEGER,                         -- bytes
  mime_type       TEXT,
  
  -- Image metadata
  width           INTEGER,
  height          INTEGER,
  alt_text        TEXT,
  
  -- Variants (auto-generated)
  variants        JSONB DEFAULT '{}',
  -- {
  --   "thumbnail": { "url": "...", "width": 150, "height": 150 },
  --   "medium": { "url": "...", "width": 600, "height": 600 },
  --   "large": { "url": "...", "width": 1200, "height": 1200 }
  -- }
  
  -- Categorization
  folder          TEXT DEFAULT '/',                -- virtual folder path
  tags            TEXT[] DEFAULT '{}',
  
  -- Usage tracking
  used_by         JSONB DEFAULT '[]',
  -- [{ "type": "product", "id": "...", "field": "images" }]
  
  -- AI
  ai_alt_text     TEXT,                            -- AI-generated alt text
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_media_store ON media(store_id, created_at DESC);
CREATE INDEX idx_media_folder ON media(store_id, folder);
CREATE INDEX idx_media_type ON media(store_id, mime_type);
```

### 16.6 `platform_alerts`

> Super-admin alerts from anomaly detection, fraud, system health.

```sql
CREATE TABLE platform_alerts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  type            TEXT NOT NULL,                   -- 'anomaly', 'fraud', 'system', 'cost'
  severity        TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  
  title           TEXT NOT NULL,
  alerts          TEXT[] DEFAULT '{}',
  ai_analysis     TEXT,
  
  -- Resolution
  resolved        BOOLEAN DEFAULT false,
  resolved_by     UUID REFERENCES auth.users(id),
  resolved_at     TIMESTAMPTZ,
  resolution_notes TEXT,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_alerts_unresolved ON platform_alerts(severity, created_at DESC)
  WHERE resolved = false;
```

---

## 17. Row-Level Security (RLS) Policies

> **All user-facing tables have RLS enabled.** Service role bypasses RLS for server-side operations (Cloudflare Worker → Supabase).

### 17.1 Policy Summary Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `user_profiles` | Own profile | On signup (trigger) | Own profile | — |
| `stores` | Own stores | Authenticated users | Own stores | Own stores |
| `store_surveys` | Own store's | Own store's | Own store's | — |
| `pages` | Own store's + public published | Own store's | Own store's | Own store's |
| `products` | Own store's + public active | Own store's | Own store's | Own store's |
| `product_variants` | Via product ownership | Own store's products | Own store's | Own store's |
| `product_categories` | Own store's | Own store's | Own store's | Own store's |
| `orders` | Own store's | Service role only | Own store's | — |
| `order_items` | Via order ownership | Service role only | — | — |
| `customers` | Own store's | Own store's | Own store's | Own store's |
| `carts` | Own store's | Service role | Service role | Service role |
| `coupons` | Own store's | Own store's | Own store's | Own store's |
| `ai_usage` | Own store's | Service role only | — | — |
| `ai_credits` | Own store's | Service role only | Service role only | — |
| `credit_transactions` | Own store's | Service role only | — | — |
| `notifications` | Own notifications | Service role only | Own (mark read) | Own |
| `audit_logs` | Super admin only | Service role only | — | — |
| `media` | Own store's | Own store's | Own store's | Own store's |
| `subscriptions` | Own store's | Service role only | Service role only | — |
| `blog_posts` | Own + public published | Own store's | Own store's | Own store's |

### 17.2 Core RLS Policy Patterns

```sql
-- ═══════════════════════════════════════════════════════════════
-- Pattern 1: Direct ownership (user_profiles)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- Pattern 2: Store ownership (products, pages, etc.)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own store products"
  ON products FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Public can view active products"
  ON products FOR SELECT
  USING (status = 'active');

CREATE POLICY "Users can insert to own stores"
  ON products FOR INSERT
  WITH CHECK (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own store products"
  ON products FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own store products"
  ON products FOR DELETE
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- Pattern 3: Service role only (orders, ai_usage)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own store orders"
  ON orders FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

CREATE POLICY "Service role can insert orders"
  ON orders FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Users can update own store orders"
  ON orders FOR UPDATE
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- Pattern 4: User-specific (notifications)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark own notifications as read"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());

-- ═══════════════════════════════════════════════════════════════
-- Pattern 5: Storefront public access (for customer-facing pages)
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published pages"
  ON pages FOR SELECT
  USING (status = 'published');

CREATE POLICY "Store owners manage own pages"
  ON pages FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
```

### 17.3 RLS for All Remaining Tables

```sql
-- Stores
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own stores" ON stores FOR ALL
  USING (user_id = auth.uid());

-- Store surveys
ALTER TABLE store_surveys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage surveys" ON store_surveys FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Themes (public read, admin write)
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active themes" ON themes FOR SELECT
  USING (is_active = true);

-- Custom domains
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own domains" ON custom_domains FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- AI credits (read-only for users)
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own credits" ON ai_credits FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Credit transactions (read-only for users)
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own credit transactions" ON credit_transactions FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Subscriptions (read-only for users)
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subscription" ON subscriptions FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Media
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own media" ON media FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Blog posts
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published posts" ON blog_posts FOR SELECT
  USING (status = 'published');
CREATE POLICY "Store owners manage posts" ON blog_posts FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Form submissions
ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners view submissions" ON form_submissions FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Audit logs (super admin only via service role)
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
-- No user policy — accessed only via service role
```

---

## 18. Database Functions & Triggers

### 18.1 Auto-Update `updated_at`

```sql
-- Universal trigger function for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stores_updated BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pages_updated BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 18.2 Auto-Create User Profile on Signup

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### 18.3 Auto-Create AI Credits on Store Creation

```sql
CREATE OR REPLACE FUNCTION handle_new_store()
RETURNS TRIGGER AS $$
BEGIN
  -- Create AI credits with free plan allocation
  INSERT INTO ai_credits (store_id, plan, monthly_allocation, current_balance)
  VALUES (NEW.id, 'free', 10, 10);
  
  -- Create default notification preferences for the owner
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_store_created
  AFTER INSERT ON stores
  FOR EACH ROW EXECUTE FUNCTION handle_new_store();
```

### 18.4 Order Number Generator

```sql
CREATE OR REPLACE FUNCTION generate_order_number(p_store_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_count INTEGER;
  v_prefix TEXT;
BEGIN
  -- Get current order count for store
  SELECT COUNT(*) + 1 INTO v_count
  FROM orders WHERE store_id = p_store_id;
  
  -- Get store subdomain prefix (first 3 chars uppercase)
  SELECT UPPER(LEFT(subdomain, 3)) INTO v_prefix
  FROM stores WHERE id = p_store_id;
  
  RETURN v_prefix || '-' || LPAD(v_count::TEXT, 5, '0');
  -- Example: 'LET-00042'
END;
$$ LANGUAGE plpgsql;
```

### 18.5 Inventory Deduction on Order Confirmation

```sql
CREATE OR REPLACE FUNCTION deduct_inventory_on_order()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status = 'pending' THEN
    -- Deduct stock for each order item
    UPDATE products p
    SET stock_quantity = stock_quantity - oi.quantity,
        total_sold = total_sold + oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id;
    
    -- Update variant stock
    UPDATE product_variants pv
    SET stock_quantity = stock_quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.variant_id = pv.id
      AND oi.variant_id IS NOT NULL;
    
    -- Log inventory adjustments
    INSERT INTO inventory_adjustments (product_id, variant_id, location_id, adjustment, previous_qty, new_qty, reason, reference_type, reference_id)
    SELECT
      oi.product_id,
      oi.variant_id,
      (SELECT id FROM inventory_locations WHERE store_id = NEW.store_id AND is_default = true LIMIT 1),
      -oi.quantity,
      p.stock_quantity + oi.quantity,
      p.stock_quantity,
      'sale',
      'order',
      NEW.id
    FROM order_items oi
    JOIN products p ON p.id = oi.product_id
    WHERE oi.order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_order_confirmed
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed' AND OLD.status = 'pending')
  EXECUTE FUNCTION deduct_inventory_on_order();
```

### 18.6 Monthly Credit Reset (called via cron)

```sql
CREATE OR REPLACE FUNCTION reset_monthly_credits()
RETURNS void AS $$
BEGIN
  UPDATE ai_credits
  SET
    current_balance = monthly_allocation + purchased_balance,
    last_reset_at = NOW(),
    next_reset_at = NOW() + INTERVAL '1 month',
    updated_at = NOW()
  WHERE next_reset_at <= NOW();
  
  -- Log reset transactions
  INSERT INTO credit_transactions (store_id, type, credits, balance_before, balance_after, notes)
  SELECT
    store_id,
    'monthly_reset',
    monthly_allocation,
    current_balance - monthly_allocation,
    current_balance,
    'Automatic monthly credit reset'
  FROM ai_credits
  WHERE last_reset_at >= NOW() - INTERVAL '1 minute';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 18.7 Denormalized Counter Updates

```sql
-- Update product review stats when review is approved
CREATE OR REPLACE FUNCTION update_product_review_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved') THEN
    UPDATE products SET
      review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved'),
      avg_rating = (SELECT COALESCE(AVG(rating), 0) FROM reviews WHERE product_id = NEW.product_id AND status = 'approved')
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_product_review_stats();

-- Update store counters
CREATE OR REPLACE FUNCTION update_store_counters()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'products' THEN
    UPDATE stores SET product_count = (SELECT COUNT(*) FROM products WHERE store_id = NEW.store_id AND status = 'active')
    WHERE id = NEW.store_id;
  ELSIF TG_TABLE_NAME = 'orders' THEN
    UPDATE stores SET order_count = (SELECT COUNT(*) FROM orders WHERE store_id = NEW.store_id)
    WHERE id = NEW.store_id;
  ELSIF TG_TABLE_NAME = 'pages' THEN
    UPDATE stores SET page_count = (SELECT COUNT(*) FROM pages WHERE store_id = NEW.store_id AND status = 'published')
    WHERE id = NEW.store_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_product_change AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION update_store_counters();
CREATE TRIGGER on_order_change AFTER INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION update_store_counters();
CREATE TRIGGER on_page_change AFTER INSERT OR UPDATE OR DELETE ON pages
  FOR EACH ROW EXECUTE FUNCTION update_store_counters();
```

### 18.8 Cache Hit Counter

```sql
CREATE OR REPLACE FUNCTION increment_cache_hit(p_cache_key TEXT)
RETURNS void AS $$
BEGIN
  UPDATE ai_content_cache
  SET hit_count = hit_count + 1,
      tokens_saved = tokens_saved + COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)
  WHERE cache_key = p_cache_key;
END;
$$ LANGUAGE plpgsql;
```

---

## 19. Migration Strategy

### 19.1 Migration Tool

| Tool | Purpose |
|---|---|
| **Supabase CLI** | `supabase migration new` / `supabase db push` |
| **Version Control** | All migrations live in `supabase/migrations/` |
| **Naming** | `YYYYMMDDHHMMSS_description.sql` |
| **Review** | All migrations reviewed before applying to production |

### 19.2 Migration File Structure

```
supabase/
  └── migrations/
      ├── 20260101000000_initial_schema.sql
      ├── 20260115000000_add_product_categories.sql
      ├── 20260120000000_add_inventory_tables.sql
      ├── 20260125000000_add_customer_tables.sql
      ├── 20260201000000_add_blog_tables.sql
      ├── 20260205000000_add_ai_tables.sql
      ├── 20260210000000_add_payment_tables.sql
      ├── 20260212000000_add_onboarding_tables.sql
      ├── 20260213000000_add_rls_policies.sql
      └── 20260214000000_add_functions_triggers.sql
```

### 19.3 Migration Best Practices

| Practice | Description |
|---|---|
| **Always additive** | Never drop columns in production — mark deprecated, remove later |
| **Default values** | New NOT NULL columns must have defaults |
| **Index concurrently** | Use `CREATE INDEX CONCURRENTLY` for large tables |
| **Test locally** | `supabase db reset` → apply → verify before pushing |
| **Rollback plan** | Include DOWN migration or document rollback steps |
| **Data migrations** | Separate schema changes from data migrations |
| **RLS first** | Enable RLS and add policies before inserting data |

### 19.4 Seed Data

```sql
-- Default themes
INSERT INTO themes (name, slug, site_type, category, is_premium) VALUES
  ('Modern Store',   'modern-store',   'store',     'modern',  false),
  ('Classic Store',  'classic-store',  'store',     'classic', false),
  ('Minimal Portfolio', 'minimal-portfolio', 'portfolio', 'minimal', false),
  ('Bold Portfolio', 'bold-portfolio', 'portfolio', 'bold',    true),
  ('Clean Resume',   'clean-resume',   'resume',    'minimal', false),
  ('Creative Resume', 'creative-resume', 'resume',  'modern',  true),
  ('Hero Landing',   'hero-landing',   'landing',   'modern',  false),
  ('Blog Standard',  'blog-standard',  'blog',      'classic', false);
```

---

## 20. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 6.0 | Feb 14, 2026 | AI-Enhanced | Major expansion — 20 sections, 45+ tables, complete RLS, functions, triggers, migrations |
| 5.0 | Feb 14, 2026 | AI-Enhanced | Initial structured documentation with 8 sections |
| 4.0 | Feb 13, 2026 | Platform | Core tables and basic RLS |
| 3.0 | Feb 12, 2026 | Platform | E-commerce schema |

---

> **Cross-references:**
> - [00_Overview.md](./00_Overview.md) — Platform overview, site types, schema summary
> - [02_Authentication_and_Security.md](./02_Authentication_and_Security.md) — `auth.users` integration, session management
> - [03_Onboarding_and_Trial.md](./03_Onboarding_and_Trial.md) — Onboarding tables usage, trial status fields
> - [05_Ecommerce_Engine.md](./05_Ecommerce_Engine.md) — Product, order, inventory business logic
> - [06_Portfolio_and_Resume.md](./06_Portfolio_and_Resume.md) — Portfolio & resume table usage
> - [07_AI_Features.md](./07_AI_Features.md) — AI tables, credit system, content moderation

---

> **Next:** [09 API Reference](./09_API_Reference.md) — Complete REST API documentation

> **See also:** [13 Plans & Pricing](./13_Plans_and_Pricing.md) · [14 Theme Implementation](./14_Theme_Implementation.md) · [15 App Store Implementation](./15_App_Store_Implementation.md) · [16 Customer Management](./16_Customer_Management.md) — Additional schema defined in these docs

---

*[← Back to Index](./README.md)*
