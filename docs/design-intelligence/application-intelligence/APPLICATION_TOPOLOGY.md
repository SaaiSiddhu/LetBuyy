# APPLICATION TOPOLOGY
Generated: 2026-06-19
Source: Live inspection of apps/* directory tree, layout.tsx, globals.css, package.json, and component directories.

---

## 1. identity-platform

**Runtime Path:** apps/identity-platform
**Dev Port:** 9002
**Status:** Active — production deploy target
**Purpose:** Centralised merchant authentication and identity broker; owns all merchant login, signup, OTP, password, OAuth 2.0/OIDC server, store creation, and session issuance flows.
**Primary Users:** Merchants (new and returning), any app integrating via OAuth2 (developer apps, app-marketplace)
**Business Domain:** Auth / Identity / Tenant provisioning
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, `@letbuyy/auth-core`, `@letbuyy/tenant-core`, `@letbuyy/ui`, `jose` (ES256 JWT), `bcryptjs`, `react-email`
**Route Count:** 38 routes/files (13 UI pages + 18 API routes + 5 OAuth2/OIDC server routes + JWKS endpoints)

**Key Routes:**
- UI pages: `/` (root redirect), `/login`, `/signup`, `/lookup`, `/check-email`, `/forgot-password`, `/reset-password`, `/set-password`, `/onboarding`, `/select`
- Auth API: `/api/auth/login`, `/api/auth/signup`, `/api/auth/logout`, `/api/auth/lookup`, `/api/auth/accounts`, `/api/auth/stores`, `/api/auth/switch`, `/api/auth/session`, `/api/auth/verify`, `/api/auth/verify-otp`, `/api/auth/send-magic`, `/api/auth/send-reset`, `/api/auth/reset-password`, `/api/auth/set-password`, `/api/auth/create-store`, `/api/auth/validate-subdomain`
- OAuth2 server: `/oauth2/authorize`, `/oauth2/token`, `/oauth2/callback`, `/oauth2/logout`, `/oauth2/userinfo`, `/oauth2/consent`
- OIDC discovery: `/.well-known/openid-configuration`, `/.well-known/jwks.json`, `/jwks`
- Email triggers: `/api/email/store-creation-success`, `/api/email/store-creation-failure`
- Auth callback: `/auth/callback`

**Navigation Model:** No persistent navigation — each page is a standalone modal-style card flow
**Layout Type:** Auth / minimal card (centered card, 380–420 px, mobile-first)
**Has Components Dir:** Yes
- `AuthIcon.tsx` — icon abstraction (SVG sprite)
- `BrandLogo.tsx` — theme-aware light/dark logo switching
- `OAuthBrandIcon.tsx` — OAuth provider icons
- `TurnstileWidget.tsx` — Cloudflare Turnstile CAPTCHA wrapper

**Global CSS Notes:** Extensive bespoke auth design system (~2 300 lines). Defines custom properties (`--bg`, `--text-primary`, `--border`, `--primary` mapped to `--lb-color-primary`). Full dark-mode via `.dark` class. Auth-specific component classes: `.auth-card`, `.auth-btn`, `.auth-btn-primary`, `.auth-btn-oauth`, `.auth-otp-input` (6-cell OTP inputs), `.onboard-bento-grid`, `.onboard-bento-card` (store-type selection), `.select-store-item`. India-defaults strip (`.onboard-india-defaults`). A11Y: `:focus-visible` ring restored for keyboard navigation. Does NOT use Tailwind utilities directly — relies on custom semantic classes layered on top of `--lb-*` design tokens.
**Dependencies on @letbuyy/ui:** Yes (`LetbuyyThemeProvider`, `ThemeScript`)
**Information Density:** Low per screen — single-focus auth flows
**Primary Workflows:**
1. New merchant signup (email → OTP → set-password → store type selection → subdomain pick → store creation → redirect to merchant-control-plane)
2. Returning merchant login (email lookup → password or magic link → store switcher)
3. OAuth 2.0 authorization (developer app requests access → consent screen → token issuance)
4. Password reset (forgot → email → reset link → set-password)
5. Multi-store switching (select screen lists all stores for the session user)

---

## 2. marketing-site

**Runtime Path:** apps/marketing-site
**Dev Port:** 9006
**Status:** Active — production deploy target, primary public-facing marketing presence
**Purpose:** Public marketing website for LetBuyy; positions the platform, drives signups, hosts blog/resources, and serves schema.org structured data for SEO.
**Primary Users:** Prospective merchants (public, pre-signup)
**Business Domain:** Growth / Marketing / SEO
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, GSAP 3.14 + `@gsap/react`, Framer Motion 12, Lenis (smooth scroll), `@letbuyy/shared-types`, `@letbuyy/ui`
**Route Count:** 21 routes/files (7 UI pages + resource hub sub-pages + 1 API route)

**Key Routes:**
- `/` — Homepage (hero, features, pricing, FAQ)
- `/pricing` — Pricing page
- `/create` — Redirect / signup funnel landing
- `/signup` — Signup redirect to identity-platform
- `/sitemap` — HTML sitemap page
- `/resources` — Resources hub index
- `/resources/[category]` — Resource category listing
- `/resources/[category]/[slug]` — Article detail
- `/resources/authors/[slug]` — Author profile
- `/resources/changelog` — Product changelog
- `/resources/releases` — Release notes
- `/resources/newsletter` — Newsletter signup
- `/resources/search` — Resource search
- `/resources/tag/[tag]` — Tag-filtered articles
- `/resources/rss.xml` — RSS feed route
- `/resources/sitemap.xml` — Resources sitemap route
- `/robots.ts` — Robots.txt
- `/sitemap.ts` — Main sitemap
- `/api/founding-pricing` — Founding-merchant pricing API

**Navigation Model:** Top-navigation bar (Header component) + footer; standard marketing site nav
**Layout Type:** Marketing / editorial (full-width sections, scroll-driven animations)
**Has Components Dir:** Yes
- `Hero.tsx` — Animated hero with GSAP/Framer Motion
- `Features.tsx` — Feature grid/cards
- `Pricing.tsx` — Pricing cards
- `FAQ.tsx` — Accordion FAQ
- `Footer.tsx` — Site-wide footer
- `Header.tsx` — Top navigation bar
- `BrandLogo.tsx` — Theme-aware logo
- `CapabilityMap.tsx`, `CommerceNetwork.tsx`, `EcosystemMap.tsx` — Visual platform narrative components
- `MerchantJourney.tsx`, `SiteTypes.tsx`, `TrustIndicators.tsx`, `PlatformDirectory.tsx`, `FinalCTA.tsx` — Homepage sections
- `resources/` — Resource hub components (article cards, category browsing, newsletter)

**Global CSS Notes:** Premium design token definitions (~300+ lines visible). Maps `--lb-color-*` tokens to semantic marketing aliases (`--primary`, `--accent`, `--bg-deep`, `--bg-card`, gradient definitions). Light/dark both defined. Marketing-specific typography scale. Scroll-animation hooks via Lenis. @source directive includes `@letbuyy/ui` package source for Tailwind scanning.
**Dependencies on @letbuyy/ui:** Yes (`LetbuyyThemeProvider` surface="storefront", `ThemeScript`; plus shared-types for `BRAND`, structured data helpers)
**Information Density:** Low per section — marketing rhythm, generous whitespace
**Primary Workflows:**
1. Prospective merchant reads homepage → understands value prop → clicks "Get started free"
2. Pricing comparison → selects plan → redirected to signup
3. Blog/resources browsing → reads articles, changelog, release notes
4. Newsletter subscription
5. SEO/structured data serving (Organization, WebSite, SoftwareApplication JSON-LD)

---

## 3. merchant-control-plane

**Runtime Path:** apps/merchant-control-plane
**Dev Port:** 9001
**Status:** Active — primary merchant workspace, production deploy target
**Purpose:** Full-featured merchant back-office dashboard; the day-to-day operational interface for managing all aspects of a LetBuyy store (products, orders, customers, themes, analytics, settings, billing).
**Primary Users:** Merchants (store owners, employees with scoped roles)
**Business Domain:** Merchant operations (all commerce sub-domains: products, orders, customers, marketing, content, online-store, settings, billing, payouts)
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, Lucide React icons, `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/cms-core`, `@letbuyy/theme-engine`, `@letbuyy/shared-types`
**Route Count:** 143 routes/files (68 UI pages + 75 internal API proxy routes)

**Key Routes (UI pages under `[store]/`):**
- Dashboard: `/[store]/dashboard`, `/[store]/stores` (multi-store switcher)
- Products: `/[store]/products`, `/[store]/products/new`, `/[store]/products/[productId]`, `/[store]/products/collections`, `/[store]/products/inventory`, `/[store]/products/purchase-orders`, `/[store]/products/transfers`, `/[store]/products/gift-cards`
- Orders: `/[store]/orders`
- Customers: `/[store]/customers`
- Marketing: `/[store]/coupons`, `/[store]/reviews`
- Content: `/[store]/pages`, `/[store]/posts`, `/[store]/comments`, `/[store]/gallery`, `/[store]/categories`
- Online Store: `/[store]/online-store`, `/[store]/online-store/themes`, `/[store]/online-store/themes/[themeId]/editor`, `/[store]/online-store/pages`, `/[store]/online-store/preferences`
- Money: `/[store]/settings/billing`, `/[store]/settings/billing/profile`, `/[store]/payouts`
- Site-type specific: `/[store]/projects`, `/[store]/skills`, `/[store]/education`, `/[store]/certifications`, `/[store]/testimonials`, `/[store]/experience`, `/[store]/gallery`, `/[store]/leads`, `/[store]/contact`
- Apps: `/[store]/apps`, `/[store]/apps/[installationId]`
- Settings: `/[store]/settings`, `/[store]/settings/general`, `/[store]/settings/business`, `/[store]/settings/payments`, `/[store]/settings/shipping`, `/[store]/settings/taxes`, `/[store]/settings/domains`, `/[store]/settings/checkout`, `/[store]/settings/notifications`, `/[store]/settings/security`, `/[store]/settings/policies`, `/[store]/settings/localization`, `/[store]/settings/users`, `/[store]/settings/custom-data`, `/[store]/settings/apps`, `/[store]/settings/plan`
- Plan billing: `/[store]/access_account/checkout/select-plan`, `/[store]/access_account/checkout/checkout`, `/[store]/settings/subscribe/checkout`
- AI: `/[store]/ai`
- Analytics: `/[store]/analytics`
- Export: `/[store]/export`
- Misc: `/[store]/appearance`, `/[store]/skills`, `/[store]/kyc` (via mobile app), `/launching-soon`

**Navigation Model:** Sidebar navigation with command palette; site-type-adaptive (5 navigation configs: store / portfolio / resume / landing / blog); keyboard shortcuts (g-h, g-o, g-p, etc.); nested sub-sections; `CommandPalette.tsx` for global search and quick actions
**Layout Type:** Full-screen dashboard (AdminShell wraps all pages; sidebar left, header bar top, content area right)
**Has Components Dir:** Yes (rich)
- `AdminShell.tsx` — master layout frame (sidebar + top bar + content slot)
- `AISidebar.tsx` — AI assistant panel
- `CommandPalette.tsx` — keyboard-driven global search
- `HeaderBar.tsx` — top bar with notifications and user menu
- `NotificationsPanel.tsx` — notification drawer
- `ProviderModeBadge.tsx` — payment provider context badge
- `TrialBanner.tsx` — trial plan upgrade prompt
- `merchantNavigation.ts` — site-type-adaptive navigation config (5 nav trees)
- Sub-directories: `apps/`, `billing/`, `domains/`, `founding/`, `security/`, `settings/`, `theme-editor/`

**Global CSS Notes:** Imports `letbuyy-tokens.css`; no bespoke design system (relies on `@letbuyy/ui` components and `--lb-*` tokens for all UI); robots noindex (never indexed).
**Dependencies on @letbuyy/ui:** Yes (heavy — AppNavigation, all UI primitives, icons)
**Information Density:** High — data-dense tables, forms, multi-panel editors
**Primary Workflows:**
1. Products: create, edit, publish products; manage collections, categories, inventory, purchase orders
2. Orders: view, fulfil, refund orders; manage abandoned checkouts
3. Customers: browse customer list, view customer detail
4. Online Store: install/manage themes, live theme editor (`/themes/[themeId]/editor`), store pages, preferences
5. Settings: configure shipping, taxes, payments (Razorpay), domains, team users, security (2FA, step-up), billing/plan upgrade

---

## 4. storefront-runtime

**Runtime Path:** apps/storefront-runtime
**Dev Port:** 9000
**Status:** Active — primary shopper-facing runtime, production deploy target
**Purpose:** Multi-tenant customer storefront engine; serves all tenant storefronts at `{store}.letbuyy.com` and custom domains; handles product browsing, cart, checkout, customer accounts, and Liquid/React hybrid theme rendering.
**Primary Users:** Shoppers / customers (end consumers of merchant stores)
**Business Domain:** Storefront / Checkout / Customer account / Themes
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, Framer Motion 12, Lucide React, `jose`, `jsdom`, `clsx`, `tailwind-merge`, `@letbuyy/theme-engine` (Liquid + React hybrid), `@letbuyy/checkout-core`, `@letbuyy/commerce-core`, `@letbuyy/cms-core`, `@letbuyy/tenant-core`, `@letbuyy/auth-core`, `@vercel/speed-insights`
**Route Count:** 66 routes/files (46 UI pages/layouts + 23 API routes)

**Key Routes:**
- Store home: `/store/[subdomain]/` (renders tenant homepage)
- Product: `/store/[subdomain]/product/[productId]`
- Products listing: `/store/[subdomain]/products`
- Collections: `/store/[subdomain]/collections/[slug]`
- Cart: `/store/[subdomain]/cart`
- Checkout: `/store/[subdomain]/checkout`, `/store/[subdomain]/checkout/success`, `/store/[subdomain]/checkout/paypal-return`
- Customer account: `/store/[subdomain]/account` (hub), `/store/[subdomain]/account/orders`, `/store/[subdomain]/account/orders/[id]`, `/store/[subdomain]/account/addresses`, `/store/[subdomain]/account/settings`, `/store/[subdomain]/account/wishlist`
- Order tracking (guest): `/store/[subdomain]/orders`
- Blog: `/store/[subdomain]/blog/[slug]`
- Static pages: `/store/[subdomain]/shop`, `/store/[subdomain]/privacy`, `/store/[subdomain]/terms`, `/store/[subdomain]/shipping`, `/store/[subdomain]/returns`
- Catch-all (Liquid/CMS pages): `/store/[subdomain]/[...path]`
- Preview: `/preview`, `/preview/coming-soon`
- Demo: `/demo/urban-kicks` (Urban Kicks Liquid theme demo)
- API: `/api/customer/*` (login, register, logout, profile, orders, addresses, wishlist, session, set-password, auto-create), `/api/orders/*`, `/api/reviews`, `/api/shipping/rates`, `/api/coupons/validate`, `/api/store-lookup`, `/api/themes/*`, `/api/seed`

**Navigation Model:** Per-store navigation (merchant-configured via nav settings); no persistent sidebar; storefront header/footer rendered by theme; account section has sub-navigation
**Layout Type:** Storefront (customer-facing; highly themed; each store has its own visual identity via theme engine)
**Has Components Dir:** Yes (domain-organized)
- `layout/` — storefront chrome (header, footer, nav)
- `account/` — account hub, order history, address management
- `cart/` — cart UI
- `product/` — product detail, variant selection, media gallery
- `content/` — blog rendering
- `sections/` — theme section components
- `coming-soon/` — coming-soon page
- `security/` — auth gates
- `storefront/` — storefront-level wrappers

**Global CSS Notes:** Imports `letbuyy-tokens.css`; relies almost entirely on theme-engine tokens; Vercel Speed Insights injected; store-specific CSS can be injected via theme engine at runtime.
**Dependencies on @letbuyy/ui:** Yes (`LetbuyyThemeProvider` surface="storefront", `ThemeScript`)
**Information Density:** Medium — product browsing is browsable-density; checkout is step-by-step low density
**Primary Workflows:**
1. Browse store → view products → add to cart → checkout → payment (Razorpay/COD/PayPal) → order confirmation
2. Customer account login/register → view order history → track order → manage addresses → wishlist
3. Discover products by collection or search
4. Read blog posts
5. Theme preview rendering (via `/preview` route, used by merchant theme editor)

---

## 5. platform-console

**Runtime Path:** apps/platform-console
**Dev Port:** 9007
**Status:** Active — internal operator tool, production deploy target
**Purpose:** Super-admin platform control panel for LetBuyy leadership/engineering; provides visibility into all merchants, revenue, subscriptions, risk, compliance, audit logs, and platform operations.
**Primary Users:** LetBuyy operators / founders / engineers (super-admin, MFA-required)
**Business Domain:** Platform operations / Revenue / Trust & Safety / Compliance / Governance
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, Lucide React, `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/shared-types`, Zod
**Route Count:** 34 routes/files (22 UI pages + 6 API routes)

**Key Routes:**
- Auth: `/(auth)/login`, `/(auth)/mfa`
- Dashboard pages `/(dashboard)/`:
  - `/dashboard` — Leadership home (KPIs)
  - `/stores` — Store directory (paginated table of all merchant stores)
  - `/merchants` — Merchant 360 detail view (per-merchant deep-dive), `/merchants/[id]`
  - `/revenue` — Platform revenue dashboard
  - `/money-reconciliation` — Ledger reconciliation
  - `/subscriptions` — Subscription management
  - `/founding` — Founding merchant program
  - `/marketplace-governance` — App/theme review governance
  - `/risk` — Risk detection
  - `/trust-safety` — Trust and safety queue
  - `/analytics` — Platform analytics
  - `/operations` — Platform operations status
  - `/compliance` — Compliance dashboard
  - `/users` — All platform users
  - `/employees` — Employee directory
  - `/audit-logs` — Immutable audit log browser
  - `/settings` — Console settings
- API: `/api/console-auth/login`, `/api/console-auth/logout`, `/api/console-auth/callback`, `/api/console-auth/mfa`, `/api/founding/action`, `/api/founding/export`

**Navigation Model:** Sidebar (17-item flat list via `AppNavigation`); always dark theme (defaultTheme="dark")
**Layout Type:** Operator dashboard (dark, dense sidebar + content area)
**Has Components Dir:** Yes (minimal)
- `ConsoleDataTable.tsx` — data table abstraction
- `_local-ui/` — console-specific UI overrides
- `founding/` — founding program management components

**Global CSS Notes:** Imports `letbuyy-tokens.css`; dark-only theme (ThemeScript defaultTheme="dark"); surface="operations"; robots noindex. No bespoke design system.
**Dependencies on @letbuyy/ui:** Yes (heavy — AppNavigation, ThemeToggleButton, Button, data display primitives)
**Information Density:** High — platform-scale data tables, metrics, logs
**Primary Workflows:**
1. Monitor merchant health, revenue, and subscription state across all tenants
2. Review and act on risk signals and trust/safety escalations
3. Reconcile payment ledger and investigate money discrepancies
4. Govern app marketplace submissions (approve/reject apps and themes)
5. Browse immutable audit logs for compliance/investigations

---

## 6. platform-operations-portal

**Runtime Path:** apps/platform-operations-portal
**Dev Port:** 9008
**Status:** Active — internal team operations tool, production deploy target
**Purpose:** Employee-facing operational portal for LetBuyy team (success, support, CRM, retention, merchant health, communications, campaigns, developer relations).
**Primary Users:** LetBuyy operations staff, customer success team, support agents
**Business Domain:** Merchant success / Customer support / CRM / Retention / Marketing operations
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, Lucide React, `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/shared-types`
**Route Count:** 27 routes/files (20 UI pages + no dedicated API routes — all proxied through gateway)

**Key Routes:**
- Auth: `/(auth)/login`, `/(auth)/invite`
- Dashboard pages `/(dashboard)/`:
  - `/` — Team dashboard home
  - `/crm` — CRM contact list
  - `/tickets` — Support tickets
  - `/support` — Support queue
  - `/merchant-health` — Merchant health scoreboard
  - `/risk` — Risk decisions
  - `/trust-safety` — Trust and safety
  - `/developers` — Developer 360
  - `/retention` — Retention management
  - `/campaigns` — Marketing campaigns
  - `/communications` — Comms management
  - `/onboarding` — Merchant onboarding queue
  - `/operations` — Review queue hub
  - `/operations/onboarding` — Onboarding queue
  - `/operations/communications` — Communication templates
  - `/stores` — Store browser
  - `/users` — User management
  - `/marketing` — Marketing ops

**Navigation Model:** Sidebar (12-item via `AppNavigation`); always dark theme (surface="operations")
**Layout Type:** Operator dashboard (dark, sidebar + content area)
**Has Components Dir:** Yes (minimal)
- `_local-ui/` — ops portal UI overrides

**Global CSS Notes:** Imports `letbuyy-tokens.css`; dark-only theme (ThemeScript defaultTheme="dark"); surface="operations"; robots noindex.
**Dependencies on @letbuyy/ui:** Yes (AppNavigation, ThemeToggleButton, MaterialIcon, all UI primitives)
**Information Density:** High — queue management, data tables, merchant health metrics
**Primary Workflows:**
1. Handle support tickets and escalations
2. Manage CRM pipeline (merchant contacts, outreach history)
3. Review merchant health scores and take intervention actions
4. Manage merchant onboarding queue (guide new merchants through setup)
5. Configure and send merchant communications and campaigns

---

## 7. app-marketplace

**Runtime Path:** apps/app-marketplace
**Dev Port:** 9003
**Status:** Frozen (not a production deploy target; pending consolidation per CLAUDE.md)
**Purpose:** Public app marketplace for discovering, browsing, and installing third-party apps/integrations into LetBuyy stores; also hosts a developer submission portal.
**Primary Users:** Merchants (browsing/installing apps), third-party developers (submitting apps), platform moderators
**Business Domain:** App ecosystem / Partner platform
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, Lucide React, `jose`, `zod`, `tailwind-merge`, `@letbuyy/ui`, `@letbuyy/auth-core`, `@letbuyy/billing-core`, `@letbuyy/shared-types`
**Route Count:** 40 routes/files (27 UI pages + 10 API routes)

**Key Routes:**
- Public browse: `/` (home), `/apps/[slug]` (app detail), `/categories`, `/categories/[slug]`, `/categories/[slug]/all`, `/collections`, `/collections/[slug]`, `/partners`, `/search`, `/stories`, `/stories/[slug]`
- Authenticated: `/my-apps`, `/developers`, `/developers/[slug]`, `/developers/dashboard`, `/developers/docs`, `/developers/docs/[topic]`, `/developers/apps/new`, `/developers/register`, `/developers/review-requirements`
- Moderation: `/moderation/reviews`
- API: `/api/apps`, `/api/apps/[id]`, `/api/apps/[id]/install`, `/api/apps/[id]/reviews`, `/api/apps/search`, `/api/developers`, `/api/developers/apps`, `/api/developers/register`

**Navigation Model:** Top navigation (Header) + footer; marketplace browsing with category/collection nav
**Layout Type:** Marketplace / catalogue (grid-browse layout with search/filter)
**Has Components Dir:** Yes (rich, 36+ components)
- `AppCard.tsx`, `AppDetailParity.tsx`, `InstalledAppsGrid.tsx`, `ScreenshotGallery.tsx`, `StarRating.tsx`, `QualityBadge.tsx`, `PricingTag.tsx`
- `AppInstallConsentPanel.tsx`, `AppBillingChargePanel.tsx`, `AppSpendControlPanel.tsx`, `AppDemoSessionButton.tsx`
- Developer tools: `ApiKeyPanel.tsx`, `DeveloperWebhookManager.tsx`, `DeveloperAnalyticsChart.tsx`, `DeveloperApiUsagePanel.tsx`, `DeveloperAppVersionManager.tsx`, `DeveloperPricingPlanManager.tsx`, `DeveloperReviewReplyPanel.tsx`, `DeveloperUsageMeterPanel.tsx`
- `MarketplaceCollectionSections.tsx`, `MarketplaceEditorial.tsx`, `CategoryGrid.tsx`, `MarketplacePagination.tsx`
- `ReviewComposer.tsx`, `ReviewModerationActions.tsx`, `ReportActionButton.tsx`, `SavedAppsPanel.tsx`
- `SandboxStorePanel.tsx`, `CollaboratorCodePanel.tsx`, `PartnerTierPanel.tsx`, `ExtensionConfigPanel.tsx`
- `Header.tsx`, `Footer.tsx`, `MarketplaceBreadcrumbs.tsx`, `MarketplaceSkeleton.tsx`, `MarketplaceUnavailable.tsx`

**Global CSS Notes:** Imports `letbuyy-tokens.css`; surface="marketplace"; `appstore-shell` class on root; custom background flash prevention via `dangerouslySetInnerHTML` style. Structured data: Organization + WebSite + CollectionPage JSON-LD.
**Dependencies on @letbuyy/ui:** Yes (`LetbuyyThemeProvider`, `ThemeScript` + all UI primitives)
**Information Density:** Medium — catalogue browsing, app detail pages with screenshots
**Primary Workflows:**
1. Merchant browses/searches app catalogue → reads app detail → installs app into store
2. Merchant manages installed apps (my-apps dashboard)
3. Third-party developer submits new app (register → create app listing → submit for review)
4. Platform moderator reviews and approves/rejects app submissions
5. Editorial collection browsing (curated collections, partner stories)

---

## 8. developer-portal

**Runtime Path:** apps/developer-portal
**Dev Port:** 9004
**Status:** Frozen (not a production deploy target; pending consolidation per CLAUDE.md)
**Purpose:** Developer documentation and tooling hub for third-party developers building on the LetBuyy platform (APIs, OAuth, webhooks, SDKs, app extensions).
**Primary Users:** Third-party developers building integrations, app developers, theme developers
**Business Domain:** Developer platform / API documentation / Partner ecosystem
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, `@letbuyy/ui` only (minimal dependencies — no api-client, no auth-core)
**Route Count:** 10 routes/files (8 UI pages)

**Key Routes:**
- `/` — Developer portal home
- `/dashboard` — Developer dashboard
- `/docs` — Documentation index
- `/api-reference` — API reference
- `/api` — API overview
- `/webhooks` — Webhook documentation
- `/sdk` — SDK overview (singular)
- `/sdks` — SDK listing (plural)
- `/oauth` — OAuth integration guide

**Navigation Model:** Top navigation (`PortalChrome.tsx` wrapper with sidebar/topbar); compact density
**Layout Type:** Developer documentation portal (code-heavy, sidebar nav, content area)
**Has Components Dir:** Yes (minimal)
- `PortalChrome.tsx` — documentation shell layout
- `_local-ui/` — portal-specific UI
- `anonymous-preview-shell.tsx` — unauthenticated preview wrapper
- `auth-provider.tsx` — auth state provider
- `developer-listing-builder-form.tsx` — app listing creation form
- `info-placeholder.tsx` — documentation placeholder
- `layout/` — layout components
- `marketplace-unavailable.tsx` — unavailability messaging
- `policy-draft-page.tsx` — policy content page
- Various theme/action components (carried over from theme-marketplace adjacency)

**Global CSS Notes:** Imports `letbuyy-tokens.css`; surface="marketplace" density="compact" (compact density for documentation readability); `developer-shell` class; structured data: Organization + WebSite JSON-LD.
**Dependencies on @letbuyy/ui:** Yes (only external UI dep — `LetbuyyThemeProvider`, `ThemeScript`)
**Information Density:** Medium — documentation-style content, code samples
**Primary Workflows:**
1. Developer reads API reference and authentication guide
2. Developer sets up OAuth2 integration
3. Developer configures webhooks and manages endpoints
4. Developer downloads/browses available SDKs
5. Developer views personal dashboard (API key management, usage metrics)

---

## 9. theme-marketplace

**Runtime Path:** apps/theme-marketplace
**Dev Port:** 9005
**Status:** Frozen (not a production deploy target; pending consolidation per CLAUDE.md)
**Purpose:** Public theme marketplace for discovering, previewing, and purchasing/installing LetBuyy themes; includes a developer submission flow and a buyer dashboard.
**Primary Users:** Merchants (browsing/purchasing themes), theme developers (submitting themes)
**Business Domain:** Theme ecosystem / Design marketplace
**Tech Stack:** Next.js 16.1.6, React 19, Tailwind CSS v4, Framer Motion 12, Lucide React, `clsx`, `tailwind-merge`, `@letbuyy/theme-engine`, `@letbuyy/auth-core`, `@letbuyy/shared-types`, `@letbuyy/ui`; uses `server-only` package
**Route Count:** 37 routes/files (30 UI pages + 4 API routes)

**Key Routes:**
- Public: `/` (home), `/themes`, `/themes/[slug]`, `/themes/category/[category]`, `/themes/compare`, `/collections/[slug]`, `/authors/[handle]`, `/about`, `/contact`, `/support`, `/install`, `/pricing`
- Preview: `/preview/[token]` — store-scoped theme preview
- Legal: `/legal/terms`, `/legal/privacy`, `/legal/license`, `/legal/refund`
- Auth callback: `/auth/callback`
- Buyer dashboard: `/dashboard`, `/dashboard/downloads`, `/dashboard/favorites`, `/dashboard/installations`, `/dashboard/purchases`, `/dashboard/settings`
- Developer area: `/developer`, `/developer/listings/new`
- Documentation: `/docs`, `/docs/api`
- Checkout: `/checkout`, `/checkout/success`
- API: `/api/themes`, `/api/themes/[slug]`

**Navigation Model:** Top navigation (`Navbar` component) + footer; persistent auth state (server-side session check in root layout); sub-navigation in dashboard section
**Layout Type:** Marketplace (grid-browse + detail pages; buyer dashboard has sub-sections)
**Has Components Dir:** Yes (rich, 19+ components)
- `theme-card.tsx`, `theme-detail-experience.tsx`, `theme-category-landing.tsx`, `theme-compare-selection.tsx`
- `theme-favorites-list.tsx`, `theme-preference-actions.tsx`, `theme-share-button.tsx`, `theme-upload-panel.tsx`
- `theme-action-feedback.tsx`
- `auth-provider.tsx` — client-side auth state
- `layout/` — Navbar, Footer
- `anonymous-preview-shell.tsx`, `developer-listing-builder-form.tsx`
- `marketplace-unavailable.tsx`, `policy-draft-page.tsx`, `info-placeholder.tsx`

**Global CSS Notes:** Imports `letbuyy-tokens.css`; surface="marketplace"; auth state checked server-side in root layout (session cookie read + `ThemeService.getSessionUser()`); `ToastProvider` in root; `min-h-screen flex flex-col` body; content padded `pt-[72px]` for fixed navbar. Structured data: Organization + WebSite + CollectionPage JSON-LD.
**Dependencies on @letbuyy/ui:** Yes (`LetbuyyThemeProvider`, `ThemeScript`, `ToastProvider`, all UI primitives)
**Information Density:** Medium — visual theme gallery, detail pages, buyer dashboard
**Primary Workflows:**
1. Merchant browses theme catalogue → previews theme in store context → purchases/installs
2. Merchant manages purchased themes (dashboard: downloads, installations, favorites)
3. Theme developer submits new theme listing
4. Compare themes side-by-side
5. Browse themes by industry category

---

## 10. mobile/merchant-app

**Runtime Path:** apps/mobile/merchant-app
**Status:** Active — Flutter app, deployed to iOS App Store and Google Play
**Purpose:** Native mobile merchant app for iOS and Android; mirrors merchant-control-plane features in a mobile-native experience; includes home-screen widget (Android metrics widget).
**Primary Users:** Merchants (on mobile devices)
**Business Domain:** Merchant operations (mobile-native counterpart to merchant-control-plane)
**Tech Stack:** Flutter (Dart SDK ^3.10.0), `webview_flutter` (embedded WebView for app bridge), `hive_flutter` (local storage), `font_awesome_flutter`, i18n via `app_localizations`
**Screen Count:** 50+ screens across 27 screen directories

**Key Screens (by directory):**
- `auth/` — login, OTP, Turnstile challenge, error
- `dashboard/` — home screen (metrics overview)
- `orders/` — orders list, order detail, returns
- `products/` — products list, product form, collections, import
- `inventory/` — inventory, locations, purchase orders, suppliers, transfers
- `customers/` — customer list, customer detail
- `discounts/` — coupons list, coupon form, gift cards
- `marketing/` — email campaigns, leads, reviews
- `content/` — blog posts editor, page editor, pages list, media library, navigation
- `customize/` — theme management, theme versions
- `editor/` — section editor (theme section editing)
- `analytics/` — analytics dashboard
- `settings/` — billing, custom data, notifications, security, shipping, taxes, team
- `security/` — 2FA enrollment/management
- `kyc/` — identity verification
- `money/` — payouts and billing
- `apps/` — installed apps list, app WebView bridge runtime
- `preview/` — live storefront preview
- `wizard/` — store setup wizard
- `subscription/` — plan upgrade flow
- `ai/` — AI assistant screen
- `splash/`, `platform/`, `premium/`, `store_health/`, `main/`

**Navigation Model:** Bottom tab bar (primary); drawer/stack navigation within sections; role gate at app level
**Layout Type:** Native mobile (Material Design with LetBuyy theming)
**Has Components Dir:** Yes (implicit — Flutter widgets in `lib/`)
**Dependencies on @letbuyy/ui:** No (Flutter app; connects to API gateway at `:9010`)
**Information Density:** Medium — mobile-optimised tables, metric cards, native forms
**Primary Workflows:**
1. Real-time order notifications → view and process orders on mobile
2. Add/edit products with camera image upload
3. Monitor dashboard metrics (revenue, orders, visitors)
4. Manage discounts and gift cards on the go
5. Live preview store changes from mobile

---

## 11. mobile/shopper-app

**Runtime Path:** apps/mobile/shopper-app
**Status:** Reserved — manifest-only placeholder, no source code implemented
**Purpose:** Future native mobile shopper/customer app; currently no deployable source; active shopper functionality lives in storefront-runtime (web) and services/api-gateway.
**Primary Users:** Shoppers / customers (future)
**Business Domain:** Customer commerce (reserved)
**Tech Stack:** Not implemented (manifest only: `runtime.manifest.json`)
**Route Count:** 0 (no source)
**Notes:** Activation requires human-approved scope with source, tests, deployment config, and governance approval. All current shopper/customer behavior delegates to `apps/storefront-runtime`.

---

## Summary Table

| App | Port | Status | Surface | Auth Issuer | Theme Surface |
|-----|------|--------|---------|-------------|---------------|
| identity-platform | 9002 | Active | Merchant auth | ES256 (self) | identity |
| marketing-site | 9006 | Active | Public marketing | None | storefront |
| merchant-control-plane | 9001 | Active | Merchant dashboard | ES256 (identity-platform) | admin |
| storefront-runtime | 9000 | Active | Customer storefront | HS256 (customer) | storefront |
| platform-console | 9007 | Active | Operator super-admin | Console auth + MFA | operations |
| platform-operations-portal | 9008 | Active | Team ops | Console auth | operations |
| app-marketplace | 9003 | Frozen | Marketplace | ES256 (identity-platform) | marketplace |
| developer-portal | 9004 | Frozen | Dev docs | None | marketplace |
| theme-marketplace | 9005 | Frozen | Marketplace | ES256 (identity-platform) | marketplace |
| mobile/merchant-app | N/A | Active (Flutter) | Native mobile | ES256 (identity-platform) | Flutter native |
| mobile/shopper-app | N/A | Reserved | — | — | — |
