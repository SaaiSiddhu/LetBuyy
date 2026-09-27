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
