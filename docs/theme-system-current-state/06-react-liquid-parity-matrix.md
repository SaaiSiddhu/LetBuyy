# 06 — React ↔ Liquid Parity Matrix

> **What this is.** The actual, cell-by-cell coverage matrix between the frozen React renderer and the
> canonical Liquid renderer — templates first, then sections — computed from the committed bundle,
> the React registry source, and the live database. Not from any planning document.
>
> Decision chain and pipeline: [05-rendering-pipeline.md](05-rendering-pipeline.md).
> Routes: [02-runtime-and-route-map.md](02-runtime-and-route-map.md).
> `ART-17` / `THEME-R1…R6`: [01-governance-and-invariants.md](01-governance-and-invariants.md).

---

## Status — 2026-08-04

| | |
|---|---|
| **Proven** | Section counts and identities, computed programmatically from `packages/theme-engine/examples/letbuyy-core-liquid/bundle.json` (42 sections, 21 templates, 3 blocks) and from `SECTION_RENDERER_DEFINITIONS` (21 renderer keys). DB-persisted bundle: 33 sections / 12 templates, read live via `psql`. `contentPage` has full parity. Four built-in types have a schema and a kebab mapping but **no renderer in either engine**. |
| **Proven defects** | The React fallback **cannot render 22 of the 42 Liquid section types** — it emits a "Renderer … is not available" placeholder. Three required templates are missing from **both** engines. The DB-persisted bundle is 9 sections and 9 templates behind the repo fixture, and the missing templates silently render the homepage body. `marquee.tsx` is orphaned dead code that the freeze validator nonetheless protects. |
| **Stale docs corrected** | `11_GAP_ANALYSIS.md:406` (claims `contentPage` has no Liquid parity — false); `docs/theme-urban-kicks.md:50` (references a renderer key `core.content-block` that has never existed). |
| **Unresolved** | Whether `collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` are in V1 scope. Which environment holds the authoritative Liquid bundle — the local DB row is both stale *and* `superseded`. |
| **Method** | `node` reads of `bundle.json`; `psql` `jsonb_object_keys` against `supabase_db_Letbuyy_Store`; direct source reads of `renderer-registry.tsx`, `section-type-map.ts`, `built-in-section-schemas.ts`, `theme-governance.ts`. No file modified. |

---

## 1. Headline: the parity direction is inverted from the governance narrative

`ART-17` frames React as the "more-complete" renderer being frozen in favour of Liquid. That was true
historically. **It is no longer true.**

| Measure | React | Liquid (repo fixture) |
|---|---|---|
| Section types with a top-level renderer | **21** renderer keys | **42** sections |
| Section types the other engine cannot render | 22 (see §4.3) | 0 |
| Page templates | routes only — no template artifacts | **21** |
| Blocks | none (React has no block registry) | 3 (`badge`, `category`, `product-card`) |

**Liquid is a strict superset of React at the section level. There are zero React-only top-level
section types.** *(status: proven — set intersection computed from `bundle.json` sections vs
`SECTION_RENDERER_DEFINITIONS` `sectionTypes` arrays at `renderer-registry.tsx:57-215`)*

---

## 2. Template parity matrix

Legend for **"Liquid template — DB bundle"**: the bundle actually persisted for the only live site,
read with
`psql SELECT jsonb_object_keys(template_config->'liquidBundle'->'templates') FROM sites WHERE subdomain='saai'`.

| Template type | React route exists? | Liquid template in repo fixture? | Liquid template in DB bundle? | Verdict |
|---|---|---|---|---|
| `index` | ✅ `/` | ✅ `index` | ✅ | **parity** |
| `product` | ✅ `/product/[productId]` | ✅ `product` | ✅ | **parity** |
| `collection` | ✅ `/collections/[slug]`, `/shop`, `/products` | ✅ `collection` | ✅ | **parity** |
| `list-collections` | ❌ no `/collections` index route | ❌ (`template-registry.ts:140-144` = "NOT YET IN BUNDLE") | ❌ | **MISSING BOTH** |
| `cart` | ✅ `/cart` | ✅ `cart` | ✅ | **parity** |
| `search` | ❌ **no `/search` page** (React search is a client-side filter over ≤100 preloaded products) | ✅ `search` | ✅ | **Liquid-only — and UNREACHABLE**: `search-box.liquid:2` and `header.liquid:4` both link to `/search`, which 404s |
| `page` | ✅ `/[slug]` (single segment only) | ✅ `page` | ❌ | **parity in repo, BROKEN live** |
| `blog` | ✅ `/blog` | ✅ `blog` | ❌ | **parity in repo, BROKEN live** |
| `article` | ✅ `/blog/[slug]` | ✅ `article` | ❌ | **parity in repo, BROKEN live** |
| `404` | ✅ root React 404 (`not-found.tsx:1-14` deliberately delegates — Next does not pass `params`) | ✅ `not_found` | ❌ | **React-only in practice**; the Liquid `not_found` template is exercised only in editor preview and tests |
| `password` | ✅ `/preview/coming-soon` (React) | ✅ `password` | ❌ | **React-only in practice** — `proxy.ts:180-186` rewrites to the React page; `password-gate.liquid:1` says so itself: *"password gate rendering requires proxy routing update (Phase F)"* |
| `customers/login` | ✅ `/customers/login` | ✅ `customers/login` | ✅ | **parity** |
| `customers/register` | ❌ **no page** — `POST /api/customer/register` redirects to `/customers/register`, which 404s | ✅ `customers/register` | ✅ | **Liquid-only — UNREACHABLE** |
| `customers/account` | ✅ `/account` | ✅ `customers/account` | ✅ | **parity** |
| `customers/order` | ⚠️ route exists but redirects to the list — *"React fallback: no React order-detail page exists yet"* (`account/orders/[id]/page.tsx:23,29-30`) | ✅ `customers/order` | ✅ | **Liquid-only** |
| `customers/orders` | ✅ `/account/orders` | ✅ `customers/orders` | ✅ | **parity** |
| `customers/addresses` | ✅ `/account/addresses` | ✅ `customers/addresses` | ❌ | **parity in repo, BROKEN live** |
| `customers/settings` | ✅ `/account/settings` | ✅ `customers/settings` | ❌ | **parity in repo, BROKEN live** |
| `customers/wishlist` | ✅ `/account/wishlist` | ✅ `customers/wishlist` | ❌ | **parity in repo, BROKEN live** |
| `customers/reset_password` | ❌ no page, no `StorefrontRouteType` member | ❌ (`template-registry.ts:317-325`, key `customers/reset` = "NOT YET IN BUNDLE") | ❌ | **MISSING BOTH** |
| `customers/activate_account` | ❌ no page, no `StorefrontRouteType` member | ❌ (`template-registry.ts:329-337`, key `customers/activate` = "NOT YET IN BUNDLE") | ❌ | **MISSING BOTH** |
| `policy` | ✅ `/privacy`, `/terms`, `/shipping`, `/returns` | ✅ `policy` | ❌ | **parity in repo, BROKEN live** |
| `contact` | ❌ no `/contact` route; the React `contact-form.tsx:33` opens a `mailto:` | ❌ no `contact` template (only a `contact-form` **section**) | ❌ | **MISSING BOTH** — and both engines' forms `POST /contact`, while a working gateway endpoint `POST /v1/storefront/:subdomain/contact` exists with **zero callers** |
| `gift_card` | ❌ | ❌ (`template-registry.ts:235-238` = "NOT YET IN BUNDLE") | ❌ | **MISSING BOTH** |

**Not page templates** — `header` and `footer` are bundle keys (present in the fixture and in the DB
bundle) but they are *section groups* consumed by `resolveLiquidSectionGroups`
(`template-resolver.ts:198-217`), not routable templates. Counting them, the fixture has 21 keys and
the DB bundle 12.

*(status: proven)*

### 2.1 What "BROKEN live" means, concretely

`resolveLiquidTemplateKey` falls back to `index` when the requested key is absent
(`template-resolver.ts:132-136`). It does **not** fall back to React. So on the live store today:

> `/blog`, `/privacy`, `/terms`, `/shipping`, `/returns`, `/[slug]`, `/account/addresses`,
> `/account/settings`, `/account/wishlist` and the 404 path all render **the homepage body** under
> those URLs.

This is the single highest-impact behaviour in the theme system, and it is a data problem (a stale
persisted bundle), not a code problem — the repo fixture has every one of those templates.
*(status: proven — derived from the 12-key DB bundle plus the resolver's fallback)*

---

## 3. Section parity matrix — the 25 `BUILT_IN_SECTION_TYPES`

Source of the type list: `packages/theme-engine/src/built-in-section-schemas.ts:3-28` (exactly 25;
`theme-governance-validator.mjs:39-55` asserts the count and that each has a schema).
Kebab mapping: `packages/theme-engine/src/section-type-map.ts:34-66`.
React keys: `apps/storefront-runtime/src/lib/theme-engine/renderer-registry.tsx:57-215`.

| # | Built-in type | React renderer key | React component file | Liquid section type | Schema? | Renderer exists? |
|---|---|---|---|---|---|---|
| 1 | `header` | `core.header` | `components/layout/dynamic-header.tsx` | `header` ✅ | ✅ | **both** |
| 2 | `announcementBar` | `core.announcement-bar` | `components/layout/announcement-bar.tsx` | `announcement-bar` ✅ | ✅ | **both** |
| 3 | `heroBanner` | `core.hero` | `sections/hero.tsx` | `hero-banner` ✅ | ✅ | **both** |
| 4 | `productDetail` | `core.product-detail` | `sections/product-detail-section.tsx` | `product-detail` ✅ | ✅ | **both** |
| 5 | `productGrid` | `core.product-grid` | `sections/product-grid.tsx` | `product-grid` ✅ | ✅ | **both** |
| 6 | `footer` | `core.footer` | `components/layout/dynamic-footer.tsx` | `footer` ✅ | ✅ | **both** |
| 7 | `featuredProducts` | `core.featured-products` | `sections/featured-products.tsx` | `featured-products` ✅ | ✅ | **both** |
| 8 | `testimonials` | `core.testimonials` | `sections/testimonials.tsx` | `testimonials` ✅ | ✅ | **both** |
| 9 | `aboutSection` | `core.about` | `sections/about-section.tsx` | `about-section` ✅ | ✅ | **both** |
| 10 | **`collectionFilter`** | ❌ **none** | ❌ **none** | `collection-filter` ❌ **not in bundle** | ✅ | ❌ **NEITHER** |
| 11 | `newsletter` | `core.newsletter` | `sections/newsletter.tsx` | `newsletter-signup` ✅ | ✅ | **both** ⚠️ see §4.3 |
| 12 | `contentPage` | `core.rich-content` | `sections/rich-content-section.tsx` | `rich-content` ✅ | ✅ | **both** — see §5 |
| 13 | **`instagramFeed`** | ❌ **none** | ❌ **none** | `instagram-feed` ❌ **not in bundle** | ✅ | ❌ **NEITHER** |
| 14 | **`faqAccordion`** | ❌ **none** | ❌ **none** | `faq-accordion` ❌ **not in bundle** | ✅ | ❌ **NEITHER** |
| 15 | **`videoHero`** | ❌ **none** | ❌ **none** | `video-hero` ❌ **not in bundle** | ✅ | ❌ **NEITHER** |
| 16 | `trustBadges` | `commerce.trust-badges` | `sections/trust-badges.tsx` | `trust-badges` ✅ | ✅ | **both** |
| 17 | `appBlockSlot` | `apps.app-block-slot` | `sections/app-block-slot.tsx` | `app-block-slot` ✅ | ✅ | **both** |
| 18 | `categoryGrid` | `commerce.category-grid` | `sections/category-grid.tsx` | `category-grid` ✅ | ✅ | **both** |
| 19 | `brandMarquee` | `commerce.brand-marquee` | `sections/brand-marquee.tsx` | `brand-marquee` ✅ | ✅ | **both** |
| 20 | `portfolioGrid` | `core.portfolio-grid` | `sections/portfolio-grid.tsx` | `portfolio-grid` ✅ | ✅ | **both** |
| 21 | `servicesGrid` | `core.services-grid` | `sections/services-grid.tsx` | `services-grid` ✅ | ✅ | **both** |
| 22 | `skillsSection` | `core.skills` | `sections/skills-section.tsx` | `skills-section` ✅ | ✅ | **both** |
| 23 | `experienceTimeline` | `core.experience-timeline` | `sections/experience-timeline.tsx` | `experience-timeline` ✅ | ✅ | **both** |
| 24 | `contactForm` | `core.contact-form` | `sections/contact-form.tsx` | `contact-form` ✅ | ✅ | **both** |
| 25 | `ctaSection` | `core.cta` | `sections/cta-section.tsx` | `cta-section` ✅ | ✅ | **both** |

### 3.1 The four ghost types — schema and mapping, no renderer anywhere

`collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` occupy 4 of the 25 built-in slots.
Each has:

- a schema in `BUILT_IN_SECTION_SCHEMAS` (`built-in-section-schemas.ts:3-28`),
- a kebab mapping in `BUILT_IN_TO_LIQUID_SECTION_TYPE` (`section-type-map.ts:63-66`),

and **no renderer in either engine** — the kebab keys are absent from `bundle.json` `sections`, and
none appears in `SECTION_RENDERER_DEFINITIONS`. The mapping file admits it in a source comment:

> `// NOT in current bundle → incompatible` — `section-type-map.ts:63-66`

**Runtime consequence:** a merchant, a preset, or an AI generator that emits one of these gets the
React `UnknownSectionFallback` box (`renderer-registry.tsx:254-275`) or a skipped Liquid section, and
`resolveLiquidSectionType()` returns `null` so compositions containing them produce `incompatible`
diff entries.

**The React freeze forecloses one of the two obvious fixes.** `no-new-react-sections-validator.mjs`
hard-fails on any new file under `apps/storefront-runtime/src/components/sections`, so these can only
ever be implemented in Liquid, or removed. Removing them requires changing `BUILT_IN_SECTION_TYPES`
**and** the validator's expected count of 25 in the same commit
(`theme-governance-validator.mjs:39-55`). *(status: proven; scope decision **unresolved**)*

---

## 4. Section parity matrix — the 42 Liquid sections

All 42 carry a `{% schema %}` block (verified: `grep -L '{% schema %}' …/sections/*.liquid` returns
nothing).

### 4.1 The 20 with a direct React renderer key

`about-section`, `announcement-bar`, `app-block-slot`, `brand-marquee`, `category-grid`,
`contact-form`, `cta-section`, `experience-timeline`, `featured-products`, `footer`, `header`,
`hero-banner`, `portfolio-grid`, `product-detail`, `product-grid`, `rich-content`, `services-grid`,
`skills-section`, `testimonials`, `trust-badges`.

These 20 kebab strings appear verbatim in a `sectionTypes` array, so
`COMPATIBILITY_RENDERER_KEYS[section.type]` resolves and a Liquid→React fallback renders them
correctly.

### 4.2 The 22 the React fallback cannot render

| Liquid section | React counterpart | Why the React fallback fails |
|---|---|---|
| `newsletter-signup` | ✅ `sections/newsletter.tsx` (`core.newsletter`) | The registry accepts only the string `'newsletter'` (`renderer-registry.tsx:144`), and `normalizeSectionType` (`store-service.ts:746-774`) has no `newsletter-signup` entry. The pairing exists **only** in `THEME_LIQUID_PORTABLE_SECTION_PARITY` and the compile-time map, neither of which the fallback consults. |
| `banner-carousel` | ⚠️ `sections/banner-carousel.tsx` exists but is **not** a top-level registered section — it renders only nested inside `hero.tsx:7,71`. Its parity `rendererKey` is `frozen.banner-carousel`, which is not a registry key. | no registry entry |
| `marquee` | ⚠️ `sections/marquee.tsx` exists but is **orphaned** — `rg 'sections/marquee'` finds no importer. Parity `rendererKey` `frozen.marquee` is not a registry key. | no registry entry |
| `404-page`, `article-content`, `blog-listing`, `cart-summary`, `collection-banner`, `collection-product-list`, `customer-account`, `customer-addresses`, `customer-login`, `customer-order-detail`, `customer-orders`, `customer-register`, `customer-settings`, `customer-wishlist`, `page-content`, `password-gate`, `policy-content`, `search-box`, `spotlight` (19) | none | Liquid-only by design |

### 4.3 Why this matters — the fallback is not a safe net for these routes

`coerceLiquidTemplateSections` stamps each coerced section with
`rendererKey: 'liquid.section.<type>'` and `type: <liquid kebab>`
(`template-resolver.ts:156-193` (the `rendererKey` stamp is at `:173`)). On a Liquid→React fallback,
`resolveSectionRendererKey` (`renderer-registry.tsx:243-251`) tries the configured key
(`liquid.section.*` — never a match), then `COMPATIBILITY_RENDERER_KEYS[section.type]`.

For the 22 types above that lookup returns `undefined`, so the page renders

> *"Renderer `<type>` is not available in this storefront runtime."* — `renderer-registry.tsx:271`

**So a Liquid render failure on `/cart`, `/customers/login`, `/account/*`, `/blog`, `/[slug]`,
`/privacy` or any page using `spotlight` / `search-box` / `collection-*` produces a page of dashed
placeholder boxes, not a working React page.** The four-layer fallback described in
[05-rendering-pipeline.md](05-rendering-pipeline.md) §5 guarantees *a* response; it does not
guarantee a *usable* one.

*(status: proven by code path — the 22-member set was computed programmatically from `bundle.json`
and the registry's `sectionTypes` arrays. **No test exercises this path**, so the visual outcome is
inferred from `UnknownSectionFallback`'s JSX rather than observed.)*

### 4.4 The 20-entry parity contract, and what it does not cover

`THEME_LIQUID_PORTABLE_SECTION_PARITY` (`theme-governance.ts:23-44`) declares exactly 20
`reactFile → rendererKey → liquidSectionType` triples;
`theme-governance-validator.mjs:69-72` pins the count at 20, and
`no-new-react-sections-validator.mjs:9-30` freezes exactly 20 files under `components/sections/`.
All 20 `liquidSectionType` values are present in the fixture, so
`collectLiquidPortableSectionParityGaps()` returns **empty**.

Two structural gaps in that contract:

1. **It excludes `header`, `footer`, `announcement-bar`** — those React components live under
   `components/layout/`, not `components/sections/`, so the freeze list and the parity list both miss
   them even though all three have renderer keys and Liquid sections.
2. **Two of the 20 entries point at renderer keys that do not exist** — `frozen.banner-carousel` and
   `frozen.marquee`. The parity table is satisfied by the *Liquid* side existing; it never asserts the
   React side is reachable.

Consequently the "20 parity entries ✅" signal that the governance validator emits is weaker than it
reads: it proves 20 Liquid sections exist, not that 20 React↔Liquid pairs both render.
*(status: proven)*

### 4.5 Blocks

The fixture ships 3 blocks — `badge`, `category`, `product-card` — all rendered inside Liquid
sections. **React has no block registry**, so blocks have no parity dimension. A `SectionModel`'s
`blocks` array is passed to `DynamicFooter` only (`renderer-registry.tsx:78`); every other React
renderer ignores it. *(status: proven)*

---

## 5. `contentPage` — resolved

`docs/storefront-liquid-discovery/11_GAP_ANALYSIS.md:406` lists **five** types without Liquid parity,
including `contentPage`. **That is wrong.** `contentPage` has parity at four independent layers:

| Layer | Mapping | Evidence |
|---|---|---|
| Compile time | `contentPage: 'rich-content'`, `'content-page': 'rich-content'` | `packages/theme-engine/src/portable-to-liquid.ts:57-59` |
| Built-in type map | `contentPage: 'rich-content'` | `packages/theme-engine/src/section-type-map.ts:48` |
| Render time alias | `'contentPage' → 'rich-content'`, `'content-page' → 'rich-content'` | `packages/theme-engine/src/theme-renderer.ts:334-341` (`LIQUID_SECTION_TYPE_ALIASES`) |
| React registry | `core.rich-content` accepts `['contentPage','content-page','richContent','rich-content']` | `renderer-registry.tsx:183-188` |
| Bundle artifact | `rich-content.liquid` present | `bundle.json` `sections` |
| Reverse normalisation | `'rich-content' → 'contentPage'` | `store-service.ts:767-768` |

**Resolution: source wins — `contentPage` is at full parity.** The same doc tree already contradicts
itself: `docs/storefront-liquid-discovery/certification/RISK_CLOSURE_REPORT.md:116` records UC-05 as
`CLOSED-IMPLEMENTED`. Only **four** types remain without parity, and they lack a React renderer too,
so they are not Liquid-specific gaps at all. *(status: stale-doc corrected; the parity itself is
proven)*

A second stale mapping in the same family: `docs/theme-urban-kicks.md:50` maps block type
`contentBlock` to renderer key `core.content-block`. **No such renderer key has ever existed** — the
registry declares 21 keys and none is `core.content-block`, and the bundle's only blocks are `badge`,
`category`, `product-card`. Treat that document's renderer-key table as unverified.
*(status: stale-doc)*

---

## 6. Repo fixture vs. DB-persisted bundle — the drift

| | Repo fixture (`packages/theme-engine/examples/letbuyy-core-liquid/bundle.json`) | DB-persisted bundle (`sites.template_config->'liquidBundle'`, subdomain `saai`) | Delta |
|---|---|---|---|
| Sections | **42** | **33** | −9 |
| Templates | **21** | **12** | −9 |
| Blocks | 3 | (not enumerated in this pass) | — |
| `schema_version` | `2026-06-liquid-sections` | same | — |

### 6.1 The 9 templates missing from the live bundle

`article`, `blog`, `customers/addresses`, `customers/settings`, `customers/wishlist`, `not_found`,
`page`, `password`, `policy`.

### 6.2 The 9 sections missing from the live bundle

`404-page`, `article-content`, `blog-listing`, `customer-addresses`, `customer-settings`,
`customer-wishlist`, `page-content`, `password-gate`, `policy-content`.

The two lists correspond one-to-one — this is a single older compile, not random corruption.

**Verification commands (read-only):**

```
psql -c "SELECT string_agg(k,',' ORDER BY k) FROM (SELECT jsonb_object_keys(
           template_config->'liquidBundle'->'templates') AS k FROM sites WHERE subdomain='saai') q;"
  → cart,collection,customers/account,customers/login,customers/order,customers/orders,
    customers/register,footer,header,index,product,search        (12)
```

### 6.3 The release row cannot help

The single `theme_releases` row is `is_current = true` **but** `release_status = 'superseded'`, and
`loadCurrentThemeRelease` requires **both** `is_current = true` **and** `release_status = 'published'`
(`services/api-gateway/src/routes/storefront.ts:838-846`). So no release attaches, and the storefront
falls back to `sites.template_config` — which is the stale 12-template bundle. `themes` rows carry a
`config` jsonb with only `fonts/colors/layout/darkMode`, **no** `liquidBundle` and **no**
`rendererEngine`, so the theme catalog row alone cannot supply the missing templates either.

**Recommended guard, if this is ever fixed:** change `resolveLiquidTemplateKey`
(`template-resolver.ts:127-136`) to return `null` for non-`index` routes when the key is absent, so a
missing template degrades to React instead of rendering the wrong page. That converts a silent
content bug into a visible engine fallback. *(status: proven state; the recommendation is a
suggestion, not shipped behaviour)*

---

## 7. One matrix, two bundles — the duplication

The repo ships two example bundles, `letbuyy-core-liquid` and `urban-kicks-liquid`, and **this matrix
applies identically to both**, because:

| Fact | Evidence |
|---|---|
| Identical 73-file trees; 61 of 73 files byte-identical (83.6 %) | `diff -rq` → 12 differing files |
| **All 42 `sections/*.liquid` and all 3 `blocks/*.liquid` are byte-identical** | SHA256 loop over `sections/ blocks/ layout/` → only `layout/theme.liquid` differs |
| `layout/theme.liquid` differs by **2 lines** — a `<title>` suffix and a body class | `lb-theme lb-theme--letbuyy-core` vs `lb-theme lb-theme--urban-kicks` |
| One authored source: `createLetbuyyCoreLiquidThemeBundleFixture()` derives Core from Urban Kicks by JSON string-replace of three brand tokens, then re-validates | `packages/theme-engine/src/theme-bundle-core.ts:66-81`; `theme-bundle.ts` is 3 317 lines, `theme-bundle-core.ts` is 82 |
| The **compile path uses Urban Kicks**, not Core | `packages/theme-engine/src/portable-to-liquid.ts:103`; `createLetbuyyCoreLiquidThemeBundleFixture` is referenced only by its own definition, `generate-examples.mjs` and tests |
| The DB `letbuyy-core` row is a **verbatim clone with no branding neutralization** — `md5(config)`, `md5(default_template)` and `md5(settings_schema)` are identical to `urban-kicks`, and `default_template::text LIKE '%Urban Kicks%'` is **true** while `LIKE '%LetBuyy Core%'` is **false** | `psql`; `database/supabase/migrations/188_letbuyy_core_theme_row.sql` copies the payload verbatim |

**Verdict:** the source is **shared** (one fixture, mechanically derived — the two can never
structurally drift), the committed artifacts are **fully duplicated** (146 files encoding ~73 files of
unique content), and the DB row is a **pure duplicate**. Duplication risk is therefore low; the
honesty problem is real — "LetBuyy Core" is a cosmetic alias that neither the compile path nor the
database delivers. `docs/theme-discovery/10-letbuyy-core-audit.md:689` describes a rename that source
shows was never performed on the runtime or DB path. *(status: proven; that doc is **stale-doc**)*

The generator's own header instructs *"Re-run this script whenever the fixture or exporter changes,
then commit"* (`packages/theme-engine/examples/generate-examples.mjs:14-19`), and
`examples/index.json` carries `contentHash` values — but **nothing in CI verifies them**, so the
committed artifacts can silently diverge from the fixture. *(status: proven)*

---

## 8. Defect summary for this document

| # | Severity | Defect | Anchor |
|---|---|---|---|
| M-1 | **P0** | The React fallback cannot render 22 of 42 Liquid section types; a Liquid failure on cart / login / account / blog / policy / CMS pages yields placeholder boxes, not a working page. | §4.2–4.3 |
| M-2 | **P0** | The DB-persisted bundle is 9 templates short, and the resolver silently substitutes `index` — 10 shopper URLs render the homepage body. | §2.1, §6 |
| M-3 | **P1** | Three required templates are missing from both engines: `list-collections`, `customers/reset_password`, `customers/activate_account`. `contact` and `gift_card` too. | §2 |
| M-4 | **P1** | `customers/register` and `search` templates exist in both bundles but neither route exists — `/customers/register` is actively linked by the register POST handler. | §2 |
| M-5 | **P1** | Four built-in types (`collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero`) have schemas + mappings but no renderer in either engine; the React freeze forecloses the React fix. | §3.1 |
| M-6 | **P2** | `newsletter-signup` has a React counterpart that the fallback cannot reach — the alias exists at compile time and render time, but not in the registry's `sectionTypes` or `normalizeSectionType`. | §4.2 |
| M-7 | **P2** | `marquee.tsx` is orphaned dead code, yet it is one of the 20 files the freeze validator protects. Deleting it requires changing `no-new-react-sections-validator.mjs:20` **and** `theme-governance-validator.mjs:99-102` in the same commit or the gate fails. | §4.2 |
| M-8 | **P2** | The 20-entry parity contract excludes `header`/`footer`/`announcement-bar` and includes two `frozen.*` renderer keys that do not exist, so "20 parity entries ✅" over-reads. | §4.4 |
| M-9 | **P2** | The two committed example bundles must be regenerated together by a script no CI job runs; `index.json` `contentHash` values are unverified. | §7 |

---

## 9. Open questions

1. **Are `collectionFilter`, `instagramFeed`, `faqAccordion`, `videoHero` in V1 scope?** They occupy
   4 of the 25 built-in slots and 4 of the validator counts. Implement in Liquid, or delete the types
   and adjust the pinned count of 25 — no third option exists under the React freeze.
   *(unresolved)*
2. **Which environment holds the authoritative Liquid bundle?** The local `theme_releases` row is both
   stale (12 templates / 33 sections) **and** `superseded`. Whether staging or production carries a
   current *published* release could not be determined from a local read-only pass.
   *(unresolved)*
3. **Is `customers/register` intended as a Liquid-only page, or was the React page dropped?** The
   register POST handler still redirects there (`api/customer/register/route.ts:22`), which implies it
   was expected to exist. *(unresolved)*
4. **Should `list-collections`, `customers/reset_password` and `customers/activate_account` remain in
   `TEMPLATE_TYPE_REGISTRY`?** As written, the registry declares 28 template types and reads as
   shipped capability while annotating four of them "NOT YET IN BUNDLE" in comments only.
   *(unresolved)*
