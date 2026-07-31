# LCIS Phase 4 Completion Report

**Date:** 2026-06-20  
**Phase:** 4 — Execution Intelligence System (EIS)

---

## Summary

Phase 4 adds `@letbuyy/lcis-execution`: a read-only planning layer over `@letbuyy/lcis-core`. Given a natural-language change request, the EIS produces up to 8 plan artifacts (change analysis, execution plan, execution graph, migration plan, test plan, rollback plan, launch plan, verification plan), each carrying mandatory provenance (evidence / confidence / sources / timestamp).

Four access packages were extended to expose the EIS via CLI, MCP tools, HTTP routes, and PR review verdicts. No existing package behavior changed.

---

## Architecture

### New Package

| Package | Location | Description |
|---------|----------|-------------|
| `@letbuyy/lcis-execution` | `packages/lcis-execution/` | EIS — read-only planning intelligence |

`@letbuyy/lcis-execution` depends on:
- `@letbuyy/lcis-core` (`workspace:*`) — structural graph, blast radius, BM25 memory, store
- `@letbuyy/lcis-live` (`workspace:*`) — declared; not called during plan derivation

### Package Internal Structure

```
src/shared/       types + seed-resolver + change-analysis + envelope + scoring
src/execution/    ExecutionIntelligenceService + ExecutionGraphService + work-graph
src/migration/    MigrationIntelligenceService
src/testing/      TestingIntelligenceService
src/rollback/     RollbackIntelligenceService
src/launch/       LaunchIntelligenceService + VerificationPlanner
src/engine.ts     EisEngine facade (createEisEngine / getEisEngine / resetEisEngine)
src/index.ts
```

### Extended Access Packages (Additive)

| Package | Addition |
|---------|---------|
| `@letbuyy/lcis-cli` | `plan` command group with 8 subcommands |
| `@letbuyy/lcis-mcp` | 7 `lcis_plan_*` tools added to TOOLS registry (total: 19 tools) |
| `services/lcis-api` | 7 `POST /plan/*` routes |
| `@letbuyy/lcis-pr-check` | `analyzeWithVerdicts()` + 6 EIS-derived PR review verdicts |

---

## Key Interfaces

### `EisEngine` (the public API)

```ts
interface EisEngine {
  readonly core: LcisEngine;
  readonly analyzer: ChangeAnalyzer;
  readonly execution: ExecutionIntelligenceService;
  readonly executionGraph: ExecutionGraphService;
  readonly migration: MigrationIntelligenceService;
  readonly testing: TestingIntelligenceService;
  readonly rollback: RollbackIntelligenceService;
  readonly launch: LaunchIntelligenceService;
  readonly verification: VerificationPlanner;

  analyze(req: ChangeRequest): ChangeAnalysis;
  planAll(req: ChangeRequest): Promise<FullPlan>;
}
```

### `FullPlan` (composite output)

```ts
interface FullPlan {
  readonly change: ChangeAnalysis;
  readonly execution: ExecutionPlan;
  readonly executionGraph: ExecutionGraph;
  readonly migration: MigrationPlan;
  readonly tests: TestPlan;
  readonly rollback: RollbackPlan;
  readonly launch: LaunchPlan;
  readonly verification: VerificationPlan;
}
```

### `PlanArtifact` (base provenance — on every output)

```ts
interface PlanArtifact {
  readonly evidence: readonly Evidence[];
  readonly confidence: number;    // 0..0.95; structural-only; 0 = no evidence
  readonly sources: readonly string[];
  readonly timestamp: string;
}
```

---

## Key Decisions and Tradeoffs

| Decision | Tradeoff |
|----------|---------|
| Deterministic seed resolution (token match; no LLM) | Reproducible and evidence-cited; limited coverage for requests that don't share tokens with domain/table names — mitigated by explicit seed options |
| Confidence capped at 0.95 | LCIS never claims certainty about structural predictions |
| `planAll` analyses once, shares backbone | Prevents 7× blast-radius lookups for one release plan |
| `unresolved: true` with exit 0 for unmatched requests | Honest empty plan rather than error; callers must check `unresolved` flag |
| Read-only enforced by source scan in tests | Immediate failure if any service file adds forbidden IO |
| Rollback accepts `ChangeRequest` directly (re-analyses internally) | Simple standalone rollback API at the cost of a second analysis pass when called in isolation |
| `plan security` CLI wraps `TestTarget[]` in synthetic envelope | Consistent envelope pattern; `lcis_plan_tests` MCP tool exposes the full `TestPlan` including the security sub-plan |
| `VerificationPlanner` in `src/launch/` | Tight conceptual coupling; both remain independently accessible |
| PR verdicts use stub EIS in tests | Avoids artifact dependency in pr-check suite; EIS correctness covered by 265-test suite |
| `NOT_READY` migration readiness for money-table changes | Structural safety gate — canonical-ledger-only-validator + step-up must be reviewed by a human |

---

## Security Posture

**Read-only by construction.** The EIS has no mutation path:

- No `fetch` calls; no `child_process`; no file writes. Enforced by source-scan tests in 4 of 7 test files.
- The `EisEngine` public interface exposes no mutation methods.
- All plan data is derived from `graphify-out/*.json` artifacts (pre-computed, gitignored) via the `LcisEngine` store. The store is read-only.
- No credentials are read or required by the EIS at plan time.
- Money-touching changes are always flagged at `critical` risk; migration readiness is `NOT_READY`; launch decision is `NO_GO`. These are informational — the EIS does not block any pipeline; it surfaces the signals.

**PR verdicts security dimension:**
- `FAIL` when payment-related or RLS-related files are in the PR
- `WARN` when auth/HMAC/Turnstile/tenant-isolation files are touched
- `UNKNOWN` when the EIS engine call throws (never fabricated as `PASS`)

---

## Test Results

Confirmed by running `pnpm --filter "@letbuyy/lcis-*" test` on 2026-06-20.

| Package | Tests | Pass | Fail |
|---------|-------|------|------|
| `@letbuyy/lcis-core` | 140 | 140 | 0 |
| `@letbuyy/lcis-adapters` | 172 | 172 | 0 |
| `@letbuyy/lcis-live` | 67 | 67 | 0 |
| `@letbuyy/lcis-execution` | **265** | **265** | **0** |
| `@letbuyy/lcis-pr-check` | 128 | 128 | 0 |
| `services/lcis-api` | 96 | 96 | 0 |
| `@letbuyy/lcis-cli` | 89 | 89 | 0 |
| `@letbuyy/lcis-mcp` | 89 | 89 | 0 |
| **Total** | **1046** | **1046** | **0** |

All packages typecheck clean. `pnpm --filter "@letbuyy/lcis-execution" build` passes.

---

## Workspace and Dependency Changes

### New `package.json` at `packages/lcis-execution/`

```json
{
  "name": "@letbuyy/lcis-execution",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "dependencies": {
    "@letbuyy/lcis-core": "workspace:*",
    "@letbuyy/lcis-live": "workspace:*",
    "zod": "^4.3.6"
  }
}
```

### Extended packages gained `@letbuyy/lcis-execution: workspace:*`

`@letbuyy/lcis-cli`, `@letbuyy/lcis-mcp`, `services/lcis-api`, and `@letbuyy/lcis-pr-check` each added `@letbuyy/lcis-execution` to their dependencies.

### No breaking changes

- All existing lcis-core, lcis-adapters, lcis-live exports are unchanged.
- Existing CLI commands, MCP tools, API routes, and `analyzePr()` behavior are unchanged.
- `analyzePr()` returns `verdicts: []` (the field existed but was empty in Phase 3 types); `analyzeWithVerdicts()` is the new async entry point that populates it.
- The governance validator (`scripts/validate-governance.mjs`) passes without modification.
- The 107 deterministic validators are unaffected.

---

## Graphify-out Dependency

The EIS reads three graphify-out artifacts at startup via `getEngine()`:

| Artifact | Used by |
|----------|---------|
| `graphify-out/db-intel.json` | Money/tenant table flags; table names for seed matching; FK relationships |
| `graphify-out/domain-intel.json` | Domain keys/labels for seed matching; blast radius via `engine.blast.impact()` |
| `graphify-out/graph.json` | Symbol blast radius via `engine.blast.blast()`; test file discovery via `engine.graph.search()` |
| `graphify-out/relationship-intel.json` | FK fan-in/fan-out for migration data-loss risk |

If any required artifact is missing, `createEngine()` (lcis-core) will throw on load. Run `pnpm graph:update` to regenerate.

---

## Evidence Connectivity

EIS plans are structural-only. The `NOT_CONNECTED` honesty contract from Phases 1–3 applies:

- Live adapter credentials (`SUPABASE_URL`, `GITHUB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `VERCEL_TOKEN`) are not read by the EIS at plan time.
- Plan derivation uses only the pre-computed graphify-out artifacts and the lcis-core graph engine.
- The `confidence` score never exceeds 0.95 regardless of artifact completeness.
- `unresolved: true` plans carry confidence near 0 and cite `'unresolved'` in evidence.

---

## Future Roadmap (Deferred)

The following were scoped out of Phase 4:

| Item | Status |
|------|--------|
| Wire `analyzeWithVerdicts()` into GitHub PR Action workflow | Deferred — function built and tested |
| `apps/lcis` — browser UI surface for EIS plans | Reserved-until-earned per master architecture |
| Live launch signals in `LaunchIntelligenceService` | Deferred — structural signals only for now; live adapter wiring is a separate milestone |
| LLM-backed reasoning layer over EIS plans | Not in scope for Phase 4; deterministic planning is the foundation |
| Incremental re-analysis (diff-based) | Not in scope; full re-analysis on each call |
