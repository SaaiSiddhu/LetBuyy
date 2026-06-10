# PHASE 10 — MOBILE FORENSIC AUDIT

**Subject:** `apps/mobile/merchant-app` (LetBuyy Merchant / "Store Builder" Flutter app)
**Date:** 2026-06-10
**Auditor role:** Senior Flutter / mobile architecture auditor
**Repo root:** `/Users/saai_sidd/Git/Letbuyy_Store`
**Scope:** The single implemented mobile runtime. `apps/mobile/shopper-app` and `apps/mobile/operator-app` are **verified reserved-empty** (manifest + AGENTS.md only — see below). Shared Dart lives in `packages/dart/{core,api_client,models,services,ui_kit}`. The app talks to `services/mobile-bff` (cross-linked to Phase 1) and, through it, `services/api-gateway`.

---

## Methodology

- Evidence-only. Every claim cites `path:line` with quoted Dart/Kotlin/TS. Items that can only be confirmed on a device or live backend are marked **UNVERIFIED (runtime)**.
- Re-verified all prior hypotheses (V1 §10/§12, memory notes, Phase 6/Phase 1) against **current working-tree code** and marked each **FIXED** / **OPEN** / **FALSE**.
- Read the real wiring: `main.dart`, `app/app.dart`, `app/routes.dart`, `app/auth_wrapper.dart`, `app/deep_link_router.dart`, `config/app_config.dart`, `services/store_auth_service.dart`, `services/api_client.dart` → `packages/dart/api_client/lib/src/api_client.dart`, `services/money_service.dart`, the parity catalog (`screens/parity/*`), the Turnstile challenge screen, the theme editor, dashboards, Android/iOS manifests, Gradle, and CI.
- Measured: 307 files in the app; **71,139 lines of Dart under `lib/`**; 32 `ChangeNotifier` services; ~55 primary routes + ~40 feature-alias routes; 43 parity feature definitions.

---

## Executive Verdict

The LetBuyy merchant app is the **most genuinely-built surface in the entire repository** — and it is dramatically more real than the prior mobile notes ("can't log in on prod", "~10 domains PlatformBlocked", "plaintext tokens") suggest. Those notes are now **stale**: every one of them has been remediated in the working tree. The app has a coherent Provider architecture, secure token storage, a working in-app Cloudflare Turnstile challenge, a Dio API client with retry/backoff/idempotency, a Hive offline read-cache, sanitized crash reporting, a real visual theme editor, and a 109-test service suite.

It is **not, however, production-ready**, and the blockers are concrete and unglamorous: the **release APK is signed with the debug keystore** (cannot ship to Play), **CI builds debug-only** (no signed release/store pipeline), money-mutation screens **lack double-submit guards** (timestamp-based idempotency keys do not dedupe a fast double-tap), the **mobile-BFF performs zero response aggregation** (so the "BFF kills N+1" claim in V1 is false — the BFF is a pass-through proxy; the app does its own bounded fan-out), a **residual parity catalog** still exposes 6 generic read-only "feature" screens (2 of which render `[SKIP - NEEDS BACKEND]`) from the Settings hub, and there is **no provider-mode honesty badge** on money/fulfillment surfaces as V1 required. `go_router` is a shipped-but-unused dependency. Several screens still hardcode the **deprecated `letbuyy.store` domain**.

None of these are architecturally fatal; they are a punch-list. The foundation is sound.

### Production-readiness score: **3.1 / 5**

| Dimension | Score /5 | One-line basis |
|---|---|---|
| Architecture & structure | 3.6 | Clean feature-first screens + Provider DI; consistent, not mixed; `go_router` dead-shipped |
| State management | 3.5 | Provider + setState used consistently; 412 `mounted` guards; controller-dispose ratio thin |
| Navigation & host sentinels | 3.4 | Named-route table is solid; PlatformBlocked now empty (FIXED); deep-link router not wired to OS intent filters |
| Auth / session / Turnstile | 3.8 | Secure storage + real WebView Turnstile + BFF verify; login WORKS on prod; password-reset-only refresh |
| Offline handling | 3.0 | Real Hive read-cache for lists; **no write queue / optimistic replay** |
| Retry / idempotency / double-submit | 2.6 | Client retry+backoff strong; money screens have **no in-flight guard** (S1) |
| API integration & N+1 | 3.0 | Dio client mature; **BFF does no aggregation** so V1's N+1 claim is false; bounded fan-out is OK |
| Parity-catalog honesty (TD-5) | 2.8 | 36/42 feature routes now real; **6 generic read-only orphans remain** reachable from Settings |
| Provider-mode honesty badge | 1.5 | Absent — only a raw `provider_mode ?? 'sandbox'` text echo on one payout row |
| Theme editor | 4.0 | Genuinely substantial (1,200-line section editor + live WebView preview + sheets) |
| Build / release | 1.8 | **Debug-signed release** + **debug-only CI**; no store pipeline; no flavors |
| Production risk (crash/secrets/perms) | 3.3 | No hardcoded secrets; sanitized crash logs; 127 force-unwraps; minimal perms |

---

## Reserved-empty verification (shopper-app / operator-app)

Confirmed empty per V1 policy — only manifest + AGENTS.md, no `lib/`, no `pubspec.yaml`:

```
apps/mobile/shopper-app/runtime.manifest.json
apps/mobile/shopper-app/AGENTS.md
apps/mobile/operator-app/runtime.manifest.json
apps/mobile/operator-app/AGENTS.md
```

Both manifests declare `"status": "reserved-not-implemented"`, `"sourceState": "manifest-and-agents-only"`. The operator manifest explicitly states "The generated Flutter counter starter was archived." No code, no risk. (Note: the root `pubspec.yaml` melos `run:super_admin` script still references `apps/mobile/operator-app`, which has no Flutter project — a dead script, harmless.)

---

## 1. Architecture & State-Management Analysis

**Structure — feature-first screens, layered services.** `lib/` is organized by feature folder under `screens/` (auth, dashboard, orders, products, money, kyc, customize, editor, inventory, marketing, settings, parity, …), with a flat `services/` layer (39 service files) and a `widgets/` library. App wiring lives in `lib/app/`. This is a clean, conventional Flutter layout.

**State management — Provider, used consistently (not mixed).** Single paradigm:
- 32 services `extends ChangeNotifier`, all registered in one `MultiProvider` in `lib/main.dart:156-272`.
- Local screen state via `setState` (587 occurrences), service access via `context.read` (261) and reactive reads via `context.watch`/`Consumer`/`Selector` (19).
- No Riverpod / Bloc / GetX anywhere.

The single shared transport is constructed once and injected:

```dart
// lib/main.dart:62
final apiClient = ApiClient(
  baseUrl: AppConfig.apiBaseUrl,
  tokenProvider: () => authService.accessToken,
  storeIdProvider: () => storeContext.selectedStoreId,
  unauthorizedHandler: (exception) => authService.handleUnauthorized(exception),
  attachSessionCookie: true,
  headers: const {'X-Client': 'flutter-builder'},
  requestIdFactory: () => 'flutter-builder-${DateTime.now().microsecondsSinceEpoch}',
);
```

**Dependency injection** is constructor-injection through Provider — every data service takes `api: apiClient` (and some `cache: cacheService`). There is **no god-object**: state is split across single-responsibility `ChangeNotifier`s. `StoreContext` (`lib/app/store_context.dart`) holds the selected-store cross-cutting state, and `StoreAuthService` holds session — these are the two legitimately-global notifiers, both scoped and disposed.

**Crash hooks installed at boot** (`lib/main.dart:50-52, 292-311`): the whole app runs inside `runZonedGuarded`, and both `FlutterError.onError` and `PlatformDispatcher.instance.onError` are chained into `CrashReportingService`. This is correct, mature error-boundary setup.

**Disposal hygiene — mostly good, thin in spots.** 412 `if (mounted)` / `if (!mounted)` guards across `lib/` — strong discipline against `setState`-after-dispose; the async-then-`setState` paths I read (`auth_wrapper.dart`, `home_screen.dart`, `login_screen.dart`, `theme_screen.dart`) all guard. **However**, there are ~274 controller declarations (`TextEditingController`/`AnimationController`/`ScrollController`/`StreamController`) against only 44 `dispose()` overrides. Many screens hold ≥1 controller; the ratio implies some controllers are not disposed (a slow leak, not a crash). `StoreAuthService.dispose()` correctly closes its `StreamController` and `http.Client` (`store_auth_service.dart:529-534`). **[MOB-014, S3]**

---

## 2. State-Management Deep-Dive

- **No rebuild storms.** The low `watch`/`Consumer` count (19) vs high `read` (261) means most screens fetch-on-`initState` and drive UI with local `setState`, rather than rebuilding the whole tree on every notifier tick. Trade-off: background service updates don't always reactively refresh a visible screen, but this avoids storms.
- **Proper disposal** on the critical notifiers (auth stream, http client). Screen-level controller disposal is inconsistent (above).
- **No setState-after-dispose** found on the read paths — guarded by `mounted`.
- **Global vs scoped:** only `StoreAuthService` + `StoreContext` are legitimately global; everything else is feature-scoped. The dashboard reads four services in one method but stores results in local state, not a shared blob.

---

## 3. Navigation & Host-Sentinel Analysis

**Routing = named routes via `onGenerateRoute`, NOT go_router.** `lib/app/app.dart:54-56`:

```dart
home: const AuthWrapper(),
onGenerateRoute: AppRoutes.generateRoute,
```

`AppRoutes` (`lib/app/routes.dart`) defines two static spec tables — `_primaryRouteSpecs` (~55 real screens) and `_featureRouteSpecs` (~40 `/features/*` aliases) — merged into `allRoutes`, indexed `byPath`/`byId`. `generateRoute` (lines 768-783) resolves a spec, else falls back to `MerchantFeatureDefinitions.byRoute`, else a "Route not found" Scaffold. The root `/` uses a zero-duration "fast" page for the `AuthWrapper`. This is a clean, testable router.

**`go_router` is a dead dependency.** It is declared (`pubspec.yaml: go_router: ^17.0.0`) and a `GoRouter` is defined in `lib/app/deep_link_router.dart:23`, but `AppDeepLinkRouter.router` / `MaterialApp.router` / `routerConfig` are **referenced nowhere** outside that file (grep returned zero hits). The app never uses go_router for navigation. **[MOB-015, S3]**

**Deep links are defined but not wired to the OS.** `AppDeepLinkRouter.resolve(Uri)` (`deep_link_router.dart:53-78`) maps `/orders/:id`, `/payment-return`, `/share/:storeId` to named routes — but **`AndroidManifest.xml` has no deep-link `<intent-filter>`** (only the LAUNCHER filter) and **iOS `Info.plist` registers only the Google reversed-client-ID URL scheme**, no custom app/universal-link scheme. So push/share deep links cannot actually be delivered by the platform to this resolver. **[MOB-016, S2]**

**Host sentinels / "~10 domains PlatformBlocked" — FIXED (now zero).** The prior "PlatformBlocked" gate is now an **empty list**:

```dart
// lib/services/platform_blocked_service.dart:26
static const features = <PlatformBlockedFeature>[];
```
```dart
// lib/screens/parity/merchant_feature_definitions.dart:79
static const platformBlocked = <MerchantFeatureDefinition>[];
```

`PlatformBlockedService` still exists, is still registered (`main.dart:254`), and `featureForRoute`/`requireBackend` still throw `SkipNeedsBackendException` — but with an empty feature set, **nothing is blocked**. The Settings hub still renders a `platformBlocked` section (`settings_screen.dart:236`), which collapses to `SizedBox.shrink()` because the list is empty (`settings_screen.dart:399-401`). So the historical "~10 domains blocked" behavior is **gone**; the scaffolding is dormant. (This is host-*feature* gating, not network-host blocking — there is no allow/deny list of network hosts anywhere in the app.)

**Auth-gated routing.** The root `AuthWrapper` (`lib/app/auth_wrapper.dart`) is a 5-state machine (`loading → login | wizard | main | error`) driven by `StoreAuthService.authStateChanges`. On `signedOut`/`sessionExpired` it clears `StoreContext` and routes to `LoginScreen` with a notice; on `signedIn`/`tokenRefreshed`/`initialSession` it calls `ensureSelectedStore()` and routes to `main` or the create-store `wizard`. Back-stack: post-auth navigation uses `pushReplacementNamed` (`login_screen.dart:227,229,233`) so the login screen is correctly removed from the stack.

**RBAC is role-coarse and presentation-only.** `lib/app/role_gate.dart` defines `StaffRoleGate` with `canManageStaff/Catalog/Orders` and `canReadAnalytics` over 7 roles — but this is pure client-side label/visibility logic; real enforcement must be server-side (consistent with the internal-OS memory note that RBAC is role-coarse).

---

## 4. Sessions & Auth (definitive verdicts)

### 4a. Token storage — **SECURE (prior "plaintext tokens" hypothesis is FALSE / FIXED)**

`StoreAuthService` persists the session **only** to `FlutterSecureStorage` (Keychain / EncryptedSharedPreferences):

```dart
// lib/services/store_auth_service.dart:106
_secureStorage = secureStorage ?? const FlutterSecureStorage();
...
// :477-491 _persistSession
await _secureStorage.write(key: _sessionTokenKey, value: session.token);      // 'lb_session'
await _secureStorage.write(key: _sessionUserKey, value: ...);                 // 'lb_session_user'
await _secureStorage.write(key: _sessionExpiresAtKey, value: ...);            // 'lb_session_expires_at'
```

`SharedPreferences` (plaintext) is used **only** for non-secret UX state — the saved login email (`login_screen.dart:122,158,177`) and the telemetry outbox. **No token, password, or secret is written to SharedPreferences.** This confirms Phase 6's finding and supersedes the old plaintext-token claim. **Verdict: token storage is correct.** (Minor: the secure-storage write isn't pinned to `IOSAccessibility.first_unlock`/no-iCloud-backup options — default accessibility is used. **[MOB-017, S3]**)

### 4b. Login on production — **WORKS (contradiction RESOLVED)**

The "can't log in on prod (Turnstile)" note was true for the **old static-token** design and is now **superseded** by a real in-app challenge. The flow:

1. `config/app_config.dart:36` ships `turnstileToken` defaulting to the placeholder `'SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN'`, and `production.json` keeps that placeholder. `hasTurnstileToken` returns **false** for any `SKIP_NEEDS_HUMAN_` value (`app_config.dart:87-99`).
2. So `login_screen.dart:214-218` `_resolveTurnstileToken()` **does not** use the static token; it falls through to a live challenge:
   ```dart
   Future<String?> _resolveTurnstileToken() async {
     if (AppConfig.hasTurnstileToken) return AppConfig.turnstileToken.trim(); // false in prod
     return Navigator.pushNamed<String>(context, AppRoutes.turnstileChallenge);
   }
   ```
3. `TurnstileChallengeScreen` (`screens/auth/turnstile_challenge_screen.dart`) renders a **real Cloudflare Turnstile widget in a WebView** using the **real, configured site key** (`AppConfig.turnstileSiteKey` = `0x4AAAAAADhK0-QvgZvxNyZE` in `production.json` — a genuine Cloudflare key, not a `1x000…` test key), and posts the live token back via `TurnstileToken.postMessage(token)` (lines 47-65, 218-236).
4. `StoreAuthService.signInWithPassword` (`store_auth_service.dart:165-202`) sends `{email, password, turnstileToken}` to `IDENTITY_BASE_URL` (`accounts.letbuyy.com`) `/api/auth/login`, after `_requireTurnstileToken` (lines 369-381) **rejects** any `SKIP_NEEDS_HUMAN_` token and **verifies the live token against the BFF** (`_verifyTurnstileWithBff`, lines 383-394 → `POST {bff}/auth/mobile/turnstile/verify`).
5. The BFF verifies server-side against Cloudflare siteverify with its `TURNSTILE_SECRET_KEY` (`services/mobile-bff/src/index.ts:111-150, 278-301`).

**Definitive verdict:** Password login **works on a prod build** end-to-end, *conditional on the BFF having a real `TURNSTILE_SECRET_KEY` and `INTERNAL_API_SECRET` configured server-side* (the BFF reports `degraded` and returns 500/503 on auth otherwise — `index.ts:78-92, 213-222`). The mobile app itself is not the blocker. The static `TURNSTILE_TOKEN` placeholder in `production.json` is intentional and correct — the runtime challenge supplies the real token. **The "login blocked on prod" condition is FIXED in code.** (Server secret provisioning is **UNVERIFIED** here — it lives in Cloudflare Worker secrets, not the repo.)

### 4c. Session lifecycle, refresh, expiry, logout

- **Restore on boot:** `restoreSession()` (`store_auth_service.dart:133-163`) reads the secure token, optimistically restores the cached user if not expired, then **re-validates against `/api/auth/session`**; on failure it clears and emits `sessionExpired`. Solid.
- **"Refresh" is re-validation, not token rotation.** `refreshSession()` (lines 339-362) and `handleUnauthorized` (lines 364-367, wired as the ApiClient 401 handler) simply re-hit `/api/auth/session` with the existing cookie. There is **no refresh-token grant** — sessions are server-cookie-lived; when the cookie expires, the user must re-login. Acceptable for a cookie-session model but means no silent long-lived refresh. **[MOB-018, S3]**
- **Expiry UX** is handled: `AuthWrapper` shows "Your session expired. Please sign in again." (`auth_wrapper.dart:70-72`).
- **Logout** best-effort calls `/api/auth/logout` then always clears secure storage (`store_auth_service.dart:321-337`).
- **No biometric / PIN lock.** There is no `local_auth` dependency and no app-lock screen. A device-unlocked attacker with the phone has full merchant access (incl. money screens). For a payouts-capable app this is a gap. **[MOB-013, S2]**
- **Google Sign-In is configured natively but has no Dart implementation.** `ios/Runner/Info.plist` sets `GIDClientID` + a reversed-client-ID URL scheme (`468123057306-…apps.googleusercontent.com`), but `google_sign_in` is **not** in `pubspec.yaml` and `StoreAuthService` only does email/password. Dead native config (the client ID is a public identifier, low risk). **[MOB-019, S3]**

---

## 5. Offline Handling

**Real read-cache, no write queue.** `lib/services/cache_service.dart` is a Hive-backed (`hive_flutter`) read-through cache, box `letbuyy_mobile_cache_v1`, with structured keys for stores/products/orders/customers (incl. pagination cursor in the key). It degrades to an in-memory map when Hive is unavailable (`CacheService.memory()`). Used by `store_service`, `product_service`, `order_service`, `customer_service` (and several screens). So **cached lists remain viewable offline**.

**Gaps:**
- **No offline mutation queue / optimistic-update replay.** Only reads are cached; create/update/delete and all money actions go straight to the network and fail if offline. There is no outbox for writes (unlike the *crash* outbox, which exists). **[MOB-020, S3]**
- **No-network behavior is graceful, not crashing.** The ApiClient converts `DioException` (timeouts, connection errors) into a typed `ApiException` (`packages/dart/api_client/lib/src/api_client.dart:366-374`), and screens catch it (e.g. `money_screen.dart:55-56` "Money details are temporarily unavailable.", `home_screen.dart:97-103` `debugPrint`). So offline → friendly error/empty state, **not** a hang or crash. **UNVERIFIED (runtime)** that every screen renders a usable offline state, but the plumbing is correct.
- Local DB: **Hive** only (no sqflite/isar). Appropriate for a cache.

---

## 6. Retry / Idempotency / Double-Submit

**Client-side retry & backoff — strong (shared Dio client).** `packages/dart/api_client/lib/src/api_client.dart`:
- `connectTimeout`/`receiveTimeout` = 30s each (lines 23-24, 52-53); `validateStatus = (_) => true` so non-2xx is handled in code, not thrown by Dio.
- Retry loop (lines 304-382): up to `maxRetries` (default 2) on retryable status codes and retryable `DioException`s, with `_retryDelay(attempt)` backoff; plus a **single** 401-triggered re-auth retry via `_shouldRetryAfterUnauthorized` (lines 388-398) → `unauthorizedHandler`.
- **Automatic idempotency:** `_withAutomaticIdempotency(path, options)` (line 305) injects idempotency keys; `PaymentsApi.create` forwards `idempotency_key` explicitly (lines 1678-1688). Retries of mutating calls are therefore idempotency-protected **at the transport layer**.

**Money-action idempotency keys exist but are timestamp-unique (do not dedupe double-tap).** `lib/services/money_service.dart` generates a key for every money mutation — payout create (`:58`), settle (`:71`), commission reconcile (`:100`), COD collect (`:132`), COD reconcile (`:150`) — but each uses:
```dart
'idempotency_key': 'mobile-payout-$storeId-${DateTime.now().microsecondsSinceEpoch}',
```
Two taps milliseconds apart produce **two different keys** → the server sees two distinct idempotent requests → **double-submit is not deduped by the key**. The key only protects *retries of the same call*, not *a second user tap*.

**Money screens have NO in-flight / button-disable guard.** `lib/screens/money/money_screen.dart` `_createPayout()` (`:62-77`) and `_settlePayout()` (`:79-94`) set no `_isSubmitting` flag and disable no button; the buttons call them directly (`:189`, `onSettle: _settlePayout`). A fast double-tap can fire two payout-create or settle calls. Contrast the **good** examples: `home_screen._togglePublish` guards with `_isPublishing` (`home_screen.dart:121`) and `login_screen._handleSubmit` guards with `_isLoading` (`login_screen.dart:138`). The money surface — the most financially sensitive — is the one without the guard. **This is the most important mobile-side correctness defect. [MOB-002, S1]**

---

## 7. API Integration & N+1 (BFF-stub impact)

**HTTP clients (two, deliberately):**
- **Data plane → Dio**, via the shared `letbuyy_api_client` package (the app's `lib/services/api_client.dart` is a one-line re-export: `export 'package:letbuyy_api_client/...';`). This client carries the retry/idempotency/auth-header interceptor.
- **Auth plane → `package:http`**, directly inside `StoreAuthService` (cookie/CSRF handling against the identity platform).

**Target: the app hits the BFF, which proxies to the gateway.** `AppConfig.apiBaseUrl` defaults to `https://bff.letbuyy.com/v1` and `production.json` sets both `BFF_BASE_URL` and `API_BASE_URL` to the BFF. The app does **not** hit `api-gateway` directly for data.

**Correcting Phase 1 + V1 on the BFF.** Phase 1 characterized the mobile-BFF as a "305-line stub — only health + Turnstile verify." That undercounts it: `services/mobile-bff/src/index.ts` is 305 lines but includes a **catch-all reverse proxy**:
```ts
// services/mobile-bff/src/index.ts:302-303
app.all('/v1/*', (c) => proxyToGateway(c.req.raw, c.env));
app.all('*',     (c) => proxyToGateway(c.req.raw, c.env));
```
`proxyToGateway` (lines 237-274) enforces a 47-prefix allow-list, requires a mobile session token for non-auth routes, and **signs internal session headers** via `createLetbuyyInternalSessionHeaders` before forwarding to `API_GATEWAY_SERVICE`. So it is a **real authenticating proxy**, not a pure stub.

**But V1's "mobile-bff composite endpoints kill N+1" is FALSE.** The BFF has **no composite/aggregation endpoints** — it is 1:1 pass-through. There is no `/v1/dashboard` or batch route. Therefore:
- The dashboard does its **own** fan-out, and it is **bounded, not N+1**: `home_screen._loadStore` (`home_screen.dart:50-104`) makes exactly 3 sequential calls — `ensureSelectedStore()` + `analyticsService.getStoreAnalytics()` + `moneyService.fetchPayoutSummary()` — each wrapped in its own try/catch so one failure doesn't sink the screen. It does **not** loop per-item.
- The money tab fans out 4 **parallel** calls (`money_service.refreshMoney`, `:157-164`). Also bounded.

So there is no N+1 explosion, but there is also **no server-side aggregation** — every screen pays per-resource round-trips through the proxy. For a mobile dashboard on a 3G connection this is a latency cost, and the V1 claim of BFF aggregation should be struck. **[MOB-006, S3]**

**Latent allow-list gap.** The app's shared client exposes `StorefrontApi` (`/storefront/*`, package `api_client.dart:1747+`), but **`/storefront` is absent from the BFF `ALLOWED_PREFIXES`** (`index.ts:25-69`) — a call would 404 with `MOBILE_BFF_ROUTE_NOT_ALLOWED`. The merchant app does **not** currently invoke `client.storefront.*` at runtime (only a UI string mentions "storefront"), so this is **latent, not actively breaking**. **[MOB-021, S3]**

**Response parsing / null-safety.** The client centralizes unwrapping (`_unwrapData`, `requestPaginated` meta parsing) and the parity viewer defensively coerces `List`/`Map`/`{data: …}` shapes (`merchant_feature_screen.dart:71-90`). Models use null-aware `fromJson` with fallbacks (e.g. `MerchantSessionUser.fromJson`, `store_auth_service.dart:52-59`). Parsing is defensive.

---

## 8. Parity-Catalog Measurement (TD-5)

**The catalog is present and still partly vestigial, but mostly superseded by real screens.**

Files (V1 asked to remove these):
```
lib/screens/parity/merchant_feature_definitions.dart   621 lines
lib/screens/parity/merchant_feature_screen.dart        353 lines   (total 974)
```

`MerchantFeatureScreen` is a **generic read-only list viewer**: it GETs `feature.endpoint`, extracts rows, and renders title/subtitle cards with a refresh — **no detail view, no create/edit/delete** (`merchant_feature_screen.dart:30-90`, `_FeatureRowCard` `:230-294`). When a feature has no endpoint it shows `[SKIP - NEEDS BACKEND]` (`:214, :328`).

**Exact measurement (computed by diffing route tables):**
- `MerchantFeatureDefinitions` declares **43 feature definitions / 42 unique `/features/*` routes**.
- `_featureRouteSpecs` in `routes.dart` **re-registers 36 of those routes to REAL screens** (e.g. `/features/customers → CustomersScreen()`, `/features/payouts-settlement → MoneyScreen(initialTab:0)`), which **shadow** the generic viewer (spec table wins in `generateRoute`, `routes.dart:768-777`).
- **6 orphan routes still fall through to the generic read-only `MerchantFeatureScreen`:**
  `/features/checkout`, `/features/payments`, `/features/policies`, `/features/real-analytics`, `/features/security`, `/features/theme-marketplace`.
  - Of these, **2 render `[SKIP - NEEDS BACKEND]`** because they have no endpoint: `checkout`, `security`.
  - The other 4 (`payments`, `policies`, `real-analytics`, `theme-marketplace`) render a generic read-only list from an endpoint — viewable but no actions.

**These orphans are user-reachable.** `settings_screen.dart:201-236` renders every feature group (commerce, money, trust, onlineStore, apps, settingsHub, other, platformBlocked) as tappable tiles that `Navigator.pushNamed(context, feature.route)` (`:411`). So a merchant tapping Settings → "Checkout" or "Security" lands on a `[SKIP - NEEDS BACKEND]` placeholder, and tapping "Theme marketplace"/"Policies" lands on a generic read-only list.

**Verdict on TD-5:** **Not fully removed.** ~86% of feature routes (36/42) are now backed by real screens, so the catalog is largely vestigial — but the residual 6 generic screens (especially the 2 `SKIP-NEEDS-BACKEND` ones surfaced in Settings) are exactly the "fake read-only parity screens" V1 wanted gone. They should be either backed by real screens or hidden from the Settings hub. **[MOB-003, S2]** The `merchant_feature_*` files remain ~974 lines of catalog scaffolding that V1 marked for deletion. **[MOB-004, S3]**

---

## 9. Provider-Mode Honesty Badge

**Absent as a component.** V1 required a provider-mode honesty badge on money/fulfillment surfaces. Grepping the app, there is **no badge widget** and no `providerMode` UI affordance on money/fulfillment screens. The only traces:
- `money_screen.dart:256` echoes a raw field in a status subtitle: `'${payout['status'] ?? 'pending'} · ${payout['provider_mode'] ?? 'sandbox'}'` — an implicit, unlabeled text suffix that defaults to "sandbox". Not a badge, easy to miss, and conflates "no data" with "sandbox".
- `ai_studio_service.dart:60-87` parses a `provider_mode` field for AI Studio (a service-layer field, no money-surface badge).

So the honesty-badge requirement is **largely UNMET**: there is no consistent, labeled "Sandbox / Live provider" indicator on payouts, COD, wallet, commission, or fulfillment. A merchant cannot reliably tell from the UI whether money operations are real or sandbox. **[MOB-005, S2]**

---

## 10. Theme Editor (the claimed "strong point") — confirmed real

The theme editor is genuinely the most-built surface, corroborating the prior note:
- `lib/screens/customize/theme_screen.dart` (631) loads a **real** theme catalog (`themeService.fetchThemes`), an **editor payload** (`loadEditor`), and **release history** (`fetchReleases`) from the gateway (`theme_screen.dart:51-90`), with version rollback via `theme_versions_screen.dart` (452).
- `lib/screens/editor/section_editor_screen.dart` (**1,200 lines**) is a full section editor, backed by `widgets/editor/` sheets — `add_section_sheet`, `header_editor_sheet`, `section_settings_sheet`, `compact_settings_sheet`, `layers_drawer`, `editor_toolbar` — plus `device_frames/` for responsive preview.
- `widgets/editor/website_preview.dart` uses a **WebView live preview** (`webview_flutter`), and the shared client exposes the full theme lifecycle (`ThemesApi`: editor/draft/publish/preview-session/releases/rollback, `api_client.dart:1525-1671`).

**Verdict:** Real, substantial, and lifecycle-complete (draft → preview → publish → release/rollback). **Web parity is not 1:1** — the mobile editor is section/setting-oriented with a WebView preview, whereas the web editor is a richer canvas — but the mobile editor is a legitimate, functional product surface, not a stub. Full web-vs-mobile parity is **UNVERIFIED (cross-surface, runtime)**.

---

## 11. Production-Risk Register

**Secrets / hardcoded URLs.** No private secrets in Dart. `config/app_config.dart` correctly takes everything from `--dart-define`, keeps only **publishable** values (Razorpay *key id*, Turnstile *site key*, Sentry DSN) and guards `SKIP_NEEDS_HUMAN_` placeholders. The dart-define files contain only public values + placeholders (the README forbids private keys). Hardcoded URLs found are benign: help/legal links, `checkout.razorpay.com/v1/checkout.js`, an Unsplash placeholder, a CDN example inside a doc comment. **No leaked tokens.**

**Deprecated domain `letbuyy.store`.** ~10+ Dart files still hardcode the old domain (help_screen privacy/terms/docs links, seo_settings, store_details, store_published, products, orders, create_store_wizard, home_screen, …), and `staging.json` still uses `accounts-staging.letbuyy.store` / `staging.letbuyy.store`. Prod config (`app_config.dart`, `production.json`) is correctly on `letbuyy.com`. This ties to the canonical-domain migration and is a correctness/branding inconsistency. **[MOB-008, S3]**

**Crash/log data leakage — low.** 48 `debugPrint`/`print` sites; the ones I read log error objects/diagnostics, not credentials (e.g. `store_auth_service.dart:330` logs that sign-out failed, `:446` that validation failed, without the token body). `avoid_print` is disabled in `analysis_options.yaml`, so prints ship in release. `CrashReportingService` **sanitizes** message (500 chars) and stack (6000) via `sanitizeCrashText`/`sanitizeTelemetryMetadata` (`crash_reporting_service.dart:23-31`) and only attaches `storeId`/`userId` identifiers — responsible. Residual risk is the unconditioned `debugPrint`s. **[MOB-012, S3]**

**Crash surfaces — force-unwraps.** 127 `!.` null-assertions across `lib/`, concentrated in `home_screen.dart` (13), `theme_screen.dart` (12), `cms_service.dart` (9), `section_editor_screen.dart` (9). Each is a `Null check operator used on a null value` crash if its invariant breaks. `analysis_options.yaml` even sets `unnecessary_non_null_assertion: ignore`, suppressing the analyzer's help. Moderate crash surface. **[MOB-011, S3]**

**Transport security.** No TLS certificate pinning anywhere (the 2 "certificate" hits are KYC doc labels) — the app trusts the platform trust store. `validateStatus = (_) => true` on Dio is fine (handled in code). No cleartext: Android has no `usesCleartextTraffic`/`networkSecurityConfig` (defaults to disabled on API 28+), iOS has no `NSAllowsArbitraryLoads`. For a payouts app, **no pinning** is a defensible-but-notable gap. **[MOB-010, S3]**

**Permissions — minimal/appropriate.** Android: only `CAMERA` (barcode scan + image capture), plus a home-screen widget receiver (`MerchantMetricsWidgetProvider`). iOS: only `NSCameraUsageDescription` + `NSPhotoLibraryUsageDescription`, both with honest strings. No location/contacts/mic over-ask. Good.

**Analyzer is heavily muted.** `analysis_options.yaml` downgrades a long list to `ignore` — `dead_code`, `unused_*`, `invalid_null_aware_operator`, `unnecessary_non_null_assertion`, `deprecated_member_use`, and disables `avoid_print`, `use_build_context_synchronously`, `empty_catches`. This hides exactly the classes of bug (null-bang misuse, context-after-await, swallowed exceptions, deprecations) most likely to bite a money app in production. **[MOB-009, S2]**

---

## 12. Build / Release

**Release APK is signed with the DEBUG keystore (cannot ship).** `android/app/build.gradle.kts`:
```kotlin
buildTypes {
    release {
        // TODO: Add your own signing config for the release build.
        signingConfig = signingConfigs.getByName("debug")
    }
}
```
A debug-signed artifact is rejected by Play and is a security/distribution blocker. The merchant-app `AGENTS.md` even flags this file under "Security and Scalability Concerns." **[MOB-001, S1]**

**CI builds DEBUG only — no signed release / store pipeline (confirms Phase 1).** `.github/workflows/ci.yml`:
```
:166 flutter analyze
:170 flutter test
:218 flutter build apk --debug --dart-define-from-file=dart-defines/staging.json
:222 flutter build ios --debug --no-codesign --dart-define-from-file=dart-defines/staging.json
```
No `appbundle`, no signing, no `--release`, no Fastlane/Play/App Store deploy. CI proves it compiles and tests pass; it does not produce a shippable build. **[MOB-007, S1]**

**No flavors.** There is no `productFlavors` (dev/staging/prod) in Gradle; environment is selected purely via `--dart-define-from-file` (`dart-defines/{staging,production}.json`). Workable, but there is no compile-time dev/prod separation (e.g., a debug build could be pointed at prod). **[MOB-022, S3]**

**Config that is OK:** `minSdk = flutter.minSdkVersion` with `flutter_icons.min_sdk_android: 21`; Java/Kotlin 17; `multiDexEnabled`; core-library desugaring; `versionName/Code` from Flutter. `applicationId`/`namespace = com.letbuyy.store`.

**Tests — better than expected.** `test/mobile_services_test.dart` is **8,000 lines / 109 `group`+`test` blocks** using `MockClient` (`package:http/testing`) to exercise real services; plus `merchant_goldens_test.dart` (351), `analytics_model_test.dart`, `product_contract_test.dart`, and `integration_test/merchant_happy_path_test.dart` (464). This is genuine coverage, not placeholder.

**Dependencies — current, low-risk.** `provider 6.1.2`, `go_router 17` (unused), `dio` (via package), `http 1.2.2`, `flutter_secure_storage 9.2.4`, `hive 2.2.3`, `webview_flutter 4.8`, `fl_chart 0.69`, `image_picker/cropper`, `mobile_scanner 7.1.3`, `share_plus 12`. Nothing abandoned or obviously vulnerable. (`hive 2.x` is in maintenance mode — fine for a cache.)

---

## Cross-References

- **Phase 1 (REPO_TOPOLOGY_AUDIT.md):** Correct that CI builds debug-only. **Correction:** the mobile-BFF is a real authenticating reverse proxy (`app.all('/v1/*')`), not merely "health + Turnstile verify."
- **V1 §10/§12:** Mobile-login-blocked is **FIXED** (real WebView Turnstile + BFF verify). The **"mobile-BFF composite endpoints kill N+1" claim is FALSE** — no aggregation exists; the app does bounded client fan-out. The **provider-mode honesty badge is still absent**. The **parity catalog is not fully removed** (6 orphan generic screens remain, 2 of them `SKIP-NEEDS-BACKEND`, reachable from Settings).
- **Phase 6 (AUTH_FORENSIC_AUDIT.md):** Confirms mobile tokens are in `FlutterSecureStorage`. **Supersedes** the old "plaintext tokens" hypothesis (FALSE).
- **Memory (letbuyy-mobile-audit):** "can't log in on prod" and "~10 domains PlatformBlocked" are both now **stale** — login works; PlatformBlocked list is empty. The later "mobile login now UNblocked" note is **confirmed**. "Theme editor is the strong point" is **confirmed**.

---

## Findings Register

Severity: **S0** = ship-stopping data-loss/security · **S1** = must-fix before GA · **S2** = important · **S3** = hygiene/polish. Fix complexity: **S** ≤½ day · **M** ~1–3 days · **L** > 3 days.

| ID | Sev | Area | Title | Root Cause | Evidence (path:line) | Impact | Fix | Recommended Fix |
|---|---|---|---|---|---|---|---|---|
| MOB-001 | S1 | Build/Release | Release APK signed with debug keystore | Placeholder signing config never replaced | `android/app/build.gradle.kts` release block (`signingConfig = signingConfigs.getByName("debug")` + TODO) | Cannot publish to Play; debug-key artifact is insecure/non-distributable | S | Add a real upload keystore + `keystore.properties`; wire `signingConfigs.release`; keep keys out of VCS |
| MOB-002 | S1 | Idempotency/Double-submit | Money screens lack in-flight guard; idempotency keys are timestamp-unique | No `_isSubmitting` flag on payout/settle/COD actions; key uses `microsecondsSinceEpoch` so a 2nd tap = new key | `money_screen.dart:62-94`; `money_service.dart:58,71,100,132,150` | Double-tap can create duplicate payouts / double-settle / double-collect COD | M | Disable button + `_isSubmitting` guard on every money action; derive idempotency key from a stable client-action UUID (not timestamp) per intent |
| MOB-007 | S1 | Build/Release | CI builds debug-only; no signed release/store pipeline | Pipeline stops at `flutter build apk --debug` / `ios --no-codesign` | `.github/workflows/ci.yml:218,222` | No shippable artifact; release path unproven | M | Add a release job: `flutter build appbundle --release` + signing + Fastlane/Play internal track; gate on tag |
| MOB-003 | S2 | Parity/TD-5 | 6 generic read-only "feature" screens still reachable from Settings | `_featureRouteSpecs` shadows 36/42 routes but 6 orphans fall through to generic viewer; 2 are `SKIP-NEEDS-BACKEND` | orphans: `/features/{checkout,payments,policies,real-analytics,security,theme-marketplace}`; `merchant_feature_definitions.dart:79,324,447`; `settings_screen.dart:411`; `merchant_feature_screen.dart:214,328` | Merchant taps Settings→Checkout/Security and sees a placeholder; erodes trust | M | Back each with a real screen or remove the tile/group; remove `SKIP-NEEDS-BACKEND` paths from user-reachable nav |
| MOB-005 | S2 | Provider-mode honesty | No provider-mode honesty badge on money/fulfillment surfaces | Requirement not implemented; only a raw `provider_mode ?? 'sandbox'` text echo | `money_screen.dart:256`; (no badge widget anywhere) | Merchant cannot tell sandbox vs live money operations; "sandbox" default also masks missing data | M | Add a labeled Sandbox/Live badge component driven by the backend provider mode on payouts/COD/wallet/commission/fulfillment |
| MOB-009 | S2 | Static analysis | Analyzer mutes the bug classes most dangerous for a money app | `analysis_options.yaml` sets `ignore` on null-aware/non-null-assertion/dead-code/deprecation and disables `avoid_print`/`use_build_context_synchronously`/`empty_catches` | `analysis_options.yaml` analyzer+linter blocks | Real null-bang, context-after-await, swallowed-exception bugs are invisible in CI | S | Re-enable `use_build_context_synchronously`, `unnecessary_non_null_assertion`, `empty_catches`, `invalid_null_aware_operator`; make them warnings, fix incrementally |
| MOB-013 | S2 | Auth/session | No biometric/PIN app-lock on a payouts-capable app | No `local_auth`/app-lock screen | no `local_auth` in `pubspec.yaml`; no lock screen in `lib/` | Stolen unlocked phone → full merchant + money access | M | Add optional biometric/PIN gate (re-auth on resume) before money/KYC screens |
| MOB-016 | S2 | Navigation/Deep links | Deep-link resolver exists but is not wired to OS intent filters | No Android deep-link `<intent-filter>`; iOS registers only the Google reversed-client-ID scheme | `deep_link_router.dart:53-78`; `AndroidManifest.xml` (LAUNCHER only); `ios/Runner/Info.plist` URL schemes | Push/share deep links can't be delivered; feature is inert | M | Add Android App Links + iOS Universal Links / custom scheme and route them into `AppDeepLinkRouter.resolve` |
| MOB-004 | S3 | Parity/TD-5 | Residual parity catalog (~974 lines) not removed per V1 | `merchant_feature_screen.dart` + `merchant_feature_definitions.dart` retained | `screens/parity/merchant_feature_screen.dart` (353), `…_definitions.dart` (621) | Dead/semi-dead scaffolding; maintenance + confusion | M | Delete after MOB-003; replace the Settings hub's group rendering with explicit tiles to real routes |
| MOB-006 | S3 | API/N+1 | BFF does no aggregation; V1 "composite endpoints kill N+1" is false | mobile-BFF is 1:1 pass-through; app fans out per-resource | `services/mobile-bff/src/index.ts:25-69,302-303`; `home_screen.dart:50-104` | Extra round-trips/latency on mobile; no real N+1 explosion | L | Add composite BFF endpoints (e.g. `/v1/mobile/dashboard`) or document the per-resource model and correct V1 |
| MOB-008 | S3 | Config/Domain | Deprecated `letbuyy.store` domain hardcoded in ~10+ files + staging | Canonical-domain migration incomplete on mobile | `help_screen.dart:47,61,68`; `staging.json`; +`seo/store_details/store_published/products/orders/create_store_wizard/home_screen` | Wrong/branding-inconsistent links; staging on old domain | S | Move all URLs to `AppConfig.*BaseUrl`; migrate staging to `letbuyy.com` |
| MOB-010 | S3 | Transport security | No TLS certificate pinning | App trusts platform store only | no pinning in `lib/`/`packages/dart`; Dio default | MITM risk on hostile networks for money flows | M | Add cert/public-key pinning (Dio `badCertificateCallback` or native config) for identity + BFF hosts |
| MOB-011 | S3 | Crash surface | 127 force-unwraps (`!.`), analyzer suppressed | Null-bang used freely; `unnecessary_non_null_assertion: ignore` | `home_screen.dart`(13), `theme_screen.dart`(12), `cms_service.dart`(9), `section_editor_screen.dart`(9) | Null-check-operator crashes when invariants break | M | Replace `!` with null-aware/guards in hot screens; re-enable the lint |
| MOB-012 | S3 | Logging | `debugPrint`/`print` ship in release (`avoid_print:false`) | Lint disabled; 48 print sites | `analysis_options.yaml`; e.g. `store_auth_service.dart:330,446`, `home_screen.dart:69,98` | Diagnostic noise in release logs (no creds observed, but PII risk if extended) | S | Re-enable `avoid_print`; route through a leveled logger stripped in release |
| MOB-014 | S3 | State/Disposal | Controller-dispose ratio thin (~274 controllers / 44 dispose overrides) | Not every Stateful screen disposes its controllers | repo-wide grep; `dispose()` count = 44 | Slow memory leaks on long sessions | M | Audit Stateful screens; dispose all controllers; add a lint/test |
| MOB-015 | S3 | Dependencies | `go_router` shipped but unused | App uses `onGenerateRoute`; `GoRouter` referenced only in its own file | `app.dart:54-56`; `deep_link_router.dart:23` (no external refs) | Dead dependency + dead code | S | Remove `go_router` or adopt it consistently; delete unused `GoRouter` |
| MOB-017 | S3 | Auth/storage | Secure storage uses default accessibility options | `FlutterSecureStorage()` with no iOS accessibility / no-backup options | `store_auth_service.dart:106` | Token may be backed up / available pre-first-unlock on iOS | S | Set `IOSOptions(accessibility: first_unlock_this_device)` + Android `EncryptedSharedPreferences` options |
| MOB-018 | S3 | Auth/session | No refresh-token rotation (re-validation only) | Cookie-session model; "refresh" = re-hit `/api/auth/session` | `store_auth_service.dart:339-362` | Session ends at cookie expiry; no silent long-lived refresh | M | If desired UX, add a refresh-token grant; else document cookie-session lifetime |
| MOB-019 | S3 | Auth/config | Google Sign-In configured natively, no Dart implementation | `GIDClientID`/URL scheme present; `google_sign_in` not a dep | `ios/Runner/Info.plist` (`GIDClientID`, URL schemes); `pubspec.yaml` (no google_sign_in) | Dead native config; partial-feature confusion | S | Implement Google sign-in or remove the native config |
| MOB-020 | S3 | Offline | No offline write queue / optimistic-mutation replay | Only reads are cached (Hive); writes go straight to network | `cache_service.dart` (read-only API); no outbox for mutations | Offline edits/actions fail with no retry-on-reconnect | L | Add a durable mutation outbox with replay-on-connectivity for safe (idempotent) writes |
| MOB-021 | S3 | API/BFF | `/storefront` not in BFF allow-list (latent) | `StorefrontApi` exists in shared client; prefix missing from BFF | `api_client.dart:1747+`; `services/mobile-bff/src/index.ts:25-69` | Any future storefront call 404s via BFF (`MOBILE_BFF_ROUTE_NOT_ALLOWED`) | S | Add `/v1/storefront` to `ALLOWED_PREFIXES` (or confirm intentionally excluded) |
| MOB-022 | S3 | Build/Release | No Gradle flavors (dev/staging/prod) | Env selected only via `--dart-define-from-file` | `android/app/build.gradle.kts` (no `productFlavors`) | A debug build can be pointed at prod; no compile-time separation | M | Add `dev/staging/prod` flavors mapping to the dart-define files + distinct appIds |

**Findings by severity:** **S0:** 0 · **S1:** 3 (MOB-001, MOB-002, MOB-007) · **S2:** 5 (MOB-003, MOB-005, MOB-009, MOB-013, MOB-016) · **S3:** 14. **Total: 22.**

---

## Bottom line

This is a real, coherent, well-tested Flutter app — the strongest single deliverable in the repo. Login works on prod, tokens are stored securely, the API client is mature, the theme editor is genuinely good, and the old "blocked" notes are obsolete. The path to GA is a focused punch-list: **fix release signing and the release CI pipeline (S1)**, **add double-submit guards + stable idempotency keys on money screens (S1)**, **clean up the residual parity orphans and add the provider-mode honesty badge (S2)**, **un-mute the dangerous lints and add a biometric lock + deep-link wiring (S2)**, then sweep the S3 hygiene. No S0s. With the three S1s closed, this app is a credible production candidate.
