# LETBUYY — SERVICE TOPOLOGY REPORT
### Phase 5 of the Foundation Autopsy · 2026-06-09 · evidence-only
### Question: is the declared topology the real topology, or does the system secretly operate differently?

---

## 1. The declared production topology vs reality

V1 §6 names the production runtimes: `api-gateway` (the monolith), `queue-workers`, `mobile-bff`, `webhook-service`, plus the `merchant-control-plane` / `storefront-runtime` / `identity-platform` web apps and the Flutter merchant app. **That set is real and accurate** — but two things are true that the topology diagram hides.

### 1a. The four backend services — real, correctly sized, with one leak

| Service | Real source | Deploy config | Scope verdict |
|---|---|---|---|
| `api-gateway` | 248 files, the monolith | `wrangler.toml` (Hyperdrive, KV, R2, D1, Queues, Durable Object) | **Real monolith; over-loaded** (hosts GraphQL, execution adapters, extensions, DO) |
| `queue-workers` | small real source (`platform-queue-consumer.ts` 1029, `index.ts` 556) | `wrangler.toml` (7 queue consumers + DLQs) | **Correctly scoped**, but imports rejected `orchestration`/`runtime-composition` |
| `mobile-bff` | ~219-line `src/index.ts` | `wrangler.toml` (service binding → api-gateway, no DB) | **Correctly scoped** — thin transport |
| `webhook-service` | ~1,327-line `src/index.ts` + dispatchers | `wrangler.toml` | **Correctly scoped** — outbound webhooks |

The earlier-suspicious line counts (queue-workers showing ~88k lines, etc.) were a false alarm: those are **git-ignored `.wrangler/tmp/dev-*/index.js` dev bundles**, not committed source. `git status --ignored` shows them as `!!`. **No committed-bundle governance violation.** The three async services are genuinely small and properly scoped.

### 1b. Reserved services are genuinely empty — full marks

All six reserved roots contain exactly `runtime.manifest.json` + `AGENTS.md`, **zero source files**:
`services/{checkout-runtime, event-bus, notification-service, analytics-pipeline, media-service, search-service}`. This is full compliance with V1 §6 and Mandated Conflict #2. No reserved service is accidentally active; their capabilities live in `api-gateway` modules and `queue-workers` jobs, exactly as the Freeze requires. This is one of the cleanest disciplines in the repo.

---

## 2. The hidden topology: an undocumented execution/CQRS layer inside the monolith

The real "hidden architecture" is **not** a rogue service or a second data plane — it is an indirection layer *inside* `api-gateway` that wires the V1-rejected packages onto the request path:

- `services/api-gateway/src/execution/*-execution.adapter.ts` — **12 execution adapters** (idempotency, outbox, queue, observability, payment, order, theme, …) that sit between route handlers and domain logic.
- They import `@letbuyy/application-services` (all 12), `@letbuyy/orchestration` (idempotency/observability/outbox/queue adapters), and `@letbuyy/runtime-composition` (queue adapter).
- **30 route files** import these adapters — every major commerce flow (`checkout`, `payments`, `orders`, storefront cart/checkout) is routed through the CQRS/saga indirection.
- A live Cloudflare **Durable Object** `LetbuyyRuntimeDurableObject` (`services/api-gateway/src/durable/runtime-coordinator.ts`) holds checkpoint/coordination state — distributed-runtime machinery deployed inside the "monolith."

So the system *describes itself* as a modular monolith but *operates* as a monolith-shell over an event-sourced/CQRS execution core. That core is exactly what V1 R-4/R-5 reject. The topology is honest about service count and dishonest about internal complexity.

---

## 3. The data plane: clean (the one place reality beats the diagram)

The "second data plane" hypothesis — that Next.js apps hold service-role DB access and bypass the gateway — is **disproven**:

- Repo-wide grep for `createClient(` / `SERVICE_ROLE` / `service_role` in `apps/**` → **0 hits**. The only Supabase client owners are `services/api-gateway`, `services/webhook-service`, and `packages/infrastructure` — exactly where `AGENTS.md:66` requires.
- Apps reach data through the gateway/BFF: `merchant-control-plane` has 41 gateway-fetch references, `storefront-runtime` 8, `platform-console` 10, `platform-operations-portal` 9. Single data plane: apps → gateway → Postgres.
- The `supabase` strings that do appear in `apps/` are benign: image-CDN host allowlists (`*.supabase.co`) and documentation strings.

This matters because it bounds the blast radius of the tenancy problem (see DATABASE report): the dangerous `service_role` key lives in exactly one place (the gateway), not scattered across nine Next apps.

---

## 4. Service-binding & resource topology (verified from `wrangler.toml`)

| Binding | api-gateway | queue-workers | webhook-service | mobile-bff |
|---|---|---|---|---|
| Hyperdrive (PG pool) | ✅ | — | — | — |
| KV (`CACHE`) | ✅ | — | — | — |
| R2 (media) | ✅ | — | — | — |
| D1 (`RUNTIME_DB`) | ✅ | — | — | — |
| Queues | ✅ 5 producers | ✅ 7 consumers + DLQs | — | — |
| Durable Object | ✅ `LetbuyyRuntimeDurableObject` | — | — | — |
| Service binding | → webhook | → api-gateway | → api-gateway | → api-gateway |

This matches V1 §3 (one region ap-south, Hyperdrive pooling, mobile-bff/webhook with no DB). Committed IDs are non-secret resource identifiers (KV namespace IDs, Hyperdrive IDs); no account API token is exposed. **Architecturally the binding topology is compliant.** The one real wrinkle: a **domain split-brain** — `api-gateway`/`webhook-service` route to `*.letbuyy.store` while `mobile-bff` routes to `bff.letbuyy.com` (`mobile-bff/wrangler.toml:87`), and prod injects `COOKIE_DOMAIN=.letbuyy.store`. The `.store → .com` migration is half-done across services, a cross-origin/cookie hazard for the mobile BFF.

---

## 5. Findings, ranked

| # | Sev | Finding | Evidence |
|---|---|---|---|
| 1 | **S1** | Hidden CQRS/saga execution layer inside the monolith wires V1-rejected packages onto 30 commerce routes + the queue consumer | `api-gateway/src/execution/*.adapter.ts`; `queue-workers/src/platform-queue-consumer.ts:2,11` |
| 2 | **S1** | Durable-Object checkpoint coordinator deployed (distributed-runtime machinery V1 R-13 rejects) | `api-gateway/src/durable/runtime-coordinator.ts`; bound in `wrangler.toml` |
| 3 | **S1** | Domain split-brain: mobile-bff on `.com`, rest on `.store`, cookies scoped to `.store` | `mobile-bff/wrangler.toml:87` vs `api-gateway/wrangler.toml`; `production-deploy.yml:409` |
| 4 | **S2** | `api-gateway` is over-loaded: monolith + GraphQL + execution core + extension host + DO in one worker | `api-gateway/src/{graphql,execution,extensions,durable}` |

---

## Verdict

**Service count and boundaries are honest and compliant** — four real backend services, six genuinely-empty reserved roots, no rogue services, no second data plane, clean service bindings. The deception is *one level down*: inside `api-gateway`, an undocumented event-sourced/CQRS execution layer (the V1-rejected `orchestration`/`distributed-runtime`/`runtime-composition` packages plus a checkpoint Durable Object) sits on the request and async hot paths. The topology diagram you'd draw from the service list is correct; the architecture diagram you'd draw from the *imports* is the Shopify-end-state machine the Freeze spent 49 KB rejecting.
