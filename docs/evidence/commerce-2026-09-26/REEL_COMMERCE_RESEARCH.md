# LetBuyy reel commerce and progressive merchant verification

Research date: 2026-09-26 (India). Repository inspected: develop at 6eb01d95.

Status: research and proposed implementation direction, not a compliance certification or completed implementation. Public official sources and selected source-code paths were inspected; no authenticated seller portal or hosted LetBuyy dashboard was inspected. No behavioral tests were rerun. Local intelligence service on localhost:3334 was unavailable, so targeted source inspection was used. Commercial/legal applicability must be checked against LetBuyy's actual contracts, launch categories and effective law before activation.

Companion: [11-phase roadmap](./COMMERCE_11_PHASE_ROADMAP.md).

## 1. Owner decisions preserved from this conversation

- V1 is storefront plus a **reel-led marketplace**. Quick commerce is V2.
- One identity platform and shared buyer identity; storefront order visibility is store-scoped, marketplace visibility spans the buyer's marketplace purchases.
- Storefront has zero LetBuyy sales commission; marketplace has category-based commission.
- Marketplace checkout is LetBuyy-managed through a licensed payment provider, with weekly eligible seller settlements. LetBuyy does not custody funds.
- Storefront-only onboarding should collect basic necessary verification details. Marketplace activation requires deeper personal/business verification.
- Every marketplace product needs LetBuyy admin approval. An attached reel must also be reviewed for consistency with that product. Rejection must provide a useful explanation.
- Separate advertising credits and CPC, CPM and purchase-based billing are in scope.

These are owner requirements, not assertions that the features already work. Existing global zero-commission governance conflicts with the revised marketplace model. Record the narrowly scoped amendment and update relevant validators during implementation; do not weaken storefront zero-commission or no-custody rules. Do not rewrite historical migrations or invent an ARB signature.

## 2. Findings in the existing repository

| Existing source | Finding | Consequence |
|---|---|---|
| `services/api-gateway/src/routes/onboarding.ts` | Progress records channels, category and new/existing business; this is not a complete legal-entity verification model. | Extend the existing onboarding journey rather than build a second merchant app. |
| `services/api-gateway/src/routes/kyc.ts` | Fixed document checklist: business PAN, bank proof and address proof; GST optional. Status aggregated from document statuses. | Requirements need channel, entity type, tax status, category and provider context. |
| `packages/infrastructure/kyc-verification-adapter/index.ts` | Sandbox can return verified based on evidence presence. Automated live mode throws unavailable; manual mode returns needs_review. | Sandbox verification must never unlock real marketplace selling or real payouts. A working live/manual decision path still needs proof. |
| `services/api-gateway/src/routes/channel-listings.ts` and migration 217 | Draft/review/approval/rejection/pause/delist model, tenant transactions, idempotent transition RPC, append-only moderation events. | Reuse this canonical product-channel approval foundation. |
| `services/api-gateway/src/routes/operations/marketplace-listings.ts` | Operator permissions, approve/reject/take-down endpoints, rejection reasons and audit records. | Extend the existing internal console, not a new moderation runtime. |
| `apps/internal/console/src/app/(dashboard)/marketplace-listings/page.tsx` | Existing listing-review UI. | Add version comparisons, evidence and reel review here. |
| `database/supabase/migrations/217_marketplace_channel_listings.sql` | Organic feed checks approved/public marketplace listing and active product/published site, then reads current product values. | Approval of an immutable product revision is not established by this query. Material edits need explicit re-review behavior. |
| `database/supabase/migrations/240_sponsored_feed_serving_predicate.sql` | Sponsored feed checks product/site and campaign budget, but has no approved channel-listing join. | Paid discovery must enforce the same marketplace eligibility as organic discovery. This is a static predicate gap, not a reproduced live incident. |
| `packages/dart/marketplace_services/lib/src/reel_service.dart` | Firebase/Storage service; uploads start pending, but external links are assigned active with the comment “External links skip moderation.” | External-link bypass conflicts with the new requirement. Canonical replacement must not preserve it. |
| `apps/marketplace/mobile/lib/screens/reels/reels_feed_screen.dart` | Imports the legacy ReelService. | Reel UI exists, but canonical backend convergence is unfinished. |
| `packages/dart/marketplace_models/lib/src/reel_model.dart` | Reel/product link, moderation note and cached product price are present. | Reuse UX intent; price and availability must come from current canonical commerce data. |

No canonical reel-review implementation was found in the gateway routes inspected. This is scoped source evidence, not a claim to have exhaustively proved absence across every file or deployment.

## 3. What the comparison platforms establish

**Amazon India:** onboarding covers tax details, pickup, bank and listings. Its catalog distinguishes matching an existing product from creating a new product; some categories require approval. This is not evidence that a human physically checks every item. [Seller onboarding](https://sell.amazon.in/sell-online/seller-registration-guide), [catalog and category approval](https://sell.amazon.in/sell-online/list-your-products).

**Amazon video benchmark:** its US seller guidance associates videos with ASINs and variations, reviews submissions, and exposes rejection reasons. Use that workflow as a design reference, not as proof of India-specific eligibility or limits. [Official video guidance](https://sell.amazon.com/blog/amazon-product-video).

**Flipkart:** its official seller resources identify listing QC, failed-QC correction, brand/vertical approval and legal-metrology topics. Its public video-commerce description includes short-form Vibes, search video and product-page video. It does not disclose enough to reproduce its internal review or ranking algorithms. [Seller resources](https://seller.flipkart.com/sitemap), [video-commerce description](https://stories.flipkart.com/announcement/indians-spent-over-2-million-hours-on-flipkart-s-video-commerce-offerings-in-the-past-one-year).

**Meesho:** its prospectus describes verified phone/bank details, business information and separately verified GSTIN or enrolment identification, and depicts catalog-quality/blocked-catalog tooling. Some supplier pages could not be retrieved. Do not infer an undocumented universal manual-reel review policy. [Official prospectus](https://investor.meesho.com/investor-web/_next/docs/ipo/meesho_limited_prospectus.pdf).

LetBuyy's universal human approval requirement is an owner-chosen trust policy. It need not imitate an unverified claim about another marketplace.

## 4. Proposed progressive onboarding

Use one merchant identity/business profile and additional channel capabilities. Verification is scoped to the relevant legal entity and operating locations; a global user login alone must not verify every business that user creates.

| Stage | Necessary information/checks | What it unlocks |
|---|---|---|
| Account and draft | Verified contact, account security, terms acceptance | Private dashboard, trial, draft catalog |
| Storefront publication | Legal/trading name, business/contact address, support contact, pickup/return information where selling, seller tax declaration, required consumer policies, category declarations | Storefront publication after applicable checks; no marketplace permission |
| Payment activation | Provider account ownership, provider approval/KYC, supported category, relevant tax and bank details | Only the approved payment method |
| Marketplace seller application | Existing information plus entity type, PAN verification, GSTIN/composition/enrolment route, authorized representative and authority evidence, provider-linked beneficiary, business/pickup/return verification, category licenses and seller agreement | Eligibility to submit products for marketplace review |
| Marketplace product approval | Category attributes, labels, brand evidence where relevant, tax classification, claims, variants, safety/licensing evidence | Approved product revision available through marketplace commerce |
| Reel approval and product match | Exact media revision, linked approved product/variant revision, accurate demonstration, rights/disclosures, review record | Approved reel placement in marketplace discovery |

“Basic storefront checks” does not exempt a seller from payment-provider KYC, tax law, product safety or consumer disclosures. Connecting an independent gateway also does not automatically eliminate every ecommerce-operator tax obligation; classify the actual platform role and payment flow.

Do not require every seller to submit every possible personal document. Requirements vary by entity type and purpose. Prefer provider-hosted checks, retain verified outcomes/references where sufficient, restrict access to documents, use private storage and access logs, and define purpose-specific retention. Do not use public KYC file URLs or collect Aadhaar by default as a convenience.

Separate statuses: account verification, storefront readiness, marketplace seller approval, provider payment readiness, product approval, reel approval and campaign approval. A paid plan cannot override any safety/compliance status. Marketplace rejection need not disable a compliant storefront; shared fraud or legal violations may justify broader restrictions with reasons.

## 5. Product and reel review design

Product review should operate on a submitted revision. A seller cannot replace material, brand, claims, category, imagery, pack size or the represented variant after approval and retain approval invisibly. Inventory updates need not trigger content review; pricing needs validity checks and discount-history rules. Define a field-level change policy.

Reel review should bind: seller/business, channel listing, product revision, exact variant or explicit permitted variant set, video asset revision/hash, caption/thumbnail revision, reviewer, decision, reason, policy version and timestamp. A listing transition counter alone is not this content binding.

Separate processing from moderation. Proposed content states: draft → submitted → in_review → approved / changes_requested / rejected; approved content may later be paused or revoked. Reuse existing state vocabulary where possible; these labels are a target, not a second competing implementation.

The review workspace should show video next to product details, variant photos, labels, seller evidence and prior decisions. Evaluate product identity, material/color/size/pack quantity, included accessories, demonstration claims, misleading edits, price claims, prohibited goods, music/image rights and sponsorship disclosures. Ask for samples or credible test evidence for relevant risk categories.

Video inspection can establish apparent consistency, **not guarantee physical quality of every shipped unit**. Use accurate badges such as “Seller identity checked” or “Listing reviewed.” Do not imply BIS/FSSAI certification or laboratory quality testing that LetBuyy did not perform. Track “not as shown” returns, complaints, repeat offenses and sample-inspection results after approval.

Rejection example: `VARIANT_MISMATCH`, video 00:07–00:12 shows a 3-piece set while listing offers one piece; link the correct pack or replace the video. Give the merchant a correction path and appeal route, while keeping sensitive anti-abuse signals internal. Concurrent reviews must not let a stale reviewer approve a newer unreviewed revision.

Proposed reel eligibility: seller authorized + product listing approved + represented revision approved + reel approved + pair match approved + asset playable + no suspension. Purchase additionally checks address eligibility, payment readiness, price and stock. Recheck at product detail/cart/checkout as well as feed generation. Organic, sponsored, shared links, saved reels and cached responses must honor revocation.

Initial recommendation: seller-submitted prerecorded reels, one clearly identified product/variant set per reel; defer live streaming and an open creator payout network. Whether every marketplace product must have a reel remains an open product choice. An approved product must not make an unapproved reel visible.

## 6. Indian compliance findings and implementation implications

This is an engineering checklist based on retrieved primary sources, not an exhaustive legal opinion. Have an Indian ecommerce lawyer and CA validate the launch-category matrix, contracts and tax configuration.

### GST seller routes

Notification 34/2023 permits qualifying below-threshold goods suppliers through an ECO without normal GST registration, subject to PAN/enrolment, no interstate goods supply and a single state/UT through ECOs. This is conditional, not a universal exemption. [Notification](https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-34-2023.pdf).

Notification 37/2023 requires enrolment checks, interstate blocking and GSTR-8 reporting for that route, and says not to collect section-52 TCS on those exempt unregistered supplies. Composition sellers have a distinct procedure under 36/2023, including interstate restrictions and TCS. [Unregistered route](https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-37-2023.pdf), [composition route](https://gstcouncil.gov.in/sites/default/files/2024-05/gst-ct-36-2023.pdf).

Model separate tax statuses; do not collapse composition, exempt goods and unregistered enrolled sellers into “no GST.” Enforce serviceability by the actual shipping/address scenario at checkout. Monitor threshold declarations and changes to registration status. Maintain effective-dated HSN/rates, place-of-supply, invoice/bill-of-supply, returns/credit notes and filing exports. Final applicable GST/TCS rates and state notifications remain a pre-activation verification task; this research does not certify a complete current rate table.

### Income-tax withholding and money reporting

The Income-tax Act, 2025, as amended by Finance Act 2026, applies from 1 April 2026. Section 393(1), table 8(v), provides the ecommerce withholding entry at 0.1%; section 393(4) includes a qualifying individual/HUF exception up to ₹5 lakh with the required identity details. Direct buyer-to-seller payment is also addressed. Use tax-year-aware rules, not only old section-194-O labels. [Official Act](https://www.incometaxindia.gov.in/documents/d/guest/income_tax_act_2025_as_amended_by_fa_act_2026-pdf).

Keep product GST, GST on platform services, GST TCS, income-tax TDS, commission and provider fees as separate accounting lines with separate legal bases. Zero storefront commission does not mean zero taxes or zero provider fees. Verify filing responsibilities, applicable exceptions and withholding timing with the CA.

### Consumer protection and packaging

Build seller identification, total-price/fee disclosure, shipping/return/refund information and a grievance workflow. The government's 2020-rule guidance states acknowledgement within 48 hours and redress within one month. Content takedown complaints may have different, shorter obligations. [Department guidance](https://consumeraffairs.gov.in/public/upload/files/1617263115_AR2020-21_1733218509.pdf).

The February 2026 Legal Metrology amendment, effective **1 July 2026**, requires searchable/sortable country-of-origin filtering for imported product listings. Country of origin is not merely an optional caption field. [Gazette](https://consumeraffairs.gov.in/public/upload/files/2026.02.13%20PCR%201st%20COO%20Filter%20on%20e-commerce%20websites_1771231030.pdf). Map all applicable packaged-commodity declarations by category; support browse/search alongside the reel feed.

The government's September 2026 announcement says further ecommerce amendments commence **1 January 2027**, covering prominent sponsored disclosures, non-misleading search, prior-price disclosures based on 30 days, NCH convergence and dark-pattern self-audits among other changes. Build readiness now, but do not call them already effective on the research date. The Gazette PDF fetch failed; obtain the exact final text before signing off detailed compliance. [Official announcement](https://www.pib.gov.in/newsite/erelcontent.aspx?lang=2&reg=48&relid=294532).

### Category licensing, claims and content

Food needs a specific FSSAI assessment for both sellers and the platform; do not assume seller licensing alone covers the marketplace. The retrieved FSSAI directions explicitly discuss ecommerce listing entities. [FSSAI direction](https://fssai.gov.in/upload/advisories/2024/07/669a5e5daca83direction%20merged.pdf).

BIS requirements depend on the product and applicable QCO; neither “everything needs BIS” nor “a verified seller is enough” is correct. [BIS compulsory certification](https://www.bis.gov.in/product-certification/products-under-compulsory-certification/?lang=en). Cosmetics, medicines, supplements, radio equipment, batteries and imported products need category-specific assessment before admission. A narrow launch allowlist is preferable to claiming support for every category.

Reel claims and endorsements need substantiation. Paid/gifted endorsements need clear disclosures; ASCI is self-regulatory guidance and must not be mislabeled as a statute. Also obtain rights to music, images, video and identifiable persons. [CCPA misleading-advertisement guidance](https://www.pib.gov.in/Pressreleaseshare.aspx?PRID=1832906&lang=2&reg=48), [ASCI guidance](https://www.ascionline.in/social/faqs/).

MeitY notified February 2026 IT Rules amendments covering synthetic media and revised intermediary obligations. Classify LetBuyy's actual functions before applying intermediary or significant-social-media duties. Provide content reporting, urgent escalation and synthetic-content provenance/labels where applicable; do not assume ordinary ecommerce complaint deadlines cover every content report. Further draft changes are not automatically enacted law. [Notified amendment](https://www.meity.gov.in/static/uploads/2026/02/f55fe52418b03f58b0669f6a8bc03b6d.pdf).

### Privacy and payment-provider requirements

DPDP commencement is staggered: the official notification starts different provisions immediately, after one year, and after eighteen months from publication. Do not describe every substantive obligation as already effective. Design notices, minimal collection, access controls, deletion/retention exceptions, incident response and child-data protections now, with an applicability calendar. [Commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf).

Razorpay Route linked-account onboarding includes business and bank information. Provider KYC and LetBuyy seller approval are distinct. Weekly settlement support must be agreed with the chosen licensed provider; it is not permission to hold funds in a LetBuyy bank account. [Route onboarding](https://razorpay.com/docs/payments/route/linked-account/). The RBI 2025 master-direction page could not be retrieved in this pass; exact provider/merchant diligence allocation remains to be checked against that direction and the executed provider agreement.

## 7. Cloud implementation proposal

Keep the gateway, queue-workers, webhook-service, identity app, Postgres and existing internal console. Do not activate the reserved media service or build a second catalog/auth/ledger.

Cloudflare Stream is a candidate managed video adapter: direct uploads, encoding and playback are documented. Use short-lived, scoped upload grants, duration/quota constraints and resumable uploads. Provider processing readiness is separate from human approval. Validate webhook signatures and deduplicate events. [Direct upload](https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/), [webhooks](https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/).

Require private/signed playback for unreleased assets, including preview/thumbnail paths; issue seller/reviewer previews only after authorization. Approved-public playback policy needs explicit revocation behavior: stopping new tokens does not revoke already issued tokens or copies already downloaded. Bound token/cache lifetimes, purge where available and define an emergency provider-level takedown procedure. [Playback security](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/).

Recommend direct owned/licensed uploads for V1. Mutable third-party embeds can change or disappear after review and are weaker evidence of the reviewed asset. If retained, they still need approval and monitoring, not automatic publication. Never download third-party media without the relevant rights.

Postgres owns approval and business state; managed video storage owns bytes/encoding. Transactional outbox drives notifications and invalidation. AI may flag mismatches or extract labels, but it cannot certify physical quality or replace the owner's required human decision.

Measure upload completion, processing failures, pending-review age, reviewer capacity, playback startup/rebuffering, moderation reversals, not-as-shown returns and delivery cost. Benchmark on lower-bandwidth Android devices. Do not choose a paid video plan or quote capacity/cost savings without upload-minutes, watched-minutes, retention and moderation-volume estimates.

## 8. Release acceptance and open decisions

Required negative cases: merchant self-approval, stale-review approval, cross-tenant attachment, wrong variant, edited approved product, rejected external reel, expired seller license, sandbox KYC, unapproved sponsored listing, cached revoked reel, direct checkout of a delisted item, non-GST interstate order and unauthorized document access. Each needs positive controls and real integration evidence.

Open business choices: launch category allowlist; whether a reel is mandatory for every marketplace listing; upload limits; review-service target and staffing; sample-inspection policy; launch support for composition/non-GST routes; commercial rates and plans; provider selection/approval; advertising attribution windows and purchase qualification.

Public information cannot reveal competitors' full internal review systems. No hosted configuration, current production behavior or legal completeness is certified by this document.

Execution: SINGLE AGENT; no subagents; documentation only; no push or deployment.
