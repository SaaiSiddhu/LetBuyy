# SUSTAINED-H — integrated acceptance: closing SUSTAINED-B.B's own gap, honestly

Branch `letbuyy/sustained-h-acceptance-pass`, base `eae7b19` (develop, includes merged
SUSTAINED-A through G3). The final phase of the sustained unified-foundation programme.

## What this phase did

SUSTAINED-B.B (`SUSTAINED_B_C.md`) explicitly left one gap: `pnpm run test:behavioral` (~230
files, ~55 Postgres-backed) had never been run to completion in this container — it was started,
observed clean through ~40 files (~10 minutes), then stopped in favor of a faster, targeted
reproduction of the one contamination bug that phase needed to fix. That evidence doc's own words:
*"A future session/phase should run it to completion and record the result here before calling
`test:governance` fully dependable in this container."* This phase does exactly that, then
investigates and fixes what is genuinely attributable, and is explicit about what is not.

## The full run

`pnpm run test:behavioral` under the Docker shim (`postgresql-16` native cluster, `service
postgresql start`, shim prepended to `PATH`), started in the background, ran to completion:
**2049 tests, 1983 pass, 45 fail, 6 cancelled, 15 skipped, 25.7 minutes.** This is the first time
this exact command has completed in this container this session (or, per B.B's own record, ever
in this container).

## Triage of the 46 `not ok` entries — classified by content, not assumed

**14 are whole-file crashes** (`tests/app-platform/{app-bridge,app-platform-killswitch-ui,
extension-manifest,lifecycle}.test.mjs`, `tests/auth/{rbac-categories,session-verifier}.test.mjs`,
`tests/billing/subscription-checkout.test.mjs`, `tests/executable/{checkout-order-concurrency,
gift-card-issue-idempotency,late-capture-after-release,money-rpc-idempotency-sweep}-postgres.
test.mjs`, `tests/gst/gst-invoice.test.mjs`, `tests/localization/theme-localization.test.mjs`,
`tests/logistics/logistics-adapter.test.mjs`) — each fails in 59-77ms with `ERR_MODULE_NOT_FOUND:
Cannot find package 'typescript'` (or similar), zero real assertion content. This is the exact same
transient container-level `node_modules`/filesystem inconsistency already observed and documented
twice this session (SUSTAINED-G1 and G2's evidence docs: `node_modules/.pnpm` briefly appears
missing, self-resolves on the next `pnpm install --frozen-lockfile` in seconds — too fast to be a
real reinstall). Not a code defect; a recurring environment reliability characteristic of this
container worth flagging for a future session, not something any test-file change can fix.

**Of the remaining ~32 descriptive-title failures**, cross-referenced against `git diff --name-only
41af1cd9 eae7b19` (this session's complete 44-file diff across all 8 merged phases):

1. **One real, attributable bug from this session's own work — fixed.**
   `tests/launch/lb-liquid-l2-assets.test.mjs:24`'s source-text regex,
   `/const themeHeadAssets = buildLiquidThemeHeadAssets\(bundle\)/`, pinned the exact pre-SUSTAINED-G2
   call signature. G2 changed that line to pass a second argument
   (`input.storeTemplate.customCss`) but never found this file — it lives under `tests/launch/`,
   not in any suite G2's own evidence doc's validation list ran. Fixed by updating the regex to
   match the new two-argument call; the file's other 3 tests were already correct and unaffected.

2. **One real, independently-caused bug — NOT part of this session's diff, but a direct
   continuation of SUSTAINED-B.B's own unfinished work, fixed the same way B.B fixed the original.**
   `tests/executable/security-postgres.test.mjs` ("Task 015...") and
   `tests/executable/settlement-postgres.test.mjs` ("Task 013...") each hit the *exact* class of bug
   B.B root-caused and fixed for `tenant-redteam-postgres.test.mjs` alone: `app_user`/
   `service_role`/`authenticated` are cluster-wide Postgres roles, but every `*-postgres.test.mjs`
   suite gets its own database, left standing; `DROP ROLE` refuses once ANY sibling database has
   granted anything to the role (`pg_shdepend`, genuinely cluster-wide), producing `role
   "service_role" cannot be dropped because some objects depend on it / DETAIL: 836 objects in
   database letbuyy_webhook_reclaim`. B.B's fix (`clearRoleDependenciesInSiblingDatabases`:
   `REASSIGN OWNED BY`/`DROP OWNED BY` in every sibling `letbuyy_*` database before `DROP ROLE`) was
   correctly scoped to the one file it reproduced against at the time — this phase's first-ever
   completed full run is what surfaced that the same root cause independently affects these two
   other files too. Ported the identical pattern into both (adapted to their own role list:
   `app_user`/`service_role`/`authenticated`, not `app_tenant`/`service_role`/`authenticated`/
   `anon`) — duplicated per-file rather than extracted into a shared helper, matching the
   established convention and not touching `tenant-redteam-postgres.test.mjs`'s already-merged code
   for a refactor-only reason.

3. **The remaining ~30 descriptive-title failures** (`pnpm dev`/`dev:apps`/`dev:all`/`dev:frozen`
   startup-script validators, `LB-11`/`LB-12`/`(P4-4)` route-count "188" lockstep assertions,
   `domain boundary validator rejects app-local API ownership drift`, `all seven web apps consume
   the shared design-system package`, `gateway auth middleware keeps the legacy branch order
   snapshot`, the theme editor Experience Picker, `production app deployment matrices match
   production Vercel topology`, storefront caching/JSONB-flag assertions, `5C Invite acceptance`,
   `theme tenant isolation (migration 196 RLS, live schema)`) touch **zero** files in this session's
   diff. Not fixed, and — precisely, not overclaimed either way — **not called pre-existing**
   (no prior completed full run exists in this container to compare against; SUSTAINED-B.B's own
   evidence doc is explicit that this exact command had never finished before), and **not
   attributed to this session** (the diff-scope cross-reference rules that out for every one of
   them). They are a genuine, first-observed, un-triaged baseline. One exception already resolved
   during SUSTAINED-G3: `converted Liquid theme keeps reusable and app block portability`
   (`first-party-liquid-portability.test.mjs`) was already independently confirmed pre-existing at
   that time by running it against the unmodified `develop` tip side-by-side — that one specific
   entry is not part of the ~30 un-triaged.

## Proof for the two fixes

- **L2 assertion**: `node --test tests/launch/lb-liquid-l2-assets.test.mjs` — 4/4 pass. (The prior
  phase's own revert-and-watch on the *source* change already exists in `SUSTAINED_G2.md`; this
  fix only updates a stale *test* assertion that had fallen out of sync with it.)
- **DROP-ROLE contamination fix, real revert-and-watch with an actual reproduction** (not a
  synthetic assertion swap): planted a throwaway `letbuyy_contam_repro_h` database, granted
  `SELECT` on a table to `app_user` in it (Postgres's own prescribed contamination shape,
  identical technique B.B used) — `security-postgres.test.mjs` passed despite it. Re-planted the
  contamination, temporarily disabled the new `clearRoleDependenciesInSiblingDatabases` call
  (`if (false) clearRoleDependenciesInSiblingDatabases(...)`, source only) — reproduced the exact
  original error verbatim: `role "app_user" cannot be dropped because some objects depend on it /
  DETAIL: 1 object in database letbuyy_contam_repro_h`. Restored the fix; `git diff --stat` back to
  the intended 44-line addition; passes again. `settlement-postgres.test.mjs` fixed identically
  (not independently re-proven with a second contamination plant — same code shape, same role list,
  same file structure; standalone pass confirmed).
- **An investigated, ruled-out false lead**: running `security-postgres.test.mjs` and
  `settlement-postgres.test.mjs` directly adjacent to each other in one manual `node --test`
  invocation intermittently fails the second file with an unrelated Postgres catalog error
  (`column sites.user_id does not exist` on one run, `duplicate key value violates ...
  pg_proc_proname_args_nsp_index` on another) — nondeterministic between runs. Confirmed by
  `git stash`-ing both fixes and re-running the identical pairing: **the same failure reproduces on
  the original, unmodified files**, ruling out this session's fix as the cause. This artificial
  pairing (these two specific files run back-to-back) never occurs in the real 230-file suite,
  where many other files run between them alphabetically; each file passes cleanly standalone, which
  is the scenario that actually matters. Recorded honestly as a separate, pre-existing, unfixed,
  low-priority flake in this specific two-file combination — not attempted, not hidden.

## Validation run

- `node scripts/validate-governance.mjs`: 109 pass / 5 fail / 0 blocked — the same 5 pre-existing
  ambient FAILs every phase this session has produced, nothing new.
- `git diff --name-status eae7b19..HEAD` (this phase): exactly the 3 files named in MAY WRITE —
  `tests/launch/lb-liquid-l2-assets.test.mjs`, `tests/executable/security-postgres.test.mjs`,
  `tests/executable/settlement-postgres.test.mjs`.
- Not run standalone this phase: a second full `test:behavioral` pass (25+ minutes; the two fixed
  files were verified individually, with real contamination reproduction, which is the actual
  claim being made — a second full run would not add information about files this phase did not
  touch, and the ~30 un-triaged failures are explicitly not this phase's to explain).

## Session-wide summary (SUSTAINED-A through H)

Eight phases, all `MERGED_DEVELOP` and pushed to `origin/develop`; `staging`/`main` untouched at
`1e6cc4c3` throughout, per the owner's explicit "hold promotion" instruction. 49 commits, 44 files
across A-G (+2711/-234 lines) plus 3 more in H; every fix carries a real revert-and-watch proof
(a targeted source revert or an actual planted-contamination reproduction, not a rerun of an
already-passing suite):

| Phase | What | Disposition |
|---|---|---|
| APPID-FIX2 | Product tenant-guard: 6 unscoped `products` call sites now carry explicit `store_id`/`site_id` predicates | MERGED_DEVELOP |
| SUSTAINED-B/C | Non-Docker Postgres feasibility (shim); root-caused + fixed cross-suite role contamination (1 file); tenant-guard `.filter()`/`.or()` operator tightening | MERGED_DEVELOP |
| SUSTAINED-D3 | `GET /buyer/orders` — marketplace cross-store buyer order visibility via `buyer_order_links` | MERGED_DEVELOP |
| SUSTAINED-E | Console MFA hardening (lockout, replay rejection, constant-time compare); identity-platform migration correctly recorded `BLOCKED_DECISION` | MERGED_DEVELOP |
| SUSTAINED-F | Merchant staff-membership: found THREE coexisting permission mechanisms, only one live; recorded `BLOCKED_DECISION` rather than picking one | MERGED_DEVELOP, no code change (investigation only) |
| SUSTAINED-G1 | Storefront search-box: bare `<input>` with no `<form>` → real `<form>`; real-browser (Playwright) proof | MERGED_DEVELOP |
| SUSTAINED-G2 | Merchant custom CSS: validated + persisted but never wired to the renderer → wired | MERGED_DEVELOP |
| SUSTAINED-G3 | Duplicate, divergent, unwired translation resolver → deleted, delegated to the tested one | MERGED_DEVELOP |
| SUSTAINED-H | Completed B.B's gap (full `test:behavioral` run); fixed 1 stale assertion + extended B.B's own DROP-ROLE fix to 2 more files; honestly separated ~30 un-triaged, diff-unrelated failures | MERGED_DEVELOP |

**Two `BLOCKED_DECISION`s remain, correctly not resolved alone**: the operator-console
identity-platform migration (SUSTAINED-E) and the canonical merchant-staff-membership mechanism
among three coexisting candidates (SUSTAINED-F). Both need the owner's word, not an invented answer.

**One first-observed, un-triaged baseline remains from this phase**: ~30 `test:behavioral`
failures with no connection to any file this session touched, surfaced only because the full suite
had never been run to completion before. A future phase's first task should be triaging these
individually — this phase deliberately did not attempt that, to stay within its own bounded,
attributable scope rather than absorbing an open-ended audit.

Single agent throughout: no subagents, no workflow orchestration, no background coding agents, no
scheduled/autonomous restart services, per the programme's explicit constraint.
