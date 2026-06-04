# Shopify Platform Map

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Complete Navigation Tree

### Home
- Home - `/`

### Orders
- Orders - `/orders`
- Drafts
- Abandoned checkouts

### Products
- Products - `/products`
- Collections - `/products/collections`
- Inventory - `/products/inventory`
- Purchase orders
- Transfers - `/products/transfers`
- Gift cards

### Customers
- Customers - `/customers`
- Segments - `/customers/segments`
- Companies - `/customers/companies`

### Marketing
- Marketing - `/marketing`
- Campaigns
- Attribution

### Discounts
- Discounts - `/discounts`

### Content
- Metaobjects
- Files - `/content/files`
- Menus - `/content/menus`
- Blog posts

### Markets
- Markets - `/markets`
- Catalogs - `/markets/catalogs`
- Rollouts - `/markets/rollouts`

### Analytics
- Analytics - `/analytics`
- Reports - `/analytics/reports`
- Live View - `/analytics/live`

### Sales channels
- Online Store
- Agentic

### Apps
- Add

### Settings
- Settings Root - `/settings`
- General - `/settings/general`
- Plan - `/settings/plan`
- Billing - `/settings/billing`
- Users - `/settings/organization-account`
- Roles - `/settings/roles`
- Security - `/settings/security`
- Payments - `/settings/payments`
- Checkout - `/settings/checkout`
- Customer Accounts - `/settings/customer_accounts`
- Shipping and Delivery - `/settings/shipping`
- Taxes and Duties - `/settings/taxes`
- Locations - `/settings/locations`
- Apps Settings - `/settings/apps`
- Sales Channels - `/settings/sales_channels`
- Domains - `/settings/domains`
- Customer Events - `/settings/customer_events`
- Notifications - `/settings/notifications`
- Customer Notification Templates - `/settings/notifications/customer`
- Metafields and Metaobjects - `/settings/custom_data`
- Languages - `/settings/languages`
- Customer Privacy - `/settings/privacy`
- Policies - `/settings/legal`

## Route Inventory

| Page | Route | Purpose | Primary User | Frequency | Parent Navigation | Primary CTA | Access Status | LetBuyy Equivalent |
|---|---|---|---|---|---|---|---|---|
| Home | `/` | Onboarding dashboard and next-best-action launchpad. | Store owner or operator | Daily during setup, weekly after launch | Home | Add product / choose theme / activate payments depending on task card | Observed via redacted screenshot | Merchant home should be a readiness cockpit, not a generic dashboard. |
| Orders | `/orders` | Order operations and fulfillment queue. | Merchant operator | High after launch | Orders | Select plan when gated; otherwise operational order actions | Observed authenticated, gated by plan | Orders should expose plan-gated readiness while preserving the route and education. |
| Draft Orders | `/draft_orders` | Manual order creation and invoice workflow. | Merchant support and sales | Medium | Orders > Drafts | Create draft order when available | Route discovered through sidebar | Needed for assisted selling, B2B quotes, custom invoices, and payment links. |
| Abandoned Checkouts | `/checkouts` | Recovery queue for incomplete checkout sessions. | Growth operator | Medium | Orders > Abandoned checkouts | Review or recover checkout where data exists | Route discovered through sidebar | Treat abandoned checkout as a growth workflow tied to notifications and campaigns. |
| Products | `/products` | Catalog creation and product management. | Merchant catalog operator | High | Products | Add product | Observed via screenshot | Catalog should blend create/import/source flows in one readiness page. |
| Add Product | `/products/new` | Create or edit a product with inventory, publishing, pricing, variants, SEO, and organization. | Catalog operator | High | Products > Add product | Save when valid | Observed via screenshot | Product forms need a two-column operational grammar and durable save bar. |
| Collections | `/products/collections` | Group products manually or by conditions for merchandising. | Merchandiser | Medium | Products > Collections | Add collection | Observed via screenshot | Collections must support both storefront merchandising and operational filters. |
| Inventory | `/products/inventory` | Search and adjust stock availability across products and locations. | Inventory operator | High for stock-based merchants | Products > Inventory | Clear search and filters when empty; import/export in header | Observed via screenshot | Inventory should be a first-class table separate from product editing. |
| Purchase Orders | `/products/purchase_orders` | Track ordered inventory from suppliers before receipt. | Inventory and procurement operator | Medium | Products > Purchase orders | Create purchase order | Observed via screenshot | Procurement is an advanced but important inventory confidence feature. |
| Create Purchase Order | `/products/purchase_orders/new` | Create a draft procurement document with supplier, destination, shipment, products, and cost summary. | Inventory and procurement operator | Medium | Products > Purchase orders > Create | Save as draft, not executed | Observed via screenshot and modal | Separate receiving/procurement from selling inventory; compute costs live. |
| Transfers | `/products/transfers` | Move inventory between locations with origin, in-transit, destination, references, notes, and tags. | Inventory operator | Medium | Products > Transfers | Save when valid, not executed | Observed via screenshot | Location-aware inventory movement needs a dedicated, guided workflow. |
| Gift Cards | `/products/gift_cards` | Create sellable gift card products or issue customer gift cards. | Merchant support and merchandising | Low to medium | Products > Gift cards | Add gift card product | Observed via screenshot | Gift cards combine product, liability, customer, and legal workflows. |
| Create Gift Card | `/products/gift_cards/new` | Issue a gift card code with value, expiry, customer, and notes. | Support operator | Low to medium | Products > Gift cards > Create | Save when valid, not executed | Observed via screenshot | Gift card issuance must make expiry and legal constraints explicit. |
| Customers | `/customers` | Customer records, order history, segmentation, and acquisition via apps. | Support and growth operator | High after launch | Customers | Add customer | Observed via screenshot | Customer CRM needs a neutral operational surface with import and segmentation built in. |
| New Customer | `/customers/new` | Create customer profile with contact, language, marketing consent, address, tax, notes, and tags. | Support operator | Medium | Customers > Add customer | Save when valid, not executed | Observed via screenshot | Consent and contact availability should drive disabled states and validation. |
| Segments | `/customers/segments` | Saved customer cohorts for analysis and marketing. | Growth operator | Medium | Customers > Segments | Create segment | Observed via screenshot | Segments should be native query objects, not static tags. |
| Companies | `/customers/companies` | B2B customer accounts with company locations, payment terms, catalogs, permissions, and checkout rules. | B2B merchant operator | Medium for B2B merchants | Customers > Companies | Add company | Observed via screenshot | B2B must be treated as account hierarchy, not just customer tags. |
| New Company | `/customers/companies/new` | Configure B2B account, contact, location, markets, catalogs, payment terms, checkout behavior, and tax. | B2B operator | Medium | Customers > Companies > Add company | Save when valid, not executed | Observed via screenshot | B2B create should expose dependencies gradually but all in one reviewable form. |
| Marketing | `/marketing` | Marketing performance overview and acquisition workflow entry. | Growth operator | Weekly | Marketing | Create campaign | Observed authenticated | Marketing should connect attribution, campaigns, and app extension in one workspace. |
| Marketing Campaigns | `/marketing/campaigns` | Create and track marketing campaigns across online/offline touchpoints. | Growth operator | Weekly | Marketing > Campaigns | Create campaign, not executed | Observed authenticated | Campaign tracking can begin as a readiness and attribution shell before automation exists. |
| Marketing Attribution | `/marketing/reports/channels` | Attribution model and channel performance report. | Growth operator | Weekly | Marketing > Attribution | View report | Observed authenticated | Attribution should reuse analytics primitives but remain domain-labeled for marketers. |
| Discounts | `/discounts` | Create and manage codes and automatic discounts. | Merchant growth/operator | Medium | Discounts | Create discount | Observed via screenshot | Discounts need clear taxonomy before asking for conditions. |
| Discount Type Selector | `/discounts/new` | Choose discount model before entering discount business logic. | Growth operator | Medium | Discounts > Create discount | Choose one of four discount types, not selected | Observed via screenshot modal | Start discount creation with a decision modal to prevent bloated forms. |
| Content Metaobjects | `/content/metaobjects` | Structured content definitions used by storefront/theme experiences. | Content manager and developer-minded merchant | Low to medium | Content > Metaobjects | Add definition via settings custom data | Observed authenticated | CMS custom data should connect content authoring with schema governance. |
| Files | `/content/files` | Asset library for uploaded media and documents. | Content manager | Medium | Content > Files | Upload files where available | Route discovered through content subnav | Media library should be global, searchable, and reusable across products/content/themes. |
| Menus | `/content/menus` | Storefront navigation menu management. | Storefront manager | Medium | Content > Menus | Create or edit menus | Route discovered through content subnav | Navigation is content, not theme-only configuration. |
| Blog Posts | `/content/articles` | Editorial content management for storefront blogs. | Content marketer | Medium | Content > Blog posts | Create blog post where available | Route discovered through content subnav | Blog content should use the same save bar and publishing grammar as products/pages. |
| Markets | `/markets` | International and regional selling configuration. | Store owner, operations lead | Medium | Markets | Create market | Observed authenticated | Markets should be a top-level commerce operating model for currency/tax/shipping/catalogs. |
| Catalogs | `/markets/catalogs` | Market-specific or B2B-specific product catalogs. | Merchandiser or B2B operator | Medium | Markets > Catalogs | Create catalog where available | Route discovered through markets subnav | Catalogs are the bridge between products, markets, and B2B companies. |
| Rollouts | `/markets/rollouts` | Controlled rollout of market changes. | Operations lead | Low | Markets > Rollouts | Create or manage rollout where available | Route discovered through markets subnav | Advanced market changes need staged rollout and rollback language. |
| Analytics | `/analytics` | Business reporting dashboard with metric cards and drill-through reports. | Owner, analyst, operator | Daily to weekly | Analytics | New exploration | Observed authenticated | Analytics should be drill-through from every metric, not static charts. |
| Reports | `/analytics/reports` | Browse saved and standard reports. | Analyst/operator | Weekly | Analytics > Reports | Explore or open report | Route discovered through analytics subnav and card links | Reports should be first-class query artifacts with explainable source metrics. |
| Live View | `/analytics/live` | Real-time storefront traffic and conversion monitoring. | Owner/operator | Occasional | Analytics > Live View | Monitor live activity | Route discovered through analytics subnav | Live view is valuable as trust theater and launch monitoring, even with sparse data. |
| Online Store Themes | `/themes` | Manage current theme, theme library, previews, password protection, and theme discovery. | Storefront manager | Medium | Sales channels > Online Store | Edit theme | Observed authenticated | Theme management needs library, current/live state, safe duplicate, and edit entry. |
| Theme Editor | `/themes/[theme_id]/editor` | Customize storefront sections, blocks, settings, app embeds, responsive preview, and publishing state. | Storefront designer/merchant | Medium | Online Store > Themes > Edit theme | Save when changes exist, not executed | Observed authenticated, no save performed | Builder must support section tree plus live preview, not a form-only settings page. |
| Apps Add | `/apps` | Entry into app marketplace and installed app management. | Merchant owner/operator | Low to medium | Apps > Add | Explore apps | Observed via settings and sidebar links, external app store not installed | App ecosystem should start with discovery categories and permission transparency. |
| Agentic Sales Channel | `/apps/agentic` | AI or agentic sales channel surface inside admin. | Merchant experimenting with new sales channels | Low | Sales channels > Agentic | Configure channel where available | Route discovered through sidebar | Sales channels and apps should share embedding rules but differ in IA placement. |
| Settings - Settings Root | `/settings` | Central configuration hub across store, billing, users, commerce, channels, apps, legal, and data. | Store owner or administrator | Setup and periodic maintenance | Settings | settings search | Observed authenticated | LetBuyy settings should become a real architecture, not scattered account/store pages. |
| Settings - General | `/settings/general` | Store identity, contact, defaults, order processing, order ID format, assets, and transfer controls. | Store owner or administrator | Setup and periodic maintenance | Settings | Business details | Observed authenticated | Split General into store identity, operational defaults, order processing, and ownership controls with a single page overview. |
| Settings - Plan | `/settings/plan` | Trial, subscription plan, plan selection, cancellation, and linked subscriptions. | Store owner or administrator | Setup and periodic maintenance | Settings | Trial status | Observed authenticated | Show entitlement effects across checkout, orders, domains, analytics, and channels before plan selection. |
| Settings - Billing | `/settings/billing` | Billing profile, upcoming bill, payment method, invoices, plan settings, and country-specific requirements. | Store owner or administrator | Setup and periodic maintenance | Settings | Billing profile | Observed authenticated | Billing should combine current bill, payment methods, invoice history, and compliance warnings. |
| Settings - Users | `/settings/organization-account` | Invite users, list staff, manage roles and two-step authentication. | Store owner or administrator | Setup and periodic maintenance | Settings | Users table | Observed authenticated | LetBuyy needs role-aware staff list with MFA status and audit-ready owner visibility. |
| Settings - Roles | `/settings/roles` | Default and custom role management across organization, store, and POS scopes. | Store owner or administrator | Setup and periodic maintenance | Settings | Role table | Observed authenticated | Roles require scope, default templates, non-editable system roles, and clear permission inheritance. |
| Settings - Security | `/settings/security` | User activity logs, collaborators, collaborator code, and account security operations. | Store owner or administrator | Setup and periodic maintenance | Settings | User activity logs | Observed authenticated | Expose collaborator access as a governed security workflow with audit trail and code rotation. |
| Settings - Payments | `/settings/payments` | Payment providers, PayPal/digital wallet setup, capture method, manual payments, customizations, and gift card expiry. | Store owner or administrator | Setup and periodic maintenance | Settings | Provider setup | Observed authenticated | Payment settings should isolate provider onboarding, capture policy, manual methods, and legal gift-card rules. |
| Settings - Checkout | `/settings/checkout` | Checkout configuration, customer contact, customer information, marketing opt-in, subscriptions disclaimer, tipping, language, address collection, and rules. | Store owner or administrator | Setup and periodic maintenance | Settings | Checkout configuration card | Observed authenticated | Checkout needs staged sections with risk-aware copy and app-powered extension points. |
| Settings - Customer Accounts | `/settings/customer_accounts` | Sign-in links, account configuration, authentication methods, returns, store credit, and customer-account URL. | Store owner or administrator | Setup and periodic maintenance | Settings | Sign-in links toggle | Observed authenticated | Customer account should be a product surface, not just auth toggles. |
| Settings - Shipping and Delivery | `/settings/shipping` | Shipping profiles, delivery dates, packages, shipping labels, carrier accounts, local delivery, pickup, packing slips, and fulfillment services. | Store owner or administrator | Setup and periodic maintenance | Settings | General profile | Observed authenticated | Shipping settings must connect profiles, locations, packages, carrier accounts, and local methods. |
| Settings - Taxes and Duties | `/settings/taxes` | Regional sales tax, tax services, duties/import taxes, customs, and global tax settings. | Store owner or administrator | Setup and periodic maintenance | Settings | Tax service status | Observed authenticated | Taxes should be a guided compliance cockpit with region state, product metadata dependencies, and global toggles. |
| Settings - Locations | `/settings/locations` | Manage fulfillment/store locations and POS subscriptions. | Store owner or administrator | Setup and periodic maintenance | Settings | Locations usage count | Observed authenticated | Locations should power inventory, shipping, pickup, POS, and transfer logic everywhere. |
| Settings - Apps Settings | `/settings/apps` | Installed apps, app discovery, and developer app entry. | Store owner or administrator | Setup and periodic maintenance | Settings | Develop apps | Observed authenticated | Make app management permission- and billing-aware from day one. |
| Settings - Sales Channels | `/settings/sales_channels` | Installed sales channels and marketplace for channels. | Store owner or administrator | Setup and periodic maintenance | Settings | Installed channel list | Observed authenticated | Channels should be distinct from apps because they alter where products can sell. |
| Settings - Domains | `/settings/domains` | Manage myshopify domain, custom domains, connection, transfer, purchase, primary domain, status, and DNS actions. | Store owner or administrator | Setup and periodic maintenance | Settings | Connect existing domain | Observed authenticated | Domains need verification steps, takeover prevention, SSL status, and primary-domain promotion. |
| Settings - Customer Events | `/settings/customer_events` | Pixels and customer-event tracking via app pixels and custom pixels. | Store owner or administrator | Setup and periodic maintenance | Settings | App pixels tab | Observed authenticated | Pixel management belongs near privacy and analytics, with app pixels preferred over custom code. |
| Settings - Notifications | `/settings/notifications` | Sender email, customer/staff/fulfillment/webhook notification templates and delivery configuration. | Store owner or administrator | Setup and periodic maintenance | Settings | Sender email warning | Observed authenticated | Notifications should be event-template driven, localized, and tied to order/customer states. |
| Settings - Customer Notification Templates | `/settings/notifications/customer` | Customize customer email/SMS templates by lifecycle stage. | Store owner or administrator | Setup and periodic maintenance | Settings | Customize email templates | Observed authenticated drill-down | Use categories and toggles to keep notification complexity navigable. |
| Settings - Metafields and Metaobjects | `/settings/custom_data` | Define custom data models for products, variants, customers, orders, markets, shops, and structured content. | Store owner or administrator | Setup and periodic maintenance | Settings | Metafield resources | Observed authenticated | Custom data should be schema-first, typed, and reusable across admin, storefront, and apps. |
| Settings - Languages | `/settings/languages` | Published languages, domains, default language, and translation app recommendations. | Store owner or administrator | Setup and periodic maintenance | Settings | Add language | Observed authenticated | Language management should combine native status with translation app extension. |
| Settings - Customer Privacy | `/settings/privacy` | Privacy policy, cookie banner, data sharing opt-out, network intelligence, marketing settings, and data storage location. | Store owner or administrator | Setup and periodic maintenance | Settings | Privacy policy | Observed authenticated | Privacy should be surfaced as active operational controls, not static policy text. |
| Settings - Policies | `/settings/legal` | Return rules and written policies for refund, privacy, terms, shipping, contact, and legal notices. | Store owner or administrator | Setup and periodic maintenance | Settings | Return rules | Observed authenticated | Policies should distinguish generated, missing, required, published, and custom states. |

## Inventory Principles

- Shopify keeps every major merchant job visible even when the account has no data or is trial-gated.
- Top-level navigation is domain-oriented, not implementation-oriented.
- Child routes appear in context, reducing the sidebar length until a domain is active.
- Settings is treated as the merchant operating system control plane.
- Commerce workflows are separated into order, product, inventory, customer, market, discount, content, analytics, app, and theme domains.
- Every empty state teaches the business purpose and offers exactly one or two safe next actions.
