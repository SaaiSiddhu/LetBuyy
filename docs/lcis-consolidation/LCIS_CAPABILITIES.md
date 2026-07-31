# LCIS Capabilities

## Service-to-Capability Map

| Service | Capabilities covered | Legacy files consolidated |
|---------|---------------------|--------------------------|
| `BlastRadiusService` | 5 (blast radius), 6 (cross-domain impact), part of 4 (dependency graph) | `intelligence.mjs`, `cross-domain-engine.mjs`, `change-impact.mjs`, `relationship-intel.mjs` |
| `MemoryService` | 13 (governance memory + decision retrieval) | `memory-intel.mjs`, `memory-v2.mjs` (Qdrant replaced by BM25) |
| `DecisionService` | 17 (risk ranking), 18 (fix plans + launch verdict) | `decision-engine-v5.mjs`, `decision-engine-v2.mjs`, `fix-engine.mjs`, `production-readiness-intel.mjs`, `production-readiness-v2.mjs` |
| `ArchitectureService` | 28 (architecture intelligence + domain explain) | `explain-intel.mjs`, `domain-intel.mjs`, `ArchitectureIntelligenceEngine.mjs`, `ArchitectureDriftDetector.mjs`, `DomainDiscovery.mjs`, `DependencyDiscovery.mjs`, `ServiceDiscovery.mjs`, `LayerDiscovery.mjs` |
| `VerificationService` | 29 (evidence-weighted verification), 30 (production readiness) | `VerificationEngine.mjs`, `EvidenceVerifier.mjs`, `ConfidenceCalculator.mjs`, `VerificationLedger.mjs`, `audit-engine-v2.mjs`, `production-readiness-intel.mjs`, `production-readiness-v2.mjs`, `launch-command-center.mjs`, `connections-intel.mjs` |

---

## Detail: What Each Service Consolidates

### BlastRadiusService (capabilities 4, 5, 6)

Pulls together four previously separate `:3333` engine files:

- **`intelligence.mjs`** — `blast()`, `dependencies()`, `consumers()`, `critical()`, `path()`
- **`cross-domain-engine.mjs`** — `crossDomain()` (domain consumer-edge BFS)
- **`change-impact.mjs`** — `impact()` (crossDomain + money/tenant flags + deploy gate)
- **`relationship-intel.mjs`** — `relationships()` (FK fan-in/fan-out)

All four now share a single `GraphService` instance and `ArtifactStore`, so the
graph is built once and cached.

### MemoryService (capability 13)

Consolidates the BM25 retrieval path from `memory-intel.mjs` and the
corpora-plus-decisions reasoning from `memory-v2.mjs`. The Qdrant vector store
used in `:3334` is replaced by an in-process BM25 index (`src/memory/bm25.ts`)
built from the same markdown corpus files and `graphify-out/memory-intel.json`.
This removes the `QDRANT_URL` / `OPENAI_API_KEY` runtime requirement.

Key migration detail: `memory-v2.mjs` indexed 8 Qdrant collections (architecture,
runbooks, incidents, security, deployments, knowledge, merchants, themes).
`MemoryService` loads the same content from markdown files (categorised by
filename prefix) plus `memory-intel.json` decisions/migrations. The `type` field
on `MemoryHit` maps: `decision`, `migration`, `runbook`, `architecture` → their
own types; everything else → `'governance'`.

### DecisionService (capabilities 17, 18)

`decision-engine-v5.mjs` owned all ranking logic. `decision-engine-v2.mjs` was a
thin wrapper that added two extra `blocksScale` tiers and called v5. The
`DecisionService` absorbs both into a single ranking pass and includes the v2
scale tiers directly in `scaleTiers()`.

`fix-engine.mjs` provided `fixPlan` / `verificationPlan` / `testPlan` /
`rollbackPlan` quadruples per blocker. These now surface via `rankFixes()` with
the same structure.

`production-readiness-intel.mjs` and `production-readiness-v2.mjs` are read via
`artifacts.ts` loader functions; their data feeds `systemReadiness()`,
`dimensionReadiness()`, and `launchVerdict()`.

### ArchitectureService (capability 28)

Consolidates eight source files from two servers:

**From `:3333` (`tools/graph-server/`):**
- `explain-intel.mjs` — the `NARRATIVE` map (22 domain entries), criticality
  tiers, `aiContext` pack shape
- `domain-intel.mjs` — domain classification, cross-domain edge resolution

**From `:3334` (`tools/central-intelligence/architecture-intelligence/`):**
- `ArchitectureIntelligenceEngine.mjs` — the central orchestrator
- `ArchitectureDriftDetector.mjs` — layer violation detection (now
  `#validateLayering()` private method in `ArchitectureService`)
- `DomainDiscovery.mjs` — `MONEY_TABLES` set (18 entries), money/tenant flagging
- `DependencyDiscovery.mjs` — `KNOWN_CRITICAL` packages (6 entries), blast-radius
  thresholds (critical ≥ 8, high ≥ 5, medium ≥ 2)
- `ServiceDiscovery.mjs` — `CANONICAL_RUNTIMES` (9), `FROZEN_APPS` (4), status
  classification
- `LayerDiscovery.mjs` — `LAYER_MAP`, `PACKAGE_LAYER_MAP`, `FORBIDDEN_LAYER_DEPS`

### VerificationService (capabilities 29, 30)

Consolidates four `:3334` classes and five artifact engines:

**Classes from `:3334`:**
- `VerificationEngine.mjs` — status derivation (`deriveStatus()`), the
  refuse-to-rubber-stamp rule
- `EvidenceVerifier.mjs` — corroboration checking against authoritative sources
- `ConfidenceCalculator.mjs` — weighted confidence with NOT CONNECTED penalty
  (each source applies −0.08)
- `VerificationLedger.mjs` — deduplication and gap tracking

**Artifact engines:**
- `audit-engine-v2.mjs` — hardViolations, auth/validation coverage, RLS
  candidates, dead RPCs/tables
- `production-readiness-intel.mjs` — per-system readiness scores
- `production-readiness-v2.mjs` — 10-dimension readiness
- `launch-command-center.mjs` — open blockers, launch recommendation, latest
  migration
- `connections-intel.mjs` — 13 NOT CONNECTED live sources (each with `exactSource`
  env var)

---

## What Is NOT Yet Built in lcis-core

The following capability ranges remain as legacy `.mjs` engines in
`tools/graph-server/` (`:3333`) and `tools/central-intelligence/` (`:3334`).
They are not touched by `lcis-core`:

| Capabilities | Description | Current home |
|-------------|-------------|--------------|
| 7–12 | Catalog, merchant intelligence, revenue intelligence, cost intelligence, telemetry adapters, live provider federation | `:3333` / `:3334` |
| 14–16 | Incident detection, incident response, root-cause analysis | `:3334` |
| 19–22 | Runtime intelligence, deployment state, autonomous detection (8 detectors), prediction (6 predictors) | `:3334` (INFINITY layer) |
| 23–24 | Semantic search (`/api/search-v2`), domain workspace explain | `:3333` |
| 25–27 | Control centers (infrastructure/commerce/incident), knowledge graphs (7 kinds), AI context packs | `:3333` / `:3334` |
| 31 | Browser validation (Playwright via `:3334`) | `:3334` |
| 32 | Context compression / context assembly | `:3334` |

These remain in place during the transition. The verify-before-destroy gate in
`LCIS_MIGRATION_PLAN.md` governs when any legacy endpoint can be archived.
