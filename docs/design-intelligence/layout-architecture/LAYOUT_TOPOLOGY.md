# Layout Topology — LetBuyy Platform
Generated: 2026-06-19

---

## Global Layout Primitives (`@letbuyy/ui`)

### Source locations
- `packages/typescript/ui/src/app-shell.tsx` — shell primitives
- `packages/typescript/ui/src/layout.tsx` — page-level layout
- `packages/typescript/ui/src/navigation/app-navigation.tsx` — canonical data-driven shell

### Layout shells

#### `AppFrame` (`app-shell.tsx`)
The root frame. A `div.flex.min-h-screen` with two children:
- Left: `sidebar` slot (optional)
- Right: a `flex-col` containing optional `header` + `main.min-w-0.flex-1.overflow-auto`

```
AppFrame
├── {sidebar} (optional)
└── div.flex.flex-col.flex-1
    ├── header.border-b (topBar, optional)
    └── main.overflow-auto (children)
```

#### `Sidebar` (`app-shell.tsx`)
Fixed-width `aside` with three zones: optional `header`, scrollable `content`, optional `footer`.
- Width variants: `sm = 220px`, `md = 260px` (default), `lg = 320px`
- Background: `--lb-component-sidebar-bg`
- Border-right: `--lb-component-sidebar-border`

#### `Navigation` (`app-shell.tsx`)
- Renders a `<ul>` of `NavItem` components
- Two-level hierarchy: parent items with optional collapsible children
- Active state: `bg-[--lb-component-sidebar-active-bg]` / `text-[--lb-component-sidebar-active-text]`
- Children indent under icon column (CSS `pl-[calc(space-3+icon-size+space-2)]`)
- Badges supported on parent items (numeric or text)
- Chevron rotates 90deg when open

#### `AppNavigation` (`navigation/app-navigation.tsx`)
**The canonical shell** — composes `AppFrame + Sidebar + Navigation` from a `sections: AppNavigationSection[]` prop. Active state computed automatically from `usePathname()`. Sections can have an optional `title` (displayed as uppercase caption label).

#### `Page` (`layout.tsx`)
`<main>` element with:
- `mx-auto` centering
- `max-w-[--lb-size-page-max]` width constraint
- `px-[--lb-space-3] py-[--lb-space-3]` (mobile) → `sm:px-[--lb-density-card-padding] sm:py-[--lb-density-page-gap]`
- `flex flex-col gap-[--lb-density-page-gap]`

#### `PageHeader` (`layout.tsx`)
The canonical page introduction block. Contains:
- Optional `Breadcrumbs` (hidden by default, `showBreadcrumbs` prop)
- Optional `eyebrow` label (uppercase caption, primary color)
- `<h1>` with auto-resolved `MaterialIcon` (from page title)
- Optional `description`
- Optional `primaryAction` + `secondaryActions[]` (right-aligned on md+, stacked mobile)
- Min-height: `--lb-density-header-height`
- Responsive: stacks vertically on mobile, row on `md+`

#### `Card` (`layout.tsx`)
`<section>` with border, background, rounded corners, optional shadow. Layout variants: `default`, `stack`, `split` (2-col grid on md+).

#### `Section` (`layout.tsx`)
Inside `Card`. Has optional `title` (h2), `description`, `action` slot, and `columns` (1/2/3) grid for children. Padding: `--lb-density-card-padding`.

#### `Container` (`layout.tsx`)
Centering wrapper. Width options: `sm/md/lg/xl/page/measure/full`. Default: `max-w-[--lb-size-page-max]`, centered with `mx-auto`.

#### `Box`, `BlockStack`, `InlineStack`, `Grid`, `Columns` (`layout.tsx`)
Primitive layout atoms using `--lb-space-*` gap tokens. All use `min-w-0` for truncation safety.

### Typography
`Text` component with variants: `display`, `heading`, `body`, `caption`, `subdued`, `strong`, `positive`, `negative`, `code`. All tokens via `--lb-font-size-*`, `--lb-color-text-*`.

### PageIdentity system
15 canonical page identities with auto-resolved icons from page title text: `dashboard`, `products`, `orders`, `collections`, `inventory`, `customers`, `analytics`, `marketing`, `discounts`, `content`, `settings`, `apps`, `themes`, `payments`, `domains`.

---

## Per-Application Layout Analysis

---

### Merchant Control Plane (`apps/merchant-control-plane`)

**Layout Type:** Dashboard

**Layout Tree:**
```
html (LetbuyyThemeProvider surface="admin")
└── body.antialiased
    └── RootLayout (fonts + ThemeScript)
        └── [store]/layout.tsx → AdminShell (auth guard: session + store ownership)
            ├── [FULL-SCREEN MODE] ToastProvider + {children}  // /editor, /access_account/checkout, /subscribe/checkout
            ├── [SETTINGS MODE]
            │   ├── HeaderBar (fixed top)
            │   └── div.admin-settings-wrapper (paddingTop=admin-header-height)
            │       └── {children} → SettingsPane → Page + PageHeader + content
            └── [STANDARD MODE]
                ├── HeaderBar (fixed top, z-indexed)
                ├── sidebar overlay button (mobile only when open)
                └── AppNavigation (width="sm")
                    ├── Sidebar (220px, sticky top=header-height, height=100vh-header)
                    │   ├── header: brand area
                    │   ├── navigation sections (primary / Sales channels / Apps)
                    │   └── footer: Navigation (Settings + sub-items)
                    └── main content area
                        ├── AISidebar (inline panel, pushes content, togglable)
                        └── {children} → Page + PageHeader + Card/Section content
```

**Sidebar:**
- Width: `sm = 220px`
- Collapsible: YES — hidden on mobile (`hidden lg:flex`), slide-in overlay on mobile via hamburger
- Mobile: full-height slide-in from left, backdrop overlay closes it
- Desktop: sticky, `height: calc(100vh - admin-header-height)`, `self-start`
- Navigation sections: **Primary** (Home/Orders/Money/Products/Marketing/Content), **Sales channels** (Online Store), **Apps** (Add)
- Footer navigation (inside sidebar bottom): Settings with children

**Header/Topbar (HeaderBar):**
- Fixed position, full-width, `z-50` equivalent
- Left: hamburger (mobile) + LetBuyy logo (links to dashboard)
- Center: Command palette search trigger (`⌘K`)
- Right: mobile search icon, AI assistant toggle, notifications bell, store-switcher pill
- Store-switcher pill: shows store initials + name + chevron, opens dropdown (desktop) or bottom sheet (mobile)
- Bottom sheets on mobile for switcher and notifications

**Content Area:**
- Scrolls: `main.overflow-auto` from AppFrame
- Max-width: `--lb-size-page-max` via `Page` component
- Padding: `--lb-density-card-padding` (horizontal), `--lb-density-page-gap` (vertical)
- Gap between page sections: `--lb-density-page-gap`

**Page Header Pattern:**
- Every page renders `<PageHeader>` with: `eyebrow` (section category), `title` (page name), `description` (one liner), `breadcrumbs` (Home → Page), `primaryAction` (CTA button), optional `secondaryActions`
- Icon auto-resolved from title via `resolvePageIdentity`

**Responsive Behavior:**
- Mobile breakpoint: 768px (`isMobile` check in HeaderBar)
- Sidebar: hidden below `lg` (1024px), hamburger-triggered overlay
- PageHeader: stacks vertically on mobile, `md:flex-row` on desktop
- Actions: `[&>*]:max-sm:flex-1` makes buttons full-width on mobile
- Store switcher + notifications: bottom sheet pattern on mobile

**Navigation Pattern:** Left sidebar (permanent desktop, drawer mobile)

**Key Page Types Found:**
1. **Dashboard page** — `Page > PageHeader > MetricCards grid + SetupCards Card + RecentActivity Card + PlanUpsell Card`
2. **List page** — `Page > PageHeader > Card > Section > Table` (with SavedViews tabs, search, sort, bulk actions, EmptyState)
3. **Settings page** — `SettingsPane` wrapper → `Page > PageHeader(breadcrumb: Settings→X) > [stat cards] > [settings-home-card divs] > Table`
4. **Product detail page** — `Page > PageHeader > Grid(2-col) > Card/Section forms`
5. **Theme editor** — full-screen bypass (no shell)
6. **Checkout/Plan selection** — full-screen bypass (no shell), ToastProvider only
7. **Payouts page** — `Page > PageHeader > Card > Section > Table`

**Settings sub-layout:**
Settings pages use a different shell path in `AdminShell` — no sidebar, only HeaderBar + `admin-settings-wrapper`. Pages use `SettingsPane` component which wraps `Page + PageHeader` with Settings breadcrumb automatically.

**AI Sidebar:**
An inline right-hand panel (`AISidebar`) that slides in beside the main content when the AI assistant is toggled. It pushes the content area (not an overlay). Toggled from the header.

**Layout Consistency:** 8/10
- Very consistent use of `Page + PageHeader + Card + Section` pattern
- Divergence: settings pages use `SettingsPane` (custom CSS classes like `settings-home-card`) instead of pure `@letbuyy/ui` Card/Section
- Theme editor is a complete exception (full-screen)
- Full-screen checkout flows bypass layout entirely

**Navigation items (store type — most complete):**

Primary section:
- Home → `/dashboard`
- Orders → `/orders` (children: Drafts, Abandoned checkouts)
- Money → `/settings/billing` (children: Billing, Payouts)
- Products → `/products` (children: Add product, Collections, Inventory, Categories, Purchase orders, Transfers, Gift cards)
- Marketing → `/coupons` (children: Customers, Discounts, Reviews)
- Content → `/pages` (children: Pages, Blog posts, Comments)

Sales channels section:
- Online Store → `/online-store` (children: Themes, Store pages, Preferences)

Apps section:
- Add → `/apps`

Footer section:
- Settings → `/settings` (children: General, Business, Payments, Shipping, Taxes, Checkout, Policies, Domains, Notifications, Users, Billing, Plan, Security, Apps, Localization, Custom data)

**Keyboard shortcuts:** `g h/o/p/i/c/m/d/r/t/y/a/x/s` + `n p` for quick navigation.

---

### Platform Console (`apps/platform-console`)

**Layout Type:** Dashboard (internal ops)

**Layout Tree:**
```
html (LetbuyyThemeProvider — default surface)
└── body.antialiased
    └── RootLayout
        ├── (auth)/layout.tsx → plain (no shell, just children)
        │   ├── /login
        │   └── /mfa
        └── (dashboard)/layout.tsx → AppNavigation (MFA required)
            ├── Sidebar (hidden below lg: hidden lg:flex)
            │   ├── brand: "LetBuyy" + "Console" badge (critical red)
            │   ├── Navigation (17 items, single section, no grouping)
            │   └── (no footer nav)
            └── main content area
                └── {children}
```

**Sidebar:**
- Width: default `md = 260px`
- Hidden below `lg` (no mobile hamburger — internal tool)
- Single flat section with 17 items, no grouping titles
- Brand: "LetBuyy" wordmark + red "Console" badge

**Header/Topbar:**
- ThemeToggleButton + user email + Logout button (right-aligned)
- No search, no store switcher

**Content Area:**
- Standard `AppFrame` main area
- Pages use `Page + PageHeader + Card/Section` from `@letbuyy/ui`

**Navigation Pattern:** Left sidebar (permanent desktop, not available mobile)

**Key Page Types:**
- Dashboard (Leadership Home) — metrics + summary
- Table/list pages (Merchant Directory, Revenue, Subscriptions, etc.)
- Detail pages (Merchant 360 `/merchants/[id]`)

**Responsive Behavior:**
- No mobile optimization evident — internal admin tool
- Sidebar hidden below `lg` but no hamburger substitute

**Layout Consistency:** 7/10 (less complex than merchant control plane)

---

### Identity Platform (`apps/identity-platform`)

**Layout Type:** Auth / Minimal

**Layout Tree:**
```
html (LetbuyyThemeProvider surface="identity")
└── body.antialiased
    └── RootLayout (no shell — children only)
        └── individual pages — self-contained layouts
            Pattern: div.auth-container > div.auth-card.onboard-card
```

**Sidebar:** None

**Header:** Present only as auth-top-bar (onboarding page):
- Language switcher (EN/HI/TA cycle)
- Theme toggle
- User avatar + dropdown (email + logout)
Not present on login/signup pages.

**Content Area:**
- Centered card layout: `div.auth-container` → `div.auth-card`
- Cards are ~400–500px wide, centered vertically and horizontally
- Background uses CSS variable `--lb-color-bg`
- Dark mode inline style in `<head>` for flash prevention

**Page Header Pattern:**
- Each step uses `<h1 className="auth-title">` + `<p className="auth-subtitle">`
- No `PageHeader` component from `@letbuyy/ui` — bespoke auth styles

**Auth pages use custom CSS classes:**
- `.auth-container`, `.auth-card`, `.auth-title`, `.auth-subtitle`
- `.auth-btn-primary`, `.auth-btn-secondary`
- `.onboard-card`, `.onboard-bento-grid`, `.onboard-bento-card`

**Navigation Pattern:** Step wizard (3-step for onboarding), no persistent nav

**Key Page Types:**
1. **Auth flow** — login, signup, forgot-password, check-email, set-password, reset-password, lookup
2. **Store selection** (`/select`) — card grid of user's stores
3. **Onboarding wizard** (`/onboarding`) — 3-step: Type → Details → Review
4. **OAuth flows** — `/oauth2/authorize`, `/oauth2/consent`, `/oauth2/callback`

**Responsive Behavior:**
- Auth cards are naturally centered, mobile-friendly by design
- Language support: EN/HI/TA (stored in `localStorage`)

**Layout Consistency:** 9/10 (very uniform auth pattern, intentionally minimal)

---

### Marketing Site (`apps/marketing-site`)

**Layout Type:** Marketing / Long-scroll

**Layout Tree:**
```
html (LetbuyyThemeProvider surface="storefront")
└── body.antialiased
    └── RootLayout (no shell — children only)
        └── page.tsx (uses Lenis for smooth scroll)
            ├── Header (sticky top nav, mega menus)
            ├── main
            │   ├── Hero
            │   ├── CapabilityMap
            │   ├── MerchantJourney
            │   ├── Features
            │   ├── Pricing
            │   ├── FAQ
            │   ├── EcosystemMap
            │   └── FinalCTA
            └── Footer
```

**Sidebar:** None

**Header:**
- Sticky positioned, scroll-aware (adds `scrolled` class after 50px)
- Logo left, horizontal nav center (with dropdown menus), actions right
- Desktop: horizontal nav with mega-menu dropdowns for "Why LetBuyy" and "Products"
- Mobile: hamburger → full-height slide-in drawer from right, panel navigation (AnimatePresence)
- Mega menus: feature cards + aside panel with highlights
- CTA: "Log in" (ghost) + "Start for free" (primary)

**Navigation Pattern:** Top horizontal nav with mega menus (desktop) / drawer with panel drill-down (mobile)

**Key Page Types:**
- Homepage (long-scroll marketing page with section anchors)
- Pricing page (`/pricing`)
- Sitemap (`/sitemap`)

**Responsive Behavior:**
- Mobile breakpoint: `1024px` (lg) for nav mode switch
- Mobile: hamburger replaces nav + "Start for free" inline link
- Drawer: full-height, slide from right with AnimatePresence

**Layout Consistency:** 9/10 (single page type, sections follow clear pattern)

**Smooth scrolling:** Lenis library at `duration: 1.2` on homepage.

---

### Storefront Runtime (`apps/storefront-runtime`)

**Layout Type:** Storefront / Customer-facing

**Layout Tree:**
```
html (LetbuyyThemeProvider surface="storefront")
└── body.antialiased
    └── RootLayout (minimal — fonts + ThemeScript + SpeedInsights)
        └── {children} (Liquid or React render paths)
```

**Sidebar:** None (storefront-specific layout determined by theme)

**Header/Nav:** Theme-owned — not defined in app layout

**Content Area:** Fully theme-controlled

**Layout Consistency:** N/A — theme-driven

---

## Layout Pattern Library

### List+Detail Pattern

Used throughout Merchant Control Plane:

```
Page
└── PageHeader (title + breadcrumb + primaryAction "Add X" + secondaryActions)
    Card
    └── Section (title="[Resource] list", description="N items shown")
        ├── div.grid — search Input + refresh Button
        ├── [error Banner if needed]
        └── Table
            ├── savedViews (tab filters: All/Active/Draft/Archived)
            ├── filterChips (removable active filters)
            ├── bulkActions (status changes, bulk ops)
            ├── sortable columns
            └── emptyState (EmptyState component with illustration + actions)
```

Pages following this: Products, Customers, Orders, Coupons, Reviews, Payouts, Purchase Orders, Inventory, Collections.

Row click: navigates to detail page `/{store}/{resource}/{id}`.

### Settings Page Pattern

Settings pages bypass the sidebar and use `SettingsPane` wrapper:

```
SettingsPane (Page wrapper)
├── PageHeader (breadcrumb: Settings → [Page Title])
├── [optional guidance Banner]
├── [stat grid: billing-stat-card / similar]
├── div.settings-home-card sections (CSS class-based, not ui Card)
│   ├── div.settings-home-section-label (section title)
│   └── div.settings-form-body (form fields)
└── [optional SaveBar for unsaved changes]
```

Note: Settings pages currently mix `@letbuyy/ui` components (PageHeader, Table, Skeleton) with custom CSS classes (`settings-home-card`, `settings-general-stack`). This is an inconsistency vs. list pages which use `Card + Section` exclusively.

### Dashboard Pattern

```
Page
├── PageHeader (showIcon=false, eyebrow=site_type, primaryAction="X", secondaryAction="Settings")
├── PlanBanner (dismissible warning banner if trial)
├── FoundingMerchantCard (founding program card)
├── MetricCards grid (2-col md, 4-col xl — Revenue/Orders/Visitors/Conversion)
├── SetupGuide Card (circular progress + checklist steps)
└── RecentActivity Card + PlanUpsell Card
```

### Auth Flow Pattern

All identity-platform pages:

```
div.auth-container (full-viewport center)
└── div.auth-card [+ .onboard-card for wider]
    ├── div.auth-logo (BrandLogo)
    ├── [optional auth-top-bar for onboarding]
    ├── [error div.auth-error if needed]
    ├── h1.auth-title
    ├── p.auth-subtitle
    ├── [form / step content]
    └── [action buttons]
```

Onboarding is 3-step controlled by `step` state (1→2→3).

### Creation Wizard Pattern

Onboarding wizard (`/onboarding`) uses client-side state machine:
- Step 1: Bento grid of site type cards
- Step 2: Text inputs (store name, subdomain with live validation)
- Step 3: Review summary with industry picker + confirm

Theme editor also uses a wizard/full-screen approach (bypasses shell entirely).

Plan checkout flows (`/access_account/checkout/select-plan`, `/settings/subscribe/checkout`) are full-screen — shell completely bypassed via `isFullScreenFlow` check in `AdminShell`.

### Empty State Pattern

Consistent `EmptyState` component usage across all list pages:
- Illustration variant (PNG images in `/Emptystate Illustration/`) for primary empty states
- Icon variant for filtered/error empty states
- Always includes: title + body + primaryAction + optional secondaryAction

Resources with custom illustrations: Products, Customers, Past Bills.

### Page Header with Actions Pattern

All merchant pages have a consistent top-of-page action bar:
```
PageHeader
├── [breadcrumbs: Home → Page]
├── [eyebrow: section category e.g. "Catalog", "Relationships"]
├── h1: page title with auto-icon
├── [description]
└── [right side]
    ├── secondaryActions (outline buttons)
    └── primaryAction (filled button, often "Add X")
```

Mobile: actions stack below title, each takes `flex-1` width.
