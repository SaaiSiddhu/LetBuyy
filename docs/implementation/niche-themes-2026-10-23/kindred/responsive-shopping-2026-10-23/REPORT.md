# Kindred responsive shopping QA

**22/24 layout cases pass. One P2 defect remains open on collection and search at 768px with a long merchant name.** Production source stayed frozen. This isolated static exporter uses the current Kindred v2 factory, real Liquid/CSS/render assembly and admitted discovery response projection. Live SQL filtering, installed lifecycle and header hydration remain NOT_RUN.

| Width | Captures | PASS | FAIL |
| --- | ---: | ---: | ---: |
| 320 | 8 | 8 | 0 |
| 768 | 8 | 6 | 2 |
| 1440 | 8 | 8 | 0 |

Both collection and search were captured in four states: supplied gift filters; repeated unrelated connector/country/category/search keys with sort and page; actual admitted empty response; long merchant/collection and hostile inert labels. The collection fixture represents the store `/products` listing; it does not prove live collection-membership SQL behavior.

| Check | Result | Evidence |
| --- | --- | --- |
| Native Apply/sort and canonical FormData/query roundtrip | PASS, 24 cases | Actual DOM FormData, submitted URLs and parsed values in `browser-report.json`. |
| Independent clear URLs | PASS, 120 native clicks in 24 cases | `native-clear-links-report.json`; removes exactly one key/value, preserves unrelated keys and resets page. Both repeated connector values are cleared independently. |
| Clear-all recovery and next/previous | PASS, 24 cases each | Actual navigation and canonical parsed URLs; recovery renders one paginated product. |
| Actual admitted empty response | PASS, 12 initial controls | Zero card DOM nodes and exact **No matching products.** heading, then successful recovery. Finite fixture response proof; SQL correctness NOT_RUN. |
| Keyboard | PASS for bounded static controls | 432 Tab observations; no hidden panel focus; all 24 Apply controls have visible 2px solid focus. Hydrated menu activation NOT_RUN. |
| Viewport/fonts/contrast/media | PASS except KQA-01 targets | No measured horizontal document/text overflow, broken image, painted hidden state, missing approved font or contrast failure in the 24 captures. |
| Hostile supplied labels | PASS for admitted static render | Initial DOM has no script or inline handler nodes; script/image-like labels remain inert text. Existing sanitizer policy is unchanged. |
| Installed API/DB/buyer/checkout/historical readback | NOT_RUN | No database, held app, seed, install/publish, identity, cart or order was started. |

## KQA-01 — compressed navigation at 768px

**P2, open; no production fix made.** Set merchant name to `Kindred उपहार और Thoughtfully Selected Everyday Celebrations`, viewport 768px, with the ordinary four navigation links. Reproduce either initial long-label route using the allocated exporter:

- `/store/kindred-qa-long-labels/products?limit=1&sort=display_order&min_price=1000&max_price=2000&occasion=birthday&recipient=friend`
- `/store/kindred-qa-long-labels/search?limit=1&sort=display_order&min_price=1000&max_price=2000&occasion=birthday&recipient=friend`

Selectors: `.kr-theme .lb-header__nav-links > a:nth-of-type(1)` through `:nth-of-type(4)`. Occasions/For whom/Under a budget/Ready-made sets measure 18.97/18.61/28.58/31.77px wide, with text broken into vertical strips. Document width stays 768px: this is header compression and target width failure. Exact dimensions/URLs are in `qualification-summary.json`.

Screenshots: `screenshots/collection-long-labels-768.png` and `screenshots/search-long-labels-768.png`. Coordinator writer allocation is required for a focused correction; all shared and Kindred production source remains frozen. The 320px mobile and 1440px desktop long-name cases pass these measurements. Representative 320px search, 768px long-name collection and 1440px collection screenshots were visually inspected. These bounded checks do not certify full installed accessibility.

## Installed gifts preparation

`INSTALLED_GIFTS_LIFECYCLE.md` and `installed-gifts-lifecycle.plan.json` prepare 19 cases, **all NOT_RUN**, against the Editor's exact single 14-product recipe set. The data/schema probe passes and leaves every live binding null. It never calls the setup hook or creates a UUID, token or order. Base oracle: one existing ₹1,100 gift product, stock 8, no variants, three fixed contents rows, supplied image roles; actual shared ₹20 COD rate gives ₹1,120 server total. The proposed occasion/recipient merchant edit remains on that same product.

## Preservation and release

All 91 frozen M1 files and all 15 earlier narrow-header screenshots hash unchanged. Independent388 reports, final receipts and both SQL pins remain preserved; the closed review was not reopened or rerun. Proof: `fixture-manifest.json` and `independent-388-preservation.json`.

**Slot 2 / port 43275 is RELEASED.** Browser runners closed in finally and exited 0. Server PID 15342/session 82485 closed normally and exited 0; `lsof` finds no listener. `resource-release.json` records closure. No held app, user tab, database or full build was touched.

`evidence-hashes.json` pins the owned supplementary files. Earlier runner attempts and screenshots are retained as labelled history; corrections were confined to QA query/heading oracles, with no production or sanitizer change. Full raw DOM/FormData/query/bounds/focus observations remain in the two browser receipts.
