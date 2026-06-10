# Repository Map

## Top-Level Roots

- `apps/`: web and Flutter applications.
- `backend/`: Cloudflare Workers and Supabase migrations.
- `packages/`: shared TypeScript and Dart packages.
- `docs/`: generated and hand-maintained operational documentation.
- `memory/`: durable engineering lessons.
- `tasks/`: active platform backlog and risk register.
- `scripts/`: repository intelligence and operational scripts.
- `infrastructure/`: Terraform DNS and platform infrastructure.

## Web Applications

| App | Path | Current Role |
|---|---|---|
| Accounts | `apps/web/consumer/accounts` | Merchant auth, signup, sessions, onboarding, store selection. |
| Admin | `apps/web/consumer/admin` | Per-store merchant operations, products, orders, CMS, themes, analytics. |
| Storefront | `apps/web/consumer/storefront` | Wildcard tenant storefronts, product browsing, cart, checkout, customer accounts. |
| Landing | `apps/web/consumer/landing` | Marketing, pricing, conversion into accounts. |
| App Store | `apps/web/consumer/app-store` | Extension marketplace and developer submission flow. |
| Theme Marketplace | `apps/web/consumer/theme-marketplace` | Theme catalog, purchase, install, and acquisition workflow. |
| Console | `apps/web/administrative/console` | Super admin scaffold, not production-ready governance tooling. |
| Team | `apps/web/administrative/team` | Employee portal scaffold, not production-ready support tooling. |

## Flutter Applications

| App | Path | Current Role |
|---|---|---|
| Builder | `apps/flutter/builder` | Native/mobile store builder, merchant operations, preview systems. |
| Super Admin | `apps/flutter/super_admin` | Native super admin scaffold. |
| Team | `apps/flutter/team` | Native team scaffold. |

## Shared Packages

- `packages/typescript/ui`: shared React primitives, currently minimal.
- `packages/typescript/utils`: Supabase/API/auth helpers.
- `packages/typescript/api-types`: shared TypeScript contracts and theme registry.
- `packages/dart/core`: Dart constants, config, responsive helpers.
- `packages/dart/models`: commerce and platform models.
- `packages/dart/services`: data, payment, analytics, order, auth, storage, notifications.
- `packages/dart/ui_kit`: Flutter widgets, theme primitives, loading/error/empty states.

## Backend

- `backend/workers/api/src/index.ts`: Hono worker entrypoint, middleware, route mounting, scheduled jobs.
- `backend/workers/api/src/routes`: 30 route modules covering auth, storefront, commerce, admin, apps, themes, analytics, operations, media, and uploads.
- `backend/workers/api/src/services`: business workflows, tenant context, theme validation, outbox, queues, payments, orders.
- `backend/workers/api/src/schemas`: Zod request schemas.
- `backend/workers/webhooks/src/index.ts`: payment provider webhook verification and reconciliation.
- `backend/supabase/migrations`: 58 migration files in current scan.

## Infrastructure And Tooling

- `pnpm-workspace.yaml`: web, worker, and TypeScript workspace roots.
- `turbo.json`: build, lint, test, and typecheck task graph.
- `vercel.json`: web deployment install workaround.
- `backend/workers/*/wrangler.toml`: Cloudflare Worker configuration.
- `infrastructure/dns.tf`: Cloudflare DNS records for web, API, webhooks, and wildcard storefront routing.

## Documentation Memory

- `docs/architecture`: generated repository intelligence and architecture topic docs.
- `docs/commerce-os-audit`: commerce operating system audit material.
- `docs/agents`: agent-facing operational governance and long-term memory.

## Testing Reality

The scan found only 3 test files, all Flutter default-style widget tests. Treat web, worker, migration, payment, webhook, auth, tenant isolation, and theme workflows as under-tested until proven otherwise.
