# GAP ANALYSIS REPORT — Identity Recovery Plan, Architecture Enhancement Pass
### 2026-06-09 · ANALYSIS-ONLY · Shopify-scale lens (100k merchants · millions of customers · agencies · enterprises · 3P devs)
### Principal Identity / Security / Platform / IAM / Multi-Tenant SaaS Architecture

> **Framing — read this first.** This pass evaluates `IDENTITY_FOUNDATION_RECOVERY_PLAN.md` *and* the design corpus it builds on (`docs/auth/2026-06-08-identity-platform-transformation/`, 30 docs). A critical finding up front: **6 of the 9 documents this pass requested already exist as strong predecessors** in that corpus — `ORGANIZATION_ARCHITECTURE`, `PERMISSION_MODEL`, `AUDIT_LOG_ARCHITECTURE`, `KEY_MANAGEMENT_ARCHITECTURE`, `AUTHORITY_MATRIX`, `IDENTITY_DATA_MODEL`. Re-deriving them from scratch would violate the recovery plan's own first principle ("prefer consolidation over new systems; don't reinvent"). Therefore every document this pass produces is an **enhancement-delta**: it references the existing doc, declares what is already strong, and designs only the **white space** — the things genuinely missing at Shopify scale. The two areas with **no predecessor** (UI architecture, governance model) get full treatment.

---

## 1. Is the current plan sufficient for Shopify-scale? — verdict

**Design sufficiency: ~80% there. Implementation sufficiency: ~0%. Scale-robustness of the design: ~60%.**

The plan + corpus describe a genuinely credible world-class IdP (3 realms, OIDC/PKCE, per-realm asymmetric keys, server-side revocable sessions, ReBAC→RBAC→ABAC, org graph, hashed tokens, tamper-evident audit). For the *common* cases — one merchant/many stores, many staff/one store, temporary support access — it is **sufficient and well-specified**. It is **not yet sufficient** for the hard multi-tenant cases that define Shopify scale, and it has **zero** of it running. The white space clusters in nine areas (§3).

### Scale-question scorecard (verified against the corpus)
| # | Question | Status | Where |
|---|---|:--:|---|
| 1 | One merchant → many stores | ✅ Sufficient | `ORGANIZATION_ARCHITECTURE §2,§9` |
| 2 | Many staff → one store | ✅ Sufficient | `PERMISSION_MODEL §5.2`; `store_memberships` |
| 3 | Agencies manage client stores | ⚠️ Conceptual, mechanically thin | `ORG §8.2`; delegation fan-out unspecified |
| 4 | Enterprises manage multiple brands | ⚠️ Asserted, not designed | `ORG §9`; "brand" not first-class |
| 5 | Developers limited to dev resources | ⚠️ Partial | `PERMISSION_MODEL §5.2`; no sandbox/prod axis |
| 6 | Billing delegation | ❌ Missing | `billing.*` perms exist; delegation undesigned |
| 7 | Temporary support access | ✅ Sufficient | `PERMISSION_MODEL §8` (break-glass, JIT, time-boxed) |
| 8 | SCIM / enterprise provisioning | ❌ Deferred | `IMPLEMENTATION_READINESS_REVIEW G-12`; no schema hooks |

---

## 2. What is already strong (do not rebuild)
Per the corpus re-read: realm isolation (`REALM_ARCHITECTURE`), OIDC client inventory of 15 clients (`OIDC_CLIENT_INVENTORY`), the three-layer session model with per-realm TTLs (`SESSION_MANAGEMENT`), the canonical Identity DB with seed-from mapping (`IDENTITY_DATA_MODEL`), the ReBAC/RBAC/ABAC split (`PERMISSION_MODEL`), the org lifecycle state machines + 7 business models (`ORGANIZATION_ARCHITECTURE`), per-realm ES256 keys + 90-day rotation + compromise runbook (`KEY_MANAGEMENT_ARCHITECTURE`), tamper-evident audit taxonomy + envelope (`AUDIT_LOG_ARCHITECTURE`), and the temporary-access / impersonation models. These are credible and are treated as ratified inputs.

---

## 3. The nine white-space gaps (what the enhancement docs design)

| # | Gap (genuinely missing / under-specified at scale) | Severity | Filled in |
|---|---|:--:|---|
| G-A | **ReBAC permission caching + invalidation + check-API SLO + materialization threshold** — named everywhere, designed nowhere (`PERMISSION_MODEL §11` "cached, short TTL" only). The hot path for 100k merchants. | 🔴 | `PERMISSION_ARCHITECTURE.md §4` |
| G-B | **Billing/subscription ownership + billing delegation + plan→ABAC contract** — `Subscriptions` has no owner anywhere; ABAC "plan" condition has no source. | 🔴 | `IDENTITY_OWNERSHIP_MATRIX.md`; `PERMISSION_ARCHITECTURE.md §6` |
| G-C | **Customer-realm authorization plane + B2B customer-company buyer roles** — `PERMISSION_MODEL` is entirely merchant/staff; millions of customers have no authz model. | 🔴 | `PERMISSION_ARCHITECTURE.md §7`; `ORGANIZATION_ARCHITECTURE.md §6` |
| G-D | **Agency at fan-out scale** — sub-delegation, permission-filtered delegation, representing >25 delegated stores vs the bounded-claims cap. | 🟠 | `ORGANIZATION_ARCHITECTURE.md §3-4` |
| G-E | **Enterprise: SCIM provisioning + brand-as-first-class + enterprise custom org roles + SSO group mapping** — deferred (`G-12`); no schema hooks reserved. | 🟠 | `IDENTITY_DOMAIN_MODEL.md §5`; `ORGANIZATION_ARCHITECTURE.md §5` |
| G-F | **Multi-region key residency + JWKS offline-validation window + KMS-outage degradation + per-tenant BYOK** — everything pinned to `ap-south-1`; IdP/key single-region SPOF (`C-1`). | 🔴 | `KEY_ROTATION_AND_CRYPTOGRAPHY.md §3-5` |
| G-G | **Audit hash-chain verification cadence + cross-partition ordering + volume budget/sampling + tenant-export service** — `AUDIT §6` names anchoring but no cadence/scope; volume unbudgeted (`G-11`). | 🟠 | `AUDIT_ARCHITECTURE.md §4-6` |
| G-H | **Permission/role catalog governance + custom-role lifecycle + versioning/migration** (`M-4`). | 🟠 | `PERMISSION_ARCHITECTURE.md §3`; `IDENTITY_GOVERNANCE_MODEL.md §5` |
| G-I | **Identity UI/UX reference architecture + identity governance model** — no predecessor in the corpus at all. | 🟠 | `IDENTITY_UI_ARCHITECTURE.md`; `IDENTITY_GOVERNANCE_MODEL.md` |

Plus a cross-cutting reconciliation defect: **`AUTHORITY_MATRIX` is a Phase-2 artifact stale vs the Phase-16/17 design** — its rows #4/#18 say membership/authz "stays in Commerce," which `IMPLEMENTATION_READINESS_REVIEW` A-1 supersedes, and it lacks rows for Organizations, Teams, Delegation, Impersonation, Audit, Keys, and Subscriptions. Fixed in `IDENTITY_OWNERSHIP_MATRIX.md`.

---

## 4. Re-score of the recovery plan (Shopify-scale, critical)

| Dimension | Score | Rationale |
|---|:--:|---|
| **Architecture** | **80 / 100** | Design is genuinely strong and standards-aligned; loses points for the stale authority matrix, the unratified A-1 boundary, and customer-realm authz being absent from the design. |
| **Security** | **70 / 100** | Plan now leads with the S0 hotfixes (good), per-realm asymmetric keys retire shared HMAC; but the live `/switch` ATO persists until shipped, customer authz is undesigned, and multi-region key SPOF + BYOK gaps are real for enterprise. |
| **Scalability** | **60 / 100** | The weakest axis. ReBAC caching/invalidation undesigned (G-A), agency fan-out vs bounded-claims (G-D), audit volume unbudgeted (G-G), single-region keys (G-F), `account_links` pairwise N² (data model). |
| **Governance** | **46 / 100** | No governance model doc existed; ADRs scattered across docs as "Findings A-1/K-1/…"; catalog governance undesigned (G-H); "167 validators" is breadth not depth. This pass creates the model but the org-maturity gap is real. |
| **Identity Maturity** | **38 / 100** | Versus a world-class IdP (Auth0/Okta/WorkOS): design-mature but **0% live**, no SCIM, no customer authz plane, no BYOK, no multi-region, no production key service (mock only). Mature *blueprint*, immature *platform*. |

> Scoring note: these grade the **design's readiness to scale**, not effort. A high Architecture score with a low Identity-Maturity score is the signature of *good design, nothing shipped* — which is exactly this program's state (`CODEX_…_STATUS`: built dormant, switched off).

---

## 5. Top 20 remaining risks preventing a world-class identity platform

**Severity: 🔴 critical · 🟠 high · 🟡 medium**

1. 🔴 **Live `/api/auth/switch` account-takeover** ships in production today; the corpus treats it as benign (`switch/route.ts:22,61-64`). Until the Wave −1 hotfix lands, every other ambition is moot.
2. 🔴 **0% of the target is live.** Key service is mock (`crypto.ts:146`), OIDC endpoints 501, all 15 flags off. Risk is *organizational*: a 30-doc design with nothing shipped tends to ossify.
3. 🔴 **ReBAC check-API has no caching/invalidation/SLO design (G-A).** At 100k-merchant QPS this is the hot path; an unspecified invalidation story is a correctness *and* latency landmine.
4. 🔴 **Single-region keys + KMS (`ap-south-1`) = signing SPOF (G-F).** A regional KMS outage halts token issuance platform-wide; no failover, no offline-validation window beyond a 24h JWKS cache.
5. 🔴 **Customer-realm authorization is entirely undesigned (G-C).** Millions of customers + future B2B buyers have no permission model; checkout/account scopes are hand-waved.
6. 🔴 **`service_role`/BYPASSRLS tenancy with a dead RLS net** is deferred to Wave 8; SSO multiplies the blast radius of one missing predicate before the net exists.
7. 🔴 **Billing/subscription ownership is missing (G-B).** No owner row, no delegation, and ABAC's "plan" condition has no source — plan-gated authorization cannot be enforced.
8. 🟠 **Agency fan-out breaks the bounded-claims model (G-D).** A 500-store agency operator resolves every request through the (uncached) check-API; no sub-delegation; no permission-filtered delegation.
9. 🟠 **SCIM / enterprise provisioning deferred with no schema hooks (G-E).** First enterprise deal will force a migration, not a config; deprovisioning (the security-critical half) is unaddressed.
10. 🟠 **Audit hash-chain has no verification cadence and ambiguous cross-partition ordering (G-G).** The load-bearing tamper-evidence control is asserted, not operable; broken-chain alerting undefined.
11. 🟠 **Authority matrix is stale (Phase-2 vs Phase-16/17).** Org/Team/Delegation/Impersonation/Audit/Keys/Subscriptions have no ownership rows; A-1 boundary unreconciled → ambiguous ownership in practice.
12. 🟠 **A-1 (membership graph → Identity) is unratified** but the entire org/permission design depends on it. Building before sign-off risks rework; not building blocks the org model.
13. 🟠 **No dev/sandbox-vs-prod resource isolation axis (scale-Q5).** The Developer role even includes `theme.*` on live stores; 3P devs cannot be safely confined.
14. 🟠 **Permission/role catalog governance undesigned (G-H).** Who registers a permission, how renames migrate, custom-role sprawl at 100k merchants — all open.
15. 🟠 **No per-tenant BYOK/CMEK (G-F).** Enterprise/regulated customers commonly require it; keys are per-realm, never per-org.
16. 🟠 **Identity UX is a shadow-CSS, half-DS-adopted surface (G-I)** that must become the *reference* for the ecosystem; today it has silent screen-reader errors, removed focus rings, and a 1,984-line shadow stylesheet.
17. 🟡 **`account_links` is pairwise (N²)** — a person with many linked identities has no canonical-person entity; cross-realm linking won't scale cleanly.
18. 🟡 **Operational maturity 58/100 is the binding gate** (`IMPLEMENTATION_READINESS_REVIEW`). Eight human-required provisioning items (Hydra, KMS, DLT, residency) gate Wave 0; the team's run-capability is the real constraint, not code.
19. 🟡 **The `.store`→`.com` SEO migration and the cookie-domain cutover are not jointly designed** — sequencing error breaks SSO/logout (Recovery Plan §6/§15 Wave 2).
20. 🟡 **No governance gates exist to prevent regression** — design-system `unstyled` loophole, duplicate auth primitives (two Turnstile validators, six dev-bypass forks) recur because nothing in CI forbids them (addressed in `IDENTITY_GOVERNANCE_MODEL.md`).

---

## 6. Deliverables produced by this pass
`GAP_ANALYSIS_REPORT.md` (this) · `IDENTITY_DOMAIN_MODEL.md` · `ORGANIZATION_ARCHITECTURE.md` · `PERMISSION_ARCHITECTURE.md` · `IDENTITY_OWNERSHIP_MATRIX.md` · `AUDIT_ARCHITECTURE.md` · `KEY_ROTATION_AND_CRYPTOGRAPHY.md` · `IDENTITY_UI_ARCHITECTURE.md` · `IDENTITY_GOVERNANCE_MODEL.md` — all in `IDENTITY_RECOVERY_ENHANCEMENT/`, all enhancement-deltas over the named corpus predecessor (or net-new where none exists). **No source code modified; no migrations; no implementation.**
