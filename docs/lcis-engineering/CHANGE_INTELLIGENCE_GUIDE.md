# Change Intelligence Guide — ChangeIntelligenceService

**File:** `packages/lcis-engineering/src/change/ChangeIntelligenceService.ts`

Answers: *"which construction gates does this feature trigger, and why?"*

---

## What it does

Two public methods:

- `analyzeChange(req: FeatureRequest): EngineeringFinding[]`
  — one finding per triggered gate, or `[]` when unresolved.
- `changeByLayer(req: FeatureRequest): Readonly<Record<EngineeringLayer, EngineeringFinding[]>>`
  — the same findings grouped by the rule's `layer` field.

Calls `eis.analyze(req)` once. Reads `db-intel` (tables/functions) from the core store for the
money/tenant/securityDefiner flags. No re-implementation of blast logic.

---

## Gate → entity mapping (E001–E008)

Each gate fires when a specific entity type appears in `analysis.affected`:

| Gate | Triggers on | Category | Severity |
|---|---|---|---|
| **E001** | `affected.tables` where `money=true` | `gate` | `critical` |
| **E001** | `affected.rpcs` where `money=true && !securityDefiner` | `gap` | `critical` |
| **E002** | `affected.tables` where `tenant=true` | `gate` | `critical` |
| **E003** | every entry in `affected.apis` | `gate` | `high` |
| **E004** | every entry in `affected.domains` | `gap` | `high` |
| **E005** | every entry in `affected.apis` | `gap` | `high` |
| **E005** | every entry in `affected.rpcs` | `gap` | `high` |
| **E006** | all `affected.tables` (migration surface) — one grouped finding | `gate` | `medium` |
| **E007** | every entry in `affected.domains` | `gap` | `medium` |
| **E008** | every entry in `affected.workers` | `gap` | `high` |
| **E008** | every entry in `affected.queues` | `gap` | `high` |

Note: E006 deduplicates — all affected tables are grouped into a single finding (not one per table).

---

## EngineeringFinding shape

```typescript
interface EngineeringFinding {
  id: string            // stable uuid from EngineeringFindingBuilder
  category: 'gate' | 'risk' | 'gap' | 'blocker'
  kind: string          // machine-readable kind (e.g. 'money-rpc-required')
  severity: Severity
  subject: string       // entity name (table / rpc / api / domain / ...)
  title: string
  detail: string        // what the engineer must do
  rule?: string         // 'E001'..'E008'
  confidence: number
  evidence: readonly Evidence[]
}
```

---

## Evidence on every finding

Each finding carries:

1. `ev.reuse('lcis-execution', 'eis.analyze', '<entity type> in affected.<set>: <name>')` — the
   mandatory composition citation naming exactly which prior call and which output set.
2. Entity-specific evidence: `ev.table(name, ...)`, `ev.rpc(name, ...)`, `ev.domain(name, ...)`,
   or `ev.field(...)`.

---

## EngineeringRuleRegistry

`EngineeringRuleRegistry` lives in `shared/rules.ts`. Each rule has:

```typescript
interface EngineeringRule {
  id: string          // 'E001'..'E008'
  title: string
  description: string
  severity: Severity
  layer: EngineeringLayer  // determines which layer the finding appears in
  mapsTo?: string     // the governance rule this operationalises (R001..R008)
}
```

`changeByLayer` uses `reg.get(finding.rule).layer` to group findings:

| E-rule | layer | Governance rule |
|---|---|---|
| E001 | `rpc` | R001 |
| E002 | `migration` | R002 |
| E003 | `gateway` | — |
| E004 | `docs` | R005 |
| E005 | `test` | R004 |
| E006 | `migration` | R006 |
| E007 | `docs` | R007 |
| E008 | `worker` | R003 |

---

## db-intel read

The service reads `db-intel` once per `analyzeChange` call:

```typescript
const db = this.core.store.tryRead<DbIntel>('db-intel') ?? {}
```

Fields used: `tables[].{name, money, tenant}` and `functions[].{name, money, securityDefiner}`.
When `db-intel` is absent (graph not yet built), these all default to `undefined` / falsy, so
E001/E002 fire conservatively only when flags are explicitly `true`.

---

## Worked example — "Build GST Filing"

```
affected.tables  = ["invoices", "gst_filings"]
affected.rpcs    = ["create_gst_invoice"]
affected.apis    = ["/v1/gst/file"]
affected.domains = ["gst"]
affected.workers = []
affected.queues  = []

db-intel: invoices.money=true, gst_filings.tenant=true,
          create_gst_invoice.money=true, create_gst_invoice.securityDefiner=true

Findings emitted:
  E001/gate   invoices   (money=true → canonical-ledger RPC required)
  E002/gate   gst_filings (tenant=true → RLS + site_id + verifySiteOwnership)
  E003/gate   /v1/gst/file (API must be a gateway proxy)
  E004/gap    gst  (domain must declare a CODEOWNERS owner)
  E005/gap    /v1/gst/file (route must have a test)
  E005/gap    create_gst_invoice (RPC must have a test)
  E006/gate   invoices,gst_filings (migration rollback path required)
  E007/gap    gst (domain docs required)

NOTE: E001 gap for create_gst_invoice NOT fired because securityDefiner=true

changeByLayer produces:
  { rpc: [E001], migration: [E002, E006], gateway: [E003], docs: [E004, E007], test: [E005×2] }
```

---

## Honest empty return

When `analysis.unresolved` is true, `analyzeChange` returns `[]` immediately. No gates are fired
against empty sets. `changeByLayer` returns an empty object.
