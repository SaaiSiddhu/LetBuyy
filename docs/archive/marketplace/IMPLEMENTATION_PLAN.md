# LetBuyy — Comprehensive Implementation Plan

**Version:** 3.0
**Date:** February 11, 2026
**Status:** 🟢 Active

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Platform Overview](#platform-overview)
3. [User Flows](#user-flows)
4. [System Architecture](#system-architecture)
5. [Project Structure](#project-structure)
6. [E-commerce Features](#e-commerce-features)
7. [Portfolio Builder](#portfolio-builder)
8. [Resume Builder](#resume-builder)
9. [Database Schema](#database-schema)
10. [API Architecture](#api-architecture)
11. [Admin Dashboard](#admin-dashboard)
12. [Super Admin Console](#super-admin-console)
13. [Employee Portal](#employee-portal)
14. [Notification System](#notification-system)
15. [Security Architecture](#security-architecture)
16. [Implementation Phases](#implementation-phases)
17. [Verification Plan](#verification-plan)
18. [Technology Stack](#technology-stack)
19. [Cost Analysis & Revenue Model](#cost-analysis--revenue-model)
20. [Architecture Decisions & Recommendations](#architecture-decisions--recommendations)

---

## Executive Summary

LetBuyy is a comprehensive Shopify-like SaaS platform enabling users to create and manage **e-commerce stores, portfolios, resumes, and landing pages** with enterprise-grade features. The platform is built on a modern stack: **Supabase + Cloudflare Workers + Next.js + Flutter**.

### Key Capabilities

| Capability | Description |
|---|---|
| **Multi-Site Architecture** | Dynamic UI adaptation per site type (Store, Portfolio, Resume, Landing) |
| **Full E-commerce** | Products, variants, inventory, orders, coupons, shipping, multi-gateway payments |
| **Portfolio & Resume** | Creative showcase + professional CV with PDF export |
| **Admin Panel** | Full-featured `admin.letbuyy.store` matching Shopify's functionality |
| **Super Admin Console** | Platform-wide control at `console.letbuyy.store` (VPN + 2FA) |
| **Employee Portal** | Role-based staff operations at `team.letbuyy.store` |
| **Omnichannel Notifications** | Push (FCM) + email (Resend) across all site types |
| **Global Architecture** | Multi-currency, edge computing, CDN-first |

---

## Platform Overview

### Domain Structure

| Domain | Purpose | Users | Access | SEO |
|---|---|---|---|---|
| `letbuyy.store` | Marketing + Signup/Onboarding | Public | 🌐 Public | ✅ index |
| `accounts.letbuyy.store` | Authentication Portal | All Users | 🔒 Auth | ❌ noindex |
| `admin.letbuyy.store/{store}` | Storefront Builder (per store) | Store Owners | 🔒 Auth | ❌ noindex |
| `*.letbuyy.store` | Published Storefronts | Public | 🌐 Public | ✅ index |
| `team.letbuyy.store` | Employee Portal | Employees | 🔐 Allowlist + noindex | ❌ noindex |
| `console.letbuyy.store` | Super Admin Console | Founders/Admins | 🔐 VPN + noindex | ❌ noindex |
| `api.letbuyy.store` | API Gateway | All Clients | 🔒 JWT | N/A |

### Applications

| App | Platform | Package Name | Purpose |
|---|---|---|---|
| Builder App | Flutter (Android, iOS, macOS, Windows) | `builder` | Mobile/Desktop storefront editor |
| Landing | Next.js | `@letbuyy/landing` | Marketing, signup, onboarding |
| Accounts | Next.js | `@letbuyy/accounts` | Authentication portal |
| Admin | Next.js | `@letbuyy/admin` | `admin.letbuyy.store/{store}` builder |
| Storefront | Next.js | `@letbuyy/storefront` | Dynamic public storefronts |
| Team Portal | Next.js | `@letbuyy/team` | `team.letbuyy.store` staff ops |
| Console | Next.js | `@letbuyy/console` | `console.letbuyy.store` platform control |

### Site Types

| Type | Key Features | Admin Sections |
|---|---|---|
| **E-commerce Store** | Products, cart, checkout, orders, inventory, shipping | Products, Orders, Inventory, Coupons, Shipping |
| **Portfolio** | Projects, skills, education, contact forms | Projects, Skills, Education, Contacts |
| **Resume** | Work experience, CV, PDF export | Content, PDF Export, Templates |
| **Landing Page** | Marketing pages, forms, analytics | Pages, Forms, Analytics |

---

## User Flows

### 3.1 New User Journey

```
letbuyy.store (Landing)
        │
        ▼  User clicks "Get Started"
letbuyy.store/signup
   • Email verification (OTP)
   • Password creation
   • Account created in Supabase Auth
        │
        ▼  After verification
letbuyy.store/create
   STEP 1: Site Type Selection (Store / Portfolio / Resume / Landing)
   STEP 2: Store Details (name, subdomain, category)
   STEP 3: Template Selection
   STEP 4: Complete → Credentials emailed → Redirect to admin
        │
        ▼  Store created
admin.letbuyy.store/{store_name}/login
   • Email + Password (from signup)
   • Unique store context loaded
        │
        ▼  After login
admin.letbuyy.store/{store_name}/dashboard
   STOREFRONT BUILDER DASHBOARD
   ├── Products / Projects / Experience (by site type)
   ├── Orders (e-commerce only)
   ├── Pages & Design
   ├── Settings
   ├── Analytics
   └── Publish
        │
        ▼  User publishes
{store_name}.letbuyy.store  (PUBLIC STOREFRONT)
   • E-commerce: Products, Cart, Checkout
   • Portfolio: Projects, Skills, Contact
   • Resume: Experience, Education, PDF Export
   • Landing: Marketing page with CTA
```

### 3.2 Flutter Builder App Flow

```
FLUTTER BUILDER APP (Android, iOS, Windows, macOS)
        │
        ▼  User opens app
LOGIN SCREEN
   • Email + Password (same Supabase Auth as web)
   • Store selection (if user has multiple stores)
        │
        ▼  After login
BUILDER DASHBOARD
   Same features as admin.letbuyy.store/{store}
   ├── Products / Projects / Experience
   ├── Orders
   ├── Design (limited visual editor)
   ├── Settings
   ├── Analytics
   └── Publish
```

### 3.3 Super Admin Console Flow

```
console.letbuyy.store (VPN/Tailscale Protected + Founder Only)
   AUTHENTICATION:
   • Email allowlist (founders only)
   • Mandatory 2FA (TOTP/Hardware Key)
   • IP whitelist / VPN required
   • robots.txt: noindex, nofollow

   FEATURES (Full Platform Control):
   ├── Dashboard (All platform metrics)
   ├── Users Management (all platform users)
   ├── Stores Management (all stores + suspend/unsuspend)
   ├── Subscriptions & Billing (revenue, invoices)
   ├── Employee Management (invite/remove employees)
   ├── Analytics (Platform-wide, revenue, growth)
   ├── Settings (Feature flags, pricing, configs)
   └── Audit Logs (all actions including employee actions)
```

### 3.4 Employee Portal Flow

```
team.letbuyy.store (Email Allowlist + noindex + Separate Auth)
   AUTHENTICATION:
   • Email allowlist only (invited by Super Admin)
   • 2FA recommended
   • robots.txt: noindex, nofollow

   ONBOARDING:
   1. Super Admin invites employee via console
   2. Employee receives email with invite link
   3. Employee creates account + sets password
   4. Employee logs in to team.letbuyy.store

   ROLE-BASED ACCESS:
   🎫 SUPPORT TEAM     → Tickets, User Lookup (read-only), Store Lookup
   📢 MARKETING TEAM   → Analytics (read), Campaigns, Content, Banners
   👥 USER MGMT TEAM   → User Lookup, Store Moderation, Account Actions
   📊 OPERATIONS TEAM  → Disputes, Platform Health, Seller Verification

   SECURITY:
   • Employees CANNOT access: Billing, Revenue, Employee Management
   • Employees CANNOT: Suspend stores, Delete users, Change pricing
   • All employee actions logged in Super Admin audit logs
   • Employees can be instantly deactivated from Super Admin console
```

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                            CLIENTS                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Flutter  │  │ Landing  │  │  Admin   │  │Storefront│  │Console │ │
│  │ Builder  │  │ (Next.js)│  │ (Next.js)│  │ (Next.js)│  │Team    │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬────┘ │
└───────┼──────────────┼──────────────┼──────────────┼───────────┼──────┘
        └──────────────┴──────────────┴──────────────┴───────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    API LAYER (Cloudflare)                              │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │            api.letbuyy.store (Cloudflare Workers)              │  │
│  │  /auth/*     → Authentication (OTP, Password, 2FA)             │  │
│  │  /stores/*   → Store CRUD, Deployment                          │  │
│  │  /products/* → Product management                              │  │
│  │  /orders/*   → Order processing                                │  │
│  │  /payments/* → Razorpay/Stripe integration                     │  │
│  │  /webhooks/* → Payment webhooks                                │  │
│  │  /employee/* → Employee portal APIs                            │  │
│  │  /admin/*    → Super admin operations                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │Cloudflare KV │  │Cloudflare R2 │  │Upstash Redis │               │
│  │ (Sessions)   │  │(File Storage)│  │(Rate Limiting)│              │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     DATA LAYER (Supabase)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ PostgreSQL   │  │Supabase Auth │  │   Supabase   │               │
│  │  Database    │  │ (Users, JWT) │  │   Storage    │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
│  ┌──────────────┐  ┌──────────────┐                                  │
│  │Edge Functions│  │   Realtime   │                                  │
│  │(DB Triggers) │  │(Subscriptions│                                  │
│  └──────────────┘  └──────────────┘                                  │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Razorpay │  │  Stripe  │  │  Resend  │  │   FCM    │             │
│  │(Payments)│  │(Payments)│  │  (Email) │  │  (Push)  │             │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘             │
│  ┌──────────┐  ┌──────────┐                                          │
│  │Typesense │  │  Vercel  │                                          │
│  │ (Search) │  │(Hosting) │                                          │
│  └──────────┘  └──────────┘                                          │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Letbuyy_Store/
│
├── 📁 apps/
│   ├── 📁 flutter/
│   │   ├── 📁 builder/              # Storefront Builder App
│   │   │   ├── android/ ios/ macos/ windows/
│   │   │   ├── lib/
│   │   │   │   ├── main.dart
│   │   │   │   ├── app/
│   │   │   │   ├── features/
│   │   │   │   │   ├── auth/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── products/
│   │   │   │   │   ├── orders/
│   │   │   │   │   ├── settings/
│   │   │   │   │   └── analytics/
│   │   │   │   ├── services/
│   │   │   │   ├── widgets/
│   │   │   │   └── theme/
│   │   │   └── pubspec.yaml
│   │   ├── 📁 super_admin/          # Super Admin Flutter App
│   │   └── 📁 team/                 # Team Flutter App
│   │
│   └── 📁 web/
│       ├── 📁 landing/              # letbuyy.store
│       │   └── src/app/
│       │       ├── page.tsx               # Landing page
│       │       ├── signup/page.tsx        # Signup flow
│       │       ├── create/page.tsx        # Store creation wizard
│       │       └── pricing/page.tsx
│       │
│       ├── 📁 accounts/             # accounts.letbuyy.store
│       │   └── src/app/
│       │       ├── login/page.tsx
│       │       ├── signup/page.tsx
│       │       ├── forgot-password/page.tsx
│       │       └── callback/page.tsx      # OAuth callback
│       │
│       ├── 📁 admin/                # admin.letbuyy.store/{store}
│       │   └── src/app/
│       │       └── [store]/
│       │           ├── login/page.tsx
│       │           ├── dashboard/page.tsx
│       │           ├── products/
│       │           ├── orders/
│       │           ├── pages/
│       │           ├── settings/
│       │           └── analytics/
│       │
│       ├── 📁 storefront/           # *.letbuyy.store (dynamic)
│       │   └── src/app/
│       │       └── [domain]/
│       │           ├── page.tsx           # Homepage
│       │           ├── products/
│       │           ├── cart/
│       │           ├── checkout/
│       │           └── [...slug]/         # Dynamic pages
│       │
│       ├── 📁 team/                 # team.letbuyy.store
│       │   └── src/app/
│       │       ├── (auth)/login/ invite/
│       │       └── (dashboard)/
│       │           ├── page.tsx           # Employee Dashboard
│       │           ├── support/
│       │           ├── users/
│       │           ├── stores/
│       │           ├── marketing/
│       │           └── operations/
│       │
│       └── 📁 console/              # console.letbuyy.store
│           └── src/app/
│               ├── (auth)/login/ mfa/
│               └── (dashboard)/
│                   ├── page.tsx           # Dashboard
│                   ├── users/
│                   ├── stores/
│                   ├── subscriptions/
│                   ├── employees/
│                   ├── analytics/
│                   ├── settings/
│                   └── audit-logs/
│
├── 📁 packages/
│   ├── 📁 dart/
│   │   ├── 📁 core/                 # Core Dart utilities
│   │   ├── 📁 models/               # Shared data models
│   │   ├── 📁 services/             # API services
│   │   └── 📁 ui_kit/               # Shared Flutter widgets
│   │
│   └── 📁 typescript/
│       ├── 📁 api-types/            # @letbuyy/api-types
│       │   └── src/ (stores.ts, products.ts, orders.ts, users.ts)
│       ├── 📁 ui/                   # @letbuyy/ui (shared React components)
│       │   └── src/ (Button/, Input/, DataTable/)
│       └── 📁 utils/                # @letbuyy/utils
│           └── src/ (supabase.ts, auth.ts, api.ts)
│
├── 📁 backend/
│   ├── 📁 workers/
│   │   ├── 📁 api/                  # Main API gateway worker
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── routes/ (auth, stores, products, orders, payments, admin)
│   │   │   │   ├── middleware/ (auth, rateLimit, cors)
│   │   │   │   └── utils/
│   │   │   └── wrangler.toml
│   │   └── 📁 webhooks/             # Payment webhook worker
│   │       └── src/ (razorpay.ts, stripe.ts)
│   │
│   └── 📁 supabase/
│       ├── 📁 migrations/           # SQL migration files
│       ├── 📁 functions/            # Edge Functions (triggers)
│       ├── 📁 seed/                 # Seed data
│       └── config.toml
│
├── 📁 infrastructure/
│   ├── vercel.json
│   ├── 📁 cloudflare/ (dns.tf)
│   └── 📁 scripts/ (migrate-firebase.sh, seed-data.sh)
│
├── 📄 IMPLEMENTATION_PLAN.md        # This document
├── 📄 pubspec.yaml                  # Flutter workspace
├── 📄 pnpm-workspace.yaml           # TypeScript workspace
└── 📄 turbo.json                    # Turborepo config
```

---

## E-commerce Features

### 6.1 Product Management

**Core Features:**
- Multi-variant products (size, color, material, custom attributes)
- Bulk import/export (CSV, Excel)
- Product collections + smart collections (auto-tagging)
- Digital products support (downloads, license keys)
- Product bundles and composite products
- Multi-currency pricing (automatic conversion + manual overrides)

**Inventory Management:**
- Real-time stock tracking across variants
- Low stock alerts (push + email)
- Multi-location inventory (warehouses, stores)
- Inventory transfer between locations
- Stock adjustments with reason tracking
- Barcode/SKU generation and scanning

### 6.2 Order Management

**Order Lifecycle:**
```
Pending → Confirmed → Processing → Shipped → Delivered → Completed
```

**Features:**
- Manual order creation for phone/in-person sales
- Order editing (add/remove items, adjust pricing)
- Partial fulfillment and split shipments
- Order notes (internal + customer-visible)
- Fraud analysis and risk scoring
- Return request portal for customers
- Automated return label generation
- Partial and full refund processing
- Restocking fees configuration

### 6.3 Payment Gateways

| Provider | Coverage | Methods |
|---|---|---|
| **Stripe** | Global | Cards, Wallets, BNPL |
| **Razorpay** | India | UPI, Netbanking, Cards, Wallets |
| **PayPal** | Global | PayPal balance, Cards |
| **COD** | Configurable | Cash on Delivery with fees |
| **Bank Transfer** | Manual | Manual verification |

**Payment Features:**
- Multi-currency checkout (150+ currencies)
- Automatic tax calculation (Stripe Tax / TaxJar)
- Subscription billing (recurring payments)
- Split payments (platform fee management)
- Saved payment methods for repeat customers
- 3D Secure authentication (SCA compliance)

### 6.4 Discounts & Coupons

| Type | Example |
|---|---|
| Percentage discount | 20% off |
| Fixed amount discount | $10 off |
| Free shipping | No shipping cost |
| Buy X Get Y (BOGO) | Buy 2 get 1 free |
| Tiered discounts | Spend $100 → 10%, $200 → 20% |
| First-time customer | Welcome discount |
| Automatic discounts | No code required |

### 6.5 Shipping & Fulfillment

**Shipping Configuration:**
- Zone-based rates (country, state, zip code)
- Weight-based pricing
- Flat rate / Free shipping thresholds
- Local pickup options
- Method display (Standard, Express, Overnight)

**Carrier Integrations (via EasyPost/ShipStation):**
- UPS, FedEx, USPS, DHL
- Real-time rate calculation
- Automated label printing (PDF)
- Bulk label printing
- Tracking number auto-assignment
- Shipment tracking webhooks

---

## Portfolio Builder

### 7.1 Profile Management

- Full name, professional title, tagline
- Profile photo and cover image upload
- Bio/About with rich text editor
- Location, timezone, availability status
- Resume/CV upload (PDF)
- Custom fields (pronouns, languages spoken)

### 7.2 Projects / Work Portfolio

- Project title, description, date completed
- Multi-image gallery per project (drag-to-reorder)
- Video embeds (YouTube, Vimeo, direct upload)
- Project categories/tags for filtering
- Client name and testimonial integration
- External links (GitHub, Behance, Dribbble)
- Featured/spotlight project selection

### 7.3 Skills & Expertise

- Skill name + proficiency level (1–5 stars / Beginner–Expert)
- Skill categories (Technical, Creative, Soft Skills, Tools)
- Years of experience per skill
- Certification badges (upload images)
- Endorsements counter (social proof)
- Visual displays (progress bars, charts)

### 7.4 Education

- Institution, degree, field of study
- Start/end dates (or "Present")
- GPA, honors, relevant coursework
- Institution logo upload
- Visual timeline/roadmap display

### 7.5 Contact & Social

**Contact Form Builder:**
- Drag-and-drop form builder (name, email, message, custom fields)
- reCAPTCHA spam protection
- Email notification + auto-reply
- Form submission storage + CSV export
- File upload support

**Social Links:**
LinkedIn, Twitter/X, Instagram, GitHub, Behance, Dribbble, Medium, Dev.to, YouTube, TikTok + custom links with click analytics

---

## Resume Builder

### 8.1 Content Structure

Inherits all portfolio features plus:
- Professional summary / objective statement
- Work experience (company, role, dates, achievements with action verbs)
- References section (with privacy controls)
- Publications, awards, volunteer work sections
- Section visibility toggles (show/hide)

### 8.2 PDF Export System

**Templates:** Modern, Classic, Minimal, Creative + ATS-optimized versions

**Features:**
- One-page or multi-page layout
- Color scheme + font customization (Arial, Calibri, Times)
- Section ordering and spacing controls
- QR code linking to online portfolio
- Save multiple PDF versions (tech resume, creative resume, etc.)
- Email PDF directly from platform
- Download analytics tracking
- Print-optimized formatting

---

## Database Schema

### 9.1 Core Tables

```sql
-- =============================================
-- USERS & AUTH (Supabase Auth handles core auth)
-- =============================================

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- STORES (Core entity for all site types)
-- =============================================

CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT UNIQUE,
  site_type TEXT NOT NULL CHECK (site_type IN ('store', 'portfolio', 'resume', 'landing')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'frozen', 'suspended')),
  theme_id UUID,
  theme_config JSONB DEFAULT '{}',
  settings JSONB DEFAULT '{}',
  meta_title TEXT,
  meta_description TEXT,
  favicon_url TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ
);

CREATE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_site_type ON stores(site_type);
```

### 9.2 E-commerce Tables

```sql
-- PRODUCTS
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  compare_at_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  sku TEXT,
  barcode TEXT,
  stock_quantity INTEGER DEFAULT 0,
  track_inventory BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  images JSONB DEFAULT '[]',
  variants JSONB DEFAULT '[]',
  tags TEXT[],
  categories TEXT[],
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  customer_name TEXT,
  subtotal DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_status TEXT DEFAULT 'pending',
  fulfillment_status TEXT DEFAULT 'unfulfilled',
  payment_method TEXT,
  payment_gateway TEXT,
  payment_id TEXT,
  shipping_address JSONB,
  billing_address JSONB,
  shipping_method TEXT,
  tracking_number TEXT,
  notes TEXT,
  coupon_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ORDER ITEMS
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  variant_id TEXT,
  name TEXT NOT NULL,
  sku TEXT,
  quantity INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL
);
```

### 9.3 Portfolio & Resume Tables

```sql
-- PORTFOLIO PROJECTS
CREATE TABLE portfolio_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  content TEXT,
  cover_image TEXT,
  images JSONB DEFAULT '[]',
  video_url TEXT,
  client_name TEXT,
  project_date DATE,
  project_url TEXT,
  github_url TEXT,
  technologies TEXT[],
  categories TEXT[],
  is_featured BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- SKILLS
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  proficiency INTEGER CHECK (proficiency BETWEEN 1 AND 5),
  years_experience DECIMAL(3,1),
  icon TEXT,
  display_order INTEGER DEFAULT 0
);

-- EDUCATION
CREATE TABLE education (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  institution TEXT NOT NULL,
  degree TEXT,
  field_of_study TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  gpa TEXT,
  description TEXT,
  logo_url TEXT,
  display_order INTEGER DEFAULT 0
);

-- WORK EXPERIENCE (Resume)
CREATE TABLE work_experience (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  position TEXT NOT NULL,
  location TEXT,
  start_date DATE,
  end_date DATE,
  is_current BOOLEAN DEFAULT false,
  description TEXT,
  achievements TEXT[],
  company_logo TEXT,
  display_order INTEGER DEFAULT 0
);

-- CUSTOM PAGES (All site types)
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content JSONB,
  html_content TEXT,
  is_homepage BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, slug)
);

-- CONTACT SUBMISSIONS
CREATE TABLE contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.4 Subscriptions & Billing

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL CHECK (plan IN ('free', 'starter', 'business', 'enterprise')),
  status TEXT DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  payment_gateway TEXT,
  external_subscription_id TEXT,
  stores_count INTEGER DEFAULT 0,
  products_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 9.5 Admin & Employee Tables

```sql
-- SUPER ADMIN ALLOWLIST
CREATE TABLE super_admin_allowlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  two_factor_enabled BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMPLOYEE ROLES
CREATE TABLE employee_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO employee_roles (name, display_name, permissions) VALUES
  ('support', 'Support Team', '["tickets.view", "tickets.respond", "users.read", "stores.read"]'),
  ('marketing', 'Marketing Team', '["analytics.read", "campaigns.manage", "content.manage", "banners.manage"]'),
  ('user_management', 'User Management', '["users.read", "stores.moderate", "accounts.freeze", "accounts.warn"]'),
  ('operations', 'Operations Team', '["disputes.manage", "health.view", "sellers.verify"]');

-- EMPLOYEES
CREATE TABLE employees (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES employee_roles(id),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  department TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  login_count INTEGER DEFAULT 0,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- EMPLOYEE INVITES
CREATE TABLE employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES employee_roles(id),
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AUDIT LOGS
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('super_admin', 'employee', 'system')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  status TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
```

### 9.6 Row Level Security

```sql
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users can only manage their own stores
CREATE POLICY "Users can manage own stores" ON stores
  FOR ALL USING (auth.uid() = user_id);

-- Products belong to stores user owns
CREATE POLICY "Users can manage own products" ON products
  FOR ALL USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Public can view published store products
CREATE POLICY "Public can view published products" ON products
  FOR SELECT USING (
    status = 'active' AND
    store_id IN (SELECT id FROM stores WHERE status = 'published')
  );
```

---

## API Architecture

### 10.1 Complete API Routes

```
api.letbuyy.store/
│
├── /auth
│   ├── POST /signup              # Register new user
│   ├── POST /signin              # Email + password login
│   ├── POST /signin/otp          # Request OTP
│   ├── POST /signin/otp/verify   # Verify OTP
│   ├── POST /signout             # Logout
│   ├── POST /password/reset      # Request password reset
│   └── POST /password/update     # Update password
│
├── /stores
│   ├── GET    /                  # List user's stores
│   ├── POST   /                  # Create new store
│   ├── GET    /:storeId          # Get store details
│   ├── PATCH  /:storeId          # Update store
│   ├── DELETE /:storeId          # Delete store
│   ├── POST   /:storeId/publish  # Publish store
│   └── GET    /:subdomain/public # Get public store data
│
├── /products
│   ├── GET    /:storeId/products        # List products
│   ├── POST   /:storeId/products        # Create product
│   ├── GET    /:storeId/products/:id    # Get product
│   ├── PATCH  /:storeId/products/:id    # Update product
│   ├── DELETE /:storeId/products/:id    # Delete product
│   └── POST   /:storeId/products/bulk   # Bulk operations
│
├── /orders
│   ├── GET    /:storeId/orders          # List orders
│   ├── POST   /:storeId/orders          # Create order
│   ├── GET    /:storeId/orders/:id      # Get order
│   ├── PATCH  /:storeId/orders/:id      # Update order
│   ├── POST   /:storeId/orders/:id/fulfill  # Fulfill order
│   └── POST   /:storeId/orders/:id/refund   # Process refund
│
├── /payments
│   ├── POST /razorpay/order      # Create Razorpay order
│   ├── POST /razorpay/verify     # Verify payment
│   └── POST /stripe/checkout     # Stripe checkout session
│
├── /webhooks (separate worker)
│   ├── POST /razorpay            # Razorpay webhook
│   └── POST /stripe              # Stripe webhook
│
├── /upload
│   ├── POST /image               # Upload image to R2
│   └── POST /file                # Upload file to R2
│
├── /contacts
│   ├── POST /                    # Submit contact form
│   └── GET  /:storeId            # List submissions
│
├── /portfolio
│   ├── POST   /:storeId/projects # Create project
│   └── GET    /:storeId/projects # List projects
│
├── /resume
│   ├── POST /export              # Export resume PDF
│   └── GET  /versions            # List resume versions
│
├── /employee (team.letbuyy.store)
│   ├── POST  /auth/login              # Employee login
│   ├── POST  /auth/accept-invite      # Accept invite
│   ├── GET   /me                      # Current employee info
│   ├── GET   /tickets                 # Support tickets
│   ├── PATCH /tickets/:id             # Respond to ticket
│   ├── GET   /users/:id               # User lookup (read-only)
│   ├── GET   /stores/:id              # Store lookup (read-only)
│   ├── PATCH /stores/:id/moderate     # Flag/freeze store
│   └── GET   /analytics               # Read-only analytics
│
└── /admin (console.letbuyy.store, VPN only)
    ├── GET   /dashboard               # Platform metrics
    ├── GET   /users                   # All users
    ├── GET   /stores                  # All stores
    ├── PATCH /stores/:id/status       # Suspend/unsuspend
    ├── DELETE /stores/:id             # Delete store
    ├── GET   /subscriptions           # Billing & revenue
    ├── GET   /analytics               # Platform analytics
    ├── GET   /audit-logs              # All audit logs
    └── /employees
        ├── GET    /                   # List employees
        ├── POST   /invite             # Invite employee
        ├── PATCH  /:id                # Update role
        ├── PATCH  /:id/deactivate     # Deactivate
        └── DELETE /:id                # Remove
```

---

## Admin Dashboard

### 11.1 Dynamic Navigation by Site Type

| Navigation Item | E-commerce | Portfolio | Resume | Landing |
|---|:---:|:---:|:---:|:---:|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Products | ✓ | — | — | — |
| Orders | ✓ | — | — | — |
| Inventory | ✓ | — | — | — |
| Coupons | ✓ | — | — | — |
| Shipping | ✓ | — | — | — |
| Projects | — | ✓ | — | — |
| Skills | — | ✓ | ✓ | — |
| Education | — | ✓ | ✓ | — |
| Experience | — | — | ✓ | — |
| PDF Export | — | — | ✓ | — |
| Pages | ✓ | ✓ | ✓ | ✓ |
| Forms | — | ✓ | — | ✓ |
| Analytics | ✓ | ✓ | ✓ | ✓ |
| Settings | ✓ | ✓ | ✓ | ✓ |

The admin interface detects site type and shows only relevant features.

---

## Super Admin Console

**URL:** `console.letbuyy.store`

**Access Control:**
- Email allowlist (founders only)
- Mandatory 2FA (TOTP / Hardware Key)
- IP whitelist / VPN (Tailscale) required
- `robots.txt: noindex, nofollow`

**Features:**
- **Dashboard** — Platform metrics, revenue, growth, active users
- **Users** — All platform users, search, filter, suspend
- **Stores** — All stores, suspend/unsuspend, delete
- **Subscriptions** — Revenue, invoices, plan management
- **Employees** — Invite, assign roles, deactivate
- **Analytics** — Platform-wide metrics, funnels, churn
- **Settings** — Feature flags, pricing tiers, global configs
- **Audit Logs** — All admin + employee actions with full context

---

## Employee Portal

**URL:** `team.letbuyy.store`

**Roles & Permissions:**

| Feature | Support | Marketing | User Mgmt | Operations |
|---|:---:|:---:|:---:|:---:|
| Support Tickets | ✓ Read/Respond | — | — | — |
| User Lookup | ✓ Read-only | — | ✓ Basic | — |
| Store Lookup | ✓ Read-only | — | ✓ Moderate | — |
| Analytics | — | ✓ Read-only | — | — |
| Campaigns | — | ✓ Manage | — | — |
| Content/Blog | — | ✓ Manage | — | — |
| Account Actions | — | — | ✓ Freeze/Warn | — |
| Order Disputes | — | — | — | ✓ Manage |
| Platform Health | — | — | — | ✓ View |
| Seller Verification | — | — | — | ✓ Verify |

---

## Notification System

### 14.1 Push Notifications (FCM)

- Firebase Cloud Messaging integration
- iOS, Android, Web, macOS, Windows support
- Device token management
- Foreground/background message handling
- Custom notification actions + badge management

### 14.2 Email Notifications (Resend)

Templates: Order confirmation, Shipping updates, New contact alerts, Low stock alerts, Payment confirmations, Abandoned cart recovery, Welcome emails, Employee invites

### 14.3 Notification Events

| Event | E-commerce | Portfolio | Resume |
|---|:---:|:---:|:---:|
| New Order | ✓ | — | — |
| Order Shipped | ✓ | — | — |
| Low Stock | ✓ | — | — |
| New Contact | — | ✓ | — |
| Resume Downloaded | — | — | ✓ |
| Site Published | ✓ | ✓ | ✓ |

---

## Security Architecture

| Area | Implementation |
|---|---|
| **Super Admin Access** | Tailscale VPN + IP allowlist + 2FA |
| **Authentication** | Supabase Auth + mandatory 2FA for admins |
| **API Security** | Rate limiting (Upstash Redis) + short-lived JWT |
| **Data Access** | Supabase RLS on all tables |
| **Audit Trail** | Log all admin + employee actions |
| **Secrets** | Cloudflare Workers Secrets + env vars |
| **Employee Security** | Email allowlist, instant deactivation, action logging |

---

## Implementation Phases

### Phase 1: Project Restructure ✅ (Week 1)

- [x] Create new directory structure
- [x] Scope all package names to `@letbuyy/*`
- [x] Rename `super-admin` → `console`
- [x] Create shared packages (`api-types`, `utils`, `ui`)
- [x] Clean up monorepo (remove nested `.git`, lockfiles)
- [x] Add `tsconfig.json` to all shared packages
- [ ] Wire shared packages as deps in consuming apps
- [ ] Update all import paths
- [ ] Verify all builds

### Phase 2: Supabase Setup (Week 2)

- [ ] Create/configure Supabase project
- [ ] Apply database migrations (all tables above)
- [ ] Configure Row Level Security (RLS)
- [ ] Set up Supabase Auth (email/password, social login)
- [ ] Configure email templates
- [ ] Set up Storage buckets
- [ ] Test auth flows locally
- [ ] Test RLS policies

### Phase 3: Cloudflare Workers API (Weeks 3–4)

- [ ] Set up Wrangler project
- [ ] Implement `/auth` routes
- [ ] Implement `/stores` routes
- [ ] Implement `/products` routes
- [ ] Implement `/orders` routes
- [ ] Implement `/payments` routes (Razorpay + Stripe)
- [ ] Implement `/upload` routes (R2)
- [ ] Set up Cloudflare KV (sessions)
- [ ] Set up Upstash Redis (rate limiting)
- [ ] Deploy to `api.letbuyy.store`

### Phase 4: Landing & Onboarding (Week 5)

- [ ] Update landing page design
- [ ] Build signup flow (`/signup`)
- [ ] Build store creation wizard (`/create`)
  - Site type selection → Store details → Subdomain check → Template → Success
- [ ] Connect to Supabase Auth
- [ ] Send welcome email via Resend
- [ ] Test complete signup → store creation → redirect flow

### Phase 5: Admin Builder — Web (Weeks 6–8)

- [ ] Build login page (`/[store]/login`)
- [ ] Implement store context middleware
- [ ] Build dashboard (`/[store]/dashboard`)
- [ ] Build products management (list, create/edit, images, variants)
- [ ] Build orders management (list, details, fulfillment)
- [ ] Build pages/design section
- [ ] Build settings section
- [ ] Build analytics section
- [ ] Implement publish flow

### Phase 6: Flutter Builder App (Weeks 9–10)

- [ ] Migrate from Firebase Auth to Supabase Auth
- [ ] Update API services to use Cloudflare Workers
- [ ] Update models (schema alignment)
- [ ] Test login, products, orders, settings
- [ ] Build for Android, iOS, macOS, Windows

### Phase 7: Storefront (Weeks 11–12)

- [ ] Subdomain routing middleware
- [ ] E-commerce storefront (homepage, products, cart, checkout, confirmation)
- [ ] Portfolio storefront (homepage, projects, about, contact)
- [ ] Resume storefront (homepage, experience/education, PDF download)
- [ ] Landing Page storefront
- [ ] Payment integration (Razorpay test mode)

### Phase 8: Super Admin Console (Weeks 13–14)

- [ ] Set up `console.letbuyy.store`
- [ ] Login with email allowlist + 2FA
- [ ] Dashboard (platform metrics)
- [ ] Users, Stores, Subscriptions management
- [ ] Employee management (invite, roles, deactivate)
- [ ] Audit logs viewer
- [ ] VPN/IP protection

### Phase 9: Employee Portal (Week 15)

- [ ] Set up `team.letbuyy.store`
- [ ] Employee login (allowlist)
- [ ] Invite acceptance flow
- [ ] Role-based dashboards (Support, Marketing, User Mgmt, Operations)
- [ ] Action logging to audit logs

### Phase 10: Testing & Launch (Week 16)

- [ ] E2E testing (Signup → Store → Publish → Payment)
- [ ] Flutter app complete flow testing
- [ ] Security audit
- [ ] Performance testing
- [ ] DNS configuration
- [ ] Production deployment
- [ ] Monitoring setup
- [ ] Beta launch

### Key Milestones

| Week | Milestone |
|---|---|
| 1 | ✅ Project fully restructured |
| 2 | Supabase database ready |
| 4 | API fully functional |
| 5 | Signup/onboarding working |
| 8 | Web admin builder complete |
| 10 | Flutter app migrated |
| 12 | All storefront types working |
| 14 | Super admin console ready |
| 15 | Employee portal ready |
| 16 | Production launch |

---

## Verification Plan

### 17.1 Automated Tests

| Layer | Framework | Scope |
|---|---|---|
| Unit Tests | Vitest (Workers), Jest (Next.js), flutter_test | Business logic |
| Integration Tests | Vitest, pgTAP | API endpoints, RLS policies |
| E2E Tests | Playwright | Complete web app flows |

### 17.2 Manual Verification Checklists

**Signup & Store Creation:**
1. Go to `letbuyy.store` → Click "Get Started"
2. Enter email → Receive OTP → Verify → Create password
3. Select site type → Enter store name → Verify subdomain → Choose template
4. Confirm store created → Verify redirect to `admin.letbuyy.store/{store}/login`
5. Login → Verify dashboard loads with correct store context

**Product & Order Flow:**
1. Admin → Products → Add Product → Upload image (R2) → Save
2. Verify product in list → Edit → Update price → Verify changes
3. Open `{store}.letbuyy.store` → Browse → Add to cart → Checkout
4. Razorpay payment (test mode) → Verify order confirmation
5. Admin → Orders → Verify order → Mark fulfilled → Verify status

**Flutter App:**
1. Login → Dashboard → Create product → Verify sync with web admin
2. View orders → Update settings → Publish store
3. Test on Android, iOS, macOS, Windows

**Super Admin:**
1. `console.letbuyy.store` (via VPN) → Login (allowlist) → 2FA
2. Dashboard metrics → Users management → Stores → Suspend a store
3. Verify storefront shows suspended → Check audit logs

---

## Technology Stack

### 18.1 Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Flutter** | 3.27+ | iOS, Android, macOS, Windows apps |
| **Dart** | 3.5+ | Flutter language |
| **Riverpod** | 2.x | Flutter state management |
| **GoRouter** | 14.x | Flutter navigation |
| **Next.js** | 15 | Web applications (App Router) |
| **React** | 19 | UI components |
| **TypeScript** | 5.x | Type safety |
| **Tailwind CSS** | 4.x + shadcn/ui | Styling |
| **Zustand** | 4.x | Web state management |
| **TanStack Query** | — | Server state |
| **Craft.js** | — | Drag-and-drop page builder |

### 18.2 Backend

| Technology | Purpose |
|---|---|
| **Supabase** | PostgreSQL + Auth + Storage + Realtime |
| **Cloudflare Workers** | Edge API functions |
| **PostgreSQL 16** | Database |
| **Cloudflare R2** | S3-compatible file storage |
| **Cloudflare KV** | Session storage |
| **Upstash Redis** | Rate limiting + caching |
| **Typesense** | Full-text search |
| **Resend** | Transactional email |
| **FCM** | Push notifications |

### 18.3 Integrations

| Service | Purpose |
|---|---|
| **Stripe** | Global payments |
| **Razorpay** | India payments (UPI, Netbanking) |
| **PayPal** | Alternative payment |
| **EasyPost / ShipStation** | Shipping labels + tracking |
| **Plausible** | Privacy-friendly analytics |
| **Vercel** | Web app hosting (Edge) |
| **Cloudflare** | CDN + DNS + Workers |

---

## Cost Analysis & Revenue Model

### 19.1 Infrastructure Costs

| Service | Free Tier | Paid Tier |
|---|---|---|
| Supabase | 500MB DB, 1GB storage | $25/mo (8GB DB) |
| Cloudflare Workers | 100k req/day | $5/mo |
| Cloudflare R2 | 10GB storage | $0.015/GB |
| Vercel | 100GB bandwidth | $20/mo (Pro) |
| Resend | 3,000 emails/mo | $20/mo (50k emails) |
| Upstash Redis | 10k commands/day | $10/mo |
| Domain | — | $12/year |
| **Total** | **~$17/year** | **~$80/mo at scale** |

### 19.2 Subscription Tiers

| Tier | Price | Sites | Products | Custom Domain | Transaction Fee |
|---|---|---|---|---|---|
| **Free** | $0/mo | 1 | 10 | ❌ | 2% |
| **Starter** | $9/mo | 3 | 100 | ✅ | 1% |
| **Business** | $29/mo | 10 | 1,000 | ✅ | 0% |
| **Enterprise** | $99/mo | Unlimited | Unlimited | ✅ | 0% |

### 19.3 Additional Revenue Streams

| Stream | Pricing |
|---|---|
| Premium templates | $19–49 each |
| Template bundles | $99–199 |
| AI credits | $0.10 per credit |
| Custom development | $500–5,000 per project |
| Agency white-label license | $299/mo |

---

## Architecture Decisions & Recommendations

### 20.1 Key Decisions

| Decision | Choice | Reason |
|---|---|---|
| Monorepo | Turborepo + pnpm | Faster builds, shared packages |
| Package Manager | pnpm (TS), pub (Dart) | Better disk usage, workspaces |
| API Style | REST (not GraphQL) | Simpler, better caching with Workers |
| State Management | Zustand (web), Riverpod (Flutter) | Lightweight, TS support |
| Styling | Tailwind CSS + shadcn/ui | Consistent, production-ready |
| Hosting | Vercel (web), Cloudflare (API) | Edge-first, great DX |

### 20.2 Performance

| Area | Strategy |
|---|---|
| Caching | Cloudflare KV (sessions), Redis (rate limits) |
| CDN | Cloudflare for all static assets |
| Images | R2 + Cloudflare Image transformations |
| Database | Supabase connection pooling |
| Edge | Storefront SSR at edge (Vercel Edge) |

### 20.3 Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Database | `snake_case` | `order_items`, `created_at` |
| URL Paths | `kebab-case` | `/my-store/products` |
| API JSON | `camelCase` | `{ "orderId": "..." }` |
| React Components | `PascalCase` | `ProductCard.tsx` |
| Package Names | `@letbuyy/kebab` | `@letbuyy/api-types` |

### 20.4 What Gets Removed (from Firebase)

- ❌ Firestore → PostgreSQL (Supabase)
- ❌ Firebase Auth → Supabase Auth
- ❌ Firebase Storage → Cloudflare R2
- ❌ Cloud Functions → Cloudflare Workers
- ❌ Delivery partner Flutter app (not needed)
- ✅ Firebase Cloud Messaging (FCM) — **kept** for push notifications

### 20.5 What Gets Added

- ✅ Super Admin Console (`console.letbuyy.store`)
- ✅ Employee Portal (`team.letbuyy.store`)
- ✅ Accounts Portal (`accounts.letbuyy.store`)
- ✅ Store-specific admin routing (`admin.letbuyy.store/{store}`)
- ✅ Portfolio & Resume storefront types
- ✅ Cloudflare Workers API layer
- ✅ TypeScript shared packages (`@letbuyy/api-types`, `@letbuyy/utils`, `@letbuyy/ui`)
- ✅ Comprehensive audit logging
- ✅ Role-based employee access

---

## Deployment Checklist

- [ ] Set up Supabase project and database
- [ ] Configure Cloudflare DNS and domains
- [ ] Deploy Next.js apps to Vercel
- [ ] Configure Stripe and Razorpay accounts
- [ ] Set up Resend for email notifications
- [ ] Configure Firebase Cloud Messaging
- [ ] Enable SSL certificates for all domains
- [ ] Set up R2 storage buckets
- [ ] Configure environment variables (all apps)
- [ ] Test payment flows (Stripe, Razorpay, PayPal)
- [ ] Test email notifications
- [ ] Test push notifications on all platforms
- [ ] Set up analytics and monitoring
- [ ] Create initial template library
- [ ] Prepare marketing materials
- [ ] Launch beta program
- [ ] Begin user onboarding

---

*For questions or support: team@letbuyy.store*
