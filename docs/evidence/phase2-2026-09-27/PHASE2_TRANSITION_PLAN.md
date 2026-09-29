# Phase 2 — Transition Plan (Mandate 6)

Companion to `PHASE2_DECISIONS.md`. This document is the concrete **implementation plan** for
whichever D03/D04/D05 options the owner approves — it does not itself constitute approval, and no
slice below has been executed except where explicitly marked "already done, this pass." Every
slice is **local only**; none proposes a staging or production activation step. Hosted cutover is
out of scope for this entire document, not merely deferred.

---

> **Status reconciliation (2026-09-29).** This plan was written before most of it was executed and is kept as written. The
> current state of each slice is the one recorded in `PHASE2_DECISIONS.md`'s "Updated requirement matrix" (not re-verified
> line by line here): **D03** slices 1, 2 and 3.5 done; slice 3 (backfill) done locally for principals, store memberships,
> the owner role and arbitrary staff roles; slice 4 (shadow evaluation) done locally as a flag-gated, local-only runtime
> shadow (legacy-translated and target-backed) with independence proofs, **but no sustained observation window**; slice 5
> (cutover) **not done and not authorized**. **D04** slices 1, 2 and 5 done, plus console session-revocation and
> single-use hardening; slices 3 (bootstrap/recovery) and 4 (delivery activation) blocked on owner decisions. **D05**
> slices 1 and 2 done (not exposed); slices 3 and 4 blocked. The plan's D03 rollback wording ("truncate the new tables") and
> its target tables now matter more than when it was written: `site_roles`/`site_role_permissions` are written by the D03
> backfills and read by the live shadow path, so they are **not** deletion candidates (`PHASE2_CLOSURE.md`, dated
> correction; `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §3). The current acceptance matrix is §8 of that document.

## D03 — Merchant-staff identity transition (if Option A is approved)

### Slice 1 — Reconciliation (already done, this pass)

- **What:** `reconcileMerchantStaffIdentities` + `identity-reconciliation-dry-run.ts`.
- **Status:** IMPLEMENTED, LOCAL VERIFIED. 12 synthetic-fixture tests; one real read-only run
  against the owned local Postgres.
- **Dependencies:** none.
- **Acceptance criteria (met):** every named ambiguous case (duplicate identity, multi-membership,
  revoked membership, missing canonical account, conflicting role, cross-tenant membership) produces
  a distinct, correctly-counted finding; rerun is idempotent; no raw PII appears in any finding.

### Slice 2 — Principal repository implementation (DONE, Mandate 7)

- **What:** `principal-repository.ts`'s `createSupabasePrincipalRepository` — real `findById`/
  `findByLegacyRef`/`linkAccount` against the actual `principals`/`account_links` tables. Does not
  replace `createDormantPrincipalRepository`; passed as that factory's own `overrides` parameter
  when/if ever wired in.
- **Status:** IMPLEMENTED, LOCAL VERIFIED. 8 fake-postgrest tests + one real-Postgres round-trip
  (insert a synthetic principal, `findById`/`findByLegacyRef`/`linkAccount` all confirmed, deleted
  after). `findByLegacyRef` fails closed on a ref naming none of the three legacy id fields.
- **Acceptance criteria (met):** a principal created for a synthetic `employees`-shaped ref
  round-trips; `linkAccount` throws on a database failure rather than fabricating success.
- **Compatibility:** purely additive — writes to new, currently-unused tables; `employees` and
  `staff-permission.ts` are not touched or read from by this slice. Not wired into any live route.
- **Rollback:** `TRUNCATE principals` (and the tables it wrote); no legacy table is ever touched.

### Slice 3.5 — Shadow permission comparison (DONE, Mandate 7 — done ahead of the full Slice 3/4 sequence below, since it needed no backfill to be useful)

- **What:** `shadow-permission-comparison.ts`'s `compareStaffPermissionDecision` — compares
  `staff-permission.ts`'s real decision against what `permission-engine.ts`'s
  `createShadowPermissionEngine` (itself real, working, non-stub logic) would decide for the same
  input, using the already-existing `LEGACY_PERMISSION_ALIASES` table.
- **Status:** IMPLEMENTED, LOCAL VERIFIED, consulted by nothing enforcing. 9 tests.
- **Findings this made concrete:** the new model has NO owner-bypass representation at all; it has NO
  write-implies-read rule (the exact Phase 2/Mandate-4 addition to `staff-permission.ts`), so a
  Manager holding `products:write` would be incorrectly denied `products:read` under the new model
  today; only 5 of the real staff permission catalog's keys have a canonical alias at all (products/
  orders read+write, `super_admin`) — every other key (customers, discounts, settings, etc.) is
  unmapped. These are exactly the kind of divergence Slice 4 below would need to resolve before any
  cutover could be considered, discovered without needing to build Slice 4's full harness first.

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

### Slice 2 — Role tier enforcement in `operations/support.ts` (DONE, Mandate 7 — simpler than planned)

- **What actually happened, corrected from the plan:** this slice originally assumed a NEW tier
  column/table would be needed. It was not — `INTERNAL_PERMISSION_TIERS`
  (`viewer`/`operator`/`lead`/`admin`, in `@letbuyy/shared-types`) already existed, fully built, with
  `support:view`/`support:reply`/`support:manage` already correctly mapped per tier; the only missing
  piece was `operations/support.ts`'s own router-level `requireRoleCategory('ops')` +
  `requireSuperAdmin` gate, which made those tiers unreachable dead code for anyone but a superadmin.
  Built `requirePlatformOperator()` (`middleware/rbac.ts`) — a new, explicit gate preserving every
  property the old pair established (see `PHASE2_DECISIONS.md`'s D04 section for the full property
  list) — and wired it in, replacing the old pair.
- **Status:** IMPLEMENTED, LOCAL VERIFIED. 8 isolated middleware tests + 2 end-to-end router tests,
  0 regressions in the pre-existing suite.
- **Acceptance criteria (met):** an active viewer-tier platform employee reaches the router (no
  401/403) and is denied `support:manage`-only routes by the unchanged permission check; a merchant's
  own store-scoped staff, even given a role/permission string that looks platform-related (including
  a literal `"*"` wildcard), is still denied at the router level; revocation (an operator's `employees`
  row going from `active` to `removed`) is denied on the very next request, no re-login needed.
- **Found in the process, not fixed:** `GET /overview`'s own `support_tickets` query has no site_id
  predicate, so it 500s for every caller today, superadmin included — confirmed pre-existing and
  unrelated (reproduced identically for a superadmin control case; the diff touches only the import
  list and the `router.use` line). Flagged as a separate follow-up task.
- **Rollback:** revert to the old `requireRoleCategory('ops')` + `requireSuperAdmin` pair, a one-line
  change; `requirePlatformOperator()` itself is additive and can be left in place unused.

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

### Slice 5 — Single-use token enforcement (DONE, Mandate 7)

- **What:** `jti` added to `LetbuyyPlatformMagicLinkPayload`; migration 263
  (`console_magic_link_consumptions`, `PRIMARY KEY (jti)` as the atomicity guarantee); a new gateway
  route (`POST /internal/console/magic-link/consume`) performing the atomic insert-based consume;
  wired into the callback route BEFORE session issuance.
- **Status:** IMPLEMENTED, LOCAL VERIFIED. 9 fake-postgrest tests + a real-Postgres concurrent-HTTP
  proof through the actual route (one 200, one 409, exactly one row confirmed by direct query, run
  once and deleted). Also found and flagged, not fixed: the pre-existing `verification_tokens.used`
  pattern (buyer/merchant OTP, password-reset) uses a read-then-update shape with a genuine,
  exploitable TOCTOU race under concurrent redemption — a different, pre-existing system, out of this
  slice's scope.

---

## D05 — Buyer export (if the initial scope is approved)

### Slice 1 — Field contract (already done, this pass)

- **What:** `buyer-export-contract.ts` + 11 tests.
- **Status:** IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE (`BUYER_EXPORT_GENERATION_AVAILABLE = false`).

### Slice 2 — Real data-source wiring (read-only) (DONE, Mandate 7)

- **What:** `buyer-export-source.ts`'s `fetchBuyerExportSourceData` — real, ownership-scoped queries
  against `buyer_accounts`/`buyer_addresses`/`support_tickets`/`ticket_messages`/`buyer_order_links`/
  `orders`/`order_items`, each using exactly the `ownershipPredicate` the contract names. Corrected
  two real schema errors found while wiring this (`orders.total`, not the never-existent
  `total_minor`; `order_items.name`/`price`, not `product_name`/`price_minor`).
- **Status:** IMPLEMENTED, LOCAL VERIFIED. 4 tests against two real synthetic buyer accounts seeded
  in the owned local Postgres (deleted after): Buyer A's export contains exactly A's address, A's own
  requester-authored ticket message (never the agent's internal note on the same thread), and exactly
  the one order linked via `buyer_order_links` (excluding a second order sharing A's email but never
  linked, and excluding `orders.notes`); Buyer B's export never contains any of A's data; a simulated
  database failure throws rather than returning a false success.
- **Acceptance criteria (met):** all of the above, verified against real Postgres, not hand-constructed
  objects. Not wired into any route — `BUYER_EXPORT_GENERATION_AVAILABLE` stays `false`.

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
