# Environment Lifecycle Governance

Environment lifecycle authority lives in `config/runtime/environment-lifecycle.json`.

## Required Environments

- `local`: isolated developer stack with mock and sandbox providers.
- `development`: unstable integration environment for experimentation and telemetry validation.
- `staging`: production topology mirror with isolated secrets, data, queues, telemetry, and providers.
- `production`: live customer environment, credential-gated and evidence-certified only after execute-mode runs.

## Isolation Law

Every environment must have separate secrets, databases, queues, event stores, replay checkpoints, telemetry backends, feature flag stores, provider accounts, deployment credentials, and certification evidence.

## Promotion Law

Promotion must follow local to development to staging to production. Staging must validate migration rehearsal, rollback, replay, queues, load, failover, chaos, security, and observability before production rollout.
