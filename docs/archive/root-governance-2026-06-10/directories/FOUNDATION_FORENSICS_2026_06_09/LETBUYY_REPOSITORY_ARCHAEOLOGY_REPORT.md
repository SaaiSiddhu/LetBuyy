# LetBuyy Repository Archaeology Report
**Forensic due-diligence — Phase A (Repository Archaeology)**
**Date:** 2026-06-09 · **Mode:** READ-ONLY · **Method:** Trust code/imports/manifests only; treat all `*.md` status claims as unverified.
**Scope root:** `/Users/saai_sidd/Git/Letbuyy_Store`

---

## Executive Summary

LetBuyy presents as a sprawling, distributed, event-sourced commerce platform. The code tells a narrower story: **one real backend (`services/api-gateway`, ~248 TS files, 76 mounted product routes) fronting Supabase, surrounded by an elaborate "distributed-systems" cathedral that no product request path actually executes.** The architecture is best understood as a **single modular monolith (the gateway) plus a large stratum of contract/descriptor/simulation code that exists primarily to be validated, not run.**

The headline finding: the `distributed-runtime → orchestration → projection-runtime → runtime-composition` tower is **a cathedral nobody lives in at the layer it claims.** The 7,303-LOC `distributed-runtime` package — split-brain prevention, convergence proofs, fencing tokens, CRDTs — is imported by **zero apps, zero services, zero routes, and zero execution adapters.** Its only consumers are its two sibling packages and one validator script. It performs **no I/O** (0 `fetch`/`createClient`/`.from(` across the package). It is a proven-correct in-memory algorithm library wired to nothing.

What IS real and load-bearing: the gateway routes (52K LOC), a thin-but-functional execution-adapter layer that writes to an `outbox_events` table, a real `queue-workers` consumer, a real `webhook-service`, a genuine `theme-engine` (5,162 LOC), and contract-heavy `-core` packages. App→backend boundaries are clean (apps proxy through the gateway; they never touch Supabase directly). Deprecated aliases are genuinely gone.

**Architecture Score: 41/100.** A competent monolith drowning in unwired distributed-systems theater and a dead parallel identity subsystem.

---

## 1. The "Actual vs Intended vs Fake/Dead/Future" Inventory

| Component | Classification | Evidence |
|---|---|---|
| `services/api-gateway` (248 ts, 76 routes) | **ACTUAL** — the product | `services/api-gateway/src/index.ts:686-790` mounts 76 `api.route(...)`; routes total 52,286 LOC |
| `services/queue-workers` | **ACTUAL** | `services/queue-workers/src/platform-queue-consumer.ts:1-25` — real Supabase client, push dispatch, consumes `runtime-composition` plan fns |
| `services/webhook-service` | **ACTUAL** | 1,683 LOC; `services/webhook-service/src/index.ts` (1,327 LOC) + gateway-order/billing transition files |
| `packages/theme-engine` | **ACTUAL** (recon brief wrong: NOT contract-only) | 5,162 LOC, 45 exported functions/classes; 63 importers |
| `packages/infrastructure`, `commerce-core`, `tenant-core`, `checkout-core`, `cms-core` | **ACTUAL but contract-heavy** | e.g. `commerce-core` 104 types/schemas vs 19 functions; `checkout-core` 141 types vs 27 fns. Real but mostly Zod/TS contracts |
| `services/api-gateway/src/graphql/*` | **ACTUAL but vestigial-thin** — REST-shim facade | `graphql/rest-shim.ts:24-35` maps GQL fields to existing REST paths; `index.ts:641` storefront GQL = `app.fetch` proxy; 0 `.from(` in admin/storefront resolvers. No `graphql`/`apollo`/`yoga` dependency |
| `services/api-gateway/src/durable/runtime-coordinator.ts` (Durable Object) | **FAKE-LIVE** — bound but inert | 46-line health/checkpoint stub; bound in `wrangler.toml:196-198,313-315`; only runtime reference is `Boolean(c.env.RUNTIME_COORDINATOR)` in a health check (`routes/internal-console.ts:808`). Never `.get()`/`.idFromName()`'d by product code |
| `packages/distributed-runtime` (74 files, 7,303 LOC) | **DEAD CATHEDRAL** — never executed by product | Importers: only `orchestration` (4), `projection-runtime` (11), 1 validator. **Zero** apps/services/routes/adapters. 0 I/O ops in package |
| `packages/projection-runtime` (15 files) | **DEAD** | Only importer outside self: `runtime-composition/src/projection.ts` (1 edge) + validators |
| `packages/runtime-composition` | **PARTIALLY ALIVE** | `plan*` functions DO run — but in `queue-workers`, not the gateway request path. In gateway, 1 importer (`queue-execution.adapter.ts`) |
| `packages/orchestration` | **PARTIALLY ALIVE** — pure helpers only | Gateway uses only `canonicalizeExecutionPayload`, `eventRetryDelaySeconds`, `CorrelationContext` (type). The durability/saga/checkpoint runtimes are unused by product |
| `packages/application-services` (167 LOC src) | **DESCRIPTOR-ONLY** | All `define*` fns are identity functions (`return contract`) — `execution-pipeline.ts:101-141`. Produces inert metadata objects |
| `services/api-gateway/src/identity-foundation/*` (18 files) | **DEAD ISLAND** — parallel identity system | `index.ts` imports all; **`index.ts` is imported by nothing reachable**. Files named `oauth-skeleton.ts`, `*-scaffold.ts`, `mock-key-service.ts`, `token-shadow.ts`, `shadow-compare.ts` |
| `packages/{token,session,permission,organization,audit}-core` | **DEAD-ADJACENT** | Consumed **exclusively** by the dead `identity-foundation` island (see §3) |
| `apps/identity-platform` OIDC (`oauth2/*`, `.well-known/*`) | **FUTURE/SKELETON** | OIDC endpoints exist; `oidc-jwks` verifier is `activeByDefault: false` (`auth-verifier-registry.ts:48`) |
| `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}` | **PAPER (FAKE)** — 0 runtime | Each contains **exactly** `AGENTS.md` + `runtime.manifest.json`, zero source (verified by `find`) |
| `packages/dart/*` (`@letbuyy/dart`) | **N/A** — Dart mobile, not TS | 0 TS importers (expected) |
| `legacy/firebase`, `chaos/` | **ABANDONED but inert** | Imported by zero prod code (`grep` empty). `legacy/` is Firebase remnant |
| Deprecated aliases (`apps/admin`, `apps/auth`, etc.) | **CLEANLY REMOVED** | All 9 physically absent; no live imports |

---

## 2. The Paper Services — Quantified

All six "reserved" services are **manifest-only placeholders with literally zero source code**:

```
services/analytics-pipeline/   → AGENTS.md, runtime.manifest.json   (2 files, 0 src)
services/checkout-runtime/      → AGENTS.md, runtime.manifest.json   (2 files, 0 src)
services/event-bus/            → AGENTS.md, runtime.manifest.json   (2 files, 0 src)
services/media-service/        → AGENTS.md, runtime.manifest.json   (2 files, 0 src)
services/notification-service/ → AGENTS.md, runtime.manifest.json   (2 files, 0 src)
services/search-service/       → AGENTS.md, runtime.manifest.json   (2 files, 0 src)
```

**Verdict: confirmed 0 runtime.** Their advertised capabilities are absorbed by the gateway (checkout, search-projection, media upload, notifications all live in `api-gateway/src/routes/*` and `queue-workers`). `pnpm-workspace.yaml` still lists `services/*`, so these resolve as empty workspace packages. This is acceptable as documented placeholders **only if** the org never represents them as deployable units — every `runtime.manifest.json` and ledger that implies otherwise is marketing.

---

## 3. The Distributed-Runtime Tower: Cathedral vs Lived City

**This is the central architectural question. Verdict: THEATER at the layer it claims; the real city is the gateway routes hitting Supabase.**

### 3.1 Runtime call-site count (the decisive metric)

| Tower package | LOC | Importers OUTSIDE its own siblings | Product-code (apps/services/routes) call sites |
|---|---|---|---|
| `distributed-runtime` | 7,303 | **0** | **0** |
| `projection-runtime` | (15 files) | 1 (`runtime-composition`) | **0** |
| `runtime-composition` | — | gateway: 1 file; queue-workers: 1 file | `plan*` runs in **queue-workers only**, not gateway request path |
| `orchestration` | 1,393 | gateway adapters | Only 3 pure helpers used: `canonicalizeExecutionPayload`, `eventRetryDelaySeconds`, type `CorrelationContext` |

Exhaustive importer list for `@letbuyy/distributed-runtime` (whole repo, excl. node_modules):
```
scripts/validators/distributed-runtime-validator.mjs   ← a validator
packages/orchestration/src/{4 files}                   ← sibling
packages/projection-runtime/src/{11 files}             ← sibling
```
**No app. No service. No gateway route. No execution adapter.** (Evidence: repo-wide `grep -rln "@letbuyy/distributed-runtime"`.)

### 3.2 The tower does no I/O — it is a simulation library

`packages/distributed-runtime/src/convergence-proof-runtime.ts`: **0** occurrences of `await`/`fetch(`/`.from(`. Whole package: **0** `fetch(`/`createClient`/`.from(`. The 53 `async`/`await` tokens operate on in-memory state. `split-brain-validator.mjs:14` even names the engine `simulateSplitBrain` — these are **simulations of distributed behavior**, never bound to a real coordinator, queue, or lease store.

### 3.3 How product requests actually flow (traced)

A real mutation (e.g. create order) executes:
1. Route handler in `services/api-gateway/src/routes/orders.ts`
2. → `new OrderExecutionAdapter(db)` (`orders.ts:803`)
3. → adapter method does **raw `db.from('orders').insert(...)`** (`order-execution.adapter.ts:225,328,376,411,444` — direct Supabase, no orchestration)
4. → optionally `new EventExecutionAdapter(db).emitDomainEvent(...)` which does **`db.from('outbox_events').upsert(...)`** (`event-execution.adapter.ts:62-77`) and **nothing else**.

The adapter classes carry `static readonly applicationWorkflows`, `executionPipelines`, and `runtimeBridge` descriptors (e.g. `event-execution.adapter.ts:35-46`) — these are **never read at runtime**. They are decoration imported from `application-services`, whose factory functions are identity functions (`defineRuntimeBridge = (contract) => contract`, `execution-pipeline.ts:139`).

**Conclusion:** Product code goes **straight to Supabase** via thin adapters. The outbox table is real and drained by `queue-workers`. But the WAL/lease/fencing/convergence/replay machinery in `distributed-runtime` is a **cathedral nobody lives in** — it influences zero production behavior. The intended design (durable orchestration runtime) was **specified, type-checked, validated, and never wired.**

---

## 4. Dead Packages & Dead Exports

External-importer ranking (apps+services, excl. self/tests):

| Importers | Package | Status |
|---|---|---|
| 0 | `@letbuyy/dart` | Dart (mobile) — N/A to TS graph |
| 1 | `@letbuyy/projection-runtime` | **DEAD** (internal-only) |
| 2 | `@letbuyy/organization-core` | **DEAD** — only `identity-foundation/repository-*` |
| 2 | `@letbuyy/token-core` | **DEAD** — only `identity-foundation/{oauth-skeleton,mock-key-service}` |
| 2 | `@letbuyy/search-core` | near-dead — `application-services/search-application` + api-types |
| 3 | `@letbuyy/audit-core` | **DEAD** — only `identity-foundation/*` |
| 3 | `@letbuyy/permission-core` | **DEAD** — only `identity-foundation/*` |
| 3 | `@letbuyy/session-core` | **DEAD** — only `identity-foundation/*` |
| 3 | `@letbuyy/runtime-composition` | mostly internal; live only in queue-workers |
| 15 | `@letbuyy/distributed-runtime` | **DEAD** (all 15 are siblings/validators) |

**The identity microkernel cohort is dead.** `token-core`, `session-core`, `permission-core`, `organization-core`, `audit-core` are imported **only** by `services/api-gateway/src/identity-foundation/*`, and that subsystem's `index.ts` is itself unreachable from the app entrypoint (no mounted route or `index.ts` imports it). These packages were built for a parallel identity platform that was never plugged in.

---

## 5. Duplicate / Shadow Systems

| Candidate | Verdict | Evidence |
|---|---|---|
| **`routes/X.ts` + `routes/X/` dir** (app-store, operations, storefront, internal-console) | **NOT duplicates — parent+children** | `app-store.ts:14-32` imports `./app-store/extension-routes` etc. as sub-modules; `storefront.ts:19-20`, `internal-console.ts:17-18` likewise. Legitimate decomposition |
| **`billing.ts` vs `internal-billing.ts` vs `billing-core`** | **NOT duplicates** — distinct surfaces | Mounted at `/billing` (`index.ts:721`) vs `/internal/billing` (`index.ts:686`); both consume `billing-core`. Merchant-facing vs ops-facing |
| **Auth/identity triplet: `identity-platform` app vs `api-gateway/identity-foundation` vs `packages/auth-core`** | **SHADOW SYSTEM CONFIRMED** | Three parallel identity stacks. `auth-core` (56 importers) is the **real** one (session cookies, RBAC, gateway middleware). `identity-foundation` (18 files) is a **dead scaffold island**. `identity-platform` app hosts OIDC endpoints that are **off by default** (`oidc-jwks activeByDefault:false`) |
| **Real auth path vs the verifier "registry"** | **Descriptor shadow** | `middleware/auth.ts:36` re-exports `AUTH_VERIFIER_REGISTRY` as metadata, but the real auth loop (`auth.ts:261`) iterates a **separately-defined** `legacyGatewayAuthVerifiers` array (`auth.ts:216`). The "registry" is documentation; the "legacy" array is production |

The `identity-foundation` directory's own filenames are a confession: `oauth-skeleton.ts`, `admin-mfa-scaffold.ts`, `migration-scaffold.ts`, `operations-scaffold.ts`, `csrf-scaffold.ts`, `mock-key-service.ts`, `token-shadow.ts`, `shadow-compare.ts`. This is a half-built replacement for the live `auth-core`-based system, matching the "two parallel systems" pattern.

---

## 6. GraphQL Assessment

**Real but vestigial-thin — a REST facade, not an independent server.**
- Hand-rolled (no `graphql`/`apollo`/`graphql-yoga`/`mercurius` dependency in `services/api-gateway/package.json`); `schema.ts` is a 41,589-byte custom string schema.
- Mounted at `/admin/graphql`, `/storefront/graphql` (`index.ts:314-317`), behind a `FEATURE_GRAPHQL` gate (`index.ts:644`).
- **Zero independent data access**: `admin.ts` and `storefront.ts` resolvers have **0** `.from(` Supabase calls. Storefront GraphQL delegates via `restDelegate: (c, req) => app.fetch(req, c.env)` (`index.ts:641-643`); admin GraphQL maps fields to REST paths via `WS12_REST_SHIM_PARITY_ENDPOINTS` (`graphql/rest-shim.ts:24-35`).
- Has real query-cost analysis (`graphql/cost.ts`).

Verdict: it's a **compatibility shim** to claim "Shopify-grade GraphQL," not a second query engine. Acceptable as a thin BFF; misleading if marketed as a first-class GraphQL platform.

---

## 7. Archived / Inert Systems

| Dir | Content | Affects prod? |
|---|---|---|
| `legacy/firebase` | Firestore rules, functions, migrate script | **No** — 0 imports from apps/services/packages |
| `chaos/` | `run-chaos-evidence.mjs`, scenarios, AGENTS.md | **No** — test-harness only |
| `docs/archive/` | 468 files | Docs only |
| `artifacts/`, `build/` | generated | Not imported |

Hygiene here is good: no archived system leaks into the runtime graph.

---

## 8. Scored Section — Architecture

| Dimension | Score | Justification |
|---|---|---|
| **Real product backend** | 7/10 | Gateway is a coherent 248-file monolith with 76 routes hitting Supabase via adapters. Functional. |
| **Service decomposition honesty** | 2/10 | 6 of 10 "services" are empty manifests; the microservice topology is fiction. |
| **Distributed-runtime reality** | 1/10 | 7,303-LOC tower + Durable Object are unwired/inert. Pure simulation validated as if live. |
| **Identity architecture** | 3/10 | Live path works (`auth-core`), but a dead parallel scaffold + 5 dead packages + off-by-default OIDC = confusion and risk. |
| **App/package boundaries** | 9/10 | Apps never import each other; no package imports an app; apps proxy to gateway, never touch Supabase directly. Genuinely clean. |
| **Dead-code ratio** | 3/10 | ~7.3K LOC distributed-runtime + 15-file projection-runtime + 5 identity packages + 18-file IF island = large dead stratum. |
| **GraphQL** | 5/10 | Functional REST shim; not the platform it's dressed as. |
| **Deprecated-alias hygiene** | 9/10 | All 9 aliases physically removed, no live imports. |

**Composite Architecture Score: 41/100.**

> One-line verdict: *A solid Supabase-backed modular monolith wearing the costume of an event-sourced microservice mesh — most of the distributed-systems surface area is uninhabited.*

---

## Appendix — Evidence Index (file:line)

- Paper services: `services/{analytics-pipeline,checkout-runtime,event-bus,media-service,notification-service,search-service}/` = only `AGENTS.md`+`runtime.manifest.json`
- Tower unwired: repo-wide `grep @letbuyy/distributed-runtime` → only siblings + 1 validator
- Adapter is a Supabase passthrough: `services/api-gateway/src/execution/event-execution.adapter.ts:62-77`; `order-execution.adapter.ts:225,328,376`
- `define*` = identity fns: `packages/application-services/src/execution-pipeline.ts:101,118,139`
- Durable Object stub: `services/api-gateway/src/durable/runtime-coordinator.ts:1-46`; bound `services/api-gateway/wrangler.toml:196-198`
- GraphQL shim: `services/api-gateway/src/graphql/rest-shim.ts:24-35`; `index.ts:641-643`
- Dead identity island: `identity-foundation/index.ts` imported by nothing reachable; consumers of `{token,session,permission,organization,audit}-core` are all `identity-foundation/*`
- Real auth uses "legacy" array: `services/api-gateway/src/middleware/auth.ts:216,261`
- 76 product routes: `services/api-gateway/src/index.ts` (`grep -c "api.route('"`)
- Clean boundaries: 0 `createClient` in `apps/{storefront-runtime,merchant-control-plane}/src`
