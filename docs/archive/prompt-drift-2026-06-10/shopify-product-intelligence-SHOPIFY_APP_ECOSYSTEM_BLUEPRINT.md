# Shopify App Ecosystem Blueprint

- Research date: 2026-06-02
- Scope: Merchant-facing Shopify Admin product intelligence for LetBuyy.
- Privacy: Store, user, email, account, domain, token, and merchant-specific values are redacted.
- Method: Authenticated Chrome session, accessibility tree, visual review, redacted screenshots, non-persistent interactions only.
## Apps Add

- Route: `/apps`
- App ecosystem role: Entry into app marketplace and installed app management.
- Observed surface: Observed via settings and sidebar links, external app store not installed
- LetBuyy lesson: App ecosystem should start with discovery categories and permission transparency.

## Marketing

- Route: `/marketing`
- App ecosystem role: Marketing performance overview and acquisition workflow entry.
- Observed surface: Observed authenticated
- LetBuyy lesson: Marketing should connect attribution, campaigns, and app extension in one workspace.

## Settings - Apps Settings

- Route: `/settings/apps`
- App ecosystem role: Installed apps, app discovery, and developer app entry.
- Observed surface: Observed authenticated
- LetBuyy lesson: Make app management permission- and billing-aware from day one.

## Settings - Customer Events

- Route: `/settings/customer_events`
- App ecosystem role: Pixels and customer-event tracking via app pixels and custom pixels.
- Observed surface: Observed authenticated
- LetBuyy lesson: Pixel management belongs near privacy and analytics, with app pixels preferred over custom code.

## Settings - Languages

- Route: `/settings/languages`
- App ecosystem role: Published languages, domains, default language, and translation app recommendations.
- Observed surface: Observed authenticated
- LetBuyy lesson: Language management should combine native status with translation app extension.

## Settings - Checkout

- Route: `/settings/checkout`
- App ecosystem role: Checkout configuration, customer contact, customer information, marketing opt-in, subscriptions disclaimer, tipping, language, address collection, and rules.
- Observed surface: Observed authenticated
- LetBuyy lesson: Checkout needs staged sections with risk-aware copy and app-powered extension points.

## Online Store Themes

- Route: `/themes`
- App ecosystem role: Manage current theme, theme library, previews, password protection, and theme discovery.
- Observed surface: Observed authenticated
- LetBuyy lesson: Theme management needs library, current/live state, safe duplicate, and edit entry.

## LetBuyy App Architecture Requirements

- App manifest with name, scopes, embedded routes, billing model, support contact, screenshots, and privacy links.
- OAuth install flow with explicit permission review and no persistent install from exploratory admin browsing.
- App billing contract separated from core subscription billing but visible in billing settings.
- Embedded app shell inside merchant control plane with consistent top frame and app navigation.
- App categories surfaced contextually from settings, marketing, pixels, themes, checkout rules, translation, sourcing, and POS.
- Review, rating, and screenshot model in marketplace before app install.
- App uninstall, permission review, and data deletion flows in settings.
