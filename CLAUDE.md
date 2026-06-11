# LetBuyy AI Operating Context

`GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md` is supreme law for this repository. Claude, Codex, humans, and other automation must follow the Constitution first, then root `AGENTS.md` (the promoted `LETBUYY_AGENTS_V2` operating rulebook), then the relevant local `AGENTS.md`, then the canonical governance rewrite documents.

## Canonical Runtime Map

- `apps/storefront-runtime`
- `apps/merchant-control-plane`
- `apps/identity-platform`
- `apps/marketing-site`
- `apps/platform-console`
- `apps/mobile/merchant-app`
- `services/api-gateway`
- `services/mobile-bff`
- `services/webhook-service`
- `services/queue-workers`
- `apps/mobile/shopper-app` (reserved, not implemented)
- `apps/mobile/operator-app` (reserved, not implemented)
- `services/checkout-runtime` (reserved, not implemented)
- `services/search-service` (reserved, not implemented)
- `services/media-service` (reserved, not implemented)
- `services/notification-service` (reserved, not implemented)
- `services/event-bus` (reserved, not implemented)
- `services/analytics-pipeline` (reserved, not implemented)

`apps/app-marketplace`, `apps/developer-portal`, `apps/theme-marketplace`, and `apps/platform-operations-portal` are frozen or pending consolidation, not production deploy targets. Reserved service and mobile roots are manifest-only placeholders. Their current active capability owners are implemented web/service runtimes until a human-approved scope adds real source, tests, and deployment config.

## Deprecated Runtime Policy

Do not recreate or reference deprecated app aliases as active topology:

- `apps/admin`
- `apps/auth`
- `apps/checkout`
- `apps/internal`
- `apps/merchant`
- `apps/storefront`
- `apps/analytics`
- `apps/mobile/operator-team-app`
- `apps/storefront-runtime/consumer-storefront`

Historical references may remain only under `docs/archive/`.

## Required Validation

Run `node scripts/validate-governance.mjs` after topology, import, package, environment, generated artifact, or governance-memory changes.
