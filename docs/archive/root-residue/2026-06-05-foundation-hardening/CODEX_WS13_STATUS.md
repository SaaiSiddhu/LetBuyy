# CODEX WS13 EXTENSION PLATFORM STATUS - 2026-06-05T06:16:23Z

Status: DONE LOCALLY - AWAITING HUMAN DEPLOYED STAGING PROOF.

## LOCAL SCOPE
- X0 manifest contract, X1 per-store registry, X2 Admin UI extension host, X3 Checkout UI extension host, X4 theme app-block wiring, X5 Wasm Functions runtime, and X6 lifecycle/observability/developer handoff are implemented locally.
- X0-X5 are committed through `bbc92bb1` with post-commit governance green.
- X6 passed the full local pre-commit gate.

## COMPLETED
- Manifest schema `2026-06-05.ws13` covers Admin UI, Checkout UI, theme app blocks, and Wasm Functions.
- Per-store extension and Function registry rows are tenant-scoped by `site_id`, versioned by app/manifest version, enable-disable capable, and revoked on uninstall.
- Admin and checkout UI extensions render through sandboxed extension hosts.
- Theme app blocks are injected into WS11 portable Liquid app-block slots.
- Checkout Functions execute through the gateway-owned Wasm runtime with SHA-256 verification, no imports, typed JSON I/O, 1-5ms budgets, and fail-closed checkout validation.
- Lifecycle contract `2026-06-05.ws13.lifecycle` publishes registry snapshots, developer handoff metadata, review checklist, lifecycle routes, and observability signals.
- Developer portal reference data and platform operations review packets use the same lifecycle/review contract.

## LOCAL PROOF
- `node --test tests/app-platform/*.test.mjs` -> PASS (16/16).
- `pnpm --filter @letbuyy/shared-types build` -> PASS after escalated frozen install restored workspace links with lockfile unchanged.
- `pnpm --filter @letbuyy/app-engine typecheck` -> PASS.
- `pnpm --filter @letbuyy/api-gateway typecheck` -> PASS.
- `pnpm --filter @letbuyy/developer-portal typecheck` -> PASS.
- `pnpm --filter @letbuyy/platform-operations-portal typecheck` -> PASS.
- `pnpm turbo typecheck` -> PASS (60/60 tasks).
- `pnpm run lint` -> PASS (9/9 tasks, existing warnings only).
- `pnpm run test` -> PASS (331/331 tests).
- Generated artifact cleanup under `apps`, `services`, and `packages` -> PASS.
- `.DS_Store` scan under governed roots -> no matches.
- `pnpm run validate:governance` -> PASS (128/128 validators; 2817 tracked files scanned).

## SKIPPED - NEEDS HUMAN
- Deployed staging extension proof requires staging gateway/storefront/admin deployment credentials, seeded merchant/store/app/theme/checkout data, and an approved example partner app origin hosting Admin UI, Checkout UI, app-block assets, and Wasm module bytes.
