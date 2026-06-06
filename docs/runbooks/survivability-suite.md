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

## Local Operational Proof

When provider credentials or load tools are unavailable, run the plan-only proof surfaces:

```bash
pnpm run load:plan
pnpm run chaos:plan
pnpm run survivability:plan
```

These commands print executable plans and validate contracts. They do not record evidence and do not claim production or internet-scale certification.

## Load and Chaos Proof Surfaces

Operator-facing load scenarios live under `load/`; chaos experiments live under `chaos/`.

```bash
pnpm run load:plan
pnpm run chaos:plan
```

Execute mode is fail-closed. Load execution requires `LETBUYY_API_BASE_URL`, `LETBUYY_OPERATIONS_TOKEN`, and the real k6, Locust, and Gatling tools. Chaos execution requires `LETBUYY_CHAOS_EXECUTION_APPROVED=true`, `LETBUYY_OPERATIONS_TOKEN`, and `LETBUYY_API_BASE_URL`. Production execution also requires `LETBUYY_SURVIVABILITY_EXECUTION_APPROVED=true`.

Reports are written under ignored `load/reports/` and `chaos/reports/`. These reports are evidence inputs only; production certification still requires fresh operations control-plane records and survivability gates.
