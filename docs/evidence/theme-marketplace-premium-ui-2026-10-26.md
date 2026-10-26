# Marketplace editorial UI refinement — 26 October 2026

Owner request: the marketplace and its linked destinations still look basic. Improve alignment, typography and illustrations across the marketplace, including the pages reached from resource links. Continue in English. Frontend only; backend remains owned by the owner's friend. Header and marketing landing page remain unchanged. Existing isolated worktree/branch `codex/theme-marketplace-20261026`, base `78477cdab`.

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

## Design and implemented surfaces

Preserve LetBuyy's local Inter and canonical body/display font stacks, semantic purple palette, light/dark provider, shared Page/Card/PageHeader primitives and existing navigation. Add a coordinated editorial illustration family, quieter card boundaries, consistent gutters, refined semibold headings, readable paragraph measures and more specific actions. No new fonts, dependencies, backend architecture, DTOs or runtime configuration.

| Surface | Task and composition | Existing authority retained |
|---|---|---|
| Homepage journey and resource cards | Illustrated steps and concise illustrated navigation cards; named destinations instead of generic Read more | Existing guide, collection, pricing and library routes |
| Collections, guides, support, FAQ, pricing, contact, about, creator guidance | Shared illustrated masthead; consistent resource-card artwork, spacing and type hierarchy | Existing page content, query search and public read contracts |
| Guide articles | Topic-specific illustrated header, contents panel, bounded reading measure, section separators and real next steps | All seven articles, anchor targets and next/related links |
| Legal directory and ten documents | Restrained document/privacy illustration; readable document layout and contents | Existing review status, legal copy, version and non-effective-terms warning |
| Catalog, category, collection, author, comparison and theme detail | Shared illustrated header around canonical PageHeader; preserve actions, facts and actual previews | Existing read calls, filters, review/author/entitlement facts and package availability |
| Anonymous preview | Small editorial illustration above the real preview area | Existing origin/version validation, unavailable state and iframe controls |
| Account pages, install and checkout | Compact task-title illustration; leave forms, records and state logic intact | Existing auth, purchase, download, installation and settings contracts |

Narrow resource cards pair artwork with text where space permits; very narrow screens stack them. Wider screens use two/three-column grids. Article headers pair text and art on wider screens and stack on mobile. Illustrations have no interactive semantics and no hidden fake controls; meaningful headings, descriptions and destination names stay in HTML. No decorative motion was added. Print styles suppress artwork. Corrected nested content-page padding and catalog gutters; anchor targets leave room below the fixed header.

## Illustration assets

Six new images created with built-in `image_gen`, not CLI fallback: discover, create, learn, support, legal, library. Art direction: tactile paper/matte ceramic, lavender glass, purple/periwinkle/ivory/ink, isolated transparent foreground, no logos/text or success/certification badges. Each original was inspected. Assets were resized/compressed with the existing sharp dependency, without cropping or content edits, to 960×720 WebP (62–96KB each, about485KB total). All six have real alpha with extrema0/255.

Saved in `apps/frozen/theme-store/public/illustrations/`; `provenance.json` records generator, source generation names, art direction, subject prompt set, dimensions, bytes, alpha and optimization. Original generation files remain in the tool's default generated-images directory. Artwork is editorial illustration, never a real listing preview, merchant evidence, verified privacy guarantee or account outcome. Replaced the previous CSS-drawn journey illustrations with this family.

## Verification and limits

Package regression suite63 passed: source contracts24 and UI/API/session/render39. Added checks for descriptive action labels, preserved destinations, artwork selection, single-title header compositions and article body preservation. Updated the install identity test's presentation-only import stub while retaining every redirect/store-read assertion. Initial new image assertions expected raw paths; corrected them to decode Next's optimized image URL encoding. App typecheck/build pass. App lint has zero errors/seven existing warnings. Both touched CSS files pass stylelint; design-system hard invariants/ratchet and diff whitespace checks pass.

Read-only HTTP audit: 42 public route instances return200 with page titles and artwork, including all seven guide articles, ten legal documents, five categories, actual Core listing/preview, and representative empty author/collection templates. All guide/legal anchor targets resolve in markup and legal review warnings remain. Nine protected routes preserve canonical sign-in redirects; authenticated UI was not bypassed. Six static and six optimized illustration responses return200. Total63 route/image checks. The audit distinguishes Next's streamed loading title from final page markup; this is not a browser DOM/visual certification. Full results: `/private/tmp/letbuyy-premium-http-checks.json`; route list: `/private/tmp/letbuyy-premium-routes.json`.

AST comparison verifies91 existing non-render functions across affected page files are unchanged, including server actions and payment helpers. Diff boundary checks confirm no changes to services, database, shared packages, API routes/client/service/proxy/config, marketing source or navbar; the full header CSS block is identical to base.

Browser/mobile/keyboard/zoom/in-context light/dark visual acceptance remains deferred under the owner's standing automated-only preference while browser use is disabled. Protected account content needs a real authorized session for integrated visual review. No claim of production speed, perfect viewport fit, legal approval, live backend readiness or full accessibility certification. No merge, push, deployment, external message or purchase occurred.

Build/test/lint/type/design logs: `/private/tmp/letbuyy-premium-{build,tests,lint,typecheck,design}.log`. Post-commit quick gate output: `/private/tmp/letbuyy-premium-close-20261026/`. Local preview: http://localhost:9005/.
