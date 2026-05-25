# Enterprise Testing Governance

Testing authority starts with repository-enforced governance tests and grows into runtime, integration, chaos, and live execute-mode tests.

## Required Repository Tests

- Dependency declaration and package export governance.
- TypeScript composite/reference governance.
- Cloudflare environment isolation governance.
- Migration destructive-operation safety.
- Replay determinism proof for critical projection behavior.
- Deployment wrapper fail-closed behavior.
- CI workflow and release-promotion gate simulation.
- Queue recovery and dead-letter behavior.
- Feature flag deterministic rollout behavior.
- Event contract coverage for replay, deployment, SRE, chaos, and operational recovery.
- Execute-mode certification fail-closed behavior.
- Chaos degraded-mode behavior for provider outage.
- Survivability evidence contracts, execute-mode approval, and non-fake live drill evidence behavior.

## Required Runtime Evolution

- Domain unit tests for commerce, checkout, auth, tenant, billing, and event packages.
- Worker integration tests for Hono routes, queues, idempotency, auth enforcement, and webhooks.
- End-to-end tests for auth, cart, checkout, payment, customer account, merchant operations, and rollback flows.
- Chaos tests for provider outage, queue poison messages, replay corruption, cache outage, and regional failure.

Repository tests are not a substitute for live execute-mode certification. They are the minimum hard gate before provider-backed validation.
