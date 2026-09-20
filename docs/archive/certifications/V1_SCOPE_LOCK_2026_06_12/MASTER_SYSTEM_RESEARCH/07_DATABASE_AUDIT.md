# 07 — DATABASE AUDIT (Supabase Postgres)

**HEAD `c7c82847` · code-verified.** Counts from `000_baseline.sql` (the bulk) + ~100 incremental migrations.

## Shape

- **237 tables**, **393 indexes** (baseline alone), **234 tables RLS-ENABLE**. FORCE RLS is applied to tenant tables via later migrations (e.g. 145, 164) — `rls-force-coverage-validator` is green.
- ~101 migrations, sequential, append-only, tracked (gate's untracked-migration guard enforces it). Money width is `bigint` paise; partitioned hot tables (`outbox_events`, `platform_queue_jobs`, `webhook_deliveries`, telemetry — migs 079-083).

## Money safety (the highest-stakes review)

- **DB-enforced double-entry:** `enforce_ledger_transaction_balance()` CONSTRAINT TRIGGER (mig 139) rejects unbalanced postings at commit; ledger is append-only (`reject_ledger_mutation`). Single source of money truth; balances derived.
- **Commission 0** forced by default + backfill (mig 162). COD/refund/payout post the canonical ledger (migs 165/168).
- **No mutable-balance-as-truth, no parallel money store, no unledgered flow** found (verified this session + by `canonical-ledger-only-validator`).

## Tenancy safety

- 234 RLS-enabled tables; tenant scoping by `site_id` + GUC (`withTenantTx`); the gateway runs **off blanket `service_role`** (`no-blanket-service-role-validator`). `no-public-using-true-validator` blocks `USING(true)` on sensitive tables (mig 163 hardened baseline policies).

## Indexes / performance

- 393 indexes is substantial coverage. Hot-path indexes present: `idx_carts_session (store_id, session_id)`, `idx_checkout_sessions_site_created`, `idx_contacts_active (site_id)`, trigram search indexes (mig 084), FK hygiene + order indexes (mig 110).
- **Watch items (verify under load, not provable from schema alone):** the partitioned queue/outbox tables (write-hot at checkout volume); inventory reservation rows under contention; `order_items`/`orders` tenant-scoped reads at scale. No obviously missing index was found on the documented hot paths, but a load test is the only way to prove index sufficiency.

## Migration integrity

- No duplicate prefixes, no gaps beyond the documented baseline-gap (001-072 absent by design), no untracked migration (gate green). New Liquid bundle migs 171/172 are additive jsonb merges (safe).

## Risks (proven vs to-verify)

- **Proven safe:** money double-entry, append-only ledger, RLS coverage, commission-zero.
- **To verify under load (not a schema defect):** Postgres write throughput on the checkout→order→ledger→inventory path at high concurrency (see `10_SCALING_ANALYSIS.md`); single-region Postgres is the write ceiling (multi-region is a frozen seam).
- **No tenant leak, no money risk, no unsafe `USING(true)`** found in code.

**Verdict:** the database is the soundest part of the platform — money- and tenancy-correct by construction, well-indexed. Its only scaling constraint is the single regional Postgres write capacity, which is an architecture choice (one region), not a defect.
