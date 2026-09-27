# LetBuyy — 11-phase storefront and reel-commerce roadmap

Date: 2026-09-26. Status: proposed execution sequence based on owner requirements; implementation not started by creation of this document.

Read first: [research, code findings, owner decisions and primary sources](./REEL_COMMERCE_RESEARCH.md). This roadmap consolidates the earlier 13-part outline into exactly 11 phases and incorporates the subsequent reel-commerce and progressive-verification decisions. UI work accompanies each phase; final release verification is phase 11. Nothing is silently dropped to meet the phase count.

## Resume context

- Last inspected local develop: 6eb01d95; clean before these documentation additions, 13 commits ahead of cached origin/develop. No remote refresh was performed for this note.
- SUSTAINED-M restored deterministic account-switch verification. Its recorded test runs were not rerun for this roadmap.
- Real signed-in Android profile/address verification remains open. Deep-link routing alone is not proof of domain association or normal customer navigation.
- Existing governance still contains a global zero-commission rule. The owner now requires storefront zero commission and category-based marketplace commission; phase 3 aligns the written rules and tests before money behavior changes.
- Live cloud state is unknown. Local commits and documents are not proof of deployment.

## Scope and invariants

V1: storefront plus reel-led marketplace. Quick commerce, dark stores and delivery-app expansion are V2. One merchant platform, one identity issuer, canonical products/orders/ledger and scoped channel capabilities. Basic storefront onboarding; stronger marketplace seller verification; human approval of marketplace products and attached reels, including their match. Licensed provider-managed marketplace checkout and weekly eligible settlements. Storefront zero LetBuyy sales commission. CPC, CPM and purchase-based advertising all remain in scope.

No new service fleet, no money custody, no duplicate customer passwords, no new stores table. Preserve sites as the tenant root. Complete named canonical systems; retire legacy paths only after their replacement gates pass. Do not auto-enable production or assume external licenses/provider approval.

## Phase 1 — Reproducible local stack and Android closure

**Discover:** supported setup scripts, current migrations, ports, environment requirements and ownership of existing services; SUSTAINED-M's pending checks.

**Complete:** isolated owned database, identity and gateway startup, deterministic fixtures, Android loopback setup; ordinary navigation into canonical sign-in; real browser callback, profile and address CRUD, logout/session restoration, two-buyer switching and Android association verification.

**Exit:** reproducible setup and real device/backend evidence; no unrelated database disturbed. Record physical-device gaps separately if only emulator testing is available.

## Phase 2 — Shared buyer identity, privacy and order visibility

**Discover:** storefront session audiences, proxy contracts, default-address mutation, buyer/order ownership writes and remaining legacy authentication dependencies.

**Complete:** canonical customer identity; safe trusted-origin global account access; appropriately scoped merchant-domain sessions; atomic address defaults; authenticated server-side order ownership; store-specific versus marketplace order views. Do not infer identity from an unverified email or widen token audiences globally.

**Exit:** same buyer uses both channels with correct scope; another buyer/merchant cannot read or mutate their account, addresses or orders. Untrusted storefront domains cannot obtain platform-wide buyer credentials.

## Phase 3 — Commercial, regulatory and governance specification

**Discover:** conflicting commission rules, plan definitions, launch categories, business roles, payment contracts, applicable current/future regulation and tax-year transitions.

**Complete:** documented channel-specific commission amendment, aligned validators, tax-status/required-document matrix, consumer disclosures, category allowlist, privacy/retention schedule, seller/reel policy, provider responsibilities and versioned commercial configuration. Preserve historical financial records and founding-plan commitments.

**Exit:** implementable rules with explicit unresolved business values; legal/CA/provider activation prerequisites named rather than fabricated. Owner-approved commercial direction is not reopened unnecessarily.

## Phase 4 — Progressive merchant onboarding, subscriptions and readiness

**Discover:** current onboarding, KYC adapter, subscription catalog, provider setup and internal review tools.

**Complete:** draft account → basic storefront verification → channel selection → additional marketplace verification. Reuse verified information; collect personal/business evidence only for defined purposes. Separate account, storefront, seller, provider and subscription states. Add entity-type-aware checks, tax status, bank/beneficiary verification, document access controls, rejection/correction/appeal, expiry/reverification. Sandbox KYC never unlocks live capabilities.

**Exit:** storefront-only merchant avoids unnecessary marketplace paperwork; marketplace applicant cannot sell before required verification; paid subscription cannot bypass approval. Existing-order/refund/statement access survives plan restrictions.

## Phase 5 — Canonical catalog, category compliance and inventory

**Discover:** products/variants, listing metadata, tax/label fields, inventory writers and legacy marketplace duplication.

**Complete:** one catalog; selected-channel publishing; category attributes, HSN/tax status, seller/pack/importer/origin fields and applicable license evidence; shared inventory reservation lifecycle. Keep acquisition channels distinct from sales-channel eligibility. Supply searchable/filterable product browsing alongside reels.

**Exit:** list once, publish only to selected channels, correct variant/price/stock and required declarations across storefront and marketplace; correct geographic eligibility.

## Phase 6 — Product approval and internal review operations

**Discover:** existing channel-listing RPC, operator permissions, audit history, material edit paths, feed/ad/detail/checkout eligibility gaps.

**Complete:** admin approval per marketplace product revision; structured reason codes, actionable explanations, revision diff, review assignment, appeal and emergency takedown. Keep seller approval distinct from product approval. Define material edits requiring resubmission. Prevent stale-review decisions and merchant self-approval. Apply eligibility to sponsored discovery too.

**Exit:** unapproved/rejected/revoked marketplace products cannot bypass controls through ads, search, deep links or direct purchase; valid storefront-only products remain unaffected unless a shared legal/security violation applies.

## Phase 7 — Canonical reel commerce and product-match approval

**Discover:** Firebase ReelService/UI, upload and embed paths, moderation states, product references, caching and managed-video options.

**Complete:** provider-adapted private upload/processing, human reel review, immutable product/variant-to-media approval binding, caption/thumbnail review, rights/disclosures, correction/appeal, revocation and normal reel-to-product/cart navigation. Migrate away from direct Firebase authority through verified cutover. External links never auto-approve. Preserve current prices/availability instead of trusting cached reel prices.

**Exit:** approved seller + approved product revision + approved matching reel are all required for reel discovery; tampering and asset replacement invalidate approval. Playback works under realistic Android bandwidth, with a tested emergency removal path. Physical-quality guarantees are not claimed from video review alone.

## Phase 8 — Shared checkout, provider payments and order lifecycle

**Discover:** storefront/mobile checkout, multi-seller grouping, payment configuration, callbacks, fulfillment, returns and remaining legacy writers.

**Complete:** authoritative cart/totals, stock reservations, shipping and address serviceability, canonical order creation and buyer links; storefront supported gateway options; marketplace provider-managed collection with seller mapping. Verify provider payment evidence. Handle duplicate/out-of-order callbacks, partial failures, cancellations, fulfillment, refunds and customer complaints. Preserve reel/campaign attribution without trusting it as payment or pricing authority.

**Exit:** real provider test-mode storefront and multi-seller marketplace purchases complete through normal UI; retries cannot duplicate orders, charges, reservations or refunds; revoked/ineligible products fail closed before payment.

## Phase 9 — Commission, tax accounting, weekly settlement and statements

**Discover:** commission schedules, ledger writers, payout selection, negative adjustments, provider outcomes, reconciliation and tax exports.

**Complete:** versioned per-item category commission; immutable financial snapshots; storefront zero sales commission; separate taxes/fees/withholding lines; canonical balanced ledger. Eligibility differs from payment status. Implement holds, returns, COD remittance rules, weekly cutoff, atomic batch inclusion, provider instruction/reconciliation and order-level statements. Never hide debt through a zero clamp.

**Exit:** purchases through partial refunds and weekly provider settlements reconcile; duplicate events/jobs have one effect. Merchant sees estimated versus finalized next payout, included/excluded orders and every adjustment. External provider approval remains an explicit activation gate.

## Phase 10 — Advertising credits and CPC/CPM/purchase-based campaigns

**Discover:** existing prepaid credits, top-up verification, budget allocation, category targeting, sponsored feed, event validity, CPM rounding and missing purchase attribution.

**Complete:** captured-payment-backed credit funding, idempotent ledger and budget controls; one declared billing model per campaign; valid-click billing; precise CPM accumulation; qualified-purchase attribution, reservations/finalization and refund reversal. Campaign creatives require product/reel eligibility and sponsorship disclosure. Rank eligible relevant content using comparable expected value rather than raw mixed-unit bids. Start with simple explainable ranking; no premature fraud ML.

**Exit:** all three models have proven charges, caps, attribution and reversal behavior. Invalid/replayed events do not bill. Campaign spend cannot bypass moderation. Credits stay separate from seller proceeds unless a later explicit policy authorizes a compliant transfer mechanism.

## Phase 11 — End-to-end release, operations and gated legacy retirement

**Discover:** remaining user-flow gaps, current gate failures, live configuration gaps, operational ownership and legacy consumers.

**Complete:** combined merchant web/mobile and customer storefront/marketplace journeys; role/security tests; product/reel moderation queue and complaint operations; observed load/performance, alerts, backups/restore, rollback and provider reconciliation. Test country restrictions, tax variants, revocation, out-of-order callbacks, account switching and all ad models. Apply only validated legacy deletions; preserve mobile application identity.

**Exit:** evidence tied to the actual release candidate; every mandatory launch criterion passed or explicitly blocks launch. “No new failures” is not “all gates green.” Hosted deployment/provider onboarding are separately verified and authorized; no automatic push to staging/main or production activation.

## Execution and evidence discipline

Phases are bounded outcomes, not a mandate for an unattended fixed-hour run. Each may use smaller implementation changes. Discovery may overlap, but state/money changes follow their dependencies. UI completion and error/loading/empty/denied states belong in each phase, not an end-of-program afterthought.

For each phase record: current SHA, measured baseline, reused canonical owners, findings, decisions, touched contracts, implementation commit, tests and what they prove, positive/negative controls, rollback, external prerequisites, remaining failures and next task. Distinguish planned, implemented, locally verified, device verified, provider-sandbox verified and live verified. Do not count skipped tests as coverage.

## Tracking at document creation

| Phase | Status | Immediate dependency |
|---|---|---|
| 1 | PLANNED; inherits SUSTAINED-M remaining device work | Owned local backend |
| 2 | PLANNED; existing partial foundations | Phase 1 |
| 3 | PLANNED; research captured in companion | Business values and regulatory applicability |
| 4 | PLANNED; existing partial onboarding/KYC | Phases 1–3 |
| 5 | PLANNED; existing canonical products/listings | Phases 3–4 |
| 6 | PLANNED; existing product moderation | Phases 4–5 |
| 7 | PLANNED; legacy reel UX exists | Phases 5–6 and video-provider decision |
| 8 | PLANNED; existing checkout foundations | Phases 2–7 and provider sandbox |
| 9 | PLANNED; existing ledger/settlement foundations | Phases 3 and 8 |
| 10 | PLANNED; existing ad-credit foundations | Phases 6–9 |
| 11 | PLANNED | All required preceding acceptance gates |

Next bounded task: Phase 1. Re-read current repository/evidence before acting; this dated roadmap does not replace fresh measurement. This file is the durable conversation reference, not an autonomous scheduler or a claim of permanent assistant memory.
