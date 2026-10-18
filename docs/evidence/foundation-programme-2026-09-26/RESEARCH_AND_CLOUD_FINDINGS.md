# Research and cloud findings

Research date: 26 September 2026. Scope: current primary technical/provider/regulatory sources, restored repository evidence and limited read-only cloud access. Findings inform the [foundation programme](FOUNDATION_PROGRAMME.md); recommendations are not provisioning instructions or proof of legal/provider approval.

## 1. Evidence and confidence

| Evidence class | What was inspected | What it establishes |
|---|---|---|
| Current local source | Expected HEAD, governance/topology contracts, current directory route, identity decision packages and canonical consumers | Implemented code and intended contracts at this checkout; not hosted behavior |
| Earlier same-task runtime evidence | NewMacSetup restore, test, web and Android reports | The specific recorded local flows passed or failed at their recorded checkpoint; not full recertification today |
| Current public requests | API health, accounts, selected domain roots and Android association URLs | Observable responses from this machine/request context only |
| Provider account metadata | Wrangler whoami and Supabase project list | Available local authentication and visibility, not proof of all company accounts/resources |
| Current official documentation | Sources below | Provider/platform capabilities and published rules; not LetBuyy's eligibility, contract, provisioned plan or legal classification |

Sources were reviewed for planning, not an exhaustive code/security/legal audit. Some official legal PDFs were unavailable; those gaps are named below. No hosted database contents, customer records or secrets were fetched for this research. No cloud resource was created or changed.

## 2. Cloud reality versus repository contracts

The runtime topology file explicitly describes a governance contract. Production-looking names, declared worker resources and region labels in JSON are not evidence those resources exist or run the restored SHA. The deployment capacity values are not load-test results.

| Surface | Read-only observation | Consequence |
|---|---|---|
| Cloudflare CLI | Local Wrangler `whoami` reports unauthenticated | Account/resource/deployment history verification is unavailable with current CLI access. |
| Supabase CLI | Authenticated list contained two visible projects; neither name nor project reference matched restored LetBuyy | Do not operate on those projects or assume LetBuyy does not exist under another account. Obtain the correct project/account mapping. |
| Vercel | No inspected app-local `.vercel/project.json` links; no authenticated Vercel inventory performed | Treat hosted project mapping, deployment SHA, environment scope and plan as unknown. |
| API production and staging `/health` | Initial requests returned 200; follow-up requests with a different request context returned 403 | Some endpoints respond, but stable health and the reason for variance are unproved. Do not label WAF/auth as the cause without evidence. |
| Accounts production | Request reached `/lookup` with 200 | Identity entry surface responds; does not establish full sign-in or commit lineage. |
| Accounts staging | Request ended at Vercel login with 200 | Deployment protection response, not a passing identity-app smoke test. |
| Apex Android assetlinks | 308 to `www`; destination returned 404 | Current domain-association publication does not satisfy the intended proof. Prepare authorized hosting correction and reverify separately. |
| Checkout and webhook domains | DNS resolution failed from this machine | Report unresolved access/configuration; a single resolver result is not proof of universal nonexistence. |
| BFF root | 404 JSON | Root response does not establish BFF endpoint health. Test the actual supported authenticated route later. |

Safe records: [initial public probes](../../../../NewMacSetup/planning-public-cloud-probes.json), [follow-up details](../../../../NewMacSetup/planning-public-cloud-details.json), [Supabase metadata summary](../../../../NewMacSetup/planning-supabase-metadata-summary.json). Raw account CLI logs remain private under NewMacSetup/private and are not included in this deliverable. URLs containing authentication query parameters were redacted in the public summary.

### Required cloud inventory before any hosted execution

For each identity/gateway/queue/BFF/webhook/web app and owned data/media resource, record: verified account owner; project/resource identifier in private configuration; environment; region and processing constraints; domain/DNS ownership; actual deployment SHA or artifact; effective secrets/bindings by name only; access role; quota/plan; backup/recovery scope; observability; release and rollback procedure. Detect staging-to-production credential or resource reuse. Do not copy secrets into the evidence matrix.

Use the current approved topology. Keep Postgres the commerce/financial authority. Declared D1, KV, Durable Object, R2 and queue bindings require an actual-use review; their presence does not justify a second catalog/ledger database. Reserved service roots stay empty.

## 3. Technical research and resulting decisions

| Topic and primary source | Finding | LetBuyy consequence |
|---|---|---|
| [OAuth security BCP — RFC 9700](https://www.rfc-editor.org/info/rfc9700/) | Current OAuth security guidance includes exact redirect matching and PKCE protections. | F2.2 tests PKCE/replay/redirect/audience boundaries and avoids handing custom domains platform-wide credentials. |
| [PostgreSQL 17 row security](https://www.postgresql.org/docs/17/ddl-rowsecurity.html) | Owners normally bypass RLS; superusers/BYPASSRLS roles bypass it. | F2.7 must use actual runtime roles and tenant transaction context. Admin-only SQL tests cannot certify isolation. |
| [Android App Links verification](https://developer.android.com/training/app-links/verify-applinks) and [assetlinks configuration](https://developer.android.com/training/app-links/configure-assetlinks) | Domain association depends on hosted association and matching application/signing identity. Play signing identity may differ from local upload/debug keys. | Track intent routing, debug association and distribution signing association independently; preserve signing assets. |
| [Cloudflare Queue delivery guarantees](https://developers.cloudflare.com/queues/reference/delivery-guarantees/) | Delivery is at least once and ordering is not guaranteed. | Durable idempotency and legal state transitions belong in application/DB logic. Do not claim exactly-once transport. |
| [Queue retry configuration](https://developers.cloudflare.com/queues/configuration/batching-retries/) | Retries and dead-letter handling are explicit configuration concerns. | F8/F9 need retry-safe jobs, observable exhausted work and a controlled recovery path. |
| [Hyperdrive operation](https://developers.cloudflare.com/hyperdrive/concepts/how-hyperdrive-works/) | Transaction pooling changes connection reuse assumptions. | Verify tenant context and queries are in the same transaction; test alternating tenants under the actual deployed connection mode. |
| [Hyperdrive pool tuning](https://developers.cloudflare.com/hyperdrive/configuration/tune-connection-pool/) | Origin connection pool behavior and limits need explicit tuning. | Observe saturation and database capacity before choosing settings; topology concurrency numbers are not evidence. |
| [Workers placement](https://developers.cloudflare.com/workers/configuration/placement/) and [Workers data localization](https://developers.cloudflare.com/data-localization/how-to/workers/) | Placement and processing localization are different controls; locality labels alone do not establish residency. | Verify actual provider contract/configuration for data categories. Do not interpret `ap-south` in repo prose as global execution/residency proof. |
| [Vercel environments](https://vercel.com/docs/deployments/environments) and [deployment protection](https://vercel.com/docs/deployment-protection) | Environment scopes and protected deployments affect access and smoke results. | Explicitly inventory environment secrets and identify protection redirects before classifying app health. |
| [Supabase backups](https://supabase.com/docs/guides/platform/backups) | Database backups do not include Storage object bytes. | Recovery covers database, assets and necessary encryption/configuration material separately; test reconstruction rather than infer it from dump success. |
| [OWASP upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) | Uploads need content/size/access controls and safe storage handling. | F4 private documents and F7 reels share secure primitives while keeping different access and retention policies. |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | Accessibility covers interaction and comprehension as well as machine-checkable markup. | Propose AA for critical web journeys, plus native keyboard/TalkBack/text-scaling checks; no compliance claim based solely on automation. |
| [Core Web Vitals](https://web.dev/articles/vitals) | User-visible performance metrics complement infrastructure health. | Measure critical buyer/merchant pages on representative networks/devices; agree budgets using real baselines. |
| [Shopify theme architecture](https://shopify.dev/docs/storefronts/themes/architecture) | Layouts, templates, sections and blocks provide a useful Liquid reference. | Complete LetBuyy's existing theme contracts. This is not a promise of unrestricted Shopify theme compatibility. |
| [MRC standards](https://www.mediaratingcouncil.org/standards-and-guidelines) | Ad measurement and invalid-traffic standards distinguish measurement concepts. | Define billable events, validity and reconciliation explicitly; do not claim MRC accreditation or silently equate served with viewable. |

## 4. Media provider direction

**Recommendation for decision:** evaluate Cloudflare Stream as a managed-video adapter first because the architecture already uses Cloudflare and the required upload/encoding/playback capabilities are documented. This is not an account eligibility, cost or procurement decision. Keep asset ownership and review state in canonical Postgres so vendor processing never becomes approval authority.

[Stream overview](https://developers.cloudflare.com/stream/) documents managed encoding and delivery. [Direct creator uploads](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/) and [resumable uploads](https://developers.cloudflare.com/stream/uploading-videos/resumable-uploads/) support upload workflows worth validating on Android. [Securing Stream](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/) informs private delivery. F7 still needs signature validation, quotas, abuse controls, immutable revision binding and tested revocation. A signed URL does not erase already buffered/downloaded content; measure the residual access window.

R2/object storage alone is not a managed adaptive-video processing pipeline. Retaining legacy external links as a shortcut would preserve the current approval gap. Before selection, measure: upload success/retry, time to playable, low-bandwidth startup, seek/rebuffer behavior, supported client integration, regional processing obligations, takedown propagation, export/recovery and cost. Do not create `services/media-service` to perform this evaluation.

## 5. Payments, provider eligibility and regulation

| Source | Finding and planning effect |
|---|---|
| [Razorpay Route](https://razorpay.com/docs/payments/route/) | Documents linked-account transfers and settlement/refund capabilities, but also published eligibility restrictions. The inspected page refers to domestic turnover above ₹40 lakh or exports above ₹5 lakh and contains FY26/FY25 wording. Treat this as provider documentation requiring current written confirmation, not a determination of LetBuyy's eligibility or a universal legal threshold. Establish eligibility in F3.3 before depending on this product. |
| [Cashfree Easy Split](https://www.cashfree.com/docs/api-reference/payments/latest/split/easy-split-overview) | Documents vendor split/settlement APIs as another provider path. It does not establish LetBuyy onboarding approval, lower eligibility barriers or a guaranteed weekly schedule. Compare actual contracts and existing adapters before selecting. |
| [RBI Payment Aggregator Directions, 2025](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896) | The September 2025 directions define the regulated activity and call for clear contractual allocation of refund, failed-transaction, grievance and reconciliation responsibilities. Preserve provider-managed fund flow and obtain entity-specific legal/provider confirmation. Do not assume a marketplace automatically becomes an authorized PA, or that software design alone establishes compliance. |

The provider decision record must cover seller/entity eligibility, required documents, bank verification, supported multi-seller flow, settlement schedule/holds, partial refunds, chargebacks, COD scope, fee allocation, sandbox parity, reconciliation exports and operational contacts. The user's weekly eligible settlement policy stays; if an approved provider cannot implement it, surface the contract conflict. Never solve it by LetBuyy collecting and holding merchant money outside the approved arrangement.

No current payment credentials or provider approval were verified by this research. No production payments were activated. Pricing and commercial terms need dated written quotes; this programme invents no provider fees.

## 6. India-specific obligations and source limits

These are engineering applicability checks, not legal sign-off. Use a maintained matrix with entity/category/channel, effective date, source version, required data/UI behavior and review owner. Avoid collecting every possible document from every storefront merchant.

- **Privacy:** [MeitY final DPDP Rules publication](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit) and the [commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf) establish staggered commencement. Implement a reviewed effective-date calendar; do not treat all future obligations as already effective or rely on draft-rule summaries. F2/F3 cover notices, purpose, consent, access/deletion, retention and incident responsibilities.
- **Consumer and advertising:** an [official September 2026 announcement](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532) describes January 2027 changes involving e-commerce transparency and sponsored content. The exact amended Gazette text was not successfully retrieved in this pass. Obtain it before final applicability decisions; meanwhile reserve versioned disclosure/ranking/price-history capabilities rather than certify compliance from a press release.
- **Country of origin and packaged goods:** the earlier commerce research identified 2026 Legal Metrology changes. The [official PDF](https://consumeraffairs.gov.in/public/upload/files/2026.02.13%20PCR%201st%20COO%20Filter%20on%20e-commerce%20websites_1771231030.pdf) could not be reopened in this pass. Retain the catalog/origin-filter work and revalidate exact applicability/date during F3.4. Do not silently downgrade this requirement because retrieval failed.
- **GST and withholding:** current entity/category/geographic and tax-year applicability needs CA-backed primary-source verification before implementation values are activated. This document deliberately fixes no rate or blanket rule for GST-registered, composition or eligible unregistered sellers.
- **Food, regulated products and synthetic media:** carry forward the original research's FSSAI/BIS/content-policy questions, then verify rules for the selected launch categories. No full category compliance audit or legal classification of the reel service was completed here. Category restrictions fail closed until the applicable requirements are resolved.

## 7. Cost and capacity planning without invented numbers

Use approved 100 → 1,000 → 10,000 merchant scope, but size each workload independently. The old order-volume estimate cannot size video delivery or ad telemetry.

| Cost/capacity driver | Inputs to collect | Decision it informs |
|---|---|---|
| Video | Upload minutes/day, retained minutes, watched minutes, rendition/export needs, abusive upload rate | Managed video quote, quota and retention limits |
| Database | Peak transactions/connections, catalog size, order/ledger growth, read plans, backup volume | Compute/pool settings, query optimization and recovery plan |
| Async work | Jobs per order/upload/campaign, retry amplification, oldest queue age | Queue limits, batching, alarms and operator workload |
| Web/API | Requests by route, cacheable share, function CPU/duration, origin traffic | Provider quotas and buyer performance budget |
| Ads | Raw/validated event volume, attribution delay, retention and reporting latency | Event storage/rollups and billing reconciliation |
| Operations | Seller applications, product/reel reviews, appeals and complaints per day | Staffing, review promises and merchant rollout pace |
| Payments | Provider fees, refund/chargeback costs, settlement terms and tax treatment | Disclosed economics and minimum sustainable plans |

Calculate scenario costs from current quotes and measured units, adding explicit uncertainty rather than one unsupported monthly budget. Select restore objectives against tolerable data loss/downtime and prove them with a drill. No paid plan upgrade or provider purchase is authorized by this document.

## Research conclusions

Complete the current canonical systems. Establish identity/tenant correctness before broadening access. Resolve provider eligibility and cloud ownership early. Build moderation and versioned eligibility before feeding ads and checkout. Keep recovery tied to money and media reality. Require device/provider/hosted evidence separately, and retain failures in the release packet.

## 8. Regulatory source refresh — 4 October 2026

This dated refresh supersedes any implication in earlier research that the 2020
Consumer Protection (E-Commerce) Rules are the only currently published
baseline. It records implementation inputs, not a legal opinion, launch
category approval or professional tax advice.

| Question | Current primary source | Established fact and implementation consequence | Confidence / open dependency |
|---|---|---|---|
| What e-commerce obligations change next? | Department of Consumer Affairs' [official 2026 amendment listing](https://consumeraffairs.gov.in/pages/consumer-protection-acts) and the Government's [10 September 2026 PIB release](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532); Gazette identifier G.S.R. 789(E), 9 September 2026, [official eGazette PDF](https://egazette.gov.in/WriteReadData/2026/276125.pdf) | The rules take effect 1 January 2027. Rule 4(6) restates the existing duty to mention the importer’s name/details for imported goods or services and adds identification/full country-of-origin name for goods imported into India. Other provisions cover NCH convergence, grievance-copy/timelines, non-misleading search results, sponsored disclosure, 30-day lowest prior-price display, annual dark-pattern self-audit/certificate, seller/product disclosures, specified marketplace data-use consent and limits on unrelated bundled fees. | The Department index lists the amendment and Gazette identifier, but the PDF was not readable in the research browser; clause text was cross-checked against a machine-readable Gazette transcription and the official 2020 Rules PDF. This is not direct PDF verification or legal advice. Counsel must confirm entity/channel/product scope, importer particulars and implementation responsibility before mandatory enforcement. |
| When must imported-product country of origin be searchable/sortable? | Gazette G.S.R. 312(E), 27 April 2026, [Legal Metrology (Packaged Commodities) Second Amendment Rules, 2026](https://egazette.gov.in/WriteReadData/2026/272105.pdf) | Rule 6(10A) requires an e-commerce entity offering an imported product to ensure the listing has a searchable/sortable country-of-origin filter with effect from 1 July 2027. That is separate from the Consumer Protection Amendment's 1 January 2027 importer/origin disclosure date. | The official Gazette endpoint identifies the amendment and date. Counsel should confirm entity/channel scope and how the filter applies to LetBuyy's seller storefronts and marketplace. Phase 5 tracks the filter separately from importer disclosure. |
| How does the amendment affect product work? | Same government release, above | F3.5/F5/F10 need a versioned disclosure and policy contract: retain 30-day reference-price evidence before claiming a reduction; label sponsored products clearly; document principal ranking parameters; attach seller and product disclosures; route grievances/NCH integration; prove dark-pattern review and certificate generation. Consent scope for marketplace data use and bundled-fee treatment must be represented in subscription/ad contracts. | Engineering consequence is clear; exact field wording, applicable entities, exceptions and required NCH integration mechanism require Gazette/legal review and owner-approved policy. No rule is activated by this research note. |
| When do DPDP statutory and rules obligations commence? | MeitY's [13 November 2025 Act commencement notification G.S.R. 843(E)](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [Digital Personal Data Protection Rules, 2025 G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf), and [official rules index](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit) | The Act notification puts listed institutional/interpretive provisions into force on publication, sections 6(9) and 27(1)(d) after one year (13 November 2026), and the main processing, notice, consent and data-principal-rights provisions after 18 months (13 May 2027). Rules 1, 2 and 17–21 commenced on publication; Rule 4 is scheduled one year after publication of the rules Gazette (13 November 2026); Rules 3, 5–16, 22–23 are scheduled 18 months after it (13 May 2027). | Dates read directly from the official notifications; verify the listed December 2025 corrigendum before final clause-level compliance mapping. These dates do not remove duties under other current laws. |
| What Section 52 TCS rate is notified? | CGST Act [Section 52](https://cbic-gst.gov.in/hindi/CGST-bill-e.html); GST Council-hosted [Notification 15/2024-Central Tax](https://www.gstcouncil.gov.in/sites/default/files/2024-09/central-tax-15-2024-11072024.pdf); official [53rd GST Council record](https://www.gstcouncil.gov.in/node/5061) | For qualifying intra-State Section 52 supplies, Notification 15/2024 changes the Central component to 0.25% from 10 July 2024; corresponding notification changes set 0.25% State/UT component and 0.5% integrated component for qualifying inter-State supplies. Section 52 is limited to the statutory net taxable supplies by other suppliers where consideration is collected by the operator; this is a tax collection/remittance obligation, not LetBuyy's commission. Preserve supplier returns/adjustments and statutory reporting separately from commercial commission. | Notification content/effective date: high confidence. Qualification, registration, 9(5), supplier type, geography and LetBuyy's own contracting/fund-flow facts remain CA/provider questions; never apply the rate universally to every marketplace order. |

### Phase 3 engineering consequences

1. F3.5/F5/F10 should include effective-dated price observations sufficient to
   calculate the lowest offered price across the preceding 30 days, plus the
   displayed reference-price provenance. A current `compare_at_price` field
   alone does not prove that history.
2. Sponsored disclosure and ranking-explanation work must be implemented with
   the product/advertising surfaces, not only in a policy page. The 2027
   effective date supports completing and testing the contracts before
   activation; it does not authorize premature claims of legal compliance.
3. Grievance state must preserve the exact complaint copy and its delivery,
   keep operator/internal notes separate, and define the NCH convergence
   dependency. Existing support resolution is not statutory fulfillment proof.
4. Tax configuration must distinguish GST TCS, any section 9(5) liability,
   seller output tax, withholding, payment-provider reserve/hold, platform fee
   and seller settlement. The 2018 CBIC FAQ's 1% total TCS answer is stale for
   the post-10-July-2024 notified rate; no rate is copied into product code by
   this document.
5. Review the December 2025 DPDP Rules corrigendum and current category-specific
   laws before freezing retention, consumer notices or product eligibility.

### Price-history implementation checkpoint — 4 October 2026

Migration `270_product_price_observations.sql` adds append-only product and
variant price observations. Existing rows receive a baseline at migration
time; generic `updated_at` values are not used to manufacture earlier price
history. Price writes store the lowest observed price from the preceding 30
days on the new observation before that new price is appended, and mark the
reference complete only when a boundary observation proves the full window.
The service-role-only reference RPC also recomputes the rolling window at read
time, so an unchanged price does not retain a stale discount reference as days
pass. Shared API Gateway storefront hydration, product detail/list/by-ID
responses, the marketplace feed and its listing-detail route now attach this
evidence to product and variant views, and use the complete prior low as the
public compare price only when it is above the current price. Incomplete
windows therefore do not create sale claims. A shared recursive projection
also removes merchant-only fields from product list and cart-oriented by-ID
responses. Store reassignment begins a fresh variant observation window. The
paired rollback and an owned Postgres test cover the write triggers, baseline
boundary, rolling reference, reassignment, and database grants; focused worker
and unit tests cover public projections and marketplace fallbacks.

Validation so far: `pnpm run validate:migrations` and `git diff --check` pass.
The owned Postgres test has not executed its assertions: its required runner
cannot start because this host has no reachable Docker daemon. Commerce maps
the API's `compare_price` into its existing product view model, but a browser
journey remains unverified. The history currently records price writes, not
channel publication or offer-availability intervals; confirm the applicable
offer scope and model those boundaries before using this as compliance proof.
No hosted migration or production data was changed. This is an implementation
checkpoint, not a phase acceptance or a legal-compliance claim.

No cloud account, provider agreement, legal counsel review, price schedule or
production configuration was accessed or changed in this refresh.

### Provider eligibility and live-split configuration gate — 4 October 2026

Fresh official-source review of Razorpay Route, Cashfree Easy Split and RBI's
2025 PA Master Direction found two independent uncertainties that credentials
do not answer: provider-specific onboarding/eligibility, and whether LetBuyy's
contracting/funds-flow model is a PA, marketplace, or relies on a PA merchant
relationship. Razorpay's published Route page currently specifies turnover
evidence and a provider-reviewed payer-payee transparency declaration. Cashfree's
Easy Split documentation describes vendor split, configurable settlement,
refund-adjustment and reconciliation APIs, but makes no LetBuyy account
eligibility or weekly-cycle commitment. The RBI direction distinguishes PA from
PG and says PAs aggregate only for contract merchants and cannot themselves
carry out marketplace business. This needs counsel and provider confirmation
against LetBuyy's actual entity and seller model.

The live Razorpay Route settlement/payout paths now require a provider-specific
approval reference in addition to the existing credentials and provider-mode
gates. The reference is a non-secret opaque evidence pointer and its syntax
check is not substantive approval. Cashfree Easy Split live ingest remains
unavailable because the current settlement-to-payout path has no Cashfree
execution/reconciliation adapter; this prevents a Cashfree settlement from
falling through into a Razorpay Route payout. Sandbox mode is unchanged; no
reference or hosted configuration was set. See [the dated Phase 3.3 checkpoint](F3_PROVIDER_ELIGIBILITY_2026-10-04.md)
for sources, exact checks and remaining business/provider questions. No provider
request or funds movement occurred.

As a separate Phase 8 safeguard, the hosted checkout Gateway rejects Razorpay
payment-intent requests for marketplace-origin carts before its idempotent step.
The storefront Razorpay path creates a pending order before reaching the
provider; the marketplace guard prevents that side effect while D08 remains
unresolved. Owned Postgres verifies the denied path leaves the checkout at
`delivery`, with an empty payment intent and no additional order. Marketplace
COD and storefront payment behavior are unchanged. See the [Phase 8.2 record](F8_MARKETPLACE_ORDER_BINDING_2026-10-04.md).

### Channel availability follow-up — 4 October 2026

The implementation review found that migration 270 treated every product-price
write as an offered price. That is insufficient when a product is inactive or a
marketplace listing is pending, paused, hidden or delisted. Migration
`271_channel_scoped_offer_price_history.sql` now separates historical 270 rows
as `unscoped`, records storefront and marketplace price snapshots independently,
and captures the visibility transitions already enforced by the public reads:

- Storefront: active, undeleted product on a published, undeleted site.
- Marketplace: the same product/site predicates plus an approved, public
  `marketplace` channel listing.

Price edits, product active/deleted/site changes, listing status/visibility/
channel changes and removal, and site publication changes append snapshots. A fresh migration-time
baseline begins the supported observation window; it does not convert the
unscoped 270 history into public-offer evidence. The marketplace detail API now
queries marketplace-scoped evidence, while storefront reads use the storefront
scope. Store reassignment is filtered by the product's current site in the
reference query.

Local verification on the working tree: migration-safety validator passed,
`git diff --check` passed, gateway typecheck passed, and 18 focused unit tests
passed across public marketplace detail, public price projection, and customer
session telemetry/malformed-cookie suites. The new real-Postgres availability assertions are in
`services/api-gateway/src/__tests__/owned-db/product-price-observations.postgres.test.ts`,
but they have not executed because this host has no reachable Docker daemon.
Thus database trigger execution remains unverified. Commerce browser behavior,
legal applicability and clause-level Gazette review also remain unverified;
this engineering record is not a compliance certification. No hosted migration
or production data was changed.

### Owned PostgreSQL correction — 4 October 2026

The previously pending `product-price-observations.postgres` acceptance now passes **4/4** on
runner-owned Postgres 16 (`20acca71ae56`). The first execution exposed an overlong synthetic tenant
tag; after shortening it, the privilege assertions found that the Supabase-faithful bootstrap's
default `service_role` table grant had not been revoked by migration 270. Migration 270 now revokes
all table privileges from `service_role` before granting only `SELECT`. The test explicitly checks
that `service_role` can read but cannot write, and that `anon`, `authenticated` and `app_tenant`
cannot read or write the observation rows.

The same run exposed a stale fixture that directly created an approved listing, bypassing the current
draft → pending review → assigned reviewer → approved flow. The fixture now uses the production
revision-bound transitions and preserves the rule that a material product edit withdraws a prior
approval. Database checks cover product/variant writes, honest incomplete history, availability
boundaries, deleted/reassigned listings, rolling 30-day reference math, and role privileges. The
Gateway public projection tests pass 4/4, Commerce mapping tests pass 2/2, both package typechecks
pass, migration-safety validation passes, and `git diff --check` passes. This is owned local database
evidence; live storefront browser display, legal applicability and official Gazette clause review
remain open. No hosted database was changed.

### Official-source retrieval check — 4 October 2026

The Department's current [Consumer Protection Acts index](https://consumeraffairs.gov.in/pages/consumer-protection-acts)
and [latest-news listing](https://consumeraffairs.gov.in/pages/latest-news) now
list the 2026 E-Commerce Amendment Rules and the Gazette identifier is
G.S.R. 789(E), 9 September 2026. The Government's [PIB release dated 10
September](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532)
states that, where a price reduction is announced, both reduced and prior price
must be shown, and defines prior price as the lowest price goods or services
were offered during the preceding 30 days; it states commencement on 1 January
2027. The official department listing reports a 1.36 MB notification PDF, but
the government-site page returned 502 during this retrieval and the eGazette
PDF was inaccessible to the research browser. Therefore the PIB summary confirms
the headline timing and definition, but exact clause text, exceptions and
LetBuyy's legal applicability still require the Gazette document and counsel
review. Engineering tracks public offer channel and availability; it does not
make those legal determinations.

### Government summary refresh — 4 October 2026

The Department's [current Consumer Protection Acts index](https://consumeraffairs.gov.in/pages/consumer-protection-acts)
lists the 2026 amendment, and the Government's directly accessible [PIB release
published 10 September 2026](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=1&reg=48)
provides a fuller official summary. It states that the rules commence on 1 January 2027 and
summarizes requirements concerning NCH convergence, giving complainants a copy of their recorded
complaint, non-misleading search results, prominent sponsored-listing disclosure, prior-price
display using the lowest offer in the preceding 30 days, annual dark-pattern self-audit and
certificate, seller/product disclosures, express affirmative consent for specified marketplace
uses of consumer information, limits on unrelated bundled fees (with a stated loyalty/membership
exception), and importer plus country-of-origin disclosure for imported goods.

This cross-check upgrades confidence in the Government's headline summary and effective date,
but does not replace review of Gazette G.S.R. 789(E) or legal advice. The official Department page
lists a 1.36 MB notification PDF; direct government PDF retrieval still fails in the current
research environment. Consequently the exceptions, scope and exact clause wording are not frozen
as executable law. Engineering consequences are to keep price history, paid-placement labels,
ranking explanations, grievance-copy records, seller disclosures, scoped consent and bundled-fee
configuration versioned and effective-dated. Counsel and product owners must resolve applicability
and user-facing language before activating compliance gates; no new fee or consent behavior is
inferred here.

### Primary-source retrieval recheck — 4 October 2026

The official Department index and latest-news search listings were rechecked and
both identify the Consumer Protection (E-Commerce) (Amendment) Rules, 2026; the
latest-news listing reports a 1.36 MB PDF dated 11 September. The official PIB
release is directly readable and confirms the 1 January 2027 commencement and
high-level subjects recorded above. The Gazette file at
[`G.S.R. 789(E), 9 September 2026`](https://egazette.gov.in/WriteReadData/2026/276125.pdf)
still returned no readable PDF content in either the web retrieval tool or the
in-app browser. This is a retrieval limitation, not evidence that the Gazette is
missing. The Department's file listing confirms that an official document is
published, but does not expose its clauses in the accessible page result. Keep
clause-level statements from the machine-readable transcription provisional;
exact text, exceptions and LetBuyy applicability remain unverified pending a
readable official copy and counsel review. No compliance behavior is activated
by this source check.

### Storefront acceptance correction — 4 October 2026

The earlier pending-browser statement above is superseded for the bounded reference-price storefront
slice. The real local Gateway, owned Postgres 16 and Chromium journey now pass: price history 4/4
and the integrated Commerce/Identity browser suite 11/11. The browser rendered the product at
₹120/reference ₹150, Small at ₹110/reference ₹150, and Large at ₹160/reference ₹200; the seller's
₹999 compare-at fixture was not exposed. This evidence is local-only and does not establish legal
applicability, provider eligibility, cloud ownership, hosted migration or release readiness. The
official Gazette PDF and counsel review remain outstanding; see the detailed [F3 evidence](F3_PUBLIC_REFERENCE_PRICE_STOREFRONT_INTEGRATION_2026-10-04.md).

### Gazette text comparison — 4 October 2026

The direct official eGazette PDF remains unreadable in the current web tool and only exposes a blank
PDF page in the in-app browser. I opened the independent [Gazette Tracker transcription of
G.S.R. 789(E)](https://www.gazettetracker.com/g/CG-DL-E-10092026-276125); its full-text transcript
is now available for a clause-by-clause comparison, but it is secondary and is not treated as the
legal source. Its issue date, notification number, 1 January 2027 commencement, and summary topics
agree with the directly readable Government [PIB release](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=1&reg=48),
which is still a press summary rather than the operative notification.

The transcript adds implementation-relevant details absent from that summary: prominent entity
identity/contact disclosures; grievance acknowledgement within 48 hours, a copy of the complaint
as recorded, and redress within one month; importer details and complete country-of-origin naming;
seller names on invoices at the same font size as the e-commerce entity name; an explanation of
principal ranking parameters in descending order and their relative importance; specified limits on
marketplace use of consumer information with express affirmative consent; unrelated bundled-fee
limits and the loyalty/membership exception; seller-supplied product disclosures and Government
identification numbers including GSTIN/MSME registration; and seller details available on a written
post-purchase request. These are provisional transcript findings, not a legal applicability
determination.

Implementation consequence: preserve these as dated candidate contract requirements for F3.5 and
the affected F4/F5/F8/F10 surfaces; keep effective-date and applicability gates explicit. Do not
activate new enforcement or infer a universal seller identifier requirement from the transcript.
Exact operative wording, exceptions, entity/channel scope and counsel interpretation still require
the official Gazette text and professional review. This recheck changes the engineering discovery
list, not the accepted policy or release state.

### Official Gazette text verified — 5 October 2026

The retrieval limitation above is superseded for source-text verification: the official [eGazette
PDF, G.S.R. 789(E)](https://egazette.gov.in/WriteReadData/2026/276125.pdf) was fetched directly from
the government endpoint. Its seven-page PDF metadata and notification particulars were checked;
pages 5–7 were rendered and visually read against extracted text. It is dated 9 September 2026 and
commences 1 January 2027. This verifies the primary text, not the legal interpretation or
LetBuyy's scope. No compliance switch, legal conclusion, or publication block follows from this
source check.

The operative text confirms these engineering-relevant requirements and boundaries:

| Provision | Exact-text finding relevant to LetBuyy | Existing surface / implementation consequence | Still requires |
|---|---|---|---|
| Rule 3(1)(j) | “Ranking” concerns relative prominence or relevance of sellers or goods/services on a marketplace, regardless of technology. | F10 discovery/search/sponsored ranking; document each active factor and its role. | Entity/channel scope and counsel interpretation. |
| Rule 4(2), (5)–(7) | Entity identity/contact details; grievance acknowledgement within 48 hours, complaint copy as recorded, redress within one month; imported-goods/services importer details and full country name for goods imported into India; participation in National Consumer Helpline convergence. | The signed-buyer account support flow now returns and displays the persisted complaint copy/reference, backed by an atomic ticket-plus-first-message write; importer/origin fields also flow to buyer surfaces. Local UI/API acceptance does not establish officer acknowledgement, response SLA, resolution or NCH integration. | Complaint ownership, staffed SLA, evidence of officer acknowledgement/redress, NCH integration mechanism, importer data responsibilities, applicability. |
| Rule 4(11)(c), (12)–(15) | Search/indexes must not mislead; sponsored listings need distinct clear/prominent disclosure; a reduction displays prior and reduced prices, where prior is the lowest price during the 30 days before announcement; seller name on invoice at equal font size to entity name; Rule 4(15) requires compliance with the 2023 Dark Patterns Guidelines, yearly self-audit and prominent certificate. | F3 price-history/storefront implementation is locally accepted; F10 needs paid placement and ranking disclosures; invoice and dark-pattern evidence/certificate remain to be mapped. | Counsel review of entity/channel scope and practice; product/owner decisions on control language and audit evidence. |
| Rule 5(3)(a), (c), (f) | Seller details and pre-purchase disclosures; prescribed returns/refunds/etc. information; principal ranking parameters in descending significance and relative importance, plainly/publicly described. | F5 listing/product details, F8 returns, F10 ranking explanations. | Seller/onboarding validation rules and policy content. |
| Rule 5(6), (7) | Specified marketplace use of consumer information requires express affirmative consent; unrelated bundled fees are limited with a loyalty/membership exception. | F3.5 consent purpose/version seams and subscription/ad contract surfaces. | Counsel-defined purposes and exceptions; product-owner-approved fee/consent policy. |
| Rule 6(5)(d), (j); Rule 7(1)(a) | Seller disclosure duties include origin, relevant product/price/fulfillment terms and Government-issued identifiers including GSTIN/MSME registration; Rule 7 retains accurate disclosures for inventory sellers. | F5 already carries seller-entered origin/importer fields, without treating free text as verified proof; seller and inventory disclosures need a complete field/control map. | Applicability and verification/source-of-truth policy; existing legal-metrology date remains distinct. |

Exact-text review also confirms that Rule 4(6) restates importer name/details where the platform offers imported goods or services; it requires full country-of-origin name for goods imported into India. The existing [F5 importer checkpoint](F5_IMPORTER_DISCLOSURE_2026-10-04.md#5-october-official-gazette-confirmation) records the distinction and does not treat the seller-entered field as verified.

Immediate engineering follow-up: map provisions to actual consumer, merchant, operator, invoice,
search and ad surfaces, assigning an owner and evidence source to each control. The bounded F3.5
buyer intake now provides an atomic persisted complaint receipt and browser conversation; operational
acknowledgement/redress and NCH convergence are separate journeys and remain open.
Do not activate mandatory seller fields, consent gates, fees, release blocks or public legal claims
until counsel and the product owner settle scope and policy.

### Razorpay Route direct-transfer retry contract — 5 October 2026

The current [Razorpay Route Direct Transfers API reference](https://razorpay.com/docs/api/payments/route/direct-transfers-idempotent-request/)
documents `POST /v1/transfers` with the `X-Transfer-Idempotency` header. It
limits the key to 4–36 characters from letters, digits, hyphens, underscores or
spaces; an idempotent retry must use the same key and identical payload. The
page specifically says this capability applies only to Direct Transfers; when
the provider reports that the same-key request is still processing (409), the
caller may retry with the same key. The [Direct Transfer parameter reference](https://razorpay.com/docs/api/payments/route/direct-transfers/)
documents account, amount, currency and optional notes; it does not list
`reference_id` as a request parameter. The [Route overview](https://razorpay.com/docs/api/payments/route/)
distinguishes direct transfers from payment/order-sourced transfers.

The adapter previously used a generic `Idempotency-Key`, passed the application
key through unchanged (including values outside Route's length/character
contract), and sent undocumented `reference_id`. It also converted all
non-2xx responses to a definitive `failed` status, although 409 means the
original idempotent transfer may still be in progress. The implementation now
derives a stable provider-safe key from tenant + statement + application claim,
sends it in the documented header, holds the same request body on retry, omits
the unsupported request field, and leaves 409/429/5xx responses in `processing`
so the same durable claim can retry. This is public API contract alignment and
local stub evidence only; it does not establish LetBuyy's account enablement,
contract, Route permissions, or sandbox/live provider acceptance.
