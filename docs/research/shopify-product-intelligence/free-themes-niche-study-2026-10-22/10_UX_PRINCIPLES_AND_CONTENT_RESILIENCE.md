# UX principles, tradeoffs and content resilience

This is an expert comparative review. **Observed convention**, **standard criterion**, **design hypothesis** and **user outcome** are different kinds of claim. No measured user outcome is asserted here.

| Principle | Current evidence / tradeoff | LetBuyy proposal / implementation verification |
|---|---|---|
| Stable hierarchy | Origin's featured-product opening and Spotlight's immediate catalog differ from Atelier's large editorial statement | Match hierarchy to shopping intent; test whether representative users can find the relevant category and price. |
| Findability | Studio exposes artist discovery; Tinker exposes workspace task categories; Fabric uses apparel categories | Use typed subject/age/activity/room models where warranted. New facet UI must round-trip to real query results. |
| Density | Trade's quantity rows prioritize repeated operational purchase; Atelier/Vessel leave more space for object presentation | Avoid a universal density default. Check readability, task speed and information loss with the intended catalog. |
| Selection and availability | Named radios, Colorblock native selects and Spotlight sold-out fixture were directly observed | Shared mechanics with niche labels; unavailable means actual server SKU availability, not a decorative badge. |
| Recovery | Fabric's no-result search shows a named no-result message plus a Best Sellers region | Retain the query, separate alternatives from matches, and allow clear/broaden. Do not call alternatives search results. |
| Purchase visibility | Modern demos often place a compact rail beside large media; Trade's table follows supporting detail | Place critical decision facts before commitment. No arbitrary sticky bar that hides options, warnings or focused controls. |
| Honest trust | Demos include assurances/claims and example policies; LetBuyy composition examples include shipping/spec statements | Remove unsupplied promises. Source claims, reviews, warnings and actual shipping policy instead of manufacturing confidence. |
| Keyboard/focus | DOM exposes many labelled controls; the full keyboard path was not exercised | Test focus order, disclosure semantics, Escape, focus return and selected-state announcements in implementation. |
| Mobile reachability | All final narrow captures are actual 390px storefronts; gallery/options stack differently from desktop | Prioritize search/selection/facts and test thumb use; no claim of ergonomic superiority without task observation. |
| Motion | Carousels and media controls are visible; reduced-motion paths were not systematically exercised | Manual media by default, equivalent non-motion content and explicit pause where needed. |
| Reflow/content resilience | Normal demo content inspected; long translated names and empty media were not injected into remote pages | Use local fixtures for missing images/facts, zero products, long titles, 200% text zoom, script expansion and 320px reflow. |
| Loading/performance | Some first desktop captures had blank media that appeared in mobile; no controlled timing measurement | Reserve image geometry, retain usable text and measure shell/data/media/interactivity separately. Do not infer a cache architecture. |

## Standards versus product targets

Accessibility criteria are defined by applicable WCAG requirements, while the proposed larger touch spacing, type defaults and media budgets are product targets. Neither the number of screenshots nor a visually polished demo establishes conformance. The [standards reference](https://www.w3.org/WAI/WCAG22/quickref/) informs the acceptance pack; full assistive-technology and interaction checks remain implementation work.

## Proposed content stress fixtures

| Fixture | Expected resilient behavior |
|---|---|
| 180-character product title in the merchant's actual language | Wrap without covering price/options; full accessible name preserved. |
| No image / failing image / extreme wide or tall media | Stable placeholder and deliberate contain/crop rules; no content shift over purchase controls. |
| Unknown age/ingredients/dimensions/compatibility | Explicit critical absence or omitted optional field; no guessed factual badge. |
| Two variants with same visible color | Named labels and actual SKU identity disambiguate; selected state not color-only. |
| Non-Latin personalization text | Grapheme-aware product-defined validation and readable review; invalid input explained without silent data loss. |
| Two editions sharing title/cover | Author, language and format distinguish entries before purchase. |
| Slow cart / stock race / server price change | Pending acknowledgement, duplicate protection and truthful recovery; no client total authority. |
| Empty category or zero merchant products | Clear scope/empty message, broader navigation and honest sample-data separation. |

Do not inject these stress fixtures into remote Shopify pages or real merchant state as research evidence. Use owned isolated implementation fixtures. Future usability work should recruit actual niche merchants and buyers, test concrete tasks, record errors/time/confidence with consent, and revise the hypotheses; no such study was performed in this task.
