# Production Runtime Governance

LetBuyy production runtime authority is split across Vercel web apps, Cloudflare Workers, Cloudflare Queues, Supabase Postgres, Upstash Redis, Cloudflare KV/R2, and the Kubernetes-hosted observability/operations stack.

## Rules

- Runtime source remains under `apps/*`, `services/*`, and `packages/*`; deployment infrastructure remains under `infrastructure/*`.
- Every production runtime must appear in `config/runtime/production-topology.json`.
- Every runtime manifest must declare Phase 4 ownership fields for production, deployment, deployment pipeline, observability infrastructure, telemetry infrastructure, operational dashboards, queue provider, event store, replay operations, failover, incident, security, chaos, load testing, control-plane, SRE, and regional routing ownership.
- Production commands must enter through `/v1/operations/runtime/*` and must create `runtime_control_commands` or the relevant operational record.
- Production readiness is false if governance validation, production-readiness validation, runtime manifests, queue bindings, observability config, runbooks, or deployment topology are missing.

## Source Of Truth

- Runtime manifests: `**/runtime.manifest.json`
- Production topology: `config/runtime/production-topology.json`
- Deployment topology: `config/runtime/deployment-topology.json`
- Operational persistence: `database/supabase/migrations/059_*` through `063_*`
- Production validator: `scripts/validators/production-readiness-validator.mjs`

## Phase 4.Final Completion

- Deployment execution is owned by `.github/workflows/production-rollout.yml` and `infrastructure/scripts/deploy/production-deploy.mjs`.
- Production operational projections are persisted in migrations `062` and `063` and exposed through `/v1/operations/runtime/*`.
- Platform Console and Grafana dashboards may only render live operations API or telemetry projection data.
- Security evidence, SRE budgets, deployment health gates, event-store integrity checks, and regional overrides are mandatory production evidence.
