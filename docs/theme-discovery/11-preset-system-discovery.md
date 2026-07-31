# Preset System Discovery

_Generated: 2026-06-18. Source of truth: `packages/theme-engine/src/theme-bundle.ts`, `packages/theme-engine/src/built-in-section-schemas.ts`, `services/api-gateway/src/execution/theme-execution.adapter.ts`, `services/api-gateway/src/routes/themes.ts`. Prior research: `docs/theme-research/08-adaptive-theme-system.md`, `docs/theme-research/01-theme-system-inventory.md`._

---

## 1. What "Preset" Means in Commerce Themes

The word "preset" is overloaded in commerce theme systems and causes confusion when building tooling. The distinction used throughout this document:

**Theme** — the code artifact. A theme is a `LiquidThemePackageBundle` or `ThemePackageBundle`: it contains Liquid source files (or JSON section definitions), a `settings_schema` describing every customizable field, block definitions, locale dictionaries, and a renderer manifest. The theme does not contain any live merchant data. It is versioned, validated at ingestion time, and immutable after publish.

**Preset** — a named configuration snapshot of a theme. A preset is a set of values for the fields declared in the theme's `settings_schema` plus a description of which sections are active in which templates and what content those sections carry. The same theme code, rendered with two different presets, produces two visually distinct storefronts with zero code change.

The practical consequence: a grocery merchant and a fashion merchant can share the exact same theme binary. What differs is which preset was applied during their onboarding. This is the model the current codebase is scaffolded toward — the `settings_data.presets` map already exists — but the activation path (the logic that takes a preset name and writes it into `settings_data.current` plus the templates map) has not been built.

---

## 2. Current Configuration Layers That Already Exist

The theme system today has four distinct configuration layers. Together they can express a complete preset.

### Layer 1: Bundle-level settings_data.current

Defined in `ThemeBundleSettingsDataSchema`:

```typescript
export const ThemeBundleSettingsDataSchema = z.object({
  current: ThemeBundleJsonObjectSchema.default({}),
  presets: z.record(z.string(), ThemeBundleJsonObjectSchema).default({}),
}).passthrough();
```

The `current` record holds the active values for every global theme setting. For Urban Kicks these are:

| Key | Type | Default | CSS Variable |
|-----|------|---------|-------------|
| `primaryColor` | `color` | `#8B5CF6` (violet) | `--primary` |
| `accentColor` | `color` | `#F59E0B` (amber) | `--accent` |
| `surfaceColor` | `color` | `#F8FAFC` (near-white) | `--surface` |
| `headingFontFamily` | `text` | `Inter` | `--font-display` |
| `bodyFontFamily` | `text` | `Inter` | `--font-body` |

The static `THEME_SETTINGS_SCHEMA` in `theme-registry.ts` declares a broader canonical vocabulary of 19 fields across 5 groups:

| Group | Field Keys |
|-------|-----------|
| colors | `primaryColor`, `secondaryColor`, `accentColor`, `backgroundColor`, `textColor` |
| typography | `fontFamily`, `headingFontFamily` |
| layout | `maxWidth`, `spacing`, `borderRadius` |
| header | `sticky`, `transparent`, `showSearch`, `showCart`, `showWishlist` |
| footer | `showSocialLinks`, `showNewsletter`, `copyrightText`, `showPoweredBy` |

Urban Kicks only populates 5 of these 19 slots. `secondaryColor`, `backgroundColor`, `textColor`, `maxWidth`, `spacing`, `borderRadius`, and all header/footer toggles fall through to renderer-level defaults. A preset for a different vertical can populate any of these 19 keys without touching the theme code.

The `presets` sibling map in `settings_data` is the designated location for named preset objects. Its schema type is `Record<string, Record<string, unknown>>`, meaning any JSON key-value payload is accepted. No merge or activation logic reads from this map today.

### Layer 2: Template-level section configuration

Each template in `bundle.templates` is a `ThemeBundleTemplateSchema`:

```typescript
z.object({
  name: z.string().min(1).max(120).optional(),
  layout: z.string().min(1).max(120).optional(),
  sections: z.record(z.string(), ThemeBundleTemplateSectionSchema).default({}),
  order: z.array(z.string().min(1).max(120)).default([]),
})
```

The `sections` map is keyed by an arbitrary section instance ID (e.g. `"hero-default"`, `"category-grid-default"`). Each entry specifies:
- `type`: which section definition to use (must reference a key in `bundle.sections`)
- `settings`: the per-instance setting values (overrides the section definition's `defaults`)
- `blocks`: a map of block instances with their own settings
- `block_order`: the display order of blocks within the section
- `disabled`: whether to skip rendering

The `order` array at the template level controls the top-to-bottom display order of sections on that page. Urban Kicks home page (`index`) declares 7 sections in order: `announcement-default`, `hero-default`, `category-grid-default`, `featured-collection-default`, `product-grid-default`, `spotlight-default`, `newsletter-default`.

A preset at this layer says: "for the `index` template, use these 7 section types in this order with these specific settings and blocks."

### Layer 3: Per-section settings

Each section type in `bundle.sections` (JSON-contract) or `bundle.sections[type].schema` (Liquid) declares a `settings_schema`. This is the field catalog for that section — it defines what a merchant can customize and what the defaults are if no override is provided.

Complete catalog of all 11 setting field types found across both engines:

| Type | Usage |
|------|-------|
| `text` | Short strings: headings, labels, store name |
| `textarea` | Multi-line text: subheadings, descriptions |
| `richtext` | HTML-enabled body content: policy pages, about content |
| `color` | Hex color picker: primary/accent colors |
| `image` | URL to a merchant-uploaded image |
| `select` | Dropdown from a fixed `options` array |
| `toggle` | Boolean switch: show/hide elements |
| `range` | Numeric slider with `min`, `max`, `step`, `unit` |
| `number` | Free numeric input |
| `url` | URL field with validation |
| `radio` | Single-choice from options (like select, but radio-button UI) |

Selected per-section setting catalogs:

**announcement-bar**: `text` (message), `linkLabel`, `linkHref` (url)

**hero-banner**: `eyebrow`, `heading`, `subheading` (textarea), `ctaText`, `ctaLink` (url)

**category-grid**: `title`, `subtitle`; blocks: `category` → `name`, `slug`, `tagline`

**featured-products**: `title`, `subtitle`, `viewAllLabel`, `viewAllHref`; blocks: `product-card` → `title`, `price`, `url`

**product-grid**: `title`, `subtitle`, `columns` (range 2–4)

**header**: `storeName`, `showSearch` (toggle), `showCart` (toggle); blocks: `link` → `label`, `href`

**footer**: `storeName`, `tagline`; blocks: `link` → `label`, `href`

**newsletter-signup**: `title`, `subtitle`, `buttonLabel`

**about-section**: `title`, `content` (richtext), `imageUrl` (image), `layout` (select: left/right/center)

**collectionFilter**: `showSearch`, `showSort`, `showPriceFilter`, `showVendorFilter` (toggles), `layout` (select: sidebar/drawer/topbar)

**faqAccordion**: `title`, `allowMultipleOpen` (toggle); blocks: `faqItem` → `question`, `answer` (richtext)

**videoHero**: `heading`, `subheading`, `videoUrl`, `fallbackImage`, `ctaText`, `ctaLink`, `overlay` (range 0–1)

**ctaSection**: `heading`, `subheading`, `ctaText`, `ctaLink`, `style` (select: primary/gradient/dark)

**instagramFeed**: `title`, `handle`, `columns` (range 2–6), `showCaptions` (toggle); blocks: `post` → `image`, `caption`, `link`

### Layer 4: Block-level settings

Blocks are sub-units within a section. They are configured at two levels:

1. **Inline blocks** (defined within a section's `schema.blocks` array): `category`, `product-card`, `link`, `slide`, `brand`, `badge`, `experience`, `service`, `skill`, `testimonial`, `faqItem`, `project`

2. **Reusable blocks** (defined in `bundle.blocks`): Urban Kicks registers `category`, `product-card`, `badge` as top-level reusable blocks.

3. **App blocks** (`@app`): slots for third-party extension content. The `extension_handle` and `slot` settings are synthetic fields injected by the block schema system.

Block settings follow the same 11-type field catalog as section settings. Block instances in a template carry their own `settings` object which overrides the block definition's defaults.

### Can These 4 Layers Represent a Preset?

Yes — completely. A preset is, at minimum:

1. A `settings_data.current` override object (Layer 1): provides global colors, typography, and layout tokens.
2. A `templates` map override (Layer 2): specifies which sections are active on each page and their display order.
3. Per-section `settings` objects embedded in the template sections (Layer 3): provides content, layout, and UI customization.
4. Per-block `settings` objects embedded in the section blocks (Layer 4): provides content for individual items (nav links, category cards, product cards).

The entire state of a preset can be expressed as a pure JSON object. No Liquid source changes are required, no new section types need to be registered, and no new code is needed to express a preset for a vertical that uses only existing section types.

**What is missing** is not the data structure but the operational layer: there is no API endpoint, RPC, or merchant control plane action that takes a preset name, loads it from `settings_data.presets`, and writes its values into `settings_data.current` plus the live `template_config` on `sites`. That merge path does not exist yet.

---

## 3. Section Presets ({% schema %} "presets" field)

Section-level presets exist and are fully implemented.

**Schema definition** (from `ThemeLiquidSectionSchema`):

```typescript
presets: z.array(ThemeLiquidPresetSchema).max(50).default([]),
```

Where `ThemeLiquidPresetSchema` is:

```typescript
z.object({
  name: z.string().min(1).max(120),
  category: z.string().max(120).optional(),
  settings: ThemeBundleJsonObjectSchema.default({}),
  blocks: z.array(ThemeLiquidPresetBlockSchema).max(100).default([]),
})
```

Every section built by `createLiquidSectionFile()` automatically receives one preset with `name` equal to the section name and empty `settings` and `blocks`:

```typescript
presets: [{ name: input.name, settings: {}, blocks: [] }],
```

This is the default preset that a visual editor would show as the "initial state" when a merchant adds this section to a page for the first time. Urban Kicks sections with explicit inline presets in their `{% schema %}` JSON source include: `announcement-bar`, `hero-banner`, `category-grid`, `featured-products`, `product-grid`, `spotlight`, `newsletter-signup`.

In `buildLiquidRuntimeSectionSchemas()`, the first preset's settings are extracted as the section's `defaults`:

```typescript
defaults: sectionFile.schema.presets[0]?.settings || {},
presets: sectionFile.schema.presets.map((preset) => ({
  name: preset.name,
  settings: preset.settings,
})),
```

Section presets are surfaced in the runtime schema and available to a theme editor. They are distinct from bundle-level presets in `settings_data`: section presets describe named content/layout variants for a single section; bundle presets describe the entire configured state of the theme.

For the JSON-contract engine, `ThemeBundleSectionDefinitionSchema` also carries:

```typescript
presets: z.array(z.object({
  name: z.string().min(1).max(120),
  settings: ThemeBundleJsonObjectSchema.default({}),
}).strict()).max(50).default([]),
```

The JSON-contract engine exposes these through `getEditableSchema()` via `ThemeExecutionAdapter`.

---

## 4. Preset Architecture Options

### Option A: Settings-Only Presets

A settings-only preset changes only `config.settings_data.current` — the global color, typography, and layout tokens. It does not touch the `templates` map or section configurations.

**Feasibility:** High. `ThemeBundleSettingsDataSchema` already has the `presets` map for this exact purpose. An activation action needs only: `settings_data.current = { ...settings_data.current, ...settings_data.presets[presetName] }`.

**What it can achieve:**
- Complete color identity change: violet/amber Urban Kicks → green/white Grocery → dark/silver Electronics → gold/ivory Jewelry
- Typography swap: `Inter` → `Playfair Display` (heading) + `Lato` (body) for a fashion brand
- Surface color changes: warm cream for dairy, clinical white for pharmacy
- Header/footer toggles: show/hide cart icon, search bar, newsletter footer

**What it cannot achieve:**
- Section order changes on any template (the homepage still starts with `announcement-bar` → `hero-banner`)
- Removal of the `spotlight` section from the homepage for verticals where it is irrelevant
- Adding a `trust-badges` section between `hero-banner` and `category-grid` for a grocery store
- Setting vertical-specific copy: a grocery store's hero heading remains "Fresh drops for daily buyers" until manually changed
- Populating category blocks with correct slugs for the merchant's actual vertical

**Verdict:** Settings-only presets are useful for color/font theming but produce a recognizably generic storefront. The homepage structure and copy remain Urban Kicks defaults.

### Option B: Template Configuration Presets

A template configuration preset replaces the entire `templates` map in the bundle — it specifies which section types are active, their order, and all their settings and block values, per template. Combined with a settings_data overlay, this is a complete preset.

**Feasibility:** High with one gap. The `templates` map is a `Record<string, ThemeBundleTemplateSchema>` where each template's `sections` map, `order`, and per-section `settings` and `blocks` are already fully typeable as JSON. The gap is that `template_config` on `sites` stores the rendered live template config, and there is no current API endpoint that accepts a preset name and atomically writes both `settings_data.current` and `template_config`.

**What it can achieve:**
- Everything in Option A
- Homepage section order and composition: grocery home = `announcement-bar` → `hero-banner` → `trust-badges` (delivery promises) → `product-grid` (daily essentials) → `featured-products` (deals) → `newsletter-signup`
- Vertical-specific default copy: hero heading "Fresh groceries delivered daily", category names "Vegetables", "Dairy", "Snacks"
- Section presence/absence per template: electronics product page adds space for a `product-specs` section; fashion product page has the `featured-products` "Shop the look" section
- Navigation links: header blocks pre-populated with "Shop", "Offers", "Account" for grocery vs. "New Arrivals", "Collections", "Sale" for fashion

**What it cannot achieve:**
- Adding a section type that does not exist in the bundle (e.g. `nutrition-table` for grocery, `product-specs` for electronics)
- Any layout customization that requires new Liquid source code
- Hydration island behavior changes (e.g. a delivery slot picker)

**Verdict:** Template configuration presets combined with a settings overlay are the correct model for the current architecture. They can fully differentiate the eight target verticals using only existing section types.

### Option C: Full Bundle Presets

A full bundle preset is a separate `LiquidThemePackageBundle` — a distinct theme package with its own slug, version, and Liquid source files. It may extend Urban Kicks by adding vertical-specific sections.

**Feasibility:** Blocked in production. The theme-marketplace is frozen (ART-17); publishing new theme packages requires unfreezing it. The `compilePortableToLiquidBundle()` function uses `createUrbanKicksLiquidThemeBundleFixture()` as a base, so any compilation-based variant would start from Urban Kicks anyway.

**What it can achieve:**
- New section types per vertical (`nutrition-table`, `product-specs`, `lookbook`)
- Vertical-specific Liquid source customization (different CSS class names, markup structure)
- Completely different layout templates for verticals that need them

**What it cannot achieve without ARB approval:**
- Being published to the theme-marketplace
- Being installed via the standard install flow as a separate theme slug

**Verdict:** Full bundle presets are the right long-term architecture for verticals requiring genuinely new section types (grocery's `nutrition-table`, electronics' `comparison-table`), but they are blocked until the theme-marketplace is unfrozen. The interim path is Option B.

---

## 5. Industry Vertical Analysis

The analysis below uses Urban Kicks section types as the starting inventory. All section types used in Urban Kicks are listed in prior research `08-adaptive-theme-system.md`.

**Universal sections** applicable to every vertical (never irrelevant):
`header`, `footer`, `announcement-bar`, `hero-banner`, `product-detail`, `product-grid`, `featured-products`, `cart-summary`, `customer-login`, `customer-register`, `customer-account`, `customer-orders`, `customer-order-detail`, `customer-settings`, `customer-wishlist`, `customer-addresses`, `policy-content`, `newsletter-signup`, `search-box`, `collection-banner`, `collection-product-list`

**Conditionally applicable** (useful for some verticals, irrelevant for others):
`category-grid`, `trust-badges`, `testimonials`, `faqAccordion`, `about-section`, `ctaSection`, `brand-marquee`, `banner-carousel`, `contact-form`

**Urban Kicks-specific** (not appropriate for most other verticals):
`spotlight` (demo section proving zero-storefront-change deployment; serves no commerce purpose in production), `experience-timeline`, `portfolio-grid`, `skills-section` (these are creator/portfolio sections that leaked into the fixture from the built-in section registry)

### Electronics

**Universally applicable sections:** `hero-banner`, `announcement-bar`, `product-grid`, `product-detail`, `featured-products`, `cart-summary`, `faqAccordion` (warranty FAQs), `trust-badges` (CE/BIS/warranty badges), `collection-banner`, `collection-product-list`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee` (unless the store carries recognizable electronics brands — borderline)

**What existing sections lack:** No `product-specs` section for technical attribute tables. `product-card` block has no structured spec display. `collectionFilter` has `showPriceFilter` and `showVendorFilter` but no `showSpecFilter` for faceted filtering by RAM/storage/display size.

**What's missing:**
- `product-specs` section: heading text + blocks of type `spec` (`label`, `value`)
- `comparison-table` section: blocks of type `comparison-product` (`product_url`, `highlight` toggle)
- `tech-badges` section: blocks of type `tech-cert` (`label`, `icon` select from CE/BIS/ISI/energy star options)

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#1E3A5F",
  "accentColor": "#00B4D8",
  "surfaceColor": "#F0F4F8",
  "headingFontFamily": "Inter",
  "bodyFontFamily": "Inter"
}
```

**Homepage template section order:**
`announcement-bar` (warranty/offer) → `hero-banner` (flagship product) → `category-grid` (Laptops, Mobiles, Accessories, Audio) → `trust-badges` (warranty/return/certified) → `featured-products` (top picks) → `product-grid` (4 columns) → `newsletter-signup`

---

### Fashion (Generalized)

**Universally applicable sections:** `hero-banner`, `announcement-bar`, `banner-carousel` (lookbook editorial), `category-grid` (Men/Women/Kids/Sale), `featured-products`, `product-grid`, `product-detail`, `testimonials`, `trust-badges` (easy returns), `about-section` (brand story), `newsletter-signup`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `faqAccordion` (marginally useful for size guides / return policy)

**What's missing:**
- `lookbook` section: settings `imageUrl` (image), `layout` (select: fullwidth/split); blocks of type `hotspot` (`x`: number, `y`: number, `product_url`: url, `label`: text)
- `size-guide` section: no settings; blocks of type `size-row` (`label`, `chest`, `waist`, `hip`, `length`)
- Extended `product-card` block: current `product-card` block lacks `imageUrl` — product images cannot be shown in curated featured lists
- `swatch` block type for color/pattern display within product cards

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#1A1A2E",
  "accentColor": "#E63946",
  "surfaceColor": "#FAFAFA",
  "headingFontFamily": "Playfair Display",
  "bodyFontFamily": "Inter"
}
```

**Homepage template section order:**
`announcement-bar` (sale/offer) → `hero-banner` (hero editorial) → `banner-carousel` (lookbook slides) → `category-grid` (Men/Women/Kids/Sale) → `featured-products` (new arrivals) → `testimonials` → `instagram-feed` (if available) → `newsletter-signup`

---

### Grocery

**Universally applicable sections:** `hero-banner`, `announcement-bar` (same-day delivery cutoff), `product-grid`, `featured-products` (daily essentials / deals), `trust-badges` (delivery promise, freshness guarantee), `category-grid` (Vegetables, Fruits, Dairy, Grains), `faqAccordion`, `cart-summary`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee`, `banner-carousel` (unnecessary unless running campaign), `about-section`

**What's missing:**
- `nutrition-table` section (FSSAI-mandated): no settings; blocks of type `nutrient` (`name`, `per100g`, `perServing`, `unit`)
- `product-freshness` section: `showHarvestDate` (toggle), `showExpiryRange` (toggle); blocks of type `freshness-item` (`label`, `value`)
- `bundle-deals` section: blocks of type `bundle` (`title`, `items` richtext, `originalPrice` text, `bundlePrice` text, `url`)
- `delivery-slot-picker` (requires a hydration island and backend slot API — not achievable at the theme level alone)
- Per-unit display in `product-card` (per kg, per litre, per dozen): the `price` field in the block is free text, so "₹89/kg" is achievable as a convention, but there is no structured unit field

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#2D6A4F",
  "accentColor": "#F4A261",
  "surfaceColor": "#F8FFF4",
  "headingFontFamily": "Inter",
  "bodyFontFamily": "Inter"
}
```

**Homepage template section order:**
`announcement-bar` (same-day delivery) → `hero-banner` ("Fresh groceries delivered daily") → `trust-badges` (farm fresh / certified / same-day) → `category-grid` (Vegetables, Fruits, Dairy, Snacks) → `featured-products` (daily essentials) → `product-grid` (3 columns) → `newsletter-signup`

---

### Dairy & Fresh

**Universally applicable sections:** `hero-banner`, `announcement-bar` (morning cutoff time), `product-grid`, `featured-products`, `trust-badges` (farm fresh, no preservatives, cold chain), `about-section` (farm story), `testimonials`, `newsletter-signup`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee`, `category-grid` (dairy stores typically have flat catalog structures), `banner-carousel`

**What's missing:**
- `subscription-panel` section: blocked on platform subscriptions domain (NOT IMPLEMENTED per LCIS v11). Cannot be built as a theme section without backend support.
- `farm-story` section: can be approximated with `about-section` + an added `certificationBadge` image field. The existing `about-section` covers narrative + image + layout but lacks a certification image slot.
- `delivery-frequency` block type: requires subscription infrastructure
- `traceability-map` section: farm origin + harvest batch display. No map embedding is possible with current sanitizer config (no `iframe` for map embeds with dynamic src; static image is feasible with `image` field)
- `freshness-badge` block: achievable as a `trust-badges` block variant with `label` + `description`, though not structurally distinct

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#3A5A40",
  "accentColor": "#FEFAE0",
  "surfaceColor": "#FFFFFF",
  "headingFontFamily": "Merriweather",
  "bodyFontFamily": "Inter"
}
```

**Homepage template section order:**
`announcement-bar` (morning order cutoff) → `hero-banner` (farm fresh) → `trust-badges` (no preservatives / farm certified / cold chain) → `featured-products` (today's items) → `product-grid` (3 columns) → `about-section` (farm story, layout right) → `testimonials` → `newsletter-signup`

---

### Jewelry

**Universally applicable sections:** `hero-banner`, `announcement-bar` (hallmark/certification), `product-grid`, `featured-products`, `product-detail`, `trust-badges` (BIS hallmark, purity, insured delivery), `testimonials`, `about-section` (brand heritage), `faqAccordion` (care instructions, return policy), `newsletter-signup`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee`, `contact-form`

**What's missing:**
- `customization-panel` section: blocks of type `engraving` (`label`, `maxLength` number, `chargeText` text) — requires a new hydration island for text input submission
- `certification-block` section: `certType` (select: BIS/IGI/GIA/HM), `certNumber` (text), `certificateUrl` (url), `purity` (text e.g. "22K", "925 Sterling")
- `gift-packaging` block: toggle gift wrap + add gift message — requires cart-level option API, not currently in the theme layer
- `hallmark-badge` section: distinguishable from generic `trust-badges` with structured BIS/purity fields

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#4A3728",
  "accentColor": "#C9A84C",
  "surfaceColor": "#FDF8F0",
  "headingFontFamily": "Cormorant Garamond",
  "bodyFontFamily": "Lato"
}
```

**Homepage template section order:**
`announcement-bar` (BIS certified / free insured delivery) → `hero-banner` (hero collection shot) → `category-grid` (Gold, Diamond, Silver, Platinum) → `trust-badges` (BIS hallmark / purity certified / insured delivery) → `featured-products` (curated collection) → `about-section` (brand heritage, layout left) → `testimonials` → `newsletter-signup`

---

### Furniture & Home

**Universally applicable sections:** `hero-banner`, `announcement-bar` (EMI/lead time offer), `category-grid` (Living Room, Bedroom, Kitchen, Outdoor), `product-grid`, `product-detail`, `featured-products`, `trust-badges` (assembly included, 5yr warranty, EMI), `faqAccordion` (assembly, returns, dimensions), `about-section` (craftsmanship story), `testimonials`, `newsletter-signup`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee`

**What's missing:**
- `dimensions-panel` section: blocks of type `dimension` (`axis` select from width/height/depth/weight/seat-height, `value` text, `unit` select from cm/inch/kg)
- `material-options` section: blocks of type `material` (`name`, `imageUrl` image, `finish` text, `available` toggle)
- `delivery-lead-time` section: `leadTimeDays` (number), `pincodeLookupEnabled` (toggle — static display only, dynamic ETA requires backend), `assemblyIncluded` (toggle)
- AR room visualizer: requires `ADD_TAGS` and `ADD_ATTR` changes to `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` which is a security-sensitive change requiring ARB sign-off. Not a theme-level feature today.

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#3E2723",
  "accentColor": "#8D6E63",
  "surfaceColor": "#FFF8F0",
  "headingFontFamily": "Libre Baskerville",
  "bodyFontFamily": "Source Sans Pro"
}
```

**Homepage template section order:**
`announcement-bar` (EMI available / free assembly) → `hero-banner` (hero room shot) → `category-grid` (Living, Bedroom, Kitchen, Outdoor) → `trust-badges` (assembly / warranty / EMI / returns) → `featured-products` (bestsellers) → `about-section` (craftsmanship, layout right) → `testimonials` → `faqAccordion` → `newsletter-signup`

---

### Restaurant & Food

**Universally applicable sections:** `hero-banner`, `announcement-bar` (hours/delivery area), `product-grid` (menu items as products), `featured-products` (chef's specials), `category-grid` (Starters, Mains, Desserts, Drinks), `trust-badges` (FSSAI certified, hygiene rating, delivery time), `testimonials`, `contact-form` (reservations), `about-section` (restaurant story), `newsletter-signup`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee`, `banner-carousel`

**What's missing:**
- `menu-highlight` section: blocks of type `dish` (`name`, `description` textarea, `imageUrl` image, `price` text, `dietType` select from veg/non-veg/vegan, `spiceLevel` select)
- `opening-hours` section: no settings; blocks of type `hours-row` (`day`, `open` text, `close` text, `closed` toggle)
- `allergen-notice` section: `allergens` (richtext) — FSSAI requirement for packaged/prepared food
- `reservation-form` section: extends `contact-form` with `date` (text), `partySize` (number), `timeSlot` (text) fields — achievable with current `contactForm` section as an approximation

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#C1440E",
  "accentColor": "#F5C518",
  "surfaceColor": "#FFF9F0",
  "headingFontFamily": "Playfair Display",
  "bodyFontFamily": "Inter"
}
```

**Homepage template section order:**
`announcement-bar` (hours / delivery area) → `hero-banner` (hero food shot) → `category-grid` (Starters, Mains, Desserts, Drinks) → `featured-products` (chef's specials) → `trust-badges` (FSSAI / hygiene / delivery time) → `about-section` (restaurant story, layout left) → `testimonials` → `contact-form` (reservation inquiry) → `newsletter-signup`

---

### Pharmacy & Health

**Universally applicable sections:** `hero-banner`, `announcement-bar` (prescription required / same-day delivery), `product-grid`, `featured-products` (OTC bestsellers), `category-grid` (Medicines, Wellness, Personal Care, Baby Care), `trust-badges` (licensed pharmacist, cold chain, prescription verified), `faqAccordion` (prescription upload, substitution policy), `newsletter-signup`, all customer pages

**Irrelevant sections:** `spotlight`, `experience-timeline`, `portfolio-grid`, `skills-section`, `brand-marquee`, `banner-carousel`, `testimonials` (regulatory restrictions on health testimonials in India)

**What's missing:**
- `prescription-upload` section: requires a file-upload hydration island — no file-upload field type exists in `ThemeBundleSettingFieldSchema`, and no `lb-*` custom element handles file uploads. This is a two-layer gap (field type + island).
- `drug-info` section: `genericName` (text), `composition` (richtext), `contraindications` (richtext) — structured drug information display. Currently approximated with `faqAccordion` or `rich-content`.
- `cold-chain-badge` section: distinct from `trust-badges`; shows cold chain status, storage condition (2–8°C), and batch/expiry display.
- `substitute-alert` section: a banner-style alert linking to substitute products — requires product relationship data, not a theme-only concern.
- CDSCO/DCGI regulatory disclaimers block: standardized disclaimer text required under Indian pharmacy regulations.

**Homepage configuration as JSON settings (settings_data.current override):**
```json
{
  "primaryColor": "#0077B6",
  "accentColor": "#00B4D8",
  "surfaceColor": "#F0F8FF",
  "headingFontFamily": "Inter",
  "bodyFontFamily": "Inter"
}
```

**Homepage template section order:**
`announcement-bar` (licensed pharmacist / prescription required notice) → `hero-banner` (health & wellness) → `category-grid` (Medicines, Wellness, Personal Care, Baby) → `trust-badges` (licensed / cold chain / verified) → `featured-products` (OTC bestsellers) → `product-grid` (3 columns) → `faqAccordion` (prescription policy, substitution) → `newsletter-signup`

---

## 6. Can Presets Be Pure JSON?

**Rigorous evaluation:** Given the current schema system, a preset for any vertical that uses only existing section types can be expressed as a complete pure JSON document with zero code changes. The analysis below is derived directly from the schema definitions.

**What a complete preset document must contain:**

1. `settings_data_override` — a flat `Record<string, unknown>` merged into `config.settings_data.current`. All keys must be registered in the theme's `settings_schema`. Urban Kicks exposes 5 overridable keys; the canonical schema supports 19. This is pure JSON.

2. `templates` — a `Record<string, ThemeBundleTemplateSchema>`. Every key is a route name (`index`, `product`, `collection`, etc.). Each template contains:
   - `sections`: `Record<sectionInstanceId, { type, settings, blocks, block_order, disabled }>`
   - `order`: `string[]`
   
   Every `type` value must reference a section key that exists in `bundle.sections`. For the Liquid engine this means the section's `.liquid` file must exist in `bundle.sections`. The preset cannot reference `nutrition-table` if that section file has not been added to the bundle.

3. `locales` — optional locale overrides if the preset changes UI string keys.

**What cannot be pure JSON:**
- A preset that needs a section type not in the current bundle (e.g. `nutrition-table`, `product-specs`, `lookbook`) requires adding a Liquid source file to the bundle. That is a code change, not a JSON change.
- A preset that needs a new hydration island (e.g. `delivery-slot-picker`, `prescription-upload`, `customization-panel` with engraving input) requires a new `lb-*` custom element, a new entry in `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG.ADD_TAGS`, and new client-side JS. That is a code change.
- A preset that needs new global CSS tokens (e.g. a `borderRadius` setting that does not yet map to a CSS variable in `LIQUID_THEME_TOKEN_MAP`) requires updating the token map in `theme-renderer.ts`. That is a code change.

**Verdict for the eight target verticals:**

| Vertical | Can be pure JSON with current sections? | Blocker if any |
|----------|----------------------------------------|----------------|
| Electronics | Yes, for product grid / category / FAQ structure | `product-specs`, `comparison-table` are missing — full preset requires code |
| Fashion | Yes, for editorial + category + grid structure | `lookbook`, `size-guide`, enriched `product-card` are missing |
| Grocery | Yes, for category + grid + trust structure | `nutrition-table`, `bundle-deals` are missing |
| Dairy & Fresh | Partial — content preset yes | `subscription-panel` requires platform + code; `traceability-map` missing |
| Jewelry | Yes, for grid + trust + heritage structure | `customization-panel`, `certification-block` require code |
| Furniture & Home | Yes, for category + grid + FAQ structure | `dimensions-panel`, `material-options` require code |
| Restaurant & Food | Yes, for menu + category + hours structure | `menu-highlight` with structured fields requires code |
| Pharmacy & Health | Partial — content preset yes | `prescription-upload` requires new island + field type |

**Conclusion:** For all eight verticals, a pure JSON preset can immediately differentiate visual identity (colors, typography) and homepage section order and copy. A fully functional vertical experience (with vertical-specific sections) requires code additions to the bundle for 7 of the 8 verticals. Grocery can achieve the most complete pure-JSON preset using existing sections (`product-grid`, `category-grid`, `trust-badges`, `featured-products`, `announcement-bar`, `newsletter-signup`).

---

## 7. What Is Missing for a Preset System

The following capabilities are missing, with evidence from the source code:

**1. Preset activation API (highest priority)**

No route in `services/api-gateway/src/routes/themes.ts` accepts a preset name and applies it. The `PUT /:slug/editor/draft` endpoint accepts a `SaveThemeDraftSchema` payload but this is a general draft save, not a preset-apply action. There is no equivalent of "apply preset X to this store's active theme."

Evidence: `themes.ts` line 64 shows only `settings` as an authenticated route for marketplace preferences, not theme settings. The `settings_data.presets` map exists but no path from it to `settings_data.current` exists in the adapter.

**2. Preset storage in settings_data.presets (missing: no presets are defined)**

`ThemeBundleSettingsDataSchema` has the `presets` field but `createUrbanKicksLiquidThemeBundleFixture()` does not populate it:

```typescript
settings_data: {
  current: {
    primaryColor: '#8B5CF6',
    accentColor: '#F59E0B',
    surfaceColor: '#F8FAFC',
    headingFontFamily: 'Inter',
    bodyFontFamily: 'Inter',
  },
  // presets key is absent — defaults to {}
},
```

No named preset objects exist for any vertical. The container exists; the contents do not.

**3. Template preset storage (missing entirely)**

There is no equivalent of `settings_data.presets` at the template level. A full preset includes a template configuration (section order and settings per template), but no schema field stores named template presets. `ThemeBundleSettingsDataSchema` uses `.passthrough()` so additional keys can be added, but there is no defined contract for template presets — no `template_presets` field, no merge function, no activation path.

**4. Per-merchant preset history and revert**

Once a preset is applied (when activation is built), the merchant's previous `settings_data.current` and `template_config` should be snapshotted so they can revert. The `theme_releases` table and `publishReleaseSnapshot()` provide the mechanism for this, but there is no "apply preset and create snapshot" atomic operation.

**5. CSS token coverage gap**

`LIQUID_THEME_TOKEN_MAP` in `theme-renderer.ts` maps 6 token keys to CSS variables, but Urban Kicks only populates 3 of them (`primaryColor`, `accentColor`, `surfaceColor`). The remaining 3 in the map (`secondaryColor`, `backgroundColor`, `textColor`) have hardcoded fallbacks and cannot be overridden via a preset without also being added to the `settings_schema`. A grocery or pharmacy preset that needs `backgroundColor: '#F0F8FF'` would have no effect because `backgroundColor` is not in Urban Kicks' `settings_schema.colors.fields`.

**6. Missing vertical-specific section types**

The following section types required for complete vertical presets do not exist in the bundle (no `.liquid` file, no schema, no block types):

| Section | Missing From | Vertical |
|---------|-------------|---------|
| `product-specs` | `bundle.sections` | Electronics |
| `comparison-table` | `bundle.sections` | Electronics |
| `lookbook` | `bundle.sections` | Fashion |
| `size-guide` | `bundle.sections` | Fashion |
| `nutrition-table` | `bundle.sections` | Grocery / Restaurant |
| `bundle-deals` | `bundle.sections` | Grocery |
| `product-freshness` | `bundle.sections` | Grocery / Dairy |
| `subscription-panel` | `bundle.sections` + platform | Dairy |
| `dimensions-panel` | `bundle.sections` | Furniture |
| `material-options` | `bundle.sections` | Furniture |
| `delivery-lead-time` | `bundle.sections` | Furniture |
| `customization-panel` | `bundle.sections` + island | Jewelry |
| `certification-block` | `bundle.sections` | Jewelry |
| `menu-highlight` | `bundle.sections` | Restaurant |
| `opening-hours` | `bundle.sections` | Restaurant |
| `cold-chain-badge` | `bundle.sections` | Pharmacy |
| `prescription-upload` | `bundle.sections` + field type + island | Pharmacy |

**7. No font picker field type**

`headingFontFamily` and `bodyFontFamily` are raw `text` fields. A preset that specifies `"Playfair Display"` for fashion or `"Cormorant Garamond"` for jewelry relies on the font being available as a web font — but no font loading mechanism exists in the theme engine. Google Fonts or similar would need to be loaded via the `<head>` block in the layout file. The layout file is fixed per bundle; individual presets cannot inject `<link rel="stylesheet">` tags. This means font presets are aspirational but non-functional until a font-loading mechanism is added to the renderer.

**8. No merchant onboarding integration**

The merchant control plane's onboarding flow (`apps/identity-platform/src/app/onboarding/page.tsx`) has a store type selection step (`select/page.tsx`) but it does not call a "apply vertical preset" action. The onboarding completes without any theme configuration beyond what the default template provides.

---

## 8. Recommended Preset Data Model

The following JSON structure is the minimal self-consistent design for a preset document. It is compatible with the existing `ThemeBundleSettingsDataSchema` without requiring schema changes (the schema uses `.passthrough()`).

```json
{
  "id": "grocery-india-v1",
  "name": "Grocery — India",
  "description": "Green/white palette with daily essentials homepage structure. FSSAI-compliant trust badges.",
  "vertical": "grocery",
  "schema_version": "2026-06-liquid-sections",
  "base_theme_slug": "urban-kicks-liquid",

  "settings_data": {
    "primaryColor": "#2D6A4F",
    "accentColor": "#F4A261",
    "surfaceColor": "#F8FFF4",
    "headingFontFamily": "Inter",
    "bodyFontFamily": "Inter"
  },

  "templates": {
    "index": {
      "name": "Grocery Home",
      "layout": "theme",
      "sections": {
        "announcement-default": {
          "type": "announcement-bar",
          "settings": {
            "text": "Free delivery on orders above ₹499. Order before 11 AM for same-day delivery.",
            "linkLabel": "Shop now",
            "linkHref": "/products"
          }
        },
        "hero-default": {
          "type": "hero-banner",
          "settings": {
            "eyebrow": "Fresh from the farm",
            "heading": "Daily groceries delivered to your door",
            "subheading": "Vegetables, fruits, dairy, and staples sourced fresh every morning.",
            "ctaText": "Shop now",
            "ctaLink": "/products"
          }
        },
        "trust-default": {
          "type": "trust-badges",
          "settings": { "title": "" },
          "blocks": {
            "badge-fresh": { "type": "badge", "settings": { "label": "Farm Fresh", "description": "Sourced daily from verified farms" } },
            "badge-delivery": { "type": "badge", "settings": { "label": "Same-Day Delivery", "description": "Order before 11 AM" } },
            "badge-fssai": { "type": "badge", "settings": { "label": "FSSAI Certified", "description": "License No. on packaging" } }
          },
          "block_order": ["badge-fresh", "badge-delivery", "badge-fssai"]
        },
        "category-default": {
          "type": "category-grid",
          "settings": { "title": "Shop by category", "subtitle": "Fresh produce organised for you." },
          "blocks": {
            "cat-veg": { "type": "category", "settings": { "name": "Vegetables", "slug": "vegetables", "tagline": "Farm fresh daily" } },
            "cat-fruit": { "type": "category", "settings": { "name": "Fruits", "slug": "fruits", "tagline": "Seasonal picks" } },
            "cat-dairy": { "type": "category", "settings": { "name": "Dairy", "slug": "dairy", "tagline": "Cold chain assured" } },
            "cat-staples": { "type": "category", "settings": { "name": "Staples", "slug": "staples", "tagline": "Pantry essentials" } }
          },
          "block_order": ["cat-veg", "cat-fruit", "cat-dairy", "cat-staples"]
        },
        "featured-default": {
          "type": "featured-products",
          "settings": {
            "title": "Daily essentials",
            "subtitle": "Most ordered items this week.",
            "viewAllLabel": "Browse all",
            "viewAllHref": "/products"
          },
          "blocks": {},
          "block_order": []
        },
        "grid-default": {
          "type": "product-grid",
          "settings": { "title": "Shop everything", "subtitle": "", "columns": 3 },
          "blocks": {},
          "block_order": []
        },
        "newsletter-default": {
          "type": "newsletter-signup",
          "settings": {
            "title": "Get weekly deals",
            "subtitle": "Fresh offers and seasonal discounts delivered to your inbox.",
            "buttonLabel": "Subscribe"
          }
        }
      },
      "order": [
        "announcement-default",
        "hero-default",
        "trust-default",
        "category-default",
        "featured-default",
        "grid-default",
        "newsletter-default"
      ]
    }
  },

  "metadata": {
    "created_at": "2026-06-18",
    "created_by": "letbuyy-platform",
    "target_verticals": ["grocery", "fresh-produce", "supermarket"],
    "requires_sections": ["announcement-bar", "hero-banner", "trust-badges", "category-grid", "featured-products", "product-grid", "newsletter-signup"],
    "missing_sections_for_full_preset": ["nutrition-table", "product-freshness", "bundle-deals"],
    "color_palette": {
      "primary": "#2D6A4F",
      "accent": "#F4A261",
      "surface": "#F8FFF4"
    }
  }
}
```

**Key design decisions:**

- `id` is a stable slug used as the key in `settings_data.presets` and as the activation key in the API.
- `settings_data` is a flat object — the same shape as `settings_data.current` — to enable a simple spread merge.
- `templates` mirrors `ThemeBundleTemplateSchema` exactly so the preset can be dropped directly into the bundle's templates map.
- `metadata.requires_sections` enables a pre-flight check: before applying the preset, verify that all required section types exist in the active bundle.
- `metadata.missing_sections_for_full_preset` is honest: it documents which sections would be needed for a complete implementation, enabling a roadmap-driven completion check.
- The `templates` map includes only the templates the preset customizes. Templates not listed inherit the bundle's default configuration, allowing a preset to override only the homepage without touching the product, collection, or customer templates.

**Activation algorithm (not yet implemented):**

```
function applyPreset(storeId, presetId, bundleConfig):
  preset = bundleConfig.settings_data.presets[presetId]
  if not preset: throw PresetNotFound

  missingChecks = preset.metadata.requires_sections
    .filter(s => !bundleConfig.sections[s])
  if missingChecks.length > 0: throw SectionsMissing(missingChecks)

  newCurrent = { ...bundleConfig.settings_data.current, ...preset.settings_data }
  newTemplates = { ...bundleConfig.templates, ...preset.templates }

  publishReleaseSnapshot({
    storeId,
    themeSettings: newCurrent,
    templateConfig: { ...bundleConfig, config: { ...bundleConfig.config, settings_data: { ...bundleConfig.config.settings_data, current: newCurrent } }, templates: newTemplates },
    presetApplied: presetId,
  })
```
