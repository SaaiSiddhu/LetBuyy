# 16 — Security Review (discovery phase; no changes made)

Evidence levels: `inspected source`, `reproduced locally` (this session), `historical`, `unknown`. Severity is about the unified platform's risk, not only today's exposure. No secret values appear here.

## 1. S1 — canonical LetBuyy

| ID | Boundary | Finding | Evidence | Severity | Recommendation |
|---|---|---|---|---|---|
| S1-SEC-01 | Tenant isolation | RLS ENABLE + FORCE with transaction-local GUC; unset GUC → zero rows; red-team RT-1…RT-9 pass; 279 tenant tables registered, 0 direct service-role bypasses by validator | reproduced locally (`tenant-redteam` suite), validator | strong | keep; every new table gets FORCE RLS + GUC policy; extend red-team to nodes, custodians, riders |
| S1-SEC-02 | Application data access | the guarded Supabase client still uses the service-role key; only some handlers use the pooled `SET LOCAL ROLE app_tenant` transaction (`lib/tenant-transaction.ts`, `withResolvedTenantTx`); others rely on the app-layer query guard | inspected source; corroborated by the independent review | medium | route new Quick/POS/dispatch handlers through the tenant transaction path; measure which existing handlers bypass it and migrate |
| S1-SEC-03 | Sessions | merchant and buyer realms asymmetric with JWKS; store-customer realm **HS256** shared secret (`CUSTOMER_SESSION_SECRET`) — verification key is the forgery key | inspected source | high if leaked | collapse onto buyer realm during identity phase |
| S1-SEC-04 | Operator access | console login is dev-only; production refuses (`admin_web/…/console-auth/login/route.ts:27-29`) | inspected source | blocks operations | operator realm on identity-platform with MFA |
| S1-SEC-05 | Staff privilege | `assertStaffPermission` default `dryrun` (never blocks); even in `enforce`, missing context or lookup exceptions return `block:false` | inspected source (`middleware/staff-permission.ts:46-51,135-153`) | medium | enforce + fail closed before Store Ops/POS memberships |
| S1-SEC-06 | Payments | storefront verify path confirms on a valid HMAC signature + stored order id + replay check, **without reading provider capture state** | inspected source (`routes/storefront/checkout-payment-routes.ts:560+`, `payment-execution.adapter.ts`) | high (money) | fetch payment and require `captured` with matching amount/currency/order before `paid`; keep webhook as the second authority |
| S1-SEC-07 | Payments | refund provider status `created` treated as `refunded` in the adapter and in the `refund.created` webhook route | inspected source (`packages/infrastructure/razorpay-adapter/index.ts:413-417`) | medium (money state) | model created/processed/failed |
| S1-SEC-08 | Payments / stock | late capture after `expire_unpaid_committed_reservations` released stock: `confirm_order_payment` rejects cancelled/refunded orders but not released inventory | inspected source (211, 168) | medium | policy: re-reserve if available else hold + refund |
| S1-SEC-09 | Webhooks | raw-body HMAC and constant-time compare good; but the event row is upserted as `received` before processing and zero returned rows = duplicate, so a failed first attempt is skipped on retry; refund fallback event id includes timestamp/signature slice (unstable) | inspected source (`services/webhook-service/src/index.ts:12-54`) | medium | key duplicates on processed status; derive stable ids |
| S1-SEC-10 | Internal perimeter | `INTERNAL_API_SECRET` (+ previous) and optional IP allowlist; internal payment routes check `isInternalRequest` | inspected source | adequate | keep; rotate on schedule |
| S1-SEC-11 | Rate limiting / bots | limiter fails closed when its store is unavailable; Turnstile on identity and security middleware | inspected source (`middleware/rateLimit.ts:341`) | good | extend to Quick quote and rider endpoints |
| S1-SEC-12 | Media | MIME allowlist, size checks, R2 keys under site, signed intents | inspected source (`routes/upload.ts:119-196`) | adequate | proof-of-delivery uploads must be participant-bound |
| S1-SEC-13 | Secrets | no live credential in tree; environment-validator reds are public Firebase Web API keys in the retiring app and a Razorpay sample test key in a donor fixture (attributed) | validator + hazards ledger | low | keys leave with the Firebase cutover |
| S1-SEC-14 | Storefront custom code | no scripts/embeds/style attrs; CSS sanitised; Liquid output escaped | inspected source (`theme-renderer.ts:300-301,1063`) | good | keep sanitizer locked |
| S1-SEC-15 | IDOR | order/payment routes bind to the store via `loadPublishedStore`/`verifySiteOwnership`; buyer routes require buyer session; `purchases` unreadable by merchants | inspected source; parent-child suite | good | keep; add tests per new route |
| S1-SEC-16 | Data protection | `customer_dsr_exports` exists; no retention policy document; no deletion workflow located | grep | flag | define retention per class (no durations invented here) |
| S1-SEC-17 | Deployment | deploy lanes dispatch-only, Vercel ids placeholders, remote unreadable; live state unknown though the founder states deployments exist | inspected config | governance | record deployed SHAs and applied migrations before extending claims |

## 2. S2 — Firebase marketplace

| ID | Boundary | Finding | Evidence | Severity |
|---|---|---|---|---|
| S2-SEC-01 | Firestore rules | `allow read, write: if true` on `pending_verifications`, `admin_otps`, `emailChangeOTPs`; open reads on `trending_searches`, `category_attributes`; open `create` on `adminActivityLogs` (rules 1,141 lines, 95 blocks) | inspected `services/compatibility/firebase_bridge/config/firestore.rules` (archived copy; live rules unknown) | high if live |
| S2-SEC-02 | Client trust | the app writes orders to Firestore after the Razorpay success callback; signature verification is a callable the client invokes; commission computed by callable on client request | inspected `payment_method_screen.dart`, `order_service.dart` | high (money) — resolved by moving checkout to S1 |
| S2-SEC-03 | Identity | Firebase UID is the key of every customer document; no server-side mapping exists yet in S1 | inspected | migration risk |
| S2-SEC-04 | Secrets | public Firebase config in `firebase_options.dart` (client identifiers, expected); Cloud Functions secrets not in repo | inspected | low |
| S2-SEC-05 | Storage rules | 36 match blocks; not reviewed line by line | — | unknown |

## 3. S3 — AgriMore

| ID | Boundary | Finding | Evidence | Severity |
|---|---|---|---|---|
| S3-SEC-01 | Auth parsing | gateway, realtime gateway and shared Edge helper read `payload.user.id` from the GoTrue `/user` response (which returns the user object directly); ADR-0005 says fix before relying on it; still present | `workers/api-gateway/src/middleware/auth.ts:44-54`, `realtime/auth.ts:38-43`, `_shared/auth.ts:55-62` | blocks reuse |
| S3-SEC-02 | Service hop | Edge Functions trust `x-user-id` / `x-user-role` headers with no per-hop secret; function URL exposure depends on `verify_jwt` (unknown) | `_shared/worker_context.ts:9-20`, `upstream/supabase.ts:97,165-169` | high if reachable |
| S3-SEC-03 | Payments | `confirm-payment` verifies the Razorpay signature only when all three fields are present, then confirms the order; reached from the webhook handler after HMAC today | `functions/confirm-payment/index.ts:36-70` | medium; high with S3-SEC-02 |
| S3-SEC-04 | RLS | 46 tables enabled, 0 FORCE, 1 `USING (true)`; membership via helper functions, not GUC | `000010_rls_policies.sql` | incompatible with S1 law as-is |
| S3-SEC-05 | Secrets | live Razorpay credentials in git history; rotation `OPEN` with placeholder date | `SKIPPED_TASKS.md` §S-1 | high (owner action) |
| S3-SEC-06 | Realtime | channel authorisation by role list only; participation (is this rider assigned to this delivery?) not checked in `authorizeChannel` | `realtime/auth.ts:49-64` | medium — fix in the S1 port |

## 4. Cross-cutting concerns for the unified platform

- **Tenant + location boundaries:** every Quick/Store Ops/dispatch route must check location membership in addition to site RLS; a client-supplied node id is never authority.
- **Buyer data:** shared identity must not widen merchant access; merchants keep seeing only their `store_customers`; buyer-level rows stay platform-scoped.
- **Money:** provider evidence before `paid`; refunds with lifecycle; commission/fee postings balanced in the ledger; payouts record-only until the custody decision; step-up on refunds/payouts/bank changes re-verified.
- **Realtime:** subscriptions authorised by participation; live location TTL'd; no PII in room payloads beyond need.
- **Webhooks:** stable event ids, reprocess after failure, DLQ visibility in the operator console.
- **Rate limiting:** quotes, offers, heartbeats and OTP endpoints under per-principal limits; fail closed.
- **Media:** proof photos and KYC documents private with short-lived signed reads.
- **Data protection:** retention and deletion per data class; DSR flow covers buyer, addresses, location traces.

## 5. Governance side-effects observed during discovery

- The 2.2 GB copy at `apps/phase_2/Agrimore_Supabase` (own `.git`, `node_modules`, `.dart_tool`, `build`) makes `runtime-validator` red ("Unexpected phase_2 app runtime root") and `stale-artifact-validator` red; the real gate lane would delete its caches; a `git add` would create a submodule pointer. Not a vulnerability; a hygiene blocker. Recommendation: remove or replace with a source-only donor snapshot at a committed SHA.
- `apps/seller` (another session's untracked folder) also reds `runtime-validator`.

## 6. What was not done

No penetration test, no runtime exploit, no live rules or cloud settings inspection, no Flutter build; no security architecture was changed.
