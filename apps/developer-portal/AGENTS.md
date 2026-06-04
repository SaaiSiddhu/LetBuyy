# Developer Portal AGENTS.md

Purpose: Public developer ecosystem portal for LetBuyy API, OAuth, webhook, theme, app, and partner dashboard documentation.

Actual source root: `apps/developer-portal`.

## Runtime Rules

- Own routing, rendering, presentation adapters, documentation IA, and static developer reference content only.
- Document real contracts by reading `services/api-gateway`, `services/webhook-service`, `packages/app-engine`, `packages/theme-engine`, and `packages/auth-core`; do not import or edit those sources from this app.
- Use `@letbuyy/ui` for design-system components, icons, token styles, and self-hosted font alignment.
- Do not create app-local API routes, business logic, provider SDK calls, database clients, service-role secrets, or backend mutations.
- When API, SDK, CLI, partner, payout, or analytics endpoints are not present, render `[SKIP - NEEDS BACKEND]` or `[SKIP - NEEDS SDK/CLI]` instead of fabricating capability.
- Keep developer docs accurate to the current `/v1` API gateway and app/theme engine contracts.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, database migrations, or generated output.
- No direct imports from packages that are not declared in `package.json`.
- No provider SDKs or secret-bearing utilities.

## Runtime Authority

This is a thin Next.js documentation and dashboard-shell runtime. Workflow, OAuth execution, webhook delivery, theme package validation, app installation, billing, payouts, analytics, and tenant authorization remain owned by backend services and governed packages.

## Migration Notes

- If developer dashboard data contracts are later added, consume them through versioned `/v1` gateway endpoints or a shared API client.
- If a real LetBuyy CLI or SDK package is introduced, replace `[SKIP - NEEDS SDK/CLI]` content with package-owned docs and add the dependency to `runtime.manifest.json`.
