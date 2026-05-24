# Validator Tooling

`scripts/validators/` is the canonical home for executable governance checks. Validators must be deterministic, non-interactive, CI-safe, and must not read generated artifact directories as source authority.

Shared helpers belong in `governance-common.mjs`. New validators must be wired through `scripts/validate-governance.mjs` before their enforcement is documented.
