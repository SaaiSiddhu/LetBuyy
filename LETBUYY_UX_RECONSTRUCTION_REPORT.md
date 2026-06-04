# LetBuyy UX Reconstruction Report

Date: 2026-06-03

## Mission Scope

This wave reconstructed the merchant experience architecture through shared UI primitives, central tokens, table density, compact page headers, and reusable empty-state illustration systems.

No backend logic, API contracts, database schema, auth behavior, payment behavior, or commerce workflow logic was changed in this wave.

## Architectural Outcome

LetBuyy now has a centralized merchant UX foundation for:

- Compact page shell and page header architecture.
- Breadcrumbs and section labels defaulting off at the shared UI layer.
- Icon-based page identity through shared UI page metadata.
- Header-row action placement through `PageHeaderActions`.
- Three-layer surface hierarchy using design tokens.
- Elevated but quiet card treatment through shared card tokens.
- Denser commerce table rows and headers.
- Compact filter bar primitive for future route adoption.
- Theme-aware SVG empty-state illustration architecture.
- More compact input/select label hierarchy.

## Files Changed In This Wave

| File | Change |
|---|---|
| `packages/typescript/ui/src/tokens.ts` | Added merchant surface hierarchy, compact page header tokens, table density tokens, spacing aliases, empty-state motion, and card elevation tokens. |
| `packages/typescript/ui/src/layout.tsx` | Added `PageShell`, `PageContent`, `PageHeaderActions`, compact `PageHeader`, optional breadcrumb/section-label defaults, and icon-based page identity. |
| `packages/typescript/ui/src/data-table.tsx` | Reduced table header and row height, tightened cell padding, and moved table surface styling to shared card tokens. |
| `packages/typescript/ui/src/productivity.tsx` | Tightened `IndexTable`, added shared `FilterBar` and `TableFilterBar`, and reduced saved-view/filter/bulk-action chrome. |
| `packages/typescript/ui/src/feedback.tsx` | Added reusable `EmptyStateIllustration` with module-specific SVG motifs and reduced-motion-aware animation. |
| `packages/typescript/ui/src/input.tsx` | Reduced input label/body hierarchy through shared text tokens. |
| `packages/typescript/ui/src/controls.tsx` | Reduced select/combobox label and control text hierarchy through shared tokens. |
| `packages/typescript/ui/src/index.ts` | Exported the new page shell, page action, empty-state illustration, and filter bar APIs. |
| `packages/typescript/ui/src/design-tokens.stories.tsx` | Added Storybook previews for compact merchant shell, table density, and empty-state illustration V2. |
| `apps/merchant-control-plane/src/app/globals.css` | Pointed merchant app background and sidebar aliases at shared UI `--lb-*` surface tokens. |

## Components Changed

| Component/System | Result |
|---|---|
| `PageShell` | New shared wrapper for dense merchant pages. |
| `PageHeader` | Compact single-row header with title, icon, and actions. Breadcrumbs, eyebrow labels, and descriptions now default off. |
| `PageHeaderActions` / `PageActions` | Centralized header action row for primary and secondary actions. |
| `PageContent` | New shared content wrapper for consistent page body spacing. |
| `DataTable` | Shopify-density rows: 46px row height and 40px header height. |
| `IndexTable` | Denser rows, filters, saved views, bulk actions, and empty/loading states. |
| `FilterBar` / `TableFilterBar` | Shared compact filter/search/chip/action surface for commerce lists. |
| `EmptyState` | Reusable theme-aware illustration architecture with module-specific motifs. |
| `Input`, `Textarea`, `Select`, `Combobox` | More compact form density through shared typography tokens. |

## Token Changes

| Token Area | Light Mode | Dark Mode |
|---|---|---|
| Sidebar surface | `#F1F2F4` | `#0F172A` |
| Content surface | `#F6F7F9` | `#111827` |
| Card surface | `#FFFFFF` | `#1F2937` |
| Page header height | `56px` | `56px` |
| Table header height | `40px` | `40px` |
| Table row height | `46px` | `46px` |
| Empty-state hover lift | `translateY(-4px)` | `translateY(-4px)` |

New shared aliases include:

- `--lb-sidebar-bg`
- `--lb-content-bg`
- `--lb-card-bg`
- `--lb-space-xs`
- `--lb-space-sm`
- `--lb-space-md`
- `--lb-space-lg`
- `--lb-space-xl`
- `--lb-size-table-row-height`
- `--lb-size-table-header-height`
- `--lb-size-table-toolbar-height`

## Screenshot Evidence

After-state Storybook architecture previews were captured at:

| Preview | Path |
|---|---|
| Compact merchant shell | `.tmp/screenshots/ux-reconstruction-v1/after/compact-merchant-shell.png` |
| Table density | `.tmp/screenshots/ux-reconstruction-v1/after/table-density.png` |
| Empty-state illustrations V2 | `.tmp/screenshots/ux-reconstruction-v1/after/empty-state-illustrations-v2.png` |
| Dashboard preview | `.tmp/screenshots/ux-reconstruction-v1/after/dashboard-preview.png` |
| Settings preview | `.tmp/screenshots/ux-reconstruction-v1/after/settings-preview.png` |
| Dark theme | `.tmp/screenshots/ux-reconstruction-v1/after/dark-theme.png` |

Authenticated runtime before/after screenshots were not captured in this wave because no live merchant session or seedable authenticated merchant state was available during verification. The captured screenshots validate the shared architecture in Storybook after state.

## Validation Results

| Command | Result | Notes |
|---|---|---|
| `pnpm --filter @letbuyy/ui typecheck` | Passed | Shared UI typecheck passed. |
| `pnpm --filter @letbuyy/ui build` | Passed | Shared UI build passed. |
| `pnpm --filter merchant-control-plane typecheck` | Passed | Merchant control plane typecheck passed. |
| `pnpm --filter @letbuyy/ui exec storybook build -o ../../../.tmp/storybook-ux-reconstruction` | Passed | Storybook build passed with a normal Vite chunk-size warning. |
| `pnpm typecheck` | Passed | Turbo summary: 57 successful, 57 total. |
| `pnpm build` | Passed | Initial sandbox run failed on Turbopack process restrictions; escalated rerun passed with 57 successful, 57 total. |
| `pnpm turbo typecheck` | Passed | Turbo summary: 57 successful, 57 total. |
| `pnpm turbo build` | Passed | Turbo summary: 57 successful, 57 total. |

## Remaining Issues

- Many merchant routes still pass legacy `breadcrumbs`, `eyebrow`, and `description` props. They are now hidden by shared defaults, but those route-level props should be deleted in a cleanup pass.
- Products, orders, customers, discounts, content, and analytics still contain some route-local filter/action rows. They should migrate to shared `FilterBar` or `TableFilterBar`.
- Route-level empty states should be updated to pass module-specific `kind` values so all major modules use the new illustration architecture.
- The Storybook screenshots are architecture previews. A later pass should capture authenticated desktop light/dark runtime screenshots for dashboard, products, collections, orders, customers, analytics, marketing, and settings.
- The current worktree contains earlier mission changes outside this wave; this report only documents the scoped UX reconstruction changes listed above.

## Future Recommendations

1. Migrate high-traffic merchant routes to the new `PageShell`, `PageContent`, and `PageHeaderActions` exports explicitly.
2. Delete legacy breadcrumb, section-label, and stacked-description props from merchant route code once product owners confirm the compact default.
3. Add a typed page metadata map for merchant modules so icons, labels, and optional legacy context are declared once.
4. Convert all commerce list filters to `TableFilterBar`.
5. Add a Storybook visual regression suite for compact shell, table density, empty states, and light/dark surface hierarchy.
6. Add authenticated Playwright visual coverage once stable merchant test data and session setup are available.

## Final Status

The shared UI architecture now supports a denser, more professional merchant experience without page-specific visual fixes. The next implementation wave should focus on deleting legacy route props and adopting the new primitives explicitly across the merchant route tree.
