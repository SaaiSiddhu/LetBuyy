<!-- UPDATED BY CODEX UI FOUNDATION STREAM ON 2026-06-06. Regenerate repository intelligence after parallel streams merge. -->
# TypeScript UI AGENTS.md

Purpose: `@letbuyy/ui` is the shared LetBuyy design-system package for React runtimes. It owns design tokens, CSS-variable theming, density, accessible primitives, feedback surfaces, app-shell primitives, table/list tooling, Storybook coverage, and UI governance artifacts.

Canonical source boundary: `packages/typescript/ui`.

## Inventory

- Package: `@letbuyy/ui`.
- Public entrypoints: `.`, `./tokens`, `./formatting`, `./preview`.
- Source root: `packages/typescript/ui/src`.
- Tests: `packages/typescript/ui/tests`, plus eslint and codemod self-tests.
- Visual baselines: `packages/typescript/ui/storybook-screenshots/baseline`.
- UI governance tools: `packages/typescript/ui/eslint`, `packages/typescript/ui/codemods`, `packages/typescript/ui/snapshots`.

## Ownership Rules

- Keep this package app-agnostic. It must not import app, service, legacy, infrastructure, route, env, database, or provider SDK code.
- Public exports are compatibility contracts. Do not remove or rename an export without a human-approved cross-app migration.
- `--lb-*` CSS variables are public API. Do not remove or rename existing variables; add new variables additively.
- Components must support light, dark, and auto themes; compact, comfortable, and spacious density; keyboard focus; disabled states; loading states where relevant; empty/error states where relevant; and accessible names for icon-only controls.
- New interactive components must pass RTL behavior tests and `jest-axe`, and must have Storybook coverage.
- Overlay components must use the shared focus-trap, dismiss, and z-index foundation.
- Preview-only helpers belong in `@letbuyy/ui/preview`; root re-exports remain deprecated compatibility shims.

## Dependency Rules

- Keep React and React DOM as peer dependencies compatible with React 18 and React 19.
- New runtime dependencies require a clear UI-package reason and must not introduce build-time network access.
- Test-only libraries stay in `devDependencies`.
- Shared UI must use package-owned tokens and `cx`; avoid raw hardcoded hex values outside token definitions and visual fixtures.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, `infrastructure/*`, generated output, local runtime env files, Next routes, worker bindings, database clients, or provider SDKs.
- No package-private deep imports from other packages unless their public export explicitly exposes the contract.

## Runtime Authority

- This package does not deploy independently.
- This package owns no routes, environment files, worker bindings, database access, provider credentials, schedulers, or app runtime configuration.
- Runtime manifests under `apps/*/runtime.manifest.json` and `services/*/runtime.manifest.json` define where this package may be consumed.
- App and service runtimes consume `@letbuyy/ui`; `@letbuyy/ui` must never consume app or service runtime authority.

## Testing and Gates

- `pnpm --filter @letbuyy/ui test`
- `pnpm --filter @letbuyy/ui test:eslint-rules`
- `pnpm --filter @letbuyy/ui test:codemods`
- `pnpm --filter @letbuyy/ui validate:ui`
- `pnpm --filter @letbuyy/ui build`
- `pnpm --filter @letbuyy/ui test:visual`

Run repo-wide typecheck, build, lint, test, and governance validation after changes that affect the public API, tokens, or visual output.

## CODEOWNERS Guidance

Prefer a package-local CODEOWNERS entry such as:

```text
packages/typescript/ui/** @letbuyy/design-system-maintainers
```

Human maintainers should adapt the owner handle before adding it to the root `CODEOWNERS`. Root CODEOWNERS enablement is intentionally outside this package stream.

## Theme Contract

- `DesignSystemRoot` owns `theme`, `density`, `surface`, `brand`, `includeTokenStyles`, and `dir`.
- `theme="auto"` follows `prefers-color-scheme`; explicit `light` and `dark` override OS preference.
- `surface` emits identity defaults for `admin`, `marketplace`, `storefront`, `identity`, and `operations`; differentiated palettes require human brand approval.
- `brand` overrides primary, CTA, focus-ring, and accent CSS variables. Run `validateLetbuyyBrandContrast(brand)` before accepting a custom palette.
- Custom brand colors must preserve at least 4.5:1 text contrast for accent/CTA text and 3:1 focus-ring contrast on light surfaces.
- Existing `--lb-*` variables remain public API and must continue to emit.

## Migration Notes

- Deprecations are additive only and are tracked in `packages/typescript/ui/DEPRECATIONS.md`.
- Use package codemods in `packages/typescript/ui/codemods` for planned cross-app migrations.
- Enabling the UI eslint plugin in apps is an app-stream/human gate; the plugin lives under `packages/typescript/ui/eslint`.
- Repository intelligence regeneration with `scripts/generate-repository-intelligence.mjs` is deferred until parallel streams merge because that script rewrites root, docs, app, service, and non-UI package files.
