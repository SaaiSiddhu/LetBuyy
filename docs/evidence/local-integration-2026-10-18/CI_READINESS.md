# CI repair and machine continuation

Owner request: check remaining GitHub CI, fix failures and prepare `develop`
for continuation on another machine. Single agent. This is source/CI work;
the nine paused product phases retain their existing acceptance boundaries.

## Repair scope

- Fresh-checkout TypeScript, lint, canonical UI and Flutter fixtures; unsigned
  Android/iOS build prerequisites, including the current iOS 15 minimum.
- Owned browser and Dart prerequisites, the immutable official PostgREST
  mirror, bounded workspace concurrency and full-workspace CI coverage.
- One Supabase-faithful bootstrap in owned provisioning tooling, with unchanged
  compatibility imports for root suites; no runtime import of root test code.
- Real source extraction for LCIS test artifacts and canonical frozen-app
  detection. Generated graphs and runtime build directories stay untracked.
- Current guarded database fixtures, exact historical SQL-only recovery
  controls, portable temporary evidence and bounded prepared-transaction proof.
- Preserve effective backend T&S access when fencing inherited tenant grants
  in migrations313/319; journal added named grants and restore exact semantic ACLs
  on clean rollback. No new tenant mutation access or grant option.
- Recognize the exact modern Supabase journal ACL predecessor in migration360,
  then revoke and journal every non-read privilege as before. Unknown profiles,
  owners, grantors and grant options remain refusals.
- Reject product creation when persisted entitlement authority is unavailable.
- Propagate exhausted public product-query failures as sanitized errors; the
  storefront retry reloads the server read and recovers at the same URL.
- Generate operational LCIS artifacts from source, compare reports to current
  artifact inventories and use portable source paths. Graph query caches preserve
  ranking, case handling and result limits within the immutable engine snapshot.
- Keep background autovacuum out of newly owned migration fixtures, whose
  migrations require quiescence. Ordinary writer/prepared-transaction refusal
  controls remain real. The two exhaustive catalog suites have a bounded
  30-minute deadline; an explicit runner timeout still takes precedence.
- Read the complete product catalog profile in one bounded 64 MiB psql result,
  preserving every JSON field while avoiding repeated per-chunk catalog scans.
- Give the scheduled branch-lag monitor an explicit read-only context. It
  compares fetched `origin/main` with `origin/staging` even when the default
  checkout is `develop`. Production retains its main-only checkout guard and
  HEAD comparison; it cannot select the monitor context. Eleven isolated Git
  regressions cover real lag, missing refs and attempted context downgrades.
  A live fetched-ref check passed with both release refs unchanged.

No migration was applied to the restored or hosted database. SQL behavior is
checked only in disposable owned PostgreSQL. Existing security, money,
retention, tenant and provider controls remain acceptance requirements.

## CI platform follow-up, 19 October

The exact Node20.20.2 and digest-pinned mirror reproduced 42 setup failures:
child ownership rechecks had lost the already-verified image configuration.
Snapshot that configuration and carry it through nested owned clients; exact
image mismatch, hosted endpoint, restored-stack and resource ownership checks
remain enforced. The same advertising34 and buyer-session8 checks now pass.

The runner also announces the explicit two-slot prepared-transaction profile
to Gateway suites, matching the actual owned PostgreSQL setting. It never
inherits an ambient profile in place of the CLI option. Persistent per-run
JSON accounting and full suite logs survive in both GitHub acceptance jobs as
seven-day diagnostic artifacts. CLI report paths still override the fallback.

Gift-card replay now waits for all three real callers at a PostgreSQL lock
barrier before releasing them: the historical varying-code defect must still
duplicate value, and the fixed function must conserve one account/ledger with
three successful replies. All five controls pass. Both intended minute
consumers run, while a frozen app/payment job retains its exact queued state.
Staff delivery4, loyalty scheduling1 and reconciliation traversal11 pass.

Current 360 rejects schema CREATE escalation before older retirement guards
execute. Keep that HEAD refusal and additionally prove the original 349/345
ACL refusals in a separate reviewed historical SQL-only database, with state
conserved and no REST exposure. All 35 reel lifecycle controls pass. The CI
contract now requires complete workspace testing after the root behavioral
gate, so a final ledger commit cannot filter out the actual implementation.
All 338 contract checks and 14 ownership-negative controls pass locally.

Browser follow-up uses real hydration/session responses, precise product
anchors and bounded cold-page navigation. It retains the original editor
document, actor-switch refusals, real replacement-buyer BFF writes, stale-form
409 responses and exact no-write/privacy assertions. Final browser receipts
and the complete remote run remain required in the external handoff receipt.
Publication runs built local production apps under the existing owned
supervisor, so development HMR cannot replace the original A document.
Main CI, `.nvmrc` and `.node-version` use Node22, matching broad local verification. Node20 is
past its support window and emitted the upstream TransformStream shutdown
race during the exact-platform diagnostic. References: the
[Node release schedule](https://github.com/nodejs/Release) and
[upstream race/fix](https://github.com/nodejs/node/issues/62036).

The built publication journey also exposed a real Liquid Buy now defect:
navigation could cancel cart creation and used `/store/checkout` on a
storefront-domain root. The existing island now waits for the canonical
server cart token, avoids the drawer's competing create request, coalesces a
pending double click and keeps the correct host/path-based checkout route.
An outage or missing cart token keeps the shopper on the product with a retry
message. No price, tax, total or payment authority moves into the browser.
Three valid red controls reproduced premature/wrong-path navigation; all four
new controls pass with existing wishlist controls. Complete Commerce tests
pass1249/1249 and its typecheck passes. The real owned browser handoff remains
the required integration proof, including exactly one cart and zero orders.
The positive fixture's public stock matches its canonical 25 inventory units;
the original zero-stock fixture correctly kept Buy now disabled. Its built
production Commerce app uses an owned loopback HTTPS checkout proxy and a
one-day temporary certificate. Chromium trusts only that certificate's SPKI;
the existing production HTTPS/host guard stays enforced, and the test requires
a 200 HTTPS checkout document as well as the signed handoff. The certificate,
key, proxy and owned runtimes are removed by fixture cleanup.

The retained Linux run exposed another fixture boundary: gift-card connection
markers included the complete idempotency key and a process ID. PostgreSQL
[limits application names](https://www.postgresql.org/docs/16/runtime-config-logging.html#GUC-APPLICATION-NAME), and truncates long values, so a six-digit Linux PID made the exact lock
lookup miss a lock that was held. A short key hash keeps those markers bounded;
long real idempotency keys retain the historical duplication and fixed three-caller
conservation controls. No money function or assertion is relaxed.

The staff browser starts its real production Identity app before building
Merchant, retaining each app's existing readiness limit. Its existing 13-minute
test and the payout browser's existing 17.5-minute test receive bounded 15/20-minute
runner budgets, respectively. An explicit CLI timeout still wins, and all other
default/catalog deadlines retain their previous behavior. This avoids terminating
the 1050-second payout test at the unrelated generic 600-second limit; actual MFA,
actor, statement, replay and provider-evidence requirements stay in the tests.

## Continuation prerequisites

Use `develop` from the verified remote and Node22 (`nvm use` when available).
Install workspace dependencies with
`pnpm install --frozen-lockfile`. Run `flutter pub get` in
`apps/marketplace/mobile` and `dart pub get` in `packages/dart/api_client`.
Browser acceptance needs `pnpm exec playwright install --with-deps chromium`.
The root behavioral and gateway acceptance commands explicitly enable exactly
two prepared-transaction slots only in their newly owned test containers.

Full LCIS workspace tests additionally need Python 3.12, `graphifyy==0.8.39`
and `pnpm run test:prepare:lcis`. This extracts real source; no model/provider
credentials are required. Private continuity material, credentials, signing
assets and live local data are separate from a Git clone; see CONSOLIDATION.md.

## Verification and final receipt

Local verification includes all 85 typecheck tasks, all 93 non-Gateway workspace
test tasks, 1,605 Gateway units, all nine lint tasks, 114 governance validators,
unsigned Android/iOS builds, Flutter analysis/tests and the native R2 proof.
The repaired owned suites include product edits90/90, collections19/19,
collection browser5/5, customer/session browser12/12, staff browser1/1,
onboarding browser1/1, theme35/35, reviews45/45 and modern grants6/6.
These are separate suite receipts; intermediate failed and interrupted runs are
retained as diagnostics and are not represented as aggregate success.

The final handoff receipt records the pushed `develop` SHA and completed GitHub
run URLs. It is kept outside this source document so recording CI success cannot
create another untested Git commit. A local pass alone does not establish that
the final remote CI run passed. Product-phase/provider/release acceptance remains
separate from this source and CI handoff.
