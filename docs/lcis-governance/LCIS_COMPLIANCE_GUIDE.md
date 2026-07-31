# LCIS Compliance Guide

Service: `ComplianceService` (`src/compliance/ComplianceService.ts`)
Rule registry: `GovernanceRuleRegistry` (`src/shared/rules.ts`)
Entry point: `generateComplianceReport()` → `ComplianceReport`

---

## Status semantics

| Status | Meaning |
|--------|---------|
| `COMPLIANT` | Every entity evaluated for this rule passed. |
| `VIOLATED` | At least one entity failed the rule. |
| `PARTIAL` | The structural data is insufficient to give a definitive COMPLIANT/VIOLATED verdict. |
| `UNKNOWN` | No entities to evaluate, or the required data is entirely absent from artifacts. |

`UNKNOWN` rules are excluded from the compliance score denominator.

---

## Score formula

```
score = round( COMPLIANT_count / (COMPLIANT + VIOLATED + PARTIAL) × 100 )
```

UNKNOWN rules do not appear in the denominator. If denominator is 0, score is 0.

---

## Rules R001–R008

### R001 — Money mutations must use canonical RPC

**Severity:** `critical` | **Category:** `architecture`

**Check:** For every function in `db-intel.functions[]` where `money=true`, all three properties must hold:
- `securityDefiner === true`
- `hasIdempotency === true`
- `forUpdate === true`

**Data source:** `db-intel.functions[].money`, `.securityDefiner`, `.hasIdempotency`, `.forUpdate`

**Violation:** A money function missing any of the three. Finding severity is always `critical`.

**Real data:** 34 money functions evaluated. Status depends on run-time artifact — the gate enforces the canonical-ledger-only model. No hard violations currently.

**Method:** `evaluateArchitectureCompliance()`

---

### R002 — Tenant tables must have RLS

**Severity:** `critical` | **Category:** `security`

**Check:** For every table in `db-intel.tables[]` where `tenant=true`, `rls` must be `true`.

**Data source:** `db-intel.tables[].tenant`, `.rls`

**Violation:** `tenant=true AND rls=false`. Severity: `high` (SeverityScorer: tenant → high).

**Real data:** 256 tenant tables evaluated. 20 have `rls=false` per the artifact — these are the 20 flagged by the `rls-force-coverage-validator`. Whether they are true violations depends on intentional public-table design; the gate is authoritative.

**Method:** `evaluateSecurityCompliance()`

---

### R003 — Critical domains must have runbooks

**Severity:** `high` | **Category:** `operational`

**Check:** For every domain where `money=true OR tenant=true`, the domain key (or label, normalised to lowercase) must appear in `runbookSubjects()`.

**Data source:** `domain-intel.domains[].money`, `.tenant`, `.key`, `.label`; `runbooks` artifact via `runbookSubjects()`

**Violation:** Critical domain key/label absent from the normalised runbook subject set.

**Status:** `UNKNOWN` if no critical domains exist; otherwise `COMPLIANT` or `VIOLATED`.

**Method:** `_evalR003()` (called by `evaluateOperationalCompliance()`)

---

### R004 — Public APIs must have tests

**Severity:** `high` | **Category:** `testing`

**Check:** For every domain with `routes.length > 0`, a `graph.search(domainKey, 20)` must return at least one node whose `id` or `label` contains `test` or `spec`.

**Data source:** `domain-intel.domains[].routes`, `graph.json` node search

**Violation:** Domain with routes but no test-like node in graph search.

**Status:** `UNKNOWN` if no domains have routes.

**Note:** Graph search is a substring match over node ids and labels — a hit means a test-like node exists for this domain in the 52k-node graph; absence means none was found, which is a gap signal not a proof of zero tests.

**Method:** `evaluateTestingCompliance()`

---

### R005 — Critical services must have owners

**Severity:** `high` | **Category:** `ownership`

**Check:** For every domain where `money=true OR tenant=true`, `owners.length` must be `> 0`.

**Data source:** `domain-intel.domains[].money`, `.tenant`, `.owners`

**Violation:** Critical domain with empty `owners[]`. Severity: `critical` for money, `high` for tenant.

**Real data:** 22 domains, all currently have declared owners. R005 status is COMPLIANT on this codebase.

**Method:** `evaluateOwnershipCompliance()`

---

### R006 — Migrations must have rollback

**Severity:** `medium` | **Category:** `operational`

**Status: PARTIAL (always)**

**Why:** The `memory-intel.migrations[]` schema records `n`, `file`, `name`, `type`, `decision` but has no `rollback` field. Rollback presence is NOT determinable from artifacts alone. A `notConnected('migration.rollback', 'graphify-out/memory-intel.json#migrations[].rollback')` evidence item is emitted.

**Data source:** `memory-intel.migrations[]` (count only)

**Violations:** Always empty (cannot determine violations without the field).
**passed:** Always 0 (PARTIAL excludes from denominator).

**Method:** `_evalR006()`

---

### R007 — Domains must have documentation

**Severity:** `medium` | **Category:** `governance`

**Check:** For every domain, `memory.search(domainKey, {limit: 5})` must return at least one hit with `score > 0` and `type === 'governance' OR 'architecture'`.

**Data source:** `domain-intel.domains[].key`; memory corpus via `core.memory.search()`

**Violation:** Domain with no governance/architecture doc hit in the memory search.

**Status:** `UNKNOWN` if no domains exist.

**Method:** `evaluateGovernanceCompliance()`

---

### R008 — Production services must have healthchecks

**Severity:** `high` | **Category:** `operational`

**Status: PARTIAL (always)**

**Why:** Workers are declared in `infra-intel.workers[]` (structural topology is CONNECTED), but whether a live healthcheck probe succeeds requires runtime telemetry (NOT CONNECTED). A `notConnected('worker.healthcheck.liveProbe', 'OTEL_EXPORTER_OTLP_ENDPOINT or CLOUDFLARE_ANALYTICS_DATASET')` evidence item is emitted.

**Data source:** `infra-intel.workers[]` (count only)

**Violations:** Always empty.
**passed:** Always 0 (PARTIAL excludes from denominator).

**Method:** `_evalR008()`

---

## Report structure

```ts
interface ComplianceReport extends GovernanceArtifact {
  evaluations: readonly RuleEvaluation[];  // R001-R008 in order
  score: number;       // 0–100, UNKNOWN excluded
  violations: readonly Finding[];
  summary: string;
}

interface RuleEvaluation {
  rule: ComplianceRule;
  status: ComplianceStatus;  // COMPLIANT | VIOLATED | PARTIAL | UNKNOWN
  violations: readonly Finding[];
  checked: number;    // entities evaluated
  passed: number;     // entities that passed
  evidence: readonly Evidence[];
}
```

The report is wrapped in the `governance()` envelope with `confidence: 0.9` (structural).

---

## Evaluation order in generateComplianceReport()

R001 → R002 → R003 → R004 → R005 → R006 → R007 → R008

R006 and R008 are always PARTIAL. With current data, R001 and R005 are expected COMPLIANT; R002, R003, R004, R007 depend on artifact content at the time of the run.
