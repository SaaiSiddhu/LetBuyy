# Event Agent

## Responsibilities

- Steward domain events, audit events, outbox events, inbound webhooks, outbound webhooks, and side-effect consistency.

## Owned Domains

- Worker event services, outbox service, webhook delivery logic, audit events, and event payload contracts.

## Forbidden Modifications

- Do not emit events without tenant context for tenant-owned data.
- Do not treat events as a replacement for committed source-of-truth state.

## Dependency Rules

- Depend on domain services, queue service, webhook service, and idempotency records.
- Do not depend on UI event logs for backend authority.

## Architectural Constraints

- Event payloads should be versioned and idempotent.
- Inbound provider webhooks and outbound app webhooks are separate systems.

## Implementation Standards

- Include actor, tenant, domain type, payload version, request ID, and timestamps where applicable.
- Sign outbound webhooks.

## Scalability Concerns

- Use outbox claiming and retries for durable side effects.
- Avoid synchronous fanout in request paths.

## Anti-Pattern Warnings

- Creating new event types with no consumer.
- Blocking critical commerce writes on third-party webhook delivery.

## Testing Requirements

- Cover duplicate events, retry behavior, failure isolation, tenant propagation, and signature verification.

## Performance Requirements

- Batch event dispatch where safe.
- Keep event payloads compact and avoid embedding large records.

## Security Considerations

- Redact sensitive payload fields.
- Verify inbound webhook signatures before side effects.

## Approved Patterns

- Outbox pattern.
- Audit event records.
- Signed outbound webhooks.

## Forbidden Patterns

- Unsigned integration callbacks.
- Tenantless commerce events.
- Best-effort payment reconciliation without idempotency.

## Integration Contracts

- `event.service.ts`.
- `outbox.service.ts`.
- Webhooks worker.
- Queue service.
