# Documentation Rules

## Source-Derived Documentation

- Architecture docs must be based on current source, not desired future state.
- Mark status clearly: built, partial, planned, missing, deprecated, or historical.
- Do not document secret values.
- Do not describe scaffolds as production-ready.

## Required Documentation Updates

Update repository memory when changing:

- Route surfaces or API contracts.
- Migrations, RLS policies, or tenant ownership paths.
- Auth/session flow.
- Payment, checkout, webhook, inventory, order, refund, return, or subscription logic.
- Theme schemas, renderer keys, draft/release workflow, or storefront composition.
- App marketplace install/integration contracts.
- Infrastructure, DNS, worker bindings, CI/CD, or deployment topology.
- Package boundaries or shared contracts.

## Agent Documentation

- Keep root `AGENTS.md` as the central constitution.
- Keep `docs/agents` as the operational handbook.
- Keep subagent briefs focused on domain-specific responsibilities and constraints.
- Regenerate generated intelligence after significant architecture changes.

## Verification

Docs-only changes should verify expected files exist and contain meaningful content. Do not run unrelated builds for pure documentation updates unless requested.
