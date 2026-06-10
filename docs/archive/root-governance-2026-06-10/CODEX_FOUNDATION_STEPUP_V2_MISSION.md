<!-- Paste this entire file to Codex as the mission. It is self-contained. -->

# CODEX MISSION — LetBuyy Merchant Mobile Foundation Step-Up (V2 · full-stack · single-go · all 110)

> **Frame:** You are not *building* LetBuyy. You are **completing** it. The architecture, the 237-table schema, the ~48K-LOC Hono gateway, the ~55K-LOC Flutter merchant app, the typed API client, and the core commerce flows already exist. The merchant-mobile audit found that **most of what's "missing" is a missing backend *contract* or a missing *config value* — not a missing screen.** Your job is to finish the wiring and the money/post-purchase lifecycle so a merchant can **log in, get paid, ship orders, process returns, and get a notification from the thing in their pocket** — and to do it in one disciplined pass, P0 → P1 → P2 → P3 → Quality, **without stopping**.
>
> **The danger you are countering:** this repo can reach 100% governance score and 0% merchant success. **Process score ≠ product score.** A green validator that sits on top of an app that can't log in is theater. This mission measures *product*. Every issue closes with real code, a real test, and an honest UI — or an honest, documented `SKIPPED (HUMAN-APPROVAL)` with everything in-code done around it.

---

## 0. Non-negotiables (read first)

1. **FULL-STACK OWNERSHIP, ONE OWNER.** You own the entire merchant-mobile vertical and may create/modify/delete across:
   - `apps/mobile/merchant-app/**` (Flutter app: screens, services, models, routing, dart-defines, tests).
   - `services/mobile-bff/**` (the Hono allowlist proxy — extend the prefix allowlist as new `/v1` surfaces land).
   - `services/api-gateway/src/routes/**` and the relevant middleware/libs — **only the merchant-mobile surfaces** (orders, products/collections, customers, reviews, inventory, analytics, notifications/device-tokens, ai, payments/payouts/kyc, shipping labels/returns, themes, domains, staff, taxes), not unrelated domains.
   - `services/queue-workers/**` (push dispatch, settlement consumers) and `services/webhook-service/**` where a cited issue requires it.
   - `packages/**` — `@letbuyy/shared-types` (canonical DTOs), `@letbuyy/api-client` (Dart + TS), `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/*-core` — **additive, backwards-compatible** changes only.
   - `database/supabase/migrations/**` — **new forward migrations only** (never edit `000_baseline.sql` or any applied migration in place).
   - `docs/**` and the mission ledger/status files you own (§6).
2. **STAY IN THE MERCHANT-MOBILE LANE.** Touch shared packages and the gateway only on the code paths merchant-mobile depends on. Don't refactor unrelated domains (storefront, theme-marketplace internals, identity internals, platform-console) except where a cited issue requires it, and then minimally and additively.
3. **GOVERNANCE IS LAW.** Obey root `AGENTS.md`, each local `AGENTS.md`, and `docs/governance/`. Run the full §9 gate suite after every wave; `node scripts/validate-governance.mjs` (a.k.a. `pnpm run validate:governance`) **must pass** (ignore only a pre-existing `node_modules` "stale artifact" line, which is a local-install artifact). Specifically respected by validators: **single-writer table ownership**, fail-closed internal routes, single-source helpers (INR/date/crypto/logger), route files ≤1500 lines, runtime-manifest honesty, no app→app or package→runtime imports, no tracked secrets/env, no deprecated app aliases.
4. **NEVER BLOCK ON HUMANS.** No prompts, no waiting. If a step needs a human/business/legal decision, a secret/key, a third-party provider account, production data, infra provisioning, a DNS/cert cutover, an app-store submission, or applying a migration to a real environment — mark it `SKIPPED (HUMAN-APPROVAL)` in the ledger with an exact unblock command, **implement every in-code part anyway behind the repo's existing skip mechanism**, and continue. See §5 for the pre-identified catalog.
5. **TRUTH OVER THEATER — the prime directive.** Zero fake data, fake charts, fake metrics, or unconditional badges. **No internal state may leak to a merchant**: never render `SKIP_NEEDS_HUMAN_*`, `SkipNeedsBackendException`, a `PlatformBlocked` ledger code (`S-018`…`S-027`), "needs backend contract", or "coming soon" raw to a user. If a capability isn't ready, either ship the real flow or show an **honest, generic** empty/loading/error state and **hide the control** — never narrate the internal reason. Every chart must be backed by real data; every button must do something or not exist.
6. **GREEN BEFORE DONE.** Every wave ends with typecheck, lint, build, and test passing for **every workspace you touched**, plus `flutter analyze` + `flutter test` for the app, plus `validate-governance.mjs`. New migrations apply cleanly to a **local** Supabase and are reversible. Don't mark an issue `DONE` if anything you touched is red.
7. **EVIDENCE OR IT DIDN'T HAPPEN.** Every closed issue gets a ledger row: layers touched, files changed, how you verified it, and the test/validator result (§6).
8. **NO SCOPE INVENTION.** Implement exactly the **110 issues in §7** (plus correctness defects you discover, logged as `FOUND-###`). Don't wander into refactors no issue requires. Don't add new runtime roots or top-level config without a cited issue (and that would be a SKIP anyway, per AGENTS.md).
9. **DECIDE THE DEFAULT, FLAG THE SIGN-OFF.** Where a choice needs a human only for *confirmation* (e.g. exact carrier, KYC provider, AI model), implement the standard default now from a single source of truth and log the *confirmation* as SKIPPED — never leave a live contradiction or a dead control.
10. **STRICT PRIORITY ORDER.** Waves run P0 → P1 → P2 → P3 → Quality. **Do not start a later wave until the earlier wave's exit gate is green.** Do not jump ahead to shiny P3 features (AI, widgets, watch) while P0/P1 are red. Login, money, fulfillment, returns, and push come first.

---

## 1. Mission context — what you are completing

The merchant app is a **Flutter / Provider** client (`apps/mobile/merchant-app`, 133 files, ~55K LOC, 25+ domains) talking through a **Hono allowlist BFF** (`services/mobile-bff`, 26 path prefixes) to the **Hono api-gateway** (`services/api-gateway`, ~48K LOC, 36 route files) over **Supabase Postgres** (237 tables, RLS), with async work in `services/queue-workers` (real FCM/APNs dispatcher, placeholder creds) and `services/webhook-service`.

**The verdict you are fixing (from the audit):** the app is real and broad, but **(L1) a production build cannot log in** (sentinel Turnstile token + a BFF host pointing at `bff.letbuyy.com` while the deployed worker route is `bff.letbuyy.store`), and **(L2) ~10 commerce-critical domains are hard-blocked at the gateway contract layer** (payouts/settlement, wallet, commission, KYC, returns/RMA, 2FA, business profile, localization, metafields, app-bridge), plus push (broken 3 ways), AI generate/purchase (503), collection edit/delete, and review moderation. Operable mobile coverage today ≈ 50–55%; the goal is 95–100%.

**Authoritative source of truth you MUST read before writing code — issue numbers in §7 match it exactly:**
- `docs/LETBUYY_MERCHANT_MOBILE_MASTER_REPORT.md` — the full audit. Especially **§17 (the 110-issue register)**, **§16 (the P0–P4 roadmap with required APIs/backend/UI per item)**, **§3 (feature inventory with file:line evidence)**, **§4 (web↔mobile parity)**, **§14 (Store Health Center design)**, **§11 (mobile theme-editor strategy)**, **§18 (brutal review)**.
- The mobile blockers it cites with file evidence: `apps/mobile/merchant-app/dart-defines/production.json`, `lib/config/app_config.dart`, `lib/services/store_auth_service.dart`, `lib/services/platform_blocked_service.dart`, `lib/services/skip_needs_backend_exception.dart`, `lib/services/push_service.dart`, `lib/services/{product,order,review,ai_studio}_service.dart`, `lib/screens/analytics/analytics_screen.dart`, `lib/screens/wizard/create_store_wizard.dart`, `lib/screens/main/store_main_screen.dart`.
- The gateway gaps: `services/api-gateway/src/routes/ai.ts` (503 stubs), `routes/products.ts` (collections GET/POST only), `routes/notifications.ts` (no device-token route), `services/mobile-bff/src/index.ts` + `wrangler.toml` (allowlist, host), `services/queue-workers/src/push-dispatcher.ts` (creds).
- Root `AGENTS.md` + each touched workspace `AGENTS.md` + `docs/governance/`. Honor the prior step-up: `CODEX_FOUNDATION_STEPUP_STATUS.md` (locked params: `.com` canonical, India-first, money model, code-only execution).

---

## 2. The insight that makes this finishable in one run

**The bottleneck is the backend contract and the config, not the phone.** The mobile UI is more finished than the API behind it, so the cheapest, highest-leverage work is: **(a)** flip a few sentinels and align one host (P0 is mostly config + one push endpoint — days, not months), and **(b)** add the missing `/v1` gateway routes + matching `@letbuyy/api-client` methods + BFF allowlist entries, then **un-stub the Flutter service that already has the screen**. Three buckets:

- **Bucket A — un-block the front door (do first, cheap):** provision/declare the sentinel config the right way, align the BFF host with the `.store→.com` migration, add `POST/DELETE /v1/notifications/device-tokens` + allowlist + register the token on login, flip the IA to operator-first, persist onboarding steps 1–4.
- **Bucket B — finish the money & post-purchase lifecycle (the spine, new build):** shipping-label purchase, returns/RMA, payouts/settlement/wallet/commission/KYC contracts, taxes-on-mobile, AI provider, 2FA. These are the things merchants actually care about.
- **Bucket C — un-stub what already has a screen, then harden & differentiate:** collections edit/delete, review moderation, analytics charts (data already returned), customer CRM mutations, camera/barcode, Store Health, then P3 differentiation (WhatsApp, AI operator, widgets) and the Quality/robustness debt.

**Rule:** when you add a gateway endpoint, add the matching `@letbuyy/api-client` method (Dart + TS) **and** the BFF allowlist entry **and** un-stub the Flutter service in the same wave, so nothing is left half-wired.

---

## 3. Ownership discipline & single-writer rule (do not break governance)

Full-stack ownership is **not** "edit anything." Validators enforce single-writer table ownership and domain boundaries. Follow these:

1. **One writer per table.** Existing tables are written only by the route/worker that already owns them (`orders`, `products`, `collections`, `store_customers`, `product_reviews`, `inventory_*`, `device_tokens`, `payment_transactions`, …). New tables you add (`merchant_returns`, `return_line_items`, `shipping_labels`, `payout_statements`, `merchant_kyc_documents`, `customer_notes`, `customer_segments`, `merchant_2fa_factors`, `store_metafields`, …) get **one declared writer module**; document ownership where the validator expects it and run the validator.
2. **Migrations are forward-only & reversible.** Add `database/supabase/migrations/NNN_*.sql` (next number after the highest existing). Never edit `000_baseline.sql` or any applied migration. Every new table: PK, FKs, indexes, `update_updated_at()` trigger (that exact name — never `update_updated_at_column()`), and **real RLS** (service-role + owner/`site_id` tenant predicate) — match the modern pattern (e.g. `076_app_extension_registry.sql` / `107`), not blanket `service_role`. Tenant scope uses `site_id → public.sites` (never a new `stores` table; "store" is UI/URL only).
3. **Shared-package changes are additive & backwards-compatible.** `@letbuyy/api-client`, `@letbuyy/shared-types`, `@letbuyy/ui`, `@letbuyy/auth-core` are consumed by other runtimes. Add fields/methods; don't break signatures. New mobile DTOs belong in `@letbuyy/shared-types` — **no app-local hand-rolled `Product`/`Order`/`Customer`/`Payment`/`Theme` DTOs** (AGENTS.md forbids it). A breaking change is `SKIPPED (HUMAN-APPROVAL)` — implement behind a new additive API instead.
4. **Single-source helpers.** Reuse `@letbuyy/ui` formatting (INR/date), the gateway `lib/crypto.ts`, the shared logger, and `@letbuyy/api-client` base-URL helpers. The validator fails on duplicated implementations. No `console.log` in source; no new `any` without an explicit local type.
5. **Worker/route discipline.** Gateway worker surfaces are `/v1/*`; app-exposed proxies use `/api/v1`. Webhook side effects need signature verification + idempotency before mutation. Internal routes fail-closed. Provider SDKs live in `packages/infrastructure` adapters, not inline in routes. Keep route files ≤1500 lines (split if needed).
6. **Generated files.** Never hand-edit `AGENTS.md` or generated topology/intelligence files; regenerate via the script and commit only the diff (§9). After adding `/v1` surfaces, update `services/mobile-bff` allowlist and the runtime manifests the validators check.
7. **Don't revert user-owned dirty work.** The worktree may be dirty; treat it as user-owned (the prior step-up did the same). Stay on the current branch if isolation would collide; log branch/PR creation as a SKIP (§5) per the established pattern.

---

## 4. Execution model (single-go, wave-based, strict priority)

Work top-to-bottom through Waves 0 → 5. Each wave: implement every issue in it across all needed layers (**db → shared package → gateway → api-client → BFF allowlist → Flutter service → Flutter screen → test**), run the §9 gates, commit per issue, update the ledger/status. **Do not reorder priorities and do not start a wave until the prior wave's exit gate is green.** This ordering is the mission's spine: it encodes "finish the front door and the money before the shiny."

- **Wave 0 — Baseline, truth & guardrails (no new merchant capability).** Create ledger/status; baseline gates; build the **honest capability-gate pattern** that replaces every internal-state leak; remove dead scaffolding; reconcile governance docs. Issues: 10, 69, 73, 84, 85, 86, 102.
- **Wave 1 — P0 · Open the front door.** Login works on a prod build, host aligned, secrets declared the right way, operator-first IA, onboarding persists, push delivers end-to-end. Issues: 1–9. **Exit gate: a prod-config build authenticates, lands on an operator home, and registers a device token; new-order push fires in a local/dev harness.**
- **Wave 2 — P1 · Run the operational core.** Shipping labels, returns/RMA, collections edit/delete, review moderation, real analytics charts, logo upload, Store Health v1, customer mutations, dashboard wiring, test-pyramid kickoff. Issues: 11–30. **Exit gate: a merchant can fulfill (label flow present, creds SKIPPED), process a return, moderate a review, edit a collection, see real charts, and open a Health hub — all on mobile.**
- **Wave 3 — P2 · Trust, money & depth.** Payouts/settlement/wallet/commission/KYC contracts + views, 2FA, business profile, taxes-on-mobile, AI provider, camera+barcode, domain SSL/DNS surfacing, embedded app runtime, customer segments/merge, upload-ownership fix, `orders.store_id` NOT NULL, partition cleanup. Issues: 31–50. **Exit gate: a merchant sees a payout (sandbox/dry-run), can complete a KYC flow (provider creds SKIPPED), enroll 2FA, and act on customers.**
- **Wave 4 — P3 · Differentiate & scale.** WhatsApp commerce loop, AI store operator, home-screen widgets, app-icon badge, marketing/email, live view, CSV export, localization, metafields, AI "describe your homepage" generator, responsive preview, video/3D media, COD reconciliation, watch app. Issues: 51–64. **Do not begin until Waves 1–3 gates are green.**
- **Wave 5 — Quality, robustness, governance reconcile & final validation.** Test pyramid, observability + crash reporting, offline/cache, broadened idempotency, RLS/ownership hardening, migration safety, minimal-real reserved services where cited, plus the per-domain robustness long tail. Issues: 65–68, 70, 71, 72, 74–83, 87–101, 103–110. End with the full gate suite + status rollup.

**Commit discipline:** one commit per issue or tight group; message `feat(mobile): #NN <short> [waveN]` / `fix(mobile): …` / `feat(db): #NN <migration> [waveN]` / `feat(gateway): #NN <route> [waveN]`. After route/page/export/topology/schema changes, regenerate repository intelligence and commit only the regenerated `AGENTS.md`/topology diffs (§9) — never hand-edit them.

---

## 5. Skip protocol & the pre-identified human-approval catalog

This repo already has the right mechanism — **reuse it, don't reinvent it**:
- Config secrets use `SKIP_NEEDS_HUMAN_*` sentinels in `dart-defines/*.json` and `wrangler.toml`. Keep that convention; the code path must be fully built and must **degrade honestly** (hide the control / generic empty state) when the sentinel is present — never crash, never show the sentinel.
- Missing backend behavior uses `SkipNeedsBackendException` / `PlatformBlockedService`. As you **build** the real contract for a blocked feature, **remove** its `PlatformBlocked` entry and replace the dead-end screen with the real flow. If only the *provider credential* is missing (not the contract), keep the feature built and gate it behind a sentinel with an honest empty state.
- Protected actions (prod DB apply, secrets, DNS, deploy, app-store submit) are logged as a CLI runbook in the STATUS file, exactly like `CODEX_FOUNDATION_STEPUP_STATUS.md` already does.

When a step needs a human, log this in the ledger and continue:

```
- #NN <title> — SKIPPED (HUMAN-APPROVAL)
  Reason: <secret / provider account / legal / infra / prod migration / deploy>
  Unblock: <exact command or decision a human must provide>
  Done anyway: <every in-code part implemented + how it degrades honestly (sentinel/empty state)>
```

**Pre-identified skips (implement everything except the human bit):**

| Issue(s) | Implement now (in code) | SKIP (needs human) |
|---|---|---|
| #1 Turnstile / #5 Razorpay key / #10 sentinels | Wire the full flow; read keys from env/dart-define; honest "verification unavailable" empty state when sentinel; document each sentinel + its `wrangler secret put` / dart-define command | Issue & install the real Cloudflare Turnstile + Razorpay keys |
| #3 BFF host / #2 site key | Centralize host config; point app + worker route at the **same** host; finish `.store→.com` refs in code | DNS/route/cert cutover (runbook already in STEPUP STATUS) |
| #4 `INTERNAL_API_SECRET` | Keep fail-closed behavior; document provisioning | `wrangler secret put INTERNAL_API_SECRET` per worker/env |
| #6/#7 Push | Build `POST/DELETE /v1/notifications/device-tokens`, BFF allowlist, token registration on login, dispatcher wiring; dry-run path | Real `FCM_*` / `APNS_*` provider credentials |
| #11 Shipping labels | Carrier-adapter interface in `packages/infrastructure`, `/v1/shipping/labels` (rate/buy/void), label PDF→R2, buy/print Flutter flow, sandbox/dry-run | Live carrier (Shiprocket/Delhivery/EasyPost/etc.) account + keys; carrier choice = decide default, flag confirmation |
| #12 Returns/RMA | Full RMA state machine + `/v1/returns`, refund+restock reuse, returns screen replacing PlatformBlocked | none code-side; policy wording = legal SKIP |
| #31–34 Payouts/wallet/commission/KYC | Ledger state machines, `/v1/payouts` + `/v1/kyc` contracts, transfer-adapter interface, sandbox path, statements, KYC capture UI | Live RazorpayX/Route creds + go-live; KYC provider + policy |
| #39/#40 AI generate/purchase | Provider-adapter interface behind `/v1/ai/generate` + `/credits/purchase`; honest "unavailable" when unconfigured | AI provider key + model/budget confirmation |
| #51 WhatsApp / #55 marketing | Provider-adapter (Twilio WA) + templates + flows; honest disabled state | WABA approval, Twilio creds |
| #8/#49/#50/#105 migrations | Write + apply locally; verify reversibility | Applying to staging/prod (runbook) |
| #28-style domain refs, deploys, app-store build | All code refs + build scripts ready | DNS/deploy/app-store submission |

Anything that would (a) break a shared package's existing API, (b) apply a migration to a real environment, (c) touch real secrets/provider accounts, (d) edit root `AGENTS.md` or add a runtime name → **SKIPPED (HUMAN-APPROVAL)**, with the in-code part fully done.

---

## 6. Ledger & status (you create and maintain at repo root)

These three filenames are **already registered** in `scripts/validators/source-ledger-residue-validator.mjs` (this mission file plus the two below) so they pass the residue gate. Keep them current after every wave.

- `CODEX_FOUNDATION_STEPUP_V2_MISSION.md` — this file (the mission).
- `CODEX_FOUNDATION_STEPUP_V2_LEDGER.md` — one row per issue:
  `| #NN | title | wave | layers (db/pkg/gw/client/bff/svc/ui) | status (DONE/PARTIAL/SKIPPED) | files changed | verification (tests/validator) |`
- `CODEX_FOUNDATION_STEPUP_V2_STATUS.md` — rollup after every wave: counts by status, % DONE, open SKIPPED items with exact unblock commands (a "SKIPPED — NEEDS HUMAN" CLI runbook, mirroring the prior step-up STATUS), new tables/migrations added, removed `PlatformBlocked` entries, and the exact gate commands last run + result.

Keep both honest and current. They are the proof the foundation is real, not the validator count.

---

## 7. The full issue register (all 110, by wave, full-stack)

Layers key: **db** = migration/schema · **pkg** = shared package (shared-types/api-client/ui) · **gw** = api-gateway route/middleware · **client** = `@letbuyy/api-client` method (Dart+TS) · **bff** = mobile-bff allowlist/proxy · **svc** = Flutter `*_service.dart` · **ui** = Flutter screen/widget. Issue numbers match `docs/LETBUYY_MERCHANT_MOBILE_MASTER_REPORT.md` §17. Every issue 1–110 appears exactly once under its primary wave (matrix in §7.x). Read the master report row for full evidence before each fix.

### Wave 0 — Baseline, truth & guardrails (no new capability)

First: create the §6 ledger/status, run the §9 baseline, record it in STATUS, and grep/inventory every `SKIP_NEEDS_HUMAN_*` sentinel and every `SkipNeedsBackendException`/`PlatformBlocked` call site.

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 10 | 24 shipped config sentinels | svc/bff/gw | Inventory all `SKIP_NEEDS_HUMAN_*`; for each, confirm the code reads from env/dart-define and degrades honestly; add each to the STATUS provisioning runbook | Greppable list in STATUS; no sentinel value can reach a user-visible string; provisioning runbook complete |
| 73 | Dead-ends shown as internal codes | svc/ui/pkg | Build one **honest capability-gate pattern** (`CapabilityGate` widget + `FeatureAvailability` enum) that renders a generic empty/"not available yet"/desktop-handoff state — never a ledger code. Route every current `PlatformBlockedScreen`/`SkipNeedsBackend` surface through it | No screen renders `S-0NN`, `SkipNeedsBackend`, or "needs backend contract"; reusable gate component exists + widget test |
| 102 | Sentinels/raw error codes leak to UI | svc/ui | Audit all catch/handlers; map internal exceptions → friendly copy via the gate; centralize user-facing error strings | Widget tests assert no internal token appears in any rendered error/empty state |
| 69 | `go_router` declared but unused | pkg/app | Remove the unused dependency from `pubspec.yaml` (or adopt it deliberately if you choose the typed-router path in #70 — pick one, document it) | `pubspec.yaml` has no dead routing dep; `flutter pub get` + analyze clean |
| 84 | Validators measure process, not product | gw/docs | Add/confirm a product-outcome gate (the prior step-up added real gateway/behavioral/contract tests + route-ownership); wire the new mobile tests into it; document in `docs/governance/validator-reality.md` | Readiness signal includes real mobile tests, not just validator count |
| 85 | 100KB+ CODEX ledgers create false confidence | docs | Don't delete history; ensure only active V2 ledger/status/mission files live at root (residue validator); move superseded non-V2 mission files under `docs/archive/` if the validator flags them | Residue validator green; root holds only active files |
| 86 | Overlapping readiness docs | docs | Point all mobile readiness narrative at this mission + the master report as the single source; cross-link from `docs/governance` | One canonical mobile readiness source; no contradictory duplicates |

**Wave 0 exit gate:** full §9 suite green on a clean baseline; honest capability-gate pattern exists and is unit-tested; residue + governance validators pass.

### Wave 1 — P0 · Open the front door

*Exit criteria: a prod-config build authenticates, reaches an operator-first home, registers a device token, and receives a new-order push in a local/dev harness. Most of this is config + one push endpoint.*

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 1 | Prod sign-in throws on Turnstile sentinel | svc/ui | Make sign-in read the Turnstile token from dart-define/env; when sentinel/absent, **don't throw** — render an honest "verification temporarily unavailable" state and allow the documented dev path; wire the real token via dart-define | A build with a real token logs in; a sentinel build shows honest state, never crashes; **SKIP**: real key issuance |
| 2 | Turnstile site key sentinel | svc | Same treatment for `TURNSTILE_SITE_KEY`; centralize in `app_config.dart` | No hard dependency on sentinel; **SKIP**: real site key |
| 3 | App host ≠ deployed worker route | svc/bff/infra | Centralize BFF host; point app (`app_config.dart`, `production.json`) and `services/mobile-bff/wrangler.toml` route at the **same** host; finish `.store→.com` code refs per locked `.com` decision | App base URL and worker route match; platform-domain-literal validator green; **SKIP**: DNS/route cutover |
| 4 | Authed requests 500 without `INTERNAL_API_SECRET` | bff/gw | Keep fail-closed; document provisioning; add a clear local-dev value path | Local/dev authed requests succeed; **SKIP**: prod `wrangler secret put` |
| 5 | `RAZORPAY_KEY_ID` sentinel in prod | svc/ui | Payments-connect reads key from config; honest disabled state when sentinel | Connect flow works with a real key; honest state otherwise; **SKIP**: real key |
| 6 | Device-token registration throws | db/gw/client/bff/svc | Implement `POST/DELETE /v1/notifications/device-tokens` (writes existing `device_tokens` table, tenant-scoped); add `@letbuyy/api-client` methods; add the prefix to the BFF allowlist; un-stub `push_service.dart` to register on login + permission prompt + token refresh | Token persists to `device_tokens`; un-stubbed `push_service`; gateway test + Flutter service test |
| 7 | No FCM/APNs credentials | infra/svc | Dispatcher code already real in `queue-workers`; add a dry-run/log path so dispatch is exercised locally; document creds | Dispatch exercised in dry-run; **SKIP**: real `FCM_*`/`APNS_*` creds |
| 8 | Onboarding steps 1–4 not saved | db/gw/client/svc/ui | Persist business type/channels/product type/category — extend store-create or add an onboarding metadata endpoint + migration; wire the TODO in `create_store_wizard.dart` | Steps 1–4 survive reload; round-trip test; local migration reversible |
| 9 | Operator surfaces buried under Settings | ui | Reframe bottom nav → **Home / Orders / Products / Customers / More**; demote Editor/Theme into More (or a Design entry) | New nav shipped; Orders/Customers/Analytics reachable in ≤1 tap; widget test |

**Wave 1 exit gate:** prod-config build logs in (honest state when keys are sentinels), operator-first IA live, device token registers, push fires in dry-run, onboarding persists. Gates green.

### Wave 2 — P1 · Run the operational core

*Exit criteria: fulfill (label flow present), returns, review moderation, collection edit/delete, real charts, logo upload, Store Health v1 — all working on mobile.*

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 11 | No buy/print shipping label | db/pkg/gw/client/bff/svc/ui | Carrier-adapter interface in `packages/infrastructure`; `/v1/shipping/labels` (rate, buy, void); label PDF→R2; buy-label Flutter flow (package/weight/carrier/print-share); sandbox/dry-run | Label flow end-to-end against sandbox; **SKIP**: live carrier account/keys (decide default carrier, flag confirmation) |
| 12 | Returns/RMA blocked (S-022) | db/pkg/gw/client/bff/svc/ui | New `merchant_returns`+`return_line_items` tables; RMA state machine `/v1/returns` (create/approve/refund/restock) reusing existing refund + inventory; replace `PlatformBlocked` returns screen with the real flow | Create→approve→refund→restock works; PlatformBlocked S-022 removed; tests |
| 13 | No order editing | gw/client/svc/ui | `PATCH /v1/orders/:id/line-items` (add/remove/qty), totals rebuilt server-side (never trust client totals); edit UI | Edit recomputes totals server-side; contract test |
| 14 | No draft orders | db/gw/client/svc/ui | Draft-order create/convert endpoint + UI | Draft creates and converts to order; test |
| 15 | Packing slip / print "coming soon" | gw/svc/ui | Server-rendered packing-slip PDF; print/share from order detail | PDF generates from real order; replaces snackbar |
| 16 | Collection edit/delete dead-end (S) | gw/client/svc | `PATCH/DELETE /v1/products/collections/:id`; un-stub `product_service.dart:219–228` | Edit + delete persist; PlatformBlocked removed; contract test |
| 17 | Product export "coming soon" | gw/svc/ui | `/v1/export` products (CSV); download/share | Real CSV from catalog; replaces snackbar |
| 18 | Review approve/reject blocked | gw/client/svc/ui | `PATCH /v1/reviews/:id` status; un-stub `reviews_screen.dart:513` | Moderation persists; test |
| 19 | No merchant review reply | db/gw/client/svc/ui | `POST /v1/reviews/:id/reply`; reply UI | Reply persists + renders on storefront contract; test |
| 20 | Leads status mutate blocked | gw/client/svc | Status-update route for form submissions; un-stub | Lead status persists; test |
| 21 | Analytics charts are placeholders | svc/ui | Render real series with `fl_chart`; ensure analytics endpoint returns monthly buckets; remove "Charts coming soon" | Charts show real data; honest empty state when no data; widget test |
| 22 | Traffic sources placeholder | ui | Hide the panel honestly until the analytics pipeline exists (#83), not a fake placeholder | No fake panel; honest empty state |
| 23 | Logo upload "coming soon" | gw/svc/ui | Reuse `/v1/upload`; un-stub logo picker (library + camera) | Logo uploads + persists; replaces snackbar |
| 24 | Revenue chart fed scalar not series | svc/ui | Feed time-series to the dashboard chart | Dashboard chart uses series; test |
| 25 | Notification bell is a no-op | ui | Wire bell → in-app notification center (#90) or notifications screen | Bell navigates; no empty `onPressed` |
| 26 | No Store Health Center | gw/client/svc/ui | Build §14 v1: scoring engine over already-wired signals (launch readiness, inventory, orders, domain, reviews), each deep-linking to its fix; degrade gracefully for not-yet-wired pillars | Health hub renders a real score from real signals; test |
| 27 | Customers read-only | db/gw/client/svc/ui | `PATCH /v1/customers/:id`, notes, tags endpoints + tables; edit/notes/tags UI | Edit/notes/tags persist; tests |
| 28 | No way to contact a customer | gw/client/svc/ui | "Email customer" action via existing email path; (WhatsApp is #51) | Email sends via real path; test |
| 29 | 55K LOC, 3 model tests | app | Stand up the test pyramid: widget tests for new flows, mocked-HTTP service tests, golden tests for key screens — start here, continue in Wave 5 | New Wave-2 flows have widget+service tests; `flutter test` count rises materially |
| 30 | Quick actions show snackbars | ui | Replace dashboard quick-action snackbars with real navigation | Every quick action navigates; widget test |

**Wave 2 exit gate:** fulfill/label/returns/review-moderation/collection-edit/charts/logo/Health all functional on mobile; no `PlatformBlocked` for returns/collections/reviews; gates green.

### Wave 3 — P2 · Trust, money & depth

*Exit criteria: payout visibility (sandbox), KYC flow (creds SKIPPED), 2FA, and customer CRM basics all work on mobile.*

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 31 | Payouts/settlement blocked (S-018) | db/pkg/gw/client/svc/ui | `payout_statements` + ledger state machine (`pending→processing→released/failed`); `/v1/payouts`; transfer-adapter interface; sandbox/dry-run; replace PlatformBlocked with payout list/detail | Payout list/detail from real ledger (sandbox); S-018 removed; **SKIP**: live RazorpayX/Route creds |
| 32 | Wallet blocked (S-019) | db/gw/client/svc/ui | Wallet ledger + balance contract `/v1/wallet`; balance/ledger UI | Balance/ledger render; S-019 removed |
| 33 | Commission blocked (S-020) | db/gw/client/svc/ui | Commission schedule + reconciliation contract; UI | Commission view real; S-020 removed |
| 34 | KYC blocked (S-021) | db/pkg/gw/client/svc/ui | KYC doc/verification/provider-status contract `/v1/kyc`; camera capture + status UI; provider-adapter interface | KYC capture→status flow works; S-021 removed; **SKIP**: KYC provider + policy |
| 35 | 2FA/passkey blocked (S-023) | db/gw/client/svc/ui | `merchant_2fa_factors`; enroll/verify/session contract; enroll+verify UI | TOTP/passkey enroll+verify works; S-023 removed; tests |
| 36 | Business profile blocked (S-024) | db/gw/client/svc/ui | Full business-profile + invoice-address contract on store PATCH; UI | Profile persists; S-024 removed |
| 37 | Taxes blocked on mobile (web has it) | gw/client/svc/ui | Expose existing tax contract to mobile; tax settings/rates UI | Tax CRUD on mobile; parity with web |
| 38 | No payout visibility | svc/ui | Surface "what/when paid" from #31 on dashboard + Health | Next-payout visible on home |
| 39 | `/v1/ai/generate` returns 503 | pkg/gw/client/svc | Provider-adapter behind `/v1/ai/generate`; un-stub generation; honest "unavailable" when unconfigured | Generation works with a key; honest state otherwise; **SKIP**: AI provider key |
| 40 | `/v1/ai/credits/purchase` 503 | gw/client/svc/ui | Real purchase path; gate UI on capability (don't show credits next to a dead button) | Purchase works with provider; UI gated; **SKIP**: provider |
| 41 | No camera capture | svc/ui | `image_picker` camera source for product/logo media | Camera capture uploads; test |
| 42 | No barcode scanning | pkg/svc/ui | `mobile_scanner`; assign barcode + inventory adjust by scan; catalog lookup | Scan assigns/adjusts; test |
| 43 | No SSL/DNS/renewal visibility | gw/client/svc/ui | Expose SSL/DNS status + records (web already shows records); domain health panel feeding #26 | DNS/SSL/renewal visible; Health pillar lights up |
| 44 | No embedded app runtime (S-027) | gw/pkg/svc | Signed native extension-host/App-Bridge contract; in-app webview runtime | Installed app runs in-app (basic bridge); S-027 removed (or honest external-open if bridge SKIPPED) |
| 45 | Apps open as external URL only | svc/ui | Prefer embedded runtime (#44); keep honest external fallback | Embedded where possible; honest fallback |
| 46 | No customer segments | db/gw/client/svc/ui | Segment query contract + builder UI | Segments create/apply; test |
| 47 | No customer merge/delete | gw/client/svc/ui | Merge/delete endpoints + UI with confirmation | Merge/delete work; test |
| 48 | `/v1/upload` DELETE lacks ownership check | gw | Add tenant/ownership verification to upload DELETE | Cross-tenant delete rejected; security test |
| 49 | `orders.store_id`/`site_id` nullable | db | Forward migration: backfill + NOT NULL + tenant index (additive, reversible, local-only apply) | Columns NOT NULL locally; reversible; **SKIP**: prod apply |
| 50 | Partitioned shadow tables inert | db | Either finish the swap or drop the inert `*_partitioned` shadows (079–083); document decision | No misleading inert tables; migration reversible; **SKIP**: prod apply |

**Wave 3 exit gate:** money surfaces (payouts/wallet/commission) render from real ledgers in sandbox; KYC + 2FA + business profile + taxes + customer CRM work; the listed `PlatformBlocked` codes are removed; gates green.

### Wave 4 — P3 · Differentiate & scale *(do not start until Waves 1–3 gates are green)*

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 51 | WhatsApp commerce loop | pkg/gw/client/svc/ui | Twilio-WA provider-adapter; order/shipping/abandoned-cart templates; inbound replies → customer timeline | Templated sends + inbound capture work in sandbox; **SKIP**: WABA approval + Twilio creds |
| 52 | AI store operator | pkg/gw/client/svc/ui | Tool-calling agent over gateway actions (create product, draft discount, answer metrics, edit section); from-any-screen assistant | Agent completes ≥3 real actions; **SKIP**: provider key |
| 53 | Home-screen widgets | app | iOS WidgetKit + Android widgets reading a metrics endpoint | Widgets show real metrics |
| 54 | App-icon order badge | app/svc | iOS badge = open-order count (tie to push #6) | Badge reflects open orders |
| 55 | Marketing/email (web also lacks) | db/gw/client/svc/ui | Campaign/audience contracts + composer | Campaign create/send in sandbox; **SKIP**: send provider |
| 56 | No Live View | gw/client/svc/ui | Real-time traffic endpoint (depends on #83) + view | Live View renders when pipeline exists; honest empty otherwise |
| 57 | No CSV export on mobile | gw/svc/ui | Orders/customers CSV export/share | Real CSV exports |
| 58 | Localization/markets (S-025) | db/gw/client/svc/ui | Storefront markets/locale-publishing/translation contract; UI | Locale/market CRUD; S-025 removed; **SKIP**: EU legal |
| 59 | Metafields/custom data (S-026) | db/gw/client/svc/ui | Metafield definition/value contract; UI | Metafields CRUD; S-026 removed |
| 60 | AI "describe your homepage" generator | pkg/gw/client/svc/ui | Mobile-first section/theme generator (beats Shopify desktop-only) over the existing editor | Prompt→sections works; **SKIP**: provider |
| 61 | No responsive preview toggle | ui | Mobile/desktop viewport switch in editor preview | Toggle works in live preview |
| 62 | No video/3D media | gw/svc/ui | Media pipeline for video; upload/preview | Video uploads + previews |
| 63 | No COD reconciliation (India) | db/gw/client/svc/ui | COD ledger + reconciliation flow | COD reconciles in sandbox |
| 64 | No Apple Watch app | app | WatchKit metrics (sessions/sales/orders) | Watch shows real metrics |

### Wave 5 — Quality, robustness, governance reconcile & final validation

| # | Issue | Layers | Action | Acceptance |
|---|---|---|---|---|
| 65 | No widget tests | app | Widget tests across core flows | Coverage materially up |
| 66 | No integration/E2E tests | app | `integration_test`/Patrol happy-path E2E | E2E for login→order→fulfill |
| 67 | No mocked-HTTP service tests | app | Mock the api-client; test every `*_service` | Each service has tests |
| 68 | No golden/screenshot tests | app | Goldens for key screens | Goldens in CI |
| 70 | Routing hand-rolled in one switch | app | Typed router (or finalize #69 decision) | Centralized typed routing; test |
| 71 | No offline/cache layer | svc | Cache + offline read for list/detail | Reads survive offline; test |
| 72 | Idempotency only on refund | gw/svc | Broaden idempotency keys to all mutations | Mutations idempotent; contract test |
| 74 | App emits no telemetry | app/pkg | Product analytics spine (events for key actions) | Events emitted; sink wired |
| 75 | No crash reporting | app | Crashlytics/Sentry integration | Crashes reported in dev; **SKIP**: prod DSN |
| 76 | No image caching | app | `cached_network_image` for product media | Images cached; test |
| 77 | No accessibility pass | app | WCAG/semantics pass on core screens | a11y audit notes + fixes |
| 78 | Gateway relies on ~208 hand-written ownership checks | gw/db | Centralize ownership helper; tighten RLS where feasible (additive) | Fewer ad-hoc checks; security tests |
| 79 | RLS anon-readable until 107 | db | Verify 107 fixes deployed locally; regression test | RLS regression test green; **SKIP**: prod verify |
| 80 | Payment verify was forgeable (fixed, must deploy) | gw | Confirm fix in code + anti-replay; test | Replay/binding test green; **SKIP**: prod deploy |
| 81 | Migrations without `IF NOT EXISTS` (076,093,095–098) | db | Make new migrations replayable; document legacy | New migrations replayable |
| 82 | 6 reserved services are placeholders | svc | Build minimal-real versions only where a mobile issue needs (e.g. notification path); else leave honestly reserved | No fake "service"; cited needs covered |
| 83 | No storefront session analytics | svc/db | Minimal-real `analytics-pipeline`: storefront beacon + sessions/sources reporting (unlocks #22/#56) | Sessions/sources reportable; honest until then |
| 87 | No sample/demo data | gw/svc | Seed a clearly-labeled sample product for empty stores | Honest sample seed; never fake metrics |
| 88 | Several CTAs are no-ops | ui | Wire every remaining dead control | No empty handlers; widget tests |
| 89 | Deep screens re-fetch (no cache) | svc | Shared cache layer (with #71) | Cached reads; test |
| 90 | No in-app notification center | gw/client/svc/ui | Notification inbox (pairs with #25) | Inbox lists real notifications |
| 91 | No product metadata/tags UI | gw/svc/ui | Tags/metadata on product form | Tags persist; test |
| 92 | Import lacks progress feedback | svc/ui | Progress/result UX for product import | Progress shown; test |
| 93 | No fraud/risk signal on orders | gw/svc/ui | Surface risk if available | Risk shown when present |
| 94 | Cancel only via status | gw/svc/ui | Dedicated cancel flow + reason | Cancel works; test |
| 95 | No customer creation on mobile | gw/client/svc/ui | Create-customer endpoint + UI | Create works; test |
| 96 | No date-range comparison in analytics | svc/ui | Period compare | Compare renders |
| 97 | Buy-domain checkout unverified | gw/svc/ui | Verify/complete domain purchase e2e | Purchase path verified (sandbox) |
| 98 | Theme rollback presence unverified | svc/ui | Confirm/expose rollback action | Rollback works; test |
| 99 | No dunning/failed-payment recovery | gw/svc/ui | Failed-payment recovery UX | Recovery flow works |
| 100 | Store-details save lacks validation depth | svc/ui | Harden validation + feedback | Validation enforced; test |
| 101 | Limited locales vs Shopify's 7 | app | Expand l10n coverage | More locales; (ties #58) |
| 103 | Pagination unverified at scale | svc/gw | Confirm keyset pagination on lists | Large-list pagination test |
| 104 | No session expiry/refresh UX | svc/ui | Handle expiry + silent refresh | Expiry handled gracefully; test |
| 105 | `order_items` no own tenant column | db | Add tenant scoping additively (local apply) | Scoped + reversible; **SKIP**: prod apply |
| 106 | Push failure is silent | svc/gw | Alert/log on push dispatch failure | Failures observable |
| 107 | Credits shown but unusable | svc/ui | Gate AI UI on real capability (with #40) | No dead credit UI |
| 108 | App permissions view partial | svc/ui | Full permission display for installed apps | Permissions complete |
| 109 | No multi-staff edit conflict handling | gw/svc | Optimistic-lock/conflict handling for editor | Conflicts handled; test |
| 110 | No CI gate tying validators to the fixes | gw/ci | Wire the new mobile tests into the merge gate | CI runs mobile tests as blockers |

**Wave 5 exit gate:** test pyramid in place; observability + crash reporting wired; RLS/idempotency/migration debt addressed; reserved services either minimal-real (where cited) or honestly reserved; full §9 suite green; STATUS rollup complete.

### 7.x — Coverage matrix (every issue 1–110 → primary wave)

| Wave | Issues |
|---|---|
| 0 — Truth/guardrails | 10, 69, 73, 84, 85, 86, 102 |
| 1 — P0 front door | 1, 2, 3, 4, 5, 6, 7, 8, 9 |
| 2 — P1 operational core | 11–30 |
| 3 — P2 trust/money | 31–50 |
| 4 — P3 differentiate | 51–64 |
| 5 — Quality/hardening | 65, 66, 67, 68, 70, 71, 72, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 103, 104, 105, 106, 107, 108, 109, 110 |

All 110 issues appear exactly once. Any defect you discover that isn't listed → log as `FOUND-###` in the ledger and fix it in the wave that owns its domain.

---

## 8. File-level change map (where the work lands)

- **DB** — `database/supabase/migrations/NNN_*.sql` (forward-only): `merchant_returns`, `return_line_items`, `shipping_labels`, `payout_statements`, `wallet_ledger`, `commission_schedules`, `merchant_kyc_documents`, `merchant_2fa_factors`, `customer_notes`, `customer_tags`, `customer_segments`, `store_metafields`, onboarding metadata, `orders` tenant NOT NULL (#49), `order_items` tenant (#105). Real RLS + `update_updated_at()` triggers on each.
- **Gateway** — `services/api-gateway/src/routes/`: `notifications.ts` (device-tokens), `products.ts` (collections PATCH/DELETE), `reviews.ts` (status + reply), `ai.ts` (provider behind generate/purchase), `orders.ts` (edit/draft/cancel/packing-slip), new `returns.ts`, `shipping-labels.ts`, `payouts.ts`, `wallet.ts`, `kyc.ts`, `customers.ts` (mutations/segments/merge), `taxes` exposure, `upload.ts` (ownership on DELETE, #48), `metafields`, `markets`. Middleware/libs: ownership helper (#78), idempotency (#72), rate limits. Keep each route file ≤1500 lines.
- **Provider adapters** — `packages/infrastructure/**`: carrier (labels), payout transfer, KYC, AI, WhatsApp/Twilio, push (existing). Sandbox/dry-run paths; real creds are SKIPPED sentinels.
- **Shared packages** — `@letbuyy/shared-types` (new DTOs — canonical, not app-local), `@letbuyy/api-client` (Dart + TS methods for every new `/v1` surface), `@letbuyy/ui` (CapabilityGate, charts, formatting reuse).
- **BFF** — `services/mobile-bff/src/index.ts` allowlist: add every new `/v1` prefix (device-tokens, returns, shipping/labels, payouts, wallet, kyc, metafields, markets, …) and align the host route (#3).
- **Queue-workers** — push dispatch dry-run/observability (#7/#106), settlement consumer (#31).
- **Flutter** — `apps/mobile/merchant-app/lib/`: un-stub `push_service`, `product_service`, `review_service`, `ai_studio_service`; replace `platform_blocked_service`/`PlatformBlockedScreen` surfaces with real flows or the `CapabilityGate`; new screens (returns, labels, payouts, KYC, 2FA, segments, Health hub, notification inbox); `store_main_screen` IA; `create_store_wizard` onboarding save; `analytics_screen` real charts; `app_config`/`dart-defines` host+sentinel handling; `test/` pyramid.
- **Docs** — this mission + ledger + status at root; `docs/governance/validator-reality.md` update; archive superseded non-V2 mission files under `docs/archive/` if the residue validator flags them.

---

## 9. Definition of Done & green gates

An issue is **DONE** only when: every layer it needs is implemented; it degrades honestly if a SKIPPED dependency is unmet (sentinel/empty state, never a leaked code); the ledger row is filled (layers + files + verification); and all gates below pass for every workspace you touched. The full repo gate suite (matching the prior step-up):

```bash
# TypeScript / services
pnpm turbo typecheck
cd services/api-gateway && npx tsc --noEmit && cd -
pnpm lint
pnpm run test:unit:gateway
pnpm run test:behavioral
pnpm run test:contracts
pnpm turbo test

# Flutter (the app under audit)
flutter analyze apps/mobile/merchant-app
flutter test apps/mobile/merchant-app

# Migrations: apply to a LOCAL supabase and verify reversibility (NEVER staging/prod — that's SKIPPED)

# Governance — MUST pass after every wave (ignore only a pre-existing node_modules "stale artifact" line)
node scripts/validate-governance.mjs        # a.k.a. pnpm run validate:governance

# After route/page/export/topology/schema changes: regenerate intelligence, commit only the generated diffs
node scripts/generate-repository-intelligence.mjs   # if present in this repo
```

The **mission is complete** when: every issue 1–110 is `DONE` or `PARTIAL` with a precise `SKIPPED (HUMAN-APPROVAL)` note; the §6 ledger and status are current; all touched-workspace gates are green; `flutter analyze`/`flutter test` pass; `validate-governance.mjs` passes; every removable `PlatformBlocked`/`SkipNeedsBackend` dead-end is either a real flow or an honest CapabilityGate; no internal token (`SKIP_NEEDS_HUMAN_*`, `S-0NN`, "needs backend") can reach a user; and `CODEX_FOUNDATION_STEPUP_V2_STATUS.md` shows the rollup (counts, % DONE, open SKIPPED items with unblock commands, new tables/migrations, removed PlatformBlocked codes).

---

## 10. First actions (do these now, in order)

1. **Read** `docs/LETBUYY_MERCHANT_MOBILE_MASTER_REPORT.md` (esp. §3, §4, §11, §14, §16, §17, §18), root `AGENTS.md`, each touched workspace `AGENTS.md`, `docs/governance/`, and `CODEX_FOUNDATION_STEPUP_STATUS.md` (locked params).
2. **Create** `CODEX_FOUNDATION_STEPUP_V2_LEDGER.md` and `CODEX_FOUNDATION_STEPUP_V2_STATUS.md` at repo root (already allowlisted in the residue validator). Inventory every `SKIP_NEEDS_HUMAN_*` sentinel and every `SkipNeedsBackendException`/`PlatformBlocked` call site.
3. **Baseline:** run the §9 gates once across the workspaces you expect to touch; record the clean baseline in STATUS.
4. **Execute Wave 0** end-to-end (ledger/status, honest CapabilityGate pattern, dead-dep removal, governance reconcile), commit per issue, update ledger/status, re-run gates + `validate-governance.mjs`.
5. **Proceed Waves 1 → 5 in strict order, without stopping.** For each issue: db → shared package → gateway → api-client → BFF allowlist → Flutter service → Flutter screen → test. Mark SKIPPED where §5 says, with the in-code part fully done. Never leave theater, a leaked internal code, or a dead control behind. Do not begin Wave 4 (P3) until Waves 1–3 exit gates are green.

> **The foundation is strong when a merchant can, from the phone:** log in on a production build, finish store setup, get a push the instant an order lands, fulfill it and buy a label, process a return, see real charts and a Store Health score, know when they'll be paid, finish KYC, and turn on 2FA — **with no fake data and no internal state leaking into the UI.** Build toward the master report's §16 roadmap. Finish LetBuyy. Decide the default, flag the sign-off, and do not block.




