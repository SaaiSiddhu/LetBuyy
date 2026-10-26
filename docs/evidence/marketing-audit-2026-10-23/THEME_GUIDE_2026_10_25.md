# Theme guide redesign — 25 October 2026

Owner request: redesign the complete theme guide, add premium illustrations, and preserve its content. Implemented on `develop`, base HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`, in the existing dirty checkout without reverting unrelated work.

The `platform/how-themes-work` article now has a dedicated, scoped CSS module and illustrated composition: storefront hero, three theme-type studies, editor illustration, modular section drawings, and publishing sequence. Existing illustration assets are reused; the storefront studies and editor are decorative HTML/CSS, not live product controls. All text continues to come from the existing article data. Author metadata, tags, actions, TOC, completion, related articles and newsletter remain. Other articles retain their existing layout. `ArticleBody` gains an optional ID to keep the composed document's IDs unique; its default is unchanged.

Verification:

- Final marketing production build: exit 0 (`/tmp/letbuyy-theme-guide-final-build.log`).
- Marketing typecheck and CSS stylelint: exit 0. Targeted ESLint: exit 0, one existing unused `getDifficultyLabel` warning in the article route.
- Existing marketing/federation tests: 4 federation + 56 marketing tests passed, no failures (`/tmp/letbuyy-theme-guide-tests.log`).
- Browser compared all 18 original paragraphs, headings, list items and callout strings against the redesigned article: none missing. Four original heading IDs retained. One main landmark and no duplicate IDs.
- Browser widths 320, 390, 768 and 1280: no horizontal overflow. Phone editor screenshot shows uncropped artwork and retained copy. Completed image loads had no failures at the inspected editor view.
- Desktop TOC navigation reaches `#the-theme-editor` with heading at approximately 160px, below navigation. Bookmark added and removed, restoring its original unsaved state. Navigated to the first-store article and back: custom guide layout absent on the other article and restored on return.
- Final local reload after production build: guide renders, article present, no horizontal overflow.
- Required repository governance: 110 pass, 4 fail, 1 not applicable. Same failures as earlier this session: route-ownership, legacy-site-type, sequential-migration, foundation-sql-policy-residue. No relevant topology, API, schema, money or identity changes were made.

Local recovery: dependency links disappeared during verification. Offline restore could not find one cached tarball; restored the frozen lockfile dependencies from npm with lifecycle scripts disabled, then restarted only the marketing dev server on its existing port 9006. No dependency versions or manifests were intentionally changed. Server output: `/tmp/letbuyy-theme-guide-dev.log`. The preview is running; nothing was pushed or deployed.

Screenshots: `theme-guide-desktop.jpg`, `theme-guide-mobile.jpg`, `theme-guide-editor-desktop.jpg`, `theme-guide-editor-mobile.jpg` in this directory. Browser verification tab was closed and temporary viewport overrides were reset. Remaining release limitation: repository-wide governance failures outside this presentation change.
