# Shopify / LetBuyy marketplace comparison

Inspection date: 23 October 2026, Asia/Kolkata. Evidence, not governance.

## Evidence method

Direct browser observation uses fresh IAB3 tabs 1/2 under Themes' bounded research lease. Source observations refer to the dirty checkout at HEAD 85aac990; they are not hosted acceptance. Existing research is dated context, not current authority. No Shopify theme installation, purchase, registration, save, publication or support submission occurred. Demo cart interaction is visitor sample state only.

Primary references: [Theme Store](https://themes.shopify.com/), [listing](https://themes.shopify.com/themes), [Ride detail](https://themes.shopify.com/themes/ride/presets/ride), embedded [Ride sample store](https://theme-ride-demo.myshopify.com/).

## Observed comparison

| Merchant task | Shopify directly observed | LetBuyy source / observed state | Consequence |
|---|---|---|---|
| Discover a suitable design | Home opens with business/feature fit, then theme groups and industry entry points. | Active merchant marketplace renders ThemeWorkspace. Its copy distinguishes Threadline from nine existing styles. | Preserve truthful availability; improve task hierarchy and actual preview imagery. |
| Narrow the catalog | Listing has price, industry, catalog size and feature filters, sort and numbered pagination. Free changed URL to `price[]=free&sort_by=relevance`; Newest changed `sort_by=newest`. Visible filtered total was 24. Industry counts displayed zero even in the unfiltered state, so these counts are not assumed correct. | Component filters only the array returned by its BFF. BFF discards gateway total/page/limit/has_more and accepts only store_name. Component search/category live in local state. | Server filtering/pagination and durable URL context are required; do not copy irrelevant filters for ten designs. |
| Understand design/version | Ride shows overview/features/reviews/support anchors, design imagery, designer, Free pricing and release history. Directly observed version 16.1.0, release October 09, 2026. | Active detail is a thumbnail/text modal and external preview link; version absent from modal, no real capability groups. | Addressable detail with canonical metadata and precise setup/content prerequisites. No invented ratings/scores. |
| Enter demo | View demo expands embedded store with Close, Desktop, Mobile, Maximize and Try theme. Detail remains underneath. | Separate catalog frame offers Home/Collection/Product only. | Embedded demo with maintained marketplace return context and exact package identity. |
| Device preview | Ride iframe measured 1120px wide in desktop wrapper; mobile control changed it to 360px while preserving cart. | LetBuyy frame source sets real 1440/834/390 dimensions before scale. Actual browser verification pending. | Keep real layout widths; separately test narrow marketplace chrome. |
| Distinct product navigation | FILIPE TOLEDO WILDFIRE opened its actual product, with three gallery image buttons, surfboard sizes, quantity and technical disclosure. | Navigation maps every product route to `route_type=product`; PreviewContent chooses first Threadline product or one Urban Kicks product. | Preserve resource identity/query/hash; missing product must be recoverable, not substituted. |
| Cart behavior | Quantity increased 1→2, Add to cart produced an accessible confirmation, View my cart showed quantity 2 and subtotal $660. Wrapper mobile switch retained cart. | Capture handler blocks cart/buy-now controls with sample notice; every form submit is swallowed. | Isolated canonical server-cart adapter required; no parallel client pricing. |
| Variant behavior | 5'3 and 5'11 controls exist. A test selecting 5'11 did not change checked state; no successful variant-change claim. Cart retained 5'3. | Threadline fixtures have real option/variant IDs; full demo behavior unverified. | Test actual state and availability, not control presence. |
| Content | Stories opened four distinct articles; Softboard Care Guide opened its full article with Back to blog. Contact opened Name/Email/Phone/Comment form; nothing submitted. | Package inventory has distinct page/blog/article template keys; preview only accepts three route types. | Wire public synthetic content through canonical binding/renderer; keys are not proof of working pages. |
| Collection sort | Fins opened 8 distinct products; price ascending visibly reordered $45, $85, $90, $90, $105, $110, $140, $220. No actionable product filter options were exposed in this observed collection. | Generic collection route/fixture. | Demonstrate real dataset-dependent sort/filter results without claiming unavailable features. |
| Search recovery | Combined Free+Clothing+Newest returned 7 themes; search overlay offered suggested facets. Submitted unknown query produced explicit no-results heading; search reset prior filter context in URL. | No URL state in active component. | Predictable scope, history and recovery; do not blindly copy reference behavior. |
| Checkout boundary | Check out from cart led to an iframe refused-to-connect page. No successful checkout or order claimed. | Catalog demo blocks purchase entirely. | Explicit recoverable simulated boundary, no live provider escape. |
| Install / editor | Try theme visible. No Shopify installation attempted by design. | Canonical install RPC exists and returns instance ID; merchant BFF discards it. Editor deep link uses slug and owned readback. | Preserve exact package/version/instance through receipt and editor contract; test no implicit publish. |

## Visual evidence

- `evidence/shopify-ride-mobile.png`: mobile embedded product/cart confirmation, captured after quantity=2 add.
- `evidence/shopify-ride-detail-demo-dom.txt`: current observed public detail/demo DOM.
- `evidence/shopify-free-newest-dom.txt`: filtered listing/sort DOM.
- `evidence/shopify-no-results-dom.txt`: submitted unknown search result.
- `evidence/shopify-ride-collection-contact-dom.txt`: contact resource within the Ride demo.

These do not certify every Shopify feature, all Ride routes, install behavior, accessibility or performance. Public page counts/version are inspection-date observations and must not become hardcoded LetBuyy copy.

## Visual direction for implementation

Use the current LetBuyy merchant shell/tokens/Lucide icons. A restrained intro leads into useful category chips, search/result context and large real artifact thumbnails. Detail has a two-column visual introduction with version, first-party identity and Demo/Add actions; feature/setup/content evidence follows. Demo controls occupy a small persistent toolbar, leaving the theme's own typography/color intact. On compact widths stack actions, keep filter reset/results visible, and avoid squeezing desktop admin chrome into the phone preview.

Representative slice: Threadline → addressable detail → exact package demo → distinct garment/collection/content links → add to current explicitly named owned store → confirmed instance readback → existing editor. Library/current published/private draft stay distinct. Failed/unknown outcomes keep selection and retry context.
