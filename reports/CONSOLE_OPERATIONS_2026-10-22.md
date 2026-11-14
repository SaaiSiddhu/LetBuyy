# Console operations — 22 October 2026

Implemented and verified a bounded first delivery of the researched priorities on `develop` at `118209b4fde1b5a15313f4741bcac454690d15c8`. Source remains uncommitted. The owner's approved Burgundy & Porcelain identity is preserved.

## Delivered behavior

- **Support:** active platform staff lookup, owner and priority changes with a required reason, All/My/Unassigned/Overdue views, URL-backed search/status/priority pagination, first-response/resolution deadlines and paused/completed/overdue states, and escalation through the existing transaction. Ownership preserves ticket status and SLA clocks. Closed tickets, stale views, inactive staff and merchant staff cannot be assigned. Successful commands and audit/receipts commit atomically; duplicate requests have one effect and a lost reply can recover the original request. Internal notes preserve the status and never count as a public first response. No new SLA promise is introduced.
- **SaaS billing:** Merchant 360 and the subscription directory link to `/merchants/:id/billing`. The page reads site-specific canonical invoices, payment history, renewal events and mandates alongside the latest subscription and persisted effective entitlements. Issued invoice status, payment status and effective access remain separate. Queries are bounded and audited; foreign invoice/history evidence fails closed. The MFA-protected summary CSV checks exact site/invoice ownership and escapes spreadsheet formulas. Recorded minor amounts retain exact cents. This is a record summary, not a GST invoice PDF or new billing authority. Charges, cancellation and recovery continue through the canonical merchant billing flow.
- **Health and recovery:** Settings adds a bounded live database connection read, observation time and latency. Configured bindings are explicitly presence evidence rather than provider-health claims. Links connect to existing runtime evidence, webhooks, support and protected job recovery. The existing exhausted-loyalty-job workflow remains super-admin-only, independently approved and limited to its canonical worker/retry budget; no generic replay engine was created.
- **Console entry:** the normal user-browser check exposed a wrong-realm redirect from an unauthenticated Console deep link to merchant account lookup. Protected Console pages now enter the existing Console login flow. Identity remains the sole token issuer; the existing signed-session, live-membership, allowlist and MFA checks remain. Merchant and support pages also join the proxy matcher. The security contract now follows the canonical operator-verifier wrapper and explicitly rejects merchant-cookie admission.

## Verification

| Evidence | Result |
|---|---|
| Console unit/transport/session suites | 50 passed |
| Gateway guarded-client authority contracts | 12 passed |
| Owned database/API, existing support correctness and job browser run `31274208fa35` | 29 passed |
| Final API and merchant-to-Console browser run `22176a691801` | 7 passed |
| Delivered layout/browser run `e55274852e99` | 1 passed |
| Final sign-in-entry plus support/billing browser run `9f057db9517f` | 1 passed |
| Existing job recovery backend, in initial run `8bceea57e087` | 35 passed; that overall initial run retained four other failures |
| Final production build | Passed in a separate source copy |
| Types, scoped ESLint, CSS stylelint, whitespace | Passed |
| Domain boundary / tenant isolation / migration safety / design system | Passed: 225 app API routes, 317 registered tenant tables; no ratchet weakened |

Browser acceptance uses real local Identity forms, configured TOTP, mounted Next pages/BFF, Gateway, PostgREST and owned disposable PostgreSQL. It covers anonymous deep-link admission, assignment lost-response recovery, escalation, distinct invoice/payment labels, scoped CSV download/refusal, empty filters, dark mode and 390px layout. The connected merchant browser additionally verifies ticket creation, private/public reply separation and resolution. Database tests cover stale and closed records, bad owners, concurrent duplicate requests, mandatory-audit rollback, foreign billing history, unavailable dependencies and migration371 DOWN/reapply. Actual screenshots were inspected. All recorded owned runs cleaned up with no remaining containers, networks or volumes.

Final browser/build runtime sources match delivery, excluding generated Next environment declarations. API-client standalone typecheck initially lacked shared declaration output; the normal referenced build and typecheck then passed in the isolated copy. The original shared-support enum cycle was removed before final acceptance; the actual workerd Gateway was restarted and confirmed healthy. Initial failures are retained in evidence: the dependency probe lacked a scope, a dense existing support matrix exceeded the real rate budget, and adding timestamps to an existing race snapshot incorrectly included the fixture's own deletion timestamp. The probe now has fixed nil-ID/owner predicates, the test obeys Retry-After with fresh signed credentials and the same logical action key, and the assignment test reads its timestamp separately. Production limits and assertions were not relaxed. The initial precision fixture also had an incorrect Indian digit-group expectation, which was corrected.

The migration sequence gate remains **red** because migrations370/371 are untracked local files. This task does not authorize staging or committing them; the gate is preserved. This is local delivery, not merge/deploy acceptance.

## Approved local installation

The developer database was at369. Its existing operator-support function body was compared with the exact265 predecessor; no drift was found. The first ordinary attempt was refused by migration360's existing role-profile guard and rolled back. Automatic approval review then rejected temporary migration-owner elevation until the owner explicitly approved the prepared local maintenance transaction.

After that explicit approval, the two function-only migrations370/371 and their migration-ledger entries committed atomically under exact predecessor/absence checks and bounded lock/statement timeouts. The migration owner returned to its original non-superuser profile before commit. No application guard or provider callback was disabled. Postflight proves version371, ownership contract371, the merchant-support function present/restricted, `postgres.rolsuper=false`, non-superuser application roles and every event trigger enabled. No business rows were changed by this upgrade. Paired DOWN files preserve canonical support/audit evidence.

Normal user-browser verification then used the existing configured operator, Console magic proof and real TOTP: dashboard rendered, Support returned the honest empty local queue, and Settings showed a fresh reachable database check. No account, allowlist, role grant or factor was provisioned for that verification. Console9007, Gateway9010 and Identity9002 return200. The user browser is left signed in at Support. Private local screenshots and authentication artifacts remain under the task's private temporary directory; only synthetic UI screenshots and sanitized receipts are copied into repository evidence.

## Boundaries and next work

This delivery completes the highest-priority support, billing-investigation and dependency-evidence work and verifies existing protected job recovery. The research backlog's global record search, merchant attention inbox and unified timeline remain separate future work. Money investigation continues through existing ledger reconciliation; no arbitrary refund, charge, plan override, impersonation or runtime fleet was added. Native mobile/device acceptance, hosted/provider operation and parent programme acceptance remain unchanged.

The task began with198 changed/untracked files. Unrelated files were preserved; precise source fingerprints, intentional edits and test receipts are in the structured report and private task directory. No merge, push or hosted deployment occurred.

[Structured receipt](CONSOLE_OPERATIONS_2026-10-22.json) · [synthetic screenshots and sanitized runner/postflight evidence](../docs/evidence/console-operations-2026-10-22/).
