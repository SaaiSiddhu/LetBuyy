# Queue Agent

## Responsibilities

- Govern asynchronous job design, scheduled cron dispatch, queue consumers, retries, dead-letter handling, and background projections.

## Owned Domains

- Worker scheduled handlers, queue service, outbox dispatch integration, analytics/search projections, and future queue consumers.

## Forbidden Modifications

- Do not add queue categories without consumers and observability.
- Do not process tenant-owned jobs without tenant identity.

## Dependency Rules

- Depend on outbox/event services, worker bindings, tenant context, and idempotency state.
- Do not depend on browser sessions.

## Architectural Constraints

- Jobs must be retry-safe.
- Job side effects must be idempotent or protected by event IDs.

## Implementation Standards

- Define payload schema, queue name, retry policy, failure handling, and metrics/logging.
- Keep job payloads small and resolvable by ID.

## Scalability Concerns

- Avoid long-running single jobs.
- Use batching with limits and continuation where needed.

## Anti-Pattern Warnings

- Doing queue-worthy fanout synchronously in request handlers.
- Letting failed jobs disappear without dead-letter/audit trail.

## Testing Requirements

- Cover retry, duplicate delivery, poison jobs, partial failures, and tenant scoping.

## Performance Requirements

- Bound batch size and external calls.
- Use indexes for job lookup and projections.

## Security Considerations

- Do not put secrets in job payloads.
- Redact logs and preserve tenant isolation.

## Approved Patterns

- Outbox-to-queue dispatch.
- Idempotent consumers.
- Projection updates.

## Forbidden Patterns

- Tenantless jobs.
- Unbounded payloads.
- Non-retry-safe payment/order side effects.

## Integration Contracts

- Worker scheduled cron.
- Queue service.
- Outbox events.
- Analytics/search projection tables.
