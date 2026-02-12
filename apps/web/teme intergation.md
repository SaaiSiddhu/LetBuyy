markdown
# 🎨 LetBuyy Theme Marketplace — Professional Grade SaaS Implementation Plan

**Version:** 2.0 Professional  
**Target:** Enterprise-ready theme marketplace with multi-platform support  
**Goal:** Build a Shopify Theme Store / ThemeForest competitor with LetBuyy integration + standalone downloads

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Enhanced Features](#3-enhanced-features)
4. [Database Schema](#4-database-schema)
5. [Authentication & Security](#5-authentication--security)
6. [Apps & Structure](#6-apps--structure)
7. [API Architecture](#7-api-architecture)
8. [UI Wireframes (Detailed)](#8-ui-wireframes-detailed)
9. [Multi-Platform Support](#9-multi-platform-support)
10. [Admin Panel](#10-admin-panel)
11. [Payment & Licensing](#11-payment--licensing)
12. [Security Features](#12-security-features)
13. [Implementation Phases](#13-implementation-phases)
14. [Testing & QA](#14-testing--qa)
15. [Deployment Strategy](#15-deployment-strategy)

---

## 1. Executive Summary

### 1.1 Vision

Build a **professional-grade SaaS theme marketplace** that:

- ✅ Serves LetBuyy users (instant apply to their stores)
- ✅ Serves external developers (download source code for WordPress, Shopify, Wix, HTML)
- ✅ Provides enterprise-level security and licensing
- ✅ Offers a dedicated admin panel for theme management
- ✅ Supports multiple revenue streams (LetBuyy subscriptions, one-time purchases, platform-specific downloads)

### 1.2 Key Differentiators

| Feature | LetBuyy Marketplace | Shopify Themes | ThemeForest |
|---------|---------------------|----------------|-------------|
| Instant Apply to Store | ✅ Yes | ✅ Yes | ❌ No |
| Multi-Platform Downloads | ✅ Yes | ❌ No | ✅ Yes |
| Live Demo Subdomains | ✅ Yes | ✅ Yes | ❌ No |
| Theme Customizer | ✅ Yes | ✅ Yes | ❌ No |
| Version Control | ✅ Yes | ✅ Yes | ❌ No |
| A/B Testing | ✅ Yes | ❌ No | ❌ No |
| Analytics Dashboard | ✅ Yes | ❌ No | ❌ No |
| Dedicated Admin App | ✅ Yes | ❌ No | ❌ No |

### 1.3 Revenue Model

```
┌─────────────────────────────────────────────────────────────┐
│ Revenue Streams                                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. LetBuyy Integration (Primary)                            │
│    - Free themes: $0 (user acquisition)                     │
│    - Premium themes: $29-$99 (one-time)                     │
│    - Theme bundles: $199-$499                               │
│    - Subscription: $19/mo (unlimited themes)                │
│                                                             │
│ 2. Multi-Platform Downloads (Secondary)                     │
│    - WordPress version: +$49 per theme                      │
│    - Shopify version: +$59 per theme                        │
│    - HTML/CSS version: +$39 per theme                       │
│    - All platforms bundle: +$99 per theme                   │
│                                                             │
│ 3. Enterprise (Tertiary)                                    │
│    - White-label licensing: $999-$2,999                     │
│    - Custom theme development: $5,000-$50,000               │
│    - Agency partner program: 30% commission                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Overview

### 2.1 Monorepo Structure

```
letbuyy-monorepo/
├── apps/
│   ├── web/
│   │   ├── storefront/              # Customer stores (*.letbuyy.store)
│   │   ├── theme-marketplace/       # 🆕 Theme store (themes.letbuyy.store)
│   │   ├── theme-admin/             # 🆕 Theme management (themes-admin.letbuyy.store)
│   │   ├── admin/                   # Store builder (admin.letbuyy.store)
│   │   ├── accounts/                # Auth hub (accounts.letbuyy.store)
│   │   ├── landing/                 # Marketing (letbuyy.store)
│   │   ├── console/                 # Super admin
│   │   └── team/                    # Team management
│   │
│   └── mobile/
│       ├── customer-app/            # React Native customer app
│       └── merchant-app/            # React Native merchant app
│
├── packages/
│   ├── typescript/
│   │   ├── api-types/               # Shared TypeScript types
│   │   ├── ui/                      # Shared React components (shadcn/ui)
│   │   ├── theme-engine/            # 🆕 Core theme rendering logic
│   │   ├── theme-converter/         # 🆕 Convert themes to WP/Shopify/HTML
│   │   ├── licensing/               # 🆕 License generation & validation
│   │   ├── security/                # 🆕 Security utilities
│   │   ├── analytics/               # Theme analytics tracking
│   │   ├── payments/                # Stripe + Razorpay integration
│   │   └── utils/                   # Shared utilities
│   │
│   └── config/
│       ├── eslint/                  # Shared ESLint config
│       ├── typescript/              # Shared TS config
│       └── tailwind/                # Shared Tailwind config
│
├── backend/
│   ├── supabase/
│   │   ├── migrations/              # SQL migrations
│   │   ├── seed/                    # Seed data
│   │   ├── functions/               # Edge functions
│   │   └── storage/                 # Storage buckets
│   │
│   ├── workers/                     # Cloudflare Workers
│   │   ├── cdn/                     # CDN for theme assets
│   │   ├── webhooks/                # Payment webhooks
│   │   └── downloads/               # Secure download generation
│   │
│   └── services/
│       ├── theme-builder/           # Docker container for theme compilation
│       ├── screenshot-service/      # Automated screenshot generation
│       └── analytics-processor/     # Process theme analytics
│
├── infrastructure/
│   ├── terraform/                   # IaC for cloud resources
│   ├── docker/                      # Docker configs
│   └── k8s/                         # Kubernetes manifests
│
├── docs/
│   ├── api/                         # API documentation
│   ├── theme-development/           # Theme dev guide
│   └── integration/                 # Platform integration docs
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

### 2.2 Domain Architecture

| Domain | App | Purpose | Auth Required |
|--------|-----|---------|---------------|
| `themes.letbuyy.store` | theme-marketplace | Browse, buy, apply themes | Checkout only |
| `themes-admin.letbuyy.store` | theme-admin | Manage theme catalog | Super admin only |
| `urban-kicks.letbuyy.store` | storefront | Live demo (Urban Kicks theme) | No |
| `luxe-atelier.letbuyy.store` | storefront | Live demo (Luxe Atelier theme) | No |
| `*.letbuyy.store` | storefront | User stores | No (public) |
| `accounts.letbuyy.store` | accounts | Shared authentication | Yes |
| `admin.letbuyy.store` | admin | Store builder | Yes |

### 2.3 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      USER JOURNEY                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Browse Gallery (themes.letbuyy.store)                   │
│     ↓                                                       │
│  2. View Theme Detail                                       │
│     ↓                                                       │
│  3. Click "Live Demo" → urban-kicks.letbuyy.store           │
│     (Real store rendered by storefront app)                 │
│     ↓                                                       │
│  4. Click "Install" or "Buy"                                │
│     ↓                                                       │
│  5. Auth Check:                                             │
│     - Not logged in → Redirect to accounts.letbuyy.store    │
│     - Logged in → Continue                                  │
│     ↓                                                       │
│  6a. FREE THEME → Instant install                           │
│     - Create purchase record (amount: $0)                   │
│     - Show store selector                                   │
│     - Apply to store                                        │
│     ↓                                                       │
│  6b. PAID THEME → Stripe Checkout                           │
│     - Create Stripe session                                 │
│     - Redirect to Stripe                                    │
│     - User completes payment                                │
│     - Webhook: Record purchase                              │
│     - Redirect to success page                              │
│     ↓                                                       │
│  7. Dashboard (themes.letbuyy.store/dashboard)              │
│     - View purchased themes                                 │
│     - Apply to stores                                       │
│     - Customize theme settings                              │
│     ↓                                                       │
│  8. Theme Applied                                           │
│     - Update site.theme_id in DB                            │
│     - Storefront reads new theme_id                         │
│     - User's store renders with new theme                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Enhanced Features

### 3.1 LetBuyy Integration Features

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Instant Apply** | One-click theme activation | Update `sites.theme_id` in DB |
| **Live Customizer** | Visual theme editor | Real-time preview with PostMessage API |
| **A/B Testing** | Test multiple themes | Traffic splitting based on visitor hash |
| **Analytics** | Theme performance metrics | Track conversions, bounce rate, session time |
| **Version Control** | Theme update history | Store theme_versions, allow rollback |
| **Auto-Updates** | Seamless theme updates | Background migration of settings |

### 3.2 Multi-Platform Download Features

| Platform | Output Format | Implementation | Price Premium |
|----------|---------------|----------------|---------------|
| **WordPress** | `.zip` with PHP theme files | Theme converter generates WP theme structure | +$49 |
| **Shopify** | `.zip` with Liquid templates | Convert to Shopify section schema | +$59 |
| **Wix** | Wix ADI JSON + assets | Export as Wix component library | +$69 |
| **Webflow** | Webflow JSON export | Convert to Webflow CMS structure | +$79 |
| **HTML/CSS** | Static `.zip` | Export as standalone HTML/CSS/JS | +$39 |
| **React** | NPM package | Export as React component library | +$89 |

### 3.3 Enterprise Features

| Feature | Description | Target Audience |
|---------|-------------|-----------------|
| **White Label** | Rebrand marketplace | Agencies |
| **Multi-Site License** | Use on unlimited sites | Agencies |
| **Priority Support** | 24/7 dedicated support | Enterprise |
| **Custom Development** | Bespoke theme creation | Large brands |
| **Partner API** | Programmatic access | Developers |

### 3.4 Security Features

| Feature | Purpose | Implementation |
|---------|---------|----------------|
| **License Validation** | Prevent theme piracy | JWT-based license keys |
| **Download Watermarking** | Track unauthorized distribution | Embed user ID in source code comments |
| **Rate Limiting** | Prevent abuse | Redis-based rate limiter |
| **CSP Headers** | XSS protection | Content Security Policy |
| **RBAC** | Role-based access control | Supabase RLS policies |
| **Audit Logs** | Track all actions | Separate audit_logs table |
| **2FA** | Two-factor authentication | TOTP via Supabase Auth |

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- ============================================
-- THEME CATALOG (Main product table)
-- ============================================
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,              -- 'urban-kicks'
    name TEXT NOT NULL,                     -- 'Urban Kicks'
    tagline TEXT,                           -- Short description
    description TEXT,                       -- Markdown description
    
    -- Classification
    category TEXT NOT NULL                  -- 'store','portfolio','resume','landing','saas'
        CHECK (category IN ('store','portfolio','resume','landing','saas')),
    industry TEXT[] DEFAULT '{}',           -- ['fashion','tech','food','fitness']
    tags TEXT[] DEFAULT '{}',               -- ['minimal','dark','animated']
    
    -- Technical
    theme_preset_id TEXT NOT NULL,          -- Maps to THEME_PRESETS key in code
    version TEXT DEFAULT '1.0.0',
    min_app_version TEXT,                   -- Minimum storefront version required
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Pricing - LetBuyy Integration
    letbuyy_pricing_type TEXT NOT NULL      -- 'free','one_time','subscription'
        CHECK (letbuyy_pricing_type IN ('free','one_time','subscription')),
    letbuyy_price_usd DECIMAL(10,2) DEFAULT 0,
    letbuyy_price_inr DECIMAL(10,2) DEFAULT 0,
    
    -- Pricing - Multi-Platform Downloads
    download_pricing JSONB DEFAULT '{
        "wordpress": {"usd": 49, "inr": 3999},
        "shopify": {"usd": 59, "inr": 4999},
        "wix": {"usd": 69, "inr": 5999},
        "webflow": {"usd": 79, "inr": 6499},
        "html": {"usd": 39, "inr": 2999},
        "react": {"usd": 89, "inr": 7499}
    }'::JSONB,
    
    -- Bundle Pricing
    bundle_all_platforms_usd DECIMAL(10,2) DEFAULT 99,
    bundle_all_platforms_inr DECIMAL(10,2) DEFAULT 7999,
    
    -- Media
    thumbnail_url TEXT,
    screenshots TEXT[] DEFAULT '{}',        -- Array of URLs
    demo_video_url TEXT,
    demo_gif_url TEXT,                      -- Auto-generated scrolling demo
    
    -- Demo Configuration
    demo_subdomain TEXT UNIQUE,             -- 'urban-kicks' → urban-kicks.letbuyy.store
    demo_site_id UUID REFERENCES sites(id),
    demo_store_config JSONB,                -- Full mock store data
    
    -- Customization Options
    is_customizable BOOLEAN DEFAULT true,
    customizable_sections TEXT[] DEFAULT '{}', -- ['colors','fonts','layout','header']
    color_presets JSONB DEFAULT '[]',
    font_options TEXT[] DEFAULT '{}',
    
    -- Content
    features TEXT[] DEFAULT '{}',
    changelog TEXT,
    documentation_url TEXT,
    support_url TEXT,
    
    -- Author Info
    author_id UUID REFERENCES users(id),
    author_name TEXT DEFAULT 'LetBuyy Team',
    author_url TEXT,
    
    -- Stats (denormalized for performance)
    rating DECIMAL(2,1) DEFAULT 0,
    review_count INT DEFAULT 0,
    install_count INT DEFAULT 0,            -- LetBuyy installs
    download_count INT DEFAULT 0,           -- Platform downloads
    revenue_generated DECIMAL(10,2) DEFAULT 0,
    
    -- SEO
    meta_title TEXT,
    meta_description TEXT,
    og_image_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ
);

-- ============================================
-- THEME VERSIONS (Version history)
-- ============================================
CREATE TABLE theme_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    changelog TEXT,
    breaking_changes TEXT[],
    migration_notes TEXT,
    
    -- Version metadata
    is_stable BOOLEAN DEFAULT true,
    is_latest BOOLEAN DEFAULT false,
    min_app_version TEXT,
    
    released_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(theme_id, version)
);

-- ============================================
-- PURCHASES - LetBuyy Integration
-- ============================================
CREATE TABLE theme_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    
    -- Purchase Type
    purchase_type TEXT NOT NULL              -- 'letbuyy_integration' or 'platform_download'
        CHECK (purchase_type IN ('letbuyy_integration','platform_download')),
    
    -- Platform (for downloads)
    platform TEXT                            -- 'wordpress','shopify','wix','webflow','html','react','all_platforms'
        CHECK (platform IS NULL OR platform IN ('wordpress','shopify','wix','webflow','html','react','all_platforms')),
    
    -- Payment
    payment_provider TEXT 
        CHECK (payment_provider IN ('stripe','razorpay','free','subscription')),
    payment_intent_id TEXT,
    subscription_id TEXT,                    -- Stripe subscription ID
    
    amount_paid DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    
    status TEXT DEFAULT 'completed'
        CHECK (status IN ('pending','completed','failed','refunded','cancelled')),
    
    -- License
    license_key TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
    license_type TEXT DEFAULT 'single_site'
        CHECK (license_type IN ('single_site','multi_site','unlimited','agency')),
    max_installations INT DEFAULT 1,
    current_installations INT DEFAULT 0,
    
    -- Download Info (for platform downloads)
    download_url TEXT,                       -- Signed URL (expires in 24h)
    download_count INT DEFAULT 0,
    max_downloads INT DEFAULT 5,             -- Allow 5 downloads
    download_expires_at TIMESTAMPTZ,
    
    -- Subscription Info
    subscription_status TEXT
        CHECK (subscription_status IS NULL OR subscription_status IN ('active','cancelled','paused','expired')),
    subscription_current_period_start TIMESTAMPTZ,
    subscription_current_period_end TIMESTAMPTZ,
    
    -- Metadata
    purchased_at TIMESTAMPTZ DEFAULT NOW(),
    refunded_at TIMESTAMPTZ,
    invoice_url TEXT,
    
    -- User fingerprint (for security)
    user_ip TEXT,
    user_agent TEXT,
    
    UNIQUE(user_id, theme_id, purchase_type, platform)
);

-- ============================================
-- INSTALLATIONS (LetBuyy sites)
-- ============================================
CREATE TABLE theme_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relations
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES theme_purchases(id) ON DELETE SET NULL,
    
    -- State
    is_active BOOLEAN DEFAULT false,         -- Only 1 active per site
    
    -- Customizations
    customizations JSONB DEFAULT '{}',       -- User's color/font/layout overrides
    version_installed TEXT,
    
    -- Timestamps
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    last_modified_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(site_id, theme_id)
);

-- ============================================
-- DOWNLOADS (Platform download tracking)
-- ============================================
CREATE TABLE theme_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    purchase_id UUID REFERENCES theme_purchases(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    theme_id UUID REFERENCES themes(id),
    
    platform TEXT NOT NULL,
    
    -- Download metadata
    download_url TEXT,                       -- Signed URL
    downloaded_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Security
    ip_address TEXT,
    user_agent TEXT,
    download_hash TEXT                       -- SHA-256 of downloaded file
);

-- ============================================
-- REVIEWS
-- ============================================
CREATE TABLE theme_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES theme_purchases(id),
    
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    title TEXT,
    comment TEXT,
    
    -- Helpful votes
    helpful_count INT DEFAULT 0,
    not_helpful_count INT DEFAULT 0,
    
    -- Moderation
    is_verified_purchase BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    
    -- Admin response
    admin_response TEXT,
    admin_responded_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, theme_id)
);

-- ============================================
-- REVIEW HELPFULNESS (Users vote on reviews)
-- ============================================
CREATE TABLE review_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    review_id UUID REFERENCES theme_reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    is_helpful BOOLEAN NOT NULL,             -- true = helpful, false = not helpful
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(review_id, user_id)
);

-- ============================================
-- THEME COLLECTIONS (Curated bundles)
-- ============================================
CREATE TABLE theme_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    
    -- Pricing
    price_usd DECIMAL(10,2),
    price_inr DECIMAL(10,2),
    discount_percentage INT,                 -- e.g., 30% off
    
    -- Display
    thumbnail_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COLLECTION THEMES (M2M relationship)
-- ============================================
CREATE TABLE collection_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    collection_id UUID REFERENCES theme_collections(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    
    display_order INT DEFAULT 0,
    
    UNIQUE(collection_id, theme_id)
);

-- ============================================
-- SUBSCRIPTIONS (Unlimited themes subscription)
-- ============================================
CREATE TABLE theme_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    plan TEXT NOT NULL                       -- 'starter','pro','agency','enterprise'
        CHECK (plan IN ('starter','pro','agency','enterprise')),
    
    -- Pricing
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    billing_interval TEXT                    -- 'month' or 'year'
        CHECK (billing_interval IN ('month','year')),
    
    -- Stripe
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    
    -- Status
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active','cancelled','paused','expired','past_due')),
    
    -- Periods
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Features
    max_installations INT,                   -- NULL = unlimited
    included_platforms TEXT[],               -- Platforms included in subscription
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ============================================
-- ANALYTICS (Theme performance tracking)
-- ============================================
CREATE TABLE theme_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Period
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    
    -- Traffic metrics
    page_views INT DEFAULT 0,
    unique_visitors INT DEFAULT 0,
    avg_session_duration INT DEFAULT 0,      -- seconds
    bounce_rate DECIMAL(5,2) DEFAULT 0,      -- percentage
    
    -- E-commerce metrics (for store themes)
    conversion_rate DECIMAL(5,2),
    total_revenue DECIMAL(10,2),
    avg_order_value DECIMAL(10,2),
    add_to_cart_rate DECIMAL(5,2),
    checkout_completion_rate DECIMAL(5,2),
    
    -- Performance metrics
    avg_page_load_time INT,                  -- milliseconds
    lighthouse_performance INT,              -- 0-100
    lighthouse_accessibility INT,
    lighthouse_seo INT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(theme_id, site_id, period_start)
);

-- ============================================
-- A/B TESTS
-- ============================================
CREATE TABLE theme_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    name TEXT NOT NULL,
    description TEXT,
    
    -- Variants
    variant_a_theme_id UUID REFERENCES themes(id),
    variant_b_theme_id UUID REFERENCES themes(id),
    
    -- Traffic split
    traffic_split INT DEFAULT 50,            -- % to variant B
    
    -- Status
    status TEXT DEFAULT 'draft'
        CHECK (status IN ('draft','running','paused','completed')),
    
    -- Results
    variant_a_conversions INT DEFAULT 0,
    variant_b_conversions INT DEFAULT 0,
    variant_a_visitors INT DEFAULT 0,
    variant_b_visitors INT DEFAULT 0,
    winner TEXT                              -- 'a', 'b', or 'tie'
        CHECK (winner IS NULL OR winner IN ('a','b','tie')),
    
    -- Dates
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AUDIT LOGS (Security & compliance)
-- ============================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Who
    user_id UUID REFERENCES users(id),
    user_email TEXT,
    
    -- What
    action TEXT NOT NULL,                    -- 'purchase','download','install','uninstall','refund'
    resource_type TEXT,                      -- 'theme','collection','subscription'
    resource_id UUID,
    
    -- Details
    metadata JSONB DEFAULT '{}',
    
    -- Where
    ip_address TEXT,
    user_agent TEXT,
    
    -- When
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LICENSES (Advanced license management)
-- ============================================
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    purchase_id UUID REFERENCES theme_purchases(id) ON DELETE CASCADE,
    
    license_key TEXT UNIQUE NOT NULL,
    license_type TEXT NOT NULL
        CHECK (license_type IN ('single_site','multi_site','unlimited','agency','enterprise')),
    
    -- Limits
    max_activations INT,                     -- NULL = unlimited
    current_activations INT DEFAULT 0,
    
    -- Status
    status TEXT DEFAULT 'active'
        CHECK (status IN ('active','suspended','revoked','expired')),
    
    -- Expiration (for time-limited licenses)
    expires_at TIMESTAMPTZ,
    
    -- Metadata
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    last_validated_at TIMESTAMPTZ,
    
    -- Security
    checksum TEXT                            -- For license validation
);

-- ============================================
-- LICENSE ACTIVATIONS (Track where licenses are used)
-- ============================================
CREATE TABLE license_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    
    -- Site info
    site_url TEXT NOT NULL,
    site_fingerprint TEXT,                   -- Unique site identifier
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WISHLISTS
-- ============================================
CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    
    added_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, theme_id)
);

-- ============================================
-- THEME SUPPORT TICKETS
-- ============================================
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    purchase_id UUID REFERENCES theme_purchases(id),
    
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    
    status TEXT DEFAULT 'open'
        CHECK (status IN ('open','in_progress','waiting_for_customer','resolved','closed')),
    
    priority TEXT DEFAULT 'normal'
        CHECK (priority IN ('low','normal','high','urgent')),
    
    -- Assignment
    assigned_to UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- ============================================
-- SUPPORT MESSAGES
-- ============================================
CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    message TEXT NOT NULL,
    is_staff_reply BOOLEAN DEFAULT false,
    
    -- Attachments
    attachments TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Indexes

```sql
-- Performance indexes
CREATE INDEX idx_themes_category ON themes(category);
CREATE INDEX idx_themes_active ON themes(is_active) WHERE is_active = true;
CREATE INDEX idx_themes_featured ON themes(is_featured) WHERE is_featured = true;
CREATE INDEX idx_themes_slug ON themes(slug);
CREATE INDEX idx_themes_rating ON themes(rating DESC);

CREATE INDEX idx_purchases_user ON theme_purchases(user_id);
CREATE INDEX idx_purchases_theme ON theme_purchases(theme_id);
CREATE INDEX idx_purchases_status ON theme_purchases(status);
CREATE INDEX idx_purchases_type ON theme_purchases(purchase_type);

CREATE INDEX idx_installs_site ON theme_installations(site_id);
CREATE INDEX idx_installs_active ON theme_installations(site_id, is_active) WHERE is_active = true;

CREATE INDEX idx_reviews_theme ON theme_reviews(theme_id);
CREATE INDEX idx_reviews_approved ON theme_reviews(is_approved) WHERE is_approved = true;

CREATE INDEX idx_analytics_theme_period ON theme_analytics(theme_id, period_start);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_status ON licenses(status);

-- Full-text search
CREATE INDEX idx_themes_search ON themes 
    USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
```

### 4.3 Row Level Security (RLS)

```sql
-- Enable RLS
ALTER TABLE themes ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

-- Policies for themes (public read, admin write)
CREATE POLICY "Public can view active themes" ON themes
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage themes" ON themes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin','theme_admin')
        )
    );

-- Policies for purchases (users see own purchases)
CREATE POLICY "Users view own purchases" ON theme_purchases
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create purchases" ON theme_purchases
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for installations
CREATE POLICY "Users manage own installations" ON theme_installations
    FOR ALL USING (auth.uid() = user_id);

-- Policies for reviews (public read, users create)
CREATE POLICY "Public view approved reviews" ON theme_reviews
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Users create reviews" ON theme_reviews
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own reviews" ON theme_reviews
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for subscriptions
CREATE POLICY "Users manage own subscriptions" ON theme_subscriptions
    FOR ALL USING (auth.uid() = user_id);

-- Policies for licenses
CREATE POLICY "Users view own licenses" ON licenses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM theme_purchases 
            WHERE theme_purchases.id = licenses.purchase_id 
            AND theme_purchases.user_id = auth.uid()
        )
    );

-- Policies for wishlists
CREATE POLICY "Users manage own wishlists" ON wishlists
    FOR ALL USING (auth.uid() = user_id);

-- Policies for support tickets
CREATE POLICY "Users manage own tickets" ON support_tickets
    FOR ALL USING (
        auth.uid() = user_id OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.role IN ('super_admin','support_admin')
        )
    );
```

---

## 5. Authentication & Security

### 5.1 Authentication Flow

```
┌─────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION ARCHITECTURE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Supabase Auth (accounts.letbuyy.store)                     │
│  ├── Email/Password                                         │
│  ├── Google OAuth                                           │
│  ├── Apple Sign In                                          │
│  ├── GitHub OAuth (for developers)                          │
│  └── 2FA (TOTP)                                             │
│                                                             │
│  Session Management:                                        │
│  • Cookie Domain: .letbuyy.store (shared across subdomains) │
│  • Session Duration: 7 days                                 │
│  • Refresh Token: 30 days                                   │
│  • Auto-refresh: 55 minutes                                 │
│                                                             │
│  Auth Gates:                                                │
│  • Browse themes: ❌ No auth required                        │
│  • View details: ❌ No auth required                         │
│  • Live demos: ❌ No auth required                           │
│  • Checkout: ✅ Auth required                                │
│  • Dashboard: ✅ Auth required                               │
│  • Downloads: ✅ Auth + license required                     │
│  • Admin: ✅ Admin role required                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Authorization Roles

```sql
-- User roles (in users table)
CREATE TYPE user_role AS ENUM (
    'customer',           -- Regular user
    'developer',          -- Theme developer
    'agency',             -- Agency partner
    'theme_admin',        -- Can manage theme catalog
    'support_admin',      -- Can manage support tickets
    'super_admin'         -- Full access
);

ALTER TABLE users ADD COLUMN role user_role DEFAULT 'customer';
```

### 5.3 Security Measures

| Security Layer | Implementation | Purpose |
|----------------|----------------|---------|
| **Rate Limiting** | Redis + Upstash | Prevent brute force, API abuse |
| **CSP Headers** | Next.js middleware | XSS protection |
| **CORS** | Restricted origins | Prevent unauthorized API access |
| **SQL Injection** | Supabase parameterized queries | Database security |
| **XSS** | DOMPurify + CSP | Script injection prevention |
| **CSRF** | SameSite cookies + tokens | Cross-site request forgery protection |
| **License Validation** | JWT + checksum | Prevent theme piracy |
| **Download Watermarking** | User ID in comments | Track unauthorized distribution |
| **Signed URLs** | Cloudflare Workers | Secure file downloads |
| **Audit Logging** | audit_logs table | Compliance & forensics |
| **2FA** | TOTP | Account takeover prevention |
| **IP Whitelisting** | Admin panel only | Restrict admin access |

### 5.4 License Validation System

```typescript
// packages/licensing/src/validator.ts

interface LicenseValidationRequest {
  licenseKey: string;
  siteUrl: string;
  siteFingerprint: string;
  themeId: string;
}

interface LicenseValidationResponse {
  valid: boolean;
  license?: {
    id: string;
    type: string;
    maxActivations: number;
    currentActivations: number;
    expiresAt?: string;
  };
  error?: string;
}

export async function validateLicense(
  req: LicenseValidationRequest
): Promise {
  
  // 1. Verify license key format
  if (!isValidLicenseKeyFormat(req.licenseKey)) {
    return { valid: false, error: 'Invalid license key format' };
  }
  
  // 2. Query license from database
  const license = await supabase
    .from('licenses')
    .select('*, purchases:theme_purchases(*)')
    .eq('license_key', req.licenseKey)
    .eq('purchases.theme_id', req.themeId)
    .single();
  
  if (!license) {
    return { valid: false, error: 'License not found' };
  }
  
  // 3. Check license status
  if (license.status !== 'active') {
    return { valid: false, error: `License is ${license.status}` };
  }
  
  // 4. Check expiration
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, error: 'License has expired' };
  }
  
  // 5. Check activation limit
  if (
    license.max_activations && 
    license.current_activations >= license.max_activations
  ) {
    // Check if this site is already activated
    const existingActivation = await supabase
      .from('license_activations')
      .select()
      .eq('license_id', license.id)
      .eq('site_fingerprint', req.siteFingerprint)
      .eq('is_active', true)
      .single();
    
    if (!existingActivation) {
      return { valid: false, error: 'Activation limit reached' };
    }
  }
  
  // 6. Record activation
  await supabase.from('license_activations').upsert({
    license_id: license.id,
    site_url: req.siteUrl,
    site_fingerprint: req.siteFingerprint,
    is_active: true,
    last_seen_at: new Date().toISOString()
  });
  
  // 7. Update last validated timestamp
  await supabase
    .from('licenses')
    .update({ last_validated_at: new Date().toISOString() })
    .eq('id', license.id);
  
  // 8. Log validation
  await supabase.from('audit_logs').insert({
    user_id: license.purchases.user_id,
    action: 'license_validation',
    resource_type: 'license',
    resource_id: license.id,
    metadata: { site_url: req.siteUrl }
  });
  
  return {
    valid: true,
    license: {
      id: license.id,
      type: license.license_type,
      maxActivations: license.max_activations,
      currentActivations: license.current_activations,
      expiresAt: license.expires_at
    }
  };
}
```

---

## 6. Apps & Structure

### 6.1 Theme Marketplace App

```
apps/web/theme-marketplace/
├── package.json
├── next.config.ts
├── tsconfig.json
├── middleware.ts                  # Auth guard, rate limiting
│
├── src/
│   ├── app/
│   │   ├── layout.tsx            # Root layout
│   │   ├── globals.css           # Design system
│   │   ├── page.tsx              # Gallery
│   │   │
│   │   ├── [slug]/
│   │   │   └── page.tsx          # Theme detail
│   │   │
│   │   ├── collections/
│   │   │   ├── page.tsx          # All collections
│   │   │   └── [slug]/page.tsx   # Collection detail
│   │   │
│   │   ├── categories/
│   │   │   └── [category]/page.tsx  # Category browse
│   │   │
│   │   ├── search/
│   │   │   └── page.tsx          # Search results
│   │   │
│   │   ├── dashboard/
│   │   │   ├── layout.tsx        # Sidebar layout
│   │   │   ├── page.tsx          # Overview
│   │   │   ├── themes/page.tsx   # My themes
│   │   │   ├── downloads/page.tsx # My downloads
│   │   │   ├── stores/page.tsx   # My stores
│   │   │   ├── subscription/page.tsx # Subscription
│   │   │   ├── wishlist/page.tsx # Wishlist
│   │   │   ├── licenses/page.tsx # License management
│   │   │   └── support/          # Support tickets
│   │   │       ├── page.tsx
│   │   │       └── [id]/page.tsx
│   │   │
│   │   ├── checkout/
│   │   │   ├── [slug]/page.tsx   # Theme checkout
│   │   │   ├── collection/[slug]/page.tsx  # Collection checkout
│   │   │   ├── subscription/page.tsx  # Subscription checkout
│   │   │   └── success/page.tsx  # Success page
│   │   │
│   │   ├── download/
│   │   │   └── [purchaseId]/[platform]/page.tsx  # Secure download
│   │   │
│   │   ├── pricing/
│   │   │   └── page.tsx          # Pricing page
│   │   │
│   │   ├── docs/
│   │   │   ├── page.tsx          # Documentation home
│   │   │   ├── getting-started/page.tsx
│   │   │   ├── wordpress/page.tsx
│   │   │   ├── shopify/page.tsx
│   │   │   └── api/page.tsx      # API docs
│   │   │
│   │   └── api/
│   │       ├── themes/
│   │       │   ├── route.ts      # GET list themes
│   │       │   ├── [slug]/route.ts  # GET theme detail
│   │       │   └── search/route.ts  # POST search
│   │       │
│   │       ├── collections/
│   │       │   └── route.ts      # GET collections
│   │       │
│   │       ├── purchases/
│   │       │   ├── route.ts      # POST create purchase
│   │       │   └── [id]/route.ts # GET purchase detail
│   │       │
│   │       ├── installations/
│   │       │   ├── route.ts      # POST install theme
│   │       │   └── [id]/route.ts # DELETE uninstall
│   │       │
│   │       ├── downloads/
│   │       │   ├── generate/route.ts  # POST generate download
│   │       │   └── [id]/route.ts      # GET download file
│   │       │
│   │       ├── reviews/
│   │       │   ├── route.ts      # GET/POST reviews
│   │       │   └── vote/route.ts # POST vote helpful
│   │       │
│   │       ├── wishlist/
│   │       │   └── route.ts      # GET/POST/DELETE
│   │       │
│   │       ├── subscriptions/
│   │       │   ├── create/route.ts
│   │       │   ├── cancel/route.ts
│   │       │   └── update/route.ts
│   │       │
│   │       ├── licenses/
│   │       │   ├── validate/route.ts  # POST validate license
│   │       │   └── deactivate/route.ts # POST deactivate
│   │       │
│   │       ├── support/
│   │       │   ├── tickets/route.ts   # GET/POST tickets
│   │       │   └── messages/route.ts  # POST message
│   │       │
│   │       ├── checkout/
│   │       │   ├── stripe/
│   │       │   │   ├── create-session/route.ts
│   │       │   │   └── webhook/route.ts
│   │       │   └── razorpay/
│   │       │       ├── create-order/route.ts
│   │       │       └── verify/route.ts
│   │       │
│   │       └── webhooks/
│   │           ├── stripe/route.ts
│   │           └── razorpay/route.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── header.tsx
│   │   │   ├── footer.tsx
│   │   │   ├── sidebar.tsx
│   │   │   └── mobile-menu.tsx
│   │   │
│   │   ├── gallery/
│   │   │   ├── hero.tsx
│   │   │   ├── theme-card.tsx
│   │   │   ├── theme-grid.tsx
│   │   │   ├── filter-bar.tsx
│   │   │   ├── sort-dropdown.tsx
│   │   │   └── search-bar.tsx
│   │   │
│   │   ├── detail/
│   │   │   ├── screenshot-carousel.tsx
│   │   │   ├── feature-grid.tsx
│   │   │   ├── review-section.tsx
│   │   │   ├── review-form.tsx
│   │   │   ├── pricing-card.tsx
│   │   │   ├── platform-selector.tsx
│   │   │   └── related-themes.tsx
│   │   │
│   │   ├── checkout/
│   │   │   ├── order-summary.tsx
│   │   │   ├── payment-form.tsx
│   │   │   ├── coupon-input.tsx
│   │   │   └── success-card.tsx
│   │   │
│   │   ├── dashboard/
│   │   │   ├── stats-grid.tsx
│   │   │   ├── theme-card-horizontal.tsx
│   │   │   ├── download-card.tsx
│   │   │   ├── store-selector.tsx
│   │   │   ├── license-manager.tsx
│   │   │   └── subscription-card.tsx
│   │   │
│   │   ├── collections/
│   │   │   ├── collection-card.tsx
│   │   │   └── collection-grid.tsx
│   │   │
│   │   ├── support/
│   │   │   ├── ticket-list.tsx
│   │   │   ├── ticket-detail.tsx
│   │   │   └── message-thread.tsx
│   │   │
│   │   └── ui/                   # shadcn/ui components
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       ├── dialog.tsx
│   │       ├── dropdown.tsx
│   │       ├── input.tsx
│   │       ├── badge.tsx
│   │       ├── tabs.tsx
│   │       ├── toast.tsx
│   │       └── ...
│   │
│   └── lib/
│       ├── supabase/
│       │   ├── server.ts
│       │   └── client.ts
│       ├── services/
│       │   ├── theme.service.ts
│       │   ├── purchase.service.ts
│       │   ├── download.service.ts
│       │   ├── license.service.ts
│       │   └── analytics.service.ts
│       ├── auth.ts
│       ├── stripe.ts
│       ├── razorpay.ts
│       └── utils.ts
│
└── public/
    ├── og/                       # OG images
    └── assets/
```

### 6.2 Theme Admin App

```
apps/web/theme-admin/
├── package.json
├── next.config.ts
├── middleware.ts                 # Admin role check
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx              # Dashboard
│   │   │
│   │   ├── themes/
│   │   │   ├── page.tsx          # Theme list
│   │   │   ├── new/page.tsx      # Create theme
│   │   │   └── [id]/
│   │   │       ├── page.tsx      # Edit theme
│   │   │       ├── versions/page.tsx  # Version history
│   │   │       ├── analytics/page.tsx # Theme analytics
│   │   │       └── reviews/page.tsx   # Review moderation
│   │   │
│   │   ├── collections/
│   │   │   ├── page.tsx          # Collection list
│   │   │   ├── new/page.tsx      # Create collection
│   │   │   └── [id]/page.tsx     # Edit collection
│   │   │
│   │   ├── users/
│   │   │   ├── page.tsx          # User list
│   │   │   └── [id]/page.tsx     # User detail
│   │   │
│   │   ├── purchases/
│   │   │   ├── page.tsx          # Purchase list
│   │   │   └── [id]/page.tsx     # Purchase detail
│   │   │
│   │   ├── licenses/
│   │   │   ├── page.tsx          # License list
│   │   │   └── [id]/page.tsx     # License detail
│   │   │
│   │   ├── support/
│   │   │   ├── page.tsx          # Ticket list
│   │   │   └── [id]/page.tsx     # Ticket detail
│   │   │
│   │   ├── analytics/
│   │   │   ├── page.tsx          # Overview
│   │   │   ├── revenue/page.tsx  # Revenue analytics
│   │   │   ├── themes/page.tsx   # Theme performance
│   │   │   └── users/page.tsx    # User analytics
│   │   │
│   │   ├── settings/
│   │   │   ├── page.tsx          # General settings
│   │   │   ├── pricing/page.tsx  # Pricing config
│   │   │   └── integrations/page.tsx  # API keys, webhooks
│   │   │
│   │   └── api/
│   │       ├── themes/
│   │       │   ├── route.ts      # CRUD themes
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── publish/route.ts
│   │       │       └── deprecate/route.ts
│   │       │
│   │       ├── collections/
│   │       │   └── route.ts
│   │       │
│   │       ├── reviews/
│   │       │   ├── moderate/route.ts
│   │       │   └── respond/route.ts
│   │       │
│   │       ├── licenses/
│   │       │   ├── revoke/route.ts
│   │       │   └── extend/route.ts
│   │       │
│   │       └── analytics/
│   │           ├── dashboard/route.ts
│   │           └── export/route.ts
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── admin-header.tsx
│   │   │   ├── admin-sidebar.tsx
│   │   │   └── breadcrumbs.tsx
│   │   │
│   │   ├── themes/
│   │   │   ├── theme-form.tsx
│   │   │   ├── theme-table.tsx
│   │   │   ├── version-manager.tsx
│   │   │   └── demo-config-editor.tsx
│   │   │
│   │   ├── analytics/
│   │   │   ├── revenue-chart.tsx
│   │   │   ├── theme-performance.tsx
│   │   │   └── user-growth.tsx
│   │   │
│   │   └── ui/
│   │
│   └── lib/
│       ├── services/
│       │   ├── admin-theme.service.ts
│       │   ├── admin-analytics.service.ts
│       │   └── admin-license.service.ts
│       └── utils/
│
└── public/
```

### 6.3 Shared Packages

```
packages/typescript/theme-engine/
├── package.json
├── src/
│   ├── index.ts
│   ├── renderer/
│   │   ├── server.tsx            # SSR rendering
│   │   └── client.tsx            # Client hydration
│   │
│   ├── registry/
│   │   └── index.ts              # THEME_REGISTRY
│   │
│   ├── themes/
│   │   ├── store/
│   │   │   ├── urban-kicks/
│   │   │   ├── luxe-atelier/
│   │   │   └── neon-tech/
│   │   │
│   │   ├── portfolio/
│   │   │   ├── creative-folio/
│   │   │   └── dark-portfolio/
│   │   │
│   │   ├── resume/
│   │   └── landing/
│   │
│   ├── types/
│   │   ├── theme.ts
│   │   ├── config.ts
│   │   └── props.ts
│   │
│   └── utils/
│       ├── merge-configs.ts
│       └── validate-theme.ts
│
└── themes/                       # Theme implementations
    └── [theme-name]/
        ├── index.tsx             # Main component
        ├── config.ts             # Theme config
        ├── components/           # Theme-specific components
        └── styles.css            # Theme styles
```

```
packages/typescript/theme-converter/
├── package.json
├── src/
│   ├── index.ts
│   ├── converters/
│   │   ├── wordpress/
│   │   │   ├── index.ts
│   │   │   ├── theme-generator.ts
│   │   │   ├── functions-php.ts
│   │   │   └── templates/
│   │   │
│   │   ├── shopify/
│   │   │   ├── index.ts
│   │   │   ├── liquid-generator.ts
│   │   │   ├── sections/
│   │   │   └── config/
│   │   │
│   │   ├── html/
│   │   │   ├── index.ts
│   │   │   └── static-generator.ts
│   │   │
│   │   └── react/
│   │       ├── index.ts
│   │       └── component-generator.ts
│   │
│   ├── builders/
│   │   ├── zip-builder.ts        # Create downloadable zips
│   │   └── watermark.ts          # Add user watermarks
│   │
│   └── types/
│
└── templates/                    # Base templates for each platform
    ├── wordpress/
    ├── shopify/
    ├── html/
    └── react/
```

```
packages/typescript/licensing/
├── package.json
├── src/
│   ├── index.ts
│   ├── generator.ts              # Generate license keys
│   ├── validator.ts              # Validate licenses
│   ├── fingerprint.ts            # Site fingerprinting
│   └── types.ts
│
└── tests/
```

```
packages/typescript/security/
├── package.json
├── src/
│   ├── index.ts
│   ├── rate-limiter.ts           # Redis rate limiting
│   ├── csrf.ts                   # CSRF protection
│   ├── sanitize.ts               # Input sanitization
│   └── audit-logger.ts           # Audit logging
│
└── tests/
```

---

## 7. API Architecture

### 7.1 REST API Endpoints

#### **Themes API**

```typescript
// GET /api/themes
// List all themes with filters
interface ThemesListRequest {
  category?: 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
  pricing?: 'free' | 'paid';
  industry?: string[];
  tags?: string[];
  search?: string;
  sort?: 'popular' | 'newest' | 'rating' | 'price_low' | 'price_high';
  page?: number;
  limit?: number;
}

interface ThemesListResponse {
  themes: Theme[];
  total: number;
  page: number;
  pages: number;
}

// GET /api/themes/[slug]
interface ThemeDetailResponse {
  theme: Theme;
  reviews: Review[];
  relatedThemes: Theme[];
  versions: ThemeVersion[];
}

// POST /api/themes/search
interface ThemeSearchRequest {
  query: string;
  filters?: ThemesListRequest;
}
```

#### **Purchases API**

```typescript
// POST /api/purchases
interface CreatePurchaseRequest {
  themeId: string;
  purchaseType: 'letbuyy_integration' | 'platform_download';
  platform?: 'wordpress' | 'shopify' | 'html' | 'react' | 'all_platforms';
  paymentMethod: 'stripe' | 'razorpay' | 'free';
}

interface CreatePurchaseResponse {
  purchaseId: string;
  checkoutUrl?: string;  // For paid purchases
  licenseKey?: string;   // For free purchases
}

// GET /api/purchases/[id]
interface PurchaseDetailResponse {
  purchase: ThemePurchase;
  theme: Theme;
  downloadUrl?: string;
  license: License;
}
```

#### **Downloads API**

```typescript
// POST /api/downloads/generate
interface GenerateDownloadRequest {
  purchaseId: string;
  platform: 'wordpress' | 'shopify' | 'html' | 'react';
}

interface GenerateDownloadResponse {
  downloadUrl: string;  // Signed URL, expires in 24h
  expiresAt: string;
  fileSize: number;
  checksum: string;
}

// GET /api/downloads/[id]
// Returns actual file (secured with signed URL)
```

#### **Installations API**

```typescript
// POST /api/installations
interface InstallThemeRequest {
  themeId: string;
  siteId: string;
  purchaseId: string;
}

interface InstallThemeResponse {
  installation: ThemeInstallation;
  success: boolean;
}

// DELETE /api/installations/[id]
// Uninstall theme from site
```

#### **Licenses API**

```typescript
// POST /api/licenses/validate
interface ValidateLicenseRequest {
  licenseKey: string;
  siteUrl: string;
  siteFingerprint: string;
  themeId: string;
}

interface ValidateLicenseResponse {
  valid: boolean;
  license?: License;
  error?: string;
}

// POST /api/licenses/deactivate
interface DeactivateLicenseRequest {
  licenseKey: string;
  siteFingerprint: string;
}
```

#### **Subscriptions API**

```typescript
// POST /api/subscriptions/create
interface CreateSubscriptionRequest {
  plan: 'starter' | 'pro' | 'agency' | 'enterprise';
  billingInterval: 'month' | 'year';
}

interface CreateSubscriptionResponse {
  subscriptionId: string;
  checkoutUrl: string;
}

// POST /api/subscriptions/cancel
// POST /api/subscriptions/update
```

### 7.2 Webhook Handlers

```typescript
// POST /api/webhooks/stripe
// Handle Stripe webhook events
// Events: checkout.session.completed, customer.subscription.created, etc.

// POST /api/webhooks/razorpay
// Handle Razorpay webhook events
```

### 7.3 Rate Limiting

```typescript
// Rate limits per endpoint
const RATE_LIMITS = {
  '/api/themes': '100 requests per 15 minutes',
  '/api/themes/search': '30 requests per minute',
  '/api/purchases': '10 requests per minute',
  '/api/downloads/generate': '5 requests per hour',
  '/api/licenses/validate': '100 requests per hour',
  '/api/reviews': '10 requests per hour',
};
```

---

## 8. UI Wireframes (Detailed)

### 8.1 GALLERY PAGE — `themes.letbuyy.store`

```
┌──────────────────────────────────────────────────────────────────────┐
│  ╔════════════════════════════════════════════════════════════════╗  │
│  ║  HEADER (glassmorphism, backdrop-blur, sticky)                 ║  │
│  ╠════════════════════════════════════════════════════════════════╣  │
│  ║                                                                ║  │
│  ║  🎨 LetBuyy Themes          Browse   Pricing   Docs            ║  │
│  ║                                                                ║  │
│  ║  Right side:                                          [Search] ║  │
│  ║  • Not logged in → [Browse] (no login button)                  ║  │
│  ║  • Logged in → [👤 Avatar ▾]                                  ║  │
│  ║      Dropdown:                                                 ║  │
│  ║      - Dashboard                                               ║  │
│  ║      - My Themes                                               ║  │
│  ║      - My Downloads                                            ║  │
│  ║      - Subscription                                            ║  │
│  ║      - Wishlist                                                ║  │
│  ║      - Support                                                 ║  │
│  ║      ───                                                       ║  │
│  ║      - Settings                                                ║  │
│  ║      - Logout                                                  ║  │
│  ╚════════════════════════════════════════════════════════════════╝  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  HERO SECTION                                                 │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │  bg: animated gradient mesh (indigo → violet → fuchsia)       │  │
│  │  + floating orbs with blur (subtle parallax on scroll)        │  │
│  │                                                               │  │
│  │               ✨ Professional Themes for                      │  │
│  │                  Every Business                               │  │
│  │                                                               │  │
│  │   Build stunning websites with our production-ready themes.   │  │
│  │   Install instantly on LetBuyy or download for WordPress,     │  │
│  │   Shopify, and more.                                          │  │
│  │                                                               │  │
│  │   ┌───────────────────────────────────────────────────────┐   │  │
│  │   │  🔍 Search themes, categories, tags...               │   │  │
│  │   └───────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │   [Browse All Themes →]  [View Documentation]                 │  │
│  │                                                               │  │
│  │   262 themes • 4 categories • Free & Premium • 50K+ users     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  FEATURED COLLECTIONS (horizontal scroll)                     │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ ╔══════╗ │  │ ╔══════╗ │  │ ╔══════╗ │  │ ╔══════╗ │     │  │
│  │  │ ║ Img  ║ │  │ ║ Img  ║ │  │ ║ Img  ║ │  │ ║ Img  ║ │     │  │
│  │  │ ╚══════╝ │  │ ╚══════╝ │  │ ╚══════╝ │  │ ╚══════╝ │     │  │
│  │  │ Best     │  │ Fashion  │  │ SaaS     │  │ Portfolio│     │  │
│  │  │ Sellers  │  │ Themes   │  │ Starter  │  │ Bundle   │     │  │
│  │  │ 6 themes │  │ 8 themes │  │ 4 themes │  │ 10 themes│     │  │
│  │  │ $199     │  │ $129     │  │ $89      │  │ $299     │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  │                                                               │  │
│  │  [View All Collections →]                                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  FILTER & SORT BAR (sticky on scroll)                         │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  Category:                                                    │  │
│  │  [All] [🛒 Store] [🎨 Portfolio] [📄 Resume] [🚀 Landing]     │  │
│  │  [💼 SaaS]                                                    │  │
│  │                                                               │  │
│  │  Industry:                                                    │  │
│  │  [Fashion] [Tech] [Food] [Fitness] [Real Estate] [+12 more]  │  │
│  │                                                               │  │
│  │  Pricing:                                                     │  │
│  │  [All] [Free] [Premium] [Subscription]                        │  │
│  │                                                               │  │
│  │  Platform:                                                    │  │
│  │  [LetBuyy] [WordPress] [Shopify] [HTML] [React]              │  │
│  │                                                               │  │
│  │  Sort: [Most Popular ▾]                                       │  │
│  │  └─ Dropdown:                                                 │  │
│  │     • Most Popular                                            │  │
│  │     • Newest First                                            │  │
│  │     • Highest Rated                                           │  │
│  │     • Price: Low to High                                      │  │
│  │     • Price: High to Low                                      │  │
│  │     • Most Installed                                          │  │
│  │                                                               │  │
│  │  262 results  [Clear Filters]                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  THEME GRID (3 cols desktop, 2 tablet, 1 mobile)              │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ┌─ THEME CARD ──────────┐  ┌─ THEME CARD ──────────┐        │  │
│  │  │ ╔══════════════════╗  │  │ ╔══════════════════╗  │        │  │
│  │  │ ║                  ║  │  │ ║                  ║  │        │  │
│  │  │ ║  Thumbnail       ║  │  │ ║  Thumbnail       ║  │        │  │
│  │  │ ║  (16:10 ratio)   ║  │  │ ║  (16:10 ratio)   ║  │        │  │
│  │  │ ║                  ║  │  │ ║                  ║  │        │  │
│  │  │ ║  HOVER:          ║  │  │ ║  HOVER:          ║  │        │  │
│  │  │ ║  ┌─────────────┐ ║  │  │ ║  ┌─────────────┐ ║  │        │  │
│  │  │ ║  │ Overlay     │ ║  │  │ ║  │ Overlay     │ ║  │        │  │
│  │  │ ║  │ (dark 60%)  │ ║  │  │ ║  │             │ ║  │        │  │
│  │  │ ║  │             │ ║  │  │ ║  │ [ ❤️ Save ] │ ║  │        │  │
│  │  │ ║  │ [ 🔗 Demo ] │ ║  │  │ ║  │             │ ║  │        │  │
│  │  │ ║  │   ↑ new tab │ ║  │  │ ║  │ [ 🔗 Demo ] │ ║  │        │  │
│  │  │ ║  │             │ ║  │  │ ║  │             │ ║  │        │  │
│  │  │ ║  │ [ Details ] │ ║  │  │ ║  │ [ Details ] │ ║  │        │  │
│  │  │ ║  └─────────────┘ ║  │  │ ║  └─────────────┘ ║  │        │  │
│  │  │ ╚══════════════════╝  │  │ ╚══════════════════╝  │        │  │
│  │  │                      │  │                      │        │  │
│  │  │ 💎 PREMIUM           │  │ 🏷️ FREE             │        │  │
│  │  │                      │  │                      │        │  │
│  │  │ Urban Kicks          │  │ Nature's Basket      │        │  │
│  │  │ Clean minimal store  │  │ Organic e-commerce   │        │  │
│  │  │                      │  │                      │        │  │
│  │  │ ★★★★★ 4.8 (124)     │  │ ★★★★☆ 4.6 (98)      │        │  │
│  │  │ 📦 1,240 installs    │  │ 📦 890 installs      │        │  │
│  │  │                      │  │                      │        │  │
│  │  │ LetBuyy: FREE        │  │ LetBuyy: FREE        │        │  │
│  │  │ WordPress: +$49      │  │ All platforms: FREE  │        │  │
│  │  │                      │  │                      │        │  │
│  │  │ [Store]              │  │ [Store]              │        │  │
│  │  │ #streetwear #minimal │  │ #organic #food       │        │  │
│  │  └──────────────────────┘  └──────────────────────┘        │  │
│  │                                                               │  │
│  │  ┌─ THEME CARD ──────────┐  ┌─ THEME CARD ──────────┐        │  │
│  │  │ ...                   │  │ ...                   │        │  │
│  │  └──────────────────────┘  └──────────────────────┘        │  │
│  │                                                               │  │
│  │  ... (repeat for all themes)                                  │  │
│  │                                                               │  │
│  │  ┌─ PAGINATION ──────────────────────────────────────────┐   │  │
│  │  │  [← Prev]  [1] [2] 3 [4] [5] ... [26]  [Next →]      │   │  │
│  │  └───────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  SUBSCRIPTION CTA                                             │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │  bg: gradient card (purple → pink)                            │  │
│  │                                                               │  │
│  │           🚀 Unlimited Access                                 │  │
│  │                                                               │  │
│  │   Get unlimited access to all themes for one low price.      │  │
│  │   Install on unlimited LetBuyy sites. Download for any        │  │
│  │   platform. Cancel anytime.                                   │  │
│  │                                                               │  │
│  │   Starting at $19/month                                       │  │
│  │                                                               │  │
│  │   [View Subscription Plans →]                                 │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  STATS SECTION                                                │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │  │
│  │  │ 262+     │  │ 50,000+  │  │ 4.8/5.0  │  │ 99.9%    │     │  │
│  │  │ Themes   │  │ Users    │  │ Rating   │  │ Uptime   │     │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  FOOTER (dark bg: zinc-900)                                   │  │
│  │  ──────────────────────────────────────────────────────────── │  │
│  │                                                               │  │
│  │  🎨 LetBuyy Themes           Products         Resources       │  │
│  │                               Store Themes     Documentation   │  │
│  │  Professional themes for      Portfolio Themes API Reference  │  │
│  │  every business.              Resume Themes    Blog           │  │
│  │                               Landing Themes   Changelog      │  │
│  │                               SaaS Themes      Support        │  │
│  │  [GitHub] [Twitter] [Discord]                                 │  │
│  │                               Company          Legal          │  │
│  │                               About            Terms          │  │
│  │                               Careers          Privacy        │  │
│  │                               Contact          Refunds        │  │
│  │                               Partners         Licenses       │  │
│  │                                                               │  │
│  │  ───────────────────────────────────────────────────────────  │  │
│  │  © 2026 LetBuyy • All rights reserved                        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 THEME DETAIL PAGE — `themes.letbuyy.store/urban-kicks`

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (same as gallery)                                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [← Back to Themes]                                                  │
│                                                                      │
│  Breadcrumb: Themes › Store › Urban Kicks                            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  SPLIT LAYOUT (60% left, 40% right)                            │  │
│  │  ────────────────────────────────────────────────────────────  │  │
│  │                                                                │  │
│  │  LEFT PANEL                                                    │  │
│  │  ┌──────────────────────────┐                                 │  │
│  │  │                          │                                 │  │
│  │  │   MAIN SCREENSHOT        │                                 │  │
│  │  │   (large, 16:10)         │                                 │  │
│  │  │                          │                                 │  │
│  │  │   [← Prev]    [Next →]   │                                 │  │
│  │  │                          │                                 │  │
│  │  └──────────────────────────┘                                 │  │
│  │                                                                │  │
│  │  Thumbnail strip:                                              │  │
│  │  [img1] [img2] [img3] [img4] [img5] [img6]                    │  │
│  │                                                                │  │
│  │  RIGHT PANEL                                                   │  │
│  │  ┌──────────────────────────────────────────────────────────┐ │  │
│  │  │                                                          │ │  │
│  │  │  Urban Kicks                          [❤️ Save] [↗ Share]│ │  │
│  │  │  by LetBuyy Team • v1.0.0 • Store Theme                  │ │  │
│  │  │                                                          │ │  │
│  │  │  Clean, minimal store theme for streetwear & sneaker    │ │  │
│  │  │  brands. Built for performance with a focus on product  │ │  │
│  │  │  imagery and seamless checkout experience.              │ │  │
│  │  │                                                          │ │  │
│  │  │  ★★★★★ 4.8 out of 5  (124 reviews)                      │ │  │
│  │  │  📦 1,240 installs  •  ⚡ Last updated: 2 days ago       │ │  │
│  │  │                                                          │ │  │
│  │  │  ───────────────────────────────────────────────────     │ │  │
│  │  │                                                          │ │  │
│  │  │  🎨 LETBUYY INTEGRATION                                  │ │  │
│  │  │  ┌──────────────────────────────────────────────────┐   │ │  │
│  │  │  │  🏷️ FREE                                          │   │ │  │
│  │  │  │                                                  │   │ │  │
│  │  │  │  [ Install on LetBuyy → ]                        │   │ │  │
│  │  │  │  Instant apply to your store. No setup required. │   │ │  │
│  │  │  │                                                  │   │ │  │
│  │  │  │  ✓ One-click install                             │   │ │  │
│  │  │  │  ✓ Instant preview                               │   │ │  │
│  │  │  │  ✓ Auto-updates                                  │   │ │  │
│  │  │  └──────────────────────────────────────────────────┘   │ │  │
│  │  │                                                          │ │  │
│  │  │  💾 PLATFORM DOWNLOADS                                   │ │  │
│  │  │  ┌──────────────────────────────────────────────────┐   │ │  │
│  │  │  │  Download source code for:                       │   │ │  │
│  │  │  │                                                  │   │ │  │
│  │  │  │  ☐ WordPress      +$49                           │   │ │  │
│  │  │  │  ☐ Shopify        +$59                           │   │ │  │
│  │  │  │  ☐ HTML/CSS       +$39                           │   │ │  │
│  │  │  │  ☐ React          +$89                           │   │ │  │
│  │  │  │                                                  │   │ │  │
│  │  │  │  Bundle: All platforms   $99  (save $128!)       │   │ │  │
│  │  │  │                                                  │   │ │  │
│  │  │  │  Total: $0                                       │   │ │  │
│  │  │  │  [ Add to Cart ]                                 │   │ │  │
│  │  │  └──────────────────────────────────────────────────┘   │ │  │
│  │  │                                                          │ │  │
│  │  │  [ 🔗 View Live Demo → ]                                 │ │  │
│  │  │  Opens urban-kicks.letbuyy.store in new tab              │ │  │
│  │  │                                                          │ │  │
│  │  │  ───────────────────────────────────────────────────     │ │  │
│  │  │                                                          │ │  │
│  │  │  Tags:                                                   │ │  │
│  │  │  [streetwear] [sneakers] [fashion] [minimal] [dark]      │ │  │
│  │  │                                                          │ │  │
│  │  │  Industries:                                             │ │  │
│  │  │  Fashion • Retail • Apparel                              │ │  │
│  │  │                                                          │ │  │
│  │  │  Compatible with:                                        │ │  │
│  │  │  ✓ LetBuyy v2.0+  •  ✓ WordPress 6.0+                    │ │  │
│  │  │  ✓ Shopify 2.0    •  ✓ Modern browsers                   │ │  │
│  │  │                                                          │ │  │
│  │  └──────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  TAB BAR                                                       │  │
│  │  ──────────────────────────────────────────────────────────   │  │
│  │  [ Overview ]  [ Features ]  [ Reviews (124) ]  [ Changelog ] │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ─── OVERVIEW TAB ─────────────────────────────────────────────────  │
│                                                                      │
│  ## About This Theme                                                 │
│                                                                      │
│  Urban Kicks is a bold, minimal e-commerce theme built specifically  │
│  for streetwear brands, sneaker shops, and lifestyle retailers.     │
│  With its clean lines, impactful typography, and focus on product   │
│  imagery, it puts your products front and center.                   │
│                                                                      │
│  The theme features a full-screen hero section, advanced product    │
│  filtering, seamless cart experience, and mobile-first responsive   │
│  design. Every interaction is carefully crafted for maximum         │
│  conversion.                                                        │
│                                                                      │
│  **Perfect For:**                                                   │
│  • Streetwear brands                                                │
│  • Sneaker retailers                                                │
│  • Fashion boutiques                                                │
│  • Lifestyle stores                                                 │
│  • Drop-based selling                                               │
│                                                                      │
│  **What's Included:**                                               │
│  ✓ Responsive design (mobile-first)                                 │
│  ✓ Full-screen hero with video support                              │
│  ✓ Advanced product grid with quick view                            │
│  ✓ Complete cart & checkout flow                                    │
│  ✓ Multi-payment support (Stripe, Razorpay, PayPal, COD)            │
│  ✓ Newsletter signup integration                                    │
│  ✓ Testimonials section                                             │
│  ✓ Instagram feed integration                                       │
│  ✓ SEO optimized (Lighthouse score: 95+)                            │
│  ✓ Performance optimized (< 2s load time)                           │
│                                                                      │
│  ─── FEATURES TAB ──────────────────────────────────────────────     │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ 🎨           │  │ 📱           │  │ ⚡           │               │
│  │ Customizable │  │ Mobile First │  │ Lightning    │               │
│  │ Colors       │  │ Responsive   │  │ Fast         │               │
│  │              │  │              │  │              │               │
│  │ Choose from  │  │ Perfect on   │  │ < 2s load    │               │
│  │ 10 preset    │  │ all devices  │  │ time         │               │
│  │ color schemes│  │              │  │              │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ 🔍           │  │ 🛒           │  │ 💳           │               │
│  │ SEO          │  │ Cart Flow    │  │ Payments     │               │
│  │ Optimized    │  │ Complete     │  │ Stripe,      │               │
│  │ Lighthouse   │  │ AJAX cart    │  │ Razorpay,    │               │
│  │ score: 95+   │  │ experience   │  │ COD, PayPal  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ 📊           │  │ 🌐           │  │ 🔄           │               │
│  │ Analytics    │  │ Multi-       │  │ Auto          │               │
│  │ Dashboard    │  │ Language     │  │ Updates       │               │
│  │              │  │              │  │              │               │
│  │ Track sales  │  │ RTL support  │  │ Seamless     │               │
│  │ & visitors   │  │ included     │  │ version mgmt │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  ─── REVIEWS TAB (124 reviews) ──────────────────────────────────── │
│                                                                      │
│  Rating Distribution:                                                │
│  ★★★★★ ████████████████████████  72% (89)                           │
│  ★★★★☆ █████████████            20% (25)                            │
│  ★★★☆☆ ███                       5% (6)                             │
│  ★★☆☆☆ █                         2% (3)                             │
│  ★☆☆☆☆                           1% (1)                             │
│                                                                      │
│  Sort: [Most Recent ▾]   Filter: [All Stars ▾]                       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ★★★★★  "Absolutely perfect for my sneaker store"             │  │
│  │  by @john_doe • May 15, 2026 • ✓ Verified Purchase            │  │
│  │                                                                │  │
│  │  This theme transformed my store completely. The product       │  │
│  │  grid is stunning and my conversion rate went up 45%...        │  │
│  │                                                                │  │
│  │  [👍 Helpful (12)]  [👎 (1)]                                   │  │
│  │                                                                │  │
│  │  💬 Admin Response:                                            │  │
│  │  "Thank you for the kind words! We're glad the theme..."      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  ★★★★☆  "Great theme, minor customization needed"             │  │
│  │  by @fashionista • May 10, 2026 • ✓ Verified Purchase         │  │
│  │  ...                                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  [Write a Review - requires purchase]                                │
│                                                                      │
│  ─── CHANGELOG TAB ──────────────────────────────────────────────── │
│                                                                      │
│  v1.0.0 — Initial Release (May 1, 2026)                             │
│  • Initial release with all core features                            │
│  • Store theme with product grid, cart, and checkout                 │
│  • Mobile-first responsive design                                    │
│  • Multi-payment support (Stripe, Razorpay, PayPal, COD)            │
│  • SEO optimized (Lighthouse 95+)                                    │
│                                                                      │
│  ─── RELATED THEMES SECTION ─────────────────────────────────────── │
│                                                                      │
│  Similar themes you might like:                                      │
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Luxe     │  │ Neon     │  │ Vintage  │  │ Modern   │            │
│  │ Atelier  │  │ Tech     │  │ Market   │  │ Minimal  │            │
│  │ ★★★★★    │  │ ★★★★☆    │  │ ★★★★★    │  │ ★★★★☆    │            │
│  │ $49      │  │ FREE     │  │ $29      │  │ FREE     │            │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │
│                                                                      │
│  FOOTER (same as gallery)                                            │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.3 DASHBOARD PAGE — `themes.letbuyy.store/dashboard`

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (same as gallery, user avatar active)                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─── SIDEBAR (240px) ──────┐  ┌─── MAIN CONTENT ───────────────┐  │
│  │                          │  │                                  │  │
│  │  👤 John Doe             │  │  Welcome back, John 👋           │  │
│  │  john@example.com        │  │                                  │  │
│  │                          │  │  ┌─── STATS ROW ─────────────┐  │  │
│  │  ─────────────────────   │  │  │                           │  │  │
│  │                          │  │  │  ┌────────┐ ┌────────┐   │  │  │
│  │  📊 Overview      ←      │  │  │  │ 5      │ │ 3      │   │  │  │
│  │  🎨 My Themes            │  │  │  │ Themes │ │ Active │   │  │  │
│  │  💾 My Downloads         │  │  │  └────────┘ └────────┘   │  │  │
│  │  🏪 My Stores            │  │  │                           │  │  │
│  │  ❤️ Wishlist             │  │  │  ┌────────┐ ┌────────┐   │  │  │
│  │  🔑 Licenses             │  │  │  │ 2      │ │ $0     │   │  │  │
│  │  💳 Subscription         │  │  │  │ Stores │ │ Spent  │   │  │  │
│  │  🎫 Support              │  │  │  └────────┘ └────────┘   │  │  │
│  │                          │  │  └───────────────────────────┘  │  │
│  │  ─────────────────────   │  │                                  │  │
│  │                          │  │  ─── RECENTLY INSTALLED ──────── │  │
│  │  ⚙️ Settings             │  │                                  │  │
│  │  🚪 Logout               │  │  ┌── THEME CARD (horizontal) ─┐ │  │
│  │                          │  │  │ [img] Urban Kicks           │ │  │
│  └──────────────────────────┘  │  │       ★★★★★ • Store theme   │ │  │
│                                │  │       Active on: My Store    │ │  │
│                                │  │       Installed: 2 days ago  │ │  │
│                                │  │       [Customize] [Switch]   │ │  │
│                                │  └─────────────────────────────┘ │  │
│                                │                                  │  │
│                                │  ─── QUICK ACTIONS ──────────── │  │
│                                │                                  │  │
│                                │  [Browse More Themes]            │  │
│                                │  [View Subscription Plans]       │  │
│                                │  [Get Support]                   │  │
│                                │                                  │  │
│                                └──────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.4 CHECKOUT PAGE — `themes.letbuyy.store/checkout/urban-kicks`

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER (minimal: logo + back link only)                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [← Back to Theme]                                                   │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  SPLIT LAYOUT (60% left, 40% right)                           │   │
│  │                                                               │   │
│  │  LEFT: ORDER SUMMARY                                          │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │                                                      │    │   │
│  │  │  ┌────────┐  Urban Kicks                             │    │   │
│  │  │  │ [img]  │  Store Theme • v1.0.0                    │    │   │
│  │  │  │        │  by LetBuyy Team                         │    │   │
│  │  │  └────────┘                                          │    │   │
│  │  │                                                      │    │   │
│  │  │  Purchase Type:                                      │    │   │
│  │  │  ◉ LetBuyy Integration — FREE                        │    │   │
│  │  │  ○ Platform Downloads — Select below                 │    │   │
│  │  │                                                      │    │   │
│  │  │  (If platform download selected):                    │    │   │
│  │  │  ☐ WordPress     $49                                 │    │   │
│  │  │  ☐ Shopify       $59                                 │    │   │
│  │  │  ☐ HTML/CSS      $39                                 │    │   │
│  │  │  ☐ React         $89                                 │    │   │
│  │  │  ☐ All Platforms $99 (BEST VALUE — save $128!)       │    │   │
│  │  │                                                      │    │   │
│  │  │  ┌────────────────────────────────┐                  │    │   │
│  │  │  │  🏷️ Coupon Code: [________] [Apply]│              │    │   │
│  │  │  └────────────────────────────────┘                  │    │   │
│  │  │                                                      │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  │                                                               │   │
│  │  RIGHT: PAYMENT                                               │   │
│  │  ┌──────────────────────────────────────────────────────┐    │   │
│  │  │  Order Total                                         │    │   │
│  │  │  LetBuyy Integration:    FREE                        │    │   │
│  │  │  WordPress Download:     $49.00                      │    │   │
│  │  │  ──────────────────────                              │    │   │
│  │  │  Subtotal:               $49.00                      │    │   │
│  │  │  Discount (coupon):      -$10.00                     │    │   │
│  │  │  Tax:                     $0.00                      │    │   │
│  │  │  ══════════════════════                              │    │   │
│  │  │  Total:                  $39.00                      │    │   │
│  │  │                                                      │    │   │
│  │  │  Payment: [💳 Stripe]  [🏦 Razorpay]                │    │   │
│  │  │                                                      │    │   │
│  │  │  [ Complete Purchase → ]                             │    │   │
│  │  │                                                      │    │   │
│  │  │  🔒 Secured by Stripe • 30-day money-back guarantee  │    │   │
│  │  └──────────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  FOOTER (minimal)                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.5 SUCCESS PAGE — `themes.letbuyy.store/checkout/success`

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER                                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  SUCCESS CARD (centered, max-w-lg, gradient emerald → teal)   │   │
│  │                                                               │   │
│  │       ✅ Theme Purchased Successfully!                         │   │
│  │                                                               │   │
│  │       📋 Order #: TH-20260511-001                             │   │
│  │       Theme: Urban Kicks                                      │   │
│  │       Type: LetBuyy Integration + WordPress                   │   │
│  │       Amount: $39.00                                          │   │
│  │       License: LBTH-XXXX-XXXX-XXXX                            │   │
│  │                                                               │   │
│  │       🎨 Apply to Store: [My Sneaker Store ▾]                 │   │
│  │       [ Apply Theme Now → ]                                   │   │
│  │                                                               │   │
│  │       💾 [ Download WordPress Version (.zip) ]                │   │
│  │       5 downloads remaining • Expires in 24h                  │   │
│  │                                                               │   │
│  │       [Go to Dashboard]  [Browse More Themes]                 │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  FOOTER                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.6 PRICING PAGE — `themes.letbuyy.store/pricing`

```
┌──────────────────────────────────────────────────────────────────────┐
│  HEADER                                                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Simple, transparent pricing for every need.                         │
│                                                                      │
│  Toggle: [Monthly] / [Yearly — Save 20%]                             │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ STARTER      │  │ PRO ⭐       │  │ AGENCY       │               │
│  │ $0/mo        │  │ $19/mo       │  │ $49/mo       │               │
│  │              │  │              │  │              │               │
│  │ ✓ Free       │  │ ✓ All free   │  │ ✓ Everything │               │
│  │   themes     │  │   + premium  │  │   in Pro     │               │
│  │ ✓ 1 site     │  │   themes     │  │ ✓ Unlimited  │               │
│  │ ✓ Community  │  │ ✓ 3 sites    │  │   sites      │               │
│  │   support    │  │ ✓ 2 platform │  │ ✓ All        │               │
│  │              │  │   downloads  │  │   platforms  │               │
│  │              │  │ ✓ Email      │  │ ✓ Priority   │               │
│  │              │  │   support    │  │   support    │               │
│  │              │  │              │  │ ✓ White label│               │
│  │ [Get Started]│  │ [Subscribe]  │  │ [Subscribe]  │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│                                                                      │
│  Enterprise? [Contact Sales →]                                       │
│                                                                      │
│  FOOTER                                                              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Multi-Platform Support

### 9.1 Theme Conversion Pipeline

```
LetBuyy Theme (React/Next.js source)
     │
     ├─── WordPress Converter
     │    ├── Convert React → PHP templates
     │    ├── Generate functions.php
     │    ├── Create WooCommerce templates
     │    └── Output: theme-name.zip
     │
     ├─── Shopify Converter
     │    ├── Convert React → Liquid templates
     │    ├── Generate sections/ (Shopify 2.0)
     │    ├── Create config/settings_schema.json
     │    └── Output: theme-name.zip
     │
     ├─── HTML/CSS Converter
     │    ├── SSR React → static HTML
     │    ├── Bundle CSS + JavaScript
     │    └── Output: theme-name.zip
     │
     └─── React Converter
          ├── Extract component library
          ├── Generate package.json (NPM)
          └── Output: theme-name.tgz
```

### 9.2 Conversion Implementation

```typescript
// packages/typescript/theme-converter/src/index.ts

interface ConversionOptions {
  themeId: string;
  platform: 'wordpress' | 'shopify' | 'html' | 'react';
  watermark?: { userId: string; purchaseId: string };
}

export async function convertTheme(options: ConversionOptions) {
  const theme = await loadThemeSource(options.themeId);

  switch (options.platform) {
    case 'wordpress':  return convertToWordPress(theme, options);
    case 'shopify':    return convertToShopify(theme, options);
    case 'html':       return convertToHTML(theme, options);
    case 'react':      return convertToReact(theme, options);
  }
}
```

---

## 10. Admin Panel

### 10.1 Theme Admin Dashboard (`themes-admin.letbuyy.store`)

| Feature | Description |
|---------|-------------|
| **Theme CRUD** | Create, edit, publish, deprecate themes |
| **Version Management** | Upload new versions, track changelogs |
| **Review Moderation** | Approve/reject reviews, respond to feedback |
| **License Management** | View, revoke, extend licenses |
| **Analytics Dashboard** | Revenue, installs, downloads, ratings trends |
| **Collection Management** | Create/edit curated theme bundles |
| **Settings** | Pricing config, API keys, webhook URLs |

### 10.2 Admin Analytics

```
┌──────────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ $12,450  │ │ 342      │ │ 1,240    │ │ 89       │       │
│  │ Revenue  │ │ Sales    │ │ Installs │ │ Downloads│       │
│  │ ▲ 23%    │ │ ▲ 15%    │ │ ▲ 8%     │ │ ▲ 45%    │       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                              │
│  Top Themes:                                                 │
│  1. Urban Kicks — $3,200 (89 sales)                          │
│  2. Luxe Atelier — $2,800 (56 sales)                         │
│  3. Neon Tech — $1,900 (38 sales)                            │
│                                                              │
│  Platform Breakdown:                                         │
│  LetBuyy: 65% | WordPress: 20% | Shopify: 10% | Other: 5%  │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Payment & Licensing

### 11.1 Payment Gateways

| Gateway | Markets | Methods |
|---------|---------|---------|
| **Stripe** | Global | Cards, Apple Pay, Google Pay |
| **Razorpay** | India | UPI, Cards, NetBanking, Wallets |

### 11.2 Payment Flow

```
1. User clicks "Buy" / "Install"
2. Auth check → accounts.letbuyy.store if not logged in
3. FREE THEME:
   a. POST /api/purchases (amount: 0, provider: 'free')
   b. Auto-generate license key → success → apply to store
4. PAID THEME (Stripe):
   a. Create Stripe session → Redirect → Payment → Webhook
   b. Record purchase + generate license → success page
5. PAID THEME (Razorpay):
   a. Create Razorpay order → Modal → Payment → Verify
   b. Record purchase + generate license → success page
6. SUBSCRIPTION:
   a. Stripe/Razorpay subscription checkout → Webhook
   b. Grant access to all themes
```

### 11.3 License Key Format

```
Format: LBTH-XXXX-XXXX-XXXX-XXXX
Example: LBTH-A4B2-C8D1-E6F3-G9H7

- Prefix: LBTH (LetBuyy Themes)
- JWT-signed for tamper detection
- Embedded checksum for offline validation
```

### 11.4 Refund Policy

| Condition | Refund |
|-----------|--------|
| Within 30 days, no install | Full refund (auto) |
| Within 30 days, installed | Full refund, license revoked (manual) |
| After 30 days | No refund (support ticket) |
| Subscription cancellation | Pro-rated (auto) |

---

## 12. Security Features

### 12.1 Security Layers

| Layer | Implementation |
|-------|----------------|
| **Network** | Cloudflare WAF, Rate Limiting (Upstash Redis), IP Whitelisting (admin) |
| **Application** | CSP Headers, CORS, CSRF Tokens, Input Sanitization (DOMPurify) |
| **Authentication** | Supabase Auth (OAuth 2.0 + PKCE), 2FA (TOTP), JWT sessions, RLS |
| **Data** | Encryption at rest/transit (TLS 1.3), PII masking, Audit logging |
| **Licensing** | JWT-signed keys, Site fingerprinting, Download watermarking |

### 12.2 CSP Headers

```typescript
// middleware.ts
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://checkout.razorpay.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' blob: data: https://*.supabase.co https://*.stripe.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' https://*.supabase.co https://api.stripe.com https://api.razorpay.com;
  frame-src 'self' https://js.stripe.com https://api.razorpay.com;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;
```

---

## 13. Implementation Phases

### Phase 1 — Foundation (Days 1–3)

- [ ] Scaffold `theme-marketplace` app (Next 16, Tailwind 4)
- [ ] Add to `pnpm-workspace.yaml`
- [ ] Write migration `005_theme_marketplace.sql` (all tables, indexes, RLS)
- [ ] Create Supabase clients (`lib/supabase/server.ts`, `client.ts`)
- [ ] Create auth helpers (`lib/auth.ts`)
- [ ] Create theme service (`lib/services/theme.service.ts`)
- [ ] Create purchase service (`lib/services/purchase.service.ts`)
- [ ] Create Stripe + Razorpay clients
- [ ] Seed demo data (sites + themes)
- [ ] Set up middleware (auth guard, rate limiting, CSP)

### Phase 2 — Gallery & Detail (Days 4–7)

- [ ] Root layout (header, footer, fonts, metadata)
- [ ] `globals.css` (design system tokens)
- [ ] Hero component (animated gradient, search, stats)
- [ ] Theme card (thumbnail, hover overlay, badges)
- [ ] Theme grid (responsive 3→2→1)
- [ ] Filter bar (category, industry, pricing, platform, sort)
- [ ] Gallery page assembly
- [ ] Screenshot carousel, feature grid, pricing card
- [ ] Theme detail page
- [ ] API routes: `/api/themes`, `/api/themes/[slug]`, `/api/themes/search`

### Phase 3 — Dashboard (Days 8–11)

- [ ] Dashboard sidebar layout
- [ ] Stats grid, overview page
- [ ] My Themes page (purchased themes, apply dropdown)
- [ ] My Downloads page
- [ ] My Stores page (store list, current theme)
- [ ] Wishlist, license management, subscription pages
- [ ] API routes: purchases, installations, wishlist

### Phase 4 — Purchase Flow (Days 12–14)

- [ ] Checkout page (order summary, payment method)
- [ ] Free theme instant-install flow
- [ ] Stripe Checkout Session API + webhook
- [ ] Razorpay order + verify APIs
- [ ] Success page (apply to store + download CTAs)
- [ ] License generation

### Phase 5 — Reviews & Collections (Days 15–17)

- [ ] Review section + review form + voting
- [ ] Collection cards, grid, pages
- [ ] Reviews & collections APIs

### Phase 6 — Subscriptions & Licensing (Days 18–20)

- [ ] Pricing page with plan comparison
- [ ] Subscription checkout flow
- [ ] License validation + deactivation APIs
- [ ] License management dashboard page

### Phase 7 — Admin Panel (Days 21–25)

- [ ] Scaffold `theme-admin` app
- [ ] Theme CRUD pages, version management
- [ ] Review moderation, license management
- [ ] Analytics dashboard (revenue, performance)
- [ ] Settings pages

### Phase 8 — Multi-Platform Support (Days 26–30)

- [ ] Theme converter core + platform converters
- [ ] WordPress, Shopify, HTML/CSS, React converters
- [ ] Download service + watermarking + ZIP builder
- [ ] Secure download page

### Phase 9 — Polish & Launch (Days 31–35)

- [ ] Mobile responsiveness across ALL pages
- [ ] Framer Motion animations
- [ ] SEO (meta tags, OG images)
- [ ] Documentation pages
- [ ] Support ticket system
- [ ] Error pages (404, 500)
- [ ] Build verification (`next build`)
- [ ] Performance optimization (Lighthouse audit)

---

## 14. Testing & QA

### 14.1 Test Commands

```bash
# Unit tests
pnpm --filter theme-marketplace test

# E2E tests (Playwright)
pnpm --filter theme-marketplace test:e2e

# Type checking
pnpm --filter theme-marketplace tsc --noEmit

# Build verification
pnpm --filter theme-marketplace build
```

### 14.2 Test Scenarios

| # | Test | Expected Result |
|---|------|-----------------|
| 1 | Gallery loads | 10+ theme cards, filter bar, hero |
| 2 | Filter by "Store" | Only store themes shown |
| 3 | Filter by "Free" | Only free themes shown |
| 4 | Search "urban" | Urban Kicks appears |
| 5 | Click theme card | Detail page with screenshots, tabs |
| 6 | Click "Live Demo" | Opens `urban-kicks.letbuyy.store` in new tab |
| 7 | Click "Install" (not logged in) | Redirect to `accounts.letbuyy.store/login` |
| 8 | After login | Redirected back to checkout |
| 9 | Free theme purchase | Instant install with store selector |
| 10 | Paid theme (Stripe) | Stripe Checkout → verify → success |
| 11 | Paid theme (Razorpay) | Razorpay modal → verify → success |
| 12 | Dashboard loads | Purchased themes with stats |
| 13 | Apply theme | Site's theme_id updated, store renders new theme |
| 14 | Download WordPress | .zip downloads with valid WP structure |
| 15 | License validation | Valid = true, expired = false |
| 16 | Review submission | Only verified purchasers can submit |
| 17 | Subscription flow | Creates access to all themes |
| 18 | Mobile responsive | All pages adapt 375px–768px–1440px |
| 19 | Admin panel | CRUD themes, moderate reviews, analytics |
| 20 | Rate limiting | Exceeding limits → 429 response |

### 14.3 Performance Targets

| Metric | Target |
|--------|--------|
| Lighthouse Performance | ≥ 90 |
| Lighthouse Accessibility | ≥ 95 |
| Lighthouse SEO | ≥ 95 |
| First Contentful Paint | < 1.5s |
| Largest Contentful Paint | < 2.5s |
| Time to Interactive | < 3.0s |
| Bundle Size (gzipped) | < 200KB |

---

## 15. Deployment Strategy

### 15.1 Infrastructure

| Service | Provider | Purpose |
|---------|----------|---------|
| **Hosting** | Vercel | Next.js apps (SSR + Edge) |
| **Database** | Supabase | PostgreSQL + Auth + Storage |
| **Payments** | Stripe + Razorpay | Payment processing |
| **CDN** | Cloudflare | Asset delivery + WAF |
| **Downloads** | Cloudflare R2 | Secure theme downloads |
| **Rate Limiting** | Upstash Redis | API rate limiting |
| **Analytics** | PostHog | User analytics |
| **Monitoring** | Sentry | Error tracking |
| **Email** | Resend | Transactional emails |

### 15.2 DNS Configuration

```
themes.letbuyy.store        → Vercel (theme-marketplace)
themes-admin.letbuyy.store  → Vercel (theme-admin)
urban-kicks.letbuyy.store   → Vercel (storefront — demo)
luxe-atelier.letbuyy.store  → Vercel (storefront — demo)
*.letbuyy.store             → Vercel (storefront — user stores)
accounts.letbuyy.store      → Vercel (accounts — auth hub)
```

### 15.3 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Razorpay
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# App URLs
NEXT_PUBLIC_APP_URL=https://themes.letbuyy.store
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.store
NEXT_PUBLIC_STOREFRONT_URL=https://letbuyy.store

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Analytics & Monitoring
NEXT_PUBLIC_POSTHOG_KEY=phc_...
SENTRY_DSN=https://...
RESEND_API_KEY=re_...
```

### 15.4 CI/CD Pipeline

```yaml
# .github/workflows/theme-marketplace.yml
name: Theme Marketplace CI/CD

on:
  push:
    branches: [main]
    paths:
      - 'apps/web/theme-marketplace/**'
      - 'packages/typescript/theme-engine/**'
      - 'packages/typescript/licensing/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter theme-marketplace lint
      - run: pnpm --filter theme-marketplace tsc --noEmit
      - run: pnpm --filter theme-marketplace test
      - run: pnpm --filter theme-marketplace build
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: '--prod'
```

### 15.5 Monitoring & Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| Error rate spike | > 1% requests return 5xx | Page on-call |
| Payment failure | > 5 failed in 1 hour | Notify finance + eng |
| License abuse | > 10 activations from single key | Auto-suspend |
| DDoS detected | > 10K req/min from single IP | Cloudflare auto-block |
| Build failure | CI/CD fails | Block deploy + notify |

---

## Summary

**Total estimated effort: 35 working days (~7 weeks)**

| Phase | Days | Files | Priority |
|-------|------|-------|----------|
| 1. Foundation | 3 | ~15 | P0 |
| 2. Gallery & Detail | 4 | ~20 | P0 |
| 3. Dashboard | 4 | ~16 | P0 |
| 4. Purchase Flow | 3 | ~13 | P0 |
| 5. Reviews & Collections | 3 | ~8 | P1 |
| 6. Subscriptions & Licensing | 3 | ~8 | P1 |
| 7. Admin Panel | 5 | ~20 | P1 |
| 8. Multi-Platform Support | 5 | ~12 | P2 |
| 9. Polish & Launch | 5 | ~10 | P0–P1 |
| **Total** | **35** | **~122** | — |

> **💡 Recommended MVP (Phase 1–4):** 14 days, ~64 files. Gives you a fully functional marketplace with browse, detail, checkout (free + paid), and dashboard. Phases 5–9 can be added incrementally post-launch.

---

## 16. Theme Engine Implementation

### 16.1 Core Renderer

```typescript
// packages/typescript/theme-engine/src/renderer/server.tsx

import { ThemeComponents, ThemeConfig } from '../types/theme';
import { THEME_REGISTRY } from '../registry';

interface ThemeRendererProps {
  themeId: string;
  siteData: SiteData;
  customizations?: Record<string, any>;
}

export async function renderTheme({ themeId, siteData, customizations }: ThemeRendererProps) {
  // 1. Resolve theme from registry
  const themeEntry = THEME_REGISTRY[themeId];
  if (!themeEntry) throw new Error(`Theme "${themeId}" not found in registry`);

  // 2. Load theme components (dynamic import for code splitting)
  const components: ThemeComponents = await themeEntry.loader();

  // 3. Merge default config with user customizations
  const config = mergeConfigs(themeEntry.defaultConfig, customizations);

  // 4. Return renderable component tree
  return {
    components,
    config,
    metadata: themeEntry.metadata,
  };
}
```

### 16.2 Theme Registry

```typescript
// packages/typescript/theme-engine/src/registry/index.ts

export interface ThemeRegistryEntry {
  id: string;
  slug: string;
  name: string;
  category: 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
  loader: () => Promise<ThemeComponents>;
  defaultConfig: ThemeConfig;
  metadata: ThemeMetadata;
  demoConfig?: {
    subdomain: string;
    siteId: string;
    mockData: Record<string, any>;
  };
}

export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
  'urban-kicks': {
    id: 'urban-kicks',
    slug: 'urban-kicks',
    name: 'Urban Kicks',
    category: 'store',
    loader: () => import('../themes/store/urban-kicks'),
    defaultConfig: {
      colors: { primary: '#000000', secondary: '#FFFFFF', accent: '#FF4500' },
      fonts: { heading: 'Oswald', body: 'Inter' },
      layout: { heroStyle: 'fullscreen', productGrid: '3-col' },
    },
    metadata: {
      version: '1.0.0',
      author: 'LetBuyy Team',
      screenshots: ['/themes/urban-kicks/hero.png', '/themes/urban-kicks/products.png'],
    },
    demoConfig: {
      subdomain: 'urban-kicks',
      siteId: 'demo-urban-kicks-uuid',
      mockData: { /* ... */ },
    },
  },
  'luxe-atelier': {
    id: 'luxe-atelier',
    slug: 'luxe-atelier',
    name: 'Luxe Atelier',
    category: 'store',
    loader: () => import('../themes/store/luxe-atelier'),
    defaultConfig: {
      colors: { primary: '#1A1A2E', secondary: '#F5F0EB', accent: '#C9A96E' },
      fonts: { heading: 'Playfair Display', body: 'Lato' },
      layout: { heroStyle: 'split', productGrid: '2-col' },
    },
    metadata: {
      version: '1.0.0',
      author: 'LetBuyy Team',
      screenshots: ['/themes/luxe-atelier/hero.png'],
    },
    demoConfig: {
      subdomain: 'luxe-atelier',
      siteId: 'demo-luxe-atelier-uuid',
      mockData: { /* ... */ },
    },
  },
  // ... additional themes registered here
};
```

### 16.3 ThemeComponents Interface

```typescript
// packages/typescript/theme-engine/src/types/theme.ts

export interface ThemeComponents {
  // Layout
  Header: React.ComponentType<HeaderProps>;
  Footer: React.ComponentType<FooterProps>;
  Navigation: React.ComponentType<NavProps>;

  // Pages
  HomePage: React.ComponentType<HomePageProps>;
  ProductListPage: React.ComponentType<ProductListProps>;
  ProductDetailPage: React.ComponentType<ProductDetailProps>;
  CartPage: React.ComponentType<CartProps>;
  CheckoutPage: React.ComponentType<CheckoutProps>;

  // Shared Components
  ProductCard: React.ComponentType<ProductCardProps>;
  HeroSection: React.ComponentType<HeroProps>;
  CategoryGrid: React.ComponentType<CategoryGridProps>;
  TestimonialSection?: React.ComponentType<TestimonialProps>;
  NewsletterSignup?: React.ComponentType<NewsletterProps>;
}

export interface ThemeConfig {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background?: string;
    text?: string;
    muted?: string;
  };
  fonts: {
    heading: string;
    body: string;
    mono?: string;
  };
  layout: {
    heroStyle: 'fullscreen' | 'split' | 'minimal' | 'video' | 'carousel';
    productGrid: '2-col' | '3-col' | '4-col' | 'masonry';
    headerStyle?: 'transparent' | 'solid' | 'floating';
    footerStyle?: 'minimal' | 'full' | 'mega';
  };
  spacing?: {
    sectionGap: number;
    contentMaxWidth: number;
  };
  animations?: {
    pageTransition: 'fade' | 'slide' | 'none';
    scrollReveal: boolean;
    hoverEffects: boolean;
  };
}

export interface ThemeMetadata {
  version: string;
  author: string;
  screenshots: string[];
  previewUrl?: string;
  documentation?: string;
  changelog?: string;
  minAppVersion?: string;
}
```

---

## 17. Theme Resolver Pattern

### 17.1 How Themes Are Dynamically Loaded

The storefront app uses a **Theme Resolver Pattern** to dynamically load the correct theme components based on the store's `theme_id` in the database.

```
┌─────────────────────────────────────────────────────────────┐
│              THEME RESOLVER FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Request arrives at storefront                           │
│     e.g., urban-kicks.letbuyy.store/products                │
│     ↓                                                       │
│  2. middleware.ts extracts subdomain                        │
│     subdomain = 'urban-kicks'                               │
│     ↓                                                       │
│  3. Query DB: SELECT theme_id FROM sites                    │
│     WHERE subdomain = 'urban-kicks'                         │
│     → theme_id = 'urban-kicks'                              │
│     ↓                                                       │
│  4. THEME_REGISTRY['urban-kicks'].loader()                  │
│     → Dynamically imports theme components                  │
│     ↓                                                       │
│  5. Render page with resolved components                    │
│     <UrbanKicksHeader />                                    │
│     <UrbanKicksProductList products={...} />                │
│     <UrbanKicksFooter />                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 17.2 Resolver Implementation

```typescript
// apps/web/storefront/src/lib/theme-resolver.ts

import { THEME_REGISTRY, ThemeComponents } from '@letbuyy/theme-engine';
import { createServerClient } from '@/lib/supabase/server';

interface ResolvedTheme {
  components: ThemeComponents;
  config: ThemeConfig;
  themeId: string;
  customizations: Record<string, any>;
}

export async function resolveThemeForSite(siteId: string): Promise<ResolvedTheme> {
  const supabase = await createServerClient();

  // 1. Get active theme installation for this site
  const { data: installation } = await supabase
    .from('theme_installations')
    .select('theme_id, customizations, version_installed')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .single();

  // 2. Fallback to default theme
  const themeId = installation?.theme_id ?? 'urban-kicks';

  // 3. Look up in registry
  const entry = THEME_REGISTRY[themeId];
  if (!entry) throw new Error(`Theme "${themeId}" not registered`);

  // 4. Load components via dynamic import
  const components = await entry.loader();

  // 5. Merge default config with user customizations
  const config = mergeConfigs(entry.defaultConfig, installation?.customizations);

  return { components, config, themeId, customizations: installation?.customizations ?? {} };
}
```

### 17.3 Middleware Integration

```typescript
// apps/web/storefront/middleware.ts

import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  // Skip for main domain
  if (subdomain === 'www' || subdomain === 'letbuyy') {
    return NextResponse.next();
  }

  // Check if this is a known demo subdomain
  const isDemoStore = DEMO_SUBDOMAINS.includes(subdomain);

  // Pass subdomain info via headers
  const response = NextResponse.next();
  response.headers.set('x-subdomain', subdomain);
  response.headers.set('x-is-demo', isDemoStore ? 'true' : 'false');

  return response;
}

const DEMO_SUBDOMAINS = [
  'urban-kicks',
  'luxe-atelier',
  'neon-tech',
  'natures-basket',
  'creative-folio',
  'clean-resume',
  'saas-launch',
];
```

---

## 18. Theme Development Workflow

### 18.1 Creating a New Theme (Step-by-Step)

```
┌─────────────────────────────────────────────────────────────┐
│           THEME DEVELOPMENT LIFECYCLE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Step 1: Scaffold                                           │
│  → pnpm create-theme --name "my-theme" --category store     │
│  → Generates: packages/typescript/theme-engine/themes/      │
│               store/my-theme/                               │
│                                                             │
│  Step 2: Implement Components                               │
│  → Header, Footer, HomePage, ProductListPage, etc.          │
│  → Must satisfy ThemeComponents interface                   │
│                                                             │
│  Step 3: Define Config                                      │
│  → colors, fonts, layout in config.ts                       │
│  → Define demoConfig with subdomain + mock data             │
│                                                             │
│  Step 4: Register in THEME_REGISTRY                         │
│  → Add entry to registry/index.ts                           │
│  → Wire dynamic import                                      │
│                                                             │
│  Step 5: Create Demo Site                                   │
│  → Seed DB with demo site (sites table)                     │
│  → Seed products, categories, hero data                     │
│  → Map subdomain in Vercel/DNS                              │
│                                                             │
│  Step 6: Create DB Record                                   │
│  → INSERT INTO themes (slug, name, category, ...)           │
│  → Set pricing, screenshots, description                    │
│                                                             │
│  Step 7: Screenshot & Media                                 │
│  → Auto-capture via screenshot-service                      │
│  → Generate scrolling GIF, thumbnails                       │
│                                                             │
│  Step 8: QA & Publish                                       │
│  → Test on all viewports                                    │
│  → Lighthouse audit (target: 90+)                           │
│  → Set is_active = true, published_at = NOW()               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 18.2 Theme Scaffold Script

```typescript
// scripts/create-theme.ts

import fs from 'fs';
import path from 'path';

interface CreateThemeOptions {
  name: string;        // 'my-theme'
  displayName: string; // 'My Theme'
  category: 'store' | 'portfolio' | 'resume' | 'landing' | 'saas';
}

export function createTheme(options: CreateThemeOptions) {
  const themeDir = path.join(
    'packages/typescript/theme-engine/themes',
    options.category,
    options.name
  );

  // Create directory structure
  const dirs = [
    themeDir,
    `${themeDir}/components`,
  ];
  dirs.forEach(d => fs.mkdirSync(d, { recursive: true }));

  // Generate files from templates
  const files = {
    'index.tsx': generateMainComponent(options),
    'config.ts': generateConfig(options),
    'styles.css': generateStyles(options),
    'components/header.tsx': generateHeader(options),
    'components/footer.tsx': generateFooter(options),
    'components/hero.tsx': generateHero(options),
  };

  Object.entries(files).forEach(([file, content]) => {
    fs.writeFileSync(path.join(themeDir, file), content);
  });

  // Update registry
  appendToRegistry(options);

  console.log(`✅ Theme "${options.displayName}" created at ${themeDir}`);
}
```

---

## 19. Theme Customizer

### 19.1 Customization Options Interface

```typescript
// packages/typescript/theme-engine/src/types/customization.ts

export interface CustomizationOptions {
  // Color overrides
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    text?: string;
    headerBg?: string;
    footerBg?: string;
  };

  // Font overrides
  fonts?: {
    heading?: string;
    body?: string;
  };

  // Layout overrides
  layout?: {
    heroStyle?: 'fullscreen' | 'split' | 'minimal' | 'video' | 'carousel';
    productGrid?: '2-col' | '3-col' | '4-col' | 'masonry';
    headerStyle?: 'transparent' | 'solid' | 'floating';
    showNewsletter?: boolean;
    showTestimonials?: boolean;
    showInstagramFeed?: boolean;
  };

  // Content overrides
  content?: {
    heroTitle?: string;
    heroSubtitle?: string;
    heroButtonText?: string;
    footerText?: string;
    announcementBar?: string;
  };

  // Custom CSS
  customCSS?: string;

  // Logo
  logoUrl?: string;
  faviconUrl?: string;
}
```

### 19.2 Live Customizer Component

```typescript
// apps/web/theme-marketplace/src/components/customizer/theme-customizer.tsx

'use client';

import { useState, useCallback, useEffect } from 'react';
import { CustomizationOptions } from '@letbuyy/theme-engine';
import { debounce } from '@/lib/utils';

interface ThemeCustomizerProps {
  themeId: string;
  siteId: string;
  currentCustomizations: CustomizationOptions;
  onSave: (customizations: CustomizationOptions) => Promise<void>;
}

export function ThemeCustomizer({
  themeId,
  siteId,
  currentCustomizations,
  onSave,
}: ThemeCustomizerProps) {
  const [customizations, setCustomizations] = useState(currentCustomizations);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Build preview URL with customization params
  useEffect(() => {
    const params = new URLSearchParams({
      preview: 'true',
      customizations: JSON.stringify(customizations),
    });
    setPreviewUrl(`https://${siteId}.letbuyy.store?${params}`);
  }, [customizations, siteId]);

  // Debounced preview update via PostMessage
  const updatePreview = useCallback(
    debounce((updates: CustomizationOptions) => {
      const iframe = document.querySelector('#preview-frame') as HTMLIFrameElement;
      iframe?.contentWindow?.postMessage(
        { type: 'THEME_CUSTOMIZATION_UPDATE', payload: updates },
        '*'
      );
    }, 150),
    []
  );

  const handleColorChange = (key: string, value: string) => {
    const updated = {
      ...customizations,
      colors: { ...customizations.colors, [key]: value },
    };
    setCustomizations(updated);
    updatePreview(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(customizations);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar: Customization Controls */}
      <aside className="w-80 border-r overflow-y-auto p-4 space-y-6">
        <section>
          <h3 className="font-semibold mb-3">Colors</h3>
          {Object.entries(customizations.colors || {}).map(([key, value]) => (
            <div key={key} className="flex items-center gap-3 mb-2">
              <input
                type="color"
                value={value}
                onChange={(e) => handleColorChange(key, e.target.value)}
              />
              <label className="text-sm capitalize">{key}</label>
            </div>
          ))}
        </section>

        <section>
          <h3 className="font-semibold mb-3">Fonts</h3>
          {/* Font selection dropdowns */}
        </section>

        <section>
          <h3 className="font-semibold mb-3">Layout</h3>
          {/* Layout toggle switches */}
        </section>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-primary text-white py-2 rounded-lg"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </aside>

      {/* Main: Live Preview */}
      <main className="flex-1">
        <iframe
          id="preview-frame"
          src={previewUrl}
          className="w-full h-full border-0"
        />
      </main>
    </div>
  );
}
```

### 19.3 Apply Customizations (Server-Side)

```typescript
// packages/typescript/theme-engine/src/utils/apply-customizations.ts

import { ThemeConfig, CustomizationOptions } from '../types';

export function applyCustomizations(
  baseConfig: ThemeConfig,
  customizations: CustomizationOptions
): ThemeConfig {
  return {
    colors: {
      ...baseConfig.colors,
      ...customizations.colors,
    },
    fonts: {
      ...baseConfig.fonts,
      ...customizations.fonts,
    },
    layout: {
      ...baseConfig.layout,
      ...customizations.layout,
    },
    spacing: baseConfig.spacing,
    animations: baseConfig.animations,
  };
}

export function generateCSSVariables(config: ThemeConfig): string {
  return `
    :root {
      --color-primary: ${config.colors.primary};
      --color-secondary: ${config.colors.secondary};
      --color-accent: ${config.colors.accent};
      --color-background: ${config.colors.background || '#FFFFFF'};
      --color-text: ${config.colors.text || '#111111'};
      --font-heading: '${config.fonts.heading}', sans-serif;
      --font-body: '${config.fonts.body}', sans-serif;
      --section-gap: ${config.spacing?.sectionGap || 64}px;
      --content-max-width: ${config.spacing?.contentMaxWidth || 1200}px;
    }
  `;
}
```

---

## 20. Individual Theme Wireframes

### 20.1 Store Themes

#### Urban Kicks (Streetwear / Sneakers)

```
┌─────────────────────────────────────────────────────────────┐
│  urban-kicks.letbuyy.store                                  │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: Black #000, White #FFF, Orange #FF4500      │
│  Fonts: Oswald (heading) + Inter (body)                     │
│  Vibe: Bold, minimal, urban                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HEADER: Transparent → solid on scroll                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 🏪 URBAN KICKS     Shop  Drops  About      🛒 (2)  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  HERO: Full-screen, product-focused                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  bg: #000                                           │    │
│  │       ╔══════════╗                                  │    │
│  │       ║ Sneaker  ║ ← large product image            │    │
│  │       ║  Hero    ║                                  │    │
│  │       ╚══════════╝                                  │    │
│  │  NEW DROP                                           │    │
│  │  Air Max Retro 97                                   │    │
│  │  $189.00                                            │    │
│  │  [SHOP NOW →]                                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  GRID: 3-col product cards with hover zoom                  │
│  ┌────────┐  ┌────────┐  ┌────────┐                        │
│  │ ╔════╗ │  │ ╔════╗ │  │ ╔════╗ │                        │
│  │ ║prod║ │  │ ║prod║ │  │ ║prod║ │                        │
│  │ ╚════╝ │  │ ╚════╝ │  │ ╚════╝ │                        │
│  │ Name   │  │ Name   │  │ SALE   │                        │
│  │ $149   │  │ $89    │  │ $59    │                        │
│  └────────┘  └────────┘  └────────┘                        │
│                                                             │
│  FOOTER: Black bg, minimal links, newsletter               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Luxe Atelier (Luxury Fashion)

```
┌─────────────────────────────────────────────────────────────┐
│  luxe-atelier.letbuyy.store                                 │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: Navy #1A1A2E, Cream #F5F0EB, Gold #C9A96E  │
│  Fonts: Playfair Display (heading) + Lato (body)            │
│  Vibe: Elegant, luxurious, editorial                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HEADER: Centered logo, thin gold accent line               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Shop   Collections    LUXE ATELIER    About    🛒   │    │
│  │ ─────────────────── gold line ────────────────────  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  HERO: Split layout (50/50 image + text)                    │
│  ┌────────────────────┬────────────────────────────────┐    │
│  │ ╔════════════════╗ │  bg: cream                     │    │
│  │ ║                ║ │                                │    │
│  │ ║  Model Photo   ║ │  Autumn/Winter 2026            │    │
│  │ ║  (editorial)   ║ │                                │    │
│  │ ║                ║ │  Timeless Elegance              │    │
│  │ ╚════════════════╝ │  Redefined                     │    │
│  │                    │                                │    │
│  │                    │  [Explore Collection →]         │    │
│  └────────────────────┴────────────────────────────────┘    │
│                                                             │
│  GRID: 2-col large cards with editorial styling             │
│  CATEGORY: Horizontal scroll with gold borders              │
│  FOOTER: Navy bg, gold accent, newsletter                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Neon Tech (Electronics / Gadgets)

```
┌─────────────────────────────────────────────────────────────┐
│  neon-tech.letbuyy.store                                    │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: Dark #0D0D0D, Electric Blue #00D4FF,        │
│                 Purple #8B5CF6, Green #00FF88               │
│  Fonts: Space Grotesk (heading) + JetBrains Mono (body)     │
│  Vibe: Futuristic, tech, cyberpunk                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HEADER: Glass morphism + neon glow on hover               │
│  HERO: Video bg or animated gradient with floating 3D       │
│        product renders                                      │
│  GRID: 3-col with neon hover borders + glitch effects      │
│  SPECIAL: Live ticker bar with "now shipping" alerts        │
│  FOOTER: Minimal, terminal-style, green-on-black            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Nature's Basket (Organic / Food)

```
┌─────────────────────────────────────────────────────────────┐
│  natures-basket.letbuyy.store                               │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: Forest #2D5016, Cream #FFF8E7, Brown #8B4513│
│  Fonts: Merriweather (heading) + Source Sans Pro (body)      │
│  Vibe: Warm, organic, earthy                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HEADER: Warm cream bg, leaf icon, organic badge            │
│  HERO: Full-width lifestyle photo, seasonal messaging       │
│  GRID: 3-col cards with rounded corners + organic borders  │
│  SPECIAL: Farm-to-table story section, recipe cards         │
│  FOOTER: Earthy tones, sustainability pledge                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 20.2 Portfolio Theme

#### Creative Folio

```
┌─────────────────────────────────────────────────────────────┐
│  creative-folio.letbuyy.store                               │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: Charcoal #1C1C1C, White #FFF, Coral #FF6B6B│
│  Fonts: Cabinet Grotesk (heading) + DM Sans (body)          │
│  Vibe: Creative, bold, showcase                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HEADER: Floating nav, minimal, hamburger on mobile         │
│                                                             │
│  HERO: Full-screen with name + role                         │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  bg: charcoal + animated particles                  │    │
│  │                                                     │    │
│  │       Alex Rivera                                   │    │
│  │       Product Designer & Illustrator                │    │
│  │                                                     │    │
│  │       [View Projects] [About Me]                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  WORK: Masonry grid of project cards                        │
│  ┌────────┐  ┌──────────────┐  ┌────────┐                  │
│  │ ╔════╗ │  │ ╔══════════╗ │  │ ╔════╗ │                  │
│  │ ║proj║ │  │ ║ project  ║ │  │ ║proj║ │                  │
│  │ ║ 1  ║ │  │ ║   2      ║ │  │ ║ 3  ║ │                  │
│  │ ╚════╝ │  │ ╚══════════╝ │  │ ╚════╝ │                  │
│  │ Brand  │  │ Mobile App   │  │ Web    │                  │
│  └────────┘  └──────────────┘  └────────┘                  │
│                                                             │
│  ABOUT: Split (photo + bio + skills bars)                   │
│  TESTIMONIALS: Carousel with client logos                   │
│  CONTACT: Minimal form + social links                       │
│  FOOTER: Dark, one-line copyright                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 20.3 Resume Theme

#### Clean Resume

```
┌─────────────────────────────────────────────────────────────┐
│  clean-resume.letbuyy.store                                 │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: White #FFF, Slate #475569, Blue #3B82F6     │
│  Fonts: Inter (heading + body)                              │
│  Vibe: Professional, clean, structured                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  LAYOUT: A4-style centered card on light gray bg            │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ┌─────────────────────────────────────────────┐    │    │
│  │  │  [Photo]  John Doe                          │    │    │
│  │  │           Senior Software Engineer           │    │    │
│  │  │           📧 john@email.com | 🔗 github     │    │    │
│  │  │                                             │    │    │
│  │  │  ─── Summary ──────────────────────────     │    │    │
│  │  │  Experienced engineer with 8+ years...     │    │    │
│  │  │                                             │    │    │
│  │  │  ─── Experience ───────────────────────     │    │    │
│  │  │  ● Google | Senior SWE | 2022-Present       │    │    │
│  │  │    - Led migration to microservices         │    │    │
│  │  │  ● Meta | SWE | 2019-2022                   │    │    │
│  │  │    - Built real-time messaging system       │    │    │
│  │  │                                             │    │    │
│  │  │  ─── Skills ───────────────────────────     │    │    │
│  │  │  [React] [Node.js] [Python] [AWS] [K8s]    │    │    │
│  │  │                                             │    │    │
│  │  │  ─── Education ────────────────────────     │    │    │
│  │  │  MIT | BS Computer Science | 2019           │    │    │
│  │  │                                             │    │    │
│  │  │  [📥 Download PDF]  [📤 Share]              │    │    │
│  │  └─────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 20.4 Landing / SaaS Theme

#### SaaS Launch

```
┌─────────────────────────────────────────────────────────────┐
│  saas-launch.letbuyy.store                                  │
├─────────────────────────────────────────────────────────────┤
│  Color Palette: Dark #0F172A, Indigo #6366F1, Cyan #06B6D4  │
│  Fonts: Plus Jakarta Sans (heading) + Inter (body)          │
│  Vibe: Modern SaaS, startup, tech                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  HEADER: Glass, sticky, CTA button                          │
│                                                             │
│  HERO: Centered, gradient text, animated bg                 │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  bg: dark + radial gradient (indigo → transparent)  │    │
│  │                                                     │    │
│  │       Ship faster with                              │    │
│  │       AI-powered workflows                          │    │
│  │                                                     │    │
│  │       Automate your team's workflow in minutes,     │    │
│  │       not months.                                   │    │
│  │                                                     │    │
│  │       [Start Free Trial →]  [Watch Demo ▶]          │    │
│  │                                                     │    │
│  │       ╔══════════════════════════════════╗           │    │
│  │       ║   Product Screenshot / Video    ║           │    │
│  │       ╚══════════════════════════════════╝           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  LOGOS: Trusted by (company logos carousel)                  │
│  FEATURES: 3-col icon cards with hover lift                 │
│  HOW IT WORKS: 3-step with connecting lines                 │
│  PRICING: 3-tier cards                                      │
│  TESTIMONIALS: Carousel with avatars                        │
│  CTA: Full-width gradient banner                            │
│  FOOTER: Dark, 4-col mega footer                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 21. Additional Features & Enhancements

### 21.1 Theme Bundles

```sql
-- Bundle purchase handling
CREATE OR REPLACE FUNCTION purchase_bundle(
  p_user_id UUID,
  p_collection_id UUID,
  p_payment_intent_id TEXT,
  p_amount DECIMAL
) RETURNS VOID AS $$
DECLARE
  v_theme_id UUID;
BEGIN
  -- Create bundle purchase record
  INSERT INTO theme_purchases (user_id, theme_id, purchase_type, payment_provider, payment_intent_id, amount_paid)
  SELECT p_user_id, ct.theme_id, 'letbuyy_integration', 'stripe', p_payment_intent_id, p_amount / COUNT(*) OVER()
  FROM collection_themes ct
  WHERE ct.collection_id = p_collection_id;

  -- Generate license for each theme
  FOR v_theme_id IN
    SELECT theme_id FROM collection_themes WHERE collection_id = p_collection_id
  LOOP
    INSERT INTO licenses (purchase_id, license_key, license_type, max_activations)
    SELECT id, gen_random_uuid()::TEXT, 'multi_site', 5
    FROM theme_purchases
    WHERE user_id = p_user_id AND theme_id = v_theme_id
    ORDER BY purchased_at DESC LIMIT 1;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 21.2 White-Label / Reseller Program

| Feature | Standard | Agency | Enterprise |
|---------|----------|--------|------------|
| Rebrand themes | ❌ | ✅ | ✅ |
| Custom branding | ❌ | ✅ | ✅ |
| Resell rights | ❌ | ✅ Limited | ✅ Unlimited |
| API access | ❌ | ✅ | ✅ |
| Priority support | ❌ | ✅ | ✅ |
| Dedicated account manager | ❌ | ❌ | ✅ |
| Custom development | ❌ | ❌ | ✅ |
| Price | — | $299/mo | $999/mo |

### 21.3 Smart Theme Recommendations

```typescript
// packages/typescript/theme-engine/src/recommendations/engine.ts

interface RecommendationInput {
  userIndustry: string;
  siteType: 'store' | 'portfolio' | 'resume' | 'landing';
  preferredStyle: string[];      // ['minimal', 'modern', 'bold']
  budget: 'free' | 'paid' | 'any';
  currentThemeId?: string;       // For "similar themes"
}

export async function getRecommendations(
  input: RecommendationInput,
  limit: number = 6
): Promise<Theme[]> {
  const supabase = createServerClient();

  let query = supabase
    .from('themes')
    .select('*')
    .eq('category', input.siteType)
    .eq('is_active', true);

  // Industry match (uses array overlap)
  if (input.userIndustry) {
    query = query.contains('industry', [input.userIndustry]);
  }

  // Style/tag match
  if (input.preferredStyle.length) {
    query = query.overlaps('tags', input.preferredStyle);
  }

  // Budget filter
  if (input.budget === 'free') {
    query = query.eq('letbuyy_pricing_type', 'free');
  } else if (input.budget === 'paid') {
    query = query.neq('letbuyy_pricing_type', 'free');
  }

  // Exclude current theme
  if (input.currentThemeId) {
    query = query.neq('id', input.currentThemeId);
  }

  // Order by relevance (rating × install_count)
  query = query.order('rating', { ascending: false }).limit(limit);

  const { data } = await query;
  return data || [];
}
```

### 21.4 Theme Performance Scoring

```typescript
// packages/typescript/theme-engine/src/performance/scorer.ts

interface PerformanceScore {
  overall: number;          // 0-100
  loadTime: number;         // seconds
  lighthouse: {
    performance: number;
    accessibility: number;
    seo: number;
    bestPractices: number;
  };
  coreWebVitals: {
    lcp: number;            // Largest Contentful Paint (ms)
    fid: number;            // First Input Delay (ms)
    cls: number;            // Cumulative Layout Shift
    fcp: number;            // First Contentful Paint (ms)
    ttfb: number;           // Time to First Byte (ms)
  };
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
}

export function calculatePerformanceGrade(score: number): string {
  if (score >= 95) return 'A+';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}
```

### 21.5 Community Features (Future)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Theme Discussions** | Q&A forum per theme | P3 |
| **User Showcases** | "Built with this theme" gallery | P3 |
| **Theme Requests** | Users vote on desired themes | P3 |
| **Developer Program** | Third-party developers sell themes | P3 |
| **Affiliate Program** | Earn commission on referrals | P3 |

### 21.6 Version Control & Rollback

```typescript
// Auto-backup before theme update
export async function updateThemeWithRollback(
  siteId: string,
  newThemeId: string
) {
  const supabase = createServerClient();

  // 1. Snapshot current state
  const { data: currentInstall } = await supabase
    .from('theme_installations')
    .select('*')
    .eq('site_id', siteId)
    .eq('is_active', true)
    .single();

  // 2. Store snapshot in version history
  if (currentInstall) {
    await supabase.from('theme_versions_history').insert({
      site_id: siteId,
      theme_id: currentInstall.theme_id,
      customizations: currentInstall.customizations,
      snapshot_at: new Date().toISOString(),
    });
  }

  // 3. Deactivate current theme
  await supabase
    .from('theme_installations')
    .update({ is_active: false })
    .eq('site_id', siteId)
    .eq('is_active', true);

  // 4. Activate new theme
  await supabase.from('theme_installations').upsert({
    site_id: siteId,
    theme_id: newThemeId,
    is_active: true,
    installed_at: new Date().toISOString(),
  });
}

// Rollback to previous version
export async function rollbackTheme(siteId: string) {
  const supabase = createServerClient();

  const { data: previousVersion } = await supabase
    .from('theme_versions_history')
    .select('*')
    .eq('site_id', siteId)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .single();

  if (!previousVersion) throw new Error('No previous version found');

  await updateThemeWithRollback(siteId, previousVersion.theme_id);
}
```

### 21.7 Visual Theme Builder (Future — P3)

```
┌─────────────────────────────────────────────────────────────┐
│              VISUAL THEME BUILDER (Future)                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Vision: A Figma-like editor embedded in the admin panel    │
│  that allows non-technical users to create themes visually. │
│                                                             │
│  Key Components:                                            │
│  • Drag-and-drop section builder                            │
│  • WYSIWYG color/font editor                                │
│  • Component library (pre-built sections)                   │
│  • Export to theme-engine format                            │
│  • Real-time preview                                        │
│                                                             │
│  Tech Stack:                                                │
│  • Canvas: React Flow or Craft.js                           │
│  • State: Zustand for editor state                         │
│  • Export: AST generation → React components                │
│                                                             │
│  Estimated effort: 40+ days (separate project)              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 22. Success Metrics & KPIs

### 22.1 Launch Metrics (First 90 Days)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Themes Published** | 15+ themes across 5 categories | DB count |
| **Registered Users** | 1,000+ | Supabase auth |
| **Free Theme Installs** | 500+ | theme_installations table |
| **Paid Purchases** | 50+ | theme_purchases table |
| **Revenue** | $5,000+ | Stripe dashboard |
| **Demo Site Traffic** | 10K+ unique visitors | PostHog / Vercel Analytics |
| **Average Rating** | 4.5+ stars | theme_reviews table |
| **Support Ticket Resolution** | < 24h median | support_tickets table |
| **Page Load Time** | < 2s (P95) | Vercel Speed Insights |
| **Uptime** | 99.9% | Vercel / Checkly |

### 22.2 Growth Metrics (6–12 Months)

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Monthly Active Users** | 5,000+ | PostHog |
| **Monthly Revenue** | $10,000+ | Stripe |
| **Subscription Conversion** | 5% of free users | DB query |
| **Platform Downloads** | 200+ WordPress/Shopify | theme_downloads table |
| **Theme Catalog** | 50+ themes | themes table |
| **NPS Score** | 50+ | In-app surveys |
| **Organic Traffic** | 20K+ monthly | Google Analytics |
| **Referral Rate** | 15%+ of new users | UTM tracking |

### 22.3 Business KPIs

```
┌─────────────────────────────────────────────────────────────┐
│              KEY BUSINESS METRICS                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Revenue Metrics:                                           │
│  • MRR (Monthly Recurring Revenue) from subscriptions       │
│  • ARPU (Average Revenue Per User)                          │
│  • LTV (Lifetime Value) per customer segment                │
│  • CAC (Customer Acquisition Cost)                          │
│  • LTV:CAC ratio (target: 3:1+)                             │
│                                                             │
│  Product Metrics:                                           │
│  • Theme install rate (views → installs)                    │
│  • Checkout conversion rate (cart → purchase)               │
│  • Theme switching rate (how often users change themes)     │
│  • Customization depth (% of users who customize)          │
│  • Download-to-activation ratio (platform downloads)       │
│                                                             │
│  Engagement Metrics:                                        │
│  • DAU / WAU / MAU                                          │
│  • Session duration on marketplace                          │
│  • Pages per session                                        │
│  • Return visit rate                                        │
│  • Review submission rate                                   │
│                                                             │
│  Quality Metrics:                                           │
│  • Average Lighthouse score across all themes               │
│  • Average page load time per theme                         │
│  • Error rate (5xx responses)                               │
│  • Refund rate (target: < 5%)                               │
│  • Support ticket volume per theme                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 23. Quick Start Guide

### 23.1 Developer Setup

```bash
# 1. Clone the monorepo
git clone https://github.com/letbuyy/letbuyy-store.git
cd letbuyy-store

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp apps/web/theme-marketplace/.env.example apps/web/theme-marketplace/.env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
#          SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, etc.

# 4. Run database migrations
pnpm supabase db push

# 5. Seed demo data
pnpm --filter theme-marketplace seed

# 6. Start development server
pnpm --filter theme-marketplace dev
# → Opens at http://localhost:3004

# 7. Start storefront for demo previews (in another terminal)
pnpm --filter storefront dev
# → Opens at http://localhost:3000
```

### 23.2 Environment Variables

```bash
# .env.local (theme-marketplace)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Razorpay
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...

# Redis (Upstash)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Error Tracking
SENTRY_DSN=https://...

# Email
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_APP_URL=https://themes.letbuyy.store
NEXT_PUBLIC_STOREFRONT_URL=https://letbuyy.store
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.store
```

### 23.3 Key Commands

```bash
# Development
pnpm --filter theme-marketplace dev       # Start marketplace
pnpm --filter theme-admin dev             # Start admin panel
pnpm --filter storefront dev              # Start storefront (for demos)

# Build
pnpm --filter theme-marketplace build     # Production build
pnpm turbo build                          # Build all packages

# Database
pnpm supabase db push                     # Apply migrations
pnpm supabase db reset                    # Reset + re-seed
pnpm --filter theme-marketplace seed      # Seed demo themes

# Testing
pnpm --filter theme-marketplace test      # Unit tests
pnpm playwright test                      # E2E tests
pnpm lint                                 # Lint all packages

# Deployment
vercel --prod                             # Deploy to production
```

### 23.4 Architecture Quick Reference

```
┌─────────────────────────────────────────────────────────────┐
│              ARCHITECTURE AT A GLANCE                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Apps:                                                      │
│  ├── theme-marketplace  → themes.letbuyy.store              │
│  ├── theme-admin        → themes-admin.letbuyy.store        │
│  └── storefront         → *.letbuyy.store (demo previews)   │
│                                                             │
│  Packages:                                                  │
│  ├── theme-engine       → Core rendering + registry         │
│  ├── theme-converter    → WP/Shopify/HTML export            │
│  ├── licensing          → License generation + validation   │
│  └── security           → Rate limiting, CSRF, sanitize     │
│                                                             │
│  Backend:                                                   │
│  ├── Supabase           → Auth, DB, Storage, Edge Functions │
│  ├── Stripe             → Payments + subscriptions          │
│  ├── Razorpay           → India payments                    │
│  ├── Cloudflare Workers → CDN, downloads, webhooks          │
│  └── Upstash Redis      → Caching, rate limiting            │
│                                                             │
│  Infrastructure:                                            │
│  ├── Vercel             → Hosting (Next.js apps)            │
│  ├── Cloudflare         → DNS, CDN, WAF, DDoS protection   │
│  ├── Sentry             → Error tracking                    │
│  ├── PostHog            → Product analytics                 │
│  └── Resend             → Transactional emails              │
│                                                             │
│  Total Sections: 23                                         │
│  Total Pages: 10+ marketplace + 8+ admin                    │
│  Total API Routes: 25+                                      │
│  Total DB Tables: 16+                                       │
│  Total Estimated Files: ~122                                │
│  Total Estimated Effort: 35 working days                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

> **🎉 Document Complete.** This integration plan covers all 23 sections of the LetBuyy Theme Marketplace — from architecture and database schema to individual theme wireframes, engine implementation, customizer, enhancements, KPIs, and developer quick start. Refer to the Summary table in Section 15 for the phased execution timeline.
