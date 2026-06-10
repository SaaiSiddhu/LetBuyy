# Infrastructure Recovery Runbook

## Cloudflare Drift

1. Run governance and Cloudflare validators.
2. Run Terraform plan against `infrastructure/cloudflare`.
3. Compare queues, queue consumers, KV, and R2 names against `config/runtime/production-topology.json`.
4. Apply only after approval in execute mode.
5. Record drift and remediation evidence in the operations control plane.

## Worker Rollback

1. Identify the Worker and version from Cloudflare deployments.
2. Run `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=<worker> --version-id=<version>`.
3. Verify deployment health gates and queue drain state.
4. Record rollback evidence and incident timeline.

## Supabase Recovery

1. Run verification SQL in plan/preflight first.
2. For recovery drills, restore into an isolated environment.
3. Run RLS, migration, operational-dashboard, and deployment-health verification.
4. Promote only after the restored environment passes production readiness gates.
