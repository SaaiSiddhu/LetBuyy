# P1_COST_MASTER — Write-Amplification, GraphQL Fan-Out, and Idle Spend

Parent: `LETBUYY_MASTER_EXECUTION_PLAN.md`
Scope: verified cost drivers. The first bottleneck is **Supabase OLTP**, not Cloudflare request pricing. Documentation only.
Modeling note: savings ranges are the prior reports' 1,000-merchant scenario (~40M storefront API req/month). Replace with real Cloudflare/Supabase/Vercel billing exports before acting on absolute numbers; the **ordering** of levers is robust regardless.

---

## Cost Lever Ranking (by impact × confidence)

| Rank | Lever | Finding | Est. monthly saving @1k merchants |
|---:|---|---|---:|
| 1 | Sample `worker_request_logs` (100% errors/payment/admin, 1–5% anon GET) | COST-1 | $300–$2,500 (Supabase compute/storage) |
| 2 | Migrate hot reads to Hyperdrive/pooled SQL (it's already paid for) | COST-13 | latency + indirect compute; unblocks caching |
| 3 | Edge-cache public REST storefront reads | PERF-1 (see P2) | $450–$3,800 combined with #1 |
| 4 | Fix GraphQL fan-out (don't re-enter middleware per field) | MISSED-6/9/10 | $100–$1,500 + latency |
| 5 | Cron no-op + stop always-enqueue completion event | COST-2/3 | $50–$600 |
| 6 | Reduce log `head_sampling_rate` from 1.0 | COST-4 | $50–$500 |
| 7 | Single atomic rate-limit op; drop the redundant 2nd/3rd limiter | COST-8/MISSED-9 | $50–$800 |
| 8 | Batch/trim queue-worker per-message writes (3→1) | COST-5 | $20–$400 |
| 9 | Fix bulk double-processing | MISSED-7 | $20–$400 + reliability |

---

## P1-1 — Request-Log Sampling (COST-1)

### Change
`services/api-gateway/src/middleware/observability.ts:97-127` currently calls `recordRequestLog` in `waitUntil` for every request. Introduce sampling:
- Always log: status ≥ 400, payment routes (`/payments`, `/storefront/**/orders`, internal payment), admin/operations routes, auth.
- Sample: anonymous successful storefront GETs at 1–5% (config `REQUEST_LOG_SAMPLE_RATE`).
- Long-term: stream full logs to Cloudflare Logpush → R2/SIEM instead of OLTP (`execution/observability-execution.adapter.ts:51`).

### File-by-file
| File | Change |
|---|---|
| `services/api-gateway/src/middleware/observability.ts` | add sampling decision before `recordRequestLog` |
| `services/api-gateway/src/execution/observability-execution.adapter.ts` | add a batched/buffered insert path; expose `recordError` always |
| `services/api-gateway/wrangler.toml` | add `REQUEST_LOG_SAMPLE_RATE` var; later add Logpush config |

### Migration / Rollback / Testing / Acceptance
- No DB migration (optional: add `sampled boolean` to `worker_request_logs`).
- Rollback: set `REQUEST_LOG_SAMPLE_RATE=1.0` to restore prior behavior instantly.
- Test: synthetic 1,000 anon GETs → ~1–5% logged; 50 error/payment requests → 100% logged.
- Acceptance: error/payment/admin observability is lossless; anon storefront log volume drops ≥95%.

**Complexity:** M. **Risk:** Low.

---

## P1-2 — Activate Hyperdrive / Pooled SQL (COST-13, SCALE-2)

### Change
The `HYPERDRIVE` binding (`api-gateway/wrangler.toml:139-141,230-232`) is declared but never used; all reads go via PostgREST HTTP (`packages/infrastructure/supabase-adapter/index.ts:59-79`). Introduce a pooled SQL path for hot read queries (storefront catalog, store/theme bootstrap) using the Hyperdrive connection string, keeping PostgREST for writes/RPC initially.

### Approach (phased, low-risk)
1. Add a `getPooledSql(env)` helper in `packages/infrastructure/` using `postgres`/`pg` over the Hyperdrive binding.
2. Migrate read-only hot paths first: `loadPublishedStore`, `loadCurrentThemeRelease`, `queryPublicProducts` (`storefront.ts:548,636,827`).
3. Leave RPCs (`create_checkout_order`, payment ledger) on the existing client until proven.

### Migration / Rollback / Testing / Acceptance
- No schema change. Add `DATABASE_URL`/Hyperdrive secret (already bound).
- Rollback: feature-flag `USE_POOLED_READS=off` → revert to PostgREST.
- Test: p95 latency comparison PostgREST vs Hyperdrive on the three hot reads under load.
- Acceptance: hot reads run on pooled SQL with measurable p95 improvement; no behavior change.

**Complexity:** L. **Risk:** High (DB access path change — do behind a flag, reads-only first).

---

## P1-3 — GraphQL Fan-Out Cost (MISSED-6, MISSED-9, MISSED-10)

### Problem
GraphQL resolvers issue one internal REST sub-request per field via `app.fetch` (`index.ts:171`), which re-enters observability + both rate limiters. A multi-field Admin query (`graphql/admin.ts:555-564`, up to 10 connections) generates 10+ log rows and 20+ KV ops, plus a third limiter (`admin.ts:660`).

### Change
1. Mark internal sub-requests with an `X-LetBuyy-Internal-Subrequest` header set by the REST-shim delegate (`graphql/rest-shim.ts:43-57`).
2. In `observability.ts` and `rateLimit.ts`, short-circuit logging and skip the per-`/v1/*` limiters for internal sub-requests (the parent GraphQL request is already limited once at `admin.ts:660`).
3. Where possible, resolve sibling connection fields by calling execution adapters directly instead of round-tripping HTTP.

### Migration / Rollback / Testing / Acceptance
- No DB change.
- Rollback: remove the header check.
- Test: a 5-field Admin GraphQL query produces **1** parent log row (not 6) and **1** rate-limit decision.
- Acceptance: GraphQL per-query OLTP log writes and KV ops are O(1), not O(fields).

**Complexity:** M. **Risk:** Med (must not let the bypass header be settable by external clients — strip it at the edge).

---

## P1-4 — Cron No-Op + Stop Routine Completion Events (COST-2, COST-3)

### Change
`runScheduledDispatch` (`index.ts:275-323`):
1. Preflight: cheaply check whether any outbox/queue work is pending; if none, return without enqueuing.
2. Only enqueue `runtime.scheduled_dispatch.completed` when work was processed or on failure (not every minute).
3. Make staging cron opt-in (`STAGING_CRON_ENABLED`) or reduce to `*/5`.

### Rollback / Testing / Acceptance
- Rollback: revert the preflight guard.
- Test: idle environment for 10 minutes → 0 completion events enqueued; with pending outbox rows → processed + 1 event.
- Acceptance: idle environments generate no queue/queue-worker work from cron.

**Complexity:** S. **Risk:** Low.

---

## P1-5 — Log Sampling Config on Workers (COST-4)

### Change
`api-gateway/wrangler.toml:10-17,80-87,171-178` and `queue-workers/wrangler.toml:10-17,99-107,196-201`: lower `head_sampling_rate` to a targeted value (e.g., 0.1) and keep `invocation_logs` for errors only where supported; pair with Logpush for full-fidelity error capture.

### Acceptance
Worker log retention cost drops materially with no loss of error visibility (errors captured via Logpush/error sampling).

**Complexity:** S. **Risk:** Low.

---

## P1-6 — Atomic Rate Limiting, Drop Redundant Limiter (COST-8, MISSED-9)

### Change
1. Replace KV read+write (`rateLimit.ts:203-207,328-333`) and the two-round-trip Redis path (`:369-404`) with a single atomic op: a Durable Object token-bucket, or a Redis Lua script.
2. Reconsider running **both** `queryCostRateLimit` (`index.ts:168`) and `rateLimit({max:300})` (`index.ts:195`) on every authenticated request — collapse to one policy for most routes; keep query-cost only on expensive/anonymous routes.
3. Skip limiters entirely on cacheable public GETs once edge cache (P2) is in front.

### Rollback / Testing / Acceptance
- Rollback: re-enable the prior limiter functions.
- Test: one authenticated request performs one rate-limit decision, not two/three.
- Acceptance: ≤1 rate-limit storage round-trip per request on the hot paths.

**Complexity:** M. **Risk:** Med.

---

## P1-7 — Queue-Worker Per-Message Writes (COST-5) + Bulk Double-Processing (MISSED-7, MISSED-8)

### Change
1. `queue-workers/src/index.ts:62,86,107`: collapse the per-message `distributed_queue_messages` upsert + 2× `runtime_telemetry_metrics` inserts into a single batched write per `queue()` batch; drop the lag metric to sampling.
2. `graphql/bulk.ts:513,520`: pick **one** execution path — either enqueue to `RUNTIME_QUEUE` and add a real `graphql-bulk` consumer handler in `queue-workers`, or process in `waitUntil` and stop enqueuing. Do not do both. Replace per-row full-GraphQL requests (`:349-375`) with direct execution-adapter calls.
3. `graphql/bulk.ts:174-203`: stop rewriting the full actor-index JSON on every transition; append-only or DO-backed state.

### Rollback / Testing / Acceptance
- Rollback: revert to per-message writes / dual path.
- Test: one CF batch of N messages → 1 batched DB write; a bulk op of K rows runs once (not twice) and does no per-row HTTP fan-out.
- Acceptance: queue DB writes scale sub-linearly with message count; bulk ops are processed exactly once.

**Complexity:** L. **Risk:** Med.

---

## Cost Guardrails (cross-cutting)
- Add hard spend alerts and budgets on Cloudflare + Supabase + Vercel (no code; ops config).
- Add per-queue budgets + circuit breakers + deterministic-error quarantine (`queue-workers/src/index.ts:177`) so retry storms can't run unbounded (ties to P3).
- WAF rate rules for anonymous public storefront floods.

## Acceptance for P1 overall
- Idle environments cost near-zero (no minute cron work, no routine completion events).
- Anonymous storefront traffic does not write an OLTP log row each.
- A GraphQL query costs O(1) logs/limits, not O(fields).
- Hyperdrive is in the hot read path (or an explicit decision is recorded to remove the binding).
