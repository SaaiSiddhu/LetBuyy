# Phase 2 — Decision Package (D03 / D04 / D05), Mandate 5 format

Companion to `SECURITY_ACCEPTANCE.md`. Every option below is a **PROPOSAL** — none is an
`OWNER_DECISION` until the owner answers it. This document does not infer an answer from the fact
that it was asked to be written.

---

## D03 — Canonical identity/organization model: complete now, or accept a staged milestone?

### Current (`CURRENT_IMPLEMENTATION`, verified this pass and the prior one)

- Merchant staff live in the **`employees`** table (`store_id`, `user_id`, `role`,
  `permissions: {granted: [...]}`, `status`). Fail-closed RBAC (`staff-permission.ts`), fresh per
  request, no caching — revocation is structurally immediate (proven, §9 of `SECURITY_ACCEPTANCE.md`).
- `identity-platform` is the **sole session issuer** for the merchant and buyer realms
  (asymmetric ES256/EdDSA, verified via `LETBUYY_IDENTITY_PUBLIC_JWKS`). Buyer sessions additionally
  check a live `session_epoch` against `buyer_accounts` on every request (immediate global
  revocation, e.g. "sign out everywhere").
- **17-file `identity-foundation` scaffold** (`services/api-gateway/src/identity-foundation/`) plus
  15 feature flags (all default `false`) name a **target** principal/org-graph model. Its
  `createDormantPrincipalRepository()` and sibling factories are literally named dormant —
  `findById()` returns `null` unconditionally. 22 named future tables all exist in the database with
  zero rows. The scaffold's pure planning functions (`planPrincipalBackfill`,
  `planOrgGraphBackfill`, etc.) are genuinely usable today for dry-run validation — they are the one
  part of the scaffold with real, callable logic.
- The platform-operator realm has its own, **third**, separate authorization system
  (`middleware/rbac.ts`'s `loadEffectivePermissionScopes` + an explicit ops allowlist table) —
  confirmed independent of both the merchant-staff and buyer systems (§6 of
  `SECURITY_ACCEPTANCE.md`).

So today there are **three realms, three separate authorization mechanisms**, cleanly isolated
from each other (verified, not assumed) but not unified under one canonical principal/org model.

### Target (`TARGET_IMPLEMENTATION`)

One canonical principal/organization graph (the dormant tables + feature flags already name it)
replacing all three realm-specific mechanisms, with a real backfill from `employees`/`buyer_accounts`/
the ops allowlist into the new tables, cut over behind the existing feature flags, then the legacy
tables retired.

### Option A — Complete the bounded Phase 2 transition now

- **Scope:** activate the `identity-foundation` scaffold for the merchant-staff realm only (not
  buyer, not operator); implement the currently-dormant `PrincipalRepository` and
  `ShadowPermissionEngine` against the already-existing 22 tables; run `planPrincipalBackfill`/
  `planOrgGraphBackfill` for real against a copy of `employees`; flip the relevant feature flags in
  a local/staging environment only.
- **Dependencies:** none blocking — the tables exist, the planning functions exist and are pure.
  Genuinely new work: the repository/engine implementations themselves (currently `null`-returning
  stubs) and a real backfill script with a rollback path.
- **Compatibility implications:** `staff-permission.ts` would need a shadow-read/shadow-write phase
  (compute both the old and new answer, compare, alert on divergence) before cutover — not built
  today.
- **Risk:** medium. The merchant-staff realm is the one this pass most thoroughly re-verified
  (§§2–4 of `SECURITY_ACCEPTANCE.md`); replacing its authorization primitive is exactly the kind of
  change that could silently reintroduce a gap this pass just closed, unless the shadow-comparison
  phase is built first and run long enough to be trusted.
- **Local verification:** fully possible without any hosted dependency — everything named above
  runs against the owned local Supabase instance.
- **Hosted-cutover excluded from this option's scope** — flipping a feature flag in staging/
  production is a separate, later, owner-approved step.
- **What remains incomplete even if Option A is taken:** the buyer and operator realms stay on
  their own separate mechanisms; this option unifies one of three.

### Option B — Explicitly accept a staged milestone; defer the transition

- **Scope:** declare the current three-realm-but-cleanly-isolated state (verified this pass) as the
  accepted Phase 2 target. Keep the `identity-foundation` scaffold dormant and the feature flags at
  `false`. Revisit only when a **named trigger** (e.g., a fourth realm, a cross-realm feature
  requirement) creates measured pressure.
- **Dependencies:** none — this is a decision not to build something yet.
- **Compatibility implications:** none; nothing changes.
- **Risk:** low technically (nothing new is built); the accepted risk is carrying three parallel
  authorization mechanisms indefinitely, which is a real (if currently well-managed) maintenance
  and audit surface.
- **Local verification:** N/A.
- **What remains incomplete:** the target model stays entirely unbuilt, by design, until re-opened.

### Recommendation (a recommendation, not a decision)

**Option B.** The three realms are verified, this pass and the last, to be cleanly separated with
no cross-contamination risk (§6 of `SECURITY_ACCEPTANCE.md`) — the problem the unified model would
solve is not currently manifesting as a bug. Building the shadow-comparison infrastructure Option A
needs, safely, is itself a multi-phase effort disproportionate to a "bounded" pass, and Mandate 5
explicitly warns against expanding scope after the actual defects are already closed. Recommend
revisiting D03 only when a concrete fourth realm or cross-realm requirement appears.

---

## D04 — Operator permission matrix (proposal) and 8 discrete decisions

All rows below name an **existing** endpoint in `routes/operations/support.ts` /
`routes/internal-console.ts`. "Current enforcement" is what the code does today, cited from source,
not inferred. "Proposed" is a suggestion the owner may accept, reject, or amend — the table's
existence does not pre-select an answer.

| Existing action | Endpoint | Current enforcement | Proposed tier | Audited today? | Step-up if accepted? |
|---|---|---|---|---|---|
| View ticket queue/detail | `GET /tickets`, `GET /tickets/:id` | `requirePermission('support:view')` | Reviewer (read-only) | Yes — `logSensitiveRead` | No |
| Reply / internal note | `POST /tickets/:id/messages` | `requirePermission('support:reply')` | Moderator | Yes — `writeAudit` | No |
| Create ticket | `POST /tickets` | `requirePermission('support:reply')` | Moderator | Yes | No |
| Assign ticket | `PATCH /tickets/:id/assign` | `requirePermission('support:manage')` | Moderator | Yes | No |
| Escalate (incl. Trust & Safety case open) | `POST /tickets/:id/escalate` | `requirePermission('support:reply')` | Moderator | Yes | No |
| Resolve ticket | `POST /tickets/:id/resolve` | `requirePermission('support:reply')` | Moderator | Yes | No |
| Record CSAT | `POST /tickets/:id/csat` | `requirePermission('support:reply')` | Moderator | Yes | No |
| Create/manage macros | `POST /macros` | `requirePermission('support:manage')` | Administrator | Yes | No |
| Merchant detail view (cross-domain: orders, risk, T&S cases) | `internal-console.ts` merchant-view route | `requireRoleCategory('ops')` + `requireSuperAdmin` (every route in this file) | **High-risk** — reads payment/risk data across every merchant | Yes — `writeConsoleAudit` | **Proposed: yes**, given it exposes commerce + risk data platform-wide |
| Console own-account MFA enrollment/rotation | not yet a route (TOTP secrets are env-configured, not self-service) | N/A | — | — | — |

**Note on today's actual tier structure:** every route in `operations/support.ts` already requires
`requireSuperAdmin` in addition to its specific `support:*` scope (`router.use('*',
requireRoleCategory('ops'), requireSuperAdmin)`) — there is **no reviewer/moderator/administrator
tier distinction in the code today**; every operator who can reach this router at all is already a
superadmin. The table above is a **proposal to introduce** that tier distinction, not a description
of an existing one.

### The 8 discrete decisions

1. **Role capabilities** — accept the Reviewer/Moderator/Administrator/High-risk split above, or a
   different one? (Today: one undifferentiated superadmin tier.)
2. **Who may assign roles** — if tiers are introduced, who grants them? No such assignment route
   exists today; `PLATFORM_CONSOLE_ALLOWED_EMAILS` is a flat allowlist with no role concept.
3. **Bootstrap authority** — who adds the *first* operator to a fresh environment? Not implemented
   today; would need an explicit, owner-approved bootstrap path (not a generic self-registration
   endpoint).
4. **Recovery approver/mechanism** — if an operator loses their TOTP device, who re-provisions them?
   Not implemented today (`PLATFORM_CONSOLE_TOTP_SECRETS` is env-configured, not self-service, so
   recovery today means an environment-variable change by whoever controls the deploy config — this
   is itself worth an explicit decision on who that should be).
5. **MFA enrollment/rotation** — self-service, or admin-provisioned? Today: admin/deploy-config
   provisioned only (env var), confirmed per-principal in production (§11 of
   `SECURITY_ACCEPTANCE.md`).
6. **High-risk approval (dual control)** — is the merchant-detail cross-domain view (which already
   surfaces payment/risk data for any merchant) sensitive enough to require a second approver, or is
   single-superadmin access with audit logging (today's state) sufficient? This pass makes no
   recommendation — it is a business-risk judgment, not an engineering one.
7. **Canonical identity transition** — see D03 above; restated here because D04's tiers would need
   to be re-implemented if D03's Option A were later taken.
8. **Delivery/provider activation** — see §11 of `SECURITY_ACCEPTANCE.md`: an adapter
   (`packages/infrastructure/resend-adapter`) already exists and is reusable; this decision is
   specifically about (a) whether to wire the console's magic-link route to it, (b) what sender
   address/copy to use, and (c) who owns delivery-failure alerts — three separable questions, not
   one.

**This pass does not invent a human approver for item 6, and does not bundle these eight behind one
"D04 blocked" label** — each is independently answerable and independently unlocks its own next
implementation step (named in the requirement matrix below).

---

## D05 — Data-rights export scope and retention (proposal), from the actual schema

### Field-level export scope proposal

Built from the real schema (read via `\d` against the owned local Postgres, this pass), not from
memory of the data model.

| Category | Tables / fields | Proposed for export? | Reason |
|---|---|---|---|
| Buyer profile | `buyer_accounts`: `email`, `full_name`, `phone`, `status`, `created_at` | **Yes** | Directly the buyer's own identity data. |
| Buyer profile — credentials/security material | `buyer_accounts.password_hash`, `session_epoch`; `buyer_authorization_codes`; `buyer_email_challenges`; `buyer_firebase_links` | **No** | Security material, not personal data the access right is meant to disclose — exporting a password hash or an active auth code would itself be a security risk, not a compliance benefit. |
| Buyer addresses | `buyer_addresses` (all columns except nothing — the whole row is the buyer's own shipping data) | **Yes** | Entirely buyer-authored. |
| Buyer-authored request content | `support_tickets` rows they are the `requester_user_id` of; `ticket_messages` they authored (`author_type='requester'`) | **Yes**, their own authored text only | Never another party's messages on the same thread (an agent's internal note, `visibility='internal'`, is the platform's operational data, not the buyer's). |
| Buyer-visible order info | Orders reachable via `buyer_order_links` → `orders`/`order_items` for **their own** orders only | **Yes**, commerce fields only (items, amounts, status, dates) | Never another buyer's order on the same merchant, never the merchant's internal notes on the order. |
| Buyer behavioral/engagement data | `buyer_notifications`, `loyalty_accounts` + ledger, `seller_follows`, `buyer_product_views` | **Proposed yes**, but flagged for an explicit decision — `buyer_product_views` in particular is browsing history a buyer may not expect to be able to export/see itemized. |
| Merchant-internal info about the buyer | `risk_scores`, `ts_cases`/`ts_evidence` (Trust & Safety), ticket `assignee_id`, internal-visibility ticket notes | **No** | This is the platform's/merchant's own operational risk assessment, not the buyer's personal data — exporting it would disclose the platform's fraud-detection reasoning. |
| Other people's personal data incidentally present | An agent's name/email on a ticket thread; another buyer's data on a shared resource (none currently identified, but the principle applies) | **No** | The access right is to the requester's own data, never a third party's. |

**No compliance duration is invented here** — the table above is a technical classification of
*what exists and what it is*, not a legal retention period.

### The 8 separate decisions

1. **Export scope** — accept the classification above, amend it, or replace it?
2. **Requester verification/step-up** — what proves the person asking for their own export *is*
   that buyer, beyond an already-authenticated session? (E.g., re-authentication, a cooling-off
   period before release.) Not decided or implemented.
3. **Release/download protection** — how is an export delivered — signed URL with expiry,
   password-protected, in-app only? Not decided or implemented.
4. **Retention categories** — which of the tables above have a defined retention window at all
   today? None do; every table above retains indefinitely unless explicitly deleted.
5. **Deletion exceptions** — which categories must survive an erasure request regardless (e.g.,
   financial records for tax/audit purposes, fraud-investigation evidence)? Not decided.
6. **Legal hold** — is there a mechanism to pause deletion for a specific buyer under active dispute
   or investigation? Not implemented.
7. **Deletion approval** — does erasure execute automatically once approved-scope is met, or does
   it require a human sign-off step per request? Not decided.
8. **Incident ownership** — if an export or erasure is executed incorrectly (wrong buyer, incomplete
   scope), who is the accountable owner for remediation? Not decided.

**Deletion execution remains unimplemented until these are answered** — this is unchanged from the
prior pass's conclusion and is restated, not silently dropped, per Mandate 5's explicit instruction.
A safe technical contract (e.g., a typed `ExportRequest`/`ErasureRequest` interface with the fields
above as its shape) or a local synthetic export-generation test **could** proceed once export scope
(#1) alone is accepted, without waiting on retention (#4–8) — but no such contract was built in this
pass, since #1 itself remains a proposal, not yet an `OWNER_DECISION`.

---

## Concise owner answer form

```
D03: [ ] Option A (complete transition now)   [ ] Option B (accept staged milestone) — recommended
D04.1 role capabilities:        [ ] as proposed   [ ] amended: __________
D04.2 who assigns roles:        __________
D04.3 bootstrap authority:      __________
D04.4 recovery approver:        __________
D04.5 MFA enrollment model:     [ ] admin-provisioned (current)   [ ] self-service
D04.6 high-risk dual approval:  [ ] required   [ ] not required (audit log sufficient)
D04.7 canonical identity:       (follows D03)
D04.8 delivery/provider:        [ ] wire resend-adapter now   [ ] defer
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

## Phase requirement matrix (Mandate 5 §18C)

| Capability | Status |
|---|---|
| Server-side recompute of totals/tax/shipping/entitlements | implemented-and-verified (pre-existing, unchanged by Phase 2) |
| Tenant isolation backstop (RLS + FORCE + GUC) | implemented-and-verified (pre-existing; `service_role` bypasses RLS at the DB level as documented — the app-layer tenant guard is the real backstop for gateway traffic, a documented architectural fact) |
| Staff RBAC fail-closed, revocation-immediate | **implemented-and-verified this pass** (§2–3, §9 of `SECURITY_ACCEPTANCE.md`) |
| Staff provisioning (verified-email direct-add) | **implemented-and-verified this pass** (§2) |
| Write-implies-read permission primitive | **implemented-and-verified this pass** (§3) |
| Privacy request intake (honest status, real idempotency) | **implemented-and-verified this pass** (§4–5) |
| Cross-tenant ticket leak (employee `/tickets`) | **fixed and verified this pass's predecessor, re-confirmed this pass** (§4, §7) |
| `GET /products/:id` tenant-guard 500 + staff recognition | **implemented-and-verified this pass** (§6 of prior pass, re-confirmed here) |
| Sole-issuer/session model unification (D03) | not-implemented — blocked on D03 owner decision |
| Organization-model convergence (identity-foundation activation) | not-implemented — dormant scaffold, blocked on D03 |
| Console authorization tiers (D04.1–3) | not-implemented — blocked on D04 owner decisions |
| Operator bootstrap/recovery (D04.3–4) | not-implemented — blocked on D04 owner decisions |
| Console magic-link production delivery | not-implemented — external-activation-requirement (adapter exists, wiring + provider config + policy all pending D04.8) |
| Data export execution (D05) | not-implemented — blocked on D05 owner decisions (scope proposal only) |
| Data deletion/retention execution (D05) | not-implemented — blocked on D05 owner decisions |
| Full local gate green | **not-implemented** — 5 lanes red; 3 fully attributed to pre-existing/unrelated causes, 1 (`merchant-web`) majority-attributed, 1 (`tests:all`) attributed for its first failure only (see §9 of `SECURITY_ACCEPTANCE.md`) |
