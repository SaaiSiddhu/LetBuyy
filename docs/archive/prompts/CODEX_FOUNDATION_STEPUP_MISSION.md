# CODEX — LetBuyy Foundation Step-Up Mission (Production-Readiness Hardening + `.com` Launch Cutover)

**Date:** 2026-06-07
**Source of truth for findings:** `PRODUCTION_READINESS_MASTER_PLAN_2026-06-07.md` (root). Every task maps to a Pn ID there.
**Constitution:** `AGENTS.md` is supreme, then the nearest local `AGENTS.md`, then `docs/governance/`. This mission never overrides them.
**Mission class:** Foundation hardening. The goal is *fundamental strength*, not green checkmarks. Read §0 before doing anything.

---

## MISSION PARAMETERS (locked by the operator — do not re-litigate)

1. **Domain:** **`.com` at launch — full cutover is in scope.** All `.com`-readiness code ships this run. `.com` is the committed **canonical default** for SEO/canonical/display surfaces immediately. **Realm-sensitive** config (cookie domain, CORS allowlist, OAuth redirect URIs, payment callback origins) is env-driven and staged for `.com`, and flips **atomically in the human deploy** when DNS/certs are ready (so live `.store` sessions don't break pre-DNS).
2. **Launch market:** **India / non-EU first.** GDPR erasure/export is **implemented in code but deferred** (P2): build the endpoints + tests, gate the legal sign-off + EU-only controls as `SKIP_NEEDS_HUMAN`. Do not let it block P0/P1.
3. **Scope:** **Everything — P0 + P1 + P2** in one pass (Workstreams A–F).
4. **Execution:** **Code-only. Every DB apply, secret, and deploy is human-gated.** Write the code/migration/test; never run a protected apply or deploy. Each becomes a numbered `SKIP_NEEDS_HUMAN` entry with the exact command. Tests MUST run without live infra (unit/contract/behavioral against the existing harnesses/mocks) — do not assume a staging DB.
5. **Money model:** Keep `numeric(_,2)` for storefront, keep integer minor-units for platform billing; **widen `orders` money columns to `numeric(12,2)`** so a valid cart can't overflow on copy. Document the two domains + add a guard test. No mass refactor to minor-units this pass.
6. **`CUSTOMER_LEGACY_AUTH`:** **Investigate callers first; delete the bypass if nothing first-party depends on it; otherwise replace with a real per-customer credential check** and log a `SKIP_NEEDS_HUMAN` follow-up. Never leave body-trusted `customer_id`.
7. **Branch:** **New isolated branch off `develop` + PR.** If a dirty-tree collision blocks isolation (as in prior phases), fall back to in-place and add a `SKIP_NEEDS_HUMAN` for the branch/PR step. Never `reset --hard`, `stash`, force-checkout, or discard uncommitted work.

---

## 0. PRIME DIRECTIVE — read this twice

You are taking LetBuyy from "passes its own validators" to "actually safe for real customers and real money, on `.com`." Two laws govern everything:

**LAW 1 — Never block on a human. Run the whole mission end-to-end in one go.**
If a task needs a secret, a DNS change, a provider account, a protected DB apply, an app-store submission, or a deploy credential: **write the production-correct code anyway**, gate the human-provisioned value behind the existing `SKIP_NEEDS_HUMAN_<NAME>` token (runtime must **refuse** the placeholder and fail loud in production — never silently run on it), add the test/validator that enforces correctness once the human action lands, append a numbered `SKIPPED — NEEDS HUMAN` entry (with the **exact** future-proof command) to `CODEX_FOUNDATION_STEPUP_STATUS.md`, and continue. Do not stop. Do not ask. A workstream's *code* must be complete even when its *deploy* is human-gated.

**LAW 2 — No theater. This is the whole point of the phase.**
This repo has 169 "governance validators"; an audit proved ~72% only string-match markdown/JSON, 56 pass *because* the system declares itself `not-live`, the "0 circular imports" validator is blind to 89 real cycles, and the 7 genuinely-good backend tests are orphaned (wired to no command). **You will not add to that pile.** Every test you write MUST execute real code and assert real behavior, or parse real AST/config facts — never `assert.match(readFileSync(...), /phrase/)`. Every gate you add must be able to *fail for a real reason*. If you can't make a check real, write a real test instead. Honesty in STATUS/LEDGER over a higher green count, always.

**End state (what the repo must look like when you finish):**
- All P0 + P1 (and P2 where feasible) code defects fixed in source, each covered by a **real** test that fails without the fix.
- `services/api-gateway/src/__tests__/*` run in a wired command **and** in CI; a **full-repo** typecheck gate exists (no `...[HEAD^1]` escape on safety-critical jobs); a real **route-ownership** gate blocks future IDORs; a real **cycle budget** replaces the fake "0".
- Codebase is `.com`-launch-ready: `.com` is the committed canonical default; zero platform-surface `.store` literals an env var can't override; realm config staged for `.com`; storefront browser→API calls same-origin; mobile hosts read from `--dart-define`. The only things left are the live infra steps, each a `SKIPPED — NEEDS HUMAN` entry forming an ordered cutover runbook.
- `CODEX_FOUNDATION_STEPUP_STATUS.md` and `CODEX_FOUNDATION_STEPUP_LEDGER.md` exist and tell the truth.

---

## 1. GROUND RULES

- **Branch:** new branch off `develop` (e.g. `stream/foundation-stepup`), commit there, open a PR at the end. Dirty-tree collision → work in place + `SKIP` the branch/PR step with the exact `git`/`gh` commands. Never destroy uncommitted work.
- **Money:** integer minor-units or `numeric(_,2)` only — never `float/real/double`. Never client-trusted prices.
- **Tenancy:** gateway runs as Supabase service-role (RLS bypassed). Tenant isolation is a **manual invariant** — every tenant-scoped read/write derives `store_id`/`site_id` from the authenticated principal and verifies ownership before acting. Never trust a body/param tenant id as the data scope.
- **Secrets/bindings:** never hardcode; reference from `env`/Worker secret; fail loud in production if absent. Committed config may contain only `SKIP_NEEDS_HUMAN_<NAME>` placeholders, which runtime rejects.
- **Migrations:** additive, idempotent (`IF NOT EXISTS`, `DROP POLICY IF EXISTS`), guarded (`IF EXISTS`) — never destructive bare. Continue the sequence from `108`. **Applying is human-gated (`SKIP`).** Tests assert on migration *text/shape* + code behavior, not a live DB.
- **Gate commands (all must pass before "done"):**
  - `pnpm turbo typecheck` and `cd services/api-gateway && npx tsc --noEmit`
  - `pnpm lint`
  - `pnpm run test:behavioral` · `pnpm run test:contracts` · `pnpm turbo test`
  - `pnpm run test:unit:gateway` (NEW — you add it; runs `services/api-gateway/src/__tests__/*`)
  - `pnpm run validate:governance`
  - `flutter analyze apps/mobile/merchant-app` (+ existing mobile test) if you touch dart
- **Companion files:** maintain `CODEX_FOUNDATION_STEPUP_STATUS.md` + `CODEX_FOUNDATION_STEPUP_LEDGER.md` (formats in §9).
- **Do NOT** create/fix theater validators, edit `FORENSIC_REPORT/`, or inflate the validator count.

---

## 2. WORKSTREAM A — Security defects (P0/P1) — do FIRST

### A1 — Close the public customer-PII endpoint (P0-1) — CRITICAL
- **File:** `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts` (`find-or-create`, ~`:327-390`).
- **Defect:** public mount, not in `requireCustomerSession` list (`storefront.ts:68-74`), missing `requireStorefrontInternal` (`:143`) that siblings `/by-email`, `/status` use → anyone POSTs `{store_id,email}` → full PII + silent record injection, cross-tenant.
- **Fix:** add `const unauthorized = await requireStorefrontInternal(c); if (unauthorized) return unauthorized;` at handler top (match the sibling pattern), or require a verified customer session if a logged-in customer must reach it. Verify what the storefront server caller actually presents.
- **Real test:** new `customer-engagement.security.test.ts` in `src/__tests__/`: no internal credential → 401/403 + no DB read; valid credential → success. Prove it fails before the gate.

### A2 — Resolve the legacy customer-auth bypass (P0-2) — CRITICAL (latent) — investigate→delete/harden
- **Files:** `customer-engagement-routes.ts:110-129` + `middleware/customer-session.ts:32-35` (also read at `:724`, `storefront.ts:25`). Flag off by default but = full cross-tenant read/write if set.
- **Do:** (1) Trace every caller/flow that depends on `isCustomerLegacyAuthEnabled`/`CUSTOMER_LEGACY_AUTH` (gateway, storefront app, mobile, e2e). (2) If **nothing first-party** depends on it → delete the bypass entirely: `requireCustomerSession` always requires a verified session; `getVerifiedStoreCustomer` never derives `customerId` from the body unbound. Remove the dead helper/flag. (3) If something **does** depend on it → keep the flag but make legacy mode enforce a real per-customer credential (never body-trust), and add a `SKIP_NEEDS_HUMAN` note to fully retire it. Record which path you took + why in the LEDGER.
- **Real test:** every `/storefront/customer/*` route denies without a session/internal credential **regardless of env**; a focused test that body-supplied `customer_id` can't read another customer.

### A3 — Authorize R2 object deletes + fix the key bug (P1-1)
- **File:** `services/api-gateway/src/routes/upload.ts:142-162`.
- **Fix:** derive key from a validated route param (not `c.req.path.replace`), fix the `/v1` prefix bug, and before delete verify `customMetadata.owner_id === auth.user.id` (owner set at `:116`); 403 otherwise.
- **Real test:** key-derivation unit test + ownership check 403s on foreign owner, 200s on owner.

### A4 — `optionalAuth` must not trust client metadata role (P1-2)
- **File:** `middleware/auth.ts:275-276` (vs hardened `authMiddleware:220-225`).
- **Fix:** role precedence `app_metadata?.role ?? user_metadata?.role` (prefer DB-authoritative), mirroring `authMiddleware`.
- **Real test:** token with `user_metadata.role=super_admin` but no DB/`app_metadata` grant → non-privileged under `optionalAuth`.

### A5 — Scope leaky reads/writes + fix `/contacts` (P1-7)
- `coupons.ts:218` `/coupons/validate`: bind to authenticated store / ownership-check (no cross-store enumeration).
- `notifications.ts:114-205`: verify `store_id` ownership on `PUT /preferences`; lock `/email-log` & `/onboarding-failure-log` to authenticated/internal + scope rows.
- `contacts.ts:54` + `index.ts:573`: `/contacts` is "Protected" but mounted public → `auth` undefined → 500. Move behind `authMiddleware` + ownership scope.
- **Real tests:** one per route (cross-store denied / unauth denied / 500 gone).

---

## 3. WORKSTREAM B — Data-model integrity (P0/P1)

### B1 — `orders` tenant key NOT NULL + single source (P0-3) → migration `108`
- **Evidence:** `000_baseline.sql:10112` (`store_id uuid`, nullable), `:10139` (`site_id uuid`, nullable).
- **`108_orders_tenant_key_not_null.sql` (idempotent):** backfill `store_id = COALESCE(store_id, site_id)`; canonical = **`store_id`**; `ALTER ... SET NOT NULL` guarded by a `DO $$ ... IF NOT EXISTS(SELECT 1 FROM orders WHERE store_id IS NULL) ... $$` block; keep `site_id` for now, document the keep-in-sync invariant + schedule deprecation in the LEDGER (don't drop a column this pass).
- **Apply = `SKIP_NEEDS_HUMAN`.** **Real test:** contract test asserting migration enforces NOT NULL on the canonical column with backfill ordered first; gateway test that order creation always sets `store_id` from auth context.

### B2 — Wire transactional order-confirmation email (P0-4)
- **Hook:** `payments.ts:110` `emitOrderPaidEvent(...)` + the storefront checkout confirm path. Resend adapter exists (`packages/infrastructure/resend-adapter`, used `auth.ts:310`); no order email today.
- **Fix:** on order paid, enqueue an order-confirmation email via the existing `EMAIL_QUEUE` + a `services/queue-workers` consumer (fall back to direct Resend if queue unbound), rendering a real receipt from the **relational** `order_items`. Fail soft (mail failure never rolls back a paid order; outbox/log for retry). `RESEND_*` stay secrets; absent in prod → log-and-skip + `SKIP_NEEDS_HUMAN` to provision.
- **Real test:** a paid-order event produces exactly one confirmation to the right recipient + order id (mock transport); idempotent on duplicate events.

### B3 — Dual-model JSONB↔relational: relational canonical (P1-5)
- **Evidence:** `085_orders_items_reconcile.sql:1-2`; `orders.items jsonb` vs `order_items`; `products.variants` vs `product_variants` (`086`).
- **Fix:** make relational the canonical **read** path (the `*_RELATIONAL_READS` flags default on); JSONB becomes a derived cache. Provide a real reconciliation function (extend `dual_model_reconciliation_reports`) + a one-shot CLI entry. The **scheduled** trigger is `SKIP_NEEDS_HUMAN` (cron/queue deploy).
- **Real test:** given divergent JSONB vs relational rows, reconciler reports divergence and reads return relational truth.

### B4 — Money width (P1-6) → migration `109` (locked: widen, keep numeric)
- **Evidence:** `orders.total numeric(10,2)` (`:10117`) narrower than `carts.grand_total numeric(12,2)` (`:8691`).
- **Fix:** `109_orders_money_width.sql` widens `orders.subtotal/total` (+ any order money column narrower than its cart counterpart) to `numeric(12,2)`. Document the two money domains (storefront `numeric` vs platform-billing integer minor-units) in `docs/governance/`. Apply = `SKIP`.
- **Real test/gate:** a real validator/test that no storefront order money column is narrower than its cart counterpart.

### B5 — GDPR erasure + export (P1-4) — IMPLEMENT, legal sign-off deferred (India-first)
- **Fix:** add an authenticated, ownership-scoped `delete-customer` path (soft-delete + PII anonymization of `store_customers`, `customer_credentials`, `orders.customer_email/phone`, preserving financial records per retention) and a `data-export` endpoint (a customer's data bundle). A store may only erase/export its own customers. Real RPC + route + tests (erase removes PII / cross-store denied).
- **Deferred:** EU legal sign-off + any EU-only consent UI → `SKIP_NEEDS_HUMAN`. Do not let this block P0/P1; order it after A–D.

---

## 4. WORKSTREAM C — Launch-essential platform hygiene (P1)

### C1 — Shared security headers + a real CSP (P1-3)
- **Evidence:** only `merchant-control-plane` has a header baseline; `identity-platform` (auth app) has **no CSP/HSTS**; `app-marketplace`, `developer-portal`, `marketing-site`, `platform-console`, `platform-operations-portal` ship **zero**; storefront CSP is `frame-ancestors`-only.
- **Fix:** one shared security-headers helper (e.g. `packages/web-security` or in `shared-types`) applied in every Next app's `next.config`/middleware/proxy: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`/`frame-ancestors`, `Permissions-Policy`, and a real `Content-Security-Policy` (`default-src 'self'` + explicit `script/style/connect/img/frame-src`, **env-driven for the API + framer origins so it survives the `.com` flip** — see WS-D). Prioritize `identity-platform` + the two admin portals. CSP may start report-only on the riskiest apps with a LEDGER note to enforce after a soak.
- **Real test:** contract test asserting each app emits the required headers + a non-empty `default-src`/`script-src` CSP; no app missing HSTS.

---

## 5. WORKSTREAM D — `.com` LAUNCH CUTOVER (P0 — in scope) 

> Target: the codebase is fully `.com`-correct; `.com` is the committed canonical default; only live infra moves remain (as an ordered `SKIP` runbook). Realm-sensitive config flips atomically at deploy so live `.store` sessions don't break pre-DNS.

### D1 — Make `.com` the committed canonical default (safe surfaces)
- In `packages/shared-types/src/brand.ts`, set `CANONICAL_DOMAIN`/`resolvePlatformDomain` default to **`letbuyy.com`** (keep `.store` in `PLATFORM_DOMAINS` as an accepted alias during transition). Canonical tags, OG/SEO, display URLs, sitemaps, and `sameAs` now emit `.com`. Update `apps/storefront-runtime/src/lib/seo.ts` to emit `.com` canonicals (accept both hosts inbound).

### D2 — Env-drive EVERY functional `.store` literal (no env-uncoverable literal remains)
Replace hardcoded `.store` in functional paths with the central resolver / per-app `public-urls.ts`/`site-url.ts` / storefront `base-url.ts`. Confirmed offenders (grep `letbuyy\.store` across `apps/ services/ packages/` and fix every functional one):
- `payments.ts:787-788` (Stripe success/cancel) → `resolvePlatformOrigin()`/`STOREFRONT_BASE_URL`.
- `customer-engagement-routes.ts:246`, `auth.ts:910` (password-reset) → `CUSTOMER_PASSWORD_RESET_URL`/accounts origin.
- `apps/marketing-site/src/components/Header.tsx` CTAs → `getAccountsUrl()`.
- `apps/theme-marketplace/src/lib/public-urls.ts` (half-migrated) → consistent + env-driven.
- `onboarding.ts:319-320`, `middleware/store-context.ts:128`, `middleware/permission.ts:121` (admin/upgrade URLs).
Cosmetic literals (display copy, `sales@letbuyy.store` mailto, SEO sample text) may stay — list them in the LEDGER as accepted.
- **Real gate:** new `platform-domain-literal-validator.mjs` that **parses** source and fails if an allowlisted *functional* file (proxies, base-url/site-url/public-urls, payment/auth routes, CORS, cookies) contains a `letbuyy.store` literal not wrapped in an env fallback. Wire into `validate:governance`. Must fail for real.

### D3 — Stage realm config for `.com`; keep the flip atomic
Stage in committed config templates (`.env.example`, non-secret wrangler `[vars]`, `config/` docs): `LETBUYY_PLATFORM_DOMAIN`, `NEXT_PUBLIC_PLATFORM_DOMAIN`, `CORS_CREDENTIAL_ORIGINS` (the `.com` control-plane origins), and the documented `.com` `COOKIE_DOMAIN` (`.letbuyy.com` for platform SSO; storefront stays host-only). These are **read from env**; the production values + the actual switch are the human cutover (`SKIP`). Add a boot-time assertion that in production the realm domain is internally consistent (cookie domain ⊆ platform domain) and fails loud on mismatch.

### D4 — Route storefront browser→API calls same-origin (CORS architecture fix)
- **Evidence:** CORS allowlist names `storefront`/`merchant` (`lib/cors.ts:23-34`) but the storefront is served at `store.letbuyy.*`, `<sub>.letbuyy.*`, and custom domains making browser calls to `api.letbuyy.*` (`browser-client.ts:44`, `checkout-client.tsx:525`) — custom domains can't be statically allowlisted.
- **Fix:** route storefront browser API calls through a **same-origin** Next route handler/rewrite on the storefront host; keep server-to-server as-is. Ensure CORS allowlist is env-derived (`.com` origins) for the control-plane surfaces that legitimately need it.
- **Real test:** storefront browser client resolves to a same-origin path; CORS allowlist still covers the control-plane origins.

### D5 — Mobile `.com` via dart-define
- **Evidence:** `apps/mobile/merchant-app/lib/config/app_config.dart` bakes `*.letbuyy.store` via `String.fromEnvironment` defaults.
- **Fix:** set every host default to `.letbuyy.com` via `--dart-define` keys; document the release-build invocation. The actual `.com` release build + **app-store resubmission** is `SKIP_NEEDS_HUMAN` (can't be env-flipped post-ship). Add a real check that all dart hosts read from defines.

### D6 — Cutover runbook (ordered `SKIP` set)
Produce, in STATUS, the ordered human cutover: (1) add `letbuyy.com` to Cloudflare + move nameservers + zone id; (2) issue/verify certs; (3) attach `*.letbuyy.com` Vercel hosts; (4) move Worker routes to `.com` in `wrangler.toml` + topology config; (5) `wrangler secret put` realm + provider secrets; (6) flip `COOKIE_DOMAIN`/`LETBUYY_PLATFORM_DOMAIN` env in the same release; (7) verify SSO + checkout on `.com`; (8) 301 old `.store` hosts; (9) mobile `.com` build + store resubmit. Each with the exact command.

---

## 6. WORKSTREAM E — The real safety net (P0-6) + anti-theater foundation

This is the load-bearing workstream for "fundamentally strong." Everything REAL.

### E1 — Un-orphan the genuine backend tests
Add `"test:unit": "tsx --test src/__tests__/*.test.ts"` to `services/api-gateway/package.json`; add root `"test:unit:gateway": "pnpm --filter @letbuyy/api-gateway run test:unit"`; include in the package's turbo `test`. Fix any failing assertions in `src/__tests__/*` (security/payments/tenant-isolation are real — make them pass for real, don't weaken).

### E2 — Full-repo typecheck + real test gate in CI
`.github/workflows/ci.yml` uses `--filter="...[HEAD^1]"` (`:48/84/112/186`). Add a **non-filtered** merge-gate job: `pnpm turbo typecheck` (whole repo) + `test:unit:gateway` + `test:behavioral` + `test:contracts` on every PR. Keep fast `HEAD^1` jobs for speed but they are not the gate. The `governance` job must `pnpm install` before claiming anything about the build.

### E3 — A REAL route-ownership gate (durable anti-IDOR foundation)
Add `scripts/validators/route-ownership-validator.mjs` that **parses** `services/api-gateway/src/routes/**` (TS AST / `tsc` API or robust structural parse — not a phrase grep) and fails if a handler touching a tenant-scoped table (`orders|products|store_customers|inventory|payouts|coupons|sites|contacts|projects|...`) lacks an ownership/internal/session gate (`verifySiteOwnership`, `requireStorefrontInternal`, `requireCustomerSession`, `assertStoreOwnership`, or an explicit allowlist annotation). Seed the allowlist from audit-confirmed-correct routes so it starts green, then it catches the next IDOR. Wire into `validate:governance`.

### E4 — Make the circular-dependency gate real
Add a real cycle-budget gate using `madge --circular` (or an in-repo graph walk that includes intra-package edges) — the existing `circular-import-validator.mjs` reports "0" while madge finds 89 (api-gateway) + 15 (packages). Record the honest current count as the ceiling; fail if it grows; ratchet down. Begin paying down the worst barrels (`packages/orchestration/src/index.ts` ⇄ runtimes; `packages/theme-engine/src/index.ts` ⇄ renderer). Don't fake the number.

### E5 — Stop committing build artifacts
Remove committed `dist/` (e.g. `packages/theme-engine/dist`, `packages/infrastructure/dist`) per `AGENTS.md` Build Artifact Governance — gitignore + delete; consumers import from `src` or a real build step. Document any genuine prebuilt-type need in the LEDGER.

### E6 — Honesty pass on the validator suite (no deletion)
Do not delete validators. In STATUS, record the honest split (real-analysis vs `not-live` string-match) and stop reporting the raw count as readiness. Add `docs/governance/validator-reality.md` classifying them. The readiness signal going forward = full-repo typecheck + real gateway tests + route-ownership gate + real cycle budget.

---

## 7. WORKSTREAM F — P2 hardening (in scope this run)

- **F1 — FK hygiene** (`migration 110`): add `ON DELETE` to the ~17 FKs missing it (e.g. `app_reviews_store_id_fkey`, `:20842`); add the missing index on `orders.site_id`; give `order_items` a real tenant scope or document the parent-only RLS join. Idempotent; apply = SKIP.
- **F2 — Migration idempotency:** convert bare `CREATE TABLE` in `076, 093, 095, 096, 097, 098` to `IF NOT EXISTS` (forward-only, guarded; don't destructively rewrite applied history). Add a real migration-lint test.
- **F3 — Credential source of truth:** converge `store_customers.password_hash` (`:12179`) onto `customer_credentials` (`:8891`); stop writing the inline duplicate; migration + code + test.
- **F4 — Push config:** `queue-workers` FCM/APNS stay `SKIP_NEEDS_HUMAN_*`; ensure runtime refuses placeholders; provisioning command in STATUS.
- **F5 — Search:** trigram-only acceptable for launch; log a `tsvector`/ranking follow-up. No code this pass.

---

## 8. EXECUTION ORDER (single pass)

A (security) → E1/E2/E3 (safety net, so later refactors are caught) → B (data integrity) → C (headers/CSP) → D (`.com` cutover code) → E4/E5/E6 (cycles, artifacts, honesty) → F (P2) → B5 (GDPR code, deferred sign-off) → run all gate commands → write STATUS/LEDGER → open PR (or SKIP it). Keep the tree green at each workstream boundary.

---

## 9. COMPANION FILE FORMATS

**`CODEX_FOUNDATION_STEPUP_STATUS.md`:**
```
# LetBuyy Foundation Step-Up — Status
## Mission Parameters (locked)   # echo the 7 locked params above
## Current Phase                 # branch, and live results of every §1 gate as "X/Y PASS"
## Gate State                    # baseline vs final; NEW real gates (route-ownership, full-repo typecheck, cycle budget) with numbers; honest validator-reality line (E6)
## Cutover Runbook               # the ordered .com human steps from D6
## SKIPPED — NEEDS HUMAN         # numbered; each: what, why, EXACT future-proof command
```
**`CODEX_FOUNDATION_STEPUP_LEDGER.md`:** append-only, one entry per task (A1, A2, …): summary, files touched, the real test added, and the one-line proof it fails-without-the-fix. For A2, record investigate→delete-or-harden decision + why.

**Expected `SKIPPED — NEEDS HUMAN` set** (produce exact commands): apply migrations `107`–`110` to staging/prod (`supabase db push --db-url <protected>`); `wrangler secret put` `INTERNAL_API_SECRET`, `AUTH_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RAZORPAY_*`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, Upstash URL/token across api-gateway/mobile-bff/webhook-service/queue-workers; rotate Supabase anon key if exposed pre-107; the full `.com` cutover runbook (D6); FCM/APNS provisioning; mobile `.com` build + app-store resubmit; EU GDPR legal sign-off; branch/PR if blocked.

---

## 10. DEFINITION OF DONE (all must hold)

1. WS-A + WS-B (P0/P1) code complete; each defect has a **real** test that fails without the fix.
2. WS-C headers/CSP live on every app (CSP at least report-only on the riskiest).
3. WS-D: `.com` is the committed canonical default; `platform-domain-literal-validator` green; realm config staged + boot-assertion present; storefront browser calls same-origin; mobile reads hosts from defines; the D6 runbook is written. Live infra = SKIP entries.
4. WS-E: gateway `src/__tests__/*` wired + in CI; full-repo typecheck gate in CI; route-ownership validator real + green; cycle budget real with honest ceiling; committed `dist/` removed; validator-reality documented.
5. WS-F P2 items done or honestly logged.
6. All §1 gate commands pass (or any failure is an honest, explained SKIP — never a weakened/faked assertion). `validate:governance` passes **with the new real gates included**.
7. New branch + PR opened (or SKIP with command). Ran end-to-end in one pass. Never blocked on a human. No theater added.

> The bar is not "more green." It's: a stranger could read STATUS/LEDGER, run the gate commands, and trust the result — and the `.com` cutover is one ordered runbook away. Build that.
