# LCIS V3 Execution Engine

**Phase 26 · `tools/central-intelligence/execution-engine/`**

The ExecutionEngine is the action-runtime layer of LCIS V3. It provides a single, controlled surface for executing operations against LCIS subsystems. The engine's defining property is that it is read-only by construction — not by convention — enforced at the code boundary before any subsystem is ever imported.

---

## 1. Purpose

LCIS V3 introduced the need to execute structured, observable operations against running subsystems: storefront validation, health checks, diagnostics, repository analysis, architecture scans, security scans. The ExecutionEngine provides this capability under an absolute safety contract: every execution is whitelisted, audited, cached, and trivially reversible because all actions are read-only.

The engine also provides a tamper-evident audit chain stored at `graphify-out/execution-audit/audit.jsonl`, making every execution traceable across restarts.

---

## 2. The Safety Contract

> **Safety is code, not convention.**
>
> `SafetyGuard.validate(action, params)` is the very first call inside `execute()`, before any other logic, before any subsystem import, before any dispatch. A REJECTED result short-circuits immediately and is audited. No whitelisting error, no subsystem bug, and no future code path can bypass this gate — because the gate runs before those code paths exist in the call stack.
>
> Mutating verb detection runs **before** the whitelist check. An action named `create_health_report` is rejected for containing `create` before the engine even checks whether it is whitelisted.

---

## 3. Default-Deny Whitelist and Mutating Verb Ban

### Whitelisted actions (the complete set)

SafetyGuard maintains a `Set` of exactly 10 permitted action names. Any action not present is rejected with a clear reason. The whitelist is case-insensitive and trims surrounding whitespace before matching.

| Action | Description |
|---|---|
| `run_validation` | Playwright-based storefront validation |
| `run_health_check` | Health checks across all LCIS subsystems |
| `run_diagnostics` | Subsystem diagnostics (context / memory / graph) |
| `run_repository_analysis` | Repository analysis via context-intelligence |
| `run_architecture_scan` | Architecture topology scan |
| `run_security_scan` | Security analysis scan |
| `get_audit_log` | Retrieve the execution audit log |
| `get_execution_result` | Retrieve a result by ID from the in-memory cache |
| `get_actions` | Return all registered action metadata |
| `get_action` | Return metadata for a single action by name |

### Mutating verb ban (26 banned substrings)

Any action name whose lowercased form contains one of these substrings is rejected, regardless of whether it appears on the whitelist. The check also applies to string-valued parameters.

| | | | | |
|---|---|---|---|---|
| `deploy` | `write` | `insert` | `update` | `delete` |
| `mutate` | `pay` | `charge` | `refund` | `push` |
| `commit` | `merge` | `create` | `drop` | `truncate` |
| `execute_payment` | `send` | `publish` | `migrate` | `rollback` |
| `reset` | `remove` | `destroy` | `overwrite` | `patch` |
| `put` | `post` | | | |

**Parameter-level check.** SafetyGuard also iterates every string-valued parameter and applies the same mutating-verb scan. A whitelisted action with a parameter value containing a banned verb is rejected before dispatch.

---

## 4. The Safe Action Catalog

Ten actions are registered in ActionRegistry. All are `readOnly: true` and `reversible: true`.

| Action | Subsystem | What it runs | Required params |
|---|---|---|---|
| `run_validation` | `browser-intelligence` | `BrowserIntelligenceEngine.validateStorefront()` — Playwright read-only scan, no payment flows | `storeUrl: string` |
| `run_health_check` | `observability` | `HealthService.check()` across all connected LCIS subsystems | — |
| `run_diagnostics` | `multi` | Routes to ContextDiagnostics, MemoryHealthMonitor, or GraphDiagnostics | `subsystem: 'context' \| 'memory' \| 'graph'` |
| `run_repository_analysis` | `context-intelligence` | `ContextDiagnostics` + `ContextCompressionPipeline` (read-only scan) | — |
| `run_architecture_scan` | `architecture-intelligence` | `ArchitectureIntelligenceEngine.analyze()` (or `.scan()` / `.run()`) | — |
| `run_security_scan` | `reasoning` | `SecurityReasoner` + V1 LCIS `GET /api/security-intelligence` (8 s timeout) | — |
| `get_audit_log` | `execution-engine` | `ExecutionAuditor.getAuditLog()` — filterable by action, status, limit | `action?`, `status?`, `limit?` |
| `get_execution_result` | `execution-engine` | In-memory result cache lookup (max 500 entries, evicts oldest) | `id: string` |
| `get_actions` | `execution-engine` | Returns all entries from ActionRegistry | — |
| `get_action` | `execution-engine` | O(1) lookup from ActionRegistry index | `name: string` |

---

## 5. Four Properties: Auditable · Observable · Reversible · Safe

**Auditable.** Every execution — including REJECTED ones — is written to `graphify-out/execution-audit/audit.jsonl` via `ExecutionAuditor.record()`. The file is append-only JSONL. The audit write is fire-and-forget: an audit failure is logged as a warning but never propagates to the caller.

**Observable.** Completed executions are stored in an in-memory `Map` keyed by `id`, bounded to 500 entries (oldest-first eviction). Any result can be retrieved by ID via `get_execution_result` for the lifetime of the process.

**Reversible.** Because every action is read-only, there is no state to undo. Reversibility is structurally guaranteed: `reversible: true` is a constant field on every `ExecutionResult`, not a runtime decision.

**Safe.** The SafetyGuard gate is the first line of `execute()`. It runs before the dispatch `switch`, before any `import()`, before any subsystem code. A REJECTED action never touches a subsystem.

---

## 6. Tamper-Evident Audit Chain

`ExecutionAuditor` implements a SHA-256 linked hash chain over the JSONL file at `graphify-out/execution-audit/audit.jsonl`.

### How the chain is built

Each entry is written in two steps:

1. Build the entry object without the `hash` field, including `prevHash` (the hash of the previous entry).
2. Compute `hash = SHA-256(JSON.stringify(entryWithoutHash))`.
3. Append `{ ...entryWithoutHash, hash }` as a single JSON line.

This means any modification to any field of any entry — or to the ordering of entries — breaks the chain from that point forward, because the expected hash will no longer match the recomputed hash of the (now-modified) content.

### Genesis hash

The initial `prevHash` is `'0'.repeat(64)` — 64 zero characters. On process startup, `ExecutionAuditor` reads the last line of the existing file (if present) and loads its `hash` as the working `_lastHash`, allowing the chain to continue across restarts without gaps.

### JSONL entry schema

| Field | Type | Description |
|---|---|---|
| `auditId` | `string` | UUID assigned by the auditor |
| `executionId` | `string \| null` | The `id` from the ExecutionResult |
| `action` | `string` | Action name |
| `params` | `object` | Input parameters |
| `status` | `string` | `SUCCESS`, `FAILED`, or `REJECTED` |
| `safe` | `boolean` | Always `true` |
| `mutating` | `boolean` | Always `false` |
| `reversible` | `boolean` | Always `true` |
| `durationMs` | `number \| null` | Execution duration |
| `outputSummary` | `string \| null` | First 500 chars of serialized output (truncated with `…`) |
| `error` | `string \| null` | Error message for FAILED or REJECTED entries |
| `timestamp` | `string` | ISO-8601 |
| `prevHash` | `string` | SHA-256 of the previous entry; `'0'.repeat(64)` for genesis |
| `hash` | `string` | SHA-256 of this entry's content (the object excluding `hash` itself) |

### `verifyAuditIntegrity()`

Reads all lines, recomputes each entry's expected hash, and checks that `entry.prevHash` matches the preceding entry's recorded `hash`. Returns:

```js
{ valid: boolean, totalEntries: number, firstBrokenAt?: number }
```

`firstBrokenAt` is the zero-based line index of the first broken link. If the chain is intact, the field is absent. An empty file returns `{ valid: true, totalEntries: 0 }`.

---

## 7. Class Reference

### `ExecutionEngine` — `ExecutionEngine.mjs` (463 lines)

The public facade. Singleton export (`export default new ExecutionEngine()`).

| Method | Signature | Description |
|---|---|---|
| `execute` | `(action: string, params?: object) → Promise<ExecutionResult>` | Primary entry point. Runs SafetyGuard, dispatches, audits. |
| `runValidation` | `(storeUrl: string) → Promise<ExecutionResult>` | Convenience wrapper for `run_validation`. |
| `runHealthCheck` | `() → Promise<ExecutionResult>` | Convenience wrapper for `run_health_check`. |
| `runDiagnostics` | `(subsystem: string) → Promise<ExecutionResult>` | Convenience wrapper for `run_diagnostics`. |
| `runRepositoryAnalysis` | `() → Promise<ExecutionResult>` | Convenience wrapper for `run_repository_analysis`. |
| `runArchitectureScan` | `() → Promise<ExecutionResult>` | Convenience wrapper for `run_architecture_scan`. |
| `runSecurityScan` | `() → Promise<ExecutionResult>` | Convenience wrapper for `run_security_scan`. |
| `getAuditLog` | `(filter?: object) → Promise<ExecutionResult>` | Proxies `ExecutionAuditor.getAuditLog()` through the execution pipeline. |
| `getExecutionResult` | `(id: string) → Promise<ExecutionResult>` | Retrieves a result from the in-memory cache. |

**Lazy imports.** Every subsystem (`BrowserIntelligenceEngine`, `HealthService`, `ContextDiagnostics`, `ContextCompressionPipeline`, `ArchitectureIntelligenceEngine`, `SecurityReasoner`) is imported inside the relevant `_exec*` private method using dynamic `import()`. If the import fails, the method returns `{ status: 'DEGRADED', reason: '...', detail: err.message }` rather than throwing. The engine boots and serves registry and audit endpoints even when every subsystem is unavailable.

---

### `SafetyGuard` — `SafetyGuard.mjs`

Singleton export. Stateless: holds only the frozen `WHITELIST` Set and `MUTATING_VERBS` array.

| Method | Description |
|---|---|
| `validate(action, params)` | Returns `{ safe: true }` or `{ safe: false, reason: string }`. Checks mutating verbs first, then whitelist, then param string values. |
| `isSafe(action)` | Returns `true` only if the action is on the whitelist (case-insensitive, trimmed). |
| `assertReadOnly(action)` | Throws `Error` with `code: 'SAFETY_REJECTED'` if not safe. Use as a guard assertion in callers. |
| `getWhitelist()` | Returns the whitelist as a sorted array. |
| `explainRejection(action)` | Returns a human-readable rejection explanation naming the specific verb or listing permitted actions. |

---

### `ExecutionAuditor` — `ExecutionAuditor.mjs`

Singleton export. Maintains `_lastHash` in memory; lazy-initialises on first `record()` or `getAuditLog()` call by reading the last line of the existing file.

| Method | Description |
|---|---|
| `record(execution)` | Appends one JSONL entry to the audit file; returns the new `auditId`. |
| `getAuditLog(filter?)` | Returns parsed entries, optionally filtered by `action`, `status`, `limit`. |
| `getAuditTrail(executionId)` | Returns all entries matching a specific `executionId`. |
| `verifyAuditIntegrity()` | Full chain integrity check. Returns `{ valid, totalEntries, firstBrokenAt? }`. |
| `getStats()` | Aggregate counts by status and action, average `durationMs`, and the `auditFile` path. |

---

### `ActionRegistry` — `ActionRegistry.mjs`

Singleton export. The catalog is `Object.freeze()`-d — no runtime mutations are possible. An internal `Map` (`INDEX`) provides O(1) lookup by name.

| Method | Description |
|---|---|
| `getActions()` | Returns the full frozen array of 10 action descriptors. |
| `getAction(name)` | O(1) Map lookup; returns `null` if not found. |
| `isRegistered(name)` | Returns `true` if the action name is in the registry. |

---

## 8. ExecutionResult Schema

Every call to `execute()` returns an `ExecutionResult` regardless of outcome.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | UUID generated at the start of `execute()` |
| `action` | `string` | The action name as provided |
| `params` | `object` | The params object as provided |
| `status` | `'SUCCESS' \| 'FAILED' \| 'REJECTED'` | Outcome |
| `safe` | `true` | Constant — always `true` |
| `mutating` | `false` | Constant — always `false` |
| `reversible` | `true` | Constant — always `true` |
| `output` | `any` | The value returned by the subsystem, or `null` |
| `durationMs` | `number` | Wall-clock time from entry to result construction |
| `auditId` | `string \| null` | Set after `ExecutionAuditor.record()` completes; `null` if the audit write failed |
| `timestamp` | `string` | ISO-8601 timestamp captured at the start of `execute()` |
| `error` | `string \| null` | Error message for `FAILED` / `REJECTED`; `null` on `SUCCESS` |

---

## 9. API Endpoints

The ExecutionEngine is exposed via the LCIS V2 intelligence API server at `tools/central-intelligence/intelligence-api/server.mjs` (lines 1006–1024).

| Method | Path | Body / Query | Description |
|---|---|---|---|
| `POST` | `/intelligence/execute` | `{ action: string, params?: object }` | Execute a whitelisted action. SafetyGuard runs inside the engine. Returns an `ExecutionResult`. Returns `400` if `action` is absent from the body. |
| `GET` | `/intelligence/execute/actions` | — | Returns `{ actions: [...] }` from `ActionRegistry.getActions()`. |
| `GET` | `/intelligence/execute/audit` | — | Returns the full audit log array from `ExecutionAuditor.getAuditLog()` (unfiltered). |

All endpoints return `503` if the relevant engine or registry fails to load.

---

## 10. Proven in Production

### Rejected actions

| Action | Rejection reason | Verb matched |
|---|---|---|
| `deploy_to_production` | Contains mutating verb | `deploy` |
| `delete_order` | Contains mutating verb | `delete` |
| `insert_payment` | Contains mutating verb | `insert` |

All three produce `status: 'REJECTED'` in the returned `ExecutionResult`. All three are written to the audit log before returning to the caller — REJECTED actions are fully audited.

### Successful action

| Action | Outcome |
|---|---|
| `run_health_check` | `status: 'SUCCESS'` — HealthService check completed; output returned |

### Audit chain integrity

`ExecutionAuditor.verifyAuditIntegrity()` returned `{ valid: true, totalEntries: N }` with no `firstBrokenAt` field, confirming the SHA-256 hash chain is intact across all entries in `graphify-out/execution-audit/audit.jsonl`.
