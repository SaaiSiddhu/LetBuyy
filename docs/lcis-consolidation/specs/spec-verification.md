# VerificationService — LCIS Consolidation Spec

Generated: 2026-06-20  
Source read: `tools/central-intelligence/verification-engine/` (4 files) + 5 `tools/graph-server/` files + 6 `graphify-out/` artifacts

---

## 1. Canonical API

`VerificationService` is the single consolidated verification surface for LCIS. It replaces the ad-hoc readiness checks spread across `audit-engine-v2.mjs`, `production-readiness-intel.mjs`, `production-readiness-v2.mjs`, `launch-command-center.mjs`, and `connections-intel.mjs`, and it wraps the existing `VerificationEngine` / `EvidenceVerifier` / `ConfidenceCalculator` / `VerificationLedger` quartet from `:3334`.

### TypeScript types

```ts
type VerificationStatus = 'VERIFIED' | 'PARTIAL' | 'UNVERIFIED' | 'REFUTED';

type Evidence = {
  source: string;     // must be a registered source key (see Source Authority below)
  assertion: string;  // human-readable fact being corroborated or refuted
  value: unknown;     // raw value from the artifact (count, boolean, string, etc.)
  weight: number;     // authority weight 0–1 (sourced from ConfidenceCalculator.SOURCE_AUTHORITY)
};

type Gap = {
  id: string;                                       // e.g. "gap-rls-001"
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
};

type VerificationResult = {
  status:     VerificationStatus;
  evidence:   Evidence[];
  gaps:       Gap[];
  confidence: number;        // 0–1, computed by ConfidenceCalculator
  notConnected: string[];    // live sources consulted but not reachable + exact env var
  verifiedAt: string;        // ISO-8601
};
```

### Method signatures

```ts
interface VerificationService {
  verifyArchitecture():        Promise<VerificationResult>;
  verifyDomains():             Promise<VerificationResult>;
  verifyServices():            Promise<VerificationResult>;
  verifyRuntime():             Promise<VerificationResult>;
  verifyDependencies():        Promise<VerificationResult>;
  verifyProductionReadiness(): Promise<VerificationResult>;
}
```

### Anti-rubber-stamp rule (from `VerificationEngine.mjs` lines 105–128)

This rule is **non-negotiable** and must be preserved verbatim in the consolidated service:

- **REFUTED** — any evidence item where `corroborates === false` AND `source` is one of `v1-lcis`, `security-gate`, `107-validators`, `rls-gate`, or `canonical-ledger`.
- **VERIFIED** — ≥2 independent corroborating sources with total weighted confidence ≥ 0.60.
- **PARTIAL** — 1 corroborating source OR confidence in range [0.30, 0.60).
- **UNVERIFIED** — 0 corroborating sources OR confidence < 0.30.

Zero evidence items → confidence = 0 → **UNVERIFIED** (not REFUTED, because REFUTED requires a contradicting authoritative source).

### Source authority weights (from `ConfidenceCalculator.mjs`)

| Category | Sources | Weight |
|---|---|---|
| Authoritative | `v1-lcis`, `107-validators`, `security-gate`, `rls-gate`, `canonical-ledger` | 1.00 |
| Structural | `arch-intel`, `domain-graph`, `code-graph`, `db-intel`, `fix-engine`, `arch-reasoner`, `security-reasoner`, `dependency-graph` | 0.70 |
| Operational | `memory-engine`, `v2-ops`, `decision-v2`, `impact-predictor`, `risk-scorer`, `recommendation-engine`, `prediction-engine` | 0.50 |
| Live-connected | any source whose key contains `live-connected` | 0.90 |
| Live-disconnected | any source containing `not connected` or `live-disconnected` | 0.20 |
| Unknown | anything not in the registry | 0.30 |

Confidence formula: `Σ(weight_i × corroborates_i) / Σ(weight_i) − (notConnectedCount × 0.08)`, capped at 0.95 (structural-only) or 1.00 (live-connected present). REFUTED verdict applies an additional −0.40 penalty.

---

## 2. Deterministic Checks Per Method

### `verifyArchitecture()`

Verifies structural patterns: route-level guards, RPC presence, RLS coverage, tenant isolation, and the 107-validator gate status.

**Artifacts read:**
- `graphify-out/audit-engine-v2.json` — pre-computed audit findings
- `graphify-out/production-readiness-v2.json` → `systems` array (Architecture entry)

**Assertions drawn from `audit-engine-v2.mjs`:**

| Assertion | Source | Evidence if passing | Gap if failing |
|---|---|---|---|
| `hardViolations === 0` | `audit-engine-v2.json`.summary | `107-validators` source, corroborates=true | Gap: hard violations in gate; status REFUTED |
| `authCoverage` ratio (55/87 in current artifact) | `audit-engine-v2.json`.summary | `security-gate` source, corroborates=(coverage > 0.5) | Gap: routes without detected auth guard — NOTE: candidates, not violations |
| `validationCoverage` ratio (71/87 in current artifact) | `audit-engine-v2.json`.summary | `arch-intel` source | Gap: routes without zod/parse validation |
| `tenantTablesWithoutRls.length` (20 in current artifact) | `audit-engine-v2.json` A-RLS finding | `rls-gate` source, corroborates=(count === 0) | Gap: tenant tables without detected RLS — NOTE: candidates; rls-force-coverage-validator is authoritative |
| Architecture system score ≥ 80 | `production-readiness-v2.json`.systems[Architecture].score | `db-intel` source | Gap: architecture score below threshold |

**Verdict rule:**
- If `hardViolations > 0` → evidence item with `corroborates=false` from `security-gate` → REFUTED immediately.
- If `hardViolations === 0` AND all coverage ≥ 0.60 AND RLS candidate count = 0 → VERIFIED.
- Otherwise PARTIAL (candidates present, but no hard violations).

**Candidate vs violation distinction (from source, line 42–46 of `audit-engine-v2.mjs`):** All findings are labelled `CANDIDATES`; the 107-validator gate is authoritative. The A-RLS count of 20 represents detector candidates, not gate violations.

---

### `verifyDomains()`

Verifies the 22 business domain graph: cross-domain edges, domain ownership, service assignments, routes/RPCs/tables counts per domain.

**Artifacts read:**
- `graphify-out/domain-intel.json` — 22 domains with counts, owners, cross-domain edges
- `graphify-out/production-readiness-v2.json` → systems array per domain
- `graphify-out/audit-engine-v2.json` → A-OWN finding

**Assertions drawn from `production-readiness-intel.mjs`:**

| Assertion | How computed | Evidence/Gap |
|---|---|---|
| Every domain has ≥1 owner | `d.owners.length > 0`; A-OWN finding `count === 0` | Evidence: A-OWN count=0, `canonical-ledger` source; Gap: ownerless domain |
| Money domains have ≥1 RPC | `d.money && d.counts.rpcs > 0` | Evidence: rpc count; Gap: money domain with no RPC (−10 penalty in scoring) |
| Every domain has ≥1 gateway route | `d.counts.routes > 0` | Evidence: route count; Gap: domain without gateway route (−10) |
| Cross-domain edges reference tables in db-intel | Edge target table in `db-intel.json`.tables | Evidence: table found; Gap: UNVERIFIED edge |
| Domain policy count consistent with db-intel | `d.counts.policies` matches tables' policy sum | Evidence: count match; Gap: discrepancy flagged |

**Verdict rule:** VERIFIED if all 22 domains have owners, all money domains have RPCs, and all cross-domain edge targets exist in db-intel. PARTIAL if A-OWN=0 but some domains lack routes. REFUTED only if a domain claims ownership contradicted by CODEOWNERS (authoritative).

---

### `verifyServices()`

Verifies declared services (per CLAUDE.md canonical runtime map) vs actual source presence and deployment configuration.

**Artifacts read:**
- `graphify-out/infra-intel.json` — workers, queues, cron, env vars, deploy matrix
- `graphify-out/domain-intel.json` — service assignments per domain

**Assertions:**

| Assertion | Source | Evidence/Gap |
|---|---|---|
| Active runtimes have source directories present | Filesystem check (`infra-intel.json` worker list vs actual paths) | Evidence: `arch-intel` source; Gap: declared worker with no source |
| Reserved/frozen runtimes absent from deploy matrix | `infra-intel.json` deploy targets vs CLAUDE.md frozen list | Evidence: `v1-lcis` source; Gap: REFUTED if frozen app appears in active deploy config |
| Each active worker has `[observability]` binding | `infra-intel.json`.workers each with observability flag | Evidence: `arch-intel` corroborates per worker; Gap: missing observability |
| RUNTIME_TELEMETRY binding declared | `infra-intel.json` summary | Evidence: `db-intel` source; Gap: missing RUNTIME_TELEMETRY |
| 4 expected Cloudflare Workers match infra-intel | current artifact: `4 workers` | Evidence: `arch-intel` (corroborates if count matches expectation) |

**Verdict rule:** VERIFIED when all active services have source + deployment config, no frozen app is in active topology. REFUTED if deprecated alias (e.g. `apps/admin`, `apps/auth`) appears in infra-intel deploy targets.

---

### `verifyRuntime()`

Verifies worker/queue/cron declarations vs code, and provider connection state. The connections-intel artifact is the primary source.

**Artifacts read:**
- `graphify-out/connections-intel.json` — 13 sources, all `NOT CONNECTED` in repo context
- `graphify-out/infra-intel.json` — queue producers (5), consumers (7+DLQ), cron declarations

**Assertions drawn from `connections-intel.mjs`:**

| Assertion | Source | Evidence/Gap |
|---|---|---|
| Every declared live provider has `status` field | `connections-intel.json`.connections | Evidence: `arch-intel` source per provider; trivially CONNECTED structurally |
| Every NOT CONNECTED source has `exactSource` env var stated | `connections-intel.json` each entry | Evidence: `arch-intel` corroborates (honesty law: must state exact var); Gap: missing exactSource |
| Adapter-ready count matches expectation (11/13 in current artifact) | `connections-intel.json`.summary.adapterReady | Evidence: `arch-intel`; Gap if adapterReady < 10 |
| Queue producers declared = active routes that enqueue | `infra-intel.json` queueProducers vs gateway source grep | Evidence: `domain-graph`; Gap: producer declared but no calling route found |
| DLQ (dead-letter queue) present in consumer list | `infra-intel.json`.queueConsumers includes DLQ | Evidence: `arch-intel`; Gap: no DLQ |

**Key live-data law:** Every NOT CONNECTED source (currently all 13) contributes a `notConnected` entry with the exact env var. This results in confidence penalty of `13 × 0.08 = 1.04`, clamped at 0, meaning verifyRuntime() structural status = PARTIAL by design (structural topology CONNECTED; live values NOT CONNECTED). This is intentional and honest, not a bug.

**Verdict rule:** Status is always PARTIAL for runtime because all 13 live sources are structurally declared but NOT CONNECTED at repo-analysis time. This does not represent a failure — it represents the honest structural state.

---

### `verifyDependencies()`

Verifies package dependencies, import consistency, and circular dependency detection.

**Artifacts read:**
- `graphify-out/db-intel.json` — function dependency map (RPCs calling other RPCs)
- `graphify-out/domain-intel.json` — cross-domain edge table (which domains import which)
- `graphify-out/audit-engine-v2.json` — dead-RPC and dead-table candidates

**Assertions:**

| Assertion | Source | Evidence/Gap |
|---|---|---|
| No circular domain dependencies | Cross-domain edge graph acyclicity check | Evidence: `domain-graph`; Gap: cycle detected |
| Dead RPCs count within expected range | A-DEAD-RPC finding (75 in current artifact); authority = canonical-ledger-only-validator | Evidence: `canonical-ledger` source; note: "mostly trigger/internal functions — verify with CREATE TRIGGER" |
| Dead tables count within expected range | A-DEAD-TBL finding (44 in current artifact) | Evidence: `arch-intel`; note: "event-sourcing/projection internals" |
| @letbuyy/ui, @letbuyy/shared-types, @letbuyy/api-client imported consistently | blast radius hotspots from CLAUDE.md (getSupabaseAdmin: 115 files) | Evidence: `code-graph` source; Gap: hotspot symbol used without proper import |
| Money tables only mutated via RPC (`canonical-ledger-only-validator`) | `audit-engine-v2.json` hardViolations = 0 | Evidence: `canonical-ledger` corroborates=true if hardViolations=0; REFUTED if >0 |

**Verdict rule:** VERIFIED if no circular cross-domain dependencies, dead RPCs/tables within historical norms (current: 75 RPCs, 44 tables), and canonical-ledger gate green. PARTIAL if dead counts spike unexpectedly. REFUTED if `hardViolations > 0` from canonical-ledger-only-validator.

---

### `verifyProductionReadiness()`

Aggregates structural readiness percentage per-system with evidence. This is the highest-value method, drawing from both `production-readiness-v2.mjs` (10 dimensions) and `launch-command-center.mjs` (GO/NO-GO logic).

**Artifacts read:**
- `graphify-out/production-readiness-v2.json` — 10 dimensions, 18 systems, overall 98% (current artifact)
- `graphify-out/launch-command-center.json` — GO/NO-GO verdict, 5 open blockers (current artifact)
- `graphify-out/audit-engine-v2.json` — hardViolations count
- `graphify-out/connections-intel.json` — liveNotConnected count (13 in current artifact)

**Assertions drawn from `production-readiness-intel.mjs` and `production-readiness-v2.mjs`:**

| Assertion | Threshold | Evidence Source | Gap Condition |
|---|---|---|---|
| Overall structural readiness ≥ 80% | current: 98% | `db-intel` corroborates=true | Gap: below 80% |
| All 10 dimensions scored | `dimensions.length === 10` | `arch-intel` | Gap: missing dimension |
| Open launch blockers = 0 | current: 5 open blockers → NO-GO | `v1-lcis` corroborates=(count=0) | Gap: each open blocker is a critical gap |
| hardViolations in audit gate = 0 | `audit.summary.hardViolations === 0` | `security-gate` corroborates=true; REFUTED if >0 | Gap: hard violation |
| Every tenant table has RLS | `tenantTablesWithoutRls.length === 0` | `rls-gate` corroborates=(count=0) | Gap: each entry is a medium-severity gap (candidate, not violation) |
| Structural score per system ≥ 80 | Lowest current: Security=90, Telemetry=90 | `domain-graph` per system | Gap: system below 80 |
| liveNotConnected acknowledged | `connections.summary.notConnected` stated with exact sources | `arch-intel` | Gap: NOT CONNECTED source without exactSource |
| Latest migration number declared | `openMigrations.latestDeclared = "#169"` | `db-intel` | Gap: no declared migration count |

**GO/NO-GO evidence rule (from `launch-command-center.mjs` line 53):** The verdict comes from the real V1 blocker report (`buildExecutionIntel()`), not from structural scores. Even with 98% structural readiness, the verdict is NO-GO while 5 open blockers remain. This asymmetry must be preserved: high structural score + open blockers = PARTIAL (not VERIFIED).

**Verdict rule:**
- REFUTED: `hardViolations > 0` (gate contradicts readiness claim).
- VERIFIED: `openBlockers === 0` AND `hardViolations === 0` AND `overall ≥ 90` AND all systems ≥ 80.
- PARTIAL: `openBlockers > 0` but `hardViolations === 0` and `overall ≥ 80` (current state: 98% structural, 5 blockers → PARTIAL).
- UNVERIFIED: artifacts missing or overall < 50.

---

## 3. Source Consolidation Map

| Source File | Method(s) it feeds | Action |
|---|---|---|
| `tools/central-intelligence/verification-engine/VerificationEngine.mjs` | All 6 methods (status derivation, `_finalise`, `deriveStatus`) | MIGRATE — zero Qdrant/OpenAI deps confirmed |
| `tools/central-intelligence/verification-engine/EvidenceVerifier.mjs` | All 6 methods (per-item traceability, `scoreEvidence`, `crossCheck`) | MIGRATE — zero Qdrant/OpenAI deps confirmed |
| `tools/central-intelligence/verification-engine/ConfidenceCalculator.mjs` | All 6 methods (weighted confidence formula, `SOURCE_AUTHORITY` map) | MIGRATE — zero Qdrant/OpenAI deps confirmed |
| `tools/central-intelligence/verification-engine/VerificationLedger.mjs` | All 6 methods (append-only JSONL persistence at `graphify-out/verification/ledger.jsonl`) | MIGRATE — zero Qdrant/OpenAI deps confirmed |
| `tools/graph-server/audit-engine-v2.mjs` | `verifyArchitecture()`, `verifyDependencies()` (hardViolations, coverage, RLS candidates, dead RPCs/tables) | MERGE — import `buildAuditEngineV2()` as an artifact producer; consume artifact in verifier |
| `tools/graph-server/production-readiness-intel.mjs` | `verifyProductionReadiness()` (per-system scoring: scoreDomain, scoreInfra, 18 systems) | MERGE into `verifyProductionReadiness` — keep non-duplicate scoring logic; v2 wraps it, so consume via v2 |
| `tools/graph-server/production-readiness-v2.mjs` | `verifyProductionReadiness()` (10 dimensions, overall %, launchVerdict) | MERGE — primary source for dimension aggregation |
| `tools/graph-server/launch-command-center.mjs` | `verifyProductionReadiness()` (GO/NO-GO logic, open blockers, critical risks, liveNotConnected count) | MERGE — GO/NO-GO verdict and blocker list are consumed to set final PARTIAL vs VERIFIED |
| `tools/graph-server/connections-intel.mjs` | `verifyRuntime()` (13 provider statuses, exactSource, adapterReady, honesty contract) | MERGE — the 13-source NOT CONNECTED registry feeds `notConnected` array |
| Any generation or mocking logic found | — | DROP — none found in the 4 verification-engine files; audit/readiness files generate from repo evidence only (no mocks) |

**Sibling dependencies loaded lazily in VerificationEngine (graceful degradation — do not bundle):**
- `recommendation-engine/RecommendationValidator.mjs`
- `prediction-engine/PredictionEngine.mjs`
- `investigation-engine/InvestigationEngine.mjs`
- `architecture-intelligence/ArchitectureIntelligenceEngine.mjs`
- `graph-engine/GraphExplorer.mjs`
- `memory-engine/MemoryRetriever.mjs`

These remain in their current locations; `VerificationService` loads them lazily exactly as `VerificationEngine` does today.

**SafetyGuard note:** `tools/central-intelligence/execution-engine/SafetyGuard.mjs` is a sibling concern (execution safety, read-only whitelist enforcement). It is NOT included in `VerificationService`. It stays in `execution-engine/` and is referenced only when verifying execution results via `verifyExecutionResult()` (an internal method on the existing `VerificationEngine`, not a public `VerificationService` method).

---

## 4. Inputs and Outputs

### Inputs (artifacts consumed — all from `graphify-out/`)

| Artifact | Consumed by | Content |
|---|---|---|
| `db-intel.json` | `verifyArchitecture`, `verifyDomains`, `verifyDependencies`, `verifyProductionReadiness` | 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes; `tenantTablesWithoutRls` list |
| `domain-intel.json` | `verifyDomains`, `verifyServices`, `verifyDependencies` | 22 domains with counts (routes/rpcs/tables/policies), owners, cross-domain edges, money flag |
| `infra-intel.json` | `verifyServices`, `verifyRuntime` | 4 workers, 5 queue producers, 7 consumers + DLQ, Hyperdrive, R2, 19 secrets, migrate gate |
| `audit-engine-v2.json` | `verifyArchitecture`, `verifyDependencies` | 8 findings, hardViolations=0, auth/validation coverage, RLS candidates, dead RPCs/tables/routes |
| `connections-intel.json` | `verifyRuntime` | 13 providers, all NOT CONNECTED, 11 adapter-ready, exactSource per provider |
| `launch-command-center.json` | `verifyProductionReadiness` | GO/NO-GO verdict, 5 open blockers, 10 readiness dimensions, criticalRisks, warnings |
| `production-readiness-v2.json` | `verifyProductionReadiness` | 10 dimensions, 18 systems, overall 98%, lowest: Security/Telemetry at 90 |
| `production-readiness.json` | `verifyProductionReadiness` (via v2 which imports production-readiness-intel) | Per-system scores with evidence strings and blocker references |

All artifacts are read-only inputs. VerificationService writes only to:
- `graphify-out/verification/ledger.jsonl` — append-only JSONL (via VerificationLedger)

### Outputs

All 6 public methods return `VerificationResult` (defined in Section 1).

### Module location

```
packages/lcis-core/src/verification/
  VerificationService.ts           ← new consolidated facade (6 public methods)
  VerificationEngine.mjs           ← MIGRATED from tools/central-intelligence/verification-engine/
  EvidenceVerifier.mjs             ← MIGRATED
  ConfidenceCalculator.mjs         ← MIGRATED
  VerificationLedger.mjs           ← MIGRATED
  index.ts                         ← barrel export
```

### Exports

```ts
export {
  VerificationService,
  VerificationResult,
  Evidence,
  Gap,
  VerificationStatus,
};
```

---

## 5. Test Cases

The following test cases are descriptions (not code) with expected outcomes. Implementation uses the real artifact files from `graphify-out/` rather than mocks.

**Test 1 — Happy path: `verifyProductionReadiness()` with well-populated artifacts**
- Input: current `production-readiness-v2.json` (overall=98, 10 dimensions), `launch-command-center.json` (5 open blockers, NO-GO), `audit-engine-v2.json` (hardViolations=0)
- Expected status: **PARTIAL** (not VERIFIED — open blockers prevent VERIFIED even with 98% structural score)
- Expected evidence: items from `db-intel` (overall %), `v1-lcis` (GO/NO-GO), `security-gate` (hardViolations=0), per-system scores ≥ 80
- Expected gaps: 5 entries — one per open blocker (LB-7, LB-8, LB-9, LB-10, LB-12), severity mapping from blocker severity field
- Expected `notConnected`: 13 entries (one per NOT CONNECTED provider from connections-intel)

**Test 2 — REFUTED: RLS claim contradicted by authoritative gate**
- Input: a conclusion claiming "all payments tables have RLS"; `db-intel.json` `tenantTablesWithoutRls` contains a payments table AND `audit-engine-v2.json` `hardViolations > 0`
- Expected status: **REFUTED**
- Expected evidence: one item with `corroborates=false`, source=`rls-gate`, listing the offending table
- Expected confidence: < 0.60 (authoritative refutation + −0.40 REFUTED penalty from ConfidenceCalculator)
- Key invariant: the REFUTED status fires because source is `rls-gate` (authoritative), not merely because count > 0

**Test 3 — PARTIAL from NOT CONNECTED: `verifyRuntime()` with providers NOT CONNECTED**
- Input: `connections-intel.json` (all 13 sources NOT CONNECTED, 11 adapter-ready)
- Expected status: **PARTIAL** (structural topology CONNECTED; live values NOT CONNECTED)
- Expected evidence: items from `arch-intel` for each declared provider (structural declaration is CONNECTED)
- Expected notConnected: 13 entries, each with exact env var (e.g., `Cloudflare Workers: Cloudflare GraphQL Analytics API (account token)`)
- Expected confidence: raw structural corroboration − (13 × 0.08) → penalised heavily; capped at 0.95 (no live-connected sources); result in PARTIAL range [0.30, 0.60)
- Key invariant: PARTIAL is the honest answer for runtime when no live adapters are wired — this is by design, not a failure

**Test 4 — UNVERIFIED: `verifyDomains()` cross-domain edge referencing unknown table**
- Input: `domain-intel.json` cross-domain edge where target table `foo_table` does not exist in `db-intel.json` tables array
- Expected status: **UNVERIFIED** for that edge (no evidence confirming the table exists; no authoritative contradiction either)
- Expected gaps: one gap entry per unresolvable edge target, severity=medium
- Expected evidence: empty for that edge (zero items)
- Key invariant: zero evidence = UNVERIFIED (not REFUTED), because REFUTED requires an authoritative source to explicitly contradict

**Test 5 — PARTIAL from gap: `verifyArchitecture()` route without matching RPC**
- Input: `audit-engine-v2.json` showing route file `payments.ts` in `missing.auth` candidates; no matching RPC found in `db-intel.json`
- Expected status: **PARTIAL** (coverage evidence from the audit exists; gap for missing RPC)
- Expected evidence: `security-gate` source with authCoverage ratio; `arch-intel` source with validationCoverage
- Expected gaps: one gap per candidate route without matching RPC, severity=high
- Key invariant: candidate ≠ hard violation; status remains PARTIAL (not REFUTED) unless `hardViolations > 0`

**Test 6 — UNVERIFIED: claim with zero evidence sources**
- Input: a conclusion with no corresponding artifact data (e.g., verifying a service that isn't in any artifact)
- Expected status: **UNVERIFIED**
- Expected evidence: `[]` (empty)
- Expected confidence: 0 (from ConfidenceCalculator: `evidence.length === 0 → return 0`)
- Key invariant: UNVERIFIED ≠ REFUTED; the absence of evidence is not evidence of absence

**Test 7 — REFUTED: conflicting evidence from two authoritative sources**
- Input: one evidence item from `v1-lcis` with `corroborates=true` (structural search confirms the claim) AND one item from `107-validators` with `corroborates=false` (validator gate contradicts)
- Expected status: **REFUTED** (the `deriveStatus` function checks `corroborates === false` from authoritative sources first, before counting corroborating sources)
- Expected evidence: both items listed (the confirming V1 item AND the refuting validator item)
- Expected confidence: after −0.40 REFUTED penalty, likely < 0.20
- Key invariant: a single authoritative contradiction overrides any number of corroborating non-authoritative sources

---

## 6. Relationship to Validator Gate

The 107/108-validator gate (`scripts/validate-governance.mjs`) is **AUTHORITATIVE**. `VerificationService` is **ADVISORY** only.

### Authority hierarchy

```
107-validator gate (scripts/validate-governance.mjs)
        │
        │  AUTHORITATIVE — hard blocks on merge
        │  deterministic, binary (PASS/FAIL)
        │  runs on every PR and CI push
        ▼
VerificationService (packages/lcis-core/src/verification/)
        │
        │  ADVISORY — informational only
        │  evidence-weighted, produces VERIFIED/PARTIAL/UNVERIFIED/REFUTED
        │  surfaced in LCIS UI (:3333/api/verify), AI packs, and audit reports
        │  NEVER used to gate PRs
        ▼
LCIS UI / AI packs / audit reports
```

### Explicit prohibitions

- `VerificationService` MUST NOT be wired into CI as a merge gate.
- A `PARTIAL` or `UNVERIFIED` result from `VerificationService` MUST NOT block a PR.
- Only a `REFUTED` result MAY surface as a warning in PR comments — advisory only, no block.
- The 107 deterministic validators remain the sole authoritative gate.

### What each layer catches

| Layer | Catches | Authority level |
|---|---|---|
| 107-validator gate | Hard structural violations: canonical-ledger-only, RLS force, tenant isolation, session security, domain boundary, test coverage governance | **BLOCKING** |
| VerificationService | Evidence-weighted advisory analysis: structural readiness %, cross-domain consistency, provider connection honesty, blocker tracking, confidence calibration | **INFORMATIONAL** |

### Relationship in practice

The validator gate and `VerificationService` are complementary, not redundant:

- The gate runs `grep`-based deterministic checks and fails fast on hard violations (e.g., direct `.from(money_table).insert` = BLOCK).
- `VerificationService` reads the gate's output (`hardViolations` count in `audit-engine-v2.json`) as one evidence input, weight=1.00, and can produce REFUTED when the gate has previously reported a violation.
- When the gate is green (`hardViolations=0`), `VerificationService` uses that as a high-weight corroborating evidence item for `verifyArchitecture()` and `verifyDependencies()`.
- The gate never reads `VerificationService` output — the dependency is one-directional (VerificationService reads gate artifacts; gate is independent).

### Heuristic findings note (from `audit-engine-v2.mjs` line 6 and `production-readiness-intel.mjs` line 4–5)

All audit findings are labelled CANDIDATES. The 107 deterministic validators are authoritative. `VerificationService` propagates this label: any gap derived from a candidate audit finding is marked `severity: 'medium'` or `severity: 'low'`, never `severity: 'critical'`, unless a corresponding hard validator violation (`hardViolations > 0`) elevates it.
