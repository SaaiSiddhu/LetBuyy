# Frontend Rules

## General Rules

- Default to Next Server Components.
- Use client components only when state, event handlers, context, browser APIs, or interactive widgets require them.
- Avoid new inline React styles; prefer Tailwind and shared tokens.
- Use Lucide React icons for web buttons and controls.
- Every screen should include loading, empty, error, retry, focus, hover, active, and disabled states appropriate to the workflow.

## Surface-Specific UX

- Admin and internal tools must be dense, operational, and optimized for repeated work.
- Storefront must optimize for shopper flows, mobile responsiveness, product discovery, cart, checkout, customer account, and policies.
- Landing may be marketing-oriented but must not host auth pages except redirects.
- App and theme marketplaces need search, categories, detail pages, install/purchase paths, and trust signals.

## State Rules

- Merchant auth tokens never go in `localStorage`.
- `localStorage` is acceptable only for non-secret preferences, preview state, customer-safe wishlist/search state, or UI settings.
- Keep storefront customer state separate from merchant/admin state.

## Design System Rules

- Keep app-specific UI local until reused by two or more apps.
- Extract real shared primitives into `packages/typescript/ui`.
- Avoid one-off controls that recreate Button, Input, DataTable, modal, tabs, filters, or skeleton patterns.

## Verification

Frontend work should be verified with affected build/typecheck/lint and browser or emulator testing for the relevant user flow.
