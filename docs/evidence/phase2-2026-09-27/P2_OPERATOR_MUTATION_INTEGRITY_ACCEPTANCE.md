# P2-OPERATOR-MUTATION-INTEGRITY — local acceptance

Date: 2026-10-03 (Asia/Kolkata). One implementation agent; no delegation.
Worktree: `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2`.
Branch: `letbuyy/phase2-shared-buyer-identity`.
Support behavior commit: `e8bb237506748d09a349556b6a4b3dd4c58737fe`.
Final source candidate: `88b173dea8d3bb719b6bce992e56c3a2cfb2f277` (test dependency/guard correction `2068400c`, then runtime inventory alignment).
Starting source: `eb49fe27`; the intervening `3b4e6ef7` records the owner's eleven-phase execution mandate.

The owner asked Codex to implement the whole eleven-phase programme directly using `$letbuyy`, and subsequently requested continuous follow-ups with updates on completed work packages. This is one bounded F2.6 outcome, not acceptance of all Phase 2 or of the complete product. No merge, push, deployment, hosted cutover, external message, live transaction or backup deletion was performed.

## Outcome

All seven support mutation endpoints now commit their business effects, mandatory audit records and durable retry response in one PostgreSQL transaction. A repeated logical action returns the original response; simultaneous duplicates create one set of effects. Changed payloads conflict. Every HTTP attempt passes current actor and action authorization before receipt replay. Failure at any mandatory write rolls back the effects and key claim together, allowing the same key to succeed after repair.

| Endpoint/action | Atomic effects and replay contract |
| --- | --- |
| Create ticket | Ticket, initial message, two SLA clocks, audit and response receipt |
| Reply / internal note | Existing migration-264 reply/status/SLA/audit transaction, optional required trust-safety linkage and response receipt |
| Assign | Ticket assignment/status, internal system note, audit and response receipt |
| Escalate | Ticket state and nested escalation metadata, incident/case linkage, case evidence/event when required, internal note, audit and response receipt |
| Resolve | Ticket state, SLA clocks, dry-run CSAT survey, internal note, audit, stable survey token and response receipt |
| Record satisfaction | Current survey score/comment, audit and response receipt |
| Create macro | Macro, audit and response receipt |

The O1 role matrix remains: active platform reviewers read only; operators use existing operator actions; leads use existing assignment/management actions; allowlisted super admins retain access. Store-scoped staff and a non-allowlisted platform admin do not acquire access. No frozen surface was activated.

## Implementation and integration

Migration `265_operator_support_mutation_integrity.sql` adds a support-domain receipt table and backend-only functions. Its paired rollback removes only those additions, preserving existing ticket data and migration 264's reply function. The receipt key is `(actor_id, operation, target, idempotency_key)`, with a SHA-256 fingerprint of the normalized JSONB payload. An insertion contending on that key waits; row locking then observes the completed committed response. An aborted transaction leaves no receipt claim.

The table enables and forces RLS. `PUBLIC`, `anon`, `authenticated` and `app_tenant` receive no table access or function execution. Only `service_role` receives the reviewed backend grants. The functions pin `search_path`. This is a narrow operator-support action boundary after live platform authorization; tests using the backend service role are not represented as buyer/tenant RLS proof.

The gateway route remains transport/validation/permission wiring. `SupportExecutionAdapter` supplies canonical SLA/keyword constants, invokes the function, validates stable keys, rejects conflicting standard/legacy headers and sanitizes database failures. Both `Idempotency-Key` and existing `X-Idempotency-Key` are accepted. Missing, malformed and oversized keys fail before effects. Normalized request defaults and JSONB key-order normalization make equivalent requests replay consistently.

The typed client requires an explicit `SupportMutationOptions.idempotencyKey` for these seven methods. Each real source caller in the frozen operations portal supplies the hidden key allocated once for its form; a repeated submission retains it and each attempt obtains fresh authentication. The portal passes TypeScript compilation; browser interaction or portal activation was not performed or claimed. Direct callers of these endpoints must likewise preserve the key for retries and allocate a new one for a genuinely new action.

Trust-safety case creation, evidence, event and ticket linkage share the parent transaction. Existing case links are reused instead of creating orphan cases for later actions. A required case/evidence failure now fails and rolls back the action, replacing the former best-effort partial success. The existing privacy uniqueness refusal for an automatic escalation remains an explicit `refused` outcome rather than erasing an otherwise valid reply. Privacy intake ownership, root fulfillment metadata and the rule that resolving a ticket does not complete privacy fulfillment remain intact. Direct support ticket creation cannot use the privacy topic.

There is no expiry/reclaim path that would turn an old committed key into a new action. The receipt contains a replay snapshot, including ticket fields; its privacy retention/redaction treatment belongs in the still-unapproved D05 policy and must be accounted for before export/deletion release. No retention schedule was invented here.

## Defects reproduced before the repair

Two real-worker/owned-database controls against the previous route implementation failed at their intended assertions: the same create key returned distinct ticket identities, and an injected audit insertion failure returned 201 rather than rolling back with 500. After restoring the new implementation both controls pass in the persisted suite. The first attempt at the duplicate assertion used the harness's wrong response property; it is excluded from defect evidence. The corrected assertions were rerun against the old source before counting the negative controls.

The owned suite now contains twelve tests, covering all seven actions, internal notes, mismatched payloads, JSON ordering, concurrent duplicates of every action, cross-actor separation, live permission revocation, invalid headers and keys, required case-evidence faults, and a receipt-completion fault after all action writes. Each fault verifies the relevant business/audit/receipt state, then repairs the fault and reuses the original key successfully once.

The lost-response test forwards a real RPC, discards its successful response at the gateway/PostgREST hop, then retries through a fresh gateway harness instance. It proves recovery of a committed response with fresh authentication, not a real production isolate restart or a browser login. SQL grants, rollback and reapplication are exercised against the disposable database. Two mock-router positive assignment tests were removed; the real-worker permission/action matrix replaces their synthetic success evidence.

## Verification

The runtime behavior and owned suite are unchanged since `e8bb2375`. The later source commits add the API client as a test-only dependency, recognize `__tests__` as a development source boundary while retaining runtime rejection, and align the runtime manifest's dependency inventory. Documentation is maintained separately. Counts overlap between lanes and are not summed into a fabricated total of unique assertions.

| Command / lane | Observed result | Scope and limits |
| --- | --- | --- |
| `node scripts/governance/run-executable-suites.mjs --gateway-db --jobs 1` | Exit 0; 13 suites; 87 pass, 0 fail/cancel/skip/TODO | Fresh migrated template including the final privacy-topic SQL guard; run `fdf173058b8e`, PostgreSQL 16 / PostgREST 16.2; cleanup failures and remaining owned containers/networks/volumes all empty |
| `pnpm --filter @letbuyy/api-gateway run test:unit` | Exit 0; 1325 tests, 1324 pass, 0 fail/cancel/skip, 1 existing TODO | `LB-BIL-002`: one payment activating two stores remains open; fast units are not database acceptance |
| `pnpm run test:contracts` | Exit 0; 322 pass, 0 fail/skip | Canonical command; a root plain-node invocation lacking workspace aliases was invalid and is not substituted for this result |
| `pnpm run typecheck` | Exit 0; 81/81 tasks | 80 cache hits and 1 fresh execution; not 81 fresh compiler runs |
| API-client TypeScript compile | Exit 0 | Explicit mandatory support key callers typecheck |
| `pnpm exec tsc --noEmit --incremental false -p apps/frozen/operations-portal/tsconfig.json` | Exit 0 | Fresh compiler invocation; no browser/activation claim |
| Workspace lint | Exit 0; 5/5 tasks | Cache hits; 0 errors, 19 existing identity warnings |
| Focused gateway source/contract checks | Exit 0; 14/14 | Source wiring and method contract checks |
| Focused gateway-lane/privacy-writer/table-reachability governance | Exit 0; 81/81 | Receipt SQL reachability and privacy-write rules remain non-vacuous |
| Tenant and migration safety/pairing validators; diff whitespace | Exit 0 | 284 tenant registrations retained; new receipt is platform-domain data, not a new tenant authority |
| Dependency governance after repair | Exit 0; 4/4 | A disposable mini-repository proves the declared dev dependency is accepted inside `__tests__` and refused in runtime source; package, import and runtime inventory validators pass |
| `pnpm install --frozen-lockfile --offline --ignore-scripts` | Exit 0 | Narrow workspace link added to the lockfile; no registry version changes or lifecycle scripts |
| `pnpm test --report /private/tmp/letbuyy-mutation-root-final.json` | Exit 0; 2610 tests, 2595 pass, 0 fail/cancel/TODO, 15 named HUMAN-REQUIRED skips | Fresh full wrapper: pure 1881/1896 with 15 skips; 59 PostgreSQL suites 305/305; 13 gateway database suites 87/87; contracts 322/322. The skip list is retained in the behavioral JSON; none is treated as live/provider acceptance |
| `node scripts/validate-governance.mjs --lane=gate` in disposable final-candidate clone | Exit 0; 114 PASS, 0 FAIL/BLOCKED/SKIP, 1 NOT_APPLICABLE | 115 discovered; the report-only validator is outside the gate. One declared branch advisory: local staging/main refs absent. The clone includes develop; no claim of remote/release lineage verification. Cleanup and package-bin executable mode changes occur only in this clone |

The earlier full database run also passed 87/87, but its template preceded the final SQL guard; the final `fdf173058b8e` run supersedes it. A governance/CI run was interrupted and has no terminal verdict; a machine-wide fixture-census assertion overlapped another owned runner's cleanup. It is not reported green. The full root wrapper runs those lifecycle checks serially before starting its own database groups. Its first pure-group run found the missing test dependency (one failure); this was fixed rather than excused. Clone gate attempts exposed the same missing declaration, absent clone compiler dependencies, then the runtime inventory omission; these are not green results. A frozen offline install supplied the clone dependencies. A broad lockfile regeneration attempt failed because unrelated registry metadata was unavailable offline; the precise workspace-link entry was added and then verified by the successful frozen offline install. Restored Supabase resources, signing assets, unrelated analyzer edits and unrelated local evidence are preserved.

Sanitized final runner evidence is retained alongside this document. Raw diagnostic logs remain in `/private/tmp/letbuyy-mutation-*`; they are optional diagnostics, not a durable acceptance dependency.

**Final verdict:** IMPLEMENTED, INTEGRATED AT THE GATEWAY/CLIENT CONTRACT, LOCAL VERIFIED. The canonical full behavioral command and all 114 required source validators passed. The final combined owned-database run `bb656ffecbee` executed 72 suites/392 tests with no skip/failure/cancellation/TODO; cleanup failures and remaining owned containers/networks/volumes are empty. Its summary is `P2_OPERATOR_MUTATION_INTEGRITY_FINAL_CLEANUP.json`. The behavioral report is `P2_OPERATOR_MUTATION_INTEGRITY_BEHAVIORAL_RUN.json`. Runtime/test source remained unchanged at `88b173de`; intervening `758edbc1` maintained documentation only. No independent review signature, active frozen-portal browser journey, hosted/provider verification, deployment or whole-Phase-2 closure is inferred.

## Remaining programme requirements and next work

F2.6 support mutation integrity is implemented and locally verified. Whole Phase 2 remains open: the two symmetric-session authority deviations; D03 authoritative cutover and sustained observation; D04 canonical operator provisioning/bootstrap/recovery/MFA/high-risk approval/delivery and moderation or impersonation callers; D05 requester verification, export protection/release, retention/deletion/legal hold/incident policy; and hosted delivery/release evidence. Q3's pre-existing synthetic rows in the restored development stack remain untouched.

Next dependency-ready work is the F2.1 customer-session issuer/consumer transition: refresh the actual signing/verification inventory, define dual-verification and telemetry/rollback retirement gates, then connect the existing canonical buyer issuer and storefront flows locally while preserving host scope, ownership proof and realm separation. The legacy map is a dated baseline: current Gateway session issuance is in password login and reset; its registration endpoint now returns 410 to direct account creation to canonical Buyer Identity. Include the Gateway's 30-minute envelope alongside Commerce's seven-day legacy envelope and the current canonical buyer/storefront sessions. Hosted cutover and real legacy-data retirement require their own authorization and evidence.

The eleven-phase goal stays active. Heartbeat `letbuyy-continuous-engineering` resumes this same chat hourly when available, reuses live processes instead of duplicating them, reports meaningful completed packages or owner decisions, and pauses on verified full-goal completion. This is a recurring follow-up, not a guarantee of execution while the Mac/Codex host is unavailable.
