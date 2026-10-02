# P2-PRIVACY-CONCURRENCY-DB — buyer privacy-request intake: concurrency, ownership and truthful status, in a real database

Branch `letbuyy/phase2-shared-buyer-identity` (unpushed, unmerged, not deployed). Date 2026-10-01.
Initial HEAD `b180c706709fbbea90e214efd95272a99a90b836`. Last source commit `929ee36777835de3bd954eb1b93f6a0b225caa15`; the documents-only commits that follow it carry this file and the matrix notes, and the last of them is the branch tip (a file cannot name its own commit: the tip's full SHA is `git rev-parse HEAD` and is in the task's final report). Every number below was measured on the source commit's tree, except where §13 says a run was made on the committed tip.

Execution mode: **SINGLE AGENT** · Subagents invoked: **NO** · Agent/Task delegation: **NO** · Background agents: **NO** · Parallel worktree agents: **NO** · Workflow orchestration: **NO**. (Long runs were waited on as background *shell commands*; they are processes, not agents.)

## 0. Verdict

**A — PRIVACY CONCURRENCY AND OWNERSHIP VERIFIED IN THE OWNED DATABASE LANE.**

A permanent, default-executed pair of suites now proves, against a real Postgres, a real PostgREST and the **real worker** (its own `fetch`, not a router with fakes), that:

* concurrent identical privacy requests from one buyer leave **exactly one** unresolved row and every caller is told about that one — shown with a barrier that makes the unique-violation path run on *every* execution (6 racers; then 12 racers across two buyers and both types; then 8 racers with nothing held back at all);
* the database enforces it: migration 262's partial unique index, tested directly on every state, type, buyer, soft-delete and status-change combination that matters;
* a buyer reaches only their own requests; the session — verified for signature, issuer, audience, realm, token use, expiry, replay id and session epoch, then against the account — is the only thing that names the buyer; every wrong-realm, forged, expired, revoked and disabled credential is refused before any ticket table is touched;
* nothing a buyer or a support agent can do through any supported route makes a request read as an export or an erasure that happened, or rewrites its protected metadata;
* an unrelated database error is **never** turned into a successful deduplication, and no failure reply carries SQL or schema detail.

Nineteen faithful negative controls (the privacy index made non-unique, the conflict handler switched off, the readback or the fast path losing a filter, the buyer taken from the query string in four places, administrative closure serialized as fulfillment, the session epoch and disabled-account checks removed, operator metadata merged at the top level, and more) each turn the new tests red **for the intended reason**; five more show the tenant guard turning a dropped buyer predicate into a `500` instead of a leak (§12, Appendix A).

**No production source was changed.** These tests found no defect in the privacy intake itself, so there was nothing to fix and no regression test to add; the diff of this task is two test suites, a test harness, a README, one extended governance pin, two source-contract tests, one bullet in the gateway's `AGENTS.md`, and documents.

**C is not warranted**: nothing exposes a privacy request to anyone who should not see it. They did find one **mismatch between the record and the production wiring in the surrounding support system** (§9.3): the D04 reviewer/operator/lead tiers are implemented and correct in the support router, but through the production mount an earlier router's gate keeps every non-super-admin out of `/v1/operations/support/*`. That is *more* restrictive than the evidence documents say, so it is fail-closed for privacy, but "tiers enforced at the gateway" in three earlier documents is corrected by dated notes (§16). Opening the queue to the tiers is a decision about who may read privacy requests; this task does not make it.

## 1. State

| | |
|---|---|
| Branch | `letbuyy/phase2-shared-buyer-identity` |
| Initial HEAD | `b180c706709fbbea90e214efd95272a99a90b836` |
| Source commits | `f56f68cb57c629b7aaf27799095c6010306a3a0b` — the two suites, the harness, the source-contract tests, the lane pin and the README; `929ee36777835de3bd954eb1b93f6a0b225caa15` — three added assertions (the constraint name in the race counter, the real refusal in the unrelated-violation tests, the SQLSTATE in the foreign-key test) and the `AGENTS.md` bullet |
| Documents-only commits | this file, the dated notes in five earlier evidence documents, and a last note recording the clean-clone, governance-gate and restored-stack results (§13.4, §14) |
| Final HEAD | the last of those commits; `git rev-parse HEAD` |
| Pre-existing dirty paths, preserved and never staged | nine `analysis_options.yaml` modifications (`apps/deferred/delivery/mobile`, `apps/merchant/mobile`, `packages/dart/{core,marketplace_core,marketplace_models,marketplace_services,marketplace_ui_kit,models,ui_kit}`); the delivery app's iOS ephemeral artifacts (`apps/deferred/delivery/mobile/ios/Flutter/ephemeral/.swift_pm.lock`, `.../Packages/`); `docs/evidence/local-environment-2026-09-28/` |
| Staging | explicit paths only; `GIT_LITERAL_PATHSPECS=1` set inline per git command, never exported |

## 2. What changed

| File | What |
|---|---|
| `services/api-gateway/src/__tests__/owned-db/buyer-privacy-intake.postgres.test.ts` | the buyer-side suite: 34 tests |
| `services/api-gateway/src/__tests__/owned-db/privacy-support-visibility.postgres.test.ts` | the staff-side suite: 6 tests |
| `services/api-gateway/src/__tests__/owned-db/gateway-harness.ts` | shared harness: credentials, a worker driver, one tap on the gateway → owned-PostgREST hop, synthetic buyers |
| `services/api-gateway/src/__tests__/privacy-fulfillment-writers.test.ts` | unit lane: the privacy route only *reads* `fulfillment_outcome` (2 tests) |
| `tests/governance/privacy-fulfillment-writers.test.mjs` | repository-wide tripwire: no other file mentions the key; only two reviewed files write support tickets (3 tests) |
| `tests/governance/gateway-db-lane.test.mjs` | the lane pin names **eleven** suites (was nine) and pins how the privacy suites use the harness (+1 test) |
| `services/api-gateway/src/__tests__/owned-db/README.md` | how a suite drives the real worker, and why each request carries its own client address |
| `services/api-gateway/AGENTS.md` | one bullet in the "Test lanes" section: a suite that proves a route drives the real worker (and why a mock-router proof of access control is not enough) |

Not changed: any route, middleware, migration, shared type or runner. Not done, deliberately: any change to the restored development stack, any cleanup of data or volumes, any CPU-load experiment, any runtime bring-up or S26 work, any merge, push, deployment or hosted change, any external message, payment or order. `.dev.vars` was neither read nor needed (§13.4).

## 3. The real wiring that was exercised

A request goes through exactly the chain production runs. Nothing in it is a fake.

1. `worker.fetch` — the default export of `services/api-gateway/src/index.ts`, called the way Cloudflare calls it, with an execution context that collects `waitUntil` work (the observability writes) so a test can settle it.
2. The global middleware (`index.ts`): security headers, request id, input validation, error sanitiser, observability, CORS, API versioning, and `queryCostRateLimit` (a per-client-address leaky bucket: capacity 200, 20 points a second; a POST costs 5, a read 1).
3. `api.route('/storefront', storefrontRouter)` (`index.ts:762`) — mounted *before* the global `authMiddleware` (`index.ts:789`) → `registerStorefrontCustomerEngagementRoutes` → `registerBuyerRealmRoutes` (`buyer-realm-wiring.ts:72`) → `registerBuyerPrivacyRoutes` (`buyer-realm-wiring.ts:513`).
4. `requireBuyerSession` (`middleware/buyer-session.ts`): the token from the cookie `lb_buyer_session` (first) or the header `X-LetBuyy-Buyer-Session`; verified by `lib/identity-session-verifier.ts` against `LETBUYY_IDENTITY_PUBLIC_JWKS` — asymmetric algorithm only, issuer, audience `letbuyy:buyer-session`, realm `buyer`, token use `buyer_session`, `exp`, `iat` (≤ now + 60 s), a replay id of at least 16 characters, and the session-epoch claim — **then** `buyer_accounts(status, session_epoch)` is read for the account (503 if it cannot be read: it fails closed; 401 on a missing account or an epoch mismatch; 403 if disabled). The session's `sub` becomes `buyerAccountId`; the body is never consulted for it.
5. The route (`buyer-privacy-routes.ts`) validates the body (a JSON object; `type` is `access` or `erasure`; `notes` a string of at most 1000 characters after trimming), then the production dependencies in `buyer-realm-wiring.ts`: `findOpenRequest` (the fast path), `createRequest` (INSERT, then on SQLSTATE 23505 a re-read of the winner), `listRequests` — all through `getSupabaseAdmin(c)`, the **tenant-guarded** service-role client (`support_tickets` is a registered tenant table whose scope columns are `site_id` and `requester_user_id`).
6. PostgREST → Postgres: `support_tickets`, with migration 262's partial unique index.

What the tests supply is what a caller would bring: signed credentials. The credential keys are generated by the suite and configured as the identity public key; identity-platform's own issuance is a different system and is not exercised.

## 4. Fixture ownership (§6 of the mandate)

* A suite reaches its database only through `requireOwnedDatabase()`, which asks `scripts/governance/owned-fixture-guard.mjs` to prove, from what the runner wrote and not from any name, that the announced cluster, database and REST endpoint were created by *this* run (labels, run id, image, mounts, network, a marker inside the database, one read back through REST). Anything else throws before a statement is sent. Unchanged from P2-HERMETIC-GATEWAY-DB.
* Each suite's database is cloned from a per-cluster, sealed, fully migrated template and dropped with the suite; a real PostgREST sidecar fronts it. Every synthetic relationship (buyers, stores, users, employees, a super-admin allowlist entry, tickets) is created inside it by the suite; every id is random per run; every address is `.invalid`; no constraint, trigger or policy is disabled, and nothing is deleted by hand except one row removed *as a named fault* (§7).
* The gateway `Env` is built from `owned.restEnv()` plus the identity configuration. There is no inherited hosted credential, no `.dev.vars`, no discovery of the development stack, and no fallback to `snaz` or any existing store.
* The lane pin (`tests/governance/gateway-db-lane.test.mjs`) fails if a suite names a development container, reads `.dev.vars`, runs a process, hard-codes an id, skips, or if the privacy suites replace `fetch` by hand; it also pins that the staff-side suite uses no tap at all.

## 5. Concurrent HTTP requests (§8)

**Method.** `raceInserts(n)` (in the intake suite) installs the harness tap on the one HTTP hop between the gateway and the owned PostgREST. It holds every privacy INSERT until `n` of them have arrived, then releases them together. A request reaches its INSERT only after its own fast-path read (`findOpenRequest`) has been answered, so by the time any INSERT is released every request has already decided to create: the tap records what each fast-path read answered (always "nothing open") and how many reads had been issued at the instant of release (always `n`). The `n` INSERTs then race in the real database. Nothing about who wins, or whether the conflict path is reached, is left to timing. A separate test removes even the tap.

| Scenario | Responses | Database |
|---|---|---|
| 6 identical requests, one buyer, one type | `[201, 200 ×5]`; every body `status: received`, `type: access`; **one** id and one reference across all six | one row in total, `open`; INSERT attempts 6, accepted 1, refused with `23505` 5; only the winner's notes stored |
| 12 requests: 2 buyers × 2 types × 3 | 4 × `201`, 8 × `200`; each group's three callers name one id; four different ids in all; each caller is told the type it asked for | exactly one row per (buyer, type); INSERT attempts 12, accepted 4, refused 8 |
| 8 identical requests with **no tap** | exactly one `201`, seven `200`, never a failure | one row, one note |
| `access` and `erasure` raced by one buyer | `201`, `201`; different ids | two rows; no conflict (the types are independent) |
| the same type raced by two buyers | `201`, `201`; different ids | one row each; no shared idempotency decision |
| a request is closed, then 4 identical ones race | `[201, 200 ×3]`, and the new request is not the closed one | two rows: the closed one untouched, one new `open` |

**Documented semantics** (all observed, none assumed): the request that creates the row answers `201`; every duplicate answers `200` with the *existing* request and its current buyer-facing status; a duplicate's notes are discarded (the existing request is returned as it is); a new unresolved request is never reported as anything but `received`; there is no `500` for the expected unique conflict; a conflict never reports fulfillment.

## 6. The database invariant itself (§9)

Migration 262:

```sql
CREATE UNIQUE INDEX support_tickets_privacy_open_request_uidx
  ON public.support_tickets (requester_user_id, (metadata->>'privacy_request_type'))
  WHERE topic = 'privacy' AND status NOT IN ('resolved', 'closed') AND deleted_at IS NULL;
```

No later migration touches support tickets or privacy (263 only mentions 262 in a comment). The suite reads the definition back from `pg_index` in a database built from the migrations and asserts it: unique, `btree`, key `(requester_user_id, ((metadata ->> 'privacy_request_type')))`, the `privacy` topic, `status <> ALL (ARRAY['resolved','closed'])`, `deleted_at IS NULL`, no requester type and no store in the key, and exactly one privacy index. Then, with direct inserts and updates in the owned database:

| Case | Result |
|---|---|
| same buyer, same type, any two of `open` / `pending_customer` / `pending_internal` / `escalated`, either order | refused with `duplicate key value violates unique constraint "support_tickets_privacy_open_request_uidx"` and the key detail; still exactly one unresolved row |
| different type; different buyer; any number of `resolved` / `closed` rows beside an open one | accepted |
| a closed request, then a new open one, then a resolved one | accepted; one unresolved |
| soft-deleted request, in both directions | outside the index |
| reopening a closed request beside an unresolved one (to any of the four unresolved states); un-deleting one; retyping `erasure` → `access`; promoting a `general` ticket to `privacy`; re-assigning a request to a buyer who already has one | **all refused** by the index, and the refused update changes nothing |
| the unresolved request moving between unresolved states and into `resolved` | accepted; once nothing is unresolved the older request may be reopened, and then it is the one that blocks |
| ordinary support tickets (`general`, `billing`, `orders`, and a `general` ticket that carries `privacy_request_type` metadata) | **not constrained**, in any number |
| a privacy-topic ticket with no usable type (`{}`, `null`, `[]`, a missing or JSON-`null` key) or no requester | **outside the index** (NULLs are distinct). A property of the schema, characterized and labelled as such; no supported writer creates one |
| a malformed text-valued type (`["access"]`) | a key like any other: the second one is refused |
| the same requester id and type as an `employee` requester | the index does not distinguish requester types (§15, O6) |
| a status the projection does not know | cannot be stored: `support_tickets_status_check` refuses it, so the route's `unknown` branch is unreachable with this schema; the topic check admits `privacy` and refuses others |

## 7. Conflict handling (§10)

Only the intended uniqueness conflict is deduplication. Every case below is real PostgREST and Postgres behind it; where the tap injects a fault it is the *only* thing it does.

| Situation | How it is produced | Outcome |
|---|---|---|
| **Intended**: a concurrent request for the same (buyer, type) won | the barrier races (§5) | loser's INSERT → `409` `23505` → re-read finds the winner → `200`, the winner's id |
| the fast path is blind and the request exists | the first fast-path read is answered `[]` by the tap; INSERT and re-read are real | `200`, the existing request, one INSERT attempted, one row |
| **unrelated unique violation** (the ticket reference) | the INSERT body is rewritten to carry a reference another buyer's request holds; Postgres raises `support_tickets_ticket_ref_key` | `500`, body exactly `{ success:false, error:{ code:'DB_ERROR', message:'Database operation failed' } }`; **not** a success; the other buyer's request is not returned; the requester has no request; no retry |
| the same, for a buyer who already holds the *other* type | same | `500`; the other type's request is not offered as the answer |
| **FK failure** | the request row is removed between the request and its notes (a named fault); the notes' foreign key refuses them with `23503` | `500` generic, no schema words; no request is left that the buyer was told about; a retry creates one |
| DB unavailable | the INSERT hits a network error; the REST layer answers `503`; `500` with internals in the body; the fast-path read fails; a list read fails | `500` generic every time; nothing written; no `PGRST`, SQL, pool or stack text in any reply; a failed list is a failure, never an empty success; the next healthy request works |
| **lost response** | the INSERT commits and the response is dropped | the caller is told `500` (it could not know); the row exists; the retry returns it (`200`) and stores no second note |
| notes cannot be stored after the request was | the notes INSERT answers `500` | `500`; the request exists; the retry returns it |
| readback fails after a real conflict | fast path blind, re-read answered `500` | `500`, one row, nothing invented |
| **request closed during conflict handling** | the winner is closed by a real UPDATE between the conflict and the re-read | `500` after exactly **one** INSERT attempt (no loop); a closed request is never offered as the answer; the next attempt creates a fresh request (`201`) |

Bounded, explicit behaviour for "the readback finds no unresolved row": a single generic `500`, then the buyer may ask again. It is not elegant (a retry inside the route would absorb that vanishingly small window), but it is honest, bounded, and safe, and changing it is not a privacy defect.

## 8. Buyer ownership and realm isolation (§7, §11)

* **Without a credential**, with garbage in the header, or garbage in the cookie: `401`, and **zero** ticket, message or buyer requests reach PostgREST (recorded by the tap), and nothing is written.
* **Refused, each before any ticket is touched, with a reply that does not say why**: a merchant session (its audience, realm and token use); a storefront session; the right realm and use but another audience; another issuer; the buyer audience with a merchant realm claim; with a merchant token use; a token signed by a different key under the same key id; a symmetric-algorithm token; an expired token; one issued in the future; no replay id; a too-short replay id; a token for an account that does not exist; a token from a session epoch the account has not reached. A bad signature never costs a database read; a verified token is checked against the account (the first ticket-table-related request is the `buyer_accounts` read).
* **Revoked, disabled, fail-closed**: a token good before `revoke_buyer_sessions` is refused after it, and the refused request creates nothing; a token from the new epoch is accepted; a disabled account is `403 BUYER_DISABLED`; if the account cannot be read, the answer is `503 SESSION_CHECK_UNAVAILABLE`, never acceptance on the signature alone.
* **The session decides the buyer.** A hostile body (`buyer_account_id`, `requester_user_id`, `requester_type`, `requester_email`, `topic`, `site_id`, `status`, `priority`, `channel`, `id`, `ticket_ref`, `deleted_at`, `metadata`, `fulfillment_outcome`) plus a query string naming another buyer, sent by a buyer while the *other* buyer already has an open request of the same type: a new request is created for the session buyer (`201`, not the other buyer's `200`); the stored row is exactly `{ requester_user_id: <session buyer>, requester_type: 'customer', topic: 'privacy', status: 'open', site_id: NULL, channel: 'api', priority: 'normal', metadata: { privacy_request_type: 'access' } }`; the other buyer's request and notes are untouched. The cookie carries the same verified session.
* **Listing**: each buyer lists only their own requests whatever the query string says; a listing serializes six fields (`id`, `reference`, `type`, `status`, `created_at`, `updated_at`) and no account id, requester field or internal column.
* **Foreign ids through the generic support detail routes** (the only per-request routes that exist; there is no `GET /privacy-requests/:id`): another buyer — even naming the owner in the query string — gets `404` on both read and write, creates nothing and sees none of the owner's text; a malformed id is `400`; the owner sees only public messages (an internal agent note is never returned) and can add a message but cannot change the ticket's status, topic or metadata through it. The generic ticket list shows a buyer their own privacy ticket without any metadata and never another buyer's.
* **Both realms, both directions** (suite 2): a buyer's credential — in the session header, the session cookie, or as an `Authorization` bearer — gets `401` on `/v1/employees/tickets` and on every platform support route, reads and writes; a merchant's employee, an allowlisted platform super admin and a store owner, each holding a verified signed internal identity, get `401` on the buyer's privacy routes; so does a signed identity for a `users_custom` row that merely **shares a buyer account's id**. No cross-realm attempt wrote anything.

## 9. Support visibility and operator access (§12)

### 9.1 Merchant staff and everyone who is not platform staff

A merchant's employee (including one whose role string is `support` — the operator tier by default) lists **their own store's** tickets and counts only those: a buyer's privacy request has `site_id` NULL, so it appears in neither the rows nor the `total`, whatever is asked for (another store, the privacy topic, a buyer, a bigger page, a status). A platform employee on that route is refused (it belongs to stores). On every platform support route — list, detail, overview, and a mutation — through the production worker, each of these is refused `403 FORBIDDEN`, with nothing leaked and nothing written: a store employee whose role is `admin`, a store employee whose role is `manager`, the store owner, a user with no employee row, an invited platform employee, a disabled platform employee, a soft-deleted platform employee; an unauthenticated caller gets `401`.

### 9.2 What an allowlisted super admin can read

Through the production mount, an allowlisted super admin reaches the platform queue, the detail (the buyer's own note **and** the internal notes — which is the platform operator's job, and the one place the buyer route's "never an internal note" rule does not apply) and the overview. The queue's search matches subject, requester email and reference only: neither the buyer's note text nor the buyer's email finds a privacy request (it carries no requester email), and its reference does. The queue **cannot be filtered to the privacy topic**, and an operator **cannot create a privacy-topic ticket**: the shared `SupportTicketTopicSchema` has no `privacy`, and the resulting parse error surfaces as `500 INTERNAL_ERROR` (the client sees no enum; the log does). That is a gap in the operator tooling, and also what incidentally stops an operator writing a privacy ticket with arbitrary metadata.

### 9.3 The production mount reaches super admins only (finding, not a defect of intake)

`routes/operations/incident-command.ts:21` registers `router.use('*', requireRoleCategory('ops'), requireSuperAdmin)` and is mounted at `/operations` in `index.ts:858`, **before** `/operations/support` at `index.ts:860`. Hono applies a `'*'` middleware of a mounted router to every route registered after it under the same prefix. So every platform support route sits behind that gate whatever the support router itself checks. The probe (pure Hono, no database; a router with `use('*', gate)` mounted at `/operations`, then a router mounted at `/operations/support`, and the same two in the other order) printed:

```
/operations/support/tickets -> 403 {"gate":"ops","reached":false}
/operations/incidents -> 403 {"gate":"ops","reached":false}
(support mounted first) /operations/support/tickets -> 200 {"ok":"support tickets"}
```

Measured through the real worker: platform employees of the `viewer`, `support` (operator) and `manager` (lead) tiers get `403` with the message `Insufficient role category. Required: ops` on the list, the detail, the overview and on reply, escalate, resolve and assign; nothing is read or written. Only an allowlisted super admin passes.

Mounted **alone**, against real `employees` rows, the support router's own logic is correct: only an *active, non-deleted* platform employee (`store_id IS NULL`) passes (a store `admin`, the store owner, a stranger, an invited, a disabled and a soft-deleted employee all get `403 Platform operator access required`); a `viewer` reads the queue, the detail (including the buyer's note) and the overview and is refused every mutation on its scope (`PERMISSION_SCOPE_DENIED`: reply, internal note, close-by-reply with an outcome claim, escalate with an outcome claim, resolve, assign, record satisfaction, create) with nothing changed; an agent (`support:reply`) can reply but not assign; a lead (`support:manage`) can assign; and none of it changes a request's topic, store, requester or metadata.

What that means: the privacy-relevant truth today is **"only the super-admin allowlist can read or act on a privacy request through the gateway"**, which is stricter than `PHASE2_DECISIONS.md` ("a non-superadmin active platform employee can now reach this router") and the matrix row F2.6 say. It is fail-closed, so nothing here is exposed; but the tiers are "DDL-real, wiring-dead", and the existing `operations-support-tier-wiring.test.ts` — which mounts the support router alone against a fake PostgREST — could not see it. The suite pins the production behaviour on purpose: **a future change to the mount order or the gate fails it**, so widening who may read a privacy request cannot happen by accident. **Decision for the owner (O1, §15):** keep it (privacy-protective, and the D04 tiers stay dormant), or open the queue to the tiers — knowing, from the router-level test, exactly what a viewer would then read and what an agent could do.

## 10. Lifecycle truthfulness (§13)

Through the dedicated route, from real rows:

| Stored | The buyer is told |
|---|---|
| `open` | `received` |
| `pending_customer`, `pending_internal`, `escalated` | `in_review` |
| `resolved` or `closed`, with no `fulfillment_outcome` | `closed_no_fulfillment` |
| …with empty-object, JSON-`null` or array metadata (so no type) | `closed_no_fulfillment`, `type: null` |
| …with an unrecognised outcome word, a wrong-case or padded `fulfilled`, a boolean, a number or an object | `closed_no_fulfillment` |
| `open` or `escalated` carrying `fulfillment_outcome: "fulfilled"` | `received` / `in_review` (an outcome only counts on a closed request) |
| `resolved` / `closed` with `fulfillment_outcome: "fulfilled"` | `fulfilled` — **simulated by a fixture only**, to prove the reader's mapping; no code in the repository writes the key (below) |
| any other status | cannot be stored (`support_tickets_status_check`), so `unknown` is unreachable |

Who can write the key. `fulfillment_outcome` appears in exactly one non-test file in the repository, the privacy route, twice: a type member and a read (unit-lane test); the route writes nothing (it reads through the dependencies it is handed); the only runtime files that write support tickets are `routes/operations/support.ts` and `routes/storefront/buyer-realm-wiring.ts` (governance test, repository-wide). Behaviourally, through the real routes, with hostile payloads: the buyer's body cannot set it (§8); the buyer's support message route cannot change status, topic or metadata; and a support agent's every route cannot — internal note: no change; public reply: `pending_customer`; **escalate with `{fulfillment_outcome:'fulfilled', status:'closed', topic:'general'}`**: the route *nests* operator metadata under `escalation`, so the ticket's metadata is `{ privacy_request_type:'access', escalation:{…} }` and the buyer reads `in_review`; **escalate with `{privacy_request_type:'access'}` on an erasure request**: nested, the request stays `erasure`; **close by reply with the same claim in the message's metadata**: the claim lives on the message row only and the buyer reads `closed_no_fulfillment`; **resolve**: `closed_no_fulfillment`. A privacy-topic ticket **cannot be created by an operator** (§9.2); the same payload as a `general` ticket is accepted and is what it says it is: invisible to the buyer's privacy view, not counted as an unresolved privacy request, and shown in the generic list as `general` without metadata. After all of it, no privacy ticket in the database has the key.

A closed request does not block a new one; the old request stays closed; reopening it while a new one is unresolved is refused by the database (the reply route does not check its status update's result: §15, O3).

**Not done, on purpose:** no export and no erasure exists, and no fulfillment writer was manufactured for a positive test. Because the model has a single outcome word with no per-type vocabulary, "request type and outcome cannot mismatch" cannot be tested, only observed: the reader trusts one field, and a future legitimate writer must record the outcome per type (O5).

## 11. Input and failure coverage (§14)

Refused `400 VALIDATION` before any ticket is read or written, with nothing stored: malformed JSON, an empty body, JSON `null`, an array, a string, a number, a boolean, a missing type, an unsupported type, a type in the wrong case, a numeric type, a null type, a type with surrounding whitespace, notes that are a number, an object, an array or JSON `null`, notes one character over the limit, and notes three hundred thousand characters long. Exactly 1000 characters (after trimming surrounding whitespace) is accepted and stored whole; whitespace-only notes are no notes. Database failures, ambiguous retries and duplicate concurrent requests are §7 and §5. Every client-visible failure is a generic body; no SQL, constraint, table, pool or stack text appears in any of them.

The global per-client limiter fronts the intake (three requests, not load): a read is charged 1 and a POST 5 against a bucket of 200 draining at 20 a second, one bucket per client address, and a client address that has never been seen starts full. (That is also why every harness request carries its own address: a suite sending a few hundred requests from "nobody" would otherwise exhaust a bucket no production caller shares and fail for a reason unrelated to what it tests.)

## 12. Negative controls (§15)

Each control applies **one** temporary source change to **one** tracked file, runs the owned-lane suite(s) through the runner, records which tests go red and why, then restores the file from a backup taken first and verifies it byte for byte (SHA-256 compared; a final `git status` shows no tracked file modified). They ran against the committed suites. The suites' own assertions were not touched.

**Two groups, and why.** *Faithful controls* model a bug that compiles, passes the tenant guard and would ship: the unique index made non-unique; the conflict handler switched off; a predicate on the **right column bound to the wrong value** — the buyer taken from the query string — in the privacy list, the fast path, the support detail lookup and the generic ticket list; the conflict readback with its type filter or its unresolved-status filter dropped; the fast path with the same two filters dropped; administrative closure serialized as fulfillment; the session epoch check removed; the disabled-account check removed; the notes-type validation removed; the request body choosing the buyer; the internal-notes filter removed; the merchant staff ticket list scoped to platform-level tickets (`filter('site_id', 'is', null)`, the one non-equality shape the guard accepts); operator escalation merging its metadata at the **top level** instead of nesting it; the shared support-topic list admitting `privacy`. *Guard-blocked variants* drop the buyer (or store) predicate outright, or use a shape the guard does not accept (`.not`, `.is`): the tenant guard (`tenant/tenant-scoped.ts`) refuses such a query — its own text, `Tenant table support_tickets requires a tenant/owner predicate before execution`, is in those runs' logs — so the gateway answers `500` instead of leaking, and the tests go red because of the 500s, not because of what a leak would show. They are kept because they are evidence that the database-side backstop to the application layer works (O9), and as the reason the faithful controls bind the predicate to the wrong value instead of removing it: the guard cannot see that bug, and the tests can.

**Faithful controls (19).** "Red" counts failing tests in the named suite; the reason is the first failing assertion, read from the suite log. The exact edits are in Appendix A.

| Control | The one temporary change | Red | Why (what the failing assertion saw) |
|---|---|---|---|
| NC1 | migration 262 replayed as `CREATE INDEX` instead of `CREATE UNIQUE INDEX` | 11 (intake) | every racer creates: `created: 6` not 1, 12 not 4, 8 not 1; the index-definition test and every duplicate-refusal and status-change test fail |
| NC2 | the unique-violation handler in `createRequest` switched off | 6 (intake) | each loser of a race answers `500 DB_ERROR` instead of `200` with the winner's id |
| NC3c | `listRequests` takes the buyer from `?buyer_account_id` | 1 (intake) | the listing returns the *other* buyer's request |
| NC3d | `findOpenRequest` (fast path) takes the buyer from the query string | 1 (intake) | the hostile call answers `200` with the other buyer's open request instead of creating the session buyer's own (`201`) |
| NC4 | a resolved or closed request is always reported `fulfilled` | 2 (intake) + 1 (visibility) | stored `resolved` reads `fulfilled`; the lifecycle test reads `fulfilled` after a closure |
| NC5b | the conflict readback drops the request-type filter | 2 (intake) | an unrelated violation is answered with the buyer's *erasure* request (`200`, not `500`); a race group names two requests |
| NC5c | the conflict readback drops the unresolved-status filter | 1 (intake) | a closed request is offered as the answer (`200`, `closed_no_fulfillment`) instead of the bounded `500` |
| NC6a | the session epoch is no longer compared | 2 (intake) | a token from an epoch the account has not reached → `201`; a pre-revocation token → `201`, not `401` |
| NC6b | the disabled-account check removed | 1 (intake) | a disabled account → `201`, not `403` |
| NC7b | the merchant staff list is scoped by `filter('site_id','is',null)` | 1 (visibility) | the staff list returns the three buyer privacy requests |
| NC8 | operator escalation merges its metadata at the top level | 1 (visibility) | stored metadata carries a top-level `fulfillment_outcome: 'fulfilled'` instead of `escalation: {…}` |
| NC9 | the notes-type validation removed | 1 (intake) | `notes: 12345` is accepted (`201`) |
| NC10 | the request body may choose the buyer | 1 (intake) | the session buyer has no request (it was created for the buyer the body named) |
| NC11b | the support detail lookup takes the buyer from the query string | 1 (intake) | a stranger reads the owner's messages |
| NC12 | the internal-notes filter removed from the buyer message list | 1 (intake) | the internal triage note is returned to the buyer |
| NC13 | the generic buyer ticket list takes the buyer from the query string | 1 (intake) | the list returns another buyer's ticket |
| NC14 | the fast path drops the request-type filter | 6 (intake) | a buyer's open request of one type answers a request of the other type; the race tests no longer see "nothing open" |
| NC15 | the fast path drops the unresolved-status filter | 2 (intake) | a closed request answers every new request: no new one can ever be created (`created: 0`) |
| NC16 | the shared support-topic list admits `privacy` | 1 (visibility) | the operator queue answers `?topic=privacy` (`200`), and would create privacy-topic tickets with arbitrary metadata |

**Guard-blocked variants (5)** — red because the tenant guard refused the query (`500`), not because a leak was observed:

| Control | The one temporary change | Red | Why |
|---|---|---|---|
| NC3a | `listRequests` scoped by `.not('requester_user_id', 'is', null)` | 11 (intake) | the guard throws; every privacy list read is a `500` |
| NC3b | `findOpenRequest` scoped the same way | 22 (intake) | the guard throws on every fast-path read: nothing can be created |
| NC5 | the conflict readback scoped the same way | 7 (intake) | the guard throws on the re-read; every lost race is a `500` |
| NC7 | the merchant staff list scoped by `.is('site_id', null)` | 1 (visibility) | the guard throws; the staff list is a `500` |
| NC11 | the support detail lookup scoped by `.not('requester_user_id', 'is', null)` | 1 (intake) | the guard throws; the detail route is a `500` |

**Summary.** All 19 faithful controls turn the suites red, each for the reason in its row; the 5 guard-blocked variants go red through the guard. All 24 files were restored byte for byte: the SHA-256 of all seven touched files (`262_…sql`, `buyer-realm-wiring.ts`, `buyer-privacy-routes.ts`, `middleware/buyer-session.ts`, `routes/employee.ts`, `routes/operations/support.ts`, `packages/shared-types/src/index.ts`) was compared before and after the batch, and a `git status` afterwards shows no tracked source file modified. The batch ran against suite commit `f56f68cb`. The four controls most affected by the three assertions added afterwards in `929ee367` (NC1, NC2, NC5b, NC5c) were re-run against it and went red identically (11, 6, 2 and 1 tests).

**Not reported, and why it matters.** An earlier batch of 13 controls ran against a draft of the suites. It is what showed that five of the first controls were guard-blocked (so the faithful variants exist), and that the lifecycle test's first escalation payload also carried a retyping attempt that the unique index happened to refuse (NC8 went red on a `500`, not on the forged outcome; the test now sends the outcome claim and the retyping attempt separately, so each is detected for its own reason). The suites were changed in response, and the batch above is the one that counts.

## 13. Verification

### 13.1 How the suites got to green, and repeatability

* **First runs, honestly.** The intake suite's first run was 30 tests, 28 pass, 2 fail — both my test code, not the product: an assertion that compared a message row that carried two extra columns, and a validation test whose ~120 requests from one client address were throttled by the global limiter (`QUERY_COST_RATE_LIMITED`), which is what led to the harness giving each request its own address and to the limiter test. The staff suite's first run was 5 tests, 3 pass, 2 fail with `Insufficient role category. Required: ops` on routes I had expected a platform viewer and an agent to reach: that failure *is* the §9.3 finding. The suite was rebuilt to assert the production behaviour and to prove the tiers separately, with the router mounted alone.
* **Green runs of the new suites on the committed suites** (standalone, `--jobs 1`): intake 31 → 34 tests as coverage was added; then, on the final suite content, **two consecutive runs of both suites together, 40/40 pass, 0 skipped, 0 todo, both times** (46.3 s and 45.5 s wall; the intake suite 33.1 s and 32.5 s, the staff suite 11 s and 11 s).
* **Inside the full runs below** the same two suites ran again, in clusters shared with the other nine suites.
* **Stability of the checks themselves.** The race tests assert counts that the barrier makes exact (6/1/5, 12/4/8, 4/1/3) and the unsynchronized test asserts only what holds for every interleaving; the one limiter assertion is exact because a client address that has never been seen starts with a full bucket. No assertion depends on timing, and no suite, test or fixture in this task was found flaky.

### 13.2 Exact results

The unit lane, the typecheck and the root suite ran on the source commit `929ee367` with this task's uncommitted documents in the working tree (the pure group, which reads documents, ran first); the final governance gate (§13.4) re-validates the committed tip in a fresh clone.

| Lane / group | Command | Result |
|---|---|---|
| Gateway unit lane (fast, no database) | `pnpm --filter @letbuyy/api-gateway run test:unit` | **1322 tests: 1321 pass, 0 fail, 0 skipped, 1 todo** — `LB-BIL-002 (open)`, open product work, unrelated and unchanged; 14 s. +2 against the previous 1320 (the new route-reads-only contract). |
| Typecheck | `pnpm run typecheck` | **81 of 81 tasks successful**, 0 type errors (turbo replayed 80 from its cache; the gateway, whose inputs changed, ran fresh) |
| Lint | `pnpm run lint` (turbo; the gateway has no lint script, so nothing this task changed is a lint target) | 5 of 5 tasks successful (cached), **0 errors**; the warnings in the five Next apps (883, 326, 114, 105, 19) are pre-existing and were not targeted |
| Owned gateway database lane (11 suites) | inside the root run below (the bare runner: 59 + 11 suites, `--jobs 2`: 70 suites, 359 tests, 359 pass, 444.8 s); the new suites also standalone, twice (§13.1) | **11 suites, 54 tests, 54 pass, 0 fail, 0 skipped, 0 todo**: `buyer-privacy-intake.postgres` 34 (40.1 s), `privacy-support-visibility.postgres` 6 (12.7 s), `gift-card-money-path` 3, `merchant-tenant-predicate` 3, `verification-token-redemption` 2, `backfill-and-target-shadow.postgres` 1, `gst-invoice-issuance` 1, `gst-tax-computation` 1, `inventory-reservation-lifecycle` 1, `real-http-shadow-rehearsal.postgres` 1, `real-staff-product-journey.postgres` 1 |
| Root suite (the acceptance command) | `pnpm test` = `node scripts/governance/test-behavioral.mjs --with-contracts` | **PASS: 2571 tests, 2556 pass, 0 fail, 0 cancelled, 15 skipped, 0 todo.** Groups: pure + live 177 suites / 1890 tests / 1875 pass / 15 skipped; postgres (owned clusters) 59 / 305 / 305; **gateway database (owned) 11 / 54 / 54**; contracts 322 / 322. |
| Real governance gate | `node scripts/validate-governance.mjs --lane=gate`, fresh disposable `git clone --local` + `pnpm install --frozen-lockfile`, at the source commit (and again at the committed tip: §13.4) | **PASS=114 FAIL=0 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1**: 114 validators executed and passed, 115 discovered on disk |

**Skips and todo, kept apart.** *Unit lane:* 0 skipped, 1 todo (`LB-BIL-002`, above). *Owned database lane:* 0 skipped, 0 todo, and by construction it cannot report either — a skipped, todo or empty gateway suite is red. *Root suite:* 15 skips, all `[HUMAN-REQUIRED]` (HR-KMS-LIVE, HR-TURNSTILE-LIVE, HR-PA-SPLIT-LIVE, HR-MERCHANT-PSP-LIVE, HR-GST-IRP-LIVE, HR-CARRIER-LIVE, HR-DNS-CHECKOUT, HR-WHATSAPP-LIVE, HR-DLT-TRAI-LIVE, HR-ESP-LIVE, HR-AUTOPAY-LIVE, HR-LEGAL-DPDP-PA, HR-WAREHOUSE-LIVE, HR-AI-MODEL-LIVE, HR-PROD-MIGRATE-DEPLOY): each needs a credential, a provider contract, a legal sign-off or a deployment only a human can give; none is a code defect and none was added by this task. 0 todo in the root suite.

### 13.3 Movement against the reference counts

| | Reference (end of P2-HERMETIC-GATEWAY-DB) | Now | Why it moved |
|---|---|---|---|
| Root suite, discovered / passed / skipped | 2527 / 2512 / 15 | **2571 / 2556 / 15** | +44 = 40 owned-database tests (34 + 6) + 3 governance contract tests + 1 lane-pin test; skips unchanged |
| Owned database lane | 9 suites / 14 tests / 0 skipped | **11 suites / 54 tests / 0 skipped** | the two new suites |
| Pure group | 176 suites | 177 | `tests/governance/privacy-fulfillment-writers.test.mjs` |
| Gateway unit lane | 1320 tests, 1 todo | **1322 tests, 1 todo** | `privacy-fulfillment-writers.test.ts` (2) |
| Typecheck | 81 packages | 81 of 81 | no new package |
| Real governance gate | 114 passed | **114 passed** | no validator added or removed |

Nothing here is a full product journey, and it is not claimed to be: these are a router-and-database proof of intake, concurrency, ownership and truthful status, against a service-role PostgREST (so no row-level-security claim), with credentials signed by the suite's own keys.

### 13.4 A clean clone needs nothing from this machine, and the governance gate

A fresh `git clone --local` of the branch at the source commit `929ee367`, in a scratch directory: no `.dev.vars` in it (`ls -a | grep -c dev.vars` → 0); none of `SUPABASE_*`, `DATABASE_URL`, `LETBUYY_OWNED_*` or `LETBUYY_EXECUTABLE_PG_*` in the shell's environment (count 0); `pnpm install --frozen-lockfile` in 7.7 s (the only tracked-file difference afterwards is a file-mode bit on `packages/theme-engine/src/theme-cli.ts`, which pnpm sets when it links that bin). In that clone:

* both privacy suites through the runner: **40 of 40 pass, 0 skipped**, 49.3 s (intake 35.8 s, staff 11.3 s);
* the lane pin and the governance contract: **15 of 15**; the unit contract: **2 of 2**;
* the real governance gate (`node scripts/validate-governance.mjs --lane=gate`): **PASS=114 FAIL=0 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1** (114 executed and passed, 115 discovered on disk), the same as the reference. The `branch-dispositions-validator` notes about `MERGED_DEVELOP` rows ("develop ref missing locally") are informational: the clone has no local `develop` ref.

**Again on the committed documents tip** (`10b475a2efb2ac0f6bc0e042e034c959cc58b12a`, the commit that adds this file), in the same clone after a fast-forward and a re-install: the real gate **PASS=114 FAIL=0 BLOCKED=0 SKIP=0 NOT_APPLICABLE=1** again, and the governance and CI test files that read the documents (`tests/governance/*.test.mjs` and `tests/ci/*.test.mjs`) **338 of 338 pass**, 0 skipped. The one commit after that tip changes this paragraph only.

## 14. Cleanup and resource ownership; the restored stack

**Resources this task created, and what is left of them.** Every Docker resource this task created belongs to a runner (labelled `com.letbuyy.executable-fixture` with the run id; names `letbuyy-exec-<pid>-…`): each suite's cluster, REST sidecar, network and volume, removed by the runner when its run ended (test containers with `docker rm -f -v`). After the last run: **0 labelled containers, 0 labelled networks, volumes total 403 / dangling 397, identical to the baseline measured before the task started**, and no runner, `tsx`, control-driver or test-behavioral process left. The `letbuyy-executable-pg` container that `docker ps` shows is older than this task, unlabelled and not ours, and was not touched. This task ran no `docker system`, `volume` or `container prune`, removed no resource it did not create, and never targeted the restored stack except for the read-only census below. The unquoted-heredoc incident of the previous task did not recur: source and documents were edited with the file tools, with one disclosed exception — one test body of the intake suite was replaced by a scratch Python script written through a *quoted* heredoc (no expansion; it asserted its anchors matched exactly once) — and the other shell heredocs were also *quoted* ones that wrote scratch analysis scripts. No prose was interpolated into an executable command, no multiline command was run uninspected, and no prune of any kind was run.

**The restored development stack was not written to.** No gateway test can name it (the guard refuses it by name, label and image; the runner refuses the name before any docker command), and none did. Evidence is a read-only census (`PGOPTIONS='-c default_transaction_read_only=on'`, counts, newest-row timestamps and the server's own cumulative write counters, never contents) taken before this task's runs (2026-10-01T17:01:00Z), after the root suite and the first clean-clone runs (18:19:53Z), and after the very last Docker-backed run (18:24:31Z). **All three captures are identical**: 27 table row counts, 3 synthetic-marker counts, 9 newest-row timestamps and 26 cumulative per-table write counters (`n_tup_ins/upd/del`, which the server keeps since a stats reset that has never happened) — a `diff` of the first file against each later one, ignoring the capture time, is empty. For the tables this task is about: `support_tickets` 0 rows (counters ins=7, upd=0, del=5, history from an earlier one-off proof, unchanged), `ticket_messages` 0 rows (ins=4, del=2, unchanged), `buyer_accounts` 25 rows (ins=17, upd=11, del=6, unchanged); and `orders` 97, `gst_invoices` 20, `gift_card_ledger_entries` 90, `products` 117, all unchanged. The census transaction was read-only (`meta|txn_read_only|on`).

**Not touched:** the synthetic rows already in the stack (Q3 is open and unexecuted), the 397 dangling anonymous volumes, the backups, signing assets and environment files. A time-window attribution is not ownership proof, so nothing was attributed or cleaned. The disposable clone and the scratch files this task made live in the session scratchpad, outside the repository.

## 15. Observations that are not defects of intake, and the outstanding decisions

**Observations** (each verified; none changed here):

* **O1 — D04 tiers are unreachable through the production mount** (§9.3). Decision for the owner below.
* **O2 — the operator API cannot filter by, or create, a privacy-topic ticket**: `SupportTicketTopicSchema` omits `privacy`, and the parse error is a `500 INTERNAL_ERROR` (a general gateway matter: a `ZodError` is not mapped to a `400`). Adding `privacy` to the shared enum would also let an operator create a privacy ticket with arbitrary metadata (NC16 shows the suite catches it), so a fix needs the filter and the creation split.
* **O3 — the operator reply route does not check the result of its status update** (`routes/operations/support.ts:568-576`): a refused reopen (§6) is recorded as a message and answered as success. The database invariant holds; the operator is not told. A general support-route behaviour.
* **O4 — a duplicate or retried request discards the later notes**, and a failure to store the notes leaves an open request with a `500` reply (a retry returns the request; the notes are not re-applied). Honest, but the buyer's text can be lost.
* **O5 — one outcome word, no per-type vocabulary**; a future writer must record it per type, from the executor that did the work.
* **O6 — the index key has no requester type, while the route reads with `requester_type = 'customer'`.** A privacy-topic row of another requester type for the same id and type would hold the key without the route being able to see it. Only a direct database write can create one (no supported writer does), and the suite pins that the index does not tell the types apart.
* **O7 — the generic buyer ticket list shows a privacy ticket with its raw workflow status** (`closed`), never an outcome and never metadata: truthful, and a different projection from the dedicated route's.
* **O8 — the buyer-export source (`identity-foundation/buyer-export-source.ts`, not wired to any route) reads `support_tickets` without a `deleted_at` filter** (its contract excludes agent notes, which the query also does). Relevant to the export-release decision (D05); not exercised here.
* **O9 — the tenant guard is a backstop, not a proof.** Removing the buyer predicate outright from a privacy query makes the guard refuse it (a `500`, not a leak: NC3a, NC3b, NC5, NC7 and NC11 went red for that reason, and are kept as the evidence that it does); the bug the guard cannot see is a predicate that is *present but bound to the wrong value*, which is what NC3c, NC3d, NC11b, NC13, NC5b and NC7b model and what the tests catch.
* **O10 — a ticket reference has 32 bits of randomness** (`SUP-<year>-<8 hex>`), and the column is unique: a collision answers the privacy request with one generic `500` (this is the "unrelated unique violation" of §7, deliberately not deduplicated) and the retry gets a new reference. An availability quirk at volume, not a correctness problem.

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-CORRECTNESS).** O2 and O3 are repaired, and the repair is proven through the production worker against an owned database (`P2_OPERATOR_QUEUE_CORRECTNESS_ACCEPTANCE.md`): the queue is filtered with a separate queue-topic list that includes privacy while ticket and macro creation keep it out; malformed input on every support route is a sanitized `400`, not a `500`; and a reply is one transaction (migration 264), so a reopen the privacy rule refuses is a `409` that keeps no message and writes no audit row. O1 is unchanged and still the owner's decision.

**Outstanding, explicit** (none touched, none claimed): authoritative identity cutover and the sustained shadow-observation window (D03); operator provisioning, bootstrap, recovery, MFA enrollment, high-risk dual control, console delivery and the moderation/impersonation callers (D04), and now **who may read a privacy request** (O1); export release, requester verification, retention, deletion, legal hold and incident ownership (D05) — no export, no erasure and no fulfillment writer exists; the two named identity-authority deviations from F2.1; hosted delivery and deployment; Q3, the unexecuted proposal about the synthetic rows already in the restored stack (`P2_HERMETIC_GATEWAY_DB_ACCEPTANCE.md` §15), which this task did **not** act on.

## 16. The requirement matrix and the dated notes

* `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §8: a new F2.7 row for this proof; the F2.6 tiers row is corrected (router level verified; production reach is super-admin only).
* `PHASE2_DECISIONS.md`: the privacy-intake row now cites the persistent suite (it described a real-Postgres proof that was a temporary script, "run once and deleted"); a dated note on the D04 section and its row.
* `PHASE2_CLOSURE.md`, `SECURITY_ACCEPTANCE.md`: dated notes where they describe the tiers as active or the concurrency proof as a one-off.
* `P2_HERMETIC_GATEWAY_DB_ACCEPTANCE.md` §11, §14 and §17: dated notes that the missing real-database concurrency test now exists.
* `services/api-gateway/AGENTS.md`: one bullet in "Test lanes" (not an evidence document: the working rule that came out of §9.3).

The original text is left where it is, as the record of its moment.

## 17. Precise next task

**P2-OPERATOR-QUEUE-GATE — decide who may reach the platform support queue (and with it a buyer's privacy request), then make the wiring say so.** Bounded; the owner's answer comes first.

1. **Owner answers O1.** *Keep* the production behaviour (only the super-admin allowlist reaches `/v1/operations/support/*`; privacy-protective; the D04 tiers stay dormant), or *open* it to the viewer/operator/lead tiers (a viewer could then read the queue, the detail and the buyer's own note; an agent could reply, escalate and resolve; only a lead could assign — all proven in §9.3, mounted alone).
2. **If keep:** correct the F2.6 row of the matrix to "implemented, dormant", and, with the owner's approval, the three small honesty fixes the suite found: map a `ZodError` to `400` instead of `500` (O2), check the status-update result in the support reply route (O3), and split the shared topic list into a *create* list and a *filter* list so operators can filter the queue by privacy without being able to create a privacy-topic ticket (O2).
3. **If open:** narrow or reorder the earlier `incident-command` gate so only the routes that need `ops` + super admin are behind it (`index.ts:858`–`860`), decide whether a `viewer` may read a buyer's note at all, and change the production-mount test in `privacy-support-visibility.postgres.test.ts` in the **same commit** — that test is built to fail on exactly this change, so it cannot happen unnoticed.

Either way the two suites in this task are the acceptance. The other open item from the previous task, **Q3** (what to do with the synthetic rows already in the restored stack — `P2_HERMETIC_GATEWAY_DB_ACCEPTANCE.md` §15), is unchanged and is its own bounded task with a fresh read-only census first.

> **Later note (2026-10-02, P2-OPERATOR-QUEUE-CORRECTNESS).** The three honesty fixes of step 2 were made by the next task without waiting for O1 — its mandate authorized them, and they change no one's access — together with an atomic reply (`P2_OPERATOR_QUEUE_CORRECTNESS_ACCEPTANCE.md`). Step 1 (the owner's answer to O1) and step 3 are still open; the "implemented, dormant" wording of the F2.6 row waits on that answer.

## Appendix A — the exact edits of the negative controls

Each block is the whole of one control: the file, and the lines removed (`-`) and added (`+`), with one unchanged line of context. A control was applied to a clean tracked file, run through the runner, and the file restored from a backup taken first and verified by SHA-256. To reproduce one, apply the edit, run `node scripts/governance/run-executable-suites.mjs --suite <the suite named in section 12> --jobs 1`, and restore the file with `git show HEAD:<path> > <path>` (or the backup).

**NC1** — `database/supabase/migrations/262_support_tickets_privacy_open_request_unique.sql`

```diff
- CREATE UNIQUE INDEX support_tickets_privacy_open_request_uidx
+ CREATE INDEX support_tickets_privacy_open_request_uidx
```

**NC2** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
- if (sqlState === UNIQUE_VIOLATION) {
+ if (false as boolean && sqlState === UNIQUE_VIOLATION) {
```

**NC3a** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
- .eq('requester_user_id', buyerAccountId)
+ .not('requester_user_id', 'is', null)
  .eq('requester_type', 'customer')
```

**NC3b** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
          .select(PRIVACY_REQUEST_COLUMNS)
-         .eq('requester_user_id', buyerAccountId)
+         .not('requester_user_id', 'is', null)
```

**NC3c** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
  .select(PRIVACY_REQUEST_COLUMNS)
- .eq('requester_user_id', buyerAccountId)
+ .eq('requester_user_id', c.req.query('buyer_account_id') ?? buyerAccountId)
  .eq('requester_type', 'customer')
```

**NC3d** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
          .select(PRIVACY_REQUEST_COLUMNS)
-         .eq('requester_user_id', buyerAccountId)
+         .eq('requester_user_id', c.req.query('buyer_account_id') ?? buyerAccountId)
```

**NC4** — `services/api-gateway/src/routes/storefront/buyer-privacy-routes.ts`

```diff
- return outcome && KNOWN_FULFILLMENT_OUTCOMES.has(outcome) ? 'fulfilled' : 'closed_no_fulfillment';
+ return 'fulfilled';
```

**NC5** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
      .select(PRIVACY_REQUEST_COLUMNS)
-     .eq('requester_user_id', buyerAccountId)
+     .not('requester_user_id', 'is', null)
```

**NC5b** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
- .eq('metadata->>privacy_request_type', type)
+ (line removed)
```

**NC5c** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
- .not('status', 'in', '(resolved,closed)')
+ (line removed)
```

**NC6a** — `services/api-gateway/src/middleware/buyer-session.ts`

```diff
- if (!state.data || state.data.session_epoch !== resolved.sessionEpoch) {
+ if (!state.data) {
```

**NC6b** — `services/api-gateway/src/middleware/buyer-session.ts`

```diff
- if (state.data.status !== 'active') {
+ if (false) {
```

**NC7** — `services/api-gateway/src/routes/employee.ts`

```diff
- .eq('site_id', employee.store_id)
+ .is('site_id', null)
```

**NC7b** — `services/api-gateway/src/routes/employee.ts`

```diff
- .eq('site_id', employee.store_id)
+ .filter('site_id', 'is', null)
```

**NC8** — `services/api-gateway/src/routes/operations/support.ts`

```diff
- metadata: { ...recordValue(ticket.metadata), escalation: body.metadata },
+ metadata: { ...recordValue(ticket.metadata), ...body.metadata },
```

**NC9** — `services/api-gateway/src/routes/storefront/buyer-privacy-routes.ts`

```diff
- if (payload.notes !== undefined && typeof payload.notes !== 'string') {
+ if (false) {
```

**NC10** — `services/api-gateway/src/routes/storefront/buyer-privacy-routes.ts`

```diff
- const existing = await findOpenRequest(c, session.buyerAccountId, type as PrivacyRequestType);
+ const existing = await findOpenRequest(c, typeof payload.buyer_account_id === 'string' ? payload.buyer_account_id : session.buyerAccountId, type as PrivacyRequestType);
```

```diff
- await createRequest(c, session.buyerAccountId, type as PrivacyRequestType, rawNotes || null);
+ await createRequest(c, typeof payload.buyer_account_id === 'string' ? payload.buyer_account_id : session.buyerAccountId, type as PrivacyRequestType, rawNotes || null);
```

**NC11** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
  .eq('id', ticketId)
- .eq('requester_user_id', buyerAccountId)
+ .not('requester_user_id', 'is', null)
```

**NC11b** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
  .eq('id', ticketId)
- .eq('requester_user_id', buyerAccountId)
+ .eq('requester_user_id', c.req.query('buyer_account_id') ?? buyerAccountId)
```

**NC12** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
- .eq('visibility', 'public')
+ (line removed)
```

**NC13** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
- .eq('requester_user_id', buyerAccountId)
+ .eq('requester_user_id', c.req.query('buyer_account_id') ?? buyerAccountId)
  .eq('requester_type', 'customer')
```

**NC14** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
      .eq('topic', 'privacy')
-     .eq('metadata->>privacy_request_type', type)
      .not('status', 'in', '(resolved,closed)')
```

**NC15** — `services/api-gateway/src/routes/storefront/buyer-realm-wiring.ts`

```diff
      .eq('metadata->>privacy_request_type', type)
-     .not('status', 'in', '(resolved,closed)')
      .is('deleted_at', null)
```

**NC16** — `packages/shared-types/src/index.ts`

```diff
- export const SupportTicketTopicSchema = z.enum(['billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general']);
+ export const SupportTicketTopicSchema = z.enum(['billing', 'technical', 'abuse', 'onboarding', 'payments', 'orders', 'themes', 'apps', 'general', 'privacy']);
```

