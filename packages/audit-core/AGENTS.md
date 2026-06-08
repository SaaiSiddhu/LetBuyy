# Audit Core Package

Purpose: Canonical `audit_events` envelope, event taxonomy, and emitter interfaces for dormant audit dual-write.

Canonical source boundary: `packages/audit-core`.

## Ownership Rules

- Define audit event contracts and pure helpers only.
- Legacy `audit_logs` and `audit_activity_events` remain live until future drain evidence exists.
- No imports from apps, services, infrastructure, provider SDKs, runtime env, or database clients.

## Dependency Rules

- Dependencies must flow from runtimes into this package, never from this package back into runtime source.
- Package-to-package dependencies must follow `scripts/validators/dependency-graph-validator.mjs`.
- Audit payload contracts must remain redaction-aware and avoid storing raw secrets.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, runtime env helpers, or database clients.

## Runtime Authority

- This package does not deploy independently and must not own live audit table writes, worker bindings, provider clients, or environment files.
- Runtime shims may consume this package for dual-write contracts behind default-off audit flags.

## Migration Notes

- Audit dual-write must be additive: legacy rows remain authoritative and canonical `audit_events` writes must never replace them during this phase.
- Hash-chain anchoring remains mock-only until live KMS approval is recorded.
