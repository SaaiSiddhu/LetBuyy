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
