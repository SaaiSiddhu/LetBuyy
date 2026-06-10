# Environment Lifecycle Governance

Environment lifecycle authority lives in `config/runtime/environment-lifecycle.json`.

## Required Environments

- `staging`: development, integration testing, preview proof, migration rehearsal, rollback rehearsal, queue validation, security testing, and observability proof.
- `production`: live customer environment, credential-gated and evidence-certified only after execute-mode runs.

Staging and production are the only supported environments. Development aliases, emulator suites, and Cloudflare `dev` environments are retired.

## Isolation Law

Staging and production must have separate secrets, databases, queues, telemetry backends, feature flag stores, provider accounts, deployment credentials, and certification evidence.

Operator commands that target staging must be explicit, credential-gated, and recorded as staging evidence. Production mutation remains forbidden outside approved production rollout and certification workflows.

## Promotion Law

Promotion flows from staging to production. Staging must validate migration rehearsal, rollback, queues, security, deployment health, and observability before production rollout.
