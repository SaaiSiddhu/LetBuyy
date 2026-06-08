# Executable Build Plan

Generated: 2026-06-08T08:27:10Z

## Execution Order

1. `001-foundation`
2. `002-cart`, `006-inventory`, `004-payment`, `007-discount`, `008-tax`, `009-shipping`
3. `003-checkout`
4. `005-order`
5. `010-notifications`
6. `011-email`, `012-whatsapp-scoped`
7. `013-settlement`, `014-billing`
8. `015-security`
9. `016-observability`

## Migration Numbering

- V1 text says next migration is `138`, but the live dirty tree already has `138_mobile_store_metafields.sql`.
- Use `139_*` and higher for this run unless the owner removes `138_mobile_store_metafields.sql`.
- Pair forward migrations with safe rollback scripts/manifests without editing historical applied migrations in place.

## Task 001 Plan

- Modify `packages/tenant-core/src/index.ts` and `services/api-gateway/src/lib/tenant-context.ts` for tenant GUC/query-guard contracts.
- Modify `packages/event-core/src/index.ts` for V1 event catalog expansion and outbox helper contracts.
- Add gateway/queue foundation modules only under existing active runtimes.
- Add `139_executable_foundation_outbox_idempotency_audit_ledger.sql` or split into focused migrations if line count/rollback clarity requires.
- Add canonical `ledger_accounts` and `ledger_entries` with DB-level append-only enforcement and balance checks.
- Add focused real-Postgres tests for money property/recon/reversal/concurrency and reference vertical slice.
- Keep all external rails mock-by-default and log live rails in `EXECUTABLE_HUMAN_REQUIRED.md`.

## Downstream Plan

- Extend existing routes rather than duplicate them: cart via storefront cart/gateway cart, payments via `payments.ts` and `packages/payments`, order via `orders.ts`, inventory via `inventory.ts`, shipping via `shipping-tax.ts`/`shipping-labels.ts`, notifications via `notifications.ts`/queue workers, WhatsApp via `whatsapp.ts`, billing via `internal-billing.ts`, media via `media.ts`.
- Route files approaching 1500 lines must be split before adding substantial handlers.
- Existing mobile V2 money routes must be reconciled to the canonical ledger in task `013`.
- Generate repository intelligence only after route/schema/topology changes and commit generated diffs separately if committing is possible in the dirty worktree.

## Verification Plan

- After scaffolding: rerun source-ledger and architecture/governance to confirm the allowlist fix, with stale artifacts documented as baseline pollution.
- Start isolated Postgres on port `54329` with Docker.
- Apply `000_baseline.sql` plus additive migrations through current head, then new run migrations.
- Run rollback proof on local-only database.
- Run scoped package/gateway tests first, then required full gates when runtime changes land.
