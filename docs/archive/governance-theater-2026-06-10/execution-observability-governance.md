# Execution Observability Governance

Execution observability is part of LetBuyy's runtime contract, independent of any telemetry vendor.

## Source Authority

- Execution trace contracts live in `packages/orchestration/src/observability-runtime.ts`.
- Runtime manifests declare correlation and observability authority.
- Service runtimes create and propagate execution spans for API, webhook, queue, scheduler, event, and workflow execution.
- Apps propagate request and correlation ids through rendering and transport boundaries.

## Correlation Rules

- Every runtime request should carry `X-Request-ID`.
- Workflow commands, events, outbox records, provider calls, and audit records must preserve correlation id.
- Child commands and events should preserve causation id when they originate from another command or event.
- Trace metadata is runtime-neutral and must not encode vendor-specific telemetry assumptions.

## Trace Rules

- Execution traces require trace id, root runtime, operation, start timestamp, span list, and status.
- Spans must include runtime, operation, start timestamp, and status.
- Failed spans must retain sanitized error metadata only.
- Trace ids and audit ids must not expose secrets, raw provider payloads, or customer-sensitive data.

## Audit Rules

- Mutating workflows require audit records with actor id, tenant id when scoped, operation, result, and correlation id.
- Provider webhooks require signature verification before audit side effects.
- Audit metadata must be redacted and provider-neutral.

## Forbidden Patterns

- Production `console.log` as durable observability.
- Raw database or provider errors returned to clients.
- Event, workflow, or provider execution without correlation propagation.
- Vendor-specific telemetry imports inside domain packages or application-services.
