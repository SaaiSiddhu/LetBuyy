# Staging Development Governance

LetBuyy development and integration proof run against staging. Retired non-deployed stacks, emulator suites, and development Worker environments are not supported.

## Staging Contract

- Staging is the development and test environment.
- Production is live merchant traffic only.
- Secrets live in Vercel, Cloudflare, GitHub Environments, Supabase, and provider stores.
- Repository files may document variable names and placeholders only.
- Staging proof is human-gated until staging secrets and deployments are configured.

## Required Flow

1. Run static checks without a stack: typecheck, lint, build, tests that do not require providers, and governance validation.
2. Deploy the branch to a staging or PR preview target.
3. Seed staging with `scripts/staging/seed.mjs` using explicit staging database credentials from the operator shell or CI secret store.
4. Run Playwright J1-J5 and any integration proof against staging URLs.
5. Record unavailable live staging proof as `[SKIP — NEEDS HUMAN: staging deploy + secrets]`.

Staging health evidence is release readiness evidence. It replaces the retired local lifecycle.
