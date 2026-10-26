# Marketing website audit — 23 October 2026

Scope: existing local marketing app at http://localhost:9006, working checkout `develop` at `118209b4` with pre-existing changes elsewhere. Audit only; no application source changes. Priorities: P1 blocks a core journey or reports a false successful outcome; P2 breaks navigation, accessibility or content accuracy; P3 minor presentation/configuration defect. Environment failures are distinguished from code defects.

## Executed coverage

- Recursively checked all discovered same-origin links from the English/Hindi/Tamil homepages: **502 unique URLs**, final responses: **495 HTTP 200**, **3 HTTP 404**, **1 HTTP 502**, **3 signup redirects ending in connection refused**. Dynamic search-result destinations were checked separately in the browser. Source inventory includes every route family: home, pricing, create/signup, demo/contact, resources/search/categories/articles/tags/authors/changelog/releases, legal, sitemap/robots/feeds.
- Browser inspection at **490px viewport**: homepage, mobile menu open/Escape, secondary-page pricing navigation, resources, newsletter inline/modal, contact required-field validation, demo initial form, Hindi homepage, resource search keyboard/click behavior. Screenshots and DOM/accessibility observations corroborate the findings below.
- `pnpm --filter @letbuyy/marketing-site typecheck`: exit 0.
- `pnpm --filter @letbuyy/marketing-site lint`: exit 0, **0 errors / 326 warnings**, including raw colors, token bypasses and unused code. Warnings are not 326 proven user-facing bugs.
- Original dev process began returning HTTP 500 across route families. Preserved its generated `.next/dev` directory under `/tmp/letbuyy-marketing-audit/preserved-next-dev`, restarted only this chat's marketing server, and repeated the crawl. No source edits or unrelated process termination. The homepage is left open and server running.

## Confirmed findings

| ID | Priority / evidence | Defect, reproduction, consequence | Source / correction acceptance |
| --- | --- | --- | --- |
| M01 | P1, browser + source | Resources → Search → type `gst` → click the first result → `/in/resources/how-to-start-an-online-store-india` returns 404. The category segment is omitted from every result href. | `src/app/[locale]/resources/search/page.tsx:183`. Include category; every search result must open its actual article in the current locale. Screenshot: `search-result-404.png`. |
| M02 | P1, browser + source | Resources → newsletter → enter synthetic `audit@example.invalid` → Subscribe displays “Subscribed — first digest lands Tuesday.” No request or persistence exists: only React state changes. Modal, sidebar and post-article implementations also contain local-state-only success handlers. | `src/components/resources/NewsletterInline.tsx:38`, `NewsletterModal.tsx:131`, `NewsletterCTA.tsx:10`, `PostArticleNewsletter.tsx:10`, `ArticleSidebar.tsx:24`. Connect one real subscription contract; announce success only after durable acceptance, retain input on failure. |
| M03 | P2, browser + source | Demo (also contact/resources/legal) → mobile menu → Pricing closes menu and stays at `/in/demo#pricing`; that section does not exist. Header uses fragment-only destinations across secondary pages. | `src/components/Header.tsx:89` and mega-menu links. Use locale-aware pricing page or homepage fragment. Test from all route families. |
| M04 | P2, browser + source | Search advertises “Use ↑↓ to navigate, Enter to open.” Arrow keys select a result, but Enter has no handler and does not open it. | `src/app/[locale]/resources/search/page.tsx:46`. Implement Enter navigation and combobox active-descendant semantics; verify keyboard-only use. |
| M05 | P2, browser + source | Homepage “Watch 3-Min Demo” links to `#capabilities`, not a video or demo journey. | `src/components/Hero.tsx:42`. Supply the promised demo or label this as exploring capabilities. |
| M06 | P2, HTTP + source | Public sitemap → `/robots.txt` resolves to `/in/robots.txt` and returns 404; repeats for Hindi/Tamil. `LocaleLink` prefixes a locale onto this root metadata asset. Actual `/robots.txt` works. | `src/app/[locale]/sitemap/page.tsx:172`, `components/i18n/LocaleLink.tsx`. Exempt root machine-readable files or use a plain anchor; verify all locales. |
| M07 | P2, browser + source | `/in-hi` sets document language to Hindi and translates navigation, but hero, capabilities, pricing and most homepage copy remain English. Hero and other primary components use hardcoded English rather than dictionaries. | `src/components/Hero.tsx:33` and other homepage sections. Translate the body or explicitly disclose English fallback; preserve reader locale in same-site links. Tamil also needs the same component audit. |
| M08 | P2, source-confirmed | Privacy choices write localStorage but never read it: returning visitors see both options reset to false even after saving. No consumer of `letbuyy_privacy_choices` was found in marketing source. This does not prove that unauthorized tracking is occurring. | `src/components/Footer.tsx:100–115`. Restore saved choices and connect optional processing to that preference contract. |
| M09 | P2, source-confirmed accessibility gap | Newsletter dialog sets initial focus and supports Escape but does not trap focus or restore the opener. Privacy dialog has no corresponding focus management or Escape handler. Background links remain keyboard reachable. | `src/components/resources/NewsletterModal.tsx:54`, `src/components/Footer.tsx:266`. Use the shared accessible dialog and verify Tab/Shift+Tab/Escape/focus return. Browser focus-cycle acceptance remains outstanding. |
| M10 | P2, source-confirmed lifecycle defect | Homepage schedules a self-perpetuating requestAnimationFrame loop. Cleanup destroys Lenis but never cancels the frame. Navigating away leaves callbacks running; remounts add loops. | `src/app/[locale]/page.tsx:29–39`. Retain frame ID and cancel on unmount; respect reduced-motion preference. Runtime CPU impact was not measured. |
| M11 | P2, browser + source content defect | Ecosystem labels every destination “Live”, including Apps/Developers; local destinations 9003/9004 are not running. Their app roots are frozen in repository governance. Live badges are unconditional, not based on availability or release status. | `src/components/EcosystemMap.tsx:156`, `lib/platform-links.ts`. Reflect approved release states and avoid advertising frozen surfaces as live. Do not activate frozen services to fix marketing copy. |
| M12 | P2, browser + source content defect | Architecture section publicly claims a “shared event bus”; repository ARCH-R8 explicitly specifies transactional outbox and prohibits event-bus architecture. Illustrative dashboards and events display “Live” despite hardcoded fixtures. | `src/components/Features.tsx:785` and fixture panels. Correct architecture copy and label simulated previews clearly. |
| M13 | P3, browser + local configuration | Broken privacy icon asset uses placeholder `https://cdn.example.com/assets/legal/privacy-choices.svg`; observed natural image width is zero. | `src/components/Footer.tsx:93`, `lib/public-urls.ts` and local public asset configuration. Point to a real available asset; verify loaded image after reload. Local configuration evidence, not a verified production failure. |

## Local runtime and integration blockers

| ID | Evidence | Impact and next verification |
| --- | --- | --- |
| E01 | `/api/founding-pricing` consistently returns HTTP 502; homepage shows pricing unavailable. Gateway on port 9010 is not running. | Pricing and comparisons cannot be used in this local session. Start/configure the canonical backend and retest before diagnosing plan rendering; do not replace real pricing with invented values. |
| E02 | Signup redirects for all three locales fail with connection refused to identity port 9002. | Primary conversion/login journeys cannot complete locally. Identity app must run before end-to-end account acceptance. This is not evidence that hosted signup fails. |
| E03 | Initial `.next/dev/prerender-manifest.json` fails JSON parsing at character 1571 (“Extra data”). Many routes returned HTTP 500. Restart with preserved generated cache recovered them; demo also passed isolated retry after one transient 500. | Record as a local generated-state/runtime incident, not one source bug per failed page. Cause of corrupt manifest remains unproven; no duplicate marketing process was found at inspection time. |
| E04 | Contact page displays `support@letbuyy.local`, and asset base points at an example CDN. | Current environment is a local template configuration; mail/delivery and external URL correctness cannot be certified as production-ready. |

## Additional content and acceptance gaps

- Newsletter claims “35,000+ merchants/subscribers” are hardcoded, with no backing metric in these components. Treat as unverified marketing claims requiring owner evidence, not a confirmed real subscriber count.
- API pricing proxy returns caught error messages directly (`src/app/api/founding-pricing/route.ts:35`); sanitize known errors per CODE-R3. Potential information exposure depends on upstream exceptions; no secret leak was established.
- Browser tested only the currently available 490px viewport; broad desktop/tablet layout, 320/375px reflow, measured contrast, screen reader, reduced-motion and production performance acceptance remain outstanding.
- Contact empty-input validation worked and focused the name field. Mobile menu Escape worked. Search text matching returned relevant results. Most static page routes passed after runtime recovery.
- No real contact/demo requests, email deliveries, account creations, payments or production writes were made. Contact/demo final submission, Turnstile, ticket lookup, idempotency, delivery and recovery require an owned backend test lane; source review and initial form rendering do not certify them.
- Static crawl does not execute all client-side controls. Search generated the additional broken destination outside the static crawl. Do not interpret HTTP 200 totals as full functional acceptance.

## Suggested repair order

1. Fix search destinations and keyboard activation, dead pricing navigation and false newsletter success.
2. Restore local identity/backend dependencies and prove pricing/contact/demo/signup journeys using synthetic records in an owned test lane.
3. Fix privacy behavior/dialog accessibility, lifecycle cleanup, localization and sitemap asset routing.
4. Correct availability/demo/architecture claims, asset configuration and substantiated marketing copy; complete responsive and assistive verification.
