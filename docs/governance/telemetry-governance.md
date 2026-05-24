# Telemetry Governance

Status: Phase 3 OpenTelemetry-ready foundation.

## Authority

- Trace propagation, span lifecycle, async trace propagation, queue trace propagation, workflow trace propagation, metrics, and structured logging contracts live in `packages/distributed-runtime/src/telemetry-runtime.ts`.
- Services propagate request id, correlation id, trace id, and baggage through API, queue, webhook, replay, and workflow boundaries.
- Exporters remain vendor-neutral. Axiom, Sentry, OpenTelemetry collectors, or other vendors must be wired behind exporter ports.

## Rules

- Every async boundary must preserve trace context or create a child trace context.
- Queue messages must carry traceparent when available.
- Logs must be structured and redacted.
- Metrics must carry tenant/runtime dimensions without secret values.
