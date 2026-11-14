# Local marketing LCP investigation and verification

**Status: partial. The requested two simulated LCP warnings are not resolved. Nothing was deployed.** The final exact-build acceptance command exits **1** because both original simulation lanes fail. Passing lab measurements from another method do not close these failures.

Work began 2 November 2026 and continued across midnight in India. This folder retains its start date; evidence records UTC capture times.

## Retained changes

- Corrected the resource article's inner landmark from `<main>` to `<article>`. The resources layout already owns the page's main landmark. This fixes nested main landmarks on 99 localized article URLs; all 105 article URLs now have a single main. Existing theme/Liquid guides already used article semantics. This is an accessibility repair, **not an LCP repair**.
- Added `scripts/marketing/verify-performance.mjs` and its typed summary helper. It preserves the original simulated budget and adds a separate applied-throttling lane, repeats each page/method three times, saves raw evidence and exits nonzero for any failed/incomplete required lane. Four meaningful regression tests prevent one good run, duplicate repeat IDs, a diagnostic, missing data or a different method from hiding a failure. No dependencies were installed for this runner.
- No payload, CSS, font, image, motion or delivery prototype was copied into the application. All 20 CSS files are byte-identical to the task-start snapshot. Existing font/client-payload improvements remain. Animation source, public asset bytes, layouts and plan data were preserved.

The task-only [source patch](SOURCE-CHANGES.patch) passes reverse-apply validation. Existing unrelated dirty-tree changes were preserved. The patch is relative to this task's start, not a claim to own the repository's whole pending diff.

## Final performance acceptance

Exact final root build: `9FZ_PgpzwvN4OhjEOO2b_`. Lighthouse 13.6.0 and installed Playwright Chromium 148, mobile 412×823 at DPR 1.75. Defaults retained: 150ms simulated RTT, 1638.4Kbps throughput and CPU slowdown 4. Complete actual settings and versions accompany every run. Fresh browser launches were used; server image/cache state can warm between requests. This is local HTTP/1.1, not a cold production edge or physical phone.

| Page | Method | Three LCP samples | Median | Lane result |
|---|---|---|---|---|
| Pricing | Original simulation | 2.876s, 3.537s, 3.538s | 3.537s | FAIL |
| Pricing | Applied DevTools throttling | 1.935s, 1.944s, 1.941s | 1.941s | PASS |
| First-store guide | Original simulation | 1.504s, 3.875s, 3.877s | 3.875s | FAIL |
| First-store guide | Applied DevTools throttling | 2.089s, 2.091s, 2.092s | 2.091s | PASS |

Unchanged budgets: **LCP ≤2,500ms; TBT ≤200ms; CLS ≤0.1**. Every final sample passes TBT and CLS. Pricing fails all three original LCP simulations; the guide fails two of three. Both original lanes remain open. All six applied-throttling LCP runs pass; those remain separately labelled lab results. Neither method measures field Core Web Vitals or INP.

## What the investigation established

The model is materially sensitive to request timing. An isolated diagnostic adding 250ms to unchanged app scripts made a single simulated run per page appear to pass. All 11 initial pricing script bodies matched the baseline byte-for-byte. The delay/proxy was never adopted and its numbers are excluded from acceptance.

This behavior resembles an [open Lighthouse fast-request dependency issue](https://github.com/GoogleChrome/lighthouse/issues/17436). The connection is a supported hypothesis, not a confirmed upstream diagnosis of this site or proof that real-world performance is problem-free. Lighthouse also documents limitations of [both throttling methods](https://github.com/GoogleChrome/lighthouse/blob/main/docs/throttling.md). See [measurement investigation](MEASUREMENT-INVESTIGATION.md) for the saved graph, primary sources, controls and limits.

[TRIAL-REGISTER.csv](TRIAL-REGISTER.csv) records 48 measured page runs across 24 baseline, candidate or diagnostic variants. Additional builds without accepted measurements are not presented as performance passes. Bundle splitting, theme boundaries, compression, token delivery, CSS ownership, fonts, native images, rendering islands and motion initialization trials either failed the target, had incomplete validation or introduced unacceptable behavior. The temporary selective-hydration trial produced unknown-route 200 responses and was rejected. None was deployed or adopted. Trial names such as “final-candidate” are scratch labels, not acceptance.

## Final checks

- Fresh production build, marketing TypeScript, ESLint and stylelint: pass. Marketing/auth suite: **206 marketing + 4 auth-boundary tests**, all pass. New measurement helper/test types: pass using the installed Node type roots. Runner syntax, external-origin rejection and reverse-patch check: pass. Initial harness/configuration errors were corrected; no source-type error was waived.
- Shared UI: **53 tests**, lint-rule self-test, 7 codemod fixtures, 380 protected public exports, 371 token variables, 138 token-alias groups and all 4 independent mutation controls pass. UI typecheck passes. The former 18 alias violations are not reproduced by the current gate.
- **489 known URLs**: 477 HTML 200 and 12 expected retired-author 308 redirects. Expected titles, canonicals (temporary origin normalized), language and H1 count match. Global XML has 192 entries; each locale has 35 RSS items and 43 resource XML URLs. Three unknown-route controls return 404. All 35 articles across 3 locales are present. Main-landmark checks pass across resource pages. This was a bounded known-URL check, not a new exhaustive discovery crawl or a fresh audit of every link fragment.
- **48 browser page cases**: pricing/guide × 3 locales × 3 widths (320,375,1366) × 2 themes, plus 12 no-JavaScript cases. All pass status, primary text, layout overflow, loaded-image and runtime-error checks. Pricing renders four real local plan cards. Eight English desktop/mobile/theme interaction cases pass menu opening/Escape, comparison expansion/collapse, local account-link targets, keyboard guide tabs, and contents jump/close. No state-changing request was submitted.
- **12 direct before/after article comparisons**: 3 locales × 2 widths × 2 themes. Text, measured geometry, font/color/display styles match exactly. Corrected article semantics and a single main are verified. Eight final desktop/mobile screenshots are retained; the mobile light guide and desktop dark pricing screenshots were visually inspected.

The 573-case whole-site browser matrix and broader animation suites from 1 November were not all rerun here. Their application CSS/motion source is unchanged; this report's new browser/visual coverage is specifically the bounded matrix above. Do not describe the earlier matrix as freshly executed.

## Local services and limits

Marketing is available at [pricing](http://127.0.0.1:9006/in/pricing) and [first-store guide](http://127.0.0.1:9006/in/resources/platform/building-first-letbuyy-store). Canonical gateway 9010 and accounts 9002 use the existing local configuration/database. Real public plan reads verify Launch ₹199, Growth ₹699, and the existing coming-soon Scale/Commerce OS plans. No resets, seeds, migrations, credential edits, provider transactions, messages, indexing submissions or configuration changes were made. Task-owned temporary comparison listeners were stopped.

No whole-monorepo gate, physical Android/iPhone, Safari/Firefox, system-wide packet shaping, production CDN, paid provider or production field-data acceptance is claimed. The existing Next middleware/proxy migration advisory remains non-blocking. The known public URL scan also observed no main landmark on three create-site URLs; this separate low-severity debt is recorded without claiming it affects these LCP measurements.

## Remaining work

**LOCAL-LCP-01 and LOCAL-LCP-02 stay OPEN.** No missing credential is used as a reason to close them. Further local candidates must address a demonstrated render dependency and pass three unchanged simulated runs per page plus the functional/visual gates. Do not adopt artificial delays, browser detection, altered budgets or a passing median that conceals failures. The current work did not find a safe source repair that meets this requirement.

[Remaining issues](REMAINING-ISSUES.csv), [exact performance samples](PERFORMANCE-RESULTS.csv), [check receipts](CHECKS.csv), [structured verification](verification-data.json), and [evidence](evidence/) retain the result for the next investigation. External production field access or packet/physical-device measurements can help adjudicate real-world impact; they are additional validation, not proof that these local failures are fixed.


## 3 November 2026 — Scoped follow-up

The [release-readiness phase](../letbuyy-seo-release-readiness-2026-11-03/STATUS-AND-EXECUTIVE-SUMMARY.md) fixes LOCAL-A11Y-02: all three create-site locale routes now have one main landmark, with12 matching before/after cases and current-profile Chrome smoke. All20 marketing CSS files and animations are unchanged. No performance-source repair or new Lighthouse run is claimed; LOCAL-LCP-01/02 remain open with this report's original measurements. Authenticated GSC/Firebase/Vercel evidence is now available in the new packet, so prior external-access limitations must be read with that dated update. Nothing was deployed.
