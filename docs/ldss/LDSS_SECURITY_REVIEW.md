# LDSS Security Review — Phase 17

**Scope:** `packages/lcis-decision/src/**`. **Verdict: PASS.**

## Threat model

| Threat | Control |
|---|---|
| Autonomous action / execution (the primary threat for a "decision" system) | SAFETY LAW scan forbids `.deploy(`/`applyDecision`/`executeDecision`/`apply(`/`.execute(`/`performAction`; every output is advisory; the facade has no mutating method |
| Mutation / code execution | scan forbids child_process/spawn/exec/eval/new Function |
| Filesystem writes | scan forbids writeFile/appendFile/unlink/rm/mkdir/rename/copyFile/createWriteStream |
| Network egress | scan forbids fetch/XMLHttpRequest/WebSocket/http.request/net.* and node:http/node:net imports |
| DB mutation | scan forbids `.insert(`/`.update(`/`.upsert(`/`.rpc(`/`.from(` |
| Non-deterministic clock | wall-clock banned outside the single `shared/envelope.ts` boundary |
| Hallucinated affected surface | AffectedSurfaceService only classifies nodes that actually exist in the twin; unknown subjects → empty NOT_CONNECTED surface |
| AI/LLM | scan forbids openai/anthropic/embedding/qdrant/langchain |
| Supply chain | dependency allowlist exactly `@letbuyy/lcis-{core,engineering,operations,twin}` + `zod` |

## Method

`test/security.test.ts` walks the full `src/` tree (comments stripped), asserting all classes above per file plus the dependency allowlist and mutation-verb-free scripts. Executed green (part of the 163-test suite).

## Honest limitations

Strategy scores are deterministic calibration constants encoding standard engineering tradeoffs — they are a decision *model*, not live outcome data; real risk/cost telemetry (NOT_CONNECTED) would refine them. The static scan is a tripwire, not a sandbox; the governance gate and human review remain authoritative.
