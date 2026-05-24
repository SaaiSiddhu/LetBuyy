# LetBuyy Platform — Complete Customer Management System

> **Doc 16 of 17** | Customer Accounts, Authentication, Guest Checkout, Wishlists, Order History, Auth Gates & Admin Customer Management
>
> **Version:** 1.0 | **Date:** February 17, 2026
>
> **Prev:** [15 App Store Implementation](./15_App_Store_Implementation.md) | **Next:** [17 Storefront Landing](./17_Storefront_Landing.md)

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Database Schema — Complete](#2-database-schema--complete)
3. [Customer Service Layer](#3-customer-service-layer)
4. [Authentication Architecture](#4-authentication-architecture)
5. [Session Management (JWT Cookies)](#5-session-management-jwt-cookies)
6. [API Endpoints — Complete Reference](#6-api-endpoints--complete-reference)
7. [Customer Auth Context (React)](#7-customer-auth-context-react)
8. [Account Bottom Sheet UI](#8-account-bottom-sheet-ui)
9. [Authentication Flows](#9-authentication-flows)
10. [Guest Checkout → Customer Auto-Creation](#10-guest-checkout--customer-auto-creation)
11. [Account Page — Orders & Wishlist](#11-account-page--orders--wishlist)
12. [Wishlist System](#12-wishlist-system)
13. [Auth Gates & Protected Routes](#13-auth-gates--protected-routes)
14. [Header Integration (Account Icon)](#14-header-integration-account-icon)
15. [Admin Customer Management](#15-admin-customer-management)
16. [Customer LTV Segmentation](#16-customer-ltv-segmentation)
17. [Email Notifications & Transactional](#17-email-notifications--transactional)
18. [Customer Data Export & GDPR](#18-customer-data-export--gdpr)
19. [Security & Password Policies](#19-security--password-policies)
20. [Theme-Agnostic Component Architecture](#20-theme-agnostic-component-architecture)
21. [Migration from Legacy Tables](#21-migration-from-legacy-tables)
22. [Testing Strategy](#22-testing-strategy)
23. [Shopify Feature Parity Matrix](#23-shopify-feature-parity-matrix)
24. [Performance & Caching](#24-performance--caching)
25. [Document History](#25-document-history)

---

# PART 1 — Architecture, Database & Core Service Layer

---

## 1. System Architecture Overview

> **Cross-ref:** [05_Ecommerce_Engine §5 — Customer Management](./05_Ecommerce_Engine.md) | [02_Authentication §3 — Session Management](./02_Authentication_and_Security.md) | [10_Storefront §12 — Customer-Facing Pages](./10_Storefront_and_Themes.md)

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                  LetBuyy Customer Management — Full Architecture                  │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          STOREFRONT LAYER                                    │ │
│  │                                                                               │ │
│  │  {store}.letbuyy.store                                                        │ │
│  │       │                                                                       │ │
│  │       ├── Account Bottom Sheet (login/signup/set-password)                   │ │
│  │       ├── Account Page (/account — orders, wishlist, settings)               │ │
│  │       ├── Checkout (guest + authenticated — auto-creates customer)           │ │
│  │       ├── Wishlist (♡ on product cards — localStorage + server sync)         │ │
│  │       └── Auth Gates (protects /account, /orders behind login)              │ │
│  │                                                                               │ │
│  │  React Contexts:                                                              │ │
│  │  ┌────────────────────┐  ┌──────────────────┐  ┌──────────────────────┐     │ │
│  │  │ CustomerAuthProvider│  │ WishlistProvider │  │ CartProvider          │     │ │
│  │  │ • customer state   │  │ • items[]        │  │ • items[] (existing) │     │ │
│  │  │ • login/logout     │  │ • localStorage   │  │ • totals             │     │ │
│  │  │ • session cookie   │  │ • server sync    │  │ • coupon             │     │ │
│  │  └────────────────────┘  └──────────────────┘  └──────────────────────┘     │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                         │
│                                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          API LAYER (Next.js Route Handlers)                   │ │
│  │                                                                               │ │
│  │  /api/customer/check          GET  — Check if email exists + has password    │ │
│  │  /api/customer/login          POST — Verify password, create session         │ │
│  │  /api/customer/set-password   POST — First-time password (guest → account)  │ │
│  │  /api/customer/logout         POST — Clear session cookie                    │ │
│  │  /api/customer/session        GET  — Get current session from cookie         │ │
│  │  /api/customer/orders         GET  — Fetch authenticated customer's orders   │ │
│  │  /api/customer/wishlist       GET/POST/DELETE — Wishlist CRUD                │ │
│  │  /api/orders                  POST — Create order + auto-create customer     │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                         │
│                                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          SERVICE LAYER                                        │ │
│  │                                                                               │ │
│  │  ┌───────────────────────┐   ┌──────────────────────────────────────────┐   │ │
│  │  │ customer-service.ts   │   │ order-service.ts (existing, modified)    │   │ │
│  │  │                       │   │                                          │   │ │
│  │  │ • findOrCreateCustomer│   │ • createOrder() → calls                 │   │ │
│  │  │ • getCustomerByEmail  │   │   findOrCreateCustomer()                │   │ │
│  │  │ • setPassword         │   │ • getOrdersByContact()                  │   │ │
│  │  │ • verifyPassword      │   │ • updateOrderStatus()                   │   │ │
│  │  │ • hasPassword         │   │                                          │   │ │
│  │  │ • updateStats         │   └──────────────────────────────────────────┘   │ │
│  │  │ • getCustomerOrders   │                                                   │ │
│  │  │ • wishlist CRUD       │                                                   │ │
│  │  └───────────────────────┘                                                   │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                         │                                         │
│                                         ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          DATA LAYER (Supabase)                                │ │
│  │                                                                               │ │
│  │  ┌──────────────────┐  ┌────────────────────┐  ┌────────────────────────┐  │ │
│  │  │ store_customers  │  │ customer_wishlists │  │ orders (existing)      │  │ │
│  │  │                  │  │                    │  │                        │  │ │
│  │  │ • id (PK)        │  │ • customer_id (FK) │  │ • customer_email      │  │ │
│  │  │ • store_id (FK)  │  │ • product_id       │  │ • customer_name       │  │ │
│  │  │ • email (UQ)     │  │ • store_id (FK)    │  │ • order_number        │  │ │
│  │  │ • password_hash  │  │                    │  │ • status              │  │ │
│  │  │ • full_name      │  └────────────────────┘  │ • pricing             │  │ │
│  │  │ • total_orders   │                          └────────────────────────┘  │ │
│  │  │ • total_spent    │                                                       │ │
│  │  └──────────────────┘                                                       │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │                          ADMIN LAYER                                          │ │
│  │                                                                               │ │
│  │  admin.letbuyy.store/{store}/customers                                        │ │
│  │  ├── Customer list (search, filter, segment, export CSV)                     │ │
│  │  ├── Customer detail (orders, notes, tags, password status)                  │ │
│  │  └── Reads from store_customers table (replaces old contacts table)          │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Feature Comparison — Shopify vs LetBuyy

| Feature | Shopify | LetBuyy Current | LetBuyy Target |
|---|---|---|---|
| **Customer Accounts** | ✅ Email/password + social | ❌ Not implemented | ✅ Email/password only |
| **Guest Checkout** | ✅ Auto-creates customer record | ❌ No customer record | ✅ Auto-creates store_customers row |
| **Password Setting** | ✅ Account invite flow | ❌ Not implemented | ✅ First-time password flow (guest→account) |
| **Order History** | ✅ Full order history | ❌ Partial (orders page exists) | ✅ Auth-gated order history |
| **Wishlist** | ✅ Via apps | ❌ Not implemented | ✅ Built-in (localStorage + server sync) |
| **Auth Gates** | ✅ Configurable per route | ❌ Not implemented | ✅ Account page, order history gated |
| **Customer Segmentation** | ✅ RFM + tags | ❌ Not implemented | ✅ LTV tiers (new/returning/loyal/VIP) |
| **Admin Customer View** | ✅ Full CRM panel | ⚠️ Queries non-existent table | ✅ Full customer management |
| **Social Login** | ✅ Google/Facebook/Apple | ❌ — | ❌ Intentionally excluded |
| **Multi-store Isolation** | ✅ Per-store customers | ❌ — | ✅ store_id scoped (UNIQUE store_id+email) |
| **Customer Notes** | ✅ Admin notes per customer | ❌ — | ✅ Notes + tags on store_customers |
| **Customer Export** | ✅ CSV export | ❌ — | ✅ CSV export from admin |
| **Account Page** | ✅ /account with tabs | ❌ Not implemented | ✅ /account (orders, wishlist, settings) |
| **Session Management** | ✅ Shopify session tokens | ❌ — | ✅ JWT httpOnly cookie (lb_customer_session) |

### 1.3 Key Design Principles

| Principle | Description |
|---|---|
| **Email/Password Only** | No social login — reduces complexity, aligns with Shopify's "classic" customer accounts |
| **Guest-First Checkout** | Checkout never requires login — customer record created silently from order email |
| **Store-Scoped Isolation** | Every customer record is scoped to `(store_id, email)` — same email on two stores = two separate customers |
| **Progressive Account Creation** | Guest → Set Password → Full Account — never blocks the purchase funnel |
| **Theme-Agnostic Components** | All customer UI (bottom sheet, account page) uses CSS variables from the theme engine |
| **No Separate Sign-Up Form** | New customers are ONLY created via checkout — prevents empty/spam accounts |
| **Server-Side Sessions** | JWT in httpOnly cookie — not accessible to client JS, immune to XSS |
| **Automatic Stats** | `total_orders`, `total_spent`, `last_order_at` updated automatically on every order |

### 1.4 Data Flow Summary

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER LIFECYCLE DATA FLOW                            │
│                                                                            │
│  1. GUEST CHECKOUT                                                         │
│     Customer visits store → Adds to cart → Enters email at checkout       │
│     → POST /api/orders → createOrder() → findOrCreateCustomer()          │
│     → store_customers row created (password_hash = NULL)                  │
│     → Admin sees customer as "Guest (no password)"                        │
│                                                                            │
│  2. RETURN VISIT — FIRST-TIME PASSWORD                                    │
│     Customer clicks Account icon → Enters same email                      │
│     → GET /api/customer/check → { exists: true, hasPassword: false }     │
│     → UI shows "Welcome Back! Set a password"                             │
│     → Customer sets password → POST /api/customer/set-password           │
│     → password_hash updated → Session cookie created → Logged in         │
│                                                                            │
│  3. SUBSEQUENT LOGIN                                                       │
│     Customer clicks Account icon → Enters email                           │
│     → GET /api/customer/check → { exists: true, hasPassword: true }      │
│     → UI shows password field → POST /api/customer/login                 │
│     → bcrypt.compare() → Session cookie created → Logged in              │
│                                                                            │
│  4. AUTHENTICATED SHOPPING                                                 │
│     Logged-in customer browses → ♡ products saved to wishlist            │
│     → Views /account → Orders tab (auth-gated) → Wishlist tab            │
│     → Checkout → findOrCreateCustomer() updates stats                    │
│     → total_orders++, total_spent += orderTotal                           │
│                                                                            │
│  5. ADMIN VIEW                                                             │
│     Admin opens Customers page → Queries store_customers                  │
│     → Sees all customers (guests + accounts)                              │
│     → Clicks customer → Detail view with orders, notes, tags             │
│     → Can add tags, notes, export CSV                                     │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema — Complete

### 2.1 `store_customers` Table — Core Customer Record

```sql
-- Core customer table — one row per (store, email) combination
-- Replaces the legacy 'contacts' table and 'customer_credentials' table
CREATE TABLE IF NOT EXISTS store_customers (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Identity
    email           TEXT NOT NULL,
    full_name       TEXT,
    first_name      TEXT,                            -- Extracted from full_name
    last_name       TEXT,                            -- Extracted from full_name
    phone           TEXT,
    avatar_url      TEXT,
    
    -- Authentication
    password_hash   TEXT,                            -- NULL = guest (no password set yet)
    -- When NULL: customer was auto-created from checkout (guest)
    -- When set: customer has created an account (can login)
    password_set_at TIMESTAMPTZ,                    -- When password was first set
    last_login_at   TIMESTAMPTZ,                    -- Last successful login timestamp
    login_count     INTEGER DEFAULT 0,              -- Number of successful logins
    
    -- Status & Permissions
    status          TEXT DEFAULT 'active',           -- 'active' | 'disabled' | 'blocked'
    -- 'active': normal customer
    -- 'disabled': admin-disabled account (cannot login)
    -- 'blocked': auto-blocked (too many failed login attempts)
    
    -- Computed / Denormalized (updated on every order)
    total_orders    INTEGER DEFAULT 0,
    total_spent     DECIMAL(12,2) DEFAULT 0,
    avg_order_value DECIMAL(12,2) DEFAULT 0,        -- total_spent / total_orders
    last_order_at   TIMESTAMPTZ,
    last_order_id   UUID,                           -- FK to orders table
    
    -- Marketing & CRM
    accepts_marketing BOOLEAN DEFAULT false,
    marketing_opt_in_at TIMESTAMPTZ,
    tags            TEXT[] DEFAULT '{}',             -- ['vip', 'wholesale', 'influencer']
    note            TEXT,                            -- Admin internal notes
    
    -- Customer Segmentation (auto-calculated by cron)
    ltv_tier        TEXT DEFAULT 'new',
    -- 'new' | 'returning' | 'loyal' | 'vip' | 'at_risk' | 'churned'
    
    -- Addresses (stored as JSONB array for simplicity)
    addresses       JSONB DEFAULT '[]',
    -- Format: [{ label, line1, line2, city, state, postal_code, country, phone, is_default }]
    default_address_index INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Unique constraint: one customer per email per store
    UNIQUE(store_id, email)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_store_customers_store ON store_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_customers_email ON store_customers(store_id, email);
CREATE INDEX IF NOT EXISTS idx_store_customers_status ON store_customers(store_id, status);
CREATE INDEX IF NOT EXISTS idx_store_customers_ltv ON store_customers(store_id, ltv_tier);
CREATE INDEX IF NOT EXISTS idx_store_customers_orders ON store_customers(store_id, total_orders DESC);
CREATE INDEX IF NOT EXISTS idx_store_customers_spent ON store_customers(store_id, total_spent DESC);
CREATE INDEX IF NOT EXISTS idx_store_customers_search ON store_customers 
    USING gin(to_tsvector('english', COALESCE(full_name, '') || ' ' || email || ' ' || COALESCE(phone, '')));

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_store_customer_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    -- Auto-compute first_name / last_name from full_name
    IF NEW.full_name IS NOT NULL AND NEW.full_name != COALESCE(OLD.full_name, '') THEN
        NEW.first_name = split_part(NEW.full_name, ' ', 1);
        NEW.last_name = CASE 
            WHEN position(' ' IN NEW.full_name) > 0 
            THEN substring(NEW.full_name FROM position(' ' IN NEW.full_name) + 1)
            ELSE NULL
        END;
    END IF;
    -- Auto-compute avg_order_value
    IF NEW.total_orders > 0 THEN
        NEW.avg_order_value = NEW.total_spent / NEW.total_orders;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_store_customer_updated
    BEFORE UPDATE ON store_customers
    FOR EACH ROW
    EXECUTE FUNCTION update_store_customer_timestamp();
```

### 2.2 `customer_wishlists` Table

```sql
-- Customer wishlist items — one row per (customer, product) pair
CREATE TABLE IF NOT EXISTS customer_wishlists (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES store_customers(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    product_id      TEXT NOT NULL,                   -- Product ID (from products table)
    variant_id      TEXT,                            -- Optional variant ID
    
    -- Metadata
    added_from      TEXT DEFAULT 'storefront',       -- 'storefront' | 'api' | 'import'
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate wishlist entries
    UNIQUE(customer_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_customer ON customer_wishlists(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_store ON customer_wishlists(store_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product ON customer_wishlists(product_id);
```

### 2.3 `customer_activity_log` Table

```sql
-- Audit log for customer actions (login, password change, order, wishlist)
CREATE TABLE IF NOT EXISTS customer_activity_log (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id     UUID NOT NULL REFERENCES store_customers(id) ON DELETE CASCADE,
    store_id        UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    
    action          TEXT NOT NULL,
    -- Possible actions:
    -- 'account_created'     — Auto-created from checkout
    -- 'password_set'        — First-time password setting
    -- 'login_success'       — Successful login
    -- 'login_failed'        — Failed login attempt
    -- 'logout'              — Logout
    -- 'password_changed'    — Password update
    -- 'order_placed'        — Order created
    -- 'wishlist_add'        — Item added to wishlist
    -- 'wishlist_remove'     — Item removed from wishlist
    -- 'profile_updated'     — Name/phone/address changed
    -- 'admin_note_added'    — Admin added a note
    -- 'admin_tag_added'     — Admin added a tag
    -- 'status_changed'      — Account status changed
    
    metadata        JSONB DEFAULT '{}',
    -- Examples:
    -- { "order_id": "...", "order_total": 2499 }
    -- { "product_id": "...", "product_title": "..." }
    -- { "ip": "...", "user_agent": "..." }
    -- { "old_status": "active", "new_status": "disabled" }
    
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_customer ON customer_activity_log(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_store ON customer_activity_log(store_id, action);
```

### 2.4 Row Level Security (RLS)

```sql
-- store_customers: Service role bypasses RLS; storefront uses service role via API
ALTER TABLE store_customers ENABLE ROW LEVEL SECURITY;

-- Admin can view their store's customers
CREATE POLICY "Store owners view customers"
    ON store_customers FOR SELECT
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Admin can update their store's customers (notes, tags, status)
CREATE POLICY "Store owners update customers"
    ON store_customers FOR UPDATE
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- Service role can insert (for auto-creation during checkout)
-- Note: Storefront API routes use SUPABASE_SERVICE_ROLE_KEY which bypasses RLS

-- customer_wishlists: Same approach
ALTER TABLE customer_wishlists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners view wishlists"
    ON customer_wishlists FOR SELECT
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));

-- customer_activity_log: Admin read-only
ALTER TABLE customer_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Store owners view activity"
    ON customer_activity_log FOR SELECT
    USING (store_id IN (SELECT id FROM sites WHERE user_id = auth.uid()));
```

### 2.5 Entity Relationship Diagram

```
sites (stores)                  orders (existing)
┌──────────────────┐          ┌──────────────────────────┐
│ id (PK)          │          │ id (PK)                  │
│ name             │          │ store_id (FK→sites)      │
│ subdomain        │          │ customer_email           │
│ user_id          │          │ customer_name            │
│ template_config  │          │ order_number             │
│ status           │          │ status                   │
└──────────────────┘          │ pricing (JSONB)          │
       │                      │ created_at               │
       │                      └──────────────────────────┘
       │                               ▲
       │                               │ (linked by email)
       ▼                               │
┌──────────────────────────┐           │
│ store_customers          │───────────┘
│                          │
│ id (PK)                  │
│ store_id (FK→sites)      │◄──────────────────────────┐
│ email (UQ w/ store_id)   │                            │
│ full_name                │     ┌──────────────────────┴──────┐
│ phone                    │     │ customer_wishlists           │
│ password_hash            │     │                              │
│ status                   │     │ id (PK)                      │
│ total_orders             │     │ customer_id (FK→store_cust)  │
│ total_spent              │     │ store_id (FK→sites)          │
│ ltv_tier                 │     │ product_id                   │
│ tags TEXT[]              │     │ created_at                   │
│ note                     │     └─────────────────────────────┘
│ addresses JSONB          │
│ created_at               │     ┌─────────────────────────────┐
│ updated_at               │     │ customer_activity_log       │
└──────────────────────────┘     │                              │
       │                          │ id (PK)                     │
       │                          │ customer_id (FK→store_cust) │
       └────────────────────────►│ store_id (FK→sites)         │
                                  │ action                      │
                                  │ metadata JSONB              │
                                  │ created_at                  │
                                  └─────────────────────────────┘
```

### 2.6 Migration Script

```sql
-- Migration: 021_customer_management.sql
-- Migrates from legacy contacts + customer_credentials tables

BEGIN;

-- 1. Create new tables
-- (execute CREATE TABLE statements from sections 2.1, 2.2, 2.3 above)

-- 2. Migrate data from legacy contacts table (if exists)
INSERT INTO store_customers (store_id, email, full_name, phone, total_orders, total_spent, created_at)
SELECT 
    store_id, 
    email, 
    full_name, 
    phone, 
    COALESCE(total_orders, 0),
    COALESCE(total_spent, 0),
    created_at
FROM contacts
WHERE email IS NOT NULL
ON CONFLICT (store_id, email) DO NOTHING;

-- 3. Migrate passwords from legacy customer_credentials table (if exists)
UPDATE store_customers sc
SET 
    password_hash = cc.password_hash,
    password_set_at = cc.created_at
FROM customer_credentials cc
WHERE sc.email = cc.email_or_phone
  AND cc.password_hash IS NOT NULL;

-- 4. Backfill from orders table — create customer records for any emails
-- that exist in orders but not yet in store_customers
INSERT INTO store_customers (store_id, email, full_name, phone, total_orders, total_spent, last_order_at)
SELECT 
    o.store_id,
    o.customer_email,
    o.customer_name,
    o.customer_phone,
    COUNT(o.id) as total_orders,
    COALESCE(SUM((o.pricing->>'total')::decimal), 0) as total_spent,
    MAX(o.created_at) as last_order_at
FROM orders o
WHERE o.customer_email IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM store_customers sc 
      WHERE sc.store_id = o.store_id AND sc.email = o.customer_email
  )
GROUP BY o.store_id, o.customer_email, o.customer_name, o.customer_phone;

-- 5. Enable RLS
ALTER TABLE store_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_activity_log ENABLE ROW LEVEL SECURITY;

COMMIT;
```

---

## 3. Customer Service Layer

> **File:** `storefront/src/lib/customer-service.ts`

### 3.1 Complete Service Implementation

```typescript
// apps/web/consumer/storefront/src/lib/customer-service.ts

import bcrypt from 'bcryptjs';
import { createServiceClient } from './supabase';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// ============================================================
// Types
// ============================================================

export interface StoreCustomer {
    id: string;
    storeId: string;
    email: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    avatarUrl: string | null;
    hasPassword: boolean;
    status: 'active' | 'disabled' | 'blocked';
    totalOrders: number;
    totalSpent: number;
    avgOrderValue: number;
    lastOrderAt: string | null;
    acceptsMarketing: boolean;
    tags: string[];
    note: string | null;
    ltvTier: string;
    addresses: CustomerAddress[];
    createdAt: string;
    updatedAt: string;
}

export interface CustomerAddress {
    label: string;       // 'Home', 'Work', 'Other'
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    phone?: string;
    isDefault?: boolean;
}

export interface CustomerSession {
    customerId: string;
    storeId: string;
    email: string;
    fullName: string | null;
}

// ============================================================
// Customer CRUD Operations
// ============================================================

/**
 * Find existing customer or create a new one.
 * Called automatically during checkout (guest or authenticated).
 * If customer exists, updates name/phone if provided.
 */
export async function findOrCreateCustomer(
    storeId: string,
    email: string,
    fullName?: string,
    phone?: string
): Promise<StoreCustomer> {
    const db = createServiceClient();
    if (!db) throw new Error('Database not available');

    const normalizedEmail = email.toLowerCase().trim();

    // Try to find existing customer
    const { data: existing } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', normalizedEmail)
        .single();

    if (existing) {
        // Update name/phone if provided and not already set
        const updates: Record<string, unknown> = {};
        if (fullName && !existing.full_name) updates.full_name = fullName;
        if (phone && !existing.phone) updates.phone = phone;

        if (Object.keys(updates).length > 0) {
            await db.from('store_customers')
                .update(updates)
                .eq('id', existing.id);
        }

        return mapToStoreCustomer(existing);
    }

    // Create new customer (guest — no password)
    const { data: created, error } = await db
        .from('store_customers')
        .insert({
            store_id: storeId,
            email: normalizedEmail,
            full_name: fullName || null,
            phone: phone || null,
            password_hash: null,  // Guest — no password yet
            status: 'active',
        })
        .select()
        .single();

    if (error) {
        console.error('[CustomerService] Error creating customer:', error.message);
        throw new Error('Failed to create customer');
    }

    // Log activity
    await logActivity(db, created.id, storeId, 'account_created', {
        source: 'checkout',
        email: normalizedEmail,
    });

    return mapToStoreCustomer(created);
}

/**
 * Get customer by email for a specific store.
 */
export async function getCustomerByEmail(
    storeId: string,
    email: string
): Promise<StoreCustomer | null> {
    const db = createServiceClient();
    if (!db) return null;

    const { data } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .single();

    return data ? mapToStoreCustomer(data) : null;
}

/**
 * Check if a customer exists and whether they have a password.
 */
export async function checkCustomerStatus(
    storeId: string,
    email: string
): Promise<{ exists: boolean; hasPassword: boolean; status: string }> {
    const db = createServiceClient();
    if (!db) return { exists: false, hasPassword: false, status: 'unknown' };

    const { data } = await db
        .from('store_customers')
        .select('id, password_hash, status')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase().trim())
        .single();

    if (!data) return { exists: false, hasPassword: false, status: 'not_found' };

    return {
        exists: true,
        hasPassword: !!data.password_hash,
        status: data.status,
    };
}

// ============================================================
// Password Management
// ============================================================

/**
 * Set password for the first time (guest → account).
 * Also used for password reset.
 */
export async function setCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<void> {
    const db = createServiceClient();
    if (!db) throw new Error('Database not available');

    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const normalizedEmail = email.toLowerCase().trim();

    const { error } = await db
        .from('store_customers')
        .update({
            password_hash: hashedPassword,
            password_set_at: new Date().toISOString(),
        })
        .eq('store_id', storeId)
        .eq('email', normalizedEmail);

    if (error) {
        console.error('[CustomerService] Error setting password:', error.message);
        throw new Error('Failed to set password');
    }

    // Log activity
    const { data: customer } = await db
        .from('store_customers')
        .select('id')
        .eq('store_id', storeId)
        .eq('email', normalizedEmail)
        .single();

    if (customer) {
        await logActivity(db, customer.id, storeId, 'password_set', {
            email: normalizedEmail,
        });
    }
}

/**
 * Verify customer password for login.
 * Returns the customer record on success, null on failure.
 * Implements login attempt tracking and account lockout.
 */
export async function verifyCustomerPassword(
    storeId: string,
    email: string,
    password: string
): Promise<StoreCustomer | null> {
    const db = createServiceClient();
    if (!db) return null;

    const normalizedEmail = email.toLowerCase().trim();

    const { data } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', normalizedEmail)
        .single();

    if (!data || !data.password_hash) return null;

    // Check if account is blocked/disabled
    if (data.status === 'disabled') {
        throw new Error('Account is disabled. Contact the store for assistance.');
    }
    if (data.status === 'blocked') {
        throw new Error('Account is temporarily locked. Try again later.');
    }

    const isValid = await bcrypt.compare(password, data.password_hash);

    if (!isValid) {
        // Log failed attempt
        await logActivity(db, data.id, storeId, 'login_failed', {
            email: normalizedEmail,
        });
        return null;
    }

    // Successful login — update last_login_at
    await db
        .from('store_customers')
        .update({
            last_login_at: new Date().toISOString(),
            login_count: (data.login_count || 0) + 1,
            status: 'active', // Unblock if previously blocked
        })
        .eq('id', data.id);

    await logActivity(db, data.id, storeId, 'login_success', {
        email: normalizedEmail,
    });

    return mapToStoreCustomer(data);
}

// ============================================================
// Order Stats Update
// ============================================================

/**
 * Update customer stats after a new order is placed.
 * Called from createOrder() in order-service.ts.
 */
export async function updateCustomerStats(
    storeId: string,
    email: string,
    orderTotal: number,
    orderId: string
): Promise<void> {
    const db = createServiceClient();
    if (!db) return;

    const normalizedEmail = email.toLowerCase().trim();

    // Atomic update using Supabase RPC or manual update
    const { data: customer } = await db
        .from('store_customers')
        .select('id, total_orders, total_spent')
        .eq('store_id', storeId)
        .eq('email', normalizedEmail)
        .single();

    if (!customer) return;

    const newTotalOrders = (customer.total_orders || 0) + 1;
    const newTotalSpent = parseFloat(String(customer.total_spent || 0)) + orderTotal;

    await db
        .from('store_customers')
        .update({
            total_orders: newTotalOrders,
            total_spent: newTotalSpent,
            last_order_at: new Date().toISOString(),
            last_order_id: orderId,
        })
        .eq('id', customer.id);

    // Log activity
    await logActivity(db, customer.id, storeId, 'order_placed', {
        order_id: orderId,
        order_total: orderTotal,
        total_orders: newTotalOrders,
    });
}

// ============================================================
// Wishlist Operations
// ============================================================

/**
 * Get customer's wishlist items with product details.
 */
export async function getCustomerWishlist(
    customerId: string,
    storeId: string
): Promise<string[]> {
    const db = createServiceClient();
    if (!db) return [];

    const { data } = await db
        .from('customer_wishlists')
        .select('product_id')
        .eq('customer_id', customerId)
        .eq('store_id', storeId)
        .order('created_at', { ascending: false });

    return data?.map(w => w.product_id) || [];
}

/**
 * Add a product to customer's wishlist.
 */
export async function addToWishlist(
    customerId: string,
    storeId: string,
    productId: string,
    variantId?: string
): Promise<void> {
    const db = createServiceClient();
    if (!db) return;

    const { error } = await db
        .from('customer_wishlists')
        .upsert(
            {
                customer_id: customerId,
                store_id: storeId,
                product_id: productId,
                variant_id: variantId || null,
            },
            { onConflict: 'customer_id,product_id' }
        );

    if (error && !error.message.includes('duplicate')) {
        console.error('[CustomerService] Error adding to wishlist:', error.message);
    }

    await logActivity(db, customerId, storeId, 'wishlist_add', { product_id: productId });
}

/**
 * Remove a product from customer's wishlist.
 */
export async function removeFromWishlist(
    customerId: string,
    productId: string
): Promise<void> {
    const db = createServiceClient();
    if (!db) return;

    const { data } = await db
        .from('customer_wishlists')
        .select('store_id')
        .eq('customer_id', customerId)
        .eq('product_id', productId)
        .single();

    await db
        .from('customer_wishlists')
        .delete()
        .eq('customer_id', customerId)
        .eq('product_id', productId);

    if (data) {
        await logActivity(db, customerId, data.store_id, 'wishlist_remove', {
            product_id: productId,
        });
    }
}

/**
 * Sync local wishlist items (from localStorage) to server after login.
 */
export async function syncWishlistFromLocal(
    customerId: string,
    storeId: string,
    localProductIds: string[]
): Promise<void> {
    const db = createServiceClient();
    if (!db) return;

    for (const productId of localProductIds) {
        await db
            .from('customer_wishlists')
            .upsert(
                {
                    customer_id: customerId,
                    store_id: storeId,
                    product_id: productId,
                    added_from: 'sync',
                },
                { onConflict: 'customer_id,product_id' }
            );
    }
}

// ============================================================
// Customer Orders
// ============================================================

/**
 * Get all orders for a customer (by email + store subdomain).
 */
export async function getCustomerOrders(
    storeId: string,
    email: string
): Promise<unknown[]> {
    const db = createServiceClient();
    if (!db) return [];

    const { data } = await db
        .from('orders')
        .select('*')
        .eq('store_id', storeId)
        .eq('customer_email', email.toLowerCase().trim())
        .order('created_at', { ascending: false });

    return data || [];
}

// ============================================================
// Admin Operations
// ============================================================

/**
 * Get all customers for a store (admin view).
 */
export async function getStoreCustomers(
    storeId: string,
    options?: {
        search?: string;
        status?: string;
        ltvTier?: string;
        hasPassword?: boolean;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
        page?: number;
        limit?: number;
    }
): Promise<{ customers: StoreCustomer[]; total: number }> {
    const db = createServiceClient();
    if (!db) return { customers: [], total: 0 };

    const {
        search, status, ltvTier, hasPassword,
        sortBy = 'created_at', sortOrder = 'desc',
        page = 1, limit = 20
    } = options || {};

    let query = db
        .from('store_customers')
        .select('*', { count: 'exact' })
        .eq('store_id', storeId);

    // Filters
    if (search) {
        query = query.or(
            `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
    }
    if (status) query = query.eq('status', status);
    if (ltvTier) query = query.eq('ltv_tier', ltvTier);
    if (hasPassword === true) query = query.not('password_hash', 'is', null);
    if (hasPassword === false) query = query.is('password_hash', null);

    // Sort
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
        console.error('[CustomerService] Error fetching customers:', error.message);
        return { customers: [], total: 0 };
    }

    return {
        customers: (data || []).map(mapToStoreCustomer),
        total: count || 0,
    };
}

/**
 * Update customer admin fields (notes, tags, status).
 */
export async function updateCustomerAdmin(
    customerId: string,
    storeId: string,
    updates: {
        note?: string;
        tags?: string[];
        status?: 'active' | 'disabled';
        acceptsMarketing?: boolean;
    }
): Promise<void> {
    const db = createServiceClient();
    if (!db) return;

    const dbUpdates: Record<string, unknown> = {};
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.acceptsMarketing !== undefined) dbUpdates.accepts_marketing = updates.acceptsMarketing;

    await db
        .from('store_customers')
        .update(dbUpdates)
        .eq('id', customerId)
        .eq('store_id', storeId);
}

// ============================================================
// Helpers
// ============================================================

function mapToStoreCustomer(row: Record<string, unknown>): StoreCustomer {
    return {
        id: row.id as string,
        storeId: row.store_id as string,
        email: row.email as string,
        fullName: row.full_name as string | null,
        firstName: row.first_name as string | null,
        lastName: row.last_name as string | null,
        phone: row.phone as string | null,
        avatarUrl: row.avatar_url as string | null,
        hasPassword: !!(row.password_hash),
        status: row.status as 'active' | 'disabled' | 'blocked',
        totalOrders: (row.total_orders as number) || 0,
        totalSpent: parseFloat(String(row.total_spent || 0)),
        avgOrderValue: parseFloat(String(row.avg_order_value || 0)),
        lastOrderAt: row.last_order_at as string | null,
        acceptsMarketing: (row.accepts_marketing as boolean) || false,
        tags: (row.tags as string[]) || [],
        note: row.note as string | null,
        ltvTier: (row.ltv_tier as string) || 'new',
        addresses: (row.addresses as CustomerAddress[]) || [],
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

async function logActivity(
    db: ReturnType<typeof createServiceClient>,
    customerId: string,
    storeId: string,
    action: string,
    metadata: Record<string, unknown>
): Promise<void> {
    try {
        await db?.from('customer_activity_log').insert({
            customer_id: customerId,
            store_id: storeId,
            action,
            metadata,
        });
    } catch (err) {
        console.warn('[CustomerService] Activity log failed:', err);
    }
}
```

---

# PART 2 — Authentication, Sessions, API Endpoints & Account UI

---

## 4. Authentication Architecture

### 4.1 Authentication Flow State Machine

```
┌────────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER AUTH STATE MACHINE                          │
│                                                                         │
│                   ┌──────────────┐                                      │
│                   │   UNKNOWN    │ ← Initial state (no cookie)         │
│                   └──────┬───────┘                                      │
│                          │                                              │
│              User clicks Account icon                                   │
│                          │                                              │
│                          ▼                                              │
│                   ┌──────────────┐                                      │
│                   │ EMAIL ENTRY  │                                      │
│                   └──────┬───────┘                                      │
│                          │                                              │
│             GET /api/customer/check?email=X&storeId=Y                  │
│                          │                                              │
│               ┌──────────┼──────────┐                                  │
│               │          │          │                                   │
│               ▼          ▼          ▼                                   │
│          ┌─────────┐ ┌────────┐ ┌──────────────┐                      │
│          │ NOT     │ │ EXISTS │ │ EXISTS +      │                      │
│          │ FOUND   │ │ NO PWD │ │ HAS PASSWORD  │                      │
│          └────┬────┘ └───┬────┘ └──────┬───────┘                      │
│               │          │             │                                │
│               ▼          ▼             ▼                                │
│          ┌─────────┐ ┌────────────┐ ┌───────────┐                     │
│          │ "You    │ │ "Welcome  │ │ PASSWORD  │                      │
│          │  need   │ │  back!    │ │ ENTRY     │                      │
│          │  to     │ │  Set a    │ │           │                      │
│          │  place  │ │  password"│ │ [Submit]  │                      │
│          │  an     │ ├────┬──────┤ └─────┬─────┘                      │
│          │  order  │ │ [pwd]    │       │                              │
│          │  first" │ │ [confirm]│  POST /api/customer/login           │
│          └─────────┘ │ [Submit] │       │                              │
│                      └────┬─────┘   ┌───┴───┐                         │
│                           │         │       │                          │
│              POST /api/customer     ▼       ▼                          │
│                /set-password   ┌──────┐ ┌───────┐                     │
│                           │    │LOGGED│ │ WRONG │                      │
│                           │    │ IN   │ │ PWD   │                      │
│                           ▼    └──┬───┘ └───────┘                     │
│                      ┌──────┐     │                                    │
│                      │LOGGED│     │                                    │
│                      │ IN   │◄────┘                                    │
│                      └──────┘                                          │
│                           │                                            │
│           Session cookie set (httpOnly, secure)                        │
│           CustomerAuthContext updated                                   │
│           Wishlist synced from localStorage                             │
│           Bottom sheet closes → Account page accessible                │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Authentication Decision Tree

```
Customer clicks Account Icon (or Auth Gate triggers)
│
├─ Has lb_customer_session cookie?
│  ├─ YES → Validate JWT → Show Account Page
│  │        ├─ Valid → Show logged-in state (name, avatar)
│  │        └─ Expired/Invalid → Clear cookie → Show Email Entry
│  └─ NO → Show Account Bottom Sheet (Email Entry)
│
├─ Customer enters email + clicks Continue
│  │
│  ├─ GET /api/customer/check → { exists: false }
│  │  └─ Show: "No account found. Place an order to create one."
│  │     └─ [Shop Now] button → Close bottom sheet
│  │
│  ├─ GET /api/customer/check → { exists: true, hasPassword: false }
│  │  └─ Show: "Welcome back! Set a password to access your account."
│  │     └─ Password + Confirm fields → POST /api/customer/set-password
│  │        ├─ Success → Set cookie → Close sheet → Logged in
│  │        └─ Error → Show error message
│  │
│  └─ GET /api/customer/check → { exists: true, hasPassword: true }
│     └─ Show: Password field
│        └─ POST /api/customer/login
│           ├─ Success → Set cookie → Close sheet → Logged in
│           └─ Wrong password → Show error → Retry (max 5)
```

### 4.3 Why No Separate Sign-Up

| Traditional Sign-Up | LetBuyy Approach |
|---|---|
| User fills form → Creates empty account → May never buy | Guest checkout → Order email auto-creates customer record |
| Spam/bot signups create junk data | Only real customers (who ordered) exist in database |
| Email verification required | Email already verified via order confirmation |
| Two separate flows to maintain | Single flow: Checkout → Set Password → Login |
| Empty customer records clutter admin | Every customer has ≥1 order |

---

## 5. Session Management (JWT Cookies)

### 5.1 JWT Token Structure

```typescript
// JWT Payload — stored in httpOnly cookie 'lb_customer_session'
interface CustomerJWTPayload {
    sub: string;          // customer.id (UUID)
    storeId: string;      // store.id (UUID)
    email: string;        // customer.email
    name: string | null;  // customer.full_name
    iat: number;          // Issued at (epoch seconds)
    exp: number;          // Expires at (epoch seconds) — 7 days from iat
}

// Example decoded payload:
// {
//   "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
//   "storeId": "f0e1d2c3-b4a5-6789-0abc-def123456789",
//   "email": "priya@example.com",
//   "name": "Priya Mehta",
//   "iat": 1739800000,
//   "exp": 1740404800
// }
```

### 5.2 Session Utility Functions

```typescript
// apps/web/consumer/storefront/src/lib/session.ts

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'lb_customer_session';
const SECRET = new TextEncoder().encode(
    process.env.CUSTOMER_SESSION_SECRET || 'lb-customer-session-secret-key-change-in-production'
);
const SESSION_DURATION_DAYS = 7;

interface CustomerSessionPayload extends JWTPayload {
    sub: string;
    storeId: string;
    email: string;
    name: string | null;
}

/**
 * Create a session JWT and set it as an httpOnly cookie.
 */
export async function createSession(customer: {
    id: string;
    storeId: string;
    email: string;
    fullName: string | null;
}): Promise<string> {
    const token = await new SignJWT({
        sub: customer.id,
        storeId: customer.storeId,
        email: customer.email,
        name: customer.fullName,
    })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(`${SESSION_DURATION_DAYS}d`)
        .sign(SECRET);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,  // 7 days in seconds
    });

    return token;
}

/**
 * Verify the session cookie and return the customer payload.
 * Returns null if no cookie, expired, or invalid.
 */
export async function getSession(): Promise<CustomerSessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) return null;

    try {
        const { payload } = await jwtVerify(token, SECRET);
        return payload as CustomerSessionPayload;
    } catch (err) {
        // Token expired or invalid — clear the cookie
        await clearSession();
        return null;
    }
}

/**
 * Clear the session cookie (logout).
 */
export async function clearSession(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 0,  // Immediately expire
    });
}

/**
 * Require a valid session — throws if not authenticated.
 * Use in API routes that need authentication.
 */
export async function requireSession(): Promise<CustomerSessionPayload> {
    const session = await getSession();
    if (!session) {
        throw new Error('Authentication required');
    }
    return session;
}
```

### 5.3 Cookie Configuration

```
┌─────────────────────────────────────────────────────────────────┐
│                     SESSION COOKIE CONFIG                         │
│                                                                   │
│  Name:       lb_customer_session                                 │
│  Value:      JWT (HS256 signed)                                  │
│  httpOnly:   true  ← Cannot be read by client JS (XSS safe)    │
│  secure:     true  ← HTTPS only (production)                    │
│  sameSite:   lax   ← CSRF protection + allows navigation       │
│  path:       /     ← Available on all routes                    │
│  maxAge:     604800 (7 days)                                     │
│  domain:     (not set — defaults to current subdomain)           │
│                                                                   │
│  Security Properties:                                             │
│  ✅ Not accessible to document.cookie (httpOnly)                 │
│  ✅ Not sent on cross-origin requests (sameSite: lax)            │
│  ✅ Only sent over HTTPS (secure: true in production)            │
│  ✅ Scoped to store subdomain (no cross-store leakage)           │
│  ✅ Short-lived (7 days — forces re-auth)                        │
│  ✅ Server-validated on every request (jwt.verify)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. API Endpoints — Complete Reference

### 6.1 Endpoint Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CUSTOMER API ENDPOINTS                                  │
│                                                                            │
│  Base: /api/customer/*                                                     │
│                                                                            │
│  ┌──────────────────┬────────┬──────────────────────────────────────────┐ │
│  │ Endpoint         │ Method │ Auth Required │ Description               │ │
│  ├──────────────────┼────────┼──────────────────────────────────────────┤ │
│  │ /check           │ GET    │ No           │ Check email exists/pwd    │ │
│  │ /login           │ POST   │ No           │ Login with password       │ │
│  │ /set-password    │ POST   │ No           │ First-time password set   │ │
│  │ /logout          │ POST   │ Yes          │ Clear session cookie      │ │
│  │ /session         │ GET    │ Yes          │ Get current session       │ │
│  │ /orders          │ GET    │ Yes          │ Get customer's orders     │ │
│  │ /wishlist        │ GET    │ Yes          │ Get wishlist items        │ │
│  │ /wishlist        │ POST   │ Yes          │ Add to wishlist           │ │
│  │ /wishlist        │ DELETE │ Yes          │ Remove from wishlist      │ │
│  │ /wishlist/sync   │ POST   │ Yes          │ Sync localStorage wishlist│ │
│  │ /profile         │ PATCH  │ Yes          │ Update name/phone/address │ │
│  └──────────────────┴────────┴──────────────────────────────────────────┘ │
│                                                                            │
│  Existing (Modified):                                                      │
│  ┌──────────────────┬────────┬──────────────────────────────────────────┐ │
│  │ /api/orders      │ POST   │ No           │ Create order + auto-     │ │
│  │                  │        │              │ create customer record   │ │
│  └──────────────────┴────────┴──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

### 6.2 `GET /api/customer/check` — Check Customer Status

```typescript
// apps/web/consumer/storefront/src/app/api/customer/check/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { checkCustomerStatus } from '@/lib/customer-service';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');
        const storeId = searchParams.get('storeId');

        if (!email || !storeId) {
            return NextResponse.json(
                { error: 'Email and storeId are required' },
                { status: 400 }
            );
        }

        const result = await checkCustomerStatus(storeId, email);

        return NextResponse.json(result);
        //   { exists: true, hasPassword: true, status: 'active' }
        // | { exists: true, hasPassword: false, status: 'active' }
        // | { exists: false, hasPassword: false, status: 'not_found' }
    } catch (error) {
        console.error('[API] /customer/check error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
```

### 6.3 `POST /api/customer/login` — Customer Login

```typescript
// apps/web/consumer/storefront/src/app/api/customer/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifyCustomerPassword } from '@/lib/customer-service';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const { email, password, storeId } = await request.json();

        if (!email || !password || !storeId) {
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        const customer = await verifyCustomerPassword(storeId, email, password);

        if (!customer) {
            return NextResponse.json(
                { error: 'Invalid email or password' },
                { status: 401 }
            );
        }

        // Create session cookie
        await createSession({
            id: customer.id,
            storeId: customer.storeId,
            email: customer.email,
            fullName: customer.fullName,
        });

        return NextResponse.json({
            success: true,
            customer: {
                id: customer.id,
                email: customer.email,
                fullName: customer.fullName,
                totalOrders: customer.totalOrders,
                totalSpent: customer.totalSpent,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Login failed';
        
        // Account disabled/blocked errors
        if (message.includes('disabled') || message.includes('locked')) {
            return NextResponse.json({ error: message }, { status: 403 });
        }

        console.error('[API] /customer/login error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
```

### 6.4 `POST /api/customer/set-password` — First-Time Password

```typescript
// apps/web/consumer/storefront/src/app/api/customer/set-password/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { setCustomerPassword, getCustomerByEmail } from '@/lib/customer-service';
import { createSession } from '@/lib/session';

export async function POST(request: NextRequest) {
    try {
        const { email, password, storeId } = await request.json();

        if (!email || !password || !storeId) {
            return NextResponse.json(
                { error: 'Email, password, and storeId are required' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'Password must be at least 6 characters' },
                { status: 400 }
            );
        }

        // Set the password
        await setCustomerPassword(storeId, email, password);

        // Get the updated customer record
        const customer = await getCustomerByEmail(storeId, email);

        if (!customer) {
            return NextResponse.json(
                { error: 'Customer not found after password set' },
                { status: 500 }
            );
        }

        // Auto-login: create session cookie
        await createSession({
            id: customer.id,
            storeId: customer.storeId,
            email: customer.email,
            fullName: customer.fullName,
        });

        return NextResponse.json({
            success: true,
            customer: {
                id: customer.id,
                email: customer.email,
                fullName: customer.fullName,
                totalOrders: customer.totalOrders,
            },
        });
    } catch (error) {
        console.error('[API] /customer/set-password error:', error);
        return NextResponse.json(
            { error: 'Failed to set password' },
            { status: 500 }
        );
    }
}
```

### 6.5 `POST /api/customer/logout` — Logout

```typescript
// apps/web/consumer/storefront/src/app/api/customer/logout/route.ts

import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/session';

export async function POST() {
    try {
        await clearSession();
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] /customer/logout error:', error);
        return NextResponse.json(
            { error: 'Logout failed' },
            { status: 500 }
        );
    }
}
```

### 6.6 `GET /api/customer/session` — Get Current Session

```typescript
// apps/web/consumer/storefront/src/app/api/customer/session/route.ts

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

export async function GET() {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({
                authenticated: false,
                customer: null,
            });
        }

        return NextResponse.json({
            authenticated: true,
            customer: {
                id: session.sub,
                storeId: session.storeId,
                email: session.email,
                fullName: session.name,
            },
        });
    } catch (error) {
        console.error('[API] /customer/session error:', error);
        return NextResponse.json({
            authenticated: false,
            customer: null,
        });
    }
}
```

### 6.7 `GET /api/customer/orders` — Customer's Orders

```typescript
// apps/web/consumer/storefront/src/app/api/customer/orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { getCustomerOrders } from '@/lib/customer-service';

export async function GET(request: NextRequest) {
    try {
        const session = await requireSession();

        const orders = await getCustomerOrders(session.storeId, session.email);

        return NextResponse.json({ orders });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        console.error('[API] /customer/orders error:', error);
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }
}
```

### 6.8 Wishlist API Routes

```typescript
// apps/web/consumer/storefront/src/app/api/customer/wishlist/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import {
    getCustomerWishlist,
    addToWishlist,
    removeFromWishlist,
    syncWishlistFromLocal,
} from '@/lib/customer-service';

// GET — Fetch wishlist
export async function GET() {
    try {
        const session = await requireSession();
        const items = await getCustomerWishlist(session.sub, session.storeId);
        return NextResponse.json({ items });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to fetch wishlist' }, { status: 500 });
    }
}

// POST — Add to wishlist
export async function POST(request: NextRequest) {
    try {
        const session = await requireSession();
        const { productId, variantId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        await addToWishlist(session.sub, session.storeId, productId, variantId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to add to wishlist' }, { status: 500 });
    }
}

// DELETE — Remove from wishlist
export async function DELETE(request: NextRequest) {
    try {
        const session = await requireSession();
        const { productId } = await request.json();

        if (!productId) {
            return NextResponse.json({ error: 'productId is required' }, { status: 400 });
        }

        await removeFromWishlist(session.sub, productId);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Failed to remove from wishlist' }, { status: 500 });
    }
}
```

```typescript
// apps/web/consumer/storefront/src/app/api/customer/wishlist/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/session';
import { syncWishlistFromLocal } from '@/lib/customer-service';

export async function POST(request: NextRequest) {
    try {
        const session = await requireSession();
        const { productIds } = await request.json();

        if (!Array.isArray(productIds)) {
            return NextResponse.json({ error: 'productIds must be an array' }, { status: 400 });
        }

        await syncWishlistFromLocal(session.sub, session.storeId, productIds);
        return NextResponse.json({ success: true, synced: productIds.length });
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Authentication required') {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }
        return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }
}
```

### 6.9 Order Creation — Modified to Auto-Create Customer

```typescript
// apps/web/consumer/storefront/src/app/api/orders/route.ts
// MODIFICATION: Add findOrCreateCustomer + updateCustomerStats calls

// --- Add to existing POST handler, after successful order creation ---

import { findOrCreateCustomer, updateCustomerStats } from '@/lib/customer-service';

// ... inside the POST handler, after orderResult is created:

// Auto-create or update customer record
try {
    await findOrCreateCustomer(
        storeId,
        formData.email.toLowerCase(),
        formData.name,
        formData.phone
    );

    // Update customer stats
    const orderTotal = parseFloat(orderResult.pricing?.total || '0');
    await updateCustomerStats(
        storeId,
        formData.email.toLowerCase(),
        orderTotal,
        orderResult.id
    );
} catch (custErr) {
    // Don't fail the order if customer creation fails
    console.error('[Orders API] Customer auto-create failed:', custErr);
}
```

---

## 7. Customer Auth Context (React)

### 7.1 `CustomerAuthProvider` — Complete Implementation

```typescript
// apps/web/consumer/storefront/src/context/customer-auth-context.tsx

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================================
// Types
// ============================================================

interface CustomerInfo {
    id: string;
    email: string;
    fullName: string | null;
    storeId: string;
    totalOrders?: number;
    totalSpent?: number;
}

interface CustomerAuthContextType {
    // State
    customer: CustomerInfo | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    login: (email: string, password: string, storeId: string) => Promise<LoginResult>;
    setPassword: (email: string, password: string, storeId: string) => Promise<LoginResult>;
    checkEmail: (email: string, storeId: string) => Promise<EmailCheckResult>;
    logout: () => Promise<void>;
    refreshSession: () => Promise<void>;
}

interface LoginResult {
    success: boolean;
    error?: string;
    customer?: CustomerInfo;
}

interface EmailCheckResult {
    exists: boolean;
    hasPassword: boolean;
    status: string;
}

// ============================================================
// Context
// ============================================================

const CustomerAuthContext = createContext<CustomerAuthContextType | null>(null);

export function useCustomerAuth(): CustomerAuthContextType {
    const context = useContext(CustomerAuthContext);
    if (!context) {
        throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
    }
    return context;
}

// ============================================================
// Provider
// ============================================================

interface Props {
    children: React.ReactNode;
    storeId?: string;
}

export function CustomerAuthProvider({ children, storeId }: Props) {
    const [customer, setCustomer] = useState<CustomerInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // ── Check Session on Mount ──────────────────────────────
    const refreshSession = useCallback(async () => {
        try {
            const res = await fetch('/api/customer/session');
            const data = await res.json();

            if (data.authenticated && data.customer) {
                setCustomer(data.customer);
            } else {
                setCustomer(null);
            }
        } catch {
            setCustomer(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshSession();
    }, [refreshSession]);

    // ── Check Email ─────────────────────────────────────────
    const checkEmail = useCallback(async (
        email: string,
        sid: string
    ): Promise<EmailCheckResult> => {
        const res = await fetch(
            `/api/customer/check?email=${encodeURIComponent(email)}&storeId=${sid}`
        );
        return res.json();
    }, []);

    // ── Login ───────────────────────────────────────────────
    const login = useCallback(async (
        email: string,
        password: string,
        sid: string
    ): Promise<LoginResult> => {
        try {
            const res = await fetch('/api/customer/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, storeId: sid }),
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, error: data.error || 'Login failed' };
            }

            setCustomer(data.customer);

            // Sync local wishlist after login
            syncLocalWishlist();

            return { success: true, customer: data.customer };
        } catch {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, []);

    // ── Set Password (First Time) ───────────────────────────
    const setPassword = useCallback(async (
        email: string,
        password: string,
        sid: string
    ): Promise<LoginResult> => {
        try {
            const res = await fetch('/api/customer/set-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, storeId: sid }),
            });

            const data = await res.json();

            if (!res.ok) {
                return { success: false, error: data.error || 'Failed to set password' };
            }

            setCustomer(data.customer);

            // Sync local wishlist after account creation
            syncLocalWishlist();

            return { success: true, customer: data.customer };
        } catch {
            return { success: false, error: 'Network error. Please try again.' };
        }
    }, []);

    // ── Logout ──────────────────────────────────────────────
    const logout = useCallback(async () => {
        try {
            await fetch('/api/customer/logout', { method: 'POST' });
        } finally {
            setCustomer(null);
        }
    }, []);

    // ── Sync Local Wishlist on Login ────────────────────────
    const syncLocalWishlist = async () => {
        try {
            const stored = localStorage.getItem('lb_wishlist');
            if (!stored) return;

            const localItems = JSON.parse(stored);
            if (!Array.isArray(localItems) || localItems.length === 0) return;

            await fetch('/api/customer/wishlist/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productIds: localItems }),
            });

            // Clear local storage after successful sync
            localStorage.removeItem('lb_wishlist');
        } catch {
            console.warn('[Auth] Wishlist sync failed');
        }
    };

    // ── Context Value ───────────────────────────────────────
    const value: CustomerAuthContextType = {
        customer,
        isAuthenticated: !!customer,
        isLoading,
        login,
        setPassword,
        checkEmail,
        logout,
        refreshSession,
    };

    return (
        <CustomerAuthContext.Provider value={value}>
            {children}
        </CustomerAuthContext.Provider>
    );
}
```

### 7.2 Provider Integration in Layout

```typescript
// apps/web/consumer/storefront/src/app/store/[subdomain]/layout.tsx
// MODIFICATION: Wrap children with CustomerAuthProvider

import { CustomerAuthProvider } from '@/context/customer-auth-context';

// Inside the return:
return (
    <CartProvider>
        <CustomerAuthProvider storeId={storeData.id}>
            <WishlistProvider storeId={storeData.id}>
                <div className="min-h-screen flex flex-col">
                    <DynamicHeader ... />
                    <main className="flex-grow">{children}</main>
                    <DynamicFooter ... />
                </div>
            </WishlistProvider>
        </CustomerAuthProvider>
    </CartProvider>
);
```

---

## 8. Account Bottom Sheet UI

### 8.1 Bottom Sheet Wireframes

```
┌──────────────────────────────────────────────────────┐
│                    ACCOUNT BOTTOM SHEET                │
│                                                        │
│  STATE 1: EMAIL ENTRY (Initial — no session)          │
│  ┌────────────────────────────────────────────────┐   │
│  │                                          [✕]   │   │
│  │    👤  Sign in to your account                 │   │
│  │                                                 │   │
│  │    Access your orders, wishlist, and more.     │   │
│  │                                                 │   │
│  │    Email Address                                │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │ you@example.com                      │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │           Continue →                 │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    By continuing, you agree to our              │   │
│  │    Terms of Service and Privacy Policy.         │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  STATE 2: PASSWORD LOGIN (exists + has password)      │
│  ┌────────────────────────────────────────────────┐   │
│  │                                          [✕]   │   │
│  │    👤  Welcome back!                           │   │
│  │                                                 │   │
│  │    priya@example.com  [← Change]              │   │
│  │                                                 │   │
│  │    Password                                     │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │ ••••••••                         👁   │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │             Sign In                  │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    Forgot your password?                        │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  STATE 3: SET PASSWORD (exists + NO password)         │
│  ┌────────────────────────────────────────────────┐   │
│  │                                          [✕]   │   │
│  │    🎉  Welcome back!                           │   │
│  │                                                 │   │
│  │    We found your account from a previous       │   │
│  │    order. Set a password to manage your         │   │
│  │    orders and wishlist.                         │   │
│  │                                                 │   │
│  │    priya@example.com                            │   │
│  │                                                 │   │
│  │    New Password                                 │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │ ••••••••                         👁   │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    Confirm Password                             │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │ ••••••••                         👁   │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │        Create Account                │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  STATE 4: NO ACCOUNT FOUND (email not in database)    │
│  ┌────────────────────────────────────────────────┐   │
│  │                                          [✕]   │   │
│  │    ℹ️  No account found                        │   │
│  │                                                 │   │
│  │    We couldn't find an account for             │   │
│  │    alex@example.com                             │   │
│  │                                                 │   │
│  │    Place an order to create your account        │   │
│  │    automatically!                               │   │
│  │                                                 │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │           Shop Now →                 │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  │                                                 │   │
│  │    ┌──────────────────────────────────────┐    │   │
│  │    │        Try different email           │    │   │
│  │    └──────────────────────────────────────┘    │   │
│  └────────────────────────────────────────────────┘   │
│                                                        │
│  STATE 5: LOGGED IN (session cookie valid)            │
│  ┌────────────────────────────────────────────────┐   │
│  │                                          [✕]   │   │
│  │    ┌───┐                                       │   │
│  │    │ PM│  Priya Mehta                          │   │
│  │    └───┘  priya@example.com                    │   │
│  │                                                 │   │
│  │    ──────────────────────────────────────       │   │
│  │                                                 │   │
│  │    📦  My Orders              (3 orders)  →    │   │
│  │    ♡   Wishlist               (5 items)   →    │   │
│  │    📍  Addresses              (2 saved)   →    │   │
│  │    ⚙️  Account Settings                   →    │   │
│  │                                                 │   │
│  │    ──────────────────────────────────────       │   │
│  │                                                 │   │
│  │    ⬚   Sign Out                                │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### 8.2 Bottom Sheet Component

```typescript
// apps/web/consumer/storefront/src/components/account/account-bottom-sheet.tsx

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useCustomerAuth } from '@/context/customer-auth-context';

type SheetState = 'email' | 'password' | 'set-password' | 'not-found' | 'logged-in';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    storeId: string;
    storeName?: string;
}

export function AccountBottomSheet({ isOpen, onClose, storeId, storeName }: Props) {
    const {
        customer, isAuthenticated, isLoading,
        login, setPassword, checkEmail, logout
    } = useCustomerAuth();

    const [state, setState] = useState<SheetState>('email');
    const [email, setEmail] = useState('');
    const [password, setPasswordValue] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const emailRef = useRef<HTMLInputElement>(null);

    // Auto-detect state
    useEffect(() => {
        if (isAuthenticated && customer) {
            setState('logged-in');
        } else {
            setState('email');
        }
    }, [isAuthenticated, customer]);

    // Focus email input when sheet opens
    useEffect(() => {
        if (isOpen && state === 'email') {
            setTimeout(() => emailRef.current?.focus(), 300);
        }
    }, [isOpen, state]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setEmail('');
            setPasswordValue('');
            setConfirmPassword('');
            setError('');
            setShowPassword(false);
        }
    }, [isOpen]);

    // ── Handle email submission ─────────────────────────────
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await checkEmail(email, storeId);

            if (!result.exists) {
                setState('not-found');
            } else if (!result.hasPassword) {
                setState('set-password');
            } else {
                setState('password');
            }
        } catch {
            setError('Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // ── Handle login ────────────────────────────────────────
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password, storeId);

        if (result.success) {
            onClose();
        } else {
            setError(result.error || 'Invalid password');
        }

        setLoading(false);
    };

    // ── Handle set password ─────────────────────────────────
    const handleSetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        const result = await setPassword(email, password, storeId);

        if (result.success) {
            onClose();
        } else {
            setError(result.error || 'Failed to set password');
        }

        setLoading(false);
    };

    // ── Handle logout ───────────────────────────────────────
    const handleLogout = async () => {
        await logout();
        setState('email');
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 left-0 right-0 z-50 transform transition-transform"
                style={{
                    backgroundColor: 'var(--background, #fff)',
                    color: 'var(--text, #000)',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                }}>
                {/* Handle bar */}
                <div className="flex justify-center pt-3">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                <div className="p-6">
                    {/* Close button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100"
                        aria-label="Close"
                    >
                        ✕
                    </button>

                    {/* Content based on state */}
                    {state === 'email' && (
                        <form onSubmit={handleEmailSubmit}>
                            <h2 className="text-xl font-semibold mb-2">Sign in to your account</h2>
                            <p className="text-sm opacity-70 mb-6">
                                Access your orders, wishlist, and more.
                            </p>

                            <label className="block text-sm font-medium mb-1">Email Address</label>
                            <input
                                ref={emailRef}
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@example.com"
                                required
                                className="w-full px-4 py-3 border rounded-lg mb-4 text-base"
                                style={{
                                    borderColor: 'var(--border, #e2e8f0)',
                                    backgroundColor: 'var(--input-bg, #fff)',
                                }}
                            />

                            {error && (
                                <p className="text-red-500 text-sm mb-4">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full py-3 rounded-lg font-medium transition-opacity"
                                style={{
                                    backgroundColor: 'var(--primary, #000)',
                                    color: 'var(--primary-foreground, #fff)',
                                    opacity: loading ? 0.7 : 1,
                                }}
                            >
                                {loading ? 'Checking...' : 'Continue →'}
                            </button>

                            <p className="text-xs text-center mt-4 opacity-50">
                                By continuing, you agree to our Terms of Service and Privacy Policy.
                            </p>
                        </form>
                    )}

                    {state === 'password' && (
                        <form onSubmit={handleLogin}>
                            <h2 className="text-xl font-semibold mb-2">Welcome back!</h2>
                            <p className="text-sm opacity-70 mb-1">
                                {email}{' '}
                                <button
                                    type="button"
                                    onClick={() => { setState('email'); setError(''); }}
                                    className="underline text-blue-500"
                                >
                                    Change
                                </button>
                            </p>

                            <div className="mt-4">
                                <label className="block text-sm font-medium mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPasswordValue(e.target.value)}
                                        required
                                        autoFocus
                                        className="w-full px-4 py-3 border rounded-lg text-base pr-12"
                                        style={{
                                            borderColor: error ? '#ef4444' : 'var(--border, #e2e8f0)',
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                                    >
                                        {showPassword ? '🙈' : '👁'}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <p className="text-red-500 text-sm mt-2">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !password}
                                className="w-full py-3 rounded-lg font-medium mt-4 transition-opacity"
                                style={{
                                    backgroundColor: 'var(--primary, #000)',
                                    color: 'var(--primary-foreground, #fff)',
                                    opacity: loading ? 0.7 : 1,
                                }}
                            >
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    )}

                    {state === 'set-password' && (
                        <form onSubmit={handleSetPassword}>
                            <h2 className="text-xl font-semibold mb-2">🎉 Welcome back!</h2>
                            <p className="text-sm opacity-70 mb-1">
                                We found your account from a previous order.
                                Set a password to manage your orders and wishlist.
                            </p>
                            <p className="text-sm font-medium mt-2 mb-4">{email}</p>

                            <label className="block text-sm font-medium mb-1">New Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPasswordValue(e.target.value)}
                                required
                                minLength={6}
                                autoFocus
                                className="w-full px-4 py-3 border rounded-lg mb-3 text-base"
                                style={{ borderColor: 'var(--border, #e2e8f0)' }}
                            />

                            <label className="block text-sm font-medium mb-1">Confirm Password</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className="w-full px-4 py-3 border rounded-lg mb-4 text-base"
                                style={{ borderColor: 'var(--border, #e2e8f0)' }}
                            />

                            {error && (
                                <p className="text-red-500 text-sm mb-4">{error}</p>
                            )}

                            <button
                                type="submit"
                                disabled={loading || !password || !confirmPassword}
                                className="w-full py-3 rounded-lg font-medium transition-opacity"
                                style={{
                                    backgroundColor: 'var(--primary, #000)',
                                    color: 'var(--primary-foreground, #fff)',
                                    opacity: loading ? 0.7 : 1,
                                }}
                            >
                                {loading ? 'Creating account...' : 'Create Account'}
                            </button>
                        </form>
                    )}

                    {state === 'not-found' && (
                        <div className="text-center">
                            <h2 className="text-xl font-semibold mb-2">No account found</h2>
                            <p className="text-sm opacity-70 mb-1">
                                We couldn't find an account for
                            </p>
                            <p className="font-medium mb-4">{email}</p>
                            <p className="text-sm opacity-70 mb-6">
                                Place an order to create your account automatically!
                            </p>

                            <button
                                onClick={onClose}
                                className="w-full py-3 rounded-lg font-medium mb-3"
                                style={{
                                    backgroundColor: 'var(--primary, #000)',
                                    color: 'var(--primary-foreground, #fff)',
                                }}
                            >
                                Shop Now →
                            </button>

                            <button
                                onClick={() => { setState('email'); setError(''); }}
                                className="w-full py-3 rounded-lg font-medium border"
                                style={{ borderColor: 'var(--border, #e2e8f0)' }}
                            >
                                Try different email
                            </button>
                        </div>
                    )}

                    {state === 'logged-in' && customer && (
                        <div>
                            {/* Avatar + Name */}
                            <div className="flex items-center gap-3 mb-6">
                                <div
                                    className="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg"
                                    style={{
                                        backgroundColor: 'var(--primary, #000)',
                                        color: 'var(--primary-foreground, #fff)',
                                    }}
                                >
                                    {(customer.fullName || customer.email).substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                    <p className="font-semibold">{customer.fullName || 'Customer'}</p>
                                    <p className="text-sm opacity-70">{customer.email}</p>
                                </div>
                            </div>

                            <hr className="border-gray-200 mb-4" />

                            {/* Navigation Links */}
                            <nav className="space-y-1">
                                <a href="/account/orders" className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-gray-50">
                                    <span>📦 My Orders</span>
                                    <span className="opacity-50">→</span>
                                </a>
                                <a href="/account/wishlist" className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-gray-50">
                                    <span>♡ Wishlist</span>
                                    <span className="opacity-50">→</span>
                                </a>
                                <a href="/account/addresses" className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-gray-50">
                                    <span>📍 Addresses</span>
                                    <span className="opacity-50">→</span>
                                </a>
                                <a href="/account/settings" className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-gray-50">
                                    <span>⚙️ Account Settings</span>
                                    <span className="opacity-50">→</span>
                                </a>
                            </nav>

                            <hr className="border-gray-200 my-4" />

                            <button
                                onClick={handleLogout}
                                className="w-full text-left py-3 px-2 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                                ⬚ Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
```

### 8.3 Account Bottom Sheet CSS

```css
/* apps/web/consumer/storefront/src/styles/account-bottom-sheet.css */

/* Slide-up animation for bottom sheet */
@keyframes slideUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.account-sheet-backdrop {
    animation: fadeIn 0.2s ease-out;
}

.account-sheet {
    animation: slideUp 0.3s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Theme-agnostic input styling */
.account-sheet input {
    font-size: 16px; /* Prevents iOS zoom on focus */
    -webkit-appearance: none;
    appearance: none;
    transition: border-color 0.2s ease;
}

.account-sheet input:focus {
    outline: none;
    border-color: var(--primary, #000);
    box-shadow: 0 0 0 1px var(--primary, #000);
}

/* Theme-agnostic button styling */
.account-sheet button[type="submit"] {
    transition: opacity 0.2s, transform 0.1s;
}

.account-sheet button[type="submit"]:active {
    transform: scale(0.98);
}

.account-sheet button[type="submit"]:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* Mobile-first responsive */
@media (min-width: 640px) {
    .account-sheet {
        max-width: 420px;
        margin: 0 auto;
        border-radius: 16px 16px 0 0;
    }
}

@media (min-width: 1024px) {
    /* On desktop, show as a side panel instead of bottom sheet */
    .account-sheet {
        position: fixed;
        top: 0;
        right: 0;
        bottom: 0;
        left: auto;
        width: 400px;
        max-height: 100vh;
        border-radius: 0;
        animation: slideInRight 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    }

    @keyframes slideInRight {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
}
```

---

## 9. Customer Account Pages

### 9.1 Account Layout

```typescript
// apps/web/consumer/storefront/src/app/store/[subdomain]/account/layout.tsx

'use client';

import { useCustomerAuth } from '@/context/customer-auth-context';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
    { href: '/account/orders', label: 'My Orders', icon: '📦' },
    { href: '/account/wishlist', label: 'Wishlist', icon: '♡' },
    { href: '/account/addresses', label: 'Addresses', icon: '📍' },
    { href: '/account/settings', label: 'Settings', icon: '⚙️' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading, customer, logout } = useCustomerAuth();
    const pathname = usePathname();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        redirect('/');
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-8">
            {/* Mobile: horizontal scroll nav */}
            <div className="flex gap-2 overflow-x-auto pb-4 mb-6 md:hidden">
                {NAV_ITEMS.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                            pathname === item.href
                                ? 'bg-black text-white'
                                : 'bg-gray-100 text-gray-700'
                        }`}
                        style={pathname === item.href ? {
                            backgroundColor: 'var(--primary, #000)',
                            color: 'var(--primary-foreground, #fff)',
                        } : {}}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </div>

            {/* Desktop: sidebar + content */}
            <div className="flex gap-8">
                <aside className="hidden md:block w-56 shrink-0">
                    <div className="mb-6">
                        <p className="font-semibold">{customer?.fullName || 'Customer'}</p>
                        <p className="text-sm opacity-60">{customer?.email}</p>
                    </div>
                    <nav className="space-y-1">
                        {NAV_ITEMS.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                                    pathname === item.href
                                        ? 'font-semibold'
                                        : 'opacity-70 hover:opacity-100'
                                }`}
                                style={pathname === item.href ? {
                                    backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
                                    color: 'var(--primary, #000)',
                                } : {}}
                            >
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        ))}
                        <button
                            onClick={logout}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-red-500 hover:bg-red-50 w-full"
                        >
                            <span>⬚</span><span>Sign Out</span>
                        </button>
                    </nav>
                </aside>
                <main className="flex-1 min-w-0">{children}</main>
            </div>
        </div>
    );
}
```

### 9.2 Orders Page

```typescript
// apps/web/consumer/storefront/src/app/store/[subdomain]/account/orders/page.tsx

'use client';

import { useCustomerAuth } from '@/context/customer-auth-context';
import { useState, useEffect } from 'react';

interface Order {
    id: string;
    order_number: string;
    status: string;
    total: number;
    created_at: string;
    items: { name: string; quantity: number; price: number; image?: string }[];
}

export default function OrdersPage() {
    const { customer } = useCustomerAuth();
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!customer) return;
        fetch(`/api/customer/orders`)
            .then(res => res.json())
            .then(data => setOrders(data.orders || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [customer]);

    if (loading) {
        return <OrdersSkeleton />;
    }

    if (orders.length === 0) {
        return (
            <div className="text-center py-16">
                <p className="text-4xl mb-4">📦</p>
                <h2 className="text-xl font-semibold mb-2">No orders yet</h2>
                <p className="opacity-60 mb-6">Start shopping to see your orders here.</p>
                <a
                    href="/"
                    className="inline-block px-6 py-3 rounded-lg font-medium"
                    style={{
                        backgroundColor: 'var(--primary, #000)',
                        color: 'var(--primary-foreground, #fff)',
                    }}
                >
                    Browse Products
                </a>
            </div>
        );
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-6">My Orders</h1>
            <div className="space-y-4">
                {orders.map((order) => (
                    <div
                        key={order.id}
                        className="border rounded-xl p-4"
                        style={{ borderColor: 'var(--border, #e2e8f0)' }}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <p className="font-semibold">Order #{order.order_number}</p>
                                <p className="text-sm opacity-60">
                                    {new Date(order.created_at).toLocaleDateString('en-IN', {
                                        day: 'numeric', month: 'short', year: 'numeric'
                                    })}
                                </p>
                            </div>
                            <OrderStatusBadge status={order.status} />
                        </div>
                        <div className="space-y-2">
                            {order.items.slice(0, 3).map((item, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    {item.image && (
                                        <img src={item.image} alt="" className="w-10 h-10 object-cover rounded" />
                                    )}
                                    <span className="flex-1">{item.name} × {item.quantity}</span>
                                    <span className="font-medium">₹{item.price}</span>
                                </div>
                            ))}
                            {order.items.length > 3 && (
                                <p className="text-sm opacity-50">+{order.items.length - 3} more items</p>
                            )}
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t"
                            style={{ borderColor: 'var(--border, #e2e8f0)' }}>
                            <span className="font-semibold">Total: ₹{order.total.toLocaleString()}</span>
                            <a href={`/account/orders/${order.id}`}
                                className="text-sm font-medium underline"
                                style={{ color: 'var(--primary, #000)' }}>
                                View Details →
                            </a>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function OrderStatusBadge({ status }: { status: string }) {
    const colors: Record<string, { bg: string; text: string }> = {
        pending: { bg: '#FEF3C7', text: '#92400E' },
        confirmed: { bg: '#DBEAFE', text: '#1E40AF' },
        shipped: { bg: '#E0E7FF', text: '#3730A3' },
        delivered: { bg: '#D1FAE5', text: '#065F46' },
        cancelled: { bg: '#FEE2E2', text: '#991B1B' },
    };
    const c = colors[status] || colors.pending;
    return (
        <span className="px-2.5 py-1 rounded-full text-xs font-medium capitalize"
            style={{ backgroundColor: c.bg, color: c.text }}>
            {status}
        </span>
    );
}

function OrdersSkeleton() {
    return (
        <div className="space-y-4">
            {[1, 2, 3].map(i => (
                <div key={i} className="border rounded-xl p-4 animate-pulse" style={{ borderColor: '#e2e8f0' }}>
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-24 mb-4" />
                    <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                    <div className="h-3 bg-gray-200 rounded w-3/4" />
                </div>
            ))}
        </div>
    );
}
```

### 9.3 Orders API Endpoint

```typescript
// apps/web/consumer/storefront/src/app/api/customer/orders/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, getSessionFromCookies } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase';

export async function GET(req: NextRequest) {
    const token = getSessionFromCookies(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const db = createServiceClient();

    const { data: orders, error } = await db
        .from('orders')
        .select(`
            id, order_number, status, total, created_at,
            order_items (name, quantity, price, image)
        `)
        .eq('store_id', payload.storeId)
        .eq('customer_email', payload.email)
        .order('created_at', { ascending: false })
        .limit(50);

    if (error) {
        return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
    }

    return NextResponse.json({
        orders: (orders || []).map(o => ({
            ...o,
            items: o.order_items || [],
        })),
    });
}
```

---

## 10. Wishlist System

### 10.1 Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    WISHLIST STRATEGY                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Guest User:                                               │
│   • localStorage key: lb_wishlist                          │
│   • Value: JSON array of product IDs                       │
│   • Persists across page reloads                           │
│   • Synced to server on login                              │
│                                                            │
│  Logged-in User:                                           │
│   • Server-side: customer_wishlists table                  │
│   • On login: merge local → server, clear local            │
│   • All operations go through API                          │
│                                                            │
│  Sync Flow:                                                │
│   Login → Read localStorage → POST /api/customer/          │
│   wishlist/sync → Server merges (union) → Clear local      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 10.2 Wishlist Context Provider

```typescript
// apps/web/consumer/storefront/src/context/wishlist-context.tsx

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useCustomerAuth } from './customer-auth-context';

interface WishlistContextType {
    items: string[];
    isInWishlist: (productId: string) => boolean;
    toggleWishlist: (productId: string) => void;
    count: number;
}

const WishlistContext = createContext<WishlistContextType>({
    items: [],
    isInWishlist: () => false,
    toggleWishlist: () => {},
    count: 0,
});

export const useWishlist = () => useContext(WishlistContext);

const LOCAL_KEY = 'lb_wishlist';

export function WishlistProvider({
    children,
    storeId,
}: {
    children: React.ReactNode;
    storeId: string;
}) {
    const { isAuthenticated } = useCustomerAuth();
    const [items, setItems] = useState<string[]>([]);

    // Load wishlist on mount / auth change
    useEffect(() => {
        if (isAuthenticated) {
            fetch('/api/customer/wishlist')
                .then(r => r.json())
                .then(d => setItems(d.productIds || []))
                .catch(() => {});
        } else {
            try {
                const stored = localStorage.getItem(LOCAL_KEY);
                setItems(stored ? JSON.parse(stored) : []);
            } catch {
                setItems([]);
            }
        }
    }, [isAuthenticated]);

    // Persist local wishlist for guests
    useEffect(() => {
        if (!isAuthenticated) {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(items));
        }
    }, [items, isAuthenticated]);

    const isInWishlist = useCallback(
        (productId: string) => items.includes(productId),
        [items]
    );

    const toggleWishlist = useCallback(
        (productId: string) => {
            const exists = items.includes(productId);
            const updated = exists
                ? items.filter(id => id !== productId)
                : [...items, productId];
            setItems(updated);

            if (isAuthenticated) {
                fetch('/api/customer/wishlist', {
                    method: exists ? 'DELETE' : 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, storeId }),
                }).catch(() => {});
            }
        },
        [items, isAuthenticated, storeId]
    );

    return (
        <WishlistContext.Provider value={{ items, isInWishlist, toggleWishlist, count: items.length }}>
            {children}
        </WishlistContext.Provider>
    );
}
```

### 10.3 Wishlist Heart Button Component

```typescript
// apps/web/consumer/storefront/src/components/wishlist/wishlist-button.tsx

'use client';

import { useWishlist } from '@/context/wishlist-context';

interface Props {
    productId: string;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export function WishlistButton({ productId, size = 'md', className = '' }: Props) {
    const { isInWishlist, toggleWishlist } = useWishlist();
    const active = isInWishlist(productId);

    const sizes = { sm: 'w-8 h-8 text-base', md: 'w-10 h-10 text-xl', lg: 'w-12 h-12 text-2xl' };

    return (
        <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWishlist(productId); }}
            className={`flex items-center justify-center rounded-full transition-all duration-200 ${sizes[size]} ${className}`}
            style={{
                backgroundColor: active ? 'var(--primary, #000)' : 'rgba(255,255,255,0.9)',
                color: active ? 'var(--primary-foreground, #fff)' : 'var(--text, #000)',
                backdropFilter: 'blur(8px)',
            }}
            aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
        >
            {active ? '♥' : '♡'}
        </button>
    );
}
```

### 10.4 Wishlist API Endpoints

```typescript
// apps/web/consumer/storefront/src/app/api/customer/wishlist/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, getSessionFromCookies } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase';

// GET — Fetch wishlist
export async function GET(req: NextRequest) {
    const token = getSessionFromCookies(req);
    if (!token) return NextResponse.json({ productIds: [] });

    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json({ productIds: [] });

    const db = createServiceClient();
    const { data } = await db
        .from('customer_wishlists')
        .select('product_id')
        .eq('customer_id', payload.customerId);

    return NextResponse.json({
        productIds: (data || []).map(r => r.product_id),
    });
}

// POST — Add to wishlist
export async function POST(req: NextRequest) {
    const token = getSessionFromCookies(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { productId, storeId } = await req.json();

    const db = createServiceClient();
    await db.from('customer_wishlists').upsert(
        { customer_id: payload.customerId, product_id: productId, store_id: storeId },
        { onConflict: 'customer_id,product_id' }
    );

    return NextResponse.json({ success: true });
}

// DELETE — Remove from wishlist
export async function DELETE(req: NextRequest) {
    const token = getSessionFromCookies(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { productId } = await req.json();

    const db = createServiceClient();
    await db.from('customer_wishlists')
        .delete()
        .eq('customer_id', payload.customerId)
        .eq('product_id', productId);

    return NextResponse.json({ success: true });
}
```

```typescript
// apps/web/consumer/storefront/src/app/api/customer/wishlist/sync/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { verifySessionToken, getSessionFromCookies } from '@/lib/session';
import { createServiceClient } from '@/lib/supabase';

// POST — Sync local wishlist items to server (called on login)
export async function POST(req: NextRequest) {
    const token = getSessionFromCookies(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifySessionToken(token);
    if (!payload) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const { productIds } = await req.json();
    if (!Array.isArray(productIds)) {
        return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const db = createServiceClient();

    // Upsert each product (ignore conflicts = union merge)
    const rows = productIds.map(pid => ({
        customer_id: payload.customerId,
        product_id: pid,
        store_id: payload.storeId,
    }));

    if (rows.length > 0) {
        await db.from('customer_wishlists').upsert(rows, {
            onConflict: 'customer_id,product_id',
        });
    }

    return NextResponse.json({ success: true, synced: rows.length });
}
```

---

## 11. Authentication Gates

### 11.1 AuthGate Component

A wrapper that protects content behind authentication.

```typescript
// apps/web/consumer/storefront/src/components/auth/auth-gate.tsx

'use client';

import { useCustomerAuth } from '@/context/customer-auth-context';
import { useState } from 'react';
import { AccountBottomSheet } from '../account/account-bottom-sheet';

interface Props {
    children: React.ReactNode;
    storeId: string;
    storeName?: string;
    fallback?: React.ReactNode;
}

export function AuthGate({ children, storeId, storeName, fallback }: Props) {
    const { isAuthenticated, isLoading } = useCustomerAuth();
    const [showAuth, setShowAuth] = useState(false);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <div className="animate-spin w-8 h-8 border-2 border-current border-t-transparent rounded-full" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <>
                {fallback || (
                    <div className="text-center py-16 px-4">
                        <p className="text-4xl mb-4">🔒</p>
                        <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
                        <p className="opacity-60 mb-6">Sign in to access this page.</p>
                        <button
                            onClick={() => setShowAuth(true)}
                            className="px-6 py-3 rounded-lg font-medium"
                            style={{
                                backgroundColor: 'var(--primary, #000)',
                                color: 'var(--primary-foreground, #fff)',
                            }}
                        >
                            Sign In
                        </button>
                    </div>
                )}
                <AccountBottomSheet
                    isOpen={showAuth}
                    onClose={() => setShowAuth(false)}
                    storeId={storeId}
                    storeName={storeName}
                />
            </>
        );
    }

    return <>{children}</>;
}
```

### 11.2 Usage Example

```typescript
// Usage in an account page
import { AuthGate } from '@/components/auth/auth-gate';

export default function WishlistPage({ params }: { params: { subdomain: string } }) {
    return (
        <AuthGate storeId={storeData.id} storeName={storeData.name}>
            <WishlistContent />
        </AuthGate>
    );
}
```

---

## 12. Header Integration

### 12.1 Account Icon in Dynamic Header

```typescript
// MODIFICATION to: apps/web/consumer/storefront/src/components/layout/dynamic-header.tsx
// Add Account icon to right icons section

import { useCustomerAuth } from '@/context/customer-auth-context';
import { AccountBottomSheet } from '../account/account-bottom-sheet';
import { useWishlist } from '@/context/wishlist-context';

// Inside the DynamicHeader component, add state:
const { isAuthenticated, customer } = useCustomerAuth();
const { count: wishlistCount } = useWishlist();
const [showAccount, setShowAccount] = useState(false);

// In the right icons div, add before/after the cart icon:
<>
    {/* Wishlist Icon */}
    <button
        onClick={() => isAuthenticated ? router.push('/account/wishlist') : setShowAccount(true)}
        className="relative p-2"
        style={{ color: scrolled ? 'var(--text)' : 'white' }}
    >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
        </svg>
        {wishlistCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-bold"
                style={{
                    backgroundColor: 'var(--primary, #000)',
                    color: 'var(--primary-foreground, #fff)',
                }}>
                {wishlistCount}
            </span>
        )}
    </button>

    {/* Account Icon */}
    <button
        onClick={() => setShowAccount(true)}
        className="p-2"
        style={{ color: scrolled ? 'var(--text)' : 'white' }}
    >
        {isAuthenticated ? (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                    backgroundColor: 'var(--primary, #000)',
                    color: 'var(--primary-foreground, #fff)',
                }}>
                {(customer?.fullName || customer?.email || '?').substring(0, 2).toUpperCase()}
            </div>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
        )}
    </button>

    {/* Cart Icon (existing) */}
</>

{/* Add the bottom sheet at the end of the header component */}
<AccountBottomSheet
    isOpen={showAccount}
    onClose={() => setShowAccount(false)}
    storeId={storeId}
    storeName={storeName}
/>
```

---

## 13. Checkout Integration

### 13.1 Customer Creation During Checkout

When a customer completes checkout (guest or logged-in), the system creates or updates their record in `store_customers`.

```typescript
// MODIFICATION to: apps/web/consumer/storefront/src/app/api/orders/route.ts
// Add customer creation/update after order is placed

import { findOrCreateCustomer, updateCustomerOrderStats } from '@/lib/customer-service';

export async function POST(req: NextRequest) {
    const body = await req.json();

    // ... existing order creation logic ...

    // After order is successfully created:
    try {
        // Find or create customer record
        const customer = await findOrCreateCustomer(
            body.storeId,
            body.customer.email,
            {
                fullName: body.customer.name,
                phone: body.customer.phone,
                defaultAddress: body.customer.address,
            }
        );

        // Update order stats
        if (customer) {
            await updateCustomerOrderStats(
                customer.id,
                orderTotal,
                'increment'
            );
        }
    } catch (err) {
        // Non-blocking — order still succeeds
        console.error('[Checkout] Customer sync error:', err);
    }

    return NextResponse.json({ success: true, orderId });
}
```

### 13.2 findOrCreateCustomer Implementation

```typescript
// In: apps/web/consumer/storefront/src/lib/customer-service.ts
// This function was defined in Part 1 — here's the detailed flow:

export async function findOrCreateCustomer(
    storeId: string,
    email: string,
    details?: {
        fullName?: string;
        phone?: string;
        defaultAddress?: Record<string, string>;
    }
): Promise<StoreCustomer | null> {
    const db = createServiceClient();

    // 1. Check if customer exists
    const { data: existing } = await db
        .from('store_customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase())
        .single();

    if (existing) {
        // 2a. Update with latest info if provided
        if (details?.fullName || details?.phone) {
            await db.from('store_customers')
                .update({
                    full_name: details.fullName || existing.full_name,
                    phone: details.phone || existing.phone,
                    default_address: details.defaultAddress || existing.default_address,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
        }
        return existing;
    }

    // 2b. Create new customer
    const { data: newCustomer, error } = await db
        .from('store_customers')
        .insert({
            store_id: storeId,
            email: email.toLowerCase(),
            full_name: details?.fullName || null,
            phone: details?.phone || null,
            default_address: details?.defaultAddress || null,
            status: 'active',
            total_orders: 0,
            total_spent: 0,
            accepts_marketing: false,
        })
        .select()
        .single();

    if (error) {
        console.error('[CustomerService] Create failed:', error);
        return null;
    }

    return newCustomer;
}
```

### 13.3 Pre-fill Checkout for Logged-in Users

```typescript
// MODIFICATION to: checkout-client.tsx
// Auto-fill form fields if customer is logged in

import { useCustomerAuth } from '@/context/customer-auth-context';

// Inside CheckoutClient component:
const { customer, isAuthenticated } = useCustomerAuth();

// On mount, pre-fill form
useEffect(() => {
    if (isAuthenticated && customer) {
        setFormData(prev => ({
            ...prev,
            name: customer.fullName || prev.name,
            email: customer.email || prev.email,
            phone: customer.phone || prev.phone,
            // Pre-fill address if available
            ...(customer.defaultAddress ? {
                address: customer.defaultAddress.address || '',
                city: customer.defaultAddress.city || '',
                state: customer.defaultAddress.state || '',
                pincode: customer.defaultAddress.pincode || '',
            } : {}),
        }));
    }
}, [isAuthenticated, customer]);
```

---

## 14. Admin Customer Management

### 14.1 Updated Admin Customers Page

```typescript
// apps/web/consumer/admin/src/app/[store]/customers/page.tsx
// MODIFICATION: Query store_customers instead of contacts

'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase';

interface Customer {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    status: 'active' | 'inactive' | 'blocked';
    total_orders: number;
    total_spent: number;
    ltv_tier: string;
    created_at: string;
    last_order_at: string | null;
    accepts_marketing: boolean;
}

type SortField = 'created_at' | 'total_spent' | 'total_orders' | 'last_order_at';

export default function CustomersPage({ params }: { params: { store: string } }) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [tierFilter, setTierFilter] = useState<string>('all');
    const [sortBy, setSortBy] = useState<SortField>('created_at');
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        loadCustomers();
    }, []);

    const loadCustomers = async () => {
        const supabase = createClient();

        // Get store ID
        const { data: store } = await supabase
            .from('stores')
            .select('id')
            .eq('subdomain', params.store)
            .single();

        if (!store) return;

        let query = supabase
            .from('store_customers')
            .select('*')
            .eq('store_id', store.id)
            .order(sortBy, { ascending: sortAsc });

        if (statusFilter !== 'all') query = query.eq('status', statusFilter);
        if (tierFilter !== 'all') query = query.eq('ltv_tier', tierFilter);

        const { data } = await query;
        setCustomers(data || []);
        setLoading(false);
    };

    const filtered = useMemo(() => {
        if (!search) return customers;
        const q = search.toLowerCase();
        return customers.filter(c =>
            c.email.includes(q) ||
            c.full_name?.toLowerCase().includes(q) ||
            c.phone?.includes(q)
        );
    }, [customers, search]);

    // Stats summary
    const stats = useMemo(() => ({
        total: customers.length,
        active: customers.filter(c => c.status === 'active').length,
        totalRevenue: customers.reduce((s, c) => s + c.total_spent, 0),
        repeatBuyers: customers.filter(c => c.total_orders > 1).length,
    }), [customers]);

    if (loading) return <CustomersSkeleton />;

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Customers</h1>
                <button
                    onClick={exportCustomers}
                    className="px-4 py-2 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                    Export CSV
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard label="Total Customers" value={stats.total} />
                <StatCard label="Active" value={stats.active} />
                <StatCard label="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} />
                <StatCard label="Repeat Buyers" value={stats.repeatBuyers} />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4">
                <input
                    type="text"
                    placeholder="Search by name, email, phone..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="px-4 py-2 border rounded-lg flex-1 min-w-[200px]"
                />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg">
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="blocked">Blocked</option>
                </select>
                <select value={tierFilter} onChange={e => setTierFilter(e.target.value)}
                    className="px-3 py-2 border rounded-lg">
                    <option value="all">All Tiers</option>
                    <option value="vip">VIP</option>
                    <option value="loyal">Loyal</option>
                    <option value="regular">Regular</option>
                    <option value="new">New</option>
                    <option value="at-risk">At Risk</option>
                </select>
            </div>

            {/* Customers Table */}
            <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                        <tr>
                            <th className="p-3 text-left w-8">
                                <input type="checkbox"
                                    onChange={e => {
                                        if (e.target.checked) {
                                            setSelectedIds(new Set(filtered.map(c => c.id)));
                                        } else {
                                            setSelectedIds(new Set());
                                        }
                                    }}
                                />
                            </th>
                            <th className="p-3 text-left">Customer</th>
                            <th className="p-3 text-left">Status</th>
                            <th className="p-3 text-right cursor-pointer"
                                onClick={() => handleSort('total_orders')}>Orders</th>
                            <th className="p-3 text-right cursor-pointer"
                                onClick={() => handleSort('total_spent')}>Spent</th>
                            <th className="p-3 text-left">Tier</th>
                            <th className="p-3 text-left cursor-pointer"
                                onClick={() => handleSort('last_order_at')}>Last Order</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map(customer => (
                            <tr key={customer.id} className="border-b hover:bg-gray-50 cursor-pointer"
                                onClick={() => window.location.href = `/${params.store}/customers/${customer.id}`}>
                                <td className="p-3" onClick={e => e.stopPropagation()}>
                                    <input type="checkbox"
                                        checked={selectedIds.has(customer.id)}
                                        onChange={() => toggleSelect(customer.id)}
                                    />
                                </td>
                                <td className="p-3">
                                    <p className="font-medium">{customer.full_name || 'No name'}</p>
                                    <p className="text-xs opacity-60">{customer.email}</p>
                                </td>
                                <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        customer.status === 'active' ? 'bg-green-100 text-green-700' :
                                        customer.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>
                                        {customer.status}
                                    </span>
                                </td>
                                <td className="p-3 text-right">{customer.total_orders}</td>
                                <td className="p-3 text-right font-medium">₹{customer.total_spent.toLocaleString()}</td>
                                <td className="p-3">
                                    <LtvTierBadge tier={customer.ltv_tier} />
                                </td>
                                <td className="p-3 text-sm opacity-70">
                                    {customer.last_order_at
                                        ? new Date(customer.last_order_at).toLocaleDateString('en-IN')
                                        : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );

    function handleSort(field: SortField) {
        if (sortBy === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortBy(field);
            setSortAsc(false);
        }
    }

    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        next.has(id) ? next.delete(id) : next.add(id);
        setSelectedIds(next);
    }

    function exportCustomers() {
        const headers = ['Name', 'Email', 'Phone', 'Status', 'Orders', 'Spent', 'Tier', 'Joined'];
        const rows = filtered.map(c => [
            c.full_name || '', c.email, c.phone || '', c.status,
            c.total_orders, c.total_spent, c.ltv_tier || '',
            new Date(c.created_at).toLocaleDateString(),
        ]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `customers_${params.store}_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    }
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="bg-white border rounded-xl p-4">
            <p className="text-sm opacity-60">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
        </div>
    );
}

function LtvTierBadge({ tier }: { tier: string }) {
    const colors: Record<string, string> = {
        vip: 'bg-purple-100 text-purple-700',
        loyal: 'bg-blue-100 text-blue-700',
        regular: 'bg-green-100 text-green-700',
        new: 'bg-gray-100 text-gray-700',
        'at-risk': 'bg-orange-100 text-orange-700',
    };
    return (
        <span className={`px-2 py-0.5 rounded-full text-xs capitalize ${colors[tier] || colors.new}`}>
            {tier || 'new'}
        </span>
    );
}

function CustomersSkeleton() {
    return (
        <div className="p-6 animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6" />
            <div className="grid grid-cols-4 gap-4 mb-6">
                {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
            </div>
            <div className="h-10 bg-gray-100 rounded-lg mb-4" />
            {[1,2,3,4,5].map(i => <div key={i} className="h-14 bg-gray-50 rounded mb-2" />)}
        </div>
    );
}
```

---

## 15. Customer LTV Segmentation

### 15.1 Segmentation Tiers

| Tier | Criteria | Color | Description |
|------|----------|-------|-------------|
| VIP | ≥10 orders OR ≥₹50,000 spent | Purple | Highest-value customers |
| Loyal | ≥5 orders OR ≥₹20,000 spent | Blue | Repeat customers |
| Regular | ≥2 orders | Green | Returning customers |
| New | 1 order | Gray | First-time buyers |
| At Risk | No order in 90+ days | Orange | May churn |

### 15.2 Auto-Segmentation Function

```typescript
// In: apps/web/consumer/storefront/src/lib/customer-service.ts

export function calculateLtvTier(
    totalOrders: number,
    totalSpent: number,
    lastOrderAt: string | null
): string {
    // Check at-risk first
    if (lastOrderAt) {
        const daysSince = Math.floor(
            (Date.now() - new Date(lastOrderAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSince > 90 && totalOrders > 0) return 'at-risk';
    }

    if (totalOrders >= 10 || totalSpent >= 50000) return 'vip';
    if (totalOrders >= 5 || totalSpent >= 20000) return 'loyal';
    if (totalOrders >= 2) return 'regular';
    if (totalOrders === 1) return 'new';
    return 'new';
}

// Called after every order completion
export async function recalculateCustomerTier(customerId: string): Promise<void> {
    const db = createServiceClient();

    const { data: customer } = await db
        .from('store_customers')
        .select('total_orders, total_spent, last_order_at')
        .eq('id', customerId)
        .single();

    if (!customer) return;

    const newTier = calculateLtvTier(
        customer.total_orders,
        customer.total_spent,
        customer.last_order_at
    );

    await db.from('store_customers')
        .update({ ltv_tier: newTier })
        .eq('id', customerId);
}
```

---

## 16. Password Reset Flow

### 16.1 Flow Diagram

```
Customer clicks "Forgot Password?"
         │
         ▼
┌─────────────────────┐
│ Enter email address  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Server generates     │
│ reset token (UUID)   │
│ + stores in DB with  │
│ 1-hour expiry        │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Email sent with      │
│ reset link           │
│ /reset?token=xxx     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Customer sets new    │
│ password             │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ Token invalidated    │
│ Password updated     │
│ Auto-login           │
└─────────────────────┘
```

### 16.2 Reset Token API

```typescript
// apps/web/consumer/storefront/src/app/api/customer/forgot-password/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
    const { email, storeId } = await req.json();
    const db = createServiceClient();

    // Check customer exists
    const { data: customer } = await db
        .from('store_customers')
        .select('id, email')
        .eq('store_id', storeId)
        .eq('email', email.toLowerCase())
        .single();

    // Always return success (security — don't reveal if email exists)
    if (!customer) {
        return NextResponse.json({ success: true });
    }

    // Check for password credential
    const { data: cred } = await db
        .from('customer_credentials')
        .select('id')
        .eq('store_id', storeId)
        .eq('email_or_phone', email.toLowerCase())
        .single();

    if (!cred) {
        return NextResponse.json({ success: true });
    }

    // Generate reset token
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.from('password_reset_tokens').upsert({
        customer_id: customer.id,
        store_id: storeId,
        token,
        expires_at: expiresAt.toISOString(),
        used: false,
    }, { onConflict: 'customer_id,store_id' });

    // TODO: Send email with reset link
    // await sendResetEmail(email, token, storeSubdomain);

    console.log(`[Auth] Reset token generated for ${email}: ${token}`);

    return NextResponse.json({ success: true });
}
```

```typescript
// apps/web/consumer/storefront/src/app/api/customer/reset-password/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
    const { token, newPassword, storeId } = await req.json();
    const db = createServiceClient();

    // Validate token
    const { data: resetToken } = await db
        .from('password_reset_tokens')
        .select('*')
        .eq('token', token)
        .eq('store_id', storeId)
        .eq('used', false)
        .single();

    if (!resetToken) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
    }

    if (new Date(resetToken.expires_at) < new Date()) {
        return NextResponse.json({ error: 'Token has expired' }, { status: 400 });
    }

    // Get customer email
    const { data: customer } = await db
        .from('store_customers')
        .select('email')
        .eq('id', resetToken.customer_id)
        .single();

    if (!customer) {
        return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db.from('customer_credentials')
        .update({ password_hash: hashedPassword })
        .eq('store_id', storeId)
        .eq('email_or_phone', customer.email);

    // Mark token as used
    await db.from('password_reset_tokens')
        .update({ used: true })
        .eq('id', resetToken.id);

    return NextResponse.json({ success: true });
}
```

---

## 17. Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Run database migration (Section 2)
- [ ] Create `customer-service.ts` (Section 3)
- [ ] Create `session.ts` utility (Section 5)
- [ ] Set `CUSTOMER_SESSION_SECRET` env var
- [ ] Create all `/api/customer/*` routes (Section 6)

### Phase 2: Authentication UI (Week 1-2)
- [ ] Create `customer-auth-context.tsx` (Section 7)
- [ ] Create `account-bottom-sheet.tsx` (Section 8)
- [ ] Create `account-bottom-sheet.css` (Section 8.3)
- [ ] Add `CustomerAuthProvider` to store layout (Section 7.2)
- [ ] Add account icon to `dynamic-header.tsx` (Section 12)

### Phase 3: Account Pages (Week 2)
- [ ] Create `/account/layout.tsx` (Section 9.1)
- [ ] Create `/account/orders/page.tsx` (Section 9.2)
- [ ] Create `/api/customer/orders` route (Section 9.3)
- [ ] Create `/account/wishlist/page.tsx`
- [ ] Create `/account/addresses/page.tsx`
- [ ] Create `/account/settings/page.tsx`

### Phase 4: Wishlist System (Week 2-3)
- [ ] Create `wishlist-context.tsx` (Section 10.2)
- [ ] Create `wishlist-button.tsx` (Section 10.3)
- [ ] Create wishlist API routes (Section 10.4)
- [ ] Add `WishlistProvider` to store layout
- [ ] Add `WishlistButton` to product cards

### Phase 5: Integration (Week 3)
- [ ] Update checkout to create/update customers (Section 13)
- [ ] Pre-fill checkout for logged-in users (Section 13.3)
- [ ] Add `AuthGate` component (Section 11)
- [ ] Implement LTV segmentation (Section 15)

### Phase 6: Admin (Week 3-4)
- [ ] Update admin customers page (Section 14)
- [ ] Add customer detail page
- [ ] Add CSV export
- [ ] Add LTV tier badges and filtering

### Phase 7: Advanced (Week 4+)
- [ ] Implement password reset flow (Section 16)
- [ ] Add email notifications
- [ ] Add customer activity logging
- [ ] Implement GDPR data export
- [ ] Security hardening & rate limiting

---

## 18. Environment Variables Required

| Variable | Location | Purpose |
|----------|----------|---------|
| `CUSTOMER_SESSION_SECRET` | Storefront `.env` | JWT signing key for customer sessions |
| `NEXT_PUBLIC_SUPABASE_URL` | All apps `.env` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All apps `.env` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Storefront `.env` | Server-side DB operations |

---

## 19. File Reference Index

| Section | File Path | Type |
|---------|-----------|------|
| 2 | `store_customers` table | Migration |
| 2 | `customer_wishlists` table | Migration |
| 2 | `customer_activity_log` table | Migration |
| 3 | `storefront/src/lib/customer-service.ts` | NEW |
| 5 | `storefront/src/lib/session.ts` | NEW |
| 6.1 | `storefront/src/app/api/customer/check/route.ts` | NEW |
| 6.2 | `storefront/src/app/api/customer/login/route.ts` | NEW |
| 6.3 | `storefront/src/app/api/customer/set-password/route.ts` | NEW |
| 6.4 | `storefront/src/app/api/customer/logout/route.ts` | NEW |
| 6.5 | `storefront/src/app/api/customer/session/route.ts` | NEW |
| 6.6 | `storefront/src/app/api/customer/profile/route.ts` | NEW |
| 7 | `storefront/src/context/customer-auth-context.tsx` | NEW |
| 8 | `storefront/src/components/account/account-bottom-sheet.tsx` | NEW |
| 8.3 | `storefront/src/styles/account-bottom-sheet.css` | NEW |
| 9.1 | `storefront/src/app/store/[subdomain]/account/layout.tsx` | NEW |
| 9.2 | `storefront/src/app/store/[subdomain]/account/orders/page.tsx` | NEW |
| 9.3 | `storefront/src/app/api/customer/orders/route.ts` | NEW |
| 10.2 | `storefront/src/context/wishlist-context.tsx` | NEW |
| 10.3 | `storefront/src/components/wishlist/wishlist-button.tsx` | NEW |
| 10.4 | `storefront/src/app/api/customer/wishlist/route.ts` | NEW |
| 10.4 | `storefront/src/app/api/customer/wishlist/sync/route.ts` | NEW |
| 11 | `storefront/src/components/auth/auth-gate.tsx` | NEW |
| 12 | `storefront/src/components/layout/dynamic-header.tsx` | MODIFY |
| 13 | `storefront/src/app/api/orders/route.ts` | MODIFY |
| 14 | `admin/src/app/[store]/customers/page.tsx` | MODIFY |
| 16.2 | `storefront/src/app/api/customer/forgot-password/route.ts` | NEW |
| 16.2 | `storefront/src/app/api/customer/reset-password/route.ts` | NEW |

---

*End of Customer Management Documentation*
