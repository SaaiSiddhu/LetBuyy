# Migration Intelligence Guide — MigrationIntelligenceService

**File:** `packages/lcis-engineering/src/migration/MigrationIntelligenceService.ts`

Answers: *"what are the schema changes, what are the risks, and can this migration run safely?"*

---

## What it does

Two public methods:

- `planMigration(req: FeatureRequest): MigrationPlan`
  — delegates verbatim to `eis.migration.analyzeMigration(req)`. No re-implementation.
- `migrationGates(req: FeatureRequest): EngineeringFinding[]`
  — applies three engineering gates over that plan and returns findings.

---

## The delegation chain

```
planMigration(req)
  └─ eis.migration.analyzeMigration(req)   [lcis-execution — MigrationIntelligenceService]
       returns MigrationPlan {
         steps[]:           { description, reversible, estimatedDuration }
         dataLossRisks[]:   { table, risk, evidence[] }
         irreversibleSteps[]: { description }
         dependencyOrder[]: string[]
         readiness: { ready, blockers[], evidence[] }
         rollbackPath: string
         evidence: Evidence[]
         confidence: number
         timestamp: string
       }
```

EINS is the **named engineering composition point** — callers (EngineeringEngine.generateBlueprint)
call EINS; lcis-execution does the actual migration reasoning. Nothing in EINS reads migration SQL
or inspects DDL directly.

---

## Migration gates applied by migrationGates()

### E002 — Data-loss gate

Fires when `plan.dataLossRisks.length > 0`.

Evidence cites:
- `ev.reuse('lcis-execution', 'eis.migration.analyzeMigration', 'dataLossRisks: N ...')`
- `ev.reuse('lcis-execution', 'eis.migration.detectDataLossRisk', 'N data-loss risk(s) ...')`
- First high-risk table's own `plan evidence` forwarded verbatim

Category:
- `'gate'` when any risk is `high` or `critical`
- `'risk'` otherwise (medium/low risks are flagged but not hard-blocked)

Severity: `critical` (high/critical count > 0) or `high` (medium only).

### Blocker gate — readiness.ready === false

Fires when `plan.readiness.ready === false`.

Category: `'blocker'`. Severity: `critical`.

Evidence cites:
- `ev.reuse('lcis-execution', 'eis.migration.verifyMigrationReadiness', 'readiness.ready=false ...')`
- `ev.reuse('lcis-execution', 'eis.migration.analyzeMigration', 'MigrationPlan.readiness.ready=false ...')`
- `plan.readiness.evidence` forwarded verbatim

The detail message explicitly states: *"LCIS cannot inspect migration DDL — blockers are derived from
table properties (money/tenant/FK topology) in graphify-out/db-intel.json. A human must verify no
destructive operations are present before executing."*

### E006 — Reversibility gate

Fires when `plan.irreversibleSteps.length > 0`.

Category: `'gate'`. Severity: `high`. Rule: `'E006'`.

Evidence cites:
- `ev.reuse('lcis-execution', 'eis.migration.analyzeMigration', 'MigrationPlan.irreversibleSteps: N ...')`
- `ev.reuse('lcis-execution', 'eis.migration.buildMigrationPlan', 'N irreversible step(s) ...')`

---

## The honest DDL boundary

EINS and lcis-execution analyse migration **structure** (what tables/FK topology/money/tenant flags
exist in `graphify-out/db-intel.json`). They do NOT read migration SQL files, parse DDL, or inspect
the Supabase migration directory. The `detail` field on every blocker/data-loss finding states this
boundary explicitly.

Consequences:
- `dataLossRisks` are structural (derived from `money`/`tenant`/high FK fan-in flags), not literal
  `DROP COLUMN` detection.
- `irreversibleSteps` come from the lcis-execution planner's reversibility model, not SQL parsing.
- A human must verify the actual migration file before execution.

---

## How migration tasks map to MigrationPlan

`TaskIntelligenceService` calls `eis.migration.detectDependencyOrder(analysis)` to get the
table-creation order, then emits one `TASK-MIGRATION-<table>` task per table. The `MigrationPlan`
is embedded verbatim in `EngineeringBlueprint.migration`.

---

## Worked example — "Build GST Filing"

```
affected.tables = ["invoices", "gst_filings"]
db-intel: invoices.money=true (high FK fan-in), gst_filings.tenant=true

eis.migration.analyzeMigration returns:
  steps = [
    { description: "create table gst_filings", reversible: true },
    { description: "add gst_filing_id FK to invoices", reversible: false }
  ]
  dataLossRisks = [
    { table: "invoices", risk: "high", evidence: [...] }
  ]
  irreversibleSteps = [
    { description: "add gst_filing_id FK to invoices" }
  ]
  readiness = { ready: false, blockers: ["money table invoices requires backup verification"] }

migrationGates returns:
  [
    EngineeringFinding {
      category: 'gate', rule: 'E002', severity: 'critical',
      title: 'Data-loss risk: 1 table(s) flagged (1 high/critical)',
      subject: 'invoices'
    },
    EngineeringFinding {
      category: 'blocker', severity: 'critical',
      title: 'Migration blocked: 1 structural blocker(s)',
      detail: '...LCIS cannot inspect migration DDL...'
    },
    EngineeringFinding {
      category: 'gate', rule: 'E006', severity: 'high',
      title: 'Reversibility gate: 1 irreversible migration step(s)'
    }
  ]
```

These three findings are included in `EngineeringBlueprint.gates` by `generateBlueprint`.
