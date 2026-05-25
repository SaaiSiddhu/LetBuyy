# Infrastructure Recovery Governance

Infrastructure recovery covers drift detection, rollback-safe provisioning, secret rotation, and provider recovery without hidden mutation.

## Rules

- Terraform remains the source for Cloudflare queues, queue consumers, KV, and R2 topology.
- Plan mode must not mutate providers.
- Execute mode must run Terraform plan before apply and must fail closed when credentials are missing.
- Secret rotation requires per-secret replacement values and must never read secrets from tracked files.
- Recovery runbooks must record evidence through the operations control plane before certification can pass.

## Required Drills

- Queue redrive and DLQ recovery.
- Regional failover with replay verification.
- Cloudflare Worker rollback.
- Supabase verification SQL and point-in-time recovery rehearsal.
- Observability degradation and dashboard recovery.
