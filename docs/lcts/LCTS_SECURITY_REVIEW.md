# LCTS Security Review

**Package:** `packages/lcis-tracking` (`@letbuyy/lcis-tracking`)
**Date:** 2026-07-04
**Verdict:** PASS — no violations found in source or package manifest.

---

## 1. Threat model

LCTS is a read-only semantic intelligence layer. The attack surface is bounded by what the package can do at runtime. The security review evaluates whether the package stays within that boundary.

| Threat category | Risk if violated | Boundary enforced by |
|---|---|---|
| Code execution (shell/eval) | Arbitrary command execution in CI or developer environments | Token scan + import ban |
| Filesystem mutation | Corruption of intelligence artifacts or working tree | Token scan + import ban |
| Network egress | Exfiltration, SSRF, unexpected outbound calls | Token scan + import ban |
| Database mutation | Money/tenant data corruption (canonical-ledger-only rule) | Token scan |
| Wall-clock coupling | Non-deterministic outputs break replay guarantee | Token scan + single-point exemption |
| AI/embedding primitives | Nondeterministic outputs, undeclared LLM dependency | Aggregate token scan |
| Dependency creep | Any of the above introduced via a transitive import | Package manifest pin |
| Mutation verbs in scripts | Accidental deploy/push/publish/migrate in CI context | Package manifest scan |

---

## 2. Enforcement mechanism — recursive source scan

The enforcement is implemented in `packages/lcis-tracking/test/security.test.ts`. It runs as part of the standard test suite (`pnpm --filter @letbuyy/lcis-tracking test`).

### Scan methodology

Every `.ts` file under `packages/lcis-tracking/src/` is walked recursively by `walk(dir: string): string[]`. The walker calls `readdirSync` and `statSync` (node built-ins in the test runner, not in source). Each file is read by `readFileSync` and passed through `strippedSource()`:

```ts
function strippedSource(path: string): string {
  return readFileSync(path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')  // strip block comments (incl. JSDoc)
    .replace(/\/\/.*$/gm, '');          // strip single-line comments
}
```

Comment stripping ensures that documentation examples, test fixtures cited in comments, or annotation strings do not produce false negatives. **The scan operates on executable code only.**

Coverage is asserted before substantive checks:
- At least 1 source file must exist.
- At least one file must reside under `src/shared/`.
- Every path returned by the walker must end in `.ts`.

---

## 3. Forbidden token classes

All token classes below are taken verbatim from the test file. Per-file checks run against the comment-stripped source of that individual file. The aggregate AI scan runs against all stripped sources joined.

### 3.1 Execution / shell (`FORBIDDEN_EXECUTION`)

Checked per-file. Test label: `NO EXEC`.

```
child_process
spawn(
execSync
exec(
.exec(
eval(
new Function(
```

**Rationale:** LCTS never runs external processes. It reads composed artifacts and delegates to in-process LCIS services; it has no reason to shell out.

### 3.2 Filesystem mutation (`FORBIDDEN_FS_WRITE`)

Checked per-file. Test label: `NO WRITE`.

```
writeFile
appendFile
unlink
rmSync
rmdir
mkdir
rename(
copyFile
chmod
createWriteStream
```

**Rationale:** LCTS is read-only by contract. Intelligence artifacts are written by the graph refresh pipeline (`pnpm graph:*`), not by LCTS. Mutation would corrupt the artifacts other LCIS packages depend on.

### 3.3 Network primitives (`FORBIDDEN_NETWORK`)

Checked per-file. Test label: `NO NETWORK`.

```
fetch(
XMLHttpRequest
WebSocket
http.request
https.request
```

**Rationale:** LCTS reads from the local artifact store and from injected `LiveFact[]` values produced by adapters. It never initiates network connections itself. Live data from GitHub/Vercel is mediated through the adapter layer (`@letbuyy/lcis-adapters`), which is injected at the call site — not called by LCTS internally.

### 3.4 Forbidden imports (`FORBIDDEN_IMPORTS`)

Checked per-file. Test label: `NO IO IMPORTS`.

```
from 'node:child_process'
from "node:child_process"
from 'child_process'
from 'node:fs'
from "node:fs"
from 'fs'
from 'node:fs/promises'
from "node:fs/promises"
from 'node:http'
from "node:http"
from 'node:https'
from "node:https"
from 'node:net'
from "node:net"
from 'node:dgram'
from "node:dgram"
from 'node:worker_threads'
from "node:worker_threads"
require(
```

**Rationale:** Banning the import is a stronger control than banning individual function tokens — it prevents indirect access to these capabilities through aliasing or dynamic property access. `require(` is banned to block CommonJS dynamic imports that would bypass the ESM import scan.

### 3.5 Database mutation (`FORBIDDEN_DB`)

Checked per-file. Test label: `NO DB MUTATION`.

```
.insert(
.update(
.delete(
.upsert(
.rpc(
```

**Rationale:** The canonical-ledger-only rule (CLAUDE.md) forbids all TypeScript code from calling Supabase table mutation methods or RPCs directly. LCTS reads structural data through `lcis-core`'s read-only `ArtifactStore`; it has no Supabase client and never needs one.

### 3.6 Wall-clock primitives (`FORBIDDEN_WALL_CLOCK`)

Checked per-file (with one explicit exemption). Test label: `NO WALL CLOCK`.

```
Date.now(
new Date()
```

**Single-point exemption:** `shared/envelope.ts` is the sole file permitted to use wall-clock primitives. It defines `defaultNow`:

```ts
export const defaultNow = (): string => new Date().toISOString();
```

The test enforces this with:
```ts
if (rel === 'shared/envelope.ts') return;
```

Every other file in `src/` must use the `now: () => string` callback injected through the constructor. This enforces the deterministic replay guarantee: tests inject a fixed clock; production uses `defaultNow`. No service bypasses this by calling `Date.now()` or `new Date()` directly.

**Note:** `new Date(someArg)` (parsing a date string) is not forbidden by the token `new Date()` (which matches zero-argument form only). The scan targets the non-deterministic zero-argument form.

### 3.7 AI / embedding / vector-DB primitives (`FORBIDDEN_AI`)

Checked against the **aggregate** joined source. Test label: `NO AI`.

```
openai
anthropic
embedding
qdrant
Qdrant
langchain
llm(
LLM(
```

**Rationale:** LCTS derives all intelligence from structural artifacts (Zod-validated JSON files from `graphify-out/`) and from delegations to peer LCIS packages. It does not call LLMs, generate embeddings, or query vector databases. The aggregate scan (rather than per-file) catches tokens that might appear in transitive re-exports.

---

## 4. Dependency allowlist (`package.json`)

The test asserts the exact closed set of runtime dependencies:

```ts
assert.deepEqual(deps, [
  '@letbuyy/lcis-adapters',
  '@letbuyy/lcis-core',
  '@letbuyy/lcis-engineering',
  '@letbuyy/lcis-governance',
  'zod',
]);
```

Any addition or removal of a runtime dependency will cause this test to fail. This is the transitive-import control: even if a forbidden primitive is not used in LCTS source directly, it cannot enter via a new undeclared dependency.

**What each dependency provides:**

| Dependency | Read-only use in LCTS |
|---|---|
| `@letbuyy/lcis-core` | `ArtifactStore.tryRead`, `BlastRadiusService.blast`, `MemoryService.search`, `Evidence` types, `evidence()`, `notConnected()`, `getEngine()` |
| `@letbuyy/lcis-adapters` | `LiveFact` type (injection interface only — LCTS never instantiates an adapter) |
| `@letbuyy/lcis-governance` | `GovernanceEngine` → `OwnershipService.generateOwnershipReport()` (read-only) |
| `@letbuyy/lcis-engineering` | `EngineeringEngine` → `FeatureIntelligenceService.analyzeFeature`, `generateRollbackPlan` (read-only delegation) |
| `zod` | Schema validation for artifact JSON (`MemoryIntelSchema`, `DbIntelSchema`, `InfraIntelSchema`) |

---

## 5. Package manifest checks

The test asserts three additional properties of `package.json`:

| Check | Expected value | Failure means |
|---|---|---|
| `name` | `@letbuyy/lcis-tracking` | Package identity drift |
| `type` | `module` | ESM required for `import.meta.url` in test path resolution; CJS would break the walker |
| `scripts` must not contain mutation verbs | None of: `deploy`, `push`, `publish`, `migrate` | CI scripts must not accidentally apply migrations or push to production |

---

## 6. Honest limitations

The following concerns are outside the scope of the token scan and are noted honestly:

**1. Transitive dependency depth.** The scan enforces the five direct dependencies. It does not walk their transitive trees. If `@letbuyy/lcis-core` or `@letbuyy/lcis-engineering` internally uses a network primitive, the LCTS scan will not catch it. Those packages carry their own security scans.

**2. Runtime injection.** The `LiveFact[]` injection interface accepts objects from the caller. LCTS does not validate the content of `LiveFact.detail` or `LiveFact.subject` beyond using them as strings. A caller could inject misleading facts. This is acceptable because LCTS is an internal LCIS package consumed by trusted code paths; it is not a public API surface.

**3. Comment stripping coverage.** The regex `/.\/\*[\s\S]*?\*\//g` is greedy for block comments but uses `?` to avoid runaway matches. It does not handle all edge cases (e.g., nested `/*` sequences, which are not valid TypeScript anyway). The single-line comment strip is line-anchored and handles standard cases. Source files in LCTS use only standard comment syntax; this is an acceptable approximation.

**4. Dynamic property access.** The token scan is substring-based. A token like `obj['writeFile']` would not be caught by `writeFile` (no match on the quoted form). The dependency allowlist and import ban provide the primary defense against this; the token scan is a secondary layer.

**5. No runtime sandboxing.** LCTS runs in the same Node.js process as the calling code. The scan verifies source tokens; it does not create a runtime sandbox. A compromised dependency could still access filesystem or network APIs. This is a platform-level concern, not one LCTS can address unilaterally.

---

## 7. Verdict

**PASS.** The security test suite enforces seven orthogonal forbidden-token classes plus a closed dependency allowlist and package manifest checks. Every check runs on comment-stripped source to prevent bypass via documentation text. The single clock exemption (`shared/envelope.ts` for `new Date()`) is explicit and justified. No forbidden tokens appear in any source file; no disallowed dependencies appear in `package.json`.

LCTS meets its read-only, deterministic, non-fabricating contract as enforced by the recursive scan pattern established in `test/security.test.ts`.
