# LCIS Drift Detection Guide

Service: `DriftDetectionService` (`src/drift/DriftDetectionService.ts`)
Entry point: `generateDriftReport(scope?)` — aggregates all 16 detectors into a `DriftReport`.

All detectors are deterministic, read-only, and zero-IO. Evidence is pinned to the real artifact field that sourced each finding.

---

## Detector catalogue

### 1. Table drift — orphan tables

**Method:** `detectTableDrift()`
**Artifact field:** `db-intel.tables[].name` vs `domain-intel.domains[].tables[]`
**Rule:** A table not in any domain's `tables[]` array is an orphan.
**Severity:** `critical` if `money=true`; `high` if `tenant=true`; `medium` otherwise.
**Finding id:** `TABLE-DRIFT-<tableName>`
**Example:** Table `payment_transactions` exists in db-intel but no domain claims it → critical orphan.

---

### 2. RPC drift — orphan functions

**Method:** `detectRPCDrift()`
**Artifact field:** `db-intel.functions[].name` vs `domain-intel.domains[].rpcs[]`
**Rule:** A function not in any domain's `rpcs[]` array is an orphan.
**Severity:** `critical` if `money=true`; `medium` otherwise.
**Finding id:** `RPC-DRIFT-<fnName>`

---

### 3. Domain drift — structurally orphaned domains

**Method:** `detectDomainDrift()`
**Artifact field:** `domain-intel.domains[].tables.length` and `.rpcs.length`
**Rule:** A domain with zero tables AND zero rpcs is structurally orphaned.
**Severity:** `critical`/`high` (money/tenant); `medium` otherwise.
**Finding id:** `DOMAIN-DRIFT-<domainKey>`

---

### 4. Service drift — domain declares service not in infra

**Method:** `detectServiceDrift()`
**Artifact field:** `domain-intel.domains[].apps[]` and `.workers[]` vs `infra-intel.workers[].name` and `.file`
**Rule:** Any string in `domain.apps` or `domain.workers` that matches no infra-intel worker by name, file path, or basename.
**Severity:** Inherits domain money/tenant sensitivity.
**Finding id:** `SERVICE-DRIFT-<domainKey>:<ref>`

---

### 5. Worker drift — infra worker not claimed by any domain

**Method:** `detectWorkerDrift()`
**Artifact field:** `infra-intel.workers[].name` and `.file` vs `domain-intel.domains[].workers[]`
**Rule:** An infra worker whose name and file (and basename) appear in no domain's `workers[]`.
**Severity:** `medium` (GovWorker has no money/tenant field).
**Finding id:** `WORKER-DRIFT-<workerName>`

---

### 6. Queue drift — queue not claimed by any domain

**Method:** `detectQueueDrift()`
**Artifact field:** `infra-intel.workers[].queueProducers` and `.queueConsumers` vs `domain-intel.domains[].queues[]`
**Rule:** Any queue name in any worker's producer or consumer list that appears in no domain's `queues[]`.
**Severity:** `high` if the queue also has no consumer (doubly orphaned); `medium` otherwise.
**Finding id:** `QUEUE-DRIFT-<queueName>`

---

### 7. Event drift — orphan event channel (producer with no consumer)

**Method:** `detectEventDrift()`
**Artifact field:** `infra-intel.workers[].queueProducers` and `.queueConsumers`
**Rule:** A queue that has at least one producer worker but zero consumer workers — events emitted into a black hole.
**Severity:** `high`
**Finding id:** `EVENT-DRIFT-<queueName>`

---

### 8. Runbook drift — critical domain with no runbook

**Method:** `detectRunbookDrift()`
**Artifact field:** `domain-intel.domains[].money` and `.tenant` vs normalised `runbookSubjects()`
**Rule:** A money or tenant domain whose key (and label) is absent from the runbook registry subjects.
**Severity:** `high` for money domains; `medium` for tenant-only.
**Finding id:** `RUNBOOK-DRIFT-<domainKey>`

---

### 9. Test drift — domain with no test file node in code graph

**Method:** `detectTestDrift()`
**Artifact field:** `graph.json` node search for domain key and its tables (pattern `*.test.*` or `*.spec.*`)
**Rule:** `graph.search(domainKey, 20)` + first-3-tables search returns no node whose `sourceFile` matches `/\.(test|spec)\.[tj]sx?$|\/tests?\//i`.
**Severity:** Inherits domain money/tenant sensitivity; base `medium`.
**Finding id:** `TEST-DRIFT-<domainKey>`

---

### 10. Documentation drift — domain with no doc hit in memory corpus

**Method:** `detectDocumentationDrift()`
**Artifact field:** `memory.search(domainKey, {limit: 5})` hits of type `governance`, `architecture`, or `runbook`
**Rule:** Memory search returns no hit of those three types (excluding node_modules).
**Severity:** Inherits domain money/tenant sensitivity; base `low`.
**Finding id:** `DOC-DRIFT-<domainKey>`

---

### 11. Migration drift — sequence gaps + UNKNOWN rollback

**Method:** `detectMigrationDrift()`
**Artifact field:** `memory-intel.migrations[].n` (sequence numbers)
**Rule (gap):** Sorted sequence with a jump of more than 1 between consecutive migration numbers.
**Severity (gap):** `medium`
**Finding id (gap):** `MIGRATION-GAP-<prev>-<curr>`

**UNKNOWN finding:** An additional `info`-severity finding is always emitted: the migration artifact records `n/file/name/type/decision` but has no `rollback` field. Rollback coverage is UNKNOWN and cannot be determined structurally. Confidence is forced to 0.3.
**Finding id (rollback):** `MIGRATION-ROLLBACK-all`

---

### 12. Validator drift — PARTIAL (rule→validator mapping absent)

**Method:** `detectValidatorDrift()`
**Artifact field:** `db-intel` (presence only — no validator-intel artifact)
**Rule:** The artifacts confirm 107+ validators exist (via the gate) but no artifact encodes the rule→validator mapping.
**Severity:** `info`
**Confidence:** 0.3 (forced)
**Finding id:** `VALIDATOR-DRIFT-rule-mapping`
**This is a PARTIAL finding** — the gap is documented, not papered over. Full validator-rule mapping requires a dedicated `validator-intel` artifact.

---

### 13. Ownership drift — domains/workers with empty owners

**Method:** `detectOwnershipDrift()`
**Artifact field:** `domain-intel.domains[].owners[]` and `infra-intel.workers[]`
**Rule:** Any domain with `owners.length === 0`. Also: an `info`-severity finding noting that `GovWorker` has no `owners` field — worker ownership must be inferred via CODEOWNERS (the OwnershipService does this more deeply).
**Severity:** Inherits domain money/tenant sensitivity; `info` for the worker structural gap.

---

### 14. Security drift (thin) — RLS and public policy signals

**Method:** `detectSecurityDrift()`
**Artifact field:** `db-intel.tables[].tenant` + `.rls`; `db-intel.policies[].public` + `.serviceRole` + `.usesSiteId`
**Rule:** Tenant table with `rls=false` → `critical` (R002 tag). Policy with `public=true AND serviceRole=false AND usesSiteId=false` → `high`.
**Finding ids:** `RLS-DRIFT-<table>`, `POLICY-PUBLIC-<policyName>`

This is a thin subset of what `SecurityDriftService` provides. The SecurityDriftService is the deep path.

---

### 15. Architecture drift — composite summary

**Method:** `detectArchitectureDrift()`
**Rule:** Runs all 14 non-composite detectors (1–14) and emits a single composite `Finding` with the total count, critical count, high count, and most-severe level. Does not re-emit the individual findings — it is a rollup.
**Severity:** Most severe across all component findings.
**Finding id:** `ARCHITECTURE-DRIFT-composite`

---

### 16. generateDriftReport — full aggregate

**Method:** `generateDriftReport(scope = 'all')`
Calls all 15 detectors (including the composite) and merges every finding into a `DriftReport`:

```ts
interface DriftReport extends GovernanceArtifact {
  scope: string;
  findings: readonly Finding[];
  byKind: Record<string, number>;  // per-kind counts
  summary: string;
}
```

Wrapped in the `governance()` envelope with evidence aggregated from all findings and sources from `sourcesPresent()`.

---

## UNKNOWN / PARTIAL behaviour

| Detector | Status | Reason |
|----------|--------|--------|
| Migration rollback (detector 11) | UNKNOWN | No `rollback` field in `memory-intel.migrations[]` schema |
| Validator→rule mapping (detector 12) | PARTIAL | No `validator-intel` artifact; 107+ validators confirmed by gate only |
| Worker ownership (detector 13) | Info gap | `GovWorker` has no `owners` field; CODEOWNERS inferred by OwnershipService |

These are emitted as honest findings, not silently dropped.
