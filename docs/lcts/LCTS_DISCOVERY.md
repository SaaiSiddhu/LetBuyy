# LCTS Discovery — Change Tracking System (Phase 10)

**Date:** 2026-07-04 · Verified against the real repository. **No coding before this discovery.**

## 1. What already exists (LCTS composes — never duplicates)

| Capability | Where (verified) | LCTS reuse |
|---|---|---|
| Migration + decision history | `lcis-core` `MemoryService` over `graphify-out/memory-intel.json` (**180 decisions, migrations → n=174**, per-migration n/file/name/type) | The CONNECTED historical change record + the "reason" (why) lookup |
| Symbol blast radius | `lcis-core` `BlastRadiusService.blast(symbol, depth)` | Impact/blast for code-level changes |
| Structural inventories (semantic diff inputs) | `graphify-out/db-intel.json` (tables/rpcs/policies/triggers), `infra-intel.json` (workers/queues/secrets/deploy), `graph.json` — all via read-only `ArtifactStore` | Typed before/after snapshots for the semantic diff |
| Proposed-change analysis | `lcis-execution` `ChangeAnalyzer`/`ExecutionIntelligenceService.analyzeChange`; `lcis-engineering` `ChangeIntelligenceService` + `FeatureIntelligenceService.analyzeFeature` (complexity/risk incl. money/tenant drivers) | Risk scoring for an OBSERVED change — delegate, don't re-model |
| Drift (declared vs actual) | `lcis-governance` `DriftDetectionService` | Drift as a change-signal source |
| Owners | `lcis-governance` `OwnershipService` (CODEOWNERS) | Change → owner attribution |
| Rollback planning | `lcis-engineering` rollback planner (via EINS facade) | Rollback guidance per change |
| Live commits/PRs/deployments | `lcis-adapters` `GitHubAdapter`/`GitHubActionsAdapter` LiveFacts (Phase 9) | Live change events — honestly NOT_CONNECTED without GITHUB_* creds |

**Distinctness proof (no duplicate intelligence):** EIS/EINS analyze a *proposed* change ("what would happen if"); GDIS drift compares declared-vs-actual *now*; **LCTS tracks what *did* change over time** — a semantic timeline + diff over historical records and snapshot pairs. No existing package produces a change timeline, a semantic snapshot diff, or per-change history composition.

## 2. Phase 10 scope

**New package `packages/lcis-tracking`** (LCTS), same conventions as lcis-orchestration (frozen shared contract → services → facade → tests; injectable clock; provenance on every output; read-only; no AI).

Foundation vocabulary: `ChangeRecord` — `{ id, kind: commit|pr|deployment|migration|table|rpc|policy|trigger|worker|queue|route|config|secret|package|infra, subject, at: string|null, action: added|removed|modified|applied|observed, detail, source, connection: CONNECTED|NOT_CONNECTED, evidence[] }` + `ChangeTimeline`, `SemanticDiff`, `ChangeImpact`, `ChangeHistory`, `TrackingReport` (all provenance-stamped via a `tracking()` envelope mirroring `execution()`).

Services (7):
1. **TimelineService** — merges migration/decision history (CONNECTED, from MemoryService corpus source `memory-intel.json`) + injected live git facts (NOT_CONNECTED without adapters) into one ordered, deduped timeline. Never relies on `git diff` — semantic records only.
2. **SemanticDiffService** — deterministic diff of two typed inventory snapshots (tables/rpcs/policies/triggers/workers/queues/routes/packages): added/removed/modified with per-entity evidence. Current snapshot = live artifacts; historical snapshots = injected (an archive contract; absent archive → history honestly NOT_CONNECTED).
3. **ImpactService** — ChangeRecord → blast radius (core `blast()` for symbols; db-intel joins for tables/rpcs) + affected domains.
4. **OwnerService** — ChangeRecord → owners via governance `OwnershipService` (delegation, zero own logic).
5. **RiskService** — ChangeRecord → risk via EINS `analyzeFeature` seeds (tables/symbols from the record) — money/tenant drivers come from EINS, not re-implemented.
6. **RollbackService** — ChangeRecord → rollback guidance via the EINS rollback planner (delegation).
7. **HistoryService** — subject → full change history + **reason** (`MemoryService.search` decisions) — "why did X change".

Facade: `ChangeTrackingEngine` (`createTrackingEngine`/`getTrackingEngine`/`resetTrackingEngine`) → `generateTimeline`, `generateDiff(before, after)`, `generateImpact(record)`, `generateHistory(subject)`, `generateTrackingReport` (flagship, composes all).

## 3. Verification plan

`pnpm typecheck test --filter=@letbuyy/lcis-tracking`. Target ≥300 tests: foundation ~40, per-service ~30×7, facade ~30, security scan ~20 (same recursive source-scan pattern as lcis-orchestration), deterministic replay (same fixtures → byte-identical reports) ~10. Back-compat: nothing existing is modified except optional additive exports.
