# LETBUYY PLATFORM CONSTITUTION — CANDIDATE

**Status:** CANDIDATE · **Date:** 2026-06-09 · **Scope:** runtime topology, commerce subsystems, money rails, theme/extensibility, data, production operations. Subordinate to the Master Constitution.

Grounded in `LETBUYY_FOUNDATION_FORENSICS.md`, `LETBUYY_THEME_EDITOR_FORENSICS.md`, `LETBUYY_REPOSITORY_ARCHAEOLOGY_REPORT.md`, `LETBUYY_PRODUCTION_READINESS_FORENSICS.md`.

---

## Article I — Runtime topology is honest

1. **One backend: `services/api-gateway`.** This is FROZEN as the system's actual runtime. The modular-monolith-on-Cloudflare-Workers reality is the design, not an embarrassment to be hidden behind a microservice façade.
2. **A service is real or it is reserved — never both.** `analytics-pipeline`, `checkout-runtime`, `event-bus`, `media-service`, `notification-service`, `search-service` are reserved placeholders (manifest + AGENTS.md only). They MUST NOT be deployed, monitored, or counted as capability until they contain executing source.
3. **The distributed-runtime tower is on probation.** `distributed-runtime`/`projection-runtime` execute in **zero** product paths (product mutations go route → `*ExecutionAdapter` → raw `db.from(table)` + an `outbox_events` upsert). Within one quarter: wire it to a real path or remove it from the build closure. It MUST NOT inflate platform claims while dormant.

## Article II — Money rails (the platform's reason to exist)

1. **Payouts call a real provider.** The fabricated-UTR, no-HTTP-call payout adapter (`payout-transfer-adapter/index.ts:82-103`) MUST be replaced with a verified provider integration before any merchant sees a "paid" status. Debiting a wallet for money that never moved is prohibited.
2. **Capture posts to the ledger.** `buildPaymentCaptureLedgerPosting` (`packages/payments/src/index.ts:420`) currently has no caller; captures MUST debit `pa_clearing` in the canonical ledger atomically. The ledger is the system of record, not a projection of `orders.total`.
3. **Default money mode is never `mock` in production.** The default `mock` capture path (`payments.ts:130,604`) that marks orders `paid` with a synthetic provider id MUST be impossible to select in a production runtime.
4. **`bigint` minor units everywhere.** Migrate the `integer` money columns in `migrations/119` (overflow at ₹21,474,836.47) to `bigint` to match canonical `migrations/139/151`.
5. **Idempotency on every money mutation.** Capture/refund/payout/commission MUST be idempotent by key (the inbound webhook path already is — extend it outbound).

## Article III — Fulfillment, tax, KYC are real or off

1. **No synthetic logistics in production.** The scaffold logistics adapter (fake label URLs, no carrier fetch — `logistics-adapter/index.ts:146-158`) MUST integrate a real carrier (e.g. Shiprocket/Delhivery) or the shipping feature is disabled, not faked.
2. **KYC is a real verification or onboarding is gated.** Sandbox auto-verify (`kyc.ts:71-79`) MUST NOT be the production path for a regulated money platform.
3. **Tax e-invoicing (IRP/IRN) is real before it is claimed** (`tax.ts:113-115` mock).

## Article IV — Theme engine

1. **Editor and renderer share one section contract.** Today the storefront renderer dispatches on a `rendererKey` string and never validates against the registry (`theme-registry.ts` not imported in `storefront-runtime`), so a saved section can silently render nothing. The renderer MUST validate section types against the live registry at render time.
2. **Built-in section types MUST have schemas.** 12 of 24 `BuiltInSectionType` values have no schema entry; declared-but-unschemaed sections are prohibited.
3. **Theme/section schema changes MUST ship a migration.** Existing stores' JSONB settings MUST be migrated when a section schema evolves; silent stale-settings drift is prohibited.
4. **App blocks are real or absent.** The placeholder `<div data-letbuyy-app-block>` (`theme-renderer.ts:505-526`) MUST NOT be presented as a working app-extension surface.

## Article V — Data & persistence

1. **Supabase is the datastore; the schema is the contract.** The 89 migrations are FROZEN as the canonical schema. Schema changes go through migrations + the architecture-governance gate, never ad-hoc.
2. **No `service_role` reads of tenant data without a scoping guarantee** (see Auth Constitution Art. II).

## Article VI — Production operations

1. **Backups before features.** Continuous backup + PITR MUST exist before the next production deploy (currently only a 7-day pre-migration artifact).
2. **Observability deployed before GA.** The Prometheus/Grafana/Loki config MUST be a running deployment with wired datasources, not unapplied YAML.
3. **No placeholder secrets in production config.** `SKIP_NEEDS_HUMAN` in `wrangler.toml` (incl. `WHATSAPP_WEBHOOK_SECRET`) is a release blocker.
4. **One canonical domain.** Resolve the `letbuyy.com` (CI build) vs `letbuyy.store` (deploy-injected) split before GA; cookie `COOKIE_DOMAIN` and deploy URLs MUST agree.

---

## FROZEN (protect — these are the genuine assets)
api-gateway as the real backend; the double-entry ledger kernel (`migrations/139`); the order state machine + `FOR UPDATE` inventory locking; the section/block theme model + draft→publish; inbound payment webhook HMAC + idempotency; the 89-migration schema; the coherent Workers(backend)+Vercel(frontend) deploy split.

## CONDEMNED (fix before GA)
Fabricated payouts; capture-not-posted-to-ledger; default `mock` money mode; `integer` money columns; synthetic logistics/KYC/e-invoice; renderer/registry decoupling; unschemaed section types; no schema migration; the dormant distributed-runtime tower in the build; paper services as topology; no backups; undeployed observability; placeholder production secrets; the dual-domain split.

## Scores
**Foundation 58/100 · Theme Editor 62/100 · Commerce-OS readiness 40/100 · Production 31/100.** The deterministic core is the strength; the money/fulfillment/ops rails are the liability.
