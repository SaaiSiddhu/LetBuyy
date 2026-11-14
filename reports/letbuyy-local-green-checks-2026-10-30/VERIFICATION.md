# Local check repair — 30 October 2026

**The three reported failures are resolved, and the final affected verification matrix is green. Nothing deployed.** The complete Gateway unit lane, root contracts, workspace type checking/lint and source governance gate pass. Signup/billing, order immutability, store readiness, Console authorization and private message custody have passing owned-database evidence.

## The three failures

| Failing assertion | Actual current contract | Repair |
| --- | --- | --- |
| Placed-order line items must remain editable and recalculate totals | Placed orders are immutable commercial snapshots; changes belong in guarded drafts/returns/refunds. | Assert tenant and staff checks, explicit409 `ORDER_SNAPSHOT_IMMUTABLE`, and absence of a placed-item writer. The existing owned order regression proves attempted edits leave the snapshot unchanged and foreign tenants are denied. |
| Store health must directly run DNS/certificate/renewal probes | The dedicated custom-domain workflow verifies live domain state. Store readiness reads owned, persisted evidence with freshness limits and does not mutate verification state. | Keep live-domain/mobile contract assertions; separately assert the canonical readiness adapter, ownership, no-store, tenant/domain predicates,24-hour freshness and read-only behavior. Owned tests reject stale/foreign evidence and verify that reads do not change it. |
| Console token comparison must appear inline in the route file | All Console routes mount the shared timing-safe bridge before route handlers; human-session/permission checks are separate. | Trace the actual canonical import and mount order, fail-closed credential checks and shared comparison helper. Add a real-worker case with a valid human session and missing, malformed, same-length-wrong and wrong-length transport credentials; verify denial before identity/audit effects. |

No order-editing side door, live DNS probe inside readiness, duplicate token check or authorization bypass was introduced. Order, readiness and Console runtime source remained unchanged.

## Additional full-gate blockers resolved

The first complete governance run exposed five blockers beyond the three test failures. All were repaired and the full gate was repeated on the final source:

- **Route ownership:** recognize only the ordered pair of canonical bound-operator and permission middleware, including a non-shadowed module `const` alias. This uses AST/import checks rather than adding route names to an allowlist. Additional callbacks, missing/reversed middleware, wrong imports, mutable aliases and shadowed names remain failures.
- **Private SQL custody:** classify only migration372's two exact `postgres` custody policies, with the matching table, FORCE RLS and application-role revocations intact. No SQL policy or grant changed. Unsafe broader-role, missing-revocation, missing-FORCE and foreign-table variants fail; seven real database custody/role-denial cases pass.
- **Marketing composition:** follow server-loaded Pricing into the live client composition, while still checking every live component and rejecting archived twins from either module. Mutation cases prove missing server pricing, missing live components and dead-twin imports fail.
- **Legacy acquisition scan:** the tour's action word “Resume” was mistaken for the retired résumé product. The action now says “Continue automatic module tour,” with matching existing Hindi/Tamil translations. Site-type availability and publication gates were not changed.
- **Secret inventory:** four reviewed synthetic/public test values now have exact file/kind/SHA-256 exceptions. No directory exemption or detector change was added. A duplicated synthetic password was removed from an older review patch; no real credential was exposed or changed.

## Final results

| Check | Result |
| --- | --- |
| Complete Gateway unit lane | **1609/1609 pass** |
| Complete root contract lane | **339/339 pass** |
| Workspace typecheck | **81/81 tasks pass**; initial run0 cached, final repeat79 cached with2 re-executed |
| Workspace lint/CSS lane | **5/5 tasks pass**,0 errors; existing warnings retained; initial run0 cached, final repeat4 cached |
| Complete source governance gate | **114/114 gate validators pass**,0 FAIL/BLOCKED/SKIP;1 report-only validator not applicable to gate selection |
| Affected owned database suites | **120 passing cases across13 suites**,0 failures/skips in the latest result for each suite |
| Merchant package | **925/925 pass** |
| Identity package | **56/56 pass** |
| Marketing package | **190/190 pass**:4 boundary cases plus186 marketing cases |
| Billing core | **40/40 pass** |
| Security/source/policy/composition/secret checks | **135/135 pass** across the61,52 and22-case validator test groups |
| Production artifacts | Final Marketing production build passes; fresh Identity/Merchant/Commerce production builds also exercised by the owned browser regressions |
| Marketing tour browser | Desktop1366px and mobile375px keyboard pause → continue → pause pass; no captured uncaught page errors |
| Local services / public prices | Marketing9006, Gateway9010, Accounts9002 and Merchant9001 respond; founding prices remain₹199/₹699 with0 used slots |
| Cleanup | All three task-owned database runs have no remaining containers, networks or volumes |

Counts overlap across layers and are not a unique combined test total. The database matrix uses the latest successful result per suite: the initial full12-suite run passed11 suites, while the new Console case expected the inner bridge's error for a request correctly denied earlier by the internal perimeter. That expectation was corrected to the precise perimeter/bridge contract and all9 Console cases passed on rerun. The additional7-case custody suite passed separately. The original red receipt is retained; it was not relabelled green.

Evidence: [acceptance](acceptance.json), [test totals](evidence/test-results.json), [full governance receipt](evidence/governance-gate.json), [latest owned matrix](evidence/owned-latest-matrix.json), [all120 case names](evidence/owned-case-results.json), [original owned attempt](evidence/owned-initial.json), [Console rerun](evidence/console-final.json), [custody result](evidence/custody-final.json), [cleanup](evidence/owned-cleanup.json), [browser result](evidence/marketing-tour-browser.json), [service check](evidence/local-services.json).

## Isolation, scope and preservation

The governance gate performs generated-artifact cleanup. It ran only in an owned source snapshot under `/tmp/letbuyy-green-checks-20261030/governance-candidate`, with independently installed **offline/frozen** dependencies. Shared dependencies were not removed. The source gate's branch-history advisories remain explicit: some branch refs/old ledger rows are not measurable in that isolated clone. This verifies source governance, not a branch-promotion or hosted-release state.

Database mutations used ownership-verified disposable PostgreSQL/PostgREST. The preserved Supabase database was not seeded, migrated, reset or written by these tests. Billing/email provider operations remain capture-only fixtures, as in the earlier [signup/billing report](../letbuyy-signup-billing-local-2026-10-30/VERIFICATION.md); no real inbox, bank mandate, Razorpay sandbox or production transaction acceptance is claimed.

This is the complete **affected** matrix: full unit/contract, workspace static and source-governance lanes plus the13 named integration suites. It is not a claim that the entire root `pnpm test` behavioral catalog, all162 gateway-database suites, every device/Flutter suite or external-provider release gate ran. No required check within this matrix was skipped or weakened.

Twelve source/config/test files changed relative to the task-start snapshot; other selected source bytes were preserved. The only runtime UI edit is the tour action label and its translation key. No business policy, SQL migration, permission grant, package version or environment file changed. The shared checkout remains uncommitted; Git snapshots exist only in the disposable governance copy. No push, merge or deployment occurred.

[Task-only review patch](TASK-ONLY-SOURCE.patch) and [source lineage](evidence/source-lineage.json) isolate this work from the pre-existing dirty checkout. Raw command logs and failed harness attempts remain under `/tmp/letbuyy-green-checks-20261030/`. Early tour probes incorrectly requested a control omitted in reduced-motion mode and then tried to pointer-click its focus-visible-only presentation; the final probe uses the intended keyboard interaction. No CSS or accessibility behavior was changed to satisfy those probes.
