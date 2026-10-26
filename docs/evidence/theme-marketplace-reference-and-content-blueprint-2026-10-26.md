# LetBuyy theme marketplace — reference audit and content/design blueprint

Research date: 26 October 2026, Asia/Kolkata. Owner direction: complete detailed reference and content planning first, including privacy/legal documents, and design around the content and the kinds of themes offered. This is the research-first extension of the existing marketplace redesign, using web-ui-ux-system. It is a product/design specification and gap audit, not a legal opinion, deployed feature list, or completed accessibility certification.

## 1. Scope and evidence

Reviewed official Shopify Theme Store/detail/help/developer/legal pages, Wix templates, Webflow templates/licensing/creator/refund pages, BigCommerce theme discovery/design policy, Squarespace template/navigation content, and official Indian privacy/consumer-protection material. Compared these with actual LetBuyy theme-store routes, components, typed service calls, legal text and browser-storage code. No account was created, terms accepted, purchase made, or external message sent.

The earlier Shopify public browser walkthrough and screenshots are under `/Users/saai_mithra/.codex/visualizations/2026/10/23/01a166b2-89de-7f40-89c2-ae5d60a8c468/shopify-theme-marketplace-reference/`. This extension uses fetched public documents and source inspection. Browser/mobile visual verification remains deferred under the owner's explicit automated-only choice. It does not certify every reference site's interaction or every listed theme. BigCommerce's fetched catalog returned zero results and Squarespace's document was navigation-heavy; those limitations are not treated as evidence of their live inventory or full interface.

Current phase checkout: `/private/tmp/letbuyy-theme-marketplace-20261026`, `codex/theme-marketplace-20261026`, base `bb28939ba6f8fb768903f5021dd79bec84940792`; research-scope commit `6eaa9220e`. Primary and other worktrees remain untouched. No new runtime, database, payment policy, issuer, renderer, hosting or production activation is authorized here. Original article copy was drafted but not connected to a live route; it is preserved separately at `/private/tmp/letbuyy-marketplace-content-draft-20261026.ts` while this research-first blueprint is reviewed.

## 2. What the references establish

| Reference | Observed pattern | Consequence for LetBuyy |
| --- | --- | --- |
| [Shopify theme selection](https://help.shopify.com/en/manual/online-store/themes/choose-themes) | Search, features, collections and industry help narrow a decision. | Discovery needs useful routes and explanations of what each filter means. Only expose filters backed by LetBuyy metadata. |
| [Gain listing](https://themes.shopify.com/themes/gain/presets/gain) | Overview, features, presets, reviews, author support and demo are connected on one addressable listing. | Keep a complete decision page. A screenshot and buy button alone are insufficient. Group presets under the actual theme; don't multiply inventory claims. |
| [Shopify theme support](https://help.shopify.com/en/manual/online-store/themes/theme-support) | Support ownership depends on who made the theme. | Explain marketplace/account help versus package/design help and custom work; publish only support commitments actually offered. |
| [Shopify updates](https://help.shopify.com/en/manual/online-store/themes/managing-themes/updating-themes) | Version and draft review are explicit parts of the lifecycle. | Explain installed version, candidate update, current release and rollback separately using existing merchant workflows. |
| [Shopify requirements](https://shopify.dev/docs/storefronts/themes/store/requirements) | Listing quality depends on usable design, testing, documentation and support. | Define LetBuyy's own evidence requirements; do not import Shopify's platform-specific features or thresholds as LetBuyy guarantees. |
| [Wix templates](https://www.wix.com/website/templates) | Templates are classified by type/industry with suitability and customization context. | Separate website type, industry, visual style and feature. These are different dimensions. |
| [Webflow templates](https://webflow.com/templates) | Category discovery, functionality labels, template structure and buying FAQs support selection. | Describe included page types, configurable sections, supported functionality and any platform dependency. |
| [Webflow template license](https://webflow.com/templates/template-licenses) | Template usage rights are explained separately from product marketing. | A theme license needs an actual scope and asset rules, not just a generated key. Its specific commercial terms are not adopted. |
| [Webflow marketplace agreement](https://webflow.com/legal/marketplace-agreement) | Creator obligations and marketplace participation are a distinct agreement. | Link an actual versioned creator agreement before asking a creator to accept it; do not invent a revenue split or launch a creator programme. |
| [Webflow refund information](https://help.webflow.com/hc/en-us/articles/40102090399635-Webflow-Refund-Policy) | Marketplace and platform-plan treatment are distinguished. | Explain theme purchases separately from LetBuyy subscriptions. Another company's refund policy is not LetBuyy's policy. |
| [BigCommerce theme store](https://www.bigcommerce.com/theme-store/) and [design policy](https://support.bigcommerce.com/s/article/BigCommerce-Design-Policy?language=en_US) | Theme discovery connects to customization, support and rights information. | Include support responsibility, customization limits and usage details near the decision. |
| [Squarespace templates](https://www.squarespace.com/templates) | Audience/use-case destinations connect to learning and support resources. | Offer useful entry points without copying unrelated scheduling, enterprise or other product capabilities. |
| [Shopify privacy](https://www.shopify.com/legal/privacy) and [cookies](https://www.shopify.com/legal/cookies) | Privacy information is organized by audience/purpose, with distinct tracking explanations. | Inventory actual marketplace data and storage; distinguish merchant visitors, purchasers and creators from shoppers on merchant sites. |

Inference: the appropriate LetBuyy information architecture has six connected areas—Discover, Evaluate, Learn, My Themes, Support and Legal—with creator guidance as a controlled supporting area. This is a recommendation derived from the reference patterns and LetBuyy's existing product, not a claim that every provider uses the same menu.

## 3. Navigation and page inventory

Keep existing addressable pages and working protected actions. Improve access and content rather than creating parallel account or commerce flows.

| Area | Routes / destinations | Required content and behavior | Existing state |
| --- | --- | --- | --- |
| Marketplace home | `/` | Search and useful entry routes, real theme cards, website types, preview-to-library explanation, concise guide/help/FAQ links. Catalog should remain prominent. | Redesigned composition exists; educational content and resource entry points need expansion. |
| Catalog | `/themes` | URL-backed query, supported facets, sorting, results/range, removable filters, pagination, clear empty versus unavailable outcomes. | Implemented. Preserve complete mobile controls and accurate result scope. |
| Discovery collections | `/collections`, existing `/collections/[slug]` | Explain browsing goals; show only API-backed curated collections. Free/recent/popular are explicit filtered/sorted views, not invented editorial awards. | Detail route/service exists; index is missing. |
| Website categories | `/themes/category/{store,portfolio,resume,landing,saas}` | Type-specific suitability, included-page expectations, supported features, preview advice and real results. | Five categories exist. Content needs richer type-specific guidance. |
| Theme listing | `/themes/[slug]` | Complete package information and actions; see section 4. | Implemented but content quality depends on supplied catalog metadata and sample availability. |
| Demo | Existing `/preview/[token]` and canonical versioned storefront demo | Clear public sample versus store preview; desktop/mobile controls; current version; safe return; sample/unavailable/expired states. | Wired to canonical origin. Local Core 1.0.0 currently has no ready sample store. |
| Compare / saved | `/themes/compare`, `/dashboard/favorites` | Comparable fields, limit explanation, remove/clear/reopen actions; honest browser-local persistence. | Existing save/compare. Favorites are not proof of purchase or a cross-device sync promise. |
| Learning hub | `/guides`, `/guides/[slug]`, existing `/docs` | Selection, preview, installation, customization, pre-publish checks, update/recovery, cost/license/download guides. Distinguish practical learning from technical reference. | Docs is a short workflow directory; full articles/index are missing. |
| Frequently asked questions | `/faq` | Grouped questions covering choose/buy/install/customize/update/download/support; links to deeper guides and actual actions. Search may be added if useful and functional. | Only a small pricing FAQ currently exists. |
| Pricing explanation | `/pricing` | Free and per-listing paid themes; final-price location; plan versus theme cost; entitlement/artifact differences; links to license/refund/support. | Current plan-like cards imply a broader programme; content should reflect the actual purchase model. |
| My Themes | `/dashboard` and existing favorites/installations/purchases/downloads/settings routes | Library, current store/version/release, entitlement, receipts/licenses, available downloads, relevant settings. Signed-out users go through existing sign-in and return context. | Routes exist but are insufficiently surfaced in public navigation. |
| Support | `/support`, `/contact` | Topic triage, steps to reproduce, preview/install/payment/download/update recovery, escalation, contact privacy, real channels and scope. | Existing pages are brief directories. Do not invent ticket delivery, response SLAs or always-on chat. |
| About | `/about` | What the marketplace offers, intended users, how themes are evaluated, how choosing/adding/publishing differ, actual contact and policy links. | Existing copy is largely implementation language. |
| Creators | Proposed `/for-creators`; preserve `/developer`, `/developer/listings/new`, `/docs/api`, `/authors/[handle]` | Package/listing requirements, documentation and asset rights, review stages and support duties; truthful programme status. Existing workspaces remain protected. | Source-kept submission workflow exists. This work does not approve public programme activation. |
| Legal and trust hub | Proposed `/legal`; existing `/legal/terms`, `/legal/privacy`, `/legal/license`, `/legal/refund` | Document index, scope, status/version/date, accessible policy text, privacy/contact routes and links from relevant decisions. Further documents below are planned, not live. | Four short operational pages exist; a complete final policy suite does not. |

Recommended header: Browse themes · Learn · Support · My Themes, plus search/account controls. Browse includes collections, free/new/popular, website types and compare. Learn includes guides, docs, FAQs and pricing explanation. My Themes exposes library/saved/installations/purchases/downloads/settings with existing access checks. Creators remains discoverable through Learn/footer; avoid an overloaded top bar. Mobile exposes the same destinations in grouped navigation. Footer groups Explore, Learn, My Themes, Creators/Support, plus Legal/Privacy/Cookie choices and operator/contact information once verified.

## 4. Content every theme detail should provide

1. **Identity and suitability:** name, brief specific description, creator/profile, website type, relevant industry/style, package version and last update. State a recommendation as suitability, not proof that a theme only works in one industry.
2. **Visual evidence:** actual screenshots with useful alternative text, identifiable preset/variation, desktop and mobile examples and an available demo for the exact package version. Distinguish demo artwork from licensed included assets.
3. **What's included:** supported page templates, configurable sections/blocks, typography/colors, supported locales/platforms, documentation and package requirements. Include real limitations or dependencies.
4. **Feature groups:** navigation/discovery, product/content presentation, marketing elements and customization, according to package metadata. Do not claim a feature is functional solely because a section visually resembles it.
5. **Cost and usage:** current listing price/currency, applicable final purchase information, license scope and a short linked usage summary, delivery/download availability and support responsibility. Do not promise unspecified tax treatment or unlimited use.
6. **Trust evidence:** moderated/verified review information with meaningful counts, dated changelog, and performance/accessibility reports with method/version/date when present. Missing measurements stay missing; avoid universal “fast”, “accessible” or guaranteed conversion badges.
7. **Actions:** public preview, eligible store preview, save, compare, add/buy and report. Make store selection, entitlement and a separate publish action clear.
8. **Aftercare:** author support/documentation, update compatibility, release notes, refund route and related actual themes. Preserve filters when returning to discovery where the existing routing supports it.

## 5. Design depends on the theme's content type

| Theme type already represented in LetBuyy | What prospective users need to inspect | Appropriate preview/storytelling |
| --- | --- | --- |
| Online store | Collections, products, variants/media, navigation, product information, cart journey and supported commerce presentation. | Show real representative product/collection pages, different catalog density and mobile shopping. Only expose actual package capabilities. |
| Portfolio | Projects, case studies, services, profile, contact and meaningful image layouts. | Let project imagery and case-study reading lead; show project index and a detailed project, not a generic product grid. |
| Resume / professional profile | Experience, education, skills, biography, contact and any supported CV/download links. | Prioritize readable hierarchy, long text and a useful narrow-screen profile. Do not promise hiring outcomes or a download the package does not provide. |
| Landing / campaign page | Offer, explanation, evidence, FAQ, primary action and supported enquiry/waitlist behavior. | Show a focused narrative and clear action; identify demonstration forms and any missing live integration. No fabricated testimonials or conversion metrics. |
| SaaS / product presentation | Product features, screenshots, comparison/pricing presentation, documentation links and actual supported signup actions. | Show product storytelling and relevant page variations. A pricing table in a theme is not a subscription billing implementation or a functioning app dashboard. |

Industry, theme type, style, preset and package are separate concepts. An industry can suggest useful content emphasis without creating a new runtime or promising unsupported sector features. Visual presets should remain associated with their package/version and license; don't count a color change as a different published theme.

The marketplace keeps one LetBuyy identity. Individual theme artwork supplies variety inside listing previews; it should not recolor the marketplace navigation or legal pages as users browse.

## 6. Legal and policy content specification

These are document/content requirements for review. They are not a declaration that every document is legally mandatory for every transaction or that drafts are in force. Applicability depends on the operator, merchant/buyer relationship, selling model, actual processing and launch date. Obtain qualified review for the binding text. Do not copy another provider's commercial terms.

| Document / destination | Content the review draft must address | Inputs or status |
| --- | --- | --- |
| Marketplace Terms | Contracting entity; service/account scope; theme purchase versus platform plan; permissible use; order/verification/delivery; roles and responsibilities; reviews/reports; suspension/removal; warranties/liability; dispute/contact and change process. | Existing `/legal/terms` is operational notes. Entity, jurisdiction and operative commercial terms are unconfirmed. |
| Privacy Notice | Audience and operator; actual data categories/sources/purposes; account/store/purchase/review/creator/support records; public profile/review visibility; recipients/processors and transfers; retention/deletion exceptions; security/contact; rights/request route; children/eligibility as applicable; changes/version/date. | Must follow the actual data inventory and approved retention rules. Do not say data is never shared or immediately erased without evidence. |
| Cookies and local storage | Storage inventory: key/provider, purpose, first/third party, lifetime/expiry/clearing, required versus optional, how choices work, how to withdraw, browser controls and links to privacy. | Missing dedicated notice. Existing preference dialog stores a record; actual optional-script gating was not found in the inspected app. A saved toggle is not a consent-management implementation. |
| Theme License | Free/paid scope; definition of permitted store/site/project use; client use and transfers; customization; redistribution/resale restrictions; ownership and included third-party asset licenses; duration/termination; updates/support boundaries; download format rights. | Existing license route does not determine concrete store limits or transfer rights. Those are owner/legal decisions. |
| Refund and Cancellation | Eligible purchases and grounds/exclusions; request method, evidence and review; approval versus payment execution; status/timing; duplicate/failed charges; mandatory rights; consequences for entitlement; contacts. | Refund request workflow exists. Do not invent a window, guarantee, “no refunds” rule, or execution SLA. |
| Digital Delivery and Downloads | When entitlement is issued; account/library versus standalone artifact delivery; supported formats; expiring links; unavailable packages; verification/checksum where supplied; access recovery and support. | Can be a substantial section of the purchase/refund documents rather than a redundant standalone page. Physical shipping boilerplate is inappropriate for theme files. |
| Support and Updates | Platform versus theme creator responsibility; supported channels/scope; prerequisites and evidence; customization limits; version support, compatibility/deprecation and recovery process; actual service levels if adopted. | Detailed support article/policy needed. No unverified response-time or lifetime-update promises. |
| Creator Submission Agreement | Eligibility and submission authority; original work and asset permissions; platform distribution/display license; accurate metadata; package safety; review/rejection/removal/appeal; support/updates; commercial/tax/payout terms only when approved; acceptance/version evidence. | Existing form requires an agreement checkbox without linking an actual agreement. A document and acceptance contract need coordination before public intake; do not open the programme by adding copy. |
| IP / Rights Complaint Notice | How to identify protected work and the offending listing; contact/evidence route; good-faith process; review, response/appeal and privacy treatment; actual operator contacts. | Use existing listing reports where appropriate; don't promise a takedown result or response deadline without policy and workflow. |
| Grievance and Legal Contact | Verified entity identity/address; relevant named contact/role and actual channels; complaint submission/acknowledgement/tracking/escalation appropriate to applicable law and operating process. | A generic mailbox is not proof of a named officer or implemented ticket tracking. |
| Accessibility Information | Known testing scope, supported assistance/contact, known limitations and change process. | Optional useful trust information; do not publish an absolute compliance statement without the required audit evidence. |
| DPA / processor list / security information | Data role, processing instructions, real suppliers/subprocessors, categories/location and security/contact facts when relevant to the service. | Conditional: align with the existing platform legal system and actual contracts; not a reason to create a parallel legal authority or publish a placeholder certification. |

Policies should include owner/reviewer, a document version, scope, revision date, an effective date only when actually effective, and links to related policies. Use clear titles, one readable article, a contents rail, stable section links, short plain-language summaries that do not replace the terms, and print-friendly presentation. A local review draft must be visibly distinct from an approved effective policy. Record acceptance of a specific version where required; a checkbox caption alone does not establish this.

### India-specific review inputs

The official [DPDP Rules gazette](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), rule 1, provides staggered commencement. As of this review, the notification places rule 4 one year after publication and most operational rules eighteen months after publication; do not describe every rule as already effective. The plain-language notice/contact requirements inform the data-purpose and rights/contact design. Check the applicable Act provisions, corrections and commencement before final legal wording.

The [2020 e-commerce rules](https://consumeraffairs.gov.in/public/upload/files/E%20commerce%20rules_1732703966.pdf) are an applicability-review input for operator identity, grievance handling and pre-purchase disclosures. Review the actual selling model and whether the merchant purchase qualifies under the relevant provisions rather than assuming all commercial template purchases are consumer transactions.

The department's [2026 amendment gazette](https://consumeraffairs.gov.in/public/upload/admin/cmsfiles/whatsnews/E_Commerce_Amendment_Rules_2026_2026-09-11_18-12-58.pdf) addresses, among other matters, ranking/sponsored disclosures, price-reduction presentation, seller information and complaints. The [official announcement](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=2&reg=48) states commencement on 1 January 2027. Distinguish current obligations from planned applicability. Do not add sponsored placements or discounts merely because disclosure rules exist, or display an audit certificate without the audit.

## 7. LetBuyy gaps confirmed in source

| ID | Evidence and current finding | Consequence / acceptance |
| --- | --- | --- |
| CONTENT-01 | Header/footer surface only a small portion of existing docs, account and creator destinations. | Expand grouped navigation while preserving routes and access guards; all major tasks should be findable without guessing a URL. |
| CONTENT-02 | `/docs`, `/support`, `/about`, `/contact` mostly contain short implementation-oriented cards. | Replace internal vocabulary with user tasks; add meaningful walkthroughs, troubleshooting, relevant examples and next actions. |
| LEGAL-01 | Existing privacy/terms/license/refund routes each have roughly four short operational sections through `PolicyDraftPage`. | They do not establish a complete final contractual/privacy suite. Build detailed review drafts with actual business inputs and clear status. |
| LEGAL-02 | Existing platform legal entity source deliberately leaves registered name, CIN/GSTIN, registered address, jurisdiction and named officer facts unfilled, with legal status draft. | Do not invent or copy illustrative values. Inspect for approved replacements before final publication. Do not import source from another app. Align policy ownership through canonical contracts when implemented. |
| LEGAL-03 | `developer-listing-builder-form.tsx` has a required `agreement_accepted` checkbox without a linked versioned document. | Before public creator intake, display the actual agreement and coordinate version/acceptance evidence through existing authority. No new public programme activation in this task. |
| PRIVACY-01 | `layout/footer.tsx` reads/writes `letbuyy_privacy_choices`; no consumer of those choices gating analytics/personalization was found in inspected theme-store source. | Current controls should not be presented as verified tracking enforcement. An actual supplier/script inventory and enforceable controls are needed before optional processing is represented as consent-controlled. |
| PRIVACY-02 | `theme-preference-actions.tsx` persists favorites/compare locally; shared theme provider uses `letbuyy-theme`; auth-core names the merchant session cookie `lb_session`. | Document purposes, scope and lifetimes accurately. Browser-local preferences do not imply server account sync. Verify configured session expiry and third-party/provider storage in the actual release, without exposing values. |
| DATA-01 | Local catalog currently contains one published theme; its Core 1.0.0 canonical sample responds with a not-ready message. | Do not decorate the marketplace with fake themes, reviews, sales counts, demos or compatibility claims. Data readiness is distinct from page completeness. |
| VISUAL-01 | Final responsive, keyboard and light/dark browser acceptance was explicitly deferred by the owner. | Automated checks and source references cannot certify the final visual experience; retain this gap until exercised. |

Source paths: `apps/frozen/theme-store/src/app/legal/*/page.tsx`, `src/components/policy-draft-page.tsx`, `src/components/layout/{navbar,footer}.tsx`, `src/components/developer-listing-builder-form.tsx`, `src/components/theme-preference-actions.tsx`, `packages/typescript/ui/src/theme-provider.tsx`, `packages/auth-core/src/index.ts`; existing platform context read from `apps/marketing/web/src/lib/legal/entity.ts` without modification or import.

## 8. Content-led visual system

- **Discovery:** compact introduction, visible search, image-led listings, restrained category links, real counts and useful sorting. Keep long educational and legal copy on its own routes so it doesn't bury the themes.
- **Cards:** show an actual theme screenshot, name, price, author/type and a short suitability statement. Limit repeated badges. Put secondary save/compare/quick-look controls in a predictable location with accessible names.
- **Detail:** prominent exact-version preview and add/buy action; sections for overview/included pages/features/customization/reviews/releases/support/license. Use a stable section navigation, clear hierarchy and a useful sidebar, not repeated giant hero blocks.
- **Guides:** title and outcome, prerequisites, linked contents, ordered tasks, concrete checklists, honest unavailable/error recovery, and related actions. Allow comfortable reading width; use panels for examples or consequences rather than a card around every paragraph.
- **FAQ/support:** group by choosing, purchase/ownership, setup, and aftercare. Search only if it actually returns relevant answers. Use the canonical accordion with keyboard/focus behavior. Keep support channels and scope visible outside disclosures.
- **Library:** data and actions lead; prioritize correct store, theme instance, installed/current version, current release and entitlement. Keep receipt, download and restore actions close to their record.
- **Legal:** simple readable document, document status/version/date, a contents rail on wide screens, anchor navigation on small screens, clear contact and policy cross-links. Avoid ornamental gradients, promotional copy, fake trust seals and excessive cards.
- **Shared identity:** existing LetBuyy wordmarks, Inter and canonical `--lb-*` surface/action/text tokens, Lucide icons and shared Modal/Drawer/Popover/Accordion. Theme thumbnails can have different aesthetics without changing the host identity.
- **Responsive rules:** desktop filters beside results; complete filter/sort Drawer on mobile; grouped mobile site navigation; no horizontal clipping of tables/contents; readable supporting text; visible focus and sufficiently sized controls. Reflow and actual keyboard use must be tested.

## 9. Content quality and acceptance

Every article must answer who it is for, what it achieves, what it needs, the steps, what changes, what does not establish success, how to recover, and the next useful action. Use LetBuyy terms consistently: theme, package version, preset, store library, theme instance, draft, published release, purchase/license and standalone download. Do not call all of these “template” or “installed” interchangeably.

Maintain seven substantial starter guides: choosing a theme; preview evaluation; add/install and publish; brand customization; pre-publication checklist; updates/rollback; pricing/licenses/downloads. FAQs should cover at least the real questions represented by these journeys, with links to their full explanation. Add examples from the actual theme type; a resume guide should not be a renamed commerce guide.

Acceptance scenarios:
1. A new visitor can find a suitable website type, refine results, compare actual themes and open a listing without losing the meaning of price or filter scope.
2. A visitor can tell whether a demo is public sample content, current/available and distinct from a store preview.
3. A purchaser can understand cost/license/support/delivery before commitment and find the appropriate existing purchase/download record afterward.
4. Adding a theme preserves the separate customization/preview/publication decision; a guide never implies that a public preview installed it.
5. A returning merchant can find the current store/theme/version and update or eligible rollback through the existing guarded workflow.
6. A creator can inspect requirements and the actual agreement before any acceptance/submission; draft/review/published states remain distinct.
7. A privacy/legal visitor can identify the operator and document status, understand the relevant data/use rights and reach a real contact/request route.
8. Unknown articles/listings have useful not-found recovery; service failure is not labeled as no inventory, no purchases, or a successful submission.
9. Internal links, metadata, sitemap entries, headings, contents anchors and protected return routes are verified. No dead links, unsupported promises, fabricated metrics, credentials or private tokens appear in content.
10. Browser acceptance later covers 360/414/768/1280 widths, light/dark, keyboard/overlay focus, enlarged text and realistic content. Automated tests remain evidence for their stated scope only.

## 10. Decisions and implementation order

**No further business input is needed to implement:** navigation/resource discovery, collections index using existing API data, original practical guides, fuller FAQs, about/help/contact content, readable document layouts, existing library links and a policy index showing the correct document status.

**Before binding commercial/legal publication, verify or obtain:** registered operator identity/address and applicable identifiers; actual grievance/privacy contacts; marketplace seller/licensor role; free/paid license scope including multi-store/client transfers; refund eligibility/window and execution commitments; support/update duration/limits; actual providers/data flows/retention; approved creator agreement and any commercial terms; effective dates and review ownership. These are explicit missing facts, not a request to block the independent UI/content work.

Order: (1) reconcile page map and approved facts; (2) connect navigation and detailed learning/support content; (3) finish each theme listing with real type-specific metadata/evidence; (4) prepare and review the legal suite and working privacy controls; (5) verify browse → evaluate → add/buy → manage → get-help plus alternate states. Remain within the current frozen source/local-preview authorization. No deployment, author-program activation, payment-policy decision or infrastructure expansion follows from this blueprint.
