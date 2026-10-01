# Phase 2 — Decision Package (D03 / D04 / D05), corrected (Mandate 6)

Companion to `SECURITY_ACCEPTANCE.md` and `PHASE2_TRANSITION_PLAN.md`. Every option below is a
**PROPOSAL** — none is an `OWNER_DECISION` until the owner answers it. This document does not infer
an answer from the fact that it was asked to be written, and does not treat silence as approval.

**Corrections from the prior version of this document**, made because Mandate 6 identified them
precisely and they were confirmed against the repository, not merely restated:

- **A.** The prior D03 implied that having three separate realm authorization systems was itself a
  defect calling for unification. It is not — see D03 below for what is actually proposed to unify
  (principal identity / account linking / token issuance / session lifecycle / org membership), and
  what stays intentionally separate (audiences, tenant scopes, permissions, step-up, admin
  authority).
- **B.** The prior D03 Option A said "flip the relevant feature flags in a local/staging
  environment" — a contradiction with its own "hosted-cutover excluded" line. Corrected: this task
  and every option below are **local only**. No staging activation is proposed or implied anywhere
  in this document.
- **C.** The prior document said the scaffold's planning functions "are the one part... with real,
  callable logic" without classifying each component. Corrected below with an explicit
  per-component table (`IMPLEMENTED` / `PLANNER ONLY` / `ADAPTER MISSING` / `STUB` / `UNSUPPORTED
  ASSUMPTION`), matching the status vocabulary already accepted in
  `foundation-programme-2026-09-26/DECISIONS_AND_ACCEPTANCE.md`.
- **D.** The prior D05 table asserted categorically that `risk_scores`/`ts_cases` "cannot contain
  the buyer's personal data." That is an overclaim — a risk score's own inputs may well be derived
  from buyer behavior or buyer-supplied data. Corrected: the export-scope table below states
  exclusions as **proposed technical/security policy** (a decision about what the access right
  discloses, not a factual claim about what data a table contains), and separates secret/security
  material, third-party data, mixed records, internal operational data, and legal
  access/exemption questions as distinct categories.
- **E.** The prior requirement matrix cited "server-side recompute of totals/tax/shipping" and "the
  RLS/tenant backstop" as established by this review — they were not; they are pre-existing facts
  from other work, unrelated to what Mandate 5/6 actually reviewed. Removed from the matrix below.
  Gate status is stated using the accepted PLANNED / IMPLEMENTED / LOCAL VERIFIED / BLOCKED
  vocabulary, and "full gate green" is never used as a stand-in for "feature implemented."

---

## Recovered owner decisions (Mandate 7, Section 2)

Recorded exactly as given, not paraphrased into something broader. Source: this session's own
`AskUserQuestion` tool call and its literal returned answers (verifiable in this session's own
transcript) — not a claim that this document itself was ever the approval record.

| Decision | Exact answer given | Scope (from the option's own text) | Local/hosted boundary | Sub-decisions this does NOT answer |
|---|---|---|---|---|
| D03 | "Local merchant-staff transition (Recommended)" | Build the real principal repository + a shadow-comparison phase for the merchant-staff realm only, against the local database; `staff-permission.ts` stays the only enforced path until shadow-verified equivalence is shown; buyer/operator realms untouched | Explicitly local-only; "No staging/production activation at any point" (the option's own text) | Cutover itself (a separate future decision); buyer/operator realm transitions |
| D04 | "Approve the proposed Reviewer/Moderator/Administrator tiers (Recommended)" | Introduces the 3-tier split for `operations/support.ts`; keeps the existing per-request, immediately-revocable DB allowlist | Local implementation; no hosted flag, no provisioning | Explicitly excluded by the option's own text: "Bootstrap authority, recovery mechanism, MFA model, and high-risk dual-approval are each decided separately afterward, not bundled into this one yes" — i.e. D04.2, D04.3, D04.4, D04.5, D04.6 remain open |
| D05 | "Approve the initial restricted scope (Recommended)" | Approves WHAT fields are in scope (profile/addresses/own authored requests/own orders), already built and tested field-by-field | Local only; explicitly: "Does NOT yet expose any real route to real buyers" | D05.2 (requester verification/step-up) and D05.3 (release/download protection) explicitly named as still needing separate answers before any real route |

Per Mandate 7's own explicit instruction, none of the above is read as approving: production bootstrap
authority, a recovery approver, a production provider/sender, any hosted cutover, an export release
policy, or any deletion/retention policy. Each remains a distinct, unanswered item below.

---

## D03 — Identity unification vs. authorization unification (these are separate questions)

### What is actually proposed to unify — and what is NOT a defect

The three realms (buyer, merchant/staff, platform-operator) having **distinct** audiences, tenant
scopes, permission vocabularies, step-up requirements, and administrative authority is the intended
design (Constitution: "realm privileges strictly separated") — not something D03 proposes to
change. Confirmed structurally separate this pass and the last: merchant-staff permissions
(`employees.permissions`) and platform-operator permissions
(`loadEffectivePermissionScopes`/`super_admin_allowlist`) are resolved from entirely different
tables by entirely different functions (`SECURITY_ACCEPTANCE.md` §3); no shared string or claim
lets one satisfy the other.

What the dormant `identity-foundation` scaffold actually names as its target is narrower than "one
permission system": **one canonical principal/organization graph** underneath the existing,
separate realm-specific authorization layers — specifically:

- **Principal identity** — one durable identifier per real person, instead of a person's merchant
  identity (`users_custom`), buyer identity (`buyer_accounts`), and any future operator identity
  being three unrelated rows with no structural link between them today.
- **Account linking** — a real answer to "is the person behind this `employees.user_id` the same
  person as this `buyer_accounts.id`," which today has no representation at all (they are looked up
  by email coincidence, never joined).
- **Token issuance** — already unified in practice (`identity-platform` is the sole issuer for
  merchant and buyer realms); D03 does not need to change this.
- **Session lifecycle** — merchant and buyer sessions already have independent, working revocation
  mechanisms (fresh-per-request `employees` check; `session_epoch` check). D03 would let a org-graph
  model represent both under one principal without merging their revocation semantics.
- **Organization membership** — replacing `employees`' flat `(store_id, user_id, role)` rows with a
  graph that can express one principal holding several distinct memberships (see the reconciliation
  findings below — this already happens today and is invisible to the current model).

### Current (`CURRENT_IMPLEMENTATION`, verified this pass)

Real row counts against the owned local database, checked this pass (not carried over from
memory): `employees` — 0 rows; `site_memberships` — 0 rows; `site_roles` — 0 rows; `sites` — 2 rows;
`users_custom` — 1 row. The merchant-staff realm's live data is currently empty in this environment
— the reconciliation tool built this pass (below) is demonstrated against synthetic fixtures, not
against a populated real dataset, and this is stated plainly rather than implied otherwise.

### Scaffold component classification (correcting overclaim C)

| Component | File | Classification | Evidence |
|---|---|---|---|
| `IdentityReconciliationReport`/`Finding` types | `migration-scaffold.ts` | **STUB (types only)** — no function populated `findings` before this pass | Confirmed by reading every export; `createEmptyIdentityReconciliationReport()` is the only constructor and it is permanently empty |
| `reconcileMerchantStaffIdentities` | `reconciliation-report.ts` (**new this pass**) | **IMPLEMENTED, LOCAL VERIFIED** | 12 tests against synthetic fixtures (all named scenarios); one real run against the owned local Postgres (read-only, 0 rows found, matching the table's real state) |
| `planPrincipalBackfill` / `planCustomerPrincipalBackfill` | `migration-scaffold.ts` | **IMPLEMENTED (pure mapping only)** — does not detect duplicates/ambiguity; blindly maps 1:1 | Read in full; confirmed by test in `identity-reconciliation-report.test.ts` |
| `planOrgGraphBackfill` | `migration-scaffold.ts` | **ADAPTER MISSING (until this pass)** — accepts `LegacySiteMembershipRow` (id/site_id/user_id/**role_id**), modeled after `site_memberships` (a table with zero rows in every environment inspected), not `employees` (the table that actually holds staff data, whose `role` is a free-text string with no foreign-key partner in active use) | `employeeMembershipToLegacySiteMembership` (new this pass) is the adapter; confirmed by a direct test that a real-shaped `employees` row now reaches this function unmodified |
| `createDormantPrincipalRepository`, `ShadowPermissionEngine` and siblings | `repository-implementations.ts` | **STUB** — `findById()` and equivalents return `null` unconditionally, by design and by name | Read in full this pass and the last; unchanged |
| 15 `IDENTITY_FOUNDATION_FEATURE_FLAGS` | `packages/auth-core/src/feature-flags.ts` | **UNSUPPORTED ASSUMPTION if flipped today** — nothing behind any flag has a real implementation to activate | All default `false`; confirmed no flag has a corresponding non-stub repository |
| `buyer-export-contract.ts`, `console-magic-link-delivery.ts` | new this pass, D05/D04 | **IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE** — deliberately disconnected from any route | See D05/D04 below |

No component in this table is "ready to activate" as a whole. The reconciliation report and the
adapter are the two genuinely new, real capabilities this pass adds; everything else in the scaffold
remains exactly as dormant as previously found.

### Option A — Continue the original Phase 2 target through a LOCAL merchant/staff transition first

- **Builds:** the currently-stub `PrincipalRepository`/permission-representation for the
  merchant-staff realm only (not buyer, not operator); a real backfill run (using
  `reconcileMerchantStaffIdentities` + `planPrincipalBackfill`/`planOrgGraphBackfill`, now that the
  adapter exists) against a **copy** of `employees`; a shadow-evaluation phase comparing the
  existing `staff-permission.ts` answer against the new model's answer for every real request,
  logging (never enforcing on) divergence.
- **What stays unchanged:** the buyer and operator realms, their own session mechanisms, their own
  permission vocabularies — completely untouched by this option. Merchant-staff's OWN existing
  authorization (`staff-permission.ts`) also stays the enforced path throughout the shadow phase;
  nothing user-facing changes until shadow comparison passes for a sustained period and a **separate
  future decision** approves cutover.
- **What still remains incomplete after Option A:** buyer and operator realms are not touched at
  all; this is one of three realms, not "identity unified." Real single-use enforcement for any
  session/token model is a separate, unrelated question (see D04 below — the console magic-link
  token's own single-use gap is unrelated to D03).
- **Why a flag flip alone is insufficient:** every flag in `feature-flags.ts` gates a currently
  `null`-returning stub. Flipping one without first replacing the stub with a real, shadow-verified
  implementation would not activate a new authorization path — it would silently make every
  permission check behind that flag fail (or, if the stub fails open rather than closed, silently
  grant nothing correctly), because there is no real logic behind the flag today.
- **Local verification:** entirely possible against the owned local Postgres; no hosted dependency.
- **Dependencies:** none blocking. Genuinely new work: the repository/engine implementation itself,
  the shadow-comparison harness, and a rollback plan for the backfill.
- **Risk:** medium — touches the merchant-staff realm this pass's own security work most thoroughly
  verified. The shadow-comparison phase exists specifically to catch a regression before it can
  reach real enforcement.

### Option B — Explicitly accept the current implementation as a staged milestone; defer named items

- **Scope:** declare the current three-realm, cleanly-separated state as the accepted milestone.
  Keep the scaffold dormant. Revisit when a named trigger (a fourth realm; a concrete cross-realm
  feature requirement) creates measured pressure.
- **What remains incomplete:** the target principal/org graph stays entirely unbuilt, by explicit
  choice, not by oversight — recorded here so it is never later silently reinterpreted as "not part
  of Phase 2's scope."

### Recommendation

**Option A, bounded to its exact stated scope (merchant-staff realm, local only, shadow-compare
before any cutover)** — not the full historical D03 target, and not Option B's indefinite deferral.
The reconciliation tool and the adapter this pass built are real, tested, zero-risk first steps
already in that direction; taking Option A means continuing them into a real repository
implementation and a shadow-comparison harness, still entirely local, still with the existing
`staff-permission.ts` as the only enforced path until a separate future decision approves cutover.
Option B remains available if the owner prefers not to invest further here; it is not silently
selected by proceeding with independent preparation, per Mandate 6's explicit instruction.

---

## D04 — Operator access: a minimal permission matrix, tied to real endpoints and two real
authorization architectures

### Two structurally different operator-surface authorization models exist today (a new, precise
finding this pass — not previously documented at this level of detail)

| | `routes/operations/support.ts` | `routes/internal-console.ts` |
|---|---|---|
| Gate | `requireRoleCategory('ops')` + `requireSuperAdmin`, per route, plus a granular `support:*` scope | A single shared bearer token (`PLATFORM_CONSOLE_API_TOKEN`), checked once for the whole router |
| Per-person identity at the API layer | Yes — `hasOpsAllowlistEntry` checks `super_admin_allowlist` fresh, per request | **No** — the gateway layer has no concept of which person is calling; `actor_id`/`actor_email` in request bodies are self-reported by the caller |
| Revocation | Immediate — `is_active=false` on the DB row takes effect on the very next request | N/A at this layer — see below |
| Real per-person, MFA-gated check | Happens here, at the gateway | Happens **upstream**, in the console app's own `(dashboard)/layout.tsx` (`requireConsoleSession({mfa:true})`), confirmed this pass to wrap every page that could call this router; no other caller of `PLATFORM_CONSOLE_API_TOKEN` was found anywhere in the repository |

This is a legitimate design (a service-to-service credential, with real authorization happening in
the calling application) **as long as nothing else ever calls this router with the static token**.
That holds today (confirmed by an exhaustive search this pass). It is named explicitly here because
it is exactly the kind of "places where UI and API authority differ" fact D04 needs to be decided
against, not discovered later.

### Console-side session revocation is bounded but not immediate (new, precise finding)

`PLATFORM_CONSOLE_ALLOWED_EMAILS` (env var) is checked **only at login**
(`isConsoleEmailAllowed`, called from the login route; never called again from
`readConsoleSession`/`requireConsoleSession`). Removing an operator from this list blocks new
logins immediately but does **not** invalidate an existing session cookie, which remains valid for
up to `LETBUYY_PLATFORM_SESSION_TTL_SECONDS` = **8 hours** after issuance. This is a bounded, real
gap (not immediate revocation, unlike `operations/support.ts`'s DB-checked model) — stated precisely
so D04.4 (recovery/revocation) is answered against the actual number, not an assumption.

### Console magic-link tokens are not single-use (new, characterized this pass, not fixed)

Confirmed empirically (`packages/auth-core/test/platform-magic-link.test.ts`): the identical
magic-link token verifies successfully more than once within its 15-minute TTL — there is no
nonce/jti and no consumed-token tracking. TTL expiry itself works correctly. Not fixed this pass
(real single-use tracking needs a persistence decision beyond bounded local preparation) — a
demonstrated fact for D04.5/D04.8, not an assumption in either direction.

### A concrete defect found and fixed this pass (not merely proposed)

The login route (`apps/internal/console/src/app/api/console-auth/login/route.ts`) checked allowlist
membership *before* the production/delivery-configured gate. Since every production submission
today ends at `magic_link_delivery_not_configured` (no delivery is wired), checking the allowlist
first meant an **allowed** email got a different error than a **disallowed** one — letting any
caller learn, one guess at a time, which candidate emails are real operator accounts. Fixed by
reordering (production check first) and pulling the decision into a pure, independently-tested
function, `resolveConsoleLoginOutcome` (`console-mfa.ts`). Verified: 2 new tests, full console test
suite green, typecheck clean.

### Concrete action-to-enforcement table

| Action | Endpoint | Current authentication | Current authorization | Data sensitivity | Audited today? | Decision needed |
|---|---|---|---|---|---|---|
| View ticket queue/detail | `GET /tickets`, `/tickets/:id` | Real per-request session → `requireRoleCategory`/`requirePermission` | `support:view` scope | Low-medium (support content) | Yes (`logSensitiveRead`) | Tier: Reviewer |
| Reply/note/create/assign/escalate/resolve/CSAT ticket | `operations/support.ts` various | Same | `support:reply`/`support:manage` | Low-medium | Yes (`writeAudit`) | Tier: Moderator |
| Macros | `POST /macros` | Same | `support:manage` | Low | Yes | Tier: Administrator |
| Merchant detail (orders/risk/T&S/subscriptions cross-domain) | `internal-console.ts` merchant-view | Static token (console-app-issued, upstream MFA) | None at API layer beyond the static token | **High** — payment/risk data, any merchant | Yes (`writeConsoleAudit`, self-reported actor) | Explicit permission + step-up? |
| Merchant suspend/restore | `internal-console.ts` moderation (`MerchantModerationSchema`, requires `secondary_approver_id`) | Static token | None at API layer; **dual-approval already required by the request schema itself** (`secondary_approver_id`) | **High** | Presumed yes (not independently verified this pass — no console UI consumer of this route was found) | Confirm this route has a real UI path and real second-approver verification, not just a schema field |
| Merchant impersonation | `internal-console.ts` (`MerchantImpersonationStartSchema`, `ttl_minutes`) | Static token | None at API layer | **Highest** — assumes a merchant's own session | Not independently verified — **no console UI consumer of this route was found this pass either** | Verify who calls this today, if anyone, before any further decision |
| Console own-account MFA | Not a route — TOTP secrets are env-configured | N/A | N/A | — | — | D04.5 |

**Flagged for the owner's attention, not resolved here:** the merchant moderation and impersonation
routes exist, are schema-validated, and (for moderation) already encode a dual-approval field — but
this pass found **no caller of either route anywhere in the repository**, console or otherwise. That
could mean the console UI for them has not been built yet, or that they are reached by a tool
outside this repository. This is a fact worth the owner's attention before any D04 decision is
finalized, not a gap this pass can resolve by more reading.

### Implemented this pass: `requirePlatformOperator()`, replacing the router-level superadmin-only gate

`operations/support.ts`'s blanket `requireRoleCategory('ops')` + `requireSuperAdmin` (every route,
superadmin only) is now `requirePlatformOperator()` (`middleware/rbac.ts`) — a new, separately
designed and tested gate preserving every property the old pair established (authenticated principal;
fresh-per-request revocation; platform-scoped membership, i.e. `store_id IS NULL` on `employees`,
the exact same query `activeEmployeeForUser` already used elsewhere, which itself exists because of a
named prior bug, APPID-P5b, where a store-scoped employee's role was once misread as platform-scoped)
while additionally letting a non-superadmin active platform employee reach the router at all. Each
route's own, unchanged `requirePermission('support:...')` call is what still decides which specific
action they may take. 19 tests total across three files prove this (8 isolated middleware tests, 2
end-to-end router tests, plus the pre-existing suite's 0 regressions) — see `SECURITY_ACCEPTANCE.md`-
style evidence in the commit history (`667b16c8`, `35146bbf`).

**Found, not fixed, while verifying this:** `GET /overview`'s own `support_tickets` count query has
no site_id predicate, so the real tenant guard throws for every caller today, superadmin included —
confirmed pre-existing (reproduced identically for a superadmin control case) and unrelated to this
change (the diff touches only the import list and the `router.use` line). Flagged as a separate
follow-up task, not fixed in this pass.

> **Correction (2026-10-01, P2-PRIVACY-CONCURRENCY-DB).** The statement above that a non-superadmin
> platform employee can now "reach the router at all" is true of the support router mounted alone
> (which is what the 19 tests mount) and **not** of the production worker. `routes/operations/incident-command.ts`
> registers `router.use('*', requireRoleCategory('ops'), requireSuperAdmin)` and `index.ts:858` mounts it at `/operations`
> before `/operations/support` (`index.ts:860`); Hono applies a mounted router's `'*'` middleware to every later route under the
> same prefix, so every platform support route is behind that gate. Measured through the real worker against a real
> database: platform viewers, operators and leads get `403 Insufficient role category. Required: ops`; only an allowlisted
> super admin passes. The router's own tier logic is correct (proven mounted alone against real `employees` rows), so the tiers are
> implemented and dormant. Because a buyer's privacy request is a support ticket, the same fact decides who can read one through
> the gateway. See `P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md` §9.3 and its O1.

### Product role → existing tier mapping (Mandate 7, Section 8 — explicit, not assumed equivalent)

| Product role (what D04 approved) | Existing tier (`INTERNAL_PERMISSION_TIERS`) | Exact scopes granted | Excluded actions | Assignment authority |
|---|---|---|---|---|
| Reviewer | `viewer` | `audit:read, risk:view, ts:view, support:view, merchant:view, review:view, incident:view, payout:view, exec:view, compliance:view, developer:view` — for `operations/support.ts` specifically, only `support:view` is ever checked by any route today | Every `support:reply`/`support:manage` route (reply, create, assign, escalate, resolve, CSAT, macros) | Not implemented — no assignment route exists (D04.2, open) |
| Moderator | `operator` | Adds `support:reply`, `risk:decide`, `merchant:pii` to the viewer set — again, only `support:view`+`support:reply` are ever checked by this specific router today | `support:manage` (macros); role/config administration | Not implemented (D04.2, open) |
| Administrator | `lead` | Adds `support:manage`, `ts:enforce`, `ts:appeal`, `merchant:impersonate`, `merchant:suspend`, `review:decide`, `incident:command`, `developer:manage` to the operator set | Nothing within `support:*` — `lead` is a superset. **Note:** `lead` is a cross-domain tier (risk/ts/merchant/review/incident), broader than "support administrator" — approving "Administrator" for support does not, by this mapping, also approve using `lead`'s other scopes for non-support actions; that would need its own explicit decision if a route ever checks e.g. `merchant:suspend` via this same tier system | Not implemented (D04.2, open) |
| (no equivalent approved) | `admin` | Every scope (`InternalPermissionScopeSchema.options` in full) | — | Left unassigned, per Mandate 7's explicit instruction not to invent an equivalence for a tier the product roles never named. `admin` is what `isSuperAdmin` already grants via `super_admin_allowlist`, unchanged by this pass. |

**Checked, not assumed:** scope inheritance is a flat per-tier array (no runtime inheritance
mechanism to audit — each tier's scope list is written out in full in `INTERNAL_PERMISSION_TIERS`,
confirmed by reading the constant directly); wildcard behavior (`scopeMatches`'s `g.endsWith(':*')`)
is unrelated to and untouched by this tier system; `break_glass_grants` (time-limited elevated
grants) are additive and already existed, unrelated to this change; a conflict between inline
`employees.permissions` and role-derived scopes cannot arise for a platform employee specifically
because platform `employees` rows are not the ones this pass's write-implies-read/permission-parsing
work (Mandate 4) touched — that work was scoped to store-level `employees` rows.

### The 8 discrete decisions (unchanged in number, updated with this pass's findings)

1. **Role capabilities** — **APPROVED and IMPLEMENTED this pass** (see mapping table above and
   `requirePlatformOperator()`). The High-risk tier (item 6 below) remains a separate, unanswered
   sub-decision — approving the three named tiers did not also approve a specific high-risk design.
2. **Who may assign roles** — no assignment route exists today for either authorization model.
3. **Bootstrap authority** — who adds the first operator to a fresh environment? Not implemented.
4. **Recovery approver/mechanism** — for `super_admin_allowlist`: a DB update, by whom? For the
   console's own env-var allowlist + TOTP secrets: a deploy-config change, by whom, and should the
   8-hour existing-session gap above be closed (e.g., a live session check) as part of this answer?
5. **MFA enrollment/rotation** — self-service or admin-provisioned? Today: admin/deploy-config only.
6. **High-risk approval (dual control)** — is single-superadmin + audit logging sufficient for the
   merchant detail view, or does it need a second approver (as moderation already schemas-in but
   this pass could not confirm is actually wired to a real UI)? Business-risk judgment, not
   engineering — no recommendation made.
7. **Canonical identity transition** — see D03; D04's tiers would need re-implementing if D03
   Option A is later taken.
8. **Delivery/provider activation** — `packages/infrastructure/resend-adapter` exists and is
   reusable; `console-magic-link-delivery.ts` (new this pass) is the wiring **boundary**, not the
   wiring itself — `getConfiguredConsoleMagicLinkDeliveryAdapter()` returns `null` until this is
   answered. Separately: (a) wire the adapter, (b) choose a sender address/copy, (c) decide who owns
   delivery-failure alerts — three separable sub-questions.

No human approver is invented for item 6. No hosted provisioning is implied anywhere above.

---

## D05 — Buyer export: an initial restricted scope, proposed as policy (not asserted as fact)

### Field-level contract (now implemented and tested, not merely described — `buyer-export-contract.ts`)

Every field below names its own real source column (never `SELECT *`); every exclusion states its
**proposed** rationale as a policy choice, not a claim about what the underlying table can contain.

| Section | Included (proposed) | Excluded (proposed policy, with reason) |
|---|---|---|
| Profile | `buyer_accounts.email`, `.full_name`, `.phone`, `.status`, `.created_at` | `.password_hash`, `.session_epoch` — **secret/security material**, not disclosed by an access right regardless of who requests it |
| Addresses | Every `buyer_addresses` column for the requester's own rows | — |
| Buyer-authored request content | The requester's own `support_tickets`/`ticket_messages` (`author_type='requester'`) | Agent-authored notes on the same thread — **mixed record**: the thread contains both the buyer's own words and the platform's internal operational content; only the buyer's own portion is proposed for inclusion, as a disclosure-scope choice, not because the agent's notes are somehow not "in" the same table |
| Orders | The requester's own orders via `buyer_order_links`, commerce fields only | Merchant-internal order notes (if such a field exists) — **internal operational data**, proposed excluded as a disclosure-scope choice |
| (Flagged, not yet classified as included or excluded) | `buyer_notifications`, `loyalty_accounts`+ledger, `seller_follows`, `buyer_product_views` | Needs an explicit decision — `buyer_product_views` in particular is browsing history a buyer may not expect to see itemized back to them |
| (Explicitly out of this proposal's scope) | Platform risk/fraud assessment (`risk_scores`, `ts_cases`/`ts_evidence`) | **Not asserted to be free of buyer-derived data** — a risk score's own inputs may include buyer behavior. Proposed exclusion is a policy decision about disclosing the platform's fraud-detection reasoning and methodology, separate from any question about what data it is computed from. This needs its own explicit legal/policy sign-off if ever revisited, not a technical default. |

Implementation facts (not policy): `BUYER_EXPORT_GENERATION_AVAILABLE` is hardcoded `false`; nothing
imports the generator from any route; 11 tests confirm Buyer A never receives Buyer B's rows even
when both are present in the same synthetic source, that credentials are never emittable regardless
of contract changes elsewhere, that a partial match is reported `complete: false` rather than
silently omitted, and that serialization is deterministic.

### The 8 separate decisions (unchanged in number and substance from the prior pass)

1. **Export scope** — accept the table above, amend it, or replace it?
2. **Requester verification/step-up** — beyond an authenticated session, what proves the requester
   is who they claim? Not decided.
3. **Release/download protection** — signed URL with expiry, password-protected, in-app only? Not
   decided.
4. **Retention categories** — no table above has a defined retention window today; every one retains
   indefinitely unless explicitly deleted.
5. **Deletion exceptions** — which categories must survive an erasure request regardless (financial/
   audit records, fraud-investigation evidence)? Not decided.
6. **Legal hold** — a mechanism to pause deletion for a buyer under active dispute? Not implemented.
7. **Deletion approval** — automatic once scope is met, or a human sign-off per request? Not
   decided.
8. **Incident ownership** — who is accountable if an export/erasure executes incorrectly? Not
   decided.

**Deletion execution remains unimplemented until these are answered.** Export generation is
technically demonstrable today (against synthetic fixtures) but stays unavailable to any real user
until #1 is genuinely accepted — a synthetic fixture passing its own tests is not, and must never be
described as, a completed buyer export journey.

---

## Concise owner answer form

```
D03: [ ] Option A (local merchant-staff transition, bounded, shadow-compare before cutover) — recommended
     [ ] Option B (accept current state as a staged milestone; defer)
D04.1 role capabilities:        [ ] as proposed   [ ] amended: __________
D04.2 who assigns roles:        __________
D04.3 bootstrap authority:      __________
D04.4 recovery approver + 8-hour session gap: __________
D04.5 MFA enrollment model:     [ ] admin-provisioned (current)   [ ] self-service
D04.6 high-risk dual approval:  [ ] required   [ ] not required (audit log sufficient)
D04.7 canonical identity:       (follows D03)
D04.8 delivery/provider:        [ ] wire resend-adapter now (needs sender + ownership answers)   [ ] defer
D04.9 (new) moderation/impersonation routes: [ ] confirm real caller exists   [ ] investigate further   [ ] deprecate if unused
D05.1 export scope:             [ ] as proposed   [ ] amended: __________
D05.2 requester verification:   __________
D05.3 release protection:       __________
D05.4 retention categories:     __________
D05.5 deletion exceptions:      __________
D05.6 legal hold mechanism:     [ ] needed now   [ ] defer
D05.7 deletion approval:        [ ] automatic   [ ] human sign-off required
D05.8 incident ownership:       __________
```

---

## Updated requirement matrix

Status vocabulary matches `foundation-programme-2026-09-26/DECISIONS_AND_ACCEPTANCE.md` (PLANNED /
IMPLEMENTED / LOCAL VERIFIED / BLOCKED / CLOSED), not an invented scale. Rows outside what Mandate
5/6 actually reviewed are not included — correcting overclaim E.

| Capability | Status |
|---|---|
| Staff RBAC fail-closed, revocation-immediate | **LOCAL VERIFIED** (`SECURITY_ACCEPTANCE.md` §2-3, §9) |
| Staff provisioning (verified-email direct-add) | **LOCAL VERIFIED** |
| Write-implies-read permission primitive | **LOCAL VERIFIED** |
| Privacy request intake (honest status, real idempotency) | **LOCAL VERIFIED**, including a real-Postgres concurrent-HTTP proof *(2026-10-01: that proof was a one-off script, run once against the then-restored stack and deleted; it is now two persistent suites in the owned database lane that run by default, with negative controls — `P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md`)* |
| Cross-tenant ticket leak (employee `/tickets`) | **LOCAL VERIFIED** |
| `GET /products/:id` tenant-guard fix + staff recognition | **LOCAL VERIFIED** |
| Console login account-enumeration ordering | **LOCAL VERIFIED** (fixed and tested this pass) |
| D03 merchant-staff identity reconciliation (dry-run) | **IMPLEMENTED, LOCAL VERIFIED** — real tool, run against real (currently empty) data + synthetic fixtures |
| D03 real `PrincipalRepository` (findById/findByLegacyRef/linkAccount) | **IMPLEMENTED, LOCAL VERIFIED** (Mandate 7) — 8 fake-postgrest tests + one real-Postgres round-trip; not wired into any live route |
| D03 shadow permission comparison (legacy vs. new model) | **IMPLEMENTED, LOCAL VERIFIED** (Mandate 7) — 9 tests; concretely finds the new model has no owner-bypass concept and no write-implies-read rule, and that only 5 of the real staff permission keys have a canonical alias at all |
| D03 runtime shadow evaluation, LEGACY-TRANSLATED (permission-translation correctness) | **IMPLEMENTED, LOCAL VERIFIED** (auth hardening mandate, 2026-09-28) — SUPERSEDES the row above's former "consulted by nothing enforcing": wired into `evaluateStaffRequest`, the one choke-point every merchant route calls through; disabled by default. This dimension translates LEGACY GRANTS into a synthetic actor -- it proves alias-table correctness, not whether a real target row exists. See the next row for that. |
| D03 runtime shadow evaluation, TARGET-BACKED (reads real principals/store_memberships/site_role_permissions) | **IMPLEMENTED, LOCAL VERIFIED** (2026-09-28 follow-up) — a SEPARATE comparator (`target-shadow-comparison.ts`), added because the legacy-translated one "can test permission translation, but cannot independently verify principal backfill, target membership lookup, role assignments, target revocation state, or tenant/site binding" (the follow-up mandate's own words, confirmed true by inspection). Never reads `employees` and never accepts a `granted` array; missing target data (no principal, no membership, inactive membership, no role assigned) always resolves `targetAllowed: false`, never a guess. 23 tests total in `staff-permission-shadow.test.ts` cover both dimensions plus a full environment-eligibility matrix (below) plus two shadow-independence proofs (mutating ONLY the target fixture produces a measured divergence while the real HTTP result is provably unchanged, in both directions). Broke a real circular import (`staff-permission.ts` <-> `shadow-permission-comparison.ts`) by extracting the pure decision primitive to `lib/staff-permission-decision.ts`. |
| D03 shadow-mode environment eligibility | **IMPLEMENTED, LOCAL VERIFIED** (2026-09-28 follow-up) — CORRECTS a real gap the follow-up mandate named precisely: `ENVIRONMENT !== 'production'` alone is not "local only" (it would silently qualify staging/preview/unset/malformed values). Now requires BOTH `ENVIRONMENT !== 'production'` AND `isLocalSupabaseEnvironment(env)` (the same SUPABASE_URL-contains-localhost signal this repo already uses elsewhere) — 7 pure tests cover local/production/staging-shaped-URL/preview-shaped-URL/unset-ENVIRONMENT/malformed-ENVIRONMENT/flag-off; negative control (reverting to the old check) confirmed exactly the 4 environment-dependent tests fail. |
| D03 real backfill execution (principals + store_memberships) | **IMPLEMENTED, LOCAL VERIFIED** (Mandate/2026-09-28) — SUPERSEDES the row below's former "not attempted": `identity-foundation/backfill-executor.ts`. Discovered and worked around a real scaffold/schema fact: `principals.id` is a DB-generated uuid, not the literal string `migration-scaffold.ts`'s planner produces (a plan-internal correlation key only, never sent as an insert value). |
| D03 backfill RECONCILIATION (revocation-after-backfill) | **IMPLEMENTED, LOCAL VERIFIED** (2026-09-28 follow-up) — CORRECTS a real gap: "a revoked legacy row being skipped on a fresh run is not sufficient" (the follow-up mandate's own words). A previously-backfilled ACTIVE `store_memberships` row now actively loses authority (`status -> 'removed'`) when the legacy source is later revoked OR soft-deleted, not merely left untouched; re-approval (legacy flips back to active) restores it. 16 fake-postgrest tests total (5 new reconciliation cases) plus the real-Postgres acceptance test below; negative control confirmed load-bearing. A real tenant-guard rejection was hit and fixed for real during this work: the reconciliation UPDATE originally scoped only by `.eq('id', ...)`, which the tenant guard correctly refused for this registered tenant table -- fixed by also scoping `.eq('store_id', ...)`, which is both the guard's requirement and a genuine extra correctness guarantee. |
| D03 real-database acceptance (persistent, not a one-off script) | **IMPLEMENTED, LOCAL VERIFIED** (2026-09-28 follow-up) — CORRECTS the prior pass's evidence: "the previous backfill proof was temporary and removed" (true, and now fixed). `backfill-and-target-shadow.postgres.test.ts` is a PERSISTED, self-skipping-only-when-no-local-instance test (skip is reported distinctly, `skipped:1 pass:0`, never counted as a pass) covering principal insertion, mapping stability across repeated resolution, membership insertion, role/permission resolution against REAL `site_roles`/`site_role_permissions` rows (both empty in every environment before this test seeds its own), idempotent rerun, ambiguity blocking, revocation-after-backfill (verified by a direct SQL status check, not just the function's return value), permission downgrade (a real `role_ids` swap), and partial-run recovery. Run for this acceptance with the local instance up: it passed, not skipped. |
| D03 bounded local shadow rehearsal | **SUPERSEDED, 2026-09-28 permission-equivalence follow-up** — the 143ms/200-request figure this row previously recorded was fake-PostgREST, not real Postgres (a gap the follow-up mandate named explicitly). Replaced by a REAL local HTTP-to-database rehearsal: `real-http-shadow-rehearsal.postgres.test.ts` mounts the actual `routes/products.ts` router against real local Postgres and exercises 9 real scenarios (owner/staff read, owner mutation, forbidden mutation, membership revocation, cross-site read/mutation, a real target-only permission downgrade, and a real ownership transition with reconciliation independently proven on both the old and new owner) — all passing, all real, cleanup verified complete. A separate bounded real on/off latency comparison (30 real requests/condition, sequential, 5-request warmup) is recorded, with the host's contended state (concurrent, protected, unrelated Edynox work; load average 24–43) disclosed rather than hidden — see `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md` for full detail, all three runs' numbers, and why the ON/OFF delta is not a clean, reproducible number on this host. |
| D03 sustained shadow-observation period + full cutover | **BLOCKED** — genuinely new work beyond this pass's bounded scope: a sustained production-shaped observation window and the cutover decision itself are not attempted, and are not claimed to be |
| D03 target role/permission data | **RESOLVED FOR OWNER + ARBITRARY STAFF, 2026-09-28 staff-mutation/shadow-runtime completion** — SUPERSEDES this row's former "MAPPING FOR ARBITRARY CUSTOM STAFF ROLES is still not built": (1) all 11 real `StaffPermissionKey` values have an explicit, tested canonical alias (`packages/permission-core`'s `LEGACY_PERMISSION_ALIASES`); (2) site-owner authority is a real, site-scoped role grant (`owner-role-backfill.ts`), unchanged; (3) **new** — `staff-role-backfill.ts` gives ARBITRARY staff a deterministic, site-scoped, permission-set-derived role: `deriveStaffRoleSlug()` hashes the sorted canonical action set (never a display name, never insertion order, never `employees.role`) into a stable slug; `ensureStaffRole()` finds-or-creates and self-reconciles it; `executeStaffMembershipRoleAssignment()` assigns it to a real employee's real `store_memberships` row from their real `permissions.granted`, wholesale-replaced on every run. 16 fake-PostgREST tests (determinism, unmapped-grant handling, platform-permission exclusion, idempotency, site isolation, shared roles, downgrade reconciliation, revoked-membership isolation) plus real-Postgres proof against a real employee created through the real `POST /employees` path (not a synthetic row) — see `PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` §§1-2. What remains open: `'reports:read'` (the one `LETBUYY_STORE_STAFF_PERMISSIONS` key with no canonical alias) is excluded from every derived role and reported by name, never guessed at — a real, named, bounded gap, not a blocker. |
| D03 real staff product mutation, independently authenticated | **IMPLEMENTED, LOCAL VERIFIED, REAL DATABASE** (2026-09-28 staff-mutation/shadow-runtime completion) — CORRECTS the historical framing that any rehearsal proving product mutation or the decisive independence pattern had to substitute the owner for a permitted staff member (true of `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md`'s downgrade/reconcile scenarios specifically, corrected in place there and here). `real-staff-product-journey.postgres.test.ts`: a real staff member, created via real `POST /employees`, authenticated with real signed HMAC headers through the real `authMiddleware` (never a context bypass), completes the full create/read/edit/delete product cycle, is refused a forbidden operation and two cross-store mutations, loses exactly the withdrawn permission (and keeps the retained one) the instant the owner downgrades them via real `PATCH /employees/:id`, while the owner remains unaffected. Cleanup independently verified with post-delete `COUNT` assertions. See `PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` §1. |
| D03 target-shadow independence, DECISIVELY proven | **IMPLEMENTED, LOCAL VERIFIED, REAL DATABASE** (2026-09-28 permission-equivalence follow-up) — a target-only role change (via real SQL, `store_memberships.role_ids`) produces a measured `DIVERGE_LEGACY_ALLOWS_TARGET_DENIES` shadow-log outcome while the REAL, authoritative HTTP response is provably unchanged (still legacy-decided), proven for BOTH a permission downgrade and an ownership transfer (old owner's target-side revocation and new owner's target-side grant independently confirmed via the shadow log, not inferred from the real response alone). Persisted, reusable, real-Postgres test — not a diagnostic-only comparator call. |
| D03 shadow-path bounded-failure behavior | **MEASURED, NOT MERELY ASSERTED** (2026-09-28 permission-equivalence follow-up) — two new tests in `staff-permission-shadow.test.ts` measure, rather than assume: (1) a THROWN fetch (simulated dropped connection, not a well-formed error response) during the target lookup is caught, logged as `TARGET_LOOKUP_ERROR`, and never affects the real response — confirmed; (2) a SLOW (120ms-delayed) target lookup currently has NO independent timeout — the real request measurably waits out the full delay, since `runShadowComparisonSafely` is `await`ed inline with no `Promise.race`/timeout guard. This is a real, named, unfixed gap (not implemented this pass — a request-hot-path middleware change deserves its own dedicated review), recorded as a concrete next-step recommendation in `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md`. |

> **Correction (2026-09-29): that gap is closed, and the recommendation is not open work.** The unbounded slow-lookup case named in the
> row above was fixed the same day it was written — `3a75bcee` bounds both shadow comparisons with a timeout, `c35169d0` adds real
> cancellation (an `AbortController` threaded into every target query, with the race as the unconditional bound underneath), both
> ancestors of this branch's tip — and `staff-permission-shadow.test.ts` measures it (a slow-but-under-budget lookup is unaffected;
> one far past the bound returns near the bound with `TARGET_SHADOW_EVALUATION_TIMEOUT` and an unchanged real decision; the real
> client cancels the in-flight request; a late rejection is absorbed). `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md` and
> `PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` already said so; only this row did not. Recorded in
> `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §3.4.

| D03 real-rehearsal discovery: product mutation routes were owner-only regardless of staff permission | **DISCOVERED, THEN FIXED SAME DAY** (2026-09-28 permission-equivalence follow-up, fix in commit `81dc8e94`) — while building the real rehearsal, found that `PATCH`/`DELETE /products/:id` (via `ProductExecutionAdapter.ownedProductStoreId`) and `POST /products` (via `createProduct`'s internal `assertStoreOwnership`) each performed their OWN literal-owner-only recheck (`verifySiteOwnership`, `sites.custom_user_id`/`user_id` only) AFTER the route-level `assertStaffPermission('products:write')` had already correctly allowed a permitted staff member through — meaning no non-owner staff member, however permissioned, could complete a product mutation through this router. `GET /:id` already had the equivalent owner-OR-staff fix; POST/PATCH/DELETE had not. Fixed by giving PATCH/DELETE the same `loadProductByIdUnguarded`-then-`assertStaffPermission` pattern `GET /:id` uses, and by adding an explicit `alreadyAuthorized` parameter to `createProduct`/`bulkAction` (set only by callers that already checked staff permission; every other existing caller unchanged). Regression-tested in `product-tenant-guard.test.ts`'s section 5. See `D03_PERMISSION_EQUIVALENCE_AND_RUNTIME_REHEARSAL.md`. |
| D04 operator role tiers (Reviewer/Moderator/Administrator) | **IMPLEMENTED, LOCAL VERIFIED** (Mandate 7) — `requirePlatformOperator()` wired into `operations/support.ts`; 19 tests (8 middleware, 2 end-to-end, 9 pre-existing unaffected) *(corrected 2026-10-01: at the router level; through the production mount an earlier `/operations/*` gate admits only allowlisted super admins, so the tiers are dormant — see the correction note in the D04 section above and `P2_PRIVACY_CONCURRENCY_DB_ACCEPTANCE.md` §9.3)* |
| D04 operator bootstrap/recovery | **BLOCKED** on D04 decisions 2-4 (who assigns roles; bootstrap authority; recovery approver) |
| D04 console magic-link single-use enforcement | **IMPLEMENTED, LOCAL VERIFIED** (Mandate 7) — real, previously absent; atomic consume proven via real-Postgres concurrency (one 200, one 409, exactly one row) |
| D04 console session revocation (the allowlist-membership dimension, the "8-hour gap") | **IMPLEMENTED, LOCAL VERIFIED** (2026-09-28) — verified the gap was real (neither `proxy.ts` nor `requireConsoleSession()` re-checked `PLATFORM_CONSOLE_ALLOWED_EMAILS` per request), fixed both layers, 6 tests against the real `proxy()` function. Precisely characterized this pass (2026-09-28 follow-up), not just claimed fixed: `PLATFORM_CONSOLE_ALLOWED_EMAILS` is read fresh from `process.env` on every call with NO caching layer of this repo's own construction, so the fix's guarantee is "the very next request after the deployed process's environment actually changes is denied" -- in most real hosting models that means after a redeploy/restart, not instantly on an env-var edit alone; a rolling multi-instance deployment can have instances briefly disagree during that rollout (inherent to env-var-based config generally, not something this fix changes); `proxy.ts` and `console-auth-server.ts` are CONFIRMED to call the identical `isConsoleEmailAllowed` from the identical `console-access-allowlist.ts` module (one source of truth, not two policies that could drift); re-adding a removed email makes any STILL-UNEXPIRED session cookie for that email valid again immediately -- "removal" is membership state, not a permanent per-session kill; `services/api-gateway`'s own `internal-console.ts` routes do NOT themselves re-verify per-operator membership -- they trust `PLATFORM_CONSOLE_API_TOKEN`, a shared service-level credential common to every console-originated call, so the person-level check lives ENTIRELY in the console app's own layer (which this fix covers). Per-session-jti revocation (killing one specific already-issued token before its natural expiry, independent of allowlist membership) remains unsupported — a named limitation, not fabricated as tested. |
| D04 unauthenticated static-token-only API routes (NEW finding, 2026-09-28 follow-up) | **FIXED, LOCAL VERIFIED** — `founding/action` (pause/disable the founding-merchant program, reallocate site slots) and `founding/export` (CSV export of allocation data) had **no session check of any kind** and are not covered by `proxy.ts`'s protected-path matcher; they relied solely on `PLATFORM_CONSOLE_API_TOKEN`, a shared service-level credential proving "this call came from the console app," never "this specific operator is still allowed." A genuine pre-existing defect, not a theoretical one — found and fixed in this pass per its explicit authorization to fix authentication/authorization defects. New `lib/console-api-auth.ts` (reads the session directly from the `NextRequest`, deliberately avoiding `console-auth-server.ts`'s `server-only` marker so the gate is testable without a real Next.js SSR context) wired into both routes; 6 tests (no-session/revoked-allowlist/no-MFA/authorized-passes-through × 2 routes); negative control confirmed load-bearing. |
| D04.8 console delivery boundary | **IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE** (adapter interface + capture transport; no sender chosen, no provider wired) |
| D04.9 moderation/impersonation route callers | **BLOCKED** on the owner confirming whether a real caller exists |
| D05 export field contract | **IMPLEMENTED, LOCAL VERIFIED, NOT ACTIVE** (`BUYER_EXPORT_GENERATION_AVAILABLE = false`) — corrected against the real schema this pass (orders.total, not the never-existent total_minor) |
| D05 real query wiring (read-only, against actual tables) | **IMPLEMENTED, LOCAL VERIFIED** (Mandate 7) — 4 tests against two real synthetic buyer accounts in the owned local Postgres; still not wired into any route |
| D05 export execution against real requests / route exposure | **BLOCKED** on D05 decisions 2-3 (requester verification; release/download protection) — explicitly excluded from the D05 approval's own scope |
| D05 deletion/retention execution | **BLOCKED** on D05 decisions 4-8 |
| Buyer/merchant `verification_tokens` redemption race | **IMPLEMENTED, LOCAL VERIFIED** (auth hardening mandate, 2026-09-28) — a genuine, more severe sibling of the already-fixed console magic-link race (this one can mint a real login session directly, not just a password-set intent); reproduced against real Postgres (6/6 concurrent successes before the fix), fixed with a WHERE-guarded conditional UPDATE, re-proven (1/6 after); 9 deterministic + 2 real-Postgres tests, both persisted |
| `GET /overview` tenant-guard 500 | **CLOSED** — corrected from this document's own prior "flagged as a separate follow-up task, not fixed": fixed in a separate pass the same day (commit `2e0c3204`) using the pre-existing `getSupabaseAdminForOperatorRead` escape hatch at all 8 affected call sites; 7 fake-postgrest + 3 real-Postgres tests |
| Full local gate | **NOT CLOSED, precisely accounted** (2026-09-28 staff-mutation/shadow-runtime completion) — `test:unit:gateway` 1323/1324 pass (1 pre-existing, unrelated, explicitly-`# TODO` item); full monorepo `typecheck` 81/81 packages; `validate:governance:gate` 114/114 PASS; root `pnpm run test` 2065/2090 pass, **25 failures remain**, every one traced to a verified cause and confirmed to touch none of this pass's 6 changed files — 4 to a shared ephemeral-Postgres fixture's leftover cluster-global role state, ~21 to pre-existing, unrelated-domain drift (app-layout paths, route-count lockstep figures, storefront caching, GraphQL/REST parity, Vercel deploy topology). One failure this pass's own earlier work DID cause (a stale structural test pin, `lb-merchant-admin.test.mjs`) was found and fixed. Full detail: `PHASE2_STAFF_MUTATION_AND_SHADOW_COMPLETION.md` §6. **UPDATED 2026-09-29** (`PHASE2_TEST_BASELINE_RECONCILIATION.md`): root `pnpm run test` at `e21dc2d9` is green — 2445 tests, 2430 pass, 0 fail, 15 `[HUMAN-REQUIRED]` skips; the four "role state" failures were a deliberate container guard and now run in owned clusters; the ~21 were stale tests reproduced at the pre-Phase-2 base (none a product defect); real governance gate 114/114 (disposable clone), typecheck 81/81. Still open: the live theme tenant-isolation proof (needs a decision, §11.4 there) and the pre-existing lint errors (§11.2 there). |

> **Correction (2026-09-29):** both items named as "still open" at the end of the row above are closed. The 42 lint errors are repaired
> and the theme tenant-isolation proof now runs from repository state in an owned cluster (23 tests, negative-controlled); neither
> needed an owner decision. What that work surfaced instead — the theme tables' privilege posture, and rows the gateway lane left in
> the local Supabase stack — is in `PHASE2_LOCAL_QUALITY_AND_THEME_ISOLATION.md` §5, §6.4 and §10. The current acceptance matrix is §8
> there.

