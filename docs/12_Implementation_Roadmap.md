# LetBuyy Platform — Implementation Roadmap

> **Doc 12 of 15** | Phased Development Plan, Sprint Breakdown, Milestones, Deployment, Cost & Launch Strategy
>
> **Version:** 6.0 | **Date:** February 15, 2026
>
> **Prev:** [11 Super Admin & Team](./11_Super_Admin_and_Team.md) | **Next:** [13 Plans & Pricing](./13_Plans_and_Pricing.md)

---

## Table of Contents

1. [Roadmap Overview](#1-roadmap-overview)
2. [Development Timeline](#2-development-timeline)
3. [Phase 1: Foundation (Weeks 1–4)](#3-phase-1-foundation-weeks-14)
4. [Phase 2: Core Features (Weeks 5–10)](#4-phase-2-core-features-weeks-510)
5. [Phase 3: E-Commerce Engine (Weeks 11–16)](#5-phase-3-e-commerce-engine-weeks-1116)
6. [Phase 4: AI Integration (Weeks 17–20)](#6-phase-4-ai-integration-weeks-1720)
7. [Phase 5: Polish & Launch (Weeks 21–24)](#7-phase-5-polish--launch-weeks-2124)
8. [Phase 6: Growth & Scale (Weeks 25+)](#8-phase-6-growth--scale-weeks-25)
9. [Deployment Architecture](#9-deployment-architecture)
10. [CI/CD Pipeline](#10-cicd-pipeline)
11. [Environment Strategy](#11-environment-strategy)
12. [Infrastructure Stack](#12-infrastructure-stack)
13. [Testing Strategy](#13-testing-strategy)
14. [Monitoring & Observability](#14-monitoring--observability)
15. [Risk Management](#15-risk-management)
16. [Pre-Launch Checklist](#16-pre-launch-checklist)
17. [Launch Playbook](#17-launch-playbook)
18. [Cost Projections](#18-cost-projections)
19. [Revenue Model & Projections](#19-revenue-model--projections)
20. [Team & Resource Planning](#20-team--resource-planning)
21. [Document History](#21-document-history)

---

## 1. Roadmap Overview

### 1.1 Vision

Build a multi-tenant SaaS platform that empowers micro/small merchants, freelancers, and content creators to launch professional online stores, portfolios, resumes, landing pages, and blogs — all powered by AI, deployed in seconds, and managed from a single admin dashboard.

### 1.2 Key Principles

| Principle | Application |
|---|---|
| **Ship fast, iterate** | 2-week sprints with deployable increments |
| **AI-first, not AI-only** | AI enhances every feature but is never a blocker |
| **Multi-tenant from day 1** | Store isolation (RLS) built into every query |
| **Edge-first** | API on Cloudflare Workers (0ms cold start) |
| **Mobile-ready** | Responsive storefronts + Flutter admin app |
| **Cost-conscious** | Free tier for all services; scale only when needed |
| **Documentation-driven** | This doc series written before code |

### 1.3 Success Metrics (6-Month Goals)

| Metric | Target | Measurement |
|---|---|---|
| Time to first store | < 3 minutes | Onboarding completion time |
| Platform uptime | > 99.9% | UptimeRobot monitoring |
| Lighthouse score | > 90 (all categories) | Automated CI check |
| Trial-to-paid conversion | > 20% | Analytics dashboard |
| Monthly active stores | 500+ | Platform analytics |
| Customer satisfaction (CSAT) | > 4.5/5.0 | Post-interaction survey |
| MRR | ₹80,000+ | Billing dashboard |

---

## 2. Development Timeline

### 2.1 Phase Overview

```
PHASE 1 (Wk 1-4)        PHASE 2 (Wk 5-10)       PHASE 3 (Wk 11-16)
┌────────────────┐     ┌────────────────┐      ┌─────────────────┐
│  FOUNDATION    │ ──→ │ CORE FEATURES  │ ───→ │  E-COMMERCE     │
│                │     │                │      │  ENGINE         │
│ • Monorepo     │     │ • Admin Dash   │      │ • Products      │
│ • Auth System  │     │ • Page Builder │      │ • Cart/Checkout │
│ • DB Schema    │     │ • Theme Engine │      │ • Payments      │
│ • API Layer    │     │ • Portfolio    │      │ • Orders        │
│ • CI/CD        │     │ • Resume      │      │ • Shipping      │
│ • Onboarding   │     │ • Storefront   │      │ • Coupons       │
└────────────────┘     └────────────────┘      └─────────────────┘
                                                       │
PHASE 6 (Wk 25+)        PHASE 5 (Wk 21-24)     PHASE 4 (Wk 17-20)
┌────────────────┐     ┌────────────────┐      ┌─────────────────┐
│  GROWTH &      │ ←── │  POLISH &      │ ←─── │  AI             │
│  SCALE         │     │  LAUNCH        │      │  INTEGRATION    │
│                │     │                │      │                 │
│ • Flutter App  │     │ • Super Admin  │      │ • AI Gateway    │
│ • Custom Domain│     │ • Testing      │      │ • Product AI    │
│ • Blog System  │     │ • Performance  │      │ • Portfolio AI  │
│ • Analytics v2 │     │ • Security     │      │ • Content Mod   │
│ • Marketplace  │     │ • Launch Prep  │      │ • Credit System │
│ • PWA          │     │ • Soft Launch   │      │ • AI Studio     │
└────────────────┘     └────────────────┘      └─────────────────┘
```

### 2.2 Gantt Chart

```
Week  1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25+
      │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
P1    ████████████████│   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
      Foundation     │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
                      │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
P2                    ████████████████████████│   │   │   │   │   │   │   │   │   │   │   │   │   │   │
                      Core Features          │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
                                              │   │   │   │   │   │   │   │   │   │   │   │   │   │   │
P3                                            ████████████████████████│   │   │   │   │   │   │   │   │
                                              E-Commerce Engine      │   │   │   │   │   │   │   │   │
                                                                      │   │   │   │   │   │   │   │   │
P4                                                                    ████████████████│   │   │   │   │
                                                                      AI Integration  │   │   │   │   │
                                                                                      │   │   │   │   │
P5                                                                                    ████████████████│
                                                                                      Polish & Launch │
                                                                                                      │
P6                                                                                                    █→
                                                                                                Growth
```

### 2.3 Key Milestones

| Milestone | Phase | Week | Deliverable |
|---|---|---|---|
| 🏗️ **Infrastructure Ready** | P1 | 4 | Auth, DB, API, CI/CD all deployed |
| 📊 **Admin Dashboard v1** | P2 | 8 | Working admin dashboard with page builder |
| 🎨 **All Site Types Live** | P2 | 10 | Portfolio, Resume, Landing all functional |
| 🛒 **First Sale** | P3 | 15 | End-to-end purchase flow working |
| 🤖 **AI Powered** | P4 | 20 | All AI features integrated |
| 🚀 **Soft Launch** | P5 | 24 | Public launch with first real users |
| 📱 **Mobile App** | P6 | 28 | Flutter admin app on Play Store |
| 🌐 **Custom Domains** | P6 | 30 | SSL-provisioned custom domains |
| 📝 **Blog System** | P6 | 32 | Full blogging engine |
| 🎯 **500 Stores** | P6 | 36 | Growth milestone |

---

## 3. Phase 1: Foundation (Weeks 1–4)

### Milestone: 🏗️ "Infrastructure Ready"

### 3.1 Week 1 — Monorepo & Infrastructure

| Task | Priority | Details | Status |
|---|---|---|---|
| Initialize Turborepo | 🔴 Critical | `pnpm` workspaces, shared configs (`tsconfig`, `eslint`, `prettier`) | ✅ Done |
| Setup Supabase project | 🔴 Critical | Postgres DB, enable Auth, configure project | ✅ Done |
| Setup Cloudflare Workers | 🔴 Critical | Hono framework, Wrangler config, R2 bucket, KV namespace | ✅ Done |
| Setup Vercel projects | 🔴 Critical | 3 Next.js apps: `accounts`, `admin`, `storefront` | ✅ Done |
| Configure DNS | 🔴 Critical | `letbuyy.store` → Cloudflare, wildcard `*.letbuyy.store` | ✅ Done |
| Shared packages | 🟡 Medium | `packages/ui`, `packages/utils`, `packages/types` | ✅ Done |
| Environment management | 🔴 Critical | `.env` files per app, Vercel env vars, Workers secrets | ✅ Done |

**Monorepo Structure:**

```
Letbuyy_Store/
├── apps/
│   ├── web/
│   │   ├── accounts/     # Auth portal (Next.js 15)
│   │   ├── admin/        # Admin dashboard (Next.js 15)
│   │   └── storefront/   # Public storefronts (Next.js 15)
│   ├── mobile/
│   │   ├── marketplace/  # Customer app (Flutter)
│   │   ├── admin/        # Admin app (Flutter)
│   │   ├── delivery/     # Delivery app (Flutter)
│   │   └── analyzer/     # Trading analyzer (Flutter)
│   └── super-admin/      # Super admin console (Flutter)
├── packages/
│   ├── api/              # Cloudflare Workers API (Hono)
│   ├── ui/               # Shared UI components
│   ├── utils/            # Shared utilities
│   └── types/            # Shared TypeScript types
├── docs/                 # This documentation (12 files)
├── supabase/             # Migrations, seed data
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### 3.2 Week 2 — Authentication System

| Task | Priority | Details | Status |
|---|---|---|---|
| Supabase Auth integration | 🔴 Critical | Email/password + Google OAuth + OTP (magic link) | ✅ Done |
| Signup flow | 🔴 Critical | Email verification → profile creation → redirect | ✅ Done |
| Login flow | 🔴 Critical | Credentials → JWT → session cookie → dashboard redirect | ✅ Done |
| Session middleware | 🔴 Critical | JWT validation on every API request | ✅ Done |
| Password reset | 🟡 Medium | Reset email → new password form | ✅ Done |
| `profiles` table | 🔴 Critical | `id`, `email`, `full_name`, `avatar_url`, `role`, `is_2fa_enabled` | ✅ Done |
| RLS on profiles | 🔴 Critical | Users can only read/update own profile | ✅ Done |
| Accounts app UI | 🔴 Critical | Login/signup pages with dark/light mode, responsive | ✅ Done |

> **Reference:** [02 Authentication & Security](./02_Authentication_and_Security.md) for complete auth architecture.

### 3.3 Week 3 — Onboarding & Store Creation

| Task | Priority | Details | Status |
|---|---|---|---|
| 4-step onboarding wizard | 🔴 Critical | Site type → Store details → Design → Launch | ✅ Done |
| Store creation API | 🔴 Critical | Create store, assign subdomain, initialize config | ✅ Done |
| Subdomain provisioning | 🔴 Critical | `{store-name}.letbuyy.store` with Cloudflare wildcard DNS | ✅ Done |
| Trial system | 🔴 Critical | 7-day free trial with feature access | ✅ Done |
| `stores` table | 🔴 Critical | Full schema with `site_type`, `subdomain`, `theme_config`, `plan` | ✅ Done |
| Store context middleware | 🔴 Critical | Extract store from subdomain/header on every request | ✅ Done |
| "Launching Soon" page | 🟡 Medium | Placeholder storefront before setup complete | ✅ Done |

> **Reference:** [03 Onboarding & Trial](./03_Onboarding_and_Trial.md) for complete onboarding flow.

### 3.4 Week 4 — API Layer & Security

| Task | Priority | Details | Status |
|---|---|---|---|
| Hono API framework | 🔴 Critical | Route structure, middleware stack, error handling | ✅ Done |
| RLS policies (all tables) | 🔴 Critical | Store isolation via `store_id` in every policy | ✅ Done |
| Rate limiting | 🔴 Critical | Upstash Redis sliding window (60 req/min default) | ✅ Done |
| CORS configuration | 🔴 Critical | Allow Vercel domains + custom domains | ✅ Done |
| CI/CD pipeline | 🔴 Critical | GitHub Actions → lint + type check + build → Vercel + Workers | ✅ Done |
| API error handling | 🟡 Medium | Consistent error response format, Sentry integration | ✅ Done |
| Seed data | 🟡 Medium | Demo store with sample products, pages | ✅ Done |
| Documentation | 🟢 Low | API endpoint documentation (this doc series) | ✅ Done |

> **Reference:** [09 API Reference](./09_API_Reference.md) for complete API architecture.

### 3.5 Phase 1 — Definition of Done

```
✅ Phase 1 Complete when:
├── accounts.letbuyy.store — Login/signup working with Google OAuth + email
├── api.letbuyy.store — Workers API returning 200 on /health
├── Admin redirect — After login, redirects to admin dashboard shell
├── Store creation — 4-step wizard creates store + assigns subdomain
├── Database — Core tables created with RLS policies verified
├── Trial system — 7-day countdown active on new stores
├── CI/CD — Push to main → auto-deploys to Vercel + Cloudflare
├── Rate limiting — 429 returned after 60 requests/minute
└── Monitoring — Sentry capturing errors, UptimeRobot pinging endpoints
```

---

## 4. Phase 2: Core Features (Weeks 5–10)

### Milestone: 📊 "Admin Dashboard Functional" + 🎨 "All Site Types Live"

### 4.1 Week 5–6 — Admin Dashboard

| Task | Priority | Details | Status |
|---|---|---|---|
| Dashboard layout | 🔴 Critical | Sidebar + header + main canvas, responsive | ✅ Done |
| Dynamic navigation | 🔴 Critical | Nav items change based on `site_type` (Store/Portfolio/Resume/Landing/Blog) | ✅ Done |
| Overview page | 🔴 Critical | Stats cards (products, orders, revenue, visitors) | ✅ Done |
| Settings panel | 🔴 Critical | Store info, contact, social links, domain, theme | ✅ Done |
| Profile settings | 🟡 Medium | Update name, email, avatar, password | ✅ Done |
| Billing page | 🟡 Medium | Current plan, usage, upgrade/downgrade, invoices | ✅ Done |
| Notification center | 🟡 Medium | In-app notifications with real-time updates | ✅ Done |
| Dark/light mode | 🟡 Medium | Theme toggle with system preference detection | ✅ Done |

> **Reference:** [04 Admin Dashboard](./04_Admin_Dashboard.md) for complete dashboard architecture.

### 4.2 Week 7–8 — Page Builder & Theme Engine

| Task | Priority | Details | Status |
|---|---|---|---|
| Craft.js integration | 🔴 Critical | Drag-and-drop page builder with 23 components | ✅ Done |
| Theme engine | 🔴 Critical | `ThemeConfig` → CSS Custom Properties generation | ✅ Done |
| Template gallery | 🔴 Critical | 12 starter templates (3 per site type) | ✅ Done |
| Live theme customizer | 🔴 Critical | Real-time preview of color/font/layout changes | ✅ Done |
| Page CRUD | 🔴 Critical | Create, edit, reorder, publish/draft pages | ✅ Done |
| `pages` table | 🔴 Critical | `title`, `slug`, `content` (Craft.js JSON), `is_published`, `seo_*` | ✅ Done |
| Component library | 🟡 Medium | Hero, ProductGrid, Testimonials, FAQ, CTA, Gallery, etc. | ✅ Done |
| Image upload | 🟡 Medium | Upload to Cloudflare R2, auto-resize, WebP conversion | ✅ Done |

> **Reference:** [10 Storefront & Themes](./10_Storefront_and_Themes.md) for complete theme and page builder architecture.

### 4.3 Week 9 — Portfolio & Resume Builders

| Task | Priority | Details | Status |
|---|---|---|---|
| Portfolio projects CRUD | 🔴 Critical | Title, description, images, tags, links, display order | ✅ Done |
| Skills management | 🔴 Critical | Category, proficiency (0-100), display order | ✅ Done |
| Education section | 🟡 Medium | Institution, degree, dates, GPA, highlights | ✅ Done |
| Work experience | 🟡 Medium | Company, role, dates, bullets, location | ✅ Done |
| Certifications | 🟡 Medium | Name, issuer, date, credential URL | ✅ Done |
| Resume PDF export | 🔴 Critical | Professional PDF from structured data (react-pdf) | ✅ Done |
| Contact form | 🟡 Medium | Public contact form → email notification | ✅ Done |
| Portfolio storefront | 🔴 Critical | Responsive portfolio site with project gallery | ✅ Done |
| Resume storefront | 🔴 Critical | Responsive resume site with downloadable PDF | ✅ Done |

> **Reference:** [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) for complete portfolio/resume architecture.

### 4.4 Week 10 — Landing Page Builder & Storefront Rendering

| Task | Priority | Details | Status |
|---|---|---|---|
| Landing page mode | 🔴 Critical | Single-page site with section-based builder | ✅ Done |
| Storefront SSR | 🔴 Critical | Server-side rendering with ISR for product pages | ✅ Done |
| Multi-tenant routing | 🔴 Critical | Subdomain → store resolution → correct content | ✅ Done |
| SEO meta generation | 🟡 Medium | Dynamic `<title>`, `<meta>`, Open Graph tags | ✅ Done |
| Sitemap generation | 🟡 Medium | Auto-generated XML sitemap per store | ✅ Done |
| JSON-LD structured data | 🟡 Medium | Product, Organization, Breadcrumbs schemas | ✅ Done |
| 404/500 custom pages | 🟢 Low | Branded error pages per store | ✅ Done |

### 4.5 Phase 2 — Definition of Done

```
✅ Phase 2 Complete when:
├── Admin dashboard — Full layout with dynamic navigation by site type
├── Page builder — Drag-and-drop with 23 components, save/load working
├── Theme engine — Color/font changes reflected in live preview + storefront
├── Templates — 12 templates installable on new stores
├── Portfolio — Projects/skills/education CRUD → public portfolio page
├── Resume — Structured data → PDF export → public resume page
├── Landing page — Section builder → public single-page site
├── Storefront — SSR rendering with SEO tags for all site types
├── Image upload — R2 storage with auto-resize and CDN delivery
└── Database — pages, projects, skills, education, work_experience tables live
```

---

## 5. Phase 3: E-Commerce Engine (Weeks 11–16)

### Milestone: 🛒 "First Sale"

### 5.1 Week 11–12 — Product Management

| Task | Priority | Details | Status |
|---|---|---|---|
| Product CRUD | 🔴 Critical | Title, description, price, images, category, status | ✅ Done |
| Variant system | 🔴 Critical | Size/Color/Material with independent pricing and stock | ✅ Done |
| Image gallery | 🔴 Critical | Multi-image upload, reorder, thumbnail generation | ✅ Done |
| Category management | 🔴 Critical | Hierarchical categories with slug generation | ✅ Done |
| Collection system | 🟡 Medium | Curated product groups (manual + auto-rules) | ✅ Done |
| Bulk import (CSV) | 🟡 Medium | Upload CSV → validate → create products in batch | ✅ Done |
| Product search | 🟡 Medium | Full-text search with trigram matching | ✅ Done |
| `products`, `variants`, `categories`, `collections` tables | 🔴 Critical | Full schemas with RLS | ✅ Done |

### 5.2 Week 13 — Inventory & Customer Management

| Task | Priority | Details | Status |
|---|---|---|---|
| Inventory tracking | 🔴 Critical | Stock levels per variant, auto-decrement on order | ✅ Done |
| Low stock alerts | 🟡 Medium | Configurable threshold → email + in-app notification | ✅ Done |
| Customer profiles | 🔴 Critical | Auto-created on first order, addresses, order history | ✅ Done |
| Customer list view | 🟡 Medium | Search, filter, sort, export | ✅ Done |
| Customer segments | 🟢 Low | Recent buyers, high-value, one-time, etc. | 🔮 Phase 6 |
| `inventory_logs`, `customers`, `addresses` tables | 🔴 Critical | Full schemas | ✅ Done |

### 5.3 Week 14 — Cart & Checkout

| Task | Priority | Details | Status |
|---|---|---|---|
| Cart management | 🔴 Critical | Add/remove/update items, Zustand + localStorage | ✅ Done |
| Cart drawer UI | 🔴 Critical | Slide-out cart with quantity controls | ✅ Done |
| Checkout flow | 🔴 Critical | 3-step: Shipping → Payment → Confirmation | ✅ Done |
| Guest checkout | 🟡 Medium | Purchase without account creation | ✅ Done |
| Address management | 🟡 Medium | Save/select shipping addresses | ✅ Done |
| Cart server sync | 🟡 Medium | Sync cart state to `carts` table for logged-in users | ✅ Done |
| Checkout validation | 🔴 Critical | Stock check, price verification at checkout time | ✅ Done |

### 5.4 Week 15 — Payment Integration

| Task | Priority | Details | Status |
|---|---|---|---|
| Razorpay integration | 🔴 Critical | Orders API + checkout.js + webhooks (India) | ✅ Done |
| Stripe integration | 🔴 Critical | PaymentIntent API + Elements + webhooks (Global) | ✅ Done |
| Webhook handlers | 🔴 Critical | `payment.captured` → update order status + inventory | ✅ Done |
| Webhook signature verification | 🔴 Critical | HMAC-SHA256 validation for Razorpay | ✅ Done |
| Payment status tracking | 🔴 Critical | Pending → Processing → Completed → Failed | ✅ Done |
| Refund processing | 🟡 Medium | Partial/full refund via payment gateway API | ✅ Done |
| `payments` table | 🔴 Critical | Gateway, transaction ID, amount, status, metadata | ✅ Done |

### 5.5 Week 16 — Orders, Shipping & Coupons

| Task | Priority | Details | Status |
|---|---|---|---|
| Order management | 🔴 Critical | List view with filters, detail page, status updates | ✅ Done |
| Order lifecycle | 🔴 Critical | Pending → Confirmed → Shipped → Delivered → Completed | ✅ Done |
| Email notifications | 🔴 Critical | Order confirmation, shipping update, delivery, review request | ✅ Done |
| Shipping zones | 🟡 Medium | Zone-based pricing (state/region/country) | ✅ Done |
| Shipping rates | 🟡 Medium | Flat rate, weight-based, free shipping thresholds | ✅ Done |
| Coupon system | 🟡 Medium | 5 types: percentage, fixed, free shipping, BOGO, bulk | ✅ Done |
| Coupon validation | 🟡 Medium | Min order, max uses, date range, first-order-only | ✅ Done |
| `orders`, `order_items`, `shipping_zones`, `coupons` tables | 🔴 Critical | Full schemas | ✅ Done |

> **Reference:** [05 E-Commerce Engine](./05_Ecommerce_Engine.md) for complete e-commerce architecture.

### 5.6 Phase 3 — Definition of Done

```
✅ Phase 3 Complete when:
├── Products — Full CRUD with variants, images, categories, collections
├── Inventory — Stock tracking with auto-decrement and low-stock alerts
├── Cart — Add/remove/update, persistent, sync to server for logged-in users
├── Checkout — 3-step flow: Shipping → Payment → Confirmation
├── Payments — Razorpay (India) + Stripe (Global) live with webhooks
├── Orders — Full lifecycle management with email notifications
├── Shipping — Zone-based pricing with free shipping thresholds
├── Coupons — 5 discount types with validation rules
├── Customers — Auto-created profiles with order history
└── End-to-end test — Browse → Add to Cart → Checkout → Pay → Order Created
```

---

## 6. Phase 4: AI Integration (Weeks 17–20)

### Milestone: 🤖 "AI-Powered Platform"

### 6.1 Week 17 — AI Infrastructure

| Task | Priority | Details | Status |
|---|---|---|---|
| AI Gateway (Worker) | 🔴 Critical | Centralized AI request routing with provider abstraction | ✅ Done |
| Provider integration | 🔴 Critical | Google Gemini 2.0 Flash (primary), with fallback chain | ✅ Done |
| Credit system | 🔴 Critical | Per-store AI credits allocation, tracking, alerts | ✅ Done |
| Response caching | 🔴 Critical | Upstash Redis cache for identical prompts (TTL: 24h) | ✅ Done |
| Streaming support | 🟡 Medium | SSE streaming for real-time AI generation in UI | ✅ Done |
| Rate limiting (AI) | 🟡 Medium | Per-store AI request limits by plan | ✅ Done |
| `ai_usage_logs`, `ai_content_cache` tables | 🔴 Critical | Full schemas with indexes | ✅ Done |

### 6.2 Week 18 — Product & E-Commerce AI

| Task | Priority | Details | Status |
|---|---|---|---|
| Product description generator | 🔴 Critical | Title + specs → SEO-optimized description | ✅ Done |
| SEO meta generator | 🔴 Critical | Product/page → meta title, description, keywords | ✅ Done |
| Smart pricing suggestions | 🟡 Medium | Market-aware pricing recommendations | ✅ Done |
| Image alt text generator | 🟡 Medium | Product image → descriptive alt text | ✅ Done |
| Bulk AI generation | 🟡 Medium | Generate descriptions for multiple products at once | ✅ Done |
| AI Studio UI | 🔴 Critical | Dedicated AI workspace in admin dashboard | ✅ Done |

### 6.3 Week 19 — Portfolio, Resume & Content AI

| Task | Priority | Details | Status |
|---|---|---|---|
| Portfolio description AI | 🔴 Critical | Project details → polished descriptions | ✅ Done |
| Resume bullet improver | 🔴 Critical | Weak bullets → impactful, metrics-driven bullets | ✅ Done |
| ATS score analyzer | 🔴 Critical | Resume vs job description → compatibility score | ✅ Done |
| Blog post generator | 🟡 Medium | Topic → full blog post with images and SEO | ✅ Done |
| Page builder AI blocks | 🟡 Medium | AI-generated hero text, testimonials, FAQ content | ✅ Done |
| Tone/style customization | 🟡 Medium | Professional, casual, creative, technical tone options | ✅ Done |

### 6.4 Week 20 — Moderation & Analytics AI

| Task | Priority | Details | Status |
|---|---|---|---|
| Content moderation pipeline | 🔴 Critical | 3-stage: rule-based → AI classification → human review | ✅ Done |
| NSFW image detection | 🔴 Critical | AI-powered image safety scoring | ✅ Done |
| Fraud detection | 🟡 Medium | Signup spam, fake stores, payment fraud scoring | ✅ Done |
| Admin AI insights | 🟡 Medium | Natural language analytics summaries | ✅ Done |
| Weekly AI reports | 🟡 Medium | Auto-generated platform health reports | ✅ Done |
| AI chatbot (v1) | 🟢 Low | Customer-facing chatbot for store FAQ | 🔮 Phase 6 |

> **Reference:** [07 AI Features](./07_AI_Features.md) for complete AI architecture.

### 6.5 Phase 4 — Definition of Done

```
✅ Phase 4 Complete when:
├── AI Gateway — Centralized routing with Gemini 2.0 Flash + fallback
├── Credits — Per-store allocation, tracking, plan-based limits
├── Caching — Redis cache reducing API costs by 40%+
├── Product AI — Description, SEO, pricing, alt text generation
├── Portfolio/Resume AI — Bullet improvement, ATS scoring
├── Blog AI — Full post generation with images
├── Content Moderation — 3-stage pipeline (auto-approve/reject/review)
├── AI Studio — Dedicated UI workspace in admin dashboard
└── Streaming — SSE responses for real-time AI generation
```

---

## 7. Phase 5: Polish & Launch (Weeks 21–24)

### Milestone: 🚀 "Soft Launch"

### 7.1 Week 21 — Super Admin Console

| Task | Priority | Details | Status |
|---|---|---|---|
| Console authentication | 🔴 Critical | VPN + 2FA + IP allowlist | ✅ Done |
| Store management | 🔴 Critical | List/view/suspend/delete/impersonate | ✅ Done |
| User management | 🔴 Critical | List/view/disable/export | ✅ Done |
| Team management | 🟡 Medium | Invite/roles/permissions | ✅ Done |
| Moderation UI | 🔴 Critical | Queue view with AI analysis | ✅ Done |
| Platform analytics dashboard | 🔴 Critical | Growth, revenue, engagement metrics | ✅ Done |
| Audit log viewer | 🟡 Medium | Filterable log explorer | ✅ Done |

> **Reference:** [11 Super Admin & Team](./11_Super_Admin_and_Team.md) for complete super admin architecture.

### 7.2 Week 22 — E2E Testing & QA

| Task | Priority | Details | Status |
|---|---|---|---|
| Unit tests | 🔴 Critical | Core business logic (70% coverage target) | 🔄 In Progress |
| Integration tests | 🔴 Critical | API endpoint testing with test DB | 🔄 In Progress |
| E2E tests (Playwright) | 🔴 Critical | Critical flows (signup, onboarding, checkout, dashboard) | 🔄 In Progress |
| Cross-browser testing | 🟡 Medium | Chrome, Firefox, Safari, Edge | 🔄 In Progress |
| Mobile responsive testing | 🟡 Medium | iOS Safari, Android Chrome (real devices) | 🔄 In Progress |
| Accessibility audit | 🟡 Medium | axe-core + manual screen reader testing | 🔄 In Progress |
| Bug bash | 🟡 Medium | Team-wide exploratory testing session | 📋 Planned |

### 7.3 Week 23 — Performance & Security

| Task | Priority | Details | Status |
|---|---|---|---|
| Lighthouse optimization | 🔴 Critical | Performance, Accessibility, SEO > 90 | 🔄 In Progress |
| Bundle analysis | 🟡 Medium | Tree-shaking, code splitting, lazy loading | 🔄 In Progress |
| Image optimization | 🟡 Medium | WebP conversion, responsive srcset, lazy loading | ✅ Done |
| Security audit | 🔴 Critical | OWASP Top 10, RLS penetration testing | 📋 Planned |
| Load testing | 🔴 Critical | Simulate 1,000 concurrent users (k6) | 📋 Planned |
| API rate limiting verification | 🟡 Medium | Verify all endpoints respect rate limits | 📋 Planned |
| Dependency audit | 🟡 Medium | `npm audit`, outdated package review | 📋 Planned |
| SSL/TLS verification | 🔴 Critical | All domains have valid certificates | ✅ Done |

### 7.4 Week 24 — Launch Preparation

| Task | Priority | Details | Status |
|---|---|---|---|
| Landing page deployment | 🔴 Critical | letbuyy.store → marketing site live | ✅ Done |
| Documentation review | 🟡 Medium | All 12 docs reviewed and accurate | 🔄 In Progress |
| Legal pages | 🔴 Critical | Privacy Policy, Terms, Refund Policy | ✅ Done |
| Support email setup | 🔴 Critical | support@letbuyy.store → ticketing system | 📋 Planned |
| Analytics tracking | 🟡 Medium | GA4 + PostHog on all apps | 📋 Planned |
| Monitoring setup | 🔴 Critical | Sentry (errors), UptimeRobot (uptime), Grafana (metrics) | 📋 Planned |
| Backup strategy | 🔴 Critical | Supabase auto-backup + manual snapshot | ✅ Done |
| Soft launch | 🔴 Critical | Invite 10-20 beta users | 📋 Planned |

### 7.5 Phase 5 — Definition of Done

```
✅ Phase 5 Complete when:
├── Super admin — Console deployed with full store/user management
├── Testing — Unit (70%+), Integration, E2E for critical paths
├── Performance — Lighthouse > 90 on all storefront pages
├── Security — OWASP audit passed, RLS policies verified
├── Load test — 1,000 concurrent users without degradation
├── Legal — Privacy Policy, Terms, Refund Policy published
├── Monitoring — Sentry + UptimeRobot + Grafana dashboards live
├── Landing page — letbuyy.store marketing site deployed
├── Documentation — All 12 docs current and published
└── Beta users — 10-20 real users onboarded and providing feedback
```

---

## 8. Phase 6: Growth & Scale (Weeks 25+)

### Milestone: 📈 "Product-Market Fit"

### 8.1 Growth Roadmap

| Quarter | Priority | Features | Status |
|---|---|---|---|
| **Q3 2026** | 🔴 High | Flutter admin app (Play Store), custom domains (SSL), blog system | 📋 Planned |
| **Q3 2026** | 🟡 Medium | Advanced analytics, customer reviews, multi-image variants | 📋 Planned |
| **Q4 2026** | 🔴 High | Multi-language storefronts (i18n), PWA storefronts, AI chatbot v2 | 📋 Planned |
| **Q4 2026** | 🟡 Medium | Abandoned cart recovery, loyalty program, A/B testing | 📋 Planned |
| **Q1 2027** | 🟡 Medium | Marketplace (third-party themes/apps), multi-vendor mode | 📋 Planned |
| **Q1 2027** | 🟢 Low | API for third-party integrations, Zapier connector | 📋 Planned |
| **Q2 2027** | 🟢 Low | White-label option, enterprise features | 📋 Planned |

### 8.2 Feature Priority Matrix

```
                    HIGH IMPACT
                        │
            ┌───────────┼───────────┐
            │ Flutter   │ Custom    │
            │ Admin App │ Domains   │
   LOW      │           │           │    HIGH
   EFFORT ──┤ Blog      │ PWA       ├── EFFORT
            │ System    │ Support   │
            │           │           │
            │ Reviews   │ i18n      │
            │           │ Multi-lang│
            ├───────────┼───────────┤
            │ A/B Tests │ Marketplace│
            │           │ Third-party│
            │           │ Apps      │
            └───────────┼───────────┘
                        │
                    LOW IMPACT
```

### 8.3 Detailed Feature Roadmap

#### 8.3.1 Flutter Admin App (Q3 2026)

| Deliverable | Timeline | Notes |
|---|---|---|
| App shell + auth | Week 25-26 | Login, biometrics, 2FA |
| Dashboard + stats | Week 27 | Key metrics cards |
| Product management | Week 28-29 | CRUD, camera upload |
| Order management | Week 29-30 | List, detail, status update |
| Push notifications | Week 30 | FCM for order alerts |
| Play Store release | Week 31 | Beta → Production |

#### 8.3.2 Custom Domains (Q3 2026)

| Deliverable | Timeline | Notes |
|---|---|---|
| Domain verification | Week 26 | TXT record check |
| SSL provisioning | Week 27 | Cloudflare for SaaS |
| DNS configuration UI | Week 27 | Step-by-step guide in admin |
| Auto-renewal | Week 28 | Certificate auto-rotate |
| Business+ plan gate | Week 28 | Premium feature |

#### 8.3.3 Blog System (Q3 2026)

| Deliverable | Timeline | Notes |
|---|---|---|
| Blog editor (rich text) | Week 28-29 | Tiptap/ProseMirror |
| Categories + tags | Week 29 | Blog taxonomy |
| Comments (moderated) | Week 30 | Optional, store-level toggle |
| Blog storefront pages | Week 30 | Listing + post templates |
| RSS feed generation | Week 31 | Auto-generated |
| AI blog post generation | Week 31 | Gemini integration |

---

## 9. Deployment Architecture

### 9.1 Infrastructure Diagram

```
                              USERS
                                │
                                ▼
                    ┌───────────────────────┐
                    │     Cloudflare CDN    │
                    │     (DNS + SSL +      │
                    │      WAF + Cache)     │
                    └─────────┬─────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌────────────────┐ ┌──────────┐ ┌────────────────┐
     │   Vercel        │ │ Cloudflare│ │   Vercel        │
     │  (Next.js Apps) │ │ Workers   │ │  (Storefront)   │
     │                 │ │ (API)     │ │                 │
     │ • accounts      │ │           │ │ • SSR/ISR       │
     │ • admin         │ │ • Hono    │ │ • Wildcard DNS  │
     │ • landing       │ │ • REST    │ │ • Multi-tenant  │
     └───────┬─────────┘ └─────┬─────┘ └───────┬─────────┘
             │                 │               │
             └─────────────────┼───────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
     ┌────────────────┐ ┌──────────┐ ┌────────────────┐
     │   Supabase      │ │ Upstash  │ │  Cloudflare R2  │
     │  (Database)      │ │ Redis    │ │  (Object Store) │
     │                 │ │          │ │                 │
     │ • PostgreSQL    │ │ • Cache  │ │ • Images        │
     │ • Auth          │ │ • Rate   │ │ • PDFs          │
     │ • RLS           │ │   Limit  │ │ • Exports       │
     │ • Realtime      │ │ • Session│ │ • Backups       │
     └────────────────┘ └──────────┘ └────────────────┘
              │
              ▼
     ┌────────────────┐       ┌────────────────┐
     │  External       │       │  Monitoring     │
     │  Services       │       │                 │
     │                 │       │ • Sentry        │
     │ • Razorpay      │       │ • UptimeRobot   │
     │ • Stripe        │       │ • Cloudflare    │
     │ • Resend        │       │   Analytics     │
     │ • Google AI     │       │ • PostHog       │
     └────────────────┘       └────────────────┘
```

### 9.2 Domain Architecture

| Domain | Service | Provider | Purpose |
|---|---|---|---|
| `letbuyy.store` | Landing page | Vercel | Marketing site |
| `accounts.letbuyy.store` | Auth portal | Vercel | Login, signup, password reset |
| `admin.letbuyy.store` | Admin dashboard | Vercel | Store management |
| `api.letbuyy.store` | REST API | Cloudflare Workers | Backend API |
| `*.letbuyy.store` | Storefronts | Vercel | Dynamic store rendering |
| `console.letbuyy.store` | Super admin | Vercel/Flutter Web | Platform management |
| `r2.letbuyy.store` | CDN / assets | Cloudflare R2 | Image/file delivery |
| `{custom-domain}` | Custom domains | Cloudflare for SaaS | Store owner domains |

---

## 10. CI/CD Pipeline

### 10.1 Pipeline Flow

```
Developer pushes code to GitHub
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  GitHub Actions — CI Pipeline                                 │
│                                                                │
│  ┌──────────────────┐                                         │
│  │  1. Lint          │  ESLint + Prettier check                │
│  │     (30s)         │  Fail fast on style violations          │
│  └────────┬─────────┘                                         │
│           ▼                                                    │
│  ┌──────────────────┐                                         │
│  │  2. Type Check    │  TypeScript strict mode                 │
│  │     (45s)         │  All apps + packages                    │
│  └────────┬─────────┘                                         │
│           ▼                                                    │
│  ┌──────────────────┐                                         │
│  │  3. Unit Tests    │  Vitest (packages + API)                │
│  │     (60s)         │  Coverage threshold: 70%                │
│  └────────┬─────────┘                                         │
│           ▼                                                    │
│  ┌──────────────────┐                                         │
│  │  4. Build         │  Turborepo parallel builds              │
│  │     (90s)         │  All apps + packages                    │
│  └────────┬─────────┘                                         │
│           ▼                                                    │
│  ┌──────────────────┐                                         │
│  │  5. E2E Tests     │  Playwright (critical paths only)       │
│  │     (120s)        │  Signup, login, checkout, dashboard     │
│  └────────┬─────────┘                                         │
│           │                                                    │
│           ▼                                                    │
│  ✅ All Pass → Deploy                                          │
│  ❌ Any Fail → Block merge, notify author                      │
└──────────────────────────────────────────────────────────────┘
         │
         ├── Push to feature branch → Vercel Preview Deploy (PR preview)
         │
         └── Merge to main → Production Deploy
                  │
                  ├── Vercel auto-deploy (Next.js apps)
                  │    ├── accounts → accounts.letbuyy.store
                  │    ├── admin → admin.letbuyy.store
                  │    └── storefront → *.letbuyy.store
                  │
                  └── Cloudflare (wrangler deploy)
                       └── API → api.letbuyy.store
```

### 10.2 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    needs: lint-and-typecheck
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test -- --coverage
      - uses: codecov/codecov-action@v3

  build:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  deploy-api:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          workingDirectory: packages/api
```

### 10.3 Turborepo Pipeline

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

---

## 11. Environment Strategy

### 11.1 Environment Configuration

| Environment | Purpose | URL | Deploy Trigger |
|---|---|---|---|
| **Local Development** | Developer workstation | `localhost:3000` (Next.js), `localhost:8787` (Workers) | Manual (`pnpm dev`) |
| **Preview** | PR review | `pr-{number}-{app}.vercel.app` | Auto on PR creation |
| **Staging** | Pre-production testing | `staging.letbuyy.store` | Merge to `develop` branch |
| **Production** | Live platform | `letbuyy.store` + all subdomains | Merge to `main` branch |

### 11.2 Environment Variables per App

| Variable | Local | Staging | Production |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Local Supabase | Staging project | Production project |
| `SUPABASE_SERVICE_ROLE_KEY` | Local key | Staging key | Production key (Vault) |
| `NEXT_PUBLIC_API_URL` | `localhost:8787` | `staging-api.letbuyy.store` | `api.letbuyy.store` |
| `RAZORPAY_KEY_ID` | Test key | Test key | Live key |
| `RAZORPAY_KEY_SECRET` | Test secret | Test secret | Live secret (Vault) |
| `STRIPE_SECRET_KEY` | `sk_test_*` | `sk_test_*` | `sk_live_*` (Vault) |
| `GOOGLE_AI_API_KEY` | Dev key | Dev key | Production key (Vault) |
| `UPSTASH_REDIS_URL` | Local Redis | Staging Redis | Production Redis |
| `RESEND_API_KEY` | Sandbox | Sandbox | Production key |
| `SENTRY_DSN` | — | Staging DSN | Production DSN |

### 11.3 Database Strategy

| Environment | Database | Migrations | Seed Data |
|---|---|---|---|
| **Local** | Local Supabase (Docker) | Applied manually | Full seed data |
| **Staging** | Supabase staging project | Auto on deploy | Anonymized production subset |
| **Production** | Supabase production project | Manual with approval | No seed data |

```
Migration workflow:
1. Developer creates migration: supabase migration new <name>
2. Write SQL migration file
3. Test locally: supabase db reset
4. PR review includes migration file
5. Merge → staging auto-applies
6. Manual approval → production apply
```

---

## 12. Infrastructure Stack

### 12.1 Complete Service Map

| Layer | Service | Provider | Plan | Purpose |
|---|---|---|---|---|
| **Frontend** | Next.js 15 (App Router) | Vercel | Pro ($20/mo) | SSR/ISR web apps |
| **API** | Hono (REST) | Cloudflare Workers | Workers Paid ($5/mo) | Edge API (0ms cold start) |
| **Database** | PostgreSQL 16 | Supabase | Pro ($25/mo) | Primary data store + Auth |
| **Cache** | Redis | Upstash | Pay-per-use | AI cache, rate limiting, sessions |
| **Object Storage** | R2 | Cloudflare | Free (10GB) | Images, PDFs, exports |
| **CDN** | Cloudflare CDN | Cloudflare | Free | Static assets, DNS, SSL |
| **DNS** | Cloudflare DNS | Cloudflare | Free | Domain management, wildcard |
| **Email** | Resend | Resend | Free (100/day) | Transactional emails |
| **Payments (India)** | Razorpay | Razorpay | 2% per txn | INR payments |
| **Payments (Global)** | Stripe | Stripe | 2.9% + 30¢ | USD/EUR payments |
| **AI** | Gemini 2.0 Flash | Google AI | Pay-per-use | Primary AI provider |
| **AI (fallback)** | Gemini 2.0 Flash Lite | Google AI | Pay-per-use | Fallback / moderation |
| **Error Tracking** | Sentry | Sentry | Free (5K events) | Error monitoring |
| **Uptime** | UptimeRobot | UptimeRobot | Free (50 monitors) | Endpoint monitoring |
| **Analytics** | PostHog | PostHog Cloud | Free (1M events) | Product analytics |
| **Push Notifications** | FCM | Firebase | Free | Mobile push |

### 12.2 Tech Stack Justification

| Choice | Why This | Alternatives Considered |
|---|---|---|
| **Next.js 15** | SSR/ISR for storefronts, App Router for admin, React ecosystem | Remix, Nuxt, SvelteKit |
| **Hono on Workers** | 0ms cold start, global edge, cheap, Cloudflare ecosystem | Express on Vercel Serverless, Fastify |
| **Supabase** | Postgres + Auth + RLS + Realtime in one, generous free tier | PlanetScale, Neon, Firebase |
| **Upstash Redis** | Serverless Redis (no connection management), pay-per-use | Redis Cloud, Momento |
| **Cloudflare R2** | S3-compatible, zero egress fees, same ecosystem | AWS S3, Supabase Storage |
| **Gemini 2.0 Flash** | Best price/performance for AI features, large context window | GPT-4o-mini, Claude 3 Haiku |
| **Razorpay** | Market leader for India payments, UPI support | Cashfree, PayU |
| **Turborepo** | Incremental builds, caching, pnpm workspace support | Nx, Lerna |

---

## 13. Testing Strategy

### 13.1 Testing Pyramid

```
                    ┌──────────┐
                    │   E2E    │  5-10 critical user flows
                    │ Playwright│  (Signup, Checkout, Dashboard)
                    │  (slow)  │
                  ┌─┴──────────┴─┐
                  │  Integration  │  API endpoint testing
                  │   (Vitest +   │  Database interactions
                  │   Supertest)  │  Middleware validation
                ┌─┴──────────────┴─┐
                │     Unit Tests    │  Business logic
                │     (Vitest)      │  Utils, validators
                │    (fast, many)   │  Schema validation
                └───────────────────┘
```

### 13.2 Testing Coverage Targets

| Layer | Target | Tools | What's Tested |
|---|---|---|---|
| **Unit** | 70% | Vitest | Validation schemas, utils, business logic, helpers |
| **Integration** | Key paths | Vitest + Supertest | API routes, middleware, DB queries, webhooks |
| **E2E** | Critical flows | Playwright | Signup, login, onboarding, product CRUD, checkout |
| **Visual** | Components | Storybook + Chromatic | UI component regression |
| **Accessibility** | All pages | axe-core + Pa11y | WCAG 2.1 AA compliance |
| **Performance** | Storefronts | Lighthouse CI | Scores > 90 threshold |
| **Load** | Pre-launch | k6 | 1,000 concurrent users, p99 < 500ms |

### 13.3 E2E Test Scenarios

| Flow | Steps | Priority |
|---|---|---|
| **Signup to Store** | Sign up → verify email → onboarding → store created | 🔴 Critical |
| **Login** | Email/password login → redirect to admin dashboard | 🔴 Critical |
| **Product Lifecycle** | Create product → add variants → publish → view on storefront | 🔴 Critical |
| **Purchase Flow** | Browse → add to cart → checkout → pay (test mode) → order created | 🔴 Critical |
| **Page Builder** | Open builder → add blocks → customize → save → view on storefront | 🟡 Medium |
| **Portfolio** | Add project → set skills → view public portfolio | 🟡 Medium |
| **Resume PDF** | Add work experience → generate PDF → download | 🟡 Medium |
| **AI Generation** | Open AI Studio → generate product description → apply | 🟡 Medium |
| **Theme Change** | Open customizer → change colors → save → verify storefront | 🟢 Low |
| **Coupon Flow** | Create coupon → apply at checkout → verify discount | 🟡 Medium |

---

## 14. Monitoring & Observability

### 14.1 Monitoring Stack

```
┌──────────────────────────────────────────────────────────────┐
│                    MONITORING LAYERS                          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Layer 1: UPTIME MONITORING (UptimeRobot)                 ││
│  │ • letbuyy.store              — 1 min interval            ││
│  │ • api.letbuyy.store/health   — 1 min interval            ││
│  │ • accounts.letbuyy.store     — 5 min interval            ││
│  │ • admin.letbuyy.store        — 5 min interval            ││
│  │ • Alert: Slack + Email on downtime                       ││
│  └──────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Layer 2: ERROR TRACKING (Sentry)                         ││
│  │ • Client-side errors (Next.js apps)                      ││
│  │ • Server-side errors (API Workers)                       ││
│  │ • Source maps uploaded for readable stack traces          ││
│  │ • Alert: Slack on new error type or error spike           ││
│  └──────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Layer 3: PERFORMANCE (Cloudflare Analytics + Vercel)      ││
│  │ • Request volume, latency p50/p95/p99                    ││
│  │ • Worker CPU time                                         ││
│  │ • Cache hit rate                                          ││
│  │ • Vercel function duration + cold starts                  ││
│  └──────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Layer 4: PRODUCT ANALYTICS (PostHog)                      ││
│  │ • Feature usage, user flows, retention                    ││
│  │ • Funnel analysis (signup → onboarding → first sale)     ││
│  │ • Session recording (opt-in, GDPR compliant)             ││
│  └──────────────────────────────────────────────────────────┘│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Layer 5: BUSINESS METRICS (Custom Dashboard)              ││
│  │ • MRR, ARR, churn, trial conversion                       ││
│  │ • Store growth, AI usage, support tickets                 ││
│  │ • Weekly AI-generated operational reports                 ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

### 14.2 Health Check Endpoint

```typescript
// packages/api/src/routes/health.ts
app.get('/health', async (c) => {
  const checks = await Promise.allSettled([
    c.get('supabase').from('stores').select('id').limit(1),  // DB check
    redis.ping(),                                             // Redis check
    fetch('https://r2.letbuyy.store/', { method: 'HEAD' }),  // R2 check
  ]);

  const status = {
    database: checks[0].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    redis: checks[1].status === 'fulfilled' ? 'healthy' : 'unhealthy',
    storage: checks[2].status === 'fulfilled' ? 'healthy' : 'unhealthy',
  };

  const allHealthy = Object.values(status).every(s => s === 'healthy');

  return c.json({
    status: allHealthy ? 'healthy' : 'degraded',
    services: status,
    version: '6.0.0',
    timestamp: new Date().toISOString(),
  }, allHealthy ? 200 : 503);
});
```

### 14.3 Alert Escalation

| Severity | Trigger | Response Time | Notification |
|---|---|---|---|
| **P0 — Outage** | All services down, payments broken | < 15 min | SMS + Call + Slack + Email |
| **P1 — Major** | One service down, degraded performance | < 1 hour | Slack + Email |
| **P2 — Minor** | Error spike, slow responses | < 4 hours | Slack |
| **P3 — Low** | Cosmetic issues, warnings | Next business day | Console |

---

## 15. Risk Management

### 15.1 Risk Register

| Risk | Probability | Impact | Mitigation | Contingency |
|---|---|---|---|---|
| **Supabase outage** | Low | 🔴 Critical | Monitor uptime, point-in-time recovery enabled | Read-only mode, cached responses |
| **AI API cost explosion** | Medium | 🟠 High | Credit limits, caching (40% hit rate), fallback to cheaper model | Disable AI features, switch to Gemini Lite |
| **Razorpay downtime** | Low | 🔴 Critical | Webhook retry queue, idempotent order creation | Stripe fallback, manual order processing |
| **Cloudflare Workers limit** | Low | 🟡 Medium | Monitor CPU usage, optimize hot paths | Increase plan, offload to Vercel Functions |
| **Data breach** | Very Low | 🔴 Critical | RLS, encryption at rest, audit logging, VPN | Incident response plan, GDPR notification < 72h |
| **Slow adoption** | Medium | 🟠 High | Free tier, onboarding optimization, content marketing | Pivot to specific niche, reduce burn rate |
| **Competitor feature gap** | Medium | 🟡 Medium | User feedback loop, rapid iteration, AI differentiation | Focus on underserved segments (India market) |
| **Scaling bottleneck** | Low | 🟠 High | Edge architecture (globally distributed), DB indexes | Horizontal read replicas, query optimization |
| **Key developer leaves** | Medium | 🟠 High | Documentation-driven development, code reviews | This doc series, onboarding guide |
| **Third-party API changes** | Medium | 🟡 Medium | Provider abstraction layer, pin API versions | Adapter pattern, swap providers |

### 15.2 Dependencies & Fallbacks

| Service | Primary | Fallback | Auto-Failover |
|---|---|---|---|
| **Database** | Supabase Postgres | — (point-in-time recovery) | Manual |
| **Cache** | Upstash Redis | In-memory LRU cache | Yes (automatic) |
| **AI Provider** | Gemini 2.0 Flash | Gemini 2.0 Flash Lite | Yes (automatic) |
| **Email** | Resend | Console notification (in-app) | Yes (error queue) |
| **Payments (India)** | Razorpay | — | Manual |
| **Payments (Global)** | Stripe | — | Manual |
| **Object Storage** | Cloudflare R2 | — (durable, 99.999999999%) | — |
| **DNS** | Cloudflare | — (99.99% SLA) | — |
| **Image Procesing** | Cloudflare Workers | Serve original image | Yes (automatic) |

---

## 16. Pre-Launch Checklist

### 16.1 Technical Readiness

| Category | Check | Status | Owner |
|---|---|---|---|
| **Database** | All migrations applied | 📋 | Backend |
| **Database** | RLS policies verified (test as different roles) | 📋 | Backend |
| **Database** | Indexes on hot queries verified | 📋 | Backend |
| **Database** | Point-in-time recovery enabled | ✅ | Backend |
| **API** | All endpoints returning correct responses | 📋 | Backend |
| **API** | Rate limiting active and tested | 📋 | Backend |
| **API** | Error responses follow standard format | 📋 | Backend |
| **API** | Webhook handlers idempotent | 📋 | Backend |
| **Frontend** | All pages render correctly (SSR + CSR) | 📋 | Frontend |
| **Frontend** | Mobile responsive verified (320px-2560px) | 📋 | Frontend |
| **Frontend** | Cross-browser tested (Chrome, Firefox, Safari, Edge) | 📋 | Frontend |
| **Frontend** | Lighthouse scores > 90 on all categories | 📋 | Frontend |
| **Auth** | Login/signup flow working end-to-end | ✅ | Backend |
| **Auth** | OAuth (Google) configured and tested | ✅ | Backend |
| **Auth** | Password reset flow tested | ✅ | Backend |
| **Auth** | 2FA enrollment and verification working | ✅ | Backend |
| **Payments** | Razorpay test transactions successful | 📋 | Backend |
| **Payments** | Stripe test transactions successful | 📋 | Backend |
| **Payments** | Webhook signature verification working | 📋 | Backend |
| **Infra** | DNS records configured correctly | ✅ | DevOps |
| **Infra** | SSL certificates valid on all domains | ✅ | DevOps |
| **Infra** | CDN caching configured | ✅ | DevOps |
| **Infra** | CI/CD pipeline deploying correctly | ✅ | DevOps |

### 16.2 Security Readiness

| Check | Status | Notes |
|---|---|---|
| OWASP Top 10 audit completed | 📋 | External or self-audit |
| SQL injection prevention (parameterized queries) | ✅ | Supabase client handles |
| XSS prevention (React auto-escaping + CSP) | ✅ | |
| CSRF protection (SameSite cookies) | ✅ | |
| RLS penetration testing (access as wrong user) | 📋 | |
| API authentication on all protected routes | ✅ | |
| Secret management (no secrets in code) | ✅ | Vercel env + Workers secrets |
| VPN access for super admin console | ✅ | Tailscale |
| Audit logging active | ✅ | |
| Content moderation pipeline active | ✅ | |

### 16.3 Business Readiness

| Check | Status | Notes |
|---|---|---|
| Privacy Policy published | ✅ | Legal review pending |
| Terms of Service published | ✅ | Legal review pending |
| Refund Policy published | ✅ | |
| Cookie consent banner implemented | ✅ | |
| Support email configured (support@letbuyy.store) | 📋 | |
| Payment gateway live mode verified | 📋 | |
| Email templates tested (all triggers) | 📋 | |
| Analytics tracking verified | 📋 | GA4 + PostHog |
| Landing page live and optimized | ✅ | |
| App Store assets prepared (Flutter app) | 📋 | Phase 6 |
| Social media accounts created | 📋 | |
| Documentation published and current | 🔄 | This document series |

---

## 17. Launch Playbook

### 17.1 Soft Launch (Week 24)

```
DAY 1 — PRE-LAUNCH (Monday)
├── Final staging verification
├── Production environment check
├── Backup current database state
├── Notify team: "Soft launch in 24 hours"
│
DAY 2 — LAUNCH DAY (Tuesday)
├── 09:00 — Deploy production (all services)
├── 09:15 — Smoke test all critical paths
│            ├── Signup → login → dashboard
│            ├── Create store → view storefront
│            ├── Add product → checkout → order
│            └── AI feature → generate description
├── 09:30 — Enable monitoring alerts
├── 10:00 — Invite first batch (5 beta users)
├── 14:00 — Monitor for issues, fix hotspots
├── 18:00 — Invite second batch (5 beta users)
│
DAY 3-5 — STABILIZATION (Wed-Fri)
├── Monitor error rates (target: < 0.1%)
├── Collect feedback from beta users
├── Fix critical bugs (same-day hotfix)
├── Document known issues
│
WEEK 2 — EXPANSION
├── Invite 20 more users
├── Social media soft announce
├── Collect testimonials
├── Iterate on feedback
│
WEEK 3 — PUBLIC LAUNCH
├── Landing page goes public
├── Product Hunt launch
├── Social media campaigns
├── Monitor scaling under real traffic
```

### 17.2 Rollback Procedure

| Scenario | Action | Time | Impact |
|---|---|---|---|
| **Frontend bug** | Vercel > instant rollback to previous deployment | < 1 min | Zero downtime |
| **API bug** | `wrangler rollback` to previous Worker version | < 30 sec | Zero downtime |
| **Database migration issue** | Run reverse migration SQL | 5-15 min | May require maintenance mode |
| **Payment webhook issue** | Disable webhook endpoint, manual processing | < 5 min | Orders delayed |
| **Full system failure** | Activate maintenance mode → investigate → rollback all | 15-30 min | Full downtime |

### 17.3 Post-Launch KPIs (First 30 Days)

| KPI | Target | Measurement |
|---|---|---|
| Signups | 50+ | Auth records |
| Stores created | 30+ | Stores table |
| Trial-to-paid conversion | > 15% | Billing dashboard |
| Average time to first store | < 3 min | Onboarding analytics |
| Customer support tickets | < 10/week | Support queue |
| Error rate | < 0.1% | Sentry |
| Uptime | > 99.9% | UptimeRobot |
| Lighthouse performance | > 90 | Lighthouse CI |
| NPS score | > 40 | User survey |

---

## 18. Cost Projections

### 18.1 Monthly Infrastructure Costs (INR)

| Service | Free Tier (0–50 stores) | Starter (50–200 stores) | Growth (200–1K stores) | Scale (1K–10K stores) |
|---|---|---|---|---|
| **Supabase** (Pro) | ₹0 | ₹2,100 | ₹6,300 | ₹25,200 |
| **Vercel** (Pro) | ₹0 | ₹1,680 | ₹2,520 | ₹12,600 |
| **Cloudflare Workers** (Paid) | ₹0 | ₹420 | ₹1,260 | ₹8,400 |
| **Upstash Redis** | ₹0 | ₹420 | ₹840 | ₹2,520 |
| **Resend** (Email) | ₹0 | ₹0 | ₹1,680 | ₹6,720 |
| **Google AI** (Gemini) | ₹0 | ₹4,200 | ₹33,600 | ₹2,52,000 |
| **Sentry** | ₹0 | ₹0 | ₹2,184 | ₹6,720 |
| **PostHog** | ₹0 | ₹0 | ₹0 | ₹3,360 |
| **Domain** (letbuyy.store) | ₹840/yr | ₹840/yr | ₹840/yr | ₹840/yr |
| | | | | |
| **Total Monthly** | **₹0** | **~₹8,820** | **~₹48,384** | **~₹3,17,520** |
| **USD Equivalent** | **$0** | **~$105** | **~$580** | **~$3,800** |

### 18.2 Cost Optimization Strategies

| Strategy | Savings | Implementation |
|---|---|---|
| **AI response caching** | 40-60% AI costs | Upstash Redis cache for identical prompts |
| **Image optimization** | 30% bandwidth | WebP conversion + responsive srcset |
| **CDN caching** | 50% origin requests | Cloudflare cache-everything + stale-while-revalidate |
| **ISR (stale-while-revalidate)** | 80% SSR compute | Vercel ISR for product/page pages |
| **AI model tiering** | 30% AI costs | Use Gemini Lite for moderation, Flash for generation |
| **Database connection pooling** | — | Supabase built-in pooler (PgBouncer) |
| **Edge caching** | 60% API latency | Workers KV for hot config data |

### 18.3 Break-Even Analysis

```
Monthly Fixed Costs:
├── Infrastructure (200 stores):     ₹48,384
├── Domain + Misc:                   ₹1,000
├── Total Fixed:                     ₹49,384
│
Revenue per Paid Store:
├── Starter Plan:     ₹499/mo
├── Professional:     ₹999/mo
├── Business:         ₹1,999/mo
├── Average ARPU:     ~₹800/mo (blended)
│
Break-Even Calculation:
├── Paid stores needed:  ₹49,384 ÷ ₹800 = ~62 paid stores
├── At 20% conversion:   62 ÷ 0.20 = ~310 total stores
├── Estimated timeline:  Month 4-5
│
Profitability Path:
├── 500 stores (20% paid = 100):  ₹80,000 revenue - ₹48,384 = ₹31,616 profit
├── 1K stores (25% paid = 250):   ₹2,00,000 revenue - ₹80,000 = ₹1,20,000 profit
└── 5K stores (30% paid = 1500):  ₹12,00,000 revenue - ₹2,50,000 = ₹9,50,000 profit
```

---

## 19. Revenue Model & Projections

### 19.1 Pricing Plans

| Plan | Price (INR) | Price (USD) | Target User | Key Features |
|---|---|---|---|---|
| **Free** | ₹0 | $0 | Trial users | 7-day trial, all features, 1 store |
| **Starter** | ₹499/mo | $5.99/mo | Freelancers, portfolios | 1 store, 100 products, 1K AI credits, letbuyy.store subdomain |
| **Professional** | ₹999/mo | $11.99/mo | Small businesses | 3 stores, 5K products, 5K AI credits, custom domain, priority support |
| **Business** | ₹1,999/mo | $23.99/mo | Growing businesses | 10 stores, unlimited products, 25K AI credits, API access, white-label |
| **Enterprise** | Custom | Custom | Large organizations | Unlimited everything, dedicated support, SLA |

### 19.2 Revenue Projections (INR)

| Milestone | Total Stores | Paid % | Paid Stores | ARPU | MRR | ARR |
|---|---|---|---|---|---|---|
| **Month 1** | 30 | 10% | 3 | ₹600 | ₹1,800 | ₹21,600 |
| **Month 3** | 150 | 15% | 23 | ₹700 | ₹16,100 | ₹1,93,200 |
| **Month 6** | 500 | 20% | 100 | ₹800 | ₹80,000 | ₹9,60,000 |
| **Month 12** | 2,000 | 25% | 500 | ₹850 | ₹4,25,000 | ₹51,00,000 |
| **Month 18** | 5,000 | 28% | 1,400 | ₹900 | ₹12,60,000 | ₹1,51,20,000 |
| **Month 24** | 10,000 | 30% | 3,000 | ₹950 | ₹28,50,000 | ₹3,42,00,000 |

### 19.3 Revenue Diversification

| Revenue Stream | % of Total | Description |
|---|---|---|
| **Subscription plans** | 60% | Primary SaaS revenue |
| **AI credit packs** | 15% | Top-up AI credits beyond plan limit |
| **Transaction fees** | 10% | 1% on e-commerce orders (Business+ plan waived) |
| **Custom domains** | 8% | ₹199/mo add-on for Professional plan |
| **Premium templates** | 5% | ₹299-999 one-time purchase |
| **Priority support** | 2% | ₹499/mo add-on for Starter plan |

### 19.4 Key SaaS Metrics Targets

| Metric | Month 6 | Month 12 | Month 24 | Industry Benchmark |
|---|---|---|---|---|
| **MRR** | ₹80K | ₹4.25L | ₹28.5L | — |
| **Monthly churn rate** | < 8% | < 5% | < 3% | 3-7% (SaaS) |
| **Trial → Paid conversion** | 15% | 20% | 25% | 15-25% |
| **Net Revenue Retention** | 100% | 110% | 120% | > 100% (good) |
| **LTV** | ₹5,600 | ₹10,200 | ₹22,800 | 3x CAC |
| **CAC** | ₹1,500 | ₹1,800 | ₹2,500 | < LTV/3 |
| **LTV:CAC Ratio** | 3.7:1 | 5.7:1 | 9.1:1 | > 3:1 (healthy) |
| **Payback period** | 2 months | 2.1 months | 2.6 months | < 12 months |

---

## 20. Team & Resource Planning

### 20.1 Current Team

| Role | Count | Focus Area |
|---|---|---|
| **Full-Stack Developer** (Lead) | 1 | Architecture, API, frontend, Flutter |
| | | |
| **Total** | **1** | Solopreneur phase |

### 20.2 Hiring Roadmap

| Phase | Hire | When | Priority | Monthly Cost (INR) |
|---|---|---|---|---|
| **MRR ₹50K** | Part-time support agent | Month 4 | 🔴 | ₹15,000 |
| **MRR ₹1L** | Junior frontend developer | Month 7 | 🔴 | ₹30,000 |
| **MRR ₹2L** | Backend/DevOps engineer | Month 10 | 🔴 | ₹45,000 |
| **MRR ₹5L** | Designer (UI/UX) | Month 14 | 🟡 | ₹40,000 |
| **MRR ₹5L** | Marketing / Growth | Month 15 | 🟡 | ₹35,000 |
| **MRR ₹10L** | Customer success manager | Month 18 | 🟡 | ₹35,000 |
| **MRR ₹20L** | Mobile developer (Flutter) | Month 20 | 🟢 | ₹50,000 |

### 20.3 Solo Developer Productivity Strategy

| Strategy | Implementation |
|---|---|
| **Documentation-driven** | This 12-doc series = complete blueprint before coding |
| **AI-assisted development** | Use Gemini/Claude for code generation, review, debugging |
| **Pre-built components** | shadcn/ui, Craft.js, React Hook Form, Zustand — don't reinvent |
| **Managed services** | Supabase Auth (not custom auth), Resend (not SMTP), R2 (not S3+CloudFront) |
| **Monorepo** | Share code across apps, single CI pipeline |
| **Edge-first** | Workers scale automatically, no server management |
| **Fast iteration** | 2-week sprints, ship features not perfection |
| **Community** | Open-source UI library, build in public for early adoption |

---

## 21. Document History

| Version | Date | Changes |
|---|---|---|
| 6.0 | Feb 15, 2026 | Major expansion — 21 sections, detailed sprint-level breakdown for all 6 phases with task tables (priority + status), Definition of Done per phase, development timeline with Gantt chart and 10 milestones, full infrastructure diagram (all services with connections), CI/CD pipeline (5-stage flow with GitHub Actions YAML and Turborepo config), complete environment strategy (4 envs, variable matrix, DB migration workflow), infrastructure stack (16 services with justification), testing strategy (pyramid, coverage targets, 10 E2E scenarios), monitoring stack (5 layers with health check TypeScript), risk management (10 risks with mitigation/contingency, 9 dependency fallbacks), comprehensive pre-launch checklist (23 technical + 10 security + 12 business items), launch playbook (day-by-day plan + rollback procedures + 9 post-launch KPIs), cost projections in INR (4 scale tiers, 7 optimization strategies, break-even analysis), revenue model (5 pricing plans, 6-milestone MRR projection, revenue diversification, SaaS metrics targets), team planning (hiring roadmap, solo productivity strategies) |
| 5.0 | Feb 14, 2026 | Initial version — 10 sections, basic phase timeline, weekly deliverable tables, deployment strategy, pre-launch checklist, cost projections |

---

> *This is the final document in the LetBuyy documentation series.*
>
> **Complete Documentation Index:**
>
> | # | Document | Lines | Focus |
> |---|---|---|---|
> | 00 | [Overview](./00_Overview.md) | 2,000+ | Platform vision, tech stack, feature map |
> | 01 | [Architecture](./01_Architecture.md) | 2,500+ | System design, infrastructure, data flow |
> | 02 | [Authentication & Security](./02_Authentication_and_Security.md) | 2,000+ | Auth flows, security, compliance |
> | 03 | [Onboarding & Trial](./03_Onboarding_and_Trial.md) | 2,000+ | User onboarding, trial management |
> | 04 | [Admin Dashboard](./04_Admin_Dashboard.md) | 2,500+ | Dashboard architecture, navigation |
> | 05 | [E-Commerce Engine](./05_Ecommerce_Engine.md) | 2,500+ | Products, orders, payments, shipping |
> | 06 | [Portfolio & Resume](./06_Portfolio_and_Resume.md) | 2,000+ | Portfolio builder, resume PDF, ATS |
> | 07 | [AI Features](./07_AI_Features.md) | 2,500+ | AI gateway, credits, generation, moderation |
> | 08 | [Database Schema](./08_Database_Schema.md) | 2,500+ | Tables, RLS, indexes, migrations |
> | 09 | [API Reference](./09_API_Reference.md) | 2,500+ | Endpoints, middleware, rate limiting |
> | 10 | [Storefront & Themes](./10_Storefront_and_Themes.md) | 2,000+ | SSR, themes, page builder, SEO |
> | 11 | [Super Admin & Team](./11_Super_Admin_and_Team.md) | 1,900+ | Console, moderation, analytics, security |
> | 12 | [Implementation Roadmap](./12_Implementation_Roadmap.md) | 2,000+ | Phases, deployment, costs, launch |

> **See also:** [13 Plans & Pricing](./13_Plans_and_Pricing.md) · [14 Theme Implementation](./14_Theme_Implementation.md) · [15 App Store Implementation](./15_App_Store_Implementation.md) — New features to integrate into the roadmap

---

*[← Back to Index](./README.md)*
