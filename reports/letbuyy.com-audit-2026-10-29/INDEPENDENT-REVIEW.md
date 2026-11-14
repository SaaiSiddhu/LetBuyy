# Independent review of the India SEO audit

29 October 2026 · Asia/Kolkata

Reviewed chat: **Audit LetBuyy India page SEO**, `01a188ae-3ada-7be0-bc32-edcaf883fdb4` (one completed turn, retrieved through `read_thread`).

This is a review artifact, subordinate to repository governance. It supplements [the original report](FULL-AUDIT-REPORT.md) and [action plan](ACTION-PLAN.md); it does not change them or authorize implementation or release.

**Verdict:** The audit is a credible technical and content baseline. Its headline counts reproduce from saved HTML. Use its findings, with the execution refinements below. It does not establish actual ranking losses, complete index coverage, production readiness, or verified product/commercial facts.

## What was reviewed

- The chat's request, progress messages and final answer.
- Full report, action plan, all 12 category/coverage documents, structured audit envelope and validation record.
- Saved crawl HTML and sitemap, canonical redirect samples, public PSI error, and sampled article/author text.
- Current relevant metadata, resource, pricing, article, schema, sitemap and robots source.
- Fresh HTTP samples: local homepage/category/pricing/sitemap and live homepage. Local results are development observations, not production acceptance.
- Primary Google documentation and official GST material. This is a factual-conflict review, not a comprehensive current tax opinion.

Checkout: `codex/local-work-preserved-20261025`, HEAD `118209b4f`, with existing user-owned changes. The audit folder was untracked when this review began. Local source and deployed source demonstrably differ.

## Independently reproduced evidence

Counts below were recomputed from saved raw HTML/XML, rather than copied from `analysis-summary.json`. Details and fresh metadata samples are in [review evidence](evidence/independent-review.json).

| Check | Recomputed result | Interpretation |
|---|---:|---|
| English 200 HTML pages | 163 | Matches original scope |
| Locale-stripped canonicals | 101 | 7 categories + 89 tags + 5 authors |
| All canonical mismatches | 103 | Includes create/search canonicalizing to home |
| Articles with Article markup | 35 | Current source registry also contains 35 articles |
| Articles missing from saved XML sitemap | 35/35 | Discovery gap; not proof of exclusion from Google |
| XML sitemap entries | 99 | Fresh local sitemap also has 99 entries |
| Global SoftwareApplication offers | 163, all price `0` | Contradicts displayed paid/trial messaging unless a genuine free offer exists |
| Missing H1 | Pricing and resource search | Pricing still has no H1 locally |
| Saved JSON parsing errors | 0 | Parsing does not validate facts or rich-result eligibility |

The 1.7% to 4.6% conversion calculation also reproduces: **170.5882% relative increase**, or **2.9 percentage points**. Calling this a 270% increase is incorrect. This calculation does not validate the underlying study or establish causation.

## Findings to keep, with precise qualifications

**SEO-01, canonical consistency:** Confirmed. The current category, tag and author templates explicitly emit `/resources/...` canonicals without the locale. The existing `src/lib/i18n/metadata.ts` already generates locale-aware canonical URLs. The repair should connect the bypassing templates to the existing utility, rather than assume that utility itself is broken or introduce another SEO layer. Check nested metadata inheritance and all three locales. Google treats canonicals as signals; incorrect markup is not proof of an indexing penalty. [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

**SEO-02, tax correctness:** The audit identifies a supported conflict. Official material records the 2024 TCS reduction and a conditional registration exemption, contradicting the guide's unqualified statements. Preserve the distinction between total TCS and its tax components; do not replace the article with another blanket rule. Review other thresholds, rate tables, filing conditions and all translations against current applicable material before publishing. [Ministry of Finance record of the reduction](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2087659&lang=2&reg=48), [Notification 34/2023](https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf).

**SEO-03, truthful offers and capabilities:** Confirmed as a contradiction, not a new pricing decision. Both fresh live and local homepage HTML retain `price: "0"` and a free launch tier description. Source also retains the free-forever CTA. Paid prices in the original rendered evidence do not by themselves establish which commercial offer the owner approved. Resolve offer facts using the existing authority, then synchronize metadata, visible text, FAQ, translations and schema. Distinguish zero commission from subscription price and third-party charges. Correct marketplace/AI availability claims without activating frozen capabilities.

**SEO-04, sitemap:** Confirmed. `src/app/sitemap.ts` lists static routes/categories/legal pages but never consumes the article list; `getAllArticlesForSitemap()` already exists. The fixed June timestamp also remains. Generate coverage from existing content authority and actual language availability. The final target is **all approved, indexable articles**, not an unconditional instruction to promote every existing claim. Sitemap inclusion is not an indexing guarantee. [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

**SEO-05, pricing rendering:** Confirmed. `Pricing.tsx` initializes in `loading` and fetches pricing in `useEffect`; its shared heading is H2 even on the pricing page. Complete server rendering through the existing gateway contract with honest failure behavior. Keep interactive comparison controls. Supply a page H1 without turning the homepage's pricing subsection into a second primary heading. Avoid hardcoding the audit's observed founding price or making a transient slots-counter failure erase otherwise available public plans.

**SEO-06/09, claims and entities:** Keep the arithmetic correction, source checks and article-identity repairs. Current article JSON-LD uses locale-free relative identity/breadcrumb URLs and models every author as Person. Relative URL syntax alone is not proof of invalid JSON-LD; agreement with the final locale identity and accurate entity facts are the important outcomes. Use Organization for a real team author. Never invent credentials, ratings or reviews.

**SEO-07/08, archives and positioning:** These remain policy/experience recommendations. Eighty-nine short tag pages do not establish a penalty; do not blanket-delete or noindex them based on word count. Separate the small search-page policy from a broader archive review. Homepage copy and mobile ordering can be tested after offers are truthful; no traffic or conversion uplift is established.

**SEO-10, performance:** Image preloads/eager-loading counts justify investigation, not a CWV verdict. The saved PSI response really is a quota error. Collect a baseline early while other fixes proceed; a PSI failure does not require delaying every available lab measurement until the final phase. Keep lab and field data separate, and do not benchmark production performance using this development server.

**SEO-11, social preview:** Partly addressed locally. Fresh live homepage HTML still lacks `og:image`, `og:url` and `og:type`. Fresh local homepage HTML now has an image with dimensions/alt, but still lacks URL/type. Local pricing has `og:url` pointing to `/pricing` while its canonical is `/in/pricing`; the helper preserves the unlocalized source Open Graph URL. Validate the remaining metadata inheritance/URL issue, rather than redo the image work or treat local completion as deployment.

**SEO-12, AI files:** Keep as informational. Google says its AI features require ordinary SEO and no special machine-readable files or schema. An absent `llms.txt` is not an established defect. The audit's statement about FAQ rich-result retirement is supported by Google's 2026 changelog. Neither robots access nor schema proves actual AI citations. [Google AI feature guidance](https://developers.google.com/search/docs/appearance/ai-features), [Google documentation updates](https://developers.google.com/search/updates).

## Underweighted trust issue

The report mentions unverified author credentials but does not give specific purported merchant outcomes sufficient prominence.

The saved launch guide and current `src/lib/resources/articles.ts` describe a Jaipur kurta brand moving from Shopify to LetBuyy in April 2026, conversion changing from 34% to 61% over 60 days, and COD orders doubling. `ArticleBody.tsx` labels this **Commerce Example**, but does not explicitly call it hypothetical or illustrative. This wording can be read as a measured customer result.

Saved author pages and `authors.ts` also claim prior employment at Meesho/Nykaa, eight years of experience, a GST-consultant role and work with 200 brands. This review has no evidence that these people or claims are false, and it does not certify them as true.

Add a high-priority editorial check: retain measured results and biographies only when supportable and authorized; otherwise remove the factual claim or clearly identify a hypothetical example and use an honest team byline. Check body copy, headlines, cards, translated content and structured data together. Fixing SEO markup around unsupported claims would leave the central trust problem unresolved.

## Revised execution order

1. **Correct public truth:** Confirm commercial/availability facts; correct unsupported free-offer claims, material compliance errors, the numerical headline and unverified case-study/credential presentation. These need not wait for an aesthetic redesign.
2. **Repair mechanical metadata in parallel with fact review:** Reuse the canonical helper in category/tag/author templates; decide create/search policy; fix article identities, H1/title and remaining Open Graph URL/type output. No new SEO system is needed.
3. **Finish public pricing HTML:** Use the existing pricing authority for both server output and hydration, with consistent availability and failure behavior. Avoid duplicating plan ownership in marketing.
4. **Publish the intended URL inventory:** Include corrected, approved, indexable articles and available translations, remove inconsistent aliases/search entries as appropriate, and use trustworthy significant-update dates. Validate all intended locales and final targets.
5. **Measure and iterate:** Obtain production-equivalent lab measurements and available GSC/field evidence. Then consider image loading, archive curation, query-intent copy and mobile ordering changes. Preserve the established design unless measured evidence calls for a change.

The original plan places sitemap work before the broader archive policy it names as a dependency, and puts an obvious arithmetic correction in weeks 2–4. Resolve the small search/URL policy early, keep broad tag pruning separate, and move factual corrections forward. Measurement can begin early without blocking correctness work. Calendar windows remain estimates, not accepted delivery commitments.

## Acceptance and limits

For a later implementation, verify final intended canonicals across every affected template/locale; the full eligible article sitemap set; visible/schema/copy agreement; pricing HTML before JavaScript plus hydrated/failure states; accurate author/claim provenance; and coherent final Open Graph URLs. Check production separately after an authorized release. Use GSC evidence for Google-selected canonicals and indexing rather than claiming success from changed source alone.

This review does not supply missing GSC/GA4, backlinks, rankings, keyword demand, AI citation, CrUX or Lighthouse results. Tamil/Hindi coverage remains sampled. Public signup/provider behavior and actual plan purchases were not tested. Screenshots were not a complete accessibility review. Saved counts are a dated production snapshot, not a fresh full recrawl.

Original audit artifacts and application source were preserved. Only this supplementary review and its evidence/script were added. No repository build, full governance gate, deployment or external submission was performed for this document review.
