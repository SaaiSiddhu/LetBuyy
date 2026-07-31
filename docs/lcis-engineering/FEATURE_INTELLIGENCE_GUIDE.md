# Feature Intelligence Guide — FeatureIntelligenceService

**File:** `packages/lcis-engineering/src/feature/FeatureIntelligenceService.ts`

Answers: *"what is the full surface area of this feature?"*

---

## What it does

`FeatureIntelligenceService.analyzeFeature(req: FeatureRequest): EngineeringImpact`

Calls `eis.analyze(req)` (lcis-execution's `EisEngine`) exactly once, then normalises the
`ChangeAnalysis` into `EngineeringImpact`. It never reimplements blast-radius logic.

---

## The reuse chain

```
analyzeFeature(req)
  └─ eis.analyze(req)           [lcis-execution — EisEngine]
       ├─ returns ChangeAnalysis {
       │    affected: { domains, services, apis, rpcs, tables, workers, queues, events, tests, docs }
       │    complexity: { band: ComplexityBand, score: number }
       │    risk: { level, money, tenant, drivers[] }
       │    confidence: number
       │    unresolved: boolean
       │  }
       └─ EngineeringImpact (EINS normalisation)
            ├─ all affected sets copied flat (readonly string[])
            ├─ complexity carried verbatim
            ├─ risk.level cast via toSeverity()
            │     ('critical'|'high'|'medium'|'low' safe-cast; 'info' is the EINS-only fallback)
            └─ unresolved flag preserved
```

---

## Evidence construction

Every `analyzeFeature` call adds:

1. `ev.reuse('lcis-execution', 'eis.analyze', 'feature change surface')` — the mandatory
   composition citation (always present, even when unresolved).
2. One `ev.domain(d, ...)` per affected domain.
3. One `ev.table(t, ...)` per affected table.
4. One `ev.rpc(r, ...)` per affected RPC.
5. `...analysis.evidence` — the `ChangeAnalysis`'s own provenance forwarded verbatim.

Confidence is `conf.fromComposed([analysis.confidence])` — the mean of the composed plan's
confidence, capped at 0.9. It equals `analysis.confidence` when there is one plan.

---

## EngineeringImpact shape

```typescript
interface EngineeringImpact extends EngineeringArtifact {
  request: FeatureRequest
  domains: readonly string[]
  services: readonly string[]
  apis: readonly string[]
  rpcs: readonly string[]
  tables: readonly string[]
  workers: readonly string[]
  queues: readonly string[]
  events: readonly string[]
  tests: readonly string[]
  docs: readonly string[]
  complexity: { band: ComplexityBand; score: number }
  risk: { level: Severity; money: boolean; tenant: boolean; drivers: readonly string[] }
  unresolved: boolean
  // inherited from EngineeringArtifact:
  evidence: readonly Evidence[]
  confidence: number        // 0..0.9, 0 if no evidence
  sources: readonly string[]
  timestamp: string
}
```

`ComplexityBand` = `'trivial' | 'low' | 'moderate' | 'high' | 'severe'`

---

## Honest unresolved handling

When `eis.analyze` returns `unresolved: true` (no seed matched the request):

- All domain/service/api/rpc/table/worker/queue/event/test/doc arrays are `[]`
- `complexity` and `risk` are still copied from the analysis (they have structural defaults)
- `unresolved: true` is set explicitly
- Evidence still contains the mandatory reuse citation
- No set is fabricated

```typescript
// Caller pattern
const impact = engine.analyzeFeature(req)
if (impact.unresolved) {
  // Nothing resolved — surface the request to the user for refinement
}
```

---

## Worked example — "Build GST Filing"

```
req = { text: "Build GST Filing", domains: ["gst"], tables: ["invoices","gst_filings"] }

eis.analyze(req) returns:
  affected.domains  = ["gst"]
  affected.tables   = ["invoices", "gst_filings"]
  affected.rpcs     = ["create_gst_invoice"]
  affected.apis     = ["/v1/gst/file"]
  risk.money        = true
  risk.tenant       = true
  complexity.band   = "moderate"
  confidence        = 0.75

analyzeFeature produces:
  EngineeringImpact {
    domains: ["gst"],
    tables: ["invoices","gst_filings"],
    rpcs: ["create_gst_invoice"],
    apis: ["/v1/gst/file"],
    risk: { level: "high", money: true, tenant: true, drivers: [...] },
    complexity: { band: "moderate", score: 45 },
    unresolved: false,
    confidence: 0.75,   // fromComposed([0.75]) = 0.75
    evidence: [
      { ref: "lcis-execution:eis.analyze", detail: "feature change surface", ... },
      { kind: "artifact-field", ref: "domain:gst", ... },
      { kind: "table", ref: "invoices", ... },
      { kind: "table", ref: "gst_filings", ... },
      { kind: "rpc",   ref: "create_gst_invoice", ... },
      ...analysis.evidence
    ]
  }
```

---

## What it does not do

- Does not apply engineering gates (that is `ChangeIntelligenceService`)
- Does not generate tasks (that is `TaskIntelligenceService`)
- Does not inspect db-intel directly (lcis-execution owns that)
- Does not fabricate affected sets when unresolved
