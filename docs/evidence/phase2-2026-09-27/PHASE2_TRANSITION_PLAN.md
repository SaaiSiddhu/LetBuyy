# Phase 2 — Transition Plan (Mandate 6)

Companion to `PHASE2_DECISIONS.md`. This document is the concrete **implementation plan** for
whichever D03/D04/D05 options the owner approves — it does not itself constitute approval, and no
slice below has been executed except where explicitly marked "already done, this pass." Every
slice is **local only**; none proposes a staging or production activation step. Hosted cutover is
out of scope for this entire document, not merely deferred.

---

## D03 — Merchant-staff identity transition (if Option A is approved)

### Slice 1 — Reconciliation (already done, this pass)

- **What:** `reconcileMerchantStaffIdentities` + `identity-reconciliation-dry-run.ts`.
- **Status:** IMPLEMENTED, LOCAL VERIFIED. 12 synthetic-fixture tests; one real read-only run
  against the owned local Postgres.
- **Dependencies:** none.
- **Acceptance criteria (met):** every named ambiguous case (duplicate identity, multi-membership,
  revoked membership, missing canonical account, conflicting role, cross-tenant membership) produces
  a distinct, correctly-counted finding; rerun is idempotent; no raw PII appears in any finding.

### Slice 2 — Principal repository implementation

- **What:** replace `createDormantPrincipalRepository()`'s `null`-returning stub with a real
  implementation reading/writing the already-existing `principals` table (22 tables total,
  currently zero rows).
- **Dependencies:** Slice 1 (done). Genuinely new code: the repository class itself.
- **Acceptance criteria:** a principal created for a synthetic `employees` row round-trips
  (`create` → `findById` → matches input); a principal is never created for a row already flagged
  `revoked_membership` or `conflicting_role_mapping` by Slice 1's reconciliation without an explicit
  resolution recorded first.
- **Compatibility:** purely additive — writes to new, currently-unused tables; `employees` and
  `staff-permission.ts` are not touched or read from by this slice.
- **Rollback:** `TRUNCATE principals` (and the tables it wrote); no legacy table is ever touched, so
  rollback here is unconditionally safe.

### Slice 3 — Backfill run (dry-run first, then a real local run)

- **What:** run `planPrincipalBackfill`/`planOrgGraphBackfill` (via the Slice-1 adapter) against a
  **copy** of the local `employees` table, writing through Slice 2's repository.
- **Dependencies:** Slice 2.
- **Acceptance criteria:** every row Slice 1 flagged `revoked_membership` is excluded from the
  backfill, not silently included as active; every `multiple_site_memberships` case produces
  multiple distinct membership edges, never collapsed to one; the backfill is re-runnable
  (idempotency key per row) without producing duplicates on a second run.
- **Rollback:** the backfill writes only to new tables (`writesLegacyTables: false` is a type-level
  guarantee already in `migration-scaffold.ts`, not merely a runtime check) — rolling back means
  truncating those tables; `employees` is never written.

### Slice 4 — Shadow evaluation

- **What:** for every real authorization decision `staff-permission.ts` makes, ALSO compute the
  answer the new principal/permission model would give (using Slice 2/3's data), log both, alert on
  divergence. **The new model's answer never affects the real response in this slice** —
  `staff-permission.ts` remains the sole enforced path.
- **Dependencies:** Slices 2-3.
- **Acceptance criteria:** zero unexplained divergences over a sustained local test period (exact
  duration/volume is an owner call, not fixed here); every divergence is individually classified
  (a genuine model gap vs. a reconciliation edge case vs. a timing artifact) before being dismissed.
- **Rollback:** shadow evaluation is read-only against the new model; disabling it is a one-line
  config change with no data implication.

### Slice 5 — Local cutover (only after Slice 4 passes)

- **What:** `staff-permission.ts` reads from the new model, with the old `employees`-based check
  retained as an immediate automatic fallback on any error from the new path (fail toward the
  already-verified mechanism, never fail open).
- **Dependencies:** Slice 4's equivalence criteria met.
- **Acceptance criteria:** the exact same grant/revocation test matrix already proven in
  `SECURITY_ACCEPTANCE.md` §9 (existing-session revocation) passes again, unchanged, against the new
  path.
- **Rollback:** a single feature-flag flip back to the `employees`-based path; both code paths
  coexist until this slice is independently re-verified and only then is the old path scheduled for
  removal — never in the same change.

**Nothing beyond Slice 1 is executed by this document.** Slices 2-5 are the plan Option A commits
to, not work already done.

---

## D04 — Operator access (if the role-tier proposal is approved)

### Slice 1 — Delivery boundary (already done, this pass)

- **What:** `console-magic-link-delivery.ts` (interface + capture adapter + fail-closed contract).
- **Status:** IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE.
- **Dependencies:** none.

### Slice 2 — Role tier enforcement in `operations/support.ts`

- **What:** replace the current single `requireSuperAdmin` gate (every route) with the approved
  Reviewer/Moderator/Administrator tiers from `PHASE2_DECISIONS.md`'s table, backed by a new column
  or table recording each operator's tier (extending `super_admin_allowlist`, not replacing it).
- **Dependencies:** D04 decisions 1-2 answered.
- **Acceptance criteria:** a synthetic Reviewer identity can call every `support:view`-gated route
  and is denied every `support:reply`/`support:manage` route; a synthetic Moderator is denied
  Administrator-only routes (macro management); an existing session for a since-downgraded operator
  is denied the higher tier's routes on its very next request (matching the already-proven
  fresh-per-request pattern, not a new caching layer).
- **Rollback:** the tier column is additive; reverting to "every allowlisted operator is
  equivalent" is a one-line change back to the current `requireSuperAdmin`-only gate.

### Slice 3 — Bootstrap and recovery

- **What:** an explicit, owner-approved bootstrap path for the first operator in a fresh
  environment (never a public self-registration endpoint, never default credentials); an explicit
  recovery mechanism for a locked-out operator, per D04 decision 4's answer.
- **Dependencies:** D04 decisions 3-4 answered. **This slice does not proceed without those
  answers** — no bootstrap/recovery authority is invented in their absence.

### Slice 4 — Delivery activation (if D04.8 is answered)

- **What:** implement a real `ConsoleMagicLinkDeliveryAdapter` calling
  `packages/infrastructure/resend-adapter`'s `sendResendEmail`, using the sender address and
  delivery-failure ownership the owner names.
- **Dependencies:** D04 decision 8 (sender address, ownership) answered. Provider credentials
  (a real `RESEND_API_KEY` scoped for console use) are a **separate, later, owner-controlled**
  configuration step — not part of this slice, which only wires the adapter shape.
- **Acceptance criteria:** with a local capture adapter substituted for the real one (matching
  Slice 1's pattern), a full login → magic-link → callback journey completes locally with no
  external message sent; the real adapter is exercised only in an environment the owner has
  configured with real credentials, never as part of this repository's own test suite.

### Slice 5 — Single-use token enforcement (if prioritized)

- **What:** add a `jti` claim to the magic-link token and a small `consumed_magic_link_tokens` (or
  equivalent) table checked at verification time, closing the gap
  `platform-magic-link.test.ts` characterizes.
- **Dependencies:** none blocking, but genuinely new schema + a decision on where "consumed" state
  lives (a new table vs. reusing an existing one) — an implementation choice, not a policy one, so
  this slice can proceed independently of D04's other items once prioritized.

---

## D05 — Buyer export (if the initial scope is approved)

### Slice 1 — Field contract (already done, this pass)

- **What:** `buyer-export-contract.ts` + 11 tests.
- **Status:** IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE (`BUYER_EXPORT_GENERATION_AVAILABLE = false`).

### Slice 2 — Real data-source wiring (read-only)

- **What:** replace the synthetic `SyntheticSourceData` input with real, ownership-scoped queries
  against `buyer_accounts`/`buyer_addresses`/`support_tickets`/`ticket_messages`/`buyer_order_links`
  — each query using exactly the `ownershipPredicate` already named in the contract, never a
  broader read.
- **Dependencies:** D05 decision 1 (scope) answered.
- **Acceptance criteria:** Buyer A's real, owned rows are the only rows returned for Buyer A,
  verified with at least two synthetic buyer identities sharing the same underlying tables (matching
  the existing test's structure, now against real Postgres); credentials/security-material columns
  are absent regardless of what the underlying query happens to select (the contract's
  `transformation: 'omitted'` fields are dropped in application code, never relied on to be excluded
  by the query alone — defense in depth).

### Slice 3 — Requester verification and release design

- **What:** whatever step-up/re-authentication D05 decision 2 specifies; whatever
  signed-URL/expiry/password design D05 decision 3 specifies.
- **Dependencies:** decisions 2-3 answered. **Still not exposed to any real user without an explicit
  route being added** — Slices 1-2 remain a backend capability, not a product feature, until this
  slice's design is itself accepted.

### Slice 4 — Route exposure (last, and only with explicit sign-off)

- **What:** a real `POST`/`GET` route a buyer can call, wired to Slices 2-3.
- **Dependencies:** everything above, plus explicit confirmation that generating a real export for
  a real buyer is now an intended, owner-approved action — this is the one slice in this entire
  document that turns a backend capability into something a real person can trigger, and is treated
  with correspondingly higher scrutiny than every slice before it.
- **Acceptance criteria (drawn directly from Mandate 6 §13):** Buyer A receives only A's data;
  Buyer B cannot access A's export; a revoked/expired session cannot retrieve a generated artifact;
  a request ID cannot be used to bypass ownership; internal ticket notes are absent; order data
  follows `buyer_order_links` exactly; credentials are absent; a partially-generated export is never
  reported as a success; expiry/download controls match the approved Slice-3 design.

**Deletion/retention (D05 decisions 4-8) is entirely out of this document's scope** — it is a
separate, later transition plan of its own, once those decisions exist to plan against.

---

## Local vs. hosted boundary (applies to every slice above)

Every slice above runs against the owned local Supabase instance
(`supabase_db_letbuyy-newmac-20260926`) or synthetic in-memory fixtures. None requires, proposes, or
should be read as implying:

- a staging or production deploy of any kind;
- flipping any feature flag outside a local environment;
- a real email/SMS send to any real address;
- activation of `packages/infrastructure/resend-adapter` against a live `RESEND_API_KEY`;
- any change to `production-deploy.yml`/`deploy-staging.yml` (both remain `workflow_dispatch`-only,
  unchanged, per D-DEPLOY).

A hosted cutover for any slice above is a **separate decision**, made after its local slices are
complete and independently re-verified, and always requires the owner's explicit word in the same
message as any push to `staging`/`main`, per the operating skill's standing rule.
