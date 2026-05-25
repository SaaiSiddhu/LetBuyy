# LetBuyy Platform — Complete Reference

> **Single source of truth.** Consolidated from 40+ documentation files on 2026-03-01.
>
> **Version:** 6.0 | **Last Updated:** March 1, 2026

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Site Types](#2-site-types)
3. [Applications & Domains](#3-applications--domains)
4. [Authentication Architecture](#4-authentication-architecture)
5. [Database Schema](#5-database-schema)
6. [Onboarding & Trial](#6-onboarding--trial)
7. [Admin Dashboard](#7-admin-dashboard)
8. [E-Commerce Engine](#8-e-commerce-engine)
9. [Portfolio & Resume Builder](#9-portfolio--resume-builder)
10. [Blog Engine](#10-blog-engine)
11. [Landing Page Builder](#11-landing-page-builder)
12. [Storefront Rendering](#12-storefront-rendering)
13. [Theme System](#13-theme-system)
14. [App Store & Extensions](#14-app-store--extensions)
15. [Notification System](#15-notification-system)
16. [AI Features](#16-ai-features)
17. [Analytics & Reporting](#17-analytics--reporting)
18. [Payment System](#18-payment-system)
19. [Super Admin Console](#19-super-admin-console)
20. [Employee Portal](#20-employee-portal)
21. [Security Architecture](#21-security-architecture)
22. [API Reference](#22-api-reference)
23. [Infrastructure & Deployment](#23-infrastructure--deployment)
24. [Pricing & Plans](#24-pricing--plans)
25. [Build Status & Gaps](#25-build-status--gaps)
26. [Environment Variables](#26-environment-variables)

---

## 1. Platform Overview

### 1.1 What Is LetBuyy

LetBuyy is a multi-tenant SaaS platform enabling users to build and manage e-commerce stores, professional portfolios, resumes, blogs, and landing pages — all from a single account. Think Shopify + WordPress + About.me combined.

### 1.2 Business Model

**Freemium SaaS:** Free tier with limited features → Starter ($9/mo) → Business ($29/mo) → Enterprise ($79/mo). Additional revenue from theme/app marketplace commissions.

**Target Market:** India-first, then global. Small/medium merchants, freelancers, job seekers, content creators, marketers.

### 1.3 Key Capabilities

| Capability | Description | Status |
|-----------|-------------|--------|
| Multi-Site Architecture | 5 site types with adaptive UI per type | ✅ Built |
| Full E-Commerce | Products, variants, cart, checkout, orders, inventory | 🔶 60% |
| Portfolio Builder | Projects, skills, gallery, testimonials, contact | 🔶 40% |
| Resume Builder | Experience, education, skills, certifications, PDF export | 🔶 30% |
| Blog Engine | Posts, categories, media embeds, scheduling | 🔶 50% |
| Landing Page Builder | Sections, forms, analytics | 🔶 40% |
| Admin Dashboard | Per-store CMS with adaptive sidebar per site type | ✅ 80% |
| Theme System | 30+ templates, live preview, marketplace | 🔶 40% |
| App Store | Extension marketplace with developer API | ❌ 10% |
| Super Admin Console | Platform-wide management | ❌ Scaffold |
| Employee Portal | Support, moderation, operations | ❌ Scaffold |
| Multi-Gateway Payments | Razorpay, Stripe, PayPal | 🔶 30% |
| AI Features | Product descriptions, content generation | ❌ Not Started |
| Mobile Builder (Flutter) | Native store management app | 🔶 35% |

### 1.4 Domain Architecture

```
letbuyy.store               → Marketing site + signup CTA (NO auth pages)
accounts.letbuyy.store      → ALL authentication (login, signup, OTP, password, OAuth)
admin.letbuyy.store/{store} → Per-store CMS dashboard
*.letbuyy.store             → Published storefronts (wildcard DNS)
apps.letbuyy.store          → Extension marketplace
themes.letbuyy.store        → Theme marketplace
console.letbuyy.store       → Super Admin (VPN + 2FA)
team.letbuyy.store          → Employee Portal
api.letbuyy.store           → REST API (Cloudflare Worker)
```

---

## 2. Site Types

### 2.1 Type Definitions

Users choose their site type during onboarding. Each type determines: admin sidebar navigation, dashboard widgets, available features, storefront template, and onboarding survey questions.

| Type | ID | Primary Use | Key Features |
|------|----|-------------|-------------|
| E-Commerce Store | `store` | Sell products | Products, variants, inventory, cart, checkout, orders, shipping, coupons |
| Portfolio | `portfolio` | Showcase work | Projects, skills, gallery, testimonials, contact form |
| Resume | `resume` | Professional CV | Experience, education, skills, certifications, PDF export, ATS score |
| Blog | `blog` | Publish content | Posts, categories, comments, scheduling, SEO |
| Landing Page | `landing_page` | Marketing | Sections, forms, CTA, analytics |

### 2.2 Feature Matrix by Site Type

| Feature | Store | Portfolio | Resume | Blog | Landing |
|---------|-------|-----------|--------|------|---------|
| Product management | ✅ | — | — | — | — |
| Cart & checkout | ✅ | — | — | — | — |
| Shipping config | ✅ | — | — | — | — |
| Coupons & discounts | ✅ | — | — | — | — |
| Project showcase | — | ✅ | — | — | — |
| Skills visualization | — | ✅ | ✅ | — | — |
| PDF export | — | — | ✅ | — | — |
| Blog posts | — | ✅ (optional) | — | ✅ | — |
| Contact form | — | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Studio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Theme customization | ✅ | ✅ | ✅ | ✅ | ✅ |
| Custom domain | ✅ | ✅ | ✅ | ✅ | ✅ |
| SEO settings | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.3 Admin Sidebar per Type

```typescript
// Sidebar adapts based on site_type from StoreContext

store: Dashboard → Products → Orders → Inventory → Coupons → Customers → Pages → AI Studio → Analytics → Settings
blog: Dashboard → Posts → Categories → Pages → Media → Comments → AI Studio → Analytics → Settings
portfolio: Dashboard → Projects → Gallery → Skills → Testimonials → Contact → AI Studio → Analytics → Settings
resume: Dashboard → Experience → Education → Skills → Certifications → Export → AI Studio → Analytics → Settings
landing_page: Dashboard → Sections → Forms → Pages → Media → AI Studio → Analytics → Settings
```

---

## 3. Applications & Domains

### 3.1 Consumer Apps

| App | Path | Domain | Port | Framework | Status |
|-----|------|--------|------|-----------|--------|
| Landing | `apps/web/consumer/landing` | letbuyy.store | 3000 | Next.js 16 | ✅ 90% |
| Accounts | `apps/web/consumer/accounts` | accounts.letbuyy.store | 3001 | Next.js 16 | ✅ 85% |
| Admin | `apps/web/consumer/admin` | admin.letbuyy.store | 3002 | Next.js 16 | 🔶 70% |
| Storefront | `apps/web/consumer/storefront` | *.letbuyy.store | 3003 | Next.js 16 | 🔶 50% |
| App Store | `apps/web/consumer/app-store` | apps.letbuyy.store | 3004 | Next.js 16 | ❌ 15% |
| Theme Market | `apps/web/consumer/theme-marketplace` | themes.letbuyy.store | 3005 | Next.js 16 | ❌ 15% |

### 3.2 Administrative Apps

| App | Path | Domain | Port | Status |
|-----|------|--------|------|--------|
| Console | `apps/web/administrative/console` | console.letbuyy.store | 3010 | ❌ Scaffold |
| Team | `apps/web/administrative/team` | team.letbuyy.store | 3011 | ❌ Scaffold |

### 3.3 Flutter Apps

| App | Path | Platforms | Status |
|-----|------|-----------|--------|
| Builder | `apps/flutter/builder` | Android, iOS, macOS, Windows | 🔶 35% |
| Super Admin | `apps/flutter/super_admin` | Android, iOS, macOS | ❌ Scaffold |
| Team | `apps/flutter/team` | Android, iOS | ❌ Scaffold |

### 3.4 Backend Services

| Service | Path | Domain | Runtime | Status |
|---------|------|--------|---------|--------|
| API Worker | `backend/workers/api` | api.letbuyy.store | Cloudflare Worker (Hono) | 🔶 50% |
| Database | `backend/supabase` | Supabase | PostgreSQL 16 | ✅ 80% |

---

## 4. Authentication Architecture

### 4.1 Auth Flow Overview

```
ENTRY POINTS:
  letbuyy.store → "Get Started" → REDIRECT to accounts.letbuyy.store/signup
  accounts.letbuyy.store/login → Direct login
  admin.letbuyy.store/{store} → If unauthenticated → REDIRECT to accounts login

SIGNUP FLOW:
  1. Email entry + Turnstile bot check (POST /api/auth/lookup)
  2. Disposable email blocked (50+ domains checked)
  3. OTP sent via Resend email
  4. OTP verification (6-digit, 10min expiry, max 3 attempts)
  5. Password creation (bcrypt, 10 rounds min)
  6. Supabase Auth user created
  7. JWT issued via jose → HTTP-only cookie set
  8. Redirect → onboarding (if no stores) or admin dashboard

LOGIN FLOW:
  1. Email lookup → exists? → password form : redirect to signup
  2. Password verification (bcrypt compare)
  3. Supabase Auth session created
  4. JWT issued → HTTP-only cookie set
  5. Redirect → store selector (multi-store) or admin dashboard

LOGOUT:
  1. Supabase Auth signOut()
  2. Clear all cookies
  3. Redirect to accounts login page
```

### 4.2 Token Strategy

| Token | Library | Lifetime | Storage | Rotation |
|-------|---------|----------|---------|----------|
| Access Token | jose JWT | 1 hour | HTTP-only cookie | On expiry via refresh |
| Refresh Token | Supabase-managed | 7 days | HTTP-only cookie | Rotation on use (TODO — GAP) |
| CSRF Token | Custom (CSRF_SECRET) | Per session | Double-submit cookie | Per session |
| OTP | Random 6-digit | 10 minutes | Supabase metadata | Single-use |

### 4.3 Auth Middleware Chain

Every API request passes through this middleware stack (in order):

1. **CORS Check** — Verify origin is whitelisted
2. **Rate Limiter** — Check IP/email against Upstash Redis limits (PARTIAL — GAP)
3. **Bot Protection** — Turnstile verification (auth forms only)
4. **JWT Validation** — Verify access token via jose + Supabase
5. **CSRF Validation** — Verify CSRF token on mutating requests (NOT IMPLEMENTED — GAP)
6. **Permissions Check** — Verify user has access to the requested store (via RLS)
7. **Trial Check** — Verify store is within trial period or has active subscription

### 4.4 OAuth Providers

| Provider | Status | Flow |
|----------|--------|------|
| Google | ✅ Built | PKCE OAuth flow via Supabase Auth |
| GitHub | ❌ Planned | PKCE OAuth flow |
| Microsoft | ❌ Planned | PKCE OAuth flow |

### 4.5 Customer Authentication (Storefront)

Separate from platform auth. Customers of individual stores have their own accounts:

- **Table:** `customer_credentials` (email, password_hash, store-specific)
- **Secret:** `CUSTOMER_SESSION_SECRET` (separate from platform AUTH_SECRET)
- **Flow:** Email signup → password creation → session cookie
- **Scope:** Customer can only access the store they signed up on

### 4.6 Super Admin Authentication

- **Access:** console.letbuyy.store
- **Requirements:** Email in founders allowlist + mandatory 2FA (TOTP) + VPN + IP whitelist
- **Status:** ❌ None of these controls are implemented — scaffold only

---

## 5. Database Schema

### 5.1 Core Tables

> **Database:** PostgreSQL 16 via Supabase
> **Naming:** `snake_case` for tables and columns
> **Primary key:** UUID via `gen_random_uuid()`
> **Timestamps:** `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`

#### Auth Tables (Supabase-managed)
```
auth.users          — Supabase Auth managed user accounts
public.profiles     — Extended user metadata (name, avatar, phone)
```

#### Platform Core
```
sites               — The central entity (called "store" in UI/URLs)
├── id              UUID PK
├── user_id         UUID FK → auth.users
├── name            TEXT
├── subdomain       TEXT UNIQUE
├── site_type       ENUM (store, blog, portfolio, resume, landing_page)
├── status          ENUM (draft, published, suspended, deleted)
├── trial_status    ENUM (active, expired, converted)
├── trial_ends_at   TIMESTAMPTZ
├── published_at    TIMESTAMPTZ
├── settings        JSONB
├── created_at      TIMESTAMPTZ
└── updated_at      TIMESTAMPTZ

IMPORTANT: DB table is "sites" but code and URLs use "store" — always maintain this mapping.
```

#### E-Commerce Tables
```
products            — Product listings per store
product_options     — Option types (Size, Color)
product_variants    — Specific combinations (S/Black, M/Blue)
product_images      — Image URLs with position ordering
product_tags        — Tag associations
collections         — Product groupings (manual + smart)
collection_products — Many-to-many product↔collection
categories          — Hierarchical categories
orders              — Order records (items stored as JSONB — SHOULD BE RELATIONAL, GAP)
coupons             — Discount codes with usage tracking
shipping_zones      — Geographic shipping regions
shipping_rates      — Per-zone shipping rates
```

#### Content Tables
```
blog_posts          — Blog entries with rich text (Tiptap JSON)
blog_categories     — Blog category taxonomy
blog_tags           — Post tag associations
projects            — Portfolio project entries
skills              — Skills with proficiency levels
testimonials        — Client testimonials
work_experience     — Resume work history entries
education           — Resume education entries
certifications      — Resume certifications
pages               — Custom pages (all site types)
sections            — Page sections (landing page builder)
forms               — Form builder entries
form_submissions    — Form response data
media               — Media library entries
```

#### System Tables
```
plans               — Subscription plan definitions (Free, Starter, Business, Enterprise)
subscriptions       — User subscription records
invoices            — Payment invoices
themes              — Theme catalog
theme_installations — Theme per-store installations
apps                — App Store entries
app_installations   — App per-store installations
reviews             — App/theme reviews
notifications       — Platform notifications
activity_logs       — User activity audit trail
store_surveys       — Onboarding survey responses (JSONB)
onboarding_attempts — Onboarding progress tracking
ai_credits          — AI usage tracking per store
customer_credentials — Storefront customer accounts (per store)
store_customers     — Customer profile data per store
```

### 5.2 Row Level Security (RLS)

Every table MUST have RLS enabled. Standard policies:

```sql
-- Store owners can manage their own data
CREATE POLICY "store_owner_access" ON table_name
  FOR ALL USING (
    store_id IN (SELECT id FROM sites WHERE user_id = auth.uid())
  );

-- Public can read published content
CREATE POLICY "public_read_published" ON table_name
  FOR SELECT USING (status = 'published');
```

### 5.3 Migration Files

28 migration files in `backend/supabase/migrations/` (sequential, `NNN_description.sql`).

**Known Issues:**
- Duplicate migration number 022 (two files)
- Trigger function name inconsistency (some use `update_updated_at()`, others `update_updated_at_column()`)
- Missing soft delete columns (`deleted_at`)
- Missing audit columns (`created_by`, `updated_by`)
- Missing version column for optimistic locking
- Order items stored as JSONB instead of relational table

---

## 6. Onboarding & Trial

### 6.1 Onboarding State Machine

```
ANON → CREATED → VERIFIED → CHOOSING → STORE_CREATED → SURVEYING → ONBOARDED → PUBLISHED

States:
  ANON        — Anonymous visitor
  CREATED     — User record created (Supabase Auth)
  VERIFIED    — Email OTP verified, password set
  CHOOSING    — Selecting site type
  STORE_CREATED — sites record created, trial started
  SURVEYING   — Completing onboarding survey (skippable)
  ONBOARDED   — First content created
  PUBLISHED   — Store is live
```

### 6.2 Trial System

- **Duration:** 7 days from store creation
- **Tracking:** `trial_ends_at` column on `sites` table
- **Enforcement:** API middleware checks trial status on every request
- **Expiry Actions:**
  1. Store remains accessible but becomes read-only
  2. "Upgrade to continue" banner displayed
  3. Marketing emails sent at day 3, day 5, day 7

### 6.3 Store Creation Flow

```
Step 1: Choose site type (store/portfolio/resume/blog/landing_page)
Step 2: Enter store name + subdomain (real-time availability check)
  → Backend: INSERT sites + ai_credits + onboarding_attempts
  → Email: "Store Created" via Resend
  → Redirect to admin.letbuyy.store/{subdomain}/onboarding
Step 3: Site-type-specific onboarding survey (5 questions, skippable)
  → Saved to store_surveys (JSONB)
Step 4: Create first content (product/project/post/section)
Step 5: Review & publish
  → UPDATE sites SET status = 'published', published_at = NOW()
```

---

## 7. Admin Dashboard

### 7.1 Architecture

```
admin.letbuyy.store/{store}/

Layout:
┌──────────────────────────────────────────────────┐
│ Header: Logo | Store Name | Search ⌘K | Notifications | Dark Mode | Profile |
├──────────┬───────────────────────────────────────┤
│ Sidebar  │  Main Content Area                    │
│ (adaptive│  (route-dependent content)            │
│  per     │                                       │
│  site    │                                       │
│  type)   │                                       │
└──────────┴───────────────────────────────────────┘
```

### 7.2 Store Context

The `StoreProvider` wraps all admin pages and provides:
- `store` — Full store record (id, name, subdomain, site_type, status, settings)
- `permissions` — User's permission set for this store
- Sidebar navigation adapts based on `site_type`

### 7.3 Dashboard Pages (All Types)

**Universal pages** (available for all site types):
- `/dashboard` — Overview with stats, recent activity, quick actions
- `/pages` — Custom pages management
- `/media` — Media library (images, videos)
- `/ai-studio` — AI content generation
- `/analytics` — Traffic, engagement, conversions
- `/settings` — General, SEO, domains, billing, legal, danger-zone

**E-Commerce specific:** `/products`, `/orders`, `/inventory`, `/coupons`, `/customers`, `/shipping`
**Blog specific:** `/posts`, `/categories`, `/comments`
**Portfolio specific:** `/projects`, `/gallery`, `/skills`, `/testimonials`, `/contact`
**Resume specific:** `/experience`, `/education`, `/skills`, `/certifications`, `/export`
**Landing specific:** `/sections`, `/forms`

### 7.4 Universal Features

- **⌘K Command Palette** — Quick navigation and actions
- **Notification Center** — Real-time notifications (orders, comments, system alerts)
- **Dark Mode Toggle** — Persisted to user preferences
- **Account Switcher** — For users with multiple stores

---

## 8. E-Commerce Engine

### 8.1 Product Management

**Product fields:** title, slug, description (rich text via Tiptap), short description, price, compare-at-price, cost, SKU, barcode, category, tags, status (draft/active/archived), weight, dimensions, SEO metadata.

**Product Options:** Up to 3 option types (e.g., Size, Color, Material) with values arrays.

**Product Variants:** Cartesian product of option values. Each variant has: own price, SKU, inventory count, image.

**Inventory tracking:**
- Per-variant inventory counts
- Low stock threshold alerts
- Backorder configuration
- Multi-location tracking (planned)

### 8.2 Cart & Checkout

```
CART FLOW:
  1. Add to cart → localStorage (guest) or carts table (authenticated)
  2. Cart drawer/page → quantity adjustments, remove items
  3. Checkout page → shipping address → shipping method → payment
  4. Payment processing → order creation → confirmation email

ABANDONED CART:
  → If cart is >1 hour old and not converted → flag for recovery
  → Email sequence at 1h, 24h, 72h (NOT YET IMPLEMENTED — GAP)
```

### 8.3 Order Lifecycle

```
Order States:
  PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED
                     ↘ CANCELLED
                     ↘ REFUNDED (partial or full)

Status Transitions:
  pending    → confirmed  (after payment verified)
  confirmed  → processing (when store owner begins fulfillment)
  processing → shipped    (when tracking number added)
  shipped    → delivered   (when delivery confirmed)
  any        → cancelled   (before shipped — triggers refund)
  delivered  → refunded    (post-delivery refund request)
```

### 8.4 Coupon System

**Coupon types:**
- Percentage discount (e.g., 20% off)
- Fixed amount discount (e.g., ₹500 off)
- Free shipping
- Buy X get Y

**Coupon constraints:** minimum order amount, maximum discount, usage limit per coupon, usage limit per customer, valid date range, product/collection restrictions.

### 8.5 Shipping

**Shipping zones:** Geographic regions (country, state, zip ranges).
**Rate types:** Flat rate, weight-based, price-based, free shipping threshold.
**Carrier integration:** Manual fulfillment (Phase 1) → carrier APIs (Phase 4).

---

## 9. Portfolio & Resume Builder

### 9.1 Portfolio

**Projects:** Title, slug, description, client name/URL, tech stack (tags), category, case study fields (problem, solution, results), cover image, gallery images, live/source URLs, status (draft/published/archived).

**Skills:** Skill name, category, proficiency level (1-100), years of experience, display order.

**Gallery:** Image uploads with captions, category tagging, masonry/grid layout options.

**Testimonials:** Client name, title, company, quote text, avatar, rating, display toggle.

**Contact Form:** Configurable fields, spam protection (Turnstile), email notifications.

### 9.2 Resume

**Experience:** Company, title, location, start/end dates, description (rich text), tags, display order.

**Education:** Institution, degree, field, GPA, start/end dates, description, display order.

**Skills (Resume):** Same model as portfolio but organized into categories (Technical, Soft, Language).

**Certifications:** Name, issuer, date, expiry, credential URL, display order.

**PDF Export:** Server-side PDF generation with template selection and ATS score analysis (PLANNED — NOT BUILT).

---

## 10. Blog Engine

### 10.1 Blog Post Management

**Post fields:** Title, slug, content (Tiptap rich text JSON), excerpt, cover image, category, tags, status (draft/scheduled/published/archived), publish date/time, SEO metadata, reading time (auto-calculated).

**Editor:** Tiptap WYSIWYG editor with: headings, bold/italic, lists, blockquotes, code blocks, images, embeds (YouTube, Twitter), tables, horizontal rules, link insertion.

**Scheduling:** Set future publish date → background job publishes at scheduled time (PLANNED — background jobs not yet configured).

**Categories:** Hierarchical (parent/child), slug-based URLs, SEO metadata per category.

### 10.2 Comments (Planned)

- Threaded comments with reply support
- Moderation queue (approve/reject/spam)
- Optional Disqus integration

---

## 11. Landing Page Builder

### 11.1 Section-Based Architecture

Landing pages are composed of reorderable sections:

| Section Type | Purpose | Status |
|-------------|---------|--------|
| Hero | Main banner with CTA | ✅ Built |
| Features/Services | Feature showcase grid | ✅ Built |
| Pricing | Plan comparison table | ✅ Built |
| Testimonials | Social proof carousel | ✅ Built |
| FAQ | Accordion Q&A | ✅ Built |
| Stats/Counter | Animated stat counters | ✅ Built |
| Logo Cloud | Partner/client logos | ✅ Built |
| Portfolio/Gallery | Image showcase | ✅ Built |
| Contact/Form | Form builder | 🔶 Partial |
| CTA | Call-to-action banner | 🔶 Partial |

### 11.2 Form Builder

- Drag-and-drop field ordering
- Field types: text, email, phone, textarea, select, checkbox, file upload
- Turnstile spam protection
- Email notification on submission
- Form submission storage in `form_submissions` table

---

## 12. Storefront Rendering

### 12.1 Architecture

```
Request Flow:
  *.letbuyy.store → Vercel Middleware
    → Extract subdomain from hostname
    → Lookup store by subdomain (sites table)
    → Set store context headers (x-store-id, x-site-type, x-store-status)
    → Render site-type-specific template with ISR

Rendering Strategy:
  → ISR (Incremental Static Regeneration) with 60-second revalidation
  → Server Components for data fetching
  → Client Components only for interactive elements (cart, search, forms)
```

### 12.2 Storefront Routes per Type

**E-Commerce Store:**
```
/                    → Homepage (featured products, collections, hero)
/products            → Product listing with filters, sort, search
/products/[slug]     → Product detail page (images, variants, reviews, add to cart)
/collections/[slug]  → Collection page
/cart                → Cart page
/checkout            → Multi-step checkout
/account             → Customer account (orders, addresses, profile)
/search              → Product search results
```

**Portfolio:**
```
/                    → Hero + featured projects + skills summary
/projects            → Project grid with category filters
/projects/[slug]     → Project detail with gallery + case study
/skills              → Skills breakdown with visualizations
/contact             → Contact form with Turnstile
```

**Resume:**
```
/                    → Full CV layout (experience, education, skills)
/download            → PDF download
```

**Blog:**
```
/                    → Latest posts feed
/[category]          → Category filtered view
/[slug]              → Post detail with comments
/archive             → Chronological archive
```

### 12.3 SEO

Each storefront generates:
- Dynamic `<title>` and `<meta description>` per page
- Open Graph tags for social sharing
- JSON-LD structured data (Product, Organization, BreadcrumbList)
- `sitemap.xml` auto-generation (PLANNED — GAP)
- `robots.txt` served per store

---

## 13. Theme System

### 13.1 Theme Architecture

```
themes table:
  id, name, slug, description, preview_images[], price,
  site_types[] (which site types this theme supports),
  template_data (JSONB — component layout and style config),
  category, status, created_by

theme_installations table:
  id, store_id FK → sites, theme_id FK → themes,
  custom_settings (JSONB — store-specific overrides),
  installed_at, is_active
```

### 13.2 Theme Categories

| Category | Examples | Status |
|----------|----------|--------|
| E-Commerce | Classic Store, Modern Shop, Fashion | 🔶 3 built |
| Portfolio | Creative, Minimal, Bold | ❌ Planned |
| Resume | Professional, Modern, Creative | ❌ Planned |
| Blog | Editorial, Magazine, Personal | ❌ Planned |
| Landing | Startup, Agency, SaaS | ❌ Planned |

### 13.3 Theme Components

Themes consist of configurable sections with: layout (grid/flex options), colors (override design tokens), typography (font family, sizes), spacing, and content slots.

### 13.4 Theme Marketplace

- Browse and preview themes at themes.letbuyy.store
- Free and premium themes
- Developer submission flow (PLANNED)
- Revenue split: 70% developer / 30% platform

---

## 14. App Store & Extensions

### 14.1 App Architecture

```
apps table:
  id, name, slug, description, developer_id, icon, screenshots[],
  category, version, price, permissions[], webhook_url,
  api_endpoints[], status

app_installations table:
  id, store_id FK → sites, app_id FK → apps,
  settings (JSONB), access_token, installed_at, is_active
```

### 14.2 Extension Categories

- Marketing & SEO (email campaigns, social media, Google Analytics)
- Shipping & Fulfillment (carrier integrations, tracking)
- Customer Support (live chat, helpdesk)
- Accounting (invoice generation, tax calculation)
- Inventory management
- Reporting & Analytics

### 14.3 Developer API (Planned)

- REST API for store data access (scoped by permissions)
- Webhook subscriptions (order.created, product.updated, etc.)
- OAuth-based app authorization
- Sandbox environment for development
- Revenue split: 80% developer / 20% platform

---

## 15. Notification System

### 15.1 Notification Types

**Store Owner Notifications:**
- New order received
- Low stock alert
- New customer signup
- Payment received/failed
- Review submitted
- App/theme update available
- Trial expiring (3 days before)

**Customer Notifications:**
- Order confirmation
- Shipping update
- Delivery confirmation
- Password reset
- Welcome email

**System Notifications:**
- Platform maintenance
- Security alerts
- Feature announcements

### 15.2 Channels

| Channel | Technology | Status |
|---------|-----------|--------|
| In-App | `notifications` table + polling | 🔶 Partial |
| Email | Resend + React Email templates | ✅ Built |
| Push (Web) | Web Push API | ❌ Planned |
| Push (Mobile) | FCM | ❌ Planned |
| SMS | Twilio (India: MSG91) | ❌ Planned |

### 15.3 Email Templates

Built with React Email + Resend:
- Welcome email (post-signup)
- Email verification (OTP code)
- Store created confirmation
- Password reset
- Order confirmation
- Shipping notification

---

## 16. AI Features

### 16.1 Planned Capabilities

| Feature | Use Case | Model | Status |
|---------|---------|-------|--------|
| Product Descriptions | Auto-generate from title + images | GPT-4 / Claude | ❌ Not Started |
| SEO Optimization | Meta title/description generation | GPT-4 | ❌ Not Started |
| Blog Post Drafts | Generate blog content from topic | GPT-4 / Claude | ❌ Not Started |
| Resume Enhancement | Improve resume bullet points | GPT-4 | ❌ Not Started |
| Portfolio Case Study | Generate case study from project details | Claude | ❌ Not Started |
| Image Generation | Product/hero images from text | DALL-E / Stable Diffusion | ❌ Not Started |
| Chatbot | Customer support automation | GPT-4 | ❌ Not Started |

### 16.2 AI Credit System

```
ai_credits table:
  id, store_id FK → sites, credits_remaining INT,
  credits_used INT, reset_at TIMESTAMPTZ

Credit Allocation per Plan:
  Free:       50 credits/month
  Starter:    500 credits/month
  Business:   2,000 credits/month
  Enterprise: 10,000 credits/month
```

---

## 17. Analytics & Reporting

### 17.1 Tracked Metrics

**Storefront Analytics:**
- Page views (per page, per session)
- Unique visitors
- Session duration
- Bounce rate
- Referral sources
- Geographic distribution
- Device/browser breakdown

**E-Commerce Analytics:**
- Conversion rate (visitor → order)
- Average order value (AOV)
- Revenue (daily, weekly, monthly)
- Top-selling products
- Cart abandonment rate
- Customer lifetime value (CLV)

**Content Analytics:**
- Post views and read time
- Project/portfolio views
- Form submissions
- Search queries

### 17.2 Implementation

Currently using basic `view_count` columns on content tables. Full analytics system with event tracking and dashboards is PLANNED for Phase 3.

---

## 18. Payment System

### 18.1 Payment Gateways

| Gateway | Markets | Features | Status |
|---------|---------|----------|--------|
| Razorpay | India | UPI, netbanking, cards, wallets | 🔶 30% |
| Stripe | Global | Cards, Apple/Google Pay, BNPL | ❌ Env vars set, no integration |
| PayPal | International | PayPal balance, cards | ❌ Env vars set, no integration |

### 18.2 Payment Flow

```
1. Customer selects items → cart created
2. Checkout page → address → shipping method selection
3. Payment method selection (based on store's configured gateways)
4. Create payment session on gateway (Razorpay/Stripe/PayPal)
5. Customer completes payment on gateway UI
6. Webhook callback → verify signature → confirm payment
7. Order status: pending → confirmed
8. Confirmation email sent
```

### 18.3 Subscription Billing (Store Owners)

```
Plan Selection:
  Settings → Billing → View Plans → Select Plan
  → Create Razorpay/Stripe subscription
  → Webhook confirms payment
  → Update subscriptions table
  → Unlock plan features

Plan Changes:
  Upgrade: immediate, pro-rated billing
  Downgrade: at end of current billing cycle
  Cancel: access until end of current period
```

### 18.4 Security Requirements

- ✅ NEVER trust client-sent prices — always recalculate server-side
- ❌ Webhook signature verification (NOT IMPLEMENTED — CRITICAL GAP)
- ❌ Idempotency keys for payment operations (NOT IMPLEMENTED)
- ✅ PCI compliance via gateway-hosted payment forms (no card data touches our servers)

---

## 19. Super Admin Console

### 19.1 Purpose

Platform-wide management for founders/admins at `console.letbuyy.store`.

### 19.2 Required Access Controls (NOT IMPLEMENTED)

1. Email allowlist (founders only)
2. 2FA mandatory (TOTP via authenticator app)
3. VPN required
4. IP whitelist
5. Session timeout (15 minutes)

### 19.3 Planned Features

| Feature | Description | Status |
|---------|-------------|--------|
| Dashboard | Platform metrics (users, stores, revenue, health) | ❌ |
| Users | List, search, view, suspend/unsuspend users | ❌ |
| Stores | List, search, view details, suspend/activate stores | ❌ |
| Subscriptions | Revenue overview, invoices, plan analytics | ❌ |
| Employees | Invite, manage roles, deactivate | ❌ |
| Audit Logs | View all platform activity logs | ❌ |
| Feature Flags | Toggle features globally or per-plan | ❌ |
| Themes | Approve/reject submitted themes | ❌ |
| Apps | Approve/reject submitted apps | ❌ |
| Reports | Generate platform reports | ❌ |

---

## 20. Employee Portal

### 20.1 Purpose

Internal operations portal for employees at `team.letbuyy.store`.

### 20.2 Role-Based Access Control

| Role | Permissions |
|------|------------|
| Support Agent | View user/store data, respond to tickets, read-only analytics |
| Moderator | Everything Support + flag/suspend content, review reports |
| Marketing | View analytics, manage campaigns, view user metrics |
| QA Tester | Full access to staging environment |
| Manager | All above + employee management, sensitive data access |

### 20.3 Planned Features

- Login with company email allowlist
- Support ticket system (user queries, store issues)
- User/store lookup (read-only)
- Content moderation queue
- Internal communication tools
- Shift scheduling and task assignment

**Status:** ❌ Scaffold only — no features implemented.

---

## 21. Security Architecture

### 21.1 Current Security Posture

| Area | Status | Details |
|------|--------|---------|
| Password hashing | ✅ | bcryptjs with 10 rounds |
| JWT tokens | ✅ | jose library, HTTP-only cookies |
| OTP verification | ✅ | 6-digit, 10min expiry, 3 attempts max |
| Turnstile bot protection | ✅ | On signup and login forms |
| RLS policies | ✅ | On most tables (verify completeness) |
| Disposable email blocking | ✅ | 50+ domains blocked |
| Rate limiting | 🔶 | Partial — only some auth endpoints |
| CSRF protection | ❌ | Secret exists but no middleware |
| Webhook signature verification | ❌ | CRITICAL — not implemented |
| Security headers | ❌ | No headers configured |
| CORS configuration | 🔶 | Defined in docs, verify in code |
| Error sanitization | ❌ | Raw DB errors returned to clients |
| Brute force prevention | ❌ | No account lockout mechanism |
| 2FA | ❌ | Not implemented (needed for console) |
| VPN/IP whitelist | ❌ | Not implemented (needed for console) |
| Audit logging | 🔶 | activity_logs table exists, partial usage |
| Secrets management | ❌ | CRITICAL — committed to `all.env` |

### 21.2 Security Rules

See CLAUDE.md Section 10 for the complete security rules list.

### 21.3 Immediate Actions Required

1. **Rotate ALL secrets** — 9 production secrets committed to `all.env`
2. **Add webhook signature verification** — Payment webhooks vulnerable to spoofing
3. **Add rate limiting** — Auth endpoints vulnerable to brute force
4. **Remove `all.env` from git history** — Use BFG Repo-Cleaner
5. **Add CSRF middleware** — Mutating endpoints vulnerable to CSRF attacks
6. **Sanitize error responses** — Internal details exposed to clients
7. **Add security headers** — Missing HSTS, X-Content-Type-Options, etc.

---

## 22. API Reference

### 22.1 Auth Endpoints (Accounts App)

| Method | Path | Purpose | Rate Limit |
|--------|------|---------|------------|
| POST | `/api/auth/lookup` | Check if email exists | 10/min/IP |
| POST | `/api/auth/signup` | Create user account | 5/min/IP |
| POST | `/api/auth/verify-otp` | Verify email OTP | 3/min/IP |
| POST | `/api/auth/set-password` | Set password after OTP | 5/min/IP |
| POST | `/api/auth/login` | Email + password login | 10/min/IP |
| POST | `/api/auth/logout` | End session | Unlimited |
| GET | `/api/auth/session` | Check current session | 60/min |
| POST | `/api/auth/send-reset` | Send password reset email | 3/min/IP |
| POST | `/api/auth/reset-password` | Reset password with token | 5/min/IP |
| POST | `/api/auth/send-magic` | Send magic link email | 5/min/IP |
| GET | `/api/auth/accounts` | List user's store accounts | 30/min |
| POST | `/api/auth/switch` | Switch to a different store | 30/min |
| GET | `/api/auth/stores` | List user's stores | 30/min |
| POST | `/api/auth/create-store` | Create new store | 3/min |
| POST | `/api/auth/validate-subdomain` | Check subdomain availability | 30/min |
| POST | `/api/auth/verify` | Verify auth token | 30/min |

### 22.2 Store Management (API Worker)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/stores/:storeId` | Get store details |
| PUT | `/v1/stores/:storeId` | Update store settings |
| GET | `/v1/stores/:storeId/products` | List products (paginated) |
| POST | `/v1/stores/:storeId/products` | Create product |
| GET | `/v1/stores/:storeId/products/:id` | Get product detail |
| PUT | `/v1/stores/:storeId/products/:id` | Update product |
| DELETE | `/v1/stores/:storeId/products/:id` | Delete product |
| GET | `/v1/stores/:storeId/orders` | List orders (paginated) |
| POST | `/v1/stores/:storeId/orders` | Create order |
| PUT | `/v1/stores/:storeId/orders/:id/status` | Update order status |
| GET | `/v1/stores/:storeId/customers` | List customers |
| GET | `/v1/stores/:storeId/analytics` | Get analytics data |

### 22.3 Blog API (API Worker)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/stores/:storeId/posts` | List blog posts |
| POST | `/v1/stores/:storeId/posts` | Create blog post |
| GET | `/v1/stores/:storeId/posts/:slug` | Get post by slug |
| PUT | `/v1/stores/:storeId/posts/:id` | Update post |
| DELETE | `/v1/stores/:storeId/posts/:id` | Delete post |
| GET | `/v1/stores/:storeId/categories` | List blog categories |

### 22.4 Portfolio API (API Worker)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/stores/:storeId/projects` | List projects |
| POST | `/v1/stores/:storeId/projects` | Create project |
| GET | `/v1/stores/:storeId/projects/:slug` | Get project |
| PUT | `/v1/stores/:storeId/projects/:id` | Update project |
| DELETE | `/v1/stores/:storeId/projects/:id` | Delete project |
| GET | `/v1/stores/:storeId/skills` | List skills |
| POST | `/v1/stores/:storeId/skills` | Create skill |
| GET | `/v1/stores/:storeId/testimonials` | List testimonials |

---

## 23. Infrastructure & Deployment

### 23.1 Hosting Architecture

```
                    ┌─────────────────────────────┐
                    │     Cloudflare DNS           │
                    │  *.letbuyy.store → Vercel    │
                    │  api.letbuyy.store → Worker  │
                    └─────────┬───────────────────┘
                              │
            ┌─────────────────┼───────────────────┐
            │                 │                    │
     ┌──────▼──────┐   ┌─────▼─────┐    ┌────────▼────────┐
     │   Vercel     │   │ Cloudflare │    │   Supabase       │
     │  (Next.js    │   │  Workers   │    │  (PostgreSQL     │
     │   apps)      │   │  (Hono     │    │   + Auth         │
     │              │   │   API)     │    │   + Storage)     │
     └──────────────┘   └───────────┘    └─────────────────┘
            │                 │                    │
            │           ┌────▼────┐                │
            │           │ Upstash │                │
            │           │  Redis  │                │
            │           └─────────┘                │
            │                                      │
     ┌──────▼──────────────────────────────────────┘
     │              Resend (Email)
     └──────────────────────────────────────────────
```

### 23.2 Deployment Config

| Service | Platform | Config File | Deploy Method |
|---------|----------|-------------|---------------|
| Landing | Vercel | `vercel.json` | Git push to `main` |
| Accounts | Vercel | `vercel.json` | Git push to `main` |
| Admin | Vercel | `vercel.json` | Git push to `main` |
| Storefront | Vercel | `vercel.json` | Git push to `main` |
| API Worker | Cloudflare | `wrangler.toml` | `wrangler deploy` |
| Database | Supabase | `config.toml` | `supabase db push` |

### 23.3 Environment Management

All environment variables managed through deployment dashboards (Vercel Dashboard, Cloudflare Dashboard, Supabase Dashboard).

**NEVER** commit actual values. Use `all.env.example` for reference only.

---

## 24. Pricing & Plans

### 24.1 Plan Definitions

| Feature | Free | Starter ($9/mo) | Business ($29/mo) | Enterprise ($79/mo) |
|---------|------|------------------|--------------------|--------------------|
| Products | 10 | 100 | 1,000 | Unlimited |
| Storage | 500 MB | 5 GB | 20 GB | 100 GB |
| Custom domain | ❌ | ✅ | ✅ | ✅ |
| SSL | ✅ | ✅ | ✅ | ✅ |
| AI credits/month | 50 | 500 | 2,000 | 10,000 |
| Team members | 1 | 3 | 10 | Unlimited |
| Transaction fee | 2% | 1% | 0.5% | 0% |
| Priority support | ❌ | ❌ | ✅ | ✅ |
| Advanced analytics | ❌ | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ | ✅ |

### 24.2 Plan Implementation

Plans defined in `plans` table with Razorpay Plan IDs (migration 016).

Subscriptions tracked in `subscriptions` table with `status` (active, cancelled, past_due, expired).

---

## 25. Build Status & Gaps

### 25.1 Overall Completion

| Area | Estimate | Key Gaps |
|------|----------|----------|
| Auth (accounts) | 85% | Missing: refresh token rotation, 2FA, rate limiting on all endpoints |
| Landing | 90% | Missing: CMS-driven content, form submissions |
| Admin Dashboard | 70% | Missing: shipping config, inventory multi-location, customer management |
| Storefront | 50% | Missing: cart persistence, checkout completion, search, customer accounts |
| API Worker | 50% | Missing: versioning, error standardization, webhook verification |
| Database | 80% | Missing: soft deletes, audit cols, version cols, order_items table |
| Payments | 30% | Missing: full Razorpay integration, Stripe/PayPal not started |
| Console | 5% | Scaffold only — no features |
| Team Portal | 5% | Scaffold only — no features |
| App Store | 15% | Basic structure only |
| Theme Market | 15% | Basic structure only |
| Flutter Builder | 35% | 35 screens, 14 services, but many features incomplete |
| Testing | 0% | Zero test files exist |
| CI/CD | 0% | No pipeline configured |
| Monitoring | 0% | No structured logging, no error tracking |

### 25.2 Critical Gaps (Block Launch)

1. 🔴 **Committed secrets** — Must rotate immediately
2. 🔴 **Webhook signature verification** — Payment security vulnerability
3. 🔴 **Rate limiting** — Auth brute force vulnerability
4. 🔴 **Complete payment integration** — Cannot process real transactions
5. 🔴 **Cart & checkout completion** — Core e-commerce flow broken
6. 🟡 **CSRF protection** — Token exists but middleware missing
7. 🟡 **Error sanitization** — Internal details exposed
8. 🟡 **Security headers** — Missing from all responses
9. 🟡 **Testing** — Zero tests
10. 🟡 **CI/CD** — No automated deployment

---

## 26. Environment Variables

### 26.1 Variable Matrix

| Variable | Apps Using It | Public? | Required |
|----------|--------------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ALL | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ALL | Yes | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side only (storefront, admin) | **NO** | Yes |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Accounts, Admin | Yes | Yes |
| `TURNSTILE_SECRET_KEY` | Accounts, Admin (server) | **NO** | Yes |
| `NEXT_PUBLIC_ACCOUNTS_URL` | Accounts, Admin, Landing | Yes | Yes |
| `NEXT_PUBLIC_ADMIN_URL` | Accounts, Admin, Landing | Yes | Yes |
| `NEXT_PUBLIC_LANDING_URL` | Accounts, Admin, Landing | Yes | Yes |
| `NEXT_PUBLIC_API_URL` | Admin, Landing | Yes | Yes |
| `UPSTASH_REDIS_REST_URL` | Accounts | **NO** | Yes |
| `UPSTASH_REDIS_REST_TOKEN` | Accounts | **NO** | Yes |
| `RESEND_API_KEY` | All (server) | **NO** | Yes |
| `RESEND_FROM_EMAIL` | All (server) | No | Yes |
| `AUTH_SECRET` | Accounts, Admin | **NO** | Yes |
| `CSRF_SECRET` | Accounts, Admin | **NO** | Yes |
| `CUSTOMER_SESSION_SECRET` | Storefront | **NO** | Yes |
| `RAZORPAY_KEY_ID` | Admin (billing) | Yes | For payments |
| `RAZORPAY_KEY_SECRET` | Admin (server) | **NO** | For payments |
| `STRIPE_SECRET_KEY` | Storefront (server) | **NO** | For global payments |
| `STRIPE_WEBHOOK_SECRET` | Storefront (server) | **NO** | For global payments |
| `PAYPAL_CLIENT_ID` | Storefront | Yes | For PayPal |
| `PAYPAL_CLIENT_SECRET` | Storefront (server) | **NO** | For PayPal |

---

*End of consolidated documentation. All previous documentation files should be deleted.*
