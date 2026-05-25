# Replay Safety Governance

Replay safety means the same valid event stream produces the same projection state, can be checkpointed, can be rebuilt, and fails closed on invalid order or missing prerequisites.

## Rules

- Event handlers must be deterministic and must not depend on wall-clock time, random values, provider reads, or mutable global state during replay.
- Projection rebuilds must use ordered event streams and explicit checkpoints.
- Replay authorization is required before non-dry-run operations.
- Destructive migrations that invalidate historical replay are forbidden.
- Event schema changes require backward compatibility validation.

## Validation

- `config/runtime/replay-safety-contract.json` is the machine-readable replay determinism contract.
- `scripts/validators/replay-safety-validator.mjs` blocks replay-critical wall-clock/random entropy and requires stable serialization.
- `scripts/validators/event-schema-validator.mjs` enforces versioned append-only event storage and replay compatibility gates.
- `scripts/validators/projection-integrity-validator.mjs` requires projection source event and source position metadata.
- `tests/replay/replay-determinism.test.mjs` proves the minimum deterministic replay contract.
- `scripts/validators/migration-safety-validator.mjs` blocks schema history patterns that would destroy replayability.
- Live replay recovery remains execute-mode evidence and must not be claimed from repository checks alone.
