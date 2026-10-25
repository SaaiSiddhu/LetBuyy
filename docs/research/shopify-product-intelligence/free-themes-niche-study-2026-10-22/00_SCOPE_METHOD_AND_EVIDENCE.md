# Scope, method and evidence

Status: research and original design proposal, 22 October 2026. No architectural amendment, implementation authorization, or UX certification is created by this collection.

## Starting questions

1. Does source-level rendering reproduce the reported sameness, and which stage introduces it?
2. How do the currently listed free Shopify demos differ at home, collection, product, navigation, option and cart-entry levels?
3. Which ten niche journeys are defensible, and which data/operational dependencies must be completed before their controls can exist?
4. Can the canonical Liquid architecture deliver those differences without renderer forks or loss of merchant work?

## Authority and recovered context

Read current Constitution and canonical-system theme registry under `GOVERNANCE_REWRITE_2026_06_10`, root `AGENTS.md`, relevant commerce, merchant, theme-engine and research instructions; applied the LetBuyy and web-ui-ux-system skills. Research proposals remain below accepted governance. The canonical Liquid/portable theme winner, one merchant editor, one server-authoritative commerce system, hosted checkout, tenant boundaries and approved India merchant envelope are constraints. Topology here means page/section/journey organization.

Recovered earlier theme-discovery, theme-research, phase-2 and current identity/onboarding research. The referenced “Research Shopify identity UI/UX” chat was read through `read_thread` during context recovery, including older turns as needed. Its observations are context, not fresh authority. Current source corrections are recorded in 05.

Pinned checkout at experiment start: branch `letbuyy/theme-release-performance-resume`, HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d`. Existing modifications to the parent research index/analysis and identity/onboarding research were preserved. Work in the other identity implementation folder is unrelated and was not edited. No branch changes, commits, pushes, theme installation, publication, database writes or payment actions were performed.

## Repeated browser protocol

The already-authorized Shopify Themes screen was inspected safely. No account identifier or authenticated screenshot is published here. Public official catalog entries supplied listing and demo URLs. The final comparable pass used standalone storefronts, measured at 1440 × 1000 and 390 × 844 CSS pixels, DPR 1. Every theme has home and product desktop/mobile captures. Twenty-two have separate collection captures; Spotlight's homepage is the catalog entry actually observed. All 23 now have an empty-cart entry capture. Menu opening and variant choices have separate probe logs.

For each demo, follow an observed category/product link; do not invent a route to fill coverage. Home desktop captures are full-page; route/device captures are viewport screenshots unless labelled otherwise. DOM measurements include below-fold section/text ordering. Additional story/fit/care/recipe pages were opened when linked: 21 themes, with two lacking a relevant separate entry in inspected navigation. Pitch's observed newsletter link leads to a contact page; it is a form inspection, not an editorial story or a submitted signup.

Official listings were inspected for free/developer/version/family and features. Non-persistent probes selected available variants, opened menus/cart, and exercised a no-result search on Fabric. A Fabric filter drawer was opened, but applying a Color filter was not confirmed because the matching text resolved to a hidden element. Do not count that attempt as a successful filter journey. Controls observed in all themes are distinct from controls exercised. No cart additions or checkout were attempted; no local files were sent to Shopify.

## Tooling corrections

Early embedded preview attempts gave inaccurate/transition viewport readings and iframe pointer errors. Final standalone captures supersede them for comparable claims. A requested viewport is not evidence until `innerWidth/innerHeight` is read. Some first desktop product captures show unloaded media while mobile captures show the image; this is recorded as incomplete loading, not a deliberate empty design or a measured performance defect. No network timing benchmark was run.

A first variant probe required input IDs; newer themes expose labelled radios without IDs. Follow-up semantic radio probes succeeded on seven modern-family demos; Colorblock's native size select was also changed. Products without extra options are not failed variant workflows. An initial generic Heritage cart probe missed the entry; a later direct labelled Cart-button probe opened and captured it. Final named state captures supersede earlier walk notes. Initial Studio routing selected a gift card; a supplementary art PDP was inspected before interpreting the art experience.

## Evidence vocabulary

| Label | Meaning |
|---|---|
| OBSERVED | Direct current browser content/state. |
| MEASURED | Rendered geometry, computed declarations, deterministic source-render output. |
| DOCUMENTED | Opened first-party documentation or current source. |
| HISTORICAL | Prior chat/report/archive, not current verification. |
| INFERRED | Explanation or merchant fit derived from evidence. |
| PROPOSED | Original LetBuyy recommendation. |
| BLOCKED | A required observation could not be established, with reason. |

Evidence IDs, state, source, interpretation and limitations appear in the ledger. A computed font-family list does not prove which font binary painted glyphs. A screenshot does not prove keyboard accessibility. Source hashes prove equality in the supplied experiment, not all merchant behavior. Catalog completeness does not mean all possible configurations were tested.

## Source-derived experiment

`evidence/audit-presets.mts` imports public canonical pure builders, builds all ten bundles, renders index/collection/product using the same six synthetic products, computes template/main-HTML hashes and checks composition type resolution. It also computes additive/full-design application diffs without persisting anything. Thirty HTML artifacts are generated; all ten home fixtures plus representative collection/product fixtures were opened locally in the browser. The fixture bypasses the full Next data-loading app, contains no real merchant catalog, and does not prove installed catalog/draft/release state. Its explicit image/price fixtures were corrected to the renderer's expected featured-image and major-unit contracts before the final run.

## Research limits

No read-only persisted catalog/release snapshot was retrieved; no credentials were accessed to manufacture that branch. Actual merchant saved instances, releases, editor parity and deployed font requests remain unverified. Intermediate-width breakpoints, all hover/focus states, full keyboard/screen-reader behavior, reduced motion, long-content resilience, all filter combinations and non-empty cart are incomplete. These are limitations in a comparative expert study, not claims of defects. No interviews, task success study, conversion experiment or causal UX result was performed.
