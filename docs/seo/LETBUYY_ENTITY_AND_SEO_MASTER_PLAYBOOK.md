# LetBuyy — Entity & SEO Master Playbook

> Goal: make Google (and every LLM / knowledge graph) understand that **LetBuyy** is
> a distinct company — not a typo of a similarly spelled brand — and rank LetBuyy,
> its merchant storefronts, its app/theme marketplaces, and its developer portal.
>
> Canonical domain decision: **`letbuyy.com`**. The repository now defaults active
> platform URLs to `.com`; this playbook keeps the `.store` redirect/cutover steps
> as an external DNS and search-console migration checklist.

**Status legend:** ✅ implemented in this pass · 🔧 you must do (infra/external) · 📝 ready-to-paste snippet included below.

---

## 0. TL;DR — what changed in code, what you still do

In this pass the repo was upgraded from "basic SEO" to "entity-grade SEO," all
pointed at `letbuyy.com` through a **single, migration-safe config layer** so the
domain cutover is a coordinated flip, not 150 scattered edits.

✅ **Already implemented (type-checked clean across `shared-types` + 5 apps):**

- A canonical brand/entity source of truth: `packages/shared-types/src/brand.ts`
  (`BRAND`, `CANONICAL_DOMAIN`, `PLATFORM_DOMAINS`, `buildPlatformOrganizationJsonLd`,
  `buildBrandSameAs`) + an extended `SeoSchema` (canonical_url, og_*, robots_directive,
  focus_keyword, structured_data_type, alternate_name).
- Platform entity structured data on the marketing site: a single `@graph` with a
  rich **Organization** (legalName, alternateName, founder, foundingDate, contactPoint,
  areaServed, raster logo) + **WebSite** + **SoftwareApplication**, all on `letbuyy.com`.
- Two **real raster brand assets** generated and committed:
  `apps/marketing-site/public/icons/letbuyy-logo-512.png` (Knowledge-Graph logo) and
  `apps/marketing-site/public/og/letbuyy-default.png` (1200×630 social card — the old OG
  was an SVG, which social platforms can't render).
- Storefront commerce schema upgraded: **Product** now has `priceValidUntil`, `seller`,
  and *guarded* `aggregateRating` (only when the merchant truly has reviews — no fake
  stars), plus new **BreadcrumbList** and **Store/OnlineStore** nodes emitted on every
  product page.
- **Migration-safe domain resolution**: storefront host parsing now accepts both
  `letbuyy.com` and `letbuyy.store` so tenant subdomains keep resolving during cutover,
  while all canonical URLs emit `.com`.
- `sitemap.ts` + `robots.ts` + `metadataBase` + structured data added to the three
  surfaces that had none: **app-marketplace**, **theme-marketplace**, **developer-portal**.
- Hygiene: **accounts (identity-platform) set to `noindex`** (auth pages shouldn't rank);
  dashboard already `noindex`; platform-console & ops-portal already `Disallow: /`.

🔧 **You must do (can't be done from code):** own `letbuyy.com`, DNS + wildcard TLS,
Vercel/Cloudflare domain config, env vars, 301s from `.store`, Wikidata, Crunchbase,
Google Search Console, social profiles, backlinks. All sequenced below.

📝 **Fill the [Entity Data Sheet](#13-entity-data-sheet) once** — it feeds the schema,
Wikidata, Crunchbase, and the `sameAs` loop from one place.

---

## Table of contents

1. [Why "Did you mean…" happens — the entity model](#1-why-did-you-mean-happens)
2. [Your SEO surface — every app, domain, and role](#2-your-seo-surface)
3. [Step 1 — Build LetBuyy as an entity (Wikidata + Crunchbase)](#3-step-1--entity)
4. [Step 2 — Google Search Console (multi-property)](#4-step-2--search-console)
5. [Step 3 — Drive branded searches + clicks](#5-step-3--branded-demand)
6. [Step 4 — Exact-match backlinks](#6-step-4--backlinks)
7. [Step 5 — Schema.org coverage (done + remaining)](#7-step-5--schemaorg)
8. [The `.store → .com` migration runbook](#8-migration-runbook)
9. [Advanced technical SEO for the platform](#9-advanced-technical-seo)
10. [The merchant SEO engine (multi-tenant)](#10-merchant-seo-engine)
11. [Verification & measurement](#11-verification)
12. [Prioritized rollout checklist](#12-rollout-checklist)
13. [Entity Data Sheet (fill this in)](#13-entity-data-sheet)
14. [Files changed in this pass](#14-files-changed)

---

## 1. Why "Did you mean…" happens

Google autocorrects a query when the corrected term has **vastly more search volume
and click history** than what was typed, and when it has **no strong independent entity**
for the typed term. So "letbuyy" collapses into the better-known similar brand. You fix
it on three fronts simultaneously — and they reinforce each other:

1. **Existence** — a machine-readable entity (Wikidata → Google Knowledge Graph; Crunchbase; Schema.org `Organization`) that says "LetBuyy is a company, here is its site, founder, logo."
2. **Disambiguation** — explicitly tell engines LetBuyy's own alternate spellings (`Let Buyy`, `Letbuyy`) and **never** conflate it with the lookalike brand. (Implemented: `alternateName` lists our spellings only.)
3. **Demand** — real humans searching the correct spelling and clicking the LetBuyy result. Volume of correct-spelling clicks is the signal that ultimately flips the correction off.

LetBuyy has **three entity layers** — most generic SEO advice only covers the first:

| Layer | Entity | Where it lives | Schema |
|---|---|---|---|
| Platform | **LetBuyy** (the company/SaaS) | `letbuyy.com` (marketing-site) | `Organization` + `SoftwareApplication` ✅ |
| Marketplaces | App Store, Theme Store, Dev Portal | `apps./themes./developers.letbuyy.com` | `WebSite` + `CollectionPage` ✅ |
| Merchants | Each storefront (its own brand) | `{sub}.letbuyy.com` / custom domains | `OnlineStore` + `Product` + `Breadcrumb` ✅ |

A merchant store ranking for *its* brand also generates "powered by LetBuyy" footprints
and backlinks — so layer 3 compounds layer 1. That's why doing the whole set matters.

---

## 2. Your SEO surface

Every public runtime, its canonical host, indexation policy, and current state:

| App (`apps/…`) | Canonical host | Indexed? | Structured data | Sitemap/robots |
|---|---|---|---|---|
| `marketing-site` | `letbuyy.com` | Yes | ✅ Org + WebSite + SoftwareApplication (`@graph`) | ✅ existing |
| `storefront-runtime` | `{sub}.letbuyy.com` + custom domains | Yes (published only) | ✅ Product + Breadcrumb + Store | ✅ per-tenant dynamic |
| `app-marketplace` | `apps.letbuyy.com` | Yes | ✅ Org ref + WebSite + CollectionPage | ✅ added (dynamic) |
| `theme-marketplace` | `themes.letbuyy.com` | Yes | ✅ Org ref + WebSite + CollectionPage | ✅ added (dynamic) |
| `developer-portal` | `developers.letbuyy.com` | Yes | ✅ Org ref + WebSite | ✅ added (static set) |
| `identity-platform` (accounts) | `accounts.letbuyy.com` | **No** ✅ now `noindex` | — | — |
| `merchant-control-plane` | `admin/console.letbuyy.com` | **No** (`noindex`) | — | — |
| `platform-console` | internal | **No** (`Disallow: /`) | — | — |
| `platform-operations-portal` | internal | **No** (`Disallow: /`) | — | — |

Cross-app entity stitching: every marketplace's `WebSite.publisher` and the storefront
`seller` reference the **same** Organization `@id` (`https://letbuyy.com/#organization`).
That `@id` consistency is how Google merges the subdomains into one LetBuyy entity.

---

## 3. Step 1 — Entity

### 3a. Wikidata (feeds Google's Knowledge Graph directly)

1. Create an account at wikidata.org → **Create a new Item**.
2. **Label:** `LetBuyy` · **Description:** `Indian e-commerce / commerce operating system company` · **Also known as:** `Let Buyy`, `Letbuyy`.
3. Add statements (each with a **reference URL** — references are what make a statement survive review):

   | Property | Value |
   |---|---|
   | instance of (P31) | `business` and `online marketplace` |
   | country (P17) | India |
   | official website (P856) | `https://letbuyy.com` |
   | inception (P571) | *your founding year* |
   | industry (P452) | electronic commerce / SaaS |
   | founded by (P112) | *your name* |
   | logo image (P154) | upload `letbuyy-logo-512.png` to Commons (optional) |

4. **Notability caveat (honest):** Wikidata expects an item to be "serious and publicly
   describable." A live site + Crunchbase + a couple of independent references usually
   clears it. If brand-new with zero outside coverage, do **Step 4 (backlinks/press)
   first**, then create the item. Never fabricate references.
5. Copy the resulting `Q…` ID into the [Entity Data Sheet](#13-entity-data-sheet) →
   it goes into `sameAs`, closing the loop with your on-site schema.

### 3b. Crunchbase

crunchbase.com → **Add a company** → name, logo (`letbuyy-logo-512.png`), founding year,
category (E-commerce / SaaS), website `https://letbuyy.com`, founder. The free tier
allows a basic profile. Paste the org URL into the Entity Data Sheet.

### 3c. How this loops back to the code ✅

`sameAs` is the reconciliation mechanism: it points from your site's `Organization`
to Wikidata/Crunchbase/socials, and those point back. Once you fill the Entity Data
Sheet, the values flow into `apps/marketing-site/src/app/layout.tsx` (`BRAND_SAME_AS`)
and `packages/shared-types/src/brand.ts` (`BRAND_PROFILES`). **Empty entries are
filtered out**, so nothing fake is ever emitted — the loop simply completes as you fill it.

---

## 4. Step 2 — Search Console

Because LetBuyy spans many subdomains, use **Domain properties** (cover all subdomains at once):

1. Add **Domain property** `letbuyy.com` → verify with one DNS `TXT` record at your registrar.
   This single property covers `www`, `apps`, `themes`, `developers`, `accounts`, and every
   `{merchant}.letbuyy.com` storefront.
2. Add a Domain property for `letbuyy.store` **too** — you need it to run the migration
   (sitemaps + Change of Address). Keep it until traffic fully moves.
3. Submit sitemaps (per host, under the Sitemaps tab):
   - `https://letbuyy.com/sitemap.xml`
   - `https://apps.letbuyy.com/sitemap.xml`
   - `https://themes.letbuyy.com/sitemap.xml`
   - `https://developers.letbuyy.com/sitemap.xml`
   - storefronts: each published store serves its own `/sitemap.xml` (per-tenant) — see §10 for a master index.
4. **URL Inspection → Request indexing** on `letbuyy.com/` and your About/founder page.
5. After cutover, use **Settings → Change of Address** (`letbuyy.store` → `letbuyy.com`).
6. Watch **Performance → filter queries containing "letbuyy"** to see the correction die
   (impressions for the right spelling climb; "search instead for…" shrinks then vanishes).

---

## 5. Step 3 — Branded demand

The behavioral signal that actually flips the autocorrect:

- Everywhere you have an audience (Instagram bio/packaging/email/ads), say **"Search *LetBuyy* on Google"** and link the official site.
- Run a cheap **Google Search ad on your own brand term `letbuyy`** — owns the top slot while organic catches up, and trains the autocorrect on the correct spelling.
- Create profiles using the exact spelling **LetBuyy** on LinkedIn, Instagram, X, YouTube, Facebook, GitHub. Each is (a) a branded signal and (b) a `sameAs` URL for the loop. Put the URLs in the Entity Data Sheet.
- Address it head-on in bios: **"LetBuyy (not the other one)"** — and the schema's `alternateName` reinforces your true spellings without ever naming the competitor (which would merge the entities).

---

## 6. Step 4 — Backlinks

Exact-match links using the literal word **LetBuyy** build the term's independent authority:

- **India directories:** Justdial, IndiaMART, StartupIndia, Wellfound (AngelList), Clutch; G2 / Capterra (you're SaaS, so these are strong).
- **Product Hunt launch** — backlink + traffic + a burst of correct-spelling searches at once. High leverage; time it after the schema + entity are live.
- **Press / founder interviews** — startup blogs, regional outlets.
- **Powered-by footprints** — every published merchant storefront referencing LetBuyy is a soft brand signal (layer 3 → layer 1).
- Quality over quantity; avoid link farms. Add each profile/press URL to `sameAs` where it's a canonical profile.

---

## 7. Step 5 — Schema.org

### 7a. Implemented ✅

- **Platform** (`marketing-site/layout.tsx`): `Organization` (legalName, alternateName, founder*, foundingDate*, logo `ImageObject` 512², contactPoint, areaServed IN, knowsLanguage en/hi, `sameAs`*) + `WebSite` + `SoftwareApplication`, unified in one `@graph` with stable `@id`s. *(\*populated from the Entity Data Sheet)*
- **Storefront** (`storefront-runtime/lib/seo.ts`): `buildProductJsonLd` (offer with `priceValidUntil`, `seller`, availability, condition; guarded `aggregateRating`), `buildStoreJsonLd` (OnlineStore/Organization per merchant), `buildBreadcrumbJsonLd`. The product page emits all three.
- **Marketplaces / portal**: `Organization` reference + `WebSite` (+ `CollectionPage` for the two stores), publisher-linked to the platform `@id`.

### 7b. Ready-to-paste — remaining per-page snippets 📝

**App detail** (`app-marketplace/src/app/(store)/apps/[slug]/page.tsx`) — `SoftwareApplication`:

```tsx
const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: app.name,
  description: app.description,
  applicationCategory: app.category?.name ?? "BusinessApplication",
  operatingSystem: "Web",
  url: getAppMarketplaceUrl(`/apps/${app.slug}`),
  ...(app.icon_url ? { image: app.icon_url } : {}),
  offers: { "@type": "Offer", price: app.price ?? "0", priceCurrency: "INR" },
  ...(app.rating && app.review_count
    ? { aggregateRating: { "@type": "AggregateRating", ratingValue: app.rating, reviewCount: app.review_count } }
    : {}),
  publisher: { "@id": "https://letbuyy.com/#organization" },
};
// render: <script type="application/ld+json"
//   dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd).replace(/</g,"\\u003c") }} />
```

**Theme detail** (`theme-marketplace/src/app/themes/[slug]/page.tsx`) — `Product` (digital good):

```tsx
const themeJsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: theme.name, description: theme.description, image: theme.preview_url,
  brand: { "@type": "Brand", name: "LetBuyy Themes" },
  offers: { "@type": "Offer", price: theme.price ?? "0", priceCurrency: "INR",
            url: getThemeMarketplaceUrl(`/themes/${theme.slug}`),
            availability: "https://schema.org/InStock" },
};
```

**Storefront blog post** (`storefront-runtime/.../blog/[slug]`) — `BlogPosting` with `author`/`publisher` = the store.
**Developer doc page** — `TechArticle` (+ `BreadcrumbList`). **Pricing/FAQ** — `FAQPage`.

Validate every type at the [Rich Results Test](https://search.google.com/test/rich-results)
and [Schema validator](https://validator.schema.org/).

---

## 8. Migration runbook

You chose `letbuyy.com` as canonical. The code is now **migration-safe**: active
defaults point to `.com`, and storefront host-parsing accepts **both** domains so
nothing breaks mid-cutover. Execute the remaining external steps in this order for
zero downtime:

**Phase A — Acquire & resolve (no user impact)**
1. 🔧 Register/confirm ownership of `letbuyy.com`.
2. 🔧 DNS: apex `letbuyy.com`, `www`, the app subdomains (`apps`, `themes`, `developers`,
   `accounts`, `api`, `admin`, `console`, `webhooks`), and **wildcard `*.letbuyy.com`** for storefronts.
3. 🔧 TLS: Cloudflare wildcard cert for `*.letbuyy.com` (storefronts need it).
4. 🔧 Add all `.com` domains to the Vercel projects / Cloudflare Workers routes.

**Phase B — Point the apps at `.com`**
5. ✅ Code defaults already `.com`. Set the env overrides per environment so nothing
   relies on the hardcoded fallback:
   `NEXT_PUBLIC_MARKETING_URL`, `NEXT_PUBLIC_ACCOUNTS_URL`, `NEXT_PUBLIC_API_URL`,
   `NEXT_PUBLIC_APP_MARKETPLACE_URL`, `NEXT_PUBLIC_THEME_MARKETPLACE_URL`,
   `NEXT_PUBLIC_DEVELOPER_PORTAL_URL`, `NEXT_PUBLIC_STOREFRONT_URL`.
6. 🔧 **`COOKIE_DOMAIN` is the one to handle carefully** — flipping it to `.letbuyy.com`
   invalidates live `.store` sessions. Cut it over during a low-traffic window, *after*
   `.com` auth is reachable. (It's already env-driven — no code change, just sequencing.)
7. 🔧 Update **OAuth redirect URIs** (Google etc.) and payment provider
   (Razorpay/Stripe/PayPal) callback/webhook URLs to `.com`.

**Phase C — Redirect & tell Google**
8. 🔧 301 redirect `.store` → `.com`: apex, every subdomain, and `*.{sub}.letbuyy.store →
   {sub}.letbuyy.com` (preserve path). Cloudflare bulk redirect rules are easiest.
9. 🔧 GSC **Change of Address** (`letbuyy.store` → `letbuyy.com`); resubmit all sitemaps under `.com`.
10. 🔧 Keep `.store` resolving + redirecting for **at least 6–12 months** (link equity).

**Phase D — Sweep the residue**
11. Keep functional `.store` literals out of active source except mobile bundle IDs,
    migration evidence, and explicit redirect guidance. Then run governance (§11).

> Why not a blind find-replace of the 150 files? Several touch **auth cookies, tenant
> resolution, and payment callbacks** — a naïve swap there breaks sessions and checkout
> the instant it deploys before DNS is ready. The env/config layer makes the flip atomic
> and reversible instead.

---

## 9. Advanced technical SEO

- **`metadataBase` everywhere** ✅ — relative OG/canonical URLs now resolve to absolute
  `.com` URLs (was missing on the 3 marketplaces, which breaks OG/canonical resolution).
- **`hreflang` (India-first → global)**: you're `en-IN` today. When you add Hindi or other
  locales, emit `alternates.languages` in `generateMetadata` and an `x-default`. Hook the
  per-store `locale` field (`StoreModel.locale`) for storefront hreflang.
- **Core Web Vitals**: fonts are already local + `display:swap` ✅. Keep storefront product
  images on `next/image` with explicit dimensions; the product route already uses
  `revalidate = 30` (good ISR). Watch LCP on theme-heavy storefronts.
- **Canonical correctness for custom domains** ✅ — `getStorefrontBaseUrl` prefers a
  merchant's `storeUrl` (custom domain) over the subdomain, so canonicals are right when a
  merchant brings their own domain. Make sure the custom domain 301s the subdomain (not both indexable).
- **Indexation hygiene** ✅ — accounts/dashboard `noindex`; internal portals `Disallow:/`.
  Keep cart/checkout/account paths disallowed (already in storefront `robots.ts`).
- **No fake reviews** ✅ — `aggregateRating` only emits when real `rating`+`reviewCount`
  exist. Fabricated review markup is a manual-action risk that demotes the whole domain.
- **Sitemap freshness**: marketplace sitemaps use `revalidate = 3600` and degrade to static
  routes if the Commerce API is down — they never 500.

---

## 10. Merchant SEO engine (multi-tenant)

This is LetBuyy's unfair SEO advantage: thousands of merchant storefronts, each adding
indexable surface and brand footprints. To industrialize it:

- **Extended SEO contract** ✅ — `SeoSchema` in `shared-types` now carries `canonical_url`,
  `og_title`, `og_description`, `og_image_url`, `robots_directive`, `focus_keyword`,
  `structured_data_type`, `alternate_name`. Round-trip these through the API gateway so
  every product/page/collection is independently optimizable by the merchant.
- **Merchant-facing controls**: surface those fields in `merchant-control-plane` product/
  page editors and the Flutter `apps/mobile/merchant-app/.../seo_settings_screen.dart` so
  merchants self-serve SEO (per-page title/description/OG/canonical/robots). The schema is
  ready; wire the forms.
- **Master store directory** 🔧: add a `letbuyy.com/stores` directory page + a
  `letbuyy.com/sitemap-stores.xml` index listing published storefronts. This gives the
  long tail of stores internal links from the high-authority root — turning isolated
  subdomains into a linked network. (Per-store sitemaps already exist; add the index.)
- **Structured data per site type**: `store → OnlineStore/Product` ✅; extend
  `blog → BlogPosting`, `portfolio → Person/CreativeWork`, `resume → Person`,
  `landing → WebPage` using the same `buildStoreJsonLd` pattern.

---

## 11. Verification

- **Schema**: [Rich Results Test](https://search.google.com/test/rich-results) on
  `letbuyy.com`, a storefront product URL, an app detail, a theme detail.
- **Entity loop**: after filling the Data Sheet, view-source the marketing site and
  confirm `sameAs` lists Wikidata + Crunchbase + socials.
- **OG**: paste `letbuyy.com` into the LinkedIn Post Inspector / X card validator — the
  new 1200×630 PNG should render (the old SVG silently failed).
- **Indexation**: `site:letbuyy.com` over time; GSC Coverage.
- **Governance** ✅ run after any further edits:
  ```bash
  node scripts/validate-governance.mjs
  ```
  (Baseline already passes; the only failing sub-check is a pre-existing
  `.tmp-storybook-visual` artifact unrelated to SEO.)

---

## 12. Rollout checklist

**P0 — entity exists (week 1)**
- [ ] Fill the [Entity Data Sheet](#13-entity-data-sheet); paste `sameAs`/founder into `marketing-site/layout.tsx` + `shared-types/brand.ts`.
- [ ] Create Wikidata item + Crunchbase profile (Step 1).
- [ ] GSC Domain properties for `.com` and `.store`; submit sitemaps (Step 2).
- [ ] Validate schema in Rich Results Test.

**P1 — demand + migration (weeks 2–4)**
- [ ] Brand-term Google ad + "Search LetBuyy" CTAs; create all social profiles (Step 3).
- [ ] Execute the `.store → .com` migration runbook (§8), incl. Change of Address.
- [ ] Paste the per-page schema snippets (§7b).

**P2 — compounding (weeks 4–12)**
- [ ] Backlinks + Product Hunt launch (Step 4).
- [ ] Master `/stores` directory + `sitemap-stores.xml` (§10).
- [ ] Wire merchant SEO fields into the dashboard + mobile editor.
- [ ] Sweep residual `.store` references to env/config; re-run governance.

---

## 13. Entity Data Sheet

Fill once. These values are the single source of truth — they go into the schema
(`marketing-site/layout.tsx` `BRAND_SAME_AS` / `FOUNDER_NAME` / `FOUNDING_YEAR`,
and `shared-types/brand.ts` `BRAND_PROFILES` / `BRAND_FOUNDER`), Wikidata, and Crunchbase.

| Field | Value to use | Lands in |
|---|---|---|
| Canonical domain | `letbuyy.com` | ✅ set |
| Legal entity name | `__________` (e.g. "LetBuyy Technologies Pvt Ltd") | `BRAND.legalName` |
| Founder (public legal name) | `__________` | `founder` + Wikidata P112 |
| Founding year | `____` | `foundingDate` + Wikidata P571 |
| Support email | `support@letbuyy.com`? | `BRAND.contactEmail` |
| Wikidata QID | `https://www.wikidata.org/wiki/Q______` | `sameAs` |
| Crunchbase URL | `https://www.crunchbase.com/organization/______` | `sameAs` |
| LinkedIn | `https://www.linkedin.com/company/______` | `sameAs` |
| Instagram | `https://www.instagram.com/______` | `sameAs` |
| X (Twitter) | `https://x.com/______` | `sameAs` + `twitterHandle` |
| YouTube | `https://www.youtube.com/@______` | `sameAs` |
| GitHub | `https://github.com/______` | `sameAs` |
| Product Hunt | `https://www.producthunt.com/products/______` | `sameAs` |

> Anything left blank is safely omitted from the structured data — fill incrementally.

---

## 14. Files changed in this pass

| File | Change |
|---|---|
| `packages/shared-types/src/brand.ts` | **new** — canonical brand/entity config, `PLATFORM_DOMAINS`, sameAs + Organization builders |
| `packages/shared-types/src/index.ts` | re-export brand; extend `SeoSchema` (+7 optional fields) + new types |
| `apps/marketing-site/src/app/layout.tsx` | rich Organization+WebSite+SoftwareApplication `@graph`; raster logo/OG; `.com` |
| `apps/marketing-site/src/lib/public-urls.ts` | defaults → `letbuyy.com` |
| `apps/marketing-site/public/icons/letbuyy-logo-512.png` | **new** — raster Knowledge-Graph logo |
| `apps/marketing-site/public/og/letbuyy-default.png` | **new** — 1200×630 social card |
| `apps/storefront-runtime/src/lib/seo.ts` | multi-domain resolution; enriched Product; new Store + Breadcrumb builders |
| `apps/storefront-runtime/src/app/store/[subdomain]/product/[productId]/page.tsx` | emit Product + Breadcrumb + Store |
| `apps/app-marketplace/{lib/site-url,app/robots,app/sitemap}.ts` + `app/layout.tsx` | **new** SEO surface + structured data |
| `apps/theme-marketplace/{lib/site-url,app/robots,app/sitemap}.ts` + `app/layout.tsx` | **new** SEO surface; `en_IN` |
| `apps/developer-portal/{lib/site-url,app/robots,app/sitemap}.ts` + `app/layout.tsx` | **new** SEO surface + structured data |
| `apps/identity-platform/src/app/layout.tsx` | `noindex` auth; `.com` default |

*All changes type-check clean (`tsc --noEmit`) across `shared-types` and the five apps.*
