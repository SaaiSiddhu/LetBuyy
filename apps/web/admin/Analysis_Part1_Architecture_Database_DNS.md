# LetBuyy Multi-Tenant Store Platform — Comprehensive Analysis

> **Part 1 of 3** | Architecture, Database Schema, DNS/SSL & Domain Topology
>
> **Date:** February 12, 2026 | **Continues in:** Part 2 (Implementation & Onboarding UI)

---

## 1. Executive Summary & Gap Analysis

### 1.1 What We're Building

LetBuyy is a **multi-tenant SaaS platform** where users sign up, complete onboarding, and instantly get a live subdomain (`username.letbuyy.store`). The platform supports 4 site types: **E-commerce**, **Portfolio**, **Resume/CV**, and **Landing Page**.

### 1.2 Current State vs Target State

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     CURRENT STATE → TARGET STATE                         │
├─────────────────────────────┬────────────────────────────────────────────┤
│ ❌ Onboarding UI uses        │ ✅ Unified auth design system (purple      │
│    hardcoded dark/emerald    │    theme, CSS variables, auto dark mode)  │
├─────────────────────────────┼────────────────────────────────────────────┤
│ ❌ No email notifications    │ ✅ Branded React Email templates via       │
│    on store creation         │    Resend API (success + failure)         │
├─────────────────────────────┼────────────────────────────────────────────┤
│ ❌ Manual DNS for each       │ ✅ Wildcard DNS (*.letbuyy.store)          │
│    new store                 │    → instant subdomain provisioning       │
├─────────────────────────────┼────────────────────────────────────────────┤
│ ❌ Users can access admin    │ ✅ Onboarding gate: must create store      │
│    without completing setup  │    before accessing admin dashboard       │
├─────────────────────────────┼────────────────────────────────────────────┤
│ ❌ No "Launching Soon" page  │ ✅ Draft stores show branded coming-soon   │
│    for new stores            │    page with store info                   │
├─────────────────────────────┼────────────────────────────────────────────┤
│ ❌ Single language (English) │ ✅ Multi-language: English, Hindi, Tamil   │
└─────────────────────────────┴────────────────────────────────────────────┘
```

---

## 2. Architecture Deep Dive

### 2.1 High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INTERNET (User's Browser)                          │
└──────────────────────────────────┬──────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE DNS LAYER                               │
│                                                                             │
│  ┌──────────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │ Static Subdomains│   │ Wildcard Match   │   │ API/Worker Subdomains  │  │
│  │ accounts.*       │   │ *.letbuyy.store  │   │ api.* (Proxied ✅)     │  │
│  │ admin.*          │   │ → Vercel CNAME   │   │ webhooks.* (Proxied ✅)│  │
│  │ console.*        │   │ (DNS only ❌)    │   │ → Cloudflare Workers   │  │
│  │ team.*           │   │                  │   │                        │  │
│  │ → Vercel CNAME   │   │                  │   │                        │  │
│  │ (DNS only ❌)    │   │                  │   │                        │  │
│  └────────┬─────────┘   └────────┬─────────┘   └───────────┬────────────┘  │
│           │                      │                          │               │
└───────────┼──────────────────────┼──────────────────────────┼───────────────┘
            │                      │                          │
            ▼                      ▼                          ▼
┌────────────────────────────────────────────┐   ┌─────────────────────────┐
│              VERCEL EDGE NETWORK            │   │  CLOUDFLARE WORKERS     │
│                                             │   │                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │   │  ┌───────────────────┐  │
│  │accounts │ │ admin   │ │console  │      │   │  │ api.letbuyy.store │  │
│  │Next.js  │ │ Next.js │ │Next.js  │      │   │  │ REST endpoints    │  │
│  └────┬────┘ └────┬────┘ └────┬────┘      │   │  └───────────────────┘  │
│       │           │           │            │   │                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐     │   │  ┌───────────────────┐  │
│  │ team    │ │storefront│ │landing  │     │   │  │webhooks.letbuyy.* │  │
│  │Next.js  │ │ Next.js  │ │Next.js  │     │   │  │ Event handlers    │  │
│  └─────────┘ └────┬────┘ └─────────┘     │   │  └───────────────────┘  │
│                    │                       │   │                         │
│         Dynamic routing for                │   └─────────────────────────┘
│         *.letbuyy.store                    │
└────────────────────┬───────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE (PostgreSQL 15)                           │
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐               │
│  │ auth.users   │  │   stores     │  │  email_logs        │               │
│  │ (Supabase    │  │ (Core entity)│  │ (Notification      │               │
│  │   Auth)      │  │              │  │   tracking)        │               │
│  └──────┬───────┘  └──────┬───────┘  └────────────────────┘               │
│         │                 │                                                │
│         │  ┌──────────────┴──────────────┐                                │
│         │  │    onboarding_attempts      │                                │
│         │  │    (Failure tracking)       │                                │
│         │  └─────────────────────────────┘                                │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                    ROW LEVEL SECURITY (RLS)                           │  │
│  │  • Users can only read/write their OWN stores                       │  │
│  │  • Users can only read their OWN email logs                         │  │
│  │  • Users can only read/write their OWN onboarding attempts          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Application Map — All 8 Subdomains

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         APP ECOSYSTEM MAP                                  │
├───────────────┬────────────────────────┬────────────┬──────────────────────┤
│ Subdomain     │ Purpose                │ Framework  │ Deploy Target        │
├───────────────┼────────────────────────┼────────────┼──────────────────────┤
│ letbuyy.store │ Marketing / Landing    │ Next.js 14 │ Vercel (Edge)        │
│ accounts.*    │ Auth portal (signup,   │ Next.js 14 │ Vercel (Edge)        │
│               │ login, onboarding)     │            │                      │
│ admin.*       │ Store builder CMS      │ Next.js 14 │ Vercel (Edge)        │
│ console.*     │ Super admin panel      │ Next.js 14 │ Vercel (Edge)        │
│ team.*        │ Employee portal        │ Next.js 14 │ Vercel (Edge)        │
│ *.*           │ User storefronts       │ Next.js 14 │ Vercel (Wildcard)    │
│ api.*         │ REST API endpoints     │ Workers    │ Cloudflare (Proxied) │
│ webhooks.*    │ Webhook event handlers │ Workers    │ Cloudflare (Proxied) │
└───────────────┴────────────────────────┴────────────┴──────────────────────┘
```

---

## 3. Complete User Journey — Flow Analysis

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE USER JOURNEY                            │
└──────────────────────────────────────────────────────────────────────────┘

 ┌─────────────┐
 │  1. DISCOVER │  User visits letbuyy.store → Clicks "Get Started"
 └──────┬──────┘
        │
        ▼
 ┌─────────────┐                    ┌──────────────────────────────────┐
 │ 2. LOOKUP   │  accounts.letbuyy. │  ┌───────────────────────────┐  │
 │    EMAIL    │  store/lookup      │  │  Enter your email address │  │
 └──────┬──────┘                    │  │  ┌───────────────────────┐│  │
        │                           │  │  │ user@example.com     ││  │
        │                           │  │  └───────────────────────┘│  │
        │                           │  │  [    Continue →    ]     │  │
        │                           │  └───────────────────────────┘  │
        │                           └──────────────────────────────────┘
        │
        ├─── Email EXISTS? ──┐
        │                    │
   ┌────▼────┐          ┌────▼────┐
   │ SIGNUP  │          │  LOGIN  │
   │ /signup │          │ /login  │
   └────┬────┘          └────┬────┘
        │                    │
        ▼                    │
 ┌──────────────┐            │
 │ 3. VERIFY    │            │
 │ Click email  │            │
 │ link → set   │            │
 │ password     │            │
 └──────┬───────┘            │
        │                    │
        └────────┬───────────┘
                 │
                 ▼
 ┌───────────────────────┐
 │ 4. ONBOARDING CHECK   │   Session created → has store?
 │    (Server-side)      │
 └───────────┬───────────┘
             │
        ┌────┴────┐
        │         │
   HAS STORE   NO STORE
        │         │
        ▼         ▼
  ┌──────────┐  ┌──────────────────────────────────────┐
  │ REDIRECT │  │  5. ONBOARDING FLOW                   │
  │ to admin │  │                                       │
  │ dashboard│  │  Step 1: Select site type              │
  └──────────┘  │   (E-commerce/Portfolio/Resume/Landing)│
                │                                       │
                │  Step 2: Enter store name              │
                │   (validates subdomain availability)   │
                │                                       │
                │  Submit → Create store in database     │
                └──────────────────┬────────────────────┘
                                   │
                              ┌────┴────┐
                              │         │
                          SUCCESS    FAILURE
                              │         │
                              ▼         ▼
                   ┌──────────────┐  ┌──────────────┐
                   │ 6a. SUCCESS  │  │ 6b. FAILURE  │
                   │ • Send email │  │ • Send email │
                   │ • Create DNS │  │ • Show error │
                   │ • → Admin    │  │ • Allow retry│
                   └──────┬───────┘  └──────────────┘
                          │
                          ▼
                   ┌──────────────────────────────────┐
                   │ 7. STOREFRONT ACCESS              │
                   │  {subdomain}.letbuyy.store        │
                   │                                   │
                   │  Published? → Show live store     │
                   │  Draft?     → Show "Launching     │
                   │               Soon" page          │
                   └──────────────────────────────────┘
```

---

## 4. Database Schema — Complete Analysis

### 4.1 Entity Relationship Diagram (Text)

```
┌────────────────────────────────────────────────────────────────────────┐
│                    ENTITY RELATIONSHIP DIAGRAM                         │
└────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐         ┌──────────────────────────────────────┐
  │   auth.users    │         │              stores                  │
  │  (Supabase)     │         │                                      │
  ├─────────────────┤    1:N  ├──────────────────────────────────────┤
  │ id         UUID │◄────────│ user_id         UUID (FK)            │
  │ email    VARCHAR│         │ id              UUID (PK)            │
  │ ...            │         │ subdomain       VARCHAR(63) UNIQUE   │
  └────────┬────────┘         │ store_name      VARCHAR(100)         │
           │                  │ store_type      VARCHAR(20)          │
           │                  │   CHECK: ecommerce|portfolio|        │
           │                  │          resume|landing              │
           │                  │ status          VARCHAR(20)          │
           │                  │   CHECK: draft|published|suspended   │
           │                  │ contact_email   VARCHAR(255)         │
           │                  │ created_at      TIMESTAMPTZ          │
           │                  │ updated_at      TIMESTAMPTZ          │
           │                  │ published_at    TIMESTAMPTZ          │
           │                  └──────────┬───────────────────────────┘
           │                             │
           │  1:N                        │ 1:N
           ▼                             ▼
  ┌──────────────────────┐    ┌──────────────────────────────────────┐
  │  onboarding_attempts │    │           email_logs                 │
  ├──────────────────────┤    ├──────────────────────────────────────┤
  │ id          UUID(PK) │    │ id                 UUID (PK)         │
  │ user_id     UUID(FK) │    │ user_id            UUID (FK)         │
  │ subdomain   VARCHAR  │    │ store_id           UUID (FK)         │
  │ store_type  VARCHAR  │    │ email_type         VARCHAR(50)       │
  │ success     BOOLEAN  │    │ recipient_email    VARCHAR(255)      │
  │ error_code  VARCHAR  │    │ subject            TEXT               │
  │ error_msg   TEXT     │    │ status  (pending|sent|failed|bounced)│
  │ attempted_at TSTAMPTZ│    │ provider           VARCHAR(50)       │
  │                      │    │ provider_message_id VARCHAR(255)     │
  │ INDEX: user_id       │    │ error_message      TEXT               │
  │ INDEX: success       │    │ metadata           JSONB              │
  └──────────────────────┘    │ created_at, sent_at TIMESTAMPTZ      │
                              │                                      │
                              │ INDEXES: user_id, email_type,        │
                              │          status, created_at DESC     │
                              └──────────────────────────────────────┘
```

### 4.2 Subdomain Validation Rules

```
┌────────────────────────────────────────────────────────────────────┐
│                   SUBDOMAIN VALIDATION RULES                       │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  Regex: ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$                       │
│                                                                    │
│  ✅ VALID:    mystore, cool-shop, store123, a-b-c                  │
│  ❌ INVALID:  -mystore, mystore-, My_Store, store..name            │
│                                                                    │
│  RESERVED (cannot use):                                            │
│  • accounts, admin, console, team, api, webhooks                   │
│  • www, mail, ftp, localhost, letbuyy                               │
│  • seller, buyer, customer, support, help, contact                 │
│  • about, terms, privacy, policy, faq, blog, press                 │
│  • careers, investors, partners, affiliates, legal                 │
│                                                                    │
│  Max length: 63 characters (DNS label limit)                       │
│  Min length: 4 character                                           │
│  Allowed chars: a-z, 0-9, hyphen (-)                               │
│  Must start and end with letter or number                          │
└────────────────────────────────────────────────────────────────────┘
```

### 4.3 RLS Security Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                    ROW LEVEL SECURITY MATRIX                           │
├────────────────┬──────────┬──────────┬──────────┬─────────────────────┤
│ Table          │ SELECT   │ INSERT   │ UPDATE   │ DELETE              │
├────────────────┼──────────┼──────────┼──────────┼─────────────────────┤
│ stores         │ Own rows │ Own rows │ Own rows │ ❌ Not allowed       │
│ email_logs     │ Own rows │ ❌ Server │ ❌ Server │ ❌ Not allowed       │
│ onboarding_    │ Own rows │ Own rows │ ❌ N/A    │ ❌ Not allowed       │
│ attempts       │          │          │          │                     │
└────────────────┴──────────┴──────────┴──────────┴─────────────────────┘
  All policies use: auth.uid() = user_id
  Email logs INSERT/UPDATE handled by server-side API routes only
```

---

## 5. DNS & SSL Configuration Analysis

### 5.1 Complete DNS Record Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE DNS ZONE: letbuyy.store                 │
├───────────┬──────────────────────────┬────────┬─────────┬──────────────┤
│ Type      │ Name                     │ Target │ Proxy   │ Purpose      │
├───────────┼──────────────────────────┼────────┼─────────┼──────────────┤
│ A         │ @ (root)                 │76.76.  │ DNS     │ Marketing    │
│           │                          │21.21   │ only ❌  │ landing page │
├───────────┼──────────────────────────┼────────┼─────────┼──────────────┤
│ CNAME     │ accounts                 │cname.  │ DNS     │ Auth portal  │
│ CNAME     │ admin                    │vercel- │ only ❌  │ Store CMS    │
│ CNAME     │ console                  │dns.com │ only ❌  │ Super admin  │
│ CNAME     │ team                     │        │ only ❌  │ Employee     │
├───────────┼──────────────────────────┼────────┼─────────┼──────────────┤
│ CNAME     │ * (WILDCARD)             │cname.  │ DNS     │ User stores  │
│           │ ⚠️  CRITICAL RECORD      │vercel- │ only ❌  │ Dynamic      │
│           │                          │dns.com │         │ subdomains   │
├───────────┼──────────────────────────┼────────┼─────────┼──────────────┤
│ AAAA      │ api                      │ 100::  │Proxied  │ REST API     │
│ AAAA      │ webhooks                 │ 100::  │  ✅     │ Webhooks     │
└───────────┴──────────────────────────┴────────┴─────────┴──────────────┘

  ⚠️  Wildcard MUST be DNS-only (not proxied) for Vercel SSL to work
  ⚠️  API/Webhooks MUST be proxied for Cloudflare Workers routing
```

### 5.2 SSL Certificate Chain

```
┌──────────────────────────────────────────────────────────────────┐
│                      SSL CERTIFICATE CHAIN                       │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Browser ──HTTPS──► Cloudflare (Edge)                           │
│                       │                                          │
│                       ├── Proxied records (api, webhooks):       │
│                       │   Cloudflare Universal SSL → Worker      │
│                       │                                          │
│                       └── DNS-only records (all others):         │
│                           Pass-through to Vercel                 │
│                           │                                      │
│                           ▼                                      │
│                       Vercel Edge Network                        │
│                       Let's Encrypt SSL auto-cert                │
│                       (Including *.letbuyy.store wildcard)       │
│                                                                  │
│   Cloudflare Settings:                                           │
│   ├── Encryption: Full (strict)                                  │
│   ├── Always Use HTTPS: ✅                                       │
│   ├── HSTS: Max-Age 6 months, include subdomains, preload       │
│   ├── Min TLS: 1.2                                               │
│   └── TLS 1.3: ✅                                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Tech Stack Dependency Analysis

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         TECHNOLOGY STACK                                  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FRONTEND                          BACKEND                               │
│  ┌──────────────────────┐          ┌──────────────────────────┐         │
│  │ Next.js 14.2.x       │          │ Supabase (PostgreSQL 15) │         │
│  │ TypeScript 5.x       │          │ Supabase Auth (JWT)      │         │
│  │ Tailwind CSS 3.4.x   │          │ Next.js API Routes       │         │
│  │ Lucide React Icons   │          │ Cloudflare Workers       │         │
│  │ Inter / Fira Code    │          │ Resend API (email)       │         │
│  │ (fonts)              │          │ Supabase Storage (media) │         │
│  └──────────────────────┘          └──────────────────────────┘         │
│                                                                          │
│  INFRASTRUCTURE                    NEW DEPENDENCIES                      │
│  ┌──────────────────────┐          ┌──────────────────────────┐         │
│  │ Vercel (Edge)        │          │ react-email ^2.1.0       │         │
│  │ Cloudflare DNS       │          │ @react-email/components  │         │
│  │ Cloudflare SSL       │          │ resend ^3.2.0            │         │
│  │ Let's Encrypt (auto) │          │ date-fns ^3.3.1          │         │
│  │ Vercel Analytics     │          │                          │         │
│  └──────────────────────┘          └──────────────────────────┘         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

> **→ Continues in [Part 2](./Analysis_Part2_Implementation_Onboarding_Email.md):**
> Implementation Code Analysis, Onboarding UI Wireframes (all states), Email Template Wireframes

