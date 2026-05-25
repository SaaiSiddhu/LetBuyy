# Migration Governance

## Migration Phases

1. Repository topology governance.
2. Apps restructuring.
3. Service extraction.
4. Database extraction.
5. Docs consolidation.
6. Package normalization.
7. Dependency governance.
8. Architecture enforcement.
9. CI/CD governance.
10. Final repository purification.

## Safety Criteria

Before each phase:

- Inspect current source and generated memory.
- Confirm worktree state.
- Identify runtime, package, and deployment files affected.
- Avoid mixing unrelated behavior changes with path migrations.

After each phase:

- Validate manifests and imports.
- Run architecture validation.
- Run targeted typecheck/build where blast radius requires it.
- Commit atomically with a rollback-safe message.

## Move Rules

- Prefer `git mv` for tracked runtime moves.
- Preserve internal relative imports during moves.
- Update workspace manifests, deployment config, generated intelligence scripts, docs, and CI in the same phase as path changes.
- Do not delete legacy code until it is isolated under `legacy/` and no active runtime imports it.

