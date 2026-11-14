# Content and cluster plan

29 October 2026 · Live target: https://www.letbuyy.com/in

This is a local planning deliverable. It does not approve new product claims or publishing. It uses the shared live crawl, focused search samples, and repository source to identify existing content owners. Search volume, keyword difficulty and controlled Google top-10 overlap are unavailable. The topic map is provisional; no search-demand numbers or ranking forecasts are assigned.

## Evidence and priorities

The site presents an India-focused commerce product and a substantial resource library covering store creation, payments, operations and growth, plus platform, developer and AI topics. Existing source contains 35 article records across seven categories. The final live article coverage and citation/body-link measurements are recorded in [content-analysis.json](evidence/content-analysis.json); the crawl inventory remains the authority for which URLs were actually fetched.

Four focused English search samples on 29 October 2026 covered online-store setup, store-builder pricing, UPI/COD and GST. Query terms target India; search-engine geolocation is unknown. [Saved query evidence](evidence/content-search-samples.json). These are a discovery sample, not an India Google ranking study. Primary comparator inspections include [Shopify's store-start guide](https://www.shopify.com/in/blog/start-online-store), [Zoho's ecommerce-builder page](https://www.zoho.com/commerce/ecommerce-website-builder.html), and [Razorpay's clothing-store guide](https://razorpay.com/learn/?p=18234). Their useful patterns include task sequences, product visuals and prerequisites; their claims are not independently certified by this audit.

The first content batch should correct published truth and improve existing owners. Do not expand unsupported AI/app-marketplace claims to manufacture a larger content footprint. Do not add another article for a topic already covered merely to target a keyword variant.

## Page ownership and topic architecture

| Searcher task | Existing primary owner | Supporting pages | Action |
|---|---|---|---|
| Evaluate an online-store platform for India | `/in` | `/in/pricing`, `/in/demo`, store-start guide | Make product category, availability and qualified next action explicit; preserve the Commerce OS positioning |
| Understand subscription and third-party costs | `/in/pricing` | Billing terms, payment guide, setup guide | One consistent published offer; distinguish subscription, trial, zero commission and provider charges |
| Learn how to launch an Indian online store | `/in/resources/ecommerce/how-to-start-an-online-store-india` | Product pages, SEO checklist, payment, GST and shipping guides | Broad platform-independent launch sequence with conditional compliance advice |
| Perform setup specifically in LetBuyy | `/in/resources/platform/building-first-letbuyy-store` | Themes, merchant workspace, payments setup | Real, current, permissioned workflow screenshots and recovery paths; avoid repeating the generic launch article |
| Launch a D2C brand | `/in/resources/growth/d2c-brand-launch-guide` | First 100 orders, product pages, launch guide | Positioning, unit economics and validation; distinguish this from software setup |
| Choose payment methods and understand risk | `/in/resources/payments/upi-vs-cod-india` | Razorpay setup, GST, invoicing, refunds | Clarify definitions, settlement and failure states; replace unsupported universal percentages |
| Understand tax/invoice obligations | `/in/resources/payments/gst-for-ecommerce-india` | `/in/resources/payments/invoicing-india-merchants` | Qualified current review and inline official sources; synchronize all language versions |
| Fulfill and ship orders reliably | `/in/resources/operations` | Inventory, shipping, fulfillment, warehouse guides | Make overview vs task-specific roles clear; show supported steps and explicit limits |
| Acquire and retain customers | `/in/resources/growth` | First orders, email, social, retention, reviews | Separate evidence-backed advice from hypothetical examples; qualify any performance claim |
| Understand product capabilities | `/in/resources/platform` | Merchant web, themes, platform overview | One current capability-status vocabulary shared with pricing/legal pages |
| Implement supported integrations | `/in/resources/developers` | API, webhooks, Liquid, custom integrations | Document only actual supported contracts and audience access; clearly mark closed or future authoring paths |
| Understand AI concepts versus available AI product | `/in/resources/ai-commerce` | Concept explainer, automation, recommendations, copilot guide | Keep education distinct from currently purchasable capabilities; do not promise unavailable actions |

All seven current categories have an owner in this map. The main resource index should continue to expose all seven. A single launch article should not be stretched into a universal technical documentation hub.

## Proposed clusters and internal links

[cluster-plan.json](cluster-plan.json) inventories all 35 source article records and 36 candidate search phrases. [cluster-map.html](cluster-map.html) visualizes the priority launch pillar and 16 existing spokes across four groups. [internal-link-matrix.csv](internal-link-matrix.csv) supplies 44 proposed contextual links with anchors. These are recommendations, not a claim that the links already exist or have been implemented.

| Priority cluster | Pillar/overview | Existing spokes selected for the initial map |
|---|---|---|
| Launch and conversion | Store-start guide | LetBuyy setup walkthrough; product-page optimization; store SEO checklist; cart abandonment |
| Payments and compliance | Store-start guide linking to Payments hub | UPI/COD; GST; invoice requirements; Razorpay setup |
| Shipping and operations | Store-start guide linking to Operations hub | Inventory management; shipping; order fulfillment; returns policy |
| Acquisition and retention | Store-start guide linking to Growth hub | First 100 orders; D2C brand launch; social commerce; customer retention |

Link at the moment a reader needs the detail: legal prerequisites to the reviewed GST guide; payment-method choice to UPI/COD; provider setup to the platform-specific guide; shipping readiness to the shipping checklist. Retain related-article cards, breadcrumbs and category discovery. They do not replace a source citation beside a factual claim or a contextual link beside a prerequisite.

The article renderer currently accepts plain text for most body blocks, while supporting reference/related navigation elsewhere. Extend the existing content contract with safe link/citation support when implementing; avoid embedding unsafe arbitrary HTML or building a second renderer. The final body-link sample is in the content analysis evidence. Special theme/Liquid guide renderers need separate checking before any site-wide count is asserted.

### Cannibalization candidates, not proven ranking conflicts

- The generic store-start guide, the LetBuyy setup walkthrough and the D2C-brand launch article address adjacent launch intents. Assign the different roles above and cross-link deliberately. Do not merge them without query/page evidence showing the same intent.
- `understanding-fulfillment` should explain concepts and options; `order-fulfillment-guide` should teach the operating procedure; `shipping-india-guide` should cover dispatch, serviceability and carrier decisions. Repeated introductions alone do not justify deleting useful task pages.
- `automating-operations-ai` and `workflow-automation-merchants` need clear conceptual versus supported-procedure roles. Treat public feature readiness as a prerequisite.

To complete SERP-overlap clustering, obtain consistent English India top-10 organic URL sets for the candidate phrases, retain the query/date/device/location, normalize URL variants, and compute overlap using the skill's documented bands. Validate ambiguous pairs and inspect GSC query-to-page behavior when available. Current intent grouping is not a substitute for that dataset. Do not infer keyword demand from the number of search results or choose a pillar by invented volume.

## Content Brief: Starting an online store in India

### Search Intent

Informational with a commercial next step. The intended reader is a prospective Indian seller who needs a launch sequence and realistic prerequisites. Current search samples include a general platform guide and an India-specific clothing-store guide; both use ordered setup steps. Improve the existing article rather than create another launch-guide URL.

### Competitor Analysis

| Inspected primary page | Observed format | Useful benchmark | Limitation |
|---|---|---|---|
| [Shopify store-start guide](https://www.shopify.com/in/blog/start-online-store) | Audience/product/platform/brand/setup/launch sequence; screenshots and linked further reading | Shows how concrete examples connect decisions to setup | Global guidance appears within an India URL; not an independent India compliance authority |
| [Razorpay clothing-store guide](https://razorpay.com/learn/?p=18234) | Niche, products, store pages, payments, promotion and fulfillment | India payment prerequisites and task sequence | Fashion-specific and provider-marketing content; not proof of all LetBuyy behavior |

No five-result controlled ranking set, competitor word-count average or numerical gap score was measured. Editorial space below is a planning budget, not a ranking requirement.

### Content Gaps and Opportunities

- Replace the purported merchant result with authorized evidence or a clearly hypothetical scenario.
- Explain who each compliance statement applies to rather than implying one registration threshold fits every seller.
- Add a current, reproducible LetBuyy launch walkthrough that distinguishes mock/sandbox/provider approval from live readiness.
- Show an explicit cost inventory and link to current pricing rather than restating prices inside evergreen prose.

### Winning Outline

**H1:** How to Start an Online Store in India

**Existing URL:** `/in/resources/ecommerce/how-to-start-an-online-store-india`

**Editorial budget:** Roughly 1,500–2,300 useful words if needed for the sequence; stop when the reader can complete the task. No competitor-average or minimum is claimed.

| Section | Keep, strengthen or add | Required substance and format | Language guidance | Planning budget |
|---|---|---|---|---:|
| Start with a launch-readiness checklist | Add | Product, customer, catalog, costs, payment approval, shipping and policy checklist | Use the main topic once naturally in the introduction | 100–160 words |
| Decide what and whom to sell to | Keep/strengthen | A small decision table; remove unsupported market-size or geographic-growth assertions | Use audience and product terms naturally | 180–250 |
| Check the registrations that apply to your business | Correct | Conditional decision table reviewed by a qualified person, with dated official references | Use GST registration as a subtopic, not a repeated headline keyword | 200–300 |
| Compare the full operating cost | Add | Subscription, tax, domain, gateway, shipping, returns and optional-service categories; link to pricing | Explain online-store cost in plain language; no fabricated numerical example | 180–260 |
| Build and test the storefront | Strengthen | Genuine current screenshots; supported setup steps; mobile, catalog, checkout and recovery checks | Use storefront setup and launch checklist variations | 350–500 |
| Enable payments and fulfillment safely | Correct/strengthen | Provider approval and sandbox/live boundaries; link to dedicated setup guides | Use UPI, COD and shipping only where relevant | 220–350 |
| Launch, observe and improve | Keep/strengthen | Define qualified signup and first verified order; separate example from actual measured customer outcome | Avoid guarantees of orders or time to launch | 200–280 |

### Recommended Meta Tags

**Title:** Start an Online Store in India: Launch Guide | LetBuyy

**Meta description:** Plan your online store launch in India: products, costs, payments, shipping and the checks to complete before taking orders. Read the guide.

Final wording must match actual supported steps and reviewed compliance facts. Length is a display diagnostic, not a hard Google requirement.

### Unique Angle and Information Gain

Create an owned launch evidence pack: a dated walkthrough using a synthetic catalog in the actual LetBuyy environment, annotated mobile screenshots, expected result and recovery checks for each step, and a clear readiness checklist. This is a specific differentiating asset the team can produce; the audit does not claim no competitor anywhere has equivalent material. Label simulated order data and never imply synthetic results are customer outcomes.

### E-E-A-T Requirements

- A real author or accurate team byline with accountable editorial contact.
- Permission and source documentation for any actual merchant story.
- Qualified review and dated official links for tax/compliance advice.
- Screenshots captured from the tested supported workflow, with product version/date where useful.
- A meaningful reviewed date only after substantive review; no build-time freshness refresh.

### Internal Linking Opportunities

Link to [payment-method choice](https://www.letbuyy.com/in/resources/payments/upi-vs-cod-india), [GST obligations](https://www.letbuyy.com/in/resources/payments/gst-for-ecommerce-india), [LetBuyy setup walkthrough](https://www.letbuyy.com/in/resources/platform/building-first-letbuyy-store), [shipping checklist](https://www.letbuyy.com/in/resources/operations/shipping-india-guide) and [current plans](https://www.letbuyy.com/in/pricing). Spokes should link back to the relevant launch step. These are existing destinations, subject to the canonical fixes identified elsewhere.

## Content Brief: LetBuyy pricing and total operating cost

### Search Intent

Commercial/transactional. A prospective seller needs to understand trial, subscription, commission, provider charges and feature availability before choosing a plan. Improve `/in/pricing`; do not create a competing cost landing page while pricing itself is incomplete.

### Competitor Analysis

The [Shopify India pricing result](https://www.shopify.com/in/pricing) and inspected [Zoho builder page](https://www.zoho.com/commerce/ecommerce-website-builder.html) separately expose plan/pricing information and next actions. This supports clear commercial page structure. The audit does not certify competitor price schedules or calculate a savings claim. Current controlled rankings, conversion rates and word averages were not measured.

### Content Gaps and Opportunities

Resolve the conflicting free/trial/paid offer before writing new sales claims. Explain the difference between 0% platform commission and all other costs. Present currently purchasable features separately from coming-soon plans. Keep facts available in initial HTML and equal after hydration.

### Winning Outline

**H1:** LetBuyy Pricing for Indian Online Stores

**Existing URL:** `/in/pricing`

**Editorial budget:** A compact page with enough detail to choose; no word-count target.

1. **Plans and current offer:** source-approved names, monthly/annual period, tax treatment, trial length and eligibility. Render from the existing pricing authority; do not paste numbers from the audit.
2. **What 0% commission means:** explain platform transaction fee, subscription, payment-provider fee and shipping costs as separate concepts. Use a small cost-category table.
3. **Feature and limit comparison:** current capabilities, required provider setup and explicit coming-soon status. Keep keyboard-usable comparison controls.
4. **Trial, billing and cancellation:** answer what happens when the trial ends, when payment is due, whether a card is required, and how to cancel using approved terms.
5. **Before you choose:** link to setup, payment prerequisites and billing terms; provide a truthful contact/demo alternative when the user needs assistance.

Use pricing, subscription, commission and trial language where each concept belongs. Do not force the main phrase into every heading or image alt.

### Recommended Meta Tags

**Title:** LetBuyy Pricing: Plans for Indian Online Stores

**Meta description:** Compare LetBuyy plans, included features and billing terms. Understand subscriptions, zero platform commission and provider costs before choosing.

### Unique Angle and Information Gain

Provide an explicit, source-owned cost taxonomy and a dated capability-status table for this product. If a total-cost example is included, label assumptions and calculations, leave provider rates to current linked sources, and never use invented customer revenue or savings.

### E-E-A-T Requirements

Product/billing-owner review; consistency between visible offers, FAQ, legal terms and JSON-LD; real approval for the free/trial model; accurate feature availability. No fabricated aggregate rating or zero-price schema.

### Internal Linking Opportunities

Link to [billing terms](https://www.letbuyy.com/in/legal/billing), [payment setup](https://www.letbuyy.com/in/resources/payments/razorpay-integration-guide), [launch guide](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india), [contact](https://www.letbuyy.com/in/contact), and [demo](https://www.letbuyy.com/in/demo). Confirm the intended indexability of demo separately.

## Content Brief: UPI versus cash on delivery

### Search Intent

Informational decision support for an Indian merchant. The existing page should explain tradeoffs and operational steps, not promise a universally winning payment mix. Search evidence includes [Razorpay's India and COD resource](https://razorpay.com/ebooks/india_and_cod/); no controlled top-five comparison or keyword demand was measured.

### Competitor Analysis

Use the provider resource as a starting research source, not as universal merchant evidence. Use [NPCI product statistics](https://www.npci.org.in/product/upi/product-statistics) and [NPCI ecosystem statistics](https://www.npci.org.in/what-we-do/upi/upi-ecosystem-statistics) for exactly scoped payment facts. Direct web opens returned a JavaScript shell, so current data extraction remains a prerequisite; indexed snippets are not a substitute for a complete current rate/fee table.

### Content Gaps and Opportunities

The existing claims about zero failures, instantaneous settlement, fee thresholds and fixed performance improvements need verification and qualification. A bank transfer's real-time characteristics are different from a payment provider's merchant settlement schedule. Return-to-origin and customer return rates are different outcomes. A national UPI volume share is not automatically ecommerce payment-method market share.

### Winning Outline

**H1:** UPI vs Cash on Delivery for Indian Online Stores

**Existing URL:** `/in/resources/payments/upi-vs-cod-india`

**Editorial budget:** Approximately 1,000–1,600 words if supported by the evidence; no minimum.

| Section | Required treatment | Suggested terminology | Budget |
|---|---|---|---:|
| Define the options | Distinguish prepaid UPI, COD and provider settlement | UPI, cash on delivery | 120–180 |
| Compare operational tradeoffs | Table covering buyer trust, payment confirmation, cash flow, delivery risk, support and costs | Payment-method comparison | 200–280 |
| Explain failure and recovery | Pending, declined, debited-but-unconfirmed, refund and escalation states from actual contracts | Payment failure/recovery | 180–260 |
| Discuss cost without universal claims | Current provider/source links, applicability, tax and settlement assumptions | Payment-provider charges, settlement | 180–260 |
| Choose and measure your mix | Synthetic worked calculation with explicit inputs, or owned anonymized data with methodology | Contribution margin, RTO, return | 180–260 |
| Configure supported options | Dated product workflow, provider prerequisites, recovery route | LetBuyy payment setup | 150–220 |

### Recommended Meta Tags

**Title:** UPI vs COD for Indian Online Stores | LetBuyy

**Meta description:** Compare UPI and cash on delivery: payment confirmation, settlement, costs and returns. Learn what to check before choosing your store's payment mix.

### Unique Angle and Information Gain

Add a reproducible merchant decision worksheet using clearly hypothetical inputs for prepaid acceptance, COD delivery completion, shipping cost and RTO. Show the formula and limitations rather than inventing a nationwide best mix. Link a tested LetBuyy recovery checklist so the concept connects to a supported task.

### E-E-A-T Requirements

Payments specialist review; exact study/source/date for every quantitative claim; current official/provider fee and settlement references; no zero-failure guarantee; truthful identification of synthetic examples. Tax claims route to the separately reviewed tax guide.

### Internal Linking Opportunities

Link to [Razorpay setup](https://www.letbuyy.com/in/resources/payments/razorpay-integration-guide), [shipping](https://www.letbuyy.com/in/resources/operations/shipping-india-guide), [returns policy](https://www.letbuyy.com/in/resources/payments/refunds-returns-policy-india), [GST](https://www.letbuyy.com/in/resources/payments/gst-for-ecommerce-india) and [store launch](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india).

## Content Brief: GST for ecommerce sellers

### Search Intent

Informational compliance guidance for Indian sellers, with material financial consequences. Improve the existing guide; it needs qualified review rather than broader promotional wording. The right output is a conditional explanation tied to current official rules.

### Competitor Analysis

[Shopify's India GST FAQ](https://help.shopify.com/en/manual/taxes/india-gst) is a platform comparison candidate, not legal authority. The [GST registration manual](https://tutorial.gst.gov.in/userguide/registration/Apply_for_Registration_Normal_Taxpayer.htm) is a primary task source. Old official FAQ documents can be superseded; current notifications and effective dates must take precedence. No editorial score or ranking claim is assigned.

### Content Gaps and Opportunities

Explain goods/services, intrastate/interstate supplies, own website/marketplace/ECO roles, registration applicability and conditional exemptions. Separate GST TCS from income-tax TDS and from a platform fee. Rate tables need current classification and effective-date review; a generic label such as electronics is not sufficient to establish every product's tax rate.

### Winning Outline

**H1:** GST for Ecommerce Sellers in India: What to Check

**Existing URL:** `/in/resources/payments/gst-for-ecommerce-india`

**Editorial budget:** Scope by the reviewed decision tree; no competitive word target.

1. **Which seller and supply does this guide cover?** Define audience, goods/services, jurisdiction and reviewed-as-of date.
2. **When is registration required or exempt?** Qualified reviewer prepares a decision table with applicable conditions and official sources; no one-threshold shortcut.
3. **How does ecommerce TCS apply?** Show the rule, components, applicability and effective date from current notifications. Do not treat a newsletter summary as comprehensive ongoing legal verification.
4. **What goes on an invoice?** Link to the invoice owner; demonstrate a hypothetical sample clearly marked and distinguish e-invoice applicability.
5. **What records and filing schedule apply?** Account for applicable schemes/periodicity and current portal instructions rather than one unconditional monthly deadline.
6. **When to get professional advice:** Cross-state inventory, mixed supplies and exceptional cases should point to a real qualified adviser; do not invent a named reviewer or assurance.

### Recommended Meta Tags

**Title:** GST for Ecommerce Sellers in India | LetBuyy

**Meta description:** Understand the GST questions Indian ecommerce sellers should check: registration, invoices, TCS and filing. Read the conditions and official sources.

### Unique Angle and Information Gain

Build a dated, qualified-review decision table that connects seller circumstances to the exact current primary rule and a clearly illustrative invoice/record example. The audit does not provide final tax advice; the editorial task is to make verifiable conditions and limitations visible at the point of use.

### E-E-A-T Requirements

A real relevant reviewer with permission to publish credentials; applicable primary sources and effective dates; a corrections contact; synchronized English/Tamil/Hindi changes; no build-date freshness claim.

### Internal Linking Opportunities

Link to [GST invoices](https://www.letbuyy.com/in/resources/payments/invoicing-india-merchants), [payment choices](https://www.letbuyy.com/in/resources/payments/upi-vs-cod-india), [launch guide](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india), [payment setup](https://www.letbuyy.com/in/resources/payments/razorpay-integration-guide), and [billing terms](https://www.letbuyy.com/in/legal/billing). Confirm the official destination for each rule during review.

## Comparison-page opportunity

The launch guide already compares LetBuyy with other platforms. Correct that table before creating a dedicated comparison page. A later `/in/resources/.../letbuyy-vs-shopify` concept is an **opportunity**, not an approved URL or measured demand result. Build only after recording current country/plan/date/source for feature access, total cost, payment providers, ownership/export and support. Include cases where another platform is the better fit. No untested migration-success or cost-saving claim belongs on the page. Link it from the platform-selection step; do not generate a competitor-by-feature page matrix.

## Programmatic and archive policy

Categories, tags, author pages and language variants are useful navigational templates when they serve different needs. Their number or word count alone does not demonstrate spam, index bloat or a penalty. Assess actual query usefulness and article discovery before consolidation. Keep the seven meaningful category hubs, correct their canonical URLs, and enrich descriptions only where the reader needs orientation. Decide internal search separately. Do not create city pages for a software product without a genuine location-specific offer and evidence.

## Practical sequence and measurements

| Batch | Owner | Work and dependencies | Completion check |
|---|---|---|---|
| 1: factual repair | Product/billing owner + editor + qualified tax reviewer | Approved offers/statuses, mathematical correction, source ledger, honest case-study/author presentation | No contradictory offer; every material claim retained has provenance or is clearly illustrative; translations agree |
| 2: improve existing task pages | Editor + product specialist + web engineer | Launch/pricing/payment/tax briefs; safe citation links; current screenshots; canonical fixes | Users can find prerequisites and next steps; initial HTML contains approved plan facts and source links |
| 3: connect the library | Editor + web engineer | Proposed link matrix after content truth/canonical agreement | All approved spokes reachable from relevant hub; contextual links resolve to final locale URLs; no orphan created |
| 4: validate demand and gaps | SEO/analytics owner | GSC query/page data, consistent India SERP sample, real audience feedback | Distinct intent per owner; adjust clusters with evidence; no promised numerical traffic uplift |

Track leading indicators first: eligible canonical URL coverage, missing references on priority guides, unresolved factual claims, body links to prerequisites, qualified signup starts and completed assistance requests where existing analytics can measure them. Organic impressions/clicks and Google-selected canonicals require first-party access and recrawl time. These are proposed measurements, not changes to analytics configuration or scheduled monitoring.

## FLOW synthesis and attribution

Framework and prompts © Daniel Agrici, CC BY 4.0: github.com/AgriciDaniel/flow

Adapted here from the installed FLOW framework and three Optimize prompts: Core 30 Content Audit (separate evidence from claims), Technical Audit (connect accessible content to crawlable owners), and CTR Audit (align offer/next action with buyer language). No FLOW vendor statistics were imported into this audit.

- **Find:** The observed product and focused search samples support store-builder, pricing and practical launch needs. Candidate phrases are hypotheses until demand and overlap can be measured.
- **Leverage:** Genuine product walkthroughs, authorized merchant outcomes and qualified source-linked compliance content are stronger corroboration than invented experts or broad numeric promises. Backlink acquisition/outreach is outside this audit.
- **Optimize:** Fix factual contradictions, locale identities, initial pricing and contextual references in the existing pages.
- **Win:** Connect the landing page to a truthful plan choice and supported signup/demo/contact step; measure qualified completion with authorized existing analytics when available.
- **Local:** No physical service-location content is proposed without evidence that this software business has a relevant local customer-facing operation.

This plan does not establish rankings, keyword volume, commercial approval, genuine customer outcomes, author credentials, complete tax correctness or AI citations. The next review should check implemented correctness and observed query/task behavior before increasing publishing volume.
