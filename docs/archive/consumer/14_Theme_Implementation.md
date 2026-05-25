# LetBuyy Platform — Complete Theme System Implementation

> **Doc 14 of 17** | Theme Engine, Custom CSS, Code Editor, Theme Uploads, Validation, Marketplace, SSO & Store Publishing
>
> **Version:** 2.0 | **Date:** February 16, 2026
>
> **Prev:** [13 Plans & Pricing](./13_Plans_and_Pricing.md) | **Next:** [15 App Store Implementation](./15_App_Store_Implementation.md)

---

# PART 1 — Architecture, Database & Core Theme Engine

---

## 1. System Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LetBuyy Theme System — Full Architecture               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     AUTHENTICATION LAYER                             │   │
│  │                                                                       │   │
│  │  accounts.letbuyy.store ─── lb_session cookie on .letbuyy.store      │   │
│  │       │                                                               │   │
│  │       ├── admin.letbuyy.store    (reads lb_session via middleware)    │   │
│  │       ├── themes.letbuyy.store   (reads lb_session via middleware)    │   │
│  │       ├── *.letbuyy.store        (any future subdomain app)          │   │
│  │       └── {store}.letbuyy.store  (storefront — no auth required)     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     DATA LAYER (Supabase)                             │   │
│  │                                                                       │   │
│  │  ┌────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │   │
│  │  │  themes    │ │ store_themes │ │ theme_custom  │ │ theme_files  │ │   │
│  │  │            │ │              │ │ _css          │ │              │ │   │
│  │  │ • slug     │ │ • theme_id   │ │              │ │ • file_path  │ │   │
│  │  │ • config   │ │ • store_id   │ │ • store_id   │ │ • content    │ │   │
│  │  │ • files    │ │ • overrides  │ │ • global_css │ │ • version    │ │   │
│  │  │ • is_prem  │ │ • is_active  │ │ • section_css│ │ • theme_id   │ │   │
│  │  └────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │   │
│  │                                                                       │   │
│  │  ┌──────────────┐ ┌───────────────┐ ┌───────────────────────────┐  │   │
│  │  │ theme_       │ │ theme_reviews │ │ theme_versions            │  │   │
│  │  │ purchases    │ │               │ │                           │  │   │
│  │  │ • user_id    │ │ • rating      │ │ • theme_id                │  │   │
│  │  │ • price_paid │ │ • review_text │ │ • version                 │  │   │
│  │  │ • license    │ │ • created_at  │ │ • changelog               │  │   │
│  │  └──────────────┘ └───────────────┘ │ • files_snapshot (JSONB)  │  │   │
│  │                                      └───────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     APPLICATION LAYER                                 │   │
│  │                                                                       │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────┐ │   │
│  │  │ Storefront   │ │ Admin App    │ │ Themes App  │ │ Accounts   │ │   │
│  │  │              │ │              │ │             │ │ App        │ │   │
│  │  │ • Renders    │ │ • Theme cfg  │ │ • Browse    │ │ • Login    │ │   │
│  │  │   CSS vars   │ │ • Custom CSS │ │ • Purchase  │ │ • Register │ │   │
│  │  │ • Sections   │ │ • Code editor│ │ • Upload    │ │ • SSO      │ │   │
│  │  │ • Custom CSS │ │ • Publish    │ │ • Validate  │ │ • Cookies  │ │   │
│  │  │   injection  │ │ • Preview    │ │ • Preview   │ │            │ │   │
│  │  └──────────────┘ └──────────────┘ └─────────────┘ └────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     RENDERING LAYER                                   │   │
│  │                                                                       │   │
│  │  Theme Engine → CSS Custom Properties → :root {} variables            │   │
│  │  Custom CSS → <style id="lb-custom-css"> injected after theme vars   │   │
│  │  Section CSS → <style data-section="{id}"> per-section overrides     │   │
│  │  Theme Files → Uploaded assets (images, fonts, JS) served via CDN    │   │
│  │  14 Section Components → Dynamic rendering based on SectionModel[]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Feature Comparison — Shopify vs LetBuyy (Current vs Target)

| Feature | Shopify | LetBuyy Current | LetBuyy Target |
|---|---|---|---|
| **Custom CSS (Global)** | ✅ 1500 chars in editor + custom.css file | ❌ Not implemented | ✅ Unlimited custom.css + in-editor |
| **Custom CSS (Per Section)** | ✅ Per-section CSS in editor | ❌ Not implemented | ✅ Per-section CSS overrides |
| **Code Editor** | ✅ VS Code-based, file tree, search | ❌ Not implemented | ✅ Monaco-based code editor |
| **Theme Upload (ZIP)** | ✅ Upload .zip theme packages | ❌ Not implemented | ✅ Upload + validate .zip |
| **Theme Validation** | ✅ Theme Check CLI (errors/warnings) | ❌ Not implemented | ✅ Server-side validator |
| **Version Control** | ✅ File history + GitHub integration | ❌ Not implemented | ✅ File versioning in DB |
| **Theme Presets** | ✅ Multiple color presets per theme | ✅ 10 THEME_PRESETS | ✅ Expanded presets |
| **Sections/Blocks** | ✅ Nested blocks (8 levels) | ✅ 14 section types | ✅ Add blocks system |
| **Theme Marketplace** | ✅ themes.shopify.com | ❌ Hardcoded data | ✅ themes.letbuyy.store |
| **SSO Across Apps** | ✅ App Bridge session tokens | ✅ lb_session cookie | ✅ Seamless cross-app SSO |
| **Dark Mode** | ✅ Per-theme | ✅ 3 dark presets | ✅ Keep + expand |
| **Font System** | ✅ 1000+ fonts | ✅ 10 fonts | ✅ Expand to 50+ |
| **Asset Manager** | ✅ Upload images/fonts/JS | ❌ Not implemented | ✅ Per-theme asset uploads |
| **Theme Preview** | ✅ Live preview in editor | ❌ Partial | ✅ Full live preview |
| **AI Theme Gen** | ✅ AI section generation (2025) | ❌ Not implemented | ✅ AI theme + section gen |
| **Custom Liquid/Templates** | ✅ Full Liquid templating | ❌ N/A (React-based) | ✅ JSX template overrides |
| **Theme Duplication** | ✅ Duplicate themes | ❌ Not implemented | ✅ Clone + customize |
| **Theme Export** | ✅ Download .zip | ❌ Not implemented | ✅ Export theme as .zip |

### 1.3 Key Design Principles

| Principle | Description |
|---|---|
| **JSONB-First** | Theme config stored as JSONB — colors, fonts, layout, custom CSS |
| **CSS Custom Properties** | `:root` variables generated server-side — zero JS runtime cost |
| **Custom CSS Injection** | User CSS injected AFTER theme variables — full override capability |
| **Section Composition** | Pages composed of ordered `SectionModel[]` rendered by component registry |
| **Preset + Override** | 10 built-in `THEME_PRESETS` → `themeSettings` overrides → custom CSS |
| **Theme Packages** | Themes are self-contained packages (config + assets + CSS + sections) |
| **Validation-First** | All uploaded themes pass server-side validation before install |
| **SSO Native** | Single `lb_session` cookie on `.letbuyy.store` — seamless across all apps |

---

## 2. Database Schema — Complete

### 2.1 `themes` Table — Platform Catalog

```sql
CREATE TABLE IF NOT EXISTS themes (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    site_type       TEXT NOT NULL DEFAULT 'store',
    category        TEXT,
    description     TEXT,
    long_description TEXT,

    -- Preview & Assets
    preview_url     TEXT,
    thumbnail_url   TEXT,
    screenshots     JSONB DEFAULT '[]',

    -- Pricing
    is_premium      BOOLEAN DEFAULT false,
    price           NUMERIC(10,2) DEFAULT 0,
    currency        TEXT DEFAULT 'INR',

    -- Configuration (default colors, fonts, layout)
    config          JSONB DEFAULT '{
        "colors": {
            "primary": "#6366f1",
            "secondary": "#8b5cf6",
            "background": "#ffffff",
            "text": "#1f2937",
            "accent": "#f59e0b"
        },
        "fonts": { "heading": "Inter", "body": "Inter" },
        "layout": { "headerStyle": "sticky", "footerStyle": "standard", "maxWidth": 1280 },
        "darkMode": false
    }',

    -- Theme Package Files (uploaded themes)
    files           JSONB DEFAULT '{}',
    has_custom_css  BOOLEAN DEFAULT false,
    custom_css      TEXT DEFAULT '',

    -- Metadata
    author          TEXT DEFAULT 'LetBuyy',
    author_url      TEXT,
    author_email    TEXT,
    version         TEXT DEFAULT '1.0',
    tags            JSONB DEFAULT '[]',
    features        JSONB DEFAULT '[]',
    is_active       BOOLEAN DEFAULT true,
    is_verified     BOOLEAN DEFAULT false,
    sort_order      INTEGER DEFAULT 0,
    install_count   INTEGER DEFAULT 0,
    rating_avg      NUMERIC(3,2) DEFAULT 0,
    review_count    INTEGER DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_themes_type ON themes(site_type, is_active);
CREATE INDEX IF NOT EXISTS idx_themes_category ON themes(category);
CREATE INDEX IF NOT EXISTS idx_themes_slug ON themes(slug);
CREATE INDEX IF NOT EXISTS idx_themes_premium ON themes(is_premium, is_active);
```

### 2.2 `store_themes` Table — Per-Store Installations

```sql
CREATE TABLE IF NOT EXISTS store_themes (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    is_active       BOOLEAN DEFAULT true,
    config_overrides JSONB DEFAULT '{}',
    installed_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(store_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_store_themes_store ON store_themes(store_id, is_active);
```

### 2.3 `theme_custom_css` Table — User Custom CSS (NEW)

```sql
CREATE TABLE IF NOT EXISTS theme_custom_css (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    theme_id        UUID REFERENCES themes(id) ON DELETE SET NULL,

    -- Global custom CSS (applies to entire store)
    global_css      TEXT DEFAULT '',
    global_css_enabled BOOLEAN DEFAULT true,

    -- Per-section custom CSS overrides
    section_css     JSONB DEFAULT '{}',
    -- Format: { "section_id": { "css": "...", "enabled": true } }

    -- Metadata
    last_edited_by  UUID REFERENCES users_custom(id),
    last_edited_at  TIMESTAMPTZ DEFAULT NOW(),
    created_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(store_id)
);

-- RLS: Only store owners can manage their custom CSS
ALTER TABLE theme_custom_css ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners can manage custom CSS"
    ON theme_custom_css FOR ALL
    USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
```

### 2.4 `theme_files` Table — Theme File System (NEW)

```sql
CREATE TABLE IF NOT EXISTS theme_files (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    store_id        UUID REFERENCES sites(id) ON DELETE CASCADE,
    -- store_id is NULL for platform themes, set for user-uploaded

    file_path       TEXT NOT NULL,
    -- e.g. "assets/custom.css", "sections/hero.json", "config/settings.json"

    file_type       TEXT NOT NULL,
    -- 'css' | 'json' | 'js' | 'image' | 'font' | 'svg'

    content         TEXT,
    -- Text content for css/json/js files (NULL for binary assets)

    file_url        TEXT,
    -- CDN URL for binary assets (images, fonts)

    file_size       INTEGER DEFAULT 0,
    -- Size in bytes

    -- Version tracking
    version         INTEGER DEFAULT 1,
    previous_content TEXT,
    -- Stores one previous version for undo

    is_locked       BOOLEAN DEFAULT false,
    -- Platform theme files are locked from editing

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(theme_id, store_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_theme_files_theme ON theme_files(theme_id);
CREATE INDEX IF NOT EXISTS idx_theme_files_store ON theme_files(store_id);
CREATE INDEX IF NOT EXISTS idx_theme_files_path ON theme_files(file_path);
```

### 2.5 `theme_versions` Table — Version History (NEW)

```sql
CREATE TABLE IF NOT EXISTS theme_versions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    store_id        UUID REFERENCES sites(id) ON DELETE CASCADE,

    version         TEXT NOT NULL,
    -- Semantic version: "1.0.0", "1.1.0", etc.

    changelog       TEXT,
    files_snapshot  JSONB DEFAULT '{}',
    -- Snapshot of all file paths + content hashes at this version

    config_snapshot JSONB DEFAULT '{}',
    -- Snapshot of theme config at this version

    created_by      UUID REFERENCES users_custom(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_versions_theme ON theme_versions(theme_id);
```

### 2.6 `theme_purchases` Table

```sql
CREATE TABLE IF NOT EXISTS theme_purchases (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users_custom(id),
    theme_id        UUID NOT NULL REFERENCES themes(id),
    price_paid      NUMERIC(10,2) DEFAULT 0,
    currency        TEXT DEFAULT 'INR',
    payment_id      TEXT,
    payment_method  TEXT,
    license_type    TEXT DEFAULT 'perpetual',
    -- 'perpetual' = one-time, 'subscription' = recurring
    license_key     TEXT,
    is_refunded     BOOLEAN DEFAULT false,
    purchased_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, theme_id)
);
```

### 2.7 `theme_reviews` Table

```sql
CREATE TABLE IF NOT EXISTS theme_reviews (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users_custom(id),
    theme_id        UUID NOT NULL REFERENCES themes(id),
    rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
    title           TEXT,
    review_text     TEXT,
    is_verified     BOOLEAN DEFAULT false,
    -- true if user actually installed the theme
    helpful_count   INTEGER DEFAULT 0,
    response_text   TEXT,
    -- Theme developer's response
    response_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, theme_id)
);
```

### 2.8 Row Level Security (RLS)

```sql
-- themes: Public read, admin write
CREATE POLICY "Themes viewable by everyone" ON themes FOR SELECT USING (true);
CREATE POLICY "Admins can manage themes" ON themes FOR ALL
    USING (auth.uid() IN (SELECT user_id FROM super_admins));

-- store_themes: Store owner CRUD
CREATE POLICY "Owners view their themes" ON store_themes FOR SELECT
    USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "Owners install themes" ON store_themes FOR INSERT
    WITH CHECK (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "Owners update themes" ON store_themes FOR UPDATE
    USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "Owners uninstall themes" ON store_themes FOR DELETE
    USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- theme_reviews: Public read, authenticated write
CREATE POLICY "Reviews viewable by everyone" ON theme_reviews FOR SELECT USING (true);
CREATE POLICY "Users can write reviews" ON theme_reviews FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can edit own reviews" ON theme_reviews FOR UPDATE
    USING (auth.uid() = user_id);
```

### 2.9 Entity Relationship Diagram

```
users_custom                themes                    sites (stores)
┌──────────┐          ┌──────────────┐          ┌──────────────────┐
│ id (PK)  │◄────┐    │ id (PK)      │◄───┐     │ id (PK)          │
│ email    │     │    │ name         │    │     │ name             │
│ name     │     │    │ slug (UQ)    │    │     │ subdomain        │
└──────────┘     │    │ config       │    │     │ template_config  │
     │           │    │ files        │    │     │ theme_id         │
     │           │    │ custom_css   │    │     │ status           │
     │           │    │ is_premium   │    │     └──────────────────┘
     │           │    │ price        │    │          │         │
     │           │    └──────────────┘    │          │         │
     │           │         │    │         │          │         │
     │    ┌──────┴─────────┤    │    ┌────┴──────────┘         │
     │    │                │    │    │                          │
     │    ▼                ▼    │    ▼                          ▼
┌────┴────────┐  ┌─────────────┴──────────┐  ┌────────────────────┐
│ theme_      │  │ store_themes           │  │ theme_custom_css   │
│ purchases   │  │                        │  │                    │
│ • user_id   │  │ • store_id (FK→sites)  │  │ • store_id (FK)    │
│ • theme_id  │  │ • theme_id (FK→themes) │  │ • global_css       │
│ • price_paid│  │ • is_active            │  │ • section_css      │
│ • license   │  │ • config_overrides     │  │ • last_edited_at   │
└─────────────┘  └────────────────────────┘  └────────────────────┘
     │
     ▼
┌─────────────┐  ┌────────────────────────┐  ┌────────────────────┐
│ theme_      │  │ theme_files            │  │ theme_versions     │
│ reviews     │  │                        │  │                    │
│ • user_id   │  │ • theme_id (FK)        │  │ • theme_id (FK)    │
│ • theme_id  │  │ • store_id (FK, null)  │  │ • version          │
│ • rating    │  │ • file_path            │  │ • changelog        │
│ • title     │  │ • content              │  │ • files_snapshot   │
│ • review    │  │ • version              │  │ • config_snapshot  │
└─────────────┘  └────────────────────────┘  └────────────────────┘
```

---

## 3. CSS Custom Properties Engine

### 3.1 Theme Rendering Flow

```
Store Created → template_config saved as JSONB
                    │
                    ▼
Customer Request → middleware.ts rewrites to /store/[subdomain]
                    │
                    ▼
layout.tsx (Server Component):
├── 1. StoreService.getStoreBySubdomainAnyStatus()
├── 2. Check status → draft? → <ComingSoon>
├── 3. Extract themeSettings from templateConfig
├── 4. Look up THEME_PRESETS[themeId]
├── 5. Compute isDark, fonts, semantic colors
├── 6. Generate <style id="lb-theme-vars"> with :root CSS variables
├── 7. Fetch custom CSS from theme_custom_css table          ◄── NEW
├── 8. Inject <style id="lb-custom-css"> after theme vars    ◄── NEW
├── 9. Inject <style id="lb-section-css"> per-section        ◄── NEW
└── 10. Render DynamicHeader + children + DynamicFooter
```

### 3.2 CSS Injection Order (Critical for Cascade)

```html
<head>
    <!-- 1. Theme Variables — generated from themeSettings -->
    <style id="lb-theme-vars">
        :root {
            --primary: #000000;
            --secondary: #FFFFFF;
            --accent: #E5E5E5;
            --background: #FFFFFF;
            --text: #1A1A2E;
            --radius: 12px;
            --font-main: var(--font-inter), system-ui, sans-serif;
            --font-heading: var(--font-inter), system-ui, sans-serif;
            /* ... 40+ variables ... */
        }
    </style>

    <!-- 2. Theme Base CSS — from theme package (optional) -->
    <style id="lb-theme-base">
        /* CSS from themes.custom_css column */
        /* Shipped with the theme package */
    </style>

    <!-- 3. User Custom CSS — from theme_custom_css.global_css -->
    <style id="lb-custom-css">
        /* User's custom CSS — overrides everything above */
        .product-card { border-radius: 0 !important; }
        .hero-section { min-height: 80vh; }
    </style>
</head>

<body>
    <!-- 4. Per-Section CSS — injected before each section -->
    <style data-section="hero-1">
        /* Section-specific CSS from theme_custom_css.section_css */
        #section-hero-1 .hero-heading { font-size: 4rem; }
    </style>
    <section id="section-hero-1">...</section>

    <style data-section="grid-2">
        #section-grid-2 .product-card { gap: 2rem; }
    </style>
    <section id="section-grid-2">...</section>
</body>
```

### 3.3 CSS Variable Reference (Complete — 45+ Variables)

```css
:root {
    /* ===== BRAND COLORS ===== */
    --primary: ${ts.primaryColor};
    --secondary: ${ts.secondaryColor};
    --accent: ${ts.accentColor};
    --background: ${backgroundColor};
    --text: ${textColor};
    --radius: ${ts.borderRadius}px;

    /* ===== TYPOGRAPHY ===== */
    --font-main: ${fontCss}, system-ui, sans-serif;
    --font-heading: ${headingFontCss}, system-ui, sans-serif;

    /* ===== DESIGN TOKENS ===== */
    --enable-animations: ${ts.enableAnimations ? 1 : 0};
    --enable-shadows: ${ts.enableShadows ? 1 : 0};
    --is-dark: ${isDark ? 1 : 0};

    /* ===== SEMANTIC TEXT (auto-computed) ===== */
    --text-secondary: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
    --text-muted: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
    --text-hint: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
    --text-inverse: ${isDark ? '#000000' : '#FFFFFF'};

    /* ===== BORDERS & SURFACES ===== */
    --border-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
    --surface: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'};
    --surface-hover: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};

    /* ===== CARDS ===== */
    --card-bg: ${isDark ? surfaceColor : '#ffffff'};
    --card-bg-secondary: ${isDark ? 'rgba(255,255,255,0.08)' : surfaceColor};
    --card-text: ${isDark ? '#f8fafc' : '#111827'};
    --card-text-muted: ${isDark ? '#94a3b8' : '#6b7280'};
    --card-border: ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'};

    /* ===== HEADER ===== */
    --header-bg-scrolled: ${isDark ? surfaceColor : '#ffffff'};
    --header-shadow: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'};

    /* ===== FOOTER ===== */
    --footer-bg: ${isDark ? backgroundColor : '#0f172a'};
    --footer-text: ${isDark ? textColor : '#ffffff'};
    --footer-text-muted: ${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.6)'};

    /* ===== INPUTS ===== */
    --input-bg: ${isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'};
    --input-border: ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'};
    --input-text: ${textColor};
    --input-placeholder: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};

    /* ===== CUSTOM CSS VARIABLES (user-overridable) ===== */
    --custom-spacing: 1rem;
    --custom-max-width: 1280px;
    --custom-header-height: 64px;
    --custom-footer-height: auto;
}
```

### 3.4 THEME_PRESETS Registry (10 Presets)

```typescript
export const THEME_PRESETS: Record<string, Partial<ThemeSettings>> = {
    'minimal_modern':   { isDark: false, backgroundColor: '#FFFFFF',  textColor: '#000000', surfaceColor: '#F9FAFB' },
    'vibrant_bold':     { isDark: false, backgroundColor: '#FFFFFF',  textColor: '#1A1A2E', surfaceColor: '#FFF5F5' },
    'natural_organic':  { isDark: false, backgroundColor: '#F5F1EB',  textColor: '#2D5016', surfaceColor: '#FDFCFA' },
    'tech_elite':       { isDark: true,  backgroundColor: '#0A0A0F',  textColor: '#FFFFFF', surfaceColor: '#1A1A2E' },
    'luxury_premium':   { isDark: true,  backgroundColor: '#1C1C1C',  textColor: '#F8F5F0', surfaceColor: '#2A2A2A' },
    'sunset_gradient':  { isDark: false, backgroundColor: '#FFFAF5',  textColor: '#1A1A2E', surfaceColor: '#FFF8F0' },
    'ocean_breeze':     { isDark: false, backgroundColor: '#F0FDFF',  textColor: '#0A4D68', surfaceColor: '#E8FAFB' },
    'midnight_purple':  { isDark: true,  backgroundColor: '#1a1625',  textColor: '#FFFFFF', surfaceColor: '#2D2640' },
    'fresh_mint':       { isDark: false, backgroundColor: '#F0FDF4',  textColor: '#064E3B', surfaceColor: '#ECFDF5' },
    'royal_rose':       { isDark: false, backgroundColor: '#FDF2F8',  textColor: '#831843', surfaceColor: '#FDF4F9' },
};
```

---

## 4. Seeded Themes Reference

The migration (`009_online_store_themes.sql`) seeds 6 free themes:

| # | Name | Slug | Category | Dark? | Primary | Heading Font |
|---|---|---|---|---|---|---|
| 1 | Urban Kicks | `urban-kicks` | modern | No | `#000000` | Inter |
| 2 | Aurora | `aurora` | modern | No | `#6366f1` | Inter |
| 3 | Zenith | `zenith` | minimal | No | `#1e3a5f` | Inter |
| 4 | Ember | `ember` | luxury | **Yes** | `#C9A96E` | Playfair Display |
| 5 | Blossom | `blossom` | organic | No | `#E8B4B8` | Outfit |
| 6 | Nova | `nova` | vibrant | No | `#7C3AED` | Inter |

Additional templates defined in code (4 ThemeEntry objects):

| Name | Pricing | Preset | Tags |
|---|---|---|---|
| Urban Kicks | Free | `minimal_modern` | streetwear, sneakers, fashion |
| Luxe Atelier | Premium ($49) | `luxury_premium` | luxury, dark, gold, jewelry |
| Nature's Basket | Free | `natural_organic` | organic, natural, eco, artisan |
| Neon Tech | Free | `tech_elite` | tech, gadgets, neon, futuristic |

---

*End of Part 1 — Continued in Part 2*

---

# PART 2 — Custom CSS, Code Editor & Theme Upload/Validation

---

## 5. Custom CSS System — Full Implementation

### 5.1 Custom CSS Architecture (Like Shopify)

Shopify provides custom CSS at two levels: (1) Global custom CSS for the entire theme, and (2) Per-section custom CSS. LetBuyy will replicate this pattern using `theme_custom_css` table + in-editor CSS editing.

```
┌──────────────────────────────────────────────────────────────────────┐
│                       Custom CSS Architecture                        │
│                                                                      │
│  Admin Theme Editor                                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  ┌─────────────────────┐   ┌────────────────────────────────┐│ │
│  │  │ Theme Settings      │   │ Custom CSS Panel               ││ │
│  │  │                     │   │                                ││ │
│  │  │ ┌─────────────────┐ │   │ ┌────────────────────────────┐ ││ │
│  │  │ │ Colors          │ │   │ │ Global CSS Tab             │ ││ │
│  │  │ ├─────────────────┤ │   │ │                            │ ││ │
│  │  │ │ Typography      │ │   │ │ .product-card {            │ ││ │
│  │  │ ├─────────────────┤ │   │ │   border-radius: 0;       │ ││ │
│  │  │ │ Layout          │ │   │ │   box-shadow: none;        │ ││ │
│  │  │ ├─────────────────┤ │   │ │ }                          │ ││ │
│  │  │ │ Custom CSS ──── │ │──►│ │                            │ ││ │
│  │  │ │                 │ │   │ │ Syntax Highlighting ✓      │ ││ │
│  │  │ │                 │ │   │ │ Auto-complete ✓            │ ││ │
│  │  │ │                 │ │   │ │ Error Detection ✓          │ ││ │
│  │  │ │                 │ │   │ │ Live Preview ✓             │ ││ │
│  │  │ │                 │ │   │ └────────────────────────────┘ ││ │
│  │  │ │                 │ │   │                                ││ │
│  │  │ │                 │ │   │ ┌────────────────────────────┐ ││ │
│  │  │ │                 │ │   │ │ Section CSS Tab            │ ││ │
│  │  │ │                 │ │   │ │                            │ ││ │
│  │  │ │                 │ │   │ │ Select Section: [Hero ▼]   │ ││ │
│  │  │ │                 │ │   │ │                            │ ││ │
│  │  │ │                 │ │   │ │ #section-hero .title {     │ ││ │
│  │  │ │                 │ │   │ │   font-size: 5rem;         │ ││ │
│  │  │ │                 │ │   │ │ }                          │ ││ │
│  │  │ │                 │ │   │ └────────────────────────────┘ ││ │
│  │  │ └─────────────────┘ │   └────────────────────────────────┘│ │
│  │  └─────────────────────┘                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    Live Preview (iframe)                        │ │
│  │                                                                │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │ https://{store}.letbuyy.store?preview=true&css_token=... │ │ │
│  │  │                                                          │ │ │
│  │  │  Theme CSS Variables (base)                              │ │ │
│  │  │  + Theme Base CSS                                        │ │ │
│  │  │  + User Custom CSS ← Real-time injection via postMessage │ │ │
│  │  │  + Section CSS overrides                                 │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Custom CSS API Endpoints

```
POST   /api/themes/custom-css
Body:  { store_id, global_css, section_css }
Resp:  { success: true, updated_at }

GET    /api/themes/custom-css?store_id={id}
Resp:  { global_css, global_css_enabled, section_css, last_edited_at }

PATCH  /api/themes/custom-css/toggle
Body:  { store_id, enabled: boolean }
Resp:  { success: true }

POST   /api/themes/custom-css/validate
Body:  { css: string }
Resp:  { valid: boolean, errors: CSSValidationError[], warnings: CSSValidationWarning[] }
```

### 5.3 CSS Validation Engine

```typescript
// lib/themes/css-validator.ts

interface CSSValidationResult {
    valid: boolean;
    errors: CSSValidationError[];
    warnings: CSSValidationWarning[];
    stats: {
        ruleCount: number;
        selectorCount: number;
        propertyCount: number;
        fileSize: number;
        estimatedSpecificity: 'low' | 'medium' | 'high';
    };
}

interface CSSValidationError {
    type: 'syntax' | 'security' | 'forbidden' | 'size';
    message: string;
    line: number;
    column: number;
    severity: 'error';
    code: string;
    // e.g., "CSS_SYNTAX_001", "CSS_SECURITY_001"
}

interface CSSValidationWarning {
    type: 'performance' | 'compatibility' | 'best-practice' | 'override';
    message: string;
    line: number;
    column: number;
    severity: 'warning' | 'info';
    suggestion?: string;
}

// Validation Rules
const VALIDATION_RULES = {
    // ===== ERRORS (blocks save) =====
    FORBIDDEN_PROPERTIES: [
        'behavior',         // IE-specific, security risk
        'expression',       // CSS expressions, security risk
        '-moz-binding',     // XBL binding, security risk
    ],
    FORBIDDEN_AT_RULES: [
        '@import',          // External resource loading — use asset manager
        '@charset',         // Encoding attacks
    ],
    FORBIDDEN_VALUES: [
        /javascript:/i,     // XSS via CSS
        /url\s*\(\s*data:/i, // Base64 data URIs (>2KB) — size concerns
        /expression\s*\(/i,  // IE CSS expressions
    ],
    MAX_FILE_SIZE: 500 * 1024,  // 500KB max custom CSS
    MAX_SELECTORS: 5000,        // Performance guard

    // ===== WARNINGS (allows save, shows notice) =====
    WARN_IMPORTANT: true,       // Warn when !important is used
    WARN_ID_SELECTORS: true,    // Suggest class selectors instead
    WARN_DEEP_NESTING: 4,       // Warn if selector depth > 4
    WARN_UNIVERSAL_SELECTOR: true, // Warn on * selector
    WARN_INLINE_URLS: true,     // Suggest using asset manager for images
};
```

### 5.4 CSS Validation Error Messages — Complete Reference

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CSS VALIDATION ERROR REPORT                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ❌ ERRORS (3 found — must fix before saving)                          │
│  ─────────────────────────────────────────                              │
│                                                                         │
│  Line 14, Col 5: CSS_SYNTAX_001                                        │
│  ├── Unexpected token '}' — missing closing brace for selector         │
│  └── .product-card { color: red;                                       │
│               ▲                                                        │
│               └── Expected '}' here                                    │
│                                                                         │
│  Line 28, Col 12: CSS_SECURITY_001                                     │
│  ├── Forbidden value: 'javascript:' URLs are not allowed               │
│  └── background: url(javascript:alert(1));                             │
│                       ^^^^^^^^^^^                                      │
│                                                                         │
│  Line 42, Col 1: CSS_FORBIDDEN_001                                     │
│  ├── @import is not allowed — use the Asset Manager to upload files    │
│  └── @import url('https://evil.com/styles.css');                       │
│      ^^^^^^^                                                           │
│                                                                         │
│  ⚠️  WARNINGS (4 found — recommended fixes)                            │
│  ─────────────────────────────────────────                              │
│                                                                         │
│  Line 8, Col 20: CSS_PERF_001                                         │
│  ├── Using !important may cause specificity conflicts                  │
│  ├── color: red !important;                                            │
│  └── 💡 Suggestion: Use a more specific selector instead               │
│                                                                         │
│  Line 15, Col 1: CSS_PRACTICE_001                                      │
│  ├── Avoid #id selectors — prefer .class selectors                    │
│  ├── #main-content .product { ... }                                    │
│  └── 💡 Suggestion: .main-content .product { ... }                     │
│                                                                         │
│  Line 22, Col 1: CSS_PERF_002                                         │
│  ├── Universal selector (*) can impact rendering performance           │
│  ├── * { box-sizing: border-box; }                                     │
│  └── 💡 Suggestion: Apply to specific elements instead                 │
│                                                                         │
│  Line 35, Col 1: CSS_COMPAT_001                                       │
│  ├── Deep nesting (5 levels) — may cause specificity issues            │
│  ├── .page .main .grid .card .title { ... }                           │
│  └── 💡 Suggestion: Flatten to .product-card-title { ... }             │
│                                                                         │
│  ℹ️  INFO                                                               │
│  ─────                                                                  │
│  CSS Size: 2.4KB / 500KB limit                                         │
│  Rules: 34 | Selectors: 48 | Properties: 89                           │
│  Estimated Specificity: Medium                                          │
│  Theme Variables Used: 6 (--primary, --text, --background, etc.)       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.5 Custom CSS Editor — Admin UI Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  admin.letbuyy.store/settings/themes/customize                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ← Back to Themes          🎨 Theme Customizer          [Publish]  │
│                                                                     │
│  ┌────────────────┐  ┌──────────────────────────────────────────┐  │
│  │ Sidebar        │  │ Main Editor Area                         │  │
│  │                │  │                                          │  │
│  │ 🎨 Colors     │  │  ┌──────────────────────────────────┐   │  │
│  │ 📝 Typography │  │  │ CSS Editor (Monaco)              │   │  │
│  │ 📐 Layout     │  │  │                                  │   │  │
│  │ 🖼  Header    │  │  │  1 │ /* Global Custom CSS */     │   │  │
│  │ 📋 Footer     │  │  │  2 │                             │   │  │
│  │               │  │  │  3 │ .product-card {             │   │  │
│  │ ──────────────│  │  │  4 │   border-radius: 0;        │   │  │
│  │               │  │  │  5 │   transition: all 0.3s;    │   │  │
│  │ ✨ Custom CSS │◄─┤──│  6 │ }                          │   │  │
│  │   (active)    │  │  │  7 │                             │   │  │
│  │               │  │  │  8 │ .hero-section {             │   │  │
│  │ ┌───────────┐ │  │  │  9 │   min-height: 80vh;       │   │  │
│  │ │ ○ Global  │ │  │  │ 10 │   background-size: cover; │   │  │
│  │ │ ○ Sections│ │  │  │ 11 │ }                          │   │  │
│  │ └───────────┘ │  │  │                                  │   │  │
│  │               │  │  │  ┌──────────────────────────────┐│   │  │
│  │ Variables:    │  │  │  │ Autocomplete:               ││   │  │
│  │ --primary     │  │  │  │  --primary                  ││   │  │
│  │ --secondary   │  │  │  │  --secondary                ││   │  │
│  │ --accent      │  │  │  │  --accent                   ││   │  │
│  │ --background  │  │  │  │  --text                     ││   │  │
│  │ --text        │  │  │  └──────────────────────────────┘│   │  │
│  │ --radius      │  │  │                                  │   │  │
│  │ --font-main   │  │  │  Status: ✅ Valid | 2.4KB/500KB │   │  │
│  │               │  │  └──────────────────────────────────┘   │  │
│  │ [? Help]      │  │                                          │  │
│  │ [↩ Reset]     │  │  ┌──────────────────────────────────┐   │  │
│  └────────────────┘  │  │ Validation Panel                │   │  │
│                      │  │                                  │   │  │
│                      │  │ ✅ No errors found               │   │  │
│                      │  │ ⚠️  1 warning: !important on L4  │   │  │
│                      │  │                                  │   │  │
│                      │  └──────────────────────────────────┘   │  │
│                      └──────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Live Preview (iframe)                      │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │ 🖥  Desktop │ 📱 Tablet │ 📱 Mobile                  │   │  │
│  │  ├──────────────────────────────────────────────────────┤   │  │
│  │  │                                                      │   │  │
│  │  │   [Store preview with custom CSS applied in          │   │  │
│  │  │    real-time via postMessage API]                     │   │  │
│  │  │                                                      │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.6 Live Preview — postMessage API

```typescript
// In Admin Editor: Send CSS updates to preview iframe
const sendCSSUpdate = (css: string, type: 'global' | 'section', sectionId?: string) => {
    const iframe = document.getElementById('preview-frame') as HTMLIFrameElement;
    iframe.contentWindow?.postMessage({
        type: 'LB_CUSTOM_CSS_UPDATE',
        payload: { css, type, sectionId }
    }, '*');
};

// In Storefront Preview: Receive and apply CSS updates
window.addEventListener('message', (event) => {
    if (event.data.type !== 'LB_CUSTOM_CSS_UPDATE') return;

    const { css, type, sectionId } = event.data.payload;

    if (type === 'global') {
        let styleEl = document.getElementById('lb-custom-css');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'lb-custom-css';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = css;
    } else if (type === 'section' && sectionId) {
        let styleEl = document.querySelector(`style[data-section="${sectionId}"]`);
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.setAttribute('data-section', sectionId);
            const section = document.getElementById(`section-${sectionId}`);
            section?.parentNode?.insertBefore(styleEl, section);
        }
        styleEl.textContent = css;
    }
});
```

---

## 6. Theme Code Editor — Monaco Integration

### 6.1 Code Editor Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                   Theme Code Editor Architecture                      │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │ admin.letbuyy.store/themes/editor                             │  │
│  │                                                               │  │
│  │  ┌──────────┐  ┌──────────────────────────────────────────┐ │  │
│  │  │ File     │  │ Monaco Editor                            │ │  │
│  │  │ Tree     │  │                                          │ │  │
│  │  │          │  │  Language: CSS / JSON / JS / HTML        │ │  │
│  │  │ 📁 assets│  │  Features:                               │ │  │
│  │  │  ├ custom│  │  • Syntax highlighting                  │ │  │
│  │  │  │ .css  │  │  • Auto-complete for CSS vars           │ │  │
│  │  │  ├ logo  │  │  • Error squiggles                      │ │  │
│  │  │  │ .svg  │  │  • Bracket matching                     │ │  │
│  │  │  └ font  │  │  • Find & replace                       │ │  │
│  │  │    .woff │  │  • Multi-cursor                         │ │  │
│  │  │ 📁 config│  │  • Minimap                              │ │  │
│  │  │  └ settin│  │  • Emmet support                        │ │  │
│  │  │    gs.js │  │                                          │ │  │
│  │  │ 📁 secti│  │  ┌──────────────────────────────────┐   │ │  │
│  │  │  ├ hero  │  │  │ custom.css                    ×  │   │ │  │
│  │  │  │ .json │  │  │ settings.json                    │   │ │  │
│  │  │  ├ produ │  │  └──────────────────────────────────┘   │ │  │
│  │  │  │ ct.js │  │                                          │ │  │
│  │  │  └ foote │  │  1 │ /* LetBuyy Custom Theme CSS */     │ │  │
│  │  │    r.json│  │  2 │ :root {                            │ │  │
│  │  │          │  │  3 │   --custom-nav-height: 72px;      │ │  │
│  │  │ + New    │  │  4 │ }                                  │ │  │
│  │  │ ↑ Upload │  │  5 │                                    │ │  │
│  │  └──────────┘  │  6 │ .header-nav {                     │ │  │
│  │                │  7 │   backdrop-filter: blur(12px);    │ │  │
│  │  [Search all]  │  8 │ }                                  │ │  │
│  │                └──────────────────────────────────────────┘ │  │
│  │                                                               │  │
│  │  Status Bar:                                                  │  │
│  │  ┌───────────────────────────────────────────────────────┐   │  │
│  │  │ CSS │ UTF-8 │ LF │ Ln 6, Col 3 │ Saved ✓ │ v1.2    │   │  │
│  │  └───────────────────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Supported File Types & Directories

| Directory | Allowed Types | Editable | Purpose |
|---|---|---|---|
| `assets/` | `.css`, `.js`, `.svg`, `.png`, `.jpg`, `.woff`, `.woff2` | CSS/JS: Yes, Binary: Upload only | Static assets |
| `config/` | `.json` | Yes | Theme settings schema |
| `sections/` | `.json` | Yes | Section settings & presets |
| `snippets/` | `.json`, `.css` | Yes | Reusable code snippets |
| `templates/` | `.json` | Yes | Page template definitions |
| `locales/` | `.json` | Yes | i18n translation files |

### 6.3 File Operations API

```
GET    /api/themes/files?theme_id={id}&store_id={id}
       Returns: { files: ThemeFile[] }

GET    /api/themes/files/{file_id}
       Returns: { content, version, previous_content, updated_at }

PUT    /api/themes/files/{file_id}
       Body: { content }
       Returns: { version, updated_at, validation_result }
       Note: Automatically saves previous version for undo

POST   /api/themes/files
       Body: { theme_id, store_id, file_path, content?, file (multipart) }
       Returns: { file_id, file_url }

DELETE /api/themes/files/{file_id}
       Returns: { success: true }

POST   /api/themes/files/{file_id}/revert
       Returns: { content: previous_content, version }

GET    /api/themes/files/search?theme_id={id}&query={text}
       Returns: { results: [{ file_path, line, content }] }
```

### 6.4 File Version History

```typescript
// When user saves a file:
async function saveThemeFile(fileId: string, newContent: string) {
    // 1. Read current content
    const current = await supabase.from('theme_files')
        .select('content, version').eq('id', fileId).single();

    // 2. Save current as previous, update content
    await supabase.from('theme_files')
        .update({
            content: newContent,
            previous_content: current.data.content,
            version: current.data.version + 1,
            updated_at: new Date().toISOString()
        })
        .eq('id', fileId);

    // 3. If version is a milestone (every 10), snapshot to theme_versions
    if ((current.data.version + 1) % 10 === 0) {
        await createVersionSnapshot(fileId);
    }

    // 4. Validate the saved content
    const validationResult = await validateFile(fileId, newContent);
    return { version: current.data.version + 1, validationResult };
}
```

---

## 7. Theme Upload System — ZIP Package Format

### 7.1 Theme Package Structure

```
my-custom-theme.zip
├── theme.json                 ← Required: Theme manifest
├── config/
│   └── settings.json          ← Required: Theme settings schema
├── assets/
│   ├── theme.css              ← Optional: Theme base CSS
│   ├── custom.js              ← Optional: Theme JavaScript
│   ├── logo.svg               ← Optional: Theme logo
│   └── fonts/                 ← Optional: Custom fonts
│       ├── heading.woff2
│       └── body.woff2
├── sections/
│   ├── hero.json              ← Section configurations
│   ├── product-grid.json
│   └── footer.json
├── templates/
│   ├── index.json             ← Homepage template
│   ├── product.json           ← Product page template
│   └── collection.json        ← Collection page template
├── locales/
│   ├── en.json                ← English translations
│   └── ta.json                ← Tamil translations
└── preview/
    ├── desktop.png            ← Required: Desktop preview (1440x900)
    ├── mobile.png             ← Required: Mobile preview (375x812)
    └── thumbnail.png          ← Required: Thumbnail (600x400)
```

### 7.2 `theme.json` Manifest — Required Schema

```json
{
    "name": "My Custom Theme",
    "slug": "my-custom-theme",
    "version": "1.0.0",
    "description": "A beautiful custom theme for LetBuyy stores",
    "author": {
        "name": "Developer Name",
        "email": "dev@example.com",
        "url": "https://developer.com"
    },
    "site_types": ["store", "portfolio"],
    "category": "modern",
    "tags": ["clean", "minimal", "responsive"],
    "features": [
        "Dark mode support",
        "Custom fonts",
        "Responsive design"
    ],
    "config": {
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
        "darkMode": false,
        "customCSS": true
    },
    "presets": [
        {
            "name": "Default",
            "colors": { "primary": "#6366f1", "background": "#ffffff" }
        },
        {
            "name": "Dark",
            "colors": { "primary": "#818cf8", "background": "#0f172a" }
        }
    ],
    "sections": {
        "supported": [
            "hero", "product_grid", "featured_products", "testimonials",
            "newsletter", "about", "cta", "banner_carousel", "marquee"
        ],
        "default_order": ["hero", "featured_products", "testimonials", "newsletter"]
    },
    "requirements": {
        "min_platform_version": "1.0",
        "required_sections": ["hero", "product_grid"],
        "supports_dark_mode": true
    },
    "screenshots": [
        "preview/desktop.png",
        "preview/mobile.png"
    ],
    "thumbnail": "preview/thumbnail.png"
}
```

### 7.3 Theme Upload Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                       Theme Upload Flow                                │
│                                                                        │
│  Step 1: Upload                Step 2: Validate                       │
│  ┌──────────────────┐         ┌──────────────────────────────────┐   │
│  │ 📁 Drop .zip or  │    ──► │ Server-Side Validation Pipeline  │   │
│  │    click to      │         │                                  │   │
│  │    browse        │         │ □ ZIP integrity check            │   │
│  │                  │         │ □ theme.json exists & valid      │   │
│  │ [my-theme.zip]   │         │ □ Required files present         │   │
│  │ 2.4 MB           │         │ □ File types allowed             │   │
│  │                  │         │ □ File sizes within limits       │   │
│  │ [Upload Theme]   │         │ □ CSS validation                 │   │
│  └──────────────────┘         │ □ JSON schema validation         │   │
│                               │ □ Image dimensions check         │   │
│                               │ □ Security scan                  │   │
│                               │ □ Section compatibility check    │   │
│                               └──────────────────────────────────┘   │
│                                        │                              │
│                                        ▼                              │
│  Step 3: Validation Report    Step 4: Install                        │
│  ┌──────────────────────┐    ┌──────────────────────────────────┐   │
│  │ ✅ Validation Passed │    │ Theme installed successfully!     │   │
│  │    (or)              │    │                                  │   │
│  │ ❌ Validation Failed │    │ ○ Set as active theme            │   │
│  │    with error list   │    │ ○ Keep current theme             │   │
│  │                      │    │                                  │   │
│  │ [View Full Report]   │    │ [Preview Theme] [Activate Now]  │   │
│  └──────────────────────┘    └──────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Server-Side Validation Pipeline — Complete

```typescript
// lib/themes/theme-validator.ts

interface ThemeValidationResult {
    valid: boolean;
    phase: string;      // Which phase failed
    errors: ThemeError[];
    warnings: ThemeWarning[];
    info: ThemeInfo[];
    stats: ThemeStats;
}

interface ThemeError {
    code: string;
    phase: string;
    message: string;
    file?: string;
    line?: number;
    severity: 'critical' | 'error';
    fixSuggestion?: string;
}

async function validateThemePackage(zipBuffer: Buffer): Promise<ThemeValidationResult> {
    const result: ThemeValidationResult = {
        valid: true, phase: '', errors: [], warnings: [], info: [], stats: {}
    };

    // ===== PHASE 1: ZIP Integrity =====
    try {
        const zip = await JSZip.loadAsync(zipBuffer);
    } catch {
        result.errors.push({
            code: 'ZIP_CORRUPT',
            phase: 'integrity',
            message: 'Uploaded file is not a valid ZIP archive',
            severity: 'critical'
        });
        return finalize(result);
    }

    // ===== PHASE 2: Structure Check =====
    const requiredFiles = ['theme.json'];
    for (const file of requiredFiles) {
        if (!zip.files[file]) {
            result.errors.push({
                code: 'MISSING_REQUIRED',
                phase: 'structure',
                message: `Required file missing: ${file}`,
                severity: 'critical',
                fixSuggestion: 'Add theme.json to the root of your ZIP'
            });
        }
    }

    // ===== PHASE 3: Manifest Validation =====
    const manifest = JSON.parse(await zip.file('theme.json')!.async('string'));
    const requiredFields = ['name', 'slug', 'version', 'config'];
    for (const field of requiredFields) {
        if (!manifest[field]) {
            result.errors.push({
                code: 'MANIFEST_MISSING_FIELD',
                phase: 'manifest',
                message: `theme.json missing required field: "${field}"`,
                file: 'theme.json',
                severity: 'error',
                fixSuggestion: `Add "${field}" to your theme.json`
            });
        }
    }

    // Slug format validation
    if (manifest.slug && !/^[a-z0-9-]+$/.test(manifest.slug)) {
        result.errors.push({
            code: 'INVALID_SLUG',
            phase: 'manifest',
            message: 'Theme slug must contain only lowercase letters, numbers, and hyphens',
            file: 'theme.json',
            severity: 'error'
        });
    }

    // Version format validation
    if (manifest.version && !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
        result.warnings.push({
            code: 'INVALID_VERSION',
            phase: 'manifest',
            message: 'Version should follow semver format (e.g., 1.0.0)',
            file: 'theme.json'
        });
    }

    // ===== PHASE 4: File Type & Size Validation =====
    const ALLOWED_EXTENSIONS = ['.css','.js','.json','.png','.jpg','.jpeg','.svg','.webp','.woff','.woff2'];
    const MAX_SINGLE_FILE = 5 * 1024 * 1024;    // 5MB per file
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024;     // 50MB total
    let totalSize = 0;

    for (const [path, file] of Object.entries(zip.files)) {
        if (file.dir) continue;
        const ext = path.substring(path.lastIndexOf('.'));
        if (!ALLOWED_EXTENSIONS.includes(ext.toLowerCase())) {
            result.errors.push({
                code: 'FORBIDDEN_FILE_TYPE',
                phase: 'files',
                message: `File type "${ext}" is not allowed: ${path}`,
                file: path,
                severity: 'error',
                fixSuggestion: `Remove ${path} or convert to an allowed type`
            });
        }
        const content = await file.async('arraybuffer');
        if (content.byteLength > MAX_SINGLE_FILE) {
            result.errors.push({
                code: 'FILE_TOO_LARGE',
                phase: 'files',
                message: `File exceeds 5MB limit: ${path} (${(content.byteLength / 1024 / 1024).toFixed(1)}MB)`,
                file: path,
                severity: 'error'
            });
        }
        totalSize += content.byteLength;
    }
    if (totalSize > MAX_TOTAL_SIZE) {
        result.errors.push({
            code: 'PACKAGE_TOO_LARGE',
            phase: 'files',
            message: `Total package size exceeds 50MB limit (${(totalSize / 1024 / 1024).toFixed(1)}MB)`,
            severity: 'critical'
        });
    }

    // ===== PHASE 5: CSS Validation =====
    for (const [path, file] of Object.entries(zip.files)) {
        if (!path.endsWith('.css')) continue;
        const cssContent = await file.async('string');
        const cssResult = validateCSS(cssContent);
        result.errors.push(...cssResult.errors.map(e => ({ ...e, file: path, phase: 'css' })));
        result.warnings.push(...cssResult.warnings.map(w => ({ ...w, file: path, phase: 'css' })));
    }

    // ===== PHASE 6: JSON Schema Validation =====
    for (const [path, file] of Object.entries(zip.files)) {
        if (!path.endsWith('.json')) continue;
        try {
            JSON.parse(await file.async('string'));
        } catch (e) {
            result.errors.push({
                code: 'INVALID_JSON',
                phase: 'json',
                message: `Invalid JSON syntax in ${path}: ${e.message}`,
                file: path,
                severity: 'error'
            });
        }
    }

    // ===== PHASE 7: Screenshot Validation =====
    const requiredScreenshots = ['preview/desktop.png', 'preview/thumbnail.png'];
    for (const screenshot of requiredScreenshots) {
        if (!zip.files[screenshot]) {
            result.warnings.push({
                code: 'MISSING_SCREENSHOT',
                phase: 'screenshots',
                message: `Missing recommended screenshot: ${screenshot}`,
                file: screenshot
            });
        }
    }

    // ===== PHASE 8: Section Compatibility =====
    if (manifest.sections?.supported) {
        const validSections = [
            'hero', 'product_grid', 'featured_products', 'testimonials',
            'newsletter', 'about', 'cta', 'banner_carousel', 'marquee',
            'portfolio_grid', 'services_grid', 'skills_section',
            'experience_timeline', 'contact_form'
        ];
        for (const section of manifest.sections.supported) {
            if (!validSections.includes(section)) {
                result.warnings.push({
                    code: 'UNKNOWN_SECTION',
                    phase: 'sections',
                    message: `Unknown section type: "${section}" — will be ignored`,
                    file: 'theme.json'
                });
            }
        }
    }

    // ===== PHASE 9: Security Scan =====
    for (const [path, file] of Object.entries(zip.files)) {
        if (!path.endsWith('.js') && !path.endsWith('.css')) continue;
        const content = await file.async('string');

        const SECURITY_PATTERNS = [
            { pattern: /eval\s*\(/g, code: 'SEC_EVAL', message: 'Use of eval() is forbidden' },
            { pattern: /document\.write/g, code: 'SEC_DOC_WRITE', message: 'document.write() is forbidden' },
            { pattern: /innerHTML\s*=/g, code: 'SEC_INNERHTML', message: 'Direct innerHTML assignment — use textContent or sanitize' },
            { pattern: /fetch\s*\(/g, code: 'SEC_FETCH', message: 'External network requests detected — review required' },
            { pattern: /XMLHttpRequest/g, code: 'SEC_XHR', message: 'XMLHttpRequest detected — review required' },
            { pattern: /localStorage|sessionStorage/g, code: 'SEC_STORAGE', message: 'Web storage access detected' },
        ];

        for (const { pattern, code, message } of SECURITY_PATTERNS) {
            const matches = content.match(pattern);
            if (matches) {
                result.warnings.push({
                    code, phase: 'security', message: `${message} (${matches.length} occurrence(s))`, file: path
                });
            }
        }
    }

    return finalize(result);
}
```

### 7.5 Validation Report UI — Complete Error Display

```
┌──────────────────────────────────────────────────────────────────┐
│  Theme Upload — Validation Report                                │
│  Theme: "My Custom Theme" v1.0.0                                │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Overall Status: ❌ FAILED — 3 errors must be fixed       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ── Phase 1: ZIP Integrity ──────────────── ✅ PASSED ────────  │
│                                                                  │
│  ── Phase 2: Structure Check ─────────────── ✅ PASSED ───────  │
│     ✅ theme.json found                                         │
│     ✅ config/ directory found                                  │
│     ✅ assets/ directory found                                  │
│                                                                  │
│  ── Phase 3: Manifest Validation ─────────── ❌ FAILED ───────  │
│                                                                  │
│     ❌ MANIFEST_MISSING_FIELD                                   │
│        theme.json missing required field: "config"               │
│        📄 File: theme.json                                      │
│        💡 Fix: Add "config" object with colors, fonts, layout   │
│                                                                  │
│  ── Phase 4: File Validation ─────────────── ❌ FAILED ───────  │
│                                                                  │
│     ❌ FORBIDDEN_FILE_TYPE                                      │
│        File type ".exe" is not allowed: assets/script.exe        │
│        📄 File: assets/script.exe                               │
│        💡 Fix: Remove assets/script.exe from the package        │
│                                                                  │
│     ❌ FILE_TOO_LARGE                                           │
│        File exceeds 5MB: assets/background.png (8.2MB)          │
│        📄 File: assets/background.png                           │
│        💡 Fix: Compress or resize the image to under 5MB        │
│                                                                  │
│  ── Phase 5: CSS Validation ──────────────── ⚠️ WARNINGS ─────  │
│                                                                  │
│     ⚠️  CSS_PERF_001 (Line 42, Col 20)                          │
│        Using !important may cause specificity conflicts          │
│        📄 File: assets/theme.css                                │
│        💡 Use a more specific selector instead                  │
│                                                                  │
│  ── Phase 6: JSON Validation ─────────────── ✅ PASSED ───────  │
│  ── Phase 7: Screenshots ────────────────── ⚠️ WARNING ───────  │
│     ⚠️  Missing: preview/mobile.png (recommended)               │
│  ── Phase 8: Section Compatibility ──────── ✅ PASSED ────────  │
│  ── Phase 9: Security Scan ──────────────── ✅ PASSED ────────  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Summary                                                   │   │
│  │ Errors: 3 | Warnings: 2 | Info: 0                       │   │
│  │ Files: 12 | Total Size: 3.8MB                            │   │
│  │ Sections: 6 supported                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  [Fix Issues & Re-upload]                    [Cancel Upload]    │
└──────────────────────────────────────────────────────────────────┘
```

### 7.6 Theme Upload API

```
POST   /api/themes/upload
       Content-Type: multipart/form-data
       Body: { file: .zip, store_id }
       Returns: { validation_result, theme_id (if valid) }

POST   /api/themes/upload/validate-only
       Content-Type: multipart/form-data
       Body: { file: .zip }
       Returns: { validation_result }
       Note: Does not install — preview validation only

POST   /api/themes/install
       Body: { theme_id, store_id, activate: boolean }
       Returns: { store_theme_id, is_active }

POST   /api/themes/duplicate
       Body: { theme_id, store_id, new_name }
       Returns: { new_theme_id, new_slug }

GET    /api/themes/export?theme_id={id}&store_id={id}
       Returns: .zip file download (theme package with overrides)

DELETE /api/themes/uninstall
       Body: { store_theme_id }
       Returns: { success: true }
```

---

*End of Part 2 — Continued in Part 3*

---

# PART 3 — Theme Marketplace, Installation, Publishing & Preview

---

## 8. Theme Marketplace — `themes.letbuyy.store`

### 8.1 Marketplace Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Theme Marketplace Architecture                     │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    themes.letbuyy.store                         │ │
│  │                   (Next.js App Router)                          │ │
│  │                                                                │ │
│  │  ┌──────────────────┐  ┌──────────────────────────────────┐  │ │
│  │  │ Public Pages     │  │ Authenticated Pages               │  │ │
│  │  │                  │  │ (requires lb_session)             │  │ │
│  │  │ /               │  │                                    │  │ │
│  │  │ /themes          │  │ /dashboard                        │  │ │
│  │  │ /themes/[slug]   │  │ /my-themes                        │  │ │
│  │  │ /categories      │  │ /install/[id]                     │  │ │
│  │  │ /developers      │  │ /submit                           │  │ │
│  │  │ /docs            │  │ /developer/themes                 │  │ │
│  │  │                  │  │ /developer/analytics              │  │ │
│  │  └──────────────────┘  └──────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                      │
│                              ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                     Supabase Backend                            │ │
│  │                                                                │ │
│  │  themes table            │  theme_marketplace (new)            │ │
│  │  ├── All theme configs   │  ├── listing_status                 │ │
│  │  ├── is_marketplace      │  ├── price (free/paid)              │ │
│  │  └── screenshots         │  ├── download_count                 │ │
│  │                          │  ├── rating                         │ │
│  │  store_themes table      │  ├── reviews                        │ │
│  │  ├── Installations       │  ├── developer_id                   │ │
│  │  └── Customizations      │  └── featured                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

### 8.2 Marketplace Database — `theme_marketplace` Table

```sql
-- New table for marketplace-specific data
CREATE TABLE IF NOT EXISTS theme_marketplace (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    developer_id    UUID NOT NULL REFERENCES users_custom(id),

    -- Listing
    listing_status  TEXT DEFAULT 'draft'
                    CHECK (listing_status IN ('draft', 'pending_review', 'approved', 'rejected', 'published', 'suspended')),
    price           DECIMAL(10,2) DEFAULT 0.00,
    currency        TEXT DEFAULT 'INR',
    is_free         BOOLEAN DEFAULT true,

    -- Metrics
    install_count   INTEGER DEFAULT 0,
    active_installs INTEGER DEFAULT 0,
    view_count      INTEGER DEFAULT 0,
    rating_avg      DECIMAL(3,2) DEFAULT 0.00,
    rating_count    INTEGER DEFAULT 0,

    -- Display
    featured        BOOLEAN DEFAULT false,
    featured_at     TIMESTAMPTZ,
    badge           TEXT CHECK (badge IN (NULL, 'staff_pick', 'trending', 'new', 'popular')),
    sort_priority   INTEGER DEFAULT 0,

    -- Submission
    submitted_at    TIMESTAMPTZ,
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     UUID REFERENCES users_custom(id),
    rejection_reason TEXT,
    review_notes    TEXT,

    -- Metadata
    changelog       TEXT,
    support_url     TEXT,
    documentation_url TEXT,
    demo_url        TEXT,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(theme_id)
);

-- Marketplace reviews
CREATE TABLE IF NOT EXISTS theme_reviews (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    theme_id        UUID NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users_custom(id),
    store_id        UUID REFERENCES sites(id),
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title           TEXT,
    body            TEXT,
    is_verified     BOOLEAN DEFAULT false,   -- Has installed & used theme
    is_featured     BOOLEAN DEFAULT false,
    helpful_count   INTEGER DEFAULT 0,
    response        TEXT,                    -- Developer response
    response_at     TIMESTAMPTZ,
    status          TEXT DEFAULT 'published'
                    CHECK (status IN ('published', 'hidden', 'flagged')),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(theme_id, user_id)
);

-- RLS Policies
ALTER TABLE theme_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published themes are viewable by everyone"
    ON theme_marketplace FOR SELECT
    USING (listing_status = 'published');

CREATE POLICY "Developers can manage own themes"
    ON theme_marketplace FOR ALL
    USING (developer_id = (
        SELECT id FROM users_custom WHERE supabase_uid = auth.uid()
    ));

CREATE POLICY "Users can create reviews"
    ON theme_reviews FOR INSERT
    WITH CHECK (user_id = (
        SELECT id FROM users_custom WHERE supabase_uid = auth.uid()
    ));

CREATE POLICY "Users can edit own reviews"
    ON theme_reviews FOR UPDATE
    USING (user_id = (
        SELECT id FROM users_custom WHERE supabase_uid = auth.uid()
    ));
```

### 8.3 Marketplace Homepage — UI Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  themes.letbuyy.store                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ 🎨 LetBuyy │ Themes │ Categories │ Developers │   [Sign In] │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │              Make Your Store Beautiful                        │  │
│  │    Browse professionally designed themes for your store.     │  │
│  │                                                              │  │
│  │    [🔍 Search themes...                            ]        │  │
│  │                                                              │  │
│  │    Popular: Modern  Minimal  Dark  Luxury  Fresh            │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ── ⭐ Staff Picks ────────────────────────────────────────────── │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │            │
│  │ │          │ │  │ │          │ │  │ │          │ │            │
│  │ │ Preview  │ │  │ │ Preview  │ │  │ │ Preview  │ │            │
│  │ │ Image    │ │  │ │ Image    │ │  │ │ Image    │ │            │
│  │ │          │ │  │ │          │ │  │ │          │ │            │
│  │ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │            │
│  │              │  │              │  │              │            │
│  │  Minimal     │  │  Tech Elite  │  │  Ocean       │            │
│  │  Modern      │  │              │  │  Breeze      │            │
│  │              │  │  ★★★★★ (24) │  │              │            │
│  │  ★★★★★ (48) │  │  Free        │  │  ★★★★☆ (12) │            │
│  │  Free        │  │              │  │  ₹499        │            │
│  │              │  │  [Preview]   │  │              │            │
│  │  [Preview]   │  │  [Install]   │  │  [Preview]   │            │
│  │  [Install]   │  │              │  │  [Buy]       │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ── 🔥 Trending ─────────────────────────────────────────────── │
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ ...          │  │ ...          │  │ ...          │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                     │
│  ── Categories ───────────────────────────────────────────────── │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ 🛒 Store    │ │ 💼 Portfolio│ │ 📝 Blog     │ │ 🎯 Landing│  │
│  │ (32 themes) │ │ (18 themes) │ │ (12 themes) │ │ (8 themes)│  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘  │
│                                                                     │
│  ── For Developers ─────────────────────────────────────────── │  │
│  ┌──────────────────────────────────────────────────────────┐   │  │
│  │ Build and sell themes on LetBuyy                          │   │  │
│  │                                                          │   │  │
│  │ • Earn 80% revenue share on paid themes                  │   │  │
│  │ • Access the theme SDK and documentation                 │   │  │
│  │ • Reach thousands of store owners                        │   │  │
│  │                                                          │   │  │
│  │ [Become a Developer →]         [Read the Docs →]        │   │  │
│  └──────────────────────────────────────────────────────────┘   │  │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.4 Theme Detail Page — UI Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  themes.letbuyy.store/themes/minimal-modern                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ← Back to Themes                                   [Sign In]      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                                                              │  │
│  │  ┌────────────────────────────────────────────────────────┐ │  │
│  │  │                                                        │ │  │
│  │  │                                                        │ │  │
│  │  │              Theme Preview — Desktop                   │ │  │
│  │  │              (1440 x 900 screenshot)                   │ │  │
│  │  │                                                        │ │  │
│  │  │                                                        │ │  │
│  │  └────────────────────────────────────────────────────────┘ │  │
│  │                                                              │  │
│  │  🖥 Desktop  │  📱 Mobile  │  🎨 Color Presets               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────┐  ┌───────────────────────┐    │
│  │                                │  │                       │    │
│  │  Minimal Modern                │  │  Price: Free          │    │
│  │  by LetBuyy Team               │  │                       │    │
│  │                                │  │  ★★★★★ 4.8 (48)      │    │
│  │  A clean, modern theme with    │  │                       │    │
│  │  minimal design, perfect for   │  │  📦 1,240 installs   │    │
│  │  stores that let products      │  │  📅 Updated 2 days   │    │
│  │  speak for themselves.         │  │      ago              │    │
│  │                                │  │  📐 v2.1.0           │    │
│  │  Features:                     │  │                       │    │
│  │  ✓ Dark mode support           │  │  [▶ Live Preview]    │    │
│  │  ✓ Custom fonts                │  │                       │    │
│  │  ✓ 10 color presets            │  │  [📥 Install Theme]  │    │
│  │  ✓ Responsive design           │  │                       │    │
│  │  ✓ Custom CSS support          │  │  Select store:       │    │
│  │  ✓ 9 section types             │  │  [My Store    ▼]     │    │
│  │                                │  │                       │    │
│  │  Sections:                     │  │  ──────────────────   │    │
│  │  Hero, Product Grid, Featured, │  │                       │    │
│  │  Testimonials, Newsletter,     │  │  Support:             │    │
│  │  About, CTA, Banner, Marquee   │  │  📧 support@lb.store │    │
│  │                                │  │  📖 Documentation    │    │
│  │  Category: Modern              │  │  🐛 Report Issue     │    │
│  │  Tags: clean, minimal          │  │                       │    │
│  └────────────────────────────────┘  └───────────────────────┘    │
│                                                                     │
│  ── Reviews ─────────────────────────────────────────────────── │  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐   │  │
│  │  ★★★★★  "Perfect for my clothing store"                  │   │  │
│  │  by @sarah_boutique  │  ✓ Verified Install  │  2 days ago │   │  │
│  │                                                          │   │  │
│  │  Clean design that lets my products shine. The dark mode │   │  │
│  │  is gorgeous and customers love the fast loading times.  │   │  │
│  │                                                          │   │  │
│  │  👍 Helpful (12)                                         │   │  │
│  │                                                          │   │  │
│  │  ▸ Developer Response (LetBuyy Team):                    │   │  │
│  │    Thank you Sarah! We're glad you love it. 🎉          │   │  │
│  └──────────────────────────────────────────────────────────┘   │  │
│                                                                     │
│  [Load More Reviews]                         [Write a Review]      │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.5 Marketplace API Endpoints

```
# ===== Public (no auth) =====
GET    /api/marketplace/themes
       Query: ?category=modern&sort=popular&page=1&limit=12&site_type=store
       Returns: { themes: ThemeListing[], total, page, pages }

GET    /api/marketplace/themes/[slug]
       Returns: { theme: ThemeListing, reviews: Review[], related: ThemeListing[] }

GET    /api/marketplace/categories
       Returns: { categories: [{ name, count, icon }] }

GET    /api/marketplace/featured
       Returns: { staff_picks: ThemeListing[], trending: ThemeListing[], new: ThemeListing[] }

GET    /api/marketplace/search?q={query}
       Returns: { results: ThemeListing[], total }

# ===== Authenticated (requires lb_session) =====
POST   /api/marketplace/install
       Body: { theme_id, store_id }
       Returns: { store_theme_id, success }

POST   /api/marketplace/reviews
       Body: { theme_id, rating, title, body }
       Returns: { review_id }

# ===== Developer (requires developer role) =====
POST   /api/marketplace/submit
       Content-Type: multipart/form-data
       Body: { file: .zip, price?, description, demo_url? }
       Returns: { listing_id, status: 'pending_review' }

GET    /api/marketplace/developer/themes
       Returns: { themes: DeveloperThemeListing[] }

GET    /api/marketplace/developer/analytics
       Returns: { total_installs, active_installs, revenue, views, ratings }

# ===== Admin Review (requires admin role) =====
PATCH  /api/marketplace/admin/review
       Body: { listing_id, action: 'approve' | 'reject', reason? }
       Returns: { success, new_status }
```

---

## 9. Theme Installation & Activation

### 9.1 Installation Flow — Complete

```
┌────────────────────────────────────────────────────────────────────────┐
│                    Theme Installation Flow                              │
│                                                                        │
│  Source: Marketplace OR Upload                                         │
│                                                                        │
│  ┌─────────────────────┐                                               │
│  │ 1. Select Theme     │                                               │
│  │    & Target Store   │                                               │
│  └────────┬────────────┘                                               │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────────┐      ┌──────────────────────────────────┐   │
│  │ 2. Validate         │──NO─►│ Show validation errors            │   │
│  │    Compatibility    │      │ [Fix & Retry] [Cancel]           │   │
│  └────────┬────────────┘      └──────────────────────────────────┘   │
│           │ YES                                                       │
│           ▼                                                            │
│  ┌─────────────────────┐                                               │
│  │ 3. Create           │                                               │
│  │    store_themes     │  ← INSERT with is_active = false             │
│  │    record           │  ← Copy theme defaults → overrides = {}     │
│  └────────┬────────────┘                                               │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────────┐                                               │
│  │ 4. Copy theme files │                                               │
│  │    to store scope   │  ← theme_files records with store_id         │
│  └────────┬────────────┘                                               │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────────┐                                               │
│  │ 5. Initialize       │                                               │
│  │    custom CSS       │  ← theme_custom_css record (empty)           │
│  └────────┬────────────┘                                               │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────────┐                                               │
│  │ 6. Activate?        │                                               │
│  │                     │                                               │
│  │ ○ Activate now      │  ← SET is_active = true, deactivate others  │
│  │ ○ Keep as draft     │  ← Keep is_active = false                   │
│  └────────┬────────────┘                                               │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────────┐                                               │
│  │ 7. Done!            │                                               │
│  │ [Customize Theme]   │  → admin.letbuyy.store/settings/themes      │
│  │ [Preview Store]     │  → {store}.letbuyy.store?preview=true       │
│  └─────────────────────┘                                               │
└────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Installation Server Action

```typescript
// app/api/themes/install/route.ts

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { theme_id, store_id, activate = false } = await req.json();

    // 1. Verify ownership
    const { data: store } = await supabase
        .from('sites')
        .select('id, owner_id')
        .eq('id', store_id)
        .eq('owner_id', session.userId)
        .single();

    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // 2. Check if already installed
    const { data: existing } = await supabase
        .from('store_themes')
        .select('id')
        .eq('store_id', store_id)
        .eq('theme_id', theme_id)
        .single();

    if (existing) {
        return NextResponse.json({ error: 'Theme already installed' }, { status: 409 });
    }

    // 3. Get theme data
    const { data: theme } = await supabase
        .from('themes')
        .select('*')
        .eq('id', theme_id)
        .single();

    if (!theme) return NextResponse.json({ error: 'Theme not found' }, { status: 404 });

    // 4. If activating, deactivate current theme
    if (activate) {
        await supabase
            .from('store_themes')
            .update({ is_active: false })
            .eq('store_id', store_id)
            .eq('is_active', true);
    }

    // 5. Create store_themes record
    const { data: storeTheme, error } = await supabase
        .from('store_themes')
        .insert({
            store_id,
            theme_id,
            is_active: activate,
            overrides: {},
            installed_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 6. Copy theme files to store scope
    const { data: themeFiles } = await supabase
        .from('theme_files')
        .select('*')
        .eq('theme_id', theme_id)
        .is('store_id', null);  // Template files (no store_id)

    if (themeFiles?.length) {
        const storeFiles = themeFiles.map(f => ({
            theme_id,
            store_id,
            file_path: f.file_path,
            file_type: f.file_type,
            content: f.content,
            file_url: f.file_url,
            file_size: f.file_size,
            version: 1
        }));
        await supabase.from('theme_files').insert(storeFiles);
    }

    // 7. Initialize custom CSS
    await supabase.from('theme_custom_css').upsert({
        store_id,
        theme_id,
        global_css: '',
        section_css: {}
    });

    // 8. Increment install count
    await supabase.rpc('increment_install_count', { p_theme_id: theme_id });

    return NextResponse.json({
        store_theme_id: storeTheme.id,
        is_active: activate,
        success: true
    });
}
```

### 9.3 Theme Switching — Activation Logic

```typescript
// Switch active theme for a store
async function activateTheme(storeId: string, storeThemeId: string) {
    // Deactivate all themes for this store
    await supabase
        .from('store_themes')
        .update({ is_active: false })
        .eq('store_id', storeId);

    // Activate the selected theme
    await supabase
        .from('store_themes')
        .update({
            is_active: true,
            activated_at: new Date().toISOString()
        })
        .eq('id', storeThemeId);

    // Update the store's active theme reference
    const { data: storeTheme } = await supabase
        .from('store_themes')
        .select('theme_id')
        .eq('id', storeThemeId)
        .single();

    // Invalidate CDN cache for the store
    await invalidateStoreCache(storeId);

    return { success: true, theme_id: storeTheme?.theme_id };
}
```

---

## 10. Theme Preview System

### 10.1 Preview Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Theme Preview Architecture                        │
│                                                                      │
│  Admin Theme Customizer                                              │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                                                                │ │
│  │  ┌──────────────┐  ┌──────────────────────────────────────┐  │ │
│  │  │ Settings     │  │ Preview iframe                        │  │ │
│  │  │ Panel        │  │                                      │  │ │
│  │  │              │  │ src="{store}.letbuyy.store            │  │ │
│  │  │ ┌──────────┐ │  │      ?preview=true                   │  │ │
│  │  │ │ Colors   │ │  │      &theme_id={id}                  │  │ │
│  │  │ │ Fonts    │ │  │      &token={preview_token}"         │  │ │
│  │  │ │ Layout   │ │  │                                      │  │ │
│  │  │ │ Sections │ │  │  ┌──────────────────────────────┐   │  │ │
│  │  │ │ CSS      │ │  │  │ Store renders with:          │   │  │ │
│  │  │ └──────────┘ │  │  │ • Preview theme (not active) │   │  │ │
│  │  │              │  │  │ • Unsaved settings            │   │  │ │
│  │  │ Changes are  │  │  │ • Custom CSS overlay         │   │  │ │
│  │  │ sent via     │──┤  │ • Section reordering         │   │  │ │
│  │  │ postMessage  │  │  └──────────────────────────────┘   │  │ │
│  │  │              │  │                                      │  │ │
│  │  │ [Save Draft] │  │  Preview Bar:                        │  │ │
│  │  │ [Publish]    │  │  ┌──────────────────────────────┐   │  │ │
│  │  └──────────────┘  │  │ ⚠ Preview Mode │ 🖥 📱 │ Exit │   │  │ │
│  │                    │  └──────────────────────────────┘   │  │ │
│  │                    └──────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Preview Token:                                                      │
│  • Short-lived JWT (15 min expiry)                                  │
│  • Contains: store_id, theme_id, user_id                            │
│  • Validated server-side on every request                           │
│  • Prevents unauthorized preview access                              │
└──────────────────────────────────────────────────────────────────────┘
```

### 10.2 Preview Token Generation

```typescript
// lib/themes/preview-token.ts
import { SignJWT, jwtVerify } from 'jose';

const PREVIEW_SECRET = new TextEncoder().encode(process.env.PREVIEW_SECRET!);

export async function generatePreviewToken(
    storeId: string, themeId: string, userId: string
): Promise<string> {
    return new SignJWT({ storeId, themeId, userId, type: 'theme_preview' })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime('15m')
        .setIssuedAt()
        .sign(PREVIEW_SECRET);
}

export async function verifyPreviewToken(token: string): Promise<{
    storeId: string; themeId: string; userId: string;
} | null> {
    try {
        const { payload } = await jwtVerify(token, PREVIEW_SECRET);
        if (payload.type !== 'theme_preview') return null;
        return {
            storeId: payload.storeId as string,
            themeId: payload.themeId as string,
            userId: payload.userId as string
        };
    } catch {
        return null;
    }
}
```

### 10.3 Preview Mode — Storefront Detection

```typescript
// In storefront middleware or page component:

async function getThemeForRequest(req: NextRequest, store: Store) {
    const url = new URL(req.url);
    const isPreview = url.searchParams.get('preview') === 'true';
    const previewThemeId = url.searchParams.get('theme_id');
    const previewToken = url.searchParams.get('token');

    if (isPreview && previewThemeId && previewToken) {
        // Verify preview token
        const tokenData = await verifyPreviewToken(previewToken);
        if (!tokenData || tokenData.storeId !== store.id) {
            // Invalid token — fall back to active theme
            return getActiveTheme(store.id);
        }

        // Load preview theme (may not be active or even installed)
        const { data: theme } = await supabase
            .from('themes')
            .select('*')
            .eq('id', previewThemeId)
            .single();

        // Load preview overrides (unsaved changes sent via postMessage)
        const previewOverrides = url.searchParams.get('overrides');
        const overrides = previewOverrides ? JSON.parse(atob(previewOverrides)) : {};

        return {
            theme,
            overrides,
            isPreview: true,
            previewBanner: true  // Show "Preview Mode" banner
        };
    }

    // Normal request — return active theme
    return getActiveTheme(store.id);
}
```

### 10.4 Preview Toolbar Component

```typescript
// components/PreviewToolbar.tsx
// Shown at top of storefront in preview mode

export function PreviewToolbar({ themeName }: { themeName: string }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            color: 'white', padding: '8px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            fontSize: '13px', fontFamily: 'Inter, sans-serif',
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px',
                    borderRadius: 4, fontSize: 11 }}>PREVIEW</span>
                <span>Previewing: {themeName}</span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => window.parent.postMessage({ type: 'LB_PREVIEW_DEVICE', device: 'desktop' }, '*')}>
                    🖥
                </button>
                <button onClick={() => window.parent.postMessage({ type: 'LB_PREVIEW_DEVICE', device: 'tablet' }, '*')}>
                    📱
                </button>
                <button onClick={() => window.parent.postMessage({ type: 'LB_PREVIEW_DEVICE', device: 'mobile' }, '*')}>
                    📱
                </button>
                <button onClick={() => window.parent.postMessage({ type: 'LB_PREVIEW_EXIT' }, '*')}
                    style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white',
                        padding: '4px 12px', borderRadius: 4, cursor: 'pointer' }}>
                    Exit Preview
                </button>
            </div>
        </div>
    );
}
```

---

## 11. Theme Duplication, Export & Deletion

### 11.1 Theme Duplication Logic

```typescript
// Duplicate an installed theme (creates a full copy)
async function duplicateTheme(
    themeId: string, storeId: string, newName: string
): Promise<{ newThemeId: string; newSlug: string }> {
    // 1. Get original theme
    const { data: original } = await supabase
        .from('themes')
        .select('*')
        .eq('id', themeId)
        .single();

    // 2. Create new theme record
    const newSlug = `${original.slug}-copy-${Date.now()}`;
    const { data: newTheme } = await supabase
        .from('themes')
        .insert({
            ...original,
            id: undefined,  // Auto-generate
            name: newName || `${original.name} (Copy)`,
            slug: newSlug,
            is_marketplace: false,
            is_default: false,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    // 3. Copy store_themes record
    const { data: storeTheme } = await supabase
        .from('store_themes')
        .select('*')
        .eq('store_id', storeId)
        .eq('theme_id', themeId)
        .single();

    if (storeTheme) {
        await supabase.from('store_themes').insert({
            store_id: storeId,
            theme_id: newTheme.id,
            is_active: false,
            overrides: storeTheme.overrides || {}
        });
    }

    // 4. Copy theme files
    const { data: files } = await supabase
        .from('theme_files')
        .select('*')
        .eq('theme_id', themeId)
        .eq('store_id', storeId);

    if (files?.length) {
        const copiedFiles = files.map(f => ({
            ...f,
            id: undefined,
            theme_id: newTheme.id,
            version: 1,
            previous_content: null,
            created_at: new Date().toISOString()
        }));
        await supabase.from('theme_files').insert(copiedFiles);
    }

    // 5. Copy custom CSS
    const { data: customCSS } = await supabase
        .from('theme_custom_css')
        .select('*')
        .eq('store_id', storeId)
        .eq('theme_id', themeId)
        .single();

    if (customCSS) {
        await supabase.from('theme_custom_css').insert({
            store_id: storeId,
            theme_id: newTheme.id,
            global_css: customCSS.global_css,
            section_css: customCSS.section_css
        });
    }

    return { newThemeId: newTheme.id, newSlug };
}
```

### 11.2 Theme Export — ZIP Generation

```typescript
// Export a theme as a downloadable .zip package
import JSZip from 'jszip';

async function exportTheme(themeId: string, storeId: string): Promise<Buffer> {
    const zip = new JSZip();

    // 1. Get theme data
    const { data: theme } = await supabase
        .from('themes').select('*').eq('id', themeId).single();

    const { data: storeTheme } = await supabase
        .from('store_themes').select('*')
        .eq('store_id', storeId).eq('theme_id', themeId).single();

    // 2. Generate theme.json manifest
    zip.file('theme.json', JSON.stringify({
        name: theme.name,
        slug: theme.slug,
        version: theme.version || '1.0.0',
        description: theme.description,
        config: {
            colors: theme.default_colors,
            fonts: theme.default_fonts,
            layout: theme.default_layout
        },
        presets: theme.presets,
        sections: { supported: theme.supported_sections }
    }, null, 2));

    // 3. Export store customizations
    if (storeTheme?.overrides) {
        zip.file('config/overrides.json', JSON.stringify(storeTheme.overrides, null, 2));
    }

    // 4. Export theme files
    const { data: files } = await supabase
        .from('theme_files').select('*')
        .eq('theme_id', themeId).eq('store_id', storeId);

    for (const file of files || []) {
        if (file.content) {
            zip.file(file.file_path, file.content);
        }
        // Binary files would need to be fetched from CDN URL
    }

    // 5. Export custom CSS
    const { data: customCSS } = await supabase
        .from('theme_custom_css').select('*')
        .eq('store_id', storeId).eq('theme_id', themeId).single();

    if (customCSS) {
        zip.file('assets/custom.css', customCSS.global_css || '');
        if (customCSS.section_css && Object.keys(customCSS.section_css).length) {
            zip.file('config/section-css.json', JSON.stringify(customCSS.section_css, null, 2));
        }
    }

    return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
```

### 11.3 Theme Deletion & Uninstallation

```typescript
// Uninstall theme from a store
async function uninstallTheme(storeThemeId: string, storeId: string): Promise<void> {
    // 1. Check if this is the active theme
    const { data: storeTheme } = await supabase
        .from('store_themes').select('*').eq('id', storeThemeId).single();

    if (storeTheme.is_active) {
        throw new Error('Cannot uninstall the active theme. Switch to another theme first.');
    }

    // 2. Delete store-specific theme files
    await supabase.from('theme_files')
        .delete()
        .eq('theme_id', storeTheme.theme_id)
        .eq('store_id', storeId);

    // 3. Delete store-specific custom CSS
    await supabase.from('theme_custom_css')
        .delete()
        .eq('theme_id', storeTheme.theme_id)
        .eq('store_id', storeId);

    // 4. Delete store_themes record
    await supabase.from('store_themes').delete().eq('id', storeThemeId);

    // 5. Decrement install count
    await supabase.rpc('decrement_install_count', { p_theme_id: storeTheme.theme_id });
}
```

---

## 12. Theme Publishing — Developer Submission Pipeline

### 12.1 Submission Flow

```
┌────────────────────────────────────────────────────────────────────────┐
│                  Theme Developer Submission Pipeline                    │
│                                                                        │
│  Developer                     LetBuyy Review Team                    │
│                                                                        │
│  ┌─────────────────┐                                                  │
│  │ 1. Build Theme  │                                                  │
│  │    Package      │                                                  │
│  │    (.zip)       │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────┐                                                  │
│  │ 2. Submit Theme │                                                  │
│  │    for Review   │                                                  │
│  │                 │                                                  │
│  │  ┌───────────┐  │                                                  │
│  │  │ Upload ZIP│  │                                                  │
│  │  │ Set Price │  │                                                  │
│  │  │ Add Demo  │  │                                                  │
│  │  │ Write Desc│  │                                                  │
│  │  └───────────┘  │                                                  │
│  └────────┬────────┘                                                  │
│           │                                                            │
│           ▼                                                            │
│  ┌─────────────────┐     ┌──────────────────────────────────────┐    │
│  │ 3. Auto-Validate│────►│ 4. Manual Review                      │    │
│  │    (9 phases)   │     │                                      │    │
│  │                 │     │  □ Design quality check              │    │
│  │  ✅ All pass    │     │  □ Responsiveness (mobile/tablet)    │    │
│  │                 │     │  □ Performance audit                  │    │
│  └─────────────────┘     │  □ Accessibility basics              │    │
│                          │  □ Brand guideline compliance         │    │
│                          │  □ Code quality review               │    │
│                          └────────┬─────────────────────────────┘    │
│                                   │                                    │
│                          ┌────────┴────────┐                          │
│                          │                  │                          │
│                          ▼                  ▼                          │
│                  ┌──────────────┐  ┌──────────────┐                  │
│                  │ ✅ Approved  │  │ ❌ Rejected  │                  │
│                  │              │  │              │                  │
│                  │ → Published  │  │ → Feedback   │                  │
│                  │   to store   │  │   sent to    │                  │
│                  │              │  │   developer  │                  │
│                  └──────────────┘  └──────────────┘                  │
│                          │                  │                          │
│                          ▼                  ▼                          │
│                  ┌──────────────┐  ┌──────────────┐                  │
│                  │ 5. Live on   │  │ 6. Fix &     │                  │
│                  │ Marketplace  │  │    Resubmit  │──┐              │
│                  │              │  │              │  │              │
│                  │ Installs     │  └──────────────┘  │              │
│                  │ Reviews      │         ▲          │              │
│                  │ Analytics    │         └──────────┘              │
│                  └──────────────┘                                     │
└────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Developer Dashboard — UI Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  themes.letbuyy.store/developer/themes                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ← Dashboard           Developer Portal           [Submit Theme]   │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ My Themes                                                     │  │
│  │                                                              │  │
│  │ ┌────────────────────────────────────────────────────────┐   │  │
│  │ │                                                        │   │  │
│  │ │  Elegant Store                    Status: Published    │   │  │
│  │ │  v2.1.0 │ Submitted: Jan 15                           │   │  │
│  │ │                                                        │   │  │
│  │ │  📦 1,240 installs   ⭐ 4.8 (48 reviews)              │   │  │
│  │ │  💰 ₹12,400 earned   👀 5,600 views                   │   │  │
│  │ │                                                        │   │  │
│  │ │  [View Analytics]  [Edit Listing]  [Update Theme]     │   │  │
│  │ └────────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │ ┌────────────────────────────────────────────────────────┐   │  │
│  │ │                                                        │   │  │
│  │ │  Dark Portfolio                   Status: Pending Review│   │  │
│  │ │  v1.0.0 │ Submitted: Feb 10                           │   │  │
│  │ │                                                        │   │  │
│  │ │  ⏳ Estimated review: 2-3 business days               │   │  │
│  │ │                                                        │   │  │
│  │ │  [View Submission]  [Withdraw]                        │   │  │
│  │ └────────────────────────────────────────────────────────┘   │  │
│  │                                                              │  │
│  │ ┌────────────────────────────────────────────────────────┐   │  │
│  │ │                                                        │   │  │
│  │ │  Neon Landing                     Status: Rejected     │   │  │
│  │ │  v1.0.0 │ Submitted: Feb 5                            │   │  │
│  │ │                                                        │   │  │
│  │ │  ❌ Rejection Reason:                                  │   │  │
│  │ │  "Mobile responsiveness needs improvement on product   │   │  │
│  │ │   grid section. Images overflow on iPhone SE."         │   │  │
│  │ │                                                        │   │  │
│  │ │  [Fix & Resubmit]  [View Full Feedback]              │   │  │
│  │ └────────────────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  Revenue Summary:                                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ Total Earned: ₹12,400  │  This Month: ₹2,800               │  │
│  │ Pending Payout: ₹1,400  │  Next Payout: Feb 28             │  │
│  │ Revenue Share: 80%      │  Platform Fee: 20%               │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### 12.3 Theme Version Update Flow

```typescript
// Developer submits a theme update
async function submitThemeUpdate(
    themeId: string, developerId: string, zipBuffer: Buffer, changelog: string
): Promise<{ success: boolean; version: string }> {
    // 1. Validate the developer owns this theme
    const { data: listing } = await supabase
        .from('theme_marketplace')
        .select('*')
        .eq('theme_id', themeId)
        .eq('developer_id', developerId)
        .single();

    if (!listing) throw new Error('Theme not found or unauthorized');

    // 2. Validate the new package
    const validation = await validateThemePackage(zipBuffer);
    if (!validation.valid) throw new Error('Validation failed: ' + JSON.stringify(validation.errors));

    // 3. Parse new manifest
    const zip = await JSZip.loadAsync(zipBuffer);
    const manifest = JSON.parse(await zip.file('theme.json')!.async('string'));

    // 4. Ensure version is bumped
    const currentVersion = listing.version || '1.0.0';
    if (!isVersionBumped(currentVersion, manifest.version)) {
        throw new Error(`Version must be higher than current (${currentVersion})`);
    }

    // 5. Create version snapshot of current state
    const { data: currentFiles } = await supabase
        .from('theme_files')
        .select('*')
        .eq('theme_id', themeId)
        .is('store_id', null);

    await supabase.from('theme_versions').insert({
        theme_id: themeId,
        version: currentVersion,
        changelog,
        files_snapshot: currentFiles,
        config_snapshot: listing,
        created_by: developerId
    });

    // 6. Update theme with new files
    await updateThemeFiles(themeId, zip);

    // 7. Update theme record
    await supabase.from('themes').update({
        version: manifest.version,
        name: manifest.name,
        description: manifest.description,
        default_colors: manifest.config?.colors,
        default_fonts: manifest.config?.fonts,
        updated_at: new Date().toISOString()
    }).eq('id', themeId);

    // 8. Update marketplace listing
    await supabase.from('theme_marketplace').update({
        changelog,
        listing_status: 'pending_review',  // Re-review required
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }).eq('theme_id', themeId);

    return { success: true, version: manifest.version };
}
```

---

*End of Part 3 — Continued in Part 4*

---
---

# PART 4 — SSO IMPLEMENTATION & CROSS-APP AUTHENTICATION

---

## 18. Single Sign-On (SSO) Architecture

LetBuyy uses a **cookie-based SSO system** that works across all applications deployed on `*.letbuyy.store` subdomains. A single `lb_session` cookie on the `.letbuyy.store` domain provides seamless authentication.

### 18.1 Application Landscape

| Application | URL | Purpose |
|---|---|---|
| **Accounts** | `accounts.letbuyy.store` | Signup, login, password reset, OTP verification |
| **Admin** | `admin.letbuyy.store` | Store management dashboard |
| **Themes** | `themes.letbuyy.store` | Theme marketplace, browsing, installation |
| **Storefront** | `{store}.letbuyy.store` | Customer-facing store |
| **Landing** | `letbuyy.store` | Marketing landing page |

### 18.2 The `lb_session` Cookie

```typescript
// lib/auth/session.ts

import { SignJWT, jwtVerify } from 'jose';

const SESSION_SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = 'lb_session';

interface SessionPayload {
    sub: string;          // user ID (UUID)
    email: string;
    name: string;
    role: 'owner' | 'admin' | 'staff' | 'viewer';
    store_id?: string;    // currently active store
    store_slug?: string;  // e.g., "letok"
    iat: number;
    exp: number;
}

// ─── Create Session ──────────────────────────────────────────
export async function createSession(user: {
    id: string;
    email: string;
    name: string;
    role: string;
    store_id?: string;
    store_slug?: string;
}): Promise<string> {
    const token = await new SignJWT({
        sub: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        store_id: user.store_id,
        store_slug: user.store_slug,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(SESSION_SECRET);

    return token;
}

// ─── Verify Session ──────────────────────────────────────────
export async function verifySession(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, SESSION_SECRET);
        return payload as unknown as SessionPayload;
    } catch {
        return null;
    }
}

// ─── Get Session from Request ────────────────────────────────
export async function getSession(req: Request): Promise<SessionPayload | null> {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = Object.fromEntries(
        cookieHeader.split(';').map(c => {
            const [key, ...val] = c.trim().split('=');
            return [key, val.join('=')];
        })
    );
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    return verifySession(token);
}

// ─── Set Session Cookie ──────────────────────────────────────
export function setSessionCookie(response: Response, token: string): Response {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookie = [
        `${COOKIE_NAME}=${token}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=${7 * 24 * 60 * 60}`,   // 7 days
        isProduction ? `Secure` : '',
        isProduction ? `Domain=.letbuyy.store` : '',
    ].filter(Boolean).join('; ');

    response.headers.append('Set-Cookie', cookie);
    return response;
}

// ─── Clear Session Cookie ────────────────────────────────────
export function clearSessionCookie(response: Response): Response {
    const isProduction = process.env.NODE_ENV === 'production';
    const cookie = [
        `${COOKIE_NAME}=`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Lax`,
        `Max-Age=0`,
        isProduction ? `Secure` : '',
        isProduction ? `Domain=.letbuyy.store` : '',
    ].filter(Boolean).join('; ');

    response.headers.append('Set-Cookie', cookie);
    return response;
}
```

### 18.3 Cookie Properties Explained

| Property | Value | Rationale |
|---|---|---|
| `Domain` | `.letbuyy.store` | Shared across ALL subdomains — the core of SSO |
| `HttpOnly` | `true` | Prevents JavaScript access (XSS protection) |
| `Secure` | `true` (prod) | HTTPS-only in production |
| `SameSite` | `Lax` | Allows cookie on top-level navigations (redirects) |
| `Path` | `/` | Available on all routes |
| `Max-Age` | `604800` | 7-day expiry |

> **Why `SameSite=Lax`?** Using `Strict` would prevent the cookie from being sent when users navigate between subdomains via links. `Lax` ensures the cookie accompanies top-level navigations (clicking links, redirects) but blocks cross-origin POST requests, which is the right balance for SSO.

### 18.4 Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    SSO AUTHENTICATION FLOW                      │
│                                                                 │
│  ┌──────────┐    No Cookie    ┌───────────────┐                │
│  │  User     │───────────────▶│  accounts.    │                │
│  │  visits   │                │  letbuyy.store│                │
│  │  admin.   │                │  /login       │                │
│  │  letbuyy. │                └───────┬───────┘                │
│  │  store    │                        │                         │
│  └──────────┘                         ▼                         │
│                               ┌───────────────┐                │
│                               │  User enters   │                │
│                               │  credentials   │                │
│                               └───────┬───────┘                │
│                                       │                         │
│                                       ▼                         │
│                               ┌───────────────┐                │
│                               │  Server sets   │                │
│                               │  lb_session    │──── Cookie ──▶│
│                               │  cookie on     │   Domain:     │
│                               │  .letbuyy.store│   .letbuyy    │
│                               └───────┬───────┘   .store      │
│                                       │                         │
│                                       ▼                         │
│                               ┌───────────────┐                │
│                               │  Redirect to   │                │
│                               │  admin.letbuyy │                │
│                               │  .store        │                │
│                               └───────┬───────┘                │
│                                       │                         │
│                                       ▼                         │
│  ┌──────────┐    Has Cookie   ┌───────────────┐                │
│  │  Admin    │◀───────────────│  Middleware    │                │
│  │  Dashboard│   Valid JWT    │  verifies      │                │
│  │  loads    │                │  lb_session    │                │
│  └──────────┘                └───────────────┘                │
│                                                                 │
│  ────────────────────────────────────────────────────           │
│  Same cookie works for:                                         │
│  • themes.letbuyy.store  ✓                                      │
│  • admin.letbuyy.store   ✓                                      │
│  • {store}.letbuyy.store ✓ (storefront preview)                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 19. Middleware Implementation

Each LetBuyy application uses Next.js middleware to validate the `lb_session` cookie and handle authentication routing.

### 19.1 Admin App Middleware

```typescript
// apps/web/admin/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/session';

const PUBLIC_PATHS = ['/api/health', '/favicon.ico', '/_next'];
const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Skip public paths
    if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
        return NextResponse.next();
    }

    // Get session token
    const token = req.cookies.get('lb_session')?.value;

    if (!token) {
        // No session — redirect to accounts login
        const loginUrl = new URL('/login', ACCOUNTS_URL);
        loginUrl.searchParams.set('redirect', req.url);
        return NextResponse.redirect(loginUrl);
    }

    // Verify the JWT
    const session = await verifySession(token);
    if (!session) {
        // Invalid/expired token — clear cookie and redirect
        const loginUrl = new URL('/login', ACCOUNTS_URL);
        loginUrl.searchParams.set('redirect', req.url);
        loginUrl.searchParams.set('reason', 'session_expired');
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('lb_session');
        return response;
    }

    // Check if user has a store
    if (!session.store_id && pathname !== '/onboarding') {
        return NextResponse.redirect(new URL('/onboarding', req.url));
    }

    // Attach session info to headers for server components
    const response = NextResponse.next();
    response.headers.set('x-user-id', session.sub);
    response.headers.set('x-user-email', session.email);
    response.headers.set('x-user-role', session.role);
    if (session.store_id) response.headers.set('x-store-id', session.store_id);
    if (session.store_slug) response.headers.set('x-store-slug', session.store_slug);

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### 19.2 Accounts App Middleware

```typescript
// apps/web/accounts/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/session';

const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/reset-password', '/verify'];
const ADMIN_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.store';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;
    const token = req.cookies.get('lb_session')?.value;

    // If user IS authenticated and tries to access auth pages
    if (token && AUTH_PATHS.some(p => pathname.startsWith(p))) {
        const session = await verifySession(token);
        if (session) {
            // Already logged in — redirect to admin or original destination
            const redirect = req.nextUrl.searchParams.get('redirect');
            if (redirect) {
                return NextResponse.redirect(redirect);
            }
            return NextResponse.redirect(new URL('/', ADMIN_URL));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
```

### 19.3 Themes App Middleware

```typescript
// apps/web/themes/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth/session';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store';

// Paths that require authentication
const PROTECTED_PATHS = [
    '/my-themes',
    '/install',
    '/developer',
    '/api/themes/install',
    '/api/themes/review',
];

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Public pages — no auth required for browsing
    if (!PROTECTED_PATHS.some(p => pathname.startsWith(p))) {
        // Still attach session if available (for UI personalization)
        const token = req.cookies.get('lb_session')?.value;
        if (token) {
            const session = await verifySession(token);
            if (session) {
                const response = NextResponse.next();
                response.headers.set('x-user-id', session.sub);
                response.headers.set('x-user-email', session.email);
                return response;
            }
        }
        return NextResponse.next();
    }

    // Protected pages — require auth
    const token = req.cookies.get('lb_session')?.value;
    if (!token) {
        const loginUrl = new URL('/login', ACCOUNTS_URL);
        loginUrl.searchParams.set('redirect', req.url);
        return NextResponse.redirect(loginUrl);
    }

    const session = await verifySession(token);
    if (!session) {
        const loginUrl = new URL('/login', ACCOUNTS_URL);
        loginUrl.searchParams.set('redirect', req.url);
        const response = NextResponse.redirect(loginUrl);
        response.cookies.delete('lb_session');
        return response;
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', session.sub);
    response.headers.set('x-user-email', session.email);
    response.headers.set('x-user-role', session.role);
    if (session.store_id) response.headers.set('x-store-id', session.store_id);

    return response;
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 20. Cross-App Redirect Flows

### 20.1 Login → Admin Redirect

```
User clicks "Sign In" on admin.letbuyy.store
       │
       ▼
Middleware: No lb_session cookie found
       │
       ▼
Redirect: accounts.letbuyy.store/login?redirect=https://admin.letbuyy.store/dashboard
       │
       ▼
User enters email + password
       │
       ▼
POST /api/auth/login
       │
       ├── Validate credentials against Supabase
       ├── Create lb_session JWT with user data
       ├── Set cookie on .letbuyy.store domain
       │
       ▼
Response: Set-Cookie + Redirect to `redirect` param
       │
       ▼
Browser follows redirect to admin.letbuyy.store/dashboard
       │
       ▼
Admin middleware: lb_session cookie present → verify → allow
       │
       ▼
Dashboard loads with user context from JWT
```

### 20.2 Login API Endpoint

```typescript
// apps/web/accounts/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSession, setSessionCookie } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
    const { email, password } = await req.json();

    const supabase = createClient();

    // 1. Verify credentials
    const { data: user, error } = await supabase
        .from('users_custom')
        .select('id, email, name, password_hash, role')
        .eq('email', email.toLowerCase())
        .single();

    if (error || !user) {
        return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
        );
    }

    // 2. Verify password hash
    const bcrypt = await import('bcryptjs');
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
        return NextResponse.json(
            { error: 'Invalid email or password' },
            { status: 401 }
        );
    }

    // 3. Get user's primary store
    const { data: store } = await supabase
        .from('sites')
        .select('id, subdomain')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

    // 4. Create session token
    const token = await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role || 'owner',
        store_id: store?.id,
        store_slug: store?.subdomain,
    });

    // 5. Determine redirect destination
    const redirect = req.nextUrl.searchParams.get('redirect')
        || `${process.env.NEXT_PUBLIC_ADMIN_URL}/`;

    // 6. Create response with cookie
    const response = NextResponse.json({
        success: true,
        redirect,
        user: { id: user.id, email: user.email, name: user.name }
    });

    return setSessionCookie(response, token);
}
```

### 20.3 Themes → Admin Install Redirect

When a user browses `themes.letbuyy.store` and clicks "Install Theme":

```
User browses themes.letbuyy.store (public, no auth needed)
       │
       ▼
User clicks "Install Theme" on a theme card
       │
       ├── IF user has lb_session cookie:
       │       │
       │       ▼
       │   POST /api/themes/install { theme_id, store_id }
       │       │
       │       ▼
       │   Theme installed → Redirect to admin.letbuyy.store/themes
       │
       └── IF user has NO cookie:
               │
               ▼
           Redirect: accounts.letbuyy.store/login
               ?redirect=themes.letbuyy.store/install/{themeId}
               │
               ▼
           After login → redirect back to install page
               │
               ▼
           Install page: auto-triggers POST /api/themes/install
               │
               ▼
           Redirect to admin.letbuyy.store/themes
```

### 20.4 Install Page Component

```tsx
// apps/web/themes/app/install/[themeId]/page.tsx

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

interface Props {
    params: { themeId: string };
}

export default async function InstallThemePage({ params }: Props) {
    const headersList = headers();
    const userId = headersList.get('x-user-id');
    const storeId = headersList.get('x-store-id');

    if (!userId || !storeId) {
        redirect(`${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/login?redirect=${
            process.env.NEXT_PUBLIC_THEMES_URL}/install/${params.themeId}`);
    }

    const supabase = createClient();

    // Check if theme exists
    const { data: theme } = await supabase
        .from('themes')
        .select('id, name, thumbnail_url, description')
        .eq('id', params.themeId)
        .single();

    if (!theme) {
        redirect('/404');
    }

    // Check if already installed
    const { data: existing } = await supabase
        .from('store_themes')
        .select('id')
        .eq('store_id', storeId)
        .eq('theme_id', params.themeId)
        .single();

    if (existing) {
        redirect(`${process.env.NEXT_PUBLIC_ADMIN_URL}/themes?already_installed=${theme.name}`);
    }

    return <InstallConfirmation theme={theme} storeId={storeId} />;
}

// Client component for install confirmation
'use client';

function InstallConfirmation({ theme, storeId }: {
    theme: { id: string; name: string; thumbnail_url: string; description: string };
    storeId: string;
}) {
    const [installing, setInstalling] = useState(false);

    async function handleInstall(activate: boolean) {
        setInstalling(true);
        const res = await fetch('/api/themes/install', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                theme_id: theme.id,
                store_id: storeId,
                activate,
            }),
        });

        if (res.ok) {
            window.location.href = `${process.env.NEXT_PUBLIC_ADMIN_URL}/themes`;
        }
    }

    return (
        <div className="install-confirmation">
            <img src={theme.thumbnail_url} alt={theme.name} />
            <h1>Install "{theme.name}"?</h1>
            <p>{theme.description}</p>
            <div className="install-actions">
                <button onClick={() => handleInstall(false)} disabled={installing}>
                    Install as Draft
                </button>
                <button onClick={() => handleInstall(true)} disabled={installing}>
                    Install & Activate
                </button>
            </div>
        </div>
    );
}
```

---

## 21. Logout & Session Clearing

Logout must clear the cookie across all subdomains by setting the same `Domain` with `Max-Age=0`.

### 21.1 Logout API

```typescript
// apps/web/accounts/app/api/auth/logout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
    const redirect = req.nextUrl.searchParams.get('redirect')
        || `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/login`;

    const response = NextResponse.json({
        success: true,
        redirect,
    });

    return clearSessionCookie(response);
}

// GET endpoint for simple link-based logout
export async function GET(req: NextRequest) {
    const redirect = req.nextUrl.searchParams.get('redirect')
        || `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/login`;

    const response = NextResponse.redirect(redirect);
    return clearSessionCookie(response);
}
```

### 21.2 Logout from Any App

```tsx
// components/LogoutButton.tsx (used in admin, themes, etc.)

'use client';

export function LogoutButton() {
    const handleLogout = async () => {
        // POST to accounts app logout endpoint
        await fetch(`${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/api/auth/logout`, {
            method: 'POST',
            credentials: 'include',  // Send cookies cross-origin
        });

        // Redirect to login
        window.location.href = `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/login`;
    };

    return (
        <button onClick={handleLogout} className="logout-btn">
            Sign Out
        </button>
    );
}
```

> **Important:** The `credentials: 'include'` flag is critical for cross-origin cookie clearing. The accounts app must also return the `Access-Control-Allow-Credentials: true` header.

### 21.3 CORS Configuration for Cross-App Auth

```typescript
// apps/web/accounts/app/api/auth/[...route]/route.ts
// Or as middleware/next.config.js headers

const ALLOWED_ORIGINS = [
    'https://admin.letbuyy.store',
    'https://themes.letbuyy.store',
    'https://letbuyy.store',
];

export async function OPTIONS(req: NextRequest) {
    const origin = req.headers.get('origin') || '';
    const isAllowed = ALLOWED_ORIGINS.includes(origin);

    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': isAllowed ? origin : '',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
        },
    });
}
```

---

## 22. Theme Preview Authentication

Theme previews use a separate, short-lived JWT to allow unauthenticated storefront access to unpublished theme versions.

### 22.1 Preview Token Generation

```typescript
// lib/themes/preview-token.ts

import { SignJWT, jwtVerify } from 'jose';

const PREVIEW_SECRET = new TextEncoder().encode(process.env.PREVIEW_SECRET!);

interface PreviewPayload {
    store_id: string;
    store_theme_id: string;
    theme_id: string;
    user_id: string;
    mode: 'preview' | 'draft';
}

export async function createPreviewToken(payload: PreviewPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('2h')        // 2-hour preview window
        .sign(PREVIEW_SECRET);
}

export async function verifyPreviewToken(token: string): Promise<PreviewPayload | null> {
    try {
        const { payload } = await jwtVerify(token, PREVIEW_SECRET);
        return payload as unknown as PreviewPayload;
    } catch {
        return null;
    }
}
```

### 22.2 Preview URL Structure

```
https://{store}.letbuyy.store?preview_token={jwt}&theme={store_theme_id}
```

Example:
```
https://letok.letbuyy.store?preview_token=eyJhbGciOiJIUzI1NiJ9...&theme=abc123
```

### 22.3 Storefront Preview Detection

```typescript
// apps/web/storefront/lib/theme-resolver.ts

import { verifyPreviewToken } from '@/lib/themes/preview-token';

interface ResolvedTheme {
    themeId: string;
    storeThemeId: string;
    isPreview: boolean;
    settings: ThemeSettings;
    customizations: ThemeCustomizations;
}

export async function resolveTheme(
    storeId: string,
    searchParams: URLSearchParams
): Promise<ResolvedTheme> {

    const previewToken = searchParams.get('preview_token');
    const previewThemeId = searchParams.get('theme');

    // ─── Preview Mode ────────────────────────────────────────
    if (previewToken && previewThemeId) {
        const preview = await verifyPreviewToken(previewToken);

        if (preview && preview.store_id === storeId) {
            const { data: storeTheme } = await supabase
                .from('store_themes')
                .select(`
                    id,
                    theme_id,
                    customizations,
                    themes (
                        id, name, default_colors, default_fonts, custom_css
                    )
                `)
                .eq('id', previewThemeId)
                .eq('store_id', storeId)
                .single();

            if (storeTheme) {
                return {
                    themeId: storeTheme.theme_id,
                    storeThemeId: storeTheme.id,
                    isPreview: true,
                    settings: mergeThemeSettings(
                        storeTheme.themes.default_colors,
                        storeTheme.customizations
                    ),
                    customizations: storeTheme.customizations || {},
                };
            }
        }
    }

    // ─── Normal Mode (active theme) ──────────────────────────
    const { data: activeTheme } = await supabase
        .from('store_themes')
        .select(`
            id,
            theme_id,
            customizations,
            themes (
                id, name, default_colors, default_fonts, custom_css
            )
        `)
        .eq('store_id', storeId)
        .eq('is_active', true)
        .single();

    if (!activeTheme) {
        return getDefaultTheme();
    }

    return {
        themeId: activeTheme.theme_id,
        storeThemeId: activeTheme.id,
        isPreview: false,
        settings: mergeThemeSettings(
            activeTheme.themes.default_colors,
            activeTheme.customizations
        ),
        customizations: activeTheme.customizations || {},
    };
}
```

### 22.4 Preview Banner Component

When a store is being viewed in preview mode, a banner is shown at the top:

```tsx
// apps/web/storefront/components/PreviewBanner.tsx

'use client';

interface PreviewBannerProps {
    themeName: string;
    isPreview: boolean;
    storeThemeId: string;
}

export function PreviewBanner({ themeName, isPreview, storeThemeId }: PreviewBannerProps) {
    if (!isPreview) return null;

    return (
        <div className="preview-banner" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            backgroundColor: '#1a1a2e',
            color: '#fff',
            padding: '12px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 9999,
            fontFamily: 'system-ui, sans-serif',
            fontSize: '14px',
            borderBottom: '2px solid #6C63FF',
        }}>
            <div>
                <strong>🎨 Preview Mode:</strong> {themeName}
                <span style={{ opacity: 0.7, marginLeft: 8 }}>
                    (Changes are not visible to customers)
                </span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
                <button
                    onClick={() => {
                        // Activate the theme via API
                        fetch('/api/themes/activate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ store_theme_id: storeThemeId }),
                            credentials: 'include',
                        }).then(() => {
                            window.location.href = window.location.pathname; // Reload without preview params
                        });
                    }}
                    style={{
                        background: '#6C63FF',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    Publish Theme
                </button>
                <button
                    onClick={() => {
                        window.location.href = window.location.pathname;
                    }}
                    style={{
                        background: 'transparent',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.3)',
                        padding: '6px 16px',
                        borderRadius: 6,
                        cursor: 'pointer',
                    }}
                >
                    Exit Preview
                </button>
            </div>
        </div>
    );
}
```

---

## 23. Session Refresh & Token Rotation

### 23.1 Sliding Window Refresh

To avoid forcing users to re-login every 7 days, the session is refreshed on each valid request when the token is older than 1 day:

```typescript
// middleware-utils.ts — shared across apps

import { verifySession, createSession, setSessionCookie } from '@/lib/auth/session';

export async function refreshSessionIfNeeded(
    req: NextRequest,
    response: NextResponse,
    session: SessionPayload
): Promise<NextResponse> {
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - session.iat;

    // Refresh if token is older than 1 day
    if (tokenAge > 86400) {
        const newToken = await createSession({
            id: session.sub,
            email: session.email,
            name: session.name,
            role: session.role,
            store_id: session.store_id,
            store_slug: session.store_slug,
        });
        return setSessionCookie(response, newToken);
    }

    return response;
}
```

### 23.2 Store Switching

When a user owns multiple stores, the session must be updated to reflect the active store:

```typescript
// app/api/auth/switch-store/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession, createSession, setSessionCookie } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { store_id } = await req.json();
    const supabase = createClient();

    // Verify user owns this store
    const { data: store } = await supabase
        .from('sites')
        .select('id, subdomain')
        .eq('id', store_id)
        .eq('owner_id', session.sub)
        .single();

    if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    // Issue new session with updated store context
    const newToken = await createSession({
        id: session.sub,
        email: session.email,
        name: session.name,
        role: session.role,
        store_id: store.id,
        store_slug: store.subdomain,
    });

    const response = NextResponse.json({
        success: true,
        store: { id: store.id, subdomain: store.subdomain },
    });

    return setSessionCookie(response, newToken);
}
```

---

## 24. Cloudflare Worker Subdomain Routing

For storefront requests, a Cloudflare Worker adds routing headers before the request reaches Vercel. This enables the storefront app to identify which store is being accessed.

### 24.1 Worker Script

```javascript
// cloudflare-worker.js

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const hostname = url.hostname;

    // Extract subdomain
    // e.g., "letok.letbuyy.store" → "letok"
    const parts = hostname.split('.');
    let subdomain = null;

    if (parts.length === 3 && parts[1] === 'letbuyy' && parts[2] === 'store') {
        subdomain = parts[0];
    }

    // Known app subdomains — pass through without header
    const APP_SUBDOMAINS = ['accounts', 'admin', 'themes', 'www'];
    if (subdomain && APP_SUBDOMAINS.includes(subdomain)) {
        return fetch(request);
    }

    // Store subdomain — add routing header
    if (subdomain) {
        const modifiedRequest = new Request(request);
        modifiedRequest.headers.set('x-store-subdomain', subdomain);
        modifiedRequest.headers.set('x-forwarded-host', hostname);
        return fetch(modifiedRequest);
    }

    // Root domain — pass through
    return fetch(request);
}
```

### 24.2 Storefront Middleware Using Subdomain Header

```typescript
// apps/web/storefront/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function middleware(req: NextRequest) {
    const subdomain = req.headers.get('x-store-subdomain')
        || extractSubdomain(req.headers.get('host') || '');

    if (!subdomain) {
        return NextResponse.rewrite(new URL('/404', req.url));
    }

    // Look up store by subdomain
    const supabase = createClient();
    const { data: store } = await supabase
        .from('sites')
        .select('id, name, status')
        .eq('subdomain', subdomain)
        .single();

    if (!store) {
        return NextResponse.rewrite(new URL('/404', req.url));
    }

    if (store.status === 'paused' || store.status === 'suspended') {
        return NextResponse.rewrite(new URL('/store-unavailable', req.url));
    }

    // Pass store info to the application
    const response = NextResponse.next();
    response.headers.set('x-store-id', store.id);
    response.headers.set('x-store-name', store.name);
    response.headers.set('x-store-subdomain', subdomain);

    return response;
}

function extractSubdomain(host: string): string | null {
    const parts = host.replace(':3000', '').split('.');
    if (parts.length >= 3) return parts[0];
    return null;
}
```

---

*End of Part 4 — Continued in Part 5*

---
---

# PART 5 — AI GENERATION, PERFORMANCE, TYPE REFERENCE & API REFERENCE

---

## 25. AI-Powered Theme & Section Generation

LetBuyy integrates AI capabilities to help store owners generate complete themes and individual sections from natural language descriptions.

### 25.1 AI Theme Generation Architecture

```
┌──────────────────────────────────────────────────────────┐
│                AI THEME GENERATION PIPELINE               │
│                                                          │
│  ┌──────────┐    ┌───────────────┐    ┌───────────────┐ │
│  │  User     │    │  AI Service   │    │  Theme        │ │
│  │  Prompt   │───▶│  AI Service   │───▶│  Theme        │ │
│  │           │    │  (Gemini/    │    │  Validator    │ │
│  │           │    │   Claude)    │    │               │ │
│  └──────────┘    └───────────────┘    └───────┬───────┘ │
│                                               │         │
│  "Create a modern            Generates:       ▼         │
│   dark theme with            • Color palette  ┌───────┐ │
│   purple accents             • Font pairing   │  Save │ │
│   for a fashion              • Section configs │  as   │ │
│   store"                     • CSS variables   │ Theme │ │
│                              • Layout presets  └───────┘ │
└──────────────────────────────────────────────────────────┘
```

### 25.2 AI Theme Generation API

```typescript
// app/api/ai/generate-theme/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { generateThemeFromPrompt } from '@/lib/ai/theme-generator';
import { validateThemeConfig } from '@/lib/themes/theme-validator';

export async function POST(req: NextRequest) {
    const session = await getSession(req);
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { prompt, style_preferences, store_type } = await req.json();

    try {
        // 1. Generate theme configuration from AI
        const aiResult = await generateThemeFromPrompt({
            prompt,
            style_preferences,    // { mood: 'dark', accent: 'purple', ... }
            store_type,           // 'fashion', 'tech', 'food', etc.
        });

        // 2. Validate the generated configuration
        const validation = validateThemeConfig(aiResult.config);
        if (!validation.valid) {
            // AI hallucinated invalid values — retry with constraints
            const retryResult = await generateThemeFromPrompt({
                prompt,
                style_preferences,
                store_type,
                constraints: validation.errors,  // Feed errors back to AI
                retry: true,
            });
            return NextResponse.json({ theme: retryResult, retried: true });
        }

        // 3. Return generated theme for preview
        return NextResponse.json({
            theme: {
                name: aiResult.name,
                description: aiResult.description,
                config: aiResult.config,
                preview_css: aiResult.generatedCSS,
                sections: aiResult.suggestedSections,
            },
            tokens_used: aiResult.tokensUsed,
        });

    } catch (error) {
        return NextResponse.json(
            { error: 'Theme generation failed', details: error.message },
            { status: 500 }
        );
    }
}
```

### 25.3 Theme Generator Service

```typescript
// lib/ai/theme-generator.ts

import { callAI } from '@letbuyy/ai';

// Uses the platform's unified AI service (Gemini 3 Pro for theme generation)

interface GenerateThemeInput {
    prompt: string;
    style_preferences?: {
        mood?: 'light' | 'dark' | 'colorful' | 'minimal';
        accent?: string;       // hex color or color name
        industry?: string;
        typography?: 'serif' | 'sans-serif' | 'mixed';
    };
    store_type?: string;
    constraints?: string[];
    retry?: boolean;
}

interface GeneratedTheme {
    name: string;
    description: string;
    config: ThemeConfig;
    generatedCSS: string;
    suggestedSections: SectionSuggestion[];
    tokensUsed: number;
}

export async function generateThemeFromPrompt(
    input: GenerateThemeInput
): Promise<GeneratedTheme> {
    const systemPrompt = `You are a professional web designer creating theme configurations for an e-commerce platform.
Generate a complete theme configuration based on the user's description.

The output must be valid JSON matching this schema:
{
    "name": "Theme Name",
    "description": "Brief description",
    "config": {
        "isDark": boolean,
        "backgroundColor": "#hex",
        "textColor": "#hex",
        "surfaceColor": "#hex",
        "primaryColor": "#hex",
        "secondaryColor": "#hex",
        "accentColor": "#hex",
        "borderColor": "#hex",
        "headingFont": "font-family",
        "bodyFont": "font-family",
        "buttonRadius": "0px" | "4px" | "8px" | "12px" | "9999px",
        "cardRadius": "0px" | "8px" | "12px" | "16px",
        "spacing": "compact" | "normal" | "relaxed",
        "headerStyle": "minimal" | "centered" | "full-width",
        "footerStyle": "simple" | "detailed" | "mega"
    },
    "suggestedSections": [
        {
            "type": "hero" | "featured-products" | "collection-grid" | "testimonials" | "newsletter" | "image-banner" | "rich-text",
            "title": "Section Title",
            "description": "Why this section works for this theme"
        }
    ]
}

Rules:
- ALL colors must be valid hex codes
- Font families must be available on Google Fonts
- Ensure sufficient contrast ratios (WCAG AA minimum: 4.5:1 for text)
- Background and text colors must have at least 7:1 contrast for body text
- Accent colors should complement the primary palette
${input.constraints ? `\nPrevious attempt had these errors, fix them:\n${input.constraints.join('\n')}` : ''}`;

    const result = await callAI(env, 'gemini-3-pro', input.prompt, {
        systemPrompt,
        responseFormat: 'json',
        temperature: 0.7,
        maxTokens: 2000,
    });

    const result = JSON.parse(completion.choices[0].message.content!);

    // Generate CSS from the config
    const generatedCSS = generateCSSFromConfig(result.config);

    return {
        name: result.name,
        description: result.description,
        config: result.config,
        generatedCSS,
        suggestedSections: result.suggestedSections || [],
        tokensUsed: completion.usage?.total_tokens || 0,
    };
}

function generateCSSFromConfig(config: ThemeConfig): string {
    return `:root {
    /* Colors */
    --lb-bg: ${config.backgroundColor};
    --lb-text: ${config.textColor};
    --lb-surface: ${config.surfaceColor};
    --lb-primary: ${config.primaryColor};
    --lb-secondary: ${config.secondaryColor};
    --lb-accent: ${config.accentColor};
    --lb-border: ${config.borderColor};

    /* Typography */
    --lb-font-heading: '${config.headingFont}', sans-serif;
    --lb-font-body: '${config.bodyFont}', sans-serif;

    /* Radii */
    --lb-btn-radius: ${config.buttonRadius};
    --lb-card-radius: ${config.cardRadius};

    /* Spacing */
    --lb-section-gap: ${config.spacing === 'compact' ? '40px' : config.spacing === 'relaxed' ? '80px' : '60px'};
    --lb-container-pad: ${config.spacing === 'compact' ? '16px' : config.spacing === 'relaxed' ? '32px' : '24px'};
}`;
}
```

### 25.4 AI Section Generation

```typescript
// lib/ai/section-generator.ts

interface GenerateSectionInput {
    section_type: string;         // 'hero', 'featured-products', etc.
    theme_config: ThemeConfig;    // Current theme settings
    store_name: string;
    store_type: string;
    custom_instructions?: string; // "Make it bold and eye-catching"
}

interface GeneratedSection {
    type: string;
    settings: Record<string, any>;
    copy: {
        heading?: string;
        subheading?: string;
        cta_text?: string;
        body?: string;
    };
    layout_suggestion: string;
}

export async function generateSection(
    input: GenerateSectionInput
): Promise<GeneratedSection> {
    const result = await callAI(env, 'gemini-3-pro', `Generate content for "${input.section_type}" section`, {
        systemPrompt: `Generate content and settings for a "${input.section_type}" section.
The store "${input.store_name}" is a ${input.store_type} store.
Current theme: ${input.theme_config.isDark ? 'dark' : 'light'} mode.
Return JSON with: type, settings, copy (heading, subheading, cta_text, body), layout_suggestion.`,
            },
            {
                role: 'user',
                content: input.custom_instructions || `Create a compelling ${input.section_type} section.`
            }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 1000,
    });

    return JSON.parse(completion.choices[0].message.content!);
}
```

### 25.5 AI Generation UI Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│  ✨ AI Theme Generator                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Describe your ideal store theme:                           │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  A sleek, dark-mode fashion store with gold          │   │
│  │  accents. Luxury feel like Versace or Gucci.         │   │
│  │  Clean typography with lots of whitespace.           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Store Type: [ Fashion & Apparel ▼ ]                        │
│                                                             │
│  Style Preferences:                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│  │ ■ Dark  │ │ □ Light │ │ □ Color │ │ □ Mini  │         │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘         │
│                                                             │
│  Typography:                                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                      │
│  │ ■ Serif │ │ □ Sans  │ │ □ Mixed │                      │
│  └─────────┘ └─────────┘ └─────────┘                      │
│                                                             │
│  ┌──────────────────────────────┐                          │
│  │  ✨ Generate Theme            │                          │
│  └──────────────────────────────┘                          │
│                                                             │
│  ─── Generated Result ────────────────────────────────── │
│                                                             │
│  Theme: "Noir Luxe"                                         │
│  A premium dark theme with gold accents...                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │             [Live Preview Window]                    │   │
│  │   Dark background with gold typography              │   │
│  │   Playfair Display headings                         │   │
│  │   Inter body text                                   │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Colors:                                                    │
│  ■ #0A0A0F  ■ #C9A84C  ■ #1A1A2E  ■ #F5F0E8              │
│  bg         accent     surface    text                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Apply Theme  │  │ Customize    │  │ Regenerate   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

---

## 26. Performance Optimization

### 26.1 CSS Performance Strategy

Theme CSS is designed for zero JavaScript runtime cost:

| Strategy | Implementation | Impact |
|---|---|---|
| **CSS Variables** | All theme values are CSS custom properties | No JS needed for color/font changes |
| **Static Injection** | CSS is injected server-side in `<head>` | No FOUC (Flash of Unstyled Content) |
| **Font Preloading** | `<link rel="preload">` for theme fonts | Faster font rendering |
| **Critical CSS** | Above-the-fold styles inlined | First paint optimization |
| **CSS Containment** | `contain: layout` on sections | Reduced layout recalculations |
| **Will-Change** | Applied sparingly on animated elements | GPU acceleration where needed |

### 26.2 Theme CSS Variable Generation (Server-Side)

```typescript
// lib/themes/css-generator.ts

export function generateThemeCSS(settings: ThemeSettings): string {
    const colors = {
        '--lb-bg': settings.backgroundColor || '#FFFFFF',
        '--lb-text': settings.textColor || '#000000',
        '--lb-surface': settings.surfaceColor || '#F9FAFB',
        '--lb-primary': settings.primaryColor || '#6C63FF',
        '--lb-secondary': settings.secondaryColor || '#4ECDC4',
        '--lb-accent': settings.accentColor || '#FF6B6B',
        '--lb-border': settings.borderColor || '#E5E7EB',
        '--lb-muted': settings.mutedColor || '#9CA3AF',
        '--lb-success': settings.successColor || '#10B981',
        '--lb-warning': settings.warningColor || '#F59E0B',
        '--lb-error': settings.errorColor || '#EF4444',
    };

    const typography = {
        '--lb-font-heading': `'${settings.headingFont || 'Inter'}', system-ui, sans-serif`,
        '--lb-font-body': `'${settings.bodyFont || 'Inter'}', system-ui, sans-serif`,
        '--lb-font-size-xs': '0.75rem',
        '--lb-font-size-sm': '0.875rem',
        '--lb-font-size-base': '1rem',
        '--lb-font-size-lg': '1.125rem',
        '--lb-font-size-xl': '1.25rem',
        '--lb-font-size-2xl': '1.5rem',
        '--lb-font-size-3xl': '1.875rem',
        '--lb-font-size-4xl': '2.25rem',
        '--lb-font-size-5xl': '3rem',
    };

    const spacing = {
        '--lb-section-gap': settings.spacing === 'compact' ? '40px' : settings.spacing === 'relaxed' ? '80px' : '60px',
        '--lb-container-pad': settings.spacing === 'compact' ? '16px' : settings.spacing === 'relaxed' ? '32px' : '24px',
        '--lb-container-max': '1280px',
        '--lb-card-radius': settings.cardRadius || '12px',
        '--lb-btn-radius': settings.buttonRadius || '8px',
        '--lb-input-radius': settings.inputRadius || '8px',
    };

    const derived = {
        '--lb-bg-rgb': hexToRGB(colors['--lb-bg']),
        '--lb-text-rgb': hexToRGB(colors['--lb-text']),
        '--lb-primary-rgb': hexToRGB(colors['--lb-primary']),
        '--lb-surface-hover': adjustBrightness(colors['--lb-surface'], settings.isDark ? 10 : -5),
        '--lb-primary-hover': adjustBrightness(colors['--lb-primary'], -10),
        '--lb-shadow-color': settings.isDark ? '0 0 0' : '0 0 0',
        '--lb-shadow-sm': `0 1px 2px rgba(var(--lb-shadow-color), ${settings.isDark ? '0.3' : '0.05'})`,
        '--lb-shadow-md': `0 4px 6px rgba(var(--lb-shadow-color), ${settings.isDark ? '0.4' : '0.1'})`,
        '--lb-shadow-lg': `0 10px 15px rgba(var(--lb-shadow-color), ${settings.isDark ? '0.5' : '0.15'})`,
    };

    const allVars = { ...colors, ...typography, ...spacing, ...derived };
    const cssLines = Object.entries(allVars)
        .map(([key, val]) => `    ${key}: ${val};`)
        .join('\n');

    return `:root {\n${cssLines}\n}`;
}

function hexToRGB(hex: string): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r}, ${g}, ${b}`;
}

function adjustBrightness(hex: string, percent: number): string {
    const r = Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) + Math.round(255 * percent / 100)));
    const g = Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) + Math.round(255 * percent / 100)));
    const b = Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) + Math.round(255 * percent / 100)));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
```

### 26.3 Font Loading Strategy

```tsx
// apps/web/storefront/app/layout.tsx

import { headers } from 'next/headers';

// Map of all available Google Fonts (subset)
const GOOGLE_FONTS_MAP: Record<string, string> = {
    'Inter': 'Inter:wght@300;400;500;600;700',
    'Playfair Display': 'Playfair+Display:wght@400;500;600;700',
    'Roboto': 'Roboto:wght@300;400;500;700',
    'Outfit': 'Outfit:wght@300;400;500;600;700',
    'Poppins': 'Poppins:wght@300;400;500;600;700',
    'Lora': 'Lora:wght@400;500;600;700',
    'Montserrat': 'Montserrat:wght@300;400;500;600;700',
    'Open Sans': 'Open+Sans:wght@300;400;500;600;700',
    'Raleway': 'Raleway:wght@300;400;500;600;700',
    'Source Serif Pro': 'Source+Serif+Pro:wght@400;600;700',
    'DM Sans': 'DM+Sans:wght@400;500;700',
    'Space Grotesk': 'Space+Grotesk:wght@400;500;600;700',
    'Cormorant Garamond': 'Cormorant+Garamond:wght@400;500;600;700',
    'Josefin Sans': 'Josefin+Sans:wght@300;400;500;600;700',
    'Crimson Text': 'Crimson+Text:wght@400;600;700',
};

export function generateFontLinks(headingFont: string, bodyFont: string): string {
    const fonts = new Set<string>();

    if (GOOGLE_FONTS_MAP[headingFont]) fonts.add(GOOGLE_FONTS_MAP[headingFont]);
    if (GOOGLE_FONTS_MAP[bodyFont]) fonts.add(GOOGLE_FONTS_MAP[bodyFont]);

    if (fonts.size === 0) return '';

    const familyParam = Array.from(fonts).join('&family=');
    const url = `https://fonts.googleapis.com/css2?family=${familyParam}&display=swap`;

    return `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" href="${url}" as="style">
<link rel="stylesheet" href="${url}">`;
}
```

### 26.4 Theme Caching Strategy

```typescript
// lib/themes/cache.ts

const CACHE_TTL = 5 * 60;  // 5 minutes

interface CachedTheme {
    css: string;
    fontLinks: string;
    settings: ThemeSettings;
    timestamp: number;
}

const themeCache = new Map<string, CachedTheme>();

export async function getCachedThemeCSS(
    storeId: string,
    storeThemeId: string
): Promise<CachedTheme | null> {
    const key = `${storeId}:${storeThemeId}`;
    const cached = themeCache.get(key);

    if (cached && Date.now() / 1000 - cached.timestamp < CACHE_TTL) {
        return cached;
    }

    return null;
}

export function setCachedThemeCSS(
    storeId: string,
    storeThemeId: string,
    data: Omit<CachedTheme, 'timestamp'>
): void {
    const key = `${storeId}:${storeThemeId}`;
    themeCache.set(key, { ...data, timestamp: Date.now() / 1000 });
}

export function invalidateThemeCache(storeId: string): void {
    for (const key of themeCache.keys()) {
        if (key.startsWith(`${storeId}:`)) {
            themeCache.delete(key);
        }
    }
}
```

### 26.5 Performance Metrics

| Metric | Target | Current | Method |
|---|---|---|---|
| **Theme CSS Size** | < 5 KB | ~2-3 KB | CSS variables + minimal base styles |
| **First Contentful Paint** | < 1.5s | ~1.2s | Server-side CSS injection |
| **Largest Contentful Paint** | < 2.5s | ~2.0s | Font preloading + image optimization |
| **Cumulative Layout Shift** | < 0.1 | ~0.02 | CSS containment + font-display: swap |
| **Theme Switch Time** | < 100ms | ~50ms | CSS variable updates only (no re-render) |
| **Custom CSS Parse Time** | < 50ms | ~20ms | Server-side validation + caching |

---

## 27. Complete TypeScript Type Reference

### 27.1 Core Theme Types

```typescript
// types/theme.ts

// ─── Theme Settings ──────────────────────────────────────────
export interface ThemeSettings {
    // Mode
    isDark: boolean;

    // Colors
    backgroundColor: string;
    textColor: string;
    surfaceColor: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    borderColor: string;
    mutedColor: string;
    successColor: string;
    warningColor: string;
    errorColor: string;

    // Typography
    headingFont: string;
    bodyFont: string;

    // Layout
    spacing: 'compact' | 'normal' | 'relaxed';
    buttonRadius: string;
    cardRadius: string;
    inputRadius: string;
    containerWidth: string;

    // Header & Footer
    headerStyle: 'minimal' | 'centered' | 'full-width';
    footerStyle: 'simple' | 'detailed' | 'mega';

    // Extras
    enableAnimations: boolean;
    enableShadows: boolean;
    announcementBar: {
        enabled: boolean;
        text: string;
        backgroundColor: string;
        textColor: string;
        link?: string;
    };
}

// ─── Theme Configuration (database row) ──────────────────────
export interface Theme {
    id: string;
    name: string;
    description: string;
    thumbnail_url: string;
    default_colors: ThemeColorConfig;
    default_fonts: ThemeFontConfig;
    custom_css: string | null;
    is_system: boolean;
    is_default: boolean;
    category: 'minimal' | 'bold' | 'elegant' | 'playful' | 'professional';
    version: string;
    author: string | null;
    created_at: string;
    updated_at: string;
}

// ─── Color Config ────────────────────────────────────────────
export interface ThemeColorConfig {
    isDark: boolean;
    backgroundColor: string;
    textColor: string;
    surfaceColor: string;
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    borderColor?: string;
}

// ─── Font Config ─────────────────────────────────────────────
export interface ThemeFontConfig {
    headingFont: string;
    bodyFont: string;
    headingWeight?: number;
    bodyWeight?: number;
}

// ─── Store Theme (installed instance) ────────────────────────
export interface StoreTheme {
    id: string;
    store_id: string;
    theme_id: string;
    is_active: boolean;
    customizations: ThemeCustomizations | null;
    color_overrides: Partial<ThemeColorConfig> | null;
    font_overrides: Partial<ThemeFontConfig> | null;
    installed_at: string;
    updated_at: string;
    theme?: Theme;  // joined
}

// ─── Theme Customizations ────────────────────────────────────
export interface ThemeCustomizations {
    colors?: Partial<ThemeColorConfig>;
    fonts?: Partial<ThemeFontConfig>;
    spacing?: 'compact' | 'normal' | 'relaxed';
    buttonRadius?: string;
    cardRadius?: string;
    headerStyle?: 'minimal' | 'centered' | 'full-width';
    footerStyle?: 'simple' | 'detailed' | 'mega';
    announcementBar?: {
        enabled: boolean;
        text: string;
        backgroundColor: string;
        textColor: string;
        link?: string;
    };
    sections?: Record<string, SectionConfig>;
}
```

### 27.2 Section Types

```typescript
// types/sections.ts

export type SectionType =
    | 'hero'
    | 'featured-products'
    | 'collection-grid'
    | 'collection-list'
    | 'image-banner'
    | 'image-with-text'
    | 'rich-text'
    | 'newsletter'
    | 'testimonials'
    | 'logo-list'
    | 'video'
    | 'gallery'
    | 'countdown'
    | 'faq'
    | 'contact-form'
    | 'map'
    | 'blog-posts'
    | 'custom-html';

export interface SectionConfig {
    id: string;
    type: SectionType;
    enabled: boolean;
    position: number;
    settings: Record<string, any>;
    blocks?: SectionBlock[];
}

export interface SectionBlock {
    id: string;
    type: string;
    settings: Record<string, any>;
}

export interface SectionDefinition {
    type: SectionType;
    name: string;
    description: string;
    icon: string;
    category: 'hero' | 'products' | 'media' | 'text' | 'interactive' | 'social';
    settings: SectionSettingDefinition[];
    blocks?: BlockDefinition[];
    presets?: SectionPreset[];
    max_blocks?: number;
}

export interface SectionSettingDefinition {
    id: string;
    type: 'text' | 'textarea' | 'richtext' | 'number' | 'range' | 'select' |
          'checkbox' | 'color' | 'image' | 'url' | 'product' | 'collection' |
          'blog' | 'page' | 'font';
    label: string;
    default?: any;
    info?: string;
    placeholder?: string;
    options?: { value: string; label: string }[];  // for select
    min?: number;   // for range/number
    max?: number;
    step?: number;
}

export interface BlockDefinition {
    type: string;
    name: string;
    settings: SectionSettingDefinition[];
}

export interface SectionPreset {
    name: string;
    settings: Record<string, any>;
    blocks?: { type: string; settings: Record<string, any> }[];
}
```

### 27.3 Marketplace Types

```typescript
// types/marketplace.ts

export interface ThemeMarketplaceListing {
    id: string;
    theme_id: string;
    developer_id: string;
    price: number;           // 0 = free
    currency: 'INR' | 'USD';
    listing_status: 'draft' | 'pending_review' | 'approved' | 'rejected' | 'suspended';
    review_notes: string | null;
    demo_url: string | null;
    screenshots: string[];
    features: string[];
    tags: string[];
    support_email: string;
    documentation_url: string | null;
    changelog: string | null;
    install_count: number;
    rating_average: number;
    rating_count: number;
    submitted_at: string | null;
    approved_at: string | null;
    created_at: string;
    updated_at: string;

    // Joined
    theme?: Theme;
    developer?: {
        id: string;
        name: string;
        email: string;
        avatar_url: string | null;
    };
}

export interface ThemeReview {
    id: string;
    theme_id: string;
    user_id: string;
    store_id: string;
    rating: 1 | 2 | 3 | 4 | 5;
    title: string;
    body: string;
    is_verified_purchase: boolean;
    helpful_count: number;
    created_at: string;

    // Joined
    user?: { name: string; avatar_url: string | null };
}
```

### 27.4 Custom CSS Types

```typescript
// types/custom-css.ts

export interface ThemeCustomCSS {
    id: string;
    store_id: string;
    theme_id: string | null;
    global_css: string;
    global_css_enabled: boolean;
    section_css: Record<string, string>;  // section_id → CSS
    last_edited_by: string | null;
    last_edited_at: string;
    created_at: string;
}

export interface CSSValidationResult {
    valid: boolean;
    errors: CSSValidationError[];
    warnings: CSSValidationWarning[];
    stats: {
        ruleCount: number;
        selectorCount: number;
        propertyCount: number;
        fileSize: number;
        estimatedSpecificity: 'low' | 'medium' | 'high';
    };
}

export interface CSSValidationError {
    line: number;
    column: number;
    message: string;
    severity: 'error' | 'critical';
    rule?: string;
}

export interface CSSValidationWarning {
    line: number;
    column: number;
    message: string;
    suggestion?: string;
}
```

### 27.5 Theme File Types

```typescript
// types/theme-files.ts

export interface ThemeFile {
    id: string;
    theme_id: string;
    store_id: string | null;
    file_path: string;
    file_type: 'css' | 'liquid' | 'js' | 'json' | 'svg' | 'image' | 'font';
    content: string | null;     // text files
    file_url: string | null;    // binary files (CDN URL)
    file_size: number;
    version: number;
    previous_content: string | null;
    is_locked: boolean;
    created_at: string;
    updated_at: string;
}

export interface ThemeVersion {
    id: string;
    theme_id: string;
    store_id: string | null;
    version: string;           // semver: "1.2.0"
    changelog: string | null;
    files_snapshot: Record<string, {
        content?: string;
        file_url?: string;
        file_size: number;
    }>;
    config_snapshot: {
        colors: ThemeColorConfig;
        fonts: ThemeFontConfig;
        settings: Record<string, any>;
    };
    created_by: string | null;
    created_at: string;
}

export interface ThemeManifest {
    name: string;
    version: string;
    description: string;
    author: {
        name: string;
        email?: string;
        url?: string;
    };
    config: {
        colors: ThemeColorConfig;
        fonts: ThemeFontConfig;
        settings?: Record<string, any>;
    };
    sections?: string[];        // List of supported section types
    assets?: string[];          // List of asset file paths
    screenshots?: string[];     // Paths to screenshot images
    license?: string;
}
```

---

## 28. Complete API Endpoint Reference

### 28.1 Theme Management APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/themes` | Optional | List all system themes |
| `GET` | `/api/themes/[id]` | Optional | Get theme details |
| `GET` | `/api/themes/store` | Required | Get store's installed themes |
| `POST` | `/api/themes/install` | Required | Install a theme to store |
| `POST` | `/api/themes/activate` | Required | Activate an installed theme |
| `POST` | `/api/themes/duplicate` | Required | Duplicate a theme |
| `POST` | `/api/themes/export` | Required | Export theme as ZIP |
| `DELETE` | `/api/themes/[storeThemeId]` | Required | Remove installed theme |
| `GET` | `/api/themes/preview-token` | Required | Generate preview JWT |

### 28.2 Theme Customization APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/themes/[storeThemeId]/customizations` | Required | Get customizations |
| `PUT` | `/api/themes/[storeThemeId]/customizations` | Required | Save customizations |
| `PUT` | `/api/themes/[storeThemeId]/colors` | Required | Update color overrides |
| `PUT` | `/api/themes/[storeThemeId]/fonts` | Required | Update font overrides |
| `POST` | `/api/themes/[storeThemeId]/reset` | Required | Reset to theme defaults |

### 28.3 Custom CSS APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/themes/custom-css` | Required | Get store's custom CSS |
| `PUT` | `/api/themes/custom-css` | Required | Save global custom CSS |
| `PUT` | `/api/themes/custom-css/section` | Required | Save section-specific CSS |
| `POST` | `/api/themes/custom-css/validate` | Required | Validate CSS string |
| `PATCH` | `/api/themes/custom-css/toggle` | Required | Enable/disable custom CSS |

### 28.4 Theme Files APIs (Code Editor)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/themes/files` | Required | List theme files |
| `GET` | `/api/themes/files/[fileId]` | Required | Get file content |
| `PUT` | `/api/themes/files/[fileId]` | Required | Update file content |
| `POST` | `/api/themes/files` | Required | Create new file |
| `DELETE` | `/api/themes/files/[fileId]` | Required | Delete a file |
| `POST` | `/api/themes/files/[fileId]/revert` | Required | Revert to previous version |

### 28.5 Theme Upload APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/themes/upload` | Required | Upload theme ZIP |
| `POST` | `/api/themes/upload/validate` | Required | Validate ZIP without installing |

### 28.6 Marketplace APIs (Public)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/marketplace/themes` | None | Browse marketplace themes |
| `GET` | `/api/marketplace/themes/[id]` | None | Get theme listing details |
| `GET` | `/api/marketplace/themes/[id]/reviews` | None | Get theme reviews |
| `GET` | `/api/marketplace/categories` | None | List theme categories |
| `GET` | `/api/marketplace/featured` | None | Get featured themes |
| `GET` | `/api/marketplace/search?q=` | None | Search themes |

### 28.7 Marketplace APIs (Authenticated)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/marketplace/themes/[id]/review` | Required | Submit a review |
| `POST` | `/api/marketplace/themes/[id]/report` | Required | Report a theme |
| `GET` | `/api/marketplace/my-purchases` | Required | List purchased themes |

### 28.8 Developer APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/developer/themes/submit` | Required | Submit theme for review |
| `PUT` | `/api/developer/themes/[id]/update` | Required | Update submission |
| `GET` | `/api/developer/themes` | Required | List developer's themes |
| `GET` | `/api/developer/analytics` | Required | Theme analytics dashboard |
| `POST` | `/api/developer/themes/[id]/version` | Required | Publish new version |

### 28.9 AI APIs

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/generate-theme` | Required | Generate theme from prompt |
| `POST` | `/api/ai/generate-section` | Required | Generate section content |
| `POST` | `/api/ai/suggest-colors` | Required | AI color palette suggestion |
| `POST` | `/api/ai/suggest-fonts` | Required | AI font pairing suggestion |

### 28.10 Auth APIs (Accounts App)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | None | Login with credentials |
| `POST` | `/api/auth/signup` | None | Create new account |
| `POST` | `/api/auth/logout` | Optional | Clear session |
| `GET` | `/api/auth/logout` | Optional | Clear session (GET redirect) |
| `POST` | `/api/auth/verify-otp` | None | Verify email OTP |
| `POST` | `/api/auth/forgot-password` | None | Send reset email |
| `POST` | `/api/auth/reset-password` | None | Reset with token |
| `GET` | `/api/auth/session` | Optional | Get current session |
| `POST` | `/api/auth/switch-store` | Required | Switch active store |

---

## 29. Troubleshooting Guide

### 29.1 Common Issues

| Issue | Cause | Solution |
|---|---|---|
| **Theme not applying** | CSS variables not injected | Check storefront `<head>` for `#lb-theme-vars` style tag |
| **Custom CSS not visible** | `global_css_enabled` is `false` | Toggle via `/api/themes/custom-css/toggle` |
| **Fonts not loading** | Google Fonts URL missing | Verify `generateFontLinks()` output in page source |
| **Preview not working** | Expired preview token | Tokens expire after 2 hours; regenerate |
| **SSO redirect loop** | Cookie domain mismatch | Verify `Domain=.letbuyy.store` in Set-Cookie header |
| **Logout not clearing** | Missing `credentials: 'include'` | Add to cross-origin fetch calls |
| **Theme upload fails** | Missing `theme.json` | Ensure ZIP root contains valid `theme.json` manifest |
| **CSS validation error** | `@import` or `!important` abuse | Remove `@import` rules; limit `!important` usage |
| **Store switching fails** | User doesn't own store | Verify `owner_id` matches session `sub` |
| **Theme colors wrong** | Customization override stale | Clear cache via `invalidateThemeCache(storeId)` |

### 29.2 Debug Checklist

```
□ Check browser DevTools → Application → Cookies for lb_session
□ Verify cookie Domain is .letbuyy.store (not accounts.letbuyy.store)
□ Check Network tab for Set-Cookie headers on auth responses
□ Inspect <head> for theme CSS injection order:
    1. #lb-theme-vars (CSS variables)
    2. #lb-theme-base (theme base CSS)
    3. #lb-custom-css (user custom CSS)
□ Verify Google Fonts <link> tags are present for theme fonts
□ Check Supabase RLS policies if data queries fail
□ Verify Cloudflare Worker is adding x-store-subdomain header
□ Check Next.js middleware logs for redirect chains
□ Test preview tokens with jwt.io to verify expiry
□ Confirm CORS headers on cross-origin auth requests
```

### 29.3 Environment Variables Reference

| Variable | App | Description |
|---|---|---|
| `SESSION_SECRET` | All | HS256 signing key for lb_session JWT |
| `PREVIEW_SECRET` | Admin, Storefront | Signing key for preview tokens |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All (server) | Supabase admin key |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All | Supabase public key |
| `NEXT_PUBLIC_ACCOUNTS_URL` | Admin, Themes | `https://accounts.letbuyy.store` |
| `NEXT_PUBLIC_ADMIN_URL` | Accounts, Themes | `https://admin.letbuyy.store` |
| `NEXT_PUBLIC_THEMES_URL` | Admin, Accounts | `https://themes.letbuyy.store` |
| `NEXT_PUBLIC_STOREFRONT_URL` | Admin | `https://{slug}.letbuyy.store` |
| `GEMINI_API_KEY` | Admin | For AI theme generation |
| `NODE_ENV` | All | `production` / `development` |

---

## 30. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2025-02-16 | System | Initial theme system documentation |
| 2.0 | 2025-02-16 | System | Added custom CSS, code editor, validation engine |
| 3.0 | 2025-02-16 | System | Added marketplace, installation, preview, publishing |
| 4.0 | 2025-02-16 | System | Added SSO architecture, cross-app auth, session management |
| 5.0 | 2025-02-16 | System | Added AI generation, performance, types, API reference |

---

## Cross-References

- **[01_Platform_Overview.md](./01_Platform_Overview.md)** — Platform architecture and application landscape
- **[02_Tech_Stack.md](./02_Tech_Stack.md)** — Technology decisions (Next.js, Supabase, Vercel)
- **[03_Database_Schema.md](./03_Database_Schema.md)** — Complete database schema including theme tables
- **[04_Authentication.md](./04_Authentication.md)** — Auth system design and SSO details
- **[05_Storefront.md](./05_Storefront.md)** — Storefront rendering and theme resolution
- **[06_Admin_Dashboard.md](./06_Admin_Dashboard.md)** — Admin theme management UI
- **[07_Sections_System.md](./07_Sections_System.md)** — Section types and configuration
- **[12_Implementation_Roadmap.md](./12_Implementation_Roadmap.md)** — Development timeline for theme features

---

*End of Document — 14_Theme_Implementation.md*
*Total Sections: 30 | Parts: 5 | Estimated Lines: 4,500+*
