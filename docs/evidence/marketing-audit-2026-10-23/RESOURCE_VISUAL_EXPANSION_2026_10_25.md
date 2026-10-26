# Resource visual expansion — 25 October 2026

Request: add proper illustrations to the reading-plan section shown in the screenshot and more visuals throughout articles and resource subpages.

## Implemented

- Resource home: a new learning-journey illustration, subject artwork on all five reading-plan summaries, thumbnails on all 25 guide links, and artwork on the latest-guide cards. Native details/summary behavior, reading order, guide counts and calculated reading times remain.
- Standard reading pages: two supporting illustrations distributed at selected existing section headings in each of 33 guides, for 66 in-body placements. The content renderer retains its original single-pass paragraph treatment and all original blocks and anchors. The Theme and Liquid guides retain their existing bespoke diagrams and illustrations.
- New transparent scenes: a reading journey, customer follow-up and returns/customer care. The retention and returns guide covers now use the more specific scenes.
- Shared article cards: all three card variants have illustrations, extending coverage to tag and author article listings.
- Search: subject artwork on result links and an illustrated search header; existing query, filter, pagination and keyboard behavior is retained in source.
- Tag, author and platform-release subpages: editorial header illustrations. Release entries also have subject artwork tied to the existing release registry. No invented author portraits, release notes or product states.
- Small-image delivery: 17 local WebP thumbnails, at most 480px, are used on list/card/category entries. Across that set, encoded bytes decrease from 2,910,684 to 525,622 (about 82%). Large reading illustrations keep their full-size sources. All derivatives preserve alpha and source aspect ratio.

## Verification

- Marketing TypeScript, CSS lint and production build passed.
- 61 marketing tests plus four federation boundary tests passed. Coverage checks include all published illustration files and thumbnails, every reading plan's artwork, unique existing article-section targets, and two valid section scenes per standard guide.
- Targeted ESLint: no errors. Three pre-existing warnings remain for unused `getAuthor`/`formatDate` imports in the author route and the unused `major` local in the releases route.
- Design-system and single-token-source validators passed; marketing CSS is also checked directly with stylelint.
- Read-only inspection of production build output checked 420 resource HTML pages across the three locale routes. All 105 article pages retain every original body string and title. Each standard guide renders exactly two in-body figures (198 placements across three locales). Each home renders five reading plans and 31 images within the reading-plan section: one overview, five plan illustrations and 25 guide thumbnails.
- All 39 directly referenced editorial artwork files in that output exist and decode with Pillow. The three new full-size images pass the UI skill's transparent-alpha metadata audit. File and alpha checks do not certify visual composition or browser loading.
- Live browser, touch, keyboard and responsive visual checks remain pending. CUA returned “Local browser use is disabled in Work settings.” No other browser automation was used to bypass that setting, and no live screenshot claim is made.
- The localhost marketing server was restarted after the build and reports ready on port 9006.

No article source text, release data, backend contracts, dependencies or runtime topology were changed by this expansion. Existing unrelated worktree changes were preserved. Full repository governance was not rerun; previously recorded unrelated gate failures remain outside this change.

## References

- `RESOURCE_VISUAL_EXPANSION_ASSETS_2026_10_25.json`: generation prompts, source images and workspace outputs.
- `src/lib/resources/section-visuals.ts`: explicit section-scene assignments.
- `src/components/resources/ArticleSectionVisual.tsx`: supporting article figure.
- `src/components/resources/ArticleCard.tsx` and `resource-list-visuals.module.css`: shared list/subpage coverage.
- `src/lib/resources/artwork.ts`: shared art, learning-plan and thumbnail registry.
- `/tmp/letbuyy-resource-expansion-build.log`, `/tmp/letbuyy-resource-expansion-tests.log`, `/tmp/letbuyy-resource-expansion-eslint.log`.
- `/tmp/letbuyy-resource-expansion-render-audit.json`, `/tmp/letbuyy-resource-thumbnail-audit.json`, `/tmp/letbuyy-resource-expansion-alpha.json`.
