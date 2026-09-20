# DOCUMENT 1 — FOUNDATION FREEZE CERTIFICATION

**Status:** CERTIFIED FROZEN as of 2026-06-12, tree `5c2d3993` (`main` == `stepup/main`, gate GREEN, 105 validators).
**Evidence basis:** `FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/`, `FINAL_TRUTH_AUDIT_2026_06_11/COMPLETION_REPORT.md`, gate output at HEAD, Constitution + root `AGENTS.md`.

This document declares the six freezes that the Launch Readiness Program operates under, with the validator that enforces each one. A freeze is not a promise — it is a gate failure waiting to happen if violated.

---

## 1. THE SIX FREEZES

### 1.1 Architecture Frozen
The runtime topology is final: a modular monolith (`services/api-gateway`) plus 3 deployed satellites (`mobile-bff` proxy, `webhook-service`, `queue-workers`), 6 web/mobile app runtimes, 6 reserved manifest-only services, 2 reserved mobile roots, 4 frozen apps marked `"frozen"/"not-deployed"` in `config/runtime/production-topology.json`.
**Enforced by:** runtime-topology validator, no-reserved-service-activation validator, no-rejected-package-imports validator, deployment-lineage manifest checks.
**Forbidden forever (Constitution-rejected):** microservices decomposition, CQRS, event sourcing, saga orchestration, extension/Wasm runtime in the live path, marketplace architecture, multi-region/failover topology.

### 1.2 Governance Frozen
One authority chain: Constitution → root `AGENTS.md` (hand-authored V2) → local `AGENTS.md` (77, all deferring) → rewrite docs. The prompt perimeter is registry-controlled (`PROMPTS.md`) and validator-policed. Generated law is banned (`no-scan-generated-AGENTS` validator).
**Enforced by:** prompt-perimeter validator, whole-repo-end-state validator (root md allowlist of 9), no-scan-generated-AGENTS validator.

### 1.3 Identity Frozen
`apps/identity-platform` is the sole token issuer (asymmetric); all other runtimes verify only. Step-up is cryptographic (TOTP-gated short-lived HMAC tokens), not a placeholder. OIDC endpoints remain 501 behind `FEATURE_IDENTITY_PROVIDER` until the live seam (`SKIP-CAP-OIDC-REVOCATION`) closes. The HS256 shared-secret drain completes at `SKIP-IDN-R2-DRAIN-TELEMETRY` — until then the dual-verify path stays exactly as implemented.
**Enforced by:** identity-sole-issuer validator, step-up-crypto validator.

### 1.4 Money Frozen
One canonical append-only double-entry ledger is the only money truth. 0% platform commission. PA-split (Razorpay Route) disbursement only — self-custody rails are dead and purged (`SKIP-RAZORPAYX-ENUM-PURGE` covers the last enum residue). Capture, refund, settlement, payout all post canonical entries (repo-side complete; live certification is Phase D).
**Enforced by:** canonical-ledger-only validator, commission-bps-zero validator, no-self-custody-rail validator.

### 1.5 Theme Ownership Frozen
Liquid is the ratified ecosystem winner. The React storefront sections are a **frozen first-party fast-path** — 20 sections enumerated and pinned by the no-new-React-sections validator. Liquid default rendering is OFF by validator until the Phase E canary proves parity. **React deletion is forbidden until parity is proven and ARB approves the default flip** (`SKIP-CAP-LIQUID-CHROME`).
**Enforced by:** no-new-React-sections validator, theme Liquid default-OFF enforcement, theme publish → canonical config (commit `29e09477`).

### 1.6 Cleanup Program Closed
`FINAL_SAFE_DELETION_CERTIFICATION_2026_06_12/` is the terminal cleanup artifact. No new repository-wide cleanup, convergence, or deletion program may be opened. The certified residual list is closed-end: one governed deletion (Wasm app-functions runtime + guard validator), ~16 env lines, 2 flags, 14 dep declarations, 9 merged branches, local junk, optional 44MB `artifacts/` move. Anything beyond that list requires ARB approval as a *new* decision, not "cleanup."

---

## 2. WHAT MAY CHANGE (the open surface)

| Surface | Allowed change | Condition |
|---|---|---|
| Live provider wiring | Credentials, webhooks, live-mode certification for Razorpay/Cashfree, Resend, WhatsApp BSP, Signzy/HyperVerge, Shiprocket/Delhivery/Pickrr | Inside existing adapters only; provider-mode badge honesty preserved |
| Human seams | Closing any `SKIP-*` row with real evidence | Row superseded with proof; never silently deleted |
| Capability backlog | Closing CAP-C01…C18 live certifications | Per Phase D/E/F programs herein |
| Validators | **Additive only**: new guards (sequential-migration, no-app-functions-execution), live-evidence validators | Never weaken/remove a protection without ARB |
| The certified residual deletions | Execute §1.6 list | Proof-before-delete protocol, gate green after |
| Bug fixes | Within frozen architecture | Gate green; ledger row appended |
| Docs/evidence | New evidence under audit dirs or `docs/`; registry rows | Root md allowlist untouched (9 files) |
| Feature flags | Flipping flags whose flip is an explicitly recorded seam (Liquid default after ARB; FEATURE_IDENTITY_PROVIDER after OIDC seam) | The recorded approval exists first |

## 3. WHAT MAY NOT CHANGE

1. The authority chain and the Constitution's rejected-architecture list (§1.1 forbidden list).
2. The canonical ledger as sole money truth; commission stays 0 bps; no self-custody rail, ever.
3. identity-platform as sole issuer; no second token signer; no new shared signing secrets.
4. RLS+GUC three-layer tenancy; no blanket `service_role`; no `USING (true)` public policies.
5. The 8-runtime topology; reserved roots stay empty; frozen apps stay frozen (archive-in-place); deprecated aliases stay dead.
6. One region. No survivability/multi-region machinery may be reintroduced — the repeal is ARB-recorded (`SKIP-SURVIVABILITY-REPEAL-ARB`).
7. Liquid as the ratified theme winner (React deletion timing may move; the *winner* may not).
8. The root markdown allowlist (9 files) and the prompt registry as the only live prompt surface.
9. The proof-before-delete and ledger-append disciplines of `EXECUTION_LEDGER.md`.
10. The freeze on opening new cleanup/convergence programs (§1.6).

## 4. FREEZE EXCEPTION PROTOCOL

Any change touching §3 requires, in order: a written ARB decision recorded as a new row in `SKIPPED_HUMAN_DECISIONS.md` (decision class), a Constitution amendment via the governance rewrite process, validator updates in the same governed change, and a green gate. No agent — Codex, Claude, or other — may self-grant an exception. Absent all four, the change is drift and must be reverted.
