# Verification Intelligence Guide — VerificationIntelligenceService

**File:** `packages/lcis-engineering/src/verification/VerificationIntelligenceService.ts`

Answers: *"what must be tested and verified before this feature is safe to merge and deploy?"*

---

## What it does

Four public methods, each composing from lcis-execution or lcis-governance:

| Method | Delegates to | Returns |
|---|---|---|
| `planTests(req)` | `eis.testing.generateTestPlan` | `TestPlan` |
| `planVerification(req)` | `eis.verification.buildVerificationPlan` | `VerificationPlan` |
| `coverageGaps(req)` | `eis.testing.detectMissingCoverage` → normalise | `EngineeringFinding[]` (rule=E005) |
| `acceptanceCriteria(req)` | both plans above → deduplicate | `string[]` |

---

## planTests

```typescript
planTests(req: FeatureRequest): TestPlan
  └─ eis.testing.generateTestPlan(req)   [lcis-execution — TestingIntelligenceService]
```

Returns the `TestPlan` verbatim. EINS adds no logic; it is the named composition point.

`TestPlan` (from lcis-execution) shape (relevant fields):
- `suites[]` — test suites per domain/service
- `acceptancePlan[]` — per-domain acceptance targets: `{ target: string, reason: string }`
- `confidence`, `evidence`, `timestamp`

---

## planVerification

```typescript
planVerification(req: FeatureRequest): VerificationPlan
  └─ eis.verification.buildVerificationPlan(req)   [lcis-execution — VerificationPlanner]
```

Returns the `VerificationPlan` verbatim.

`VerificationPlan` (from lcis-execution) shape (relevant fields):
- `checks[]` — `{ id, description }` — individual verification steps
- `preMergeGates[]` — string list of gates that must pass before merge
- `confidence`, `evidence`, `timestamp`

---

## coverageGaps

```typescript
coverageGaps(req: FeatureRequest): EngineeringFinding[]
```

Calls `eis.testing.detectMissingCoverage(req)` which returns `CoverageGap[]`. Each gap is mapped
1:1 to an `EngineeringFinding` with:

- `category: 'gap'`
- `kind: 'coverage-gap'`
- `rule: 'E005'`
- `severity` cast via `toSeverity(gap.severity)` (same safe-cast as FeatureIntelligenceService)
- `subject` = `gap.subject`
- `detail` = `gap.note`

Evidence on each finding:
1. `ev.reuse('lcis-execution', 'eis.testing.detectMissingCoverage', 'coverage gap detection delegated ...')`
   — one shared instance per `coverageGaps` call
2. `...gap.evidence` — the gap's own provenance forwarded verbatim

Honest: when `detectMissingCoverage` returns `[]` (no gaps or unresolved request), `coverageGaps`
returns `[]`. No gap is fabricated.

---

## acceptanceCriteria

```typescript
acceptanceCriteria(req: FeatureRequest): string[]
```

Calls `planTests` and `planVerification`, then combines three sources into a deduplicated
`string[]`:

1. **TestPlan.acceptancePlan** — formatted as
   `'Acceptance: domain "<t.target>" must satisfy its acceptance criteria — <t.reason>'`
2. **VerificationPlan.preMergeGates** — formatted as `'Pre-merge gate: <gate>'`
3. **VerificationPlan.checks** — formatted as `'Verify (<check.id>): <check.description>'`

Deduplication uses a `Set<string>` on the trimmed strings; insertion order is preserved.
Empty when both plans produce no criteria.

Note: reuse-evidence is constructed inside `acceptanceCriteria` but discarded via `void` — the
evidence lives on the plans returned by `planTests`/`planVerification`, not on the string[].

---

## E005 — the coverage gate

E005 is the gate that drives `coverageGaps`. Its definition in `EngineeringRuleRegistry`:

```
E005: "New public routes are covered by tests"
layer: 'test'
severity: 'high'
mapsTo: 'R004'
```

`ChangeIntelligenceService` also fires E005 findings (per api and per rpc in `affected`).
`VerificationIntelligenceService.coverageGaps` fires E005 findings for every structural gap
detected by `detectMissingCoverage`. Both sets appear in `EngineeringBlueprint.gates` — they
are complementary, not duplicates (different source detection).

---

## How the verification layer fits into the blueprint

`generateBlueprint` calls all four methods:

```typescript
const tests        = verification.planTests(req)        → blueprint.tests
const verification = verification.planVerification(req) → blueprint.verification
const gaps         = verification.coverageGaps(req)     → included in blueprint.gates
// acceptanceCriteria is not called by generateBlueprint directly;
// it is available for CLI/API surface consumers
```

---

## Worked example — "Build GST Filing"

```
eis.testing.generateTestPlan(req) returns:
  suites = [
    { domain: "gst", tests: ["create_gst_invoice unit test", "POST /v1/gst/file integration"] }
  ]
  acceptancePlan = [
    { target: "gst", reason: "money+tenant domain requires full acceptance coverage" }
  ]

eis.verification.buildVerificationPlan(req) returns:
  preMergeGates = [
    "canonical-ledger-only-validator passes",
    "107+ validator gate green",
    "RLS policies verified on gst_filings"
  ]
  checks = [
    { id: "V001", description: "Verify create_gst_invoice executes as SECURITY DEFINER" },
    { id: "V002", description: "Verify gst_filings RLS blocks cross-tenant reads" }
  ]

eis.testing.detectMissingCoverage(req) returns:
  [
    { subject: "/v1/gst/file", kind: "route", severity: "high", note: "no test found for route", evidence: [...] }
  ]

coverageGaps returns:
  [
    EngineeringFinding {
      category: 'gap', rule: 'E005', severity: 'high',
      subject: '/v1/gst/file',
      title: 'No test coverage for "/v1/gst/file" (route)',
      detail: 'no test found for route'
    }
  ]

acceptanceCriteria returns:
  [
    'Acceptance: domain "gst" must satisfy its acceptance criteria — money+tenant domain requires full acceptance coverage',
    'Pre-merge gate: canonical-ledger-only-validator passes',
    'Pre-merge gate: 107+ validator gate green',
    'Pre-merge gate: RLS policies verified on gst_filings',
    'Verify (V001): Verify create_gst_invoice executes as SECURITY DEFINER',
    'Verify (V002): Verify gst_filings RLS blocks cross-tenant reads'
  ]
```
