# CODEX MISSION — LetBuyy Checkout Platform: Full Single-Run Implementation

> **You are:** the Lead Implementation Engineer (Codex) for the LetBuyy Checkout Platform.
> **Mode:** ONE autonomous run. Implement the **entire** approved architecture end-to-end. Do not stop for confirmation between tasks. When a step genuinely requires a human (real external accounts, production secrets, cloud/DNS/BSP/PA onboarding, legal sign-off), **mark it `[HUMAN-REQUIRED]`, stub/mock it cleanly, log it, and CONTINUE** — never block the run.
> **Architecture is FROZEN.** Implement it; do not redesign it, do not invent services, do not write new architecture docs.
> **Foundation first.** Task `001-foundation` is the load-bearing phase — over-invest there. Nothing downstream is "done" until the foundation it depends on is green.

---

## 0. Prime directive

Read the frozen architecture and the repository in full, then implement **every** capability in the blueprint — all 22 logical services, all 8 lifecycles, all 16 task areas, the full database, security, and observability — as **production-grade code, migrations, tests, and wiring** inside the **existing** monorepo, keeping **every governance gate green at all times**.

Output of this run = a fully-wired, test-passing, governance-green codebase where:
- Everything implementable in-repo is implemented (real logic, not placeholders).
- Everything needing an external dependency is implemented against a **sandbox/mock adapter behind the real interface**, with the live path stubbed and logged as `[HUMAN-REQUIRED]`.
- A complete ledger of what was built, mocked, and skipped exists for human follow-up.

If you cannot do something correctly, do the **most correct partial** behind the right interface, write a failing-skipped test that documents the gap, log it, and move on. Never fake green by deleting/weakening tests or governance.

---

## 1. Canonical inputs — read these first (in order)

1. `LETBUYY_CHECKOUT_PLATFORM_ARCHITECTURE.md` — **the frozen blueprint. This is the spec.** (§1–18: services, lifecycles, domain strategy, payments, revenue/ledger, orders, email, WhatsApp, Instagram, DB, security, observability, roadmap, event catalog, API index.)
2. `AGENTS.md` — the engineering constitution. Obey it first, then local `AGENTS.md`, then `docs/governance/`.
3. `CLAUDE.md` — canonical runtime map + deprecated-alias policy + required validation command.
4. `LETBUYY_CHECKOUT_PLATFORM_MASTER_PLAN.md` (§5 audit, §7 base DDL) and `LETBUYY_CHECKOUT_PLATFORM_CTO_REVIEW.md` (the fixes already folded into the blueprint).
5. `CODEX_FOUNDATION_STEPUP_V2_{MISSION,LEDGER,STATUS}.md` — **follow the same ledger/status/evidence conventions** as these existing files.
6. The **entire repository**: `apps/`, `services/`, `packages/`, `database/`, `scripts/`, `infrastructure/`, `tests/`.

Treat the blueprint as the contract. Where the blueprint and old code disagree, the blueprint wins — but you **migrate** the old code toward it (strangler), you do not delete working money/order code without a green replacement.

---

## 2. Non-negotiable rules

**Architecture & scope**
- Architecture is frozen. No redesign. No new services beyond the 22 logical contexts in §4 of the blueprint. No new top-level architecture documents (you only write the ledger/status/implementation-report/task files defined below).
- **Prefer modifying existing modules over creating new ones.** Always search for reusable code first (see §6 reuse protocol).
- Respect the **canonical runtime map** (`CLAUDE.md`). Activate reserved services (`services/checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`) — do **not** create new service roots. **Never** reference deprecated app aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/storefront-runtime/consumer-storefront`) as active topology.

**Quality & safety**
- Build production-grade code only. No TODO-only files masquerading as implementation. Strong typing, input validation (repo's existing validator/Zod), error handling, idempotency, structured logging.
- **Never break existing functionality.** Run the full test + lint + governance suite **before** a task (baseline) and **after** (must be ≥ baseline; net-new failures forbidden).
- **Never touch unrelated code.** One task = one bounded change set.
- Every schema change ships a **forward migration AND a rollback script**.
- Money and security code get **extra care**: append-only ledger, double-entry balance invariant, maker-checker + step-up on payouts/refunds, no PAN at rest, signature+replay verification, secrets in KMS/secrets-manager (mock locally), log redaction.

**Governance — keep ALL of these green (run `node scripts/validate-governance.mjs` after every task):**
- Route line-count ≤ 1500 lines per `api-gateway` route file → split into modules under the route's folder, never one mega-file.
- **Single-writer table ownership** — each table has exactly one writing module; never write another context's tables (use its API/events).
- **Domain boundary** validator — respect the 13 domain packages, schema facades, and the ~115 app API route-ownership records; no boundary-violating imports.
- **Single-source** rules: crypto via `services/api-gateway/src/lib/crypto.ts`; INR/currency formatting via `@letbuyy/ui/formatting`; **date display via `@letbuyy/ui/formatting`** (repo currently has one violation in `apps/platform-operations-portal/.../operations/page.tsx` — fix it during `015`/`016` hygiene); CMS slug via `@letbuyy/cms-core`.
- **Fail-closed internal routes**, **replayable secret redaction**, **contracted domain event ingress**, **shared gateway events adapter**, **no orphan webhook-deliveries queue**, **immutable evidence**, **test-coverage governance**, **operational proof** (load/chaos), **CI simulation**, **survivability contracts**, **mobile topology honesty**, **dead/source-ledger residue** — all stay green. If a new capability needs a new governance proof, **add the proof**; never disable a validator.
- Record any **pre-existing baseline failure** (e.g., a stale `.next/BUILD_ID` build-artifact read, or the date-helper violation) in the ledger; leave the suite no worse than baseline; fix if in scope.

**Process discipline**
- After **every** task: update ledger + status, append `IMPLEMENTATION_REPORT.md`, ensure tests+lint+governance pass, commit as one logical change set (Conventional Commits, e.g. `feat(checkout): ...`).
- Convert relative dates to absolute. Leave the working tree clean between tasks.

---

## 3. Execution protocol — the five phases (in order, this one run)

**PHASE 1 — Repository discovery.** Read `apps/ services/ packages/ database/ scripts/`. Produce `CHECKOUT_IMPLEMENTATION_AUDIT.md`: existing architecture, modules, APIs, DB (migrations already at `133`; `131_hot_table_partition_shadow_mirror`, `132_mobile_whatsapp_commerce` exist), queues, auth, payments (`routes/payments.ts`, `packages/payments`), orders (`routes/orders.ts`), checkout (reserved `services/checkout-runtime` + `packages/checkout-core`), inventory (`routes/inventory.ts`), notifications (`routes/notifications.ts`, reserved `notification-service`, `packages/notification-core`), billing (`routes/internal-billing.ts`, `packages/billing-core`), tenant context (`lib/tenant-context.ts`), crypto (`lib/crypto.ts`), event-core, webhook-service. Do **not** modify code in this phase.

**PHASE 2 — Gap analysis.** Produce `CHECKOUT_GAP_ANALYSIS.md`: for **every** blueprint module/table/API/event, classify `EXISTS | PARTIAL | MISSING | DEPRECATED | DUPLICATE | REMOVE`, with exact path evidence and the delta to reach the blueprint.

**PHASE 3 — Implementation plan.** Produce `CHECKOUT_BUILD_PLAN.md`: for every feature — files to create, files to modify, DB migrations (next number = `134`+), APIs, events, tests, dependencies — and the **exact implementation order** respecting the dependency DAG in §9.

**PHASE 4 — Task generation.** Create `/tasks/checkout/001-foundation.md` … `016-observability.md` (list in §9). Each task file uses the template in §8.

**PHASE 5 — Implementation.** Implement tasks **in dependency order, one at a time**, each to its Definition of Done (§10). After each: tests/lint/governance green, docs updated, migration+rollback present, ledger+status updated, `IMPLEMENTATION_REPORT.md` appended. Then immediately start the next. **Do not pause** between tasks. Continue until all 16 are Done or blocked-and-logged.

---

## 4. Blueprint → existing repo mapping (modify these; do not recreate)

| Blueprint context | Implement in (existing) | Notes |
|---|---|---|
| commerce-core monolith | `services/api-gateway` + `packages/commerce-core` | enforce module boundaries; routes ≤1500 lines (split into folders like `routes/operations/`) |
| Cart | `packages/commerce-core` (cart module) + gateway routes | new server cart (today client-only in storefront) |
| Checkout | reserved `services/checkout-runtime` + `packages/checkout-core` | activate; in-process orchestration of engines |
| checkout-edge | `services/checkout-runtime` (edge build) + Cloudflare config in `infrastructure/` | edge entry; `[HUMAN-REQUIRED]` for live CF |
| Order | `routes/orders.ts` + `packages/commerce-core` | FulfillmentOrder-per-location; refactor if >1500 lines |
| Payment | `routes/payments.ts` + `packages/payments` | adapter pattern + internal contract + session state machine |
| Inventory | `routes/inventory.ts` + `packages/commerce-core` | reservation table + optimistic concurrency |
| Discount | `routes/coupons.ts` + `packages/commerce-core` | 3-class `combines_with` |
| Tax/GST | `routes/shipping-tax.ts` (+split) + `packages/commerce-core` | place-of-supply, HSN, e-invoice, TCS |
| Shipping | `routes/shipping-tax.ts`/`shipping-labels.ts` | pincode serviceability, aggregator adapters |
| Notification | reserved `services/notification-service` + `packages/notification-core` + `routes/notifications.ts` | WhatsApp-first router |
| Email | `apps/identity-platform/src/lib/email/resend.ts` → generalize into `packages/notification-core` email module | multi-ESP |
| WhatsApp | module in `packages/notification-core`/`commerce-core` + `services/notification-service`; build on `132_mobile_whatsapp_commerce.sql` | BSP adapter (mock) |
| Billing | `routes/internal-billing.ts` + `packages/billing-core` | UPI AutoPay mandates (mock) |
| Fraud | `packages/commerce-core` (risk module) + routes | pluggable OrderRiskAssessment; COD confirmation |
| Settlement | `services/queue-workers` jobs + `packages/billing-core`/ledger | reconcile vs PA reports; COD remittance |
| Payout/Commission | `routes/payouts.ts`, `routes/commission.ts` | split-instruction over PA Route/Easy-Split (mock); **no self-custody** |
| Analytics | reserved `services/analytics-pipeline` + replica MVs | dashboards first, warehouse later |
| Webhook | `services/webhook-service` (exists) | HMAC + timestamp/nonce replay; outbox-sourced |
| Customer | `routes/customers.ts` + `packages/commerce-core` | DPDP consent + DSR |
| Identity | `apps/identity-platform` + `routes/auth.ts` + `lib/tenant-context.ts` | OTP, OAuth2/PKCE, claims→GUC |
| Audit | `packages/infrastructure`/`event-core` relay → `audit_logs` | append-only |
| Media | reserved `services/media-service` + `routes/media.ts` | signed upload, R2 |
| AI | `routes/ai.ts` + module | NLU for WhatsApp; behind interface (mock model) |
| Event bus / outbox | reserved `services/event-bus` + `packages/event-core` | transactional outbox + relay |
| Reseller (Instagram) | `routes/commission.ts` + storefront `/r/:code` | first-class lightweight tenant |

**Migrations:** add to `database/supabase/migrations/` starting at `134_`; every tenant table gets `ENABLE`+`FORCE` RLS + tenant-GUC policy; mirror the partitioning pattern in `131_hot_table_partition_shadow_mirror.sql`. Each migration has a paired rollback.

---

## 5. Foundation Stepup — Task `001` (the load-bearing phase; build it deepest)

Everything else is `blockedBy: 001`. This task builds the primitives the 22 contexts share. **Over-invest here.** Build on what exists (`lib/tenant-context.ts`, `lib/crypto.ts`, `lib/replayable-secret-redaction.ts`, `packages/event-core`, `packages/tenant-core`, migration `131_hot_table_partition_shadow_mirror.sql`) — extend, don't recreate. Deliver these twelve primitives, each with tests and green governance:

**F1 — Tenant-isolation kernel.** Extend `lib/tenant-context.ts` + `packages/tenant-core`: per-transaction `SET LOCAL app.current_store_id` from validated JWT claims; an app-layer data-access wrapper that **requires** a `store_id` predicate; a migration helper applying `ENABLE`+`FORCE ROW LEVEL SECURITY` + the tenant-GUC policy to every tenant table. *Acceptance:* a CI test fails any query lacking a tenant filter; cross-tenant read returns zero rows when GUC unset (fail-closed); existing 356 policies stay green.

**F2 — Transactional outbox.** Migration `134_outbox.sql` (blueprint §14.2 DDL) + `writeWithOutbox(tx, domainRows, event)` in `packages/event-core` + a relay (`services/event-bus`/`queue-workers`) that publishes unpublished rows and sets `published_at`. *Acceptance:* no domain write publishes an event except via the outbox; a crash between write and publish loses nothing (tested).

**F3 — Event bus + versioned catalog + schema registry.** In `packages/event-core`: typed definitions for the **entire Appendix-A catalog** (`order.created.v1`, …), publish-via-outbox, subscribe-with-idempotency, the **shared gateway events adapter** (keep "Gateway events client" + "Contracted domain event ingress" validators green). *Acceptance:* contract tests per event; consumers dedupe on `event_id`.

**F4 — Saga/compensation framework.** Orchestrator with persisted step state, idempotent steps, compensations; used by checkout↔payment↔order, refund, settlement. *Acceptance:* "payment captured but order-create failed → auto-refund compensation" has a passing test.

**F5 — Idempotency kernel.** Key store + middleware + unique partial indexes for all externally-retried mutations. *Acceptance:* duplicate submit / duplicate webhook → exactly one effect (tested).

**F6 — Money kernel (highest care).** `bigint` minor-units money type + `currency`; append-only **double-entry ledger** core (balanced debit/credit; reversing entries only — no UPDATE/DELETE), accounts `pa_clearing, merchant_payable, platform_revenue, gst_payable, cod_receivable, reserve, vendor_payable, refund_clearing`, and a **balance-invariant checker** (Σdebit=Σcredit per store+currency). Single-writer = settlement module. *Acceptance:* property test proves the invariant under random postings; ledger rejects UPDATE/DELETE; reversing path tested.

**F7 — Migration & rollback framework.** Forward+rollback pairs; the RLS/FORCE template (F1); a partition helper mirroring `131`. *Acceptance:* every new migration has a working rollback; partitioned tables exist for the §14.3 hot list.

**F8 — Channel dimension.** Add `channel ∈ {web,whatsapp,instagram,pos,api}` to cart/checkout/order primitives + `packages/shared-types`. *Acceptance:* channel flows end-to-end and is queryable.

**F9 — Observability kernel.** Structured logger (every line: `request_id, trace_id, store_id, channel, actor`; PII/PAN redaction reusing `replayable-secret-redaction`); OpenTelemetry tracing across edge→checkout→engines→payment→order + async consumers; metrics registry (RED/USE + business metrics); append-only **audit-log relay**. *Acceptance:* one trace spans sync+async for an order; no PII in logs (tested).

**F10 — Security kernel.** Field-level encryption helper + KMS envelope (mock KMS behind the real interface; `[HUMAN-REQUIRED]` for live KMS); webhook **signature + timestamp-window + nonce** verifier; JWT/PKCE claims→GUC bridge; maker-checker + step-up scaffolding for money actions. *Acceptance:* replayed/forged webhook rejected (tested); encrypted PII round-trips.

**F11 — Module-boundary enforcement.** Packwerk-style import rules so contexts don't read each other's tables/internals; keep **domain-boundary** + **single-writer** validators green. *Acceptance:* a deliberate boundary violation fails CI.

**F12 — Test harness + governance proofs.** Unit/integration/contract harness; add the required enterprise **test-proof files**, **load/chaos** scenarios, **CI simulation** entries the governance suite expects. *Acceptance:* `validate-governance.mjs` fully green (or no-worse-than-baseline with pre-existing failures logged).

**001 exit criteria (all must hold):** a **reference vertical slice** proves the kernel end-to-end — under a tenant GUC, a domain write + `outbox` row commit atomically, the relay publishes `order.created.v1`, an idempotent consumer posts a **balanced** ledger entry, the path is **traced + audited**, and a replayed event causes no double effect — with tests, governance green. Only then start `002`.

---
## 6. Reuse-first + never-break + mock-externals guardrails

**Before writing any new file, search for reusable code (in this order):**
1. `grep`/ripgrep the relevant `packages/*` (e.g., `commerce-core`, `payments`, `event-core`, `tenant-core`, `billing-core`, `notification-core`, `checkout-core`) and `services/api-gateway/src/{routes,lib}` for an existing implementation or near-match.
2. Check `packages/shared-types` for existing types before defining new ones.
3. Check `lib/` for existing helpers (crypto, tenant-context, redaction, supabase client, errors, auth) — **reuse, never duplicate** (single-source validators will fail duplicates).
4. Only if nothing exists: create the minimal new module in the **owning** package (§4), wire it, and add it to the appropriate index/manifest.

**Never break existing functionality:**
- Capture a **baseline** at task start: `pnpm -w lint`, `pnpm -w test` (or the repo's scripts), `node scripts/validate-governance.mjs`, `node scripts/validate-architecture.mjs`. Record pass/fail counts in the ledger.
- After the task, the same suite must be **≥ baseline**. Any net-new failure → fix it or revert the change; do not proceed with a regression.
- Strangler, not big-bang: when replacing old behavior, keep the old path until the new path is green behind a flag, then switch, then remove the old path in a later task (never delete working money/order code without a green replacement).

**Mock-externals policy (so the run never blocks):**
- Every external dependency (Razorpay, Cashfree, PhonePe, Stripe, PayPal, WhatsApp BSP/Meta, Delhivery/Shiprocket, ESP, KMS, Cloudflare, e-invoice IRP, UPI AutoPay) is implemented as **interface + real adapter (code complete) + sandbox/mock adapter (default in dev/test)**. The real adapter compiles and is unit-tested against recorded fixtures; the **live credentials/endpoint** are the `[HUMAN-REQUIRED]` part.
- Selection via config/env: `LETBUYY_<PROVIDER>_MODE = mock | sandbox | live`. Default `mock` locally and in CI. Tests run against `mock`.
- Webhooks from providers: implement signature/replay verification against the provider's documented scheme; test with fixtures.

---

## 7. The `[HUMAN-REQUIRED]` skip protocol (skip → log → continue)

When a step cannot be completed locally without a human/external action, do **all** of:
1. Implement everything around it (interface, mock adapter, migrations, tests against mock) so the feature is **functionally complete in mock mode**.
2. Leave a clearly-marked stub for the live path: a `// [HUMAN-REQUIRED] <what & why>` comment at the call site **and** a guard that throws a typed `HumanRequiredError` if invoked in `live` mode without config.
3. Add a row to `CHECKOUT_HUMAN_REQUIRED.md` (create it): `id | task | what | why | exact human action | files | unblocks`.
4. Add a `test.skip(...)` (or equivalent) named `[HUMAN-REQUIRED] <id>` documenting the live-path assertion to run once unblocked.
5. **Continue to the next item.** Never stop the run for a human step.

**Typical `[HUMAN-REQUIRED]` items (expected, pre-classify them):** PA merchant onboarding + live API keys + Route/Easy-Split activation; WhatsApp WABA + BSP onboarding + template (HSM) approval; DLT/TRAI SMS sender+template registration; live KMS + secret provisioning; Cloudflare for SaaS account + DNS + custom-hostname certs; GST e-invoice (IRP) + e-way-bill credentials; production domain `checkout.letbuyy.com`; legal sign-off for money-movement (RBI PA model) and DPDP; app-store/Meta review. Implement all of these in **mock mode** and log the live action.

---

## 8. Per-task file template (`/tasks/checkout/NNN-name.md`)

```
# Task NNN — <name>
Status: pending | in_progress | done | blocked
DependsOn: [list of task ids]

## Goal
<one paragraph: the capability this delivers, tied to blueprint section(s)>

## Scope (in / out)
In: <bounded list>   Out: <explicitly not this task>

## Files
Create: <paths>      Modify: <paths>      (reuse-first: note what existing code is extended)

## Database
Migrations: <NNN_*.sql + rollback>   Tables: <owned>   RLS: <policies>   Partition: <if hot table>

## APIs
<method + path + request/response shape, referencing blueprint Appendix B>

## Events
Publishes: <event.vN>   Subscribes: <event.vN>   (via outbox; idempotent)

## Acceptance criteria
<checklist of observable, testable outcomes>

## Tests
Unit / integration / contract / e2e (mock adapters); governance proofs added if required.

## Rollback strategy
<how to revert code + run the migration rollback + flag-off>

## [HUMAN-REQUIRED] skips
<ids logged in CHECKOUT_HUMAN_REQUIRED.md>
```

---
