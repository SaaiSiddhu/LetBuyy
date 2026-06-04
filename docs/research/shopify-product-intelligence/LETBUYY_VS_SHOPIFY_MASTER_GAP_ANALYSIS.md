# LetBuyy vs Shopify Master Gap Analysis

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
| Area | Shopify State | LetBuyy Gap | Priority | Complexity | ROI | Recommended Action |
|---|---|---|---|---|---|---|
| Navigation | Shopify exposes domain-specific child routes inline only after focus. | LetBuyy should avoid flattening every merchant feature into one sidebar. | P0 | Medium | High | Create a Shopify-class navigation IA with expandable product, customer, order, content, market, analytics, and settings groups. |
| Home readiness | Shopify home is an onboarding grid with visual task cards and direct CTAs. | LetBuyy needs a readiness cockpit with setup state rather than static dashboard cards. | P0 | Medium | High | Build a merchant home checklist from products, theme, payments, domain, shipping, policies, and plan state. |
| Save bar | Shopify uses global unsaved-state bars across forms and editors. | LetBuyy needs a shared save/discard pattern for merchant forms and builder screens. | P0 | Medium | High | Add a save bar component with dirty-state detection, disabled save, discard, and leave-page guard. |
| Settings architecture | Shopify settings is a complete operating-system map. | LetBuyy settings should be restructured into general, plan, billing, users, payments, checkout, customer accounts, shipping, taxes, domains, notifications, privacy, policies, apps, channels, custom data, languages. | P0 | High | Very high | Create settings IA and page templates before adding more merchant settings piecemeal. |
| Products | Shopify product form separates content, commerce, organization, channel publishing, variants, SEO. | LetBuyy product screens need the same two-column grammar and progressive sections. | P0 | High | High | Refactor product create/edit into structured cards with right rail status/publishing/organization. |
| Orders | Shopify preserves orders route while gating transactional readiness by plan. | LetBuyy should show order readiness and operational empty state instead of hiding missing capability. | P1 | Medium | High | Add order empty/gated states tied to payments, shipping, checkout, and plan readiness. |
| Inventory | Shopify separates inventory, transfers, purchase orders, and locations. | LetBuyy needs inventory operations beyond product quantity fields. | P1 | High | High | Add inventory ledger, locations, transfers, and procurement roadmap. |
| Customers | Shopify connects customers, segments, companies, consent, tax, and address. | LetBuyy customer CRM needs segmentation and B2B model readiness. | P1 | High | High | Add customer profile architecture with consent, address, tax, segments, and company hierarchy. |
| Marketing analytics | Shopify marketing blends attribution metrics, campaign tracking, and app discovery. | LetBuyy analytics should support growth-specific reports, not only store totals. | P2 | Medium | Medium | Add marketing workspace with attribution table and app-powered acquisition placeholders. |
| Theme system | Shopify theme management includes current/live status, theme library, action menu, and section editor. | LetBuyy builder should separate theme library from theme editor and support safe duplicate/publish flow. | P0 | Very high | Very high | Build theme library, editor shell, section tree, app blocks, draft/live state, rollback, and preview modes. |
| Apps | Shopify treats apps as extensions with marketplace, permissions, billing, and embedded navigation. | LetBuyy app ecosystem needs install/billing/permission architecture before broad app claims. | P1 | Very high | High | Define app manifest, OAuth install, scopes, billing, embedded app shell, and app review process. |
| Custom data | Shopify custom data covers resources and metaobjects with typed definitions. | LetBuyy needs typed metafields/metaobjects for extensibility. | P1 | High | High | Create typed custom data definitions with storefront/API exposure controls. |
| Privacy/policies | Shopify separates privacy controls, legal policies, marketing settings, and customer events. | LetBuyy must make compliance operational and region-aware. | P0 | High | High | Add privacy center, policy states, cookie banner controls, consent events, and marketing opt-in settings. |
| Design system | Shopify uses dense operational components, disabled states, empty states, banners, tables, modals, popovers. | LetBuyy needs stronger shared UI primitives and usage rules. | P0 | High | Very high | Expand shared UI package with merchant components and documented state variants. |

## Source Context Used

- `LETBUYY_MERCHANT_EXPERIENCE_AUDIT.md` for current merchant UX weaknesses and Shopify-inspired priorities.
- `docs/commerce-os-audit/03_SHOPIFY_COMPARATIVE_COMMERCE_ANALYSIS.md` for commerce operating model gaps.
- `docs/commerce-os-audit/07_ADMIN_PANEL_ENTERPRISE_UX_ANALYSIS.md` for admin productivity and enterprise UX gaps.
- Current repository governance and runtime map for LetBuyy app/package boundaries.
