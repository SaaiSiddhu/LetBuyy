# Local marketing resources verification — 31 October 2026

The marketing development server is running at [127.0.0.1:9006/in](http://127.0.0.1:9006/in). The resource library is available at [English](http://127.0.0.1:9006/in/resources), [Hindi](http://127.0.0.1:9006/in-hi/resources) and [Tamil](http://127.0.0.1:9006/in-ta/resources). Nothing was deployed.

All 35 source articles remain present, providing 105 localized article pages. The current source-derived resource URL inventory passes all 435 checks: **414 HTTP 200 responses** (408 HTML pages plus six XML feeds), **12 expected permanent author redirects**, and **nine expected 404 negative controls**. There are no broken resource destinations or heading fragments within the inspected resource links.

| Current route type | URLs checked |
| --- | ---: |
| Articles/guides | 105 |
| Categories | 21 |
| Tags | 267 |
| Resource hubs | 3 |
| Search | 3 |
| Publisher | 3 |
| Changelog and release empty states | 6 |
| XML feeds | 6 |
| Retired author redirects | 12 |
| Invalid-route negative controls | 9 |

Browser verification opened **all 105 article pages**, using alternating mobile/desktop widths, plus **42 representative resource-template views** at both widths across EN/HI/TA. Visible headings/content, page language, loaded article images, horizontal overflow and uncaught page errors passed these samples. Actual desktop/mobile journeys passed library search, keyboard result navigation, opening a real guide, bookmark save/remove, and jumping to an existing heading through the appropriate contents UI. No external form, shared database or payment/provider mutation was performed; bookmarks were synthetic browser-local state.

## Why the large CSS deletions appeared

The preceding performance task moved independent home and resource rules out of the shared stylesheet so unrelated pages download less blocking CSS. Its first broader split changed typography and was reverted; the accepted narrower split kept shared cascade dependencies in their original order. The deletion-heavy intermediate edit in the supplied screenshot does not represent empty final stylesheets.

Current files were rechecked against the previously verified hashes:

| Stylesheet | Lines | Bytes | Loaded from |
| --- | ---: | ---: | --- |
| globals.css | 10,574 | 356,415 | Root layout |
| home.css | 2,991 | 98,238 | Locale homepage |
| resources.css | 1,405 | 88,430 | Resources layout |

These three files total **543,083 bytes**, versus 540,347 bytes in the task-start shared stylesheet. This was chiefly a split of delivered CSS, not removal of all resource styling. The current home/resource imports exist, and all three file hashes match the previously verified final files. The prior split proof preserved 3,136 rule/declaration/condition fingerprints; its 36 visual, 28 scroll and 10 client-navigation comparisons remain dated prior evidence. Today's checks independently verify page opening, responsive layouts and reading interactions. No application CSS or article record was changed in this task.

## One local development fix

The Next.js development indicator intercepted the mobile reading dock's Contents button. An actual hit-test returned `NEXTJS-PORTAL` at the button center, with no runtime-error dialog or console error. Added `devIndicators: false` to the existing Next configuration; after automatic restart the hit-test reaches the button's own content, and the real mobile/desktop contents interactions pass. This changes the development indicator setting, with no deployment. Marketing TypeScript checking and scoped whitespace checking pass.

[Exact two-line configuration patch](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/TASK-CHANGES.patch) · [Current configuration](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/next.config.ts) · [Before obstruction evidence](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/evidence/dev-overlay-before.json) · [After evidence](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/evidence/dev-overlay-after.json).

## Evidence and limitations

[URL inventory](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/URL-CHECKS.csv) · [Structured verification](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/verification.json) · [Browser results](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/evidence/browser-results.json) · [CSS confirmation](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/evidence/css-confirmation.json).

![Current resource library, desktop](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/evidence/resources-1366.png)

The initial HTTP harness treated the lower-case `location` header as case-sensitive; its failed receipt is retained, and the corrected redirect checks passed. The initial interaction selector targeted an unused older mobile TOC component; the test was corrected to use the real floating article dock. That exposed the actual development-indicator obstruction, which was fixed and retested. All 147 already-passing page-opening cases were retained when rerunning the affected interaction checks. The HTTP inventory and initial browser page loads preceded the indicator-only configuration fix; the affected control flows and hit-test were verified after it.

This is a local development verification, not a production audit or performance benchmark. Full browser/assistive-technology coverage, physical devices, signup/billing, field Core Web Vitals and live indexing are outside this check. Existing middleware deprecation and prior performance/shared-UI backlog items are not claimed resolved here. Existing unrelated working-tree changes and environment files were preserved. The marketing server is intentionally left running on port 9006.

[Final delivery validation](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-resources-local-2026-10-31/evidence/delivery-validation.json) confirms parsed JSON, valid local report links, unchanged CSS hashes and no secret-like findings in the inspected text files. The two-line configuration patch also passed a reverse-application dry-run check without changing the working tree.
