# Deterministic Runtime Governance

Runtime behavior must be deterministic across queues, idempotency, feature flags, deployment gates, and certification scoring.

## Rules

- Transactional outbox and idempotency state must derive only from ordered records and deterministic reducers.
- Feature flag percentage rollout must use stable identity hashing, never random selection.
- Queue retry and dead-letter behavior must use explicit attempt counts and deterministic retry timestamps.
- Certification scoring must ignore records without passing live status.
- Rollback and queue recovery require checksum and health-gate comparison before traffic is promoted.

## Enforcement

- Queue and idempotency tests prove identical records produce identical state.
- Queue and feature-flag tests prove deterministic recovery and rollout behavior.
- `generate-certification-report.mjs` counts only records with passing statuses or explicit consistency/signature evidence.
