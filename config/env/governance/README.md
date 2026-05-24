# Environment Governance Operations

This directory owns process rules for LetBuyy environment management. It is not a secret store and must never contain runtime values.

## Rules

- Runtime-local `.env`, `.env.local`, `.dev.vars`, and `all.env` files are ignored local state only.
- Templates under `config/env/templates/` may include variable names and placeholder values only.
- Schemas under `config/env/schemas/` define runtime class requirements for Next apps, Cloudflare Workers, and Flutter/mobile builds.
- Ownership data under `config/env/ownership/` maps each runtime class to its secret store and validation owner.
- CI must scan tracked files for env file leakage and secret-like values without printing secret contents.

## Runtime Classes

- `next-app`: Vercel project environment. Public browser variables must use `NEXT_PUBLIC_*` and must not contain secrets.
- `worker`: Cloudflare Worker secrets and bindings. `.dev.vars` remains local-only.
- `mobile`: CI/app-store dart-define or platform secret injection. Mobile builds must never embed provider secret keys.

## Change Process

1. Add or rename variables in the matching schema.
2. Update the matching template with placeholders only.
3. Update `runtime-env-ownership.json` when ownership or secret-store authority changes.
4. Update runtime docs and manifests when a runtime changes environment class.
5. Run `node scripts/validate-governance.mjs`.
