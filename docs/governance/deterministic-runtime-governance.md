# Deterministic Runtime Governance

Runtime behavior must be deterministic across replay, queues, feature flags, deployment gates, and certification scoring.

## Rules

- Replay state must derive only from ordered event streams and deterministic reducers.
- Feature flag percentage rollout must use stable identity hashing, never random selection.
- Queue retry and dead-letter behavior must use explicit attempt counts and deterministic retry timestamps.
- Certification scoring must ignore records without passing live status.
- Cross-region replay requires checksum and projection comparison before traffic is restored.

## Enforcement

- Replay tests under `tests/replay/` prove identical event streams produce identical state.
- Queue and feature-flag tests prove deterministic recovery and rollout behavior.
- `generate-certification-report.mjs` counts only records with passing statuses or explicit consistency/signature evidence.
