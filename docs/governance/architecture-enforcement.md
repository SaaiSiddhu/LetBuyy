# Architecture Enforcement

## Enforcement Layers

LetBuyy enforces architecture through:

- Root `AGENTS.md` and local runtime/package `AGENTS.md` files.
- Mandatory governance docs in `docs/governance`.
- Governance validation entrypoint: `scripts/validate-governance.mjs`.
- Compatibility architecture entrypoint: `scripts/validate-architecture.mjs`.
- Modular validators under `scripts/validators/`.
- CI workflow: `.github/workflows/architecture-governance.yml`.
- CODEOWNERS: `.github/CODEOWNERS`.
- Generated repository intelligence from `scripts/generate-repository-intelligence.mjs`.

## Validator Responsibilities

The governance validators must check:

- Canonical runtime roots exist.
- Deprecated active roots are absent or contain no active source.
- Mandatory governance files exist.
- App-to-app imports are forbidden.
- Package-to-runtime imports are forbidden.
- Active-runtime imports from `legacy/` are forbidden.
- Shared package manifests and ownership files exist.
- Runtime env files are not tracked.
- Generated artifacts are not tracked.
- Local governance scan scratch files are not left as untracked source candidates.
- Database migrations live under `database/supabase/migrations`.
- Workers live under `services/`.

## Validator Inventory

| Validator | Scope |
|---|---|
| `architecture-validator.mjs` | Root topology, mandatory governance memory, deprecated tracked roots |
| `runtime-validator.mjs` | App aliases, canonical app/service roots, service activation requirements |
| `package-ownership-validator.mjs` | Package manifests, Dart manifests, ownership files, public export boundaries |
| `import-validator.mjs` | App, service, package, legacy, and infrastructure import boundaries |
| `environment-validator.mjs` | Env docs/templates/schemas, tracked env file prevention, ignore rules |
| `generated-artifact-validator.mjs` | Tracked `.next`, `dist`, `build`, cache, Worker, Flutter, and binary output prevention |
| `stale-artifact-validator.mjs` | Untracked non-ignored local governance scan artifact detection |

## CI Policy

CI must run `node scripts/validate-governance.mjs` before accepting runtime topology changes. Typecheck, lint, and build checks should be added per runtime as existing blockers are removed.
