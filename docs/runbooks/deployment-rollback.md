# Deployment Rollback Runbook

Owner: release commander and platform SRE.

1. Stop promotion by recording a blocked deployment health gate.
2. For Workers, run `node infrastructure/scripts/deploy/production-rollback.mjs --environment=production --worker=<worker> --version-id=<version> --reason=<summary>`.
3. For web apps, promote the previous verified Vercel deployment from the provider console and record the promotion result through `POST /v1/operations/runtime/deployments`.
4. For database changes, prefer forward-fix. Only run reversible rollback after SRE and principal engineer approval.
5. Re-run `node infrastructure/scripts/deploy/verify-health-gates.mjs --environment=production`.
6. Close the rollback only when error budget burn returns below alert threshold.
