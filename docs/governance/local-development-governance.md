# Local Development Governance

The local lifecycle is developer-isolated and resettable. It must not use production providers, secrets, or data.

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

- Bootstrap: `npm run local:bootstrap`.
- Start: `npm run local:up`.
- Seed: `npm run local:seed`.
- Health: `npm run local:health`.
- Reset: `npm run local:reset`.

Local health evidence is useful for developer readiness only. It is never production certification.
