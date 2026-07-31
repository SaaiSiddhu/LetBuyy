# LCIS Migration Intelligence

`MigrationIntelligenceService` — Deliverable 3 of the EIS.

**File:** `packages/lcis-execution/src/migration/MigrationIntelligenceService.ts`

---

## 1. Responsibilities

The migration service plans, detects risk, identifies dependency order, and simulates impact for migration work. It reads three `graphify-out` artifacts:

- `db-intel.json` — table properties (`money`, `tenant` flags; table list)
- `relationship-intel.json` — FK fan-in/fan-out per table
- `memory-intel.json` — historical migration entries (best-effort; optional)

It produces a `MigrationPlan` — a self-describing artifact with full provenance.

---

## 2. The DDL-Honesty Boundary

Every finding in the migration service carries this notice (the constant `DDL_HONESTY` in the source):

> LCIS cannot inspect the actual migration SQL — this risk is derived structurally from table properties (money/tenant/FK topology) in `graphify-out/db-intel.json` and `graphify-out/relationship-intel.json`, not from DDL analysis.

This is the fundamental honesty constraint of the service: LCIS knows which tables are affected and their structural properties, but it cannot read migration SQL. Risk classification is property-based, not DDL-based. A human must verify the actual SQL.

---

## 3. Primary Method

```typescript
analyzeMigration(input: ChangeRequest | ChangeAnalysis): MigrationPlan
```

Composed from six sub-methods, all invoked in sequence:

| Sub-method | Produces |
|------------|---------|
| `deriveTargets(analysis)` | `MigrationTarget[]` |
| `buildMigrationPlan(analysis)` | `MigrationStep[]` (forward steps) |
| `buildRollbackPlan(analysis)` | `MigrationStep[]` (reverse/rollback steps) |
| `detectDataLossRisk(analysis)` | `DataLossRiskFinding[]` |
| `verifyMigrationReadiness(analysis)` | `MigrationReadiness` |
| `detectDependencyOrder(analysis)` | `string[]` (table topo order) |
| `detectMigrationRisk(analysis)` | `RiskAssessment` |
| `simulateMigrationImpact(analysis)` | `string` (plain-language simulation notice) |

`irreversibleSteps` in the returned plan is computed as the union of forward + rollback steps where `reversible === false`.

---

## 4. `MigrationTarget` Values

```typescript
type MigrationTarget =
  | 'supabase'       // new tables (CREATE TABLE)
  | 'sql'            // column adds, constraints, drops
  | 'worker'         // Cloudflare Worker redeployment
  | 'kv'             // Cloudflare KV (when text contains 'kv' or 'cache')
  | 'r2'             // Cloudflare R2 (when text contains 'r2', 'storage', or 'media')
  | 'queue'          // Cloudflare Queue drain
  | 'internal-api'   // when any APIs are affected
  | 'domain-model'   // when any domains are affected
```

`deriveTargets()` determines targets from the `ChangeAnalysis` affected sets and a simple substring check on `analysis.request.text` for `kv`/`r2`. It never fabricates targets.

---

## 5. Data-Loss Risk Classification

`detectDataLossRisk()` classifies each affected table into one of four buckets. The fan-in threshold is `HIGH_FAN_IN_THRESHOLD = 3`.

| Condition | Risk | Reason |
|-----------|------|--------|
| `dbRow.money === true` | `high` | Canonical money-ledger table; destructive ops forbidden by `canonical-ledger-only-validator` |
| `dbRow.tenant === true` | `high` | Tenant table; schema change affects ALL merchants on shared schema |
| `relRow.fanIn >= 3` | `high` | High FK fan-in — structural changes risk cascade failures across dependent tables |
| None of the above | `low` | Standard migration caution applies |

Each finding carries the DDL-honesty notice and an `Evidence` entry citing the relevant artifact.

---

## 6. Forward Migration Steps

`buildMigrationPlan()` produces 6 fixed steps plus per-worker and per-queue steps. The fixed step sequence is:

| Order | Target | `reversible` | Description summary |
|-------|--------|--------------|---------------------|
| 1 | `supabase` | true | Create new tables in dependency order (REVERSIBLE: DROP TABLE) |
| 2 | `sql` | true | Add new columns as NULLABLE (REVERSIBLE: DROP COLUMN) |
| 3 | `supabase` | true | Backfill — LCIS does NOT execute this; money tables use SECURITY DEFINER RPCs only |
| 4 | `sql` | true | Add constraints/indexes AFTER backfill (CONCURRENTLY; REVERSIBLE: DROP) |
| 5 | `internal-api` | true | Swap reads to new schema (rolling deploy + canary; REVERSIBLE: redeploy prior) |
| 6 | `sql` | **false** | Drop deprecated columns/tables — **IRREVERSIBLE**; only after observation window |

For money tables, step 3 mentions `SECURITY DEFINER RPCs` and `idempotency_key`. For tenant tables, step 4 specifies `CREATE INDEX CONCURRENTLY`.

Worker steps (one per `affected.workers`) and queue steps (one per `affected.queues`) are appended in order.

---

## 7. Rollback Steps

`buildRollbackPlan()` reverses the forward steps and re-evaluates reversibility:

- Steps that contain "drop deprecated" or "irreversible" in their description → `reversible: false` + "CANNOT ROLL BACK: … — data already dropped. Restore from backup only."
- All other reversed steps → `reversible: true` with a "Rollback: reverse …" description

---

## 8. Dependency Order

`detectDependencyOrder()` produces a topologically safe table creation order:

1. Reads `relationship-intel.json` to find which tables reference which others
2. A referenced table must be created before the table that references it
3. Uses Kahn's algorithm with stable alphabetical tie-break within each layer
4. Tables with cycles or no detected relationship are appended alphabetically at the end

This is the order `dependencyOrder` in `MigrationPlan`. It governs the table creation sequence in step 1.

---

## 9. Migration Readiness

`verifyMigrationReadiness()` returns a `MigrationReadiness` artifact:

```typescript
interface MigrationReadiness extends PlanArtifact {
  ready: boolean;
  blockers: string[];
  warnings: string[];
}
```

**Blockers** (hard stops; `ready = false`):
- Any money table in the blast radius with a high/critical data-loss finding → blocked with the canonical-ledger enforcement statement

**Warnings** (proceed with caution; `ready = true`):
- Tenant tables in blast radius (not already a blocker)
- High FK fan-in tables flagged as high risk
- Unresolved request (no seeds matched)

`ready === false` means at least one blocker exists. The service does not gate the deployment; it reports the finding and the human operator decides.

---

## 10. Simulated Impact

`simulateMigrationImpact()` returns a plain-language string prefixed with:

> [SIMULATION — LCIS does NOT execute migrations]

It lists:
- Number and names of affected tables
- Money-table notice (canonical RPC requirement)
- Tenant-table notice (all-merchant impact)
- Number of workers to redeploy
- Number of queues to drain

The function returns an "unresolved" notice when no seeds matched.

---

## 11. Risk Assessment

`detectMigrationRisk()` calls `assessRisk()` from `shared/scoring.ts` and adds a `data-loss-candidate` driver when any high/critical data-loss finding exists:

```
driver: 'data-loss-candidate'
severity: 'high'
note: "N table(s) flagged as high data-loss risk (money/FK cascade/tenant); structural analysis only — DDL not inspected"
```

The base risk already includes `money-ledger`, `multi-tenant`, and `async-workers` drivers from `assessRisk()`.

---

## 12. Additional Public Methods

Beyond `analyzeMigration()`, the service exposes these public methods for targeted use:

| Method | Purpose |
|--------|---------|
| `detectMigrationRisk(input)` | Standalone risk assessment with data-loss driver |
| `detectDataLossRisk(input)` | Per-table data-loss findings |
| `buildMigrationPlan(input)` | Forward steps only |
| `buildRollbackPlan(input)` | Rollback steps only |
| `verifyMigrationReadiness(input)` | Readiness with blockers/warnings |
| `detectDependencyOrder(input)` | FK-safe table order |
| `simulateMigrationImpact(input)` | Plain-language impact summary |
| `targets(input)` | Derives `MigrationTarget[]` |
