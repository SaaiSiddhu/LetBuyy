# N1.1 — verification baseline progress — 14 October 2026

N1.1 and N1 remain open. The existing native Goal is active, with one implementation writer. The 63 execution packages, original 77 acceptance packages and 103 audited feature dispositions remain intact. This is current local engineering evidence, not provider, hosted, device or release acceptance.

## Reproducible candidate and dependencies

Source is bound to `0862687a5008d604d0df23357b2eb511293139fa` plus the preserved uncommitted overlay. Verification runs in `/private/tmp/letbuyy-n1-verification-s0hksntl/candidate`, a private source snapshot with copied/hash-checked safe inputs and its own Git index/dependencies. Environment/signing/credential/local-data/generated files were excluded. Original dependencies, environment files, user changes and restored Docker resources were preserved.

Fresh `pnpm install --frozen-lockfile --ignore-scripts` succeeds across 55 workspace projects. Gateway declares Playwright 1.60.0; all four Workers use the locked Wrangler 4.100.0 and compatible Workers types 4.20260611.1. The Dart workspace's locked offline dependency bootstrap also succeeds. This does not prove provider installation, hosted configuration or devices.

Fresh root typechecking succeeds for all 81 tasks, including LCIS tooling; the audit's missing Node-type errors do not reproduce after installation. Root build executes all 81 tasks: 80 succeed and Merchant fails because its listing route exports a handler factory forbidden by Next. The unchanged factory is moved to adjacent `handler.ts`, with only GET/POST exported by the route. Its ownership/resubmission regression passes 7/7; its corrected real Next build passes. Other successful build tasks were not repeated. Builds used a clean inherited environment and explicit unavailable loopback API URLs, without provider credentials; they certify compilation, not hosted service behavior.

## Source and ownership corrections

The canonical validator walker excludes exactly the configured `.next-session-runtime-*` generated shape, preserves similar real source directories, and avoids broken/cyclic/external links. Artifact findings are represented at their roots; stray generated files still fail. The read-only cleanup planner recognizes the same narrow runtime shape and preserves tracked or linked roots. No root governance cleanup or broad artifact deletion was run. Negative controls fail before each change and pass after it; planner/traversal checks pass 30/30. Fresh runtime/route governance passes 37/37.

Twenty-two static style attributes in Rewards, Support and password reset use the same CSS-variable values as classes. The design baseline was not raised. Focused traversal/design/ad checks previously passed 53/53; buyer-switch component checks passed 2/2 and Commerce typechecking passed. Browser/device styling is not certified by those component checks.

The route inventory and lint baseline now agree on 213 routes after reviewing seven existing candidate proxies: buyer loyalty balance/history, buyer support tickets/messages, checkout handoff/steps and merchant listing resubmission. Database ownership and effects remain at Gateway/RPC boundaries. The retired order-service import exception is removed. A planted runtime credential field still fails the actual guard; an explicitly marked negative test fixture does not become runtime credential storage.

Stale source assertions now follow canonical Identity registration, verified buyer-order Liquid scope, server-selected destination shipping rates and atomic refund reservation/reconciliation. Rate/CSRF/human checks, existing-account takeover denial, sole issuance, ownership, price-change refusal and effect ordering remain asserted. SDK parity checks the complete supported GraphQL catalog; private orders stay on scoped REST. Registration contracts pass 11/11, Liquid account/template contracts 32/32, shipping/refund contracts 36/36 and initial inventory checks 13/13. These source checks are separate from runtime acceptance.

Reachability and privacy writer scans include genuine untracked candidate source and exclude tests/generated registries. The two private tables are connected through their intended RPCs, with assertions requiring actual application callers and the latest SQL body accessing each table. Complaint migration 287 is registered only after checking its exact insert columns and lack of privacy-type/outcome inputs. Reachability/RPC/privacy guards pass 107/107. Export/erasure fulfillment remains incomplete pending its policy and executor.

## Controlled runtime and real integration

The existing owned-database support now launches only fixed Next, session-smoke, Flutter or lifecycle clients after ownership verification. It uses explicit synthetic configuration, rejects executable/loader and hosted endpoint overrides, refuses app environment files, re-verifies the fixture, and supervises only its own descendants. Four direct process launchers are replaced; the 40-suite ownership inventory and source guards remain enforced.

Lifecycle checks pass 4/4 for forged scope, forbidden overrides, graceful/forced cleanup, killed supervisor and killed owner. NextURL in pinned Next 16.1.6 normalizes IPv4 loopback to localhost. The initial 127.0.0.1 binding caused external self-rewrites; owned clients now validate localhost resolves only to loopback, bind that host and set fixed IPv4-first DNS ordering. [Next CLI host configuration](https://nextjs.org/docs/app/api-reference/cli/next) and [Node DNS ordering](https://r2.nodejs.org/docs/latest-jod/api/dns.html) support those controls; the defect and correction were exercised locally.

Current scoped results, with zero skips/TODOs and clean owned resource removal:

- Checkout browser: 4/4; merchant onboarding browser: 1/1.
- Account/Identity browser and real Gateway/Postgres: 12/12, including stale writes and cross-tab privacy boundaries.
- Native Flutter client to Gateway/Postgres cart/recovery: 14/14. This is service integration, not physical-device proof.
- Payout replay plus explicit ledger-role bootstrap: 2/2.
- Resolver/rollback: 4/4; internal replay/operator: 22/22; privacy visibility: 6/6; price observations: 4/4, in one 36/36 owned run.

The account run previously timed out on a five-second stale-address alert. Explicit response-body and DOM diagnostics were added; the final run passed with the same wait and no product UI repair. A causal timing fix is not claimed; the earlier failures remain evidence for assembled repeatability verification. Synthetic OAuth/cart capabilities in terminal logs were redacted without changing totals or cleanup results.

## Remaining required baseline failures

Full pure baseline after the corrections runs 178 suites: **1,947 tests, 1,930 pass, 2 fail, 15 skips**, no cancelled tests or TODOs. The remaining failures are named definer-role closure and rollback preconditions. The 15 explicit human-required provider/hosted/legal markers remain visible; none substitutes for required proof.

A full-chain owned ACL probe inspected 219 definers and found three executable by direct Data API roles. `is_super_admin()` is the explicit migration-256 RLS policy-helper exception and must keep the policy access it needs; the probe's blanket zero-exposure assertion was too broad for that helper. The six-argument `marketplace_feed` and `marketplace_origins` are re-granted to anon/authenticated by migration 272. Their canonical callers, grants and recovery require a forward correction and actual role tests. No hosted exposure is inferred from the local fixture.

Rollback 308 now refuses unexpected overloads or input names before changing the resolver. Its owned negative control reproduces the former unguarded behavior; refusal preserves current funding, then the normal rollback/reapply still preserves journals, ACLs and all source families. Other rollback precondition findings remain open and must receive actual ABI/refusal/apply/reapply evidence, rather than scanner waivers.

Current run JSON, sanitized logs, snapshot/configuration fingerprints and exact next action are in `Verification/LetBuyy-Codex-Continuous-Run-2026-10-14`. No phase is closed. Continue with the two remaining guard failures and actual-role proof, preserving the owner's R01 decision: seven-day legacy store-customer compatibility for V1, with hosted drain/cutover separately gated.

## 15 October continuation: issuer fixture classification and current recovery

The earlier two-failure baseline above is historical. Current definer-role and
later-journal dependency recovery passes 6/6 in `69cdab3a8688`; migration 313
must be reversed before its migration-309 journal owner. The related current
session/browser changes and remaining gaps are recorded in
[N1.6 evidence](N1_6_DURABLE_CONSOLE_SESSIONS_2026-10-15.md).

The issuer validator also exposed synthetic signing inside the old Commerce
runtime smoke script. Its complete 1,690-line test body is now classified under
`apps/commerce/web/__tests__/customer-session-runtime-smoke.fixture.mjs`. The
original `scripts/customer-session-runtime-smoke.mjs` CLI remains a thin
compatibility entry point; package commands and the owned supervisor are
unchanged. The fixture is byte-identical (SHA-256
`9655f24ee51bc3a03856382fe4167b493ee6707641e4a80200016ba5842a757f`),
and all six static relative URL resolutions retain their original targets.
Both files parse, and issuer/domain validators pass without changing either
validator or adding an exception. This is test classification and preservation,
not a new production issuer or normal/provider identity proof.

The final scoped Console production build, Console/Gateway/auth-core type
checks, Console regressions, migration safety, dev-auth and tenant/domain
validators pass. Earlier full-suite totals retain their dated source lineage;
they are not relabelled as a fresh assembled programme acceptance run.
