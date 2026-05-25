# Deployment Governance

Production deployment uses environment promotion, health gates, and rollback ownership rather than direct ad hoc deploys.

## Environments

- `dev`: isolated Cloudflare development execution, provider-dev secrets, no staging or production data.
- `staging`: production-like secrets, canary validation, migration dry runs.
- `production`: signed release tags, blue/green or provider-native rollback, mandatory health gates.

## Release Gates

- `node scripts/validate-governance.mjs`
- `node scripts/validators/operational-lifecycle-validator.mjs`
- `node scripts/validators/production-readiness-validator.mjs`
- `node infrastructure/scripts/operations/phase4-ultimate-validate.mjs --environment=dev`
- `node infrastructure/scripts/operations/phase4-ultimate-validate.mjs --environment=production`
- `node infrastructure/scripts/cloudflare/verify-provider-contracts.mjs --environment=production`
- `node infrastructure/scripts/database/verify-supabase-operations.mjs --environment=production`
- `node infrastructure/scripts/observability/verify-observability-rollout.mjs --environment=production`
- `node infrastructure/scripts/security/verify-security-gates.mjs`
- `node infrastructure/scripts/deploy/verify-health-gates.mjs --environment=production --preflight`
- Runtime typecheck for changed packages/services/apps.
- Supabase migration dry run against staging.
- Worker health, storefront health, queue lag, and error-budget checks.
- Deployment health gate results must be persisted through `/v1/operations/runtime/deployment-health-gates`.
- Canary, blue/green, shadow traffic, and feature flag rollout gates must match `config/runtime/rollout-lifecycle.json`.

## Rollback

- Cloudflare Workers: use Wrangler deployment rollback to the previous healthy version.
- Vercel apps: promote the last healthy deployment.
- Database: prefer forward-fix migrations; destructive rollback needs SRE and data-owner approval.
- Queues: pause consumers before redrive if poison-message rate is rising.

## Execution

- Plan production Workers with `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=workers`.
- Plan development Workers with `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers`.
- Execute development Cloudflare primitives with `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=cloudflare --execute`.
- Execute development Workers with `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers --execute`.
- Plan the complete Phase 4 production gate with `npm run validate:production`.
- Execute only through GitHub environment approval or an equivalent audited operator shell with provider credentials.
- Cloudflare Worker rollback uses `node infrastructure/scripts/deploy/production-rollback.mjs`.
