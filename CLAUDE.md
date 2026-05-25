# LetBuyy AI Operating Context

`AGENTS.md` is the canonical engineering constitution for this repository. Claude, Codex, humans, and other automation must follow `AGENTS.md` first, then the relevant local `AGENTS.md`, then `docs/governance/`.

## Canonical Runtime Map

- `apps/storefront-runtime`
- `apps/merchant-control-plane`
- `apps/identity-platform`
- `apps/app-marketplace`
- `apps/theme-marketplace`
- `apps/marketing-site`
- `apps/platform-console`
- `apps/platform-operations-portal`
- `apps/mobile/shopper-app`
- `apps/mobile/merchant-app`
- `apps/mobile/operator-app`
- `services/api-gateway`
- `services/webhook-service`

Reserved service roots are governed in `docs/governance/runtime-boundaries.md`.

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
