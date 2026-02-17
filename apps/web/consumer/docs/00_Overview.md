# LetBuyy Platform — Overview

> **Doc 00 of 17** | Platform Vision, Domain Structure, Tech Stack, AI Engine, Onboarding & Site Types
>
> **Version:** 7.0 | **Date:** February 14, 2026
>
> **Next:** [01 Architecture](./01_Architecture.md)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Platform Vision & Philosophy](#2-platform-vision--philosophy)
3. [Domain Architecture](#3-domain-architecture)
4. [Complete User Journey (End-to-End)](#4-complete-user-journey-end-to-end)
5. [Applications Ecosystem](#5-applications-ecosystem)
6. [Onboarding & Store Creation](#6-onboarding--store-creation)
7. [Site Types & Adaptive UI Engine](#7-site-types--adaptive-ui-engine)
8. [Technology Stack (Deep Dive)](#8-technology-stack-deep-dive)
9. [AI Engine — Models, Pricing & Token Economics](#9-ai-engine--models-pricing--token-economics)
10. [Session & Usage Monitoring (Redis)](#10-session--usage-monitoring-redis)
11. [Database Architecture (Overview)](#11-database-architecture-overview)
12. [Cost Analysis & Revenue Model](#12-cost-analysis--revenue-model)
13. [Platform Metrics & SLAs](#13-platform-metrics--slas)

---

## 1. Executive Summary

LetBuyy is a comprehensive **Shopify-class multi-tenant SaaS platform** that allows anyone — entrepreneurs, freelancers, students, agencies, bloggers, job seekers — to create and manage **e-commerce stores, portfolios, resumes/CVs, blogs, and landing pages** with enterprise-grade features, all under one platform.

The platform is built on a modern edge-first stack: **Supabase (PostgreSQL 16)** for the database with Row Level Security on every table, **Cloudflare Workers** for the API layer running on 180+ global Points of Presence with 0ms cold starts, **Next.js 15** with App Router for all web applications using Server Components and ISR, **Flutter 3.27+** for cross-platform mobile/desktop apps, and a **4-model AI engine** (Gemini 3 Flash, Gemini 3 Pro, Claude Sonnet 4.5, Claude Opus 4.6) monitored in real-time via **Upstash Redis**.

> **⚠️ IMPORTANT — Authentication Rule:** All authentication (login, signup, OAuth, 2FA, password reset, email verification) happens **exclusively** on `accounts.letbuyy.store`. The marketing site `letbuyy.store` contains **zero** auth pages — it only has marketing content, pricing, templates gallery, and the platform blog. When a user clicks "Get Started" or "Sign Up" on the marketing site, they are **redirected** to `accounts.letbuyy.store/signup`. There are **no duplicated auth flows** anywhere in the platform.

### Key Capabilities

| Capability | Description | AI-Enhanced |
|---|---|:---:|
| **Multi-Site Architecture** | Dynamic UI adaptation per site type (**5 types:** Store, Portfolio, Resume, Blog, Landing) — the entire admin navigation, dashboard widgets, analytics cards, and AI tooling morph completely to match the selected site type. Each type has its own distinct admin experience. | — |
| **Full E-commerce** | Products with infinite variant matrix (size × color × material = unlimited SKUs), real-time inventory tracking with low-stock AI alerts, orders with full lifecycle management (pending → processing → shipped → delivered → refunded), multi-coupon stacking engine, zone-based shipping calculator, multi-gateway payments (Stripe + Razorpay + PayPal) with automatic region detection | ✅ |
| **Portfolio & Resume** | Creative showcase with masonry/carousel/grid galleries, project case studies with rich media, skill badges with proficiency levels + professional CV builder with PDF/DOCX export, ATS (Applicant Tracking System) scoring via AI, LinkedIn profile import, and multiple resume templates | ✅ |
| **Blog / CMS** | Full blogging system with Tiptap rich-text editor (ProseMirror-based), hierarchical categories with color badges, flat tag taxonomy with auto-suggest, threaded comments (max depth: 5) with moderation queue (pending/approved/spam/trash), centralized media library with drag-drop upload, per-post SEO overrides, content versioning with diff viewer and rollback, scheduled publishing, newsletter subscriber collection, 4 blog layout options (Standard, Magazine, Minimal, Grid), reading time auto-calculation, and activity audit logs | ✅ |
| **AI-Powered Engine** | 4-model provider strategy — **Gemini 3 Flash** (fast/cheap bulk tasks), **Gemini 3 Pro** (complex reasoning), **Claude Sonnet 4.5** (advanced creative writing), **Claude Opus 4.6** (premium deep analysis) — with intelligent per-task routing, per-model token limits, credit metering per store, and Redis-backed real-time session monitoring | ✅ |
| **Page Builder** | Drag-and-drop page builder powered by Craft.js with 30+ customizable blocks (hero, features, pricing, FAQ, testimonials, gallery, CTA, etc.), AI section generator that creates entire page sections from a text prompt, and live mobile/tablet/desktop preview toggle | ✅ |
| **Admin Panel** | Full-featured `admin.letbuyy.store/{store}` matching Shopify's admin functionality — dark mode toggle, keyboard shortcuts throughout, command palette (⌘K / Ctrl+K) for instant navigation, bulk actions with progress indicators, activity logs with audit trail, and responsive mobile admin | — |
| **Super Admin Console** | Platform-wide operational control at `console.letbuyy.store` — accessible only via VPN + 2FA + IP allowlist. Includes user management, store moderation, revenue dashboards, AI usage analytics, system health monitoring, and feature flag management | ✅ |
| **Employee Portal** | Role-based staff operations portal at `team.letbuyy.store` with granular RBAC system (14 distinct permission scopes: products.read, products.write, orders.manage, analytics.view, settings.billing, etc.) | — |
| **Omnichannel Notifications** | Push notifications (Firebase Cloud Messaging for iOS, Android, Web), transactional email (Resend with React Email templates), in-app notification center with read/unread states, and outgoing webhooks — all with AI-triaged priority routing that determines notification urgency | ✅ |
| **Edge Architecture** | Multi-region edge computing via Cloudflare Workers (180+ global PoPs, 0ms cold start), CDN-first static asset delivery via Cloudflare R2, ISR (Incremental Static Regeneration) for storefronts, and per-region database read replicas for sub-50ms query times | — |
| **Realtime** | Supabase Realtime subscriptions for live order notifications (new order toast in admin), inventory count updates (shared editing), collaborative page builder editing, and real-time analytics dashboard updates | — |

---

## 2. Platform Vision & Philosophy

LetBuyy empowers **anyone** — entrepreneurs, freelancers, students, agencies, bloggers, job seekers — to build a professional online presence in minutes. Unlike traditional website builders that offer one-size-fits-all solutions, LetBuyy adapts its **entire interface, navigation, features, and AI capabilities** based on what the user is building.

**What makes LetBuyy different** from competitors like Shopify, Squarespace, WordPress, and Wix:

1. **Adaptive UI Engine** — The admin panel isn't a generic CMS. When you select "E-commerce Store," you get products, orders, inventory, coupons, shipping. When you select "Blog," those menus disappear entirely and are replaced with Posts, Categories, Tags, Comments, Media Library. The entire admin experience transforms per site type.

2. **AI-First Content Creation** — Every text field in the platform has an AI assist button. Product descriptions, blog posts, resume bullets, landing page copy, SEO meta tags — all can be generated, improved, or rewritten by the AI engine with one click.

3. **Multi-Tenant Subdomain Architecture** — Each store gets an instant subdomain (`yourstore.letbuyy.store`) provisioned via wildcard DNS. No manual DNS configuration needed. Custom domains supported on paid plans.

4. **Edge-Native Performance** — The API runs on Cloudflare Workers with 0ms cold starts across 180+ global locations. Storefronts use ISR with edge delivery for sub-100ms TTFB worldwide.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                              USER SELECTS SITE TYPE                                   │
│                        (During onboarding survey at Step 1)                            │
│                                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │
│  │  🛒 STORE    │  │  🎨 PORTFOLIO│  │  📄 RESUME   │  │  ✍️  BLOG    │             │
│  │              │  │              │  │              │  │              │             │
│  │ Products     │  │ Projects     │  │ Experience   │  │ Posts        │             │
│  │ Orders       │  │ Gallery      │  │ Skills       │  │ Categories   │             │
│  │ Inventory    │  │ Skills       │  │ Education    │  │ Tags         │             │
│  │ Coupons      │  │ About        │  │ PDF Export   │  │ Comments     │             │
│  │ Shipping     │  │ Contact      │  │ ATS Score    │  │ Media Library│             │
│  │ Payments     │  │ Testimonials │  │ LinkedIn     │  │ Newsletter   │             │
│  │ Customers    │  │ Clients      │  │ Certif.      │  │ Subscribers  │             │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘             │
│                                                                                       │
│  ┌──────────────┐                    ┌─────────────────────────────────────────────┐ │
│  │  🚀 LANDING  │                    │              ADAPTIVE UI ENGINE             │ │
│  │              │ ──────────────────▶│                                             │ │
│  │ Sections     │                    │  1. Renders matching admin sidebar          │ │
│  │ Forms        │                    │  2. Loads site-type-specific dashboard      │ │
│  │ Analytics    │                    │  3. Configures AI task routing              │ │
│  │ CTA Builder  │                    │  4. Applies matching storefront theme       │ │
│  │ A/B Testing  │                    │  5. Stores selection in `stores.site_type`  │ │
│  └──────────────┘                    └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Principles

| Principle | Implementation | Measured By |
|---|---|---|
| **Adaptive UI** | Dashboard, admin sidebar, widgets, analytics cards, and AI suggestions morph completely per site type. Each of the 5 site types has its own distinct admin experience with unique navigation items and dashboard layout. | 5 distinct dashboard variants, 5 navigation configs |
| **AI-First** | AI integrated at every content creation touchpoint — product descriptions, blog posts, resume bullets, SEO tags, landing copy, analytics insights. Intelligent model auto-selection routes each task to the cheapest model that meets quality requirements. | 4 AI models, 20+ task-to-model routings |
| **Edge Performance** | Cloudflare Workers (180+ PoPs, 0ms cold start) for API, Vercel Edge + ISR for storefronts, R2 CDN for assets. All static content served from the nearest edge node. | p95 TTFB < 100ms, API p95 < 200ms |
| **Security by Design** | Row Level Security (RLS) on every single database table, 2FA for admin and super admin, VPN + IP allowlist for console, audit logging on all mutations, AI fraud detection for suspicious activity, CSRF protection, rate limiting per store | 0 data leaks target, 100% RLS coverage |
| **Multi-Platform** | Web apps (Next.js 15 with App Router, Server Components, Streaming) + Mobile/Desktop apps (Flutter 3.27+ with Riverpod, GoRouter) sharing the same design system and API | 6 platforms (Web, iOS, Android, macOS, Windows, Linux) from 2 codebases |
| **Cost Transparency** | Real-time credit + token usage dashboards with per-model cost breakdown. Store owners can see exactly how many AI credits they've used, which model was called, and how many tokens were consumed — all stored in Redis with 48h TTL. | Redis-backed monitoring, real-time dashboard updates |
| **Developer Experience** | Turborepo monorepo with shared packages, auto-generated TypeScript types from Supabase schema (via `supabase gen types`), shared ESLint/Prettier configs, hot reload across all apps | < 5s dev server cold start, type-safe DB queries |

---

## 3. Domain Architecture

### 3.1 Domain Map

```
                               letbuyy.store
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
   MARKETING TIER             AUTH TIER                  PRODUCT TIER
         │                          │                          │
  letbuyy.store            accounts.letbuyy.store     admin.letbuyy.store/{store}
  ├─ / (landing)            ├─ /login                 ├─ /onboarding (survey)
  ├─ /pricing               ├─ /signup                ├─ /dashboard
  ├─ /templates             ├─ /forgot-password       ├─ /products (store)
  ├─ /blog (platform)       ├─ /callback/:provider    ├─ /posts (blog)
  └─ /features              ├─ /2fa                   ├─ /ai-studio
                             ├─ /verify-email          ├─ /analytics
                             ├─ /onboarding            └─ /settings
                             └─ /reset-password
                                                        {store}.letbuyy.store
                                                        (public storefront/blog)
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
   OPERATIONS TIER            API TIER                   CDN TIER
         │                          │                          │
  console.letbuyy.store     api.letbuyy.store          cdn.letbuyy.store
  (super admin, VPN+2FA)    (REST API, Hono)           (R2 assets, images)
  team.letbuyy.store        webhooks.letbuyy.store
  (employee portal)         (payment/event handlers)
```

> **⚠️ CRITICAL RULE:** The marketing site `letbuyy.store` has **NO authentication pages**. All login, signup, OAuth, 2FA, password reset, email verification, and onboarding flows live **exclusively** on `accounts.letbuyy.store`. When a user clicks "Get Started" anywhere on the marketing site, they are **redirected** to `accounts.letbuyy.store/signup`. This is a strict architectural boundary — no auth logic, no auth UI, no auth API routes exist on the marketing tier.

### 3.2 Domain Details (Complete)

| Domain | Purpose | Users | Access Control | SEO | Infrastructure | Key Routes |
|---|---|---|---|---|---|---|
| `letbuyy.store` | Marketing landing page, pricing page, template gallery, platform blog, feature showcase, documentation | Public visitors, prospective users | 🌐 Public — no auth required | ✅ Fully indexed, sitemap.xml, structured data | Vercel Edge (ISR + SSG) | `/`, `/pricing`, `/templates`, `/blog`, `/features`, `/docs` |
| `accounts.letbuyy.store` | **ALL authentication** — unified login (Email + Google + GitHub + Apple), signup with OTP verification, password creation, OAuth callback handling, 2FA setup/verification, password reset flow, email verification, and **initial onboarding** (site type selection + store name + subdomain creation) | All users (unauthenticated during signup/login, authenticated during onboarding) | 🔒 Auth flows — rate-limited, CSRF-protected, bot detection via Turnstile | ❌ noindex — auth pages should never appear in search engines | Vercel (SSR for dynamic auth states) | `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/callback/:provider`, `/2fa`, `/onboarding` |
| `admin.letbuyy.store/{store}` | Per-store admin dashboard — the main CMS where store owners manage their content. Navigation, widgets, and features change based on `site_type`. Includes onboarding survey for new stores. | Store owners (authenticated) | 🔒 JWT + RLS — every API call verified against `auth.uid()`, only own store data accessible | ❌ noindex | Vercel (SSR + Client) | `/{store}/onboarding`, `/{store}/dashboard`, `/{store}/products`, `/{store}/posts`, `/{store}/ai-studio`, `/{store}/analytics`, `/{store}/settings` |
| `*.letbuyy.store` | Published storefronts and blogs — dynamic content served from wildcard DNS. Each subdomain resolves to the correct store via `stores.subdomain` lookup. Draft stores show a "Launching Soon" branded page. | Public visitors, customers | 🌐 Public — cached at edge, ISR with 60s revalidation | ✅ Fully indexed with sitemap per store, OpenGraph, JSON-LD structured data | Vercel Edge (ISR + SSR, Wildcard SSL via Let's Encrypt) | `/`, `/products`, `/p/{slug}`, `/cart`, `/checkout`, `/blog`, `/blog/{slug}`, `/category/{slug}`, `/tag/{slug}` |
| `team.letbuyy.store` | Employee portal for staff who work at stores — granular RBAC with 14 distinct permission scopes. Each employee is invited by a store owner and can only access features matching their role permissions. | Store employees (invited) | 🔐 JWT + RBAC Allowlist — permission checked on every route and API call | ❌ noindex | Vercel | `/dashboard`, `/orders`, `/products`, `/customers` |
| `console.letbuyy.store` | Super admin console for platform operators — user management, store moderation, revenue dashboards, AI usage analytics, system health, feature flags, support tickets | Platform founders/ops | 🔐 VPN + 2FA + IP Allowlist — triple-gated access. Must be on VPN, have 2FA enabled, AND IP must be in allowlist | ❌ noindex | Vercel | `/dashboard`, `/users`, `/stores`, `/revenue`, `/ai-usage`, `/health`, `/flags` |
| `api.letbuyy.store` | REST API gateway running on Cloudflare Workers with Hono framework — handles all business logic, database queries (via Supabase client), AI provider calls, file uploads, and payment processing | All clients (web apps, mobile apps, webhooks) | 🔒 JWT Bearer token — validated on every request, RLS enforced at DB level | N/A — API responses are JSON | Cloudflare Workers (180+ PoPs, 0ms cold start) | `/v1/auth/*`, `/v1/stores/*`, `/v1/products/*`, `/v1/blog/*`, `/v1/ai/*`, `/v1/payments/*`, `/v1/webhooks/*` |
| `cdn.letbuyy.store` | Static asset delivery — product images, media library files, user uploads, template assets, generated PDFs. All served from Cloudflare R2 with zero egress fees and global edge caching. | All clients | 🌐 Public — edge-cached, immutable URLs with content hash | N/A | Cloudflare R2 + CDN (zero egress) | `/{store_id}/{asset_hash}.{ext}` |
| `webhooks.letbuyy.store` | Inbound webhook handler for payment providers (Stripe webhook events, Razorpay callback verification), email delivery status (Resend), and third-party integrations | External services (Stripe, Razorpay, Resend) | 🔒 Signature verification — each provider's webhook signature is cryptographically verified | N/A | Cloudflare Workers (Proxied) | `/stripe`, `/razorpay`, `/resend`, `/easypost` |

### 3.3 URL Routing Architecture (Complete)

> **Rule:** No authentication routes exist on `letbuyy.store`. All auth lives on `accounts.letbuyy.store`.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ MARKETING TIER (letbuyy.store) — PUBLIC, NO AUTH                                     │
│                                                                                      │
│  letbuyy.store/                           → Landing page (hero, features, CTA)       │
│  letbuyy.store/pricing                    → Plan comparison (Free/Starter/Biz/Ent)   │
│  letbuyy.store/templates                  → Template gallery (filterable by type)     │
│  letbuyy.store/templates/{id}             → Template preview with live demo           │
│  letbuyy.store/features                   → Feature deep-dive by site type            │
│  letbuyy.store/blog                       → Platform blog (SEO content, updates)      │
│  letbuyy.store/blog/{slug}                → Blog post detail page                     │
│  letbuyy.store/docs                       → Developer/user documentation              │
│  letbuyy.store/changelog                  → Product updates and release notes          │
│  letbuyy.store/about                      → About the platform + team                 │
│  letbuyy.store/contact                    → Contact form + support info                │
│  letbuyy.store/terms                      → Terms of Service                           │
│  letbuyy.store/privacy                    → Privacy Policy                             │
│                                                                                      │
│  ⚠️  "Get Started" / "Sign Up" buttons → REDIRECT to accounts.letbuyy.store/signup   │
│  ⚠️  "Log In" button → REDIRECT to accounts.letbuyy.store/login                      │
│  ⚠️  NO /signup, /login, /create routes exist here                                   │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ AUTHENTICATION TIER (accounts.letbuyy.store) — ALL AUTH LIVES HERE                   │
│                                                                                      │
│  accounts.letbuyy.store/login                → Unified login (Email + Google +       │
│                                                 GitHub + Apple OAuth)                 │
│  accounts.letbuyy.store/signup               → Account creation with email + OTP      │
│                                                 verification + password creation      │
│  accounts.letbuyy.store/verify-email         → Email verification (OTP input,        │
│                                                 6-digit code, 10min expiry, 3 tries) │
│  accounts.letbuyy.store/forgot-password      → Password reset request (enter email)   │
│  accounts.letbuyy.store/reset-password       → New password form (from email link)    │
│  accounts.letbuyy.store/callback/:provider   → OAuth callback handler (Google,        │
│                                                 GitHub, Apple redirect URI)           │
│  accounts.letbuyy.store/2fa                  → Two-factor authentication setup and    │
│                                                 verification (TOTP via authenticator) │
│  accounts.letbuyy.store/onboarding           → Initial store creation wizard:         │
│                                                 Step 1: Site type selection (5 types) │
│                                                 Step 2: Store name + subdomain input  │
│                                                 → Creates store in DB → redirects to  │
│                                                   admin.letbuyy.store/{subdomain}     │
│                                                                                      │
│  POST-LOGIN REDIRECT LOGIC:                                                          │
│  ├── User has store(s)? → redirect to admin.letbuyy.store/{first_store}/dashboard    │
│  └── User has NO stores? → redirect to accounts.letbuyy.store/onboarding             │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ ADMIN DASHBOARD (admin.letbuyy.store/{store}) — PER-STORE CMS                        │
│                                                                                      │
│  /{store}/onboarding           → Site-type-specific survey (industry, goals,          │
│                                   preferences) — stored to `store_surveys` table.     │
│                                   Only shown once for new stores. AI uses this data   │
│                                   to personalize content suggestions.                 │
│  /{store}/dashboard            → Store overview + AI insights + quick actions          │
│                                                                                      │
│  E-COMMERCE STORE ROUTES:                                                            │
│  /{store}/products             → Product listing with search, filters, bulk actions    │
│  /{store}/products/new         → Create new product (variants, images, pricing)        │
│  /{store}/products/{id}        → Edit existing product                                │
│  /{store}/orders               → Order listing with status filters + lifecycle mgmt   │
│  /{store}/orders/{id}          → Order detail (timeline, customer, items, shipping)    │
│  /{store}/inventory            → Real-time inventory tracker with low-stock alerts     │
│  /{store}/coupons              → Coupon management (% off, fixed, BOGO, stacking)     │
│  /{store}/shipping             → Shipping zones, rates, carrier config (EasyPost)      │
│  /{store}/customers            → Customer list with order history + lifetime value     │
│                                                                                      │
│  BLOG ROUTES:                                                                        │
│  /{store}/posts                → Blog post listing (draft/published/scheduled)        │
│  /{store}/posts/new            → Tiptap rich text editor (new post)                   │
│  /{store}/posts/{id}           → Edit existing post (with version history sidebar)     │
│  /{store}/categories           → Category management (hierarchical tree view)          │
│  /{store}/tags                 → Tag management (cloud view + auto-suggest)            │
│  /{store}/comments             → Comment moderation queue (pending/approved/spam)      │
│  /{store}/media                → Media library (grid/list, folders, drag-drop upload)  │
│  /{store}/subscribers          → Newsletter subscriber list + export                   │
│                                                                                      │
│  PORTFOLIO ROUTES:                                                                   │
│  /{store}/projects             → Project listing with drag-and-drop reordering        │
│  /{store}/projects/new         → Create project (images, description, tech stack)      │
│  /{store}/projects/{id}        → Edit existing project                                │
│  /{store}/skills               → Skills management with proficiency levels             │
│  /{store}/education            → Education entries management                         │
│  /{store}/testimonials         → Client testimonials management                       │
│  /{store}/forms                → Contact form builder + submission inbox               │
│                                                                                      │
│  RESUME ROUTES:                                                                      │
│  /{store}/experience           → Work experience entries with AI bullet rewrite       │
│  /{store}/skills               → Skills with proficiency bars                         │
│  /{store}/education            → Education entries                                    │
│  /{store}/certifications       → Professional certifications                          │
│  /{store}/pdf-export           → PDF/DOCX export preview + template selection         │
│  /{store}/ats-score            → AI ATS scoring analysis + improvement suggestions    │
│                                                                                      │
│  LANDING PAGE ROUTES:                                                                │
│  /{store}/sections             → Section management (hero, features, pricing, etc.)   │
│  /{store}/forms                → Form builder (contact, waitlist, survey)              │
│  /{store}/cta                  → CTA button builder with A/B variant testing          │
│                                                                                      │
│  COMMON ROUTES (all site types):                                                     │
│  /{store}/pages                → Drag & drop page builder (Craft.js, 30+ blocks)      │
│  /{store}/ai-studio            → AI feature hub + credit monitor + usage history      │
│  /{store}/analytics            → Traffic, revenue, conversions, real-time dashboard    │
│  /{store}/settings             → Store config, billing, custom domain, plan upgrade    │
│  /{store}/settings/domain      → Custom domain setup + DNS verification               │
│  /{store}/settings/billing     → Subscription management + invoice history             │
│  /{store}/settings/team        → Team member invites + RBAC permission management      │
│  /{store}/notifications        → Notification preferences + webhook configuration      │
│  /{store}/theme                → Theme customization (colors, fonts, layout)           │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ PUBLIC STOREFRONTS ({store_name}.letbuyy.store) — DYNAMIC WILDCARD ROUTING           │
│                                                                                      │
│  COMMON (all types):                                                                 │
│  {store}.letbuyy.store/                   → Homepage (layout varies by site type)     │
│  {store}.letbuyy.store/about              → About page                               │
│  {store}.letbuyy.store/contact            → Contact page                             │
│  {store}.letbuyy.store/{custom-page}      → Custom pages built with page builder      │
│                                                                                      │
│  E-COMMERCE:                                                                         │
│  {store}.letbuyy.store/products           → Product listing with filters + search     │
│  {store}.letbuyy.store/p/{slug}           → Product detail (images, variants, cart)   │
│  {store}.letbuyy.store/c/{category}       → Products by category                     │
│  {store}.letbuyy.store/cart               → Shopping cart (persisted in localStorage) │
│  {store}.letbuyy.store/checkout           → Checkout flow (guest or authenticated)     │
│  {store}.letbuyy.store/order/{id}         → Order confirmation + tracking             │
│                                                                                      │
│  BLOG:                                                                               │
│  {store}.letbuyy.store/blog               → Blog listing (paginated, layout-based)    │
│  {store}.letbuyy.store/blog/{slug}        → Post detail (TOC, reading time, comments) │
│  {store}.letbuyy.store/category/{slug}    → Posts filtered by category                │
│  {store}.letbuyy.store/tag/{slug}         → Posts filtered by tag                     │
│  {store}.letbuyy.store/rss.xml            → RSS feed for blog subscribers             │
│                                                                                      │
│  PORTFOLIO:                                                                          │
│  {store}.letbuyy.store/projects           → Project gallery (masonry/grid/carousel)   │
│  {store}.letbuyy.store/projects/{slug}    → Project case study detail                 │
│                                                                                      │
│  RESUME:                                                                             │
│  {store}.letbuyy.store/                   → Full resume page (single-page layout)     │
│  {store}.letbuyy.store/download           → PDF download endpoint                    │
│                                                                                      │
│  DRAFT STORES (not yet published):                                                   │
│  {store}.letbuyy.store/                   → "Launching Soon" branded page showing     │
│                                              store name, type, and owner email        │
└─────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│ API TIER (api.letbuyy.store) — REST API ON CLOUDFLARE WORKERS                        │
│                                                                                      │
│  /v1/auth/check-email          → Check if email exists (for login vs signup routing)  │
│  /v1/auth/signup               → Create account + send OTP email                     │
│  /v1/auth/otp/verify           → Verify 6-digit OTP code                             │
│  /v1/auth/password/set         → Set password after OTP verification                 │
│  /v1/auth/login                → Email + password login → returns JWT + redirect URL  │
│  /v1/auth/oauth/:provider      → OAuth flow initiation (Google, GitHub, Apple)       │
│  /v1/auth/2fa/setup            → Generate TOTP secret + QR code                      │
│  /v1/auth/2fa/verify           → Verify TOTP code                                    │
│  /v1/auth/refresh              → Refresh JWT token                                   │
│  /v1/auth/logout               → Invalidate session                                  │
│                                                                                      │
│  /v1/stores                    → CRUD store management (create, list, update)         │
│  /v1/stores/:id/survey         → Save/retrieve onboarding survey data                │
│  /v1/stores/:id/publish        → Run pre-publish checks + set status = published     │
│  /v1/stores/:id/team           → Team member management + RBAC                       │
│                                                                                      │
│  /v1/products                  → CRUD products with variants, images, pricing         │
│  /v1/products/bulk             → Bulk create/update/delete/export operations          │
│  /v1/orders                    → Order management with status transitions             │
│  /v1/inventory                 → Stock level management + low-stock alerts            │
│  /v1/coupons                   → Coupon CRUD with validation rules                   │
│  /v1/shipping                  → Shipping zone management + rate calculation          │
│                                                                                      │
│  /v1/blog/posts                → Blog post CRUD + version history                    │
│  /v1/blog/categories           → Category CRUD (hierarchical)                        │
│  /v1/blog/tags                 → Tag CRUD + auto-suggest                             │
│  /v1/blog/comments             → Comment moderation + thread management              │
│  /v1/blog/media                → Media library upload + management                   │
│  /v1/blog/subscribers          → Newsletter subscriber management                    │
│                                                                                      │
│  /v1/ai/generate               → AI content generation (routed to optimal model)     │
│  /v1/ai/credits                → Credit balance + usage history                      │
│  /v1/ai/credits/purchase       → Buy additional AI credit packs                      │
│                                                                                      │
│  /v1/pages                     → Page builder data (Craft.js JSON)                   │
│  /v1/analytics                 → Analytics queries + real-time data                  │
│  /v1/notifications             → Notification management + preferences               │
│                                                                                      │
│  /v1/payments/stripe/checkout  → Create Stripe checkout session                      │
│  /v1/payments/razorpay/order   → Create Razorpay order                               │
│  /v1/payments/razorpay/verify  → Verify Razorpay payment signature                   │
│                                                                                      │
│  /v1/webhooks/stripe           → Stripe webhook event handler (signature verified)   │
│  /v1/webhooks/razorpay         → Razorpay webhook handler                            │
│  /v1/webhooks/resend           → Email delivery status updates                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 DNS Configuration (Cloudflare)

| Type | Name | Target | Proxy | Purpose |
|---|---|---|---|---|
| `A` | `@` (root) | `76.76.21.21` | DNS only ❌ | Marketing site → Vercel |
| `CNAME` | `accounts` | `cname.vercel-dns.com` | DNS only ❌ | Auth portal → Vercel |
| `CNAME` | `admin` | `cname.vercel-dns.com` | DNS only ❌ | Store CMS → Vercel |
| `CNAME` | `console` | `cname.vercel-dns.com` | DNS only ❌ | Super admin → Vercel |
| `CNAME` | `team` | `cname.vercel-dns.com` | DNS only ❌ | Employee portal → Vercel |
| `CNAME` | `*` (wildcard) ⚠️ | `cname.vercel-dns.com` | DNS only ❌ | All user subdomains → Vercel |
| `AAAA` | `api` | `100::` | Proxied ✅ | REST API → CF Workers |
| `AAAA` | `webhooks` | `100::` | Proxied ✅ | Webhook handlers → CF Workers |

> ⚠️ **Wildcard DNS MUST be DNS-only (not proxied)** for Vercel's automatic SSL certificate provisioning to work. Cloudflare's proxy would intercept the ACME challenge.
> ⚠️ **API and Webhooks MUST be proxied** for Cloudflare Workers routing to function.

### 3.5 SSL Certificate Chain

```
Browser ──HTTPS──► Cloudflare Edge
                    │
                    ├── Proxied records (api.*, webhooks.*):
                    │   Cloudflare Universal SSL → terminates at edge
                    │   → Routes to Cloudflare Worker (plain HTTP internally)
                    │
                    └── DNS-only records (all others):
                        Pass-through to Vercel Edge Network
                        → Vercel auto-provisions Let's Encrypt certificates
                        → Includes wildcard cert for *.letbuyy.store

Cloudflare SSL Settings:
├── Encryption Mode: Full (strict)
├── Always Use HTTPS: ✅ Enabled
├── HSTS: Max-Age 6 months, include subdomains, preload
├── Minimum TLS Version: 1.2
├── TLS 1.3: ✅ Enabled
└── Automatic HTTPS Rewrites: ✅ Enabled
```

---

## 4. Complete User Journey (End-to-End)

This section describes the **entire flow** from when a new user first discovers LetBuyy to when their storefront is live and accepting visitors.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE USER JOURNEY                                     │
└──────────────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────┐
 │  1. DISCOVER     │  User visits letbuyy.store → sees marketing page
 │     (Marketing)  │  Clicks "Get Started" → REDIRECTED to accounts.letbuyy.store
 └────────┬────────┘
          │
          ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │  2. EMAIL LOOKUP  (accounts.letbuyy.store/login)                       │
 │                                                                         │
 │  User enters email → API checks if account exists:                     │
 │  ├── Email EXISTS → Show password field + OAuth buttons → Login flow   │
 │  └── Email NOT EXISTS → Redirect to /signup → Signup flow              │
 └────────┬──────────────────────────────────────────────────┬────────────┘
          │                                                  │
     NEW USER                                           EXISTING USER
          │                                                  │
          ▼                                                  │
 ┌─────────────────────────────────────────────────────┐    │
 │  3. SIGNUP  (accounts.letbuyy.store/signup)          │    │
 │                                                       │    │
 │  Step 1: Enter email                                  │    │
 │  Step 2: Verify OTP (6-digit code sent via Resend)   │    │
 │          → 10 min expiry, max 3 attempts              │    │
 │  Step 3: Create password                              │    │
 │          → Min 8 chars, uppercase, number, special    │    │
 │  → OR OAuth: Google / GitHub / Apple (one-click)     │    │
 │                                                       │    │
 │  Backend: Creates account in Supabase Auth            │    │
 │  → Sends welcome email via Resend                     │    │
 └────────┬──────────────────────────────────────────────┘    │
          │                                                    │
          └─────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │  4. POST-LOGIN REDIRECT LOGIC  (Server-side)                          │
 │                                                                        │
 │  Query: SELECT * FROM stores WHERE user_id = auth.uid() LIMIT 1       │
 │                                                                        │
 │  ├── User HAS store(s) → Redirect to:                                 │
 │  │   admin.letbuyy.store/{first_store_subdomain}/dashboard             │
 │  │                                                                     │
 │  └── User has NO stores → Redirect to:                                │
 │      accounts.letbuyy.store/onboarding                                 │
 │      (Must create a store before accessing admin dashboard)            │
 └─────────────────────────┬─────────────────────────────────────────────┘
                           │
                      NO STORES
                           │
                           ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │  5. ONBOARDING  (accounts.letbuyy.store/onboarding)                    │
 │                                                                        │
 │  ┌─── STEP 1: Site Type Selection ──────────────────────────────────┐ │
 │  │                                                                    │ │
 │  │  "What do you want to build?"                                     │ │
 │  │                                                                    │ │
 │  │  ┌──────────────┐  ┌──────────────┐                              │ │
 │  │  │ 🛒 E-commerce │  │ 🎨 Portfolio  │                              │ │
 │  │  │    Store      │  │              │                              │ │
 │  │  │ Sell products │  │ Showcase     │                              │ │
 │  │  │ online        │  │ your work    │                              │ │
 │  │  └──────────────┘  └──────────────┘                              │ │
 │  │  ┌──────────────┐  ┌──────────────┐                              │ │
 │  │  │ 📄 Resume/CV  │  │ 🚀 Landing   │                              │ │
 │  │  │              │  │    Page      │                              │ │
 │  │  │ Professional │  │ Marketing   │                              │ │
 │  │  │ profile      │  │ campaign    │                              │ │
 │  │  └──────────────┘  └──────────────┘                              │ │
 │  │  ┌─────────────────────────────────┐                              │ │
 │  │  │ ✍️  Blogger                      │  ← 5th type, centered      │ │
 │  │  │    Write & publish blog posts   │     (spans 2 columns)       │ │
 │  │  └─────────────────────────────────┘                              │ │
 │  │                                                                    │ │
 │  │  💡 "Not sure? AI can help you decide" [Help me choose →]        │ │
 │  │                                                                    │ │
 │  │  [Next →] (disabled until a type is selected)                     │ │
 │  └────────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  ┌─── STEP 2: Store Name + Subdomain ───────────────────────────────┐ │
 │  │                                                                    │ │
 │  │  "Name your store"                                                │ │
 │  │  "This will be your URL"                                          │ │
 │  │                                                                    │ │
 │  │  Store Name:                                                       │ │
 │  │  ┌─────────────────────────┬──────────────┐                       │ │
 │  │  │  myawesomestore         │ .letbuyy     │                       │ │
 │  │  │  (auto-sanitized:       │ .store       │                       │ │
 │  │  │   lowercase, a-z0-9-)  │ (suffix)     │                       │ │
 │  │  └─────────────────────────┴──────────────┘                       │ │
 │  │  ✅ Available!  (real-time availability check)                    │ │
 │  │                                                                    │ │
 │  │  [← Back]     [Create Store →]                                    │ │
 │  └────────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  BACKEND ACTIONS ON "Create Store":                                    │
 │  1. Validate subdomain (regex + reserved words + availability)        │
 │  2. INSERT INTO stores (user_id, subdomain, store_name, site_type)    │
 │  3. INSERT INTO onboarding_attempts (user_id, subdomain, success)     │
 │  4. Set trial_ends_at = NOW() + 7 days                                │
 │  5. Create ai_credits record with tier defaults (10 free credits)     │
 │  6. Send "Store Created" email via Resend                             │
 │  7. Create audit log entry                                             │
 │  8. Redirect → admin.letbuyy.store/{subdomain}/onboarding              │
 └────────┬──────────────────────────────────────────────────────────────┘
          │
          ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │  6. ADMIN ONBOARDING SURVEY  (admin.letbuyy.store/{store}/onboarding) │
 │     Site-type-specific survey — shown ONCE for new stores              │
 │     Saved to `store_surveys` table for AI personalization             │
 │                                                                        │
 │  ┌─── E-COMMERCE SURVEY ────────────────────────────────────────────┐ │
 │  │  Q1: What industry are you in? [Dropdown: Fashion, Electronics,  │ │
 │  │      Beauty, Food, Sports, Home, Jewelry, Art, Other]            │ │
 │  │  Q2: How many products do you plan to sell? [1-10, 11-50,        │ │
 │  │      51-200, 200+]                                                │ │
 │  │  Q3: Do you already have product images? [Yes / No / Some]       │ │
 │  │  Q4: Preferred currency? [INR, USD, EUR, GBP, etc.]              │ │
 │  │  Q5: Do you need shipping? [Yes, local only / Yes, worldwide /   │ │
 │  │      No (digital products)]                                       │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  ┌─── BLOG SURVEY ─────────────────────────────────────────────────┐ │
 │  │  Q1: What topics will you write about? [Tech, Lifestyle, Travel, │ │
 │  │      Food, Business, Personal, Education, Other]                  │ │
 │  │  Q2: How often do you plan to publish? [Daily, Weekly,           │ │
 │  │      Bi-weekly, Monthly]                                          │ │
 │  │  Q3: Preferred blog layout? [Standard, Magazine, Minimal, Grid]  │ │
 │  │  Q4: Enable comments? [Yes / Yes, with moderation / No]          │ │
 │  │  Q5: Want a newsletter? [Yes / Not yet]                          │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  ┌─── PORTFOLIO SURVEY ────────────────────────────────────────────┐ │
 │  │  Q1: What type of work? [Design, Photography, Development,       │ │
 │  │      Art, Architecture, Other]                                   │ │
 │  │  Q2: Gallery style? [Masonry, Grid, Carousel, Full-width]        │ │
 │  │  Q3: How many projects? [1-5, 6-20, 20+]                        │ │
 │  │  Q4: Include contact form? [Yes / No]                            │ │
 │  │  Q5: Include testimonials section? [Yes / Not yet]               │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  ┌─── RESUME SURVEY ───────────────────────────────────────────────┐ │
 │  │  Q1: What field? [Software Engineering, Design, Marketing,       │ │
 │  │      Finance, Healthcare, Education, Other]                      │ │
 │  │  Q2: Experience level? [Student, Junior (0-2yr), Mid (3-5yr),    │ │
 │  │      Senior (6-10yr), Executive (10+yr)]                         │ │
 │  │  Q3: Import from LinkedIn? [Yes / No / Enter manually]           │ │
 │  │  Q4: Resume template style? [Modern, Classic, Creative, Minimal] │ │
 │  │  Q5: Need PDF export? [Yes, PDF / Yes, PDF + DOCX / Not yet]    │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  ┌─── LANDING PAGE SURVEY ─────────────────────────────────────────┐ │
 │  │  Q1: What's the goal? [Product launch, Waitlist, Event,          │ │
 │  │      Service promotion, App download, Other]                     │ │
 │  │  Q2: Do you have brand assets? [Logo / Colors / Both / Neither]  │ │
 │  │  Q3: Need a form? [Contact, Waitlist, Survey, Newsletter, None]  │ │
 │  │  Q4: Need A/B testing? [Yes / Not yet]                           │ │
 │  │  Q5: Expected traffic source? [Social media, Ads, SEO, Email]    │ │
 │  └──────────────────────────────────────────────────────────────────┘ │
 │                                                                        │
 │  Database: INSERT INTO store_surveys (store_id, site_type, answers)   │
 │  AI uses these answers to: personalize dashboard, suggest templates,  │
 │  generate starter content, and route to optimal AI models              │
 │                                                                        │
 │  [Skip →] (optional, can fill later from Settings)                    │
 │  [Complete Setup →] → Redirect to /{store}/dashboard                  │
 └────────┬──────────────────────────────────────────────────────────────┘
          │
          ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │  7. ADMIN DASHBOARD  (admin.letbuyy.store/{store}/dashboard)          │
 │                                                                        │
 │  Trial countdown banner visible (7 days remaining)                    │
 │  Full feature access during trial                                     │
 │  AI Studio available with 10 trial credits                            │
 │  Dashboard layout adapts to site type                                  │
 └────────┬──────────────────────────────────────────────────────────────┘
          │ User builds their site, adds content
          ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │  8. TRIAL / PAYMENT                                                    │
 │                                                                        │
 │  ├── Day 1-7: ACTIVE TRIAL (full access, countdown banner)           │
 │  ├── Day 7: Trial expires → choose plan or enter 3-day grace         │
 │  ├── Day 8-10: GRACE PERIOD (admin access, publishing disabled)      │
 │  ├── Day 11+: FROZEN (billing page only, storefront shows            │
 │  │            "Coming Soon", data preserved 90 days)                  │
 │  └── Payment: Razorpay (India) or Stripe (Global) → plan activated   │
 └────────┬──────────────────────────────────────────────────────────────┘
          │
          ▼
 ┌───────────────────────────────────────────────────────────────────────┐
 │  9. STOREFRONT LIVE  ({store}.letbuyy.store)                           │
 │                                                                        │
 │  ├── Published store → Fully functional storefront/blog               │
 │  ├── Draft store → "Launching Soon" branded page with store info     │
 │  ├── ISR enabled → 60s revalidation for fresh content                │
 │  └── Custom domain → Available on Starter+ plans                     │
 └──────────────────────────────────────────────────────────────────────┘
```

---

## 5. Applications Ecosystem

### 5.1 Application Map

| App | Platform | Package Name | Purpose | Auth Required | Deployment |
|---|---|---|---|---|---|
| **Builder** | Flutter (Android, iOS, macOS, Windows) | `builder` | Mobile/desktop storefront editor + AI Studio — allows store owners to manage their store, edit products, moderate comments, and use AI features from any device | ✅ JWT | App Stores (Google Play, Apple App Store) |
| **Landing** | Next.js 15 (App Router) | `@letbuyy/landing` | Marketing website — home page, pricing page, template gallery, platform blog, feature showcase, documentation. **Contains NO auth pages** — all "Get Started" / "Login" buttons redirect to `accounts.letbuyy.store` | ❌ Public | Vercel Edge (SSG + ISR) |
| **Accounts** | Next.js 15 (App Router) | `@letbuyy/accounts` | **Unified authentication portal** — ALL login, signup, OAuth callbacks, 2FA, password reset, email verification, and initial onboarding (site type + store creation) happen exclusively in this app. SSR for dynamic auth states. | Both (unauthenticated for login/signup, authenticated for onboarding) | Vercel (SSR) |
| **Admin** | Next.js 15 (App Router) | `@letbuyy/admin` | Per-store admin dashboard — the main CMS where store owners manage everything. URL pattern: `admin.letbuyy.store/{store_subdomain}/...`. Navigation and features morph based on `site_type`. Includes onboarding survey, blog CMS (Tiptap editor), AI Studio, page builder, analytics, and settings. | ✅ JWT + RLS | Vercel (SSR + Client) |
| **Storefront** | Next.js 15 (App Router) | `@letbuyy/storefront` | Dynamic public storefronts and blogs — each subdomain resolves to the correct store. Wildcard routing with ISR. Supports all 5 site types with distinct layouts. Draft stores show "Launching Soon" page. | ❌ Public (cart/checkout auth optional) | Vercel Edge (ISR + SSR, Wildcard) |
| **Team Portal** | Next.js 15 (App Router) | `@letbuyy/team` | Employee operations portal — staff members invited by store owners access limited functionality based on their RBAC permissions (14 scopes). Role examples: "Order Manager" (orders.manage, customers.read), "Content Editor" (products.write, blog.write). | ✅ JWT + RBAC | Vercel |
| **Console** | Next.js 15 (App Router) | `@letbuyy/console` | Super admin platform management — operational dashboards for platform founders. User management, store moderation, revenue analytics, AI usage monitoring, system health, feature flags, support tickets. | ✅ VPN + 2FA + IP | Vercel |
| **API** | Cloudflare Workers (Hono) | `@letbuyy/api` | REST API gateway — all business logic, database queries (Supabase client with RLS), AI provider calls (Gemini + Claude), payment processing (Stripe/Razorpay), file uploads (R2), email sending (Resend). Ultra-lightweight (14KB framework), TypeScript-first, middleware-rich. | 🔒 JWT Bearer | Cloudflare Workers (180+ PoPs) |

### 5.2 Shared Packages (Turborepo Monorepo)

All apps share common packages to avoid code duplication and ensure consistency:

| Package | Purpose | Used By |
|---|---|---|
| `@letbuyy/ui` | Shared React component library built on shadcn/ui — customized with LetBuyy's purple theme, dark mode support, and responsive variants. Includes buttons, forms, modals, tables, cards, charts, and 50+ components. | All Next.js apps |
| `@letbuyy/db` | Supabase client initialization, auto-generated TypeScript types (via `supabase gen types typescript`), RLS helper functions, and typed query builders. Ensures type-safe database access across all apps. | All apps |
| `@letbuyy/auth` | Auth utilities — session management, JWT validation, 2FA helpers (TOTP generation/verification), OAuth state management, and middleware for route protection. Used by both web and API. | Accounts, Admin, API |
| `@letbuyy/ai` | AI provider abstraction layer — unified interface for Gemini and Claude APIs, task-to-model routing logic, credit management (check balance, deduct credits), Redis client for usage tracking, and response caching. | Admin, API, Builder |
| `@letbuyy/config` | Shared configuration files — ESLint config (strict TypeScript rules), TypeScript config (strict mode, path aliases), Tailwind CSS config (custom theme, design tokens), and Prettier config. | All apps |
| `@letbuyy/email` | Resend email templates built with React Email — branded HTML templates for store creation success/failure, trial reminders, payment confirmations, password reset, OTP codes, team invites, and newsletter. All templates support dark mode. | API, Accounts |
| `@letbuyy/types` | Shared TypeScript type definitions — enums for site types, store statuses, order statuses, payment providers, AI models, permission scopes, and other platform-wide constants. | All apps |

---

## 6. Onboarding & Store Creation

### 6.1 Onboarding Architecture

The onboarding flow is split across **two applications** and involves **four database tables**:

| Step | Application | URL | Database Tables | Purpose |
|---|---|---|---|---|
| Account Creation | `@letbuyy/accounts` | `accounts.letbuyy.store/signup` | `auth.users` | User authentication record |
| Site Type + Store Name | `@letbuyy/accounts` | `accounts.letbuyy.store/onboarding` | `stores`, `onboarding_attempts`, `ai_credits` | Store record + subdomain provisioning |
| Site-Type Survey | `@letbuyy/admin` | `admin.letbuyy.store/{store}/onboarding` | `store_surveys` | AI personalization data (shown once) |
| Template + AI Setup | `@letbuyy/admin` | `admin.letbuyy.store/{store}/onboarding` | `stores.template_id`, `ai_credits` | Optional template pick + AI starter content |

### 6.2 Database Tables for Onboarding

```sql
-- Store creation record
CREATE TABLE stores (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) NOT NULL,
  store_name      TEXT NOT NULL,
  subdomain       TEXT UNIQUE NOT NULL,
  site_type       TEXT NOT NULL CHECK (site_type IN ('store','portfolio','resume','blog','landing')),
  template_id     UUID REFERENCES templates(id),
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','frozen','suspended')),
  trial_started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at   TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  frozen_at       TIMESTAMPTZ,
  plan_id         UUID REFERENCES plans(id),
  custom_domain   TEXT,
  settings        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Onboarding attempt logging (tracks all creation attempts)
CREATE TABLE onboarding_attempts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID REFERENCES auth.users(id) NOT NULL,
  store_name      TEXT NOT NULL,
  subdomain       TEXT NOT NULL,
  site_type       TEXT NOT NULL,
  success         BOOLEAN NOT NULL,
  error_message   TEXT,
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Site-type-specific survey answers
CREATE TABLE store_surveys (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) NOT NULL UNIQUE,
  site_type       TEXT NOT NULL,
  answers         JSONB NOT NULL,
  completed_at    TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- AI credit allocation (created during store creation)
CREATE TABLE ai_credits (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        UUID REFERENCES stores(id) NOT NULL UNIQUE,
  total_credits   INT DEFAULT 10,
  used_credits    INT DEFAULT 0,
  plan_credits    INT DEFAULT 0,
  purchased_credits INT DEFAULT 0,
  last_reset_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.3 Trial Lifecycle

```
ACTIVE TRIAL (Day 1-7)    → Full access, countdown banner (green)
GRACE PERIOD (Day 8-10)   → Admin access, publishing disabled (amber)
FROZEN (Day 11+)          → Billing page only, storefront shows "Coming Soon" (red)
CANCELLED (+90 days)      → Data purge, store removed

Email Sequence: Day 0 welcome → Day 4 reminder → Day 6 last day →
                Day 7 expired → Day 10 final warning → Day 11 frozen
```

### 6.4 "Launching Soon" Page (Draft Storefronts)

When `stores.status = 'draft'`, visitors to `{store}.letbuyy.store` see a branded "Launching Soon" page showing the store name, site type label, and a "Notify Me When Live" email capture form. Powered by LetBuyy branding at the bottom.

---

## 7. Site Types & Adaptive UI Engine

### 7.1 Feature Matrix (per Site Type)

| Feature | 🛒 Store | 🎨 Portfolio | 📄 Resume | ✍️ Blog | 🚀 Landing |
|---|:---:|:---:|:---:|:---:|:---:|
| Products & Variants | ✅ | ❌ | ❌ | ❌ | ❌ |
| Orders & Lifecycle | ✅ | ❌ | ❌ | ❌ | ❌ |
| Inventory Tracking | ✅ | ❌ | ❌ | ❌ | ❌ |
| Coupons & Discounts | ✅ | ❌ | ❌ | ❌ | ❌ |
| Shipping Zones | ✅ | ❌ | ❌ | ❌ | ❌ |
| Customers & Cart | ✅ | ❌ | ❌ | ❌ | ❌ |
| Blog Posts (Tiptap) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Categories (hierarchical) | ❌ | ❌ | ❌ | ✅ | ❌ |
| Tags + Comments | ❌ | ❌ | ❌ | ✅ | ❌ |
| Media Library | ❌ | ✅ | ❌ | ✅ | ❌ |
| Newsletter / RSS | ❌ | ❌ | ❌ | ✅ | ✅ (waitlist) |
| Content Versioning | ❌ | ❌ | ❌ | ✅ | ❌ |
| Projects / Gallery | ❌ | ✅ | ❌ | ❌ | ❌ |
| Skills / Expertise | ❌ | ✅ | ✅ | ❌ | ❌ |
| Work Experience | ❌ | ❌ | ✅ | ❌ | ❌ |
| PDF/DOCX Export | ❌ | ❌ | ✅ | ❌ | ❌ |
| ATS Scoring (AI) | ❌ | ❌ | ✅ | ❌ | ❌ |
| Landing Sections (Craft.js) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Form Builder | ❌ | ✅ | ❌ | ❌ | ✅ |
| A/B Testing | ❌ | ❌ | ❌ | ❌ | ✅ |
| Page Builder | ✅ | ✅ | ❌ | ✅ | ✅ |
| AI Studio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ (revenue) | ✅ (views) | ✅ (views) | ✅ (reads) | ✅ (conversions) |

### 7.2 Admin Sidebar Navigation (per Site Type)

```
E-COMMERCE         PORTFOLIO          RESUME             BLOG               LANDING
──────────────     ──────────────     ──────────────     ──────────────     ──────────────
📊 Dashboard        📊 Dashboard        📊 Dashboard        📊 Dashboard        📊 Dashboard
📦 Products         🖼️  Projects         💼 Experience       📝 Posts            🧩 Sections
📋 Orders           🎨 Gallery          🎯 Skills           📁 Categories       📝 Forms
📊 Inventory        🏷️  Skills           🎓 Education        🏷️  Tags             🎯 CTA Builder
🎫 Coupons          🎓 Education        📜 Certifications   💬 Comments         🧪 A/B Tests
🚚 Shipping         💬 Testimonials     📄 PDF Export       🖼️  Media Library
👥 Customers        📬 Contact Form     🤖 ATS Score        📧 Subscribers
─── Common ───     ─── Common ───     ─── Common ───     ─── Common ───     ─── Common ───
🌐 Pages            🌐 Pages                                🌐 Pages            🌐 Pages
🤖 AI Studio        🤖 AI Studio        🤖 AI Studio        🤖 AI Studio        🤖 AI Studio
📈 Analytics        📈 Analytics        📈 Analytics        📈 Analytics        📈 Analytics
⚙️  Settings          ⚙️  Settings          ⚙️  Settings          ⚙️  Settings          ⚙️  Settings
```

### 7.3 Dashboard Widgets (per Site Type)

| Widget | Store | Portfolio | Resume | Blog | Landing |
|---|---|---|---|---|---|
| Hero Metric 1 | Total Revenue | Portfolio Views | Profile Views | Total Reads | Page Views |
| Hero Metric 2 | Orders Today | Projects Count | ATS Score | Posts Published | Conversion Rate |
| Hero Metric 3 | Conversion Rate | Inquiry Count | Download Count | Subscribers | Form Submissions |
| Chart | Revenue/time | Views/time | Views/time | Reads/time | Conversions/time |
| AI Suggestion | "Write description for X" | "Generate project summary" | "Improve resume bullet" | "Generate post ideas" | "Optimize CTA copy" |

---

## 8. Technology Stack (Deep Dive)

### 8.1 Web Apps (Next.js 15)

| Library | Version | Purpose |
|---|---|---|
| Next.js | 15.1+ | App Router, Server Components, Streaming SSR, ISR |
| React | 19.x | Concurrent features, `use()` hook, Server Components |
| TypeScript | 5.5+ | Strict mode, template literal types |
| Tailwind CSS | 4.0 | CSS-first config, Lightning CSS engine |
| shadcn/ui | Latest | Radix Primitives, copy-paste components |
| React Hook Form | 7.x | Form state + Zod schema validation |
| Recharts | 2.x | Composable SVG charts (analytics dashboards) |
| TanStack Table | v8 | Sorting, filtering, pagination, virtual scroll |
| Cmdk | Latest | ⌘K command palette for quick navigation |
| Tiptap | 2.x | ProseMirror-based rich text editor (blog CMS) |
| DOMPurify | 3.x | XSS-safe HTML rendering for blog content |
| Craft.js | 1.x | React page builder with 30+ drag-drop blocks |
| Framer Motion | 11.x | Layout animations, gestures, exit animations |
| Sonner | 1.x | Stacked toast notifications |

### 8.2 Mobile / Desktop (Flutter 3.27+)

| Library | Purpose |
|---|---|
| Riverpod 2.x | State management with code generation |
| GoRouter | Declarative navigation with deep links |
| Dio | HTTP client with interceptors + SSL pinning |
| SharedPreferences + Hive | Local key-value + object storage |
| Firebase Cloud Messaging | Push notifications (iOS, Android, Web) |

### 8.3 API Layer (Cloudflare Workers)

| Component | Detail |
|---|---|
| Runtime | Cloudflare Workers (V8 Isolates, 0ms cold start, 180+ PoPs) |
| Framework | Hono 4.x (14KB, Express-like, middleware-rich, TypeScript-first) |
| Validation | Zod (request body + query param + path param validation) |
| Auth | Custom JWT middleware (verify Supabase JWTs, extract claims) |
| Rate Limiting | Per-store via Upstash Redis sliding window |

### 8.4 Database & Infrastructure

| Component | Detail |
|---|---|
| Database | Supabase (PostgreSQL 16, managed, auto-backups, RLS on every table) |
| Auth | Supabase Auth (JWT, OAuth2, PKCE, email OTP) |
| Storage | Cloudflare R2 (S3-compatible, zero egress fees) |
| Cache | Upstash Redis (serverless, per-request pricing, global) |
| Email | Resend (React Email templates, dark mode support) |
| Payments | Stripe (Global), Razorpay (India), PayPal (fallback) |
| Monorepo | Turborepo (shared packages, parallel builds, remote cache) |
| Deploy (Web) | Vercel (auto-deploy on push, preview environments) |
| Deploy (API) | Cloudflare Workers (wrangler CLI, zero-downtime) |
| DNS/SSL | Cloudflare (SSL termination, DDoS protection, WAF) |
| CI/CD | GitHub Actions (lint → type-check → test → build → deploy) |
| Error Tracking | Sentry (source maps, breadcrumbs, performance) |

---

## 9. AI Engine — Models, Pricing & Token Economics

### 9.1 AI Provider Strategy

4-model multi-provider strategy that auto-routes each task to the **cheapest model meeting quality requirements**:

```
USER REQUEST → TASK CLASSIFIER → MODEL ROUTING
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
   FAST & CHEAP              SMART REASONING          CREATIVE WRITING
   Gemini 3 Flash            Gemini 3 Pro              Claude Sonnet 4.5
   ~$0.001/call              ~$0.006/call               ~$0.013/call
   • SEO meta tags           • Smart pricing             • Product desc (detailed)
   • Product short desc      • Market analysis           • Blog post draft
   • Blog post ideas         • ATS scoring               • Resume bullets
   • Tag generation          • Blog SEO analysis         • Landing copy
   • Category suggest        • Trend analysis            • Project case study
   • Quick edits             • Content strategy           • Page builder sections

                    PREMIUM ANALYSIS (rare)
                    Claude Opus 4.6
                    ~$0.10/call
                    • Full business reports
                    • Comprehensive content audit
                    • Deep competitor intelligence

FALLBACK: If primary model fails → auto-retry with next-cheapest model
```

### 9.2 Model Selection Matrix

| Task | Model | Avg Tokens (In/Out) | Cost Per Call | Credits |
|---|---|---|---|---|
| Product description (short) | Gemini 3 Flash | 300 / 200 | ~$0.0008 | 1 |
| Product description (detailed) | Claude Sonnet 4.5 | 500 / 800 | ~$0.0135 | 2 |
| SEO meta tags | Gemini 3 Flash | 200 / 150 | ~$0.0006 | 1 |
| Smart pricing analysis | Gemini 3 Pro | 1,000 / 500 | ~$0.0063 | 3 |
| Blog post ideas | Gemini 3 Flash | 200 / 400 | ~$0.0013 | 1 |
| Blog post draft | Claude Sonnet 4.5 | 500 / 2,000 | ~$0.0315 | 5 |
| Blog SEO optimization | Gemini 3 Pro | 1,500 / 500 | ~$0.0069 | 3 |
| Auto-tag generation | Gemini 3 Flash | 500 / 100 | ~$0.0005 | 1 |
| Resume bullet rewrite | Claude Sonnet 4.5 | 200 / 150 | ~$0.0040 | 2 |
| ATS score analysis | Gemini 3 Pro | 2,000 / 800 | ~$0.0100 | 3 |
| Landing page copy | Claude Sonnet 4.5 | 300 / 600 | ~$0.0100 | 2 |
| Page builder AI section | Claude Sonnet 4.5 | 200 / 1,500 | ~$0.0240 | 3 |
| Full business analysis | Claude Opus 4.6 | 3,000 / 2,000 | ~$0.1050 | 10 |

### 9.3 Model Pricing (Per-Token)

| Model | Provider | Input (per 1M tokens) | Output (per 1M tokens) | Context | Max Output |
|---|---|---|---|---|---|
| **Gemini 3 Flash** | Google AI | $0.10 | $0.40 | 1M | 65,536 |
| **Gemini 3 Pro** | Google AI | $1.25 | $5.00 | 1M | 65,536 |
| **Claude Sonnet 4.5** | Anthropic | $3.00 | $15.00 | 200K | 8,192 |
| **Claude Opus 4.6** | Anthropic | $15.00 | $75.00 | 200K | 8,192 |

> **Note:** Gemini 3 Pro input > 200K tokens = 2x price. Claude 1M beta contexts = 2x price.

### 9.4 Credit System & Subscription Tiers

| Feature | Free (Trial) | Starter ($9/mo) | Business ($29/mo) | Enterprise ($99/mo) |
|---|---|---|---|---|
| Duration | 7 days | Monthly/Annual | Monthly/Annual | Monthly/Annual |
| Stores | 1 | 3 | 10 | Unlimited |
| Products | 25 | 500 | Unlimited | Unlimited |
| Blog Posts | 10 | 100 | Unlimited | Unlimited |
| Custom Domain | ❌ | ✅ (1/store) | ✅ (unlimited) | ✅ (unlimited) |
| AI Credits | 10 (one-time) | 50/month | 200/month | 1,000/month |
| Team Members | 0 | 2 | 10 | Unlimited |
| Analytics | Basic (7d) | Standard (30d) | Advanced (1yr) | Enterprise (unlimited) |
| Storage | 500 MB | 5 GB | 50 GB | 500 GB |
| Blog Layouts | Standard only | Standard + Minimal | All 4 | All 4 + custom |
| Newsletter Subs | ❌ | 100 | 5,000 | Unlimited |
| Content Versioning | ❌ | 5 versions | Unlimited | Unlimited |
| API Access | ❌ | ❌ | Rate limited | Unlimited |
| Support | Community | Email (48h) | Priority (12h) | Dedicated (1h SLA) |
| Remove branding | ❌ | ❌ | ✅ | ✅ |

Credit deduction: 1 Flash call = 1 credit, 1 Pro call = 3 credits, 1 Sonnet call = 2-5 credits, 1 Opus call = 10 credits. Credit Pack add-on: 100 credits for $3.99.

---

## 10. Session & Usage Monitoring (Redis)

### 10.1 Redis Key Schema

**Upstash Redis** (serverless, per-request pricing, global) handles all real-time monitoring:

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `ai:session:{session_id}` | HASH | 48h | Per-AI-call tracking (model, tokens, cost, latency, status) |
| `ai:store:{store_id}:daily:{date}` | HASH | 30d | Daily aggregates (total calls, tokens, cost per model) |
| `rate:{store_id}:{endpoint}` | STRING | 60s | Sliding window rate limiting per endpoint |
| `email:campaign:{id}:{user_id}` | STRING | 7d | Email de-duplication (prevent duplicate sends) |
| `cache:product:{product_id}` | STRING | 300s | Hot product page cache |
| `cache:post:{post_id}` | STRING | 300s | Blog post cache (rendered HTML) |
| `session:{user_id}` | HASH | 24h | Active session tracking (store, IP, user agent) |

### 10.2 Rate Limits by Plan

| Plan | API (req/min) | AI (req/min) |
|---|---|---|
| Free | 10 | 5 |
| Starter | 60 | 20 |
| Business | 300 | 60 |
| Enterprise | 1,000 | 200 |

### 10.3 AI Studio Dashboard

Accessible at `admin.letbuyy.store/{store}/ai-studio`:
- **Credit Balance** — remaining credits, plan vs purchased, next reset date
- **Usage Chart** — daily AI calls over 30 days (Recharts line chart)
- **Model Breakdown** — pie chart: Flash / Pro / Sonnet / Opus distribution
- **Recent Calls** — table of last 50 AI calls with model, task, tokens, cost, latency
- **Cost Forecast** — AI-projected monthly cost based on usage trend
- **Quick Actions** — "Generate Description", "Write Blog Post", "Optimize SEO" buttons

---

## 11. Database Architecture (Overview)

### 11.1 Core Tables

| Table | Purpose | RLS | Key Columns |
|---|---|---|---|
| `stores` | Store records | ✅ user_id = auth.uid() | id, user_id, subdomain, site_type, status, trial_ends_at |
| `products` | Product catalog (Store type) | ✅ store ownership | id, store_id, title, price, variants, inventory_count |
| `orders` | Order records (Store type) | ✅ store ownership | id, store_id, customer_email, status, total, items |
| `blog_posts` | Blog content (Blog type) | ✅ store ownership | id, store_id, title, slug, content, status, published_at |
| `blog_categories` | Hierarchical categories | ✅ store ownership | id, store_id, name, slug, parent_id, color |
| `blog_tags` | Flat tag taxonomy | ✅ store ownership | id, store_id, name, slug |
| `blog_comments` | Threaded comments (depth 5) | ✅ store ownership | id, post_id, author, content, parent_id, status |
| `media_files` | Media library | ✅ store ownership | id, store_id, url, type, size, folder |
| `projects` | Portfolio projects | ✅ store ownership | id, store_id, title, description, images, tech_stack |
| `experience` | Resume work entries | ✅ store ownership | id, store_id, company, role, start_date, bullets |
| `pages` | Page builder data (Craft.js JSON) | ✅ store ownership | id, store_id, title, slug, content_json |
| `ai_usage_logs` | AI call history | ✅ store ownership | id, store_id, model, task, tokens, cost, credits |
| `onboarding_attempts` | Signup attempt tracking | ✅ user_id = auth.uid() | id, user_id, subdomain, success, error_message |
| `store_surveys` | Onboarding survey answers | ✅ store ownership | id, store_id, site_type, answers |
| `ai_credits` | Credit balances | ✅ store ownership | id, store_id, total_credits, used_credits |
| `team_members` | RBAC team | ✅ store ownership | id, store_id, user_id, role, permissions |
| `email_logs` | Email delivery tracking | ✅ store ownership | id, store_id, type, status, resend_message_id |
| `activity_logs` | Audit trail | ✅ store ownership | id, store_id, user_id, action, entity, detail |
| `subscribers` | Newsletter subscribers | ✅ store ownership | id, store_id, email, confirmed, subscribed_at |
| `templates` | Store templates | Public read | id, name, site_type, preview_url, config |
| `plans` | Subscription plans | Public read | id, name, price, features, limits |

### 11.2 RLS Policy Pattern

Every table uses the same RLS pattern to ensure complete data isolation:

```sql
-- Example: stores table RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own stores"
  ON stores FOR ALL
  USING (user_id = auth.uid());

-- Example: products table RLS (through store ownership)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access products in their stores"
  ON products FOR ALL
  USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));
```

---

## 12. Cost Analysis & Revenue Model

### 12.1 Infrastructure Cost (Monthly Estimate at Scale)

| Service | Free Tier | At 1K Stores | At 10K Stores | Notes |
|---|---|---|---|---|
| Supabase | Free (500MB, 50K rows) | Pro $25/mo | Pro $25 + usage | Includes Auth, Realtime, Storage |
| Cloudflare Workers | 100K req/day free | $5/mo | $5 + $0.50/M req | Unlimited domains included |
| Vercel | Free tier | Pro $20/mo | Pro $20/team | ISR, Edge, Preview deployments |
| Upstash Redis | 10K commands/day free | Pay-per-use ~$5 | ~$20/mo | Global replication |
| Resend | 100 emails/day free | ~$20/mo | ~$80/mo | Transactional + marketing |
| Cloudflare R2 | 10GB free | ~$5/mo | ~$20/mo | Zero egress fees |
| Sentry | Free tier | $26/mo | $26/mo | Error tracking |
| **Total** | **$0** | **~$106/mo** | **~$196/mo** | |

### 12.2 Revenue Projection

| Metric | 1K Stores | 5K Stores | 10K Stores |
|---|---|---|---|
| Free users (80%) | 800 | 4,000 | 8,000 |
| Starter $9/mo (12%) | 120 → $1,080 | 600 → $5,400 | 1,200 → $10,800 |
| Business $29/mo (6%) | 60 → $1,740 | 300 → $8,700 | 600 → $17,400 |
| Enterprise $99/mo (2%) | 20 → $1,980 | 100 → $9,900 | 200 → $19,800 |
| AI Credit Packs (~5%) | 50 → $200 | 250 → $1,000 | 500 → $2,000 |
| **Monthly Revenue** | **$5,000** | **$25,000** | **$50,000** |
| **Monthly Cost** | **$106** | **$150** | **$196** |
| **Gross Margin** | **97.9%** | **99.4%** | **99.6%** |

---

## 13. Platform Metrics & SLAs

### 13.1 Performance Targets

| Metric | Target | How |
|---|---|---|
| Storefront TTFB | < 100ms (p95) | ISR + Vercel Edge Network |
| API Response Time | < 200ms (p95) | Cloudflare Workers + edge DB reads |
| AI Response Time | < 3s (p95) | Model-specific timeouts, streaming where supported |
| Uptime | 99.9% | Multi-region infra, auto-failover |
| Core Web Vitals (LCP) | < 2.5s | ISR, image optimization, lazy loading |
| Core Web Vitals (FID) | < 100ms | Code splitting, Server Components |
| Core Web Vitals (CLS) | < 0.1 | Fixed layout, dimension hints |

### 13.2 Scale Limits (Per Store)

| Resource | Free | Starter | Business | Enterprise |
|---|---|---|---|---|
| API Requests | 10/min | 60/min | 300/min | 1,000/min |
| Storage | 500 MB | 5 GB | 50 GB | 500 GB |
| Products | 25 | 500 | Unlimited | Unlimited |
| Blog Posts | 10 | 100 | Unlimited | Unlimited |
| Pages | 5 | 20 | Unlimited | Unlimited |
| Team Members | 0 | 2 | 10 | Unlimited |
| AI Credits | 10 (one-time) | 50/month | 200/month | 1,000/month |

### 13.3 Security Measures

| Layer | Measure | Implementation |
|---|---|---|
| Database | Row Level Security (RLS) | Every table, no exceptions — enforced at PostgreSQL level |
| Auth | JWT + Refresh tokens | Supabase Auth, 1h access token, 7d refresh |
| Admin | 2FA optional | TOTP via authenticator app |
| Console | VPN + 2FA + IP allowlist | Triple-gated access for super admin |
| API | Rate limiting | Per-store sliding window via Upstash Redis |
| API | Input validation | Zod schema validation on every endpoint |
| API | CORS | Per-domain allowlist (only *.letbuyy.store) |
| API | CSRF | Double-submit cookie pattern on mutations |
| Webhooks | Signature verification | Stripe/Razorpay webhook signatures verified |
| Content | XSS prevention | DOMPurify sanitization on all user HTML (blog) |
| Network | DDoS protection | Cloudflare WAF + Bot Management |
| Network | SSL/TLS | TLS 1.2+ minimum, HSTS preload, Full (strict) |
| Audit | Activity logging | All mutations logged with user, action, entity, diff |

---

## Blog System — Key Components

### Content Management

| Component | Technology | Detail |
|---|---|---|
| Rich Text Editor | Tiptap (ProseMirror) | Headings, bold, italic, lists, code blocks, images, embeds, tables |
| Content Sanitization | DOMPurify | Server-side sanitization before save + client-side before render |
| Content Versioning | Custom (PostgreSQL) | Diff viewer (changed blocks highlighted), rollback to any version |
| Scheduled Publishing | Cron (Supabase) | `scheduled_at` field, cron job publishes at specified time |
| Reading Time | Auto-calculated | ~200 words/min, stored in `reading_time_minutes` column |

### Blog Layouts (4 Options)

| Layout | Description | Best For |
|---|---|---|
| **Standard** | Classic single-column blog with sidebar (categories, tags, recent posts) | Personal blogs, tech blogs |
| **Magazine** | Multi-column card grid with featured post hero | News sites, content-heavy blogs |
| **Minimal** | Clean, typography-focused single column, no sidebar | Writing-focused blogs, essays |
| **Grid** | Pinterest-style masonry cards with image-heavy previews | Photography, visual blogs |

### Comment System

| Feature | Detail |
|---|---|
| Threading | Max depth: 5 levels |
| Moderation Queue | Status: pending → approved / spam / trash |
| Guest Comments | Name + email required (no account needed) |
| Auto-moderation | AI-assisted spam detection on Business+ plans |
| Notification | Email to post author on new comment (configurable) |

---

> **→ Next:** [01 Architecture](./01_Architecture.md)
> **→ Full doc series:** 00_Overview → 01_Architecture → 02_Auth → 03_Onboarding → 04_Admin → 05_Ecommerce → 06_Portfolio → 07_AI → 08_Database → 09_API → 10_Storefront → 11_SuperAdmin → 12_Roadmap → 13_Plans → 14_Themes → 15_AppStore → 16_Customers
>
> **See also:** [13 Plans & Pricing](./13_Plans_and_Pricing.md) · [14 Theme Implementation](./14_Theme_Implementation.md) · [15 App Store Implementation](./15_App_Store_Implementation.md) · [16 Customer Management](./16_Customer_Management.md)
