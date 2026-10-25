# Findings and implementation requirements

24 October 2026 · 580 individual requirements across 23 domains.

Each item defines a confirmed direction or a proposed implementation requirement and an observable acceptance condition. These are planned requirements, not completed features or an assertion of 580 separate competitor facts. External source IDs are design-context references; the linked local volume explains the actual recommended contract. Source-to-requirement topic matching is navigation rather than independent proof of claim coverage.

## Product governance and brands

Implementation owner: Existing governance, app ownership and marketing owners. Primary budget bucket: P0. [Design detail](01_PRODUCT_CHANNELS_AND_BRANDS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0001 | Keep Storefront, Marketplace and Quick as three explicit channels | An order identifies exactly one selling channel | [S0514](13_SOURCE_CATALOG.md#s0514) |
| R0002 | Make Storefront the primary merchant sales channel | Default onboarding reaches storefront launch before marketplace application | [S0480](13_SOURCE_CATALOG.md#s0480), [S0490](13_SOURCE_CATALOG.md#s0490) |
| R0003 | Guarantee zero LetBuyy storefront sales commission | Every storefront invoice and refund has zero sales commission | [S0329](13_SOURCE_CATALOG.md#s0329), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0004 | Give Marketplace a dedicated Seller app | Seller navigation and release identity are independently registered | Owner direction / local design |
| R0005 | Keep Store Ops a dedicated operational app | Picking never requires a merchant storefront administrator session | [S0312](13_SOURCE_CATALOG.md#s0312), [S0484](13_SOURCE_CATALOG.md#s0484) |
| R0006 | Retain one customer app with Marketplace and Quick modes | Switching modes preserves separate baskets and payment attempts | [S0496](13_SOURCE_CATALOG.md#s0496), [S0516](13_SOURCE_CATALOG.md#s0516) |
| R0007 | Use one canonical commerce backend | No client depends on the inert Agrimore gateway | [S0532](13_SOURCE_CATALOG.md#s0532) |
| R0008 | Use one canonical PostgreSQL commerce database | Product and money writes have one authoritative owner | [S0315](13_SOURCE_CATALOG.md#s0315), [S0327](13_SOURCE_CATALOG.md#s0327) |
| R0009 | Use one canonical identity issuer across both brands | All app tokens validate the approved issuer | [S0312](13_SOURCE_CATALOG.md#s0312), [S0496](13_SOURCE_CATALOG.md#s0496) |
| R0010 | Use LetBuyy as the shared Marketplace and Storefront umbrella | Customer Marketplace keeps LetBuyy identity and merchants use LetBuyy Store | [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0011 | Evaluate LetKart Quick as the candidate second brand for Quick | Quick remains a separate mode inside the existing LetBuyy customer application | Owner direction / local design |
| R0012 | Keep brand choice separate from legal seller identity | Receipts show actual seller and responsible platform entity | [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0013 | Do not assert trademark or domain availability | Brand release requires actual clearance evidence | [S0480](13_SOURCE_CATALOG.md#s0480), [S0494](13_SOURCE_CATALOG.md#s0494) |
| R0014 | Preserve published customer application identity | A display-name change cannot silently change package ownership | [S0319](13_SOURCE_CATALOG.md#s0319), [S0476](13_SOURCE_CATALOG.md#s0476) |
| R0015 | Record the dedicated Seller app topology change | App admission records and validators agree before activation | [S0516](13_SOURCE_CATALOG.md#s0516) |
| R0016 | Promote existing Store Ops source with history | Source preservation comparison remains reproducible after promotion | [S0484](13_SOURCE_CATALOG.md#s0484) |
| R0017 | Reuse preserved Seller donor UX selectively | Firebase writers and donor fee logic are absent from active paths | Owner direction / local design |
| R0018 | Keep runtime classification separate from product naming | A new brand creates no new backend service | [S0325](13_SOURCE_CATALOG.md#s0325), [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0019 | Keep reserved services empty | No new Quick module is deployed into a reserved service | [S0325](13_SOURCE_CATALOG.md#s0325), [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0020 | Preserve the India merchant scale envelope | Capacity work follows measured pilot demand | [S0316](13_SOURCE_CATALOG.md#s0316), [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0021 | Keep source observations separate from hosted facts | Every deployment claim names an observed artifact and environment | [S0322](13_SOURCE_CATALOG.md#s0322), [S0509](13_SOURCE_CATALOG.md#s0509) |
| R0022 | Record explicit supersession of older app-boundary decisions | Readers can distinguish old merchant absorption from current direction | Owner direction / local design |
| R0023 | Keep research authorization separate from implementation authorization | This package triggers no migrations or app activation | [S0312](13_SOURCE_CATALOG.md#s0312) |
| R0024 | Keep this research resume scoped to this chat | Other LetBuyy chats and their execution grants remain paused | [S0530](13_SOURCE_CATALOG.md#s0530), [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0025 | Maintain a single decision register for this programme | A changed decision identifies affected requirements and acceptance | [S0325](13_SOURCE_CATALOG.md#s0325) |

## Shared identity and sessions

Implementation owner: Identity platform and canonical identity/auth/session packages. Primary budget bucket: P1. [Design detail](03_IDENTITY_TENANCY_AND_APP_REUSE.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0026 | Reuse one verified person identity across all apps | A merchant who opens Seller resolves to the same person | [S0262](13_SOURCE_CATALOG.md#s0262), [S0248](13_SOURCE_CATALOG.md#s0248) |
| R0027 | Allow the same person to hold buyer and workforce relationships | Buyer access alone cannot authorize a merchant mutation | [S0207](13_SOURCE_CATALOG.md#s0207), [S0227](13_SOURCE_CATALOG.md#s0227) |
| R0028 | Use separate OAuth clients for distinct native apps | A stolen Seller callback cannot complete Store Ops login | [S0262](13_SOURCE_CATALOG.md#s0262), [S0260](13_SOURCE_CATALOG.md#s0260) |
| R0029 | Use system browser authorization with PKCE for native clients | Intercepted authorization code cannot be redeemed without verifier | [S0260](13_SOURCE_CATALOG.md#s0260), [S0262](13_SOURCE_CATALOG.md#s0262) |
| R0030 | Validate token issuer audience expiry and signature algorithm | Forged wrong-audience and expired tokens are rejected | [S0228](13_SOURCE_CATALOG.md#s0228), [S0259](13_SOURCE_CATALOG.md#s0259) |
| R0031 | Keep merchant buyer and operator authority separate | Merchant credentials cannot open operator administration | [S0214](13_SOURCE_CATALOG.md#s0214), [S0219](13_SOURCE_CATALOG.md#s0219) |
| R0032 | Select the active business context explicitly | A person with two businesses sees the chosen business only | [S0210](13_SOURCE_CATALOG.md#s0210), [S0243](13_SOURCE_CATALOG.md#s0243) |
| R0033 | Reuse issuer sessions without sharing raw app refresh tokens | Each app can revoke its own device session | [S0245](13_SOURCE_CATALOG.md#s0245), [S0257](13_SOURCE_CATALOG.md#s0257) |
| R0034 | Bind refresh credentials to approved client and session | Refresh replay does not create an uncontrolled session chain | [S0245](13_SOURCE_CATALOG.md#s0245), [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0035 | Store credentials in platform secure storage | Logs and ordinary preferences contain no bearer tokens | [S0216](13_SOURCE_CATALOG.md#s0216), [S0237](13_SOURCE_CATALOG.md#s0237) |
| R0036 | Revalidate live membership on sensitive actions | Removing staff access blocks their next protected mutation | [S0224](13_SOURCE_CATALOG.md#s0224), [S0234](13_SOURCE_CATALOG.md#s0234) |
| R0037 | Require step-up for bank and payout changes | A normal browsing session cannot replace a beneficiary | [S0245](13_SOURCE_CATALOG.md#s0245) |
| R0038 | Prevent account linking by unverified email or phone | An attacker cannot claim a business using matching text | [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0039 | Reuse verified facts with purpose-aware consent | Seller onboarding requests only missing applicable information | [S0248](13_SOURCE_CATALOG.md#s0248), [S0208](13_SOURCE_CATALOG.md#s0208) |
| R0040 | Keep account suspension distinct from business suspension | A suspended seller retains permitted personal buyer access | [S0209](13_SOURCE_CATALOG.md#s0209) |
| R0041 | Keep global logout and per-device logout distinct | Each logout option has a tested revocation boundary | [S0259](13_SOURCE_CATALOG.md#s0259), [S0209](13_SOURCE_CATALOG.md#s0209) |
| R0042 | Prevent a stale callback from restoring an old account | Switching identity retires earlier login responses | [S0209](13_SOURCE_CATALOG.md#s0209), [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0043 | Rate-limit authentication and recovery attempts | Repeated invalid challenges reach a bounded denial state | [S0207](13_SOURCE_CATALOG.md#s0207), [S0208](13_SOURCE_CATALOG.md#s0208) |
| R0044 | Use durable replay protection for one-time proofs | The same proof fails across separate worker instances | Owner direction / local design |
| R0045 | Protect recovery from support impersonation | A support agent cannot silently bypass owner verification | [S0236](13_SOURCE_CATALOG.md#s0236), [S0211](13_SOURCE_CATALOG.md#s0211) |
| R0046 | Handle renamed or recycled phone numbers safely | A new phone owner cannot inherit old business rights | [S0222](13_SOURCE_CATALOG.md#s0222) |
| R0047 | Audit membership and session security events | Security investigators can trace granting revoking and recovery | [S0231](13_SOURCE_CATALOG.md#s0231), [S0236](13_SOURCE_CATALOG.md#s0236) |
| R0048 | Avoid cross-brand cookie wildcard trust | An untrusted storefront domain cannot read platform credentials | [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0049 | Provide accessible authentication and recovery | Users can complete normal flows without inaccessible puzzles | [S0208](13_SOURCE_CATALOG.md#s0208), [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0050 | Test one person across all approved app clients | Sign-in succeeds while authorization remains role-scoped | [S0209](13_SOURCE_CATALOG.md#s0209), [S0260](13_SOURCE_CATALOG.md#s0260) |

## Businesses memberships and permissions

Implementation owner: Permission/organisation owners, tenant middleware and database. Primary budget bucket: P1. [Design detail](03_IDENTITY_TENANCY_AND_APP_REUSE.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0051 | Reuse existing sites as tenant ownership roots | No rival stores tenant table is introduced | Owner direction / local design |
| R0052 | Distinguish a person from a legal business | Two businesses of one person retain separate accounts and obligations | [S0213](13_SOURCE_CATALOG.md#s0213) |
| R0053 | Map Seller participation to an existing owned business | Enrolling an existing merchant does not create a duplicate tenant | [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0054 | Allow a seller-only business without requiring a public storefront | Marketplace onboarding can complete without publishing a website | [S0064](13_SOURCE_CATALOG.md#s0064), [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0055 | Require evidence before joining an existing business | Knowing its name or GST number grants no membership | [S0210](13_SOURCE_CATALOG.md#s0210), [S0080](13_SOURCE_CATALOG.md#s0080) |
| R0056 | Allow multiple sites under an authorized organisation model | Cross-site reads require an explicit permitted scope | [S0214](13_SOURCE_CATALOG.md#s0214), [S0215](13_SOURCE_CATALOG.md#s0215) |
| R0057 | Scope Store Ops staff to assigned locations | Staff at location A cannot operate location B by changing IDs | [S0049](13_SOURCE_CATALOG.md#s0049), [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0058 | Scope rider authority to current delivery assignments | A rider cannot browse another rider's customer addresses | Owner direction / local design |
| R0059 | Separate owner manager picker cashier and reviewer capabilities | Each role has positive and negative permission fixtures | [S0054](13_SOURCE_CATALOG.md#s0054), [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0060 | Separate franchise ownership from location management | A property lessor receives no stock or customer rights | [S0242](13_SOURCE_CATALOG.md#s0242), [S0262](13_SOURCE_CATALOG.md#s0262) |
| R0061 | Separate stock-owner permissions from custodian permissions | Custody staff cannot edit the owner's bank details | [S0051](13_SOURCE_CATALOG.md#s0051), [S0056](13_SOURCE_CATALOG.md#s0056) |
| R0062 | Require explicit grants for third-party stock custody | A partner node cannot access another seller merely by proximity | [S0246](13_SOURCE_CATALOG.md#s0246), [S0057](13_SOURCE_CATALOG.md#s0057) |
| R0063 | Use invitation acceptance with bounded validity | Expired revoked or replayed invites fail | [S0085](13_SOURCE_CATALOG.md#s0085), [S0254](13_SOURCE_CATALOG.md#s0254) |
| R0064 | Make owner transfer a controlled audited action | A staff member cannot transfer ownership unilaterally | [S0214](13_SOURCE_CATALOG.md#s0214), [S0230](13_SOURCE_CATALOG.md#s0230) |
| R0065 | Keep provider beneficiary ownership explicit | A bank account belongs to the correct contracting seller | [S0072](13_SOURCE_CATALOG.md#s0072) |
| R0066 | Evaluate permissions before returning cached mutation receipts | Revoked staff cannot recover protected receipt data | [S0057](13_SOURCE_CATALOG.md#s0057), [S0051](13_SOURCE_CATALOG.md#s0051) |
| R0067 | Use least-privilege application database roles | Worker success does not depend on unrestricted service role | [S0219](13_SOURCE_CATALOG.md#s0219), [S0218](13_SOURCE_CATALOG.md#s0218) |
| R0068 | Use transaction-local tenant GUC context | A pooled connection cannot leak the prior tenant scope | [S0231](13_SOURCE_CATALOG.md#s0231) |
| R0069 | Enforce RLS with positive controls | Tenant A sees its row before tenant B is denied | [S0231](13_SOURCE_CATALOG.md#s0231) |
| R0070 | Fence background jobs by current trusted ownership | A forged queued site ID cannot select another tenant | [S0214](13_SOURCE_CATALOG.md#s0214), [S0231](13_SOURCE_CATALOG.md#s0231) |
| R0071 | Separate platform reviewer from seller self-approval | A seller cannot approve their own listing revision | [S0082](13_SOURCE_CATALOG.md#s0082), [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0072 | Audit permission templates and custom grants | A role change exposes the exact newly allowed actions | [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0073 | Expose business switching without mixing local caches | Switching business removes old stock and drafts from active views | [S0091](13_SOURCE_CATALOG.md#s0091) |
| R0074 | Retain lawful historical order access after channel closure | Closing Marketplace cannot erase statements or refund duties | [S0053](13_SOURCE_CATALOG.md#s0053), [S0227](13_SOURCE_CATALOG.md#s0227) |
| R0075 | Bind business agreement acceptance to an authorized signatory | A cashier cannot accept a new franchise agreement for the owner | [S0210](13_SOURCE_CATALOG.md#s0210), [S0230](13_SOURCE_CATALOG.md#s0230) |

## Merchant storefront system

Implementation owner: Existing Merchant clients, commerce web and shared catalog. Primary budget bucket: P3. [Design detail](05_MERCHANT_AND_SELLER_JOURNEYS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0076 | Keep existing Merchant web and mobile as storefront owners | Both clients manage the same canonical site and catalog | [S0522](13_SOURCE_CATALOG.md#s0522), [S0508](13_SOURCE_CATALOG.md#s0508) |
| R0077 | Keep Liquid storefront rendering as the canonical web path | Channel work introduces no competing renderer | [S0520](13_SOURCE_CATALOG.md#s0520) |
| R0078 | Preserve independent merchant domains and branding | A customer can shop the merchant's branded website | [S0498](13_SOURCE_CATALOG.md#s0498) |
| R0079 | Offer progressive storefront onboarding | Merchants complete only applicable storefront launch requirements | [S0499](13_SOURCE_CATALOG.md#s0499), [S0483](13_SOURCE_CATALOG.md#s0483) |
| R0080 | Separate plan entitlement from seller eligibility | A paid plan cannot approve Marketplace participation | [S0479](13_SOURCE_CATALOG.md#s0479), [S0481](13_SOURCE_CATALOG.md#s0481) |
| R0081 | Show storefront zero commission consistently | Marketing checkout statements and billing use the same definition | [S0496](13_SOURCE_CATALOG.md#s0496), [S0497](13_SOURCE_CATALOG.md#s0497) |
| R0082 | Distinguish subscription charges from sales commission | The merchant sees subscription amount separately from order proceeds | [S0497](13_SOURCE_CATALOG.md#s0497), [S0503](13_SOURCE_CATALOG.md#s0503) |
| R0083 | Distinguish payment-provider charges from platform commission | A provider fee is not relabelled as zero-cost payments | [S0497](13_SOURCE_CATALOG.md#s0497), [S0524](13_SOURCE_CATALOG.md#s0524) |
| R0084 | Allow storefront-only products | Those products are absent from Marketplace discovery and checkout | [S0523](13_SOURCE_CATALOG.md#s0523), [S0484](13_SOURCE_CATALOG.md#s0484) |
| R0085 | Allow standalone product creation in Merchant | Creation does not automatically publish to another channel | [S0533](13_SOURCE_CATALOG.md#s0533), [S0494](13_SOURCE_CATALOG.md#s0494) |
| R0086 | Expose Marketplace eligibility per product | A merchant sees what is missing before requesting publication | [S0483](13_SOURCE_CATALOG.md#s0483), [S0479](13_SOURCE_CATALOG.md#s0479) |
| R0087 | Keep storefront prices independent where policy permits | A channel price change does not overwrite another offer | [S0510](13_SOURCE_CATALOG.md#s0510), [S0523](13_SOURCE_CATALOG.md#s0523) |
| R0088 | Keep storefront fulfillment settings merchant-scoped | Shipping or local pickup settings cannot alter Quick coverage | [S0485](13_SOURCE_CATALOG.md#s0485), [S0477](13_SOURCE_CATALOG.md#s0477) |
| R0089 | Preserve hosted canonical checkout authority | The browser cannot submit trusted totals or provider names | [S0476](13_SOURCE_CATALOG.md#s0476), [S0521](13_SOURCE_CATALOG.md#s0521) |
| R0090 | Support order support and returns within the storefront scope | Another site cannot read customer account pages | [S0495](13_SOURCE_CATALOG.md#s0495) |
| R0091 | Preserve canonical tax and invoice configuration | A valid storefront order uses its seller's actual configuration | [S0532](13_SOURCE_CATALOG.md#s0532), [S0533](13_SOURCE_CATALOG.md#s0533) |
| R0092 | Provide channel filters in merchant reporting | Storefront sales are not presented as Marketplace GMV | [S0510](13_SOURCE_CATALOG.md#s0510), [S0480](13_SOURCE_CATALOG.md#s0480) |
| R0093 | Show shared stock and channel availability separately | The UI explains one physical pool and each listing's eligibility | [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0094 | Prevent accidental global deletion from channel screens | Unpublishing a listing leaves the canonical product intact | [S0504](13_SOURCE_CATALOG.md#s0504) |
| R0095 | Retain mobile and web draft recovery | A failed save can resume without creating a duplicate product | [S0508](13_SOURCE_CATALOG.md#s0508), [S0513](13_SOURCE_CATALOG.md#s0513) |
| R0096 | Use canonical theme and media permissions | A product import cannot expose private draft assets | [S0512](13_SOURCE_CATALOG.md#s0512), [S0513](13_SOURCE_CATALOG.md#s0513) |
| R0097 | Protect storefront buyer credentials on custom domains | Merchant-controlled content cannot obtain platform-wide tokens | [S0486](13_SOURCE_CATALOG.md#s0486), [S0487](13_SOURCE_CATALOG.md#s0487) |
| R0098 | Preserve existing discount and campaign boundaries | A storefront promotion does not silently subsidize Marketplace | [S0529](13_SOURCE_CATALOG.md#s0529), [S0509](13_SOURCE_CATALOG.md#s0509) |
| R0099 | Test existing storefront journeys during every channel cutover | Core browsing checkout and order recovery remain usable | [S0510](13_SOURCE_CATALOG.md#s0510), [S0523](13_SOURCE_CATALOG.md#s0523) |
| R0100 | Provide merchant-owned catalog export without publishing another channel | Exported product identity and quantities reconcile with the canonical catalog | [S0526](13_SOURCE_CATALOG.md#s0526), [S0495](13_SOURCE_CATALOG.md#s0495) |

## Dedicated Marketplace Seller onboarding

Implementation owner: Promoted Seller source, existing KYC/onboarding/listing owners. Primary budget bucket: P3. [Design detail](05_MERCHANT_AND_SELLER_JOURNEYS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0101 | Build Seller onboarding on canonical identity and memberships | Existing verified merchant signs in without another person account | [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0102 | Offer join-existing-business and create-business paths | The user can choose a verified relationship without ambiguity | [S0314](13_SOURCE_CATALOG.md#s0314), [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0103 | Reuse applicable business verification facts | A current verified fact is not requested as a duplicate upload | [S0222](13_SOURCE_CATALOG.md#s0222), [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0104 | Keep document reuse consent and purpose visible | Reused documents disclose their relevant purpose and recipient | [S0263](13_SOURCE_CATALOG.md#s0263), [S0264](13_SOURCE_CATALOG.md#s0264) |
| R0105 | Use entity-aware document requirements | Sole proprietor and incorporated business see applicable requirements | [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0106 | Separate submission review approval expiry and suspension | Pending review cannot be displayed as approved | [S0258](13_SOURCE_CATALOG.md#s0258), [S0262](13_SOURCE_CATALOG.md#s0262) |
| R0107 | Separate platform seller approval from provider onboarding | Either missing prerequisite blocks affected selling capabilities | [S0320](13_SOURCE_CATALOG.md#s0320), [S0233](13_SOURCE_CATALOG.md#s0233) |
| R0108 | Configure pickup dispatch and return addresses | Orders cannot promise unsupported pickup or return coverage | [S0320](13_SOURCE_CATALOG.md#s0320), [S0223](13_SOURCE_CATALOG.md#s0223) |
| R0109 | Verify beneficiary changes through the provider-approved path | Editing display bank text cannot redirect funds | [S0214](13_SOURCE_CATALOG.md#s0214), [S0246](13_SOURCE_CATALOG.md#s0246) |
| R0110 | Require seller acceptance of the current commercial schedule | A fee revision has auditable notice and effective version | [S0263](13_SOURCE_CATALOG.md#s0263), [S0264](13_SOURCE_CATALOG.md#s0264) |
| R0111 | Require category-specific eligibility | A seller cannot bypass restricted-category controls by relabelling | [S0209](13_SOURCE_CATALOG.md#s0209), [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0112 | Support correction resubmission and appeal | Rejection records reasons and a recoverable next step | [S0211](13_SOURCE_CATALOG.md#s0211), [S0225](13_SOURCE_CATALOG.md#s0225) |
| R0113 | Keep KYC documents private with bounded access | Only current authorized reviewers can retrieve documents | [S0263](13_SOURCE_CATALOG.md#s0263), [S0264](13_SOURCE_CATALOG.md#s0264) |
| R0114 | Label sandbox verification as sandbox | A fake verification result cannot unlock live sales | [S0328](13_SOURCE_CATALOG.md#s0328), [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0115 | Show a readiness checklist rather than one approval boolean | The seller can identify the exact blocking prerequisite | [S0215](13_SOURCE_CATALOG.md#s0215), [S0225](13_SOURCE_CATALOG.md#s0225) |
| R0116 | Allow catalog preparation while approval is pending | Draft work is retained without public selling access | [S0241](13_SOURCE_CATALOG.md#s0241) |
| R0117 | Block publishing while required verification is expired | Existing drafts remain recoverable after reverification | [S0320](13_SOURCE_CATALOG.md#s0320), [S0236](13_SOURCE_CATALOG.md#s0236) |
| R0118 | Gate direct purchase as well as feed visibility | An old deep link cannot bypass suspended seller status | [S0209](13_SOURCE_CATALOG.md#s0209), [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0119 | Preserve refund support and statements during suspension | Restriction does not hide existing customer obligations | [S0319](13_SOURCE_CATALOG.md#s0319), [S0209](13_SOURCE_CATALOG.md#s0209) |
| R0120 | Reuse donor dashboard and onboarding UX where sound | Useful screens survive while donor backend authority is removed | [S0329](13_SOURCE_CATALOG.md#s0329), [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0121 | Keep listing operations separate from storefront editing | Seller app focuses Marketplace requirements and performance | [S0312](13_SOURCE_CATALOG.md#s0312) |
| R0122 | Show product-level fee estimates before publication | Category rate basis and effective version are explained | [S0311](13_SOURCE_CATALOG.md#s0311), [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0123 | Support seller staff roles independently of storefront staff grants | A storefront designer cannot automatically alter Marketplace finance | [S0211](13_SOURCE_CATALOG.md#s0211), [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0124 | Verify complete seller activation through the normal UI | One valid seller becomes sellable and one invalid applicant is refused | [S0207](13_SOURCE_CATALOG.md#s0207), [S0214](13_SOURCE_CATALOG.md#s0214) |
| R0125 | Record the actual country and provider-supported seller entity type | An unsupported business remains draft rather than pretending India eligibility | Owner direction / local design |

## Canonical catalog and bidirectional reuse

Implementation owner: Existing commerce catalog, shared types, listing writers and clients. Primary budget bucket: P2. [Design detail](04_CATALOG_CHANNELS_AND_SHARED_INVENTORY.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0126 | Keep one canonical product identity per owning business | Merchant and Seller views reference the same product ID | [S0314](13_SOURCE_CATALOG.md#s0314) |
| R0127 | Keep one canonical variant identity for a shared sellable unit | A shared pack has the same variant ID in both apps | [S0315](13_SOURCE_CATALOG.md#s0315), [S0327](13_SOURCE_CATALOG.md#s0327) |
| R0128 | Make import a channel-enablement action by default | Enabling Marketplace creates a listing without copying product stock | [S0506](13_SOURCE_CATALOG.md#s0506), [S0323](13_SOURCE_CATALOG.md#s0323) |
| R0129 | Allow Seller-created products to be enabled for Storefront | The reverse workflow reuses the same canonical variant | [S0519](13_SOURCE_CATALOG.md#s0519), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0130 | Allow products exclusive to either channel | Creating a product does not force every channel on | [S0529](13_SOURCE_CATALOG.md#s0529), [S0321](13_SOURCE_CATALOG.md#s0321) |
| R0131 | Let users select products and variants before import | Only selected items receive the requested channel listing | [S0038](13_SOURCE_CATALOG.md#s0038), [S0514](13_SOURCE_CATALOG.md#s0514) |
| R0132 | Show a preview of shared fields and channel-specific fields | Users know which edits affect both apps | [S0511](13_SOURCE_CATALOG.md#s0511), [S0523](13_SOURCE_CATALOG.md#s0523) |
| R0133 | Reuse media through canonical authorized asset references | Import cannot grant access to another tenant's private media | [S0512](13_SOURCE_CATALOG.md#s0512) |
| R0134 | Distinguish SKU from barcode and global product identifiers | Matching barcode text alone cannot merge legal ownership | [S0036](13_SOURCE_CATALOG.md#s0036), [S0038](13_SOURCE_CATALOG.md#s0038) |
| R0135 | Validate pack size unit and variant mapping | A one-litre pack cannot consume a five-litre pack's stock | [S0315](13_SOURCE_CATALOG.md#s0315), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0136 | Preserve source and edit audit history | A catalog change identifies actor app and material revision | [S0312](13_SOURCE_CATALOG.md#s0312) |
| R0137 | Require optimistic concurrency for edits from both apps | An old Merchant draft cannot overwrite a newer Seller edit silently | [S0513](13_SOURCE_CATALOG.md#s0513), [S0523](13_SOURCE_CATALOG.md#s0523) |
| R0138 | Route material Marketplace edits into renewed review | Approved listing evidence remains tied to the reviewed revision | Owner direction / local design |
| R0139 | Keep channel titles descriptions and price overrides explicit | An override is not silently written into the shared base record | [S0508](13_SOURCE_CATALOG.md#s0508), [S0510](13_SOURCE_CATALOG.md#s0510) |
| R0140 | Allow safe bulk channel-enablement with per-item results | Retries do not duplicate listings and errors identify affected items | [S0038](13_SOURCE_CATALOG.md#s0038), [S0527](13_SOURCE_CATALOG.md#s0527) |
| R0141 | Provide idempotent import commands | The same import intent returns the same listing results | Owner direction / local design |
| R0142 | Do not equate import with catalog ownership transfer | The owning business remains unchanged after enablement | Owner direction / local design |
| R0143 | Require explicit audited duplication when a new product is intended | Copy creates new identity and no shared-stock implication | [S0506](13_SOURCE_CATALOG.md#s0506), [S0507](13_SOURCE_CATALOG.md#s0507) |
| R0144 | Prevent cross-business import without a real authorized transaction | One person's second business cannot claim the first business's goods | [S0041](13_SOURCE_CATALOG.md#s0041) |
| R0145 | Map approved Quick assortment to canonical seller variants | Quick approval does not create an independent product database | Owner direction / local design |
| R0146 | Preserve discontinued and superseded product history | Existing orders keep their original item facts | [S0320](13_SOURCE_CATALOG.md#s0320), [S0312](13_SOURCE_CATALOG.md#s0312) |
| R0147 | Validate tax category and required declarations per channel | An imported draft exposes missing applicable fields | [S0533](13_SOURCE_CATALOG.md#s0533) |
| R0148 | Offer clear unlink and unpublish actions | Removing a channel does not remove stock or other channel offers | [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0149 | Test both directions through real canonical writers | Merchant-to-Seller and Seller-to-Merchant show one stock authority | Owner direction / local design |
| R0150 | Validate variant-level channel selection independently from parent products | Enabling one size cannot publish every size unintentionally | [S0311](13_SOURCE_CATALOG.md#s0311), [S0325](13_SOURCE_CATALOG.md#s0325) |

## Channel offers moderation and pricing scope

Implementation owner: Existing channel listings, moderation, offer and quote owners. Primary budget bucket: P2. [Design detail](04_CATALOG_CHANNELS_AND_SHARED_INVENTORY.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0151 | Reuse canonical channel listings for publication lifecycle | Each product has an explicit selected-channel listing | [S0323](13_SOURCE_CATALOG.md#s0323), [S0324](13_SOURCE_CATALOG.md#s0324) |
| R0152 | Keep draft pending approved rejected paused and delisted distinct | Only currently eligible public offers appear to buyers | [S0523](13_SOURCE_CATALOG.md#s0523), [S0499](13_SOURCE_CATALOG.md#s0499) |
| R0153 | Bind approval to the exact material revision | Unreviewed changes do not inherit old approval | [S0322](13_SOURCE_CATALOG.md#s0322), [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0154 | Enforce eligibility in feeds search ads detail and checkout | No alternate surface bypasses the channel guard | [S0483](13_SOURCE_CATALOG.md#s0483), [S0481](13_SOURCE_CATALOG.md#s0481) |
| R0155 | Use the actual order sales origin for fees | The app used to edit a product cannot determine commission | [S0312](13_SOURCE_CATALOG.md#s0312), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0156 | Revalidate origin and seller on the server | A client cannot claim Storefront origin for a Marketplace purchase | [S0521](13_SOURCE_CATALOG.md#s0521) |
| R0157 | Snapshot channel listing and pricing version on order lines | Historical statements survive later listing changes | [S0311](13_SOURCE_CATALOG.md#s0311), [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0158 | Support channel-specific price windows | An expired price cannot authorize a new checkout | [S0319](13_SOURCE_CATALOG.md#s0319), [S0328](13_SOURCE_CATALOG.md#s0328) |
| R0159 | Keep discount funder and channel scope explicit | A promotion cannot consume an unrelated seller budget | [S0522](13_SOURCE_CATALOG.md#s0522) |
| R0160 | Show selected channels and missing readiness in both apps | Merchant and Seller agree about actual publication state | [S0523](13_SOURCE_CATALOG.md#s0523), [S0325](13_SOURCE_CATALOG.md#s0325) |
| R0161 | Prevent category manipulation for lower fees | Material category changes require applicable review | [S0311](13_SOURCE_CATALOG.md#s0311), [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0162 | Keep listing visibility separate from approval | A hidden approved listing cannot leak through generic search | Owner direction / local design |
| R0163 | Define delisting behavior for existing orders | Order support and refunds remain available after delisting | [S0498](13_SOURCE_CATALOG.md#s0498), [S0483](13_SOURCE_CATALOG.md#s0483) |
| R0164 | Expose moderation reasons without internal confidential notes | Seller sees actionable corrections while reviewer notes remain protected | [S0523](13_SOURCE_CATALOG.md#s0523), [S0530](13_SOURCE_CATALOG.md#s0530) |
| R0165 | Make moderation mutations idempotent and versioned | Two reviewers cannot silently overwrite each other's decisions | [S0529](13_SOURCE_CATALOG.md#s0529), [S0530](13_SOURCE_CATALOG.md#s0530) |
| R0166 | Audit every approval revocation and policy change | Each public eligibility change has actor time and reason | [S0481](13_SOURCE_CATALOG.md#s0481) |
| R0167 | Keep Quick local assortment approval separate from Marketplace listing | A Marketplace approval alone does not activate a dark store offer | [S0483](13_SOURCE_CATALOG.md#s0483), [S0516](13_SOURCE_CATALOG.md#s0516) |
| R0168 | Distinguish legal global block from channel-specific rejection | A safety recall blocks affected channels while a formatting rejection does not | [S0534](13_SOURCE_CATALOG.md#s0534), [S0511](13_SOURCE_CATALOG.md#s0511) |
| R0169 | Require current seller approval at purchase time | A cached feed cannot authorize a suspended seller | [S0478](13_SOURCE_CATALOG.md#s0478), [S0482](13_SOURCE_CATALOG.md#s0482) |
| R0170 | Keep category taxonomy mappings versioned | An old order's category evidence remains interpretable | Owner direction / local design |
| R0171 | Prevent bulk import from auto-approving listings | Imported items begin in the correct readiness state | [S0474](13_SOURCE_CATALOG.md#s0474), [S0505](13_SOURCE_CATALOG.md#s0505) |
| R0172 | Expose effective fees before seller confirmation | The accepted schedule matches the eventual immutable order facts | [S0316](13_SOURCE_CATALOG.md#s0316), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0173 | Use canonical errors for no-longer-eligible offers | Clients provide a clear recoverable refresh path | [S0317](13_SOURCE_CATALOG.md#s0317), [S0318](13_SOURCE_CATALOG.md#s0318) |
| R0174 | Test storefront-only and seller-only product isolation | Neither channel displays or sells the other's unselected offers | [S0311](13_SOURCE_CATALOG.md#s0311), [S0499](13_SOURCE_CATALOG.md#s0499) |
| R0175 | Keep approval expiry and scheduled publication independently testable | An expired approval cannot be revived by a future publication timestamp | Owner direction / local design |

## Shared inventory and stock locations

Implementation owner: Existing inventory kernel, location permissions and order writer. Primary budget bucket: P2. [Design detail](04_CATALOG_CHANNELS_AND_SHARED_INVENTORY.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0176 | Use one physical stock authority per owner variant and location | Cross-channel quantity changes tie to one movement history | [S0507](13_SOURCE_CATALOG.md#s0507), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0177 | Share stock only when the physical pool is truly shared | Remote dark store stock is not added to a merchant shelf pool | [S0484](13_SOURCE_CATALOG.md#s0484), [S0507](13_SOURCE_CATALOG.md#s0507) |
| R0178 | Keep available reserved committed damaged and quarantined states explicit | A stock equation fixture explains each quantity exactly | [S0057](13_SOURCE_CATALOG.md#s0057), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0179 | Reserve stock atomically across all enabled channels | Two simultaneous final-unit orders yield one accepted allocation | [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0180 | Require exact location binding for Quick orders | No default location fallback fulfills a Quick line | Owner direction / local design |
| R0181 | Recheck stock before final order commitment | A stale product page cannot oversell the pool | [S0506](13_SOURCE_CATALOG.md#s0506), [S0507](13_SOURCE_CATALOG.md#s0507) |
| R0182 | Use stable stock command idempotency | A lost response cannot cause a second adjustment | Owner direction / local design |
| R0183 | Bind stock receipts to payload identity | The same key with changed quantity returns conflict | [S0506](13_SOURCE_CATALOG.md#s0506), [S0052](13_SOURCE_CATALOG.md#s0052) |
| R0184 | Keep reservation expiry and committed-unpaid expiry distinct | Each sweeper releases only the appropriate stock state | [S0064](13_SOURCE_CATALOG.md#s0064), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0185 | Do not double-subtract reservations from an already-net counter | Recorded quantity semantics match real writer behavior | [S0057](13_SOURCE_CATALOG.md#s0057), [S0044](13_SOURCE_CATALOG.md#s0044) |
| R0186 | Model channel safety buffers without inventing stock | Channel caps never increase physical sellable quantity | [S0506](13_SOURCE_CATALOG.md#s0506), [S0507](13_SOURCE_CATALOG.md#s0507) |
| R0187 | Use audited transfers between physical locations | Source dispatch and destination receipt reconcile discrepancies | [S0502](13_SOURCE_CATALOG.md#s0502), [S0503](13_SOURCE_CATALOG.md#s0503) |
| R0188 | Keep stock ownership separate from storage custody | Same barcode goods of two sellers cannot be consumed interchangeably | [S0043](13_SOURCE_CATALOG.md#s0043) |
| R0189 | Track required batch expiry and quality attributes | Expired or quarantined lots cannot be reserved | [S0037](13_SOURCE_CATALOG.md#s0037) |
| R0190 | Use FEFO for applicable perishable stock | The earliest eligible expiry is selected deterministically | Owner direction / local design |
| R0191 | Validate pack and unit conversions centrally | A conversion cannot create or destroy quantity unnoticed | [S0053](13_SOURCE_CATALOG.md#s0053), [S0502](13_SOURCE_CATALOG.md#s0502) |
| R0192 | Handle returned stock through inspection | Refund completion alone does not restock unsafe goods | Owner direction / local design |
| R0193 | Support cycle count reconciliation with reasons | Physical variance becomes an attributable movement | [S0060](13_SOURCE_CATALOG.md#s0060), [S0068](13_SOURCE_CATALOG.md#s0068) |
| R0194 | Prevent blind absolute overwrites from stale clients | Concurrent sales are not erased by an old stock form | [S0039](13_SOURCE_CATALOG.md#s0039) |
| R0195 | Use location-scoped staff authorization for every stock action | Changing a location ID cannot mutate another branch | [S0507](13_SOURCE_CATALOG.md#s0507), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0196 | Treat availability caches as advisory | Checkout rechecks trusted database stock | Owner direction / local design |
| R0197 | Reconcile aggregate product mirrors with location truth | One branch update cannot overwrite a global total incorrectly | [S0042](13_SOURCE_CATALOG.md#s0042) |
| R0198 | Publish movement and outbox atomically | A committed adjustment cannot lose its required downstream event | [S0057](13_SOURCE_CATALOG.md#s0057), [S0050](13_SOURCE_CATALOG.md#s0050) |
| R0199 | Test sales through Storefront Marketplace Quick and counter | One shared pool decreases once per actual sale | [S0039](13_SOURCE_CATALOG.md#s0039), [S0515](13_SOURCE_CATALOG.md#s0515) |
| R0200 | Reconcile sales that occur during a cycle count | A count adjustment cannot add back units already sold concurrently | Owner direction / local design |

## Counter sales offline and partner synchronization

Implementation owner: Canonical inventory integration, partner feed and offline adapters. Primary budget bucket: P6. [Design detail](04_CATALOG_CHANNELS_AND_SHARED_INVENTORY.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0201 | Treat offline POS as an integration boundary not a separate inventory | Counter sales reach the same owner-variant-location stock authority | [S0507](13_SOURCE_CATALOG.md#s0507), [S0505](13_SOURCE_CATALOG.md#s0505) |
| R0202 | Require trustworthy counter events before promising shared shelves | A supermarket without reliable sync cannot advertise unbounded Quick stock | [S0506](13_SOURCE_CATALOG.md#s0506), [S0507](13_SOURCE_CATALOG.md#s0507) |
| R0203 | Carry external source identity and event identity | Repeated POS feed delivery creates one stock movement | [S0516](13_SOURCE_CATALOG.md#s0516), [S0376](13_SOURCE_CATALOG.md#s0376) |
| R0204 | Carry observation time and freshness status | Stale external inventory is visible and can block Quick intake | [S0495](13_SOURCE_CATALOG.md#s0495), [S0505](13_SOURCE_CATALOG.md#s0505) |
| R0205 | Bind POS events to approved business and location | A terminal cannot select arbitrary tenant stock | [S0507](13_SOURCE_CATALOG.md#s0507), [S0489](13_SOURCE_CATALOG.md#s0489) |
| R0206 | Use incremental replay-safe counter movements where available | A delayed sale cannot overwrite a newer absolute count | [S0515](13_SOURCE_CATALOG.md#s0515), [S0502](13_SOURCE_CATALOG.md#s0502) |
| R0207 | Define absolute snapshot reconciliation rules explicitly | A snapshot has watermark ownership and variance evidence | [S0489](13_SOURCE_CATALOG.md#s0489), [S0382](13_SOURCE_CATALOG.md#s0382) |
| R0208 | Pause unsafe selling when sync freshness breaches policy | The platform does not keep promising unavailable stock | [S0507](13_SOURCE_CATALOG.md#s0507), [S0358](13_SOURCE_CATALOG.md#s0358) |
| R0209 | Reserve stock centrally before online promise | A disconnected counter cache is not allocation authority | [S0484](13_SOURCE_CATALOG.md#s0484), [S0499](13_SOURCE_CATALOG.md#s0499) |
| R0210 | Provide a supervised physical count fallback | Reopening intake requires an attributable reconciled baseline | [S0390](13_SOURCE_CATALOG.md#s0390) |
| R0211 | Separate online and offline return events | One returned item cannot restock twice through two feeds | [S0484](13_SOURCE_CATALOG.md#s0484) |
| R0212 | Fence clock skew and out-of-order events | An older feed cannot move the accepted observation backwards | Owner direction / local design |
| R0213 | Support terminal revocation | A removed terminal cannot submit new sales | [S0533](13_SOURCE_CATALOG.md#s0533), [S0349](13_SOURCE_CATALOG.md#s0349) |
| R0214 | Persist offline intentions without marking success early | A queued command remains pending until its durable server receipt | [S0382](13_SOURCE_CATALOG.md#s0382), [S0523](13_SOURCE_CATALOG.md#s0523) |
| R0215 | Revalidate current permission before replay | Offline work from revoked staff is refused | [S0332](13_SOURCE_CATALOG.md#s0332), [S0330](13_SOURCE_CATALOG.md#s0330) |
| R0216 | Bind retries to stable business commands | App restart retains the original adjustment intent key | [S0367](13_SOURCE_CATALOG.md#s0367), [S0352](13_SOURCE_CATALOG.md#s0352) |
| R0217 | Handle partially accepted bulk feeds transparently | Failed items can be retried without repeating accepted effects | [S0389](13_SOURCE_CATALOG.md#s0389), [S0527](13_SOURCE_CATALOG.md#s0527) |
| R0218 | Avoid secrets and customer documents in local queues | Offline payloads contain only necessary operational data | [S0369](13_SOURCE_CATALOG.md#s0369), [S0483](13_SOURCE_CATALOG.md#s0483) |
| R0219 | Protect local device storage and logout cleanup | A new user cannot inspect the prior business's queue | [S0516](13_SOURCE_CATALOG.md#s0516), [S0353](13_SOURCE_CATALOG.md#s0353) |
| R0220 | Label provisional local inventory visibly | Staff can distinguish server-confirmed from unsynced quantities | [S0483](13_SOURCE_CATALOG.md#s0483), [S0502](13_SOURCE_CATALOG.md#s0502) |
| R0221 | Support scan-to-variant lookup with ambiguity handling | Duplicate barcodes require explicit approved resolution | [S0345](13_SOURCE_CATALOG.md#s0345) |
| R0222 | Keep weighted goods out until measured-unit support is accepted | A fractional item cannot be sold through integer-only stock writers | [S0507](13_SOURCE_CATALOG.md#s0507), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0223 | Keep full native POS construction separately scoped | This research does not silently add another launch application | [S0330](13_SOURCE_CATALOG.md#s0330), [S0351](13_SOURCE_CATALOG.md#s0351) |
| R0224 | Specify partner feed monitoring and escalation owners | A broken integration has an actionable operational alert | [S0335](13_SOURCE_CATALOG.md#s0335) |
| R0225 | Rehearse network loss with concurrent online orders | Reconnect resolves stock without unexplained negative quantity | [S0507](13_SOURCE_CATALOG.md#s0507), [S0362](13_SOURCE_CATALOG.md#s0362) |

## Customer Marketplace and unified modes

Implementation owner: Existing customer application, canonical client and checkout. Primary budget bucket: P4. [Design detail](05_MERCHANT_AND_SELLER_JOURNEYS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0226 | Retain one customer account across both shopping modes | The buyer can switch without another registration | [S0314](13_SOURCE_CATALOG.md#s0314) |
| R0227 | Persist separate Marketplace and Quick baskets | Switching modes cannot mix fulfillment promises | [S0315](13_SOURCE_CATALOG.md#s0315), [S0385](13_SOURCE_CATALOG.md#s0385) |
| R0228 | Key local state by buyer channel seller and location as needed | Account or address changes cannot revive stale data | [S0008](13_SOURCE_CATALOG.md#s0008), [S0338](13_SOURCE_CATALOG.md#s0338) |
| R0229 | Make Marketplace seller pages show eligible Marketplace offers | They do not expose all products of the merchant storefront | [S0029](13_SOURCE_CATALOG.md#s0029) |
| R0230 | Keep native catalog cart and order shopping screens | The customer is not redirected into arbitrary storefront replicas | Owner direction / local design |
| R0231 | Allow supported provider authorization handoffs | Native shopping does not require an unsafe embedded payment verifier | [S0010](13_SOURCE_CATALOG.md#s0010), [S0358](13_SOURCE_CATALOG.md#s0358) |
| R0232 | Explain the actual seller and fulfillment promise | Buyer can identify who sells and how delivery works | [S0315](13_SOURCE_CATALOG.md#s0315), [S0317](13_SOURCE_CATALOG.md#s0317) |
| R0233 | Recompute all totals on the server | Editing client totals cannot reduce payment due | [S0030](13_SOURCE_CATALOG.md#s0030), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0234 | Handle multi-seller Marketplace grouping explicitly | Seller-specific orders fees refunds and delivery promises remain attributable | [S0311](13_SOURCE_CATALOG.md#s0311), [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0235 | Keep Quick launch orders bound to one assigned node | A basket cannot silently become a split-node order | [S0331](13_SOURCE_CATALOG.md#s0331) |
| R0236 | Preserve guest and signed-in basket ownership | Guest transfer cannot duplicate quantities across retries | [S0327](13_SOURCE_CATALOG.md#s0327), [S0349](13_SOURCE_CATALOG.md#s0349) |
| R0237 | Retire stale asynchronous responses after mode changes | An old Quick result cannot replace Marketplace results | [S0008](13_SOURCE_CATALOG.md#s0008), [S0026](13_SOURCE_CATALOG.md#s0026) |
| R0238 | Handle no-service and temporarily-paused locations honestly | The user can still shop Marketplace where eligible | [S0330](13_SOURCE_CATALOG.md#s0330), [S0331](13_SOURCE_CATALOG.md#s0331) |
| R0239 | Provide order-origin filters in shared order history | Buyer can distinguish Marketplace and Quick purchases | [S0028](13_SOURCE_CATALOG.md#s0028) |
| R0240 | Authorize order access through durable buyer links | Matching email text cannot grant another buyer's order | [S0359](13_SOURCE_CATALOG.md#s0359), [S0020](13_SOURCE_CATALOG.md#s0020) |
| R0241 | Recover pending payment after app termination | The original attempt resumes rather than creating another payment | [S0312](13_SOURCE_CATALOG.md#s0312), [S0372](13_SOURCE_CATALOG.md#s0372) |
| R0242 | Show payment pending separately from order confirmation | Client SDK success alone cannot mark an order paid | [S0008](13_SOURCE_CATALOG.md#s0008), [S0012](13_SOURCE_CATALOG.md#s0012) |
| R0243 | Show current prices and stock despite cached discovery | Opening an old card triggers current eligibility handling | [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0244 | Provide accessible quantities addresses and fee disclosure | A user can review and correct the order before paying | [S0004](13_SOURCE_CATALOG.md#s0004), [S0373](13_SOURCE_CATALOG.md#s0373) |
| R0245 | Provide clear cancellation cutoffs and consequences | The displayed policy matches backend enforcement | [S0008](13_SOURCE_CATALOG.md#s0008), [S0034](13_SOURCE_CATALOG.md#s0034) |
| R0246 | Use real order state for tracking | Missing GPS never appears as fabricated rider movement | [S0325](13_SOURCE_CATALOG.md#s0325) |
| R0247 | Scope notifications to the current buyer and device | Switching accounts removes the old token association | [S0010](13_SOURCE_CATALOG.md#s0010), [S0336](13_SOURCE_CATALOG.md#s0336) |
| R0248 | Preserve support and refund access for old orders | A disabled mode does not hide existing purchases | [S0010](13_SOURCE_CATALOG.md#s0010) |
| R0249 | Make deep links mode-aware and ownership-safe | A Marketplace link cannot open Quick checkout with reused state | [S0359](13_SOURCE_CATALOG.md#s0359), [S0366](13_SOURCE_CATALOG.md#s0366) |
| R0250 | Test complete customer journeys through normal UI | No injected session or hidden bypass satisfies release acceptance | [S0340](13_SOURCE_CATALOG.md#s0340), [S0357](13_SOURCE_CATALOG.md#s0357) |

## Reels discovery advertising and promotions

Implementation owner: Existing media/review, advertising, discovery and billing owners. Primary budget bucket: P4. [Design detail](05_MERCHANT_AND_SELLER_JOURNEYS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0251 | Preserve reel-led Marketplace discovery alongside normal browsing | The plan does not replace accepted reels with a generic directory | [S0147](13_SOURCE_CATALOG.md#s0147), [S0154](13_SOURCE_CATALOG.md#s0154) |
| R0252 | Bind every reel to approved exact product or variant | A video cannot sell an unrelated pack | [S0315](13_SOURCE_CATALOG.md#s0315), [S0313](13_SOURCE_CATALOG.md#s0313) |
| R0253 | Keep product approval media approval and match approval separate | Passing transcoding alone never publishes a reel | Owner direction / local design |
| R0254 | Review material media metadata changes | Changed claims thumbnail or caption trigger applicable review | [S0513](13_SOURCE_CATALOG.md#s0513) |
| R0255 | Validate seller and listing eligibility at playback purchase handoff | Revoked products cannot sell through cached reel cards | [S0313](13_SOURCE_CATALOG.md#s0313), [S0318](13_SOURCE_CATALOG.md#s0318) |
| R0256 | Display sponsored placements clearly | A paid placement is distinguishable before interaction | [S0476](13_SOURCE_CATALOG.md#s0476), [S0478](13_SOURCE_CATALOG.md#s0478) |
| R0257 | Preserve CPC CPM and purchase-based billing models | Each configured campaign charges only its accepted event basis | [S0311](13_SOURCE_CATALOG.md#s0311), [S0513](13_SOURCE_CATALOG.md#s0513) |
| R0258 | Fund advertising credits through verified platform charges | A client cannot invent ad balance | [S0320](13_SOURCE_CATALOG.md#s0320) |
| R0259 | Keep advertising credits separate from seller proceeds | Sales settlement cannot silently top up advertising | [S0172](13_SOURCE_CATALOG.md#s0172), [S0180](13_SOURCE_CATALOG.md#s0180) |
| R0260 | Record attribution without treating it as sales origin | A reel referral cannot change Storefront commission policy | [S0174](13_SOURCE_CATALOG.md#s0174) |
| R0261 | Define dedupe and invalid-event rules per ad model | Repeated client events cannot multiply billable effects | [S0172](13_SOURCE_CATALOG.md#s0172) |
| R0262 | Cap campaign spend atomically | Concurrent accepted events cannot exceed the authorized budget | [S0150](13_SOURCE_CATALOG.md#s0150), [S0153](13_SOURCE_CATALOG.md#s0153) |
| R0263 | Bind campaign ownership to current business permissions | A staff member cannot spend another tenant's budget | [S0147](13_SOURCE_CATALOG.md#s0147) |
| R0264 | Snapshot promotion funder and eligible channel | Seller-funded discounts do not become platform liabilities silently | [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0265 | Reverse eligible purchase-based ad effects through attributable entries | Refund handling follows the accepted advertising policy | [S0311](13_SOURCE_CATALOG.md#s0311), [S0313](13_SOURCE_CATALOG.md#s0313) |
| R0266 | Protect against prohibited or misleading product claims | Moderation decisions include evidence and correction paths | [S0172](13_SOURCE_CATALOG.md#s0172), [S0200](13_SOURCE_CATALOG.md#s0200) |
| R0267 | Preserve media access control and signed playback policy | A private rejected asset cannot be retrieved from public listing data | [S0161](13_SOURCE_CATALOG.md#s0161), [S0151](13_SOURCE_CATALOG.md#s0151) |
| R0268 | Make media quotas and retention explicit | Unbounded upload growth cannot hide in a free plan | [S0513](13_SOURCE_CATALOG.md#s0513) |
| R0269 | Use canonical infrastructure adapters for processing | No reserved media service is activated | [S0325](13_SOURCE_CATALOG.md#s0325) |
| R0270 | Keep recommendation ranking explainable at the required level | The buyer can access applicable ranking disclosures | [S0511](13_SOURCE_CATALOG.md#s0511), [S0201](13_SOURCE_CATALOG.md#s0201) |
| R0271 | Apply price-history rules before advertising price reductions | An arbitrary crossed-out price cannot be accepted | [S0507](13_SOURCE_CATALOG.md#s0507), [S0506](13_SOURCE_CATALOG.md#s0506) |
| R0272 | Avoid forced promotional opt-ins across brands | Transactional signup is not blanket advertising consent | [S0145](13_SOURCE_CATALOG.md#s0145), [S0147](13_SOURCE_CATALOG.md#s0147) |
| R0273 | Keep human moderation capacity in the operating plan | Launch volume is bounded by real review staffing | [S0200](13_SOURCE_CATALOG.md#s0200), [S0484](13_SOURCE_CATALOG.md#s0484) |
| R0274 | Test sponsored discovery with rejected and expired listings | Ads cannot bypass normal Marketplace eligibility | Owner direction / local design |
| R0275 | Make advertising charge corrections traceable to original billable events | A reversed charge retains its campaign event and correction reason | [S0168](13_SOURCE_CATALOG.md#s0168), [S0476](13_SOURCE_CATALOG.md#s0476) |

## Quick serviceability and assortment

Implementation owner: Quick module inside gateway, current locations/catalog/checkout. Primary budget bucket: P5. [Design detail](09_DATA_API_AND_CLOUD_ARCHITECTURE.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0276 | Resolve a selected address to one active node for launch | The same inputs and policy revision give the same assignment | [S0057](13_SOURCE_CATALOG.md#s0057), [S0093](13_SOURCE_CATALOG.md#s0093) |
| R0277 | Validate address coordinates on trusted backend logic | Forged client node selection cannot authorize ordering | [S0075](13_SOURCE_CATALOG.md#s0075), [S0055](13_SOURCE_CATALOG.md#s0055) |
| R0278 | Distinguish GPS assistance from the chosen delivery address | Background device movement does not silently change basket scope | [S0054](13_SOURCE_CATALOG.md#s0054), [S0052](13_SOURCE_CATALOG.md#s0052) |
| R0279 | Store service radius in metres with explicit geometry | Seven kilometres cannot be misread as seven metres | [S0057](13_SOURCE_CATALOG.md#s0057), [S0049](13_SOURCE_CATALOG.md#s0049) |
| R0280 | Use boundary-inclusive coverage with documented exclusions | Exact boundary and polygon-hole fixtures behave predictably | [S0297](13_SOURCE_CATALOG.md#s0297) |
| R0281 | Resolve overlapping nodes deterministically | Configured priority distance and stable tie-breaker are reproducible | Owner direction / local design |
| R0282 | Apply operating hours time zone and temporary overrides | Midnight and holiday boundary tests select the correct state | [S0059](13_SOURCE_CATALOG.md#s0059), [S0044](13_SOURCE_CATALOG.md#s0044) |
| R0283 | Separate serviceability from distance and delivery ETA | A circle does not become a guaranteed travel-time promise | [S0059](13_SOURCE_CATALOG.md#s0059), [S0301](13_SOURCE_CATALOG.md#s0301) |
| R0284 | Use routing estimates only under a bounded adapter contract | Maps failure returns a truthful fallback or unavailability | [S0277](13_SOURCE_CATALOG.md#s0277) |
| R0285 | Version coverage policy and quote assignment | A changed zone cannot silently reuse an obsolete eligibility token | [S0089](13_SOURCE_CATALOG.md#s0089) |
| R0286 | Pause intake independently of existing order work | Staff can finish accepted orders while new checkout is disabled | [S0275](13_SOURCE_CATALOG.md#s0275) |
| R0287 | Revalidate node acceptance at quote and submit | A closed store cannot accept a newly invalid order | [S0049](13_SOURCE_CATALOG.md#s0049) |
| R0288 | Bind Quick catalog queries to local approved assortment | Nearby global catalog stock does not appear as local availability | [S0087](13_SOURCE_CATALOG.md#s0087), [S0054](13_SOURCE_CATALOG.md#s0054) |
| R0289 | Keep local price policy seller and node scoped | A different branch price cannot leak into the quote | [S0049](13_SOURCE_CATALOG.md#s0049), [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0290 | Support trusted capacity limits only when operationally justified | A configured pause has clear cause and release procedure | [S0049](13_SOURCE_CATALOG.md#s0049) |
| R0291 | Define accepted-before-close race behavior | Concurrent pause and submit yield one consistent outcome | [S0057](13_SOURCE_CATALOG.md#s0057), [S0093](13_SOURCE_CATALOG.md#s0093) |
| R0292 | Require actual seller and provider mapping for each node | A franchise name cannot substitute for invoice responsibility | [S0056](13_SOURCE_CATALOG.md#s0056), [S0079](13_SOURCE_CATALOG.md#s0079) |
| R0293 | Reject unsupported or restricted SKUs by policy | Broad assortment does not imply every product is permitted | [S0289](13_SOURCE_CATALOG.md#s0289), [S0054](13_SOURCE_CATALOG.md#s0054) |
| R0294 | Invalidate basket scope explicitly after address reassignment | Unavailable items and changed fees require customer review | [S0052](13_SOURCE_CATALOG.md#s0052), [S0060](13_SOURCE_CATALOG.md#s0060) |
| R0295 | Define no-service fallback into Marketplace | The app does not silently convert a Quick order | [S0054](13_SOURCE_CATALOG.md#s0054), [S0049](13_SOURCE_CATALOG.md#s0049) |
| R0296 | Measure geocoding confidence and manual corrections | An ambiguous address cannot be accepted as a precise doorstep | [S0274](13_SOURCE_CATALOG.md#s0274), [S0275](13_SOURCE_CATALOG.md#s0275) |
| R0297 | Protect exact customer coordinates from broad staff lists | Only current operational need exposes the delivery address | [S0064](13_SOURCE_CATALOG.md#s0064), [S0067](13_SOURCE_CATALOG.md#s0067) |
| R0298 | Keep raw rider history separate from serviceability data | Catalog resolution does not require indefinite movement retention | [S0045](13_SOURCE_CATALOG.md#s0045) |
| R0299 | Observe resolver latency and failure modes | Pilot peak tests stay within agreed measured budgets | [S0292](13_SOURCE_CATALOG.md#s0292), [S0277](13_SOURCE_CATALOG.md#s0277) |
| R0300 | Test two locations under the same seller as well as different sellers | Tenant checks alone cannot mask location-isolation defects | [S0291](13_SOURCE_CATALOG.md#s0291), [S0293](13_SOURCE_CATALOG.md#s0293) |

## Store Ops dark-store execution

Implementation owner: Promoted Store Ops source and canonical fulfillment/inventory. Primary budget bucket: P5. [Design detail](06_QUICK_FRANCHISE_AND_SUPERMARKETS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0301 | Reuse existing Store Ops source controllers and useful tests | Promotion retains verified source lineage | [S0379](13_SOURCE_CATALOG.md#s0379) |
| R0302 | Replace empty donor token providers with canonical auth | A normal staff login reaches only assigned locations | [S0360](13_SOURCE_CATALOG.md#s0360), [S0370](13_SOURCE_CATALOG.md#s0370) |
| R0303 | Show local paid or eligible COD orders only | Unpaid prepaid orders do not enter picking | [S0038](13_SOURCE_CATALOG.md#s0038), [S0373](13_SOURCE_CATALOG.md#s0373) |
| R0304 | Claim fulfillment tasks atomically with version checks | Two pickers cannot independently own the same active task | [S0355](13_SOURCE_CATALOG.md#s0355), [S0334](13_SOURCE_CATALOG.md#s0334) |
| R0305 | Provide clear task lease and interruption recovery | Abandoned picking returns through an auditable rule | [S0036](13_SOURCE_CATALOG.md#s0036) |
| R0306 | Generate a pick list from committed order facts | A later catalog edit cannot change the promised pack | [S0349](13_SOURCE_CATALOG.md#s0349) |
| R0307 | Scan exact variant and applicable lot | Wrong item barcode cannot complete the line | [S0038](13_SOURCE_CATALOG.md#s0038) |
| R0308 | Apply FEFO and minimum remaining-life rules | An ineligible lot cannot pass packing checks | [S0330](13_SOURCE_CATALOG.md#s0330) |
| R0309 | Record missing damaged or unsafe stock exceptions | Staff cannot fabricate picked quantity to clear a queue | Owner direction / local design |
| R0310 | Use the agreed full-cancel policy until substitutions are built | A missing item cannot become an unauthorized replacement | Owner direction / local design |
| R0311 | Require authorized price or quantity exception handling | Picker edits cannot change financial totals locally | Owner direction / local design |
| R0312 | Separate picking packing ready and handover states | A display-only screen cannot mark custody complete | [S0340](13_SOURCE_CATALOG.md#s0340), [S0038](13_SOURCE_CATALOG.md#s0038) |
| R0313 | Create sealed package identity and audit facts | The rider collects the package belonging to the exact order | [S0390](13_SOURCE_CATALOG.md#s0390) |
| R0314 | Verify current accepted rider assignment at pickup | An expired offer cannot authorize handover | [S0043](13_SOURCE_CATALOG.md#s0043) |
| R0315 | Use assignment-bound pickup proof with replay protection | A reused QR or challenge cannot transfer custody twice | [S0349](13_SOURCE_CATALOG.md#s0349) |
| R0316 | Keep customer contact access proportionate | A stock counter cannot browse unrelated customer addresses | Owner direction / local design |
| R0317 | Support receiving putaway quarantine and cycle counts | Physical goods reconcile with canonical movements | [S0385](13_SOURCE_CATALOG.md#s0385) |
| R0318 | Record returns through supervised inspection | Unsafe returned food remains unavailable | [S0359](13_SOURCE_CATALOG.md#s0359) |
| R0319 | Recheck permissions on every recovered offline task | A revoked staff device cannot complete an old command | [S0371](13_SOURCE_CATALOG.md#s0371), [S0336](13_SOURCE_CATALOG.md#s0336) |
| R0320 | Recover durable action receipts after network loss | A retry cannot repeat stock or custody effects | Owner direction / local design |
| R0321 | Provide shift opening and closing operational checks | Pending packages stock variances and cash issues stay visible | [S0036](13_SOURCE_CATALOG.md#s0036), [S0330](13_SOURCE_CATALOG.md#s0330) |
| R0322 | Measure pick accuracy ready time and handover waiting | Metrics derive from real state events | [S0384](13_SOURCE_CATALOG.md#s0384), [S0383](13_SOURCE_CATALOG.md#s0383) |
| R0323 | Expose supervisor escalation without silent state override | Exceptional transitions require authority reason and audit | [S0331](13_SOURCE_CATALOG.md#s0331) |
| R0324 | Keep source app identity and workspace admission explicit | The promoted app is included only after scoped governance alignment | [S0373](13_SOURCE_CATALOG.md#s0373), [S0340](13_SOURCE_CATALOG.md#s0340) |
| R0325 | Rehearse a complete staff order through actual backend writers | Fake repository tests alone cannot pass production acceptance | [S0375](13_SOURCE_CATALOG.md#s0375) |

## Delivery assignment custody and tracking

Implementation owner: Existing Delivery source and canonical dispatch/custody module. Primary budget bucket: P6. [Design detail](06_QUICK_FRANCHISE_AND_SUPERMARKETS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0326 | Reuse the existing deferred Delivery source | Existing screens survive canonical API integration | [S0376](13_SOURCE_CATALOG.md#s0376) |
| R0327 | Use approved rider membership without merchant-owner privilege | A rider cannot edit products or merchant finance | Owner direction / local design |
| R0328 | Model online availability separately from active assignment | Going offline cannot erase an in-progress delivery | Owner direction / local design |
| R0329 | Offer assignments with bounded expiry | Expired offers cannot be accepted | Owner direction / local design |
| R0330 | Accept an offer atomically against rider occupancy | Two concurrent offers cannot assign one rider inconsistently | [S0290](13_SOURCE_CATALOG.md#s0290) |
| R0331 | Reoffer rejected or expired work through durable jobs | A failed offer does not strand an order | [S0330](13_SOURCE_CATALOG.md#s0330) |
| R0332 | Verify store arrival and pickup custody separately | GPS proximity alone cannot mark package collected | [S0287](13_SOURCE_CATALOG.md#s0287) |
| R0333 | Prevent ordinary reassignment after pickup | Post-pickup transfer requires a supervised custody process | [S0296](13_SOURCE_CATALOG.md#s0296), [S0349](13_SOURCE_CATALOG.md#s0349) |
| R0334 | Use assignment-bound delivery authorization | A former rider cannot complete the reassigned task | Owner direction / local design |
| R0335 | Request only justified location permissions | Denied background permission produces an honest degraded state | [S0336](13_SOURCE_CATALOG.md#s0336), [S0337](13_SOURCE_CATALOG.md#s0337) |
| R0336 | Use physical-device background tracking acceptance | Emulator success cannot certify screen-off delivery tracking | [S0334](13_SOURCE_CATALOG.md#s0334), [S0331](13_SOURCE_CATALOG.md#s0331) |
| R0337 | Validate location age accuracy and plausible ordering | Stale or replayed GPS does not show current movement | [S0336](13_SOURCE_CATALOG.md#s0336), [S0334](13_SOURCE_CATALOG.md#s0334) |
| R0338 | Show stale tracking status to buyer and dispatcher | Missing updates do not produce invented route animation | [S0288](13_SOURCE_CATALOG.md#s0288), [S0279](13_SOURCE_CATALOG.md#s0279) |
| R0339 | Use bounded retention for detailed location history | Unnecessary raw movement data expires under approved policy | [S0336](13_SOURCE_CATALOG.md#s0336), [S0291](13_SOURCE_CATALOG.md#s0291) |
| R0340 | Use rate-limited one-time recipient delivery proof | Replayed OTP cannot complete another order | [S0376](13_SOURCE_CATALOG.md#s0376), [S0336](13_SOURCE_CATALOG.md#s0336) |
| R0341 | Provide an authorized alternative proof path | Accessibility or network problems have audited support recovery | [S0395](13_SOURCE_CATALOG.md#s0395), [S0396](13_SOURCE_CATALOG.md#s0396) |
| R0342 | Keep incident photographs private and optional as appropriate | Ordinary delivery does not require photographing identity documents | [S0306](13_SOURCE_CATALOG.md#s0306) |
| R0343 | Separate delivered goods from verified COD collection | One status change cannot invent both cash and custody evidence | [S0287](13_SOURCE_CATALOG.md#s0287), [S0274](13_SOURCE_CATALOG.md#s0274) |
| R0344 | Keep exact tender amount and collector assignment | A rider cannot report another collector's cash | [S0336](13_SOURCE_CATALOG.md#s0336) |
| R0345 | Handle unavailable customer and failed attempt states | Failed delivery cannot be recorded as successful to close work | [S0331](13_SOURCE_CATALOG.md#s0331) |
| R0346 | Track return custody back to the authorized node | A returned package remains accountable until received | [S0276](13_SOURCE_CATALOG.md#s0276), [S0278](13_SOURCE_CATALOG.md#s0278) |
| R0347 | Use durable command recovery across app termination | Pickup or delivery retries create one effect | [S0368](13_SOURCE_CATALOG.md#s0368), [S0390](13_SOURCE_CATALOG.md#s0390) |
| R0348 | Derive rider earnings from eligible recorded work | There is no editable wallet balance as money truth | [S0330](13_SOURCE_CATALOG.md#s0330) |
| R0349 | Keep customer contact masked or scoped where supported | A rider loses access after operational need ends | [S0284](13_SOURCE_CATALOG.md#s0284), [S0333](13_SOURCE_CATALOG.md#s0333) |
| R0350 | Test reject expire reassign return and stale-GPS journeys | Normal and failure paths share the real assignment authority | Owner direction / local design |

## Franchise and supermarket commercial relationships

Implementation owner: Founder/partner contract owners, business/location and finance. Primary budget bucket: P0. [Design detail](06_QUICK_FRANCHISE_AND_SUPERMARKETS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0351 | Separate merchant-owned supermarket and dedicated franchise models | Each node has an explicit ownership and contract type | Owner direction / local design |
| R0352 | Use franchisee-owned stock as the current default proposal | Seller invoice stock loss and payment responsibility agree | Owner direction / local design |
| R0353 | Retain managed-operator partnerships as a distinct optional model | An operator paid by the platform is not charged the same fee stack blindly | Owner direction / local design |
| R0354 | Keep landlord property lease separate from franchise operations | A property agreement grants no selling or staff permissions | Owner direction / local design |
| R0355 | Define who pays setup equipment rent staff and utilities | The signed responsibility matrix has no unassigned cost bucket | Owner direction / local design |
| R0356 | Define who funds merchandise working capital | Forecasts include replenishment cash and settlement delay | Owner direction / local design |
| R0357 | Define stock spoilage shortage theft and insurance responsibility | Loss events map to the correct liable party | Owner direction / local design |
| R0358 | Define delivery cost allocation and failed-trip responsibility | Each trip outcome has an attributable commercial treatment | Owner direction / local design |
| R0359 | Cost onboarding before setting a one-time fee | Training hardware and launch work have defensible line items | [S0269](13_SOURCE_CATALOG.md#s0269), [S0205](13_SOURCE_CATALOG.md#s0205) |
| R0360 | Separate refundable security from earned revenue | A deposit is never reported as sales or contribution profit | Owner direction / local design |
| R0361 | Avoid collecting deposits before approved contractual handling exists | A research scenario cannot trigger a payment request | Owner direction / local design |
| R0362 | Charge recurring platform access per agreed unit | Business location terminal and staff billing units are unambiguous | [S0205](13_SOURCE_CATALOG.md#s0205), [S0269](13_SOURCE_CATALOG.md#s0269) |
| R0363 | Choose one primary variable platform fee basis | The same service is not charged as commission and royalty twice | [S0267](13_SOURCE_CATALOG.md#s0267) |
| R0364 | Restrict franchise royalty scope to eligible Quick business | Shared Storefront stock does not expose zero-commission sales to royalty | [S0203](13_SOURCE_CATALOG.md#s0203) |
| R0365 | Define royalty basis exclusions and refund reversals | Taxes cancellations returns and pass-through charges follow explicit rules | [S0272](13_SOURCE_CATALOG.md#s0272) |
| R0366 | Specify franchise brand standards and audit rights | Noncompliance uses recorded correction and escalation procedures | Owner direction / local design |
| R0367 | Define territory commitments without unearned exclusivity guarantees | Coverage assignment is distinct from contractual territory rights | Owner direction / local design |
| R0368 | Define training staffing and operating-hours commitments | The partner can meet the actual pilot service schedule | Owner direction / local design |
| R0369 | Require supermarket shelf sync or protected Quick allocation | An offline sale cannot make unbounded online promises unsafe | [S0273](13_SOURCE_CATALOG.md#s0273), [S0204](13_SOURCE_CATALOG.md#s0204) |
| R0370 | Separate shared shelves from dedicated picking zones | Picking capacity and stock control are physically credible | Owner direction / local design |
| R0371 | Model multi-owner custody only through explicit agreements | Owner goods cannot be commingled by barcode | Owner direction / local design |
| R0372 | Define stock withdrawal termination and unfinished-order treatment | Partner exit preserves goods customer obligations and statements | Owner direction / local design |
| R0373 | Do not promise competitor returns or payback figures | Every forecast is an assumption-based sensitivity case | Owner direction / local design |
| R0374 | Gate network expansion on measured unit economics and service | More stores cannot hide negative contribution per order | [S0204](13_SOURCE_CATALOG.md#s0204) |
| R0375 | Keep partner recruitment charges and payments under later authorization | This research sends no franchise offer or external transaction | [S0267](13_SOURCE_CATALOG.md#s0267) |

## Channel charges subscriptions and fee schedules

Implementation owner: Canonical commercial/billing/checkout/ledger owners. Primary budget bucket: P7. [Design detail](07_COMMERCIAL_MODELS_AND_UNIT_ECONOMICS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0376 | Keep storefront sales commission hard-zero | A shared-product sale through Storefront incurs no Marketplace commission | [S0329](13_SOURCE_CATALOG.md#s0329), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0377 | Use category-based Marketplace commission as confirmed direction | The schedule selects a valid category rule at purchase time | [S0473](13_SOURCE_CATALOG.md#s0473) |
| R0378 | Support price-band exceptions and zero-rate categories | A category-only flat percentage cannot override an approved band rule | [S0329](13_SOURCE_CATALOG.md#s0329), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0379 | Effective-date every commercial schedule | Historical orders retain the schedule effective when created | [S0436](13_SOURCE_CATALOG.md#s0436), [S0437](13_SOURCE_CATALOG.md#s0437) |
| R0380 | Snapshot fee basis rate rounding currency and version | Recomputing an old statement does not use today's rate | [S0319](13_SOURCE_CATALOG.md#s0319), [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0381 | Calculate fees on trusted server amounts | A client cannot submit its desired commission percentage | [S0329](13_SOURCE_CATALOG.md#s0329), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0382 | Define discount and tax treatment in the fee basis | Worked examples cover seller and platform-funded discounts | [S0462](13_SOURCE_CATALOG.md#s0462) |
| R0383 | Keep payment shipping subscription advertising and commission lines distinct | A zero-commission claim cannot conceal another mandatory sales percentage | [S0329](13_SOURCE_CATALOG.md#s0329), [S0462](13_SOURCE_CATALOG.md#s0462) |
| R0384 | Show a complete seller net-proceeds estimate | The estimate identifies uncertain provider and logistics amounts | [S0432](13_SOURCE_CATALOG.md#s0432), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0385 | Version tax and withholding applicability separately | An old hardcoded tax rate cannot govern a new period automatically | [S0329](13_SOURCE_CATALOG.md#s0329), [S0414](13_SOURCE_CATALOG.md#s0414) |
| R0386 | Handle caps minimums and rounding explicitly | Boundary values match reviewed integer-minor-unit examples | [S0323](13_SOURCE_CATALOG.md#s0323), [S0324](13_SOURCE_CATALOG.md#s0324) |
| R0387 | Prevent unpublished rate changes from taking effect | Only an approved active schedule authorizes a new charge | [S0466](13_SOURCE_CATALOG.md#s0466), [S0322](13_SOURCE_CATALOG.md#s0322) |
| R0388 | Record who accepted commercial terms and when | A staff edit cannot fabricate owner consent | [S0312](13_SOURCE_CATALOG.md#s0312), [S0318](13_SOURCE_CATALOG.md#s0318) |
| R0389 | Provide appropriate notice for future schedule changes | The seller can identify the effective date and affected channel | [S0452](13_SOURCE_CATALOG.md#s0452), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0390 | Reconcile legacy blanket-zero governance with current channel policy | Storefront protection survives scoped Marketplace alignment | [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0391 | Bill platform subscriptions through canonical billing history | A subscription payment does not create a fake commerce order | [S0462](13_SOURCE_CATALOG.md#s0462), [S0467](13_SOURCE_CATALOG.md#s0467) |
| R0392 | Separate failed billing from existing-order obligations | Payment delinquency cannot block lawful refunds and statements | [S0420](13_SOURCE_CATALOG.md#s0420), [S0427](13_SOURCE_CATALOG.md#s0427) |
| R0393 | Avoid charging all franchise fee types by default | One-time subscription royalty and per-order service fees need distinct consideration | [S0473](13_SOURCE_CATALOG.md#s0473), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0394 | Test refund and cancellation fee reversals | The original charge's policy controls its compensating entry | [S0417](13_SOURCE_CATALOG.md#s0417), [S0418](13_SOURCE_CATALOG.md#s0418) |
| R0395 | State whether each quoted amount includes applicable tax | A partner does not discover an undisclosed tax layer after signing | [S0444](13_SOURCE_CATALOG.md#s0444), [S0426](13_SOURCE_CATALOG.md#s0426) |
| R0396 | Keep founding and contracted plan commitments visible | A generic rate update cannot erase an existing commitment | [S0312](13_SOURCE_CATALOG.md#s0312), [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0397 | Meter optional services from attributable usage | An unexplained usage counter cannot create an invoice | [S0430](13_SOURCE_CATALOG.md#s0430), [S0431](13_SOURCE_CATALOG.md#s0431) |
| R0398 | Provide dispute and correction workflows for charges | A correction is an auditable adjustment not a history rewrite | [S0319](13_SOURCE_CATALOG.md#s0319) |
| R0399 | Apply fee scope by order origin and actual service | Editing through Seller cannot make a storefront sale commissionable | [S0316](13_SOURCE_CATALOG.md#s0316) |
| R0400 | Do not treat simulated prices as approved commercial offers | Illustrative calculator values remain disabled configuration examples | [S0422](13_SOURCE_CATALOG.md#s0422) |

## Payments ledger COD and settlements

Implementation owner: Existing capture/refund/COD/ledger/settlement writers. Primary budget bucket: P7. [Design detail](08_CHECKOUT_MONEY_AND_SETTLEMENT.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0401 | Reuse the canonical double-entry ledger as sole money truth | Every accepted posting balances debits and credits | [S0412](13_SOURCE_CATALOG.md#s0412), [S0436](13_SOURCE_CATALOG.md#s0436) |
| R0402 | Use provider-managed seller collection and approved settlement | The platform does not introduce a self-custody disbursement rail | [S0429](13_SOURCE_CATALOG.md#s0429), [S0093](13_SOURCE_CATALOG.md#s0093) |
| R0403 | Map each seller to an approved provider beneficiary | A generic platform merchant ID cannot substitute for seller eligibility | [S0049](13_SOURCE_CATALOG.md#s0049), [S0057](13_SOURCE_CATALOG.md#s0057) |
| R0404 | Keep the current Marketplace payment guard fail-closed | A demo cannot bypass provider-readiness refusal | [S0414](13_SOURCE_CATALOG.md#s0414), [S0420](13_SOURCE_CATALOG.md#s0420) |
| R0405 | Bind provider order amount currency seller and local attempt | A valid signature for another reference cannot confirm this order | [S0414](13_SOURCE_CATALOG.md#s0414), [S0075](13_SOURCE_CATALOG.md#s0075) |
| R0406 | Capture verify and webhook through one canonical writer | Double verification and webhook delivery have one financial effect | [S0473](13_SOURCE_CATALOG.md#s0473), [S0439](13_SOURCE_CATALOG.md#s0439) |
| R0407 | Persist an intent before external provider calls | Timeout recovery can find the original business operation | [S0441](13_SOURCE_CATALOG.md#s0441), [S0473](13_SOURCE_CATALOG.md#s0473) |
| R0408 | Recover unknown provider outcomes before retrying | An ambiguous timeout cannot cause a second charge | [S0057](13_SOURCE_CATALOG.md#s0057) |
| R0409 | Keep payment captured and order fulfillable separate | Late capture after stock expiry creates explained refund or suspense work | [S0414](13_SOURCE_CATALOG.md#s0414), [S0421](13_SOURCE_CATALOG.md#s0421) |
| R0410 | Use immutable order-line financial snapshots | Category or price edits cannot rewrite existing obligations | [S0075](13_SOURCE_CATALOG.md#s0075), [S0049](13_SOURCE_CATALOG.md#s0049) |
| R0411 | Extend existing locked COD collection writers | Quick does not create a parallel authoritative cash ledger | [S0412](13_SOURCE_CATALOG.md#s0412), [S0417](13_SOURCE_CATALOG.md#s0417) |
| R0412 | Separate cash collection from seller remittance | A rider report alone does not prove banked or handed-over funds | [S0417](13_SOURCE_CATALOG.md#s0417) |
| R0413 | Require attributable custody and two-party cash close | Collector and recipient evidence explain every cash handover | [S0055](13_SOURCE_CATALOG.md#s0055) |
| R0414 | Record shortage overage dispute and resolution explicitly | Cash differences are not hidden by a zero clamp | [S0083](13_SOURCE_CATALOG.md#s0083) |
| R0415 | Keep provider settlement status distinct from eligibility | Paid orders can still be held under an applicable return policy | [S0057](13_SOURCE_CATALOG.md#s0057), [S0085](13_SOURCE_CATALOG.md#s0085) |
| R0416 | Preserve weekly eligible settlement direction where provider-supported | Actual cutoff holds and releases follow approved contracts | [S0073](13_SOURCE_CATALOG.md#s0073), [S0441](13_SOURCE_CATALOG.md#s0441) |
| R0417 | Use atomic settlement batch inclusion | An eligible obligation cannot enter two payout instructions | [S0428](13_SOURCE_CATALOG.md#s0428), [S0432](13_SOURCE_CATALOG.md#s0432) |
| R0418 | Process refunds through durable bounded intents | Duplicate requests cannot exceed the original refundable amount | [S0444](13_SOURCE_CATALOG.md#s0444), [S0443](13_SOURCE_CATALOG.md#s0443) |
| R0419 | Use verified provider evidence for completed refunds | An accepted API request cannot be shown as refunded cash | [S0442](13_SOURCE_CATALOG.md#s0442), [S0443](13_SOURCE_CATALOG.md#s0443) |
| R0420 | Keep COD refund rail explicit and eligible | A phone number alone cannot authorize an arbitrary transfer | [S0416](13_SOURCE_CATALOG.md#s0416), [S0057](13_SOURCE_CATALOG.md#s0057) |
| R0421 | Reconcile PSP COD ledger and statements | Every break is zero or attributable explained suspense | [S0056](13_SOURCE_CATALOG.md#s0056), [S0058](13_SOURCE_CATALOG.md#s0058) |
| R0422 | Protect append-only money and audit history | Corrections use compensating entries and schema-level protections | [S0064](13_SOURCE_CATALOG.md#s0064), [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0423 | Keep platform-charge verification separate from commerce orders | Ads and subscriptions reuse the existing shared verifier | [S0469](13_SOURCE_CATALOG.md#s0469), [S0449](13_SOURCE_CATALOG.md#s0449) |
| R0424 | Test failure between external success and local commit | The result becomes recoverable suspense rather than stranded money | Owner direction / local design |
| R0425 | Track chargebacks and negative seller adjustments explicitly | A disputed settled sale leaves an explainable outstanding obligation | [S0057](13_SOURCE_CATALOG.md#s0057), [S0412](13_SOURCE_CATALOG.md#s0412) |

## Returns support trust and operations

Implementation owner: Existing order/support/refund owners and operating teams. Primary budget bucket: P7. [Design detail](08_CHECKOUT_MONEY_AND_SETTLEMENT.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0426 | Publish channel-specific cancellation and return policies | The buyer sees the policy applicable to the exact order | [S0311](13_SOURCE_CATALOG.md#s0311), [S0325](13_SOURCE_CATALOG.md#s0325) |
| R0427 | Keep return request approval receipt inspection and refund distinct | One user action cannot claim every outcome complete | [S0327](13_SOURCE_CATALOG.md#s0327), [S0328](13_SOURCE_CATALOG.md#s0328) |
| R0428 | Preserve original seller and node responsibility | A support reassignment does not change invoice ownership | [S0319](13_SOURCE_CATALOG.md#s0319), [S0321](13_SOURCE_CATALOG.md#s0321) |
| R0429 | Allow support for suspended or closed channels | Existing buyers can still access lawful remedies | [S0315](13_SOURCE_CATALOG.md#s0315), [S0317](13_SOURCE_CATALOG.md#s0317) |
| R0430 | Use buyer-owned ticket and order links | A guessed order ID cannot reveal another customer's case | [S0319](13_SOURCE_CATALOG.md#s0319), [S0327](13_SOURCE_CATALOG.md#s0327) |
| R0431 | Separate buyer-visible replies from internal operational notes | Internal reviewer or incident content does not leak | [S0319](13_SOURCE_CATALOG.md#s0319), [S0321](13_SOURCE_CATALOG.md#s0321) |
| R0432 | Use idempotent support mutations and action receipts | Retrying a reply or resolution cannot duplicate side effects | [S0319](13_SOURCE_CATALOG.md#s0319), [S0328](13_SOURCE_CATALOG.md#s0328) |
| R0433 | Record an audit reason for privileged overrides | An operator cannot silently rewrite financial or custody state | [S0328](13_SOURCE_CATALOG.md#s0328) |
| R0434 | Keep safety recalls distinct from ordinary returns | Affected lots can be blocked across relevant channels | [S0329](13_SOURCE_CATALOG.md#s0329) |
| R0435 | Handle fresh chilled and temperature-excursion exceptions | Unsafe items do not re-enter sellable stock | [S0323](13_SOURCE_CATALOG.md#s0323), [S0324](13_SOURCE_CATALOG.md#s0324) |
| R0436 | Define missing-item and wrong-item evidence proportionately | Customers are not forced to upload unnecessary sensitive data | [S0327](13_SOURCE_CATALOG.md#s0327) |
| R0437 | Track delivery failure and return-to-origin costs | The responsible party and adjustment basis remain explainable | [S0311](13_SOURCE_CATALOG.md#s0311), [S0315](13_SOURCE_CATALOG.md#s0315) |
| R0438 | Support partial refunds only with accepted line allocation | No local client arithmetic invents a refundable amount | [S0322](13_SOURCE_CATALOG.md#s0322), [S0328](13_SOURCE_CATALOG.md#s0328) |
| R0439 | Provide an appeal or complaint escalation route | Rejected decisions have a recorded responsible reviewer | [S0318](13_SOURCE_CATALOG.md#s0318), [S0321](13_SOURCE_CATALOG.md#s0321) |
| R0440 | Retain the customer's recorded complaint copy | A completed intake can provide the accepted complaint text | [S0318](13_SOURCE_CATALOG.md#s0318), [S0319](13_SOURCE_CATALOG.md#s0319) |
| R0441 | Identify actual seller and grievance contacts | Brand names do not obscure the responsible business | [S0320](13_SOURCE_CATALOG.md#s0320) |
| R0442 | Expose promised and observed service separately | An estimate is not retrospectively rewritten to hide lateness | [S0325](13_SOURCE_CATALOG.md#s0325), [S0315](13_SOURCE_CATALOG.md#s0315) |
| R0443 | Measure incident response during all operating hours | A pilot cannot run without an accountable support owner | [S0319](13_SOURCE_CATALOG.md#s0319), [S0328](13_SOURCE_CATALOG.md#s0328) |
| R0444 | Monitor recurring stock cash and provider failures | Operators receive actionable alerts with scoped record links | [S0269](13_SOURCE_CATALOG.md#s0269) |
| R0445 | Provide safe store pause and intake disable controls | A local incident need not stop unrelated channels | [S0319](13_SOURCE_CATALOG.md#s0319), [S0315](13_SOURCE_CATALOG.md#s0315) |
| R0446 | Use audited customer-contact access | Support cannot browse personal data without legitimate scope | [S0271](13_SOURCE_CATALOG.md#s0271), [S0319](13_SOURCE_CATALOG.md#s0319) |
| R0447 | Preserve evidence retention and legal holds | Routine deletion cannot erase required dispute records | Owner direction / local design |
| R0448 | Close cases only after linked obligations are resolved or explained | A ticket status cannot conceal a pending refund | [S0328](13_SOURCE_CATALOG.md#s0328), [S0311](13_SOURCE_CATALOG.md#s0311) |
| R0449 | Rehearse an incident with staff rider seller and buyer roles | Recovery works without database edits by an unrestricted operator | Owner direction / local design |
| R0450 | Preserve customer communication delivery evidence separately from send intent | An unsent notification cannot be recorded as received by the buyer | [S0325](13_SOURCE_CATALOG.md#s0325), [S0326](13_SOURCE_CATALOG.md#s0326) |

## India compliance privacy and data rights

Implementation owner: Applicable professional owners, privacy/support/product/finance. Primary budget bucket: P8. [Design detail](10_COMPLIANCE_SECURITY_AND_OPERATIONS.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0451 | Maintain a dated legal applicability matrix | Each obligation identifies entity category geography and effective period | [S0206](13_SOURCE_CATALOG.md#s0206), [S0217](13_SOURCE_CATALOG.md#s0217) |
| R0452 | Separate rules in force from future commencement | January 2027 changes are not labelled already effective in October 2026 | [S0213](13_SOURCE_CATALOG.md#s0213) |
| R0453 | Obtain applicable food-business registrations for actual activities | A platform badge cannot replace the seller's valid evidence | [S0270](13_SOURCE_CATALOG.md#s0270) |
| R0454 | Display required seller and food-business details | Relevant listing and checkout views expose approved current disclosures | [S0269](13_SOURCE_CATALOG.md#s0269), [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0455 | Configure shelf-life and labeling checks by applicable rule | A historical advisory is not blindly applied to every category | [S0234](13_SOURCE_CATALOG.md#s0234) |
| R0456 | Protect KYC documents and financial identifiers | Public product APIs cannot return private onboarding records | [S0209](13_SOURCE_CATALOG.md#s0209) |
| R0457 | Use purpose-specific consent and notices across brands | Shared login does not imply blanket marketing or data sharing | [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0458 | Track consent version purpose and withdrawal | A changed preference reaches affected processing paths | [S0217](13_SOURCE_CATALOG.md#s0217), [S0245](13_SOURCE_CATALOG.md#s0245) |
| R0459 | Plan phased DPDP readiness against actual commencement | A future launch includes the obligations applicable on its date | [S0220](13_SOURCE_CATALOG.md#s0220), [S0236](13_SOURCE_CATALOG.md#s0236) |
| R0460 | Minimize customer location and rider movement data | Only required actors and retention windows receive access | [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0461 | Support identity-verified access correction and deletion requests | A matching email alone cannot release personal records | [S0207](13_SOURCE_CATALOG.md#s0207) |
| R0462 | Keep financial retention and legal-hold exceptions explicit | Erasure does not destroy required append-only obligations | [S0209](13_SOURCE_CATALOG.md#s0209), [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0463 | Label advertising and sponsored ranking appropriately | Paid placement cannot masquerade as organic relevance | [S0211](13_SOURCE_CATALOG.md#s0211) |
| R0464 | Preserve applicable price-history evidence for discounts | Promotional claims can be reconstructed for the relevant period | [S0210](13_SOURCE_CATALOG.md#s0210), [S0223](13_SOURCE_CATALOG.md#s0223) |
| R0465 | Avoid misleading urgency hidden fees and forced consent | A checkout review finds no prohibited dark-pattern dependency | [S0212](13_SOURCE_CATALOG.md#s0212), [S0233](13_SOURCE_CATALOG.md#s0233) |
| R0466 | Provide actual grievance ownership and escalation | The responsible contact is more than an unused text field | [S0218](13_SOURCE_CATALOG.md#s0218), [S0220](13_SOURCE_CATALOG.md#s0220) |
| R0467 | Prepare consumer-helpline convergence where applicable | The release checklist records actual onboarding or an unresolved requirement | Owner direction / local design |
| R0468 | Verify current GST tax invoicing and withholding policy professionally | No legal conclusion is inferred from a legacy column name | [S0264](13_SOURCE_CATALOG.md#s0264) |
| R0469 | Separate commercial royalty taxation from goods taxation | Invoices use the approved supply classification and current configuration | [S0263](13_SOURCE_CATALOG.md#s0263), [S0264](13_SOURCE_CATALOG.md#s0264) |
| R0470 | Avoid treating every seller as needing identical tax documents | Applicability follows real entity category and geography | [S0207](13_SOURCE_CATALOG.md#s0207), [S0209](13_SOURCE_CATALOG.md#s0209) |
| R0471 | Review franchise agreements deposits and territory clauses | An illustrative financial model is not a signed legal arrangement | [S0264](13_SOURCE_CATALOG.md#s0264), [S0268](13_SOURCE_CATALOG.md#s0268) |
| R0472 | Keep safety and privacy incident escalation actionable | Staff know the approved reporting owner and evidence procedure | [S0209](13_SOURCE_CATALOG.md#s0209) |
| R0473 | Review app-store disclosures against actual SDK behavior | Declared data use matches collected data and permissions | [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0474 | Complete trademark domain and app-name clearance before branding release | Search-engine absence is not presented as legal availability | [S0248](13_SOURCE_CATALOG.md#s0248), [S0211](13_SOURCE_CATALOG.md#s0211) |
| R0475 | Keep all mandatory professional and provider decisions visible | Research completion does not fabricate approvals | [S0209](13_SOURCE_CATALOG.md#s0209), [S0214](13_SOURCE_CATALOG.md#s0214) |

## Cloud infrastructure reliability and costs

Implementation owner: Existing runtime, infrastructure adapters and operational owners. Primary budget bucket: P8. [Design detail](09_DATA_API_AND_CLOUD_ARCHITECTURE.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0476 | Retain the existing modular monolith and approved satellites | No channel-specific backend fleet appears in deployment config | [S0194](13_SOURCE_CATALOG.md#s0194) |
| R0477 | Keep one region until measured approved triggers | The plan adds no speculative sharding or multi-region runtime | [S0172](13_SOURCE_CATALOG.md#s0172) |
| R0478 | Use pooled PostgreSQL connections appropriately for Workers | Peak concurrency does not exceed actual database capacity | [S0150](13_SOURCE_CATALOG.md#s0150), [S0187](13_SOURCE_CATALOG.md#s0187) |
| R0479 | Set tenant context inside real transactions | REST calls cannot pretend to establish durable session GUC isolation | [S0094](13_SOURCE_CATALOG.md#s0094) |
| R0480 | Budget Worker requests CPU and subrequests | Cost and limit tests use the selected deployment plan | [S0189](13_SOURCE_CATALOG.md#s0189), [S0196](13_SOURCE_CATALOG.md#s0196) |
| R0481 | Treat Queues delivery as repeatable | Consumers deduplicate durable business effects | [S0158](13_SOURCE_CATALOG.md#s0158), [S0152](13_SOURCE_CATALOG.md#s0152) |
| R0482 | Commit outbox and domain mutation together | A local success cannot lose its required queued work | [S0146](13_SOURCE_CATALOG.md#s0146), [S0197](13_SOURCE_CATALOG.md#s0197) |
| R0483 | Configure bounded retries dead letters and escalation | Poison messages cannot loop silently forever | [S0152](13_SOURCE_CATALOG.md#s0152), [S0149](13_SOURCE_CATALOG.md#s0149) |
| R0484 | Keep private storage private with short-lived authorized access | Rejected media and delivery proof are not public bucket objects | [S0136](13_SOURCE_CATALOG.md#s0136), [S0120](13_SOURCE_CATALOG.md#s0120) |
| R0485 | Test CORS signed URLs and object lifecycle rules | A guessed object key cannot bypass access checks | [S0191](13_SOURCE_CATALOG.md#s0191), [S0110](13_SOURCE_CATALOG.md#s0110) |
| R0486 | Back up database objects and required keys separately | A database backup alone cannot claim full restoration | [S0128](13_SOURCE_CATALOG.md#s0128), [S0111](13_SOURCE_CATALOG.md#s0111) |
| R0487 | Perform an owned restore drill | Restored orders ledger stock and required objects reconcile | [S0128](13_SOURCE_CATALOG.md#s0128) |
| R0488 | Inventory actual staging and production resource identities | Repository project mappings alone do not prove deployments | [S0200](13_SOURCE_CATALOG.md#s0200), [S0196](13_SOURCE_CATALOG.md#s0196) |
| R0489 | Keep credentials in approved secret custody | No environment values or signing keys enter research artifacts | [S0198](13_SOURCE_CATALOG.md#s0198), [S0165](13_SOURCE_CATALOG.md#s0165) |
| R0490 | Measure operational logs traces and metrics with redaction | Support can trace failures without exposing bearer tokens | [S0122](13_SOURCE_CATALOG.md#s0122) |
| R0491 | Budget Maps geocoding routing video egress and notifications | The cost model includes per-order and per-upload drivers | [S0138](13_SOURCE_CATALOG.md#s0138), [S0172](13_SOURCE_CATALOG.md#s0172) |
| R0492 | Prefer bounded polling or existing realtime capability initially | A new realtime service is not assumed mandatory | [S0145](13_SOURCE_CATALOG.md#s0145), [S0095](13_SOURCE_CATALOG.md#s0095) |
| R0493 | Use CDN caches only with correct public scope | Tenant-private responses cannot be shared by cache key mistake | [S0123](13_SOURCE_CATALOG.md#s0123), [S0124](13_SOURCE_CATALOG.md#s0124) |
| R0494 | Make readiness health checks truthful | An unconfigured provider reports unavailable rather than success | [S0158](13_SOURCE_CATALOG.md#s0158), [S0107](13_SOURCE_CATALOG.md#s0107) |
| R0495 | Separate mock sandbox staging and live modes | A sandbox result cannot unlock live selling | [S0172](13_SOURCE_CATALOG.md#s0172) |
| R0496 | Promote exact tested artifacts through environment gates | A green local test cannot identify a hosted revision | [S0180](13_SOURCE_CATALOG.md#s0180), [S0184](13_SOURCE_CATALOG.md#s0184) |
| R0497 | Keep observability targets tied to pilot demand | Limits come from measured peak and agreed service budgets | [S0156](13_SOURCE_CATALOG.md#s0156), [S0199](13_SOURCE_CATALOG.md#s0199) |
| R0498 | Plan a compatible feature disable and rollback | New intake can stop while existing obligations recover | [S0164](13_SOURCE_CATALOG.md#s0164), [S0145](13_SOURCE_CATALOG.md#s0145) |
| R0499 | Do not change private cloud resources for this research | No deployment secret rotation database mutation or paid provisioning occurs | [S0111](13_SOURCE_CATALOG.md#s0111), [S0196](13_SOURCE_CATALOG.md#s0196) |
| R0500 | Alert on overdue schedulers and aging durable work | A missing reservation sweep or stuck refund reaches an accountable owner | [S0108](13_SOURCE_CATALOG.md#s0108), [S0168](13_SOURCE_CATALOG.md#s0168) |

## API contracts schema and migration

Implementation owner: Shared domain contracts, existing gateway/database and clients. Primary budget bucket: P2. [Design detail](09_DATA_API_AND_CLOUD_ARCHITECTURE.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0501 | Reuse shared-types and canonical domain public exports | Clients do not hand-roll divergent commerce DTOs | [S0044](13_SOURCE_CATALOG.md#s0044), [S0045](13_SOURCE_CATALOG.md#s0045) |
| R0502 | Validate inbound commands with canonical schemas | Unknown unsafe fields cannot bypass server rules | [S0055](13_SOURCE_CATALOG.md#s0055), [S0057](13_SOURCE_CATALOG.md#s0057) |
| R0503 | Use versioned API boundaries consistently | Gateway and app proxy prefixes follow existing contracts | Owner direction / local design |
| R0504 | Paginate every list and bound every query | A seller or rider request cannot fetch an unlimited dataset | [S0097](13_SOURCE_CATALOG.md#s0097) |
| R0505 | Require stable idempotency for duplicable side effects | Concurrent retries produce one business receipt | [S0093](13_SOURCE_CATALOG.md#s0093), [S0082](13_SOURCE_CATALOG.md#s0082) |
| R0506 | Bind idempotency keys to actor scope and payload | Changing the body under one key produces conflict | [S0045](13_SOURCE_CATALOG.md#s0045), [S0048](13_SOURCE_CATALOG.md#s0048) |
| R0507 | Require current authorization before idempotent replay | Revocation cannot be bypassed through a cached success | [S0087](13_SOURCE_CATALOG.md#s0087), [S0079](13_SOURCE_CATALOG.md#s0079) |
| R0508 | Use expected versions for conflicting operational mutations | Lost updates return typed recoverable conflicts | [S0082](13_SOURCE_CATALOG.md#s0082), [S0109](13_SOURCE_CATALOG.md#s0109) |
| R0509 | Keep error responses sanitized and actionable | Database internals and sensitive identifiers stay in redacted logs | [S0100](13_SOURCE_CATALOG.md#s0100), [S0126](13_SOURCE_CATALOG.md#s0126) |
| R0510 | Preserve existing public contracts during staged app cutover | Old accepted clients remain compatible within the declared window | [S0061](13_SOURCE_CATALOG.md#s0061), [S0053](13_SOURCE_CATALOG.md#s0053) |
| R0511 | Map instant listing vocabulary to Quick origin explicitly | Reporting checkout and SDKs agree on channel semantics | [S0057](13_SOURCE_CATALOG.md#s0057) |
| R0512 | Keep schema ownership under canonical existing tables | A new noun does not automatically create a parallel domain table | [S0137](13_SOURCE_CATALOG.md#s0137), [S0048](13_SOURCE_CATALOG.md#s0048) |
| R0513 | Add paired forward and rollback migrations when implementation is authorized | Migration admission checks both directions and data safeguards | [S0108](13_SOURCE_CATALOG.md#s0108), [S0066](13_SOURCE_CATALOG.md#s0066) |
| R0514 | Use current migration numbering discovered at implementation time | No old documented maximum is reused blindly | [S0059](13_SOURCE_CATALOG.md#s0059) |
| R0515 | Use expand backfill verify contract for real data changes | No old column is dropped before parity is proven | [S0102](13_SOURCE_CATALOG.md#s0102), [S0108](13_SOURCE_CATALOG.md#s0108) |
| R0516 | Enforce append-only financial and audit protections | Triggers grants and foreign keys prevent unauthorized history edits | Owner direction / local design |
| R0517 | Promote donor source without app-to-app imports | Shared reusable code crosses package public boundaries only | [S0064](13_SOURCE_CATALOG.md#s0064), [S0055](13_SOURCE_CATALOG.md#s0055) |
| R0518 | Keep reference source inert until approved promotion | A source move cannot accidentally activate a donor backend | [S0057](13_SOURCE_CATALOG.md#s0057), [S0055](13_SOURCE_CATALOG.md#s0055) |
| R0519 | Replace donor endpoint and auth assumptions systematically | Every screen uses the accepted canonical client contract | [S0131](13_SOURCE_CATALOG.md#s0131), [S0055](13_SOURCE_CATALOG.md#s0055) |
| R0520 | Preserve import lineage and required asset licenses | Recovered UI has accountable provenance and usable rights | [S0139](13_SOURCE_CATALOG.md#s0139), [S0085](13_SOURCE_CATALOG.md#s0085) |
| R0521 | Add relevant outbox event types and durable handlers | An event name alone cannot stand in for a completed workflow | [S0044](13_SOURCE_CATALOG.md#s0044), [S0068](13_SOURCE_CATALOG.md#s0068) |
| R0522 | Expose reliable operation-status lookup | Clients can recover an unknown response without a second mutation | [S0105](13_SOURCE_CATALOG.md#s0105), [S0122](13_SOURCE_CATALOG.md#s0122) |
| R0523 | Reconcile reporting from canonical facts | Analytics cannot become another order or money authority | [S0049](13_SOURCE_CATALOG.md#s0049) |
| R0524 | Document every compatibility bridge and retirement gate | Temporary glue has an owner and evidence-based exit | [S0132](13_SOURCE_CATALOG.md#s0132), [S0094](13_SOURCE_CATALOG.md#s0094) |
| R0525 | Test schema grants and real route mounting together | An isolated helper test cannot certify the production boundary | Owner direction / local design |

## Verification rollout and acceptance

Implementation owner: Existing owned test harnesses and accountable release owners. Primary budget bucket: P8. [Design detail](11_IMPLEMENTATION_ROADMAP_AND_ACCEPTANCE.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0526 | Accept complete business journeys rather than screen counts | Each milestone includes happy path denial failure and recovery | [S0210](13_SOURCE_CATALOG.md#s0210) |
| R0527 | Run positive-control-first cross-tenant security fixtures | An empty database cannot produce a false isolation pass | [S0231](13_SOURCE_CATALOG.md#s0231), [S0363](13_SOURCE_CATALOG.md#s0363) |
| R0528 | Test same-seller cross-location denial separately | Tenant isolation cannot hide location permission gaps | [S0340](13_SOURCE_CATALOG.md#s0340), [S0231](13_SOURCE_CATALOG.md#s0231) |
| R0529 | Race final-unit purchases across multiple channels | One shared physical unit yields one accepted sale | Owner direction / local design |
| R0530 | Race duplicate webhook verify refund and settlement effects | Money and inventory remain once-only and balanced | [S0255](13_SOURCE_CATALOG.md#s0255) |
| R0531 | Inject external success followed by local failure | Durable recovery resolves the unknown financial outcome | [S0224](13_SOURCE_CATALOG.md#s0224) |
| R0532 | Test both directions of shared-product channel enablement | Import creates listings without duplicate stock authority | [S0340](13_SOURCE_CATALOG.md#s0340) |
| R0533 | Test seller-only and storefront-only catalog isolation | Unselected channels cannot discover or purchase the item | [S0340](13_SOURCE_CATALOG.md#s0340), [S0357](13_SOURCE_CATALOG.md#s0357) |
| R0534 | Test category fee changes across effective-date boundaries | Old refunds use original snapshots and new orders use new policy | [S0357](13_SOURCE_CATALOG.md#s0357) |
| R0535 | Test storefront hard-zero commission as a permanent channel guard | Every applicable fee schedule preserves zero sales commission | Owner direction / local design |
| R0536 | Verify normal auth UI on each dedicated client | Injected credentials do not stand in for sign-in acceptance | [S0368](13_SOURCE_CATALOG.md#s0368) |
| R0537 | Test account business mode and address switching | Late responses cannot cross any of those boundaries | [S0214](13_SOURCE_CATALOG.md#s0214), [S0215](13_SOURCE_CATALOG.md#s0215) |
| R0538 | Run real non-superuser RLS and GUC tests | Service-role fixtures are not accepted as database isolation proof | [S0109](13_SOURCE_CATALOG.md#s0109), [S0100](13_SOURCE_CATALOG.md#s0100) |
| R0539 | Use provider sandbox for payment capture refund and seller mapping | A local stub cannot satisfy provider acceptance | [S0110](13_SOURCE_CATALOG.md#s0110), [S0228](13_SOURCE_CATALOG.md#s0228) |
| R0540 | Use physical Android and iOS devices for shipped capabilities | Background GPS scanning and notification behavior have real evidence | [S0332](13_SOURCE_CATALOG.md#s0332), [S0334](13_SOURCE_CATALOG.md#s0334) |
| R0541 | Exercise offline restart and lost-response recovery | No repeated task stock payment or custody effect occurs | Owner direction / local design |
| R0542 | Rehearse supermarket receiving picking cashier close and returns | The operating model works with actual accountable staff | [S0095](13_SOURCE_CATALOG.md#s0095), [S0105](13_SOURCE_CATALOG.md#s0105) |
| R0543 | Reconcile physical stock cash PSP and ledger at pilot close | Every variance is zero or attributable with an owner | [S0095](13_SOURCE_CATALOG.md#s0095), [S0102](13_SOURCE_CATALOG.md#s0102) |
| R0544 | Measure performance at agreed pilot peak and soak | The test records dataset duration concurrency and observed budgets | [S0384](13_SOURCE_CATALOG.md#s0384), [S0381](13_SOURCE_CATALOG.md#s0381) |
| R0545 | Verify restore rollback and feature-disable procedures | Operators can stop intake without losing existing obligations | [S0368](13_SOURCE_CATALOG.md#s0368) |
| R0546 | Identify exact source schema config and app artifacts | The acceptance result names the release candidate it actually tested | [S0377](13_SOURCE_CATALOG.md#s0377), [S0378](13_SOURCE_CATALOG.md#s0378) |
| R0547 | Label skipped unknown and historical evidence honestly | Old test totals do not become a fresh release verdict | [S0357](13_SOURCE_CATALOG.md#s0357), [S0378](13_SOURCE_CATALOG.md#s0378) |
| R0548 | Reforecast after two weeks of accepted implementation slices | A planning estimate is adjusted from observed delivery velocity | [S0106](13_SOURCE_CATALOG.md#s0106) |
| R0549 | Require explicit live release authority after evidence completion | Research approval cannot deploy or charge real users | [S0378](13_SOURCE_CATALOG.md#s0378) |
| R0550 | Expand locations categories and hours only after pilot gates | Growth follows measured service economics and operating capacity | Owner direction / local design |


## Marketplace and Store Ops web

Owner-added web scope; [design detail](16_MARKETPLACE_AND_STORE_OPS_WEB.md).

| ID | Finding or implementation requirement | Observable acceptance | External design context |
| --- | --- | --- | --- |
| R0551 | Provide a dedicated Marketplace customer web frontend | A buyer completes an approved product-to-order journey in the browser | Owner direction / local design |
| R0552 | Keep Marketplace web distinct from merchant storefront web | Marketplace seller pages cannot expose storefront-only offers | Owner direction / local design |
| R0553 | Reuse canonical buyer sign-in for customer web | Web client receives an approved audience-scoped session | Owner direction / local design |
| R0554 | Keep web and mobile on the same product and order contracts | Both clients display matching canonical identifiers and order facts | Owner direction / local design |
| R0555 | Provide responsive search category product and seller pages | Supported desktop and phone viewports complete normal shopping | Owner direction / local design |
| R0556 | Keep private customer pages out of public indexing | Carts addresses orders and payment attempts expose no indexable personal data | Owner direction / local design |
| R0557 | Index only currently eligible public Marketplace content | Revoked listings are removed under the accepted publication policy | Owner direction / local design |
| R0558 | Support independent Marketplace and Quick web baskets | Changing the active web mode preserves correct separate attempts | Owner direction / local design |
| R0559 | Allow manual delivery address when browser GPS is declined | Quick serviceability can use a valid manually selected address | Owner direction / local design |
| R0560 | Use canonical web prepaid and COD outcome recovery | Refreshing after a payment timeout cannot create another order | Owner direction / local design |
| R0561 | Preserve owned web order support and refund access | The browser cannot open another buyer's order by guessing its ID | Owner direction / local design |
| R0562 | Plan the marketing-to-Marketplace homepage cutover | Required company business legal and old entry links remain recoverable | Owner direction / local design |
| R0563 | Provide a dedicated Store Ops browser workspace | Assigned staff can operate an approved node without full merchant-owner access | Owner direction / local design |
| R0564 | Select an authorized node in Store Ops web | Changing a browser location selector cannot bypass local permissions | Owner direction / local design |
| R0565 | Use one canonical task claim across Ops web and mobile | Two clients racing to claim one task produce one owner | Owner direction / local design |
| R0566 | Support workstation keyboard or USB barcode scanning | An accepted scan resolves the exact approved variant or reports ambiguity | Owner direction / local design |
| R0567 | Provide a tested manual scanning fallback | A workstation without camera permission can still perform authorized work | Owner direction / local design |
| R0568 | Show receiving counts lots and quarantine in Ops web | Browser actions reconcile with the same inventory movement records | Owner direction / local design |
| R0569 | Use current assignment proof for browser handover | A stale or wrong rider assignment cannot collect the package | Owner direction / local design |
| R0570 | Recover Ops browser refresh and lost-response actions | The original durable operation is recovered without repeated effects | Owner direction / local design |
| R0571 | Fence duplicate tabs against conflicting operational edits | Expected-version conflicts are visible and safely recoverable | Owner direction / local design |
| R0572 | Revalidate workforce grants for every Ops web command | Revoked staff cannot complete a cached browser task | Owner direction / local design |
| R0573 | Keep the Ops web host private and nonindexable | Public visitors cannot read operational queues or customer details | Owner direction / local design |
| R0574 | Extract reusable UI through public shared packages | Neither new web app imports another app's internal routes or hooks | Owner direction / local design |
| R0575 | Test cross-surface stock and financial effect deduplication | One actual sale or refund causes one canonical effect across web and mobile | Owner direction / local design |
| R0576 | Test browser cookie callback and private-cache boundaries | Another account tenant or untrusted hostname cannot obtain protected session data | Owner direction / local design |
| R0577 | Test supported workstation browsers scanners and mobile browsers | Each released browser capability has observed target-device evidence | Owner direction / local design |
| R0578 | Admit the two new web roots and hosting targets together | Topology workspace identity and deploy contracts agree before activation | Owner direction / local design |
| R0579 | Reserve new Ops and public entry hostnames centrally | A merchant slug cannot claim a platform-controlled operational hostname | Owner direction / local design |
| R0580 | Run cross-surface release and cutover rehearsals | A scoped frontend rollback preserves existing orders cash refunds and support | Owner direction / local design |
