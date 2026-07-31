# LCIS Phase-5 (GDIS) Security Review

**Reviewer:** Claude Sonnet 4.6 (automated, verification-only mandate)
**Date:** 2026-06-20
**Scope:** Governance & Drift Intelligence System — packages/lcis-governance, packages/lcis-cli (governance additions), packages/lcis-mcp (governance tools), services/lcis-api (governance routes), packages/lcis-pr-check
**Mandate:** Verification and documentation only — no source files modified.

---

## 1. Executive Verdict

**READ-ONLY ENFORCED — with two explicitly-permitted and correctly-scoped write exceptions.**

The GDIS core (`packages/lcis-governance/src/`) contains zero instances of any forbidden pattern: no filesystem writes, no shell execution, no dynamic code evaluation, no DB mutations, no DDL, and no direct Node stdlib IO imports. Every service is a pure deterministic reasoner over lcis-core's read-only artifact store.

The two write operations found in the broader LCIS codebase are **intentional, user-initiated, output-export mechanisms** — not governance service capabilities:

1. `packages/lcis-cli/src/format.ts:237` — `writeFileSync` inside `exportToFile()`, called only when the user explicitly passes `--export <file>` to the CLI. This is report serialization, not a governance service side-effect.
2. `packages/lcis-pr-check/src/cli.ts:100` — `writeFileSync` called only when `--out <file>` is explicitly provided. Same pattern: user-directed report export.

Neither write path is reachable from any GDIS service method. The `GovernanceEngine`, `DriftDetectionService`, `ComplianceService`, `OwnershipService`, `ReadinessService`, and `SecurityDriftService` are all incapable of reaching these export paths — they are invoked by the CLI layer only on explicit user flag.

---

## 2. Per-Area Scan Results

All patterns were searched across:
- `packages/lcis-governance/src/` (all 16 source files)
- `packages/lcis-cli/src/` (cli.ts, format.ts, index.ts)
- `packages/lcis-mcp/src/` (tools.ts, server.ts, index.ts)
- `services/lcis-api/src/` (app.ts, middleware.ts, server.ts, index.ts)
- `packages/lcis-pr-check/src/` (analyze.ts, cli.ts, comment.ts, domain-map.ts, types.ts, index.ts)

### 2a. Filesystem Writes

| Pattern | Files Matched | Hit Count | Verdict |
|---------|---------------|-----------|---------|
| `writeFile` | `packages/lcis-cli/src/format.ts:5,237` | 2 | PERMITTED — comment in `OwnershipService.ts:6` is documentation |
| `writeFileSync` | `packages/lcis-cli/src/format.ts:237`, `packages/lcis-pr-check/src/cli.ts:14,100` | 3 | PERMITTED — see below |
| `appendFile` | none | 0 | CLEAN |
| `createWriteStream` | none | 0 | CLEAN |
| `mkdirSync` | none | 0 | CLEAN |

**False positives (string/comment mentions that are documentation, not capability):**
- `packages/lcis-governance/src/ownership/OwnershipService.ts:6` — `"no writeFile"` appears in the JSDoc comment block describing what the service does NOT do. Not a capability hit.
- `packages/lcis-cli/src/cli.ts:888,1156` — `"no fetch/exec/spawn/writeFile/network"` appears in inline comments documenting the read-only contract. Not a capability hit.
- `packages/lcis-mcp/src/tools.ts:9` — `"No fs writes"` in the module-level JSDoc. Not a capability hit.

**Real hits — correctly-scoped write permissions:**

`packages/lcis-cli/src/format.ts` — The `exportToFile(path, content)` function uses `writeFileSync`. It is called exclusively from `writeOut()` in `cli.ts`, which checks `if (exportPath)` before calling it. The `exportPath` value comes only from `--export <file>` CLI flag. This is a **user-directed report serialization operation** and is correctly not in the governance service layer.

`packages/lcis-pr-check/src/cli.ts` — `writeFileSync(out, output, 'utf8')` at line 100 is guarded by `if (out !== null)` where `out` is populated only by `--out <file>` CLI flag. Same pattern: user-directed output, not a governance side-effect.

**Verdict: NO UNAUTHORIZED WRITES.** Both write paths require explicit user invocation via named CLI flags.

### 2b. Shell Execution

| Pattern | Files Matched | Hit Count | Verdict |
|---------|---------------|-----------|---------|
| `child_process` | none (real imports) | 0 | CLEAN |
| `spawn(` | none | 0 | CLEAN |
| `exec(` / `execSync` | none | 0 | CLEAN |
| `spawnSync` | none | 0 | CLEAN |

**False positives (string/comment mentions):**
- `packages/lcis-governance/src/security/SecurityDriftService.ts:6` — `"no child_process"` in JSDoc. Documentation.
- `packages/lcis-cli/src/cli.ts:888,1156` — `"no fetch/exec/spawn"` in inline comments. Documentation.
- `packages/lcis-mcp/src/tools.ts:9` — `"no process spawning"` in JSDoc. Documentation.

**Verdict: NO SHELL EXECUTION.**

### 2c. Database Mutations

| Pattern | Files Matched | Hit Count | Verdict |
|---------|---------------|-----------|---------|
| `.insert(` | none | 0 | CLEAN |
| `.update(` | none | 0 | CLEAN |
| `.delete(` | none (Map.delete is in-memory) | 0 | CLEAN |
| `.upsert(` | none | 0 | CLEAN |

Note: `Map.prototype.delete` and array methods are in-memory operations and are not DB mutations. No Supabase client `.delete(` calls were found in any Phase-5 file.

**Verdict: NO DB MUTATIONS.**

### 2d. DDL

| Pattern | Files Matched | Hit Count | Verdict |
|---------|---------------|-----------|---------|
| `drop ` | none (active code) | 0 | CLEAN |
| `alter ` | none (active code) | 0 | CLEAN |
| `CREATE TABLE` | none | 0 | CLEAN |
| `DROP TABLE` | none | 0 | CLEAN |

**False positive (string literal, not DDL execution):**
- `packages/lcis-pr-check/src/domain-map.ts:143` — The string `'create policy'` and `'alter policy'` appear inside the `RLS_PATTERNS` array, which is a list of string patterns used to classify changed file paths in PR analysis. This is a heuristic detector, not DDL execution. The array is used in `analyze.ts` to check whether a file path string contains these tokens.

**Verdict: NO DDL.**

### 2e. Dynamic Code Execution

| Pattern | Files Matched | Hit Count | Verdict |
|---------|---------------|-----------|---------|
| `eval(` | none | 0 | CLEAN |
| `new Function(` | none | 0 | CLEAN |

**Verdict: NO DYNAMIC EXECUTION.**

### 2f. Direct Node Stdlib Imports in lcis-governance Package

| Pattern | Files Matched | Hit Count | Verdict |
|---------|---------------|-----------|---------|
| `node:fs` | none in `packages/lcis-governance/src/` | 0 | CLEAN |
| `node:child_process` | none in `packages/lcis-governance/src/` | 0 | CLEAN |
| `node:net` | none in `packages/lcis-governance/src/` | 0 | CLEAN |
| `node:http` | none in `packages/lcis-governance/src/` | 0 | CLEAN |

Note: Test files (`packages/lcis-governance/test/`) do import `node:fs` for `readFileSync` to perform the per-service read-only hygiene scan (compliance.test.ts:8 reads the implementation source to verify banned patterns are absent). This is test infrastructure, not a governance service capability.

**Verdict: ZERO DIRECT NODE STDLIB IMPORTS IN GOVERNANCE SERVICES.**

---

## 3. Structural Argument: "No Mutation Is Representable"

The GDIS type vocabulary is defined in `packages/lcis-governance/src/shared/types.ts`. The entire output surface consists of:

- `Finding` — an immutable record with `id`, `category`, `kind`, `severity`, `subject`, `title`, `detail`, `rule?`, `confidence`, `evidence[]`
- `DriftReport`, `ComplianceReport`, `OwnershipReport`, `SecurityDriftReport`, `ReadinessReport`, `GovernanceReport`, `HealthView` — aggregates of Findings plus provenance (evidence/confidence/sources/timestamp)
- `GovernanceVerdict` — a PR-check verdict (PASS/WARN/FAIL/UNKNOWN)

**There is no method signature anywhere in the GDIS surface that could represent a mutation.** The `GovernanceEngine` interface exposes:

```
generateGovernanceReport(): Promise<GovernanceReport>
generateArchitectureHealth(): HealthView
generateDomainHealth(): Promise<HealthView>
generateSecurityHealth(): HealthView
generateOwnershipHealth(): HealthView
generateReadinessHealth(): Promise<HealthView>
```

Each service method signature pattern is `detect*/find*/evaluate*/generate*` → returns a Finding array or Report. None accept a mutation target, none have `void` returns with side-effects, and none carry an output path or connection handle. The output type hierarchy (`GovernanceArtifact`) has every field marked `readonly`.

The `GovernanceArtifactStore` is a typed reader over lcis-core's `ArtifactStore` (`tryRead`, `has` — read methods only). It never acquires a write reference. Upstream, `LcisEngine` is the lcis-core singleton which is itself built to be read-only over `graphify-out/` artifacts.

**Conclusion:** The architecture is structurally incapable of executing a mutation. There is no effector method, no write handle, no network connection, and no subprocess — the data-flow graph terminates at Finding / Report types.

---

## 4. Honesty Contract Verification

The following UNKNOWN/PARTIAL gaps are explicitly documented in the service code and surfaced in findings — never fabricated:

| Factor / Rule | Service | Status | Evidence Carrier |
|---------------|---------|--------|-----------------|
| Migration rollback presence | `DriftDetectionService.detectMigrationDrift()` | UNKNOWN | `confidence: 0.3`, explicit detail: "memory-intel has no rollback field" |
| R006 — migration rollback compliance | `ComplianceService._evalR006()` | PARTIAL | `notConnected('migration.rollback', 'graphify-out/memory-intel.json#migrations[].rollback')` |
| R008 — healthcheck live probe | `ComplianceService._evalR008()` | PARTIAL | `notConnected('worker.healthcheck.liveProbe', 'OTEL_EXPORTER_OTLP_ENDPOINT or CLOUDFLARE_ANALYTICS_DATASET')` |
| Validator → rule mapping | `DriftDetectionService.detectValidatorDrift()` | PARTIAL | `confidence: 0.3`, states "rule-mapping field absent from all artifacts" |
| Infra worker owners field | `DriftDetectionService.detectOwnershipDrift()` | INFO | "GovWorker has no owners field — ownership must be inferred via CODEOWNERS" |
| Policy USING-clause SQL text | `SecurityDriftService` (all policy methods) | LIMITATION documented in detail field | Explicit: "USING-clause SQL text is NOT inspected — only the public boolean field" |
| Route-level auth | `SecurityDriftService.findMissingAuth()` | PARTIAL | `confidence: 0.4`, "middleware wiring is runtime-resolved, not in graphify-out" |
| Rollback factor | `ReadinessService.factorRollback()` | UNKNOWN | `present: 'UNKNOWN'`, `notConnected('rollback-presence', 'ROLLBACK_ARTIFACT_NOT_IN_GRAPHIFY_OUT')` |
| Healthcheck factor | `ReadinessService.factorHealthcheck()` | UNKNOWN | `present: 'UNKNOWN'`, `notConnected('healthcheck-live-probe', 'HEALTHCHECK_PROBE_NOT_CONNECTED')` |
| Monitoring factor | `ReadinessService.factorMonitoring()` | UNKNOWN | `present: 'UNKNOWN'`, `notConnected('monitoring-config', 'MONITORING_ARTIFACT_NOT_IN_GRAPHIFY_OUT')` |
| Alerts factor | `ReadinessService.factorAlerts()` | UNKNOWN | `present: 'UNKNOWN'`, `notConnected('alert-config', 'ALERT_CONFIG_NOT_IN_GRAPHIFY_OUT')` |
| Readiness system owner | `ReadinessService.evaluateLaunchReadiness()` | UNKNOWN | `present: 'UNKNOWN'`, `notConnected('owner:{key}', 'READINESS_SYSTEM_OWNER_NOT_RESOLVED')` |
| Test coverage (graph-only proxy) | `DriftDetectionService.detectTestDrift()` | NOTED | Detail: "no *.test.* / *.spec.* sourceFile hit — absence means no matching node found in 52k-node graph, not that tests don't exist at all" |

**Every finding carries: `id`, `evidence[]` (non-empty), `confidence` (0..0.95), `category`, `kind`, `severity`, `subject`, `title`, `detail`.**

The `GovernanceArtifact` interface mandates `evidence`, `confidence`, `sources`, `timestamp` on every output. The `governance()` stamp function in `shared/envelope.ts` applies these at every report boundary. A report with zero evidence correctly receives `confidence: 0` (computed by `ConfidenceCalculator.fromEvidence([])`).

---

## 5. Threat Model

| Capability | Present? | Why Impossible |
|------------|----------|---------------|
| Write to the filesystem from a governance service | NO | `GovernanceArtifactStore` and all five services have zero `node:fs` imports. `writeFileSync` exists only in `lcis-cli/format.ts` behind an explicit user `--export` flag. |
| Modify a DB table from a governance service | NO | No Supabase client is instantiated in any governance service. `GovernanceArtifactStore.slice()` calls `core.store.tryRead()` — a read-only method. No `.insert/.update/.delete/.upsert` call exists anywhere in Phase-5 code. |
| Execute a shell command | NO | Zero `child_process` / `spawn` / `exec` / `execSync` imports in all Phase-5 files. |
| Execute dynamic code | NO | Zero `eval(` or `new Function(` calls in all Phase-5 files. |
| Make an outbound network call from governance service | NO | No `fetch(` calls in any `lcis-governance/src/` file. The MCP `tools.ts` states `"No fs writes, no process spawning, no network fetch, no eval"` and calls only `engine.*` read methods. |
| Perform DDL (DROP/ALTER TABLE) | NO | No SQL strings constructed or executed. The only DDL-keyword string hit is in `domain-map.ts` inside a pattern-matching array used to classify file paths. |
| Fabricate live metrics as structural findings | NO | All live-data gaps are surfaced as `NOT_CONNECTED` + exact missing env var. UNKNOWN factors use `present: 'UNKNOWN'` and are excluded from readiness score denominators. |
| Exceed confidence 0.95 | NO | `ConfidenceCalculator` is capped at 0.95 maximum; money-domain structural checks max at 0.85 per the calculator implementation. |
| Singleton GDIS engine accumulates mutable state across calls | MITIGATED | `resetGovernanceEngine()` exists for test isolation. All service results are freshly computed from immutable artifact snapshots on each call. |

---

## 6. Read-Only Test Coverage

Per-service read-only scan tests exist and are complete:

| Test File | Service | Read-Only Hygiene Test | Presence |
|-----------|---------|----------------------|---------|
| `test/compliance.test.ts` | `ComplianceService` | Yes — `"ComplianceService source must not import fetch/child_process/spawn/exec/eval/writeFile"` (line 24) — reads implementation files with `fs.readFileSync` and asserts absence of banned tokens | PRESENT |
| `test/drift.test.ts` | `DriftDetectionService` | Yes — test file imports `readFileSync` and uses it for source-scan assertions | PRESENT |
| `test/security.test.ts` | `SecurityDriftService` | Yes — imports `readFileSync`; includes source-hygiene assertions | PRESENT |
| `test/readiness.test.ts` | `ReadinessService` | Yes — `fs.readdirSync`/`readFileSync` imports for read-only verification | PRESENT |
| `test/ownership.test.ts` | `OwnershipService` | Yes — present; does not include explicit source-scan (gap noted below) | PRESENT |
| `test/foundation.test.ts` | Shared types / envelope | Yes — covers `governance()` stamp, confidence, type shapes | PRESENT |
| `test/engine.test.ts` | `GovernanceEngine` | Yes — covers provenance, score ranges, determinism, singleton | PRESENT |

**Gap:** `test/ownership.test.ts` does not include an explicit source-scan assertion (like `compliance.test.ts:24`) that scans `src/ownership/*.ts` for banned tokens. The OwnershipService JSDoc states `"ABSOLUTE READ-ONLY"` and the source scan above confirms compliance — but the self-enforcing test pattern is absent for this service. This is advisory; all five other service test files perform the scan.

---

## 7. Enforcement Going Forward

1. **Per-service read-only scan pattern** — the `compliance.test.ts` pattern (read implementation source with `readFileSync`, assert absence of banned tokens) should be extended to `ownership.test.ts` to close the one gap found above.

2. **This review** — this document (`LCIS_GOVERNANCE_SECURITY_REVIEW.md`) establishes the authoritative baseline. Future Phase-5 additions should be reviewed against Section 2 patterns before merge.

3. **`GovernanceArtifactStore` boundary** — the `GovernanceArtifactStore` class is the single narrow gateway between governance services and the data layer. It exposes only: `tables()`, `functions()`, `policies()`, `triggers()`, `domains()`, `workers()`, `ownership()`, `migrations()`, `readinessSystems()`, `runbooks()`, `runbookSubjects()`, `sourcesPresent()` — all returning readonly arrays/values backed by `core.store.tryRead()`. Any future Phase-5 service that needs data access MUST go through this store, not directly through `LcisEngine`.

4. **Read-only ArtifactStore boundary in lcis-core** — `core.store.tryRead()` and `core.store.has()` are the only store methods callable from governance services. `core.store` has no write methods accessible in its public interface. This contract is enforced at the type layer — no mutation is representable without adding a new method to `ArtifactStore`.

5. **The `--export` and `--out` write paths are CLI-layer only** — `exportToFile()` in `format.ts` is imported only by `cli.ts`. The API (`services/lcis-api`) and MCP (`packages/lcis-mcp`) layers do not import `format.ts`. The write capability cannot be triggered by an HTTP request or an MCP tool invocation.

---

## 8. Summary Table

| Area | Files Scanned | Patterns Searched | Real Hits | Verdict |
|------|--------------|-------------------|-----------|---------|
| GDIS core services | 16 source files in `packages/lcis-governance/src/` | All 6 pattern groups | 0 | CLEAN |
| CLI governance additions | `packages/lcis-cli/src/` (3 files) | All 6 pattern groups | `writeFileSync` in `format.ts` (permitted, user-flag-gated) | PERMITTED |
| MCP governance tools | `packages/lcis-mcp/src/` (3 files) | All 6 pattern groups | 0 (comment hits only) | CLEAN |
| API governance routes | `services/lcis-api/src/` (4 files) | All 6 pattern groups | 0 | CLEAN |
| PR check (V3 verdicts) | `packages/lcis-pr-check/src/` (6 files) | All 6 pattern groups | `writeFileSync` in `cli.ts` (permitted, `--out` flag); `create policy` in string array (domain-map, not DDL) | PERMITTED |

**Overall verdict: READ-ONLY GUARANTEE HOLDS.** The GDIS surfaces only Findings and Reports. No mutation is representable in the service layer.
