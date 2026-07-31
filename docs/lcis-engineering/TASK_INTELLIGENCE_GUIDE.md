# Task Intelligence Guide — EINS Phase 7

`packages/lcis-engineering/src/task/TaskIntelligenceService.ts`

`generateTasks` is EINS's ordered task synthesiser. It composes `eis.analyze`
and `eis.migration` from lcis-execution to discover the affected structural
surface, then emits a deterministic ordered list of `EngineeringTask` records
along the canonical LetBuyy build order.

---

## How it works

```
TaskIntelligenceService
  └── eis = createEisEngine({ core, now })  ← lcis-execution

generateTasks(req)
  1.  eis.analyze(req)                      → analysis (ChangeAnalysis)
  2.  analysis.unresolved? → return []      ← honest empty; no fabrication
  3.  eis.migration.analyzeMigration(analysis) → migration (MigrationPlan)
  4.  Emit tasks layer by layer (see below)
  5.  Stable sort: primary=priority, secondary=id (alpha)
```

---

## The canonical build order

Each layer has a fixed priority number. A lower number means "build first."

| Layer | Priority | Agent type | Gate |
|---|---|---|---|
| `migration` | 10 | `database` | `rollback-integrity-validator` |
| `rpc` | 20 | `database` | `canonical-ledger-only-validator` |
| `gateway` | 30 | `backend` | `route-ownership lockstep` |
| `proxy` | 40 | `backend` | `route-ownership lockstep` |
| `ui` | 50 | `frontend` | `design-system ratchet` |
| `worker` | 60 | `backend` | `worker-runbook-gate` |
| `queue` | 65 | `backend` | `worker-runbook-gate` |
| `event` | 70 | `backend` | `worker-runbook-gate` |
| `test` | 80 | `testing` | `107+ validator gate` |
| `docs` | 90 | `documentation` | `governance-memory-validator` |
| `verification` | 100 | `verification` | `107+ validator gate` |
| `launch` | 110 | `devops` | `production-readiness-v2` |

The `generateTasks` method emits tasks for layers 1–9 (launch tasks come
from `LaunchIntelligenceService`). The `launch` layer exists in the type
system but is not emitted here.

---

## Task generation rules — layer by layer

### migration (priority 10)

- One task per affected table in `analysis.affected.tables`.
- Order is taken from `eis.migration.detectDependencyOrder(analysis)` when
  `migration.steps.length > 0`; otherwise falls back to `affected.tables`.
- Remaining tables (not yet in the ordered list) are appended.
- `dependsOn: []` — migrations have no prior layer.
- **Id**: `TASK-MIGRATION-<table-slug>`

### rpc (priority 20)

- One task per `analysis.affected.rpcs`.
- `dependsOn: [all migration task ids]`
- When `analysis.risk.money === true`, the gate is forced to
  `'canonical-ledger-only-validator'` and the title includes
  `"(SECURITY DEFINER — canonical ledger)"`.
- **Id**: `TASK-RPC-<rpc-slug>`

### gateway (priority 30)

- One task per `analysis.affected.apis`.
- Title: `"Gateway route: <api> (Hono /v1 proxy → db.rpc behind verifySiteOwnership)"`
- `dependsOn: [rpc task ids if any, else migration task ids]`
- **Id**: `TASK-GATEWAY-<api-slug>`

### proxy (priority 40)

- One task per **domain** in `analysis.affected.domains`.
- Title: `"App proxy: /api/* → gateway /v1 for domain '<domain>'"`
- `dependsOn: [gateway ids → rpc ids → migration ids]` (first non-empty wins)
- **Id**: `TASK-PROXY-<domain-slug>`

### ui (priority 50)

- One task per **domain**.
- Title: `"UI: merchant-control-plane screen for domain '<domain>' (@letbuyy/ui + --lb-* tokens)"`
- `dependsOn: [TASK-PROXY-<domain-slug>]`
- **Id**: `TASK-UI-<domain-slug>`

### worker (priority 60)

- One task per `analysis.affected.workers`.
- `dependsOn: [migration task ids]`
- **Id**: `TASK-WORKER-<worker-slug>`

### queue (priority 65)

- One task per `analysis.affected.queues`.
- Title: `"Queue: drain and verify '<queue>' during schema cutover"`
- `dependsOn: [migration task ids]`
- **Id**: `TASK-QUEUE-<queue-slug>`

### test (priority 80)

- One task per **domain**. Always emitted (min 1 task per domain even if no
  gateway or ui tasks were produced).
- `dependsOn: [gateway ids + ui ids]`, falling back to `[migration ids]`
- **Id**: `TASK-TEST-<domain-slug>`

### docs (priority 90)

- One task per **domain**.
- `dependsOn: [all implementation task ids]`, falling back to `[migration ids]`
- **Id**: `TASK-DOCS-<domain-slug>`

### verification (priority 100)

- One task per **domain**.
- Title: `"Verification: typecheck + 107-validator gate + production-readiness for domain '<domain>'"`
- `dependsOn: [all prior task ids]` (migration + rpc + gateway + proxy + ui + worker + queue + test + docs)
- Evidence cites both `eis.analyze` and `eis.migration.analyzeMigration`
- **Id**: `TASK-VERIFICATION-<domain-slug>`

---

## Stable id format

```
TASK-{LAYER}-{entity-slug}
```

`entity-slug` is `entity.replace(/[^a-z0-9]+/gi, '-').toLowerCase()`.

The same request always produces the same task ids — safe to reference from
`dependsOn` chains and external tooling.

---

## Honesty contract

- `analysis.unresolved === true` → `return []`. No tasks are fabricated.
- Workers with no workers in `affected.workers` → no worker tasks (layer skipped,
  not padded with a placeholder).
- Evidence on every task cites `ev.reuse('lcis-execution', 'eis.analyze', ...)` so
  the provenance chain is unbroken.

---

## Worked example — GST invoice feature

**Request**: `{ text: "add GST invoice generation to orders", domains: ["orders", "gst"], tables: ["orders", "gst_invoices"], rpcs: ["create_gst_invoice"] }`

Assuming `eis.analyze` resolves with:
- `affected.tables: ["orders", "gst_invoices"]`
- `affected.rpcs: ["create_gst_invoice"]`
- `affected.apis: ["POST /v1/stores/:storeId/orders/:orderId/gst-invoice"]`
- `affected.domains: ["orders", "gst"]`
- `affected.workers: []`, `affected.queues: []`
- `risk.money: false`

Tasks emitted (in priority order, then id alpha):

| # | Id | Layer | depends on |
|---|---|---|---|
| 1 | `TASK-MIGRATION-gst-invoices` | migration | — |
| 2 | `TASK-MIGRATION-orders` | migration | — |
| 3 | `TASK-RPC-create-gst-invoice` | rpc | TASK-MIGRATION-* |
| 4 | `TASK-GATEWAY-post-v1-stores-...` | gateway | TASK-RPC-* |
| 5 | `TASK-PROXY-gst` | proxy | TASK-GATEWAY-* |
| 6 | `TASK-PROXY-orders` | proxy | TASK-GATEWAY-* |
| 7 | `TASK-UI-gst` | ui | TASK-PROXY-gst |
| 8 | `TASK-UI-orders` | ui | TASK-PROXY-orders |
| 9 | `TASK-TEST-gst` | test | TASK-GATEWAY-* + TASK-UI-* |
| 10 | `TASK-TEST-orders` | test | TASK-GATEWAY-* + TASK-UI-* |
| 11 | `TASK-DOCS-gst` | docs | all impl tasks |
| 12 | `TASK-DOCS-orders` | docs | all impl tasks |
| 13 | `TASK-VERIFICATION-gst` | verification | all prior |
| 14 | `TASK-VERIFICATION-orders` | verification | all prior |

No worker or queue tasks are emitted because `affected.workers` and
`affected.queues` are empty.
