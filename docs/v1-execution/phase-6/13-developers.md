# 13 — Developer Operations (SHIPPED this wave)

**Exposure: ~25% → ~70%.** A real Developer Operations page now exists in `platform-console` over the existing `operations/developers.ts` backend — gap closed (backend existed, no page).

## Shipped (verified)
- **Page** `apps/platform-console/src/app/(dashboard)/developers/page.tsx` (725 lines, 0 fabrication) — developer **lookup/search**, **detail/overview** (apps, themes, payouts, audit log, earnings), and **moderation** (verify/reject/suspend/restore) + **reconciliation-run** actions. MFA-gated server actions; respects `developer:view` / `developer:manage`; loading/empty/error states.
- **Nav** wired in `(dashboard)/layout.tsx` (Developers entry).
- **Reuse, no rebuild:** consumes `GET /operations/developers/search`, `GET /:id/overview`, `POST /:id/moderation`, `POST /:id/reconciliation/run` via platform-console's server-side `fetchConsoleApi`. **No new table/RPC/migration/proxy.**
- **Money-safety:** the `POST /:id/payouts/:payoutId/release` route (`payout:release`, dual-control) is **deliberately read-only** in the UI — payouts shown, release routed to finance, never auto-triggered. Correct handling of a money-sensitive action.

## Verification
`pnpm --filter @letbuyy/platform-console typecheck` EXIT 0 (integrated with the incidents page) · launch suite 205/205 (Phase 5 untouched) · 0 new migrations.

## Honest boundary
Compile-verified. Real developer data + the moderation/reconciliation actions need the live gateway + Supabase + a super-admin console session with `PLATFORM_CONSOLE_API_TOKEN` + the relevant permissions.

**Verdict:** developer operations is now a real internal-ops vertical over the existing backend — proven exposure pattern, no duplication, no new schema, money-sensitive release correctly left to finance.
