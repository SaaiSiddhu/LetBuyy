# 05 — Incident Management (SHIPPED this wave)

**Exposure: ~25% → ~75%.** A real Incident Center now exists in `platform-console` over the existing gateway backend — the clearest Phase-6 gap closed (backend existed, no page).

## Shipped (verified)
- **Page** `apps/platform-console/src/app/(dashboard)/incidents/page.tsx` (464 lines, 0 fabrication) — 5 leadership metrics (total/open/mitigating/SEV-1·2-open/closed); incident list (severity/status pills, customer impact, affected runtimes/regions, opened→mitigated→resolved timeline, inline status-update, postmortem link, SEV-1/2 close-gate notice); a Declare-Incident form. Loading/empty/error states; server actions require `requireConsoleSession({ mfa: true })`.
- **Nav** wired in `(dashboard)/layout.tsx` (Incidents entry) — no dead/orphan nav.
- **Reuse, no rebuild:** consumes the EXISTING `GET/POST /v1/operations/runtime/incidents` + `PATCH /runtime/incidents/:id/status` via platform-console's server-side `fetchConsoleApi`/`createLetbuyyApiClient` pattern (matched the operations page). Types from `InternalProductionIncident` (`@letbuyy/api-client`). **No new table/RPC/migration/proxy.**
- Respects the gateway RBAC (`incident:view` / `incident:command`) + the `validateSensitiveReason` gate (summary ≥ 8 chars) + the SEV-1/2 postmortem-required close gate.

## Verification
`pnpm --filter @letbuyy/platform-console typecheck` EXIT 0 · merchant-control-plane typecheck PASS (no cross-app breakage) · launch suite 205/205 (Phase 5 untouched) · 0 new migrations.

## Honest boundary
Compile-verified. Real incidents need the live gateway + Supabase (`production_incidents` table) + an authenticated super-admin session with `PLATFORM_CONSOLE_API_TOKEN` — the status PATCH + SEV close-gate can only be exercised on the live stack.

**Verdict:** incident management is now a real internal-ops vertical over the existing backend — the proven exposure pattern, no duplication, no new schema.
