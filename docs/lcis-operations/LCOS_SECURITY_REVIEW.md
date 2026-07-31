# LCOS Security Review — Phase 6

**Reviewer:** Claude Sonnet 4.6 (automated, verification-only)
**Date:** 2026-06-21
**Scope:** `packages/lcis-operations/src/**`, Phase-6 additions in `packages/lcis-cli/src/cli.ts`, `packages/lcis-mcp/src/tools.ts`, `services/lcis-api/src/app.ts`, `packages/lcis-pr-check/src/`
**Method:** grep + full-file read; comments and string literals stripped before judging forbidden-pattern hits
**Mandate:** Verification + documentation only — no source files modified

---

## Executive Verdict

**READ-ONLY GUARANTEE: ENFORCED. No exceptions found.**

LCOS (Phase 6) is structurally incapable of writing, deploying, executing, or mutating anything. Every forbidden pattern hit in the raw grep output resolves to a comment or operator-guidance string literal. The codebase surfaces only observation types (`OperationalFact`, `OperationalFinding`, `AreaReport`, `OperationsReport`) — no effector method, no network call, no file write, no process spawn exists anywhere in the operational layer.

---

## Per-Area Scan Results

| Area | File(s) | Patterns checked | Raw hits | Verdict after stripping |
|------|---------|-----------------|----------|------------------------|
| **foundation / types** | `src/shared/types.ts`, `artifact-store.ts`, `envelope.ts` | writeFile, spawn, exec, child_process, eval, .insert, .update, .delete, fetch | 0 | CLEAN |
| **engine facade** | `src/engine.ts`, `src/index.ts` | All forbidden patterns | 0 | CLEAN |
| **RuntimeOperationsService** | `src/runtime/RuntimeOperationsService.ts` | All forbidden patterns + `wrangler` | `wrangler` appears 7× | All 7 in string literals (detail / evidence strings describing operator CLI commands) — FALSE POSITIVES |
| **CommerceOperationsService** | `src/commerce/CommerceOperationsService.ts` | All forbidden patterns | 0 executable hits | CLEAN |
| **MerchantOperationsService** | `src/merchant/MerchantOperationsService.ts` | All forbidden patterns | 0 executable hits | CLEAN |
| **CustomerOperationsService** | `src/customer/CustomerOperationsService.ts` | All forbidden patterns | 0 executable hits | CLEAN |
| **DeploymentOperationsService** | `src/deployment/DeploymentOperationsService.ts` | All forbidden patterns + `wrangler` | `wrangler` appears 2× | Both in string literals describing deploy procedures — FALSE POSITIVES |
| **IncidentOperationsService** | `src/incident/IncidentOperationsService.ts` | All forbidden patterns | 0 executable hits | CLEAN |
| **SecurityOperationsService** | `src/security/SecurityOperationsService.ts` | All forbidden patterns | 0 executable hits | CLEAN |
| **ForecastOperationsService** | `src/forecast/ForecastOperationsService.ts` | All forbidden patterns | 0 executable hits | CLEAN |
| **forecast/methods.ts** | `src/forecast/methods.ts` | All forbidden patterns | 0 | CLEAN |
| **CLI (Phase-6 additions)** | `packages/lcis-cli/src/cli.ts` lines 1338–1540 | writeFile, spawn, exec, child_process, eval, DB mutations | 0 executable hits | CLEAN — operations commands call `ops.*()` and pass result to `envelope()` |
| **MCP tools (Phase-6 additions)** | `packages/lcis-mcp/src/tools.ts` lines 784–1092 | All forbidden patterns | 0 executable hits | CLEAN — 8 new tool functions call `ops.*()` only |
| **API routes (Phase-6 additions)** | `services/lcis-api/src/app.ts` lines 875–1031 | All forbidden patterns | 0 executable hits | CLEAN — 9 POST routes call `ops.*()` and return `c.json(envelope(...))` |
| **PR check (operational verdict)** | `packages/lcis-pr-check/src/analyze.ts`, `comment.ts`, `types.ts` | All forbidden patterns | 0 executable hits | CLEAN — `buildOperationalVerdict` reads `ops.operationsReport()` and maps findings; no writes |

### False-Positive Detail: `wrangler` in String Literals

All `wrangler` occurrences are inside template-string / string-literal operator-guidance and NOT in any import, require, spawn, or exec call:

| File | Lines | Context |
|------|-------|---------|
| `src/runtime/RuntimeOperationsService.ts` | 148, 407, 419, 420, 425, 447, 471 | Inside `detail:` and `evidence:` string literals describing how an operator would wire the live signal |
| `src/deployment/DeploymentOperationsService.ts` | 393 | Inside `detail:` string literal: `"secrets must all be present (wrangler secret put) or the ..."` |

No `import 'wrangler'`, no `require('wrangler')`, no `spawn('wrangler')`, no `exec('wrangler ...')` anywhere in LCOS source.

---

## Structural Argument: No Mutation is Representable

LCOS is architecturally incapable of mutation because:

1. **No IO-capable imports.** Every service file imports only from `@letbuyy/lcis-core`, `@letbuyy/lcis-governance`, and the local `../shared/index`. None of those transitively expose `node:fs`, `node:child_process`, `node:net`, or `node:http` into the LCOS layer. The `OperationsArtifactStore` is a typed reader over `lcis-core`'s ArtifactStore (`core.store.tryRead` / `core.store.has`) — both are read-only by design.

2. **Only observation types are produced.** The type vocabulary (`src/shared/types.ts`) defines: `OperationalFact`, `OperationalFinding`, `LiveSignal`, `OperationalHealth`, `AreaReport`, `OperationsReport`, `ForecastSeries`, `OperationalVerdict`. None carries a method; all fields are `readonly`. There is no `execute()`, `fix()`, `deploy()`, `write()`, or `mutate()` method anywhere in the public API.

3. **The engine facade is pure composition.** `OperationsEngineImpl` (`src/engine.ts`) instantiates 8 read-only services and calls their `generate*Report()` methods. `operationsReport()` aggregates those reports in-memory and returns a frozen `OperationsReport`. No side effects occur.

4. **All 9 Phase-6 API routes are `c.json(envelope(ops.*())))`.** The routes in `services/lcis-api/src/app.ts:875–1031` call one LCOS method each, wrap the result in the standard envelope, and return it as JSON. No response modifies state; the `envelope()` function is a pure transformer.

5. **The PR-check operational verdict is a read-and-map.** `buildOperationalVerdict` in `packages/lcis-pr-check/src/analyze.ts` calls `ops.operationsReport()`, filters `findings` by `area`, and maps them to verdict strings. No write, no network, no DB access.

---

## Honesty Contract and NOT_CONNECTED Model

Every LCOS output satisfies:

| Contract clause | Enforcement |
|----------------|-------------|
| Every report carries `evidence`, `confidence`, `sources`, `timestamp`, `liveConnected` | `operations()` in `src/shared/envelope.ts` stamps all five fields unconditionally |
| `liveConnected` is always `false` | All 8 services set `liveConnected: false` explicitly; `envelope.ts` defaults to `false`. Confirmed at: `engine.ts:169`, `runtime/RuntimeOperationsService.ts:647`, `commerce/CommerceOperationsService.ts:603`, `deployment/DeploymentOperationsService.ts:713`, `incident/IncidentOperationsService.ts:719`, `security/SecurityOperationsService.ts:464`, `customer/CustomerOperationsService.ts:632`, `merchant/MerchantOperationsService.ts:623`, `forecast/ForecastOperationsService.ts:317` |
| Live values are `null` + `NOT_CONNECTED` + exact env var named | Each NOT_CONNECTED finding sets `value: null`, `status: 'NOT_CONNECTED'`, `confidence: 0`, and names the exact env var in `evidence` (e.g. `CF_ANALYTICS_API_TOKEN`, `SUPABASE_URL`, `VERCEL_TOKEN`) |
| Confidence is 0 for any NOT_CONNECTED result | `OperationalFindingBuilder.build()` enforces `confidence: 0` when `status === 'NOT_CONNECTED'` per the shared type contract |
| Forecasting: no fabricated series | `ForecastOperationsService` returns `points: []` for every series with `status: 'NOT_CONNECTED'` and the exact source table + env var |
| Confidence cap for structural results | `OperationalConfidenceCalculator` caps structural confidence at 0.9 (never claims 1.0 from artifact-only data) |

---

## Threat Model

| Threat | Capability present? | Why impossible |
|--------|--------------------|-|
| Write to filesystem | No | No `node:fs` import in LCOS; `OperationsArtifactStore` is read-only |
| Spawn or exec external process | No | No `child_process`, `spawn`, `exec`, `execSync` anywhere in LCOS |
| Execute DB mutations | No | No `.insert()`, `.update()`, `.delete()`, `.upsert()` calls; data access is artifact-read only |
| Call `eval` or `new Function` | No | Not present in any LCOS source file |
| Make outbound HTTP/network requests | No | No `fetch()` call in LCOS; no network client imported |
| Auto-remediate or auto-deploy | No | No effector type or method exists in the LCOS type vocabulary |
| Fabricate live values | No | NOT_CONNECTED contract enforced in `envelope.ts` + `ForecastOperationsService`; `liveConnected: false` hardcoded |
| Escalate privileges | No | LCOS reads from ArtifactStore (static files); no DB or cloud credentials are used |
| Trigger CI/CD | No | No GitHub API client, no workflow dispatch call in LCOS |
| Autonomous remediation loop | No | No scheduler, no setTimeout-based loop, no `setInterval` anywhere in LCOS |

---

## Test Coverage — Per-Service Read-Only Source-Scan Tests

Each of the 8 service test files performs a programmatic source-scan (via `readFileSync` + comment-stripping) that asserts forbidden patterns are absent. The engine test file covers the composite facade.

| Test file | Source scanned | Forbidden patterns asserted absent |
|-----------|---------------|-----------------------------------|
| `test/runtime.test.ts` | `RuntimeOperationsService.ts` | `fetch(`, `child_process`, `spawn(`, `exec(`, `eval(`, `writeFile` |
| `test/commerce.test.ts` | `CommerceOperationsService.ts` | Same set |
| `test/merchant.test.ts` | `MerchantOperationsService.ts` | Same set |
| `test/customer.test.ts` | `CustomerOperationsService.ts` | Same set |
| `test/deployment.test.ts` | `DeploymentOperationsService.ts` | Same set |
| `test/incident.test.ts` | `IncidentOperationsService.ts` | Same set |
| `test/security.test.ts` | `SecurityOperationsService.ts` | Same set + `import child_process`, `require(child_process)` |
| `test/forecast.test.ts` | `ForecastOperationsService.ts` | Same set + deterministic math correctness |
| `test/foundation.test.ts` | Foundation types + ArtifactStore | Honesty-contract properties on builders and envelope |
| `test/engine.test.ts` | OperationsEngine facade | `liveConnected: false` on every area report; provenance fields present |

> **Note:** `test/foundation.test.ts` uses `readFileSync` for artifact access during tests but does not execute a source-scan; the source-scan is done in each per-service test. This is correct by design — the foundation test verifies runtime behaviour of the builders against real artifacts.

---

## Read-Only ArtifactStore Boundary

The `OperationsArtifactStore` (`src/shared/artifact-store.ts`) is the sole data-access layer for all 8 LCOS services. Its entire API:

- `workers()`, `queueGraph()`, `deadLetterQueues()`, `opsCenterStatuses()`, `telemetryAdapters()`, `crons()` — typed reads of `runtime-intel` / `runtime-observability` / `telemetry-intelligence` artifacts
- `deployment()`, `deploymentState()`, `incidents()`, `runbooks()`, `security()`, `cost()`, `revenue()`, `merchant()`, `customer()`, `productionReadiness()` — raw `Record<string, unknown>` reads
- `raw(name)` / `has(name)` — generic read / presence check

**All methods delegate to `this.core.store.tryRead` or `this.core.store.has`** — lcis-core's ArtifactStore, which reads pre-generated `graphify-out/*.json` files at startup. No method writes, patches, or deletes any artifact. `tryRead` returns `null` on absence (honest); it does not throw or create.

---

## Enforcement Going Forward

1. **Per-service read-only scan tests** (listed above) are part of the `pnpm test` run for `@letbuyy/lcis-operations`. They fail CI if any forbidden pattern is introduced.
2. **The ArtifactStore boundary** is the only data path. Any future service that needs to access data must go through `OperationsArtifactStore` or extend it with a new typed reader — it cannot bypass to raw IO.
3. **The `OperationalArtifact` type contract** (`evidence`, `confidence`, `sources`, `timestamp`, `liveConnected`) is enforced by the `operations()` envelope function. Any new service that skips it will fail TypeScript compilation.
4. **This review document** is the Phase-6 security baseline. Future Phase-7+ additions must be re-reviewed before merge if they introduce new imports, new data access paths, or new public methods on `OperationsEngine`.
5. **The 107-validator gate** (`node scripts/validate-governance.mjs`) remains authoritative for topology, import, and governance-memory correctness. LCOS does not substitute for it.

---

*Review generated by automated read + grep scan. No source files were modified. Verification only.*
