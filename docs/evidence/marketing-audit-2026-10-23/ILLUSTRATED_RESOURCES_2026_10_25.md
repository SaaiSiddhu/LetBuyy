# Illustrated resources and changelog — 25 October 2026

## Delivered

- All 35 reading guides have an explicit editorial illustration assignment. Suitable existing assets are reused; six new transparent subjects cover payment choice, invoices, customer relationships, fulfillment, developer connections and search/discovery.
- 33 standard articles have an illustrated visual overview with two or three topics. Each topic uses a heading and excerpt from that article, and links to the real section. The existing Theme and Liquid guide illustrations and bespoke compositions remain in place.
- Topic tabs support Left/Right, Home/End and roving focus. Inactive panels are inert and hidden from accessibility APIs. Panels occupy the same grid cell so their shared height does not change while switching. Section jumps account for the measured Resources navigation height and honor reduced motion. These interactions are implemented; live keyboard and layout verification is pending.
- The resource library's three reading-list entries have illustrations matched to their payment, acquisition and inventory subjects.
- All seven category pages have an illustrated header. Each guide entry has matching artwork; Ecommerce retains the original guide order, descriptions and reading times. Existing category-specific layouts remain.
- Changelog redesign adds an illustrated journal header, source-derived release summary, release timeline, subject artwork and filters for the existing release tags. All nine releases and their notes remain intact. Filter counts use the release collection; the visible-result count is announced with a status region.

Artwork is editorial concept art, not a screenshot or evidence of a live product capability. New assets are local WebP files with real alpha. Functional icons use the existing `@letbuyy/ui` Lucide exports. No application dependencies, data contracts, backend services or release content changed.

## Evidence

| Check | Result |
| --- | --- |
| Marketing production build | Passed; `/tmp/letbuyy-illustrated-resources-build.log` |
| Marketing TypeScript | Passed |
| Marketing CSS lint | Passed |
| Targeted ESLint | No errors; one pre-existing unused `getDifficultyLabel` warning in the article route |
| Marketing and federation tests | 60 marketing + 4 boundary tests passed; `/tmp/letbuyy-illustrated-resources-tests.log` |
| Published artwork coverage | All 35 guides and nine releases resolve nonempty local assets |
| Topic targets | All selected topic headings resolve uniquely to existing article sections |
| Built article output | All 105 localized article pages retain every source body string and their title; no missing artwork files |
| Built changelog output | All three localized pages retain every release title and note |
| Image decoding | 18 referenced reading artwork files verified with Pillow |
| New asset alpha | All seven new WebPs pass the skill's transparent-asset metadata audit |
| Design-system/token-source validators | Passed; CSS lint separately covers marketing |
| Browser, touch, keyboard and responsive visual checks | Pending: CUA returned “Local browser use is disabled in Work settings.” No alternative browser automation or screenshot claim was substituted. |

The local development server was restarted after building and reports ready on port 9006. Generated build files are validation output, not source authority. Full repository governance was not rerun for this UI change; previously recorded unrelated gate failures remain outside this scope.

## Source and assets

- `src/lib/resources/artwork.ts`: explicit guide-to-artwork registry and meaningful alternatives.
- `src/lib/resources/reading-visuals.ts`: article-specific topic selections and excerpts derived from original content.
- `src/components/resources/ArticleVisualOverview.tsx`: illustrated guide exploration.
- `src/components/resources/ChangelogReleases.tsx`: release filters and timeline.
- `src/lib/resources/changelog-presentation.ts`: release artwork registry.
- `src/app/[locale]/resources/[category]/category-illustrated.module.css`: category presentation extension.
- `READING_ARTWORK_MANIFEST_2026_10_25.json` and `CHANGELOG_ARTWORK_MANIFEST_2026_10_25.json`: built-in image-generation prompts, original outputs and project asset locations.

Read-only output audits are saved at `/tmp/letbuyy-reading-rendered-audit.json` and `/tmp/letbuyy-reading-asset-audit.json`. Live browser screenshots are not available for this change.
