# CODEX API EVOLUTION MISSION — LetBuyy WS12 (GraphQL Admin + Storefront API + Bulk Ops)

**Driver:** Codex agent. Reasoning: `xhigh` for the schema + cost model, `medium` for resolver wiring.
**Mode:** Continuous, autonomous, 24h+. Never stop while unblocked work remains.
**Domain Ownership:** `services/api-gateway/**` (add a GraphQL layer **alongside** REST) + `packages/typescript/api-client/**` (generated SDK) + a new `packages/dart/api_client/**` GraphQL surface (if WS8 created it, extend; else create) + `packages/shared-types/**` (additive). **Backend.**
**Dependencies:** WS7 (staging). **Predecessor:** WS7 staging proof ready. **Co‑requisite:** WS11 (theme types) and WS13 (extension types) — keep the schema in sync, additively.
**Source of truth:** `LETBUYY_SHOPIFY_PARITY_BLOCKERS.md` (Part 3.1). **Governance:** 128/128 green; **never break the existing REST `/v1` contract** (it stays as a shim); migrations forward‑only; `[SKIP — NEEDS HUMAN]` and continue. Prove on **staging**.

---

## 0. PRIME DIRECTIVE
Give LetBuyy Shopify's **typed API shape**: **one GraphQL schema** powering a **GraphQL Admin API** and a **separate Storefront API**, with **calculated query‑cost** rate limiting, **bulk operations** (async JSONL export/import), and **generated typed SDKs** (TypeScript + Dart) — all over the *same* domain services behind the gateway, with the existing **REST `/v1` retained as a compatibility shim** so nothing breaks.

**SUCCESS CRITERIA (proven on staging):**
1. A **GraphQL Admin API** (`/admin/graphql`) serves products/orders/customers/inventory/themes/apps/billing from the existing `*-core` services — field‑level selection, typed.
2. A **Storefront API** (`/storefront/graphql`) serves read‑optimized storefront data with **delegated tokens** (separate from admin auth).
3. **Calculated query cost** rate limiting (points/sec leaky bucket) on the GraphQL APIs (mirrors the REST cost limiter).
4. **Bulk operations**: async `bulkOperationRunQuery` (export) + `bulkOperationRunMutation` (import) returning a **JSONL** result URL; status pollable.
5. **Generated SDKs**: `@letbuyy/api-client` (TS) and the Dart client expose typed GraphQL operations generated from the schema (one contract, two languages).
6. **REST `/v1` still works** unchanged (shim over the same resolvers/services). No regression; 128/128; typecheck/build/tests green.
7. `CODEX_WS12_LEDGER.md` complete; `CODEX_WS12_STATUS.md` written.

## 1. OPERATING CONTRACT
1. Continuous; ledger → next. 2. **Green Law** (128/128 at gates; never red; 3 strikes → revert/BLOCKED). 3. **Additive only:** GraphQL is **added next to** REST; the REST contract other stages/apps consume must keep working (it becomes a thin shim over shared resolvers). 4. **One schema, one domain:** resolvers call the existing `*-core` services — **no new business logic, no duplicate data access.** 5. **Staging proof:** run real GraphQL queries/mutations + a bulk export against staging; record results. 6. SKIP‑and‑continue; no fabrication; small reversible commits.

## 2. ARCHITECTURE INVARIANTS — DO NOT TOUCH
`packages/*-core/**` business logic (call them, don't rewrite) · `database/**` except a forward‑only migration if bulk‑op job tracking truly needs a table · all `apps/**` UI (they adopt the SDK later) · governance · `shared-types` except **additive** types.

## 3. THE WORK — G0 → G6
- **G0 Baseline.** `CODEX_WS12_LEDGER.md`; inventory the REST `/v1` surface + `schemas/*` so the GraphQL schema mirrors it exactly. **Effort:** M. **Priority:** P0.
- **G1 Schema.** Define the GraphQL **schema** (SDL) from the domain — types, queries, mutations, connections (Relay‑style pagination), errors — generated from / aligned to `shared-types`. **Effort:** L. **Priority:** P0.
- **G2 Admin GraphQL.** Mount `/admin/graphql` (e.g. GraphQL Yoga on Hono); resolvers delegate to `*-core` via the existing execution adapters; **calculated query‑cost** middleware; RBAC reuse. **Effort:** L. **Priority:** P0.
- **G3 Storefront API.** Mount `/storefront/graphql` (read subset: products/collections/cart/customer/content) with **delegated storefront tokens**; cache‑friendly. **Effort:** L. **Priority:** P1.
- **G4 Bulk operations.** `bulkOperationRunQuery`/`bulkOperationRunMutation` → background job (queue‑workers) → **JSONL** in R2 → pollable status + result URL; concurrency cap. **Effort:** L. **Priority:** P1. _Data: queue-workers + R2 (exist)._
- **G5 Generated SDKs.** Codegen typed operations into `@letbuyy/api-client` (TS) and the Dart client from the schema; document usage. **Effort:** M. **Priority:** P1.
- **G6 REST shim + parity.** Refactor REST `/v1` handlers to call the **same resolvers/services** (REST becomes a thin shim); prove byte‑for‑byte response parity for the migrated endpoints. **Effort:** M. **Priority:** P1. _DoD: REST unchanged externally; one code path internally._
- **GATE (FINAL):** Admin + Storefront GraphQL live on staging; cost limiting + bulk ops work; SDKs generated; REST shim parity proven; 128/128; status written.

## 4. SHOPIFY REFERENCE
Shopify: one GraphQL Admin API (calculated query cost: 50 pts/s, 1000 cap), a separate Storefront API (delegated tokens), bulk operations returning JSONL, date‑based versioning, and generated SDKs. Match the **shape**, over LetBuyy's existing services.

## 5. LEDGER — `CODEX_WS12_LEDGER.md`
```
# WS12 API EVOLUTION LEDGER — started <ts>
## PROGRESS / SKIPPED — NEEDS HUMAN / STAGING-PROOF (real GraphQL + bulk export) / VALIDATOR (128/128) ledgers
```

## 6. LAUNCH PROMPT
```
Read docs/Codex_waves/CODEX_API_GRAPHQL_MISSION.md and LETBUYY_SHOPIFY_PARITY_BLOCKERS.md (Part 3) in full,
then execute G0→G6 continuously and autonomously, 24h+.

OWN: services/api-gateway/** (add GraphQL beside REST), packages/typescript/api-client/** + packages/dart/api_client/**
(generated SDKs), shared-types (additive). Do NOT rewrite *-core business logic, touch other apps' UI, or governance.

Goal: one GraphQL schema → a GraphQL Admin API (/admin/graphql) + a Storefront API (/storefront/graphql) over the
existing *-core services; calculated query-cost rate limiting; bulk operations (async JSONL via queue-workers + R2);
generated typed SDKs (TS + Dart). Keep REST /v1 working as a thin shim over the SAME resolvers — zero external change.

Hard rules: ADDITIVE only (never break REST /v1 other apps consume); resolvers call existing services (no new business
logic / no duplicate data access); prove real GraphQL queries/mutations + a bulk export against STAGING; keep all 128
validators green per commit; migrations forward-only; small reversible commits; 3 strikes → BLOCKED; no fabrication.
Maintain CODEX_WS12_LEDGER.md. Begin with G0 now.
```

## 7. NORTH STAR
One typed schema, two APIs (Admin + Storefront), generated SDKs, bulk ops — Shopify's developer‑grade API shape over LetBuyy's existing, untouched domain services.
