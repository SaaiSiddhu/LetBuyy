# LetBuyy Merchant Mobile Foundation Step-Up V2 Status

## Current Phase

- Wave: 5 - Quality/hardening complete. Issues #1-#110 are closed as DONE or SKIPPED (HUMAN-APPROVAL), with #110 tying merchant-mobile analyze/tests into the merge safety gate.
- Next issue: none. Final sweep is complete; merchant-mobile, gateway, behavioral/contract, turbo test, and governance gates are green. Repo-wide `pnpm lint` remains blocked by unrelated pre-existing marketing-site lint errors outside the merchant-mobile lane.
- Branch/worktree: current branch retained because the repository already contains extensive unrelated dirty and untracked work.
- Isolation: no stash, reset, checkout, or revert performed. Existing changes are treated as user-owned.
- Mission file: `CODEX_FOUNDATION_STEPUP_V2_MISSION.md` exists at repo root.
- Ledger: `CODEX_FOUNDATION_STEPUP_V2_LEDGER.md` created with all 110 issues present.

## Baseline Inventory

Source inventory command set:

- `rg -n "SKIP_NEEDS_HUMAN_[A-Z0-9_]+" apps/mobile/merchant-app services/mobile-bff services/api-gateway services/queue-workers services/webhook-service config docs CODEX_FOUNDATION_STEPUP_STATUS.md`
- `rg -n "SkipNeedsBackendException|PlatformBlocked|platformBlocked|S-0[0-9]{2}|needs backend contract|needs a backend contract|coming soon" apps/mobile/merchant-app/lib apps/mobile/merchant-app/test`
- `rg -n "go_router" apps/mobile/merchant-app`

Active code/config sentinels found:

- `apps/mobile/merchant-app/lib/config/app_config.dart`: `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN`, `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY`, `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN`.
- `apps/mobile/merchant-app/dart-defines/production.json`: `SKIP_NEEDS_HUMAN_PRODUCTION_RAZORPAY_KEY_ID`, `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN`, `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY`, `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN`.
- `apps/mobile/merchant-app/dart-defines/staging.json`: `SKIP_NEEDS_HUMAN_STAGING_RAZORPAY_KEY_ID`, `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN`, `SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_SITE_KEY`, `SKIP_NEEDS_HUMAN_MOBILE_SENTRY_DSN`.
- `services/mobile-bff/src/index.ts`: fail-closed `INTERNAL_API_SECRET` placeholder detection remains internal only; missing-secret responses now use generic merchant-safe service-unavailable copy.
- `services/queue-workers/src/push-dispatcher.ts`: `SKIP_NEEDS_HUMAN_PUSH_FCM_PROJECT_ID`, `SKIP_NEEDS_HUMAN_PUSH_FCM_CLIENT_EMAIL`, `SKIP_NEEDS_HUMAN_PUSH_FCM_PRIVATE_KEY`, `SKIP_NEEDS_HUMAN_PUSH_APNS_KEY_ID`, `SKIP_NEEDS_HUMAN_PUSH_APNS_TEAM_ID`, `SKIP_NEEDS_HUMAN_PUSH_APNS_PRIVATE_KEY`, `SKIP_NEEDS_HUMAN_PUSH_APNS_BUNDLE_ID`.
- `services/queue-workers/wrangler.toml`: repeated push provider placeholders for default, staging, and production environments.
- `services/api-gateway/wrangler.toml` and `config/env/production.env.example`: `SKIP_NEEDS_HUMAN_AI_PROVIDER_MODEL`, `SKIP_NEEDS_HUMAN_AI_PROVIDER_API_KEY`, `SKIP_NEEDS_HUMAN_AI_CREDIT_RAZORPAY_KEY_ID`, and `SKIP_NEEDS_HUMAN_AI_CREDIT_RAZORPAY_KEY_SECRET`.
- `services/api-gateway/wrangler.toml` and `config/env/templates/worker.env.example`: `SKIP_NEEDS_HUMAN_WHATSAPP_WEBHOOK_SECRET`, `SKIP_NEEDS_HUMAN_TWILIO_ACCOUNT_SID`, `SKIP_NEEDS_HUMAN_TWILIO_AUTH_TOKEN`, and `SKIP_NEEDS_HUMAN_TWILIO_WHATSAPP_FROM`.

Active blocked/dead-end UI/service surfaces found:

- `apps/mobile/merchant-app/lib/screens/platform/platform_blocked_screen.dart` now renders generic `CapabilityGate` copy, not feature flags, backend-contract language, or ledger IDs.
- `apps/mobile/merchant-app/lib/services/platform_blocked_service.dart` now has an empty platform-blocked feature inventory after #59 removed custom data/metafields `S-026`.
- `apps/mobile/merchant-app/lib/services/skip_needs_backend_exception.dart` still exists for internal service control flow; merchant UI sanitizes it through generic copy.
- `apps/mobile/merchant-app/lib/services/app_marketplace_service.dart`: embedded app bridge now returns a signed mobile runtime session; unavailable/unsupported installations render generic copy and keep an external-open fallback.
- Barcode scanning no longer uses a backend-skip seam: product/variant barcode lookup and scanned inventory adjustment route through real gateway/client contracts with generic merchant-safe not-found/error copy.
- Product collections, review moderation/replies, AI generation, and AI credit purchase no longer throw backend-skip exceptions.

Routing dependency finding:

- `go_router` is declared in `apps/mobile/merchant-app/pubspec.yaml`.
- `apps/mobile/merchant-app/lib/app/deep_link_router.dart` imports `go_router`; the dependency is no longer strictly unused, so issue #69 requires either adopting it deliberately or documenting that it is used only for deep links.

## Gate State

Baseline gate execution completed on 2026-06-08 before merchant-mobile Wave 0 capability changes.

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | PASS | Required one scoped style-token cleanup in `apps/storefront-runtime/src/app/preview/coming-soon/page.tsx`; warnings remain pre-existing. |
| `pnpm run test:unit:gateway` | PASS | Reran with sandbox escalation for `tsx` IPC; 53/53 tests. |
| `pnpm run test:behavioral` | PASS | 467/467 tests. |
| `pnpm run test:contracts` | PASS | Reran with sandbox escalation for `tsx` IPC; 194/194 tests. |
| `pnpm turbo test` | PASS | Reran with sandbox escalation for `tsx` IPC; 67/67 tasks. Required fixing the dirty `@letbuyy/ui` overlay focus-trap regression. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app` | PASS | Reran with sandbox escalation for Flutter SDK cache lock; 74/74 tests. |
| `node scripts/generate-mobile-tokens.mjs --check` | PASS | Promoted to `node scripts/generators/generate-mobile-tokens.mjs --check` to satisfy tooling governance; drift check clean. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing local generated artifacts and promoting the mobile-token generator under `scripts/generators/`. |

Baseline cleanup performed:

- Removed generated local artifacts reported by the stale-artifact validator: nested `.turbo`, `.next`, `.dart_tool`, `.wrangler`, `dist`, and nested `node_modules` directories under apps/packages/services.
- Promoted untracked `scripts/generate-mobile-tokens.mjs` to `scripts/generators/generate-mobile-tokens.mjs` and updated references.
- Fixed `@letbuyy/ui` overlay portal focus activation so Drawer/Modal focus traps run after the portal node mounts and outside focusable descendants become inert.

Wave 0 implementation completed on 2026-06-08.

Closed issues:

- #10 Shipped config sentinels: inventoried active sentinels and recorded provisioning runbook; merchant UI now maps sentinel/backend details to generic copy.
- #69 `go_router` declared but unused: retained deliberately because `apps/mobile/merchant-app/lib/app/deep_link_router.dart` imports it; documented the finding instead of removing a live dependency.
- #73 Dead-ends shown as internal codes: added reusable `CapabilityGate` and routed `PlatformBlockedScreen` through merchant-safe desktop-handoff copy.
- #84 Validators measure process, not product: updated `docs/governance/validator-reality.md` with the mobile product gate and canonical V2 readiness sources.
- #85 Large CODEX ledgers create false confidence: active V2 mission/ledger/status are the root source; residue and governance validators pass.
- #86 Overlapping readiness docs: governance note now points mobile readiness to the active V2 mission/ledger/status and master report.
- #102 Sentinels/raw error codes leak to UI: centralized merchant-safe exception text and capability-gate sanitization; Turnstile sentinel copy is generic.

Wave 0 implementation verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks after Wave 0 code changes. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `pnpm run test:unit:gateway` | PASS | Reran with sandbox escalation for `tsx` IPC; 53/53 tests. |
| `pnpm run test:behavioral` | PASS | 467/467 tests. |
| `pnpm run test:contracts` | PASS | Reran with sandbox escalation for `tsx` IPC; 194/194 tests. |
| `pnpm turbo test` | PASS | Reran with sandbox escalation for `tsx` IPC; 67/67 tasks. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app` | PASS | Reran with sandbox escalation for Flutter SDK cache lock; 76/76 tests. |
| Merchant UI leak audit | PASS | Only sentinel guards and sanitizer patterns remain in matched screen/widget/service paths; no rendered `S-0NN`, `SKIP-NEEDS-BACKEND`, or backend-contract copy. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing generated artifacts recreated by tests. |

Wave 0 files intentionally changed:

- `CODEX_FOUNDATION_STEPUP_V2_LEDGER.md`
- `CODEX_FOUNDATION_STEPUP_V2_STATUS.md`
- `docs/governance/validator-reality.md`
- `apps/mobile/merchant-app/lib/widgets/shared/capability_gate.dart`
- `apps/mobile/merchant-app/lib/screens/platform/platform_blocked_screen.dart`
- `apps/mobile/merchant-app/lib/services/skip_needs_backend_exception.dart`
- `apps/mobile/merchant-app/lib/services/store_auth_service.dart`
- `apps/mobile/merchant-app/lib/screens/auth/turnstile_challenge_screen.dart`
- `apps/mobile/merchant-app/test/mobile_services_test.dart`

Supporting cleanup/fixes required to keep gates green in the existing dirty worktree:

- `apps/storefront-runtime/src/app/preview/coming-soon/page.tsx`: replaced one hardcoded hex fallback with an RGB literal to satisfy lint in a pre-existing dirty file.
- `packages/typescript/ui/src/overlay-hooks.ts` and `packages/typescript/ui/src/overlays.tsx`: fixed the existing overlay focus-trap regression so the full Turbo test gate passes.
- `scripts/generators/generate-mobile-tokens.mjs`: moved the existing untracked root token generator under the approved generators directory and updated references in existing generated-token consumers.

New migrations added: none in Wave 0.

Removed `PlatformBlocked` entries: none yet. Wave 0 changed the merchant-facing rendering path; the service ledger entries remain until their real flows are built in Waves 2-4.

Wave 1 implementation completed on 2026-06-08.

Closed issues:

- #1 Prod sign-in Turnstile sentinel: sign-in no longer crashes on sentinel/absent verification token; the auth service returns merchant-safe unavailable verification copy. Real token issuance remains `SKIPPED (HUMAN-APPROVAL)`.
- #2 Turnstile site key sentinel: `TURNSTILE_SITE_KEY` is centralized in `AppConfig` and treated with the same configured-value predicate. Real site-key issuance remains `SKIPPED (HUMAN-APPROVAL)`.
- #3 BFF host mismatch: mobile BFF config, staging dart-defines, env template/schema, and worker route now agree on `.com` BFF hosts. DNS/route/cert cutover remains `SKIPPED (HUMAN-APPROVAL)`.
- #4 `INTERNAL_API_SECRET`: mobile BFF remains fail-closed, but missing-secret responses no longer expose the sentinel or an internal runbook to merchants. Production secret install remains `SKIPPED (HUMAN-APPROVAL)`.
- #5 Razorpay key sentinel: Razorpay publishable key checks now share `AppConfig.isConfiguredValue`; sentinel builds keep the payment-connect surface disabled without leaking the sentinel. Real key provisioning remains `SKIPPED (HUMAN-APPROVAL)`.
- #6 Device-token registration: added user-scoped `POST/DELETE /v1/notifications/device-tokens`, Dart/TS client methods, BFF allowlist coverage, and Flutter registration on sign-in/token refresh.
- #7 Push provider credentials: queue-worker push dispatch now has an explicit dry-run mode covered by tests; live mode still validates FCM/APNs credentials. Real provider credentials remain `SKIPPED (HUMAN-APPROVAL)`.
- #8 Onboarding steps 1-4: added forward migration `114_mobile_onboarding_attempt_progress.sql`, `/v1/onboarding/mobile-progress`, Dart/TS client methods, StoreService wiring, and wizard persistence before store creation.
- #9 Operator-first IA: bottom navigation is now Home / Orders / Products / Customers / More; Design/editor surfaces moved under More.

Wave 1 implementation verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated workspace links with `pnpm install --frozen-lockfile --force`. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `pnpm run test:unit:gateway` | PASS | 57/57 tests, including notification/onboarding static contract coverage. |
| `pnpm run test:behavioral` | PASS | 467/467 tests. |
| `pnpm run test:contracts` | PASS | 194/194 tests after keeping the BFF session-token fixture on a neutral `.test` host. |
| `pnpm turbo test` | PASS | 67/67 tasks. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app` | PASS | 79/79 tests. |
| `cd services/queue-workers && npm run test` | PASS | 5/5 tests including dry-run push dispatch. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after route/topology/schema changes. |
| Merchant UI leak audit | PASS | Matched only sentinel guards/sanitizers, safe exception classes, and Wave-2 collection/review catch blocks whose `toString()` returns merchant-safe copy; no rendered `S-0NN`, `SKIP-NEEDS-BACKEND`, or backend-contract copy. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing generated artifacts recreated by test/build tools. |

Wave 1 files intentionally changed:

- `apps/mobile/merchant-app/dart-defines/production.json`
- `apps/mobile/merchant-app/dart-defines/staging.json`
- `apps/mobile/merchant-app/lib/config/app_config.dart`
- `apps/mobile/merchant-app/lib/main.dart`
- `apps/mobile/merchant-app/lib/screens/main/store_main_screen.dart`
- `apps/mobile/merchant-app/lib/screens/wizard/create_store_wizard.dart`
- `apps/mobile/merchant-app/lib/services/push_service.dart`
- `apps/mobile/merchant-app/lib/services/store_auth_service.dart`
- `apps/mobile/merchant-app/lib/services/store_service.dart`
- `apps/mobile/merchant-app/test/mobile_services_test.dart`
- `config/cloudflare/resource-names.json`
- `config/env/schemas/mobile.schema.json`
- `config/env/templates/mobile.dart-defines.example`
- `config/runtime/cloudflare-topology.json`
- `database/supabase/migrations/114_mobile_onboarding_attempt_progress.sql`
- `packages/dart/api_client/lib/src/api_client.dart`
- `packages/typescript/api-client/src/index.ts`
- `services/api-gateway/src/__tests__/notifications.test.ts`
- `services/api-gateway/src/__tests__/onboarding.test.ts`
- `services/api-gateway/src/routes/notifications.ts`
- `services/api-gateway/src/routes/onboarding.ts`
- `services/mobile-bff/src/index.ts`
- `services/mobile-bff/test/session-token.test.ts`
- `services/mobile-bff/wrangler.toml`
- `services/queue-workers/src/push-dispatcher.ts`
- `services/queue-workers/test/push-dispatcher.test.mjs`
- `services/queue-workers/wrangler.toml`

New migrations added in Wave 1:

- `database/supabase/migrations/114_mobile_onboarding_attempt_progress.sql`: additive onboarding-attempt progress columns, status check update, indexes, FK to `public.sites`, `updated_at` trigger using `public.update_updated_at()`.

Removed `PlatformBlocked` entries in Wave 1: none. Removed one `SkipNeedsBackendException` dead-end by replacing push token register/delete with real gateway calls.

Wave 2 implementation completed on 2026-06-08.

Closed Wave 2 items:

- #11 Shipping labels: migration `118_mobile_shipping_labels.sql`, `/v1/shipping/labels` rate/buy/pdf/void contract, BFF allowlist, clients, mobile buy/share flow, and test-mode logistics adapter are live. Live carrier credentials remain `SKIPPED (HUMAN-APPROVAL)`.
- #12 Returns/RMA: `/v1/returns` is mounted, mobile-BFF allowlisted, wired through Dart/TS clients and Flutter returns screen; S-022 removed.
- #13 Order editing: mobile can patch order line items while the gateway recomputes totals server-side.
- #14 Draft orders: migration `116_mobile_draft_orders.sql`, draft create/list/convert endpoints, clients, and mobile create/convert flow are live.
- #15 Packing slip: order print action fetches and shares a server-generated `application/pdf` packing slip from real order data.
- #16 Collection edit/delete: collection PATCH/DELETE contract and mobile actions are live; collection backend-skip dead-end removed.
- #17 Product export: mobile starts the real CSV export job, polls job status, and shares the finished download URL when available.
- #18 Review approve/reject: mobile moderation actions use the real review status route.
- #19 Merchant review replies: migration `115_product_review_merchant_replies.sql`, route, clients, and mobile reply UI are live.
- #20 Lead status mutation: mobile lead status changes use the real form-submission route.
- #21 Analytics charts: analytics screen renders real chart series with honest empty state.
- #22 Traffic sources placeholder: fake traffic-source panel is hidden/generic-empty until a real analytics pipeline exists.
- #23 Logo upload: store details uploads a real logo via `/v1/upload` and persists it to the store.
- #24 Dashboard revenue chart: dashboard chart consumes daily series instead of scalar revenue.
- #25 Notification bell: bell navigates to the notification screen.
- #26 Store Health Center: `/v1/stores/:id/health` computes real launch/product/order/domain/review pillars and the mobile Health hub renders them.
- #27 Customer CRM mutations: migration `117_mobile_customer_notes_tags.sql`, customer PATCH, note list/create, tag replace, clients, service, and detail-screen UI are live.
- #28 Customer contact: merchant-authored customer email route uses the existing Resend adapter and mobile email dialog; missing provider config returns generic unavailable copy.
- #29 Test pyramid kickoff: Wave 2 service/widget tests were added; full Flutter suite is now 88 tests.
- #30 Dashboard quick actions: quick actions navigate to live routes rather than placeholder snackbars.

Wave 2 partial items: none.

Wave 2 exit verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated workspace links with `pnpm install --frozen-lockfile --force`; fixed `UpdateCollectionInput` so collection edits accept `is_active`. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `pnpm run test:unit:gateway` | PASS | 70/70 tests, including shipping-label, customer tenant-isolation, return, collection, review, and order PDF assertions. |
| `pnpm run test:behavioral` | PASS | 467/467 tests after updating the GST harness stubs for draft-order shared schema imports. |
| `pnpm run test:contracts` | PASS | 194/194 tests. |
| `pnpm turbo test` | PASS | 67/67 tasks. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after shipping-label, packing-slip, export-share, CRM, and Health hub changes. |
| `flutter test apps/mobile/merchant-app` | PASS | 88/88 tests. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after route/schema/client changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after adding canonical tenant-context resolver names to the route-ownership validator and removing generated local artifacts recreated by test/build tools. |
| Local Supabase migration apply/reversibility | BLOCKED (LOCAL ENV) | `supabase start --workdir database/supabase` failed because local port `54322` is already allocated by another Supabase project. No staging/prod apply attempted. Unblock locally by stopping the conflicting Supabase project or assigning distinct local ports, then run the migration reset/reversibility check. |

New migrations added in Wave 2 so far:

- `database/supabase/migrations/115_product_review_merchant_replies.sql`: additive merchant reply columns on product reviews.
- `database/supabase/migrations/116_mobile_draft_orders.sql`: draft order/draft line tables with RLS and approved `update_updated_at()` triggers.
- `database/supabase/migrations/117_mobile_customer_notes_tags.sql`: customer note/tag side tables with RLS and approved `update_updated_at()` triggers.
- `database/supabase/migrations/118_mobile_shipping_labels.sql`: shipping label table with tenant ownership, RLS, indexes, audit columns, and approved `update_updated_at()` trigger.

Removed `PlatformBlocked` / `SkipNeedsBackend` entries in Wave 2 so far:

- Removed returns S-022 from mobile blocked feature definitions and route mappings.
- Removed collection edit/delete backend skip from product service.
- Removed review moderation/reply dead ends from review service.
- Replaced multiple placeholder snackbars for charts, logo upload, notification bell, print, shipping labels, product export, and dashboard quick actions with real flows or honest empty states.

Wave 3 trust/money/AI slice updated on 2026-06-08.

Closed Wave 3 items in this slice:

- #31 Payouts/settlement: added payout ledger migration, sandbox/live payout transfer adapter, `/v1/payouts` list/summary/detail/create/settle contract, BFF allowlist, TS/Dart client methods, Flutter Money screen, and dashboard deep links. Live RazorpayX/Route credentials remain `SKIPPED (HUMAN-APPROVAL)`.
- #32 Wallet: added `/v1/wallet` balance/ledger contract over `wallet_ledger_entries`, client methods, and mobile wallet tab; S-019 removed.
- #33 Commission: added `/v1/commission` overview/reconcile contract with persisted default commission schedule, client methods, and mobile commission tab; S-020 removed.
- #34 KYC: added `merchant_kyc_documents`, sandbox/live-gated KYC provider adapter, `/v1/kyc` overview/document-submit/status-refresh contract, BFF allowlist, TS/Dart client methods, Flutter KYC service/screen with camera/gallery capture, and Settings Trust entry. Live provider credentials, provider choice, and legal policy approval remain `SKIPPED (HUMAN-APPROVAL)`.
- #35 2FA/passkey: added `merchant_2fa_factors`, AES-GCM secret encryption helpers, RFC-compatible TOTP helpers, `/v1/2fa` overview/session/enroll/verify/disable contract, BFF allowlist, TS/Dart client methods, Flutter 2FA service/screen, and Settings Trust entry. TOTP is live; passkey is reserved in the contract but hidden until a future native entitlement/WebAuthn decision.
- #36 Business profile: added business-profile and invoice-address store contract fields, migration `122_mobile_business_profile.sql`, shared/tenant schema support, Store PATCH allowlist support, Dart store model fields, and mobile Store Details editing for legal name, GST, invoice prefix/numbering, business contacts, and invoice address; S-024 removed.
- #37 Taxes on mobile: added migration `123_mobile_tax_rate_parity.sql` for persisted `hsn_code`, `applies_to`, and `updated_at` tax-rate fields; fixed checkout-core tax planners to write HSN/applies-to metadata; added gateway contract tests for `/v1/shipping-tax/taxes`; verified `/features/taxes` routes to the real mobile Taxes screen; and replaced raw tax-screen error rendering with generic copy.
- #38 Payout visibility: dashboard now renders next payout amount/date/status from the payout summary contract and links to Money.
- #39 AI generation: added a sandbox/live-gated AI generation adapter, `/v1/ai/generate` provider execution with usage/credit persistence, env contracts, mobile service/UI wiring, and generic unavailable copy when provider credentials are absent. Live AI provider key, approved model, and budget confirmation remain `SKIPPED (HUMAN-APPROVAL)`.
- #40 AI credit purchase: added a sandbox/live-gated AI credit purchase adapter, `/v1/ai/credits/purchase` idempotent purchase contract, credit-balance capability fields, env contracts, TS client method, and mobile Buy Credits gating. Live Razorpay credit-purchase credentials, provider approval, and pricing/budget confirmation remain `SKIPPED (HUMAN-APPROVAL)`.
- #41 Camera capture: added a reusable camera/photo-library source sheet, wired it into product images, store logos, editor header logos, section image pickers, and media-library image upload, while retaining product Image URL fallback. Added iOS camera/photo-library usage strings and Android camera permission.
- #42 Barcode scanning: added `mobile_scanner`, a shared barcode scanner sheet with manual fallback, canonical product/variant barcode fields, tenant-scoped `/v1/products/barcode/lookup`, TS/Dart client methods, product/variant barcode capture, purchase-order and transfer scan-to-fill, and scanned inventory adjustment through the real inventory-adjust contract.
- #43 SSL/DNS/renewal visibility: added shared custom-domain health contracts, gateway DNS/TXT/CNAME/SSL/provider/renewal health aggregation, BFF allowlist coverage, TS/Dart client methods, Store Health domain-pillar scoring from real DNS/SSL signals, and mobile Domain Settings visibility for DNS, SSL, renewal, seen DNS answers, apex MX warnings, and checked-at state.
- #44 Embedded app runtime: added the shared mobile App Bridge host policy, extension-host helper, gateway `mobile_host` embed-session contract, Dart bridge-fetch client, mobile marketplace runtime service, constrained WebView bridge host, native bridge message handling, and external fallback; S-027 is removed.
- #45 Apps open external URL only: installed apps now attempt the signed embedded runtime first and use external launch only as a fallback when the mobile host policy is unavailable or unsupported.
- #46 Customer segments: added tenant-owned `customer_segments`, canonical rule/segment DTOs, `/v1/customers/segments` list/create/update/preview/apply contracts, TS/Dart clients, shared Dart segment contract, CustomerService methods, and mobile segment chips plus builder UI.
- #47 Customer merge/delete: added canonical merge input contracts, tenant-scoped `/v1/customers/:email/merge`, TS/Dart client methods, CustomerService merge/delete methods, Customer Detail merge/delete confirmation actions, and static ownership tests that pin order reassignment plus source-profile redaction.
- #48 Upload DELETE ownership: upload POST now verifies optional `store_id` and writes store metadata; upload DELETE verifies R2 store metadata or requires legacy owner metadata/path plus an owned `store_id` query; TS/Dart clients and mobile media-library deletes send store scope.
- #49 Orders tenant column nullability: added forward migration `130_orders_site_id_not_null.sql` to backfill `orders.store_id`/`orders.site_id`, tighten the mirror trigger, enforce both columns `NOT NULL`, and add active tenant/status indexes for order list access. Production apply remains `SKIPPED (HUMAN-APPROVAL)`.
- #50 Inert partitioned shadow tables: added `131_hot_table_partition_shadow_mirror.sql` to mirror live hot-table inserts/updates/deletes into the `*_partitioned` parents, added an operational enable/disable switch, and documented the decision to keep the final rename-swap human-gated.

Wave 3 trust/money/AI-slice verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks after the money, KYC, 2FA, business-profile, tax, payout-dashboard, AI provider, camera, barcode, and supporting gate fixes landed. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `pnpm run test:unit:gateway` | PASS | 111/111 tests after custom-domain health route coverage landed. |
| `pnpm run test:behavioral` | PASS | 467/467 behavioral tests. |
| `pnpm run test:contracts` | PASS | 195/195 contract tests including custom-domain health contract coverage. |
| `pnpm --filter @letbuyy/api-gateway test` | PASS | 195/195 combined gateway contract tests inside `pnpm turbo test` after #43. |
| `pnpm --filter @letbuyy/theme-marketplace test` | PASS | Scoped regression for the prior React invalid-hook-call gate blocker. |
| `pnpm turbo test` | PASS | 67/67 tasks; UI package task was cached non-escalated first because escalated pnpm runs can disturb local package symlinks, then the exact full command passed with `tsx` IPC escalation. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after Money, KYC, 2FA, Store Details business-profile, Taxes, dashboard payout visibility, AI screen/service, camera capture, barcode scanning, and domain health changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 103/103 focused tests, including AI generation, AI credit purchase success/unavailable states, camera product/logo/media source coverage, barcode scanner/service/source coverage, domain DNS/SSL/renewal health visibility, native camera permissions, MoneyService, KycService, TwoFactorService, StoreService business-profile update, and tax settings. |
| `flutter test apps/mobile/merchant-app` | PASS | 105/105 full merchant-mobile tests. |
| `node --test services/queue-workers/test/risk-scoring.test.mjs` | PASS | Static queue-worker risk scoring test after removing the direct `sites` write. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | Risk decision, trust-safety enforce/reinstate, and internal-console merchant handlers now have handler-visible authenticated/internal guard resolution, and mobile money/KYC/2FA route helpers remain recognized. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | Queue risk worker no longer writes gateway-owned `sites`. |
| `pnpm --filter @letbuyy/queue-workers typecheck` | PASS | Queue risk worker auto-restrict path now records gateway-owned enforcement requests without direct `sites` mutation. |
| `node scripts/validators/tooling-governance-validator.mjs` | PASS | The globals-token migration utility lives under canonical `scripts/migration`. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after AI route/env/package changes and the barcode lookup route/shared-contract addition. |
| `node scripts/validators/stale-artifact-validator.mjs` | PASS | Generated artifacts from install/test/gate runs removed except root validator dependencies; standalone scan saw 366 untracked non-ignored files and 3588 workspace files. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators; embedded stale-artifact scan saw 367 untracked non-ignored files and 3588 workspace files after custom-domain health, BFF allowlist, route/client/schema, repository-intelligence, and artifact cleanup. |

Wave 3 #44 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm --filter @letbuyy/shared-types build` | PASS | Shared `mobile_host` schema compiled. |
| `pnpm --filter @letbuyy/extension-host typecheck` | PASS | Mobile App Bridge host-policy helper compiled. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TypeScript API client remains clean after shared-contract changes. |
| `pnpm --filter @letbuyy/api-gateway typecheck` | PASS | Gateway route/package/manifest changes typecheck. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean. |
| `pnpm exec tsx --test tests/contracts/mobile-app-bridge-runtime.test.ts tests/contracts/app-store-route-split.test.ts tests/contracts/ops-plane-auth-hardening.test.ts` | PASS | 8/8 focused bridge/app-store contracts. |
| `pnpm run test:contracts` | PASS | 197/197 contracts after #44. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues after WebView runtime and App Bridge service changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 103/103 focused mobile service tests, including embedded App Bridge runtime. |
| `flutter test apps/mobile/merchant-app` | PASS | 105/105 full merchant-mobile tests. |
| `pnpm --filter @letbuyy/api-gateway test:unit` | BLOCKED (UNRELATED DIRTY WORKTREE) | Red in untracked internal-OS reviewer/support tests and modified platform-operations files outside the merchant-mobile #44 lane. |
| `pnpm turbo typecheck` | BLOCKED (UNRELATED DIRTY WORKTREE) | Red only in `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` `StatusPill` `tone` prop errors from unrelated dirty work. |
| `pnpm run test:behavioral` | BLOCKED (UNRELATED DIRTY WORKTREE) | Red in platform-operations/app-platform lifecycle-review expectations from unrelated dirty work. |
| `node scripts/validate-governance.mjs` | BLOCKED (UNRELATED DIRTY WORKTREE) | Latest run passed through repository intelligence, route line-count, crypto, CMS slugify, INR, and then failed `Date format validator` because `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx` declares a local `formatDate` helper. |

Wave 3 #45 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm exec tsx --test tests/contracts/mobile-app-bridge-runtime.test.ts` | PASS | Reran with escalation after the known sandbox `tsx` IPC failure; contract now asserts embedded-first and external fallback behavior. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 103/103 focused mobile service/widget tests. |

Wave 3 #46 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm --filter @letbuyy/shared-types build` | PASS | Customer segment DTO/rule schemas compiled. |
| `pnpm --filter @letbuyy/commerce-core typecheck` | PASS | Customer segment inbound schemas and customer-summary segment fields compiled. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TypeScript segment client methods compiled. |
| `pnpm --filter @letbuyy/api-gateway typecheck` | PASS | Segment routes and schema facade compiled. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean. |
| `pnpm exec tsx --test services/api-gateway/src/__tests__/tenant-isolation.test.ts` | PASS | Reran with escalation after the known sandbox `tsx` IPC failure; 8/8 focused static ownership tests. |
| `pnpm lint` | PASS | Warnings remain pre-existing in platform console/operations files. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | Customer segment routes keep handler-visible ownership checks. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | `customer_segments` writer is declared as `services/api-gateway/src/routes/customers.ts`. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | Forward migration is replay-safe. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | `customers.ts` remains under 1500 lines. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after segment route/schema/migration changes. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Active V2 ledger/status remain allowlisted. |
| `node scripts/validators/stale-artifact-validator.mjs` | PASS | Passed after removing regenerated `.next`, `.turbo`, and Flutter artifacts. |
| `node scripts/validate-governance.mjs` | BLOCKED (UNRELATED DIRTY WORKTREE) | Latest run passed route ownership, migration safety, single-writer, repository intelligence, route line-count, and then failed the same platform-operations `Date format validator` issue in `apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx`. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after CustomerService and CustomersScreen changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 103/103 focused mobile service/widget tests, including segment list/create/preview/apply and visible segment chip. |

Wave 3 #47 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm --filter @letbuyy/commerce-core typecheck` | PASS | Customer merge input schema compiled. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TypeScript merge/delete customer client methods compiled. |
| `pnpm --filter @letbuyy/api-gateway typecheck` | PASS | Customer merge route and schema facade compiled. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean. |
| `pnpm exec tsx --test services/api-gateway/src/__tests__/tenant-isolation.test.ts` | PASS | Reran with escalation after the known sandbox `tsx` IPC failure; 8/8 focused static ownership tests. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after CustomerService and CustomerDetailScreen merge/delete changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 103/103 focused mobile service/widget tests, including merge/delete service calls and detail-screen customer actions. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | Customer merge/delete paths keep handler-visible ownership checks. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | Customer merge/delete writes stay in the existing customers route owner. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | No new migration for #47; migration history remains replay-safe. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | `customers.ts` remains under 1500 lines. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after customer route/schema/client changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators, including route ownership, single-writer, repository intelligence, route line-count, date-format, generated-artifact, and stale-artifact checks. |

Wave 3 #48 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm --filter @letbuyy/shared-types build` | PASS | Restored package build artifact needed by downstream API-client typecheck. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TypeScript upload delete compatibility and scoped query support compiled. |
| `pnpm --filter @letbuyy/api-gateway typecheck` | PASS | Upload route ownership helpers compiled. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean. |
| `pnpm exec tsx --test services/api-gateway/src/__tests__/upload.security.test.ts` | PASS | 4/4 tests: store-metadata delete, foreign owner denial, foreign store denial, and legacy store-query proof. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues after media service store-scoped upload/delete changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 103/103 focused mobile service/widget tests; media delete asserts upload object delete includes `store_id`. |
| `pnpm lint` | PASS | Warnings remain pre-existing. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | Upload delete has handler-visible auth and store ownership verification. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | No table writer changes. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | Upload route remains under 1500 lines. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after upload route/API-client changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators, including source residue, repository intelligence, generated-artifact, and stale-artifact checks. |

Wave 3 #49 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `node --test tests/migrations/orders-hardening.test.mjs` | PASS | 5/5 static migration tests, including #49 backfill, trigger, NOT NULL, and tenant-index assertions. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | Forward migration contains no destructive replay hazards. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | No new writer surface; orders ownership remains with the existing gateway order route contracts. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated after the orders tenant-key schema migration. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after #49 and status/ledger updates. |

Wave 3 #50 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `node --test tests/performance/partition-retention.test.mjs tests/migrations/hot-table-partition-driver.test.mjs` | PASS | 10/10 partition lifecycle tests, including the new live-to-shadow mirror-trigger contract. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | No forbidden table drops, table renames, truncates, or column drops. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | No app/service writer changes; the new mirror is database-owned lifecycle infrastructure. |

Wave 3 exit verification:

| Gate | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile --force` | PASS | Required after local artifact cleanup removed isolated workspace links; initial sandbox attempt hit registry DNS restriction, escalated rerun restored links from the lockfile/cache. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean. |
| `pnpm lint` | PASS | Warnings remain pre-existing in token/form-control cleanup areas; no errors. |
| `pnpm run test:unit:gateway` | PASS | 122/122 tests; reran with escalation after the known sandbox `tsx` IPC pipe failure. |
| `pnpm run test:behavioral` | PASS | 469/469 tests. |
| `pnpm run test:contracts` | PASS | 197/197 tests; reran with escalation after the known sandbox `tsx` IPC pipe failure. |
| `pnpm turbo test` | PASS | 67/67 tasks. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app` | PASS | 105/105 tests; reran with escalation after Flutter SDK cache lock was blocked by sandbox. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after install/test-generated artifacts; stale artifact validator passed with ignored local artifacts. |
| Local Supabase migration apply/reversibility | BLOCKED (LOCAL ENV) | Same existing local blocker: port `54322` is occupied by another Supabase project. No staging/prod migration apply attempted. |

New migrations added in Wave 3 so far:

- `database/supabase/migrations/119_mobile_money_ledgers.sql`: payout statements, wallet ledger entries, commission schedules, and commission reconciliation entries with tenant ownership, RLS, indexes, audit columns, and approved `update_updated_at()` triggers.
- `database/supabase/migrations/120_mobile_kyc_documents.sql`: merchant KYC document capture table with tenant ownership, RLS, indexes, audit columns, and approved `update_updated_at()` trigger.
- `database/supabase/migrations/121_mobile_merchant_2fa_factors.sql`: merchant TOTP/passkey factor table with custom-user ownership, RLS, indexes, audit columns, and approved `update_updated_at()` trigger.
- `database/supabase/migrations/122_mobile_business_profile.sql`: additive business-profile and invoice-address JSON contracts on `sites`, invoice footer/numbering fields, object/positive-number constraints, GIN indexes, and declared `services/api-gateway/src/routes/stores.ts` writer ownership.
- `database/supabase/migrations/123_mobile_tax_rate_parity.sql`: additive GST metadata fields on `tax_rates` (`hsn_code`, `applies_to`, `updated_at`), applies-to/HSN constraints, store/applies/HSN indexes, approved `update_updated_at()` trigger, and declared `services/api-gateway/src/routes/shipping-tax.ts` writer ownership.
- `database/supabase/migrations/129_mobile_customer_segments.sql`: customer segments table with tenant ownership, JSON rule contract, RLS, active-name uniqueness, indexes, approved `update_updated_at()` trigger, and declared `services/api-gateway/src/routes/customers.ts` writer ownership.
- `database/supabase/migrations/130_orders_site_id_not_null.sql`: orders tenant-key backfill, stricter `orders_tenant_key_sync` trigger, `store_id`/`site_id` `NOT NULL` enforcement, and active tenant/status indexes.
- `database/supabase/migrations/131_hot_table_partition_shadow_mirror.sql`: live-to-shadow mirror triggers for the five governed hot-table partition shadows, operational enable/disable function, and issue #50 cutover notes.

New mobile dependencies added in Wave 3 so far:

- `mobile_scanner` resolved to `7.2.0` in the root Flutter lockfile and is used only by the merchant app scanner sheet.

Removed `PlatformBlocked` / `SkipNeedsBackend` entries in Wave 3 so far:

- Removed S-018 payouts/settlement from mobile blocked feature definitions and route mappings.
- Removed S-019 wallet from mobile blocked feature definitions and route mappings.
- Removed S-020 commission from mobile blocked feature definitions and route mappings.
- Removed S-021 KYC from mobile blocked feature definitions and route mappings.
- Removed S-023 two-factor authentication from mobile blocked feature definitions and route mappings.
- Removed S-024 business profile from mobile blocked feature definitions and route mappings.
- Confirmed taxes is not platform-blocked: `/features/taxes` routes directly to `TaxesScreen`, and mobile tests assert the tax route is backed by `shipping-tax/taxes`.
- Removed the mobile AI generation backend-skip dead end for `MOBILE_AI_GENERATION_PROVIDER`.
- Removed the mobile AI credit purchase backend-skip dead end for `MOBILE_AI_CREDIT_PURCHASE`; the Buy Credits control is now capability-gated by real `/v1/ai/credits` fields.
- Removed the mobile barcode scanner backend-skip seam; inventory lookup/adjustment, purchase-order lookup, transfer lookup, and product/variant barcode capture now use the real scanner/API path.
- Added domain health visibility without introducing a new blocked-feature entry; DNS/SSL/renewal unavailable states render generic merchant-safe guidance instead of provider/internal errors.
- Removed S-027 embedded App Bridge runtime from mobile blocked feature definitions and route mappings; installed apps now request a signed mobile runtime session and open in-app when the host policy allows it.
- Replaced external-only installed app opening with embedded-first App Bridge runtime and explicit external fallback.
- Customer segmentation was not platform-blocked but is now a real mobile flow backed by saved server-side segment rules and real customer/order summaries.
- Customer merge/delete was not platform-blocked but is now a real mobile detail action backed by tenant-scoped merge/delete contracts and confirmation UI.
- Upload object deletion was not platform-blocked but now has tenant/store ownership enforcement instead of user-metadata-only deletion.

Wave 4 implementation completed on 2026-06-08.

Closed issues:

- #51 WhatsApp commerce loop: added tenant-owned WhatsApp message timeline storage, sandbox/live-gated provider adapter, protected `/v1/whatsapp` status/templates/timeline/send endpoints, public signed `/v1/whatsapp/inbound` reply capture, BFF allowlist coverage, TS/Dart client methods, Flutter WhatsApp service, and Customer Detail send/timeline UI. Live WABA approval and Twilio production credentials remain `SKIPPED (HUMAN-APPROVAL)`.
- #52 AI store operator: added owned-store `/v1/ai/operator` planning, shared/app-engine schemas, TS/Dart client methods, mobile `AiStudioService.runOperatorCommand`, a reusable from-any-screen operator sheet, and mobile execution of ready product/coupon/theme draft tool calls through existing writer clients. Live AI provider key/model/budget approval remains `SKIPPED (HUMAN-APPROVAL)`.
- #53 Home-screen widgets: added a Flutter `HomeWidgetService` that publishes real dashboard analytics snapshots after successful dashboard loads, an Android `AppWidgetProvider` with widget resources, and an embedded iOS `LetBuyyMerchantWidget.appex` WidgetKit target using the same app-group snapshot. Both native widgets show a generic sync prompt until real metrics exist.
- #54 App-icon order badge: added a Flutter `AppBadgeService`, native Android/iOS badge MethodChannel handlers, order-service and dashboard badge sync from real open-order counts/status buckets, and APNs badge payload support resolved by queue-workers for order notifications. Android keeps a no-error launcher fallback because app-icon badges are launcher-specific; iOS sets the real application icon badge.
- #55 Marketing/email: added tenant-owned campaign and recipient delivery evidence tables, `/v1/marketing/email-campaigns` list/create/get/update/audience-preview/send contracts, BFF allowlist coverage, TS/Dart client methods, Flutter MarketingService, and a mobile campaign list/composer that previews real subscribed customers and sends in sandbox when the live email provider is not configured. Live sender/domain verification and Resend credentials remain `SKIPPED (HUMAN-APPROVAL)`.
- #56 No Live View: added a tenant-checked `/v1/analytics/live` contract over existing `analytics_rollups_daily` storefront live rollup metric names, shared DTOs, TS/Dart client methods, Flutter Live View models/service, and a mobile Analytics Live View card that renders real live counters/lists when traffic rows exist and a generic empty state while #83 has not emitted storefront session events.
- #57 No CSV export on mobile: added `/v1/export/customers` to create tenant-scoped real CSV export jobs from `store_customers`, extended TS/Dart clients, and replaced Orders/Customers mobile export placeholder copy with real CSV job start, polling, and share flows. Product and order export failures now use generic unavailable copy instead of leaking internal errors.
- #58 Localization/markets: added tenant-scoped market, locale, and translation storage, `/v1/stores/:id/localization` summary/update plus CRUD contracts, TS/Dart clients, mobile StoreService models/methods, and a real Localization & Markets settings surface. S-025 is removed from PlatformBlocked/parity routing; regulated/EU market rollout copy and policy remain human/legal gated.
- #59 Metafields/custom data: added tenant-scoped metafield definition/value storage, protected `/v1/metafields` definition CRUD and value upsert/delete contracts, BFF allowlist coverage, shared DTOs, TS/Dart clients, Flutter MetafieldService, and a real Custom Data settings surface. S-026 is removed from PlatformBlocked/parity routing and the platform-blocked inventory is now empty.
- #60 AI homepage generator: added owned-store `/v1/ai/homepage`, shared/app-engine schemas, TS/Dart client methods, mobile `AiStudioService.generateHomepageDraft`, an editor toolbar AI action, prompt sheet, generated section normalization, and draft save through the existing theme draft writer. AI provider/sentinel failures render generic unavailable copy; live provider key/model/budget approval remains `SKIPPED (HUMAN-APPROVAL)`.
- #61 Responsive preview toggle: replaced icon-only device switching with visible Mobile/Tablet/Desktop responsive controls in the editor preview frame, kept the live storefront preview URL wired to `_deviceMode`, and made the WebView reapply its viewport script when device mode changes without a URL reload.

Wave 4 #51 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after `/v1/whatsapp` route/env additions. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated workspace dependency links with `pnpm install --frozen-lockfile --force`. |
| `pnpm run test:unit:gateway` | PASS | 127/127 tests; reran with escalation after the known sandbox `tsx` IPC pipe failure. |
| `node --test services/api-gateway/src/__tests__/whatsapp.test.ts` | PASS | 5/5 focused WhatsApp contract, adapter, migration, config, BFF, and mobile-source tests. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 104/104 focused mobile service/widget tests. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | `customer_whatsapp_messages` writer and signed inbound guard are declared. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | New WhatsApp migration is additive and replay-safe under the safety validator. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after route/schema changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after sanitizing the WhatsApp send failure response to merchant-safe copy. |
| Local Supabase migration apply/reversibility | BLOCKED (LOCAL ENV) | Same existing local blocker: port `54322` is occupied by another Supabase project. No staging/prod migration apply attempted. |

Wave 4 #52 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after `/v1/ai/operator` route/schema updates. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring the isolated pnpm workspace symlink layer with `pnpm install --frozen-lockfile --recursive --force`. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `node --test services/api-gateway/src/__tests__/ai.test.ts` | PASS | 5/5 focused AI route/provider/client/mobile-source tests. |
| `pnpm run test:unit:gateway` | PASS | 130/130 tests; reran with sandbox escalation for the known `tsx` IPC path. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 105/105 focused mobile service/widget tests, including AI operator tool execution. |
| `dart format apps/mobile/merchant-app/lib/widgets/shared/ai_operator_sheet.dart apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS (telemetry warning) | Formatting applied; Dart telemetry session write remains blocked by local filesystem permissions. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after route/package changes. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Archived the untracked `CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.md` root-residue files under `docs/archive/root-residue/2026-06-08-checkout-platform-build/`. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators. |

Wave 4 #53 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart apps/mobile/merchant-app/lib/services/home_widget_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after widget bridge/provider changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 107/107 focused mobile service/widget tests; reran with sandbox escalation after Flutter SDK cache lock failure. |
| `xcodebuild -list -project apps/mobile/merchant-app/ios/Runner.xcodeproj` | PASS | Project parses and lists `Runner`, `LetBuyyMerchantWidget`, and `RunnerTests`; CoreSimulator/cache warnings are local environment noise and exit code was 0. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after native mobile files and the iOS WidgetKit target were added. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after archiving the reappeared checkout-platform root residue and removing local generated `packages/projection-runtime/dist`. |

Wave 4 #54 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart apps/mobile/merchant-app/lib/services/app_badge_service.dart apps/mobile/merchant-app/lib/services/order_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 109/109 focused mobile service/widget tests. |
| `node --test services/queue-workers/test/push-dispatcher.test.mjs` | PASS | 4/4 tests, including APNs badge count payload coverage. |
| `pnpm --filter @letbuyy/queue-workers typecheck` | PASS | Passed after restoring queue-worker/package workspace links with escalated `pnpm install` because the sandboxed registry fetch could not resolve `registry.npmjs.org`. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after badge bridge/provider changes. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated app/service/package workspace links. |
| `pnpm --filter @letbuyy/queue-workers test` | PASS | 11/11 queue-worker tests. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after native mobile and queue-worker badge changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing nested workspace `node_modules`, `dist`, and `*.tsbuildinfo` artifacts recreated for typecheck/lint. |

Wave 4 #55 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/lib/app/routes.dart apps/mobile/merchant-app/lib/screens/marketing/email_campaigns_screen.dart apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart apps/mobile/merchant-app/lib/services/marketing_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/api_client/lib/src/api_client.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `node --test services/api-gateway/src/__tests__/marketing.test.ts` | PASS | 5/5 focused marketing migration, schema, route, BFF, client, and mobile-source checks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after marketing route/schema mount. |
| `pnpm --filter @letbuyy/shared-types typecheck` | PASS | Shared marketing campaign DTO exports compile. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TS marketing email campaign client methods compile. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | `marketing_email_campaigns` and `marketing_email_recipients` writer ownership is declared. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | New marketing migration is additive and replay-safe under the safety validator. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 110/110 focused mobile service/widget tests after escalation for Flutter SDK cache lock. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after marketing service/composer wiring. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated workspace dependency links. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:unit:gateway` | PASS | 143/143 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after route/schema/migration/client/mobile changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing nested workspace `node_modules`, `dist`, and `*.tsbuildinfo` artifacts recreated for typecheck/lint. |

Wave 4 #56 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `node --test services/api-gateway/src/__tests__/analytics-live.test.ts` | PASS | 3/3 focused Live View route, shared/client contract, and mobile-source checks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after `/v1/analytics/live` route updates. |
| `pnpm --filter @letbuyy/shared-types typecheck` | PASS | Shared Live View DTO exports compile. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TS `analytics.live` client method compiles. |
| `dart format apps/mobile/merchant-app/lib/screens/analytics/analytics_screen.dart apps/mobile/merchant-app/lib/services/analytics_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/api_client/lib/src/api_client.dart` | PASS | Formatting clean after sandbox escalation for Dart telemetry session writes. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after Live View parser/UI fixes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 111/111 focused mobile service/widget tests after escalation for Flutter SDK cache lock; added Live View service coverage. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:unit:gateway` | PASS | 146/146 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after analytics route/client/mobile changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing nested workspace `node_modules`, `dist`, and `*.tsbuildinfo` artifacts recreated for typecheck/lint. |

Wave 4 #57 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/screens/customers/customers_screen.dart apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart apps/mobile/merchant-app/lib/services/customer_service.dart apps/mobile/merchant-app/lib/services/order_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/api_client/lib/src/api_client.dart` | PASS | Formatting clean after sandbox escalation for Dart telemetry session writes. |
| `node --test services/api-gateway/src/__tests__/mobile-export.test.ts` | PASS | 3/3 focused route/client/mobile-source checks for product, order, and customer CSV exports. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after `/v1/export/customers` and generic export error handling. |
| `pnpm --filter @letbuyy/shared-types build` | PASS | Rebuilt shared declarations required by direct client package checks after generated artifact cleanup. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TS customer export client method compiles. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after order/customer export share flows. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 113/113 focused mobile service/widget tests after escalation for Flutter SDK cache lock; added order and customer export service coverage. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated workspace dependency links with escalated `pnpm install --frozen-lockfile --force`. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:unit:gateway` | PASS | 149/149 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after export route/client/mobile changes. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing nested workspace `node_modules`, `dist`, and `*.tsbuildinfo` artifacts recreated for typecheck/lint. |

Wave 4 #58 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `node --test services/api-gateway/src/__tests__/store-localization.test.ts` | PASS | 3/3 focused migration, route, client, and mobile-source checks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after localization route additions. |
| `pnpm --filter @letbuyy/shared-types build` | PASS | Shared localization DTO exports build. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TS localization client methods compile. |
| `dart format apps/mobile/merchant-app/lib/app/routes.dart apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart apps/mobile/merchant-app/lib/screens/settings/localization_markets_screen.dart apps/mobile/merchant-app/lib/screens/settings/settings_screen.dart apps/mobile/merchant-app/lib/services/platform_blocked_service.dart apps/mobile/merchant-app/lib/services/store_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/api_client/lib/src/api_client.dart` | PASS | Formatting clean after sandbox escalation for Dart telemetry session writes. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after localization service/screen/routing changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 115/115 focused mobile service/widget tests after escalation for Flutter SDK cache lock; added localization service and screen coverage. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | New localization migration is additive and replay-safe under the safety validator. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | Localization tables have one declared writer path. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | `store_markets`, `storefront_locales`, and `storefront_translations` writer ownership plus route guard token are declared. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:unit:gateway` | PASS | 152/152 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after schema/route/client/mobile changes. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | Split localization into `stores-localization.ts`; `stores.ts` is 800 lines and the new module is 695 lines. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Active V2 root ledger/status/mission set is clean after archiving the superseded checkout-platform mission. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing generated artifacts from the typecheck/lint/test runs. |

Wave 4 #59 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `node --test services/api-gateway/src/__tests__/metafields.test.ts` | PASS | 3/3 focused migration, route, client, BFF, and mobile-source checks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after `/v1/metafields` route additions. |
| `pnpm --filter @letbuyy/shared-types build` | PASS | Shared metafield DTO exports build. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TS metafield client methods compile after rebuilding shared declarations. |
| `dart format packages/dart/api_client/lib/src/api_client.dart apps/mobile/merchant-app/lib/services/metafield_service.dart apps/mobile/merchant-app/lib/screens/settings/custom_data_screen.dart apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/lib/app/routes.dart apps/mobile/merchant-app/lib/services/platform_blocked_service.dart apps/mobile/merchant-app/lib/screens/parity/merchant_feature_definitions.dart apps/mobile/merchant-app/lib/screens/settings/settings_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | Formatting clean after sandbox escalation for Dart telemetry session writes. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after metafield service/screen/routing changes. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 116/116 focused mobile service/widget tests after escalation for Flutter SDK cache lock; added MetafieldService and CustomDataScreen coverage. |
| `node scripts/validators/migration-safety-validator.mjs` | PASS | New metafield migration is additive and replay-safe under the safety validator. |
| `node scripts/validators/single-writer-ownership-validator.mjs` | PASS | Metafield tables have one declared writer path. |
| `node scripts/validators/route-ownership-validator.mjs` | PASS | `store_metafield_definitions`, `store_metafield_values`, and `resolveOwnedMetafieldStore` are declared. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | `services/api-gateway/src/routes/metafields.ts` is under the 1500-line route cap; `internal-console.ts` was whitespace-trimmed to 1458 lines after the full governance suite caught it over cap. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:unit:gateway` | PASS | 155/155 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after schema/route/client/mobile changes. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Archived the untracked executable-build mission root residue under `docs/archive/root-residue/2026-06-08-executable-build/`. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after restoring root pnpm links, removing nested generated artifacts, archiving root residue, and trimming `internal-console.ts` whitespace under the route cap. |

Wave 4 #60 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/screens/editor/section_editor_screen.dart apps/mobile/merchant-app/lib/widgets/editor/editor_toolbar.dart apps/mobile/merchant-app/lib/services/ai_studio_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/api_client/lib/src/api_client.dart` | PASS | Formatting clean after sandbox escalation for Dart telemetry session writes. |
| `pnpm --filter @letbuyy/shared-types build` | PASS | Shared homepage-generation DTO exports build. |
| `pnpm --filter @letbuyy/app-engine typecheck` | PASS | App-engine homepage schema compiles after using a behavioral-test-compatible record schema. |
| `pnpm --filter @letbuyy/api-client typecheck` | PASS | TS `ai.homepage` client method compiles. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after `/v1/ai/homepage` route addition. |
| `node --test services/api-gateway/src/__tests__/ai.test.ts` | PASS | 5/5 focused AI route/provider/client/mobile-source checks. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after editor AI prompt/save wiring. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 117/117 focused mobile service/widget tests after SDK-cache escalation; added homepage draft success/unavailable coverage. |
| `flutter test apps/mobile/merchant-app` | PASS | 119/119 full mobile tests after SDK-cache escalation. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:unit:gateway` | PASS | 157/157 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `pnpm run test:behavioral` | PASS | 470/470 behavioral tests after rerun with Docker access for the local Postgres proof. |
| `pnpm run test:contracts` | PASS | 197/197 contract tests. |
| `pnpm turbo test` | PASS | 67/67 tasks after restoring pnpm links and rerunning with `tsx` IPC escalation. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after shared export, route, client, and mobile editor changes. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | 73 api-gateway route files remain under the 1500-line cap. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Active V2 root ledger/status/mission set remains clean. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` artifacts. |

Wave 4 #61 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/widgets/editor/device_frames/device_frame_preview.dart apps/mobile/merchant-app/lib/widgets/editor/website_preview.dart apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after responsive preview control and WebView viewport updates. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 118/118 focused mobile service/widget/source tests after SDK-cache escalation; added responsive preview toggle coverage. |
| `flutter test apps/mobile/merchant-app` | PASS | 120/120 full mobile tests after SDK-cache escalation. |

Wave 4 #62 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/services/media_service.dart apps/mobile/merchant-app/lib/screens/content/media_library_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `pnpm --filter @letbuyy/shared-types build` | PASS | Shared upload result DTO now exposes optional `media_type`. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after bounded video/model upload handling. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after media service and media-library preview updates. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 119/119 focused mobile service/widget/source tests after SDK-cache escalation; added video/model media coverage. |
| `flutter test apps/mobile/merchant-app` | PASS | 121/121 full mobile tests after SDK-cache escalation. |
| `pnpm run test:unit:gateway` | PASS | 162/162 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path; upload security test covers 11 MB video upload metadata. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:contracts` | PASS | 197/197 contract tests after updating the behavioral runner contract. |
| `pnpm turbo test` | PASS | 67/67 tasks after rerun with `tsx` IPC escalation. |
| `pnpm run test:behavioral` | PASS | 475 tests total: 471 pass, 4 human-required skips, 0 failures after serializing the behavioral runner to avoid shared local Postgres proof races. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after route, shared DTO, mobile media, and root test-runner changes. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | 73 api-gateway route files remain under the 1500-line cap. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Active V2 root ledger/status/mission set remains clean. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing generated artifacts. |

Wave 4 #63 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `dart format apps/mobile/merchant-app/lib/services/money_service.dart apps/mobile/merchant-app/lib/screens/money/money_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/api_client/lib/src/api_client.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway compile clean after COD reconciliation route and wallet remittance wiring. |
| `pnpm --filter @letbuyy/shared-types build` | PASS | Shared COD reconciliation DTOs and `cod_remittance_credit` ledger type compile. |
| `pnpm --filter @letbuyy/api-client build` | PASS | TS client COD methods compile. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after Money COD tab/service updates. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 119/119 focused mobile service/widget/source tests; COD overview/collect/reconcile paths covered. |
| `flutter test apps/mobile/merchant-app` | PASS | 121/121 full mobile tests after SDK-cache escalation. |
| `pnpm run test:unit:gateway` | PASS | 167/167 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `pnpm turbo typecheck` | PASS | 59/59 tasks after restoring isolated workspace links with escalated `CI=true pnpm install --frozen-lockfile`. |
| `pnpm lint` | PASS | Existing broad app warnings remain warning-only; no lint errors. |
| `pnpm run test:contracts` | PASS | 197/197 contract tests after replacing a local checkout `.com` fallback with shared `DEFAULT_PLATFORM_DOMAIN`. |
| `pnpm run test:behavioral` | PASS | 476 tests total: 472 pass, 4 human-required skips, 0 failures. |
| `pnpm turbo test` | PASS | 67/67 tasks after rerun with `tsx` IPC escalation. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after route, schema, client, and mobile money changes. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | 74 api-gateway route files remain under the 1500-line cap. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Active V2 root ledger/status/mission set remains clean. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing generated `*.tsbuildinfo` artifacts. |

Wave 4 #64 focused verification:

| Gate | Result | Notes |
|---|---|---|
| `plutil -lint apps/mobile/merchant-app/ios/LetBuyyMerchantWatch/Info.plist apps/mobile/merchant-app/ios/LetBuyyMerchantWatch/LetBuyyMerchantWatch.entitlements apps/mobile/merchant-app/ios/Runner/Runner.entitlements` | PASS | Watch app and shared app-group entitlements are valid plists. |
| `xcodebuild -list -project apps/mobile/merchant-app/ios/Runner.xcodeproj` | PASS | Project lists `LetBuyyMerchantWatch`, `LetBuyyMerchantWidget`, `Runner`, and `RunnerTests`; CoreSimulator warnings are sandbox-local. |
| `xcodebuild -showBuildSettings -project apps/mobile/merchant-app/ios/Runner.xcodeproj -scheme LetBuyyMerchantWatch -destination 'generic/platform=watchOS'` | PASS | Reran with escalation for DerivedData/PIF writes; target builds as `LetBuyyMerchantWatch.app` for watchOS. |
| `dart format apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | Formatting clean after rerun with sandbox escalation for Dart telemetry session writes. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found after WatchConnectivity bridge and WatchKit target additions. |
| `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` | PASS | 119/119 focused mobile service/source tests after SDK-cache escalation; added Watch app registration and sync-source assertions. |
| `flutter test apps/mobile/merchant-app` | PASS | 121/121 full mobile tests after SDK-cache escalation. |
| `node scripts/generate-repository-intelligence.mjs` | PASS | Regenerated source-derived intelligence after native iOS target/source changes. |

Wave 4 exit verification after #64:

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks after lockfile repair and workspace-link restoration. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | PASS | 9/9 lint tasks; existing warnings remain warning-only. Temporary app `.turbo` dirs were created for lint and are removed before governance. |
| `pnpm run test:unit:gateway` | PASS | 171/171 gateway unit tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `pnpm run test:contracts` | PASS | 197/197 contract tests after rerun with sandbox escalation for the known `tsx` IPC path. |
| `pnpm run test:behavioral` | PASS | 477 tests total: 473 pass, 4 human-required skips, 0 failures after rerun with Docker access for local Postgres proof suites. |
| `pnpm turbo test` | PASS | 67/67 workspace tasks after restoring recursive pnpm workspace links and rerunning with `tsx` IPC escalation. |
| `node scripts/validators/route-line-count-validator.mjs` | PASS | 74 api-gateway route files remain under the 1500-line cap. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | Active V2 root ledger/status/mission set remains clean. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators after removing nested workspace generated artifacts and app `*.tsbuildinfo` outputs. |

New migrations added in Wave 4:

- `database/supabase/migrations/132_mobile_whatsapp_commerce.sql`: tenant-scoped WhatsApp timeline table with RLS, store/customer indexes, active idempotency uniqueness, provider message lookup, audit columns, and approved `update_updated_at()` trigger.
- `database/supabase/migrations/136_mobile_marketing_email_campaigns.sql`: tenant-scoped email campaign headers and recipient delivery evidence tables with RLS, store/status indexes, idempotency uniqueness, recipient status lookup, audit columns, and approved `update_updated_at()` triggers.
- `database/supabase/migrations/137_mobile_storefront_localization.sql`: tenant-scoped market, locale, and translation tables with RLS, active indexes, uniqueness constraints, audit columns, and approved `update_updated_at()` triggers.
- `database/supabase/migrations/138_mobile_store_metafields.sql`: tenant-scoped metafield definition and value tables with RLS, active uniqueness, store/owner indexes, audit columns, and approved `update_updated_at()` triggers.
- `database/supabase/migrations/140_mobile_cod_reconciliation.sql`: tenant-scoped COD reconciliation entries with RLS, collection/reconciliation idempotency, order ownership indexes, approved `update_updated_at()` trigger, and wallet ledger `cod_remittance_credit` type extension.

New provider adapters added in Wave 4:

- `packages/infrastructure/whatsapp-commerce-adapter`: sandbox WhatsApp commerce adapter plus live Twilio REST adapter gated by account SID, auth token, WhatsApp sender, and signed webhook verification.

Supporting cleanup in Wave 4:

- Archived untracked checkout-platform mission residue under `docs/archive/root-residue/2026-06-08-checkout-platform-build/` after the source-ledger residue validator flagged the root copy.
- Archived the later regenerated `CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.md` root copy as `docs/archive/root-residue/2026-06-08-checkout-platform-build/CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.full-115326.md`.
- Removed local generated `packages/projection-runtime/dist` output after governance's generated-artifact cleanup hit an `ENOTEMPTY` on that ignored build directory.
- Restored isolated pnpm workspace links with escalated `pnpm install` for #54 typecheck/lint verification, then removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs before governance.
- Restored isolated pnpm workspace links for #55 typecheck/lint/test verification, then removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs before governance.
- Removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs after #56 typecheck/lint/gateway verification before governance.
- Restored isolated pnpm workspace links for #57 direct package/broad typecheck verification after the sandboxed registry fetch failed DNS, then removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs before governance.
- Moved the superseded root `CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.md` to `docs/archive/CODEX_CHECKOUT_PLATFORM_BUILD_MISSION.md` after the source-ledger residue validator flagged the regenerated root copy during #58 verification.
- Removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs after #58 typecheck/lint/gateway verification before governance.
- Split the #58 localization contract into `services/api-gateway/src/routes/stores-localization.ts` and registered it from `stores.ts` after the route line-count validator caught the combined file at 1588 lines.
- Removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs after #59 typecheck/lint/gateway verification before governance.
- Archived `CODEX_LETBUYY_EXECUTABLE_BUILD_MISSION.md` under `docs/archive/root-residue/2026-06-08-executable-build/` after the source-ledger residue validator flagged the root copy during #59 verification.
- Restored root pnpm links with escalated `pnpm install --frozen-lockfile` after local artifact cleanup removed the root `typescript` symlink needed by governance; nested workspace generated artifacts were removed again before final governance.
- Whitespace-trimmed `services/api-gateway/src/routes/internal-console.ts` to 1458 lines after the final route line-count validator caught the pre-existing file over the 1500-line cap.
- Restored workspace pnpm links with escalated `CI=true pnpm install --frozen-lockfile` during #60 after the sandboxed install hit registry DNS failures, reran `pnpm turbo test`, then removed nested workspace `node_modules`, generated `dist`, and `*.tsbuildinfo` outputs before governance.
- Removed `apps/mobile/merchant-app/.dart_tool` after #61 Flutter verification before governance.
- Restored workspace pnpm links with escalated `CI=true pnpm install --frozen-lockfile` during #62 after local artifact cleanup removed package links needed by TypeScript verification; removed generated app `*.tsbuildinfo` outputs before governance.
- Serialized the root behavioral runner with `--test-concurrency=1` after the full gate exposed shared local Postgres reset races between executable proof suites; updated the contract test so CI and local gates use the deterministic runner.
- Added WatchKit target metadata and a WatchConnectivity bridge for #64 without adding fake metrics; the watch app reads the existing dashboard/home-widget snapshot keys and shows a generic sync prompt when no phone snapshot exists.
- Synced `pnpm-lock.yaml` after Wave 4 exit gates exposed lock drift around the gateway `@letbuyy/payments` dependency declaration.
- Restored recursive pnpm workspace links with escalated installs for the Wave 4 exit suite after local artifact cleanup and a partial UI install left package-local dependency links missing; nested workspace `node_modules`, generated `dist`, `.turbo`, `.dart_tool`, `.wrangler`, `.next`, and `*.tsbuildinfo` outputs are removed before governance.
- Added runtime shell widget coverage for #65: `StoreMainScreen` now boots with the same provider slice as the app, loads real mocked gateway data for Home, Orders, Products, Customers, and More, and verifies the AI operator bottom sheet opens without leaking internal capability state.
- Fixed two production layout defects surfaced by #65 widget coverage: `StoreSwitcherButton` no longer passes a nested `Flexible` into `OutlinedButton.icon`, and dashboard compact stat trend badges now flex/ellipsis inside their fixed card width.
- Added the first #66 `integration_test` merchant happy path: login through identity CSRF/session handling, selected-store restore, Orders tab navigation, order-detail route, manual fulfillment, and API payload assertions for `/orders/order_1/fulfill`.
- The #66 E2E requires a real/test `TURNSTILE_TOKEN` dart-define and skips in broad local suites when that verification config is absent; the targeted Flutter-tester command is recorded below.
- Fixed two additional phone-width layout defects surfaced by the E2E: compact product-usage labels in `HeroStoreCard` and the revenue/live-total header in `AnimatedRevenueChart` now flex and ellipsis instead of overflowing.
- Added the remaining #67 service-level tests for `LanguageService` and `StorageService`: language preference persistence/restore/fallback plus storage upload forwarding, R2 key extraction, and delete-failure cleanup behavior.
- Verified by source inventory that every `apps/mobile/merchant-app/lib/services/*_service.dart` service class is referenced by `apps/mobile/merchant-app/test/mobile_services_test.dart`.
- Added #75 crash reporting: `CrashReportingService` now captures Flutter framework, `PlatformDispatcher`, and zone errors, writes a bounded local diagnostics outbox, and forwards sanitized crash events to Sentry only when `SENTRY_DSN` is configured.
- Added #76 image caching: product catalog, product form, import, collection, media library, theme, editor, dashboard logo, store settings logo, and picker previews now use the shared `CachedMerchantImage`/`cachedMerchantImageProvider` wrapper around `cached_network_image`.
- Added #77 accessibility pass: custom tap regions now share `AccessibleTapRegion` for button semantics, selected state when applicable, assistive activation, and 48px minimum targets across Home quick actions, Orders, Products, Customers, and Settings surfaces.
- Added #78 ownership hardening: `resolveOwnedStoreScope` now centralizes custom-user resolution, `verifySiteOwnership`, tenant access profile hydration, and route tenant-context binding; customer routes delegate store checks to that helper instead of a route-local verifier.
- Added #79 RLS hardening proof: verification SQL for migration 107 plus static and executable Postgres tests proving sensitive service policies are service-role-only, own-row policies use `auth.uid()`, anon cannot read sensitive credential/session rows, and payment provider IDs are globally unique.
- Added #80 payment verification replay guard: Razorpay verify now checks existing `payment_transactions` for the submitted provider payment id before confirming, while keeping the server-created Razorpay order binding and migration-level unique-index backstop.
- Added #81 migration replayability governance: applied legacy migrations 076/093/095-098 are documented instead of edited in place, and merchant-mobile V2 forward migrations are now checked for replay-safe create/add/policy/trigger patterns by both tests and the migration-safety validator.
- Added #82 reserved-service honesty coverage: the six reserved service roots remain manifest-and-AGENTS only, while mobile notification/push is proven through the implemented gateway, BFF, queue-worker, and push-dispatcher path.
- Added #83 storefront session analytics: public storefronts now enqueue sampled, idempotent analytics beacon jobs through the gateway, queue consumers project storefront session/source/device/country metrics into `analytics_rollups_daily`, merchants can read `/v1/analytics/traffic-sources`, and the mobile analytics screen renders real traffic sources with a generic empty state.
- Added #87 sample-product seed: `/v1/products/sample` creates exactly one clearly labeled inactive draft product only for an owned empty catalog, TS/Dart clients expose it, `ProductService` caches it, and the Products empty state can add it without fake metrics or sample sales.

Removed `PlatformBlocked` / `SkipNeedsBackend` entries in Wave 4:

- Removed S-025 localization/markets from mobile blocked feature definitions and route mappings.
- Removed S-026 metafields/custom data from mobile blocked feature definitions and route mappings; `PlatformBlockedService.features` is now empty.

Found defects closed during Wave 3 validation:

- `FOUND-001`: `@letbuyy/ui` dev React/ReactDOM runtime aligned to `19.2.3` so theme-marketplace UI tests no longer load a second React copy.
- `FOUND-002`: operations risk decision route now explicitly resolves authenticated actor inside the handler before tenant-table mutations.
- `FOUND-003`: queue risk scoring no longer writes the gateway-owned `sites` table directly; it records auto-restrict requests for gateway/ops action.
- `FOUND-004`: `scripts/migrations/consolidate-globals-tokens.mjs` moved to canonical `scripts/migration/consolidate-globals-tokens.mjs`.
- `FOUND-005`: operations trust-safety enforce/reinstate routes now explicitly resolve authenticated actor inside each handler before direct `sites` status mutations.
- `FOUND-006`: internal-console merchant search/overview/moderation routes now include handler-visible platform-console/internal-secret guards before tenant-table reads or writes.

Found defects closed during Wave 5 validation:

- `FOUND-007`: `services/api-gateway/src/routes/shipping.ts` now resolves `c.get('auth')` inside the `POST /rates` and serviceability handlers and passes the authenticated user into the existing store-ownership helper; route ownership, direct gateway typecheck, and full governance pass.
- `FOUND-008`: `scripts/validators/route-ownership-validator.mjs` now recognizes `verifyCheckoutHandoff` as a signed public checkout session gate; the existing checkout confirm route keeps public shopper semantics while the validator correctly sees its HMAC-scoped cart/site guard.
- `FOUND-009`: `services/api-gateway/src/routes/orders.ts` now imports its owned-store listing helper from `services/api-gateway/src/lib/order-ownership.ts`, bringing the route file below the 1500-line cap without changing `/v1/orders` behavior.
- `FOUND-010`: #72 verification exposed contract-gate drift in platform-domain literals, password-hash token wording, mobile fixture hosts, and legacy site-type validator expectations; source/tests/validators now agree on shared-domain fallbacks and store-only active acquisition.
- `FOUND-011`: shared Dart model tests exposed that `CartContract` lagged `CartSchema` on `channel` and `buyer_email`; the Dart mirror now matches the shared schema again.
- `FOUND-012`: post-#75 governance exposed that `apps/identity-platform/runtime.manifest.json` lagged its existing `@letbuyy/tenant-core` package/import dependency; the manifest now declares it and repository intelligence was regenerated.
- `FOUND-013`: #79 behavioral verification exposed that the local billing test VM Zod stub lacked `z.coerce.number/string/boolean`; the harness now supports those helpers and the full behavioral gate passes.

New migrations added in Wave 5:

- `database/supabase/migrations/155_storefront_session_analytics.sql`: storefront session/source analytics ingestion and reporting tables for #83.
- `database/supabase/migrations/157_product_metadata.sql`: additive `products.metadata jsonb` column, object check, GIN index, and writer comment for #91 product specifications metadata.
- `database/supabase/migrations/158_order_items_tenant_scope.sql`: direct `order_items.site_id` tenant scope, backfill from `orders`, `NOT NULL` enforcement, FK to `public.sites`, sync trigger, direct tenant indexes, service-role/GUC/owner RLS policies, and writer comment for #105.
- `database/supabase/rollback/158_order_items_tenant_scope.rollback.sql`: rollback drill SQL for the additive #105 scope objects.

## Rollup

| Status | Count |
|---|---:|
| DONE | 100 |
| PARTIAL | 0 |
| SKIPPED (HUMAN-APPROVAL) | 10 |
| OPEN | 0 |

Completion: 100 / 110 DONE; 110 / 110 issues closed or human-gated with in-code work landed.

## Final Gate Sweep

Final gate sweep completed on 2026-06-08 after #110.

| Gate | Result | Notes |
|---|---|---|
| `pnpm turbo typecheck` | PASS | 59/59 tasks. |
| `cd services/api-gateway && npx tsc --noEmit` | PASS | Direct gateway typecheck clean. |
| `pnpm lint` | BLOCKED (unrelated) | Fails in pre-existing/user-owned `apps/marketing-site` files outside this mission lane: raw Button/Input lint errors in `src/components/Footer.tsx`, raw token/color warnings, and `react-hooks/set-state-in-effect` in `src/components/ThemeProvider.tsx`. Left untouched per merchant-mobile scope and dirty-worktree rules. |
| `pnpm run test:unit:gateway` | PASS | Reran with sandbox escalation for `tsx` IPC; 230/230 tests. |
| `pnpm run test:behavioral` | PASS | Reran with sandbox escalation for local Colima Docker/Postgres access; 498 pass, 15 expected human-required skips, 0 failures. |
| `pnpm run test:contracts` | PASS | Reran with sandbox escalation for `tsx` IPC; 200/200 tests. |
| `pnpm turbo test` | PASS | Reran with sandbox escalation for `tsx` IPC; 67/67 tasks. |
| `flutter analyze apps/mobile/merchant-app` | PASS | No issues found; SDK-cache escalation required. |
| `flutter test apps/mobile/merchant-app` | PASS | 162 pass, 1 existing integration placeholder skipped; SDK-cache escalation required. |
| Local executable migration/RLS proof | PASS | Covered by the escalated behavioral suite's Docker/Postgres tests; staging/production migration apply remains human-gated. |
| `node scripts/validators/source-ledger-residue-validator.mjs` | PASS | V2 mission/ledger/status residue allowlist clean. |
| `node scripts/validators/ci-simulation-validator.mjs` | PASS | Merge-safety job retains merchant-mobile Flutter blockers. |
| `node scripts/validate-governance.mjs` | PASS | 172 validators. |

Repository intelligence was not rerun in the final #110-only sweep because the final changes were CI/validator/status updates, not route, page, export, topology, schema, or deployment-root changes.

## Wave 5 #65 Verification

- `dart format apps/mobile/merchant-app/lib/screens/dashboard/home_screen.dart apps/mobile/merchant-app/lib/widgets/store/store_switcher_button.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (121/121, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (123/123, SDK-cache escalation required).
- `node scripts/validators/route-ownership-validator.mjs` - PASS after `FOUND-007`.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #66 Verification

- `dart format apps/mobile/merchant-app/integration_test/merchant_happy_path_test.dart apps/mobile/merchant-app/lib/widgets/dashboard/hero_store_card.dart apps/mobile/merchant-app/lib/widgets/dashboard/animated_revenue_chart.dart` - PASS after Dart telemetry escalation.
- `flutter test -d flutter-tester --dart-define=TURNSTILE_TOKEN=integration-turnstile-token integration_test/merchant_happy_path_test.dart` from `apps/mobile/merchant-app` - PASS (1/1, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (123 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validators/route-ownership-validator.mjs` - PASS after `FOUND-008`.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #67 Verification

- `dart format apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (125/125, SDK-cache escalation required).
- Service inventory check - PASS: every `lib/services/*_service.dart` class ending in `Service` is referenced by `mobile_services_test.dart`.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (127 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #68 Verification

- Added #68 golden screenshot coverage for order detail fulfillment, customers CRM list, and Store Health Center with fixed 390x844 mobile viewport and mocked gateway/provider data.
- Generated baselines under `apps/mobile/merchant-app/test/goldens/`; visually inspected to confirm no clipping, overflow, or gross layout regression.
- `dart format apps/mobile/merchant-app/test/merchant_goldens_test.dart` - PASS after Dart telemetry escalation.
- `flutter test --update-goldens apps/mobile/merchant-app/test/merchant_goldens_test.dart` - PASS (3/3, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/merchant_goldens_test.dart` - PASS (3/3, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (130 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `npx tsc --noEmit` in `services/api-gateway` - PASS after `FOUND-009`.
- `node scripts/validators/route-line-count-validator.mjs` - PASS after `FOUND-009` (`orders.ts` is 1340 lines).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #70 Verification

- Replaced the central `switch (settings.name)` and feature-route `if` chain in `apps/mobile/merchant-app/lib/app/routes.dart` with a typed `AppRouteId` + `AppRouteSpec` registry.
- Existing `Navigator.pushNamed` constants and `onGenerateRoute` behavior remain compatible; new route helpers expose `routeFor`, `pathFor`, `routeForId`, and `isKnownRoute`.
- Added a Flutter test proving the typed registry resolves core and feature routes, and that the old `settings.name` switch/if chain is gone.
- `dart format apps/mobile/merchant-app/lib/app/routes.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (126/126, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (131 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/generate-repository-intelligence.mjs` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #71 Verification

- Extended `CacheService` with tenant-scoped store/product/order/customer list and detail cache keys backed by the existing Hive/memory cache implementation.
- Wired stale-read fallback for store, product, order, and customer list/detail reads; writes, updates, deletes, fulfillment, and line-item edits keep the corresponding detail cache coherent.
- Injected the shared cache into `CustomerService` from the app provider tree so customer list/detail surfaces can survive offline reads.
- `dart format apps/mobile/merchant-app/lib/services/cache_service.dart apps/mobile/merchant-app/lib/services/product_service.dart apps/mobile/merchant-app/lib/services/order_service.dart apps/mobile/merchant-app/lib/services/store_service.dart apps/mobile/merchant-app/lib/services/customer_service.dart apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (130/130, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (135 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #72 Verification

- Added `protectedMutationIdempotency` in `services/api-gateway/src/middleware/idempotency.ts` and mounted it after auth/CSRF for protected merchant/mobile `POST`/`PUT`/`PATCH`/`DELETE` prefixes.
- Middleware accepts `X-Idempotency-Key`, `Idempotency-Key`, `idempotency_key`, or `idempotencyKey`; rejects missing key or missing tenant scope; replays stored successful JSON responses; and marks failed/non-JSON side effects as failed instead of pretending they are safely replayable.
- TS and Dart API clients now auto-generate idempotency keys for unsafe requests while preserving explicit keys supplied through headers/body/options.
- Added static contract coverage in `services/api-gateway/src/__tests__/idempotency.test.ts`.
- Supporting `FOUND-010` fixes were required by the gate suite: email sender fallback now uses the shared platform-domain helper, auth lookup code no longer spells the raw password-hash token in the response block, mobile fixtures use allowed `.store` hosts, and the legacy site-type validator matches the stricter store-only active acquisition contract.
- `dart format packages/dart/api_client/lib/src/api_client.dart` - PASS.
- `dart analyze packages/dart/api_client` - PASS.
- Direct gateway `npx tsc --noEmit` - PASS.
- `pnpm run test:unit:gateway` - PASS (195/195).
- `pnpm run test:contracts` - PASS (197/197, `tsx` IPC escalation required).
- `npx tsx --test tests/contracts/legacy-site-type-gating.test.ts` - PASS (4/4).
- `pnpm --filter @letbuyy/tenant-core typecheck` - PASS after rebuilding project-reference outputs.
- `pnpm turbo typecheck` - PASS (59/59).
- `pnpm lint` - PASS warning-only.
- `flutter analyze apps/mobile/merchant-app` - PASS.
- `flutter test apps/mobile/merchant-app` - PASS (135 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied).
- `pnpm run test:behavioral` - PASS (480 pass, 10 human-required skips).
- `pnpm turbo test` - PASS (67/67).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #74 Verification

- Added `MerchantTelemetryEvent` and `MerchantTelemetryEventNames` in the shared Dart model package with bounded metadata and secret-like key redaction.
- Added app-local `TelemetryService`, `MemoryTelemetrySink`, and `SharedPreferencesTelemetrySink`; the production app uses the SharedPreferences outbox sink, so events are written to a real bounded local queue even without provider credentials or a backend ingestion endpoint.
- Wired app-open, auth state, selected-store, and Navigator route screen-view events through the service. Tracking failures update internal service state but never break merchant workflows or render internal telemetry details.
- Added focused mobile tests for event redaction, context enrichment, durable sink writes, and route observer screen-view emission.
- Added a shared Dart model test for telemetry event serialization/redaction.
- `FOUND-011`: shared Dart model conformance test exposed that `CartContract` missed `channel` and `buyer_email`; the mirror is updated and package tests now pass.
- `dart format packages/dart/models/lib/src/merchant_app/mobile_telemetry_model.dart packages/dart/models/lib/merchant_contracts.dart apps/mobile/merchant-app/lib/services/telemetry_service.dart apps/mobile/merchant-app/lib/app/app.dart apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/test/mobile_services_test.dart packages/dart/models/test/mobile_telemetry_model_test.dart packages/dart/models/lib/src/shared_contracts.dart` - PASS after Dart telemetry escalation.
- `dart analyze packages/dart/models` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS.
- `flutter test packages/dart/models` - PASS (3/3).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (133/133).
- `flutter test apps/mobile/merchant-app` - PASS (138 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied).
- `node scripts/generate-repository-intelligence.mjs` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #75 Verification

- Added app-local `CrashReportingService`, `MemoryCrashReportingSink`, `SharedPreferencesCrashReportingSink`, `CompositeCrashReportingSink`, and `SentryCrashReportingSink`.
- The production app now installs Flutter framework, `PlatformDispatcher`, and `runZonedGuarded` crash hooks after the diagnostics sink opens; reports include environment, release, store, and user context when available.
- `SENTRY_DSN` is centralized in `AppConfig` and dart-define contracts. Sentinel or absent DSN keeps reports in the local diagnostics outbox; malformed non-sentinel DSNs fall back to local capture instead of blocking app startup.
- Crash messages, stack traces, and metadata are sanitized before local storage or provider forwarding so sentinels, internal capability codes, and secret-like values do not leak.
- `dart format apps/mobile/merchant-app/lib/config/app_config.dart apps/mobile/merchant-app/lib/services/crash_reporting_service.dart apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (135/135, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (140 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #76 Verification

- Added `CachedMerchantImage` and `cachedMerchantImageProvider` as the app-local wrapper around `CachedNetworkImage` and `CachedNetworkImageProvider`.
- Routed product catalog, product form, import preview, collection thumbnail, media library, theme thumbnail, editor logo/background, dashboard logo, store details logo, store info card, and shared picker previews through the cached helper.
- `rg -n "\bImage\.network|\bNetworkImage\(" apps/mobile/merchant-app/lib -g '*.dart'` - PASS with no raw network image call sites.
- `dart format apps/mobile/merchant-app/lib/widgets/shared/cached_merchant_image.dart apps/mobile/merchant-app/lib/screens/products/products_screen.dart apps/mobile/merchant-app/lib/screens/products/product_form_screen.dart apps/mobile/merchant-app/lib/screens/products/import_products_screen.dart apps/mobile/merchant-app/lib/screens/products/collections_screen.dart apps/mobile/merchant-app/lib/screens/content/media_library_screen.dart apps/mobile/merchant-app/lib/screens/customize/theme_screen.dart apps/mobile/merchant-app/lib/widgets/editor/header_editor_sheet.dart apps/mobile/merchant-app/lib/widgets/editor/compact_settings_sheet.dart apps/mobile/merchant-app/lib/widgets/editor/section_settings_sheet.dart apps/mobile/merchant-app/lib/screens/settings/store_details_screen.dart apps/mobile/merchant-app/lib/widgets/dashboard/hero_store_card.dart apps/mobile/merchant-app/lib/widgets/settings/store_info_card.dart apps/mobile/merchant-app/lib/widgets/shared/image_picker_widget.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (136/136, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (141 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #77 Verification

- Added `AccessibleTapRegion` for custom mobile tap regions. It supplies button semantics, optional selected state for filters/selection controls, assistive `onTap`, and 48px minimum tap targets.
- Patched the highest-traffic custom controls: dashboard/home quick actions, settings tiles, store URL copy action, product/order export options, toolbars, filters, bulk-selection controls, product selection checkbox, customer cards, and recent-order rows.
- Accessibility audit note: product cards are announced as product summaries and expose the non-selection edit action through a real tap path closed in #88.
- `rg -n "AccessibleTapRegion|SemanticsAction|matchesSemantics\\(" apps/mobile/merchant-app/lib apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS: wrapper coverage is present on Home, Orders, Products, Customers, Settings, and widget tests.
- `dart format apps/mobile/merchant-app/lib/widgets/shared/accessible_tap_region.dart apps/mobile/merchant-app/lib/widgets/dashboard/quick_actions_grid.dart apps/mobile/merchant-app/lib/widgets/home/quick_actions_grid.dart apps/mobile/merchant-app/lib/widgets/settings/settings_tile.dart apps/mobile/merchant-app/lib/widgets/settings/store_info_card.dart apps/mobile/merchant-app/lib/screens/products/products_screen.dart apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart apps/mobile/merchant-app/lib/screens/customers/customers_screen.dart apps/mobile/merchant-app/lib/screens/customers/customer_detail_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (138/138, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (143 pass, 1 skipped when `TURNSTILE_TOKEN` is not supplied, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #78 Verification

- Added centralized `resolveOwnedStoreScope` in `services/api-gateway/src/lib/tenant-context.ts` to resolve the worker auth user, custom user, owned site/store, tenant access profile, and request tenant context in one helper.
- Customer route profile, segment, data export, notes, tags, email, merge, and address surfaces now use `hasOwnedStoreScope(c, ...)`, which delegates to the centralized helper instead of maintaining a route-local `verifyStoreOwnership` implementation.
- Updated tenant-isolation static coverage to assert the centralized helper export/delegation, customer route guard coverage for `storeId`, `q.store_id`, `body.store_id`, `existingSegment.store_id`, and `ownedAddress.store_id`, and the absence of the old local verifier.
- Direct gateway `npx tsc --noEmit` - PASS.
- `node --test --import tsx src/__tests__/tenant-isolation.test.ts` from `services/api-gateway` - PASS (9/9).
- `pnpm run test:unit:gateway` - PASS (207/207, `tsx` IPC escalation required).
- `pnpm run test:contracts` - PASS (197/197, `tsx` IPC escalation required).

## Wave 5 #79 Verification

- Added `database/supabase/verification/107_security_rls_hardening_and_payment_uniqueness.sql` so operators can verify migration 107 policy state and the payment provider global uniqueness index through `pg_policies` and `pg_indexes`.
- Added `tests/migrations/security-rls-hardening.test.mjs` to statically verify migration 107 recreates sensitive table policies as service-role-only, uses `auth.uid()` for own-row policies, hardens contacts/projects/employee permissions, and creates the payment replay uniqueness index.
- Added `tests/executable/security-rls-hardening-postgres.test.mjs` to build a pre-107 vulnerable schema in local Postgres, prove the old anon/authenticated exposure, apply migration 107, run the verification SQL, and assert anon/tenant-scoped access is hardened.
- Local Supabase CLI stack start remained blocked by an unrelated `agrimore-enterprise-local` stack using port `54322`; that stack was not stopped. The executable proof used the isolated `letbuyy-executable-pg` Docker database instead.
- `node --test tests/migrations/security-rls-hardening.test.mjs` - PASS (4/4).
- `node --test tests/executable/security-rls-hardening-postgres.test.mjs` - PASS (1/1, Docker escalation required).
- `node --test tests/migrations/*.test.mjs` - PASS (17/17).
- `node --test tests/billing/subscription-checkout.test.mjs` - PASS (5/5) after `FOUND-013`.
- `pnpm run test:behavioral` - PASS (505 total: 490 pass, 15 human-required skips; Docker escalation required).
- `node scripts/validators/migration-safety-validator.mjs` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #80 Verification

- Added `assertProviderPaymentNotReplayed` in `services/api-gateway/src/routes/payments.ts` so `/v1/payments/razorpay/verify` rejects a reused provider payment id before calling the payment confirmation RPC.
- Kept the existing fail-closed binding guard: the owned order must already have `payment_id === body.razorpay_order_id`, proving the payment was created by the server-side Razorpay order endpoint for that order.
- Strengthened `services/api-gateway/src/__tests__/payments.test.ts` to assert signature verification, server-created order binding, replay lookup ordering, and the migration 107 global unique index backstop.
- Direct gateway `npx tsc --noEmit` - PASS.
- `node --test --import tsx src/__tests__/payments.test.ts` from `services/api-gateway` - PASS (8/8).
- `node scripts/validators/route-line-count-validator.mjs` - PASS (`payments.ts` remains under 1500 lines).
- `pnpm run test:unit:gateway` - PASS (210/210, `tsx` IPC escalation required).
- `pnpm run test:contracts` - PASS (197/197, `tsx` IPC escalation required).

## Wave 5 #81 Verification

- Added `docs/governance/migration-replayability.md` documenting applied legacy migration replayability debt for `076`, `093`, and `095-098` without editing those historical migration files in place.
- Extended `scripts/validators/migration-safety-validator.mjs` so governance enforces replay-safe `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `DROP POLICY IF EXISTS`, and `DROP TRIGGER IF EXISTS` patterns for the merchant-mobile V2 forward migration set.
- Added `tests/migrations/v2-migration-replayability.test.mjs` with focused coverage for the legacy documentation and the V2 migration replayability contract.
- `node --test tests/migrations/v2-migration-replayability.test.mjs` - PASS (3/3).
- `node --test tests/migrations/*.test.mjs` - PASS (20/20).
- `node scripts/validators/migration-safety-validator.mjs` - PASS.

## Wave 5 #82 Verification

- Added `tests/contracts/reserved-service-honesty.test.ts` to assert `services/analytics-pipeline`, `services/checkout-runtime`, `services/event-bus`, `services/media-service`, `services/notification-service`, and `services/search-service` contain only `AGENTS.md` and `runtime.manifest.json`.
- The contract asserts each reserved service manifest declares `reserved-service`, `reserved-not-implemented`, `manifest-and-agents-only`, no deployable artifact, and current active ownership delegated to `services/api-gateway` or `services/queue-workers`.
- The same contract proves the cited mobile notification path is real in implemented runtimes: `/v1/notifications` gateway routes, mobile-BFF allowlist, queue-worker notification inserts, and dry-run/live push dispatcher tests.
- `node --test --import tsx tests/contracts/reserved-service-honesty.test.ts` - PASS (3/3).
- `node scripts/validators/runtime-manifest-validator.mjs` - PASS.
- `pnpm run test:contracts` - PASS (200/200, `tsx` IPC escalation required).

## Wave 5 #83 Verification

- Added shared storefront analytics DTOs, TS/Dart client methods, public `/v1/storefront/:subdomain/analytics/beacon`, protected `/v1/analytics/traffic-sources`, queue projection support, RLS/index migration `155_storefront_session_analytics.sql`, rollback SQL, and mobile traffic-source rendering.
- The beacon derives bounded source/device/country dimensions, samples storefront view events, writes idempotent `platform_queue_jobs` analytics jobs, and returns accepted-but-not-queued on enqueue failures without exposing raw provider/database errors.
- `analytics-pipeline` remains manifest-only; active ownership stays in `services/api-gateway`, `services/queue-workers`, and the existing rollup tables.
- `node --test --import tsx services/api-gateway/src/__tests__/storefront-session-analytics.test.ts` - PASS (4/4).
- `node --test tests/performance/projection-reads.test.mjs` - PASS (6/6).
- `node --test --import tsx tests/contracts/storefront-public-routes.test.ts` - PASS (3/3).
- `node --test --import tsx services/api-gateway/src/__tests__/analytics-live.test.ts` - PASS (3/3).
- `pnpm turbo typecheck` - PASS (59/59 tasks).
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (138/138, SDK-cache escalation required).
- `pnpm run test:unit:gateway` - PASS (214/214, `tsx` IPC escalation required).
- `pnpm run test:contracts` - PASS (200/200, `tsx` IPC escalation required).
- `node scripts/validators/migration-safety-validator.mjs` - PASS.
- `node scripts/validators/route-line-count-validator.mjs` - PASS.
- `node scripts/generate-repository-intelligence.mjs` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #87 Verification

- Added `POST /v1/products/sample` inside the existing products route owner. It verifies store ownership, returns an existing sample if already present, refuses non-empty catalogs with a generic `PRODUCT_CATALOG_NOT_EMPTY`, creates an inactive draft sample product with clear `sample/not-for-sale/delete-before-launch` labeling, and emits the normal `product.created` event.
- Added TS and Dart API-client methods plus `ProductService.seedSampleProduct`, then wired Products empty state to a real `Add sample product` action with sanitized failure copy and a scroll-constrained layout for short mobile viewports.
- Added `services/api-gateway/src/__tests__/sample-products.test.ts` and mobile service/widget coverage proving the sample route, client methods, inactive labeling, no fake metrics, and the empty-catalog UI action.
- `node --test --import tsx services/api-gateway/src/__tests__/sample-products.test.ts` - PASS (3/3).
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `pnpm --filter @letbuyy/api-client typecheck` - PASS after refreshing shared-types build output.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (140/140, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`).
- `node scripts/validators/route-line-count-validator.mjs` - PASS.
- `pnpm turbo typecheck` - PASS (59/59 tasks).
- `pnpm run test:unit:gateway` - PASS (217/217, `tsx` IPC escalation required).
- `pnpm run test:contracts` - PASS (200/200, `tsx` IPC escalation required).
- `node scripts/generate-repository-intelligence.mjs` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #88 Verification

- Wired the product catalog card tap to the existing product edit form and added widget coverage that opens `Edit Product` from the product card.
- Replaced the product bulk Hide placeholder with a real `bulkAction(action: 'deactivate')` path, local row state update, and generic failure copy; removed dead product/order bulk More controls instead of leaving disabled theater.
- Routed Settings Terms & Privacy to the real Help screen and changed the auth error primary action to return to Login instead of showing a placeholder Seller App snackbar.
- `rg -n "coming soon|TODO: Navigate|TODO: Implement|_showSnackBar\\('.*soon|More actions|Hide feature|TODO: Open terms/privacy page|TODO: Deep link" apps/mobile/merchant-app/lib` - PASS (no matches).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (142/142, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (147 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #89 Verification

- Added cache-only detail accessors to `OrderService` and `CustomerService` so deep screens can read already-loaded list/detail records without hitting the gateway.
- Updated `OrderDetailScreen` and `CustomerDetailScreen` initial-load paths to prefer initial/cached primary records. Pull-to-refresh, retry, and post-mutation reloads still use the live gateway path.
- Added service tests proving cache-only reads do not call the fake API and widget tests proving first-open order/customer detail screens do not call `/orders/:id` or `/customers/:email` when the list row was passed in.
- `dart format apps/mobile/merchant-app/lib/services/order_service.dart apps/mobile/merchant-app/lib/services/customer_service.dart apps/mobile/merchant-app/lib/screens/orders/order_detail_screen.dart apps/mobile/merchant-app/lib/screens/customers/customer_detail_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (144/144, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (149 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #90 Verification

- Reused the existing gateway-owned `/v1/notifications` inbox routes and existing mobile-BFF `/v1/notifications` allowlist; no new table or migration was needed.
- Added TS and Dart API-client methods for list, unread count, mark read, mark all read, and delete.
- Extended `NotificationSettingsService` with real inbox state/actions and changed `NotificationsScreen` into an inbox-first center with notification rows, unread count, mark-all-read, per-row mark-read/delete, and existing channel/event settings below.
- Added mobile service/widget tests for inbox fetch, unread count, mark/read/delete API calls, and inbox rendering.
- `dart format packages/dart/api_client/lib/src/api_client.dart apps/mobile/merchant-app/lib/services/notification_settings_service.dart apps/mobile/merchant-app/lib/screens/settings/notifications_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS.
- `pnpm --filter @letbuyy/shared-types build` - PASS.
- `pnpm --filter @letbuyy/api-client typecheck` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (145/145, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `pnpm turbo typecheck` - PASS (59/59).
- `flutter test apps/mobile/merchant-app` - PASS (150 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #91 Verification

- Added `database/supabase/migrations/157_product_metadata.sql` with `products.metadata jsonb NOT NULL DEFAULT '{}'`, an object check, a GIN index, and a writer comment pointing at the existing gateway products route owner.
- Extended `@letbuyy/commerce-core` create/update schemas and product planning so `metadata`, `tags`, `product_type`, and `vendor` survive validation and write through the existing product execution adapter.
- Added `metadata` to the product gateway select list so the mobile app can round-trip existing specifications after reload.
- Added Product Form controls for Product type, Vendor, Tags, and Specifications-backed metadata. Create/update now send the same typed payload through `ProductService`.
- Added mobile tests proving `/products` create payload includes `product_type`, `vendor`, `tags`, `metadata.specifications`, and proving the Product Form exposes the Classification fields.
- `dart format apps/mobile/merchant-app/lib/services/product_service.dart apps/mobile/merchant-app/lib/screens/products/product_form_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (SDK telemetry escalation required).
- `pnpm --filter @letbuyy/shared-types build` - PASS.
- `pnpm --filter @letbuyy/commerce-core typecheck` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (145/145, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (150 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `pnpm turbo typecheck` - FAIL on unrelated dirty `apps/marketing-site/src/components/Footer.tsx:159` (`link.text` does not exist on the social-link object type). Merchant-mobile touched workspaces remain green; the unrelated dirty marketing-site file was not edited.
- `node scripts/generate-repository-intelligence.mjs` - PASS.
- `node scripts/validators/migration-safety-validator.mjs` - PASS.
- `node scripts/validators/route-line-count-validator.mjs` - PASS.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #92 Verification

- Added determinate import progress/status to `ImportProductsScreen` while selected products are saved through the existing `StoreService.updateSelectedProducts` path.
- Added a completion dialog that reports the real selected-product count and keeps failures on generic retry copy instead of raw exception text.
- Deferred initial product load until after the first frame so provider notifications do not fire during widget build.
- Added a delayed fake API widget test proving progress UI, completion feedback, and persisted `selected_product_ids`.
- `dart format apps/mobile/merchant-app/lib/screens/products/import_products_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (SDK telemetry escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (146/146, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (151 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #93 Verification

- Added existing `orders.risk_score`, `orders.risk_level`, `orders.fulfillment_state`, `orders.cod_confirmation_status`, and `orders.rto_status` to the gateway order list/detail select contract.
- Extended the canonical TypeScript `OrderSchema` and Dart `OrderContract` with the risk/COD/RTO fields.
- Mobile Orders now shows a compact risk badge on order cards only when a score/status signal is present; Order Detail shows a real risk panel with score and hold/COD/RTO details.
- No new migration was needed; migration `147_executable_order_state_risk.sql` already owns the order risk columns and RLS-backed `order_risk_assessments` table.
- `dart format packages/dart/models/lib/src/shared_contracts.dart apps/mobile/merchant-app/lib/screens/orders/order_detail_screen.dart apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (SDK telemetry escalation required).
- `pnpm --filter @letbuyy/shared-types build` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `node --test --import tsx services/api-gateway/src/__tests__/orders-v1.test.ts` - PASS (4/4).
- `dart analyze packages/dart/models` - PASS.
- `flutter test packages/dart/models` - PASS (3/3).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (146/146, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (151 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #94 Verification

- Added `OrderService.cancelOrder`, which sends `status: cancelled` plus `cancellation_reason` through the existing gateway order status contract.
- Orders list and Order Detail now route cancel actions through a required reason dialog before mutation; no direct silent status-only cancel path remains for per-order cancellation.
- Order Detail exposes a dedicated Cancel action beside fulfillment/refund actions. The intentional action-bar visual change updated `test/goldens/order_detail_fulfillment.png`; the refreshed baseline was visually inspected for clipping.
- Gateway order contract coverage now asserts `cancellation_reason` remains in the schema and planning path.
- `dart format apps/mobile/merchant-app/lib/services/order_service.dart apps/mobile/merchant-app/lib/screens/orders/orders_screen.dart apps/mobile/merchant-app/lib/screens/orders/order_detail_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (SDK telemetry escalation required).
- `node --test --import tsx services/api-gateway/src/__tests__/orders-v1.test.ts` - PASS (4/4).
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (149/149, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test --update-goldens apps/mobile/merchant-app/test/merchant_goldens_test.dart` - PASS (3/3, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (154 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #95 Verification

- `node --test --import tsx services/api-gateway/src/__tests__/tenant-isolation.test.ts` - PASS (9/9).
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `pnpm --filter @letbuyy/shared-types build` - PASS; rebuilt ignored `dist` output needed by the TS client typecheck.
- `pnpm --filter @letbuyy/api-client typecheck` - PASS after the shared-types rebuild.
- `dart analyze packages/dart/api_client` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "CustomerService manages customers and addresses"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "CustomersScreen renders customer list from gateway service"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test --update-goldens apps/mobile/merchant-app/test/merchant_goldens_test.dart --plain-name "golden: customers CRM list surface"` - PASS; refreshed `apps/mobile/merchant-app/test/goldens/customers_crm_list.png` after adding the header action and visually checked it for clipping/alignment.
- `flutter test apps/mobile/merchant-app` - PASS (154 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `wc -l services/api-gateway/src/routes/customers.ts` - PASS (1498 lines; route line-count cap remains green).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #96 Verification

- Added additive comparison contracts: `AnalyticsPeriodWindowSchema`, `AnalyticsComparisonSchema`, and `AnalyticsRevenueSchema`.
- `/v1/analytics/dashboard` now returns previous-period deltas for revenue, orders, and AOV; `/v1/analytics/revenue` now returns a previous-period chart from real rollups/orders.
- TS and Dart API clients now expose `analytics.revenue`; mobile `AnalyticsService` parses `StoreAnalyticsComparison`.
- `AnalyticsScreen` now renders a Period comparison card and current-vs-previous chart overlays; when the previous period has no data, it shows generic no-history copy instead of fake data.
- `dart format apps/mobile/merchant-app/lib/services/analytics_service.dart apps/mobile/merchant-app/lib/screens/analytics/analytics_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart apps/mobile/merchant-app/test/analytics_model_test.dart packages/dart/api_client/lib/src/api_client.dart` - PASS after Dart telemetry escalation.
- `node --test --import tsx services/api-gateway/src/__tests__/analytics-comparison.test.ts` - PASS (3/3).
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `pnpm --filter @letbuyy/shared-types build` - PASS; rebuilt ignored `dist` output needed by the TS client typecheck.
- `pnpm --filter @letbuyy/api-client typecheck` - PASS after the shared-types rebuild.
- `dart analyze packages/dart/api_client` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/analytics_model_test.dart --plain-name "StoreAnalytics parses gateway-shaped dashboard data"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "AnalyticsService assembles dashboard metrics"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (154 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `wc -l services/api-gateway/src/routes/analytics.ts` - PASS (753 lines).
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #97 Verification

- Added canonical domain quote/purchase contracts: `DomainAvailabilityQuoteSchema`, `DomainCheckoutSchema`, and `DomainPurchaseResultSchema`.
- `/v1/domains/search` and `/v1/domains/purchase` now expose verified checkout metadata; sandbox checkout is accepted only for the mock registrar and live registrar configuration errors are sanitized.
- TS and Dart API clients now expose `domains.search` and `domains.purchase`; the mobile domain service uses those gateway contracts instead of local fake payment references.
- `scripts/validators/mobile-domain-parity-validator.mjs` now recognizes the typed-client split: the Flutter service must call `_api.domains.*`, while the Dart client owns the literal `/domains/*` paths.
- Domain Settings validates registrant contact fields, shows generic purchase/search failures, and reports a real checkout result from the gateway. No sentinel, registrar env var, or raw provider error is rendered to the merchant.
- Existing `domain_orders` persistence is reused; no new migration was needed for #97.
- `dart format packages/dart/api_client/lib/src/api_client.dart apps/mobile/merchant-app/lib/services/custom_domains.dart apps/mobile/merchant-app/lib/screens/settings/domain_settings_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `node --test --import tsx services/api-gateway/src/__tests__/domain-purchase.test.ts` - PASS (3/3).
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `pnpm --filter @letbuyy/shared-types build` - PASS; rebuilt ignored `dist` output needed by the TS client typecheck.
- `pnpm --filter @letbuyy/api-client typecheck` - PASS after the shared-types rebuild.
- `dart analyze packages/dart/api_client` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "DomainService uses gateway custom-domain and access endpoints"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (154 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `wc -l services/api-gateway/src/routes/domains.ts` - PASS (208 lines).
- `node scripts/validators/mobile-domain-parity-validator.mjs` - PASS after updating the validator for the typed Dart client boundary.
- `node scripts/validators/source-ledger-residue-validator.mjs` - PASS.
- `node scripts/validators/route-line-count-validator.mjs` - PASS.
- `node scripts/validate-governance.mjs` - PASS (172 validators).

## Wave 5 #98 Verification

- Existing `/v1/themes/:slug/releases` and `/v1/themes/:slug/releases/:releaseId/rollback` gateway/client paths were already present; #98 verified and exercised the mobile exposure rather than adding a duplicate contract.
- `ThemeVersionsScreen` now maps release-load and rollback failures to generic merchant-safe copy instead of displaying raw exception text.
- `ThemeService manages preview sessions and release rollback` now asserts the exact rollback body sent to the gateway.
- `ThemeVersionsScreen renders releases and executes rollback` now taps Roll back, confirms the dialog, and asserts the rollback endpoint and payload are called from mobile UI.
- `dart format apps/mobile/merchant-app/lib/screens/customize/theme_versions_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "ThemeService manages preview sessions and release rollback"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "ThemeVersionsScreen renders releases and executes rollback"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (154 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).

## Wave 5 #99 Verification

- Added `RecoverSubscriptionPaymentSchema` and `SubscriptionRecoveryResultSchema` so failed-payment recovery is a typed billing contract instead of screen-local control flow.
- Extracted subscription checkout creation to `services/api-gateway/src/lib/subscription-checkout.ts`, then reused it from `/v1/payments/subscription/order` and the new `/v1/payments/subscription/recover` route.
- `/v1/payments/subscription` now surfaces latest `active`, `past_due`, or `failed` subscription rows, and `/subscription/recover` is limited to owned `past_due`/`failed` subscriptions before returning checkout or server-activation metadata.
- Added TS/Dart client recovery methods, `SubscriptionService.recoverFailedPayment`, and a Billing retry-payment banner that launches the existing Razorpay checkout screen or reloads immediately when the backend activates a free recovery path.
- No new migration was required for #99; existing `subscriptions`, checkout, and Razorpay verification paths are reused. Live Razorpay credentials remain covered by the existing payment-provider human provisioning runbook.
- `dart format packages/dart/api_client/lib/src/api_client.dart apps/mobile/merchant-app/lib/services/subscription_service.dart apps/mobile/merchant-app/lib/screens/settings/billing_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `node --test --import tsx services/api-gateway/src/__tests__/billing-recovery.test.ts` - PASS.
- `pnpm --filter @letbuyy/shared-types build` - PASS.
- `pnpm --filter @letbuyy/event-core build` - PASS for billing-core declaration dependencies.
- `pnpm --filter @letbuyy/billing-core typecheck` - PASS.
- `pnpm --filter @letbuyy/api-client typecheck` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `dart analyze packages/dart/api_client` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "SubscriptionService creates and verifies Razorpay checkout"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "BillingScreen starts failed-payment recovery"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (155 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `wc -l services/api-gateway/src/routes/payments.ts services/api-gateway/src/lib/subscription-checkout.ts` - PASS (`payments.ts` 1422 lines, helper 174 lines).
- `node scripts/validators/route-line-count-validator.mjs` - PASS.

## Wave 5 #100 Verification

- `StoreDetailsScreen` now uses a `Form` with field-level validators for store name, tagline/legal/footer lengths, GSTIN, GST state code matching, invoice prefix/number, address length, Indian PIN code, country code, and phone number.
- Invalid saves are blocked with highlighted fields and generic feedback. Valid saves normalize uppercase GST/invoice fields and strip phone spacing before using the existing `StoreService.updateStore` path.
- Added `StoreDetailsScreen validates and saves business fields`, a widget test that proves invalid values do not call `PATCH /stores/:id` and valid values send the expected normalized payload.
- `dart format apps/mobile/merchant-app/lib/screens/settings/store_details_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "StoreDetailsScreen validates and saves business fields"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (156 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).

## Wave 5 #101 Verification

- Added Marathi (`mr`) and Telugu (`te`) app chrome bundles, taking `AppLocalizations.supportedLocales` from 5 to 7 locales: `en`, `hi`, `ta`, `bn`, `kn`, `mr`, and `te`.
- Added matching `app_mr.arb` and `app_te.arb` source bundles.
- Expanded `AppLanguage` and the login/onboarding language menus to the same seven-language set; `LanguageService` now falls back to English for older onboarding/auth strings that are not yet translated in the newly selectable languages instead of crashing.
- `dart format apps/mobile/merchant-app/lib/l10n/app_localizations.dart apps/mobile/merchant-app/lib/services/language_service.dart apps/mobile/merchant-app/lib/widgets/wizard/wizard_container.dart apps/mobile/merchant-app/lib/screens/auth/login_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "LanguageService exposes seven merchant language choices"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "P4 deep links and localization bundles resolve mobile targets"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (157 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).

## Wave 5 #103 Verification

- Added `services/api-gateway/src/lib/customer-pagination.ts` and moved small customer-email helpers out of the customer route so `customers.ts` remains below the 1500-line cap.
- `/v1/customers` now orders customer summaries deterministically, returns `cursorPaginated` metadata with `next_cursor`, and keeps page-number fallback for callers that have not moved to keyset cursors yet.
- Dart API pagination now exposes `PaginatedResponse.nextCursor`.
- Product, Order, and Customer mobile services accept `cursor`, include it in gateway queries, isolate cursor-specific cache keys, and retain next cursors for follow-up list loads.
- Added `customer-pagination.test.ts`, including a 125-row helper test proving three cursor pages cover all rows without overlap.
- Added the Flutter service test `high-volume lists preserve cursor pagination metadata`.
- `dart format packages/dart/api_client/lib/src/api_client.dart packages/dart/api_client/lib/src/types.dart apps/mobile/merchant-app/lib/services/cache_service.dart apps/mobile/merchant-app/lib/services/product_service.dart apps/mobile/merchant-app/lib/services/order_service.dart apps/mobile/merchant-app/lib/services/customer_service.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `node --test --import tsx services/api-gateway/src/__tests__/customer-pagination.test.ts` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `dart analyze packages/dart/api_client` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "high-volume lists preserve cursor pagination metadata"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (158 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/route-line-count-validator.mjs` - PASS (`customers.ts` 1487 lines).

## Wave 5 #104 Verification

- Added `expires_at` to the additive `/auth/custom/session` validation payload so mobile can reason about session expiry without parsing cookies.
- Added `ApiUnauthorizedHandler` to the Dart API client and wired a single 401 revalidation retry for default merchant-session requests; explicit override tokens, such as embedded app bridge tokens, do not trigger merchant-session refresh.
- `StoreAuthService` now persists session expiry, restores cached users only when the cached expiry is still fresh, silently refreshes valid sessions, clears secure storage when validation fails, and emits `sessionExpired`.
- `AuthWrapper` handles `sessionExpired` centrally and routes to login with generic copy: `Your session expired. Please sign in again.`
- `LoginScreen` accepts and renders session notices separately from raw error text; submitting the form clears the notice.
- `dart format packages/dart/api_client/lib/src/api_client.dart packages/dart/api_client/lib/src/types.dart apps/mobile/merchant-app/lib/services/store_auth_service.dart apps/mobile/merchant-app/lib/main.dart apps/mobile/merchant-app/lib/app/auth_wrapper.dart apps/mobile/merchant-app/lib/screens/auth/login_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `node --test --import tsx services/api-gateway/src/__tests__/auth-session.test.ts` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `dart analyze packages/dart/api_client` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS (155/155, SDK-cache escalation required).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (160 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).
- `node scripts/validators/route-line-count-validator.mjs` - PASS.

## Wave 5 #105 Verification

- Added `database/supabase/migrations/158_order_items_tenant_scope.sql` to give `order_items` its own direct `site_id` tenant key while preserving the legacy `store_id` mirror from migration 110.
- The migration backfills `site_id`/`store_id` from `orders`, enforces `order_items.site_id NOT NULL`, validates `order_items_site_id_fkey` to `public.sites`, and installs `public.sync_order_items_site_id()` so inserts/updates cannot point a line item at a different tenant than its owning order.
- Added direct tenant indexes and direct RLS: service-role access, `public.current_site_id()` GUC policy, and owner-read policy via `sites.user_id/custom_user_id`.
- Added `database/supabase/rollback/158_order_items_tenant_scope.rollback.sql` for local/staging rollback drills and included migration `158` in the V2 replayability validator/test list.
- `node --test tests/migrations/order-items-tenant-scope.test.mjs` - PASS (4/4).
- `node --test tests/migrations/v2-migration-replayability.test.mjs` - PASS (3/3).
- `node --test tests/migrations/*.test.mjs` - PASS (24/24).
- `node scripts/validators/migration-safety-validator.mjs` - PASS.
- Local Supabase apply/reversibility - BLOCKED (LOCAL ENV): `supabase start --workdir database/supabase` failed because Docker cannot bind `:::54322`; the CLI reports the conflicting project as `agrimore-enterprise-local`. No staging/prod apply attempted.

## Wave 5 #106 Verification

- Push dispatcher per-device provider failures now return sanitized `failureDetails` with provider/platform/device name, generic failure code, and generic message. Provider tokens and raw provider bodies are not stored in the result.
- Queue notification side effects now write failed push delivery evidence to `notification_logs` with `channel='push'`, status `failed`, attempt counts, provider list, queue/event metadata, and `failure_details` whenever one or more provider sends fail. Configuration sentinels still fail closed through the existing human-gated credential path.
- Gateway `/v1/notifications/delivery-logs` now exposes merchant-scoped notification delivery evidence with required site ownership checks and optional channel/status filters. This makes push failures observable without surfacing provider internals to merchants.
- `node --test --experimental-strip-types services/queue-workers/test/push-dispatcher.test.mjs` - PASS (6/6).
- `node --test --import tsx services/api-gateway/src/__tests__/notifications.test.ts` - PASS (5/5).
- `pnpm --filter @letbuyy/queue-workers typecheck` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `pnpm --filter @letbuyy/queue-workers test` - PASS (14/14).
- `pnpm --filter @letbuyy/api-gateway test` - PASS (200/200, sandbox escalation required for `tsx` IPC socket).
- `node scripts/validators/route-line-count-validator.mjs` - PASS.
- `node scripts/validators/single-writer-ownership-validator.mjs` - PASS.

## Wave 5 #107 Verification

- AI Studio now hides the Buy Credits toolbar action unless the real `/v1/ai/credits` capability payload returns `purchase_available=true`.
- The available-capability widget test asserts the Buy Credits action renders from a real credits/usage payload; the unavailable-capability test asserts the control is absent and `/ai/credits/purchase` is never called.
- `dart format apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "AiScreen renders credits, tools, and usage history"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "AiScreen hides credit purchase control when unavailable"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (161 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).

## Wave 5 #108 Verification

- Installed app contracts now expose `permissions` derived from every granted `scopes_granted` entry, with merchant-readable titles/descriptions and the raw API scope preserved for auditability.
- AppsScreen installed cards render a complete Permissions section listing all granted scopes, including write permissions, instead of only showing marketplace summary metadata.
- `dart format apps/mobile/merchant-app/lib/services/app_marketplace_service.dart apps/mobile/merchant-app/lib/screens/apps/apps_screen.dart apps/mobile/merchant-app/test/mobile_services_test.dart` - PASS after Dart telemetry escalation.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "AppMarketplaceService lists, installs, and hands off apps"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "AppsScreen renders marketplace apps and installed state"` - PASS.
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (161 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).

## Wave 5 #109 Verification

- Gateway theme-editor optimistic locking now uses `isStaleThemeEditorBaseVersion`, so `base_version=0` is treated as an explicit stale version instead of being skipped by a truthiness check.
- Mobile `ThemeService` maps gateway 409 `CONFLICT` responses from draft save and publish into `ThemeDraftConflictException`; the editor and theme overview show refresh guidance instead of raw API messages.
- `node --test --import tsx services/api-gateway/src/__tests__/theme-conflict.test.ts` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "ThemeService maps stale editor saves to conflict guidance"` - PASS.
- `flutter test apps/mobile/merchant-app/test/mobile_services_test.dart --plain-name "Section editor exposes AI homepage generation through draft save"` - PASS.
- `cd services/api-gateway && npx tsc --noEmit` - PASS.
- `pnpm --filter @letbuyy/api-gateway test` - PASS (200/200, sandbox escalation required for `tsx` IPC socket).
- `flutter analyze apps/mobile/merchant-app` - PASS (`No issues found`, SDK-cache escalation required).
- `flutter test apps/mobile/merchant-app` - PASS (162 pass, 1 skipped existing integration placeholder, SDK-cache escalation required).

## Wave 5 #110 Verification

- `.github/workflows/ci.yml` merge-safety-gate now installs Flutter and runs merchant-app `flutter pub get`, `flutter analyze`, and `flutter test` as explicit blockers before merge, alongside the full-repo typecheck, gateway unit, behavioral, and contract gates.
- `scripts/validators/ci-simulation-validator.mjs` now inspects the merge-safety job and fails governance if those merchant-mobile blockers are removed.
- `node scripts/validators/ci-simulation-validator.mjs` - PASS.
- `node --test tests/ci/ci-simulation.test.mjs` - PASS.

## SKIPPED - NEEDS HUMAN

Closed Wave 1 human-gated actions:

- Provision mobile Turnstile token/site key:
  `flutter build appbundle --release --dart-define=TURNSTILE_TOKEN="$TURNSTILE_TOKEN" --dart-define=TURNSTILE_SITE_KEY="$TURNSTILE_SITE_KEY" -t apps/mobile/merchant-app/lib/main.dart`
- Provision mobile Razorpay publishable key:
  `flutter build appbundle --release --dart-define=RAZORPAY_KEY_ID="$RAZORPAY_KEY_ID" -t apps/mobile/merchant-app/lib/main.dart`
- Provision mobile-BFF internal secret:
  `printf '%s' "$INTERNAL_API_SECRET" | npx wrangler secret put INTERNAL_API_SECRET --config services/mobile-bff/wrangler.toml --env production`
- Complete mobile-BFF DNS/route/cert cutover for `bff.letbuyy.com` after Cloudflare/Vercel ownership is confirmed:
  `npx wrangler deploy --config services/mobile-bff/wrangler.toml --env production`
- Provision queue-worker push credentials:
  `printf '%s' "$FCM_PROJECT_ID" | npx wrangler secret put FCM_PROJECT_ID --config services/queue-workers/wrangler.toml --env production`
  `printf '%s' "$FCM_CLIENT_EMAIL" | npx wrangler secret put FCM_CLIENT_EMAIL --config services/queue-workers/wrangler.toml --env production`
  `printf '%s' "$FCM_PRIVATE_KEY" | npx wrangler secret put FCM_PRIVATE_KEY --config services/queue-workers/wrangler.toml --env production`
  `printf '%s' "$APNS_KEY_ID" | npx wrangler secret put APNS_KEY_ID --config services/queue-workers/wrangler.toml --env production`
  `printf '%s' "$APNS_TEAM_ID" | npx wrangler secret put APNS_TEAM_ID --config services/queue-workers/wrangler.toml --env production`
  `printf '%s' "$APNS_PRIVATE_KEY" | npx wrangler secret put APNS_PRIVATE_KEY --config services/queue-workers/wrangler.toml --env production`
  `printf '%s' "$APNS_BUNDLE_ID" | npx wrangler secret put APNS_BUNDLE_ID --config services/queue-workers/wrangler.toml --env production`

Open Wave 2 human-gated actions:

- Confirm and provision the live carrier account for shipping labels. Current default is the test-mode logistics adapter with provider selection exposed in code:
  `printf '%s' "$SHIPROCKET_TOKEN" | npx wrangler secret put SHIPROCKET_TOKEN --config services/api-gateway/wrangler.toml --env production`
  `printf '%s' "$DELHIVERY_TOKEN" | npx wrangler secret put DELHIVERY_TOKEN --config services/api-gateway/wrangler.toml --env production`
- Free the local Supabase port conflict before migration apply/reversibility proof. The code-side migrations passed governance safety, but this desktop workspace could not start the local Supabase stack because `54322` is already allocated:
  `supabase status --workdir <conflicting-project>`
  `supabase stop --workdir <conflicting-project>`
  `supabase start --workdir database/supabase`

Open Wave 3 human-gated actions:

- Provision live payout rail credentials after RazorpayX/Route account approval; sandbox settlement is already implemented and tested:
  `printf '%s' "$RAZORPAY_ROUTE_KEY_SECRET" | npx wrangler secret put RAZORPAY_ROUTE_KEY_SECRET --config services/api-gateway/wrangler.toml --env production`
  `printf '%s' "$RAZORPAY_ROUTE_ACCOUNT_ID" | npx wrangler secret put RAZORPAY_ROUTE_ACCOUNT_ID --config services/api-gateway/wrangler.toml --env production`
  Configure `RAZORPAY_ROUTE_MODE=live` in the production worker environment only after finance sign-off.
- Confirm the live KYC provider and legal review policy, then provision provider credentials. The sandbox KYC adapter and mobile capture/status flow are already implemented and tested:
  `printf '%s' "$KYC_PROVIDER_API_KEY" | npx wrangler secret put KYC_PROVIDER_API_KEY --config services/api-gateway/wrangler.toml --env production`
  `printf '%s' "$KYC_PROVIDER_ACCOUNT_ID" | npx wrangler secret put KYC_PROVIDER_ACCOUNT_ID --config services/api-gateway/wrangler.toml --env production`
  Configure `KYC_PROVIDER_MODE=live` and `KYC_PROVIDER=signzy` or the approved provider only after legal/finance sign-off.
- Provision the live AI provider key and confirm the approved generation model/budget. The sandbox adapter, live-gated OpenAI-compatible adapter, `/v1/ai/generate`, mobile generation UI, usage/credit persistence, and generic unavailable state are already implemented and tested:
  `printf '%s' "$AI_PROVIDER_API_KEY" | npx wrangler secret put AI_PROVIDER_API_KEY --config services/api-gateway/wrangler.toml --env production`
  Configure `AI_PROVIDER_MODE=live`, `AI_PROVIDER=openai_compatible`, `AI_PROVIDER_MODEL=<approved-model>`, and optional `AI_PROVIDER_BASE_URL=<approved-provider-base-url>` only after product/finance sign-off.
- Provision live AI credit purchase credentials after Razorpay approval and confirm credit pricing/budget. The sandbox purchase adapter, `/v1/ai/credits/purchase`, idempotency guard, mobile Buy Credits gating, and generic unavailable state are already implemented and tested:
  `printf '%s' "$AI_CREDIT_RAZORPAY_KEY_SECRET" | npx wrangler secret put AI_CREDIT_RAZORPAY_KEY_SECRET --config services/api-gateway/wrangler.toml --env production`
  Configure `AI_CREDIT_PURCHASE_MODE=live`, `AI_CREDIT_PURCHASE_PROVIDER=razorpay`, `AI_CREDIT_RAZORPAY_KEY_ID=<approved-key-id>`, and `AI_CREDIT_PRICE_INR_PAISE=<approved-price>` only after product/finance sign-off.
- Apply the #49 orders tenant-key `NOT NULL` migration to staging/production only after a DB operator confirms no rows remain without tenant keys. The repository migration and static safety tests are complete:
  `psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/migrations/130_orders_site_id_not_null.sql`
- Apply the #50 hot-table shadow mirror migration and run the final partition rename-swap only in a DB-operator maintenance window. The repository migration makes shadows active; the final swap still requires staging parity evidence, a restore point, queue drains, and human approval:
  `psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/migrations/131_hot_table_partition_shadow_mirror.sql`
  `node scripts/migration/run-hot-table-partition-maintenance.mjs --environment=production --execute`
  `psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -c "SELECT public.verify_hot_table_partition_shadow('worker_request_logs'); SELECT public.verify_hot_table_partition_shadow('runtime_telemetry_metrics'); SELECT public.verify_hot_table_partition_shadow('outbox_events'); SELECT public.verify_hot_table_partition_shadow('platform_queue_jobs'); SELECT public.verify_hot_table_partition_shadow('webhook_deliveries');"`

Open Wave 4 human-gated actions:

- Complete WABA approval and provision live Twilio WhatsApp credentials for #51. The sandbox provider, live Twilio adapter, signed inbound route, timeline persistence, BFF/client contracts, and mobile Customer Detail UI are already implemented and tested; production live mode remains unavailable until credentials and webhook approval are configured:
  `printf '%s' "$TWILIO_AUTH_TOKEN" | npx wrangler secret put TWILIO_AUTH_TOKEN --config services/api-gateway/wrangler.toml --env production`
  `printf '%s' "$WHATSAPP_WEBHOOK_SECRET" | npx wrangler secret put WHATSAPP_WEBHOOK_SECRET --config services/api-gateway/wrangler.toml --env production`
  Set `TWILIO_ACCOUNT_SID=<approved-account-sid>` and `TWILIO_WHATSAPP_FROM=whatsapp:<approved-sender>` in production worker vars or the equivalent IaC, then configure the Twilio inbound webhook to `https://api.letbuyy.com/v1/whatsapp/inbound`.
- Confirm the live AI operator model/tool budget and provision the production AI provider credentials for #52. The operator route, usage recording, shared/client contracts, mobile sheet, and product/coupon/theme action execution are implemented and tested; production live mode remains unavailable until the provider key and approved model are configured:
  `printf '%s' "$AI_PROVIDER_API_KEY" | npx wrangler secret put AI_PROVIDER_API_KEY --config services/api-gateway/wrangler.toml --env production`
  Configure `AI_PROVIDER_MODE=live`, `AI_PROVIDER=openai_compatible`, `AI_PROVIDER_MODEL=<approved-model>`, and optional `AI_PROVIDER_BASE_URL=<approved-provider-base-url>` only after product/finance sign-off.
- Confirm the live AI homepage-generation model/budget for #60. The homepage route, shared/client contracts, mobile editor prompt sheet, generated draft normalization, and draft save path are implemented and tested; production live generation remains unavailable until the provider key/model are approved:
  `printf '%s' "$AI_PROVIDER_API_KEY" | npx wrangler secret put AI_PROVIDER_API_KEY --config services/api-gateway/wrangler.toml --env production`
  Configure `AI_PROVIDER_MODE=live`, `AI_PROVIDER=openai_compatible`, `AI_PROVIDER_MODEL=<approved-model>`, and optional `AI_PROVIDER_BASE_URL=<approved-provider-base-url>` only after product/finance sign-off.
- Verify the production email sender/domain and provision live Resend credentials for #55. Campaign creation, real-audience preview, delivery evidence tables, sandbox send, BFF/client contracts, and the mobile composer are implemented and tested; production live email delivery remains unavailable until sender-domain approval and credentials are configured:
  `printf '%s' "$RESEND_API_KEY" | npx wrangler secret put RESEND_API_KEY --config services/api-gateway/wrangler.toml --env production`
  Configure `RESEND_FROM_EMAIL=<approved-sender>` only after the sender domain is verified and deliverability policy is approved.
- Confirm legal/policy approval before enabling regulated/EU cross-border market operations for #58. The localization contract, mobile CRUD UI, and tenant-scoped storage are implemented and tested; production policy copy, jurisdiction-specific tax/legal text, and market launch approvals remain human-owned:
  `psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/migrations/137_mobile_storefront_localization.sql`
  Enable regulated markets only after legal signs off on market availability, terms, tax treatment, and translation ownership.

Open Wave 5 human-gated actions:

- Provision the production mobile Sentry DSN for #75 only after the observability owner creates the project and confirms retention/redaction policy. Local crash capture and Sentry DSN forwarding code are implemented and tested; sentinel builds keep reports in the local diagnostics outbox and never expose the sentinel to merchants:
  `flutter build appbundle --release --dart-define=SENTRY_DSN="$SENTRY_DSN" --dart-define=APP_RELEASE="$APP_RELEASE" -t apps/mobile/merchant-app/lib/main.dart`
- Verify migration 107 on staging/production after a DB operator confirms it has been applied there. The repository now has static and executable local proof; live environment verification remains human-owned:
  `psql "$STAGING_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/verification/107_security_rls_hardening_and_payment_uniqueness.sql`
  `psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/verification/107_security_rls_hardening_and_payment_uniqueness.sql`
- Deploy the #80 payment verification replay guard only after the release owner selects the production window. The code-side fix and regression tests are complete; production rollout evidence remains human-owned:
  `pnpm run deploy:api -- --env production`
- Apply the #105 `order_items` direct tenant-scope migration to staging/production only after a DB operator confirms the migration window, backup/PITR checkpoint, and order line backfill readiness. The repository migration, rollback drill SQL, and static safety tests are complete; live environment apply remains human-owned:
  `psql "$STAGING_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/migrations/158_order_items_tenant_scope.sql`
  `psql "$PRODUCTION_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f database/supabase/migrations/158_order_items_tenant_scope.sql`
