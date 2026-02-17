# LetBuyy App Store — Complete Implementation

> **Doc 15 of 17** | App Ecosystem, Extensions, Billing, Developer Portal & Marketplace
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Prev:** [14 Theme Implementation](./14_Theme_Implementation.md) | **Next:** [16 Customer Management](./16_Customer_Management.md)

---

## Table of Contents

### Part 1 — Foundation & Architecture
1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Domain Structure & Routing](#3-domain-structure--routing)
4. [App Types & Classification](#4-app-types--classification)
5. [Database Schema](#5-database-schema)
6. [OAuth 2.0 Authentication Flow](#6-oauth-20-authentication-flow)

### Part 2 — Core Infrastructure
7. [Session Tokens & App Authentication](#7-session-tokens--app-authentication)
8. [App Bridge SDK](#8-app-bridge-sdk)
9. [Embedded App Architecture](#9-embedded-app-architecture)
10. [App Proxy System](#10-app-proxy-system)
11. [Webhook System](#11-webhook-system)
12. [Permissions & Scopes](#12-permissions--scopes)

### Part 3 — Billing & Extensions
13. [Billing API](#13-billing-api)
14. [Storefront Extensions](#14-storefront-extensions)
15. [Checkout UI Extensions](#15-checkout-ui-extensions)
16. [Post-Purchase Extensions](#16-post-purchase-extensions)
17. [Admin Extensions](#17-admin-extensions)
18. [Extension SDK & Validation](#18-extension-sdk--validation)

### Part 4 — Marketplace & Discovery
19. [App Store Marketplace UI](#19-app-store-marketplace-ui)
20. [App Detail & Listing Page](#20-app-detail--listing-page)
21. [Review & Rating System](#21-review--rating-system)
22. [Installation Flow](#22-installation-flow)
23. [Categories & Collections](#23-categories--collections)
24. [Search & Discovery Engine](#24-search--discovery-engine)

### Part 5 — Developer Platform & Operations
25. [Developer Portal](#25-developer-portal)
26. [App Submission & Review Process](#26-app-submission--review-process)
27. [App Analytics Dashboard](#27-app-analytics-dashboard)
28. [SSO Integration (Cross-App)](#28-sso-integration-cross-app)
29. [Security Model](#29-security-model)
30. [API Reference](#30-api-reference)

---

# PART 1 — FOUNDATION & ARCHITECTURE

---

## 1. Executive Summary

The LetBuyy App Store (`apps.letbuyy.store`) is the **8th application** in the LetBuyy monorepo, providing a Shopify-class app ecosystem where:

- **Merchants** discover, install, and manage third-party apps that extend their store's capabilities
- **Developers** build, publish, and monetize apps through a full developer platform
- **The Platform** earns revenue via a 20% commission on all app sales

The App Store mirrors and extends Shopify's `apps.shopify.com` architecture, implementing:

| Feature | Description |
|---|---|
| **OAuth 2.0** | Secure authorization with granular scopes |
| **App Bridge** | Embedded app framework inside `admin.letbuyy.store` |
| **Session Tokens** | Short-lived JWTs for embedded app authentication |
| **App Proxy** | Storefront URL proxying with HMAC verification |
| **Webhooks** | Real-time event notifications (50+ event types) |
| **Billing API** | Recurring, one-time, and usage-based charges |
| **5 Extension Types** | Storefront, Checkout, Post-Purchase, Admin, POS |
| **Marketplace** | Full app store with reviews, categories, search |
| **Developer Portal** | App submission, analytics, and management |

### Platform Applications Map (Updated)

```
┌─────────────────────────────────────────────────────────────────┐
│                    LetBuyy Platform                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. letbuyy.store              → Marketing / Landing            │
│  2. accounts.letbuyy.store     → Auth (Login/Signup/SSO)        │
│  3. admin.letbuyy.store        → Store Admin Dashboard          │
│  4. {store}.letbuyy.store      → Storefront (Dynamic)           │
│  5. console.letbuyy.store      → Super Admin Console            │
│  6. team.letbuyy.store         → Employee Portal                │
│  7. themes.letbuyy.store       → Theme Marketplace              │
│  8. apps.letbuyy.store         → App Store & Developer Portal ← NEW │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Monorepo Location

```
apps/
└── web/
    ├── accounts/          # App 2 — Auth
    ├── admin/             # App 3 — Admin
    ├── app-store/         # App 8 — App Store ← NEW
    │   ├── src/
    │   │   ├── app/       # Next.js App Router pages
    │   │   ├── components/
    │   │   ├── lib/
    │   │   └── styles/
    │   ├── package.json
    │   ├── next.config.js
    │   └── tsconfig.json
    ├── console/           # App 5 — Super Admin
    ├── landing/           # App 1 — Marketing
    ├── storefront/        # App 4 — Storefront
    ├── team/              # App 6 — Employee
    └── theme-marketplace/ # App 7 — Themes
```

---

## 2. Architecture Overview

### System Architecture Diagram

```
                          ┌──────────────────────┐
                          │   apps.letbuyy.store  │
                          │    (App Marketplace)  │
                          └──────────┬───────────┘
                                     │
              ┌──────────────────────┼──────────────────────┐
              │                      │                      │
              ▼                      ▼                      ▼
   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
   │   Public Store   │   │ Developer Portal │   │  Admin Embed    │
   │   (Browse/Search)│   │  (Submit/Manage) │   │  (App Bridge)   │
   └────────┬────────┘   └────────┬────────┘   └────────┬────────┘
            │                     │                      │
            └─────────────────────┼──────────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
            ┌─────────────┐ ┌──────────┐ ┌──────────────┐
            │  Supabase   │ │  OAuth   │ │   Webhook    │
            │  (Database) │ │  Server  │ │   Delivery   │
            └─────────────┘ └──────────┘ └──────────────┘
```

### Request Flow — App Installation

```
Merchant clicks "Install" on apps.letbuyy.store
  │
  ├── 1. Check lb_session cookie → authenticated?
  │     ├── NO  → redirect to accounts.letbuyy.store/login?redirect=...
  │     └── YES → continue
  │
  ├── 2. Redirect to OAuth consent screen
  │     │   GET /apps/{slug}/install?shop={store_slug}
  │     │   Display: App name, developer, requested scopes
  │     └── Merchant clicks "Install App"
  │
  ├── 3. Generate authorization code
  │     │   POST /api/oauth/authorize
  │     │   Store: app_id, store_id, granted_scopes, auth_code
  │     └── Redirect to app's redirect_uri with ?code={auth_code}&shop={store}
  │
  ├── 4. App exchanges code for access token
  │     │   POST /api/oauth/token
  │     │   Body: { client_id, client_secret, code }
  │     └── Response: { access_token, scope, store_slug }
  │
  ├── 5. Record installation
  │     │   INSERT INTO lb_app_installations
  │     └── Emit webhook: app/installed
  │
  └── 6. Redirect merchant to app inside admin
        └── admin.letbuyy.store/apps/{app-slug}
```

### Request Flow — Embedded App Session

```
Merchant navigates to admin.letbuyy.store/apps/{slug}
  │
  ├── 1. Admin loads iframe pointing to {app.app_url}
  │
  ├── 2. App Bridge initializes in iframe
  │     │   const bridge = createApp({ apiKey: APP_CLIENT_ID });
  │     └── Requests session token from parent window
  │
  ├── 3. Admin generates session token (JWT)
  │     │   Payload: { iss: 'letbuyy', sub: store_id, aud: app_client_id }
  │     │   Signed with: APP_CLIENT_SECRET
  │     └── Sent to iframe via postMessage
  │
  ├── 4. App frontend sends API requests with session token
  │     │   Authorization: Bearer {session_token}
  │     └── App backend validates JWT signature + expiry
  │
  └── 5. App backend uses stored access_token for LetBuyy API calls
        └── GET https://admin.letbuyy.store/api/2026-02/{resource}
            Authorization: Bearer {access_token}
```

### Technology Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router, Server Components, ISR) |
| **Database** | Supabase (PostgreSQL 16) with RLS |
| **Auth** | `lb_session` cookie (SSO) + OAuth 2.0 for apps |
| **Styling** | CSS Modules + LetBuyy Design System |
| **Search** | Supabase Full-Text Search (tsvector) |
| **Webhooks** | Supabase Edge Functions + Queue |
| **SDKs** | `@letbuyy/app-bridge`, `@letbuyy/polaris`, `@letbuyy/app-cli` |
| **Deployment** | Vercel (Edge Runtime for middleware) |

---

## 3. Domain Structure & Routing

### DNS & Cloudflare Configuration

```
┌──────────────────────────────────────────────────────────┐
│ Domain: apps.letbuyy.store                               │
│ Type:   CNAME → cname.vercel-dns.com (Proxied: OFF)     │
│ SSL:    Full (Strict) via Vercel                         │
│ Cache:  Standard Cloudflare for static assets            │
└──────────────────────────────────────────────────────────┘
```

### Next.js Route Structure

```
src/app/
├── layout.tsx                        # Root layout with SSO header
├── page.tsx                          # Homepage — featured apps, categories
├── globals.css                       # Global styles
│
├── (store)/                          # Public marketplace (grouped route)
│   ├── categories/
│   │   ├── page.tsx                  # All categories grid
│   │   └── [slug]/
│   │       └── page.tsx              # Category listing with filters
│   │
│   ├── apps/
│   │   └── [slug]/
│   │       ├── page.tsx              # App detail page
│   │       ├── install/
│   │       │   └── page.tsx          # OAuth consent + install
│   │       └── reviews/
│   │           └── page.tsx          # All reviews
│   │
│   ├── collections/
│   │   └── [slug]/
│   │       └── page.tsx              # Curated collection
│   │
│   └── search/
│       └── page.tsx                  # Search results with facets
│
├── (auth)/                           # Protected routes
│   ├── my-apps/
│   │   ├── page.tsx                  # Installed apps list
│   │   └── [id]/
│   │       ├── page.tsx              # App management
│   │       └── billing/
│   │           └── page.tsx          # Billing details
│   │
│   └── developers/
│       ├── page.tsx                  # Developer portal landing
│       ├── register/
│       │   └── page.tsx              # Developer registration
│       ├── dashboard/
│       │   └── page.tsx              # Developer dashboard
│       └── apps/
│           ├── new/
│           │   └── page.tsx          # Submit new app
│           └── [id]/
│               ├── edit/
│               │   └── page.tsx      # Edit app listing
│               └── analytics/
│                   └── page.tsx      # App analytics
│
├── api/
│   ├── oauth/
│   │   ├── authorize/
│   │   │   └── route.ts             # OAuth authorization endpoint
│   │   └── token/
│   │       └── route.ts             # Token exchange endpoint
│   │
│   ├── apps/
│   │   ├── route.ts                 # GET: list apps, POST: create app
│   │   ├── [id]/
│   │   │   ├── route.ts             # GET/PUT/DELETE app
│   │   │   ├── install/
│   │   │   │   └── route.ts         # POST: install app
│   │   │   ├── uninstall/
│   │   │   │   └── route.ts         # POST: uninstall app
│   │   │   └── reviews/
│   │   │       └── route.ts         # GET/POST reviews
│   │   │
│   │   └── search/
│   │       └── route.ts             # GET: search apps
│   │
│   ├── webhooks/
│   │   ├── route.ts                 # POST: register webhook
│   │   └── [id]/
│   │       └── route.ts             # PUT/DELETE webhook
│   │
│   ├── billing/
│   │   ├── charges/
│   │   │   └── route.ts             # POST: create charge
│   │   └── subscriptions/
│   │       └── route.ts             # POST: create subscription
│   │
│   └── developers/
│       ├── route.ts                 # GET/POST developer profile
│       └── apps/
│           ├── route.ts             # GET: developer's apps
│           └── [id]/
│               ├── submit/
│               │   └── route.ts     # POST: submit for review
│               └── versions/
│                   └── route.ts     # POST: new version
│
└── middleware.ts                     # SSO + route protection
```

### Middleware — SSO & Route Protection

```typescript
// apps/web/app-store/src/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/session';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL
                   || 'https://accounts.letbuyy.store';

// Routes that require authentication
const PROTECTED_PREFIXES = [
  '/my-apps',
  '/developers',
  '/api/apps',       // POST/PUT/DELETE
  '/api/webhooks',
  '/api/billing',
  '/api/developers',
];

// Routes that are always public
const PUBLIC_PREFIXES = [
  '/',
  '/categories',
  '/apps',
  '/collections',
  '/search',
  '/api/apps',       // GET only
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ────────────────────────────────────────────────────
  // 1. Public routes — no auth required for GET
  // ────────────────────────────────────────────────────
  if (req.method === 'GET' && PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    // Still attach user info if cookie present (for header UI)
    const token = req.cookies.get('lb_session')?.value;
    if (token) {
      const session = await verifySession(token);
      if (session) {
        const response = NextResponse.next();
        response.headers.set('x-user-id', session.sub);
        response.headers.set('x-user-email', session.email);
        response.headers.set('x-user-name', session.name || '');
        response.headers.set('x-store-id', session.store_id || '');
        return response;
      }
    }
    return NextResponse.next();
  }

  // ────────────────────────────────────────────────────
  // 2. Protected routes — require lb_session
  // ────────────────────────────────────────────────────
  if (PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
    const token = req.cookies.get('lb_session')?.value;

    if (!token) {
      // API routes → 401
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      // Page routes → redirect to accounts
      const loginUrl = new URL('/login', ACCOUNTS_URL);
      loginUrl.searchParams.set('redirect', req.url);
      return NextResponse.redirect(loginUrl);
    }

    const session = await verifySession(token);
    if (!session) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Invalid or expired session' },
          { status: 401 }
        );
      }
      const loginUrl = new URL('/login', ACCOUNTS_URL);
      loginUrl.searchParams.set('redirect', req.url);
      return NextResponse.redirect(loginUrl);
    }

    // Attach session to headers
    const response = NextResponse.next();
    response.headers.set('x-user-id', session.sub);
    response.headers.set('x-user-email', session.email);
    response.headers.set('x-user-name', session.name || '');
    response.headers.set('x-store-id', session.store_id || '');
    response.headers.set('x-user-role', session.role || 'owner');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

---

## 4. App Types & Classification

### App Type Taxonomy

```
┌──────────────────────────────────────────────────────────────────┐
│                     LetBuyy App Types                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Public     │  │  Unlisted   │  │   Custom    │             │
│  │   App        │  │   App       │  │   App       │             │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤             │
│  │ • Listed in  │  │ • Not in    │  │ • Single    │             │
│  │   App Store  │  │   search    │  │   store     │             │
│  │ • OAuth flow │  │ • Direct    │  │ • Private   │             │
│  │ • Reviewed   │  │   link only │  │   API keys  │             │
│  │   by team    │  │ • OAuth flow│  │ • No review │             │
│  │ • Billing API│  │ • Reviewed  │  │ • No billing│             │
│  │   required   │  │   by team   │  │   API       │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐                                                │
│  │   Draft      │   (Development only — installable              │
│  │   App        │    only on dev stores)                         │
│  └─────────────┘                                                │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Type Definitions

```typescript
// packages/types/src/apps.ts

export type AppType = 'public' | 'unlisted' | 'custom' | 'draft';

export type AppStatus =
  | 'draft'           // Initial — being built
  | 'submitted'       // Sent for review
  | 'in_review'       // Under review
  | 'changes_needed'  // Review returned with requested changes
  | 'approved'        // Passed review — ready to publish
  | 'published'       // Live on App Store
  | 'suspended'       // Temporarily disabled by platform
  | 'removed';        // Permanently removed

export type AppPricingModel =
  | 'free'            // Completely free
  | 'freemium'        // Free with paid features
  | 'recurring'       // Monthly/annual subscription
  | 'one_time'        // Single purchase
  | 'usage_based';    // Pay per use

export interface LBApp {
  id:               string;       // UUID
  slug:             string;       // URL-safe unique slug
  name:             string;       // Display name (max 30 chars)
  tagline:          string;       // Short description (max 80 chars)
  description:      string;       // Full markdown description
  type:             AppType;
  status:           AppStatus;

  // Developer
  developer_id:     string;       // FK → lb_developers.id
  developer_name:   string;       // Cached from developer profile
  developer_email:  string;

  // OAuth
  client_id:        string;       // Public OAuth client ID
  client_secret:    string;       // Hashed secret
  redirect_uris:    string[];     // Allowed callback URLs
  scopes:           string[];     // Requested permission scopes

  // URLs
  app_url:          string;       // Main app URL (for iframe)
  proxy_url?:       string;       // App proxy target URL
  proxy_path?:      string;       // Storefront path prefix (e.g., "/a/reviews")
  privacy_url:      string;       // Privacy policy URL
  terms_url?:       string;       // Terms of service URL

  // Media
  icon_url:         string;       // 1200×1200 app icon
  screenshots:      string[];     // Up to 10 screenshots (1600×1200)
  video_url?:       string;       // Demo video URL

  // Pricing
  pricing_model:    AppPricingModel;
  price_monthly?:   number;       // Monthly price in INR
  price_yearly?:    number;       // Annual price in INR
  trial_days:       number;       // Free trial period (0 = no trial)

  // Categorization
  category_id:      string;       // FK → lb_app_categories.id
  tags:             string[];     // Searchable tags
  collection_ids:   string[];     // Curated collections

  // Stats (cached)
  install_count:    number;
  review_count:     number;
  avg_rating:       number;       // 0.0 – 5.0

  // Extensions
  extensions:       AppExtension[];

  // Metadata
  current_version:  string;       // Semver (e.g., "2.1.0")
  min_plan:         string;       // Minimum LetBuyy plan (free/starter/pro/enterprise)
  supported_locales: string[];    // ['en', 'hi', 'ta', ...]
  created_at:       string;
  updated_at:       string;
  published_at?:    string;
}

export interface AppExtension {
  id:          string;
  app_id:      string;
  type:        ExtensionType;
  name:        string;
  entry_point: string;           // URL or file path
  config:      Record<string, unknown>;
  status:      'active' | 'inactive';
}

export type ExtensionType =
  | 'storefront_block'    // Theme app block
  | 'storefront_embed'    // Theme app embed (global)
  | 'checkout_ui'         // Checkout extension
  | 'post_purchase'       // Post-purchase page
  | 'admin_link'          // Admin navigation link
  | 'admin_block';        // Admin embedded block
```

### App Categories

```typescript
// lib/constants/categories.ts

export const APP_CATEGORIES = [
  // ── Finding Products ──
  { slug: 'sourcing',          name: 'Product Sourcing',       icon: '📦', group: 'Products' },
  { slug: 'dropshipping',      name: 'Dropshipping',           icon: '🚛', group: 'Products' },
  { slug: 'print-on-demand',   name: 'Print on Demand',        icon: '🎨', group: 'Products' },

  // ── Selling Products ──
  { slug: 'checkout',          name: 'Checkout',               icon: '💳', group: 'Selling' },
  { slug: 'upsell-cross-sell', name: 'Upsell & Cross-sell',    icon: '📈', group: 'Selling' },
  { slug: 'subscriptions',     name: 'Subscriptions',          icon: '🔄', group: 'Selling' },
  { slug: 'pricing',           name: 'Pricing & Discounts',    icon: '🏷️', group: 'Selling' },

  // ── Orders & Shipping ──
  { slug: 'shipping',          name: 'Shipping & Delivery',    icon: '🚚', group: 'Orders' },
  { slug: 'inventory',         name: 'Inventory Management',   icon: '📋', group: 'Orders' },
  { slug: 'order-management',  name: 'Order Management',       icon: '📑', group: 'Orders' },
  { slug: 'returns',           name: 'Returns & Exchanges',    icon: '↩️', group: 'Orders' },

  // ── Marketing ──
  { slug: 'email-marketing',   name: 'Email Marketing',        icon: '📧', group: 'Marketing' },
  { slug: 'sms-marketing',     name: 'SMS Marketing',          icon: '📱', group: 'Marketing' },
  { slug: 'seo',               name: 'SEO',                    icon: '🔍', group: 'Marketing' },
  { slug: 'social-media',      name: 'Social Media',           icon: '📣', group: 'Marketing' },
  { slug: 'ads',               name: 'Advertising',            icon: '📺', group: 'Marketing' },

  // ── Conversion ──
  { slug: 'reviews',           name: 'Reviews & Ratings',      icon: '⭐', group: 'Conversion' },
  { slug: 'loyalty',           name: 'Loyalty & Rewards',      icon: '🎁', group: 'Conversion' },
  { slug: 'popups',            name: 'Pop-ups & Banners',      icon: '💬', group: 'Conversion' },
  { slug: 'trust-badges',      name: 'Trust & Security',       icon: '🛡️', group: 'Conversion' },

  // ── Store Design ──
  { slug: 'page-builders',     name: 'Page Builders',          icon: '🏗️', group: 'Design' },
  { slug: 'image-editing',     name: 'Image & Media',          icon: '🖼️', group: 'Design' },

  // ── Customer Support ──
  { slug: 'live-chat',         name: 'Live Chat',              icon: '💬', group: 'Support' },
  { slug: 'helpdesk',          name: 'Help Desk & FAQ',        icon: '🎧', group: 'Support' },
  { slug: 'crm',               name: 'CRM',                    icon: '👥', group: 'Support' },

  // ── Analytics ──
  { slug: 'analytics',         name: 'Analytics & Reports',    icon: '📊', group: 'Analytics' },
  { slug: 'ab-testing',        name: 'A/B Testing',            icon: '🧪', group: 'Analytics' },

  // ── Finance ──
  { slug: 'accounting',        name: 'Accounting & Tax',       icon: '🧾', group: 'Finance' },
  { slug: 'invoicing',         name: 'Invoicing',              icon: '📄', group: 'Finance' },
] as const;

export type AppCategorySlug = typeof APP_CATEGORIES[number]['slug'];
```

### Comparison with Shopify

| Feature | Shopify | LetBuyy |
|---|---|---|
| App types | Public, Unlisted, Custom, Draft | ✅ Same |
| OAuth 2.0 | ✅ | ✅ |
| Embedded apps | ✅ (App Bridge) | ✅ (@letbuyy/app-bridge) |
| Session tokens | ✅ (JWT) | ✅ (JWT) |
| App Proxy | ✅ (HMAC verified) | ✅ (HMAC verified) |
| Webhooks | ✅ (50+ events) | ✅ (50+ events) |
| Billing API | ✅ (mandatory) | ✅ (mandatory for paid apps) |
| Checkout extensions | ✅ (Plus only) | ✅ (Pro/Enterprise plans) |
| Post-purchase | ✅ | ✅ |
| Storefront extensions | ✅ (Theme App Extensions) | ✅ |
| POS extensions | ✅ | 🔜 Phase 2 |
| App review | ✅ (5–10 days) | ✅ (3–7 days) |
| Revenue share | 15% (reduced from 20%) | 20% commission |
| Polaris UI kit | ✅ | ✅ (LetBuyy Design System) |
| CLI tool | ✅ (shopify cli) | ✅ (@letbuyy/app-cli) |
| GraphQL API | ✅ | 🔜 Phase 2 (REST first) |

---

## 5. Database Schema

### Migration File

```sql
-- backend/supabase/migrations/016_app_store_ecosystem.sql
-- LetBuyy App Store — Complete Database Schema
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 5.1  lb_developers — Developer Profiles
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_developers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
    
    -- Profile
    company_name    TEXT NOT NULL,
    display_name    TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    email           TEXT NOT NULL,
    website_url     TEXT,
    support_email   TEXT NOT NULL,
    
    -- Verification
    is_verified     BOOLEAN DEFAULT false,
    verification_docs JSONB DEFAULT '{}',
    
    -- Payout
    payout_method   TEXT DEFAULT 'bank_transfer',  -- bank_transfer | upi | paypal
    payout_details  JSONB DEFAULT '{}',            -- encrypted bank/UPI details
    
    -- Stats (cached)
    total_apps      INTEGER DEFAULT 0,
    total_installs  INTEGER DEFAULT 0,
    total_revenue   DECIMAL(12,2) DEFAULT 0.00,
    avg_rating      DECIMAL(3,2) DEFAULT 0.00,
    
    -- Status
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','active','suspended','banned')),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id)
);

-- ─────────────────────────────────────────────────────────────
-- 5.2  lb_app_categories — Category Taxonomy
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_categories (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT,
    icon            TEXT,                    -- emoji or icon name
    group_name      TEXT NOT NULL,           -- Products, Selling, Marketing, etc.
    sort_order      INTEGER DEFAULT 0,
    app_count       INTEGER DEFAULT 0,       -- cached count
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO lb_app_categories (slug, name, icon, group_name, sort_order) VALUES
    ('sourcing',         'Product Sourcing',     '📦', 'Products',   1),
    ('dropshipping',     'Dropshipping',         '🚛', 'Products',   2),
    ('print-on-demand',  'Print on Demand',      '🎨', 'Products',   3),
    ('checkout',         'Checkout',             '💳', 'Selling',    4),
    ('upsell-cross-sell','Upsell & Cross-sell',  '📈', 'Selling',    5),
    ('subscriptions',    'Subscriptions',        '🔄', 'Selling',    6),
    ('pricing',          'Pricing & Discounts',  '🏷️', 'Selling',    7),
    ('shipping',         'Shipping & Delivery',  '🚚', 'Orders',     8),
    ('inventory',        'Inventory Management', '📋', 'Orders',     9),
    ('order-management', 'Order Management',     '📑', 'Orders',    10),
    ('returns',          'Returns & Exchanges',  '↩️', 'Orders',    11),
    ('email-marketing',  'Email Marketing',      '📧', 'Marketing', 12),
    ('sms-marketing',    'SMS Marketing',        '📱', 'Marketing', 13),
    ('seo',              'SEO',                  '🔍', 'Marketing', 14),
    ('social-media',     'Social Media',         '📣', 'Marketing', 15),
    ('ads',              'Advertising',          '📺', 'Marketing', 16),
    ('reviews',          'Reviews & Ratings',    '⭐', 'Conversion',17),
    ('loyalty',          'Loyalty & Rewards',    '🎁', 'Conversion',18),
    ('popups',           'Pop-ups & Banners',    '💬', 'Conversion',19),
    ('trust-badges',     'Trust & Security',     '🛡️', 'Conversion',20),
    ('page-builders',    'Page Builders',        '🏗️', 'Design',    21),
    ('image-editing',    'Image & Media',        '🖼️', 'Design',    22),
    ('live-chat',        'Live Chat',            '💬', 'Support',   23),
    ('helpdesk',         'Help Desk & FAQ',      '🎧', 'Support',   24),
    ('crm',              'CRM',                  '👥', 'Support',   25),
    ('analytics',        'Analytics & Reports',  '📊', 'Analytics', 26),
    ('ab-testing',       'A/B Testing',          '🧪', 'Analytics', 27),
    ('accounting',       'Accounting & Tax',     '🧾', 'Finance',   28),
    ('invoicing',        'Invoicing',            '📄', 'Finance',   29)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5.3  lb_apps — Core App Registry
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_apps (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    tagline         TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    
    -- Type & Status
    type            TEXT NOT NULL DEFAULT 'public'
                    CHECK (type IN ('public','unlisted','custom','draft')),
    status          TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN (
                      'draft','submitted','in_review','changes_needed',
                      'approved','published','suspended','removed'
                    )),
    
    -- Developer
    developer_id    UUID NOT NULL REFERENCES lb_developers(id) ON DELETE CASCADE,
    
    -- OAuth Configuration
    client_id       TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    client_secret   TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    redirect_uris   TEXT[] DEFAULT '{}',
    scopes          TEXT[] DEFAULT '{}',             -- requested permissions
    
    -- URLs
    app_url         TEXT NOT NULL DEFAULT '',        -- embedded app URL
    proxy_url       TEXT,                            -- app proxy target
    proxy_path      TEXT,                            -- storefront path prefix
    privacy_url     TEXT NOT NULL DEFAULT '',
    terms_url       TEXT,
    
    -- Media
    icon_url        TEXT,
    screenshots     TEXT[] DEFAULT '{}',
    video_url       TEXT,
    
    -- Pricing
    pricing_model   TEXT DEFAULT 'free'
                    CHECK (pricing_model IN ('free','freemium','recurring','one_time','usage_based')),
    price_monthly   DECIMAL(10,2),
    price_yearly    DECIMAL(10,2),
    trial_days      INTEGER DEFAULT 0,
    
    -- Categorization
    category_id     UUID REFERENCES lb_app_categories(id),
    tags            TEXT[] DEFAULT '{}',
    
    -- Stats (denormalized for performance)
    install_count   INTEGER DEFAULT 0,
    review_count    INTEGER DEFAULT 0,
    avg_rating      DECIMAL(3,2) DEFAULT 0.00,
    
    -- Version
    current_version TEXT DEFAULT '1.0.0',
    min_plan        TEXT DEFAULT 'free'
                    CHECK (min_plan IN ('free','starter','pro','enterprise')),
    supported_locales TEXT[] DEFAULT '{en}',
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    published_at    TIMESTAMPTZ,
    
    -- Review
    review_notes    TEXT,                       -- notes from reviewer
    reviewed_by     UUID REFERENCES users_custom(id),
    reviewed_at     TIMESTAMPTZ
);

-- Indexes for search and filtering
CREATE INDEX idx_lb_apps_slug ON lb_apps(slug);
CREATE INDEX idx_lb_apps_status ON lb_apps(status);
CREATE INDEX idx_lb_apps_category ON lb_apps(category_id);
CREATE INDEX idx_lb_apps_developer ON lb_apps(developer_id);
CREATE INDEX idx_lb_apps_pricing ON lb_apps(pricing_model);
CREATE INDEX idx_lb_apps_rating ON lb_apps(avg_rating DESC);
CREATE INDEX idx_lb_apps_installs ON lb_apps(install_count DESC);
CREATE INDEX idx_lb_apps_tags ON lb_apps USING GIN(tags);

-- Full-text search vector
ALTER TABLE lb_apps ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(array_to_string(tags, ' '), '')), 'B')
    ) STORED;
CREATE INDEX idx_lb_apps_search ON lb_apps USING GIN(search_vector);

-- ─────────────────────────────────────────────────────────────
-- 5.4  lb_app_versions — Versioned Releases
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_versions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    version         TEXT NOT NULL,                -- semver: "2.1.0"
    changelog       TEXT,                         -- markdown changelog
    
    -- Snapshot
    app_url         TEXT NOT NULL,
    scopes          TEXT[] DEFAULT '{}',
    redirect_uris   TEXT[] DEFAULT '{}',
    
    -- Review
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
    review_notes    TEXT,
    
    -- Metadata
    min_plan        TEXT DEFAULT 'free',
    breaking_changes BOOLEAN DEFAULT false,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    
    UNIQUE(app_id, version)
);

-- ─────────────────────────────────────────────────────────────
-- 5.5  lb_app_installations — Per-Store Installs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_installations (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Granted permissions (may be subset of requested)
    granted_scopes  TEXT[] DEFAULT '{}',
    
    -- Status
    status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active','inactive','suspended','uninstalled')),
    
    -- Version tracking
    installed_version TEXT NOT NULL DEFAULT '1.0.0',
    
    -- Billing
    charge_id       UUID,                         -- FK → lb_app_charges
    
    -- Merchant who installed
    installed_by    UUID REFERENCES users_custom(id),
    
    -- Timestamps
    installed_at    TIMESTAMPTZ DEFAULT NOW(),
    uninstalled_at  TIMESTAMPTZ,
    
    UNIQUE(app_id, store_id)
);

CREATE INDEX idx_lb_app_installs_store ON lb_app_installations(store_id);
CREATE INDEX idx_lb_app_installs_app ON lb_app_installations(app_id);

-- ─────────────────────────────────────────────────────────────
-- 5.6  lb_app_access_tokens — OAuth Access Tokens
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_access_tokens (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES lb_app_installations(id) ON DELETE CASCADE,
    
    -- Token
    access_token    TEXT NOT NULL UNIQUE,         -- hashed
    token_type      TEXT DEFAULT 'offline'
                    CHECK (token_type IN ('online','offline')),
    scopes          TEXT[] DEFAULT '{}',
    
    -- Online tokens expire; offline tokens don't
    expires_at      TIMESTAMPTZ,                 -- null for offline tokens
    
    -- Metadata
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_used_at    TIMESTAMPTZ,
    
    UNIQUE(app_id, store_id, token_type)
);

-- ─────────────────────────────────────────────────────────────
-- 5.7  lb_app_webhooks — Webhook Subscriptions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_webhooks (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES lb_app_installations(id) ON DELETE CASCADE,
    
    -- Webhook config
    topic           TEXT NOT NULL,                -- e.g., "orders/create"
    callback_url    TEXT NOT NULL,                -- HTTPS endpoint
    format          TEXT DEFAULT 'json'
                    CHECK (format IN ('json','xml')),
    
    -- API version
    api_version     TEXT DEFAULT '2026-02',
    
    -- Status
    is_active       BOOLEAN DEFAULT true,
    
    -- Signing
    hmac_secret     TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(app_id, store_id, topic)
);

-- ─────────────────────────────────────────────────────────────
-- 5.8  lb_app_webhook_events — Event Delivery Log
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_webhook_events (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    webhook_id      UUID NOT NULL REFERENCES lb_app_webhooks(id) ON DELETE CASCADE,
    app_id          UUID NOT NULL,
    store_id        UUID NOT NULL,
    
    -- Event
    topic           TEXT NOT NULL,
    payload         JSONB NOT NULL DEFAULT '{}',
    
    -- Delivery
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending','delivered','failed','retrying')),
    response_code   INTEGER,
    response_body   TEXT,
    attempts        INTEGER DEFAULT 0,
    max_attempts    INTEGER DEFAULT 5,
    next_retry_at   TIMESTAMPTZ,
    
    -- Timing
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    delivered_at    TIMESTAMPTZ
);

CREATE INDEX idx_webhook_events_status ON lb_app_webhook_events(status);
CREATE INDEX idx_webhook_events_webhook ON lb_app_webhook_events(webhook_id);

-- ─────────────────────────────────────────────────────────────
-- 5.9  lb_app_extensions — Extension Registrations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_extensions (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    
    -- Extension type
    type            TEXT NOT NULL
                    CHECK (type IN (
                      'storefront_block','storefront_embed',
                      'checkout_ui','post_purchase',
                      'admin_link','admin_block'
                    )),
    
    -- Config
    name            TEXT NOT NULL,
    description     TEXT,
    entry_point     TEXT NOT NULL,               -- URL or asset path
    config_schema   JSONB DEFAULT '{}',          -- JSON Schema for settings
    default_config  JSONB DEFAULT '{}',
    
    -- Rendering
    target          TEXT,                         -- placement target (e.g., "product.below_price")
    max_instances   INTEGER DEFAULT 1,           -- how many times can be added
    
    -- Status
    status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active','inactive','deprecated')),
    
    -- Version
    version         TEXT DEFAULT '1.0.0',
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 5.10  lb_app_reviews — Merchant Reviews
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_reviews (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users_custom(id) ON DELETE CASCADE,
    
    -- Review content
    rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title           TEXT,
    body            TEXT,
    
    -- Engagement
    helpful_count   INTEGER DEFAULT 0,
    
    -- Developer response
    developer_reply TEXT,
    replied_at      TIMESTAMPTZ,
    
    -- Moderation
    status          TEXT DEFAULT 'published'
                    CHECK (status IN ('pending','published','hidden','flagged')),
    
    -- Context
    app_version     TEXT,                        -- version at time of review
    days_used       INTEGER,                     -- days since install
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- One review per app per store
    UNIQUE(app_id, store_id)
);

CREATE INDEX idx_app_reviews_app ON lb_app_reviews(app_id);
CREATE INDEX idx_app_reviews_rating ON lb_app_reviews(rating);

-- ─────────────────────────────────────────────────────────────
-- 5.11  lb_app_charges — Billing Records
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_charges (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES lb_app_installations(id) ON DELETE CASCADE,
    
    -- Charge type
    charge_type     TEXT NOT NULL
                    CHECK (charge_type IN ('recurring','one_time','usage')),
    
    -- Pricing
    name            TEXT NOT NULL,                -- "Pro Plan", "API Credits"
    amount          DECIMAL(10,2) NOT NULL,       -- in INR
    currency        TEXT DEFAULT 'INR',
    interval        TEXT                          -- 'monthly' | 'yearly' (for recurring)
                    CHECK (interval IS NULL OR interval IN ('monthly','yearly')),
    
    -- Trial
    trial_days      INTEGER DEFAULT 0,
    trial_ends_at   TIMESTAMPTZ,
    
    -- Status
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN (
                      'pending','active','frozen','cancelled',
                      'declined','expired'
                    )),
    
    -- Billing cycle
    billing_on      INTEGER,                     -- day of month (1-28)
    current_period_start TIMESTAMPTZ,
    current_period_end   TIMESTAMPTZ,
    
    -- Usage-based
    usage_limit     INTEGER,                     -- max usage units
    usage_current   INTEGER DEFAULT 0,           -- current usage
    usage_unit      TEXT,                         -- "api_calls", "emails", etc.
    
    -- Payment
    stripe_charge_id    TEXT,                     -- Stripe charge/subscription ID
    platform_commission DECIMAL(10,2),            -- 20% of amount
    developer_payout    DECIMAL(10,2),            -- 80% of amount
    
    -- Timestamps
    activated_at    TIMESTAMPTZ,
    cancelled_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_charges_store ON lb_app_charges(store_id);
CREATE INDEX idx_app_charges_app ON lb_app_charges(app_id);
CREATE INDEX idx_app_charges_status ON lb_app_charges(status);

-- ─────────────────────────────────────────────────────────────
-- 5.12  lb_app_collections — Curated Collections
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_collections (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    description     TEXT,
    cover_image     TEXT,
    
    -- App IDs in this collection (ordered)
    app_ids         UUID[] DEFAULT '{}',
    
    -- Display
    is_featured     BOOLEAN DEFAULT false,
    sort_order      INTEGER DEFAULT 0,
    
    -- Status
    is_active       BOOLEAN DEFAULT true,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default collections
INSERT INTO lb_app_collections (slug, name, description, is_featured, sort_order) VALUES
    ('staff-picks',      'Staff Picks',           'Hand-selected by the LetBuyy team',     true,  1),
    ('trending',         'Trending Now',           'Most installed this month',             true,  2),
    ('new-noteworthy',   'New & Noteworthy',       'Recently published, highly rated',      true,  3),
    ('free-essentials',  'Free Essentials',        'Must-have free apps for every store',   true,  4),
    ('boost-sales',      'Boost Your Sales',       'Proven apps for increasing revenue',    false, 5),
    ('marketing-toolkit','Marketing Toolkit',      'Complete marketing stack',              false, 6)
ON CONFLICT (slug) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5.13  lb_app_proxy_routes — App Proxy Configuration
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lb_app_proxy_routes (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES lb_app_installations(id) ON DELETE CASCADE,
    
    -- Proxy config
    path_prefix     TEXT NOT NULL,               -- "/a/reviews"
    target_url      TEXT NOT NULL,               -- "https://app.example.com/proxy"
    
    -- Security
    hmac_secret     TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    
    -- Status
    is_active       BOOLEAN DEFAULT true,
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(store_id, path_prefix)
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security Policies
-- ─────────────────────────────────────────────────────────────

ALTER TABLE lb_developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lb_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE lb_app_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lb_app_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE lb_app_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE lb_app_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE lb_app_charges ENABLE ROW LEVEL SECURITY;

-- Developers: own profile only
CREATE POLICY "developers_own" ON lb_developers
    FOR ALL USING (user_id = auth.uid());

-- Apps: public read for published, developer write for own
CREATE POLICY "apps_public_read" ON lb_apps
    FOR SELECT USING (status = 'published' OR developer_id IN (
        SELECT id FROM lb_developers WHERE user_id = auth.uid()
    ));

CREATE POLICY "apps_developer_write" ON lb_apps
    FOR ALL USING (developer_id IN (
        SELECT id FROM lb_developers WHERE user_id = auth.uid()
    ));

-- Installations: store owner can manage
CREATE POLICY "installations_store_owner" ON lb_app_installations
    FOR ALL USING (store_id IN (
        SELECT id FROM sites WHERE owner_id = auth.uid()
    ));

-- Reviews: own reviews only for write, public read
CREATE POLICY "reviews_public_read" ON lb_app_reviews
    FOR SELECT USING (status = 'published');

CREATE POLICY "reviews_own_write" ON lb_app_reviews
    FOR ALL USING (user_id = auth.uid());

-- Charges: store owner can view
CREATE POLICY "charges_store_owner" ON lb_app_charges
    FOR SELECT USING (store_id IN (
        SELECT id FROM sites WHERE owner_id = auth.uid()
    ));

-- ─────────────────────────────────────────────────────────────
-- Helper Functions
-- ─────────────────────────────────────────────────────────────

-- Increment install count
CREATE OR REPLACE FUNCTION increment_app_install_count(p_app_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE lb_apps SET install_count = install_count + 1,
                       updated_at = NOW()
    WHERE id = p_app_id;
    
    UPDATE lb_developers SET total_installs = total_installs + 1
    WHERE id = (SELECT developer_id FROM lb_apps WHERE id = p_app_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recalculate app rating
CREATE OR REPLACE FUNCTION recalculate_app_rating(p_app_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE lb_apps SET
        avg_rating = COALESCE((
            SELECT ROUND(AVG(rating)::numeric, 2)
            FROM lb_app_reviews
            WHERE app_id = p_app_id AND status = 'published'
        ), 0),
        review_count = (
            SELECT COUNT(*)
            FROM lb_app_reviews
            WHERE app_id = p_app_id AND status = 'published'
        ),
        updated_at = NOW()
    WHERE id = p_app_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-recalculate on review change
CREATE OR REPLACE FUNCTION trigger_recalculate_rating()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM recalculate_app_rating(COALESCE(NEW.app_id, OLD.app_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_review_rating_update
    AFTER INSERT OR UPDATE OR DELETE ON lb_app_reviews
    FOR EACH ROW EXECUTE FUNCTION trigger_recalculate_rating();
```

### Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌───────────────────┐
│ users_custom │────▶│ lb_developers│────▶│     lb_apps       │
│   (user)     │     │  (developer) │     │  (app registry)   │
└──────────────┘     └──────────────┘     └────────┬──────────┘
                                                    │
                    ┌───────────────────────────────┼────────────────┐
                    │              │                │                │
                    ▼              ▼                ▼                ▼
          ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
          │ lb_app_     │ │ lb_app_      │ │ lb_app_      │ │ lb_app_      │
          │ versions    │ │ installations│ │ extensions   │ │ reviews      │
          └─────────────┘ └──────┬───────┘ └──────────────┘ └──────────────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
                    ▼            ▼            ▼
          ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
          │ lb_app_     │ │ lb_app_      │ │ lb_app_      │
          │ access_     │ │ webhooks     │ │ charges      │
          │ tokens      │ │              │ │  (billing)   │
          └─────────────┘ └──────┬───────┘ └──────────────┘
                                 │
                                 ▼
                        ┌──────────────┐
                        │ lb_app_      │
                        │ webhook_     │
                        │ events       │
                        └──────────────┘
```

### Table Summary

| # | Table | Records At Scale | Purpose |
|---|---|---|---|
| 1 | `lb_developers` | ~500 | Developer profiles |
| 2 | `lb_app_categories` | 29 (seeded) | Category taxonomy |
| 3 | `lb_apps` | ~2,000 | Core app registry |
| 4 | `lb_app_versions` | ~8,000 | Version history |
| 5 | `lb_app_installations` | ~50,000 | Per-store installs |
| 6 | `lb_app_access_tokens` | ~50,000 | OAuth tokens |
| 7 | `lb_app_webhooks` | ~100,000 | Webhook subscriptions |
| 8 | `lb_app_webhook_events` | ~5,000,000 | Event delivery log |
| 9 | `lb_app_extensions` | ~4,000 | Extension registrations |
| 10 | `lb_app_reviews` | ~20,000 | Merchant reviews |
| 11 | `lb_app_charges` | ~30,000 | Billing records |
| 12 | `lb_app_collections` | 6 (seeded) | Curated collections |
| 13 | `lb_app_proxy_routes` | ~10,000 | App proxy configs |

---

## 6. OAuth 2.0 Authentication Flow

### Overview

The LetBuyy App Store uses **OAuth 2.0 Authorization Code Grant** — the same flow Shopify uses — to securely connect third-party apps to merchant stores.

### Flow Diagram

```
┌──────────┐          ┌──────────────┐          ┌──────────────┐
│ Merchant │          │  LetBuyy     │          │   App Server │
│ Browser  │          │  Platform    │          │  (3rd party) │
└────┬─────┘          └──────┬───────┘          └──────┬───────┘
     │                       │                         │
     │  1. Click "Install"   │                         │
     │──────────────────────▶│                         │
     │                       │                         │
     │  2. Redirect to app URL with shop param         │
     │◀──────────────────────│                         │
     │─────────────────────────────────────────────────▶│
     │                       │                         │
     │  3. App checks if installed                     │
     │                       │  3a. GET /api/oauth/    │
     │                       │◀─────verify?shop=&app=──│
     │                       │──── { installed: false}─▶│
     │                       │                         │
     │  4. Redirect to consent screen                  │
     │◀────────────────────────────────────────────────│
     │──────────────────────▶│                         │
     │                       │                         │
     │  5. Display consent   │                         │
     │       screen          │                         │
     │  ┌─────────────────┐  │                         │
     │  │ "Reviews Pro"   │  │                         │
     │  │ wants access to:│  │                         │
     │  │ ✓ Products      │  │                         │
     │  │ ✓ Orders        │  │                         │
     │  │ ✓ Customers     │  │                         │
     │  │                 │  │                         │
     │  │ [Install App]   │  │                         │
     │  └─────────────────┘  │                         │
     │                       │                         │
     │  6. Merchant approves │                         │
     │──────────────────────▶│                         │
     │                       │                         │
     │  7. Generate auth code│                         │
     │      + redirect       │                         │
     │◀──────────────────────│                         │
     │────redirect_uri?code=abc&shop=store──────────────▶│
     │                       │                         │
     │                       │  8. Exchange code for   │
     │                       │     access token        │
     │                       │  POST /api/oauth/token  │
     │                       │◀────────────────────────│
     │                       │  { client_id,           │
     │                       │    client_secret,       │
     │                       │    code: "abc" }        │
     │                       │                         │
     │                       │  9. Return access token │
     │                       │─────────────────────────▶│
     │                       │  { access_token: "xyz", │
     │                       │    scope: "products,    │
     │                       │           orders",      │
     │                       │    store: "mystore" }   │
     │                       │                         │
     │  10. Redirect to app  │                         │
     │       inside admin    │                         │
     │◀────────────────────────────────────────────────│
     │  admin.letbuyy.store/apps/reviews-pro           │
     │                       │                         │
```

### Implementation

#### Authorization Endpoint

```typescript
// apps/web/app-store/src/app/api/oauth/authorize/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  // ── 1. Verify merchant session ──
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { app_id, store_id, granted_scopes } = await req.json();

  // ── 2. Validate app exists ──
  const { data: app, error: appError } = await supabase
    .from('lb_apps')
    .select('id, client_id, redirect_uris, scopes, name')
    .eq('id', app_id)
    .single();

  if (appError || !app) {
    return NextResponse.json({ error: 'App not found' }, { status: 404 });
  }

  // ── 3. Validate store ownership ──
  const { data: store } = await supabase
    .from('sites')
    .select('id, subdomain')
    .eq('id', store_id)
    .eq('owner_id', session.sub)
    .single();

  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  // ── 4. Validate scopes ──
  const validScopes = granted_scopes.filter(
    (s: string) => app.scopes.includes(s)
  );
  if (validScopes.length === 0) {
    return NextResponse.json({ error: 'No valid scopes' }, { status: 400 });
  }

  // ── 5. Generate authorization code ──
  const authCode = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store auth code temporarily
  await supabase.from('lb_app_auth_codes').insert({
    code: authCode,
    app_id: app.id,
    store_id: store.id,
    user_id: session.sub,
    granted_scopes: validScopes,
    expires_at: expiresAt.toISOString(),
  });

  // ── 6. Build redirect URL ──
  const redirectUri = app.redirect_uris[0]; // Primary redirect URI
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  redirectUrl.searchParams.set('shop', store.subdomain);
  redirectUrl.searchParams.set('state', crypto.randomBytes(16).toString('hex'));

  return NextResponse.json({
    redirect_url: redirectUrl.toString(),
  });
}
```

#### Token Exchange Endpoint

```typescript
// apps/web/app-store/src/app/api/oauth/token/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const { client_id, client_secret, code } = await req.json();

  // ── 1. Validate app credentials ──
  const { data: app } = await supabase
    .from('lb_apps')
    .select('id, client_id, client_secret, name')
    .eq('client_id', client_id)
    .single();

  if (!app) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  // Verify client secret (compare hashed)
  const secretHash = crypto.createHash('sha256').update(client_secret).digest('hex');
  if (secretHash !== app.client_secret) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 401 });
  }

  // ── 2. Validate authorization code ──
  const { data: authCode } = await supabase
    .from('lb_app_auth_codes')
    .select('*')
    .eq('code', code)
    .eq('app_id', app.id)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (!authCode) {
    return NextResponse.json({ error: 'invalid_grant' }, { status: 400 });
  }

  // ── 3. Generate access token ──
  const accessToken = `lbat_${crypto.randomBytes(32).toString('hex')}`;
  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');

  // ── 4. Create installation record ──
  const { data: installation } = await supabase
    .from('lb_app_installations')
    .upsert({
      app_id: app.id,
      store_id: authCode.store_id,
      granted_scopes: authCode.granted_scopes,
      installed_by: authCode.user_id,
      status: 'active',
      installed_version: '1.0.0',
    }, { onConflict: 'app_id,store_id' })
    .select()
    .single();

  // ── 5. Store access token ──
  await supabase.from('lb_app_access_tokens').upsert({
    app_id: app.id,
    store_id: authCode.store_id,
    installation_id: installation!.id,
    access_token: tokenHash,
    token_type: 'offline',
    scopes: authCode.granted_scopes,
  }, { onConflict: 'app_id,store_id,token_type' });

  // ── 6. Increment install count ──
  await supabase.rpc('increment_app_install_count', { p_app_id: app.id });

  // ── 7. Delete used auth code ──
  await supabase
    .from('lb_app_auth_codes')
    .delete()
    .eq('code', code);

  // ── 8. Emit webhook: app/installed ──
  // (handled by webhook delivery service)

  // ── 9. Get store info ──
  const { data: store } = await supabase
    .from('sites')
    .select('subdomain')
    .eq('id', authCode.store_id)
    .single();

  return NextResponse.json({
    access_token: accessToken,
    token_type: 'bearer',
    scope: authCode.granted_scopes.join(','),
    store: store?.subdomain,
  });
}
```

### OAuth Consent Screen UI

```
┌────────────────────────────────────────────────────────┐
│  ┌──────┐                                              │
│  │ ICON │   Reviews Pro                                │
│  └──────┘   by ReviewMaster Inc.                       │
│                                                        │
│  ─────────────────────────────────────────────         │
│                                                        │
│  This app wants access to your store                   │
│  "Urban Kicks" (urbankicks.letbuyy.store)              │
│                                                        │
│  ┌──────────────────────────────────────────────┐      │
│  │                                              │      │
│  │  📦  Products                                │      │
│  │      Read & write product data               │      │
│  │                                              │      │
│  │  📋  Orders                                  │      │
│  │      Read order information                  │      │
│  │                                              │      │
│  │  👥  Customers                               │      │
│  │      Read customer profiles                  │      │
│  │                                              │      │
│  │  🎨  Storefront                              │      │
│  │      Display content on your store           │      │
│  │                                              │      │
│  └──────────────────────────────────────────────┘      │
│                                                        │
│  By installing, you agree to the app's                 │
│  Privacy Policy and Terms of Service                   │
│                                                        │
│  ┌──────────────────┐  ┌──────────────────────┐       │
│  │     Cancel       │  │   Install App  ✓     │       │
│  └──────────────────┘  └──────────────────────┘       │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Access Token Usage

```typescript
// How a third-party app uses the access token to call LetBuyy APIs

// Example: Fetch products from a merchant's store
const response = await fetch(
  'https://admin.letbuyy.store/api/2026-02/products.json',
  {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'X-LB-Store': storeSlug,
      'Content-Type': 'application/json',
    },
  }
);

const { products } = await response.json();

// Example: Create a webhook subscription
const webhook = await fetch(
  'https://apps.letbuyy.store/api/webhooks',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topic: 'orders/create',
      callback_url: 'https://myapp.example.com/webhooks/orders',
      format: 'json',
    }),
  }
);
```

### Supported Scopes

| Scope | Read | Write | Description |
|---|---|---|---|
| `products` | ✅ | ✅ | Products, variants, inventory |
| `orders` | ✅ | ✅ | Orders, fulfillments, refunds |
| `customers` | ✅ | ✅ | Customer profiles, addresses |
| `content` | ✅ | ✅ | Pages, blog posts, media |
| `themes` | ✅ | ✅ | Theme settings, assets |
| `storefront` | ✅ | — | Storefront rendering data |
| `analytics` | ✅ | — | Store analytics, reports |
| `settings` | ✅ | ✅ | Store settings, shipping, taxes |
| `discounts` | ✅ | ✅ | Coupons, promotions |
| `checkout` | ✅ | ✅ | Checkout flow customization |
| `notifications` | — | ✅ | Send notifications |
| `webhooks` | ✅ | ✅ | Manage webhook subscriptions |

---

<!-- END PART 1 — Sections 1–6 Complete -->

---
---

# PART 2 — Core Infrastructure

<!-- Sections 7–12 -->

---

## 7. App Bridge SDK

### Overview

**App Bridge** is LetBuyy's JavaScript SDK that enables third-party apps to run **embedded** inside the admin panel (`admin.letbuyy.store`). It provides:

- **Navigation** — control admin navigation from within the app iframe
- **Resource Picker** — let merchants select products, collections, customers
- **Toast Notifications** — show messages in the admin UI
- **Modal / Full-screen** — expand the app viewport
- **Session Tokens** — authenticate without cookies (see Section 8)
- **Title Bar** — customize the admin header when the app is active
- **Loading State** — show/hide loading indicators
- **Context** — access store info, locale, and merchant details

### Package Structure

```
packages/app-bridge/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Public API exports
│   ├── AppBridge.ts             # Main class
│   ├── actions/
│   │   ├── Navigation.ts        # Navigate admin sections
│   │   ├── ResourcePicker.ts    # Product/collection picker
│   │   ├── Toast.ts             # Toast notifications
│   │   ├── Modal.ts             # Modal/fullscreen
│   │   ├── TitleBar.ts          # Admin title bar
│   │   ├── Loading.ts           # Loading indicators
│   │   └── SessionToken.ts      # JWT session tokens
│   ├── types/
│   │   ├── actions.ts           # Action type definitions
│   │   ├── context.ts           # App context types
│   │   └── events.ts            # Event type definitions
│   └── utils/
│       ├── postMessage.ts       # PostMessage wrapper
│       ├── validate.ts          # Origin validation
│       └── errors.ts            # Error classes
└── dist/                        # Built output
```

### Core Implementation

```typescript
// packages/app-bridge/src/AppBridge.ts

interface AppBridgeConfig {
  apiKey: string;          // App's client_id
  host: string;            // Base64-encoded host origin
  forceRedirect?: boolean; // Redirect if not embedded
}

interface AppContext {
  storeId: string;
  storeSlug: string;
  storeName: string;
  locale: string;
  currency: string;
  plan: string;
  userId: string;
  userRole: string;
}

type ActionType =
  | 'NAVIGATE'
  | 'RESOURCE_PICKER'
  | 'TOAST'
  | 'MODAL'
  | 'TITLE_BAR'
  | 'LOADING'
  | 'SESSION_TOKEN'
  | 'CONTEXT';

interface AppBridgeAction {
  type: ActionType;
  payload: Record<string, unknown>;
  id: string;
}

class AppBridge {
  private config: AppBridgeConfig;
  private context: AppContext | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private pendingActions: Map<string, { resolve: Function; reject: Function }> = new Map();
  private origin: string;

  constructor(config: AppBridgeConfig) {
    this.config = config;
    this.origin = this.decodeHost(config.host);

    // Validate we're in an iframe
    if (window.self === window.top && config.forceRedirect) {
      window.location.href = `${this.origin}/apps/${config.apiKey}`;
      return;
    }

    // Listen for messages from admin
    window.addEventListener('message', this.handleMessage.bind(this));

    // Handshake with admin
    this.postAction('HANDSHAKE', { apiKey: config.apiKey });
  }

  // ── Actions ──

  async navigate(path: string): Promise<void> {
    await this.postAction('NAVIGATE', { path });
  }

  async getSessionToken(): Promise<string> {
    const result = await this.postAction('SESSION_TOKEN', {});
    return result.token as string;
  }

  async resourcePicker(options: {
    type: 'product' | 'collection' | 'customer';
    multiple?: boolean;
    filters?: Record<string, unknown>;
  }): Promise<unknown[]> {
    const result = await this.postAction('RESOURCE_PICKER', options);
    return result.selected as unknown[];
  }

  toast(message: string, options?: {
    duration?: number;
    isError?: boolean;
    action?: { label: string; onAction: () => void };
  }): void {
    this.postAction('TOAST', { message, ...options });
  }

  async modal(options: {
    title: string;
    url?: string;
    size?: 'small' | 'medium' | 'large' | 'fullscreen';
    primaryAction?: { content: string };
    secondaryActions?: Array<{ content: string }>;
  }): Promise<{ action: string }> {
    const result = await this.postAction('MODAL', options);
    return result as { action: string };
  }

  titleBar(options: {
    title: string;
    primaryAction?: { content: string; url?: string };
    secondaryActions?: Array<{ content: string; url?: string }>;
    breadcrumbs?: Array<{ content: string; url: string }>;
  }): void {
    this.postAction('TITLE_BAR', options);
  }

  loading(show: boolean): void {
    this.postAction('LOADING', { show });
  }

  async getContext(): Promise<AppContext> {
    if (this.context) return this.context;
    const result = await this.postAction('CONTEXT', {});
    this.context = result as unknown as AppContext;
    return this.context;
  }

  // ── Event System ──

  on(event: string, callback: Function): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  // ── Internal ──

  private postAction(
    type: string,
    payload: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const id = crypto.randomUUID();
      this.pendingActions.set(id, { resolve, reject });

      window.parent.postMessage(
        { source: 'letbuyy-app-bridge', type, payload, id },
        this.origin
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingActions.has(id)) {
          this.pendingActions.delete(id);
          reject(new Error(`Action ${type} timed out`));
        }
      }, 30000);
    });
  }

  private handleMessage(event: MessageEvent): void {
    // Validate origin
    if (event.origin !== this.origin) return;
    if (event.data?.source !== 'letbuyy-admin') return;

    const { type, payload, id, event: eventName } = event.data;

    // Handle action responses
    if (id && this.pendingActions.has(id)) {
      const { resolve, reject } = this.pendingActions.get(id)!;
      this.pendingActions.delete(id);

      if (payload.error) {
        reject(new Error(payload.error));
      } else {
        resolve(payload);
      }
      return;
    }

    // Handle events
    if (eventName && this.listeners.has(eventName)) {
      this.listeners.get(eventName)!.forEach(cb => cb(payload));
    }
  }

  private decodeHost(host: string): string {
    try {
      return atob(host);
    } catch {
      return host;
    }
  }

  destroy(): void {
    window.removeEventListener('message', this.handleMessage);
    this.listeners.clear();
    this.pendingActions.clear();
  }
}

export default AppBridge;
export { AppBridge, AppBridgeConfig, AppContext, ActionType };
```

### Admin-Side Message Handler

```typescript
// apps/web/admin/src/components/AppEmbed/AppEmbedFrame.tsx
// This runs in the admin panel to handle messages from embedded apps

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/contexts/AppContext';

interface AppEmbedFrameProps {
  appUrl: string;
  appClientId: string;
  appName: string;
}

export function AppEmbedFrame({ appUrl, appClientId, appName }: AppEmbedFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const router = useRouter();
  const { store, user } = useAppContext();
  const [isLoading, setIsLoading] = useState(true);

  const handleMessage = useCallback(async (event: MessageEvent) => {
    // Only accept messages from the app's origin
    const appOrigin = new URL(appUrl).origin;
    if (event.origin !== appOrigin) return;
    if (event.data?.source !== 'letbuyy-app-bridge') return;

    const { type, payload, id } = event.data;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    const respond = (data: Record<string, unknown>) => {
      iframe.contentWindow!.postMessage(
        { source: 'letbuyy-admin', id, payload: data },
        appOrigin
      );
    };

    switch (type) {
      case 'HANDSHAKE':
        respond({ success: true, version: '2026-02' });
        setIsLoading(false);
        break;

      case 'NAVIGATE':
        router.push(payload.path as string);
        respond({ success: true });
        break;

      case 'SESSION_TOKEN':
        // Generate a short-lived JWT for the app
        const tokenRes = await fetch('/api/apps/session-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            app_client_id: appClientId,
            store_id: store.id,
          }),
        });
        const { token } = await tokenRes.json();
        respond({ token });
        break;

      case 'CONTEXT':
        respond({
          storeId: store.id,
          storeSlug: store.subdomain,
          storeName: store.name,
          locale: store.locale || 'en',
          currency: store.currency || 'INR',
          plan: store.plan || 'free',
          userId: user.id,
          userRole: user.role || 'owner',
        });
        break;

      case 'TOAST':
        // Show toast notification in admin UI
        window.dispatchEvent(
          new CustomEvent('lb-toast', {
            detail: {
              message: payload.message,
              isError: payload.isError,
              duration: payload.duration || 3000,
            },
          })
        );
        respond({ success: true });
        break;

      case 'TITLE_BAR':
        // Update admin title bar
        window.dispatchEvent(
          new CustomEvent('lb-title-bar', {
            detail: {
              title: payload.title || appName,
              primaryAction: payload.primaryAction,
              secondaryActions: payload.secondaryActions,
              breadcrumbs: payload.breadcrumbs,
            },
          })
        );
        respond({ success: true });
        break;

      case 'LOADING':
        setIsLoading(payload.show as boolean);
        respond({ success: true });
        break;

      case 'RESOURCE_PICKER':
        // Open resource picker modal
        window.dispatchEvent(
          new CustomEvent('lb-resource-picker', {
            detail: {
              type: payload.type,
              multiple: payload.multiple,
              filters: payload.filters,
              onSelect: (selected: unknown[]) => respond({ selected }),
              onCancel: () => respond({ selected: [] }),
            },
          })
        );
        break;

      case 'MODAL':
        window.dispatchEvent(
          new CustomEvent('lb-modal', {
            detail: {
              title: payload.title,
              url: payload.url,
              size: payload.size,
              primaryAction: payload.primaryAction,
              secondaryActions: payload.secondaryActions,
              onAction: (action: string) => respond({ action }),
            },
          })
        );
        break;
    }
  }, [appUrl, appClientId, appName, router, store, user]);

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [handleMessage]);

  // Build embed URL with host parameter
  const embedUrl = new URL(appUrl);
  embedUrl.searchParams.set('host', btoa(`https://admin.letbuyy.store`));
  embedUrl.searchParams.set('shop', store.subdomain);

  return (
    <div className="app-embed-container">
      {isLoading && (
        <div className="app-embed-loading">
          <div className="spinner" />
          <p>Loading {appName}...</p>
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={embedUrl.toString()}
        title={appName}
        className="app-embed-iframe"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
        allow="clipboard-write"
      />
    </div>
  );
}
```

### Usage in a Third-Party App

```typescript
// Example: Third-party app using App Bridge

import AppBridge from '@letbuyy/app-bridge';

// Initialize
const app = new AppBridge({
  apiKey: 'your_client_id',
  host: new URLSearchParams(window.location.search).get('host')!,
  forceRedirect: true,
});

// Get store context
const context = await app.getContext();
console.log(`Store: ${context.storeName} (${context.storeSlug})`);

// Customize title bar
app.titleBar({
  title: 'Reviews Pro',
  primaryAction: {
    content: 'Add Review Widget',
    url: '/settings/widgets',
  },
  breadcrumbs: [
    { content: 'Dashboard', url: '/' },
  ],
});

// Open product picker
const products = await app.resourcePicker({
  type: 'product',
  multiple: true,
});
console.log('Selected:', products);

// Show toast
app.toast('Settings saved successfully!');

// Get session token for API calls
const token = await app.getSessionToken();
const response = await fetch('https://my-app-backend.com/api/data', {
  headers: { Authorization: `Bearer ${token}` },
});
```

---

## 8. Session Token Authentication

### Overview

Session tokens are **short-lived JWTs** that embedded apps use to authenticate API requests to their own backend. Unlike OAuth access tokens (which authenticate app→platform calls), session tokens authenticate **merchant identity** within the embedded context.

### Token Flow

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Embedded    │          │   Admin      │          │   App        │
│  App (iframe)│          │  (parent)    │          │  Backend     │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │
       │  1. getSessionToken()   │                         │
       │  (via App Bridge)       │                         │
       │────────────────────────▶│                         │
       │                         │                         │
       │                         │  2. POST /api/apps/     │
       │                         │     session-token       │
       │                         │  { app_client_id,       │
       │                         │    store_id, user_id }  │
       │                         │────────────────────────▶│
       │                         │                         │
       │                         │  3. Generate JWT        │
       │                         │  signed with app secret │
       │                         │◀────────────────────────│
       │                         │                         │
       │  4. Return JWT          │                         │
       │◀────────────────────────│                         │
       │                         │                         │
       │  5. Include in API call │                         │
       │  Authorization: Bearer <JWT>                      │
       │──────────────────────────────────────────────────▶│
       │                         │                         │
       │                         │  6. Verify JWT with     │
       │                         │     app's client_secret │
       │                         │                         │
       │  7. Response            │                         │
       │◀──────────────────────────────────────────────────│
```

### JWT Structure

```typescript
// Session Token JWT payload
interface SessionTokenPayload {
  // Standard claims
  iss: string;    // "https://admin.letbuyy.store"
  sub: string;    // User ID
  aud: string;    // App's client_id
  exp: number;    // Expiry (current time + 1 minute)
  nbf: number;    // Not before (current time)
  iat: number;    // Issued at
  jti: string;    // Unique token ID

  // LetBuyy claims
  sid: string;    // Store ID
  store: string;  // Store subdomain (e.g., "urbankicks")
  role: string;   // User's role in the store
  locale: string; // User's locale
}
```

### Token Generation Endpoint

```typescript
// apps/web/admin/src/app/api/apps/session-token/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { getSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { app_client_id, store_id } = await req.json();

  // ── 1. Verify the app is installed on this store ──
  const { data: installation } = await supabase
    .from('lb_app_installations')
    .select(`
      id,
      app:lb_apps!inner(client_id, client_secret)
    `)
    .eq('app.client_id', app_client_id)
    .eq('store_id', store_id)
    .eq('status', 'active')
    .single();

  if (!installation) {
    return NextResponse.json({ error: 'App not installed' }, { status: 403 });
  }

  // ── 2. Get store info ──
  const { data: store } = await supabase
    .from('sites')
    .select('subdomain, locale')
    .eq('id', store_id)
    .single();

  // ── 3. Create the session token JWT ──
  const secret = new TextEncoder().encode(installation.app.client_secret);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    sid: store_id,
    store: store?.subdomain || '',
    role: session.role || 'owner',
    locale: store?.locale || 'en',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer('https://admin.letbuyy.store')
    .setSubject(session.sub)
    .setAudience(app_client_id)
    .setExpirationTime(now + 60)    // 1 minute
    .setNotBefore(now)
    .setIssuedAt(now)
    .setJti(crypto.randomUUID())
    .sign(secret);

  return NextResponse.json({ token });
}
```

### Token Verification (App Backend)

```typescript
// Example: App backend verifying session tokens

import { jwtVerify } from 'jose';

const CLIENT_SECRET = process.env.LB_APP_CLIENT_SECRET!;
const CLIENT_ID = process.env.LB_APP_CLIENT_ID!;

async function verifySessionToken(token: string) {
  try {
    const secret = new TextEncoder().encode(CLIENT_SECRET);

    const { payload } = await jwtVerify(token, secret, {
      issuer: 'https://admin.letbuyy.store',
      audience: CLIENT_ID,
      clockTolerance: 10, // 10-second clock skew tolerance
    });

    return {
      userId: payload.sub,
      storeId: payload.sid as string,
      storeSlug: payload.store as string,
      role: payload.role as string,
      locale: payload.locale as string,
    };
  } catch (error) {
    throw new Error('Invalid session token');
  }
}

// Express middleware example
function authenticateSessionToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const token = authHeader.slice(7);
  verifySessionToken(token)
    .then(session => {
      req.session = session;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Invalid token' });
    });
}
```

---

## 9. App Proxy

### Overview

**App Proxy** lets apps serve content directly on a merchant's storefront at custom paths. Instead of the merchant visiting `https://app.example.com/reviews`, they see `https://urbankicks.letbuyy.store/a/reviews` — the content appears as part of the store.

### How It Works

```
┌──────────┐     ┌──────────────────┐     ┌──────────────┐
│ Customer │     │   Storefront     │     │   App Server │
│ Browser  │     │  (Cloudflare)    │     │  (External)  │
└────┬─────┘     └──────┬───────────┘     └──────┬───────┘
     │                  │                        │
     │  1. GET /a/reviews?product_id=123         │
     │─────────────────▶│                        │
     │                  │                        │
     │                  │  2. Lookup proxy route  │
     │                  │     lb_app_proxy_routes │
     │                  │                        │
     │                  │  3. Forward request     │
     │                  │  + HMAC signature       │
     │                  │  + Store context        │
     │                  │────────────────────────▶│
     │                  │                        │
     │                  │  4. App returns HTML    │
     │                  │     (or JSON/Liquid)    │
     │                  │◀────────────────────────│
     │                  │                        │
     │                  │  5. Inject into store   │
     │                  │     theme layout        │
     │                  │                        │
     │  6. Full page with│store header/footer     │
     │◀─────────────────│                        │
```

### Proxy Middleware Implementation

```typescript
// apps/web/storefront/src/middleware.ts (addition to existing middleware)

import crypto from 'crypto';

async function handleAppProxy(
  req: NextRequest,
  store: StoreConfig
): Promise<NextResponse | null> {
  const { pathname, searchParams } = req.nextUrl;

  // Check if path matches /a/* pattern
  if (!pathname.startsWith('/a/')) return null;

  // Find proxy route for this store + path
  const { data: proxyRoute } = await supabase
    .from('lb_app_proxy_routes')
    .select('*, app:lb_apps!inner(name, slug)')
    .eq('store_id', store.id)
    .eq('is_active', true)
    .filter('path_prefix', 'cs', pathname) // starts-with check
    .single();

  if (!proxyRoute) return null;

  // ── Build proxied request ──
  const targetUrl = new URL(proxyRoute.target_url);

  // Forward all query params
  searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  // ── Generate HMAC signature ──
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const queryString = targetUrl.searchParams.toString();
  const signatureData = [
    pathname,
    queryString,
    timestamp,
  ].join('');

  const hmac = crypto
    .createHmac('sha256', proxyRoute.hmac_secret)
    .update(signatureData)
    .digest('hex');

  // ── Forward to app ──
  const proxyResponse = await fetch(targetUrl.toString(), {
    method: req.method,
    headers: {
      'Content-Type': req.headers.get('content-type') || 'application/json',
      'X-LB-Signature': hmac,
      'X-LB-Timestamp': timestamp,
      'X-LB-Store-Id': store.id,
      'X-LB-Store-Slug': store.subdomain,
      'X-LB-Store-Name': store.name,
      'X-LB-Locale': store.locale || 'en',
      'X-LB-Request-Path': pathname,
      'X-LB-Proxy-Path': proxyRoute.path_prefix,
    },
    body: req.method !== 'GET' ? await req.text() : undefined,
  });

  // ── Handle response ──
  const contentType = proxyResponse.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    // JSON response — pass through
    const data = await proxyResponse.json();
    return NextResponse.json(data, { status: proxyResponse.status });
  }

  if (contentType.includes('text/html') || contentType.includes('application/liquid')) {
    // HTML response — inject into store layout
    const html = await proxyResponse.text();
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html',
        'X-LB-Proxy-App': proxyRoute.app.slug,
      },
    });
  }

  // Other content types — pass through
  return new NextResponse(proxyResponse.body, {
    status: proxyResponse.status,
    headers: { 'Content-Type': contentType },
  });
}
```

### HMAC Verification (App Side)

```typescript
// How the app server verifies the proxy request is genuine

import crypto from 'crypto';

function verifyProxySignature(
  path: string,
  queryString: string,
  timestamp: string,
  signature: string,
  hmacSecret: string
): boolean {
  // Check timestamp freshness (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);
  if (Math.abs(now - requestTime) > 300) return false;

  // Rebuild HMAC
  const signatureData = [path, queryString, timestamp].join('');
  const expectedHmac = crypto
    .createHmac('sha256', hmacSecret)
    .update(signatureData)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedHmac, 'hex')
  );
}

// Express route example
app.get('/proxy/*', (req, res) => {
  const isValid = verifyProxySignature(
    req.headers['x-lb-request-path'],
    req.query.toString(),
    req.headers['x-lb-timestamp'],
    req.headers['x-lb-signature'],
    process.env.LB_PROXY_SECRET!
  );

  if (!isValid) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  // Render content using store context
  const storeSlug = req.headers['x-lb-store-slug'];
  const locale = req.headers['x-lb-locale'];

  res.send(renderReviewsWidget(storeSlug, locale));
});
```

### Supported Response Types

| Type | Content-Type | Behavior |
|---|---|---|
| **HTML** | `text/html` | Injected into store theme layout (with header/footer) |
| **Liquid** | `application/liquid` | Processed by LetBuyy's Liquid engine, then injected |
| **JSON** | `application/json` | Passed through as-is (for AJAX requests) |
| **Redirect** | `301`/`302` | Redirects the customer's browser |

---

## 10. Webhook System

### Overview

Webhooks notify apps of store events in **near real-time**. When something happens (e.g., a new order), LetBuyy sends an HTTP POST to the app's registered callback URL.

### Supported Topics

| Group | Topic | Trigger |
|---|---|---|
| **Products** | `products/create` | New product created |
| | `products/update` | Product modified |
| | `products/delete` | Product deleted |
| **Orders** | `orders/create` | New order placed |
| | `orders/paid` | Order payment confirmed |
| | `orders/fulfilled` | Order fulfilled |
| | `orders/cancelled` | Order cancelled |
| | `orders/refunded` | Order refunded |
| **Customers** | `customers/create` | New customer registered |
| | `customers/update` | Customer profile updated |
| | `customers/delete` | Customer deleted |
| **Checkout** | `checkouts/create` | Checkout started |
| | `checkouts/update` | Checkout modified |
| | `checkouts/complete` | Checkout completed |
| **Inventory** | `inventory/update` | Inventory level changed |
| **Themes** | `themes/publish` | Theme published |
| | `themes/update` | Theme settings changed |
| **Apps** | `app/installed` | App installed on store |
| | `app/uninstalled` | App removed from store |
| | `app/scopes_changed` | App permissions changed |
| **Store** | `store/update` | Store settings changed |
| | `store/plan_changed` | Store plan upgraded/downgraded |

### Webhook Delivery Service

```typescript
// backend/supabase/functions/webhook-dispatcher/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHmac } from 'https://deno.land/std@0.168.0/crypto/mod.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_KEY')!
);

interface WebhookEvent {
  store_id: string;
  topic: string;
  payload: Record<string, unknown>;
}

serve(async (req) => {
  const event: WebhookEvent = await req.json();

  // ── 1. Find all webhook subscriptions for this store + topic ──
  const { data: webhooks } = await supabase
    .from('lb_app_webhooks')
    .select('id, app_id, callback_url, hmac_secret, format, api_version')
    .eq('store_id', event.store_id)
    .eq('topic', event.topic)
    .eq('is_active', true);

  if (!webhooks?.length) {
    return new Response(JSON.stringify({ delivered: 0 }));
  }

  // ── 2. Create event records ──
  const eventRecords = webhooks.map(wh => ({
    webhook_id: wh.id,
    app_id: wh.app_id,
    store_id: event.store_id,
    topic: event.topic,
    payload: event.payload,
    status: 'pending',
  }));

  const { data: insertedEvents } = await supabase
    .from('lb_app_webhook_events')
    .insert(eventRecords)
    .select();

  // ── 3. Deliver webhooks concurrently ──
  const deliveryPromises = webhooks.map(async (wh, index) => {
    const eventRecord = insertedEvents![index];
    return deliverWebhook(wh, event, eventRecord.id);
  });

  const results = await Promise.allSettled(deliveryPromises);

  return new Response(JSON.stringify({
    delivered: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
  }));
});

async function deliverWebhook(
  webhook: Record<string, unknown>,
  event: WebhookEvent,
  eventId: string
) {
  const body = JSON.stringify({
    id: eventId,
    topic: event.topic,
    store_id: event.store_id,
    api_version: webhook.api_version,
    payload: event.payload,
    occurred_at: new Date().toISOString(),
  });

  // Generate HMAC signature
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(webhook.hmac_secret as string),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(body)
  );

  const signature = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Deliver with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

  try {
    const response = await fetch(webhook.callback_url as string, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-LB-Topic': event.topic,
        'X-LB-HMAC-SHA256': signature,
        'X-LB-Webhook-Id': webhook.id as string,
        'X-LB-API-Version': webhook.api_version as string,
        'X-LB-Store-Id': event.store_id,
        'User-Agent': 'LetBuyy-Webhook/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // Update event status
    await supabase
      .from('lb_app_webhook_events')
      .update({
        status: response.ok ? 'delivered' : 'failed',
        response_code: response.status,
        response_body: await response.text().catch(() => ''),
        attempts: 1,
        delivered_at: response.ok ? new Date().toISOString() : null,
      })
      .eq('id', eventId);

    // Schedule retry if failed
    if (!response.ok) {
      await scheduleRetry(eventId, 1);
    }
  } catch (error) {
    clearTimeout(timeout);

    await supabase
      .from('lb_app_webhook_events')
      .update({
        status: 'failed',
        response_body: (error as Error).message,
        attempts: 1,
      })
      .eq('id', eventId);

    await scheduleRetry(eventId, 1);
  }
}

async function scheduleRetry(eventId: string, attempt: number) {
  if (attempt >= 5) {
    await supabase
      .from('lb_app_webhook_events')
      .update({ status: 'failed' })
      .eq('id', eventId);
    return;
  }

  // Exponential backoff: 1m, 5m, 30m, 2h, 12h
  const delays = [60, 300, 1800, 7200, 43200];
  const nextRetry = new Date(
    Date.now() + delays[attempt - 1] * 1000
  ).toISOString();

  await supabase
    .from('lb_app_webhook_events')
    .update({
      status: 'retrying',
      next_retry_at: nextRetry,
      attempts: attempt,
    })
    .eq('id', eventId);
}
```

### Webhook Verification (App Side)

```typescript
// How apps verify incoming webhooks

import crypto from 'crypto';

function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(hmac, 'hex')
  );
}

// Express example
app.post('/webhooks/orders', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-lb-hmac-sha256'];
  const body = req.body.toString('utf8');

  if (!verifyWebhookSignature(body, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(body);
  console.log(`New order: ${event.payload.order_number}`);

  // Acknowledge quickly — process async
  res.status(200).send('OK');

  // Process in background
  processOrder(event.payload).catch(console.error);
});
```

### Retry Policy

| Attempt | Delay | Total Elapsed |
|---|---|---|
| 1 | Immediate | 0 |
| 2 | 1 minute | 1 min |
| 3 | 5 minutes | 6 min |
| 4 | 30 minutes | 36 min |
| 5 | 2 hours | 2h 36m |
| 6 (final) | 12 hours | 14h 36m |

After 5 failed retries, the webhook event is marked as permanently failed. If an app has >50% failure rate over 48 hours, the webhook subscription is automatically **disabled** and the developer is notified.

---

## 11. Billing API

### Overview

The LetBuyy Billing API enables apps to charge merchants for their services. It mirrors Shopify's billing system with three charge types:

| Charge Type | Use Case | Example |
|---|---|---|
| **Recurring** | Monthly/annual subscription | "Pro Plan — ₹499/month" |
| **One-Time** | Single payment | "Premium Template — ₹999" |
| **Usage-Based** | Pay per action | "₹0.50 per SMS sent" |

### Revenue Split

```
Total Charge: ₹499/month
├── Developer: ₹399.20 (80%)
└── Platform:  ₹ 99.80 (20%)
```

LetBuyy charges a **20% commission** on all app revenue. This is calculated automatically during billing.

### Billing Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│ Merchant │     │   LetBuyy    │     │   App        │
│ Browser  │     │   Platform   │     │   Server     │
└────┬─────┘     └──────┬───────┘     └──────┬───────┘
     │                  │                    │
     │  1. Click "Upgrade to Pro"            │
     │──────────────────────────────────────▶│
     │                  │                    │
     │                  │  2. POST           │
     │                  │  /api/billing/     │
     │                  │  recurring-charge  │
     │                  │◀───────────────────│
     │                  │  { name: "Pro",    │
     │                  │    amount: 499,    │
     │                  │    trial_days: 7 } │
     │                  │                    │
     │                  │  3. Return         │
     │                  │  confirmation URL  │
     │                  │──────────────────▶ │
     │                  │                    │
     │  4. Redirect to confirmation page     │
     │◀──────────────────────────────────────│
     │                  │                    │
     │  ┌────────────────────────────┐       │
     │  │  Approve Charge            │       │
     │  │                            │       │
     │  │  Reviews Pro               │       │
     │  │  Pro Plan — ₹499/month     │       │
     │  │  7-day free trial          │       │
     │  │                            │       │
     │  │  [Decline]  [Approve]      │       │
     │  └────────────────────────────┘       │
     │                  │                    │
     │  5. Merchant approves                 │
     │──────────────────▶│                   │
     │                  │                    │
     │                  │  6. Activate charge│
     │                  │──────────────────▶ │
     │                  │  Webhook:          │
     │                  │  billing/activated │
     │                  │                    │
     │  7. Redirect back to app              │
     │◀──────────────────────────────────────│
```

### API Implementation

```typescript
// apps/web/app-store/src/app/api/billing/recurring-charge/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAppToken } from '@/lib/auth/app-token';
import { supabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  // Verify app's access token
  const appAuth = await verifyAppToken(req);
  if (!appAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    name,
    amount,
    currency = 'INR',
    interval = 'monthly',
    trial_days = 0,
    return_url,
    test = false,
  } = await req.json();

  // Validate
  if (!name || !amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid charge details' }, { status: 400 });
  }

  // Calculate commission
  const platformCommission = parseFloat((amount * 0.20).toFixed(2));
  const developerPayout = parseFloat((amount * 0.80).toFixed(2));

  // Trial end date
  const trialEndsAt = trial_days > 0
    ? new Date(Date.now() + trial_days * 86400000).toISOString()
    : null;

  // Create charge record
  const { data: charge, error } = await supabase
    .from('lb_app_charges')
    .insert({
      app_id: appAuth.appId,
      store_id: appAuth.storeId,
      installation_id: appAuth.installationId,
      charge_type: 'recurring',
      name,
      amount,
      currency,
      interval,
      trial_days,
      trial_ends_at: trialEndsAt,
      status: 'pending',
      platform_commission: platformCommission,
      developer_payout: developerPayout,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: 'Failed to create charge' }, { status: 500 });
  }

  // Build confirmation URL
  const confirmUrl = new URL('https://admin.letbuyy.store/billing/approve');
  confirmUrl.searchParams.set('charge_id', charge.id);
  confirmUrl.searchParams.set('return_url', return_url || '');

  return NextResponse.json({
    charge: {
      id: charge.id,
      name: charge.name,
      amount: charge.amount,
      currency: charge.currency,
      interval: charge.interval,
      trial_days: charge.trial_days,
      status: charge.status,
      confirmation_url: confirmUrl.toString(),
    },
  });
}
```

### Charge Approval Page

```typescript
// apps/web/admin/src/app/billing/approve/page.tsx

import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase/server';
import { ChargeApprovalCard } from '@/components/billing/ChargeApprovalCard';

export default async function ApproveChargePage({
  searchParams,
}: {
  searchParams: { charge_id: string; return_url?: string };
}) {
  const { data: charge } = await supabase
    .from('lb_app_charges')
    .select(`
      *,
      app:lb_apps!inner(name, icon_url, developer_name)
    `)
    .eq('id', searchParams.charge_id)
    .eq('status', 'pending')
    .single();

  if (!charge) {
    redirect('/apps');
  }

  return (
    <div className="billing-approve-page">
      <ChargeApprovalCard
        charge={charge}
        returnUrl={searchParams.return_url}
      />
    </div>
  );
}
```

### Usage-Based Billing

```typescript
// apps/web/app-store/src/app/api/billing/usage/route.ts
// Apps report usage, platform bills accordingly

import { NextRequest, NextResponse } from 'next/server';
import { verifyAppToken } from '@/lib/auth/app-token';
import { supabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const appAuth = await verifyAppToken(req);
  if (!appAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { charge_id, quantity, description } = await req.json();

  // Get existing charge
  const { data: charge } = await supabase
    .from('lb_app_charges')
    .select('*')
    .eq('id', charge_id)
    .eq('app_id', appAuth.appId)
    .eq('charge_type', 'usage')
    .eq('status', 'active')
    .single();

  if (!charge) {
    return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
  }

  // Check usage limit
  const newUsage = charge.usage_current + quantity;
  if (charge.usage_limit && newUsage > charge.usage_limit) {
    return NextResponse.json({
      error: 'Usage limit exceeded',
      current: charge.usage_current,
      limit: charge.usage_limit,
    }, { status: 429 });
  }

  // Update usage
  await supabase
    .from('lb_app_charges')
    .update({ usage_current: newUsage, updated_at: new Date().toISOString() })
    .eq('id', charge_id);

  return NextResponse.json({
    usage: {
      current: newUsage,
      limit: charge.usage_limit,
      remaining: charge.usage_limit ? charge.usage_limit - newUsage : null,
    },
  });
}
```

### Billing Dashboard (Merchant View)

```
┌───────────────────────────────────────────────────────────────┐
│  💳 App Billing                                               │
│───────────────────────────────────────────────────────────────│
│                                                               │
│  Active Subscriptions                                         │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ 📊 Reviews Pro         Pro Plan     ₹499/mo  [Manage]  │  │
│  │ 📧 MailBlast           Starter      ₹199/mo  [Manage]  │  │
│  │ 🚚 ShipFast            Free Trial   ₹0/mo    [Manage]  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Usage This Month                                             │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │ SMS Credits            1,247 / 5,000         ₹623.50   │  │
│  │ API Calls              89,432 / unlimited     ₹447.16  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
│  Total This Month: ₹1,768.66                                 │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 12. API Versioning

### Overview

The LetBuyy App API uses **date-based versioning** (modeled on Shopify's approach). Every API release is tagged with a year-month identifier (e.g., `2026-02`). This ensures that apps continue to work even as the platform evolves.

### Version Format

```
https://admin.letbuyy.store/api/{version}/{resource}.json

Examples:
  https://admin.letbuyy.store/api/2026-02/products.json
  https://admin.letbuyy.store/api/2026-02/orders.json
  https://admin.letbuyy.store/api/2026-06/products.json
```

### Version Lifecycle

| Phase | Duration | Description |
|---|---|---|
| **Release Candidate** | 2 months before | Available for testing, may change |
| **Stable** | 12 months | Fully supported, no breaking changes |
| **Deprecated** | 6 months after | Still works, migration warnings issued |
| **Removed** | After deprecated | Returns 410 Gone |

### Version Routing Middleware

```typescript
// apps/web/admin/src/app/api/[version]/[...resource]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyAppToken } from '@/lib/auth/app-token';

const SUPPORTED_VERSIONS = ['2026-02', '2026-06'];
const DEPRECATED_VERSIONS = ['2025-10'];
const CURRENT_VERSION = '2026-02';

export async function GET(
  req: NextRequest,
  { params }: { params: { version: string; resource: string[] } }
) {
  const { version, resource } = params;

  // ── 1. Version validation ──
  if (DEPRECATED_VERSIONS.includes(version)) {
    // Still works but warn
    const response = await handleResource(req, version, resource);
    response.headers.set('X-LB-API-Deprecated', 'true');
    response.headers.set(
      'X-LB-API-Sunset',
      '2026-04-01'
    );
    response.headers.set(
      'X-LB-API-Latest',
      CURRENT_VERSION
    );
    return response;
  }

  if (!SUPPORTED_VERSIONS.includes(version)) {
    return NextResponse.json({
      error: 'api_version_unsupported',
      message: `API version "${version}" is not supported. Current version: ${CURRENT_VERSION}`,
      supported: SUPPORTED_VERSIONS,
    }, { status: 410 });
  }

  // ── 2. Authentication ──
  const appAuth = await verifyAppToken(req);
  if (!appAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 3. Scope check ──
  const requiredScope = getRequiredScope(resource[0]);
  if (requiredScope && !appAuth.scopes.includes(requiredScope)) {
    return NextResponse.json({
      error: 'insufficient_scope',
      required: requiredScope,
      granted: appAuth.scopes,
    }, { status: 403 });
  }

  // ── 4. Handle resource ──
  return handleResource(req, version, resource, appAuth);
}

function getRequiredScope(resource: string): string | null {
  const scopeMap: Record<string, string> = {
    'products': 'products',
    'orders': 'orders',
    'customers': 'customers',
    'themes': 'themes',
    'content': 'content',
    'analytics': 'analytics',
    'settings': 'settings',
    'discounts': 'discounts',
    'checkout': 'checkout',
  };
  return scopeMap[resource] || null;
}

async function handleResource(
  req: NextRequest,
  version: string,
  resource: string[],
  auth?: { appId: string; storeId: string; scopes: string[] }
): Promise<NextResponse> {
  const [resourceType, resourceId] = resource;

  // Route to versioned handlers
  switch (resourceType) {
    case 'products.json':
    case 'products':
      return handleProducts(req, version, resourceId, auth!);
    case 'orders.json':
    case 'orders':
      return handleOrders(req, version, resourceId, auth!);
    case 'customers.json':
    case 'customers':
      return handleCustomers(req, version, resourceId, auth!);
    default:
      return NextResponse.json(
        { error: 'Resource not found' },
        { status: 404 }
      );
  }
}
```

### API Rate Limiting

```typescript
// Rate limits per app per store

const RATE_LIMITS = {
  free: {
    requests_per_second: 2,
    daily_limit: 10_000,
    burst: 10,
  },
  starter: {
    requests_per_second: 4,
    daily_limit: 50_000,
    burst: 20,
  },
  pro: {
    requests_per_second: 10,
    daily_limit: 200_000,
    burst: 40,
  },
  enterprise: {
    requests_per_second: 20,
    daily_limit: 1_000_000,
    burst: 80,
  },
};

// Rate limit headers in every response:
// X-LB-RateLimit-Limit: 10        (max per second)
// X-LB-RateLimit-Remaining: 7     (requests left this second)
// X-LB-RateLimit-Reset: 1708012345 (epoch when bucket resets)
// Retry-After: 1                   (seconds to wait, only on 429)
```

### Version Migration Guide

When a new version is released, apps receive:

1. **Email notification** to the developer
2. **Changelog** published at `apps.letbuyy.store/api/changelog`
3. **Deprecation headers** on API responses
4. **12-month window** to migrate

```typescript
// Example: Version difference handling

// v2026-02 response
{
  "product": {
    "id": "prod_abc",
    "title": "T-Shirt",
    "price": 999,
    "variants": [...]
  }
}

// v2026-06 response (added fields)
{
  "product": {
    "id": "prod_abc",
    "title": "T-Shirt",
    "price": 999,
    "price_formatted": "₹999",
    "currency": "INR",
    "variants": [...],
    "seo": {
      "title": "T-Shirt | Urban Kicks",
      "description": "..."
    }
  }
}
```

---

<!-- END PART 2 — Sections 7–12 Complete -->

---
---

# PART 3 — App Extensions

<!-- Sections 13–18 -->

---

## 13. Storefront Extensions

### Overview

Storefront extensions let apps inject UI into a merchant's online store. There are two types:

| Type | Scope | Example |
|---|---|---|
| **App Block** | Section-level, placed in theme editor | Review widget, size chart, wishlist button |
| **App Embed** | Global, auto-injected on every page | Chat widget, analytics pixel, notification bar |

### Storefront App Block

```typescript
// packages/extension-sdk/src/StorefrontBlock.ts

interface StorefrontBlockConfig {
  name: string;
  target: string;           // placement target
  settings: SettingField[];  // merchant-configurable settings
  entryPoint: string;        // URL that renders the block HTML
  maxInstances?: number;     // how many times it can be added (default: 1)
  previewImageUrl?: string;  // shown in theme editor
}

interface SettingField {
  type: 'text' | 'number' | 'color' | 'select' | 'checkbox' | 'range' | 'image';
  id: string;
  label: string;
  default?: string | number | boolean;
  options?: Array<{ label: string; value: string }>;
  info?: string;
  min?: number;
  max?: number;
  step?: number;
}
```

### Available Placement Targets

```
┌──────────────────────────────────────────────────┐
│  Header                                          │
│  ┌──────────────────────────────────────────┐    │
│  │  header.above                            │    │
│  └──────────────────────────────────────────┘    │
│  ┌──────────────────────────────────────────┐    │
│  │  header.below                            │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Product Page                                    │
│  ┌──────────────────────────────────────────┐    │
│  │  product.above_title                     │    │
│  │  ┌────────────┐                          │    │
│  │  │  Image     │  Title                   │    │
│  │  │            │  product.below_title     │    │
│  │  │            │  Price                   │    │
│  │  │            │  product.below_price     │    │
│  │  │            │  Add to Cart             │    │
│  │  │            │  product.below_add_cart  │    │
│  │  └────────────┘                          │    │
│  │  product.below_description               │    │
│  │  product.reviews                         │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Collection Page                                 │
│  ┌──────────────────────────────────────────┐    │
│  │  collection.above_products               │    │
│  │  [Product Grid]                          │    │
│  │  collection.below_products               │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Cart Page                                       │
│  ┌──────────────────────────────────────────┐    │
│  │  cart.above_items                        │    │
│  │  [Cart Items]                            │    │
│  │  cart.below_items                        │    │
│  │  cart.above_checkout_button              │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  Footer                                          │
│  ┌──────────────────────────────────────────┐    │
│  │  footer.above                            │    │
│  └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────┘
```

### Block Rendering Pipeline

```typescript
// apps/web/storefront/src/lib/extensions/renderBlocks.ts

import { supabase } from '@/lib/supabase/server';

interface RenderedBlock {
  html: string;
  css?: string;
  js?: string;
  appSlug: string;
  extensionId: string;
}

export async function renderStorefrontBlocks(
  storeId: string,
  target: string,
  context: Record<string, unknown>
): Promise<RenderedBlock[]> {
  // ── 1. Get active extensions for this target ──
  const { data: extensions } = await supabase
    .from('lb_app_extensions')
    .select(`
      id, name, entry_point, config_schema, default_config, version,
      app:lb_apps!inner(slug, name, status),
      installations:lb_app_installations!inner(
        id, granted_scopes, status,
        store_config:lb_app_extension_configs(config)
      )
    `)
    .eq('type', 'storefront_block')
    .eq('target', target)
    .eq('status', 'active')
    .eq('app.status', 'published')
    .eq('installations.store_id', storeId)
    .eq('installations.status', 'active');

  if (!extensions?.length) return [];

  // ── 2. Fetch each block's rendered HTML ──
  const blocks = await Promise.all(
    extensions.map(async (ext) => {
      const config = {
        ...ext.default_config,
        ...(ext.installations[0]?.store_config?.[0]?.config || {}),
      };

      try {
        const response = await fetch(ext.entry_point, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-LB-Extension-Id': ext.id,
            'X-LB-Store-Id': storeId,
          },
          body: JSON.stringify({
            target,
            config,
            context, // product, collection, cart data
          }),
        });

        if (!response.ok) return null;

        const { html, css, js } = await response.json();

        return {
          html,
          css,
          js,
          appSlug: ext.app.slug,
          extensionId: ext.id,
        };
      } catch {
        return null;
      }
    })
  );

  return blocks.filter(Boolean) as RenderedBlock[];
}
```

### Embedding Blocks in Theme Templates

```liquid
{%- comment -%} Theme template: product.liquid {%- endcomment -%}

<div class="product-page">
  {%- render_app_blocks target: "product.above_title" -%}

  <h1>{{ product.title }}</h1>

  {%- render_app_blocks target: "product.below_title" -%}

  <p class="price">{{ product.price | money }}</p>

  {%- render_app_blocks target: "product.below_price" -%}

  <button class="add-to-cart">Add to Cart</button>

  {%- render_app_blocks target: "product.below_add_cart" -%}

  <div class="description">{{ product.description }}</div>

  {%- render_app_blocks target: "product.below_description" -%}

  {%- render_app_blocks target: "product.reviews" -%}
</div>
```

### Storefront App Embed (Global)

```typescript
// Global embeds are auto-injected in the <head> or before </body>

interface StorefrontEmbedConfig {
  name: string;
  position: 'head' | 'body_start' | 'body_end';
  entryPoint: string;      // JavaScript file URL
  settings: SettingField[];
}

// Example: Chat widget embed
const chatWidgetEmbed: StorefrontEmbedConfig = {
  name: 'Live Chat Widget',
  position: 'body_end',
  entryPoint: 'https://chat-app.example.com/widget.js',
  settings: [
    { type: 'color', id: 'brand_color', label: 'Brand Color', default: '#4F46E5' },
    { type: 'select', id: 'position', label: 'Position', default: 'bottom-right',
      options: [
        { label: 'Bottom Right', value: 'bottom-right' },
        { label: 'Bottom Left', value: 'bottom-left' },
      ]
    },
    { type: 'checkbox', id: 'show_on_mobile', label: 'Show on mobile', default: true },
  ],
};
```

### Embed Injection in Layout

```html
<!-- apps/web/storefront/src/app/layout.tsx excerpt -->

<!-- Head embeds -->
{appEmbeds.filter(e => e.position === 'head').map(embed => (
  <script
    key={embed.id}
    src={embed.entryPoint}
    data-lb-extension={embed.id}
    data-lb-config={JSON.stringify(embed.config)}
    data-lb-store={store.subdomain}
    async
  />
))}

<!-- Body-end embeds -->
{appEmbeds.filter(e => e.position === 'body_end').map(embed => (
  <script
    key={embed.id}
    src={embed.entryPoint}
    data-lb-extension={embed.id}
    data-lb-config={JSON.stringify(embed.config)}
    data-lb-store={store.subdomain}
    async
  />
))}
```

---

## 14. Checkout UI Extensions

### Overview

Checkout extensions let apps customize the checkout experience. Unlike storefront blocks (which are full HTML), checkout extensions use a **component-based model** for security and consistency.

### Extension Points

```
┌──────────────────────────────────────────────────┐
│  CHECKOUT                                        │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  checkout.header                         │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──── Contact ─────────────────────────────┐    │
│  │  checkout.contact.before                 │    │
│  │  [Email / Phone Input]                   │    │
│  │  checkout.contact.after                  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──── Shipping ────────────────────────────┐    │
│  │  checkout.shipping.before                │    │
│  │  [Shipping Address Form]                 │    │
│  │  checkout.shipping.after                 │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──── Payment ─────────────────────────────┐    │
│  │  checkout.payment.before                 │    │
│  │  [Payment Methods]                       │    │
│  │  checkout.payment.after                  │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──── Order Summary ───────────────────────┐    │
│  │  checkout.order_summary.before           │    │
│  │  [Line Items + Totals]                   │    │
│  │  checkout.order_summary.after            │    │
│  │  checkout.order_summary.line_item        │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  checkout.footer                         │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Checkout Extension Component API

```typescript
// packages/extension-sdk/src/CheckoutExtension.ts

interface CheckoutExtensionConfig {
  name: string;
  target: string;      // e.g., "checkout.shipping.after"
  entryPoint: string;  // URL to the extension's render endpoint
  settings: SettingField[];
}

// Available UI components for checkout extensions (sandboxed)
type CheckoutUIComponent =
  | { type: 'Banner'; status: 'info' | 'warning' | 'success' | 'critical'; title: string; children?: string }
  | { type: 'BlockStack'; spacing: 'none' | 'tight' | 'base' | 'loose'; children: CheckoutUIComponent[] }
  | { type: 'InlineStack'; spacing: string; children: CheckoutUIComponent[] }
  | { type: 'Text'; children: string; size?: 'small' | 'base' | 'large'; emphasis?: 'bold' | 'italic' }
  | { type: 'Checkbox'; id: string; label: string; checked?: boolean }
  | { type: 'TextField'; id: string; label: string; value?: string; type?: 'text' | 'number' | 'email' }
  | { type: 'Select'; id: string; label: string; options: Array<{ label: string; value: string }> }
  | { type: 'Divider' }
  | { type: 'Image'; source: string; alt: string; aspectRatio?: number }
  | { type: 'Button'; label: string; kind?: 'primary' | 'secondary'; onPress: string };

// Extension output format
interface CheckoutExtensionOutput {
  components: CheckoutUIComponent[];
  // Optional: modify checkout attributes
  transformations?: {
    addLineItemProperties?: Record<string, string>;
    addOrderAttributes?: Record<string, string>;
    applyDiscount?: { code: string };
  };
}
```

### Example: Gift Wrapping Extension

```typescript
// Extension endpoint: POST /api/extensions/checkout/gift-wrap

export async function POST(req: Request) {
  const { target, config, context } = await req.json();
  const { checkout } = context; // contains cart items, shipping, etc.

  const components: CheckoutUIComponent[] = [
    {
      type: 'BlockStack',
      spacing: 'base',
      children: [
        {
          type: 'Banner',
          status: 'info',
          title: '🎁 Gift Wrapping Available',
          children: `Add beautiful gift wrapping for just ₹${config.price || 49}`,
        },
        {
          type: 'Checkbox',
          id: 'gift_wrap',
          label: `Add gift wrapping (+₹${config.price || 49})`,
          checked: false,
        },
        {
          type: 'TextField',
          id: 'gift_message',
          label: 'Gift message (optional)',
          value: '',
          type: 'text',
        },
      ],
    },
  ];

  return Response.json({
    components,
    transformations: {
      addOrderAttributes: {
        'gift_wrap': 'false',
        'gift_message': '',
      },
    },
  });
}
```

### Checkout Extension Renderer

```typescript
// apps/web/storefront/src/components/checkout/ExtensionRenderer.tsx

'use client';

import { useEffect, useState } from 'react';

interface ExtensionRendererProps {
  extensionId: string;
  target: string;
  context: Record<string, unknown>;
}

export function CheckoutExtensionRenderer({
  extensionId,
  target,
  context,
}: ExtensionRendererProps) {
  const [components, setComponents] = useState<CheckoutUIComponent[]>([]);

  useEffect(() => {
    fetchExtension();
  }, [extensionId, target]);

  async function fetchExtension() {
    const res = await fetch(`/api/checkout/extensions/${extensionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target, context }),
    });

    if (res.ok) {
      const { components } = await res.json();
      setComponents(components);
    }
  }

  return (
    <div className="checkout-extension" data-extension={extensionId}>
      {components.map((component, i) => renderComponent(component, i))}
    </div>
  );
}

function renderComponent(component: CheckoutUIComponent, key: number): JSX.Element {
  switch (component.type) {
    case 'Banner':
      return (
        <div key={key} className={`checkout-banner checkout-banner--${component.status}`}>
          <strong>{component.title}</strong>
          {component.children && <p>{component.children}</p>}
        </div>
      );
    case 'BlockStack':
      return (
        <div key={key} className={`checkout-stack checkout-stack--${component.spacing}`}>
          {component.children.map((child, i) => renderComponent(child, i))}
        </div>
      );
    case 'Text':
      return (
        <span key={key} className={`checkout-text checkout-text--${component.size || 'base'}`}>
          {component.children}
        </span>
      );
    case 'Checkbox':
      return (
        <label key={key} className="checkout-checkbox">
          <input type="checkbox" id={component.id} defaultChecked={component.checked} />
          <span>{component.label}</span>
        </label>
      );
    case 'TextField':
      return (
        <div key={key} className="checkout-field">
          <label htmlFor={component.id}>{component.label}</label>
          <input type={component.type || 'text'} id={component.id} defaultValue={component.value} />
        </div>
      );
    case 'Divider':
      return <hr key={key} className="checkout-divider" />;
    default:
      return <div key={key} />;
  }
}
```

---

## 15. Post-Purchase Extensions

### Overview

Post-purchase extensions display a **one-time offer page** between checkout completion and the order confirmation page. This is a proven conversion technique for upsells.

### Flow

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  Order Placed  →  Post-Purchase Page  →  Thank   │
│  (payment      (upsell offer shown      You      │
│   captured)     for 60 seconds)          page     │
│                                                  │
│  ┌────────────────────────────────────────────┐  │
│  │          🎉 Order Confirmed!              │  │
│  │                                            │  │
│  │  Before you go...                          │  │
│  │                                            │  │
│  │  ┌──────────────────────────────────────┐  │  │
│  │  │  [Product Image]                     │  │  │
│  │  │                                      │  │  │
│  │  │  Matching Belt                       │  │  │
│  │  │  ₹799  →  ₹499 (37% off!)           │  │  │
│  │  │                                      │  │  │
│  │  │  ⏱️  Offer expires in 0:47           │  │  │
│  │  │                                      │  │  │
│  │  │  [Add to Order]  [No thanks]         │  │  │
│  │  └──────────────────────────────────────┘  │  │
│  │                                            │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
└──────────────────────────────────────────────────┘
```

### Post-Purchase Extension API

```typescript
// packages/extension-sdk/src/PostPurchaseExtension.ts

interface PostPurchaseConfig {
  name: string;
  entryPoint: string;
  settings: SettingField[];
}

interface PostPurchaseContext {
  orderId: string;
  orderNumber: string;
  totalPrice: number;
  currency: string;
  lineItems: Array<{
    productId: string;
    variantId: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  customer: {
    id: string;
    email: string;
    firstName: string;
  };
  shippingAddress: Record<string, string>;
}

interface PostPurchaseOffer {
  title: string;
  description: string;
  productId: string;
  variantId: string;
  originalPrice: number;
  offerPrice: number;
  imageUrl: string;
  expiresInSeconds: number;
  ctaText: string;
  declineText: string;
}
```

### Post-Purchase Handler

```typescript
// apps/web/storefront/src/app/api/post-purchase/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  const { order_id, store_id } = await req.json();

  // ── 1. Get post-purchase extensions ──
  const { data: extensions } = await supabase
    .from('lb_app_extensions')
    .select(`
      id, entry_point, default_config,
      app:lb_apps!inner(slug, name)
    `)
    .eq('type', 'post_purchase')
    .eq('status', 'active')
    .eq('app.status', 'published');

  if (!extensions?.length) {
    return NextResponse.json({ show: false });
  }

  // ── 2. Get order context ──
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', order_id)
    .single();

  // ── 3. Ask each extension if they have an offer ──
  for (const ext of extensions) {
    try {
      const response = await fetch(ext.entry_point, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'should_render',
          context: {
            orderId: order.id,
            orderNumber: order.order_number,
            totalPrice: order.total_price,
            lineItems: order.line_items,
          },
        }),
      });

      const result = await response.json();
      if (result.show && result.offer) {
        return NextResponse.json({
          show: true,
          extensionId: ext.id,
          appSlug: ext.app.slug,
          offer: result.offer,
        });
      }
    } catch {
      continue;
    }
  }

  return NextResponse.json({ show: false });
}
```

### Accepting Post-Purchase Offers

```typescript
// apps/web/storefront/src/app/api/post-purchase/accept/route.ts

export async function POST(req: NextRequest) {
  const { order_id, extension_id, variant_id, offer_price } = await req.json();

  // ── 1. Validate offer is still valid ──
  // ── 2. Add item to existing order ──
  // ── 3. Charge the additional amount ──
  // ── 4. Notify the app ──

  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', order_id)
    .single();

  // Add the upsell item to the order
  const updatedLineItems = [
    ...order.line_items,
    {
      variant_id,
      quantity: 1,
      price: offer_price,
      title: 'Post-purchase upsell',
      is_upsell: true,
    },
  ];

  await supabase
    .from('orders')
    .update({
      line_items: updatedLineItems,
      total_price: order.total_price + offer_price,
      updated_at: new Date().toISOString(),
    })
    .eq('id', order_id);

  return NextResponse.json({ success: true });
}
```

---

## 16. Admin Extensions

### Overview

Admin extensions let apps add UI inside the `admin.letbuyy.store` panel. Two types:

| Type | Description | Example |
|---|---|---|
| **Admin Link** | Navigation item in admin sidebar | "Reviews Dashboard" in sidebar |
| **Admin Block** | Embedded content within admin pages | Product metadata card, order notes |

### Admin Link Extension

```typescript
// Admin link: adds an entry to the admin sidebar under "Apps"

interface AdminLinkExtension {
  type: 'admin_link';
  name: string;                     // "Reviews Dashboard"
  icon?: string;                    // Lucide icon name
  label: string;                    // Sidebar label
  destination: string;              // Route within the app
  subLinks?: Array<{
    label: string;
    destination: string;
  }>;
}

// Example registration
const reviewsAdminLink: AdminLinkExtension = {
  type: 'admin_link',
  name: 'Reviews Dashboard',
  icon: 'Star',
  label: 'Reviews',
  destination: '/apps/reviews-pro',
  subLinks: [
    { label: 'All Reviews', destination: '/apps/reviews-pro/reviews' },
    { label: 'Settings', destination: '/apps/reviews-pro/settings' },
    { label: 'Analytics', destination: '/apps/reviews-pro/analytics' },
  ],
};
```

### Admin Sidebar Integration

```typescript
// apps/web/admin/src/components/Sidebar/AppLinksSection.tsx

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import * as Icons from 'lucide-react';

interface AppLink {
  appSlug: string;
  appName: string;
  icon: string;
  label: string;
  destination: string;
  subLinks: Array<{ label: string; destination: string }>;
}

export function AppLinksSection({ storeId }: { storeId: string }) {
  const [appLinks, setAppLinks] = useState<AppLink[]>([]);

  useEffect(() => {
    fetch(`/api/apps/admin-links?store_id=${storeId}`)
      .then(res => res.json())
      .then(data => setAppLinks(data.links));
  }, [storeId]);

  if (!appLinks.length) return null;

  return (
    <div className="sidebar-section">
      <h3 className="sidebar-section-title">Apps</h3>
      {appLinks.map(link => {
        const IconComponent = Icons[link.icon as keyof typeof Icons] || Icons.Puzzle;
        return (
          <div key={link.appSlug} className="sidebar-app-link">
            <Link href={link.destination} className="sidebar-link">
              <IconComponent size={18} />
              <span>{link.label}</span>
            </Link>
            {link.subLinks?.map(sub => (
              <Link
                key={sub.destination}
                href={sub.destination}
                className="sidebar-link sidebar-link--sub"
              >
                {sub.label}
              </Link>
            ))}
          </div>
        );
      })}
    </div>
  );
}
```

### Admin Block Extension

```typescript
// Admin blocks: embedded content within admin pages (e.g., product detail)

interface AdminBlockExtension {
  type: 'admin_block';
  name: string;
  target: string;          // e.g., "product.sidebar", "order.details"
  entryPoint: string;      // URL rendered in an iframe
  height?: number;         // default iframe height
  settings: SettingField[];
}

// Available admin block targets:
// product.sidebar       — right sidebar on product detail page
// product.bottom        — below product form
// order.sidebar         — right sidebar on order detail page
// order.bottom          — below order details
// customer.sidebar      — right sidebar on customer detail page
// customer.bottom       — below customer details
// dashboard.card        — dashboard overview card

// Example: SEO analysis block on product page
const seoBlock: AdminBlockExtension = {
  type: 'admin_block',
  name: 'SEO Analyzer',
  target: 'product.sidebar',
  entryPoint: 'https://seo-app.example.com/admin-block',
  height: 300,
  settings: [
    { type: 'checkbox', id: 'auto_analyze', label: 'Auto-analyze on save', default: true },
    { type: 'select', id: 'target_locale', label: 'Target locale', default: 'en',
      options: [
        { label: 'English', value: 'en' },
        { label: 'Hindi', value: 'hi' },
      ]
    },
  ],
};
```

### Admin Block Renderer

```typescript
// apps/web/admin/src/components/AdminBlock/AdminBlockFrame.tsx

'use client';

import { useRef, useEffect, useState } from 'react';

interface AdminBlockFrameProps {
  extensionId: string;
  entryPoint: string;
  appSlug: string;
  height?: number;
  context: Record<string, unknown>;
}

export function AdminBlockFrame({
  extensionId,
  entryPoint,
  appSlug,
  height = 300,
  context,
}: AdminBlockFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [dynamicHeight, setDynamicHeight] = useState(height);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.source !== 'letbuyy-admin-block') return;
      if (event.data?.extensionId !== extensionId) return;

      if (event.data.type === 'RESIZE') {
        setDynamicHeight(event.data.height);
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [extensionId]);

  const blockUrl = new URL(entryPoint);
  blockUrl.searchParams.set('extension_id', extensionId);
  blockUrl.searchParams.set('context', btoa(JSON.stringify(context)));

  return (
    <div className="admin-block" data-app={appSlug}>
      <div className="admin-block__header">
        <span className="admin-block__app-name">{appSlug}</span>
      </div>
      <iframe
        ref={iframeRef}
        src={blockUrl.toString()}
        title={`${appSlug} extension`}
        className="admin-block__iframe"
        style={{ height: `${dynamicHeight}px` }}
        sandbox="allow-scripts allow-same-origin allow-forms"
      />
    </div>
  );
}
```

---

## 17. Extension SDK

### Overview

The **LetBuyy Extension SDK** (`@letbuyy/extension-sdk`) provides a unified framework for building all extension types. It handles registration, configuration, communication, and rendering.

### Package Structure

```
packages/extension-sdk/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── Extension.ts               # Base extension class
│   ├── types/
│   │   ├── storefront.ts          # Storefront block/embed types
│   │   ├── checkout.ts            # Checkout extension types
│   │   ├── post-purchase.ts       # Post-purchase types
│   │   ├── admin.ts               # Admin link/block types
│   │   └── settings.ts            # Setting field types
│   ├── components/
│   │   ├── Banner.ts
│   │   ├── BlockStack.ts
│   │   ├── Text.ts
│   │   ├── Button.ts
│   │   ├── TextField.ts
│   │   ├── Checkbox.ts
│   │   └── Select.ts
│   └── utils/
│       ├── context.ts             # Context helpers
│       ├── api.ts                 # API client
│       └── validation.ts          # Config validation
└── dist/
```

### Extension Registration

```typescript
// packages/extension-sdk/src/Extension.ts

import type { SettingField } from './types/settings';

interface ExtensionManifest {
  name: string;
  type: 'storefront_block' | 'storefront_embed' | 'checkout_ui' | 'post_purchase' | 'admin_link' | 'admin_block';
  target?: string;
  version: string;
  entryPoint: string;
  settings?: SettingField[];
  maxInstances?: number;
}

// toml config file for declaring extensions
// letbuyy.extension.toml

/*
name = "Reviews Widget"
type = "storefront_block"
target = "product.reviews"
version = "1.0.0"

[[settings]]
type = "select"
id = "layout"
label = "Layout"
default = "grid"

  [[settings.options]]
  label = "Grid"
  value = "grid"

  [[settings.options]]
  label = "List"
  value = "list"

  [[settings.options]]
  label = "Carousel"
  value = "carousel"

[[settings]]
type = "range"
id = "reviews_per_page"
label = "Reviews per page"
min = 5
max = 50
step = 5
default = 10

[[settings]]
type = "color"
id = "star_color"
label = "Star Color"
default = "#F59E0B"

[[settings]]
type = "checkbox"
id = "show_photos"
label = "Show review photos"
default = true
*/
```

### CLI Tool for Extensions

```bash
# Install the LetBuyy CLI
npm install -g @letbuyy/cli

# Create a new extension
lb extension create reviews-widget --type storefront_block

# Development server with hot reload
lb extension dev

# Validate extension manifest
lb extension validate

# Deploy extension to LetBuyy
lb extension deploy

# Check extension status
lb extension status
```

### Extension Development Server

```typescript
// @letbuyy/cli — extension dev command

import express from 'express';
import { readTomlConfig } from './utils/config';
import { createTunnel } from './utils/tunnel';

async function startExtensionDev(options: { port?: number }) {
  const port = options.port || 3100;
  const config = readTomlConfig('letbuyy.extension.toml');

  const app = express();

  // Serve extension assets
  app.use('/assets', express.static('./dist'));

  // Extension render endpoint
  app.post('/render', async (req, res) => {
    const { target, config: extensionConfig, context } = req.body;

    // Call the developer's render function
    const { renderExtension } = await import('./src/index');
    const output = await renderExtension({ target, config: extensionConfig, context });

    res.json(output);
  });

  // Settings schema endpoint
  app.get('/settings', (req, res) => {
    res.json({ settings: config.settings });
  });

  app.listen(port, () => {
    console.log(`Extension dev server running at http://localhost:${port}`);
  });

  // Create tunnel for testing with live store
  const tunnelUrl = await createTunnel(port);
  console.log(`Tunnel URL: ${tunnelUrl}`);
  console.log(`Use this URL as your extension entry point in the LetBuyy partner dashboard`);
}
```

---

## 18. Extension Settings & Configuration

### Overview

Extension settings allow merchants to customize how an app extension behaves within their store. Settings are defined by the developer and rendered in the LetBuyy admin.

### Setting Field Types

| Type | UI Component | Value Type |
|---|---|---|
| `text` | Single-line input | `string` |
| `textarea` | Multi-line input | `string` |
| `number` | Number input | `number` |
| `range` | Slider | `number` |
| `color` | Color picker | `string` (hex) |
| `select` | Dropdown | `string` |
| `checkbox` | Toggle switch | `boolean` |
| `image` | Image picker | `string` (URL) |
| `product` | Product picker | `string` (product ID) |
| `collection` | Collection picker | `string` (collection ID) |
| `richtext` | Rich text editor | `string` (HTML) |

### Settings Storage

```sql
-- Extension configuration per store
CREATE TABLE IF NOT EXISTS lb_app_extension_configs (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    extension_id    UUID NOT NULL REFERENCES lb_app_extensions(id) ON DELETE CASCADE,
    installation_id UUID NOT NULL REFERENCES lb_app_installations(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    -- Merchant-customized settings
    config          JSONB NOT NULL DEFAULT '{}',

    -- Placement (for blocks)
    sort_order      INTEGER DEFAULT 0,
    is_enabled      BOOLEAN DEFAULT true,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(extension_id, store_id)
);
```

### Settings Editor Component

```typescript
// apps/web/admin/src/components/ExtensionSettings/SettingsEditor.tsx

'use client';

import { useState } from 'react';

interface SettingsEditorProps {
  extensionId: string;
  schema: SettingField[];
  values: Record<string, unknown>;
  onSave: (values: Record<string, unknown>) => Promise<void>;
}

export function ExtensionSettingsEditor({
  extensionId,
  schema,
  values,
  onSave,
}: SettingsEditorProps) {
  const [formValues, setFormValues] = useState(values);
  const [saving, setSaving] = useState(false);

  const handleChange = (id: string, value: unknown) => {
    setFormValues(prev => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(formValues);
    setSaving(false);
  };

  return (
    <div className="extension-settings">
      {schema.map(field => (
        <div key={field.id} className="extension-settings__field">
          <label htmlFor={field.id}>{field.label}</label>
          {field.info && <p className="field-info">{field.info}</p>}

          {field.type === 'text' && (
            <input
              type="text"
              id={field.id}
              value={(formValues[field.id] as string) || ''}
              onChange={e => handleChange(field.id, e.target.value)}
            />
          )}

          {field.type === 'number' && (
            <input
              type="number"
              id={field.id}
              value={(formValues[field.id] as number) || 0}
              min={field.min}
              max={field.max}
              step={field.step}
              onChange={e => handleChange(field.id, Number(e.target.value))}
            />
          )}

          {field.type === 'range' && (
            <div className="range-field">
              <input
                type="range"
                id={field.id}
                value={(formValues[field.id] as number) || field.default || 0}
                min={field.min}
                max={field.max}
                step={field.step}
                onChange={e => handleChange(field.id, Number(e.target.value))}
              />
              <span>{formValues[field.id] as number}</span>
            </div>
          )}

          {field.type === 'color' && (
            <div className="color-field">
              <input
                type="color"
                id={field.id}
                value={(formValues[field.id] as string) || '#000000'}
                onChange={e => handleChange(field.id, e.target.value)}
              />
              <span>{formValues[field.id] as string}</span>
            </div>
          )}

          {field.type === 'select' && (
            <select
              id={field.id}
              value={(formValues[field.id] as string) || ''}
              onChange={e => handleChange(field.id, e.target.value)}
            >
              {field.options?.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}

          {field.type === 'checkbox' && (
            <label className="checkbox-toggle">
              <input
                type="checkbox"
                id={field.id}
                checked={(formValues[field.id] as boolean) || false}
                onChange={e => handleChange(field.id, e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          )}
        </div>
      ))}

      <button onClick={handleSave} disabled={saving} className="btn-primary">
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
```

### Settings API Endpoint

```typescript
// apps/web/admin/src/app/api/apps/extensions/[extensionId]/settings/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/server';

// GET — retrieve current settings
export async function GET(
  req: NextRequest,
  { params }: { params: { extensionId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: config } = await supabase
    .from('lb_app_extension_configs')
    .select('config, is_enabled, sort_order')
    .eq('extension_id', params.extensionId)
    .eq('store_id', session.store_id)
    .single();

  // Get default config from extension definition
  const { data: extension } = await supabase
    .from('lb_app_extensions')
    .select('config_schema, default_config')
    .eq('id', params.extensionId)
    .single();

  return NextResponse.json({
    schema: extension?.config_schema || [],
    values: {
      ...extension?.default_config,
      ...(config?.config || {}),
    },
    isEnabled: config?.is_enabled ?? true,
  });
}

// PUT — save settings
export async function PUT(
  req: NextRequest,
  { params }: { params: { extensionId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { config, is_enabled } = await req.json();

  // Get installation ID
  const { data: installation } = await supabase
    .from('lb_app_installations')
    .select('id')
    .eq('store_id', session.store_id)
    .eq('status', 'active')
    .single();

  if (!installation) {
    return NextResponse.json({ error: 'App not installed' }, { status: 404 });
  }

  await supabase
    .from('lb_app_extension_configs')
    .upsert({
      extension_id: params.extensionId,
      installation_id: installation.id,
      store_id: session.store_id,
      config,
      is_enabled: is_enabled ?? true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'extension_id,store_id' });

  return NextResponse.json({ success: true });
}
```

---

<!-- END PART 3 — Sections 13–18 Complete -->

---
---

# PART 4 — App Store Marketplace

<!-- Sections 19–24 -->

---

## 19. Developer Portal

### Overview

The Developer Portal is the hub where third-party developers register, create apps, manage API keys, monitor app performance, and submit apps for review.

### Portal Routes

```
apps/web/app-store/src/app/developers/
├── page.tsx                     # Developer dashboard
├── register/
│   └── page.tsx                 # Developer registration
├── apps/
│   ├── page.tsx                 # List all my apps
│   ├── new/
│   │   └── page.tsx             # Create new app
│   └── [appId]/
│       ├── page.tsx             # App overview
│       ├── edit/
│       │   └── page.tsx         # Edit app details
│       ├── extensions/
│       │   ├── page.tsx         # Manage extensions
│       │   └── new/
│       │       └── page.tsx     # Add extension
│       ├── versions/
│       │   ├── page.tsx         # Version history
│       │   └── new/
│       │       └── page.tsx     # Create new version
│       ├── analytics/
│       │   └── page.tsx         # App analytics
│       ├── reviews/
│       │   └── page.tsx         # User reviews
│       ├── billing/
│       │   └── page.tsx         # Revenue & payouts
│       └── submit/
│           └── page.tsx         # Submit for review
├── api-keys/
│   └── page.tsx                 # Manage API keys
├── webhooks/
│   └── page.tsx                 # Webhook configuration
├── docs/
│   └── page.tsx                 # API documentation
└── settings/
    └── page.tsx                 # Developer profile settings
```

### Developer Registration

```typescript
// apps/web/app-store/src/app/developers/register/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DeveloperRegistration {
  company_name: string;
  company_url: string;
  contact_email: string;
  contact_phone: string;
  description: string;
  logo_url: string;
  address: {
    street: string;
    city: string;
    state: string;
    country: string;
    postal_code: string;
  };
  tax_id?: string;           // GST number for Indian developers
  bank_details: {
    account_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
  };
  agreed_to_terms: boolean;
  agreed_to_partner_agreement: boolean;
}

export default function DeveloperRegistrationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);  // 1: Company, 2: Banking, 3: Agreement

  async function handleSubmit(data: DeveloperRegistration) {
    const res = await fetch('/api/developers/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (res.ok) {
      router.push('/developers?registered=true');
    }
  }

  return (
    <div className="developer-registration">
      <h1>Become a LetBuyy App Developer</h1>
      <div className="step-indicator">
        <span className={step >= 1 ? 'active' : ''}>1. Company Info</span>
        <span className={step >= 2 ? 'active' : ''}>2. Banking</span>
        <span className={step >= 3 ? 'active' : ''}>3. Agreement</span>
      </div>
      {/* Multi-step form renders here */}
    </div>
  );
}
```

### Developer Database Schema

```sql
CREATE TABLE IF NOT EXISTS lb_developers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES auth.users(id),

    -- Company info
    company_name    TEXT NOT NULL,
    company_slug    TEXT UNIQUE NOT NULL,
    company_url     TEXT,
    contact_email   TEXT NOT NULL,
    contact_phone   TEXT,
    description     TEXT,
    logo_url        TEXT,

    -- Address
    address         JSONB DEFAULT '{}',

    -- Financial
    tax_id          TEXT,                      -- GST / PAN
    bank_details    JSONB DEFAULT '{}',        -- encrypted at rest
    payout_method   TEXT DEFAULT 'bank_transfer',

    -- Status
    status          TEXT DEFAULT 'pending'     -- pending | approved | suspended
                    CHECK (status IN ('pending', 'approved', 'suspended')),
    verified_at     TIMESTAMPTZ,

    -- Stats
    total_apps      INTEGER DEFAULT 0,
    total_installs  INTEGER DEFAULT 0,
    total_revenue   NUMERIC(12,2) DEFAULT 0,

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Developer API keys
CREATE TABLE IF NOT EXISTS lb_developer_api_keys (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    developer_id    UUID NOT NULL REFERENCES lb_developers(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    key_hash        TEXT NOT NULL,                  -- SHA-256 hash
    key_prefix      TEXT NOT NULL,                  -- first 8 chars for identification
    scopes          TEXT[] DEFAULT '{}',
    last_used_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### App Creation Flow

```typescript
// apps/web/app-store/src/app/api/developers/apps/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify developer status
  const { data: developer } = await supabase
    .from('lb_developers')
    .select('id, status')
    .eq('user_id', session.sub)
    .eq('status', 'approved')
    .single();

  if (!developer) {
    return NextResponse.json({ error: 'Not an approved developer' }, { status: 403 });
  }

  const body = await req.json();

  // Generate OAuth credentials
  const clientId = `lb_${crypto.randomBytes(16).toString('hex')}`;
  const clientSecret = crypto.randomBytes(32).toString('hex');
  const clientSecretHash = crypto.createHash('sha256').update(clientSecret).digest('hex');

  // Create app
  const { data: app, error } = await supabase
    .from('lb_apps')
    .insert({
      name: body.name,
      slug: body.slug,
      tagline: body.tagline,
      description: body.description,
      type: 'draft',
      status: 'draft',
      developer_id: developer.id,
      developer_name: body.developer_name,
      developer_email: session.email,
      client_id: clientId,
      client_secret: clientSecretHash,
      redirect_uris: body.redirect_uris || [],
      scopes: body.scopes || [],
      app_url: body.app_url,
      privacy_url: body.privacy_url,
      icon_url: body.icon_url || '',
      screenshots: [],
      pricing_model: body.pricing_model || 'free',
      category_id: body.category_id,
      tags: body.tags || [],
      trial_days: body.trial_days || 0,
      current_version: '0.1.0',
      min_plan: body.min_plan || 'free',
      supported_locales: ['en'],
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Return app with the client secret (only shown once!)
  return NextResponse.json({
    app,
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,  // Plain text — shown once
      warning: 'Save this client secret now. It will not be shown again.',
    },
  }, { status: 201 });
}
```

---

## 20. App Review Process

### Overview

Every app must pass review before being published. The review process ensures quality, security, and compliance.

### Review Checklist

```typescript
interface ReviewChecklist {
  // ── Functionality ──
  functionality: {
    appLoads: boolean;               // App loads without errors
    coreFeatureWorks: boolean;       // Primary feature functions correctly
    oauthFlowWorks: boolean;         // OAuth install flow completes
    uninstallClean: boolean;         // Uninstall removes all traces
    errorHandling: boolean;          // Proper error states/messages
  };

  // ── Security ──
  security: {
    httpsOnly: boolean;              // All URLs use HTTPS
    noSensitiveDataExposed: boolean; // No secrets in client-side code
    tokenValidation: boolean;        // Proper token verification
    scopesMinimal: boolean;          // Only necessary scopes requested
    dataEncrypted: boolean;          // Sensitive data encrypted
  };

  // ── Performance ──
  performance: {
    loadTimeUnder3s: boolean;        // Initial load < 3 seconds
    noMemoryLeaks: boolean;          // No observable memory leaks
    apiResponseUnder500ms: boolean;  // API responses < 500ms
    extensionsNonBlocking: boolean;  // Extensions don't block page load
  };

  // ── UX & Design ──
  design: {
    responsiveDesign: boolean;       // Works on mobile + desktop
    accessibilityBasic: boolean;     // Basic a11y (contrast, alt text)
    consistentBranding: boolean;     // Matches app listing screenshots
    clearOnboarding: boolean;        // Merchant knows what to do
  };

  // ── Listing Quality ──
  listing: {
    accurateDescription: boolean;    // Description matches functionality
    qualityScreenshots: boolean;     // Min 3, correct dimensions
    validIcon: boolean;              // 1200×1200, no text overlay
    validPrivacyPolicy: boolean;     // Accessible privacy policy URL
    pricingClear: boolean;           // Pricing matches described model
  };

  // ── Compliance ──
  compliance: {
    noProhibitedContent: boolean;    // No malware, spam, or adult content
    gdprCompliant: boolean;          // Proper data handling
    noMisleeadingClaims: boolean;    // Marketing claims are accurate
    termsAccepted: boolean;          // Developer agreement signed
  };
}
```

### Review Status Flow

```
┌─────────┐     ┌───────────┐     ┌───────────┐     ┌──────────┐
│  Draft  │────▶│ Submitted │────▶│ In Review │────▶│ Approved │
│         │     │           │     │           │     │          │
└─────────┘     └───────────┘     └─────┬─────┘     └────┬─────┘
                                        │                 │
                                        ▼                 ▼
                                  ┌───────────┐     ┌──────────┐
                                  │  Changes  │     │Published │
                                  │  Needed   │     │          │
                                  └─────┬─────┘     └──────────┘
                                        │
                                        ▼
                                  ┌───────────┐
                                  │ Resubmit  │
                                  └───────────┘
```

### Review Submission API

```typescript
// apps/web/app-store/src/app/api/developers/apps/[appId]/submit/route.ts

export async function POST(
  req: NextRequest,
  { params }: { params: { appId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: app } = await supabase
    .from('lb_apps')
    .select('*')
    .eq('id', params.appId)
    .single();

  // ── Pre-submission validation ──
  const errors: string[] = [];

  if (!app.name || app.name.length < 3) errors.push('App name must be at least 3 characters');
  if (!app.tagline || app.tagline.length < 10) errors.push('Tagline must be at least 10 characters');
  if (!app.description || app.description.length < 100) errors.push('Description must be at least 100 characters');
  if (!app.icon_url) errors.push('App icon is required');
  if (!app.screenshots?.length || app.screenshots.length < 3) errors.push('Minimum 3 screenshots required');
  if (!app.privacy_url) errors.push('Privacy policy URL is required');
  if (!app.app_url) errors.push('App URL is required');
  if (!app.redirect_uris?.length) errors.push('At least one redirect URI is required');
  if (!app.category_id) errors.push('Category is required');

  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // ── Create review request ──
  await supabase.from('lb_app_reviews').insert({
    app_id: params.appId,
    submitted_by: session.sub,
    status: 'pending',
    version: app.current_version,
    submission_notes: (await req.json()).notes || '',
  });

  // Update app status
  await supabase
    .from('lb_apps')
    .update({ status: 'submitted', updated_at: new Date().toISOString() })
    .eq('id', params.appId);

  return NextResponse.json({ success: true, status: 'submitted' });
}
```

### Review Database Tables

```sql
CREATE TABLE IF NOT EXISTS lb_app_reviews (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    app_id          UUID NOT NULL REFERENCES lb_apps(id) ON DELETE CASCADE,
    submitted_by    UUID NOT NULL REFERENCES auth.users(id),
    reviewer_id     UUID REFERENCES auth.users(id),    -- platform reviewer

    version         TEXT NOT NULL,
    status          TEXT DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_review', 'approved', 'changes_needed', 'rejected')),

    -- Review details
    submission_notes TEXT,
    review_notes    TEXT,                               -- internal reviewer notes
    feedback        JSONB DEFAULT '[]',                 -- structured feedback items
    checklist       JSONB DEFAULT '{}',                 -- completed review checklist

    submitted_at    TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    resolved_at     TIMESTAMPTZ
);
```

---

## 21. Marketplace UI

### Overview

The App Store marketplace is the public-facing storefront where merchants browse, search, and install apps.

### Page Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  🔍 Search apps...                              [My Apps]   │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  🌟 FEATURED APP                                            │    │
│  │  ┌──────────┐                                               │    │
│  │  │  Hero    │  App Name                                     │    │
│  │  │  Image   │  Tagline description text here                │    │
│  │  │          │  ⭐ 4.8 (1,200 reviews)  |  Free plan avail. │    │
│  │  │          │  [Install App]                                 │    │
│  │  └──────────┘                                               │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Staff Picks                                            [View all →]│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ [Icon]   │  │ [Icon]   │  │ [Icon]   │  │ [Icon]   │           │
│  │ App Name │  │ App Name │  │ App Name │  │ App Name │           │
│  │ Tagline  │  │ Tagline  │  │ Tagline  │  │ Tagline  │           │
│  │ ⭐ 4.5   │  │ ⭐ 4.9   │  │ ⭐ 4.2   │  │ ⭐ 4.7   │           │
│  │ Free     │  │ ₹499/mo  │  │ Freemium │  │ Free     │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
│  Trending This Week                                     [View all →]│
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ ...      │  │ ...      │  │ ...      │  │ ...      │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
│  Browse by Category                                                  │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ 📦 Products │ │ 💳 Selling  │ │ 🚚 Orders   │ │ 📧 Marketing│       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐       │
│  │ ⭐ Convers. │ │ 🏗️ Design   │ │ 💬 Support  │ │ 📊 Analytics│       │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘       │
│                                                                      │
│  Recent Apps                                            [View all →]│
│  ...                                                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### App Card Component

```typescript
// apps/web/app-store/src/components/AppCard.tsx

import Image from 'next/image';
import Link from 'next/link';
import { Star } from 'lucide-react';

interface AppCardProps {
  slug: string;
  name: string;
  tagline: string;
  iconUrl: string;
  avgRating: number;
  reviewCount: number;
  pricingModel: string;
  priceMonthly?: number;
  developerName: string;
}

export function AppCard({
  slug, name, tagline, iconUrl,
  avgRating, reviewCount, pricingModel, priceMonthly,
  developerName,
}: AppCardProps) {
  return (
    <Link href={`/apps/${slug}`} className="app-card">
      <div className="app-card__icon">
        <Image
          src={iconUrl}
          alt={name}
          width={64}
          height={64}
          className="app-card__icon-img"
        />
      </div>

      <div className="app-card__content">
        <h3 className="app-card__name">{name}</h3>
        <p className="app-card__tagline">{tagline}</p>

        <div className="app-card__meta">
          <div className="app-card__rating">
            <Star size={14} fill="#F59E0B" stroke="#F59E0B" />
            <span>{avgRating.toFixed(1)}</span>
            <span className="app-card__review-count">
              ({reviewCount})
            </span>
          </div>

          <span className="app-card__pricing">
            {pricingModel === 'free' && 'Free'}
            {pricingModel === 'freemium' && 'Free plan available'}
            {pricingModel === 'recurring' && `₹${priceMonthly}/mo`}
            {pricingModel === 'one_time' && `₹${priceMonthly}`}
            {pricingModel === 'usage_based' && 'Usage-based'}
          </span>
        </div>

        <p className="app-card__developer">{developerName}</p>
      </div>
    </Link>
  );
}
```

### Marketplace Data Fetching

```typescript
// apps/web/app-store/src/app/page.tsx

import { supabase } from '@/lib/supabase/server';
import { AppCard } from '@/components/AppCard';
import { HeroSection } from '@/components/HeroSection';
import { CategoryGrid } from '@/components/CategoryGrid';

export default async function MarketplacePage() {
  // Parallel queries for homepage sections
  const [featured, staffPicks, trending, recent] = await Promise.all([
    // Featured app
    supabase
      .from('lb_apps')
      .select('*')
      .eq('status', 'published')
      .eq('is_featured', true)
      .limit(1)
      .single(),

    // Staff picks collection
    supabase
      .from('lb_apps')
      .select('*')
      .eq('status', 'published')
      .contains('collection_ids', ['staff-picks'])
      .order('avg_rating', { ascending: false })
      .limit(8),

    // Trending (most installs in last 7 days)
    supabase
      .rpc('get_trending_apps', { days: 7, limit_count: 8 }),

    // Recently published
    supabase
      .from('lb_apps')
      .select('*')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(8),
  ]);

  return (
    <main className="marketplace">
      {featured.data && <HeroSection app={featured.data} />}

      <section className="marketplace__section">
        <h2>Staff Picks</h2>
        <div className="app-grid">
          {staffPicks.data?.map(app => (
            <AppCard key={app.id} {...app} />
          ))}
        </div>
      </section>

      <section className="marketplace__section">
        <h2>Trending This Week</h2>
        <div className="app-grid">
          {trending.data?.map(app => (
            <AppCard key={app.id} {...app} />
          ))}
        </div>
      </section>

      <CategoryGrid />

      <section className="marketplace__section">
        <h2>Recently Added</h2>
        <div className="app-grid">
          {recent.data?.map(app => (
            <AppCard key={app.id} {...app} />
          ))}
        </div>
      </section>
    </main>
  );
}
```

---

## 22. Search & Discovery

### Overview

The search and discovery system helps merchants find the right apps through full-text search, filters, sorting, and AI-powered recommendations.

### Search API

```typescript
// apps/web/app-store/src/app/api/search/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const query = searchParams.get('q') || '';
  const category = searchParams.get('category');
  const pricing = searchParams.get('pricing');      // free | paid | freemium
  const sort = searchParams.get('sort') || 'relevance';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '24');
  const offset = (page - 1) * limit;

  let dbQuery = supabase
    .from('lb_apps')
    .select('*', { count: 'exact' })
    .eq('status', 'published');

  // ── Full-text search ──
  if (query) {
    dbQuery = dbQuery.textSearch('search_vector', query, {
      type: 'websearch',
      config: 'english',
    });
  }

  // ── Filters ──
  if (category) {
    dbQuery = dbQuery.eq('category_id', category);
  }

  if (pricing === 'free') {
    dbQuery = dbQuery.eq('pricing_model', 'free');
  } else if (pricing === 'paid') {
    dbQuery = dbQuery.in('pricing_model', ['recurring', 'one_time', 'usage_based']);
  } else if (pricing === 'freemium') {
    dbQuery = dbQuery.eq('pricing_model', 'freemium');
  }

  // ── Sorting ──
  switch (sort) {
    case 'popular':
      dbQuery = dbQuery.order('install_count', { ascending: false });
      break;
    case 'rating':
      dbQuery = dbQuery.order('avg_rating', { ascending: false });
      break;
    case 'newest':
      dbQuery = dbQuery.order('published_at', { ascending: false });
      break;
    case 'price_low':
      dbQuery = dbQuery.order('price_monthly', { ascending: true, nullsFirst: true });
      break;
    case 'price_high':
      dbQuery = dbQuery.order('price_monthly', { ascending: false, nullsFirst: false });
      break;
    default: // relevance — handled by text search ranking
      break;
  }

  dbQuery = dbQuery.range(offset, offset + limit - 1);

  const { data: apps, count, error } = await dbQuery;

  return NextResponse.json({
    apps: apps || [],
    pagination: {
      page,
      limit,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / limit),
    },
  });
}
```

### Search UI Component

```typescript
// apps/web/app-store/src/components/SearchBar.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSuggestions(data.suggestions);
      setIsOpen(true);
    }, 300); // 300ms debounce

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setIsOpen(false);
    router.push(`/search?q=${encodeURIComponent(query)}`);
  }

  return (
    <form onSubmit={handleSearch} className="search-bar">
      <Search size={20} className="search-bar__icon" />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search apps..."
        className="search-bar__input"
        onFocus={() => suggestions.length > 0 && setIsOpen(true)}
      />
      {query && (
        <button type="button" onClick={() => { setQuery(''); setSuggestions([]); }}>
          <X size={16} />
        </button>
      )}
      {isOpen && suggestions.length > 0 && (
        <ul className="search-bar__suggestions">
          {suggestions.map(s => (
            <li key={s} onClick={() => { setQuery(s); handleSearch; }}>
              <Search size={14} /> {s}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
```

### Search Suggestions Endpoint

```typescript
// apps/web/app-store/src/app/api/search/suggestions/route.ts

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q') || '';

  if (query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  // Get app name matches
  const { data: apps } = await supabase
    .from('lb_apps')
    .select('name')
    .eq('status', 'published')
    .ilike('name', `%${query}%`)
    .limit(5);

  // Get category matches
  const { data: categories } = await supabase
    .from('lb_app_categories')
    .select('name')
    .ilike('name', `%${query}%`)
    .limit(3);

  // Get tag matches
  const { data: tags } = await supabase
    .rpc('search_app_tags', { search_query: query, max_results: 3 });

  const suggestions = [
    ...(apps?.map(a => a.name) || []),
    ...(categories?.map(c => c.name) || []),
    ...(tags?.map(t => t.tag) || []),
  ].slice(0, 8);

  return NextResponse.json({ suggestions });
}
```

### Trending Apps SQL Function

```sql
-- Supabase RPC function for trending apps
CREATE OR REPLACE FUNCTION get_trending_apps(days INTEGER, limit_count INTEGER)
RETURNS SETOF lb_apps AS $$
  SELECT a.*
  FROM lb_apps a
  JOIN (
    SELECT app_id, COUNT(*) as recent_installs
    FROM lb_app_installations
    WHERE installed_at >= NOW() - (days || ' days')::INTERVAL
    GROUP BY app_id
    ORDER BY recent_installs DESC
    LIMIT limit_count
  ) t ON a.id = t.app_id
  WHERE a.status = 'published'
  ORDER BY t.recent_installs DESC;
$$ LANGUAGE sql STABLE;
```

---

## 23. App Listing Page

### Overview

The app listing page is the individual app's detail page — equivalent to a product page in an app store.

### Page Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  ← Back to Apps                                                      │
│                                                                      │
│  ┌──────────┐                                                        │
│  │  [Icon]  │  App Name                                              │
│  │  64×64   │  by Developer Name                                     │
│  │          │  ⭐ 4.8 (1,234 reviews)  •  10,000+ installs          │
│  └──────────┘  [Add App]  [View Demo]                                │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  [Screenshot 1]  [Screenshot 2]  [Screenshot 3]  →           │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────┐  ┌────────────────────┐    │
│  │  Description                        │  │  Pricing           │    │
│  │  ────────────────────────────        │  │  Free plan avail.  │    │
│  │  Full markdown description           │  │  ₹499/mo Pro       │    │
│  │  rendered here with headings,        │  │  ₹999/mo Business  │    │
│  │  lists, images, etc.                 │  │                    │    │
│  │                                      │  │  Key Features      │    │
│  │                                      │  │  ✅ Feature 1      │    │
│  │                                      │  │  ✅ Feature 2      │    │
│  │                                      │  │  ✅ Feature 3      │    │
│  │                                      │  │                    │    │
│  │                                      │  │  Support           │    │
│  │                                      │  │  📧 help@app.com  │    │
│  │                                      │  │  📖 Docs           │    │
│  │                                      │  │                    │    │
│  │                                      │  │  Resources         │    │
│  │                                      │  │  Privacy Policy    │    │
│  │                                      │  │  Terms of Service  │    │
│  └─────────────────────────────────────┘  └────────────────────┘    │
│                                                                      │
│  Reviews                                                  [Write ▼] │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │  ⭐⭐⭐⭐⭐  "Great app, boosted my sales by 20%!"          │   │
│  │  by store-owner  •  2 days ago                                │   │
│  │                                                               │   │
│  │  ⭐⭐⭐⭐☆  "Good but missing bulk export feature"          │   │
│  │  by another-merchant  •  1 week ago                           │   │
│  │  └ Developer reply: "Bulk export is coming in v2.3!"         │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Similar Apps                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │ ...      │  │ ...      │  │ ...      │  │ ...      │           │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### App Listing Page Component

```typescript
// apps/web/app-store/src/app/apps/[slug]/page.tsx

import { supabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ScreenshotCarousel } from '@/components/ScreenshotCarousel';
import { ReviewSection } from '@/components/ReviewSection';
import { SimilarApps } from '@/components/SimilarApps';
import { PricingSidebar } from '@/components/PricingSidebar';
import { InstallButton } from '@/components/InstallButton';
import { MarkdownRenderer } from '@/components/MarkdownRenderer';
import { Star } from 'lucide-react';
import Image from 'next/image';
import type { Metadata } from 'next';

interface PageProps {
  params: { slug: string };
}

// Dynamic SEO metadata
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { data: app } = await supabase
    .from('lb_apps')
    .select('name, tagline, icon_url')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (!app) return { title: 'App Not Found' };

  return {
    title: `${app.name} — LetBuyy App Store`,
    description: app.tagline,
    openGraph: {
      title: app.name,
      description: app.tagline,
      images: [app.icon_url],
    },
  };
}

export default async function AppListingPage({ params }: PageProps) {
  const { data: app } = await supabase
    .from('lb_apps')
    .select(`
      *,
      developer:lb_developers(company_name, company_url, logo_url),
      extensions:lb_app_extensions(id, type, name),
      category:lb_app_categories(name, slug)
    `)
    .eq('slug', params.slug)
    .eq('status', 'published')
    .single();

  if (!app) notFound();

  return (
    <main className="app-listing">
      {/* ── Header ── */}
      <header className="app-listing__header">
        <Image
          src={app.icon_url}
          alt={app.name}
          width={80}
          height={80}
          className="app-listing__icon"
        />
        <div className="app-listing__info">
          <h1>{app.name}</h1>
          <p className="app-listing__developer">
            by <a href={app.developer.company_url}>{app.developer.company_name}</a>
          </p>
          <div className="app-listing__stats">
            <span className="app-listing__rating">
              <Star size={16} fill="#F59E0B" stroke="#F59E0B" />
              {app.avg_rating.toFixed(1)}
              <span>({app.review_count} reviews)</span>
            </span>
            <span>•</span>
            <span>{app.install_count.toLocaleString()}+ installs</span>
          </div>
          <div className="app-listing__actions">
            <InstallButton appId={app.id} appSlug={app.slug} />
          </div>
        </div>
      </header>

      {/* ── Screenshots ── */}
      <ScreenshotCarousel screenshots={app.screenshots} appName={app.name} />

      {/* ── Content ── */}
      <div className="app-listing__body">
        <div className="app-listing__description">
          <MarkdownRenderer content={app.description} />
        </div>
        <PricingSidebar
          pricingModel={app.pricing_model}
          priceMonthly={app.price_monthly}
          priceYearly={app.price_yearly}
          trialDays={app.trial_days}
          privacyUrl={app.privacy_url}
          termsUrl={app.terms_url}
          extensions={app.extensions}
        />
      </div>

      {/* ── Reviews ── */}
      <ReviewSection appId={app.id} avgRating={app.avg_rating} reviewCount={app.review_count} />

      {/* ── Similar Apps ── */}
      <SimilarApps categoryId={app.category_id} currentAppId={app.id} />
    </main>
  );
}
```

### Review System

```typescript
// apps/web/app-store/src/app/api/apps/[appId]/reviews/route.ts

// POST — submit a review
export async function POST(
  req: NextRequest,
  { params }: { params: { appId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the user has this app installed
  const { data: installation } = await supabase
    .from('lb_app_installations')
    .select('id')
    .eq('app_id', params.appId)
    .eq('store_id', session.store_id)
    .eq('status', 'active')
    .single();

  if (!installation) {
    return NextResponse.json(
      { error: 'You must install the app before reviewing it' },
      { status: 403 }
    );
  }

  const { rating, title, body } = await req.json();

  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be 1-5' }, { status: 400 });
  }

  // Upsert — one review per store per app
  await supabase
    .from('lb_app_user_reviews')
    .upsert({
      app_id: params.appId,
      store_id: session.store_id,
      user_id: session.sub,
      rating,
      title,
      body,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'app_id,store_id' });

  // Recalculate average rating
  const { data: stats } = await supabase
    .rpc('recalculate_app_rating', { target_app_id: params.appId });

  return NextResponse.json({ success: true });
}
```

---

## 24. Developer Analytics Dashboard

### Overview

The analytics dashboard provides developers with insights into their app's performance, installations, revenue, and user engagement.

### Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  App Analytics — Reviews Pro                    [Last 30 days ▼] │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐│
│  │ Installs    │  │ Uninstalls  │  │ Revenue     │  │ Rating  ││
│  │   1,234     │  │     87      │  │ ₹4,56,789   │  │  4.8    ││
│  │   ▲ 12%     │  │   ▼ 5%     │  │   ▲ 18%     │  │  ★★★★★  ││
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘│
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  Installation Trend                                         │ │
│  │  ┌──────────────────────────────────────────────────────┐   │ │
│  │  │           ╱╲    ╱╲                                   │   │ │
│  │  │      ╱╲  ╱  ╲  ╱  ╲   ╱╲                            │   │ │
│  │  │ ╱╲  ╱  ╲╱    ╲╱    ╲ ╱  ╲                           │   │ │
│  │  │╱  ╲╱                 ╲    ╲                          │   │ │
│  │  │                            ╲                         │   │ │
│  │  └──────────────────────────────────────────────────────┘   │ │
│  │  Jan  Feb  Mar  Apr  May  Jun  Jul  Aug                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌──── Revenue Breakdown ────┐  ┌──── Top Plans ──────────────┐ │
│  │                            │  │                              │ │
│  │  Gross:     ₹5,70,986     │  │  Pro (₹499/mo)     68%     │ │
│  │  Commission: ₹1,14,197    │  │  Business (₹999)   22%     │ │
│  │  Net Payout: ₹4,56,789    │  │  Free               10%     │ │
│  │                            │  │                              │ │
│  │  Next payout: Feb 15      │  │                              │ │
│  │  Amount: ₹1,23,456        │  │                              │ │
│  └────────────────────────────┘  └──────────────────────────────┘ │
│                                                                   │
│  Recent Activity                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  🟢 store-abc installed your app              2 min ago     │ │
│  │  🔴 store-xyz uninstalled your app            15 min ago    │ │
│  │  ⭐ New 5-star review from store-def          1 hour ago    │ │
│  │  💰 ₹499 subscription payment received        3 hours ago   │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Analytics API

```typescript
// apps/web/app-store/src/app/api/developers/apps/[appId]/analytics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { supabase } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { appId: string } }
) {
  const session = await getSession(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const range = req.nextUrl.searchParams.get('range') || '30d';
  const daysBack = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const since = new Date(Date.now() - daysBack * 86400000).toISOString();

  // ── Parallel data fetching ──
  const [
    installStats,
    revenueStats,
    ratingData,
    dailyInstalls,
    recentActivity,
    planBreakdown,
  ] = await Promise.all([
    // Install / uninstall counts
    supabase.rpc('app_install_stats', {
      target_app_id: params.appId,
      since_date: since,
    }),

    // Revenue stats
    supabase.rpc('app_revenue_stats', {
      target_app_id: params.appId,
      since_date: since,
    }),

    // Current rating
    supabase
      .from('lb_apps')
      .select('avg_rating, review_count, install_count')
      .eq('id', params.appId)
      .single(),

    // Daily install trend
    supabase.rpc('app_daily_installs', {
      target_app_id: params.appId,
      since_date: since,
    }),

    // Recent activity log
    supabase
      .from('lb_app_activity_log')
      .select('*')
      .eq('app_id', params.appId)
      .order('created_at', { ascending: false })
      .limit(20),

    // Plan breakdown
    supabase.rpc('app_plan_breakdown', {
      target_app_id: params.appId,
    }),
  ]);

  return NextResponse.json({
    summary: {
      installs: installStats.data?.installs || 0,
      uninstalls: installStats.data?.uninstalls || 0,
      netInstalls: installStats.data?.net || 0,
      totalInstalls: ratingData.data?.install_count || 0,
      avgRating: ratingData.data?.avg_rating || 0,
      reviewCount: ratingData.data?.review_count || 0,
    },
    revenue: revenueStats.data || { gross: 0, commission: 0, net: 0 },
    dailyInstalls: dailyInstalls.data || [],
    recentActivity: recentActivity.data || [],
    planBreakdown: planBreakdown.data || [],
  });
}
```

### Analytics SQL Functions

```sql
-- Install statistics for a date range
CREATE OR REPLACE FUNCTION app_install_stats(target_app_id UUID, since_date TIMESTAMPTZ)
RETURNS JSON AS $$
  SELECT json_build_object(
    'installs', COUNT(*) FILTER (WHERE installed_at >= since_date),
    'uninstalls', COUNT(*) FILTER (WHERE uninstalled_at >= since_date AND status = 'uninstalled'),
    'net', COUNT(*) FILTER (WHERE installed_at >= since_date)
          - COUNT(*) FILTER (WHERE uninstalled_at >= since_date AND status = 'uninstalled')
  )
  FROM lb_app_installations
  WHERE app_id = target_app_id;
$$ LANGUAGE sql STABLE;

-- Revenue statistics
CREATE OR REPLACE FUNCTION app_revenue_stats(target_app_id UUID, since_date TIMESTAMPTZ)
RETURNS JSON AS $$
  SELECT json_build_object(
    'gross', COALESCE(SUM(amount), 0),
    'commission', COALESCE(SUM(platform_commission), 0),
    'net', COALESCE(SUM(developer_payout), 0)
  )
  FROM lb_app_charges
  WHERE app_id = target_app_id
    AND status = 'active'
    AND created_at >= since_date;
$$ LANGUAGE sql STABLE;

-- Daily install counts for charting
CREATE OR REPLACE FUNCTION app_daily_installs(target_app_id UUID, since_date TIMESTAMPTZ)
RETURNS TABLE(day DATE, installs BIGINT, uninstalls BIGINT) AS $$
  SELECT
    d.day::DATE,
    COUNT(i.id) FILTER (WHERE i.installed_at::DATE = d.day) as installs,
    COUNT(i.id) FILTER (WHERE i.uninstalled_at::DATE = d.day AND i.status = 'uninstalled') as uninstalls
  FROM generate_series(since_date::DATE, CURRENT_DATE, '1 day') d(day)
  LEFT JOIN lb_app_installations i ON i.app_id = target_app_id
    AND (i.installed_at::DATE = d.day OR (i.uninstalled_at::DATE = d.day AND i.status = 'uninstalled'))
  GROUP BY d.day
  ORDER BY d.day;
$$ LANGUAGE sql STABLE;

-- Plan breakdown
CREATE OR REPLACE FUNCTION app_plan_breakdown(target_app_id UUID)
RETURNS TABLE(plan_name TEXT, count BIGINT, percentage NUMERIC) AS $$
  WITH total AS (
    SELECT COUNT(*) as total_count
    FROM lb_app_charges
    WHERE app_id = target_app_id AND status = 'active'
  )
  SELECT
    c.plan_name,
    COUNT(*) as count,
    ROUND(COUNT(*)::NUMERIC / GREATEST(t.total_count, 1) * 100, 1) as percentage
  FROM lb_app_charges c, total t
  WHERE c.app_id = target_app_id AND c.status = 'active'
  GROUP BY c.plan_name, t.total_count
  ORDER BY count DESC;
$$ LANGUAGE sql STABLE;

-- Recalculate app rating (trigger-safe)
CREATE OR REPLACE FUNCTION recalculate_app_rating(target_app_id UUID)
RETURNS VOID AS $$
  UPDATE lb_apps
  SET
    avg_rating = COALESCE(
      (SELECT ROUND(AVG(rating)::NUMERIC, 1) FROM lb_app_user_reviews WHERE app_id = target_app_id),
      0
    ),
    review_count = (SELECT COUNT(*) FROM lb_app_user_reviews WHERE app_id = target_app_id),
    updated_at = NOW()
  WHERE id = target_app_id;
$$ LANGUAGE sql VOLATILE;
```

---

<!-- END PART 4 — Sections 19–24 Complete -->

---
---

# PART 5 — Security, Testing & Deployment

<!-- Sections 25–28 -->

---

## 25. Security Model

### Overview

The App Store security model protects merchants, developers, and the platform through multiple layers of defense.

### Permission Scopes

```typescript
// packages/types/src/scopes.ts

/**
 * LetBuyy App Permission Scopes
 *
 * Format: resource:action
 * Actions: read | write | delete
 */
export const APP_SCOPES = {
  // ── Products ──
  'products:read':       'View products, variants, and inventory',
  'products:write':      'Create and modify products',
  'products:delete':     'Delete products',

  // ── Orders ──
  'orders:read':         'View order details and history',
  'orders:write':        'Create and modify orders',
  'orders:delete':       'Cancel and delete orders',

  // ── Customers ──
  'customers:read':      'View customer profiles',
  'customers:write':     'Create and modify customers',
  'customers:delete':    'Delete customer data',

  // ── Inventory ──
  'inventory:read':      'View inventory levels',
  'inventory:write':     'Adjust inventory quantities',

  // ── Discounts ──
  'discounts:read':      'View discount codes',
  'discounts:write':     'Create and modify discounts',

  // ── Content ──
  'content:read':        'View pages and blog posts',
  'content:write':       'Create and modify content',

  // ── Theme ──
  'theme:read':          'View theme files',
  'theme:write':         'Modify theme files',

  // ── Store Settings ──
  'store:read':          'View store settings',
  'store:write':         'Modify store settings',

  // ── Analytics ──
  'analytics:read':      'View analytics and reports',

  // ── Shipping ──
  'shipping:read':       'View shipping settings',
  'shipping:write':      'Modify shipping rates',

  // ── Storefront ──
  'storefront:read':     'View storefront data',
  'storefront:write':    'Inject storefront content',
} as const;

export type AppScope = keyof typeof APP_SCOPES;
```

### Scope Enforcement Middleware

```typescript
// apps/web/app-store/src/lib/middleware/scopeGuard.ts

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import crypto from 'crypto';

export function requireScopes(...requiredScopes: string[]) {
  return async function scopeGuard(req: NextRequest) {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing access token' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Lookup token
    const { data: tokenRecord } = await supabase
      .from('lb_app_access_tokens')
      .select(`
        app_id, store_id, scopes,
        installation:lb_app_installations!inner(status, granted_scopes)
      `)
      .eq('access_token', tokenHash)
      .eq('status', 'active')
      .single();

    if (!tokenRecord || tokenRecord.installation.status !== 'active') {
      return NextResponse.json({ error: 'Invalid or revoked token' }, { status: 401 });
    }

    // Check scopes
    const grantedScopes = tokenRecord.installation.granted_scopes;
    const missingScopes = requiredScopes.filter(s => !grantedScopes.includes(s));

    if (missingScopes.length > 0) {
      return NextResponse.json({
        error: 'Insufficient scopes',
        required: requiredScopes,
        granted: grantedScopes,
        missing: missingScopes,
      }, { status: 403 });
    }

    return null; // Passes — proceed with request
  };
}
```

### Content Security Policy for Embedded Apps

```typescript
// CSP headers for iframe-embedded apps

const EMBEDDED_APP_CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'", 'https://*.letbuyy.store'],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'https:', 'blob:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': ["'self'", 'https://*.letbuyy.store', 'https://*.supabase.co'],
  'frame-ancestors': ['https://admin.letbuyy.store'],  // Only embed in admin
  'frame-src': ["'self'", 'https:'],
};
```

### Rate Limiting Configuration

```typescript
// Rate limits by authentication type

export const RATE_LIMITS = {
  // Public API (unauthenticated)
  public: {
    windowMs: 60_000,     // 1 minute
    maxRequests: 30,
  },

  // Authenticated merchant
  merchant: {
    windowMs: 60_000,
    maxRequests: 120,
  },

  // App API (via access token)
  app: {
    windowMs: 60_000,
    maxRequests: 200,       // 200 requests per minute
    burstLimit: 40,         // Max 40 in a 10-second window
  },

  // Developer API
  developer: {
    windowMs: 60_000,
    maxRequests: 100,
  },

  // Webhook delivery (outbound)
  webhook: {
    windowMs: 60_000,
    maxRequests: 1000,      // Platform-wide webhook delivery rate
  },
};
```

### Security Headers

```typescript
// apps/web/app-store/next.config.ts — security headers

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];
```

---

## 26. Testing Strategy

### Overview

Testing covers the platform APIs, extension rendering, OAuth flows, and webhook delivery.

### Test Categories

| Category | Tool | Coverage Target |
|---|---|---|
| Unit Tests | Vitest | Core utilities, validation, crypto |
| API Integration | Vitest + Supertest | All REST endpoints |
| OAuth Flow | Playwright | Full install → uninstall cycle |
| Extension Rendering | Vitest | Block/embed output generation |
| Webhook Delivery | Vitest + MSW | Delivery, retry, verification |
| E2E Marketplace | Playwright | Search, browse, install, review |
| Load Testing | k6 | API throughput under load |

### Example: OAuth Flow E2E Test

```typescript
// tests/e2e/oauth-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('App Installation OAuth Flow', () => {
  test('merchant can install and uninstall an app', async ({ page }) => {
    // ── 1. Login as merchant ──
    await page.goto('https://accounts.letbuyy.store/login');
    await page.fill('[name="email"]', 'merchant@test.com');
    await page.fill('[name="password"]', 'test-password');
    await page.click('button[type="submit"]');

    // ── 2. Navigate to app listing ──
    await page.goto('https://apps.letbuyy.store/apps/reviews-pro');
    await expect(page.locator('h1')).toContainText('Reviews Pro');

    // ── 3. Click install ──
    await page.click('[data-testid="install-button"]');

    // ── 4. Grant permissions ──
    await expect(page.locator('.oauth-consent')).toBeVisible();
    await expect(page.locator('.scope-item')).toHaveCount(3);
    await page.click('[data-testid="approve-install"]');

    // ── 5. Verify redirect to app ──
    await expect(page).toHaveURL(/reviews-pro\.example\.com/);

    // ── 6. Verify installation in admin ──
    await page.goto('https://admin.letbuyy.store/apps');
    await expect(page.locator('[data-app="reviews-pro"]')).toBeVisible();

    // ── 7. Uninstall ──
    await page.click('[data-app="reviews-pro"] .uninstall-btn');
    await page.click('[data-testid="confirm-uninstall"]');
    await expect(page.locator('[data-app="reviews-pro"]')).not.toBeVisible();
  });
});
```

### Example: Webhook Delivery Test

```typescript
// tests/unit/webhook-delivery.test.ts

import { describe, it, expect, vi } from 'vitest';
import { deliverWebhook } from '@/lib/webhooks/deliver';

describe('Webhook Delivery', () => {
  it('delivers webhook with correct HMAC signature', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await deliverWebhook({
      url: 'https://app.example.com/webhooks',
      topic: 'orders/create',
      payload: { order_id: '123', total: 999 },
      secret: 'webhook-secret-123',
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://app.example.com/webhooks');
    expect(options.headers['X-LB-Topic']).toBe('orders/create');
    expect(options.headers['X-LB-HMAC-SHA256']).toBeDefined();
    expect(options.headers['X-LB-Webhook-Id']).toBeDefined();
  });

  it('retries on failure with exponential backoff', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockRejectedValueOnce(new Error('Timeout'))
      .mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock;

    await deliverWebhook({
      url: 'https://app.example.com/webhooks',
      topic: 'orders/create',
      payload: { order_id: '123' },
      secret: 'secret',
      maxRetries: 3,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
```

### Example: Search API Test

```typescript
// tests/api/search.test.ts

import { describe, it, expect } from 'vitest';

describe('Search API', () => {
  it('returns paginated results', async () => {
    const res = await fetch('/api/search?q=reviews&page=1&limit=10');
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.apps).toBeDefined();
    expect(data.pagination.page).toBe(1);
    expect(data.pagination.limit).toBe(10);
    expect(data.pagination.total).toBeGreaterThanOrEqual(0);
  });

  it('filters by category', async () => {
    const res = await fetch('/api/search?category=reviews');
    const data = await res.json();

    data.apps.forEach((app: { category_id: string }) => {
      expect(app.category_id).toBe('reviews');
    });
  });

  it('sorts by rating descending', async () => {
    const res = await fetch('/api/search?sort=rating');
    const data = await res.json();

    for (let i = 1; i < data.apps.length; i++) {
      expect(data.apps[i - 1].avg_rating).toBeGreaterThanOrEqual(data.apps[i].avg_rating);
    }
  });
});
```

---

## 27. Deployment Architecture

### Overview

The App Store is deployed as the 8th application in the LetBuyy monorepo, following the same infrastructure patterns.

### Infrastructure Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE DNS                                │
│                                                                      │
│  apps.letbuyy.store  →  CNAME  →  Vercel                           │
│                                                                      │
│  ┌─── Vercel ─────────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │  apps/web/app-store (Next.js 14)                               │ │
│  │  ├── SSR Pages (marketplace, app listings)                     │ │
│  │  ├── API Routes (/api/*)                                       │ │
│  │  ├── Middleware (SSO, rate limiting)                            │ │
│  │  └── ISR (static pages with revalidation)                      │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                           │                                          │
│                           ▼                                          │
│  ┌─── Supabase ───────────────────────────────────────────────────┐ │
│  │                                                                 │ │
│  │  PostgreSQL Database                                            │ │
│  │  ├── lb_apps, lb_developers, lb_app_installations              │ │
│  │  ├── lb_app_extensions, lb_app_charges                         │ │
│  │  ├── lb_app_reviews, lb_app_webhooks                           │ │
│  │  ├── Row Level Security (RLS) policies                         │ │
│  │  └── Full-text search indexes                                   │ │
│  │                                                                 │ │
│  │  Edge Functions                                                 │ │
│  │  ├── webhook-delivery                                           │ │
│  │  ├── billing-processor                                          │ │
│  │  └── rating-recalculator                                        │ │
│  │                                                                 │ │
│  │  Storage                                                        │ │
│  │  ├── app-icons bucket                                           │ │
│  │  ├── app-screenshots bucket                                     │ │
│  │  └── developer-logos bucket                                     │ │
│  │                                                                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─── Cloudflare Workers ─────────────────────────────────────────┐ │
│  │  App Proxy Worker (routes /a/* to app backends)                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Vercel Configuration

```json
// apps/web/app-store/vercel.json
{
  "framework": "nextjs",
  "buildCommand": "pnpm build",
  "installCommand": "pnpm install",
  "outputDirectory": ".next",
  "regions": ["bom1"],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/a/:path*", "destination": "/api/proxy/:path*" }
  ]
}
```

### Environment Variables

```bash
# apps/web/app-store/.env.local

# ── Supabase ──
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# ── Session ──
SESSION_SECRET=your-session-secret
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.store
NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store
NEXT_PUBLIC_STOREFRONT_URL=https://letbuyy.store

# ── App Store ──
NEXT_PUBLIC_APP_STORE_URL=https://apps.letbuyy.store
WEBHOOK_SIGNING_SECRET=whsec_...
BILLING_WEBHOOK_SECRET=billing_whsec_...

# ── Platform ──
PLATFORM_COMMISSION_RATE=0.20          # 20%
MAX_APPS_PER_DEVELOPER=50
MAX_EXTENSIONS_PER_APP=10
```

---

## 28. Summary & Complete Schema Reference

### Section Index

| # | Section | Part | Lines |
|---|---|---|---|
| 1 | Table of Contents | 1 | ~50 |
| 2 | Executive Summary | 1 | ~80 |
| 3 | Architecture Overview | 1 | ~120 |
| 4 | Domain Structure | 1 | ~150 |
| 5 | App Types & Categories | 1 | ~200 |
| 6 | Database Schema | 1 | ~350 |
| 7 | OAuth 2.0 Authentication | 1 | ~250 |
| 8 | App Bridge SDK | 2 | ~300 |
| 9 | Session Token Authentication | 2 | ~200 |
| 10 | App Proxy | 2 | ~250 |
| 11 | Webhook System | 2 | ~300 |
| 12 | Billing API | 2 | ~350 |
| 13 | API Versioning | 2 | ~200 |
| 14 | Storefront Extensions | 3 | ~350 |
| 15 | Checkout UI Extensions | 3 | ~300 |
| 16 | Post-Purchase Extensions | 3 | ~250 |
| 17 | Admin Extensions | 3 | ~300 |
| 18 | Extension SDK | 3 | ~250 |
| 19 | Extension Settings | 3 | ~250 |
| 20 | Developer Portal | 4 | ~300 |
| 21 | App Review Process | 4 | ~200 |
| 22 | Marketplace UI | 4 | ~300 |
| 23 | Search & Discovery | 4 | ~250 |
| 24 | App Listing Page | 4 | ~300 |
| 25 | Developer Analytics | 4 | ~250 |
| 26 | Security Model | 5 | ~200 |
| 27 | Testing Strategy | 5 | ~200 |
| 28 | Deployment Architecture | 5 | ~150 |

### Complete Database Table Reference

| Table | Purpose | RLS |
|---|---|---|
| `lb_apps` | App registry | ✅ |
| `lb_developers` | Developer profiles | ✅ |
| `lb_developer_api_keys` | Developer API keys | ✅ |
| `lb_app_categories` | App categorization | Public read |
| `lb_app_collections` | Curated collections | Public read |
| `lb_app_installations` | Store ↔ app mapping | ✅ |
| `lb_app_access_tokens` | OAuth access tokens | ✅ |
| `lb_app_auth_codes` | Temporary auth codes | ✅ |
| `lb_app_extensions` | Extension definitions | ✅ |
| `lb_app_extension_configs` | Per-store extension settings | ✅ |
| `lb_app_webhooks` | Webhook subscriptions | ✅ |
| `lb_app_webhook_deliveries` | Delivery log | ✅ |
| `lb_app_charges` | Billing records | ✅ |
| `lb_app_usage_charges` | Usage-based billing | ✅ |
| `lb_app_reviews` | Internal review process | ✅ |
| `lb_app_user_reviews` | Merchant reviews | ✅ |
| `lb_app_activity_log` | Developer activity log | ✅ |
| `lb_app_versions` | App version history | ✅ |

### Key Packages

| Package | Purpose |
|---|---|
| `@letbuyy/app-bridge` | Communication SDK for embedded apps |
| `@letbuyy/extension-sdk` | Extension development framework |
| `@letbuyy/cli` | Developer CLI tool |
| `@letbuyy/types` | Shared TypeScript type definitions |

### API Endpoint Summary

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/oauth/authorize` | Start OAuth flow |
| `POST` | `/api/oauth/token` | Exchange code for token |
| `POST` | `/api/oauth/revoke` | Revoke access token |
| `GET` | `/api/apps` | List published apps |
| `GET` | `/api/apps/:slug` | Get app details |
| `POST` | `/api/apps/:id/reviews` | Submit review |
| `GET` | `/api/search` | Search apps |
| `GET` | `/api/search/suggestions` | Search autocomplete |
| `POST` | `/api/session-token` | Generate session token |
| `POST` | `/api/webhooks/register` | Register webhook |
| `POST` | `/api/billing/recurring` | Create subscription |
| `POST` | `/api/billing/usage` | Record usage charge |
| `POST` | `/api/developers/register` | Register as developer |
| `POST` | `/api/developers/apps` | Create new app |
| `POST` | `/api/developers/apps/:id/submit` | Submit for review |
| `GET` | `/api/developers/apps/:id/analytics` | Get analytics |
| `GET/PUT` | `/api/apps/extensions/:id/settings` | Extension settings |

---

> **Document Total: 28 Sections · 5 Parts · ~6,500+ Lines**
>
> This document serves as the complete blueprint for the LetBuyy App Store — the 8th application in the monorepo. It covers everything from OAuth authentication flows to extension rendering pipelines, from billing APIs to developer analytics dashboards.
>
> **Next Steps:**
> 1. Set up `apps/web/app-store` with Next.js 14
> 2. Run Supabase migrations for all `lb_*` tables
> 3. Implement OAuth endpoints
> 4. Build the marketplace UI
> 5. Create the developer portal
> 6. Publish `@letbuyy/app-bridge` and `@letbuyy/extension-sdk` packages

---

<!-- END OF DOCUMENT — 15_App_Store_Implementation.md -->
