# Shopify Payments And Billing Blueprint

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Plan

- Route: `/settings/plan`
- Role in payment/billing system: Trial, subscription plan, plan selection, cancellation, and linked subscriptions.
- Visible control: Trial status
- Visible control: Choose plan
- Visible control: Cancel trial
- Visible control: Subscriptions link
- Visible control: Terms links
- LetBuyy payment implication: server-side totals, provider adapters, idempotency, provider signature verification, and plan entitlements must be first-class.

## Billing

- Route: `/settings/billing`
- Role in payment/billing system: Billing profile, upcoming bill, payment method, invoices, plan settings, and country-specific requirements.
- Visible control: Billing profile
- Visible control: Upcoming bill
- Visible control: Add payment method
- Visible control: Past bills tabs
- Visible control: Search/filter invoices
- Visible control: Jurisdiction warning
- LetBuyy payment implication: server-side totals, provider adapters, idempotency, provider signature verification, and plan entitlements must be first-class.

## Payments

- Route: `/settings/payments`
- Role in payment/billing system: Payment providers, PayPal/digital wallet setup, capture method, manual payments, customizations, and gift card expiry.
- Visible control: Provider setup
- Visible control: Choose provider
- Visible control: PayPal activation
- Visible control: Add payment method
- Visible control: Payment capture radios
- Visible control: Manual payment menu
- Visible control: Gift card expiration radios
- Visible control: Apple Wallet customize
- LetBuyy payment implication: server-side totals, provider adapters, idempotency, provider signature verification, and plan entitlements must be first-class.

## Checkout

- Route: `/settings/checkout`
- Role in payment/billing system: Checkout configuration, customer contact, customer information, marketing opt-in, subscriptions disclaimer, tipping, language, address collection, and rules.
- Visible control: Checkout configuration card
- Visible control: Customize/Duplicate
- Visible control: Phone or email radios
- Visible control: Require sign-in
- Visible control: Customer info controls
- Visible control: Email/SMS marketing controls
- Visible control: Subscription disclaimer radios
- Visible control: Tipping checkbox
- Visible control: Checkout language
- Visible control: Address collection
- Visible control: Add-to-cart limit
- Visible control: Checkout rules apps
- LetBuyy payment implication: server-side totals, provider adapters, idempotency, provider signature verification, and plan entitlements must be first-class.

## Customer Accounts

- Route: `/settings/customer_accounts`
- Role in payment/billing system: Sign-in links, account configuration, authentication methods, returns, store credit, and customer-account URL.
- Visible control: Sign-in links toggle
- Visible control: Customize apps/branding/features
- Visible control: Manage sign-in methods
- Visible control: Self-serve returns
- Visible control: Store credit
- Visible control: URL copy
- LetBuyy payment implication: server-side totals, provider adapters, idempotency, provider signature verification, and plan entitlements must be first-class.

## Taxes and Duties

- Route: `/settings/taxes`
- Role in payment/billing system: Regional sales tax, tax services, duties/import taxes, customs, and global tax settings.
- Visible control: Tax service status
- Visible control: Region table
- Visible control: Search/sort/pagination
- Visible control: Setup duties
- Visible control: Country of origin
- Visible control: HS codes
- Visible control: Include tax in prices
- Visible control: Charge tax on shipping
- Visible control: VAT on digital goods
- LetBuyy payment implication: server-side totals, provider adapters, idempotency, provider signature verification, and plan entitlements must be first-class.

## Workflow Blueprint

- Payment setup starts with provider discovery and plan readiness before activation.
- Payment capture is a store-level business policy with direct order-state consequences.
- Manual payments such as bank deposit, money order, custom method, and COD are treated as explicit provider-like methods.
- Billing combines upcoming bill, payment method, plan settings, invoice history, and jurisdiction-specific requirements.
- Checkout settings determine how payment, customer identity, marketing consent, subscription legal copy, and address collection meet.
- Tax settings and duties are upstream inputs to checkout/payment totals and should never be client-trusted.
