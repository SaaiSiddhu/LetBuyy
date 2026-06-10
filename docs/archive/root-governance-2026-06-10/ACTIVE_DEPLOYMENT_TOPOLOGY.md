# ACTIVE_DEPLOYMENT_TOPOLOGY

Generated: 2026-06-09T19:21:18Z  
Branch: `stepup/main`  
Baseline commit: `41b6ea49c5da30a1409d4cc587d989d459288e45`  
Sources: `.github/workflows/*`, `services/*/wrangler.toml`, `apps/*/vercel.json`, `config/runtime/deployment-topology.json`, `config/runtime/production-topology.json`.

## Summary

The deploy topology is materially broader than the V2 dormant/quarantine intent:

- Production workflow deploys four Cloudflare Workers: `api-gateway`, `webhook-service`, `queue-workers`, and `mobile-bff`.
- Production workflow deploys nine Next apps: `marketing-site`, `identity-platform`, `merchant-control-plane`, `storefront-runtime`, `theme-marketplace`, `app-marketplace`, `developer-portal`, `platform-console`, and `platform-operations-portal`.
- Staging workflow deploys four Cloudflare Workers and eight Next apps; `developer-portal` is missing from the staging app matrix in `deploy-staging.yml`.
- `config/runtime/deployment-topology.json` still lists reserved services (`event-bus`, `analytics-pipeline`, `checkout-runtime`, `media-service`, `notification-service`, `search-service`) as topology nodes with platform `reserved`.
- `config/runtime/production-topology.json` still describes reserved services as production runtimes through deployment manifests, even though the active GitHub deployment workflows do not deploy them as Workers.

## GitHub Workflow Deployment Surfaces

| Workflow | Trigger | Actual deploy/apply actions | Phase A note |
|---|---|---|---|
| `.github/workflows/ci.yml` | PR/push | Typecheck, lint, tests, governance, mobile Flutter debug builds, filtered Turbo build. | CI only. |
| `.github/workflows/deploy-staging.yml` | Staging deploy | Builds/deploys `api-gateway`, `webhook-service`, `queue-workers`; deploys eight Vercel apps when Vercel creds exist; smoke tests staging URLs. | Missing `mobile-bff` in this older staging workflow worker build/deploy; missing `developer-portal` in app matrix. |
| `.github/workflows/staging-deploy.yml` | Staging deploy | Runs staging DB push, builds/deploys `api-gateway`, `webhook-service`, `queue-workers`, `mobile-bff`. | Contains secret-put operations and staging deploys; Codex must not execute. |
| `.github/workflows/production-deploy.yml` | Production deploy | Generates production DB diff, runs staging E2E, pushes production migrations, deploys four Workers, deploys nine Vercel apps, smoke-tests production. | Production action path exists; V2 requires Codex to treat as human-only `SKIP-DEPLOY`. |
| `.github/workflows/production-rollout.yml` | Manual rollout | Runs broad governance/certification gates, dry-run deploy, optional execute deploy via `production-deploy.mjs --execute`. | Human-only production/shared-env path. |
| `.github/workflows/live-production-certification.yml` | Manual certification | Runs provider production certification with production/staging secrets. | Human-only live evidence path. |
| `.github/workflows/environment-lifecycle.yml` | Lifecycle/staging | Optional `bootstrap-staging.mjs --execute`, staging seed, staging E2E. | Shared-env action; Codex must not execute. |
| `.github/workflows/staging-runtime-deployment.yml` | Staging runtime | Runs validation and deployment scripts against staging. | Shared-env action; Codex must not execute. |
| `.github/workflows/architecture-governance.yml` | Governance | Governance validation. | No deploy. |
| `.github/workflows/hot-table-partition-maintenance.yml` | Maintenance | Hot-table partition maintenance. | Shared DB action; Codex must not execute. |

## Cloudflare Worker Deploy Targets

| Runtime | Config | Worker names/routes | Notes |
|---|---|---|---|
| API Gateway | `services/api-gateway/wrangler.toml` | staging `letbuyy-api-staging` on `api-staging.letbuyy.store` and `api.staging.letbuyy.store`; production `letbuyy-api` on `api.letbuyy.store`. | Produces event/search/notification/runtime queues; production Liquid/extensions false; AI/WhatsApp live modes still use `SKIP_NEEDS_HUMAN` sentinels. |
| Webhook Service | `services/webhook-service/wrangler.toml` | staging `letbuyy-webhook-staging`; production `letbuyy-webhook` on `webhooks.letbuyy.store`. | Service-bound to API gateway. |
| Queue Workers | `services/queue-workers/wrangler.toml` | staging/production queue consumer worker; cron every 6 hours. | Uses dry-run push vars with `SKIP_NEEDS_HUMAN` sentinels. |
| Mobile BFF | `services/mobile-bff/wrangler.toml` | staging `letbuyy-mobile-bff-staging`; production `letbuyy-mobile-bff` on `bff.letbuyy.com`. | Internal secret expected as Worker secret, not plaintext var. |

## Vercel App Deploy Targets

| App | Local `vercel.json` | Production workflow deploys | Staging workflow deploys |
|---|---:|---:|---:|
| `apps/marketing-site` | yes | yes | yes |
| `apps/identity-platform` | yes | yes | yes |
| `apps/merchant-control-plane` | yes | yes | yes |
| `apps/storefront-runtime` | yes | yes | yes |
| `apps/theme-marketplace` | yes | yes | yes |
| `apps/app-marketplace` | yes | yes | yes |
| `apps/developer-portal` | no | yes | no in `deploy-staging.yml` |
| `apps/platform-console` | yes | yes | yes |
| `apps/platform-operations-portal` | yes | yes | yes |

All Vercel configs found use `framework: nextjs`, `regions: ["bom1"]`, `outputDirectory: ".next"`, and `pnpm install --frozen-lockfile`.

## Reserved Topology Nodes

`config/runtime/deployment-topology.json` contains reserved-service nodes for:

- `services/event-bus`
- `services/analytics-pipeline`
- `services/checkout-runtime`
- `services/media-service`
- `services/notification-service`
- `services/search-service`

These are not direct Worker deploy targets in the active staging/production GitHub deploy jobs, but they remain topology authority inputs and validator references. Quarantine must therefore update manifests/topology/tests with proof, not just move folders.

## Production Safety Finding

The repository contains production migration, secret-setting, Worker deploy, Vercel deploy, smoke-test, and certification workflows. Under V2, Codex must not run these. Any shared/staging/prod apply remains a human `SKIP-DEPLOY` runbook.
