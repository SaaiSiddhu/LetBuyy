# LETBUYY — ARCHITECTURE COMPLIANCE REPORT
### Phase 4 of the Foundation Autopsy · 2026-06-09 · evidence-only, every claim file-cited
### Contract under test: `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md` ("the Freeze")

---

## 0. The headline: LetBuyy is governed by two frozen constitutions that mandate opposite architectures

This is the single most important architectural finding in the repository, and it is not a code smell — it is a governance fault that makes "compliance" undefinable.

- **Authority A — `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md`** (root, dated 2026-06-08, self-labelled *"FROZEN & EXECUTABLE … the source of truth"*). It prescribes a **modular monolith** and, in §4, **REJECTS** Event-Sourcing/CQRS (`projection-runtime`), the distributed runtime / service mesh (`distributed-runtime`), the general saga engine (`orchestration`), `runtime-composition`, `extension-host`, `app-engine`, the 3rd-party app marketplace, and GraphQL/extension surfaces. §6 lists those packages as *"DORMANT / DEFERRED SCAFFOLDING (exists, no investment, do not wire as active topology)."*

- **Authority B — `AGENTS.md`** (root). `CLAUDE.md:3` declares it the canonical engineering constitution that *"Claude, Codex, humans, and other automation must follow first."* `AGENTS.md` **MANDATES the exact packages V1 rejects** as canonical runtime, with detailed ownership rules:
  - `AGENTS.md:45` — `distributed-runtime`: *"Durable event persistence, distributed queues, **CQRS**, checkpoints, replay, worker coordination, … regional execution."*
  - `AGENTS.md:46` — `orchestration`: *"Workflow, event, outbox, replay, async execution, recovery, checkpoint, **saga**, retry."*
  - `AGENTS.md:168` — *"Event routing, retry, outbox, replay, dead-letter, and correlation primitives belong in `packages/orchestration`."*
  - `AGENTS.md:171` — *"Runtime manifests **must declare** orchestration, event, workflow, query, **CQRS**, composition, execution, distributed execution, checkpoint, projection, … regional, tenant scaling … ownership."*

**The code obeyed `AGENTS.md`.** Every rejected package is live and imported (proof in §5). The repository is therefore *simultaneously compliant with `AGENTS.md` and in violation of the Freeze.* Because `CLAUDE.md` ranks `AGENTS.md` first, **every "follow governance" instruction pushes the codebase further from the V1 modular-monolith target, not toward it.** Until one constitution is retired or explicitly subordinated, "architecture compliance" has no single referent.

---

## 1. Compliance classification — every app, service, and package

Legend: **COMPLIANT** = matches the Freeze · **VIOLATION** = builds what the Freeze rejects · **OUT-OF-ENVELOPE** = exceeds the 100→10k scope · **DEAD-RESERVED** = correctly empty placeholder.

### Services
| Component | Verdict | Evidence |
|---|---|---|
| `services/api-gateway` | **PARTIAL** | 248 src files; all mandated commerce modules present (auth, products, checkout, cart, orders, payments, settlements, inventory, coupons, tax, shipping, whatsapp, notifications, billing, kyc, payouts) — but also hosts rejected `execution/`, `graphql/`, `extensions/`, `durable/` |
| `services/queue-workers` | **PARTIAL** | Real source small & correctly scoped, **but imports rejected `@letbuyy/orchestration` + `runtime-composition`** on the live async path (`platform-queue-consumer.ts:2,11`) |
| `services/mobile-bff` | **COMPLIANT** | `src/index.ts` ~219 lines; thin transport, exactly V1 §3 |
| `services/webhook-service` | **COMPLIANT** | Outbound webhooks, HMAC + dedup; V1 §3 |
| `services/{checkout-runtime, event-bus, notification-service, analytics-pipeline, media-service, search-service}` | **COMPLIANT (DEAD-RESERVED)** | Each = `runtime.manifest.json` + `AGENTS.md` only, **0 source files** — matches V1 §6 |

### Web apps
| Component | Verdict | Evidence |
|---|---|---|
| `apps/merchant-control-plane` | **COMPLIANT** | 61 pages; canonical merchant OS; reaches data only via gateway |
| `apps/storefront-runtime` | **PARTIAL** | 23 pages real, **but render path imports rejected `app-engine`** (`src/lib/store-service.ts:2`) |
| `apps/identity-platform` | **COMPLIANT** | 10 pages / 28 API routes; canonical auth |
| `apps/marketing-site` | **COMPLIANT** | 5 pages, no auth pages |
| `apps/app-marketplace` | **VIOLATION** | 21 pages (`developers/apps/new`, `moderation/reviews`, …) — the 3rd-party marketplace V1 R-11 rejects |
| `apps/developer-portal` | **VIOLATION** | 9 pages (OAuth, SDKs, webhooks, API ref) — extensibility R-11 rejects |
| `apps/theme-marketplace` | **OUT-OF-ENVELOPE** | 29 pages of theme commerce; V1 keeps `theme-engine` only "as far as the existing theme editor needs" |
| `apps/platform-console` | **VIOLATION** | 20 pages (risk, trust-safety, marketplace-governance, revenue) — full super-admin vs V1's "thin sliver" |
| `apps/platform-operations-portal` | **VIOLATION** | 20 pages (tickets, CRM, retention, campaigns) — full ops desk vs V1's "thin sliver" |
| `apps/mobile/merchant-app` | **COMPLIANT (topology)** | canonical Flutter app |
| `apps/mobile/{shopper-app, operator-app}` | **COMPLIANT (DEAD-RESERVED)** | exactly 2 files each (manifest + AGENTS.md) |

### Packages
| Component | Verdict | Evidence |
|---|---|---|
| `packages/distributed-runtime` | **VIOLATION (DANGEROUS)** | **148 files / 9,858 LOC** of CQRS/checkpoint/regional execution — R-5/R-13. `AGENTS.md:45` says "76 scanned files": it has **doubled since the freeze** |
| `packages/orchestration` | **VIOLATION** | saga/replay/dead-letter engine (`async-execution-runtime.ts:4` dead-letter states; `outbox-runtime.ts:90` `planOutboxRecovery`; `index.ts:108` replay-runtime) — R-4 rejects exactly this |
| `packages/projection-runtime` | **VIOLATION** | 30 files of CQRS read models — R-5 |
| `packages/runtime-composition` | **VIOLATION** | 24 files of read aggregation / projection assembly — R-5 |
| `packages/app-engine` | **VIOLATION** | ~2,985 LOC marketplace app runtime, imported by 15 prod files incl. storefront render — R-11 |
| `packages/extension-host` | **VIOLATION** | ~471 LOC Wasm/extension host — R-11 |
| `packages/theme-engine` | **OUT-OF-ENVELOPE** | ~8,700 LOC (largest package); V1 allows minimal theme-editor support only |
| `packages/{shared-types, tenant-core, commerce-core, checkout-core, payments, auth-core, billing-core, event-core, notification-core, application-services, infrastructure, typescript/*, cms-core, audit-core, …}` | **COMPLIANT** | library contracts; V1 §6 allows reserved packages to hold library code |
| `packages/{session-core, permission-core, identity-core, organization-core, token-core, search-core}` | **COMPLIANT but HOLLOW** | interface-only stubs (45–94 LOC) with no implementation — see AUTH report for the consequences of `session-core`/`permission-core` being empty |
| Deprecated aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `operator-team-app`, `consumer-storefront`) | **COMPLIANT (absent)** | all verified absent from the tree |

---

## 2. The violation is LOAD-BEARING, not cosmetic

The Freeze's own wording (§6) tolerates the rejected packages *if* they "exist, no investment, do not wire as active topology." They fail that test — they are on the request and render hot paths:

1. **Request hot path → orchestration → distributed-runtime.** `services/api-gateway/src/execution/*-execution.adapter.ts` (12 adapters) import `@letbuyy/orchestration` and `@letbuyy/runtime-composition`; **30 route files import these execution adapters**, including `checkout.ts`, `payments.ts`, `orders.ts`, `storefront/cart-routes.ts`, `storefront/checkout-payment-routes.ts`. The CQRS/saga indirection sits between every commerce route and its domain logic.
2. **Live async path → saga/replay/dead-letter.** `services/queue-workers/src/platform-queue-consumer.ts:2,11` imports `@letbuyy/orchestration`; that package ships `planOutboxRecovery`, `replay-runtime`, and dead-letter state machines. V1 R-4 permits only "scoped compensation," not a general engine.
3. **Storefront render → app-engine.** `apps/storefront-runtime/src/lib/store-service.ts:2` imports `@letbuyy/app-engine`; `store-service` is imported by `store/[subdomain]/page.tsx`, `product/[productId]/page.tsx`, `checkout/page.tsx`, and `layout.tsx` — every tenant page render executes marketplace-extension runtime.
4. **Deployed Durable Object.** `services/api-gateway/src/durable/runtime-coordinator.ts` defines `LetbuyyRuntimeDurableObject` holding checkpoint state — the checkpoint/regional machinery R-13 rejects, bound in `wrangler.toml` and live.

**Rejected-architecture footprint:** ~18,150 LOC of CQRS/saga/mesh/extension runtime + ~3,941 LOC of mounted Admin+Storefront GraphQL (`graphql/schema.ts` is 1,835 lines; mounted at `index.ts:314-317` as `/admin/graphql` + `/storefront/graphql`) + 50 marketplace/developer pages + ~40 internal-ops pages — all live, all imported, all defended by validators (§4).

---

## 3. Route-file size discipline (V1 §2: route files ≤ 1500 lines)

- **In the validator's scope (`services/api-gateway/src/routes`): ZERO violations.** `route-line-count-validator.mjs` passes (84 files ≤ 1500). Eight files sit at the ceiling (1422–1494): `storefront/customer-engagement-routes.ts` (1494), `customers.ts` (1487), `app-store/billing-oauth-routes.ts` (1478), `app-store.ts` (1472), `themes.ts` (1462), `payments.ts` (1422).
- **Blind-spot violations:** the validator globs only `src/routes` (`route-line-count-validator.mjs:10`), so the two largest module files escape — both in rejected/un-V1'd surfaces: `graphql/schema.ts` (**1,835**) and `execution/theme-execution.adapter.ts` (**1,572**). The rule has a hole exactly where the biggest files live.

---

## 4. What governance actually defends

Of the 194 validator scripts, **dozens enforce the V1-rejected architecture by name**: `distributed-runtime-validator`, `projection-*` (×4), `saga-recovery-validator`, `crdt-convergence-validator`, `split-brain-validator`, `replay-*` (20+), `fencing-token-validator`, `lease-*` (×3), `wal-certification-validator`, `durable-object-*` (×3). The governance suite is itself a monument to Authority B. An engineer who "makes governance green" is actively hardening the architecture the Freeze froze as rejected. (See the GOVERNANCE findings in the master report for the ~25% that is provably theater.)

There is also an **in-flight build mission to extend the rejected work**: `CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION_V2.md` + 4 sibling ledger/status files (~200 KB, dated 2026-06-08 — the same day as the Freeze) are actively building the marketplace V1 defers until ~5,000 merchants. LetBuyy has ~0.

---

## 5. Rejected-package liveness (exact importer evidence)

| Package | Real source importers | On hot path? |
|---|---|---|
| `app-engine` | 15 prod files | YES — storefront render (`store-service.ts:2`) + api-gateway app-store routes |
| `distributed-runtime` | 15 (transitive via orchestration + projection-runtime) | YES — under the execution adapters |
| `orchestration` | 14 | YES — api-gateway execution adapters + `queue-workers` outbox relay |
| `runtime-composition` | 3 | YES — `storefront-runtime/.../store/[subdomain]/page.tsx:7,38` (`composeStorefrontRuntimeProjection` in the page render) |
| `extension-host` | 3 | partial — `merchant-control-plane` EmbeddedAppBridge + api-gateway extension-routes |
| `projection-runtime` | 1 | thin — consumed by `runtime-composition` |

**Zero dead LOC in this cluster.** The chain `distributed-runtime → {orchestration, projection-runtime} → runtime-composition → storefront page render / api-gateway / queue-workers` terminates in real entrypoints. The contradiction is structural and active.

---

## 6. What is genuinely compliant and well-built

It is not all bad — the parts the Freeze actually wants exist and are clean:

- **All mandated commerce route modules exist** in `api-gateway` (auth, products, cart/checkout, orders, payments, settlements, inventory, discounts, tax, shipping, whatsapp, notifications, billing).
- **Reserved services are genuinely empty** (6/6) and **deprecated aliases are gone** (9/9) — two disciplines most monorepos fail.
- **No circular imports.** `node scripts/validators/circular-import-validator.mjs` → *"passed (52 governed roots checked)"*. Despite the rejected cluster being live, the package layering is a clean DAG.
- **No second data plane / hidden DB access.** Repo-wide grep for `createClient(` / `SERVICE_ROLE` in `apps/` returns **zero** — only `api-gateway`, `webhook-service`, and `packages/infrastructure` hold a DB client. Apps reach data strictly via the gateway. This is the cleanest boundary in the system.
- **`pnpm-workspace.yaml` matches reality** (28 packages, no phantom members). Committed-bundle hygiene is clean — the large `.wrangler`/`.next` bundles are git-ignored, not tracked.

---

## 7. Top architecture violations, ranked

| # | Sev | Violation | Evidence |
|---|---|---|---|
| 1 | **S0** | Two contradictory frozen constitutions; `CLAUDE.md` ranks the Freeze's enemy first | `CLAUDE.md:3` vs `LETBUYY_EXECUTABLE_ARCHITECTURE_V1.md:83,142` vs `AGENTS.md:168,171` |
| 2 | **S0** | Rejected CQRS/saga runtime is load-bearing on the request hot path | 30 route files → `execution/*-execution.adapter.ts` → `@letbuyy/orchestration` → `distributed-runtime` |
| 3 | **S0** | General saga/replay/dead-letter engine on the live async path (R-4) | `queue-workers/src/platform-queue-consumer.ts:2,11`; `orchestration/async-execution-runtime.ts:4` |
| 4 | **S1** | Rejected `app-engine` runs on every storefront page render (R-11) | `apps/storefront-runtime/src/lib/store-service.ts:2` |
| 5 | **S1** | Full 3rd-party App Marketplace built + active V2 build mission (R-11, ~0 merchants) | `apps/app-marketplace` 21 pages; `CODEX_APPS_MARKETPLACE_FOUNDATION_MISSION_V2.md` |
| 6 | **S1** | ~3,941-LOC Admin+Storefront GraphQL mounted live — absent from V1's REST-only design | `index.ts:314-317`; `graphql/schema.ts` (1,835) |
| 7 | **S1** | `distributed-runtime` nearly doubled (76→148 files) *after* the freeze | `AGENTS.md:45` vs `find packages/distributed-runtime -name '*.ts' \| wc -l` |
| 8 | **S1** | Two full internal-ops apps vs V1 "thin sliver" | `apps/platform-console` + `apps/platform-operations-portal` (40 pages) |
| 9 | **S2** | Live `extension-host` (Wasm) + Durable-Object checkpoint coordinator (R-11/R-13) | `routes/app-store/extension-routes.ts`; `durable/runtime-coordinator.ts` |
| 10 | **S2** | Route-size validator blind spot misses the two largest module files | `route-line-count-validator.mjs:10` |

---

## Verdict

The modular monolith the Freeze describes **does exist underneath** — the commerce modules are present, the topology boundaries (reserved services, deprecated aliases, single data plane, no cycles) are clean. But it is buried under a *fully-wired, actively-extended, validator-defended distributed architecture that the Freeze explicitly rejects*, because the constitution engineers are told to obey first (`AGENTS.md`) mandates precisely what the Freeze froze as rejected. This is not drift you can lint away. **Until the document-precedence conflict is resolved by a human ARB decision — retire one constitution or formally subordinate it — the term "architecture compliance" is undefined, and the codebase will keep diverging from V1 every time someone follows the rules.**
