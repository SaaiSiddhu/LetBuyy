# 09 — Pre-Restructure Build Baseline

**Recorded, not fixed.** Every failure below was left exactly as found. No source file was edited to make anything pass. This is the "before" picture Phase 3's renames will be compared against.

Measured at System C `HEAD cbbf030d`, branch `feature/claude-md-durable-architecture-memory`. Order followed per runtime: typecheck → lint → test → build, stopping that runtime at its first hard failure (subsequent steps recorded as **BLOCKED**, not re-attempted). `node_modules` was present and complete (1.0 GB, 862 packages in `.pnpm`) at the start — no `pnpm install` was needed before running any per-runtime check.

## Per-runtime results

| Runtime | typecheck | lint | test | build | First failure by name | Attributed to a dirty file? | Evidence command |
|---|---|---|---|---|---|---|---|
| `apps/identity-platform` | PASS | **FAIL** | BLOCKED | BLOCKED | `@letbuyy/ui/no-hardcoded-hex` error, `src/lib/email/resend.ts:83:11` | **Yes** — `resend.ts` is one of the 38 pre-existing dirty files | `pnpm run lint` |
| `apps/storefront-runtime` | PASS | **FAIL** | BLOCKED | BLOCKED | `@letbuyy/ui/no-hardcoded-hex` error, `scripts/liquid-parity-harness.mjs:65:14` (921 problems total, 38 errors) | No — not a dirty file | `pnpm run lint` |
| `apps/merchant-control-plane` | PASS | **FAIL** | BLOCKED | BLOCKED | `"Error: Cannot create components during render"`, `src/components/settings/SettingsPane.tsx:67:38` | **Yes** — `SettingsPane.tsx` is one of the 38 pre-existing dirty files | `pnpm run lint` |
| `apps/marketing-site` | PASS | PASS (326 warnings, 0 errors) | PASS (4/4) | PASS | — | N/A | `pnpm run build` |
| `services/api-gateway` | PASS | NOT RUN — no `lint` script declared in `package.json` | **FAIL** | BLOCKED | `razorpay payment verification validates signatures before confirming payment`, `src/__tests__/payments.test.ts:2:3661` (3/666 failing) | No — `payments.test.ts`/`payments.ts` do not import any of the 7 dirty `api-gateway` files; checked directly | `pnpm run test` |
| `services/queue-workers` | PASS | NOT RUN — no `lint` script declared | PASS (27/27) | PASS | — | N/A | `pnpm run build` |
| `services/mobile-bff` | PASS | NOT RUN — no `lint` script declared | PASS (8/8) | PASS | — | N/A | `pnpm run build` |
| `services/webhook-service` | PASS | NOT RUN — no `lint` script declared | PASS (16/16) | PASS | — | N/A | `pnpm run build` |
| `apps/platform-console` | PASS | PASS (114 warnings, 0 errors) | PASS (11/11) | PASS | — | N/A | `pnpm run build` |
| `apps/mobile/merchant-app` | PASS — `dart analyze`: "No issues found!" | PASS — covered by `dart analyze` (Dart has no separate lint step) | PASS (172/172, `flutter test`) | **NOT RUN** — Android build explicitly out of scope per instruction | — | N/A | `dart analyze`; `flutter test` |

**Note on `services/*` "build":** each of the four Cloudflare Worker services declares `"build": "tsc --noEmit"` — byte-identical to its own `typecheck` script. Where typecheck already PASSed, a re-run of "build" would trivially also PASS, but per the instructed stop-at-first-failure order, `api-gateway`'s build is recorded BLOCKED (test failed first) rather than run out of order.

**6 of 10 runtimes are fully green end-to-end** (all applicable cells PASS): `marketing-site`, `queue-workers`, `mobile-bff`, `webhook-service`, `platform-console`, `apps/mobile/merchant-app`.

## Attribution detail — the four lint/test FAILs

Two of the three app-layer lint failures and one service-layer test failure trace directly to files already known to be dirty (not mine, not touched this phase) from every prior phase's baseline:

- `apps/identity-platform/src/lib/email/resend.ts` — dirty, in the 38.
- `apps/merchant-control-plane/src/components/settings/SettingsPane.tsx` — dirty, in the 38.
- `apps/storefront-runtime/scripts/liquid-parity-harness.mjs` — **checked, not dirty.** This is a genuine pre-existing lint failure in tracked, committed source, unrelated to any session's uncommitted work.
- `services/api-gateway`'s 3 test failures (`payments.test.ts`, twice, plus a storefront-proxy host-routing test) — **checked, not directly attributable.** Neither `src/routes/payments.ts` nor the failing storefront-proxy source imports any of `api-gateway`'s 7 dirty files (`saas-execution.adapter.ts`, `supabase.ts`, `tenant-context.ts`, `employee.ts`, `notifications.ts`, `shipping-labels.ts`, `shipping-tax.ts`) — confirmed via direct `grep` for those import names before concluding this.

## The repository-level governance gate — run for real, last

Per the phase's hazard note, all ten per-runtime checks were completed and recorded first. Network connectivity to `registry.npmjs.org` was confirmed (`curl -sI`, HTTP 200) before running the real gate, satisfying the "recovery must be viable" precondition — so the destructive default lane was run rather than substituted with `--plan`.

```
node scripts/validate-governance.mjs
```

**Result: FAILED. TOTALS: PASS=107 FAIL=4 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1 (of 111 selected).**

| Validator | First failure by name | Attributed to a dirty/known-uncommitted file? |
|---|---|---|
| `validate-design-system.mjs` | `identity-platform: dark-mode reachability target file is missing` — traced to source: the validator requires `apps/identity-platform/src/lib/useAuthTheme.ts` to exist (`scripts/validators/validate-design-system.mjs:83`) | **Yes** — this is exactly the one pre-existing deletion tracked since this engagement's Phase 0 baseline, not caused by this phase |
| `sequential-migration-validator.mjs` | `Untracked migration file found on disk but not committed: database/supabase/migrations/208_employees_users_custom_fk_repoint.sql` (plus 209, 210) | **Yes** — these 3 files have been part of the untracked baseline (`database/supabase/` untracked count) since Phase 0 |
| `raw-error-message-validator.mjs` | `services/api-gateway/src/routes/shipping-labels.ts returns raw error.message for UNEXPECTED; add the code to sanitizePublicErrorPayload or remove the raw message` | **Yes** — both `shipping-labels.ts` and `shipping-tax.ts` are in the 38 dirty files |
| `branch-lag-guard-validator.mjs` | `Local working branch is 20 commit(s) ahead of main; main must be fast-forwarded (execute MERGE_RUNBOOK.md) before this branch can be treated as release-integrated` | **Partially.** `git rev-list --count main..HEAD` = 20. The branch was already 17 commits ahead before this entire engagement began; this engagement's own Phase 7.5 added exactly 3 commits (`782a5240`, `dfb96611`, `cbbf030d`) to that count. The underlying finding (main needs a fast-forward release) is a pre-existing process gap, not a code defect — but stated plainly rather than fully disclaimed: this session's own prior-phase commits are part of the 20. |

**`node_modules` was NOT deleted by this run — contrary to the documented hazard.** Measured directly before and after: `du -sh node_modules` reported 1.0 GB both times, `node_modules/.pnpm` still holds 862 packages, and `apps/identity-platform/node_modules` (a workspace symlink) is intact. Source-level check: `grep` across every validator referencing `node_modules` (`cycle-budget-validator.mjs`, `governance-common.mjs`, `validate-design-system.mjs`, `workspace-lifecycle-validator.mjs`) found no deletion call (`rmSync`/`unlinkSync`/`rm`) targeting it anywhere — `workspace-lifecycle-validator.mjs`'s only reference is an *exclusion* pattern for a file scan, not a cleanup action. **This means the hazard note carried forward from earlier phases of this engagement no longer describes the code at this HEAD** — whether it was fixed in this engagement's own D3-D5-class work or was already stale before this engagement began was not determined; either way, it did not fire this run, and consequently **no `pnpm install` recovery was needed or performed.**

## What this baseline proves and does not prove

**Proves:** that these specific commands, run against System C at `HEAD cbbf030d` with `node_modules` intact, produced exactly the PASS/FAIL/BLOCKED/NOT RUN results recorded above, on this date, in this checkout. It proves 6 of 10 runtimes are clean end-to-end today, and that all 4 real governance-gate failures trace to causes already present in the shared checkout before this phase touched anything.

**Does not prove:** anything about runtime behaviour, request wiring, tenant isolation, money correctness, or production readiness — `tsc --noEmit`, `eslint`, and `node --test` unit suites do not execute the application against a real database, a real Cloudflare Worker runtime, or real provider credentials. It does not prove Phase 3's renames will be safe — only that these are the specific, attributable failures that already exist and must not be confused with anything a rename introduces. It does not prove the governance gate would pass with `node_modules` freshly reinstalled from the network rather than the currently-cached state (not tested, since nothing required it this run). Ephemeral-Postgres-backed test waves were not run, per instruction — **NOT RUN, reason: requires a live database, explicitly out of scope this phase.**

## Total runtimes attempted: 10. Fully green end-to-end: 6.
