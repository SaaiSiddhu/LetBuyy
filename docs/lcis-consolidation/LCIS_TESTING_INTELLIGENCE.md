# LCIS Testing Intelligence

`TestingIntelligenceService` — Deliverable 4 of the EIS.

**File:** `packages/lcis-execution/src/testing/TestingIntelligenceService.ts`

---

## 1. Responsibilities

The testing service maps a change's structural footprint to test plans. It does not run tests, write test files, or inspect test output. It:

1. Finds existing test files in the blast radius (`detectAffectedTests`)
2. Identifies entities with no test coverage (`detectMissingCoverage`)
3. Produces five per-kind test plans (regression / smoke / load / security / acceptance)
4. Composes the full `TestPlan` artifact with a `coverageConfidence` score

All inputs accepted as `ChangeRequest | ChangeAnalysis` via `toAnalysis()`.

---

## 2. Test File Detection

Test files are identified by the regex `TEST_RE`:

```
/\.(test|spec)\.[tj]sx?$|\/tests?\//i
```

This matches `.test.ts`, `.spec.tsx`, `/tests/`, `/test/` paths. It is the same pattern used in `ChangeAnalyzer.discoverTests()`.

---

## 3. Public API

| Method | Returns | Purpose |
|--------|---------|---------|
| `detectAffectedTests(input)` | `TestTarget[]` | Existing tests that must re-run |
| `detectMissingCoverage(input)` | `CoverageGap[]` | Entities with no matching test in the graph |
| `generateTestPlan(input)` | `TestPlan` | Full composed artifact |
| `generateRegressionPlan(input)` | `TestTarget[]` | Affected tests cast to kind `'regression'` |
| `generateSmokePlan(input)` | `TestTarget[]` | Critical-path tests in blast radius |
| `generateLoadPlan(input)` | `TestTarget[]` | Routes + workers as load targets |
| `generateSecurityPlan(input)` | `TestTarget[]` | RPCs + validators when money/tenant/auth is in blast |
| `generateAcceptancePlan(input)` | `TestTarget[]` | One target per affected domain |

All methods return `[]` for unresolved change requests.

---

## 4. `detectAffectedTests` — How It Works

1. Includes any test files already in `analysis.affected.tests` (found by `ChangeAnalyzer.discoverTests`)
2. Searches the code graph for test nodes referencing each of the following terms (bounded by count):
   - Up to 6 affected RPCs
   - Up to 4 affected APIs
   - Up to 8 affected tables
   - Up to 4 affected domains
3. Each result is added as kind `'regression'` with a `'file'` evidence entry citing `graphify-out/graph.json`
4. De-duplicated by file path

---

## 5. `detectMissingCoverage` — Coverage Gap Logic

For each entity in `affected.rpcs`, `affected.apis`, and `affected.tables`, the service searches the graph for any node with a matching `sourceFile` that passes `TEST_RE`. If no such node is found, the entity is a coverage gap.

Severity classification:

| Condition | Severity |
|-----------|----------|
| `money === true` AND entity name contains `payment`, `order`, `ledger`, `refund`, `gift_card`, `payout`, or `checkout` | `critical` |
| `tenant === true` AND entity name contains `site`, `store`, `tenant`, or `merchant` | `high` |
| Overall risk level is `'high'` or `'critical'` | `high` |
| All other gaps | `medium` |

Gap `kind` maps as: rpc → `'unit'`, route/api → `'integration'`, table → `'unit'`.

---

## 6. Per-Kind Plan Helpers

### Regression Plan

Re-runs all tests found by `detectAffectedTests`, cast to `kind: 'regression'`. This is the minimum required test set before a merge.

### Smoke Plan

Uses `CRITICAL_PATH_TERMS` (hardcoded structural keywords, not LLM-generated):

```
['checkout', 'payment', 'auth', 'identity', 'order', 'refund', 'gift_card']
```

For each term that appears anywhere in the blast radius (domains, rpcs, apis, tables), the graph is searched for test files referencing that term. Matches become `kind: 'smoke'` targets. This ensures critical commercial paths are always smoke-tested even if the change is not directly in those domains.

### Load Plan

One `kind: 'load'` target per `affected.api` route and per `affected.worker`. Routes need throughput-SLO verification; workers need queue throughput + idempotency verification.

### Security Plan

Active only when at least one of these is true:
- `risk.money === true`
- `risk.tenant === true`
- blast radius contains `auth`, `identity`, `jwt`, or `session`

Produces:
- One `kind: 'security'` target per affected RPC (money/tenant/auth exposure noted)
- If money: one target for `'canonical-ledger-only-validator'`
- If tenant: one target for `'RLS-tenant-isolation'`

Returns `[]` when none of the elevated conditions are present.

### Acceptance Plan

One `kind: 'acceptance'` target per affected domain. Each target is anchored to the domain's name and evidence. An acceptance target means the business behavior of that domain must remain correct after the change.

---

## 7. `TestPlan` — Composed Artifact

```typescript
interface TestPlan extends PlanArtifact {
  request: ChangeRequest;
  required: TestTarget[];         // existing tests that MUST run
  missing: CoverageGap[];         // entities with no test (should be added)
  recommended: TestTarget[];      // defense-in-depth suggestions
  regressionPlan: TestTarget[];
  smokePlan: TestTarget[];
  loadPlan: TestTarget[];
  securityPlan: TestTarget[];
  acceptancePlan: TestTarget[];
  riskLevel: RiskLevel;
  coverageConfidence: number;     // 0..1
}
```

`recommended` contains up to 3 auto-generated entries:
- Money exposure → `'security'` target for `'money-ledger canonical-RPC paths'`
- Tenant exposure → `'integration'` target for `'multi-tenant RLS isolation'`
- Risk `'high'` or `'critical'` → `'contract'` target for `'affected API contracts'`

---

## 8. Coverage Confidence

`coverageConfidence` is not a true coverage percentage — it is a proxy:

```
coverageConfidence = required.length / max(totalEntities, 1)
```

Where `totalEntities = rpcs + apis + tables + domains` from the affected sets.

`required.length` is the count of existing test files found (each is one `TestTarget`). This means a change affecting 10 entities where 5 test files are found in the graph scores 0.5.

The value is rounded to 2 decimal places and capped at 1.0. When no entities are affected (`totalEntities === 0`), `coverageConfidence` is 0.

This is structural-only confidence. It measures whether test files that reference affected entities exist in the graph, not whether those tests actually exercise the affected code paths.

---

## 9. Confidence and Evidence

`generateTestPlan()` computes confidence with base 0.4 (lower than other services, reflecting the inherent limits of structural-only test discovery):

```
planConfidence(ev, 0.4) = min(0.4 + min(evidenceCount, 9) * 0.05, 0.95)
```

Evidence is collected from:
1. `analysis.evidence` — all blast-radius evidence
2. `required.flatMap(t => t.evidence)` — one evidence per found test file
3. `missing.flatMap(g => g.evidence)` — one evidence per gap

---

## 10. Test Kind Vocabulary

```typescript
type TestKind =
  | 'unit'         // individual function/RPC
  | 'integration'  // across service boundaries
  | 'regression'   // re-run existing test after change
  | 'smoke'        // critical-path quick check
  | 'load'         // throughput / SLO
  | 'security'     // auth/tenant/money path
  | 'acceptance'   // business behavior of a domain
  | 'contract'     // API surface contract
```
