# Staging Environment Operationalization Report

## Runtime Topology

- API Worker: `letbuyy-api-staging`
- API route: `api.staging.letbuyy.store`
- Webhook Worker: `letbuyy-webhook-staging`
- Webhook route: `webhooks.staging.letbuyy.store`
- Queue Worker: `letbuyy-queue-workers-staging`
- Runtime root: `services/api-gateway`
- Worker entrypoint: `services/api-gateway/src/index.ts`
- Wrangler config: `services/api-gateway/wrangler.toml`

## Queue Isolation

- Producers: `letbuyy-events-staging`, `letbuyy-analytics-queue-staging`, `letbuyy-search-queue-staging`, `letbuyy-notifications-queue-staging`
- Consumers: `letbuyy-queue-workers-staging`
- DLQ: `letbuyy-dead-letters-staging`
- Terraform source: `infrastructure/cloudflare/queues.tf`
- Validation source: `infrastructure/scripts/cloudflare/verify-provider-contracts.mjs`

## Storage Isolation

- KV namespace: `letbuyy-runtime-cache-staging`
- R2 bucket: `letbuyy-media-staging`
- Terraform source: `infrastructure/cloudflare/storage.tf`
- Staging KV binding: `CACHE`
- Staging R2 binding: `R2_BUCKET`

## Telemetry Isolation

- `ENVIRONMENT=staging`
- `APP_ENV=staging`
- `NODE_ENV=production`
- `DEPLOYMENT_ENV=staging`
- `TELEMETRY_ENV=staging`

## Deployment Lifecycle

1. Static validation: `pnpm run validate:lifecycle`, `pnpm run validate:governance`, `pnpm run typecheck`
2. Staging primitives: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=staging --target=cloudflare --execute`
3. Staging Workers: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=staging --target=workers --execute`
4. Staging validation: `node infrastructure/scripts/operations/phase4-ultimate-validate.mjs --environment=staging`
5. Production canary/blue-green: `node infrastructure/scripts/deploy/production-deploy.mjs --environment=production --target=all --execute`

## Certification Lifecycle

- Staging certification is non-production evidence only.
- Staging plan: `node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=staging --mode=plan`
- Staging execute: `node infrastructure/scripts/operations/phase4-live-certify.mjs --environment=staging --mode=execute`
- Production certification remains credential-gated and separate from staging evidence.

## Rollback Lifecycle

- Staging API rollback: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=staging --worker=letbuyy-api-staging`
- Staging queue rollback: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=staging --worker=letbuyy-queue-workers-staging`
- Staging webhook rollback: `node infrastructure/scripts/deploy/production-rollback.mjs --environment=staging --worker=letbuyy-webhook-staging`

## Governance Enforcement

- Staging environment presence is enforced by `scripts/validators/production-readiness-validator.mjs`.
- Lifecycle mapping is enforced by `scripts/validators/operational-lifecycle-validator.mjs`.
- Cloudflare provider contracts validate staging queue, route, KV, R2, and Worker script isolation.
