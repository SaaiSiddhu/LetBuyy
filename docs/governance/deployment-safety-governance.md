# Deployment Safety Governance

Deployment safety requires explicit environments, fail-closed wrappers, staged promotion, health gates, and rollback evidence.

## Promotion Path

```text
local -> dev -> staging -> canary -> production
```

## Rules

- Worker deploys must use `deploy-worker-runtime.mjs` with `--env dev`, `--env staging`, or `--env production`.
- Direct package-level `wrangler deploy` scripts are forbidden.
- Governed scripts, workflows, and deployment plans must not use legacy npm-family execution commands; use pnpm and checked-in wrappers.
- Production rollout workflows must run governance, dependency, TypeScript, migration, Cloudflare, security, test, and typecheck gates before execute mode.
- Canary and production promotion require live health evidence and rollback plans.

## Validation

- `tests/operations/deployment-safety.test.mjs`
- `tests/operations/runtime-governance.test.mjs`
- `scripts/validators/deployment-safety-validator.mjs`
- `scripts/validators/runtime-topology-validator.mjs`
- `scripts/validators/env-isolation-validator.mjs`
- `scripts/validators/cloudflare-environment-validator.mjs`
- `scripts/validators/supply-chain-validator.mjs`
- `scripts/validators/ci-simulation-validator.mjs`
- `.github/workflows/production-rollout.yml`
- `.github/workflows/live-production-certification.yml`
