# LCIS Governance & Drift Intelligence System (GDIS) — Runbook

> Phase 5 of the LCIS stack. READ-ONLY constitutional layer over lcis-core + lcis-execution.
> Observes / analyzes / verifies / plans — never executes, mutates, deploys, or writes.

---

## 1. Artifact dependency

GDIS reads from five graphify-out artifacts. These must be fresh before running any governance command.

| Artifact | Command to refresh | What it feeds |
|---|---|---|
| `graphify-out/db-intel.json` | `pnpm graph:db` | tables, functions, policies, triggers |
| `graphify-out/domain-intel.json` | `pnpm graph:domain` | domain ownership, routes, rpcs, queues |
| `graphify-out/infra-intel.json` | `pnpm graph:infra` | workers, CODEOWNERS map |
| `graphify-out/memory-intel.json` | `pnpm graph:db` (included) | migrations |
| `graphify-out/production-readiness-v2.json` | `pnpm graph:reports` | readiness systems |

To refresh everything at once:

```
pnpm graph:v3
```

or the full refresh:

```
pnpm graph:omega
```

If a report prints `sources: []` or confidence is 0, the artifacts are missing or stale. Run the refresh commands above and retry.

---

## 2. CLI commands

All governance commands live under `lcis` (the `packages/lcis-cli` binary). The `--json` flag emits raw JSON; `--evidence` adds the `evidence[]` array to the output.

### 2.1 `lcis drift`

Detects structural drift: tables/RPCs/workers/queues/events/runbooks/tests/docs/migrations/validators/ownership/security out of alignment with declared domain ownership.

```
lcis drift
lcis drift --json
lcis drift --evidence
```

Example output (human mode):

```
GDIS Drift Report
scope: all
findings: 3
by-kind: { table-drift: 2, missing-runbook: 1 }

  [HIGH] TABLE-DRIFT-legacy_sessions
    kind: table-drift
    subject: legacy_sessions
    detail: Table not claimed by any domain (money=false, tenant=false)
    confidence: 0.72
    evidence: db-intel.json → table:legacy_sessions

  [INFO] MIGRATION-ROLLBACK-103
    kind: migration-drift (rollback UNKNOWN)
    subject: migration 103
    detail: Rollback path UNKNOWN — no rollback field in artifact
    confidence: 0.30
```

Honest UNKNOWN/PARTIAL example — migration rollback:

```json
{
  "id": "MIGRATION-ROLLBACK-103",
  "kind": "migration-drift",
  "severity": "info",
  "subject": "migration 103",
  "detail": "Rollback path for migration 103 is UNKNOWN — no rollback field present in memory-intel.json",
  "confidence": 0.30,
  "evidence": [
    { "type": "migration", "ref": "migration:103", "detail": "rollback not determinable from artifact", "source": "graphify-out/memory-intel.json" }
  ]
}
```

The `confidence` of 0.30 signals that the finding is structurally inferred; the `detail` explicitly says UNKNOWN. This is not a hard violation — it surfaces the gap honestly rather than asserting it is absent.

### 2.2 `lcis compliance`

Evaluates rules R001–R008 against real artifacts. Returns per-rule status (COMPLIANT / VIOLATED / PARTIAL / UNKNOWN), violations, and a 0–100 compliance score.

```
lcis compliance
lcis compliance --json
lcis compliance --evidence
```

Example output:

```
GDIS Compliance Report
score: 87/100
evaluations: 8
violations: 1

  R001 — Money mutations must use canonical RPC
    status: COMPLIANT
    checked: 34 money RPCs  passed: 34

  R002 — Tenant tables must have RLS
    status: COMPLIANT
    checked: 256 tenant tables  passed: 256

  R006 — Migrations must have rollback
    status: PARTIAL
    detail: Rollback presence NOT determinable from artifacts (memory-intel.json#migrations[].rollback absent)
    NOT CONNECTED: migration.rollback → graphify-out/memory-intel.json

  R008 — Production services must have healthchecks
    status: PARTIAL
    detail: Worker topology declared (infra-intel); live probe NOT CONNECTED
    NOT CONNECTED: worker.healthcheck.liveProbe → OTEL_EXPORTER_OTLP_ENDPOINT or CLOUDFLARE_ANALYTICS_DATASET
```

R006 and R008 are always PARTIAL (not UNKNOWN, not VIOLATED) because the artifact fields needed to determine them are absent. PARTIAL rules are counted in the compliance score denominator; UNKNOWN rules are excluded. The score formula is:

```
score = round( COMPLIANT_count / (COMPLIANT + VIOLATED + PARTIAL) × 100 )
```

### 2.3 `lcis governance`

Composite constitutional report: runs all five sub-reports (drift, compliance, ownership, security, readiness) and computes a single `healthScore` 0–100.

```
lcis governance
lcis governance --json
lcis governance --evidence
```

The `healthScore` is the mean of five clamped sub-scores:

```
healthScore = clamp(
  (clamp(100 - driftPenalty) + complianceScore + ownershipCoverage*100
   + clamp(100 - securityPenalty) + readinessOverall) / 5
)
```

Severity penalties: critical=12, high=6, medium=3, low=1, info=0.

Example summary line:

```
Constitutional health 82/100 — 3 drift, 0 compliance violation(s), 2 security finding(s),
compliance 87/100, readiness 74/100.
```

### 2.4 `lcis readiness`

Per-domain readiness across 10 factors. Factors that cannot be determined from artifacts are surfaced as UNKNOWN (never counted as pass).

```
lcis readiness
lcis readiness --json
```

The four UNKNOWN factors for every domain (because no artifact encodes them):

| Factor | Why UNKNOWN |
|---|---|
| `rollback` | No rollback field in memory-intel migrations |
| `healthcheck` | Worker topology declared; live probe requires OTEL/Cloudflare creds |
| `monitoring` | No monitoring-intent artifact |
| `alerts` | No alert-config artifact |

Bands: `ready` (≥80), `conditional` (50–79), `not-ready` (<50), `unknown` (fewer than 4 KNOWN factors).

### 2.5 `lcis ownership`

Ownership gap report: unowned domains / services / workers / queues / rpcs / tables / runbooks, with per-entity-type coverage percentages.

```
lcis ownership
lcis ownership --json
```

Example:

```
GDIS Ownership Report
summary: 22 domains, 22 owned (100%); 3 workers, 3 owned (100%).
gaps: 0
coverage: { domain: { total: 22, owned: 22, coverage: 1.0 }, ... }
```

### 2.6 `lcis security-drift`

Static security drift: missing RLS, JWT-drift candidates, webhook-auth gaps, step-up coverage, cross-tenant candidates, public-USING policies.

```
lcis security-drift
lcis security-drift --json
lcis security-drift --evidence
```

Note: this is static structural analysis over the governance artifacts, complementary to lcis-live's live security checks. It cannot confirm whether a live probe succeeded.

### 2.7 `lcis architecture-health`

Composite architecture HealthView: structural drift findings + compliance score (R001 emphasis). Score 0–100.

```
lcis architecture-health
lcis architecture-health --json
```

### 2.8 `lcis domain-health`

Domain HealthView: readiness overall + domain-drift findings. Async (awaits readiness report).

```
lcis domain-health
lcis domain-health --json
```

---

## 3. MCP tools

GDIS adds 7 tools to the MCP registry (total registry size: 26 tools).

| MCP tool name | Equivalent CLI | Sync/Async |
|---|---|---|
| `lcis_drift` | `lcis drift` | sync |
| `lcis_compliance` | `lcis compliance` | sync |
| `lcis_governance` | `lcis governance` | async |
| `lcis_readiness` | `lcis readiness` | async |
| `lcis_ownership` | `lcis ownership` | sync |
| `lcis_security_drift` | `lcis security-drift` | sync |
| `lcis_architecture_health` | `lcis architecture-health` | sync |

All tools carry `inputSchema: {}` (no parameters) and return the same envelope as the CLI JSON mode. All are read-only by construction.

---

## 4. API routes (services/lcis-api)

The LCIS API server (`services/lcis-api/src/app.ts`) exposes eight governance routes at the server root.

| Method | Route | Service call | Notes |
|---|---|---|---|
| POST | `/drift` | `gov.drift.generateDriftReport()` | sync |
| POST | `/compliance` | `gov.compliance.generateComplianceReport()` | sync |
| POST | `/governance` | `gov.generateGovernanceReport()` | async |
| POST | `/ownership` | `gov.ownership.generateOwnershipReport()` | sync |
| POST | `/readiness` | `gov.readiness.generateReadinessReport()` | async |
| POST | `/security-drift` | `gov.security.generateSecurityDriftReport()` | sync |
| GET | `/architecture-health` | `gov.generateArchitectureHealth()` | sync |
| GET | `/domain-health` | `gov.generateDomainHealth()` | async |

Example call:

```
curl -s -X POST http://localhost:3333/drift | jq '.data.findings | length'
curl -s http://localhost:3333/architecture-health | jq '.data.score'
```

---

## 5. `generateGovernanceReport` composite and healthScore

The GovernanceEngine facade (`packages/lcis-governance/src/engine.ts`) composes five independent service reports:

```typescript
const gov = getGovernanceEngine();        // singleton; reuses lcis-core's warm graph
const report = await gov.generateGovernanceReport();
// report.healthScore   — 0..100 composite
// report.drift         — DriftReport
// report.compliance    — ComplianceReport (score, violations, evaluations)
// report.ownership     — OwnershipReport (gaps, coverage)
// report.security      — SecurityDriftReport (findings, byKind)
// report.readiness     — ReadinessReport (scores, overall)
// report.evidence      — up to 10 provenance items (2 from each sub-report)
// report.confidence    — aggregate confidence (capped at 0.95)
// report.sources       — deduplicated artifact paths
// report.timestamp     — ISO-8601 at report generation time
```

The five direct health views:

```typescript
gov.generateArchitectureHealth()       // HealthView, sync
gov.generateSecurityHealth()           // HealthView, sync
gov.generateOwnershipHealth()          // HealthView, sync
await gov.generateReadinessHealth()    // HealthView, async
await gov.generateDomainHealth()       // HealthView, async
```

Each HealthView has: `area`, `score`, `findings`, `summary`, `evidence`, `confidence`, `sources`, `timestamp`.

---

## 6. How to read a finding

Every Finding carries:

```json
{
  "id": "R002-store_customers",          // stable, deterministic; survives re-runs
  "category": "compliance",             // drift | compliance | ownership | security | readiness
  "kind": "missing-rls",               // specific sub-kind
  "severity": "critical",              // critical | high | medium | low | info
  "subject": "store_customers",        // the entity the finding is about
  "title": "Tenant table without RLS",
  "detail": "store_customers is tenant-scoped but rls=false",
  "rule": "R002",                      // present only for compliance findings
  "confidence": 0.87,                  // 0..1; never 1.0; UNKNOWN findings are ≤0.35
  "evidence": [
    {
      "type": "table",
      "ref": "store_customers",
      "detail": "rls=false, tenant=true",
      "source": "graphify-out/db-intel.json"
    }
  ]
}
```

Reading guide:
- `id` is deterministic (`stableId(kind, subject)` → uppercased, hyphenated). Same input always produces the same id across runs.
- `confidence` ≤ 0.35 on UNKNOWN findings. Do not treat them as confirmed violations.
- `source` in evidence always points to a real graphify-out artifact, never to a live API.
- The 107-validator gate is authoritative for hard violations. GDIS findings are structural candidates that warrant review.

---

## 7. PR Intelligence V3 — governance verdicts

`analyzeWithGovernance` (the V3 async entry point in `packages/lcis-pr-check/src/analyze.ts`) runs the full GDIS governance engine on every PR and produces six `GovernanceVerdict` entries appended to the PR comment under `## LCIS GOVERNANCE`.

Dimensions and their data source:

| Dimension | Data source | Verdict FAIL condition |
|---|---|---|
| `architecture-drift` | `gov.drift.generateDriftReport()` | critical/high drift findings on affected entities |
| `compliance` | `gov.compliance.generateComplianceReport()` | violations touching affected tables/rpcs |
| `ownership` | `gov.ownership.generateOwnershipReport()` | unowned gaps on affected domains |
| `security-drift` | `gov.security.generateSecurityDriftReport()` | critical/high security findings |
| `readiness` | `gov.readiness.generateReadinessReport()` | affected domains band `not-ready` |
| `governance` | `gov.generateGovernanceReport()` | healthScore below threshold |

Each verdict:

```json
{
  "dimension": "compliance",
  "verdict": "PASS",           // PASS | WARN | FAIL | UNKNOWN
  "summary": "R001-R008 all COMPLIANT or PARTIAL; 0 violations on affected tables.",
  "findings": [],
  "evidence": [...]
}
```

`UNKNOWN` is returned when the engine returns an error or no affected entities can be mapped. It is not a failure — it means the dimension is indeterminate for this PR.

---

## 8. Troubleshooting

**"sources: []" or confidence 0**
Artifacts are missing. Run `pnpm graph:v3` and retry.

**"R006 PARTIAL" every run**
Expected. `memory-intel.json` migration records do not include a rollback field. This is an honest structural gap, not a bug. To resolve, add rollback fields to the migration artifact schema.

**"R008 PARTIAL" every run**
Expected. Worker healthcheck topology is declared in infra-intel but the live probe (`OTEL_EXPORTER_OTLP_ENDPOINT` or `CLOUDFLARE_ANALYTICS_DATASET`) is NOT CONNECTED. Wire a live adapter and the PARTIAL will flip.

**"monitoring / alerts / healthcheck / rollback UNKNOWN in readiness"**
These four readiness factors have no artifact source. They will remain UNKNOWN until a live adapter or annotation source is connected. They are not counted as pass in the score — the denominator adjusts automatically.

**Readiness band shows "unknown" for a domain**
Fewer than 4 factors are KNOWN. Check that domain-intel and infra-intel are fresh (at least owner/runbook/tests/security must be determinable).

**CLI command hangs**
`lcis readiness`, `lcis governance`, and `lcis domain-health` are async and call `core.verification.verifyProductionReadiness()`. If lcis-core's production-readiness artifact is stale, the call may be slow. Run `pnpm graph:reports` to refresh it.

**PR comment shows `UNKNOWN` governance verdicts**
The PR analysis could not map affected entities to governance findings. This is not a blocker — it means the PR does not touch entities that GDIS can track structurally. Review the `findings[]` array in the verbose PR comment for details.
