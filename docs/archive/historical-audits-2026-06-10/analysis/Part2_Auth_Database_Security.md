# LetBuyy Platform — Comprehensive Analysis & Implementation Plan

## Part 2: Authentication, Database, Onboarding & Security

> **Continued from Part 1** — Platform Architecture & Overview

---

## 7. Authentication Architecture

### 7.1 Four-Tier Auth Strategy

LetBuyy implements **four distinct authentication tiers**, each with different security requirements:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     FOUR-TIER AUTHENTICATION MODEL                          ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  TIER 1: PLATFORM USERS (Store Owners)                                       ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │  Location: accounts.letbuyy.store                                      │  ║
║  │  Method:   Email + OTP + Password (bcrypt 10 rounds)                   │  ║
║  │  OAuth:    Google (✅ built), GitHub (planned), Microsoft (planned)     │  ║
║  │  Token:    JWT via jose (1h access) + Supabase session (7d refresh)    │  ║
║  │  Storage:  HTTP-only + Secure + SameSite=Strict cookies                │  ║
║  │  Status:   ✅ 85% complete                                              │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
║  TIER 2: STOREFRONT CUSTOMERS (End buyers)                                   ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │  Location: {store}.letbuyy.store                                       │  ║
║  │  Method:   Email + Password (per-store customer accounts)              │  ║
║  │  Table:    customer_credentials (store-scoped)                         │  ║
║  │  Secret:   CUSTOMER_SESSION_SECRET (separate from platform AUTH)       │  ║
║  │  Scope:    Customer can only access the store they signed up for       │  ║
║  │  Status:   🔶 30% complete                                              │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
║  TIER 3: EMPLOYEE PORTAL                                                     ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │  Location: team.letbuyy.store                                          │  ║
║  │  Method:   Company email allowlist + invited by store owner            │  ║
║  │  Access:   14-scope RBAC (products.read, orders.manage, etc.)          │  ║
║  │  Status:   ❌ 5% (scaffold only)                                       │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
║                                                                              ║
║  TIER 4: SUPER ADMIN (Highest security)                                      ║
║  ┌────────────────────────────────────────────────────────────────────────┐  ║
║  │  Location: console.letbuyy.store                                       │  ║
║  │  Method:   Email allowlist + Mandatory 2FA (TOTP) + VPN + IP whitelist │  ║
║  │  Timeout:  15-minute session timeout                                   │  ║
║  │  Status:   ❌ NONE implemented (scaffold only)                         │  ║
║  └────────────────────────────────────────────────────────────────────────┘  ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### 7.2 Signup Flow (Complete Wireframe)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SIGNUP FLOW — accounts.letbuyy.store/signup                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: EMAIL ENTRY                                                         │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                                                              │           │
│  │  ┌──────────────────────────────────────────────────────┐   │           │
│  │  │  LetBuyy Logo                                        │   │           │
│  │  │  "Create your account"                               │   │           │
│  │  │                                                      │   │           │
│  │  │  Email address                                       │   │           │
│  │  │  ┌──────────────────────────────────────────────┐   │   │           │
│  │  │  │  yourname@example.com                        │   │   │           │
│  │  │  └──────────────────────────────────────────────┘   │   │           │
│  │  │                                                      │   │           │
│  │  │  [  Turnstile Bot Check Widget  ]                    │   │           │
│  │  │                                                      │   │           │
│  │  │  ┌────────────────────────────────┐                  │   │           │
│  │  │  │       Continue →               │                  │   │           │
│  │  │  └────────────────────────────────┘                  │   │           │
│  │  │                                                      │   │           │
│  │  │  ─ or ─                                              │   │           │
│  │  │                                                      │   │           │
│  │  │  [G] Continue with Google                            │   │           │
│  │  │  [ ] Continue with GitHub  (planned)                 │   │           │
│  │  │                                                      │   │           │
│  │  │  Already have an account? [Log in →]                 │   │           │
│  │  └──────────────────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                              │
│  Backend: POST /api/auth/lookup (rate: 10/min/IP)                           │
│  → Disposable email blocked (50+ domains)                                   │
│  → Email exists? → redirect to /login                                       │
│  → Email new? → send OTP via Resend                                         │
│                                                                              │
│  STEP 2: OTP VERIFICATION                                                    │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                                                              │           │
│  │  ┌──────────────────────────────────────────────────────┐   │           │
│  │  │  "Verify your email"                                 │   │           │
│  │  │  We sent a 6-digit code to user@example.com          │   │           │
│  │  │                                                      │   │           │
│  │  │  ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐               │   │           │
│  │  │  │ 4 │ │ 2 │ │ 7 │ │ 8 │ │ 1 │ │ 3 │               │   │           │
│  │  │  └───┘ └───┘ └───┘ └───┘ └───┘ └───┘               │   │           │
│  │  │                                                      │   │           │
│  │  │  ⏱ Code expires in 9:42                              │   │           │
│  │  │  Didn't receive? [Resend code]                       │   │           │
│  │  │                                                      │   │           │
│  │  │  ┌────────────────────────────────┐                  │   │           │
│  │  │  │       Verify →                 │                  │   │           │
│  │  │  └────────────────────────────────┘                  │   │           │
│  │  └──────────────────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                              │
│  Constraints: 6-digit code, 10 min expiry, max 3 attempts                   │
│  POST /api/auth/verify-otp (rate: 3/min/IP)                                 │
│                                                                              │
│  STEP 3: PASSWORD CREATION                                                   │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │  ┌──────────────────────────────────────────────────────┐   │           │
│  │  │  "Set your password"                                 │   │           │
│  │  │                                                      │   │           │
│  │  │  Password                                            │   │           │
│  │  │  ┌──────────────────────────────────────────────┐   │   │           │
│  │  │  │  ••••••••••••                       [👁]     │   │   │           │
│  │  │  └──────────────────────────────────────────────┘   │   │           │
│  │  │  ✅ 8+ characters  ✅ Uppercase  ✅ Number  ❌ Special│   │           │
│  │  │                                                      │   │           │
│  │  │  Confirm Password                                    │   │           │
│  │  │  ┌──────────────────────────────────────────────┐   │   │           │
│  │  │  │  ••••••••••••                       [👁]     │   │   │           │
│  │  │  └──────────────────────────────────────────────┘   │   │           │
│  │  │                                                      │   │           │
│  │  │  ┌────────────────────────────────┐                  │   │           │
│  │  │  │       Create Account →         │                  │   │           │
│  │  │  └────────────────────────────────┘                  │   │           │
│  │  └──────────────────────────────────────────────────────┘   │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                              │
│  Backend: bcrypt hash (min 10 rounds), Supabase Auth user created,          │
│  JWT issued via jose → HTTP-only cookie → redirect to onboarding            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Auth Middleware Chain (Every API Request)

```
┌─────────────── API MIDDLEWARE CHAIN (Sequential) ──────────────────────────┐
│                                                                             │
│  REQUEST ──►│ 1 │──►│ 2 │──►│ 3 │──►│ 4 │──►│ 5 │──►│ 6 │──►│ 7 │──► OK│
│             │   │   │   │   │   │   │   │   │   │   │   │   │   │        │
│             ▼   │   ▼   │   ▼   │   ▼   │   ▼   │   ▼   │   ▼   │        │
│           CORS  │ RATE  │ BOT   │ JWT   │CSRF   │PERMS  │TRIAL  │        │
│                 │ LIMIT │ PROT  │ VALID │ VALID  │CHECK  │CHECK  │        │
│                 │       │       │       │        │       │       │        │
│  Status:   ✅   │  🔶   │  ✅   │  ✅   │  ❌    │  ✅   │  🔶   │        │
│  (working) │(in-mem) │(auth  │(working)│(NOT   │(via   │(partial)│       │
│             │(not    │ only) │       │ IMPL)  │ RLS)  │       │        │
│             │Redis)  │       │       │        │       │       │        │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
  1. CORS — Verify origin is in whitelist (defined, needs verification)
  2. Rate Limiter — IP/email against Upstash Redis (only some auth endpoints)
  3. Bot Protection — Turnstile verification (auth forms only)
  4. JWT Validation — jose + Supabase composite verification
  5. CSRF Validation — Double-submit cookie (SECRET exists, NO middleware)
  6. Permissions — User has access to requested store (via RLS policies)
  7. Trial Check — Store within trial period or has active subscription
```

### 7.4 Token Lifecycle

```
┌─────────────── TOKEN STRATEGY ─────────────────────────────────────────────┐
│                                                                             │
│  TOKEN TYPE    │ LIBRARY  │ LIFETIME │ STORAGE      │ ROTATION    │ STATUS │
│  ──────────────┼──────────┼──────────┼──────────────┼─────────────┼────────│
│  Access Token  │ jose JWT │ 1 hour   │ HTTP-only    │ On expiry   │ ✅     │
│                │          │          │ cookie       │ via refresh │        │
│  ──────────────┼──────────┼──────────┼──────────────┼─────────────┼────────│
│  Refresh Token │ Supabase │ 7 days   │ HTTP-only    │ On use      │ ❌ GAP │
│                │          │          │ cookie       │ (NOT IMPL)  │        │
│  ──────────────┼──────────┼──────────┼──────────────┼─────────────┼────────│
│  CSRF Token    │ Custom   │ Session  │ Double-submit│ Per session │ ❌ GAP │
│                │          │          │ cookie       │             │        │
│  ──────────────┼──────────┼──────────┼──────────────┼─────────────┼────────│
│  OTP           │ Random   │ 10 min   │ Supabase     │ Single-use  │ ✅     │
│                │ 6-digit  │          │ metadata     │             │        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Database Schema

### 8.1 Entity-Relationship Overview

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    DATABASE SCHEMA — 30+ Tables                          ║
║                    PostgreSQL 16 via Supabase                            ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  ┌─── AUTH (Supabase-managed) ──────────────────────────────────────┐   ║
║  │  auth.users ──────┐                                               │   ║
║  │  profiles ────────┘ (1:1 extended metadata)                       │   ║
║  └───────────────────────────────────────────────────────────────────┘   ║
║         │ user_id FK                                                     ║
║         ▼                                                                ║
║  ┌─── PLATFORM CORE ────────────────────────────────────────────────┐   ║
║  │  sites (THE central entity — called "store" in UI/URLs)          │   ║
║  │  ├── id UUID PK                                                   │   ║
║  │  ├── user_id FK → auth.users                                     │   ║
║  │  ├── subdomain UNIQUE                                             │   ║
║  │  ├── site_type ENUM (store│portfolio│resume│blog│landing_page)    │   ║
║  │  ├── status ENUM (draft│published│suspended│deleted)              │   ║
║  │  ├── trial_ends_at TIMESTAMPTZ                                    │   ║
║  │  └── settings JSONB                                               │   ║
║  └──────┬───┬───┬───┬───┬───────────────────────────────────────────┘   ║
║         │   │   │   │   │ site_id FK on all child tables                 ║
║         ▼   │   │   │   ▼                                                ║
║  ┌─── E-COMMERCE ──┐│   │ ┌─── CONTENT ─────────────────────────────┐   ║
║  │  products       ││   │ │  blog_posts      (Tiptap JSON)          │   ║
║  │  product_options││   │ │  blog_categories  (hierarchical)         │   ║
║  │  product_variants│   │ │  blog_tags                               │   ║
║  │  product_images ││   │ │  projects         (portfolio)            │   ║
║  │  product_tags   ││   │ │  skills           (portfolio + resume)   │   ║
║  │  collections    ││   │ │  testimonials     (portfolio)            │   ║
║  │  categories     ││   │ │  work_experience  (resume)               │   ║
║  │  orders ──────┐ ││   │ │  education        (resume)               │   ║
║  │  (items=JSONB)│ ││   │ │  certifications   (resume)               │   ║
║  │  ⚠️ SHOULD BE │ ││   │ │  pages            (all types)            │   ║
║  │  RELATIONAL!  │ ││   │ │  sections         (landing)              │   ║
║  │  coupons      │ ││   │ │  forms            (form builder)         │   ║
║  │  shipping_zones │   │ │  form_submissions                        │   ║
║  │  shipping_rates │   │ │  media             (library)              │   ║
║  └─────────────────┘   │ └──────────────────────────────────────────┘   ║
║                    │   │                                                 ║
║                    ▼   ▼                                                 ║
║  ┌─── SYSTEM ──────────────────────────────────────────────────┐        ║
║  │  plans            (Free│Starter│Business│Enterprise)        │        ║
║  │  subscriptions    (user subscription records)               │        ║
║  │  invoices         (payment invoices)                        │        ║
║  │  themes           (theme catalog)                           │        ║
║  │  theme_installs   (per-store theme installations)           │        ║
║  │  apps             (App Store entries)                       │        ║
║  │  app_installs     (per-store app installations)             │        ║
║  │  reviews          (app/theme reviews)                       │        ║
║  │  notifications    (platform notifications)                  │        ║
║  │  activity_logs    (user activity audit trail)               │        ║
║  │  store_surveys    (onboarding survey JSONB)                 │        ║
║  │  onboarding_attempts (onboarding tracking)                  │        ║
║  │  ai_credits       (AI usage per store)                      │        ║
║  │  customer_credentials (storefront customer accounts)        │        ║
║  │  store_customers  (customer profiles per store)             │        ║
║  └─────────────────────────────────────────────────────────────┘        ║
╚══════════════════════════════════════════════════════════════════════════╝

Table Standards (per CLAUDE.md):
  ✅ id UUID PK (gen_random_uuid)
  ✅ created_at TIMESTAMPTZ DEFAULT NOW()
  ✅ updated_at TIMESTAMPTZ DEFAULT NOW() (trigger: update_updated_at)
  ❌ deleted_at TIMESTAMPTZ (MISSING — soft deletes not implemented)
  ❌ created_by UUID (MISSING — audit columns not implemented)
  ❌ updated_by UUID (MISSING — audit columns not implemented)
  ❌ version INT DEFAULT 1 (MISSING — optimistic locking not implemented)
```

### 8.2 Database Schema Gaps

```
┌─────────────── SCHEMA COMPLIANCE GAPS ────────────────────────────────────┐
│                                                                            │
│  GAP                        │ SEVERITY │ FIX                    │ EFFORT  │
│  ───────────────────────────┼──────────┼────────────────────────┼─────────│
│  Missing deleted_at column  │ 🟡 HIGH  │ ALTER TABLE ADD COLUMN │ 3h      │
│  Missing created_by/by cols │ 🟡 HIGH  │ ALTER TABLE ADD COLUMN │ 2h      │
│  Missing version column     │ 🟡 MED   │ ALTER TABLE ADD + logic│ 2h      │
│  Order items stored as JSONB│ 🔴 CRIT  │ New order_items table  │ 4h      │
│  Duplicate migration 022    │ 🟡 MED   │ Rename second to 023   │ 0.5h    │
│  Trigger naming inconsist.  │ 🟡 LOW   │ Standardize all to     │ 1h      │
│                             │          │ update_updated_at()    │         │
│  ───────────────────────────┼──────────┼────────────────────────┼─────────│
│  TOTAL ESTIMATED EFFORT     │          │                        │ 12.5h   │
└────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Row Level Security (RLS)

```
┌─────────────── RLS POLICY PATTERN ────────────────────────────────────────┐
│                                                                            │
│  Every table MUST have RLS enabled. Standard policy:                       │
│                                                                            │
│  -- Store owners can manage their own data                                 │
│  CREATE POLICY "store_owner_access" ON {table}                             │
│    FOR ALL USING (                                                         │
│      store_id IN (SELECT id FROM sites WHERE user_id = auth.uid())        │
│    );                                                                      │
│                                                                            │
│  -- Public can read published content                                      │
│  CREATE POLICY "public_read_published" ON {table}                          │
│    FOR SELECT USING (status = 'published');                                │
│                                                                            │
│  RLS Status:                                                               │
│  ✅ Enabled on most tables (needs completeness audit)                      │
│  ⚠️ Some new tables may be missing policies                                │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Onboarding & Trial System

### 9.1 Onboarding State Machine

```
┌─────────────── ONBOARDING STATE MACHINE ──────────────────────────────────┐
│                                                                            │
│  ANON ──► CREATED ──► VERIFIED ──► CHOOSING ──► STORE_CREATED             │
│                                                        │                   │
│                                                        ▼                   │
│                                              SURVEYING ──► ONBOARDED      │
│                                                                │           │
│                                                                ▼           │
│                                                           PUBLISHED       │
│                                                                            │
│  State Descriptions:                                                       │
│  ANON           — Anonymous visitor on letbuyy.store                       │
│  CREATED        — Supabase Auth user record created                        │
│  VERIFIED       — Email OTP verified + password set                        │
│  CHOOSING       — Selecting site type (5 options)                          │
│  STORE_CREATED  — sites record created, trial started (7 days)             │
│  SURVEYING      — Completing onboarding survey (skippable)                 │
│  ONBOARDED      — First content created                                    │
│  PUBLISHED      — Store is live at {subdomain}.letbuyy.store               │
│                                                                            │
│  Cross-App Flow:                                                           │
│  accounts.letbuyy.store ──(ANON→STORE_CREATED)──► admin.letbuyy.store    │
│  admin.letbuyy.store ──(SURVEYING→PUBLISHED)──► {store}.letbuyy.store    │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Store Creation Wizard (ASCII Wireframe)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STORE CREATION — accounts.letbuyy.store/onboarding                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1 of 2: "What do you want to build?"                                  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │                                                                   │      │
│  │  ┌─────────────────┐    ┌─────────────────┐                      │      │
│  │  │  🛒              │    │  🎨              │                      │      │
│  │  │  E-Commerce      │    │  Portfolio       │                      │      │
│  │  │  Store            │    │                  │                      │      │
│  │  │                  │    │  Showcase your   │                      │      │
│  │  │  Sell products   │    │  work            │                      │      │
│  │  │  online          │    │                  │                      │      │
│  │  └─────────────────┘    └─────────────────┘                      │      │
│  │                                                                   │      │
│  │  ┌─────────────────┐    ┌─────────────────┐                      │      │
│  │  │  📄              │    │  🚀              │                      │      │
│  │  │  Resume / CV     │    │  Landing Page    │                      │      │
│  │  │                  │    │                  │                      │      │
│  │  │  Professional    │    │  Marketing       │                      │      │
│  │  │  profile         │    │  campaign        │                      │      │
│  │  └─────────────────┘    └─────────────────┘                      │      │
│  │                                                                   │      │
│  │  ┌──────────────────────────────────────┐                        │      │
│  │  │  ✍️  Blog                             │  ← Centered, full-width│      │
│  │  │  Write & publish blog posts          │                        │      │
│  │  └──────────────────────────────────────┘                        │      │
│  │                                                                   │      │
│  │  💡 "Not sure? AI can help you decide" [Help me choose →]       │      │
│  │                                                                   │      │
│  │  [Next →] (disabled until type selected)                         │      │
│  │                                                                   │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  STEP 2 of 2: "Name your store"                                            │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │                                                                   │      │
│  │  Store Name:                                                      │      │
│  │  ┌───────────────────────────────────────────────────────────┐   │      │
│  │  │  My Awesome Store                                         │   │      │
│  │  └───────────────────────────────────────────────────────────┘   │      │
│  │                                                                   │      │
│  │  Your URL:                                                        │      │
│  │  ┌──────────────────────────┬────────────────────────────────┐   │      │
│  │  │  myawesomestore          │  .letbuyy.store                │   │      │
│  │  │  (auto-sanitized:        │  (suffix, read-only)           │   │      │
│  │  │   lowercase, a-z0-9-)   │                                │   │      │
│  │  └──────────────────────────┴────────────────────────────────┘   │      │
│  │                                                                   │      │
│  │  ✅ "myawesomestore" is available!                                │      │
│  │                                                                   │      │
│  │  [← Back]     [Create Store →]                                   │      │
│  │                                                                   │      │
│  └───────────────────────────────────────────────────────────────────┘      │
│                                                                              │
│  BACKEND ACTIONS on "Create Store":                                         │
│  1. Validate subdomain (regex + 50 reserved words + availability check)     │
│  2. INSERT INTO sites (user_id, subdomain, store_name, site_type)          │
│  3. INSERT INTO onboarding_attempts (tracking)                              │
│  4. SET trial_ends_at = NOW() + 7 days                                      │
│  5. INSERT INTO ai_credits (10 initial credits for free tier)               │
│  6. Send "Store Created" email via Resend                                   │
│  7. Create audit log entry                                                   │
│  8. REDIRECT → admin.letbuyy.store/{subdomain}/onboarding                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Trial Lifecycle

```
┌─────────────── TRIAL LIFECYCLE ──────────────────────────────────────────┐
│                                                                           │
│  Day 0        Day 3        Day 5        Day 7        Day 10     Day 11+  │
│   │            │            │            │            │           │       │
│   ▼            ▼            ▼            ▼            ▼           ▼       │
│  ┌────────────────────────────────────┬─────────────┬────────────────┐   │
│  │      ACTIVE TRIAL (Day 1-7)       │ GRACE (8-10)│ FROZEN (11+)   │   │
│  │ ✅ Full feature access             │ 🟡 Admin OK │ 🔴 Billing-only│   │
│  │ ✅ Publishing allowed              │ ❌ No publish│ ❌ Storefront   │   │
│  │ ✅ Countdown banner (green)        │ "Upgrade"   │    shows       │   │
│  │ ✅ AI Studio with trial credits    │  banner     │    "Coming     │   │
│  └────────────────────────────────────┴─────────────┤    Soon"       │   │
│   📧          📧           📧           📧           📧  │              │   │
│  Welcome    Reminder    Last Day    Expired    Final  │ +90 days:    │   │
│  email      email       warning     notice     warn   │ DATA PURGE   │   │
│                                                       └──────────────┘   │
│                                                                           │
│  Recovery: User pays at any point during FROZEN                          │
│  → Subscription activated → Store unfrozen → Full access restored        │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Security Analysis

### 10.1 Security Posture Heat Map

```
╔══════════════════════════════════════════════════════════════════════════╗
║                    SECURITY POSTURE — MARCH 2026                         ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  AREA                         │ STATUS │ RISK LEVEL                      ║
║  ─────────────────────────────┼────────┼────────────────────────────     ║
║  Password hashing (bcrypt)    │   ✅   │ LOW — 10 rounds, working        ║
║  JWT tokens (jose)            │   ✅   │ LOW — HTTP-only cookies         ║
║  OTP verification             │   ✅   │ LOW — 6-digit, 10min, 3 tries  ║
║  Turnstile bot protection     │   ✅   │ LOW — On auth forms             ║
║  RLS policies                 │   ✅   │ LOW — Most tables (audit needed)║
║  Disposable email blocking    │   ✅   │ LOW — 50+ domains blocked       ║
║  ─────────────────────────────┼────────┼────────────────────────────     ║
║  Rate limiting                │   🔶   │ MEDIUM — In-memory (not Redis)  ║
║  CORS configuration           │   ✅   │ LOW — Wildcard + explicit list  ║
║  Audit logging                │   🔶   │ MEDIUM — Table exists, partial  ║
║  Security headers             │   ✅   │ LOW — HSTS,CSP,X-Frame,nosniff ║
║  Error sanitization           │   ✅   │ LOW — AppError class, env-gated ║
║  Input validation             │   ✅   │ LOW — XSS patterns, 1MB limit   ║
║  Request IDs                  │   ✅   │ LOW — crypto.randomUUID()       ║
║  ─────────────────────────────┼────────┼────────────────────────────     ║
║  CSRF protection              │   ❌   │ HIGH — Secret exists, no code   ║
║  Brute force prevention       │   ❌   │ HIGH — No lockout mechanism     ║
║  2FA implementation           │   ❌   │ HIGH — Not built (console needs)║
║  VPN/IP whitelist             │   ❌   │ HIGH — Not built (console needs)║
║  ─────────────────────────────┼────────┼────────────────────────────     ║
║  🔴 COMMITTED SECRETS         │   ❌   │ CRITICAL — 9 production secrets ║
║  🔴 WEBHOOK VERIFICATION      │   ❌   │ CRITICAL — Payment spoofing     ║
║                                                                          ║
╚══════════════════════════════════════════════════════════════════════════╝
```

### 10.2 Critical Gaps — Must Fix Before Launch

```
┌─────────────── CRITICAL SECURITY GAPS ────────────────────────────────────┐
│                                                                            │
│  #  │ GAP                    │ IMPACT               │ FIX EFFORT │ DEPS  │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│  1  │ Secrets in all.env     │ Full platform         │ 3h         │ NONE  │
│     │ (9 production keys)    │ compromise possible   │ then BFG   │ DO    │
│     │                        │                       │ Repo purge │ FIRST │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│  2  │ No webhook signature   │ Payment spoofing,     │ 3h         │ #1    │
│     │ verification           │ fraudulent orders     │            │       │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│  3  │ Incomplete rate        │ Brute force attacks   │ 2h         │ NONE  │
│     │ limiting               │ on auth endpoints     │            │       │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│  4  │ Client-sent prices     │ Customers can set     │ 3h         │ Schema│
│     │ trusted                │ their own price       │            │ fixes │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│  5  │ Zero tests             │ Regressions go        │ 30h        │ NONE  │
│     │                        │ undetected            │            │       │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│  6  │ No CSRF middleware     │ Cross-site request    │ 3h         │ NONE  │
│     │                        │ forgery attacks       │            │       │
│  ───┼────────────────────────┼──────────────────────┼────────────┼───────│
│     │ ✅ CORRECTED: Items 7 & 8 from original analysis removed.         │
│     │ Error sanitization IS implemented (AppError class, env-gated).    │
│     │ Security headers ARE implemented (HSTS, CSP, X-Frame, nosniff).  │
└────────────────────────────────────────────────────────────────────────────┘
```

### 10.3 Gap Priority Matrix

```
                        IMPACT
                  Low       Medium      High
            ┌───────────┬───────────┬────────────┐
   High     │           │ CI/CD     │ 🔴 Secrets │  U
            │           │ Testing   │ 🔴 Webhooks│  R
            ├───────────┼───────────┼────────────┤  G
   Medium   │ Logging   │ CSRF      │ Cart/Pay   │  E
            │ R2/KV     │ Headers   │ Rate Limit │  N
            ├───────────┼───────────┼────────────┤  C
   Low      │ i18n      │ 2FA       │ Search     │  Y
            │ A/B Test  │ Staging   │ Console    │
            └───────────┴───────────┴────────────┘

  🔴 DO NOW   : Secrets rotation, webhook verification, rate limiting
  🟡 DO NEXT  : Schema fixes, CSRF, error sanitization, security headers
  🟢 PLAN     : Cart, checkout, payments, console
  ⚪ LATER    : Testing, CI/CD, monitoring, 2FA, staging
```

---

## 11. API Architecture

### 11.1 Endpoint Inventory

```
┌─────────────── API ENDPOINTS (api.letbuyy.store) ──────────────────────────┐
│                                                                             │
│  AUTH ENDPOINTS (accounts.letbuyy.store/api/*)    Rate Limit                │
│  ───────────────────────────────────────────────  ──────────                │
│  POST /api/auth/lookup          Check email        10/min/IP                │
│  POST /api/auth/signup          Create account      5/min/IP                │
│  POST /api/auth/verify-otp      Verify OTP          3/min/IP                │
│  POST /api/auth/set-password    Set password         5/min/IP                │
│  POST /api/auth/login           Login               10/min/IP                │
│  POST /api/auth/logout          End session         Unlimited                │
│  GET  /api/auth/session         Check session       60/min                   │
│  POST /api/auth/send-reset      Password reset       3/min/IP                │
│  POST /api/auth/reset-password  Reset with token     5/min/IP                │
│  POST /api/auth/send-magic      Magic link           5/min/IP                │
│  GET  /api/auth/accounts        List accounts       30/min                   │
│  POST /api/auth/switch          Switch store        30/min                   │
│  GET  /api/auth/stores          List stores         30/min                   │
│  POST /api/auth/create-store    Create store         3/min                   │
│  POST /api/auth/validate-subdom Check subdomain     30/min                   │
│                                                                             │
│  STORE MANAGEMENT (API Worker /v1/stores/*)                                 │
│  ──────────────────────────────────────────                                 │
│  GET  /v1/stores/:storeId              Get store details                    │
│  PUT  /v1/stores/:storeId              Update store settings                │
│  GET  /v1/stores/:storeId/products     List products (paginated)            │
│  POST /v1/stores/:storeId/products     Create product                       │
│  GET  /v1/stores/:storeId/products/:id Product detail                       │
│  PUT  /v1/stores/:storeId/products/:id Update product                       │
│  DEL  /v1/stores/:storeId/products/:id Delete product                       │
│  GET  /v1/stores/:storeId/orders       List orders (paginated)              │
│  POST /v1/stores/:storeId/orders       Create order                         │
│  PUT  /v1/stores/:storeId/orders/:id   Update order status                  │
│  GET  /v1/stores/:storeId/customers    List customers                       │
│  GET  /v1/stores/:storeId/analytics    Get analytics                        │
│                                                                             │
│  BLOG API (/v1/stores/:storeId/posts/*)                                     │
│  ──────────────────────────────────────                                     │
│  GET/POST/PUT/DEL /posts, /categories                                       │
│                                                                             │
│  PORTFOLIO API (/v1/stores/:storeId/projects/*)                             │
│  ─────────────────────────────────────────────                              │
│  GET/POST/PUT/DEL /projects, /skills, /testimonials                         │
│                                                                             │
│  AI API (/v1/ai/*)                                                          │
│  ─────────────────                                                          │
│  POST /v1/ai/generate              Generate content (routes to AI model)    │
│  GET  /v1/ai/credits               Check credit balance                     │
│  POST /v1/ai/credits/purchase      Buy additional credits                   │
│                                                                             │
│  PAYMENT API (/v1/payments/*)                                               │
│  ────────────────────────────                                               │
│  POST /v1/payments/stripe/checkout Create Stripe checkout session           │
│  POST /v1/payments/razorpay/order  Create Razorpay order                    │
│  POST /v1/payments/razorpay/verify Verify payment signature                 │
│                                                                             │
│  WEBHOOK HANDLERS (/v1/webhooks/*)                                          │
│  ─────────────────────────────────                                          │
│  POST /v1/webhooks/stripe          ⚠️ NO signature verification!            │
│  POST /v1/webhooks/razorpay        ⚠️ NO signature verification!            │
│  POST /v1/webhooks/resend          Email delivery status                    │
│                                                                             │
│  API DESIGN STATUS (Corrected after codebase audit):                        │
│  ✅ /v1/ prefix IS used (app.basePath('/v1') in index.ts)                   │
│  ✅ Standardized error format IS implemented ({ error: { code, message } }) │
│  ❌ No shared error codes in @letbuyy/api-types                             │
│  ❌ No idempotency keys on mutation endpoints                               │
│  ❌ Not all endpoints have Zod validation                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

> **Continued in Part 3:** Admin Dashboard (5 variants), E-Commerce Engine, Storefront Rendering, Portfolio/Resume/Blog/Landing Page builders — with complete ASCII wireframes.
