# Observability Infrastructure Governance

Purpose: Logging, tracing, metrics, request IDs, error correlation, and runtime telemetry policy.

Boundary: `infrastructure/observability`.

Rules:

- Logs must be structured and redacted.
- Runtime telemetry must preserve tenant and request correlation.
- Client responses must not expose raw provider or database errors.
