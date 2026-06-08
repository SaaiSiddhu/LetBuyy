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
- Architecture is frozen. No redesign. No new services beyond the 22 logical contexts in §4 of the blueprint. No new top-level architecture documents (you only write ledger/status/implementation-report/task files defined below).
- **Prefer modifying existing modules over creating new ones.** Always search for reusable code first (see §10 reuse protocol).
- Respect the **canonical runtime map** (`CLAUDE.md`). Activate reserved services (`services/checkout-runtime`, `event-bus`, `notification-service`, `analytics-pipeline`, `media-service`) — do **not** create new service roots. **Never** reference deprecated app aliases (`apps/admin`, `apps/auth`, `apps/checkout`, `apps/internal`, `apps/merchant`, `apps/storefront`, `apps/analytics`, `apps/storefront-runtime/consumer-storefront`, etc.) as active topology.

**Quality & safety**
- Build production-grade code only. No TODO-only files masquerading as implementation. Strong typing, input validation (Zod or the repo's existing validator), error handling, idempotency, structured logging.
- **Never break existing functionality.** Run the full test + lint + governance suite **before** a task (baseline) and **after** (must be ≥ baseline; net-new failures are forbidden).
- **Never touch unrelated code.** One task = one bounded change set.
- Every schema change ships a **forward migration AND a rollback script**.
- Money and security code get **extra care**: append-only ledger, double-entry balance invariant, maker-checker + step-up on payouts/refunds, no PAN at rest, signature+replay verification, secrets in KMS/secrets-manager (mock locally), redaction in logs.

**Governance — keep ALL of these green (run `node scripts/validate-governance.mjs` after every task):**
- Route line-count ≤ 1500 lines per `api-gateway` route file → split into modules under the route's folder, never one mega-file.
- **Single-writer table ownership** — each table has exactly one writing module; do not write another context's tables (use its API/events).
- **Domain boundary** validator — respect the 13 domain packages, schema facades, and the ~115 app API route-ownership records; no cross-domain imports that violate boundaries.
- **Single-source** rules: crypto via `services/api-gateway/src/lib/crypto.ts`; INR/currency formatting via `@letbuyy/ui/formatting`; **date display via `@letbuyy/ui/formatting`** (the repo currently has one violation in `apps/platform-operations-portal/.../operations/page.tsx` — fix it as part of `015`/`016` hygiene); CMS slug via `@letbuyy/cms-core`.
- **Fail-closed internal routes**, **replayable secret redaction**, **contracted domain event ingress**, **shared gateway events adapter**, **no orphan webhook-deliveries queue**, **immutable evidence**, **test-coverage governance** (the required enterprise test-proof files), **operational proof** (load/chaos scenarios), **CI simulation**, **survivability contracts**, **mobile topology honesty**, **dead/source-ledger residue** — all must stay green. If a new capability needs a new governance proof, **add the proof**, don't disable the validator.
- If `validate-governance.mjs` was already failing on something unrelated and pre-existing at baseline (e.g., a stale `.next/BUILD_ID` build-artifact read, or the date-helper violation), record it in the ledger as a **pre-existing baseline failure** and still leave the suite no worse than baseline; fix it if it's in scope for a task you touch.

**Process discipline**
- After **every** task: update the ledger + status, write/append `IMPLEMENTATION_REPORT.md`, ensure tests+lint+governance pass, commit as one logical change set (Conventional Commits, e.g. `feat(checkout): ...`).
- Convert relative dates to absolute. Leave the working tree clean between tasks.

---

## 3. Execution protocol — the five phases (do them in order, in this one run)

You will produce the discovery/gap/plan/task artifacts, then implement. Phases 1–4 are fast (you already have the blueprint); Phase 5 is the bulk.

**PHASE 1 — Repository discovery.** Read `apps/ services/ packages/ database/ scripts/`. Produce `CHECKOUT_IMPLEMENTATION_AUDIT.md`: existing architecture, modules, APIs, DB (note migrations already at `133`; `131_hot_table_partition_shadow_mirror`, `132_mobile_whatsapp_commerce` exist), queues, auth, payments (`services/api-gateway/src/routes/payments.ts`, `packages/payments`), orders (`routes/orders.ts`), checkout (reserved `services/checkout-runtime` + `packages/checkout-core`), inventory (`routes/inventory.ts`), notifications (`routes/notifications.ts`, reserved `notification-service`, `packages/notification-core`), billing (`routes/internal-billing.ts`, `packages/billing-core`), tenant context (`services/api-gateway/src/lib/tenant-context.ts`), crypto (`lib/crypto.ts`), event-core, webhook-service. Do **not** modify code in this phase.

**PHASE 2 — Gap analysis.** Produce `CHECKOUT_GAP_ANALYSIS.md`: for **every** blueprint module/table/API/event, classify as `EXISTS | PARTIAL | MISSING | DEPRECATED | DUPLICATE | REMOVE`, with the exact file/path evidence and the delta to reach the blueprint.

**PHASE 3 — Implementation plan.** Produce `CHECKOUT_BUILD_PLAN.md`: for every feature — files to create, files to modify, DB migrations (next number = `134`+), APIs, events, tests, dependencies — and the **exact implementation order** (foundation → primitives → domains → channels → money → comms → security → observability), respecting the dependency DAG in §16.

**PHASE 4 — Task generation.** Create `/tasks/checkout/001-foundation.md` … `016-observability.md` (list in §16). Each task file: **Goal · Files (create/modify) · DB migrations + rollback · APIs · Events · Acceptance criteria · Tests · Dependencies · Rollback strategy · `[HUMAN-REQUIRED]` skips.** Use the per-task template in §15.

**PHASE 5 — Implementation.** Implement tasks **in dependency order, one at a time**, each to its Definition of Done (§17). After each: tests/lint/governance green, docs updated, migration+rollback present, ledger+status updated, `IMPLEMENTATION_REPORT.md` appended. Then immediately start the next task. **Do not pause** between tasks. Continue until all 16 are Done or blocked-and-logged.

---

## 4. Blueprint → existing repo mapping (modify these; do not recreate)

| Blueprint context | Implement in (existing) | Notes |
|---|---|---|
| commerce-core monolith | `services/api-gateway` + `packages/commerce-core` | enforce module boundaries; keep routes ≤1500 lines (split into folders like `routes/operations/`) |
| Cart | `packages/commerce-core` (cart module) + gateway routes | new server cart (today client-only in storefront) |
| Checkout | reserved `services/checkout-runtime` + `packages/checkout-core` | activate; in-process orchestration of engines |
| checkout-edge | `services/checkout-runtime` (edge build) + Cloudflare config in `infrastructure/` | edge entry; `[HUMAN-REQUIRED]` for live CF account |
| Order | `routes/orders.ts` + `packages/commerce-core` | add FulfillmentOrder-per-location; refactor if >1500 lines |
| Payment | `routes/payments.ts` + `packages/payments` | adapter pattern + internal contract + session state machine |
| Inventory | `routes/inventory.ts` + `packages/commerce-core` | reservation table + optimistic concurrency |
| Discount | `routes/coupons.ts` + `packages/commerce-core` | 3-class `combines_with` |
| Tax/GST | `routes/shipping-tax.ts` (+ split) + `packages/commerce-core` | place-of-supply, HSN, e-invoice, TCS |
| Shipping | `routes/shipping-tax.ts`/`shipping-labels.ts` | pincode serviceability, aggregator adapters |
| Notification | reserved `services/notification-service` + `packages/notification-core` + `routes/notifications.ts` | WhatsApp-first router |
| Email | `apps/identity-platform/src/lib/email/resend.ts` → generalize into `packages/notification-core` email module | multi-ESP |
| WhatsApp | new module in `packages/notification-core` / `commerce-core` + `services/notification-service`; build on `132_mobile_whatsapp_commerce.sql` | BSP adapter (mock) |
| Billing | `routes/internal-billing.ts` + `packages/billing-core` | UPI AutoPay mandates (mock) |
| Fraud | `packages/commerce-core` (risk module) + `routes` | pluggable OrderRiskAssessment; COD confirmation |
| Settlement | reserved `services/queue-workers` jobs + `packages/billing-core`/ledger | reconcile vs PA reports; COD remittance |
| Payout/Commission | `routes/payouts.ts`, `routes/commission.ts` | split-instruction over PA Route/Easy-Split (mock); **no self-custody** |
| Analytics | reserved `services/analytics-pipeline` + replica MVs | dashboards first, warehouse later |
| Webhook | `services/webhook-service` (exists) | HMAC + timestamp/nonce replay; outbox-sourced |
| Customer | `routes/customers.ts` + `packages/commerce-core` | DPDP consent + DSR |
| Identity | `apps/identity-platform` + `routes/auth.ts` + `lib/tenant-context.ts` | OTP, OAuth2/PKCE, claims→GUC |
| Audit | `packages/infrastructure`/`event-core` relay → `audit_logs` | append-only |
| Media | reserved `services/media-service` + `routes/media.ts` | signed upload, R2 |
| AI | `routes/ai.ts` + new module | NLU for WhatsApp; behind interface (mock model) |
| Event bus / outbox | reserved `services/event-bus` + `packages/event-core` | transactional outbox + relay |
| Reseller (Instagram) | `routes/commission.ts` + storefront `/r/:code` | first-class lightweight tenant |

**Migrations:** add to `database/supabase/migrations/` starting at `134_`; every tenant table gets `ENABLE`+`FORCE` RLS + the tenant-GUC policy; mirror the partitioning pattern already begun in `131_hot_table_partition_shadow_mirror.sql`. Each migration has a paired rollback in the repo's rollback convention.

---
