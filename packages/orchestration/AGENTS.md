# Orchestration Package Governance

Purpose: Event bus, workflow engine, command pipeline, domain-event, async execution, saga, retry, and event contract foundation.

## Ownership Rules

- Own provider-neutral workflow primitives, command metadata, correlation IDs, retry policy contracts, replay rules, and event envelope contracts.
- Keep domain business rules in domain packages and application sequencing in `packages/application-services`.
- Keep transport bindings, queue SDKs, worker handlers, and provider clients out of this package.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, or provider SDKs.

## Runtime Authority

- This package does not deploy independently and does not own queues or workers.
- Service runtimes consume these primitives when handling queues, webhooks, API commands, and scheduled jobs.

## Migration Notes

- New async workflows require event IDs, correlation IDs, idempotency keys, retry policy, dead-letter policy, and replay classification.
