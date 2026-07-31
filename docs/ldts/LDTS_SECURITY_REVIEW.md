# LDTS Security Review — Dependency Twin System (Phase 11)

**Package:** `packages/lcis-twin` (`@letbuyy/lcis-twin`)
**Review scope:** `src/` tree — every `.ts` file.
**Test source:** `test/security.test.ts` (the authoritative scan; this document records
what it enforces and why). All claims below are grounded in the real source files.

---

## 1. Threat Model

LDTS is a **read-only, pure-computation** package. Its attack surface is limited to:

1. Malicious artifact input (crafted `domain-intel.json`, `db-intel.json`,
   `infra-intel.json`) injected via `ArtifactStore`.
2. Supply-chain compromise of its three declared runtime dependencies
   (`@letbuyy/lcis-core`, `@letbuyy/lcis-governance`, `zod`).
3. A future contributor adding execution, mutation, network, or AI capability to
   `src/` — the security scan tests catch this at CI time.

LDTS does **not** connect to any network, database, or filesystem write path. It
cannot be a remote-code-execution vector, a data-exfiltration vector, or a
DB-mutation vector because those primitives are not imported. The security scan
asserts this against the real source tree on every test run.

---

## 2. The Source-Scan Rules

`test/security.test.ts` walks `src/` recursively (`walk(SRC_ROOT)`) and strips all
block and line comments before scanning. The coverage gate asserts at least 4 source
files are found, that both `shared/` and `algorithms/` subtrees are present, and that
`src/engine.ts` is included (security.test.ts lines 98-113).

### 2.1 Forbidden Execution / Shell Primitives

```ts
const FORBIDDEN_EXECUTION = [
  'child_process', 'spawn(', 'spawnSync', 'execSync', 'execFile',
  ' exec(', '.exec(', 'eval(', 'new Function(',
];
```

Each token is checked in every `src/` file after comment-stripping. A match is a
hard CI failure. LDTS never runs subprocesses — it is a pure graph-computation layer.

### 2.2 Forbidden Filesystem Write Primitives

```ts
const FORBIDDEN_FS_WRITE = [
  'writeFile', 'appendFile', 'unlink', 'rmSync', 'rmdir', 'mkdir',
  'renameSync', 'rename(', 'copyFile', 'chmod', 'chown', 'truncate',
  'createWriteStream',
];
```

LDTS may read from `ArtifactStore` (which is the single IO boundary, owned by
`lcis-core`) but must never write, delete, or move any file. `readFileSync` and
`readdirSync` are used only in the test file (`test/security.test.ts`), which is
outside the scanned `src/` tree.

### 2.3 Forbidden Network Primitives

```ts
const FORBIDDEN_NETWORK = [
  'fetch(', 'XMLHttpRequest', 'new WebSocket', 'http.request',
  'https.request', 'net.connect', 'net.createServer', 'dgram.',
];
```

The twin is a structural artifact — no outbound call is ever needed or allowed.

### 2.4 Forbidden IO Module Imports

```ts
const FORBIDDEN_IMPORTS = [
  "from 'node:child_process'", 'from "node:child_process"',
  "from 'child_process'",
  "from 'node:fs'", 'from "node:fs"', "from 'fs'",
  "from 'node:fs/promises'",
  "from 'node:http'", "from 'node:https'", "from 'node:net'",
  "from 'node:dgram'", "from 'node:worker_threads'",
  "from 'node:cluster'",
  'require(',
];
```

Importing these modules is banned even if the imported symbol were never called.
`require(` is also banned, enforcing ESM-only.

### 2.5 DB Mutation Tokens

```ts
for (const tok of ['.insert(', '.update(', '.upsert(', '.rpc(', '.from(']) {
  assert.ok(!src.includes(tok), ...);
}
```

These are the Supabase client method patterns used throughout the rest of the
monorepo for DB writes. LDTS has no Supabase client at all — the dependency allowlist
(section 4) confirms this — so this check is a belt-and-suspenders guard against a
future contributor accidentally importing one.

**Why `.delete(` is excluded from this list:**

In-memory `Set.delete()` and `Map.delete()` are used legitimately inside the
algorithms (e.g. `onStack.delete(w)` in `detectCycles`, graph-algorithms.ts line 113).
Banning `.delete(` would produce false positives on every SCC pop. Database-level
deletes require a `.from(` call first (the Supabase chain pattern), so DB deletes
are already blocked by the `.from(` token check. `.delete(` alone in a package with
no DB client is unreachable as a DB operation.

**Why `.from(` is included but `.delete(` is not:**

`.from(` is the Supabase query builder entry-point (e.g. `supabase.from('orders').delete()`).
All meaningful DB mutations require it. Blocking `.from(` at the source-scan level
ensures no Supabase table query can exist in `src/`, whether read or write.

### 2.6 Wall-Clock Injection — Two Sanctioned Boundaries

```ts
// test: NO WALL CLOCK — has no argless Date.now() or new Date() calls
if (rel.endsWith('shared/envelope.ts')) {
  assert.ok(!src.includes('Date.now('), ...);
  return;  // new Date() IS allowed in envelope.ts only
}
assert.ok(!src.includes('Date.now('), ...);
assert.ok(!src.match(/new Date\(\)/), ...);
```

The only file permitted to call `new Date()` is `src/shared/envelope.ts`, where
`defaultNow` is defined:

```ts
// src/shared/envelope.ts line 8
export const defaultNow = (): string => new Date().toISOString();
```

`Date.now()` is banned everywhere including `envelope.ts`. All other `src/` files
must receive the clock as an injected `now: () => string` parameter (as
`TwinBuilderService` and `DependencyTwinEngineImpl` both do).

A companion test enforces that `defaultNow()` (invocation, not import) does not
appear in any file other than `envelope.ts`:

```ts
test('NO defaultNow CALL — ...', () => {
  const nonEnvelope = SRC_FILES.filter((f) => !f.endsWith('shared/envelope.ts'));
  for (const file of nonEnvelope) {
    assert.ok(!src.includes('defaultNow()'), ...);
  }
});
```

This mirrors the pattern used in `lcis-adapters` (fetch-only-in-http.ts) where the
network boundary is also confined to a single file. The invariant makes all algorithm
and builder outputs testable without mocking a global clock.

### 2.7 AI / LLM / Embedding Tokens — Whole-Corpus Check

```ts
test('NO AI — src has no LLM/embedding/vector-db imports or clients', () => {
  for (const tok of [
    'openai', 'anthropic', 'embedding', 'qdrant', 'Qdrant', 'langchain', 'llm(', 'LLM(',
  ]) { assert.ok(!all.includes(tok), ...); }
});
```

LDTS is a pure graph-algorithms layer. Embedding, LLM inference, or vector-db access
would change its complexity class and introduce non-determinism; this check is
permanent.

---

## 3. Dependency Allowlist

The security scan asserts an exact dependency list (security.test.ts lines 203-211):

```ts
test('dependencies are exactly the approved composition targets (lcis-core + lcis-governance + zod)', () => {
  assert.deepEqual(deps, [
    '@letbuyy/lcis-core',
    '@letbuyy/lcis-governance',
    'zod',
  ]);
});
```

Verified against `package.json`:

```json
"dependencies": {
  "@letbuyy/lcis-core": "workspace:*",
  "@letbuyy/lcis-governance": "workspace:*",
  "zod": "^4.3.6"
}
```

- **`@letbuyy/lcis-core`** — provides `LcisEngine`, `ArtifactStore` (the single IO
  boundary), `evidence`, `notConnected`, `getEngine`. No network or DB access exposed
  to the twin.
- **`@letbuyy/lcis-governance`** — provides the governance/ownership types that
  `lcis-twin` depends on for its type contract. Read-only.
- **`zod`** — used only in `TwinBuilderService` for loose, safe parsing of artifact
  JSON. All schemas use `.passthrough()` and `.optional()` so malformed or unexpected
  artifact fields are tolerated rather than thrown.

No HTTP client, no Supabase client, no AI SDK, no filesystem helper library is in
the dependency set. The allowlist check is exact — adding any new dependency fails
the test until the test is updated under conscious review.

### 3.1 Package governance checks

Two additional invariants are asserted at the package level:

```ts
test('package.json scripts contain no mutation verbs (deploy/push/publish/migrate)', () => {
  for (const verb of ['deploy', 'push', 'publish', 'migrate']) { ... }
});

test('package.json type is "module" (ESM-only — no CommonJS)', () => {
  assert.equal(pkg.type, 'module');
});
```

The scripts check prevents the package from being wired into a deployment or migration
pipeline by accident. ESM-only prevents `require(` interop paths that would bypass the
import-ban test.

---

## 4. Honest Limitations

These are real gaps in the current security posture, stated plainly:

**Artifact-input trust boundary:** `ArtifactStore.tryRead` returns `unknown`; the
builder parses it with zod loose schemas. A crafted artifact could produce an
arbitrarily large node/edge set (memory exhaustion). There is no size cap on artifact
arrays. This is an acceptable risk for a read-only, in-process library running on
trusted CI/server infrastructure — but it would matter if LDTS were ever exposed
over a public HTTP endpoint with untrusted input.

**Transitive dependency surface:** Only direct `dependencies` are checked by the
allowlist test. Transitive dependencies of `lcis-core`, `lcis-governance`, and `zod`
are not asserted here. Changes to those packages could indirectly introduce forbidden
primitives without failing the LDTS security scan.

**Comment-stripping heuristic:** The scanner uses simple regex to strip `/* ... */`
and `// ...` comments before token-matching. Pathological string literals that contain
forbidden tokens (e.g. `const x = "eval("`) would produce a false positive.
Currently no such literals exist in `src/`.

---

## 5. Verdict

**PASS.**

The `src/` tree of `@letbuyy/lcis-twin` contains no execution, no filesystem writes,
no network calls, no DB mutation tokens, no AI/LLM imports, and no argless wall-clock
calls outside the single sanctioned boundary (`shared/envelope.ts`). The dependency
set is exactly the approved three packages. The security scan (`test/security.test.ts`)
enforces all of this automatically on every test run and would fail CI immediately
if any of the forbidden patterns were introduced.
