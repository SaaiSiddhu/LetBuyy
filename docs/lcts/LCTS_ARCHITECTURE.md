# LCTS Architecture — Change Tracking System (Phase 10)

**Package:** `packages/lcis-tracking` (`@letbuyy/lcis-tracking`)
**Date:** 2026-07-04

---

## 1. Position in the LCIS stack

LCTS answers one question the rest of the stack does not: **what did change, over time?**

| System | Question answered | LCTS relationship |
|---|---|---|
| EIS / EINS (`lcis-execution`, `lcis-engineering`) | What *would* change if we build / merge X? (proposed-change analysis) | LCTS delegates blast radius and rollback planning TO these — it never re-models them |
| GDIS (`lcis-governance`) | What has *drifted* from declared state *right now*? | LCTS delegates ownership lookup TO GDIS; drift signals can seed the timeline via liveFacts |
| LCOS (`lcis-operations`) | What is *failing / slow* in production right now? | Not replicated in LCTS; live-event facts are composed via adapter injection |
| **LCTS** | What *did* change — migrations applied, decisions recorded, structural items added/removed, live commits/deploys? | **Distinct output**: change timeline, snapshot diff, per-change impact, rollback guidance, per-subject history with reasons |

LCTS is **read-only** and **non-fabricating**. It never mutates state, never executes code, and never invents data. Every output carries provenance evidence grounded in a real artifact or is honestly labelled `NOT_CONNECTED` with the exact source that would supply it.

---

## 2. The frozen ChangeRecord vocabulary

`packages/lcis-tracking/src/shared/types.ts` is the single type contract. No service may define types — they all consume from `shared/`.

### ChangeKind (17 values)

```ts
type ChangeKind =
  | 'commit' | 'pr' | 'deployment' | 'migration' | 'decision'
  | 'table' | 'rpc' | 'policy' | 'trigger'
  | 'worker' | 'queue' | 'route' | 'config' | 'secret' | 'package' | 'infra';
```

### ChangeAction (5 values)

```ts
type ChangeAction = 'added' | 'removed' | 'modified' | 'applied' | 'observed';
```

`applied` is used exclusively for migrations. `observed` is used for decisions and live-fact events. Structural diff records use `added` / `removed`.

### Connection (2 values)

```ts
type Connection = 'CONNECTED' | 'NOT_CONNECTED';
```

Every `ChangeRecord` carries a `connection` field. Records sourced from `memory-intel.json` (migrations, decisions) are `CONNECTED`. Records that would require a live adapter (commits, PRs, deployments) are `NOT_CONNECTED` unless `LiveFact[]` are injected.

### The atom: ChangeRecord

```ts
interface ChangeRecord {
  readonly id: string;           // stable: 'migration-174', 'table:orders#added'
  readonly kind: ChangeKind;
  readonly subject: string;      // table name, rpc name, file path, package name, …
  readonly action: ChangeAction;
  readonly at: string | null;    // ISO timestamp — null when no reliable time exists
  readonly detail: string;
  readonly source: string;       // artifact path or 'adapter:<name>'
  readonly connection: Connection;
  readonly evidence: readonly Evidence[];
}
```

**Honesty rule on `at`:** migration and decision records in `memory-intel.json` carry no reliable wall-clock timestamps. LCTS sets `at: null` for them — never fabricated. Live-fact records receive `at` verbatim from the injected `LiveFact.at`.

### TrackingArtifact — mandatory provenance on every output

```ts
interface TrackingArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;     // 0..1 structural only, capped at 0.9; 0 with no evidence
  readonly sources: readonly string[];
  readonly timestamp: string;
  readonly liveConnected: boolean; // true only when liveFacts were injected
}
```

The `tracking()` function in `shared/envelope.ts` stamps this on every service output. Confidence is computed via `confidenceFrom()`: `min(0.9, 0.5 + 0.1 * connectedEvidenceCount)`; 0 when no evidence exists.

---

## 3. The five services and their exact delegations

### 3.1 TimelineService (`src/timeline/TimelineService.ts`)

**Produces:** `ChangeTimeline` — an ordered record list, `byKind` counts, `notConnectedFeeds`, and a plain-language summary.

**Source:** `graphify-out/memory-intel.json` read via `this.core.store.tryRead('memory-intel.json')` and parsed with Zod (loose schemas: `MemoryIntelSchema`, `RawMigrationSchema`, `RawDecisionSchema`).

**Delegations:**
- Memory artifact: `lcis-core` `ArtifactStore.tryRead` (read-only, no new logic).
- Live facts: injected `LiveFact[]` from `@letbuyy/lcis-adapters` — the service maps them via `FACT_KIND_MAP`:

```ts
const FACT_KIND_MAP: Readonly<Record<string, ChangeKind>> = {
  deployment: 'deployment',
  pr: 'pr',
  'ci-run': 'commit',
  release: 'deployment',
};
```

Unmapped kinds fall to `'infra'` (honest catch-all).

**Sort order:**
1. Records with `at !== null` sorted ISO-descending, stable tie-break by `id`.
2. Records with `at === null` after, preserving insertion order: migrations (n DESC) then decisions.

**Decisions cap:** 50 entries. If the memory artifact carries more than 50 decisions, only the first 50 are loaded; the cap is noted in evidence.

**NOT_CONNECTED feeds** (when `liveFacts` is empty):
```
repo.events      → github adapter (GITHUB_TOKEN, GITHUB_REPOSITORY)
ci.workflows     → github-actions adapter
deploy.vercel    → vercel adapter (VERCEL_TOKEN)
```
These appear verbatim in `timeline.notConnectedFeeds` and as `notConnected` evidence entries.

**Clock:** injectable `now: () => string` passed through the constructor; `defaultNow` from `shared/envelope.ts` is the default. Never calls `Date.now()` or `new Date()`.

---

### 3.2 SemanticDiffService (`src/diff/SemanticDiffService.ts`)

**Produces:** `SemanticDiff` — added/removed/unchanged counts plus `ChangeRecord[]` for every structural item that moved between snapshots.

**Inputs:** two `SnapshotInventory` values — `before` and `after`. The consumer is responsible for supplying them; the service does not fetch them.

**Current inventory:** `currentInventory()` delegates to `readCurrentInventory(this.core, this.now)` from `shared/inventory.ts` — the single source of truth. No duplication.

**Inventory reading (`src/shared/inventory.ts`):**
- `graphify-out/db-intel.json` — Zod-validated via `DbIntelSchema`: tables, rpcs, policies, triggers.
- `graphify-out/infra-intel.json` — Zod-validated via `InfraIntelSchema`: workers, queues, routes, packages.
- Absent artifact: `notConnected` evidence emitted; the corresponding lists are empty.
- Malformed artifact: evidence with `'unexpected shape — … empty (not fabricated)'` is emitted; no throw.

**Category order (fixed, deterministic):**

```
tables → rpcs → policies → triggers → workers → queues → routes → packages
```

Within each category subjects are sorted ascending. Two identical calls with identical inputs always produce identical JSON output (deterministic replay guarantee).

**NOT_CONNECTED:** the diff itself requires only the two snapshot inputs (structural computation). `liveConnected` is always `false` on the diff output.

---

### 3.3 ImpactService (`src/impact/ImpactService.ts`)

**Produces:** `ChangeImpact` — affected symbols, file count, affected domains, owners, and risk.

**Delegations (three layers, explicit reuse provenance in evidence):**

| Field | Delegation | Condition |
|---|---|---|
| `affectedSymbols`, `affectedFiles` | `lcis-core` `BlastRadiusService.blast(subject, 3)` | Only for blast-able kinds: `rpc`, `worker`, `route`, `package`, `commit`, `pr` |
| `affectedDomains`, `risk` | `lcis-engineering` `FeatureIntelligenceService.analyzeFeature(featureReq)` | Always attempted; failure emits `notConnected` evidence |
| `owners` | `lcis-governance` `OwnershipService.generateOwnershipReport()` | Always attempted; result cross-referenced against subject and affected domains |

**FeatureRequest seeding (per kind):**
- `table` / `migration`: `{ text: 'change <kind> <subject>', tables: [subject] }`
- `rpc` / `worker`: `{ text: 'change <kind> <subject>', symbols: [subject] }`
- all others: `{ text: '<kind> change: <subject>' }`

**Blast for non-blast kinds** (table, migration, policy, trigger, config, secret, infra, deployment, queue): emits `notConnected` evidence naming `'graphify-out/graph.json — not symbol-resolvable for kind: <kind>'`. `affectedSymbols` remains `[]`; domains come from EINS.

**Ownership extraction:** uses `OwnershipReport.gaps` (unowned entities) as the negative filter. If the record subject or an affected domain appears in the gaps list, it is confirmed unowned. If not in the gaps list, the ownership coverage fraction is structurally present but owner names are not accessible via the report API — honestly noted in evidence; `owners` stays `[]`. No names are fabricated.

**Degradation:** each delegation is wrapped in a `try/catch`. A failure emits `notConnected` evidence; the corresponding field defaults safely (empty list, `'low'` risk level, etc.).

---

### 3.4 RollbackService (`src/rollback/RollbackService.ts`)

**Produces:** `ChangeRollback` — readiness, ordered steps, and a list of irreversible changes.

**Delegation:** 100% to `lcis-engineering` `EngineeringEngine.generateRollbackPlan(req)` via `createEngineeringEngine({ core, now })`. RollbackService contains no rollback logic of its own.

**Request construction:**
```ts
{
  text: `Rollback ${record.kind} ${record.subject}`,
  tables: record.kind === 'table' || record.kind === 'migration' ? [record.subject] : [],
  symbols: record.kind === 'rpc'   || record.kind === 'worker'    ? [record.subject] : [],
}
```

**Migration prepend rule:** for `kind === 'migration'`, a semantic domain step is prepended to the plan steps before the EINS steps:
```
Review migration file <record.subject> for down-migration
```

**Honest NOT_READY degradation:** when `generateRollbackPlan` throws (structural artifacts absent — graph/db-intel not generated), the service does NOT fabricate a plan. It returns `readiness: 'NOT_READY'` with recovery instructions:
- migration: `['Review migration file <subject> for down-migration', 'Refresh the intelligence artifacts (pnpm graph:omega) to obtain a full EINS rollback plan']`
- all others: `['Refresh the intelligence artifacts (pnpm graph:omega) to obtain a full EINS rollback plan']`

Evidence always cites `lcis-engineering:generateRollbackPlan` explicitly with the delegation outcome.

---

### 3.5 HistoryService (`src/history/HistoryService.ts`)

**Produces:** `ChangeHistory` — filtered change records for a subject, plus decision reasons.

**Inputs:** a `subject` string and an already-built `ChangeTimeline` (passed in from the facade — no independent timeline construction).

**Record filter (three predicates, OR):**
```ts
r.subject === subject
  || r.subject.includes(subject)
  || r.detail.toLowerCase().includes(subject.toLowerCase())
```

Timeline order is preserved.

**Reason lookup:** `this.core.memory.search(subject, { limit: 10 })` via `lcis-core` `MemoryService`. Each hit maps to `{ id: h.id, title: h.section, source: h.source }`. `h.section` is the nearest heading above the chunk — the most title-like field.

**NOT_CONNECTED for reasons:** empty corpus or any `memory.search` error → `notConnected('memory:reasons:<subject>', 'lcis-core MemoryService corpus (memory-intel.json + docs)')`. `reasons` stays `[]`; no fabrication.

---

## 4. The facade — ChangeTrackingEngine (`src/engine.ts`)

```ts
interface TrackingEngine {
  readonly core: LcisEngine;
  readonly timeline: TimelineService;
  readonly diff: SemanticDiffService;
  readonly impact: ImpactService;
  readonly rollback: RollbackService;
  readonly history: HistoryService;
  generateTimeline(liveFacts?: readonly LiveFact[]): ChangeTimeline;
  generateDiff(before: SnapshotInventory, after: SnapshotInventory): SemanticDiff;
  generateImpact(record: ChangeRecord): ChangeImpact;
  generateRollback(record: ChangeRecord): ChangeRollback;
  generateHistory(subject: string, liveFacts?: readonly LiveFact[]): ChangeHistory;
  generateTrackingReport(liveFacts?: readonly LiveFact[]): TrackingReport;
}
```

**Constructor wiring:**
```ts
constructor(opts: TrackingEngineOptions = {}) {
  this.core    = opts.core ?? getEngine();
  this.now     = opts.now ?? defaultNow;
  this.timeline = new TimelineService(core, now);
  this.diff     = new SemanticDiffService(core, now);
  this.impact   = new ImpactService(core, now);
  this.rollback = new RollbackService(core, now);
  this.history  = new HistoryService(core, now);
}
```

The `now` clock is passed through to every service — the single injectable point; no service creates its own clock.

**`generateHistory`** delegates to `this.history.historyOf(subject, this.timeline.buildTimeline(liveFacts))` — the timeline is built once and passed in; no duplicate timeline construction.

**Process-wide singleton:**
```ts
export function getTrackingEngine(opts?: TrackingEngineOptions): TrackingEngine
export function resetTrackingEngine(): void  // tests only
```

---

## 5. The flagship TrackingReport

`generateTrackingReport(liveFacts?)` is the highest-level LCTS output.

### Composition steps

1. Build `timeline` via `generateTimeline(liveFacts)`.
2. Retrieve `inv = this.diff.currentInventory()` — reads structural artifacts.
3. Evaluate TR01, TR03, TR06 over the timeline and inventory evidence (see section 6).
4. Extract `latestMigration`:
   - Filter `timeline.records` for `kind === 'migration'`.
   - Parse `Number(r.id.replace('migration-', ''))`.
   - Sort descending by `n`; take first.
   - Returns `{ n: number; file: string } | null`.
5. Count `decisionCount` from `timeline.records` where `kind === 'decision'`.
6. Stamp via `tracking()` with `liveConnected: timeline.liveConnected`.

### TrackingReport type

```ts
interface TrackingReport extends TrackingArtifact {
  readonly timeline: ChangeTimeline;
  readonly findings: readonly TrackingFinding[];
  readonly latestMigration: { readonly n: number; readonly file: string } | null;
  readonly decisionCount: number;
  readonly summary: string;
}
```

---

## 6. Rules TR01..TR06

Defined in `src/shared/rules.ts` via `TrackingRuleRegistry`. Rules are metadata; services evaluate them over records and evidence — no rule executes anything.

| Rule | Severity | Trigger |
|---|---|---|
| TR01 Stale intelligence artifacts | `medium` | `db-intel.json` or `infra-intel.json` missing or unreadable — `notConnected` evidence in the inventory |
| TR02 Unowned change | `high` | A change record has no resolvable owner (CODEOWNERS gap — flagged via `OwnershipService.gaps`) |
| TR03 High-risk change | `critical` | A migration record's `detail` matches any of: `payment`, `refund`, `payout`, `gift-card`, `ledger` (case-insensitive). Capped to 10 findings per report. |
| TR04 Undocumented change | `medium` | No decision/reason found in memory for a structural change |
| TR05 Irreversible change | `high` | A change whose rollback plan contains irreversible steps (`plan.irreversible.length > 0`) |
| TR06 Live change feed disconnected | `info` | A live change feed (commits/PRs/deployments) is NOT_CONNECTED — timeline shows structural history only |

**The engine evaluates TR01, TR03, TR06 in `generateTrackingReport`.** TR02, TR04, TR05 are defined in the registry for evaluation by callers or future services (not currently auto-evaluated in the report).

The set of money migration types that trigger TR03:
```ts
const MONEY_MIGRATION_TYPES = new Set(['payment', 'refund', 'payout', 'gift-card', 'ledger']);
```

---

## 7. Honesty law

1. **No fabrication.** Any field that cannot be derived from a real artifact is either `null`, `[]`, or omitted. Every gap emits a `notConnected` evidence entry naming the exact artifact or env var that would supply it.

2. **Null timestamps.** Migration records in `memory-intel.json` carry no reliable wall-clock timestamps. `at: null` is the correct, honest value for all migrations and decisions. Live-fact records receive `at` verbatim from `LiveFact.at`.

3. **NOT_CONNECTED feeds.** When no `liveFacts` are injected, `timeline.notConnectedFeeds` contains the three exact live sources with their required adapter/env-var:
   ```
   repo.events     → github adapter (GITHUB_TOKEN, GITHUB_REPOSITORY)
   ci.workflows    → github-actions adapter
   deploy.vercel   → vercel adapter (VERCEL_TOKEN)
   ```

4. **No git-diff reliance.** LCTS never reads `.git/` or runs `git diff`. Every change record is a typed semantic fact derived from structural artifacts (`memory-intel.json`, `db-intel.json`, `infra-intel.json`, injected `LiveFact[]`). This also means no filesystem access to the working tree.

5. **Confidence cap.** `confidenceFrom()` caps at `0.9`. No output claims `confidence: 1.0`; structural-only analysis never achieves perfect confidence.

---

## 8. Deterministic replay guarantee

LCTS outputs are byte-identical given the same inputs:

- The injectable clock (`now: () => string`) is the only time-varying input. In tests a fixed clock is passed; the `timestamp` field in every output is therefore fixed.
- Sort orders are deterministic (ISO desc for dated records, stable `id` tie-break; migration n DESC then decisions by insertion order for null-at records; category order for diff records).
- The `SemanticDiffService.diff()` sorts subjects ascending within each category and categories in fixed order — identical input snapshots always produce identical JSON.
- Zod schemas are `loose()` (extra fields ignored, not rejected), so artifact shape changes do not break replay.
- No `Math.random()`, no UUID generation, no nondeterministic computation.

---

## 9. Dependency graph

```
@letbuyy/lcis-tracking
  ├── @letbuyy/lcis-core          (ArtifactStore, BlastRadiusService, MemoryService, LcisEngine, Evidence)
  ├── @letbuyy/lcis-adapters      (LiveFact injection interface)
  ├── @letbuyy/lcis-governance    (GovernanceEngine → OwnershipService)
  ├── @letbuyy/lcis-engineering   (EngineeringEngine → FeatureIntelligenceService, generateRollbackPlan)
  └── zod                         (artifact schema validation)
```

LCTS has no runtime dependencies outside this allowlist. It does not depend on `lcis-execution`, `lcis-operations`, or any application package.
