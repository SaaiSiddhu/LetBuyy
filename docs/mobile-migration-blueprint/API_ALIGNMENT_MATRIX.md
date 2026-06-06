# API & INFRASTRUCTURE ALIGNMENT MATRIX

**Goal:** one backend, no Firebase paths, no duplicate business logic. This doc maps **every gateway endpoint group** to its current mobile usage and the target state.

**Backend = one Cloudflare Worker:** `services/api-gateway` (`letbuyy-api`, Hono, base `/v1`, host `api.letbuyy.store`). 33 route files, ~37 mounts, cron-driven outbox dispatch. Companions: `webhook-service` (provider webhooks), `queue-workers` (CF Queues + Postgres outbox). Six other `services/*` are **reserved stubs**.

**Mobile client today:** `packages/dart/api_client` (Dio) + app-local services. It already calls the *same* gateway as the web app.

---

## 0. The single most important alignment issue: AUTH

The web app reaches the gateway through a **trusted Next.js server** that signs **HMAC internal headers** with `INTERNAL_API_SECRET`. The gateway's `authMiddleware` (`services/api-gateway/src/middleware/auth.ts`) accepts three credential types:

1. **Bearer** → `supabase.auth.getUser(token)` (Supabase JWT).
2. **`X-LetBuyy-Internal-Session-Token` + Timestamp + Signature** → HMAC over the opaque `sessions` token.
3. **`X-LetBuyy-Internal-User-ID/-Email/-Store-ID` + Timestamp + Signature** → HMAC, 5-min freshness.

The Flutter app sends `Authorization: Bearer <lb_session>` + `Cookie: lb_session=…` + `X-LetBuyy-Session-Token`. **None of these is a valid gateway credential**: the `lb_session` opaque token is not a Supabase JWT, and the app can't HMAC-sign (it has no `INTERNAL_API_SECRET`, nor should it). → **Protected `/v1` routes reject the mobile app.** The repo's own `CODEX_MOBILE_PARITY_STATUS.md` calls this out: *"raw lb_session / cookie transport is not accepted by protected /v1 merchant routes… needs a mobile-safe gateway session bridge."*

**Two viable fixes (decide in P0 — detail in MOBILE_ARCHITECTURE_V2.md):**
- **(A) Mobile BFF Worker** — a thin Cloudflare Worker that holds `INTERNAL_API_SECRET`, validates the app's `lb_session` against `sessions`, and re-signs internal headers to the gateway. *Pro:* reuses the existing trusted-boundary model; no gateway change. *Con:* new deployable.
- **(B) Supabase JWT path** — mint a real Supabase session for merchants so the app sends a Bearer JWT the gateway already validates. *Pro:* no new service; uses branch 1. *Con:* requires merchant accounts to exist in Supabase `auth.users` and a token-issuance flow; reconciles two identity systems.

Until one ships, **every "uses gateway" row below is blocked for authenticated calls.**

---

## 1. Endpoint-group alignment matrix

Legend — **Mobile today:** ✅ consumed in real UI · 🟠 scaffolded (generic viewer/stub) · ❌ not called. **Target:** P0–P4 priority (see roadmap).

| Gateway group (`/v1`) | Implementing package | Web uses | Mobile today | Mobile client method | Target |
|---|---|---|---|---|---|
| `/auth/custom/session` | auth-core | ✅ | 🟠 (own `/api/auth/session` on identity host) | `StoreAuthService` (raw http) | **P0** session bridge |
| `/auth/signin\|signup\|otp\|password` | auth-core / supabase | ✅ (identity app) | 🟠 (identity host, dev-bypass) | `StoreAuthService` | **P0** harden |
| `/stores` (+publish, payment-config) | tenant-core, commerce-core | ✅ | ✅ | `api.stores.*` | P0 (exists) |
| `/onboarding` | tenant-core | ✅ (identity) | ✅ (wizard → `POST /stores`) | `StoreService.createStore` | P0 |
| `/products` (+collections, gift-cards, bulk) | commerce-core | ✅ | ✅ products / 🟠 collections,gift-cards | `api.products.*` | P0 done; P1 collections |
| `/categories` | commerce-core | ✅ | 🟠 (parity viewer) | `api.categories` | P1 |
| `/inventory/levels`,`/adjust` | commerce-core | ✅ basic | 🟠 (parity viewer) | `api.inventory` | **P1** |
| `/inventory` WMS (locations/suppliers/POs/transfers/bulk-adjust/history) | commerce-core | ❌ (web stubs) | ❌ | — | P2 (mobile can leapfrog) |
| `/orders` (+fulfill, refund) | checkout-core, commerce-core | ✅ (refund missing in web UI) | ✅ list/status/fulfill; ❌ refund; ❌ detail | `api.orders.*` | **P1** detail+refund |
| `/customers` (+addresses) | commerce-core | 🟠 list only | 🟠 (parity viewer) | `api.customers` | **P1** (leapfrog web) |
| `/coupons` (+validate) | commerce-core | ✅ | 🟠 (parity viewer) | raw get | **P1** |
| `/payments` (plans, subscription, provider orders) | payments, billing-core | ✅ | 🟠 (UI present, **Razorpay TODO**) | `SubscriptionService` | **P0** wire Razorpay |
| `/upload`, `/media` | R2 inline | ✅ | ✅ upload; ❌ media library | `api.uploadFile`, `StorageService` | P0 upload; P2 library |
| `/analytics/dashboard`,`/orders` | projections | ✅ | ❌ (**faked client-side**) | — | **P1** consume real endpoint |
| `/themes` (+editor/draft/publish/releases/rollback/preview-session) | theme-engine | ✅ | ✅ (editor + draft + preview) | `ThemeService` | P2 (align engine) |
| `/pages` (+policies, navigation) | cms-core | ✅ | 🟠 (parity viewer) | raw get | P2 |
| `/blog` (posts, comments) | cms-core | ✅ | 🟠 (parity viewer) | raw get | P2 |
| `/shipping-tax` (shipping zones/rates, taxes) | commerce-core | ✅ | 🟠 (parity viewer) | raw get | P2 |
| `/reviews` | commerce-core | ✅ | 🟠 (parity viewer) | raw get | P3 |
| `/form-submissions` | cms-core | ✅ | 🟠 (parity viewer) | raw get | P3 |
| `/notifications` | notification-core | ✅ | 🟠 (parity viewer); **no push** | raw get | **P1** (push via `device_tokens`) |
| `/employees` (staff/RBAC) | auth-core | ✅ | 🟠 (parity viewer) | raw get | P3 |
| `/app-store` (installs, bridge, OAuth, billing) | app-engine, extension-host | ✅ (embedded App Bridge) | 🟠 (parity viewer) | raw get | P3 (hard on mobile) |
| `/ai` (credits, usage) | — | 🟠 | ❌ | — | P3 |
| `/export` (import-products, bulk) | — | ✅ (import) | ✅ (import screen) | `ProductService` | P2 |
| `/stores/:id/domain`, `/domains/check` | tenant-core | 🟠 (string only) | 🟠 (DomainService present) | `DomainService` | P2 lifecycle |
| `/storefront/*` (public shopper API) | commerce/checkout/cms | n/a (preview/lookup) | partial (preview URL) | — | shopper app, not merchant |
| `/admin`, `/internal/*`, `/operations/*` | event-core, runtime | ❌ (platform/ops) | ❌ | — | operator app, not merchant |
| GraphQL `/admin\|/storefront` | rest-shim | ❌ (off in prod) | ❌ | `api.graphql` exists | — (FEATURE_GRAPHQL=false in prod) |

---

## 2. Gaps in three directions

### 2a. Endpoints the gateway HAS that mobile should use but doesn't (build the client UI)
Customers detail+addresses, full Inventory WMS, Orders detail + **refund**, Coupons CRUD, real **Analytics** (`/analytics/dashboard`), Notifications + push, Pages/Blog/Navigation, Shipping/Taxes, Reviews, Employees, Media library, App-store. *These are mostly UI-build tasks — the backend already exists.*

### 2b. Endpoints mobile UI implies but the BACKEND lacks (escalate to platform)
- **Payouts / settlement / wallet / commission / KYC / returns** — only in quarantined `legacy/firebase/`; **no gateway route**. A mobile "Payments → Payouts" or "Returns" screen cannot be built until these exist anywhere. (See FIREBASE_DECOMMISSION_PLAN.md §4.)
- **Gift-card backend** for mobile — listed in parity registry with **no endpoint**; web issues via `/products/gift-cards` (verify mobile-safe contract).
- **Business/Localization/Security(2FA)/Custom-data** — web renders these as `BackendNeededPane` stubs documenting missing gateway contracts. Mobile is equally blocked.

### 2c. "Legacy mobile equivalents" — duplicate logic to delete
- **`analytics_service.dart` computes metrics client-side** instead of calling `/analytics/dashboard`. This is duplicated business logic → replace with the gateway endpoint (single source of truth).
- **`product_service.dart` `_toLegacyProductMap`** maintains a camelCase projection alongside `ProductContract` → collapse onto the shared contract.
- **`storage_service.dart`** wraps `/upload` — fine, keep (thin).
- No Firebase/Firestore code paths remain to delete (already done).

---

## 3. Infrastructure alignment

| Concern | Backend reality | Mobile alignment |
|---|---|---|
| Compute | CF Workers (gateway/webhook/queues) + Vercel (web) | Mobile calls gateway directly; **needs BFF or JWT for auth** |
| Data | Supabase Postgres via Hyperdrive; service-role client (RLS bypassed; tenant isolation in app code) | Mobile must rely on gateway authorization (never talk to Postgres directly) — already true |
| Media | Cloudflare **R2** behind `cdn.letbuyy.store`; Supabase Storage unused | Mobile uploads to `/v1/upload` → R2 — aligned |
| Async/events | CF Queues + Postgres outbox; `queue-workers` consumers (analytics/search/payment/notification) | Mobile is a producer of events via normal API calls; **push delivery** to mobile = new (FCM/APNs via `device_tokens` + a notification dispatcher) |
| Realtime | **None** server-side (no WS/SSE) | Mobile must **poll** (as `order_service` already notes) or wait for a future realtime layer; design for poll + pull-to-refresh now |
| Identity | Custom opaque `sessions` (`lb_session`), 3 cookie domains; Supabase Auth wired in parallel | **The crux** — choose BFF vs Supabase-JWT (see §0) |
| Secrets | `INTERNAL_API_SECRET`/`AUTH_SECRET` server-only; provider keys `SKIP_NEEDS_HUMAN_*` | Native app must **never** hold internal/HMAC secrets; only the publishable Razorpay key |
| Feature flags | Server-side `FEATURE_*` (GraphQL off in prod) | Mobile should read capability from server, not hardcode |

---

## 4. Mandate: single backend, no duplicate logic

1. **All mobile data flows through `api.letbuyy.store/v1`.** No direct Postgres, no Firebase, no second backend. (Already true at the transport layer.)
2. **Delete client-side business logic** that duplicates the gateway (faked analytics, legacy product map).
3. **One identity, one session bridge** — pick BFF or Supabase-JWT; do not invent a third auth model.
4. **Reuse shared contracts** (`packages/dart/models` `*Contract`) so mobile and web deserialize the same shapes; reconcile any local model drift.
5. **Treat reserved services as the gateway** — don't build mobile against `services/checkout-runtime` etc.; they're stubs whose behavior lives in `api-gateway`/`queue-workers`.

---

## 5. The session-bridge contract (P0 deliverable spec)

Whichever option is chosen, the mobile app needs a credential the gateway's `authMiddleware` accepts. Minimum contract:

- **Login:** app → identity/bridge with email+password (+ real Turnstile, not `dev-bypass-token`) → receives a **gateway-valid credential**: either a Supabase JWT (Option B) or an opaque token the BFF will exchange (Option A).
- **Per request:** app attaches the credential; for Option A the BFF injects `X-LetBuyy-Internal-Session-Token` + Timestamp + Signature; for Option B the app sends `Authorization: Bearer <jwt>`.
- **Validation:** `GET /v1/auth/custom/session` returns `{authenticated, user}` — the app's session-health probe.
- **Refresh/expiry:** honor the 30-day `sessions` TTL (Option A) or Supabase refresh tokens (Option B); store in `flutter_secure_storage` (already used).
- **Logout:** destroy the server session (`/sessions/destroy`), clear secure storage.

Acceptance: a real merchant logs in on a physical device and successfully `GET /v1/products?store_id=…` returns their catalog (today this 401s).
