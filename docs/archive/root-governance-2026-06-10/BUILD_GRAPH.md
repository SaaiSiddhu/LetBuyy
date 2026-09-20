# BUILD_GRAPH

Generated: 2026-06-09T19:21:18Z  
Branch: `stepup/main`  
Baseline commit: `c2547049c0b5666661536d076046415714fb7d03`  
Sources: `tsconfig.workspace.json`, `turbo.json`, package manifests.

## Root Build Commands

Root `package.json` exposes:

- `pnpm run build` -> `turbo build`
- `pnpm run typecheck` -> `turbo typecheck`
- `pnpm run test` -> Node tests plus contract tests
- `pnpm run validate:dependencies` -> dependency manifest, undeclared import, package export, dependency graph, and circular import validators

## Turbo Pipeline

| Task | Depends on | Outputs | Notable env |
|---|---|---|---|
| `build` | `^typecheck`, `^build` | `.next/**`, `dist/**`, `build/**` | Supabase public vars, accounts/admin URLs, Resend, Upstash, Turnstile |
| `dev` | none | none | cache disabled, persistent |
| `lint` | none | none | none |
| `test` | `^typecheck`, `^build` | `coverage/**` | `CI` |
| `typecheck` | `^build` | none | none |

Drift: `build/**` is a Turbo output and also a V2 delete-from-VCS/generated root. It is locally present.

## TypeScript Workspace References

`tsconfig.workspace.json` references 30 package projects:

1. `packages/shared-types`
2. `packages/event-core`
3. `packages/commerce-core`
4. `packages/theme-engine`
5. `packages/auth-core`
6. `packages/audit-core`
7. `packages/identity-core`
8. `packages/organization-core`
9. `packages/permission-core`
10. `packages/session-core`
11. `packages/token-core`
12. `packages/cms-core`
13. `packages/search-core`
14. `packages/app-engine`
15. `packages/extension-host`
16. `packages/checkout-core`
17. `packages/payments`
18. `packages/billing-core`
19. `packages/notification-core`
20. `packages/tenant-core`
21. `packages/distributed-runtime`
22. `packages/orchestration`
23. `packages/projection-runtime`
24. `packages/application-services`
25. `packages/infrastructure`
26. `packages/runtime-composition`
27. `packages/typescript/api-client`
28. `packages/typescript/api-types`
29. `packages/typescript/ui`
30. `packages/typescript/utils`

Drift: `packages/typescript/utils` is referenced but no `packages/typescript/utils/package.json` was found by the Phase A package manifest scan.

## Local Package Dependency Edges

### Apps

- `@letbuyy/app-marketplace`: `@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/billing-core`, `@letbuyy/shared-types`, `@letbuyy/ui`
- `@letbuyy/developer-portal`: `@letbuyy/ui`
- `@letbuyy/identity-platform`: `@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/tenant-core`, `@letbuyy/ui`
- `@letbuyy/marketing-site`: `@letbuyy/api-client`, `@letbuyy/api-types`, `@letbuyy/ui`
- `@letbuyy/merchant-control-plane`: `@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/cms-core`, `@letbuyy/extension-host`, `@letbuyy/shared-types`, `@letbuyy/theme-engine`, `@letbuyy/ui`
- `@letbuyy/platform-console`: `@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/shared-types`, `@letbuyy/ui`
- `@letbuyy/platform-operations-portal`: `@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/shared-types`, `@letbuyy/ui`
- `@letbuyy/storefront-runtime`: `@letbuyy/api-client`, `@letbuyy/app-engine`, `@letbuyy/auth-core`, `@letbuyy/checkout-core`, `@letbuyy/cms-core`, `@letbuyy/commerce-core`, `@letbuyy/extension-host`, `@letbuyy/runtime-composition`, `@letbuyy/shared-types`, `@letbuyy/tenant-core`, `@letbuyy/theme-engine`, `@letbuyy/ui`
- `@letbuyy/theme-marketplace`: `@letbuyy/api-client`, `@letbuyy/auth-core`, `@letbuyy/shared-types`, `@letbuyy/theme-engine`, `@letbuyy/ui`

### Services

- `@letbuyy/api-gateway`: `@letbuyy/api-types`, `@letbuyy/app-engine`, `@letbuyy/application-services`, `@letbuyy/audit-core`, `@letbuyy/auth-core`, `@letbuyy/billing-core`, `@letbuyy/checkout-core`, `@letbuyy/cms-core`, `@letbuyy/commerce-core`, `@letbuyy/event-core`, `@letbuyy/extension-host`, `@letbuyy/identity-core`, `@letbuyy/infrastructure`, `@letbuyy/notification-core`, `@letbuyy/orchestration`, `@letbuyy/organization-core`, `@letbuyy/payments`, `@letbuyy/permission-core`, `@letbuyy/runtime-composition`, `@letbuyy/session-core`, `@letbuyy/shared-types`, `@letbuyy/tenant-core`, `@letbuyy/theme-engine`, `@letbuyy/token-core`
- `@letbuyy/mobile-bff`: `@letbuyy/auth-core`
- `@letbuyy/queue-workers`: `@letbuyy/billing-core`, `@letbuyy/event-core`, `@letbuyy/infrastructure`, `@letbuyy/notification-core`, `@letbuyy/orchestration`, `@letbuyy/runtime-composition`, `@letbuyy/shared-types`
- `@letbuyy/webhook-service`: `@letbuyy/auth-core`, `@letbuyy/infrastructure`

### Quarantine-Relevant Package Edges

- `@letbuyy/application-services` depends on `@letbuyy/orchestration`.
- `@letbuyy/orchestration` depends on `@letbuyy/distributed-runtime`.
- `@letbuyy/projection-runtime` depends on `@letbuyy/distributed-runtime`.
- `@letbuyy/runtime-composition` depends on `@letbuyy/application-services` and `@letbuyy/projection-runtime`.
- `@letbuyy/storefront-runtime` depends on `@letbuyy/runtime-composition`, `@letbuyy/app-engine`, and `@letbuyy/extension-host`.
- `@letbuyy/api-gateway` depends on `@letbuyy/application-services`, `@letbuyy/orchestration`, `@letbuyy/runtime-composition`, `@letbuyy/app-engine`, and `@letbuyy/extension-host`.

## Phase A Build Graph Finding

The V2 quarantine list is still embedded in the build graph. `distributed-runtime`, `projection-runtime`, `orchestration`, `application-services`, `app-engine`, `extension-host`, and `runtime-composition` all require planned rewiring before quarantine can pass build/dependency gates.
