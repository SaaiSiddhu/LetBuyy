# LetBuyy Empty State System

Generated: 2026-06-03

Purpose: replace icon-only empty states with a consistent illustration-driven system while preserving existing component props.

## Shared Component

Source: `packages/typescript/ui/src/feedback.tsx`

Public API:

- `kind`
- `illustration`
- `icon`
- `title`
- `body`
- `primaryAction`
- `secondaryAction`

Existing `icon` usage remains compatible. When no custom illustration is passed, the shared component renders a tokenized illustration frame.

## Required Packs

| Kind | Intended Routes |
|---|---|
| `products` | Product lists and product import |
| `collections` | Collections and smart collections |
| `inventory` | Inventory and stock views |
| `orders` | Orders and recent activity |
| `customers` | Customer CRM views |
| `discounts` | Coupons and discounts |
| `domains` | Domains and DNS setup |
| `themes` | Theme marketplace/editor states |
| `analytics` | Analytics, reports, campaign data |
| `apps` | App marketplace and installed apps |
| `payments` | Payment setup and billing |

## Visual Rules

- Illustration uses tokenized brand accent only.
- Title uses `--lb-component-empty-state-title`.
- Body uses `--lb-component-empty-state-body`.
- Background uses `--lb-component-empty-state-bg`.
- Border uses `--lb-component-empty-state-border`.
- Hover motion is limited to `translateY(-2px)`.

## Storybook

Story: `Design Tokens / Empty State System`

Screenshot: `.tmp/screenshots/ui-polish-wave/after/empty-states.png`

## Remaining Adoption Work

The shared component is ready. Individual merchant routes should adopt the correct `kind` during page-specific follow-up passes so list views stop rendering generic empty states.
