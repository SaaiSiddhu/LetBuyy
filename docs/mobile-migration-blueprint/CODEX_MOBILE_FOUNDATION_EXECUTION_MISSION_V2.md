# CODEX MOBILE FOUNDATION — MASTER EXECUTION MISSION **V2** (single resumable run, P0→P5 to 100%)

> **Paste this whole document into Codex.** It supersedes V1. It drives the LetBuyy codebase to the full target state in the nine docs under `docs/mobile-migration-blueprint/`. **One mission, every phase P0→P5.** You do not stop, you do not ask. If your session budget ends mid-mission, you **checkpoint** so the next invocation of this exact prompt **resumes from the ledger** and continues to 100%. To the operator this is one mission run to completion.

---

## 0. WHO YOU ARE & THE PRIME DIRECTIVE

You are one autonomous staff-level engineer wearing all hats (Shopify Mobile Platform Architect, Staff Flutter, Staff Next.js, Cloudflare, Supabase). You own the whole monorepo.

**Prime directive:** make `apps/mobile/merchant-app` a fully capable, mobile-first commerce OS aligned to the live Cloudflare/Supabase gateway — implementing **every issue across all nine blueprint docs, P0 through P5, to completion**. A merchant must run their entire business from a phone: create/configure store, products, inventory, orders, customers, domains, themes, pages, discounts, analytics, payments, shipping, apps, settings, staff, subscriptions, theme customization — **no laptop, ever**.

**Two laws:**
1. **Never stop for a human; never ask a question.** Blocked → placeholder + ledger row → continue (see §4).
2. **Never lose work.** Commit after every phase (and every large feature). Update the STATUS/LEDGER continuously so a re-invocation resumes seamlessly (see §3).

---

## 1. CURRENT STATE — START HERE (do not redo P0 from scratch)

A prior run (V1) already landed most of **P0** on branch `stream/letbuyy-foundation-v2`. **Read `docs/mobile-migration-blueprint/CODEX_MOBILE_FOUNDATION_STATUS.md` and `…_LEDGER.md` first** to see exactly what's done. Verified current state:

**DONE (do not repeat):** `services/mobile-bff` Worker (HMAC re-signer, governance green); native Firebase/Supabase artifacts deleted; dev-bypass/dev-OTP removed (now throws `SKIP_NEEDS_HUMAN_*`); faked analytics replaced with gateway calls; product legacy `Map` projection removed; `SubscriptionService` registered in DI; CI workflow added; stale docs regenerated.

**P0 NOT FINISHED — close these before P1 (see §5):**
- **Razorpay** still throws `SKIP-NEEDS-BACKEND: MOBILE_RAZORPAY_CHECKOUT_URL` (native plugin broke iOS; only a URL stub remains). → make subscription checkout actually work.
- **Design tokens** — hardcoded `Color(0xFF8B5CF6)` still across screens; Poppins/Inter conflict unresolved.
- **Tests** — only 2 tiny tests exist; the mission bar is unit-per-service + widget golden paths + integration.
- **Auth seam** — login/signup now *throw* pending the human Turnstile/OTP work (S-002/S-003). Build the mobile Turnstile + OTP entry UI so the seam is functional with a real challenge token (the *secret/provider* parts stay skipped).

**Correction (V1 exposed this):** `DomainService` and `PreviewService` **do not exist** in `lib/services/` — there are 11 services (analytics, api_client, language, order, product, storage, store_auth, store, subscription, theme_provider, theme_service). Where a phase needs them, **create them**. Treat per-file line counts in the blueprint as approximate.

**Do NOT modify** `services/api-gateway/**` (Option A needs no gateway change) or any pre-existing uncommitted files unrelated to mobile (e.g. `FORENSIC_REPORT/*`, `infrastructure/*.tf`) — those are the operator's dirty state; leave them alone.

---

## 2. OPERATING CONTRACT

- **Branch:** continue on `stream/letbuyy-foundation-v2` (or cut `stream/mobile-foundation-v2` from it; record branch+HEAD in STATUS).
- **Constitution:** root `AGENTS.md` → local `AGENTS.md` → `docs/governance/**`. Run `node scripts/validate-governance.mjs` after every topology/import/package/env/artifact change **and** at the end of every phase. **The mission is not done until it is green.**
- **Single backend:** all mobile traffic → `services/mobile-bff` → gateway `/v1`. No direct Postgres, no Firebase, no second backend. The BFF allow-list already covers every route P1–P5 needs; if a needed prefix is missing, add it to the BFF allow-list only.
- **Commit discipline (NEW, mandatory):** after each phase passes its gates (§11), `git add` only mobile + BFF + governance files you changed and commit with `feat(mobile): <phase> — <summary>`. **Never commit secrets.** Keep commits scoped to your work; do not sweep the operator's pre-existing dirty files into your commits.
- **Keep state, stack, structure:** `provider`/`ChangeNotifier` + Navigator (until §9 deep-links), shared `*Contract` models, `ui_kit` widgets, design tokens. Don't churn the working core (wizard/products/orders/editor) without cause.

---

## 3. RESUMABLE CHECKPOINT PROTOCOL (this is how one mission spans sessions)

Treat the STATUS file as your durable memory. On **every** invocation:

1. Read `CODEX_MOBILE_FOUNDATION_STATUS.md`. Find the first phase/feature not marked `DONE`/`DONE-WITH-SKIP`. **Resume there.** Do not redo completed items.
2. Maintain a **feature-level checklist** in STATUS (every row in the §5–§10 matrices), each: `DONE` / `DONE-WITH-SKIP` / `IN-PROGRESS` / `TODO`, with file-path evidence.
3. After finishing each feature: update its row, run its tests, and if the phase is complete run §11 gates + commit.
4. If you sense budget/context running low: **stop at a clean boundary**, ensure the last feature compiles, commit it, write a `## RESUME HINT` block in STATUS naming the exact next feature + files, and end. The next invocation continues from there.
5. The mission is **complete** only when every §5–§10 row is `DONE`/`DONE-WITH-SKIP`, §13 DoD holds, and governance is green.

---

## 4. SKIP-AND-CONTINUE PROTOCOL

Implement everything you can. Defer **only** these, via greppable placeholder + ledger row, then continue:

| Category | Action | Marker |
|---|---|---|
| Real secret **values** | wire it, inject placeholder | `SKIP_NEEDS_HUMAN_<SCOPE>_<KEY>` |
| Production deploy / DNS activation | write config, don't deploy | `// [SKIP-NEEDS-HUMAN: prod deploy]` |
| App-store signing | write CI lanes, don't sign | ledger row |
| Provider accounts/certs (Razorpay, FCM/APNs) | write all code+config, placeholder creds | `SKIP_NEEDS_HUMAN_*` |
| Capabilities with **no gateway route** (payouts, wallet, commission, settlement, KYC, returns, 2FA, business/localization/custom-data, app-bridge runtime) | build flagged mobile seam → typed stub that throws `SkipNeedsBackendException(id)` | `// [SKIP-NEEDS-BACKEND: <cap>]` |

Rules: never halt; every placeholder throws loudly in prod (never silent no-op); every placeholder has a ledger row in `CODEX_MOBILE_FOUNDATION_LEDGER.md`.

---

## 5. P0 — FINISH THE FOUNDATION (close partials first)

| Item | Build | Endpoint | Acceptance |
|---|---|---|---|
| **Razorpay checkout (real)** | Use a maintained, iOS-buildable approach: a WebView/Checkout-URL flow against gateway subscription order → on return, verify. If gateway returns only a raw order id with no `short_url`/`checkout_url`, render an in-app Razorpay Checkout via WebView with the publishable key + order id, capture the success payload, POST verify. Keep S-008 only if truly impossible; otherwise close it. | `POST /v1/payments/subscription/order`, `POST /v1/payments/subscription/verify` | iOS+Android build green; a (test-key) checkout opens and verify is called; no `SKIP-NEEDS-BACKEND` for the happy path |
| **Auth seam functional** | Build mobile Turnstile challenge UI + OTP entry screen (`lib/screens/auth/otp_screen.dart`) so `StoreAuthService.signIn/signUp` receive a real challenge token + OTP; keep provider keys as `SKIP_NEEDS_HUMAN_*`. | identity host + BFF→`/v1/auth/custom/session` | login flow reaches the gateway with a real token shape (provider key skipped, not the flow) |
| **Design tokens (full sweep)** | Replace every hardcoded `Color(0xFF8B5CF6)`/raw hex in `lib/**` with `LetbuyyColorTokens`/`AppThemeColors`; standardize **Inter** (fix `ui_kit/AppTextStyles` Poppins); make `StoreAdminColors` an alias of the token layer; add `48` spacing. | — | grep finds no raw `0xFF8B5CF6` in `lib/screens`/`lib/widgets` |
| **Real tests** | Unit test per service (mock Dio): store, product, order, analytics, subscription, theme, auth, + new P1+ services. Contract tests for `*Contract`. Widget golden paths: login, create product, fulfill order. Integration scaffold vs staging (real creds = skip). | — | `flutter test` green; every service has ≥1 test |

Commit `feat(mobile): finish P0 foundation`. Run §11 gates.

---

## 6. P1 — RUN THE STORE FROM A PHONE

Create first-class, typed, token-styled screens. Replace the matching `/features/*` generic-viewer entries in `lib/screens/parity/merchant_feature_definitions.dart` with real screens (keep the registry as a feature-flag index). New services follow the `ChangeNotifier` + DI pattern and use the shared `ApiClient`.

| Feature | New files | Endpoint(s) | Acceptance |
|---|---|---|---|
| **Order detail + refunds** | `lib/screens/orders/order_detail_screen.dart` | `GET /v1/orders/:id`, `POST /v1/orders/:id/refund` (+`/refund/complete`) | open an order → see line items/customer/totals/timeline → issue refund |
| **Customers + detail + addresses** | `lib/screens/customers/customers_screen.dart`, `customer_detail_screen.dart`, `lib/services/customer_service.dart` | `GET /v1/customers`, `GET /v1/customers/:email`, address CRUD | list/search → detail with orders+addresses |
| **Inventory adjust** | `lib/screens/inventory/inventory_screen.dart`, `lib/services/inventory_service.dart` | `GET /v1/inventory/levels`, `POST /v1/inventory/adjust` | adjust stock ± with reason; low-stock filter |
| **Coupons CRUD** | `lib/screens/discounts/coupons_screen.dart`, `coupon_form_screen.dart`, `lib/services/coupon_service.dart` | `/v1/coupons*` (+`/validate`) | create/edit/toggle/delete |
| **Notifications settings** | `lib/screens/settings/notifications_screen.dart` | `/v1/notifications` | real toggles persisted |
| **Push notifications** | `lib/services/push_service.dart`; queue-workers consumer in `services/queue-workers/src/` | register token→`device_tokens`; deliver `/v1/notifications` events to FCM/APNs | token registers; dispatcher code+config written; certs = `SKIP_NEEDS_HUMAN_*` |

Commit `feat(mobile): P1 daily ops`. Gates.

## 7. P2 — BUILD & CONFIGURE A STORE FROM A PHONE

| Feature | New files | Endpoint(s) | Notes |
|---|---|---|---|
| **Theme switch/publish/versions** | extend `customize/theme_screen.dart`; `theme_versions_screen.dart` | `/v1/themes*` (publish/releases/rollback/preview-session) | **WebView preview vs live storefront `/preview` is authoritative**; native `preview_sections/*` = thumbnails only |
| **CMS Pages** | `lib/screens/content/pages_screen.dart`, `page_editor_screen.dart`, `lib/services/cms_service.dart` | `/v1/pages*` | CRUD + body editor |
| **Blog** | `content/blog_screen.dart`, `post_editor_screen.dart` | `/v1/blog/posts*`, `/blog/comments*` | posts CRUD + comment moderation |
| **Navigation builder** | `content/navigation_screen.dart` | `/v1/pages/navigation*` | drag-orderable menu |
| **Media library** | `content/media_library_screen.dart`, `lib/services/media_service.dart` | `/v1/media*`, `/v1/upload`, `DELETE /v1/upload/:key` | browse/upload/delete (R2) |
| **Shipping** | `settings/shipping_screen.dart`, extend a shipping/tax service | `/v1/shipping-tax/shipping*` | zones + rates CRUD |
| **Taxes** | `settings/taxes_screen.dart` | `/v1/shipping-tax/taxes*` | rates + inclusive toggle |
| **Domains lifecycle** | **create** `lib/services/domain_service.dart`; enhance `settings/domain_settings_screen.dart` | `/v1/stores/:id/domain`, `/v1/domains/check` | DNS records (copy + "email me"), verify, SSL status poll |
| **Collections CRUD** | `products/collections_screen.dart` | `/v1/products/collections` | full CRUD |
| **Product variant matrix** | extend `products/product_form_screen.dart` | `/v1/products` | per-variant SKU/price/qty grid |
| **Inventory WMS** | `inventory/{locations,suppliers,purchase_orders,transfers}_screen.dart`; barcode via `mobile_scanner` | `/v1/inventory/{locations,suppliers,purchase-orders,transfers}` (+receive/ship) | leapfrogs web |

Commit `feat(mobile): P2 store building`. Gates.

## 8. P3 — GROWTH & EXTENSIBILITY

| Feature | New files | Endpoint(s) | Notes |
|---|---|---|---|
| **Staff & RBAC** | `settings/staff_screen.dart`, `lib/services/staff_service.dart`; role-gating helper | `/v1/employees*` | invite/role/remove + **client-side role gating** |
| **Billing / invoices** | `settings/billing_screen.dart` | `/v1/payments/subscription/history` | subscription + invoices |
| **Reviews** | `marketing/reviews_screen.dart` | `/v1/reviews*` | approve/reply/delete |
| **Form submissions / leads** | `marketing/leads_screen.dart` | `/v1/form-submissions*` | inbox + status |
| **Gift cards** | `discounts/gift_cards_screen.dart` | `/v1/products/gift-cards` | if no mobile-safe contract → `SKIP-NEEDS-BACKEND` |
| **SEO** | extend product form + `settings/seo_*` | per-product + storefront prefs | titles/meta/handle |
| **App marketplace (browse)** | `apps/apps_screen.dart` | `/v1/app-store/apps`, `/installations` | list/browse; **embedded App Bridge = deep-link to web** (ledger DESKTOP-ONLY) |
| **AI Studio** | `ai/ai_screen.dart` | `/v1/ai/*` | credits/usage (+gen if backend ready, else ledger) |

Commit `feat(mobile): P3 growth`. Gates.

## 9. P4 — PARITY POLISH & SCALE

| Item | Build |
|---|---|
| **Multi-store** | `lib/app/store_context.dart` provider + store switcher (`/v1/stores`); replace every `getFirstStore()` |
| **Offline cache** | `lib/services/cache_service.dart` over `hive` (already in `core`); cache-then-network for store/products/orders; read-only offline |
| **Deep links** | adopt `go_router`; routes for push→order, payment-return, share |
| **Accessibility** | WCAG 2.1 AA: touch targets, contrast, semantics labels, focus order |
| **i18n + tokens** | proper `.arb`/intl beyond EN/HI/TA; finish token migration |

Commit `feat(mobile): P4 polish & scale`. Gates.

## 10. P5 — PLATFORM-BLOCKED (build the seam, ledger the backend)

For each of **payouts/settlement, wallet, commission, KYC, returns, 2FA, business details, localization/markets, custom-data (metafields), embedded App Bridge runtime**: build a feature-flagged mobile screen pointing at a typed client stub that throws `SkipNeedsBackendException(<id>)`, and ledger the missing backend contract. **Do not invent the backend. Do not delete `legacy/firebase/`.** Commit `feat(mobile): P5 blocked seams`. Gates.

---

## 11. PER-PHASE VERIFICATION GATES (run before marking a phase DONE + committing)

1. `flutter analyze` clean. 2. `flutter test` green (≥1 test per new service + a widget test per major screen). 3. `flutter build apk --debug --dart-define-from-file=dart-defines/staging.json` + `flutter build ios --no-codesign --dart-define-from-file=dart-defines/staging.json` succeed. 4. `pnpm --filter @letbuyy/mobile-bff typecheck && pnpm --filter @letbuyy/mobile-bff test` (if BFF touched). 5. `node scripts/validate-governance.mjs` green. 6. No `firebase`/`google-services`/raw `0xFF8B5CF6` regressions. 7. Every `SKIP_NEEDS_HUMAN`/`SKIP-NEEDS-BACKEND` has a ledger row. 8. Commit. 9. Update STATUS rows + `RESUME HINT`.

---

## 12. REPORTING (keep live)

- `CODEX_MOBILE_FOUNDATION_STATUS.md` — branch/HEAD, the full §5–§10 feature checklist with per-row status + file evidence + the verification-gate command outputs + a `## RESUME HINT`.
- `CODEX_MOBILE_FOUNDATION_LEDGER.md` — every skip (§4 format) with unblock action + owner.
- Final summary: features moved to DONE, full human checklist, remaining backend gaps.

---

## 13. DEFINITION OF DONE (mission complete only when ALL hold)

1. Every §5–§10 feature row is `DONE`/`DONE-WITH-SKIP` with evidence.
2. A merchant can (staging, or ledgered): **login → create product → receive order → fulfill → refund → manage inventory/customers/discounts → configure shipping/taxes/domain/theme → upgrade plan** from a device through the BFF.
3. Zero Firebase artifacts; zero stray secrets; no raw hardcoded brand hex in screens.
4. Analytics/products/orders read from the gateway only.
5. Theme preview authoritative vs live storefront.
6. CI green (analyze/test/build/governance); real test coverage per service + golden paths.
7. Multi-store, offline read cache, deep links, a11y in place.
8. P5 seams stubbed + ledgered; `legacy/firebase/` intact.
9. STATUS + LEDGER complete; every phase committed; governance green.

---

## 14. EXECUTION ORDER (resume-aware; top to bottom)

1. Read STATUS/LEDGER + the nine docs + relevant live code. Record branch/HEAD. Resume at first non-DONE item.
2. **P0 finish** (§5) → gates → commit.
3. **P1** (§6) → gates → commit. 4. **P2** (§7) → gates → commit. 5. **P3** (§8) → gates → commit. 6. **P4** (§9) → gates → commit. 7. **P5** (§10) → gates → commit.
8. Final governance green + §13 DoD check + final summary. If budget ends anytime: checkpoint (§3.4) and end cleanly.

---

## 15. GUARDRAILS — DO NOT

- ❌ Redo completed P0 items (read STATUS first).
- ❌ Modify `services/api-gateway/**` (Option A = no gateway change) or the operator's pre-existing dirty files (`FORENSIC_REPORT/*`, `infrastructure/*.tf`, etc.).
- ❌ Reintroduce Firebase / a second backend; ❌ call Postgres directly; ❌ put secrets in the app.
- ❌ Fabricate gateway endpoints — missing → `SKIP-NEEDS-BACKEND` + ledger.
- ❌ Delete `legacy/firebase/`.
- ❌ Churn the state lib or rewrite the working core without cause.
- ❌ Leave a phase uncommitted, claim DONE without §11 evidence, or leave governance red.
- ❌ **Stop and wait for, or ask, a human.** Defer via §4, checkpoint via §3, and continue — always.

### One-paragraph recap
Resume from the V1 P0 baseline; close the P0 partials (real Razorpay checkout, full design-token sweep, real tests, a functional Turnstile/OTP auth seam); then build every P1–P5 surface (orders/refunds, customers, inventory+WMS, coupons, push, theme/CMS/media/shipping/taxes/domains/collections/variants, staff/billing/reviews/leads/gift-cards/SEO/apps/AI, multi-store/offline/deep-links/a11y/i18n) as real, typed, token-styled, tested screens over endpoints that already exist — creating the services the app lacks (customer/inventory/coupon/cms/media/domain/staff/push), stubbing only the genuinely platform-blocked capabilities. Commit every phase, keep governance green, log every human-gated item, checkpoint if budget ends, and run the mission to 100% across as many invocations as it takes — never stopping to ask.
