# packages / theme engine AGENTS.md

Purpose: Local operating rules for `packages/theme-engine`. This file is hand-authored, subordinate to the root `AGENTS.md`, and exists only to state boundary-specific ownership.

## Ownership Rules

- Follow the root `AGENTS.md`, `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md`, and `GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md` before making architecture, money, identity, tenancy, or governance changes.
- Keep this package inside its declared source boundary: `packages/theme-engine`.
- Prefer completing the canonical owner over adding a parallel implementation.

## Forbidden Imports

- No imports from `apps/*`, `services/*`, `legacy/*`, repository-level `infrastructure/*`, generated output, or runtime-local build artifacts.

## Runtime Authority

- This boundary does not override root topology, runtime, package, migration, security, or deletion law.
- Reserved roots must stay manifest-only. Frozen roots are source-kept and de-deployed unless the Constitution and ARB explicitly activate them; do not add production deploy targets, public launch copy, or live marketplace/portal operation by default.
- Provider secrets, service-role credentials, and generated artifacts are never source authority.

## Deploy Chain (read this before assuming a theme change is "cached")

- Editing `theme-bundle.ts`/`theme-bundle-core.ts` changes nothing for an already-published
  store. A store renders from `theme_releases.template_snapshot -> 'liquidBundle'`, a frozen
  snapshot captured at publish time — it is NOT re-derived from `themes.default_template` after
  the fact. Full chain, both traps (`node` vs `npx tsx`; `template_snapshot` beating
  `release_manifest`), and the only supported way to publish a release: `docs/theme-deploy-chain.md`.

## Migration Notes

- The previous scan-generated repository-intelligence content was removed because generated drift is not law.
- Do not rerun or restore `scripts/generate-repository-intelligence.mjs` output into this file.
- If local rules need to change, edit this file by hand and keep it consistent with root governance.
