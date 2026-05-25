# Git Governance

## Commit Rules

- Use `type(scope): concise summary`.
- Stage selectively. Do not use blind `git add .` for governance work.
- Keep commits atomic by concern: docs, validators, CI, cleanup, or topology normalization.
- Do not rewrite history during normal feature or governance phases.
- Do not revert user-owned dirty worktree changes unless explicitly instructed.

## Large Object Policy

- Files over 10 MiB require explicit ownership reasoning before tracking.
- Build caches, app bundles, package-manager stores, Worker bundles, APK/AAB/IPA files, and raw validation logs are forbidden in Git.
- Runtime-local `node_modules` under `apps/`, `services/`, or `packages/` are forbidden as tracked content and as local handoff pollution.
- Historical large blobs must be handled by a coordinated history-cleaning plan, not an ad hoc local reset.

## Current Object Database Finding

`git count-objects -vH` reports a multi-GiB loose object database in this workspace, with the largest objects coming from historical `.turbo/cache/*.tar.zst` entries. These artifacts are no longer tracked in the current tree, but they remain in history/object storage. The remediation path is:

1. Freeze pushes during a maintenance window.
2. Create a verified mirror backup.
3. Run BFG Repo-Cleaner or `git filter-repo` against `.turbo/cache`, `.wrangler/tmp`, `dist`, app build output, and known env dumps.
4. Force-push the cleaned protected branches.
5. Require every developer and CI clone to re-clone or follow the documented garbage-collection procedure.
6. Rotate any secret that appeared in historical committed env files.

## Enforcement

- `.gitignore` prevents future local artifact discovery.
- `scripts/validators/generated-artifact-validator.mjs` prevents artifact commits.
- `scripts/validators/stale-artifact-validator.mjs` catches untracked governance scan artifacts and ignored local artifact directories before final handoff.
- `scripts/validators/environment-validator.mjs` blocks tracked env dumps and secret-like values without printing secret contents.
