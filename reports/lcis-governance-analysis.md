# LCIS Governance Analysis
**LetBuyy Central Intelligence System — Governance, Authority, and Drift Prevention**
*Date: 2026-06-19 | Source: AGENTS.md, GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md, scripts/validators/*

---

## 1. The Governance Crisis That Created LCIS

LCIS governance did not emerge from theory — it emerged from a documented failure.

**What happened:** The prior `AGENTS.md` was auto-generated from a repository scan. This scan encoded the repository's drift as law — it declared a rejected 9-application topology as "canonical," listed CQRS/saga/projection packages as governed (they were prototypes), and reported stale entity counts. AI agents and engineers read this file as authoritative and made decisions based on incorrect information.

**The 2026-06-10 forensic audit (GOVERNANCE_REWRITE_2026_06_10/)** found 291 issues and 9 S0 security vulnerabilities. The entire governance stack was rebuilt from first principles.

**The central governance lesson encoded in DOC-R1:**
> "Governance/authority documents MUST be hand-authored law. MUST NOT generate a governance/authority document from a repository scan."

---

## 2. The Authority Chain

The governance hierarchy is strictly ordered. Nothing in a lower position can override a higher position.

### DOC 01 — LETBUYY_CONSTITUTION.md (Supreme Law)
- **File:** `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`
- **Status:** Ratified 2026-06-10 by Architecture Review Board (ARB) and CTO
- **Amendment:** Requires constitutional amendment process; ARB approval required
- **Absorbs:** Retires `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` and `LETBUYY_FINAL_ARCHITECTURE_FREEZE.md` as constitutional articles ART-01 through ART-24
- **Revokes:** Prior generated AGENTS.md constitutional claims
- **Contents:** Core platform principles, 8 canonical runtimes, payment/auth/RLS rules, topology freeze

### DOC 02 — AGENTS.md (Operating Rulebook)
- **File:** `AGENTS.md` (root) — promoted from `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md`
- **Status:** Hand-authored law, NOT generated. Marked `HAND-AUTHORED LAW. NOT GENERATED.`
- **Markers:** `# LETBUYY_AGENTS_V2`, `HAND-AUTHORED LAW`
- **Scope:** 16 rule sections with numbered rules (`ARCH-R1`, `SEC-R6`, `PAY-R3`, etc.)
- **Length:** 405 lines
- **Purpose:** Every AI agent and human engineer reads this file; cannot create architecture drift from it

### DOC 03 — LETBUYY_CANONICAL_SYSTEMS.md
- **Purpose:** Winner registry — one canonical system per domain
- **Subordinate to:** DOC 01 and DOC 02

### DOC 04/05 — LETBUYY_LEGACY_ELIMINATION_MASTER_PLAN.md + LETBUYY_FOUNDATION_ROADMAP.md
- **Purpose:** How and when convergence happens
- **Subordinate to:** DOC 01–03

### DOC 05/06 — LETBUYY_UI_UX_GOVERNANCE.md + docs/governance/*
- **Purpose:** Domain-specific governance
- **Subordinate to:** DOC 01–05

### Evidence Base (not authority)
- **Files:** `FORENSIC_MASTER_2026_06_10/` and `STRATEGIC_CANONICALIZATION_2026_06_10/`
- **Status:** The "why," not the law. Does NOT outrank the Constitution on canonicity questions.

---

## 3. The 16 Rule Sections (AGENTS.md)

Each section contains numbered rules. Rules are prefixed with section code.

| Section | Code | Key Rules |
|---------|------|----------|
| Architecture | ARCH | ARCH-R1: 8 canonical runtimes only; ARCH-R2: no new runtimes without ARB |
| Coding | CODE | TYPE-safe patterns, no `any`, error handling at boundaries |
| Winner Selection | WIN | WIN-R1: DOC 03 names the winner; no alternate implementations |
| Migration | MIG | MIG-R1: sequential numbers; MIG-R2: never rollback a money migration without ARB |
| Deletion | DEL | DEL-R1: dead code must pass validator gate |
| Never Build | NEVER | NEVER-R1: no new runtimes; NEVER-R2: no new payment rails; NEVER-R3: no self-custody |
| Testing | TEST | TEST-R1: tests in `tests/`; no inline test logic in source |
| Security | SEC | SEC-R1: no public USING (true); SEC-R2: RLS force on all tenant tables; SEC-R6: step-up HMAC for refunds/payouts |
| Payment | PAY | PAY-R1: canonical ledger only; PAY-R2: SECURITY DEFINER + idempotency + FOR UPDATE; PAY-R3: server-authoritative amounts |
| Identity | IDN | IDN-R1: two issuers, never crossed; IDN-R2: identity-platform is sole ES256 issuer |
| Theme | THEME | THEME-R1: Liquid sanitizer locked; THEME-R2: no new React-per-section after freeze |
| UI | UI | UI-R1: `@letbuyy/ui` only; UI-R2: `--lb-*` design tokens only; UI-R3: mobile-first |
| Documentation | DOC | DOC-R1: governance docs hand-authored only; ANTI-R8: no scan-generated authority |
| Anti-patterns | ANTI | ANTI-R1: no alternate payment impl; ANTI-R5: no fabricated live data |
| Deployment | DEPLOY | DEPLOY-R1: migrate gate required; DEPLOY-R2: branch lag ≤ 0 |
| Agent Behavior | AGENT | AGENT-R1: query LCIS first; AGENT-R3: prefer deletion over new construction |

**PRIME-R3:** "prefer deletion and completion over new construction"
**ANTI-R8:** "MUST NOT promote a scan-generated artifact to authority"

---

## 4. The 107 Deterministic Validators

The authoritative blocking gate is `node scripts/validate-governance.mjs`. All 107 validators are deterministic — they pass or fail based on code patterns, never on heuristics.

### Validator Categories

**Foundation and anti-fabrication (5 validators):**
- `foundation-antifabrication-gate.mjs` — comprehensive anti-fabrication gate
- `topology-json-antifabrication-validator.mjs` — prevents reserved services from being declared as production topology
- `meta-no-theater-validator.mjs` — prevents "security theater" patterns
- `no-scan-generated-agents-validator.mjs` — AGENTS.md must not contain scan-generated content
- `whole-repo-end-state-validator.mjs` — end-state topology coherence

**Tenant and security (18 validators):**
- `tenant-isolation-validator.mjs` — tenant boundary enforcement
- `production-safety-validator.mjs` — production safety checks
- `session-security-validator.mjs` — session token security
- `no-blanket-service-role-validator.mjs` — no undifferentiated service-role access
- `no-public-using-true-validator.mjs` — no `USING (true)` on public data
- `rls-force-coverage-validator.mjs` — FORCE RLS on tenant tables
- `cookie-realm-validator.mjs` — cookie security realms
- `app-utils-service-role-edge-validator.mjs` — service-role edge cases
- `fail-closed-internal-routes-validator.mjs` — internal routes default deny
- `dev-auth-bypass-validator.mjs` — no dev auth bypass patterns
- `committed-secret-placeholder-validator.mjs` — no committed secrets
- `env-isolation-validator.mjs` — env variable isolation
- `environment-honesty-validator.mjs` — environment truthfulness

**Import and dependency (12 validators):**
- `import-validator.mjs`, `dependency-manifest-validator.mjs`, `undeclared-import-validator.mjs`, `dependency-graph-validator.mjs`, `circular-import-validator.mjs`, `cycle-budget-validator.mjs`, `package-export-validator.mjs`, `no-rejected-package-imports-validator.mjs`, `provider-isolation-validator.mjs`, `supply-chain-validator.mjs`

**Money and payment (7 validators):**
- `canonical-ledger-only-validator.mjs` — **CRITICAL:** forbids `.from(money_table).insert/update` in TypeScript; all money mutations must use `db.rpc()`
- `no-self-custody-rail-validator.mjs` — no self-custody payment rails
- `stepup-crypto-validator.mjs` — step-up HMAC verification
- `commission-bps-zero-validator.mjs` — commission basis points validation
- `pricing-catalog-validator.mjs` — pricing catalog integrity
- `source-ledger-residue-validator.mjs` — no source-ledger residue
- `single-writer-ownership-validator.mjs` — single writer per money table

**Identity (2 validators):**
- `identity-sole-issuer-validator.mjs` — identity-platform is sole ES256 issuer
- `single-source-crypto-validator.mjs` — single cryptographic source

**Architecture and topology (12 validators):**
- `architecture-validator.mjs`, `runtime-validator.mjs`, `runtime-manifest-validator.mjs`, `runtime-topology-validator.mjs`, `topology-drift-validator.mjs`, `package-ownership-validator.mjs`, `domain-boundary-validator.mjs`, `route-ownership-validator.mjs`, `deploy-matrix-topology-validator.mjs`, `no-reserved-service-activation-validator.mjs`, `dead-residue-validator.mjs`, `repository-intelligence-validator.mjs`, `mobile-topology-honesty-validator.mjs`

**Theme (3 validators):**
- `theme-governance-validator.mjs`, `no-new-react-sections-validator.mjs`, `theme-editor-dead-shell-validator.mjs`

**UI and design system (6 validators):**
- `validate-design-system.mjs`, `mobile-token-validator.mjs`, `provider-mode-badge-validator.mjs`, `one-system-per-domain-validator.mjs`, `token-source-single-validator.mjs`, `shell-single-validator.mjs`

**Domain and site type (8 validators):**
- `domain-boundary-validator.mjs`, `legacy-site-type-validator.mjs`, `reserved-subdomain-single-source-validator.mjs`, `platform-domain-literal-validator.mjs`, `storefront-access-gate-validator.mjs`, `storefront-seo-access-validator.mjs`, `custom-domain-target-validator.mjs`, `merchant-domains-settings-validator.mjs`

**Migration and deployment (6 validators):**
- `migration-safety-validator.mjs`, `sequential-migration-validator.mjs`, `deployment-safety-validator.mjs`, `deployment-lineage-validator.mjs`, `rollback-integrity-validator.mjs`, `branch-lag-guard-validator.mjs`, `secret-topology-validator.mjs`

**Dead code and artifacts (6 validators):**
- `typescript-dead-source-validator.mjs`, `dart-dead-source-validator.mjs`, `marketing-dead-twin-validator.mjs`, `settings-apps-dead-twin-validator.mjs`, `foundation-sql-policy-residue-validator.mjs`, `stale-artifact-validator.mjs`, `generated-artifact-validator.mjs`

**Format and conventions (8 validators):**
- `inr-currency-format-validator.mjs`, `date-format-validator.mjs`, `cms-slugify-validator.mjs`, `api-client-runtime-base-validator.mjs`, `marketplace-single-source-validator.mjs`, `route-line-count-validator.mjs`, `raw-error-message-validator.mjs`, `no-noop-test-script-validator.mjs`

**Infrastructure (7 validators):**
- `cloudflare-topology-validator.mjs`, `wrangler-env-validator.mjs`, `cloudflare-environment-validator.mjs`, `cloudflare-binding-validator.mjs`, `d1-governance-validator.mjs`, `durable-object-validator.mjs`, `queue-topology-validator.mjs`

**CI and tooling (10 validators):**
- `ci-simulation-validator.mjs`, `tooling-governance-validator.mjs`, `typescript-governance-validator.mjs`, `workspace-lifecycle-validator.mjs`, `test-coverage-governance-validator.mjs`, `provider-evidence-validator.mjs`, `production-readiness-validator.mjs`, `phase-c-forced-decisions-validator.mjs`, `prompt-perimeter-validator.mjs`

### 5 Critical Gate Validators

These 5 are checked first as a fast-fail gate:
1. `dependency-manifest-validator.mjs`
2. `undeclared-import-validator.mjs`
3. `package-export-validator.mjs`
4. `dependency-graph-validator.mjs`
5. `circular-import-validator.mjs`

### Gate Modes

- `--lane=gate` — all 107 validators (default; the blocking gate)
- `--lane=report` — 1 report-only validator (non-blocking)
- `--lane=all` — all 108 (gate + report)

**Demotion rule:** A validator CANNOT be silently removed from the critical list without a Wave 0 governance entry.

---

## 5. The Repository Intelligence Governance Boundary

`scripts/generate-repository-intelligence.mjs` was intentionally RETIRED:

```javascript
// This file is RETIRED.
// Root AGENTS.md is hand-authored law from GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md.
// Repository scans may not regenerate governance authority or promote current tree drift
// into canonical law.
process.exit(1);
```

This is enforced at the test layer by `tests/contracts/repository-intelligence-generation.test.ts`, which has 4 tests:
1. The retired generator cannot write `AGENTS.md` (exits with 1)
2. Root `AGENTS.md` is hand-authored AGENTS_V2 law (not generated scan output)
3. Generated intelligence artifacts are absent from authority positions
4. The `repository-intelligence-validator.mjs` is wired into the gate

---

## 6. Change Control Escalation Rules

The ARB is the only body that can amend the Constitution. An AI agent or engineer acting alone **must escalate (not decide)** for:

- Winner conflicts not resolved by DOC 03
- Any new runtime or reserved service activation
- Any scope expansion past 10k merchants
- Any money/identity/tenancy change that weakens a fail-closed default
- Any deletion whose validator gate cannot be made green

**Change-control hotspots** (highest blast radius — require `pnpm graph:intel blast` before merging):
- `getSupabaseAdmin` — 115 files affected
- `@letbuyy/shared-types` — contract for all TypeScript apps
- `@letbuyy/api-client` — used by all frontend apps
- `create_checkout_order` — money RPC; SECURITY DEFINER + idempotent + row-locked

---

## 7. How LCIS Governance Is Enforced in CI/CD

**Blocking gate (always runs):**
```
.github/workflows/ci.yml → node scripts/validate-governance.mjs
```
All 107 validators run on every PR. Gate is fail-closed: any failure blocks merge.

**Advisory LCIS regeneration (non-blocking):**
```
.github/workflows/graph-intelligence.yml
```
Triggers on changes to `database/supabase/migrations/**`, `services/api-gateway/src/**`, or `tools/graph-server/**`. Regenerates all intelligence artifacts. Uploads `db-intel.json`, `infra-intel.json`, `domain-intel.json` as artifacts (14-day retention). Includes a sanity gate: `tables < 100 || functions < 50` exits with error (degradation check).

**Security audit (weekly):**
```
.github/workflows/full-security-audit.yml
```

**PR security review:**
```
.github/workflows/security-review.yml
```
Uses Anthropic's `claude-code-security-review` action (requires `ANTHROPIC_API_KEY`).

**Branch lag guard:**
```
.github/workflows/branch-lag-monitor.yml
```
Monitors that `stepup/main` stays ≤ 0 commits ahead of `main`. Drift is a blocking condition.

---

## 8. The "NOT CONNECTED" Governance Contract

The NOT CONNECTED principle is governance-level, not just a technical detail:

**What it prevents:**
- Fabricated live metrics presented as facts
- AI agents making decisions on invented data
- "Structural risk" masquerading as "live incident data"

**How it's enforced:**
1. `ANTI-R5` rule in AGENTS.md: "MUST NOT fabricate live values"
2. Every live-adapter returns `NOT CONNECTED + exactSource` when credentials absent
3. Every INFINITY detector clearly separates `liveSignal.status: 'NOT CONNECTED'` from `structuralRisk` (CONNECTED)
4. Every revenue/merchant/customer magnitude in all 90+ endpoints carries the NOT CONNECTED label

**The honest ceiling:** Live telemetry adapters cannot be fully connected in the repository context because provider credentials are deploy-time secrets. 90% is the correct ceiling (ingestion topology complete; live numbers are operator-wired).

---

## 9. Drift Prevention Summary

8 rules an agent must follow to avoid creating architecture drift:

1. **Query LCIS first** — `/api/explain?node=X` before reading source files
2. **Never generate governance** — DOC-R1 forbids scan-generated authority documents
3. **Run the validator gate** — `node scripts/validate-governance.mjs` after any topology change
4. **Escalate money/auth/RLS changes** — PAY-R1, SEC-R1, IDN-R1 require ARB
5. **No new runtimes** — NEVER-R1: only the 8 canonical runtimes
6. **No fabricated live data** — ANTI-R5: mark as NOT CONNECTED with exact source
7. **Prefer deletion over new construction** — PRIME-R3
8. **CODEOWNERS is the authority for ownership** — not documentation, not graph inference

---

## 10. Two-Lane Merge Rule

The repository uses a two-lane merge strategy:
- `stepup/main` — development branch (this branch)
- `main` — production branch

**Rules:**
- `stepup/main` must stay ≤ 0 commits AHEAD of `main` (branch-lag-guard monitors this)
- Non-critical merges are frozen during mobile release cuts
- All governance-affecting changes must go through `main` with ARB review

The validator gate must be green before any merge in either lane.
