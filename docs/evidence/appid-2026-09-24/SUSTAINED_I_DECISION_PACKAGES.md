# SUSTAINED-I — decision packages for both open `BLOCKED_DECISION`s (workstream 8)

Per the owner's instruction: not a vague "which should win?" question, and not a recommendation to
extend a noncanonical scaffold permanently. Both packages below name the exact unresolved question,
cite canonical-registry evidence already on record (not invented for this phase), lay out the real
alternatives, and give a recommendation — recorded as a recommendation, never self-authorized as an
`OWNER_DECISION`.

---

## Decision package 1 — merchant staff-membership mechanism

### The exact unresolved question

Not "which of three systems should be canonical" — that question already has a recorded answer.
The unresolved question is: **when and how does `employees` (the live mechanism) get replaced by
`identity-foundation`'s org model (the declared target), and what happens to `site_memberships`/
`site_roles` (a superseded intermediate system) in the meantime — specifically, is there a
data-migration and cutover plan the owner will authorize, and on what timeline relative to the
merchant-realm identity migration this depends on?**

### Canonical-registry evidence — this is a recorded decision, not an open architecture question

`docs/auth/2026-06-09-identity-execution-recovery/FOUNDATION_VALIDATION_REPORT.md` (2026-06-09, a
methodologically explicit "code re-audited as source of truth, documents not trusted blindly" audit)
row **CD-S0-1** / the corrected old-framing row:

> `"v2 foundation is dead" (old framing) | delete candidate | **NOT REPRODUCIBLE — CORRECTED** |
> migration `159_identity_foundation_core.sql` present; `services/api-gateway/src/identity-foundation/`
> present; **19 default-off `FEATURE_` flags**. It is **dormant target, not dead code — KEEP.**`

This is an explicit, dated, evidence-checked correction of the "identity-foundation is abandoned
debt" framing this session's SUSTAINED-F investigation could otherwise have repeated. Measured
independently in this phase, confirming that finding still holds: `packages/auth-core/src/feature-
flags.ts`'s `IDENTITY_FOUNDATION_FEATURE_FLAGS` includes `FEATURE_ORG_MODEL` and
`FEATURE_NEW_PERMISSION_ENGINE`, both resolved via `env[flag] === 'true'` — off by default, on only
by explicit configuration. `identity-foundation/repository-boundary.ts`'s own `LEGACY_REPOSITORY_
TABLES` constant names `site_memberships`/`site_roles` as the system identity-foundation is designed
to *replace*, not a peer it coexists with. So the registry's own classification is:

- `employees` — **live**, decides every real request today (confirmed by SUSTAINED-F: `middleware/
  staff-permission.ts`, mounted on live routes).
- `site_memberships`/`site_roles` — **superseded intermediate**, fully built, correctly never
  mounted, explicitly labeled legacy by the system meant to replace it.
- `identity-foundation`'s org model — **the declared canonical target**, deliberately dormant behind
  feature flags pending a phased cutover, not a third competing candidate.

### Sequencing evidence

`docs/auth/2026-06-09-identity-execution-recovery/IDENTITY_IMPLEMENTATION_WAVES.md`'s stated OIDC
rollout order: **"merchant CP → console → marketplaces → customer/checkout → mobile."** Measured
this phase: `apps/merchant/web` still authenticates staff purely through `apiClient.employees.*`
(`apps/merchant/web/src/app/api/stores/[store]/users/route.ts`) with zero references to
identity-platform verification anywhere in its source. **The wave-1 prerequisite (merchant realm
onto identity-platform OIDC) has not started.** Activating `FEATURE_ORG_MODEL`/`FEATURE_NEW_
PERMISSION_ENGINE` for staff membership before that lands would be executing wave 2+ before wave 1,
against the plan's own stated dependency order.

### Alternatives, with tradeoffs

1. **Activate `identity-foundation`'s org model for staff membership now, independent of the OIDC
   wave order.** Pro: closes the "three mechanisms" ambiguity fastest. Con: the org model's own
   `permission-engine.ts`/`realm-registry.ts` were built assuming the identity-platform-issued token
   shape (`FEATURE_NEW_PERMISSION_ENGINE`'s sibling flags gate session/audit/MFA engines together) —
   activating permissions without the session layer it was designed against is very likely to need
   its own hardening pass, not a flip of one flag. Not recommended without first re-auditing whether
   this specific slice is safe to decouple from the rest of the wave.
2. **Do nothing; keep `employees` live indefinitely.** Pro: zero risk, zero effort. Con: leaves two
   fully-built, unused systems in the tree accumulating drift from `employees`' own evolution (every
   phase since APPID-P5b that touched staff permissions touched only `employees`), making a future
   cutover progressively more expensive to validate. Not recommended as a standing position, though
   it is the correct default *until* the owner authorizes the next step.
3. **(Recommended) Authorize a bounded APPID-scale phase to migrate the merchant realm onto
   identity-platform OIDC first (wave 1, per the existing plan), with staff-membership unification
   as part of that same phase's scope** (since the org model's permission engine is designed against
   that session shape, doing them together is less risky than sequencing them apart). This is not a
   new architectural decision — it is executing a decision the registry already recorded, with the
   owner's authorization needed for: the specific migration/rollback plan, the data-migration
   mapping from `employees` rows to the org model's `store_memberships`, and the cutover timeline.
4. **Delete `site_memberships`/`site_roles`** (confirmed zero live callers) as a small, independent,
   low-risk cleanup — not blocked by the above, since it is provably dead code today, not a
   migration decision. Worth doing regardless of when wave 1 happens.

### Recommendation

Authorize alternative 3 as the next bounded phase after this acceptance-closure pass, with
alternative 4 (deleting the confirmed-dead `site_memberships`/`site_roles`) as a small, separable,
lower-risk first step that can proceed independently and immediately. Do not activate
`FEATURE_ORG_MODEL` alone (alternative 1) without first re-verifying its coupling to the session/MFA
flags it ships alongside.

---

## Decision package 2 — operator (console) identity integration

### The exact unresolved question

Not "should `apps/internal/console` migrate to identity-platform" — the target is already recorded
in two independent places. The unresolved question is: **what is the owner-authorized MFA,
bootstrap, and privilege policy for the console's Admin realm on identity-platform, and does the
owner want console migrated before or after the merchant-realm wave-1 migration the existing plan
sequences ahead of it?**

### Canonical-registry evidence

`docs/auth/2026-06-08-identity-platform-transformation/AUTHORITY_MATRIX.md`, row 3:

> `| 3 | **Authentication (staff/admin)** | Platform Console (`console-auth-server.ts`) + gateway
> allowlist/employees | **Identity Platform – Admin realm** (broker to IdP/SSO) | L | 🔴 |`

An explicit current-authority → target-authority mapping, dated 2026-06-08, marking this row 🔴
(highest severity/priority in that matrix's own scale). This matches — and predates — the currently
maintained `CLAUDE.md` memory's own statement of the target ("`identity-platform` must be the sole
asymmetric token issuer for all three realms — merchant/staff, buyer/customer, platform-operator").
Two independently-dated sources agree: this is a recorded target, not an open design question.

What is **not** recorded anywhere: the specific MFA/bootstrap/privilege policy for how operators get
onto that Admin realm (how the first operator account is created without a chicken-and-egg problem,
what MFA factor is mandatory, how privilege escalation for a `super_admin`-equivalent role is
gated). SUSTAINED-E's own investigation found the exact same gap and correctly did not invent an
answer — this package does not either.

### What SUSTAINED-E already hardened, and its limit

SUSTAINED-E (this session) hardened `apps/internal/console`'s *existing*, non-identity-platform-wired
MFA (lockout, replay rejection, constant-time compare) — a real, independent improvement to the
current scaffold's TOTP check. This is explicitly **not** a step toward making that scaffold the
permanent solution: `login/route.ts` still refuses outright in any production-like runtime (`NODE_
ENV === 'production'` → `magic_link_delivery_not_configured`), so the hardening closes a real gap in
a dev-only path without extending it toward production use. Per the owner's instruction not to
extend a noncanonical scaffold as permanent: this phase does not propose further hardening of that
scaffold as a substitute for the actual migration.

### Alternatives, with tradeoffs

1. **Migrate console to identity-platform's Admin realm now, ahead of the merchant-realm wave-1
   migration the existing plan sequences first.** Pro: closes the console's own gap fastest,
   independent of merchant-realm timing. Con: identity-platform's Admin realm does not yet exist as
   a distinct, audited realm (only buyer and the aspirational merchant target are documented in any
   depth this phase found) — building it for console first means building realm-separation
   guarantees (ART-05/R-14's "realm privileges strictly separated") without merchant-realm's own
   migration to validate the pattern first. Higher risk of getting the realm boundary wrong on the
   first attempt.
2. **Follow the existing wave order** (merchant CP → console): let merchant-realm OIDC migration
   validate the identity-platform-as-issuer pattern in a lower-blast-radius realm first (merchant
   staff, not platform operators with `super_admin`-equivalent reach), then apply the proven pattern
   to console. Con: console's real gap (a scaffold that refuses in production, so *today* not
   reachable live) stays unresolved longer, but it is not an active production exposure while
   refusing outright.
3. **(Recommended, matching the existing plan) Alternative 2**, with the explicit owner decisions
   this phase can name precisely: (a) MFA factor mandate for the Admin realm — this session's own
   research (`AUTHENTICATOR_STRATEGY.md`) already recommends TOTP minimum, aal3 (hardware key/
   passkey) for `super_admin`/break-glass — a concrete starting proposal, not an invented one; (b)
   bootstrap: how the first operator account is provisioned without a circular dependency, not
   addressed in any doc this phase found — a genuine open question needing the owner's word; (c)
   whether the existing static `platform-console@letbuyy.local` synthetic principal (`AUTHORITY_
   MATRIX.md` line 52, flagged 🔴, "must not widen") is retired or constrained to read-only as part
   of the same phase.

### Recommendation

Authorize alternative 3: follow the existing, evidence-based wave order (merchant realm first), and
treat the MFA/bootstrap/privilege questions above as the owner-decision items a future bounded
APPID-scale phase needs answered before console migration starts — using `AUTHENTICATOR_STRATEGY
.md`'s TOTP+aal3 recommendation as the starting proposal for (a), not inventing a new one, while
leaving (b) and (c) genuinely open for the owner.

---

## What this package does not do

Neither package resolves its `BLOCKED_DECISION` — both remain open, correctly. This phase's own
authorization does not extend to authorizing a new multi-phase migration programme; it produces the
evidence and recommendation the owner needs to authorize one, which is what was asked for.
