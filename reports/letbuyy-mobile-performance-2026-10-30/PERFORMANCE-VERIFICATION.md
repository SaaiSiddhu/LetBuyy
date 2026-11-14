# Local mobile performance verification — 30 October 2026

> **1 November 2026 follow-up:** The 18 token-alias failures and observed Tamil blocking-time warnings have since been repaired and verified locally. Two default simulated mobile LCP advisories remain open. Current evidence and limitations: [performance and alias follow-up](../letbuyy-performance-green-2026-11-01/VERIFICATION.md). This dated note preserves the original results below.

Implemented and verified local marketing performance repairs on `codex/local-work-preserved-20261025` at `118209b4fde1b5a15313f4741bcac454690d15c8`. The final isolated production artifact is `Jt6Duvm2bymgmwpDPdjxY`; 447 captured source/assets/test/config files match the working tree. The task-only patch covers 41 changed files relative to the task-start dirty tree. Nothing was deployed.

The visible design, geometry and copy match the original within the inspected samples. Font raster comparisons retain tiny antialiasing differences; exact pixel identity is not asserted. All 36 template/locale/theme comparisons, 28 natural-scroll section comparisons and 10 real client-navigation comparisons passed. All eight capability previews fit and remain keyboard operable at both widths; the original globe renderer matches 60 command traces. These checks establish sampled equivalence, not pixel identity or universal device acceptance.

This bounded implementation substantially reduces delivered code, repeated work and mobile main-thread blocking. **Some lab threshold warnings remain where listed below; this is not an all-warnings-green or field-Core-Web-Vitals certification.**

Measured actual mobile results use fresh Chromium processes with DevTools CPU 4×, RTT 150 ms, request latency 562.5 ms and download 1474.56 Kbps. Twenty-one candidate Lighthouse runs cover six repeated English mobile runs, six localized mobile runs, six simulated mobile/desktop runs and three additional HTTP/2 sensitivity runs. The local origin and image optimizer had already served functional QA; cold origin/optimizer/CDN behavior is not certified. The starting baseline is the preceding SEO closeout artifact, served unchanged on 9038.

| Page | Before LCP | After LCP | Before TBT | After TBT | After CLS |
| --- | ---: | ---: | ---: | ---: | ---: |
| Home | 2.257–2.278s | 1.873–1.882s | 711.0–778.8ms | 62.1–65.4ms | 0.000123 |
| Pricing | 2.313–2.361s | 2.060–2.072s | 430.8–484.0ms | 84.4–86.4ms | 0.002438 |
| Setup guide | 2.556–2.574s | 2.287–2.393s | 457.0–521.4ms | 51.8–57.5ms | 0.000000 |

Default Lighthouse simulation and actual DevTools throttling are different lab methods. The simulated HTTP/1.1 and additional local HTTP/2 A/B results remain separate in [the complete comparison CSV](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/PERFORMANCE-COMPARISON.csv). HTTP/2 did not by itself remove the earlier LCP warning; no deployed protocol or CDN outcome is inferred. The extra HTTP/2 run accepts only its temporary local certificate and measures performance, not production TLS. Unchanged baseline rows reused from this session retain their original capture timestamp.

| Localized actual mobile run | LCP(s) | TBT(ms) | CLS |
| --- | ---: | ---: | ---: |
| hindi-home | 1.895 | 103.9 | 0.000000 |
| tamil-home | 1.744 | 319.6 | 0.000000 |
| hindi-home-repeat | 1.716 | 115.9 | 0.000000 |
| tamil-home-repeat | 1.742 | 327.6 | 0.000000 |
| hindi-pricing | 2.223 | 133.2 | 0.001283 |
| tamil-pricing | 2.410 | 300.1 | 0.000119 |

Repairs and mechanisms:

- Select one translated catalogue on the server and share a memoized translator. English ships no translated catalogue. Reuse parent translators for 59 repeated text leaves; preserve every catalogue translation and variable substitution.
- Import the canonical lightweight brand contract instead of its schema barrel. Keep CSP unchanged.
- Reduce the existing Inter subset from 201,620 to 58,308 bytes (71.1% smaller), retaining the 210 codepoints verified for current copy, axes, metrics and license metadata. All 5,976 sampled retained-glyph outline/advance comparisons and the exact variable-outline models match. Only unrequested optional stylistic alternates were pruned; default shaping and current tabular numerals remain. The exact Unicode-range descriptor matches the emitted CSS and actual cmap. The full original font and task-start subset are retained; new characters or typography features require regeneration.
- Move unchanged globe drawing into a browser rendering worker. Keep the same renderer for unsupported/failed-worker fallback, bounded geography parsing, pauses, one-time finale and reduced-motion state. Coalesce pending frames rather than queueing work. Keep native touch scrolling and load the original smooth-wheel driver only for fine pointers.
- Load Motion’s used animation feature bundle synchronously; keep all motion props and avoid unused drag/layout-projection features.
- Preserve shared CSS cascade dependencies in their original order; load independent home/resource rules with their route. 3,136 rule/declaration/condition fingerprints are preserved. Actual decoded stylesheet payload falls 597,817→503,963 bytes on home, 597,817→418,841 on pricing and 651,754→551,698 on the guide. These are decoded CSS sizes, not network transfer savings.
- Reserve the original mobile globe grid row before streamed markup arrives. Allow native offscreen rendering of distant homepage sections while keeping their HTML, links and meaningful copy.
- Retire an always-hidden 188-node accordion after a positive-control audit at 9 breakpoints. Keep the active carousel and necessary sizing probes. Mount only the inert decorative mock when its already-reserved frame becomes visible; preserve descriptions and controls in SSR.
- Read public plans and availability from one fresh canonical `/pricing` response. Keep no-store behavior, retry errors and real local data; remove the duplicate `/remaining` wait. Synthetic transport tests and a browser fault/recovery test verify failure honesty and real gateway recovery.

Implementation locations:

- Translation: [CopyProvider](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/i18n/CopyProvider.tsx), [copy-format](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/i18n/copy-format.ts).
- Rendering: [globe renderer](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/commerce-globe-renderer.ts), [worker adapter](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/create-globe-worker.ts), [capability map](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/CapabilityMap.tsx), [motion provider](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/components/MarketingMotionProvider.tsx).
- Delivery: [shared CSS](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/globals.css), [home CSS](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/home.css), [resource CSS](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/app/resources.css), [image configuration](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/next.config.ts), [public pricing loader](/Users/saai_mithra/Projects/Start_Up/LetBuyy/apps/marketing/web/src/lib/pricing.ts).

Verification and limits:

- 205 marketing/boundary tests, 339 root contracts, 16 shared-type tests and 53 UI tests pass. Marketing/shared types/UI type checks pass, the production build passes, and the ownership/package-export validators pass. Marketing lint/stylelint has 0 errors and 5 pre-existing warnings.
- 489 inherited routes are rechecked: 477 HTML 200 and 12 intentional retired-profile 308s. 192 XML entries include 105 localized articles; three negative controls return 404. This is a regression inventory, not a new discovery/indexing measurement. The 64 browser scenarios include EN/HI/TA desktop/mobile and no-JS views.
- The broader shared-UI `validate:ui` gate still fails 18 pre-existing token-alias snapshot violations. Exact unchanged baseline inputs reproduce the same failures. The palette and snapshots were not changed to obtain a green gate. [Baseline proof](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/evidence/ui-alias-baseline-proof.json).
- The mobile results use Chromium emulation on macOS, including its native Indic fallback fonts; they are not physical Android measurements. No real-user INP/CrUX, physical target-device/Safari/assistive-technology acceptance, live indexing, rankings or production-cache outcome is measured. The [prior external-access checklist](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-seo-local-closeout-2026-10-30/EXTERNAL-ACCESS-AND-RELEASE-CHECKLIST.md) remains applicable. Valid Razorpay test credentials are still an unrelated prerequisite for actual payment acceptance.

Remaining measured lab threshold breaches (LCP>2500ms, TBT>200ms, CLS>0.1):

| Method/run | LCP(ms) | TBT(ms) | CLS |
| --- | ---: | ---: | ---: |
| simulated-http1/pricing | 3797.6 | 19.5 | 0.000000 |
| simulated-http1/setup-guide | 4788.1 | 17.0 | 0.000000 |
| localized-actual-devtools/tamil-home | 1744.4 | 319.6 | 0.000000 |
| localized-actual-devtools/tamil-home-repeat | 1742.2 | 327.6 | 0.000000 |
| localized-actual-devtools/tamil-pricing | 2410.0 | 300.1 | 0.000119 |
| additional-simulated-http2/pricing | 2852.6 | 88.0 | 0.000000 |
| additional-simulated-http2/setup-guide | 3978.4 | 46.0 | 0.000000 |

These numeric lab warnings are retained, including slower repeats; they are not reclassified as passing because another method is faster. Origin-response variability and native-script style/layout work were observed during investigation. The final Tamil trace includes a 251.8 ms task with 250.9 ms attributed to style/layout before the main app-script tasks. This supports a rendering bottleneck, but does not prove one font or CSS rule is its sole cause; see evidence/residual-diagnostics.json. Retained render-blocking stylesheet and server-response details identify the next profiling targets. Further CSS changes must preserve the dependency/cascade acceptance checks; native-script typography changes require explicit visual acceptance. Further local profiling is still possible and is not blocked on deployment or credentials. Profile the remaining Tamil style/layout tasks and shared render-blocking CSS, preserve the existing font glyphs/cascade, then repeat the affected measurements and visual checks. A separately authorized production/preview measurement and representative target-device trace are additional acceptance steps for deployed/field conclusions. The font-blocked and native-face trials are diagnostics only and were not shipped. A smaller same-design subset is the accepted font change. No ranking or revenue gain is promised.

Implementation guidance was checked against [Next.js local font declarations](https://nextjs.org/docs/app/api-reference/components/font), [fontTools subset](https://fonttools.readthedocs.io/en/latest/subset/index.html), [Motion LazyMotion](https://motion.dev/docs/react-lazy-motion), [native content visibility](https://web.dev/articles/content-visibility), and [LCP optimization](https://web.dev/articles/optimize-lcp). These conventions are not ranking guarantees.

Rejected experiments are retained under `evidence/trials/`. The first broad CSS split and the first narrower split changed shared typography and were rejected. The accepted split retains 104 shared-class dependencies and passes the final visual/SPA comparisons. Separate failed harness attempts involved mid-smooth-scroll screenshots, a hidden navigation selection, an assumed catalog order, matching a loading plan skeleton before real data, and confusing HTML language with regional hreflang; the final tests use deterministic positioning, visible links and the canonical clockwise order.

Review and rollback:

Review [the task-only source patch](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/TASK-SOURCE-CHANGES.patch) and [source/binary manifest](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/SOURCE-MANIFEST.json) against the task-start state, not HEAD. The text patch excludes the binary font: the manifest links both prior and final assets and their hashes. Reverse-patch dry-run was checked against a temporary copy. Before any actual rollback, confirm current files still match the recorded after hashes; reverse only these changes and restore the prior font asset. Preserve all unrelated working-tree changes and rebuild/retest locally.

Reusable evidence: [test matrix](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/TEST-MATRIX.csv) · [URL inventory](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/URL-INVENTORY.csv) · [structured acceptance and raw metrics](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/acceptance.json). The ordinary local site remains at [127.0.0.1:9006/in](http://127.0.0.1:9006/in); Gateway 9010, Accounts 9002 and Merchant 9001 are preserved. Temporary verification servers are shut down after collection. No production, environment-file, shared-data or provider mutation was performed.


Final delivery validation confirms current source/candidate and binary rollback hashes, JSON/CSV parsing and local report links. [Delivery receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/evidence/deliverable-validation.json). The repository secret detector found no secret-like values in the inspected text files: [sanitized scan](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/evidence/secret-scan.json). The standalone HTML report passed mobile/desktop overflow and link checks: [report visual receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/evidence/report-visual.json). [Temporary-server cleanup](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-mobile-performance-2026-10-30/evidence/server-cleanup.json) confirms the normal local listeners were preserved and the temporary TLS private key removed.
