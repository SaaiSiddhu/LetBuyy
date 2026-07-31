# LCIS Ownership Guide

Service: `OwnershipService` (`src/ownership/OwnershipService.ts`)
Entry point: `generateOwnershipReport()` → `OwnershipReport`

---

## What ownership means in GDIS

Ownership is tracked across 7 entity types. The two ownership signals are:

1. **`domain.owners[]`** — declared in `domain-intel.domains[].owners`. These are the canonical owners for a domain and, by extension, everything that domain claims (tables, rpcs, queues).
2. **CODEOWNERS** — the `infra-intel.ownership[]` entries, each with `path` and `owners[]`. A worker or service app is "owned" if its file path or name matches a CODEOWNERS entry via prefix, glob, or substring.

A gap is only reported when both signals are absent.

---

## 7 find-unowned methods

### 1. `findUnownedDomains()`

**Signal:** `domain-intel.domains[].owners.length === 0`
**Gap type:** `domain`
**Severity:** SeverityScorer — `critical` if money, `high` if tenant, `medium` otherwise.
**Real data:** All 22 domains currently have owners. Zero gaps expected.

---

### 2. `findUnownedServices()`

**Signal:** For each `domain.apps[]` entry, check: (a) domain has owners, OR (b) the app path/name matches a CODEOWNERS entry.
**Gap type:** `service`
**Severity:** Inherits domain money/tenant sensitivity.
**Logic:** A service app is owned if its domain has owners OR if `matchesOwnership(app, ownedPaths)` returns true. `matchesOwnership` checks exact path, directory prefix, glob prefix, and substring.

---

### 3. `findUnownedWorkers()`

**Signal:** For each `infra-intel.workers[]`, check: (a) worker is claimed by a domain with owners, OR (b) worker file/name matches a CODEOWNERS entry.
**Gap type:** `worker`
**Severity:** Inherits domain money/tenant sensitivity; `medium` for unclaimed workers.
**Note:** A worker claimed by a domain but that domain has no owners → gap (domain ownership failure, not worker-specific).

---

### 4. `findUnownedQueues()`

**Signal:** For each `domain.queues[]` entry, check if the domain has owners.
**Gap type:** `queue`
**Severity:** Inherits domain money/tenant sensitivity.
**Note:** Queue ownership is domain-derived. If the domain owns it, the queue is owned. CODEOWNERS does not apply to queue strings.

---

### 5. `findUnownedRPCs()`

**Signal:** `db-intel.functions[].name` not present in any `domain.rpcs[]`.
**Gap type:** `rpc`
**Severity:** `critical` if `fn.money`, `medium` otherwise.
**Note:** RPCs with no domain claim have no owner path at all — they are structurally orphaned.

---

### 6. `findUnownedTables()`

**Signal:** `db-intel.tables[].name` not present in any `domain.tables[]`.
**Gap type:** `table`
**Severity:** `critical` if money, `high` if tenant, `medium` otherwise.
**Note:** Same orphan logic as table drift — unowned table = no domain claim.

---

### 7. `findUnownedRunbooks()`

**Signal:** `runbookSubjects()` entries whose normalised key does not match any domain that has owners.
**Gap type:** `runbook`
**Severity:** `medium`
**Note:** A runbook for a domain that has owners is covered. Runbooks for subjects that don't match an owned domain are gaps.

---

## Coverage model

`generateOwnershipCoverage()` returns a map over all 7 entity types:

```ts
interface OwnershipCoverage {
  total: number;
  owned: number;
  coverage: number;  // 0..1; 1.0 when total === 0
}
```

Formula: `coverage = owned / total` (or 1.0 when total is 0).

`generateOwnershipHealth()` in the engine computes the health score as `clamp(avgCoverage(coverage) * 100)` — the arithmetic mean of coverage fractions across all 7 entity types with non-zero totals.

---

## Real-world state

As of 2026-06-20:
- 22 domains: all have owners declared in domain-intel. Domain coverage ≈ 100%.
- 8 money domains, all owned.
- Table and RPC coverage depends on how many are claimed by domains vs. orphaned — orphan counts are surfaced by the drift detectors.
- Compliance R005 (critical services must have owners) is currently COMPLIANT.

---

## `matchesOwnership` helper

Used internally for services and workers. Checks a path against CODEOWNERS patterns:

```
exact match    path === pattern
dir prefix     path.startsWith(pattern + '/')
glob prefix    path.startsWith(pattern.split('*')[0])
substring      path.includes(pattern)
```

CODEOWNERS patterns come from `infra-intel.ownership[].path`.

---

## OwnershipReport structure

```ts
interface OwnershipReport extends GovernanceArtifact {
  gaps: readonly OwnershipGap[];
  coverage: Record<OwnedEntityType, OwnershipCoverage>;
  summary: string;
}

interface OwnershipGap {
  entityType: OwnedEntityType;  // domain|service|worker|queue|rpc|table|runbook
  subject: string;
  severity: Severity;
  evidence: readonly Evidence[];
}
```

The summary includes domain coverage %, RPC coverage %, and table coverage % by name.
