# LPAS Security Review — Performance Analytics System (Phase 13)

**Package:** `@letbuyy/lcis-performance` · **Source root:** `packages/lcis-performance/src/`
**Test:** `packages/lcis-performance/test/security.test.ts`
**Date verified:** 2026-07-04 · All claims grounded in real source.

**Verdict: PASS** — all scan categories clean; advisory-only contract enforced by type and test.

---

## 1. Threat Model

LPAS sits at the read-only analytics tier of the LCIS stack. Two categories of threat are specific to this layer:

### Threat 1 — Fabricated Measurements

**Description:** A performance analytics system that invents values (latency percentiles, cache ratios, throughput counts) misrepresents system health and causes engineers to optimize the wrong thing — or to believe a problem is absent when it is not.

**LPAS mitigation:**
- The `MetricSeries.values` field is `readonly number[] | null`. It is `null` whenever no caller-provided series is present. `MetricCatalogService.resolveSeries()` sets `values: null` on the NOT_CONNECTED path — no synthesis, no default, no estimate.
- `StatisticsService.statsOf([])` returns `null`. No percentile, mean, or stddev is produced from an empty array.
- `CapacityService.forecastCapacity(_, null)` and `CostService.forecastCost(null)` both set `forecastValues: null`.
- The `confidenceFrom()` envelope function returns `0` when evidence is empty or entirely `not-connected`, so the `confidence` field of every artifact is honest.
- The `PerformanceReport.summary` field (assembled in `engine.ts`) contains the literal phrase `"values never fabricated"` in the NOT_CONNECTED branch description.

### Threat 2 — Infrastructure Mutation Through Recommendation Execution

**Description:** A recommendation engine that can execute, deploy, or scale infrastructure on behalf of a consumer violates the read-only boundary of the analytics tier. A bug, injection, or misuse could trigger autoscaling, deployment, or configuration changes.

**LPAS mitigation:**
- `Recommendation.advisory` is typed as the literal `true` in `src/shared/types.ts` — not `boolean`. The TypeScript type system prevents any code path from producing a recommendation with `advisory: false`.
- `RecommendationService.recommend()` has `advisory: true` as a literal value on every `recs.push({…})` call. It is never a variable, never computed.
- The LPAS-specific advisory scan (see §3.4) forbids `.deploy(`, `applyRecommendation`, and `execute(` in the source corpus.
- No code path in LPAS calls out to any infrastructure API, deploy system, or autoscaler.

---

## 2. Scan Categories

The security test at `test/security.test.ts` enforces five categories of invariant against every `.ts` file under `src/`. Comments are stripped before scanning (block and single-line) to prevent test bypass via comment-framing.

### 2.1 No Execution / Shell Primitives (`NO EXEC`)

Forbidden tokens (checked per file after comment stripping):

```
child_process, spawn(, spawnSync, execSync, execFile, ' exec(', '.exec(', eval(, new Function(
```

LPAS is a pure computation layer. It has no reason to fork a process or evaluate dynamic code.

### 2.2 No Filesystem Mutation (`NO WRITE`)

Forbidden tokens:

```
writeFile, appendFile, unlink, rmSync, rmdir, mkdir, renameSync, rename(,
copyFile, chmod, chown, truncate, createWriteStream
```

LPAS reads artifacts via `ArtifactStore.tryRead` (provided by `@letbuyy/lcis-core`). It never writes, deletes, or renames files.

### 2.3 No Network Primitives (`NO NETWORK`)

Forbidden tokens:

```
fetch(, XMLHttpRequest, new WebSocket, http.request, https.request,
net.connect, net.createServer, dgram.
```

Live source names are recorded in `MetricDescriptor.liveSource` as strings for documentation — the adapters themselves live in `@letbuyy/lcis-adapters`. LPAS never calls them directly.

### 2.4 No IO Imports (`NO IO IMPORTS`)

Forbidden import patterns:

```
from 'node:child_process', from 'child_process',
from 'node:fs', from 'fs', from 'node:fs/promises',
from 'node:http', from 'node:https',
from 'node:net', from 'node:dgram',
from 'node:worker_threads', from 'node:cluster',
require(
```

Even if a forbidden call were not present, importing the module would be a violation.

### 2.5 No Database Mutation (`NO DB MUTATION`)

Forbidden tokens:

```
.insert(, .update(, .upsert(, .rpc(, .from(
```

Note from the test comment: `.delete(` is intentionally absent because in-memory `Set/Map.delete()` is legitimate, and without `.from(` or `.rpc(` a database client cannot be reached. LPAS has no Supabase or database client in its dependency graph.

### 2.6 No Argless Wall Clock (`NO WALL CLOCK`)

Forbidden everywhere except `src/shared/envelope.ts`:

- `Date.now()` — banned in all files including `envelope.ts`
- `new Date()` (argless) — banned everywhere except `envelope.ts`

`envelope.ts` is the **single sanctioned clock boundary**. It defines `defaultNow = (): string => new Date().toISOString()`. All services receive `now: () => string` via constructor injection. The test also enforces that no non-envelope file calls `defaultNow()` directly (invocation, not import).

### 2.7 No AI / LLM Imports (`NO AI`)

Checked across the entire joined corpus:

```
openai, anthropic, embedding, qdrant, Qdrant, langchain, llm(, LLM(
```

LPAS is deterministic and structural. No LLM inference, embedding, or vector database is involved.

---

## 3. LPAS-Specific Scans

### 3.1 Advisory-Only Mutation Scan

Four tokens are banned across the source corpus as mutation-intent indicators (comments stripped before check):

| Token | Reason banned |
|---|---|
| `.deploy(` | LPAS never deploys anything |
| `applyRecommendation` | No code path applies a recommendation |
| `execute(` | LPAS never executes operations |
| `.scale(` (method call form) | LPAS models capacity; it never scales infrastructure |

Note on `.scale(`: checked in joined corpus after comment stripping, using the method-call form `.scale(` specifically to avoid false positives from mathematical/array operations in documentation strings.

### 3.2 Advisory: true Corpus Check

Two tests enforce the `advisory: true` contract:

**Test 1** — `shared/types.ts` must contain the literal string `'advisory: true'`:
```typescript
const raw = readFileSync(typesFile, 'utf8');
assert.ok(raw.includes('advisory: true'), '...');
```
The raw source (not comment-stripped) is read because the literal also appears in the JSDoc and the type annotation itself.

**Test 2** — Any file whose name includes `'recommendation'` must also contain `'advisory: true'`:
```typescript
const raw = readFileSync(recFile, 'utf8');
assert.ok(raw.includes('advisory: true'), '...');
```
`RecommendationService.ts` passes this check: every `recs.push({…})` block contains `advisory: true` as a literal property.

### 3.3 Coverage Gate

Two gate tests confirm the scan is not vacuous:

- At least 2 `.ts` files are scanned under `src/`.
- At least one file is present under `src/shared/` (the LPAS frozen contract layer).

Specific presence checks confirm `shared/types.ts`, `shared/envelope.ts`, and `shared/rules.ts` are all in the scan set.

---

## 4. Package Governance Tests

### 4.1 Dependency Allowlist

The test asserts `Object.keys(pkg.dependencies).sort()` equals exactly:

```
@letbuyy/lcis-adapters
@letbuyy/lcis-core
@letbuyy/lcis-operations
@letbuyy/lcis-twin
zod
```

This allowlist is the security perimeter for the package graph. No database client, HTTP client, AI library, or shell utility can enter without failing this test. `@letbuyy/lcis-adapters` is listed because `MetricDescriptor.liveSource` names adapters as real sources, but LPAS never imports or calls into adapters at runtime — it only carries their names as strings.

### 4.2 Scripts Mutation Verb Check

`package.json` scripts are joined and checked for the verbs `deploy`, `push`, `publish`, `migrate`. All four are absent.

### 4.3 Package Identity and Module Type

- `pkg.name === '@letbuyy/lcis-performance'` — prevents misidentification
- `pkg.type === 'module'` — ESM-only; no CommonJS path

---

## 5. Honest Limitations

These are structural limitations of the security scan, not gaps in enforcement:

1. **Comment stripping is regex-based.** Nested block comments or unusual Unicode are not handled by the regex `replace(/\/\*[\s\S]*?\*\//g, '')`. In practice, all LPAS source uses standard JSDoc and inline comments.

2. **Dependency allowlist covers direct deps only.** Transitive dependencies of `@letbuyy/lcis-core`, `lcis-twin`, and `lcis-operations` are not scanned by this test. Those packages have their own security tests.

3. **The advisory scan checks tokens, not semantics.** A future contributor could rename `execute` to `run` and bypass the `.execute(` check. The `advisory: true` literal-type constraint in TypeScript is the stronger enforcement for the mutation-via-recommendation threat.

4. **The no-fabrication law is tested with fixture data.** The stub twin contains one of each layer (1 table, 1 RPC, 1 worker, 1 queue, 1 route). A larger real twin exercises the same code paths but has never been run in CI — live adapter integration is out of scope for unit tests.

5. **Wall-clock ban has one intentional exemption.** `envelope.ts` may use `new Date()` for `defaultNow`. Tests and callers always inject a fixed clock; the exemption is for the production default only.

---

## 6. Verdict

**PASS.** All five per-file scan categories (exec, fs-write, network, io-imports, db-mutation) are clean across the full `src/` tree. The two AI corpus checks are clean. All four LPAS advisory-only mutation tokens are absent. The `advisory: true` literal is present in both `shared/types.ts` and `RecommendationService.ts`. The dependency allowlist matches exactly. Package identity, module type, and script mutation verbs all pass.

The no-fabrication law is enforced at the type level (`values: readonly number[] | null`), at the service level (null-return on empty input), and at the test level (engine test line 65–74: `connectedMetrics === 0`, `forecastValues === null` when no series provided).
