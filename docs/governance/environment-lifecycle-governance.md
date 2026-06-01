# Environment Lifecycle Governance

Environment lifecycle authority lives in `config/runtime/environment-lifecycle.json`.

## Required Environments

- `local`: isolated developer stack with mock and sandbox providers. It is not a deployment target.
- `development`: unstable integration environment for experimentation and telemetry validation. Cloudflare uses the concrete Wrangler environment name `dev`; it is not a release target.
- `staging`: production topology mirror with isolated secrets, data, queues, telemetry, and providers.
- `production`: live customer environment, credential-gated and evidence-certified only after execute-mode runs.

Staging and production are the only deployment targets for launch readiness. Local and development are retained for governed safety, but local must be staging-shaped rather than a separate product behavior: same variable names, `/v1` API shape, binding names, and provider-mode semantics, with separate sandbox resources.

## Isolation Law

Every environment must have separate secrets, databases, queues, event stores, replay checkpoints, telemetry backends, feature flag stores, provider accounts, deployment credentials, and certification evidence.

Local execution must not reuse staging data or staging service-role credentials by default. Any operator command that targets staging from a developer machine must be explicit, credential-gated, and recorded as staging evidence, not local evidence.

The Cloudflare development environment must not reuse staging or production resources. Its API Worker is `letbuyy-api-dev`, its API route is `api-dev.letbuyy.store`, its queue namespace uses the `-dev` suffix, its DLQ is `letbuyy-dead-letters-dev`, its KV namespace is `letbuyy-runtime-cache-dev`, and its R2 bucket is `letbuyy-dev-storage`.

## Promotion Law

Promotion must follow local to development (`dev`) to staging to production. Development validates isolated Cloudflare Worker deployment, queues, storage, telemetry labels, and rollback before staging receives a build. Staging must validate migration rehearsal, rollback, replay, queues, load, failover, chaos, security, and observability before production rollout.
