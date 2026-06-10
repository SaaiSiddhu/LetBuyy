# IDENTITY GOVERNANCE MODEL (net-new)
### 2026-06-09 · ANALYSIS-ONLY · no single predecessor in the corpus (governance is scattered as ad-hoc "Findings A-1/K-1/…")

> **Why net-new.** The corpus makes architectural decisions but has **no governance mechanism**: decisions live as inline "Findings," there is no ADR process, no CI gate prevents the regressions the audit found (the `unstyled` loophole, two Turnstile validators, six dev-bypass forks, checked-in secret literals), and `scripts/validate-governance.mjs` is breadth (172 validators) without identity-specific depth. This model makes the recovery *stick* — it is the difference between fixing the issues once and preventing their return.

---

## 1. Governance principles
1. **One primary owner per capability** (`IDENTITY_OWNERSHIP_MATRIX.md`) — ambiguity is a governance defect, not a nuance.
2. **Decisions are ADRs, not comments.** Every architectural choice (realm boundary, key algorithm, A-1) is a numbered, dated, status-tracked ADR.
3. **Gates over guidelines.** A standard not enforced in CI is a suggestion; identity standards are enforced or they don't exist.
4. **Prefer deletion/consolidation; new systems require an ADR with a "why not extend?" section.**
5. **Truth over theater** — "172 validators pass" is not "production-ready"; gates measure outcomes (the `/switch` ATO must be *un-exploitable*, proven by a test), not document counts.

---

## 2. Architecture Decision Records (ADR process)
- **Location:** `docs/auth/adr/NNNN-title.md`; **status:** Proposed → Accepted → Superseded.
- **Migrate the scattered Findings into ADRs:** A-1 (membership graph → Identity, **needs human sign-off**), K-1 (ES256 over EdDSA), the OIDC decision, the bounded-claims threshold, the agency sub-delegation cap, BYOK scope. Each gets an ADR with context/decision/consequences/alternatives.
- **Rule:** no PR that changes realm boundaries, token shape, key strategy, ownership, or a cookie/secret may merge without a referenced Accepted ADR. **A-1 specifically blocks the org/permission build until ratified** (it is currently unratified — the single highest-leverage governance action).

---

## 3. Ownership rules
- Every capability maps to exactly one primary owner (`IDENTITY_OWNERSHIP_MATRIX.md`); the Gateway is always PEP, never an authoritative owner.
- **No component writes across the Identity/Commerce boundary;** cross-reads go through published APIs (Membership API, Entitlement snapshot, JWKS). A PR that adds a cross-boundary SQL join fails review.
- A new identity table/secret/cookie requires an owner declaration + an entry in the ownership matrix.

---

## 4. The gate stack (concrete pass-criteria)

### 4.1 Security gates (block release)
- **No checked-in secret literals** — CI greps for the three known patterns (`dev-only-console-session-secret`, `letbuyy-local-mock-kms-envelope-secret`, `dev-only-insecure-auth-secret…`) and any `*_SECRET = '…'` literal; fail the build.
- **Prod-detection unification** — a lint rule forbids new "is this prod?" predicates; all must call the single canonical helper (kills the 6-way dev-bypass fork).
- **No raw-token-in-JSON** — response bodies may not contain `access_token`/`refresh_token` (target invariant).
- **Auth-primitive singletons** — exactly one Turnstile verifier, one CSRF mechanism, one JWT signer module (CI asserts import graph).
- **S0 regression tests** — the `/api/auth/switch` takeover and the console-secret fallback have explicit failing-if-reintroduced tests.

### 4.2 Release gates
- OIDC provider flags (`FEATURE_IDENTITY_PROVIDER`, `FEATURE_NEW_KEY_SERVICE`) **cannot ship enabled in production until** a real (non-mock) key service is wired (asserted by a test that rejects `mock` JWKS in prod).
- Check-API SLO met (`PERMISSION_ARCHITECTURE §4`: p99 ≤ 15ms cached, hit-rate ≥ 95%) before any client federates.
- Design-system: no new `unstyled` on DS components, no `globals.css` growth (see §5).

### 4.3 Migration gates (per Recovery Plan wave)
- Dual-accept + shadow-compare parity ≥ N days (define N per wave) before enforce.
- Per-cohort/per-merchant flag rollback proven in staging.
- `node scripts/validate-governance.mjs` green **plus** the identity-specific gates above.
- Go/No-Go checkpoint at every wave boundary with named approvers.

### 4.4 Operational gates
- **Operational readiness ≥ 75** (`IMPLEMENTATION_READINESS_REVIEW` binding constraint) before Wave 1: IdP HA/DR drilled, KMS provisioned + key-failover tested (`KEY_ROTATION_AND_CRYPTOGRAPHY §3`), audit chain-verification job running (`AUDIT_ARCHITECTURE §3`), on-call + runbooks for compromise/rotation/chain-failure.
- SLOs defined and monitored: auth error rate, login success, token-verify latency, check-API latency, JWKS availability, audit ingest lag.

---

## 5. Design-system enforcement (makes Identity the reference)
| Control | Gate |
|---|---|
| Promote 3 `warn` lint rules → **`error`** | `no-raw-form-controls`, `no-raw-color-functions`, `no-tailwind-default-color` (`eslint.config.mjs:14-22`) |
| New rule: **ban `unstyled` on DS components** in the identity surface | the loophole that hid the shadow design system |
| Stylelint: **ban raw hex/rgb/px** in app CSS; require `--lb-*` | closes the parallel token namespace |
| CI: **`globals.css` line count may not increase** | forces the shadow stylesheet to shrink monotonically |
| Accessibility CI (axe) on every identity surface | WCAG 2.1 AA (`IDENTITY_UI_ARCHITECTURE §3`) |

---

## 6. Standards (platform / identity / audit / documentation)
- **Platform standards:** one issuer host; realm isolation by construction; PKCE for all public clients; no app-asserted identity headers; mTLS for S2S (Wave 8).
- **Identity standards:** opaque realm-scoped `sub`; claims are a cache not authority (re-check on sensitive ops); sessions server-revocable; refresh rotates with reuse detection; per-realm asymmetric keys.
- **Audit standards:** every security/admin/impersonation/consent event 100% retained, WORM 7y, hash-chained + Merkle-anchored, `correlation_id` mandatory (`AUDIT_ARCHITECTURE`).
- **Documentation standards:** every architectural change updates its owning doc + an ADR; the ownership matrix is the single source for "who owns X"; superseded docs are marked, not deleted; **claims in design docs cite source code** (the standard this whole audit program followed).

---

## 7. Governance cadence
- **Per-PR:** the §4.1 + §5 gates run automatically.
- **Per-wave:** §4.3 migration gate + Go/No-Go.
- **Quarterly:** key-rotation + compromise drill (`KEY_ROTATION_AND_CRYPTOGRAPHY §1`); audit chain full-verify review; ownership-matrix reconciliation; ADR backlog review.
- **On incident:** post-mortem → ADR if it changes architecture → new gate if it was a preventable regression.

> The test of this model: the audit's findings (account-takeover, secret literals, duplicate validators, the `unstyled` loophole) should each have a gate that makes their reintroduction fail CI. If a finding has no corresponding gate, the governance model is incomplete.
