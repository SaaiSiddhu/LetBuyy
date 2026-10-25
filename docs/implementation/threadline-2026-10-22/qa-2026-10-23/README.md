# Threadline buyer-runtime QA — 23 October 2026

Status: **requested mobile cart, 320/390px reflow and working local preview/login verified**. Broader end-to-end acceptance retains the explicit limits below. This continues the earlier implementation; it does not restart the theme or certify the nine-theme programme. The owner’s continue instruction was verified in `Themes`, and the later scoped coordination instruction was verified in `Audit and complete theme editor`.

Ownership is buyer-runtime cart/search/account rendering and its focused tests. Editor UI/schema and marketplace/catalog/demo enhancements belong to their assigned chats. No identity token palette, schema, pricing, tax, ledger, provider, deployment or push change is part of this work.

## Verified findings and repairs

| Finding | Evidence before repair | Scoped change | Current verification |
|---|---|---|---|
| Cart claimed to be modal while focus remained on the page; Escape did not dismiss it | `cart-focus-before.json`, `cart-focus-before.jpg`; real-island failing regression | Existing cart island uses native modal dialog, useful initial focus, native background/Tab behavior, cancel handling, opener return and retained action focus through totals updates | Real-island regression/full commerce pass; native production browser verifies initial focus, background exclusion, Escape and opener return. Final corrected-source production browser checks at 320px and 390px pass, including native click/Enter opening, Escape and focus return. |
| Predictive search on a canonical store hostname requested an unscoped path and reported no results for a visible Linen Shirt | Actual browser root path `/`, visible product, empty search state; pathname-only source inference | Bind the existing server-provided store base path into the predictive island; preserve tenant-safe ProductService and six-result projection; distinguish unavailable from successful empty results | Production browser on canonical-host root verifies real Linen Shirt suggestion, ArrowDown selection while input retains focus, and full-search navigation; fixture setup boundary below. |
| Buyer order amounts appeared 100× too small | `buyer-order-before.jpg`, `order-server-amounts.json`: server subtotal ₹2,490, GST ₹448.20, shipping ₹20, total ₹2,958.20; UI showed ₹24.90 / ₹29.58 | Convert server major-unit receipt fields once at the Liquid presentation boundary; share summary mapper; prefer server line total; invalid/unknown money produces unavailable, not fabricated zero | Regressions pass; production browser summary/detail/reload show INR 2,958.20 total, INR 2,490.00 item and INR 448.20 GST. |
| Pending COD and unknown statuses marked future fulfillment steps as reached | Actual pure mapper regression showed Pending through Delivered for `pending_cod` | Pending COD reaches Pending only; unknown/cancelled states cannot invent completed delivery | Production browser DOM shows only Pending has is-reached; future steps remain unmarked. |

The monetary change formats existing server receipts. It neither changes stored values nor derives a payable order total from browser input.

## API setup and browser evidence are separate

The opt-in QA fixture configures/publishes Threadline through existing theme APIs. Its buyer is created through the actual Identity Next registration API using the public challenge test-key boundary. Registration returned **201**, repeat registration **409**. A signed, site-bound COD order through the real gateway returned **201**; exact retry returned the same order and one buyer ownership link.

The browser then used the normal existing-password buyer login, explicit consent and tenant-bound return. The populated orders list and direct order detail were reached. This is browser readback of an API-created order. It is **not** a claim of public browser signup, browser checkout, payment or real-provider completion.

Private credentials/control material stay in mode-0600 `/private/tmp/threadline-qa-20261023-state.json` and the separate final-source state file. They are not included here. Earlier review state files and browser tabs remain distinct.

## Validation boundaries

- Full commerce command after the scoped repairs: **162 + 148 + 1,052 passed**, zero failures/skips in those groups. Counts overlap existing contract coverage and are not a unique aggregate.
- Commerce and gateway TypeScript checks pass.
- The initial cart focus regression and order money/timeline regressions failed for the actual observed behavior before repair; these were corrected rather than weakening assertions.
- Governance first returned 113 pass / 1 fail because the isolated clone’s reviewed secret-scan exception referenced an untracked fixture helper. Staging the intended test-support additions **only in that disposable clone** made the environment validator pass. The active checkout index was not changed. Final gate returned 114 PASS, zero FAIL/BLOCKED/SKIP and one NOT_APPLICABLE. Final follow-up gate after the responsive CSS repair also returned 114 PASS, zero FAIL/BLOCKED/SKIP and one NOT_APPLICABLE.
- The final source refresh uses current canonical shared styling. Only its isolated Next configs have supported `experimental.cpus: 2` overrides; canonical workspace Next configs are unchanged. Builds are serial, use owned output directories, and use `--no-reap`.
- Readiness uses a bounded twenty-minute monotonic deadline per app. No successful startup or performance result is inferred from compilation alone.

## Fixture preservation and startup failure

The previous six-hour review app ports refused connections on resumption. The first fresh production attempt, run `a67a4387ed5f`, compiled Identity but did not become ready during page-data collection with seventeen workers. Cleanup terminated its build after readiness failed. That attempt is failed evidence, not a successful acceptance run.

That first attempt inadvertently used the runner’s default stale-resource reaper. It removed leftover volumes for expired owned runs `62f08dede636`, `80b26053be15` and `bdf998c821f8`, each with a dead owner PID. Complete preservation of those expired resources is therefore **not** claimed. No live/shared/restored database, unrelated container or backup was deliberately cleaned. Private prior state files and user tabs were preserved. Subsequent attempts explicitly disable reaping.

The coordinator-authorized bounded retry, run `ea0211a62364`, reached all three production apps with two workers and completed API setup. It supplied the before-repair browser evidence. One further final-source production refresh was authorized only after the necessary runtime repairs and focused checks stabilized.

## Remaining browser qualification

Modal keyboard/focus, real canonical-host search, and corrected order amounts/status were exercised in production tab 41. Native dialog traversal briefly enters browser chrome between the last/first controls; no background page control receives focus. This is not a claim of a custom circular Tab trap. Tab 40 preserves the before-repair receipt; earlier user/acceptance tabs remain untouched.

The real 320px check found that root scrollWidth alone concealed header clipping: document width 314px, body width 414px, Cart extending to x414. The header now has a narrow Threadline runtime wrap rule in `apps/commerce/web/src/app/store/[subdomain]/liquid-theme.css`; immutable package 2.0.0 bytes stay unchanged. The native cart also changes 100vw to percentage width because the scrollbar made it extend 6px left of the viewport. Final corrected-source production verification confirms the header and modal fit both widths: content widths 314px/384px inside 320px/390px viewports, with no negative modal left edge. Native cart clicks at both widths open the modal and transfer focus to Close cart. The populated Oat/M cart, full cart and reload persist the selected variant and server totals.

The read-only browser bridge did not expose the Performance Timeline API. Any HTTP timing artifact here is an explicitly local, unthrottled server/document diagnostic, not LCP, INP, CLS, a Lighthouse score or field performance certification. A native zoom shortcut produced no measurable viewport/DPR change and was reset; 200% zoom is not claimed from that attempt.

Checkout TLS remains the explicit manual dependency. No browser certificate warning was bypassed or TLS verification disabled. Public signup credential entry/submission also remains separate from API registration proof.

## Search fixture correction

The initial final-source search request correctly reached the store but returned an empty result. Read-only owned database proof showed three directly seeded products and zero search documents. This fixture does not run the queue workers that normally populate the existing search reader. After confirming run labels, a live owner, the matching database marker and the exact three synthetic product IDs, only those fixture read documents were populated with the existing `event-core` planner. The public suggestion API then returned 200 with the actual shirt, followed by the browser keyboard/full-results proof in `search-after.json` and `search-results-after.jpg`. `search-fixture-setup.json` records the boundary. This does **not** prove queue execution, a rebuild infrastructure, or production search freshness. The opt-in QA setup now prepares the same fixture data before future app starts.

## Focused contrast and performance

`computed-colors.json` records actual rendered text/action colors. Six explicit opaque sRGB pair measurements in `contrast-results.json` meet their selected thresholds: primary text 15.41:1; supporting text 6.50:1 on the background and 5.67:1 on the surface; white action/announcement text 8.52:1; blue focus indicator 5.60:1 on the background. This is a focused pair measurement, not complete accessibility or assistive-technology certification.

`http-performance.json` records nine anonymous, unthrottled loopback production reads (home/listing/PDP), all HTTP 200, and uncompressed script/document bytes. It is a server/document diagnostic, not a browser paint or Core Web Vitals result.

## Final 320/390px checkpoint and working preview

Final owned production run `e3596680a4c1` built and served Identity, Merchant and Commerce serially with two workers and `--no-reap`. All earlier resources were preserved. The held runner reached its manual review state; because its six-hour hold remains active, it is not reported as a completed test-suite exit.

`review-mobile-checks.json` records **sixteen loaded-state checks**: home/header, empty cart modal, product detail, populated cart modal, full cart, product listing, orders list and order detail at each of 320px and 390px. Each tested document/body fits its viewport; the modal fits the available 314px/384px content width. The order-list total originally extended to x325.56 at 320px. Its Threadline-only runtime CSS now gives the total a separate mobile row; final total right edge is x298. The published portable package remains unchanged.

The final API-created receipt is read through normal buyer login and consent: INR 2,958.20 total, INR 2,490.00 shirt and INR 448.20 GST, with only Pending marked reached. Browser-created checkout/payment is not inferred. The current public search suggestion read returns the actual Linen Shirt (200); prior actual browser keyboard and full-results evidence covers the unchanged search source.

The requesting owner's generated merchant account was verified through lookup → password → dashboard → installed themes. The theme surface shows Threadline 2.0.0, Current theme, Published design and Customize/Edit theme. A merchant reload after mixed local buyer/fixture activity returned to lookup; a fresh password sign-in followed by an immediate hard reload retained the authenticated dashboard. The cause of the earlier session loss is not established. Persistent simultaneous sessions across multiple localhost fixture ports are not certified, and no identity/cookie protection was changed.

- Storefront: <http://syn-threadline-ui-e853e084.localhost:58669/>
- Merchant: <http://localhost:58668/>
- Theme controls: <http://localhost:58668/syn-threadline-ui-e853e084/online-store/themes>

These are temporary owned local review apps with a six-hour hold from readiness. Credentials remain only in the private mode-0600 `/private/tmp/threadline-qa-review-20261023-state.json` and were delivered directly to the requesting owner. `working-preview.json` contains sanitized links and the run boundary. Merchant tab 44 and storefront tab 45 are retained as deliverables; user and earlier proof tabs remain untouched, and the viewport override was reset.
