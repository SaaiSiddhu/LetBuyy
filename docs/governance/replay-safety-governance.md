# Replay Safety Governance

Replay safety means the same valid event stream produces the same projection state, can be checkpointed, can be rebuilt, and fails closed on invalid order or missing prerequisites.

## Rules

- Event handlers must be deterministic and must not depend on wall-clock time, random values, provider reads, or mutable global state during replay.
- Projection rebuilds must use ordered event streams and explicit checkpoints.
- Replay authorization is required before non-dry-run operations.
- Destructive migrations that invalidate historical replay are forbidden.
- Event schema changes require backward compatibility validation.

## Validation

- `tests/replay/replay-determinism.test.mjs` proves the minimum deterministic replay contract.
- `scripts/validators/migration-safety-validator.mjs` blocks schema history patterns that would destroy replayability.
- Live replay recovery remains execute-mode evidence and must not be claimed from repository checks alone.
