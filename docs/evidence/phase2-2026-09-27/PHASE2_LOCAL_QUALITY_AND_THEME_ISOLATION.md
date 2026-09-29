# Phase 2 — local quality gaps closed, theme tenant isolation reproducible, acceptance reconciled

2026-09-29. Branch `letbuyy/phase2-shared-buyer-identity`, worktree `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`.
Starting SHA `232c92764e686838ee239151c4d85d010fb4197a` (pre-Phase-2 base `130b669d`). Last source commit `be0f107a`; three
documents-only commits follow it (§11), the last of which is the branch tip. Not merged, not pushed, not deployed.

Execution mode: **SINGLE AGENT** · Subagents invoked: **NO** · Agent/Task delegation: **NO** · Background agents: **NO** ·
Parallel worktree agents: **NO** · Workflow orchestration: **NO**. (Long test runs were waited on as background *shell
commands*; they are processes, not agents.)

## 1. Verdict

**A — LOCAL QUALITY CHECKS AND THEME ISOLATION VERIFIED; remaining policy/cutover requirements listed separately.**

| Objective | Result |
|---|---|
| A. Stale next-task / acceptance claims | Corrected in place with dated notes, history kept; the drop-`site_memberships`/`site_roles` instruction is superseded; a further stale claim (the shadow-lookup timeout "gap") found and corrected. No table dropped, none authorized (§3). |
| B. Lint | 42 errors → **0**, no rule weakened, disabled, baselined (hex) or excluded; `turbo lint` 5/5 packages exit 0 (§4). |
| C. Theme tenant isolation | Reproducible from repository state in an owned cluster under the intended roles; 23 tests, five real-migration mutations and eight in-suite broken policy sets all fail it; **no grant added, no policy changed** (§5). |
| D. Final checks | Accounted test by test, skip by skip (§7). |
| E. Acceptance matrix and handoff | One matrix (§8); original requirements still open (§9); owner questions and the next task (§10). |

Two things surfaced that are **not** engineering defects of this branch but that the owner must know (§6.4, §10): the
local Supabase stack now holds overwhelmingly synthetic rows written by the gateway test lane, and the theme tables'
privilege posture is decided by the database image, not by any migration.

## 2. Boundaries kept

No merge into `develop`/`staging`/`main`, no push, no remote PR, no deployment or promotion, no hosted database or
feature-flag change, no authoritative identity cutover, no identity table deleted, no runtime re-bring-up, no S26
reinstall, no external message, payment or order, no buyer export exposure, no irreversible erasure. The local Supabase
stack (`supabase_db_letbuyy-newmac-20260926`) was **only read**, in sessions that enforce
`default_transaction_read_only=on` (each probe echoed `transaction_read_only=on`; a `CREATE TEMP VIEW` attempted in one was
refused by the database). Containers this task created — every owned-cluster run, plus one scratch cluster labelled
`com.letbuyy.phase2-scratch` — carried their own labels and were removed by name; `docker ps` shows no container this
task created. The three pre-existing dirty artefacts are byte-identical to their recorded fingerprints (§11).

## 3. Task A — the stale claims

### 3.1 What actually reads and writes the four tables (HEAD `be0f107a`, `git grep`, non-test source)

| Table | Read by | Written by | Status |
|---|---|---|---|
| `site_memberships` | `lib/tenant-context.ts:94` (`loadMembership`, reached through `resolveTenantAccessProfile`, called from `middleware/store-context.ts:162` on every store-scoped request); `routes/app-store/developer-routes.ts:901` (developer dashboard's membership list) | nothing | **Live read path.** Zero rows in every environment inspected. Keyed by `custom_user_id` with `role_slugs`/`permissions text[]`, so it is **not** interchangeable with `store_memberships` (`principal_id`, `role_ids uuid[]`). The accepted design migrates it (dual run, ORGANIZATION_ARCHITECTURE M3–M5); it is not a drop. |
| `site_roles` | `lib/tenant-context.ts:116`; `owner-role-backfill.ts`; `staff-role-backfill.ts` | `owner-role-backfill.ts` (finds or creates the one global `owner` role); `staff-role-backfill.ts` (`ensureStaffRole`) | **Load-bearing**: the canonical role catalog of the D03 target. Registered tenant table. |
| `site_role_permissions` | `lib/tenant-context.ts:132`; `target-shadow-comparison.ts:155` (imported by the live `staff-permission.ts` gate); both backfills | both backfills (insert; soft-delete on reconcile) | **Load-bearing.** Not a registered tenant table (scoped by `role_id`). |
| `store_memberships` | `target-shadow-comparison.ts:133`; `backfill-executor.ts`; both role backfills | `backfill-executor.ts` (upsert; `status → removed` on reconcile); both role backfills | Target of the D03 transition. Written only by library code that persisted real-Postgres tests run: no route or worker imports the executors. |

### 3.2 What was wrong and what was done

The 2026-09-27 closure recommended, as the next task, dropping `site_memberships` and `site_roles`. That was true of the code
of that day (three read call sites, zero writers) and stopped being true on 2026-09-28, when the D03 work made
`site_roles`/`site_role_permissions` load-bearing. `PHASE2_CONTINUATION.md` §3 had already said *do not delete*. Nothing was
dropped by this or any earlier task, and this task authorizes no deletion. Corrected in place, each with a dated note and the
original text kept (commit `eab3ee5b`): `PHASE2_CLOSURE.md` (status matrix row and "Exact next task"),
`F2.5_MERCHANT_STAFF_CONVERGENCE.md`, `PHASE2_TEST_BASELINE_RECONCILIATION.md` (§16 and §14), `PHASE2_TRANSITION_PLAN.md`
(status note), and the session memory. This task's docs commit adds further dated notes to three of those documents (§3.4).

### 3.3 Four kinds of evidence that must not be conflated

| Kind | What it proves | Example on this branch | What it does not prove |
|---|---|---|---|
| Database proof | A policy, function or migration behaves so, on real Postgres | `buyer-*-postgres`, `tenant-redteam-postgres`, the theme suite (§5), `backfill-and-target-shadow.postgres.test.ts` | That a browser session or the HTTP edge does |
| Internal signed-header API verification | The real router + real `authMiddleware` + real database accept and refuse the right requests when given a correctly signed internal identity | `real-staff-product-journey.postgres.test.ts` (real staff created through `POST /employees`, real HMAC headers) | A browser login, MFA or cookie behaviour |
| Browser login verification | The real sign-in redirect and session cookies work in a browser | merchant sign-in redirect to identity-platform; the console's ordinary-account-denied journey (F2.6) | Authorization inside the API |
| Owner-confirmed local runtime and S26 verification | The stack and the device build run | the owner's statement that both are complete | Anything about code paths the owner did not exercise |

The merchant-realm browser journey is therefore not re-queued: each category already has evidence, and it returns only if a
change invalidates one of them.

### 3.4 Further stale statements found while reconciling, and corrected in this task's docs commit

- `PHASE2_DECISIONS.md`, row "shadow-path bounded-failure behavior": called the slow-target-lookup timeout a "real, named,
  unfixed gap". It was fixed the same day (`3a75bcee` bounds both comparisons, `c35169d0` adds real cancellation, both
  ancestors of the tip; `staff-permission-shadow.test.ts` measures it). Two sibling documents already said so; this row did not.
  It must not be proposed as work.
- `PHASE2_DECISIONS.md`, last matrix row, and `PHASE2_TEST_BASELINE_RECONCILIATION.md` §11.2/§11.4/§11.5/§13: named the
  lint errors and the theme proof as still open. Both are closed (§4, §5).
- `PHASE2_CLOSURE.md`, "Remaining owner decisions": presented D03/D04/D05 as unanswered as a whole; the owner answered the
  first tier of each on 2026-09-28. Only the sub-decisions in §10 are open.

## 4. Task B — lint

Reproduced at the starting commit: 42 errors, `@letbuyy/customer-web` 41 and `@letbuyy/merchant-web` 1, all other packages 0.
Now `turbo lint` (5 lintable packages): **5 successful, 0 errors**; warnings 1447 (identity-platform 19, marketing-site 326,
admin-web 114, customer-web 883, merchant-web 105), which were not a target and are unchanged in kind. The two files that
carried hex errors keep exactly their warnings (`branding.ts` 22 and `branding.test.ts` 1, all `no-raw-color-functions`),
measured at the base and now.

| Rule | Where | Invariant the site protected | Correction | Verification |
|---|---|---|---|---|
| `@letbuyy/ui/no-hardcoded-hex` ×4 | `checkout-origin/branding.ts` | The AA fallback returns exactly the endpoint (black or white) whose contrast it measured | Endpoints read from `letbuyyPrimitiveTokens.color.{black,white}` (fixed primitives no theme overrides); the ratio is computed for the very constant that is returned | branding tests; values byte-identical (`#000000`/`#FFFFFF`) |
| `no-hardcoded-hex` ×2 | `checkout-origin/checkout/page.tsx` | Hairline border follows the theme border token | `border-[var(--lb-color-border,#e5e7eb)]` → `border-line` (`--color-line: var(--lb-color-border)` in `config/tailwind/letbuyy-tokens.css`, imported by the app's `globals.css`; the same layer supplies the `bg-surface` already on the element). The `#e5e7eb` fallback was unreachable: the provider always defines the variable. A `next build` was run in the disposable clone (§7.5) |
| `no-hardcoded-hex` ×27 | `checkout-origin/branding.test.ts` | Literal merchant colours are test **data**, not styling | Moved to `branding.fixtures.json`, loaded with `JSON.parse`; assertions one-for-one with non-empty guards; A/B mutation run proves identical pass/fail behaviour before and after | the customer-web app-test segment (60/60); mutation-verified |
| `no-hardcoded-hex` ×3 | `lib/theme-engine/liquid-page-assembly.test.ts` | Head style text must carry a valid `#RRGGBB` token | Built from `letbuyyColorTokens.primary` with a guard regex on the result | that test file; mutation-verified |
| `no-hardcoded-hex` ×1 | `scripts/liquid-parity-harness.mjs` | Every synthetic field value is distinctive so presence checks mean something | `distinctiveHexFor(id)` derives the colour from the id like every sibling value. **The harness was not run**: it rewrites tracked evidence under `docs/evidence/liquid-parity` | lint; read-through |
| `letbuyy-boundaries/no-new-next-api-route` ×4 | `app/api/buyer/{profile,addresses,addresses/[id]}/route.ts`, `app/api/store/[subdomain]/search-suggest/route.ts` | A Next API route exists only if reviewed and baselined; behaviour belongs in the gateway | Each reviewed and found a thin BFF proxy (forwards only the buyer's own token / a public query, no database, no commerce logic). Added to `config/eslint/boundary-baseline.json` (200 → 204, equal to the route inventory, now pinned by a test). Review found a real defect: three routes relayed a gateway **5xx** message to the browser; now only a 4xx message is relayed | 22 + 9 route tests (normal, unauthenticated, unauthorized, forwarding, error, no header leakage); 16/16 mutations fail them; `docs/governance/app-api-route-ownership.md` entry |
| `react-hooks/static-components` ×1 | `apps/merchant/web/src/components/settings/SettingsPane.tsx:67` | The header icon equals the sidebar row's icon for the same page | The icon reaches a module-level `SidebarTitleIcon` as a prop, so the element type is static by construction (the lookup returned a stable module-level reference, so nothing was remounting at runtime; the rule cannot prove that) | **21 renders byte-identical to the original**; `SettingsPane.test.tsx` (4 tests); 5 mutations each fail the test meant for them |

Two defects of the surrounding harness were found and fixed in passing, each with a guard: `theme-editor-aa.test.mjs` still
pointed at `apps/merchant-control-plane` and climbed three directories instead of four (36 of its 86 tests failed with
`ENOENT`, the other 50 never touch a file; three lines, 86/86 now), and customer-web's hand-listed test script silently
skipped any test it did not name and matched nothing for a `[subdomain]` path. `tests/contracts/workspace-test-runner.test.ts`
now fails, for both hand-listed workspaces, on an unnamed test, a glob path or a missing file.

## 5. Task C — the theme tenant-isolation proof

### 5.1 The question, and the answer the evidence gives

`tests/security/theme-tenant-isolation.test.mjs` did not pass from repository state and skipped itself on every machine
without a Supabase container of one particular name (`PHASE2_TEST_BASELINE_RECONCILIATION.md` §11.4). It was hand-provisioned
to green in two steps: a `SELECT` grant for `app_tenant` on `public.themes`, then a real `auth.uid()`.

| Hypothesis | Evidence | Verdict |
|---|---|---|
| A migration grant is missing | No migration grants `app_tenant` anything on `public.themes` (a table older than migration 164's default privileges; 164's per-table loop covers only tables with `site_id`/`store_id`). **All** gateway reads of `themes` go through `getSupabaseAdmin` (service role): every `.from('themes')` call site is in `services/api-gateway`, and the route files that make them contain no tenant-role plumbing. The local stack gives `anon`, `authenticated` and `app_tenant` no privilege on it either (read-only probe: `has_table_privilege` false ×3; ACL `anon=Dxtm, authenticated=Dxtm, service_role=arwdDxtm`). Governance moves the other way: migrations 223–260 REVOKE from `app_tenant`/`authenticated`/`anon` by name. Migration 196's header says `app_tenant` "has blanket DML grants"; on a database built from the migrations that is false for `themes`. | **No.** A grant would widen access with no runtime need. Not added. |
| The test used the wrong role | `themes_site_owner_read` matches `auth.uid()` against the site owner: an identity policy, whose contract roles are `authenticated`/`anon` with `request.jwt.claims`. The old suite read it as `app_tenant`, the tenant-GUC role, which carries no identity. | **Yes.** |
| The fixture lacks Supabase auth semantics | The shared bootstrap answered `SELECT NULL::uuid` from `auth.uid()`, so the owner policy could never match and its positive control could not be shown. The real function (read from the live stack) derives the identity from the claims. | **Yes.** |
| The test mixes access paths | It set `request.jwt.claims` and read as `app_tenant` in one breath, and asserted GUC behaviour of `themes`, which has no GUC policy. | **Yes.** |
| The environment was misnamed | It looked for `supabase_db_Letbuyy_Store`, not the current stack; FBR-44 had already recorded this suite passing by running nothing. | **Yes** (and now impossible: it fails, never skips, without a database). |

### 5.2 Database policy rationale — what each role is, and why no grant

| Path | Role | Identity or context | Tables | Policies |
|---|---|---|---|---|
| Identity | `authenticated`, `anon` (Data API) | `request.jwt.claims` → `auth.uid()` | `public.themes` | `themes_public_catalog_read` (live, non-private rows to anyone); `themes_site_owner_read` (the site's owner, user or custom-auth, site not deleted). Both `SELECT`, both PUBLIC; **no write policy**, so every write by these roles is refused |
| Tenant | `app_tenant` | `app.site_id` (`current_site_id()`) | `theme_instances`, `theme_releases`, `theme_editor_drafts`, `theme_preview_sessions` | per-table GUC policy from migration 164 (`USING` and `WITH CHECK` on `store_id`); unset context → zero rows and no mutation |
| Backend | `service_role` (BYPASSRLS) | none | everything | the gateway's runtime path |

The proof is of the **policy layer**: for a role that holds privileges, the policies alone decide. Migration 196 names that threat
("any role holding SELECT on the table"), so the scenario grants `SELECT` and DML on `public.themes` to `anon`, `authenticated`
and `app_tenant` **inside its own rolled-back transaction**; the grant is not a production claim and is verified gone from a fresh
session. Which roles hold privileges is decided by grants, not policies, and is pinned separately
(`posture.app_tenant.themes_select = false` on a database built from the migrations) so a later blanket grant is noticed.
That posture is currently set by the database image, not by any migration (§10, Q1).

### 5.3 What changed

| File | Change |
|---|---|
| `tests/executable/supabase-faithful-bootstrap.mjs` | `auth.uid()` is Supabase's own expression over the request claims: legacy `request.jwt.claim.sub`, then the claims document's `sub`, cast to `uuid`. Unset or empty → NULL (no identity); a malformed sub raises `22P02`; `SET LOCAL` scopes it to one transaction; no hardcoded identity. Plain `CREATE FUNCTION`, never `OR REPLACE`, and the bootstrap stops at the first existing schema, so it cannot overwrite a real `auth.uid()`. `auth.jwt()` and `auth.role()` stay stubs. |
| `tests/executable/supabase-faithful-auth-uid-postgres.test.mjs` (new) | The fixture verified on its own: 9 tests (NULL when unset; claims-derived and different per caller; legacy claim and precedence; sub-less claims are no identity; malformed raises; identity lasts one transaction, commit or rollback; change seen by the next statement; callable by the Data API roles, plain SQL, not security definer, no UUID literal; cannot overwrite an existing function). Seven deliberate defects (old NULL stub, hardcoded identity, VOLATILE, SECURITY DEFINER, OR REPLACE, either claim source dropped) each fail the test written for them. |
| `tests/security/theme-tenant-isolation.test.mjs` (rewritten) | See §5.4. Now a `postgres`-class suite: it builds its database from the migrations inside the owned cluster the runner hands it. |
| `scripts/governance/test-suite-catalog.mjs`, `test-behavioral.mjs`, `tests/governance/executable-runner-lifecycle.test.mjs` | The theme suite is classified `postgres`; `LIVE_EXTERNAL_SUITES` is empty and injectable, so the class stays exercised by a synthetic suite. Wrapper text and lifecycle tests updated. |

No migration, policy, grant or existing bootstrap statement other than `auth.uid()` was changed.

### 5.4 Evidence

- **23 tests, 0 skipped**, under `node scripts/governance/run-executable-suites.mjs --suite tests/security/theme-tenant-isolation.test.mjs` (≈21–25 s: the bootstrap and all 192 migrations are replayed, then the scenario).
- **Seeded before any claim**: 4 sites, 7 themes, two rows in each store-scoped table; `service_role` reads all of it.
- **Visibility matrix** (reader × theme; `1` visible): owner A sees its private theme and the catalog only; owner B the mirror; a custom-auth owner sees the private theme of a published site it owns; a soft-deleted site's owner loses it; an inactive catalog row and an ownerless private row are visible to nobody; no claims, claims without a `sub`, `anon`, and the tenant role with or without a context see the catalog and nothing private. The tenant context alone never exposes any tenant's private `themes` row (pinned as today's design: `themes` has no GUC policy).
- **Malformed identity** (`{"sub":"not-a-uuid"}`, `not json`): an error (`22P02`) or no private row — never somebody's row.
- **Store-scoped tables under `app.site_id`**: own row visible, other tenant's not, both directions, for all four tables; no context → zero rows.
- **Forbidden writes**: with blanket DML granted, `authenticated` (owner A), `anon` and `app_tenant` cannot insert (`42501`), update or delete (`0` rows) any private, other-tenant or catalog theme; afterwards all seven fixture themes are intact, none renamed, none inserted. Under the tenant GUC: inserting for the other store is refused (`42501`), moving an own row to the other store is refused (`WITH CHECK`), updating or deleting the other tenant's row touches 0 rows, and the other tenant's row is intact; own-store insert and update succeed (the positive controls). No context: insert refused, update/delete 0 rows.
- **Context cannot cross transactions**: an identity and a tenant context set with `SET LOCAL` are in force inside their transaction; in the next transaction of the same session — after `COMMIT` and after `ROLLBACK` — `auth.uid()` and `current_site_id()` are NULL, nothing private is visible, and setting them again in that transaction makes the row visible (so the zeros were the missing context).
- **Rollback cleanup**: after the scenario, a fresh session finds no fixture row in any table and the scenario's grant gone.
- **Negative controls** (a broken suite cannot pass): eight broken policy sets, applied inside the rolled-back scenario, are each reported by the check written for them (owner policy `USING (true)`; catalog policy that shows private themes; owner policy ignoring deleted sites; owner policy forgetting custom-auth owners — too strict, caught by a positive control; a write policy on `themes`; `NO FORCE ROW LEVEL SECURITY`; a tenant policy opened to every tenant; a tenant policy removed — deny-all, caught by a positive control). **Five mutations of the real `196_theme_rls_tenant_hardening.sql`** (owner policy `true`; deleted-site predicate removed; catalog policy shows private; `FORCE` removed; the baseline `USING (true)` policy restored) each turn the runner's exit code to 1, with the file restored byte-identical afterwards. Putting the suite back on the live-external list fails the lifecycle test.
- **Not silently skipping**: the class list is empty; with no reachable container the suite's hook throws a message naming the prerequisite and the supported runner.

### 5.5 Observations, not acted on

- `themes_site_owner_read` reads `public.sites` **as the caller**, so an identity reaches a site row only through `sites`' own
  policies. For a *draft* site owned through `custom_user_id` none matches (`users_manage_own_stores` keys on `user_id`): the
  custom-auth branch is effective only when the row is otherwise visible (published site), which is what the suite asserts.
  Harmless today (the gateway uses `service_role`); it matters the day the Data API is opened to merchants (§10, Q4).
- In the disposable bootstrap `auth.role()` is still NULL, so policies of the form `auth.role() = 'service_role'`
  (`theme_releases_service_all`, `theme_preview_sessions_service_all`) cannot match there. No suite here depends on them.
- The disposable bootstrap models the older Supabase default (Data API roles hold `ALL` on every new public table); the local
  stack's image grants them only `TRUNCATE/REFERENCES/TRIGGER/MAINTAIN`. The two differ, no migration decides which is right.

## 6. The local Supabase stack — what was read, what earlier lanes left

### 6.1 Read-only probes

`supabase_db_letbuyy-newmac-20260926` (PostgreSQL 17.6, latest migration 260, 465 public tables — the same 465 the migrations
build in a scratch cluster) was queried through `docker exec -e PGOPTIONS='-c default_transaction_read_only=on'`. Nothing was
written, altered, granted or replaced there, and no volume was touched.

### 6.2 What the stack's privileges show

`authenticated` and `anon` can `SELECT` **3 of 465** public tables (`marketplace_banners`, `marketplace_categories`,
`marketplace_trending_searches` — the three whose migrations grant it deliberately); `app_tenant` 304; `service_role` all. Default
privileges on new public tables give `anon`/`authenticated`/`service_role` only `Dxtm` and `app_tenant` `arwd`. Its `auth.uid()`
is the expression the bootstrap now uses. This is the source of the facts in §5.1.

### 6.3 What this task wrote to it

Nothing.

### 6.4 What the gateway test lane left there (measured)

`test:unit:gateway`'s glob (`*.test.ts`) matches nine files that discover this stack and write to it: `backfill-and-target-shadow`,
`real-http-shadow-rehearsal`, `real-staff-product-journey`, `verification-token-redemption` (`*.postgres.test.ts`, which delete what
they insert) and `gift-card-money-path`, `gst-invoice-issuance`, `gst-tax-computation`, `inventory-reservation-lifecycle`,
`merchant-tenant-predicate`. Four of the last five call `create_checkout_order`, `issue_gift_card` or `issue_gst_invoice` (the fifth
inserts rows directly) and they only partly clean up (two of them never delete). Read-only census, 2026-09-29:

| Measure | Synthetic (test markers `T12`–`T16`, `t16-autotest-*`) | Whole stack |
|---|---|---|
| products | 115 (91 under the primary published store `snaz`, 10 under a second published tenant, 14 under the test's own draft sites) | 117 |
| sites (`t16-autotest-*`) | 14 | 19 |
| orders containing a synthetic product | 96 (of which 14 are `t16-autotest-*`) | 97 |
| inventory levels / reservations on them | 101 / 82 | 102 / — |
| order tax lines / GST invoices | 80 / 20 | — |
| gift-card accounts / ledger entries / redemptions | not separable (no marker) | 40 / 90 / 30, created 2026-09-28 10:30 → 2026-09-29 06:07 UTC, i.e. exactly the window of the `gift-card-money-path` runs |
| earliest / latest synthetic product | 2026-09-28 08:18 UTC / 2026-09-29 06:07 UTC | |

The non-synthetic remainder is 2 products, 5 sites and 1 order. The 14 `t16` sites equal 14 runs of `merchant-tenant-predicate` in the
window, consistent with the gate batteries of this branch's earlier tasks; attribution to a single actor is not established and none
is claimed. **This task added none**: its gateway runs used `LETBUYY_LOCAL_SUPABASE_CONTAINER=letbuyy-no-such-container`, which
makes those tests skip visibly (14 skipped tests, each printing "not reachable"). Nothing was deleted. The 20 GST invoices are
guarded by `reject_update`/`reject_delete` triggers, so the orders they belong to cannot be removed by a plain `DELETE`, and the
gift-card ledger is append-only by design of the money rules; a marker-scoped cleanup would have to defeat those guards on the
owner's data. The choices are Q2 and Q3 in §10.

## 7. Task D — final verification and exact accounting

### 7.1 State

The gate battery, the root suite and the package tests ran at source commit `be0f107a` (the last commit that changes anything other than
documents), HEAD unchanged from the start to the end of each run; the real governance lane and the two builds ran at `d3bed683` (that
commit plus this document, no source change). The worktree also held the three dated-correction documents (committed later, with this one),
the nine preserved `analysis_options.yaml` modifications and the two untracked local-environment artefacts; none of them is a
lane input other than as a document to be scanned. Docker held no container this task had created when each run ended.

### 7.2 The safe battery — `gate.sh` (default mode) at `be0f107a`, gateway lane kept off the local stack

| Lane | Result |
|---|---|
| typecheck | exit 0 — **81/81** tasks (79 cached: the two changed packages re-ran) |
| lint | exit 0 — **5/5** packages, **0 errors**, 1447 warnings (§4) |
| governance `--plan` | exit 0 |
| validator sweep (each gate-lane validator run alone) | **113/114** — `stale-artifact` fails when run individually **by method** (it needs the orchestrator's cleanup); it passes in the real lane (§7.4) |
| `test:contracts` | 322/322 (was 320: +1 customer-web test-listing guard, +1 for merchant-web) |
| `test:unit:gateway` | 1331 tests: **1316 pass, 0 fail, 14 skipped, 1 todo** |
| `tests/governance` | 292/292 (was 291: +1 live-class mechanism test) |
| `tests/ci` | 10/10 |

### 7.3 Root suite — `node scripts/governance/test-behavioral.mjs --with-contracts` (the root `test` script, plus `--report`)

`2026-09-29T08:08:55Z → 08:18:10Z` (9 m 15 s), HEAD `be0f107a` at both ends, **wrapper exit 0**, JSON report `healthy: true`,
no owned container left behind. The header line reads `232 suites -- 173 pure, 0 live-external, 59 postgres`.

| group | files | tests | pass | fail | cancelled | skip | todo | status |
|---|---|---|---|---|---|---|---|---|
| pure + live | 173 (173 pure, 0 live-external) | 1854 | 1839 | 0 | 0 | 15 | 0 | ok |
| postgres (owned clusters, `--jobs 2`) | 59 | 305 | 305 | 0 | 0 | 0 | 0 | ok |
| contracts | — | 322 | 322 | 0 | 0 | 0 | 0 | ok |
| **total** | | **2481** | **2466** | **0** | **0** | **15** | **0** | **PASS** |

The owned-cluster group was also run alone, with the new `auth.uid()` in the working tree and before it was committed, to see what it
did to the suites that share the bootstrap: 59 suites, 305/305, 0 skipped, wall 479 s at `--jobs 2`. The 57 suites that existed before
this task went from 273/273 to 273/273 (the two new suites add 9 and 23).

### 7.4 Governance — two different things

The per-validator **sweep** in §7.2 runs each gate-lane validator alone, does no artefact cleanup and is safe in this worktree.
The **real lane** (`node scripts/validate-governance.mjs --lane=gate`) deletes generated directories (`node_modules`, `.next`,
`.turbo`, `dist`, `.dart_tool`, `build`, …) and therefore never ran in this worktree, which holds a live local environment. It ran
in a fresh disposable `git clone --local` of the committed tree (an earlier clone could not fast-forward past an amended commit),
then `pnpm install --frozen-lockfile`:

`d3bed683423f5f91342fea71b923bbcbb87c6506` (this document's first commit; source unchanged since `be0f107a`),
2026-09-29T08:22:35Z → 08:23:08Z (32 s), exit 0: **`TOTALS: PASS=114 FAIL=0 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1`** ("114 validators executed and
passed; 115 discovered on disk"), `stale-artifact` passing. In the clone the branch-dispositions validator prints "not checked: develop ref
missing locally" for each MERGED_DEVELOP row, because a fresh clone has no local `develop` branch; those rows are evaluated (and pass) in the
worktree's sweep. It was run again at `17034d37`, the tip after the commit that recorded this table (114 pass, 0 fail, 08:24:25Z → 08:24:57Z), and once more at the final tip.

### 7.5 Package tests and builds

- `@letbuyy/customer-web` `test`: **1036/1036** in three segments (60 app tests in five files + 31 new route tests in two files + 945 root-level tests; 0 skipped, 0 todo). It was 1005 before this task: the difference is the 31 route tests.
- `@letbuyy/merchant-web` `test`: **775/775** (4 new `SettingsPane` tests + 771; 771 was 735 pass / 36 fail before the `theme-editor-aa` path repair).
- `pnpm --filter @letbuyy/customer-web run build` and `pnpm --filter @letbuyy/merchant-web run build` (the gate does not cover `next build`) ran in the
  disposable clone at `d3bed683`: both exit 0 (webpack; 48 s and 51 s wall, "Compiled successfully"). The generated customer-web CSS contains
  `.border-line{border-color:var(--color-line)}`: the utility the checkout page now uses resolves to the token layer.

### 7.6 Skips, todos and failures, separately

| Class | Count | Detail |
|---|---|---|
| Test-level skips, root suite | **15** | all `[HUMAN-REQUIRED]` markers (`HR-KMS-LIVE`, `HR-TURNSTILE-LIVE`, `HR-PA-SPLIT-LIVE`, `HR-MERCHANT-PSP-LIVE`, `HR-GST-IRP-LIVE`, `HR-CARRIER-LIVE`, `HR-DNS-CHECKOUT`, `HR-WHATSAPP-LIVE`, `HR-DLT-TRAI-LIVE`, `HR-ESP-LIVE`, `HR-AUTOPAY-LIVE`, `HR-LEGAL-DPDP-PA`, `HR-WAREHOUSE-LIVE`, `HR-AI-MODEL-LIVE`, `HR-PROD-MIGRATE-DEPLOY`); each names what must be provisioned or approved. None added or removed by this task |
| Suite-level skips, root suite | **0** | was 1 (the live theme suite, invisible in Node's `# skipped`); the `live-external` class is empty and the Postgres group reports `skipped 0` |
| HUMAN-REQUIRED | **15** | the same fifteen: they are implemented as test-level skips, listed here so they are not read as defects |
| Test-level skips, gateway lane | **14** | the tests that need the local Supabase stack, skipped on purpose (`LETBUYY_LOCAL_SUPABASE_CONTAINER` names no container), each printing "not reachable" or "no local Supabase instance reachable -- this is a SKIP, not a pass". With the stack reachable they run, and write to it (§6.4) |
| TODO | **1** | `LB-BIL-002 (open)`: one payment cannot also activate a second store the same merchant owns. Open product work, unrelated; 0 in the root suite |
| Actual failures | **0** | in every lane, except the validator sweep's `stale-artifact`, which fails when run alone by method and passes in the real lane (§7.4). Before this task: 42 lint errors, and 36 `theme-editor-aa` failures in merchant-web's script |

**One intermittent failure, unidentified.** Of twelve runs of `tests/governance` + `tests/ci` (302 tests) at the final source state, one
reported 301 pass / 1 fail, and its output had been filtered down to counts, so the failing test's name was not captured. The run
before it and the ten runs after it passed 302/302 (five of those on the naturally loaded machine, one with twice as many busy loops
as cores). The machine is shared — other projects' compilers and test runners held its load average between roughly 170 and 270 — and
the Docker-based lifecycle tests in that group are the timing-sensitive ones, but that is a suspicion, not a finding. It is recorded,
not explained; a run that has to be attributed should keep the full TAP output.

### 7.7 Why the counts changed from the baseline (`e21dc2d9`: 2445 tests)

- **Root total 2445 → 2481 (+36), all passing:** pure +2 (the route-inventory/lint-baseline equality test; the live-class mechanism test),
  Postgres +32 (the `auth.uid()` verification 9 and the theme suite 23; 57 → 59 suites), contracts +2 (the test-listing guard, now one
  test per hand-listed workspace). The theme suite left the pure+live group (174 → 173 files) and its suite-level skip with it.
- **Gateway lane:** 1331 tests both times (this task added none there); 1330 pass → 1316 pass + 14 skipped, because the 14 local-stack
  tests were skipped on purpose (§7.6). `tests/governance` 291 → 292; `tests/ci` 10 → 10.
- **Package scripts (not in the root count):** customer-web 1005 → 1036 (+31 route tests); merchant-web 771 (735 pass, 36 fail) →
  775 pass (+4 `SettingsPane` tests, and the 36 failures repaired).
- **Lint:** 42 errors → 0; warnings not targeted.

## 8. Task E — the Phase 2 acceptance matrix (current as of 2026-09-29)

Vocabulary as in `PHASE2_DECISIONS.md`: IMPLEMENTED / LOCAL VERIFIED / NOT ACTIVE / BLOCKED. "Local" means the owned local database
or a disposable cluster; nothing here was exercised on a hosted environment.

| Package | Item | Status | Evidence | Still needed |
|---|---|---|---|---|
| F2.1 | Identity authority and transition map | **VERIFIED** (mapping) | `F2.1_IDENTITY_ISSUER_MAP.md` | Two deviations named, not fixed: the console session's symmetric secret, and the customer realm's HS256 issuer (Constitution: identity-platform is the sole asymmetric issuer) |
| F2.2 | Buyer sessions across origins | **LOCAL VERIFIED** | gateway 20+12, `buyer-authorization-codes-postgres` 10/10, CSRF 3/3, one live adversarial probe | none |
| F2.3 | Buyer profile and addresses | **LOCAL VERIFIED** | `buyer-profile-addresses-postgres` 8/8 | none |
| F2.4 | Order ownership, historical and new | **LOCAL VERIFIED** | `buyer-verified-ownership-postgres` 12/12; gateway 17/17 | none |
| F2.5 | Local staff transition / shadow preparation (D03, option "local merchant-staff transition") | **IMPLEMENTED, LOCAL VERIFIED** | principal repository, backfills (principals, store memberships, owner role, arbitrary-staff roles), target-backed shadow comparison, bounded and cancellable shadow lookup, real HTTP-to-database rehearsal, real staff product journey, revocation reconciliation; environment gate requires non-production **and** a local Supabase URL | one named alias gap (`reports:read`, no route uses it); a sustained observation window |
| F2.5 | Authoritative cutover | **BLOCKED — not attempted, not authorized** | — | observation window + a separate owner decision (§10, Q5) |
| F2.6 | Operator role enforcement (D04.1 tiers) | **IMPLEMENTED, LOCAL VERIFIED** | `requirePlatformOperator()`, 19 tests; console allowlist re-checked on every request; magic-link single use (one 200, one 409, one row); two unauthenticated static-token routes closed | the console app itself has no role concept to test a "restricted reviewer" against; the tiers are enforced at the gateway |
| F2.6 | Operator provisioning, bootstrap, recovery (D04.2–D04.6) | **BLOCKED** on owner decisions | — | §10, Q6 |
| F2.6 | Console delivery (D04.8) | **NOT ACTIVE** (boundary + capture transport; no sender chosen, no provider wired) | — | §10, Q7 |
| F2.6 | Moderation / impersonation callers (D04.9) | **BLOCKED** — no caller found in the repository | — | §10, Q8 |
| F2.7 | Tenant and privacy isolation | **LOCAL VERIFIED** | `tenant-redteam-postgres` (RT-1..9, 2/2), `security-rls-hardening-postgres`, and **the theme proof (§5)** | none |
| F2.7 | Buyer export generator (D05.1 scope) | **IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE** (`BUYER_EXPORT_GENERATION_AVAILABLE = false`; no route imports it) | 11 + 4 tests | — |
| F2.7 | Export release to real buyers (D05.2–D05.3) | **BLOCKED** | — | §10, Q9 |
| F2.7 | Retention, deletion, legal hold, incident ownership (D05.4–D05.8) | **BLOCKED**; irreversible erasure unimplemented | — | §10, Q10 |
| — | Hosted delivery, deployment, feature flags, hosted database | **NOT STARTED, not authorized** | `production-deploy.yml`/`deploy-staging.yml` are `workflow_dispatch`-only (D-DEPLOY) | owner acts |
| — | Local quality (this task) | **VERIFIED** | §4, §5, §7 | — |

## 9. Original Phase 2 requirements still open

Authoritative identity cutover and the sustained shadow-observation window (D03); operator bootstrap, recovery, MFA enrollment,
high-risk dual control, delivery activation and the moderation/impersonation callers (D04); export release, requester
verification, retention, deletion, legal hold and incident ownership (D05); the privacy policy those depend on; the two named
identity-authority deviations from F2.1; hosted delivery and deployment. None was touched, none is claimed.

## 10. Owner decisions and the next task

Only questions the record leaves genuinely unanswered. Every option is a **proposal**, not an `OWNER_DECISION`; silence is not approval.

### 10.1 Raised by this task

| # | Question | Recommended | Alternative | Unlocks | Safe behaviour while unanswered |
|---|---|---|---|---|---|
| Q1 | Should the theme tables' privilege posture be made explicit by a migration? Today `themes` is unreachable by `anon`/`authenticated`/`app_tenant` on the local image and reachable by `anon`/`authenticated` on the disposable bootstrap; no migration says which. | A migration that `REVOKE ALL`s `public.themes` (and, after the same review, the other theme tables only the gateway reads) from `anon`, `authenticated` and `app_tenant`, with a paired rollback, the RLS policies kept as defence in depth, and `posture.app_tenant.themes_select` widened to all three roles | Leave it; it is safe wherever the image matches the local one, and hosted grants are `UNKNOWN_LIVE_STATE` | A deterministic posture across images; a hosted check that needs no assumption | The policies isolate any role that does hold `SELECT` (§5); the gateway needs none. Nothing to do. **Do not** grant `app_tenant` `SELECT` on `themes`: no runtime path needs it |
| Q2 | Should the nine gateway tests that write to the local stack stop doing so by default? | Make them hermetic: build their own tenant in an owned cluster (no `snaz` constant, no dependence on the restored store), and until then require an explicit opt-in environment variable | Keep auto-discovery (they are the T12–T16 real-database checks) and accept residue on the dev stack | A gateway lane that is safe to run beside the owner's data | Run the lane with `LETBUYY_LOCAL_SUPABASE_CONTAINER=<non-existent name>`: they skip visibly (14 skipped tests) |
| Q3 | What should happen to the synthetic rows already in the local stack (§6.4)? | Restore the stack's data from its own restore source, or recreate it; do **not** hand-`DELETE` (GST invoices are trigger-protected, the gift-card ledger is append-only by the money rules) | Leave them: they are identifiable by their markers and only clutter the `snaz` catalogue and orders | A local stack whose merchant views are not 96/97 synthetic | Nothing runs against it from this branch; the rows are read-only evidence |
| Q4 | Is a custom-auth owner of an unpublished site meant to read that site's private themes through the Data API? (§5.5) | Leave it (dormant); decide together with the Data API exposure of merchants | Add a `sites` policy keyed on `custom_user_id` (an RLS change: ARB) | Nothing today | The gateway path is unaffected |

### 10.2 Carried from the decision package (still unanswered; D03/D04/D05 first tiers were answered 2026-09-28)

| # | Question | Recommended (on record) | Alternative | Unlocks | Safe behaviour while unanswered |
|---|---|---|---|---|---|
| Q5 | D03: approve the authoritative cutover after a sustained observation window? | Not before the window exists; then a separate decision. Migrate the merchant realm onto identity-platform OIDC first, staff-membership unification in the same phase | Accept the current three-realm state as a staged milestone | One principal graph under the realms | `staff-permission.ts` stays the only enforced path; the shadow is flag-gated, local-only and cannot change a response |
| Q6 | D04.2–D04.6: who assigns operator roles; bootstrap authority; recovery approver (and the 8-hour console-session question, now closed for the allowlist dimension); MFA enrollment model; high-risk dual control | Follow the wave order (merchant realm validates the pattern first); TOTP minimum, aal3 for break-glass. **No recommendation on record for dual control or the approver: a business-risk judgment** | Keep admin-provisioned MFA and single-superadmin plus audit | Operator provisioning and recovery without a database edit | Roles exist and are enforced per request; no assignment route, no bootstrap; the static console principal is unchanged |
| Q7 | D04.8: wire the delivery adapter now (sender address, copy, delivery-failure ownership)? | Defer until a sender and an owner for failures exist | Wire `resend-adapter` now | Console magic-link email in a real environment | `getConfiguredConsoleMagicLinkDeliveryAdapter()` returns `null`; production submissions end at `magic_link_delivery_not_configured` |
| Q8 | D04.9: does a real caller exist for merchant moderation/impersonation (outside this repository)? | Confirm, else deprecate | Investigate further | Deciding whether those routes stay | No caller found here; nothing calls them |
| Q9 | D05.2–D05.3: requester verification and release protection for a buyer export | Step-up beyond a session; signed, expiring, single-use link. **No recommendation invented for the legal exemptions** | In-app only | A real export route | The generator is disconnected from every route |
| Q10 | D05.4–D05.8: retention, deletion exceptions, legal hold, deletion approval, incident ownership | none on record: policy and legal input | — | Deletion execution | Nothing is deleted; every record category retains indefinitely |

### 10.3 The concrete next task

**P2-HERMETIC-GATEWAY-DB** (engineering, one bounded session; presupposes Q2 answered "hermetic", the recommended option): the nine
gateway suites listed in §6.4 build their own tenant inside an owned cluster (the runner's per-suite database, the faithful
bootstrap, the migration replay the other Postgres suites already share), stop referring to the restored `snaz` store, and leave
the local stack unread by default. Acceptance: (1) a read-only census of the local stack before and after `pnpm run test:unit:gateway`
is identical; (2) the nine appear in the owned-cluster group and pass; (3) no test file contains a store, location or container
constant belonging to the restored stack; (4) each is mutation-checked. Independent of any answer, the smaller unblocked item
is the `reports:read` canonical alias (`packages/permission-core`), which removes the one remaining "excluded by name" entry from
derived staff roles. Not the next task, by explicit exclusion: dropping any identity table, re-bringing the runtime up, or repeating the
merchant browser journey.

## 11. Commits, dirty paths, confirmations

Commits on this task (all local, staged by explicit path, identity `SaaiSiddhu <saaisiddu@gmail.com>`):

| Commit | Subject |
|---|---|
| `eab3ee5b` | docs(evidence): supersede the site_memberships/site_roles deletion instruction; disclose the gateway lane's local-stack writes |
| `acf7b05f` | fix(lint): clear the 37 hardcoded-hex errors in customer-web without touching the rule |
| `eced3827` | fix(lint): reconcile the four unbaselined Next API routes after reviewing each, and give them tests |
| `3ed9b7eb` | fix(lint): render the settings header icon through a module-level component |
| `18aa35b1` | fix(test): point theme-editor-aa at the merchant web app's current path |
| `be0f107a` | test(security): prove the theme RLS in an owned cluster, under the roles and identity it is written for |
| `d3bed683` | docs(evidence): Phase 2 local quality, theme isolation proof and acceptance reconciliation, with the dated corrections it cites (this document) |
| `17034d37` | docs(evidence): record the real governance lane and both app builds; tighten the acceptance record |
| (branch tip) | docs(evidence): list this task's commits accurately (documents only) |

Pre-existing dirty paths, preserved byte-identical and never staged: the nine `analysis_options.yaml` modifications
(`git diff -- '*analysis_options.yaml'` sha256 `b8af63ad4a51f786`, 95 lines), `docs/evidence/local-environment-2026-09-28/RUNBOOK.md`
(`1371b6c4b3eddd73`), and `apps/deferred/delivery/mobile/ios/Flutter/ephemeral/` (tree hash `f47fcfa380a8404e`).

Confirmations: no identity table deleted; no runtime re-bring-up and no S26 reinstall; no merge, push, deployment or promotion;
no hosted database or feature-flag change; no external message, payment or order; no backup, signing asset or environment file
touched; no shared cluster or Edynox container touched (`letbuyy-executable-pg` and the `edynox-*` containers were neither
addressed nor modified); no broad Docker cleanup (every container removed carried this task's label and was removed by name).
