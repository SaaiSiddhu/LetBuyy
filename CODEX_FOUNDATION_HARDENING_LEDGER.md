# CODEX FOUNDATION-HARDENING LEDGER - started 2026-06-05T13:54:14Z

## ARCHITECTURE-DIRECTION DECISIONS

- C-1 monolith: DEFAULT modular-monolith in this mission; extraction into checkout/search/media/notification/event/analytics service roots is [SKIP -- NEEDS HUMAN: architecture decision].
- C-7 section runtime: DEFAULT data-driven first-party registry with safe unknown-section fallback; third-party section upload/runtime is [SKIP -- NEEDS HUMAN: product and sandbox scope decision].
- C-9 Liquid/embeds: DEFAULT bounded commerce drops plus sanitized embed injection points with the current sandbox preserved.

## BASELINE

- Captured before mission edits on 2026-06-05T13:54:14Z.
- Worktree was already dirty before mission edits: forensic report updates, untracked forensic report files, `CODEX_FOUNDATION_HARDENING_MISSION.md`, `FORENSIC_REPORT_OPERATIONS/`, `apps/app-marketplace/.gitignore`, and `apps/developer-portal/.gitignore`.
- `pnpm turbo typecheck` -> FAIL. `apps/developer-portal` cannot resolve `next`, `react/jsx-runtime`, `@letbuyy/ui`, or React types; `packages/shared-types` cannot resolve `zod`. pnpm warned local `node_modules` are missing.
- `pnpm run validate:governance` -> FAIL after 127+ validator passes at stale artifact validator. Generated artifacts from baseline run were detected at `apps/developer-portal/.turbo`, `packages/shared-types/.turbo`, `packages/shared-types/dist`, `packages/typescript/ui/.turbo`, and `packages/typescript/ui/dist`. These generated directories were removed after baseline capture.
- `pnpm lint` -> FAIL. Several workspaces cannot find `eslint` because local `node_modules` are missing; cached workspaces replayed warnings but no code errors before the dependency failure.
- `pnpm turbo build` -> FAIL. `apps/developer-portal` cannot find `next`; pnpm warned local `node_modules` are missing.
- `node --test tests/*/*.test.mjs` -> FAIL. 431/432 tests passed; `tests/auth/rbac-categories.test.mjs` failed with `Unexpected test require: ./customer-session`.
- Forensic finding count ingested: 14 Critical (`C-1` through `C-14`) and 17 High (`H-1` through `H-17`) from `FORENSIC_REPORT/16-critical-findings-summary.md`; Medium/Low items folded into mission phases from reports `08`, `11`, `13`, and `14`.

## PROGRESS LOG

- 2026-06-05T20:05:55Z [F1.6] H-9 storefront checkout/payment route split - IN PROGRESS - evidence: pre-split `pnpm run test:contracts` -> 22/22 PASS with new `tests/contracts/storefront-checkout-payment-routes.test.ts`; extracted checkout order creation and Razorpay/Cashfree/Stripe/PayPal storefront payment routes to `services/api-gateway/src/routes/storefront/checkout-payment-routes.ts`; post-split `pnpm run test:contracts` -> 22/22 PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/checkout-payment-routes.ts` -> `storefront.ts` 2,206 lines, extracted module 1,223 lines. H-9 remains IN PROGRESS because `storefront.ts` and `app-store.ts` remain above 1,500 lines.
- 2026-06-05T20:02:06Z [F1.6] H-9 storefront customer engagement route split - IN PROGRESS - evidence: pre-split `pnpm run test:contracts` -> 19/19 PASS with new `tests/contracts/storefront-customer-engagement-routes.test.ts`; extracted customer/password/login/order-credential/wishlist/order-contact/review/address routes to `services/api-gateway/src/routes/storefront/customer-engagement-routes.ts`; post-split `pnpm run test:contracts` -> 19/19 PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/customer-engagement-routes.ts` -> `storefront.ts` 3,372 lines, extracted module 1,500 lines. H-9 remains IN PROGRESS because `storefront.ts` and `app-store.ts` remain above 1,500 lines.
- 2026-06-05T19:51:04Z [P-1-GATE] V2 regression gate - DONE - evidence: `pnpm turbo test --filter @letbuyy/api-gateway` -> 41/41 Turbo tasks PASS and api-gateway contract suite 16/16 PASS; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; generated workspace artifacts cleaned; `pnpm run validate:governance` -> 135/135 PASS. P-1 is green before resuming F1.6.
- 2026-06-05T19:51:04Z [P1.6] N-6 source ledger residue and orphan webhook-deliveries queue - DONE - evidence: historical root/workspace `CODEX*.md` files moved under `docs/archive/root-residue/2026-06-06-foundation-v2/`; `find apps services packages -name 'CODEX*.md'` -> no runtime/package residue; `services/api-gateway/src/execution/outbox-execution.adapter.ts` no longer upserts permanent `platform_queue_jobs.queue_name='webhook-deliveries'`; `node scripts/validators/source-ledger-residue-validator.mjs` -> PASS; `node scripts/validators/no-orphan-webhook-delivery-queue-validator.mjs` -> PASS.
- 2026-06-05T19:51:04Z [P1.5] N-5 gateway events client single-source - DONE - evidence: shared client added at `packages/infrastructure/gateway-events-adapter/index.ts`; webhook-service and queue-workers import `@letbuyy/infrastructure/gateway-events-adapter`; duplicate service-local `gateway-events.ts` files removed; `pnpm --filter @letbuyy/webhook-service test` -> 12/12 PASS; `pnpm --filter @letbuyy/queue-workers test` -> 2/2 PASS; `node scripts/validators/gateway-events-client-validator.mjs` -> PASS.
- 2026-06-05T19:51:04Z [P1.4] N-4 contracted internal event ingress - DONE - evidence: `packages/event-core` now contracts `payment.captured`, `payment.failed`, `refund.created`, and `payment.subscription.activated`; webhook-service normalizes provider payment/refund/subscription events to those contracted topics; `services/api-gateway/src/execution/event-execution.adapter.ts` rejects uncontracted event types before persistence; `pnpm run test:contracts` -> 16/16 PASS; `node scripts/validators/contracted-domain-event-ingress-validator.mjs` -> PASS; `node scripts/validators/event-schema-validator.mjs` -> PASS; `node scripts/validators/event-versioning-validator.mjs` -> PASS.
- 2026-06-05T19:51:04Z [P1.3] N-3 orphaned TS contract tests wired into CI path - DONE - evidence: root `test`/`test:governance` now invoke `test:contracts`; `test:contracts` runs `tsx --test tests/contracts/*.test.ts`; api-gateway `test` runs `tsx --test ../../tests/contracts/*.test.ts`; `pnpm turbo test --filter @letbuyy/api-gateway` proves Turbo executes those TS contract files with 16/16 PASS; `node scripts/validators/test-coverage-governance-validator.mjs` -> PASS.
- 2026-06-05T19:51:04Z [P1.2] N-2 replayable app secret persistence - DONE - evidence: idempotency completion persists `redactReplayableSecrets(params.responseBody)` instead of the original response body; app OAuth tokens, refresh tokens, signing secrets, and client secrets are redacted in persisted/replayed bodies while first response can still return show-once values; `tests/contracts/idempotency-secret-redaction.test.ts` covers recursive redaction and adapter persistence; `pnpm run test:contracts` -> 16/16 PASS; `node scripts/validators/replayable-secret-persistence-validator.mjs` -> PASS.
- 2026-06-05T19:51:04Z [P1.1] N-1 internal payment routes fail closed in every environment - DONE - evidence: `services/api-gateway/src/lib/internal-secret.ts` returns false whenever `INTERNAL_API_SECRET` is unset; internal payment, billing, and events routes all use the shared guard; off-production allow branch removed from `storefront/internal-payment-routes.ts`; contract tests assert staging no-secret -> 403, production no-secret -> 403, configured-secret only -> allow, and five internal payment endpoints are wired through 403 guards; `node scripts/validators/fail-closed-internal-routes-validator.mjs` -> PASS; `pnpm turbo test --filter @letbuyy/api-gateway` -> api-gateway contract suite 16/16 PASS.
- 2026-06-05T15:18:13Z [F1.6] H-9 storefront internal payment route split - IN PROGRESS - evidence: pre-split `npx tsx --test tests/contracts/storefront-internal-payment-routes.test.ts` -> 5/5 PASS; moved internal payment endpoints to `services/api-gateway/src/routes/storefront/internal-payment-routes.ts`; post-split `npx tsx --test tests/contracts/storefront-internal-payment-routes.test.ts` -> 5/5 PASS; `npx tsx --test services/api-gateway/src/__tests__/payments.test.ts` -> 7/7 PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `wc -l services/api-gateway/src/routes/storefront.ts services/api-gateway/src/routes/storefront/internal-payment-routes.ts` -> `storefront.ts` 4,833 lines, internal payment module 233 lines; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; generated artifact cleanup; `pnpm run validate:governance` -> 129/129 PASS. H-9 remains IN PROGRESS because `storefront.ts` is still above 1,500 lines.
- 2026-06-05T15:09:20Z [F1.2] H-1 event infrastructure Single-Writer classification and enforcement - DONE - evidence: `services/webhook-service` and `services/queue-workers` now emit domain events through `/v1/internal/events/domain`; `rg "outbox_events|payment_webhook_events" services/webhook-service/src services/queue-workers/src services/api-gateway/src -n` -> non-gateway outbox writes removed, payment webhook receipt writes remain webhook-service-only; `pnpm --filter @letbuyy/webhook-service test` -> 12/12 PASS; `pnpm --filter @letbuyy/queue-workers test` -> 2/2 PASS; `npx tsx --test services/api-gateway/src/__tests__/payments.test.ts` -> 7/7 PASS; `node scripts/validators/single-writer-ownership-validator.mjs` -> PASS across 106 source files; `pnpm --filter @letbuyy/webhook-service typecheck` -> PASS; `pnpm --filter @letbuyy/queue-workers typecheck` -> PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; generated artifact cleanup; `pnpm run validate:governance` -> 129/129 PASS.
- 2026-06-05T14:56:05Z [F1.5] H-12 theme event contract registration - DONE - evidence: `node scripts/validators/event-schema-validator.mjs` -> PASS with emitted theme event contract checks; `npx tsx --test tests/contracts/domain-event-contracts.test.ts` -> 3/3 PASS; `node --test tests/federation/event-spine-contracts.test.mjs` -> 14/14 PASS; `pnpm --filter @letbuyy/event-core typecheck` -> PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `pnpm lint` -> 9/9 PASS with warnings only; `pnpm turbo typecheck` -> 60/60 PASS; generated artifact cleanup; `pnpm run validate:governance` -> 129/129 PASS.
- 2026-06-05T14:56:05Z [F1.4] H-11 payout release/failure emitters - SKIPPED -- NEEDS HUMAN - evidence: `payout.released` and `payout.failed` contracts are now marked `reserved-human-gated` with credential/policy reasons and validator coverage; no payout release or failure reconciliation transition exists in source to emit from without a human payout rail decision.
- 2026-06-05T14:47:39Z [F1.3] H-10 Cloudflare queue producer send paths - DONE - evidence: `npx tsx --test services/api-gateway/src/__tests__/cloudflare-queue-triggers.test.ts` -> 3/3 PASS; `node scripts/validators/queue-lifecycle-validator.mjs` -> PASS with source send-plan checks for 5 queue producer bindings; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; generated artifact cleanup; `pnpm run validate:governance` -> 129/129 PASS.
- 2026-06-05T15:41:10Z [F1.2] H-1 subscriptions/sites/billing_history Single-Writer - DONE - evidence: `rg "patchRows\\([^\\n]+\\\"(orders|products|subscriptions|sites|billing_history)\\\"" services/webhook-service/src -n` -> no matches; `node scripts/validators/single-writer-ownership-validator.mjs` -> PASS; `pnpm --filter @letbuyy/webhook-service test` -> 9/9 PASS; `pnpm --filter @letbuyy/webhook-service typecheck` -> PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; artifact cleanup; `pnpm run validate:governance` -> 129/129 PASS.
- 2026-06-05T15:03:40Z [F1.1] H-1 orders/products Single-Writer - DONE - evidence: `rg "patchRows\\([^\\n]+\\\"(orders|products)\\\"" services/webhook-service/src -n` -> no matches; `node scripts/validators/single-writer-ownership-validator.mjs` -> PASS; `pnpm --filter @letbuyy/webhook-service test` -> 5/5 PASS; `pnpm --filter @letbuyy/webhook-service typecheck` -> PASS; `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; artifact cleanup; `pnpm run validate:governance` -> 129/129 PASS.
- 2026-06-05T14:08:05Z [F0-GATE] F0 validation gate - DONE - evidence: `pnpm install --frozen-lockfile --force` -> restored workspace links from lockfile; `pnpm turbo typecheck` -> 60/60 PASS; `pnpm lint` -> 9/9 PASS with warnings only; recursive generated artifact cleanup; `pnpm run validate:governance` -> 128/128 PASS.
- 2026-06-05T14:02:03Z [F0.5] Root residue quarantine - DONE - evidence: `find . -maxdepth 1 -type f -name '*.md' -print` -> only `AGENTS.md`, `CLAUDE.md`, `README.md`, and active hardening mission/ledger/status remain; historical files and `Audit/` moved to `docs/archive/root-residue/2026-06-05-foundation-hardening`; `pnpm run validate:governance` -> 128/128 PASS.
- 2026-06-05T14:02:03Z [F0.4] Feature-flag honesty - DONE - evidence: `docs/governance/feature-flag-governance.md` now records `FEATURE_GRAPHQL`, `FEATURE_EXTENSIONS`, and `FEATURE_LIQUID` as production-disabled/staged with explicit enable paths; `pnpm run validate:governance` -> 128/128 PASS.
- 2026-06-05T14:02:03Z [F0.3] AGENTS database topology truth - DONE - evidence: `AGENTS.md` now describes `000_baseline.sql` plus `073_*.sql` through `089_*.sql`, 18 active migration files, and 233 baseline public tables; `pnpm run validate:governance` -> 128/128 PASS.
- 2026-06-05T14:02:03Z [F0.2] Reserved-service honesty - DONE - evidence: six manifest-only service roots declare `implementationStatus.status = reserved-not-implemented`, current active owners, and no deployable ownership; `services/queue-workers` is categorized as implemented `cloudflare-worker`; `node scripts/validators/runtime-manifest-validator.mjs` -> PASS; `pnpm run validate:governance` -> 128/128 PASS.
- 2026-06-05T14:02:03Z [F0.1] Canonical runtime inventory reconciliation - DONE - evidence: `CLAUDE.md`, `docs/governance/runtime-boundaries.md`, on-disk manifests, and `docs/governance/repository-topology.md` now include the same 21 canonical runtime roots; `node scripts/validators/runtime-topology-validator.mjs` -> PASS with checks that CLAUDE/runtime-boundaries include every canonical root.
- 2026-06-05T13:54:14Z [F0.0] C-2/C-12/C-13 mission initialized - IN PROGRESS - evidence: required forensic summaries and governance memory read; baseline commands recorded above.

## SKIPPED -- NEEDS HUMAN

- [SKIP] Extract `checkout-runtime`, `search-service`, `media-service`, `notification-service`, `event-bus`, and `analytics-pipeline` into independently implemented services - requires architecture decision: extract six service roots vs keep modular-monolith - unblocks C-1 beyond this mission default.
- [SKIP] Build third-party section upload/runtime surface - requires product/sandbox/API scope decision - unblocks C-7 beyond this mission default.
- [SKIP] Emit live `payout.released` / `payout.failed` from a payout release or reconciliation transition - requires payout policy decision, Razorpay Route/RazorpayX live or sandbox credentials, and an operations approval/runbook for release/failure state changes - unblocks H-11 beyond reserved contract honesty and C-5/F2.4 live payout release.

## SINGLE-WRITER LEDGER

- 2026-06-05T15:03:40Z table `orders` -> sole writer `services/api-gateway` for payment webhook order transitions; `services/webhook-service` now calls gateway internal payment endpoints; second-writer validator added in commit `9b5e0604`.
- 2026-06-05T15:03:40Z table `products` -> sole writer `services/api-gateway` for payment webhook legacy stock fallback; `services/webhook-service` has zero direct writes to `products`; second-writer validator added in commit `9b5e0604`.
- 2026-06-05T15:41:10Z table `subscriptions` -> sole writer `services/api-gateway` for provider subscription activation/status sync; `services/webhook-service` now calls `/v1/internal/billing/subscriptions/*`; second-writer validator expanded in commit `964c46d1`.
- 2026-06-05T15:41:10Z table `sites` -> sole writer `services/api-gateway` for subscription-paid trial status updates; `services/webhook-service` no longer patches `sites`; second-writer validator expanded in commit `964c46d1`.
- 2026-06-05T15:41:10Z table `billing_history` -> sole writer `services/api-gateway` for provider subscription invoices; `services/webhook-service` now calls gateway invoice endpoint; second-writer validator expanded in commit `964c46d1`.
- 2026-06-05T15:09:20Z table `outbox_events` -> sole writer `services/api-gateway`; `services/webhook-service` and `services/queue-workers` now call gateway-owned `/v1/internal/events/domain`; second-writer validator expanded in this increment.
- 2026-06-05T15:09:20Z table `payment_webhook_events` -> sole writer `services/webhook-service`; `services/api-gateway` and `services/queue-workers` are validator-guarded from writing provider webhook receipt/idempotency rows.

## TRACEABILITY MATRIX

| ID | Status | Phase ref |
|---|---|---|
| N-1 | DONE - internal payment routes fail closed without `INTERNAL_API_SECRET` in every environment and are validator-guarded | P1.1 |
| N-2 | DONE - idempotency persistence redacts replayable app OAuth/signing/client secrets | P1.2 |
| N-3 | DONE - TS contract tests are wired into root and api-gateway test scripts and run under Turbo | P1.3 |
| N-4 | DONE - internal domain-event ingress rejects uncontracted types; payment/refund/subscription topics are contracted | P1.4 |
| N-5 | DONE - gateway event emission client single-sourced in `@letbuyy/infrastructure/gateway-events-adapter` | P1.5 |
| N-6 | DONE - source-tree CODEX ledger residue archived and orphan `webhook-deliveries` queue producer removed | P1.6 |
| C-1 | IN PROGRESS - modular-monolith default; extraction skipped pending human decision | F1 |
| C-2 | DONE | F0.2 |
| C-3 | PENDING | F2.1 |
| C-4 | PENDING | F2.3 |
| C-5 | PENDING | F2.4 |
| C-6 | PENDING | F3.1 |
| C-7 | IN PROGRESS - data-driven registry default; third-party runtime skipped pending human decision | F3.3 |
| C-8 | PENDING | F3.2 |
| C-9 | PENDING | F3.4 |
| C-10 | PENDING | F3.5 |
| C-11 | PENDING | F5 |
| C-12 | DONE | F0.3 |
| C-13 | DONE | F0.1 |
| C-14 | PENDING | F6.1 |
| H-1 | DONE | F1.1/F1.2 |
| H-2 | PENDING | F7.1 |
| H-3 | PENDING | F8.1 |
| H-4 | PENDING | F3.6 |
| H-5 | PENDING | F2.5 |
| H-6 | PENDING | F2.2 |
| H-7 | PENDING | F4.1 |
| H-8 | PENDING | F7.2 |
| H-9 | IN PROGRESS - internal payment, customer engagement, and checkout/payment routes split; `storefront.ts` 2,206 lines and `app-store.ts` 2,797 lines remain above target | F1.6 |
| H-10 | DONE | F1.3 |
| H-11 | SKIPPED -- NEEDS HUMAN: payout rail/policy/credentials required for release or failure emitter | F1.4 |
| H-12 | DONE | F1.5 |
| H-13 | PENDING | F2.6 |
| H-14 | PENDING | F3.7 |
| H-15 | PENDING | F6.2 |
| H-16 | PENDING | F4.2 |
| H-17 | PENDING | F4.3 |

## VALIDATOR LEDGER

- 2026-06-05T13:54:14Z baseline `pnpm run validate:governance` -> FAIL at stale artifact validator after preceding validators passed; generated artifacts removed after capture.
- 2026-06-05T14:02:03Z `pnpm run validate:governance` -> 128/128 PASS after F0 runtime inventory, manifest honesty, AGENTS DB truth, feature flag honesty, and root archive changes.
- 2026-06-05T14:08:05Z `pnpm run validate:governance` -> 128/128 PASS after dependency-linked typecheck/lint and recursive generated artifact cleanup.
- 2026-06-05T15:03:40Z `pnpm run validate:governance` -> 129/129 PASS after adding Single-Writer ownership validator for webhook-service `orders`/`products` writes.
- 2026-06-05T15:45:02Z `pnpm run validate:governance` -> 129/129 PASS after expanding Single-Writer ownership to `subscriptions`, `sites`, and `billing_history`.
- 2026-06-05T14:47:39Z `pnpm run validate:governance` -> 129/129 PASS after adding Cloudflare queue trigger producer send plans and queue lifecycle validator send-plan checks.
- 2026-06-05T14:56:05Z `pnpm run validate:governance` -> 129/129 PASS after registering emitted theme purchase/draft event contracts and marking payout release/failure contracts reserved-human-gated.
- 2026-06-05T15:09:20Z `pnpm run validate:governance` -> 129/129 PASS after moving `outbox_events` emission behind gateway-owned internal events and expanding Single-Writer checks to 106 service source files.
- 2026-06-05T15:18:13Z `pnpm run validate:governance` -> 129/129 PASS after splitting storefront internal payment routes and adding characterization coverage.
- 2026-06-05T19:51:04Z `pnpm run validate:governance` -> 135/135 PASS after adding fail-closed internal routes, replayable-secret persistence, contracted-domain-event ingress, shared gateway-events client, orphan webhook-deliveries queue, and source-ledger residue validators.
