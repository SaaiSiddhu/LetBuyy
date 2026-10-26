# Marketing audit fixes — 23 October 2026

Implemented in the current working checkout; no commit, push or deployment. Pre-existing changes outside marketing were preserved.

## What changed

- M01/M04: search click and Enter destinations include category and preserve locale. The combobox identifies its active result for assistive technology.
- M03/M06: shared header links reach the actual pricing page and homepage sections from secondary pages. Root metadata/assets stay unprefixed; localized resource feeds stay localized. The nonexistent `how-it-works` target now reaches the merchant journey.
- M02: all five fake newsletter form placements now share one truthful unavailable message and a working RSS link. Removed invented subscription confirmation, promised Tuesday delivery and unsupported subscriber counts. No subscription endpoint exists in the current public gateway, so email subscription capability was not invented.
- M05: the capabilities jump is labelled “Explore capabilities”.
- M07: Hindi/Tamil homepages display a notice in the selected language that their body remains English, and the main content has `lang="en"`. This resolves the misleading language presentation; it is not a complete body translation.
- M08/M09: privacy choices read saved values on opening, report storage failures, and use the shared modal. Newsletter also uses the shared modal. Shared focus trap, inert background, Escape, focus return and scroll lock replace the incomplete local dialog logic.
- Shared-dialog CSS integration: include the UI package in Tailwind scanning; move the universal spacing reset into the base layer so shared utility spacing works; place portals above marketing chrome and constrain dialogs to the viewport.
- M10: cancel the homepage animation frame on unmount; skip smooth scrolling when reduced motion is requested at mount.
- M11/M12: frozen ecosystem destinations lead to existing public guides, retain the reader's locale, and use Guide/Plans labels. Illustrative dashboard/activity fixtures are labelled as previews/sample data. Architecture copy describes the monolith and transactional outbox.
- M13: privacy icon uses the bundled local SVG instead of the configured example CDN.
- Public pricing proxy sanitizes upstream exceptions.
- The local API gateway (9010) and identity app (9002) were started alongside marketing (9006). Pricing now returns real local API data; signup redirects reach the identity app. No database migrations or provider messages were executed.

## Verification

- Marketing production build: exit 0, 494 static pages generated.
- Marketing TypeScript: exit 0; production build also completed its TypeScript stage.
- Marketing package tests: 10/10 (four existing boundary tests, six new behavior tests for locale/query/fragment/root metadata/feed routing).
- Existing marketing dead-twin contract tests: 3/3.
- Marketing lint: 0 errors, 326 warnings remaining. This change does not claim to remediate the full warning backlog.
- Browser at 490px: keyboard search opened `/in-hi/resources/ecommerce/how-to-start-an-online-store-india`; mobile Pricing navigation from Demo reached `/in/pricing`; API-backed plan cards loaded; dialogs trapped focus and returned it on Escape; privacy Personalization=true survived reload and was restored to its original false state after testing; newsletter displayed honest availability and its localized RSS link; Hindi fallback notice rendered; the dialog screenshot confirms visible spacing, backdrop and stacking.
- Production build and development compilation can temporarily interfere with dev route responses. Two transient developer-article 404s during verification passed an isolated retry. **Final crawl after build completion: 499/499 discovered URLs returned HTTP 200**, including pricing and signup redirects; see `route-results-after.json`.
- `git diff --check`: clean for the changed source/test paths.

## Limits and follow-up

- Newsletter email delivery and complete Hindi/Tamil translations remain unavailable, explicitly disclosed in the interface.
- No real accounts, contact/demo submissions, payments or provider deliveries were performed. The local app/API being reachable does not certify those external journeys.
- Desktop/tablet/320px acceptance, full assistive-technology review, production performance and the lint backlog remain separate follow-up work.
- The original corrupt dev manifest was preserved. A successful restart and subsequent build do not establish the cause of that original corruption or guarantee that it cannot recur.

Screenshot: [newsletter dialog](newsletter-fixed.png). Original audit remains historical evidence; use this record for the corrected state.

## Mobile navigation visual refinement

Owner screenshot follow-up: replaced the oversized undifferentiated menu list with a compact editorial hierarchy: two featured platform entries, four supporting resource/plan rows with Lucide icons and descriptions, a quieter header and a persistent login/signup action area. Refined both submenus with topic headings, consistent spacing and restrained borders. Colors use the existing semantic theme tokens, including light/dark support. New main-menu descriptions are included in English, Hindi and Tamil dictionaries.

Marketing sans/display typography now uses locally hosted variable Manrope, 200–800, with `font-display: swap`; Geist Mono remains for code. License and source are preserved with the font asset. No logo or brand palette change.

Verification: marketing TypeScript passed; 10/10 package tests passed; production build passed; targeted lint for the header/layout/dictionaries returned 0 errors and 0 warnings; `git diff --check` passed. Browser inspection at 490px verified main navigation, Why/Products panels, Back and Escape, actual computed font family, fixed action area and zero horizontal overflow. Other viewport sizes and production font performance were not measured in this pass.

### Typography correction — Inter

Owner rejected the Manrope trial. Replaced it with locally hosted Inter Variable (100–900); the official WOFF2 and SIL Open Font License are retained in `public/fonts`. The unused Manrope trial assets were preserved under `/tmp/letbuyy-marketing-audit/retired-fonts/` rather than left in the served public assets.

Reduced tight heading tracking and the widely spaced uppercase section labels. Primary labels remain neutral and clear; descriptions/secondary controls now blend 82% of the semantic text color with the background, section labels use 72%, and icons mix brand purple with semantic text for better visibility in either theme. Supporting copy uses regular weight. Layout and navigation destinations are preserved.

Verification: TypeScript passed, layout lint passed, `git diff --check` passed, and the actual browser loaded the font successfully. At 490px the computed heading spacing is −0.48px and supporting text resolves to approximately RGB(211,211,212) in the observed dark theme. Screenshot: `menu-inter-refined.png`. This small typography/color adjustment was checked in the running app; the earlier production build result predates this font substitution.


## Website-wide presentation with structure preserved

Owner clarified that existing features, content, section skeleton and order must stay intact. Reverted the recent hero/final-CTA copy rewrites and the added visual frame heading; restored all five trust pills. Removed the new hero grid/order/spacing overrides and the rule that hid commerce metrics. The original desktop columns, mobile illustration-first order, stacked mobile actions, section spacing and decorative elements remain controlled by their existing rules. The eight homepage sections still appear in this order: Hero, Capability Map, Merchant Journey, Features, Pricing, FAQ, Ecosystem, Final CTA. Existing navigation and interaction fixes from the earlier audit remain.

The shared marketing theme now actually inherits locally hosted Inter throughout the public site. Presentation-only refinements apply consistent heading weights, clearer neutral text, calmer purple buttons, readable supporting copy, and coordinated card, input and footer colors. Existing storefront-preview class names were matched to their stylesheet so the illustration renders correctly, with its content and controls retained. Preview labels distinguish sample data from live data.

Verification for this final state:

- Production build: exit 0 (`/tmp/marketing-preserved-ui-build.log`).
- Marketing TypeScript: exit 0; 10/10 package tests passed.
- Targeted JSX/layout ESLint: exit 0, no errors (run from the marketing package).
- Marketing stylesheet Stylelint: exit 0; repository design-system validator: exit 0. Neither baseline was updated.
- Source diff whitespace check: passed.
- Browser: 1440px homepage preserves left copy/right illustration, displays all four existing metrics, and has no horizontal overflow. At 490px and 320px the original illustration-first hero order and all five pills remain, with no horizontal overflow. All eight homepage sections remain in their existing order. Contact at 1440px and 320px retains its initial form controls; Resources and Privacy at 320px inherit Inter and have no horizontal overflow. No forms were submitted.
- Browser viewport override was reset to its original 490×1034; tab left on `http://localhost:9006/in`.

Screenshots: `home-inter-preserved-desktop.png`, `home-inter-preserved-mobile.png`. This supersedes the earlier record's desktop/320px limitation for these specific checks, without claiming exhaustive interaction or assistive-technology coverage.


## Canonical UI consolidation

Owner selected consistent UI/design system. Completed token, type, color and control consolidation while preserving existing content and structure. Detailed implementation, strict guard probes, browser evidence and remaining governance limits: [CANONICAL_UI.md](CANONICAL_UI.md).


## Supporting visual content

Added four custom, coordinated, transparent 3D illustrations using the built-in image generation tool. Six placements enrich existing content: commerce essentials in Pricing, support in FAQ and Contact, launch storefront in Final CTA and Demo, and books/guides in Resources. Every existing section, action and copy block remains in place. One small local correction keeps FAQ trust/metric supporting copy readable beside the new artwork. Asset paths, exact prompts and provenance: [ILLUSTRATIONS.md](ILLUSTRATIONS.md).

Explicit owner invariant: Hero, CommerceNetwork, CapabilityMap, MerchantJourney, Features and EcosystemMap are byte-for-byte unchanged from the start of this pass. SHA-256 comparisons passed and are recorded in `illustrations-protected-components.json`. All existing CSS remains an exact prefix; appended rules style the new illustration classes and FAQ supporting text only.

Verification: final production build exit 0 (`/tmp/marketing-illustrations-final-build.log`); TypeScript exit 0; marketing lint exit 0 (19 pre-existing warnings), stylesheet lint exit 0; 10/10 package tests passed. All four PNGs are 1536×1024 with real alpha transparency. Next Image reserves a 3:2 slot, loads art lazily and serves responsive optimized assets; the observed pricing image request returned HTTP 200, image/webp, 43,356 bytes versus its roughly 2 MB source.

Browser checks: homepage at 490px displays the pricing art above the same plan cards; desktop 1440px FAQ displays the support illustration and its accordion opens correctly; the final CTA retains signup/demo links below the launch artwork; Resources displays the library artwork. All four source illustrations decoded in their live placements. At 320px in light mode, Resources and Contact art fits at 280px with no horizontal overflow; Contact retains six initial controls. Original 490×1034 viewport restored, dark preview left at `/in#pricing`. No form submissions or account/payment/provider actions were performed.

Screenshots: `illustrations-pricing-mobile.png`, `illustrations-faq-desktop.png`, `illustrations-cta-desktop.png`, `illustrations-resources-desktop.png`. Browser navigation to first-time routes sometimes exceeded the browser tool's timeout; fresh state confirmed the requested routes had loaded. This does not certify production performance or exhaustive assistive-technology acceptance.
