# 01 — Source Inventory (System A, System C, System B)

File counts exclude `node_modules`, `build`, `.dart_tool`, `.next`, `.turbo`, `.vercel`, `dist`, `ios/Pods`, `ios/.symlinks`, `android/.kotlin` unless noted. "Real business logic" is judged by non-trivial `lib/`/`src/` file counts plus a manual read of at least one representative file per app — it is not inferred from folder presence alone, per instruction.

## System A — `Ecommerce/LetBuyy/apps/*` (Firebase-era, live Play Store lineage)

| App | Build config | Identity | Files (excl. generated) | Last commit touching path | Assessment |
|---|---|---|---|---|---|
| `marketplace` | `pubspec.yaml` (`letbuyy_marketplace`) + Android/iOS | `com.letbuyy.letbuyy` (confirmed in `build.gradle`, the file that actually governs the build — see anomaly below) | 354 (180 in `lib/`) | 2026-01-14, `38386895` | Real business logic — this is the shipped Play Store app |
| `admin` | `pubspec.yaml` (`letbuyy_admin`) | `com.letbuyy.admin` (in `build.gradle`) | 266 (126 in `lib/`) | 2026-01-14, `38386895` | Real business logic, but release-signing points at `debug.keystore` (see 00a) — likely never shipped a signed release |
| `seller` | `pubspec.yaml` (`letbuyy_seller`) | `com.letbuyy.seller` (in `build.gradle`) | 341 (174 in `lib/`) | 2026-01-14, `38386895` | Real business logic |
| `admin-web` | `package.json` (`admin-web`, Next.js + Firebase SDK) | N/A (web) | 82 | 2025-12-27, `b4035b5a` | Real, but smallest of the web surfaces — narrower feature set than `store-builder-web` |
| `store/builder` | `pubspec.yaml` (`letbuyy_store`) | `com.letbuyy.store` (valid Kotlin-DSL `build.gradle.kts`, `applicationId = "com.letbuyy.store"`, unlike the broken `.kts` files below) | 238 real files after excluding `ios/Pods` (2,732 raw — Pods inflated the naive count 10x) | 2026-01-14, `5b418b35` | Real business logic — `lib/` has 130 files across wizard/theme/subscription/settings widgets; this is a full merchant storefront-builder Flutter app, distinct from `store-builder-web` below |
| `store/storefront` | `package.json` (`web`, Next.js) | N/A (web) | 65, has `.vercel/` — was deployed via Vercel at some point | 2026-01-14, `be716ae1` | Real, deployed buyer-facing storefront |
| `store/web` | — | — | 0 files, empty directory | 2026-01-06, `c28beaee` | **Empty scaffold, no content** |
| `store-builder-web` | `package.json` (`store-builder-web`, Next.js) | N/A (web) | 117 | 2026-01-13, `ef17353b` | Real business logic — larger than `admin-web` |
| `functions` | `package.json` (`letbuyy-functions`, Firebase Cloud Functions, TS) | N/A | 127 | 2026-01-14, `3da0c3b3` | Real — includes `adminAuth.ts` (flagged in secret scan, doc 02/05) |
| `cloudflare-worker` | single file `storefront-proxy.js` | N/A | 1 | 2026-01-13, `8fa1ed77` | Minimal — a proxy shim, not a full runtime |
| `packages/core` | Dart package | N/A | 30 | 2025-12-26, `978fe7e6` | Contains `razorpay_config.dart`, `gemini_config.dart` (both flagged, see 05) |
| `packages/models` | Dart package | N/A | 55 | 2026-01-13, `ef17353b` | Shared data models |
| `packages/services` | Dart package | N/A | 54 | 2025-12-26, `978fe7e6` | Contains `custom_payment_service.dart`, `ai_chat_service.dart` (both flagged) |
| `packages/ui_kit` | Dart package | N/A | 27 | 2026-01-06, `c28beaee` | Shared widgets |

**Anomaly (load-bearing for the survivor scorecard):** `marketplace`, `admin`, and `seller` each carry **both** `android/app/build.gradle` (Groovy) and `android/app/build.gradle.kts` (`.kts` extension). The three apps' `build.gradle.kts` files are **byte-identical to each other** (`a05e109a…08`) and are **written in Groovy syntax, not valid Kotlin DSL** (`apply plugin: 'com.android.application'`, `namespace 'com.letbuyy.letbuyy'` with no `=`) — read directly at `Ecommerce/LetBuyy/apps/admin/android/app/build.gradle.kts:1-44`. A Kotlin-DSL `.kts` file written in Groovy syntax will not parse as Kotlin. All three apps' `build.gradle` (the Groovy file, syntactically correct) carry the **correct, distinct** `applicationId` per app (`com.letbuyy.letbuyy` / `com.letbuyy.admin` / `com.letbuyy.seller`); only the broken, identical `.kts` files hardcode `com.letbuyy.letbuyy` for all three. **I did not run a Gradle build to confirm which file Gradle actually evaluates when both are present** — that is out of scope (no build/deploy commands were run) — but the syntactic evidence strongly suggests `build.gradle` is the real, functioning config and `build.gradle.kts` is dead, mis-copied cruft. This resolves what could otherwise look like a genuine `applicationId` conflict between `admin` and `marketplace`: **the apps are not actually configured to collide** on the file that would matter if a build were run; the appearance of collision lives entirely in a non-functional duplicate file. Recommend deleting the three `build.gradle.kts` files in a later phase, after a real `flutter build` confirms they are inert.

`build.gradle.kts.backup` (present in all three, also byte-identical, hash `9312de6b…3e`) shows `namespace = "com.agrimate.agrimate"` at line 12 — see doc 04 for what this lineage implies.

## System C — `apps/*`, `apps/mobile/*`, `services/*`

| Runtime | Class (per Constitution) | Files (excl. generated) | package.json name | Last commit |
|---|---|---|---|---|
| `apps/identity-platform` | ACTIVE | 96 | `@letbuyy/identity-platform` | 2026-08-23 |
| `apps/marketing-site` | ACTIVE | 126 | `@letbuyy/marketing-site` | 2026-08-15 |
| `apps/merchant-control-plane` | ACTIVE | 347 | `@letbuyy/merchant-control-plane` | 2026-08-27 (most recently touched app in the repo) |
| `apps/platform-console` | ACTIVE | 65 | `@letbuyy/platform-console` | 2026-08-15 |
| `apps/platform-operations-portal` | FROZEN (pending consolidation into platform-console) | 53 | `@letbuyy/platform-operations-portal` | 2026-08-15 |
| `apps/storefront-runtime` | ACTIVE | 204 | `@letbuyy/storefront-runtime` | 2026-08-26 |
| `apps/app-marketplace` | FROZEN | 108 | `@letbuyy/app-marketplace` | 2026-08-15 |
| `apps/developer-portal` | FROZEN | 40 | `@letbuyy/developer-portal` | 2026-08-24 |
| `apps/theme-marketplace` | FROZEN | 127 | `@letbuyy/theme-marketplace` | 2026-08-15 |
| `apps/mobile/merchant-app` | SUPPORTING (canonical mobile) | 307 | (Flutter — no `package.json`) | 2026-08-24 |
| `apps/mobile/shopper-app` | RESERVED | 2 (`runtime.manifest.json`, `AGENTS.md` only) | — | 2026-06-11 |
| `apps/mobile/operator-app` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |
| `services/api-gateway` | ACTIVE | 364 | `@letbuyy/api-gateway` | 2026-08-27 (HEAD) |
| `services/queue-workers` | ACTIVE | 29 | `@letbuyy/queue-workers` | 2026-08-26 |
| `services/mobile-bff` | ACTIVE | 8 | `@letbuyy/mobile-bff` | 2026-08-15 |
| `services/webhook-service` | ACTIVE | 14 | `@letbuyy/webhook-service` | 2026-08-26 |
| `services/checkout-runtime` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |
| `services/event-bus` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |
| `services/notification-service` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |
| `services/analytics-pipeline` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |
| `services/media-service` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |
| `services/search-service` | RESERVED | 2 (manifest-only) | — | 2026-06-11 |

All eight RESERVED roots were directly `find`-listed (not sampled) and confirmed to contain only `runtime.manifest.json` + `AGENTS.md` — Constitution-compliant as measured.

`apps/mobile/merchant-app` is Flutter (no `package.json`); its `android/build.gradle.kts` (project-level) is **byte-identical** to the same file across System A's `marketplace`/`admin`/`seller`/`store/builder` *and* System B's `admin_app`/`customer_app`/`rider_app`/`seller_app`/`store_ops_app`/legacy `delivery` app — 11 files total, one hash (`6a26dba2…ba`, see doc 02). This is template-lineage evidence, not a functional conflict — project-level `build.gradle.kts` mostly declares plugin repositories, not `applicationId`.

## System B — `Agrimore/apps/*`, `workers/`, `supabase/`, `packages/`, `legacy_archive_v2/`

| App/dir | Build config | Identity | Files (excl. generated) | Last commit |
|---|---|---|---|---|
| `apps/customer_app` | `pubspec.yaml` (`customer_app`) | `com.agrimore.customer_app` (valid `applicationId = "..."` Kotlin DSL) | 115 | 2026-06-04, `dafb4fe9` |
| `apps/seller_app` | `pubspec.yaml` (`seller_app`) | `com.agrimore.seller_app` | 82 | 2026-06-04, `dafb4fe9` |
| `apps/admin_app` | `pubspec.yaml` (`admin_app`) | `com.agrimore.admin_app` | 90 | 2026-06-04, `dafb4fe9` |
| `apps/marketplace_web` | `package.json` (`@agrimore/marketplace-web`, Next.js) | N/A | 41 | 2026-06-04, `32eb56bf` |
| `apps/rider_app` | `pubspec.yaml` (`rider_app`) | `com.agrimore.rider_app` | 90 | 2026-06-04, `dafb4fe9` |
| `apps/store_ops_app` | `pubspec.yaml` (`store_ops_app`) | `com.agrimore.store_ops_app` | 85 | 2026-06-04, `dafb4fe9` |
| `workers/` | Cloudflare Workers (`api-gateway`, `media-gateway`, `realtime-gateway`) | N/A | 50 | 2026-06-04, `32eb56bf` |
| `supabase/` | Supabase project (`config.toml`, `functions/`, `migrations/`, `seed/`, `tests/`) | N/A | 64 | 2026-06-04, `32eb56bf` |
| `packages/` | shared Dart/TS packages | N/A | 218 | 2026-06-04, `dafb4fe9` |
| `legacy_archive_v2/` | archived prior iterations, including a `certification_theater/` subfolder | N/A | 1,324 | 2026-06-04, `5575696c` |

All six System B `applicationId`s use a clean, non-colliding `com.agrimore.*` namespace — no ambiguity of the kind System A's broken `.kts` files created.

System B runs its **own** backend stack (`workers/` Cloudflare Workers + `supabase/` Postgres project) — structurally parallel to but implementation-distinct from System C's `services/api-gateway` + Supabase. Which one is canonical is founder decision D-0, explicitly out of scope for this phase (see 04).

`legacy_archive_v2/` contains a directory literally named `certification_theater/` — direct, on-disk corroboration of this project's standing instruction to treat every audit/certification document as dated evidence, never as truth.

## Files hashed vs. skipped (for context — full method in doc 02)

- Ecommerce/LetBuyy (System A, excluding nested Agrimore): 1,807 files hashed, out of ~205,559 total files under that path (`find … -type f` excluding nothing) minus Agrimore's own count — the overwhelming majority excluded is compiled `build/` output (see below).
- Agrimore (System B): 2,453 files hashed.
- System C `apps/` + `services/`: 1,916 files hashed, out of 6,075 total (4,159 excluded — `node_modules`, `.next`, `.turbo`).

Total: **6,176 files hashed across the three trees, zero read errors.**
