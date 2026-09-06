# `security` lane — cyber-security review for a multi-tenant commerce OS with a live marketplace

**Mandate.** Every change that touches the surface list in §2 gets this lane before VERIFY. The lane
produces findings with severity, evidence and a fix; it never "signs off" from reading a passing
test. **A verified live P0 in lineage A outranks every feature and migration phase** — say so, mark
`LIVE_FIREBASE_SECURITY: NO_GO`, and stop feature work. Never resolve an open decision (D-2, D-ID, …) while reviewing; cite recorded ones (`decisions.md` §2) by date.

**Never reproduce a secret value.** Cite the path and the key name, say what is exposed, require
rotation or deletion. Key names live in `config/env/{staging,production}.env.template`,
`config/env/staging-production-secret-matrix.json`, `services/api-gateway/wrangler.toml` (`[vars]`
only) and `turbo.json` `env`; real values live only in untracked `.dev.vars`, `.env*.local`,
`--dart-define` inputs, GitHub secrets and provider dashboards. `git ls-files` shows **0** tracked
`.jks`/`.keystore`/`key.properties`. Seven-plus values have already reached agent output through
read-then-redact — the only method that has never failed is never displaying: `grep -c`, line
numbers without content, structural substitution anchored on the field name.

**Facts below were measured 2026-09-04 at `develop` = `823aa5ee`. Re-measure before quoting.**

## 1. Trust boundaries and identity universes — per lineage

### 1.1 Lineage C — the canonical commerce OS (Supabase Postgres + Cloudflare Workers + Next)

| Universe | Credential | Verified by | Tenant authority |
|---|---|---|---|
| Merchant / staff | ES256 or EdDSA JWT minted **only** by `apps/identity-platform/src/lib/auth/identity-issued-session.ts` (`LETBUYY_IDENTITY_PRIVATE_JWK` required in production, `:43`); `lb_accounts` cookie signed with `ACCOUNTS_COOKIE_SECRET` | gateway `services/api-gateway/src/lib/identity-session-verifier.ts` — `LETBUYY_IDENTITY_PUBLIC_JWKS` only (`:24`, `:80`), `algorithms: ['ES256','EdDSA']` (`:90`), a non-asymmetric `alg` is rejected twice (`:57`, `:95`) | the site resolved by `verifySiteOwnership` (`lib/auth-user.ts:58`; 40 route files + `middleware/store-context.ts`) and bound by `withTenantTx` |
| Internal app boundary → gateway | `X-LetBuyy-Internal-Session-Token` / `X-LetBuyy-Internal-User-ID` HMAC headers; **no raw `Authorization: Bearer` is accepted** (`middleware/auth.ts:176-200`, Phase N3 closed ART-05) | `internal-session-hmac`, `internal-identity-hmac` verifiers; `internal-auth-keyring.test.ts`, `auth-middleware-fail-closed.test.ts` | same |
| Customer (buyer) | **HS256** session signed with `CUSTOMER_SESSION_SECRET` (`apps/identity-platform/src/lib/auth/cookies.ts:194`) — **known deviation**: the verification key is the forgery key | `middleware/customer-session.ts:56-61` (`verifyCustomerSession` + a legacy fallback) | `site_id` from the storefront host resolution, never from the token alone |
| Platform operator (`admin_web`) | thin client → gateway internal perimeter (`X-Platform-Console-Token`) | `middleware/internal-perimeter.ts:81-112` (401/403, fail-closed; `fail-closed-internal-routes-validator`) | none by design |
| Apps / OAuth | access-token hash compared with `timingSafeEqualHex` (`middleware/app-auth.ts:97-98`) | `app-auth.ts`; app-platform kill switch registered first (`index.ts` ART-22 block, `middleware/appPlatformKillSwitch.ts`) | app scopes |
| Storefront public | none; host → `/v1/internal/store-access/resolve` (`apps/customer_web/src/proxy.ts:112-118`); password-protected stores verified server-side (`:144`) | reserved-subdomain and storefront-access validators | the resolved site |
| Webhooks | provider signature over the **raw body**: `services/webhook-service/src/index.ts:248-253` `verifyRazorpayWebhookSignature` — missing signature **or** missing secret ⇒ `false` (rejection, never a skip); `hmacSha256Hex`/`timingSafeEqual` from `@letbuyy/infrastructure/razorpay-adapter` | route-level; webhook-service `test/*.test.mjs` | the order's site, from the DB row, never the payload |
| Queue jobs | signed tenant envelope `services/api-gateway/src/lib/queue-tenant-envelope.ts:34` `signQueueTenantEnvelope` (producers: transactional-email, order-confirmation-email, gift-card-email) | the consumer verifies before acting; `tenant-load-bearing-d4.test.ts` | the envelope's `site_id` |
| Local dev bypass | `isLocalSupabaseEnvironment` → a fixed dev user (`middleware/auth.ts:150-158`); `LETBUYY_ENABLE_DEV_AUTH_BYPASS` in identity-platform | must be unreachable in staging/production (`production-safety-validator`, `environment-honesty-validator`) | — |

**Database boundary.** GUC `app.site_id` (`packages/tenant-core/src/index.ts:576` `TENANT_SITE_GUC`),
set only inside `withTenantTx` (`services/api-gateway/src/lib/tenant-transaction.ts:15-38`:
`SET LOCAL ROLE app_tenant` → `set_config('app.site_id', …, true)` → `app.request_id`), which refuses
to fake `SET LOCAL` over Supabase REST (`:8-12`). Policies predicate on
`current_setting('app.site_id', true)` (helper in migration `139`); 49 tables carry `FORCE ROW LEVEL
SECURITY`; migration `163` removed the baseline `USING(true)`-to-PUBLIC policies. Money mutations
happen only inside `SECURITY DEFINER` RPCs: `create_checkout_order` (6 redefinitions, latest wins),
`confirm_order_payment_with_ledger`, `complete_order_refund`, `issue_gift_card`, `set_gift_card_status`,
`restore_gift_card_on_refund`, `issue_gst_invoice`; advisory locks precede the existence check
(migrations `206`, `207`); reservations expire by sweeper (`211`); `products.stock` is synced from
inventory on checkout paths (`216`).

### 1.2 Lineage A — the live Firebase marketplace (Play Store `com.letbuyy.letbuyy`, project `letbuy-y`)

The shipped app (`apps/customer_app`, versionCode 4013 / 1.0.10) talks to Firestore **directly**;
`firestore.rules` and `storage.rules` are the entire authorization model; some flows call Cloud
Functions by name. This repository **held** an inert copy of those rules and 24 function sources at
`services/compatibility/firebase_bridge/{config,src}`; nothing there ever deployed them, and the
**live** project state was, and remains, `UNKNOWN_LIVE_STATE` from this repository. **That copy was
deleted on 2026-09-05 (phase FB-1)** under the owner's decision to retire Firebase completely. Read
the consequence precisely: deleting the copy retired the bridge, **not the exposure**. Every finding
below marked **(copy)** was measured against it and is now readable only in git history, at the parent
of `letbuyy/fb1-retire-firebase-admin-app`. Each stays a **live risk until the owner deletes the
Firebase project itself** (FB-5), and until then it can be settled only by a live probe (§7 H), never
from the working tree. Universes: Firebase Auth users
(`users/{uid}` with a client-writable `role` field), sellers (`sellers/{sellerId}` with a
self-writable balance), admins (`isAdmin()` reads `users/$(uid).data.role == 'admin'`,
`firestore.rules:22-25`), anonymous (world-readable collections, §9). Storage rules are **additive**
— a bucket-wide `allow read: if true` overrides every narrower rule beneath it.

**Play Store compatibility law.** The migration seam is Firestore itself: project new-system state
back into the documents old clients read (narrow field set, one direction); replace client write paths
with a callable accepting the existing payload shape; move loyalty/coupon logic server-side behind the
same callable; ship the new client staged; raise the minimum version only after adoption. Release-state
vocabulary is exact: `code merged ≠ backend deployed ≠ app submitted ≠ app approved ≠ app released ≠
release adopted`. Signing: three distinct rescued keystores, the live one unproven; never `keytool`.

### 1.3 Lineage B — the quick-commerce donor (Agrimore)

Supabase Auth + Edge Functions + Cloudflare Worker routes, copied inert to
`services/compatibility/agrimore_bridge/*` (three `wrangler.toml`s, never deployed from here). Audit
findings (2026-08-28, dated): Edge Function identity via an unsigned header; mocked Razorpay
(`rzp_mock_*`); 47 of 57 declared routes unimplemented. A design donor; never a runtime.

## 2. Surface list — what triggers this lane (`scripts/surface.sh` encodes it)

```
services/api-gateway/src/{index.ts,middleware/**,lib/**,routes/**,tenant/**,identity-foundation/**}   services/api-gateway/wrangler.toml
services/webhook-service/**   services/queue-workers/**   services/mobile-bff/**   services/compatibility/**   */wrangler.toml
apps/identity-platform/src/{lib/**,app/api/**,middleware.ts}   apps/*/src/{middleware.ts,proxy.ts,app/api/**,lib/*auth*,lib/*session*,lib/*cookie*,lib/*csp*,lib/*tenant*}
packages/{tenant-core,session-core,token-core,identity-core,auth-core,permission-core,payments,billing-core,checkout-core,infrastructure}/**   packages/theme-engine/src/**sanit**
database/**   scripts/validators/**   scripts/governance/**   scripts/generators/**   .github/**   config/{env,governance,runtime,security}/**   infrastructure/**
apps/*/android/**   apps/*/ios/**   apps/phase_2/*/android/**   apps/*/lib/**config**   packages/dart/*/lib/**config**   pubspec.yaml
pnpm-lock.yaml   package.json   pnpm-workspace.yaml   .gitignore
```

## 3. The request path (order is a security property)

`services/api-gateway/src/index.ts:644-660`: `securityHeaders → requestId → inputValidation →
errorResponseSanitizer → request timing → observability → cors` (credentialed allowlist from
`resolveCredentialedCorsOrigin`; `X-Store-ID` is a **selector** header, never an authority) →
`/health` → `/v1` `apiVersioning` → `queryCostRateLimit` (20 pts/s, 200 burst) → `/auth/*`
`authRateLimit` (GET `/auth/custom/session` exempt) → routers. Per route: `authMiddleware`
(internal HMAC verifiers, `middleware/auth.ts`) or `verifyGatewayCustomerSession` →
`store-context` (`verifySiteOwnership`) → `withTenantTx` → RPC/query → `errorResponseSanitizer`
(`middleware/security.ts:90`, fixed public message per code from `lib/public-errors.ts`;
`raw-error-message-validator` polices it — ambient red today).

Next apps: `apps/customer_web/src/proxy.ts` resolves the store from the Host (custom domains 301 to
the primary host, migration `185`; Vercel preview hosts special-cased `:179-182`); the hosted checkout
origin `checkout.<root>` resolves its tenant from a **signed handoff**, never the Host; app `api/`
routes are gateway proxies (route-ownership lockstep, `domain-boundary-validator`); identity-platform
carries its own `csrf.ts`, `cookies.ts`, `device.ts`, `password-set-intent.ts` and Turnstile on the
auth forms (`tests/auth/*.test.mjs`).

Lineage A: client → Firestore rules (→ occasionally a Cloud Function). There is no gateway.

## 4. Invariant catalogue — what enforces it, what proves it, how to probe it

| # | Invariant | Enforced by | Proven by | Probe |
|---|---|---|---|---|
| I1 | Tenant = validated claim + ownership; the GUC is set only by `withTenantTx`; never a body/query/header/cookie/Flutter value | `tenant-transaction.ts`, `verifySiteOwnership`, `requireSiteIdPredicate` (`tenant-core:621`) | `tenant-isolation.test.ts`, `merchant-tenant-predicate.test.ts`, `tenant-load-bearing-d4.test.ts`, `tests/governance/foundation-wave2-tenant.test.ts`; validators `tenant-isolation`, `no-blanket-service-role` | psql as `app_tenant` with the GUC unset → `count(*)` = 0 on any FORCE table; a write → 0 rows |
| I2 | RLS `ENABLE` + `FORCE` on every tenant table; predicate on `app.site_id`; no `USING(true)` to PUBLIC/anon/authenticated | migrations (`163` + per-table), `rls-force-coverage-validator`, `no-public-using-true-validator` | `tests/governance/d2-rls-red-team.test.mjs` | `SELECT relname FROM pg_class WHERE relrowsecurity AND NOT relforcerowsecurity` must be empty for tenant tables |
| I3 | No `service_role` for tenant data; break-glass is narrow and audited | `no-blanket-service-role-validator`, `app-utils-service-role-edge-validator` | validator output | grep `SUPABASE_SERVICE_ROLE_KEY` consumers; each must be a named break-glass path |
| I4 | Sole asymmetric issuer; verify-only everywhere else; no shared symmetric secret across trust domains | `identity-issued-session.ts`, `identity-session-verifier.ts`, `identity-sole-issuer-validator`, `single-source-crypto-validator` | `identity-issuer-d3.test.ts`, `identity-redteam.test.ts` (HS256 coercion against the merchant verifier → rejected) | mint an HS256 token with any secret → gateway 401 with "must use an asymmetric algorithm" |
| I5 | Customer-realm HS256 is bounded: a forged customer token never grants merchant/admin rights; the deviation is collapsed, never extended | realm separation in the verifiers; `cookie-realm-validator` | `identity-redteam.test.ts:147-273`, `tests/auth/customer-session-gateway.test.mjs` | present a customer session to a merchant route → 401/403 |
| I6 | Money only through the canonical RPCs with `idempotency_key`; advisory lock before existence check; balance derived; `bigint` minor units; 0% commission; no custody | `canonical-ledger-only-validator`, `commission-bps-zero-validator`, `no-self-custody-rail-validator`, `payment-rail-allowlist-validator` | `money*.test.ts`, `idempotency.test.ts`, `gift-card-money-path.test.ts`, `checkout-payment-rail-retirement.test.ts` | two concurrent `create_checkout_order` calls with one key → one order, one ledger transaction |
| I7 | Payment evidence: constant-time HMAC over the raw body; missing signature ⇒ rejection; amount/currency asserted; replay idempotent | `routes/payments.ts` (`timingSafeEqualHex(expectedSig, body.razorpay_signature)`), `webhook-service/src/index.ts:248-253` | `payments.test.ts:58`, `checkout.test.ts:28`, `v1-payment-session-provider-allowlist.test.ts` | POST the webhook without the signature header → 4xx, no state change; replay the same event → no second ledger row |
| I8 | Server-authoritative totals and cart-bound handoff | `create_checkout_order`; cart digest `timingSafeEqualHex(expectedCartDigest, cartDigest)` | `checkout-d6.test.ts:66` | alter one line item after the handoff → rejected |
| I9 | Reserve-with-TTL and release; one stock truth | migrations `211`, `216`; `single-writer-ownership-validator` | `tests/governance/foundation-wave*`, gateway checkout tests | abandon a paid intent → reservation released by the sweeper; `products.stock` == `inventory_levels.available` |
| I10 | Step-up on refunds/payouts is real cryptography | `stepup-crypto-validator` | validator output | a refund without a valid challenge → 403 |
| I11 | Rate limiting fails closed; auth endpoints tiered; Turnstile on registration/login | `authRateLimit`, `queryCostRateLimit`, identity Turnstile | `rate-limit-query-cost-backend.test.ts`, `tests/auth/customer-abuse-controls.test.mjs` | break the limiter backend → auth endpoints 503, never 200 |
| I12 | CSRF and cookie realms | `apps/identity-platform/src/lib/auth/csrf.ts`, `cookie-realm-validator` | `tests/auth/csrf-contract.test.mjs`, `tests/auth/sso-redirects.test.mjs` | POST with cookie and no token → 403 |
| I13 | Business mutation + outbox event atomic; consumers idempotent, retry-safe, DLQ-aware; envelopes signed | `queue-tenant-envelope.ts`, `event-versioning-validator`, `queue-lifecycle-validator` | `tenant-load-bearing-d4.test.ts`, queue-workers `test/*.test.mjs` | tamper an envelope's `site_id` → consumer rejects |
| I14 | Secrets never in the tree, bundles or Flutter binaries; `--dart-define` for mobile | `environment-validator`, `committed-secret-placeholder-validator`, `secret-topology-validator`, `foundation-antifabrication-gate`, `ci.yml` secret-hygiene | `grep -c fromEnvironment` on the five contained Dart files (= 7 hits); `rzp_live_`-shaped literals = 0 across `packages/dart`, `apps/*_app`, `services/compatibility` | `strings <apk> \| grep -c rzp_live_` after a build |
| I15 | Provider honesty: mock/sandbox never reads `success`; `ProviderModeBadge` on money/fulfilment surfaces | `provider-mode-badge-validator`, `environment-honesty-validator` | `tests/security/environment-honesty.test.mjs`, `tests/security/execution-mode.test.mjs` | flip `provider_mode` to `sandbox` → badge text changes; no `success` copy |
| I16 | Input validation and sanitized errors; generic auth errors; no PII in logs | `inputValidation`, `errorResponseSanitizer`, `lib/public-errors.ts` | `security.test.ts`, `security-v1.test.ts`, `auth-middleware-fail-closed.test.ts` | oversized body → 413; unknown user vs wrong password → identical body |
| I17 | Internal routes fail closed | `internal-perimeter.ts`, `fail-closed-internal-routes-validator` | validator output, `internal-auth-keyring.test.ts` | call `/v1/internal/*` without the perimeter token → 401 |
| I18 | Android identity and signing material | `android-identity-validator` + `config/governance/android-identity-registry.json` | Phase S controls (breach reintroduced and caught) | `aapt dump badging` reads `com.letbuyy.letbuyy`; `git ls-files \| grep -E '\.jks$\|key\.properties$'` = 0 |
| I19 | Theme sanitizer locked; React sections frozen; storefront tenant isolation | `theme-governance-validator`, `no-new-react-sections-validator` | `tests/security/theme-tenant-isolation.test.mjs`, `packages/theme-engine` tests | render a theme with `<script>` → escaped |
| I20 | Reserved roots empty; frozen apps not deploy targets; no rejected package imports | `no-reserved-service-activation-validator`, `no-rejected-package-imports-validator`, `deploy-matrix-topology-validator` | validator output | `ls services/<reserved>` = 2 files |
| I21 | Lineage A live rules match the audited-safe shape (§9) | **nothing in this repository** — owner console act | unauthenticated Firestore/Storage reads against the live project | `curl` the public REST endpoint for `pending_verifications` without auth → must be 403 |

## 5. Gate battery (what `scripts/gate.sh --security` runs, and what each proves)

| Command | Proves | Does NOT prove |
|---|---|---|
| the full validator sweep (each `node scripts/validators/<name>.mjs`) incl. `tenant-isolation`, `rls-force-coverage`, `no-public-using-true`, `no-blanket-service-role`, `identity-sole-issuer`, `canonical-ledger-only`, `stepup-crypto`, `commission-bps-zero`, `payment-rail-allowlist`, `no-self-custody-rail`, `provider-mode-badge`, `session-security`, `production-safety`, `environment-validator`, `secret-topology`, `cookie-realm`, `fail-closed-internal-routes`, `android-identity` | structural invariants I1–I20 as **lints** | runtime behaviour, live DB state |
| `pnpm run test:unit:gateway` (all 94 `services/api-gateway/src/__tests__/*.test.ts`) | route-level and source-shape assertions with the mounted app graph (I4–I8, I11, I16, I17) | the runtime role's DB behaviour |
| `node --test tests/security/*.test.mjs tests/auth/*.test.mjs tests/governance/d2-rls-red-team.test.mjs` | honesty, execution mode, theme isolation, CSRF, abuse controls, RLS red-team assertions on migration text | live policy state |
| `pnpm run test:governance` (`--real-db`; ephemeral Postgres) | I1, I2, I6, I9 **as the runtime role** against the migration chain | production posture (never deployed) |
| `flutter build apk --debug` + `aapt dump badging` | I18 on a compiled binary | signing (release builds need the untracked keystore) |

**Non-vacuity rule:** before crediting any `toEqual([])`/"0 offenders" sweep, plant one offender and
watch it fail. Before crediting an env-gated suite, run it with the env set and report the skipped
count. Before crediting a real-db suite, confirm it printed a test count, not `no tests`.

## 6. Review procedure by change type

- **Auth/session/identity** (`apps/identity-platform/src/lib/auth`, gateway `middleware/auth.ts`,
  `customer-session.ts`, `identity-session-verifier.ts`): algorithms unchanged (`ES256`/`EdDSA` only
  for merchant; HS256 customer realm not widened); no new issuer; no raw Bearer path; rotation grace
  preserved; Turnstile and rate tiers still mounted; the dev bypass unreachable outside local.
- **New/changed gateway route**: `authMiddleware` or customer session; `verifySiteOwnership` before
  any site-scoped read; every tenant statement inside `withTenantTx`; Zod schema; generic errors;
  a route-level test through the mounted app; if an app needs it, the proxy adapter **and** the
  ownership classification (`domain-boundary-validator` count + federation test).
- **Schema/migration**: next sequential prefix; paired rollback restoring the definition actually in
  force; RPC redefinition diff limited to required lines; `SECURITY DEFINER` with `SET search_path`
  and schema-qualified extension calls; RLS `ENABLE`+`FORCE` + policy for any new tenant table; the
  tenant registry regenerated; data cutovers expand → backfill → verify → contract; never edit
  applied history.
- **RLS policy**: `FOR ALL` with only `USING` reuses it as the write check — nullable tenant columns
  need asymmetric `USING`/`WITH CHECK`; multiple permissive policies OR together; prove with
  `SET ROLE app_tenant` in a rolled-back transaction, GUC set and unset.
- **Money**: RPC only; idempotency key required; lock before check; balanced ledger transaction;
  provider evidence; reconcile; refunds never exceed capture; no fee (D-1, decided 2026-09-04: 0% on both channels); no custody.
- **Webhooks/queues**: raw-body HMAC unconditional; event id idempotency; envelope signed; consumer
  DLQ path; never delete an endpoint before the provider is re-pointed and observed.
- **Storefront/theme**: sanitizer allowlist untouched; Liquid default stays OFF; per-store theming
  through blessed dynamic-style patterns; host resolution and password gate unchanged; hosted
  checkout keeps the signed handoff.
- **Firebase (lineage A)**: the `firebase_bridge` copy is deleted (FB-1, 2026-09-05), so there is
  nothing left in-tree to edit — and editing it never deployed anything anyway. The live project is
  still the owner's to delete (FB-5). Until then, any live change remains an owner console act with a
  before/after unauthenticated probe, and a rules lockdown would still have to pair each closed write
  path with its callable replacement and a compatibility note for the shipped app version.
- **Flutter/Android/iOS**: identity registry diff for any `applicationId`/`namespace`/signing change;
  secrets via `--dart-define`; `google-services.json`/`GoogleService-Info.plist` are public client
  identifiers, not secrets — but no **Gemini** or **Razorpay** literal ever; tokens in secure
  storage; `flutter build` → `git status`.
- **Dependencies/CI**: lockfile diff reviewed; workflow changes never widen `permissions:` or add a
  deploy trigger to a non-`main`/`staging` branch; secrets referenced by name only; `pnpm install
  --frozen-lockfile`.

## 7. Adversarial probes (run through the mounted app, as the runtime role)

```bash
# A. Cross-tenant HTTP (two seeded sites; local gateway on :9010 via `pnpm run dev:store`)
curl -s -o /dev/null -w '%{http_code}\n' -H "X-LetBuyy-Internal-Session-Token: $SITE_A_SESSION" http://127.0.0.1:9010/v1/stores/$SITE_B/orders   # 403/404, never 200
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer anything" http://127.0.0.1:9010/v1/stores/$SITE_A/orders           # 401 — Bearer is never accepted
# B. Realm boundary: present a customer session cookie to a merchant route → 401/403 (identity-redteam.test.ts encodes the HS256 coercion case)
# C. Runtime-role RLS, rolled back (throwaway Postgres from the ephemeral helper; never a shared instance)
psql "$THROWAWAY_DB_URL" -c "BEGIN; SET LOCAL ROLE app_tenant; SELECT set_config('app.site_id','<SITE_A>',true); SELECT count(*) FROM orders; SELECT set_config('app.site_id','',true); SELECT count(*) FROM orders; ROLLBACK;"
# D. SECURITY DEFINER hygiene
psql "$THROWAWAY_DB_URL" -c "SELECT proname, proowner::regrole, prosecdef, proconfig, has_function_privilege('public', oid, 'EXECUTE') FROM pg_proc WHERE proname IN ('create_checkout_order','confirm_order_payment_with_ledger','complete_order_refund','issue_gift_card','issue_gst_invoice');"
# E. Webhook without a signature → rejected, no state change
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://127.0.0.1:9012/razorpay -H 'content-type: application/json' -d '{"event":"payment.captured"}'
# F. Idempotency: replay the same X-Idempotency-Key on checkout → identical response, one order row
# G. Secrets in bundles / binaries (after a build)
grep -rlE 'BEGIN (RSA |EC )?PRIVATE KEY|rzp_live_[A-Za-z0-9]{10,}|postgres(ql)?://[^:]+:[^@]+@' apps/*/.next/static 2>/dev/null || echo clean
strings apps/customer_app/build/app/outputs/flutter-apk/app-debug.apk | grep -cE 'rzp_live_|AIza[0-9A-Za-z_-]{35}'   # AIza hits are the public Firebase key unless proven otherwise
# H. Lineage A live probe (owner act; read-only; no auth):
curl -s -o /dev/null -w '%{http_code}\n' "https://firestore.googleapis.com/v1/projects/letbuy-y/databases/(default)/documents/pending_verifications"   # must be 403; a 200 is the live P0
# I. Route mounting: grep -n "api.route('" services/api-gateway/src/index.ts — a router not listed is not mounted
```

## 8. Threat checklist (map each finding to one)

- **Spoofing**: symmetric-alg coercion · customer-for-merchant realm confusion · Bearer reintroduced ·
  internal HMAC header forgery · dev bypass reachable · Firebase self-promotion to admin · OTP planting.
- **Tampering**: unbound statement under RLS (silent zero rows) · client-supplied `site_id`/`store_id`
  as authority · idempotency key reuse with varied inputs · direct money-table write · buyer-written
  `paymentStatus` · seller-written balance · migration editing applied history.
- **Repudiation**: audit actor attribution · outbox skipped · best-effort audit writes · Firestore
  audit-log forgery.
- **Information disclosure**: world-readable OTP/KYC collections · public Storage bucket · PII in logs
  · verbose errors · cache keyed without tenant · secrets in binaries/history · Gemini keys.
- **Denial of service**: rate-limit tiers · query cost · OTP provider spend · body size · unbounded
  pagination · queue poison messages.
- **Elevation**: customer → merchant · merchant → operator · `service_role` in an app path ·
  reserved-service activation · frozen app resurrected as a deploy target · app-platform kill switch
  bypass · client-authoritative loyalty/campaign balances spending as discounts.

## 9. Open findings register — re-verified 2026-09-04 against source at `823aa5ee`

Findings marked **(copy)** were re-read on 2026-09-04 in `services/compatibility/firebase_bridge/config/`.
**That directory was deleted on 2026-09-05 (phase FB-1)**; the findings are unchanged and are now
readable in git history at the parent of `letbuyy/fb1-retire-firebase-admin-app`, and in the
preservation bundle. The live Firebase project is still `UNKNOWN_LIVE_STATE`, and the 2026-08-28 audit
found the same patterns in System A at `be716ae` — the committed content of the bundle. A live probe
(§7 H) settles each one; until then the gate stays `LIVE_FIREBASE_SECURITY: NO_GO`, and it is **not**
cleared by the copy's deletion.

| ID | Finding | Evidence (today) | Severity |
|---|---|---|---|
| Q-1 | **Two of three Razorpay checkout entry points in one file still hardcode a key ID; the third is contained.** `packages/dart/marketplace_services/lib/src/custom_payment_service.dart` builds three Razorpay `options` maps. Line 49 uses `String.fromEnvironment('RAZORPAY_KEY_ID')` — Phase Q's containment, still in effect. Lines **89** and **122** each hardcode a literal key ID that Phase Q did not reach. **Not a credential exposure and no rotation obligation:** both remaining literals are **test-mode** (`rzp_live` count in the file is **0**), and a Razorpay key *ID* is a public client identifier by design. The finding is a **production-mode hazard** — the file is exported from the package barrel (`letbuyy_marketplace_services.dart:58`), so an app that used either of those two paths would run checkout in Razorpay **test mode**, where a payment appears to succeed and settles nothing. Dead today: no app references `CustomPaymentService`; the file is `Agrimate`-branded donor lineage. **Corrects the record:** `17_remaining_migration_backlog.md` §8 says Phase Q "found and fixed 2 more" here — it fixed one occurrence in this file and left two of the same shape in it, the fixed-the-occurrence-not-the-class pattern | `custom_payment_service.dart:49` (contained) vs `:89`, `:122` (literal); `grep -c 'rzp_live'` = 0; no app imports `CustomPaymentService` | **LOW today, HIGH if the file is ever used** — fix belongs to the D-10 client cutover; pinned meanwhile by `tests/governance/ambient-red-attribution.test.mjs` |
| B-1 | **`POST /v1/billing/subscribe` activates a paid merchant subscription from a CLIENT-SUPPLIED payment status.** `sandbox_payment_status` is a request-body field defaulting to `'paid'`, and the success path writes a fabricated provider reference (`sandbox_autopay_payment:<idempotency_key>`) with no provider call, no signature check and no amount verification. `assertAutopayReady` guards `/mandate` and **nothing else**, so the behaviour did not vary with `LETBUYY_AUTOPAY_MODE`: an authenticated merchant on a live deployment could activate any purchasable plan without paying. Violates "never trust client payment status" and "a client-supplied payment identifier is never sufficient proof of payment" (I6/I7) in a single request. **CONTAINED 2026-09-06 (F-BILL-1):** live mode now refuses with `AUTOPAY_PROVIDER_SETUP_REQUIRED` **before any database access**, and sandbox is unchanged. Note the containment is deliberately not `assertAutopayReady` — that passes once Razorpay credentials exist, and the path would then fabricate a reference on a credentialled deployment, which is worse | `packages/billing-core/src/index.ts:126` (`.default('paid')`); `routes/billing.ts` success path writes `sandbox_autopay_payment:`; `assertAutopayReady` called at one site only | **HIGH before containment** on any live deployment; **contained** now. The real fix is a verified platform→merchant payment path, which is **D-PLATFORM-CHARGE** |
| A-1 | Customer login OTPs plaintext in a world-readable/writable collection | (copy) `firestore.rules:49-50` `pending_verifications/{email}` → `allow read, write: if true` | **P0 if live** — any holder of the public Firebase config reads or plants any customer's OTP |
| A-2 | Admin email-change OTPs world-readable/writable | (copy) `firestore.rules:115-117` `emailChangeOTPs/{adminId}` → `allow read, write: if true` | **P0 if live** — admin takeover |
| A-3 | Storage bucket-wide public read incl. KYC PAN/Aadhaar/selfies (additive rules) | (copy) `storage.rules:53` `allow read: if true` + 9 further public reads | **P0 if live** — DPDP exposure; remediate ahead of any rollback window |
| A-4 | Self-promotion to admin: `users/{uid}` update has no field restriction while `isAdmin()` reads `role` from that document | (copy) `firestore.rules:175` `allow update: if isOwner(userId) \|\| isAdmin()`; `:22-25` | **P0 if live** — every admin check bypassable |
| A-5 | Buyer-writable orders and payment state; the shipped client writes `paymentStatus: 'paid'` itself | (copy) `firestore.rules:465-468`, `:481`, `:495-496` (`create`/`update: if isAuthenticated()`); `apps/customer_app/lib/screens/checkout/payment_method_screen.dart:163` | **P0 if live** — goods without payment |
| A-6 | Seller-mintable wallet balance and self-created wallet credits; scheduled payouts sweep it | (copy) `firestore.rules:215` seller `update: if isOwner(sellerId) \|\| isAdmin()`; `:388` `wallet_transactions` `create: if isAuthenticated()` | **P0 if live** |
| A-7 | Client-authoritative ad impressions/clicks/wallets and loyalty points | (copy) blocks at `firestore.rules:685`, `:700`, `:709`, `:959` — `allow` lines not re-read this session | P1 (money-adjacent), re-verify |
| A-8 | Payment-provider secret in the client | **CLOSED as an exposure** (owner deleted the values at the providers 2026-09-02); containment present: `fromEnvironment` in `razorpay_config.dart` (2), `custom_payment_service.dart` (1), `razorpay_custom_service.dart` (2), `gemini_config.dart` (1), `ai_chat_service.dart` (1); 0 `rzp_live_`-shaped literals remain | dead values in published history on both remotes and in the bundles — history-scrub is an owner decision |
| A-9 | Payment success not verified server-side by the primary checkout | verifier code exists (`marketplace_services/lib/src/payment/custom_checkout_service.dart`, `payment_service.dart`; `firebase_bridge/src/razorpayService.ts`); **whether the shipped checkout calls it was not re-verified today** | P0 candidate — `CLAIMED_NOT_VERIFIED` |
| A-10 | Unauthenticated storefront order creation and the unsafe set-password route | System A's `apps/store/storefront` was **not** brought into this repository; if still deployed on the old Vercel storefront it is live | `UNKNOWN_LIVE_STATE`; owner: confirm the old storefront is decommissioned |
| A-11 | Which of the 3 distinct release keystores signs the Play listing is unproven | `~/LetBuyy-signing-recovery-2026-08-29/` (4 files, 3 hashes); the Play Console fingerprint is the only authority | P1 before any release |
| C-1 | Customer realm minted HS256 with `CUSTOMER_SESSION_SECRET` | `cookies.ts:194`, `customer-session.ts:56-61`; bounded by the red-team case | P2 design debt; collapse onto the sole issuer (IDENTITY phase) |
| C-2 | `raw-error-message-validator` red (a public message not fixed per code somewhere) | ambient gate red at `823aa5ee` | P2 — information disclosure hygiene; attribute in CI-1 |
| C-3 | `environment-validator` red on Firebase public keys and Razorpay's sample test key; `foundation-antifabrication-gate` red on the inert bridge literal | false positives without an exemption mechanism (`17_remaining_migration_backlog.md` §7) | gate hygiene |
| C-4 | Migrations 208–210 untracked in the primary checkout (FK repoints + an upsert RPC) | `git ls-files --others` in the primary; gap 207→211 | P2 — schema divergence between disk and history; the owner of that session commits with rollbacks |
| C-5 | Dev-user literal in `middleware/auth.ts:150-158` (an e-mail address) | source | P3 — not a secret, but a hardcoded identity; replace with an env-driven fixture |
| C-6 | iOS bundle identifiers ungoverned (`PRODUCT_BUNDLE_IDENTIFIER` in three `project.pbxproj`) | Phase S finding | P2 — extend the identity validator |
| C-7 | The remote cannot be read; branch protection on `main`/`staging` unverifiable; `security-review.yml`/`full-security-audit.yml` need `ANTHROPIC_API_KEY`; whether Cloudflare/Vercel/Supabase secrets exist is unknown | `ci.md` §0 | process — this skill's rules are the only guard |
| C-8 | `.github/CODEOWNERS` names four deleted app paths | grep count 4 | P3 — review lanes point nowhere (CI-1) |
| B-1 | Edge Function identity was an unsigned header; payments mocked | audit 2026-08-28; bridge is inert | informational until Phase 2 |

## 10. Reporting

```
SECURITY LANE — <phase> (lineage A|B|C)
Verdict: PASS | PASS_WITH_FINDINGS | BLOCKING
Findings (most severe first): ID · severity (P0/P1/P2/P3) · invariant (I#) · threat class · path:line · evidence (command + output) · fix · gate/test that will catch a regression
Probes run: command · result · what it proves        Not run: which, why
Gates run: from gate.sh table (exit codes; first failure by name; ambient reds attributed)
Live state: UNKNOWN_LIVE_STATE items listed explicitly (Firebase rules, deployed storefront, GitHub protection, secrets presence)
Owner decisions: from decisions.md touched by this change
```

`BLOCKING` = any P0, any new P1 without a mitigation in the same phase, any invariant I1–I21
weakened, any secret value found in the diff, any widening of CI `permissions:`, any deploy trigger
added to a non-release branch, any Firebase rules change without its callable replacement, any change
to `applicationId`/`namespace`/signing without the registry.
