# Live Certification Execute Runbook

Use this runbook only from a protected operator shell or GitHub Actions environment with production approval.

## Required Inputs

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `TF_VAR_cloudflare_account_id`
- `TF_VAR_cloudflare_api_token`
- `SUPABASE_DB_URL` or `DATABASE_URL`
- `PROMETHEUS_URL`
- `GRAFANA_URL`
- `OTEL_COLLECTOR_HEALTH_URL`
- `LETBUYY_OPERATIONS_TOKEN`
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `ROTATE_SECRET_*` values listed in `infrastructure/scripts/security/rotate-secrets.mjs`

## Execute

```bash
node infrastructure/scripts/operations/phase4-live-certify.mjs \
  --environment=production \
  --mode=execute \
  --report-output=phase4-live-certification-report.json
```

## Acceptance

- Command exits `0`.
- `phase4-live-certification-report.json` has `live_certified: true`.
- `/v1/operations/runtime/certification-reports` contains the generated `certification_id`.
- The certification `expires_at` is in the future.

## Failure Handling

- Do not change `certificationMode` to `live-certified`.
- Open or update an incident if provider mutation started.
- Run `docs/runbooks/deployment-rollback.md` when Worker deployment, queue routing, or app promotion partially executed.
