# Shopify App Store — Complete UI/UX Teardown & LetBuyy Build Spec

**Source:** `https://apps.shopify.com/` (live, fetched June 2026 — home, app detail, category landing, faceted `/all` browse, search, partner profile).
**Purpose:** an exact, build-ready blueprint of every Shopify App Store surface so the LetBuyy Apps Marketplace can match its structure, information architecture, component anatomy, and interaction quality.
**Target file home:** this doc lives with the marketplace audit set; pair it with [`LETBUYY_APPS_MARKETPLACE_V2.md`](LETBUYY_APPS_MARKETPLACE_V2.md).
**Date:** 2026-06-07

---

## 0. How to use this spec (parity rules — read first)

**Clone the *structure*, brand it as LetBuyy.** Match Shopify **exactly** on: layout, grid, information architecture, page anatomy, component composition, states, responsive behavior, and interaction/motion. Apply **LetBuyy's own** brand on: color palette (LetBuyy purple, not Shopify's black/green), logo, copy, and imagery. Do **not** copy Shopify's proprietary text, icons, screenshots, or the literal "Built for Shopify" mark — build LetBuyy equivalents ("Built for LetBuyy", LetBuyy partner badges) with the same UX role. This is competitive UX parity, not asset reproduction; it's also better product (LetBuyy already has a purple design system in `@letbuyy/ui`).

**Two layers of "exact":**
- **Structural parity (copy 1:1):** spacing rhythm, grid columns, card anatomy, section order, filter/sort/pagination behavior, gallery/lightbox, mega-menu, review histogram, pricing-plan layout.
- **Brand layer (LetBuyy):** tokens in §2 map Shopify's observable system to LetBuyy variables. Use the LetBuyy column.

**Method note / honesty:** page layouts, section order, copy patterns, counts, breadcrumb, meta labels, pricing-tag variants, and pagination format are taken verbatim from the live SSR HTML. Search results and the feature-facet sidebar render **client-side** (the SSR shell shows "We are having trouble loading your results / Try again"), so those two are reconstructed from (a) the identical result-card markup on the SSR category `/all` page and (b) the feature-tag taxonomy exposed on app-detail pages. Exact hex/px **token values** are a faithful reconstruction of Shopify's observable system — confirm against browser devtools if you need pixel-perfect values; all **structural** specs are exact.

---

## 1. The system at a glance

Shopify App Store is a **marketing-grade storefront** (not the Polaris admin UI) sitting over a catalog. Its quality comes from five things LetBuyy must replicate:

1. **A small, fixed top-level taxonomy** (7 categories) with rich descriptions, surfaced in a mega-menu and everywhere.
2. **Editorialized discovery** — curated rails ("Built for Shopify", "Popular with merchants", "In the spotlight", "Made by Shopify"), story/guide cards, merchant tech-stack callouts — not just a grid.
3. **One dense, trustworthy app card** reused across every surface.
4. **A deep, scannable app-detail page** — gallery, plans, feature tags, rating histogram, AI review summary, works-with, reviews with merchant provenance.
5. **A faceted browse** (filters + sort + numbered pagination) over hundreds of apps per leaf category.

**Page types (full inventory):** Home · Category landing · Subcategory faceted browse (`/all`) · Search results · App detail · Collection/Story (editorial) · Partner profile · Stories index · (+ legal/sitemap). Plus global chrome (nav, footer) and modals (login, install).

---

## 2. Design tokens (Shopify observed → LetBuyy mapping)

> Use the **LetBuyy** column. Values are an 8px-based reconstruction faithful to Shopify's observable system.

### 2.1 Color

| Role | Shopify (observed) | LetBuyy token (use this) |
|---|---|---|
| Page background | `#FFFFFF` | `--lb-color-bg: #FFFFFF` (dark: existing `.dark`) |
| Surface / card | `#FFFFFF` with hairline border | `--lb-color-surface` |
| Surface subdued | `#F6F6F7` / `#FAFAFB` | `--lb-color-surface-subdued` |
| Text strong (headings) | `~#0A0A0A` | `--lb-color-text` |
| Text body | `~#303030` | `--lb-color-text` |
| Text subdued/meta | `~#616161` | `--lb-color-text-subdued` |
| Hairline border | `~#E1E3E5` | `--lb-color-border` |
| Primary CTA | black `#1A1A1A` text white (Shopify) | **LetBuyy purple** `--lb-color-primary: rgb(139 92 246)` (keep LetBuyy brand, not black) |
| Link | dark, underline-on-hover | `--lb-color-primary` |
| Rating star | filled near-black star glyph | LetBuyy: filled `--lb-color-primary` or a fixed star color; keep consistent |
| Quality badge (BFS) | dark text + checkmark, subtle | "Built for LetBuyy" = `--lb-color-success` accent + shield/check |
| Success / sponsored tag | muted | `--lb-color-success` / neutral chip |

LetBuyy keeps its **purple-first** identity (`globals.css :17`). Don't adopt Shopify's black CTAs — map "primary action" to LetBuyy purple.

### 2.2 Typography

- **Family:** Shopify uses a custom grotesque ("ShopifySans"); LetBuyy already ships **Geist** via `@letbuyy/ui` (`layout.tsx`). Keep Geist.
- **Type scale (px → rem at 16px base), faithful to Shopify rhythm:**

| Token | Size / line-height / weight | Used for |
|---|---|---|
| `display` | 44–56 / 1.1 / 700 | home/category hero H1 |
| `h1` | 28–32 / 1.2 / 700 | page titles, app name |
| `h2` | 22–24 / 1.25 / 600 | section titles ("Popular with merchants") |
| `h3` | 18–20 / 1.3 / 600 | card cluster titles, plan names |
| `body-lg` | 16 / 1.5 / 400 | app pitch, intros |
| `body` | 14 / 1.5 / 400 | card text, meta |
| `caption` | 12–13 / 1.4 / 500 | rating counts, tags, eyebrows |
| `eyebrow` | 12 / 1.3 / 600 uppercase tracked | "Featured app", "Guide" labels |

**Fluid:** use `clamp()` for `display`/`h1` (this is exactly the gap flagged in `APPS_RESPONSIVENESS_REPORT.md` #68).

### 2.3 Spacing, grid, radius, shadow, motion

- **Spacing scale (8px base):** 4, 8, 12, 16, 24, 32, 48, 64, 96. Section vertical rhythm ≈ **64–96px** desktop, 40–48 mobile.
- **Container:** max-width **~1200px**, centered, side gutters 24px (16 mobile).
- **Grids:** app-card rails/grids = **3 columns** desktop (`repeat(3, 1fr)`), 2 tablet, 1 mobile, gap 16–24. Category subsection grids 3-up. Faceted browse = **single-column list** of row cards (filter rail left on desktop).
- **Radius:** card/media `12–16px` (`--lb-radius-lg`), pills/badges `999px` (full), inputs `8px`.
- **Shadow:** cards rest on a hairline border (no heavy shadow); hover = subtle `0 4px 12px rgba(0,0,0,.08)` + border darken.
- **Motion:** hover transitions 120–160ms ease; carousel slide ~300ms; mega-menu fade/slide 150ms. Respect `prefers-reduced-motion`.
- **Breakpoints:** `≥1280` wide, `1024–1279` desktop, `768–1023` tablet, `≤767` mobile, `≤480` small, `≤360` xs (match LetBuyy's existing set).
- **z-index:** sticky header `100`, mega-menu `200`, modal/overlay `1000`, toast `1100`.

---

## 3. Global chrome

### 3.1 Top navigation (sticky)

Left→right: **Logo** (→ `/`) · **Search** (icon + label; opens search) · **Browse apps** (opens mega-menu) · *(spacer)* · **Log in** (text) · **Start for free** (primary CTA). Height ~64px, white, hairline bottom border, sticky on scroll.

**"Browse apps" mega-menu** (two panels):
- **Panel A — "Apps by category":** the 7 top-level categories, each a **title + one-line description**:
  - Sales channels — "Sync products with marketplaces, product feeds, data backup, point of sale, retail"
  - Finding products — "Source products with dropshipping, print on demand, wholesale, suppliers"
  - Selling products — "Sell more with subscriptions, digital downloads, payments, COD, product options"
  - Orders and shipping — "Handle fulfillment with order tracking, invoices, order printers, shipping labels"
  - Store design — "Customize storefronts with SEO, translation, currency converters, trust badges"
  - Marketing and conversion — "Get customers with reviews, bundles, upsells, checkout, email marketing"
  - Store management — "Scale up with support, chat, FAQs, analytics, workflow automation"
- **Panel B — "App stories":** 2–3 promoted guide cards (thumbnail + "Guide" eyebrow + title) + "More stories" link.

*LetBuyy mapping:* LetBuyy's taxonomy is 29 flat categories (`constants/categories.ts`) grouped into 9 groups (Products/Selling/Orders/Marketing/Conversion/Design/Support/Analytics/Finance). **Collapse to ~7 top-level groups with descriptions** for the mega-menu, each expanding to its sub-categories — this is the single biggest IA upgrade.

**Mobile nav:** hamburger → drawer with: search, the 7 categories (accordion), App stories, Log in, Start for free. (LetBuyy already has a drawer at ≤768px; restructure to this content.)

### 3.2 Search

Trigger in nav → full search experience at `/search?q=…`. Page title pattern: **"Search results for "{q}""**. Results = the standard result-card list + the same filter rail and sort as faceted browse. Loading = skeleton cards; error = inline "We are having trouble loading your results. Try again"; no-results = suggestions + popular categories.

### 3.3 Footer (4 link groups + legal row)

- **App categories:** the 7 top-level categories.
- **Top categories:** 8 high-intent leaf links (Dropshipping, Marketplaces, Product reviews, Upsell and bundles, Email marketing, SEO, Shipping, Currency and translation).
- **Resources:** Help Center, API documentation, Community, Community Events, Blog, Research.
- **Company ("Shopify"→"LetBuyy"):** About, Careers, Investors, Press, Partners, Affiliates, Legal, Service status.
- **Legal row:** Developer login · Terms · Privacy · Sitemap · Your privacy choices (+ CCPA icon) · **locale switcher** (long language list).

*LetBuyy mapping:* mirror these 4 groups + legal row; **fix the stale `letbuyy.store` links** flagged in the audit (#28) and point Resources at the real `/developers/docs` built in V2.

### 3.4 Modals

- **Login modal:** "Log in to your {platform} store" — Store URL field, "Sign up" link, Log in button, Developer login link, close (X).
- **Install modal:** "Install — To install this app you need to create a {platform} account or log in… then select a store." → Create account / Log in; ToS+Privacy microcopy.
- **Incompatibility modal:** "This app isn't compatible with your store" + reasons + "Learn about app compatibility".

---

## 4. Core component kit (reused everywhere)

### 4.1 App Card — variant A: **grid/rail card** (home, category grids, "More apps like this")

Vertical card, hairline border, radius 12–16, padding 16–20. Anatomy top→bottom:
1. **App icon** — rounded square ~48–64px (top-left or centered).
2. **App name** — `h3`, links to detail, 1 line (truncate).
3. **Rating row** — filled star glyph + "**4.9** out of 5 stars" + "**(5,688)**" count, `caption`, subdued. (Shopify also renders an SR-only "5688 total reviews".)
4. **Pricing tag** — one of: "Free", "Free plan available", "Free to install", "Free trial available", "$15/month" (see 4.4).
5. **Pitch** — one-line value prop, `body`, 1–2 lines (truncate).
6. **Quality badge** (if applicable) — "Built for {platform}" + "Meets our highest standards for performance, design, and integration. Learn more" (tooltip/secondary).

States: rest (border), hover (shadow + border darken + name underline), focus-visible (ring), loading (skeleton: icon block + 2 text lines + tag).

### 4.2 App Card — variant B: **full-width row card** (search & faceted `/all`)

Horizontal: **icon left** (64px) · content right (name → rating+count → pricing → pitch → BFS badge + Learn more). Full container width, stacked vertically with dividers/gaps. Same data as variant A, wider pitch (truncate ~1 line). This is the list used on `/all` and search.

### 4.3 Star rating

Filled star icon + `"{rating} out of 5 stars"` + `"({count})"`. Always pair rating with count; never show stars without a count. Half/empty handling: Shopify shows one star glyph + numeric value (not 5 separate stars in cards); the **detail page** shows the full distribution (see 5.6). LetBuyy: keep a single-star + value in cards, full histogram on detail.

### 4.4 Pricing tag

Exact variants observed: `Free` · `Free plan available` · `Free to install` · `Free trial available` · `$15 / month` · `From $99/month`. Render as plain `caption` text after a "•" separator in cards. (LetBuyy must reconcile its pricing taxonomy to this set — audit #35.)

### 4.5 Quality badge ("Built for Shopify" → "Built for LetBuyy")

Inline lockup: shield/check glyph + "Built for {platform}". On detail, expands to a sentence + "Learn more (opens in new window)" → the program story page. Backed by **real data** (LetBuyy audit #17/#31 — only render when the program awards it).

### 4.6 Buttons, pills, chips

- **Primary** (Start for free / Install): solid, LetBuyy purple, white text, radius 8, height 40–44, weight 600.
- **Secondary**: surface + border.
- **Text/link**: underline on hover.
- **Pills** (subcategory quick-filters, "Built for Shopify" filter): full-radius, border, active = filled tint.
- **Chips/tags** (feature handles): small, clickable, link to filtered `/all`.

### 4.7 Other primitives

Breadcrumbs (text + "/" or ">" separators, last = current, not linked); numbered pagination (`1 2 3 4 … 16 Next`/`Previous`); tabs/accordions ("Show features/Hide features"); tooltips; banners (info/warning/critical); section header (eyebrow + H2 + optional action link); **story/editorial card** (image + eyebrow + title + CTA); **testimonial block** (quote + person + company + app used); **value-prop block** (icon + title + sentence); **carousel/gallery** (slides + prev/next + lightbox); **video hero** (looping muted bg video with poster fallback).

---

## 5. Page anatomies (exact, section-by-section)

Each page = global nav → page sections (below) → footer. Order is exact to the live site.

### 5.1 Home / directory (`/`)

The home page is a **sequence of curated rails and editorial blocks**, not a catalog grid. Order:

1. **Hero — "Get the best apps for your business with Built for {platform}"** + CTA "See why these shine" (→ BFS story). Sets the quality-program frame immediately.
2. **Recommended-for-you BFS rail** — 6 app cards (grid variant A), each with the Built-for badge. (Shopify: PageFly, Section Store, UpPromote, Hulk Forms, Canva, Smile.)
3. **"Popular with merchants across {platform}"** — 6 app cards (no badge requirement; popularity-ranked).
4. **Story card — "Sell B2B / Streamline your B2B operations with apps."** + CTA "Go wholesale" (full-bleed editorial card with image).
5. **"In the spotlight"** — 4 app cards (newer/rising apps, often 5.0 with few reviews).
6. **"Featured app"** — single large editorial card (eyebrow "Featured app" + headline + CTA "Reduce returns") linking to a spotlight story.
7. **"Get that tech stack"** — 3 merchant tech-stack callouts (merchant uses {app} to {outcome}, with inline app icon) linking to stories.
8. **"Made by {platform}"** — rail of first-party apps (12 cards).
9. **"The {platform} app advantage"** — 3 value-prop blocks ("An epic variety of apps / 16,000+ apps", "Tried, tested, and vetted / 100-checkpoint review", "Merchant-powered algorithms / recommendations") + CTA "Start your free trial".
10. **"Want to add an app?"** — closing CTA band.

**Grid:** rails are 3-up desktop (2 tablet, 1 mobile), horizontally scrollable or wrapped. **Section header** pattern: H2 + (optional) description. *LetBuyy mapping:* replace 16,000/100-checkpoint with real LetBuyy numbers (or hide until real — audit truth rule); gate each rail on real catalog depth (#16); "Made by LetBuyy" = first-party apps; keep BFS rail = "Built for LetBuyy".

### 5.2 Category landing (e.g. `/categories/finding-products`)

Editorial category page. Title pattern: **"Best {Category} Apps For 2026"** (SEO). Order:

1. **Hero** — H1 "{Category} apps" + subtitle ("Stock your store with products they'll love.") + **subcategory pills** (e.g. Dropshipping / Print on demand / Wholesale) + **looping video/hero image** (mp4 with png poster).
2. **"Sponsored apps"** — 4 paid-placement cards (labeled Sponsored; carry `ot=` ad token). *LetBuyy:* this is the featured/sponsored inventory model (#56) — keep clearly labeled.
3. **"Popular with merchants across {platform}" / "Recommended {category} apps"** — grid of ~12 cards with BFS badges.
4. **Per-subcategory sections** — for each subcategory (Dropshipping, POD, Wholesale): H2 + one-line description + CTA ("Drop everything"/"Get into print"/"Wholesale away") + 8–9 app cards.
5. **Merchant tech-stack story** — "How {merchant} does it" editorial card (image + story + inline app link + CTA).
6. **Testimonial** — large quote + person/title/company + the app referenced + its card.
7. **Editorial "how-tos"** — 3 cards: **Guide / Blog / Video** (textured background cards) linking to long-form content.
8. **"Want to add an app?"** closing band.

### 5.3 Subcategory faceted browse (`/categories/{leaf}/all`)

The "see all" workhorse. Title: **"Best {Leaf} Apps For 2026"**. Anatomy:

1. **Breadcrumb** — `{Top category} > {Mid} > {Leaf}` (last not linked). e.g. "Marketing and conversion > Social trust > Product reviews".
2. **H1** "{Leaf} apps" + **subtitle** ("Inspire more people to buy with customer reviews and ratings.").
3. **Result count** — "**371 apps**".
4. **Filter rail** (left, desktop; drawer on mobile) — **Programs** filter chip "Built for {platform}" (`?programs[]=built_for_shopify`) + **feature facets** grouped by the category's feature taxonomy. (From app-detail we see the facet groups, e.g. for Product reviews: *Display options* — Testimonials, Photo reviews, Video reviews, Star ratings, Badges, Carousels, Media galleries, Grid layout, Tabs/sidebars, All-reviews page, Top reviews, Review summaries, Q&A, Product grouping, Filtering, Rich snippets; *Ways to collect reviews* — Email/SMS/Push requests, Social UGC, Forms, Surveys, QR codes, Promotions, Referrals, Import/export, Migration, Syndication, Automations, Custom requests.) Each facet → `?feature_handles[]=…`. Facets render client-side.
5. **Sort** (control near top-right of results) — relevance/popularity/rating/recent (client-side).
6. **Result list** — full-width **row cards** (variant B), ~20 per page.
7. **Pagination** — numbered: `1 2 3 4 … 16` + `Next`/`Previous` (and repeated below). URL `?page=N`.
8. Closing CTA + footer.

States: loading skeleton rows; error inline "We are having trouble loading your results. Try again"; empty = "No apps match these filters" + clear-filters.

*LetBuyy mapping:* this is exactly LetBuyy's weak spot — push rating filter server-side (#39), add pagination (#48), show ALL categories (#15), build the feature-facet rail (new), keep numbered pagination format.

### 5.4 Search results (`/search?q=…`)

Same chrome; **client-rendered** results. Anatomy: title "Search results for "{q}""; the **same filter rail + sort** as `/all`; **result grid/list** of cards (variant B); **pagination**. States: skeleton while loading; "We are having trouble loading your results. Try again" on error; no-results → query echo + suggested categories/popular searches. Debounced query, `AbortController` to cancel stale requests (LetBuyy already does this).

### 5.5 App detail (`/{app-handle}`) — the keystone page

Title pattern: **"{App name} - {short pitch} | {platform} App Store"**. Two-column on desktop (main content + sticky-ish sidebar), single column mobile. Full anatomy in order:

**A. Header block**
- App **icon** (large, ~80–96px) + **H1 app name**.
- **Quality badge** "Built for {platform}" + "Meets our highest standards for performance, design, and integration. Learn more (opens in new window)".
- **Awards** (optional) — e.g. "2025 Build Award Winner / For innovation and impact".
- **Meta strip** (definition-list style):
  - **Pricing:** "Free plan available. Free trial available." (+ short badge)
  - **Popularity:** "Popular with stores like yours / Based in {country}"
  - **Rating:** numeric (e.g. 5.0) + stars + "(36,149)" linking to `#adp-reviews`
  - **Developer:** name → partner profile
- **Primary CTA "Install"** + secondary **"View demo store"** (when a demo URL exists).

**B. Featured images gallery**
- Horizontal **carousel** of screenshots (desktop screenshot ratio ~16:9, served at multiple widths 640/1280/1600), "+N more" affordance, **Previous/Next** controls, click → **lightbox** (full-size, prev/next, close). Optional **demo video** below.

**C. Long description**
- Headline (app's own H2) + 1–2 intro paragraphs + **"more"** expander → full description; then a **bullet highlights** list (5 key capabilities).

**D. Attributes block**
- **Popular with stores like yours / Based in {country}**.
- **Languages** (comma list).
- **Works with** — integration chips (Checkout, Customer accounts, Flow, Admin, Klaviyo, Gorgias, …) — some link to extension/category pages.
- **Categories** — category chips → category pages.

**E. Feature tags ("Show features / Hide features")**
- Per the app's categories, expandable groups of **feature-handle chips** (each → faceted `/all?feature_handles[]=…`). This is what powers the browse facets (5.3).

**F. Pricing plans**
- Side-by-side **plan cards**: plan name (e.g. "Free" / "Awesome $15/month") + tier label ("Forever Free") + bulleted feature list per plan + trial note ("15-day free trial"). Footer microcopy: "All charges are billed in USD. Recurring and usage-based charges are billed every 30 days." + "See all pricing options" link.

**G. Reviews (`#adp-reviews`) — "Reviews ({count})"**
- **Overall rating** big number + stars.
- **Rating histogram** — rows 5→1, each: star level + "{pct}% of ratings are N stars" + count link (`?ratings[]=N`).
- **"What merchants think"** — AI-generated summary ("This is generated by {platform} Magic. Shown when an app has 100+ reviews and ≥4.0 rating") with Helpful / Not helpful feedback + "Feedback submitted" state + Show more.
- **"Write a review"** + **"All reviews"** link.
- **Review list** — each review: rating stars, **date**, body, **merchant name**, **country**, **duration using the app** ("Over 6 years using the app"), Show more. (LetBuyy already has verified-install reviews — add country + duration + provenance.)

**H. Support / Resources / Developer**
- "App support provided by {developer}." + Resources (Privacy policy, FAQ, Tutorial, App documentation) + **Developer** name + address + **"Launched {date}"** + **Changelog** link.

**I. "Featured in"** — editorial story cards the app appears in.

**J. "More apps like this"** — 3 related app cards (variant A, with badges).

**K. "Want to add an app?"** closing band + footer.

*LetBuyy mapping:* LetBuyy's detail page already has hero, gallery, pricing, permissions, reviews+histogram, related (audit). Add: **awards**, **meta definition-strip** layout, **"What merchants think" summary**, **review provenance (country + duration)**, **feature-tag chips**, **plan-card pricing layout**, **"View demo store"**, **changelog from `app_versions`** (built in V2), **"Featured in"**. Keep LetBuyy's strong consent/permission UX (it's already better-documented than Shopify's install).

### 5.6 Collection / Story (editorial) page (`/stories/{slug}`)

Long-form editorial: hero (image + eyebrow "Guide"/"Featured app" + title) + body sections (rich text, app callouts, app cards) + CTAs. Used for "Built for {platform}", "Build Awards", buying guides, spotlights. *LetBuyy:* this is the curation engine behind real Collections (#14) — build a story/collection content type.

### 5.7 Partner profile (`/partners/{slug}`)

Simple: **H1 "Apps by {Partner}"** + "**N apps**" + grid of that partner's app cards (variant A, with badges). Minimal chrome. *LetBuyy:* build from `GET /developers/:id` (audit #19; V2 wired it) — add this public grid.

### 5.8 Stories index (`/stories`)

Grid of story/guide cards (image + eyebrow + title) → individual stories. Footer.

---

## 6. Interaction & motion

- **Mega-menu:** hover/focus opens; fade+slide 150ms; full-width panel; closes on outside click/Esc; keyboard navigable.
- **Card hover:** border darken + subtle shadow lift + name underline (120–160ms).
- **Gallery carousel:** prev/next buttons + swipe; click opens **lightbox** (overlay 1000, full-size image, prev/next, close X, Esc to close, focus-trapped).
- **"Show features / more" expanders:** accordion expand/collapse; chevron rotate.
- **Sticky header:** condenses subtly on scroll; sidebar on detail can be sticky to viewport.
- **Lazy-loading & skeletons:** rails and result lists lazy-load; show skeleton cards while fetching; numbered pagination is full navigation (not infinite by default).
- **Filters/sort:** update results + URL query (shareable/deterministic); preserve on back.
- **Reduced motion:** disable carousel auto-advance and large transitions under `prefers-reduced-motion`.

## 7. Responsive system

| Breakpoint | Nav | Rails/grids | Faceted browse | Detail |
|---|---|---|---|---|
| ≥1280 wide | full nav + mega-menu | 3-up (rails may show 4) | filter rail + list | 2-col (content + sidebar) |
| 1024–1279 | full nav | 3-up | filter rail + list | 2-col |
| 768–1023 | full nav (tighter) | 2-up | filters collapse to top/drawer | 1-col, sidebar stacks |
| ≤767 | hamburger drawer | 1-up | filter **drawer** + list | 1-col; gallery swipe; meta stacks |
| ≤480 | drawer | 1-up | drawer | tighter padding |

Adopt **mobile-first + fluid type** (`clamp()`) — the exact responsiveness gaps in `APPS_RESPONSIVENESS_REPORT.md` (#68 fluid type, #69 system consistency).

## 8. Accessibility patterns

- Every card is a real `<a>`/`<article>` with an accessible name; rating has SR-only "{n} total reviews".
- Mega-menu & lightbox: keyboard operable, focus-trapped, Esc-closable, `aria-expanded`/`aria-modal`.
- Star rating: `aria-label="{rating} out of 5 stars"`; icons `aria-hidden`.
- Color contrast AA; visible focus rings; touch targets ≥44px. (Ties to audit #98.)

## 9. SEO & structured-data patterns (copy these)

- **Title templates:** Home "{platform} App Store"; Category "Best {Category} Apps For 2026"; Leaf "Best {Leaf} Apps For 2026"; Detail "{App} - {pitch} | {platform} App Store"; Search "Search results for "{q}"".
- **Meta description** per page; OG + Twitter card + OG image.
- **Breadcrumbs** on browse/detail (also as BreadcrumbList JSON-LD).
- **App detail:** `SoftwareApplication` + `AggregateRating` JSON-LD, `Offer` with price/currency. (LetBuyy already emits these — keep.)
- **Sitemap** with category + app URLs; canonical per page; `robots` index. (LetBuyy already has robots/sitemap.)

## 10. LetBuyy gap map — what to build / restyle (actionable)

Maps each Shopify pattern to LetBuyy's current state (from the audit) and the work to reach parity. Files are the LetBuyy marketplace surfaces.

| Shopify pattern | LetBuyy today | Work to reach parity | Files |
|---|---|---|---|
| 7-group mega-menu w/ descriptions | flat 29 categories, no mega-menu | Build mega-menu; collapse to ~7 groups + descriptions | `Header.tsx`, `constants/categories.ts` |
| Editorial home rails (BFS/Popular/Spotlight/Made-by) | single directory grid + 1 featured rail | Build curated rails gated on real data | `app/page.tsx`, new rail components |
| Category landing (hero video, subcat sections, testimonial, how-tos) | basic category page | Rebuild category landing to editorial layout | `(store)/categories/[slug]/page.tsx` |
| Faceted `/all` (filter rail + feature facets + sort + numbered pagination) | search w/ partial filters, no pagination, 14 cats hidden | Build feature-facet rail, server rating filter, numbered pagination, all categories | `(store)/search/page.tsx`, `(store)/categories/[slug]`, gateway list route |
| Result **row card** (variant B) | grid card only | Add row-card variant for list/search | `AppCard.tsx` (+ variant) |
| App-detail meta-strip + awards + "What merchants think" + review provenance + feature tags + plan cards + demo store + changelog | strong base (gallery, plans, reviews, histogram, related) | Add meta-strip layout, AI summary, country+duration on reviews, feature-tag chips, plan-card layout, demo link, changelog from `app_versions` | `(store)/apps/[slug]/page.tsx` |
| Story/collection content type | fake collections (audit #14) | Build real story/collection pages + index | new `(store)/stories/*`, `collections/*` |
| Partner profile public grid | placeholder (#19; V2 wired API) | Build "Apps by {Partner}" grid | `(auth)/developers/[slug]` → public |
| Sponsored/featured inventory (labeled) | none (#56) | Featured placement model + labeled cards | gateway + home/category |
| Footer 4-group + locale | footer w/ stale domain | Restyle to 4 groups; fix `letbuyy.store`→`letbuyy.com` (#28) | `Footer.tsx` |
| Fluid type + mobile-first | desktop-first, no `clamp()` (#68) | Adopt fluid type tokens + mobile-first | `globals.css`, `@letbuyy/ui` |
| "Built for LetBuyy" badge (real) | badge w/o data (#17/#31) | Wire to program data | `marketplace-display.ts`, gateway |

## 11. Build order & component checklist

**Recommended sequence (UI parity, on top of the V2 foundation):**
1. **Tokens** — add fluid type + confirm color/spacing/radius tokens (§2) in `@letbuyy/ui` + `globals.css`.
2. **Core kit** — App Card A+B, star rating, pricing tag, quality badge, buttons/pills/chips, breadcrumb, pagination, section header, story card, testimonial, value-prop, gallery+lightbox, video hero, mega-menu, footer.
3. **Home** — rebuild as curated rails (§5.1), gated on real catalog depth.
4. **Category landing** — editorial layout (§5.2).
5. **Faceted browse + search** — filter rail (programs + feature facets), sort, numbered pagination, row cards (§5.3–5.4).
6. **App detail** — add the missing blocks (§5.5).
7. **Story/collection + partner + stories index** (§5.6–5.8).
8. **Responsive + a11y + SEO** passes (§6–9).

**Component checklist (Definition of Done = matches §4 anatomy + states + responsive + a11y):**
`AppCardGrid` · `AppCardRow` · `StarRating` · `PricingTag` · `QualityBadge` · `Button(primary/secondary/text)` · `Pill` · `Chip` · `Breadcrumbs` · `Pagination` · `SectionHeader` · `MegaMenu` · `MobileNavDrawer` · `Footer` · `StoryCard` · `Testimonial` · `ValueProp` · `Gallery` · `Lightbox` · `VideoHero` · `FilterRail` · `SortControl` · `RatingHistogram` · `PlanCards` · `ReviewItem` · `WhatMerchantsThink` · `MetaStrip` · `WorksWithChips` · `FeatureTagGroups`.

---

### Appendix — exact copy/label patterns to reuse (brand-neutral)

Section titles: "Popular with merchants across {platform}", "In the spotlight", "Made by {platform}", "More apps like this", "Want to add an app?", "Featured in", "Works with", "What merchants think". Rating: "{r} out of 5 stars ({count})". Pricing: Free / Free plan available / Free to install / Free trial available / ${n}/month. Pagination: 1 2 3 4 … N · Next/Previous. Category title: "Best {X} Apps For 2026". Replace `{platform}` with **LetBuyy** and write original pitch/benefit copy — do not paste Shopify's marketing sentences verbatim.



