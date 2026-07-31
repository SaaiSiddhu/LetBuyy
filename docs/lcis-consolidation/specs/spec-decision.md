# DecisionService Consolidation Spec

**Package:** `packages/lcis-core/src/decision`  
**Phase:** LCIS Consolidation Program — Mission Phase 7 (Explainable)  
**Scope:** Consolidates `decision-engine-v5.mjs`, `decision-engine-v2.mjs`, `fix-engine.mjs`, `production-readiness-intel.mjs`, `production-readiness-v2.mjs` into a single typed ESM service.

---

## 1. Source Resolution: v2 vs v5

### Finding

`decision-engine-v5.mjs` is the **origin engine** — it owns all ranking logic, reads `execution-intel`, `production-readiness-intel`, and optional intelligence artifacts (`revenue-intelligence.json`, `security-intelligence-v5.json`, `merchant-intelligence.json`), and is the source of `fixNext` + `highestRisk` + `blocksLaunch` + `blocksScale`.

`decision-engine-v2.mjs` is an **additive wrapper**: it calls `buildDecisionEngine()` (v5) and `buildProductionReadinessV2()`, then appends two extra scale tiers (`blocks1000Merchants`, `blocks10000Merchants`). It owns no ranking logic of its own.

### Resolution

**Keep `decision-engine-v5.mjs` as the canonical ranking engine.** Absorb the extra scale tiers from `decision-engine-v2.mjs` as additional fields in the same `ScaleTiers` output type. `decision-engine-v2.mjs` is dropped as a wrapper.

`production-readiness-intel.mjs` (per-system scoring, 18 systems) is the **source-of-truth readiness engine**. `production-readiness-v2.mjs` is a **projection layer** that rolls it into 10 program dimensions and checks for the presence of supplemental JSON artifacts. Both are absorbed — the service exposes both granularities (systems + dimensions).

`fix-engine.mjs` is a **structural finding + plan generator**, not a ranker — it wraps discovery + execution intel into fix/verify/test/rollback quadruples. It is absorbed as `rankFixes()`.

### Dropped as Duplicate

- `decision-engine-v2.mjs` (wrapper around v5 + readiness-v2; no new logic)
- The `buildDecisionEngineV2` export (replaced by `DecisionService.rankRisks()` + `scaleTiers()`)
- `buildProductionReadiness` re-export from v2 (v2 just re-exposes v1's system scores)

---

## 2. Canonical API: `DecisionService`

```typescript
// packages/lcis-core/src/decision/index.ts
import type {
  RankedRisk, RankedFix, SystemReadiness, DimensionReadiness,
  ScaleTiers, Evidence, Decision, LaunchVerdict,
} from './types.js';

export interface DecisionService {
  /** Ranked open blockers + structural risks, deterministic, highest severity first. */
  rankRisks(): RankedRisk[];

  /** Ranked fix/verify/test/rollback plans, ₹-impact-ordered where money systems rank first. */
  rankFixes(): RankedFix[];

  /** Prioritize an arbitrary list of items by the same scoring formula as rankRisks(). */
  prioritize(items: Array<{ id: string; severity: string; domain?: string }>): Array<{ rank: number; id: string; score: number; factors: ScoringFactors }>;

  /** Order fix plans by commercial impact: money domains > launch-blocking > structural. */
  order(fixes: RankedFix[]): RankedFix[];

  /** Rank all systems/dimensions by impact score (structural readiness × blast-radius weight). */
  impactRank(): SystemReadiness[];

  /** Return all evidence entries for a given decision or system key. */
  evidence(decisionId: string): Evidence[];

  /** Full explainable trace: inputs → factor breakdown → weighted score → rank for one decision. */
  trace(decisionId: string): Decision;

  /** Per-system structural readiness (18 systems, v5 scores). */
  systemReadiness(): SystemReadiness[];

  /** 10-dimension readiness (architecture/infra/security/merchant/customer/revenue/telemetry/ops/deploy/cost). */
  dimensionReadiness(): DimensionReadiness[];

  /** Scale tier levers: 100 merchants / 10k users / 1k merchants / 10k merchants / 100k concurrent users. */
  scaleTiers(): ScaleTiers;

  /** Launch verdict derived from open blocker count + certification docs. */
  launchVerdict(): LaunchVerdict;
}
```

---

## 3. TS Types

```typescript
// packages/lcis-core/src/decision/types.ts

/** The six severity levels, mapped to numeric weight for deterministic ranking. */
export type Severity = '🔴' | '🟠' | '🟡' | '🟢' | 'critical' | 'unknown';

export interface ScoringFactors {
  /** Weight 3 = critical/🔴, 2 = 🟠, 1 = 🟡, 0 = 🟢/unknown */
  severityWeight: 0 | 1 | 2 | 3;
  /** 1 if a money/payment domain (payments/refunds/payouts/gift-cards/orders), else 0 */
  moneyDomain: 0 | 1;
  /** System structural readiness score for the domain (0–100; 0 = unknown) */
  systemReadiness: number;
  /** 1 if the item is referenced by an open blocker doc, else 0 */
  openBlockerRef: 0 | 1;
}

export interface RankedRisk {
  rank: number;
  id: string;
  type: 'blocker' | 'money' | 'tenant' | 'spof' | 'structural';
  severity: Severity;
  title: string;
  status: string;
  score: number;
  factors: ScoringFactors;
  /** Human-readable breakdown: "severityWeight(3) × 40 + moneyDomain(1) × 30 + ..." */
  formula: string;
  evidence: Evidence[];
}

export interface RankedFix {
  rank: number;
  id: string;
  finding: string;
  severity: Severity;
  domain: string;
  /** ₹ impact tier: 'critical' (payment-path) | 'high' (launch-blocking) | 'medium' | 'low' */
  inrImpactTier: 'critical' | 'high' | 'medium' | 'low';
  fixPlan: string;
  verificationPlan: string;
  testPlan: string;
  rollbackPlan: string;
  score: number;
  factors: ScoringFactors;
  formula: string;
  evidence: Evidence[];
}

export interface Evidence {
  source: 'blocker-report' | 'domain-intel' | 'db-intel' | 'infra-intel' | 'discovery' | 'execution-intel' | 'revenue-intel' | 'security-intel' | 'merchant-intel' | 'cert-doc';
  ref: string;         // e.g. "LB-8", "payments domain", "651 policies"
  value: string;       // human-readable fact
  timestamp?: string;  // from artifact generatedAt if available
}

export interface Decision {
  id: string;
  inputs: {
    blockers: string[];       // blocker IDs that fed this decision
    artifacts: string[];      // artifact JSON filenames consulted
    systemReadinessScore: number | null;
  };
  factors: ScoringFactors;
  formula: string;
  score: number;
  rank: number;
  evidence: Evidence[];
}

export interface SystemReadiness {
  system: string;
  key: string;
  score: number;
  evidence: string[];
  blockers: string[];
}

export interface DimensionReadiness {
  dimension: string;
  score: number;
  evidence: string;
  note?: string;
}

export interface ScaleTiers {
  blocks100Merchants: string[];
  blocks10kUsers: string[];
  blocks100kConcurrentUsers: string[];
  blocks1000Merchants: string[];
  blocks10000Merchants: string[];
}

export interface LaunchVerdict {
  verdict: string;
  openBlockers: number;
  overallReadiness: number;
  certificationDocs: Array<{ doc: string; verdict: string }>;
}
```

---

## 4. Explainable Scoring Formula

### 4.1 Risk Score (used by `rankRisks()` and `prioritize()`)

Every `RankedRisk` score is computed by this deterministic formula — no hidden weights, no ML.

```
score = (severityWeight × 40) + (moneyDomain × 30) + ((100 - systemReadiness) × 0.2) + (openBlockerRef × 10)
```

**Factor breakdown:**

| Factor | Input source | Values | Max contribution |
|--------|-------------|--------|-----------------|
| `severityWeight` | `SEV(severity)`: `🔴`/`critical` → 3, `🟠` → 2, `🟡` → 1, `🟢` → 0 | 0–3 | 120 |
| `moneyDomain` | domain key in `{'payments','refunds','payouts','gift-cards','orders'}` | 0 or 1 | 30 |
| `100 - systemReadiness` | `production-readiness-intel` per-system score for the item's domain | 0–100 | 20 |
| `openBlockerRef` | blockers list contains the item's id | 0 or 1 | 10 |

**Maximum possible score:** 180 (critical + money domain + 0% readiness + open blocker ref).  
**Tie-break:** alphabetical by `id` (deterministic across runs).

The `formula` field on every `RankedRisk` is a filled-in string, e.g.:
```
"severityWeight(3)×40 + moneyDomain(1)×30 + readinessPenalty((100-88)×0.2=2.4) + openBlockerRef(1)×10 = 122.4"
```

### 4.2 Fix Score (used by `rankFixes()` and `order()`)

```
score = (severityWeight × 40) + (inrImpactTierWeight × 35) + (openBlockerRef × 15) + (moneyDomain × 10)
```

**`inrImpactTierWeight`** maps tier → weight:
- `critical` (payment path, refund path): 3
- `high` (launch-blocking, shopper registration): 2
- `medium` (partial/operational): 1
- `low` (structural/dead-code cleanup): 0

**INR impact tier assignment rules** (deterministic, applied during fix ingestion):
1. Finding references a payment/refund/payout/gift-card domain → `critical`
2. Finding is an open `🔴` blocker → `high`
3. Finding is an open `🟠` blocker or `partial` status → `medium`
4. Structural finding (dead RPCs, tables, orphan domains) → `low`

The `formula` field mirrors the risk formula pattern — always human-readable and filled in per item.

### 4.3 Readiness Score (used by `impactRank()` and `systemReadiness()`)

Directly from `production-readiness-intel.mjs` — each system's score starts at 100 and subtracts:

```
score = 100
  − (noRoutes ? 10 : 0)
  − (moneyDomainNoRpc ? 10 : 0)
  − (noOwner ? 10 : 0)
  − min(15, tenantTablesWithoutRls × 3)
  − sum(blockerPenalties: 🔴→30, 🟠→15, 🟡→8)
```

Clamped to `[0, 100]`. Evidence strings are attached verbatim. This is the `systemReadiness` value fed into the risk/fix scoring.

---

## 5. Inputs (Artifacts)

The service reads (read-only, never mutates):

| Artifact | Used for | Fallback |
|----------|---------|---------|
| `graphify-out/domain-intel.json` | domain counts, tables, owners, money flag | score domain as 50 (partial) |
| `graphify-out/db-intel.json` | table RLS status, tenant flag, policy counts | error if absent |
| `graphify-out/infra-intel.json` | worker/queue/hyperdrive/migrate-gate presence | infra score degraded |
| `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md` | open blockers (parsed via regex) | empty blocker list |
| `graphify-out/revenue-intelligence.json` | `highRiskPaths` count for money-risk entry | omit money risk |
| `graphify-out/security-intelligence-v5.json` | `crossTenantCandidates` count for tenant risk | omit tenant risk |
| `graphify-out/merchant-intelligence.json` | SPOF presence signal | omit SPOF risk |
| Cert docs (5 paths) | `launchVerdict()` scan | fallback to BLOCKER_REPORT |
| `graphify-out/telemetry-intelligence.json` / `cost-intelligence.json` / etc. | dimension readiness presence check | dimension score 20–60 |

---

## 6. Test Cases

These are real, reproducible given the current artifacts.

### TC-1: Risk ranking is deterministic
Run `DecisionService.rankRisks()` twice on the same artifacts — the rank order must be identical. Verify: `rank 1` = LB-8 (severity `🔴`, money domain 0, system readiness ~88 for merchant, openBlockerRef 1 → score = 120 + 0 + 2.4 + 10 = 132.4). The formula string must equal the filled formula.

### TC-2: Money domain forces ₹-critical tier
Any fix where the finding domain is `payments` must have `inrImpactTier = 'critical'` regardless of blocker severity. LB-7 (shipping/GST — `🟡`) — domain is `shipping`, not payments → tier `medium`. Verify tier assignment is rule-based, not severity-based alone.

### TC-3: Fix ranking puts open critical blockers above structural dead-code
Dead-RPC cleanup (structural, `low` tier, severity from discovery) must rank lower than LB-8 (launch-blocking, `high` tier, `🔴`). Confirmed: score for LB-8 fix = (3×40) + (2×35) + (1×15) + (0×10) = 205; dead-RPC fix = (0×40) + (0×35) + (0×15) + (0×10) = 0.

### TC-4: `evidence()` returns all source facts for a decision
`service.evidence('LB-12')` must include: source = `blocker-report`, ref = `LB-12`, value = "Missing + a broken button"; and the domain system score evidence string for the shopper/identity domain. Minimum 2 evidence entries.

### TC-5: `trace()` returns a full factor-filled Decision object
`service.trace('LB-9')` must include `inputs.blockers = ['LB-9']`, `factors.severityWeight = 3`, `factors.openBlockerRef = 1`, a non-empty `formula` string, and `score ≥ 120`. The `rank` must match its position in `rankRisks()`.

### TC-6: `launchVerdict()` is NO-GO while any 🔴 blocker is open
With 3 open `🔴` blockers (LB-8, LB-9, LB-12), `verdict` must be `NO-GO`. After all blockers are filtered to `done`, verdict must become `GO` (or the cert doc scan must supply it).

### TC-7: Scale tier levers present (structural, no load-test fabrication)
`scaleTiers().blocks10000Merchants` must include at least one entry containing the string `"load test"` — confirming the spec's honesty contract: capacity numbers are labelled as requiring a load test, never fabricated.

### TC-8: System readiness score formula is reproducible
For the `Payments` system: expected starting score 100, subtract 15 (tenantTablesWithoutRls=5 → min(15, 5×3)=15), subtract 15 (one 🟠 blocker), arriving at 88 (per the artifact). `service.systemReadiness()` must return `{ system: 'Payments', score: 88 }` with evidence strings matching the deduction chain.

---

## 7. What Is Dropped

| Source | Disposition |
|--------|-------------|
| `decision-engine-v2.mjs` | Dropped — pure wrapper, scale tiers absorbed into `ScaleTiers` type |
| `buildDecisionEngineV2` export | Dropped — replaced by `DecisionService` public API |
| `buildDecisionEngine` (v5 raw export) | Replaced by `DecisionService.rankRisks()` + `rankFixes()` |
| `buildProductionReadiness` (v5 raw export) | Replaced by `DecisionService.systemReadiness()` |
| `buildProductionReadinessV2` (omega raw export) | Replaced by `DecisionService.dimensionReadiness()` |
| `buildFixEngine` (omega raw export) | Replaced by `DecisionService.rankFixes()` |
| `SEV()` inline severity mapper | Absorbed into `severityWeight()` in `types.ts` as an exported pure function |
| Inline `g()` / `writeOut()` / `nowStamp()` helpers | Use canonical `lcis-core` IO utilities |
| `omega-lib.mjs` `loadIntel` | Use `lcis-core` artifact loader (typed, cached) |

---

## 8. Non-Goals

- This service does **not** apply fixes. `applied: false` / `policy: 'INTELLIGENCE ONLY'` is enforced in the summary.
- This service does **not** fabricate scale thresholds. Levers are structural observations; capacity numbers carry the explicit note `"requires a load test"`.
- This service does **not** expose an opaque total score without the factor breakdown. Every rank output carries `factors` + `formula`.

---

## 9. Output Path

```
packages/lcis-core/src/decision/
  index.ts        ← DecisionService class (implements interface above)
  types.ts        ← RankedRisk, RankedFix, Evidence, Decision, ScaleTiers, LaunchVerdict
  scoring.ts      ← severityWeight(), riskScore(), fixScore(), readinessScore() — pure functions, tested in isolation
  artifacts.ts    ← typed artifact loader (reads graphify-out/*.json, returns typed or null)
```

Artifact write path (the service never writes — callers that persist output use the existing `writeOut` from `omega-lib.mjs` or the consolidated graph-server entry point).
