# Telemetry Runtime Governance

Status: Phase 3 operations-final telemetry runtime foundation.

## Authority

- OpenTelemetry-compatible propagation, span lifecycle, metrics, structured logs, and exporter ports live in `packages/distributed-runtime/src/telemetry-runtime.ts`.
- Trace diagnostics, sampling policy, log queries, metric aggregation, and operational telemetry reads live in `packages/distributed-runtime/src/telemetry-operations-runtime.ts`.

## Rules

- Trace context must propagate through API, queue, replay, workflow, projection, and provider boundaries.
- Queue messages and replay plans must carry trace context when available.
- Structured logs must include runtime, correlation, tenant when available, and redacted attributes.
- Telemetry exporters remain vendor-neutral until a production exporter is selected.

## Enforcement

- Runtime manifests must declare `telemetryOwnership` and `telemetryExecutionOwnership`.
- CI governance hard fails telemetry contract drift through runtime manifest and distributed runtime validators.
