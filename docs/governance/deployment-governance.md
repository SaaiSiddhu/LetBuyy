# Deployment Governance

Production deployment uses environment promotion, health gates, and rollback ownership rather than direct ad hoc deploys.

## Environments

- `dev`: preview execution, local secrets, no production data.
- `staging`: production-like secrets, canary validation, migration dry runs.
- `production`: signed release tags, blue/green or provider-native rollback, mandatory health gates.

## Release Gates

- `node scripts/validate-governance.mjs`
- `node scripts/validators/production-readiness-validator.mjs`
- Runtime typecheck for changed packages/services/apps.
- Supabase migration dry run against staging.
- Worker health, storefront health, queue lag, and error-budget checks.

## Rollback

- Cloudflare Workers: use Wrangler deployment rollback to the previous healthy version.
- Vercel apps: promote the last healthy deployment.
- Database: prefer forward-fix migrations; destructive rollback needs SRE and data-owner approval.
- Queues: pause consumers before redrive if poison-message rate is rising.
