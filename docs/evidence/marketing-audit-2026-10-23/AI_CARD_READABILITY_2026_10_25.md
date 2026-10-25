# AI Commerce card readability and artwork — 25 October 2026

Request: fix card text obscured by illustrations and replace the repeated low-resolution gold AI scene with more premium artwork.

## Change

The AI category uses a dedicated card composition in the existing category page. Each link contains two sibling sections: a clipped, fixed-height media area and a separate opaque copy area. The media uses non-shrinking flex sizing, contained images and explicit image minimum/maximum bounds. The text panel uses canonical theme surface, primary text, supporting text and link tokens. It has no image or gradient behind the copy. Titles, subtitles, article destinations and source reading times remain.

The other category thumbnail boxes also gain overflow and intrinsic-image bounds. The old showcase CSS is no longer used by the AI cards; no global theme or typography authority was changed.

Five new 1536 × 1024 transparent illustrations replace the repeated gold cube: catalog insight through an optical lens, operations task/parcel coordination, a context-aware copilot conversation, complementary product recommendations, and an event/decision/action workflow. Full WebPs range from 86–196 KB; 480px thumbnails range from 13–29 KB. Each AI guide and its corresponding section illustration use the assigned new subject through the existing artwork registry. Original source images remain available.

## Verification

- Marketing TypeScript, CSS lint, targeted ESLint and production build: passed.
- Tests: 62 marketing + four federation boundary tests passed, including distinct high-resolution artwork for all five AI guides.
- Design-system and single-token-source validators: passed.
- New assets: all five decode and contain alpha; generated with the built-in image tool using actual transparency. Prompt/source/output provenance is in `AI_PREMIUM_ARTWORK_2026_10_25.json`.
- Explicit text/surface pairs from canonical tokens pass the skill's WCAG sRGB check: light primary 17.74:1, supporting text 4.83:1, links 7.10:1; dark primary 19.51:1, supporting text 13.14:1, links 10.57:1. These are source-pair measurements, not rendered-page certification.
- Production HTML: all three locale category pages contain five distinct new illustrations, with separate direct media and copy siblings for every card. All referenced artwork decodes. This verifies generated structure, not computed browser geometry.
- Live responsive, image-loading and visual checks are pending. CUA returned “Local browser use is disabled in Work settings.” No alternative browser automation or fabricated screenshot was substituted.
- Local marketing dev server restarted after the build and reports ready on port 9006.

Logs: `/tmp/letbuyy-ai-cards-build.log`, `/tmp/letbuyy-ai-cards-tests.log`, `/tmp/letbuyy-ai-cards-eslint.log`, `/tmp/letbuyy-ai-cards-contrast.json`, `/tmp/letbuyy-ai-cards-alpha.json`, `/tmp/letbuyy-ai-cards-html-audit.json`.

Source: `src/app/[locale]/resources/[category]/page.tsx`, its `category-illustrated.module.css`, `src/lib/resources/artwork.ts`, `src/lib/resources/section-visuals.ts`, and `tests/marketing/reading-visuals.test.ts`. No article prose, backend contracts, dependencies or runtime topology changed. Unrelated worktree changes remain intact.
