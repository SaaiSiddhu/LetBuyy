# LetBuyy Density Reconstruction Report

Date: 2026-06-03

## Scope

This wave changed only the shared UI package. Applications inherit the density changes through exported tokens, CSS variables, and shared primitives.

No application routes, page components, backend logic, API contracts, database schema, auth, or payment code were changed in this density wave.

## Density System

The shared UI package now defines three density modes:

- `compact`
- `comfortable`
- `spacious`

`DesignSystemRoot` defaults to `compact`, making LetBuyy admin surfaces compact by default.

Core CSS variables added:

- `--lb-density-sidebar-row-height`
- `--lb-density-input-height`
- `--lb-density-button-height`
- `--lb-density-pill-height`
- `--lb-density-table-row-height`
- `--lb-density-page-gap`
- `--lb-density-card-padding`
- `--lb-density-header-height`
- `--lb-density-empty-state-scale`

Additional supporting density variables include icon sizes, modal padding, action bar height, empty-state illustration dimensions, and table header height.

## Component Consumption

| System | Shared source | Density outcome |
|---|---|---|
| Buttons | `src/button.tsx` | Primary/secondary buttons now use density button height and tighter horizontal padding. |
| Inputs | `src/input.tsx`, `src/controls.tsx` | Inputs, selects, and comboboxes use 36px compact input height and 14px text. |
| Tables | `src/data-table.tsx`, `src/productivity.tsx` | Table rows and headers use compact density variables; table text is 13px. |
| Cards | `src/layout.tsx`, `src/productivity.tsx` | Section and metric padding flows through `--lb-density-card-padding`. |
| Headers | `src/layout.tsx` | Page header uses compact height, 24px title, and 18px page icon. |
| Empty states | `src/feedback.tsx` | Illustration and min-height are reduced through density variables. |
| Badges and pills | `src/feedback.tsx`, `src/productivity.tsx` | Pills use density pill height and 12px badge typography. |
| Modals | `src/overlays.tsx` | Modal header/body padding uses density modal padding. |
| Storybook | `src/design-tokens.stories.tsx` | Added density comparison, compact, comfortable, spacious, and admin preview stories. |

## Typography Reconstruction

| Token | Before | After |
|---|---:|---:|
| Display | 48px | 32px |
| H1 | 40px | 28px |
| H2 | 32px | 24px |
| H3 | 24px | 20px |
| H4 | 20px | 18px |
| Page title | 24px | 24px |
| Section title | N/A | 18px |
| Card title | N/A | 16px |
| Body | 16px | 14px |
| Secondary | N/A | 13px |
| Table | 14px inherited | 13px |
| Badge | 12px | 12px |

## Visual Density Audit

Measured against the previous shared UI token/component values in this package.

| Component | Before | After compact | Change |
|---|---:|---:|---:|
| Button md | 40px | 36px | -10% |
| Button lg | 48px | 40px | -17% |
| Icon button | 40px | 32px | -20% |
| Input | 40px | 36px | -10% |
| Table row | 46px | 44px | -4% |
| Table header | 40px | 44px | +10%, aligned to requested 44px target |
| Action/filter bar | 40px | 36px | -10% |
| Metric card padding | 24px | 16px | -33% |
| Empty-state min height | 220px | 180px | -18% |
| Empty-state illustration width | 192px | 160px | -17% |
| Empty-state illustration height | 128px | 108px | -16% |
| Modal padding | 20px inherited | 16px | -20% |
| Banner padding | 16px | 16px density-bound | 0%, now tokenized |
| Drawer | N/A | N/A | No shared Drawer primitive exists in `@letbuyy/ui`. |

The largest gains come from typography, card padding, page gaps, empty states, icon sizing, and action density. Tables were already partially compacted in the prior merchant UX architecture wave, so the row delta is smaller while still meeting the requested 44px target.

## Storybook Coverage

New Storybook stories:

- `Design Tokens / Density Comparison`
- `Design Tokens / Compact Density`
- `Design Tokens / Comfortable Density`
- `Design Tokens / Spacious Density`
- `Design Tokens / Shopify-style Admin Preview`

These stories render the same components with `data-density` and `data-letbuyy-density` rather than duplicated component styles.

## Validation

| Command | Result |
|---|---|
| `pnpm --filter @letbuyy/ui typecheck` | Passed |
| `pnpm --filter @letbuyy/ui build` | Passed |
| `pnpm turbo typecheck` | Passed: 57 successful, 57 total |
| `pnpm turbo build` | Passed after rerun outside sandbox: 57 successful, 57 total |
| `pnpm --filter @letbuyy/ui exec storybook build -o ../../../.tmp/storybook-density-reconstruction` | Passed |

Notes:

- The first sandboxed `pnpm turbo build` stalled during Next/Turbopack app builds.
- The first escalated rerun found a stale `apps/storefront-runtime/.next/lock` from the interrupted build.
- After stopping the stale `next build` process, the escalated `pnpm turbo build` passed.
- Storybook emitted the normal Vite large-chunk warning.

## Remaining Follow-Up

- Add a shared Drawer primitive if LetBuyy wants drawer density governed through `@letbuyy/ui`.
- Migrate any application-local sidebar row classes to consume `--lb-component-sidebar-row-height` where they are not already token-bound.
- Add visual regression snapshots for compact, comfortable, and spacious density modes.
- Consider route-level cleanup later only to remove redundant local spacing once central inheritance has settled.
