# EAOS Phase-8 Governance Integration Discovery
> Generated 2026-06-21 — discovery only, no code written.

## Factory

```ts
import { getGovernanceEngine, createGovernanceEngine } from '@letbuyy/lcis-governance';
const gov = getGovernanceEngine();           // singleton, reuses lcis-core singleton
const gov = createGovernanceEngine({core, now}); // fresh instance
```

## Exact API surface EAOS composes

| EAOS need | `gov` symbol | Return type | CONNECTED? |
|-----------|-------------|-------------|------------|
| `validationStatus` (gate pass/fail per rule R001–R008) | `gov.compliance.generateComplianceReport()` | `ComplianceReport` → `.evaluations[].status: ComplianceStatus`, `.score`, `.violations` | **CONNECTED** (structural graph evaluation) |
| `validatorHealth` (structural health score 0–100) | `gov.generateGovernanceReport()` → `.healthScore` | `GovernanceReport` | **CONNECTED** |
| `failedValidations` (finding list) | `gov.compliance.generateComplianceReport().violations` + `gov.drift.generateDriftReport().findings` | `Finding[]` | **CONNECTED** |
| `verificationCoverage` (readiness factors per domain) | `gov.readiness.generateReadinessReport()` | `ReadinessReport` → `.scores[].factors`, `.overall` | **CONNECTED** (structural; `UNKNOWN` factor = honestly unresolvable, not fabricated) |
| `agentOwnership` (who owns domain/service/rpc/table/worker) | `gov.ownership.generateOwnershipReport()` | `OwnershipReport` → `.coverage`, `.gaps` | **CONNECTED** (CODEOWNERS + manifest graph) |
| `orphanAgents` (unowned entities) | `gov.ownership.generateOwnershipReport().gaps` | `OwnershipGap[]` (entityType, subject, severity) | **CONNECTED** |
| Security posture for validation health | `gov.security.generateSecurityDriftReport()` | `SecurityDriftReport` → `.findings` | **CONNECTED** |
| Per-area `HealthView` (score + findings) | `gov.generateOwnershipHealth()` / `generateSecurityHealth()` / `generateReadinessHealth()` | `HealthView` | **CONNECTED** |

## Provenance envelope EAOS mirrors

```ts
// governance() stamps every GDIS output — EAOS wraps its own outputs identically:
import { governance } from '@letbuyy/lcis-governance';
const result = governance({ ...body }, { evidence, now });
// → { ...body, evidence, confidence: 0..0.95, sources: string[], timestamp: ISO }
```

Core shapes to mirror (import from `@letbuyy/lcis-governance`):
- `Finding` — atomic unit: `{id, category, kind, severity, subject, title, detail, confidence, evidence}`
- `GovernanceVerdict` — `{dimension, verdict: PASS|WARN|FAIL|UNKNOWN, summary, findings, evidence}`
- `GovernanceArtifact` — base provenance mixin (confidence, evidence, sources, timestamp)
- `ComplianceStatus` — `COMPLIANT | VIOLATED | PARTIAL | UNKNOWN`

## NOT_CONNECTED boundary

All governance engine outputs above are **CONNECTED** — they evaluate static graph artifacts from `lcis-core`. The following are **NOT_CONNECTED** (live CI, live test runs, runtime signals):

- Whether a compliance rule violation is also failing in live CI — `NOT_CONNECTED` (source: GitHub Actions API, no adapter).
- `ReadinessFactor.present = 'UNKNOWN'` — honestly unresolvable from the static graph, not a fabrication; a live probe would require a CI/monitoring adapter.
- Actual test pass/fail counts from a running test suite — `NOT_CONNECTED`.

## Composition rule

EAOS **imports and calls** these methods; it does **not** reimplement drift detection, compliance evaluation, ownership graph traversal, or readiness scoring. Any EAOS validation gate is a thin wrapper over `gov.*` results, decorated with the `GovernanceVerdict` shape and `governance()` envelope.
