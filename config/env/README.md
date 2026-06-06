# LetBuyy Environment Configuration

This directory is the source of truth for environment variable ownership, runtime boundaries, schemas, and staging/production templates.

## Directory Contract

- `environment-governance.md`: operational rules for env ownership, secrets, promotion, and CI/CD handling.
- `staging-production-secret-matrix.json`: canonical staging/production secret ownership matrix.
- `templates/`: safe placeholder templates. These files must never contain real values.
- `schemas/`: machine-readable runtime env contracts used by governance and future validation tooling.

## Non-Negotiable Rules

- Runtime env files such as `.env`, `.env.local`, `.dev.vars`, and `all.env` must remain untracked and must not be used as supported configuration.
- Staging and production are the only deployment targets and the only supported execution environments.
- `NEXT_PUBLIC_*` variables are public browser configuration only. They must never contain secrets, provider private keys, service-role keys, webhook secrets, or internal API secrets.
- Server secrets are owned by their deployment runtime: Vercel project env for Next apps, Cloudflare Worker secrets/bindings for Workers, and CI secret stores for automation.
- Templates use placeholders only. Copy variable names from templates into the correct platform secret store; do not copy real secrets back into the repository.
- Active runtime source must not silently default production-facing behavior to staging hosts or retired LetBuyy `.com` domains. Use env values from this directory, canonical `.store` public defaults for navigation, or fail-loud server behavior.
