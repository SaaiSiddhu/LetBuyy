# Executable Implementation Audit

Generated: 2026-06-08T08:27:10Z

## Inputs Read

- `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`
- `AGENTS.md`
- `CLAUDE.md`
- `memory/lessons.md`
- `tasks/todo.md`
- `CODEX_FOUNDATION_STEPUP_V2_MISSION.md`
- `CODEX_FOUNDATION_STEPUP_V2_LEDGER.md`
- `CODEX_FOUNDATION_STEPUP_V2_STATUS.md`
- Local AGENTS for `services/api-gateway`, `services/queue-workers`, `packages/event-core`, `packages/tenant-core`, `packages/payments`, `packages/shared-types`, `packages/typescript/ui`, and `apps/platform-operations-portal`
- Relevant governance docs: migration, outbox, runtime/import boundaries, sandbox provider, build artifacts, validator reality, replay safety.

## Runtime Inventory

- Active backend owner is `services/api-gateway`; entrypoint is `services/api-gateway/src/index.ts`.
- Active async owner is `services/queue-workers`; existing `platform-queue-consumer.ts` consumes platform queue jobs and writes notifications/developer payout rows.
- Active mobile BFF exists but is not a business owner.
- Reserved service roots contain only `AGENTS.md` and `runtime.manifest.json`: `checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`, `search-service`.

## Existing Routes and Modules

- Existing relevant gateway routes include `payments.ts`, `orders.ts`, `inventory.ts`, `coupons.ts`, `shipping-tax.ts`, `shipping-labels.ts`, `notifications.ts`, `marketing.ts`, `whatsapp.ts`, `payouts.ts`, `wallet.ts`, `commission.ts`, `media.ts`, `customers.ts`, `auth.ts`, `internal-billing.ts`, storefront `cart-routes.ts`, storefront `checkout-payment-routes.ts`, and operations outbox/webhook routes.
- Existing route file line counts: `orders.ts` 1348 and `operations.ts` over 1200 remain under the stated 1500 limit in current checks; storefront customer engagement is near the limit and should be split before extension.
- Existing shared packages provide substrate: `event-core`, `tenant-core`, `payments`, `checkout-core`, `commerce-core`, `shared-types`, `notification-core`, `billing-core`, `infrastructure`.

## Database Inventory

- `000_baseline.sql` already creates `outbox_events`, `audit_logs`, `carts`, `checkout_sessions`, `email_logs`, `idempotency_keys`, `inventory_levels`, `inventory_reservations`, `media_assets`, `payment_attempts`, `payment_transactions`, `plans`, `shipping_zones`, `subscriptions`, and `webhook_subscriptions`.
- Additive migrations currently run through `138_mobile_store_metafields.sql` in this worktree.
- Existing mobile V2 commerce migrations include `114` device/onboarding, `115` review replies, `116` draft orders, `117` customer notes/tags, `118` shipping labels, `119` mobile money ledgers, `120` KYC, `121` 2FA, `122` business profile, `123` tax parity, `129_mobile_customer_segments`, `130` orders site ID hardening, `131` partition shadow mirroring, `132` WhatsApp commerce, `136` marketing email campaigns, `137` localization, and `138` metafields.
- Existing `119_mobile_money_ledgers.sql` is not a V1 canonical double-entry ledger.

## Existing Foundation Substrate

- `services/api-gateway/src/lib/tenant-context.ts` resolves owned-site tenant context but does not yet provide per-transaction tenant GUC setup or query-lint wrappers.
- `services/api-gateway/src/lib/crypto.ts` is the single-source cryptographic helper for HMAC, hashes, timing-safe comparison, and AES-GCM.
- `services/api-gateway/src/lib/replayable-secret-redaction.ts` redacts replayable secret keys.
- `packages/event-core/src/index.ts` has a typed event catalog, but it is narrower than V1 and currently includes marketplace/theme-heavy events plus payment/order/payout events.
- Existing outbox table and operations routes are present, but V1's `writeWithOutbox(tx, domainRows, event)` primitive is not implemented in `packages/event-core`.
- Existing idempotency is mostly per-route/table-specific; no generalized mutation/webhook middleware kernel was found in the inspected code.
- Existing date-format single-source violation in `apps/platform-operations-portal/.../operations/page.tsx` appears already fixed in this dirty worktree via `formatIndiaDateTime` from `@letbuyy/ui/formatting`.

## Baseline Gate Observations

- Docker is available with escalation and can be used to run local Postgres.
- `psql` is not installed on host PATH.
- `source-ledger-residue-validator` failed before this patch because the mission file was present but not allowlisted.
- `stale-artifact-validator` failed on existing local artifacts under app/package roots.
- `validate-governance.mjs` and `validate-architecture.mjs` progressed through major validators and failed at source-ledger residue.
