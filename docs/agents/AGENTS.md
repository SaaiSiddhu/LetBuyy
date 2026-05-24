# LetBuyy Agent Operating Index

This directory is the long-term operational memory layer for LetBuyy agents. It complements the root `AGENTS.md`, which remains the central constitution for the repository.

Last source-derived analysis: 2026-05-24.

## Mandatory Reading Order

1. Root `AGENTS.md`.
2. `memory/lessons.md`.
3. `tasks/todo.md`.
4. This directory entry point.
5. The focused rule file and subagent file for the domain being changed.
6. The actual source files, migrations, route handlers, schemas, and tests involved in the task.

Do not implement from documentation alone. Documentation is operational memory; source code is the authority.

## Current Repository Facts

- LetBuyy is a multi-tenant commerce and site-builder monorepo targeting Shopify-class architecture.
- The database tenant root is `sites`; user-facing product language uses `store`.
- The canonical backend gateway is the Cloudflare Hono worker under `backend/workers/api` with `/v1` routes.
- The public web surfaces are split across accounts, admin, storefront, landing, app-store, theme-marketplace, console, and team Next apps.
- Native builder and admin surfaces live under `apps/flutter/*` and share Dart packages under `packages/dart/*`.
- Current scan found 1,407 first-party source/config/docs files, 15 package manifests, 58 Supabase migrations, 118 Next API route handlers, and 30 Hono route modules.
- Business-critical testing is thin: only 3 detected test files, all Flutter widget tests.

## Agent System Purpose

The files in this directory preserve:

- Architecture boundaries and current runtime flows.
- Domain ownership and tenant isolation rules.
- Known anti-patterns, drift, and operational risk.
- Migration, security, performance, frontend, backend, infra, event, and documentation rules.
- Specialized subagent briefs for recurring engineering roles.

## Use Policy

- When a task touches a specific domain, read the matching `subagents/*.md` file before editing.
- When a task crosses multiple domains, read all matching subagent briefs and prefer the narrowest safe change.
- When current code conflicts with these docs, inspect source, update the docs if the source is the accepted reality, and avoid silently creating a parallel architecture.
- When significant routes, migrations, auth flows, infrastructure, or package boundaries change, regenerate repository intelligence and update this directory.

## Intelligence Reports

- `architecture-governance.md`: current architecture, intended architecture, gap analysis, and system risks.
- `repository-map.md`: roots, applications, packages, workers, migrations, infrastructure, docs, and tests.
- `dependency-graph.md`: dependency direction, runtime graph, and forbidden coupling.
- `domain-boundaries.md`: domain ownership and integration contracts.
- `anti-patterns.md`: duplicated logic, dead code, coupling, build risk, state chaos, API drift, and testing gaps.
- `runtime-flow.md`: auth, admin, storefront, checkout, theme, app marketplace, webhook, event, and mobile flows.
- `platform-memory.md`: durable source-derived memory and risk register.

## Rule Files

The remaining `*-rules.md` files are governing constraints. They should be treated as operational policy for future work, not aspirational suggestions.
