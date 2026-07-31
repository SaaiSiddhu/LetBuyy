# LSAS Security Review — `@letbuyy/lcis-security`

**Package:** `packages/lcis-security`
**Review date:** 2026-07-05
**Verdict:** PASS

LSAS analyzes security. This document reviews the security of LSAS itself — treating the
package as the subject under review, not a reviewer.

---

## 1. Threat model

### 1.1 What LSAS does (attack surface definition)

LSAS is a pure computation package. It:
- reads structured data from the `LcisEngine` store (`db-intel.json`)
- delegates to five upstream LCIS packages (governance, operations, tracking, twin, adapters)
- performs in-memory computation (risk scoring, graph traversal via twin, filtering)
- returns typed plain objects

LSAS does **not**:
- accept HTTP requests
- accept untrusted external input
- write to disk, network, or database
- execute subprocesses
- hold or transmit credentials
- expose a network listener of any kind

### 1.2 Trust boundary

The only data that enters LSAS from outside the process boundary is `db-intel.json`, read via
`LcisEngine.store.tryRead('db-intel.json')` in `AttackGraphService`. The contents of this file
are parsed with Zod loose schemas (`passthrough()`, all fields optional). A malformed or
adversarially crafted file cannot cause a throw; it results in empty topology (honest empty).

All other inputs come from upstream LCIS packages operating on the same in-process store. Those
packages inherit the same read-only invariant and are reviewed separately.

### 1.3 Attacker goals against LSAS itself

| Goal | Feasibility | Mitigation |
|---|---|---|
| Cause LSAS to report a false CONNECTED status on a live signal | Not achievable | Connection enum is set by source — structural findings hard-code `'CONNECTED'`; live signals are unconditionally `'NOT_CONNECTED'` |
| Inject a fabricated recommendation that claims executable authority | Not achievable | `advisory: true` is a literal, enforced at the source level by `security.test.ts`; no execution path exists |
| Cause LSAS to write or delete files | Not achievable | `FORBIDDEN_FS_WRITE` scan in `security.test.ts` covers `writeFile`, `appendFile`, `unlink`, `rmSync`, `rmdir`, `mkdir`, `renameSync`, `rename(`, `copyFile`, `chmod`, `chown`, `truncate`, `createWriteStream` |
| Cause LSAS to exfiltrate credentials via network | Not achievable | `FORBIDDEN_NETWORK` scan covers `fetch(`, `XMLHttpRequest`, `new WebSocket`, `http.request`, `https.request`, `net.connect`, `net.createServer`, `dgram.` |
| Cause LSAS to execute arbitrary code | Not achievable | `FORBIDDEN_EXECUTION` scan covers `child_process`, `spawn(`, `spawnSync`, `execSync`, `execFile`, `exec(`, `eval(`, `new Function(` |
| Cause LSAS to bypass its read-only constraint via forbidden imports | Not achievable | `FORBIDDEN_IMPORTS` scan covers `node:child_process`, `node:fs`, `node:fs/promises`, `node:http`, `node:https`, `node:net`, `node:dgram`, `node:worker_threads`, `node:cluster`, `require(` |
| Inject an LLM/AI dependency | Not achievable | AI token scan in `security.test.ts` covers `openai`, `anthropic`, `embedding`, `qdrant`, `langchain`, `llm(`, `LLM(` |
| Mutate the database via a Supabase client | Not achievable | DB mutation token scan covers `.insert(`, `.update(`, `.upsert(`, `.rpc(`, `.from(`; no Supabase client is in the dependency allowlist |
| Abuse a mutable wall-clock to create non-deterministic outputs | Not achievable | Wall-clock ban covers `Date.now(` and `new Date()` in every file except `shared/envelope.ts` (where `defaultNow` is defined); all service constructors accept `now: () => string` |

---

## 2. Source scan rules

The scan rules are implemented in `test/security.test.ts` as per-file, per-category assertions
over comment-stripped source. The following lists mirror the exact token arrays in that file.

### 2.1 FORBIDDEN_EXECUTION

Scanned across all `src/**/*.ts` files (block comments and single-line comments stripped):

```
child_process   spawn(   spawnSync   execSync   execFile
 exec(          .exec(   eval(       new Function(
```

### 2.2 FORBIDDEN_FS_WRITE

```
writeFile   appendFile   unlink   rmSync     rmdir
mkdir       renameSync   rename(  copyFile   chmod
chown       truncate     createWriteStream
```

### 2.3 FORBIDDEN_NETWORK

```
fetch(   XMLHttpRequest   new WebSocket
http.request   https.request   net.connect   net.createServer   dgram.
```

### 2.4 FORBIDDEN_IMPORTS

```
from 'node:child_process'   from "node:child_process"   from 'child_process'
from 'node:fs'              from "node:fs"               from 'fs'
from 'node:fs/promises'     from 'node:http'             from 'node:https'
from 'node:net'             from 'node:dgram'            from 'node:worker_threads'
from 'node:cluster'         require(
```

Note: `test/security.test.ts` itself legitimately imports `node:fs` (to read source files for
scanning). This file is under `test/`, not `src/`. The scan walks `src/` only.

### 2.5 DB mutation tokens (per-file)

```
.insert(   .update(   .upsert(   .rpc(   .from(
```

Note: `.delete(` is intentionally excluded from this check because in-memory `Map.delete()` and
`Set.delete()` are legitimate. No Supabase or database client is present in the dependency
allowlist, making the exclusion safe.

### 2.6 Wall-clock ban

- `Date.now(` — forbidden in all `src/**/*.ts` files including `shared/envelope.ts`.
- `new Date()` (argless) — forbidden in all files except `shared/envelope.ts`, which defines
  `defaultNow = (): string => new Date().toISOString()` as the single sanctioned clock boundary.
- `defaultNow()` (invocation) — forbidden outside `shared/envelope.ts` even in files that
  import it. All service constructors must accept and thread a `now: () => string` parameter.

### 2.7 AI token scan (whole-corpus)

Scanned across the concatenated stripped source of all `src/**/*.ts` files:

```
openai   anthropic   embedding   qdrant   Qdrant   langchain   llm(   LLM(
```

### 2.8 Advisory literal check

Two tests against `src/risk/RiskScoringService.ts`:
1. Raw source must contain `advisory: true`.
2. Comment-stripped source must also contain `advisory: true` — proving the literal is in
   production code, not only in a comment.

---

## 3. Dependency allowlist

`test/security.test.ts` enforces the exact dependency list via `assert.deepEqual`:

```
@letbuyy/lcis-adapters
@letbuyy/lcis-core
@letbuyy/lcis-governance
@letbuyy/lcis-operations
@letbuyy/lcis-tracking
@letbuyy/lcis-twin
zod
```

Adding any dependency outside this list causes the test suite to fail immediately. There are no
transitive production dependencies outside the LCIS workspace and zod; no HTTP client, no
filesystem utility library, no AI SDK is reachable.

`devDependencies` (`@types/node`, `typescript`) do not enter production code and are excluded
from the allowlist check.

### Package governance checks (also in `security.test.ts`)

- `package.json` `name` must be `@letbuyy/lcis-security`.
- `package.json` `type` must be `"module"` (ESM-only — no CommonJS entry point).
- `package.json` `scripts` must contain none of the mutation verbs `deploy`, `push`, `publish`,
  `migrate`. Current scripts: `build`, `typecheck`, `test` — all pass.

---

## 4. Read-only compliance summary

| Dimension | Status | Evidence |
|---|---|---|
| No subprocess execution | PASS | FORBIDDEN_EXECUTION scan + FORBIDDEN_IMPORTS scan |
| No filesystem writes | PASS | FORBIDDEN_FS_WRITE scan |
| No outbound network calls | PASS | FORBIDDEN_NETWORK scan + no HTTP client in allowlist |
| No database mutations | PASS | DB mutation token scan + no Supabase client in allowlist |
| No AI / embedding clients | PASS | AI token scan |
| No wall-clock misuse | PASS | Wall-clock ban + `defaultNow()` invocation ban |
| Advisory-only recommendations | PASS | `advisory: true` literal verified in stripped source |
| Dependency allowlist enforced | PASS | `assert.deepEqual(deps, [...])` in security.test.ts |
| ESM-only (no CommonJS) | PASS | `"type": "module"` governance check |
| No mutation scripts | PASS | Scripts governance check |
| Honesty: live signals NOT_CONNECTED | PASS | `IdentitySurface.connection` always `'NOT_CONNECTED'`; `AbuseSignal.connection` preserved from ops (always NOT_CONNECTED); `liveConnected: false` in every `SecurityReport` |
| `db-intel.json` adversarial input | PASS | Zod loose parse; error path returns empty topology |

---

## 5. Honest limitations

These are real constraints, not theoretical gaps. They do not affect the PASS verdict because
LSAS is explicit about them in every output it produces.

**Live security telemetry is absent until adapters are credentialed.** All `IdentitySurface`
entries carry `connection: 'NOT_CONNECTED'`. All `AbuseSignal` entries from
`SecurityOperationsService` carry `connection: 'NOT_CONNECTED'`. The exact env vars required
to connect each surface are named in `liveSource` and the `notConnected()` evidence entries.
Until `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TURNSTILE_SECRET_KEY`,
`UPSTASH_REDIS_REST_URL`, and `UPSTASH_REDIS_REST_TOKEN` are present in the runtime environment
and wired through `lcis-operations`, LSAS can detect structural risks but not live abuse rates,
auth failure rates, or credential event rates.

**Governance fallback domains surface real structural findings even on empty db-intel input.**
When `db-intel.json` is absent, `AttackGraphService` operates on twin topology only (the
summary notes "db-intel unavailable — entry/target detection is twin-topology-only"). The
`ThreatIntelligenceService` and `AbuseComplianceService` delegate entirely to
`lcis-governance` and `lcis-operations`, which have their own fallback behavior on empty graphs
(they return their findings from in-process graph data, not db-intel). Structural governance
findings remain available even when the data layer graph has not been extracted.

**Attack graph is structural, not exploit-verified.** A path in the `AttackGraph` means the
dependency twin can trace a graph edge from a public entry node to a sensitive table node.
It does not mean an exploit has been demonstrated or that the path is reachable in the deployed
application. The path is a structural risk indicator requiring human review.

**Risk score is computed only over connected signals.** `AbuseSignal` entries contribute to
`notConnectedSignals` but not to the risk weight sum (see `RiskScoringService.score()`). When
live telemetry is absent the risk score is a lower bound — the true operational risk may be
higher once abuse rates are measured.

**The package itself has no authentication or authorization.** LSAS is an in-process library,
not a service. Access control for who may call `getSecurityAnalyticsEngine()` is the
responsibility of the calling layer (e.g., `lcis-operations` API routes, the LCIS CLI, or
`graphify-mcp`). The package does not and cannot enforce caller authorization.

---

## 6. Verdict

**PASS.** `@letbuyy/lcis-security` meets the read-only, deterministic, advisory-only, and
honesty requirements of the LCIS constitution. The security scan gate in `test/security.test.ts`
is self-enforcing: it fails the suite the moment any forbidden primitive, import, AI token,
or dependency is introduced. The advisory literal, dependency allowlist, and package governance
checks are similarly machine-enforced. No manual step is required to maintain the security
posture of this package — the test suite is the gate.
