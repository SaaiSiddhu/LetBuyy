# Implementation briefs

These are local repair instructions, not changes to the website or approval of new commercial facts. Paths below were inspected in the current repository; local source differs from live deployment. Reuse the existing winners and follow repository authority before an implementation. Scope changes or actual release require their own authorization.

## 1. Final locale identities and metadata inheritance

**Issues:** TECH-01/02/03/07/08. **Observed:** 303 resource category/tag/author pages omit the locale in canonical; create/search inherit home identity. Article JSON-LD/breadcrumb identities and some Open Graph URLs also omit locales. **Owner:** frontend engineer with SEO/product policy. **Effort:** combine the overlapping template work into roughly 1–2 engineering days once policy is settled, rather than summing issue estimates.

Inspected source owners:

- `apps/marketing/web/src/lib/i18n/metadata.ts`: existing `localizeMetadata()` calls `buildAlternates()` correctly for canonicals.
- `apps/marketing/web/src/lib/i18n/routing.ts`: existing locale URL authority.
- `apps/marketing/web/src/app/[locale]/resources/[category]/page.tsx`.
- `apps/marketing/web/src/app/[locale]/resources/tag/[tag]/page.tsx`.
- `apps/marketing/web/src/app/[locale]/resources/authors/[slug]/page.tsx`.
- `apps/marketing/web/src/app/[locale]/resources/[category]/[slug]/page.tsx`.
- `apps/marketing/web/src/app/[locale]/layout.tsx`, `create/page.tsx`, `resources/search/page.tsx`.

The first three resource templates bypass the existing helper. Complete that connection. A schematic example, adapting the actual current metadata contract:

```tsx
// Illustrative pattern: use the existing import and route parameters.
return localizeMetadata(
  { title: localizedTitle, description: localizedDescription },
  localeSegment,
  `/resources/${categorySlug}`,
)
```

Use the corresponding tag/author path in their templates. Do not replace localized source strings with invented translations. Inspect helper behavior before passing already localized strings through it. Retained canonicals must be absolute final URLs; normalize through the existing URL authority, including production host policy. Do not hardcode localhost or deploy-preview origins in published metadata.

Also update Open Graph URL through the same final locale URL. `localizeMetadata()` currently copies `source.openGraph.url` without localizing it. Preserve locally completed social-image work, add the intended URL and type, and inspect Next metadata inheritance: a child Open Graph object may replace parent fields. Do not assume a root default survives every child override.

For `/create`, decide whether it is a useful indexable chooser or a non-search signup step. For internal search, choose an explicit noindex/exclusion policy, useful H1 and consistent canonical behavior; preserve normal links to all approved guides. Do not canonicalize unrelated distinct content to home as a substitute for a decision. Allow crawlers to see an intentional noindex.

**Validation:** run representative metadata tests for category/tag/author/create/search in each locale, then assert every retained intended URL has one self-canonical, final-200 alternate targets, reciprocal genuine translations, matching schema/OG identity and correct sitemap membership. Repeat against deployed responses only after an authorized release; HTML correctness alone does not establish Google's selected canonical.

## 2. Truthful offer, server-rendered pricing and heading context

**Issues:** AUD-01/AUD-03/TECH-06. **Evidence:** all 489 clean locale pages describe a free software launch offer; rendered acquisition pages show Launch ₹199/month founding, ₹299 regular, Growth ₹699/₹999, and trial language. These are observations, not newly approved prices. **Owner:** commercial/product owner plus frontend/backend integration engineer.

Inspected owners:

- `apps/marketing/web/src/app/layout.tsx`: global `softwareNode.offers` currently hardcodes price `0` and free launch copy.
- `apps/marketing/web/src/components/Pricing.tsx`: `useEffect()` fetch and client-only plan cards; shared H2.
- `apps/marketing/web/src/app/api/founding-pricing/route.ts`: existing public gateway pricing/remaining proxy.
- `apps/marketing/web/src/app/[locale]/pricing/page.tsx` and `[locale]/page.tsx`.
- `apps/marketing/web/src/components/FinalCTA.tsx` and `FAQ.tsx`: visible offer/availability statements.

1. Record the approved current free/trial/paid/founding/provider/GST/availability facts with their source and effective conditions. Do not infer them solely from one rendered price, change business rates or invent a free plan.
2. Remove an unsupported global offer or derive accurate relevant offer markup from the same approved public source as the visible page. Semantic markup need not include an offer on every editorial article. Do not fabricate rating/review fields to make software rich results eligible.
3. Reuse the public gateway client/contract from a server-side composition layer with bounded fetch/timeouts and a deliberate freshness/cache policy. Pass an initial serializable view into the existing client comparison controls. No second plan registry, hardcoded prices or secret-bearing browser request.
4. Keep public plan availability independent from optional live slot counters where the current contract supports that separation. If a counter fails, do not invent “100 slots remaining.” If plan data fails, show an honest unavailable state; do not silently substitute free pricing or successful signup.
5. Make heading context explicit: pricing page H1, homepage pricing section H2. For example, a shared heading-context prop can select the heading element while preserving the existing design. This is a pattern, not a required new abstraction.
6. Synchronize CTA, pricing metadata, FAQ, legal explanations, schema and translations.

**Validation:** fetch with JavaScript disabled and identify actual plan facts in the initial main HTML, then compare hydrated values. Test successful, empty, timeout/error and partial counter states; upcoming plans remain labelled and unavailable actions honest. Check one meaningful page H1, no second homepage H1, all locales, mobile display, source/schema consistency and current commercial conditions. Never test production purchase flows as part of this audit.

## 3. Published sitemap, feed and invalid-route repair

**Issues:** TECH-04/05/09/10, AUD-04. **Owner:** frontend engineer plus editor/platform owner.

Inspected owners:

- `apps/marketing/web/src/app/sitemap.ts`: static paths and one fixed June date; no article registry use.
- `apps/marketing/web/src/lib/resources/utils.ts`: existing `getAllArticlesForSitemap()`.
- `apps/marketing/web/src/lib/resources/articles.ts`: current article records.
- `apps/marketing/web/src/app/robots.ts` and `src/lib/platform-links.ts`: declared sitemap authority.
- `apps/marketing/web/src/app/[locale]/resources/rss.xml/route.ts`.
- `apps/marketing/web/src/app/[locale]/resources/tag/[tag]/page.tsx`.

Build sitemap entries from the existing content registry and actual translation availability. Include only approved, intended indexable, canonical final-200 pages. Do not create a competing article list. The observed complete article set is 105 equivalents; the target is all **approved eligible** equivalents after corrections, not amplification of unsupported content. Fix create/search/category canonical policy before finalizing the sitemap. Supply real significant modification dates or omit `lastModified`; a rebuild alone must not refresh every date.

Illustrative generation logic, adapting the real existing helpers/types:

```ts
const entries = approvedPublishedArticles.flatMap(article =>
  availableLocales(article).map(locale => ({
    url: finalArticleUrl(locale, article),
    // Set only if backed by the content record's significant update.
    lastModified: verifiedUpdatedAt(article),
    alternates: { languages: genuineEquivalentUrls(article) },
  }))
)
```

The names above are explanatory placeholders, not new repository functions to create blindly. Reuse `getAllArticlesForSitemap`, `localePath`, the URL authority and actual content schema. An eligibility check may be needed if publication/translation status is not currently explicit; resolve existing ownership first.

For unknown tags, check the existing known-tag registry before metadata/rendering and use `notFound()` for an invalid slug. Known tags such as `/resources/tag/cart` are normal editorial pages and must keep working; do not confuse them with a shopping-cart endpoint. One bounded invalid-tag probe was tested; no need to generate hundreds of variants.

For feeds, choose one explicitly English feed or genuine localized feeds. Correct `atom:self`, language, link and item destinations through the existing URL policy. Consider GUID compatibility before changes so readers do not receive duplicate entries. Remove NXDOMAIN sitemap declarations only after confirming their retired status; never launch a dormant service to satisfy robots text.

**Validation:** parse XML, compare expected eligible set with actual sitemap set, assert all final URLs/alternates agree, and check exclusions. Verify known/unknown tags in all locales, retained article reachability, accurate lastmod under no-change rebuild and actual edit, working feed readers/GUID decisions, and every robots-declared endpoint with two resolvers. GSC processing remains a later read-only verification when access exists.

## 4. Editorial truth, provenance and contextual references

**Issues:** AUD-02, CONTENT-01/02/03/04/05. **Owner:** editor, qualified tax reviewer, actual product experts and native-language reviewers.

Inspected owners: `src/lib/resources/articles.ts`, `authors.ts`, article summary/translations under `src/lib/i18n`, and `src/components/resources/ArticleBody.tsx`. The renderer's plain-text blocks lack normal contextual link rendering; no in-body external or internal anchors were found in 105 captured article bodies. Related links outside the body do exist.

Create a claim ledger: exact statement, URLs/locales, source URL, source population/product/geography, publication/effective date, condition, reviewer and disposition. Correct the 1.7→4.6 example to approximately 170.6% relative increase or 2.9 percentage points only if the underlying data is itself supportable; synchronize the 270% headline and all cards/schema/translations.

Tax content needs a real qualified reviewer and current applicable notifications. Official sources support the identified TCS/registration/rate conflicts, but this audit does not settle every merchant's tax obligations. Do not claim a review happened when it did not. A real significant correction can justify a changed update date; a cosmetic edit cannot.

Verify the Jaipur merchant outcome and expert biography claims. This audit does not establish they are false or true. If genuine, retain authorized supporting evidence and describe methodology/limitations; otherwise remove the asserted factual outcome or clearly label a hypothetical example. Use a real team byline when appropriate. Do not create a fictitious reviewer or reuse a real person's credentials without authorization.

Extend the existing rich-content contract/renderer for safe contextual references if needed, preserving the current security model. Use descriptive anchor text around the relevant claim and related task, not a large footer list of unrelated sources. Add links to the exact supporting primary material and prerequisite/next-step guide; avoid arbitrary keyword anchors or link-count targets.

Product guides must separate what is available now, requires setup/provider approval, is partner-only or is planned. A closed public app-publishing surface does not alone prove first-party app installation is unavailable. Resolve that distinction with the actual product owner, then adjust the existing guide rather than activating anything.

**Validation:** each material claim has faithful support or is removed/qualified; correct arithmetic is repeated consistently; all corrected translations agree; links are safe, relevant and accessible; case/author provenance is supportable; date/reviewer schema reflects reality. Keep original evidence privately where it contains personal/customer details; publish only authorized facts.

## 5. Images, mobile and performance: measure before changing priority

**Issue:** AUD-05 and the asset plan. **Owner:** frontend performance engineer/designer. The homepage has 16 image preloads and 22 eager images; the current visual design includes large illustrative art before the mobile promise. This is a bottleneck hypothesis, not a measured poor-CWV verdict.

Run fixed representative production mobile/desktop Lighthouse samples with documented version/device/throttle/cache conditions. Repeat only suspicious outliers. Capture network waterfalls and actual LCP element, then reduce unnecessary lower-page early work without delaying that asset. Compare properly sized image variants against the visible size and device pixel ratio. All captured images already have width/height attributes and decorative art may correctly have empty alt.

Keep motion/reduced-motion handling and the established visual identity. Test whether the mobile main promise/action can be encountered earlier; the header CTA is already visible, and no conversion loss has been measured. Do not add long keyword copy or remove useful art solely because it is large.

The six existing unthrottled browser observations are diagnostics only. They cannot supply field INP or a Lighthouse score. Their simple shift sums are not the CLS session-window algorithm. Do not compare them directly to CrUX p75 or issue a pass/fail certificate.

**Validation:** documented before/after controlled runs and separate field measurements when enough traffic exists; no layout/visual/accessibility regressions; successful mobile navigation, keyboard/focus/reduced-motion behavior and honest loading/error states. Submission/provider completion requires separately authorized safe testing.

## Source-reference examples

`findings/schema-examples.json` contains a minimal localized Article/Breadcrumb/Organization example derived from observed page facts, with limitations and no invented price, person, review, address or phone. It is illustrative until the underlying editorial facts and dates are verified. Merge with existing entities and validate semantics plus Google eligibility separately.

No application code, business policy or deployment was changed by these briefs. After implementation, repeat the affected checks and compare actual deployed output against the saved observed-current baseline.
