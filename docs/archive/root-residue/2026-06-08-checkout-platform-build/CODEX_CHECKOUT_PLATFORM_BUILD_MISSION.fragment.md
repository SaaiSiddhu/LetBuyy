
## 5. Foundation Stepup — Task `001` (the load-bearing phase, do it deepest)

Everything else is `blockedBy: 001`. This task builds the primitives the 22 contexts share. **Over-invest here.** Build on what exists (`lib/tenant-context.ts`, `lib/crypto.ts`, `lib/replayable-secret-redaction.ts`, `packages/event-core`, `packages/tenant-core`, migration `131_hot_table_partition_shadow_mirror.sql`) — extend, don't recreate. Deliver these twelve primitives, each with tests and green governance:

**F1 — Tenant-isolation kernel.** Extend `services/api-gateway/src/lib/tenant-context.ts` + `packages/tenant-core`: per-transaction `SET LOCAL app.current_store_id` from validated JWT claims; an app-layer data-access wrapper that **requires** a `store_id` predicate; a migration helper that applies `ENABLE ROW LEVEL SECURITY` + `FORCE` + the tenant-GUC policy to every tenant table. *Acceptance:* a CI test fails any query lacking a tenant filter; cross-tenant read returns zero rows when GUC unset (fail-closed); all existing 356 policies remain green.

**F2 — Transactional outbox.** Migration `134_outbox.sql` (the `outbox` DDL in blueprint §14.2) + a `writeWithOutbox(tx, domainRows, event)` helper in `packages/event-core` + a relay (in `services/event-bus` / `services/queue-workers`) that publishes unpublished rows and marks `published_at`. *Acceptance:* no domain write publishes an event except via the outbox; a crash between write and publish loses nothing (test it).

**F3 — Event bus + versioned catalog + schema registry.** In `packages/event-core`: typed definitions for the **entire Appendix-A event catalog** (`order.created.v1`, etc.), publish-via-outbox, subscribe-with-idempotency, and the **shared gateway events adapter** (keep the "Gateway events client" + "Contracted domain event ingress" validators green). *Acceptance:* contract tests for every event; consumers dedupe on `event_id`; governance event validators green.

**F4 — Saga/compensation framework.** A small orchestrator (persisted step state, idempotent steps, compensations) used by checkout↔payment↔order, refund, settlement. *Acceptance:* "payment captured but order-create failed → auto-refund compensation" has a passing test.

**F5 — Idempotency kernel.** Key store + middleware + unique partial indexes for all externally-retried mutations. *Acceptance:* duplicate submit / duplicate webhook produce exactly one effect (tested).

**F6 — Money kernel (highest care).** `bigint` minor-units money type + `currency`; append-only **double-entry ledger** core (post balanced debit/credit, reversing entries only — no UPDATE/DELETE), the accounts set (`pa_clearing, merchant_payable, platform_revenue, gst_payable, cod_receivable, reserve, vendor_payable, refund_clearing`), and a **balance-invariant checker** (Σdebit=Σcredit per store+currency). Single-writer = settlement module. *Acceptance:* property test proves balance invariant under random postings; ledger rejects UPDATE/DELETE; reversing-entry path tested.

**F7 — Migration & rollback framework.** Forward+rollback pairs; the RLS/FORCE template (F1); a partition helper mirroring `131`. *Acceptance:* every new migration has a working rollback; partitioned tables created for the §14.3 hot list.

**F8 — Channel dimension.** Add `channel ∈ {web,whatsapp,instagram,pos,api}` to cart/checkout/order primitives + types in `packages/shared-types`. *Acceptance:* channel flows end-to-end and is queryable.

**F9 — Observability kernel.** Structured logger (every line: `request_id, trace_id, store_id, channel, actor`; PII/PAN redaction reusing `replayable-secret-redaction`); OpenTelemetry tracing across the edge→checkout→engines→payment→order spine and async consumers; a metrics registry (RED/USE + the business metrics in §16 of the blueprint); the append-only **audit-log relay**. *Acceptance:* a single trace spans sync + async for one order; no PII in logs (tested).

**F10 — Security kernel.** Field-level encryption helper + KMS envelope (mock KMS adapter behind the real interface, `[HUMAN-REQUIRED]` for live KMS); webhook **signature + timestamp-window + nonce** verifier; JWT/PKCE claims→GUC bridge; maker-checker + step-up scaffolding for money actions. *Acceptance:* replayed/forged webhook rejected (tested); encrypted PII columns round-trip.

**F11 — Module-boundary enforcement.** Packwerk-style import rules so contexts don't read each other's tables/internals; keep the **domain-boundary** + **single-writer** validators green. *Acceptance:* a deliberate boundary violation fails CI.

**F12 — Test harness + governance proofs.** Unit/integration/contract harness; add the required enterprise **test-proof files**, **load/chaos** scenarios, and **CI simulation** entries the governance suite expects for the new capabilities. *Acceptance:* `node scripts/validate-governance.mjs` is fully green (or no-worse-than-baseline with pre-existing failures logged).

**001 exit criteria (all must hold):** a **reference vertical slice** proves the kernel end-to-end — under a tenant GUC, a domain write + `outbox` row commit atomically, the relay publishes `order.created.v1`, an idempotent consumer posts a **balanced** ledger entry, the whole path is **traced + audited**, and a replayed event causes no double effect — with tests, and `validate-governance.mjs` green. Only then start `002`.

---
