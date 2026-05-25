# Deterministic Build Governance

LetBuyy builds must be reproducible from `pnpm-lock.yaml`, package manifests, root TypeScript governance, and Turborepo task ordering.

## Rules

- CI and hosted installs must use `pnpm install --frozen-lockfile`.
- Vercel install commands must not delete local `node_modules` or rely on app-local dependency cleanup.
- Package builds use composite TypeScript projects and declaration output under package-local `dist/`.
- Turborepo build tasks depend on upstream package typechecks and builds.
- Governed CI and deployment scripts use pnpm; legacy package-manager command leakage is blocked by `supply-chain-validator.mjs`.
- Generated outputs are never source authority and must remain ignored/untracked.

## Validation

- `pnpm run validate:governance`
- `pnpm run validate:typescript`
- `pnpm run validate:dependencies`
- `pnpm run test`
- `pnpm run typecheck` after dependencies are installed
