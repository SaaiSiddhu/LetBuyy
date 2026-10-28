# Payments implementation evidence — 28 October 2026

Status: IN PROGRESS. Local engineering evidence only; no managed-provider, hosted release, bank settlement or real-money acceptance.

Specification: the41-page LetBuyy Payments plan supplied in the current task. The full68-item register is `work-items.json`; no item is complete merely because another gate passed. Current own-account corrections proceed independently of provider approval. The owner confirmed provider approval is not yet obtained/unsure. Managed collection remains unavailable.

## Current source

Primary checkout develop219654a2c remained untouched. Implementation is isolated on codex/payments-foundation in the existing theme-thumbnails worktree. Original unpublished work, environment files, signing material and notification403 retained. Claim records name the exact touched boundaries. No new runtime, new auth, custody, shared platform collection key, ledger or fee introduced.

## Writer / observation map

- Store configuration: Gateway routes/stores.ts, lib/store-payment-config.ts; canonical input/readiness contracts shared-types/payment-setup.ts and payments/store-payment-readiness.ts. Existing sites row remains owner.
- Buyer collection: Gateway routes/checkout.ts -> hostedRazorpayTestCredentials -> infrastructure Razorpay adapter -> existing PaymentExecutionAdapter and canonical capture RPC/ledger. Current checkout binds key ID but lacks immutable credential-version drain.
- Provider ingress: webhook-service/index.ts uses existing global provider verification; account-scoped dispatch needs qualification before multi-account live activation.
- Payout statement/release: Gateway routes/payouts.ts -> existing claim/finalize RPCs and canonical settlement ledger -> infrastructure payout-transfer adapter. Global Route destination, Number conversions, partial-population summaries and transfer/bank conflation remain open findings; not covered by a polished setup screen.
- KYC: Gateway routes/kyc.ts -> infrastructure kyc-verification-adapter; live automated qualification unavailable. Sandbox outcomes cannot grant live capability.
- Lifecycle email: existing outbox/Queue owner and independent pending403. No current inbox claim.
- Subscriptions remain separate billing collection. COD remains independent.

## Implemented first slice

Credential validation precedes persistence; invalid/provider-unavailable verification leaves existing configuration unchanged. Successful test credential save disables online, preserves COD, and returns masked canonical readiness. Explicit method updates use expected revision and compare-and-set. Generic store updates cannot bypass readiness. Live-owner authority is checked before old HTTP receipts can replay. Missing/unresolved configuration grants no sandbox, gateway or checkout capability. Actual hosted reader requires ownAccount and explicit online enablement. Merchant Settings uses canonical primitives, typed contracts, tenant lifetime fences, independent controls and stable in-memory retry keys. Mobile rejects empty/legacy shared readiness and does not deserialize public secret fields. Keys alone never establish KYC/bank readiness.

Remaining limits of this slice: HTTP idempotency completion is not yet atomic with settings persistence; immutable connection/credential snapshots, real step-up switching, provider identity, OAuth/live onboarding, full settlement/refund/account scopes and bank outcomes remain open. New saves use aV2 AES-GCM envelope authenticated to site/key/provider/environment and key version. Existing legacy ciphertext is retained as a read-only bridge; immutable key history, rotation and drain are still open, so B04 remains partial.

## Local evidence recorded

- Unit:12 focused tests including exhaustive192-combination readiness matrix and actual encryption/decryption projections.
- Owned PostgreSQL/PostgREST + real Worker:9 tests passed; owner positive control, direct/generic refusal, encrypted save/COD preservation, invalid credentials, live/mode rejection, stable replay, stale revision, CAS race, forged context, revoked owner.
- Normal Identity password login -> production-built Merchant Settings/BFF -> real Worker -> owned PostgreSQL: browser journey passed. Synthetic intercepted Razorpay verification only, no real provider calls. Committed-response-loss retry verifies once, activation persists, failed replacement preserves active state, read failure disables stale controls. Visual review caught Merchant forced-light, so OS emulation was not counted as actual dark proof. The canonical provider now preserves light by default but honors user theme selection; the repeated production-built browser test verifies actual html/surface dark signals, keyboard switching, narrow layouts and200% overflow.
- Dart model plus existing model regressions:7 tests passed. Mobile payment transport and existing session regressions:16 passed. Method toggles now send canonical top-level flags; late session responses cannot repopulate store state. Mobile saves forward stable retry key/revision. Touched source analyzer found no issues.
- Initial governance113/114: the remaining validator demanded false sandbox fallback and old badge location. Retargeted to enforce unconfirmed mode and canonical overview; dedicated check and17 Phase-B mutant tests pass. Final full governance gate114/114 passed. Gateway unit lane1824/1824 passed; a sandbox-denied loopback run was stopped, and only the successful loopback-authorized run qualifies. Merchant settings/read-lifecycle/CSV regressions66/66 passed.

Disposable source candidate excludes every app .env file. The first browser startup was refused for developer env contamination; no guard was weakened. Later isolated run passed. Test infrastructure cleaned only labelled owned resources. Local logs are under /private/tmp/letbuyy-payment-system-plan-20261028; safe screenshots exclude secret fields.

## Decisions / release

D1 provider account model unresolved: owner Not approved yet / unsure. D2 multi-site legal ownership not yet approved. D3 zero rake fixed by Constitution; contracted PSP fees unknown. D4 provider-hosted/minimal KYC preferred, collection not authorized. D5 first live launch requires both collection and settlement qualification. D6 guarded test keys retained; production manual/OAuth policy depends on provider acceptance. D7 bank/release authority pending provider/finance terms. D8 no current release approval. D9 terms/retention pending provider/legal acceptance. D10 Free-plan measurement remains before any upgrade proposal.

No merge, push, migration deployment, web/Worker deploy, provider account/key creation, KYC submission, bank change, external email or real transaction occurred in this programme.

## Exact reproducible commands and retained reports

- `node --import tsx --test services/api-gateway/src/__tests__/*.test.ts` — gateway-unit-qualified.log1824pass.
- `node --import tsx --test packages/payments/test/store-payment-readiness.test.ts services/api-gateway/src/__tests__/store-payment-config.test.ts services/api-gateway/src/__tests__/hosted-razorpay-credentials.test.ts` — payment-unit.log12pass.
- `LETBUYY_EXECUTABLE_PREPARED_TRANSACTIONS=2 node scripts/governance/run-executable-suites.mjs --suite services/api-gateway/src/__tests__/owned-db/store-payment-setup.postgres.test.ts --suite services/api-gateway/src/__tests__/owned-db/merchant-payment-setup-browser.postgres.test.ts --jobs 1 --timeout 900` from the env-free candidate — payment-theme-owned.json, two suites10pass, no skips, cleanup verified.
- `flutter test --no-pub test/payment_config_model_test.dart test/product_version_test.dart` in packages/dart/models —7pass.
- `flutter test --no-pub test/payment_settings_transport_test.dart test/store_session_boundary_test.dart` in apps/merchant/mobile —16pass.
- `TSX_TSCONFIG_PATH=apps/merchant/web/tsconfig.json node --import tsx --test apps/merchant/web/src/components/settings/SettingsPane.test.tsx apps/merchant/web/src/lib/payments/razorpay-csv.test.ts apps/merchant/web/tests/read-lifecycle.test.tsx` —66pass.
- `node --test tests/governance/phase-b-validators.test.mjs` —17pass; no original mock-provider safety assertion removed.
- `node scripts/validate-governance.mjs --lane=gate` —114pass, one declared old external branch advisory.
- Touched TypeScript and Dart checks plus UI ESLint passed; typecheck and cache prerequisites must be rebuilt after the governance generated-artifact cleanup.

Safe success captures: letbuyy-payments-browser-307efe0a94f2/light-mobile.png and dark-mobile.png under the task temporary directory. No auth or secret-entry screenshots retained. No actual provider settlement, live refund, hosted inbox or production canary has been observed.

## Broader checkout prerequisite

The owned Commerce checkout browser regression reached verified Razorpay capture, one order, one canonical capture journal and one order.paid event, but its direct confirmation-queue assertion observed0 jobs (expected1). The assertion is preserved. COD/coupon and stock-recovery cases pass. An unchanged-baseline comparison is running; no green email/inbox or full checkout-suite claim is made. Notification403 remains a separate release prerequisite.
