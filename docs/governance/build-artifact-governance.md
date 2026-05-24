# Build Artifact Governance

## Generated Output Classes

Generated outputs include:

- Next.js output: `.next/`, `out/`, app-local `.turbo/`, `tsconfig.tsbuildinfo`.
- TypeScript output: `dist/`, declaration maps, source maps emitted from package builds.
- Flutter and native output: `build/`, `.dart_tool/`, `.flutter-plugins*`, `*.dill`, APK/AAB/IPA files, iOS `Pods/`, `.symlinks/`.
- Worker output: `.wrangler/`, temporary bundles, dev state, source maps.
- Coverage and caches: `coverage/`, `.cache/`, `.turbo/cache/`, package-manager stores.
- Local analysis scratch files: root scan maps such as `topology.txt`, `import-map.txt`, and `heavy-files.txt`.
- Debug and trace output: `firebase-debug.log`, `*debug*.log`, `*.trace`, `*.trace.json`, and raw `docs/architecture/validation/` logs.

## Rules

- Generated outputs are never architecture authority.
- Generated outputs must not be committed.
- Governance scans must use tracked source, manifests, migrations, docs, and explicit config files only.
- Build outputs may be produced locally or in CI, but CI artifacts must be uploaded through CI artifact storage, not committed.
- If a generated directory must be retained for debugging, place the finding in `docs/governance` as a human-authored summary, not as raw cache output.
- Temporary root scripts and debug outputs are forbidden; reusable governance tooling belongs under `scripts/validators/` and must be documented.

## Current Historical Risk

The Git object database contains historical `.turbo/cache/*.tar.zst` blobs larger than 400 MiB. This phase documents and prevents recurrence; it does not rewrite history. A future maintenance window should use BFG Repo-Cleaner or `git filter-repo`, coordinate with every clone owner, and rotate any credentials found in historical blobs.

## Enforcement

- `.gitignore` blocks generated output families.
- `scripts/validators/generated-artifact-validator.mjs` fails on tracked generated artifacts.
- `scripts/validators/generated-artifact-validator.mjs` fails on tracked debug artifacts and forbidden topology paths.
- `scripts/validators/stale-artifact-validator.mjs` fails on untracked non-ignored governance scan artifacts, debug artifacts, and forbidden topology paths that should not be left in the workspace.
