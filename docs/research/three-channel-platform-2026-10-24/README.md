# LetBuyy and LetKart three channel research and implementation plan

24 October 2026 · Research and planning · India · One implementation stream assumed for estimates

Research deliverables: **534 distinct retrieved primary-source documents/pages and 580 individual findings/implementation requirements across 23 domains**, with source-depth labels and observable acceptance.

LetBuyy should remain the primary merchant storefront platform with **0% LetBuyy sales commission for every storefront merchant**. Marketplace becomes a dedicated Seller product with its own onboarding, category-based commercial rules and operating workflows. Quick becomes a franchise and supermarket fulfillment product operated through dedicated Store Ops and Delivery apps. These are three selling channels over the same canonical commerce backend, PostgreSQL database and identity platform.

The revised proposal keeps **LetBuyy for both Marketplace and the Storefront platform**, with **LetBuyy Store** for merchants and **LetBuyy Seller** for Marketplace sellers. **LetKart Quick** is a candidate second brand for Quick, with dedicated Partner Ops and Delivery clients, inside the existing LetBuyy customer app. This supersedes the earlier proposal to rename the whole consumer Marketplace LetKart. The owner confirms ownership of letbuyy.com and letbuyy.store; domain roles, proposed directories and the first milestone are detailed in Volume 15. Merchant websites keep their own brands; the Quick name still requires clearance.

An existing merchant signs into Seller through the same identity platform and selects the same verified business. “Import products” normally enables another channel listing on the **same product and variant**, with the same real stock pool where physically appropriate. Products created in Seller can be enabled for Storefront in the reverse direction. Products may also remain exclusive to one channel. Channel publication, price, approval and fees are separate from the app in which the product was created.

## Confirmed direction and recommended boundaries

| Subject | Position |
| --- | --- |
| Three systems | Dedicated Merchant/Storefront, Marketplace Seller and Quick operating experiences |
| Customer | Existing native customer application plus new Marketplace web, both with Marketplace and Quick modes |
| Storefront | Primary merchant proposition, zero LetBuyy sales commission; provider and agreed subscription charges remain separately disclosed |
| Marketplace | Dedicated Seller app, progressive KYC/settings/provider/category/listing readiness, versioned category commission |
| Quick | Dedicated preserved Store Ops mobile and Delivery code plus new Store Ops web; independent-franchise and supermarket operating models |
| Product reuse | Bidirectional channel enablement on canonical products, not two catalogs synchronized by copying |
| Inventory | One authority per actual owner, variant and physical location; distinct stock locations remain distinct |
| Accounts | One sign-in platform; the same person may hold buyer, merchant, seller and workforce relationships with separately verified permissions |
| Shared backend | Existing api-gateway monolith and approved satellites; no channel microservice fleet |
| Shared database | Existing PostgreSQL/RLS/GUC ownership; no second Firebase or commerce database |
| Research scope | Only this research chat resumed. All other LetBuyy chats remain paused |

## Read the package

| Volume | Purpose |
| --- | --- |
| [1 Product channels and brands](01_PRODUCT_CHANNELS_AND_BRANDS.md) | Actor boundaries, brands, apps and the corrected three-channel contract |
| [2 Market research](02_MARKET_RESEARCH_AND_COMPETITORS.md) | What current primary sources establish, what differs between operators, and what to adopt |
| [3 Identity and app reuse](03_IDENTITY_TENANCY_AND_APP_REUSE.md) | Unified login, business membership, source reuse and current implementation gaps |
| [4 Catalog and stock](04_CATALOG_CHANNELS_AND_SHARED_INVENTORY.md) | Bidirectional import, publication, inventory equations, concurrency and custody |
| [5 Merchant and Seller journeys](05_MERCHANT_AND_SELLER_JOURNEYS.md) | Complete onboarding, publishing, trading, support and restriction workflows |
| [6 Franchise and supermarkets](06_QUICK_FRANCHISE_AND_SUPERMARKETS.md) | Four operating models, responsibilities, operating procedures and contract decisions |
| [7 Commercial economics](07_COMMERCIAL_MODELS_AND_UNIT_ECONOMICS.md) | One-time costs, subscriptions, royalties, service fees and tested illustrative economics |
| [8 Checkout and money](08_CHECKOUT_MONEY_AND_SETTLEMENT.md) | Server authority, fee snapshots, PSP/COD recovery, refunds and reconciliation |
| [9 Data APIs and cloud](09_DATA_API_AND_CLOUD_ARCHITECTURE.md) | Schema ownership, command contracts, runtime boundaries, costs and cloud discovery |
| [10 Compliance and operations](10_COMPLIANCE_SECURITY_AND_OPERATIONS.md) | Current versus future rules, security, privacy, staffing and incident acceptance |
| [11 Delivery roadmap](11_IMPLEMENTATION_ROADMAP_AND_ACCEPTANCE.md) | Dependency-aware work packages, one-stream estimates and release gates |
| [12 Findings and requirements](12_FINDINGS_AND_REQUIREMENTS.md) | 580 individual implementation requirements, each with acceptance evidence |
| [13 Source catalog](13_SOURCE_CATALOG.md) | More than 500 distinct retrieved primary-source pages/documents, with relevance and retrieval records |
| [14 Implementation contracts](14_IMPLEMENTATION_CONTRACTS.md) | Concrete channel vocabulary, field dictionaries, command examples, fee selection and race invariants |
| [15 Apps domains directories and start](15_APPS_DOMAINS_DIRECTORIES_AND_START.md) | Revised LetBuyy/Quick naming, two owned domains, exact proposed source moves and the first implementation checkpoint |
| [16 Marketplace and Store Ops web](16_MARKETPLACE_AND_STORE_OPS_WEB.md) | Added web frontends, shared-code boundaries, revised domains, budget and first cross-surface milestone |
| [Research method and verification](RESEARCH_METHOD_AND_VERIFICATION.md) | Counting rules, depth, exclusions, unknowns and reproducible document checks |

Machine-readable companions include SOURCE_REGISTER.json/CSV, REQUIREMENTS.json/CSV, SOURCE_OBSERVATIONS.json, IMPLEMENTATION_BACKLOG.csv, FINANCIAL_SCENARIOS.csv, DECISIONS.json, RESEARCH_RESUME_SCOPE.json and VERIFICATION.json. The registers preserve the difference between a public source observation, an owner requirement and an architectural proposal. The 580 requirements include the original 550 plus 30 web-specific additions; they are not represented as 580 independently verified competitor facts.

## Main recommendation

Start with existing storefront merchants, a dedicated Seller vertical slice, and one partner-supermarket Quick pilot before selling a broad franchise network. This tests product reuse, shared-stock safety, real seller economics, delivery and support without requiring every partner to fund a new premises. Dedicated franchise stores remain a planned model once actual order contribution, operating cost and demand justify them.

Do not charge a partner a setup fee, subscription, royalty, marketplace commission and fulfillment fee simply because all five can be implemented. Each fee must pay for a defined service or right. Select one primary variable fee basis per service and show the complete net economics to both sides. Deposits are liabilities, working capital is invested cash, GMV is merchandise value, and neither is platform profit.

For the expanded three-system scope, the planning budget is **183–284 focused implementation days before contingency**, approximately **220–341 days including 20%**, or **44–69 weeks at five focused days per week**. That is roughly **10–16 months for a controlled all-three-channel pilot**, not national maturity. The earlier 6–10 month Quick-only and 9–13 month mobile-focused estimates are superseded for the target including both new web frontends. Actual mandatory predecessor gaps, provider approval, stores, staffing and operating readiness can extend the range. Reforecast after two weeks of accepted implementation slices.

## Existing source and execution status

The inspected checkout is /Volumes/Projects/LetBuyy, branch letbuyy/theme-release-performance-resume, HEAD 85aac99043d8dc10469e12cbb810609a3b6f1b0d, with substantial pre-existing uncommitted work preserved. The earlier [whole-project reuse inventory](../quick-commerce-2026-10-24/PROJECT_REUSE_INVENTORY.json) covers 17 app/donor roots and 55 package roots. This package adds focused identity, Seller, catalog and commercial research; it does not claim a line-by-line audit of all files.

The current task delivers research and implementation planning. Application builds, migrations, provider transactions, live cloud changes and deployment are not performed. Public cloud documentation establishes capabilities and pricing units; it does not establish LetBuyy's actual enabled accounts or deployed state. Hosted schema, provider eligibility and app-device readiness remain future evidence gates.

The latest dedicated Seller direction supersedes older records that absorb all Marketplace selling into Merchant. Dedicated Store Ops supersedes its older donor-to-Merchant absorption direction. Existing canonical backend, database, ledger and issuer remain the strategic owners. Scoped topology, ownership and commercial-governance records must be aligned before future activation; this research does not fabricate amendment signatures.
