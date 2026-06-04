# Shopify Gap Analysis

Generated: 2026-06-03

Scoring scale: 1 means rough scaffold, 10 means premium commerce-admin polish.

| Page | Current LetBuyy Score | Target Score | Missing Hierarchy | Missing Illustration | Missing Spacing | Missing Interaction | Missing Polish |
|---|---:|---:|---|---|---|---|---|
| Dashboard | 7 | 9 | Improved with setup hero, progress, and tokenized card hierarchy. | Empty/recent activity now supports illustrated state. | Remaining page-local spacing should be audited route by route. | Subtle shared button motion added. | Needs live dashboard screenshot review after authenticated data is available. |
| Products | 6 | 9 | Shared table/card tokens improved preview path. | Products empty-state pack added in shared UI. | Product route local spacing still needs page-level audit. | Shared buttons improved. | Needs route-specific product empty-state adoption. |
| Collections | 5 | 8 | Shared card hierarchy improved documentation. | Collections pack added. | Collections route local spacing not fully migrated. | Shared controls improved indirectly. | Needs route-specific collection empty-state adoption. |
| Orders | 6 | 9 | Shared table and card tokens improved. | Orders pack added and dashboard recent activity uses it. | Route local spacing still needs audit. | Shared CTAs improved. | Needs order-list empty state adoption. |
| Customers | 5 | 8 | Shared hierarchy documented. | Customers pack added. | Route local spacing not fully migrated. | Shared controls improved indirectly. | Needs customer-list empty state adoption. |
| Discounts | 5 | 8 | Shared hierarchy documented. | Discounts pack added. | Discount route local spacing not fully migrated. | Shared controls improved indirectly. | Needs discount empty-state adoption. |
| Analytics | 6 | 9 | Dashboard preview now shows stronger card/metric hierarchy. | Analytics pack added. | Analytics local cards need route audit. | Shared button motion added. | Needs analytics-specific loading/empty states. |
| Settings | 7 | 9 | Storybook settings preview and shared input/card tokens improved. | Domains/payments/theme packs added. | Settings route CSS still has legacy local spacing. | Shared controls improved indirectly. | Needs per-settings-page spacing pass. |

## Highest-Impact Remaining Gaps

1. Adopt the shared `EmptyState` packs on every merchant list view.
2. Move route-local merchant CSS spacing to the official 4-64 scale in smaller batches.
3. Replace any local card shells with shared `Card` and `Section` where ownership permits.
4. Capture authenticated merchant route screenshots once test credentials/local data are available.

## Verdict

The design-system foundation is now closer to Shopify-class hierarchy. The largest remaining gap is adoption breadth across individual merchant pages, not the central token system.
