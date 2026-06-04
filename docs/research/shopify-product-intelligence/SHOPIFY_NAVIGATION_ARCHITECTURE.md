# Shopify Navigation Architecture

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Why Navigation Works

1. The persistent top frame provides global orientation while the page body remains focused on the current workflow.
2. The sidebar uses stable top-level nouns merchants already understand: Orders, Products, Customers, Marketing, Discounts, Content, Markets, Analytics.
3. Secondary navigation appears as an inline branch only after the user enters a domain, so novice merchants are not overwhelmed.
4. Settings is isolated at the bottom because it is foundational but not part of daily operational throughput.
5. Sales channels and Apps are grouped separately from core commerce so extensions do not pollute core navigation.
6. Search is visually centered and keyboard advertised, turning navigation into a command experience for expert users.
7. Breadcrumb headers appear on create/edit/detail pages, replacing deep sidebar expansion where context is enough.
8. Embedded surfaces such as Online Store retain the admin frame but introduce their own domain controls.
9. Context menus hide advanced or rare actions until the merchant needs them.
10. Gated states keep the route visible and explain the next requirement instead of returning an error.

## Navigation Grouping Logic

### Home
- Role in IA: Home groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Home.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Orders
- Role in IA: Orders groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Orders, Drafts, Abandoned checkouts.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Products
- Role in IA: Products groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Products, Collections, Inventory, Purchase orders, Transfers, Gift cards.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Customers
- Role in IA: Customers groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Customers, Segments, Companies.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Marketing
- Role in IA: Marketing groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Marketing, Campaigns, Attribution.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Discounts
- Role in IA: Discounts groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Discounts.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Content
- Role in IA: Content groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Metaobjects, Files, Menus, Blog posts.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Markets
- Role in IA: Markets groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Markets, Catalogs, Rollouts.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Analytics
- Role in IA: Analytics groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Analytics, Reports, Live View.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Sales channels
- Role in IA: Sales channels groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Online Store, Agentic.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Apps
- Role in IA: Apps groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Add.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

### Settings
- Role in IA: Settings groups related merchant jobs and limits lateral movement to nearby tasks.
- Child routes: Settings Root, General, Plan, Billing, Users, Roles, Security, Payments, Checkout, Customer Accounts, Shipping and Delivery, Taxes and Duties, Locations, Apps Settings, Sales Channels, Domains, Customer Events, Notifications, Customer Notification Templates, Metafields and Metaobjects, Languages, Customer Privacy, Policies.
- Progressive disclosure: child items are revealed only when the group is active or expanded.
- LetBuyy rule: keep the top-level noun stable and place setup/detail workflows under it.

## LetBuyy Navigation Recommendations

- Navigation: Create a Shopify-class navigation IA with expandable product, customer, order, content, market, analytics, and settings groups.
- Home readiness: Build a merchant home checklist from products, theme, payments, domain, shipping, policies, and plan state.
- Save bar: Add a save bar component with dirty-state detection, disabled save, discard, and leave-page guard.
- Settings architecture: Create settings IA and page templates before adding more merchant settings piecemeal.
- Products: Refactor product create/edit into structured cards with right rail status/publishing/organization.
- Orders: Add order empty/gated states tied to payments, shipping, checkout, and plan readiness.
