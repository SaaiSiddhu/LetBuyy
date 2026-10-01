# Phase 2 — Bounded Security Acceptance (Mandate 5)

Branch `letbuyy/phase2-shared-buyer-identity`, HEAD `75f672d6` at the time of this pass (2026-09-28,
~00:00–01:30 IST). This is an **independent, skeptical re-audit** of the four security-sensitive
commits from the prior pass — `b9078bd9`, `f85eda37`, `d59ebd24`, `a0321641` — performed from a
fresh read of the actual diffs and the actual current source, not by re-citing the prior pass's own
evidence. Every claim below is either a direct code citation, a command run in this pass, or an
explicit statement that something was reasoned about but not independently re-executed.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

---

## 1. Commits reviewed

| Commit | Subject | Files |
|---|---|---|
| `b9078bd9` | privacy status truthfulness, real idempotency atomicity, cross-realm ticket leak | 6 files, +398/−49 |
| `f85eda37` | link staff to a VERIFIED account only, honest duplicate-email handling | 2 files, +200/−1 |
| `d59ebd24` | two real staff-permission defects (permissions dropped on create; write-implies-read) | 3 files, +65/−9 |
| `a0321641` | `GET /products/:id` no longer 500s and recognizes staff, not just owner | 5 files, +90/−19 |

`git diff --stat a0321641..75f672d6` shows only `docs/LOCAL_DEV.md` and one evidence file changed
after `a0321641` — the four commits above are the entirety of the security-relevant surface between
the previous mandate's start and HEAD.

---

## 2. §5 — Staff identity linking (`f85eda37`), reviewed against 11 properties

Reviewed the **current** `POST /employees` handler ([employee.ts:205-289](../../../services/api-gateway/src/routes/employee.ts)),
not just the diff, plus every route that can write `users_custom.email_verified` anywhere in the
repository (found by grep across `services/`, `apps/`, `packages/`, then read in full).

| # | Property | Verdict | Evidence |
|---|---|---|---|
| 1 | Owner authorization | **HOLDS** | Line 216: `verifySiteOwnership(db, createPlan.value.store_id, customUser.id, ...)` gates the entire route — not `assertStaffPermission`. No staff grant satisfies this call. |
| 2 | Email normalization matches canonical rules | **HOLDS** | `planEmployeeStaffCreate` calls `normalizeAuthEmail(body.email)` (`packages/auth-core/src/index.ts:1574`) — the identical function `planCustomUserEnsure` uses for `users_custom.email` (`:1497`). Both sides of the lookup are normalized the same way. |
| 3 | Only the intended canonical account linked | **HOLDS** | `users_custom_email_key UNIQUE (email)` is a real Postgres constraint (confirmed via `\d users_custom` against the local Supabase instance) — a second matching row is structurally impossible, not just handled defensively. |
| 4 | Verification status from authoritative server data | **HOLDS — independently traced, not assumed** | See §2a below: the full chain from signup to `email_verified=true` was read end-to-end, not inferred from the accept-invite UI text alone. |
| 5 | Caller-supplied `user_id` cannot override | **HOLDS** | `insertValue` is built as `{...createPlan.value, user_id: matchedUser.id, status: 'active'}` — `matchedUser.id` comes only from the server-side `users_custom` lookup; `createPlan.value` is an explicit allowlist ([auth-core/src/index.ts:1595-1604](../../../packages/auth-core/src/index.ts)) with no `user_id` field ever copied from the request body. |
| 6 | Duplicates deterministic/honest | **HOLDS** | `employees.email` is unique platform-wide; the route catches `23505` and returns a clean `409 EMPLOYEE_ALREADY_EXISTS` with no constraint text or email echoed back (tested, `employee-create-identity-link.test.ts`). |
| 7 | Another store cannot hijack an existing membership | **HOLDS** | Because `employees.email` is unique **platform-wide**, a second store attempting to add an email already staffed anywhere hits the same `23505` path and is refused with a 409 — it cannot create a second `employees` row for that email, so there is no row to hijack into. |
| 8 | Unverified/unknown identities cannot become active accidentally | **HOLDS** | Tested directly: an unverified match stays `user_id: null, status: 'invited'`. |
| 9 | Inactive/removed identities follow accepted policy | **VACUOUS, not a gap** | `users_custom` has no `deleted_at`/`is_active`/`status` column at all (confirmed via `\d users_custom` against the baseline schema) — there is no "deactivated identity" concept at this layer to bypass. |
| 10 | Email changes don't silently transfer membership | **HOLDS** | `employees.email` is a copy taken at creation, never re-derived from `users_custom.email`; `employees.user_id` is set once, at creation, and no code path re-runs the matching logic afterward (`PATCH /employees/:id` only ever touches `role`/`permissions`, confirmed by reading `planEmployeeUpdate`). |
| 11 | Staff cannot create/upgrade their own membership | **HOLDS** | Both `POST /employees` (create) and `PATCH /employees/:id` (role/permission changes, via `verifyEmployeeOwnership` → `verifySiteOwnership`) are gated on real site ownership, never on a staff permission grant. |

### 2a. The verification trust chain, traced independently (not re-citing the UI text)

Mandate 5 explicitly warned that the accept-invite page's UI text should not be the sole security
authority. It was **not** treated as one here — the actual write path for `email_verified` was
traced instead:

- The only call site of `planCustomUserEnsure` (the function that can set `email_verified` from a
  caller-supplied value) is `POST /custom/users/ensure` ([auth.ts:749](../../../services/api-gateway/src/routes/auth.ts)),
  gated by `requireAccountsInternal` → `verifyInternalAppRequest(c, 'accounts')` — a signed
  internal-service call, not reachable from a browser.
- Its only real caller, `identity-platform`'s `POST /api/auth/signup`, sends **only** `{email}` —
  never `email_verified` — so every newly created account starts `email_verified: false`
  (`Boolean(undefined)`).
- The only route that flips it to `true` is a **separate** endpoint, `POST /custom/users/verify-email`
  ([auth.ts:809](../../../services/api-gateway/src/routes/auth.ts)), which does not read any
  `email_verified` value from its body at all — it unconditionally sets `true` for the given
  `user_id`/`email`. It is called from exactly two places in `identity-platform`:
  `verify/route.ts` (email-verify link **or** magic link) and `verify-otp/route.ts` — both **only
  after** `validateToken()` (a real, single-use, expiring, emailed token) returns a positive result.
- The one other reference to `custom/users/ensure` outside these two files is a documentation
  string in the **frozen** `developer-portal` (`reference.ts`) listing route names for a reference
  card — not a caller.

**Conclusion:** `email_verified` is not forgeable through any path this pass could find. It is
gated by the same real, already-relied-upon platform verification event (a clicked email link or
entered OTP) that gates buyer/merchant login elsewhere in the codebase — `f85eda37` correctly
*delegates* to an existing trust anchor rather than inventing a new, weaker one. One architectural
fact worth naming precisely, not a defect: the trust boundary for `verify-email` is "holds the
gateway's internal signing secret," the same shared-secret internal-RPC model used throughout this
codebase for service-to-service calls — this is consistent with the existing architecture, not a
new gap this pass introduces or should try to change.

**Minor, non-blocking observation:** the `users_custom` lookup in `employee.ts:243-247` discards
the `error` from `.maybeSingle()` — if it ever errored (impossible today given the unique
constraint, per property 3), the account would silently be treated as "no match" rather than
surfacing a `500`. Fails safe, but silently. Not fixed in this pass (no reproducible defect exists
to fix; noted for completeness, not raised as a finding requiring code changes).

---

## 3. §6 — Write-implies-read and permission parsing (`d59ebd24`)

Reviewed the current `staff-permission.ts`, `packages/auth-core/src/index.ts`'s permission-parsing
functions, `apps/merchant/web/src/lib/staff/roles.ts`'s role catalog, and — the specific concern
Mandate 5 raised — whether merchant-staff permissions could be confused with platform-operator
permissions.

- **One-way, same-resource-only:** `evaluateStaffPermission` computes `impliedByWrite` only when
  `requiredKey.endsWith(':read')`, and only checks it against the exact same resource prefix. A
  `:write` requirement is never satisfied by a `:read` grant (tested: `staff-permission.test.ts`,
  "the implication runs only one way").
- **No implied approve/delete/manage/export/operator authority:** the implication is textual
  (`<resource>:write` → `<resource>:read`), not a semantic escalation table — there is no code path
  where a `:write` grant on one resource implies anything about a *different* permission key, let
  alone an operator-realm one.
- **Malformed permission data fails closed:** `evaluateStaffPermission` returns `{allowed:false,
  reason:'no-grants'}` if `granted` is not a non-empty array; `parseStaffPermissions` rejects
  anything that is not exactly `{granted: [...]}` with only known permission-key strings.
- **Owner-only ops remain owner-only:** both `PATCH /employees/:id` (role/permission changes) and
  `POST /employees` (create) are gated by `verifySiteOwnership`/`verifyEmployeeOwnership`, never by
  `assertStaffPermission` — confirmed by reading the current route bodies, not the diff.
- **Wildcard behavior unchanged:** `g === '*'` and `g.endsWith(':*')` are untouched by this commit;
  the new `impliedByWrite` branch is a third, independent check, not a modification of the wildcard
  logic.
- **Merchant-staff permissions cannot be confused with platform-operator permissions — verified,
  not assumed:** `operations/support.ts`'s `requirePermission()` (used for the internal ops
  console) resolves scopes via `loadEffectivePermissionScopes(db, auth.user.id, auth.user.email)`
  in `middleware/rbac.ts` — a completely different function reading from a completely different
  data source than `employees.permissions`. `requireRoleCategory('ops')` resolves from
  `hasOpsAllowlistEntry(db, ...)`, an explicit operator allowlist table, and the file's own comment
  states the reasoning: *"never trust role claims carried on the JWT for category gating... resolved
  ONLY from server-side persistence."* There is no shared table, shared claim, or string-based
  crossover between the two systems — a merchant staff member's `products:write` grant cannot
  satisfy an operator's `support:view` scope check because they are resolved by unrelated queries
  against unrelated tables.

No defect found in this section.

---

## 4. §7 — Who can write `metadata.fulfillment_outcome`, traced exhaustively

Mandate 5 was explicit that a generic metadata-merge endpoint could be *worse* than no field at
all if it let any caller forge a "fulfilled" status. Rather than grep for the literal string
`fulfillment_outcome` (which only shows the type declaration and the read site), **every file that
touches the `support_tickets` table anywhere in the gateway** was read in full:

| File | Realm | Touches `support_tickets.metadata`? |
|---|---|---|
| `routes/employee.ts` | merchant staff | Read-only (`GET /tickets`); no write. |
| `routes/internal-console.ts` | platform operator | Read-only (merchant detail dashboard); no write. |
| `routes/operations/support.ts` | platform **superadmin only** (`router.use('*', requireRoleCategory('ops'), requireSuperAdmin)`) | Writes `metadata` only on ticket **create** (a brand-new operator-authored ticket) and on **escalate**, where the caller's metadata is nested under `metadata.escalation`, never merged at the top level (`{...recordValue(ticket.metadata), escalation: body.metadata}`). The **resolve** route — the one that sets `status:'resolved'` — does **not** touch `metadata` at all. |
| `routes/storefront/buyer-realm-wiring.ts` (buyer support routes) | buyer | `openTicket`/`addRequesterMessage` never accept a `topic` or `metadata` field from the caller at all — both are absent from their insert allowlists. |
| `routes/storefront/buyer-realm-wiring.ts` (buyer privacy routes) | buyer | The only writer sets `metadata: {privacy_request_type: type}` — a literal, from a value already validated against a two-item enum. No caller-supplied object is ever spread into it. |

**Conclusion, stronger than the commit's own claim:** it is not merely true that "nothing writes
[`fulfillment_outcome`] today" — **no caller of any kind (buyer, merchant staff, or platform
operator) has a code path capable of writing it**, even indirectly through a generic metadata
merge, even today. The field is reserved and inert, not reserved-but-forgeable. A platform
superadmin *could*, when manually creating a brand-new ticket via the internal ops console, insert
one with a fabricated history (`topic:'privacy', requester_user_id:<any uuid>,
metadata:{fulfillment_outcome:'fulfilled'}`) — noted for completeness, but this does not meaningfully
expand what a compromised or malicious superadmin (the most trusted principal in the system, with
direct database access available through other means) could already do, so it is not raised as a
blocking finding.

Given this, the field's current shape (present in the type, unreachable in practice) is a
reasonable forward-compatible placeholder for D05's eventual fulfillment-execution decision, not a
security hole to close by removing it.

---

## 5. §8 — Real concurrency proof (new evidence this pass)

The prior pass's idempotency proof had two forms: a fake-PostgREST behavioral test, and a raw
`docker exec psql` two-connection race directly against Postgres (bypassing the route entirely).
Mandate 5 asked for the missing middle: **real HTTP requests, through the real route handler, over
real network calls to real Postgres.**

Built and ran a one-off test (`_tmp-concurrency-real-db.test.ts`, deleted after use — see §9 below
for why it was not kept) that:

1. Seeded a synthetic `buyer_accounts` row (`c0ffee00-0000-4000-8000-000000000001`) directly in the
   owned local Supabase instance.
2. Mounted the **real, unmodified** `registerBuyerRealmRoutes` (from `buyer-realm-wiring.ts`) —
   not a re-implementation — onto a fresh Hono app, pointed at `SUPABASE_URL=http://localhost:55321`
   (the real local Kong/PostgREST) with the real local service-role key read from `.dev.vars`.
3. Signed two real, distinct, valid buyer-session JWTs for the same buyer and fired both `POST
   /storefront/buyer/privacy-requests {type:'access'}` requests via `Promise.all`, so both were
   genuinely in flight (including their real `fetch` calls to real PostgREST) before either had
   committed.

**Result:**
```
RAW A: 200 {"success":true,"data":{"id":"77ed32b1-...","status":"received", ...}}
RAW B: 201 {"success":true,"data":{"id":"77ed32b1-...","status":"received", ...}}
ROWS IN REAL POSTGRES FOR THIS (buyer, type): [{"id":"77ed32b1-..."}]
```
One `200` (the request whose insert lost the race, caught `23505`, and re-read the winning row),
one `201` (the genuine insert), **identical ticket id in both responses**, and an independent direct
Postgres query confirming exactly one row exists for that `(buyer, type)` pair. Migration 262's
partial unique index closes the race under real concurrency, not merely under a hand-written mock's
semantics.

Cleanup confirmed: the synthetic `support_tickets` and `buyer_accounts` rows were deleted
immediately after (`docker exec psql`, 1 row each), the temporary test file was removed, and
`git status --porcelain` was re-checked to show only the pre-existing
`apps/merchant/mobile/analysis_options.yaml` modification.

**Decision on why this was not kept as a permanent test:** every other test in
`services/api-gateway/src/__tests__/` runs against a fake PostgREST and therefore requires no live
database — that is what lets `pnpm test:unit`/the gate run in any environment, including CI, without
a Supabase stack. Committing a test that silently requires a live local Postgres on port `55321`
would either fail in any environment without one, or (worse) silently pass-through/skip in a way
that looks like coverage but is not. Verifying once, with full evidence captured here, and leaving
the fake-PostgREST test as the permanent regression guard is the more honest choice; a properly
env-gated permanent version is a reasonable future addition but was not built in this bounded pass.

> **Superseded (2026-10-01, P2-PRIVACY-CONCURRENCY-DB).** The "reasonable future addition" now exists, and not env-gated: the owned
> database lane (`P2_HERMETIC_GATEWAY_DB_ACCEPTANCE.md`) removed the reason this proof could not be kept, and the one-off above (which
> read `.dev.vars` and wrote to the restored stack) is replaced by `owned-db/buyer-privacy-intake.postgres.test.ts`, which drives the real
> worker against a disposable database and races the INSERTs deterministically — 6, 12 and 8 racers, with a barrier that makes the
> unique-violation path run every time — plus the direct database invariant, ownership, truthful status and negative controls.
> See `P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md`. The text above is left as the record of its moment.

---

## 6. §9 — Revocation evidence: re-validated, not re-run

Re-read `PHASE2_CONTINUATION_2.md` §4 ("Real provisioning, then real existing-session revocation")
against Mandate 5's seven required facts. All seven are present and precisely worded in the
existing evidence:

| Required fact | Present? |
|---|---|
| Session issued before revocation | Yes — staff session established in step B, revocation in step E.1–2 |
| Owner action from independent auth state | Yes — explicit out-of-band `curl` session, "the browser's own cookie jar was never touched" |
| Same session denied after | Yes — step E.3, same tab, immediate `404` |
| No re-login before that denial | Yes — explicit: "without any navigation, refresh, or re-login since before step 1" |
| Second route also denied | Yes — step E.4, a different route also `404` |
| Separate re-login check | Yes — step E.6, explicitly labeled "a distinct check from step 3, not a substitute for it" |
| Owner unaffected | Yes — step E.5 |

The existing text already distinguishes the Turnstile/anti-bot dev-bypass from any authorization
bypass precisely: *"the standard local dev-auth-bypass literal... not a bypass of any control that
exists in a real environment"* — the password itself was verified with real bcrypt in every case;
only the bot-detection step (which does not run in local dev at all) was substituted. It does not
claim "production-equivalent" anywhere. **No defect found; the browser journey was not repeated**,
per Mandate 5's own instruction not to re-run sufficient evidence.

---

## 7. §10 — Cross-account/cross-store matrix

Rather than build a redundant parallel matrix, the existing test suite was inventoried and
confirmed to already cover every Phase-2-touched route, cross-checked against the fresh gate run
(§8 of this document; `test:unit:gateway` exit `0`, all green):

| Route | Cross-tenant coverage |
|---|---|
| `GET /stores/handle/:handle` | `staff-store-access.test.ts` — owner, staff, stranger |
| `GET /products` (list) | `staff-store-access.test.ts` — granted staff, ungranted staff, cross-site staff |
| `GET /products/:id` | `staff-store-access.test.ts` — owner, granted staff, ungranted staff, staff at a **different** site, stranger (all four non-owner cases return the identical 404) |
| `POST /employees` | `employee-create-identity-link.test.ts` — verified match, unverified match, no match, duplicate |
| `PATCH`/`DELETE /employees/:id` | `staff-store-access.test.ts` — owner succeeds scoped by `store_id`, non-owner forbidden before any write |
| `GET /employees/tickets` | `employee-tickets-tenant-scope.test.ts` — own store only, never another store's, never the platform-level privacy ticket, no-employee-row caller refused |
| Buyer privacy intake/readback | `buyer-privacy-routes.test.ts` — session-buyer-only scoping, explicit "another buyer cannot read a stranger's privacy requests" test |
| Operator moderation | `operator-moderation-auth-chain.test.ts`, `operator-scoped-admin-client-contract.test.ts` (pre-existing, unrelated to Phase 2, confirmed still green) |

This, combined with the direct source-level auth-gate tracing in §§2–4 above (reading the actual
authorization check in each handler, not only trusting its test), is judged to satisfy Mandate 5's
"compact matrix" requirement without constructing a separate, redundant harness.

---

## 8. §11 — Operator/console findings: language precision and the mail-adapter question

- **TOTP is genuinely per-principal in production**, confirmed by re-reading
  `console-mfa.ts`'s `parsePerPrincipalTotpSecrets()` — it parses `PLATFORM_CONSOLE_TOTP_SECRETS`
  (plural, JSON/CSV keyed by normalized email). The singular `PLATFORM_CONSOLE_TOTP_SECRET` fallback
  only activates when `!isProductionConsoleRuntime()`. This is a source-code fact
  (`CURRENT_IMPLEMENTATION`), not a claim about any hosted deployment — no hosted console was
  reached in this pass or any prior one.
- **The console login route cannot complete in production today**, confirmed by re-reading
  `apps/internal/console/src/app/api/console-auth/login/route.ts`: it explicitly returns
  `redirectWithError(request, 'magic_link_delivery_not_configured')` when `process.env.NODE_ENV ===
  'production'`. This is an honest failure state, not a silent stub.
- **A canonical, reusable mail adapter already exists** — `packages/infrastructure/resend-adapter`
  (`sendResendEmail`/`getResendClient`), explicitly designed for multiple independently-scoped API
  keys (its own comment names `DEMO_RESEND_API_KEY` and `CONTACT_RESEND_API_KEY` as existing
  callers), and throws a clear error rather than failing silently when unconfigured. **This pass did
  not wire the console's magic-link route to it** — doing so would require choosing a sender
  address and an operational policy (who receives delivery failures, what the email copy says),
  which is exactly the kind of policy decision Mandate 5 reserves for the owner (see D04 item 8 in
  `PHASE2_DECISIONS.md`). The finding here is narrow and factual: **the missing piece is wiring +
  activation, not a missing adapter** — no new adapter needs to be built.
- No local capture-transport test was built for this pass, for the same reason: it would require
  first deciding the console's own sender identity, which is not this pass's decision to make.

---

## 9. §15 — Gate accounting (fresh run, not copied)

Full gate run captured this pass at `sha=a0321641` (`.claude/skills/letbuyy/scripts/gate.sh --full`,
log directory `letbuyy_phase2-shared-buyer-identity-a0321641-20260928-000738`); `a0321641..75f672d6`
is confirmed docs-only (`docs/LOCAL_DEV.md` + one evidence file), so this run's results apply
unchanged to HEAD.

```
failed=5 (of 26 gate steps)
  lint                                     exit=1
  validators:sweep (113/114 pass)          exit=1  — stale-artifact only
  ui:validate                              exit=1
  tests:all                                exit=1  — not ok 5 (+519 more)
  test:@letbuyy/merchant-web               exit=1  — not ok 4 (+35 more)
```

**The full gate remains red — this is not a "fully clean" pass.** Per-lane attribution, with an
explicit statement of how much of each lane was actually inspected (not just the first failure):

| Lane | Attribution | How much was checked |
|---|---|---|
| `validators:sweep` | Deterministic, self-attributing. The repo's own `tests/governance/ambient-red-attribution.test.mjs` classifies every `stale-artifact-validator` offender against the orchestrator's cleanup plan; that lane (`tests:governance`) is green in this same run, which — per the repo's own documented mechanism — means the red is the standalone-invocation method itself, not a real offender. | Fully attributed by the repo's own tooling, not by this pass's judgment. |
| `lint` | `@letbuyy/customer-web` is the only failing app lint task; Phase 2 touches zero files under `apps/commerce/web` (confirmed: all four reviewed commits touch only `services/`, `packages/auth-core`, `database/supabase/migrations`, and gateway tests). | Confirmed via `git diff --stat` across all four commits — no ambiguity; this lane cannot be Phase-2-attributable by definition of what Phase 2 touched. |
| `ui:validate` | The one failure is `tests/components/foundation.test.tsx`'s UI-kit smoke test (`TestingLibraryElementError: Unable to find an accessible element with the role "button" and name "Open"`) inside `packages/typescript/ui` — a demo Table/Pagination composition. Phase 2 touches zero files under `packages/typescript/ui`. | The single failure's full error text was read directly (not inferred); it has no relationship to auth, tenancy, staff permissions, or privacy — the properties Phase 2 changed. |
| `test:@letbuyy/merchant-web` | Read **24 of the 36 failing test results directly** (not just the first). Every one shares the **identical** root cause: `ENOENT: ... open '.../apps//apps/merchant-control-plane/src/...'` — a stale, pre-APPID-P1-rename path (`apps/merchant-control-plane` was renamed to `apps/merchant_web`, then to `apps/merchant/web`, per this repo's own Canonical Runtime Map) baked into `theme-editor-aa.test.mjs`'s own path construction. This is unrelated to anything Phase 2 changed (staff permissions, privacy routes, product ownership). | 24 of 36 failures read directly and confirmed identical cause; the remaining ~12 were not individually read — **this pass does not claim all 36 share this cause**, only that the ones inspected (two-thirds of the lane) do, and none of the four Phase 2 commits touch theme-editor files or app-path references. |
| `tests:all` | First failure (`not ok 5`, "WS12 G6 migrated REST endpoints remain the external source of truth for parity reads") matches, by name and position, the identical first failure reproduced against the `develop` merge-base (`130b669d`) in a temporary worktree in the prior pass. **This pass did not re-run that worktree reproduction** (Mandate 5: "do not redo expensive baseline work already adequately evidenced") and did not read the other ~519 failures individually. | **Explicit limitation, per Mandate 5's own warning: matching one named failure does not classify every failure in this lane.** The `tests:all` red is evidenced for its first failure only; the other 519 are unattributed by this pass. |

**Net honest statement:** three of the five red lanes (`validators:sweep`, `lint`, `ui:validate`)
are attributed with high confidence by direct inspection of what actually fails and by what Phase 2
did and did not touch. `test:@letbuyy/merchant-web` is attributed with high confidence for the
majority of its failures by direct root-cause inspection. `tests:all` remains attributed only for
one representative failure — this is the one lane where Mandate 5's caution most clearly applies,
and it is stated as such rather than smoothed over.

---

## 10. §16 — Local environment and working tree

- Working tree: `apps/merchant/mobile/analysis_options.yaml` is the only modification, unchanged
  from the checkpoint stated at the start of this mandate — not touched by this pass.
- No secrets were regenerated; `.dev.vars`/`.env.local` files were read (to obtain the already-known
  local demo `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`) but never modified.
- The one-off concurrency probe (§5 above) created and then fully deleted synthetic rows in the
  owned local Supabase instance (`supabase_db_letbuyy-newmac-20260926`); no other database state was
  touched.
- Worktrees: `git worktree list` shows exactly the expected four (primary `[develop]` at `130b669d`,
  `agrimate-branding-cleanup`, `phase1r-firebase-free-marketplace`, this phase) — no new worktree
  created, none removed.
- No `.letbuyy/gate/` log outside the standard location was created; no log content included a
  secret value (verified by reading the logs directly — the service-role key never appears in any
  gate output because gate commands do not print `.dev.vars` contents).

---

## 11. Limitations of this pass (stated explicitly, per Mandate 5 §17)

- `tests:all`'s ~519 non-first failures were not individually attributed (see §9 table above).
- `test:@letbuyy/merchant-web`'s remaining ~12 failures (of 36) beyond the 24 directly inspected
  were not individually read, though every one inspected shares one identical, clearly
  Phase-2-unrelated cause.
- No hosted/production console, identity-platform, or gateway deployment was reached — every
  production-mode claim in §11 above is a **source-code** fact (`CURRENT_IMPLEMENTATION`), not a
  live-environment observation.
- The real-Postgres concurrency test (§5) was run once, manually, and deleted; it is not part of the
  permanent, repeatable suite.
- No new code defect was found in §§2–4, §6, §7 of this document — this pass's independent
  re-verification **confirms** the prior pass's fixes rather than finding new ones. Per Mandate 5
  §17 ("a review does not need to produce code changes to be useful"), no code was changed in this
  pass; the value delivered is independent verification depth (the `email_verified` trust-chain
  trace, the exhaustive `support_tickets` writer audit, and the real-Postgres concurrency proof)
  that the prior pass's own self-verification could not provide.
