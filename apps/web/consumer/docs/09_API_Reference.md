# LetBuyy Platform — API Reference

> **Doc 09 of 17** | Complete REST API Specification — Routes, Request/Response Schemas, Middleware, Webhooks & Error Handling
>
> **Version:** 6.0 | **Date:** February 14, 2026
>
> **Prev:** [08 Database Schema](./08_Database_Schema.md) | **Next:** [10 Storefront & Themes](./10_Storefront_and_Themes.md)

---

## Table of Contents

1. [API Architecture](#1-api-architecture)
2. [Middleware Pipeline](#2-middleware-pipeline)
3. [Authentication & Session Routes](#3-authentication--session-routes)
4. [Onboarding Routes](#4-onboarding-routes)
5. [Store Routes](#5-store-routes)
6. [Product Routes](#6-product-routes)
7. [Inventory Routes](#7-inventory-routes)
8. [Category & Collection Routes](#8-category--collection-routes)
9. [Customer Routes](#9-customer-routes)
10. [Order Routes](#10-order-routes)
11. [Coupon Routes](#11-coupon-routes)
12. [Shipping Routes](#12-shipping-routes)
13. [Payment & Billing Routes](#13-payment--billing-routes)
14. [Portfolio & Resume Routes](#14-portfolio--resume-routes)
15. [Blog Routes](#15-blog-routes)
16. [AI Routes](#16-ai-routes)
17. [Media Routes](#17-media-routes)
18. [Notification Routes](#18-notification-routes)
19. [Admin Dashboard Routes](#19-admin-dashboard-routes)
20. [Super-Admin Routes](#20-super-admin-routes)
21. [Storefront (Public) Routes](#21-storefront-public-routes)
22. [Webhooks](#22-webhooks)
23. [Error Handling](#23-error-handling)
24. [Rate Limiting](#24-rate-limiting)
25. [API Versioning & Deprecation](#25-api-versioning--deprecation)
26. [Document History](#26-document-history)

---

## 1. API Architecture

### 1.1 Base Configuration

| Parameter | Value |
|---|---|
| **Base URL** | `https://api.letbuyy.store/v1` |
| **Protocol** | HTTPS only (HTTP → 301 redirect) |
| **Runtime** | Cloudflare Workers |
| **Framework** | Hono v4 |
| **Serialization** | JSON (`application/json`) |
| **File Uploads** | `multipart/form-data` (via R2 presigned URLs) |
| **Max Body Size** | 10 MB (configurable per route) |
| **Timeout** | 30 seconds (AI routes: 60s) |

### 1.2 Request Flow

```
Client Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│                  Cloudflare Edge                      │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   WAF &   │→ │  CORS    │→ │  Rate Limiter    │  │
│  │  DDoS     │  │  Headers │  │  (KV + Upstash)  │  │
│  └───────────┘  └──────────┘  └──────────────────┘  │
├─────────────────────────────────────────────────────┤
│                  Hono Worker                          │
│  ┌───────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │   JWT     │→ │  Store   │→ │  Permission      │  │
│  │   Auth    │  │  Context │  │  Guard           │  │
│  └───────────┘  └──────────┘  └──────────────────┘  │
│                       │                               │
│                       ▼                               │
│              ┌──────────────┐                         │
│              │Route Handler │                         │
│              │  + Zod       │                         │
│              │  Validation  │                         │
│              └──────┬───────┘                         │
│                     │                                 │
│         ┌───────────┼───────────┐                     │
│         ▼           ▼           ▼                     │
│    ┌─────────┐ ┌─────────┐ ┌────────┐                │
│    │Supabase │ │ Redis   │ │  R2    │                │
│    │(Postgres)│ │(Upstash)│ │Storage │                │
│    └─────────┘ └─────────┘ └────────┘                │
├─────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌─────────────────────────────┐  │
│  │  Audit Logger │  │  Response Serializer        │  │
│  └───────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
    │
    ▼
  JSON Response
```

### 1.3 Standard Response Envelope

**Success Response:**

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
  _links?: {
    self: string;
    next?: string;
    prev?: string;
  };
}
```

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "title": "Summer T-Shirt",
    "price": 599.00
  },
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 150,
    "total_pages": 8,
    "has_next": true,
    "has_prev": false
  }
}
```

**Error Response:**

```typescript
interface ApiError {
  success: false;
  error: {
    code: string;            // machine-readable error code
    message: string;         // human-readable message
    status: number;          // HTTP status code
    details?: Array<{        // field-level errors (validation)
      field: string;
      message: string;
      code: string;
    }>;
    request_id: string;      // for support debugging
  };
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid product data",
    "status": 400,
    "details": [
      { "field": "title", "message": "Required field", "code": "required" },
      { "field": "price", "message": "Must be positive", "code": "min" }
    ],
    "request_id": "req_abc123def456"
  }
}
```

### 1.4 Common Headers

**Request Headers:**

| Header | Required | Description |
|---|---|---|
| `Authorization` | Conditional | `Bearer <jwt>` — required for authenticated routes |
| `Content-Type` | Yes (POST/PUT) | `application/json` or `multipart/form-data` |
| `X-Store-ID` | Conditional | Store context (auto-resolved from route params) |
| `X-Request-ID` | Optional | Client trace ID (auto-generated if missing) |
| `X-Idempotency-Key` | Optional | For POST/PUT retries (payment, order routes) |
| `Accept-Language` | Optional | `en`, `hi`, `ta` — response localization |

**Response Headers:**

| Header | Description |
|---|---|
| `X-Request-ID` | Request trace identifier |
| `X-RateLimit-Limit` | Max requests in window |
| `X-RateLimit-Remaining` | Remaining requests |
| `X-RateLimit-Reset` | Window reset timestamp (Unix epoch) |
| `X-Response-Time` | Server processing time (ms) |
| `Cache-Control` | Caching directives |

---

## 2. Middleware Pipeline

### 2.1 Middleware Chain

```typescript
// src/index.ts — Hono worker entry point
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { rateLimiter } from './middleware/rate-limiter';
import { authMiddleware } from './middleware/auth';
import { storeContext } from './middleware/store-context';
import { auditLogger } from './middleware/audit';
import { requestId } from './middleware/request-id';

const app = new Hono<{ Bindings: Env }>();

// 1. Request ID (always first)
app.use('*', requestId());

// 2. CORS
app.use('*', cors({
  origin: [
    'https://letbuyy.store',
    'https://*.letbuyy.store',
    'https://accounts.letbuyy.store',
    'https://admin.letbuyy.store',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Store-ID', 'X-Request-ID', 'X-Idempotency-Key'],
  exposeHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400,
  credentials: true,
}));

// 3. Logging
app.use('*', logger());

// 4. Rate limiting (global)
app.use('*', rateLimiter());

// 5. Auth (applied per-route group)
// 6. Store context (applied per-route group)
// 7. Audit logging (applied per-route group)
```

### 2.2 Auth Middleware

```typescript
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';

export const authMiddleware = () => createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authorization token',
        status: 401,
        request_id: c.get('requestId'),
      }
    }, 401);
  }

  const token = authHeader.split(' ')[1];
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return c.json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired token',
        status: 401,
        request_id: c.get('requestId'),
      }
    }, 401);
  }

  c.set('user', user);
  c.set('supabase', supabase);
  await next();
});
```

### 2.3 Store Context Middleware

```typescript
// src/middleware/store-context.ts
export const storeContext = () => createMiddleware(async (c, next) => {
  const storeId = c.req.param('storeId') || c.req.header('X-Store-ID');
  
  if (!storeId) {
    return c.json({
      success: false,
      error: { code: 'STORE_REQUIRED', message: 'Store ID is required', status: 400 }
    }, 400);
  }

  const supabase = c.get('supabase');
  const user = c.get('user');

  const { data: store, error } = await supabase
    .from('stores')
    .select('*, subscriptions(*)')
    .eq('id', storeId)
    .eq('user_id', user.id)
    .single();

  if (error || !store) {
    return c.json({
      success: false,
      error: { code: 'STORE_NOT_FOUND', message: 'Store not found or access denied', status: 404 }
    }, 404);
  }

  // Check trial/subscription status
  if (store.trial_status === 'frozen') {
    return c.json({
      success: false,
      error: { code: 'STORE_FROZEN', message: 'Store is frozen. Please upgrade your plan.', status: 403 }
    }, 403);
  }

  c.set('store', store);
  c.set('plan', store.subscriptions?.plan || 'free');
  await next();
});
```

### 2.4 Permission Guard

```typescript
// src/middleware/permission.ts
type Permission = 'products:read' | 'products:write' | 'orders:read' | 'orders:write' 
  | 'analytics:read' | 'ai:use' | 'settings:write' | 'billing:manage';

const planPermissions: Record<string, Permission[]> = {
  free:       ['products:read', 'products:write', 'orders:read', 'orders:write'],
  starter:    ['products:read', 'products:write', 'orders:read', 'orders:write', 'analytics:read', 'ai:use'],
  business:   ['products:read', 'products:write', 'orders:read', 'orders:write', 'analytics:read', 'ai:use', 'settings:write'],
  enterprise: ['products:read', 'products:write', 'orders:read', 'orders:write', 'analytics:read', 'ai:use', 'settings:write', 'billing:manage'],
};

export const requirePermission = (...perms: Permission[]) => createMiddleware(async (c, next) => {
  const plan = c.get('plan');
  const allowed = planPermissions[plan] || [];
  
  const missing = perms.filter(p => !allowed.includes(p));
  if (missing.length > 0) {
    return c.json({
      success: false,
      error: {
        code: 'PLAN_UPGRADE_REQUIRED',
        message: `Your plan does not include: ${missing.join(', ')}`,
        status: 403,
        upgrade_url: 'https://admin.letbuyy.store/billing',
      }
    }, 403);
  }

  await next();
});
```

---

## 3. Authentication & Session Routes

> See [02 Authentication & Security](./02_Authentication_and_Security.md) for full auth architecture.

### 3.1 Route Summary

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/signup` | Create account (email + password) | ❌ |
| `POST` | `/auth/login` | Email/password login | ❌ |
| `POST` | `/auth/oauth/google` | Google OAuth login | ❌ |
| `POST` | `/auth/otp/send` | Send email OTP | ❌ |
| `POST` | `/auth/otp/verify` | Verify OTP code | ❌ |
| `POST` | `/auth/password/reset` | Request password reset email | ❌ |
| `POST` | `/auth/password/set` | Set new password (from reset) | ✅ |
| `POST` | `/auth/logout` | Revoke current session | ✅ |
| `GET` | `/auth/me` | Get current user profile | ✅ |
| `PUT` | `/auth/me` | Update profile | ✅ |
| `POST` | `/auth/2fa/enable` | Enable TOTP 2FA | ✅ |
| `POST` | `/auth/2fa/verify` | Verify 2FA code | ✅ |
| `POST` | `/auth/2fa/disable` | Disable 2FA | ✅ |
| `POST` | `/auth/refresh` | Refresh access token | ✅ |
| `GET` | `/auth/sessions` | List active sessions | ✅ |
| `DELETE` | `/auth/sessions/:sid` | Revoke specific session | ✅ |

### 3.2 `POST /auth/signup`

**Request:**

```json
{
  "email": "john@example.com",
  "password": "SecureP@ss123",
  "full_name": "John Doe",
  "phone": "+919876543210",
  "referral_source": "google"
}
```

**Validation (Zod):**

```typescript
const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number')
    .regex(/[^A-Za-z0-9]/, 'Must contain special character'),
  full_name: z.string().min(2).max(100).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  referral_source: z.enum(['google', 'social', 'direct', 'referral']).optional(),
});
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-...",
      "email": "john@example.com",
      "full_name": "John Doe",
      "created_at": "2026-02-14T00:00:00Z"
    },
    "session": {
      "access_token": "eyJ...",
      "refresh_token": "abc...",
      "expires_in": 3600,
      "token_type": "Bearer"
    }
  }
}
```

### 3.3 `POST /auth/login`

**Request:**

```json
{
  "email": "john@example.com",
  "password": "SecureP@ss123",
  "totp_code": "123456"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-...",
      "email": "john@example.com",
      "full_name": "John Doe",
      "onboarding_completed": true
    },
    "session": {
      "access_token": "eyJ...",
      "refresh_token": "abc...",
      "expires_in": 3600
    },
    "requires_2fa": false,
    "stores": [
      { "id": "uuid-...", "name": "My Store", "subdomain": "mystore" }
    ]
  }
}
```

### 3.4 `GET /auth/me`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "email": "john@example.com",
    "full_name": "John Doe",
    "avatar_url": "https://r2.letbuyy.store/avatars/...",
    "phone": "+919876543210",
    "onboarding_completed": true,
    "email_notifications": true,
    "created_at": "2026-02-14T00:00:00Z",
    "stores": [
      {
        "id": "uuid-...",
        "name": "My Store",
        "subdomain": "mystore",
        "site_type": "store",
        "status": "published",
        "plan": "starter"
      }
    ]
  }
}
```

---

## 4. Onboarding Routes

> See [03 Onboarding & Trial](./03_Onboarding_and_Trial.md) for the full onboarding flow.

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/onboarding/start` | Start onboarding attempt | ✅ |
| `PUT` | `/onboarding/:attemptId/step/:step` | Submit step data | ✅ |
| `GET` | `/onboarding/status` | Get current onboarding progress | ✅ |
| `POST` | `/onboarding/:attemptId/complete` | Complete onboarding | ✅ |
| `GET` | `/onboarding/templates` | List available templates | ✅ |
| `POST` | `/onboarding/check-subdomain` | Check subdomain availability | ✅ |

### 4.1 `POST /onboarding/start`

**Request:**

```json
{
  "site_type": "store"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "attempt_id": "uuid-...",
    "current_step": 1,
    "total_steps": 6,
    "site_type": "store",
    "steps": [
      { "step": 1, "name": "choose_type", "status": "current" },
      { "step": 2, "name": "name_store", "status": "pending" },
      { "step": 3, "name": "pick_template", "status": "pending" },
      { "step": 4, "name": "survey", "status": "pending" },
      { "step": 5, "name": "customize", "status": "pending" },
      { "step": 6, "name": "launch", "status": "pending" }
    ]
  }
}
```

### 4.2 `PUT /onboarding/:attemptId/step/:step`

**Request (step 2 — name store):**

```json
{
  "store_name": "Tech Gadgets",
  "subdomain": "techgadgets"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "step": 2,
    "status": "completed",
    "next_step": 3,
    "subdomain_available": true,
    "progress_pct": 33
  }
}
```

---

## 5. Store Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/stores` | Create store | ✅ |
| `GET` | `/stores` | List user's stores | ✅ |
| `GET` | `/stores/:storeId` | Get store details | ✅ |
| `PUT` | `/stores/:storeId` | Update store settings | ✅ |
| `DELETE` | `/stores/:storeId` | Delete store | ✅ |
| `POST` | `/stores/:storeId/publish` | Publish storefront | ✅ |
| `POST` | `/stores/:storeId/unpublish` | Unpublish storefront | ✅ |
| `GET` | `/stores/:storeId/analytics` | Dashboard analytics | ✅ |
| `GET` | `/stores/:storeId/analytics/revenue` | Revenue breakdown | ✅ |
| `GET` | `/stores/:storeId/analytics/visitors` | Visitor analytics | ✅ |
| `POST` | `/stores/:storeId/domain` | Add custom domain | ✅ |
| `DELETE` | `/stores/:storeId/domain` | Remove custom domain | ✅ |
| `GET` | `/stores/:storeId/domain/verify` | Check DNS verification | ✅ |

### 5.1 `POST /stores`

**Request:**

```json
{
  "name": "Fashion Hub",
  "subdomain": "fashionhub",
  "site_type": "store",
  "description": "Premium fashion brand",
  "currency": "INR",
  "industry": "fashion",
  "template_id": "uuid-..."
}
```

**Validation (Zod):**

```typescript
const createStoreSchema = z.object({
  name: z.string().min(2).max(50),
  subdomain: z.string().min(3).max(30)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Lowercase alphanumeric with hyphens'),
  site_type: z.enum(['store', 'portfolio', 'resume', 'landing', 'blog']),
  description: z.string().max(500).optional(),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).default('INR'),
  industry: z.string().optional(),
  template_id: z.string().uuid().optional(),
});
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "name": "Fashion Hub",
    "subdomain": "fashionhub",
    "site_type": "store",
    "status": "draft",
    "trial_status": "active",
    "trial_ends_at": "2026-02-28T00:00:00Z",
    "urls": {
      "admin": "https://admin.letbuyy.store/stores/uuid-...",
      "storefront": "https://fashionhub.letbuyy.store"
    }
  }
}
```

### 5.2 `GET /stores/:storeId/analytics`

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `period` | string | `30d` | `7d`, `30d`, `90d`, `12m`, `custom` |
| `from` | ISO date | — | Start date (for `custom`) |
| `to` | ISO date | — | End date (for `custom`) |
| `compare` | boolean | `false` | Include previous period comparison |

**Response (200):**

```json
{
  "success": true,
  "data": {
    "period": "30d",
    "summary": {
      "revenue": { "value": 45600, "change_pct": 12.5, "prev": 40533 },
      "orders": { "value": 128, "change_pct": 8.2, "prev": 118 },
      "visitors": { "value": 3200, "change_pct": -2.1, "prev": 3269 },
      "conversion_rate": { "value": 4.0, "change_pct": 10.5, "prev": 3.6 },
      "avg_order_value": { "value": 356.25, "change_pct": 4.0, "prev": 343.49 }
    },
    "revenue_chart": [
      { "date": "2026-01-15", "revenue": 1200, "orders": 4 },
      { "date": "2026-01-16", "revenue": 950, "orders": 3 }
    ],
    "top_products": [
      { "id": "uuid-...", "title": "Summer T-Shirt", "sold": 42, "revenue": 25000 }
    ]
  }
}
```

---

## 6. Product Routes

> See [05 E-Commerce Engine](./05_Ecommerce_Engine.md) for complete product business logic.

### 6.1 Route Summary

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/products` | List products (paginated, filterable) | ✅ |
| `POST` | `/stores/:storeId/products` | Create product | ✅ |
| `GET` | `/stores/:storeId/products/:productId` | Get product detail | ✅ |
| `PUT` | `/stores/:storeId/products/:productId` | Update product | ✅ |
| `DELETE` | `/stores/:storeId/products/:productId` | Archive product | ✅ |
| `POST` | `/stores/:storeId/products/bulk-import` | Bulk create from CSV | ✅ |
| `PUT` | `/stores/:storeId/products/bulk-update` | Bulk status/price update | ✅ |
| `DELETE` | `/stores/:storeId/products/bulk-delete` | Bulk archive | ✅ |
| `POST` | `/stores/:storeId/products/:productId/duplicate` | Duplicate product | ✅ |
| `GET` | `/stores/:storeId/products/:productId/variants` | List variants | ✅ |
| `POST` | `/stores/:storeId/products/:productId/variants` | Create variant | ✅ |
| `PUT` | `/stores/:storeId/products/:productId/variants/:variantId` | Update variant | ✅ |
| `DELETE` | `/stores/:storeId/products/:productId/variants/:variantId` | Delete variant | ✅ |

### 6.2 `GET /stores/:storeId/products`

**Query Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `per_page` | integer | `20` | Items per page (max: 100) |
| `status` | string | — | `draft`, `active`, `archived`, `out_of_stock` |
| `category` | string | — | Filter by category slug |
| `category_id` | UUID | — | Filter by category ID |
| `search` | string | — | Full-text search on title/description/tags |
| `min_price` | number | — | Minimum price filter |
| `max_price` | number | — | Maximum price filter |
| `in_stock` | boolean | — | Only products with stock > 0 |
| `is_featured` | boolean | — | Only featured products |
| `tags` | string | — | Comma-separated tag filter |
| `sort` | string | `created_at` | `created_at`, `price`, `title`, `stock_quantity`, `total_sold` |
| `order` | string | `desc` | `asc` or `desc` |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "title": "Premium Cotton T-Shirt",
      "slug": "premium-cotton-t-shirt",
      "description": "Soft premium cotton...",
      "category": "apparel",
      "tags": ["cotton", "summer", "casual"],
      "images": ["https://r2.letbuyy.store/products/img1.webp"],
      "thumbnail_url": "https://r2.letbuyy.store/products/img1_thumb.webp",
      "price": 599.00,
      "compare_at_price": 899.00,
      "currency": "INR",
      "stock_quantity": 45,
      "track_inventory": true,
      "status": "active",
      "is_featured": true,
      "variant_count": 6,
      "total_sold": 128,
      "avg_rating": 4.5,
      "review_count": 24,
      "created_at": "2026-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 67,
    "total_pages": 4,
    "has_next": true,
    "has_prev": false
  }
}
```

### 6.3 `POST /stores/:storeId/products`

**Request:**

```json
{
  "title": "Premium Cotton T-Shirt",
  "description": "Soft premium cotton fabric...",
  "description_html": "<p>Soft premium cotton fabric...</p>",
  "category": "apparel",
  "tags": ["cotton", "summer"],
  "images": ["https://r2.letbuyy.store/uploads/temp/img1.webp"],
  "price": 599.00,
  "compare_at_price": 899.00,
  "cost_per_item": 250.00,
  "sku": "TCT-001",
  "track_inventory": true,
  "stock_quantity": 100,
  "low_stock_threshold": 10,
  "weight_grams": 200,
  "product_type": "physical",
  "status": "draft",
  "seo_title": "Premium Cotton T-Shirt | Fashion Hub",
  "seo_description": "Shop premium cotton t-shirts...",
  "options": [
    { "name": "Size", "values": ["S", "M", "L", "XL"] },
    { "name": "Color", "values": ["Black", "White", "Navy"] }
  ]
}
```

**Validation (Zod):**

```typescript
const createProductSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  description_html: z.string().max(10000).optional(),
  category: z.string().max(100).optional(),
  category_id: z.string().uuid().optional(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  images: z.array(z.string().url()).max(10).default([]),
  price: z.number().min(0).max(9999999.99),
  compare_at_price: z.number().min(0).optional(),
  cost_per_item: z.number().min(0).optional(),
  sku: z.string().max(100).optional(),
  barcode: z.string().max(100).optional(),
  track_inventory: z.boolean().default(true),
  stock_quantity: z.number().int().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(10),
  weight_grams: z.number().int().min(0).optional(),
  product_type: z.enum(['physical', 'digital', 'service']).default('physical'),
  status: z.enum(['draft', 'active']).default('draft'),
  seo_title: z.string().max(70).optional(),
  seo_description: z.string().max(160).optional(),
  options: z.array(z.object({
    name: z.string().min(1).max(50),
    values: z.array(z.string().min(1).max(50)).min(1).max(20),
  })).max(3).optional(),
});
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "title": "Premium Cotton T-Shirt",
    "slug": "premium-cotton-t-shirt",
    "status": "draft",
    "variant_count": 12,
    "variants_created": true,
    "created_at": "2026-02-14T12:00:00Z"
  }
}
```

### 6.4 `POST /stores/:storeId/products/bulk-import`

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `file` | File | CSV file (max 5MB) |
| `skip_header` | boolean | Skip first row as header (default: true) |
| `update_existing` | boolean | Update products with matching SKU (default: false) |

**CSV Format:**

```csv
title,description,price,compare_at_price,sku,category,stock_quantity,status
"Summer Dress","Beautiful floral...",1299,1899,"SD-001","fashion",50,"draft"
"Beach Shorts","Comfortable...",799,999,"BS-001","fashion",30,"active"
```

**Response (202 — async processing):**

```json
{
  "success": true,
  "data": {
    "import_id": "uuid-...",
    "status": "processing",
    "total_rows": 150,
    "estimated_time_seconds": 30,
    "status_url": "/stores/:storeId/products/import-status/uuid-..."
  }
}
```

---

## 7. Inventory Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/inventory` | List inventory levels | ✅ |
| `PUT` | `/stores/:storeId/inventory/:productId` | Adjust stock | ✅ |
| `POST` | `/stores/:storeId/inventory/bulk-adjust` | Bulk stock adjustment | ✅ |
| `GET` | `/stores/:storeId/inventory/locations` | List locations | ✅ |
| `POST` | `/stores/:storeId/inventory/locations` | Create location | ✅ |
| `GET` | `/stores/:storeId/inventory/low-stock` | Low stock alerts | ✅ |
| `GET` | `/stores/:storeId/inventory/history` | Adjustment history | ✅ |

### 7.1 `PUT /stores/:storeId/inventory/:productId`

**Request:**

```json
{
  "variant_id": "uuid-...",
  "location_id": "uuid-...",
  "adjustment": 50,
  "reason": "restock",
  "notes": "Restocked from supplier"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "product_id": "uuid-...",
    "variant_id": "uuid-...",
    "previous_quantity": 5,
    "new_quantity": 55,
    "adjustment": 50,
    "reason": "restock"
  }
}
```

### 7.2 `GET /stores/:storeId/inventory/low-stock`

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "product_id": "uuid-...",
      "title": "Premium T-Shirt",
      "sku": "TCT-001",
      "variant_title": "M / Black",
      "current_stock": 3,
      "threshold": 10,
      "last_sold_at": "2026-02-13T18:30:00Z",
      "reorder_suggested": 50
    }
  ],
  "meta": { "total_low_stock": 8 }
}
```

---

## 8. Category & Collection Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/categories` | List categories (tree) | ✅ |
| `POST` | `/stores/:storeId/categories` | Create category | ✅ |
| `PUT` | `/stores/:storeId/categories/:catId` | Update category | ✅ |
| `DELETE` | `/stores/:storeId/categories/:catId` | Delete category | ✅ |
| `PUT` | `/stores/:storeId/categories/reorder` | Reorder categories | ✅ |
| `GET` | `/stores/:storeId/collections` | List smart collections | ✅ |
| `POST` | `/stores/:storeId/collections` | Create smart collection | ✅ |
| `PUT` | `/stores/:storeId/collections/:colId` | Update collection | ✅ |
| `DELETE` | `/stores/:storeId/collections/:colId` | Delete collection | ✅ |
| `GET` | `/stores/:storeId/collections/:colId/products` | Preview matched products | ✅ |

### 8.1 `POST /stores/:storeId/collections`

**Request:**

```json
{
  "title": "Summer Sale",
  "slug": "summer-sale",
  "description": "All summer fashion at great prices",
  "image_url": "https://r2.letbuyy.store/collections/summer.webp",
  "rules": [
    { "field": "tags", "operator": "contains", "value": "summer" },
    { "field": "price", "operator": "less_than", "value": 1000 },
    { "field": "status", "operator": "equals", "value": "active" }
  ],
  "match_type": "all"
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "title": "Summer Sale",
    "slug": "summer-sale",
    "matched_products": 23,
    "created_at": "2026-02-14T12:00:00Z"
  }
}
```

---

## 9. Customer Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/customers` | List customers (paginated) | ✅ |
| `POST` | `/stores/:storeId/customers` | Create customer | ✅ |
| `GET` | `/stores/:storeId/customers/:custId` | Get customer detail | ✅ |
| `PUT` | `/stores/:storeId/customers/:custId` | Update customer | ✅ |
| `DELETE` | `/stores/:storeId/customers/:custId` | Delete customer | ✅ |
| `GET` | `/stores/:storeId/customers/:custId/orders` | Customer's order history | ✅ |
| `GET` | `/stores/:storeId/customers/:custId/addresses` | List addresses | ✅ |
| `POST` | `/stores/:storeId/customers/:custId/addresses` | Add address | ✅ |
| `PUT` | `/stores/:storeId/customers/:custId/tags` | Update customer tags | ✅ |
| `GET` | `/stores/:storeId/customers/export` | Export as CSV | ✅ |

### 9.1 `GET /stores/:storeId/customers`

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number |
| `per_page` | integer | Items per page (max: 100) |
| `search` | string | Search by name, email, phone |
| `status` | string | `active`, `blocked` |
| `tags` | string | Comma-separated: `vip,wholesale` |
| `sort` | string | `created_at`, `total_spent`, `total_orders`, `last_order_at` |
| `order` | string | `asc` or `desc` |
| `min_spent` | number | Minimum total spent |
| `max_spent` | number | Maximum total spent |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "email": "customer@example.com",
      "full_name": "Priya Sharma",
      "phone": "+919876543210",
      "tags": ["vip", "returning"],
      "total_orders": 12,
      "total_spent": 24500.00,
      "avg_order_value": 2041.67,
      "last_order_at": "2026-02-10T14:30:00Z",
      "created_at": "2025-06-15T09:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 342 }
}
```

---

## 10. Order Routes

### 10.1 Route Summary

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/orders` | List orders (paginated, filterable) | ✅ |
| `POST` | `/stores/:storeId/orders` | Create manual/draft order | ✅ |
| `GET` | `/stores/:storeId/orders/:orderId` | Get order detail | ✅ |
| `PUT` | `/stores/:storeId/orders/:orderId` | Update order | ✅ |
| `POST` | `/stores/:storeId/orders/:orderId/confirm` | Confirm order | ✅ |
| `POST` | `/stores/:storeId/orders/:orderId/ship` | Mark as shipped | ✅ |
| `POST` | `/stores/:storeId/orders/:orderId/deliver` | Mark as delivered | ✅ |
| `POST` | `/stores/:storeId/orders/:orderId/cancel` | Cancel order | ✅ |
| `POST` | `/stores/:storeId/orders/:orderId/refund` | Process refund | ✅ |
| `GET` | `/stores/:storeId/orders/:orderId/timeline` | Order status history | ✅ |
| `POST` | `/stores/:storeId/orders/:orderId/notes` | Add internal note | ✅ |
| `GET` | `/stores/:storeId/orders/stats` | Order statistics | ✅ |
| `GET` | `/stores/:storeId/orders/export` | Export orders as CSV | ✅ |
| `GET` | `/stores/:storeId/returns` | List return requests | ✅ |
| `POST` | `/stores/:storeId/returns/:returnId/approve` | Approve return | ✅ |
| `POST` | `/stores/:storeId/returns/:returnId/reject` | Reject return | ✅ |

### 10.2 `GET /stores/:storeId/orders`

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number |
| `per_page` | integer | Items per page (max: 100) |
| `status` | string | `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled` |
| `payment_status` | string | `pending`, `paid`, `refunded`, `failed` |
| `fulfillment` | string | `unfulfilled`, `partially_fulfilled`, `fulfilled` |
| `search` | string | Search by order number, customer email, name |
| `from` | ISO date | Orders from this date |
| `to` | ISO date | Orders until this date |
| `sort` | string | `created_at`, `total`, `order_number` |
| `order` | string | `asc` or `desc` |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "order_number": "FAS-00042",
      "customer_name": "Priya Sharma",
      "customer_email": "priya@example.com",
      "status": "shipped",
      "payment_status": "paid",
      "fulfillment_status": "fulfilled",
      "subtotal": 1798.00,
      "shipping_cost": 40.00,
      "discount_amount": 180.00,
      "tax_amount": 0,
      "total": 1658.00,
      "currency": "INR",
      "item_count": 3,
      "tracking_number": "AWB123456789",
      "shipped_at": "2026-02-13T10:00:00Z",
      "created_at": "2026-02-12T14:30:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 128 }
}
```

### 10.3 `POST /stores/:storeId/orders/:orderId/ship`

**Request:**

```json
{
  "shipping_provider": "delhivery",
  "tracking_number": "AWB123456789",
  "tracking_url": "https://www.delhivery.com/track/package/AWB123456789",
  "notify_customer": true,
  "expected_delivery_at": "2026-02-17T00:00:00Z"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "order_number": "FAS-00042",
    "status": "shipped",
    "fulfillment_status": "fulfilled",
    "shipped_at": "2026-02-14T12:00:00Z",
    "tracking": {
      "provider": "delhivery",
      "number": "AWB123456789",
      "url": "https://www.delhivery.com/track/package/AWB123456789"
    },
    "customer_notified": true
  }
}
```

### 10.4 `POST /stores/:storeId/orders/:orderId/refund`

**Request:**

```json
{
  "amount": 599.00,
  "reason": "Customer complaint — defective item",
  "refund_method": "original_payment",
  "line_items": [
    { "order_item_id": "uuid-...", "quantity": 1 }
  ],
  "restock": true,
  "notify_customer": true
}
```

**Validation (Zod):**

```typescript
const refundSchema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1).max(500),
  refund_method: z.enum(['original_payment', 'store_credit']),
  line_items: z.array(z.object({
    order_item_id: z.string().uuid(),
    quantity: z.number().int().positive(),
  })).optional(),
  restock: z.boolean().default(false),
  notify_customer: z.boolean().default(true),
});
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "order_id": "uuid-...",
    "refund_id": "rfnd_uuid-...",
    "amount": 599.00,
    "status": "refunded",
    "payment_status": "partially_refunded",
    "items_restocked": true,
    "customer_notified": true
  }
}
```

---

## 11. Coupon Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/coupons` | List coupons | ✅ |
| `POST` | `/stores/:storeId/coupons` | Create coupon | ✅ |
| `GET` | `/stores/:storeId/coupons/:couponId` | Get coupon detail | ✅ |
| `PUT` | `/stores/:storeId/coupons/:couponId` | Update coupon | ✅ |
| `DELETE` | `/stores/:storeId/coupons/:couponId` | Delete coupon | ✅ |
| `POST` | `/stores/:storeId/coupons/validate` | Validate coupon code | ✅ |
| `GET` | `/stores/:storeId/coupons/:couponId/usage` | Usage analytics | ✅ |

### 11.1 `POST /stores/:storeId/coupons`

**Request:**

```json
{
  "code": "SUMMER20",
  "type": "percentage",
  "value": 20,
  "min_order_value": 500,
  "max_discount": 200,
  "usage_limit": 100,
  "per_customer_limit": 1,
  "applies_to": "all",
  "starts_at": "2026-06-01T00:00:00Z",
  "expires_at": "2026-08-31T23:59:59Z",
  "description": "Summer sale — 20% off everything",
  "first_order_only": false,
  "is_automatic": false
}
```

**Validation (Zod):**

```typescript
const createCouponSchema = z.object({
  code: z.string().min(3).max(20).regex(/^[A-Z0-9]+$/, 'Uppercase alphanumeric only'),
  type: z.enum(['percentage', 'fixed_amount', 'free_shipping', 'buy_x_get_y']),
  value: z.number().positive(),
  min_order_value: z.number().min(0).optional(),
  max_discount: z.number().positive().optional(),
  usage_limit: z.number().int().positive().optional(),
  per_customer_limit: z.number().int().positive().default(1),
  applies_to: z.enum(['all', 'specific_products', 'specific_categories', 'specific_customers']).default('all'),
  applicable_ids: z.array(z.string().uuid()).optional(),
  starts_at: z.string().datetime().optional(),
  expires_at: z.string().datetime().optional(),
  description: z.string().max(200).optional(),
  first_order_only: z.boolean().default(false),
  is_automatic: z.boolean().default(false),
  bogo_config: z.object({
    buy_quantity: z.number().int().positive(),
    get_quantity: z.number().int().positive(),
    get_discount_pct: z.number().min(0).max(100),
  }).optional(),
});
```

### 11.2 `POST /stores/:storeId/coupons/validate`

**Request:**

```json
{
  "code": "SUMMER20",
  "cart_total": 1200,
  "customer_email": "priya@example.com",
  "product_ids": ["uuid-1", "uuid-2"]
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "SUMMER20",
    "type": "percentage",
    "discount_amount": 200,
    "message": "20% off applied (max ₹200)",
    "new_total": 1000,
    "expires_at": "2026-08-31T23:59:59Z"
  }
}
```

**Response (200 — invalid):**

```json
{
  "success": true,
  "data": {
    "valid": false,
    "code": "SUMMER20",
    "reason": "min_order_not_met",
    "message": "Minimum order ₹500 required. Your cart is ₹350."
  }
}
```

---

## 12. Shipping Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/shipping/zones` | List shipping zones | ✅ |
| `POST` | `/stores/:storeId/shipping/zones` | Create zone | ✅ |
| `PUT` | `/stores/:storeId/shipping/zones/:zoneId` | Update zone | ✅ |
| `DELETE` | `/stores/:storeId/shipping/zones/:zoneId` | Delete zone | ✅ |
| `GET` | `/stores/:storeId/shipping/zones/:zoneId/rates` | List rates | ✅ |
| `POST` | `/stores/:storeId/shipping/zones/:zoneId/rates` | Create rate | ✅ |
| `PUT` | `/stores/:storeId/shipping/rates/:rateId` | Update rate | ✅ |
| `DELETE` | `/stores/:storeId/shipping/rates/:rateId` | Delete rate | ✅ |
| `POST` | `/stores/:storeId/shipping/calculate` | Calculate shipping cost | ✅ |

### 12.1 `POST /stores/:storeId/shipping/calculate`

**Request:**

```json
{
  "destination": {
    "country": "IN",
    "state": "KA",
    "zip_code": "560001"
  },
  "items": [
    { "product_id": "uuid-...", "variant_id": "uuid-...", "quantity": 2, "weight_grams": 200 }
  ],
  "cart_total": 1200
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "rates": [
      {
        "id": "uuid-...",
        "name": "Standard Delivery",
        "price": 40,
        "free_shipping": false,
        "estimated_days": { "min": 5, "max": 7 }
      },
      {
        "id": "uuid-...",
        "name": "Express Delivery",
        "price": 99,
        "free_shipping": false,
        "estimated_days": { "min": 2, "max": 3 }
      },
      {
        "id": "uuid-...",
        "name": "Free Delivery",
        "price": 0,
        "free_shipping": true,
        "estimated_days": { "min": 7, "max": 10 },
        "message": "Free delivery on orders above ₹500"
      }
    ]
  }
}
```

---

## 13. Payment & Billing Routes

### 13.1 Payment Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/payments/razorpay/order` | Create Razorpay payment order | ✅ |
| `POST` | `/payments/razorpay/verify` | Verify Razorpay payment signature | ✅ |
| `POST` | `/payments/stripe/checkout` | Create Stripe checkout session | ✅ |
| `POST` | `/payments/stripe/portal` | Create Stripe billing portal | ✅ |
| `GET` | `/stores/:storeId/payments` | List payment transactions | ✅ |
| `GET` | `/stores/:storeId/payments/:txnId` | Get transaction detail | ✅ |

### 13.2 `POST /payments/razorpay/order`

**Request:**

```json
{
  "store_id": "uuid-...",
  "order_id": "uuid-...",
  "amount": 165800,
  "currency": "INR",
  "notes": {
    "order_number": "FAS-00042"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "razorpay_order_id": "order_Lz123abc456",
    "amount": 165800,
    "currency": "INR",
    "key_id": "rzp_live_...",
    "prefill": {
      "name": "Priya Sharma",
      "email": "priya@example.com",
      "contact": "+919876543210"
    }
  }
}
```

### 13.3 Billing Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/billing` | Get billing overview | ✅ |
| `GET` | `/stores/:storeId/billing/invoices` | List invoices | ✅ |
| `GET` | `/stores/:storeId/billing/invoices/:invId/pdf` | Download invoice PDF | ✅ |
| `POST` | `/stores/:storeId/billing/subscribe` | Subscribe to plan | ✅ |
| `PUT` | `/stores/:storeId/billing/plan` | Change plan (upgrade/downgrade) | ✅ |
| `POST` | `/stores/:storeId/billing/cancel` | Cancel subscription | ✅ |
| `POST` | `/stores/:storeId/billing/reactivate` | Reactivate cancelled subscription | ✅ |

### 13.4 `POST /stores/:storeId/billing/subscribe`

**Request:**

```json
{
  "plan": "starter",
  "billing_cycle": "monthly",
  "payment_provider": "razorpay",
  "coupon_code": "LAUNCH50"
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "subscription_id": "uuid-...",
    "plan": "starter",
    "billing_cycle": "monthly",
    "amount": 799,
    "currency": "INR",
    "status": "active",
    "current_period_end": "2026-03-14T00:00:00Z",
    "payment_url": "https://rzp.io/i/checkout_abc123",
    "features": {
      "max_products": 500,
      "ai_credits": 100,
      "custom_domain": true,
      "analytics": true
    }
  }
}
```

---

## 14. Portfolio & Resume Routes

> See [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) for complete business logic.

### 14.1 Route Summary

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/projects` | List projects | ✅ |
| `POST` | `/stores/:storeId/projects` | Create project | ✅ |
| `GET` | `/stores/:storeId/projects/:projId` | Get project detail | ✅ |
| `PUT` | `/stores/:storeId/projects/:projId` | Update project | ✅ |
| `DELETE` | `/stores/:storeId/projects/:projId` | Delete project | ✅ |
| `PUT` | `/stores/:storeId/projects/reorder` | Reorder projects | ✅ |
| `GET` | `/stores/:storeId/skills` | List skills | ✅ |
| `POST` | `/stores/:storeId/skills` | Add skill | ✅ |
| `PUT` | `/stores/:storeId/skills/:skillId` | Update skill | ✅ |
| `DELETE` | `/stores/:storeId/skills/:skillId` | Delete skill | ✅ |
| `GET` | `/stores/:storeId/education` | List education | ✅ |
| `POST` | `/stores/:storeId/education` | Add education | ✅ |
| `PUT` | `/stores/:storeId/education/:eduId` | Update education | ✅ |
| `DELETE` | `/stores/:storeId/education/:eduId` | Delete education | ✅ |
| `GET` | `/stores/:storeId/experience` | List experience | ✅ |
| `POST` | `/stores/:storeId/experience` | Add experience | ✅ |
| `PUT` | `/stores/:storeId/experience/:expId` | Update experience | ✅ |
| `DELETE` | `/stores/:storeId/experience/:expId` | Delete experience | ✅ |
| `GET` | `/stores/:storeId/testimonials` | List testimonials | ✅ |
| `POST` | `/stores/:storeId/testimonials` | Add testimonial | ✅ |
| `POST` | `/stores/:storeId/testimonials/request` | Send testimonial request email | ✅ |
| `PUT` | `/stores/:storeId/testimonials/:testId` | Update testimonial | ✅ |
| `DELETE` | `/stores/:storeId/testimonials/:testId` | Delete testimonial | ✅ |

### 14.2 Resume Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/resume-versions` | List resume versions | ✅ |
| `POST` | `/stores/:storeId/resume-versions` | Create new version | ✅ |
| `PUT` | `/stores/:storeId/resume-versions/:verId` | Update version | ✅ |
| `DELETE` | `/stores/:storeId/resume-versions/:verId` | Delete version | ✅ |
| `POST` | `/stores/:storeId/resume/generate-pdf` | Generate PDF resume | ✅ |
| `GET` | `/stores/:storeId/resume/download/:verId` | Download PDF | ✅ |
| `POST` | `/stores/:storeId/resume/ats-check` | AI ATS score check | ✅ |

### 14.3 `POST /stores/:storeId/resume/ats-check`

**Request:**

```json
{
  "version_id": "uuid-...",
  "target_role": "Full Stack Developer",
  "target_industry": "technology",
  "job_description": "We are looking for..."
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "ats_score": 78,
    "grade": "B+",
    "analysis": {
      "strengths": [
        "Strong technical skills section",
        "Quantified achievements in bullet points"
      ],
      "improvements": [
        "Add more keywords from job description",
        "Include a professional summary"
      ],
      "keyword_match": {
        "found": ["React", "Node.js", "TypeScript", "AWS"],
        "missing": ["Kubernetes", "CI/CD", "Agile"]
      }
    },
    "credits_used": 2
  }
}
```

---

## 15. Blog Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/blog/posts` | List blog posts | ✅ |
| `POST` | `/stores/:storeId/blog/posts` | Create post | ✅ |
| `GET` | `/stores/:storeId/blog/posts/:postId` | Get post detail | ✅ |
| `PUT` | `/stores/:storeId/blog/posts/:postId` | Update post | ✅ |
| `DELETE` | `/stores/:storeId/blog/posts/:postId` | Delete post | ✅ |
| `POST` | `/stores/:storeId/blog/posts/:postId/publish` | Publish post | ✅ |
| `POST` | `/stores/:storeId/blog/posts/:postId/unpublish` | Revert to draft | ✅ |
| `POST` | `/stores/:storeId/blog/posts/:postId/schedule` | Schedule publish | ✅ |
| `GET` | `/stores/:storeId/blog/categories` | List categories | ✅ |
| `POST` | `/stores/:storeId/blog/categories` | Create category | ✅ |
| `PUT` | `/stores/:storeId/blog/categories/:catId` | Update category | ✅ |
| `DELETE` | `/stores/:storeId/blog/categories/:catId` | Delete category | ✅ |
| `GET` | `/stores/:storeId/blog/posts/:postId/comments` | List comments | ✅ |
| `PUT` | `/stores/:storeId/blog/comments/:commentId/approve` | Approve comment | ✅ |
| `DELETE` | `/stores/:storeId/blog/comments/:commentId` | Delete comment | ✅ |

### 15.1 `POST /stores/:storeId/blog/posts`

**Request:**

```json
{
  "title": "10 Fashion Trends for Summer 2026",
  "slug": "fashion-trends-summer-2026",
  "excerpt": "Discover the hottest fashion trends...",
  "content": "# Introduction\n\nSummer 2026 brings...",
  "cover_image_url": "https://r2.letbuyy.store/blog/cover.webp",
  "category_id": "uuid-...",
  "tags": ["fashion", "summer", "trends"],
  "status": "draft",
  "seo_title": "10 Fashion Trends for Summer 2026 | Fashion Hub Blog",
  "seo_description": "Explore the top 10 fashion trends...",
  "allow_comments": true
}
```

**Response (201):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "title": "10 Fashion Trends for Summer 2026",
    "slug": "fashion-trends-summer-2026",
    "status": "draft",
    "reading_time_min": 5,
    "created_at": "2026-02-14T12:00:00Z"
  }
}
```

---

## 16. AI Routes

> See [07 AI Features](./07_AI_Features.md) for complete AI architecture, gateway, and model specifications.

### 16.1 Content Generation

| Method | Route | Description | Auth | Credits |
|---|---|---|---|---|
| `POST` | `/ai/generate/product-description` | Generate product description | ✅ | 1 |
| `POST` | `/ai/generate/product-description-long` | Long marketing copy | ✅ | 2 |
| `POST` | `/ai/generate/seo-metadata` | Generate SEO title & description | ✅ | 1 |
| `POST` | `/ai/generate/product-tags` | Auto-generate product tags | ✅ | 0.5 |
| `POST` | `/ai/generate/collection-description` | Collection description | ✅ | 1 |
| `POST` | `/ai/generate/email-template` | Marketing email copy | ✅ | 2 |
| `POST` | `/ai/generate/blog-post` | Full blog post draft | ✅ | 5 |
| `POST` | `/ai/generate/blog-outline` | Blog post outline | ✅ | 1 |
| `POST` | `/ai/generate/headline-variants` | A/B headline variants | ✅ | 1 |
| `POST` | `/ai/generate/resume-bullet` | Improve resume bullet | ✅ | 1 |
| `POST` | `/ai/generate/project-description` | Portfolio project description | ✅ | 1 |
| `POST` | `/ai/generate/landing-copy` | Landing page copy | ✅ | 2 |
| `POST` | `/ai/generate/store-bio` | Store/brand bio | ✅ | 1 |

### 16.2 AI Analysis

| Method | Route | Description | Auth | Credits |
|---|---|---|---|---|
| `POST` | `/ai/analyze/ats-score` | Resume ATS scoring | ✅ | 2 |
| `POST` | `/ai/analyze/pricing` | Competitive pricing analysis | ✅ | 2 |
| `POST` | `/ai/analyze/portfolio` | Portfolio review & feedback | ✅ | 3 |
| `POST` | `/ai/analyze/content-quality` | Content quality scoring | ✅ | 1 |
| `POST` | `/ai/analyze/customer-sentiment` | Review sentiment analysis | ✅ | 2 |

### 16.3 `POST /ai/generate/product-description`

**Request:**

```json
{
  "store_id": "uuid-...",
  "product_title": "Premium Cotton T-Shirt",
  "category": "fashion",
  "tags": ["cotton", "casual", "summer"],
  "price": 599,
  "tone": "professional",
  "length": "short",
  "language": "en",
  "stream": false
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "content": "Crafted from premium 100% combed cotton, this t-shirt offers exceptional softness and breathability...",
    "model": "gemini-3-flash",
    "credits_used": 1,
    "tokens": { "input": 120, "output": 85 },
    "cached": false,
    "latency_ms": 1200
  }
}
```

### 16.4 `POST /ai/generate/product-description` (Streaming)

When `stream: true`, the response is Server-Sent Events:

```
Content-Type: text/event-stream

data: {"type":"start","model":"gemini-3-flash"}

data: {"type":"chunk","content":"Crafted from "}

data: {"type":"chunk","content":"premium 100% combed cotton, "}

data: {"type":"chunk","content":"this t-shirt offers "}

data: {"type":"done","credits_used":1,"tokens":{"input":120,"output":85}}
```

### 16.5 Credit Management

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/ai/credits` | Get credit balance | ✅ |
| `POST` | `/ai/credits/purchase` | Buy credit pack | ✅ |
| `GET` | `/ai/credits/transactions` | Credit transaction history | ✅ |
| `GET` | `/ai/usage` | Usage analytics | ✅ |
| `GET` | `/ai/usage/breakdown` | Usage by feature/model | ✅ |

### 16.6 `GET /ai/credits`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "plan": "starter",
    "monthly_allocation": 100,
    "current_balance": 72.5,
    "purchased_balance": 0,
    "total_available": 72.5,
    "next_reset_at": "2026-03-14T00:00:00Z",
    "usage_this_month": {
      "total_credits": 27.5,
      "total_api_calls": 45,
      "by_feature": {
        "product_description": 12,
        "seo_metadata": 8,
        "blog_post": 3,
        "ats_score": 2
      }
    },
    "packs": [
      { "id": "micro", "credits": 50, "price": 99, "currency": "INR" },
      { "id": "small", "credits": 200, "price": 299, "currency": "INR" },
      { "id": "medium", "credits": 500, "price": 599, "currency": "INR" },
      { "id": "large", "credits": 1200, "price": 999, "currency": "INR" },
      { "id": "jumbo", "credits": 3000, "price": 1999, "currency": "INR" }
    ]
  }
}
```

---

## 17. Media Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `POST` | `/stores/:storeId/media/upload` | Upload file to R2 | ✅ |
| `POST` | `/stores/:storeId/media/upload-url` | Get presigned upload URL | ✅ |
| `GET` | `/stores/:storeId/media` | List media files | ✅ |
| `DELETE` | `/stores/:storeId/media/:mediaId` | Delete media file | ✅ |
| `POST` | `/stores/:storeId/media/bulk-delete` | Bulk delete media | ✅ |

### 17.1 `POST /stores/:storeId/media/upload-url`

**Request:**

```json
{
  "filename": "product-hero.webp",
  "content_type": "image/webp",
  "size_bytes": 245000,
  "folder": "products"
}
```

**Validation (Zod):**

```typescript
const uploadUrlSchema = z.object({
  filename: z.string().min(1).max(255),
  content_type: z.string().regex(/^(image\/(jpeg|png|webp|gif|svg\+xml)|video\/mp4|application\/pdf)$/),
  size_bytes: z.number().int().positive().max(10 * 1024 * 1024), // 10MB max
  folder: z.enum(['products', 'avatars', 'blog', 'portfolio', 'brand', 'other']).default('other'),
});
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "upload_url": "https://r2.letbuyy.store/upload/presigned?...",
    "public_url": "https://r2.letbuyy.store/stores/uuid/products/product-hero.webp",
    "expires_at": "2026-02-14T12:10:00Z",
    "method": "PUT",
    "headers": {
      "Content-Type": "image/webp"
    }
  }
}
```

---

## 18. Notification Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/notifications` | List notifications | ✅ |
| `PUT` | `/stores/:storeId/notifications/:notifId/read` | Mark as read | ✅ |
| `PUT` | `/stores/:storeId/notifications/read-all` | Mark all as read | ✅ |
| `GET` | `/stores/:storeId/notifications/preferences` | Get preferences | ✅ |
| `PUT` | `/stores/:storeId/notifications/preferences` | Update preferences | ✅ |
| `GET` | `/stores/:storeId/notifications/unread-count` | Get unread count | ✅ |

### 18.1 `GET /stores/:storeId/notifications`

**Query Parameters:**

| Param | Type | Description |
|---|---|---|
| `page` | integer | Page number |
| `per_page` | integer | Items per page (max: 50) |
| `type` | string | `order`, `payment`, `inventory`, `system`, `ai` |
| `is_read` | boolean | Filter by read status |

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid-...",
      "type": "order",
      "title": "New Order Received",
      "message": "Order FAS-00043 — ₹2,450 from Priya Sharma",
      "action_url": "/orders/uuid-...",
      "is_read": false,
      "metadata": { "order_id": "uuid-...", "amount": 2450 },
      "created_at": "2026-02-14T14:30:00Z"
    },
    {
      "id": "uuid-...",
      "type": "inventory",
      "title": "Low Stock Alert",
      "message": "Premium T-Shirt (M/Black) has only 3 units left",
      "action_url": "/products/uuid-...",
      "is_read": false,
      "severity": "warning",
      "created_at": "2026-02-14T13:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 20, "total": 45, "unread_count": 8 }
}
```

### 18.2 `PUT /stores/:storeId/notifications/preferences`

**Request:**

```json
{
  "email": {
    "new_order": true,
    "payment_received": true,
    "low_stock": true,
    "ai_credits_low": true,
    "weekly_digest": true,
    "marketing_tips": false
  },
  "push": {
    "new_order": true,
    "payment_received": false,
    "low_stock": false
  }
}
```

---

## 19. Admin Dashboard Routes

> See [04 Admin Dashboard](./04_Admin_Dashboard.md) for complete admin feature set.

### 19.1 Dashboard Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/dashboard` | Dashboard overview data | ✅ |
| `GET` | `/stores/:storeId/dashboard/revenue` | Revenue chart data | ✅ |
| `GET` | `/stores/:storeId/dashboard/top-products` | Top selling products | ✅ |
| `GET` | `/stores/:storeId/dashboard/top-customers` | Top customers | ✅ |
| `GET` | `/stores/:storeId/dashboard/recent-orders` | Recent orders feed | ✅ |
| `GET` | `/stores/:storeId/dashboard/conversion-funnel` | Conversion funnel | ✅ |

### 19.2 Settings Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/settings` | Get all store settings | ✅ |
| `PUT` | `/stores/:storeId/settings/general` | Update general settings | ✅ |
| `PUT` | `/stores/:storeId/settings/checkout` | Checkout settings | ✅ |
| `PUT` | `/stores/:storeId/settings/notifications` | Notification settings | ✅ |
| `PUT` | `/stores/:storeId/settings/seo` | SEO defaults | ✅ |
| `PUT` | `/stores/:storeId/settings/legal` | Legal pages (terms, privacy) | ✅ |
| `PUT` | `/stores/:storeId/settings/social` | Social media links | ✅ |

### 19.3 Theme & Page Builder Routes

| Method | Route | Description | Auth |
|---|---|---|---|
| `GET` | `/stores/:storeId/themes` | List available themes | ✅ |
| `GET` | `/stores/:storeId/themes/active` | Get active theme + config | ✅ |
| `PUT` | `/stores/:storeId/themes/active` | Update theme config | ✅ |
| `POST` | `/stores/:storeId/themes/:themeId/apply` | Apply a theme | ✅ |
| `GET` | `/stores/:storeId/pages` | List pages | ✅ |
| `POST` | `/stores/:storeId/pages` | Create page | ✅ |
| `GET` | `/stores/:storeId/pages/:pageId` | Get page (Craft.js JSON) | ✅ |
| `PUT` | `/stores/:storeId/pages/:pageId` | Update page content | ✅ |
| `DELETE` | `/stores/:storeId/pages/:pageId` | Delete page | ✅ |
| `POST` | `/stores/:storeId/pages/:pageId/publish` | Publish page | ✅ |

### 19.4 `GET /stores/:storeId/dashboard`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "period": "today",
    "revenue": {
      "today": 4500,
      "change_pct": 15.2,
      "currency": "INR"
    },
    "orders": { "today": 8, "pending": 3, "processing": 2 },
    "visitors": { "today": 120, "unique": 95 },
    "conversion_rate": 6.67,
    "top_products": [
      { "id": "uuid-...", "title": "Premium T-Shirt", "sold": 5, "revenue": 2995 }
    ],
    "recent_orders": [
      {
        "id": "uuid-...",
        "order_number": "FAS-00043",
        "customer": "Priya Sharma",
        "total": 2450,
        "status": "pending",
        "created_at": "2026-02-14T14:30:00Z"
      }
    ],
    "low_stock_count": 3,
    "ai_credits_remaining": 72.5,
    "store_health": {
      "score": 85,
      "items": [
        { "key": "seo_complete", "status": "pass", "label": "SEO configured" },
        { "key": "payment_setup", "status": "pass", "label": "Payment method active" },
        { "key": "shipping_setup", "status": "warning", "label": "Only 1 shipping zone" },
        { "key": "legal_pages", "status": "fail", "label": "Missing privacy policy" }
      ]
    }
  }
}
```

---

## 20. Super-Admin Routes

> Internal platform management. Requires `super_admin` role.

| Method | Route | Description | Auth | Role |
|---|---|---|---|---|
| `GET` | `/admin/stores` | List all platform stores | ✅ | super_admin |
| `GET` | `/admin/stores/:storeId` | Get store as super admin | ✅ | super_admin |
| `PUT` | `/admin/stores/:storeId/suspend` | Suspend store | ✅ | super_admin |
| `PUT` | `/admin/stores/:storeId/unsuspend` | Unsuspend store | ✅ | super_admin |
| `PUT` | `/admin/stores/:storeId/feature` | Feature a store | ✅ | super_admin |
| `GET` | `/admin/users` | List all platform users | ✅ | super_admin |
| `GET` | `/admin/users/:userId` | Get user details | ✅ | super_admin |
| `PUT` | `/admin/users/:userId/ban` | Ban user | ✅ | super_admin |
| `GET` | `/admin/analytics` | Platform-wide analytics | ✅ | super_admin |
| `GET` | `/admin/analytics/revenue` | Platform revenue | ✅ | super_admin |
| `GET` | `/admin/analytics/growth` | User/store growth | ✅ | super_admin |
| `GET` | `/admin/audit-logs` | View audit logs | ✅ | super_admin |
| `GET` | `/admin/moderation/queue` | Content moderation queue | ✅ | super_admin |
| `PUT` | `/admin/moderation/:id/approve` | Approve content | ✅ | super_admin |
| `PUT` | `/admin/moderation/:id/reject` | Reject content | ✅ | super_admin |
| `GET` | `/admin/system/health` | System health status | ✅ | super_admin |
| `GET` | `/admin/system/config` | Platform config | ✅ | super_admin |
| `PUT` | `/admin/system/config` | Update platform config | ✅ | super_admin |

---

## 21. Storefront (Public) Routes

> **No authentication required.** These endpoints serve the public-facing storefront.

| Method | Route | Description | Auth | Cache |
|---|---|---|---|---|
| `GET` | `/storefront/:subdomain` | Get store public data | ❌ | 5m |
| `GET` | `/storefront/:subdomain/products` | Public product listing | ❌ | 1m |
| `GET` | `/storefront/:subdomain/products/:slug` | Product detail page data | ❌ | 1m |
| `GET` | `/storefront/:subdomain/categories` | Category tree | ❌ | 5m |
| `GET` | `/storefront/:subdomain/collections/:slug` | Collection products | ❌ | 1m |
| `GET` | `/storefront/:subdomain/pages/:slug` | Page content | ❌ | 5m |
| `GET` | `/storefront/:subdomain/blog` | Blog post listing | ❌ | 1m |
| `GET` | `/storefront/:subdomain/blog/:slug` | Blog post detail | ❌ | 5m |
| `GET` | `/storefront/:subdomain/portfolio` | Portfolio projects | ❌ | 5m |
| `GET` | `/storefront/:subdomain/resume` | Resume data | ❌ | 5m |
| `POST` | `/storefront/:subdomain/cart` | Create/update cart | ❌ | — |
| `GET` | `/storefront/:subdomain/cart/:cartId` | Get cart | ❌ | — |
| `DELETE` | `/storefront/:subdomain/cart/:cartId/items/:itemId` | Remove cart item | ❌ | — |
| `POST` | `/storefront/:subdomain/checkout` | Initiate checkout | ❌ | — |
| `POST` | `/storefront/:subdomain/checkout/verify` | Verify payment & complete | ❌ | — |
| `POST` | `/storefront/:subdomain/reviews` | Submit product review | ❌ | — |
| `POST` | `/storefront/:subdomain/contact` | Submit contact form | ❌ | — |
| `GET` | `/storefront/:subdomain/search` | Full-text product search | ❌ | 30s |

### 21.1 `GET /storefront/:subdomain`

**Response (200):**

```json
{
  "success": true,
  "data": {
    "name": "Fashion Hub",
    "subdomain": "fashionhub",
    "site_type": "store",
    "tagline": "Premium Fashion, Delivered",
    "description": "Your one-stop shop for premium fashion...",
    "logo_url": "https://r2.letbuyy.store/...",
    "favicon_url": "https://r2.letbuyy.store/...",
    "banner_url": "https://r2.letbuyy.store/...",
    "currency": "INR",
    "social_links": {
      "instagram": "https://instagram.com/fashionhub",
      "twitter": "https://twitter.com/fashionhub"
    },
    "theme": {
      "id": "uuid-...",
      "name": "Aurora",
      "config": {
        "primary_color": "#6366F1",
        "font_heading": "Plus Jakarta Sans",
        "font_body": "Inter",
        "border_radius": "12px",
        "layout": "wide"
      }
    },
    "pages": [
      { "slug": "home", "title": "Home" },
      { "slug": "about", "title": "About Us" },
      { "slug": "contact", "title": "Contact" }
    ],
    "features": {
      "has_blog": true,
      "has_portfolio": false,
      "has_reviews": true,
      "has_wishlist": true
    }
  }
}
```

### 21.2 `POST /storefront/:subdomain/cart`

**Request:**

```json
{
  "cart_id": null,
  "action": "add",
  "product_id": "uuid-...",
  "variant_id": "uuid-...",
  "quantity": 2
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "id": "uuid-...",
    "items": [
      {
        "id": "uuid-...",
        "product_id": "uuid-...",
        "variant_id": "uuid-...",
        "title": "Premium T-Shirt",
        "variant_title": "M / Black",
        "image_url": "https://r2.letbuyy.store/...",
        "price": 599.00,
        "quantity": 2,
        "line_total": 1198.00
      }
    ],
    "subtotal": 1198.00,
    "item_count": 2,
    "created_at": "2026-02-14T14:30:00Z"
  }
}
```

---

## 22. Webhooks

### 22.1 Incoming Webhooks (from Providers)

| Provider | Endpoint | Events | Verification |
|---|---|---|---|
| Razorpay | `POST /webhooks/razorpay` | `payment.captured`, `payment.failed`, `subscription.activated`, `subscription.charged`, `subscription.cancelled` | HMAC SHA256 |
| Stripe | `POST /webhooks/stripe` | `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted` | Signature header |
| Supabase | `POST /webhooks/supabase` | Auth events (signup, login, password reset) | Webhook secret |

### 22.2 Webhook Verification

```typescript
// src/webhooks/razorpay.ts
import { createHmac } from 'node:crypto';

app.post('/webhooks/razorpay', async (c) => {
  const signature = c.req.header('x-razorpay-signature');
  const payload = await c.req.text();
  
  const expectedSig = createHmac('sha256', c.env.RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSig) {
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(payload);
  
  switch (event.event) {
    case 'payment.captured':
      await handlePaymentCaptured(event.payload.payment.entity);
      break;
    case 'subscription.charged':
      await handleSubscriptionCharged(event.payload.subscription.entity);
      break;
    // ... other events
  }

  return c.json({ status: 'ok' }, 200);
});
```

### 22.3 Outgoing Webhooks (to Store Owners)

Store owners configure webhook URLs in settings to receive real-time event notifications.

| Event | Trigger | Payload |
|---|---|---|
| `order.created` | New order placed | Order details + items + customer |
| `order.confirmed` | Order confirmed | Order details + timestamp |
| `order.shipped` | Order shipped | Order + tracking number + URL |
| `order.delivered` | Order marked delivered | Order details |
| `order.cancelled` | Order cancelled | Order + cancellation reason |
| `payment.received` | Payment confirmed | Payment amount + order |
| `payment.refunded` | Refund processed | Refund amount + order |
| `stock.low` | Stock below threshold | Product + variant + current stock |
| `stock.out` | Stock reached zero | Product + variant |
| `customer.created` | New customer registered | Customer details |
| `review.submitted` | New product review | Review + product + rating |

**Outgoing Webhook Format:**

```json
{
  "event": "order.created",
  "store_id": "uuid-...",
  "timestamp": "2026-02-14T14:30:00Z",
  "data": {
    "order_id": "uuid-...",
    "order_number": "FAS-00043",
    "total": 2450.00,
    "customer_email": "priya@example.com"
  },
  "signature": "sha256=abc123..."
}
```

**Retry Policy:**

| Attempt | Delay | Timeout |
|---|---|---|
| 1 | Immediate | 10s |
| 2 | 1 min | 10s |
| 3 | 5 min | 10s |
| 4 | 30 min | 10s |
| 5 | 2 hours | 10s |
| After 5 | Webhook disabled, owner notified | — |

---

## 23. Error Handling

### 23.1 Error Code Reference

| HTTP | Code | Meaning | Example |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request data | Missing required field |
| 400 | `INVALID_FILE_TYPE` | Unsupported upload type | Uploading .exe |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT | Expired token |
| 401 | `SESSION_EXPIRED` | Session timed out | Token older than 7d |
| 401 | `INVALID_SIGNATURE` | Webhook signature mismatch | Tampered webhook |
| 403 | `FORBIDDEN` | Insufficient permissions | Staff accessing billing |
| 403 | `STORE_FROZEN` | Store trial expired | Frozen store API call |
| 403 | `PLAN_UPGRADE_REQUIRED` | Feature not in plan | AI on free plan |
| 403 | `STORE_SUSPENDED` | Store suspended by admin | Violation suspension |
| 404 | `NOT_FOUND` | Resource not found | Invalid product ID |
| 404 | `STORE_NOT_FOUND` | Store doesn't exist | Invalid subdomain |
| 409 | `CONFLICT` | Duplicate resource | Subdomain already taken |
| 409 | `CONCURRENT_MODIFICATION` | Stale data update | Inventory race condition |
| 422 | `INSUFFICIENT_CREDITS` | Not enough AI credits | AI call without credits |
| 422 | `OUT_OF_STOCK` | Product unavailable | Checkout with 0 stock |
| 422 | `COUPON_EXPIRED` | Coupon past expiry | Expired coupon at checkout |
| 422 | `ORDER_NOT_CANCELLABLE` | Order in final state | Cancel a delivered order |
| 429 | `RATE_LIMITED` | Too many requests | Exceeded rate limit |
| 500 | `INTERNAL_ERROR` | Unexpected server error | Unhandled exception |
| 502 | `UPSTREAM_ERROR` | External service failure | Razorpay API down |
| 503 | `SERVICE_UNAVAILABLE` | Temporary maintenance | Planned downtime |

### 23.2 Error Response Handler

```typescript
// src/middleware/error-handler.ts
import { HTTPException } from 'hono/http-exception';

export const errorHandler = (err: Error, c: Context) => {
  const requestId = c.get('requestId') || 'unknown';

  // Zod validation errors
  if (err.name === 'ZodError') {
    const zodErr = err as z.ZodError;
    return c.json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        status: 400,
        details: zodErr.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message,
          code: e.code,
        })),
        request_id: requestId,
      }
    }, 400);
  }

  // HTTP exceptions (thrown by middleware)
  if (err instanceof HTTPException) {
    return c.json({
      success: false,
      error: {
        code: err.message || 'HTTP_ERROR',
        message: err.message,
        status: err.status,
        request_id: requestId,
      }
    }, err.status);
  }

  // Unexpected errors
  console.error(`[${requestId}] Unhandled error:`, err);
  return c.json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      status: 500,
      request_id: requestId,
    }
  }, 500);
};
```

---

## 24. Rate Limiting

### 24.1 Tier Limits

| Tier | Requests/min | Requests/hour | Burst (10s) | AI Calls/min |
|---|---|---|---|---|
| Unauthenticated | 30 | 300 | 10 | 0 |
| Free plan | 60 | 1,000 | 20 | 5 |
| Starter | 120 | 3,000 | 40 | 10 |
| Business | 300 | 10,000 | 100 | 20 |
| Enterprise | 600 | 30,000 | 200 | 50 |

### 24.2 Rate Limit Headers

Every response includes rate-limiting metadata:

```
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 98
X-RateLimit-Reset: 1708300800
X-RateLimit-Policy: sliding_window
Retry-After: 45
```

### 24.3 Per-Route Overrides

Some routes have tighter limits regardless of plan:

| Route Pattern | Limit | Window | Reason |
|---|---|---|---|
| `POST /auth/signup` | 5 | 1 hour | Abuse prevention |
| `POST /auth/login` | 10 | 15 min | Brute-force protection |
| `POST /auth/otp/*` | 5 | 15 min | SMS/email cost |
| `POST /ai/generate/*` | Plan-based | 1 min | AI cost control |
| `POST /payments/*` | 10 | 1 min | Payment fraud |
| `POST /webhooks/*` | 100 | 1 min | Provider traffic |
| `POST /stores/:id/products/bulk-import` | 2 | 1 hour | Resource-intensive |

### 24.4 Rate Limiter Implementation

```typescript
// src/middleware/rate-limiter.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis/cloudflare';

export const rateLimiter = () => createMiddleware(async (c, next) => {
  const redis = new Redis({
    url: c.env.UPSTASH_REDIS_URL,
    token: c.env.UPSTASH_REDIS_TOKEN,
  });

  const plan = c.get('plan') || 'unauthenticated';
  const limits: Record<string, number> = {
    unauthenticated: 30,
    free: 60,
    starter: 120,
    business: 300,
    enterprise: 600,
  };

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limits[plan] || 30, '60 s'),
    analytics: true,
  });

  const identifier = c.get('user')?.id || c.req.header('CF-Connecting-IP') || 'unknown';
  const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

  c.header('X-RateLimit-Limit', limit.toString());
  c.header('X-RateLimit-Remaining', remaining.toString());
  c.header('X-RateLimit-Reset', reset.toString());

  if (!success) {
    return c.json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Try again in ${Math.ceil((reset - Date.now()) / 1000)} seconds.`,
        status: 429,
      }
    }, 429);
  }

  await next();
});
```

---

## 25. API Versioning & Deprecation

### 25.1 Versioning Strategy

| Aspect | Implementation |
|---|---|
| **Strategy** | URL path versioning (`/v1/`, `/v2/`) |
| **Current Version** | `v1` |
| **Deprecation Notice** | 6-month warning via `Sunset` header |
| **Migration Window** | 12 months overlap between major versions |

### 25.2 Deprecation Headers

```
Sunset: Sat, 14 Feb 2027 00:00:00 GMT
Deprecation: true
Link: <https://api.letbuyy.store/v2/stores>; rel="successor-version"
```

### 25.3 SDK & Client Libraries

| Language | Package | Status |
|---|---|---|
| JavaScript/TypeScript | `@letbuyy/sdk` | ✅ Available |
| Dart (Flutter) | `letbuyy_sdk` | ✅ Available |
| Python | `letbuyy-python` | 🔜 Planned |

**SDK Usage:**

```typescript
import { LetBuyy } from '@letbuyy/sdk';

const client = new LetBuyy({
  accessToken: 'your_token_here',
  storeId: 'your_store_id',
});

// List products
const products = await client.products.list({ status: 'active', page: 1 });

// Create order
const order = await client.orders.create({
  customer_email: 'priya@example.com',
  items: [{ product_id: 'uuid-...', quantity: 2 }],
});

// Generate AI description
const description = await client.ai.generate('product-description', {
  product_title: 'Premium T-Shirt',
  tone: 'professional',
});
```

---

## 26. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 6.0 | Feb 14, 2026 | System | Major expansion — 26 sections, 200+ endpoints, full request/response schemas, TypeScript middleware code, Zod validations, webhook implementations, SSE streaming, SDK examples |
| 5.0 | Feb 14, 2026 | System | Initial creation — 15 sections, route tables with basic descriptions |

---

> **Next:** [10 Storefront & Themes](./10_Storefront_and_Themes.md) — Public storefront rendering and theme engine

> **See also:** [13 Plans & Pricing](./13_Plans_and_Pricing.md) · [14 Theme Implementation](./14_Theme_Implementation.md) · [15 App Store Implementation](./15_App_Store_Implementation.md) · [16 Customer Management](./16_Customer_Management.md) — Additional API routes defined in these docs

---

*[← Back to Index](./README.md)*
