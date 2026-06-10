# CODEX MOBILE PARITY MISSION — LetBuyy WS8 (Flutter ↔ Web Cross‑App)

**Driver:** Codex agent. Reasoning: `xhigh` for the re‑wire (api client, identity, contract, theme engine), `medium` for screen builds and deletions.
**Mode:** Continuous, autonomous, local, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** `apps/mobile/merchant-app/**` + `packages/dart/**` **ONLY** (you create `packages/dart/api_client`). You may also create per‑env dart‑define config files under `apps/mobile/merchant-app/`.
**Dependencies:** the live `api-gateway /v1` surface (consume) · `lb_session`/`identity-platform` (consume) · `packages/shared-types` (read‑only, to mirror contracts) · `packages/typescript/ui/src/tokens.ts` (read‑only, to mirror design tokens). **WS7** provides the real stack to test against.
**Predecessor / source of truth:** `LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md` (the 9 misconfigs, parity matrix, 5 unifications, ~22‑screen build list). This mission executes that audit.
**Governance posture:** KEEP ALL 128 VALIDATORS GREEN at every commit; never weaken a validator; update the mobile app's `runtime.manifest.json` in lockstep only if a topology validator requires it. Human‑gated → `[SKIP — NEEDS HUMAN]` and continue.

---

## 0. PRIME DIRECTIVE

Make the **Flutter merchant app an exact cross‑app of the web merchant admin**: the **same identity, same `/v1` gateway, same Supabase, same contracts, and the same theme engine** — so every merchant flow that works on the web works **identically on Android and iOS**. Re‑wire the phone off its legacy Firebase/Firestore/own‑Supabase plumbing and onto the one backend, **delete all legacy/dead files safely**, build the **~22 missing feature screens** as thin clients of existing endpoints, **unify the theme editor** on themes‑as‑data, and wire **local / staging / production** exactly like the web. **No backend changes** — this is a Flutter‑client rewrite over endpoints that already exist.

**SUCCESS CRITERIA — COMPLETE only when all proven (commands + screenshots on both platforms):**
1. **One identity:** the app authenticates through the gateway/`identity-platform` and carries **`lb_session`**; **Firebase Auth fully removed**; same merchant account as web.
2. **One API client:** a typed **`packages/dart/api_client`** (dio over `/v1`) is the *only* data path; **no direct Supabase/Firestore calls remain in the app**.
3. **One contract:** `packages/dart/models` mirrors `packages/shared-types` (one Product/Order/Customer/Theme), enforced by a conformance test.
4. **One database:** all data flows through the gateway to the platform Supabase; the hardcoded `rvzgkynwhbiksffusqnb` project + all Firestore paths are gone.
5. **One theme engine:** the Flutter editor reads/writes `/v1/themes` and previews the **real** storefront (WebView) with draft settings; device‑frame UX kept.
6. **Feature parity:** the ~22 missing merchant screens exist (customers, collections, inventory, coupons, gift cards, reviews, order detail, theme library + marketplaces, CMS pages/blog/nav/media, full settings hub, billing, form submissions, real analytics), matching the **web's patterns/IA**.
7. **Legacy gone:** Firebase auth/storage/analytics/functions, Firestore service, the embedded marketing landing, mock data, and shopper‑only services are **deleted** (FCM kept only if push is required); `flutter analyze` clean with no dangling imports.
8. **Both platforms:** `flutter build apk` (Android) **and** `flutter build ios --no-codesign` (iOS) succeed; smoke‑tested on an Android emulator **and** an iOS simulator with screenshots.
9. **Three environments:** `local` / `staging` / `production` dart‑define configs point at the correct gateway + Supabase per env, mirroring the web env model; real keys → `[SKIP — NEEDS HUMAN]`.
10. `flutter analyze` clean, `flutter test` green, **128/128 governance** green; `CODEX_MOBILE_PARITY_LEDGER.md` complete; `CODEX_MOBILE_PARITY_STATUS.md` written.

---

## 1. OPERATING CONTRACT

1. **Continuous & autonomous, 24h+.** Finish → update ledger → next unblocked task. Never pause to ask.
2. **The Green Law.** After every commit: `flutter analyze` clean, `flutter test` green for the touched package, and `pnpm run validate:governance` 128/128 at each phase gate. Never commit red; 3 strikes → revert + `BLOCKED` → next.
3. **★ No‑Backend‑Change Law.** Edit only `apps/mobile/merchant-app/**` and `packages/dart/**`. **Never** edit `services/**`, `database/**`, `packages/*-core/**`, `packages/shared-types/**` (read only to mirror), `packages/typescript/**` (read tokens only), or governance. If a screen needs data the gateway doesn't return, build the UI with a graceful empty/placeholder state and log `[SKIP — NEEDS BACKEND]` with the exact `/v1` endpoint/field needed.
4. **★ Cross‑Platform Proof Law.** Every feature is proven on **both** Android and iOS: build both, run on emulator + simulator, screenshot. iOS code‑signing for a real device/TestFlight needs an Apple account/certs → `[SKIP — NEEDS HUMAN]` (build `--no-codesign` still proves it compiles).
5. **★ Safe‑Deletion Law.** Before deleting any legacy file: `grep` for live imports/usages; if referenced, **migrate the importer first**; only then `git rm` it (reversible via history). Never leave a dangling import — `flutter analyze` must stay clean. Log every deletion in the ledger's `DELETED` section. Prefer deletion over archiving (the user wants a lean app), but if unsure, move to `docs/archive/flutter-legacy/`.
6. **★ Web‑Pattern Law.** Mirror the web merchant admin's **information architecture, flows, and screen structure** (read `apps/merchant-control-plane/src/app/[store]/**` for the canonical pattern per feature) so the phone is the *same product*, adapted to mobile (bottom nav / drawer instead of sidebar; bottom sheets for actions).
7. **SKIP‑and‑continue.** Human‑gated (live keys, Apple signing, prod Supabase, paid providers, brand/copy) → ledger `## SKIPPED — NEEDS HUMAN` + continue.
8. **No fabrication.** Every `DONE` = command + result + screenshot. **Anti‑thrash:** 3 strikes → BLOCKED. **Small reversible commits** (one screen / one service / one deletion batch).

---

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
`services/**` · `database/**` · `packages/*-core/**` · `packages/shared-types/**` (read‑only) · `packages/typescript/**` (read tokens only) · every `apps/**` **except** `apps/mobile/merchant-app/**` · `scripts/validators/**` · `docs/governance/**`. **Allowed:** `apps/mobile/merchant-app/**` and `packages/dart/**` (incl. the new `packages/dart/api_client`).

---

## 3. TARGET ARCHITECTURE (build THIS — the 5 unifications)

```
  WEB (React)  ─┐  @letbuyy/api-client
                ├─►  api-gateway /v1/*  ─►  Supabase (one DB) · lb_session · RBAC · themes-as-data
  FLUTTER (Dart)┘  packages/dart/api_client (NEW, dio)
```

1. **Identity:** login via gateway/`identity-platform`; persist `lb_session` in `flutter_secure_storage`; attach it (cookie/Authorization) on every `api_client` call; refresh/expiry handled centrally. Delete Firebase Auth.
2. **API client (`packages/dart/api_client`):** a typed Dart mirror of `@letbuyy/api-client` over `/v1/*` using `dio` (already a dependency): one `ApiClient` with resource methods (products, orders, customers, themes, settings…), an auth interceptor, error mapping, retry, pagination. **All screens use it; nothing else touches the network.**
3. **Contract (`packages/dart/models`):** mirror `shared-types` (Product/Variant/Collection/Order/LineItem/Customer/Address/Cart/Payment/Theme/Page/Coupon…). Add a **conformance test** (`flutter test`) that fails if a field diverges from the documented contract.
4. **Database:** one Supabase, reached **only** through the gateway. Remove the hardcoded project + all Firestore reads/writes.
5. **Theme engine:** editor uses the real theme bundle via `/v1/themes`; preview = `webview_flutter` pointed at the storefront preview route with draft `settings_data`; keep device frames.

**Design language (WS1 handoff):** mirror `packages/typescript/ui/src/tokens.ts` into `packages/dart/ui_kit` constants — brand primary `#8B5CF6`, secondary `#6366F1`, Inter, spacing 4·8·12·16·24·32·48, radius/shadow — so the phone looks like the web (90% neutral / 10% accent). Lucide‑equivalent icons.

**Environments (mirror web):** maintain `apps/mobile/merchant-app/dart-defines/{staging,production}.json` with non-secret `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `API_BASE_URL`, `RAZORPAY_KEY_ID`, `ENVIRONMENT`:
- **staging:** the staging Supabase + `https://api.staging.letbuyy.store/v1` · `ENVIRONMENT=staging`
- **production:** prod Supabase + `https://api.letbuyy.store/v1` · `ENVIRONMENT=production`
Real anon keys/Razorpay keys are placeholders → `[SKIP — NEEDS HUMAN]` (the human fills them, exactly like the web's `config/env/*`). Build with `flutter run --dart-define-from-file=dart-defines/<env>.json`.

---

## 4. LEGACY DELETION LIST (delete safely per §1.5)

| Legacy | Where | Action |
|---|---|---|
| Firebase Auth | `dart/services` `firebase_auth`, `auth_service.dart` Firebase paths | replace with gateway/`lb_session`, then delete |
| Firestore | `firestore_data_service.dart`, all `.collection(...)` usages | migrate to `api_client`, then delete |
| Firebase Storage/Analytics | `dart/services` `firebase_storage`/`firebase_analytics` | migrate media→`/v1/media`, analytics→`/v1/analytics`, delete |
| Firebase Cloud Function (UPI) | `verifyUpiPayment` URL/usages | route payments through gateway, delete |
| Hardcoded Supabase project | `rvzgkynwhbiksffusqnb...` references | remove; env‑driven only |
| Embedded marketing landing | `apps/mobile/merchant-app/lib/screens/landing/**` | delete (that's `marketing-site`'s job) |
| Mock data | `randomuser.me`, `9198…`, demo `*.web.app` URLs | replace with real gateway data, delete mocks |
| Shopper‑only services | `cart/wishlist/reels/deals/loyalty/ads/visual_search/ai_chat` providers in `dart/services` | move out of the **merchant** surface (leave for shopper app), remove from merchant imports |
| `pubspec.yaml` deps | `firebase_auth/storage/analytics`, `cloud_firestore` (keep `firebase_messaging` only if push is required) | remove unused deps |

Each row: confirm no live import → migrate importer → `git rm` → `flutter analyze` clean → log in `DELETED`.

---

## 5. LEDGER — `CODEX_MOBILE_PARITY_LEDGER.md`
```
# CODEX MOBILE PARITY (WS8) LEDGER — started <ts>
## BASELINE (M0): flutter analyze/test; android build; ios build; legacy inventory; env configs
## PROGRESS LOG (newest first): <ts> [M#] <task> — DONE — <cmd>->result — screenshot(android|ios) <path> — commit <sha>
## DELETED (append-only): <ts> <file> — confirmed no live import — git rm — analyze clean
## SKIPPED — NEEDS HUMAN / BACKEND (append-only): [SKIP] <task> — requires <key/endpoint/Apple-signing>
## VISUAL LEDGER (append-only): <ts> <screen> — android <path> | ios <path>
## VALIDATOR LEDGER (append-only): <ts> validate:governance -> 128/128 after <sha>
```

---

## 6. THE WORK — M0 → M8 (in order; don't start a phase until the prior gate is green)

### M0 — Baseline, environments & safety net
- **M0.1** Create `CODEX_MOBILE_PARITY_LEDGER.md`. Run `flutter analyze` + `flutter test`; build **both** platforms (`flutter build apk --debug`, `flutter build ios --no-codesign --debug`) and record results. Inventory every legacy file (§4) + every direct Supabase/Firestore/Firebase usage. **Effort:** M. **Priority:** P0.
- **M0.2** Create the 3 env configs (`dart-defines/{local,staging,production}.json`) per §3 (real keys = placeholder `[SKIP — NEEDS HUMAN]`); document `flutter run --dart-define-from-file=...`. **Effort:** S. **Priority:** P0.
- **GATE M0:** baseline + both‑platform builds recorded; env configs committed; 128/128.

### M1 — One API client (`packages/dart/api_client`)
- **M1.1** Build the typed `ApiClient` (dio over `/v1`) with auth interceptor, error mapping, retry, pagination, and resource methods mirroring `@letbuyy/api-client`. **Files:** `packages/dart/api_client/**`. **Effort:** L. **Priority:** P0.
  - Web pattern: `packages/typescript/api-client/src/index.ts` (mirror its method surface).
- **M1.2** Wire it into the app via DI/provider; a single base‑URL/env source from M0.2. **Effort:** M. **Priority:** P0.
- **GATE M1:** `api_client` compiles + unit‑tested against the local gateway (real product list returns); analyze green; 128/128.

### M2 — One identity (`lb_session`), delete Firebase Auth
- **M2.1** Login/signup/OTP through the gateway/`identity-platform`; persist `lb_session` in `flutter_secure_storage`; attach on every `api_client` call; handle expiry/refresh. **Files:** `lib/screens/auth/**`, `lib/services/`, `packages/dart/services/auth_service.dart`. **Effort:** L. **Priority:** P0.
  - Web pattern: `apps/identity-platform` + `lb_session` cookie.
- **M2.2** Remove Firebase Auth (`firebase_auth`, Google/Apple/Facebook/custom‑token paths) per §1.5. **Effort:** M. **Priority:** P0.
- **GATE M2:** merchant logs in with the same account as web (real stack); no `FirebaseAuth` references remain; both platforms; 128/128.

### M3 — One contract (`packages/dart/models` ↔ `shared-types`)
- **M3.1** Align/mirror Dart models to `shared-types` (Product/Variant/Collection/Order/LineItem/Customer/Address/Cart/Payment/Theme/Page/Coupon…); add a **conformance test**. **Effort:** L. **Priority:** P0.
- **GATE M3:** models match contract; conformance `flutter test` green; 128/128.

### M4 — Re‑point existing screens + design tokens
- **M4.1** Move the screens it already has — dashboard, products (+import/form), orders, analytics, settings (store/domain/seo), subscription — onto `api_client` + the shared models. Remove direct Supabase/Firestore from them. **Effort:** L. **Priority:** P0.
- **M4.2** Mirror `tokens.ts` into `packages/dart/ui_kit` (color/type/spacing/radius/shadow) + Lucide‑equivalent icons; apply to the app shell + these screens. **Effort:** M. **Priority:** P1.
- **GATE M4:** existing features run on the real gateway/DB; visual identity matches web; both‑platform screenshots; 128/128.

### M5 — Legacy deletion (safe cleanup)
- **M5.1** Execute the §4 deletion list: Firestore service, Firebase storage/analytics/functions, hardcoded Supabase project, embedded marketing landing (`lib/screens/landing/**`), mock data, shopper‑only services; prune unused `pubspec.yaml` deps. **Per‑file:** confirm no live import → migrate → `git rm` → `flutter analyze` clean → log `DELETED`. **Effort:** L. **Priority:** P0.
- **GATE M5:** no Firebase auth/storage/analytics/Firestore/mock/landing remains; analyze clean; both platforms build; app is lean; 128/128.

### M6 — Theme editor unification (FLAGSHIP)
- **M6.1 Theme library** screen (current/draft/publish/preview/duplicate) over `/v1/themes`. **Effort:** M. **Priority:** P0.
- **M6.2 Editor data + save:** read/write the real theme bundle (settings_schema + `templates/*.json` + sections) via `/v1/themes`; replace `theme_editor_models.dart` local model. **Effort:** L. **Priority:** P0.
- **M6.3 Real preview:** swap the hardcoded `preview_sections/*` for a `webview_flutter` of the storefront preview route with draft `settings_data`; **keep** the device‑frame UX (`widgets/editor/device_frames/*`). If a storefront preview endpoint is missing → `[SKIP — NEEDS BACKEND]` and preview published settings. **Effort:** L. **Priority:** P0.
- **GATE M6:** a theme edited on the phone matches web + storefront (proven on the real stack); both platforms; 128/128.

### M7 — Missing feature screens (the ~22, web‑pattern parity)
Build each as a thin Flutter screen over the existing endpoint, mirroring the web's IA. **Effort:** S–M each. **Priority:** P0/P1.
- **Commerce:** Customers `/v1/customers` · Collections `/v1/categories` · Inventory `/v1/inventory` · Coupons `/v1/coupons` · Gift cards · Reviews mgmt `/v1/reviews` · Order detail (timeline/fulfil/refund) `/v1/orders`.
- **Online store:** Theme Marketplace (browse/install) · CMS Pages `/v1/pages` · Blog `/v1/blog` · Navigation menus · Media `/v1/media`.
- **Apps:** App Marketplace (browse/install/consent) `/v1/app-store`.
- **Settings hub (mirror WS9 IA):** Checkout · Shipping `/v1/shipping-tax` · Taxes/GST · Notifications `/v1/notifications` · Users & permissions `/v1/employee` · Policies `/v1/pages` · Payments (full) `/v1/payments` · Plan & Billing (full) `/v1/billing` · Business · Localization · Security.
- **Other:** Form submissions `/v1/form-submissions` · real Analytics `/v1/analytics`.
- **GATE M7:** all ~22 screens present (real, or `[SKIP — NEEDS BACKEND]` placeholder); navigation mirrors web (mobile bottom‑nav/drawer + grouped sections); both‑platform screenshots; 128/128.

### M8 — Cross‑platform & environment hardening + final
- **M8.1** Full **Android** smoke (emulator): login → product → order → theme edit → settings, screenshots. **Effort:** M. **Priority:** P0.
- **M8.2** Full **iOS** smoke (simulator): same journey, screenshots. iOS signing for device/TestFlight → `[SKIP — NEEDS HUMAN]`. **Effort:** M. **Priority:** P0.
- **M8.3** Verify `local` / `staging` / `production` dart‑define builds compile and target the correct gateway/Supabase (real keys SKIP). **Effort:** S. **Priority:** P0.
- **GATE M8 (FINAL):** both platforms run the end‑to‑end merchant journey on the real stack; 3 env builds verified; `flutter analyze` clean, `flutter test` green, 128/128; `CODEX_MOBILE_PARITY_STATUS.md` written.

---

## 7. FINAL REPORT — `CODEX_MOBILE_PARITY_STATUS.md`
Per‑phase table; before/after **Android + iOS** screenshots of each major screen; the deletion summary (legacy files removed, deps pruned); the parity matrix re‑scored (was 8–10/30 → target full); the `SKIPPED — NEEDS HUMAN/BACKEND` list; and final gate results (analyze/test/governance/both builds). Mark **COMPLETE only if** all §0 criteria are proven on the real stack on **both** platforms, legacy is gone, and zero edits touched the DO‑NOT‑TOUCH list. Otherwise `BLOCKED — AWAITING HUMAN`.

---

## 8. LAUNCH PROMPT (paste into Codex `/goal`)

```
Read docs/Codex_waves/CODEX_MOBILE_PARITY_MISSION.md and LETBUYY_FLUTTER_WEB_PARITY_AUDIT.md in full,
then execute M0→M8 continuously and autonomously, 24h+, never stopping while unblocked work remains.

OWN ONLY: apps/mobile/merchant-app/** and packages/dart/** (create packages/dart/api_client).
NEVER edit services/**, database/**, packages/*-core/**, shared-types (read-only), packages/typescript/** (read
tokens only), other apps, or governance. Backend data missing → [SKIP — NEEDS BACKEND] + placeholder screen.

Goal: make the Flutter merchant app an EXACT cross-app of the web admin — same identity (lb_session, delete Firebase
Auth), same /v1 gateway via a new typed dart api_client (no direct Supabase/Firestore in the app), same contracts
(dart models mirror shared-types + conformance test), same Supabase (remove hardcoded project + Firestore), same theme
engine (editor reads/writes /v1/themes + WebView of the real storefront preview, keep device frames). Then SAFELY DELETE
all legacy (Firebase auth/storage/analytics/functions, Firestore, embedded marketing landing, mock data, shopper-only
services) — confirm no live import, migrate, git rm, keep flutter analyze clean. Build the ~22 missing screens mirroring
the web's IA. Wire local/staging/production dart-define configs like the web (real keys [SKIP — NEEDS HUMAN]).

PROVE on BOTH platforms: flutter build apk AND flutter build ios --no-codesign succeed; smoke on an Android emulator
AND an iOS simulator with screenshots (iOS device signing → [SKIP — NEEDS HUMAN]). Keep flutter analyze clean,
flutter test green, and all 128 validators green at each gate; small reversible commits; 3 strikes → BLOCKED → next;
no fabrication (every DONE = command + result + screenshot). Mirror the web pattern per feature by reading
apps/merchant-control-plane/src/app/[store]/** (read-only). Maintain CODEX_MOBILE_PARITY_LEDGER.md. Begin with M0.1 now.
```

---

## 9. ONE‑LINE NORTH STAR
The phone becomes a **second renderer of the same platform** — same identity, same gateway, same database, same contracts, same theme engine — so every web merchant flow runs identically on Android and iOS, with zero legacy left behind.
