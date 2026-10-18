# P2-OPERATOR-QUEUE-CORRECTNESS — the operator support queue: validation, privacy filtering and reply consistency, through the production worker and an owned database

Branch `letbuyy/phase2-shared-buyer-identity` (unpushed, unmerged, not deployed). Date 2026-10-02.
Initial HEAD `5f3341bfe4d31528e37752dfab3b159d510f3bfd`. Source commits `c7ad3b679e5bc7d4f7b33884272cb5f689f42470` (the implementation and its tests) and `16568c547e71554808d09e91e0d193e1c1053c4a` (a test-only fix found while writing this record, §9); the documents-only commit that follows carries this file and the dated notes, and is the branch tip (a file cannot name its own commit: `git rev-parse HEAD`, and the task's final report). §9 says which number was measured on which commit.

Execution mode: **SINGLE AGENT** · Subagents invoked: **NO** · Agent/Task delegation: **NO** · Background agents: **NO** · Parallel worktree agents: **NO** · Workflow orchestration: **NO**. (The root suite was waited on as a background *shell command*; it is a process, not an agent.)

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE).** The owner decided O1 the same day, and it is implemented: `P2_OPERATOR_QUEUE_GATE_ACCEPTANCE.md`. The access boundary below is the one before that decision; dated notes at §3, §9, §14 and §16 say what changed.

## 0. Verdict

**A — THE OPERATOR QUEUE'S VALIDATION, PRIVACY FILTERING AND REPLY CONSISTENCY ARE REPAIRED, AND PROVEN THROUGH THE PRODUCTION WORKER AGAINST AN OWNED DATABASE.** Limited to this mandate: it does not say anything about the rest of Phase 2.

* **Reply write boundary.** An operator's reply is now one database transaction (migration 264, `reply_to_support_ticket`): the message, the ticket's status and response times, the SLA clock bookkeeping and the audit row are written together under a row lock, or not at all. A reply the privacy rule refuses (reopening a closed privacy request while a newer one of the same type is unresolved, migration 262) is a **409 with nothing written**; before, the route answered **200**, kept the message and wrote an audit row saying the reply happened (§6: six refused replies left six messages and six audit rows; a refused escalation left an orphan Trust & Safety case). A ticket that is gone, before or *during* the reply, is a 404 with nothing written; before, a ticket removed mid-flight was written to.
* **Topic contracts.** The queue is filtered with a new `SupportTicketQueueTopicSchema` (privacy included); tickets and macros are still created with `SupportTicketTopicSchema` (privacy excluded). An operator can now find every privacy request, with exact rows and totals, and still cannot create one.
* **Validation.** Every support route validates its id, query and body with the gateway's `validate()` middleware **after** its permission check: 32 kinds of malformed input that were `500 INTERNAL_ERROR` / `DB_ERROR` are now sanitized `400`s that write nothing (§8).
* **Access boundary unchanged.** Through the production mount only an allowlisted super admin reaches `/v1/operations/support` (§3). The D04 viewer/operator/lead tiers stay implemented and dormant; the decision to open them (O1) is the owner's and is still open (§14). No mount was reordered and no gate narrowed.

Every claim above was reproduced first: the new suite's 17 tests all failed on the unchanged source for the defect each names (§6), and pass on `16568c54`. Ten faithful negative controls each turn the tests red for the intended reason; one control as first written was ineffective, is recorded as such, and was corrected (§10).

## 1. State

| | |
|---|---|
| Machine, checkout | `Saai-Mithras-MacBook-Pro.local`, `/Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy-phase2` |
| Branch | `letbuyy/phase2-shared-buyer-identity` |
| Initial HEAD | `5f3341bfe4d31528e37752dfab3b159d510f3bfd` |
| Worktrees at start | `LetBuyy` (`develop`, `130b669d`), `LetBuyy-agrimate-cleanup`, `LetBuyy-phase1r`, `LetBuyy-phase2` — none touched but this one |
| Source commits | `c7ad3b679e5bc7d4f7b33884272cb5f689f42470` — the implementation and every test that pinned the old behaviour, in one commit; `16568c547e71554808d09e91e0d193e1c1053c4a` — test only: two malformed-input cases shared a name, so one was not asserted (§9) |
| Documents-only commit | this file and the dated notes (§15) |
| Pre-existing dirty paths, preserved and never staged | nine `analysis_options.yaml` modifications (`apps/deferred/delivery/mobile`, `apps/merchant/mobile`, `packages/dart/{core,marketplace_core,marketplace_models,marketplace_services,marketplace_ui_kit,models,ui_kit}`); `apps/deferred/delivery/mobile/ios/Flutter/ephemeral/.swift_pm.lock` and `.../Packages/`; `docs/evidence/local-environment-2026-09-28/` — the same twelve before and after |
| Staging | explicit paths only; every staged diff reviewed before commit |

## 2. What changed

| File | What |
|---|---|
| `database/supabase/migrations/264_support_ticket_reply_atomic.sql` | New: `reply_to_support_ticket` — the reply as one transaction (§5) |
| `database/supabase/rollback/264_support_ticket_reply_atomic.rollback.sql` | New: drops the function, nothing else |
| `services/api-gateway/src/routes/operations/support.ts` | The reply calls the function; `validate()` on every route after its permission check; queue filter on the queue topic list; search text quoted; assign/escalate/resolve map refusals to 409/404; escalate changes the ticket before it opens a case; the Trust & Safety follow-on claims before it opens a case and reports its outcome |
| `packages/shared-types/src/index.ts` | New `SupportTicketQueueTopicSchema` / `SupportTicketQueueTopic` |
| `packages/typescript/api-client/src/index.ts` | Queue tickets and the queue filter use the queue topic; reply result type (`message`, `ticket`, `linked_ts_case_id`, `trust_safety_escalation`); `trust_safety_escalation` on ticket results. Creation inputs unchanged |
| `services/api-gateway/src/__tests__/owned-db/operator-queue-correctness.postgres.test.ts` | New owned-lane suite, 17 tests (§9) |
| `services/api-gateway/src/__tests__/owned-db/privacy-support-visibility.postgres.test.ts` | Updated where it pinned the broken behaviour: the privacy filter (was "refused"), the refused reopen (status was not asserted), privacy creation (now exactly `400 VALIDATION_ERROR`); two router-level assertions that a viewer's malformed request is refused for who they are, not validated |
| `services/api-gateway/src/__tests__/support-topic-contracts.test.ts` | New unit drift check: queue topics = creation topics + privacy = `support_tickets.topic` CHECK (261); creation topics = `ticket_macros.topic` CHECK (127) |
| `services/api-gateway/src/__tests__/operations-support-tier-wiring.test.ts` | Fixture ticket id `ticket-a-1111…` (not a uuid, now a 400) → a real uuid |
| `services/api-gateway/src/__tests__/internal-os-support.test.ts` | Source pin of the reply audit action moved to where it now lives (migration 264) |
| `services/api-gateway/src/__tests__/operator-scoped-admin-client-contract.test.ts` | The allowlist's description of the reply and escalate call sites updated to what they now do (route registrations unchanged) |
| `tests/governance/gateway-db-lane.test.mjs` | The lane holds twelve suites; the new suite is held to the harness-only-seam rule |
| `tests/governance/privacy-fulfillment-writers.test.mjs` | The support-ticket writer tripwire now covers SQL: 264 is the only migration that writes `support_tickets`, and its one update sets `status, first_response_at, last_agent_message_at, updated_by` — never metadata or topic |
| `services/api-gateway/AGENTS.md` | One clause naming the new reference suite |

Not changed: `index.ts` (mount order), `incident-command.ts` (the ops gate), `rbac.ts` (tiers, provisioning, MFA), the buyer privacy routes, migrations 261/262, any hosted flag or database.

## 3. The effective production access policy (measured, not inferred)

Through the real worker, real signed identities and real `employees` / `super_admin_allowlist` rows (test A here; the tier and realm tests of `privacy-support-visibility`):

| Caller | Every route under `/v1/operations/support` | What it can read | Answer, before any validation |
|---|---|---|---|
| Allowlisted super admin (`super_admin_allowlist.is_active`) | **reaches** | the whole queue including privacy requests (`?topic=privacy`), the buyer's own note, internal notes; can reply, assign, escalate, resolve, create (non-privacy) | — |
| Platform employee, viewer tier (`viewer`, `store_id` NULL, active) | refused | nothing | `403 FORBIDDEN`, `Insufficient role category. Required: ops` |
| Platform employee, operator tier (`support`) | refused | nothing | same |
| Platform employee, lead tier (`manager`) | refused | nothing | same |
| Store employee (`admin`, `support`), store owner | refused | nothing | same |
| Invited, disabled or soft-deleted platform employee; a user with no employee row | refused | nothing | same |
| Buyer session; the super admin's own id under a forged staff signature; no credential | refused | nothing | `401` |

Each refused caller sent valid **and** malformed requests (an unknown topic with `limit=0`, a malformed id, a body that is not JSON, a privacy-ticket creation): every one got the gate's answer, so authorization runs before validation, and the `audit_logs` count (a successful read writes a sensitive-read row) shows nothing was read. Each refusal is paired with the same seven requests from the super admin (200 / 400 as each deserves). The router's own tiers (viewer reads, agent acts, only a lead assigns) remain proven with the router **mounted alone**, which is not production; this task added that a viewer's malformed request is refused there with `PERMISSION_SCOPE_DENIED`, not validated.

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE).** The table above is the boundary before the owner's O1 decision. Measured through the production worker since then:
>
> - Active platform reviewers, operators and leads reach the queue. The reviewer only reads, the operator cannot assign or create macros, and the lead and super admin can do everything.
> - A platform `admin`-role employee not on the allowlist gets `403 Platform operator tier not admitted`.
> - Every other refused caller above stays refused. Each store or inactive caller now gets the support gate's own `Platform operator access required` instead of the ops gate's message.
>
> See `P2_OPERATOR_QUEUE_GATE_ACCEPTANCE.md` §5.

## 4. Two topic contracts: filter and create

| | Schema | Values | Used by |
|---|---|---|---|
| Queue (filter) | `SupportTicketQueueTopicSchema` | the nine creation topics **+ `privacy`** = `support_tickets.topic` CHECK since 261 | `GET /tickets?topic=` |
| Creation | `SupportTicketTopicSchema` | nine topics, **no** `privacy` = `ticket_macros.topic` CHECK (127) | `POST /tickets`, `POST /macros` |

Deliberately two schemas, not one widened enum: widening the shared enum would also have let an operator *create* a privacy ticket with arbitrary metadata (NC2 shows the suites catch exactly that). `support-topic-contracts.test.ts` pins both lists to their CHECK constraints so they cannot drift apart. The only consumer outside the gateway is the frozen operations portal, which compiles unchanged (`tsc --noEmit`, 0 errors).

## 5. The reply's write boundary

**Design.** `routes/operations/support.ts` owns transport, validation and the response; the sequencing lives in the database function, which is the transaction:

1. lock the **live** ticket (`deleted_at IS NULL`) `FOR UPDATE`; none → `P0002 support ticket not found` → **404**;
2. the new status: the caller's, or the reply's default (public → `pending_customer`; internal note → unchanged) — the route's previous rule;
3. update the ticket (`status`, `first_response_at` set once by a public reply and never moved, `last_agent_message_at`, `updated_by`); a unique violation of `support_tickets_privacy_open_request_uidx` is re-raised as `23505 support_ticket_privacy_request_conflict`, without the key values → **409**;
4. insert the agent's message; 5. the SLA bookkeeping (first-response clock satisfied; an unsatisfied resolution clock paused while waiting on the customer); 6. the audit row (`support.ticket.reply` or `support.ticket.internal_note`, with `status`, `previous_status`, `message_id`, `reason`).

Times are `clock_timestamp()` taken after the lock, so replies that queue on one ticket are stamped in commit order (F1 proves the first response is the first committed reply; with `now()` a later-committing transaction could carry an earlier time).

**Why a database function and not an execution adapter.** A PostgREST request is one transaction; separate calls cannot be made atomic without faking it. The established operator precedent is the route calling a transition function directly (`transition_channel_listing`, `operations/marketplace-listings.ts`), and the shared foundation contracts have no workflow owner for support; adding one for a single bridge would be a wider contract change than this mandate.

**Effects, classified.**

| Effect | Class | On failure |
|---|---|---|
| Message, ticket status and times | mandatory, in the transaction | nothing is written; 409 / 404 / sanitized 500 |
| SLA clock updates | mandatory, in the transaction | same (E1b) |
| Audit row of the reply | mandatory, in the transaction — never written for a reply that did not happen | same (E1a) |
| Trust & Safety follow-on (a reply mentioning fraud, chargeback…) | **best-effort, after commit**, never undoes the reply | reported in `trust_safety_escalation` |
| Its system note and its `support.ticket.escalate` audit row (`trigger: 'keyword'`) | written only when the case is linked | not written |

**The follow-on, honest.** It claims the ticket first (escalated / `trust_safety`, only if live, unlinked and not already escalated there — one claim per ticket), then opens the case and links it. Outcomes: `not_triggered`; `already_escalated`; `refused` (`privacy_request_conflict` — no case is opened for an escalation that did not happen); `linked` (`ts_case_id`); `failed` with `stage` `claim` / `case` / `link`. If the case cannot be opened after a successful claim, the ticket stays escalated to Trust & Safety **without** a case and the answer says `failed: case` (E3b); the explicit escalate route can open one. The explicit escalate route now also changes the ticket first and opens its case second, so a refused escalation leaves no orphan case.

## 6. Before and after (the reproduction)

The suite was written first and run on the unchanged source (initial HEAD plus the new test file only; runner run `8db1201b8956`): **17 of 17 failed**, each for its defect. Same suite on `c7ad3b67` and on `16568c54`: 17 of 17 pass.

| Test | Before (unchanged source) | After |
|---|---|---|
| A — super admin's positive controls | `?topic=privacy`, an unknown filter, a malformed id, a non-JSON body, privacy creation: **500 INTERNAL_ERROR** each (refusals of every other caller already held) | 200 / 400 VALIDATION_ERROR / 400 / 400 INVALID_INPUT / 400 |
| B1 — privacy filter, totals, search | `?topic=privacy` → 500 | exact rows, totals, pages, combined filters; grammar characters searched as text |
| B2 — 32 malformed inputs | 31 recorded: 28 × `500 INTERNAL_ERROR`, 3 × `500 DB_ERROR`. The 32nd (`?assignee_id=someone`) shared its name with another case in that run and was not recorded (§9); it goes through the same `ListTicketsQuerySchema.parse` as the other list cases | 400 each, nothing written |
| B3 — privacy ticket / macro creation | 500, 500 | 400, 400; nothing written |
| C — a successful reply | response had no `ticket` or `trust_safety_escalation`; `last_agent_message_at` came from the worker's clock, not the message's | message, state, clocks, audit agree to the microsecond |
| D — refused reopen | six refused replies **answered 200**, left **6 messages and 6 audit rows**; assign / escalate → 500; escalate to Trust & Safety → 500 **and an orphan case** | 409 each; nothing written; the closed request stays closed |
| E1a — audit row fails | 200; message, status and clocks written, **no audit row** | 500 DB_ERROR; nothing written; retry is the one reply |
| E1b — clock update fails | 200; message, status and audit written, clocks not | 500; nothing written |
| E2a — ticket gone | assign → 500 DB_ERROR (removed and never-existed ids) | 404 everywhere |
| E2b — ticket removed mid-reply | **200**; message, status, clocks and audit written to the removed ticket | 404; nothing written |
| E3a — follow-on refused | 200 claiming `linked_ts_case_id` = a new case, while the ticket stayed resolved and **unlinked**; case and "escalated" note written | `refused`; no case; note kept |
| E3b — case store fails | no outcome field: the ticket was simply not escalated, and nothing said why | `failed: case`, reported |
| E3c — follow-on linked | no outcome field | `linked`; one case; note; escalation audit |
| F1 — two answers at once | `first_response_at` = the later writer's worker clock | the first committed reply's time |
| F2 — two reopenings at once | **both 200**; the loser kept its message and audit row | one 200, one 409 that wrote nothing |
| F3 — two fraud reports at once | **two cases** for one ticket | one case, linked once |
| Grants and rollback | function absent | as §11 |

## 7. Error and retry behaviour

| Condition | Answer | Written |
|---|---|---|
| Malformed id / query / body | `400 VALIDATION_ERROR` (zod issues: field, message, code), or `400 INVALID_INPUT` for a body that is not JSON | nothing |
| Unknown macro or assignee (`23503`) | `400 VALIDATION_ERROR` "The request refers to a record that does not exist" | nothing |
| Ticket gone (`P0002`, `PGRST116`) | `404 NOT_FOUND` "Support ticket not found" | nothing |
| Privacy rule refuses the status change | `409 CONFLICT` "…its requester already has an unresolved privacy request of the same type." | nothing |
| Any other database failure | `500 DB_ERROR`, public message "Database operation failed" | nothing (reply); the status routes' best-effort note and audit only follow a successful update |

No answer carries SQL, a constraint or index name, key values, a stack frame or the injected fault's text (`assertSanitized` on every failure in the suite). **Retries:** a failed reply leaves nothing, so retrying it creates exactly one reply (E1a/E1b), and retrying a refused one adds nothing however often (D: three identical attempts). A *successful* reply sent twice is two replies: the operator routes have no idempotency key (the gateway's idempotency middleware covers store-scoped merchant prefixes only) — a pre-existing gap, listed in §14.

## 8. Validation

On every route, after its permission check: ticket ids must be uuids (detail, reply, assign, escalate, resolve, satisfaction); the list's `topic`, `status`, `priority`, `page`, `limit` (1–100, the operator-client allowlist's pinned cap), `assignee_id`, `site_id` and `q` (≤ 160) are typed; every body is parsed as JSON and validated (reason length, enums, uuids, record and array shapes). Search text is passed as one quoted PostgREST operand: `,` `.` `:` `(` `)` `"` and `\` are matched as text (with the quoting removed, NC7, `'(urgent), order #12: "late"'` was misparsed and found nothing); `%` and `_` keep their wildcard meaning. A NUL in the search text was answered normally (200) by the unchanged source, so no rule was added for it (it is not re-measured here).

## 9. Verification

| Check | Commit | Result |
|---|---|---|
| `operator-queue-correctness.postgres` + `privacy-support-visibility.postgres`, two consecutive runs | `c7ad3b67` | 23/23 and 23/23 (runs `4376a91469d2`, `8f0dcfe34183`) |
| The same, two consecutive runs | `16568c54` | 23/23 and 23/23 (runs `bf51b8b66385`, `0be9a16cc3ff`) |
| Full gateway owned-DB lane (twelve suites) | `c7ad3b67`, `16568c54` | 71/71 and 71/71 (runs `cbddf39e5c13`, `8afc5e3d5a6f`) |
| Gateway unit lane | `c7ad3b67` | 1325 tests: 1324 pass, 0 fail, 0 skipped, **1 TODO** (LB-BIL-002, pre-existing) |
| Gateway `test` script's contract step | `c7ad3b67` | 313 tests: 312 pass, **1 fail** — `tests/contracts/storefront-buyer-auth.test.ts` crashes on import (`createMiddleware is not a function`) when run from `services/api-gateway`; **pre-existing**: identical at the base commit in a clean clone, and 10/10 from the repository root (where the root suite runs it). Not caused by this change; listed in §14 |
| Monorepo typecheck | `c7ad3b67`, `16568c54` | 81/81 each (the second with 80 of 81 from cache) |
| Lint | `c7ad3b67` | 5/5 tasks, 0 errors (the gateway has no lint task) |
| Root `pnpm run test` | `c7ad3b67` | 2590 tests: 2575 pass, 0 fail, 15 `[HUMAN-REQUIRED]` skips, 0 TODO (pure + live 177 suites / 1892; postgres owned clusters 59 / 305; gateway database 12 / 71; contracts 322). Against the previous task's 2571: +17 is the new suite; +2 in the pure group are the new SQL tripwire test and the existing money-RPC reachability sweep, which found `reply_to_support_ticket` and its caller |
| Root `pnpm run test` | `16568c54` | 2590 tests: 2575 pass, 0 fail, 15 `[HUMAN-REQUIRED]` skips, 0 TODO (pure + live 177 suites / 1892; postgres owned clusters 59 / 305; gateway database 12 / 71; contracts 322) |
| Governance gate (fresh disposable clone, `--lane=gate`) | `c7ad3b67` | `PASS=114 FAIL=0` (115 discovered, 1 not applicable), in a fresh `git clone --local` with `pnpm install --frozen-lockfile`. The install set the executable bit of `packages/theme-engine/src/theme-cli.ts` (mode only): the clone's one difference from the commit |
| Frozen operations portal (`tsc --noEmit`) | the client types of `c7ad3b67` | 0 errors |

**The test defect `16568c54` fixes.** While this record was being written, the reproduction log of B2 showed 31 outcomes for 32 cases: the list filter's `?assignee_id=someone` and the assign body's non-uuid assignee were both named "an assignee that is not an id", and B2 keys its results by name, so the second overwrote the first and the list case's status was never asserted. The body case is renamed, A and B2 now assert their case names are unique, and NC10 (§10) proves the list case is now checked: with the uuid check removed it answers `500 DB_ERROR`, and B2 goes red on exactly that case. No source changed.

The suite's tests: A (access boundary), B1 (privacy filter, totals, pagination, ordinary filters, search), B2 (32 malformed inputs), B3 (creation contracts), C (successful reply: message, state, clocks, audit, attribution, public vs internal, what the buyer reads, no fulfillment invented), D (refused transition, retries, status routes, positive controls), E1a/E1b (named in-transaction faults), E2a/E2b (gone, gone in flight), E3a/E3b/E3c (follow-on outcomes), F1/F2/F3 (concurrency), and the function's grants, definer, search path and rollback.

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE).** The contract step's failure in the table above is repaired.
>
> - **Cause:** `services/api-gateway/tsconfig.json` maps `hono/factory` to a declaration file, and tsx applies that tsconfig at runtime when run from the package directory.
> - **Repair:** the package script now runs the root's contracts command from the repository root.
> - **Result:** `pnpm --filter @letbuyy/api-gateway run test` is green end to end.
>
> See `P2_OPERATOR_QUEUE_GATE_ACCEPTANCE.md` §3.

## 10. Negative controls

One temporary edit each (every edit matched exactly once), the two suites run through the runner, the file restored byte for byte and verified by sha256; after NC1–NC9 every changed file was identical to its pre-control hash, and after NC10 `support.ts` was identical to the commit. NC1–NC9 ran on `c7ad3b67`'s content, NC10 on `16568c54`.

| | Edit | Red | Failure reason (as asserted) |
|---|---|---|---|
| NC1 | the queue filter back on the creation list (`support.ts`) | A, B1; visibility "super admin reaches…" | `?topic=privacy` → `400 VALIDATION_ERROR` instead of 200 |
| NC2 | creation accepts privacy (`support.ts`) | A, B3, C; visibility lifecycle | the operator's privacy ticket created (`201`); C's "no privacy ticket carries an outcome" found one; in the lifecycle test the create reached the database and failed on the privacy index (`500` instead of `400`) |
| NC3 v1 | `RAISE EXCEPTION …conflict` → `NULL` (`264`) | **none — ineffective control** | the bare `RAISE;` after the `IF` still re-raised the violation, and the route maps the raw index violation to 409 too; the edit changed nothing observable |
| NC3 | the whole conflict handler swallowed (`264`) | D, F2; visibility lifecycle | refused reopenings answered 200 and kept their message and audit row |
| NC4 | the audit insert made best-effort (`264`) | E1a | the reply committed without its audit row |
| NC5 | support router mounted before the incident-command gate (`index.ts`) | A; visibility production-mount test | a platform viewer read the privacy queue (`200`) |
| NC6 | the reply route validates before its permission check (`support.ts`) | visibility router-level test; **guard:** the operator-client contract unit test | a viewer's non-JSON reply got `400 INVALID_INPUT` instead of `403`; the guard failed separately because the documented route registration changed |
| NC7 | search text interpolated unquoted (`support.ts`) | B1 | `q='(urgent), order #12: "late"'` found nothing |
| NC8 | the lock no longer requires a live ticket (`264`) | E2a, E2b | a removed ticket was replied to (200) |
| NC9 | the follow-on opens the case before the claim (`support.ts`) | E3a, E3c, F3 | an orphan case on a refused claim; a second case; three cases from two concurrent reports |
| NC10 | the list filter's `assignee_id` accepts any string (`support.ts`; run at `16568c54`) | B2 | `?assignee_id=someone` answered `500 DB_ERROR` instead of `400` — the case that was not asserted before `16568c54` |

The exact edits are in Appendix A.

## 11. Migration 264 and its rollback

Numbering: next after 263; paired rollback `database/supabase/rollback/264_support_ticket_reply_atomic.rollback.sql` (header and `BEGIN`/`COMMIT` as 258–260). Function: `SECURITY DEFINER`, `SET search_path = public, pg_catalog`, argument checks (`22023`) as defence in depth behind the route's validation. Privilege: `REVOKE ALL … FROM PUBLIC, anon, authenticated, app_tenant`, `GRANT EXECUTE … TO service_role` — the definer ratchet (`definer-function-api-roles.test.mjs`) passes. Proven in the owned database (last test of the suite): `has_function_privilege` true for `service_role` only; no `PUBLIC` grant; `anon`, `authenticated` and `app_tenant` get `permission denied for function reply_to_support_ticket` on a direct call; `service_role` reaches it and is refused an unknown ticket by name; `prosecdef` true; `proconfig` = `search_path=public, pg_catalog`; one overload. The rollback removes the function and leaves the privacy index; re-applying the migration twice restores exactly the same facts. Applied only in this suite's throwaway databases — never to the restored stack or a hosted database. Rollback order: the route calls the function, so a rollback of 264 must ship with the route's rollback. (Migrations 261 and 262 still have no rollback file — pre-existing, unchanged.)

## 12. Cleanup and resource ownership; the restored stack

**Resources this task created, and what is left of them.** Every Docker resource this task created belonged to a run of `scripts/governance/run-executable-suites.mjs` (labelled `com.letbuyy.executable-fixture` with the run id; names `letbuyy-exec-…`): each suite's cluster, REST sidecar, network and volume, removed by the runner when its run ended. The 19 runner reports this task kept (the reproduction runs, the iterations, the negative controls and the final runs) each record zero remaining containers, networks and volumes and no cleanup failure, and both root suites' runners passed their own lifecycle checks. After the last run: **0 labelled containers, 0 labelled networks, 0 labelled volumes, no `letbuyy-exec-*` container, and no runner, `tsx`, `test-behavioral` or control-driver process.** Volumes: 397 dangling, as in the previous task's census; the in-use volumes that are new since then belong to `edynox-journeys-db` and `edynox-journeys-minio`, started at 03:07Z and 03:09Z by something other than this task (EDYNOX resources: preserved, not touched). No `prune` of any kind was run and nothing this task did not create was removed. The temporary fault triggers of E1a/E1b were created and dropped inside that suite's own throwaway database. The disposable clone and every scratch file (the control driver, its byte backups and logs, the reproduction logs) live in the session scratchpad, outside the repository; the clone is removed by its exact path after the last gate run.

**The restored development stack was not written to.** No gateway test can name it (refused by name, label and image before any statement), and the only command this task sent to it is the previous task's read-only census (`PGOPTIONS='-c default_transaction_read_only=on'`; row counts, newest-row times and cumulative per-table write counters, never contents), taken at 2026-10-02T03:26:23Z (after the first root suite) and again at 2026-10-02T03:58:44Z (after the last Docker-backed run of this task): **both identical, capture time aside, to the last capture of 2026-10-01.** Its synthetic rows (Q3) were not touched; no runtime was brought up or restarted; no device journey was repeated.

## 13. Verification identities

Tested source: `c7ad3b679e5bc7d4f7b33884272cb5f689f42470` (the first two consecutive runs, the gateway `test` script, typecheck, lint, the first root suite, the governance gate, NC1–NC9) and `16568c547e71554808d09e91e0d193e1c1053c4a`, the final source (the second two consecutive runs, the full owned lane, the second root suite, NC10; it differs from `c7ad3b67` in one test file). Final documents: the commit that adds this file (`git rev-parse HEAD`; it changes documents only; the gate is run on it as well, and that result is in the task's final report).

## 14. Remaining blockers, observations and owner decisions

* **O1 (owner decision, still open): who may reach the operator queue — and so read a buyer's privacy request.** Today: the super-admin allowlist only. The choice is between *retaining super-admin-only access*, or *enabling selected platform tiers* — and if so, deciding explicitly who may read a buyer's privacy notes (the buyer-authored message on the request) and the internal notes, which the router's tiers would otherwise show to every viewer. Nothing here implements either; the production-mount tests fail if the gate or the mount order changes (NC5), so an opening cannot happen unnoticed.
* **Operator mutations have no idempotency key**: a retried *successful* reply (or assign, escalate, resolve, create) is applied twice. Failed attempts leave nothing (proven); duplicates of successful ones are a pre-existing gap of the whole operator surface.
* **Assign, escalate, resolve, satisfaction and create keep best-effort notes and audit rows** written after their (single, now checked) update; only the reply was made one transaction. The same function pattern would carry them.
* **The explicit escalate route still merges the ticket's metadata read-modify-write** (a concurrent writer's change can be lost) — pre-existing, unchanged; for a privacy request that metadata holds only the request type, which no supported writer changes.
* **A failed case creation after a successful claim** leaves the ticket escalated to Trust & Safety without a case, reported as `failed: case` (E3b).
* **The gateway `test` script's contract step fails one file from the package directory** (§9) — pre-existing module resolution, unrelated to this change; the root suite runs the file green.
* Unchanged and out of scope: Q3 (synthetic rows in the restored stack), D03 cutover, D04.2–D04.9, D05 (export, erasure, retention, legal hold — no fulfillment writer exists, and the SQL tripwire now guards that too), hosted delivery.

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE).** Status of the items above:
>
> - **O1:** decided by the owner and implemented, `P2_OPERATOR_QUEUE_GATE_ACCEPTANCE.md`.
> - **The contract-step failure:** repaired.
> - **Still open:** the missing idempotency key and the best-effort writes of assign, escalate, resolve, satisfaction and create, along with the other items listed.

## 15. The requirement matrix and the dated notes

* `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md`: a header note and a new F2.6 row for the operator queue's correctness; the tiers row keeps its "not reachable through the production mount" correction.
* `P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md`: dated notes on O2 and O3 (repaired here) and on §17 (the honesty fixes it listed are done; the O1 decision is not).
* `PHASE2_DECISIONS.md`: a dated note under D04: the queue's correctness is repaired; who may reach it is still the open question.

The original text stays where it is, as the record of its moment.

## 16. Precise next task

**P2-OPERATOR-QUEUE-GATE — the owner answers O1, then the wiring says so.** *Retain:* record "implemented, dormant" for the tiers as the decision, not a gap, and stop there. *Enable:* first decide which tiers may read a buyer's privacy note and the internal notes (a viewer can today, mounted alone); then narrow the incident-command gate to the routes that need `ops` + super admin, or mount the support router outside it, and change the production-mount tests of `operator-queue-correctness` (A) and `privacy-support-visibility` in the same commit. Either way these two suites are the acceptance. Q3 stays its own task.

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-GATE-AND-ACCEPTANCE).** The next task ran under that name with the owner's answer: open the queue to the tiers.
>
> - The incident-command gate was **not** narrowed. Four routers under `/operations` have no gate of their own and rely on it.
> - Instead, the support router was mounted before the gate.
> - The production-mount tests of both suites changed in the same commit.
>
> See `P2_OPERATOR_QUEUE_GATE_ACCEPTANCE.md` §4.

## Appendix A — the exact edits of the negative controls

Each control replaced every `search` below with its `replace` in `file` (each `search` matched exactly once), ran `operator-queue-correctness` and `privacy-support-visibility` through the runner (and, for NC6, the named unit test with `tsx --test`), then restored the file from a byte copy and compared sha256. NC3 v1 is listed first: it is the ineffective first version of NC3.

**NC3 v1 (ineffective)** — `database/supabase/migrations/264_support_ticket_reply_atomic.sql`

search:
```
      RAISE EXCEPTION 'support_ticket_privacy_request_conflict' USING ERRCODE = '23505';
```
replace:
```
      NULL; -- negative control: the refusal is swallowed
```

**NC1** — `services/api-gateway/src/routes/operations/support.ts`. the queue filter goes back to the creation topic list (the old shared-enum behaviour): topic=privacy is refused.

search:
```
    topic: SupportTicketQueueTopicSchema.optional(),
```
replace:
```
    topic: SupportTicketTopicSchema.optional(),
```

**NC2** — `services/api-gateway/src/routes/operations/support.ts`. generic ticket creation accepts the privacy topic (the creation contract widened to the queue list).

search:
```
    channel: SupportTicketChannelSchema.default('in_app'),
    topic: SupportTicketTopicSchema.default('general'),
```
replace:
```
    channel: SupportTicketChannelSchema.default('in_app'),
    topic: SupportTicketQueueTopicSchema.default('general'),
```

**NC3** — `database/supabase/migrations/264_support_ticket_reply_atomic.sql`. partial persistence: the reply function swallows the privacy refusal and carries on, so the message and audit row are kept and the reply reads as success.

search:
```
    GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
    IF v_constraint = 'support_tickets_privacy_open_request_uidx' THEN
      RAISE EXCEPTION 'support_ticket_privacy_request_conflict' USING ERRCODE = '23505';
    END IF;
    RAISE;
```
replace:
```
    NULL; -- negative control: the refusal is swallowed and the reply carries on
```

**NC4** — `database/supabase/migrations/264_support_ticket_reply_atomic.sql`. the audit row becomes best-effort inside the reply function (a failed audit write is ignored).

edit 1, search:
```
  INSERT INTO public.audit_logs (actor_id, actor_type, actor_email, action, resource_type, resource_id, metadata, created_at)
```
replace:
```
  BEGIN
  INSERT INTO public.audit_logs (actor_id, actor_type, actor_email, action, resource_type, resource_id, metadata, created_at)
```
edit 2, search:
```
    v_now
  );

  RETURN jsonb_build_object
```
replace:
```
    v_now
  );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object
```

**NC5** — `services/api-gateway/src/index.ts`. the access boundary is weakened: the support router is mounted before the incident-command router, so its ops gate no longer applies.

search:
```
api.route('/operations', operationsIncidentCommandRouter);
api.route('/operations/risk', operationsRiskRouter);
api.route('/operations/support', operationsSupportRouter);
```
replace:
```
api.route('/operations/support', operationsSupportRouter);
api.route('/operations', operationsIncidentCommandRouter);
api.route('/operations/risk', operationsRiskRouter);
```

**NC6** — `services/api-gateway/src/routes/operations/support.ts` (also: `services/api-gateway/src/__tests__/operator-scoped-admin-client-contract.test.ts`). the reply route validates before it checks the permission (validation ahead of authorization).

search:
```
router.post('/tickets/:id/messages', requirePermission('support:reply'), validate('param', TicketParamSchema), validate('json', MessageSchema), async (c) => {
```
replace:
```
router.post('/tickets/:id/messages', validate('param', TicketParamSchema), validate('json', MessageSchema), requirePermission('support:reply'), async (c) => {
```

**NC7** — `services/api-gateway/src/routes/operations/support.ts`. the search text is interpolated into the or=(...) filter unquoted again (the old search behaviour).

search:
```
        const term = ilikeOperand(query.q);
        request = request.or(`subject.ilike.${term},requester_email.ilike.${term},ticket_ref.ilike.${term}`);
```
replace:
```
        request = request.or(`subject.ilike.%${query.q}%,requester_email.ilike.%${query.q}%,ticket_ref.ilike.%${query.q}%`);
```

**NC8** — `database/supabase/migrations/264_support_ticket_reply_atomic.sql`. the reply function locks the ticket without checking that it is live, so a removed ticket is written to.

search:
```
   WHERE id = p_ticket_id
     AND deleted_at IS NULL
   FOR UPDATE;
```
replace:
```
   WHERE id = p_ticket_id
   FOR UPDATE;
```

**NC9** — `services/api-gateway/src/routes/operations/support.ts`. the Trust & Safety follow-on opens the case before it claims the ticket (the old order).

search:
```
    const { data: claimed, error: claimError } = await db
```
replace:
```
    await openTrustSafetyCaseFromTicket(db, input);
    const { data: claimed, error: claimError } = await db
```

**NC10** — `services/api-gateway/src/routes/operations/support.ts`. the queue filter's assignee_id accepts any string (the uuid check removed).

search:
```
    assignee_id: z.string().uuid().optional(),
```
replace:
```
    assignee_id: z.string().optional(),
```
