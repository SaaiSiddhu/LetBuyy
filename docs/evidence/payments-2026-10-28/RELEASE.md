# Payments foundation release — 29 October 2026

Owner instruction: “Deploye it broo”. This authorizes release preparation and deployment of the qualified slice. It does not establish provider approval or waive a failed money/security gate. The complete68-item programme remains incomplete.

Qualified implementation:9b74ff5511ecc9ec2f48bb6abcf66007375d6d08. Runtime source is identical to d33ef139479105e6376e44171ff42705ab944ef6; the follow-ups repair only the role-test dependency loader and record its claim. Final integration/release commits must retain that runtime/migration tree exactly.

## Scope

- Merchant payment setup and Test/Live payout reads use the canonical contracts and existing UI. Sandbox credentials, explicit online activation, independent COD, immutable connection history and complete paginated totals are included.
- API owns atomic configuration, credential-bound checkout drain, verified atomic canonical captures, original-connection refunds and zero transaction rake. Queue uses the approved bounded signed notification transport.
- Deploy only migrations403–409, API/Queue Workers and Merchant web. No mobile store publication, new runtime, shared platform collection account, live activation, KYC submission, bank change, real payment/refund or historical bulk email replay.
- Managed live payments remain unavailable: Technology Partner/Route approval and provider/bank qualification have not been obtained. Merchant-owned live activation, full browser/webhook capture convergence and provider-report reconciliation remain programme work, not release claims.

## Qualification

Retained reports: `/private/tmp/letbuyy-payment-system-plan-20261028/`.

- Gateway1831 units and original scoped browser/adapter evidence are pinned in EXECUTION.md. The final runtime source is unchanged.
- Broader exact-runtime Worker/PostgreSQL lane:12 clean suites passed112 tests; its thirteenth suite initially refused an omitted explicit prepared-transaction flag, then passed all11 reconciliation tests unchanged in its required profile. Original failure is retained.
- PostgreSQL checkout/ledger/settlement/late-capture/session lane:13 suites,43 tests passed. Independent RT-1…9 positive-control-first suite:2 tests passed.
- Zero-rake, signed notification and buyer/contact checkout boundaries:4 suites,35 tests passed. These populations are distinct; overlapping earlier programme runs are not added to these totals.
- Auth security:61 tests passed after replacing the incomplete role fixture's Zod/export stubs with its real declared dependency graph. Identity red-team17 passed; Queue83 passed. Earlier loader errors are retained as harness failures.
- Merchant production build and touched Gateway/Merchant/Queue TypeScript checks passed. All114 governance validators passed. Branch-disposition ancestry separately rechecked with integration refs available.
- Fresh encrypted staging and production exports were restored into network-isolated Supabase17.6 clusters. Each exact-role up/down/up rehearsal preserved all523 original tables and all original migration history. Schema history330→337. No administrator helper was installed or required. No hosted migration occurred during rehearsal.
- Both Worker environments build through the governed wrapper. Current hosted rollback IDs/settings are retained encrypted; no key rotation is needed by this slice. The existing encryption secret remains unchanged.

## Rollout gates and recovery

Promote through develop→staging→main with fast-forward environment branches; preserve the feature branch and all recovery material. Staging must receive the exact qualified migration/runtime tree and pass hosted checks before production. Check exact-history SQL artifacts immediately before applying. Preserve existing Worker variables, secret names, routing, queues, schedules and limits, and verify uploaded module bytes against the dry-run builds.

Current production API rollback version:631da094-c3ef-423f-8978-880972a99a3a. Queue rollback version:6e910c9f-c886-405a-bf36-9fa0fc9d53b4. Merchant rollback deployment:dpl_AgHAyi37GuFTwL1UZYTsyxPj1JjZ. Re-read these immediately before activation; any concurrent change stops the rollout for reconciliation.

Application rollback retains the expanded schema after any new credential/payment/refund history is recorded. DOWN403–409 is demonstrated only on the fresh pre-use recovery copies; the guards intentionally refuse destructive history removal after use. Do not automatically roll back an external provider effect or replay an uncertain mutation.

Hosted staging Accounts/Merchant sign-in has not been qualified. A complete real Razorpay sandbox capture/refund has not been observed for this candidate. TEST-R8 V-SMOKE acceptance must be resolved explicitly if those limitations remain after staging. Earlier release-specific exceptions do not apply to this candidate. Source/UI tests, read-only hosted metadata and HTTP health do not substitute for those journeys.
