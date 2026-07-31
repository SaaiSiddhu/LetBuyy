# LQAS Security Review — Quality Analytics System (Phase 15)

**Package:** `packages/lcis-quality` (`@letbuyy/lcis-quality`)
**Date:** 2026-07-05
**Verdict: PASS**

Reviewed against: `src/shared/{types,rules,envelope}.ts`, `src/engine.ts`,
`src/test/TestAnalyticsService.ts`, `src/complexity/ComplexityService.ts`,
`src/architecture/ArchitectureQualityService.ts`, `src/techdebt/TechDebtService.ts`,
`src/docapi/DocApiQualityService.ts`, `src/score/QualityScoreService.ts`,
`test/security.test.ts`.

---

## 1. Threat Model

LQAS is a read-only static-analysis subsystem. Its attack surface is narrow:

| Threat vector | Verdict | Rationale |
|---|---|---|
| Arbitrary code execution | BLOCKED | No `eval`, no `new Function`, no shell spawn, no `execSync` anywhere in src/ |
| Filesystem write / data exfiltration | BLOCKED | No `writeFile`, `appendFile`, `unlink`, `mkdir`, `createWriteStream` in src/ |
| Network exfiltration | BLOCKED | No `fetch`, no `XMLHttpRequest`, no `WebSocket`, no `http.request`, no `net.connect` in src/ |
| DB mutation (Supabase `.insert/.update/.upsert/.rpc`) | BLOCKED | No Supabase client dependency; `.rpc(` not present in src/ |
| AI/LLM leakage (prompt injection, data to external model) | BLOCKED | No `openai`, `anthropic`, `embedding`, `qdrant`, `langchain`, `llm(` imports in src/ |
| Fabricated quality metrics | BLOCKED by honesty contract | NOT_CONNECTED fields are typed `number | null`; null until CI data wired; QA07 advisory always emitted |
| Advisory-only bypass | BLOCKED by type + test | All `QualityRecommendation` have `advisory: true` literal; `advisory: false` banned by security test |
| Wall-clock injection for timestamp forgery | BLOCKED | `Date.now()` and argless `new Date()` banned in all files except `shared/envelope.ts`; all services accept injectable `now: () => string` |
| Forbidden module import (fs/net/child_process) | BLOCKED | No `node:fs`, `node:net`, `node:child_process`, `node:http`, `node:https`, `node:dgram`, `node:worker_threads`, `node:cluster`, or `require(` in src/ |
| Mutation verb in build scripts | BLOCKED | `package.json` scripts contain no `deploy`, `push`, `publish`, or `migrate` verbs |

---

## 2. Scan Rules (mirroring `test/security.test.ts`)

The security test suite performs a recursive walk of `src/` stripping block and
line comments before matching, ensuring no token is hidden behind a comment.

### 2.1 Execution primitives (FORBIDDEN_EXECUTION)

Tokens rejected in every src/ file:
`child_process`, `spawn(`, `spawnSync`, `execSync`, `execFile`, ` exec(`, `.exec(`,
`eval(`, `new Function(`

### 2.2 Filesystem-write primitives (FORBIDDEN_FS_WRITE)

Tokens rejected in every src/ file:
`writeFile`, `appendFile`, `unlink`, `rmSync`, `rmdir`, `mkdir`, `renameSync`,
`rename(`, `copyFile`, `chmod`, `chown`, `truncate`, `createWriteStream`

### 2.3 Network primitives (FORBIDDEN_NETWORK)

Tokens rejected in every src/ file:
`fetch(`, `XMLHttpRequest`, `new WebSocket`, `http.request`, `https.request`,
`net.connect`, `net.createServer`, `dgram.`

### 2.4 Forbidden imports (FORBIDDEN_IMPORTS)

Rejected across all src/ files:
`node:child_process`, `child_process`, `node:fs`, `fs`, `node:fs/promises`,
`node:http`, `node:https`, `node:net`, `node:dgram`, `node:worker_threads`,
`node:cluster`, `require(`

Note: `DocApiQualityService.ts` uses `node:fs` only in the test harness
(`test/security.test.ts` itself) to walk src/ for scanning — that file is in `test/`,
not `src/`, and is explicitly excluded from the production-code scan.

### 2.5 DB mutation tokens

Rejected in every src/ file: `.insert(`, `.update(`, `.upsert(`, `.rpc(`

`.delete(` is intentionally absent from the forbidden list: in-memory
`Set.delete()` / `Map.delete()` / `Array.filter()` are legitimate operations
and no Supabase DB client is present in the package, so DB deletes via `.from(` are
unreachable. `.from(` is also present in legitimate `Array.from(` and ES module
`import … from` syntax — its presence alone is not forbidden.

### 2.6 Wall-clock isolation

`Date.now(` and `new Date()` (argless) are banned in all src/ files. The single
exception is `shared/envelope.ts`, which contains the `defaultNow` definition:
`export const defaultNow = (): string => new Date().toISOString()`. The security
test permits this definition site while rejecting any call of `defaultNow()` in
non-envelope files — all services receive `now` as an injectable constructor parameter.

### 2.7 AI/LLM token ban (whole-corpus check)

Rejected across the concatenated src/ corpus:
`openai`, `anthropic`, `embedding`, `qdrant`, `Qdrant`, `langchain`, `llm(`, `LLM(`

### 2.8 Advisory-only enforcement

`QualityScoreService.ts` must contain the literal `advisory: true` and must not contain
`advisory: false`. Verified by `test/security.test.ts` line 205–218.

### 2.9 Mutation-verb ban in package.json scripts

The `scripts` block must not contain `deploy`, `push`, `publish`, or `migrate`.
Current scripts: `build`, `typecheck`, `test` — all pass.

---

## 3. Dependency Allowlist

The security test (`test/security.test.ts` line 222–233) asserts that
`package.json` `dependencies` is exactly this set — sorted:

```
@letbuyy/lcis-core
@letbuyy/lcis-engineering
@letbuyy/lcis-governance
@letbuyy/lcis-tracking
@letbuyy/lcis-twin
zod
```

All five `@letbuyy/` packages are internal workspace dependencies. `zod` is used
only in `DocApiQualityService.ts` for loose artifact schema validation
(`z.object(…).passthrough()` / `safeParse`). No external HTTP client, no DB SDK,
no AI library, no telemetry SDK.

`devDependencies` (`@types/node`, `typescript`) are build-only and not deployed.

---

## 4. Read-Only Posture

LQAS never opens a writable channel of any kind:

- **No Supabase client** — the only data access is via `core.store.tryRead(artifactName)`,
  a read-only abstraction over `graphify-out/` JSON files.
- **No network calls** — all upstream intelligence is consumed from the already-built
  LCIS graph artifacts passed in via `LcisEngine`.
- **No filesystem writes** — the `quality()` envelope produces an in-memory object;
  writing it to disk (e.g. as a report file) is the caller's responsibility and is out
  of scope for this package.
- **No process exit / signals** — no `process.exit`, no `process.kill`, no signal
  handlers.

---

## 5. Honest Limitations

### 5.1 Coverage, mutation, and flaky values are absent until CI data is wired

`CoverageAnalytics.linePct`, `CoverageAnalytics.branchPct`,
`MutationAnalytics.mutationScore`, and `FlakyReport.flakyTests` are all `null` /
empty with `connection: 'NOT_CONNECTED'` until a caller provides real CI output.
QA07 (`info`, weight 0) is always emitted as an advisory recommendation so this
absence is explicit in every report.

**Security implication:** a consumer that misinterprets `null` as zero could
underestimate quality risk. The type system enforces `number | null` for all
NOT_CONNECTED numeric fields; callers must branch on `connection` before using values.

### 5.2 Complexity is structural degree, not cyclomatic complexity

`ComplexityService` measures graph fan-in and fan-out (dependency-graph degree) from
`graphify-out/graph.json`. This is a structural proxy for change-risk, not the
classical cyclomatic complexity (McCabe number, which requires control-flow analysis).
A high-degree node may be a widely-used utility with simple logic; the finding is
advisory, not a hard defect signal.

### 5.3 Architecture quality depends on the freshness of the twin artifacts

`ArchitectureQualityService` composes `lcis-twin` which reads `graphify-out/domain-intel.json`.
If the artifact is stale (not regenerated after a topology change), cycles and SPOFs
reflect an outdated graph. Refresh with `pnpm graph:v3` before interpreting findings.

### 5.4 Doc quality uses a structural graph proxy, not inline comment analysis

`DocApiQualityService.docs()` counts graph nodes whose ID or label contains
`'documentation'` or `'.md'` as the proxy for documented subjects. This does not
measure JSDoc coverage, inline comment quality, or README completeness — only the
presence of documentation nodes indexed by Graphify.

### 5.5 API typing depends on infra-intel routes[] — currently absent

The current `graphify-out/infra-intel.json` artifact does not contain a `routes[]`
array. `ApiQuality.routeCount` is therefore 0 and a QA08 finding notes the gap. When
a future Graphify version adds routes, the service will begin counting typed contracts
without a code change.

### 5.6 Tech-debt scores are relative, not absolute

`TechDebtService` scores subjects as `churn × complexity`. A score of 20 means
"changed 20 times in a node of degree 1" or "changed 4 times in a node of degree 5" —
both are the same score. The severity thresholds (>= 20 high, >= 8 medium) are
calibration constants; teams may need to adjust the `SCORE_THRESHOLD` (2) and caps
(30 hotspots) to their project's churn characteristics.

---

## 6. Test Coverage of Security Properties

`test/security.test.ts` contains >= 30 tests that gate all of the above. Key assertions:

| Test | What it enforces |
|---|---|
| `security scan covers the full src tree` | At least 4 src files, `shared/` + `score/` + `engine.ts` all present |
| `NO EXEC — <file>` (per file) | No execution/shell primitives in any src/ file |
| `NO WRITE — <file>` (per file) | No filesystem-write primitives in any src/ file |
| `NO NETWORK — <file>` (per file) | No network primitives in any src/ file |
| `NO IO IMPORTS — <file>` (per file) | No forbidden module imports in any src/ file |
| `NO DB MUTATION — <file>` (per file) | No `.insert(`, `.update(`, `.upsert(`, `.rpc(` in any src/ file |
| `NO WALL CLOCK — <file>` (per file) | No `Date.now(` or argless `new Date()` except at `shared/envelope.ts` |
| `NO AI — src has no LLM/embedding/vector-db imports` | No AI tokens in the whole corpus |
| `QualityScoreService uses advisory:true literal` | `advisory: true` present, `advisory: false` absent |
| `dependencies are exactly the approved composition targets` | Exact allowlist match |
| `package.json scripts contain no mutation verbs` | No deploy/push/publish/migrate |
| `package.json has a name and it is the correct LQAS package` | Name = `@letbuyy/lcis-quality` |
| `package.json type is "module" (ESM-only)` | `type: "module"` |
| `NO defaultNow CALL — defaultNow() only at definition site` | No non-envelope file calls `defaultNow()` |

---

## 7. Verdict

**PASS.** LQAS is read-only, deterministic, and advisory-only. No execution, network,
filesystem-write, DB mutation, or AI capability is present in `src/`. The honesty
contract (NOT_CONNECTED for coverage/mutation/flaky, advisory: true on all
recommendations) is enforced by types and by the security test suite. The dependency
allowlist is exact and contains no untrusted third-party clients.
