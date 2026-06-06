# Retired TypeScript Utils Package

Purpose: Archive marker for the retired `@letbuyy/utils` package formerly located at `packages/typescript/utils`.

Status: Retired on 2026-06-06 during foundation hardening F7.2. The package had no source importers but was declared by web app manifests and exported a Supabase service-role helper, making that service-role edge reachable from app dependency graphs.

Ownership Rules

- Do not restore this package as an active workspace package.
- Do not reintroduce `@letbuyy/utils` into app, service, package, or runtime manifests.
- Shared browser-safe API clients belong in `packages/typescript/api-client`.
- Shared UI utilities belong in `packages/typescript/ui`.
- Server-side Supabase/provider helpers belong behind service boundaries or `packages/infrastructure` adapters, never in app-reachable utility packages.

Forbidden Imports

- No active source may import `@letbuyy/utils`.
- No app graph may contain a package that exports `SUPABASE_SERVICE_ROLE_KEY`, `createSupabaseServiceClient`, or a service-role admin client.

Runtime Authority

- This archive has no runtime authority and must not be listed in `pnpm-workspace.yaml`, runtime manifests, or dependency validators.

Migration Notes

- The retired package files were: `package.json`, `tsconfig.json`, `src/index.ts`, `src/api.ts`, `src/auth.ts`, and `src/supabase.ts`.
- Git history remains the source for exact retired implementation contents.
- `scripts/validators/app-utils-service-role-edge-validator.mjs` guards the removal invariant.
