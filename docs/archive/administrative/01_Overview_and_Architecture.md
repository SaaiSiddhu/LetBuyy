# LetBuyy Administrative Apps — Overview & Architecture

> **Part 1 of 8** | Platform Overview, System Architecture, Console & Team App Foundation
>
> **Version:** 1.0 | **Date:** February 16, 2026
>
> **Scope:** This document covers the architectural foundation of LetBuyy's two internal administrative applications — the **Super Admin Console** (`console.letbuyy.store`) and the **Team Employee Portal** (`team.letbuyy.store`). Together, these apps provide complete operational control over the entire LetBuyy consumer ecosystem.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Administrative Platform Overview](#2-administrative-platform-overview)
3. [Consumer Ecosystem Map](#3-consumer-ecosystem-map)
4. [System Architecture](#4-system-architecture)
5. [Console App — Foundation](#5-console-app--foundation)
6. [Team App — Foundation](#6-team-app--foundation)
7. [Authentication & Access Control](#7-authentication--access-control)
8. [Role-Based Access Control (RBAC)](#8-role-based-access-control-rbac)
9. [Navigation & Layout Architecture](#9-navigation--layout-architecture)
10. [Cross-App Integration Points](#10-cross-app-integration-points)
11. [Document History](#11-document-history)

---

## 1. Executive Summary

The LetBuyy platform is a multi-tenant SaaS ecosystem that enables merchants to create and manage online stores, portfolios, resumes, blogs, and landing pages. The platform serves **thousands of merchants** across 5 site types, processing payments via Razorpay, leveraging 4 AI models (Gemini 2.5 Flash, Gemini 3 Pro, Claude Sonnet 4.5, Claude Opus 4.6), and supporting a full App Store + Theme Marketplace ecosystem.

**Two internal administrative applications** control every aspect of this ecosystem:

| Application | Domain | Purpose | Primary Users |
|---|---|---|---|
| **Console** | `console.letbuyy.store` | Super Admin — full platform control | Platform Owner, Super Admins |
| **Team** | `team.letbuyy.store` | Employee Portal — daily operations | Support Agents, Moderators, Analysts, Marketing |

### 1.1 What These Apps Manage

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LETBUYY ADMINISTRATIVE LAYER                         │
│                                                                         │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────┐  │
│  │  CONSOLE (Super Admin)      │  │  TEAM (Employee Portal)         │  │
│  │  ─────────────────────────  │  │  ─────────────────────────────  │  │
│  │  • Platform-wide control    │  │  • Daily operational tasks      │  │
│  │  • Store lifecycle mgmt     │  │  • Support ticket handling      │  │
│  │  • User account mgmt       │  │  • Content moderation           │  │
│  │  • Billing & revenue        │  │  • Marketing campaigns          │  │
│  │  • Feature flags            │  │  • Store operations assist      │  │
│  │  • System configuration     │  │  • User management (limited)   │  │
│  │  • Security & audit         │  │  • Performance monitoring       │  │
│  │  • Database explorer        │  │  • Escalation workflows         │  │
│  │  • Maintenance mode         │  │  • Knowledge base management   │  │
│  │  • Team member management   │  │  • Assigned task tracking       │  │
│  │  • GDPR compliance ops      │  │  • Internal collaboration       │  │
│  └─────────────────────────────┘  └─────────────────────────────────┘  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │              CONSUMER APPS MANAGED (6 applications)              │    │
│  │                                                                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │    │
│  │  │ Accounts │ │  Admin   │ │  Store-  │ │ Landing  │          │    │
│  │  │ (Auth)   │ │ (Merch.) │ │  front   │ │ (Market.)│          │    │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │    │
│  │  ┌──────────┐ ┌──────────┐                                     │    │
│  │  │App Store │ │  Theme   │                                     │    │
│  │  │(Extensns)│ │Marketplce│                                     │    │
│  │  └──────────┘ └──────────┘                                     │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Administrative Platform Overview

### 2.1 Platform Stats at a Glance

| Dimension | Scale |
|---|---|
| **Consumer apps managed** | 6 Next.js applications |
| **Site types supported** | 5 (Store, Portfolio, Resume, Blog, Landing) |
| **Database tables** | 45+ Supabase PostgreSQL tables |
| **AI models orchestrated** | 4 (Gemini Flash, Gemini Pro, Claude Sonnet, Claude Opus) |
| **Revenue streams** | 7 (subscriptions, GMV fees, AI credits, app store, themes, domains, enterprise) |
| **Plan tiers** | 7 (Free → Enterprise for stores; Publisher, Agency for blogs) |
| **API endpoints** | 100+ via Cloudflare Workers (Hono) |
| **Feature flags** | 42+ configurable flags with 6 scoping types |
| **Audit actions tracked** | 28+ distinct event types |
| **SLA categories** | 4 priority levels (Critical → Low) |

### 2.2 Administrative Feature Coverage Matrix

This matrix maps every administrative feature to the app that owns it:

| Feature Area | Console | Team | Details |
|---|---|---|---|
| **Store lifecycle** (create/suspend/delete) | ✅ Full | 🔍 View only | Console has suspend/unsuspend/delete |
| **Store impersonation** | ✅ Full | ❌ None | Security: Console-only, web-only |
| **User account management** | ✅ Full | ✅ Limited | Team can view + basic actions |
| **Billing & subscriptions** | ✅ Full | 🔍 View only | Console handles overrides/refunds |
| **Content moderation queue** | ✅ Full | ✅ Full | Both apps can approve/reject |
| **Support tickets** | ✅ Escalation | ✅ Full | Team handles daily; Console for escalation |
| **Platform analytics** | ✅ Full | ✅ Summary | Console has full drill-down |
| **AI usage monitoring** | ✅ Full | 🔍 View only | Console manages AI cost controls |
| **Feature flags** | ✅ Full | ❌ None | Console-only (too complex for team) |
| **Database explorer** | ✅ Full | ❌ None | Console-only (requires DB knowledge) |
| **Cache management** | ✅ Full | ❌ None | Console-only (technical tool) |
| **Audit logs** | ✅ Full | 🔍 Recent | Team sees own actions; Console sees all |
| **Maintenance mode** | ✅ Full | ❌ None | Console-only (platform-wide impact) |
| **Team management** | ✅ Full | 🔍 View only | Console invites/removes; Team views roster |
| **App Store oversight** | ✅ Full | ✅ Review | Console manages policies; Team reviews apps |
| **Theme Marketplace** | ✅ Full | ✅ Review | Console manages catalog; Team reviews themes |
| **Security dashboard** | ✅ Full | ❌ None | Console-only (sensitive) |
| **GDPR/compliance** | ✅ Full | ❌ None | Console handles data exports/deletions |
| **Marketing campaigns** | ❌ None | ✅ Full | Team-owned feature |
| **Knowledge base** | ❌ None | ✅ Full | Team maintains KB articles |

---

## 3. Consumer Ecosystem Map

### 3.1 Domain Architecture

The administrative apps manage this complete domain ecosystem:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LETBUYY DOMAIN MAP                               │
│                                                                         │
│  ROOT DOMAIN: letbuyy.store                                            │
│                                                                         │
│  ADMINISTRATIVE ─────────────────────────────────────────────────────  │
│  ├── console.letbuyy.store    → Super Admin Console (Next.js)          │
│  └── team.letbuyy.store       → Employee Portal (Next.js)              │
│                                                                         │
│  CONSUMER — PLATFORM APPS ──────────────────────────────────────────  │
│  ├── letbuyy.store            → Marketing Landing Page (Next.js)       │
│  ├── accounts.letbuyy.store   → Centralized Auth (SSO Hub)            │
│  ├── admin.letbuyy.store      → Merchant Dashboard (Next.js)          │
│  ├── apps.letbuyy.store       → App Store Marketplace (Next.js)       │
│  └── themes.letbuyy.store     → Theme Marketplace (Next.js)           │
│                                                                         │
│  CONSUMER — MERCHANT STOREFRONTS ────────────────────────────────────  │
│  ├── {subdomain}.letbuyy.store → Wildcard storefront routing           │
│  │   Examples:                                                          │
│  │   ├── stylehub.letbuyy.store    → Store (e-commerce)               │
│  │   ├── john-doe.letbuyy.store    → Portfolio / Resume                │
│  │   ├── techdaily.letbuyy.store   → Blog                              │
│  │   └── acmeco.letbuyy.store      → Landing page                      │
│  └── www.customdomain.com      → Custom domain (CNAME → Vercel)       │
│                                                                         │
│  INFRASTRUCTURE ─────────────────────────────────────────────────────  │
│  ├── api.letbuyy.store         → Cloudflare Workers (Hono API)        │
│  └── r2.letbuyy.store          → Cloudflare R2 (CDN / Assets)         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Site Types Managed

Each site type has unique features that require different administrative oversight:

| Site Type | Admin Sidebar Items | Unique Admin Concerns | Revenue Model |
|---|---|---|---|
| **Store** | Products, Orders, Customers, Coupons, Shipping, Analytics | Payment processing, inventory, fraud detection, refunds | Subscription + GMV % |
| **Portfolio** | Projects, Gallery, Services, Testimonials, Contact | Content quality, image moderation | Subscription only |
| **Resume** | Education, Experience, Certifications, ATS, PDF Export | PII handling, data accuracy | Subscription only |
| **Blog** | Posts, Categories, Comments, Newsletter, Scheduling | Content moderation, spam detection, SEO | Subscription only |
| **Landing** | Sections, Forms, A/B Testing, Conversion Tracking | Lead data privacy, form abuse prevention | Subscription only |

### 3.3 Revenue Streams Managed by Console

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    7 REVENUE STREAMS                                     │
│                                                                         │
│  1. SUBSCRIPTIONS ─────────── Base recurring revenue                   │
│     ├── Free: ₹0/mo (limited features, 50 AI credits)                 │
│     ├── Starter: ₹799/mo (1% transaction fee, 500 AI credits)         │
│     ├── Growth: (site-type dependent)                                   │
│     ├── Business: ₹1,999/mo (0.5% fee, 2,000 AI credits)             │
│     └── Enterprise: Custom pricing                                      │
│                                                                         │
│  2. TRANSACTION FEES ──────── GMV percentage (stores only)             │
│     ├── Starter: 1.0%                                                   │
│     ├── Business: 0.5%                                                  │
│     └── Enterprise: Negotiable                                          │
│                                                                         │
│  3. AI CREDIT PACKS ──────── ₹99-₹999 top-up packs                    │
│     ├── 500 credits: ₹99                                                │
│     ├── 2,500 credits: ₹449                                            │
│     └── 10,000 credits: ₹999                                           │
│                                                                         │
│  4. APP STORE ─────────────── 20% commission on app sales              │
│     └── Developer payouts via Razorpay (monthly)                       │
│                                                                         │
│  5. THEME MARKETPLACE ─────── 30% commission on premium themes         │
│     └── Designer payouts via Razorpay (monthly)                        │
│                                                                         │
│  6. CUSTOM DOMAINS ────────── ₹499-₹999/year add-on                   │
│     └── Automated DNS provisioning via Cloudflare API                  │
│                                                                         │
│  7. ENTERPRISE CONTRACTS ──── Custom pricing for large clients         │
│     └── White-label, dedicated support, SLA guarantees                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 4. System Architecture

### 4.1 Technology Stack

| Layer | Technology | Role in Admin Apps |
|---|---|---|
| **Frontend** | Next.js 15.1+ / React 19 | Console and Team app UI |
| **Styling** | Tailwind CSS 4 | Responsive admin layouts |
| **State** | React Context + Server Components | Store/user context, minimal client state |
| **API** | Hono on Cloudflare Workers | All admin API routes (`/v1/super-admin/*`) |
| **Database** | Supabase PostgreSQL | 45+ tables with RLS policies |
| **Auth** | Supabase Auth + custom middleware | JWT + 2FA + IP allowlist |
| **Cache** | Upstash Redis | Session cache, rate limiting, feature flags |
| **File Storage** | Cloudflare R2 | Audit log archives, GDPR exports, assets |
| **Email** | Resend | Team invitations, alerts, weekly reports |
| **Payments** | Razorpay | Subscription management, refunds |
| **Monitoring** | Cloudflare Analytics | Latency, error rates, traffic |
| **Notifications** | Slack/Discord Webhooks | Real-time operational alerts |
| **Mobile** | Flutter (Super-Admin app) | On-the-go monitoring & emergency actions |

### 4.2 Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INFRASTRUCTURE TOPOLOGY                          │
│                                                                         │
│   ┌────────────────────────────────────────────────────┐               │
│   │                  CLOUDFLARE EDGE                    │               │
│   │  ┌─────────┐  ┌──────────┐  ┌──────────────────┐  │               │
│   │  │  DNS    │  │   CDN    │  │  WAF + DDoS      │  │               │
│   │  │ Routing │  │  Cache   │  │  Protection      │  │               │
│   │  └────┬────┘  └────┬─────┘  └────────┬─────────┘  │               │
│   │       │             │                  │            │               │
│   │       └─────────────┼──────────────────┘            │               │
│   │                     │                               │               │
│   │  ┌──────────────────▼──────────────────────────┐   │               │
│   │  │         CLOUDFLARE WORKERS (API)             │   │               │
│   │  │                                               │   │               │
│   │  │  Hono Framework v4                            │   │               │
│   │  │  ├── Auth Middleware Chain (6 layers)         │   │               │
│   │  │  ├── Rate Limiting (Upstash)                  │   │               │
│   │  │  ├── /v1/super-admin/* (console routes)       │   │               │
│   │  │  ├── /v1/team/* (team routes)                 │   │               │
│   │  │  ├── /v1/stores/* (store management)          │   │               │
│   │  │  ├── /v1/ai/* (AI orchestration)              │   │               │
│   │  │  └── /v1/billing/* (Razorpay integration)     │   │               │
│   │  └─────────────────────────────────────────────┘   │               │
│   └────────────────────────────────────────────────────┘               │
│                            │                                            │
│           ┌────────────────┼───────────────────┐                       │
│           │                │                    │                       │
│   ┌───────▼──────┐ ┌──────▼───────┐ ┌─────────▼────────┐             │
│   │   SUPABASE   │ │   UPSTASH    │ │  CLOUDFLARE R2   │             │
│   │  PostgreSQL  │ │   Redis      │ │  Object Storage  │             │
│   │              │ │              │ │                    │             │
│   │ 45+ Tables   │ │ Sessions     │ │ Audit archives    │             │
│   │ RLS Policies │ │ Rate limits  │ │ GDPR exports      │             │
│   │ Triggers     │ │ Cache        │ │ Theme assets      │             │
│   │ Functions    │ │ Feature flags│ │ User uploads       │             │
│   └──────────────┘ └──────────────┘ └──────────────────┘             │
│                                                                         │
│   ┌────────────────────────────────────────────────────┐               │
│   │                     VERCEL                          │               │
│   │                                                     │               │
│   │  ┌───────────┐ ┌───────────┐ ┌──────── ──────┐    │               │
│   │  │  Console  │ │  Team     │ │ 6 Consumer    │    │               │
│   │  │  Next.js  │ │  Next.js  │ │ Apps (Next.js)│    │               │
│   │  └───────────┘ └───────────┘ └───────────────┘    │               │
│   │                                                     │               │
│   │  Features: Edge Functions, ISR, Image Optimization │               │
│   └────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Request Flow — Admin API Call

```
Super Admin clicks "Suspend Store" in Console
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  1. BROWSER → API (HTTPS POST)                               │
│     POST api.letbuyy.store/v1/super-admin/stores/:id/suspend │
│     Headers: { Authorization: Bearer <JWT> }                 │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  2. CLOUDFLARE WORKER — Middleware Chain                      │
│     ├── Layer 1: CORS check (origin = console.letbuyy.store) │
│     ├── Layer 2: Rate limiter (100 req/min per admin)        │
│     ├── Layer 3: JWT validation (Supabase verify)            │
│     ├── Layer 4: IP allowlist check (VPN required)           │
│     ├── Layer 5: Role check (super_admin / platform_owner)   │
│     └── Layer 6: 2FA verification (TOTP within 15 min)       │
│                                                                │
│     ❌ Any failure → 401/403 + audit log entry               │
└──────────────────────────────────────────────────────────────┘
         │ ✅ All checks pass
         ▼
┌──────────────────────────────────────────────────────────────┐
│  3. ROUTE HANDLER — Execute Action                           │
│     ├── Validate request body (Zod schema)                   │
│     ├── Business logic (check store exists, not already       │
│     │   suspended, etc.)                                      │
│     ├── UPDATE stores SET status = 'suspended'               │
│     ├── Notify store owner via email (Resend)                │
│     ├── Invalidate storefront cache (Cloudflare purge)       │
│     ├── Log audit event (STORE_SUSPENDED, severity: critical)│
│     └── Send Slack alert to #ops channel                     │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  4. RESPONSE → Browser                                        │
│     { success: true, store: { id, status: 'suspended' } }   │
│     Console UI updates in real-time                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Console App — Foundation

### 5.1 Project Structure

```
apps/web/administrative/console/
├── src/
│   └── app/
│       ├── (auth)/                    # Authentication routes
│       │   ├── login/                 # VPN + password + 2FA login
│       │   └── mfa/                   # TOTP setup & verification
│       ├── (dashboard)/               # Main console interface
│       │   ├── layout.tsx             # Sidebar + header + breadcrumbs
│       │   ├── page.tsx               # Dashboard overview (metrics grid)
│       │   ├── analytics/             # Platform-wide analytics
│       │   ├── audit-logs/            # Full audit log viewer
│       │   ├── employees/             # Team member management
│       │   ├── settings/              # Platform configuration
│       │   ├── stores/                # Store lifecycle management
│       │   ├── subscriptions/         # Billing & subscription oversight
│       │   └── users/                 # User account management
│       ├── globals.css                # Tailwind base + custom styles
│       ├── layout.tsx                 # Root layout (providers, fonts)
│       ├── page.tsx                   # Root redirect → /login or /dashboard
│       └── favicon.ico
├── public/                            # Static assets (6 files)
├── package.json                       # Dependencies (Next.js 15, React 19)
├── next.config.ts                     # Next.js configuration
├── tsconfig.json                      # TypeScript paths
├── postcss.config.mjs                 # PostCSS + Tailwind
└── eslint.config.mjs                  # ESLint rules
```

### 5.2 Console Dashboard Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────┐ ┌──────────────────────────────────────────────────────────┐│
│  │ LETBUYY│ │  Console Dashboard            🔔 3  🔍 Search  👤 Admin ││
│  │ CONSOLE│ └──────────────────────────────────────────────────────────┘│
│  │        │                                                             │
│  │ ────── │ ┌────────────────────────────────────────────────────────┐  │
│  │ 📊 Dash│ │                                                        │  │
│  │ 🏪 Stor│ │  PLATFORM HEALTH              Status: 🟢 All Normal   │  │
│  │ 👥 User│ │                                                        │  │
│  │ 💳 Subs│ │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│  │
│  │ 📈 Anal│ │  │ Active   │ │ MRR      │ │ AI Calls │ │ Uptime   ││  │
│  │ 👔 Team│ │  │ Stores   │ │          │ │ (today)  │ │          ││  │
│  │ 📋 Audi│ │  │ 1,247    │ │ ₹8.2L    │ │ 12,456   │ │ 99.97%   ││  │
│  │ ⚙️ Sett│ │  │ ↑5% MoM  │ │ ↑18% MoM │ │ cache:42%│ │ p95:45ms ││  │
│  │        │ │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│  │
│  │        │ │                                                        │  │
│  │        │ │  REQUIRES ATTENTION                                    │  │
│  │        │ │  ┌────────────────────────────────────────────────────┐│  │
│  │        │ │  │ 🔴 2 critical support tickets (SLA: ⏰ 2h left)  ││  │
│  │        │ │  │ 🟡 3 items in moderation queue                    ││  │
│  │        │ │  │ ❌ 5 failed payments this week (₹45K)             ││  │
│  │        │ │  │ ⚠️ 1 team member inactive 30+ days                ││  │
│  │        │ │  └────────────────────────────────────────────────────┘│  │
│  │        │ │                                                        │  │
│  │        │ │  QUICK ACTIONS                                         │  │
│  │        │ │  [📊 Full Analytics] [🏪 View All Stores]              │  │
│  │        │ │  [🎫 Support Queue]  [🛡️ Moderation Queue]            │  │
│  │        │ │  [🔧 Maintenance]    [📋 Audit Logs]                   │  │
│  │        │ │                                                        │  │
│  └────────┘ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Console Sidebar Navigation

| Icon | Label | Route | Description |
|---|---|---|---|
| 📊 | Dashboard | `/` | Platform health, metrics, alerts |
| 🏪 | Stores | `/stores` | Store list, lifecycle management, impersonation |
| 👥 | Users | `/users` | User accounts, roles, GDPR actions |
| 💳 | Subscriptions | `/subscriptions` | Billing, plans, refunds, revenue |
| 📈 | Analytics | `/analytics` | Growth, revenue, engagement, AI, system metrics |
| 👔 | Employees | `/employees` | Team member invite, roles, permissions |
| 📋 | Audit Logs | `/audit-logs` | Full action history with filters |
| ⚙️ | Settings | `/settings` | Platform config, feature flags, integrations |

---

## 6. Team App — Foundation

### 6.1 Project Structure

```
apps/web/administrative/team/
├── src/
│   └── app/
│       ├── (auth)/                    # Authentication routes
│       │   ├── login/                 # Team member login (email + password)
│       │   └── invite/                # Accept team invitation flow
│       ├── (dashboard)/               # Main team interface
│       │   ├── layout.tsx             # Sidebar + header + notifications
│       │   ├── page.tsx               # Team dashboard (assigned tasks)
│       │   ├── marketing/             # Campaign management
│       │   ├── operations/            # Operational tools & workflows
│       │   ├── stores/                # Store viewing & assistance
│       │   ├── support/               # Support ticket management
│       │   └── users/                 # User lookup & basic management
│       ├── globals.css
│       ├── layout.tsx
│       ├── page.tsx
│       └── favicon.ico
├── public/
├── package.json
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── eslint.config.mjs
```

### 6.2 Team Dashboard Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ┌────────┐ ┌──────────────────────────────────────────────────────────┐│
│  │ LETBUYY│ │  Team Portal       Welcome, Sarah  🔔 5  👤 Support Agt ││
│  │  TEAM  │ └──────────────────────────────────────────────────────────┘│
│  │        │                                                             │
│  │ ────── │ ┌────────────────────────────────────────────────────────┐  │
│  │ 🏠 Home│ │                                                        │  │
│  │ 🎫 Supp│ │  MY WORKLOAD                                           │  │
│  │ 🏪 Stor│ │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐│  │
│  │ 👥 User│ │  │ Assigned │ │ In       │ │ Pending  │ │ Resolved ││  │
│  │ 📢 Mktg│ │  │ Tickets  │ │ Progress │ │ Response │ │ (today)  ││  │
│  │ ⚡ Ops │ │  │ 8        │ │ 3        │ │ 2        │ │ 12       ││  │
│  │        │ │  └──────────┘ └──────────┘ └──────────┘ └──────────┘│  │
│  │        │ │                                                        │  │
│  │        │ │  PRIORITY ITEMS                                        │  │
│  │        │ │  ┌────────────────────────────────────────────────────┐│  │
│  │        │ │  │ 🔴 #1045 — Payments not processing (2h SLA left) ││  │
│  │        │ │  │ 🟡 #1042 — Custom domain help (KB match: 95%)    ││  │
│  │        │ │  │ 🟡 #1038 — Product import failing (assigned 3h)  ││  │
│  │        │ │  └────────────────────────────────────────────────────┘│  │
│  │        │ │                                                        │  │
│  │        │ │  MODERATION QUEUE         │  TEAM ACTIVITY             │  │
│  │        │ │  🟡 3 items pending       │  • Amit resolved #1040     │  │
│  │        │ │  🤖 2 auto-flagged        │  • Sarah replied to #1042  │  │
│  │        │ │  📸 1 image review        │  • Weekly report ready     │  │
│  │        │ │                            │                            │  │
│  └────────┘ └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Team Sidebar Navigation

| Icon | Label | Route | Description |
|---|---|---|---|
| 🏠 | Home | `/` | Personal dashboard, assigned tasks, SLA timers |
| 🎫 | Support | `/support` | Ticket queue, replies, KB articles, escalation |
| 🏪 | Stores | `/stores` | Store lookup, view details, assist merchants |
| 👥 | Users | `/users` | User lookup, account status, basic actions |
| 📢 | Marketing | `/marketing` | Campaigns, announcements, email broadcasts |
| ⚡ | Operations | `/operations` | Moderation queue, operational tasks, workflows |

---

## 7. Authentication & Access Control

### 7.1 Console Authentication Flow

The Console enforces the strictest authentication in the entire platform:

```
Admin navigates to console.letbuyy.store
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 1: IP ALLOWLIST (VPN Required)                        │
│  ├── Extract IP from cf-connecting-ip header                 │
│  ├── Compare against allowlisted IPs in Upstash Redis        │
│  └── ❌ Blocked → "Access Denied" page + audit log           │
│       (SUPER_ADMIN_ACCESS_DENIED, severity: critical)        │
└──────────────────────────────────────────────────────────────┘
         │ ✅ IP allowed
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 2: AUTHENTICATION                                      │
│  ├── Check for valid lb_session cookie                        │
│  ├── No session → redirect to /login                         │
│  ├── Login form: email + password                            │
│  └── Supabase Auth verifies credentials                      │
└──────────────────────────────────────────────────────────────┘
         │ ✅ Credentials valid
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 3: ROLE VERIFICATION                                   │
│  ├── Query profiles table for user role                      │
│  ├── Required: role = 'super_admin' OR 'platform_owner'      │
│  └── ❌ Wrong role → "Unauthorized" + audit log              │
│       (SUPER_ADMIN_ACCESS_DENIED, severity: warning)         │
└──────────────────────────────────────────────────────────────┘
         │ ✅ Role valid
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 4: TWO-FACTOR AUTHENTICATION (2FA)                     │
│  ├── Check if 2FA is enrolled (mandatory for super admins)   │
│  ├── Not enrolled → redirect to /mfa (forced setup)          │
│  ├── Enrolled → prompt for 6-digit TOTP code                 │
│  ├── Verify TOTP against user's secret                       │
│  └── ❌ Invalid code → retry (max 3 attempts)                │
│       After 3 fails → account locked + alert                 │
└──────────────────────────────────────────────────────────────┘
         │ ✅ 2FA valid
         ▼
┌──────────────────────────────────────────────────────────────┐
│  GRANTED: Session created                                     │
│  ├── Set lb_session cookie (httpOnly, secure, .letbuyy.store)│
│  ├── Log: SUPER_ADMIN_LOGIN (severity: info)                 │
│  ├── Record: IP, user agent, timestamp                       │
│  └── Redirect to /dashboard                                  │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Team Authentication Flow

The Team app uses a simpler but still secure flow:

```
Team member navigates to team.letbuyy.store
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 1: SESSION                                             │
│  ├── Check for valid lb_session cookie                        │
│  ├── No session → redirect to /login                         │
│  └── Login: email + password (no VPN required)               │
└──────────────────────────────────────────────────────────────┘
         │ ✅ Authenticated
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 2: TEAM MEMBERSHIP                                     │
│  ├── Query team_members table for user                       │
│  ├── Check: status = 'active', platform_role IN allowed list │
│  ├── Load permissions based on role                          │
│  └── ❌ Not a team member → "Not authorized" page            │
└──────────────────────────────────────────────────────────────┘
         │ ✅ Valid team member
         ▼
┌──────────────────────────────────────────────────────────────┐
│  CHECK 3: 2FA (Optional but recommended)                      │
│  ├── If user has 2FA enabled → verify TOTP                   │
│  ├── If not → proceed (but show security recommendation)     │
│  └── Console can enforce 2FA for all team members            │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  GRANTED: Session created                                     │
│  ├── Log: TEAM_MEMBER_LOGIN (severity: info)                 │
│  ├── Load team role + permission set                         │
│  └── Redirect to /dashboard                                  │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Auth Comparison Table

| Security Layer | Console | Team |
|---|---|---|
| **VPN / IP allowlist** | ✅ Required | ❌ Not required |
| **Email + password** | ✅ Required | ✅ Required |
| **2FA (TOTP)** | ✅ Mandatory | 🟡 Optional (recommended) |
| **Role check** | `super_admin` / `platform_owner` | Any `team_members` role |
| **Session cookie** | `lb_session` on `.letbuyy.store` | `lb_session` on `.letbuyy.store` |
| **Session lifetime** | 8 hours (strict) | 24 hours |
| **Failed login handling** | 3 attempts → lock + alert | 5 attempts → temporary lock |
| **Audit logging** | Every login/failure logged | Login logged |

---

## 8. Role-Based Access Control (RBAC)

### 8.1 Role Hierarchy

```
                    ┌─────────────────┐
                    │ Platform Owner   │  ← God mode (1 person: founder)
                    │ ALL permissions  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Super Admin    │  ← Full platform control (2-3 people)
                    │ All except:     │
                    │ • Delete platform│
                    │ • Change owner  │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     ┌────────▼──────┐ ┌────▼────────┐ ┌──▼──────────┐
     │ Support Lead  │ │ Moderator   │ │ Analyst     │
     │               │ │  Lead       │ │             │
     │ • Manage      │ │ • Manage    │ │ • View all  │
     │   tickets     │ │   content   │ │   analytics │
     │ • View stores │ │   queue     │ │ • Export    │
     │ • Escalate    │ │ • Suspend   │ │   reports   │
     │ • KB articles │ │   content   │ │ • View      │
     └───────┬───────┘ └─────┬───────┘ │   stores   │
             │               │          └─────────────┘
     ┌───────▼───────┐ ┌─────▼───────┐
     │ Support Agent │ │ Content     │
     │               │ │ Moderator   │
     │ • Reply to    │ │             │
     │   tickets     │ │ • Review    │
     │ • View stores │ │   queue     │
     │ • Use KB      │ │ • Approve/  │
     └───────────────┘ │   reject    │
                       └─────────────┘
```

### 8.2 Permission Matrix

| Permission | Platform Owner | Super Admin | Support Lead | Moderator Lead | Analyst | Support Agent | Content Mod |
|---|---|---|---|---|---|---|---|
| `stores.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 🔍 |
| `stores.write` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `stores.suspend` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| `stores.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `stores.impersonate` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `users.write` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.suspend` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `users.delete` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `billing.read` | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `billing.override` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `billing.refund` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `moderation.read` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| `moderation.action` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| `tickets.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `tickets.reply` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| `tickets.escalate` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `analytics.read` | ✅ | ✅ | 🔍 | 🔍 | ✅ | ❌ | ❌ |
| `analytics.export` | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `team.read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `team.invite` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `team.remove` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `system.flags` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `system.db` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `system.cache` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `system.maintenance` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gdpr.export` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `gdpr.delete` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> **Legend:** ✅ = Full access | 🔍 = Read/view only | ❌ = No access

### 8.3 Permission Middleware Implementation

```typescript
// apps/api/src/middleware/requirePermission.ts

import { Context, Next } from 'hono';
import { createServiceClient } from '@/lib/supabase';

type Permission = 
  | 'stores.read' | 'stores.write' | 'stores.suspend' | 'stores.delete' | 'stores.impersonate'
  | 'users.read' | 'users.write' | 'users.suspend' | 'users.delete'
  | 'billing.read' | 'billing.override' | 'billing.refund'
  | 'moderation.read' | 'moderation.action'
  | 'tickets.read' | 'tickets.reply' | 'tickets.escalate'
  | 'analytics.read' | 'analytics.export'
  | 'team.read' | 'team.invite' | 'team.remove'
  | 'system.flags' | 'system.db' | 'system.cache' | 'system.maintenance'
  | 'gdpr.export' | 'gdpr.delete';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  platform_owner: ['*'],  // All permissions
  super_admin: [
    'stores.read', 'stores.write', 'stores.suspend', 'stores.delete', 'stores.impersonate',
    'users.read', 'users.write', 'users.suspend', 'users.delete',
    'billing.read', 'billing.override', 'billing.refund',
    'moderation.read', 'moderation.action',
    'tickets.read', 'tickets.reply', 'tickets.escalate',
    'analytics.read', 'analytics.export',
    'team.read', 'team.invite', 'team.remove',
    'system.flags', 'system.db', 'system.cache', 'system.maintenance',
    'gdpr.export',
  ],
  support_lead: [
    'stores.read', 'users.read', 'billing.read',
    'tickets.read', 'tickets.reply', 'tickets.escalate',
    'analytics.read', 'team.read',
  ],
  // ... additional roles
};

export function requirePermission(...required: Permission[]) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const role = user.platform_role;
    const permissions = ROLE_PERMISSIONS[role] || [];

    const hasAll = required.every(p => 
      permissions.includes('*') || permissions.includes(p)
    );

    if (!hasAll) {
      await logAuditEvent(c, {
        action: 'PERMISSION_DENIED',
        resource_type: 'console',
        metadata: { required, role },
        severity: 'warning',
      });
      return c.json({ error: 'Insufficient permissions' }, 403);
    }

    await next();
  };
}
```

---

## 9. Navigation & Layout Architecture

### 9.1 Shared Layout Pattern

Both Console and Team apps follow the same layout architecture:

```typescript
// Shared layout pattern for both apps
// apps/web/administrative/{app}/src/app/(dashboard)/layout.tsx

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { NotificationBell } from '@/components/NotificationBell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side auth check
  const cookieStore = await cookies();
  const session = cookieStore.get('lb_session');
  
  if (!session) {
    redirect('/login');
  }

  // Verify session and load user context
  const user = await verifyAdminSession(session.value);
  if (!user) redirect('/login');

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Fixed sidebar */}
      <Sidebar role={user.platform_role} />
      
      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header bar */}
        <Header user={user}>
          <NotificationBell userId={user.id} />
        </Header>
        
        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 9.2 Responsive Behavior

| Breakpoint | Sidebar | Header | Content |
|---|---|---|---|
| **Desktop** (≥1024px) | Fixed, expanded (240px) | Full width, all controls visible | Full grid layout |
| **Tablet** (768-1023px) | Collapsed (64px, icons only) | Full width, search hidden | 2-column grid |
| **Mobile** (<768px) | Hidden (hamburger toggle) | Compact, essential controls | Single column |

---

## 10. Cross-App Integration Points

### 10.1 Shared Infrastructure

| Component | Console | Team | Consumer Apps |
|---|---|---|---|
| **API endpoint** | `api.letbuyy.store/v1/super-admin/*` | `api.letbuyy.store/v1/team/*` | `api.letbuyy.store/v1/*` |
| **Session cookie** | `lb_session` (domain: `.letbuyy.store`) | Same cookie | Same cookie |
| **Database** | Supabase (full access via service key) | Supabase (scoped by RLS) | Supabase (scoped by RLS) |
| **Redis** | Upstash (full access) | Upstash (scoped) | Upstash (scoped) |
| **File storage** | R2 (full access) | R2 (read-only) | R2 (per-store access) |

### 10.2 Real-Time Communication

```
┌──────────────────────────────────────────────────────────────┐
│                   EVENT FLOW                                  │
│                                                                │
│  Consumer Action          Admin Notification                  │
│  ───────────────          ──────────────────                  │
│  Store owner submits   →  Team app: new ticket appears       │
│  support ticket            Console: ticket count badge +1     │
│                                                                │
│  AI auto-flags content →  Team app: moderation queue +1      │
│                            Console: moderation badge +1       │
│                                                                │
│  Payment fails         →  Console: failed payment alert      │
│                            Slack: #billing-alerts webhook     │
│                                                                │
│  New store created     →  Console: store count updates       │
│                            Team: operations dashboard update  │
│                                                                │
│  Security threat       →  Console: security dashboard red    │
│  detected                  Slack: #security-alerts webhook   │
│                            Email: super admin notification    │
└──────────────────────────────────────────────────────────────┘
```

---

## 11. Document History

| Version | Date | Changes |
|---|---|---|
| 1.0 | Feb 16, 2026 | Initial version — 10 sections covering platform overview, consumer ecosystem map (6 apps, 5 site types, 7 revenue streams), system architecture (full infrastructure topology, request flow), Console foundation (8 sidebar routes, dashboard wireframe), Team foundation (6 sidebar routes, dashboard wireframe), authentication flows (4-layer Console, 3-layer Team), RBAC (7 roles, 28-permission matrix, middleware), navigation architecture, cross-app integration |

---

> **Next:** [Part 2 — User & Store Management, Billing & Plans](./02_User_Store_Billing.md)

---

*[← Back to Index](./README.md)*
