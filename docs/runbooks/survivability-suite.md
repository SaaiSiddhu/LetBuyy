# Survivability Suite Runbook

Use this runbook to validate repository readiness without claiming live certification.

## Plan Mode

```bash
node infrastructure/scripts/operations/run-survivability-suite.mjs --environment=production --mode=plan
```

Plan mode validates governance, production topology, security, migrations, replay, Cloudflare isolation, observability, chaos tests, CI simulation, and certification planning. It does not mutate providers.

## Execute Mode

Execute mode requires real credentials, live tools, an operations API token, and explicit approval:

```bash
LETBUYY_SURVIVABILITY_EXECUTION_APPROVED=true \
node infrastructure/scripts/operations/run-survivability-suite.mjs --environment=production --mode=execute
```

Do not set the approval flag unless the incident commander, release owner, and SRE owner have approved the execution window.

## Certification Rule

Fresh operations records are necessary but not sufficient. Certification only passes when required evidence has a passing operational status such as `passed`, `healthy`, `success`, `succeeded`, or `closed`.
