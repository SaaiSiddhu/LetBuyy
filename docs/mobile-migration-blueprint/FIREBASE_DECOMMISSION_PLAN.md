# FIREBASE DECOMMISSION PLAN

**Reframe:** Firebase is **already removed from the Flutter runtime** on `stream/letbuyy-foundation-v2`. There is **no Firebase Auth, Firestore, Realtime DB, Storage, Messaging, Analytics, Crashlytics, or Remote Config** in the Dart code or `pubspec.yaml`. What remains is in three buckets:

1. **Orphaned native build artifacts** in the merchant app (cosmetic + latent build/security risk).
2. **A governance-quarantined legacy backend** at `legacy/firebase/` (do-not-import; scheduled for deletion).
3. **Unported business capabilities** that lived in Firebase Functions and have **no successor** in the live platform (the real risk).

This plan covers safe removal of (1) and (2), and flags (3) for product/eng decision.

---

## 1. Repo-wide Firebase footprint (evidence)

### 1a. Flutter merchant app — runtime: CLEAN
| Surface | Finding | Evidence |
|---|---|---|
| Dart imports | **0** Firebase/Firestore imports in `lib/` and `packages/dart` | grep |
| `pubspec.yaml` | No `firebase_*` deps; only a stale **comment** | `lib/services/storage_service.dart:9` |
| Storage replacement | Uploads go to R2 via gateway `/v1/upload` | `storage_service.dart`, gateway `routes/upload.ts` |

### 1b. Flutter merchant app — native artifacts: ORPHANED (action required)
| Artifact | Path | Risk |
|---|---|---|
| Android gms plugin (applied) | `android/app/build.gradle.kts:7` → `id("com.google.gms.google-services")` | Build parses `google-services.json`; ships GMS hooks for nothing |
| Android gms plugin (declared) | `android/settings.gradle.kts:24` → `id("com.google.gms.google-services") version "4.4.2" apply false` | Dependency resolution overhead |
| Android config | `android/app/google-services.json` (4,960 B, project `letbuy-y`/`468123057306`, `current_key`=placeholder) | Leaks a real Firebase project ref + 4 package names; misleads future devs |
| iOS config (×2) | `ios/Runner/GoogleService-Info.plist`, `ios/GoogleService-Info.plist` (1,203 B, placeholder values) | Inert but misleading; `AppDelegate.swift` does **not** call `FirebaseApp.configure()` |
| Config drift | `dart-defines/{staging,production}.json` → unused `SUPABASE_URL` + `SUPABASE_ANON_KEY` | Stray secrets surface; no runtime reads them |

### 1c. Legacy backend — quarantined (scheduled delete)
`legacy/firebase/` — **24 TS files, ~15,323 LOC**, governance status **"Deprecated… must not be imported"** (`legacy/firebase/AGENTS.md`; `docs/governance/repository-topology.md:135`). Contents: `firestore.rules`, `storage.rules`, `firebase.json`, `migrate-firebase.sh`, and Cloud Functions: `adminAuth`, `adminProfile`, `adminTOTP`, `analyticsService`, `bankIfscSearch`, `commissionService`, `domainMapping`, `emailVerification`, `kycVerification`, `notifications`, `orderNotifications`, `passwordReset`, `razorpayService`, `returnService`, `sellerAuth`, `settlementService`, `storeAuth`, `storeDeployment`, `subscriptionService`, `subscriptionWebhook`, `walletService`, `config/email.config`, `index.ts`. Both `docs/audit/01` (Action #1) and `docs/audit/14` (Phase 1) schedule its deletion **after a CI check**.

### 1d. Other Firebase string hits (no action — false positives)
124 files match `firebase|firestore` repo-wide, but outside `legacy/firebase/` they are: audit/forensic prose, governance validators that *detect* Firebase, `.gitignore`, and `next.config.ts` security-header allowlists. None are live Firebase usage.

---

## 2. Per-dependency decommission table

| Firebase capability | Was used for (legacy) | Current replacement | Migration path | Risk | Rollback |
|---|---|---|---|---|---|
| **Firebase Auth** | Seller/admin login | Custom identity (`users_custom` + `sessions`, `lb_session`) via `identity-platform` + gateway `/auth/custom/*` | Already done in Flutter (`StoreAuthService`) | Low (done) | git revert app changes |
| **Firestore** | Primary datastore | Supabase Postgres (~200 tables) behind gateway `/v1` | Already done (typed `*Contract`) | Low (done) | — |
| **Firebase Storage** | Product/media images | Cloudflare **R2** via `/v1/upload` → `cdn.letbuyy.store` | Already done (`storage_service.dart`) | Low (done) | — |
| **Cloud Functions** | Auth, payments, KYC, settlement, wallet, commission, returns, domain mapping, notifications | Gateway routes + `webhook-service` + `queue-workers` — **partial** (see §4) | Per-capability; some unported | **Med–High** (gaps) | keep `legacy/firebase` read-only until parity proven |
| **FCM / Messaging** | Push notifications | `device_tokens` table exists; `/v1/notifications` route exists; **no mobile push client yet** | Build push in mobile V2 (P1) | Med | n/a (new) |
| **Firebase Analytics / Crashlytics** | App telemetry | None in Flutter; web uses Analytics Engine + projections | Add a mobile-appropriate tool (e.g. Sentry) in V2 | Low | n/a |
| **Remote Config** | Feature flags | Gateway env vars + `FEATURE_*` flags server-side | No mobile equivalent needed yet | Low | n/a |
| **gms Gradle plugin** | Firebase Android wiring | — (nothing) | Remove (§3) | Low | re-add plugin lines |
| **GoogleService-Info.plist / google-services.json** | Firebase project config | — (placeholders) | Delete (§3) | Low | restore from git |
| **Supabase anon keys in dart-defines** | (never read by app) | — | Strip keys (§3) | Low | restore from git |

---

## 3. Safe removal procedure (orphaned artifacts) — ordered, low-risk

> Do this as one isolated PR titled "chore(mobile): excise orphaned Firebase/Supabase native artifacts". It touches **no Dart runtime code**, so behavior is unchanged.

**Step 1 — Android gms plugin.**
- Remove `android/app/build.gradle.kts:7` → `id("com.google.gms.google-services")`.
- Remove `android/settings.gradle.kts:24` → the `com.google.gms.google-services … apply false` line.
- **Keep** `settings.gradle.kts:14` `google()` (that Maven repo is required for AndroidX).
- Delete `android/app/google-services.json`.

**Step 2 — iOS config.**
- Delete `ios/Runner/GoogleService-Info.plist` and `ios/GoogleService-Info.plist`.
- Confirm `ios/Runner/AppDelegate.swift` has no `FirebaseApp.configure()` (verified: it does not) and the `Podfile` has no Firebase pods (verified: none).

**Step 3 — Config drift.**
- Remove `SUPABASE_URL` and `SUPABASE_ANON_KEY` keys from `dart-defines/staging.json` and `dart-defines/production.json` (and update `dart-defines/README.md` to drop them).

**Step 4 — Verify build.**
- `flutter clean && flutter pub get`
- `flutter build apk --debug --dart-define-from-file=dart-defines/staging.json`
- `flutter build ios --no-codesign --dart-define-from-file=dart-defines/staging.json`
- Run `node scripts/validate-governance.mjs` (env/artifact change → governance requires it per `CLAUDE.md`).

**Step 5 — Acceptance:** both platforms build; app boots to `AuthWrapper`; image upload still works against `/v1/upload`; no `google-services`/Firebase string remains under `apps/mobile/merchant-app` except the historical comment (optionally update that comment too).

**Rollback:** single `git revert` of the PR restores every file.

---

## 4. ⚠️ The real risk — unported capabilities (NOT a cleanup item)

`legacy/firebase/` is the **only** place several business capabilities are implemented. `FORENSIC_REPORT/13-technical-debt.md` flags that **wallet, commission, settlement, KYC, and returns have no successor** in `services/api-gateway/src/routes/`. Before deleting `legacy/firebase/`, confirm each capability is either re-implemented or intentionally dropped:

| Legacy function | Live successor? | Action before deleting legacy |
|---|---|---|
| `sellerAuth` / `storeAuth` / `adminAuth` / `adminTOTP` | ✅ custom identity + `/auth/custom/*` | OK to retire |
| `passwordReset` / `emailVerification` | ✅ identity-platform + `/auth` | OK |
| `razorpayService` / `subscriptionService` / `subscriptionWebhook` | ✅ gateway `/payments` + `webhook-service` | OK (verify webhook parity) |
| `domainMapping` | ✅ store custom-domain on `sites` | OK |
| `orderNotifications` / `notifications` | 🟠 `/v1/notifications` + `device_tokens`, but **no push client** | Build mobile push (P1) before claiming parity |
| `analyticsService` | 🟠 projections exist; mobile dashboard fakes metrics | Add real `/analytics/dashboard` consumption |
| `kycVerification` | ❌ **no successor found** | **Decide:** re-implement or drop (compliance risk) |
| `walletService` | ❌ **no successor** | Decide |
| `commissionService` | ❌ **no successor** (PlanConfig carries commission %, but no engine) | Decide |
| `settlementService` | ❌ **no successor** (no payouts/settlement in gateway or web) | Decide |
| `returnService` | ❌ **no successor** (tables `returns`/`refunds` exist; no flow) | Decide |
| `bankIfscSearch` | ❌ **no successor** | Decide (used by settlement) |

**Recommendation:** Keep `legacy/firebase/` **read-only as reference** until the ❌ rows have an explicit "re-implement or drop" decision logged. Deleting it prematurely loses the only spec for wallet/commission/settlement/KYC/returns. This is a **platform** decision, not a mobile one — but it directly limits what the mobile app can ever offer (e.g. no payouts screen until settlement exists anywhere).

---

## 5. Net

- **Mobile Firebase removal is ~95% done.** The remaining 5% is a one-PR native-artifact cleanup with trivial rollback (§3).
- **No orphaned Dart code, no hidden Firebase runtime dependency.**
- **The genuine hazard is upstream:** 6 capabilities (wallet/commission/settlement/KYC/returns/IFSC) exist *only* in the quarantined Firebase tree. Resolve those before deleting `legacy/firebase/`, and understand they cap mobile feature scope until re-platformed.
