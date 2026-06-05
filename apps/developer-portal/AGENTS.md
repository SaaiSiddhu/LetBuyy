# Developer Portal AGENTS.md

Purpose: Developer portal for LetBuyy app, theme, OAuth, API, webhook, and dashboard documentation.

Actual source root: `apps/developer-portal`.

## Ownership

- Owns only developer-facing presentation, static documentation composition, and dashboard shell UI.
- Must not own backend behavior, contracts, database schema, shared UI, or marketplace workflows.
- Must document only real source-backed API, OAuth, webhook, app, and theme capabilities.
- Absent endpoint, SDK, CLI, or tooling must be marked `[SKIP — NEEDS BACKEND/SDK]`.

## Runtime Rules

- Consume service APIs through versioned `/v1` contracts; do not import service code.
- Use `@letbuyy/ui` primitives first. Missing shared UI components may be created in `src/components/_local-ui/` and must be marked `[CONSOLIDATE]`.
- Keep auth tokens out of `localStorage`; this portal may show examples but must not persist secrets.
- Do not add provider SDKs, Supabase service-role clients, or direct database access.
- Keep dashboard metrics as shell or API-backed state only. Do not invent live values.

## Source Truth

- API route truth may be read from `services/api-gateway/src/**`.
- App SDK and OAuth truth may be read from `packages/app-engine/**` and `services/api-gateway/src/routes/app-store.ts`.
- Theme SDK truth may be read from `packages/theme-engine/**` and `services/api-gateway/src/routes/themes.ts`.
- Webhook delivery truth may be read from `services/webhook-service/**`.

