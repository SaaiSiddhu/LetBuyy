# Architecture Enforcement

## Enforcement Layers

LetBuyy enforces architecture through:

- Root `AGENTS.md` and local runtime/package `AGENTS.md` files.
- Mandatory governance docs in `docs/governance`.
- Architecture validation script: `scripts/validate-architecture.mjs`.
- CI workflow: `.github/workflows/architecture-governance.yml`.
- CODEOWNERS: `.github/CODEOWNERS`.
- Generated repository intelligence from `scripts/generate-repository-intelligence.mjs`.

## Validator Responsibilities

The architecture validator must check:

- Canonical runtime roots exist.
- Deprecated active roots are absent or contain no active source.
- Mandatory governance files exist.
- App-to-app imports are forbidden.
- Package-to-runtime imports are forbidden.
- Active-runtime imports from `legacy/` are forbidden.
- Shared package manifests and ownership files exist.
- Database migrations live under `database/supabase/migrations`.
- Workers live under `services/`.

## CI Policy

CI must run architecture validation before accepting runtime topology changes. Typecheck, lint, and build checks should be added per runtime as existing blockers are removed.

