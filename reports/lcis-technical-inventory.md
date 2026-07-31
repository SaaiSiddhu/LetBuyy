# LCIS Technical Inventory
**LetBuyy Central Intelligence System — Languages, Frameworks, Infrastructure, Databases**
*Date: 2026-06-19 | Source: tools/graph-server/, package.json, wrangler configs, AGENTS.md*

---

## 1. Language Stack

### LCIS Server (tools/graph-server/)
- **Language:** Vanilla JavaScript (ES2022 modules)
- **No TypeScript:** No `.ts` files; no build step required
- **Module format:** ESM (`import`/`export`, `.mjs` extension)
- **Node.js built-ins used:**
  - `node:http` — HTTP server (zero external server framework)
  - `node:fs` — `readFileSync`, `statSync`, `existsSync`, `writeFileSync`
  - `node:path` — `join`, `resolve`, `dirname`
  - `node:url` — `fileURLToPath`
  - `node:child_process` — `execSync` (for `git log` in time-travel + release endpoints)
- **No external npm dependencies:** LCIS itself has zero external dependencies (intentional design; avoids supply-chain risk)
- **Validation:** `node --check tools/graph-server/*.mjs` (syntax only; no runtime type checking)

### Application Stack (LetBuyy platform)
| Component | Language | Framework | Deployment |
|-----------|---------|---------|-----------|
| API Gateway | TypeScript | Hono.js | Cloudflare Workers |
| Queue Workers | TypeScript | Cloudflare Workers SDK | Cloudflare Workers |
| Webhook Service | TypeScript | Cloudflare Workers SDK | Cloudflare Workers |
| Mobile BFF | TypeScript | Hono.js + Cloudflare | Cloudflare Workers |
| Identity Platform | TypeScript | Next.js 15 | Vercel |
| Merchant Control Plane | TypeScript | Next.js 15 | Vercel |
| Storefront Runtime | TypeScript | Next.js 15 | Vercel |
| Marketing Site | TypeScript | Next.js 15 | Vercel |
| Mobile (Merchant App) | Dart | Flutter | iOS/Android |

---

## 2. Database

### Supabase (Postgres)
- **Tenant model:** Multi-tenant single-database, row-level isolation via `site_id`
- **Tables:** 414 total; 255 tenant-scoped; 394 RLS-enabled; 44 FORCE RLS
- **Functions/RPCs:** 156 total; 128 SECURITY DEFINER
- **Policies:** 651 RLS policies
- **Triggers:** 395 triggers
- **Indexes:** 826 indexes
- **FK relationships:** 705 foreign keys; `sites` is tenant root (260 inbound FKs)
- **Money mutation protocol:** All writes to 18 canonical MONEY_TABLES go through SECURITY DEFINER RPCs with `idempotency_key`, `FOR UPDATE` row locks, balance ≥ 0 CHECK constraints
- **Migrations:** `database/supabase/migrations/*.sql` — 103+ migration files, sequential numbering
- **Migration gate:** `supabase@latest db push --include-all` in `production-deploy.yml` — blocks deploy if migration fails
- **Client library:** `@supabase/supabase-js` (application side); direct SQL in migrations
- **Connection pooling:** Hyperdrive (Cloudflare) for connection reuse from Workers

### The 18 Canonical Money Tables (MONEY_TABLES)
```
payment_transactions, payments, payout_statements, payouts,
refund_transactions, refunds, cod_reconciliation_entries, settlements,
wallet_ledger_entries, partner_payout_ledger_entries,
gift_card_accounts, gift_card_ledger_entries, gift_card_redemptions,
ledger_transactions, ledger_entries, orders, order_items, ai_credits
```

### Money Write Invariants
1. All writes via SECURITY DEFINER RPC (`db.rpc()`) — never `.from(table).insert/update`
2. Every RPC requires `idempotency_key` parameter
3. Every RPC uses `FOR UPDATE` row lock
4. Balance columns have `CHECK (balance >= 0)`
5. GST invoices are immutable after creation
6. Gift-card balance is a ledger projection (no mutable `decrement` column)

---

## 3. Compute Infrastructure

### Cloudflare Workers (4 Workers)
| Worker | Routes | Queues | Region |
|--------|--------|--------|--------|
| `api-gateway` | `/v1/*` | Producer to all 5 queues | ap-south |
| `queue-workers` | (consumer) | Consumes all 5 queues | ap-south |
| `webhook-service` | `/webhooks/*` | — | ap-south |
| `mobile-bff` | `/mobile/v1/*` | — | ap-south |

**Infrastructure bindings per worker:**
- Queue bindings (producers + consumers)
- KV namespace bindings
- R2 bucket bindings
- Hyperdrive connection pool
- D1 database (if applicable)
- Durable Objects (if applicable)
- Cron triggers

### Cloudflare Queues (5 Queues)
| Queue | Purpose | DLQ |
|-------|---------|-----|
| `NOTIFICATION_QUEUE` | Email/notification jobs | Present |
| `PAYMENT_QUEUE` | Payment async jobs | Present |
| `ORDER_QUEUE` | Order processing | Present |
| `WEBHOOK_QUEUE` | Outbound webhook delivery | Present |
| `ANALYTICS_QUEUE` | Analytics event ingestion | TBC |

### Cloudflare R2 (Object Storage)
- Media storage (product images, etc.)

### Cloudflare Hyperdrive
- Postgres connection pool for Workers-to-Supabase

---

## 4. Hosting

### Vercel (5 Apps)
| App | Directory | Purpose |
|-----|----------|---------|
| Identity Platform | `apps/identity-platform` | Auth UI — sole ES256 issuer |
| Merchant Control Plane | `apps/merchant-control-plane` | Merchant dashboard |
| Storefront Runtime | `apps/storefront-runtime` | Customer-facing storefront |
| Marketing Site | `apps/marketing-site` | Public marketing pages |
| Platform Console | `apps/platform-console` | Internal operations |

---

## 5. Third-Party Providers

### Razorpay (Payments)
- **Type:** India-focused payment gateway
- **Integration:** HMAC-SHA256 webhook signature verification (`timingSafeEqualHex`)
- **Supported:** Razorpay standard + COD (Cash on Delivery)
- **NOT implemented:** PayPal (identified as second-provider gap)
- **Razorpay Route:** H8 blocker (payout feature, identified in launch readiness audit)
- **Required secrets:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`

### Resend (Transactional Email)
- **Purpose:** Order confirmations, notifications, alerts
- **Required secrets:** `RESEND_API_KEY`

### Cloudflare Turnstile (CAPTCHA)
- **Purpose:** Registration and login protection
- **Required secrets:** `TURNSTILE_SECRET_KEY`

### Supabase
- **Purpose:** Postgres hosting + auth foundation + real-time
- **Required secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### GitHub (CI/CD)
- **Purpose:** Actions workflows for deploy, validate, audit
- **Required secrets:** `GITHUB_TOKEN` or `GH_TOKEN`

---

## 6. Authentication Architecture

### Two issuers — NEVER crossed:

| Issuer | Algorithm | Secret | Purpose |
|--------|----------|--------|---------|
| Customer sessions | HS256 | `CUSTOMER_SESSION_SECRET` | Customer JWT tokens |
| Merchant sessions | ES256 | `LETBUYY_IDENTITY_PUBLIC_JWKS` | Merchant JWT tokens |

**Identity Platform** (`apps/identity-platform`) is the **sole ES256 issuer**. No other application may issue merchant tokens. This is enforced by `identity-sole-issuer-validator.mjs`.

**Step-up HMAC:** Refunds and payouts require a second HMAC-signed challenge (step-up authentication) — enforced by `stepup-crypto-validator.mjs`.

---

## 7. Money Architecture

### Canonical Double-Entry Ledger
- All money mutations are `SECURITY DEFINER` Postgres RPCs
- Enforced by `canonical-ledger-only-validator.mjs` (forbids `.from(money_table).insert/update` in TypeScript)
- Amounts stored as bigint in paise (1 INR = 100 paise) — never floats
- Every RPC requires `idempotency_key` (ON CONFLICT DO UPDATE pattern)
- Every RPC uses `FOR UPDATE` row locks (prevent race conditions)
- Balance ≥ 0 CHECK constraints (cannot go negative)

### 6 Canonical SECURITY DEFINER + Idempotent + Locked RPCs:
1. `create_checkout_order` — highest blast radius (called from 4 routes; 6 money domains)
2. `confirm_order_payment_with_ledger` — Razorpay confirmation → ledger entry
3. `complete_order_refund` — refund + gift-card restore chain
4. `issue_gift_card` — issue new gift card with initial ledger entry
5. `set_gift_card_status` — status transition (not a balance mutation)
6. `restore_gift_card_on_refund` — restore gift card balance on refund

---

## 8. Security Architecture

### RLS (Row-Level Security)
- Enforced on all tenant tables: `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY`
- `rls-force-coverage-validator.mjs` is the authoritative gate
- 651 policies across 394 tables
- All policies use `site_id` or `store_id` for tenant isolation
- No `USING (true)` on public-accessible data (`no-public-using-true-validator`)

### Multi-Tenancy Model
- Tenant identifier: `site_id` (primary) or `store_id` (legacy)
- Tenant root: `sites` table (260 inbound FK references)
- All tenant data traces back to `sites.id`
- Service-role gateway access only behind `verifySiteOwnership` middleware
- PostgreSQL GUC (session-level variable) used for tenant context propagation

### HMAC Signature Verification
- Razorpay webhooks: HMAC-SHA256 (`timingSafeEqualHex`)
- Queue tenant envelopes: signed with `signQueueTenantEnvelope`
- Step-up HMAC: refunds/payouts require additional HMAC challenge

---

## 9. GST / India-First Requirements

- GST computed server-side (never client)
- GST invoices are immutable after creation
- GSTIN capture required for business customers
- Amount formatting: INR via `formatInrCurrency` (bigint paise → INR display)
- Date formatting: `en-IN` locale
- Mobile-first: ~360px viewport primary

---

## 10. The 19 Required Production Secrets

From `production-deploy.yml` `wrangler secret put` commands:

| Secret | Provider | Purpose |
|--------|---------|---------|
| `SUPABASE_URL` | Supabase | Database connection URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Service-role JWT key |
| `RAZORPAY_KEY_ID` | Razorpay | Payment gateway key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay | Payment gateway HMAC secret |
| `RESEND_API_KEY` | Resend | Transactional email API key |
| `TURNSTILE_SECRET_KEY` | Cloudflare | CAPTCHA secret |
| `CUSTOMER_SESSION_SECRET` | Internal | HS256 customer JWT secret |
| `LETBUYY_IDENTITY_PUBLIC_JWKS` | Internal | ES256 public JWKS for merchant JWTs |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | API token for Workers/Queues |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | Account identifier |
| `VERCEL_TOKEN` | Vercel | Vercel deployment token |
| `GITHUB_TOKEN` | GitHub | CI/CD actions token |
| (+ 7 more) | Various | Platform-specific secrets |

---

## 11. LCIS Infrastructure Requirements

LCIS itself requires:
- **Node.js:** `node:http`, `node:fs`, `node:path`, `node:url`, `node:child_process` — standard built-ins only
- **Graphify:** `uv tool install graphifyy` (external, Python-based, tree-sitter)
- **Port:** 3333 (default), overridable via `GRAPH_UI_PORT`
- **Memory:** Pre-loads all JSON artifacts at startup (~100–200MB for the full stack)
- **No database:** All knowledge stored as JSON files in `graphify-out/`
- **No embedding/RAG:** Pure structural graph queries; no vector search

**Startup time:** ~2–5 seconds (loading 50+ JSON artifacts from disk)

**Request latency:** <10ms for most endpoints (in-memory computation over pre-loaded data)

---

## 12. Theme Platform

### Liquid Engine (LetBuyy theme system)
- Liquid + JSON renderer
- Sanitizer is LOCKED (`FORBID` lists, `outputEscape:'escape'`)
- Liquid default OFF (canary): `THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`
- React is NOT removed (hybrid: React default, Liquid optional)
- ART-17 (Constitution): no new React-per-section components after freeze

### Theme Storage
- 32 tables in `themes` domain
- Theme settings stored as JSON
- Liquid templates stored as text

---

## 13. Graphify (External Code Graph Tool)

| Property | Value |
|----------|-------|
| Package | `graphifyy` on PyPI |
| Version | 0.8.39 |
| Install | `uv tool install graphifyy` |
| Run | `graphify update .` |
| Output | `graphify-out/graph.json` (44MB) |
| Parser | tree-sitter (deterministic static analysis, no LLM) |
| Languages | TypeScript, TSX, Dart, MJS, Markdown |
| SQL | NOT indexed (gap filled by db-intel.mjs) |
| Git hooks | NOT installed (by design — avoids binary-on-every-commit risk) |
| MCP | `graphify-mcp` operator-registered; not auto-added to `.claude/` |
| Isolation | Own uv venv, not in repo's npm workspace |

---

## 14. Platform Console (Platform Operations)

`apps/platform-console` — Internal operations portal (deployed on Vercel). Serves as the internal operations surface for the LetBuyy platform team. Not a customer-facing app.

---

## 15. Deprecated/Frozen Runtimes (DO NOT REFERENCE AS ACTIVE)

| App | Status | Notes |
|-----|--------|-------|
| `apps/app-marketplace` | Frozen | Not a deploy target |
| `apps/developer-portal` | Frozen | Not a deploy target |
| `apps/theme-marketplace` | Frozen | Not a deploy target |
| `apps/platform-operations-portal` | Pending consolidation | Not active |
| `apps/admin` | Deprecated alias | Historical only |
| `apps/auth` | Deprecated alias | Historical only |
| `apps/checkout` | Deprecated alias | Historical only |
| `apps/internal` | Deprecated alias | Historical only |
| `apps/merchant` | Deprecated alias | Historical only |
| `apps/storefront` | Deprecated alias | Historical only |
| `apps/analytics` | Deprecated alias | Historical only |

Historical references may remain only under `docs/archive/`.
