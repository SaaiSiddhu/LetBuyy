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
- Deprecated active roots are absent.
- Deprecated app aliases, duplicate operator roots, and nested storefront runtime trees are absent.
- Mandatory governance files exist.
- App-to-app imports are forbidden.
- Package-to-runtime imports are forbidden.
- Active-runtime imports from `legacy/` are forbidden.
- Shared package manifests and ownership files exist.
- Runtime manifests exist for every canonical app/service runtime.
- Dependency graph direction and circular dependency rules are enforced.
- Runtime env files are not tracked.
- Secret-like values are not tracked outside allowed templates and governance docs.
- Generated artifacts are not tracked.
- Ignored runtime-local artifact directories are not left in app/service/package roots.
- Debug logs, trace files, and local governance scan scratch files are not left as source candidates.
- Database migrations live under `database/supabase/migrations`.
- Workers live under `services/`.

## Validator Inventory

| Validator | Scope |
|---|---|
| `architecture-validator.mjs` | Root topology, mandatory governance memory, deprecated and forbidden runtime roots |
| `runtime-validator.mjs` | Canonical app/service roots, forbidden alias roots, service activation requirements |
| `runtime-manifest-validator.mjs` | Required runtime manifests, actor classification, environment schema references, platform console/operations boundary |
| `package-ownership-validator.mjs` | Package manifests, Dart manifests, ownership files, public export boundaries |
| `import-validator.mjs` | App, service, package, legacy, and infrastructure import boundaries |
| `dependency-graph-validator.mjs` | Internal dependency direction, package layering, runtime leakage, and circular dependency prevention |
| `environment-validator.mjs` | Env docs/templates/schemas/ownership, tracked env file prevention, ignore rules, tracked secret-like value prevention |
| `generated-artifact-validator.mjs` | Tracked `.next`, `dist`, `build`, cache, Worker, Flutter, binary, debug, and forbidden topology artifact prevention |
| `stale-artifact-validator.mjs` | Untracked non-ignored local governance scan artifact, ignored local artifact directory, debug artifact, and forbidden topology detection |
| `tooling-governance-validator.mjs` | Canonical script directories, root script allowlist, validator module format |

## CI Policy

CI must run `node scripts/validate-governance.mjs` before accepting runtime topology changes. Typecheck, lint, and build checks should be added per runtime as existing blockers are removed. CI must fail if a deprecated runtime alias, nested storefront runtime, missing runtime manifest, invalid dependency direction, debug artifact, secret-like tracked value, local artifact directory, or generated output becomes present.
