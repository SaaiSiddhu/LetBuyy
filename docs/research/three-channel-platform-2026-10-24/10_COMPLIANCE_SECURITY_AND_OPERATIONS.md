# Compliance security privacy and operating acceptance

## Time and applicability matter

This research is dated 24 October 2026. A future production release must be checked against rules in force on its actual date, actual contracting entities, products, geography and fund flows. A table named GST or KYC does not establish compliance. Exact tax rates, withholding, invoice treatment and franchise/service classification require current qualified review and versioned configuration.

The Government's September 2026 explanation states that amended e-commerce rules commence on 1 January 2027. It addresses complaint copies, sponsored disclosure, search integrity, prior-price evidence, dark-pattern self-audit, seller/product information and certain consumer-data uses. Treat these as future-effective launch work and verify the controlling instrument and applicability during release review. [Official government explanation](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2308759&lang=2&reg=48).

The notified DPDP Rules provide staged commencement: some rules on publication, one set after one year and another after eighteen months. Do not describe the entire framework as already fully effective, or assume it will remain deferred by the planned launch. Complete notices, purpose/consent, protection, rights and incident implementation against the applicable timetable. [Official rules](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf).

## Applicability workstream

| Area | Product/engineering consequence | Acceptance owner/evidence |
| --- | --- | --- |
| Seller identity | Show actual seller and required contact details, not brand alone | Approved entity and disclosure matrix |
| Food businesses | Applicable registration/licensing, labeling and seller-display controls | Category/entity review and current valid records |
| Fresh/chilled goods | Lot/expiry/temperature/handling and safe-return rules | Actual SKU standards and staff drills |
| Price reductions | Retain applicable price history and explain promotions | Reconstructible claim and effective policy |
| Sponsored discovery | Clear paid-placement labels and ranking disclosures | Buyer UI evidence and ad event contract |
| Grievances | Actual owner, complaint record/copy, escalation and required convergence | Working support route and responsible duty |
| Privacy | Purpose-specific notice/consent, access, correction, erasure exceptions | Verified requester workflows and retention schedule |
| Payments | Approved seller collection/beneficiary/provider responsibilities | Executed eligibility and sandbox evidence |
| Tax/invoice | Current goods/services, location and withholding applicability | Qualified accepted configuration and examples |
| Franchise | Brand rights, fees, security, duties, termination and liability | Reviewed contract and accounting treatment |
| Employment/delivery | Actual workforce/contract/insurance/safety arrangements | Responsible operational and professional review |
| Branding | Domain, trademark, corporate and app-store clearance | Actual clearance, not search-engine inference |

FSSAI's December 2024 advisory reiterates the display of valid seller food-business registration/licensing and addresses product claims and shelf-life concerns. The platform needs category-specific enforcement and reviewed applicability, rather than a blanket expiry constant for every fresh or packaged product. [FSSAI advisory](https://fssai.gov.in/upload/advisories/2024/12/674efa161d756Adobe%20Scan%203%20Dec%202024.pdf).

The RBI's 2025 payment-aggregator direction covers merchant due diligence and seller/fund-flow responsibilities. This supports completing provider onboarding and beneficiary binding; it does not authorize LetBuyy to become an unlicensed money-custody rail. [RBI direction](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896).

## Threat model tied to actual journeys

| Attack/failure | Boundary | Required denial or recovery |
| --- | --- | --- |
| Merchant token used as buyer/operator | Issuer/verifier audience and realm | Reject without privilege crossover |
| Same human's second business selected by body ID | Live membership and tenant resolution | Authorized business only |
| Picker changes location ID | Location grant and task assignment | Same-seller cross-location denial |
| Another merchant's goods at partner node | Owner/custody agreement | No broad node-operator tenant access |
| Marketplace cart claims storefront origin | Trusted entry/listing context | Server-derived actual origin |
| Rejected product opened through ads/deep link | Eligibility on every surface | No alternate purchase bypass |
| Replayed import/payment/pickup proof | Payload-bound durable idempotency/replay cache | One result or conflict |
| Old offline command after staff revocation | Live permission before effect/replay | Refuse protected mutation and receipt disclosure |
| Forged callback or wrong provider reference | Signature, amount, currency and seller binding | No accepted capture/refund |
| Public KYC/proof object or shared cache | Private storage and scoped authorization | No disclosure by guessed key |
| Support impersonation | Recovery and high-risk step-up | No arbitrary account or bank takeover |
| Last-unit stock race | Canonical transaction and locks | One accepted allocation |

Use OWASP guidance as a control reference, not an assertion that file presence or a checklist certifies security. Core topics include authentication, authorization, sessions, file upload, webhook validation, transaction authorization, multi-tenant isolation, logging and privacy. [Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html), [Authorization](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

## Personal-data minimization

Seller KYC evidence is private and available only to current authorized reviewers for the defined purpose. Reuse established facts where appropriate without publishing documents to every app. Shared login is not blanket permission for advertising, location tracking or cross-business customer profiling.

Buyers see their own orders through durable ownership links. Merchants see only necessary customer data for their attributable purchases. Riders see active-assignment data and lose access when operational need ends. Store staff see the relevant task, not the platform's whole customer directory. Keep precise movement history bounded and avoid identity-document photos for routine delivery.

Rights workflows require requester verification, explicit export scope, private release, retention exceptions and legal holds. Erasure cannot silently destroy required financial/audit obligations. Deletion requests and fulfilled deletion are different states; record actual fulfillment evidence.

## Operational organization

| Duty | Minimum accountable role | Required rehearsal |
| --- | --- | --- |
| Seller/product/media approval | Current trained reviewer | Correction, rejection, revocation and appeal |
| Node opening/closing | Node manager | Stock, staffing, chilled equipment and intake state |
| Receiving/picking/packing | Assigned staff | Exact pack/lot, missing goods, quarantine and package seal |
| Dispatch and delivery | Dispatcher/rider | Offer expiry, pickup, unavailable customer and return |
| Cash close | Collector plus receiving cashier/seller | Exact amount, two-party handover and shortage |
| Refund/provider reconciliation | Authorized support/finance owner | Timeout, duplicate callback and explained suspense |
| Incident duty | Named responsible lead during pilot hours | Pause intake, communicate and recover obligations |
| Restore/rollback | Authorized platform operator | Owned restore, artifact compatibility and pending work recovery |

Do not launch longer hours or more SKUs than the available review, packing, delivery and support team can sustain. A physically open supermarket does not imply a staffed Quick fulfillment shift. Partner operating SLAs should be measured and contractually realistic; a 7–10 km service radius is not a guaranteed ten-minute journey.

## Mobile and accessibility acceptance

Prove background GPS, permission denial, screen-off/low-battery behavior and notification receipt on physical devices for each shipped platform. Do not request blanket location permissions from every customer when an address-selection flow suffices. Seller/merchant forms need accessible labels, focus, error recovery and review before financial actions. Use current app-store disclosure and actual SDK behavior, not copied privacy text.

## Release evidence boundary

Research completion establishes a reviewable plan and source corpus. It does not establish legal signoff, provider eligibility, cloud security, working native apps or deployed production state. Those are named gates with concrete tests and owners in Volume 11. Keep exceptions attributable and scoped; no old passing test total or broad “production-ready” percentage substitutes for the actual release candidate.
