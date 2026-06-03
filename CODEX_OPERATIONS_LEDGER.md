# CODEX OPERATIONS LEDGER

## CURRENT STATUS
- Stage: WS5 Operations.
- Branch: `stream/master-execution`.
- Active task: OP1.2 Revenue Dashboard.
- Source ownership: `apps/platform-console/src/**` and `apps/platform-operations-portal/src/**` only. Root ledgers are bookkeeping exceptions.

## BASELINE
- Mission read: `docs/Codex_waves/CODEX_OPERATIONS_MISSION.md`.
- Local app contracts read: `apps/platform-console/AGENTS.md`, `apps/platform-operations-portal/AGENTS.md`.
- OP1.1 endpoint used: `fetchConsoleApi('/internal/console/stores')` through `apps/platform-console/src/lib/console-api.ts`.
- Existing stores payload fields confirmed in source: store identity, domain, site type, lifecycle status, views, created/updated timestamps.

## PROGRESS LOG
- 2026-06-03T19:02:48Z [OP1.1] Merchant Directory - DONE WITH BACKEND-DATA SKIP. Files: `apps/platform-console/src/app/(dashboard)/stores/page.tsx`, `apps/platform-console/src/app/(dashboard)/stores/StoreDirectoryIndexTable.tsx`, `apps/platform-console/src/app/layout.tsx`, `apps/platform-console/src/app/globals.css`. Replaced the stores page local table composition with shared `@letbuyy/ui` `Page`, `PageHeader`, `Card`, `Section`, `FilterBar`, `MetricCard`, `Badge`, `Banner`, `EmptyState`, and `IndexTable` grammar while preserving the existing `internal-console` stores API call and server-side search/status pagination. Added a colocated client table wrapper so `IndexTable` render callbacks stay on the client side, set the platform console design-system root to dark theme, and added Tailwind `@source` coverage for `@letbuyy/ui` so shared component classes render correctly in the console app. Direct gateway proof `curl -H "Authorization: Bearer local-platform-console-token-placeholder" http://127.0.0.1:8787/v1/internal/console/stores?limit=2` -> HTTP 200 with one seeded store and fields limited to site identity/status/timestamps/views. Real-stack browser proof used temporary local-only `.env.local` alignment for the platform console API URL/token because the developer machine env pointed at staging; the original env file was backed up and restored after capture. Final screenshots show the real `urban-kicks-demo` store row plus plan/revenue backend-needed badges.

## SKIP LIST
- [SKIP - NEEDS BACKEND] OP1.1 Store plan and revenue fields - current `apps/platform-console/src/app/(dashboard)/stores/page.tsx` consumes the existing `/internal/console/stores` response, but the known store contract does not consistently expose `plan_name`, `subscription_plan`, `subscription_status`, `monthly_revenue_paise`, `revenue_paise`, `total_revenue_paise`, `orders_revenue_paise`, or `currency`. The page renders plan/revenue columns and badges missing values as backend-needed; backend must add these fields to the existing internal console stores API before real values can be marked DONE.

## VISUAL LEDGER
- 2026-06-03T19:02:48Z OP1.1 Merchant Directory desktop real-stack screenshot - `.tmp/screenshots/ws5-op1-merchant-directory/desktop.png`.
- 2026-06-03T19:02:48Z OP1.1 Merchant Directory mobile real-stack screenshot - `.tmp/screenshots/ws5-op1-merchant-directory/mobile.png`.

## VALIDATOR LEDGER
- 2026-06-03T19:07:20Z [OP1.1 pre-commit governance] Generated artifact cleanup scan -> no app/service/package `.next`, `.turbo`, nested `node_modules`, `.dart_tool`, `build`, `dist`, or `.wrangler` directories; `pnpm run validate:governance` -> PASS (128/128 validators).
- 2026-06-03T19:02:48Z [OP1.1 scoped] First `pnpm --filter @letbuyy/platform-console typecheck` failed only because generated-artifact cleanup had removed workspace dependency links (`next`, `react`, `@letbuyy/ui` unresolved); `CI=true pnpm install --frozen-lockfile --force` -> PASS with lockfile unchanged and 0 downloads; rerun `pnpm --filter @letbuyy/platform-console typecheck` -> PASS; `pnpm --filter @letbuyy/platform-console lint` -> PASS. Default `pnpm --filter @letbuyy/platform-console build` and `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/platform-console build` both stalled in Turbopack with 0 percent CPU and no source diagnostics, so the stalled processes were terminated; `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/platform-console exec next build --webpack` -> PASS, including `/stores`. `pnpm run federation:local:up` -> PASS; `node .tmp/ws5-op1-merchant-directory-proof.mjs` -> PASS after fixing cookie origin, client-boundary table composition, dark theme, and Tailwind source coverage; final desktop/mobile screenshots captured. `pnpm run federation:local:down` -> PASS; post-fix `pnpm --filter @letbuyy/platform-console typecheck` -> PASS; post-fix `pnpm --filter @letbuyy/platform-console lint` -> PASS; post-fix `NEXT_TELEMETRY_DISABLED=1 pnpm --filter @letbuyy/platform-console exec next build --webpack` -> PASS.
