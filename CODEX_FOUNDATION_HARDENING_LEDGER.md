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

## SINGLE-WRITER LEDGER

- 2026-06-05T15:03:40Z table `orders` -> sole writer `services/api-gateway` for payment webhook order transitions; `services/webhook-service` now calls gateway internal payment endpoints; second-writer validator added pending commit.
- 2026-06-05T15:03:40Z table `products` -> sole writer `services/api-gateway` for payment webhook legacy stock fallback; `services/webhook-service` has zero direct writes to `products`; second-writer validator added pending commit.

## TRACEABILITY MATRIX

| ID | Status | Phase ref |
|---|---|---|
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
| H-1 | IN PROGRESS - orders/products webhook writers removed; remaining dual-writer sweep pending | F1.1/F1.2 |
| H-2 | PENDING | F7.1 |
| H-3 | PENDING | F8.1 |
| H-4 | PENDING | F3.6 |
| H-5 | PENDING | F2.5 |
| H-6 | PENDING | F2.2 |
| H-7 | PENDING | F4.1 |
| H-8 | PENDING | F7.2 |
| H-9 | PENDING | F1.6 |
| H-10 | PENDING | F1.3 |
| H-11 | PENDING | F1.4 |
| H-12 | PENDING | F1.5 |
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
