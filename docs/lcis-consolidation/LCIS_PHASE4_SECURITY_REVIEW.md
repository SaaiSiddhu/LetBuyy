# LCIS Phase-4 Security Review — Deliverable 12
## Execution Intelligence System (EIS) — Read-Only Guarantee Verification

**Reviewer:** Claude Code (automated static analysis)
**Date:** 2026-06-20
**Scope:** Phase-4 additions — `packages/lcis-execution/src/**`, Phase-4 additions in `packages/lcis-cli/src/cli.ts` (plan group), `packages/lcis-mcp/src/tools.ts` (lcis_plan_* tools), `services/lcis-api/src/app.ts` (POST /plan/* routes), `packages/lcis-pr-check/src/*` (V2 verdicts).
**Verdict:** **READ-ONLY ENFORCED.** No real violations found. All apparent hits are comment/string literals or explicitly scoped CLI-output exports.

---

## 1. Executive Verdict

The Phase-4 Execution Intelligence System is read-only. Every service in `packages/lcis-execution/src/` consumes data exclusively via `@letbuyy/lcis-core`'s read-only `ArtifactStore`, `BlastRadiusService`, `GraphService`, and `MemoryService`. No service imports `node:fs`, `node:child_process`, `node:net`, or any other I/O module. No DB mutation operators appear in any EIS source file. No autonomous background loops exist. No `eval` or `new Function` appears anywhere in Phase-4 source.

The two `writeFileSync` occurrences in the codebase are:
1. `packages/lcis-cli/src/format.ts:237` — the `exportToFile()` helper, gated entirely by the user's explicit `--export <file>` CLI flag. This is user-directed output, not autonomous mutation. The function writes only the pre-serialized plan text the user requested.
2. `packages/lcis-pr-check/src/cli.ts:100` — similarly gated by `--out <file>`, user-explicit. Not in the EIS core.

Neither is present in `packages/lcis-execution/src/` at all (confirmed: zero `node:` imports there).

---

## 2. Per-Area Scan Results

| Area | Patterns Searched | Count | Verdict | Notes |
|---|---|---|---|---|
| `packages/lcis-execution/src/**` | `writeFile`, `writeFileSync`, `appendFile`, `createWriteStream` | **0** | PASS | No `node:fs` in any EIS source file |
| `packages/lcis-execution/src/**` | `child_process`, `spawn(`, `exec(`, `execSync` | **0** | PASS | All hits are comment text (e.g. `"NO fetch/child_process/spawn..."`) in JSDoc — not executable |
| `packages/lcis-execution/src/**` | `eval(`, `new Function(` | **0** | PASS | None anywhere |
| `packages/lcis-execution/src/**` | `.insert(`, `.update(`, `.delete(`, `.upsert(`, `drop`, `alter` | **0** | PASS | No DB mutation operators; `Map.prototype.delete` absent too |
| `packages/lcis-execution/src/**` | `node:fs`, `node:child_process`, `node:net` | **0** | PASS | Confirmed zero node: imports; all data access via `lcis-core` |
| `packages/lcis-execution/src/**` | `wrangler`, `vercel deploy`, `gh-deploy` | **1 hit** | PASS (string) | `VerificationPlanner.ts:70` — value is a plan description string: `postDeployChecks.push('queue workers healthy: wrangler tail on queue-workers...')`. A string stored in a `string[]` array; no shell call |
| `packages/lcis-execution/src/**` | `setInterval`, `setTimeout`, `while.*true`, background loops | **0** | PASS | No autonomous loops |
| `packages/lcis-execution/src/**` | `fetch(`, HTTP network egress | **0** | PASS | Network access is only in `@letbuyy/lcis-live` (live adapters); EIS only reads from in-process ArtifactStore |
| `packages/lcis-cli/src/cli.ts` (plan group, lines 884–1149) | All forbidden patterns above | **0 real** | PASS | Comment at line 887 contains "no fetch/exec/spawn/writeFile/network" as documentation only |
| `packages/lcis-cli/src/format.ts` | `writeFile`, `writeFileSync` | **1** (`format.ts:237`) | SCOPED | `exportToFile()` called only when user passes `--export <file>`; not in EIS core |
| `packages/lcis-mcp/src/tools.ts` (lcis_plan_* tools) | All forbidden patterns above | **0** | PASS | Tools call `getEisEngine()` + `.analyze()` / `.planImplementation()` etc. — all read-only EIS methods |
| `services/lcis-api/src/app.ts` (POST /plan/* routes) | All forbidden patterns above | **0** | PASS | Routes call `getEisEngine()` + EIS read methods; all responses are `c.json(envelope(...))` |
| `packages/lcis-pr-check/src/analyze.ts` | All forbidden patterns above | **0 real** | PASS | `readFileSync` / `writeFileSync` are in `src/cli.ts` only, not `src/analyze.ts`; analyze is pure |
| `packages/lcis-pr-check/src/cli.ts` | `writeFileSync` | **1** (line 100) | SCOPED | Gated by `if (out !== null)` after user passes `--out <file>`; not in EIS core |

**Comment/string false-positives — explicitly called out:**

All grep hits for forbidden words in `packages/lcis-execution/src/` are in JSDoc block comments or `postDeployChecks.push(...)` string literals that describe what an *operator* should do after LCIS produces a plan. They are not executable calls. Stripped of comments and strings, zero forbidden patterns exist in EIS source.

---

## 3. Structural Argument: No Mutation Is Representable

The `EisEngine` interface (defined in `packages/lcis-execution/src/engine.ts`) exposes exactly these methods:

```
analyze(req: ChangeRequest): ChangeAnalysis
planAll(req: ChangeRequest): Promise<FullPlan>
```

And six sub-services (`execution`, `executionGraph`, `migration`, `testing`, `rollback`, `launch`, `verification`) each exposing only plan-producing methods:

- `planImplementation()` → `ExecutionPlan`
- `build()` → `ExecutionGraph`
- `analyzeMigration()` → `MigrationPlan`
- `generateTestPlan()` → `TestPlan`
- `generateRollbackPlan()` → `RollbackPlan`
- `evaluateLaunch()` → `LaunchPlan`
- `buildVerificationPlan()` → `VerificationPlan`

**None of these method signatures accept a write target, a database handle, a file path, a deployment token, or any effector.** The return types are all frozen readonly value objects (`readonly` fields, defined in `shared/types.ts`). There is no `execute()`, `deploy()`, `apply()`, `migrate()`, or `mutate()` method on any EIS class. The type system makes mutation literally un-representable at the EIS API surface.

Internally, all services call `this.engine.store.tryRead<T>(artifact)`, `this.engine.blast.impact()`, `this.engine.graph.search()`, or `this.engine.memory.search()` — all read-only methods defined and enforced in `@letbuyy/lcis-core`. The `ArtifactStore.tryRead()` method returns a deserialized in-memory value or `null`. It has no write path.

**The mandate is therefore enforced at three independent layers:**
1. **Import layer** — no `node:fs`, `node:child_process`, `node:net` in `lcis-execution/src/`.
2. **API surface layer** — all public methods return plan types; no effector method exists.
3. **Dependency layer** — `lcis-execution/package.json` depends only on `@letbuyy/lcis-core`, `@letbuyy/lcis-live`, and `zod`. No shell, DB client, HTTP client, or deployment SDK is a dependency.

LCIS plans. Agents (humans or automation) execute.

---

## 4. Honesty Contract

Every EIS output carries the mandatory `PlanArtifact` fields stamped by `plan()` in `shared/envelope.ts`:

| Field | Guarantee |
|---|---|
| `evidence: readonly Evidence[]` | Every affected entity has an evidence citation pointing to the graphify-out artifact it came from |
| `confidence: number` | Structural-only, 0..0.95. Zero when no evidence; capped at 0.95 — LCIS never claims certainty |
| `sources: readonly string[]` | Deduped list of artifact files that fed this plan |
| `timestamp: string` | ISO-8601 when the plan was generated |

Additional honesty constraints enforced in code:

- **Unknown stays UNKNOWN.** `LaunchIntelligenceService` returns `UNKNOWN` state on blockers when `launch-command-center.json` is absent, not a silent PASS. `LaunchChecklistItem.status` is explicitly `'UNKNOWN'` when a live value cannot be determined.
- **NOT_CONNECTED + exact env var.** Live adapter values (Supabase/GitHub/Cloudflare/Vercel) are surfaced as `NOT_CONNECTED` with the exact missing env var name (e.g. `SUPABASE_SERVICE_ROLE_KEY`), never fabricated.
- **Migration DDL cannot be inspected.** `MigrationIntelligenceService` carries the `DDL_HONESTY` constant in every data-loss finding: "LCIS cannot inspect the actual migration SQL — this risk is derived structurally from table properties." This is a code constant, not optional documentation.
- **Unresolved requests are honest.** When `SeedResolver` matches nothing, `ChangeAnalysis.unresolved = true` and plans are empty rather than fabricated.
- **`simulatedImpact` is labelled a simulation.** Every call path in `MigrationIntelligenceService.simulateMigrationImpact()` prefixes its return with `[SIMULATION — LCIS does NOT execute migrations]`.

---

## 5. Threat Model

| Capability | Present in Phase-4 EIS? | Mitigation / Why Impossible |
|---|---|---|
| Write to filesystem | NO in EIS core | Zero `node:fs` imports in `lcis-execution/src/`; `writeFileSync` only in CLI output helpers, user-gated by `--export` / `--out` |
| Execute shell commands | NO | No `node:child_process`, `spawn`, `exec`, `execSync` anywhere in Phase-4 |
| Deploy via wrangler/vercel | NO | The word "wrangler" appears once as a string in a `postDeployChecks` array — human instruction text, not an API call |
| DB mutation (insert/update/delete/upsert) | NO | Zero `.insert(`, `.update(`, `.delete(`, `.upsert(` in EIS source; canonical-ledger-only-validator forbids them in TS at the platform level too |
| DDL execution (drop/alter) | NO | `drop`/`alter` are absent from EIS source; `MigrationPlan.simulatedImpact` explicitly labels itself non-executing |
| eval / dynamic code | NO | `eval(` and `new Function(` are absent from all Phase-4 source |
| Autonomous background loops | NO | No `setInterval`, `setTimeout`, or infinite-loop patterns in EIS |
| Provider write APIs (Supabase/GitHub/Cloudflare/Vercel) | NO | EIS does not call any live adapter at all; CLI/MCP/API call `@letbuyy/lcis-live` adapters which are declared read-only |
| Network egress added in Phase-4 | NO | EIS services read from in-process ArtifactStore only; live adapter calls are in `@letbuyy/lcis-live` (pre-existing read-only path) |
| Secret exfiltration | NO | No HTTP client, no file write, no subprocess in EIS; no secrets are in plan outputs |
| Injection via plan text | LOW RISK | Plan strings are generated from deterministic graph data; never eval'd; displayed as documentation |

---

## 6. How the Guarantee Is Enforced Going Forward

### Per-service read-only scan tests (already present)

Each service in `packages/lcis-execution/` has a co-located test file that includes a read-only source scan test. These tests fail the test suite if the listed forbidden patterns appear in the source:

| Service | Test file | Forbidden patterns scanned |
|---|---|---|
| `src/execution/` | `test/execution.test.ts:48` | `fetch(`, `child_process`, `spawn(`, `exec(`, `eval(`, `writeFile`, `appendFile` |
| `src/migration/` | `test/migration.test.ts:467` + `test/migration.test.ts:480` | `fetch(`, `spawn(`, `exec(`, `eval(`, `writeFile(`, `appendFile(`, `child_process`; also `node:net`, `node:http`, `node:https` |
| `src/testing/` | `test/testing.test.ts:34` | `execSync`, `spawnSync`, `exec(`, `spawn(`, `writeFile`, `appendFile`, `eval(`, `http.get`, `https.get`, `child_process` |
| `src/rollback/` | `test/rollback.test.ts:424` | `fetch(`, `writeFile`, `appendFile`, `spawn(`, `exec(`, `eval(`, `child_process` |
| `src/launch/` | `test/launch.test.ts:410` | `child_process` import, `spawn()`, `eval()`, `fs.writeFile`, `writeFileSync` |

These tests run as part of `pnpm --filter @letbuyy/lcis-execution test` and must remain green. Any future contributor adding a forbidden import will fail CI immediately.

### This review document

This document (`LCIS_PHASE4_SECURITY_REVIEW.md`) is the Deliverable 12 record for Phase-4. It must be updated whenever:
- New services or methods are added to `packages/lcis-execution/src/`.
- New plan endpoints are added to `services/lcis-api/src/app.ts`, `packages/lcis-cli/src/cli.ts`, or `packages/lcis-mcp/src/tools.ts`.
- Any `node:` import is added to any Phase-4 package.

---

## 7. Summary of Key File Locations

| Component | Path |
|---|---|
| EIS type vocabulary (frozen contract) | `packages/lcis-execution/src/shared/types.ts` |
| EIS facade + `EisEngine` interface | `packages/lcis-execution/src/engine.ts` |
| EIS plan provenance stamper | `packages/lcis-execution/src/shared/envelope.ts` |
| Migration DDL-honesty constant | `packages/lcis-execution/src/migration/MigrationIntelligenceService.ts` (`DDL_HONESTY`) |
| CLI `--export` scoped write | `packages/lcis-cli/src/format.ts:237` (`exportToFile`) |
| PR check `--out` scoped write | `packages/lcis-pr-check/src/cli.ts:100` |
| Read-only scan tests (per-service) | `packages/lcis-execution/test/{execution,migration,testing,rollback,launch}.test.ts` |
| Phase-4 MCP tools | `packages/lcis-mcp/src/tools.ts` (lines 499–621) |
| Phase-4 API routes | `services/lcis-api/src/app.ts` (lines 598–728) |
| Phase-4 CLI plan group | `packages/lcis-cli/src/cli.ts` (lines 884–1149) |
| Phase-4 PR verdicts | `packages/lcis-pr-check/src/analyze.ts` (`buildVerdicts`, `analyzeWithVerdicts`) |

---

*This review was produced by static analysis of source files without executing any code. No code was modified during this review.*
