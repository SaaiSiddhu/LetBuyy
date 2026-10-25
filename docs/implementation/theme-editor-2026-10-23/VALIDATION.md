# Theme editor validation ledger

Evidence date: 23 October 2026 (Asia/Kolkata). Starting HEAD `85aac990` plus the
preserved dirty checkout. This is not repository-wide green or hosted acceptance.

| Check | Result | What it establishes |
| --- | --- | --- |
| `pwd`, `git status --short`, `git branch --show-current`, `git rev-parse HEAD`, `git worktree list` | Exit 0 | One registered shared checkout on the reported branch/HEAD, extensively dirty. |
| Live `read_thread`, both specified chats, newest turn | Read | Active theme programme and separate Threadline acceptance ownership. |
| `lsof -nP -iTCP -sTCP:LISTEN` | Exit 0 | Existing local listeners, including 9000/9001. No functional acceptance. |
| `ps -axo pid,ppid,etime,command` | Refused by sandbox | Process command/parent ownership not established. |
| `docker ps --format '{{.Names}} {{.Ports}}'` | Permission denied | Container/database ownership not established. No mutation attempted. |
| `node --import tsx --input-type=module` importing first-party catalog generator | Exit 0 | Core-derived Forge 1.0.0 and Threadline 2.0.0 bundles materialize; both contain separate page/blog/article keys. Not installed/published acceptance. |
| Escalated read-only `ps -p ...` and `docker ps --format ...` | Exit 0 | Existing processes/containers inventoried without mutation. No auto-review rejection. Still no permission to reuse their fixtures. |
| `node --import tsx docs/implementation/theme-editor-2026-10-23/evidence/source-capabilities.mjs` | Exit 0 | All ten actual generated bundles inspected; actual editor normalizer pure functions reproduce extension type/metadata loss. Source-derived evidence only. |
| `node --import tsx --test apps/merchant/web/tests/theme-editor-u.test.mjs apps/merchant/web/tests/theme-draft-client.test.mjs apps/commerce/web/src/lib/theme-engine/liquid-preview-inspector.test.ts` | 96 passed, 0 failed/skipped/todo | Existing static control contracts, actual pure draft transport behavior and section-level DOM protocol tests. Does not test full editor, block identity, DB or browser. Log: `/private/tmp/theme-editor-baseline-tests.log`. |
| `node --import tsx --test --test-concurrency=1 packages/theme-engine/test/schema-field-extensions.test.ts packages/theme-engine/test/template-registry.test.ts packages/theme-engine/test/theme-document-nested-blocks.test.ts packages/theme-engine/test/editor-bridge-protocol.test.ts` | Exit 0; 352 passed, 0 failed/skipped/todo | Existing canonical field helpers, template-key registry, nested-document round trips/rendering and protocol constants. Does not prove these are wired through the editor. Log: `/private/tmp/theme-editor-engine-baseline.log`. |
| `node --import tsx .../evidence/selection-probe.mjs` | Initial harness attempts failed (root jsdom resolution, then CJS named-import interop); corrected invocation exit 0 | Actual Liquid inspector selects the parent section when clicking the second identical-label synthetic block; exact block ID absent. Existing section interception positive control passes. Evidence: selection-probe.json. No production code changed to obtain the result. |

No full application suite, browser journey, owned-database suite, typecheck, build,
CSS lint or full governance gate has yet run in this workstream. Deletion validation
is N/A so far: no package, table, renderer or load-bearing source has been deleted.

The real governance gate cleans generated output. It must run in a disposable
source-complete snapshot after required package checks, never against another
chat's live build or the shared checkout. Owned database work must use the reviewed
runner with `--no-reap`; listing or planning a suite is not a pass.

## Implementation checkpoint

- Document regression baseline: 4 passed/3 failed before repair (hidden state,
  nested children and duplicate timestamp IDs). After fixes and adversarial nested
  edit/depth cases: 9 passed, 0 failed/skipped. Logs: `/private/tmp/theme-editor-document-before.log`,
  `/private/tmp/theme-editor-document-after.log`.
- Template request baseline: 13 passed/7 failed. Canonical alternate/slash keys were
  rejected; constructor/prototype/uppercase were accepted. After shared-validator
  repair, registry + actual BFF + document/request tests: 288 passed, 0 failed/skipped.
  Log: `/private/tmp/theme-editor-template-boundaries.log`.
- Existing gateway adapter contracts: 27 passed, 0 failed/skipped.
  Log: `/private/tmp/theme-editor-adapter-contract.log`. Mocked transport only.
- Migration384 + paired rollback authored. Neither has executed yet.

No combined unique-test count is asserted across overlapping commands. Full browser,
owned SQL, build/typecheck/governance and theme-by-theme acceptance remain open.

## Preview/content checkpoint

- Actual parent handler + iframe inspector + signed server context helpers:15pass,
  0failed/skipped (`/private/tmp/theme-editor-preview-guards.log`). Canonical ID
  paths, wrong window/origin, stale session/revision/template/resource negatives.
- Actual renderer metadata + existing nested suite:17pass,0failed/skipped
  (`/private/tmp/theme-editor-block-metadata.log`). Initial fixture omitted required
  schema block and template fragment was autoescaped; corrected fixture and explicit
  raw use of the server-generated escaped fragment. No sandbox limit changed.
- Canonical SDK2 + CMS helper3:5pass,0failed/skipped
  (`/private/tmp/theme-editor-content-transport.log`). Initial SDK harness used an
  unavailable root package alias, then incorrectly expected SDK to forward a cache
  option it does not support. Corrected root import and kept no-store enforcement
  in the existing commerce/server layers; no SDK transport expansion.
- Resource BFF3 + existing resource source15:18pass,0failed/skipped
  (`/private/tmp/theme-editor-resource-pagination.log`). Real paginated DB and UI
  acceptance remain open. Query mocks/source tests do not establish mounted token
  verification, expiry or RLS. New owned suites are authored but NOT RUN.

Shared changes were scoped under coordinator leases and original baselines pinned.
No app build/typecheck/full governance or fresh browser/owned DB has run yet.

## Owned PostgreSQL and later checkpoints

- Run `deb4c7b78655`: template2 tests 1pass/1fixturefailure (older Core config had
  no template map); signed CMS1pass; historical CAS35pass. Cleanup complete/reaped[].
- Run `d0dc55e6b514`: normal Threadline install fixed setup; alternate save exposed
  the remaining migration087 table CHECK (503). Rollback/ACL1pass; positive1fail.
- Completed384 aligns RPC and table CHECK. Native table lock and PostgreSQL-normalized
  exact CHECK guard reject unknown expressions. DOWN restores the old CHECK only
  when retained rows fit it; otherwise preserves validated canonical CHECK and all
  alternate rows while restoring exact old private RPC. No data deletion/backfill.
- Run `4e36c50c2fc5`: alternate/customer save/read/replay/preview + rollback2pass.
- Final run `ba9fec662a00`: completed384 historical CAS35pass, signed CMS1pass,
  0fail/skips/cancelled/todo. All four runs cleanup failures[] and remaining
  containers/networks/volumes[]; reaped[]. Reduced reports: evidence/owned-pg-results.json.
- Later exact collection >24 lookup/count fields were added AFTER those mounted
  proofs; helper4pass; expanded mounted test authored, not rerun (slot transferred).
- Merchant tsc noEmit/incrementalfalse and gateway tsc exit0 after field adapters.
  Earlier merchant other-owner DOM errors were reported and subsequently fixed by
  owners. Commerce tsc private CMS checkpoint exit0. These are source checks, not builds.
- Canonical extension/storage/validation + document91pass, UI function controls3pass.
  Exact font whitelist test updated to the current curated7 (root-added Source Sans3);
  arbitrary-font negative gate remains. No font registry edit by this workstream.
- Private CMS projection to canonical Liquid and sanitizer + context9pass;
  inspector mode/ready/identity10pass; native text undo/redo/save2pass.
- Font token serialization + existing adversarial head security17pass. Actual font
  glyph rendering pending the theme owner. No Liquid limits/sanitizer relaxation.

Latest logs are under /private/tmp/theme-editor-*.log. Source changes after a
checkpoint require appropriate final-source checks. No full build, complete
control interaction suite, all10 editor browser journey or full governance green
is claimed. Private CMS collection/public blog work remains in progress.


## Group/origin, pagination and renderer checkpoint

- Actual normal UI created private Editor Lab23October /syn-editor-23oct-a,
  added Threadline draft and opened Customize on approved ff994 fixture. Core
  remains current; no paid plan chosen, fields saved or publication attempted.
  Preview showed Next error366899888; screenshot owned-editor-initial-error.jpg.
  Diagnosis traced configured buyer hostname to wrong-tenant proxy rewrite.
  Source fixes are NOT yet running in that snapshot; no repaired UI claim.
- Actual document/group compiler roundtrip and preview-origin checks14/14; full
  existing/new common editor793/7930skip at latest Lucide checkpoint.
  Logs /private/tmp/theme-editor-group-origin.log and
  /private/tmp/theme-editor-full-common-regression.log. Old type-location/icon-only
  import assertions were retargeted to the actual shared view type/Lucide contract;
  no security assertion weakened. Transient import-conversion issue caught by
  tsc and fixed before final793 pass; earlier failed logs were not acceptance.
- Public Hono blog pagination, actual ContentService/route adapter, signed collection
  adapter/context and parent protocol29/290skip; actual preview-choice callbacks
 2/2 in the common cohort. Logs /private/tmp/theme-editor-blog-context.log and
  theme-editor-final-common.log. No actual latest mounted PG/browser claim.
- JSON attribute reproducer1FAIL before fix: sanitizer removed data-variants.
  JSON filter now Unicode-escapes < > & before existing HTML escaping. New actual
  renderer+JSDOM JSON.parse roundtrip plus existing head/font/adversarial30/300skip.
  Logs /private/tmp/theme-editor-json-before.log and theme-editor-json-security.log.
  No sanitizer limits, schema bounds or rawHTML permissions changed.
- Merchant/gateway noEmit0 after these changes; commerce remains other-owner
  discovery integration errors while the handback moves. A wrong package-filter
  invocation matched0 projects and is NOT counted as a check; corrected cwd ran
  the actual commerce compiler and recorded failures. Touched module stylelint0;
  readonly full design-system ratchet0. No baseline update.
- New explicit-v2 source probe checks materialized base, editor normalizer,
  serializer, JSON.stringify/parse wire, canonical validator and compiler for10x21
  buyer template selections.2themes wirevalid;8 invalid from real pre-existing
  package values (not undefined keys); report preserves all exact values/issues.
  Repro evidence/v2-editor-source-probe.mjs; report v2-editor-source-roundtrip.json.
  This is intentionally FAIL pending existing factory owners, never a browser or
  installed CAS assertion. No repeated successful210-case acceptance claim.
- Root approved fixture PREPARATION ONLY. Runner --list recognizes
  owned-db/theme-editor-browser.manual.ts with --kind gateway-db; no Docker command
  or process startup. Exact wrapper is outside automatic *.test discovery and
  requires explicit opt-in plus existing owned guard; uses canonical fixture.
- Migration safety test earlier8pass/1fail: shared-maintained Git status changed
  concurrently during its read-only invariant test. Actual validator and destructive
  controls passed. Rerun in a source-complete isolated snapshot; do not weaken test.

- Later empty-template/group regression:10pass2fail before,12/12after (actual
  serializer/compiler, no other-owned registry patch). Logs empty-template-before/
  after. Tree keyboard +affected r/s/t101/101 after exact nested focus/activation,
  allgroup arrows, Home/End, native insertion Select and tabbable actions repair.
  Earlier793 full cohort predates these two fixes and is not recredited unchanged.
- Trailmark released canonical discovery; latest actual commerce noEmit0 after
  private preview token wiring. Merchant latest noEmit0 after keyboard changes.
  All three runtime typechecks now0 at this source checkpoint.
- Manual fixture non-opted invocation fails with explicit opt-in refusal, expected
  before owned DB acquisition; wrapper-optin-negative.log is only a safety negative,
  not an executed database/browser test. No PG/build startup performed.

- Theme-engine composite noEmit0 using external temporary tsBuildInfoFile. Initial
  --incremental false was incompatible with composite TS6379; corrected invocation
  passed without generated repository output. Log theme-editor-engine-final-tsc.log.

- View store configured-tenant-origin regression: actual helper/host resolver5pass2fail
  before, then focused+adjacent dashboard13/13 after with merchant tsconfig. Initial
  adjacent command failed alias setup; corrected command passes. No proxy/auth edit.
  Receipt evidence/store-link-source-release.json. Browser proof remains queued.

- After explicit final nine discovery handoffs, actual all10×21 source probe passed
  210/2100skip with88 stable start/end input hashes. Raw baseline, actual wire
  baseline and all per-template validation have zero issues. Saved/reloaded state
  and preview identities match; actual compiled bundle/document JSON roundtrip
  retains templates/settings. Immutable checkpoint-01 report preserves evidence;
  original red report remains. This is source qualification only, not installed or
  browser/publication/recovery acceptance. Log /private/tmp/theme-editor-v2-final-source-probe-01.log.

- Existing fixture opt-in/profile and13 canonical product data commands9/9 pass.
  Full gateway noEmit0 after one explicit local array typing repair. AST declaration
  byte comparison proves existing Threadline store/buyer helpers unchanged.
  Source-only setup: no owned DB or app launched, no product/order seeded yet.
  Receipt evidence/fixture-preparation-source-release.json.

- FINAL post390 consumer+Circuit accessible-count handoff: second full210/210 source
  gate passed on88 stable start/end inputs. Source reports preserve raw/wire gates,
  reload/preview identity and document parity. Immutable checkpoint02 receipt/report
  binds exact new Circuit/Habitat/Trailmark bundles;01 and initial red retained.
  Installed/browser/publish/recovery still queued.

- Exact owner stationery payload added as14th separate product/13th collection.
  Actual fixture commands/profile tests10/10; full gateway noEmit0. Original13
  checkpoint preserved; latest14 receipt lists exact hashes. Setup still unexecuted.
- Root found one subsequent registry input delta after source checkpoint02; its
  historical210 pass remains valid, but current admission waits final registry
  source release and a new full probe. No current-source acceptance inferred.
