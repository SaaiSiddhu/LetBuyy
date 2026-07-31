# EINS Discovery A — Feature Architecture (the anatomy of a feature at LetBuyy)

The template EINS's blueprint + tasks emulate. Verified against `graphify-out/domain-intel.json` (22 domains), CLAUDE.md, and the real app/service/migration layout.

## Anatomy of a feature (the canonical vertical slice)
A LetBuyy feature is a **vertical slice** across these layers, in dependency order:

1. **Migration + schema** — `supabase/migrations/NNN_*.sql`: new tables (with `site_id` + RLS forced for tenant data), columns, indexes, triggers.
2. **Canonical RPC** — a `SECURITY DEFINER` Postgres function for any money/state mutation (idempotency_key + `FOR UPDATE`). Money mutations **must** use a canonical-ledger RPC (`create_checkout_order`, `confirm_order_payment_with_ledger`, …) — never `.from(table).insert/update` in TS.
3. **Gateway route** — `services/api-gateway/src/` Hono `/v1/...` route: validates, calls `db.rpc(...)` behind `verifySiteOwnership`. The **only** layer that touches the DB.
4. **App proxy** — `apps/<app>/src/app/**/api/*/route.ts`: same-origin `/api/*` proxy → the gateway. New app API routes are **gateway proxies** (route-ownership lockstep) — never write the DB locally.
5. **UI** — `apps/merchant-control-plane/src/app/[store]/<domain>/...`: composed from `@letbuyy/ui`, `--lb-*` tokens, mobile-first, loading/empty/error states, `formatInrCurrency`/`en-IN`.
6. **Worker/queue (if async)** — `services/queue-workers` consumer + `outbox_events` producer (HMAC-signed envelopes).
7. **Tests** — `tests/**` + per-app tests; acceptance contracts in `tests/launch/`.
8. **Docs** — `docs/...` + governance memory where a rule/decision changes.

## Domain shape (from domain-intel.json)
Each of the 22 domains carries `{ key, label, money, tenant, routes[], rpcs[], tables[], queues[], apps[], workers[], secrets[], owners[], dependsOn[], consumedBy[] }`. A new feature either **extends a domain** (adds routes/rpcs/tables to it) or **introduces a domain** (a new key + owner + the full slice). EINS resolves a request → the target domain(s) via lcis-execution's seed resolver, then expands the slice.

## Worked example — GST (existing)
`gst_invoices` + related tables (tenant), GST computed **server-side** in the RPC, invoices **immutable**. A "Build GST Filing" feature extends the tax/GST domain: new filing tables + a SECURITY DEFINER filing RPC + a gateway `/v1/gst/filing` route + an app proxy + merchant UI + a periodic worker (filing reminders) + tests + docs + a migration. EINS's blueprint reproduces exactly this slice with the affected entities resolved from the graph.

## Hard rules a feature must honor (EINS encodes as gates)
- Money → canonical ledger RPC (server-authoritative amounts; Razorpay HMAC verified server-side).
- Tenant table → RLS forced, `site_id` scoped, gateway access behind `verifySiteOwnership`.
- New app route → gateway proxy (lockstep), never local DB write.
- `--lb-*` design tokens only; INR/`en-IN`; GSTIN capture.
- Keep the 107+ validator gate green; run real `pnpm --filter <app> build`.
