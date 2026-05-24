# LetBuyy — Multi-Tenant SaaS Platform

> Shopify-class platform for e-commerce stores, portfolios, resumes, blogs & landing pages.
> Freemium SaaS with subscription tiers. India-first, then global.

---

## 1. Project Identity

**Name:** LetBuyy  
**One-liner:** Build and manage e-commerce stores, portfolios, resumes, blogs, and landing pages — all from one platform.  
**Business Model:** Freemium SaaS — Free → Starter → Business → Enterprise tiers, plus theme/app marketplace revenue.  
**Target Market:** Small/medium merchants, freelancers, job seekers, marketers — India-first, then global.

---

## 2. Applications & Services

| App | Location | Domain | Port | Purpose |
|-----|----------|--------|------|---------| 
| Landing | `apps/web/consumer/landing` | `letbuyy.store` | 3000 | Marketing site, pricing, signup CTA (NO auth pages) |
| Accounts | `apps/web/consumer/accounts` | `accounts.letbuyy.store` | 3001 | ALL authentication — login, signup, OTP, password, OAuth, 2FA, onboarding |
| Admin | `apps/web/consumer/admin` | `admin.letbuyy.store/{store}` | 3002 | Per-store CMS dashboard (adaptive UI per site type) |
| Storefront | `apps/web/consumer/storefront` | `*.letbuyy.store` | 3003 | Public storefronts via wildcard DNS + ISR |
| App Store | `apps/web/consumer/app-store` | `apps.letbuyy.store` | 3004 | Extension/app marketplace |
| Theme Market | `apps/web/consumer/theme-marketplace` | `themes.letbuyy.store` | 3005 | Theme browsing & purchase |
| Console | `apps/web/administrative/console` | `console.letbuyy.store` | 3010 | Super Admin — platform control (VPN + 2FA + IP allowlist) |
| Team | `apps/web/administrative/team` | `team.letbuyy.store` | 3011 | Employee portal — support, marketing, moderation |
| Builder | `apps/flutter/builder` | N/A (native) | N/A | Mobile/desktop store builder (Flutter) |
| API | `backend/workers/api` | `api.letbuyy.store` | 8787 | Cloudflare Workers REST API (Hono) |

---

## 3. Documentation Hierarchy

```
CLAUDE.md                     ← THIS FILE — Project rules, standards, hard rules
├── docs/LETBUYY.md           ← Single source of truth — everything about the platform
├── tasks/todo.md             ← Phased task list with progress tracking
└── memory/lessons.md         ← Anti-patterns & lessons learned from audits
```

> **Rule:** No other documentation files should exist. All content lives in these 4 files.

---

## 4. Complete Tech Stack

| Layer | Technology | Version | Role |
|-------|-----------|---------|------|
| **Web Framework** | Next.js (App Router) | 16 | All web apps — SSR/SSG/ISR |
| **UI Library** | React | 19 | Component rendering |
| **Styling** | Tailwind CSS | 4 | Utility-first CSS with design tokens |
| **Component Library** | ShadCN/UI + Radix | Latest | Base component layer |
| **Animation** | Framer Motion, GSAP, Lenis | 11.x, 3.x | Page transitions, scroll effects |
| **Icons** | Lucide React | Latest | Web icon system (Outlined default) |
| **Mobile** | Flutter | 3.10+ (Dart 3.6+) | Builder, Super Admin, Team native apps |
| **Monorepo (TS)** | Turborepo + pnpm | 10.6 | Build orchestration, workspace mgmt |
| **Monorepo (Dart)** | Melos | 7 | Flutter workspace management |
| **API Framework** | Hono | 4.7 | Cloudflare Workers REST API |
| **Validation** | Zod | 4 | Input validation + schema types |
| **Database** | PostgreSQL (Supabase) | 16 | Primary data store with RLS |
| **Auth** | Supabase Auth + jose | 2.95 / 6 | OTP, password, OAuth, JWT |
| **Caching** | Upstash Redis | — | Rate limiting, session cache |
| **Email** | Resend + React Email | — | Transactional emails |
| **Bot Protection** | Cloudflare Turnstile | — | CAPTCHA on auth forms |
| **Payments (India)** | Razorpay | — | UPI, netbanking, cards |
| **Payments (Global)** | Stripe | — | Cards, wallets, BNPL |
| **Payments (Intl)** | PayPal | — | PayPal balance, cards |
| **Password Hashing** | bcryptjs | — | Password storage (min 10 rounds) |
| **File Storage** | Supabase Storage + Cloudflare R2 | — | Media uploads, assets |
| **Edge Compute** | Cloudflare Workers | — | API hosting, webhooks |
| **KV Store** | Cloudflare KV | — | Feature flags, edge cache (NOT YET CONFIGURED) |
| **Web Hosting** | Vercel | — | Next.js app deployments |
| **DNS** | Cloudflare | — | Domain management |
| **Infrastructure** | Terraform | — | DNS configuration as code |

---

## 5. Complete Monorepo Structure

```
Letbuyy_Store/
├── apps/
│   ├── web/
│   │   ├── consumer/
│   │   │   ├── accounts/          # Auth portal — login, signup, OTP, password reset
│   │   │   ├── admin/             # Store builder — [store]/ dynamic routes, adaptive UI
│   │   │   ├── landing/           # Marketing — homepage, pricing, signup CTAs
│   │   │   ├── storefront/        # Public storefronts — cart, checkout, products
│   │   │   ├── app-store/         # Extension marketplace
│   │   │   └── theme-marketplace/ # Theme marketplace
│   │   └── administrative/
│   │       ├── console/           # Super Admin (SCAFFOLD ONLY — ~10% built)
│   │       └── team/              # Employee Portal (SCAFFOLD ONLY — ~10% built)
│   └── flutter/
│       ├── builder/               # Store Builder (Flutter) — 35 screens, 14 services
│       ├── super_admin/           # Super Admin (Flutter)
│       └── team/                  # Team Portal (Flutter)
├── backend/
│   ├── workers/
│   │   └── api/                   # Hono API on Cloudflare Workers
│   ├── supabase/
│   │   ├── migrations/            # 28 SQL migration files (duplicate 022 — needs fix)
│   │   ├── seed/                  # Seed data (001_seed.sql)
│   │   ├── functions/             # Supabase Edge Functions
│   │   └── config.toml            # Supabase local dev config
│   └── _legacy/                   # Deprecated code — do not use
├── packages/
│   ├── typescript/
│   │   ├── api-types/             # @letbuyy/api-types — shared TypeScript types
│   │   ├── ui/                    # @letbuyy/ui — shared components (Button, Input, DataTable)
│   │   └── utils/                 # @letbuyy/utils — supabase client, auth helpers, API utils
│   └── dart/
│       ├── core/                  # Dart core utilities
│       ├── models/                # Shared data models
│       ├── services/              # Shared API services
│       └── ui_kit/                # Shared Flutter widgets
├── docs/
│   └── LETBUYY.md                 # Single source of truth (unified doc)
├── tasks/
│   └── todo.md                    # Task list by phase
├── memory/
│   └── lessons.md                 # Lessons learned & anti-patterns
├── infrastructure/
│   └── dns.tf                     # Terraform DNS configuration
├── CLAUDE.md                      # THIS FILE
├── pubspec.yaml                   # Flutter/Melos workspace
├── pnpm-workspace.yaml            # pnpm workspace definition
├── turbo.json                     # Turborepo config
└── vercel.json                    # Vercel deployment config
```

---

## 6. Workflow Rules

### Plan Mode
- ALWAYS enter plan mode for tasks with 3+ steps
- Write implementation plan BEFORE writing any code
- Get user approval on the plan before proceeding

### Subagent Strategy
- Break large features into atomic, testable subtasks
- Each subtask should touch ≤3 files when possible
- Verify each subtask before moving to the next

### Self-Improvement Loop
- After every feature: check `memory/lessons.md` for related anti-patterns
- If you create a new anti-pattern, add it to `memory/lessons.md` immediately
- Update `tasks/todo.md` after completing any task

### Verification Before Done
- Run `pnpm build` in the affected app(s)
- Run `pnpm lint` and fix all errors
- For Flutter: run `flutter analyze` in the affected package
- Test the actual user flow in the browser/emulator
- Check that no hardcoded secrets or mock data exist

### Elegance Standard
- Every UI must look production-grade — premium SaaS aesthetic
- No placeholder styling, no unstyled components
- Dark mode on every screen from day one
- Skeleton loading states, never spinners

### Autonomous Bug Fixing
- If you break something while implementing, fix it immediately
- Do not leave broken builds or lint errors
- If a fix requires architectural changes, stop and re-plan

---

## 7. Architecture Principles

### Clean Architecture Layers

```
┌─────────────────────────────────────────────────┐
│  PRESENTATION — Next.js Pages, Flutter Screens  │
│  (src/app/**, screens/**)                       │
├─────────────────────────────────────────────────┤
│  API ROUTES — Next.js Route Handlers            │
│  (src/app/api/**)                               │
├─────────────────────────────────────────────────┤
│  APPLICATION — Services, Business Logic         │
│  (src/lib/services/**, services/**)             │
├─────────────────────────────────────────────────┤
│  DOMAIN — Types, Models, Schemas                │
│  (packages/typescript/api-types, packages/dart) │
├─────────────────────────────────────────────────┤
│  INFRASTRUCTURE — Supabase Client, API Client   │
│  (packages/typescript/utils, src/lib/supabase)  │
├─────────────────────────────────────────────────┤
│  DATA — Supabase PostgreSQL, Cloudflare KV/R2   │
│  (backend/supabase/migrations/**)               │
└─────────────────────────────────────────────────┘
```

**Rules:**
- **NEVER** put business logic in pages, screens, or API route handlers
- **NEVER** call Supabase directly from React components — always through service functions
- **ALWAYS** validate inputs with Zod before processing
- **ALWAYS** use shared types from `@letbuyy/api-types`

---

## 8. Database Rules

- **ORM:** Supabase JS SDK (no Prisma) — raw SQL only in migration files
- **Migrations:** Sequential numbered files in `backend/supabase/migrations/`
- **Migration naming:** `NNN_descriptive_name.sql` — never duplicate numbers (DUPLICATE 022 EXISTS — fix immediately)
- **Every table MUST have:** `id UUID PK`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`
- **Soft deletes:** `deleted_at TIMESTAMPTZ DEFAULT NULL` on every entity table (NOT YET IMPLEMENTED — GAP)
- **Audit columns:** `created_by UUID`, `updated_by UUID` on multi-user tables (NOT YET IMPLEMENTED — GAP)
- **Version column:** `version INT DEFAULT 1` for optimistic locking on concurrent-write tables (NOT YET IMPLEMENTED — GAP)
- **RLS:** Row Level Security MUST be enabled on every table with appropriate policies
- **Indexes:** Every FK, every frequently-queried column, and every filtered/sorted column must be indexed
- **Naming:** Tables and columns use `snake_case`
- **Primary entity:** `sites` table in DB, `store` in URLs/UI — document this mapping, never create a `stores` table
- **Foreign keys:** All content tables reference `sites(id)` via `site_id`
- **Trigger function:** Use ONLY `update_updated_at()` — DO NOT use `update_updated_at_column()` or `update_modified_at()`
- **Order items:** MUST be a separate `order_items` relational table — NEVER use JSONB for order items (CURRENT CODE USES JSONB — GAP)

---

## 9. Auth Architecture

```
SIGNUP FLOW:
  User → letbuyy.store (clicks "Get Started")
    → REDIRECT to accounts.letbuyy.store/signup
    → Email + Turnstile bot check
    → OTP verification (6-digit, 10min expiry, max 3 attempts)
    → Password creation (bcrypt, min 10 rounds)
    → Supabase Auth user record created
    → JWT token issued via jose
    → HTTP-only cookie set (SameSite=Strict)
    → Redirect to onboarding (if no stores) or admin dashboard

LOGIN FLOW:
  User → accounts.letbuyy.store/login
    → Email lookup → existing? show password : redirect to signup
    → Email + Password (bcrypt verify)
    → Supabase Auth session created
    → JWT token issued
    → HTTP-only cookie set
    → Redirect to store selector or admin

ADMIN ACCESS:
  User → admin.letbuyy.store/{store}
    → Middleware verifies JWT + store ownership via RLS
    → Store context loaded (site_type determines UI)

STOREFRONT CUSTOMER AUTH:
  Customer → {store}.letbuyy.store
    → Email-based customer accounts
    → Separate customer_credentials table
    → Session via CUSTOMER_SESSION_SECRET

SUPER ADMIN AUTH:
  → Email allowlist (founders only)
  → 2FA mandatory (TOTP via authenticator app)
  → VPN + IP whitelist required (NOT YET IMPLEMENTED — GAP)

TOKEN STRATEGY:
  → Access token: JWT via jose, 1 hour expiry
  → Refresh token: Supabase-managed, 7 day expiry
  → CSRF: Double-submit cookie pattern via CSRF_SECRET
  → Storage: HTTP-only + Secure + SameSite=Strict cookies ONLY
  → NEVER store tokens in localStorage
```

**CRITICAL RULE:** `letbuyy.store` has ZERO auth pages. All auth lives exclusively on `accounts.letbuyy.store`.

---

## 10. Security Standards (Derived from Audit)

### CRITICAL — Fix Before Any Other Work
1. **Rotate all committed secrets** — `all.env` contains live Supabase keys, Upstash tokens, Resend API key, Razorpay keys, auth secrets, CSRF secret. ALL must be rotated immediately.
2. **Add webhook signature verification** — Payment webhooks (Stripe, Razorpay, PayPal) currently have no signature verification.
3. **Add rate limiting to auth endpoints** — Only accounts app has partial rate limiting via Upstash Redis. All auth endpoints need it.
4. **Remove `all.env` from git history** — File is in the repository. Must be purged from git history and replaced with `all.env.example`.

### Mandatory Security Rules
- **Input validation:** Zod on EVERY API input — no exceptions
- **Password hashing:** bcryptjs (minimum 10 rounds, recommend 12)
- **JWT:** jose library for all token operations — short-lived access tokens (1 hour)
- **CSRF:** Double-submit cookie pattern via CSRF_SECRET on all mutating endpoints
- **Bot protection:** Cloudflare Turnstile on all auth forms
- **Rate limiting:** Upstash Redis on auth endpoints (5/min for sensitive ops, 60/min for reads)
- **RLS:** Supabase Row Level Security on every single table — no exceptions
- **HTTP-only cookies:** ALL auth tokens in HTTP-only, Secure, SameSite=Strict cookies
- **CORS:** Configured per-origin — NEVER use wildcard `*` in production
- **Webhook verification:** Cryptographically verify Razorpay/Stripe/PayPal webhook signatures BEFORE processing
- **Environment variables:** NEVER hardcode secrets — always use env vars via deployment dashboard
- **Service role key:** NEVER expose to client-side code — server-side only
- **Error responses:** NEVER expose internal error details, stack traces, or DB errors to clients
- **robots.txt:** `noindex, nofollow` on admin, console, team portals
- **Security headers:** Set `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`

---

## 11. API Design Standards

- **Base URL:** `api.letbuyy.store` (Cloudflare Worker)
- **Framework:** Hono 4.7 for main API gateway
- **Versioning:** ALL endpoints MUST be prefixed with `/api/v1/` (NOT YET IMPLEMENTED — GAP)
- **Auth:** JWT Bearer token in Authorization header or session cookie
- **Request format:** JSON body, Zod-validated at middleware level
- **Response format (success):**
  ```json
  { "data": {...}, "meta": { "page": 1, "limit": 20, "total": 100 } }
  ```
- **Response format (error):**
  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": [...] } }
  ```
- **Pagination:** `?page=1&limit=20` on all list endpoints
- **Idempotency:** Idempotency keys required for payment and mutation endpoints (NOT YET IMPLEMENTED — GAP)
- **Error codes:** Define as constants in `@letbuyy/api-types` (NOT YET IMPLEMENTED — GAP)

---

## 12. UI/UX Standards

### Design System
- **Component Library:** ShadCN/UI extended with `@letbuyy/ui` shared package
- **Styling:** Tailwind CSS 4 — utility-first, NO inline styles or raw CSS
- **Animations:** Framer Motion (page transitions), GSAP (scroll effects), Lenis (smooth scroll)
- **Icons:** Lucide React (web) — Outlined default, Filled for active states
- **Icons (Flutter):** Material Icons only — Outlined default, Filled for active/selected

### Typography
- **Font Family:** Inter (standardize across ALL apps — currently inconsistent, GAP)
- **Scale:** MD3-inspired — Display → Headline → Title → Body → Label
- **No mixing fonts** unless brand-specified

### Color System
- **Light + Dark mode:** MUST be implemented on every screen from day one
- **CSS variables:** Use semantic roles (`--color-primary`, `--color-surface`, `--color-error`, etc.)
- **No raw hex/rgb in components** — always reference design tokens
- **Design tokens:** Defined in `packages/typescript/ui/` (NOT YET IMPLEMENTED — GAP)

### Layout & Spacing
- **4px base grid:** 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px
- **Responsive:** Mobile-first, then tablet, then desktop
- **Admin navigation:** Sidebar on desktop, bottom nav on mobile

### Component Quality Bar
Every interactive element MUST have 5 states:
1. Default — Normal resting state
2. Hover — Visual feedback on mouse over
3. Focus — Keyboard navigation indicator
4. Active/Pressed — Click/tap feedback
5. Disabled — Greyed out, not interactive

### Loading States
- **Skeleton screens** — ALWAYS (never spinner-only)
- **Empty states** — Illustration + CTA
- **Error states** — Message + retry button
- **Success states** — Confirmation + next action

### Motion & Animation
- Durations: 100ms (micro), 200ms (small), 300ms (medium), 500ms (large)
- Easing: ease-in-out or MD3 curves
- NEVER block user interaction with animation

### Premium SaaS Aesthetic
- Clean, spacious, purposeful layouts
- Subtle gradients, proper elevation shadows
- Smooth transitions between states
- Production-grade on every screen — no placeholder styling

---

## 13. Performance Standards

- **N+1 queries:** NEVER — use eager loading or batch queries via Supabase `.select('*, relation(*)')`  
- **Indexes:** Define for every query pattern — check `backend/supabase/migrations/`
- **Caching:** Upstash Redis for repeated reads — expand to storefront product queries, theme config
- **Image optimization:** Next.js `<Image>` component, Supabase Storage transforms
- **Bundle size:** Monitor with Vercel analytics, code-split aggressively
- **Lighthouse:** Target 90+ on Performance, Accessibility, Best Practices, SEO
- **Edge computing:** API on Cloudflare Workers for sub-50ms global latency
- **ISR:** Storefronts use ISR with 60-second revalidation
- **KV caching:** Configure Cloudflare KV for feature flags and edge config (NOT YET CONFIGURED — GAP)
- **R2 storage:** Configure Cloudflare R2 for media uploads (NOT YET CONFIGURED — GAP)

---

## 14. Data Consistency & Transaction Rules

- **Transaction boundaries:** Use Supabase RPC functions for multi-table operations
- **Optimistic locking:** Version column on concurrent-write tables — increment on every update, reject if version mismatch
- **Idempotent operations:** Payment processing, order creation MUST be idempotent via idempotency keys
- **Order number generation:** Database trigger (`generate_order_number()`)
- **updated_at:** Auto-managed via database trigger (`update_updated_at()`)
- **Retry strategy:** Exponential backoff for external service calls (Stripe, Resend, etc.)
- **ACID compliance:** All multi-step operations wrapped in Supabase RPC transactions

---

## 15. Deployment Standards

- **Web apps:** Vercel (auto-deploy from GitHub `main` branch)
- **API:** Cloudflare Workers via `wrangler deploy`
- **Database:** Supabase hosted PostgreSQL
- **Domains:** Cloudflare DNS (managed via Terraform in `infrastructure/dns.tf`)
- **Environment separation:** dev, staging, production
- **CI/CD:** GitHub Actions — build → lint → test → deploy (NOT YET FULLY CONFIGURED — GAP)
- **Server Components:** `"use client"` ONLY when interactivity is required — default to Server Components
- **Environment variables:** NEVER hardcode — use `process.env` (Next.js) or `c.env` (Hono)
- **Zero-downtime:** Blue-green deployment strategy for production
- **Migrations:** Run automatically in CI/CD pipeline before app deployment

---

## 16. Task Management Protocol

1. Read `CLAUDE.md` and `memory/lessons.md` before starting any task
2. Check `tasks/todo.md` for current priorities
3. Enter plan mode for tasks with 3+ steps
4. Update `tasks/todo.md` after completing each task — mark `[x]`
5. Update `memory/lessons.md` if you discover new anti-patterns
6. Run `pnpm build` and `pnpm lint` before marking anything complete

---

## 17. Session Startup Checklist

```
[ ] Read CLAUDE.md
[ ] Read memory/lessons.md
[ ] Read tasks/todo.md
[ ] Identify the current task and its priority
[ ] Check if there are blocking issues (e.g., committed secrets)
[ ] Plan before coding (if 3+ steps)
```

---

## 18. Hard Rules — NEVER Break

1. **NEVER** use mock data in production — everything database-driven
2. **NEVER** hardcode secrets or config values — always env vars
3. **NEVER** commit `.env` files or secrets to git
4. **NEVER** put business logic in pages, screens, or API route handlers — use service modules
5. **NEVER** skip Zod validation on any API input
6. **NEVER** expose the Supabase service role key to client-side code
7. **NEVER** write raw SQL in application code — only in migration files
8. **NEVER** skip RLS policies on new tables
9. **NEVER** deploy without running `pnpm build` successfully
10. **NEVER** use `"use client"` unless the component requires interactivity
11. **NEVER** mix icon libraries — Lucide React only (web), Material Icons only (Flutter)
12. **NEVER** use spinner-only loading states — always skeleton screens
13. **NEVER** skip dark mode on any screen
14. **NEVER** process payment webhooks without cryptographic signature verification
15. **NEVER** store tokens in localStorage — HTTP-only cookies only
16. **NEVER** use inline hex/rgb color values in components — always design tokens
17. **NEVER** create unversioned API endpoints — must be `/api/v1/...`
18. **NEVER** deploy database changes without UP and DOWN migration scripts
19. **NEVER** skip error boundaries on page components
20. **NEVER** use `any` type in TypeScript — always properly typed
21. **NEVER** use Supabase Auth directly for custom flows — use custom JWT via jose
22. **NEVER** leave `console.log` in production code
23. **NEVER** bypass rate limiting on auth endpoints
24. **NEVER** trust client-sent prices for payment processing — always re-calculate server-side
25. **NEVER** expose internal error details, stack traces, or DB error messages to API clients
26. **NEVER** use CORS wildcard `*` in production — whitelist specific origins
27. **NEVER** duplicate migration numbers — always check latest before creating new ones
28. **NEVER** use `update_updated_at_column()` — only `update_updated_at()`
29. **NEVER** store order items as JSONB — use a relational `order_items` table
30. **NEVER** suppress lint warnings globally — fix the underlying issues

---

## 19. Always Do — Checklist

1. **ALWAYS** validate every API input with Zod schemas
2. **ALWAYS** use shared types from `@letbuyy/api-types`
3. **ALWAYS** implement both light and dark mode
4. **ALWAYS** use skeleton loading states (not spinners)
5. **ALWAYS** add error boundaries with retry buttons
6. **ALWAYS** use the 4px spacing grid (4, 8, 12, 16, 24, 32, 48, 64)
7. **ALWAYS** write UP and DOWN migrations
8. **ALWAYS** add RLS policies when creating new tables
9. **ALWAYS** add indexes on foreign keys and filtered/sorted columns
10. **ALWAYS** use `server-only` import for server-side code in Next.js
11. **ALWAYS** hash passwords with bcryptjs (min 10 rounds) before storage
12. **ALWAYS** verify webhook signatures before processing payments
13. **ALWAYS** use `@supabase/ssr` for server-side Supabase access in Next.js
14. **ALWAYS** implement pagination on list endpoints
15. **ALWAYS** add `updated_at` trigger on tables with that column
16. **ALWAYS** test on mobile viewport sizes
17. **ALWAYS** use environment variables for all config — never hardcode
18. **ALWAYS** update `tasks/todo.md` after completing features
19. **ALWAYS** check `memory/lessons.md` before starting work
20. **ALWAYS** re-calculate prices server-side before charging — never trust client
21. **ALWAYS** add `deleted_at`, `created_by`, `updated_by` columns to new entity tables
22. **ALWAYS** add `version INT DEFAULT 1` to tables with concurrent write potential
23. **ALWAYS** centralize auth logic in the API worker — not in individual Next.js apps
24. **ALWAYS** use a single consistent trigger function name: `update_updated_at()`
25. **ALWAYS** keep all Next.js apps on the same version in the monorepo

---

## 20. Quick Reference Card

```
┌──────────────────────────────────────────────────────────────────────┐
│                    LETBUYY QUICK REFERENCE                            │
├──────────────────────────────────────────────────────────────────────┤
│ DB Entity Name     │ sites (in DB)        / store (in URLs/UI)       │
│ Auth Location      │ ONLY accounts.letbuyy.store — nowhere else      │
│ API Versioning     │ /api/v1/... (mandatory)                         │
│ Token Storage      │ HTTP-only cookies ONLY — never localStorage     │
│ Password Hashing   │ bcryptjs, min 10 rounds                         │
│ Input Validation   │ Zod on EVERY endpoint                           │
│ Loading States     │ Skeleton screens — never spinners               │
│ Dark Mode          │ Required on every screen                        │
│ Spacing Grid       │ 4px base (4, 8, 12, 16, 20, 24, 32, 48, 64)   │
│ Icons              │ Lucide React (web) / Material Icons (Flutter)   │
│ Font Family        │ Inter (all apps)                                │
│ Component Library  │ ShadCN/UI via @letbuyy/ui                       │
│ Server Components  │ Default — "use client" only when needed         │
│ ORM               │ Supabase JS SDK — no Prisma, no raw SQL in app  │
│ Trigger Function   │ update_updated_at() ONLY                        │
│ Migration Format   │ NNN_descriptive_name.sql (sequential, unique)   │
│ Secrets            │ NEVER in git — env vars via deployment dashboard │
│ Webhooks           │ ALWAYS verify signature before processing       │
│ Error Format       │ { error: { code, message, details } }           │
│ Business Logic     │ Service modules ONLY — never in route handlers  │
│ Docs Location      │ CLAUDE.md + docs/LETBUYY.md + tasks + memory    │
├──────────────────────────────────────────────────────────────────────┤
│ BUILD:  pnpm build  │  LINT:  pnpm lint  │  DEV:  pnpm dev           │
│ DEPLOY: wrangler deploy (API) │ git push main (Vercel auto-deploy)   │
└──────────────────────────────────────────────────────────────────────┘
```
