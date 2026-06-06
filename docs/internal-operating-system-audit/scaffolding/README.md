# Internal-OS Scaffolding (DRAFTS — not live)

These files are **reference scaffolding** for the [Internal Operating System mission](../../../CODEX_INTERNAL_OPERATING_SYSTEM_FOUNDATION_MISSION.md). They are intentionally placed **under `docs/`**, NOT in `database/supabase/migrations/` or `services/api-gateway/src/`, so they do **not** enter the live migration chain, the gateway build, or governance validation until Codex finalizes them. Nothing here affects `node scripts/validate-governance.mjs` today.

## What's here

- `migrations/090_*.sql … 096_*.sql` — draft DDL for the 7 internal-OS migrations (risk, trust-safety, support, review-checks, exec rollups, incident on-call, case audit). House-style: `id/created_at/updated_at/deleted_at` + audit columns, partial indexes on `deleted_at IS NULL`, `update_updated_at()` trigger, RLS via `service_role` + `is_super_admin()`.
- `gateway/GATEWAY_SUBROUTER_STUBS.md` — copy-paste sub-router stubs (`risk.ts`, `trust-safety.ts`) showing the exact guard / Zod / audit / mount pattern mirrored from `operations.ts`.

## How Codex must finalize them (do NOT just copy blindly)

1. **Re-check the migration band at run time.** These are numbered `090–096` assuming `089` is the highest. If migrations `090+` already exist when you run, renumber sequentially from the next free prefix and keep them contiguous (`migration-governance.md`).
2. **Move, don't duplicate.** Copy each `.sql` into `database/supabase/migrations/` (live chain), then delete the draft. Match the baseline's exact PK/FK convention (baseline declares `PRIMARY KEY`/foreign keys via separate `ALTER TABLE ADD CONSTRAINT`; these drafts use inline `PRIMARY KEY` for readability — normalize to house style).
3. **Wire RLS to real helpers.** `public.is_super_admin()`, `public.update_updated_at()`, and `public.log_audit_event()` already exist in `000_baseline.sql`. Confirm signatures before relying on them. Add per-table audit triggers (`audit_<table>`) where the table holds enforcement/decision records.
4. **Tighten RLS.** The drafts grant `service_role` full access + `super_admin` read. Add narrower operator-scope policies per the permission tiers in the mission (§INF-11) before production.
5. **Mount sub-routers, never edit `index.ts`.** Per mission §1.12, mount the gateway sub-routers inside the already-mounted `/operations` and `/internal/console` routers.
6. **Add Zod schemas + the audit helper call** to every mutation (mission §INF-03).

## Optional: safety-first wave re-sequence

The mission runs `WS-1` (surface the already-built incident plane — cheap, independent, high ROI) before `WS-3/WS-4` (Risk + Trust & Safety). If you'd rather **close the biggest exposure first**, run this order instead and update the ledger notes:

`WS-0 → WS-3 (Risk) → WS-4 (Trust & Safety) → WS-1 (Incident surface) → WS-2 (Merchant 360) → WS-7 (Support) → WS-5 (App/Theme review) → WS-6 (Dev Ops) → WS-8 (Exec) → WS-9 → WS-10`

Rationale: Risk + T&S are greenfield (0 tables today) and represent real fraud/abuse exposure; the incident plane already has data and degrades gracefully if deferred. Dependency note: keep T&S immediately after Risk (Risk auto-opens T&S cases), and keep Merchant 360 before Support (Support embeds it).
