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
- `config/runtime/replay-evolution-manifest.json` records event lineage, compatibility matrices, deterministic replay fixtures, and explicitly states that repository fixtures are governance contracts, not live production evidence.
- `scripts/validators/replay-safety-validator.mjs` blocks replay-critical wall-clock/random entropy and requires stable serialization.
- `scripts/validators/replay-evolution-validator.mjs` verifies event fixture checksums, strictly ordered snapshot positions, and additive-or-explicit-transform evolution.
- `scripts/validators/event-schema-validator.mjs` enforces versioned append-only event storage and replay compatibility gates.
- `scripts/validators/event-versioning-validator.mjs` requires replay-safe event descriptors and blocks unsupported or migration-required versions before replay.
- `scripts/validators/projection-integrity-validator.mjs` requires projection source event and source position metadata.
- `scripts/validators/projection-recovery-validator.mjs` links replay snapshots to projection recovery hashes.
- `tests/replay/replay-determinism.test.mjs` proves the minimum deterministic replay contract.
- `scripts/validators/migration-safety-validator.mjs` blocks schema history patterns that would destroy replayability.
- Live replay recovery remains execute-mode evidence and must not be claimed from repository checks alone.
