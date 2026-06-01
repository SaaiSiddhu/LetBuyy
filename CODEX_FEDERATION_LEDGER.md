# CODEX FEDERATION LEDGER - started 2026-06-01T07:26:48Z

## BASELINE (F0)
- pnpm install: PASS after escalation. Initial `pnpm install` and `pnpm install --frozen-lockfile` returned pnpm's interactive reinstall prompt without useful execution; non-interactive `CI=true pnpm install --frozen-lockfile` removed/recreated root dependencies but failed in the sandbox with `ENOTFOUND registry.npmjs.org`; escalated `CI=true pnpm install --frozen-lockfile` completed successfully, 35 workspace projects, 547 packages added from the pnpm store, exit 0.
- pnpm turbo typecheck: PASS - 57 successful, 57 total; 57 cached; exit 0.
- pnpm run validate:governance: PASS after generated-artifact cleanup. First run failed only at `Stale artifact validator` because install/typecheck generated app/package-local `node_modules`, `.turbo`, and `dist` artifacts; cleaned generated artifacts; rerun passed 128 validators, exit 0.
- pnpm lint: PASS - 8 successful, 8 total; existing warnings only; exit 0.
- pnpm turbo build --dry-run: PASS - build graph generated for 35 workspace packages, exit 0.
- pnpm test: PASS after escalation. Sandbox run failed 196/197 only because `tests/app-platform/lifecycle.test.mjs` could not bind `127.0.0.1` (`listen EPERM`); escalated rerun passed 197/197, exit 0.
- real local stack up? supabase+gateway+apps: PENDING F0.2 - not attempted during baseline.

## PROGRESS LOG (newest first)
- 2026-06-01T07:26:48Z [F0.1] Baseline - DONE - evidence: `CI=true pnpm install --frozen-lockfile` -> PASS after escalation; `pnpm turbo typecheck` -> PASS 57/57; `pnpm run validate:governance` -> PASS 128/128 after cleaning generated artifacts; `pnpm lint` -> PASS 8/8 with existing warnings; `pnpm turbo build --dry-run` -> PASS; `pnpm test` -> PASS 197/197 after loopback escalation - commit pending

## SKIPPED - NEEDS HUMAN

## VALIDATOR LEDGER
- 2026-06-01T07:26:48Z validate:governance -> 128/128 PASS before F0.1 ledger commit.

## REAL-E2E LEDGER
