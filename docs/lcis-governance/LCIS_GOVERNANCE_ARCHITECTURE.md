# LCIS Governance Architecture (GDIS)

Phase 5 of the LCIS stack. Package: `@letbuyy/lcis-governance`.
Source: `packages/lcis-governance/src/`.

---

## Stack position

```
┌─────────────────────────────────────────────────────┐
│  Access layer  CLI · MCP (26 tools) · API · PR-check│
├─────────────────────────────────────────────────────┤
│  GovernanceEngine  (facade, engine.ts)              │
│  Drift │ Compliance │ Ownership │ Security │Readiness│
├─────────────────────────────────────────────────────┤
│  GDIS Foundation  (shared/)                         │
│  ArtifactStore · RuleRegistry · Builders · Envelope │
├─────────────────────────────────────────────────────┤
│  @letbuyy/lcis-core  (graph · memory · verification)│
├─────────────────────────────────────────────────────┤
│  graphify-out/  (db-intel · domain-intel · infra-   │
│  intel · memory-intel · production-readiness-v2)    │
└─────────────────────────────────────────────────────┘
```

GDIS sits above lcis-core. It reads lcis-core's already-loaded artifacts through `GovernanceArtifactStore`; it never does its own IO, fetch, DB writes, subprocess spawning, or eval. It observes, analyzes, verifies, and reports. It never executes, mutates, or deploys.

---

## Foundation (`src/shared/`)

### GovernanceArtifactStore (`artifact-store.ts`)

A typed, read-only reader over lcis-core's `ArtifactStore`. No IO of its own — lcis-core owns all loading and caching.

Methods and the artifact slice they read:

| Method | Artifact | Key |
|--------|----------|-----|
| `tables()` | `db-intel` | `tables` |
| `functions()` | `db-intel` | `functions` |
| `policies()` | `db-intel` | `policies` |
| `triggers()` | `db-intel` | `triggers` |
| `domains()` | `domain-intel` | `domains` |
| `workers()` | `infra-intel` | `workers` |
| `ownership()` | `infra-intel` | `ownership` |
| `migrations()` | `memory-intel` | `migrations` |
| `readinessSystems()` | `production-readiness-v2` | `systems` |
| `runbookSubjects()` | `runbooks` | normalised set of keys |
| `sourcesPresent()` | — | which artifact files are loaded |

Real data as of 2026-06-20: 417 tables, 164 functions, 658 policies, 22 domains, 103 migrations.

### GovernanceRuleRegistry (`rules.ts`)

Declarative metadata for R001–R008. Rules are data; `ComplianceService` implements the checks.

### FindingBuilder (`finding.ts`)

Builds `Finding` objects with a deterministic, stable id (`kind.toUpperCase() + subject`, no timestamps). Derives confidence from evidence via `ConfidenceCalculator` when none is supplied.

### SeverityScorer (`severity.ts`)

Pure severity derivation from entity sensitivity: money → `critical`; tenant or public → `high`; otherwise the supplied base (default `medium`).

### GovernanceEvidenceBuilder (`evidence.ts`)

Typed `Evidence` constructors that pin each fact to its real artifact source path (db-intel, domain-intel, infra-intel, memory-intel).

### ConfidenceCalculator (`confidence.ts`)

Deterministic, structural-only. Base 0.6, +0.05 per evidence item, capped at 0.95. Zero evidence → 0. Nothing fabricated.

- `fromEvidence(ev[])` — scales with breadth, max 0.95
- `structural()` — 0.9 (direct artifact fact)
- `unknown()` — 0.3 (undeterminable)

### `governance()` envelope (`envelope.ts`)

Stamps `evidence`, `confidence`, `sources`, and `timestamp` onto every GDIS output. The analogous function to lcis-execution's `plan()`. Confidence 0 when no evidence. Sources deduped from evidence items.

```ts
governance(body, { evidence, sources?, confidence?, now? })
// → body & GovernanceArtifact
```

Every `DriftReport`, `ComplianceReport`, `OwnershipReport`, `SecurityDriftReport`, `ReadinessReport`, and `GovernanceReport` carries this provenance.

---

## Five services

### 1. DriftDetectionService (`src/drift/`)

16 detectors. See `LCIS_DRIFT_GUIDE.md`.

### 2. ComplianceService (`src/compliance/`)

Evaluates R001–R008. See `LCIS_COMPLIANCE_GUIDE.md`.

### 3. OwnershipService (`src/ownership/`)

7 entity types, coverage map. See `LCIS_OWNERSHIP_GUIDE.md`.

### 4. SecurityDriftService (`src/security/`)

8 static checks. See `LCIS_SECURITY_DRIFT_GUIDE.md`.

### 5. ReadinessService (`src/readiness/`)

10 weighted factors per domain. See `LCIS_READINESS_GUIDE.md`.

---

## GovernanceEngine facade (`src/engine.ts`)

### Construction

```ts
createGovernanceEngine(opts?)   // fresh instance
getGovernanceEngine(opts?)      // process-wide singleton (reuses lcis-core singleton)
resetGovernanceEngine()         // tests only
```

`opts.core` defaults to `getEngine()` from lcis-core.

### Reports

| Method | Description |
|--------|-------------|
| `generateGovernanceReport()` | Full composite: drift + compliance + ownership + security + readiness + `healthScore` 0–100 |
| `generateArchitectureHealth()` | Drift findings + R001 violations → `HealthView` |
| `generateDomainHealth()` | Domain-kind drift + readiness overall → `HealthView` |
| `generateSecurityHealth()` | Security drift + R002 violations → `HealthView` |
| `generateOwnershipHealth()` | Ownership coverage → `HealthView` |
| `generateReadinessHealth()` | Readiness scores → `HealthView` |

### healthScore formula

```
healthScore = clamp(
  ( clamp(100 - driftPenalty)
  + complianceScore
  + avgOwnershipCoverage × 100
  + clamp(100 - securityPenalty)
  + readinessOverall ) / 5
)
```

Severity penalties: critical −12, high −6, medium −3, low −1, info 0.

---

## Access surfaces

### CLI

```
lcis drift
lcis compliance
lcis governance
lcis readiness
lcis ownership
lcis security-drift
lcis architecture-health
lcis domain-health
```

### MCP (26 tools registered)

`lcis_drift`, `lcis_compliance`, `lcis_governance`, `lcis_readiness`, `lcis_ownership`, `lcis_security_drift`, `lcis_architecture_health`, plus domain/security/ownership health variants.

### API

```
POST /drift                   → DriftReport
POST /compliance              → ComplianceReport
POST /governance              → GovernanceReport
POST /ownership               → OwnershipReport
POST /readiness               → ReadinessReport
POST /security-drift          → SecurityDriftReport
GET  /architecture-health     → HealthView
GET  /domain-health           → HealthView
```

### PR Intelligence V3

`analyzeWithGovernance()` runs the engine and emits 6 `GovernanceVerdict` objects in the `## LCIS GOVERNANCE` section of PR comments. Dimensions: `architecture-drift`, `compliance`, `ownership`, `security-drift`, `readiness`, `governance`. Each carries `verdict` (`PASS|WARN|FAIL|UNKNOWN`), `summary`, `findings[]`, and `evidence[]`.

---

## Design principles

**Observe and enforce-by-reporting, never execute.** All five services are pure deterministic functions over the lcis-core artifact cache. They produce `Finding` and report objects; they never call `writeFile`, `fetch`, `spawn`, execute SQL, or apply migrations.

**Reuse, not rebuild.** All data comes from lcis-core's `ArtifactStore`. `ReadinessService` reuses `core.verification.verifyProductionReadiness()`. Severity, evidence, confidence, and the `governance()` envelope are shared primitives, not duplicated per service.

**Honesty contract.** Where the artifact does not supply a field (rollback script, live probe, monitoring config, alert config, middleware resolution), the service emits `UNKNOWN` or `PARTIAL` with a `notConnected()` evidence item — never fabricated. Confidence is capped at 0.95; zero evidence → 0.

**Gate is authoritative.** The 107-validator gate is deterministic and authoritative. GDIS findings are governance intelligence, not gate replacements. GDIS currently shows 0 hard violations with the gate green.
