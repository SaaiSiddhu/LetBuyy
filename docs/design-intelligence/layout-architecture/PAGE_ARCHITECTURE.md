# Page Architecture — Merchant Control Plane
Generated: 2026-06-19

App root: `apps/merchant-control-plane/src/app/`

---

## Layout Inheritance Chain

```
RootLayout (app/layout.tsx)
  → LetbuyyThemeProvider surface="admin"
  → fonts: letbuyySans + letbuyyDisplay + letbuyyMono (Geist)
  → ThemeScript (flash-free SSR theme)

StoreLayout ([store]/layout.tsx)
  → auth guard: getSessionUser() → redirect to identity-platform if unauthenticated
  → store guard: getStoreForUser() → 404 if not owned
  → AdminShell (client component, full shell orchestration)

AdminShell (components/AdminShell.tsx)
  → Three modes based on current pathname:

  MODE A — Full-screen bypass:
    pathname includes /access_account/checkout, /subscribe/checkout, or /editor
    → ToastProvider only, no header, no sidebar, no nav

  MODE B — Settings mode:
    pathname includes /settings
    → ToastProvider
    → HeaderBar (fixed top)
    → div.admin-settings-wrapper (paddingTop: admin-header-height)
    → {children} (page renders SettingsPane → Page + PageHeader)

  MODE C — Standard mode (all other routes):
    → ToastProvider
    → HeaderBar (fixed top)
    → AppNavigation (AppFrame + Sidebar 220px + Navigation)
    → main content area (optional AISidebar inline)
    → {children} (page renders Page + PageHeader + Cards)
```

---

## Complete Route Tree

### Top-level (outside `[store]`)

| Route | File | Type | Description |
|-------|------|------|-------------|
| `/` | `app/page.tsx` | Redirect | Redirects to `/stores` |
| `/stores` | `app/stores/` | Store list | Multi-store picker |
| `/launching-soon` | `app/launching-soon/` | Static | Launch-soon page |

### `[store]` routes — Standard layout (shell + sidebar)

#### Home
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/dashboard` | `[store]/dashboard/` | Standard | Dashboard | Home metrics, setup checklist, recent activity, plan upsell |

#### Commerce — Orders & Money
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/orders` | `[store]/orders/` | Standard | List | Order list with views (Drafts, Abandoned) |
| `/{store}/payouts` | `[store]/payouts/` | Standard | List | Payout list + ledger |

#### Products
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/products` | `[store]/products/` | Standard | List | Product catalog table with tabs/search/sort/bulk |
| `/{store}/products/new` | `[store]/products/new/` | Standard | Form/Create | New product form |
| `/{store}/products/[productId]` | `[store]/products/[productId]/` | Standard | Detail/Edit | Product edit form |
| `/{store}/products/collections` | `[store]/products/collections/` | Standard | List | Collection management |
| `/{store}/products/inventory` | `[store]/products/inventory/` | Standard | List | Inventory levels table |
| `/{store}/products/purchase-orders` | `[store]/products/purchase-orders/` | Standard | List | Purchase order list |
| `/{store}/products/transfers` | `[store]/products/transfers/` | Standard | List | Stock transfer list |
| `/{store}/products/gift-cards` | `[store]/products/gift-cards/` | Standard | List | Gift card management |
| `/{store}/categories` | `[store]/categories/` | Standard | List | Product category tree |

#### Marketing & Customers
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/customers` | `[store]/customers/` | Standard | List | Customer list, views, bulk ops |
| `/{store}/coupons` | `[store]/coupons/` | Standard | List | Discount/coupon list |
| `/{store}/reviews` | `[store]/reviews/` | Standard | List | Product review moderation |

#### Content
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/pages` | `[store]/pages/` | Standard | List | Site pages |
| `/{store}/posts` | `[store]/posts/` | Standard | List | Blog posts |
| `/{store}/comments` | `[store]/comments/` | Standard | List | Blog comments moderation |

#### Online Store (Sales Channel)
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/online-store/themes` | `[store]/online-store/themes/` | Standard | List | Theme library |
| `/{store}/online-store/themes/[themeId]/editor` | `[store]/online-store/themes/[themeId]/editor/` | **Full-screen bypass** | Canvas editor | Theme editor (no shell) |
| `/{store}/online-store/pages` | `[store]/online-store/pages/` | Standard | List | Storefront page list |
| `/{store}/online-store/preferences` | `[store]/online-store/preferences/` | Standard | Settings form | Storefront preferences |

#### Analytics
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/analytics` | `[store]/analytics/` | Standard | Dashboard | Store analytics |

#### App Marketplace
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/apps` | `[store]/apps/` | Standard | List | Installed apps + marketplace |
| `/{store}/apps/[installationId]` | `[store]/apps/[installationId]/` | Standard | Detail | Embedded app iframe |

#### Site-type-specific routes
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/projects` | `[store]/projects/` | Standard | List | Portfolio projects (portfolio type) |
| `/{store}/gallery` | `[store]/gallery/` | Standard | List | Image gallery (portfolio type) |
| `/{store}/testimonials` | `[store]/testimonials/` | Standard | List | Testimonials (portfolio type) |
| `/{store}/experience` | `[store]/experience/` | Standard | List | Work experience (resume type) |
| `/{store}/certifications` | `[store]/certifications/` | Standard | List | Certifications (resume type) |
| `/{store}/skills` | `[store]/skills/` | Standard | List | Skills (portfolio + resume type) |
| `/{store}/education` | `[store]/education/` | Standard | List | Education (portfolio + resume type) |
| `/{store}/leads` | `[store]/leads/` | Standard | List | Lead capture (landing type) |
| `/{store}/appearance` | `[store]/appearance/` | Standard | List | Theme/appearance for non-store types |
| `/{store}/contact` | `[store]/contact/` | Standard | Settings form | Contact form settings |
| `/{store}/export` | `[store]/export/` | Standard | Form | Data export |

#### Plan / Subscription (Full-screen bypass)
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/access_account/checkout/select-plan` | `[store]/access_account/checkout/select-plan/` | **Full-screen bypass** | Wizard | Plan selection |
| `/{store}/access_account/checkout/checkout` | `[store]/access_account/checkout/checkout/` | **Full-screen bypass** | Checkout | Plan checkout |

#### Auth (store-scoped)
| Route | Path | Layout Type | Page Type | Description |
|-------|------|-------------|-----------|-------------|
| `/{store}/login` | `[store]/login/` | Custom | Auth redirect | Store-scoped login redirect |

### `[store]/settings` routes — Settings layout (HeaderBar only, no sidebar)

All settings routes use `SettingsPane` which wraps `Page + PageHeader(breadcrumb: Settings→X)`.

| Route | Path | Page Type | Description |
|-------|------|-----------|-------------|
| `/{store}/settings` | `[store]/settings/` | Settings hub | Settings index (home) with category links |
| `/{store}/settings/general` | `[store]/settings/general/` | Settings form | Store name, email, currency |
| `/{store}/settings/business` | `[store]/settings/business/` | Settings form | Business info, GSTIN, address |
| `/{store}/settings/payments` | `[store]/settings/payments/` | Settings form | Razorpay + COD config |
| `/{store}/settings/shipping` | `[store]/settings/shipping/` | Settings form | Shipping zones + rates |
| `/{store}/settings/taxes` | `[store]/settings/taxes/` | Settings form | GST tax config |
| `/{store}/settings/checkout` | `[store]/settings/checkout/` | Settings form | Checkout preferences |
| `/{store}/settings/policies` | `[store]/settings/policies/` | Settings form | Refund/shipping/privacy policies |
| `/{store}/settings/domains` | `[store]/settings/domains/` | Settings form | Custom domain setup + CNAME |
| `/{store}/settings/notifications` | `[store]/settings/notifications/` | Settings form | Notification preferences |
| `/{store}/settings/users` | `[store]/settings/users/` | Settings list | Team members + roles |
| `/{store}/settings/billing` | `[store]/settings/billing/` | Settings mixed | Plan billing, invoices, payment methods |
| `/{store}/settings/billing/profile` | `[store]/settings/billing/profile/` | Settings form | GSTIN billing profile |
| `/{store}/settings/plan` | `[store]/settings/plan/` | Settings form | Plan details + upgrade |
| `/{store}/settings/security` | `[store]/settings/security/` | Settings form | 2FA, step-up auth |
| `/{store}/settings/apps` | `[store]/settings/apps/` | Settings list | App permissions/installed apps |
| `/{store}/settings/localization` | `[store]/settings/localization/` | Settings form | Language/locale settings |
| `/{store}/settings/custom-data` | `[store]/settings/custom-data/` | Settings form | Metafields/custom data |
| `/{store}/settings/subscribe` | `[store]/settings/subscribe/` | Redirect | Subscribe redirect |
| `/{store}/settings/subscribe/checkout` | `[store]/settings/subscribe/checkout/` | **Full-screen bypass** | Subscription checkout |

### API routes (not page routes)

`app/api/stores/[store]/*` — all gateway proxy routes:
- `analytics`, `billing`, `blog-comments`, `categories`, `collections`, `commission`, `content`, `coupons`, `customers`, `dashboard`, `domains`, `form-submissions`, `founding`, `gift-cards`, `inventory`, `kyc`, `localization`, `media`, `navigation`, `notifications`, `orders`, `pages`, `payment-config`, `payouts`, `plan`, `policies`, `posts`, `products`, `reviews`, `security`, `settings`, `shipping`, `taxes`, `upload`, `users`

`app/api/themes/[themeId]/*` — theme management:
- `editor/draft`, `preview-session`, `releases`, `sections`, `install`, `publish`

`app/api/plans`, `app/api/founding-pricing` — platform plan data

`app/api/auth/logout`, `app/api/subscribe/*` — auth ops

---

## Information Hierarchy Patterns

### Standard List Page Hierarchy

```
Level 1: Route (URL context: /{store}/products)
Level 2: Page = mx-auto max-w-page flex-col gap-page-gap
Level 3: PageHeader = breadcrumb + icon + title + description + actions
Level 4: Card = bordered container
Level 5: Section = padded area with title/description
Level 6: Table toolbar = search + filter chips + bulk actions + tabs
Level 7: Table rows = sortable, clickable, navigates to detail
```

### Dashboard Hierarchy

```
Level 1: Route (/{store}/dashboard)
Level 2: Page = flex-col gap
Level 3: PageHeader = store name + eyebrow + description + CTAs
Level 4a: Banner (conditional — plan, draft status)
Level 4b: MetricCards grid (4-up on xl, 2-up on md)
Level 4c: SetupGuide Card = circular progress + checklist steps (5 steps)
Level 4d: RecentActivity Card = activity feed list
Level 4e: PlanUpsell Card = conversion CTA
```

### Settings Page Hierarchy

```
Level 1: Route (/{store}/settings/*)
Level 2: SettingsPane = Page wrapper
Level 3: PageHeader = "Settings > X" breadcrumb + description
Level 4: [optional guidance Banner]
Level 5a: stat grid (for billing — 3-col metric cards)
Level 5b: settings-home-card div sections (custom CSS, not ui Card)
Level 6: section label + form body or Table
```

Note: Settings pages use custom CSS class system (`settings-home-card`, `settings-general-stack`, `billing-stat-card`) rather than the `Card + Section` pattern used in list/dashboard pages.

### Theme Editor

Full-screen canvas — bypasses all layout primitives. No `Page`, `Card`, or `Section`. Direct full-viewport render.

---

## Page Type Classification Summary

| Page Type | Count | Layout Mode | Shell | PageHeader | Card+Section |
|-----------|-------|-------------|-------|-----------|--------------|
| List (table) | ~20 | Standard | Full | Yes | Yes |
| Dashboard | 1 | Standard | Full | Yes (showIcon=false) | Metric grids + Setup card |
| Settings form | ~15 | Settings | HeaderBar only | Via SettingsPane | No (custom CSS) |
| Settings list | ~2 | Settings | HeaderBar only | Via SettingsPane | Table only |
| Product/content create | ~3 | Standard | Full | Yes | Yes |
| Detail/edit | ~3 | Standard | Full | Yes | Yes |
| Theme editor | 1 | Full-screen | None | No | No |
| Plan checkout | 2 | Full-screen | None | No | No |

---

## Navigation Sections by Site Type

The sidebar navigation adapts to the merchant's `site_type`:

### store (most common)
Sections: Primary (Home/Orders/Money/Products/Marketing/Content), Sales Channels (Online Store), Apps (Add), Footer (Settings)

### portfolio
Sections: Primary (Home/Content[Projects+Gallery+Pages]/Profile[Skills+Education+Testimonials]/Marketing[Contact]/Online Store[appearance]), Apps, Footer (Settings)

### resume
Sections: Primary (Home/Profile[Experience+Education+Skills+Certifications]), Analytics, Apps, Footer (Settings)

### landing
Sections: Primary (Home/Content[Pages]/Marketing[Leads]/Online Store[appearance]), Analytics, Apps, Footer (Settings)

### blog
Sections: Primary (Home/Content[Posts+Categories+Comments+Pages]/Online Store[appearance]), Analytics, Apps, Footer (Settings)

---

## Component Dependency Map

```
Page (max-width container)
  PageHeader (@letbuyy/ui)
    Breadcrumbs (@letbuyy/ui)
    MaterialIcon (@letbuyy/ui)
    Button (@letbuyy/ui)
  Card (@letbuyy/ui)
    Section (@letbuyy/ui)
      Table (@letbuyy/ui)
        EmptyState (@letbuyy/ui)
        Skeleton (@letbuyy/ui)
      Input (@letbuyy/ui)
      Badge (@letbuyy/ui)
      Banner (@letbuyy/ui)
  SettingsPane (components/settings/SettingsPane.tsx)
    → wraps Page + PageHeader + optional SaveBar
  MetricCard (@letbuyy/ui)
  EmptyState (@letbuyy/ui)

AdminShell (components/AdminShell.tsx)
  HeaderBar (components/HeaderBar.tsx)
    NotificationsPanel
    store-switcher (bottom-sheet on mobile)
  AppNavigation (@letbuyy/ui)
    AppFrame + Sidebar + Navigation
  CommandPalette (components/CommandPalette.tsx)
  AISidebar (components/AISidebar.tsx)
  TrialBanner (components/TrialBanner.tsx)
```

---

## Route-Level Shell Mode Decision Tree

```
pathname includes /editor?
  YES → Full-screen (no header, no sidebar)
pathname includes /access_account/checkout?
  YES → Full-screen
pathname includes /subscribe/checkout?
  YES → Full-screen
pathname includes /settings?
  YES → Settings mode (HeaderBar only, no sidebar)
  NO  → Standard mode (HeaderBar + sidebar + AppNavigation)
```
