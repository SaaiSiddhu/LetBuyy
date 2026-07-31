# LBIS Security Review — Phase 16

**Scope:** `packages/lcis-business/src/**`. **Verdict: PASS.**

## Threat model

| Threat | Control |
|---|---|
| Fabricated business numbers (the primary integrity threat here) | `notConnectedMetric()` is the only metric constructor and cannot emit a value; static scan fails on any `value: <number>` literal in src; per-metric runtime assertions in every service test |
| Mutation / execution | recursive source scan forbids exec/spawn/child_process/eval/Function |
| Filesystem writes | scan forbids writeFile/appendFile/unlink/rm/mkdir/rename/copyFile/chmod/createWriteStream |
| Network egress | scan forbids fetch/XMLHttpRequest/WebSocket/http.request/net.* and node:http/node:net imports |
| DB mutation | scan forbids `.insert(`/`.update(`/`.upsert(`/`.rpc(`/`.from(` |
| Non-deterministic clock | wall-clock (`Date.now(`, argless `new Date()`) banned outside the single `shared/envelope.ts` boundary |
| Autonomous action | scan forbids `.deploy(`/`applyRecommendation`/`executeDecision`; every recommendation is `advisory: true` |
| AI/LLM | scan forbids openai/anthropic/embedding/qdrant/langchain |
| Supply chain | dependency allowlist is exactly `@letbuyy/lcis-{core,adapters,operations,tracking,twin}` + `zod` |

## Method

`test/security.test.ts` walks the full `src/` tree (comments stripped), asserting all of the above per file, plus the dependency allowlist and mutation-verb-free scripts. Executed green.

## Honest limitations

The static scan is token-based (a tripwire, not a sandbox); the 107-validator governance gate and human review remain authoritative. No provider credentials exist in-repo; all live paths activate only when ops wires the named sources at deploy time.
