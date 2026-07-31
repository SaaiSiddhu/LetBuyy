# EINS Discovery E — Repository Construction (how the repo really evolves)

The real construction lifecycle EINS's TaskIntelligence + AgentIntelligence services mirror. Verified against `supabase/migrations/` (103 migrations), `services/api-gateway/`, `scripts/validators/` (112 validators), `.github/workflows/`, and CLAUDE.md.

## Build order (the dependency chain a feature follows)
1. **DB first** — write the migration (`supabase/migrations/NNN_name.sql`) + the SECURITY DEFINER RPC. Schema + RPC land before anything calls them.
2. **Gateway route** — add the `/v1` Hono route that calls the RPC behind `verifySiteOwnership` (route-ownership lockstep).
3. **App proxy** — add the same-origin `/api/*` proxy route in the owning app.
4. **UI** — build the merchant-control-plane screen from `@letbuyy/ui` + `--lb-*` tokens.
5. **Worker/async** — add the queue consumer + `outbox_events` producer if the feature is asynchronous.
6. **Tests** — unit + integration + acceptance (`tests/launch/`), per the affected surface.
7. **Docs** — update `docs/` + governance memory if a rule changed.

## Validation gates (must be green before merge)
- **The 107+ validator gate** — `scripts/validators/*.mjs` (112 files): topology, imports, packages, env, generated artifacts, and the **canonical-ledger-only-validator** (no `.from(money_table).insert/update` in TS), route-ownership lockstep, RLS-forced, design-system ratchet.
- **Real builds** — `pnpm --filter <app> build` (the gate does not cover `next build`).
- **Typecheck + tests** — `tsc --noEmit` + the suite per touched package.
- **Two-lane merge rule** — one lane merges at a time (lane-a/lane-b worktrees).

## Migration evolution
- Migrations are **sequential** (`NNN_` prefix). Rollback is governed by the rollback-integrity validator + `scripts/.../production-rollback.mjs`; **per-migration down-script presence is not in any artifact** → EINS marks migration reversibility honestly (PARTIAL/UNKNOWN where it cannot prove a down path), reusing lcis-execution's MigrationIntelligence.

## Release pipeline (`.github/workflows/`)
- `production-deploy.yml`: **migrate-production → deploy workers → deploy Vercel** (gate order). Rollback via `production-rollback.mjs`. No canary declared.
- Webhooks/queue jobs HMAC-signed; service-role gateway access only behind `verifySiteOwnership`.

## What EINS produces from this
- **Engineering tasks**, ordered to this exact chain (DB → RPC → gateway → proxy → UI → worker → tests → docs), each carrying its validation gate.
- **Agent task graph** — backend / database / testing / documentation / verification tasks, dependency-aware, matching the build order, so a fleet of execution agents (humans or agents) can pick them up. EINS plans this order; it never executes it.
