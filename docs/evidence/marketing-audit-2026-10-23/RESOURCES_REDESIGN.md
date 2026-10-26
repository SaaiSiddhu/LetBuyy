# Resources library refinement — 24 October 2026

Requested outcome: redesign the running marketing Resources landing page at `/in/resources` so that it feels deliberate, usable, and consistent with the existing LetBuyy marketing identity. Reviewed the referenced `Run market landing page` chat through paginated thread reads, including the owner's guidance about compact responsive layouts, purposeful artwork, consistent typography, and avoiding unnecessary gaps. Some older oversized turns could not be retrieved through the thread API; no unseen decisions are claimed.

Working position: `/Users/saai_mithra/Projects/Start_Up/LetBuyy`, `develop`, source HEAD `118209b4`. The checkout already contained extensive uncommitted marketing, console, merchant, and gateway work. Preserved unrelated changes and the existing search keyboard/article-route fixes. No merge, push, deployment, migration, or external subscription occurred.

## Implemented

- Replaced the centered slogan/search-link hero and repeated content grids with a two-column introduction and working search form, followed by an illustrated lead guide and a short editorial reading list.
- Reused the inspected existing transparent LetBuyy storefront artwork, established typeface, canonical theme tokens, and shared Lucide exports. No new image generation or icon family.
- Added an accessible topic directory for all seven categories plus the changelog, followed by five native expandable learning plans and three article previews.
- Fixed learning-plan ordering: catalogue filtering previously reordered the declared guide sequence. The new resolver follows `articleSlugs` in order, renders all five links, and calculates reading time from those articles.
- Search submits to the reader's localized route with `q`; the search page initializes from that parameter and remounts its search state when the incoming query changes. Suspense preserves the existing static build. Cleaned the dangling “or” in the unfiltered empty state.
- Fixed resource navigation selection by stripping the locale before matching and using full path boundaries.
- Used editorial selection labels instead of unsupported weekly readership/popularity claims. Existing newsletter availability and RSS fallback remain truthful.
- Scoped home-page styling in a CSS module; expanded the marketing CSS lint script to include all source CSS, including the new module. Existing category/article/global styles remain in place.

## Fresh verification

| Check | Result |
| --- | --- |
| Marketing typecheck | Exit 0 |
| Production build | Exit 0; all 494 pages generated |
| Marketing and federation tests | 36 pass, 0 fail, 0 skipped (32 marketing + 4 boundary tests) |
| Added behavioral regression | All five learning paths resolve completely in declared order; First 100 Orders begins with acquisition and reaches conversion work later |
| CSS lint, all marketing source CSS | Exit 0 |
| Focused ESLint | 0 errors; one existing search effect state-reset warning remains |
| Whitespace validation | Exit 0 |

Browser checks used the actual in-app browser and running localhost server. Visually inspected dark and light themes, the desktop intro and featured guide, topic directory, learning-plan list, article previews, and RSS availability panel. Checked 1440×1000 desktop, the default ~891px browser, 768×1024 tablet, 390×844 phone, and 320×780 narrow phone. Measured document width equalling viewport width at 1440, 768, 390, and 320, and confirmed the lead image loaded. Checked keyboard Enter toggling a learning plan with visible focus, pointer expansion collapsing the previously open plan, all five ordered links, typed `inventory` reaching four matching results, no-match recovery, and ArrowDown/Enter opening the inventory article. Confirmed Operations selected on that article. After the final query-state refinement, verified search-with-query → fresh search clears the input and displays discovery content.

A local search navigation returned Internal Server Error after the final production build. Restarted only the confirmed marketing process on port 9006, then repeated Resources → query search → fresh search successfully. The exact server-error cause was not isolated. The development server was left running on port 9006. Temporary viewport overrides were reset and the original dark theme restored.

Screenshots in `resources/`: `desktop-dark.jpg` (final page), `desktop-light.jpg`, `mobile-dark.jpg`, `mobile-reading-plan.jpg`. Earlier light/mobile captures precede the final small reading-list heading wrap refinement; composition and responsive rules are otherwise the same.

Limits: this is local browser verification and a build, not production deployment, physical-device acceptance, a full assistive-technology audit, or an audit of the existing article content/business claims. No backend or email-delivery capability was added. Category/article templates were exercised for navigation, not redesigned in this change.

## Spacing correction — 25 October 2026

Owner screenshots identified the large unused left column alongside the learning-path accordion and the disconnected search placement. Replaced the side-by-side learning-section layout with a compact two-column introduction above a full-width accordion. On desktop, each summary now places its metadata on the same row as its title; phone layouts retain stacked metadata. Reduced summary and section padding while preserving every guide and native accordion behavior.

Aligned the hero/search grid tracks with the featured-guide/reading-list tracks below. Search is vertically centered, the label, exploration links, and library count use a consistent gap, and the placeholder now fits smaller fields. The search control uses explicit icon/input/button grid tracks and a 44px submit target. Live measurements at desktop and phone widths show exactly 7px top/bottom/right button insets. At 1440px, the search field and reading-list heading both start at x=923.71875px. Document width equals viewport width at 1440px and 390px.

Verified the live page at 1440×1000 and 390×844; visually checked the complete full-width desktop learning section and phone introduction/accordion. Source CSS lint, focused page ESLint, TypeScript and whitespace checks pass. No new behavior tests or full build were needed for this scoped spacing/placeholder adjustment. Screenshots: `resources/spacing-2026-10-25/{learning-plans-desktop,search-desktop,search-mobile}.jpg`. Temporary viewport override reset after inspection. Other page content and unrelated work preserved.

## Single search and composite focus — 25 October 2026, 10:13 request

Removed the duplicate Search link/icon from ResourcesNav beside Commerce updates across the resource routes. The existing lower search field remains. Added a narrowly scoped focus-visible override for the results-page input and the home-library input: the surrounding composite control supplies the focus treatment, so the site-wide focus rule no longer draws an additional rectangular input outline inside it. The outer focus boundary and keyboard shortcut remain available.

Verified in the live search tab using click and Tab/Shift-Tab focus: one search input, zero navigation search links; computed input outline and shadow are both none while the outer border remains purple with its focus halo. CSS lint, focused ResourcesNav ESLint and whitespace checks pass. No behavior changes or additional tests were needed. Screenshot: `resources/spacing-2026-10-25/single-search-focus.jpg`.

## Search behavior audit and fixes — 25 October 2026

Bounded audit: the Resources search page, its catalogue matcher, filters, results, URL state, keyboard behavior, and responsive presentation. Existing unrelated checkout work remains preserved.

Confirmed defects and corrections:

- Category and time filters previously operated on an empty result set until a query was typed. The catalogue now browses all 35 guides by default, with matching category-only and time-only filtering.
- Suggested “upi payments”, “COD strategy”, and “shopify alternative” returned zero exact-phrase matches. Centralized matching now checks every query word across title, subtitle, description, category, and tags, independent of word order and repeated whitespace. Suggestions shown by this page are tested against the real catalogue; removed unsupported “trending/popular” usage labels. Existing catalogue/utility search entry points now delegate to the same matcher.
- Whitespace-only input now behaves as an empty query rather than a fabricated no-match failure.
- Reading ranges previously overlapped at 5/10 minutes. Replaced with explicit disjoint integer-minute ranges: up to 5, 6–10, over 10.
- Result markup named CSS classes that did not exist, so result rows, descriptions, and selection styling were absent. Reused the actual result-card styles. Results are native links in a semantic list, with normal focus outlines and ArrowDown from the input; arrows/Home/End navigate result links, Escape returns to the input, and Enter follows the focused link. Removed the invalid combobox/listbox treatment and synchronous reset effect.
- Query/filter/page state now lives in URL search parameters using Next's supported native history integration. Reload/return preserves criteria without adding every keystroke to Back history. The result list paginates ten guides per page, with page clamping and reset on changed criteria.
- Added announced result counts, aria-pressed filter states, functional Clear filters recovery, responsive input sizing, one explicit clear control, and contrast-safe selected filter tokens. Removed initial autofocus so arriving on a phone does not force the soft keyboard open. The single outer search focus treatment and removal of the top search shortcut are retained.

Fresh validation: TypeScript, focused ESLint (zero warnings/errors), all-source CSS lint, whitespace checks, and production build pass. Build generated 494 pages. Current marketing tests: 50 pass; federation boundary tests: 4 pass; no failures/skips. Eight added behavior tests cover actual suggestion results, multiword matching, category-only/combined filtering, whitespace, time-range boundaries, safe URL parsing, complete pagination, and empty-page behavior. Other marketing tests had been added elsewhere in the shared checkout; the 54 count reflects the present run, not solely this change.

Live browser verification: Payments-only returned five matching guides; `UPI payments` plus Payments returned two and survived reload; ArrowDown focused a real guide link with a visible outline and Enter committed the UPI/COD article route; browser Back restored the query and Payments filter. Up-to-5-min produced an honest empty state, and its Clear filters recovered matching guides while preserving the query. Clear search restored all 35 guides, Next rendered guides 11–20, and changing to `GST invoices` reset page state and returned the single invoice guide. The global search shortcut focused the input. Navigation observations captured before a pending route committed were excluded; final article/Back checks waited for the intended route/content.

Responsive inspection measured CSS viewport/document widths equal at 355px and 433px phone sizes and 1422px desktop width (the user's browser zoom makes these differ from requested viewport dimensions). Confirmed one search field, no top search shortcut, no inner input outline, and one explicit Clear search button. Screenshots: `resources/search-audit-2026-10-25/mobile-results.jpg` and `desktop-library.jpg`. Restored normal browser viewport and left search open.

Stopped only the confirmed marketing listener for the build and restarted development on port 9006 afterward; search and catalogue rechecked on the fresh server. No deployment or backend change. This does not certify all resource article content, other templates, physical devices, or a full assistive-technology audit.

## Desktop article scroll reversal — 25 October 2026, 11:26 request

Reproduced on `/in/resources/platform/introduction-to-apps` at a 1440px desktop viewport. After a downward scroll, the document moved from y=626.5 to y=209 without a new user scroll. The active TableOfContents effect called `link.scrollIntoView({behavior:'smooth'})`; that API scrolls ancestors, including the page. The TOC itself was also constrained by a short non-stretched grid parent and scrolled away instead of remaining sticky.

Replaced that call with bounded adjustment of the TOC rail's own scrollTop. Hidden/zero-height rails are ignored, visible entries leave the rail unchanged, and movement is clamped to the rail's content. Stretched both article-side columns within the article grid so the contents and supporting sidebar can remain sticky for the article's height. Removed aria-hidden from the interactive desktop contents wrapper. The narrow IntersectionObserver activation band could also leave the wrong section active when scrolling upward or jumping quickly; a passive, animation-frame-throttled position check now computes the last heading above the reading line in either direction. No observation callback changes document scroll position.

Browser evidence on final code after server recovery: document y=1000 after the first downward scroll, y=1500 after another, y=900 after scrolling up, then still y=900 on a subsequent check without input. TOC top remained 88px, and the current section changed back to App Categories on the upward pass. The initial fix was independently observed holding y=1000 across separated checks, replacing the original reversal. Screenshot: `resources/scroll-fix-2026-10-25/desktop-scroll.jpg`.

Added six behavioral geometry/selection regression tests covering visible entries, clipped entries, hidden/non-overflowing rails, bounds, reverse scrolling and skipped-heading jumps. Fresh final typecheck, focused TOC/helper ESLint, CSS lint, whitespace validation and production build pass (494 pages). Marketing tests: 56 pass; federation boundary tests: 4 pass; zero failures/skips. A broader initial lint invocation also reported the pre-existing unused getDifficultyLabel warning in the article page; the touched scrolling components/helper have zero warnings.

Verification encountered missing per-workspace node_modules links during a reload. The first package-manager attempt proposed reinstalling the modules tree and did not proceed. Relinked the marketing dependency closure offline, with scripts disabled, frozen lockfile and the exact original store path from node_modules/.modules.yaml; no dependency versions were selected anew. Typecheck/lint failures from that missing-link interval were superseded by the fresh successful run after relinking. Built while the confirmed marketing listener was stopped, restarted it on port 9006, and rechecked the final article. Unrelated source/lockfile changes were preserved. Browser viewport override reset after inspection. No deployment.
