# LRAS Architecture — Root Cause Analysis System (Phase 12)

**Package:** `packages/lcis-rootcause` (`@letbuyy/lcis-rootcause`)
**Date:** 2026-07-04 · Verified against real source; every claim cites a file.

---

## 1. Purpose

LRAS answers one question: *"Given a symptom text, what are the ranked, evidence-backed root causes?"*
It is a pure composition facade — no intelligence is invented here. Every hypothesis carries at least one
evidence item sourced from the twin graph, the change-tracking timeline, or governance artifacts. When
signals are absent the system says so explicitly: verdict `UNKNOWN`, missing signals named.

---

## 2. The `diagnose()` Pipeline

`RootCauseEngine.diagnose(symptomText: string): Diagnosis` — `src/engine.ts : 105`

```
symptomText
    │
    ▼ SymptomService.classify()          [1] Deterministic taxonomy lookup
    │   → Symptom { kind, domains, anchors, matchedTerms }
    │
    ▼ AffectedService.affectedFrom()     [2] Twin impact radius (depth 3)
    │   → AffectedSummary { systems, byLayer, domains, deployments }
    │
    ▼ AffectedService.structuralSignals()[3] cycles / SPOFs / consumerless queues
    │   → HypothesisInput.structure
    │
    ▼ ChangeCorrelationService.correlate()[4] LCTS timeline ∩ affected
    │   → RecentChangeSummary { changes (≤20), migrations (≤10), connection }
    │
    ▼ notConnectedSignals assembled       [5] KIND_SIGNALS[kind] + LCTS gap
    │
    ▼ HypothesisService.evaluate()       [6] RC01..RC08 rule engine
    │   → CauseHypothesis[] ranked by confidence desc → rule asc → id asc
    │   (evidence-free hypotheses NEVER emitted)
    │
    ▼ verdict decision                   [7]
    │   kind=unknown OR hypotheses=[]        → UNKNOWN
    │   affected.systems=[] OR all NOT_CONNECTED → PARTIAL
    │   otherwise                           → DIAGNOSED
    │
    ▼ AttributionService.ownersFor()     [8] domain-intel + infra-intel owners
    │
    ▼ RemediationService.rollbackFor()   [9] EINS rollback plan (null on failure)
    ▼ RemediationService.verificationFor()[10] EINS verification plan ([] on failure)
    │
    ▼ rootcause() envelope               [11] stamps evidence, confidence, sources,
        → Diagnosis                           timestamp, liveConnected=false
```

The pipeline is strictly sequential and deterministic: the same `symptomText` with the same artifact
store produces a byte-identical `Diagnosis` (asserted in the determinism test suite).

---

## 3. Symptom Classification — the Fixed Taxonomy

**Source:** `src/shared/taxonomy.ts`, `src/symptom/SymptomService.ts`

`SYMPTOM_TAXONOMY` is a frozen, ordered table of `TaxonomyEntry` records. Classification algorithm
(`SymptomService.classify`, line 22):

1. Lowercase the input.
2. Scan `SYMPTOM_TAXONOMY` in declaration order.
3. For each entry, check whether ANY of its `terms` is a substring of the lowered text.
4. `kind` = the first matching entry's kind (declaration order wins on tie).
5. `domains` = insertion-order union across ALL matching entries.
6. `anchors` = insertion-order union across ALL matching entries.
7. `matchedTerms` = every matched term, in taxonomy order.
8. No match → `{ kind: 'unknown', domains: [], anchors: [], matchedTerms: [] }`.

The six mandated kinds with their keyword terms, domains, and twin anchors:

| kind | terms (sample) | domains | anchors |
|------|---------------|---------|---------|
| `orders-failing` | `"orders failing"`, `"order creation"`, `"cannot place order"` | orders, payments, inventory | `domain:orders`, `table:orders`, `rpc:create_checkout_order` |
| `checkout-broken` | `"checkout broken"`, `"payment failing"`, `"razorpay"` | payments, orders | `domain:payments`, `rpc:create_checkout_order`, `rpc:confirm_order_payment_with_ledger` |
| `queue-backlog` | `"queue backlog"`, `"jobs stuck"`, `"consumer lag"` | operations | `queue:order-events` |
| `high-latency` | `"high latency"`, `"timeout"`, `"p95"` | operations | _(none)_ |
| `deployment-failed` | `"deployment failed"`, `"build failed"`, `"rollout failed"` | operations | _(none)_ |
| `worker-crashed` | `"worker crashed"`, `"cron failed"` | operations | `worker:queue-worker` |

Unmatched text → `kind: 'unknown'`. This is the honest fallback; it drives verdict `UNKNOWN` and
populates `missingSignals` with `symptom-taxonomy-match` naming `SYMPTOM_TAXONOMY` as the exact source.
No fuzzy matching, no AI — pure substring scan.

---

## 4. Affected Systems — Twin Impact Radius

**Source:** `src/affected/AffectedService.ts`

`AffectedService` composes `@letbuyy/lcis-twin` (`createTwinEngine`). It does not re-implement
propagation logic.

- **`affectedFrom(symptom)`** (line 31): walks `twin.impactRadius(anchor, depth=3)` for each
  anchor in the symptom; unions all reached node ids (sorted for determinism); aggregates
  `byLayer` counts; derives `domains` (symptom domains + `domain:*` nodes in reach); derives
  `deployments` (reached nodes whose `layer` is `deployment` or `infrastructure`). Unknown anchors
  are skipped silently — honest, never throws.
- **`structuralSignals(affected)`** (line 87): from the same twin, extracts:
  - `cycles`: `twin.cycles()` filtered to those intersecting the affected set.
  - `spofs`: `twin.spof()` ids filtered to those in the affected set.
  - `consumerlessQueues`: queue-layer nodes in the affected set with no `consumes` edge in the
    twin graph (structural — not a live metric).

Empty anchors produce an honest empty summary; no exception is raised.

---

## 5. Change Correlation — LCTS Timeline

**Source:** `src/correlation/ChangeCorrelationService.ts`

Composes `@letbuyy/lcis-tracking` (`createTrackingEngine`). Algorithm:

1. Build search terms from `affected.systems` (name-parts after `:`) + `affected.domains`, deduped.
2. Walk `timeline.records` (newest-first by LCTS contract); for each record check case-insensitive
   substring match of `subject` or `detail` against any search term. Collect up to `MAX_CHANGES=20`.
3. Collect all `kind==='migration'` record subjects, newest-first, up to `MAX_MIGRATIONS=10`.
4. `connection`: `CONNECTED` when `timeline.records.length > 0`; `NOT_CONNECTED` otherwise.

If the timeline is empty, `connection` is `NOT_CONNECTED` and the facade adds a `change-timeline`
entry to `notConnectedSignals` naming `graphify-out/memory-intel.json` as the exact source.

---

## 6. RC01..RC08 Hypothesis Rules

**Source:** `src/shared/rules.ts`, `src/hypothesis/HypothesisService.ts`

### 6.1 Rule registry

| Rule | Title | Category | Base confidence |
|------|-------|----------|----------------|
| RC01 | Recent money-path migration | change | 0.60 |
| RC02 | Recent change to an affected system | change | 0.50 |
| RC03 | Dependency-path propagation | dependency | 0.40 |
| RC04 | Single point of failure implicated | infrastructure | 0.50 |
| RC05 | Queue consumer gap | infrastructure | 0.55 |
| RC06 | Missing operational credentials | configuration | 0.45 |
| RC07 | External provider dependency | external | 0.35 |
| RC08 | Cycle in the dependency topology | dependency | 0.30 |

### 6.2 Confidence formula (canonical, from `HypothesisService.ts : 30`)

```
confidence = min(0.85,  baseConfidence + 0.05 * min(3, extraEvidenceCount))
```

where `extraEvidenceCount = max(0, evidence.length - 1)`.

- Minimum: `baseConfidence` (one evidence item, zero extra).
- Each additional evidence item beyond the first adds `+0.05`, capped at three extras (`+0.15`).
- Hard ceiling: `0.85` — LRAS never claims certainty.

### 6.3 Rule firing conditions

| Rule | Fires when | Evidence kind |
|------|-----------|---------------|
| RC01 | `kind ∈ {orders-failing, checkout-broken}` AND `recentChanges.migrations` contains a term in `{payment,refund,payout,gift,ledger}` | `artifact-field` per qualifying migration |
| RC02 | Any `recentChanges.changes[*].subject` substring-matches any affected system name-part or domain | `artifact-field` per matching change |
| RC03 | `affected.systems.length > 1` AND `symptom.anchors.length > 0` (fires once, cites first 3 systems) | `graph-node` per cited system |
| RC04 | `structure.spofs` is non-empty (one hypothesis per SPOF in the affected set) | `graph-node` per SPOF |
| RC05 | `kind ∈ {queue-backlog, worker-crashed}` AND `structure.consumerlessQueues` non-empty | `graph-node` per queue |
| RC06 | `notConnectedSignals` non-empty (capped at 3 hypotheses) | `not-connected` per signal |
| RC07 | `kind ∈ {checkout-broken, orders-failing, deployment-failed}` AND `externalProviders` non-empty | `graph-node` per provider |
| RC08 | `structure.cycles` non-empty (one hypothesis per cycle) | `graph-edge` per cycle |

**Anti-hallucination law (line 66–66, enforced by tests):** any rule branch that produces zero
evidence items emits zero hypotheses. The evidence array on a `CauseHypothesis` is never empty.

### 6.4 Ranking

`results.sort((a,b) => confidence desc → rule id asc → hypothesis id asc)` — stable, deterministic.

---

## 7. Fixed KIND_SIGNALS and KIND_PROVIDERS Maps

**Source:** `src/engine.ts : 44–80`

These two maps are frozen in the facade. They tell callers exactly which live signals are absent and
which external providers are on the affected path.

### KIND_SIGNALS — live signals that would sharpen the diagnosis

| kind | signal | source (exact env vars) |
|------|--------|------------------------|
| `orders-failing` | `money.razorpay-status` | razorpay adapter (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`) |
| `orders-failing` | `db.engine-health` | postgres adapter (`SUPABASE_MGMT_TOKEN`, `SUPABASE_PROJECT_REF`) |
| `checkout-broken` | `money.razorpay-status` | razorpay adapter |
| `checkout-broken` | `realtime.health` | realtime adapter (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) |
| `queue-backlog` | `edge.queue-backlog` | Cloudflare GraphQL Analytics API (POST-only — structurally unreachable via the GET boundary) |
| `queue-backlog` | `edge.queue-detail` | queues adapter (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) |
| `high-latency` | `edge.ae-values` | Analytics Engine SQL API (POST `/analytics_engine/sql` — structurally unreachable via the GET boundary) |
| `deployment-failed` | `ci.workflows` | github-actions adapter (`GITHUB_TOKEN`, `GITHUB_REPOSITORY`) |
| `deployment-failed` | `deploy.vercel` | vercel adapter (`VERCEL_TOKEN`) |
| `worker-crashed` | `edge.worker-detail` | workers adapter (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`) |
| `worker-crashed` | `edge.cron-runs` | Workers logs/analytics (POST-only — structurally unreachable via the GET boundary) |
| `unknown` | _(none)_ | — |

All `KIND_SIGNALS` entries flow into `notConnectedSignals` on every `diagnose()` call, appear in
`Diagnosis.missingSignals`, and generate RC06 hypotheses (capped at 3). Live signals are **NOT
fabricated** — every entry names the exact adapter and the required environment variable(s).

### KIND_PROVIDERS — external providers on the affected path

| kind | providers |
|------|-----------|
| `orders-failing` | Razorpay |
| `checkout-broken` | Razorpay |
| `queue-backlog` | Cloudflare |
| `high-latency` | Cloudflare |
| `deployment-failed` | Cloudflare, Vercel |
| `worker-crashed` | Cloudflare |
| `unknown` | _(none)_ |

Providers feed RC07 for `kind ∈ {checkout-broken, orders-failing, deployment-failed}`.

---

## 8. Owner Attribution

**Source:** `src/attribution/AttributionService.ts`

Composes `@letbuyy/lcis-governance` (`createGovernanceEngine`). Two artifact sources (in order):

1. `domain-intel.json` → `GovDomain.owners[]` matched by `GovDomain.key` (case-insensitive
   substring match against input domain keys).
2. `infra-intel.json` → `GovOwnership.owners[]` matched by `GovOwnership.path` (case-insensitive
   substring).

Result is deduped and sorted ascending. Returns `[]` when artifacts are absent or no match is
found. Never throws — every failure path is wrapped in `try/catch → []`.

---

## 9. EINS Remediation Delegation

**Source:** `src/remediation/RemediationService.ts`

Composes `@letbuyy/lcis-engineering` (`createEngineeringEngine`). Two methods:

- **`rollbackFor(changeSubject, kind)`** (line 48): delegates to
  `eins.generateRollbackPlan({ text: 'Rollback <kind> <subject>', tables: [subject] (for migration/table kind), symbols: [] })`.
  Maps result to `{ readiness: plan.readiness, steps: plan.steps[].action }`. Returns `null` on
  any EINS failure — honest degradation, never fabricated guidance.
- **`verificationFor(symptom)`** (line 80): delegates to
  `eins.generateVerificationPlan({ text: 'Verify recovery from <kind>: <text>', domains: symptom.domains })`.
  Maps result to `'<check.id>: <check.description>'` strings, capped at 10. Returns `[]` on failure.

In `diagnose()`, `recommendedRollback` is populated only when a `change`-category hypothesis
survived AND a correlated change or migration exists. `verificationPlan` is populated for all kinds
except `unknown`.

---

## 10. Verdict Semantics

**Source:** `src/engine.ts : 131–135`

| Verdict | Condition |
|---------|-----------|
| `UNKNOWN` | `symptom.kind === 'unknown'` OR `hypotheses.length === 0` |
| `PARTIAL` | `affected.systems.length === 0` OR all surviving hypotheses have `connection === 'NOT_CONNECTED'` |
| `DIAGNOSED` | At least one `CONNECTED` hypothesis survived |

`UNKNOWN` is the anti-hallucination terminus: the system explicitly refuses to guess. The
`missingSignals` array names every absent signal — what is needed to move the verdict to
`DIAGNOSED`. The `summary` field includes the phrase `"nothing is guessed"` for `UNKNOWN` verdicts.

---

## 11. The `rootcause()` Envelope

**Source:** `src/shared/envelope.ts`

Every LRAS output is stamped by `rootcause<T>(body, opts)`:

```typescript
export function rootcause<T extends object>(
  body: T,
  opts: { evidence; sources?; confidence?; liveConnected?; now? },
): T & RootCauseArtifact
```

Fields added: `evidence`, `confidence`, `sources` (deduped from evidence), `timestamp`
(`opts.now ?? defaultNow`), `liveConnected` (`false` always — LRAS makes no live calls).

`defaultNow = () => new Date().toISOString()` is the single sanctioned clock boundary. No other
file in the package may call `new Date()` or `Date.now()` (enforced by the security test suite).

---

## 12. Composition Table — Which Package Answers What

| Question | Package | Key export |
|----------|---------|-----------|
| What kind of symptom is this? | `lcis-rootcause` (internal) | `SymptomService.classify()` |
| Which systems are affected? | `@letbuyy/lcis-twin` | `TwinEngine.impactRadius()` |
| Are there cycles / SPOFs? | `@letbuyy/lcis-twin` | `TwinEngine.cycles()`, `.spof()` |
| What changed recently? | `@letbuyy/lcis-tracking` | `TrackingEngine.generateTimeline()` |
| What are the cause hypotheses? | `lcis-rootcause` (internal) | `HypothesisService.evaluate()` |
| Who owns the affected domains? | `@letbuyy/lcis-governance` | `GovernanceEngine` / `AttributionService` |
| What is the rollback plan? | `@letbuyy/lcis-engineering` | `EngineeringEngine.generateRollbackPlan()` |
| What are the verification steps? | `@letbuyy/lcis-engineering` | `EngineeringEngine.generateVerificationPlan()` |
| Full ranked diagnosis | `lcis-rootcause` | `RootCauseEngine.diagnose()` |

---

## 13. Determinism Guarantee

The pipeline is deterministic by construction:

- `SymptomService.classify()` is pure (no IO, no clock, no randomness).
- `AffectedService` sorts `systems` before returning (`[...reachedSet].sort()`).
- `ChangeCorrelationService` processes records in timeline order (newest-first, LCTS contract).
- `HypothesisService.evaluate()` sorts results by `confidence desc → rule asc → id asc`.
- The `rootcause()` envelope uses an injectable `now()` function; tests inject a fixed clock.
- No `Math.random()`, no `Date.now()` outside `envelope.ts`, no external IO in any service.

Same symptom text + same artifact store → byte-identical `Diagnosis`. Asserted by the determinism
test suite (`test/engine.test.ts`).

---

## 14. Package Identity

- **Name:** `@letbuyy/lcis-rootcause`
- **Type:** `"module"` (ESM-only)
- **Source root:** `packages/lcis-rootcause/src/`
- **Test entry:** `packages/lcis-rootcause/test/`
- **Validated:** 482/482 tests green on Phase 12 gate pass (2026-07-04)
