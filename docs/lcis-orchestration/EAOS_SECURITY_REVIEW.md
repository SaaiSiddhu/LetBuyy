# EAOS Security Review — `@letbuyy/lcis-orchestration` (LCIS Phase 8)

**Scope:** every file under `packages/lcis-orchestration/src/` plus the four access-layer
integrations (`lcis-cli`, `lcis-mcp`, `services/lcis-api`, `lcis-pr-check`).
**Posture under review:** EAOS is a READ-ONLY execution-tracking layer. It must be structurally
incapable of executing, deploying, mutating, writing, or calling out. Humans/agents execute;
EAOS observes.

---

## 1. Threat model

| Threat | Why it matters here |
|---|---|
| Command execution (`exec`/`spawn`/`child_process`) | An "orchestration" layer is the classic place where autonomous execution creeps in. RULE 3 of the Phase 8 mandate forbids it absolutely. |
| Filesystem mutation (`writeFile`, `unlink`, `mkdir`, …) | EAOS reports state; it must never modify the repo, artifacts, or generated outputs. |
| Network egress (`fetch`, `http.request`, sockets) | All live values are honestly `NOT_CONNECTED`; any hidden network call would either fabricate them or exfiltrate repo intelligence. |
| DB mutation (`.insert`/`.update`/`.delete`/`.upsert`/`.rpc`) | The repo's canonical-ledger law: money mutations only via SECURITY DEFINER RPCs called by production services — never by an intelligence layer. EAOS calls none at all. |
| AI/LLM/embedding calls | RULE 2: no AI, no LLM, no embeddings, no autonomous reasoning. Determinism is a security property here — outputs must be reproducible and auditable. |
| Fabricated live data | The honesty contract is a security control: a fabricated "COMPLETED" or ETA is an integrity failure that downstream launch decisions would consume. |

## 2. Method

1. **Manual source inspection** — every import and call site in `src/` was inspected:
   - The only cross-package imports are `@letbuyy/lcis-core`, `@letbuyy/lcis-engineering`
     (types + the reused `createEngineeringEngine` facade), and the package's own modules.
   - `grep` over `src/` for `node:fs`, `child_process`, `node:http`, `node:net`,
     `.exec(`, `.insert(`, `.update(`, `.delete(`, `.upsert(`, `.rpc(`, `rename(`, `mkdir`
     returned **zero code hits** (the only matches are prose inside doc comments, which the
     enforcement suite strips before scanning).
   - `OrchestrationArtifactStore` (`src/shared/artifact-store.ts`) imports only
     `type { LcisEngine }` from lcis-core — it is a read-only reader over the already-loaded
     engine; **no new IO** is introduced anywhere in the package.
2. **Enforced source-scan test suite** — `test/security.test.ts` walks the entire `src/` tree
   recursively (fails if the walk finds fewer than 20 files or misses any of the nine
   `shared/engine/execution/agent/artifact/validation/status/rollout/timeline` directories,
   so new files cannot dodge the scan) and, per file, strips comments and asserts the absence of:
   - **Execution:** `child_process`, `spawn(`, `spawnSync`, `execSync`, `execFile`, ` exec(`,
     `.exec(`, `eval(`, `new Function(`
   - **FS mutation:** `writeFile`, `appendFile`, `unlink`, `rmSync`, `rmdir`, `mkdir`,
     `renameSync`, `rename(`, `copyFile`, `chmod`, `chown`, `truncate`, `createWriteStream`
   - **Network:** `fetch(`, `XMLHttpRequest`, `new WebSocket`, `http.request`, `https.request`,
     `net.connect`, `net.createServer`, `dgram.`
   - **IO-capable imports:** `node:child_process`, `node:fs` (+`/promises`), `node:http`,
     `node:https`, `node:net`, `node:dgram`, `node:worker_threads`, `node:cluster`, `require(`
   - **DB mutation:** `.insert(`, `.update(`, `.delete(`, `.upsert(`, `.rpc(`
   - **AI:** `openai`, `anthropic`, `embedding`, `qdrant`, `langchain` across the whole tree
3. **Dependency allowlist test** — `package.json` dependencies must be exactly the six approved
   composition targets: `@letbuyy/lcis-core`, `@letbuyy/lcis-engineering`,
   `@letbuyy/lcis-execution`, `@letbuyy/lcis-governance`, `@letbuyy/lcis-operations`, `zod`.
   Any added dependency fails the suite. Scripts are scanned for the mutation verbs
   `deploy`/`push`/`publish`/`migrate`.

## 3. Findings

| # | Area | Finding | Status |
|---|---|---|---|
| 1 | Execution primitives | None present in `src/` (comment mentions only). | ✅ CLEAN |
| 2 | Filesystem writes | None present; the artifact store composes lcis-core with no new IO. | ✅ CLEAN |
| 3 | Network egress | None present; every "live" value is `NOT_CONNECTED` + named source. | ✅ CLEAN |
| 4 | DB access | None at all — EAOS never touches Supabase/Postgres, read or write. | ✅ CLEAN |
| 5 | AI/LLM usage | None; all reasoning is deterministic transforms over the EINS package. | ✅ CLEAN |
| 6 | Fabrication | `completed`/`eta`/durations are `null` + `NOT_CONNECTED`; confidence is 0 for unconnected signals; `liveConnected` is hard-false everywhere. | ✅ CLEAN |
| 7 | Access layers | CLI/MCP/API/PR-check handlers only call `getOrchestrationEngine()` report methods and render envelopes. The only file write on any surface remains the pre-existing, user-explicit `--export`/`--out` path (traversal-guarded in `lcis-pr-check/src/cli.ts::safeOutputPath`), unchanged by Phase 8. | ✅ CLEAN |
| 8 | Determinism | All services accept an injectable `now()` clock; the facade test suite asserts two runs under a fixed clock produce identical output. | ✅ CLEAN |

**No violations found. No exceptions requested.**

## 4. Residual risks & honest limitations

- The source-scan is token-based. It strips comments and covers the realistic primitive
  surface, but a determined insider could still obfuscate a call (e.g. computed
  `globalThis` access). The 107-validator deterministic gate and human review remain the
  authoritative backstop; this suite is a tripwire, not a sandbox.
- The scan governs `packages/lcis-orchestration/src/` only. The access layers are covered by
  their own packages' existing read-only contracts and tests.
- When a real execution-tracking source is wired in the future (CI / git / task store), the
  adapter must live behind the same read-only, credential-at-deploy-time rules as
  `lcis-adapters` — EAOS itself must stay IO-free.

## 5. Verdict

**SECURITY REVIEW: PASS (structural).** The package is read-only by construction and by
continuously-enforced test. Run results for the enforcement suite are recorded in
[EAOS_TEST_REPORT.md](EAOS_TEST_REPORT.md).
