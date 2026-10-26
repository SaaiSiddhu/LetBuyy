# Store-only marketplace presentation and hero refinement — 2026-10-26

Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO

OWNER_DECISION: only the store builder is developed. Remove Portfolio, Resume/Profile, Landing and SaaS promotion from the marketplace website. Additional owner steering moves hero copy closer to the left corner and reduces the dominant white fade obscuring the animation. Work remains frontend only in the isolated marketplace branch; the primary checkout and backend are untouched.

## Implementation

Remove unavailable category choices from header/mobile navigation, homepage category links, catalog options and both listing-builder select UIs. Keep All themes/Store choices and existing sorting, search, pricing and feature fields. Homepage/catalog/sitemap read calls now use the existing store-category filter; no API/service/schema/DTO changes. Unsupported category query values normalize to the existing default and the catalog requests store themes. Published pagination/counts remain sourced from that filtered API response.

Remove unsupported public category copy and narrow the category-page guard to store before listing fetch. Existing category route composes the normal not-found state for other values. Restrict static sitemap category entries to store. Update collections, home resources, guide/FAQ/about/docs/creator copy and root metadata/structured description to describe the store builder. Generic canonical theme types, record compatibility/fallback maps and backend mutation unions remain unchanged; they are not public feature announcements. Listing forms offer store only without changing their mutation handlers. Collection data and other backend-owned records are not rewritten.

For the hero, remove the centered maximum-width container constraint only inside the overlay, retaining a small responsive viewport gutter. Narrow the unboxed copy reading width. Replace the two full-hero directional washes with one bounded lower-left radial fade on a noninteractive pseudo-element; no fade on the rest of the overlay. Mobile keeps the bottom control clearance. All original headline, intro, search, actions, notes and motion behavior remain. No new card, blur, shadow or scroll code.

## Verification

Package77 tests pass (24 source contracts +53 UI/API/session/render), typecheck/build/stylelint/design-system invariants and ratchet/whitespace pass. App lint: zero errors/seven existing warnings. New availability regression verifies store is accepted, unsupported category slugs rejected, unsupported hero/header/catalog/discovery links absent, sitemap store-only declaration and truthful store-builder FAQ. Existing search, zero-price, scope/session, rendering and action tests remain.

Read-only HTTP checks cover homepage, catalog/default and old category query, collections/about/FAQ/guide/docs/API docs/creator guidance/store category:11 responses200 and no unsupported visible advertisements or category links. Four old category paths render Next’s not-found marker without the old category content. Their response status remains200 due to the existing streamed root layout; this is not reported as a404-status fix. Sitemap advertises only the store category. Served CSS includes the corner pseudo-element fade and unrestricted overlay gutter. Wi-Fi homepage200. Backend/shared packages/identity/API/service/database/marketing/configuration have no diff.

Browser/mobile visual, gradient-backed text contrast across actual imagery, keyboard and assistive checks remain pending per owner automated-only instruction. Source/HTTP checks establish delivered composition, not exact visual acceptance.

Logs `/private/tmp/letbuyy-store-scope-{tests,types,lint,css,design,build}.log`, `/private/tmp/letbuyy-store-scope-http.json`; post-commit quick gate `/private/tmp/letbuyy-store-scope-close-20261026/`.
