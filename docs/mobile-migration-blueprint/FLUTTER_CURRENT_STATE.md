# FLUTTER CURRENT STATE — Merchant App

**Scope:** `apps/mobile/merchant-app` (113 `.dart` files in `lib/`, ~35,190 LOC) + shared Dart packages `packages/dart/{api_client, core, ui_kit, models, services}`.
**Package:** `letbuyy_store` v`1.0.0+1`, SDK `^3.10.0`, `resolution: workspace`.
**Headline:** A **Firebase-free, gateway-wired Flutter app** with a real on-device editor and a handful of genuinely-built domains — wrapped around a **26-route "parity" scaffold** that is mostly generic data-viewers and `[NEEDS BACKEND]` placeholders.

---

## 1. App entry & architecture

### Bootstrapping — `lib/main.dart`
- Synchronous `main()`; **no Firebase init.** Builds one shared Dio `ApiClient` (`baseUrl: AppConfig.apiBaseUrl`, `tokenProvider` → `authService.accessToken`, `attachSessionCookie: true`, header `X-Client: flutter-builder`).
- Builds `StoreAuthService(api, identityBaseUrl)`, `await authService.restoreSession()` before `runApp`.
- **DI = `provider` / `MultiProvider`.** Registered: `ThemeProvider`, `LanguageService`, `Provider<ApiClient>.value`, `StoreAuthService`, and `ChangeNotifier`s for `StoreService`, `ProductService`, `OrderService`, `AnalyticsService`, `ThemeService`, plus `Provider<StorageService>`.
- **Not registered (instantiated ad-hoc in screens):** `SubscriptionService`, `DomainService`, `PreviewService` (e.g. `pricing_screen.dart:56`).

### Routing
- **Navigator 1.0, named routes via `onGenerateRoute`** (`lib/app/routes.dart`). **No `go_router`/Navigator 2.0.**
- `lib/app/app.dart` → single `MaterialApp`, `theme: StoreTheme.light()`, `darkTheme: StoreTheme.dark()`, **`home: AuthWrapper()`** (uses `home`, not `initialRoute`).
- **Dynamic parity routes:** `routes.dart` looks up `MerchantFeatureDefinitions.byRoute[settings.name]`; any `/features/*` resolves to a generic `MerchantFeatureScreen`.

### `AuthWrapper` (`lib/app/auth_wrapper.dart`) — the real entry gate
State machine `{loading, login, wizard, main, error}`. If signed in → `StoreService.getFirstStore()`; store exists → `main` (5-tab shell), else → `wizard`. Subscribes to a custom `authService.authStateChanges` stream.

### Route table (named routes → screen)
`/` → AuthWrapper · `/splash` → SplashScreen · `/login` → LoginScreen · `/error` → ErrorScreen · `/create-store` (+`/onboarding` alias) → CreateStoreWizard · `/store-published` → StorePublishedScreen · `/main` → StoreMainScreen · `/upgrade` → UpgradeScreen · `/live-preview` → LivePreviewScreen · `/domain-settings` · `/seo-settings` · `/store-details` · `/help` · `/analytics` · `/orders` · `/pricing` · `/connect-razorpay` · `/features/*` (26 dynamic) → MerchantFeatureScreen. *(A `setPassword` constant is declared but unhandled.)*

### 5-tab shell — `lib/screens/main/store_main_screen.dart`
`IndexedStack` with animated bottom nav: **Home · Editor · Theme · Products · Settings** (`HomeScreen`, `SectionEditorScreen`, `ThemeScreen`, `ProductsScreen`, `SettingsScreen`). Static `_instance` enables cross-widget tab jumps.

---

## 2. Screens (`lib/screens/**`)

> Nearly every screen resolves the active store via `context.read<StoreService>().getFirstStore()` — a pervasive **single-store assumption**.

| Folder | File(s) | Purpose | Backend calls |
|---|---|---|---|
| analytics | `analytics_screen.dart` (381) | Performance dashboard | `AnalyticsService.getStoreAnalytics()` → **computes client-side** from `GET /orders?limit=100` + `GET /products?limit=1` |
| auth | `login_screen.dart` (827), `error_screen.dart` | Combined sign-in/up (glassmorphism); error/no-KYC screen | `StoreAuthService.signInWithPassword/signUp`; "Continue with Google" string but **no OAuth wired** |
| customize | `theme_screen.dart` (599) | Theme catalog/management tab | `ThemeService.fetchThemes/installTheme/loadEditor/fetchReleases/publish/discardDraft/createPreviewSession` |
| dashboard | `home_screen.dart` (739) | "Bento grid" home | `AnalyticsService`, `StoreService.publishStore`, auth info |
| editor | `section_editor_screen.dart` (976) | **On-device section/theme editor** (most complex screen) | `ThemeService.loadEditor` (default slug `minimal_modern`), `saveDraft` (`PUT /themes/{slug}/editor/draft`), `createPreviewSession`; 50-step undo/redo, device modes, zoom |
| main | `store_main_screen.dart` (206) | 5-tab shell | — |
| onboarding | *(empty)* | — | — |
| orders | `orders_screen.dart` (1,456) | Order management (status tabs/filters) | `OrderService.fetchOrders` (`GET /orders`), `updateOrderStatus` (`PATCH /orders/{id}`), `fulfillOrder` (`POST /orders/{id}/fulfill`) |
| parity | `merchant_feature_definitions.dart`, `merchant_feature_screen.dart` (755) | **26-feature stub registry** + generic data-viewer | raw `ApiClient.get(endpoint, {store_id, limit:20})` |
| premium | `upgrade_screen.dart` (337) | Upgrade marketing | none (TODO Razorpay at :324) |
| preview | `live_preview_screen.dart` (180) | `webview_flutter` of live storefront | — |
| products | `products_screen.dart`, `product_form_screen.dart`, `import_products_screen.dart` (2,392) | List/filter/bulk; create/edit; import from catalog | `ProductService.fetchProducts/createProduct/updateProduct`; `StoreService.updateSelectedProducts` |
| profile | *(empty)* | — | — |
| settings | `settings_screen.dart`, `domain_settings_screen.dart`, `seo_settings_screen.dart`, `store_details_screen.dart`, `help_screen.dart` (1,716) | Settings tab + sub-screens | `StoreService.update*`, `updatePaymentSettings`, `signOut`; domain via `DomainService` |
| splash | `splash_screen.dart` (211) | Animated splash (reachable only via `/splash`; not cold-boot) | — |
| subscription | `pricing_screen.dart`, `connect_razorpay_screen.dart` (1,230) | Plans; bring-your-own-Razorpay | `SubscriptionService.createSubscription` (`POST /payments/subscription/order`), `getPaymentConfig/connectOwnRazorpay` |
| wizard | `create_store_wizard.dart` (1,800+), `store_published_screen.dart` (2,416 total) | Multi-step store creation; "going live" animation | `StoreService.isSubdomainAvailable/createStore/publishStore`; polls `fetchStore` |

### The "parity" scaffold (`lib/screens/parity/`)
`merchant_feature_definitions.dart` registers **26** `MerchantFeatureDefinition`s grouped Commerce / Online Store / Apps / Settings / Other, each with a `/features/<id>` route, optional `endpoint`, and a `backendRequirement` note. Items: customers, collections, inventory, coupons, gift-cards, reviews, order-detail, theme-marketplace, pages, blog, navigation, media, app-marketplace, checkout, shipping, taxes, notifications, users, policies, payments, billing, business, localization, security, form-submissions, real-analytics. `merchant_feature_screen.dart` is a **generic viewer**: resolves store, does `apiClient.get(feature.endpoint)`, renders rows. Some (gift-cards, checkout, business, localization, security) have **no endpoint** = pure placeholders. **This is parity scaffolding, not finished UX.**

---

## 3. State management

**`provider` ^6.1.2 — the only state library** (`pubspec.yaml:27`). No riverpod/bloc/getx/mobx. Pattern: `ChangeNotifier` services via `MultiProvider`, consumed with `context.read` (actions) / `context.watch` (reactive). `ChangeNotifier` services: `StoreAuthService`, `StoreService`, `ProductService`, `OrderService`, `AnalyticsService`, `ThemeService`, `ThemeProvider`, `LanguageService`.

---

## 4. Services (`lib/services/**`, 13 files)

> Split HTTP layer: app-data services use the shared Dio `ApiClient` (gateway); **`StoreAuthService` uses its own raw `http` client** against the identity host (cookie/CSRF).

| Service | LOC | Responsibility / endpoints |
|---|---|---|
| `api_client.dart` | 1 | Re-export of `letbuyy_api_client` |
| `store_auth_service.dart` | 430 | **Identity/session (the critical migration concern).** Own `http.Client` + `FlutterSecureStorage`, base `accounts.letbuyy.store`. `_fetchCsrfCookie()` → `/login`; login `POST /api/auth/login` with **hardcoded `turnstileToken:'dev-bypass-token'`**, extracts `lb_session` from `Set-Cookie`; validate `GET /api/auth/session`; signup `/signup`→`/verify-otp`(uses `devOtp`)→`/set-password`; reset `/send-reset`; `signOut` `/logout`. `updatePassword` throws. Custom `AuthState` stream + `AuthChangeEvent` (Supabase-look-alike). |
| `store_service.dart` | 199 | `_api.stores.*`: list/get/create/update/publish/remove, `getFirstStore`, `isSubdomainAvailable`, `uploadImage`, header/selected-products/payment helpers |
| `product_service.dart` | 200 | `_api.products.*` CRUD/bulk + `uploadProductImage`; holds legacy camelCase `Map` projection |
| `order_service.dart` | 129 | `_api.orders.*` list/get/update + fulfill + refund; client-side `statusCounts`; "replaces legacy real-time streams with polling" |
| `analytics_service.dart` | 208 | **No analytics endpoint** — computes revenue/AOV/status/top-5 from `/orders`+`/products`; models `StoreAnalytics/DailyStats/TopProduct` |
| `theme_service.dart` | 200 | Theme editor flow mirroring web: `fetchThemes/installTheme/loadEditor/saveDraft/duplicateDraft/discardDraft/fetchReleases/createPreviewSession/rollbackRelease/publish`; builds storefront preview URL with `theme_preview_token` + `settings_data_b64` |
| `theme_provider.dart` | 99 | Light/Dark/System; persists `app_theme_mode`; **default dark** |
| `subscription_service.dart` | 366 | Razorpay billing: `createSubscription(Order)` (`POST /payments/subscription/order`), `verify`, `cancel`, `getSubscription`, `connectOwnRazorpay`, `getPaymentConfig`; ₹99/₹399/₹799 plan metadata |
| `domain_service.dart` | 266 | `getDomainConfig` (`GET /stores/{id}/domain`), `isSubdomainAvailable` (`/domains/check`), `updateSubdomain`, `setupCustomDomain`, `verifyDomain`, `removeCustomDomain`; models `DomainConfig/DnsRecord/DomainStatus` |
| `preview_service.dart` | 218 | URL/QR/iframe/share helper (no gateway HTTP) |
| `storage_service.dart` | 43 | "Replaces Firebase Storage" → `_api.uploadFile(file, folder)`; delete via `DELETE upload/{key}` |
| `language_service.dart` | 600 | i18n EN/Tamil/Hindi; inline `_translations` map (no `.arb`) |

**Auth-handling summary:** two parallel surfaces — (a) Dio `ApiClient` attaches `Authorization: Bearer <token>` + `X-LetBuyy-Session-Token` + `Cookie: lb_session=<token>`; (b) `StoreAuthService` does cookie/CSRF against identity host. The Bearer token **is** the `lb_session` value. Hardcoded Turnstile bypass + dev-OTP are **not production-safe**.

---

## 5. Data models

`lib/models/` (5 files) are **pure re-exports** of `letbuyy_models`: order, store, store-auth-request, store-theme, theme-editor models. Additional models are defined **inside service files** (`StoreAnalytics`, `DomainConfig`, `PreviewConfig`, `MerchantSession`). The classes actually deserialized are the shared `*Contract` types (see §6).

---

## 6. Shared Dart packages (`packages/dart/*`)

- **`api_client` (`letbuyy_api_client`)** — Dio ^5.7.0 only. `ApiClient` (1,393 LOC): `validateStatus:(_)=>true`, 30s timeouts, exponential-backoff retry, `/v1` normalization. `_AuthHeaderInterceptor` injects `Authorization: Bearer`, and (when `attachSessionCookie`) `X-LetBuyy-Session-Token` + `Cookie: lb_session`, plus `X-Store-ID`, `X-Idempotency-Key`, `X-Request-ID`. Typed sub-APIs: `stores`(+paymentConfig), `auth`, `products`, `orders`, `customers`(+addresses), `themes`, `payments`(+subscription), `storefront`, `analytics`, `categories`, `inventory`, `pages`, `coupons`, `graphql`. `uploadFile()` multipart → `/upload`. Envelope unwrapping + typed `ApiException`.
- **`core` (`letbuyy_core`)** — config (`razorpay_config`, `gemini_config`), constants, errors, utils (validators, formatters, dialog/snackbar helpers), responsive helpers, `SharedPreferencesService`, **hive/hive_flutter** available. (Note: `gemini_config` present but unused in merchant app.)
- **`models` (`letbuyy_models`)** — two barrels: `letbuyy_models.dart` (section/template/subscription/payment) + `merchant_contracts.dart`. **`shared_contracts.dart`** defines `ProductContract`, `ProductVariantContract`, `OrderContract`, `LineItemContract`, `CartContract`, `CustomerContract`/`CustomerAddressContract`, `CollectionContract`, `PaymentContract`, `CouponContract`, `PageContract`, and a Theme* contract family. Top-level `SectionModel`/`BlockModel` + 14 section-settings classes + `DefaultStoreTemplate` + `SubscriptionModel`/`PlanConfig` (trial/starter/business/professional; limits 50/5/30/∞; commission 3/5/3/0%; ₹0/99/399/799).
- **`ui_kit` (`letbuyy_ui_kit`)** — token sets (`LetbuyyPrimitive/Color/Typography/Spacing/Radius/Shadow/Density Tokens`), `AppColors`/`AppTextStyles`/`AppTheme`, ~22 widgets (NetworkImage, Loading, Error/Empty, Shimmer, Button, TextField, GlassContainer, AppBar, BottomNav, Drawer, Badge, ConfirmationDialog, Rating, SearchBar).
- **`services` (`letbuyy_services`)** — **deprecated empty shim** re-exporting only `SharedPreferencesService`. Merchant app does **not** depend on it.

---

## 7. Networking & config

`lib/config/app_config.dart` — values via `String.fromEnvironment` with production defaults:
- `API_BASE_URL` → `https://api.letbuyy.store/v1`
- `IDENTITY_BASE_URL` → `https://accounts.letbuyy.store`
- `STOREFRONT_BASE_URL` → `https://letbuyy.store`
- `RAZORPAY_KEY_ID` → no default (publishable only)

`dart-defines/` (`README.md`, `staging.json`, `production.json`) used with `--dart-define-from-file`. **Both JSON files still carry `SUPABASE_URL` + `SUPABASE_ANON_KEY`** (`SKIP_NEEDS_HUMAN_*` placeholders) that **no runtime code reads** — config drift to remove. Razorpay/anon keys are `SKIP_NEEDS_HUMAN_*` placeholders (no real provider keys present).

---

## 8. Firebase / legacy remnants

**Firebase is dead at runtime — but native scaffolding remains and the Android build still applies the google-services plugin (latent build risk).**

| Artifact | State | Evidence |
|---|---|---|
| Dart imports | **None** (only a comment) | `storage_service.dart:9` |
| `pubspec.yaml` | No `firebase_*`/`supabase_flutter`/`razorpay_flutter` | verified |
| iOS `GoogleService-Info.plist` (2 copies) | **Present, placeholder values** (`API_KEY=FIREBASE_IOS_API_KEY`, `PROJECT_ID=letbuy-y`) | `ios/Runner/GoogleService-Info.plist`, `ios/GoogleService-Info.plist` |
| iOS `AppDelegate.swift` | Does **NOT** call `FirebaseApp.configure()`; no Firebase pods | inert |
| Android gms plugin | **Applied** `id("com.google.gms.google-services")`; declared `version "4.4.2"` | `android/app/build.gradle.kts`, `android/settings.gradle.kts:24` |
| Android `google-services.json` | **Present** (real project `letbuy-y`/`468123057306`) but `current_key` = placeholder | `android/app/google-services.json` |
| Supabase keys | Linger unused in `dart-defines/*.json` | §7 |

`legacy/firebase/` (24 TS files, ~15k LOC) is a **separate, governance-quarantined** backend ("Deprecated", do-not-import). See FIREBASE_DECOMMISSION_PLAN.md.

---

## 9. Theme editor (mobile capability today)

A **functional, fairly advanced on-device editor** — not just a webview.
- `customize/theme_screen.dart` — browse/install themes, load draft, releases, publish, discard/duplicate, preview session.
- `editor/section_editor_screen.dart` — edits an in-memory `List<SectionModel>`: add/reorder/delete sections, 50-step undo/redo, device-mode switch, zoom, draft save (`PUT /themes/{slug}/editor/draft`), preview session. Default slug `minimal_modern`.
- `widgets/editor/` — `add_section_sheet`, `block_editor`, `compact_settings_sheet`, `editor_toolbar`, `header_editor_sheet`, `layers_drawer`, `section_card`, `section_settings_sheet`, `website_preview`.
- `widgets/editor/device_frames/` — pixel-accurate `phone_frame` (iPhone 15 Pro), `samsung_frame` (Galaxy S25), `laptop_frame` (MacBook Pro 14"), `tablet_frame` (iPad).
- `widgets/editor/preview_sections/` — **native Flutter renderers** mirroring storefront React sections (`preview_header` "matches dynamic-header.tsx", `preview_footer`, `preview_hero`, `preview_products`, `preview_testimonials`, `preview_about`, `preview_newsletter`).
- WebView used in `website_preview.dart` and `live_preview_screen.dart` (real storefront).

> ⚠️ **Risk:** native preview renderers must track the storefront's React/Liquid sections; the storefront engine is **dual/in-transition** (JSON-contract vs Liquid). Drift = preview that lies. See MOBILE_ARCHITECTURE_V2.md §Theme.

---

## 10. Design system (`lib/theme/**`, ~1,443 LOC)

Two coexisting systems: a static brand palette (`store_admin_colors.dart`, **primary `#8B5CF6`** purple, secondary `#7C3AED`, accent `#EC4899`; Slate ramp; success/warning/error) and a theme-aware accessor (`app_theme_colors.dart` → light/dark with glassmorphism, elevation scale, gradients, motion constants). `store_theme.dart` builds Material 3 `ThemeData` (GoogleFonts **Inter**, radii 12/16/20). Shared tokens from ui_kit (`letbuyy_tokens.dart`). **Default app mode = dark.** (Full parity analysis: DESIGN_SYSTEM_ALIGNMENT.md.)

---

## 11. Tests

**One placeholder.** `test/widget_test.dart` (9 LOC): `testWidgets('Placeholder test', …) { expect(true, isTrue); }`. **No meaningful coverage** for the merchant app or shared packages.

---

## 12. Sibling mobile apps

- **`operator-app`** — NOT real: 2 Dart files, stock counter demo; pubspec name `letbuyy_super_admin`.
- **`shopper-app`** — NOT implemented: manifest/placeholder only, 0 Dart files.

---

## 13. Migration call-outs (synthesis)

1. **Two auth paths to reconcile** (Dio Bearer+cookie vs raw-http CSRF/cookie); contains hardcoded Turnstile bypass + dev-OTP.
2. **Single-store assumption** pervasive (`getFirstStore()`).
3. **Analytics is faked** client-side (no `/analytics/dashboard` consumed in the dashboard).
4. **Firebase dead but native artifacts remain** + stray Supabase keys.
5. **Three services bypass DI** (`SubscriptionService`, `DomainService`, `PreviewService`).
6. **`letbuyy_services` is a deprecated empty shim.**
7. **Near-zero tests.**
8. **Parity layer is a scaffold**, not 26 finished features.
