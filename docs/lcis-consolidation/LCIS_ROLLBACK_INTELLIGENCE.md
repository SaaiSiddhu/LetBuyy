# LCIS Rollback Intelligence

`RollbackIntelligenceService` — Deliverable 5 of the EIS.

**File:** `packages/lcis-execution/src/rollback/RollbackIntelligenceService.ts`

---

## 1. Responsibilities

The rollback service plans recovery from a change. It:

1. Detects structurally irreversible changes (`detectIrreversibleChanges`)
2. Derives rollback risk — elevated when irreversible changes are present (`detectRollbackRisk`)
3. Identifies dependency order for rollback (`identifyRollbackDependencies`)
4. Builds ordered recovery steps, citing runbooks when available (`identifyRecoverySteps`)
5. Estimates a recovery time band from structural complexity (`estimateRecoveryTime`)
6. Composes the full `RollbackPlan` artifact (`generateRollbackPlan`)

The service reads `db-intel.json`, `relationship-intel.json`, and `runbooks.json` (best-effort).

---

## 2. Primary Method Signature

`generateRollbackPlan` takes a `ChangeRequest` (not `ChangeAnalysis`). This is intentional: `detectIrreversibleChanges` uses `input.text` directly to pattern-match drop/delete verbs in the raw natural-language request.

```typescript
generateRollbackPlan(input: ChangeRequest): RollbackPlan
```

---

## 3. Irreversible Change Detection

`detectIrreversibleChanges(input: ChangeRequest): IrreversibleChange[]`

Checks three categories:

### Money-ledger tables (always flagged, regardless of request text)

The service carries a hardcoded list `MONEY_LEDGER_TABLE_PATTERNS` matching known canonical ledger table names:

```
ledger_entries, ledger_transactions, payment_transactions, refund_transactions,
refunds, orders, order_items, gift_card_ledger_entries, gift_card_redemptions,
payout_statements, partner_payout_ledger_entries, wallet_ledger_entries,
cod_reconciliation_entries, settlements, payouts, payments
```

Any affected table matching `db-intel.json` with `money: true` OR matching these patterns is flagged as irreversible. Severity: `critical`.

The reason states explicitly: compensating a bad write requires a canonical refund/restore RPC (`complete_order_refund` / `restore_gift_card_on_refund` / `issue_gift_card`), never a direct row deletion. Deleting ledger rows would corrupt financial history.

### High-FK-fan-in tables targeted by destructive requests

Threshold: `HIGH_FK_THRESHOLD = 10` (higher than the migration service threshold of 3).

Only triggered when both conditions hold:
1. The table's FK fan-in ≥ 10 (from `blast.relationships(tableName)`)
2. The request text contains `drop`, `delete`, `truncate`, or `remove` (checked by `looksLikeDropOrDelete`)

Severity: `critical`.

### Tenant tables with destructive requests

Only triggered when `looksLikeDropOrDelete(input.text)` is true for a tenant table that is not already flagged as a money table. Severity: `high`.

---

## 4. Ledger-Safe Compensation Principle

Money-ledger entries are append-only. The service enforces this structurally in two places:

**In `detectIrreversibleChanges`:** money tables are flagged as irreversible with the explanation that the ledger is append-only and compensation is via canonical RPCs only.

**In `identifyRecoverySteps`:** when `analysis.risk.money` is true, the money compensation step always reads:

> For any money-ledger writes already committed: compensate via the canonical refund/restore RPCs ONLY — `complete_order_refund`, `restore_gift_card_on_refund`, or `issue_gift_card`. NEVER delete ledger rows directly. Run `ledger_balance_breaks()` to confirm reconciliation.

This step carries `reversible: false` because compensation is itself a new append — the original write is permanent.

---

## 5. `RollbackPlan` Type

```typescript
interface RollbackPlan extends PlanArtifact {
  request: ChangeRequest;
  readiness: 'READY' | 'CONDITIONAL' | 'NOT_READY';
  complexity: RollbackComplexity;   // 'simple' | 'moderate' | 'complex' | 'irreversible'
  steps: RollbackStep[];
  irreversible: IrreversibleChange[];
  dependencies: string[];           // reverse of suggestedSequence
  estimatedRecovery: string;        // plain-language time band, not a number
  risk: RiskAssessment;
}
```

---

## 6. Readiness States

| State | Condition |
|-------|-----------|
| `NOT_READY` | Money risk AND at least one critical irreversible change |
| `CONDITIONAL` | At least one irreversible change (but not the NOT_READY condition) |
| `READY` | No irreversible changes detected |

`NOT_READY` means there is no safe automated rollback path for money-ledger writes already committed. Recovery requires canonical compensating RPCs and manual reconciliation.

---

## 7. Rollback Complexity

| Complexity | Condition |
|------------|-----------|
| `irreversible` | Critical irreversible change AND money risk |
| `complex` | At least one irreversible change (not the above) |
| `simple` | No irreversible changes AND complexity band `'trivial'` or `'low'` |
| `moderate` | No irreversible changes AND complexity band `'moderate'`, `'high'`, or `'severe'` |

---

## 8. Recovery Steps

`identifyRecoverySteps()` first looks for domain-matched entries in `runbooks.json`. When matched, it cites up to 3 domain runbooks, emitting:
- One step per `entry.recovery` item (prefixed `[Runbook:<domain>]`)
- One rollback step from `entry.rollback.command`
- Up to 2 verification steps from `entry.verification`

Recovery steps citing a runbook carry evidence citing `graphify-out/runbooks.json`.

When no runbook matches, the service generates generic structural steps:

| Order | Step | `reversible` |
|-------|------|--------------|
| 1 | Disable feature flags (`operational_feature_flags`) | true |
| 2 | Redeploy prior approved worker version via `infrastructure/scripts/deploy/production-rollback.mjs` | false |
| 3 | Apply migration-down (only when no irreversible changes detected) | true |
| 4 | Money compensation via canonical RPCs (only when `risk.money`) | false |
| 5 | Run `node scripts/validate-governance.mjs` — 107-validator gate | true |

Step 3 is omitted when `detectIrreversibleChanges()` returns any result. Steps 1 and 5 are always present.

---

## 9. Recovery Time Bands

`estimateRecoveryTime()` returns a plain-language string, not a numeric estimate. It is explicitly structural:

| Condition | Band |
|-----------|------|
| Any `critical` severity irreversible change | `"manual/unbounded — … canonical compensating RPCs … manual reconciliation … no structural time bound can be given"` |
| `trivial` or `low` complexity | `"minutes — … worker redeploy + feature-flag toggle … no migration-down expected"` |
| `moderate` complexity | `"tens of minutes — … worker redeploy + possible migration-down + verification gate"` |
| `high` complexity | `"hours — … multiple domains + async workers + verification gates + possible DLQ drain"` |
| `severe` complexity | `"hours to manual/unbounded — … broad blast radius across N domain(s)"` |

The function references the complexity `band` and `score` in the returned string, making the basis visible to the caller.

---

## 10. Rollback Risk Assessment

`detectRollbackRisk()` calls `assessRisk()` (shared scoring) and elevates the result when irreversible changes exist:

- If any irreversible change → adds driver `'irreversible-changes'` (severity `critical`)
- Elevates score to `max(base.score, 40)` (= critical threshold)
- Forces `level: 'critical'`

The risk artifact is used directly in `RollbackPlan.risk`.

---

## 11. Rollback Dependency Order

`identifyRollbackDependencies()` reverses `analysis.suggestedSequence`:

```typescript
return [...analysis.suggestedSequence].reverse();
```

`suggestedSequence` is in implementation order (producers first, consumers last). Rollback reverses this: consumers are rolled back first, then producers. This prevents consumers from running against a rolled-back producer.

---

## 12. Evidence Sources

`generateRollbackPlan()` declares explicit sources in the `plan()` call:

- `graphify-out/domain-intel.json` (always)
- `graphify-out/db-intel.json` (always)
- `graphify-out/runbooks.json` (only when `engine.store.tryRead('runbooks')` is non-null)
- `graphify-out/relationship-intel.json` (only when `engine.store.tryRead('relationship-intel')` is non-null)

This honest sourcing means the artifact's `sources` field lists only artifacts that were actually consulted.
