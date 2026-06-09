# WAVE 0 — Truth Harness — 2026-06-09

CHANGES:

- `scripts/validate-governance.mjs` → added explicit `gate`, `report`, and `all` lanes; all existing validators remain in the gate lane; no demotions.
- `scripts/validators/foundation-antifabrication-gate.mjs` + `config/governance/anti-fabrication-allowlist.json` → added planted-failure-capable anti-fabrication gate with Wave-owned temporary entries for existing payout/payment/identity/domain debt.
- `scripts/validators/foundation-stepup-report-validator.mjs` → added advisory report lane output.
- `scripts/validators/frozen-path-override-gate.mjs`, `scripts/git-hooks/pre-commit`, `scripts/git-hooks/commit-msg` → added locked-path staging and commit-message trailer protection.
- `scripts/foundation/ephemeral-postgres.mjs` → added local Docker Postgres fixture starter for executable acceptance tests.
- `scripts/foundation/restore-drill.mjs` + `config/runtime/database-recovery-policy.json` → staged local restore-drill plan and documented no-production-action recovery policy.
- `docs/governance/flag-truth.md` → documented flag truth rules: disabled flags do not return mock success, external integrations default OFF, production-like runtime checks fail closed.
- `tests/governance/foundation-wave0.test.mjs` → added Wave 0 behavioral tests for planted fake UTR failure, lane split, backup/restore staging, and frozen-path gate wiring.
- `package.json` → added `validate:governance:gate`, `validate:governance:report`, `validate:anti-fabrication`, `test:foundation:wave0`, fixture, and restore-drill scripts.

TESTS:

- `pnpm run validate:anti-fabrication` → PASS; scans active source and tracks five temporary Wave-owned fabrication-debt entries.
- `node --test tests/governance/foundation-wave0.test.mjs` → PASS; proves planted fake UTR fails, lanes are split, restore drill is staged, and frozen hook wiring exists.
- `node scripts/foundation/ephemeral-postgres.mjs start` → PASS with Docker access; fixture `letbuyy-executable-pg` / `letbuyy_executable` started.
- `node --test tests/executable/money-ledger-postgres.test.mjs` → PASS; executes `public.post_ledger_transaction`, verifies append-only ledger behavior, idempotency, tenant GUC scoping, balance breaks, and rollback.
- `pnpm run test:foundation:wave0` → PASS with Docker access; packaged Wave 0 acceptance path starts fixture and runs the real ledger proof.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.

MIGRATIONS:

- None.

ROLLBACK:

- Revert the Wave 0 commit from `stepup/main`.
- Remove Wave 0-only scripts/config/tests if reverting manually: anti-fabrication/frozen/report validators, foundation fixture/restore scripts, `config/governance/anti-fabrication-allowlist.json`, `config/runtime/database-recovery-policy.json`, `tests/governance/foundation-wave0.test.mjs`, `docs/governance/flag-truth.md`, and the Wave 0 package scripts.
- No database rollback is required because Wave 0 adds no migration and applies nothing to shared/staging/prod. The local Docker fixture can be stopped with `pnpm run foundation:pg:stop`.

GOVERNANCE:

- Frozen-file check: no Wave 0 edits were made to locked files. Pre-existing dirty frozen auth files remain user-owned and unstaged.
- Dependency graph: `pnpm run validate:dependencies` green.
- Gate changes: `validate:governance` now runs the gate lane explicitly; report lane is separate. No existing validator was demoted. Critical dependency validators are asserted in gate lane by `scripts/validate-governance.mjs`.
- Anti-fabrication allowlist is temporary and Wave-owned. Current entries must be removed by Wave 1/Wave 3/Wave 4 before final acceptance; new unallowlisted fake UTR/mock-success/provider-id synthesis fails the gate.
- Production safety: no production/shared DB action was taken. PITR paid-tier activation is CLASS-A and logged as `SKIP-W0-PITR-TIER`.

SKIPS:

- `SKIP-W0-PITR-TIER`

# WAVE 1 — Money Fixes — 2026-06-09

CHANGES:

- `packages/payments/src/index.ts` → added canonical production-runtime mode resolution, sandbox default, production mock rejection, and refund ledger posting.
- `services/api-gateway/src/routes/payments.ts` + `services/api-gateway/src/schemas/payment.schema.ts` → capture now requires provider payment proof and posts canonical capture ledger entries; refunds require provider refund proof, support partial refund accounting, and post canonical refund ledger entries.
- `services/api-gateway/src/routes/wallet.ts` → wallet available balance now reads from canonical `merchant_payable` only after per-site zero-variance reconciliation is verified.
- `services/api-gateway/src/routes/payouts.ts` + `packages/infrastructure/payout-transfer-adapter/index.ts` → payout release is provider-gated, no fabricated UTR/released status, default rail is RazorpayX, and release is claimed through the DB safety RPC before provider transfer.
- `packages/billing-core/src/index.ts` + `services/api-gateway/src/routes/settlements.ts` → reconciliation breaks are surfaced as open alerts; no reserve auto-plug is generated, and broken settlements do not post canonical ledger/payout schedules.
- `services/api-gateway/src/routes/commission.ts` and `packages/checkout-core/src/index.ts` → removed active mock money defaults in favor of sandbox defaults.
- `database/supabase/migrations/160_foundation_money_ledger_authority.sql` → added ledger link columns, bigint money shadow columns, site reconciliation table/functions, wallet-to-canonical backfill, and `claim_payout_statement_release(...)` with `FOR UPDATE`, state/idempotency guard, and canonical balance check.
- `database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql` → added tested fixture rollback.
- `config/governance/anti-fabrication-allowlist.json` → removed all Wave 1 payout/payment fabrication debt entries.
- `FOUNDATION_STEPUP_SKIPPED.md` → logged `SKIP-W1-PA-PAYOUT-PROVIDER` for human-owned PA/RazorpayX Route credentials/provider activation.
- `tests/executable/foundation-wave1-money-postgres.test.mjs`, package tests, and money source-contract tests → added Wave 1 behavioral proof.

TESTS:

- `pnpm run test:foundation:wave1` → PASS with Docker access; proves package money plans, source contracts, fixture migration apply/down, wallet backfill, zero-variance reconciliation, payout claim idempotency/state guard, balance rejection, and sandbox DB defaults.
- `pnpm run validate:anti-fabrication` → PASS; Wave 1 allowlist entries removed, only Wave 3/Wave 4 temporary entries remain.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `pnpm run validate:migrations` → PASS; new migration is additive/replay-safe under the repository migration safety gate.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks.

MIGRATIONS:

- Added `160_foundation_money_ledger_authority.sql`.
- Expand/contract: added bigint shadow columns and sync triggers for payout statements, wallet ledger entries, and commission reconciliation entries; no live money column type was altered.
- Fixture verification: `tests/executable/foundation-wave1-money-postgres.test.mjs` applied migrations `139`, `119`, `142`, `151`, and `160`, exercised Wave 1 functions, then applied `160` rollback.

ROLLBACK:

- Apply `database/supabase/rollback/160_foundation_money_ledger_authority.rollback.sql` only to the local/ephemeral fixture or a human-approved clone. Do not apply to shared/staging/prod without a fresh backup and forward-fix decision.
- Code rollback: revert the Wave 1 commit to restore the prior mutable-wallet/payment/payout behavior.
- No production/shared database action was taken.

GOVERNANCE:

- Frozen-file check: no Wave 1 edits were made to frozen paths in `FOUNDATION_REPO_LOCKS.md`; pre-existing frozen auth/migration edits remain user-owned and unstaged.
- Money truth: capture, refund, fee assessment, payout release, and wallet backfill now route through canonical ledger postings. Wallet available balance fails closed until reconciliation status is `verified` with variance `0`.
- Anti-fabrication: fabricated UTR, hardcoded released payout state, and synthetic capture provider id debt were removed from active source and the allowlist.
- Provider actions: PA/RazorpayX execution remains gated off as Class-A external integration work; no provider payout is faked.

SKIPS:

- `SKIP-W1-PA-PAYOUT-PROVIDER`

# WAVE 2 — Tenant Isolation — 2026-06-09

CHANGES:

- `scripts/governance/tenant-registry-common.mjs`, `scripts/generators/generate-tenant-table-registry.mjs`, and `services/api-gateway/src/tenant/tenant-tables.registry.ts` → added schema-derived tenant-table registry generation from the migration chain; current registry contains 261 tenant-owned tables.
- `services/api-gateway/src/tenant/tenant-scoped.ts` and `services/api-gateway/src/lib/supabase.ts` → added a guarded service-role Supabase client that rejects execution against registry tables unless a tenant/owner predicate or scoped insert/upsert payload is present.
- `scripts/validators/tenant-isolation-validator.mjs`, `scripts/validate-governance.mjs`, and `package.json` → added Wave 2 tenant-isolation validation to the governance gate and package scripts.
- API gateway service-role call sites in app-function runtime, checkout, storefront, storefront cart/public routes, and themes were normalized away from direct `getSupabaseAdmin(c).from(...)` expressions so the guard is the single enforced service-role boundary.
- `services/api-gateway/src/middleware/auth.ts`, `services/api-gateway/src/middleware/rbac.ts`, `services/api-gateway/src/identity-foundation/auth-verifier-registry.ts`, and `services/api-gateway/src/identity-foundation/shadow-compare.ts` → removed the static `platform-console-token` super-admin verifier path; RBAC role checks now resolve from server-side persistence instead of JWT role metadata.
- `tests/governance/foundation-wave2-tenant.test.ts` and identity-foundation snapshots → added exhaustive registry fail-closed tests and updated verifier-registry expectations.

TESTS:

- `pnpm run test:foundation:wave2` → PASS with tsx IPC escalation; proves generated registry presence, unscoped rejection for all 261 tenant tables, scoped query allowance, scoped mutation allowance, unscoped insert rejection, and the tenant-isolation validator.
- `pnpm run validate:anti-fabrication` → PASS; only Wave 3/Wave 4 temporary entries remain tracked.
- `pnpm run validate:dependencies` → PASS; dependency manifest, undeclared import, package export, dependency graph, and circular import gates green.
- `node --test tests/identity-foundation/production-parity.test.mjs tests/identity-foundation/remaining-scaffolds.test.mjs` → PASS; updated auth verifier snapshots are green with the platform-console token branch removed.
- `pnpm run build` → PASS; turbo build completed 71/71 tasks after generated registry map typing was corrected.

MIGRATIONS:

- None. Wave 2 is runtime/source governance plus generated registry only; no schema was applied to shared/staging/prod.

ROLLBACK:

- Revert the Wave 2 commit from `stepup/main`.
- If reverting manually, remove `services/api-gateway/src/tenant/*`, the tenant registry generator/common/validator scripts, the `validate:tenant-isolation` and `test:foundation:wave2` scripts, the `validate-governance` tenant validator entry, and restore the prior auth/RBAC verifier snapshots.
- No database rollback is required because Wave 2 adds no migration and applies nothing to shared/staging/prod.

GOVERNANCE:

- Tenant truth: `tenant-isolation-validator` derives the registry from the migration chain and fails if generated registry drift, duplicate entries, missing service-role guard wrapping, or direct service-role tenant-table bypasses appear.
- Fail-closed: guarded service-role table builders reject unscoped execution for every registry entry; the Wave 2 behavioral test iterates the full generated registry.
- Auth/RBAC: the static platform-console super-admin principal and RBAC platform-token bypasses were removed; `requireRole` resolves roles from persisted allowlist/employee rows rather than JWT role claims.
- Frozen-file check: no Wave 2 edits were made to frozen paths in `FOUNDATION_REPO_LOCKS.md`; pre-existing frozen auth/migration edits remain user-owned and unstaged.

SKIPS:

- None.
