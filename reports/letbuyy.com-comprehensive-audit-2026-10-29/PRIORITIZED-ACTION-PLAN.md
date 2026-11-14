# Prioritized action plan

Order uses evidence, affected breadth, merchant trust, dependencies and effort. Efforts are engineering/editor estimates with assumptions, not release promises; overlapping template work should be combined rather than summed. No deployment/submission is authorized by this document.

## Batch 1 — Public truth and URL policy

First implementation batch; reviewer availability determines duration.

| ID | Work | Owner | Effort / assumptions | Dependency | Acceptance |
|---|---|---|---|---|---|
| AUD-01 | Free launch offer markup conflicts with paid plans and trial messaging | Product/commercial owner + frontend engineer | 0.5–1 engineer day after offer decision; editorial/translation time additional | Approved offer facts; existing gateway pricing authority; coordinate AUD-03. | Zero contradictory offer statements across inspected surfaces; visible offer and schema agree. |
| AUD-02 | GST guide repeats superseded and overgeneralized guidance | Qualified tax reviewer + editorial/translation owner | 1–3 reviewer/editor days for guide family; assumes access to current notifications and native-language review | Current applicable notifications, actual jurisdiction/product facts and real review ownership. | Zero unresolved documented conflicts in the reviewed guide family; every material compliance claim has an applicable dated primary source. |
| CONTENT-01 | Conversion-lift headline and calculation overstate the example | Editor + analytics/research reviewer | 2-6 hours assuming translation support and underlying source access | Claim/source ledger; translation review | Zero arithmetic contradictions across the three article variants and their metadata. |
| CONTENT-02 | Quantified article claims lack traceable in-body references | Subject editor + product/payments specialist; web engineer for citation support | 3-7 working days for the first 19 English articles plus scoped translations, assuming source access; not a delivery promise | Current primary data/provider terms; safe citation rendering; qualified review for financial/tax statements | All retained material claims in the priority article set have a supporting source/methodology or a visible illustrative/estimate label. |
| CONTENT-03 | Merchant outcomes and expert biographies need provenance verification | Editorial owner + business/product owner; real named reviewers where applicable | 1-3 days to resolve priority claims if records/owners are available; otherwise remove/qualify pending verification | Human-owned factual records and consent; truthful author/entity policy | Zero unverified customer outcomes or credentials presented as established facts in the reviewed set. |
| TECH-01 | Resource category, tag and author canonicals remove the locale | Frontend engineer | 0.5–1 engineer day including template tests; excludes release | Decide which archive types should remain indexable; preserve genuine translated equivalents. | 0 redirecting or locale-stripped canonicals among retained intended indexable pages. |
| TECH-02 | Creation chooser inherits homepage metadata and language alternatives | Product owner + frontend engineer | 0.25–0.5 engineer day after indexability decision | Creation-page purpose; TECH-01 URL policy. | 3/3 chooser URLs follow the chosen consistent indexing/metadata policy. |
| TECH-03 | Internal search pages are indexable, sitemap-listed and canonicalize to home | SEO lead + frontend engineer | 0.25–0.5 engineer day | TECH-01 final URL policy; preserve article discovery. | All 3 search routes have intentional indexing policy; no search URLs in the canonical sitemap when excluded. |
| TECH-09 | Unknown tags return indexable empty 200 archives | Frontend engineer | 0.25–0.5 engineer day including negative cases | Existing tag registry; TECH-01 archive canonical policy. | 0 indexable200 responses in bounded invalid-tag tests. |

## Batch 2 — Pricing, discovery and entities

After relevant offer/indexability facts are settled.

| ID | Work | Owner | Effort / assumptions | Dependency | Acceptance |
|---|---|---|---|---|---|
| AUD-03 | Public subscription prices arrive only after client fetching | Frontend/backend integration engineer | 1–2 engineer days including timeout/cache/error/hydration verification | AUD-01 approved offer; existing public gateway pricing contract; TECH-06. | Approved public plan facts visible before hydration and consistent after hydration, including honest unavailable states. |
| TECH-06 | Pricing lacks a primary heading and descriptive page title | Frontend engineer + product marketer | 0.25 engineer day, excluding commercial-fact review | Approved offer facts; pricing SSR work coordinated separately. | 3/3 pricing routes have task-specific titles and one meaningful primary heading. |
| TECH-04 | XML sitemap omits every discovered localized article | Frontend engineer + editor | 0.5–1 engineer day plus editorial eligibility review | TECH-01/02/03 canonical/indexing decisions; CONTENT factual/availability corrections. | 100% coverage of approved indexable published article equivalents;0 invalid/noncanonical/excluded sitemap URLs. |
| TECH-05 | Sitemap lastmod is a fixed June date despite later release content | Frontend engineer + editorial owner | 0.25–0.5 engineer day | Trustworthy content modification fields and TECH-04 sitemap generation. | No known stale or fabricated lastmod values; unaffected URLs retain their true dates. |
| TECH-07 | Article entities and breadcrumbs do not use final localized identities | Frontend engineer + editor | 0.5–1 engineer day plus identity/content verification | TECH-01 final URLs; verified author facts; approved representative artwork. | All approved article entities match final locale canonical; team/individual authors represented truthfully. |
| TECH-08 | Social previews lack consistent page images and final URLs | Frontend engineer + designer | 0.5 engineer day plus image QA | TECH-01 final URL policy; existing brand/social assets. | Intended preview image, URL and type are consistent across approved shareable pages. |
| TECH-10 | RSS links and feed identity omit the served locale | Frontend engineer + editorial owner | 0.5 engineer day including feed-reader compatibility review | TECH-01 final URLs; explicit feed-language policy; article translation availability. | No redirecting article item URLs; feed route/identity/content language follow documented policy. |
| AUD-04 | Robots declares three sitemap hosts that do not resolve | Frontend/platform owner | 0.25–0.5 engineer day after ownership confirmation | Authoritative active sitemap/domain inventory; no new runtime activation. | Zero nonresolving or retired sitemap declarations. |
| TECH-11 | Software app rich-result eligibility is not established | SEO lead + frontend engineer | 0.25 engineer day for validation; genuine review collection is not estimated | Approved offer facts; legitimate visible review data only if available. | Eligibility claims match real validation;0 fabricated rating/review fields. |

## Batch 3 — Existing-page usefulness and journey clarity

Following factual correction; no fixed content-production quota.

| ID | Work | Owner | Effort / assumptions | Dependency | Acceptance |
|---|---|---|---|---|---|
| CONTENT-04 | Feature-action guides leave general availability unclear | Product documentation owner + product/billing owner | 0.5-2 days for reviewed status matrix and priority guides, assuming availability facts exist | Approved feature/entitlement facts; current pricing/legal wording | Every actionable priority guide states accurate access prerequisites and current availability. |
| CONTENT-05 | Article bodies omit contextual links to prerequisite and next-step guides | Content editor + web engineer | 1-3 days for initial launch/payment clusters, assuming safe link rendering | Corrected target content; canonical/locale URL policy; safe content contract | Every priority task guide links directly to the prerequisites and next steps necessary for its task; zero broken proposed links after implementation. |
| EXT-01 | Pair Commerce OS positioning with explicit store-builder language near the primary promise | Product marketing with SEO and frontend owner | 0.5–1 working day for copy, localized review and metadata/browser verification; assumes offer decisions are settled, excludes deployment and experimentation observation. | Approved commercial and feature-availability facts; Existing metadata/canonical consistency repairs; Available conversion baseline before claiming uplift | Approved category/offer description is visible near the primary action and consistent across locales. Any CTR or conversion change remains a measured outcome, not a promised percentage. |
| AUD-06 | Curate tag landing pages before expanding the indexable archive set | SEO/editorial owner + frontend engineer | 1–2 days editorial mapping plus implementation once policy is chosen | TECH-01 archive URLs; actual first-party query/index data when available; content/topic map. | Approved archive policy consistently applied, with zero orphaned approved articles. |

## Batch 4 — Measured performance and authority

Start measurement early; optimize when a reproducible bottleneck exists.

| ID | Work | Owner | Effort / assumptions | Dependency | Acceptance |
|---|---|---|---|---|---|
| AUD-05 | Audit the homepage’s broad early image priority | Frontend performance engineer | 0.5 day measurement + 0.5–2 days targeted work if a bottleneck reproduces | Working Lighthouse or equivalent controlled lab; field/RUM access when available; stable before/after build. | Measured reduction in critical request contention/bytes with no visual or actual LCP/CLS regression; no promised score gain. |

## Shared implementation decisions

- Resolve commercial truth, real author/result provenance and jurisdiction-specific compliance facts with the actual owners. These decisions must not block mechanical template investigation.
- Decide search/create/indexable archive policy before publishing the final sitemap. Broad tag pruning does not need to block self-canonical repairs for retained pages.
- Reuse canonical metadata helpers, article registry, public gateway plan contracts and brand assets. Do not add a parallel SEO/content/pricing authority or activate dormant marketplaces.
- Pair every change with explicit positive/negative acceptance: known/unknown tag, raw/hydrated pricing, all languages, empty/error/retry behavior, canonical/alternate/sitemap agreement and accurate claims.
- Keep production rollout and external submissions as separately authorized actions. Validate deployed HTML independently of local source; wait for actual recrawl/GSC evidence before claiming indexing success.

## Success measures

Immediate indicators:0 incorrect retained canonicals;100% approved article sitemap coverage;0 contradictory offers;0 documented numerical/tax conflicts; accurate author/case provenance; plan facts in initial HTML;0 invalid-200 tag pages;0 dead sitemap declarations. Later indicators: Google-selected canonicals, indexed intended pages, qualified non-brand query impressions/CTR and signup/demo starts, and actual field LCP/INP/CLS where enough traffic exists. No numeric business uplift or ranking deadline is promised.
