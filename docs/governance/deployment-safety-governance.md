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
- Rollback must use `production-rollback.mjs`, require an explicit environment, require an approved prior Worker version id, and run rollback lineage validation before invoking Wrangler.
- `config/runtime/deployment-lineage-manifest.json` owns rollback manifests, deployment wrappers, queue gates, migration compatibility policy, and outbox rollback compatibility.
- Rollback manifests are governance contracts only. They do not certify that a live rollback succeeded.

## Validation

- `tests/operations/deployment-safety.test.mjs`
- `tests/operations/runtime-governance.test.mjs`
- `scripts/validators/deployment-safety-validator.mjs`
- `scripts/validators/rollback-integrity-validator.mjs`
- `scripts/validators/deployment-lineage-validator.mjs`
- `scripts/validators/topology-drift-validator.mjs`
- `scripts/validators/runtime-topology-validator.mjs`
- `scripts/validators/env-isolation-validator.mjs`
- `scripts/validators/cloudflare-environment-validator.mjs`
- `scripts/validators/supply-chain-validator.mjs`
- `scripts/validators/ci-simulation-validator.mjs`
- `.github/workflows/production-rollout.yml`
- `.github/workflows/live-production-certification.yml`
