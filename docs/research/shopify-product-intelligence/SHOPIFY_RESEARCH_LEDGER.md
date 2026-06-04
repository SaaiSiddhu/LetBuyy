# Shopify Product Intelligence Research Ledger

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Evidence Rules

- No Save/Create/Install/Publish/Subscribe/Pay/Confirm final action was executed.
- Dummy exploration was limited to navigation, safe menus, modals, date pickers, filters, and forms without persistence.
- Sensitive values are represented as `[store]`, `[user]`, `[email]`, `[domain]`, `[customer]`, or `[redacted]`.
- DOM JavaScript extraction was not required; accessibility tree and screenshots were sufficient. If future runs use JS extraction, keep it read-only and non-mutating.

## Redacted Screenshot Manifest

- Home onboarding grid: `assets/screenshots/onboarding/home-onboarding-redacted.png`
- Account menu and store switcher: `assets/screenshots/onboarding/account-menu-redacted.png`
- Add product form: `assets/screenshots/products/product-add-form-redacted.png`
- Products empty state: `assets/screenshots/products/products-empty-state-redacted.png`
- Collections table: `assets/screenshots/products/collections-table-redacted.png`
- Inventory empty state: `assets/screenshots/products/inventory-empty-state-redacted.png`
- Create purchase order: `assets/screenshots/commerce/purchase-order-create-redacted.png`
- Create supplier modal: `assets/screenshots/commerce/supplier-modal-redacted.png`
- Create transfer: `assets/screenshots/commerce/transfer-create-redacted.png`
- Gift cards empty state: `assets/screenshots/commerce/gift-cards-empty-state-redacted.png`
- Create gift card: `assets/screenshots/commerce/gift-card-create-redacted.png`
- Gift card expiry picker: `assets/screenshots/commerce/gift-card-expiry-picker-redacted.png`
- Customers empty state: `assets/screenshots/customers/customers-empty-state-redacted.png`
- New customer form: `assets/screenshots/customers/new-customer-redacted.png`
- Segments table: `assets/screenshots/customers/segments-table-redacted.png`
- Companies empty state: `assets/screenshots/customers/companies-empty-state-redacted.png`
- New company form: `assets/screenshots/customers/new-company-redacted.png`
- Discounts empty state: `assets/screenshots/commerce/discounts-empty-state-redacted.png`
- Discount type modal: `assets/screenshots/commerce/discount-type-modal-redacted.png`

## Route Coverage Ledger

| Page | Route | Status | Evidence | Notes |
|---|---|---|---|---|
| Home | `/` | Observed via redacted screenshot | redacted screenshot | Onboarding dashboard and next-best-action launchpad. |
| Orders | `/orders` | Observed authenticated, gated by plan | authenticated accessibility tree | Order operations and fulfillment queue. |
| Draft Orders | `/draft_orders` | Route discovered through sidebar | route discovery | Manual order creation and invoice workflow. |
| Abandoned Checkouts | `/checkouts` | Route discovered through sidebar | route discovery | Recovery queue for incomplete checkout sessions. |
| Products | `/products` | Observed via screenshot | redacted screenshot | Catalog creation and product management. |
| Add Product | `/products/new` | Observed via screenshot | redacted screenshot | Create or edit a product with inventory, publishing, pricing, variants, SEO, and organization. |
| Collections | `/products/collections` | Observed via screenshot | redacted screenshot | Group products manually or by conditions for merchandising. |
| Inventory | `/products/inventory` | Observed via screenshot | redacted screenshot | Search and adjust stock availability across products and locations. |
| Purchase Orders | `/products/purchase_orders` | Observed via screenshot | redacted screenshot | Track ordered inventory from suppliers before receipt. |
| Create Purchase Order | `/products/purchase_orders/new` | Observed via screenshot and modal | redacted screenshot | Create a draft procurement document with supplier, destination, shipment, products, and cost summary. |
| Transfers | `/products/transfers` | Observed via screenshot | redacted screenshot | Move inventory between locations with origin, in-transit, destination, references, notes, and tags. |
| Gift Cards | `/products/gift_cards` | Observed via screenshot | redacted screenshot | Create sellable gift card products or issue customer gift cards. |
| Create Gift Card | `/products/gift_cards/new` | Observed via screenshot | redacted screenshot | Issue a gift card code with value, expiry, customer, and notes. |
| Customers | `/customers` | Observed via screenshot | redacted screenshot | Customer records, order history, segmentation, and acquisition via apps. |
| New Customer | `/customers/new` | Observed via screenshot | redacted screenshot | Create customer profile with contact, language, marketing consent, address, tax, notes, and tags. |
| Segments | `/customers/segments` | Observed via screenshot | redacted screenshot | Saved customer cohorts for analysis and marketing. |
| Companies | `/customers/companies` | Observed via screenshot | redacted screenshot | B2B customer accounts with company locations, payment terms, catalogs, permissions, and checkout rules. |
| New Company | `/customers/companies/new` | Observed via screenshot | redacted screenshot | Configure B2B account, contact, location, markets, catalogs, payment terms, checkout behavior, and tax. |
| Marketing | `/marketing` | Observed authenticated | authenticated accessibility tree | Marketing performance overview and acquisition workflow entry. |
| Marketing Campaigns | `/marketing/campaigns` | Observed authenticated | authenticated accessibility tree | Create and track marketing campaigns across online/offline touchpoints. |
| Marketing Attribution | `/marketing/reports/channels` | Observed authenticated | authenticated accessibility tree | Attribution model and channel performance report. |
| Discounts | `/discounts` | Observed via screenshot | redacted screenshot | Create and manage codes and automatic discounts. |
| Discount Type Selector | `/discounts/new` | Observed via screenshot modal | redacted screenshot | Choose discount model before entering discount business logic. |
| Content Metaobjects | `/content/metaobjects` | Observed authenticated | authenticated accessibility tree | Structured content definitions used by storefront/theme experiences. |
| Files | `/content/files` | Route discovered through content subnav | route discovery | Asset library for uploaded media and documents. |
| Menus | `/content/menus` | Route discovered through content subnav | route discovery | Storefront navigation menu management. |
| Blog Posts | `/content/articles` | Route discovered through content subnav | route discovery | Editorial content management for storefront blogs. |
| Markets | `/markets` | Observed authenticated | authenticated accessibility tree | International and regional selling configuration. |
| Catalogs | `/markets/catalogs` | Route discovered through markets subnav | route discovery | Market-specific or B2B-specific product catalogs. |
| Rollouts | `/markets/rollouts` | Route discovered through markets subnav | route discovery | Controlled rollout of market changes. |
| Analytics | `/analytics` | Observed authenticated | authenticated accessibility tree | Business reporting dashboard with metric cards and drill-through reports. |
| Reports | `/analytics/reports` | Route discovered through analytics subnav and card links | route discovery | Browse saved and standard reports. |
| Live View | `/analytics/live` | Route discovered through analytics subnav | route discovery | Real-time storefront traffic and conversion monitoring. |
| Online Store Themes | `/themes` | Observed authenticated | authenticated accessibility tree | Manage current theme, theme library, previews, password protection, and theme discovery. |
| Theme Editor | `/themes/[theme_id]/editor` | Observed authenticated, no save performed | authenticated accessibility tree | Customize storefront sections, blocks, settings, app embeds, responsive preview, and publishing state. |
| Apps Add | `/apps` | Observed via settings and sidebar links, external app store not installed | route discovery | Entry into app marketplace and installed app management. |
| Agentic Sales Channel | `/apps/agentic` | Route discovered through sidebar | route discovery | AI or agentic sales channel surface inside admin. |
| Settings - Settings Root | `/settings` | Observed authenticated | authenticated accessibility tree | Central configuration hub across store, billing, users, commerce, channels, apps, legal, and data. |
| Settings - General | `/settings/general` | Observed authenticated | authenticated accessibility tree | Store identity, contact, defaults, order processing, order ID format, assets, and transfer controls. |
| Settings - Plan | `/settings/plan` | Observed authenticated | authenticated accessibility tree | Trial, subscription plan, plan selection, cancellation, and linked subscriptions. |
| Settings - Billing | `/settings/billing` | Observed authenticated | authenticated accessibility tree | Billing profile, upcoming bill, payment method, invoices, plan settings, and country-specific requirements. |
| Settings - Users | `/settings/organization-account` | Observed authenticated | authenticated accessibility tree | Invite users, list staff, manage roles and two-step authentication. |
| Settings - Roles | `/settings/roles` | Observed authenticated | authenticated accessibility tree | Default and custom role management across organization, store, and POS scopes. |
| Settings - Security | `/settings/security` | Observed authenticated | authenticated accessibility tree | User activity logs, collaborators, collaborator code, and account security operations. |
| Settings - Payments | `/settings/payments` | Observed authenticated | authenticated accessibility tree | Payment providers, PayPal/digital wallet setup, capture method, manual payments, customizations, and gift card expiry. |
| Settings - Checkout | `/settings/checkout` | Observed authenticated | authenticated accessibility tree | Checkout configuration, customer contact, customer information, marketing opt-in, subscriptions disclaimer, tipping, language, address collection, and rules. |
| Settings - Customer Accounts | `/settings/customer_accounts` | Observed authenticated | authenticated accessibility tree | Sign-in links, account configuration, authentication methods, returns, store credit, and customer-account URL. |
| Settings - Shipping and Delivery | `/settings/shipping` | Observed authenticated | authenticated accessibility tree | Shipping profiles, delivery dates, packages, shipping labels, carrier accounts, local delivery, pickup, packing slips, and fulfillment services. |
| Settings - Taxes and Duties | `/settings/taxes` | Observed authenticated | authenticated accessibility tree | Regional sales tax, tax services, duties/import taxes, customs, and global tax settings. |
| Settings - Locations | `/settings/locations` | Observed authenticated | authenticated accessibility tree | Manage fulfillment/store locations and POS subscriptions. |
| Settings - Apps Settings | `/settings/apps` | Observed authenticated | authenticated accessibility tree | Installed apps, app discovery, and developer app entry. |
| Settings - Sales Channels | `/settings/sales_channels` | Observed authenticated | authenticated accessibility tree | Installed sales channels and marketplace for channels. |
| Settings - Domains | `/settings/domains` | Observed authenticated | authenticated accessibility tree | Manage myshopify domain, custom domains, connection, transfer, purchase, primary domain, status, and DNS actions. |
| Settings - Customer Events | `/settings/customer_events` | Observed authenticated | authenticated accessibility tree | Pixels and customer-event tracking via app pixels and custom pixels. |
| Settings - Notifications | `/settings/notifications` | Observed authenticated | authenticated accessibility tree | Sender email, customer/staff/fulfillment/webhook notification templates and delivery configuration. |
| Settings - Customer Notification Templates | `/settings/notifications/customer` | Observed authenticated drill-down | authenticated accessibility tree | Customize customer email/SMS templates by lifecycle stage. |
| Settings - Metafields and Metaobjects | `/settings/custom_data` | Observed authenticated | authenticated accessibility tree | Define custom data models for products, variants, customers, orders, markets, shops, and structured content. |
| Settings - Languages | `/settings/languages` | Observed authenticated | authenticated accessibility tree | Published languages, domains, default language, and translation app recommendations. |
| Settings - Customer Privacy | `/settings/privacy` | Observed authenticated | authenticated accessibility tree | Privacy policy, cookie banner, data sharing opt-out, network intelligence, marketing settings, and data storage location. |
| Settings - Policies | `/settings/legal` | Observed authenticated | authenticated accessibility tree | Return rules and written policies for refund, privacy, terms, shipping, contact, and legal notices. |

## Gated Or Deliberately Skipped Areas

- Plan subscription final selection: Final subscribe/pay action is persistent and was not clicked.
- Payment provider activation: Provider onboarding can alter account state and was stopped at provider-selection entry.
- App install: Install/OAuth approval/billing was not executed.
- Theme publish/save: Theme editor was observed without saving or publishing.
- Domain connection next step: Domain modal was opened without submitting DNS/domain ownership changes.
- Create customer/product/company/gift card/order/discount final save: Forms and modals were inspected but final creation was not executed.
- Private merchant records: No customer records, order records, addresses, or private business data were collected.
