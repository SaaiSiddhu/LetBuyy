# Event System Rules

## Event Roles

- Audit events explain who did what.
- Outbox events drive durable side effects.
- Queue jobs process asynchronous projections or integrations.
- Inbound webhooks reconcile provider state.
- Outbound webhooks notify installed apps/integrations.

## Required Event Properties

- Tenant identity where tenant-owned data is involved.
- Actor identity or system actor.
- Idempotency key or event ID for repeatable side effects.
- Domain type and versioned payload.
- Retry status and timestamps for asynchronous delivery.

## Rules

- Do not emit events as a substitute for committing source-of-truth state.
- Do not rely on provider callbacks without signature verification.
- Do not create new outbox categories without a consumer, retry policy, and observability plan.
- Keep inbound provider webhooks separate from outbound app webhooks.
- Sign outbound webhook deliveries.

## Testing

- Test duplicate event handling.
- Test retry behavior.
- Test tenant context propagation.
- Test failure isolation so one integration does not block unrelated tenant workflows.
