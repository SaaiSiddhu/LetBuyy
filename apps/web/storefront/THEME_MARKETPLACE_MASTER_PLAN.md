# 🎨 LetBuyy Theme Marketplace — Master Implementation Plan

**Version:** 3.1 (Fully Merged & Comprehensive)  
**Date:** February 2026  
**Scope:** Enterprise-ready theme marketplace + consumer storefront architecture  
**Merged from:** `LetBuyy Theme Marketplace - Complete Roadmap.md` + `teme intergation.md`

---

## 📋 Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview & Folder Structure](#2-architecture-overview--folder-structure)
3. [Consumer Storefront — Per-Theme Architecture](#3-consumer-storefront--per-theme-architecture)
4. [Database Schema (17+ Tables, Indexes, RLS)](#4-database-schema)
5. [Authentication & Security](#5-authentication--security)
6. [Theme Engine](#6-theme-engine)
7. [Theme Resolver & Middleware](#7-theme-resolver--middleware)
8. [API Architecture (25+ Endpoints)](#8-api-architecture)
9. [UI Wireframes — Marketplace Pages](#9-ui-wireframes--marketplace-pages)
10. [UI Wireframes — Store Themes](#10-ui-wireframes--store-themes)
11. [UI Wireframes — Portfolio Themes](#11-ui-wireframes--portfolio-themes)
12. [UI Wireframes — Resume & Landing Themes](#12-ui-wireframes--resume--landing-themes)
13. [Admin Panel](#13-admin-panel)
14. [Admin Panel Analytics](#14-admin-panel-analytics)
15. [Admin Panel — Theme Management](#15-admin-panel--theme-management)
16. [Implementation Phases](#16-implementation-phases)
17. [Payment & Licensing](#17-payment--licensing)
18. [Theme Development Workflow](#18-theme-development-workflow)
19. [Testing & QA](#19-testing--qa)
20. [Deployment Strategy](#20-deployment-strategy)
21. [Success Metrics & KPIs](#21-success-metrics--kpis)
22. [Quick Start Guide](#22-quick-start-guide)
23. [Theme Customizer (Live Preview)](#23-theme-customizer-live-preview)
24. [Multi-Platform Export](#24-multi-platform-export)
25. [Additional Features](#25-additional-features)

---

## 1. Executive Summary

### 1.1 Vision

Build a **professional-grade SaaS theme marketplace** (`themes.letbuyy.store`) that:

- ✅ Serves LetBuyy users (instant apply to their stores)
- ✅ Serves external developers (download source code for WordPress, Shopify, Wix, HTML)
- ✅ Provides enterprise-level security and licensing
- ✅ Offers a dedicated admin panel for theme management
- ✅ Supports multiple revenue streams (subscriptions, one-time, platform-specific downloads)
- ✅ Uses a **consumer-storefront** architecture where each theme category and individual theme has its own directory

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
| Per-Theme Folder Architecture | ✅ Yes | ❌ No | ❌ No |

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

## 2. Architecture Overview & Folder Structure

### 2.1 Complete Monorepo Structure

```
letbuyy-monorepo/
├── apps/
│   ├── web/
│   │   ├── storefront/                          # ⭐ MAIN STOREFRONT APP
│   │   │   ├── consumer-storefront/             # 🆕 Per-theme implementations
│   │   │   │   │
│   │   │   │   ├── stores/                      # 🛒 E-Commerce Store Themes
│   │   │   │   │   ├── urban-kicks/             # Streetwear / Sneakers
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── header.tsx
│   │   │   │   │   │   │   ├── hero.tsx
│   │   │   │   │   │   │   ├── product-grid.tsx
│   │   │   │   │   │   │   ├── product-card.tsx
│   │   │   │   │   │   │   ├── cart-drawer.tsx
│   │   │   │   │   │   │   ├── footer.tsx
│   │   │   │   │   │   │   └── testimonials.tsx
│   │   │   │   │   │   ├── pages/
│   │   │   │   │   │   │   ├── home.tsx
│   │   │   │   │   │   │   ├── products.tsx
│   │   │   │   │   │   │   ├── product-detail.tsx
│   │   │   │   │   │   │   ├── cart.tsx
│   │   │   │   │   │   │   └── checkout.tsx
│   │   │   │   │   │   ├── config.ts            # Theme colors, fonts, layout
│   │   │   │   │   │   ├── index.tsx            # Main theme export
│   │   │   │   │   │   ├── styles.css           # Theme-specific styles
│   │   │   │   │   │   └── demo-data.ts         # Mock data for preview
│   │   │   │   │   │
│   │   │   │   │   ├── luxe-atelier/            # Luxury Fashion
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── pages/
│   │   │   │   │   │   ├── config.ts
│   │   │   │   │   │   ├── index.tsx
│   │   │   │   │   │   ├── styles.css
│   │   │   │   │   │   └── demo-data.ts
│   │   │   │   │   │
│   │   │   │   │   ├── neon-tech/               # Electronics / Gadgets
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   ├── pages/
│   │   │   │   │   │   ├── config.ts
│   │   │   │   │   │   ├── index.tsx
│   │   │   │   │   │   ├── styles.css
│   │   │   │   │   │   └── demo-data.ts
│   │   │   │   │   │
│   │   │   │   │   └── natures-basket/          # Organic / Food
│   │   │   │   │       ├── components/
│   │   │   │   │       ├── pages/
│   │   │   │   │       ├── config.ts
│   │   │   │   │       ├── index.tsx
│   │   │   │   │       ├── styles.css
│   │   │   │   │       └── demo-data.ts
│   │   │   │   │
│   │   │   │   ├── portfolio/                   # 🎨 Portfolio Themes
│   │   │   │   │   ├── creative-folio/          # Creative Portfolio
│   │   │   │   │   │   ├── components/
│   │   │   │   │   │   │   ├── header.tsx
│   │   │   │   │   │   │   ├── hero.tsx
│   │   │   │   │   │   │   ├── project-grid.tsx
│   │   │   │   │   │   │   ├── project-card.tsx
│   │   │   │   │   │   │   ├── about-section.tsx
│   │   │   │   │   │   │   ├── skills.tsx
│   │   │   │   │   │   │   ├── contact-form.tsx
│   │   │   │   │   │   │   └── footer.tsx
│   │   │   │   │   │   ├── pages/
│   │   │   │   │   │   │   ├── home.tsx
│   │   │   │   │   │   │   ├── projects.tsx
│   │   │   │   │   │   │   ├── project-detail.tsx
│   │   │   │   │   │   │   ├── about.tsx
│   │   │   │   │   │   │   └── contact.tsx
│   │   │   │   │   │   ├── config.ts
│   │   │   │   │   │   ├── index.tsx
│   │   │   │   │   │   ├── styles.css
│   │   │   │   │   │   └── demo-data.ts
│   │   │   │   │   │
│   │   │   │   │   └── dark-portfolio/          # Dark/Minimal Portfolio
│   │   │   │   │       ├── components/
│   │   │   │   │       ├── pages/
│   │   │   │   │       ├── config.ts
│   │   │   │   │       ├── index.tsx
│   │   │   │   │       ├── styles.css
│   │   │   │   │       └── demo-data.ts
│   │   │   │   │
│   │   │   │   ├── resume/                      # 📄 Resume Themes
│   │   │   │   │   └── clean-resume/            # Professional Resume
│   │   │   │   │       ├── components/
│   │   │   │   │       │   ├── header-card.tsx
│   │   │   │   │       │   ├── experience.tsx
│   │   │   │   │       │   ├── skills-grid.tsx
│   │   │   │   │       │   ├── education.tsx
│   │   │   │   │       │   ├── certifications.tsx
│   │   │   │   │       │   └── download-button.tsx
│   │   │   │   │       ├── pages/
│   │   │   │   │       │   └── home.tsx
│   │   │   │   │       ├── config.ts
│   │   │   │   │       ├── index.tsx
│   │   │   │   │       ├── styles.css
│   │   │   │   │       └── demo-data.ts
│   │   │   │   │
│   │   │   │   └── landing/                     # 🚀 Landing / SaaS Themes
│   │   │   │       └── saas-launch/             # Modern SaaS Landing
│   │   │   │           ├── components/
│   │   │   │           │   ├── header.tsx
│   │   │   │           │   ├── hero.tsx
│   │   │   │           │   ├── features.tsx
│   │   │   │           │   ├── pricing.tsx
│   │   │   │           │   ├── testimonials.tsx
│   │   │   │           │   ├── cta-banner.tsx
│   │   │   │           │   ├── logo-bar.tsx
│   │   │   │           │   └── footer.tsx
│   │   │   │           ├── pages/
│   │   │   │           │   └── home.tsx
│   │   │   │           ├── config.ts
│   │   │   │           ├── index.tsx
│   │   │   │           ├── styles.css
│   │   │   │           └── demo-data.ts
│   │   │   │
│   │   │   ├── src/                             # Existing storefront source
│   │   │   │   ├── app/
│   │   │   │   ├── components/
│   │   │   │   ├── lib/
│   │   │   │   │   ├── themes/                  # Theme data (ThemeEntry definitions)
│   │   │   │   │   │   ├── store/
│   │   │   │   │   │   ├── portfolio/
│   │   │   │   │   │   └── types.ts
│   │   │   │   │   ├── supabase.ts
│   │   │   │   │   ├── stripe.ts
│   │   │   │   │   └── store-service.ts
│   │   │   │   └── middleware.ts
│   │   │   └── package.json
│   │   │
│   │   ├── theme-marketplace/                   # 🆕 (themes.letbuyy.store)
│   │   ├── theme-admin/                         # 🆕 (themes-admin.letbuyy.store)
│   │   ├── admin/                               # Store builder
│   │   ├── accounts/                            # Auth hub
│   │   ├── landing/                             # Marketing site
│   │   ├── console/                             # Super admin
│   │   └── team/                                # Team management
│   │
│   └── mobile/
│       ├── customer-app/
│       └── merchant-app/
│
├── packages/
│   ├── typescript/
│   │   ├── theme-engine/                        # 🔥 Core theme rendering
│   │   │   ├── src/
│   │   │   │   ├── renderer/
│   │   │   │   ├── registry/
│   │   │   │   ├── schemas/
│   │   │   │   ├── hydration/
│   │   │   │   ├── customization/
│   │   │   │   ├── recommendations/
│   │   │   │   └── performance/
│   │   │   └── themes/                          # Theme component interfaces
│   │   ├── theme-converter/                     # WP/Shopify/HTML export
│   │   ├── licensing/                           # License gen & validation
│   │   ├── security/                            # Rate limiting, CSRF
│   │   ├── ui/                                  # Shared React components
│   │   ├── payments/                            # Stripe + Razorpay
│   │   └── analytics/                           # PostHog tracking
│   └── config/
│       ├── eslint/
│       ├── typescript/
│       └── tailwind/
│
├── backend/
│   ├── supabase/
│   │   ├── migrations/
│   │   ├── seed/
│   │   └── functions/
│   └── workers/
│       ├── cdn/
│       ├── webhooks/
│       └── downloads/
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 2.2 Consumer Storefront — Directory Relationship

```
┌─────────────────────────────────────────────────────────────┐
│          CONSUMER-STOREFRONT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  consumer-storefront/                                       │
│  │                                                          │
│  ├── stores/          ← E-Commerce store themes             │
│  │   ├── urban-kicks/    → urban-kicks.letbuyy.store       │
│  │   ├── luxe-atelier/   → luxe-atelier.letbuyy.store     │
│  │   ├── neon-tech/      → neon-tech.letbuyy.store         │
│  │   └── natures-basket/ → natures-basket.letbuyy.store   │
│  │                                                          │
│  ├── portfolio/       ← Portfolio showcase themes           │
│  │   ├── creative-folio/ → creative-folio.letbuyy.store    │
│  │   └── dark-portfolio/ → dark-portfolio.letbuyy.store    │
│  │                                                          │
│  ├── resume/          ← Resume / CV themes                  │
│  │   └── clean-resume/   → clean-resume.letbuyy.store      │
│  │                                                          │
│  └── landing/         ← Landing page / SaaS themes          │
│      └── saas-launch/    → saas-launch.letbuyy.store       │
│                                                             │
│  Each theme folder contains:                                │
│  ├── components/     ← Theme-specific React components      │
│  ├── pages/          ← Page-level compositions              │
│  ├── config.ts       ← Colors, fonts, layout config         │
│  ├── index.tsx       ← Main export (ThemeComponents)        │
│  ├── styles.css      ← Theme-specific CSS                  │
│  └── demo-data.ts    ← Mock data for live preview           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Domain Architecture

| Domain | App | Purpose | Auth |
|--------|-----|---------|------|
| `themes.letbuyy.store` | theme-marketplace | Browse, buy, apply themes | Checkout only |
| `themes-admin.letbuyy.store` | theme-admin | Manage theme catalog | Super admin only |
| `urban-kicks.letbuyy.store` | storefront | Live demo (Urban Kicks) | No |
| `luxe-atelier.letbuyy.store` | storefront | Live demo (Luxe Atelier) | No |
| `neon-tech.letbuyy.store` | storefront | Live demo (Neon Tech) | No |
| `natures-basket.letbuyy.store` | storefront | Live demo (Nature's Basket) | No |
| `creative-folio.letbuyy.store` | storefront | Live demo (Creative Folio) | No |
| `clean-resume.letbuyy.store` | storefront | Live demo (Clean Resume) | No |
| `saas-launch.letbuyy.store` | storefront | Live demo (SaaS Launch) | No |
| `*.letbuyy.store` | storefront | User stores | No (public) |
| `accounts.letbuyy.store` | accounts | Shared authentication | Yes |
| `admin.letbuyy.store` | admin | Store builder | Yes |

### 2.4 Data Flow — User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                      USER JOURNEY                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Browse Gallery (themes.letbuyy.store)                   │
│     ↓                                                       │
│  2. View Theme Detail → See screenshots, features, reviews  │
│     ↓                                                       │
│  3. Click "Live Demo" → urban-kicks.letbuyy.store           │
│     (Real store from consumer-storefront/stores/urban-kicks)│
│     ↓                                                       │
│  4. Click "Install" or "Buy"                                │
│     ↓                                                       │
│  5. Auth Check:                                             │
│     - Not logged in → accounts.letbuyy.store                │
│     - Logged in → Continue                                  │
│     ↓                                                       │
│  6a. FREE → Instant install to user's store                 │
│  6b. PAID → Stripe/Razorpay → Webhook → Record purchase    │
│     ↓                                                       │
│  7. Theme Applied → user-store.letbuyy.store                │
│     - Uses consumer-storefront/{category}/{theme}/          │
│     - Loads components from that theme folder               │
│     ↓                                                       │
│  8. Dashboard: Manage themes, customize, download           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.5 Tech Stack

**Frontend:**
- Next.js 15 (App Router) · React 19
- Tailwind CSS 4.0 + shadcn/ui
- Zustand + TanStack Query
- Framer Motion · Lucide React

**Backend:**
- Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- Stripe + Razorpay (Payments)
- Cloudflare Workers (CDN, Downloads, Webhooks)
- Upstash Redis (Caching, Rate Limiting)

**DevOps:**
- Turborepo + pnpm (Monorepo)
- Vercel (Hosting)
- Sentry + PostHog (Monitoring + Analytics)
- Resend (Transactional Emails)

---

## 3. Consumer Storefront — Per-Theme Architecture

### 3.1 Theme Interface Contract

Every theme inside `consumer-storefront/` must export components satisfying this interface:

```typescript
// packages/typescript/theme-engine/src/types/components.ts

export interface ThemeComponents {
  // Required components
  Header: React.FC<HeaderProps>;
  Footer: React.FC<FooterProps>;
  HomePage: React.FC<HomePageProps>;

  // Store-specific (optional for non-store themes)
  ProductListPage?: React.FC<ProductListProps>;
  ProductDetailPage?: React.FC<ProductDetailProps>;
  CartPage?: React.FC<CartProps>;
  CheckoutPage?: React.FC<CheckoutProps>;

  // Portfolio-specific
  ProjectsPage?: React.FC<ProjectsProps>;
  ProjectDetailPage?: React.FC<ProjectDetailProps>;

  // Resume-specific
  ResumePage?: React.FC<ResumeProps>;

  // Landing-specific
  PricingSection?: React.FC<PricingProps>;
  FeaturesSection?: React.FC<FeaturesProps>;
}
```

### 3.2 Theme Config Structure

```typescript
// consumer-storefront/stores/urban-kicks/config.ts

import { ThemeConfig } from '@letbuyy/theme-engine';

export const config: ThemeConfig = {
  id: 'urban-kicks',
  name: 'Urban Kicks',
  category: 'store',

  colors: {
    primary: '#000000',
    secondary: '#FFFFFF',
    accent: '#FF4500',
    background: '#FFFFFF',
    text: '#1A1A2E',
  },

  fonts: {
    heading: 'Oswald',
    body: 'Inter',
  },

  layout: {
    heroStyle: 'fullscreen',
    productGrid: '3-col',
    headerStyle: 'transparent',
  },

  spacing: {
    sectionGap: 64,
    contentMaxWidth: 1200,
  },

  animations: {
    enabled: true,
    hoverScale: 1.02,
    transitionDuration: 300,
  },
};
```

### 3.3 Theme Index Export

```typescript
// consumer-storefront/stores/urban-kicks/index.tsx

import { ThemeComponents } from '@letbuyy/theme-engine';
import { Header } from './components/header';
import { Hero } from './components/hero';
import { ProductGrid } from './components/product-grid';
import { Footer } from './components/footer';
import { HomePage } from './pages/home';
import { ProductListPage } from './pages/products';
import { ProductDetailPage } from './pages/product-detail';
import { CartPage } from './pages/cart';
import { CheckoutPage } from './pages/checkout';

export const UrbanKicksTheme: ThemeComponents = {
  Header,
  Footer,
  HomePage,
  ProductListPage,
  ProductDetailPage,
  CartPage,
  CheckoutPage,
};

export { config } from './config';
export default UrbanKicksTheme;
```

### 3.4 Theme Registry (maps slug → consumer-storefront path)

```typescript
// packages/typescript/theme-engine/src/registry/index.ts

export const THEME_REGISTRY: Record<string, () => Promise<ThemeModule>> = {
  // Store themes
  'urban-kicks':    () => import('consumer-storefront/stores/urban-kicks'),
  'luxe-atelier':   () => import('consumer-storefront/stores/luxe-atelier'),
  'neon-tech':      () => import('consumer-storefront/stores/neon-tech'),
  'natures-basket': () => import('consumer-storefront/stores/natures-basket'),

  // Portfolio themes
  'creative-folio': () => import('consumer-storefront/portfolio/creative-folio'),
  'dark-portfolio': () => import('consumer-storefront/portfolio/dark-portfolio'),

  // Resume themes
  'clean-resume':   () => import('consumer-storefront/resume/clean-resume'),

  // Landing themes
  'saas-launch':    () => import('consumer-storefront/landing/saas-launch'),
};

export type ThemeId = keyof typeof THEME_REGISTRY;
```

### 3.5 Theme Resolver (Dynamic Loading)

```typescript
// apps/web/storefront/src/lib/theme-resolver.ts

import { THEME_REGISTRY } from '@letbuyy/theme-engine';

export async function loadTheme(themeId: string): Promise<ThemeModule> {
  const loader = THEME_REGISTRY[themeId];
  if (!loader) throw new Error(`Theme "${themeId}" not found in registry`);
  return loader();
}

// Used in middleware.ts to resolve subdomain → theme
export function resolveThemeFromSubdomain(subdomain: string): string | null {
  // Demo subdomains map directly to theme IDs
  const demoSubdomains = Object.keys(THEME_REGISTRY);
  if (demoSubdomains.includes(subdomain)) return subdomain;

  return null; // DB lookup needed
}
```

---

## 4. Database Schema

### 4.1 Core Tables

```sql
-- ═══════════════════════════════════════════════════
-- THEME CATALOG
-- ═══════════════════════════════════════════════════
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    long_description TEXT,
    category TEXT NOT NULL CHECK (category IN ('store','portfolio','resume','landing','saas')),
    industry TEXT[],
    theme_preset_id TEXT NOT NULL,
    version TEXT DEFAULT '1.0.0',
    is_active BOOLEAN DEFAULT true,

    -- LetBuyy Integration Pricing
    letbuyy_pricing_type TEXT NOT NULL CHECK (letbuyy_pricing_type IN ('free','one_time','subscription')),
    letbuyy_price_usd DECIMAL(10,2) DEFAULT 0,
    letbuyy_price_inr DECIMAL(10,2) DEFAULT 0,

    -- Standalone Download Pricing
    wordpress_price_usd DECIMAL(10,2) DEFAULT 0,
    shopify_price_usd DECIMAL(10,2) DEFAULT 0,
    html_price_usd DECIMAL(10,2) DEFAULT 0,
    react_price_usd DECIMAL(10,2) DEFAULT 0,

    -- Media
    thumbnail_url TEXT,
    preview_url TEXT,
    screenshots TEXT[] DEFAULT '{}',
    demo_url TEXT,

    -- Customization
    demo_store_config JSONB,
    customizable_sections JSONB DEFAULT '{}',
    color_presets JSONB DEFAULT '[]',
    font_options TEXT[] DEFAULT '{}',

    -- Author
    author_id TEXT,
    author_name TEXT DEFAULT 'LetBuyy Team',

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    features TEXT[] DEFAULT '{}',
    supported_platforms TEXT[] DEFAULT '{letbuyy}',
    rating DECIMAL(2,1) DEFAULT 0,
    review_count INT DEFAULT 0,
    install_count INT DEFAULT 0,
    download_count INT DEFAULT 0,
    purchase_count INT DEFAULT 0,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- THEME VERSIONS
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    version TEXT NOT NULL,
    changelog TEXT,
    breaking_changes TEXT[],
    min_app_version TEXT,
    file_url TEXT,
    file_size_bytes BIGINT,
    checksum TEXT,
    released_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(theme_id, version)
);

-- ═══════════════════════════════════════════════════
-- PURCHASES
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    theme_id UUID REFERENCES themes(id),
    purchase_type TEXT NOT NULL CHECK (purchase_type IN (
        'letbuyy_integration','wordpress','shopify','html','react','bundle','subscription'
    )),
    payment_provider TEXT CHECK (payment_provider IN ('stripe','razorpay','free')),
    payment_intent_id TEXT,
    payment_status TEXT DEFAULT 'completed',
    amount_paid DECIMAL(10,2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    coupon_code TEXT,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    refund_status TEXT CHECK (refund_status IN ('none','requested','approved','refunded')),
    refunded_at TIMESTAMPTZ,
    purchased_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- INSTALLATIONS (Store-Theme Binding)
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    theme_id UUID REFERENCES themes(id),
    purchase_id UUID REFERENCES theme_purchases(id),
    version_installed TEXT,
    is_active BOOLEAN DEFAULT false,
    customizations JSONB DEFAULT '{}',
    installed_at TIMESTAMPTZ DEFAULT NOW(),
    activated_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════
-- DOWNLOADS (Platform Exports)
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    theme_id UUID REFERENCES themes(id),
    purchase_id UUID REFERENCES theme_purchases(id),
    platform TEXT NOT NULL CHECK (platform IN ('wordpress','shopify','html','react')),
    version TEXT,
    download_url TEXT,
    download_count INT DEFAULT 0,
    max_downloads INT DEFAULT 5,
    fingerprint TEXT,
    expires_at TIMESTAMPTZ,
    first_downloaded_at TIMESTAMPTZ,
    last_downloaded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- REVIEWS
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    helpful_count INT DEFAULT 0,
    is_verified_purchase BOOLEAN DEFAULT false,
    admin_response TEXT,
    admin_responded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(theme_id, user_id)
);

-- ═══════════════════════════════════════════════════
-- COLLECTIONS (Curated Bundles)
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    is_featured BOOLEAN DEFAULT false,
    bundle_price_usd DECIMAL(10,2),
    discount_percentage INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collection_themes (
    collection_id UUID REFERENCES theme_collections(id) ON DELETE CASCADE,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    PRIMARY KEY (collection_id, theme_id)
);

-- ═══════════════════════════════════════════════════
-- SUBSCRIPTIONS
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    plan TEXT NOT NULL CHECK (plan IN ('starter','pro','agency','enterprise')),
    provider TEXT CHECK (provider IN ('stripe','razorpay')),
    provider_subscription_id TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','past_due','paused')),
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    cancel_at_period_end BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Advanced Tables

```sql
-- ═══════════════════════════════════════════════════
-- ANALYTICS
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'view','preview','install','uninstall','purchase','download','customize','review'
    )),
    user_id TEXT,
    site_id TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- A/B TESTS
-- ═══════════════════════════════════════════════════
CREATE TABLE theme_ab_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id TEXT NOT NULL,
    theme_a_id UUID REFERENCES themes(id),
    theme_b_id UUID REFERENCES themes(id),
    traffic_split DECIMAL(3,2) DEFAULT 0.50,
    metric TEXT DEFAULT 'conversion_rate',
    status TEXT DEFAULT 'running' CHECK (status IN ('draft','running','completed','cancelled')),
    winner_theme_id UUID REFERENCES themes(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ
);

-- ═══════════════════════════════════════════════════
-- AUDIT LOGS
-- ═══════════════════════════════════════════════════
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- LICENSES
-- ═══════════════════════════════════════════════════
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES theme_purchases(id) ON DELETE CASCADE,
    license_key TEXT UNIQUE NOT NULL,
    license_type TEXT NOT NULL CHECK (license_type IN (
        'single_site','multi_site','unlimited','agency','enterprise'
    )),
    max_activations INT DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE license_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    site_id TEXT NOT NULL,
    site_url TEXT,
    site_fingerprint TEXT,
    activated_at TIMESTAMPTZ DEFAULT NOW(),
    deactivated_at TIMESTAMPTZ,
    UNIQUE(license_id, site_id)
);

-- ═══════════════════════════════════════════════════
-- WISHLISTS
-- ═══════════════════════════════════════════════════
CREATE TABLE wishlists (
    user_id TEXT NOT NULL,
    theme_id UUID REFERENCES themes(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, theme_id)
);

-- ═══════════════════════════════════════════════════
-- SUPPORT
-- ═══════════════════════════════════════════════════
CREATE TABLE support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    theme_id UUID REFERENCES themes(id),
    subject TEXT NOT NULL,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE TABLE support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL,
    sender_type TEXT CHECK (sender_type IN ('user','admin','system')),
    message TEXT NOT NULL,
    attachments TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.3 Indexes & RLS Policies

```sql
-- ═══════════════════ INDEXES ═══════════════════════
CREATE INDEX idx_themes_category ON themes(category);
CREATE INDEX idx_themes_active ON themes(is_active) WHERE is_active = true;
CREATE INDEX idx_themes_pricing ON themes(letbuyy_pricing_type);
CREATE INDEX idx_themes_rating ON themes(rating DESC);
CREATE INDEX idx_themes_slug ON themes(slug);

CREATE INDEX idx_purchases_user ON theme_purchases(user_id);
CREATE INDEX idx_purchases_theme ON theme_purchases(theme_id);
CREATE INDEX idx_purchases_payment ON theme_purchases(payment_intent_id);

CREATE INDEX idx_installations_site ON theme_installations(site_id);
CREATE INDEX idx_installations_active ON theme_installations(site_id, is_active) WHERE is_active = true;
CREATE INDEX idx_installations_user ON theme_installations(user_id);

CREATE INDEX idx_downloads_user ON theme_downloads(user_id);
CREATE INDEX idx_reviews_theme ON theme_reviews(theme_id);
CREATE INDEX idx_analytics_theme ON theme_analytics(theme_id, event_type);
CREATE INDEX idx_analytics_created ON theme_analytics(created_at);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_subscriptions_user ON theme_subscriptions(user_id);

-- ═══════════════════ RLS POLICIES ══════════════════
ALTER TABLE theme_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- Users can view own purchases
CREATE POLICY "Users view own purchases" ON theme_purchases
    FOR SELECT USING (auth.uid()::TEXT = user_id);

-- Users can manage own installations
CREATE POLICY "Users manage own installations" ON theme_installations
    FOR ALL USING (auth.uid()::TEXT = user_id);

-- Users can view own downloads
CREATE POLICY "Users view own downloads" ON theme_downloads
    FOR SELECT USING (auth.uid()::TEXT = user_id);

-- Verified purchasers can create reviews
CREATE POLICY "Verified purchasers create reviews" ON theme_reviews
    FOR INSERT WITH CHECK (
        auth.uid()::TEXT = user_id AND
        EXISTS (SELECT 1 FROM theme_purchases WHERE user_id = auth.uid()::TEXT AND theme_id = theme_reviews.theme_id)
    );

-- Anyone can read published reviews
CREATE POLICY "Public read reviews" ON theme_reviews
    FOR SELECT USING (true);

-- Users manage own wishlists
CREATE POLICY "Users manage wishlists" ON wishlists
    FOR ALL USING (auth.uid()::TEXT = user_id);

-- Users manage own subscriptions
CREATE POLICY "Users view own subscriptions" ON theme_subscriptions
    FOR SELECT USING (auth.uid()::TEXT = user_id);

-- Users manage own support tickets
CREATE POLICY "Users manage own tickets" ON support_tickets
    FOR ALL USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users view own messages" ON support_messages
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM support_tickets WHERE id = support_messages.ticket_id AND user_id = auth.uid()::TEXT)
    );
```

---

## 5. Authentication & Security

### 5.1 Auth Flow

- **Auth Hub:** `accounts.letbuyy.store` — centralized Supabase Auth with shared `.letbuyy.store` cookies
- **Deferred Auth:** No login required until checkout/install actions
- **Methods:** Email/password, Google OAuth, GitHub OAuth, 2FA (TOTP)
- **Session:** JWT tokens with Supabase RLS, PKCE flow for enhanced security

```
User clicks "Install" / "Buy"
    ↓
Auth Check (middleware)
    ↓
Not logged in → redirect to accounts.letbuyy.store/login?redirect=...
    ↓
Login (Supabase Auth) → Set .letbuyy.store cookie
    ↓
Redirect back → Continue checkout/install flow
```

### 5.2 Authorization Roles

| Role | Permissions |
|------|-------------|
| **anonymous** | Browse gallery, view demos, read reviews |
| **user** | Purchase, install, customize, review, download |
| **subscriber** | All user + unlimited theme access per plan tier |
| **admin** | Theme CRUD, review moderation, analytics, license management |
| **super_admin** | All admin + user management, settings, billing |

### 5.3 Security Layers

| Layer | Implementation |
|-------|----------------|
| **Network** | Cloudflare WAF, Rate Limiting (Upstash Redis), IP Whitelisting (admin) |
| **Application** | CSP Headers, CORS, CSRF Tokens, Input Sanitization (DOMPurify) |
| **Authentication** | Supabase Auth (OAuth 2.0 + PKCE), 2FA (TOTP), JWT sessions, RLS |
| **Data** | Encryption at rest/transit (TLS 1.3), PII masking, Audit logging |
| **Licensing** | JWT-signed keys, Site fingerprinting, Download watermarking |

### 5.4 CSP Headers

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

### 5.5 Rate Limiting (per route)

| Route Pattern | Limit | Window |
|---------------|-------|--------|
| `GET /api/themes` | 100 req | 1 min |
| `GET /api/themes/[slug]` | 60 req | 1 min |
| `POST /api/checkout/*` | 10 req | 1 min |
| `POST /api/webhooks/*` | 50 req | 1 min |
| `POST /api/reviews` | 5 req | 1 min |
| `GET /api/downloads/*` | 20 req | 1 min |
| `POST /api/licenses/validate` | 30 req | 1 min |

### 5.6 License Validation System

```typescript
// packages/typescript/licensing/src/validate.ts
interface LicenseValidation {
  isValid: boolean;
  licenseType: 'single_site' | 'multi_site' | 'unlimited' | 'agency' | 'enterprise';
  activationsUsed: number;
  maxActivations: number;
  expiresAt: string | null;
  themeId: string;
}

export async function validateLicense(
  licenseKey: string,
  siteFingerprint: string
): Promise<LicenseValidation> {
  // 1. Decode JWT-signed license key
  // 2. Check license exists and is active
  // 3. Verify site fingerprint against activations
  // 4. Check activation limit not exceeded
  // 5. Check expiry date (if applicable)
  // 6. Return validation result
}
```

---

## 6. Theme Engine

## 6. Theme Engine

### 6.1 Core Renderer

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
  return { components, config, metadata: themeEntry.metadata };
}
```

### 6.2 ThemeComponents Interface

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
    primary: string; secondary: string; accent: string;
    background?: string; text?: string; muted?: string;
  };
  fonts: { heading: string; body: string; mono?: string; };
  layout: {
    heroStyle: 'fullscreen' | 'split' | 'minimal' | 'video' | 'carousel';
    productGrid: '2-col' | '3-col' | '4-col' | 'masonry';
    headerStyle?: 'transparent' | 'solid' | 'floating';
    footerStyle?: 'minimal' | 'full' | 'mega';
  };
  spacing?: { sectionGap: number; contentMaxWidth: number; };
  animations?: { pageTransition: 'fade' | 'slide' | 'none'; scrollReveal: boolean; hoverEffects: boolean; };
}

export interface ThemeMetadata {
  version: string; author: string; screenshots: string[];
  previewUrl?: string; documentation?: string; changelog?: string; minAppVersion?: string;
}
```

---

## 7. Theme Resolver & Middleware

### 7.1 Resolver Flow

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

### 7.2 Resolver Implementation

```typescript
// apps/web/storefront/src/lib/theme-resolver.ts

import { THEME_REGISTRY, ThemeComponents } from '@letbuyy/theme-engine';
import { createServerClient } from '@/lib/supabase/server';

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

### 7.3 Middleware Integration

```typescript
// apps/web/storefront/middleware.ts

import { NextRequest, NextResponse } from 'next/server';

const DEMO_SUBDOMAINS = [
  'urban-kicks', 'luxe-atelier', 'neon-tech', 'natures-basket',
  'creative-folio', 'clean-resume', 'saas-launch',
];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const subdomain = hostname.split('.')[0];

  if (subdomain === 'www' || subdomain === 'letbuyy') return NextResponse.next();

  const response = NextResponse.next();
  response.headers.set('x-subdomain', subdomain);
  response.headers.set('x-is-demo', DEMO_SUBDOMAINS.includes(subdomain) ? 'true' : 'false');
  return response;
}
```

---

## 8. API Architecture

### 8.1 Endpoints

| Method | Endpoint | Purpose | Auth |
|--------|----------|---------|------|
| GET | `/api/themes` | List + filter + search themes | No |
| GET | `/api/themes/[slug]` | Theme detail with reviews | No |
| GET | `/api/themes/search?q=` | Full-text search | No |
| POST | `/api/themes/[slug]/reviews` | Submit review | Yes |
| GET | `/api/themes/[slug]/reviews` | List reviews | No |
| POST | `/api/checkout/create-session` | Stripe checkout session | Yes |
| POST | `/api/checkout/razorpay/create-order` | Razorpay order | Yes |
| POST | `/api/checkout/razorpay/verify` | Verify Razorpay payment | Yes |
| POST | `/api/webhooks/stripe` | Stripe payment webhook | Webhook |
| POST | `/api/webhooks/razorpay` | Razorpay payment webhook | Webhook |
| GET | `/api/user/purchases` | User's purchased themes | Yes |
| POST | `/api/installations` | Install theme to store | Yes |
| DELETE | `/api/installations/[id]` | Uninstall theme | Yes |
| PUT | `/api/installations/[id]/activate` | Activate theme on store | Yes |
| PUT | `/api/installations/[id]/customize` | Save customizations | Yes |
| GET | `/api/downloads/[purchaseId]/[platform]` | Download WP/Shopify/HTML | Yes |
| POST | `/api/licenses/validate` | Validate license key | Yes |
| POST | `/api/licenses/activate` | Activate on new site | Yes |
| POST | `/api/licenses/deactivate` | Deactivate from site | Yes |
| GET | `/api/subscriptions` | User's subscription | Yes |
| POST | `/api/subscriptions/create` | Create subscription | Yes |
| POST | `/api/subscriptions/cancel` | Cancel subscription | Yes |
| GET | `/api/wishlists` | User's wishlist | Yes |
| POST | `/api/wishlists` | Add to wishlist | Yes |
| DELETE | `/api/wishlists/[themeId]` | Remove from wishlist | Yes |

---

## 9. UI Wireframes — Marketplace Pages

### 9.1 Theme Gallery (`themes.letbuyy.store`)

```
┌────────────────────────────────────────────────────────────────────┐
│ 🎨 LetBuyy Themes   [Store] [Portfolio] [Resume] [Landing]  [👤] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌──── HERO ─────────────────────────────────────────────────────┐ │
│  │  ✨ Beautiful themes for every kind of website                │ │
│  │  Launch your store, portfolio, or landing page in minutes     │ │
│  │  [Browse Free]    [View Premium →]                            │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  Category: [All▾]  Price: [All▾]  Sort: [Popular▾]  🔍           │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │  THUMBNAIL   │  │  THUMBNAIL   │  │  THUMBNAIL   │            │
│  │ [Preview]    │  │ [Preview]    │  │ [Preview]    │            │
│  │ Urban Kicks  │  │ Luxe Atelier │  │ Neon Tech    │            │
│  │ ⭐4.8 (124)  │  │ ⭐4.9 (89)   │  │ ⭐4.7 (67)   │            │
│  │ FREE         │  │ $49          │  │ $39          │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │Nature Basket │  │Creative Folio│  │ Clean Resume │            │
│  │ FREE         │  │ $29          │  │ FREE         │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 9.2 Theme Detail Page

```
┌────────────────────────────────────────────────────────────────────┐
│ 🎨 LetBuyy Themes   ← Back to Themes                       [👤] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌───────────────────────┬─────────────────────────────────────┐   │
│ │                       │  Urban Kicks                        │   │
│ │   MAIN SCREENSHOT     │  ⭐⭐⭐⭐⭐ 4.8 (124 reviews)         │   │
│ │   (large preview)     │  by LetBuyy Team · v1.0.0          │   │
│ │                       │                                     │   │
│ │ ┌────┐ ┌────┐ ┌────┐ │  Price: FREE                        │   │
│ │ │ss1 │ │ss2 │ │ss3 │ │                                     │   │
│ │ └────┘ └────┘ └────┘ │  [🔴 Install Now]  [👁 Live Demo]   │   │
│ └───────────────────────┴─────────────────────────────────────┘   │
│                                                                    │
│ [Overview] [Features] [Reviews (124)] [Changelog]                  │
│ ─────────────────────────────────────────────────                  │
│ ✅ Full-width Hero  ✅ Product Grid  ✅ Cart & Checkout             │
│ ✅ Testimonials  ✅ Mobile Responsive  ✅ SEO Ready                 │
│ ✅ Animations  ✅ Multi-payment (Stripe + Razorpay)                 │
│                                                                    │
│ Related: [Luxe Atelier] [Neon Tech] [Nature's Basket]              │
└────────────────────────────────────────────────────────────────────┘
```

### 9.3 User Dashboard

```
┌────────────────────────────────────────────────────────────────────┐
│ 🎨 Dashboard                                               [👤] │
├──────────┬─────────────────────────────────────────────────────────┤
│          │                                                         │
│ 📦 Themes│  My Purchased Themes                                   │
│ 🏪 Stores│  ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│ ⬇ Download│  │ Urban    │ │ Neon     │ │ Creative │               │
│ ⚙ Settings│  │ Kicks    │ │ Tech     │ │ Folio    │               │
│ 💳 Billing│  │ ✅ Active │ │ 💤 Idle  │ │ ✅ Active│               │
│          │  │[Customize]│ │[Apply]   │ │[Customize│               │
│          │  └──────────┘ └──────────┘ └──────────┘               │
│          │                                                         │
│          │  My Stores                                              │
│          │  ┌──────────────────────────────────────┐               │
│          │  │ mystore.letbuyy.store                │               │
│          │  │ Theme: Urban Kicks · Published       │               │
│          │  │ [Change Theme] [Customize] [Visit]   │               │
│          │  └──────────────────────────────────────┘               │
│          │                                                         │
└──────────┴─────────────────────────────────────────────────────────┘
```

---

## 10. UI Wireframes — Store Themes

### 10.1 Urban Kicks (`consumer-storefront/stores/urban-kicks/`)

**Aesthetic:** Bold · Minimal · Black/White · Streetwear  
**Colors:** `#000000` primary, `#FFFFFF` bg, `#FF4500` accent  
**Fonts:** Oswald (headings), Inter (body)

```
┌────────────────────────────────────────────────────────────────────┐
│ URBAN KICKS        [Shop] [Collections] [About]       🔍  🛒 (2) │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (full-screen, dark overlay on bg image) ──────────────┐ │
│ │                                                                 │ │
│ │         S T R E E T W E A R  2 0 2 6                           │ │
│ │         The future of fashion is here.                         │ │
│ │                                                                 │ │
│ │              [ SHOP NEW ARRIVALS → ]                           │ │
│ │                                                                 │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  TRENDING NOW                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │          │
│  │ │      │ │  │ │      │ │  │ │      │ │  │ │      │ │          │
│  │ │ SHOE │ │  │ │HOODIE│ │  │ │ TEE  │ │  │ │ CAP  │ │          │
│  │ │ IMG  │ │  │ │ IMG  │ │  │ │ IMG  │ │  │ │ IMG  │ │          │
│  │ │      │ │  │ │      │ │  │ │      │ │  │ │      │ │          │
│  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │          │
│  │ Air Max  │  │ Street H │  │ Logo Tee │  │ Snap Cap │          │
│  │ $129.00  │  │ $89.00   │  │ $45.00   │  │ $35.00   │          │
│  │[Add Cart]│  │[Add Cart]│  │[Add Cart]│  │[Add Cart]│          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                    │
│  ┌──── COLLECTION BANNER ────────────────────────────────────────┐ │
│  │  NEW DROP: Cyber Punk Collection │ [Shop Collection →]        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  WHAT PEOPLE SAY                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ "Best kicks   │  │ "Amazing     │  │ "Fast ship,  │            │
│  │  store ever!" │  │  quality!"   │  │  love it!"   │            │
│  │  — Alex M.    │  │  — Sarah K.  │  │  — Jay R.    │            │
│  │  ⭐⭐⭐⭐⭐       │  │  ⭐⭐⭐⭐⭐       │  │  ⭐⭐⭐⭐⭐       │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                    │
│  ┌──── FOOTER ─────────────────────────────────────────────────┐  │
│  │  Urban Kicks │ Shop │ About │ Contact │ Terms │ Privacy     │  │
│  │  © 2026      │ Instagram │ Twitter │ TikTok               │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 10.2 Luxe Atelier (`consumer-storefront/stores/luxe-atelier/`)

**Aesthetic:** Luxury · Elegant · Serif · Gold accents  
**Colors:** `#1A1A1A` primary, `#FAF8F5` bg, `#C9A96E` gold accent  
**Fonts:** Playfair Display (headings), Lato (body)

```
┌────────────────────────────────────────────────────────────────────┐
│  L U X E  A T E L I E R          [Women] [Men] [Accessories]  👤 │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (split layout: text left, model right) ───────────────┐ │
│ │                           │                                     │ │
│ │  Spring / Summer          │   ┌────────────────────────────┐   │ │
│ │  Collection '26           │   │                            │   │ │
│ │                           │   │     MODEL EDITORIAL        │   │ │
│ │  Timeless elegance        │   │     PHOTO                  │   │ │
│ │  meets modern luxury      │   │                            │   │ │
│ │                           │   │                            │   │ │
│ │  [ DISCOVER NOW ]         │   └────────────────────────────┘   │ │
│ │                           │                                     │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  ─── CURATED SELECTION ────────────────────────                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │          │  │          │  │          │                          │
│  │ SILK     │  │ LEATHER  │  │ CASHMERE │                        │
│  │ DRESS    │  │ BAG      │  │ COAT     │                        │
│  │          │  │          │  │          │                          │
│  │ $890.00  │  │ $1,290   │  │ $2,450   │                        │
│  └──────────┘  └──────────┘  └──────────┘                        │
│                                                                    │
│  ─── ATELIER STORY ────────────────────────────────────────────    │
│  │  "Where craftsmanship meets contemporary design..."          │  │
│  │  [ Read Our Story → ]                                        │  │
│                                                                    │
│  ┌────── FOOTER (gold divider) ────────────────────────────────┐  │
│  │  Luxe Atelier │ Paris │ London │ New York                   │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 10.3 Neon Tech (`consumer-storefront/stores/neon-tech/`)

**Aesthetic:** Cyberpunk · Dark · Neon gradients · Futuristic  
**Colors:** `#0A0A0F` bg, `#00FF88` neon green, `#FF006E` neon pink  
**Fonts:** Space Grotesk (headings), IBM Plex Mono (body)

```
┌────────────────────────────────────────────────────────────────────┐
│ ⚡ NEON TECH    [Laptops] [Phones] [Audio] [Gaming]    🔍  🛒  │
│ ══════════════════════ neon green underline ════════════════════   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (gradient bg: dark → neon glow) ──────────────────────┐│
│ │                                                                 ││
│ │    THE FUTURE IS     ░░▓▓████ NEON ████▓▓░░                   ││
│ │    Next-gen tech at unreal prices                              ││
│ │                                                                 ││
│ │    [ BROWSE DEALS ⚡ ]                                         ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ┌─ FLASH DEALS (countdown timer) ────────────────────────────┐   │
│  │  ⏰ 03:24:15 remaining                                     │   │
│  │  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐           │   │
│  │  │Laptop  │  │Phone   │  │Headset │  │Console │           │   │
│  │  │-40%    │  │-25%    │  │-50%    │  │-30%    │           │   │
│  │  │$599    │  │$449    │  │$99     │  │$349    │           │   │
│  │  └────────┘  └────────┘  └────────┘  └────────┘           │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                    │
│  CATEGORIES                                                        │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                             │
│  │💻    │ │📱    │ │🎧    │ │🎮    │                             │
│  │Laptop│ │Phones│ │Audio │ │Gaming│                             │
│  └──────┘ └──────┘ └──────┘ └──────┘                             │
│                                                                    │
│  ┌──── FOOTER (neon border top) ───────────────────────────────┐  │
│  │  ⚡ Neon Tech │ Support │ Track Order │ Returns             │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 10.4 Nature's Basket (`consumer-storefront/stores/natures-basket/`)

**Aesthetic:** Earthy · Organic · Warm · Natural textures  
**Colors:** `#2D5016` forest green, `#FFF8F0` cream bg, `#D4A574` warm brown  
**Fonts:** DM Serif Display (headings), Nunito (body)

```
┌────────────────────────────────────────────────────────────────────┐
│ 🌿 Nature's Basket    [Shop] [Recipes] [About Us]    🛒 (3)     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (warm photo bg, leaf overlay) ────────────────────────┐│
│ │                                                                 ││
│ │   Farm Fresh, Delivered Daily 🌱                               ││
│ │   100% Organic. Zero Compromise.                               ││
│ │                                                                 ││
│ │   [ SHOP ORGANIC 🌿 ]                                         ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  SHOP BY CATEGORY                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 🥦       │  │ 🍎       │  │ 🥛       │  │ 🌾       │          │
│  │Vegetables│  │ Fruits   │  │ Dairy    │  │ Grains   │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│                                                                    │
│  BESTSELLERS                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                        │
│  │ Avocado  │  │ Almond   │  │ Quinoa   │                        │
│  │ Box (6)  │  │ Milk 1L  │  │ 500g     │                        │
│  │ $12.99   │  │ $4.99    │  │ $8.49    │                        │
│  │[Add Cart]│  │[Add Cart]│  │[Add Cart]│                        │
│  └──────────┘  └──────────┘  └──────────┘                        │
│                                                                    │
│  ┌──── FOOTER (leaf pattern border) ───────────────────────────┐  │
│  │  🌿 Nature's Basket │ FAQ │ Delivery │ Sustainability       │  │
│  └─────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 11. UI Wireframes — Portfolio Themes

### 11.1 Creative Folio (`consumer-storefront/portfolio/creative-folio/`)

**Aesthetic:** Creative · Colorful · Grid-based · Playful  
**Colors:** `#1A1A2E` dark bg, `#E94560` red accent, `#0F3460` blue  
**Fonts:** Sora (headings), Inter (body)

```
┌────────────────────────────────────────────────────────────────────┐
│ CREATIVE FOLIO       [Work] [About] [Contact]           ☰ (mob) │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (animated gradient bg) ───────────────────────────────┐│
│ │                                                                 ││
│ │   Hi, I'm Sarah Chen 👋                                       ││
│ │   Digital Designer & Creative Director                         ││
│ │                                                                 ││
│ │   I craft digital experiences that                             ││
│ │   blend art with technology.                                   ││
│ │                                                                 ││
│ │   [ VIEW MY WORK ]    [ SAY HELLO ]                            ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  SELECTED WORK                                                     │
│  ┌───────────────────┐  ┌───────────────────┐                     │
│  │                   │  │                   │                     │
│  │   PROJECT 1 IMG   │  │   PROJECT 2 IMG   │                     │
│  │   ───────────     │  │   ───────────     │                     │
│  │   Nike Redesign   │  │   Spotify Viz     │                     │
│  │   UI/UX · 2026    │  │   Data Art · 2025 │                     │
│  │                   │  │                   │                     │
│  └───────────────────┘  └───────────────────┘                     │
│  ┌───────────────────┐  ┌───────────────────┐                     │
│  │   PROJECT 3 IMG   │  │   PROJECT 4 IMG   │                     │
│  │   ───────────     │  │   ───────────     │                     │
│  │   Brand Identity  │  │   Mobile App      │                     │
│  │   Branding · 2025 │  │   iOS · 2025      │                     │
│  └───────────────────┘  └───────────────────┘                     │
│                                                                    │
│  SKILLS                                                            │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │Figma   │ │React   │ │Motion  │ │3D      │ │Brand   │          │
│  │ ████░░ │ │ ███░░░ │ │ ████░░ │ │ ██░░░░ │ │ █████░ │          │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘          │
│                                                                    │
│  ┌──── CONTACT ────────────────────────────────────────────────┐  │
│  │  Let's work together!                                       │  │
│  │  [Name: ________] [Email: ________]                         │  │
│  │  [Message: ________________________________]                 │  │
│  │  [ SEND MESSAGE → ]                                         │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  FOOTER: Twitter · Dribbble · LinkedIn · GitHub                    │
└────────────────────────────────────────────────────────────────────┘
```

### 11.2 Dark Portfolio (`consumer-storefront/portfolio/dark-portfolio/`)

**Aesthetic:** Minimal · Dark · Monochrome · Developer/Photographer  
**Colors:** `#0D0D0D` bg, `#FFFFFF` text, `#333` card bg  
**Fonts:** JetBrains Mono (headings), Inter (body)

```
┌────────────────────────────────────────────────────────────────────┐
│                                               [Work] [About] [CV] │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (pure black, white text, cursor blink) ───────────────┐│
│ │                                                                 ││
│ │   > Alex Rivera_                                               ││
│ │   > Full-Stack Developer                                       ││
│ │   > Building the web, one pixel at a time.                     ││
│ │                                                                 ││
│ │   [ PROJECTS ]    [ GITHUB ↗ ]                                 ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  PROJECTS ─────────────────────────────────────                    │
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │  01  │ SyncBoard — Real-time collaboration tool            │   │
│  │      │ React · WebSocket · Redis                           │   │
│  │      │ [ View → ]                                          │   │
│  ├──────┼─────────────────────────────────────────────────────┤   │
│  │  02  │ PixelForge — AI image editor                        │   │
│  │      │ Python · TensorFlow · Next.js                      │   │
│  │      │ [ View → ]                                          │   │
│  ├──────┼─────────────────────────────────────────────────────┤   │
│  │  03  │ CloudDash — Infrastructure monitoring              │   │
│  │      │ Go · Prometheus · Grafana                          │   │
│  │      │ [ View → ]                                          │   │
│  └──────┴─────────────────────────────────────────────────────┘   │
│                                                                    │
│  FOOTER: minimal — email · github · twitter                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 12. UI Wireframes — Resume & Landing Themes

### 12.1 Clean Resume (`consumer-storefront/resume/clean-resume/`)

**Aesthetic:** Professional · Clean · Print-ready · ATS-friendly  
**Colors:** `#1E293B` dark navy, `#F8FAFC` white bg, `#3B82F6` blue accent  
**Fonts:** Merriweather (headings), Source Sans Pro (body)

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌──── HEADER CARD ──────────────────────────────────────────────┐│
│  │  ┌──────┐                                                      ││
│  │  │PHOTO │  JOHN DOE                                           ││
│  │  │      │  Senior Software Engineer                           ││
│  │  └──────┘  📧 john@email.com │ 📱 +1-234-567 │ 📍 NYC        ││
│  │            [LinkedIn] [GitHub] [Portfolio]                     ││
│  │            [ ⬇ Download PDF ]                                  ││
│  └────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  ┌── LEFT COL ──────┐  ┌── RIGHT COL ─────────────────────────┐  │
│  │                   │  │                                      │  │
│  │  SKILLS           │  │  EXPERIENCE                          │  │
│  │  ─────────        │  │  ──────────                          │  │
│  │  ■■■■■░ React     │  │  ● Google — Sr. Engineer             │  │
│  │  ■■■■░░ TypeScript│  │    2023 - Present                    │  │
│  │  ■■■■■░ Node.js   │  │    Led team of 8 engineers...        │  │
│  │  ■■■░░░ Python    │  │                                      │  │
│  │  ■■■■░░ AWS       │  │  ● Meta — Software Engineer          │  │
│  │                   │  │    2020 - 2023                        │  │
│  │  EDUCATION        │  │    Built real-time features...        │  │
│  │  ─────────        │  │                                      │  │
│  │  MIT — CS, 2020   │  │  ● Startup — Founding Engineer       │  │
│  │  Stanford — AI    │  │    2018 - 2020                        │  │
│  │                   │  │    Architected microservices...       │  │
│  │  CERTIFICATIONS   │  │                                      │  │
│  │  ─────────        │  │  PROJECTS                            │  │
│  │  AWS Solutions    │  │  ──────────                          │  │
│  │  Google Cloud     │  │  • OpenAI CLI Tool (5k+ stars)       │  │
│  │  K8s Admin        │  │  • Real-time Dashboard Framework     │  │
│  │                   │  │                                      │  │
│  └───────────────────┘  └──────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### 12.2 SaaS Launch (`consumer-storefront/landing/saas-launch/`)

**Aesthetic:** Modern SaaS · Gradient · Trust-building · Conversion  
**Colors:** `#0F172A` dark bg, `#6366F1` indigo, `#22D3EE` cyan accent  
**Fonts:** Cal Sans (headings), Inter (body)

```
┌────────────────────────────────────────────────────────────────────┐
│ 🚀 SaaSName   [Features] [Pricing] [Docs] [Blog]   [Get Started]│
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│ ┌──── HERO (gradient: indigo → cyan) ────────────────────────────┐│
│ │                                                                 ││
│ │   Ship faster with AI-powered workflows                        ││
│ │   The platform that 10x your team's productivity              ││
│ │                                                                 ││
│ │   [Get Started Free]    [Watch Demo ▶]                         ││
│ │                                                                 ││
│ │   ✓ No credit card  ✓ 14-day trial  ✓ Cancel anytime          ││
│ │                                                                 ││
│ └─────────────────────────────────────────────────────────────────┘│
│                                                                    │
│  TRUSTED BY   [Google] [Stripe] [Vercel] [Figma] [Notion]        │
│                                                                    │
│  FEATURES                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ ⚡ Speed      │  │ 🔒 Security  │  │ 📊 Analytics │            │
│  │ 10x faster   │  │ Enterprise   │  │ Real-time    │            │
│  │ workflows    │  │ grade auth   │  │ dashboards   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                    │
│  PRICING                                                           │
│  ┌──────────┐  ┌──────────────┐  ┌──────────┐                    │
│  │ Starter  │  │ ⭐ Pro        │  │ Enterprise│                    │
│  │ $0/mo    │  │ $29/mo       │  │ Custom    │                    │
│  │ 3 users  │  │ Unlimited    │  │ Unlimited │                    │
│  │ 1GB      │  │ 100GB        │  │ Unlimited │                    │
│  │[Start]   │  │[Start Trial] │  │[Contact]  │                    │
│  └──────────┘  └──────────────┘  └──────────┘                    │
│                                                                    │
│  TESTIMONIALS                                                      │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ "Transformed our workflow. We shipped 3x faster."            │ │
│  │  — CEO, TechStartup │ ⭐⭐⭐⭐⭐                                │ │
│  └──────────────────────────────────────────────────────────────┘ │
│                                                                    │
│  CTA: [Start Your Free Trial Today →]                              │
│                                                                    │
│  FOOTER: Product · Company · Resources · Legal                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 13. Theme Customizer

```typescript
// Interface for theme customization options
export interface CustomizationOptions {
  colors: { primary: string; secondary: string; accent: string; background: string; };
  fonts: { heading: string; body: string; };
  layout: { heroStyle: 'fullscreen' | 'split' | 'centered';
            headerStyle: 'transparent' | 'solid' | 'minimal';
            productGrid: '2-col' | '3-col' | '4-col'; };
  sections: { showHero: boolean; showTestimonials: boolean;
              showNewsletter: boolean; showCategories: boolean; };
}

// Live customizer sends changes via PostMessage to iframe preview
// CSS variables are generated server-side and injected into the theme
```

---

## 14. Multi-Platform Support

| Platform | Format | Additional Price |
|----------|--------|-----------------|
| LetBuyy (native) | React/Next.js components | Included |
| WordPress | PHP theme + WooCommerce | +$49 |
| Shopify | Liquid templates | +$59 |
| HTML/CSS | Static export | +$39 |
| All platforms | Bundle | +$99 |

```
Theme Engine → theme-converter package → Platform-specific output
  ├── WordPress: PHP templates + functions.php + style.css
  ├── Shopify:   Liquid templates + schema + sections
  └── HTML:      Static HTML + CSS + vanilla JS
```

---

## 15. Admin Panel (`themes-admin.letbuyy.store`)

```
┌────────────────────────────────────────────────────────────────────┐
│ THEME ADMIN                                          [Super Admin]│
├──────────┬─────────────────────────────────────────────────────────┤
│          │                                                         │
│ 📊 Dash  │  Theme Management                                     │
│ 🎨 Themes│  ──────────────────                                    │
│ 📦 Orders│  Total: 8 │ Active: 7 │ Draft: 1                      │
│ 👥 Users │                                                         │
│ 📈 Stats │  ┌──────┬──────────┬──────┬────────┬──────────┐       │
│ ⚙ Config │  │ Name │ Category │ Price│ Rating │ Installs │       │
│          │  ├──────┼──────────┼──────┼────────┼──────────┤       │
│          │  │Urban │ Store    │ FREE │ 4.8    │ 1,234    │       │
│          │  │Luxe  │ Store    │ $49  │ 4.9    │ 567      │       │
│          │  │Neon  │ Store    │ $39  │ 4.7    │ 890      │       │
│          │  │Clean │ Resume   │ FREE │ 4.9    │ 2,100    │       │
│          │  │SaaS  │ Landing  │ $59  │ 4.6    │ 445      │       │
│          │  └──────┴──────────┴──────┴────────┴──────────┘       │
│          │                                                         │
│          │  [+ Add Theme]  [Manage Reviews]  [Export Data]         │
│          │                                                         │
└──────────┴─────────────────────────────────────────────────────────┘
```

---

## 16. Implementation Phases

### Phase 1: Foundation (Weeks 1-3)
| Task | Owner | Status |
|------|-------|--------|
| Monorepo setup (Turborepo + pnpm) | Full-stack | ✅ Done |
| Supabase schema + RLS policies | Backend | ⬜ Todo |
| Theme Engine package | Full-stack | 🔄 In Progress |
| Consumer-storefront skeleton | Frontend | ✅ Done |
| Auth flow (accounts.letbuyy.store) | Backend | ⬜ Todo |
| Middleware + subdomain routing | Full-stack | ✅ Done |

### Phase 2: Theme Implementation (Weeks 4-6)
| Task | Owner | Status |
|------|-------|--------|
| Urban Kicks — full build | Frontend | ⬜ Todo |
| Luxe Atelier — full build | Frontend | ⬜ Todo |
| Neon Tech — full build | Frontend | ⬜ Todo |
| Nature's Basket — full build | Frontend | ⬜ Todo |
| Creative Folio — full build | Frontend | ⬜ Todo |
| Dark Portfolio — full build | Frontend | ⬜ Todo |
| Clean Resume — full build | Frontend | ⬜ Todo |
| SaaS Launch — full build | Frontend | ⬜ Todo |

### Phase 3: Marketplace (Weeks 7-9)
| Task | Owner | Status |
|------|-------|--------|
| Theme Gallery page | Frontend | ⬜ Todo |
| Theme Detail page | Frontend | ⬜ Todo |
| Live Preview with iframe | Full-stack | ⬜ Todo |
| Stripe integration | Backend | ⬜ Todo |
| Razorpay integration | Backend | ⬜ Todo |
| User Dashboard | Frontend | ⬜ Todo |
| Theme Customizer (live) | Full-stack | ⬜ Todo |

### Phase 4: Polish & Launch (Weeks 10-12)
| Task | Owner | Status |
|------|-------|--------|
| Multi-platform export (WP/Shopify/HTML) | Full-stack | ⬜ Todo |
| Admin Panel | Frontend | ⬜ Todo |
| Analytics + PostHog | Backend | ⬜ Todo |
| E2E testing (Playwright) | QA | ⬜ Todo |
| Performance optimization | Full-stack | ⬜ Todo |
| Cloudflare + Vercel deployment | DevOps | ⬜ Todo |
| SEO + marketing pages | Marketing | ⬜ Todo |

---

## 17. Payment & Licensing

### Stripe Flow
```
User clicks "Buy" → POST /api/checkout/create-session
  → Stripe Checkout Session created
  → User completes payment on Stripe hosted page
  → Stripe webhook POST /api/webhooks/stripe (event: checkout.session.completed)
  → Insert into theme_purchases + generate license_key
  → User redirected to dashboard with theme available
```

### Razorpay Flow
```
User clicks "Buy" → POST /api/checkout/razorpay/create-order
  → Razorpay Order created
  → Razorpay checkout modal opens in-page
  → Payment verified server-side via /api/webhooks/razorpay
  → Insert into theme_purchases + generate license_key
```

### License Tiers
| Plan | Price | Themes | Support |
|------|-------|--------|---------|
| Free | $0 | Free themes only | Community |
| Starter | $9/mo | 3 premium themes | Email (48h) |
| Pro | $29/mo | Unlimited themes | Priority (24h) |
| Unlimited | $99/mo | All themes + multi-platform | Dedicated (4h) |

### License Key Format

```
Format: LBTH-XXXX-XXXX-XXXX-XXXX
Example: LBTH-A4B2-C8D1-E6F3-G9H7

- Prefix: LBTH (LetBuyy Themes)
- JWT-signed for tamper detection
- Embedded checksum for offline validation
```

### Refund Policy

| Condition | Refund |
|-----------|--------|
| Within 30 days, no install | Full refund (auto) |
| Within 30 days, installed | Full refund, license revoked (manual) |
| After 30 days | No refund (support ticket) |
| Subscription cancellation | Pro-rated (auto) |

---

## 18. Theme Development Workflow

```bash
# 1. Create new theme scaffold
npx letbuyy create-theme --name "my-theme" --category store

# Generated structure:
# consumer-storefront/stores/my-theme/
#   ├── components/    (Header, Footer, Hero, ProductGrid, etc.)
#   ├── pages/         (Home, Product, Category, Cart, Checkout)
#   ├── config.ts      (ThemeConfig with defaults)
#   ├── index.tsx      (ThemeComponents export)
#   ├── styles.css     (CSS variables + theme-specific styles)
#   └── demo-data.ts   (Mock products/content for preview)

# 2. Develop with hot reload
pnpm dev --filter=storefront

# 3. Test theme isolation
pnpm test:theme my-theme

# 4. Build & validate
pnpm build:theme my-theme

# 5. Publish to marketplace
pnpm publish:theme my-theme --pricing free
```

---

## 19. Testing & QA

### Unit Tests
```bash
pnpm test                          # All packages
pnpm test --filter=theme-engine    # Theme engine only
pnpm test --filter=storefront      # Storefront tests
```

### E2E Tests (Playwright)
```typescript
// tests/e2e/theme-gallery.spec.ts
test('user can browse and preview themes', async ({ page }) => {
  await page.goto('https://themes.letbuyy.store');
  await expect(page.getByText('Beautiful themes')).toBeVisible();
  await page.click('[data-theme="urban-kicks"]');
  await expect(page.getByText('Urban Kicks')).toBeVisible();
  await page.click('text=Live Demo');
  await expect(page.frameLocator('iframe')).toHaveURL(/urban-kicks/);
});

// tests/e2e/theme-purchase.spec.ts
test('user can purchase premium theme', async ({ page }) => {
  await page.goto('https://themes.letbuyy.store/themes/luxe-atelier');
  await page.click('text=Buy Now');
  // Mock Stripe checkout
  await expect(page).toHaveURL(/checkout/);
});
```

### Performance Benchmarks
| Metric | Target | Tool |
|--------|--------|------|
| LCP | < 2.5s | Lighthouse |
| FID | < 100ms | Web Vitals |
| CLS | < 0.1 | Web Vitals |
| Bundle size per theme | < 150KB gzipped | webpack-bundle-analyzer |
| Theme load time | < 1s (cached) | Custom |

---

## 20. Deployment Strategy

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────┐
│   GitHub     │───▶│  Vercel CI   │───▶│  Vercel Edge     │
│   Main       │    │  Build + Test│    │  (Next.js SSR)   │
└─────────────┘    └──────────────┘    └──────────────────┘
                                              │
                   ┌──────────────┐            │
                   │  Cloudflare  │◀───────────┘
                   │  DNS + WAF   │
                   │  *.letbuyy.  │
                   │  store       │
                   └──────────────┘
```

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Payments
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...

# CDN & Cache
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=phc_...
SENTRY_DSN=https://...

# Email
RESEND_API_KEY=re_...
```

### Infrastructure

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

### DNS Configuration

```
themes.letbuyy.store        → Vercel (theme-marketplace)
themes-admin.letbuyy.store  → Vercel (theme-admin)
urban-kicks.letbuyy.store   → Vercel (storefront — demo)
luxe-atelier.letbuyy.store  → Vercel (storefront — demo)
*.letbuyy.store             → Vercel (storefront — user stores)
accounts.letbuyy.store      → Vercel (accounts — auth hub)
```

### CI/CD Pipeline

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

### Monitoring & Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| Error rate spike | > 1% requests return 5xx | Page on-call |
| Payment failure | > 5 failed in 1 hour | Notify finance + eng |
| License abuse | > 10 activations from single key | Auto-suspend |
| DDoS detected | > 10K req/min from single IP | Cloudflare auto-block |
| Build failure | CI/CD fails | Block deploy + notify |

---

## 21. Success Metrics & KPIs

| KPI | Target (Month 1) | Target (Month 6) |
|-----|-------------------|-------------------|
| Theme gallery visits | 5,000 | 50,000 |
| Free theme installs | 500 | 10,000 |
| Premium purchases | 50 | 2,000 |
| MRR (subscription) | $500 | $15,000 |
| Average rating | 4.5+ | 4.7+ |
| Theme load time p95 | < 2s | < 1.5s |
| Conversion (visit → install) | 5% | 12% |

---

## 22. Quick Start Guide

```bash
# 1. Clone & install
git clone https://github.com/letbuyy/letbuyy-store.git
cd letbuyy-store
pnpm install

# 2. Set up environment
cp apps/web/storefront/.env.example apps/web/storefront/.env.local
# Fill in Supabase, Stripe, Razorpay keys

# 3. Run database migrations
pnpm supabase db push

# 4. Start development
pnpm dev --filter=storefront

# 5. Visit
# Theme marketplace:  http://localhost:3000
# Demo store:         http://urban-kicks.localhost:3000
# Dashboard:          http://localhost:3000/dashboard
```

---

## 23. Theme Customizer (Live Preview)

### 23.1 Customizer Component

```typescript
// apps/web/storefront/src/components/theme-customizer.tsx
'use client';

import { useState, useCallback } from 'react';

interface CustomizationOptions {
  colors: { primary: string; secondary: string; accent: string; background: string; text: string; };
  fonts: { heading: string; body: string; };
  layout: { heroStyle: string; productGrid: string; headerStyle: string; };
  sections: { showTestimonials: boolean; showNewsletter: boolean; showBanner: boolean; };
}

export function ThemeCustomizer({
  themeId, previewUrl, defaultOptions
}: { themeId: string; previewUrl: string; defaultOptions: CustomizationOptions }) {

  const [options, setOptions] = useState<CustomizationOptions>(defaultOptions);

  const updateOption = useCallback((path: string, value: any) => {
    setOptions(prev => {
      const newOptions = structuredClone(prev);
      const keys = path.split('.');
      let obj: any = newOptions;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;

      // Send to iframe for live preview
      const iframe = document.querySelector<HTMLIFrameElement>('#theme-preview');
      iframe?.contentWindow?.postMessage(
        { type: 'CUSTOMIZATION_UPDATE', payload: newOptions }, '*'
      );
      return newOptions;
    });
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar Controls */}
      <aside className="w-80 overflow-y-auto border-r p-4 space-y-6">
        <h2 className="text-lg font-semibold">Customize Theme</h2>

        {/* Color pickers for each color option */}
        <section>
          <h3 className="font-medium mb-2">Colors</h3>
          {Object.entries(options.colors).map(([key, val]) => (
            <label key={key} className="flex items-center justify-between mb-2">
              <span className="capitalize">{key}</span>
              <input type="color" value={val} onChange={e => updateOption(`colors.${key}`, e.target.value)} />
            </label>
          ))}
        </section>

        {/* Font selectors */}
        <section>
          <h3 className="font-medium mb-2">Fonts</h3>
          {/* font select dropdowns */}
        </section>

        {/* Layout options */}
        <section>
          <h3 className="font-medium mb-2">Layout</h3>
          {/* hero style, grid, header style selectors */}
        </section>

        <button onClick={() => saveCustomizations(themeId, options)}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Save Changes
        </button>
      </aside>

      {/* Live Preview */}
      <main className="flex-1">
        <iframe id="theme-preview" src={previewUrl} className="w-full h-full border-none" />
      </main>
    </div>
  );
}
```

### 23.2 CSS Variable Generation

```typescript
// packages/typescript/theme-engine/src/utils/css-variables.ts

export function generateCSSVariables(customizations: CustomizationOptions): string {
  const { colors, fonts, layout } = customizations;
  return `
    :root {
      --theme-primary: ${colors.primary};
      --theme-secondary: ${colors.secondary};
      --theme-accent: ${colors.accent};
      --theme-bg: ${colors.background};
      --theme-text: ${colors.text};
      --font-heading: '${fonts.heading}', sans-serif;
      --font-body: '${fonts.body}', sans-serif;
      --product-grid: ${layout.productGrid === '4-col' ? '4' : layout.productGrid === '3-col' ? '3' : '2'};
    }
  `;
}
```

### 23.3 Server-Side Customization Application

```typescript
// apps/web/storefront/src/lib/apply-customizations.ts

export async function applyCustomizations(siteId: string, customizations: CustomizationOptions) {
  const supabase = await createServerClient();

  // 1. Save customizations to DB
  await supabase.from('theme_installations')
    .update({ customizations: customizations })
    .eq('site_id', siteId).eq('is_active', true);

  // 2. Generate CSS variables
  const cssVars = generateCSSVariables(customizations);

  // 3. Invalidate CDN cache for this site
  await invalidateCDNCache(siteId);

  // 4. Track analytics
  await supabase.from('theme_analytics').insert({
    theme_id: (await getActiveTheme(siteId)).theme_id,
    event_type: 'customize', user_id: (await getUser()).id,
    site_id: siteId, metadata: { changes: Object.keys(customizations) }
  });

  return { success: true, cssVars };
}
```

---

## 24. Multi-Platform Export

### 24.1 Conversion Pipeline

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   LetBuyy    │     │   Theme      │     │   Platform   │
│   Theme      │────▶│  Converter   │────▶│   Package    │
│  (React)     │     │  Pipeline    │     │  (.zip)      │
└──────────────┘     └──────────────┘     └──────────────┘
                           │
                     ┌─────┴──────┐
                     │            │
              ┌──────┴──┐   ┌────┴─────┐   ┌──────────┐
              │WordPress│   │ Shopify  │   │  HTML/CSS │
              │  .zip   │   │  .zip    │   │  .zip     │
              └─────────┘   └──────────┘   └──────────┘
```

### 24.2 Converter Implementation

```typescript
// packages/typescript/theme-converter/src/convert.ts

export async function convertTheme(themeId: string, platform: Platform): Promise<Buffer> {
  const themeEntry = THEME_REGISTRY[themeId];
  const components = await themeEntry.loader();
  const config = themeEntry.defaultConfig;

  switch (platform) {
    case 'wordpress':
      return new WordPressConverter(components, config).convert();
    case 'shopify':
      return new ShopifyConverter(components, config).convert();
    case 'html':
      return new HTMLConverter(components, config).convert();
    case 'react':
      return new ReactConverter(components, config).convert();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

---

## 25. Additional Features

### 25.1 Theme Bundles

```sql
-- SQL function for bundle pricing
CREATE OR REPLACE FUNCTION create_bundle_purchase(
  p_user_id TEXT, p_collection_id UUID, p_payment_id TEXT
) RETURNS UUID AS $$
DECLARE
  v_purchase_id UUID;
  v_theme RECORD;
BEGIN
  FOR v_theme IN SELECT theme_id FROM collection_themes WHERE collection_id = p_collection_id
  LOOP
    INSERT INTO theme_purchases (user_id, theme_id, purchase_type, payment_intent_id, amount_paid)
    VALUES (p_user_id, v_theme.theme_id, 'bundle', p_payment_id, 0)
    RETURNING id INTO v_purchase_id;
  END LOOP;
  RETURN v_purchase_id;
END;
$$ LANGUAGE plpgsql;
```

### 25.2 White-Label & Reseller Program

| Feature | Description |
|---------|-------------|
| **Custom Branding** | Remove LetBuyy branding, add reseller's logo |
| **Custom Domain** | themes.yourdomain.com |
| **Revenue Share** | 70% reseller / 30% LetBuyy |
| **Theme Curation** | Choose which themes to include |
| **Custom Pricing** | Set own price tiers |
| **Analytics** | Dedicated dashboard for sales/performance |

### 25.3 Smart Theme Recommendations

```typescript
// packages/typescript/theme-engine/src/recommendations.ts

export async function getRecommendations(userId: string): Promise<Theme[]> {
  // 1. User's industry & category preferences
  const userProfile = await getUserProfile(userId);

  // 2. Collaborative filtering (users who bought X also bought Y)
  const similarUsers = await findSimilarUsers(userId);
  const theirPurchases = await getTopPurchases(similarUsers);

  // 3. Content-based (similar features, colors, styles)
  const contentSimilar = await findSimilarThemes(userProfile.preferences);

  // 4. Trending in user's category
  const trending = await getTrendingThemes(userProfile.industry);

  // 5. Score and rank
  return rankAndDeduplicate([...theirPurchases, ...contentSimilar, ...trending]);
}
```

### 25.4 Performance Scoring

| Metric | Weight | Measurement |
|--------|--------|-------------|
| Lighthouse Performance | 30% | Automated CI check |
| First Contentful Paint | 20% | Web Vitals API |
| Total Bundle Size | 20% | Build analysis |
| Accessibility Score | 15% | Lighthouse a11y |
| Mobile Responsiveness | 15% | Multi-viewport tests |

Each theme gets a **Performance Grade** (A-F) displayed on its marketplace card.

### 25.5 Version Control & Rollback

```typescript
// Theme version management
export async function rollbackTheme(siteId: string, targetVersion: string) {
  const supabase = await createServerClient();

  // 1. Get version details
  const { data: version } = await supabase.from('theme_versions')
    .select('*').eq('version', targetVersion).single();

  // 2. Update installation
  await supabase.from('theme_installations')
    .update({ version_installed: targetVersion })
    .eq('site_id', siteId).eq('is_active', true);

  // 3. Log rollback in audit
  await supabase.from('audit_logs').insert({
    action: 'theme_rollback', entity_type: 'theme_installation',
    entity_id: siteId, new_values: { version: targetVersion }
  });

  // 4. Invalidate cache
  await invalidateCDNCache(siteId);
}
```

### 25.6 Future: Visual Theme Builder

```
┌──────────────────────────────────────────────────────────┐
│  🎨 LetBuyy Visual Theme Builder (Future V4.0)          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────┐  ┌──────────────────────────────────┐  │
│  │  Components  │  │                                  │  │
│  │  ─────────── │  │    ┌─ DRAG & DROP CANVAS ────┐  │  │
│  │  □ Header    │  │    │                          │  │  │
│  │  □ Hero      │  │    │   [Header Component]     │  │  │
│  │  □ Grid      │  │    │                          │  │  │
│  │  □ Carousel  │  │    │   [Hero Section]         │  │  │
│  │  □ Footer    │  │    │                          │  │  │
│  │  □ CTA       │  │    │   [Product Grid]         │  │  │
│  │  □ Pricing   │  │    │                          │  │  │
│  │              │  │    │   [Footer Component]     │  │  │
│  │  Sections    │  │    │                          │  │  │
│  │  ─────────── │  │    └──────────────────────────┘  │  │
│  │  □ Products  │  │                                  │  │
│  │  □ About     │  │  [Preview ▶]  [Export 📦]        │  │
│  │  □ Contact   │  │  [Save Draft] [Publish 🚀]       │  │
│  └─────────────┘  └──────────────────────────────────┘  │
│                                                          │
│  Status: Planned for V4.0 (Q3 2026)                     │
└──────────────────────────────────────────────────────────┘
```

### 25.7 Community Features (Planned)

| Feature | Priority | Status |
|---------|----------|--------|
| Theme ratings & detailed reviews | High | ✅ Schema ready |
| Developer profiles & portfolios | Medium | ⬜ Planned |
| Theme submission (3rd party) | Medium | ⬜ Planned |
| Public theme API | Low | ⬜ Planned |
| Community forum integration | Low | ⬜ Planned |
| Theme remix/fork (open source) | Low | ⬜ Planned |

---

**Document Version:** 3.1 (Fully Merged & Comprehensive)  
**Last Updated:** February 2026  
**Authors:** LetBuyy Engineering Team  
**Status:** Implementation In Progress  
**Source Documents:** `LetBuyy Theme Marketplace - Complete Roadmap.md` + `teme intergation.md`  
**Total Sections:** 25  
**Coverage:** All 4042 lines from source documents fully integrated  

