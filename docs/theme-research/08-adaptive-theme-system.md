# Adaptive Theme System Study

_Generated: 2026-06-18. Source of truth: `packages/theme-engine/src/theme-bundle.ts`, `built-in-section-schemas.ts`, `theme-renderer.ts`, and `apps/theme-marketplace/src/lib/theme-catalog.ts`._

---

## Current Theme Architecture

### What Exists Today

The theme engine ships two parallel bundle formats:

**JSON-Contract Bundle (`ThemePackageBundleSchema`)** — schema version `2026-05-json-contract`. Sections and blocks are described entirely as JSON definitions (`sections/*.json`, `blocks/definitions.json`). The renderer (`JsonContractThemeRenderer`) composes a `StorefrontCompositionResult` by hydrating the section registry against the template config. CSS is rendered by the React storefront using the existing `globals.css` pipeline. This is the default and stable engine.

**Liquid Bundle (`LiquidThemePackageBundleSchema`)** — schema version `2026-06-liquid-sections`. Sections and blocks are full Liquid source files. The renderer (`LiquidRenderer`) uses `liquidjs` with DOMPurify sanitization, injects per-store CSS custom properties as an inline `<style>` tag, and renders a `LiquidRenderedTheme` containing the full layout HTML. Liquid rendering is a canary flag (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`).

Both formats share the same `config.settings_schema` / `config.settings_data` contract, the same `templates` map, the same locale system, and the same Zod validation layer. A `PortableThemePackageBundleSchema` is a union of both.

**Bundle structure** (both formats):

```
package/          -- metadata (slug, version, pricing, site_types)
config/
  settings_schema.json  -- grouped setting fields (colors, typography, layout)
  settings_data.json    -- current values + named presets
templates/        -- per-route section/block composition maps
sections/         -- section definitions (JSON or Liquid)
blocks/           -- block definitions (JSON or Liquid)
locales/          -- translation dictionaries (en, hi, bn, mr, ta, te, kn)
renderer/         -- engine declaration + asset manifest
```

The theme-marketplace catalog layer (`normalizeThemeRecord`) understands `category`, `industry[]`, `theme_preset_id`, `color_presets[]`, and `font_options[]` fields at the package-record level, providing the scaffolding for multi-vertical classification even though no vertical-specific bundles exist yet.

---

## Urban Kicks — Deep Analysis

`createUrbanKicksLiquidThemeBundleFixture()` is the current showcase Liquid theme. It is fully working and represents the ceiling of what the Liquid engine can deliver today.

### Section Types

Urban Kicks uses the following section types across its templates:

| Template | Section Types Used |
|----------|-------------------|
| `index` (home) | `announcement-bar`, `hero-banner`, `category-grid`, `featured-products`, `product-grid`, `spotlight`, `newsletter-signup` |
| `product` | `product-detail`, `featured-products` |
| `collection` | `collection-banner`, `collection-product-list` |
| `search` | `search-box`, `collection-product-list` |
| `cart` | `cart-summary` |
| `customers/login` | `customer-login` |
| `customers/register` | `customer-register` |
| `customers/account` | `customer-account` |
| `customers/orders` | `customer-orders` |
| `customers/order` | `customer-order-detail` |
| `customers/settings` | `customer-settings` |
| `customers/wishlist` | `customer-wishlist` |
| `customers/addresses` | `customer-addresses` |
| `policy` | `policy-content` |
| `header` | `header` |
| `footer` | `footer` |

Total: 17 distinct section types fully implemented in Liquid source.

### Color Tokens

Urban Kicks declares three theme-level color settings in `config.settings_schema.colors`:

| Setting Key | Label | Default Value |
|-------------|-------|---------------|
| `primaryColor` | Primary color | `#8B5CF6` (violet) |
| `accentColor` | Accent color | `#F59E0B` (amber) |
| `surfaceColor` | Surface color | `#F8FAFC` (near-white) |

These are bound via `LIQUID_THEME_TOKEN_MAP` in the renderer to CSS custom properties:

| Setting Key | CSS Variable | Fallback |
|-------------|-------------|---------|
| `primaryColor` | `--primary` | `#111827` |
| `secondaryColor` | `--secondary` | `#374151` |
| `accentColor` | `--accent` | `#2563eb` |
| `surfaceColor` | `--surface` | `#f8fafc` |
| `backgroundColor` | `--background` | `#ffffff` |
| `textColor` | `--foreground` | `#1a1a2e` |

Urban Kicks only populates three of these eight token slots. The remaining five (`secondaryColor`, `backgroundColor`, `textColor`, and `--border-color`) fall through to hardcoded fallbacks set in `buildLiquidRootTokenBlock`.

### Typography Settings

Declared in `config.settings_schema.typography`:

| Setting Key | Label | Default |
|-------------|-------|---------|
| `headingFontFamily` | Heading font | `Inter` |
| `bodyFontFamily` | Body font | `Inter` |

These map to `--font-display` and `--font-body` CSS variables respectively. The base CSS applies `--font-display` to heading elements and `--font-body` to the `.lb-theme` root. No font-weight, font-size, or line-height customization is exposed at the settings level today.

### Locale Support

Urban Kicks ships only `en: { general: { cart: 'Cart' } }`. The Minimal Starter Bundle (JSON-contract) is the only fixture that ships the full 7-language locale map. The `DEFAULT_THEME_LOCALE` is `en` and `normalizeThemeLocale` supports BCP-47 subtags. The infrastructure can load any locale by key; Urban Kicks simply does not populate non-English dictionaries.

Built-in locale infrastructure supports: `en`, `hi` (Hindi), `bn` (Bengali), `mr` (Marathi), `ta` (Tamil), `te` (Telugu), `kn` (Kannada). This matches the India-first platform mandate.

### Block Types

Urban Kicks registers three reusable blocks:

| Block Key | Block Name | Settings |
|-----------|-----------|---------|
| `category` | Category | `name` (text), `slug` (text), `tagline` (text) |
| `product-card` | Product card | `title` (text), `price` (text), `url` (url) |
| `badge` | Badge | `label` (text, default "Zero storefront code change") |

The `badge` and `product-card` blocks are also inherited from the Minimal Liquid Bundle fixture. The `category` block is Urban Kicks-specific.

Inline blocks (defined within section schemas, not as top-level reusable blocks):

- `slide` (in `banner-carousel`): `heading`, `image`, `link`
- `brand` (in `brand-marquee`): `name`
- `link` (in `header`, `footer`): `label`, `href`
- `product-card` (in `featured-products`, `product-grid` schemas): also registered as reusable
- `experience`, `service`, `skill`, `testimonial`, `faqItem`, `project` (in respective section schemas)
- `@app` (app blocks) in `spotlight` and `app-block-slot`

### Special Sections Unique to Urban Kicks

Sections present in Urban Kicks that are not in the generic `createLiquidParitySectionFiles()` set:

- `customer-orders` — order history list with `money_with_currency` filter
- `customer-order-detail` — line items, timeline, tracking number display
- `customer-account` — account nav hub
- `customer-login` / `customer-register` — auth forms posting to `/api/customer/*`
- `customer-settings` — `lb-customer-settings` island with data attributes
- `customer-wishlist` — wishlist grid with `lb-wishlist-toggle` islands
- `customer-addresses` — address grid + `lb-address-manager` island
- `policy-content` — `page.body_html` / `page.content` renderer
- `cart-summary` — full cart with subtotal/coupon/discount/shipping/GST rows
- `search-box` — `lb-search` island wrapper
- `collection-banner` — `collection.title` + `collection.description`
- `collection-product-list` — live `collection.products` loop
- `spotlight` — custom first-party section demonstrating zero-storefront-change deployment

The `spotlight` section is architecturally notable: it is the proof-of-concept for the Liquid canary toggle. It deploys without any change to the React storefront registry.

---

## Minimal Starter Bundle

`createMinimalThemeBundleFixture()` is the JSON-contract starter. It is deliberately minimal:

- One settings group (`colors`) with a single `primaryColor` field (default `#00B3B3`)
- One template (`index`) with a single `hero-banner` section
- One section definition (`hero-banner`) with a `heading` text field
- No blocks
- Full 7-language locale map (`en`, `hi`, `bn`, `mr`, `ta`, `te`, `kn`), each with only `general.cart`

Its purpose is to be the baseline a new merchant receives when no theme is configured and the platform auto-provisions a store. It validates the schema contract without requiring any external dependencies.

What the Minimal Starter Bundle lacks compared to a production-ready theme: no navigation, no product grid, no footer, no customer pages, no cart, no collections, no multi-color palette, no typography control, and no locale strings beyond `cart`.

---

## Portable Liquid Bundle

`createMinimalLiquidThemeBundleFixture()` is the smallest valid Liquid engine bundle. It establishes the `liquid` engine contract:

- One section (`spotlight`) with `heading`/`subheading` settings and two block types: `badge` and `@app`
- One reusable block (`badge`)
- One template (`index`) using `spotlight`
- English-only locale
- Hydration islands wired: `lb-variant-picker`, `lb-add-to-cart`, `lb-search`, `lb-cart-drawer`

Its purpose is a reference fixture for testing the Liquid renderer pipeline end-to-end without bringing in the full Urban Kicks surface area. It demonstrates that a Liquid section can be deployed without changing the storefront React registry.

---

## Preset Architecture

### What Are Theme Presets?

A **theme** is the code artifact — the section definitions, block definitions, Liquid source files, and the settings schema describing what can be customized. A **preset** is a named configuration record within `config.settings_data.presets` (or within a section schema's own `presets` array) that supplies pre-populated values for those customizable fields.

This means the same theme code can present entirely different visual identities simply by swapping the active preset — different colors, typography, content copy, and section arrangement — without any code change.

The `ThemeBundleSettingsDataSchema` already has this shape:

```typescript
{
  current: Record<string, unknown>,      // active values
  presets: Record<string, Record<string, unknown>>  // named presets
}
```

The theme-marketplace `Theme` type already carries `color_presets[]` (an array of `{ name, colors }` objects) and `font_options[]` and `theme_preset_id` at the catalog level. The infrastructure is scaffolded; it is not yet wired to preset-switching logic in the merchant control plane.

Section-level presets (defined inside each section's `presets[]` array) are already implemented and surfaced in `buildLiquidRuntimeSectionSchemas`. These let a section declare multiple named layouts or content variants that appear as one-click options in a hypothetical visual editor.

---

## Current Settings Schema Capabilities

### What Can Be Customized via Settings Today

Settings are validated through `ThemeBundleSettingFieldSchema`. The current field types are:

```
text | textarea | richtext | color | image | select | toggle | range | number | url | radio
```

**Color system** — `color` fields produce hex values. Urban Kicks exposes `primaryColor`, `accentColor`, `surfaceColor`. The renderer maps up to 8 theme-level tokens to CSS custom properties. Color presets at the catalog level (`color_presets[]`) exist in the schema but have no server-side switching mechanism yet.

**Typography system** — `text` fields for `headingFontFamily` and `bodyFontFamily`. No font-weight, size, or line-height fields exist in any current theme. No font-picker type exists (fonts are free-text strings). The renderer maps these to `--font-display` and `--font-body` CSS variables.

**Layout settings** — `range` for column counts (2–4) in product grids; `select` for layout orientation (`sidebar`, `drawer`, `topbar`) in `collectionFilter`; `select` for width (`narrow`, `standard`, `wide`) in content pages; `select` for card style in product grids. There is no grid-gap, spacing, or breakpoint control at the settings level.

**Content settings** — `text`, `textarea`, `richtext`, `image`, `url` fields covering headings, body copy, CTA text/links, images. Section-level content is fully customizable. There is no multi-image gallery picker, no array-of-URLs field, and no structured data field (e.g., a GSTIN input or delivery slot list).

### How CSS Variables Work

The renderer's `buildLiquidThemeHeadAssets()` function is the key mechanism:

1. `config.settings_data.current` is read from the bundle at render time.
2. `LIQUID_THEME_TOKEN_MAP` maps each known setting key to a CSS variable name with a fallback value.
3. For each mapping, if the setting has a non-empty string value it is used; otherwise the fallback applies.
4. `sanitizeCssTokenValue()` strips `< > { } ; @ ( )` characters and truncates to 120 chars as defense against CSS injection.
5. A `:root { --primary: ...; --accent: ...; ... }` block is emitted, followed by the full `LIQUID_THEME_BASE_CSS` string.
6. Both are wrapped in a single `<style data-theme-renderer="liquid">` tag injected via `content_for_header`.
7. DOMPurify's `FORBID_ATTR: ['style']` means inline style attributes are stripped from section HTML — all visual customization must go through the CSS variable layer.

The base CSS classes (`lb-hero-banner`, `lb-product-grid`, etc.) reference `var(--primary)`, `var(--surface)`, `var(--font-body)`, `var(--font-display)`, and `var(--border-color)`. Any new section must use these variables to pick up merchant color customization automatically.

---

## Industry Vertical Analysis

### Electronics

**Required sections:** product specifications table, side-by-side comparison table, tech review grid, filter-by-specification sidebar, warranty/support info block, compatibility checker.

**Current capabilities:**
- `product-detail` renders variants, gallery, reviews, add-to-cart — covers the purchase flow.
- `collectionFilter` has `showPriceFilter`, `showVendorFilter`, layout options — partially usable.
- `faqAccordion` can serve as a warranty/FAQ section.
- `product-grid` with 4 columns and price/rating is production-ready.

**Gaps:**
- No `product-specs` section (key-value table for RAM, storage, display, battery).
- No `comparison-table` section (multi-product side-by-side).
- No `filter-by-specs` section (checkbox filters bound to product metafields such as brand, connectivity, OS).
- No `compatibility-checker` block type.
- The `select` filter type in `collectionFilter` does not model faceted attribute filtering against the product catalog.

**Required new section schemas:**
- `product-specs` — blocks of type `spec` (`{ label: text, value: text }`)
- `comparison-table` — blocks of type `comparison-product` (`{ product_url, highlight: toggle }`)
- `tech-badges` — blocks of type `tech-cert` (`{ label, icon: select }`) for CE/BIS/energy ratings

---

### Fashion / Apparel

**Required sections:** lookbook (editorial image with hotspot product links), size guide, model shot gallery, quick-add color/size swatches, outfit builder.

**Current capabilities:**
- `hero-banner` and `banner-carousel` cover editorial imagery.
- `product-detail` with `lb-variant-picker` handles color/size variant selection.
- `featured-products` can function as a "Shop the look" curated list.
- `category-grid` covers style collections.

**Gaps:**
- No `lookbook` section type — no mechanism for image hotspots pointing to product URLs.
- No `size-guide` section or block type (measurement tables, fit notes).
- `product-card` block has no image field; adding a model shot requires a structural change.
- No `swatches` inline block for color display within a grid card.
- No `outfit-builder` or "frequently bought together" section.

**Required new section schemas:**
- `lookbook` — settings: `imageUrl` (image), `layout` (select: `fullwidth/split`); blocks: `hotspot` (`{ x: number, y: number, product_url: url, label: text }`)
- `size-guide` — blocks: `size-row` (`{ label: text, chest: text, waist: text, length: text }`)

---

### Grocery / Food

**Required sections:** product freshness indicator, nutrition information panel, delivery slot picker, bundle deals, daily essentials quick-add list.

**Current capabilities:**
- `announcement-bar` can communicate same-day delivery cutoffs.
- `product-grid` with add-to-cart covers the main shop surface.
- `featured-products` can serve as "Today's deals" or "Daily essentials."
- `trust-badges` can display delivery promise ("Delivered by 6pm").

**Gaps:**
- No `nutrition-info` section (FSSAI-mandated nutritional tables for packaged food).
- No `freshness-badge` block type (expiry date range, harvest date).
- No `delivery-slot-picker` section or island (requires backend slot API — this is a hydration island gap, not just a schema gap).
- No `bundle-deals` section (multi-product bundle with combined price).
- The `money_with_currency` filter uses minor-unit integers — grocery items priced at sub-₹100 need correct decimal handling which the filter provides, but there is no per-item unit display (per kg, per litre).

**Required new section schemas:**
- `product-freshness` — settings: `showHarvestDate: toggle`, `showExpiryRange: toggle`; blocks: `freshness-item` (`{ label: text, value: text }`)
- `nutrition-table` — blocks: `nutrient` (`{ name: text, per100g: text, perServing: text }`)
- `bundle-deals` — blocks: `bundle` (`{ title: text, items: richtext, price: text, url: url }`)

---

### Dairy / Fresh Produce

**Required sections:** subscription ordering panel, recurring delivery frequency selector, freshness/traceability indicators, farm-to-table story section.

**Current capabilities:**
- `hero-banner` and `about-section` cover brand storytelling.
- `trust-badges` can convey "Farm fresh," "No preservatives" claims.
- The core cart/checkout flow handles one-time purchases.

**Gaps:**
- No subscription ordering infrastructure in the theme engine at all. The platform has no subscriptions domain (confirmed NOT IMPLEMENTED in LCIS v11).
- No `delivery-frequency` selector block type.
- No `traceability-map` section (farm origin, certification links).
- No `recurring-order-summary` section.
- This vertical requires both theme sections and platform-level subscription domain work before a functional preset is viable.

**Required new section schemas (conditional on platform subscriptions):**
- `subscription-panel` — settings: `heading: text`; blocks: `frequency-option` (`{ label: text, interval: select }`)
- `farm-story` — inheritable from `about-section` with an added `certificationBadge: image` field

---

### Furniture / Home Decor

**Required sections:** room visualizer (AR or photo montage), dimension guide, material/finish options, delivery timeline (lead time), assembly instructions.

**Current capabilities:**
- `product-detail` gallery handles multi-angle product images.
- `about-section` with `layout: select` (left/right/center) can present room context shots.
- `banner-carousel` with slide blocks can serve as a room inspiration gallery.
- `faqAccordion` can handle assembly FAQs.

**Gaps:**
- No `dimension-guide` block type (width/height/depth display with unit conversion).
- No `material-picker` block (finish swatches with image preview).
- No `delivery-timeline` section (lead time in working days, pincode-based ETA — requires backend integration).
- No AR/room visualizer hook. The custom element allow-list in `LIQUID_RENDERED_HTML_DOMPURIFY_CONFIG` does not include any AR or 3D viewer element; adding one requires an `ADD_TAGS` and `ADD_ATTR` change to the sanitizer.

**Required new section schemas:**
- `dimensions-panel` — blocks: `dimension` (`{ axis: select [width/height/depth/weight], value: text, unit: select }`)
- `material-options` — blocks: `material` (`{ name: text, imageUrl: image, description: text }`)
- `delivery-lead-time` — settings: `leadTimeDays: number`, `pincodeLookupEnabled: toggle`

---

### Jewelry

**Required sections:** material/metal type selector, customization form (engraving, size), certificate of authenticity display, gift packaging option, hallmark/BIS certification badge.

**Current capabilities:**
- `product-detail` with `lb-variant-picker` handles metal type / stone color as variants.
- `trust-badges` can display BIS hallmark, purity certification.
- `rich-content` / `contentPage` can render certificate details as richtext.
- `faqAccordion` covers care instructions and return policy.

**Gaps:**
- No `customization-form` block type (text engraving input, ring size by finger measurement).
- No `certificate-display` section (renders a linked certification document or image).
- No `gift-packaging` block (toggle gift wrap, add gift message — requires cart-level option not currently surfaced in the theme layer).
- No `hallmark-badge` block distinct from the generic `trust-badges`.
- Metal type purity (22K/18K/925 silver) is not a structured field type today; it would be a free-text setting.

**Required new section schemas:**
- `customization-panel` — blocks: `engraving` (`{ label: text, maxLength: number }`)
- `certification-block` — settings: `certType: select [BIS/IGI/GIA]`, `certNumber: text`, `certificateUrl: url`

---

## Required Schema Changes

### New Section Types Needed

| Section Type | Industry | Required Settings | Liquid Feasibility |
|-------------|----------|-------------------|-------------------|
| `product-specs` | Electronics | section: `heading: text`; blocks: `spec { label, value }` | High — pure Liquid table render |
| `comparison-table` | Electronics | blocks: `comparison-product { product_url, highlight }` | Medium — requires `product` drop injection per block |
| `lookbook` | Fashion | `imageUrl: image`, `layout: select`; blocks: `hotspot { x, y, product_url }` | Medium — CSS positioning of hotspots is feasible |
| `size-guide` | Fashion | blocks: `size-row { label, chest, waist, length }` | High — pure table render |
| `nutrition-table` | Grocery/Food | blocks: `nutrient { name, per100g, perServing }` | High — pure table render |
| `bundle-deals` | Grocery | blocks: `bundle { title, items, price, url }` | High |
| `product-freshness` | Grocery/Dairy | `showHarvestDate: toggle`, `showExpiryRange: toggle` | High |
| `subscription-panel` | Dairy | blocks: `frequency-option { label, interval }` | Low — blocked on platform subscriptions domain |
| `dimensions-panel` | Furniture | blocks: `dimension { axis, value, unit }` | High |
| `material-options` | Furniture | blocks: `material { name, imageUrl, description }` | High |
| `delivery-lead-time` | Furniture | `leadTimeDays: number`, `pincodeLookupEnabled: toggle` | Medium — static display High; dynamic ETA requires island |
| `customization-panel` | Jewelry | blocks: `engraving { label, maxLength }` | Medium — requires new hydration island |
| `certification-block` | Jewelry | `certType: select`, `certNumber: text`, `certificateUrl: url` | High |

### New Block Types Needed

| Block Type | Industry | Purpose |
|------------|----------|---------|
| `spec` | Electronics | Individual product specification row |
| `comparison-product` | Electronics | Column in comparison table |
| `hotspot` | Fashion | Clickable overlay on lookbook image |
| `size-row` | Fashion | Row in size guide table |
| `swatch` | Fashion | Color/material swatch in product card |
| `nutrient` | Grocery/Food | Row in nutrition facts panel |
| `bundle` | Grocery | Bundle deal card |
| `freshness-item` | Grocery/Dairy | Freshness/traceability data point |
| `frequency-option` | Dairy | Subscription frequency choice |
| `dimension` | Furniture | Product dimension axis value |
| `material` | Furniture | Material/finish option |
| `engraving` | Jewelry | Customization input specification |

### Settings Schema Expansions

The current 11 field types (`text`, `textarea`, `richtext`, `color`, `image`, `select`, `toggle`, `range`, `number`, `url`, `radio`) are sufficient for most structural customizations. However, several verticals expose gaps:

**Multi-image / gallery picker** — today `image` accepts a single URL string. A gallery section (lookbook, material options) needs an array of images. No array-type field exists. A `gallery` type or a block-based pattern (one `image` block per image) is the workaround; the block pattern is already the established convention.

**Font picker** — `headingFontFamily` and `bodyFontFamily` are raw `text` fields. A `font` type with a constrained option set would prevent merchants entering invalid CSS font stacks. This is a UX-only gap; the sanitizer already strips dangerous characters.

**Structured address / pincode field** — needed for delivery slot and lead-time sections. Not currently modellable as a single field type.

**Measurement unit select** — `unit: select` with values like `cm / in / mm` for the dimensions panel. This is achievable with the existing `select` type today.

**Rich color palette** — `color_presets[]` exists in the catalog-level `Theme` type but has no corresponding multi-color-group field type in `ThemeBundleSettingFieldSchema`. A `color-group` or named-palette field type would let a merchant switch between a set of coordinated colors in one action rather than editing each variable individually.

---

## Theme Personalization Architecture

### AI-Driven Personalization

The current architecture supports per-merchant customization via `settings_data.current` (one active value set per installed theme instance). The renderer reads `bundle.config.settings_data.current` at render time and injects it as CSS custom properties.

For AI-driven personalization — serving different visual variants to different customer segments — the architecture would need:

1. **Per-request settings override** — `buildLiquidScope` already merges `input.liquidContext?.settings` on top of `bundle.config.settings_data.current`. This is the hook: a middleware layer could inject customer-segment-specific token overrides into `liquidContext.settings` before the render call.
2. **A/B surface in the renderer** — the `LiquidRenderedTheme` result is per-request; no caching layer currently sits between the renderer and the HTTP response in the storefront-runtime. AI-driven overrides would require the storefront proxy to inject the override before calling the renderer.
3. **Segment-keyed preset map** — extending `settings_data.presets` from a name-keyed flat map to a segment-keyed structure (e.g., `presets['segment:returning-buyer']`) is a non-breaking schema extension since `ThemeBundleSettingsDataSchema` uses `.passthrough()`.

### Preset Inheritance Architecture

The natural layering for multi-vertical themes is:

```
Base theme code (sections, blocks, Liquid source files)
  └── Industry preset (settings_data.presets['electronics'])
        └── Merchant customization (settings_data.current)
              └── Customer segment override (runtime liquidContext.settings injection)
```

Today only the bottom layer (merchant customization = `settings_data.current`) is implemented. The industry preset layer exists structurally in `settings_data.presets` but has no merge or activation logic. The customer segment override layer has the hook but no activation path.

Implementing layer two (industry presets) requires:
1. A "apply preset" RPC or merchant control plane action that copies a preset's values into `settings_data.current`.
2. Or, rendering with `settings_data.presets['vertical']` merged under `settings_data.current` with the merchant's overrides taking precedence — a simple object spread in `buildLiquidScope`.

---

## Recommended Preset Architecture

### Single Core Theme + Multiple Presets

**Pros:**
- One codebase to maintain, validate, and secure.
- New section types benefit all verticals simultaneously.
- The 107-validator gate runs once per section, not once per vertical theme.
- The ART-17 freeze (no new React-per-section after freeze) is respected — Liquid sections are additive.
- Merchants who switch verticals get instant re-theming without reinstalling a new theme package.
- `settings_data.presets` and `color_presets[]` are already in the schema to support this model.

**Cons:**
- The bundle grows in section count as verticals are added; Urban Kicks already has ~30 sections, and adding 13 new vertical sections would reach ~43.
- Industry-specific sections (e.g., `nutrition-table`, `subscription-panel`) are shipped to all merchants, increasing validation and bundle size even for merchants who never use them.
- Template composition for each vertical must be managed as named presets in `settings_data`, which requires tooling in the merchant control plane.

**Implementation path:**
1. Add the new section types and blocks to the Urban Kicks Liquid bundle incrementally.
2. Add named presets in `settings_data.presets` for each vertical (`electronics`, `fashion`, `grocery`, `dairy`, `furniture`, `jewelry`).
3. Build a "vertical template selector" in the merchant onboarding flow that calls an "apply preset" action.
4. The per-merchant `settings_data.current` is initialized from the chosen preset.

### Separate Themes Per Vertical

**Pros:**
- Smaller, focused bundles — faster validation, simpler Liquid source.
- Cleaner merchant experience — the marketplace shows vertical-specific themes.
- No section type bleed between verticals (a grocery merchant never sees `lookbook`).

**Cons:**
- Duplicates all shared section code (`hero-banner`, `product-detail`, `header`, `footer`, `cart-summary`, `customer-*`) across every vertical theme package.
- Security fixes and improvements to shared sections must be applied to N theme packages.
- The sanitizer, DOMPurify config, hydration island allowlist, and token map must be kept in sync across N bundles.
- The theme-marketplace is frozen (not a production deploy target); publishing new theme packages would require unfreezing it or bypassing the marketplace entirely.
- ART-17 explicitly freezes new app-marketplace/theme-marketplace surface area.

### Recommended Approach

Based on the evidence in the codebase, the **Single Core Theme + Multiple Presets** model is strongly indicated:

1. `ThemeBundleSettingsDataSchema` already has `presets: Record<string, ThemeBundleJsonObjectSchema>` — the data contract is there.
2. The theme-marketplace is frozen; adding new theme packages is blocked by ART-17.
3. The Liquid engine's `createLiquidParitySectionFiles()` and `createUrbanKicksLiquidThemeBundleFixture()` are both builder functions in a single file; adding new sections is additive, not multiplicative.
4. The merchant control plane already has a `select-plan` and billing surface — a "choose your store type" step can feed the preset selection without new marketplace infrastructure.
5. The `color_presets[]` field at the `Theme` catalog level is purpose-built for this model.

The exception is subscription-based dairy/fresh-produce features, which are blocked on the platform's subscriptions domain (currently NOT IMPLEMENTED) and cannot be unblocked by theme work alone.

---

## Implementation Roadmap

### Phase 1: Foundation (What Already Exists)

- Liquid bundle schema validated and production-ready (`LiquidThemePackageBundleSchema`)
- Urban Kicks as reference Liquid theme with 17 section types, 3 block types
- CSS token injection pipeline (`LIQUID_THEME_TOKEN_MAP` → CSS custom properties)
- DOMPurify sanitization with custom element allowlist
- 7-language locale infrastructure
- `settings_data.presets` map in the bundle schema
- `color_presets[]` and `industry[]` fields in the theme-marketplace `Theme` type
- Built-in section schema registry with 24 section types across JSON-contract and Liquid engines
- `ThemeBundleSettingFieldSchema` with 11 field types

### Phase 2: Preset Infrastructure (What to Build Next)

- Merchant control plane action: "Apply preset to current settings" — merges a named preset from `settings_data.presets` into `settings_data.current`, storing in the DB via the theme installation record
- Vertical preset definitions in `settings_data.presets` for Urban Kicks bundle (electronics, fashion, grocery, furniture, jewelry color palettes and section arrangements)
- Onboarding flow integration: "What type of store are you building?" → preset auto-apply
- `settings_data.presets['vertical']` merge logic in `buildLiquidScope` (runtime preset layer under merchant overrides)
- Additional CSS token map entries: `secondaryColor`, `backgroundColor`, `textColor`, `borderColor` to close the 5-token gap in Urban Kicks

### Phase 3: Vertical Templates (First 3 Verticals)

Priority order based on India market size and current capability gaps:

**Grocery (highest priority):**
- Add `nutrition-table`, `product-freshness`, `bundle-deals` section types to the Urban Kicks bundle
- Add `nutrient`, `freshness-item`, `bundle` block types
- Define `settings_data.presets['grocery']` with green/white color palette and home page composed around daily essentials

**Fashion/Apparel:**
- Add `lookbook`, `size-guide` section types
- Add `hotspot`, `size-row`, `swatch` block types
- Define `settings_data.presets['fashion']` with urban palette and lookbook-first home page
- Extend `product-card` block to include `imageUrl` field

**Electronics:**
- Add `product-specs`, `comparison-table` section types
- Add `spec`, `comparison-product` block types
- Define `settings_data.presets['electronics']` with dark/technical palette

### Phase 4: Personalization Layer

- Segment-keyed settings override via `liquidContext.settings` injection in the storefront proxy
- A/B variant routing: inject different preset values for a merchant's A/B test groups
- Analytics hookup: track which sections and block types are most-used per vertical (LCIS `/api/telemetry` adapter)
- Dairy/Fresh Produce preset: blocked until platform subscriptions domain is implemented; stub the section schemas and mark as `disabled_on: ['*']` until the backend is ready
- Furniture: `delivery-lead-time` section with pincode-lookup hydration island — requires a new `lb-delivery-estimate` custom element to be added to the DOMPurify allowlist and the hydration island registry
