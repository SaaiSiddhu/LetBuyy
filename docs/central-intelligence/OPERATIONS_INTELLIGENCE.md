# LCIS v2 — Operations Intelligence (Phase 9)

Operational topology from the workflows, wrangler configs, and runbooks present in the repo. (No live incident feed exists in-repo — this maps the deploy/rollback/runbook surface, honestly.)

## Deploy graph
```
push → ci.yml (validate) → production-deploy.yml:
  migrate-production (db push --include-all, gated)
  → deploy-workers-production (api-gateway, queue-workers, webhook, mobile-bff + 19 secrets)
  → deploy-apps (Vercel: 5 Next apps)
```
Gates: `branch-lag-guard` job · `LETBUYY_ENFORCE_BRANCH_LAG` · migrate-before-deploy ordering.

## Rollback graph
`infrastructure/scripts/deploy/production-rollback.mjs` — requires `--worker`, `--version-id` (approved prior version), `--reason`; validates queues, fail-closed corruption policy (`rollback-integrity-validator`). Migrations are forward-compatible / forward-fix-only.

## Scheduled / async ops
- `queue-workers` consumes 7 queues (email, notifications, async jobs); crons per wrangler `[triggers]`.
- `hot-table-partition-maintenance.yml` — partition lifecycle.
- `branch-lag-monitor.yml` — drift alerting.
- `live-production-certification.yml` — production certification.

## Runbooks
`docs/runbooks/`, `MERGE_RUNBOOK.md`, `docs/governance/deployment-readiness-governance.md`.

## Incident surface
Incident RPCs exist (`update_production_incident_status`, `record_*`) and `services/queue-workers/src/incident-command.ts` — the data model for incidents is present; operational dashboards are external.

## Use it
"What deploys X / how do I roll back / what's the deploy gate?" → this map + `pnpm graph:intel infra`, no repo scan.
