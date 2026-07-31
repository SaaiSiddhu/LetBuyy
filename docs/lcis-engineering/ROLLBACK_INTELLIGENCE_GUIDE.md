# Rollback Intelligence Guide — EINS Phase 7

`packages/lcis-engineering/src/rollback/RollbackIntelligenceService.ts`

EINS composes `lcis-execution`'s rollback engine. No rollback logic is
reimplemented here — 100% delegation to EIS, surfaced as `EngineeringFinding`
records with full reuse provenance.

---

## How it works

```
RollbackIntelligenceService
  └── eis = createEisEngine({ core, now })  ← lcis-execution
```

---

## planRollback

```ts
planRollback(req: FeatureRequest): RollbackPlan
```

Single delegation call — returns `eis.rollback.generateRollbackPlan(req)` verbatim.

`FeatureRequest` is structurally identical to `ChangeRequest` (same fields), so
no conversion is needed. The `RollbackPlan` carries:

| Field | Meaning |
|---|---|
| `readiness` | `'READY' \| 'NOT_READY'` |
| `complexity` | `ComplexityBand` |
| `irreversible[]` | Each change that cannot be automatically undone |
| `estimatedRecovery` | Human-readable time estimate |
| `steps[]` | Ordered rollback steps |

---

## rollbackBlockers

```ts
rollbackBlockers(req: FeatureRequest): EngineeringFinding[]
```

Calls `planRollback(req)` once, then emits findings in two passes.

### Pass 1 — NOT_READY top-level blocker

When `plan.readiness === 'NOT_READY'`, one finding is emitted:

```
category: 'blocker'
kind:      'rollback-not-ready'
severity:  'critical'
rule:      'E002'
```

The `detail` field spells out the ledger-safe compensation requirement:

> "The canonical ledger is append-only; compensating a bad write requires
> `complete_order_refund` / `restore_gift_card_on_refund` / `issue_gift_card`
> via db.rpc. NEVER delete ledger rows directly."

`subject` is built from the critical-severity `irreversible` entries (or
`"see plan.irreversible"` if none are critical). `estimatedRecovery` is
included verbatim from the plan.

### Pass 2 — per irreversible change risk findings

For each entry in `plan.irreversible[]`, one finding is emitted regardless of
whether Pass 1 fired:

| Condition | category | kind | severity |
|---|---|---|---|
| reason contains `'canonical'`, `'ledger'`, or `'rpc'` | `'risk'` | `'money-ledger-irreversible'` | `'critical'` |
| otherwise | `'risk'` | `'irreversible-change'` | `'high'` (unless ic.severity is 'critical') |

Money-ledger findings append the compensation reminder:

> "Compensation path: complete_order_refund / restore_gift_card_on_refund /
> issue_gift_card (db.rpc only — canonical-ledger-only-validator)."

---

## Ledger-safe compensation — the hard rule

LetBuyy's canonical ledger is **append-only** by design:

- `payment_transactions`, `refunds`, `gift_card_ledger_entries`, and related
  tables are written exclusively through `SECURITY DEFINER` Postgres RPCs.
- Rolling back a payment means calling `complete_order_refund` via `db.rpc` —
  never an `UPDATE` or `DELETE` on the money tables.
- Gift card balance is a ledger projection; compensation means calling
  `restore_gift_card_on_refund` or `issue_gift_card`, never a balance decrement.

When the rollback plan flags an irreversible change involving the canonical
ledger (`reason` contains `'canonical'`, `'ledger'`, or `'rpc'`), EINS
emits a `money-ledger-irreversible` risk finding with `rule: 'E002'` so the
canonical-ledger-only-validator gate is explicitly associated.

---

## Evidence pattern

All findings carry two evidence items:

1. A shared `reuseEv` built once:
   ```ts
   ev.reuse('lcis-execution', 'eis.rollback.generateRollbackPlan',
     `readiness=${plan.readiness}, complexity=${plan.complexity}, irreversible=${plan.irreversible.length}`)
   ```

2. Per-irreversible: a per-subject reuse item plus any evidence already on the
   `IrreversibleChange` object from EIS.

---

## Integration in EngineeringEngine

```ts
generateRollbackPlan(req)  →  rollback.planRollback(req)
generateBlueprint(req)     →  gates includes rollback.rollbackBlockers(req)
```

`blueprint.rollback` holds the verbatim `RollbackPlan` from EIS.
`blueprint.gates` includes the blocker/risk findings from `rollbackBlockers`.
