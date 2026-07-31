# LetBuyy Core Theme Audit

**Date:** 2026-06-18
**Sources:** `packages/theme-engine/src/theme-bundle.ts` (2971 lines), `theme-renderer.ts`, `theme-governance.ts`, `theme-registry.ts`, `built-in-section-schemas.ts`
**Prior research:** `docs/theme-research/01-theme-system-inventory.md`, `06-liquid-engine-analysis.md`, `03-liquid-coverage-report.md`

---

## 1. Current Theme Object Model

### What defines a "theme" in this system

A "theme" in LetBuyy is split across two layers: a **marketplace record** (the DB row in `themes`) and a **bundle** (the in-process JSON object, either `ThemePackageBundle` or `LiquidThemePackageBundle`).

**DB layer (`themes` + `sites`):**
| Field | Table | Meaning |
|---|---|---|
| `id` | `themes` | UUID primary key |
| `slug` | `themes` | URL-safe identifier (e.g. `urban-kicks-liquid`) |
| `is_active` | `themes` | Whether the theme appears in the catalog |
| `is_premium` / `letbuyy_pricing_type` | `themes` | Pricing gate |
| `template_config` | `sites` | Per-store JSON snapshot of sections/templates |
| `theme_id` | `sites` | Slug of the currently active theme |
| `current_theme_release_id` | `sites` | FK into `theme_releases` |

The `sites` table is the single source of truth for what a store renders. The `theme_releases` table stores immutable snapshots (`release_config`, `release_manifest`). The `theme_instances` / `theme_editor_drafts` tables hold in-progress work before publish.

**Bundle layer (in-process objects):**

There are two bundle schemas, both Zod-validated:

| Schema | Constant | Engine |
|---|---|---|
| `ThemePackageBundleSchema` | `THEME_BUNDLE_SCHEMA_VERSION = '2026-05-json-contract'` | `json-contract` (React) |
| `LiquidThemePackageBundleSchema` | `THEME_LIQUID_BUNDLE_SCHEMA_VERSION = '2026-06-liquid-sections'` | `liquid` |

Both share: `package` (metadata), `config` (settings schema + data), `templates` (map of template keys to section/block configs), `locales`, `renderer`. The Liquid bundle adds: `layout.theme` (single `layout/theme.liquid` file), `sections` (map to `ThemeLiquidSectionFile`), `blocks` (map to `ThemeLiquidBlockFile`).

---

### Template

A **template** is the per-route content contract. It maps a route type to an ordered set of sections.

```typescript
ThemeBundleTemplateSchema = z.object({
  name:     z.string().optional(),      // human label
  layout:   z.string().optional(),      // layout file reference (default: 'theme')
  sections: z.record(z.string(), ThemeBundleTemplateSectionSchema),  // sectionId -> section
  order:    z.array(z.string()),         // explicit render order (must reference existing section IDs)
})
```

- The `order` array is validated: every string in `order` must be a key in `sections`.
- Template keys mirror `StorefrontRouteType` values (`index`, `product`, `collection`, `search`, `cart`, `customers/login`, `customers/register`, `customers/account`, `customers/orders`, `customers/order`, `customers/settings`, `customers/wishlist`, `customers/addresses`, `policy`) plus layout-level keys (`header`, `footer`).
- There is no `page`, `blog`, `article`, `password`, or `not_found` template in the Urban Kicks bundle.

---

### Section

A section is one block of rendered UI on a page. In the JSON-contract engine:

```typescript
ThemeBundleSectionDefinitionSchema = z.object({
  type:              z.string(),            // canonical type key (must equal the map key)
  name:              z.string(),
  description:       z.string(),
  renderer_key:      z.string(),            // e.g. 'core.hero', 'commerce.category-grid'
  settings_schema:   z.record(z.string(), ThemeBundleSettingFieldSchema),
  defaults:          ThemeBundleJsonObjectSchema,
  block_types:       z.array(z.string()),   // allowed block types (references bundle.blocks)
  accepts_app_blocks: z.boolean(),
  presets:           z.array({name, settings}),
  enabled_on:        { templates: string[] },
})
```

In the Liquid engine, a section is a `ThemeLiquidSectionFile`:

```typescript
ThemeLiquidSectionFileSchema = z.object({
  path:   z.string(),  // must match pattern sections/[a-z0-9-_]+.liquid
  source: ThemeLiquidSourceSchema,  // max 200KB, forbids <script, {% include, {% render, {% layout
  schema: ThemeLiquidSectionSchema, // parsed from {% schema %}...{% endschema %} in source
})
```

The schema parsed from the source contains: `name`, `tag` (default `'section'`), `class`, `settings[]`, `blocks[]` (inline block type definitions or `@app`), `presets[]`, `enabled_on`, `disabled_on`.

**Setting field types** (both engines): `text`, `textarea`, `richtext`, `color`, `image`, `select`, `toggle`, `range`, `number`, `url`, `radio`.

**Per-template section instance:**

```typescript
ThemeBundleTemplateSectionSchema = z.object({
  type:        z.string(),   // references a section definition
  settings:    z.record(),   // overrides for this instance
  blocks:      z.record(z.string(), ThemeBundleTemplateBlockSchema),
  block_order: z.array(z.string()),
  disabled:    z.boolean(),
})
```

---

### Block

A block is a repeatable sub-element within a section. Two block variants exist:

**JSON-contract (reusable block definition):**
```typescript
ThemeBundleBlockDefinitionSchema = z.object({
  type:            z.string(),
  name:            z.string(),
  description:     z.string(),
  settings_schema: z.record(z.string(), ThemeBundleSettingFieldSchema),
  defaults:        ThemeBundleJsonObjectSchema,
})
```

**Liquid (reusable block file):**
```typescript
ThemeLiquidBlockFileSchema = z.object({
  path:   z.string(),  // blocks/[a-z0-9-_]+.liquid
  source: ThemeLiquidSourceSchema,
  schema: ThemeLiquidReusableBlockSchema,  // name, settings[], presets[]
})
```

**Liquid (inline block type, declared inside a section schema):**
```typescript
ThemeLiquidSectionInlineBlockSchema = z.object({
  type:     z.string(),
  name:     z.string(),
  limit:    z.number().optional(),
  settings: z.array(ThemeLiquidSchemaSettingFieldSchema),
})
```

**App block special type:**
```typescript
ThemeLiquidAppBlockSchema = z.object({
  type: z.literal('@app'),
  name: z.string(),
  limit: z.number().optional(),
})
```

A template section instance's `blocks` map uses:
```typescript
ThemeBundleTemplateBlockSchema = z.object({
  type:     z.string(),   // must be a defined block type
  settings: z.record(),
  disabled: z.boolean(),
})
```

Block validation in the Liquid bundle: a block used in a template section must satisfy one of three conditions — (a) it is a reusable block file defined in `bundle.blocks`, (b) it is an inline block type declared in that section's schema, or (c) it is an app block type (`@app` or `app:*`) and the section declares `@app` in its schema.

---

### Preset

Presets **do exist** in the system. There are two levels:

1. **Section-level presets** — defined in `ThemeLiquidSectionSchema.presets` (Liquid) and `ThemeBundleSectionDefinitionSchema.presets` (JSON-contract). Each preset is `{ name, category?, settings, blocks[] }`. Presets appear in the theme editor as "quick-start" configurations for a section. Every section created via `createLiquidSectionFile()` automatically gets one default preset with the section's name.

2. **Theme settings presets** — defined in `ThemeBundleSettingsDataSchema.presets`: `z.record(z.string(), ThemeBundleJsonObjectSchema)`. This is a named map of alternative full-theme settings snapshots. The `settings_data.current` object is the live snapshot; `presets` holds named alternatives (e.g. "dark mode", "high contrast"). This is separate from section presets.

3. **Block presets** — `ThemeLiquidReusableBlockSchema.presets` allows a reusable block file to declare its own named presets (same structure as section presets).

The default template factory `getDefaultStorefrontThemeTemplate()` does not use presets directly — it builds the section configuration imperatively. Presets are a theme editor / authoring-time concept for initial configuration suggestions.

---

### Asset

Assets are handled **declaratively** in the bundle manifest, not by file serving logic inside the theme engine package itself.

**How assets are declared:**

Both renderer manifests include an `assets` record:
```typescript
z.record(z.string(), z.object({
  type: z.enum(['stylesheet', 'script', 'font', 'image', 'media', 'json', 'other']),
  path: z.string(),
  content_type: z.string().optional(),
  checksum:     z.string().optional(),
}))
```

The Urban Kicks Liquid bundle declares `assets: {}` — no external assets are registered. All styling is delivered inline via `LIQUID_THEME_BASE_CSS` injected into `content_for_header` as a `<style>` tag.

**CSS token injection:** `buildLiquidRootTokenBlock()` reads `bundle.config.settings_data.current` and maps 8 token keys to CSS custom properties:

| `settings_data.current` key | CSS variable | Default |
|---|---|---|
| `primaryColor` | `--primary` | `#111827` |
| `secondaryColor` | `--secondary` | `#374151` |
| `accentColor` | `--accent` | `#2563eb` |
| `surfaceColor` | `--surface` | `#f8fafc` |
| `backgroundColor` | `--background` | `#ffffff` |
| `textColor` | `--foreground` | `#1a1a2e` |
| `bodyFontFamily` | `--font-body` | `Inter, system-ui, sans-serif` |
| `headingFontFamily` | `--font-display` | `Inter, system-ui, sans-serif` |

**Image handling:** The `asset_url` and `image_url` Liquid filters call `safeLiquidUrl()`. Relative paths are prefixed with `/assets/`; absolute and protocol-relative URLs pass through. There is no CDN upload, Supabase Storage, or file-serving route in this package — asset hosting is outside the theme engine scope.

**Font loading:** No font loading mechanism exists in the current bundle. Fonts are specified as CSS font-family strings in `headingFontFamily` / `bodyFontFamily` settings, but no `@font-face` declarations or `<link rel="stylesheet">` for Google Fonts are generated. The base CSS falls back to `system-ui, sans-serif`.

---

### Snippet

**Snippets are explicitly not supported.** The Zod schema `ThemeLiquidSourceSchema` includes `'{% render'` and `'{% include'` in its `forbiddenFragments` list. Any section source containing these tags fails validation at bundle parse time and is rejected.

The workaround is reusable block files (`bundle.blocks`). A section renders blocks by iterating `section.blocks` in Liquid and outputting `{{ block.content | raw }}` (where `block.content` is the pre-rendered HTML of the block file). Blocks are rendered by the TypeScript layer before being passed into the section scope — they are not Liquid sub-template includes.

There is no concept of a shared snippet library. Each section is self-contained. This is a deliberate security decision: removing `{% render %}` eliminates a class of template injection vectors.

---

## 2. Urban Kicks Bundle — Complete Anatomy

### Identity

The bundle is created by `createUrbanKicksLiquidThemeBundleFixture()` in `theme-bundle.ts` line 1845.

| Field | Value |
|---|---|
| `package.slug` | `'urban-kicks-liquid'` |
| `package.name` | `'Urban Kicks Liquid'` |
| `package.description` | `'First-party Urban Kicks storefront converted to portable Liquid sections and blocks.'` |
| `package.version` | `'1.0.0'` |
| `package.site_types` | `['store']` (default) |
| `package.author_name` | `'LetBuyy'` (default) |
| `renderer.engine` | `'liquid'` |
| `renderer.liquid_ready` | `true` |
| `schema_version` | `'2026-06-liquid-sections'` |
| Layout class on body | `lb-theme lb-theme--urban-kicks` |
| Title tag | `{{ shop.name }} - Urban Kicks` |

The string `'Urban Kicks'` appears in: the `<title>` tag, the `<body>` class, the `package.slug`, the `package.name`, the `package.description`, several template `name` fields, and hardcoded `storeName` defaults in the header/footer section settings. It does NOT appear in section type keys, CSS class names, or commerce logic.

---

### Section types defined (all ~35)

The bundle sections map is assembled by: first spreading `createLiquidParitySectionFiles()` (22 types), then overriding some with inline-defined versions specific to Urban Kicks, and adding new types that have no React parity.

**Sections from `createLiquidParitySectionFiles()` (unchanged — 17 survive after overrides):**

1. `about-section` — merchant story with optional image
2. `app-block-slot` — third-party app extension slot
3. `banner-carousel` — sliding banner with `slide` blocks
4. `brand-marquee` — scrolling brand name strip with `brand` blocks
5. `contact-form` — lead capture form
6. `cta-section` — call-to-action band
7. `experience-timeline` — timeline with `experience` blocks
8. `footer` — footer with `link` blocks (overridden in Urban Kicks with `storeName: 'Urban Kicks'`)
9. `header` — header with `link` blocks (overridden in Urban Kicks with `storeName: 'Urban Kicks'`)
10. `hero-banner` — full-width hero (overridden inline with `eyebrow` field)
11. `marquee` — simple text marquee
12. `portfolio-grid` — project portfolio with `project` blocks
13. `product-detail` — full product detail page section
14. `product-grid` — product grid from collection drop (overridden inline)
15. `rich-content` — generic richtext page renderer
16. `services-grid` — service cards with `service` blocks
17. `skills-section` — skill bars/tags with `skill` blocks
18. `testimonials` — testimonial carousel with `testimonial` blocks
19. `trust-badges` — trust badge strip with `badge` blocks
20. `newsletter-signup` — email signup form (overridden inline)

**Sections defined inline (override parity files or are Urban Kicks / commerce-specific):**

21. `announcement-bar` — announcement strip (overrides parity; no `if` guard on link in Urban Kicks version)
22. `hero-banner` — overrides parity; adds `eyebrow` field, different defaults ("Fresh drops for daily buyers")
23. `category-grid` — overrides parity; uses `{{ block.content | raw }}` pattern
24. `featured-products` — overrides parity; uses `{{ block.content | raw }}`, defaults "Drop-ready collection"
25. `product-grid` — overrides parity; uses `{{ block.content | raw }}`, columns range setting
26. `spotlight` — Liquid-only section, no React parity; accepts `badge` inline blocks + `@app`
27. `newsletter-signup` — overrides parity; slightly different Liquid source structure
28. `collection-banner` — renders `collection.title` + `collection.description`
29. `collection-product-list` — product grid from `collection.products` with `lb-add-to-cart` + `lb-wishlist-toggle`
30. `search-box` — search form using `lb-search` island
31. `cart-summary` — full cart page using `lb-cart` island
32. `customer-login` — HTML POST login form
33. `customer-register` — HTML POST register form
34. `customer-account` — account dashboard with nav links
35. `customer-orders` — order history list from `customer.orders` drop
36. `customer-order-detail` — single order detail from `order` drop
37. `customer-settings` — profile edit using `lb-customer-settings` island
38. `customer-wishlist` — wishlist grid from `customer.wishlist_products` drop
39. `customer-addresses` — address list + `lb-address-manager` island
40. `policy-content` — renders `page.title` + `page.body_html`

**Net unique section types: ~40** (35 as reported in prior research, closer to 40 counting all overrides as distinct types — the overriding Urban Kicks sections shadow the parity versions in the final bundle map).

---

### Color tokens defined

Defined in `config.settings_schema` and `config.settings_data.current`:

| Token key | CSS variable | Value |
|---|---|---|
| `primaryColor` | `--primary` | `#8B5CF6` (violet) |
| `accentColor` | `--accent` | `#F59E0B` (amber) |
| `surfaceColor` | `--surface` | `#F8FAFC` (near-white) |
| `headingFontFamily` | `--font-display` | `Inter` |
| `bodyFontFamily` | `--font-body` | `Inter` |

**Missing from Urban Kicks settings_data.current** (present in `LIQUID_THEME_TOKEN_MAP` with hardcoded fallbacks):
- `secondaryColor` → `--secondary` → falls back to `#374151`
- `backgroundColor` → `--background` → falls back to `#ffffff`
- `textColor` → `--foreground` → falls back to `#1a1a2e`

These three tokens are not in the Urban Kicks settings schema at all — the bundle only declares 5 fields across 2 settings groups (`colors` and `typography`), while the full THEME_SETTINGS_SCHEMA defines 19 fields across 5 groups.

---

### Typography tokens defined

| Token | Key | Default |
|---|---|---|
| Heading font | `headingFontFamily` | `Inter` |
| Body font | `bodyFontFamily` | `Inter` |

Font selection is a raw string (no font-loading mechanism — no `@font-face`, no Google Fonts `<link>`). The settings schema describes them as `type: 'text'` (not `select`), so any font family string can be entered. The `THEME_SETTINGS_SCHEMA` in `theme-registry.ts` uses `type: 'select'` with 8 options for body font and 7 for heading font, but Urban Kicks defines them as free-text `type: 'text'`.

---

### Locale support

The Urban Kicks Liquid bundle defines only one locale:

```
locales: {
  en: { general: { cart: 'Cart' } }
}
```

The minimal JSON-contract fixture (`createMinimalThemeBundleFixture`) defines 7 locales: `en`, `hi`, `bn`, `mr`, `ta`, `te`, `kn` — all with a `general.cart` key. Urban Kicks Liquid dropped all non-English locales. The `| t` filter resolves `'general.cart'` (used in the header section: `{{ "general.cart" | t }}`), so non-English stores using this bundle would silently fall back to displaying the key string.

---

### Blocks defined

The Urban Kicks bundle's `blocks` map (reusable block files, separate from inline block types):

| Block type | File | Description |
|---|---|---|
| `category` | `blocks/category.liquid` | Category card rendered as `<a>` linking to `/collections/{{ block.settings.slug }}`. Fields: `name`, `slug`, `tagline`. |
| `product-card` | `blocks/product-card.liquid` | Static product card `<article>` with title, price, URL. Fields: `title`, `price` (raw string — NOT a money drop), `url`. |
| `badge` | `blocks/badge.liquid` | `<span class="lb-badge">` for spotlight section. Fields: `label`. |

Only 3 reusable block files. All other blocks in the bundle are **inline block types** (declared inside section schemas: `link` in header/footer, `slide` in banner-carousel, `brand` in brand-marquee, `product-card` as inline in featured-products, `testimonial` in testimonials, etc.).

---

### What makes it a "fashion/sneakers" theme vs a generic theme

**Hardcoded Urban Kicks branding (found in the fixture):**

1. `<title>{{ shop.name }} - Urban Kicks</title>` — the "- Urban Kicks" suffix is literal
2. `<body class="lb-theme lb-theme--urban-kicks">` — CSS class `lb-theme--urban-kicks`
3. `storeName: 'Urban Kicks'` default in header and footer settings
4. Footer tagline default: `'First-party Liquid commerce storefront.'`
5. `package.slug = 'urban-kicks-liquid'`, `package.name = 'Urban Kicks Liquid'`
6. Template names: `'Urban Kicks header'`, `'Urban Kicks home page'`, etc.
7. Section block defaults with product names: `'Velocity Runner'`, `'Everyday Hoodie'`, `'Street Cap'`, `'Court Sneaker'`, `'Transit Backpack'`
8. Category defaults: `'Sneakers'` / `'sneakers'`, `'Apparel'` / `'apparel'`, `'Accessories'` / `'accessories'`
9. `spotlight-app` block settings: `extension_handle: 'urban-offer'`, `slot: 'home.spotlight.offer'`
10. Home page hero defaults: `eyebrow: 'New season essentials'`, `heading: 'Fresh drops for daily buyers'`, `subheading: 'Launch-ready sneakers, apparel, and accessories...'`
11. Newsletter default: `title: 'Get first access'`, `subtitle: 'Store updates, new drops...'`
12. Color palette: `#8B5CF6` (violet primary) + `#F59E0B` (amber accent) — a specific brand identity

**Fashion/sneakers vertical specifics:**
- `spotlight` section is a demo section for "drop culture" (new product launches)
- The `category-grid-default` preset hardcodes Sneakers/Apparel/Accessories as the three default categories
- The `featured-products` heading default is "Drop-ready collection" (drop = streetwear release)
- The announcement bar default is "Free shipping on fresh drops this week" (sneaker culture language)
- `header-collections` nav block points to `/collections/new-arrivals` by default

**What is NOT vertical-specific:**
- All section types (hero-banner, category-grid, product-grid, etc.) are structurally generic
- The commerce drops (`shop`, `product`, `collection`, `cart`, `customer`) are platform-wide
- The hydration islands (`lb-add-to-cart`, `lb-cart`, etc.) are universal commerce interactions
- The CSS class naming (`lb-*`) is platform-wide, not fashion-specific
- The layout template (`layout/theme.liquid`) has only one Urban Kicks-specific line: `<title>{{ shop.name }} - Urban Kicks</title>`

---

### What is genuinely reusable vs what is branding-specific

**Genuinely reusable (zero changes needed):**
- All section type schemas and Liquid source (once defaults are generalized)
- The `createLiquidParitySectionFiles()` output (17 sections) — these are entirely generic
- The 9 hydration islands
- The `LiquidThemePackageBundleSchema` structure
- The `buildLiquidThemeHeadAssets()` CSS injection pipeline
- The `LIQUID_THEME_TOKEN_MAP` and `LIQUID_THEME_BASE_CSS`
- The `ThemeLiquidSectionFileSchema` validation contract
- The parity block files: `category.liquid`, `badge.liquid`
- The commerce drop interfaces (`LiquidCommerceDrops`)

**Branding-specific (requires rename/replace):**
- `package.slug`, `package.name`, `package.description`
- Default `storeName` values in header/footer settings
- The `<title>` suffix `- Urban Kicks`
- The body class `lb-theme--urban-kicks`
- Template `name` fields (`'Urban Kicks home page'`, etc.)
- Section content defaults (headings, copy, product names, category slugs)
- Color values (`#8B5CF6`, `#F59E0B`)
- The `product-card` reusable block (price is a raw string, not a money drop — a deliberate simplification that makes it branding-specific in its current form)

---

## 3. Can Urban Kicks Become LetBuyy Core?

### Coupling Analysis

#### Hardcoded to Urban Kicks branding

All coupling is in `createUrbanKicksLiquidThemeBundleFixture()` in `theme-bundle.ts`. The coupling is **shallow and localized** — concentrated in the `package` metadata object, the `layout.theme.source` HTML (one line), and the `config.settings_data.current` color values. No section Liquid source contains any Urban Kicks brand string — the branding is in defaults and metadata, not in rendering logic.

**Specific lines requiring change to create a generic bundle:**

| Location | Current value | Generic replacement |
|---|---|---|
| `package.slug` | `'urban-kicks-liquid'` | `'letbuyy-core'` or `'letbuyy-core-liquid'` |
| `package.name` | `'Urban Kicks Liquid'` | `'LetBuyy Core'` |
| `package.description` | `'First-party Urban Kicks storefront...'` | `'Default LetBuyy storefront theme'` |
| `layout.theme.source` `<title>` | `{{ shop.name }} - Urban Kicks` | `{{ shop.name }}` |
| `layout.theme.source` `<body class>` | `lb-theme lb-theme--urban-kicks` | `lb-theme` |
| `header.sections['header-default'].settings.storeName` | `'Urban Kicks'` | `'{{ shop.name }}'` |
| `footer.sections['footer-default'].settings.storeName` | `'Urban Kicks'` | `'{{ shop.name }}'` |
| `footer.sections['footer-default'].settings.tagline` | `'First-party Liquid commerce storefront.'` | `''` or removed |
| `index.sections['hero-default'].settings.heading` | `'Fresh drops for daily buyers'` | `'Welcome to {{ shop.name }}'` or empty |
| `index.sections['hero-default'].settings.subheading` | `'Launch-ready sneakers, apparel...'` | `''` |
| `config.settings_data.current.primaryColor` | `'#8B5CF6'` (violet) | `'#000000'` or neutral |
| `config.settings_data.current.accentColor` | `'#F59E0B'` (amber) | `'#2563eb'` |
| Template `name` fields (12 occurrences) | `'Urban Kicks ...'` | strip prefix |

#### Hardcoded to fashion/sneakers vertical

The following defaults should be abstracted or removed for a generic core theme:

| Location | Fashion-specific default | Generic replacement |
|---|---|---|
| Category grid blocks | Sneakers/Apparel/Accessories | Empty blocks (let merchant populate) |
| `index['hero-default'].eyebrow` | `'New season essentials'` | `''` or generic |
| `announcement-default.text` | `'Free shipping on fresh drops this week.'` | `'Welcome to our store'` |
| `featured-collection-default.title` | `'Drop-ready collection'` | `'Featured Collection'` |
| `product-sneaker`, `product-hoodie`, `product-cap` blocks | Specific sneaker/apparel products | Remove or use placeholder names |
| `header-collections` nav block | `/collections/new-arrivals` | `/collections` |
| `newsletter-default.title` | `'Get first access'` | `'Stay updated'` |
| `spotlight-default.heading` | `'A brand-new Liquid section'` | `'Spotlight'` or remove section |
| `spotlight-app.extension_handle` | `'urban-offer'` | remove or empty |

#### Generic infrastructure usable by any vertical

Everything below is already vertical-neutral and requires zero changes:

- All 40 section types and their Liquid source (the HTML/Liquid logic is commerce-pattern neutral)
- All 9 hydration islands
- The `config.settings_schema` structure (5 groups: colors, typography — currently only 2 in Urban Kicks, but the THEME_SETTINGS_SCHEMA defines 5)
- The locale resolution system
- The `ThemeBundleTemplateSchema` validation
- The 15 template keys covering 14 route types + header/footer layout
- The `LIQUID_THEME_BASE_CSS` base stylesheet
- The `LIQUID_THEME_TOKEN_MAP` CSS variable system
- The `LiquidThemePackageBundleSchema` Zod schema

---

### Generalization Requirements

**Sections that require abstraction to be generic:**

| Section | Issue | Generic fix |
|---|---|---|
| `spotlight` | Schema says "A brand-new Liquid section" and `'Zero storefront code change'` badge — clearly a demo | Rename to something meaningful (`feature-highlight`) or expand settings |
| `category-grid` inline Urban Kicks version | Uses `{{ block.content | raw }}` but the inline block type `'category'` is untyped in the inline schema | The parity-file version is better (explicit block fields); override should be dropped |
| `featured-products` Urban Kicks version | `product-card` blocks use raw price string, not a money drop — no `| money_with_currency` filter | The parity-file version is better |
| `product-grid` Urban Kicks version | Same `{{ block.content | raw }}` pattern relying on static block data | The version from `createLiquidParitySectionFiles()` uses `collection.products` loop which is correct for live data |
| `header` / `footer` | `storeName` default is `'Urban Kicks'` | Change default to `'{{ shop.name }}'` |
| `newsletter-signup` | Copy targets sneaker drop culture | Change defaults to neutral copy |

**What needs to be renamed:**

| Current | Rename to |
|---|---|
| `createUrbanKicksLiquidThemeBundleFixture()` | `createLetbuyyCoreLiquidThemeBundleFixture()` |
| `package.slug: 'urban-kicks-liquid'` | `'letbuyy-core'` |
| `THEME_LIQUID_BUNDLE_SCHEMA_VERSION` (unchanged — already generic) | Keep as-is |
| Body class `lb-theme--urban-kicks` | Remove (just `lb-theme`) |

**What needs to be parameterized:**

The Urban Kicks bundle hardcodes section content as static string defaults. A LetBuyy Core theme should:
1. Remove all product name defaults from `featured-products` / `product-grid` blocks (or use generic names like "Product 1")
2. Remove category slug defaults (or use generic: `new-arrivals`, `featured`, `sale`)
3. Make hero defaults vertical-neutral (`'Welcome to our store'`, `'Browse our catalog'`)
4. Remove the `spotlight` section from the default index template (it is a demo section that merchants shouldn't see unless they add it)

---

### Dependency Map

```
createUrbanKicksLiquidThemeBundleFixture()
  |
  +-- depends on:
  |     createLiquidParitySectionFiles()   [generates 22 generic parity sections]
  |     parseLiquidThemePackageBundle()    [Zod validation]
  |     THEME_LIQUID_BUNDLE_SCHEMA_VERSION
  |     THEME_LIQUID_RENDERER_VERSION
  |     LIQUID_THEME_BUNDLE_PATHS.layout
  |     liquidSetting() / createLiquidSectionFile()  [local helpers]
  |
  +-- is depended on by:
        compilePortableToLiquidBundle()   [portable-to-liquid.ts — uses fixture as base template]
        compilePortableConfigForPublish() [wraps the above]
        Tests: liquid-l3-compiler.test.ts, liquid-l4-chrome.test.ts, liquid-l5-product.test.ts, ...
        getDefaultStorefrontThemeTemplate()  [theme-registry.ts — hardcodes themeId: 'urban-kicks']

createLiquidParitySectionFiles()
  |
  +-- is depended on by:
        createUrbanKicksLiquidThemeBundleFixture()  [spread into sections map]
        createMinimalLiquidThemeBundleFixture()     [indirectly, same parity sections available]

LIQUID_THEME_BASE_CSS  (theme-renderer.ts)
  |
  +-- is depended on by:
        buildLiquidThemeHeadAssets()  [injected on every Liquid render]

getDefaultStorefrontThemeTemplate()  (theme-registry.ts)
  |
  +-- hardcodes: themeId = 'urban-kicks'
  +-- is depended on by: storefront-runtime (fallback when no published template)
```

**Key coupling risk:** `compilePortableToLiquidBundle()` uses `createUrbanKicksLiquidThemeBundleFixture()` as the base fixture for ALL stores compiled to Liquid — not just Urban Kicks stores. This means every store compiled to Liquid inherits the Urban Kicks slug, body class, and `- Urban Kicks` title suffix until the compiler is updated. This is the highest-priority fix for any "LetBuyy Core" migration.

---

## 4. Section Schema Analysis

### All section types and their universality rating

| Section Type | Purpose | Universal? | Vertical-Specific? | Can Be Generalized? |
|---|---|---|---|---|
| `header` | Site header with nav, search, cart | Yes | No | Already generic; defaults need `{{ shop.name }}` |
| `footer` | Site footer with links | Yes | No | Already generic; defaults need `{{ shop.name }}` |
| `announcement-bar` | Slim promotional banner | Yes | No (copy is vertical-specific) | Yes; change default copy |
| `hero-banner` | Full-width hero with CTA | Yes | No (eyebrow/copy are) | Yes; change defaults |
| `product-grid` | Grid of products from `collection.products` | Yes (any commerce store) | No | Yes — parity file version is already generic |
| `product-detail` | Single product page | Yes | No | Already generic |
| `featured-products` | Curated editorial product set with static blocks | Yes | No | Yes — parity file version uses live collection; Urban Kicks version uses static blocks |
| `category-grid` | Visual category cards | Yes | Mildly (default categories are SNK/APR/ACC) | Yes; remove defaults |
| `newsletter-signup` | Email capture | Yes | No (copy is) | Yes; change default copy |
| `trust-badges` | Trust/feature badges | Yes | No | Already generic |
| `testimonials` | Customer testimonials | Yes | No | Already generic |
| `brand-marquee` | Brand logo strip | Yes | No | Already generic |
| `contact-form` | Lead capture form | Yes | No | Already generic |
| `cta-section` | Call-to-action band | Yes | No | Already generic |
| `about-section` | Merchant story | Yes | No | Already generic |
| `rich-content` | Free-form richtext | Yes | No | Already generic |
| `app-block-slot` | Third-party app extension | Yes | No | Already generic |
| `banner-carousel` | Image slider | Yes | No | Already generic |
| `collection-banner` | Collection header | Yes | No | Already generic |
| `collection-product-list` | Products from `collection.products` | Yes | No | Already generic |
| `search-box` | Search form | Yes | No | Already generic |
| `cart-summary` | Full cart page | Yes | No | Already generic |
| `customer-login` | Login form | Yes | No | Already generic |
| `customer-register` | Register form | Yes | No | Already generic |
| `customer-account` | Account overview | Yes | No | Already generic |
| `customer-orders` | Order history | Yes | No | Already generic |
| `customer-order-detail` | Single order detail | Yes | No | Already generic |
| `customer-settings` | Profile + password edit | Yes | No | Already generic |
| `customer-wishlist` | Wishlist product grid | Yes | No | Already generic |
| `customer-addresses` | Address CRUD | Yes | No | Already generic |
| `policy-content` | Policy/CMS page | Yes | No | Already generic |
| `spotlight` | Demo feature highlight section | No (demo artifact) | Not vertical-specific, but not production-ready | Rename/replace; currently used as a Liquid capability demo |
| `portfolio-grid` | Portfolio work grid | Partial (non-store sites) | No | Generic; remove from `store` index default |
| `services-grid` | Service cards | Partial (service sites) | No | Generic; remove from `store` index default |
| `skills-section` | Skill bars | Partial (portfolio/resume) | No | Generic; remove from `store` index default |
| `experience-timeline` | Work history | Partial (portfolio/resume) | No | Generic; remove from `store` index default |
| `marquee` | Text ticker | Yes (but limited use) | No | Generic; niche use case |

---

## 5. Missing Core Concepts

### What a production "LetBuyy Core" theme needs that Urban Kicks doesn't have:

#### Missing section types

1. **`page-content`** — a generic CMS page renderer. The `policy-content` section renders policy pages; there is no equivalent for the `page` route type. The `rich-content` section (from parity files) could fill this role but is not included in any template for the `page` route.

2. **`blog-post-list`** — blog index page (not implemented at platform level; `blog` route has no template and no backend drop).

3. **`article-content`** — single blog article (same — no backend).

4. **`not-found`** — 404 error page.

5. **`store-password`** — storefront password gate (the platform middleware does not implement this yet).

6. **`collection-filter`** — filter/sort controls for collection pages. The `collectionFilter` type exists in `BUILT_IN_SECTION_TYPES` and `ADDITIONAL_BUILT_IN_SECTION_SCHEMAS` but has NO Liquid section file equivalent. The `collection-product-list` section has no filtering UI. This is a meaningful gap for any store with >20 products.

#### Missing block types

1. **`faq-item`** — the `faqAccordion` section type is in `BUILT_IN_SECTION_TYPES` but has no Liquid section file equivalent at all.

2. **`video`** — the `videoHero` section type is in `BUILT_IN_SECTION_TYPES` but has no Liquid equivalent. No video embed pattern exists.

3. **`instagram-post`** — `instagramFeed` is in `BUILT_IN_SECTION_TYPES` but has no Liquid equivalent.

4. **`nav-dropdown`** / **`nav-mega-menu`** — the header only supports flat `link` blocks with a label and href. No dropdown or mega-menu structure.

5. **`footer-column`** — the footer accepts `link` blocks but has no column grouping. A production footer typically needs multi-column layout with column headers.

#### Missing setting types

The current `ThemeBundleSettingFieldSchema` covers: `text`, `textarea`, `richtext`, `color`, `image`, `select`, `toggle`, `range`, `number`, `url`, `radio`.

Missing setting types commonly needed for production themes:
1. **`font`** — a font picker (currently `text` or `select` with hardcoded options)
2. **`video`** — video URL field (distinct from `url`)
3. **`json`** — structured data input (e.g. social link objects)
4. **`collection`** — a collection picker (currently a text `collectionHandle` field — no UI integration)
5. **`product`** — a product picker (currently hardcoded product URLs in static blocks)
6. **`liquid`** — free-form Liquid code block (for advanced customization)

#### Missing asset management

1. **No font loading.** The `headingFontFamily` / `bodyFontFamily` settings accept font names but nothing loads them. A production theme needs `@font-face` declarations or `<link rel="preload">` for Google Fonts. The `LIQUID_THEME_BASE_CSS` uses `font-family: var(--font-body)` which falls back to `system-ui` silently.

2. **No external stylesheet support.** `bundle.renderer.assets` is always `{}`. A production theme that references custom CSS files (icon libraries, animation libraries) has no mechanism to declare or load them.

3. **No image optimization.** The `image_url` filter calls `safeLiquidUrl()` which prefixes relative paths with `/assets/` but does no resizing, CDN transformation, or `srcset` generation. Product image performance (WebP, responsive images) is not handled.

4. **No SVG sprite / icon system.** Trust badges have icon `type: 'select'` with options like `'truck'`, `'shield-check'` but the Liquid source just renders text — no actual SVG icons.

#### Missing snippet support

As documented in Section 1, `{% render %}` and `{% include %}` are forbidden. This means:
- No shared partials for repeated UI patterns (e.g. a product card used identically in `product-grid`, `collection-product-list`, and `featured-products`)
- Currently these three sections duplicate nearly identical product card HTML inline
- The workaround (reusable block files) only works when the container section explicitly iterates blocks — it cannot be called procedurally from within arbitrary Liquid

#### Missing i18n beyond current locales

The Urban Kicks bundle only has `en: { general: { cart: 'Cart' } }`. Missing:

1. **All non-English locales** — the minimal JSON-contract fixture has `hi`, `bn`, `mr`, `ta`, `te`, `kn` for India-first localization, but Urban Kicks Liquid dropped them all.

2. **Section-level translation keys.** Section default text values (headings, button labels, placeholders) are hardcoded English strings. No section uses `{{ "sections.hero.heading" | t }}` — all text is in `section.settings.*` which is editable but not translatable via the `| t` filter at the section level.

3. **Error/state strings.** Messages like `'No orders yet.'`, `'Your cart is empty.'`, `'Please sign in to view your account.'`, `'Order not found.'` are hardcoded English strings in section Liquid source. These cannot be translated without changing the Liquid source.

4. **Currency/date formatting.** The `money` and `money_with_currency` filters use `en-IN` locale hardcoded in `formatLiquidMoney()`. There is no locale-aware date formatting filter.

---

## 6. Recommendations

### What can be renamed/reused directly

The following Urban Kicks sections can become LetBuyy Core sections with **no source changes** — only metadata changes (defaults, template names):

1. All 17 sections from `createLiquidParitySectionFiles()` that are NOT overridden by Urban Kicks inline definitions — these are already generic (`about-section`, `app-block-slot`, `banner-carousel`, `brand-marquee`, `contact-form`, `cta-section`, `experience-timeline`, `marquee`, `portfolio-grid`, `rich-content`, `services-grid`, `skills-section`, `testimonials`, `trust-badges`).

2. All customer account sections (`customer-login`, `customer-register`, `customer-account`, `customer-orders`, `customer-order-detail`, `customer-settings`, `customer-wishlist`, `customer-addresses`) — these are entirely data-driven and brand-neutral.

3. Commerce sections with no brand content (`collection-banner`, `collection-product-list`, `search-box`, `cart-summary`, `policy-content`) — already generic.

4. The reusable block files `category.liquid` and `badge.liquid` — generic.

5. The `layout/theme.liquid` source with two small fixes: remove `- Urban Kicks` from `<title>`, remove `lb-theme--urban-kicks` from `<body class>`.

6. The `LIQUID_THEME_BASE_CSS` stylesheet — already generic (uses only `var(--*)` tokens and `.lb-*` class names).

### What needs abstraction

1. **`createUrbanKicksLiquidThemeBundleFixture()` → `createLetbuyyCoreLiquidThemeBundleFixture()`**: Rename function, update `package.slug` to `'letbuyy-core'`, `package.name` to `'LetBuyy Core'`, fix layout title/body class, replace all `storeName: 'Urban Kicks'` defaults with `'{{ shop.name }}'`, neutralize hero/newsletter/announcement copy, remove fashion-specific category blocks, update template names.

2. **`compilePortableToLiquidBundle()`** in `portable-to-liquid.ts`: Currently calls `createUrbanKicksLiquidThemeBundleFixture()` as its base. Once the Core fixture exists, this should switch to `createLetbuyyCoreLiquidThemeBundleFixture()`.

3. **`getDefaultStorefrontThemeTemplate()` in `theme-registry.ts`**: Currently hardcodes `themeId = 'urban-kicks'`. Change to `'letbuyy-core'` when the Core bundle is registered.

4. **The 5 Urban Kicks override sections** (`announcement-bar`, `hero-banner`, `category-grid`, `featured-products`, `product-grid`): The parity-file versions are better for generic use (they use live data drops, not static block content). The Urban Kicks overrides use `{{ block.content | raw }}` with static product name blocks — this is fine for a demo but not for a production core. The parity-file versions should be canonical.

5. **The `spotlight` section**: This is a Liquid engine capability demo ("A brand-new Liquid section", "Zero storefront code change"). Rename to `feature-highlight` or `editorial-block` with meaningful settings, or exclude from the Core index template default.

6. **The `product-card` reusable block**: The `price` field is `type: 'text'` (a raw string like `'Rs 4,999'`). This is a static demo block. For a production Core theme, the product grid and featured products sections should loop over `collection.products` with `{{ item.price | money_with_currency: item.currency }}` — as the parity-file versions already do.

7. **The settings schema**: Urban Kicks only defines `colors` (3 fields) and `typography` (2 fields). The full `THEME_SETTINGS_SCHEMA` defines 5 groups (colors 5 fields, typography 2 fields, layout 3 fields, header 5 fields, footer 4 fields) and should be the basis for the Core theme settings schema.

8. **Locale support**: Add `hi`, `bn`, `mr`, `ta`, `te`, `kn` back to the Core bundle (they exist in the JSON-contract minimal fixture). Translate at minimum the UI strings hardcoded in section Liquid source (`'No orders yet.'`, `'Your cart is empty.'`, etc.) using the `| t` filter.

### What is strictly Urban Kicks and should stay separate

1. **Color palette** (`primaryColor: '#8B5CF6'`, `accentColor: '#F59E0B'`) — these are the Urban Kicks brand colors. A Core theme should use neutral defaults (`#000000` primary, `#2563eb` accent, or a neutral gray scale).

2. **The `spotlight` section default content** — the heading `'A brand-new Liquid section'` and the `'urban-offer'` extension handle are Urban Kicks-specific demo content.

3. **Product and category block presets** (Velocity Runner, Everyday Hoodie, Street Cap, Court Sneaker, Transit Backpack, Sneakers/Apparel/Accessories) — these are Urban Kicks sample data for demos.

4. **The `lb-theme--urban-kicks` CSS class** — if third-party CSS ever targets this class for Urban Kicks-specific overrides, it should remain as a per-theme override class in the Urban Kicks bundle, not in Core.

5. **The footer tagline** `'First-party Liquid commerce storefront.'` — this is internal LetBuyy engineering copy that should never appear in a merchant's storefront.

---

*File: `/Users/saai_sidd/Git/Letbuyy_Store/docs/theme-discovery/10-letbuyy-core-audit.md`*
*Sources: `packages/theme-engine/src/theme-bundle.ts`, `theme-renderer.ts`, `theme-governance.ts`, `theme-registry.ts`, `built-in-section-schemas.ts`*
