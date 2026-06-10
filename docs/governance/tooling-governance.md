# Tooling Governance

Repository tooling must be owned, discoverable, reusable, and CI-safe.

## Canonical Script Structure

- `scripts/validators/`: executable governance validators and shared validator helpers.
- `scripts/staging/`: staging seed and proof helpers for browser and Playwright verification.
- `scripts/governance/`: reusable governance orchestration.
- `scripts/generators/`: reusable repository intelligence and docs generators.
- `scripts/migration/`: documented migration tools.
- `scripts/utilities/`: reusable non-governance utilities.

Root-level scripts are limited to stable entrypoints and retired tombstones:

- `scripts/validate-governance.mjs`
- `scripts/validate-architecture.mjs`
- `scripts/generate-repository-intelligence.mjs` (retired; exits non-zero and must not generate authority)

## Temporary Tooling

Temporary scripts, debug output, raw scan maps, traces, and repair scratch files must not remain in the repository root.

Allowed ignored temporary locations:

- `.codex/`
- `.analysis/`
- `.tmp/`
- `temp/`

Temporary files must be deleted before handoff unless deliberately promoted into canonical tooling with docs and CI enforcement.

## Enforcement

`scripts/validators/tooling-governance-validator.mjs` fails governance when:

- canonical script directories are missing
- a canonical script directory lacks README ownership notes
- unexpected root-level scripts appear
- unexpected script directories appear
- validator files are not `.mjs` modules or README docs
