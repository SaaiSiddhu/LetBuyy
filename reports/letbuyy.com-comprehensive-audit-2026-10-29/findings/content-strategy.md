# Content quality and strategy findings

29 October2026 · Shared fresh live crawl; source is used only for implementation navigation.

**Assessment:** The site has an existing useful topical structure. The highest priority is factual reliability and honest product/author/result presentation, followed by source-linked task completion. There is no basis to infer AI authorship, a penalty, or ranking impact from phrasing, page length or template count. No numeric E-E-A-T score is assigned.

**Evidence scope:** 35 English article bodies inspected; translated arithmetic variants separately checked. Cite evidence/content-analysis.json and each raw HTML capture below. Body-reference counts exclude unrelated navigation/social links. Saved article content remains the authoritative capture; the regex percentage screen is a candidate selector, not a fact checker.

## CONTENT-01 — Conversion-lift headline and calculation overstate the example

**Severity/state/confidence:** High · Confirmed · High
**Affected inspected URLs:** 3 · Shared article record across three locales

**Evidence:** Shared live HTML in three locale variants retains 1.7%, 4.6% and 270%. (4.6-1.7)/1.7*100=170.5882%; absolute change=2.9 percentage points. The title also promotes 270%. Underlying study/sample was not identified in the article.

**Representative URLs:** [resources/ecommerce/how-product-reviews-increase-conversion](https://www.letbuyy.com/in/resources/ecommerce/how-product-reviews-increase-conversion), [https://www.letbuyy.com/in-ta/resources/ecommerce/how-product-reviews-increase-conversion](https://www.letbuyy.com/in-ta/resources/ecommerce/how-product-reviews-increase-conversion), [https://www.letbuyy.com/in-hi/resources/ecommerce/how-product-reviews-increase-conversion](https://www.letbuyy.com/in-hi/resources/ecommerce/how-product-reviews-increase-conversion)

**Saved evidence:** [039da40a874dfba0.html](../evidence/pages/039da40a874dfba0.html), [d0869f91e7e79151.html](../evidence/pages/d0869f91e7e79151.html), [16bcad3c293bfcc4.html](../evidence/pages/16bcad3c293bfcc4.html)

**Why it matters:** Readers receive a materially incorrect quantitative conclusion; it also propagates to titles and article/card text. No ranking loss is established.

**Correction:** Correct the relative-increase calculation and all synchronized titles, summaries, schema/cards and translations. Alternatively remove the numerical promise until a faithfully scoped original source is available. Do not present arithmetic correction as validation of the original study.

**Owner/effort:** Editor + analytics/research reviewer · 2-6 hours assuming translation support and underlying source access

**Dependencies:** Claim/source ledger; translation review

**Validation:** Recompute from cited original values; compare title, H1, body, summaries and schema in all three languages; verify the source population/date/outcome.

**Success indicator:** Zero arithmetic contradictions across the three article variants and their metadata.

## CONTENT-02 — Quantified article claims lack traceable in-body references

**Severity/state/confidence:** High · Confirmed · High for missing references; truth of most figures unverified
**Affected inspected URLs:** 19 · 19 English article pages; related translations require synchronized review

**Evidence:** Within all 35 English articles, body-container extraction finds no external reference anchors. 19 English articles contain percentage-pattern claims. Examples include exact payment shares/performance gains and growth/retention statistics. UPI guide also makes categorical zero-failure, fee and settlement assertions. Absence of citations does not prove every claim false; current fee and other factual applicability remain unverified.

**Representative URLs:** [resources/operations/order-fulfillment-guide](https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide), [resources/growth/email-marketing-ecommerce](https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce), [resources/ecommerce/how-to-start-an-online-store-india](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india), [resources/payments/upi-vs-cod-india](https://www.letbuyy.com/in/resources/payments/upi-vs-cod-india), [resources/growth/first-100-orders-guide](https://www.letbuyy.com/in/resources/growth/first-100-orders-guide)

**Saved evidence:** [10eff7edf6816a14.html](../evidence/pages/10eff7edf6816a14.html), [240e5124fc4dfa6a.html](../evidence/pages/240e5124fc4dfa6a.html), [b7182a42ce7e1a51.html](../evidence/pages/b7182a42ce7e1a51.html), [30be81c250683ada.html](../evidence/pages/30be81c250683ada.html), [638b30fbe426959e.html](../evidence/pages/638b30fbe426959e.html)

**Why it matters:** Material numerical and financial assertions are difficult for readers or reviewers to verify; generic nationwide claims can be misapplied to a merchant.

**Correction:** Build a source ledger for each material figure/categorical assertion: exact statement, source URL, date, sample/population, metric definition, scope and review owner. Cite primary sources beside claims, qualify estimates and remove unsupported guarantees. Distinguish national payment volume from ecommerce share, transfer confirmation from merchant settlement, and RTO from customer returns. Add safe link/citation capability to the existing content contract/renderer when needed.

**Owner/effort:** Subject editor + product/payments specialist; web engineer for citation support · 3-7 working days for the first 19 English articles plus scoped translations, assuming source access; not a delivery promise

**Dependencies:** Current primary data/provider terms; safe citation rendering; qualified review for financial/tax statements

**Validation:** Verify every retained material numerical claim against the exact primary source and effective date; check citations appear as crawlable links in initial HTML; translations preserve scope. Review facts, not merely link counts.

**Success indicator:** All retained material claims in the priority article set have a supporting source/methodology or a visible illustrative/estimate label.

## CONTENT-03 — Merchant outcomes and expert biographies need provenance verification

**Severity/state/confidence:** High · Needs verification · High for observed wording; underlying provenance unverified
**Affected inspected URLs:** 4 · One English article and three English author profiles

**Evidence:** The live launch guide describes a Jaipur merchant migration in April2026 with conversion changing34% to61% in60days and COD orders doubling, labelled Commerce Example rather than explicitly hypothetical. Inspected author pages claim prior employer experience, a GST-consultant role and work with200brands. Page-level evidence does not substantiate those identities/outcomes. This audit has not established that they are false.

**Representative URLs:** [resources/ecommerce/how-to-start-an-online-store-india](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india), [resources/authors/priya-commerce](https://www.letbuyy.com/in/resources/authors/priya-commerce), [resources/authors/neha-payments](https://www.letbuyy.com/in/resources/authors/neha-payments), [resources/authors/ravi-operations](https://www.letbuyy.com/in/resources/authors/ravi-operations)

**Saved evidence:** [b7182a42ce7e1a51.html](../evidence/pages/b7182a42ce7e1a51.html), [6275c8f02d2cb141.html](../evidence/pages/6275c8f02d2cb141.html), [a5140cbacbb6cf9d.html](../evidence/pages/a5140cbacbb6cf9d.html), [1ea885b14915fe0d.html](../evidence/pages/1ea885b14915fe0d.html)

**Why it matters:** Specific-looking customer results and professional credentials can affect merchant trust and financial decisions; markup cannot compensate for unsupported provenance.

**Correction:** Obtain authorized records for actual results and biographies. Retain only accurate claims; otherwise remove unsupported credentials or use an honest team byline. Explicitly label hypothetical teaching scenarios and inputs. Keep actual customer data private and publish only authorized evidence.

**Owner/effort:** Editorial owner + business/product owner; real named reviewers where applicable · 1-3 days to resolve priority claims if records/owners are available; otherwise remove/qualify pending verification

**Dependencies:** Human-owned factual records and consent; truthful author/entity policy

**Validation:** For each result, verify data window, denominator, calculation, confounders and publishing permission. For each biography, verify actual identity/role and consent. Check article, author page, schema and translations agree.

**Success indicator:** Zero unverified customer outcomes or credentials presented as established facts in the reviewed set.

## CONTENT-04 — Feature-action guides leave general availability unclear

**Severity/state/confidence:** Medium · Needs verification · High for wording; actual general availability unverified
**Affected inspected URLs:** 2 · Two English task guides; availability review applies to related guides

**Evidence:** Live guides present app installation and an always-on AI copilot as actionable current experiences. Pricing labels Scale/Commerce OS coming soon; legal text distinguishes closed publishing surfaces. Installing curated apps can coexist with closed public publishing, so this is an availability ambiguity, not proof the product is absent. Actual entitlement and provider readiness were not exercised.

**Representative URLs:** [resources/platform/introduction-to-apps](https://www.letbuyy.com/in/resources/platform/introduction-to-apps), [resources/ai-commerce/commerce-copilot-guide](https://www.letbuyy.com/in/resources/ai-commerce/commerce-copilot-guide)

**Saved evidence:** [da34607248e5ee0f.html](../evidence/pages/da34607248e5ee0f.html), [a524ca561a953ae8.html](../evidence/pages/a524ca561a953ae8.html)

**Why it matters:** Visitors may follow a task guide to an action they cannot access or purchase, weakening task completion and offer clarity.

**Correction:** Reconcile each documented action with the product/plan/realm/provider availability authority. Add clear available-now, restricted-access, setup-required or planned labels and prerequisites. Separate concepts from procedures. Correct promises without activating frozen runtimes or inventing release dates.

**Owner/effort:** Product documentation owner + product/billing owner · 0.5-2 days for reviewed status matrix and priority guides, assuming availability facts exist

**Dependencies:** Approved feature/entitlement facts; current pricing/legal wording

**Validation:** Trace each guide step to an actual authorized product path and eligible plan; verify accessible alternatives for ineligible users; compare guides, FAQ, prices and legal status. No real transaction required.

**Success indicator:** Every actionable priority guide states accurate access prerequisites and current availability.

## CONTENT-05 — Article bodies omit contextual links to prerequisite and next-step guides

**Severity/state/confidence:** Medium · Opportunity · High for body-link absence; benefit is a hypothesis
**Affected inspected URLs:** 35 · Shared article-body pattern across35 English pages

**Evidence:** All 35 English article-body containers have zero contextual internal anchors in the shared live HTML. Heading self-links exist; breadcrumbs, tags and related cards provide article discovery outside the body. This is not evidence of orphan pages or a required link-count violation.

**Representative URLs:** [resources/platform/how-themes-work](https://www.letbuyy.com/in/resources/platform/how-themes-work), [resources/platform/introduction-to-apps](https://www.letbuyy.com/in/resources/platform/introduction-to-apps), [resources/operations/order-fulfillment-guide](https://www.letbuyy.com/in/resources/operations/order-fulfillment-guide), [resources/growth/email-marketing-ecommerce](https://www.letbuyy.com/in/resources/growth/email-marketing-ecommerce), [resources/ecommerce/how-to-start-an-online-store-india](https://www.letbuyy.com/in/resources/ecommerce/how-to-start-an-online-store-india)

**Saved evidence:** [625c7e4f1132c147.html](../evidence/pages/625c7e4f1132c147.html), [da34607248e5ee0f.html](../evidence/pages/da34607248e5ee0f.html), [10eff7edf6816a14.html](../evidence/pages/10eff7edf6816a14.html), [240e5124fc4dfa6a.html](../evidence/pages/240e5124fc4dfa6a.html), [b7182a42ce7e1a51.html](../evidence/pages/b7182a42ce7e1a51.html)

**Why it matters:** Readers must leave the task context to find prerequisite detail; source references and next-step guidance are less direct.

**Correction:** Add relevant contextual links at actual decision points using the existing localized link/content contract. Prioritize launch→GST/payments/shipping, UPI/COD→setup/refunds, and supported procedure→troubleshooting. Use the proposed44-link matrix as editorial guidance, not a mechanical quota.

**Owner/effort:** Content editor + web engineer · 1-3 days for initial launch/payment clusters, assuming safe link rendering

**Dependencies:** Corrected target content; canonical/locale URL policy; safe content contract

**Validation:** Verify links in initial HTML, correct locale/final200 destination, meaningful anchor and reader relevance. Preserve related cards and discovery; check no article becomes orphaned.

**Success indicator:** Every priority task guide links directly to the prerequisites and next steps necessary for its task; zero broken proposed links after implementation.

## Tax and current financial claims

The parent audit owns the separate tax finding to prevent duplication. Exact guide statements needing review include registration thresholds, blanket marketplace registration, TCS1%, category rates and unconditional filing schedules. Official2023exemption/2024TCS/2025rate material is handled in the main audit; the content team must update adjacent setup/invoice guides and translations together. A GSTR2A mention is not automatically wrong: the official portal documents TCS details in PartC. Current provider fee claims must be checked against current policy; this analysis does not invent a replacement fee schedule.

## Current strengths and limits

Articles have useful headings, dates, bylines, category/tag discovery, related reading, concept illustrations and several task checklists. The seven categories map to actual merchant and developer questions. Keep those strengths. No measured query-to-page cannibalization, keyword demand, reader testing, author credential confirmation or customer-record verification was available in this subtask. The full audit supplies technical/performance and access coverage.

See [CONTENT-AND-CLUSTER-PLAN.md](../CONTENT-AND-CLUSTER-PLAN.md) for four detailed upgrade briefs, page ownership, provisional36-phrase intent mapping and proposed44-link matrix.

## Primary methodology references

[Google helpful-content guidance](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) emphasizes reliable sourcing, demonstrable experience and original usefulness. It explicitly rejects a preferred Google word count. These findings use evidence of factual/source/task gaps, not a length-based quality score. [Google spam policies](https://developers.google.com/search/docs/essentials/spam-policies) explain doorway/scaled-content concerns; no policy violation or penalty is asserted here.


Final inventory reconciliation: 496 initial attempts plus three ordinary tag/cart pages and one legal-page retry produce 500 crawl attempts, 499 distinct URLs and 489 clean locale HTML pages. Article analysis remains 105 equivalents / 35 per language; scope expansion changes no content finding counts.
