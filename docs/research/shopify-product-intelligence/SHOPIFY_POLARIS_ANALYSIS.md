# Shopify Polaris Analysis

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Visual Token Observations

### Typography
- System sans typography, tight operational hierarchy, page H1 around compact admin scale, body copy readable but restrained.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Color
- Neutral grayscale foundations, black primary buttons, blue informational links/banners, red destructive confirmation, green status/avatar accents.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Spacing
- Dense but breathable spacing with 8 to 24 pixel rhythm, larger vertical gaps between cards, compact controls inside tables.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Radius
- Cards and controls use modest radius, generally under the large marketing-card style used in consumer pages.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Shadows
- Subtle elevation on cards, popovers, modals, and menus; no decorative glow or heavy visual treatment.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Borders
- Light borders define cards, inputs, tables, popovers, and modals; borders do most separation work.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Icons
- Every top-level nav item and modal choice has a small recognizable icon; icons support scanning rather than decoration.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

### Motion
- Progressive disclosure, menu/popover entrance, and loading skeletons communicate state without distracting from work.
- LetBuyy token guidance: encode this as a reusable admin theme token, not per-page styling.

## Component Pattern Catalog

### Top App Frame
- Purpose: Global orientation, search, AI assistant, alerts, account switching.
- Shopify usage: Every admin page; never competes with page content.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Left Sidebar
- Purpose: Durable information architecture and domain switching.
- Shopify usage: Persistent, icon plus label, inline expanded child routes.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Search and Command Surface
- Purpose: Cross-admin navigation and object discovery.
- Shopify usage: Search field exposes keyboard shortcut and category chips.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Breadcrumb Header
- Purpose: Task context and backtracking.
- Shopify usage: Create/edit pages and settings detail routes.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Save Bar
- Purpose: Unsaved-change protection.
- Shopify usage: Forms and editors with non-persistent local changes.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Primary Button
- Purpose: Highest-confidence next action.
- Shopify usage: Create, add, choose, activate, customize, explore.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Secondary Button
- Purpose: Safe alternate action.
- Shopify usage: Import, browse, learn more, duplicate, export.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Disabled Button
- Purpose: Clear gating and validation state.
- Shopify usage: Save, export, done, reset, next before requirements are met.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Card
- Purpose: Local grouping of related controls.
- Shopify usage: Settings, forms, metrics, onboarding tasks, empty states.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Data Table
- Purpose: Operational scanning and bulk work.
- Shopify usage: Collections, segments, users, roles, taxes, reports.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Views and Filters
- Purpose: Saved operational context.
- Shopify usage: All view, search/filter, sort, display options.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Metric Card
- Purpose: KPI discovery and report drill-through.
- Shopify usage: Analytics and marketing dashboards.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Inline Chart
- Purpose: Fast trend comprehension.
- Shopify usage: Analytics and marketing metric cards.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Rich Text Editor
- Purpose: Structured content input.
- Shopify usage: Product description and content surfaces.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Media Dropzone
- Purpose: Asset ingestion without page change.
- Shopify usage: Products and theme/editor flows.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Combobox
- Purpose: Large-option selection.
- Shopify usage: Product category, supplier, customer, market, country, language.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Popover Menu
- Purpose: Low-risk contextual actions.
- Shopify usage: More actions, manual payments, theme actions, table row actions.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Modal Dialog
- Purpose: Short focused task or decision.
- Shopify usage: Discount type selector, supplier creation, domain connection.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Drawer/Panel
- Purpose: Contextual configuration without full navigation.
- Shopify usage: Theme editor side panels and settings detail flyouts.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Banner
- Purpose: Important but dismissible guidance.
- Shopify usage: B2B app behavior, domain credits, tax/payment/legal warnings.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Empty State
- Purpose: Teach, reassure, and start the workflow.
- Shopify usage: Orders, products, customers, discounts, gift cards, apps.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Skeleton/Loading
- Purpose: Preserve perceived speed.
- Shopify usage: Theme editor and embedded app loads.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Toast/Inline Status
- Purpose: Micro-feedback after actions.
- Shopify usage: Save, publish, copy, install, delete; final actions not executed in research.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Badge
- Purpose: Compact state annotation.
- Shopify usage: Primary domain, connected, active, published, default, live.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Toggle
- Purpose: Binary configuration with immediate comprehension.
- Shopify usage: Gift card expiry, sign-in links, returns, store credit, local delivery.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Radio Group
- Purpose: Mutually exclusive business logic.
- Shopify usage: Order processing, capture method, checkout submission.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Checkbox
- Purpose: Optional policy or eligibility.
- Shopify usage: Marketing consent, tax inclusion, shipping address options.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Date Picker
- Purpose: Temporal business settings.
- Shopify usage: Gift card expiry and purchase order arrival.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### Stepper/Process Row
- Purpose: Multi-location inventory movement.
- Shopify usage: Transfer origin, in-transit, destination.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.

### External App CTA
- Purpose: Extend native capability without bloating core.
- Shopify usage: Marketing apps, pixel apps, translate app, sourcing apps.
- Variants: default, hover, focus-visible, active, disabled, loading, empty, error, success where applicable.
- Accessibility rule: expose semantic role, clear accessible name, keyboard reachability, and visible focus state.
- Consistency rule: one component should solve the pattern across merchant surfaces.
