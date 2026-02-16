# LetBuyy Platform — Authentication & Security

> **Doc 02 of 15** | Auth Flows, Supabase Auth, RLS, 2FA, VPN & Security Policies
>
> **Version:** 5.0 | **Date:** February 14, 2026
>
> **Prev:** [01 Architecture](./01_Architecture.md) | **Next:** [03 Onboarding & Trial](./03_Onboarding_and_Trial.md)

---

## Table of Contents

1. [Authentication Architecture](#1-authentication-architecture)
2. [User Authentication Flows](#2-user-authentication-flows)
3. [Admin Authentication](#3-admin-authentication)
4. [Super Admin Authentication](#4-super-admin-authentication)
5. [Employee Authentication](#5-employee-authentication)
6. [Supabase Auth Configuration](#6-supabase-auth-configuration)
7. [Row Level Security (RLS)](#7-row-level-security-rls)
8. [API Security](#8-api-security)
9. [AI-Powered Security](#9-ai-powered-security)
10. [Security Policies & Compliance](#10-security-policies--compliance)

---

## 1. Authentication Architecture

> **⚠️ CRITICAL RULE:** All authentication (login, signup, OAuth, 2FA, password reset, email verification) happens **exclusively** on `accounts.letbuyy.store`. The marketing site `letbuyy.store` contains **zero** auth pages — it only has marketing content, pricing, templates gallery, and the platform blog. When a user clicks "Get Started" or "Sign Up" on the marketing site, they are **redirected** to `accounts.letbuyy.store/signup`. There are **no duplicated auth flows** anywhere in the platform.

### 1.1 Auth Flow Overview

```
                    ┌─────────────────────────────┐
                    │   accounts.letbuyy.store     │
                    │   (Centralized Auth Portal)  │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │      Supabase Auth           │
                    │  ┌─────────┐ ┌────────────┐  │
                    │  │Email/OTP│ │OAuth (SSO) │  │
                    │  └─────────┘ └────────────┘  │
                    │  ┌─────────┐ ┌────────────┐  │
                    │  │Password │ │Magic Links │  │
                    │  └─────────┘ └────────────┘  │
                    └──────────┬──────────────────┘
                               │ JWT Token
                    ┌──────────▼──────────────────┐
                    │     API Gateway (Workers)    │
                    │  JWT Validation + Rate Limit │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
        ┌──────────┐   ┌──────────┐   ┌──────────────┐
        │  Admin   │   │  Team    │   │   Console    │
        │Dashboard │   │ Portal  │   │(Super Admin) │
        │(JWT+Store│   │(JWT+Role│   │(JWT+2FA+VPN) │
        │ Context) │   │ Check)  │   │              │
        └──────────┘   └──────────┘   └──────────────┘
```

### 1.2 Cross-Domain Session Sharing Architecture

JWT tokens must flow seamlessly across **6 domains** (`accounts`, `admin`, `team`, `console`, `api`, `*.letbuyy.store`). Because cross-domain cookies are blocked by browsers, the platform uses a **Supabase session + URL token handoff** strategy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CROSS-DOMAIN AUTH FLOW                                                      │
│                                                                              │
│  accounts.letbuyy.store (Auth Portal — session is created here)             │
│    │                                                                         │
│    │  1. User logs in → Supabase creates session                            │
│    │     → Access Token (JWT, 15min) + Refresh Token (opaque, 7d)           │
│    │     → Stored in httpOnly cookies on accounts.letbuyy.store             │
│    │                                                                         │
│    │  2. Redirect to target app with session handoff:                        │
│    │     → admin.letbuyy.store/{store}/dashboard#access_token=xxx&type=...  │
│    │     → OR: URL contains one-time code exchanged for tokens              │
│    │                                                                         │
│    ▼                                                                         │
│  admin.letbuyy.store (receives token via URL fragment)                      │
│    │                                                                         │
│    │  3. @supabase/ssr middleware reads hash fragment                        │
│    │     → Calls supabase.auth.exchangeCodeForSession() (PKCE)              │
│    │     → Sets its own httpOnly cookies on admin.letbuyy.store             │
│    │     → Clears URL fragment (prevents token exposure in history)          │
│    │                                                                         │
│    │  4. Subsequent requests:                                                │
│    │     → @supabase/ssr auto-refreshes tokens via middleware               │
│    │     → API calls: Authorization: Bearer {access_token}                  │
│    │                                                                         │
│    ▼                                                                         │
│  api.letbuyy.store (API layer — validates JWT on every request)             │
│    │                                                                         │
│    │  5. Hono middleware chain:                                              │
│    │     → Extracts Bearer token from Authorization header                  │
│    │     → Verifies JWT signature using Supabase JWT secret                 │
│    │     → Extracts claims: user_id, role, stores[], permissions[]          │
│    │     → Creates authenticated Supabase client (RLS enforced)             │
│    │                                                                         │
│    │  6. Database queries:                                                   │
│    │     → Supabase client initialized with user's JWT                      │
│    │     → RLS policies filter data based on auth.uid()                     │
│    │     → No data leakage possible — enforced at PostgreSQL level          │
│    │                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

Cookie Domain Strategy:
┌──────────────────────────────────┬───────────────────────────────────────┐
│ Domain                            │ Cookie Scope                          │
├──────────────────────────────────┼───────────────────────────────────────┤
│ accounts.letbuyy.store            │ Auth session (created at login)       │
│ admin.letbuyy.store               │ Own session (from PKCE exchange)      │
│ team.letbuyy.store                │ Own session (from PKCE exchange)      │
│ console.letbuyy.store             │ Own session (from PKCE exchange)      │
│ api.letbuyy.store                 │ No cookies — Bearer tokens only       │
│ *.letbuyy.store (storefronts)     │ Cart/preferences only — no auth       │
└──────────────────────────────────┴───────────────────────────────────────┘
```

### 1.3 PKCE OAuth Flow (Proof Key for Code Exchange)

All OAuth flows use **PKCE** to prevent authorization code interception — no `client_secret` ever touches the browser:

```
┌──────────────┐                  ┌───────────────┐              ┌──────────────┐
│   Browser    │                  │accounts.letbuyy│              │  Supabase    │
│   (Client)   │                  │   .store       │              │  Auth        │
└──────┬───────┘                  └──────┬─────────┘              └──────┬───────┘
       │                                 │                               │
       │  1. Click "Sign in with Google" │                               │
       │────────────────────────────────>│                               │
       │                                 │                               │
       │                                 │  2. Generate:                 │
       │                                 │     code_verifier (random)    │
       │                                 │     code_challenge = SHA256(  │
       │                                 │       code_verifier)          │
       │                                 │                               │
       │                                 │  3. supabase.auth.signInWith  │
       │                                 │     OAuth({ provider,         │
       │                                 │     options: {                │
       │                                 │       redirectTo,             │
       │                                 │       queryParams: {          │
       │                                 │         code_challenge,       │
       │                                 │         code_challenge_method │
       │                                 │       }                       │
       │                                 │     }})                       │
       │                                 │──────────────────────────────>│
       │                                 │                               │
       │  4. Redirect to Google consent  │                               │
       │<────────────────────────────────│                               │
       │                                 │                               │
       │  5. Google callback with        │                               │
       │     authorization code          │                               │
       │────────────────────────────────>│                               │
       │                                 │                               │
       │                                 │  6. Exchange code + verifier  │
       │                                 │     → Supabase validates      │
       │                                 │       challenge matches       │
       │                                 │──────────────────────────────>│
       │                                 │                               │
       │                                 │  7. Tokens returned           │
       │                                 │<──────────────────────────────│
       │                                 │                               │
       │  8. Set cookies + redirect      │                               │
       │     to admin/team/onboarding    │                               │
       │<────────────────────────────────│                               │
       │                                 │                               │
```

### 1.4 Token Strategy

| Token | Type | Lifetime | Storage | Rotation |
|---|---|---|---|---|
| **Access Token** | JWT (Supabase) | 15 minutes | Memory / httpOnly cookie | Auto-refresh via @supabase/ssr |
| **Refresh Token** | Opaque | 7 days | httpOnly cookie | Rotated on every use (one-time) |
| **Session Token** | KV reference | 24 hours | Cloudflare KV (super admin) | Replaced on each login |
| **2FA Token** | TOTP (RFC 6238) | 30 seconds | Authenticator app | Time-based rolling window |
| **Invite Token** | HMAC-SHA256 | 7 days | URL parameter | Single-use, deleted after accept |
| **Reset Token** | Supabase-managed | 1 hour | Email link | Single-use, invalidates sessions |

### 1.5 JWT Payload Structure

```typescript
// Access Token JWT Claims (decoded)
interface LetBuyyJWTPayload {
  // Standard Supabase claims
  sub: string;                    // User UUID (auth.users.id)
  aud: string;                    // "authenticated"
  iss: string;                    // Supabase project URL
  exp: number;                    // Expiry (15 min from issue)
  iat: number;                    // Issued at
  
  // User identity
  email: string;
  email_confirmed_at: string;
  phone: string | null;
  
  // Custom claims (set via Supabase Edge Function hook)
  role: 'user' | 'admin' | 'employee' | 'super_admin';
  stores: string[];               // Array of owned store UUIDs
  active_store: string | null;    // Currently selected store UUID
  
  // Employee-specific (only for team portal users)
  employee_role?: string;         // "order_manager", "content_editor", etc.
  permissions?: string[];         // ["products.read", "orders.manage", ...]
  employer_store_id?: string;     // Store they're employed at
  
  // 2FA status
  amr: Array<{                    // Authentication Methods Reference
    method: 'password' | 'otp' | 'oauth' | 'totp';
    timestamp: number;
  }>;
  
  // Session metadata
  session_id: string;
  is_anonymous: boolean;
}
```

### 1.6 Auth Middleware Chain (Cloudflare Workers)

Every API request passes through this ordered middleware stack. Failure at any layer returns immediately — no downstream processing occurs:

```typescript
// api/src/index.ts — Hono app with auth middleware chain
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimiter } from './middleware/rate-limiter';
import { authenticate } from './middleware/auth';
import { requireRole } from './middleware/rbac';
import { validate } from './middleware/validate';
import { auditLog } from './middleware/audit';

const app = new Hono<{ Bindings: Env }>();

// LAYER 1: CORS — strict origin allowlist
app.use('*', cors({
  origin: [
    'https://accounts.letbuyy.store',
    'https://admin.letbuyy.store',
    'https://team.letbuyy.store',
    'https://console.letbuyy.store',
    /^https:\/\/[a-z0-9-]+\.letbuyy\.store$/,  // Wildcard storefronts
  ],
  credentials: true,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Store-ID'],
}));

// LAYER 2: Rate Limiting — per-store, per-endpoint (Upstash Redis)
app.use('*', rateLimiter());

// LAYER 3: JWT Authentication — Supabase token verification
app.use('/v1/*', authenticate());

// LAYER 4: RBAC — role + permission checks (applied per route group)
app.use('/v1/admin/*', requireRole('admin', 'super_admin'));
app.use('/v1/team/*', requireRole('employee'));
app.use('/v1/console/*', requireRole('super_admin'));

// LAYER 5: Audit logging — mutation tracking
app.use('/v1/*', auditLog());

// --- Route handlers below use c.get('user'), c.get('supabase') ---
```

```typescript
// middleware/auth.ts — JWT verification middleware
import { createClient } from '@supabase/supabase-js';
import type { MiddlewareHandler } from 'hono';

export const authenticate = (): MiddlewareHandler => {
  return async (c, next) => {
    const authHeader = c.req.header('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create Supabase client with user's JWT — this enforces RLS
    const supabase = createClient(
      c.env.SUPABASE_URL,
      c.env.SUPABASE_ANON_KEY,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false },
      }
    );

    // Verify token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Attach to context for downstream handlers
    c.set('user', user);
    c.set('supabase', supabase);
    c.set('userId', user.id);
    c.set('role', user.app_metadata?.role || 'user');
    c.set('stores', user.app_metadata?.stores || []);

    await next();
  };
};
```

---

## 2. User Authentication Flows

### 2.1 Email-First Unified Entry Point

LetBuyy uses an **email-first** approach — a single entry point determines whether the user should **sign up** or **log in**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UNIFIED AUTH ENTRY  (accounts.letbuyy.store/login)                          │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Step 1: Enter email address                                          │  │
│  │          [         user@example.com          ]                        │  │
│  │          [           Continue →              ]                        │  │
│  │                                                                       │  │
│  │          ── or ──                                                     │  │
│  │          [🔵 Continue with Google]                                    │  │
│  │          [⚫ Continue with GitHub]                                    │  │
│  │          [🍎 Continue with Apple ]                                    │  │
│  │                                                                       │  │
│  │  ⚙️ Cloudflare Turnstile (invisible challenge — no CAPTCHA shown)    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  API call: POST /v1/auth/check-email { email }                              │
│                                                                              │
│  ├── Email EXISTS in auth.users:                                            │
│  │   → Show password field + "Forgot Password?" link                        │
│  │   → User enters password → POST /v1/auth/login                          │
│  │   → JWT tokens returned → Post-login redirect logic                      │
│  │                                                                          │
│  └── Email NOT EXISTS:                                                      │
│      → Redirect to accounts.letbuyy.store/signup?email={email}              │
│      → Pre-fill email field → Begin OTP verification flow                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Email + OTP Signup Flow

```
User redirected to accounts.letbuyy.store/signup
    │
    ├── 1. Email pre-filled (from login check) + Turnstile verified
    │       └── POST /v1/auth/signup { email }
    │       └── Backend: Supabase creates unconfirmed user
    │
    ├── 2. Send OTP to email (via Resend)
    │       └── 6-digit code, expires in 10 minutes
    │       └── Template: @letbuyy/email → OTPVerification.tsx
    │       └── Redis key: otp:{user_id} → { code, attempts: 0, expires_at }
    │
    ├── 3. Verify OTP
    │       └── POST /v1/auth/otp/verify { email, code }
    │       └── Max 3 attempts → lockout 15 min (Redis: otp:lockout:{email})
    │       └── Wrong code: increment attempts counter
    │       └── Expired: "Code expired — Resend" button (max 4 resends/hour)
    │
    ├── 4. Create password
    │       └── POST /v1/auth/password/set { password, confirm_password }
    │       └── Requirements:
    │           ├── Min 8 characters
    │           ├── At least 1 uppercase letter
    │           ├── At least 1 number
    │           ├── At least 1 special character (!@#$%^&*)
    │           └── Not in breached password list (HaveIBeenPwned k-anonymity API)
    │
    ├── 5. Account activated in Supabase Auth
    │       └── email_confirmed_at = NOW()
    │       └── app_metadata.role = 'user'
    │       └── Welcome email sent (Resend: WelcomeEmail.tsx template)
    │
    └── 6. Post-signup redirect
            └── → accounts.letbuyy.store/onboarding (store creation wizard)
```

```typescript
// POST /v1/auth/signup — Signup handler (Hono Worker)
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email().max(320),
  turnstile_token: z.string().min(1),
});

app.post('/v1/auth/signup', validate('json', signupSchema), async (c) => {
  const { email, turnstile_token } = c.req.valid('json');

  // 1. Verify Turnstile token (anti-bot)
  const turnstileValid = await verifyTurnstile(c.env.TURNSTILE_SECRET, turnstile_token);
  if (!turnstileValid) {
    return c.json({ error: 'Bot detection failed. Please try again.' }, 403);
  }

  // 2. Check rate limit (4 signups per hour per IP)
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
  const rateLimited = await checkRateLimit(c.env.REDIS, `signup:${ip}`, 4, 3600);
  if (rateLimited) {
    return c.json({ error: 'Too many signup attempts. Try again later.' }, 429);
  }

  // 3. Create user in Supabase (unconfirmed — OTP required)
  const supabase = createServiceRoleClient(c.env);
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: false,       // Requires OTP verification
    app_metadata: { role: 'user' },
  });

  if (error?.message?.includes('already registered')) {
    return c.json({ error: 'Email already registered. Try logging in.' }, 409);
  }

  // 4. Generate and store OTP
  const otp = generateSecureOTP(6);  // crypto.getRandomValues
  await c.env.REDIS.set(`otp:${data.user.id}`, JSON.stringify({
    code: await hashOTP(otp),       // bcrypt hash — never store plain OTP
    attempts: 0,
    expires_at: Date.now() + 10 * 60 * 1000,  // 10 minutes
  }), { ex: 600 });

  // 5. Send OTP email via Resend
  await sendOTPEmail(c.env.RESEND_API_KEY, email, otp);

  return c.json({
    message: 'OTP sent to your email',
    user_id: data.user.id,
    expires_in: 600,
  }, 201);
});
```

### 2.3 OAuth / Social Login

| Provider | Scopes | Data Retrieved | Auth Method | Account Linking |
|---|---|---|---|---|
| **Google** | `email`, `profile` | Name, email, avatar, locale | PKCE + OAuth 2.0 | Auto-links if email matches |
| **GitHub** | `user:email`, `read:user` | Name, email, avatar, bio | PKCE + OAuth 2.0 | Auto-links if email matches |
| **Apple** | `email`, `name` | Name, email (relay optional) | PKCE + OAuth 2.0 | Manual link (Apple hides email) |

```
User clicks "Continue with Google" (on accounts.letbuyy.store)
    │
    ├── 1. Turnstile invisible challenge verified ✅
    │
    ├── 2. PKCE initiated:
    │       ├── code_verifier: random 43-128 char string (stored in session)
    │       └── code_challenge: BASE64URL(SHA256(code_verifier))
    │
    ├── 3. Redirect to Google consent screen
    │       └── scope: openid email profile
    │       └── redirect_uri: accounts.letbuyy.store/callback/google
    │
    ├── 4. Google callback with authorization code
    │       └── Supabase exchanges code + code_verifier for tokens
    │       └── PKCE ensures code can't be intercepted by malicious scripts
    │
    ├── 5. Account resolution:
    │       ├── Email NOT in system → Create new account (auto-confirmed)
    │       ├── Email EXISTS (password user) → Link Google to existing account
    │       └── Email EXISTS (different OAuth) → Link both providers
    │
    ├── 6. Post-login redirect logic:
    │       ├── Has stores → admin.letbuyy.store/{first_store}/dashboard
    │       └── No stores  → accounts.letbuyy.store/onboarding
    │
    └── 7. JWT tokens set as httpOnly cookies
```

### 2.4 Account Linking (OAuth + Email Merge)

When a user signs up with email/password and later tries to sign in with Google (same email), or vice versa:

```
┌───────────────────────────────────────────────────────────────────────┐
│  ACCOUNT LINKING SCENARIOS                                             │
│                                                                        │
│  Scenario 1: Email user → tries Google login (same email)             │
│  ├── Supabase detects matching email in auth.users                    │
│  ├── Auto-links Google identity to existing account                   │
│  ├── User now has BOTH email+password AND Google login available      │
│  └── app_metadata.providers: ["email", "google"]                      │
│                                                                        │
│  Scenario 2: Google user → tries email signup (same email)            │
│  ├── POST /v1/auth/check-email returns: { exists: true }              │
│  ├── UI shows: "An account with this email exists. Sign in with       │
│  │   Google, or use password reset to add a password."                 │
│  └── Password reset → now has both methods available                  │
│                                                                        │
│  Scenario 3: Apple user (hidden relay email)                          │
│  ├── Apple provides relay: xxxx@privaterelay.appleid.com              │
│  ├── Cannot auto-link to existing account (different email)           │
│  ├── User must manually link: Settings → Linked Accounts → Add Email │
│  └── OTP verification required to prove email ownership               │
│                                                                        │
│  Scenario 4: GitHub user + Google user (same email)                   │
│  ├── Second provider automatically linked                             │
│  ├── Both appear in user's auth.identities array                     │
│  └── app_metadata.providers: ["github", "google"]                     │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

### 2.5 Password Reset Flow

```
User clicks "Forgot Password" (accounts.letbuyy.store/forgot-password)
    │
    ├── 1. Enter email address + Turnstile verification
    │       └── POST /v1/auth/password/reset { email, turnstile_token }
    │       └── Rate limit: 3 reset requests per hour per email
    │
    ├── 2. Backend (always returns success — prevents email enumeration):
    │       ├── Email EXISTS → Send reset link via Resend
    │       │   └── Link: accounts.letbuyy.store/reset-password?token=xxx
    │       │   └── Token: Supabase-managed, 1 hour expiry, single-use
    │       └── Email NOT EXISTS → Log attempt, return same success message
    │
    ├── 3. User clicks link → accounts.letbuyy.store/reset-password
    │       ├── Supabase verifies token validity
    │       ├── Token expired → "Link expired. Request a new one."
    │       └── Token valid → Show "Enter new password" form
    │
    ├── 4. Enter new password (same requirements as signup):
    │       ├── Min 8 chars, uppercase, number, special char
    │       ├── Cannot reuse last 3 passwords (checked via hash comparison)
    │       └── HaveIBeenPwned k-anonymity check
    │
    ├── 5. Password updated:
    │       ├── All active sessions invalidated across ALL domains
    │       ├── Refresh tokens revoked
    │       ├── Confirmation email sent: "Your password was changed"
    │       └── Audit log: { action: "password_reset", ip, user_agent }
    │
    └── 6. Redirect to login page with success message
```

### 2.6 Post-Login Redirect Logic

After successful authentication (any method), the server determines the correct destination:

```typescript
// Post-login redirect logic (runs on accounts.letbuyy.store)
async function getPostLoginRedirect(userId: string): Promise<string> {
  const supabase = createServiceRoleClient();
  
  // 1. Check if user has any stores
  const { data: stores } = await supabase
    .from('stores')
    .select('subdomain, status, site_type')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (!stores || stores.length === 0) {
    // No stores → must create one first
    return 'https://accounts.letbuyy.store/onboarding';
  }

  // 2. Check if user is an employee (team member at another store)
  const { data: teamMembership } = await supabase
    .from('team_members')
    .select('store_id, role, permissions, stores(subdomain)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (teamMembership) {
    // Employee → team portal
    return 'https://team.letbuyy.store/dashboard';
  }

  // 3. Check if user is super admin
  const { data: superAdmin } = await supabase
    .from('super_admin_allowlist')
    .select('id')
    .eq('user_id', userId)
    .single();

  if (superAdmin) {
    return 'https://console.letbuyy.store/dashboard';
  }

  // 4. Default: redirect to most recently updated store
  const firstStore = stores[0];
  return `https://admin.letbuyy.store/${firstStore.subdomain}/dashboard`;
}
```

### 2.7 Cloudflare Turnstile Integration

All authentication forms include an **invisible** Cloudflare Turnstile challenge (GDPR-friendly alternative to reCAPTCHA):

```typescript
// Server-side Turnstile verification (Cloudflare Worker)
interface TurnstileResponse {
  success: boolean;
  'error-codes': string[];
  challenge_ts: string;
  hostname: string;
  action: string;
}

async function verifyTurnstile(
  secretKey: string,
  token: string,
  expectedAction?: string
): Promise<boolean> {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: secretKey,
        response: token,
      }),
    }
  );

  const result: TurnstileResponse = await response.json();

  // Verify both success AND action matches (prevents token reuse across forms)
  if (expectedAction && result.action !== expectedAction) {
    return false;
  }

  return result.success;
}

// Forms that require Turnstile:
// ┌──────────────────────────────────┬──────────────────────────┐
// │ Form                              │ Turnstile Action         │
// ├──────────────────────────────────┼──────────────────────────┤
// │ Login (email entry)               │ "login"                  │
// │ Signup (email + OTP)              │ "signup"                 │
// │ Password reset request            │ "reset_password"         │
// │ OTP resend                        │ "resend_otp"             │
// │ Contact form (storefront)         │ "contact"                │
// │ Checkout (guest)                  │ "checkout"               │
// │ Newsletter subscribe              │ "subscribe"              │
// └──────────────────────────────────┴──────────────────────────┘
```

---

## 3. Admin Authentication

### 3.1 Store-Specific Login

When accessing `admin.letbuyy.store/{store}`:

```
Route: admin.letbuyy.store/{store-name}/login
    │
    ├── 1. Verify JWT token (from accounts portal or cookie)
    │       └── No token? → Redirect to accounts.letbuyy.store/login?redirect=admin/{store}
    │
    ├── 2. Validate store ownership
    │       └── SELECT * FROM stores WHERE subdomain = $1 AND user_id = auth.uid()
    │
    ├── 3. Load store context
    │       └── Site type, settings, theme, subscription tier
    │
    └── 4. Render dashboard (adapted to site type)
```

### 3.2 Multi-Store Access

Users with multiple stores see a store selector:

```
admin.letbuyy.store/
    │
    ├── List all stores owned by user
    ├── Show: name, site type, status, last updated
    ├── Click → admin.letbuyy.store/{selected-store}/dashboard
    └── "Create New Store" → letbuyy.store/create
```

---

## 4. Super Admin Authentication

### 4.1 Access Requirements

**URL:** `console.letbuyy.store` — restricted to founders/admins only

| Layer | Requirement |
|---|---|
| **Network** | VPN required (Tailscale mesh) |
| **Email** | Must be in `super_admin_allowlist` table |
| **Password** | Standard Supabase Auth password |
| **2FA** | **Mandatory** — TOTP (Google Authenticator) or Hardware Key (YubiKey) |
| **IP** | Whitelisted IPs only |
| **Robots** | `robots.txt: noindex, nofollow` |

### 4.2 Login Flow

```
Admin connects to Tailscale VPN
    │
    ├── 1. Navigate to console.letbuyy.store/login
    │       └── Check: IP in allowlist? No → 403
    │
    ├── 2. Enter email + password
    │       └── Check: Email in super_admin_allowlist? No → 403
    │
    ├── 3. 2FA challenge (TOTP / Hardware key)
    │       └── 3 failed attempts → Account locked, alert sent
    │
    ├── 4. Session created in Cloudflare KV
    │       └── TTL: 8 hours (work day session)
    │
    └── 5. Audit log entry created
            └── { actor: "admin", action: "login", ip: "...", timestamp: "..." }
```

### 4.3 Session Management

| Setting | Value |
|---|---|
| Session duration | 8 hours (auto-expire) |
| Idle timeout | 30 minutes |
| Concurrent sessions | 1 per admin |
| Force logout | Available from any other admin session |

---

## 5. Employee Authentication & RBAC

### 5.1 Employee Invite Flow

Store owners (admin.letbuyy.store) can invite team members to manage their store:

```
Store Owner on admin.letbuyy.store/{store}/settings/team
    │
    ├── 1. Enter employee email + select role template
    │       └── Role templates: "Order Manager", "Content Editor",
    │           "Product Manager", "Store Admin" (pre-built permission bundles)
    │
    ├── 2. System generates invite:
    │       └── POST /v1/team/invite { email, store_id, role_template }
    │       └── Token: HMAC-SHA256(email + store_id + timestamp + secret)
    │       └── Stored: team_invites table (expires in 7 days)
    │       └── Email: Resend → TeamInvite.tsx template
    │       └── Link: accounts.letbuyy.store/invite?token=xxx
    │
    ├── 3. Employee clicks invite link:
    │       └── Token verified: valid + not expired + not used
    │       └── Email matches invite record
    │       ├── Has account → Login + link to store team
    │       └── No account → Signup flow → auto-link to store team
    │
    ├── 4. Employee account setup:
    │       └── Password created (or OAuth linked)
    │       └── 2FA setup prompt (optional for team, required for Store Admin role)
    │       └── team_members record created:
    │           { user_id, store_id, role, permissions, is_active: true }
    │
    └── 5. Employee onboarded:
            └── Invite token marked as used (single-use)
            └── Audit log: { action: "employee_invited", inviter_id, invitee_email }
            └── Welcome notification: "You've been added to {store_name}"
            └── Redirect to team.letbuyy.store/dashboard
```

### 5.2 Employee Login Flow

```
Employee visits team.letbuyy.store/login
    │
    ├── 1. Email + Password (standard Supabase auth)
    │       └── Turnstile challenge verified
    │       └── Supabase returns JWT
    │
    ├── 2. Backend authorization check:
    │       └── POST /v1/team/verify-membership
    │       └── Query: team_members WHERE user_id = auth.uid() AND is_active = true
    │       ├── NOT a team member → 403 "You are not part of any team"
    │       └── IS a team member → continue
    │
    ├── 3. 2FA challenge (if enabled):
    │       └── Required for "Store Admin" role
    │       └── Optional for other roles (recommended)
    │       └── Verification: POST /v1/auth/2fa/verify { totp_code }
    │
    ├── 4. Load role + permissions:
    │       └── team_members.role → permission scope resolution
    │       └── JWT enriched with: employee_role, permissions[], employer_store_id
    │       └── Session: KV entry at session:{user_id}:{store_id}
    │
    └── 5. Render role-specific dashboard:
            └── Sidebar nav items filtered by permissions
            └── API responses filtered by RLS + permission checks
            └── UI elements conditionally rendered
```

### 5.3 14-Scope RBAC Permission Matrix

Every team action maps to a **scope** (resource + action). Permissions are stored as `string[]` in the `team_members.permissions` JSONB column:

| Scope | Description | Order Mgr | Content Edit | Product Mgr | Store Admin |
|---|---|---|---|---|---|
| `products.read` | View products list | ✅ | ✅ | ✅ | ✅ |
| `products.write` | Create/edit products | ❌ | ❌ | ✅ | ✅ |
| `products.delete` | Remove products | ❌ | ❌ | ✅ | ✅ |
| `orders.read` | View orders list | ✅ | ❌ | ❌ | ✅ |
| `orders.manage` | Update order status | ✅ | ❌ | ❌ | ✅ |
| `orders.refund` | Process refunds | ❌ | ❌ | ❌ | ✅ |
| `content.read` | View pages/blog | ❌ | ✅ | ❌ | ✅ |
| `content.write` | Create/edit content | ❌ | ✅ | ❌ | ✅ |
| `content.publish` | Publish content | ❌ | ✅ | ❌ | ✅ |
| `analytics.read` | View analytics | ❌ | ❌ | ❌ | ✅ |
| `settings.read` | View store settings | ❌ | ❌ | ❌ | ✅ |
| `settings.write` | Modify settings | ❌ | ❌ | ❌ | ✅ |
| `team.read` | View team members | ❌ | ❌ | ❌ | ✅ |
| `team.manage` | Invite/remove members | ❌ | ❌ | ❌ | ✅ |

### 5.4 Role Templates (Pre-Built Permission Bundles)

```typescript
// @letbuyy/auth — Role templates
const ROLE_TEMPLATES: Record<string, {
  label: string;
  permissions: string[];
  requires2FA: boolean;
}> = {
  order_manager: {
    label: 'Order Manager',
    permissions: ['products.read', 'orders.read', 'orders.manage'],
    requires2FA: false,
  },
  content_editor: {
    label: 'Content Editor',
    permissions: ['products.read', 'content.read', 'content.write', 'content.publish'],
    requires2FA: false,
  },
  product_manager: {
    label: 'Product Manager',
    permissions: ['products.read', 'products.write', 'products.delete'],
    requires2FA: false,
  },
  store_admin: {
    label: 'Store Admin',
    permissions: [
      'products.read', 'products.write', 'products.delete',
      'orders.read', 'orders.manage', 'orders.refund',
      'content.read', 'content.write', 'content.publish',
      'analytics.read', 'settings.read', 'settings.write',
      'team.read', 'team.manage',
    ],
    requires2FA: true,  // Mandatory for full access
  },
};
```

### 5.5 Permission Check Middleware

```typescript
// middleware/rbac.ts — Permission check middleware (Hono Worker)
import type { MiddlewareHandler } from 'hono';

export const requirePermission = (...scopes: string[]): MiddlewareHandler => {
  return async (c, next) => {
    const role = c.get('role');

    // Super admins bypass all permission checks
    if (role === 'super_admin') {
      await next();
      return;
    }

    // Store owners have full access to their own stores
    if (role === 'admin') {
      const storeId = c.req.header('X-Store-ID') || c.req.param('storeId');
      const userStores: string[] = c.get('stores');
      if (storeId && userStores.includes(storeId)) {
        await next();
        return;
      }
      return c.json({ error: 'Access denied to this store' }, 403);
    }

    // Employees: check specific permission scopes
    if (role === 'employee') {
      const userPermissions: string[] = c.get('user')?.app_metadata?.permissions || [];
      const hasAllScopes = scopes.every(scope => userPermissions.includes(scope));

      if (!hasAllScopes) {
        const missing = scopes.filter(s => !userPermissions.includes(s));
        return c.json({
          error: 'Insufficient permissions',
          required: scopes,
          missing,
        }, 403);
      }
      await next();
      return;
    }

    return c.json({ error: 'Access denied' }, 403);
  };
};

// Usage in route handlers:
app.get('/v1/team/orders', requirePermission('orders.read'), async (c) => {
  // Only employees with orders.read can reach here
});

app.post('/v1/team/orders/:id/refund',
  requirePermission('orders.manage', 'orders.refund'),
  async (c) => {
    // Requires BOTH scopes — only Store Admin has both
  }
);
```

### 5.6 Instant Deactivation

Store owners or super admins can instantly deactivate any team member:

```typescript
// POST /v1/team/members/:id/deactivate
app.post('/v1/team/members/:id/deactivate',
  requirePermission('team.manage'),
  async (c) => {
    const memberId = c.req.param('id');
    const supabase = c.get('supabase');

    // 1. Set is_active = false in team_members
    await supabase
      .from('team_members')
      .update({ is_active: false, deactivated_at: new Date().toISOString() })
      .eq('id', memberId);

    // 2. Invalidate all sessions in KV
    const member = await getMember(supabase, memberId);
    await c.env.KV.delete(`session:${member.user_id}:${member.store_id}`);

    // 3. Revoke refresh tokens in Supabase
    const adminClient = createServiceRoleClient(c.env);
    await adminClient.auth.admin.signOut(member.user_id, 'global');

    // 4. Audit log
    await logAuditEvent(supabase, {
      action: 'employee_deactivated',
      actor_id: c.get('userId'),
      target_id: member.user_id,
      store_id: member.store_id,
      metadata: { reason: c.req.valid('json')?.reason },
    });

    return c.json({ success: true, message: 'Employee deactivated immediately' });
  }
);
```

**Effect:** Employee is immediately locked out across ALL sessions. They see "Your access has been revoked" on next API call. No race condition — KV delete is atomic.

---

## 6. Supabase Auth Configuration

### 6.1 Auth Project Settings

```json
{
  "site_url": "https://accounts.letbuyy.store",
  "additional_redirect_urls": [
    "https://accounts.letbuyy.store/callback/**",
    "https://admin.letbuyy.store/*/callback",
    "https://team.letbuyy.store/callback",
    "https://console.letbuyy.store/callback"
  ],
  "jwt_expiry": 900,
  "refresh_token_rotation_enabled": true,
  "refresh_token_reuse_interval": 10,
  "security_refresh_token_rotation": true,
  "password_min_length": 8,
  "mailer_autoconfirm": false,
  "mailer_secure_email_change_enabled": true,
  "external_email_enabled": true,
  "external_google_enabled": true,
  "external_github_enabled": true,
  "external_apple_enabled": true,
  "sms_autoconfirm": false,
  "rate_limits": {
    "email_sent": "4 per hour",
    "sms_sent": "10 per hour",
    "token_refresh": "150 per 5 minutes",
    "signup": "10 per hour per IP"
  },
  "hook_custom_access_token_enabled": true,
  "mfa_enabled": true,
  "mfa_totp_enroll_enabled": true
}
```

### 6.2 @supabase/ssr Middleware (Next.js App Router)

Every Next.js application uses `@supabase/ssr` to manage session cookies and auto-refresh tokens:

```typescript
// middleware.ts — Next.js middleware (runs on every request)
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            supabaseResponse.cookies.set(name, value, {
              ...options,
              httpOnly: true,       // Prevents XSS from reading cookies
              secure: true,         // HTTPS only
              sameSite: 'lax',      // CSRF protection
              path: '/',
            });
          });
        },
      },
    }
  );

  // IMPORTANT: Do NOT use supabase.auth.getSession() in middleware!
  // getUser() validates JWT against Supabase servers (tamper-proof),
  // while getSession() only reads from local cookie (can be forged)
  const { data: { user } } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  
  if (!user && isProtectedRoute(path)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirectTo', path);
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthRoute(path)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

### 6.3 Token Refresh Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│  TOKEN REFRESH LIFECYCLE (automatic via @supabase/ssr)                │
│                                                                       │
│  T=0: User logs in                                                   │
│  ├── Access token created (expires T+15min)                          │
│  └── Refresh token created (expires T+7days)                         │
│                                                                       │
│  T+14min: User makes request → middleware runs                       │
│  ├── supabase.auth.getUser() detects access token near expiry        │
│  ├── Auto-calls supabase.auth.refreshSession()                      │
│  ├── New access token issued (expires T+29min)                       │
│  ├── Old refresh token INVALIDATED (one-time use)                    │
│  ├── New refresh token issued (expires T+14min+7days)                │
│  └── New cookies set on response                                     │
│                                                                       │
│  T+7days (no activity): Refresh token expired                        │
│  ├── supabase.auth.getUser() returns null                            │
│  ├── Middleware redirects to /login                                  │
│  └── User must re-authenticate                                      │
│                                                                       │
│  SECURITY: Refresh token reuse detection                             │
│  ├── If an old refresh token is reused (replay attack):              │
│  │   └── Supabase revokes ALL tokens for this user                  │
│  │   └── User is forced to log in again on ALL devices               │
│  └── 10-second reuse interval allows for network retries             │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.4 Custom JWT Claims Hook (Supabase Edge Function)

Supabase allows enriching JWT tokens via a **custom access token hook**. LetBuyy uses this to inject `role`, `stores`, and `permissions` at token creation time:

```typescript
// supabase/functions/custom-access-token/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface WebhookPayload {
  user_id: string;
  claims: Record<string, unknown>;
}

serve(async (req) => {
  const payload: WebhookPayload = await req.json();
  const { user_id, claims } = payload;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Get user's stores
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('user_id', user_id);

  // 2. Check if user is an employee
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('store_id, role, permissions')
    .eq('user_id', user_id)
    .eq('is_active', true)
    .single();

  // 3. Check super admin status
  const { data: superAdmin } = await supabase
    .from('super_admin_allowlist')
    .select('id')
    .eq('user_id', user_id)
    .single();

  // 4. Build enriched claims
  const enrichedClaims = {
    ...claims,
    role: superAdmin
      ? 'super_admin'
      : teamMember
        ? 'employee'
        : stores?.length
          ? 'admin'
          : 'user',
    stores: stores?.map(s => s.id) || [],
    ...(teamMember && {
      employee_role: teamMember.role,
      permissions: teamMember.permissions,
      employer_store_id: teamMember.store_id,
    }),
  };

  return new Response(JSON.stringify({ claims: enrichedClaims }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 7. Row Level Security (RLS)

### 7.1 RLS Coverage Map

> **Rule:** Every table in the database has RLS enabled. There are **zero** tables without RLS. If a new table is created without RLS, the CI pipeline fails.

| Table | RLS | Owner Check | Public Read | Service Role Bypass |
|---|---|---|---|---|
| `stores` | ✅ | `auth.uid() = user_id` | Published only | Webhooks |
| `products` | ✅ | Via store ownership | Active + published | Import/export |
| `orders` | ✅ | Via store ownership | ❌ | Payment webhooks |
| `order_items` | ✅ | Via order → store | ❌ | Payment webhooks |
| `pages` | ✅ | Via store ownership | Published only | ❌ |
| `blog_posts` | ✅ | Via store ownership | Published only | ❌ |
| `portfolio_projects` | ✅ | Via store ownership | Published only | ❌ |
| `resume_data` | ✅ | `auth.uid() = user_id` | Published only | ❌ |
| `team_members` | ✅ | Via store ownership | ❌ | Invite system |
| `subscribers` | ✅ | Via store ownership | ❌ | ❌ |
| `ai_usage` | ✅ | `auth.uid() = user_id` | ❌ | AI worker |
| `ai_credits` | ✅ | `auth.uid() = user_id` | ❌ | Billing worker |
| `activity_logs` | ✅ | Via store ownership | ❌ | System logging |
| `user_profiles` | ✅ | `auth.uid() = id` | ❌ | ❌ |
| `store_themes` | ✅ | Via store ownership | Published only | ❌ |

### 7.2 Core RLS Policies

```sql
-- ============================================================
-- STORE-LEVEL ISOLATION (foundational pattern)
-- All store-related tables follow this pattern:
-- Owner: CRUD on own store's data via store_id FK
-- Public: SELECT only on published/active records
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscribers ENABLE ROW LEVEL SECURITY;

-- ═══════════════ STORES ═══════════════
CREATE POLICY "Users manage own stores" ON stores
  FOR ALL USING (auth.uid() = user_id);

-- ═══════════════ PRODUCTS ═══════════════
CREATE POLICY "Owners manage products" ON products
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public reads active products" ON products
  FOR SELECT USING (
    status = 'active' AND
    store_id IN (SELECT id FROM stores WHERE status = 'published')
  );

-- ═══════════════ ORDERS ═══════════════
CREATE POLICY "Owners view orders" ON orders
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public creates orders" ON orders
  FOR INSERT WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE status = 'published')
  );

-- Customers can view their own orders (by email match)
CREATE POLICY "Customers view own orders" ON orders
  FOR SELECT USING (customer_email = auth.jwt() ->> 'email');

-- ═══════════════ BLOG POSTS ═══════════════
CREATE POLICY "Owners manage blog" ON blog_posts
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public reads published blogs" ON blog_posts
  FOR SELECT USING (
    status = 'published' AND
    published_at <= NOW() AND
    store_id IN (SELECT id FROM stores WHERE status = 'published')
  );

-- ═══════════════ PORTFOLIO ═══════════════
CREATE POLICY "Owners manage portfolio" ON portfolio_projects
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public reads published portfolio" ON portfolio_projects
  FOR SELECT USING (
    status = 'published' AND
    store_id IN (SELECT id FROM stores WHERE status = 'published')
  );

-- ═══════════════ TEAM MEMBERS ═══════════════
CREATE POLICY "Owner manages team" ON team_members
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Employee reads own membership" ON team_members
  FOR SELECT USING (user_id = auth.uid());

-- ═══════════════ SUBSCRIBERS ═══════════════
CREATE POLICY "Owner manages subscribers" ON subscribers
  FOR ALL USING (store_id IN (
    SELECT id FROM stores WHERE user_id = auth.uid()
  ));

CREATE POLICY "Public subscribes" ON subscribers
  FOR INSERT WITH CHECK (
    store_id IN (SELECT id FROM stores WHERE status = 'published')
  );
```

### 7.3 AI-Specific Policies

```sql
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;

-- Users see only their own AI usage
CREATE POLICY "Users view own AI usage" ON ai_usage
  FOR SELECT USING (user_id = auth.uid());

-- Users see only their own credit balance
CREATE POLICY "Users view own credits" ON ai_credits
  FOR SELECT USING (user_id = auth.uid());

-- Service role inserts AI usage (via Workers — never client-side)
CREATE POLICY "System records AI usage" ON ai_usage
  FOR INSERT WITH CHECK (true);  -- Only reachable via service_role key

-- Service role manages credits (deduct/add)
CREATE POLICY "System manages credits" ON ai_credits
  FOR ALL WITH CHECK (true);     -- Only reachable via service_role key
```

### 7.4 RLS Performance Optimization

```sql
-- ═══════════════ INDEXES FOR RLS ═══════════════
-- Without these, RLS policies cause sequential scans on subqueries

-- Fast user → stores lookup (foundational for all store-level policies)
CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_status ON stores(status) WHERE status = 'published';

-- Product policies: store_id + status combo
CREATE INDEX idx_products_store_status ON products(store_id, status);

-- Order policies: store_id + customer lookup
CREATE INDEX idx_orders_store_id ON orders(store_id);
CREATE INDEX idx_orders_customer_email ON orders(customer_email);

-- Team member lookup: user_id + is_active
CREATE INDEX idx_team_active ON team_members(user_id, is_active)
  WHERE is_active = true;

-- AI usage: user_id for personal history
CREATE INDEX idx_ai_usage_user ON ai_usage(user_id);

-- ═══════════════ MATERIALIZED VIEW (for high-volume stores) ═══════════════
-- Precompute store ownership for faster RLS evaluation
CREATE MATERIALIZED VIEW store_ownership AS
  SELECT id AS store_id, user_id FROM stores;

CREATE UNIQUE INDEX idx_store_ownership ON store_ownership(store_id, user_id);

-- Refresh via trigger or cron (every 5 min)
-- Note: Only needed for stores with very high query volume (10k+ products)
```

### 7.5 Service Role Bypass Patterns

The **service role key** bypasses RLS entirely. It is **never** used in client-side code — only in:

```typescript
// ⚠️ SERVICE ROLE — bypasses RLS (used ONLY in Workers/Edge Functions)
function createServiceRoleClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Allowed use cases for service role:
// ┌──────────────────────────────────┬──────────────────────────────────────┐
// │ Use Case                          │ Why RLS Won't Work                   │
// ├──────────────────────────────────┼──────────────────────────────────────┤
// │ Webhook handlers (Stripe/Razorpay)│ No user JWT — system-initiated      │
// │ Cron jobs (cleanup, analytics)   │ No user context — background task    │
// │ AI usage logging                 │ Worker records on behalf of user     │
// │ Email sending (Resend triggers)  │ System-initiated, not user request   │
// │ Invite token verification        │ Pre-auth — user not logged in yet    │
// │ Admin user management            │ Super admin acting across stores     │
// └──────────────────────────────────┴──────────────────────────────────────┘

// NEVER allowed:
// ❌ Client-side JavaScript (React, Next.js client components)
// ❌ API routes serving user requests without re-validation
// ❌ Passing service_role key to browser via env vars
```

---

## 8. API Security

### 8.1 Complete Auth API Routes

| Method | Endpoint | Auth | Rate Limit | Description |
|---|---|---|---|---|
| `POST` | `/v1/auth/check-email` | ❌ Public | 10/min/IP | Check if email exists (login vs signup routing) |
| `POST` | `/v1/auth/signup` | ❌ Public | 4/hr/IP | Create account + send OTP |
| `POST` | `/v1/auth/otp/verify` | ❌ Public | 3 attempts | Verify email OTP code |
| `POST` | `/v1/auth/otp/resend` | ❌ Public | 4/hr/email | Resend OTP code |
| `POST` | `/v1/auth/login` | ❌ Public | 10/min/IP | Email + password login |
| `POST` | `/v1/auth/password/set` | ❌ Public | 3/hr/user | Set password after OTP |
| `POST` | `/v1/auth/password/reset` | ❌ Public | 3/hr/email | Request password reset link |
| `POST` | `/v1/auth/password/update` | ✅ Bearer | 3/hr/user | Update password (from reset link) |
| `POST` | `/v1/auth/2fa/enroll` | ✅ Bearer | 3/hr/user | Start 2FA TOTP setup |
| `POST` | `/v1/auth/2fa/verify` | ✅ Bearer | 5/min/user | Verify 2FA TOTP code |
| `POST` | `/v1/auth/refresh` | ✅ Cookie | 150/5min | Refresh access token |
| `POST` | `/v1/auth/logout` | ✅ Bearer | — | Revoke all tokens |

### 8.2 Rate Limiting Implementation

```typescript
// middleware/rate-limiter.ts — Upstash Redis sliding window
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

interface RateLimitConfig {
  requests: number;
  window: string;  // "1m", "1h", "1d"
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/v1/auth/':     { requests: 10,  window: '1m' },
  '/v1/stores/':   { requests: 60,  window: '1m' },
  '/v1/products/': { requests: 60,  window: '1m' },
  '/v1/orders/':   { requests: 30,  window: '1m' },
  '/v1/ai/':       { requests: 20,  window: '1m' },
  '/v1/upload/':   { requests: 10,  window: '1m' },
  '/v1/admin/':    { requests: 300, window: '1m' },
};

export const rateLimiter = (): MiddlewareHandler => {
  return async (c, next) => {
    const redis = Redis.fromEnv(c.env);
    const path = c.req.path;
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const userId = c.get('userId') || ip;

    // Find matching rate limit config
    const configKey = Object.keys(RATE_LIMITS).find(k => path.startsWith(k));
    if (!configKey) { await next(); return; }

    const config = RATE_LIMITS[configKey];
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(config.requests, config.window),
      analytics: true,
      prefix: `rl:${configKey}`,
    });

    const { success, limit, remaining, reset } = await ratelimit.limit(userId);

    // Always set rate limit headers
    c.header('X-RateLimit-Limit', limit.toString());
    c.header('X-RateLimit-Remaining', remaining.toString());
    c.header('X-RateLimit-Reset', reset.toString());

    if (!success) {
      return c.json({
        error: 'Rate limit exceeded',
        retry_after: Math.ceil((reset - Date.now()) / 1000),
      }, 429);
    }

    await next();
  };
};
```

| Endpoint Group | Unauthenticated | Authenticated | Super Admin |
|---|---|---|---|
| `/auth/*` | 10 req/min | — | — |
| `/stores/*` | — | 60 req/min | 300 req/min |
| `/products/*` | 30 req/min (read) | 60 req/min | 300 req/min |
| `/orders/*` | 10 req/min (create) | 30 req/min | 300 req/min |
| `/ai/*` | — | 20 req/min | 100 req/min |
| `/admin/*` | — | — | 300 req/min |
| `/upload/*` | — | 10 req/min | 50 req/min |

### 8.3 Input Validation (Zod)

All API routes use **Zod schemas** for strict request validation — invalid payloads are rejected before reaching any business logic:

```typescript
import { z } from 'zod';

// Product creation schema
const createProductSchema = z.object({
  name: z.string().min(1).max(255).trim(),
  price: z.number().positive().max(9999999.99),
  description: z.string().max(10000).optional(),
  status: z.enum(['draft', 'active']).default('draft'),
  images: z.array(z.string().url()).max(10).optional(),
  variants: z.array(z.object({
    name: z.string().min(1).max(100),
    price: z.number().positive(),
    sku: z.string().max(50).optional(),
    stock: z.number().int().min(0).default(0),
  })).max(100).optional(),
  category: z.string().max(100).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

// Store update schema (with XSS prevention)
const updateStoreSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(5000).optional(),
  logo_url: z.string().url().optional(),
  currency: z.enum(['INR', 'USD', 'EUR', 'GBP']).optional(),
  timezone: z.string().max(50).optional(),
}).refine(data => Object.keys(data).length > 0, {
  message: 'At least one field must be provided',
});

// Hono middleware integration
app.post('/v1/stores/:storeId/products',
  validate('json', createProductSchema),
  async (c) => {
    const validatedData = c.req.valid('json');  // Type-safe, guaranteed valid
    // ... handler logic
  }
);
```

### 8.4 Security Headers

```typescript
// middleware/security-headers.ts — Applied to all responses
const setSecurityHeaders = (): MiddlewareHandler => {
  return async (c, next) => {
    await next();

    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('X-XSS-Protection', '0');  // Disabled — CSP is the preferred defense
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    c.header('X-DNS-Prefetch-Control', 'off');
    c.header('X-Download-Options', 'noopen');
    c.header('X-Permitted-Cross-Domain-Policies', 'none');

    // CSP: strict but allows Supabase, Cloudflare, and CDN origins
    c.header('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://*.unsplash.com",
      "connect-src 'self' https://*.supabase.co https://api.letbuyy.store wss://*.supabase.co",
      "frame-src https://challenges.cloudflare.com",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '));
  };
};
```

### 8.5 Webhook Signature Verification

External services (Stripe, Razorpay, Resend) send webhooks to `webhooks.letbuyy.store`. Each webhook is verified cryptographically before processing:

```typescript
// webhooks/verify.ts — Signature verification for payment providers

// Stripe webhook verification
async function verifyStripeWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    if (key === 't') acc.timestamp = value;
    if (key === 'v1') acc.signature = value;
    return acc;
  }, { timestamp: '', signature: '' });

  const signedPayload = `${parts.timestamp}.${payload}`;
  const expectedSignature = await hmacSHA256(secret, signedPayload);

  // Timing-safe comparison prevents timing attacks
  return timingSafeEqual(expectedSignature, parts.signature);
}

// Razorpay webhook verification
async function verifyRazorpayWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature = await hmacSHA256(secret, payload);
  return timingSafeEqual(expectedSignature, signature);
}

// Timing-safe string comparison (prevents timing attacks)
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

// Webhook handler with verification + idempotency
app.post('/webhooks/stripe', async (c) => {
  const payload = await c.req.text();
  const signature = c.req.header('Stripe-Signature') || '';

  const isValid = await verifyStripeWebhook(
    payload, signature, c.env.STRIPE_WEBHOOK_SECRET
  );

  if (!isValid) {
    console.error('Invalid Stripe webhook signature');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  const event = JSON.parse(payload);

  // Idempotency check: skip already-processed events
  const processed = await c.env.KV.get(`webhook:${event.id}`);
  if (processed) return c.json({ received: true });

  // ... handle event
  await c.env.KV.put(`webhook:${event.id}`, '1', { expirationTtl: 86400 });

  return c.json({ received: true });
});
```

---

## 9. AI-Powered Security

### 9.1 Fraud Detection

AI models analyze patterns to detect suspicious activity:

| Signal | Detection Method | Action |
|---|---|---|
| **Rapid account creation** | Same IP creates 5+ accounts in 1 hour | Auto-block IP, flag accounts |
| **Suspicious orders** | Multiple orders with different cards, same address | Hold orders, alert admin |
| **Content spam** | AI-generated store content detected as spam | Flag store for review |
| **Bot traffic** | Abnormal request patterns | Rate limit, CAPTCHA challenge |
| **Credential stuffing** | Failed login pattern analysis | Progressive lockout, alert |

### 9.2 Content Moderation

AI automatically reviews store content for:
- Prohibited products (illegal goods, counterfeits)
- Inappropriate imagery
- Copyright infringement signals
- Misleading pricing or claims

```
Store publishes content
    │
    ├── AI Content Scanner (async)
    │   ├── Text analysis → Flag inappropriate content
    │   ├── Image analysis → Flag prohibited images
    │   └── Price analysis → Flag suspicious pricing
    │
    └── Results
        ├── Clean → No action
        ├── Flagged → Notify employee (operations team)
        └── Severe → Auto-unpublish + notify super admin
```

---

## 10. Security Policies & Compliance

### 10.1 Data Protection

| Policy | Implementation |
|---|---|
| **Encryption at rest** | Supabase PostgreSQL (AES-256) |
| **Encryption in transit** | TLS 1.3 everywhere |
| **PII handling** | Minimal collection, encrypted storage |
| **Data retention** | Configurable per store owner |
| **Right to deletion** | Account + data purge API |
| **Audit logging** | All admin/employee actions logged |

### 10.2 Secrets Management

| Secret Type | Storage | Rotation |
|---|---|---|
| API keys (Stripe, Razorpay) | Cloudflare Workers Secrets | Manual, quarterly |
| Database credentials | Supabase dashboard | Auto-managed |
| JWT secret | Supabase Auth | Auto-managed |
| AI API keys (Gemini, Anthropic) | Cloudflare Workers Secrets | Manual, quarterly |
| 2FA seeds | Supabase encrypted column | Per-user |

### 10.3 Incident Response

```
Security incident detected
    │
    ├── 1. Automated response
    │       └── Block IP / disable account / rate limit
    │
    ├── 2. Alert dispatched
    │       └── Push + email to super admin
    │
    ├── 3. Audit log entry
    │       └── Full context: IP, user agent, action, timestamp
    │
    └── 4. Post-incident
            └── Review audit logs, update rules, notify affected users
```

---

## 11. Cross-Domain Session Architecture

### 11.1 The Problem

LetBuyy runs across **6 subdomains** (accounts, admin, team, console, *.store storefronts, marketing). Supabase session cookies are scoped to the domain they're set on — a cookie from `accounts.letbuyy.store` is **not visible** on `admin.letbuyy.store`. This requires an explicit session-sharing strategy.

### 11.2 Session Sharing Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CROSS-DOMAIN SESSION SHARING via accounts.letbuyy.store               │
│                                                                         │
│  Step 1: User authenticates on accounts.letbuyy.store                  │
│  ├── Supabase creates session → cookie set on accounts.letbuyy.store    │
│  ├── Server creates short-lived session_transfer token (30s TTL)       │
│  └── Stored in KV: session_transfer:{token} → { user_id, session_id } │
│                                                                         │
│  Step 2: Redirect to target app with transfer token                    │
│  ├── URL: admin.letbuyy.store/callback?session_token=xxxx              │
│  └── Token is single-use, expires in 30 seconds                        │
│                                                                         │
│  Step 3: Target app exchanges token for session                        │
│  ├── POST /v1/auth/session/exchange { token: xxxx }                    │
│  ├── Worker validates token in KV → retrieves user_id + session_id     │
│  ├── Worker calls supabase.auth.admin.getUser(user_id)                 │
│  ├── Sets Supabase session cookie on admin.letbuyy.store               │
│  └── Deletes token from KV (single-use enforcement)                    │
│                                                                         │
│  Step 4: User is now authenticated on admin.letbuyy.store              │
│  └── All subsequent requests use local Supabase cookie                 │
│                                                                         │
│  SECURITY:                                                              │
│  ├── Tokens are cryptographically random (128 bits)                     │
│  ├── 30-second TTL prevents replay                                      │
│  ├── Single-use enforcement via KV atomic delete                        │
│  └── Transfer only works for pre-registered redirect domains            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 11.3 Session Transfer Implementation

```typescript
// accounts app: POST /api/auth/session/create-transfer
export async function createSessionTransfer(userId: string, targetDomain: string, env: Env) {
  // Validate target domain is in allowlist
  const ALLOWED_DOMAINS = [
    'admin.letbuyy.store',
    'team.letbuyy.store',
    'console.letbuyy.store',
  ];

  if (!ALLOWED_DOMAINS.includes(targetDomain)) {
    throw new Error('Invalid redirect domain');
  }

  // Generate cryptographically random token
  const token = crypto.randomUUID() + '-' + crypto.randomUUID();

  // Store in KV with 30-second TTL
  await env.KV.put(
    `session_transfer:${token}`,
    JSON.stringify({ userId, targetDomain, createdAt: Date.now() }),
    { expirationTtl: 30 }
  );

  return token;
}

// Target app: GET /callback?session_token=xxxx
export async function exchangeSessionToken(token: string, env: Env) {
  // Atomic get + delete (prevents reuse)
  const data = await env.KV.get(`session_transfer:${token}`, 'json');
  if (!data) throw new Error('Invalid or expired session token');

  await env.KV.delete(`session_transfer:${token}`);

  // Create Supabase session for this user on the target domain
  const supabase = createServiceRoleClient(env);
  const { data: { user } } = await supabase.auth.admin.getUserById(data.userId);

  return user;
}
```

---

## 12. Turnstile Anti-Bot Integration

### 12.1 Where Turnstile is Required

| Page/Action | Turnstile Mode | Fallback |
|---|---|---|
| Login form | Managed (visible if suspicious) | Block submission |
| Signup form | Managed | Block submission |
| Password reset | Invisible | Block submission |
| Contact forms | Invisible | Block submission |
| Checkout | Invisible | Block submission |
| API rate limit exceeded | Interactive challenge | Retry after solve |

### 12.2 Client-Side Integration

```tsx
// components/TurnstileWidget.tsx
'use client';

import { Turnstile } from '@marsidev/react-turnstile';

interface Props {
  onVerify: (token: string) => void;
  mode?: 'managed' | 'invisible' | 'non-interactive';
}

export function TurnstileWidget({ onVerify, mode = 'managed' }: Props) {
  return (
    <Turnstile
      siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
      onSuccess={onVerify}
      options={{
        theme: 'auto',           // Matches user's system theme
        size: 'normal',
        appearance: mode,
        retry: 'auto',
        retryInterval: 8000,     // Retry every 8 seconds on failure
        refreshExpired: 'auto',  // Re-challenge when token expires
      }}
    />
  );
}
```

### 12.3 Server-Side Verification

```typescript
// middleware/turnstile.ts — Verify Turnstile token on server
async function verifyTurnstile(token: string, env: Env): Promise<boolean> {
  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
      }),
    }
  );

  const result = await response.json<{ success: boolean; 'error-codes'?: string[] }>();

  if (!result.success) {
    console.warn('Turnstile verification failed:', result['error-codes']);
  }

  return result.success;
}

// Usage in auth handler
app.post('/v1/auth/login', async (c) => {
  const { email, password, turnstileToken } = await c.req.json();

  // Verify bot protection FIRST
  const isHuman = await verifyTurnstile(turnstileToken, c.env);
  if (!isHuman) {
    return c.json({ error: 'Bot detection failed. Please try again.' }, 403);
  }

  // Continue with authentication...
});
```

---

## 13. Audit Logging System

### 13.1 Audit Log Schema

```sql
CREATE TABLE activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- WHO
  actor_id UUID REFERENCES auth.users(id),
  actor_email TEXT,
  actor_role TEXT,                    -- 'admin' | 'employee' | 'super_admin'
  actor_ip INET,
  actor_user_agent TEXT,
  
  -- WHAT
  action TEXT NOT NULL,              -- 'product_created' | 'order_refunded' | etc.
  resource_type TEXT NOT NULL,       -- 'product' | 'order' | 'store' | etc.
  resource_id UUID,
  
  -- WHERE
  store_id UUID REFERENCES stores(id),
  
  -- DETAILS
  changes JSONB,                     -- { before: {...}, after: {...} }
  metadata JSONB,                    -- Extra context (browser, location, etc.)
  
  -- WHEN
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- INDEXING
  CONSTRAINT valid_action CHECK (action <> '')
);

-- Fast lookup indexes
CREATE INDEX idx_audit_store ON activity_logs(store_id, created_at DESC);
CREATE INDEX idx_audit_actor ON activity_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON activity_logs(action, created_at DESC);
CREATE INDEX idx_audit_resource ON activity_logs(resource_type, resource_id);
```

### 13.2 Logged Actions

| Action | Resource Type | When | Details Captured |
|---|---|---|---|
| `employee_invited` | team_member | Employee invite sent | inviter_id, invitee_email, role |
| `employee_deactivated` | team_member | Team member removed | deactivator_id, reason |
| `product_created` | product | New product published | product_name, price, category |
| `product_deleted` | product | Product removed | product_name, deletion_reason |
| `order_refunded` | order | Refund processed | order_id, amount, refund_reason |
| `store_settings_updated` | store | Settings changed | before/after diff |
| `password_changed` | user | Password updated | method (reset vs manual) |
| `2fa_enabled` | user | 2FA activated | enrollment_method |
| `login_failed` | user | Failed login attempt | IP, user_agent, failure_reason |
| `bulk_export` | store | Data exported | export_type, record_count |
| `theme_changed` | store | Store theme updated | old_theme, new_theme |
| `domain_connected` | store | Custom domain linked | domain_name |

### 13.3 Audit Logger Utility

```typescript
// lib/audit.ts — Centralized audit logger
interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string;
  storeId?: string;
  changes?: { before?: Record<string, unknown>; after?: Record<string, unknown> };
  metadata?: Record<string, unknown>;
}

export async function logAuditEvent(
  c: Context,                // Hono context (contains user, IP, etc.)
  supabase: SupabaseClient,
  entry: AuditEntry
): Promise<void> {
  const userId = c.get('userId');
  const userEmail = c.get('userEmail');
  const userRole = c.get('role');

  await supabase.from('activity_logs').insert({
    actor_id: userId,
    actor_email: userEmail,
    actor_role: userRole,
    actor_ip: c.req.header('CF-Connecting-IP'),
    actor_user_agent: c.req.header('User-Agent'),
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    store_id: entry.storeId,
    changes: entry.changes,
    metadata: {
      ...entry.metadata,
      request_id: c.req.header('X-Request-ID'),
      timestamp: new Date().toISOString(),
    },
  });
}
```

---

## 14. Cryptographic Standards

### 14.1 Algorithms in Use

| Purpose | Algorithm | Key Length | Notes |
|---|---|---|---|
| Password hashing | bcrypt | 10 rounds | Supabase Auth default |
| JWT signing | HS256 | 256-bit | Supabase Auth managed |
| Session transfer tokens | crypto.randomUUID() | 128-bit | CSPRNG |
| Webhook signatures | HMAC-SHA256 | 256-bit | Stripe/Razorpay standard |
| OTP generation | TOTP (RFC 6238) | 160-bit seed | 6 digits, 30s window |
| Invite tokens | HMAC-SHA256 | 256-bit | email + store_id + timestamp |
| Database encryption | AES-256-GCM | 256-bit | Supabase managed (at-rest) |
| TLS | TLS 1.3 | — | Cloudflare managed |
| Cookie encryption | AES-256 | 256-bit | @supabase/ssr session chunks |

### 14.2 Key Rotation Policy

```
┌──────────────────────────────────────────────────────┐
│  KEY ROTATION SCHEDULE                                │
│                                                       │
│  Automatic (managed by provider):                    │
│  ├── Supabase JWT secret → rotated on project reset  │
│  ├── TLS certificates → Cloudflare auto-renewal      │
│  └── Database encryption keys → Supabase managed     │
│                                                       │
│  Manual (quarterly — 1st of Jan/Apr/Jul/Oct):        │
│  ├── Stripe API keys → Dashboard + Worker secrets    │
│  ├── Razorpay API keys → Dashboard + Worker secrets  │
│  ├── Gemini/Anthropic keys → Dashboard + Worker      │
│  ├── Resend API key → Dashboard + Worker secrets     │
│  └── Turnstile secret key → CF Dashboard + Worker    │
│                                                       │
│  Emergency (on compromise):                          │
│  ├── Immediately rotate compromised key              │
│  ├── Revoke all active sessions (global signout)     │
│  ├── Audit log review for unauthorized access        │
│  └── Notify affected users within 24 hours           │
└──────────────────────────────────────────────────────┘
```

---

## 15. Account Lifecycle Management

### 15.1 Account States

```
┌────────────┐     ┌────────────┐     ┌────────────┐     ┌────────────┐
│  CREATED   │────►│  VERIFIED  │────►│   ACTIVE   │────►│ SUSPENDED  │
│ (email OTP │     │ (email     │     │ (using     │     │ (violation │
│  pending)  │     │  confirmed)│     │  platform) │     │  or abuse) │
└────────────┘     └────────────┘     └──────┬─────┘     └────────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  DEACTIVATED    │
                                    │  (user request) │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │    DELETED      │
                                    │  (after 30-day  │
                                    │   grace period) │
                                    └─────────────────┘
```

### 15.2 Account Deletion Flow

```
User requests account deletion (Settings → Delete Account)
    │
    ├── 1. Confirmation: "Are you sure? This will delete ALL your stores, products, and data."
    │       └── Requires password re-entry + 2FA (if enabled)
    │
    ├── 2. Soft delete initiated:
    │       └── Account status → 'deactivated'
    │       └── All sessions revoked (global signout)
    │       └── All stores set to status = 'suspended'
    │       └── All storefronts show "This store is no longer available"
    │       └── Email sent: "Your account deletion is scheduled for {date}"
    │
    ├── 3. 30-day grace period:
    │       └── User can cancel by logging in
    │       └── Data is preserved but inaccessible
    │       └── Reminder emails at day 7, 14, and 25
    │
    └── 4. Permanent deletion (day 30):
            └── Cron job: DELETE FROM auth.users WHERE id = user_id
            └── CASCADE deletes: stores, products, orders, pages, portfolios
            └── AI usage records anonymized (user_id set to NULL)
            └── Supabase Storage: all uploaded files purged
            └── Activity logs preserved (anonymized) for compliance
            └── Final email: "Your account and data have been permanently deleted"
```

---

## 16. Environment Variable Security

### 16.1 Secret Distribution Matrix

| Secret | Stored In | Accessible By | Never Exposed To |
|---|---|---|---|
| `SUPABASE_URL` | `.env.local` / Vercel | All apps (public) | — |
| `SUPABASE_ANON_KEY` | `.env.local` / Vercel | All apps (public) | — |
| `SUPABASE_SERVICE_ROLE_KEY` | Worker Secrets | Workers only | Browser, Vercel |
| `STRIPE_SECRET_KEY` | Worker Secrets | Payment worker | Browser, Vercel |
| `STRIPE_WEBHOOK_SECRET` | Worker Secrets | Webhook worker | Browser, Vercel |
| `RAZORPAY_KEY_SECRET` | Worker Secrets | Payment worker | Browser, Vercel |
| `GEMINI_API_KEY` | Worker Secrets | AI worker | Browser, Vercel |
| `ANTHROPIC_API_KEY` | Worker Secrets | AI worker | Browser, Vercel |
| `RESEND_API_KEY` | Worker Secrets | Email worker | Browser, Vercel |
| `TURNSTILE_SECRET_KEY` | Worker Secrets | Auth worker | Browser (site key only) |
| `UPSTASH_REDIS_URL` | Worker Secrets | Rate limiting | Browser, Vercel |
| `CF_API_TOKEN` | Worker Secrets | DNS worker | Browser, Vercel |

### 16.2 Environment Rules

```
┌──────────────────────────────────────────────────────────────────────┐
│  ENVIRONMENT VARIABLE RULES                                           │
│                                                                       │
│  Rule 1: NEXT_PUBLIC_ prefix = browser-safe, OK to expose            │
│  ├── NEXT_PUBLIC_SUPABASE_URL                                         │
│  ├── NEXT_PUBLIC_SUPABASE_ANON_KEY                                    │
│  └── NEXT_PUBLIC_TURNSTILE_SITE_KEY                                   │
│                                                                       │
│  Rule 2: No NEXT_PUBLIC_ prefix = server-only, NEVER in browser     │
│  ├── SUPABASE_SERVICE_ROLE_KEY                                        │
│  ├── All payment provider secrets                                     │
│  └── All AI provider keys                                             │
│                                                                       │
│  Rule 3: Workers Secrets = most sensitive, edge-only                 │
│  ├── Deployed via: wrangler secret put KEY_NAME                      │
│  ├── Never committed to Git                                           │
│  ├── Not in .env files                                                │
│  └── Only accessible in worker runtime (c.env.KEY_NAME)              │
│                                                                       │
│  Rule 4: .env files are NEVER committed                              │
│  ├── .gitignore includes: .env, .env.local, .env.*.local             │
│  ├── .env.example provides structure (no real values)                │
│  └── Vercel env vars set via dashboard (encrypted at rest)           │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 17. Compliance & Privacy

### 17.1 Data Collection Minimization

| Data Type | Collected | Purpose | Retention |
|---|---|---|---|
| Email | ✅ Required | Auth, communication | Account lifetime |
| Password hash | ✅ Required | Auth | Account lifetime |
| Name | ✅ Required | Profile, invoicing | Account lifetime |
| IP address | ✅ Auto | Security, rate limiting | 90 days (logs) |
| User agent | ✅ Auto | Device identification | 90 days (logs) |
| Payment info | ❌ Never stored | Processed by Stripe/Razorpay | Provider-managed |
| Location | ❌ Not collected | — | — |
| Phone number | ⚙️ Optional | 2FA, notifications | Account lifetime |

### 17.2 GDPR-Adjacent Compliance

Although LetBuyy primarily targets Indian users, the platform follows GDPR-inspired principles:

- **Right to Access:** Users can export all their data via Settings → Export Data (JSON/CSV)
- **Right to Deletion:** Full account + data deletion with 30-day grace period
- **Data Portability:** Store data exportable in standard formats
- **Consent:** Clear opt-in for marketing emails (not bundled with account creation)
- **Cookie Policy:** Session cookies only — no tracking cookies, no third-party analytics cookies
- **Privacy Policy:** Accessible at `letbuyy.store/privacy` — updated annually or on material changes

---

## 18. Security Incident Response Playbook

### 18.1 Incident Severity Levels

| Level | Description | Response Time | Examples |
|---|---|---|---|
| **P0 — Critical** | Data breach, auth bypass | < 15 minutes | Service role key exposed, SQL injection |
| **P1 — High** | Active exploit, mass abuse | < 1 hour | Brute force attack, XSS in production |
| **P2 — Medium** | Vulnerability discovered | < 24 hours | Dependency CVE, misconfigured RLS |
| **P3 — Low** | Hardening opportunity | < 1 week | Missing security header, rate limit tweak |

### 18.2 Response Procedure

```
INCIDENT DETECTED (automated alert or manual report)
    │
    ├── P0/P1: IMMEDIATE RESPONSE
    │   ├── 1. Contain: Disable affected service / block IPs / revoke tokens
    │   ├── 2. Assess: Determine blast radius (which users/stores affected)
    │   ├── 3. Mitigate: Deploy hotfix / rotate compromised secrets
    │   ├── 4. Communicate: Notify affected users within 24 hours
    │   └── 5. Post-mortem: Root cause analysis within 48 hours
    │
    ├── P2: PLANNED RESPONSE
    │   ├── 1. Document: Create issue with full technical details
    │   ├── 2. Prioritize: Schedule fix in next sprint
    │   ├── 3. Test: Verify fix in staging environment
    │   └── 4. Deploy: Release with security advisory if needed
    │
    └── P3: IMPROVEMENT CYCLE
        ├── 1. Log: Add to security backlog
        ├── 2. Review: Quarterly security review
        └── 3. Implement: Bundle with regular releases
```

### 18.3 Automated Detection Rules

| Rule | Trigger | Automated Action |
|---|---|---|
| Credential stuffing | > 20 failed logins/min from 1 IP | Block IP for 1 hour |
| Account takeover | Password changed + login from new IP/device | Email alert to user |
| API abuse | > 5x rate limit in 5 minutes | Escalate to interactive Turnstile |
| Suspicious admin action | Bulk data export or mass delete | Email to super admin + audit log |
| Token reuse | Refresh token replayed (detected by Supabase) | Revoke ALL user sessions |
| Service role leak | Service role key detected in client bundle | Emergency rotation + P0 alert |

---

> **Next:** [03 Onboarding & Trial](./03_Onboarding_and_Trial.md) — Signup → store creation → trial countdown → payment activation

---

*[← Back to Index](./README.md)*
