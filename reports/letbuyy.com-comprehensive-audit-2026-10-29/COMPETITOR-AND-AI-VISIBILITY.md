# Competitors, external authority and AI visibility

29 October 2026 · Live target: https://www.letbuyy.com/in

## Evidence and interpretation

The current shared live crawl establishes an India-focused commerce software offer: branded storefronts and operational tools, subscriptions, trial/signup actions, demonstrations, and merchant educational guides. English, Tamil and Hindi are explicit in the site and contact page. This classification comes from live page content, not device location. The marketing site is not itself an inspected merchant product catalogue.

The fresh homepage captures differ from search-index excerpts. In particular, current homepage ecosystem links are labelled guides; older search excerpts still describe app/developer surfaces as live and mention an event bus. This is a freshness difference, not proof of a current ranking regression. Use the saved HTTP HTML for present-page findings. Search tools initially returned cache-miss errors for direct LetBuyy URLs; the successful shared HTTP crawl resolves page availability.

Competitor research used focused web searches and five fresh HTTP fetches through the skill's URL-safe fetcher. All five fetched pages returned 200 and were parsed with the installed `parse_html.py`. Evidence is in [the external evidence folder](evidence/external/competitor-comparison-data.json), including raw HTML and parsed metadata/schema. These are point-in-time samples, not competitor-wide audits or feature tests.

## Query evidence

The complete query log and source URLs are in [search evidence](evidence/external/search-and-source-log.json). Queries were entered in English on 29 October 2026. The web tool supplied no controlled country, city, device, personalization or geolocated Google top-ten settings. India appears in the query text; this is not proof of an India-localized Google SERP. Result order is not reported as a verified Google rank.

| Query family | Actual observed result types | Meaning for LetBuyy |
|---|---|---|
| Online store builder India, UPI, COD, GST, zero commission | Software homepages and dedicated India store-builder landing pages | The commercial landing-page format fits; make product category and conditions clear |
| Shopify alternative India, UPI, COD, GST | Vendor comparison guides, alternative lists and builder pages | A balanced, sourced comparison may help evaluation; search volume and ranking opportunity remain unmeasured |
| LetBuyy / audited domain outside its own host | Founder/studio project link and a consumer-shopping app listing | Verify known links and brand relationships; do not infer a complete authority footprint |
| UPI versus COD / ecommerce GST guide | LetBuyy educational pages, official tax material and third-party guides | Existing educational URLs are relevant assets, but claims need primary sourcing and appropriate qualifications |

No People Also Ask inventory, ad counts, AI Overview presence, controlled SERP consensus percentage, search volume, keyword difficulty or click forecast is claimed. No numeric SXO/persona score is assigned from this partial evidence.

## Focused competitor set

All page statements below are vendor claims observed on 29 October, not independently tested product capabilities or endorsements. The raw parsed schema list is included for comparison; copying another site's markup does not establish Google eligibility.

| Source and relationship | Useful observed pattern | Raw JSON-LD types observed | Practical implication |
|---|---|---|---|
| [CartWhizz India builder](https://cartwhizz.com/online-store-builder-india), overlapping commercial/organic candidate | Explicit India store-builder category, setup steps, linked payment/GST documentation, fee limits and trial terms | WebPage, BreadcrumbList | Connect the promise to clear prerequisites and relevant guides |
| [Storzu homepage](https://storzu.com/), overlapping small-seller candidate | Separates plan price, platform commission and payment-provider conditions; offers a public demo path | Organization, WebSite, SoftwareApplication, Offer, FAQPage and supporting types | Explain each cost separately; do not copy free-offer claims or FAQ markup merely because a competitor uses them |
| [Shopify India pricing](https://www.shopify.com/in/pricing), established business competitor and commercial query source | Distinguishes introductory offer, regular billing basis and third-party payment-provider charges | No JSON-LD detected in this raw sample | Offer clarity and product ecosystem navigation matter; absence here is not a recommendation to remove useful markup |
| [Zoho Commerce builder](https://www.zoho.com/commerce/ecommerce-website-builder.html), overlapping software candidate | Category-led title, product interface images, build/demo actions and links into operational features | No JSON-LD detected in this raw sample | Show the actual supported workflow and honest product evidence |
| [Instamojo pricing](https://www.instamojo.com/pricing), overlapping store/payment candidate | Distinguishes subscription, transaction fees, taxes and refund conditions, with a linked feature matrix | Organization, WebSite, WebPage, BreadcrumbList and supporting types | Make recurring price and transaction/provider costs understandable before signup |

Search also returned Manva, QuicShop, ShopSynq, Shipauk and other vendor comparison pages. They are organic-content candidates, not proven leading competitors or independently verified review sources. They were not given full product comparisons. Marketplace operators that host merchant sellers are a different business model; do not mix their seller fees into a SaaS comparison without explaining that difference.

## Search experience and conversion opportunities

The homepage's broad Commerce OS headline has a clear opportunity to be paired with plain store-builder language already used deeper in the page. This is a clarity hypothesis, not evidence of a page-type mismatch or measured conversion loss. Preserve the positioning and established visual identity. A possible adjacent explanatory line is “Build and manage your online store in India”; only add specific payment, feature and trial promises after their availability has been confirmed.

Three observed journeys deserve clear paths:

1. **New seller:** establish what can be launched today → understand subscription/trial/provider costs → see a genuine demo → read setup prerequisites → begin the account journey. Existing pricing, demo, contact and setup-guide URLs should do this work before a new landing-page network is considered.
2. **Seller switching platforms:** assess which data and workflows can move → see a source-backed comparison → understand support, exclusions and migration checks → request a scoped demo/contact response. A signup link alone does not answer migration risk.
3. **Merchant researching an operational problem:** get a direct sourced answer → distinguish general guidance from a verified LetBuyy workflow → follow the relevant setup/pricing/help link. Do not imply planned features are generally available.

The current source route tree contains no dedicated comparison/alternatives route matching those names. This is not a technical defect or proof of missing demand. The existing launch guide already compares platforms; improve that table and its sources first. A later comparison page should state the review date, affiliation, use-case criteria, current billing basis, gateway/add-on costs, migration limitations and circumstances where a competitor is preferable. Verify every published cell from primary sources. Do not invent “switched from” results or use a fixed word target.

## External authority and backlink evidence

One discovered candidate was tested with the installed `verify_backlinks.py`: **https://www.pixlnova.com/ → https://letbuyy.com**. The source returned 200 and the verifier found the exact destination, using a branded-domain anchor and `noopener noreferrer` attributes. No `nofollow` attribute was returned. See [verification output](evidence/external/known-backlinks-verified.json).

The source identifies LetBuyy as a founder project. This establishes one observed link and an associated project relationship; it does not establish independent industry endorsement or ranking value. The inspected homepage's outbound social links did not include PixlNova, so a reciprocal homepage pair was not observed. Other site pages and historical links were not exhausted.

| Backlink analysis component | What the available evidence supports |
|---|---|
| Profile overview | One known candidate verified; total backlinks/referring domains unknown |
| Anchor distribution | One branded-domain anchor in this selected sample; not the site's distribution |
| Referring-domain quality | Related founder/studio context observed; no vendor authority score assigned |
| Toxicity | Not measured; no basis for a disavow or an assertion of harmful links |
| Top linked pages | Root destination observed for this candidate; site-wide ranking unavailable |
| Competitor referring-domain gap | Not measured without comparable inventories |
| New/lost links | No comparable historic link snapshots; not measured |

Parent audit integration checks and any Common Crawl result are recorded separately in toolkit coverage. A Common Crawl domain graph value is not an individual backlink inventory. Keep unavailable provider metrics null. Search results and the single verified link are not a basis for a backlink health score.

An indexed Google Play result for `com.letbuyy.letbuyy` describes consumer shopping and exposes an older `letbuy-y.web.app/privacy-policy` URL. The direct listing could not be fetched in this tool session, and the current homepage did not link to that app in the inspected anchors. The app's relationship to this merchant site therefore **needs verification**. If it belongs to the same organization, review current app descriptions, support/privacy destinations and entity links for consistency under a separate authorized publishing action. Do not add it to `sameAs` before confirming ownership and intended identity. This is an external brand-reconciliation candidate, not a proven live-site defect.

## AI search: access, extraction and actual citations

**Actual AI-answer citation visibility remains not measured.** No connected citation provider, reproducible external AI-answer benchmark or account-specific citation export was available to this specialist. A standard web result containing LetBuyy is not an AI citation. No Google AI Overview, ChatGPT, Claude, Perplexity or Gemini citation count or platform score is assigned.

The shared live robots file contains a wildcard allow rule and a `/signup` disallow, with no purpose-specific AI groups. For the homepage, robots policy permits the listed bots through the wildcard rule. This does not certify CDN/WAF access, actual bot visits or index inclusion. The localized signup paths are a separate technical robots-boundary check; robots is not authentication.

| Purpose | Token and verified documentation | Observed public-home policy |
|---|---|---|
| Google Search and its AI features | Googlebot; [Google crawler reference](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers) | Wildcard permits `/in`; actual indexing unverified |
| OpenAI search | OAI-SearchBot; [OpenAI crawler reference](https://developers.openai.com/api/docs/bots) | Wildcard permits `/in`; actual ChatGPT citations unmeasured |
| OpenAI model training | GPTBot, documented separately by OpenAI | Wildcard permits `/in`; owner training policy was not changed |
| User-triggered OpenAI browsing | ChatGPT-User; OpenAI states robots rules may not apply to these user actions | Successful audit HTTP access is not a ChatGPT-User conformance test |
| Gemini/Vertex training and grounding | Google-Extended; Google says this token does not control Search inclusion/ranking | No distinct group; do not score it as Search eligibility |

Current Google guidance says ordinary SEO applies to AI features, important text should be available, and structured data should match visible content. It does not require special machine-readable AI files or special schema. [Google AI features guidance](https://developers.google.com/search/docs/appearance/ai-features). An optional `llms.txt`, Markdown endpoint or WebMCP integration should address a demonstrated consumer need; none guarantees citations or rankings.

Current raw homepage and guide HTML contain extractable text, headings, links, lists and tables. The main weaknesses for reliable extraction are contradictory offers/statuses, unsupported numerical advice, uncertain author/result provenance, locale/entity URL inconsistency and plan details that arrive later through JavaScript. Those are ordinary correctness and usability issues. Correcting them is preferable to packaging the same uncertain facts into new AI files.

Browser accessibility checks, raw/rendered comparisons, any agent-UX heuristic and Lighthouse Agentic Browsing fractions are parent-owned measurements in the final report. They must remain separate. No fraction is inferred from robots rules or this manual review. No contact/signup form, payment or consequential action was submitted here. Do not recommend new transactional agent tools without real handlers, accurate annotations and user confirmation.

## Local/maps and ecommerce applicability

The current marketing homepage/contact/terms samples offer nationwide software and online assistance; they do not establish a customer-facing physical store, in-person service area, opening hours or eligible local business location. A legal or correspondence address alone would not prove those facts. Local GBP optimization, map grids, location pages and LocalBusiness schema are therefore **not applicable to the observed site model**. This is not a claim that no company office or profile exists. Google requires qualifying in-person customer contact and excludes online-only businesses from Business Profile eligibility. [Google business eligibility](https://support.google.com/business/answer/13763036).

The marketing pages sell a software subscription and teach merchants; embedded illustrative products are not an audited public merchant catalogue. Product feed, Shopping price-gap, SKU review, merchant-return schema and transactional UCP work are not justified for this marketing origin. If an actual merchant storefront is separately added to scope, audit its products, variants, canonical inventory, payments and feed ownership then. Do not mark product/UCP discovery absent here as a failure or invent consumer product offers.

## Practical strategy

Resolve offers and evidence first. Then use the existing homepage/pricing/setup/payment pages as the core commercial-to-educational path. Explain product category plainly, render plan conditions reliably, and connect operational claims to accurate guides. Use genuine dated product captures or demonstrated walkthroughs instead of unsupported conversion claims. Expand to a sourced comparison only after the current claims and availability are settled. Establish a fixed query set and inspect available Search Console and citation evidence after release; gains remain hypotheses until measured.

This work did not purchase data, initiate a trial, submit indexing notifications, alter profiles, send outreach or modify the live site. Competitor evidence is limited to five page samples. Backlink inventory, external authority metrics, ranking history, search demand, actual AI citations, competitor feature behavior and GBP ownership remain unverified or not measured.

## Completed measurement supplements

Managed setup succeeded for core and Chromium. Read-only auth helpers found no Google/Bing/Matomo/provider configuration. The Common Crawl helper returned no matching record in release cc-main-2026-jan-feb-mar, but bounded streaming/time behavior means this is not definitive absence from that full dataset or evidence of zero backlinks. One selected PixlNova link is verified; no full profile metrics are assigned.

The installed HTTP agent check and bounded unverified user-agent matrix completed; purpose-specific access/response details are in evidence/agent-http.json. The homepage agent-UX heuristic returned 100/100, 75 interactive nodes and0unnamed ones; this is not WCAG compliance or Lighthouse Agentic Browsing X/N. Mobile menu open/Escape-close worked in the browser sample; contact initial-step controls have visible labels or an aria label. No forms were submitted. Public signup destination returned 200.

PSI mobile/desktop quota failures and a 240-second Unlighthouse timeout yielded no Lighthouse or field CWV score. Six unthrottled cold-context browser diagnostics are kept separately and are not representative field measurements. See findings/performance-and-visual.md, evidence/browser-samples.json and evidence/browser-performance-summary.json.
