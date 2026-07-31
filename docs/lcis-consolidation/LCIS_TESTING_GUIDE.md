# LCIS Testing Guide

## Running Tests

```bash
# Run all tests
pnpm --filter @letbuyy/lcis-core test

# Typecheck only (no test execution)
pnpm --filter @letbuyy/lcis-core typecheck
```

The test command expands to `tsx --test test/*.test.ts` via `node:test` (Node.js
built-in test runner). No Jest, no Vitest.

**Total tests: 134** across 6 test files.

---

## Test Files

### `test/contract.test.ts` — 52 lines, 3 tests

Enforces the consolidation rules structurally. These tests must pass before any
other test is meaningful.

| Test | Assertion |
|------|-----------|
| No generation names in file paths | `walk(srcDir)` finds no `.ts` file whose path segments match `/^(v\d+|omega|infinity|genesis)$/i` |
| No forbidden runtime deps | `pkg.dependencies` keys sorted must equal `['zod']` exactly. Forbidden regex: `qdrant\|openai\|graphrag\|crawl4ai\|playwright\|signoz\|@opentelemetry\|chromadb\|pinecone\|weaviate` |
| All 8 service modules reachable from barrel | `src/index.ts` must contain `'./${mod}/index'` for each of: `contracts`, `runtime`, `graph`, `blast-radius`, `memory`, `decision`, `architecture`, `verification` |

### `test/blast-radius.test.ts` — 87 lines, 9 tests

Real artifact integration against `graphify-out/graph.json` and optionally
`domain-intel.json` / `relationship-intel.json`.

| Test | Key assertion |
|------|--------------|
| Graph loads at expected scale | `nodeCount() > 40000`, `edgeCount() > 50000` |
| `blast(getSupabaseAdmin)` | `impactedFiles >= 100`, `layers.length` in [1, 3], `artifact === 'graphify-out/graph.json'` |
| `consumers(getSupabaseAdmin)` | `consumedBy.length >= 50`, each item has `rel: string` |
| `dependencies(getSupabaseAdmin)` | Returns non-null, `dependsOn` is array |
| `critical(5)` | Returns exactly 5 nodes, degrees are non-increasing |
| Unknown symbol | `blast('__definitely_not_a_real_symbol_zzz__') === null` |
| `crossDomain(payments)` | `blastRadius.domains >= 3` (skipped if `domain-intel.json` absent) |
| `impact(payments)` | `risk.money` is boolean, `breaks.deployments.gate` matches `/production-deploy/` (skipped if absent) |
| `relationships(sites)` | `fanIn >= 1` (skipped if `relationship-intel.json` absent) |

### `test/memory.test.ts` — 210 lines

Real corpus integration. The index is built from markdown files in the repo and
`graphify-out/memory-intel.json`.

| Area | Key assertions |
|------|---------------|
| Corpus scale | `docCount >= 100`, `termCount >= 500`, `latestMigrationN >= 174`, `schemaHash.length === 12` |
| Canonical-ledger rule | `search('why must money mutations use RPC')` returns at least one hit with `type === 'decision' \| 'governance'` and text referencing `money`/`ledger`/`rpc` |
| `D-016` retrieval | `decision('D-016')` returns non-null, `rule` includes `'R-6'`, `type === 'payment'` |
| Two-runtime split | Verifies merchant (ES256) vs customer (HS256) split is in the corpus |
| BM25 search | Various queries return scored hits |
| `cite()` | Returns citations with `confidence` of `'high'`/`'medium'`/`'low'` |
| `buildContext()` | Returns a pack fitting within `tokenBudget`, `stale: false` initially |
| Staleness simulation | `_simulateStale(0)` → `buildContext().stale === true` |
| `decisions()` | Returns only `D-xxx` entries (not `migration-N`) |
| `decision()` by id | Direct lookup by `'D-016'` and `'migration-174'` |

### `test/decision.test.ts` — 370 lines

Two sections: pure scoring functions (no IO) and service integration.

**Pure scoring functions:**

| Function | Key test |
|----------|---------|
| `severityWeight('🔴')` | `=== 3` |
| `severityWeight('critical')` | `=== 3` |
| `severityWeight('🟠')` | `=== 2` |
| `severityWeight('🟡')` | `=== 1` |
| `severityWeight('🟢')` | `=== 0` |
| `riskScore({ sw:3, md:1, sr:0, obr:1 })` | `=== 180` (3×40 + 1×30 + (100−0)×0.2 + 1×10) |
| `riskScore({ sw:3, md:0, sr:88, obr:1 })` | `=== 132.4` (3×40 + 0 + (100−88)×0.2 + 1×10) |
| `fixScore({ sw:3, md:0, sr:88, obr:1 }, 'high')` | `=== 205` (3×40 + 2×35 + 1×15 + 0×10) |
| `inrImpactTier` | Maps domain+severity+openBlocker to `'high'\|'medium'\|'low'\|'none'` |

**Service integration (artifacts required):**
- `rankRisks()` — deterministic across two consecutive calls, sorted desc
- `rankFixes()` — each item has `fixPlan`, `verificationPlan`, `testPlan`, `rollbackPlan`
- `launchVerdict()` — returns `GO`, `NO-GO`, or `CONDITIONAL-GO`
- `scaleTiers()` — every string in every tier must include `'load test'` (honesty contract)
- `systemReadiness()` — array of `{ system, key, score, evidence, blockers }`
- `dimensionReadiness()` — array of 10 items (if artifact present)
- `evidence(id)` — array, may be empty but never throws
- `trace(id)` — returns `Decision` with `inputs`, `factors`, `formula`, `score`, `rank`
- `prioritize([...])` — returns ranked items in score-desc order

### `test/architecture.test.ts` — 454 lines

Tests all 7 `explainX` methods, including honest-absence cases.

| Test area | Key assertions |
|-----------|---------------|
| `explainDomain('payments')` | `evidence.length >= 1`, `summary` includes `'payments'`, detail includes `'money'` |
| `explainDomain('unknown-key')` | Returns non-null `Explanation`, `summary` references the missing key (not a throw) |
| `explainService('api-gateway')` | `summary` includes `'gateway'`, evidence cites `LAYER_MAP` or `arch-intel` |
| `explainDependency(a, b)` | Returns `Explanation`, evidence cites `domain-intel.json` edges |
| `explainArchitecture()` | Evidence array non-empty, `summary` includes domain count and table count |
| `explainRuntime()` | `summary` mentions Workers and Vercel, evidence cites `infra-intel.json` |
| `explainOwnership('payments')` | `summary` includes owner or `'unowned'` |
| `explainRisk('payments')` | `summary` includes `'critical'`, evidence includes `MONEY_TABLES` citation |
| Missing artifact | Returns `Explanation` with `evidence[0].source === 'not-connected'` (not a throw) |
| NARRATIVE map | Every `explainDomain` for a known domain returns `detail` containing `'Purpose:'` |

### `test/verification.test.ts` — 221 lines

Tests all 6 `verifyX` methods plus status rule enforcement.

| Test area | Key assertions |
|-----------|---------------|
| `verifyArchitecture()` | Returns a `Verification`, `status` is one of the 4 valid values |
| `verifyDomains()` | `evidence.length >= 1`, `gaps` is array |
| `verifyServices()` | `status` is valid, `confidence` in `[0, 1]` |
| `verifyRuntime()` | `status === 'PARTIAL'` always (NOT CONNECTED penalty drives confidence < 0.60) |
| `verifyDependencies()` | Returns `Verification`, `confidence` in `[0, 1]` |
| `verifyProductionReadiness()` | Returns `Verification`, `gaps` is array |
| Status rules | `REFUTED` requires authoritative contradiction (`v1-lcis`, `security-gate`, etc.), not just low confidence |
| Advisory-only assertion | No verification result carries a `blocksMerge` or `required` flag |
| Confidence bounds | All returned `confidence` values are in `[0, 1]` |

---

## Conservative Threshold Pattern

Use `>=` for counts that change across graph rebuilds:

```ts
// Good: survives a graph update that adds more nodes
assert.ok(graph.nodeCount() > 40000, `nodeCount=${graph.nodeCount()}`);
assert.ok(r.impactedFiles >= 100, `impactedFiles=${r.impactedFiles}`);

// Bad: breaks if 3 new files import getSupabaseAdmin
assert.equal(r.impactedFiles, 127);
```

Skip tests that require optional artifacts:

```ts
const hasDomain = store.has('domain-intel.json');

test('crossDomain(payments)', { skip: !hasDomain }, () => {
  // ...
});
```

This means tests are never failing simply because the developer hasn't run
`pnpm graph:omega` yet — only the tests that don't require optional artifacts
run unconditionally.
