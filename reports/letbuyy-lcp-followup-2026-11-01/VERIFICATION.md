# Local marketing performance follow-up — 1 November 2026

**Status: partial. The two requested simulated LCP targets remain open.** The local source improvements and the checks below are verified; this is not an all-green performance acceptance. Nothing was deployed.

Retained production build: `W9oy6Qmr7OkmbbL7Lz_ei`. Working site: [marketing](http://127.0.0.1:9006/in), [pricing](http://127.0.0.1:9006/in/pricing), [first-store guide](http://127.0.0.1:9006/in/resources/platform/building-first-letbuyy-store).

## Retained changes

- Deliver the current locale’s navigation dictionary from the existing server locale layout through the existing copy context. Header and footer retain their markup, controls and labels.
- Render the presentational article sidebar on the server; make the final CTA server-eligible for server-route imports such as pricing. The existing homepage client boundary can still include the CTA.
- Share identical comparison-matrix references in the fresh canonical pricing response for React Flight. The regression test verifies all serialized values, distinct matrices and unavailable-plan flags remain unchanged.
- Optimize public package imports and consolidate already-shared client modules; annotate the unused icon-name-list initialization as pure.
- Deliver a deterministic 44,600-byte Inter face instead of 58,308 bytes. The original fonts remain. Only zero-contribution variation tuples below the current delivery range were removed. All 332 glyphs, including non-Unicode alternates, passed 18,260 exact outline/advance checks; shaping, positioning, metric, cmap and name tables are unchanged. The delivery range is 400–900; the original full-range input remains available.

All 20 existing CSS source files are byte-identical to the task-start snapshot. Animation implementations and the header’s motion state/effects/markup are preserved. All 142 pre-existing non-Markdown public assets remain byte-identical. The extra CSS-scoping, asynchronous-motion, whole-chrome lazy-loading, prebuilt-image and aggressive runtime-merging trials were not adopted.

## Original performance target — still open

Budget retained: LCP ≤2,500 ms, TBT ≤200 ms, CLS ≤0.1. Lighthouse 13.6.0; pinned Playwright Chromium 148; mobile 412×823 at DPR 1.75; default simulated throttling; local HTTP/1.1. Browser launches are separate; the server’s optimizer/cache state can warm across runs. No claim of a cold CDN/serverless run is made.

| Page | Three simulated LCP results | Median | Result |
|---|---|---|---|
| Pricing | 3.393s, 3.559s, 3.450s | 3.450s | Open |
| First-store guide | 3.758s, 3.828s, 3.828s | 3.828s | Open |

All six final simulated repeats fail LCP. Their TBT and CLS pass. The output is retained as a failed budget lane; no threshold, throttle, viewport, browser-specific page content, or measurement method was changed to mark it green.

The shared JavaScript/render path remains the next profiling target. The investigation did not establish that these are false positives, and no complete source repair is claimed. More local work is possible; no missing external credential is being used as a reason to close these issues.

## Separate observed lab measurements

All 9 observed mobile cases passed (home, pricing and first-store guide in English/Hindi/Tamil): LCP 1881.8–2121.2 ms; maximum TBT 126.1 ms; maximum CLS 0.000000. All 3 observed desktop cases passed. These use DevTools throttling and are not interchangeable with the simulated values above. They are lab measurements, not real-user Core Web Vitals. INP and field data were not measured.

## Functional and design verification

- Production build, marketing tests (4 auth-boundary + 202 marketing tests), type checks, ESLint and stylelint passed. Existing Next middleware-to-proxy deprecation remains a non-blocking framework advisory.
- UI: 53 tests, lint-rule self-test, 7 codemod fixtures, 380 protected public exports, 371 token variables, 138 protected token-alias groups and all four mutation controls passed.
- 489 known public URLs: 477 HTML 200 + 12 intended retired-profile 308 redirects. All 35 articles across three locales are present. No checked broken internal link/fragment, canonical error, missing article or sitemap error. Three unknown-URL controls returned 404. Global sitemap: 192 entries; each locale: 35 RSS items and 43 resource XML URLs.
- 573 browser cases and 48 representative delivery-template checks passed. Desktop/touch controls, focus/menu behavior, pricing interactions, carousel, animation modes, locale SPA navigation, native font parity, 28 natural-scroll comparisons and no-JavaScript navigation passed.
- Main visual matrix: 96 before/after comparisons; no layout/copy differences. Additional illustration comparisons bring the unique configuration coverage to 102. Main-matrix maximum mean pixel-channel difference: 0.00096446. Sampled sans weights: [400, 500, 600, 700, 750, 800].

This samples meaningful templates and responsive/theme/locale combinations; it is not every page × device × browser permutation. Safari, Firefox and physical phones were not certified. No account/payment mutation, provider-payment verification, analytics-setting change or live-site deployment was performed.

## Remaining work

Keep both rows in `OPEN-ISSUES.csv` open. Profile the initial shared runtime, header/menu client boundary and article’s static versus interactive UI delivery before proposing a larger split. A candidate must pass three unchanged simulated mobile runs per warned page and the existing observed, functional and visual gates. Do not substitute the observed results or an HTTP/2-only result for the failed original HTTP/1.1 lane. No ranking/revenue gain or completion date is promised.

## Evidence and review

- [Performance results](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/PERFORMANCE-RESULTS.csv) · [Open issue register](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/OPEN-ISSUES.csv) · [URL checks](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/URL-CHECKS.csv)
- [Structured results](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/verification-data.json) · [Task-only source patch](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/TASK-SOURCE.patch) · [Trial register](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/TRIAL-REGISTER.csv)
- [Build/source identity](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/accepted-build-identity.json) · [Preservation proof](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/preservation.json) · [All-glyph proof](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/all-glyph-proof.json)
- [Main visual comparison](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/visual-comparison.json) · [Functional run receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/verified-functional-checks.json)

Implementation references: [CopyProvider](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/i18n/CopyProvider.tsx), [pricing loader](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/pricing.ts), [webpack configuration](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/next.config.ts), [font recipe](/Users/saai_mithra/Projects/Start_Up/LetBuyy/scripts/marketing/prepare-inter-weight-subset.py), [font documentation](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/public/fonts/README.md).

Method references: [FontTools subset documentation](https://fonttools.readthedocs.io/en/latest/subset/index.html), [OpenType coordinate/interpolation model](https://learn.microsoft.com/en-us/typography/opentype/spec/otvaroverview), [OpenType glyph variations](https://learn.microsoft.com/en-us/typography/opentype/spec/gvar), [Next package import optimization](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports), [Webpack split chunks](https://webpack.js.org/plugins/split-chunks-plugin/).

Normal development-port verification also passed: 18 desktop/mobile cases on 9006 across all three languages. The public BFF and gateway9010 agree on four real plans; the delivered font hash matches the proven source asset. [Normal-port receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/normal-dev.json). The task-only text patch reverse-check passed and restores every changed existing text file byte-for-byte in an isolated fixture. [Rollback proof](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/rollback-proof.json). The font README’s Python command was clarified after the build; compiled sources and font bytes are unchanged, and the build identity records that documentation-only edit.

Final isolated follow-up trials were also discarded: embedding full-resolution optimized illustrations in HTML produced simulated LCP 3.231s / 4.205s (pricing / guide) and increased payload; changing the priority-image decode hint produced 3.360s / 3.758s. Neither trial changed the retained root source. Recomputing the installed Lighthouse dependency graph from the saved guide trace/log reproduced its 3.758s result; its estimates include shared-runtime network/CPU work before the paint. This identifies the modeled critical path, not proof of a false-positive measurement or a completed fix. The original final source/build results above remain the acceptance evidence.

Owned review listeners 9048–9051 are stopped. The normal marketing 9006, gateway 9010 and accounts 9002 remain running, with fresh successful read-only health checks. [Service receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/service-cleanup.json) · [Closing source receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-lcp-followup-2026-11-01/evidence/closing-source-receipt.json).


## Follow-up — 2–3 November 2026

The [next local investigation](../letbuyy-lcp-repair-2026-11-02/VERIFICATION.md) retains the two original simulated failures as OPEN. It adds a semantic article-landmark fix and repeatable measurement guard, with final exact-build simulated medians3.537s/3.875s and separate passing applied medians1.941s/2.091s. New controlled diagnostics and an open upstream Lighthouse issue support a model-sensitivity hypothesis; they do not waive either target or establish field Core Web Vitals. No payload/CSS/motion prototype was adopted and nothing was deployed. This earlier report's historical findings and measurements remain unchanged.
