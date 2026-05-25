# Infrastructure Safety Governance

Infrastructure changes must be declarative, environment-scoped, drift-detectable, and reversible through documented operator procedures.

## Rules

- Cloudflare Worker configs must define isolated `dev`, `staging`, and `production` environments.
- Local Worker bindings must not point at production queues, KV namespaces, R2 buckets, routes, or telemetry.
- Worker deployment must require an explicit governed `--env`.
- Secrets live in provider secret stores, GitHub environments, or operator shells, never in source files.
- Terraform/provider plans are evidence contracts until execute-mode credentials are supplied.

## Validation

- `scripts/validators/cloudflare-environment-validator.mjs`
- `scripts/validators/environment-validator.mjs`
- `infrastructure/scripts/deploy/deploy-worker-runtime.mjs`
- GitHub environment approvals for execute-mode deployment workflows
