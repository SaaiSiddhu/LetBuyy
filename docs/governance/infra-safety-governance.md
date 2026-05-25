# Infrastructure Safety Governance

Infrastructure changes must be declarative, environment-scoped, drift-detectable, and reversible through documented operator procedures.

## Rules

- Cloudflare Worker configs must define isolated `dev`, `staging`, and `production` environments.
- Cloudflare Wrangler bindings and vars are non-inheritable; each governed environment must define its own vars, queues, KV, R2, telemetry, and any Durable Object or service binding ownership explicitly.
- Local Worker bindings must not point at production queues, KV namespaces, R2 buckets, routes, or telemetry.
- Worker deployment must require an explicit governed `--env`.
- Secrets live in provider secret stores, GitHub environments, or operator shells, never in source files.
- Terraform/provider plans are evidence contracts until execute-mode credentials are supplied.

## Validation

- `scripts/validators/cloudflare-environment-validator.mjs`
- `scripts/validators/cloudflare-binding-validator.mjs`
- `config/runtime/cloudflare-binding-ownership.json`
- `scripts/validators/environment-validator.mjs`
- `scripts/validators/env-isolation-validator.mjs`
- `scripts/validators/runtime-topology-validator.mjs`
- `infrastructure/scripts/deploy/deploy-worker-runtime.mjs`
- GitHub environment approvals for execute-mode deployment workflows
