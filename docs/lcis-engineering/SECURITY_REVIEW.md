# EINS (Engineering Intelligence System) — Phase 7 Security Review

**Date:** 2026-06-21
**Reviewer:** LCIS Security Audit (automated, read-only scan)
**Scope:** `packages/lcis-engineering/src/**`, Phase-7 additions in `packages/lcis-cli/src/cli.ts`, `packages/lcis-mcp/src/tools.ts`, `services/lcis-api/src/app.ts`, `packages/lcis-pr-check/src/*`
**Mandate:** Verify the read-only guarantee. EINS plans / analyzes / verifies / recommends — it NEVER executes, generates code, modifies files, runs migrations, or deploys.

---

## 1. Executive Verdict

**READ-ONLY ENFORCED across the EINS core (`packages/lcis-engineering/src/`).** 29 source files, 11 test files. Zero live-code violations of any dangerous pattern. Every suspicious keyword found in source code is inside a JSDoc `READ-ONLY P0 contract` comment that explicitly documents the prohibition — not a capability.

**Phase-7 surface additions** (CLI commands, MCP tools, API routes) are also clean: no shell execution, no DB mutations, no `eval`, no unauthorized network. One narrow **confirmed finding** in the PR-check CLI and one minor **confirmed finding** in the main CLI: user-controlled file-write paths (`--out` / `--export`) accept arbitrary filesystem paths without sanitization. This is a write-to-arbitrary-path capability on the host filesystem, not a safety violation of the read-only contract (which concerns the codebase and DB), but warrants a hardening note.

Three **minor contract gaps** exist in the composition layer (provenance fields not always attached to intermediate types) — documented below. None are security issues.

---

## 2. Per-Area Scan Results

> Legend — Verdict: CLEAN = no live-code hit; NOTE = false-positive (comment/string); FINDING = real issue.

### 2a. `packages/lcis-engineering/src/` (29 files)

| Pattern | Occurrences | In live code | Verdict | Notes |
|---|---|---|---|---|
| `writeFile` / `appendFile` / `createWriteStream` | 5 | 0 | CLEAN | All 5 in JSDoc `READ-ONLY P0 contract` headers. E.g. `src/launch/LaunchIntelligenceService.ts:10`, `src/agent/AgentIntelligenceService.ts:7`, `src/verification/VerificationIntelligenceService.ts:12`, `src/feature/FeatureIntelligenceService.ts:9`, `src/migration/MigrationIntelligenceService.ts:9` |
| `child_process` / `spawn(` / `exec(` / `execSync` | 3 | 0 | CLEAN | Same JSDoc headers as above |
| `eval(` / `new Function(` | 0 | 0 | CLEAN | No occurrences anywhere |
| `.insert(` / `.update(` / `.delete(` / `.upsert(` | 0 | 0 | CLEAN | No DB mutation operators |
| `import node:fs` / `import node:child_process` / `import node:net` / `import node:http` | 0 | 0 | CLEAN | Zero Node.js built-in imports |
| `fetch(` / `axios` / `http.get` / `https.get` | 0 | 0 | CLEAN | No direct network calls |
| `migrate(` / `deploy(` / `runMigration(` as calls | 2 | 0 | NOTE | `src/task/TaskIntelligenceService.ts:243` — string literal task title; `src/verification/VerificationIntelligenceService.ts:6` — JSDoc comment |

**All imports** in `lcis-engineering` are either `@letbuyy/lcis-*` monorepo packages or relative `../shared/*` imports. The package has no external dependencies and no Node.js built-ins.

### 2b. `packages/lcis-cli/src/cli.ts` (1807 lines, Phase-7 engineering subcommands)

| Pattern | Occurrences | In live code | Verdict | Notes |
|---|---|---|---|---|
| `writeFile` / `appendFile` | 1 (indirect) | 1 | FINDING (low) | `exportToFile(exportPath, ...)` at line 83 delegates to `format.ts:writeFileSync`. `exportPath` is taken verbatim from `--export <file>` argv. No path sanitization. |
| `child_process` / `spawn` / `exec` | 0 | 0 | CLEAN | — |
| `eval(` / `new Function(` | 0 | 0 | CLEAN | — |
| `.insert(` / `.update(` / `.delete(` (DB) | 0 | 0 | CLEAN | — |
| `import node:fs` | 0 | 0 | CLEAN | fs access is in `format.ts`, not the CLI entry |
| `fetch(` / direct network | 0 | 0 | CLEAN | Delegated to `@letbuyy/lcis-live` |
| `node:url` dynamic import | 1 | 1 | NOTE | Line 1801: `import('node:url')` for shebang entry-point guard only. Not I/O. |

**Engineering subcommands registered:** `engineering`, `blueprint`, `tasks`, `rollout`, `rollback`, `eng-verify`, `agent-plan` (7 total, lines 1609–1746). All are analysis-only; handlers call `getEngineeringEngine()` methods and print results.

### 2c. `packages/lcis-mcp/src/tools.ts` (1224 lines, Phase-7 MCP tools)

| Pattern | Occurrences | In live code | Verdict | Notes |
|---|---|---|---|---|
| `writeFile` / `appendFile` | 0 | 0 | CLEAN | — |
| `child_process` / `spawn` / `exec` | 0 | 0 | CLEAN | — |
| `eval(` / `new Function(` | 0 | 0 | CLEAN | — |
| `.insert(` / `.update(` / `.delete(` (DB) | 0 | 0 | CLEAN | — |
| `import node:*` | 0 | 0 | CLEAN | — |
| `fetch(` / direct network | 0 | 0 | CLEAN | Delegated to `createLivePlatform()` |

**`lcis_engineering_*` tools registered (7):** `lcis_engineering_blueprint`, `lcis_engineering_tasks`, `lcis_engineering_rollout`, `lcis_engineering_verification`, `lcis_engineering_rollback`, `lcis_engineering_agent_plan`, `lcis_engineering_package` (lines 1067–1171, array at 1216–1222). Each handler calls `getEngineeringEngine()` and returns structured analysis only.

### 2d. `services/lcis-api/src/app.ts` (1190 lines, Phase-7 HTTP routes)

| Pattern | Occurrences | In live code | Verdict | Notes |
|---|---|---|---|---|
| `writeFile` / `appendFile` | 0 | 0 | CLEAN | — |
| `child_process` / `spawn` / `exec` | 0 | 0 | CLEAN | — |
| `eval(` / `new Function(` | 0 | 0 | CLEAN | — |
| `.insert(` / `.update(` / `.delete(` (DB) | 0 | 0 | CLEAN | — |
| `import node:*` | 0 | 0 | CLEAN | — |
| `fetch(` / direct network | 0 | 0 | CLEAN | Delegated to `createLivePlatform()` |

**`/engineering/*` routes registered (7):** `POST /engineering/blueprint`, `/engineering/tasks`, `/engineering/verification`, `/engineering/rollback`, `/engineering/rollout`, `/engineering/agent-plan`, `/engineering/package` (lines 1047–1170). All use `validateBody(EngineeringSchema)` (Zod: `{ text: string, domains?, tables?, symbols? }`). All return structured plans/findings only.

### 2e. `packages/lcis-pr-check/src/` (6 files, Phase-7 PR verdicts)

| File | Pattern | Line | Verdict | Notes |
|---|---|---|---|---|
| `cli.ts` | `import { readFileSync, writeFileSync }` | 14 | FINDING | `writeFileSync(out, output, 'utf8')` at line 100; `out` taken verbatim from `--out <argv>`. No path-traversal guard. |
| `cli.ts` | `readFileSync(path, 'utf8')` | 53 | FINDING (low) | `--files-from` path taken verbatim. If argv is attacker-controlled in CI, arbitrary files readable. |
| `cli.ts` | `child_process` / `spawn` / `exec` | — | CLEAN | None |
| `analyze.ts` | All patterns | — | CLEAN | No I/O of any kind. Pure analysis over loaded data. |
| `comment.ts` | All patterns | — | CLEAN | Pure string rendering. |
| `domain-map.ts` | All patterns | — | CLEAN | Pure static map. |
| `types.ts` | All patterns | — | CLEAN | Types only. |

---

## 3. Structural Argument: "No Mutation is Representable"

EINS surfaces exactly five output types. Their definitions from `src/shared/types.ts`:

```
EngineeringImpact   extends EngineeringArtifact   — all readonly fields
EngineeringFinding                                 — all readonly fields
EngineeringTask                                    — all readonly fields
EngineeringBlueprint extends EngineeringArtifact   — all readonly fields
EngineeringPackage   extends EngineeringArtifact   — all readonly fields
```

None of these types carry an effector method. There is no `.execute()`, `.apply()`, `.deploy()`, `.migrate()`, `.run()`, or `.mutate()` method on any EINS output type. The type system makes mutation not just absent — it is not representable in the exported API surface.

**`EngineeringArtifactStore`** (the sole data accessor in `src/shared/artifact-store.ts`) exposes only: `domains()`, `domain(key)`, `raw(name)`, `has(name)`. Every method is a `tryRead(...)` delegate to `lcis-core`. No write, insert, update, or mutation method exists.

**`EngineeringGraphService`** (`src/graph/EngineeringGraphService.ts`) performs a pure in-memory Kahn topological sort and longest-path DP over an already-loaded `readonly EngineeringTask[]`. No external I/O. The `_core` reference stored at construction is unused in `build()`.

EINS plans. Humans and agents execute.

---

## 4. Reuse / Composition Contract

Every service in `lcis-engineering` is a thin intelligence layer over the three prior read-only engines. The composition chain is:

```
lcis-engineering
  └─ lcis-execution  (EIS)    — change analysis, migration plans, test plans, rollback plans, launch evaluation
  └─ lcis-governance (GDIS)   — compliance/drift checks surfaced in verification gates
  └─ lcis-operations (LCOS)   — runtime/commerce state surfaced in launch blockers and operational impact
  └─ lcis-core               — graph store, domain intel, db-intel (read-only store accessor)
```

**Reuse citation pattern** — verified present in 7 of 8 services:

| Service | Delegation call | Reuse evidence cited |
|---|---|---|
| `FeatureIntelligenceService` | `this.eis.analyze(req)` | `ev.reuse('lcis-execution', 'eis.analyze', ...)` |
| `ChangeIntelligenceService` | `this.eis.analyze(req)` | `ev.reuse('lcis-execution', 'eis.analyze', ...)` + per-finding |
| `MigrationIntelligenceService` | `this.eis.migration.analyzeMigration(req)` | `ev.reuse('lcis-execution', 'eis.migration.*', ...)` |
| `VerificationIntelligenceService` | `this.eis.testing.generateTestPlan(req)` | Cited but discarded on `acceptanceCriteria()` (see gap below) |
| `LaunchIntelligenceService` | `this.eis.launch.evaluateLaunch(req)` | `ev.reuse(...)` per finding with `NOT_CONNECTED` flag |
| `RollbackIntelligenceService` | `this.eis.rollback.generateRollbackPlan(req)` | `ev.reuse(...)` per finding |
| `TaskIntelligenceService` | `this.eis.analyze(req)` + `eis.migration.*` | `ev.reuse(...)` per task |
| `AgentIntelligenceService` | operates on pre-composed `EngineeringTask[]` | `engineering()` wrapper stamps artifact envelope |

The only net-new logic introduced by EINS is: (a) task ordering (priority/phase assignment) in `TaskIntelligenceService`; (b) graph topology synthesis (Kahn sort + critical path) in `EngineeringGraphService`. Both are pure in-memory computation — no new data is fetched or written.

**Honest empty results** — every service returns `[]` / `unresolved: true` rather than fabricated data when the upstream engine returns nothing. This is verified across all 8 services.

---

## 5. Minor Provenance Contract Gaps

These are not security issues. They are contract-consistency observations for the engineering team.

| Gap | Location | Severity |
|---|---|---|
| `acceptanceCriteria()` in `VerificationIntelligenceService` calls `void this.ev.reuse(...)` — evidence objects created but silently discarded; `string[]` return carries no provenance | `src/verification/VerificationIntelligenceService.ts` | Low |
| `EngineeringFinding` type carries `confidence` + `evidence` but not `sources` or `timestamp` — partial `EngineeringArtifact` adherence | `src/shared/finding.ts` | Low |
| `EngineeringTask` type carries only `evidence` — no `confidence`, `sources`, `timestamp` at the individual task level (all four appear only after tasks are wrapped into `AgentPlan` or `EngineeringGraph`) | `src/shared/types.ts` | Low |
| `planMigration()` and `planRollback()` return raw `MigrationPlan` / `RollbackPlan` from lcis-execution, not an `EngineeringArtifact` wrapper — provenance envelope belongs to the prior system | `src/migration/MigrationIntelligenceService.ts`, `src/rollback/RollbackIntelligenceService.ts` | Low |
| `operationalImpact()` in `LaunchIntelligenceService` returns `string[]` — live-data note embedded inline in each string, no structured provenance envelope | `src/launch/LaunchIntelligenceService.ts` | Low |

---

## 6. Threat-Model Table

| Capability | Present in EINS? | Why Impossible |
|---|---|---|
| Write to filesystem (source code, config, migrations) | No | No `node:fs` import in `lcis-engineering`. `writeFile`/`appendFile` appear only in JSDoc `READ-ONLY P0` contract headers. |
| Execute shell commands / spawn processes | No | No `child_process`, `spawn`, `exec`, `execSync` anywhere in `lcis-engineering`. |
| Evaluate arbitrary code | No | No `eval()` or `new Function()` anywhere in the scanned surface. |
| Mutate the database | No | No `.insert(`, `.update(`, `.delete(`, `.upsert(` in any EINS service. Money mutations require `SECURITY DEFINER` RPCs via `db.rpc` (separate canonical-ledger boundary, unreachable from EINS). |
| Make outbound network requests | No | No `fetch(`, `axios`, or direct `http`/`https` in `lcis-engineering`. External I/O is delegated exclusively to `@letbuyy/lcis-live` adapters in the prior engine layer. |
| Run database migrations | No | No migration executor; `planMigration()` returns an analysis artifact. Migration execution is a human/agent step outside EINS. |
| Deploy to infrastructure | No | No deploy invocation. `deploy` appears only as a string in a task title. |
| Store persistent state | No | `EngineeringArtifactStore` is a read-only wrapper over `lcis-core`'s read-only store. No write path exists. |
| Write to arbitrary paths via CLI `--export` | Yes (low) | `lcis-cli/src/cli.ts:83` and `lcis-pr-check/src/cli.ts:100` — user-controlled path passed to `writeFileSync` without sanitization. Scoped to explicit user invocation with a flag; not autonomous. See hardening note below. |
| Read from arbitrary paths via CLI `--files-from` | Yes (low) | `lcis-pr-check/src/cli.ts:53` — user-controlled path passed to `readFileSync`. Same scope caveat. |

---

## 7. Test Coverage — Read-Only Contract Tests

All 9 mandated per-service read-only scan tests are confirmed present, plus 2 additional tests:

| Test file | Confirmed |
|---|---|
| `test/feature.test.ts` | Yes |
| `test/change.test.ts` | Yes |
| `test/migration.test.ts` | Yes |
| `test/verification.test.ts` | Yes |
| `test/launch.test.ts` | Yes |
| `test/rollback.test.ts` | Yes |
| `test/task.test.ts` | Yes |
| `test/agent.test.ts` | Yes |
| `test/graph.test.ts` | Yes |
| `test/engine.test.ts` | Yes (additional) |
| `test/foundation.test.ts` | Yes (additional) |

---

## 8. Findings Summary

### CONFIRMED FINDINGS (2, severity: low)

**F-01 — Unsanitized write path in `lcis-pr-check` CLI**
- File: `packages/lcis-pr-check/src/cli.ts:100`
- Pattern: `writeFileSync(out, output, 'utf8')` where `out` is taken verbatim from `--out <argv>`.
- Risk: In automated CI pipelines where the `--out` argument is derived from PR metadata (branch name, labels, commit messages), an attacker with PR write access could supply a path-traversal string and overwrite files on the CI runner.
- Recommendation: Normalize the path with `path.resolve()` and restrict it to a known safe output directory (e.g., `path.resolve(process.cwd(), basename(out))`).

**F-02 — Unsanitized write path in `lcis-cli` `--export` flag**
- File: `packages/lcis-cli/src/cli.ts:83` → `format.ts:writeFileSync`
- Pattern: `exportToFile(exportPath, ...)` where `exportPath` comes from `--export <argv>`.
- Risk: Same class as F-01; lower severity because the LCIS CLI is typically run by a developer interactively, not in automated pipelines where argv is untrusted.
- Recommendation: Same path normalization as F-01.

### FALSE POSITIVES (all resolved)

| Keyword | File:Line | Classification |
|---|---|---|
| `writeFile` | `src/launch/LaunchIntelligenceService.ts:10` | JSDoc comment |
| `writeFile` | `src/agent/AgentIntelligenceService.ts:7` | JSDoc comment |
| `writeFile` | `src/verification/VerificationIntelligenceService.ts:12` | JSDoc comment |
| `writeFile` | `src/feature/FeatureIntelligenceService.ts:9` | JSDoc comment |
| `writeFile` | `src/migration/MigrationIntelligenceService.ts:9` | JSDoc comment |
| `child_process` | `src/agent/AgentIntelligenceService.ts:7` | JSDoc comment |
| `child_process` | `src/verification/VerificationIntelligenceService.ts:12` | JSDoc comment |
| `child_process` | `src/feature/FeatureIntelligenceService.ts:9` | JSDoc comment |
| `deploy` | `src/task/TaskIntelligenceService.ts:243` | String literal (task title) |
| `deploy` | `src/verification/VerificationIntelligenceService.ts:6` | JSDoc comment |
| `node:url` | `packages/lcis-cli/src/cli.ts:1801` | Shebang guard only |

---

## 9. Enforcement Going Forward

1. **Per-service read-only scan tests** (11 test files) are the primary regression gate. They must remain in CI.
2. **No-IO boundary**: `packages/lcis-engineering` MUST NOT add `node:fs`, `node:child_process`, `node:net`, `node:http`, or any direct `fetch(` call. All data access must go through the prior engine layer (`lcis-core` / `lcis-execution` / `lcis-governance` / `lcis-operations`).
3. **F-01 / F-02 hardening**: Before the next release, add path normalization to `lcis-pr-check/src/cli.ts:100` and `lcis-cli/src/format.ts:writeFileSync` callsite.
4. **Provenance gaps**: Consider attaching the `engineering()` envelope to `acceptanceCriteria()` return, or documenting the omission explicitly. This is a contract-quality concern, not a security finding.
5. **This document** should be refreshed after any change to `packages/lcis-engineering/**`, `packages/lcis-cli/src/cli.ts` (engineering commands), `packages/lcis-mcp/src/tools.ts` (`lcis_engineering_*`), or `services/lcis-api/src/app.ts` (`/engineering/*`).

---

## 10. Conclusion

**EINS Phase 7 read-only guarantee is structurally enforced.** The core package (`packages/lcis-engineering`) has zero capability to write files, spawn processes, evaluate code, mutate the database, or make outbound network calls. This is enforced at three levels: (1) no dangerous imports, (2) no effector methods on any output type, (3) per-service test coverage. The `EngineeringArtifactStore` is a typed reader with no write surface. The graph synthesis and task ordering are pure in-memory computation. EINS plans; humans and agents execute.

Two low-severity file-write path findings exist in the CLI surface layer (F-01, F-02). These are scoped to explicit user-invoked flags and do not represent autonomous write capability, but should be hardened before CI automation relies on them.

Five minor provenance contract gaps exist in intermediate output types — not security issues, but worth addressing for API consistency.

**Overall verdict: APPROVED with two low-severity hardening items (F-01, F-02).**
