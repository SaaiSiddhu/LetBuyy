# LetBuyy Platform — Architecture

> **Doc 01 of 12** | System Architecture, Infrastructure Layers & Project Structure
>
> **Version:** 8.0 | **Date:** February 14, 2026
>
> **Prev:** [00 Overview](./00_Overview.md) | **Next:** [02 Authentication & Security](./02_Authentication_and_Security.md)

---

## Table of Contents

1. [High-Level System Architecture](#1-high-level-system-architecture)
2. [Client Layer](#2-client-layer)
3. [Edge & API Layer (Cloudflare Workers)](#3-edge--api-layer-cloudflare-workers)
4. [Data Layer (Supabase)](#4-data-layer-supabase)
5. [AI Service Layer](#5-ai-service-layer)
6. [Caching & Real-Time Layer (Redis)](#6-caching--real-time-layer-redis)
7. [External Services & Integrations](#7-external-services--integrations)
8. [Monorepo Project Structure](#8-monorepo-project-structure)
9. [Shared Packages Deep Dive](#9-shared-packages-deep-dive)
10. [Request Lifecycle (End-to-End)](#10-request-lifecycle-end-to-end)
11. [Architecture Decisions & Rationale](#11-architecture-decisions--rationale)
12. [Performance & Edge Strategy](#12-performance--edge-strategy)
13. [Naming Conventions](#13-naming-conventions)
14. [Environment Variables](#14-environment-variables)
15. [Security Architecture](#15-security-architecture)
16. [Onboarding Architecture](#16-onboarding-architecture)
17. [Adaptive UI Engine Architecture](#17-adaptive-ui-engine-architecture)
18. [Notification & Event Bus Architecture](#18-notification--event-bus-architecture)
19. [Subscription & Trial Lifecycle](#19-subscription--trial-lifecycle)
20. [Observability & Error Handling](#20-observability--error-handling)

---

## 1. High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENTS                                        │
│                                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐ │
│  │  Flutter    │  │  Landing   │  │  Accounts  │  │   Admin    │  │ Storefront  │ │
│  │  Builder    │  │  (Next.js) │  │  (Next.js) │  │  (Next.js) │  │  (Next.js)  │ │
│  │  App        │  │            │  │            │  │            │  │  (Dynamic)  │ │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └──────┬──────┘ │
│        │               │               │               │                │        │
│  ┌─────┴──────┐  ┌─────┴──────┐                                                 │
│  │  Console   │  │   Team     │   All clients communicate via HTTPS              │
│  │  (Next.js) │  │  (Next.js) │   to the API layer or directly to Supabase       │
│  └─────┬──────┘  └─────┬──────┘                                                 │
└────────┼───────────────┼────────────────────────────────────────────────────────┘
         └───────┬───────┘
                 ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                     EDGE & API LAYER (Cloudflare Workers)                         │
│                                                                                   │
│  ┌─ api.letbuyy.store ──────────────────────────────────────────────────────────┐│
│  │                                                                               ││
│  │  Hono 4.x Framework (14KB, TypeScript-first, middleware-rich)                ││
│  │                                                                               ││
│  │  MIDDLEWARE CHAIN:                                                            ││
│  │  Request → CORS → Rate Limiter → JWT Auth → Role Check → Zod Validate → Handler││
│  │                      │              │           │                              ││
│  │                Upstash Redis    Supabase     Custom RBAC                      ││
│  │                                  Auth                                         ││
│  │                                                                               ││
│  │  ROUTE GROUPS:                                                                ││
│  │  /auth/*       → Authentication (OTP, password, 2FA, OAuth callbacks)        ││
│  │  /stores/*     → Store CRUD, subdomain provisioning, onboarding              ││
│  │  /products/*   → Product management, variants, inventory (Store type)        ││
│  │  /orders/*     → Order processing, lifecycle, fulfillment (Store type)       ││
│  │  /posts/*      → Blog post CRUD, versioning, scheduling (Blog type)          ││
│  │  /categories/* → Blog category management (Blog type)                        ││
│  │  /comments/*   → Comment CRUD, moderation queue (Blog type)                  ││
│  │  /projects/*   → Portfolio project management (Portfolio type)                ││
│  │  /resume/*     → Resume sections, export PDF/DOCX (Resume type)              ││
│  │  /pages/*      → Page builder CRUD, Craft.js JSON (All types)                ││
│  │  /media/*      → Media library upload/list/delete (Blog, Portfolio)           ││
│  │  /payments/*   → Stripe/Razorpay/PayPal integration                          ││
│  │  /ai/*         → AI generation, credit check, usage logging                  ││
│  │  /team/*       → Team member CRUD, RBAC, invitations                         ││
│  │  /analytics/*  → Traffic, revenue, conversion data                           ││
│  │  /admin/*      → Super admin operations (console only)                       ││
│  │                                                                               ││
│  └───────────────────────────────────────────────────────────────────────────────┘│
│                                                                                   │
│  ┌─ webhooks.letbuyy.store ─────────────────────────────────────────────────────┐│
│  │  Stripe webhook handler (signature verified)                                  ││
│  │  Razorpay webhook handler (signature verified)                                ││
│  │  PayPal IPN handler                                                           ││
│  └───────────────────────────────────────────────────────────────────────────────┘│
│                                                                                   │
│  EDGE SERVICES:                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                            │
│  │ Upstash Redis │  │Cloudflare R2 │  │Cloudflare KV │                            │
│  │ (Rate limit,  │  │(File storage,│  │(Feature flags│                            │
│  │  AI tracking, │  │ zero egress) │  │  edge cache) │                            │
│  │  caching)     │  │              │  │              │                            │
│  └──────────────┘  └──────────────┘  └──────────────┘                            │
└──────────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼                               ▼
┌──────────────────────────────────┐ ┌─────────────────────────────────────────────┐
│     DATA LAYER (Supabase)        │ │           AI SERVICE LAYER                   │
│                                  │ │                                              │
│  ┌──────────┐  ┌──────────────┐ │ │  ┌───────────────┐  ┌───────────────────┐   │
│  │PostgreSQL│  │ Supabase Auth│ │ │  │  Google AI     │  │  Anthropic        │   │
│  │   16     │  │ (JWT, OAuth, │ │ │  │  Gemini 3 Flash│  │  Claude Sonnet 4.5│   │
│  │ (RLS on  │  │  PKCE, OTP)  │ │ │  │  Gemini 3 Pro  │  │  Claude Opus 4.6  │   │
│  │  every   │  └──────────────┘ │ │  └───────────────┘  └───────────────────┘   │
│  │  table)  │  ┌──────────────┐ │ │                                              │
│  └──────────┘  │  Realtime    │ │ │  ROUTING: Task classifier selects cheapest   │
│                │  (WebSocket, │ │ │  model meeting quality requirements.          │
│  21+ tables    │   CDC)       │ │ │  FALLBACK: Auto-retry with next model.       │
│  with RLS      └──────────────┘ │ │  CACHE: Redis caching for repeated queries.  │
└──────────────────────────────────┘ └─────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                          EXTERNAL SERVICES                                        │
│                                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  Stripe  │  │ Razorpay │  │  Resend  │  │   FCM    │  │ EasyPost │          │
│  │(Payments)│  │(India Pay)│  │  (Email) │  │  (Push)  │  │(Shipping)│          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                       │
│  │  Vercel  │  │  Sentry  │  │ Logflare │                                       │
│  │(Web Host)│  │ (Errors) │  │  (Logs)  │                                       │
│  └──────────┘  └──────────┘  └──────────┘                                       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Client Layer

### 2.1 Next.js Web Applications

All web apps run **Next.js 15.1+** with App Router, React 19 Server Components, and deploy to **Vercel Edge Network**.

| App | Package | Domain | Purpose | Auth | Key Features |
|---|---|---|---|---|---|
| Landing | `@letbuyy/landing` | `letbuyy.store` | Marketing, blog, pricing | 🌐 Public | ISR, SEO optimized, ⌘K search |
| Accounts | `@letbuyy/accounts` | `accounts.letbuyy.store` | All authentication + onboarding | 🔒 Auth | Login, signup, OAuth, 2FA, onboarding wizard |
| Admin | `@letbuyy/admin` | `admin.letbuyy.store/{store}` | Per-store adaptive dashboard | 🔒 Auth + Store | Sidebar adapts to site_type, page builder, AI Studio |
| Storefront | `@letbuyy/storefront` | `*.letbuyy.store` | Published storefronts | 🌐 Public | Dynamic routing by subdomain, ISR, "Launching Soon" for drafts |
| Team | `@letbuyy/team` | `team.letbuyy.store` | Employee management portal | 🔒 Auth + Role | RBAC, task assignment |
| Console | `@letbuyy/console` | `console.letbuyy.store` | Super admin control panel | 🔒 VPN + 2FA + IP | Platform analytics, user management, billing override |

**Shared Web Stack:**

| Library | Version | Purpose |
|---|---|---|
| Tailwind CSS | 4.0 | CSS-first config, Lightning CSS engine, custom design tokens |
| shadcn/ui | Latest | Radix Primitives, 50+ customized components |
| React Hook Form + Zod | 7.x | Schema-first form validation |
| Recharts | 2.x | Analytics dashboard charts |
| TanStack Table | v8 | Data tables with sorting, filtering, pagination |
| Tiptap | 2.x | Blog rich text editor (ProseMirror-based) |
| Craft.js | 1.x | Drag-and-drop page builder (30+ blocks) |
| Framer Motion | 11.x | Layout animations, gestures, page transitions |
| Cmdk | Latest | ⌘K command palette for quick navigation |
| Sonner | 1.x | Stacked toast notifications |
| DOMPurify | 3.x | XSS-safe HTML rendering (blog content) |

### 2.2 Flutter Builder App

Native storefront management across **Android, iOS, macOS, Windows, Linux** from a single codebase.

| Component | Technology | Detail |
|---|---|---|
| Framework | Flutter 3.27+ (Dart 3.6+) | Null safety enforced, Impeller rendering |
| State | Riverpod 2.x | Code generation (`@riverpod` annotation), async-first |
| Navigation | GoRouter | Declarative, deep link support, auth guards |
| HTTP | Dio | Interceptors, retry logic, SSL pinning |
| Local Storage | SharedPreferences + Hive | Key-value + object box storage |
| Push | Firebase Cloud Messaging | iOS, Android, Web push notifications |
| Image Cache | Cached Network Image | Shimmer loading placeholders |

**Builder App Feature Tree:**
```
LOGIN → Store Selection (if multiple stores)
  └── Builder Dashboard
        ├── Products / Projects / Experience (adapts to site_type)
        ├── Orders (e-commerce only)
        ├── Blog Posts (blog only)
        ├── AI Studio (content generation, credit monitor)
        ├── Pages (limited visual editor)
        ├── Analytics (charts, metrics)
        ├── Settings (store config, billing)
        └── Publish (draft → published toggle)
```

**Key Capabilities:**
- Shared Supabase Auth (same credentials as web)
- Offline-first with background sync
- Camera integration for product photos
- Platform-adaptive UI (Material → Android, Cupertino → iOS, Fluent → Windows/macOS)

---

## 3. Edge & API Layer (Cloudflare Workers)

### 3.1 Why Cloudflare Workers

| Advantage | Detail |
|---|---|
| **0ms cold start** | V8 Isolates, not containers — instant execution |
| **180+ PoPs** | Globally distributed, sub-50ms latency worldwide |
| **Unlimited concurrency** | Auto-scales without configuration |
| **Built-in security** | DDoS protection, WAF, bot management included |
| **Cost efficient** | 100K requests/day free, $5/mo for 10M requests |

### 3.2 Framework: Hono 4.x

```typescript
// Example: Hono route setup (simplified)
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { rateLimiter } from './middleware/rate-limit'
import { authMiddleware } from './middleware/auth'
import { zodValidator } from './middleware/validation'

const app = new Hono()

// Global middleware chain
app.use('*', cors({ 
  origin: ['https://letbuyy.store', 'https://*.letbuyy.store'],
  credentials: true 
}))
app.use('*', rateLimiter())    // Upstash Redis sliding window
app.use('/api/*', authMiddleware())  // Supabase JWT verification

// Route groups
app.route('/api/stores', storeRoutes)
app.route('/api/products', productRoutes)
app.route('/api/orders', orderRoutes)
app.route('/api/posts', blogRoutes)       // Blog type
app.route('/api/comments', commentRoutes) // Blog type
app.route('/api/projects', projectRoutes) // Portfolio type
app.route('/api/resume', resumeRoutes)    // Resume type
app.route('/api/pages', pageRoutes)       // All types
app.route('/api/media', mediaRoutes)      // Blog + Portfolio
app.route('/api/ai', aiRoutes)
app.route('/api/payments', paymentRoutes)
app.route('/api/team', teamRoutes)
app.route('/api/analytics', analyticsRoutes)

export default app
```

### 3.3 Middleware Chain (Detailed)

```
INCOMING REQUEST
       │
       ▼
┌─────────────┐   Block requests from domains not in allowlist
│    CORS      │   Allowed: *.letbuyy.store, localhost:3000 (dev)
└──────┬──────┘
       ▼
┌─────────────┐   Upstash Redis sliding window counter
│ Rate Limiter │   Free: 10/min, Starter: 60/min, Biz: 300/min, Ent: 1000/min
└──────┬──────┘   AI endpoints: separate lower limits (5/20/60/200)
       ▼
┌─────────────┐   Verify Supabase JWT from Authorization header
│  JWT Auth    │   Extract user_id, email, role from token claims
└──────┬──────┘   Public routes (/health, storefront reads) skip this
       ▼
┌─────────────┐   Check user's role against route requirements
│  Role Check  │   user, admin, employee, super_admin
└──────┬──────┘   Store ownership verified for per-store routes
       ▼
┌─────────────┐   Zod schema validation on request body + query + path params
│  Zod Validate│   Type-safe, auto-generated error messages
└──────┬──────┘
       ▼
┌─────────────┐
│   Handler    │ → Business logic → Supabase queries → Response
└─────────────┘
```

### 3.4 API Route Map (Complete)

| Route Group | Endpoints | Site Type | Auth | Description |
|---|---|---|---|---|
| `/auth/*` | signup, login, otp, 2fa, callback, forgot, reset | All | Public/Auth | Supabase Auth wrapper |
| `/stores/*` | create, get, update, delete, check-subdomain | All | Auth | Store CRUD + onboarding |
| `/products/*` | CRUD, variants, bulk-import, inventory-adjust | Store | Auth+Store | Full product catalog management |
| `/orders/*` | create, list, update-status, cancel, refund | Store | Auth+Store | Order lifecycle management |
| `/posts/*` | CRUD, publish, schedule, versions, duplicate | Blog | Auth+Store | Blog post management + versioning |
| `/categories/*` | CRUD, reorder, merge | Blog | Auth+Store | Hierarchical category management |
| `/tags/*` | CRUD, auto-suggest | Blog | Auth+Store | Flat tag taxonomy |
| `/comments/*` | list, approve, spam, trash, reply | Blog | Auth+Store | Threaded comment moderation |
| `/projects/*` | CRUD, reorder, case-study | Portfolio | Auth+Store | Portfolio project management |
| `/resume/*` | sections, export-pdf, export-docx, import-linkedin | Resume | Auth+Store | Resume builder API |
| `/pages/*` | CRUD, Craft.js JSON save/load | All | Auth+Store | Page builder data |
| `/media/*` | upload, list, delete, folders | Blog, Portfolio | Auth+Store | Media library with R2 storage |
| `/ai/*` | generate, credits, usage, history | All | Auth+Store | AI content generation + tracking |
| `/payments/*` | create-checkout, verify, subscriptions, invoices | All | Auth | Stripe/Razorpay/PayPal |
| `/team/*` | invite, list, update-role, remove | All (not Resume) | Auth+Store+Admin | RBAC team management |
| `/analytics/*` | overview, traffic, revenue, conversions | All | Auth+Store | Dashboard analytics data |
| `/admin/*` | users, stores, billing-override, feature-flags | — | Super Admin | Platform administration |

### 3.5 Edge Storage Services

| Service | Use Case | Consistency | Pricing |
|---|---|---|---|
| **Cloudflare R2** | Product images, blog media, PDFs, exports | Strong | $0.015/GB stored, zero egress |
| **Upstash Redis** | Rate limiting, AI usage tracking, caching, sessions | Strong (single region) | Per-request ($0.2/100K commands) |
| **Cloudflare KV** | Feature flags, edge config, cached responses | Eventually consistent | 100K reads/day free |

---

## 4. Data Layer (Supabase)

### 4.1 PostgreSQL 16 — Feature Utilization

| Feature | Detail | Architectural Impact |
|---|---|---|
| **Row Level Security** | Enabled on every table — no exceptions. 4 distinct RLS patterns applied. | Zero-trust data isolation; multi-tenant queries automatically scoped |
| **Connection Pooling** | PgBouncer (transaction mode, 200 connections, 15s timeout) | Supports 200+ concurrent Workers without connection exhaustion |
| **Indexes** | B-tree on all FKs + PKs, GIN on JSONB + tsvector, pg_trgm on search columns | Sub-50ms query times even at 100K+ rows per table |
| **JSONB** | Store settings, product variants, theme config, survey answers, page builder (Craft.js JSON), order items | Flexible schema within relational constraints |
| **Full-Text Search** | `tsvector` columns with GIN indexes on products (title + description), blog_posts (title + content), projects (title + description) | In-DB search without external search service (no Typesense/Algolia) |
| **Triggers** | Auto-update `updated_at` on every mutation, auto-calculate `reading_time_minutes` on blog posts, auto-increment `version` on content edit | Business logic enforced at DB level, not application code |
| **Cron Jobs** | Scheduled publishing (`scheduled_at` → flip status to `published`), trial expiration checks (daily at 00:00 UTC), AI credit resets (monthly per plan) | Autonomous lifecycle management without external schedulers |
| **Partitioning** | Range partitioning on `ai_usage_logs` by month, `activity_logs` by quarter | Fast queries on time-series audit/analytics data |

### 4.2 Core Tables (21+ tables, all with RLS)

| Table | Site Type | Purpose | Key Columns |
|---|---|---|---|
| `stores` | All | Store records | user_id, subdomain, site_type, status, trial_ends_at |
| `products` | Store | Product catalog | store_id, title, price, variants (JSONB), inventory_count |
| `orders` | Store | Order records | store_id, customer_email, status, total, items (JSONB) |
| `blog_posts` | Blog | Blog content | store_id, title, slug, content (HTML), status, published_at |
| `blog_categories` | Blog | Hierarchical categories | store_id, name, slug, parent_id, color |
| `blog_tags` | Blog | Flat taxonomy | store_id, name, slug |
| `blog_comments` | Blog | Threaded comments | post_id, author, content, parent_id, status, depth (max 5) |
| `media_files` | Blog, Portfolio | Media library | store_id, url (R2), type, size, folder |
| `projects` | Portfolio | Portfolio projects | store_id, title, description, images, tech_stack |
| `experience` | Resume | Work history | store_id, company, role, start_date, end_date, bullets |
| `education` | Resume, Portfolio | Education records | store_id, institution, degree, field, year |
| `pages` | All (not Resume) | Page builder data | store_id, title, slug, content_json (Craft.js) |
| `ai_credits` | All | Credit balances | store_id, total_credits, used_credits, plan_credits |
| `ai_usage_logs` | All | AI call history | store_id, model, task, input_tokens, output_tokens, cost |
| `onboarding_attempts` | All | Signup tracking | user_id, subdomain, site_type, success, error_message |
| `store_surveys` | All | Onboarding survey answers | store_id, site_type, answers (JSONB) |
| `team_members` | All | RBAC team | store_id, user_id, role, permissions (JSONB) |
| `subscribers` | Blog, Landing | Newsletter subscribers | store_id, email, confirmed, subscribed_at |
| `email_logs` | All | Email delivery tracking | store_id, type, status, resend_message_id |
| `activity_logs` | All | Audit trail | store_id, user_id, action, entity, detail (JSONB) |
| `templates` | All | Store templates | name, site_type, preview_url, config (public read) |
| `plans` | All | Subscription plans | name, price, features, limits (public read) |

### 4.3 Critical Table Schemas (SQL)

```sql
-- ═══════════════════════════════════════════════════════════════
-- TABLE: stores (Central entity — every resource links to a store)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE stores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_name      TEXT NOT NULL CHECK (length(store_name) BETWEEN 2 AND 64),
  subdomain       TEXT UNIQUE NOT NULL CHECK (subdomain ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  site_type       TEXT NOT NULL CHECK (site_type IN ('store','portfolio','resume','blog','landing')),
  template_id     UUID REFERENCES templates(id),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','frozen','suspended')),
  plan_id         UUID REFERENCES plans(id),
  custom_domain   TEXT,                                -- e.g., 'www.myshop.com'
  settings        JSONB DEFAULT '{}'::jsonb,           -- theme, currency, locale, social links
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days',
  frozen_at       TIMESTAMPTZ,                         -- set when trial expires + grace period
  published_at    TIMESTAMPTZ,                         -- first publish timestamp
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_status ON stores(status);

-- ═══════════════════════════════════════════════════════════════
-- TABLE: products (E-commerce — infinite variant matrix)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE products (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 256),
  slug            TEXT NOT NULL,
  description     TEXT,                                -- AI-generated or manual
  price           DECIMAL(10,2) NOT NULL CHECK (price >= 0),
  compare_at_price DECIMAL(10,2),                     -- strikethrough price
  currency        TEXT DEFAULT 'INR' CHECK (length(currency) = 3),
  variants        JSONB DEFAULT '[]'::jsonb,           -- [{size: "L", color: "Red", sku: "...", stock: 10, price_override: null}]
  images          TEXT[] DEFAULT '{}',                  -- R2 URLs
  inventory_count INT DEFAULT 0 CHECK (inventory_count >= 0),
  low_stock_threshold INT DEFAULT 5,                   -- AI low-stock alert trigger
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  category        TEXT,
  tags            TEXT[] DEFAULT '{}',
  seo_title       TEXT,                                -- AI-generated SEO meta
  seo_description TEXT,
  weight_grams    INT,
  search_vector   TSVECTOR,                            -- auto-populated by trigger
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_search ON products USING GIN(search_vector);
CREATE INDEX idx_products_status ON products(store_id, status);

-- ═══════════════════════════════════════════════════════════════
-- TABLE: orders (Full lifecycle management)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE orders (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  order_number    SERIAL,                              -- human-readable #1001, #1002
  customer_email  TEXT NOT NULL,
  customer_name   TEXT,
  customer_phone  TEXT,
  items           JSONB NOT NULL,                      -- [{product_id, title, variant, quantity, price}]
  subtotal        DECIMAL(10,2) NOT NULL,
  discount        DECIMAL(10,2) DEFAULT 0,
  shipping_cost   DECIMAL(10,2) DEFAULT 0,
  tax             DECIMAL(10,2) DEFAULT 0,
  total           DECIMAL(10,2) NOT NULL,
  currency        TEXT DEFAULT 'INR',
  status          TEXT DEFAULT 'pending' CHECK (status IN (
                    'pending','confirmed','processing','shipped','delivered',
                    'cancelled','refunded','partially_refunded'
                  )),
  payment_provider TEXT CHECK (payment_provider IN ('stripe','razorpay','paypal')),
  payment_id      TEXT,                                -- Stripe session ID / Razorpay order ID
  payment_status  TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  shipping_address JSONB,                              -- {line1, line2, city, state, zip, country}
  tracking_number TEXT,
  tracking_url    TEXT,
  coupon_codes    TEXT[] DEFAULT '{}',                  -- multi-coupon stacking
  notes           TEXT,                                -- internal notes
  fulfilled_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  refunded_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_status ON orders(store_id, status);
CREATE INDEX idx_orders_customer ON orders(customer_email);
CREATE INDEX idx_orders_created ON orders(store_id, created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- TABLE: blog_posts (Full CMS — versioning, scheduling, SEO)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE blog_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) ON DELETE CASCADE NOT NULL,
  title           TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 256),
  slug            TEXT NOT NULL,
  content         TEXT,                                -- Tiptap HTML output (sanitized by DOMPurify)
  excerpt         TEXT,                                -- AI-generated or manual
  featured_image  TEXT,                                -- R2 URL
  category_id     UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','scheduled','archived')),
  published_at    TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,                         -- cron job auto-publishes at this time
  version         INT DEFAULT 1,                       -- auto-incremented on save
  reading_time_minutes INT DEFAULT 0,                  -- auto-calculated by trigger
  word_count      INT DEFAULT 0,                       -- auto-calculated by trigger
  seo_title       TEXT,
  seo_description TEXT,
  og_image        TEXT,
  search_vector   TSVECTOR,                            -- title + content for full-text search
  allow_comments  BOOLEAN DEFAULT true,
  is_featured     BOOLEAN DEFAULT false,
  layout          TEXT DEFAULT 'standard' CHECK (layout IN ('standard','magazine','minimal','grid')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

CREATE INDEX idx_posts_store_id ON blog_posts(store_id);
CREATE INDEX idx_posts_status ON blog_posts(store_id, status);
CREATE INDEX idx_posts_published ON blog_posts(store_id, published_at DESC);
CREATE INDEX idx_posts_search ON blog_posts USING GIN(search_vector);
CREATE INDEX idx_posts_scheduled ON blog_posts(scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

-- ═══════════════════════════════════════════════════════════════
-- TABLE: blog_comments (Threaded, moderated, guest-allowed)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE blog_comments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id         UUID REFERENCES blog_posts(id) ON DELETE CASCADE NOT NULL,
  parent_id       UUID REFERENCES blog_comments(id) ON DELETE CASCADE,  -- threading
  author_name     TEXT NOT NULL CHECK (length(author_name) BETWEEN 1 AND 128),
  author_email    TEXT NOT NULL,
  author_user_id  UUID REFERENCES auth.users(id),      -- NULL for guest comments
  content         TEXT NOT NULL CHECK (length(content) BETWEEN 1 AND 5000),
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','spam','trash')),
  depth           INT DEFAULT 0 CHECK (depth BETWEEN 0 AND 5),  -- max 5 levels deep
  ip_address      INET,                                -- for spam detection
  user_agent      TEXT,
  is_author_reply BOOLEAN DEFAULT false,               -- highlighted if post author replies
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_post ON blog_comments(post_id);
CREATE INDEX idx_comments_status ON blog_comments(post_id, status);
CREATE INDEX idx_comments_parent ON blog_comments(parent_id);
```

### 4.4 PostgreSQL Triggers & Functions

```sql
-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-update `updated_at` on every table mutation
-- Applied to: ALL tables with updated_at column
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_modified_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to every table (example for stores and products)
CREATE TRIGGER trg_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION update_modified_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_modified_at();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-calculate reading_time + word_count on blog_posts
-- Fires on INSERT and UPDATE of content column
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION calculate_reading_time()
RETURNS TRIGGER AS $$
DECLARE
  stripped_text TEXT;
  word_cnt INT;
BEGIN
  -- Strip HTML tags to get plain text
  stripped_text = regexp_replace(COALESCE(NEW.content, ''), '<[^>]+>', '', 'g');
  -- Count words (split by whitespace)
  word_cnt = array_length(string_to_array(trim(stripped_text), ' '), 1);
  IF word_cnt IS NULL THEN word_cnt = 0; END IF;
  
  NEW.word_count = word_cnt;
  NEW.reading_time_minutes = GREATEST(1, CEIL(word_cnt::DECIMAL / 200));  -- ~200 wpm
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_blog_reading_time
  BEFORE INSERT OR UPDATE OF content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION calculate_reading_time();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-populate search_vector for full-text search
-- Applied to: products, blog_posts, projects
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION update_product_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector = 
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_product_search_vector
  BEFORE INSERT OR UPDATE OF title, description, tags ON products
  FOR EACH ROW EXECUTE FUNCTION update_product_search_vector();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Auto-increment blog_post version on content update
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION increment_post_version()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.content IS DISTINCT FROM NEW.content THEN
    NEW.version = OLD.version + 1;
    -- Store previous version in blog_post_versions table
    INSERT INTO blog_post_versions (post_id, version, content, title, created_at)
    VALUES (OLD.id, OLD.version, OLD.content, OLD.title, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_post_versioning
  BEFORE UPDATE OF content ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION increment_post_version();

-- ═══════════════════════════════════════════════════════════════
-- CRON: Auto-publish scheduled blog posts (runs every minute)
-- ═══════════════════════════════════════════════════════════════
SELECT cron.schedule('publish-scheduled-posts', '* * * * *', $$
  UPDATE blog_posts 
  SET status = 'published', published_at = NOW()
  WHERE status = 'scheduled' 
    AND scheduled_at <= NOW()
    AND scheduled_at IS NOT NULL;
$$);

-- ═══════════════════════════════════════════════════════════════
-- CRON: Check trial expirations (runs daily at 00:00 UTC)
-- ═══════════════════════════════════════════════════════════════
SELECT cron.schedule('check-trial-expiry', '0 0 * * *', $$
  -- Freeze stores past grace period (trial_ends_at + 3 days)
  UPDATE stores 
  SET status = 'frozen', frozen_at = NOW()
  WHERE status = 'draft'
    AND trial_ends_at + INTERVAL '3 days' < NOW()
    AND plan_id IS NULL;
$$);
```

### 4.5 Index Strategy

| Index Type | Tables | Columns | Purpose |
|---|---|---|---|
| **B-tree (PK)** | All tables | `id` | Primary key lookups (O(log n)) |
| **B-tree (FK)** | products, orders, blog_posts, etc. | `store_id`, `user_id`, `post_id` | Join performance, RLS subquery speed |
| **B-tree (Composite)** | orders, blog_posts, products | `(store_id, status)`, `(store_id, created_at DESC)` | Filtered listing queries (e.g., "all published posts for store X") |
| **B-tree (Unique)** | stores, products, blog_posts | `subdomain`, `(store_id, slug)` | Uniqueness enforcement, slug collision prevention |
| **B-tree (Partial)** | blog_posts | `scheduled_at WHERE status = 'scheduled'` | Efficient cron scan for scheduled publishing |
| **GIN** | products, blog_posts, projects | `search_vector` (tsvector) | Full-text search with ranking |
| **GIN** | products, orders, stores | `variants`, `items`, `settings` (JSONB) | JSONB containment queries (`@>`, `?`) |
| **pg_trgm (GIN)** | products, blog_posts | `title` | Fuzzy/typo-tolerant search ("shos" → "shoes") |

### 4.6 RLS Policy Patterns (4 Types)

```sql
-- ───── PATTERN 1: Direct Ownership (stores, onboarding_attempts) ─────
-- User can only see/modify rows they directly own
CREATE POLICY "own_stores" ON stores FOR ALL
  USING (user_id = auth.uid());

-- ───── PATTERN 2: Store Ownership (products, orders, posts, etc.) ─────
-- User can access rows belonging to stores they own
CREATE POLICY "own_products" ON products FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- ───── PATTERN 3: Public Read (templates, plans) ─────
-- Anyone can read, no one can write (admin uses service_role_key)
CREATE POLICY "public_read_templates" ON templates FOR SELECT
  USING (true);

-- ───── PATTERN 4: Mixed Access (blog_comments) ─────
-- Guests can INSERT (pending status), store owners can moderate (UPDATE/DELETE)
CREATE POLICY "guest_insert_comments" ON blog_comments FOR INSERT
  WITH CHECK (status = 'pending');  -- guests can only create pending comments
CREATE POLICY "owner_moderate_comments" ON blog_comments FOR UPDATE
  USING (post_id IN (
    SELECT bp.id FROM blog_posts bp
    JOIN stores s ON bp.store_id = s.id
    WHERE s.user_id = auth.uid()
  ));
CREATE POLICY "public_read_approved" ON blog_comments FOR SELECT
  USING (status = 'approved');  -- anyone can read approved comments

-- ───── PATTERN 5: RBAC Team Access (team_members) ─────
-- Team members access based on permission scope matching
CREATE POLICY "team_access_products" ON products FOR ALL
  USING (store_id IN (
    SELECT tm.store_id FROM team_members tm
    WHERE tm.user_id = auth.uid()
      AND tm.permissions::jsonb ? 'products.read'
  ));
```

### 4.7 Supabase Auth

| Feature | Detail |
|---|---|
| Email/Password | OTP-based email verification (6-digit code, 10min expiry, max 3 attempts), bcrypt password hashing |
| OAuth | Google, GitHub, Apple (PKCE flow for SPA security — no client_secret exposed) |
| JWT | 1-hour access token, 7-day refresh token, auto-refresh via `@supabase/ssr` |
| 2FA | TOTP via authenticator apps (optional for users, recommended for admin, mandatory for super_admin) |
| Roles | `user`, `admin`, `employee`, `super_admin` (stored in JWT `app_metadata.role` claim) |
| Session | Server-side session management via `@supabase/ssr` cookies, HttpOnly + Secure + SameSite=Lax |
| Password Rules | Min 8 chars, 1 uppercase, 1 number, 1 special character, bcrypt cost factor 12 |
| Lockout | 5 failed login attempts → 15-minute lockout (tracked in Redis) |

### 4.8 Supabase Realtime (WebSocket CDC)

| Channel | Event | Payload | Consumer | Purpose |
|---|---|---|---|---|
| `orders:{store_id}` | INSERT | `{id, order_number, total, status}` | Admin dashboard | New order toast notification + sound |
| `orders:{store_id}` | UPDATE | `{id, status, previous_status}` | Admin orders page | Real-time status badge update |
| `inventory:{store_id}` | UPDATE | `{product_id, inventory_count}` | Admin products page | Live stock level changes (collaborative editing) |
| `comments:{post_id}` | INSERT | `{id, author_name, content, status}` | Admin comments page | New comment in moderation queue |
| `notifications:{user_id}` | INSERT | `{id, type, title, body, read}` | All apps (header bell icon) | In-app notification delivery |
| `pages:{store_id}` | UPDATE | `{page_id, content_json}` | Page builder | Collaborative page editing (conflict resolution) |

### 4.9 File Storage (Cloudflare R2) — Presigned URL Flow

All file uploads use **presigned URLs** — files upload directly from browser/app to R2, never through the API worker. This eliminates the Worker's 100MB body size limit and reduces Worker CPU time.

| Bucket | Content | Access | Max Size | Naming Convention |
|---|---|---|---|---|
| `product-images` | Product photos, variant images | Public (published stores) | 10MB | `{store_id}/products/{product_id}/{hash}.webp` |
| `blog-media` | Blog post images, embedded media | Public (published posts) | 10MB | `{store_id}/blog/{post_id}/{hash}.webp` |
| `portfolio-media` | Project images, gallery assets | Public (published projects) | 10MB | `{store_id}/projects/{project_id}/{hash}.webp` |
| `store-assets` | Logos, favicons, OG images, covers | Public | 5MB | `{store_id}/assets/{type}/{hash}.webp` |
| `avatars` | User profile photos | Public | 2MB | `users/{user_id}/avatar.webp` |
| `documents` | PDF/DOCX exports, resume files | Authenticated | 25MB | `{store_id}/docs/{filename}` |
| `ai-generated` | AI-produced images and assets | Authenticated | 10MB | `{store_id}/ai/{task}/{hash}.webp` |

**Upload Sequence:**

```
1. CLIENT: POST /api/media/presigned-url
   Body: { filename: "photo.jpg", contentType: "image/jpeg", bucket: "product-images", size: 2048576 }

2. API WORKER:
   ├── JWT auth → verify user owns the store
   ├── Validate file type (allowlist: jpg, png, webp, gif, mp4, pdf, docx)
   ├── Validate file size ≤ bucket max
   ├── Generate unique path: {store_id}/products/{uuid}.webp
   ├── Generate R2 presigned PUT URL (expires in 15 minutes)
   └── Return 200 { uploadUrl, publicUrl, expiresAt }

3. CLIENT: PUT {uploadUrl}
   Headers: Content-Type: image/jpeg
   Body: <raw file bytes>
   → Uploads directly to R2 (bypasses Worker entirely)

4. CLIENT: POST /api/products/{id}/images
   Body: { url: publicUrl }
   → Links the uploaded image to the product record

5. R2 serves file via cdn.letbuyy.store/{store_id}/products/{uuid}.webp
   → Edge-cached globally, zero egress fees
```

---

## 5. AI Service Layer

### 5.1 4-Model Multi-Provider Architecture

```
Client Request → API Worker (/ai/generate) → AI Router
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
                     │ FAST & CHEAP  │  │   REASONING   │  │  CREATIVE    │
                     │ Gemini 3 Flash│  │ Gemini 3 Pro  │  │Claude Son 4.5│
                     │ ~$0.001/call  │  │ ~$0.006/call  │  │ ~$0.013/call │
                     └──────────────┘  └──────────────┘  └──────────────┘
                                                │
                                    ┌───────────┘
                                    ▼
                           ┌──────────────┐
                           │   PREMIUM     │
                           │Claude Opus 4.6│
                           │ ~$0.10/call   │
                           └──────────────┘
                                    │
                                    ▼
                           ┌──────────────┐
                           │ Redis Logger  │ → ai:session:{id} (48h TTL)
                           │ + Credit      │ → ai:store:{id}:daily:{date} (30d TTL)
                           │   Deduction   │ → ai_credits table (decrement)
                           └──────────────┘ → ai_usage_logs table (insert)
```

### 5.2 Task-to-Model Routing

| Category | Model | Example Tasks | Credits | Avg Latency | Token Budget |
|---|---|---|---|---|---|
| Fast & Cheap | Gemini 3 Flash | SEO meta, product short desc, blog ideas, tags, category suggestions | 1 | ~800ms | 500 in / 200 out |
| Smart Reasoning | Gemini 3 Pro | Smart pricing, ATS scoring, blog SEO, market analysis, content strategy | 3 | ~2s | 1,000 in / 500 out |
| Creative Writing | Claude Sonnet 4.5 | Blog drafts, product detailed desc, resume bullets, landing copy, case studies | 2-5 | ~3s | 2,000 in / 2,000 out |
| Premium Analysis | Claude Opus 4.6 | Full business reports, content audit, competitor intelligence | 10 | ~8s | 4,000 in / 4,000 out |

### 5.3 AI Router — TypeScript Implementation

```typescript
// packages/typescript/ai/src/router.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Anthropic } from "@anthropic-ai/sdk";
import { Redis } from "@upstash/redis";

// ── Task-to-Model mapping (single source of truth) ────────────────────
const TASK_MODEL_MAP: Record<string, { model: string; provider: "google" | "anthropic"; credits: number }> = {
  // Gemini 3 Flash — bulk, fast, cheap
  "seo-meta":            { model: "gemini-3-flash", provider: "google",    credits: 1 },
  "product-short-desc":  { model: "gemini-3-flash", provider: "google",    credits: 1 },
  "tag-suggestions":     { model: "gemini-3-flash", provider: "google",    credits: 1 },
  "blog-ideas":          { model: "gemini-3-flash", provider: "google",    credits: 1 },
  "category-suggest":    { model: "gemini-3-flash", provider: "google",    credits: 1 },
  
  // Gemini 3 Pro — reasoning, analysis
  "smart-pricing":       { model: "gemini-3-pro",   provider: "google",    credits: 3 },
  "ats-scoring":         { model: "gemini-3-pro",   provider: "google",    credits: 3 },
  "blog-seo":            { model: "gemini-3-pro",   provider: "google",    credits: 3 },
  "market-analysis":     { model: "gemini-3-pro",   provider: "google",    credits: 3 },
  
  // Claude Sonnet 4.5 — creative, long-form
  "blog-draft":          { model: "claude-sonnet-4-5", provider: "anthropic", credits: 5 },
  "product-detail-desc": { model: "claude-sonnet-4-5", provider: "anthropic", credits: 3 },
  "resume-bullets":      { model: "claude-sonnet-4-5", provider: "anthropic", credits: 2 },
  "landing-copy":        { model: "claude-sonnet-4-5", provider: "anthropic", credits: 4 },
  
  // Claude Opus 4.6 — premium, deep analysis
  "business-report":     { model: "claude-opus-4-6",   provider: "anthropic", credits: 10 },
  "content-audit":       { model: "claude-opus-4-6",   provider: "anthropic", credits: 10 },
  "competitor-intel":    { model: "claude-opus-4-6",   provider: "anthropic", credits: 10 },
};

// ── Fallback chain (cheapest → expensive) ─────────────────────────────
const FALLBACK_CHAIN = [
  { model: "gemini-3-flash",   provider: "google" as const },
  { model: "gemini-3-pro",     provider: "google" as const },
  { model: "claude-sonnet-4-5", provider: "anthropic" as const },
  { model: "claude-opus-4-6",   provider: "anthropic" as const },
];

export async function routeAIRequest({
  task,
  input,
  storeId,
  storeContext,  // from onboarding survey — informs prompt
  env,
}: AIRouterInput): Promise<AIRouterOutput> {
  const sessionId = crypto.randomUUID();
  const startTime = Date.now();
  
  // 1. Resolve model for this task
  const mapping = TASK_MODEL_MAP[task];
  if (!mapping) throw new Error(`Unknown AI task: ${task}`);
  
  // 2. Check credit balance
  const credits = await checkCredits(storeId, mapping.credits, env.SUPABASE);
  if (!credits.sufficient) {
    return { error: "INSUFFICIENT_CREDITS", credits_remaining: credits.remaining };
  }
  
  // 3. Build prompt with store context
  const prompt = buildPrompt(task, input, storeContext);
  
  // 4. Call AI provider with fallback chain
  let response: AIResponse | null = null;
  let actualModel = mapping.model;
  let actualCredits = mapping.credits;
  
  // Try primary model first, then fallback chain
  const modelsToTry = [
    { model: mapping.model, provider: mapping.provider },
    ...FALLBACK_CHAIN.filter(f => f.model !== mapping.model)
  ];
  
  for (const candidate of modelsToTry) {
    try {
      response = await callProvider(candidate, prompt, env);
      actualModel = candidate.model;
      // Credit deduction based on actual model used (not requested)
      actualCredits = FALLBACK_CHAIN.findIndex(f => f.model === candidate.model) + 1;
      break;
    } catch (err) {
      console.error(`Model ${candidate.model} failed:`, err);
      continue; // try next in fallback chain
    }
  }
  
  if (!response) throw new Error("All AI models failed");
  
  const latencyMs = Date.now() - startTime;
  
  // 5. Log to Redis (async — don't block response)
  await Promise.all([
    logToRedis(env.REDIS, sessionId, storeId, actualModel, response, latencyMs),
    deductCredits(storeId, actualCredits, env.SUPABASE),
    insertUsageLog(storeId, actualModel, task, response, actualCredits, env.SUPABASE),
  ]);
  
  return {
    content: response.content,
    model_used: actualModel,
    input_tokens: response.inputTokens,
    output_tokens: response.outputTokens,
    latency_ms: latencyMs,
    credits_deducted: actualCredits,
    credits_remaining: credits.remaining - actualCredits,
    session_id: sessionId,
  };
}
```

### 5.4 Prompt Engineering Templates

Every AI call uses a structured prompt template that includes the store's context (from the onboarding survey). This ensures personalized, relevant outputs.

```typescript
// Template structure for all AI prompts
const PROMPT_TEMPLATES: Record<string, PromptTemplate> = {
  "blog-draft": {
    systemPrompt: `You are a professional blog writer for a {site_type} website.
      Store: {store_name} | Niche: {niche} | Tone: {tone}
      Audience: {target_audience}
      Write in {language}. Use markdown formatting.
      Include a compelling introduction, 3-5 key sections with subheadings,
      and a conclusion with a call-to-action.`,
    userPromptTemplate: `Write a blog post about: {topic}
      Desired length: {length} words
      Tone: {tone}
      Include SEO keywords: {keywords}`,
  },
  
  "seo-meta": {
    systemPrompt: `Generate SEO metadata for a {site_type} website.
      Respond in JSON format: { "title": "...", "description": "...", "keywords": [...] }
      Title: max 60 chars. Description: max 155 chars.`,
    userPromptTemplate: `Content: {content_summary}\nPage type: {page_type}`,
  },
  
  "ats-scoring": {
    systemPrompt: `You are an ATS (Applicant Tracking System) expert.
      Score this resume section against the job description.
      Return JSON: { "score": 0-100, "strengths": [...], "improvements": [...], "keywords_missing": [...] }`,
    userPromptTemplate: `Resume section: {resume_text}\nTarget role: {target_role}\nJob description: {job_description}`,
  },

  "smart-pricing": {
    systemPrompt: `You are a pricing strategist for e-commerce.
      Analyze competitor pricing, market positioning, and cost structure.
      Return JSON: { "suggested_price": number, "price_range": { min, max },
        "reasoning": string, "competitor_comparison": [...] }`,
    userPromptTemplate: `Product: {product_title}\nCategory: {category}\nCost: {cost_price}\nCompetitors: {competitor_data}`,
  },
};
```

### 5.5 Streaming Response Pattern

For long-form content (blog drafts, detailed descriptions), the API streams tokens to the client using **Server-Sent Events (SSE)**, providing real-time output in the AI Studio UI.

```typescript
// Streaming AI response via SSE (Cloudflare Workers)
export async function handleStreamingAI(c: Context) {
  const { task, input, store_id } = await c.req.json();
  
  // Validate credits BEFORE starting stream
  const credits = await checkCredits(store_id, getCreditsForTask(task), c.env.SUPABASE);
  if (!credits.sufficient) return c.json({ error: "INSUFFICIENT_CREDITS" }, 402);
  
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  
  // Start streaming in background
  c.executionCtx.waitUntil((async () => {
    try {
      const stream = await callProviderStreaming(task, input, c.env);
      let fullContent = "";
      let totalTokens = 0;
      
      for await (const chunk of stream) {
        fullContent += chunk.text;
        totalTokens += chunk.tokens;
        // Send SSE event
        await writer.write(encoder.encode(
          `data: ${JSON.stringify({ text: chunk.text, tokens: totalTokens })}\n\n`
        ));
      }
      
      // Final event with metadata
      await writer.write(encoder.encode(
        `data: ${JSON.stringify({ done: true, total_tokens: totalTokens })}\n\n`
      ));
      
      // Post-stream: log + deduct (non-blocking)
      await Promise.all([
        logToRedis(c.env.REDIS, crypto.randomUUID(), store_id, stream.model, { inputTokens: stream.inputTokens, outputTokens: totalTokens, content: fullContent }, Date.now() - stream.startTime),
        deductCredits(store_id, getCreditsForTask(task), c.env.SUPABASE),
      ]);
    } catch (err) {
      await writer.write(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
    } finally {
      await writer.close();
    }
  })());
  
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
```

### 5.6 Cost Calculation Formula

```
Cost per AI call = (input_tokens × input_price_per_1M / 1,000,000)
                 + (output_tokens × output_price_per_1M / 1,000,000)

┌──────────────────┬────────────────┬─────────────────┬─────────────────┐
│ Model            │ Input $/1M tok │ Output $/1M tok │ Avg cost/call   │
├──────────────────┼────────────────┼─────────────────┼─────────────────┤
│ Gemini 3 Flash   │ $0.10          │ $0.40           │ ~$0.001         │
│ Gemini 3 Pro     │ $1.25          │ $5.00           │ ~$0.006         │
│ Claude Sonnet 4.5│ $3.00          │ $15.00          │ ~$0.013         │
│ Claude Opus 4.6  │ $15.00         │ $75.00          │ ~$0.10          │
└──────────────────┴────────────────┴─────────────────┴─────────────────┘

Monthly AI cost estimate (per 1,000 stores):
  70% Flash + 20% Pro + 8% Sonnet + 2% Opus
  = 700 × $0.001 + 200 × $0.006 + 80 × $0.013 + 20 × $0.10
  = $0.70 + $1.20 + $1.04 + $2.00
  = ~$4.94/month per 1,000 AI calls
```

### 5.7 Fallback Strategy

If the primary model fails (503, timeout, rate limit), the system auto-retries with the next cheapest model: **Flash → Pro → Sonnet → Opus**. The credit deduction is based on the model that actually served the response.

```
Primary model fails?
  ├── HTTP 503 (Service Unavailable) → immediate fallback
  ├── Timeout (model-specific: Flash 5s, Pro 10s, Sonnet 15s, Opus 30s) → fallback
  ├── HTTP 429 (Rate Limited) → wait 1s → retry same → if still fails → fallback
  └── HTTP 400 (Bad Request) → DO NOT fallback → return error to user

Fallback chain: Flash → Pro → Sonnet → Opus
  └── If ALL fail → return 503 { error: "AI_SERVICE_UNAVAILABLE" }
  └── Credits are NOT deducted on failure
```

---

## 6. Caching & Real-Time Layer (Redis)

### 6.1 Upstash Redis (Serverless)

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `ai:session:{session_id}` | HASH | 48h | Per-AI-call tracking (model, tokens, cost, latency, status) |
| `ai:store:{store_id}:daily:{date}` | HASH | 30d | Daily aggregates (calls, tokens, cost per model) |
| `rate:{store_id}:{endpoint}` | STRING | 60s | Sliding window rate limiting |
| `cache:product:{product_id}` | STRING | 5min | Hot product page cache (JSON) |
| `cache:post:{post_id}` | STRING | 5min | Blog post cache (rendered HTML + metadata) |
| `session:{user_id}` | HASH | 24h | Active session (store_id, IP, user_agent, last_active) |
| `email:campaign:{id}:{user_id}` | STRING | 7d | Email de-duplication |

### 6.2 Rate Limits by Plan

| Plan | API (req/min) | AI (req/min) |
|---|---|---|
| Free (Trial) | 10 | 5 |
| Starter ($9/mo) | 60 | 20 |
| Business ($29/mo) | 300 | 60 |
| Enterprise ($99/mo) | 1,000 | 200 |

---

## 7. External Services & Integrations

### 7.1 Service Dependency Map

| Service | Integration | Purpose | Auth | Failover |
|---|---|---|---|---|
| **Stripe** | `/payments/stripe/*` + webhook | Global payments (cards, wallets, Apple/Google Pay) | API key + webhook signature | PayPal fallback |
| **Razorpay** | `/payments/razorpay/*` + webhook | India payments (UPI, netbanking, cards, wallets) | API key + webhook signature | Stripe India |
| **PayPal** | `/payments/paypal/*` + IPN | Fallback global payments | API key + IPN verification | Manual bank transfer |
| **Resend** | API calls from Workers | Transactional + trial + marketing emails (React Email templates) | API key | Retry queue (3 attempts) |
| **FCM** | Firebase Cloud Messaging SDK | Push notifications (iOS, Android, Web) | Service account JSON | In-app fallback |
| **EasyPost** | `/shipping/*` | Label generation, rate shopping, tracking webhook | API key | Manual shipping entry |
| **Sentry** | Client + Worker SDKs | Error tracking with source maps, performance monitoring | DSN | Logflare fallback |
| **Logflare** | Worker tail logs | Structured JSON logging with BigQuery sink | API key | Console.log fallback |
| **Vercel** | Git-push deploy | Web app hosting, preview environments, Edge SSR, ISR | Git integration | — |
| **GitHub Actions** | CI/CD pipeline | Lint → type-check → test → build → deploy → notify | GitHub token | Manual deploy |
| **Cloudflare** | DNS + R2 + Workers | CDN, file storage, API runtime, image transformations | API token | — |
| **Turnstile** | Auth pages | Bot detection (replaces reCAPTCHA, no GDPR issues) | Site key + secret key | Honeypot fallback |

### 7.2 Webhook Processing Architecture

All incoming webhooks are handled by a dedicated **webhook Worker** (`webhooks.letbuyy.store`) — isolated from the main API to prevent webhook failures from affecting API availability.

```
External Service → webhooks.letbuyy.store/{provider}
                         │
                    ┌────┴────┐
                    │ VERIFY  │ ← Signature verification (Stripe: HMAC-SHA256,
                    │ SIGNAT. │   Razorpay: HMAC-SHA256, PayPal: IPN verification)
                    └────┬────┘
                         │ ✅ Valid
                    ┌────┴────┐
                    │  PARSE  │ ← Extract event type, payload, idempotency key
                    │ PAYLOAD │
                    └────┬────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         ┌─────────┐ ┌─────────┐ ┌──────────┐
         │ PAYMENT │ │ PAYMENT │ │ SHIPPING │
         │ SUCCESS │ │ FAILED  │ │ UPDATE   │
         └────┬────┘ └────┬────┘ └────┬─────┘
              │          │          │
              ▼          ▼          ▼
         ┌──────────────────────────────┐
         │ UPDATE Supabase:              │
         │ • orders.payment_status       │
         │ • orders.status               │
         │ • activity_logs (audit)       │
         │ • notifications (realtime)    │
         └──────────────────────────────┘
              │
              ▼
         ┌──────────────────────────────┐
         │ POST-ACTIONS:                 │
         │ • Send email (Resend)         │
         │ • Push notification (FCM)     │
         │ • Update inventory count      │
         │ • Trigger shipping label      │
         └──────────────────────────────┘
```

### 7.3 CI/CD Pipeline (GitHub Actions)

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  TRIGGER: Push to main / Pull Request / Manual dispatch                            │
└──────────────────────────────────┬──────────────────────────────────────────────────┘
                                   │
           ┌───────────────────────┼───────────────────────┐
           ▼                       ▼                       ▼
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │  STAGE 1:    │       │  STAGE 1:    │       │  STAGE 1:    │
    │  Lint + Type │       │  Lint + Type │       │  Lint (Dart) │
    │  (TS apps)   │       │  (Workers)   │       │  (Flutter)   │
    │  eslint,     │       │  eslint,     │       │  dart analyze │
    │  tsc --noEmit│       │  tsc --noEmit│       │  dart format  │
    └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
           │                      │                      │
           ▼                      ▼                      ▼
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │  STAGE 2:    │       │  STAGE 2:    │       │  STAGE 2:    │
    │  Unit Tests  │       │  Unit Tests  │       │  Unit Tests  │
    │  (Vitest)    │       │  (Vitest)    │       │  (flutter    │
    │  + coverage  │       │  + coverage  │       │   test)      │
    └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
           │                      │                      │
           ▼                      ▼                      ▼
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │  STAGE 3:    │       │  STAGE 3:    │       │  STAGE 3:    │
    │  Build       │       │  Deploy to   │       │  Build APK/  │
    │  (Turborepo  │       │  Cloudflare  │       │  IPA/AAB     │
    │   --filter)  │       │  Workers     │       │  (Flutter)   │
    └──────┬───────┘       └──────┬───────┘       └──────┬───────┘
           │                      │                      │
           ▼                      ▼                      ▼
    ┌──────────────┐       ┌──────────────┐       ┌──────────────┐
    │  STAGE 4:    │       │  STAGE 4:    │       │  STAGE 4:    │
    │  Deploy to   │       │  Smoke Tests │       │  Upload to   │
    │  Vercel      │       │  (health     │       │  Play Store  │
    │  (preview or │       │   check API) │       │  / TestFlight│
    │   production)│       │              │       │              │
    └──────┬───────┘       └──────────────┘       └──────────────┘
           │
           ▼
    ┌──────────────┐
    │  STAGE 5:    │
    │  Notify      │
    │  (Slack/     │
    │   Discord)   │
    └──────────────┘
```

**Turborepo Remote Cache:** All CI builds use `--cache-dir=.turbo` with remote cache on Vercel. Unchanged packages skip build entirely, reducing average CI time from ~8min to ~2min.

---

## 8. Monorepo Project Structure

```
Letbuyy_Store/                              # Root (Turborepo)
│
├── 📁 apps/
│   ├── 📁 flutter/
│   │   ├── 📁 builder/                    # Flutter Builder App
│   │   │   ├── android/ ios/ macos/ windows/ linux/
│   │   │   └── lib/
│   │   │       ├── main.dart
│   │   │       ├── app/                   # App config, router, theme
│   │   │       ├── features/
│   │   │       │   ├── auth/              # Login, signup (Supabase Auth)
│   │   │       │   ├── dashboard/         # Adaptive dashboard (by site_type)
│   │   │       │   ├── products/          # Store type: product CRUD
│   │   │       │   ├── orders/            # Store type: order management
│   │   │       │   ├── posts/             # Blog type: post editor
│   │   │       │   ├── projects/          # Portfolio type: project CRUD
│   │   │       │   ├── resume/            # Resume type: sections + export
│   │   │       │   ├── ai_studio/         # AI generation + credit monitor
│   │   │       │   ├── pages/             # Page builder (limited)
│   │   │       │   ├── analytics/         # Charts, metrics
│   │   │       │   └── settings/          # Store config, billing
│   │   │       ├── services/              # API client, auth, storage
│   │   │       ├── widgets/               # Shared UI components
│   │   │       └── theme/                 # Material/Cupertino/Fluent
│   │   │
│   │   ├── 📁 super_admin/               # Super Admin Flutter App
│   │   └── 📁 team/                      # Team Portal Flutter App
│   │
│   └── 📁 web/
│       ├── 📁 landing/                    # letbuyy.store (marketing)
│       │   └── src/app/
│       │       ├── page.tsx               # Hero, features, pricing
│       │       ├── pricing/               # Plan comparison
│       │       ├── blog/                  # Marketing blog (ISR)
│       │       └── templates/             # Template gallery
│       │
│       ├── 📁 accounts/                   # accounts.letbuyy.store
│       │   └── src/app/
│       │       ├── login/                 # Email + OAuth login
│       │       ├── signup/                # Registration + OTP
│       │       ├── onboarding/            # Site type + store name wizard
│       │       ├── forgot-password/       # Password reset flow
│       │       ├── callback/[provider]/   # OAuth callback handler
│       │       └── 2fa/                   # Two-factor setup/verify
│       │
│       ├── 📁 admin/                      # admin.letbuyy.store/{store}
│       │   └── src/app/[store]/
│       │       ├── dashboard/             # Adaptive dashboard (by site_type)
│       │       ├── onboarding/            # Site-type survey + template pick
│       │       ├── products/              # Store: product management
│       │       ├── orders/                # Store: order lifecycle
│       │       ├── posts/                 # Blog: post editor (Tiptap)
│       │       ├── categories/            # Blog: category manager
│       │       ├── tags/                  # Blog: tag manager
│       │       ├── comments/              # Blog: comment moderation
│       │       ├── projects/              # Portfolio: project manager
│       │       ├── gallery/               # Portfolio: image gallery
│       │       ├── experience/            # Resume: work history
│       │       ├── skills/                # Resume + Portfolio: skills
│       │       ├── education/             # Resume + Portfolio: education
│       │       ├── sections/              # Landing: Craft.js sections
│       │       ├── forms/                 # Landing: form builder
│       │       ├── ab-tests/              # Landing: A/B testing
│       │       ├── media/                 # Blog + Portfolio: media library
│       │       ├── subscribers/           # Blog + Landing: newsletter
│       │       ├── pages/                 # All: page builder (Craft.js)
│       │       ├── ai-studio/             # All: AI generation + credits
│       │       ├── analytics/             # All: traffic, revenue, conversions
│       │       └── settings/              # All: store config, billing, domain
│       │
│       ├── 📁 storefront/                # *.letbuyy.store (dynamic)
│       │   └── src/app/
│       │       ├── [subdomain]/           # Dynamic per-store routing
│       │       │   ├── page.tsx           # Store homepage / blog index
│       │       │   ├── products/[slug]/   # Product detail (Store type)
│       │       │   ├── cart/              # Shopping cart (Store type)
│       │       │   ├── checkout/          # Checkout flow (Store type)
│       │       │   ├── blog/[slug]/       # Blog post page (Blog type)
│       │       │   ├── projects/[slug]/   # Project detail (Portfolio type)
│       │       │   └── contact/           # Contact form (Portfolio type)
│       │       └── launching-soon/        # Draft stores: "Launching Soon" page
│       │
│       ├── 📁 team/                      # team.letbuyy.store
│       └── 📁 console/                   # console.letbuyy.store
│
├── 📁 packages/
│   ├── 📁 dart/
│   │   ├── 📁 core/                      # letbuyy_core: Dart utilities
│   │   ├── 📁 models/                    # letbuyy_models: shared data models
│   │   ├── 📁 services/                  # letbuyy_services: API client
│   │   └── 📁 ui_kit/                    # letbuyy_ui_kit: shared Flutter widgets
│   │
│   └── 📁 typescript/
│       ├── 📁 ui/                        # @letbuyy/ui
│       ├── 📁 db/                        # @letbuyy/db
│       ├── 📁 auth/                      # @letbuyy/auth
│       ├── 📁 ai/                        # @letbuyy/ai
│       ├── 📁 config/                    # @letbuyy/config
│       ├── 📁 email/                     # @letbuyy/email
│       └── 📁 types/                     # @letbuyy/types
│
├── 📁 backend/
│   ├── 📁 workers/
│   │   ├── 📁 api/                       # api.letbuyy.store (Hono 4.x)
│   │   │   ├── src/
│   │   │   │   ├── index.ts              # Hono app entry
│   │   │   │   ├── routes/               # auth, stores, products, orders,
│   │   │   │   │                         # posts, comments, projects, resume,
│   │   │   │   │                         # pages, media, ai, payments, team,
│   │   │   │   │                         # analytics, admin
│   │   │   │   ├── middleware/            # cors, rateLimit, auth, roleCheck,
│   │   │   │   │                         # zodValidate, aiCredits
│   │   │   │   └── utils/                # helpers, constants, types
│   │   │   └── wrangler.toml
│   │   │
│   │   └── 📁 webhooks/                  # webhooks.letbuyy.store
│   │       └── src/
│   │           ├── stripe.ts             # Stripe webhook handler
│   │           ├── razorpay.ts           # Razorpay webhook handler
│   │           └── paypal.ts             # PayPal IPN handler
│   │
│   └── 📁 supabase/
│       ├── 📁 migrations/                # SQL migrations (versioned)
│       ├── 📁 functions/                 # Edge Functions (triggers, cron)
│       ├── 📁 seed/                      # Seed data (templates, plans)
│       └── config.toml                   # Supabase project config
│
├── 📁 infrastructure/
│   ├── vercel.json                       # Vercel project settings
│   ├── 📁 cloudflare/                    # DNS records (Terraform)
│   └── 📁 scripts/                       # Migration scripts, seed scripts
│
├── 📁 docs/                              # This documentation (00-12)
│
├── turbo.json                            # Turborepo pipeline config
├── pnpm-workspace.yaml                   # TypeScript workspace
├── pubspec.yaml                          # Flutter workspace
└── .github/workflows/                    # CI/CD pipelines
```

---

## 9. Shared Packages Deep Dive

### 9.1 TypeScript Packages (`packages/typescript/`)

| Package | Purpose | Used By |
|---|---|---|
| `@letbuyy/ui` | 50+ React components (shadcn/ui + Radix), custom purple theme, dark mode, responsive | All Next.js apps |
| `@letbuyy/db` | Supabase client init, auto-generated TS types (`supabase gen types`), RLS helpers, typed queries | All apps |
| `@letbuyy/auth` | Session management, JWT validation, 2FA helpers, OAuth state, route protection middleware | Accounts, Admin, API |
| `@letbuyy/ai` | Provider abstraction (Gemini + Claude), task-to-model routing, credit management, Redis tracking | Admin, API, Builder |
| `@letbuyy/config` | ESLint (strict TS), TypeScript (strict, path aliases), Tailwind (custom theme tokens), Prettier | All apps |
| `@letbuyy/email` | React Email templates (Resend). Templates: welcome, trial reminder, store created, OTP, team invite | API, Accounts |
| `@letbuyy/types` | Shared enums (SiteType, StoreStatus, OrderStatus, AIModel), constants, type utilities | All apps |

### 9.2 Dart Packages (`packages/dart/`)

| Package | Purpose | Used By |
|---|---|---|
| `letbuyy_core` | Dart utility functions, extensions, constants | All Flutter apps |
| `letbuyy_models` | Shared data models (Store, Product, Order, Post) with JSON serialization | All Flutter apps |
| `letbuyy_services` | API client (Dio), Supabase client wrapper, auth service | All Flutter apps |
| `letbuyy_ui_kit` | Shared Flutter widgets, theme data, platform-adaptive components | All Flutter apps |

---

## 10. Request Lifecycle (End-to-End)

### 10.1 Example: Creating a Blog Post

```
1. USER clicks "New Post" in admin.letbuyy.store/{store}/posts

2. ADMIN APP (Next.js) renders Tiptap editor with empty document

3. USER writes content, adds images (uploaded directly to R2 via presigned URL)

4. USER clicks "Publish"
   └── POST /api/posts
       Body: { title, slug, content, category_id, tags[], status: "published" }

5. CLOUDFLARE WORKER receives request
   ├── CORS check → ✅ Origin: admin.letbuyy.store
   ├── Rate limit → ✅ 45/60 used (Starter plan)
   ├── JWT auth → ✅ user_id extracted from Supabase token
   ├── Role check → ✅ user owns this store
   ├── Zod validate → ✅ body matches BlogPostSchema
   └── Handler executes:
       ├── DOMPurify sanitizes HTML content
       ├── Calculate reading_time_minutes (~200 words/min)
       ├── INSERT INTO blog_posts (...) → RLS validates store ownership
       ├── INSERT INTO blog_post_tags (post_id, tag_id) for each tag
       ├── Invalidate Redis cache: DEL cache:post:{post_id}
       ├── Log to activity_logs (action: "post.publish")
       └── Return 201 { id, slug, url }

6. SUPABASE REALTIME broadcasts INSERT event on posts:{store_id} channel

7. STOREFRONT ({store}.letbuyy.store/blog/{slug}) serves the post via ISR
   └── Next.js fetches from Supabase → caches in Redis → renders RSC → Edge CDN
```

### 10.2 Example: AI Content Generation

```
1. USER opens AI Studio → clicks "Generate Blog Post Draft"
   └── Input: topic, tone, length

2. POST /api/ai/generate
   Body: { task: "blog-draft", input: { topic, tone, length }, store_id }

3. WORKER middleware chain → passes all checks

4. AI ROUTER (in handler):
   ├── Check ai_credits table → sufficient balance? (5 credits needed)
   ├── Task classifier → "blog-draft" → maps to Claude Sonnet 4.5
   ├── Build prompt (system prompt + user input + store context from survey)
   ├── Call Anthropic API → await response
   │   └── If FAIL → fallback to Gemini 3 Pro → if FAIL → return error
   ├── Log to Redis: HSET ai:session:{uuid} model, tokens, cost, latency
   ├── Increment Redis: HINCRBY ai:store:{id}:daily:{date} total_calls 1
   ├── Deduct credits: UPDATE ai_credits SET used_credits = used_credits + 5
   ├── INSERT INTO ai_usage_logs (model, task, tokens, cost, credits)
   └── Return 200 { content, model_used, tokens, credits_remaining }
```

### 10.3 Example: E-Commerce Checkout Flow

```
1. CUSTOMER on {store}.letbuyy.store/products/{slug}
   └── Clicks "Add to Cart" → stored in localStorage (guest) or Supabase (auth'd)

2. CUSTOMER navigates to /cart → reviews items, quantities, applies coupon code

3. CUSTOMER clicks "Checkout"
   └── POST /api/checkout/create-session
       Body: { items: [{product_id, variant, qty}], coupon_code?, shipping_address }

4. CLOUDFLARE WORKER receives request:
   ├── CORS check → ✅ Origin: {store}.letbuyy.store
   ├── Zod validate → ✅ body matches CheckoutSchema
   ├── Verify stock: SELECT inventory_count FROM products WHERE id IN (...)
   │   └── If any item out of stock → return 409 { error: "OUT_OF_STOCK", items: [...] }
   ├── Validate coupon: SELECT * FROM coupons WHERE code = ... AND valid_until > NOW()
   ├── Calculate totals:
   │   ├── subtotal = Σ(price × quantity) for each item
   │   ├── discount = apply coupon rules (percentage/fixed/free_shipping)
   │   ├── shipping = rate from EasyPost API or flat rate from store settings
   │   ├── tax = subtotal × store tax rate (if configured)
   │   └── total = subtotal - discount + shipping + tax
   ├── Detect payment provider:
   │   ├── India (INR) → Razorpay (UPI + cards)
   │   └── Global → Stripe (cards + Apple Pay + Google Pay)
   └── Create payment session:
       ├── Stripe: stripe.checkout.sessions.create({ line_items, success_url, cancel_url })
       └── Razorpay: razorpay.orders.create({ amount, currency: "INR" })

5. RETURN redirect URL → Customer sees payment gateway UI

6. PAYMENT GATEWAY processes payment → sends webhook

7. WEBHOOK WORKER (webhooks.letbuyy.store/stripe):
   ├── Verify signature → HMAC-SHA256
   ├── Idempotency check → Redis SET NX payment:{event_id} (prevent duplicate processing)
   ├── UPDATE orders SET payment_status = 'paid', status = 'confirmed'
   ├── Decrement inventory: UPDATE products SET inventory_count = inventory_count - qty
   ├── INSERT INTO activity_logs (action: "order.paid")
   ├── INSERT INTO notifications (type: "new_order", store_id)
   ├── Send email to customer: "Order Confirmed #1001" (Resend)
   ├── Send email to store owner: "New Order #1001" (Resend)
   ├── Push notification to admin app (FCM)
   └── If inventory < low_stock_threshold → create restock notification

8. SUPABASE REALTIME: INSERT on orders:{store_id} → Admin dashboard shows toast
```

### 10.4 Example: Store Creation + Onboarding

```
1. USER on letbuyy.store clicks "Get Started Free"
   └── Redirects to accounts.letbuyy.store/signup

2. SIGNUP FLOW (accounts app):
   ├── Page 1: Email + Password → POST /api/auth/signup
   │   ├── Supabase Auth: auth.signUp({ email, password })
   │   ├── Sends OTP email (6-digit code, 10min expiry)
   │   └── Return 200 { user_id, needs_verification: true }
   ├── Page 2: Verify OTP → POST /api/auth/verify-otp
   │   └── Supabase Auth: auth.verifyOTP({ email, token, type: "signup" })
   ├── Page 3: Choose Site Type (store/portfolio/resume/blog/landing)
   │   └── Saved to onboarding session state (client-side)
   └── Page 4: Enter Store Name + Subdomain
       └── POST /api/stores/create
           Body: { store_name, subdomain, site_type }

3. CLOUDFLARE WORKER processes store creation:
   ├── JWT auth → ✅ valid user
   ├── Validate subdomain:
   │   ├── Regex: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/
   │   ├── Blocklist check: not in ["www","api","admin","accounts","cdn",...]
   │   └── Uniqueness: SELECT id FROM stores WHERE subdomain = $1
   ├── INSERT INTO stores (user_id, store_name, subdomain, site_type, status: 'draft')
   ├── INSERT INTO ai_credits (store_id, total_credits: 10, plan_credits: 0)
   ├── INSERT INTO onboarding_attempts (user_id, subdomain, site_type, success: true)
   ├── Send welcome email: "Your {site_type} is ready!" (Resend)
   └── Return 201 { store_id, subdomain, redirect_url }

4. REDIRECT to admin.letbuyy.store/{subdomain}/onboarding
   └── Site-type-specific survey (5-8 questions)
       ├── Store: target market, product count, business stage, currency
       ├── Blog: niche, posting frequency, monetization, tone
       ├── Portfolio: profession, experience level, project count
       ├── Resume: target role, industry, experience years
       └── Landing: product/service type, launch date, goal

5. Survey submitted → INSERT INTO store_surveys (store_id, site_type, answers JSONB)
   └── Admin dashboard renders adaptive UI based on site_type

6. Store is now in "draft" status → {subdomain}.letbuyy.store shows "Launching Soon" page
   └── Owner clicks "Publish" → UPDATE stores SET status = 'published', published_at = NOW()
```

---

## 11. Architecture Decisions & Rationale

| Decision | Choice | Why | Alternatives Considered |
|---|---|---|---|
| **Monorepo** | Turborepo + pnpm | Shared packages, parallel builds, remote cache, atomic changes | Nx (heavier), Lerna (deprecated) |
| **Web Framework** | Next.js 15 (App Router) | RSC, streaming SSR, ISR, edge rendering, excellent Vercel DX | Remix (less mature), Astro (not SPA-capable) |
| **Mobile** | Flutter 3.27 | Single codebase for 5 platforms, Impeller engine, Dart null safety | React Native (bridge overhead), Kotlin Multiplatform (less UI) |
| **API Runtime** | Cloudflare Workers | 0ms cold start, 180+ PoPs, V8 Isolates, $5/10M requests | AWS Lambda (cold starts), Vercel Functions (less control) |
| **API Framework** | Hono 4.x | 14KB, TypeScript-native, middleware-rich, Workers-native | Express (not Workers-compatible), Fastify (Node.js only) |
| **API Style** | REST | Simpler caching, better Workers compatibility, Zod validation | GraphQL (overfetch prevention but harder caching) |
| **Database** | Supabase (PostgreSQL 16) | RLS, realtime, auth, storage all-in-one, auto-generated types | PlanetScale (no RLS), Neon (no realtime), Firebase (NoSQL) |
| **Auth** | Supabase Auth | JWT + PKCE + OAuth + OTP + 2FA, integrated with RLS | Auth0 (expensive), Clerk (vendor lock), NextAuth (web-only) |
| **File Storage** | Cloudflare R2 | S3-compatible, zero egress fees, global edge caching | Supabase Storage (egress costs), AWS S3 (expensive egress) |
| **Cache** | Upstash Redis | Serverless, per-request pricing, edge-compatible, global | Cloudflare KV (eventually consistent), DynamoDB (expensive) |
| **AI Strategy** | Multi-provider (Google + Anthropic) | Best model per task, no vendor lock-in, cost optimization | OpenAI-only (expensive, less creative), Single provider |
| **Styling** | Tailwind CSS 4 + shadcn/ui | CSS-first config, tree-shaking, Radix accessibility, customizable | CSS Modules (less utility), Chakra UI (heavier) |
| **Page Builder** | Craft.js | React-native, extensible blocks, serializable JSON state | GrapesJS (heavier), BuilderIO (vendor lock) |
| **Blog Editor** | Tiptap (ProseMirror) | Extensible, collaborative-ready, schema-based, TypeScript | Slate (less stable), Draft.js (deprecated), Quill (limited) |
| **Payments** | Stripe + Razorpay + PayPal | Global coverage, India UPI support, PayPal fallback | Stripe-only (no UPI), Paddle (MoR restrictions) |
| **State (Web)** | Zustand | Lightweight (1KB), TypeScript-native, no boilerplate | Redux (verbose), Jotai (atom-based), Context (re-render issues) |
| **State (Flutter)** | Riverpod 2.x | Code generation, async-first, testable, provider scoping | BLoC (verbose), GetX (controversial), Provider (limited) |

### What Changed from Firebase

| Before (Firebase) | After (Supabase + Cloudflare) | Why |
|---|---|---|
| Firestore (NoSQL) | PostgreSQL 16 (relational) | RLS, joins, JSONB, full-text search, transactions |
| Firebase Auth | Supabase Auth | Integrated with RLS, PKCE flow, OTP |
| Firebase Storage | Cloudflare R2 | Zero egress fees, edge-cached |
| Cloud Functions | Cloudflare Workers | 0ms cold start, global edge, cheaper |
| No AI features | Full AI layer (4 models) | Core platform feature |
| Firebase FCM | Firebase FCM (**kept**) | Best push notification service |

---

## 12. Performance & Edge Strategy

| Area | Strategy | Target |
|---|---|---|
| **Storefront SSR** | ISR + Vercel Edge Network | < 100ms TTFB (p95) |
| **API Response** | Cloudflare Workers (180+ PoPs) | < 200ms (p95) |
| **Database Reads** | PgBouncer connection pooling + Redis cache | < 50ms (p95) |
| **AI Responses** | Streaming (where supported) + model-specific timeouts | < 3s (p95) |
| **Image Delivery** | R2 + Cloudflare Image Transformations (resize, WebP) | < 500ms global |
| **Static Assets** | Cloudflare CDN (auto, from R2 + Vercel) | < 50ms (edge-cached) |
| **Search** | PostgreSQL full-text search (tsvector + GIN indexes) | < 100ms |
| **Rate Limiting** | Upstash Redis sliding window (edge-compatible) | < 5ms overhead |
| **Build Time** | Turborepo remote cache + parallel builds | < 2min CI/CD |

### Core Web Vitals Targets

| Metric | Target | How |
|---|---|---|
| LCP | < 2.5s | ISR, image optimization (WebP, lazy loading, blur placeholder) |
| FID / INP | < 100ms | Code splitting, React Server Components, minimal client JS |
| CLS | < 0.1 | Fixed dimensions on images/embeds, skeleton loading states |

---

## 13. Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Database tables/columns | `snake_case` | `blog_posts`, `created_at` |
| URL paths | `kebab-case` | `/my-store/products` |
| API JSON fields | `camelCase` | `{ "storeId": "...", "siteType": "blog" }` |
| React components | `PascalCase` | `ProductCard.tsx`, `BlogPostEditor.tsx` |
| React hooks | `camelCase` with `use` prefix | `useStore()`, `useAiCredits()` |
| Flutter classes | `PascalCase` | `ProductModel`, `BlogPostScreen` |
| Flutter files | `snake_case` | `product_model.dart`, `blog_post_screen.dart` |
| TS package names | `@letbuyy/kebab-case` | `@letbuyy/ai`, `@letbuyy/db` |
| Dart package names | `snake_case` | `letbuyy_core`, `letbuyy_models` |
| Environment variables | `SCREAMING_SNAKE` | `SUPABASE_URL`, `STRIPE_SECRET_KEY` |
| CSS variables | `--kebab-case` | `--color-primary`, `--radius-lg` |
| Redis keys | `colon:separated` | `ai:store:{id}:daily:{date}` |

---

## 14. Environment Variables

### 14.1 Shared Across Apps

| Variable | Example | Used By |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxx.supabase.co` | All Next.js apps |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` | All Next.js apps |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (server-only) | API Worker, Edge Functions |

### 14.2 API Worker (Cloudflare)

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Database connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Elevated DB access (bypasses RLS when needed) |
| `UPSTASH_REDIS_URL` | Redis connection |
| `UPSTASH_REDIS_TOKEN` | Redis auth |
| `GOOGLE_AI_API_KEY` | Gemini 3 Flash + Pro |
| `ANTHROPIC_API_KEY` | Claude Sonnet 4.5 + Opus 4.6 |
| `STRIPE_SECRET_KEY` | Payment processing |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `RAZORPAY_KEY_ID` | India payments |
| `RAZORPAY_KEY_SECRET` | India payments |
| `RESEND_API_KEY` | Email sending |
| `R2_ACCOUNT_ID` | File storage |
| `R2_ACCESS_KEY_ID` | R2 authentication |
| `R2_SECRET_ACCESS_KEY` | R2 authentication |

### 14.3 Flutter Apps

| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | API endpoint |
| `SUPABASE_ANON_KEY` | Client auth |
| `API_BASE_URL` | `https://api.letbuyy.store` |

---

> **Next:** [02 Authentication & Security](./02_Authentication_and_Security.md) — Auth flows, Supabase Auth, RLS, 2FA, VPN

---

## 15. Security Architecture

### 15.1 13-Layer Security Model

```
┌──────────────────────────────────────────────────────────────────────┐
│ LAYER 1: DNS & Edge (Cloudflare)                                     │
│   • DDoS protection (Cloudflare Shield)                              │
│   • WAF rules (SQL injection, XSS patterns blocked at edge)         │
│   • SSL/TLS 1.3 (full strict mode, HSTS 1yr, preloaded)            │
│   • Geo-blocking (optional per store, configured in settings)       │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 2: Bot Detection (Cloudflare Turnstile)                        │
│   • Invisible challenge on login/signup/checkout forms              │
│   • No GDPR consent needed (unlike reCAPTCHA)                       │
│   • Server-side validation: POST siteverify.turnstile.cloudflare.com│
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 3: Rate Limiting (Upstash Redis Sliding Window)                │
│   • Per-store, per-endpoint limits (see Section 6.2)                │
│   • Token bucket algorithm: rate:{store_id}:{endpoint}              │
│   • 429 response with Retry-After header                            │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 4: CORS Policy (Hono Middleware)                               │
│   • Strict origin allowlist per app:                                │
│     - admin.letbuyy.store, accounts.letbuyy.store                   │
│     - *.letbuyy.store (storefront wildcard)                         │
│   • Methods: GET, POST, PUT, PATCH, DELETE                          │
│   • Credentials: true (for cookies)                                 │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 5: CSRF Protection                                             │
│   • SameSite=Lax cookies (prevents cross-origin cookie sending)     │
│   • Origin header validation on state-changing requests             │
│   • Double-submit token pattern for forms                           │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 6: Authentication (Supabase Auth + JWT)                        │
│   • PKCE flow for OAuth (no client_secret in browser)               │
│   • 1h access token, 7d refresh token (HttpOnly cookies)            │
│   • Auto-refresh via @supabase/ssr middleware                       │
│   • 2FA/TOTP for sensitive operations                               │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 7: Authorization (RBAC + RLS)                                  │
│   • Role check middleware: user → admin → employee → super_admin    │
│   • Permission-based access (team_members.permissions JSONB)        │
│   • RLS enforced at database level (see Section 4.6)                │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 8: Input Validation (Zod Schemas)                              │
│   • Every request body validated by Zod schema before handler       │
│   • Type-safe parsing: c.req.valid("json")                          │
│   • Rejects malformed/unexpected fields with 400 + details          │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 9: Content Sanitization                                        │
│   • Blog content: DOMPurify (strip malicious HTML/JS)               │
│   • User inputs: HTML entity encoding                               │
│   • File uploads: type + size validation, no executable types       │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 10: Database Security (Supabase RLS)                           │
│   • 5 RLS policy patterns (see Section 4.6)                        │
│   • No direct table access without policy match                     │
│   • service_role_key used ONLY in Workers (never client-side)       │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 11: Secret Management                                         │
│   • Cloudflare Worker secrets (encrypted at rest)                   │
│   • Vercel environment variables (encrypted, per-environment)       │
│   • NEXT_PUBLIC_ prefix only for non-sensitive values               │
│   • No secrets in Git (enforced by .gitignore + pre-commit hook)    │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 12: Audit & Monitoring                                         │
│   • activity_logs table: every mutation logged with user_id + IP    │
│   • Sentry: real-time error alerts with stack traces + breadcrumbs  │
│   • Logflare: structured JSON logs for forensic analysis            │
├──────────────────────────────────────────────────────────────────────┤
│ LAYER 13: Console Protection (Super Admin Only)                      │
│   • VPN requirement (Cloudflare Access or WireGuard)                │
│   • IP allowlisting (office/team IPs only)                          │
│   • Mandatory 2FA (TOTP or hardware key)                            │
│   • Session timeout: 30 minutes of inactivity                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 15.2 Request Security Chain

Every API request passes through this security chain **in order**. Failure at any layer returns immediately — no downstream processing occurs.

```
REQUEST → [Cloudflare WAF] → [Turnstile?] → [Rate Limit] → [CORS] → [CSRF?]
  → [JWT Auth] → [Role Check] → [Permission Check?] → [Zod Validate]
  → [Sanitize] → [RLS Query] → RESPONSE

Failure at any stage:
  Layer 1-3: 403/429 (never reaches Worker)
  Layer 4-5: 403 CORS/CSRF error
  Layer 6:   401 Unauthorized
  Layer 7:   403 Forbidden (insufficient role)
  Layer 8:   400 Validation Error (with Zod issues)
  Layer 9:   400 Content Rejected
  Layer 10:  RLS silently returns empty set (no data leak)
```

### 15.3 Attack Mitigation Summary

| Attack Vector | Mitigation | Layer |
|---|---|---|
| DDoS | Cloudflare Shield + rate limiting | 1, 3 |
| Bot/Credential Stuffing | Turnstile + account lockout (5 attempts → 15min) | 2, 6 |
| SQL Injection | Parameterized queries (Supabase client), WAF rules | 1, 10 |
| XSS | DOMPurify (blog content), CSP headers, React auto-escaping | 1, 9 |
| CSRF | SameSite cookies, Origin validation, double-submit tokens | 5 |
| Session Hijacking | HttpOnly + Secure cookies, short-lived JWTs, IP binding | 6 |
| Privilege Escalation | RLS at DB level (not app level), JWT role claims | 7, 10 |
| Data Exfiltration | RLS ensures queries only return owned data, no `SELECT *` | 10 |
| File Upload Attacks | Type allowlist, size limits, no executables, presigned URLs | 9 |
| Webhook Spoofing | HMAC-SHA256 signature verification on every webhook | Worker |

---

## 16. Onboarding Architecture

### 16.1 State Machine

```
┌─────────┐   signup    ┌────────────┐  verify OTP  ┌────────────┐
│  ANON   │ ──────────→ │  CREATED   │ ───────────→ │  VERIFIED  │
│ (guest) │             │ (user_id)  │              │ (can auth) │
└─────────┘             └────────────┘              └─────┬──────┘
                                                          │ choose site type
                                                    ┌─────▼──────┐
                                                    │  CHOOSING   │
                                                    │ (site_type) │
                                                    └─────┬──────┘
                                                          │ create store
                                                    ┌─────▼──────┐
                                                    │  CREATED    │
                                                    │ (store_id)  │
                                                    │ (subdomain) │
                                                    └─────┬──────┘
                                                          │ redirect to admin
                                                    ┌─────▼──────┐
                                                    │  SURVEYING  │
                                                    │ (onboarding │
                                                    │  questions) │
                                                    └─────┬──────┘
                                                          │ submit survey
                                                    ┌─────▼──────┐
                                                    │  DRAFTED    │
                                                    │ (status:    │
                                                    │  "draft")   │
                                                    └─────┬──────┘
                                                          │ click "Publish"
                                                    ┌─────▼──────┐
                                                    │  PUBLISHED  │
                                                    │ (status:    │
                                                    │  "published")│
                                                    └─────────────┘
```

### 16.2 Database Operations at Each Step

| Step | Table(s) Modified | Key Operation |
|---|---|---|
| 1. Signup | `auth.users` | `auth.signUp()` — creates user record |
| 2. Verify OTP | `auth.users` | `auth.verifyOTP()` — sets email_confirmed_at |
| 3. Choose Site Type | (client state) | Stored in React state (Zustand), not persisted yet |
| 4. Create Store | `stores`, `ai_credits`, `onboarding_attempts` | INSERT into 3 tables in transaction |
| 5. Onboarding Survey | `store_surveys` | INSERT answers as JSONB |
| 6. First Content | Type-specific table (products/posts/projects/etc.) | INSERT first item |
| 7. Publish | `stores` | UPDATE status → `published`, set `published_at` |

### 16.3 Email Triggers During Onboarding

| Trigger | Email Template | Timing | Via |
|---|---|---|---|
| Signup | `welcome-otp` | Immediate | Supabase Auth |
| OTP Verified | `email-verified` | Immediate | Resend |
| Store Created | `store-created` | Immediate | Resend |
| Survey Complete | `onboarding-complete` | Immediate | Resend |
| Day 3 (no publish) | `reminder-publish` | Cron (scheduled) | Resend |
| Day 10 (trial) | `trial-ending-soon` | Cron (scheduled) | Resend |
| Day 13 (trial) | `trial-last-day` | Cron (scheduled) | Resend |
| Day 14 (trial expired) | `trial-expired` | Cron (scheduled) | Resend |

### 16.4 Subdomain Validation Rules

```typescript
// Validation performed during store creation
const SUBDOMAIN_RULES = {
  regex: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/,  // 3-64 chars, lowercase alphanumeric + hyphens
  minLength: 3,
  maxLength: 64,
  
  // Reserved subdomains that cannot be claimed
  blocklist: [
    "www", "api", "admin", "accounts", "console", "team",
    "cdn", "mail", "smtp", "ftp", "ssh", "git", "dev",
    "staging", "test", "demo", "support", "help", "docs",
    "blog", "shop", "store", "app", "dashboard", "billing",
    "status", "webhooks", "internal", "static", "assets",
  ],
  
  // Check database for existing subdomain
  async isAvailable(subdomain: string): Promise<boolean> {
    const { count } = await supabase
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("subdomain", subdomain);
    return count === 0;
  },
};
```

---

## 17. Adaptive UI Engine Architecture

### 17.1 Site-Type Detection Flow

The admin dashboard, sidebar navigation, and available features all adapt based on the store's `site_type`. This is resolved at the route level, not at the component level.

```
1. User navigates to admin.letbuyy.store/{subdomain}/dashboard

2. Next.js middleware:
   ├── Extract subdomain from URL params
   ├── Fetch store: SELECT site_type, status FROM stores WHERE subdomain = $1
   ├── Verify ownership: user_id = JWT user_id OR team_members match
   └── Inject into React context: { store_id, site_type, status, permissions }

3. Layout component reads site_type from context:
   ├── Renders appropriate sidebar navigation (Section 17.2)
   ├── Shows/hides feature-specific routes
   └── Applies feature-specific dashboard widgets (Section 17.3)
```

### 17.2 Admin Sidebar Configuration

```typescript
// Dynamic sidebar configuration per site type
const SIDEBAR_CONFIG: Record<SiteType, SidebarItem[]> = {
  store: [
    { icon: "LayoutDashboard", label: "Dashboard",  href: "/dashboard" },
    { icon: "Package",         label: "Products",   href: "/products" },
    { icon: "ClipboardList",   label: "Orders",     href: "/orders" },
    { icon: "BarChart3",       label: "Inventory",  href: "/inventory" },  // store-only
    { icon: "Ticket",          label: "Coupons",    href: "/coupons" },    // store-only
    { icon: "Truck",           label: "Shipping",   href: "/shipping" },   // store-only
    { icon: "Users",           label: "Customers",  href: "/customers" },  // store-only
    "---separator---",
    { icon: "Globe",           label: "Pages",      href: "/pages" },
    { icon: "Bot",             label: "AI Studio",  href: "/ai-studio" },
    { icon: "TrendingUp",      label: "Analytics",  href: "/analytics" },
    { icon: "Settings",        label: "Settings",   href: "/settings" },
  ],
  blog: [
    { icon: "LayoutDashboard", label: "Dashboard",    href: "/dashboard" },
    { icon: "PenTool",         label: "Posts",         href: "/posts" },       // blog-only
    { icon: "FolderTree",      label: "Categories",    href: "/categories" },  // blog-only
    { icon: "Tags",            label: "Tags",          href: "/tags" },         // blog-only
    { icon: "MessageCircle",   label: "Comments",      href: "/comments" },    // blog-only
    { icon: "Image",           label: "Media Library", href: "/media" },       // blog-only
    { icon: "Mail",            label: "Subscribers",   href: "/subscribers" }, // blog-only
    "---separator---",
    { icon: "Globe",           label: "Pages",      href: "/pages" },
    { icon: "Bot",             label: "AI Studio",  href: "/ai-studio" },
    { icon: "TrendingUp",      label: "Analytics",  href: "/analytics" },
    { icon: "Settings",        label: "Settings",   href: "/settings" },
  ],
  portfolio: [
    { icon: "LayoutDashboard", label: "Dashboard",    href: "/dashboard" },
    { icon: "Briefcase",       label: "Projects",     href: "/projects" },     // portfolio-only
    { icon: "Image",           label: "Gallery",      href: "/gallery" },      // portfolio-only
    { icon: "Award",           label: "Skills",       href: "/skills" },       // portfolio + resume
    { icon: "GraduationCap",   label: "Education",    href: "/education" },    // portfolio + resume
    { icon: "MessageSquare",   label: "Testimonials", href: "/testimonials" }, // portfolio-only
    { icon: "Mail",            label: "Contact Form", href: "/contact" },      // portfolio-only
    "---separator---",
    { icon: "Globe",           label: "Pages",      href: "/pages" },
    { icon: "Bot",             label: "AI Studio",  href: "/ai-studio" },
    { icon: "TrendingUp",      label: "Analytics",  href: "/analytics" },
    { icon: "Settings",        label: "Settings",   href: "/settings" },
  ],
  resume: [
    { icon: "LayoutDashboard", label: "Dashboard",      href: "/dashboard" },
    { icon: "Briefcase",       label: "Experience",     href: "/experience" },     // resume-only
    { icon: "Target",          label: "Skills",         href: "/skills" },
    { icon: "GraduationCap",   label: "Education",      href: "/education" },
    { icon: "Award",           label: "Certifications", href: "/certifications" }, // resume-only
    { icon: "FileText",        label: "PDF Export",     href: "/export" },          // resume-only
    { icon: "Bot",             label: "ATS Score",      href: "/ats-score" },       // resume-only
    "---separator---",
    { icon: "Bot",             label: "AI Studio",  href: "/ai-studio" },
    { icon: "TrendingUp",      label: "Analytics",  href: "/analytics" },
    { icon: "Settings",        label: "Settings",   href: "/settings" },
  ],
  landing: [
    { icon: "LayoutDashboard", label: "Dashboard",   href: "/dashboard" },
    { icon: "Layers",          label: "Sections",    href: "/sections" },     // landing-only (Craft.js)
    { icon: "FileInput",       label: "Forms",       href: "/forms" },        // landing-only
    { icon: "Target",          label: "CTA Builder", href: "/cta" },          // landing-only
    { icon: "FlaskConical",    label: "A/B Tests",   href: "/ab-tests" },     // landing-only
    "---separator---",
    { icon: "Globe",           label: "Pages",      href: "/pages" },
    { icon: "Bot",             label: "AI Studio",  href: "/ai-studio" },
    { icon: "TrendingUp",      label: "Analytics",  href: "/analytics" },
    { icon: "Settings",        label: "Settings",   href: "/settings" },
  ],
};
```

### 17.3 Dashboard Widget Mapping

| Widget | Store | Blog | Portfolio | Resume | Landing |
|---|:---:|:---:|:---:|:---:|:---:|
| Revenue Chart | ✅ | ❌ | ❌ | ❌ | ❌ |
| Order Count | ✅ | ❌ | ❌ | ❌ | ❌ |
| Low Stock Alerts | ✅ | ❌ | ❌ | ❌ | ❌ |
| Recent Posts | ❌ | ✅ | ❌ | ❌ | ❌ |
| Comment Queue | ❌ | ✅ | ❌ | ❌ | ❌ |
| Subscriber Growth | ❌ | ✅ | ❌ | ❌ | ✅ |
| Project Views | ❌ | ❌ | ✅ | ❌ | ❌ |
| ATS Score | ❌ | ❌ | ❌ | ✅ | ❌ |
| Conversion Rate | ❌ | ❌ | ❌ | ❌ | ✅ |
| A/B Test Results | ❌ | ❌ | ❌ | ❌ | ✅ |
| Page Views (7d) | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Credits Used | ✅ | ✅ | ✅ | ✅ | ✅ |
| Recent Activity | ✅ | ✅ | ✅ | ✅ | ✅ |

### 17.4 Storefront Layout Routing

The public-facing storefront (`{subdomain}.letbuyy.store`) renders completely different layouts based on the store's `site_type`:

```typescript
// apps/web/storefront/src/app/[subdomain]/layout.tsx
export default async function StorefrontLayout({ params }) {
  const store = await getStoreBySubdomain(params.subdomain);
  
  switch (store.site_type) {
    case "store":
      return <EcommerceLayout store={store} />;     // Product grid, cart, checkout
    case "blog":
      return <BlogLayout store={store} />;          // Post feed, categories, sidebar
    case "portfolio":
      return <PortfolioLayout store={store} />;     // Project gallery, about, contact
    case "resume":
      return <ResumeLayout store={store} />;        // Single-page resume, printable
    case "landing":
      return <LandingLayout store={store} />;       // Craft.js rendered sections
    default:
      return <LaunchingSoonPage store={store} />;   // Draft stores
  }
}
```

---

## 18. Notification & Event Bus Architecture

### 18.1 Multi-Channel Notification System

```
┌──────────────────────────────────────────────────────────────────┐
│                         EVENT BUS                                 │
│                                                                   │
│  Triggers: Order events, Comment events, AI events, System events │
│  Source: API Worker handlers, Webhook Worker, Cron jobs            │
└──────────┬──────────┬──────────┬──────────┬──────────────────────┘
           │          │          │          │
           ▼          ▼          ▼          ▼
     ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
     │  EMAIL   │ │   PUSH   │ │  IN-APP  │ │   WEBHOOK    │
     │ (Resend) │ │  (FCM)   │ │ (Supabase│ │  (outgoing)  │
     │          │ │          │ │ Realtime)│ │              │
     └──────────┘ └──────────┘ └──────────┘ └──────────────┘
```

### 18.2 Event Types & Routing

| Event | Email | Push (FCM) | In-App | Webhook (outgoing) |
|---|:---:|:---:|:---:|:---:|
| `order.created` | ✅ (customer + owner) | ✅ (owner) | ✅ | ✅ |
| `order.paid` | ✅ (customer) | ✅ (owner) | ✅ | ✅ |
| `order.shipped` | ✅ (customer) | ✅ (customer, if app) | ✅ | ✅ |
| `order.cancelled` | ✅ (customer + owner) | ✅ (owner) | ✅ | ✅ |
| `comment.new` | ✅ (post author) | ✅ (author) | ✅ | ❌ |
| `comment.reply` | ✅ (parent commenter) | ❌ | ✅ | ❌ |
| `low_stock` | ✅ (owner) | ✅ (owner) | ✅ | ✅ |
| `ai.credits_low` | ✅ (owner, at 10%) | ❌ | ✅ | ❌ |
| `trial.ending_soon` | ✅ (owner) | ✅ (owner) | ✅ | ❌ |
| `trial.expired` | ✅ (owner) | ✅ (owner) | ✅ | ❌ |
| `team.invited` | ✅ (invitee) | ❌ | ❌ | ❌ |
| `store.published` | ✅ (owner, celebration) | ❌ | ✅ | ❌ |
| `subscriber.new` | ❌ | ❌ | ✅ | ✅ |

### 18.3 Notification Processing Flow

```typescript
// Notification dispatcher — called from Worker handlers
async function dispatchNotification(event: NotificationEvent) {
  const { type, store_id, user_id, data } = event;
  const routing = NOTIFICATION_ROUTING[type];
  
  // 1. Always create in-app notification (Supabase Realtime)
  if (routing.inApp) {
    await supabase.from("notifications").insert({
      user_id, store_id, type,
      title: routing.title(data),
      body: routing.body(data),
      action_url: routing.actionUrl(data),
      read: false,
    });
    // → Supabase Realtime broadcasts to notifications:{user_id} channel
  }
  
  // 2. Send email if configured (async, non-blocking)
  if (routing.email) {
    await resend.emails.send({
      from: "LetBuyy <notifications@letbuyy.store>",
      to: routing.emailRecipient(data),
      subject: routing.emailSubject(data),
      react: routing.emailTemplate(data),  // React Email component
    });
  }
  
  // 3. Send push notification via FCM
  if (routing.push) {
    await admin.messaging().send({
      token: await getUserFCMToken(user_id),
      notification: {
        title: routing.pushTitle(data),
        body: routing.pushBody(data),
      },
      data: { action_url: routing.actionUrl(data), type },
    });
  }
  
  // 4. Fire outgoing webhook (if store has webhook configured)
  if (routing.webhook) {
    const webhookUrl = await getStoreWebhookUrl(store_id);
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Webhook-Signature": generateHMAC(data, store.webhook_secret),
        },
        body: JSON.stringify({ event: type, data, timestamp: Date.now() }),
      });
    }
  }
}
```

### 18.4 Email Templates (React Email)

| Template | Trigger | Key Data |
|---|---|---|
| `welcome-otp` | Signup | OTP code, expiry time |
| `email-verified` | OTP success | Dashboard link |
| `store-created` | Store creation | Store name, subdomain URL |
| `onboarding-complete` | Survey done | Feature checklist, tips |
| `order-confirmation` | Payment success | Order #, items, total, tracking |
| `order-shipped` | Status → shipped | Tracking number, tracking URL |
| `trial-ending-soon` | Day 10 | Days remaining, upgrade CTA |
| `trial-expired` | Day 14 | Grace period info, pricing link |
| `team-invite` | Team member added | Accept link, role description |
| `low-stock-alert` | Inventory < threshold | Product name, current stock, reorder link |
| `ai-credits-low` | Credits at 10% | Remaining credits, top-up link |

---

## 19. Subscription & Trial Lifecycle

### 19.1 State Machine

```
                    ┌─────────────────────────────────────────────────┐
                    │               SUBSCRIPTION LIFECYCLE             │
                    └─────────────────────────────────────────────────┘

    ┌──────────┐  14 days  ┌──────────┐  3 days   ┌──────────┐  7 days   ┌──────────┐
    │  TRIAL   │ ────────→ │  GRACE   │ ────────→ │  FROZEN  │ ────────→ │  PURGE   │
    │ (active) │           │ (warning)│           │ (locked) │           │ (deleted)│
    └────┬─────┘           └────┬─────┘           └────┬─────┘           └──────────┘
         │                      │                      │
         │ user subscribes      │ user subscribes      │ user subscribes
         ▼                      ▼                      ▼
    ┌──────────┐           ┌──────────┐           ┌──────────┐
    │  ACTIVE  │           │  ACTIVE  │           │  ACTIVE  │
    │  (paid)  │           │  (paid)  │           │  (paid,  │
    │          │           │          │           │ restored)│
    └──────────┘           └──────────┘           └──────────┘

    ACTIVE (paid) has its own lifecycle:
    ┌──────────┐  payment fails  ┌──────────┐  3 retries  ┌──────────┐
    │  ACTIVE  │ ──────────────→ │ PAST DUE │ ──────────→ │  FROZEN  │
    │  (paid)  │                 │ (3 days) │             │ (locked) │
    └──────────┘                 └────┬─────┘             └──────────┘
                                      │ payment succeeds
                                      ▼
                                 ┌──────────┐
                                 │  ACTIVE  │
                                 │  (paid)  │
                                 └──────────┘
```

### 19.2 Automated Email Sequence (Trial)

| Day | Email | Subject | CTA |
|---|---|---|---|
| 0 | `welcome` | "Welcome to LetBuyy! Your 14-day trial starts now" | Explore Dashboard |
| 3 | `getting-started` | "3 days in — here's what you can do next" | Complete Setup |
| 7 | `mid-trial` | "Halfway through your trial — see what you've built" | View Analytics |
| 10 | `trial-ending` | "4 days left on your trial" | Upgrade Now (10% discount) |
| 13 | `trial-last-day` | "Your trial ends tomorrow" | Subscribe to Keep Your Store |
| 14 | `trial-expired` | "Your trial has ended" | Reactivate Now |
| 17 | `grace-ending` | "Your store will be frozen in 24 hours" | Subscribe to Prevent Freeze |
| 21 | `frozen` | "Your store has been frozen" | Reactivate Your Store |
| 28 | `purge-warning` | "Your data will be deleted in 7 days" | Save Your Data |
| 35 | `purged` | "Your store data has been deleted" | Start Fresh |

### 19.3 Plan Features & Limits

```typescript
// Subscription plan enforcement (checked in middleware)
const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  free: {
    stores: 1, products: 25, blog_posts: 10, ai_credits: 10,
    storage_mb: 500, team_members: 0, custom_domain: false,
    analytics_days: 7, newsletter_subscribers: 0,
    content_versions: 0, api_access: false, remove_branding: false,
  },
  starter: {
    stores: 3, products: 500, blog_posts: 100, ai_credits: 50,
    storage_mb: 5120, team_members: 2, custom_domain: true,
    analytics_days: 30, newsletter_subscribers: 100,
    content_versions: 5, api_access: false, remove_branding: false,
  },
  business: {
    stores: 10, products: Infinity, blog_posts: Infinity, ai_credits: 200,
    storage_mb: 51200, team_members: 10, custom_domain: true,
    analytics_days: 365, newsletter_subscribers: 5000,
    content_versions: Infinity, api_access: true, remove_branding: true,
  },
  enterprise: {
    stores: Infinity, products: Infinity, blog_posts: Infinity, ai_credits: 1000,
    storage_mb: 512000, team_members: Infinity, custom_domain: true,
    analytics_days: Infinity, newsletter_subscribers: Infinity,
    content_versions: Infinity, api_access: true, remove_branding: true,
  },
};
```

### 19.4 Payment Gateway Integration Flow

```
1. User clicks "Upgrade to Starter" in admin.letbuyy.store/{store}/settings/billing

2. POST /api/billing/create-subscription
   Body: { plan_id: "starter", period: "monthly" | "annual" }

3. WORKER:
   ├── Detect region from request headers:
   │   ├── India → Razorpay subscription
   │   └── Global → Stripe subscription
   ├── Create subscription:
   │   ├── Stripe: stripe.subscriptions.create({ customer, price, trial_end })
   │   └── Razorpay: razorpay.subscriptions.create({ plan_id, total_count })
   └── Return { checkout_url, subscription_id }

4. User completes payment → Webhook fires:
   ├── UPDATE stores SET plan_id = (SELECT id FROM plans WHERE slug = 'starter')
   ├── UPDATE ai_credits SET plan_credits = 50, total_credits = 50
   ├── Remove trial limitations
   └── Send "Subscription Active" email

5. Monthly renewal (automatic):
   ├── Payment succeeds → no action needed (already active)
   ├── Payment fails → status → 'past_due', retry 3 times over 3 days
   └── All retries fail → status → 'frozen'
```

---

## 20. Observability & Error Handling

### 20.1 Monitoring Stack

```
┌──────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY STACK                            │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐  │
│  │  SENTRY   │   │ LOGFLARE  │   │  UPSTASH  │   │  VERCEL   │  │
│  │           │   │           │   │  REDIS    │   │  ANALYTICS│  │
│  │ Errors +  │   │ Structured│   │ AI usage  │   │ Core Web  │  │
│  │ Performanc│   │ JSON logs │   │ + rate    │   │ Vitals +  │  │
│  │ e tracing │   │  → BigQuer│   │ limit     │   │ Visitor   │  │
│  │           │   │ y export  │   │ counters  │   │ analytics │  │
│  └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘  │
│        │               │               │               │         │
│        └───────────────┴───────┬───────┴───────────────┘         │
│                                │                                  │
│                    ┌───────────▼──────────┐                       │
│                    │   ALERTING           │                       │
│                    │   • Sentry → Slack   │                       │
│                    │   • Logflare → email │                       │
│                    │   • Upstash → webhook│                       │
│                    └─────────────────────┘                       │
└──────────────────────────────────────────────────────────────────┘
```

### 20.2 Error Handling Patterns

**Next.js (Client-Side):**
```typescript
// Global error boundary — catches React rendering errors
// apps/web/admin/src/app/error.tsx
"use client";
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: "admin", page: window.location.pathname },
      extra: { store_id: useStoreId() },
    });
  }, [error]);
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <h2>Something went wrong</h2>
      <p className="text-muted-foreground">{error.message}</p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
```

**Cloudflare Worker (API-Side):**
```typescript
// Global error handler in Hono — catches all unhandled errors
app.onError((err, c) => {
  const errorId = crypto.randomUUID();
  
  // Log to Sentry with full context
  Sentry.captureException(err, {
    tags: { worker: "api", route: c.req.path, method: c.req.method },
    extra: {
      error_id: errorId,
      store_id: c.get("store_id"),
      user_id: c.get("user_id"),
      request_body: await c.req.text().catch(() => "[unreadable]"),
    },
  });
  
  // Log structured JSON to Logflare
  console.log(JSON.stringify({
    level: "error",
    error_id: errorId,
    message: err.message,
    stack: err.stack,
    path: c.req.path,
    method: c.req.method,
    timestamp: new Date().toISOString(),
  }));
  
  // Return safe error response (no stack traces in production)
  return c.json({
    error: "INTERNAL_SERVER_ERROR",
    error_id: errorId,  // for support tickets
    message: process.env.NODE_ENV === "development" ? err.message : "An unexpected error occurred",
  }, 500);
});
```

### 20.3 Health Check Endpoints

| Endpoint | Checks | Expected Response |
|---|---|---|
| `GET /api/health` | Worker is alive | `200 { status: "ok", uptime, version }` |
| `GET /api/health/db` | Supabase connection + simple query | `200 { status: "ok", latency_ms }` |
| `GET /api/health/redis` | Upstash Redis PING | `200 { status: "ok", latency_ms }` |
| `GET /api/health/ai` | Gemini + Claude API reachability | `200 { gemini: "ok", claude: "ok" }` |

### 20.4 Alert Thresholds

| Metric | Warning | Critical | Action |
|---|---|---|---|
| API error rate | > 1% (5min window) | > 5% (5min window) | Slack alert → on-call |
| API latency (p95) | > 500ms | > 2s | Investigate hot endpoints |
| Worker CPU time | > 30ms avg | > 50ms avg | Optimize handler or split Worker |
| Database connections | > 150/200 | > 180/200 | Scale PgBouncer pool |
| Redis memory | > 70% | > 90% | Reduce TTLs or scale plan |
| AI fallback rate | > 10% | > 30% | Check primary provider status |
| Sentry errors/hour | > 50 | > 200 | Triage new error clusters |
| Disk (R2) usage | > 70% quota | > 90% quota | Alert store owners, plan upgrade |

### 20.5 Structured Logging Format

Every log entry from the API Worker follows this JSON schema for consistent parsing and querying in Logflare/BigQuery:

```json
{
  "level": "info | warn | error",
  "timestamp": "2026-02-14T14:00:00.000Z",
  "request_id": "uuid",
  "method": "POST",
  "path": "/api/products",
  "status": 201,
  "latency_ms": 45,
  "store_id": "uuid",
  "user_id": "uuid",
  "ip": "203.0.113.42",
  "user_agent": "Mozilla/5.0...",
  "cf_ray": "abc123",
  "cf_colo": "BOM",
  "error_id": "uuid (only on errors)",
  "message": "Product created successfully"
}
```

---

> **→ Full doc series:** 00_Overview → **01_Architecture** → 02_Auth → 03_Onboarding → 04_Admin → 05_Storefront → 06_Team → 07_AI → 08_Payments → 09_Analytics → 10_Deployment → 11_Testing → 12_Scaling
