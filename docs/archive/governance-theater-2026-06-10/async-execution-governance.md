# Async Execution Governance

LetBuyy async execution is package-governed and service-executed.

## Authority

- `packages/application-services` declares async workflow boundaries, idempotency requirements, transaction boundaries, and retry ownership.
- `packages/orchestration` owns async execution envelopes, retry policies, dead-letter policies, event replay contracts, and correlation propagation.
- Services own queue, webhook, worker, and scheduler runtime containers only.
- Apps must not schedule durable jobs directly or own queue policy.

## Queue Ownership

- Queue messages require an id, queue name, job type, payload, idempotency key, attempt count, availability timestamp, and correlation context.
- Queue consumers may claim, complete, retry, or dead-letter jobs. They must not define business sequencing or cross-domain workflow policy.
- Queue fanout must be derived from orchestration contracts or application-service workflow descriptors, not duplicated in route handlers.

## Retry and Dead Letter Rules

- Retry plans must have max attempts, fixed or exponential backoff, initial delay, max delay, and retryable error classes.
- Dead-letter records must include execution id, target, payload summary, reason, correlation context, creation timestamp, and retention timestamp.
- Retry ownership belongs to orchestration runtime unless the application-service workflow explicitly delegates to a provider adapter.

## Replay and Idempotency

- Replayable async jobs must carry idempotency keys and causation ids.
- Replays must record skipped, processed, and failed counts.
- Idempotency replays must return the prior outcome or skip execution; they must not rerun mutations silently.

## Enforcement

- Runtime manifests must declare `asyncExecutionOwnership`, `replayOwnership`, and `workflowRecoveryOwnership`.
- Validators hard fail if apps or services define queue policy, workflow pipelines, retry policy helpers, or projection assembly outside the governed packages.
