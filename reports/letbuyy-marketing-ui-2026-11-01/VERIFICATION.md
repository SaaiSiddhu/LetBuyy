# Marketing desktop/mobile verification — 1 November 2026

> **1 November 2026 follow-up:** The 18 token-alias failures and observed Tamil blocking-time warnings have since been repaired and verified locally. Two default simulated mobile LCP advisories remain open. Current evidence and limitations: [performance and alias follow-up](../letbuyy-performance-green-2026-11-01/VERIFICATION.md). This dated note preserves the original results below.

The marketing site is running at [127.0.0.1:9006/in](http://127.0.0.1:9006/in). **The tested CSS split preserves the sampled design, typography, content, layouts and animations. Four existing interaction defects were repaired locally. Nothing was deployed.**

## Repairs

1. **Create Site availability:** failed requests previously displayed “Available,” and failed HTTP responses could display “Already taken.” Failures now remain unknown with translated retry feedback. Editing the address aborts the old request; a late response cannot overwrite the current field. Confirmed404 and successful200 reads retain available/occupied states.
2. **Wrong sign-in destination:** Create Site’s “Sign in” link led to signup. It now uses the existing account `/lookup` route, matching the marketing header. Both sign-in and signup reach their actual local email screens on desktop/mobile; no account was created or email submitted.
3. **Menu keyboard focus:** Escape closed menus without restoring trigger focus, and the mobile modal lacked focus containment. The header now reuses the existing shared `useFocusTrap` hook, restores mobile focus, and returns desktop Escape focus to its trigger. The hook is exported and protected by the additive public-API snapshot. Drawer/mega-menu animation remains intact.
4. **Real touch swipe cancellation:** the carousel’s inner scroll containers allowed the browser to cancel a horizontal gesture before pointerup. The same cancellation reproduced in the unsplit control. One scoped touch-action rule now applies the carousel policy to those inner containers. Actual Chromium touch events confirm horizontal swipes advance the card while vertical gestures scroll the page without changing cards; pinch zoom remains permitted by CSS. Both themes pass on the normal local site and final production build.

The patch changes five source/snapshot files. **No existing CSS rule/declaration/condition or animation keyframe was removed.** The original 3,136 rule fingerprints remain, with one added gesture-policy rule (3,137 total). Artwork, fonts, palettes and animation definitions were not edited in this task.

[Task-only patch](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/SOURCE-CHANGES.patch) · [Source manifest](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/SOURCE-MANIFEST.json) · [CSS retention proof](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/evidence/css-retention.json).

## What was verified

| Coverage | Result |
| --- | --- |
| Public URLs |489: 477 HTML 200 and 12 intentional author 308; 192 sitemap URLs include 105 localized articles;3 invalid-route controls return 404 |
| Full source browser scan |573 cases:all 477 HTML URLs at an alternating desktop/mobile/theme setting, plus 96 responsive cases |
| Final configured build |48 additional primary-template desktop/mobile/light/dark views after the touch repair |
| CSS control comparison |96 base +10 support +10 post-repair homepage comparisons; geometry, typography, colours and copy match |
| Natural scroll and client navigation |28 natural-scroll section comparisons and 10 same-document Next navigation comparisons pass |
| Main animations |Worker, unsupported/failed-worker fallback, pause/resume, one-time finale, reduced motion, native touch mode, desktop wheel and locale transition checks pass |
| Capability carousel |All 8 previews fit at 2 widths;keyboard wrap/resize, actual touch swipes and normal autoplay/hover pause/resume pass |
| Open navigation |8 light/dark cases at 320/375 mobile,768 landscape and1366 desktop;menus fit and focus introduces no horizontal scrolling |
| Contact/demo |Desktop/mobile required-field validation and forward/back input preservation pass;no messages submitted |
| Pricing |Real local four-plan read;110/61 comparison filters;synthetic error/failed retry/real recovery pass |
| Account links |Real local signup and sign-in landing screens open at both widths;no credentials entered or forms submitted |
| Source gates |205 marketing/boundary tests,53 UI tests, types,production build,380 protected API exports and stylelint pass;ESLint has 0 errors and 5 pre-existing warnings |

Pages covered include home,pricing,create,demo,contact,support,legal hub/all 15 documents,HTML sitemap,resources hub/categories/tags/search/publisher/changelog/releases and all 105 EN/HI/TA articles, including specialized Liquid/theme guides. Viewport samples include320,375,768,1024,1366 and1920 CSS pixels;768×420 exercises landscape reflow. This is not every possible page×viewport×browser×state combination.

## CSS control and evidence lineage

The control is a **reconstructed unsplit comparison**, not an untouched historical production release: it uses the captured original rule/at-rule order, retains all current declarations, maps 3,119 rules to that order and appends 17 later performance rules. Its 3,136 fingerprints exactly match the split source before today's touch repair. The control and split build share the same starting application code and public assets; this is not an untouched release snapshot. Four sitemap comparisons initially differed only in the visible local origin port; those four were individually rechecked with only origin text normalized. Screenshot pixel diagnostics remain recorded; bit-for-bit raster identity is not claimed.

The broad 573-case scan ran on the final menu/create source artifact on 9039. A subsequent isolated build corrected its explicit local public API/CSP origin; the final touch-only rule was then built on 9045. All 489 URL assertions,48 template views,affected menu/form controls,real touch input and 10 post-fix homepage/control comparisons were rechecked on that final artifact. Earlier main-animation tests were repeated after the menu/create fixes; the touch addition changes gesture policy, not animation code. Separate dated raw results are retained, rather than presented as one untouched build.

The initial touch harness used an obsolete selector and then coordinates near controls; both receipts remain. Hit-tested pointer-event tracing showed genuine pointercancel from the actual preview. The browser-only policy trial, unsplit failure and shipped-rule regression establish the correction. One isolated availability fixture initially lacked its public API/CSP origin; its build environment was corrected without changing CSP or environment files. A temporary sitemap rerun interrupted by a review-server rebuild is retained as a harness failure. These are separate from application defects.

## Runtime, checks and limits

The local Docker engine was off. Starting the existing engine restored its existing Supabase containers, and the local gateway on9010 returned the original four plans (Launch₹199,Growth₹699;Scale/Commerce OS coming soon). No database seed/reset/migration was performed. The local accounts app was started on9002 for actual CTA landing checks. Normal9006/9010/9002 and restored local data services are left available; only task-owned review servers are closed after collection.

The broader UI alias validator still reports the **same 18 pre-existing violations**, with unchanged inputs and exact baseline comparison. No palette change, alias-snapshot waiver or whole-repository-green claim was made. The additive public API snapshot intentionally protects the existing shared hook as export 380. Prior mobile blocking/LCP warnings remain a separate performance backlog; no new field CWV/INP or Lighthouse result is claimed here.

Chromium desktop/mobile/touch emulation was available; Safari/WebKit and Firefox binaries were absent. Physical Android/iOS,assistive technology,200% text resizing,real form delivery,OTP/account creation,payments and deployed behavior are not certified. The navigation/UI harnesses blocked non-GET submissions; availability faults and races used intercepted public GETs. No message, account or payment form was submitted. No live-site,environment-file,provider or release change occurred. This is a local UI verification, not an exhaustive accessibility or production-speed certification.

[Checks and limits](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/CHECKS.csv) · [URL inventory](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/URL-INVENTORY.csv) · [Structured receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/verification.json) · [Source fidelity](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/evidence/source-fidelity.json).

[Cleanup receipt](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/evidence/cleanup.json) confirms normal marketing 9006, accounts 9002 and gateway 9010 listeners were preserved and the verified temporary review servers were stopped.

Final delivery: [source/link/JSON and sanitized secret validation](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/evidence/delivery-validation.json), [normal-site smoke](/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy-marketing-ui-2026-11-01/evidence/normal-local-smoke.json) and a reverse-application patch dry-run passed. These checks do not waive the recorded pre-existing UI alias failures.
