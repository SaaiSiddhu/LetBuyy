# Dev Environment Operationalization Report

## Runtime Topology

- API Worker: `letbuyy-api-dev`
- API route: `api-dev.letbuyy.store`
- Webhook Worker: `letbuyy-webhooks-dev`
- Webhook route: `webhooks-dev.letbuyy.store`
- Queue Worker: `letbuyy-queue-workers-dev`
- Runtime root: `services/api-gateway`
- Worker entrypoint: `services/api-gateway/src/index.ts`
- Wrangler config: `services/api-gateway/wrangler.toml`

## Queue Isolation

- Producers: `letbuyy-events-dev`, `letbuyy-analytics-dev`, `letbuyy-search-indexing-dev`, `letbuyy-notifications-dev`
- Consumers: `letbuyy-queue-workers-dev`
- DLQ: `letbuyy-dead-letters-dev`
- Terraform source: `infrastructure/cloudflare/queues.tf`
- Validation source: `infrastructure/scripts/cloudflare/verify-provider-contracts.mjs`

## Storage Isolation

- KV namespace: `letbuyy-runtime-cache-dev`
- R2 bucket: `letbuyy-dev-storage`
- Terraform source: `infrastructure/cloudflare/storage.tf`
- Dev KV binding: `CACHE`
- Dev R2 binding: `R2_BUCKET`

## Telemetry Isolation

- `ENVIRONMENT=development`
- `APP_ENV=development`
- `NODE_ENV=development`
- `DEPLOYMENT_ENV=dev`
- `TELEMETRY_ENV=development`

## Deployment Lifecycle

1. Local test: `pnpm run validate:lifecycle`, `pnpm run validate:governance`, `pnpm run typecheck`
2. Dev primitives: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=cloudflare --execute`
3. Dev Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=dev --target=workers --execute`
4. Staging validation: `node infrastructure/scripts/operations/phase4-ultimate-validate.mjs --environment=staging`
5. Production canary/blue-green: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all --execute`

## Certification Lifecycle

- Dev certification is non-production evidence only.
- Dev plan: `node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=dev --mode=plan`
- Dev execute: `node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=dev --mode=execute`
- Production certification remains credential-gated and separate from dev evidence.

## Rollback Lifecycle

- Dev API rollback: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=dev --worker=letbuyy-api-dev`
- Dev queue rollback: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=dev --worker=letbuyy-queue-workers-dev`
- Dev webhook rollback: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=dev --worker=letbuyy-webhooks-dev`

## Governance Enforcement

- Dev environment presence is enforced by `scripts/validators/production-readiness-validator.mjs`.
- Lifecycle mapping from `development` to Wrangler `dev` is enforced by `scripts/validators/operational-lifecycle-validator.mjs`.
- Cloudflare provider contracts validate dev queue, route, KV, R2, and Worker script isolation.
