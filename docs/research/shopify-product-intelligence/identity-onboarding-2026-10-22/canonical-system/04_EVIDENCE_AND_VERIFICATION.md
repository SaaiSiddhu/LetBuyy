# Evidence and verification

The fresh follow-up is dated 22 October 2026. The source comparison is pinned to LetBuyy HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d`; existing uncommitted research was preserved. Evidence distinguishes browser observations, measurements, source, primary documentation, earlier exhibits and open branches.

## Fresh coverage

| Area | Exercised/read | Limit |
| --- | --- | --- |
| Products | Empty index; clean create; temporary title; dirty bar; departure attempt; discard | No product creation/publication; no populated native bulk table |
| Orders | Trial/plan-gated index and header | No order detail, payment, fulfillment or refund |
| Customers | Empty query workspace; Add customer page and field groups | No personal data entered; no customer created |
| Discounts | Empty index; type-choice dialog; cancel | No discount definition saved |
| Analytics | Header, reporting/metric/report-link/no-data states | No populated business performance or query correctness proof |
| General settings | Header; temporary order suffix; matching dirty bar; discard/reset | No setting saved; private fields excluded from saved text |
| Domains | Overview/detail, connection dialog, empty validation and cancel | No domain registration, connection, DNS/provider action or purchase |
| Payments | Header and available configuration group inspection | No method activated or provider credentials entered |
| Shipping | Grouped disclosures, header at 1440/768/390 px | No shipping configuration changed |
| Apps/Users | Settings header/context and Apps empty state | No installation, invitation, role or security change |
| Themes/editor | Host header, editor toolbar, Hero selection/properties, rendered preview and clean exit | No save/publish/section mutation; pane geometry reused as explicitly PRIOR |

All temporary Shopify product/settings input was discarded. The product index remained empty after discard. General suffix returned to its original blank value. The editor final snapshot showed disabled Save/Save as/undo/redo; selection alone did not create a draft mutation. Browser viewport override was reset and existing tabs retained.

## Method and reproducibility

The first product probe used the actual browser viewport 862×1034/DPR 2 and light DOM only. Later working overrides measured1440 × 1000/DPR 1, with product mobile390 × 844 and Shipping768/390 samples. The initial probe missed open-shadow headings and remains method-limited. Native custom elements sometimes use `display:contents`; zero host rectangles are not zero rendered control size.

Measure painted descendants and their composed ancestors, associate names with the accessibility tree, and record the actual viewport. Blank slot text in a DOM style record is not proof of an unnamed control. Conversely, an AX label alone does not prove contrast, target size or correct focus handling.

The domain modal's native `<dialog>` required including semantic native elements rather than only explicit role attributes. Corrected geometry is in exhibit15. The bar overlay ancestry is in the product after-scroll and Settings save-bar records.

Text evidence removes signed iframe queries, private account/email/store identifiers and private object IDs. General and Users capture only necessary geometry to avoid retaining personal data. Screenshots use safe crops or temporary synthetic input. The manifest describes fresh, prior and method-limited exhibits separately.

No production timing or whole-product accessibility score is inferred. Automation observation overhead, development compilation, route state, data readiness and preview readiness are different boundaries. The owner's local delay report remains P1 in the plan.

## Primary references

| Reference | Narrow support |
| --- | --- |
| [App Home](https://shopify.dev/docs/api/app-home/latest) | Current public iframe app surface and version context |
| [Page](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/page) | Page slots, heading/actions/aside and layout scope |
| [Section](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/section) | Content grouping, automatic semantic heading and contextual styling |
| [Button](https://shopify.dev/docs/api/app-home/latest/web-components/actions/button) | Action variants, loading, disabled and accessible-label contract |
| [Forms and saving](https://shopify.dev/docs/apps/design/user-experience/forms) | Form grouping, progressive disclosure and explicit commit guidance |
| [Save Bar API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/save-bar-api) | Dirty form ownership and leave-confirmation app contract |
| [Save bar component](https://shopify.dev/docs/api/app-home/latest/app-bridge-web-components/save-bar) | Form/app-window visibility scope; avoid competing controllers |
| [Table](https://shopify.dev/docs/api/app-home/latest/web-components/layout-and-structure/table) | Responsive table/list, pagination/filter integration and application-owned matching |
| [Modal](https://shopify.dev/docs/api/app-home/latest/web-components/overlays/modal) | Focused overlay component scope and limitations |
| [Loading API](https://shopify.dev/docs/api/app-home/latest/apis/user-interface-and-interactions/loading-api) | Header indicator start/stop; no native percentage guarantee |

These are app-facing public contracts. Their existence is not evidence that every native route uses that exact public release. The archived React reference remains historical; no archived numeric constant is promoted to the current native specification.

## Remaining acceptance

Populated tables/bulk selection, order/customer detail variants, staff permissions, save/reject/conflict/unknown outcomes, browser Back/reload/store-switch guards, real mobile keyboard, full keyboard/screen-reader/reduced-motion and provider-state failures remain OPEN where not covered by explicit earlier evidence. No account data was created to force those branches.

The [LetBuyy comparison](../../../../implementation/identity-merchant-experience-2026-10-22/08_CANONICAL_PATTERN_COMPARISON.md) adds fresh local/source checks and a concrete adoption sequence. Earlier successful test suites remain dated earlier results; this documentation follow-up does not relabel them as newly rerun tests.
