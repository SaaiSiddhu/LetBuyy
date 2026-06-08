# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets). It is the versioning + changelog contract for the LetBuyy workspace (starting with `@letbuyy/ui`).

## Workflow

1. Make your change to a package (e.g. `@letbuyy/ui`).
2. Run `npx changeset` and describe the change; pick the bump:
   - **patch** — bug fix, no API/visual change
   - **minor** — additive (new component/token, *introducing* a deprecation)
   - **major** — breaking (token/prop/component removal). **Ship a codemod in the same PR** (`packages/typescript/ui/codemods` + `codemods/cli.mjs`).
3. Commit the generated changeset file with your PR. CI should require a changeset on any PR touching `packages/typescript/ui/**`.
4. Release: `npx changeset version` (bumps versions + writes CHANGELOG) then `npx changeset publish`.

## Deprecation policy (warn → wait → remove)

Introduce `warnDeprecated()` + document the replacement in a **minor**; keep for ≥1 minor; remove in the next **major** with a codemod shipped alongside.
