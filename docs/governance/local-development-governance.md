# Local Development Governance

The local lifecycle is developer-isolated and resettable. It is not a deployment target. It must not use staging or production providers, service-role credentials, secrets, or data by default.

Local execution must be staging-shaped: same env variable names, `/v1` API shape, worker binding names, and provider-mode semantics. The resources behind those names remain local or sandbox resources unless an operator explicitly runs a staging command.

## Stack

The canonical local stack is `infrastructure/local/docker-compose.yml` and includes:

- Postgres for local database and event store.
- Redis for cache and rate-limit simulation.
- ElasticMQ for queue emulation.
- Local replay runtime at `infrastructure/local/replay-runtime.mjs`.
- Flipt for local feature flags.
- WireMock for payment and SMS provider sandboxing.
- Mailpit for email sandboxing.
- OpenTelemetry Collector, Prometheus, Grafana, Loki, and Tempo for telemetry.

## Commands

- Bootstrap: `pnpm run local:bootstrap`.
- Start: `pnpm run local:up`.
- Seed: `pnpm run local:seed`.
- Health: `pnpm run local:health`.
- Reset: `pnpm run local:reset`.

Local health evidence is useful for developer readiness only. It is never production certification.
