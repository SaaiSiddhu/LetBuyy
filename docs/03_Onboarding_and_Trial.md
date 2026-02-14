# LetBuyy Platform — Onboarding & Trial

> **Doc 03 of 12** | Signup → Store Creation → Trial Countdown → Payment Activation
>
> **Version:** 5.0 | **Date:** February 14, 2026
>
> **Prev:** [02 Authentication & Security](./02_Authentication_and_Security.md) | **Next:** [04 Admin Dashboard](./04_Admin_Dashboard.md)

---

## Table of Contents

1. [User Journey Overview](#1-user-journey-overview)
2. [Signup Flow](#2-signup-flow)
3. [Store Creation Wizard](#3-store-creation-wizard)
4. [Trial System Architecture](#4-trial-system-architecture)
5. [Trial Countdown UI](#5-trial-countdown-ui)
6. [Payment & Plan Selection](#6-payment--plan-selection)
7. [Store Activation & Publishing](#7-store-activation--publishing)
8. [Reactivation Flow](#8-reactivation-flow)
9. [AI-Assisted Onboarding](#9-ai-assisted-onboarding)
10. [Email Sequences](#10-email-sequences)
11. [Onboarding Analytics & Tracking](#11-onboarding-analytics--tracking)
12. [Error Handling & Recovery](#12-error-handling--recovery)
13. [Security Considerations](#13-security-considerations)
14. [Accessibility (a11y)](#14-accessibility-a11y)
15. [Internationalization (i18n)](#15-internationalization-i18n)
16. [Performance Optimizations](#16-performance-optimizations)
17. [Testing Strategy](#17-testing-strategy)
18. [Environment Variables](#18-environment-variables)
19. [Glossary](#19-glossary)
20. [Document History](#20-document-history)

---

## 1. User Journey Overview

> **Cross-ref:** [00_Overview §4 — Complete User Journey](./00_Overview.md) | [01_Architecture §16 — Onboarding Architecture](./01_Architecture.md) | [02_Auth §2 — User Authentication Flows](./02_Authentication_and_Security.md)
>
> **⚠️ CRITICAL RULE:** The marketing site `letbuyy.store` has **NO authentication pages**. All signup, onboarding, and store creation flows happen exclusively on `accounts.letbuyy.store`. "Get Started" buttons on the marketing site **redirect** to `accounts.letbuyy.store/signup`.

### 1.1 Complete User Journey (10 Steps)

```
letbuyy.store (Marketing Landing Page)
        │
        ▼  User clicks "Get Started Free" → REDIRECT
accounts.letbuyy.store/signup
   • Email-first entry (check-email → login vs signup routing)
   • OTP verification (6-digit, 10-min expiry)
   • Password creation (8+ chars, uppercase, number, special)
   • Turnstile bot protection on form submission
   • Account created in Supabase Auth
        │
        ▼  After verification → post-signup redirect
accounts.letbuyy.store/onboarding
   STEP 1: Site Type Selection (Store / Portfolio / Resume / Blog / Landing)
   STEP 2: Store Name + Subdomain (real-time availability check)
   → Backend: INSERT stores + ai_credits + onboarding_attempts
   → Email: "Store Created" via Resend
   → Redirect to admin
        │
        ▼  Store created (14-day trial starts)
admin.letbuyy.store/{subdomain}/onboarding
   STEP 3: Admin Onboarding Survey (site-type-specific, 5 questions)
   → Saved to store_surveys (JSONB) for AI personalization
   → [Skip] available — can fill later from Settings
        │
        ▼  Survey complete → dashboard
admin.letbuyy.store/{subdomain}/dashboard
   • Trial countdown banner visible (14 days remaining)
   • Full feature access during trial
   • AI Studio available with 10 trial credits
   • Dashboard layout adapts to site_type
        │
        ▼  User builds site, adds content
{subdomain}.letbuyy.store  →  "Launching Soon" page (draft status)
   • Branded placeholder with store name + owner info
   • SEO-ready meta tags
        │
        ▼  User clicks "Publish" (pre-publishing checks pass)
{subdomain}.letbuyy.store  (PUBLISHED STOREFRONT)
   • ISR enabled (60s revalidation)
   • Custom domain available on Starter+ plans
        │
        ▼  Trial expires OR user selects plan
Payment / Plan Selection
   • Choose tier (Free / Starter / Business / Enterprise)
   • Region detection: India → Razorpay, Global → Stripe
   • Annual billing option (20% discount)
        │
        ▼  After payment
{subdomain}.letbuyy.store  (FULLY ACTIVE — paid plan)
   • Feature limits enforced per plan
   • AI credits reset monthly
   • Custom domain DNS provisioning
```

### 1.2 Onboarding State Machine

> **Source:** [01_Architecture §16.1](./01_Architecture.md)

Each user progresses through **7 distinct states** from anonymous visitor to published site owner. The state machine ensures no step is skipped and enables recovery from any point.

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
                                                          │ create store (subdomain)
                                                    ┌─────▼──────┐
                                                    │  STORE      │
                                                    │  CREATED    │
                                                    │ (store_id,  │
                                                    │  subdomain) │
                                                    └─────┬──────┘
                                                          │ redirect to admin
                                                    ┌─────▼──────┐
                                                    │  SURVEYING  │
                                                    │ (onboarding │
                                                    │  questions) │
                                                    └─────┬──────┘
                                                          │ submit/skip survey
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

### 1.3 Step Timing Estimates

| Step | Action | Estimated Time | Depends On |
|---|---|---|---|
| 1 | Marketing → Signup redirect | Instant | — |
| 2 | Email + OTP verification | 30s–2min | Email delivery speed |
| 3 | Password creation | 15–30s | User input |
| 4 | Site type selection | 5–15s | User decision |
| 5 | Store name + subdomain | 15–45s | Availability check |
| 6 | Backend store creation | 1–3s | API + DB transaction |
| 7 | Admin onboarding survey | 1–3min | 5 questions |
| 8 | First content creation | 5–30min | User's content readiness |
| 9 | Publishing | 2–5s | Pre-publish checks |
| **Total** | **Signup → Published** | **~8–40 min** | Varies by user |

### 1.4 Key Database Operations Per Step

> **Source:** [01_Architecture §16.2](./01_Architecture.md)

| Step | Table(s) Modified | Key Operation |
|---|---|---|
| Signup | `auth.users` | `auth.signUp()` — creates user record |
| Verify OTP | `auth.users` | `auth.verifyOTP()` — sets `email_confirmed_at` |
| Choose Site Type | *(client state)* | Stored in Zustand, not persisted yet |
| Create Store | `stores`, `ai_credits`, `onboarding_attempts` | INSERT into 3 tables in transaction |
| Onboarding Survey | `store_surveys` | INSERT answers as JSONB |
| First Content | Type-specific table (`products`/`blog_posts`/`projects`/etc.) | INSERT first item |
| Publish | `stores` | UPDATE status → `'published'`, set `published_at` |

---

## 2. Signup Flow

> **Cross-ref:** [02_Auth §2 — Email-First Unified Flow](./02_Authentication_and_Security.md) | [02_Auth §12 — Turnstile Anti-Bot](./02_Authentication_and_Security.md)

### 2.1 Email-First Unified Entry

> **Architectural Decision:** LetBuyy uses an **email-first** entry point. The user enters their email, and the system determines whether to show the signup flow or login flow. This eliminates the "forgot which method I used" problem. See [02_Auth §2.1](./02_Authentication_and_Security.md) for the full check-email routing.

```
User clicks "Get Started" on letbuyy.store
    │
    ▼  REDIRECTS TO
accounts.letbuyy.store/signup
    │
    ├── 1. Enter email + Turnstile bot check
    │       └── POST /v1/auth/check-email { email, turnstileToken }
    │
    ├── Email EXISTS?
    │   ├── YES → Redirect to /login?email={email} (existing user)
    │   └── NO  → Continue signup flow ↓
    │
    ├── 2. Send OTP (6-digit code via Resend)
    │       └── POST /v1/auth/signup { email }
    │       └── OTP valid for 10 minutes, max 3 attempts
    │
    ├── 3. Verify OTP
    │       └── POST /v1/auth/otp/verify { email, otp }
    │       └── Success → account activated
    │
    ├── 4. Set password (if email signup, not OAuth)
    │       └── POST /v1/auth/password/set { email, password }
    │       └── Password strength: 8+ chars, uppercase, number, special
    │
    └── 5. Post-signup redirect
            └── → accounts.letbuyy.store/onboarding (store creation wizard)
```

### 2.2 Step-by-Step UI Wireframes

```
┌──────────────────────────────────────────────────┐
│                   SIGNUP FLOW                      │
│                                                    │
│  ┌─────────────────────────────────────────────┐  │
│  │  Step 1: Email + Bot Protection              │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  📧 Enter your email                  │   │  │
│  │  │  [____________________________]       │   │  │
│  │  │  [Turnstile Widget — managed mode]    │   │  │
│  │  │           [Continue →]                │   │  │
│  │  │                                       │   │  │
│  │  │  — or sign up with —                  │   │  │
│  │  │  [Google] [GitHub] [Apple]             │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────┘  │
│                        ▼                           │
│  ┌─────────────────────────────────────────────┐  │
│  │  Step 2: OTP Verification                    │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  📱 Enter the 6-digit code sent to    │   │  │
│  │  │      your@email.com                   │   │  │
│  │  │  [ ] [ ] [ ] [ ] [ ] [ ]              │   │  │
│  │  │                                       │   │  │
│  │  │  Didn't receive? [Resend] (60s)       │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────┘  │
│                        ▼                           │
│  ┌─────────────────────────────────────────────┐  │
│  │  Step 3: Create Password                     │  │
│  │  ┌──────────────────────────────────────┐   │  │
│  │  │  🔒 Choose a strong password          │   │  │
│  │  │  [____________________________]       │   │  │
│  │  │  [____________________________]       │   │  │
│  │  │                                       │   │  │
│  │  │  ✅ 8+ characters                     │   │  │
│  │  │  ✅ 1 uppercase letter                │   │  │
│  │  │  ✅ 1 number                          │   │  │
│  │  │  ✅ 1 special character               │   │  │
│  │  │           [Create Account →]          │   │  │
│  │  └──────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 2.3 API Calls & Rate Limits

| Step | Endpoint | Payload | Rate Limit |
|---|---|---|---|
| Check email | `POST /v1/auth/check-email` | `{ email, turnstileToken }` | 10/min/IP |
| Send OTP | `POST /v1/auth/signup` | `{ email }` → triggers Resend | 4/hr/IP |
| Verify OTP | `POST /v1/auth/otp/verify` | `{ email, otp }` | 5/min/IP |
| Set password | `POST /v1/auth/password/set` | `{ email, password }` | 5/min/IP |
| OAuth login | `GET /v1/auth/callback/:provider` | `{ code, state }` | 10/min/IP |

### 2.4 Zod Validation Schemas

```typescript
// packages/validation/src/auth.ts — Shared between frontend + API Worker

import { z } from 'zod';

// Disposable email domains blocklist (top 50)
const DISPOSABLE_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'yopmail.com', 'tempmail.com',
  'throwaway.email', '10minutemail.com', 'trashmail.com', 'sharklasers.com',
  // ... expanded list in production
];

export const emailSchema = z.string()
  .email('Please enter a valid email address')
  .max(255, 'Email too long')
  .refine(
    (email) => !DISPOSABLE_DOMAINS.includes(email.split('@')[1]),
    'Disposable email addresses are not allowed'
  );

export const otpSchema = z.string()
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only numbers');

export const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')  // bcrypt limit
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[!@#$%^&*(),.?":{}|<>]/, 'Password must contain at least one special character');

export const signupSchema = z.object({
  email: emailSchema,
  turnstileToken: z.string().min(1, 'Bot verification required'),
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  otp: otpSchema,
});

export const setPasswordSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine(
  (data) => data.password === data.confirmPassword,
  { message: 'Passwords do not match', path: ['confirmPassword'] }
);
```

### 2.5 Signup Handler (Hono Worker)

> **Cross-ref:** See full handler in [02_Auth §2.4](./02_Authentication_and_Security.md)

```typescript
// workers/api/src/routes/auth/signup.ts

app.post('/v1/auth/signup', validate('json', signupSchema), async (c) => {
  const { email, turnstileToken } = c.req.valid('json');

  // 1. Verify Turnstile — block bots
  const turnstileValid = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET);
  if (!turnstileValid) {
    return c.json({ error: 'Bot verification failed. Please try again.' }, 403);
  }

  // 2. Rate limit: 4 signups per hour per IP
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rateLimited = await checkRateLimit(c.env.REDIS, `signup:${ip}`, 4, 3600);
  if (rateLimited) {
    return c.json({ error: 'Too many signup attempts. Try again later.' }, 429);
  }

  // 3. Check if email already exists (determines login vs signup)
  const supabase = createServiceClient(c.env);
  const { data: existingUser } = await supabase.auth.admin.getUserByEmail(email);
  if (existingUser) {
    return c.json({ exists: true, redirect: `/login?email=${encodeURIComponent(email)}` });
  }

  // 4. Create user + send OTP via Supabase Auth (triggers Resend email)
  const { data, error } = await supabase.auth.signUp({
    email,
    password: crypto.randomUUID(),  // Temporary password, user sets real one after OTP
    options: {
      emailRedirectTo: `${c.env.ACCOUNTS_URL}/verify`,
    },
  });

  if (error) {
    return c.json({ error: 'Failed to create account. Please try again.' }, 500);
  }

  // 5. Log to audit and analytics
  await logActivity(c.env, {
    action: 'signup_initiated',
    userId: data.user?.id,
    metadata: { email, ip, userAgent: c.req.header('User-Agent') },
  });

  return c.json({
    success: true,
    userId: data.user?.id,
    needsVerification: true,
    message: 'OTP sent to your email. Please verify within 10 minutes.',
  });
});
```

### 2.6 Error States & Recovery

| Error | User Sees | Recovery |
|---|---|---|
| Invalid email format | Inline validation error | Fix email and retry |
| Disposable email | "Disposable emails not allowed" | Use real email |
| Email already exists | Redirect to login with pre-filled email | Login instead |
| OTP expired (10 min) | "Code expired" + [Resend] button | Request new OTP |
| OTP max attempts (3) | "Too many attempts. Request new code" | Wait 60s, resend |
| Rate limited | "Too many attempts. Try again in X minutes" | Wait and retry |
| Turnstile failed | "Verification failed. Please try again" | Retry captcha |
| Supabase Auth error | "Something went wrong. Please try again" | Report to Sentry |

---

## 3. Store Creation Wizard

> **Cross-ref:** [00_Overview §4.5 — Onboarding Steps](./00_Overview.md) | [01_Architecture §10.4 — Store Creation Flow](./01_Architecture.md) | [01_Architecture §16.4 — Subdomain Validation](./01_Architecture.md)
>
> The store creation wizard runs on `accounts.letbuyy.store/onboarding` — **not** on the admin app. After store creation, the user is redirected to `admin.letbuyy.store/{subdomain}/onboarding` for the site-type-specific survey.

### 3.1 Step 1: Site Type Selection (5 Types)

> **Source:** [00_Overview §4.5 — 5 site types](./00_Overview.md)

```
┌──────────────────────────────────────────────────┐
│           What would you like to build?            │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐       │
│  │ 🛒       │  │ 🎨       │  │ 📄       │       │
│  │ Online   │  │Portfolio │  │ Resume   │       │
│  │ Store    │  │          │  │          │       │
│  │          │  │ Showcase │  │ Profess- │       │
│  │ Sell     │  │ your     │  │ ional CV │       │
│  │ products │  │ work     │  │ builder  │       │
│  └──────────┘  └──────────┘  └──────────┘       │
│                                                    │
│  ┌──────────┐  ┌──────────┐                       │
│  │ ✍️       │  │ 🚀       │                       │
│  │ Blog     │  │ Landing  │  💡 Not sure?          │
│  │          │  │ Page     │  AI can help you       │
│  │ Write &  │  │          │  decide based on       │
│  │ publish  │  │ Marketing│  your goals            │
│  │ posts    │  │ page     │  [Help me choose →]   │
│  └──────────┘  └──────────┘                       │
│                                                    │
│  [Next →] (disabled until a type is selected)     │
└──────────────────────────────────────────────────┘
```

**Site Type ↔ Feature Mapping:**

| Feature | Store | Portfolio | Resume | Blog | Landing |
|---|:---:|:---:|:---:|:---:|:---:|
| Products | ✅ | — | — | — | — |
| Orders & Inventory | ✅ | — | — | — | — |
| Coupons & Shipping | ✅ | — | — | — | — |
| Projects Gallery | — | ✅ | — | — | — |
| Testimonials | — | ✅ | — | — | — |
| Experience Timeline | — | — | ✅ | — | — |
| Skills & Education | — | — | ✅ | — | — |
| Blog Posts | ✅ | ✅ | — | ✅ | — |
| Categories & Tags | — | — | — | ✅ | — |
| Newsletter | — | — | — | ✅ | ✅ |
| Page Builder | ✅ | ✅ | — | — | ✅ |
| Contact Form | — | ✅ | ✅ | — | ✅ |
| AI Studio | ✅ | ✅ | ✅ | ✅ | ✅ |
| Analytics | ✅ | ✅ | ✅ | ✅ | ✅ |

### 3.2 Step 2: Store Name + Subdomain

```
┌──────────────────────────────────────────────────┐
│              Name your store                       │
│              This will be your URL                 │
│                                                    │
│  Store Name                                        │
│  [_________________________________]              │
│  ✨ AI Suggestion: Based on your type...           │
│                                                    │
│  Subdomain                                         │
│  ┌─────────────────────────┬──────────────┐       │
│  │  myawesomestore         │ .letbuyy     │       │
│  │  (auto-sanitized:       │ .store       │       │
│  │   lowercase, a-z0-9-)  │ (suffix)     │       │
│  └─────────────────────────┴──────────────┘       │
│  ✅ Available!  (real-time check, 300ms debounce) │
│                                                    │
│  [← Back]          [Create Store →]               │
└──────────────────────────────────────────────────┘
```

### 3.3 Subdomain Validation Rules (TypeScript)

> **Source:** [01_Architecture §16.4](./01_Architecture.md)

```typescript
// workers/api/src/utils/subdomain.ts

const SUBDOMAIN_RULES = {
  regex: /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/,  // 3-64 chars, lowercase alphanumeric + hyphens
  minLength: 3,
  maxLength: 64,

  // Reserved subdomains that cannot be claimed
  blocklist: [
    'www', 'api', 'admin', 'accounts', 'console', 'team',
    'cdn', 'mail', 'smtp', 'ftp', 'ssh', 'git', 'dev',
    'staging', 'test', 'demo', 'support', 'help', 'docs',
    'blog', 'shop', 'store', 'app', 'dashboard', 'billing',
    'status', 'webhooks', 'internal', 'static', 'assets',
  ],

  // Sanitize user input → valid subdomain
  sanitize(input: string): string {
    return input
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')     // Remove invalid chars
      .replace(/^-+|-+$/g, '')         // Trim leading/trailing hyphens
      .replace(/-{2,}/g, '-')          // No consecutive hyphens
      .slice(0, 64);                   // Enforce max length
  },

  // Validate subdomain format
  validate(subdomain: string): { valid: boolean; error?: string } {
    if (subdomain.length < this.minLength) {
      return { valid: false, error: `Minimum ${this.minLength} characters` };
    }
    if (subdomain.length > this.maxLength) {
      return { valid: false, error: `Maximum ${this.maxLength} characters` };
    }
    if (!this.regex.test(subdomain)) {
      return { valid: false, error: 'Only lowercase letters, numbers, and hyphens allowed' };
    }
    if (this.blocklist.includes(subdomain)) {
      return { valid: false, error: 'This name is reserved. Please choose another' };
    }
    return { valid: true };
  },

  // Check database availability (real-time, debounced on frontend)
  async isAvailable(subdomain: string, supabase: SupabaseClient): Promise<boolean> {
    const { count } = await supabase
      .from('stores')
      .select('*', { count: 'exact', head: true })
      .eq('subdomain', subdomain);
    return count === 0;
  },
};

// Zod schema for store creation
export const createStoreSchema = z.object({
  storeName: z.string().min(2).max(100),
  subdomain: z.string().min(3).max(64)
    .regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, 'Invalid subdomain format'),
  siteType: z.enum(['store', 'portfolio', 'resume', 'blog', 'landing']),
});
```

### 3.4 Store Creation Handler (Hono Worker)

> **Source:** [01_Architecture §10.4](./01_Architecture.md) — Full end-to-end store creation flow

```typescript
// workers/api/src/routes/stores/create.ts

app.post('/v1/stores/create', authMiddleware(), validate('json', createStoreSchema), async (c) => {
  const userId = c.get('userId');
  const { storeName, subdomain, siteType } = c.req.valid('json');

  // 1. Validate subdomain format
  const validation = SUBDOMAIN_RULES.validate(subdomain);
  if (!validation.valid) {
    return c.json({ error: validation.error }, 400);
  }

  // 2. Check subdomain availability
  const supabase = createServiceClient(c.env);
  const isAvailable = await SUBDOMAIN_RULES.isAvailable(subdomain, supabase);
  if (!isAvailable) {
    return c.json({ error: 'This subdomain is already taken' }, 409);
  }

  // 3. Check user store limit (trial = 1 store max)
  const { count: storeCount } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if (storeCount && storeCount >= 1) {
    // Check if user has a paid plan that allows more stores
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plans(slug)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    const limit = PLAN_LIMITS[sub?.plans?.slug || 'free'].stores;
    if (storeCount >= limit) {
      return c.json({
        error: `Your plan allows ${limit} store(s). Upgrade to create more.`,
        upgrade: true,
      }, 403);
    }
  }

  // 4. Database transaction: INSERT into 3 tables
  const { data: store, error: storeError } = await supabase
    .from('stores')
    .insert({
      user_id: userId,
      store_name: storeName,
      subdomain,
      site_type: siteType,
      status: 'draft',  // Not published yet
      trial_started_at: new Date().toISOString(),
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single();

  if (storeError) {
    return c.json({ error: 'Failed to create store. Please try again.' }, 500);
  }

  // 5. Create AI credits record (10 free trial credits)
  await supabase.from('ai_credits').insert({
    store_id: store.id,
    total_credits: 10,
    used_credits: 0,
    plan_credits: 0,  // Will be set when user subscribes
  });

  // 6. Log onboarding attempt
  await supabase.from('onboarding_attempts').insert({
    user_id: userId,
    subdomain,
    site_type: siteType,
    success: true,
  });

  // 7. Send "Store Created" email via Resend
  await sendEmail(c.env, {
    to: c.get('userEmail'),
    template: 'store-created',
    data: {
      storeName,
      subdomain,
      siteType,
      adminUrl: `https://admin.letbuyy.store/${subdomain}/onboarding`,
      trialEndsAt: store.trial_ends_at,
    },
  });

  // 8. Audit log
  await logActivity(c.env, {
    action: 'store_created',
    userId,
    storeId: store.id,
    metadata: { subdomain, siteType },
  });

  // 9. Return redirect URL
  return c.json({
    success: true,
    store: {
      id: store.id,
      subdomain,
      storeName,
      siteType,
      trialEndsAt: store.trial_ends_at,
    },
    redirectUrl: `https://admin.letbuyy.store/${subdomain}/onboarding`,
  }, 201);
});
```

### 3.5 Step 3: Admin Onboarding Survey (Site-Type-Specific)

> **Source:** [00_Overview §6 — 5 Site-Type Surveys](./00_Overview.md) | **Hosted at:** `admin.letbuyy.store/{subdomain}/onboarding`
>
> After store creation, the user is redirected to the admin app for a **site-type-specific survey** (5 questions). This data is stored as JSONB and used by the AI engine for personalization.

#### E-Commerce Store Survey

| # | Question | Options |
|---|---|---|
| Q1 | What industry are you in? | Fashion, Electronics, Beauty, Food, Sports, Home, Jewelry, Art, Other |
| Q2 | How many products do you plan to sell? | 1–10, 11–50, 51–200, 200+ |
| Q3 | Do you already have product images? | Yes / No / Some |
| Q4 | Preferred currency? | INR, USD, EUR, GBP, AED, etc. |
| Q5 | Do you need shipping? | Yes – local only / Yes – worldwide / No (digital products) |

#### Blog Survey

| # | Question | Options |
|---|---|---|
| Q1 | What topics will you write about? | Tech, Lifestyle, Travel, Food, Business, Personal, Education, Other |
| Q2 | How often do you plan to publish? | Daily, Weekly, Bi-weekly, Monthly |
| Q3 | Preferred blog layout? | Standard, Magazine, Minimal, Grid |
| Q4 | Enable comments? | Yes / Yes – with moderation / No |
| Q5 | Want a newsletter? | Yes / Not yet |

#### Portfolio Survey

| # | Question | Options |
|---|---|---|
| Q1 | What type of work? | Design, Photography, Development, Art, Architecture, Other |
| Q2 | Gallery style? | Masonry, Grid, Carousel, Full-width |
| Q3 | How many projects? | 1–5, 6–20, 20+ |
| Q4 | Include contact form? | Yes / No |
| Q5 | Include testimonials section? | Yes / Not yet |

#### Resume Survey

| # | Question | Options |
|---|---|---|
| Q1 | What field? | Software Engineering, Design, Marketing, Finance, Healthcare, Education, Other |
| Q2 | Experience level? | Student, Junior (0–2yr), Mid (3–5yr), Senior (6–10yr), Executive (10+yr) |
| Q3 | Import from LinkedIn? | Yes / No / Enter manually |
| Q4 | Resume template style? | Modern, Classic, Creative, Minimal |
| Q5 | Need PDF export? | Yes – PDF / Yes – PDF + DOCX / Not yet |

#### Landing Page Survey

| # | Question | Options |
|---|---|---|
| Q1 | What's the goal? | Product launch, Waitlist, Event, Service promotion, App download, Other |
| Q2 | Do you have brand assets? | Logo / Colors / Both / Neither |
| Q3 | Need a form? | Contact, Waitlist, Survey, Newsletter, None |
| Q4 | Need A/B testing? | Yes / Not yet |
| Q5 | Expected traffic source? | Social media, Ads, SEO, Email |

### 3.6 Survey Storage & AI Usage

```typescript
// POST /v1/stores/:storeId/survey — Save onboarding survey answers

app.post('/v1/stores/:storeId/survey', authMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const userId = c.get('userId');
  const answers = await c.req.json();

  // Verify store ownership
  const supabase = createServiceClient(c.env);
  const { data: store } = await supabase
    .from('stores')
    .select('id, site_type')
    .eq('id', storeId)
    .eq('user_id', userId)
    .single();

  if (!store) {
    return c.json({ error: 'Store not found' }, 404);
  }

  // Upsert survey answers (JSONB — can be updated later from Settings)
  const { error } = await supabase
    .from('store_surveys')
    .upsert({
      store_id: storeId,
      site_type: store.site_type,
      answers,  // Full JSONB object with all 5 Q&A pairs
      completed_at: new Date().toISOString(),
    });

  if (error) {
    return c.json({ error: 'Failed to save survey' }, 500);
  }

  return c.json({
    success: true,
    redirectUrl: `https://admin.letbuyy.store/${store.subdomain}/dashboard`,
  });
});
```

**How AI Uses Survey Data:**
- Dashboard widget recommendations based on industry/goals
- Template suggestions matching aesthetic preferences
- Content generation prompts enriched with business context
- SEO meta tags pre-generated from survey answers
- Product category suggestions for e-commerce stores

### 3.7 Step 4: Completion

```
┌──────────────────────────────────────────────────┐
│          🎉 Your store is ready!                   │
│                                                    │
│  Store: "StyleHub Fashion"                         │
│  URL: stylehub.letbuyy.store                      │
│  Type: E-commerce Store                            │
│  Trial: 14 days remaining                          │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │ Login Credentials (also emailed to you)       │ │
│  │ Email: user@example.com                       │ │
│  │ Admin: admin.letbuyy.store/stylehub           │ │
│  └──────────────────────────────────────────────┘ │
│                                                    │
│         [Go to Dashboard →]                       │
└──────────────────────────────────────────────────┘
```

### 3.8 Backend Actions Summary

| # | Action | Table/Service | On Failure |
|---|---|---|---|
| 1 | `INSERT INTO stores` (transaction) | `stores` | Rollback all, show error |
| 2 | Set `trial_ends_at = NOW() + 14 days` | `stores` | Part of step 1 |
| 3 | `INSERT INTO ai_credits` (10 free) | `ai_credits` | Non-critical, retry |
| 4 | `INSERT INTO onboarding_attempts` | `onboarding_attempts` | Non-critical, log |
| 5 | Send "Store Created" email | Resend API | Queue for retry |
| 6 | Trigger AI content generation (if opted in) | AI Worker | Non-critical, retry |
| 7 | Create audit log entry | `activity_logs` | Non-critical, log |
| 8 | Redirect → admin onboarding survey | Client-side | Always succeeds |

---

## 4. Trial System Architecture

> **Cross-ref:** [01_Architecture §19 — Subscription & Trial Lifecycle](./01_Architecture.md) | [01_Architecture §5.3 — Cron Jobs](./01_Architecture.md)

### 4.1 Trial Configuration

| Setting | Value | Rationale |
|---|---|---|
| **Trial duration** | 14 days | Industry standard; enough to build a functional site |
| **Features during trial** | Full access (all plan features unlocked) | Let users experience the full platform before deciding |
| **AI credits during trial** | 10 free credits | Allow meaningful AI usage without abuse |
| **Store limit during trial** | 1 store | Prevent resource abuse |
| **Custom domain during trial** | ❌ Not available | Requires paid plan for DNS provisioning costs |
| **Grace period after trial** | 3 days (admin accessible, publishing disabled) | Give users time to upgrade without data loss |
| **Data retention after freeze** | 90 days | Sufficient for undecided users to return |
| **Deletion notice period** | 30 days before purge | GDPR compliance + goodwill |

### 4.2 Trial States & Transitions

```
┌─────────────────────────────────────────────────────────────────────┐
│                     TRIAL LIFECYCLE                                   │
│                                                                       │
│   ACTIVE (Day 1-14)           GRACE (Day 15-17)                      │
│   ┌─────────────────┐         ┌─────────────────┐                    │
│   │ Full access      │ ──────→ │ Admin access     │                   │
│   │ Can publish       │  trial  │ No publishing    │                   │
│   │ Can accept orders │ expires │ No new orders    │                   │
│   │ Trial banner shown│         │ "Expired" banner │                   │
│   └────────┬────────┘         └────────┬────────┘                    │
│            │                           │                              │
│            │ user pays                 │ 3 days pass                  │
│            ▼                           ▼                              │
│   ┌─────────────────┐         ┌─────────────────┐                    │
│   │ PAID             │ ←────── │ FROZEN           │                   │
│   │ Full access       │  user   │ Billing page only│                   │
│   │ Plan enforced     │  pays   │ "Coming Soon"    │                   │
│   │ No trial banner   │         │ Data preserved   │                   │
│   └─────────────────┘         └────────┬────────┘                    │
│                                         │                              │
│                                         │ 90 days pass                 │
│                                         ▼                              │
│                                ┌─────────────────┐                    │
│                                │ CANCELLED         │                   │
│                                │ Deletion scheduled │                   │
│                                │ 30-day notice      │                   │
│                                │ Can still reactivate│                  │
│                                └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 Database Schema (`stores` Table — Full)

> **Source:** [01_Architecture §4.2](./01_Architecture.md)

```sql
-- Core stores table with trial fields
CREATE TABLE stores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name     TEXT NOT NULL,
  subdomain      TEXT NOT NULL UNIQUE,
  site_type      TEXT NOT NULL CHECK (site_type IN ('store','portfolio','resume','blog','landing')),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','published','frozen','cancelled')),
  trial_status   TEXT NOT NULL DEFAULT 'active'
                   CHECK (trial_status IN ('active','grace','frozen','cancelled','paid')),
  
  -- Trial timestamps
  trial_started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  trial_ends_at     TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  grace_ends_at     TIMESTAMPTZ,  -- Set when trial expires → now() + 3 days
  frozen_at         TIMESTAMPTZ,  -- Set when grace period ends
  cancelled_at      TIMESTAMPTZ,  -- Set when 90 days frozen
  published_at      TIMESTAMPTZ,  -- Set when user clicks "Publish"
  
  -- Metadata
  category       TEXT,
  industry       TEXT,
  description    TEXT,
  currency       TEXT DEFAULT 'INR',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Performance indexes
CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_trial_status ON stores(trial_status);
CREATE INDEX idx_stores_trial_ends_at ON stores(trial_ends_at) WHERE trial_status = 'active';
CREATE INDEX idx_stores_grace_ends_at ON stores(grace_ends_at) WHERE trial_status = 'grace';

-- RLS policies
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stores"
  ON stores FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own stores"
  ON stores FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own stores"
  ON stores FOR UPDATE USING (auth.uid() = user_id);
```

### 4.4 Supporting Tables

```sql
-- AI Credits
CREATE TABLE ai_credits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  total_credits INT NOT NULL DEFAULT 10,
  used_credits  INT NOT NULL DEFAULT 0,
  plan_credits  INT NOT NULL DEFAULT 0,
  reset_at      TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Onboarding Attempts (analytics)
CREATE TABLE onboarding_attempts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  subdomain   TEXT,
  site_type   TEXT,
  step        TEXT DEFAULT 'store_creation',
  success     BOOLEAN NOT NULL DEFAULT false,
  error_msg   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Store Surveys (JSONB — site-type-specific answers)
CREATE TABLE store_surveys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
  site_type     TEXT NOT NULL,
  answers       JSONB NOT NULL DEFAULT '{}',
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Subscriptions
CREATE TABLE subscriptions (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   UUID NOT NULL REFERENCES auth.users(id),
  store_id                  UUID NOT NULL REFERENCES stores(id),
  plan_id                   UUID NOT NULL REFERENCES plans(id),
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active','past_due','cancelled','paused')),
  billing_cycle             TEXT NOT NULL CHECK (billing_cycle IN ('monthly','annual')),
  payment_provider          TEXT NOT NULL CHECK (payment_provider IN ('razorpay','stripe')),
  external_subscription_id  TEXT,
  current_period_start      TIMESTAMPTZ NOT NULL,
  current_period_end        TIMESTAMPTZ NOT NULL,
  cancelled_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Plans
CREATE TABLE plans (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE CHECK (slug IN ('free','starter','business','enterprise')),
  name        TEXT NOT NULL,
  price_monthly_usd  INT NOT NULL,  -- cents
  price_annual_usd   INT NOT NULL,  -- cents
  price_monthly_inr  INT NOT NULL,  -- paise
  price_annual_inr   INT NOT NULL,  -- paise
  features    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.5 Trial Cron Jobs (Supabase pg_cron)

> **Source:** [01_Architecture §5.3](./01_Architecture.md) — Automated trial lifecycle management

```sql
-- Run every hour: ACTIVE → GRACE when trial expires
SELECT cron.schedule('trial-to-grace', '0 * * * *', $$
  UPDATE stores
  SET trial_status = 'grace',
      grace_ends_at = now() + INTERVAL '3 days',
      updated_at = now()
  WHERE trial_status = 'active'
    AND trial_ends_at <= now();
$$);

-- Run every hour: GRACE → FROZEN when grace period expires
SELECT cron.schedule('grace-to-frozen', '0 * * * *', $$
  UPDATE stores
  SET trial_status = 'frozen',
      status = 'frozen',
      frozen_at = now(),
      updated_at = now()
  WHERE trial_status = 'grace'
    AND grace_ends_at <= now();
$$);

-- Run daily: FROZEN → CANCELLED after 90 days
SELECT cron.schedule('frozen-to-cancelled', '0 3 * * *', $$
  UPDATE stores
  SET trial_status = 'cancelled',
      status = 'cancelled',
      cancelled_at = now(),
      updated_at = now()
  WHERE trial_status = 'frozen'
    AND frozen_at <= now() - INTERVAL '90 days';
$$);

-- Run daily: Purge CANCELLED stores after 30-day notice period
SELECT cron.schedule('purge-cancelled', '0 4 * * *', $$
  DELETE FROM stores
  WHERE trial_status = 'cancelled'
    AND cancelled_at <= now() - INTERVAL '30 days';
$$);
```

### 4.6 Trial Enforcement Middleware (TypeScript)

```typescript
// workers/api/src/middleware/trialCheck.ts

export const trialCheckMiddleware = () => async (c: Context, next: Next) => {
  const storeId = c.req.param('storeId') || c.get('storeId');
  if (!storeId) return next();

  const supabase = createServiceClient(c.env);
  const { data: store } = await supabase
    .from('stores')
    .select('trial_status, trial_ends_at, status')
    .eq('id', storeId)
    .single();

  if (!store) return c.json({ error: 'Store not found' }, 404);

  // Paid users → pass through
  if (store.trial_status === 'paid') return next();

  // Active trial → pass through with days remaining
  if (store.trial_status === 'active') {
    c.set('trialDaysRemaining', Math.ceil(
      (new Date(store.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));
    return next();
  }

  // Grace period → allow reads, block mutations (except billing)
  if (store.trial_status === 'grace') {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
      if (c.req.path.includes('/billing') || c.req.path.includes('/payments')) {
        return next();
      }
      return c.json({
        error: 'Trial expired. Please select a plan to continue.',
        trialStatus: 'grace',
        upgradeUrl: `/billing`,
      }, 403);
    }
    return next();
  }

  // Frozen → only billing page
  if (store.trial_status === 'frozen') {
    if (c.req.path.includes('/billing') || c.req.path.includes('/payments')) {
      return next();
    }
    return c.json({
      error: 'Store frozen. Select a plan to reactivate.',
      trialStatus: 'frozen',
      upgradeUrl: `/billing`,
    }, 403);
  }

  // Cancelled
  return c.json({
    error: 'Store cancelled. Contact support to restore.',
    trialStatus: 'cancelled',
  }, 410);
};

---

## 5. Trial Countdown UI

> **Cross-ref:** Uses Zustand store (see [01_Architecture §3.4 — Client State](./01_Architecture.md))

### 5.1 Persistent Top Banner (In Dashboard)

**Active Trial (Days 1–11) — Informational (Blue):**
```
┌──────────────────────────────────────────────────┐
│ ⏰ 12 days left in your free trial     [Choose Plan →] │
└──────────────────────────────────────────────────┘
```

**Urgent (Days 12–14) — Warning (Amber):**
```
┌──────────────────────────────────────────────────────┐
│ ⚠️ Only 2 days left! Choose a plan to keep your store │
│    running.           [Choose Plan →] [Compare Plans] │
└──────────────────────────────────────────────────────┘
```

**Grace Period — Critical (Red):**
```
┌──────────────────────────────────────────────────────┐
│ 🔴 Your trial has expired. Your store will be frozen  │
│    in 2 days. Select a plan to continue.              │
│                 [Select Plan Now →]                    │
└──────────────────────────────────────────────────────┘
```

**Frozen — Blocking (Dark Red + Overlay):**
```
┌──────────────────────────────────────────────────────┐
│ ❄️ Your store is frozen. Select a plan to reactivate. │
│    Your data is preserved for 90 days.                │
│                 [Reactivate Store →]                   │
└──────────────────────────────────────────────────────┘
```

### 5.2 React Trial Banner Component

```tsx
// apps/web/admin/components/TrialBanner.tsx

'use client';

import { useTrialStore } from '@/stores/trialStore';
import { cn } from '@/lib/utils';

const BANNER_VARIANTS = {
  active:  { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', icon: '⏰' },
  urgent:  { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', icon: '⚠️' },
  grace:   { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', icon: '🔴' },
  frozen:  { bg: 'bg-red-100 dark:bg-red-950/50', border: 'border-red-300 dark:border-red-700', icon: '❄️' },
} as const;

export function TrialBanner() {
  const { trialStatus, daysRemaining, trialEndsAt } = useTrialStore();

  // Paid users → no banner
  if (trialStatus === 'paid') return null;

  const variant =
    trialStatus === 'frozen' ? 'frozen' :
    trialStatus === 'grace' ? 'grace' :
    daysRemaining <= 3 ? 'urgent' : 'active';

  const style = BANNER_VARIANTS[variant];

  const message =
    trialStatus === 'frozen'
      ? 'Your store is frozen. Select a plan to reactivate. Data preserved for 90 days.'
      : trialStatus === 'grace'
      ? 'Your trial has expired. Store will be frozen soon.'
      : daysRemaining <= 3
      ? `Only ${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} left! Choose a plan.`
      : `${daysRemaining} days left in your free trial.`;

  return (
    <div className={cn(
      'px-4 py-3 border-b flex items-center justify-between',
      style.bg, style.border
    )}>
      <span className="text-sm font-medium">
        {style.icon} {message}
      </span>
      <a
        href="/billing"
        className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
      >
        {trialStatus === 'frozen' ? 'Reactivate Store →' : 'Choose Plan →'}
      </a>
    </div>
  );
}
```

### 5.3 Zustand Trial Store

```typescript
// apps/web/admin/stores/trialStore.ts

import { create } from 'zustand';

interface TrialState {
  trialStatus: 'active' | 'grace' | 'frozen' | 'cancelled' | 'paid';
  daysRemaining: number;
  trialEndsAt: string | null;
  graceEndsAt: string | null;
  setTrialData: (data: Partial<TrialState>) => void;
}

export const useTrialStore = create<TrialState>((set) => ({
  trialStatus: 'active',
  daysRemaining: 14,
  trialEndsAt: null,
  graceEndsAt: null,
  setTrialData: (data) => set(data),
}));

// Hydrate from server on dashboard load
export async function hydrateTrialStore(storeId: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from('stores')
    .select('trial_status, trial_ends_at, grace_ends_at')
    .eq('id', storeId)
    .single();

  if (data) {
    const daysRemaining = Math.max(0, Math.ceil(
      (new Date(data.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    ));
    useTrialStore.getState().setTrialData({
      trialStatus: data.trial_status,
      daysRemaining,
      trialEndsAt: data.trial_ends_at,
      graceEndsAt: data.grace_ends_at,
    });
  }
}
```

### 5.4 Dashboard Widget

```
┌──────────────────────────────────┐
│       Trial Status               │
│                                  │
│    ┌────────────────────┐        │
│    │  12 days remaining │        │
│    │  ██████████░░░░░░  │        │
│    │  (86% remaining)   │        │
│    └────────────────────┘        │
│                                  │
│  Started: Feb 14, 2026           │
│  Expires: Feb 28, 2026           │
│                                  │
│  Features unlocked: All          │
│  AI Credits: 7/10 remaining      │
│                                  │
│  [View Plans] [Upgrade Now]      │
└──────────────────────────────────┘
```

```

---

## 6. Payment & Plan Selection

> **Cross-ref:** [01_Architecture §19.3 — Plan Limits](./01_Architecture.md) | [01_Architecture §19.4 — Payment Gateway Integration](./01_Architecture.md)

### 6.1 Plan Comparison Table

| Feature | Free | Starter | Business | Enterprise |
|---|---|---|---|---|
| **Monthly Price** | $0 | $9/mo | $29/mo | $99/mo |
| **Annual Price** | $0 | $86/yr (20% off) | $278/yr (20% off) | $950/yr (20% off) |
| **Stores** | 1 | 3 | 10 | Unlimited |
| **Products/Projects** | 10 | 100 | 1,000 | Unlimited |
| **Blog Posts** | 5 | 50 | 500 | Unlimited |
| **AI Credits/month** | 10 | 50 | 200 | 1,000 |
| **Custom Domain** | ❌ | ✅ | ✅ | ✅ |
| **SSL Certificate** | Shared | Dedicated | Dedicated | Dedicated |
| **Transaction Fee** | 2% | 1% | 0% | 0% |
| **Storage** | 500 MB | 5 GB | 25 GB | 100 GB |
| **Team Members** | 1 | 3 | 10 | Unlimited |
| **Priority Support** | ❌ | ❌ | ✅ | ✅ + Dedicated |
| **Analytics** | Basic | Standard | Advanced | Advanced + API |
| **API Access** | ❌ | ❌ | ✅ | ✅ |
| **White Label** | ❌ | ❌ | ❌ | ✅ |

### 6.2 PLAN_LIMITS TypeScript Constant

> **Source:** [01_Architecture §19.3](./01_Architecture.md) — Enforced by API middleware on every request

```typescript
// packages/constants/src/plans.ts

export const PLAN_LIMITS = {
  free: {
    stores: 1, products: 10, blogPosts: 5, aiCredits: 10,
    storage: 500 * 1024 * 1024,  // 500 MB
    teamMembers: 1, customDomain: false, transactionFee: 0.02,
    apiAccess: false, whiteLabel: false,
  },
  starter: {
    stores: 3, products: 100, blogPosts: 50, aiCredits: 50,
    storage: 5 * 1024 * 1024 * 1024,  // 5 GB
    teamMembers: 3, customDomain: true, transactionFee: 0.01,
    apiAccess: false, whiteLabel: false,
  },
  business: {
    stores: 10, products: 1000, blogPosts: 500, aiCredits: 200,
    storage: 25 * 1024 * 1024 * 1024,  // 25 GB
    teamMembers: 10, customDomain: true, transactionFee: 0,
    apiAccess: true, whiteLabel: false,
  },
  enterprise: {
    stores: Infinity, products: Infinity, blogPosts: Infinity, aiCredits: 1000,
    storage: 100 * 1024 * 1024 * 1024,  // 100 GB
    teamMembers: Infinity, customDomain: true, transactionFee: 0,
    apiAccess: true, whiteLabel: true,
  },
} as const;

export type PlanSlug = keyof typeof PLAN_LIMITS;
```

### 6.3 Plan Selection Modal UI

```
┌──────────────────────────────────────────────────────┐
│              Choose Your Plan                         │
│                                                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────┐ │
│  │  FREE    │  │ STARTER  │  │ BUSINESS │  │ENTER-│ │
│  │  $0/mo   │  │  $9/mo   │  │  $29/mo  │  │PRISE │ │
│  │          │  │          │  │  ⭐ Best  │  │$99/mo│ │
│  │ 1 site   │  │ 3 sites  │  │ 10 sites │  │Unlim │ │
│  │ 10 prod  │  │ 100 prod │  │ 1K prod  │  │Unlim │ │
│  │ 10 AI/mo │  │ 50 AI/mo │  │ 200AI/mo │  │1K AI │ │
│  │ 2% fee   │  │ 1% fee   │  │ 0% fee   │  │0% fee│ │
│  │ No domain│  │ ✅ Domain │  │ ✅ Domain │  │✅ Dom │ │
│  │          │  │          │  │          │  │      │ │
│  │ [Select] │  │ [Select] │  │ [Select] │  │[Talk]│ │
│  └──────────┘  └──────────┘  └──────────┘  └──────┘ │
│                                                       │
│  💳 Billing: [Monthly ▼]   [Annual — Save 20%]       │
└──────────────────────────────────────────────────────┘
```

### 6.4 Payment Gateway Integration

> **Source:** [01_Architecture §19.4](./01_Architecture.md)

```
User selects plan
    │
    ├── Region detection (navigator.language / IP geolocation)
    │   ├── India (IN) → Razorpay
    │   └── Other → Stripe
    │
    ├── Razorpay Flow (India):
    │   ├── POST /v1/payments/razorpay/create-order
    │   │     Body: { planSlug, billingCycle, storeId }
    │   │     Returns: { orderId, amount, currency: 'INR' }
    │   ├── Open Razorpay checkout modal (client-side SDK)
    │   │     Supports: UPI, Cards, NetBanking, Wallets
    │   ├── POST /v1/payments/razorpay/verify
    │   │     Body: { orderId, paymentId, signature }
    │   │     Backend verifies HMAC-SHA256 signature
    │   └── Success → activate subscription
    │
    └── Stripe Flow (Global):
        ├── POST /v1/payments/stripe/create-checkout
        │     Body: { planSlug, billingCycle, storeId }
        │     Returns: { sessionUrl }
        ├── Redirect to Stripe Checkout (hosted page)
        │     Supports: Cards, Apple Pay, Google Pay
        ├── POST /v1/payments/stripe/webhook (async)
        │     Event: checkout.session.completed
        │     Backend verifies Stripe signature
        └── Success → activate subscription
```

### 6.5 Razorpay Payment Handler

```typescript
// workers/api/src/routes/payments/razorpay.ts

app.post('/v1/payments/razorpay/create-order', authMiddleware(), async (c) => {
  const { planSlug, billingCycle, storeId } = await c.req.json();
  
  if (!PLAN_LIMITS[planSlug as PlanSlug]) {
    return c.json({ error: 'Invalid plan' }, 400);
  }

  // INR pricing
  const prices: Record<string, { monthly: number; annual: number }> = {
    starter:    { monthly: 749,  annual: 7149 },   // ≈ $9/mo
    business:   { monthly: 2399, annual: 22949 },  // ≈ $29/mo
    enterprise: { monthly: 8199, annual: 78599 },  // ≈ $99/mo
  };

  const amount = prices[planSlug]?.[billingCycle as 'monthly' | 'annual'];
  if (!amount) return c.json({ error: 'Invalid billing config' }, 400);

  const razorpay = new Razorpay({
    key_id: c.env.RAZORPAY_KEY_ID,
    key_secret: c.env.RAZORPAY_KEY_SECRET,
  });

  const order = await razorpay.orders.create({
    amount: amount * 100,  // Paise
    currency: 'INR',
    receipt: `${storeId}_${planSlug}_${Date.now()}`,
    notes: { storeId, planSlug, billingCycle },
  });

  return c.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: c.env.RAZORPAY_KEY_ID,
  });
});
```

### 6.6 Stripe Checkout Handler

```typescript
// workers/api/src/routes/payments/stripe.ts

app.post('/v1/payments/stripe/create-checkout', authMiddleware(), async (c) => {
  const { planSlug, billingCycle, storeId } = await c.req.json();
  const userId = c.get('userId');

  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  // Map plan slug → Stripe price ID
  const priceIds: Record<string, Record<string, string>> = {
    starter:    { monthly: c.env.STRIPE_PRICE_STARTER_M,    annual: c.env.STRIPE_PRICE_STARTER_A },
    business:   { monthly: c.env.STRIPE_PRICE_BUSINESS_M,   annual: c.env.STRIPE_PRICE_BUSINESS_A },
    enterprise: { monthly: c.env.STRIPE_PRICE_ENTERPRISE_M, annual: c.env.STRIPE_PRICE_ENTERPRISE_A },
  };

  const priceId = priceIds[planSlug]?.[billingCycle];
  if (!priceId) return c.json({ error: 'Invalid plan config' }, 400);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${c.env.ADMIN_URL}/${storeId}/billing?success=true`,
    cancel_url: `${c.env.ADMIN_URL}/${storeId}/billing?cancelled=true`,
    metadata: { userId, storeId, planSlug, billingCycle },
    customer_email: c.get('userEmail'),
  });

  return c.json({ sessionUrl: session.url });
});
```

### 6.7 Post-Payment Subscription Activation

```typescript
// workers/api/src/services/subscription.ts

export async function activateSubscription(
  supabase: SupabaseClient,
  env: Env,
  params: {
    userId: string;
    storeId: string;
    planSlug: PlanSlug;
    billingCycle: 'monthly' | 'annual';
    paymentProvider: 'razorpay' | 'stripe';
    externalSubscriptionId: string;
  }
) {
  const { userId, storeId, planSlug, billingCycle, paymentProvider, externalSubscriptionId } = params;

  // 1. Get plan ID
  const { data: plan } = await supabase
    .from('plans').select('id').eq('slug', planSlug).single();

  // 2. Create subscription record
  const periodEnd = billingCycle === 'annual'
    ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await supabase.from('subscriptions').insert({
    user_id: userId,
    store_id: storeId,
    plan_id: plan!.id,
    status: 'active',
    billing_cycle: billingCycle,
    payment_provider: paymentProvider,
    external_subscription_id: externalSubscriptionId,
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd.toISOString(),
  });

  // 3. Update store trial status → paid
  await supabase
    .from('stores')
    .update({ trial_status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', storeId);

  // 4. Allocate plan AI credits
  const limits = PLAN_LIMITS[planSlug];
  await supabase
    .from('ai_credits')
    .update({ plan_credits: limits.aiCredits, used_credits: 0 })
    .eq('store_id', storeId);

  // 5. Send confirmation email
  await sendEmail(env, {
    to: userId,
    template: 'subscription-activated',
    data: { planSlug, billingCycle, storeId },
  });
}
```

---

## 7. Store Activation & Publishing

> **Cross-ref:** [00_Overview §9 — "Launching Soon" Page](./00_Overview.md) | [01_Architecture §16.5 — DNS Provisioning](./01_Architecture.md)

### 7.1 Pre-Publishing Checklist (Site-Type-Specific)

| Check | Store | Portfolio | Resume | Blog | Landing |
|---|:---:|:---:|:---:|:---:|:---:|
| Store name set | ✅ | ✅ | ✅ | ✅ | ✅ |
| At least 1 product/project/post | ✅ | ✅ | — | ✅ | — |
| Payment gateway configured | ✅ | — | — | — | — |
| Shipping configured (if physical) | ✅ | — | — | — | — |
| At least 1 page built | — | — | — | — | ✅ |
| Contact info set | — | ✅ | ✅ | — | — |
| Active subscription OR trial | ✅ | ✅ | ✅ | ✅ | ✅ |
| No pending policy violations | ✅ | ✅ | ✅ | ✅ | ✅ |

### 7.2 Publish Handler (TypeScript)

```typescript
// workers/api/src/routes/stores/publish.ts

app.post('/v1/stores/:storeId/publish', authMiddleware(), trialCheckMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const userId = c.get('userId');
  const supabase = createServiceClient(c.env);

  // 1. Verify ownership
  const { data: store } = await supabase
    .from('stores')
    .select('*, store_surveys(*)')
    .eq('id', storeId)
    .eq('user_id', userId)
    .single();

  if (!store) return c.json({ error: 'Store not found' }, 404);

  // 2. Run pre-publish checks
  const checks = await runPrePublishChecks(supabase, store);
  if (checks.errors.length > 0) {
    return c.json({ error: 'Pre-publish checks failed', checks: checks.errors }, 400);
  }

  // 3. Update store status → published
  await supabase
    .from('stores')
    .update({
      status: 'published',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);

  // 4. Trigger ISR revalidation on Vercel
  await fetch(`${c.env.STOREFRONT_URL}/api/revalidate`, {
    method: 'POST',
    headers: { 'x-revalidation-secret': c.env.REVALIDATION_SECRET },
    body: JSON.stringify({ subdomain: store.subdomain }),
  });

  // 5. Send "Store Published" email
  await sendEmail(c.env, {
    to: c.get('userEmail'),
    template: 'store-published',
    data: {
      storeName: store.store_name,
      storeUrl: `https://${store.subdomain}.letbuyy.store`,
    },
  });

  // 6. Audit log
  await logActivity(c.env, {
    action: 'store_published', userId, storeId,
    metadata: { subdomain: store.subdomain },
  });

  return c.json({
    success: true,
    storeUrl: `https://${store.subdomain}.letbuyy.store`,
  });
});
```

### 7.3 DNS Architecture (Wildcard Subdomain)

> **Source:** [01_Architecture §16.5](./01_Architecture.md)

```
┌─────────────────────────────────────────────────────────────┐
│                    DNS RESOLUTION FLOW                        │
│                                                               │
│  User visits: mystore.letbuyy.store                          │
│       │                                                       │
│       ▼  DNS Resolution                                       │
│  *.letbuyy.store → CNAME → cname.vercel-dns.com             │
│       │                                                       │
│       ▼  Vercel Edge Network                                  │
│  vercel.json rewrites:                                        │
│    *.letbuyy.store/* → apps/web/storefront                   │
│       │                                                       │
│       ▼  Next.js Middleware (storefront)                      │
│  middleware.ts:                                                │
│    1. Extract subdomain from host header                      │
│    2. Query Supabase: stores.findBySubdomain(subdomain)      │
│    3. Store NOT found? → 404 page                            │
│    4. Store status = 'draft'? → "Launching Soon" page        │
│    5. Store status = 'frozen'? → "Coming Soon" page          │
│    6. Store status = 'published'? → Render storefront        │
│       │                                                       │
│       ▼  ISR (Incremental Static Regeneration)               │
│  Revalidate every 60 seconds                                  │
│  CDN cached at edge (Vercel Edge Network)                    │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 "Launching Soon" Page (Draft Stores)

> **Source:** [00_Overview §9](./00_Overview.md)

When a store is created but not yet published (`status = 'draft'`), visitors see:

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│              ┌─────────────┐                          │
│              │   [Logo]     │                          │
│              │  LetBuyy     │                          │
│              └─────────────┘                          │
│                                                       │
│          ✨ StyleHub Fashion ✨                        │
│                                                       │
│       🚀 We're launching soon!                        │
│                                                       │
│    Something amazing is in the works.                 │
│    Get notified when we go live.                      │
│                                                       │
│    📧 [Enter your email_____________]                 │
│       [Notify Me →]                                   │
│                                                       │
│    ┌──────────────────────────────────┐               │
│    │  Follow us:                      │               │
│    │  [Instagram] [Twitter] [TikTok]  │               │
│    └──────────────────────────────────┘               │
│                                                       │
│    Powered by LetBuyy                                 │
└──────────────────────────────────────────────────────┘
```

**Features:**
- Auto-populated with store name from DB
- Collects email subscribers (`launch_subscribers` table)
- Social links from onboarding survey
- SEO: `<title>{storeName} – Coming Soon</title>`
- Auto-generated OpenGraph image
- Responsive (mobile-first)

---

## 8. Reactivation Flow

> **Cross-ref:** [01_Architecture §19.2 — Subscription State Machine](./01_Architecture.md)

### 8.1 Frozen Store Reactivation

```
User visits admin.letbuyy.store/{frozen-store}
    │
    ├── 1. Only billing page accessible
    │       └── All other routes redirect to /billing
    │
    ├── 2. Show reactivation options
    │       ├── Select plan (same flow as §6)
    │       └── "Your data is preserved" reassurance message
    │
    ├── 3. Complete payment (Razorpay / Stripe)
    │
    └── 4. Reactivation sequence:
            ├── stores.status → 'published' (if was published before)
            ├── stores.trial_status → 'paid'
            ├── stores.frozen_at → NULL
            ├── Create subscription record
            ├── Allocate plan AI credits
            ├── Storefront goes live again (ISR revalidation)
            └── "Welcome back" email sent
```

### 8.2 Reactivation Handler

```typescript
// workers/api/src/routes/stores/reactivate.ts

app.post('/v1/stores/:storeId/reactivate', authMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const userId = c.get('userId');
  const supabase = createServiceClient(c.env);

  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', storeId)
    .eq('user_id', userId)
    .in('trial_status', ['frozen', 'cancelled'])
    .single();

  if (!store) return c.json({ error: 'Store not found or not frozen' }, 404);

  // Determine restored status (was it published before freezing?)
  const restoredStatus = store.published_at ? 'published' : 'draft';

  await supabase
    .from('stores')
    .update({
      status: restoredStatus,
      trial_status: 'paid',
      frozen_at: null,
      cancelled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', storeId);

  // Trigger ISR revalidation if previously published
  if (restoredStatus === 'published') {
    await fetch(`${c.env.STOREFRONT_URL}/api/revalidate`, {
      method: 'POST',
      headers: { 'x-revalidation-secret': c.env.REVALIDATION_SECRET },
      body: JSON.stringify({ subdomain: store.subdomain }),
    });
  }

  // Send welcome back email
  await sendEmail(c.env, {
    to: c.get('userEmail'),
    template: 'store-reactivated',
    data: { storeName: store.store_name, subdomain: store.subdomain },
  });

  return c.json({ success: true, status: restoredStatus });
});
```

### 8.3 Cancelled Store Recovery

| Scenario | Action | Data Impact |
|---|---|---|
| **< 90 days frozen** | Direct reactivation via billing | All data intact |
| **90-120 days (cancelled, pre-purge)** | Reactivation still possible | All data intact (30-day notice) |
| **120+ days (after purge)** | Contact support | Data deleted, must start fresh |

---

## 9. AI-Assisted Onboarding

> **Cross-ref:** [01_Architecture §18 — AI Content Generation](./01_Architecture.md)

### 9.1 Smart Site Type Recommendation

When user clicks "Help me choose" during site type selection:

```
AI Questionnaire:
    │
    ├── "What's your primary goal?"
    │   ○ Sell products online         → Store
    │   ○ Showcase my work/projects    → Portfolio
    │   ○ Build a professional profile → Resume
    │   ○ Share articles & content     → Blog
    │   ○ Create a marketing page      → Landing Page
    │
    ├── "What industry are you in?"
    │   [Free text or dropdown]
    │
    ├── "Do you need to accept payments?"
    │   ○ Yes → Store (confirmed)
    │   ○ No  → Portfolio/Resume/Blog/Landing
    │
    └── AI recommends: "Based on your goals, we recommend a
        Portfolio site with Blog features enabled."
        [Accept] [Choose manually]
```

### 9.2 AI Store Name Suggestions

```typescript
// workers/api/src/routes/ai/suggest-name.ts

app.post('/v1/ai/suggest-store-name', authMiddleware(), async (c) => {
  const { siteType, industry, category } = await c.req.json();

  const prompt = `Generate 5 creative, memorable ${siteType} names 
    for a ${industry} business in the ${category} category.
    Requirements:
    - Short (1-3 words)
    - Available as subdomain (.letbuyy.store)
    - Modern and brandable
    - No special characters
    Return as JSON array of strings.`;

  const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
  });

  const suggestions = JSON.parse(response.response);

  // Check subdomain availability for each suggestion
  const available = await Promise.all(
    suggestions.map(async (name: string) => {
      const subdomain = name.toLowerCase().replace(/\s+/g, '');
      const { data } = await supabase
        .from('stores')
        .select('id')
        .eq('subdomain', subdomain)
        .single();
      return { name, subdomain, available: !data };
    })
  );

  return c.json({ suggestions: available.filter(s => s.available) });
});
```

### 9.3 AI Template Matching

The system analyzes user inputs to recommend templates:

| Input | AI Analysis | Template Recommendation |
|---|---|---|
| Industry: Fashion | Visual-first, grid layouts | Minimal gallery, lookbook |
| Industry: Tech Services | Professional, feature-focused | Corporate, SaaS landing |
| Industry: Food & Beverage | Warm colors, menu-style | Restaurant, café |
| Industry: Photography | Full-bleed images, dark mode | Portfolio dark, gallery |
| Industry: Consulting | Trust signals, case studies | Business professional |

### 9.4 AI Content Generation Queue

After store creation with AI opt-in, the system queues content generation jobs:

```typescript
// workers/ai/src/queue/onboarding.ts

interface OnboardingAIJob {
  type: 'onboarding_content';
  storeId: string;
  siteType: string;
  surveyAnswers: Record<string, string>;
  tasks: Array<
    | 'generate_homepage'
    | 'generate_about_page'
    | 'generate_seo_meta'
    | 'generate_product_descriptions'
    | 'generate_logo_suggestions'
  >;
}

// Job processor
export async function processOnboardingAI(job: OnboardingAIJob, env: Env) {
  const { storeId, siteType, surveyAnswers, tasks } = job;

  for (const task of tasks) {
    switch (task) {
      case 'generate_homepage':
        await generateHomepage(env, storeId, siteType, surveyAnswers);
        break;
      case 'generate_seo_meta':
        await generateSEOMeta(env, storeId, surveyAnswers);
        break;
      case 'generate_about_page':
        await generateAboutPage(env, storeId, surveyAnswers);
        break;
      // ... other tasks
    }

    // Deduct AI credit per task
    await env.SUPABASE.from('ai_credits')
      .update({ used_credits: sql`used_credits + 1` })
      .eq('store_id', storeId);
  }
}
```

---

## 10. Email Sequences

> **Cross-ref:** [01_Architecture §17 — Email System (Resend)](./01_Architecture.md)

### 10.1 Onboarding Email Timeline

| Day | Trigger | Email Subject | CTA |
|---|---|---|---|
| 0 | Account created | "Welcome to LetBuyy! 🎉" | Complete your store |
| 0 | Store created | "Your store {name} is ready 🏪" | Go to dashboard |
| 1 | Day 1 | "Add your first {product/project}" | Open admin |
| 3 | Day 3 | "Try AI Studio — create content in seconds" | Open AI Studio |
| 7 | Day 7 | "One week left — try publishing!" | Publish store |
| 10 | Day 10 | "4 days left — here's what you're missing" | View plans |
| 12 | Day 12 | "Trial ending in 2 days ⚠️" | Choose a plan |
| 14 | Day 14 | "Trial expired — 3-day grace period" | Upgrade now |
| 17 | Day 17 | "Last chance — store freezes tomorrow" | Upgrade now |
| 18 | Day 18 | "Store frozen — reactivate anytime ❄️" | Reactivate |
| 48 | Day 48 | "We miss you — 50% off first month" | Claim offer |

### 10.2 Email Template Structure (Resend)

```typescript
// workers/api/src/services/email.ts

import { Resend } from 'resend';

const EMAIL_TEMPLATES = {
  'welcome': {
    subject: 'Welcome to LetBuyy! 🎉',
    template: 'welcome-email',
  },
  'store-created': {
    subject: (data: any) => `Your store "${data.storeName}" is ready! 🏪`,
    template: 'store-created-email',
  },
  'trial-ending': {
    subject: (data: any) => `Only ${data.daysLeft} days left in your trial ⚠️`,
    template: 'trial-ending-email',
  },
  'trial-expired': {
    subject: 'Your trial has expired — 3-day grace period',
    template: 'trial-expired-email',
  },
  'store-frozen': {
    subject: 'Your store has been frozen ❄️',
    template: 'store-frozen-email',
  },
  'store-published': {
    subject: (data: any) => `${data.storeName} is now live! 🚀`,
    template: 'store-published-email',
  },
  'subscription-activated': {
    subject: 'Payment confirmed — subscription active ✅',
    template: 'subscription-activated-email',
  },
  'store-reactivated': {
    subject: (data: any) => `Welcome back! ${data.storeName} is live again 🎉`,
    template: 'store-reactivated-email',
  },
} as const;

export async function sendEmail(env: Env, options: {
  to: string;
  template: keyof typeof EMAIL_TEMPLATES;
  data: Record<string, any>;
}) {
  const resend = new Resend(env.RESEND_API_KEY);
  const tmpl = EMAIL_TEMPLATES[options.template];

  const subject = typeof tmpl.subject === 'function'
    ? tmpl.subject(options.data)
    : tmpl.subject;

  await resend.emails.send({
    from: 'LetBuyy <noreply@letbuyy.store>',
    to: options.to,
    subject,
    react: renderTemplate(tmpl.template, options.data),
  });
}
```

### 10.3 Trial Reminder Cron (Email Triggers)

```sql
-- Daily cron: Send trial reminder emails
SELECT cron.schedule('trial-email-reminders', '0 9 * * *', $$
  -- Day 7 reminder
  SELECT notify_trial_email(id, 'day-7')
  FROM stores
  WHERE trial_status = 'active'
    AND trial_started_at::date = (CURRENT_DATE - INTERVAL '7 days')::date;

  -- Day 12 reminder (urgent)
  SELECT notify_trial_email(id, 'day-12')
  FROM stores
  WHERE trial_status = 'active'
    AND trial_started_at::date = (CURRENT_DATE - INTERVAL '12 days')::date;

  -- Grace period daily reminder
  SELECT notify_trial_email(id, 'grace-reminder')
  FROM stores
  WHERE trial_status = 'grace';
$$);
```

### 10.4 Email Design Standards

All emails use branded React Email templates with:

| Feature | Implementation |
|---|---|
| **Branding** | LetBuyy logo + gradient accent colors |
| **Layout** | Responsive, mobile-first (600px max-width) |
| **Dark mode** | `@media (prefers-color-scheme: dark)` support |
| **Unsubscribe** | One-click unsubscribe link (CAN-SPAM compliant) |
| **Tracking** | UTM parameters on all CTAs |
| **Personalization** | Store name, user name, trial days remaining |
| **Deliverability** | SPF, DKIM, DMARC configured on letbuyy.store |
| **Preview text** | Custom preview text for email clients |

---

## 11. Onboarding Analytics & Tracking

### 11.1 Events Tracked

| Event | Payload | Purpose |
|---|---|---|
| `signup_started` | `{ method, source }` | Funnel tracking |
| `signup_completed` | `{ userId, method, duration }` | Conversion rate |
| `store_creation_started` | `{ siteType }` | Site type popularity |
| `subdomain_checked` | `{ subdomain, available }` | Name availability patterns |
| `store_created` | `{ storeId, siteType, subdomain }` | Creation success rate |
| `survey_completed` | `{ storeId, siteType }` | Survey completion rate |
| `trial_day_X` | `{ storeId, actions_taken }` | Engagement tracking |
| `plan_viewed` | `{ storeId, planSlug }` | Plan interest |
| `payment_started` | `{ planSlug, provider }` | Payment funnel |
| `payment_completed` | `{ planSlug, amount, provider }` | Revenue tracking |
| `store_published` | `{ storeId }` | Activation rate |
| `store_frozen` | `{ storeId, trialDuration }` | Churn tracking |
| `store_reactivated` | `{ storeId, frozenDays }` | Win-back rate |

### 11.2 Funnel Metrics

```
Signup Started  →  Signup Completed  →  Store Created  →  Store Published  →  Paid
   100%                85%                 72%               45%              22%
```

**Key metrics monitored:**
- **Time to first store:** Average time from signup to store creation
- **Time to publish:** Average time from store creation to first publish
- **Trial conversion rate:** % of trial users who convert to paid
- **Day-N retention:** % of users who return on day N after signup
- **Churn rate:** % of paid users who cancel per month
- **ARPU:** Average revenue per user per month

### 11.3 Activity Logging

```typescript
// workers/api/src/services/activity.ts

export async function logActivity(env: Env, event: {
  action: string;
  userId: string;
  storeId?: string;
  metadata?: Record<string, any>;
}) {
  await env.SUPABASE
    .from('activity_logs')
    .insert({
      action: event.action,
      user_id: event.userId,
      store_id: event.storeId,
      metadata: event.metadata || {},
      ip_address: null,  // Anonymized for privacy
      created_at: new Date().toISOString(),
    });
}
```

---

## 12. Error Handling & Recovery

### 12.1 Onboarding Error States

| Error | Cause | User Experience | Recovery |
|---|---|---|---|
| **Subdomain taken** | Race condition | Inline error + suggestions | Auto-suggest alternatives |
| **Store creation failed** | DB transaction error | Error modal + retry button | Automatic retry (3x) |
| **Payment failed** | Card declined / UPI timeout | Payment error page | Retry with different method |
| **Email not delivered** | Resend API failure | Silent (non-critical) | Queue for retry (exponential backoff) |
| **AI generation failed** | AI worker timeout | "AI is busy" toast | Manual retry button |
| **DNS propagation delay** | Cloudflare cache | "Propagating..." banner | Auto-retry every 30s |
| **Survey save failed** | Network error | Toast notification | Auto-save on reconnect |

### 12.2 Retry Strategy

```typescript
// packages/utils/src/retry.ts

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000, maxDelay = 10000 } = options;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Unreachable');
}
```

### 12.3 Graceful Degradation

| Feature | Degraded Mode | User Impact |
|---|---|---|
| AI Name Suggestions | Show empty input field | User types manually |
| AI Template Matching | Show all templates | User browses all options |
| Email delivery | Queue for later | User misses non-critical email |
| Analytics tracking | Skip event | No user impact |
| Survey storage | Local storage fallback | Auto-sync when DB available |

---

## 13. Security Considerations

> **Cross-ref:** [02_Authentication_and_Security §6 — Rate Limiting](./02_Authentication_and_Security.md)

### 13.1 Onboarding-Specific Security

| Threat | Mitigation |
|---|---|
| **Bot signup abuse** | Turnstile verification on signup form |
| **Disposable emails** | Blocklist of 10,000+ disposable domains |
| **Subdomain squatting** | Inactive stores auto-purged; blocklist of reserved names |
| **Payment fraud** | Razorpay signature verification; Stripe webhook signatures |
| **Trial abuse** | 1 store per trial; email verification required |
| **Rate limit bypass** | IP + email-based rate limiting via Redis |
| **XSS in store names** | Server-side sanitization + CSP headers |
| **SQL injection** | Parameterized queries (Supabase client handles this) |

### 13.2 Rate Limits (Onboarding Endpoints)

| Endpoint | Limit | Window | Key |
|---|---|---|---|
| `POST /v1/auth/signup` | 5 | 15 min | IP |
| `POST /v1/auth/otp/verify` | 10 | 15 min | Email |
| `POST /v1/stores/create` | 3 | 1 hour | User ID |
| `POST /v1/ai/suggest-store-name` | 10 | 1 hour | User ID |
| `POST /v1/payments/*/create-*` | 5 | 15 min | User ID |
| `GET /v1/stores/check-subdomain` | 20 | 1 min | IP |

### 13.3 Data Validation Summary

| Field | Validation | Location |
|---|---|---|
| Email | RFC 5322 + disposable check | Frontend + Backend |
| Password | 8+ chars, 1 uppercase, 1 number | Frontend + Backend |
| OTP | Exactly 6 digits | Frontend + Backend |
| Store name | 2-64 chars, no profanity | Frontend + Backend |
| Subdomain | `^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$` + blocklist | Frontend + Backend |
| Survey answers | JSONB, max 5 keys, 500 chars each | Backend only |
| Plan slug | Enum: free, starter, business, enterprise | Backend only |

---

## 14. Accessibility (a11y)

### 14.1 Onboarding a11y Requirements

| Requirement | Implementation |
|---|---|
| **Keyboard navigation** | All wizard steps navigable via Tab/Enter/Escape |
| **Screen reader support** | ARIA labels on all form fields and buttons |
| **Focus management** | Auto-focus on first input when step changes |
| **Error announcements** | `aria-live="assertive"` on error messages |
| **Color contrast** | WCAG AA (4.5:1 ratio) on all text |
| **Reduced motion** | Respect `prefers-reduced-motion` media query |
| **Form labels** | Every `<input>` has an associated `<label>` |
| **Skip links** | "Skip to main content" on onboarding pages |

### 14.2 Progress Indicator

```tsx
// Accessible step indicator
<nav aria-label="Onboarding progress">
  <ol className="flex gap-2">
    {steps.map((step, i) => (
      <li
        key={step.id}
        aria-current={i === currentStep ? 'step' : undefined}
        aria-label={`Step ${i + 1}: ${step.label}, ${
          i < currentStep ? 'completed' :
          i === currentStep ? 'current' : 'upcoming'
        }`}
      >
        <span className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center',
          i < currentStep ? 'bg-green-500' :
          i === currentStep ? 'bg-blue-500' : 'bg-gray-300'
        )}>
          {i < currentStep ? '✓' : i + 1}
        </span>
      </li>
    ))}
  </ol>
</nav>
```

---

## 15. Internationalization (i18n)

### 15.1 Supported Languages

| Language | Code | Status | Coverage |
|---|---|---|---|
| English | `en` | ✅ Default | 100% |
| Hindi | `hi` | 🔜 Planned | — |
| Tamil | `ta` | 🔜 Planned | — |
| Telugu | `te` | 🔜 Planned | — |
| Spanish | `es` | 🔜 Planned | — |

### 15.2 Currency Localization

| Region | Currency | Symbol | Payment Gateway |
|---|---|---|---|
| India | INR | ₹ | Razorpay |
| USA | USD | $ | Stripe |
| EU | EUR | € | Stripe |
| UK | GBP | £ | Stripe |

### 15.3 i18n Implementation

```typescript
// packages/i18n/src/onboarding.ts

export const onboardingStrings = {
  en: {
    'onboarding.welcome': 'Welcome to LetBuyy!',
    'onboarding.site_type.title': 'What would you like to build?',
    'onboarding.site_type.store': 'Online Store',
    'onboarding.site_type.portfolio': 'Portfolio',
    'onboarding.site_type.resume': 'Resume / CV',
    'onboarding.site_type.blog': 'Blog',
    'onboarding.site_type.landing': 'Landing Page',
    'onboarding.subdomain.label': 'Choose your subdomain',
    'onboarding.subdomain.available': 'Available!',
    'onboarding.subdomain.taken': 'Already taken',
    'trial.days_remaining': '{days} days left in your free trial',
    'trial.expired': 'Your trial has expired',
    'trial.frozen': 'Your store is frozen',
  },
} as const;
```

---

## 16. Performance Optimizations

### 16.1 Onboarding Page Load

| Metric | Target | Strategy |
|---|---|---|
| **FCP** | < 1.2s | Static shell + lazy-load wizard steps |
| **LCP** | < 2.0s | Preload critical fonts & images |
| **TTI** | < 3.0s | Code-split wizard steps |
| **CLS** | < 0.05 | Fixed-height step containers |
| **Bundle size** | < 200 KB | Tree-shake unused plan components |

### 16.2 Database Query Optimization

```sql
-- Composite index for fast store lookup during onboarding
CREATE INDEX idx_stores_user_trial
  ON stores(user_id, trial_status)
  WHERE trial_status != 'cancelled';

-- Partial index for subdomain availability checks
CREATE UNIQUE INDEX idx_stores_subdomain_active
  ON stores(subdomain)
  WHERE status != 'cancelled';
```

### 16.3 CDN & Caching Strategy

| Resource | Cache Duration | Cache-Control |
|---|---|---|
| Onboarding static assets | 30 days | `public, max-age=2592000, immutable` |
| Plan pricing API | 5 minutes | `public, max-age=300, s-maxage=300` |
| Subdomain check API | No cache | `no-cache, no-store` |
| AI suggestions API | No cache | `no-cache, no-store` |
| Storefront pages (ISR) | 60 seconds | `s-maxage=60, stale-while-revalidate` |

---

## 17. Testing Strategy

### 17.1 Unit Tests

```typescript
// __tests__/subdomain.test.ts

describe('Subdomain Validation', () => {
  test('accepts valid subdomains', () => {
    expect(validateSubdomain('mystore')).toBe(true);
    expect(validateSubdomain('my-store-123')).toBe(true);
  });

  test('rejects invalid subdomains', () => {
    expect(validateSubdomain('a')).toBe(false);           // Too short
    expect(validateSubdomain('-mystore')).toBe(false);     // Starts with hyphen
    expect(validateSubdomain('my_store')).toBe(false);     // Underscore
    expect(validateSubdomain('admin')).toBe(false);        // Blocklisted
    expect(validateSubdomain('www')).toBe(false);          // Blocklisted
  });
});

describe('Trial Status Middleware', () => {
  test('allows active trial users', async () => { /* ... */ });
  test('blocks grace period mutations', async () => { /* ... */ });
  test('blocks frozen users except billing', async () => { /* ... */ });
  test('returns 410 for cancelled stores', async () => { /* ... */ });
});
```

### 17.2 Integration Tests

| Test Scenario | Steps | Expected Outcome |
|---|---|---|
| **Happy path signup** | Signup → Create store → Survey → Dashboard | Successful onboarding |
| **Duplicate subdomain** | Create store with taken subdomain | Error + suggestions |
| **Trial expiry** | Fast-forward 14 days | Status → grace |
| **Grace → Frozen** | Fast-forward 3 more days | Status → frozen, admin restricted |
| **Payment flow** | Select plan → Complete payment | Subscription active |
| **Reactivation** | Frozen store → Pay → Reactivate | Store live again |

### 17.3 E2E Tests (Playwright)

```typescript
// e2e/onboarding.spec.ts

test('complete onboarding flow', async ({ page }) => {
  // 1. Signup
  await page.goto('https://accounts.letbuyy.store/signup');
  await page.fill('[name="email"]', 'test@example.com');
  await page.click('button[type="submit"]');
  
  // 2. Verify OTP (mock in test env)
  await page.fill('[name="otp"]', '123456');
  await page.click('button[type="submit"]');
  
  // 3. Set password
  await page.fill('[name="password"]', 'TestPass123!');
  await page.click('button[type="submit"]');
  
  // 4. Create store
  await expect(page).toHaveURL(/\/onboarding/);
  await page.click('[data-site-type="store"]');
  await page.fill('[name="storeName"]', 'TestStore');
  await page.fill('[name="subdomain"]', 'teststore');
  await page.click('button:has-text("Create Store")');
  
  // 5. Complete survey
  await expect(page).toHaveURL(/\/survey/);
  // ... fill survey
  
  // 6. Verify dashboard
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.locator('.trial-banner')).toBeVisible();
});
```

---

## 18. Environment Variables

### 18.1 Required Variables (Onboarding)

| Variable | Service | Description |
|---|---|---|
| `SUPABASE_URL` | Supabase | Database & Auth URL |
| `SUPABASE_ANON_KEY` | Supabase | Client-side anon key |
| `SUPABASE_SERVICE_KEY` | Supabase | Server-side service role key |
| `TURNSTILE_SECRET` | Cloudflare | Turnstile bot verification secret |
| `TURNSTILE_SITE_KEY` | Cloudflare | Turnstile client-side site key |
| `RESEND_API_KEY` | Resend | Email service API key |
| `RAZORPAY_KEY_ID` | Razorpay | Payment gateway key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay | Payment gateway secret |
| `STRIPE_SECRET_KEY` | Stripe | Stripe API secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe | Stripe webhook signing secret |
| `STRIPE_PRICE_STARTER_M` | Stripe | Starter monthly price ID |
| `STRIPE_PRICE_STARTER_A` | Stripe | Starter annual price ID |
| `STRIPE_PRICE_BUSINESS_M` | Stripe | Business monthly price ID |
| `STRIPE_PRICE_BUSINESS_A` | Stripe | Business annual price ID |
| `STRIPE_PRICE_ENTERPRISE_M` | Stripe | Enterprise monthly price ID |
| `STRIPE_PRICE_ENTERPRISE_A` | Stripe | Enterprise annual price ID |
| `ACCOUNTS_URL` | Config | `https://accounts.letbuyy.store` |
| `ADMIN_URL` | Config | `https://admin.letbuyy.store` |
| `STOREFRONT_URL` | Config | `https://letbuyy.store` |
| `REVALIDATION_SECRET` | Vercel | ISR revalidation secret |
| `REDIS` | Upstash | Redis binding for rate limiting |

---

## 19. Glossary

| Term | Definition |
|---|---|
| **Onboarding** | The process from signup to first store creation |
| **Trial** | 14-day free access period with all features unlocked |
| **Grace period** | 3 days after trial expiry; read-only admin access |
| **Frozen** | Store suspended after grace period; billing page only |
| **Cancelled** | Store marked for deletion after 90 days frozen |
| **Site type** | Category of web presence: Store, Portfolio, Resume, Blog, Landing |
| **Subdomain** | Unique identifier: `{subdomain}.letbuyy.store` |
| **ISR** | Incremental Static Regeneration (Vercel/Next.js feature) |
| **AI credits** | Tokens for AI content generation (10 free, plan-based monthly) |
| **Storefront** | Public-facing website served on subdomain |
| **Admin dashboard** | Private management interface at admin.letbuyy.store |

---

## 20. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-01-15 | Team | Initial onboarding & trial design |
| 2.0 | 2026-02-14 | Deep Enhancement | Added: full DB schemas, TypeScript handlers, state machines, cron jobs, React components, Zustand store, payment gateway code, DNS architecture, AI onboarding, email templates, analytics, error handling, security, a11y, i18n, performance, testing, environment config |

---

> **Next:** [04 Admin Dashboard](./04_Admin_Dashboard.md) — Store builder UI, dynamic navigation, all site-type dashboards

---

*[← Back to Index](./README.md)*
