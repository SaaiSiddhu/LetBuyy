# CODEX PRODUCTION LEDGER - started 2026-06-02T01:37:09Z

## BASELINE
- typecheck / governance(128) / lint / build / test: P0 gate `pnpm turbo typecheck` PASS (57/57 tasks), `pnpm run validate:governance` PASS (128/128), `pnpm lint` PASS (8 tasks, existing warnings only); build and full test remain pending for later phase gates.
- fresh-DB replay status BEFORE fix: FAIL at `database/supabase/migrations/011_plans_table.sql` line 79. Evidence: `bash -lc 'for file in $(ls database/supabase/migrations/*.sql | sort); do echo "APPLY ${file}"; docker exec -i letbuyy-p0-replay psql -U postgres -v ON_ERROR_STOP=1 -f - < "$file" || exit $?; done'` against disposable container `letbuyy-p0-replay` -> applied `001` through `010`, then `psql:<stdin>:79: ERROR: relation "super_admin_allowlist" does not exist`.

## PROGRESS LOG (newest first)
- 2026-06-02T02:17:04Z [P0.6] Wire real local stack to baseline - DONE - evidence: `pnpm run federation:local:up` -> Supabase started from `000_baseline.sql`, `supabase db reset --local --no-seed` replayed baseline, `docker exec -i supabase_db_letbuyy-federation-local psql -U postgres -v ON_ERROR_STOP=1 -f -` seeded successfully (`INSERT 0 3`, `INSERT 0 3`, `INSERT 0 1`, `INSERT 0 2`, `INSERT 0 1`, `INSERT 0 1`, `INSERT 0 2`, `INSERT 0 1`, `INSERT 0 1`, `INSERT 0 2`); `/health` -> 200; `/v1/storefront/urban-kicks-demo/products?limit=1` -> 200 with `Bengaluru Street Runner`; all web runtimes ready on ports 3000, 3001, 3002, 3003, 3004, 3005, 3010, 3011; seeded DB counts query -> `1|2|2|1|1` for sites/products/themes/partners/apps - commit pending.
- 2026-06-02T01:59:30Z [P0.5] Archive historical migration chain - DONE - evidence: `git mv database/supabase/migrations/001_*.sql ... 072_*.sql docs/archive/migrations-history/`; active migration list -> `database/supabase/migrations/000_baseline.sql`; archived migration count -> 72; updated `docs/governance/migration-governance.md` and `docs/migration-audit.md` to mark baseline authority and `073_*.sql` next forward migrations - commit pending.
- 2026-06-02T01:50:15Z [P0.4] Prove baseline equivalence - DONE - evidence: `000_baseline.sql` applied to disposable container `letbuyy-p0-baseline` -> `P0.4 baseline replay completed`; `diff -u .tmp/p0-clean-chain/clean-chain-public.sql .tmp/p0-clean-chain/baseline-public.sql` after identical `pg_dump --schema-only --no-owner --no-privileges --schema=public` dumps -> empty diff; both dumps 27743 lines - commit pending.
- 2026-06-02T01:49:00Z [P0.3] Generate verified baseline schema - DONE - evidence: `docker exec letbuyy-p0-clean9 pg_dump -U postgres --schema-only --no-owner --no-privileges --schema=public > database/supabase/migrations/000_baseline.sql`; normalized replay SQL by removing pg_dump `\restrict` commands and changing `CREATE SCHEMA public;` to `CREATE SCHEMA IF NOT EXISTS public;`; `wc -l database/supabase/migrations/000_baseline.sql` -> 27740 lines - commit pending.
- 2026-06-02T01:46:42Z [P0.2] Reconstruct clean historical migration chain in scratch copy - DONE - evidence: `bash -lc 'log=.tmp/p0-clean-chain/replay-clean9.log; : > "$log"; for file in $(ls .tmp/p0-clean-chain/migrations/*.sql | sort); do echo "APPLY ${file}" >> "$log"; if ! docker exec -i letbuyy-p0-clean9 psql -U postgres -v ON_ERROR_STOP=1 -f - < "$file" >> "$log" 2>&1; then tail -180 "$log"; exit 1; fi; done; echo "P0.2 scratch replay completed" >> "$log"; tail -180 "$log"'` -> `P0.2 scratch replay completed`; full log `.tmp/p0-clean-chain/replay-clean9.log` - commit pending.
- 2026-06-02T01:37:09Z [P0.1] Reproduce fresh-DB replay failure - DONE - evidence: disposable Supabase Postgres container + active migration replay -> `011_plans_table.sql` fails on missing `super_admin_allowlist` - commit pending.

## SKIPPED - NEEDS HUMAN

## REAL-E2E LEDGER

## VALIDATOR LEDGER
- 2026-06-02T02:33:41Z `pnpm run validate:governance` -> Governance validation passed (128 validators) after generated artifact cleanup for P0 gate - commit pending.
- 2026-06-02T02:29:27Z `pnpm lint` -> PASS (`turbo lint`; 8 lint tasks successful, existing warnings only) - commit pending.
- 2026-06-02T02:29:27Z `pnpm turbo typecheck` -> PASS (57/57 tasks successful) - commit pending.
- 2026-06-02T02:25:13Z `pnpm run validate:governance` -> Governance validation passed (128 validators) after baseline/archive/governance alignment - commit pending.
