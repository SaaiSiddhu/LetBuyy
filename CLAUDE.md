# LetBuyy AI Operating Context

`AGENTS.md` is the canonical engineering constitution for this repository. Claude, Codex, humans, and other automation must follow `AGENTS.md` first, then the relevant local `AGENTS.md`, then `docs/governance/`.

## Canonical Runtime Map

- `apps/storefront-runtime`
- `apps/merchant-control-plane`
- `apps/identity-platform`
- `apps/app-marketplace`
- `apps/developer-portal`
- `apps/theme-marketplace`
- `apps/marketing-site`
- `apps/platform-console`
- `apps/platform-operations-portal`
- `apps/mobile/merchant-app`
- `services/api-gateway`
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

Reserved service and mobile roots are manifest-only placeholders. Their current active capability owners are implemented web/service runtimes until a human-approved scope adds real source, tests, and deployment config.

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
