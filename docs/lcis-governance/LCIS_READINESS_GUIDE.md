# LCIS Readiness Guide

Service: `ReadinessService` (`src/readiness/ReadinessService.ts`)
Entry point: `generateReadinessReport()` → `ReadinessReport` (evaluates all 22 domains)

---

## 10 factors + weights

| Factor key | Weight | Present when | UNKNOWN when |
|------------|--------|-------------|--------------|
| `owner` | 0.15 | `domain.owners.length > 0` | — |
| `runbook` | 0.15 | domain key in `runbookSubjects()` | — |
| `tests` | 0.12 | `graph.search('test ' + domainKey, 20)` returns a node with test/spec in id/label | — |
| `rollback` | 0.10 | — | Always UNKNOWN — no rollback field in artifacts |
| `coverage` | 0.10 | `≥ 3` test-like nodes in `graph.search('test ' + domainKey, 30)` | — |
| `documentation` | 0.10 | `memory.search(domainKey, {limit: 5})` returns any hit | — |
| `healthcheck` | 0.08 | — | Always UNKNOWN — live probe NOT CONNECTED |
| `monitoring` | 0.08 | — | Always UNKNOWN — no monitoring artifact |
| `alerts` | 0.07 | — | Always UNKNOWN — no alert-config artifact |
| `security` | 0.05 | All tenant tables have RLS + at least one securityDefiner fn + policies.length > 0 | — |

Weights sum to 1.0. The four UNKNOWN factors (`rollback`, `healthcheck`, `monitoring`, `alerts`) total 0.33 of the theoretical weight — they are always excluded from the denominator.

---

## Score formula

Only KNOWN factors (present is `true` or `false`, never `'UNKNOWN'`) participate:

```
denominator = sum of KNOWN factor weights
numerator   = sum of KNOWN factor weights where present === true
score       = round( numerator / denominator × 100 )   (0 if denominator === 0)
```

With the 4 always-UNKNOWN factors excluded, the denominator is at most `0.15+0.15+0.12+0.10+0.10+0.05 = 0.67`. A domain that passes all 6 determinable factors scores 100/100 (normalised over the known denominator).

---

## Band assignment

```
knownCount = factors.length - unknowns.length

if knownCount < 4   → 'unknown'
elif score >= 80    → 'ready'
elif score >= 50    → 'conditional'
else                → 'not-ready'
```

Because 4 factors are always UNKNOWN, a domain always has `knownCount = 6` — exactly at the threshold. If the artifact does not load any of the determinable factors, the band can fall to `unknown`.

---

## UNKNOWN factors and why

| Factor | Exact missing artifact / signal | Evidence item emitted |
|--------|---------------------------------|-----------------------|
| `rollback` | `memory-intel.migrations[].rollback` field absent from schema | `notConnected('rollback-presence', 'ROLLBACK_ARTIFACT_NOT_IN_GRAPHIFY_OUT')` |
| `healthcheck` | Live healthcheck probe requires runtime connection | `notConnected('healthcheck-live-probe', 'HEALTHCHECK_PROBE_NOT_CONNECTED')` |
| `monitoring` | No `monitoring-intel` artifact in graphify-out | `notConnected('monitoring-config', 'MONITORING_ARTIFACT_NOT_IN_GRAPHIFY_OUT')` |
| `alerts` | No alert-config artifact in graphify-out | `notConnected('alert-config', 'ALERT_CONFIG_NOT_IN_GRAPHIFY_OUT')` |

These appear in `ReadinessScore.unknowns[]` and are surfaced, not silently dropped.

---

## ReadinessScore and ReadinessReport structures

```ts
interface ReadinessFactor {
  key: ReadinessFactorKey;
  present: boolean | 'UNKNOWN';
  weight: number;
  evidence: readonly Evidence[];
}

interface ReadinessScore extends GovernanceArtifact {
  subject: string;       // domain key or worker name
  score: number;         // 0–100 over KNOWN factors
  factors: readonly ReadinessFactor[];
  band: ReadinessBand;   // 'ready' | 'conditional' | 'not-ready' | 'unknown'
  unknowns: readonly ReadinessFactorKey[];
  summary: string;
}

interface ReadinessReport extends GovernanceArtifact {
  scores: readonly ReadinessScore[];
  overall: number;       // arithmetic mean of all domain scores
  summary: string;
}
```

---

## Entry points in ReadinessService

| Method | What it evaluates |
|--------|------------------|
| `evaluateDomainReadiness(key)` | All 10 factors for one domain |
| `evaluateServiceReadiness(workerName)` | 6 factors for one worker (owner/runbook/healthcheck/monitoring/tests/security) |
| `evaluateLaunchReadiness()` | Reads `production-readiness-v2.systems[]` and translates each into a `ReadinessScore`; reuses `core.verification.verifyProductionReadiness()` |
| `evaluateOperationalReadiness()` | 4 factors per domain: runbook (known) + healthcheck/monitoring/alerts (UNKNOWN) |
| `evaluateRecoveryReadiness()` | 2 factors per domain: rollback (UNKNOWN) + runbook (known) |
| `evaluateSecurityReadiness()` | 1 factor per domain: security posture (RLS + secDef + policies) |
| `generateReadinessReport()` | Full: `evaluateDomainReadiness` for all 22 domains, then overall average |

---

## `verifyProductionReadiness()` reuse

`evaluateLaunchReadiness()` calls `this.core.verification.verifyProductionReadiness()` from lcis-core and translates its `systems[]` output into `ReadinessScore` objects. It does NOT reimplement production readiness logic — it delegates and wraps. The lcis-core result provides verification `status` and `confidence` for the summary.

---

## Readiness in the GovernanceEngine

`generateReadinessHealth()` in `engine.ts` runs `generateReadinessReport()` and builds a `HealthView`:

- Domains with band `not-ready` → `high`-severity finding.
- Domains with band `conditional` → `medium`-severity finding.
- `score = clamp(readiness.overall)`.
- `area = 'readiness'`.

`generateGovernanceReport()` includes `readiness.overall` as one-fifth of the composite `healthScore`.

---

## Operational guidance

UNKNOWN factors are honest gaps, not bugs. To move factors from UNKNOWN to known:

| Factor | What to wire |
|--------|-------------|
| `rollback` | Add a `rollback` field to `memory-intel.migrations[]` in the graphify schema. |
| `healthcheck` | Connect `OTEL_EXPORTER_OTLP_ENDPOINT` or `CLOUDFLARE_ANALYTICS_DATASET` (lcis-live adapters). |
| `monitoring` | Create a `monitoring-intel.json` artifact in graphify-out. |
| `alerts` | Create an `alert-config.json` artifact in graphify-out. |
